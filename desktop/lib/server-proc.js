// Runs the BBR server (server.js, the same one as always) in the background, on localhost:3000 so your OBS
// links don't change. Restarts it if it ever crashes, and asks it to save before it stops.
const { EventEmitter } = require('events');
const cp = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// what is on this port right now? { bbr: {...status} } | { other: true } | null (nothing there)
function probe(port, ms) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/app/status', timeout: ms || 1500 }, (res) => {
      let s = ''; res.setEncoding('utf8'); res.on('data', (d) => { s += d; }); res.on('end', () => { try { const j = JSON.parse(s); resolve(j && j.bbr ? { bbr: j } : { other: true }); } catch (e) { resolve({ other: true }); } });
    });
    req.on('timeout', () => { req.destroy(); resolve({ other: true }); });
    req.on('error', (e) => resolve(e.code === 'ECONNREFUSED' ? null : { other: true, error: e.code }));
  });
}

// older versions (before v36 had /api/app/status) still answer /api/status
async function probeAny(port) {
  const a = await probe(port);
  if (!a || a.bbr) return a;
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/status', timeout: 1500 }, (res) => { let s = ''; res.on('data', (d) => { s += d; }); res.on('end', () => { try { const j = JSON.parse(s); resolve(j && j.twitch && j.battle ? { bbr: { version: 'old', old: true } } : a); } catch (e) { resolve(a); } }); });
    req.on('timeout', () => { req.destroy(); resolve(a); }); req.on('error', () => resolve(a));
  });
}

function readPort(home) {
  try { const c = JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8')); const p = Number(c.port); if (p > 0 && p < 65536) return p; } catch (e) { /* default */ }
  return 3000;
}

class ServerProc extends EventEmitter {
  constructor(o) {
    super();
    this.o = o;   // { serverPath, home, log, fork?, execPath?, env? }
    this.child = null; this.ready = false; this.stopping = false; this.crashes = []; this.port = readPort(o.home); this.status = 'stopped'; this.lastError = null;
  }

  start() {
    if (this.child) return;
    this.port = readPort(this.o.home);
    this.stopping = false; this.ready = false; this.status = 'starting';
    const env = Object.assign({}, process.env, this.o.env || {}, { ELECTRON_RUN_AS_NODE: '1', BBR_HOME: this.o.home, BBR_DESKTOP: '1', NO_BROWSER: '1' });
    const fork = this.o.fork || cp.fork;
    const child = fork(this.o.serverPath, [], { cwd: path.dirname(this.o.serverPath), env, execPath: this.o.execPath || process.execPath, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
    this.child = child;
    const line = (pre) => (d) => String(d).split(/\r?\n/).forEach((l) => { if (l.trim()) this.o.log(pre + l); });
    if (child.stdout) child.stdout.on('data', line(''));
    if (child.stderr) child.stderr.on('data', line('ERR '));
    child.on('message', (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'ready') { this.ready = true; this.status = 'running'; this.lastError = null; this.port = m.port || this.port; this.emit('ready', m); }
      else if (m.type === 'listen-error') { this.lastError = m; this.emit('listen-error', m); }
      else if (m.type === 'app') this.emit('request', m, (data) => this.reply(m.id, data));
    });
    child.on('exit', (code, sig) => {
      const was = this.child === child; if (was) this.child = null;
      this.ready = false;
      if (!was) return;
      if (this.stopping) { this.status = 'stopped'; this.emit('stopped', code); return; }
      if (this.lastError && this.lastError.type === 'listen-error') { this.status = 'port-busy'; this.emit('port-busy', this.lastError); return; }
      // crashed: start it again (quickly at first), but stop trying after 5 crashes in 2 minutes
      const now = Date.now(); this.crashes = this.crashes.filter((t) => now - t < 120000); this.crashes.push(now);
      this.o.log('Server stopped unexpectedly (code ' + code + (sig ? ', ' + sig : '') + ')');
      if (this.crashes.length >= 5) { this.status = 'gave-up'; this.emit('gave-up', code); return; }
      this.status = 'restarting'; this.emit('crash', code);
      const wait = [500, 1500, 4000, 8000][this.crashes.length - 1] || 8000;
      this.restartTimer = setTimeout(() => { this.restartTimer = null; if (!this.stopping) this.start(); }, wait);
    });
  }

  reply(id, data) { if (this.child && this.child.connected) { try { this.child.send({ type: 'app-reply', id, data }); } catch (e) { /* gone */ } } }

  // ask it to save and stop; if it hasn't stopped in a few seconds, end it
  stop(ms) {
    this.stopping = true;
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null; }
    const child = this.child;
    if (!child) { this.status = 'stopped'; return Promise.resolve(true); }
    return new Promise((resolve) => {
      let done = false;
      const fin = (clean) => { if (done) return; done = true; clearTimeout(t); resolve(clean); };
      child.once('exit', () => fin(true));
      const t = setTimeout(() => { this.o.log('Server didn\'t stop by itself: ending it'); try { child.kill(); } catch (e) { /* gone */ } setTimeout(() => fin(false), 500); }, ms || 8000);
      try { if (child.connected) child.send({ type: 'shutdown' }); else child.kill(); } catch (e) { try { child.kill(); } catch (x) { /* gone */ } }
    });
  }

  async restart() { await this.stop(); this.crashes = []; this.start(); }
}

module.exports = { ServerProc, probe, probeAny, readPort };
