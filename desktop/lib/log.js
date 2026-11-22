// The app's own log (<user folder>\logs\app.log): what the server printed, updates, backups. Kept small.
const fs = require('fs');
const path = require('path');

class Log {
  constructor(home, max) { this.dir = path.join(home, 'logs'); this.file = path.join(this.dir, 'app.log'); this.max = max || 2 * 1024 * 1024; this.n = 0; try { fs.mkdirSync(this.dir, { recursive: true }); } catch (e) { /* ignore */ } }
  write(msg) {
    const l = new Date().toISOString().replace('T', ' ').slice(0, 19) + '  ' + String(msg).replace(/\r?\n/g, ' ') + '\n';
    try {
      if (++this.n % 50 === 0 && fs.existsSync(this.file) && fs.statSync(this.file).size > this.max) fs.renameSync(this.file, path.join(this.dir, 'app.old.log'));
      fs.appendFileSync(this.file, l);
    } catch (e) { /* never let logging break the app */ }
    if (process.env.BBR_LOG_STDOUT) process.stdout.write(l);
  }
  tail(lines) {
    try { const s = fs.readFileSync(this.file, 'utf8').split('\n'); return s.slice(-(lines || 300)).join('\n'); } catch (e) { return ''; }
  }
}

module.exports = { Log };
