// Diagnostics + self-healing.
// Keeps the last errors in memory, runs health checks, and (if auto-fix is on) quietly fixes safe things:
// reconnects chat / OBS, resets a stuck battle, puts the OBS scene back, keeps daily data backups.
// Anything it does is written to the fix log shown in the settings page (System > Diagnostics).
const fs = require('fs');
const path = require('path');

class Diag {
  constructor(o) {
    Object.assign(this, o);   // { cfg(), dataDir, file (viewers.json), platforms, obs, battle, overlays(), isLive(), save(), version }
    this.errors = []; this.fixes = []; this.lastFix = {}; this.since = {}; this.lag = 0; this.started = Date.now();
    this.battleSince = { phase: 'idle', at: Date.now() };
    this.hook();
    let last = Date.now();
    setInterval(() => { const now = Date.now(); this.lag = Math.max(0, now - last - 1000); last = now; }, 1000).unref();
    setInterval(() => this.tick().catch((e) => this.err('diag', e)), 30000).unref();
    setTimeout(() => this.backup(false), 20000).unref();
  }
  // capture errors and warnings from everywhere in the app, and never let one crash it
  hook() {
    const keep = (level, args) => {
      const msg = args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ').slice(0, 500);
      const last = this.errors[this.errors.length - 1];
      if (last && last.msg === msg && Date.now() - last.at < 60000) { last.n++; last.at = Date.now(); return; }
      this.errors.push({ at: Date.now(), level, msg, n: 1 });
      if (this.errors.length > 200) this.errors.shift();
    };
    const oe = console.error.bind(console), ow = console.warn.bind(console);
    console.error = (...a) => { keep('error', a); oe(...a); };
    console.warn = (...a) => { keep('warn', a); ow(...a); };
    process.on('uncaughtException', (e) => { keep('crash', ['Unexpected error (the app kept running): ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e)]); oe(e); });
    process.on('unhandledRejection', (e) => { keep('error', ['Unhandled: ' + (e && e.message ? e.message : e)]); });
  }
  err(where, e) { console.error('[' + where + ']', e && e.message ? e.message : e); }
  log(text, auto) { this.fixes.push({ at: Date.now(), text, auto: !!auto }); if (this.fixes.length > 100) this.fixes.shift(); }
  // how long has a condition been true (ms), 0 = not true right now
  held(id, cond) { if (!cond) { delete this.since[id]; return 0; } if (!this.since[id]) this.since[id] = Date.now(); return Date.now() - this.since[id]; }
  cool(id, ms) { const t = this.lastFix[id] || 0; if (Date.now() - t < ms) return false; this.lastFix[id] = Date.now(); return true; }

  backup(force) {
    try {
      const dir = path.join(this.dataDir, 'backups');
      fs.mkdirSync(dir, { recursive: true });
      const day = new Date().toISOString().slice(0, 10), out = path.join(dir, 'viewers-' + day + '.json');
      if (!force && fs.existsSync(out)) return null;
      if (!fs.existsSync(this.file)) return null;
      JSON.parse(fs.readFileSync(this.file, 'utf8'));   // only back up a file that reads correctly
      fs.copyFileSync(this.file, out);
      const all = fs.readdirSync(dir).filter((f) => /^viewers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
      while (all.length > 7) fs.unlinkSync(path.join(dir, all.shift()));
      return out;
    } catch (e) { this.err('backup', e); return null; }
  }
  backups() { try { return fs.readdirSync(path.join(this.dataDir, 'backups')).filter((f) => f.endsWith('.json')).sort().reverse(); } catch (e) { return []; } }

  // ---------- the checks ----------
  checks() {
    const C = [], cfg = this.cfg(), P = this.platforms, live = this.isLive();
    const add = (id, level, title, detail, fix) => C.push({ id, level, title, detail, fix: fix || null });
    // Node
    const nv = process.versions.node.split('.').map(Number);
    add('node', nv[0] > 22 || (nv[0] === 22 && nv[1] >= 4) ? 'ok' : 'warn', 'Node.js ' + process.versions.node, nv[0] >= 22 ? 'Up to date.' : 'Please install Node.js 22 or newer from nodejs.org (the OBS link needs it).');
    // platforms
    const t = P.twitch, k = P.kick, y = P.youtube;
    if (!t.configured()) add('twitch', 'info', 'Twitch not set up', 'Add your Twitch app details on the Platforms page if you stream there.');
    else if (!cfg.twitchTokens) add('twitch', 'warn', 'Twitch not signed in', 'Press "Connect Twitch" on the Platforms page.');
    else add('twitch', t.connected ? 'ok' : 'error', t.connected ? 'Twitch connected' + (t.user ? ' as ' + t.user.login : '') : 'Twitch is disconnected', t.connected ? (t.live ? 'Live, reading chat.' : 'Waiting for you to go live.') : (t.lastError || 'Lost the connection.'), t.connected ? null : { id: 'twitch', label: 'Reconnect Twitch', auto: true });
    if (!k.configured()) add('kick', 'info', 'Kick not set up', 'Add your Kick channel name on the Platforms page if you stream there.');
    else add('kick', k.connected ? 'ok' : 'error', k.connected ? 'Kick chat connected' : 'Kick chat is disconnected', k.connected ? (k.live ? 'Live.' : 'Waiting for you to go live.') : (k.lastError || 'Lost the connection.'), k.connected ? null : { id: 'kick', label: 'Reconnect Kick', auto: true });
    if (!y.configured()) add('youtube', 'info', 'YouTube not set up', 'Add your YouTube app details on the Platforms page if you stream there.');
    else if (!cfg.ytTokens) add('youtube', 'warn', 'YouTube not signed in', 'Press "Connect YouTube" on the Platforms page.');
    else {
      const q = y.quota(), b = y.budget();
      if (y.connected) add('youtube', q > b * 0.9 ? 'warn' : 'ok', 'YouTube chat connected', 'Daily quota used ' + q + ' / ' + b + (q > b * 0.9 ? ': nearly out, chat reading slows down until midnight Pacific time.' : '.'));
      else add('youtube', live ? 'warn' : 'ok', live ? 'YouTube: live chat not found' : 'YouTube signed in', live ? (y.lastError || 'You\'re live elsewhere but no YouTube live stream was found yet. It checks again every few minutes.') : 'Waiting for you to go live.', live ? { id: 'youtube', label: 'Look for the YouTube stream now', auto: false } : null);
    }
    // overlay
    const ov = this.overlays();
    const other = this.pagesText ? this.pagesText() : '';
    add('overlay', ov ? 'ok' : live ? 'error' : 'warn', ov ? 'Overlay open in OBS (' + ov + ')' : 'No overlay connected', (ov ? 'Alerts and battles will show.' : 'Add http://localhost:' + (this.cfg().port || 3000) + '/overlay as a Browser Source in OBS (1920 × 1080). If it is added, right-click it in OBS > Refresh.') + (other ? ' Other BBR pages open: ' + other + '.' : ''), ov ? { id: 'reload', label: 'Reload the overlay', auto: false } : null);
    // OBS
    const o = this.obs.status();
    if (o.on) add('obs', o.connected ? 'ok' : 'error', o.connected ? 'OBS connected' : 'OBS not connected', o.connected ? (o.cornered ? 'Your scene is in the corner (a battle is on).' : 'Ready to move your scene during battles.') : (o.error || 'Check OBS is open with the WebSocket server on.'), o.connected ? (o.cornered && this.battle.phase === 'idle' ? { id: 'obsRestore', label: 'Put my scene back', auto: true } : null) : { id: 'obs', label: 'Reconnect OBS', auto: true });
    // battles
    const B = this.battle, stuckMs = Date.now() - this.battleSince.at;
    if (B.phase !== 'idle' && stuckMs > 8 * 60000) add('battle', 'error', 'A battle looks stuck', 'It has been "' + B.phase + '" for ' + Math.round(stuckMs / 60000) + ' minutes.', { id: 'battle', label: 'Reset the battle', auto: true });
    else add('battle', cfg.battlesPaused ? 'warn' : 'ok', cfg.battlesPaused ? 'Battles are paused' : B.phase === 'idle' ? 'Battles ready' : 'Battle running: ' + (B.mode || '') + ' (' + B.phase + ')', cfg.battlesPaused ? 'Nothing starts until you press Resume on the Battles page.' : cfg.battlesEnabled === false ? 'Automatic battles are switched off.' : 'OK.', cfg.battlesPaused ? { id: 'resume', label: 'Resume battles', auto: false } : null);
    // data
    let size = 0, readable = true;
    try { size = fs.statSync(this.file).size; JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { readable = !fs.existsSync(this.file) ? true : false; }
    const bk = this.backups();
    add('data', readable ? 'ok' : 'error', readable ? 'Viewer data OK' : 'Viewer data file is damaged', readable ? (size / 1024).toFixed(0) + ' KB · ' + bk.length + ' daily backup' + (bk.length === 1 ? '' : 's') + (bk[0] ? ' (latest ' + bk[0].slice(8, 18) + ')' : '') : 'The app keeps running from memory. Restore the latest backup from the data/backups folder.', { id: 'backup', label: 'Back up now', auto: false });
    let writable = true; try { const f = path.join(this.dataDir, '.write-test'); fs.writeFileSync(f, 'ok'); fs.unlinkSync(f); } catch (e) { writable = false; }
    if (!writable) add('disk', 'error', 'Can\'t save data', 'The data folder can\'t be written to. Is the disk full, or is the folder read-only / in a cloud-sync folder?');
    // performance
    const mem = process.memoryUsage().rss / 1048576;
    add('perf', this.lag > 250 || mem > 700 ? 'warn' : 'ok', 'App performance', 'Delay ' + this.lag + ' ms · memory ' + mem.toFixed(0) + ' MB · running ' + Math.round((Date.now() - this.started) / 60000) + ' min' + (this.lag > 250 ? '. The PC is very busy (OBS + game), battles may stutter.' : '.'));
    // recent errors
    const hour = this.errors.filter((e) => Date.now() - e.at < 3600000 && e.level !== 'warn');
    add('errors', hour.length ? (hour.some((e) => e.level === 'crash') ? 'error' : 'warn') : 'ok', hour.length ? hour.length + ' error' + (hour.length === 1 ? '' : 's') + ' in the last hour' : 'No errors in the last hour', hour.length ? 'Latest: ' + hour[hour.length - 1].msg.slice(0, 160) : 'All good.', hour.length ? { id: 'clearErrors', label: 'Clear the list', auto: false } : null);
    if (this.extra) for (const c of this.extra()) add(c.id, c.level, c.title, c.detail, c.fix);
    // rules link
    if (!cfg.rulesUrl) add('rules', 'info', 'No rules page link', 'Paste your public rules page link on the Battles page so !rules works.');
    return C;
  }

  async fix(id, auto) {
    const P = this.platforms;
    const did = (t) => { this.log(t, auto); return t; };
    if (id === 'twitch') { P.twitch.stop(); await P.twitch.start(); return did('Reconnected Twitch'); }
    if (id === 'kick') { await P.kick.start(); return did('Reconnected Kick chat'); }
    if (id === 'youtube') { await P.youtube.start(); return did('Looked for the YouTube live stream'); }
    if (id === 'obs') { await this.obs.connect(); return did(this.obs.ready ? 'Reconnected to OBS' : 'Tried to reconnect OBS: ' + (this.obs.error || 'no answer')); }
    if (id === 'obsRestore') { await this.obs.restore(); return did('Put the OBS scene back after a battle'); }
    if (id === 'battle') { this.battle.cancel(); this.battleSince = { phase: 'idle', at: Date.now() }; return did('Reset a stuck battle'); }
    if (id === 'reload') { this.reloadOverlays(); return did('Reloaded the overlay'); }
    if (id === 'backup') { const f = this.backup(true); return did(f ? 'Backed up viewer data (' + path.basename(f) + ')' : 'Backup failed'); }
    if (id === 'clearErrors') { this.errors = []; return 'Cleared'; }
    if (id === 'resume') { this.resume(); return did('Resumed battles'); }
    if (this.extraFix) { const r = await this.extraFix(id); if (r) return did(r); }
    throw new Error('Unknown fix');
  }

  // every 30 seconds: track the battle, and auto-fix safe problems that have lasted a while
  async tick() {
    const B = this.battle;
    if (B.phase !== this.battleSince.phase) this.battleSince = { phase: B.phase, at: Date.now() };
    this.backup(false);
    if (this.cfg().autoFix === false) return;
    const P = this.platforms, cfg = this.cfg();
    const tries = [];
    if (this.held('twitch', P.twitch.configured() && cfg.twitchTokens && !P.twitch.connected) > 90000 && this.cool('twitch', 5 * 60000)) tries.push('twitch');
    if (this.held('kick', P.kick.configured() && !P.kick.connected) > 90000 && this.cool('kick', 5 * 60000)) tries.push('kick');
    const o = this.obs.status();
    if (this.held('obs', o.on && !o.connected) > 60000 && this.cool('obs', 3 * 60000)) tries.push('obs');
    if (this.held('obsRestore', o.connected && o.cornered && B.phase === 'idle') > 20000 && this.cool('obsRestore', 60000)) tries.push('obsRestore');
    if (B.phase !== 'idle' && Date.now() - this.battleSince.at > 8 * 60000 && this.cool('battle', 60000)) tries.push('battle');
    for (const id of tries) { try { await this.fix(id, true); } catch (e) { this.log('Auto-fix "' + id + '" failed: ' + e.message, true); } }
  }

  report() {
    const lines = ['BBR Viewer Cards diagnostics · ' + new Date().toString(), 'Version ' + (this.version || '?') + ' · Node ' + process.versions.node + ' · ' + process.platform, ''];
    for (const c of this.checks()) lines.push('[' + c.level.toUpperCase() + '] ' + c.title + ': ' + c.detail);
    lines.push('', 'Recent errors:'); for (const e of this.errors.slice(-40)) lines.push(new Date(e.at).toLocaleTimeString() + ' ' + e.level + (e.n > 1 ? ' x' + e.n : '') + ': ' + e.msg);
    lines.push('', 'Fixes:'); for (const f of this.fixes.slice(-40)) lines.push(new Date(f.at).toLocaleTimeString() + (f.auto ? ' (auto) ' : ' ') + f.text);
    // never include passwords, tokens or secrets
    return lines.join('\n').replace(/(secret|token|password|key)=\S+/gi, '$1=***');
  }
}

module.exports = { Diag };
