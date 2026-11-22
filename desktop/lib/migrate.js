// First run: find the old BBR Viewer Cards folder (the one started with "Start BBR Cards.bat") and copy its
// settings, logins and data into the user folder. The old folder is only read, never changed.
const fs = require('fs');
const path = require('path');

const USER_FILES = ['config.json'];
const USER_DIRS = ['data'];
const OWN_DIRS = ['sounds', 'textures'];   // only the files you added (not the README that comes with the app)

function isAppFolder(dir) {
  try {
    if (!fs.existsSync(path.join(dir, 'server.js'))) return false;
    if (!fs.existsSync(path.join(dir, 'lib', 'store.js'))) return false;
    return fs.existsSync(path.join(dir, 'config.json')) || fs.existsSync(path.join(dir, 'data', 'viewers.json'));
  } catch (e) { return false; }
}

function countFiles(dir) {
  let n = 0, bytes = 0;
  const walk = (d) => { let L = []; try { L = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; } for (const e of L) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (e.isFile()) { n++; try { bytes += fs.statSync(f).size; } catch (x) { /* skip */ } } } };
  walk(dir);
  return { n, bytes };
}

function summarize(dir) {
  const s = { dir, name: path.basename(dir), version: null, cards: 0, settings: false, logins: [], clips: 0, media: 0, sounds: 0, textures: 0, bytes: 0, newest: 0 };
  try { const m = /const APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(dir, 'server.js'), 'utf8')); if (m) s.version = m[1]; } catch (e) { /* unknown */ }
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')); s.settings = true;
    if (cfg.twitchTokens) s.logins.push('Twitch');
    if (cfg.kickTokens || cfg.kickSlug) s.logins.push('Kick');
    if (cfg.ytTokens) s.logins.push('YouTube');
    s.newest = Math.max(s.newest, fs.statSync(path.join(dir, 'config.json')).mtimeMs);
  } catch (e) { /* none */ }
  try {
    const v = JSON.parse(fs.readFileSync(path.join(dir, 'data', 'viewers.json'), 'utf8'));
    const list = v && v.viewers ? v.viewers : v;
    s.cards = Array.isArray(list) ? list.length : (list && typeof list === 'object' ? Object.values(list).filter((x) => x && !x.aliasOf && !x.bot).length : 0);
    s.newest = Math.max(s.newest, fs.statSync(path.join(dir, 'data', 'viewers.json')).mtimeMs);
  } catch (e) { /* none */ }
  s.clips = countFiles(path.join(dir, 'data', 'clips')).n;
  s.media = countFiles(path.join(dir, 'data', 'media')).n;
  s.sounds = ownFiles(path.join(dir, 'sounds')).length;
  s.textures = ownFiles(path.join(dir, 'textures')).length;
  s.bytes = countFiles(path.join(dir, 'data')).bytes;
  return s;
}

function ownFiles(dir) {
  try { return fs.readdirSync(dir).filter((f) => !/^readme/i.test(f) && fs.statSync(path.join(dir, f)).isFile()); } catch (e) { return []; }
}

// look in the usual places (Downloads, Desktop, Documents, OneDrive) a few folders deep
function findOldFolders(roots, depth) {
  const found = [], seen = new Set();
  const skip = /^(node_modules|\.git|appdata|windows|program files.*|\$recycle\.bin|data|public|lib|clips|media|backups)$/i;
  const walk = (d, left) => {
    let real; try { real = fs.realpathSync(d); } catch (e) { return; }
    if (seen.has(real.toLowerCase())) return; seen.add(real.toLowerCase());
    if (isAppFolder(d)) { found.push(d); return; }
    if (left <= 0) return;
    let L = []; try { L = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of L) if (e.isDirectory() && !skip.test(e.name) && !e.name.startsWith('.')) walk(path.join(d, e.name), left - 1);
  };
  for (const r of roots) if (r) walk(r, depth == null ? 3 : depth);
  // newest data first
  return found.map(summarize).sort((a, b) => b.newest - a.newest);
}

function copyInto(src, home, onStep) {
  if (!isAppFolder(src)) throw new Error('That folder isn\'t a BBR Viewer Cards folder (no server.js with settings or cards in it).');
  if (path.resolve(src).toLowerCase() === path.resolve(home).toLowerCase()) throw new Error('That is already the app\'s own folder.');
  fs.mkdirSync(home, { recursive: true });
  const before = summarize(src);
  let files = 0;
  const step = (m) => { if (onStep) onStep(m); };
  for (const f of USER_FILES) {
    const a = path.join(src, f);
    if (fs.existsSync(a)) { fs.copyFileSync(a, path.join(home, f)); files++; step('Copied ' + f); }
  }
  for (const d of USER_DIRS) {
    const a = path.join(src, d);
    if (fs.existsSync(a)) { fs.cpSync(a, path.join(home, d), { recursive: true, force: true, preserveTimestamps: true }); files += countFiles(a).n; step('Copied ' + d); }
  }
  for (const d of OWN_DIRS) {
    for (const f of ownFiles(path.join(src, d))) { fs.mkdirSync(path.join(home, d), { recursive: true }); fs.copyFileSync(path.join(src, d, f), path.join(home, d, f)); files++; }
  }
  // check the copy: the cards and settings must read back the same
  const after = summarize(home);
  const check = { cards: after.cards === before.cards, settings: after.settings === before.settings };
  if (!check.cards || !check.settings) throw new Error('The copy doesn\'t match the old folder (cards ' + after.cards + ' of ' + before.cards + '). Nothing was changed in the old folder; try again.');
  return { files, cards: after.cards, from: src, version: before.version };
}

module.exports = { isAppFolder, summarize, findOldFolders, copyInto, ownFiles, countFiles };
