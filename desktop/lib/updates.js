// Updates: checks your GitHub release page, downloads in the background, and installs only when you say so
// and never while you're live (unless you untick that). A full backup is made first, every time.
// "Go back a version" and "Install from a file" go through the same backup + live checks.
const fs = require('fs');
const os = require('os');
const path = require('path');
const R = require('./releases');

function notesText(n) {
  if (!n) return '';
  if (Array.isArray(n)) return n.map((x) => (x.version ? 'Version ' + R.short(x.version) + '\n' : '') + notesText(x.note)).join('\n\n');
  return String(n).replace(/<\/(p|li|h\d|div)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '· ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
}

class Updates {
  // o: { updater, settings, backups, server, current, isLive(), log(), quit(), spawn(file,args), fetch, notify(title,body), changed() }
  constructor(o) {
    this.o = o;
    this.s = { phase: 'idle', version: null, notes: '', percent: 0, error: null, lastChecked: null, afterStream: false, prev: null, busy: null };
    this.wasLive = false; this.liveOffTicks = 0;
    const u = o.updater;
    u.autoDownload = false;
    u.autoInstallOnAppQuit = false;
    u.allowDowngrade = false;
    u.logger = { info: (m) => o.log('[update] ' + m), warn: (m) => o.log('[update] ' + m), error: (m) => o.log('[update] ' + m), debug: () => {} };
    this.applyChannel();
    u.on('checking-for-update', () => this.set({ phase: 'checking', error: null }));
    u.on('update-not-available', () => this.set({ phase: 'none', lastChecked: Date.now() }));
    u.on('update-available', (info) => {
      const v = R.short(info.version);
      this.set({ lastChecked: Date.now(), version: v, notes: notesText(info.releaseNotes), percent: 0 });
      if (this.o.settings.get('skipVersion') === v && !this.manual) { this.set({ phase: 'skipped' }); return; }
      this.set({ phase: 'downloading' });
      Promise.resolve(u.downloadUpdate()).catch((e) => this.fail(e));
    });
    u.on('download-progress', (p) => this.set({ phase: 'downloading', percent: Math.round(p.percent || 0) }));
    u.on('update-downloaded', (info) => {
      const v = R.short(info.version);
      const after = this.o.settings.get('afterStream') === v;
      this.set({ phase: 'ready', version: v, percent: 100, afterStream: after });
      this.o.notify('Version ' + v + ' is ready', after ? 'It installs when you end your stream.' : 'Open the app to update (about 20 seconds). It never installs while you\'re live.');
    });
    u.on('error', (e) => this.fail(e));
  }

  applyChannel() { this.o.updater.allowPrerelease = this.o.settings.get('channel') === 'beta'; this.o.updater.channel = 'latest'; }
  set(p) { Object.assign(this.s, p); if (this.o.changed) this.o.changed(this.state()); }
  fail(e) { const m = (e && e.message) || String(e); this.o.log('[update] error: ' + m); this.set({ phase: 'error', busy: null, error: /404|Cannot find latest|No published versions|HttpError: 404/i.test(m) ? 'No version on the release page yet.' : /ENOTFOUND|ETIMEDOUT|ECONNRESET|net::|getaddrinfo/i.test(m) ? 'Can\'t reach GitHub. Check the internet and try again.' : m.split('\n')[0].slice(0, 200) }); }
  state() { return Object.assign({ current: this.o.current }, this.s, { skipVersion: this.o.settings.get('skipVersion') }); }

  async check(manual) {
    this.manual = !!manual;
    if (['downloading', 'installing'].includes(this.s.phase)) return this.state();
    if (this.s.phase === 'ready') return this.state();
    this.applyChannel();
    try { await this.o.updater.checkForUpdates(); } catch (e) { this.fail(e); }
    return this.state();
  }

  skip() { if (!this.s.version) return this.state(); this.o.settings.set({ skipVersion: this.s.version, afterStream: null }); this.set({ afterStream: false, phase: this.s.phase === 'ready' ? 'ready' : 'skipped' }); return this.state(); }

  afterStream() {
    if (this.s.phase !== 'ready' && this.s.phase !== 'downloading') return { error: 'There\'s no update ready yet.' };
    this.o.settings.set({ afterStream: this.s.version, skipVersion: null });
    this.set({ afterStream: true });
    return { ok: true, live: this.o.isLive(), msg: this.o.isLive() ? 'It installs when you end your stream.' : 'It installs after your next stream ends. Or press Update now.' };
  }

  // "Update now". While live: with "Never install while I'm live" on, it waits for the end of the stream;
  // with it off, you're asked to confirm first.
  async install(args) {
    const a = args || {};
    if (this.s.phase !== 'ready') return { error: this.s.phase === 'downloading' ? 'Still downloading (' + this.s.percent + '%).' : 'There\'s no update ready.' };
    const g = this.liveGuard(a, 'update');
    if (g) { if (g.waiting) this.afterStream(); return g; }
    return this.run('Installing version ' + this.s.version, 'to-' + this.s.version, () => this.o.updater.quitAndInstall(true, true));
  }

  liveGuard(a, what) {
    if (!this.o.isLive()) return null;
    if (this.o.settings.get('neverWhileLive')) return { waiting: what === 'update', live: true, error: what === 'update' ? null : 'You\'re live. Do this after your stream (or untick "Never install while I\'m live").', msg: what === 'update' ? 'You\'re live, so it waits: it installs when you end the stream.' : null };
    if (!a.confirmLive) return { needConfirm: true, live: true, msg: 'You\'re live. The overlay goes away for about 20 seconds while it installs. Do it now?' };
    return null;
  }

  // stop the server (it saves everything) -> full backup -> install. If the backup fails nothing is installed.
  async run(label, backupLabel, go, extra) {
    if (this.s.busy) return { error: 'Busy: ' + this.s.busy };
    this.set({ phase: this.s.phase === 'ready' ? 'installing' : this.s.phase, busy: label });
    // the dashboard is told "started" now: the server it talks to is about to stop
    if (this.onAccept) { const f = this.onAccept; this.onAccept = null; await f(); }
    this.o.log('[update] ' + label + ': saving and backing up first');
    await this.o.server.stop();
    let meta;
    try {
      meta = this.o.backups.make(extra && extra.reason || 'before-update', this.o.current, backupLabel);
      this.o.backups.prune(this.o.settings.get('keepBackups'));
      if (extra && extra.before) await extra.before();
    } catch (e) {
      this.o.log('[update] ' + e.message + ' - nothing installed');
      this.o.server.start();
      this.set({ phase: this.s.phase === 'installing' ? 'ready' : this.s.phase, busy: null, error: e.message });
      return { error: e.message + ' Nothing was installed.' };
    }
    this.o.settings.set({ afterStream: null });
    this.o.log('[update] backup ' + meta.id + ' done. ' + label);
    try { await go(); } catch (e) { this.o.server.start(); this.set({ busy: null }); this.fail(e); return { error: (e && e.message) || String(e) }; }
    return { ok: true, backup: meta.id };
  }

  // called every 30 s with "are we live?": installs a waiting update once the stream has ended
  tick(live) {
    if (live) { this.wasLive = true; this.liveOffTicks = 0; return null; }
    if (!this.wasLive) return null;
    if (++this.liveOffTicks < 2) return null;   // ended for a minute (the server already waits 3 minutes before it calls a stream over)
    this.wasLive = false;
    if (this.s.phase === 'ready' && this.o.settings.get('afterStream') === this.s.version) { this.o.log('[update] stream ended: installing ' + this.s.version); return this.install({}); }
    return null;
  }

  // ----- Go back a version -----
  async previous() {
    try {
      const rel = R.findPrevious(this.o.current, await R.listReleases(this.o.fetch), this.o.settings.get('channel') === 'beta');
      const p = rel ? { version: R.short(rel.tag_name), tag: rel.tag_name, name: R.installerAsset(rel).name, url: R.installerAsset(rel).browser_download_url, size: R.installerAsset(rel).size, yml: (rel.assets.find((x) => x.name === 'latest.yml') || {}).browser_download_url || null, at: rel.published_at } : null;
      const b = this.o.backups.beforeVersion(R.short(this.o.current));
      this.set({ prev: p ? Object.assign(p, { dataBackup: b ? { id: b.id, at: b.at } : null }) : { none: true } });
      return this.s.prev;
    } catch (e) { this.set({ prev: { error: e.message } }); return this.s.prev; }
  }

  async goBack(args) {
    const a = args || {};
    const g = this.liveGuard(a, 'goback'); if (g) return g;
    const p = (this.s.prev && this.s.prev.url) ? this.s.prev : await this.previous();
    if (!p || !p.url) return { error: (p && p.error) || 'There\'s no older version on the release page.' };
    const dir = path.join(os.tmpdir(), 'bbr-viewer-cards'); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, p.name);
    this.set({ busy: 'Downloading version ' + p.version, percent: 0 });
    try {
      let sha = null;
      if (p.yml) { const r = await this.o.fetch(p.yml, { headers: { 'User-Agent': 'BBR-Viewer-Cards' } }); if (r.ok) sha = R.shaFromYml(await r.text(), p.name); }
      if (!sha) throw new Error('Version ' + p.version + ' has no checksum on the release page, so it can\'t be checked. Use "Install from a file" instead.');
      await R.download(this.o.fetch, p.url, file, { sha512: sha, size: p.size, onProgress: (n) => this.set({ percent: n }) });
    } catch (e) { this.set({ busy: null }); return { error: e.message }; }
    this.set({ busy: null });
    const restore = a.restoreData && p.dataBackup ? p.dataBackup.id : null;
    return this.run('Going back to version ' + p.version, 'back-to-' + p.version, () => this.launch(file), {
      reason: 'before-goback',
      before: restore ? () => { this.o.backups.restore(restore, this.o.current); this.o.log('[update] data put back to backup ' + restore); } : null
    });
  }

  // ----- Install from a file (the Setup .exe from the chat) -----
  inspectFile(file) {
    if (!file || !fs.existsSync(file)) return { error: 'That file isn\'t there.' };
    if (!/\.exe$/i.test(file)) return { error: 'Pick the installer: BBR-Viewer-Cards-Setup-<version>.exe' };
    const st = fs.statSync(file);
    if (st.size < 1024 * 1024) return { error: 'That file is too small to be the app\'s installer.' };
    const m = /setup[-. _]*v?(\d+(?:\.\d+){0,2})/i.exec(path.basename(file));
    const okName = /bbr/i.test(path.basename(file));
    return { ok: true, file, name: path.basename(file), version: m ? R.short(m[1]) : null, size: st.size, warn: okName ? null : 'The name doesn\'t look like the BBR installer. Only use the file Claude gave you.' };
  }

  async installFile(file, args) {
    const info = this.inspectFile(file); if (info.error) return info;
    const g = this.liveGuard(args || {}, 'file'); if (g) return g;
    return this.run('Installing ' + info.name, 'to-' + (info.version || 'file'), () => this.launch(file));
  }

  launch(file) {
    this.o.log('[update] running ' + file);
    this.o.spawn(file, ['/S', '--force-run']);
    setTimeout(() => this.o.quit(), 400);
  }
}

module.exports = { Updates, notesText };
