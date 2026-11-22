// BBR Replay: one tap makes a Twitch clip of the last seconds (lib/clips.js), downloads it and plays it back,
// presented like a TV replay, while the game capture keeps running underneath.
// Replays are Twitch clips only (v28.2+): Twitch records the clip on its side, nothing records in OBS.
// v23 "Sky-style": the clip plays in an OBS media source ("BBR Replay") at the bottom of the scene, the game capture
// and camera glide into boxes on top of it, and the overlay draws the TV graphics. Everything goes back afterwards.
const fs = require('fs');
const path = require('path');

const SRC = 'BBR Replay', SRC_SLOW = 'BBR Replay Slow', SRC_PIC = 'BBR Replay Camera Picture';
const OBSw = (t) => { const o = { positionX: t.positionX, positionY: t.positionY, scaleX: t.scaleX, scaleY: t.scaleY }; if (t.boundsType && t.boundsType !== 'OBS_BOUNDS_NONE') { o.boundsWidth = t.boundsWidth; o.boundsHeight = t.boundsHeight; } return o; };
const VIDEO_OK = /\.(mp4|m4v|mov|webm)$/i;

class Replay {
  constructor(o) { Object.assign(this, o); this.playing = null; this.lastErr = null; this.bufferOn = null; }   // obs, store, cfg, saveCfg, push, streamNo, log
  S() {
    const c = this.cfg().replay || {};
    const look = c.look === 'studio' ? 'studio' : 'quick';
    return { on: c.on !== false, secs: [10, 15, 20, 30, 45, 60].includes(+c.secs) ? +c.secs : 30, speed: [1, 0.5, 0.25].includes(+c.speed) ? +c.speed : 1, look,
      corner: ['br', 'bl', 'tr'].includes(c.corner) ? c.corner : 'br', boxSize: c.boxSize === 'small' ? 'small' : 'medium', camBox: c.camBox !== false, slowFinish: c.slowFinish !== false,
      sound: !!c.sound, times: Math.max(1, Math.min(3, +c.times || 1)), playNow: c.playNow !== false,
      autoRed: !!c.autoRed, autoMeltdown: c.autoMeltdown !== false, autoGifts: c.autoGifts !== false, giftMin: Math.max(1, Math.min(100, +c.giftMin || 5)), discord: !!c.discord, keepDays: [7, 14, 30, 90].includes(+c.keepDays) ? +c.keepDays : 30,
      decode: c.decode === 'cpu' ? 'cpu' : 'gpu', chat: ['mods', 'subs'].includes(c.chat) ? c.chat : 'off', ofNight: c.ofNight !== false, chatCall: c.chatCall !== false, goalReplay: !!c.goalReplay, pullTwitch: c.pullTwitch !== false, style: /^(auto|football|ets|ats|heist|arc|mgs|neon)$/.test(c.style || '') ? c.style : 'auto',
      camPic: ['none', 'bsn', 'mine'].includes(c.camPic) ? (c.camPic === 'mine' && !this.picFile('cam') ? 'bsn' : c.camPic) : 'bsn', wallPic: !!c.wallPic && !!this.picFile('wall'),
      music: { on: !c.music || c.music.on !== false, mine: !!(c.music && c.music.mine) && !!this.musicFile(), vol: Math.max(0, Math.min(100, c.music && c.music.vol != null ? +c.music.vol : 70)), outro: !c.music || c.music.outro !== false },
      links: ['twitch', 'kick', 'youtube'].map((k) => { const L = (c.links || {})[k] || {}; return { k, on: L.on !== false, text: String(L.text || (this.defaultLink ? this.defaultLink(k) : '')).slice(0, 60) }; }),
      labels: Array.isArray(c.labels) && c.labels.length ? c.labels : ['GOAL', 'SAVE', 'MISS', 'RED CARD', 'SKILL', 'HOWLER', 'WHAT A HIT'] };
  }
  set(n) {
    const c = Object.assign({}, this.cfg().replay || {});
    for (const k of ['on', 'sound', 'playNow', 'autoRed', 'autoMeltdown', 'autoGifts', 'discord', 'ofNight', 'camBox', 'slowFinish', 'chatCall', 'goalReplay', 'pullTwitch']) if (typeof n[k] === 'boolean') c[k] = n[k];
    for (const k of ['secs', 'speed', 'times', 'giftMin', 'keepDays']) if (n[k] != null && isFinite(n[k])) c[k] = +n[k];
    for (const k of ['look', 'corner', 'boxSize', 'chat', 'camPic', 'decode', 'style']) if (typeof n[k] === 'string') c[k] = n[k];
    if (typeof n.wallPic === 'boolean') c.wallPic = n.wallPic;
    if (n.music && typeof n.music === 'object') c.music = Object.assign({}, c.music || {}, { on: n.music.on !== false, mine: !!n.music.mine, vol: Math.max(0, Math.min(100, +n.music.vol || 0)), outro: n.music.outro !== false });
    if (Array.isArray(n.links)) { c.links = {}; for (const L of n.links) if (/^(twitch|kick|youtube)$/.test(L.k)) c.links[L.k] = { on: L.on !== false, text: String(L.text || '').slice(0, 60) }; }
    if (Array.isArray(n.labels)) c.labels = n.labels.map((x) => String(x).toUpperCase().trim().slice(0, 24)).filter(Boolean).slice(0, 12);
    this.cfg().replay = c; this.saveCfg();
  }
  // where things go, in 1920 x 1080 overlay pixels
  boxes(look) {
    const S = this.S();
    if (look === 'studio') return { clip: { x: 60, y: 150, w: 1240, h: 698 }, live: { x: 1340, y: 150, w: 520, h: 292 }, cam: S.camBox ? { x: 1340, y: 474, w: 520, h: 292 } : null, score: { x: 1340, y: 790, w: 520, h: 58 } };
    const w = S.boxSize === 'small' ? 384 : 448, h = Math.round(w * 9 / 16), m = 36, bottom = 1080 - 70;
    const left = S.corner === 'bl' ? m : 1920 - w - m;
    if (S.corner === 'tr') return { clip: { x: 0, y: 0, w: 1920, h: 1080 }, live: { x: left, y: 110, w, h }, cam: S.camBox ? { x: left, y: 110 + h + 18, w, h } : null };
    return { clip: { x: 0, y: 0, w: 1920, h: 1080 }, live: { x: left, y: bottom - h, w, h }, cam: S.camBox ? { x: left, y: bottom - h * 2 - 18, w, h } : null };
  }
  // v32: the replay's colours and words follow the game (or the one you pick)
  style() { const S = this.S(); if (S.style !== 'auto') return S.style; try { return (this.gameLook && this.gameLook()) || 'football'; } catch (e) { return 'football'; } }
  D() { const d = this.store.data; if (!d.replays) d.replays = { n: 0, list: [] }; return d.replays; }
  clip(id) { return this.D().list.find((x) => x.id === id); }

  fail(msg) { this.lastCapture = { at: Date.now(), ok: false, error: msg }; this.lastErr = msg; if (this.log) this.log('Replay: ' + msg); if (this.onFail) try { this.onFail(msg); } catch (e) { /* ignore */ } return { error: msg }; }
  // one tap: make a Twitch clip of the last N seconds. It is downloaded and (if o.play) played as soon as Twitch has it.
  capture(o) {
    o = o || {};
    const S = this.S();
    if (!S.on) return { error: 'Replays are switched off (Live › Replay)' };
    if (!this.clips) return { error: 'Clips are not available' };
    const r = this.clips.start(Object.assign({}, o, { secs: +o.secs || S.secs }));
    if (r.error) return this.fail(r.error);
    this.lastErr = null;
    this.mark('clip');
    return { ok: true, pending: true, job: { key: r.job.key, status: r.job.status, label: r.job.label, secs: r.job.secs } };
  }
  // a finished clip file: add it to the library, play it if asked
  async addFile(file, meta, o) {
    o = o || {};
    const S = this.S(), D = this.D();
    // v32: the same Twitch clip again (pulled in twice): keep one entry
    const same = meta && meta.id ? D.list.find((x) => x.twitch && x.twitch.id === meta.id) : null;
    if (same) { same.path = file; same.twitch = Object.assign({}, same.twitch, meta); this.store.save(); if (o.play) { const p = await this.play(same.id, o); if (p.error) return { ok: true, clip: same, playError: p.error }; } return { ok: true, clip: same, again: true }; }
    D.n++;
    const c = { id: 'c' + D.n + '-' + Date.now().toString(36), n: D.n, path: file, at: Date.now(), no: this.streamNo() || 0, label: String(o.label || (o.auto && meta && meta.title && meta.title !== 'BBR replay' ? meta.title : '') || '').toUpperCase().slice(0, 40), secs: Math.round((meta && meta.duration) || +o.secs || S.secs), speed: +o.speed || S.speed, plays: 0, star: false,
      src: 'twitch', twitch: meta || null, by: o.by || (meta && meta.by) || null, auto: !!o.auto };
    D.list.push(c);
    this.tidy();
    this.store.save();
    this.lastCapture = { at: Date.now(), ok: true, file };
    if (o.play) { const p = await this.play(c.id, o); if (p.error) return { ok: true, clip: c, playError: p.error }; }
    return { ok: true, clip: c };
  }
  // keep the list to 200 and remove old downloaded clip files (starred ones are kept)
  tidy() {
    const D = this.D(), keep = this.S().keepDays * 864e5, now = Date.now();
    const drop = (c) => { if (c.src === 'twitch' && c.path && this.clipDir && c.path.startsWith(this.clipDir)) { try { fs.unlinkSync(c.path); } catch (e) { /* gone */ } } };
    D.list = D.list.filter((c) => { const old = c.src === 'twitch' && !c.star && now - c.at > keep; if (old) drop(c); return !old; });
    while (D.list.length > 200) drop(D.list.shift());
  }

  // files the Boss uploads: camera picture, studio wall, intro music (kept in the app's data folder)
  picFile(kind) { const f = path.join(this.dataDir || '.', 'replay-' + kind + '.png'); return fs.existsSync(f) ? f : null; }
  musicFile() { const f = path.join(this.dataDir || '.', 'replay-music.audio'); return fs.existsSync(f) ? f : null; }
  extras() {
    const S = this.S(), v = (this.cfg().replay || {}).v || 0;
    return { music: S.music.on ? { src: S.music.mine ? '/replay-file/music?v=' + v : null, vol: S.music.vol / 100, outro: S.music.outro } : null,
      links: S.links.filter((l) => l.on && l.text), wall: S.wallPic ? '/replay-file/wall?v=' + v : null };
  }
  async play(id, o) {
    o = o || {};
    const c = this.clip(id); if (!c) return { error: 'Clip not found' };
    if (!fs.existsSync(c.path)) return { error: 'The clip file is gone: ' + c.path };
    if (!this.obs.ready) return { error: 'OBS is not connected (it plays the replay)' };
    if (this.busy) return { error: 'A replay is starting already' };
    if (this.blocked && this.blocked()) return { error: this.blocked() };
    if (this.playing) await this.stop(true);
    const S = this.S(), secs = +o.secs || c.secs || S.secs, speed = +o.speed || c.speed || S.speed, label = o.label != null ? String(o.label).toUpperCase().slice(0, 40) : c.label;
    const look = o.look === 'studio' || o.look === 'quick' ? o.look : S.look, times = +o.times || S.times;
    const slow = S.slowFinish && speed === 1 && secs >= 8;
    const total = secs / speed * times + (slow ? 8 : 0);
    if (!o.temp) { c.plays++; if (o.label != null) c.label = label; } this.store.save();
    this.busy = true;
    const X = this.extras();
    try {
      this.push({ type: 'replay', action: 'sting', out: false, music: X.music, style: this.style() });
      await new Promise((r) => setTimeout(r, 380));                 // the wipe now covers the screen
      const B = this.boxes(look);
      this.mark('load');
      const info = await this.obsIn(c, B, { secs, speed, slow });
      if (!info.cam) B.cam = null;
      this.playing = { id: c.id, n: c.n, label, secs, speed, look, times, total, slow, at: Date.now(), endsAt: Date.now() + total * 1000, ofNight: !!o.ofNight, phase: 'play', loop: 1, frozen: false, style: this.style(), cursor: 0, duration: 0 };
      this.analysis = { shapes: [] };
      this.mark('play');
      this.push(Object.assign({ type: 'replay', action: 'play', boxes: B, score: this.score ? this.score() : null, links: X.links, wall: X.wall }, this.playing));
    } catch (e) {
      this.busy = false; await this.restore().catch(() => {}); this.push({ type: 'replay', action: 'stop' });
      return { error: 'OBS could not play it: ' + e.message };
    }
    this.busy = false;
    this.watch();
    return { ok: true, playing: this.playing };
  }
  // watch the clip in OBS: the moment it ends, play it again, go to slow-mo, or straight back to live
  watch() {
    clearInterval(this.watchT); clearTimeout(this.safeT);
    const P = this.playing; if (!P) return;
    this.safeT = setTimeout(() => { if (this.playing === P && !P.frozen) this.stop(); }, (P.total + 8) * 1000);
    let busy = false, started = Date.now();
    this.watchT = setInterval(async () => {
      if (busy || this.playing !== P || P.frozen) return; busy = true;
      try {
        const src = P.phase === 'slow' ? SRC_SLOW : SRC;
        const st = await this.obs.req('GetMediaInputStatus', { inputName: src });
        const d = st.mediaDuration || 0, cur = st.mediaCursor || 0, state = String(st.mediaState || '');
        P.cursor = cur; P.duration = d; P.posAt = Date.now();
        const done = /ENDED|STOPPED/.test(state) || (d > 0 && cur >= d - 120 && Date.now() - started > 1200);
        if (done) {
          started = Date.now();
          if (P.phase === 'play' && P.loop < P.times) { P.loop++; await this.seek(SRC, P.secs); }
          else if (P.phase === 'play' && P.slow) { P.phase = 'slow'; await this.slowMo(); }
          else { busy = false; return this.stop(); }
        }
      } catch (e) { /* OBS busy: try again next tick */ }
      busy = false;
    }, 350);
  }
  async seek(src, secs) {
    const O = this.obs;
    await O.req('TriggerMediaInputAction', { inputName: src, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART' }).catch(() => {});
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 120));
      try { const st = await O.req('GetMediaInputStatus', { inputName: src }); const dur = st.mediaDuration || 0; if (dur > 0) { if (dur > secs * 1000) await O.req('SetMediaInputCursor', { inputName: src, mediaCursor: dur - secs * 1000 }); return; } } catch (e) { /* loading */ }
    }
  }
  // slow-mo: a second copy of the clip, already set to half speed, takes over (no reload, so no black screen)
  async slowMo() {
    const P = this.playing, M = this.moved; if (!P || !M || M.slowId == null) return;
    this.mark('slow');
    const O = this.obs;
    await O.req('SetSceneItemEnabled', { sceneName: M.scene, sceneItemId: M.slowId, sceneItemEnabled: true });
    await this.seek(SRC_SLOW, 4);
    await new Promise((r) => setTimeout(r, 120));
    await O.req('SetSceneItemEnabled', { sceneName: M.scene, sceneItemId: M.clipId, sceneItemEnabled: false }).catch(() => {});
    P.endsAt = Date.now() + 8000;
    this.push({ type: 'replay', action: 'phase', slow: true, speed: 0.5, endsAt: P.endsAt });
  }
  async stop(quick) {
    if (!this.playing && !this.moved) return { ok: true };
    const id = this.playing && this.playing.id;
    clearInterval(this.watchT); clearTimeout(this.safeT);
    if (!quick) { const X = this.extras(); this.push({ type: 'replay', action: 'sting', out: true, music: X.music && X.music.outro ? { outro: true, vol: X.music.vol } : null, style: (this.playing && this.playing.style) || this.style() }); await new Promise((r) => setTimeout(r, 380)); }
    this.playing = null; this.analysis = null;
    this.mark('back');
    await this.restore().catch((e) => this.log && this.log('Replay restore: ' + e.message));
    this.push({ type: 'replay', action: 'stop' });
    this.mark('live');
    if (this.onEnd) this.onEnd(id);
    return { ok: true };
  }
  ended() { /* the app watches the clip itself */ }
  // the load test listens for each step of a replay
  mark(phase) { if (this.onPhase) { try { this.onPhase(phase); } catch (e) { /* ignore */ } } }
  // OBS is still writing the file just after "saved": wait until it stops growing, so the clip opens in one go
  async settled(file) {
    let last = -1;
    for (let i = 0; i < 15; i++) {
      let size = -1; try { size = fs.statSync(file).size; } catch (e) { return; }   // not on this PC (OBS on another machine): nothing to wait for
      if (size > 0 && size === last) return;
      last = size; await new Promise((r) => setTimeout(r, 250));
    }
  }
  overlayError() { /* not used since v23 */ }

  // ---------- analysis: freeze, step, draw ----------
  activeSrc() { return this.playing && this.playing.phase === 'slow' ? SRC_SLOW : SRC; }
  async freeze(on) {
    const P = this.playing; if (!P) return { error: 'No replay playing' };
    const O = this.obs;
    if (on) { await O.req('TriggerMediaInputAction', { inputName: this.activeSrc(), mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE' }).catch(() => {}); P.frozen = true; clearTimeout(this.safeT); }
    else { await O.req('TriggerMediaInputAction', { inputName: this.activeSrc(), mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY' }).catch(() => {}); P.frozen = false; this.watch(); }
    this.push({ type: 'replay', action: 'freeze', on: !!on });
    return { ok: true, frozen: P.frozen };
  }
  async step(ms) {
    const P = this.playing; if (!P) return { error: 'No replay playing' };
    if (!P.frozen) await this.freeze(true);
    await this.obs.req('OffsetMediaInputCursor', { inputName: this.activeSrc(), mediaCursorOffset: Math.round(ms) }).catch(() => {});
    return { ok: true };
  }
  // ---------- v32: pause, jump and scrub ----------
  async status() {
    const P = this.playing; if (!P) return null;
    try { const st = await this.obs.req('GetMediaInputStatus', { inputName: this.activeSrc() }); P.cursor = st.mediaCursor || 0; P.duration = st.mediaDuration || P.duration || 0; P.posAt = Date.now(); } catch (e) { /* keep the last one */ }
    return { cursor: P.cursor || 0, duration: P.duration || 0, frozen: !!P.frozen, phase: P.phase, n: P.n, label: P.label, speed: P.phase === 'slow' ? 0.5 : P.speed };
  }
  // after you move it, the replay carries on from there (and the "back to live" safety waits for the new end)
  rearm() {
    const P = this.playing; if (!P) return;
    clearTimeout(this.safeT);
    if (P.frozen) return;
    const left = Math.max(2000, ((P.duration || 0) - (P.cursor || 0)) / (P.phase === 'slow' ? 0.5 : P.speed || 1)) + (P.times - P.loop) * P.secs * 1000 / (P.speed || 1) + (P.slow && P.phase === 'play' ? 8000 : 0);
    P.endsAt = Date.now() + left; this.safeT = setTimeout(() => { if (this.playing === P && !P.frozen) this.stop(); }, left + 8000);
    this.push({ type: 'replay', action: 'pos', endsAt: P.endsAt, frozen: !!P.frozen });
  }
  async seekTo(ms) {
    const P = this.playing; if (!P) return { error: 'No replay playing' };
    const d = P.duration || ((await this.status()) || {}).duration || 0;
    const to = Math.max(0, Math.min(d ? d - 150 : +ms, Math.round(+ms || 0)));
    await this.obs.req('SetMediaInputCursor', { inputName: this.activeSrc(), mediaCursor: to }).catch(() => {});
    P.cursor = to; this.rearm();
    return Object.assign({ ok: true }, await this.status());
  }
  async jump(ms) {
    const P = this.playing; if (!P) return { error: 'No replay playing' };
    const st = (await this.status()) || {};
    return this.seekTo((st.cursor || 0) + Math.round(+ms || 0));
  }
  async pauseToggle() {
    const P = this.playing; if (!P) return { error: 'No replay playing' };
    const r = await this.freeze(!P.frozen);
    if (!P.frozen) { await this.status(); this.rearm(); }
    return r;
  }
  async frame() {
    if (!this.playing) return { error: 'No replay playing' };
    try { const r = await this.obs.req('GetSourceScreenshot', { sourceName: this.activeSrc(), imageFormat: 'jpg', imageWidth: 960, imageCompressionQuality: 75 }); return { ok: true, image: r.imageData }; }
    catch (e) { return { error: 'Could not grab the frame: ' + e.message }; }
  }
  draw(shapes, hidden) {
    if (!this.playing) return { error: 'No replay playing' };
    this.analysis = { shapes: (Array.isArray(shapes) ? shapes : []).slice(0, 80), hidden: !!hidden };
    this.push({ type: 'replay', action: 'draw', shapes: this.analysis.hidden ? [] : this.analysis.shapes });
    return { ok: true };
  }

  // ---------- OBS: clip at the bottom of the scene, game + camera into their boxes ----------
  async ensureItem(scene, name, kind, settings) {
    const O = this.obs; let id = null;
    try { await O.req('GetInputSettings', { inputName: name }); await O.req('SetInputSettings', { inputName: name, inputSettings: settings }); }
    catch (e) { id = (await O.req('CreateInput', { sceneName: scene, inputName: name, inputKind: kind, inputSettings: settings, sceneItemEnabled: false })).sceneItemId; }
    if (id == null) { try { id = (await O.req('GetSceneItemId', { sceneName: scene, sourceName: name })).sceneItemId; } catch (e) { id = (await O.req('CreateSceneItem', { sceneName: scene, sourceName: name, sceneItemEnabled: false })).sceneItemId; } }
    return id;
  }
  async obsIn(c, B, P) {
    const O = this.obs, S = this.S();
    if (O.waitCam) await O.waitCam(8000);
    const cur = await O.req('GetCurrentProgramScene'), scene = cur.sceneName || cur.currentProgramSceneName;
    const vs = await O.req('GetVideoSettings'), W = vs.baseWidth || 1920, H = vs.baseHeight || 1080, k = W / 1920, kh = H / 1080;
    const clipT = { positionX: B.clip.x * k, positionY: B.clip.y * kh, alignment: 5, boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsWidth: B.clip.w * k, boundsHeight: B.clip.h * kh, boundsAlignment: 0 };
    const media = (sp) => ({ local_file: c.path, is_local_file: true, looping: false, restart_on_activate: true, close_when_inactive: false, speed_percent: Math.round(sp * 100), hw_decode: S.decode !== 'cpu' });
    // 1. the clip (and a ready-made half-speed copy for the slow-mo finish), at the bottom of the scene
    const id = await this.ensureItem(scene, SRC, 'ffmpeg_source', media(P.speed));
    let slowId = null;
    if (P.slow) { slowId = await this.ensureItem(scene, SRC_SLOW, 'ffmpeg_source', media(0.5)); }
    for (const [x, src] of [[slowId, SRC_SLOW], [id, SRC]]) {
      if (x == null) continue;
      try { await O.req('SetInputMute', { inputName: src, inputMuted: !S.sound }); } catch (e) { /* no audio */ }
      try { await O.req('SetSceneItemIndex', { sceneName: scene, sceneItemId: x, sceneItemIndex: 0 }); } catch (e) { /* keep its place */ }
      await O.req('SetSceneItemTransform', { sceneName: scene, sceneItemId: x, sceneItemTransform: clipT });
    }
    if (slowId != null) await O.req('SetSceneItemEnabled', { sceneName: scene, sceneItemId: slowId, sceneItemEnabled: false }).catch(() => {});
    this.mark('move');
    // 2. remember where everything is, then move it (game group into the LIVE box, camera into its own box)
    const camR = await O.cameraRect(this.camName ? this.camName() : '').catch(() => null);
    const items = (await O.movable(scene)).filter((it) => ![SRC, SRC_SLOW, SRC_PIC].includes(it.sourceName));
    const moved = [];
    for (const it of items) {
      let t = it.sceneItemTransform; try { t = (await O.req('GetSceneItemTransform', { sceneName: scene, sceneItemId: it.sceneItemId })).sceneItemTransform; } catch (e) { /* list copy */ }
      moved.push({ id: it.sceneItemId, name: it.sourceName, t, keep: OBSw(t) });
    }
    this.moved = { scene, clipId: id, slowId, picId: null, items: moved.map((m) => ({ id: m.id, name: m.name, t: m.keep })) };
    try { fs.writeFileSync(this.restoreFile, JSON.stringify(this.moved)); } catch (e) { /* ignore */ }
    const s = Math.min(B.live.w / 1920, B.live.h / 1080), ox = B.live.x * k + (B.live.w * k - W * s) / 2, oy = B.live.y * kh + (B.live.h * kh - H * s) / 2;
    const camM = camR && B.cam ? moved.find((m) => m.name === camR.name) : null;
    for (const m of moved) {
      let to;
      if (m === camM) {
        const r = camR, sc = Math.min(B.cam.w / r.w, B.cam.h / r.h), al = m.t.alignment == null ? 5 : m.t.alignment;
        const ax = (al & 1) ? 0 : (al & 2) ? r.w : r.w / 2, ay = (al & 4) ? 0 : (al & 8) ? r.h : r.h / 2;
        const nx = B.cam.x + (B.cam.w - r.w * sc) / 2, ny = B.cam.y + (B.cam.h - r.h * sc) / 2;
        to = { positionX: (nx + ax * sc) * k, positionY: (ny + ay * sc) * kh, scaleX: m.t.scaleX * sc, scaleY: m.t.scaleY * sc };
        if (m.keep.boundsWidth != null) { to.boundsWidth = m.keep.boundsWidth * sc; to.boundsHeight = m.keep.boundsHeight * sc; }
      } else {
        to = { positionX: ox + m.t.positionX * s, positionY: oy + m.t.positionY * s, scaleX: m.t.scaleX * s, scaleY: m.t.scaleY * s };
        if (m.keep.boundsWidth != null) { to.boundsWidth = m.keep.boundsWidth * s; to.boundsHeight = m.keep.boundsHeight * s; }
      }
      await O.req('SetSceneItemTransform', { sceneName: scene, sceneItemId: m.id, sceneItemTransform: to }).catch(() => {});
    }
    // 3. a picture behind the camera, so its box is never black
    if (camM && S.camPic !== 'none') {
      const file = S.camPic === 'mine' ? this.picFile('cam') : this.bsnPic;
      if (file && fs.existsSync(file)) {
        try {
          const picId = await this.ensureItem(scene, SRC_PIC, 'image_source', { file });
          const ci = (await O.req('GetSceneItemIndex', { sceneName: scene, sceneItemId: camM.id })).sceneItemIndex;
          await O.req('SetSceneItemIndex', { sceneName: scene, sceneItemId: picId, sceneItemIndex: Math.max(0, ci) });
          await O.req('SetSceneItemTransform', { sceneName: scene, sceneItemId: picId, sceneItemTransform: { positionX: B.cam.x * k, positionY: B.cam.y * kh, alignment: 5, boundsType: 'OBS_BOUNDS_STRETCH', boundsWidth: B.cam.w * k, boundsHeight: B.cam.h * kh, boundsAlignment: 0 } });
          await O.req('SetSceneItemEnabled', { sceneName: scene, sceneItemId: picId, sceneItemEnabled: true });
          this.moved.picId = picId; try { fs.writeFileSync(this.restoreFile, JSON.stringify(this.moved)); } catch (e) { /* ignore */ }
        } catch (e) { this.log && this.log('Camera picture: ' + e.message); }
      }
    }
    // 4. start the clip at the right spot
    await O.req('SetSceneItemEnabled', { sceneName: scene, sceneItemId: id, sceneItemEnabled: true });
    await this.seek(SRC, P.secs);
    return { cam: !!camM };
  }
  // put everything back exactly (also after a crash: the file is read at start-up)
  async restore() {
    const M = this.moved || (() => { try { return JSON.parse(fs.readFileSync(this.restoreFile, 'utf8')); } catch (e) { return null; } })();
    if (!M || !this.obs.ready) return;
    const O = this.obs;
    for (const it of M.items) await O.req('SetSceneItemTransform', { sceneName: M.scene, sceneItemId: it.id, sceneItemTransform: it.t }).catch(() => {});
    for (const x of [M.clipId, M.slowId, M.picId]) if (x != null) await O.req('SetSceneItemEnabled', { sceneName: M.scene, sceneItemId: x, sceneItemEnabled: false }).catch(() => {});
    for (const src of [SRC, SRC_SLOW]) { try { await O.req('TriggerMediaInputAction', { inputName: src, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP' }); } catch (e) { /* ignore */ } }
    this.moved = null; try { fs.unlinkSync(this.restoreFile); } catch (e) { /* ignore */ }
  }

  // ---------- serving a clip to the overlay (with Range so the video can seek) ----------
  serve(id, req, res) {
    const c = this.clip(id); if (!c || !fs.existsSync(c.path)) { res.writeHead(404); return res.end(); }
    const size = fs.statSync(c.path).size, ext = path.extname(c.path).toLowerCase();
    const type = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.flv': 'video/x-flv', '.ts': 'video/mp2t' }[ext] || 'application/octet-stream';
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], size - 1) : size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'no-store' });
      return fs.createReadStream(c.path, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    fs.createReadStream(c.path).pipe(res);
  }
  remove(id, delFile) {
    const D = this.D(), i = D.list.findIndex((x) => x.id === id); if (i < 0) return { error: 'Clip not found' };
    const [c] = D.list.splice(i, 1); this.store.save();
    if (delFile) { try { fs.unlinkSync(c.path); } catch (e) { /* already gone */ } }
    return { ok: true };
  }
  star(id) { const c = this.clip(id); if (!c) return { error: 'Clip not found' }; c.star = !c.star; this.store.save(); return { ok: true }; }
  bestOfNight(no) { const L = this.D().list.filter((x) => x.no === no && x.star); return L[L.length - 1] || null; }
  state() {
    const S = this.S(), no = this.streamNo() || 0;
    return { settings: S, playing: this.playing, analysis: this.analysis || null, lastCapture: this.lastCapture || null, files: { cam: !!this.picFile('cam'), wall: !!this.picFile('wall'), music: !!this.musicFile() }, error: this.lastErr, obs: !!this.obs.ready,
      clipsReady: this.clips ? this.clips.why() : 'not available', jobs: this.clips ? this.clips.state() : [],
      clips: this.D().list.slice().reverse().slice(0, 60).map((c) => ({ id: c.id, n: c.n, label: c.label, at: c.at, secs: c.secs, speed: c.speed, plays: c.plays, star: c.star, tonight: c.no === no, file: path.basename(c.path), ok: fs.existsSync(c.path), src: c.src || 'obs', thumb: c.twitch ? c.twitch.thumb : null, url: c.twitch ? c.twitch.url : null, edit: c.twitch ? c.twitch.edit : null, by: c.by || null, auto: !!c.auto })) };
  }
}
module.exports = { Replay };
