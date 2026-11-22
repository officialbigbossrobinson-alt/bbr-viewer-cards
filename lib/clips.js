// BBR Clips: one tap makes a Twitch clip of the last few seconds, waits for Twitch to finish it, downloads the
// video file and hands it to the replay player (lib/replay.js). Nothing is recorded by OBS: Twitch does the
// recording on its side.
// Twitch API: POST /clips (scope clips:edit), GET /clips, GET /clips/downloads (scope channel:manage:clips).
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const NEED = ['clips:edit', 'channel:manage:clips'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Clips {
  // o: twitch, dir (folder for the video files), log, onChange(job)
  constructor(o) { Object.assign(this, o); this.jobs = []; this.lastAt = 0; this.n = 0; }

  // why clips can't be made right now (null = fine)
  why() {
    const T = this.twitch;
    if (!T || !T.configured()) return 'Twitch is not set up yet (Setup › Twitch)';
    if (!T.cfg.twitchTokens || !T.user) return 'Connect Twitch first (Setup › Twitch)';
    if (!T.hasScopes(NEED)) return 'Reconnect Twitch once so the app can make clips (Setup › Twitch › Connect Twitch)';
    return null;
  }
  busy() { return this.jobs.some((j) => !/^(ready|failed|waiting)$/.test(j.status)); }
  state() { return this.jobs.slice(-8).reverse().map((j) => ({ key: j.key, status: j.status, label: j.label, secs: j.secs, at: j.at, error: j.error || null, by: j.by || null, auto: !!j.auto, url: j.url || null, thumb: j.thumb || null, clipId: j.replayId || null, twitchId: j.id || null, imported: !!j.imported, canRetry: !!j.id && /^(failed|waiting)$/.test(j.status) })); }
  set(j, status, extra) { Object.assign(j, extra || {}, { status }); if (this.onChange) try { this.onChange(j); } catch (e) { /* ignore */ } }

  // start a clip. Returns at once with the job; the job finishes in the background (15 to 60 seconds).
  start(o) {
    o = o || {};
    const why = this.why(); if (why) return { error: why };
    if (Date.now() - this.lastAt < (o.cooldownMs != null ? o.cooldownMs : 8000)) return { error: 'A clip was made a few seconds ago: wait a moment' };
    if (this.jobs.filter((j) => !/^(ready|failed|waiting)$/.test(j.status)).length >= 3) return { error: 'Three clips are already being made: wait for one to finish' };
    this.lastAt = Date.now();
    const secs = Math.max(5, Math.min(60, Math.round(+o.secs || 30)));
    const j = { key: 'j' + (++this.n) + '-' + Date.now().toString(36), at: Date.now(), secs, label: String(o.label || '').toUpperCase().slice(0, 40), by: o.by || null, auto: !!o.auto, status: 'clipping' };
    this.jobs.push(j); while (this.jobs.length > 30) this.jobs.shift();
    j.promise = this.run(j, o).catch((e) => { this.set(j, 'failed', { error: e.message }); if (this.log) this.log('Clip: ' + e.message); return { error: e.message }; });
    if (this.onChange) this.onChange(j);
    return { ok: true, job: j };
  }
  async run(j, o) {
    const T = this.twitch, uid = T.user.id;
    // 1. ask Twitch for the clip (the last `secs` seconds of the live stream)
    const title = (j.label ? j.label : 'BBR replay').slice(0, 100);
    let r;
    try { r = await T.api('POST', '/clips?broadcaster_id=' + uid + '&duration=' + j.secs + '&title=' + encodeURIComponent(title)); }
    catch (e) { throw new Error(/404|offline|not live/i.test(e.message) ? 'You are not live on Twitch: clips only work while the stream is on' : /403|401/.test(e.message) ? 'Twitch said no: reconnect Twitch (Setup › Twitch) so the app can make clips' : 'Twitch could not make the clip: ' + e.message); }
    const d = (r.data || [])[0]; if (!d || !d.id) throw new Error('Twitch did not return a clip');
    this.set(j, 'processing', { id: d.id, edit: d.edit_url || null });
    return this.fetchClip(j, d.id, o, { edit: d.edit_url || null });
  }
  // v32: steps 2-4 on their own, so a clip Twitch is slow with gets tried again (and any clip on the channel can be pulled in)
  async info(id) {
    for (let i = 0; i < 30; i++) {
      try { const g = await this.twitch.api('GET', '/clips?id=' + encodeURIComponent(id)); const x = (g.data || [])[0]; if (x) return x; } catch (e) { /* not ready yet */ }
      await sleep(i ? 2500 : 3000);
    }
    return null;
  }
  async link(id, tries) {
    const uid = this.twitch.user.id; let last = '';
    for (let i = 0; i < tries; i++) {
      try {
        const g = await this.twitch.api('GET', '/clips/downloads?editor_id=' + uid + '&broadcaster_id=' + uid + '&clip_id=' + encodeURIComponent(id));
        const x = (g.data || [])[0]; const L = x && (x.landscape_download_url || x.portrait_download_url);
        if (L) return L;
        last = x ? 'Twitch is still making the video file' : 'Twitch did not list the clip for download yet';
      } catch (e) {
        if (/ 403 /.test(e.message)) throw new Error('Twitch won\'t let the app download this clip (only clips on your own channel can be downloaded)');
        if (/ 401 /.test(e.message)) throw new Error('Twitch won\'t let the app download clips: reconnect Twitch once (Setup › Twitch › Connect Twitch) and say yes to the clip permissions');
        last = e.message;
      }
      await sleep(Math.min(6000, 2000 + i * 400));
    }
    const err = new Error(last || 'The video file wasn\'t ready'); err.notReady = true; throw err;
  }
  async download(link, id) {
    fs.mkdirSync(this.dir, { recursive: true });
    const file = path.join(this.dir, 'clip-' + String(id).replace(/[^\w-]/g, '').slice(0, 60) + '.mp4'), tmp = file + '.part';
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(link);
        if (!res.ok || !res.body) throw new Error('Download failed (' + res.status + ')');
        await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
        fs.renameSync(tmp, file);
        const size = fs.statSync(file).size; if (size < 10000) throw new Error('The downloaded clip is empty');
        return { file, size };
      } catch (e) { lastErr = e; try { fs.unlinkSync(tmp); } catch (x) { /* none */ } await sleep(2000); }
    }
    throw lastErr;
  }
  async fetchClip(j, id, o, extra) {
    o = o || {}; extra = extra || {};
    // 2. wait until Twitch has finished it
    const info = await this.info(id);
    if (!info) { const e = new Error('Twitch has not finished the clip yet'); e.notReady = true; return this.later(j, id, o, extra, e); }
    this.set(j, 'downloading', { id, url: info.url, thumb: info.thumbnail_url, title: info.title, duration: info.duration });
    // 3. the download link (Twitch makes the video file a little after the clip page: give it up to ~2 minutes)
    let link;
    try { link = await this.link(id, o.quick ? 6 : 30); }
    catch (e) { if (e.notReady) return this.later(j, id, o, extra, e); throw e; }
    // 4. download it next to the app
    const f = await this.download(link, id);
    this.set(j, 'saved', f);
    const out = { ok: true, file: f.file, twitch: { id, url: info.url, thumb: info.thumbnail_url, edit: extra.edit || null, title: info.title, duration: info.duration, by: info.creator_name || null, views: info.view_count || 0, created: info.created_at || null } };
    if (this.onReady) { const x = await this.onReady(j, out, o); if (x && x.clip) j.replayId = x.clip.id; }
    this.set(j, 'ready', { error: null });
    this.unpend(id);
    return out;
  }
  // not ready yet: keep the job and try again in the background every 30 s (up to 15 minutes), also after a restart
  later(j, id, o, extra, e) {
    j.tries = (j.tries || 0) + 1;
    if (j.tries > 30 || Date.now() - j.at > 15 * 60000) { this.unpend(id); throw new Error('Twitch never made the video file for this clip (' + e.message + '). It is still on Twitch: try "Get" in the Twitch clips list later.'); }
    this.set(j, 'waiting', { id, error: e.message + ': trying again by itself' });
    this.pend(id, j, o);
    clearTimeout(j.timer);
    j.timer = setTimeout(() => { j.promise = this.fetchClip(j, id, Object.assign({}, o, { quick: true }), extra).catch((x) => { this.set(j, 'failed', { error: x.message }); return { error: x.message }; }); }, 30000);
    if (j.timer.unref) j.timer.unref();
    return { ok: true, waiting: true };
  }
  // try a waiting / failed job again now
  retry(key) {
    const j = this.jobs.find((x) => x.key === key); if (!j) return { error: 'That clip job has gone' };
    if (!j.id) return { error: 'Twitch never made that clip: tap CLIP again' };
    if (!/^(failed|waiting)$/.test(j.status)) return { error: 'It is still working on it' };
    clearTimeout(j.timer); j.tries = 0; j.at = Date.now();
    this.set(j, 'downloading', { error: null });
    j.promise = this.fetchClip(j, j.id, { quick: true, play: false }).catch((x) => { this.set(j, 'failed', { error: x.message }); return { error: x.message }; });
    return { ok: true };
  }
  // clips waiting for their video file are remembered on disk, so a restart carries on with them
  pendFile() { return path.join(this.dir, 'pending.json'); }
  readPend() { try { return JSON.parse(fs.readFileSync(this.pendFile(), 'utf8')); } catch (e) { return {}; } }
  pend(id, j, o) { const P = this.readPend(); P[id] = { label: j.label, at: j.at, secs: j.secs, by: j.by || null, auto: !!j.auto }; try { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(this.pendFile(), JSON.stringify(P)); } catch (e) { /* ignore */ } }
  unpend(id) { const P = this.readPend(); if (P[id]) { delete P[id]; try { fs.writeFileSync(this.pendFile(), JSON.stringify(P)); } catch (e) { /* ignore */ } } }
  resume() {
    if (this.why()) return 0;
    const P = this.readPend(); let n = 0;
    for (const [id, p] of Object.entries(P)) {
      if (Date.now() - p.at > 60 * 60000) { this.unpend(id); continue; }
      if (this.jobs.some((x) => x.id === id && !/^(ready|failed)$/.test(x.status)) || (this.have && this.have()[id])) { this.unpend(id); continue; }
      this.get(id, { label: p.label, play: false, by: p.by, auto: p.auto }); n++;
    }
    return n;
  }

  // ---------- v32: every clip on your Twitch channel (made by you, the app or chat), to pick and play ----------
  async list(o) {
    o = o || {};
    const why = this.why(); if (why) return { error: why };
    const uid = this.twitch.user.id, days = Math.max(1, Math.min(60, +o.days || 7));
    const since = new Date(Date.now() - days * 864e5).toISOString();
    let g;
    try { g = await this.twitch.api('GET', '/clips?broadcaster_id=' + uid + '&first=' + Math.max(1, Math.min(100, +o.first || 40)) + '&started_at=' + encodeURIComponent(since) + '&ended_at=' + encodeURIComponent(new Date(Date.now() + 60000).toISOString())); }
    catch (e) { return { error: 'Twitch would not list your clips: ' + e.message }; }
    const have = this.have ? this.have() : {};
    const L = (g.data || []).map((c) => ({ id: c.id, title: c.title, by: c.creator_name, at: c.created_at ? Date.parse(c.created_at) : 0, secs: Math.round(c.duration || 0), views: c.view_count || 0, thumb: c.thumbnail_url, url: c.url, have: have[c.id] || null,
      job: (this.jobs.find((x) => x.id === c.id && !/^(ready|failed)$/.test(x.status)) || {}).status || null }));
    L.sort((a, b) => b.at - a.at);
    return { ok: true, list: L, days };
  }
  // download one clip from the channel into the replay list (and play it if asked)
  get(id, o) {
    o = o || {};
    const why = this.why(); if (why) return { error: why };
    id = Clips.idOf(id);
    if (!/^[\w-]{3,120}$/.test(id)) return { error: 'That is not a Twitch clip' };
    const running = this.jobs.find((x) => x.id === id && !/^(ready|failed)$/.test(x.status)); if (running) return { ok: true, job: running, already: true };
    const j = { key: 'j' + (++this.n) + '-' + Date.now().toString(36), at: Date.now(), secs: 0, label: String(o.label || '').toUpperCase().slice(0, 40), by: o.by || null, auto: !!o.auto, status: 'downloading', id, imported: true };
    this.jobs.push(j); while (this.jobs.length > 30) this.jobs.shift();
    if (this.onChange) this.onChange(j);
    j.promise = this.fetchClip(j, id, o).catch((e) => { this.set(j, 'failed', { error: e.message }); if (this.log) this.log('Clip: ' + e.message); return { error: e.message }; });
    return { ok: true, job: j };
  }
  // a clip id from an id or a pasted clip link
  static idOf(x) { return String(x || '').trim().replace(/^https?:\/\/(clips\.twitch\.tv\/|(www\.|m\.)?twitch\.tv\/\w+\/clip\/)/i, '').replace(/[?#].*$/, '').replace(/\/+$/, ''); }
  // the "Check clips" button: tries each step on your newest clip and says exactly what Twitch answered
  async check() {
    const out = [], add = (ok, what) => out.push({ ok, what });
    const why = this.why(); if (why) { add(false, why); return { ok: false, steps: out }; }
    add(true, 'Twitch connected with the clip permissions');
    const L = await this.list({ days: 30, first: 5 });
    if (L.error) { add(false, L.error); return { ok: false, steps: out }; }
    if (!L.list.length) { add(true, 'No clips on your channel in the last 30 days yet: make one while live, then check again'); return { ok: true, steps: out }; }
    const c = L.list[0]; add(true, 'Newest clip found: "' + c.title + '"');
    try { const link = await this.link(c.id, 2); add(true, 'Twitch gave a download link'); const res = await fetch(link, { method: 'GET', headers: { Range: 'bytes=0-1023' } }); add(res.ok || res.status === 206, 'Download works (' + res.status + ')'); }
    catch (e) { add(false, e.message); }
    try { fs.mkdirSync(this.dir, { recursive: true }); fs.accessSync(this.dir, fs.constants.W_OK); add(true, 'Clip folder is writable'); } catch (e) { add(false, 'Can\'t write to the clip folder ' + this.dir); }
    return { ok: out.every((x) => x.ok), steps: out };
  }
}
module.exports = { Clips, NEED };
