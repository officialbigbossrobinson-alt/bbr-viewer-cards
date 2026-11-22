// Full backups of your settings, logins and data, made before every update (and at the start of a stream if
// you want). Kept in <user folder>\app-backups. Clips aren't copied (they're on Twitch, and they're big),
// and neither are the small per-stream card backups the app already keeps in data\backups.
const fs = require('fs');
const path = require('path');

const SKIP_IN_DATA = new Set(['clips', 'backups']);

function stamp(d) { const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
function dirSize(d) { let n = 0, b = 0; const w = (x) => { let L = []; try { L = fs.readdirSync(x, { withFileTypes: true }); } catch (e) { return; } for (const e of L) { const f = path.join(x, e.name); if (e.isDirectory()) w(f); else { n++; try { b += fs.statSync(f).size; } catch (z) { /* skip */ } } } }; w(d); return { files: n, bytes: b }; }

class Backups {
  constructor(home) { this.home = home; this.dir = path.join(home, 'app-backups'); }

  make(reason, version, label) {
    const at = new Date();
    let id = stamp(at) + '-' + String(reason || 'manual').replace(/[^a-z0-9-]/gi, '');
    let n = 1; while (fs.existsSync(path.join(this.dir, id))) id = stamp(at) + '-' + reason + '-' + (++n);
    const to = path.join(this.dir, id);
    const tmp = to + '.partial';
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    try {
      for (const f of ['config.json', 'app-settings.json']) { const a = path.join(this.home, f); if (fs.existsSync(a)) fs.copyFileSync(a, path.join(tmp, f)); }
      const data = path.join(this.home, 'data');
      if (fs.existsSync(data)) {
        fs.mkdirSync(path.join(tmp, 'data'));
        for (const e of fs.readdirSync(data, { withFileTypes: true })) {
          if (SKIP_IN_DATA.has(e.name)) continue;
          fs.cpSync(path.join(data, e.name), path.join(tmp, 'data', e.name), { recursive: true, preserveTimestamps: true });
        }
      }
      for (const d of ['sounds', 'textures']) { const a = path.join(this.home, d); if (fs.existsSync(a)) fs.cpSync(a, path.join(tmp, d), { recursive: true }); }
      const size = dirSize(tmp);
      const meta = { id, at: at.toISOString(), reason: reason || 'manual', label: label || '', version: version || null, files: size.files, bytes: size.bytes };
      fs.writeFileSync(path.join(tmp, 'backup.json'), JSON.stringify(meta, null, 2));
      // a backup only counts once it's complete: the folder is renamed at the very end
      fs.renameSync(tmp, to);
      return meta;
    } catch (e) {
      fs.rmSync(tmp, { recursive: true, force: true });
      throw new Error('Backup failed: ' + e.message);
    }
  }

  list() {
    let L = [];
    try { L = fs.readdirSync(this.dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.endsWith('.partial')); } catch (e) { return []; }
    const out = [];
    for (const e of L) { try { out.push(JSON.parse(fs.readFileSync(path.join(this.dir, e.name, 'backup.json'), 'utf8'))); } catch (x) { /* not a finished backup */ } }
    return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }

  get(id) { return this.list().find((b) => b.id === id) || null; }

  // the backup made just before this version was installed (used by "Go back a version")
  beforeVersion(version) { return this.list().find((b) => b.reason === 'before-update' && b.label === 'to-' + version) || null; }

  // put a backup back. The app must have stopped the server first. A backup of right now is made first.
  restore(id, version) {
    const b = this.get(id);
    if (!b) throw new Error('That backup is gone.');
    const from = path.join(this.dir, b.id);
    const safety = this.make('before-restore', version, 'restoring ' + b.id);
    if (fs.existsSync(path.join(from, 'config.json'))) fs.copyFileSync(path.join(from, 'config.json'), path.join(this.home, 'config.json'));
    const data = path.join(this.home, 'data');
    if (fs.existsSync(path.join(from, 'data'))) {
      fs.mkdirSync(data, { recursive: true });
      for (const e of fs.readdirSync(data)) if (!SKIP_IN_DATA.has(e)) fs.rmSync(path.join(data, e), { recursive: true, force: true });
      for (const e of fs.readdirSync(path.join(from, 'data'))) fs.cpSync(path.join(from, 'data', e), path.join(data, e), { recursive: true, preserveTimestamps: true });
    }
    for (const d of ['sounds', 'textures']) {
      if (!fs.existsSync(path.join(from, d))) continue;
      fs.rmSync(path.join(this.home, d), { recursive: true, force: true });
      fs.cpSync(path.join(from, d), path.join(this.home, d), { recursive: true });
    }
    return { restored: b, safety };
  }

  // keep the newest N (and always the newest "before update" one)
  prune(keep) {
    const L = this.list(); const removed = [];
    const lastUpd = L.find((b) => b.reason === 'before-update');
    const keepSet = new Set(L.slice(0, keep).map((b) => b.id));
    if (lastUpd && !keepSet.has(lastUpd.id)) { keepSet.delete(L[keep - 1].id); keepSet.add(lastUpd.id); }
    for (const b of L) if (!keepSet.has(b.id)) { fs.rmSync(path.join(this.dir, b.id), { recursive: true, force: true }); removed.push(b.id); }
    return removed;
  }
}

module.exports = { Backups, stamp };
