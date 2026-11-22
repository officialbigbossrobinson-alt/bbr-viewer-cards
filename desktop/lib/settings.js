// The desktop app's own settings (start-up, updates, backups). Kept next to your data in the user folder.
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  firstRunDone: false,
  migratedFrom: null,
  autostart: true,          // start with Windows (in the tray)
  openOnStart: true,        // open the dashboard when it starts
  closeToTray: true,        // closing the window keeps it running (so the overlay keeps working)
  autoCheck: true,          // check for updates by itself
  neverWhileLive: true,     // never install while live
  channel: 'latest',        // 'latest' = tested versions, 'beta' = test versions too
  backups: 'update+stream', // 'update+stream' or 'update'
  keepBackups: 20,
  skipVersion: null,
  afterStream: null,        // version waiting to install when the stream ends
  trayHintShown: false
};

class Settings {
  constructor(home) {
    this.file = path.join(home, 'app-settings.json');
    this.data = Object.assign({}, DEFAULTS);
    try { Object.assign(this.data, JSON.parse(fs.readFileSync(this.file, 'utf8'))); } catch (e) { /* first run */ }
  }
  get(k) { return this.data[k]; }
  set(patch) {
    for (const [k, v] of Object.entries(patch || {})) {
      if (!(k in DEFAULTS)) continue;
      const d = DEFAULTS[k];
      if (typeof d === 'boolean') this.data[k] = !!v;
      else if (k === 'channel') this.data[k] = v === 'beta' ? 'beta' : 'latest';
      else if (k === 'backups') this.data[k] = v === 'update' ? 'update' : 'update+stream';
      else if (k === 'keepBackups') this.data[k] = Math.max(3, Math.min(100, Math.round(Number(v)) || 20));
      else this.data[k] = v;
    }
    this.save();
    return this.data;
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Settings, DEFAULTS };
