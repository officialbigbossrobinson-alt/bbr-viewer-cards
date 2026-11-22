// BBR Viewer Cards desktop app (v36+). The same server as always runs in the background on localhost:3000,
// so every OBS Browser Source and dock link stays the same. This file adds the window, the tray, start with
// Windows, one copy at a time, your data in %APPDATA%\BBR Viewer Cards, backups and updates.
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const cp = require('child_process');
const E = require('electron');
const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, clipboard, Notification, nativeImage } = E;
const { Settings } = require('./lib/settings');
const { Backups } = require('./lib/backup');
const { Log } = require('./lib/log');
const { ServerProc, probeAny } = require('./lib/server-proc');
const { Updates } = require('./lib/updates');
const M = require('./lib/migrate');
const R = require('./lib/releases');

const APP_DIR = app.getAppPath();
const SERVER = path.join(APP_DIR, 'server.js');
const VERSION = (/const APP_VERSION = '([^']+)'/.exec(fs.readFileSync(SERVER, 'utf8')) || [])[1] || R.short(app.getVersion());
const NAME = 'BBR Viewer Cards';
const HOME = process.env.BBR_APP_HOME || path.join(app.getPath('appData'), NAME);
const ASSETS = path.join(__dirname, 'assets');
fs.mkdirSync(HOME, { recursive: true });
app.setPath('userData', path.join(HOME, 'electron'));   // keep Chromium's caches out of your data folder
app.setAppUserModelId('com.bigbossrobinson.bbrviewercards');

if (!app.requestSingleInstanceLock()) { app.quit(); }
else {

const log = new Log(HOME);
const settings = new Settings(HOME);
const backups = new Backups(HOME);
const server = new ServerProc({ serverPath: SERVER, home: HOME, log: (m) => log.write(m) });
const hidden = process.argv.includes('--hidden');
let cancelQuit = false, stopped = false;
let tray = null, win = null, dockWin = null, firstWin = null, quitting = false, liveNow = false, lastStatus = null, extra = { battlesOff: null, sgwOpen: null };
const url = (p) => 'http://localhost:' + server.port + (p || '/');
log.write('---- ' + NAME + ' v' + VERSION + ' starting (' + HOME + ')' + (hidden ? ' [with Windows]' : ''));

const updates = new Updates({
  updater: require('electron-updater').autoUpdater, settings, backups, server, current: VERSION,
  isLive: () => liveNow, log: (m) => log.write(m), fetch: (u, o) => fetch(u, o),
  quit: () => { if (cancelQuit) { cancelQuit = false; return; } quitting = true; app.quit(); },
  spawn: (file, args) => {
    const c = cp.spawn(file, args, { detached: true, stdio: 'ignore', windowsHide: false });
    // e.g. antivirus blocked it: say so, and keep the app running (the quit is cancelled)
    c.on('error', (e) => { log.write('Installer would not start: ' + e.message); quitting = false; stopped = false; cancelQuit = true; updates.set({ busy: null, phase: updates.s.phase === 'installing' ? 'ready' : updates.s.phase }); server.crashes = []; if (!server.child) server.start(); dialog.showMessageBox({ type: 'error', title: NAME, message: 'The installer didn\'t start', detail: e.message + '\n\nYour backup was made and nothing changed. Try again, or run the installer by hand.' }); });
    c.unref();
  },
  notify: (t, b) => notify(t, b), changed: () => buildTray()
});

// ---------- helpers ----------
function icon(name) { const f = path.join(ASSETS, name); return fs.existsSync(f) ? nativeImage.createFromPath(f) : nativeImage.createEmpty(); }
function notify(title, body) { try { if (Notification.isSupported()) new Notification({ title, body, icon: path.join(ASSETS, 'icon.png') }).show(); else if (tray && tray.displayBalloon) tray.displayBalloon({ title, content: body }); } catch (e) { /* ignore */ } }
function getJson(p, ms) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: server.port, path: p, timeout: ms || 4000 }, (res) => { let s = ''; res.on('data', (d) => { s += d; }); res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { resolve({ text: s }); } }); });
    req.on('timeout', () => { req.destroy(); resolve(null); }); req.on('error', () => resolve(null));
  });
}
// ask the server right now (the 15-second poll can be a little behind) before anything that must not happen live
async function refreshLive() { const st = await getJson('/api/app/status', 2500); if (st && st.bbr) liveNow = !!st.live; return liveNow; }
const control = (name) => getJson('/control/' + name).then((r) => { setTimeout(poll, 600); return r; });
function applyAutostart() {
  if (!app.isPackaged && !process.env.BBR_TEST_AUTOSTART) return;
  try { app.setLoginItemSettings({ openAtLogin: !!settings.get('autostart'), path: process.execPath, args: ['--hidden'] }); } catch (e) { log.write('Start with Windows: ' + e.message); }
}
const isLocal = (u) => { try { const x = new URL(u); return (x.hostname === 'localhost' || x.hostname === '127.0.0.1') && Number(x.port || 80) === server.port; } catch (e) { return false; } };
function guardLinks(w) {
  // logins (Twitch, Kick, YouTube) and other websites open in your normal browser; the app's own pages stay here
  w.webContents.setWindowOpenHandler(({ url: u }) => {
    if (isLocal(u)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: path.join(ASSETS, 'icon.png'), backgroundColor: '#0b0f14' } };
    if (/^https?:/i.test(u)) shell.openExternal(u);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e, u) => { if (!isLocal(u) && !/^data:/i.test(u) && !/^file:/i.test(u)) { e.preventDefault(); if (/^https?:/i.test(u)) shell.openExternal(u); } });
}
function page(title, body) {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html><meta charset="utf-8"><title>' + title + '</title><body style="margin:0;background:#0b0f14;color:#e8eef5;font:16px Segoe UI,system-ui,sans-serif;display:grid;place-items:center;height:100vh"><div style="text-align:center;max-width:620px;padding:24px"><div style="font:900 30px Segoe UI;letter-spacing:.06em;color:#3dff9a">BBR VIEWER CARDS</div><p style="opacity:.85;line-height:1.5">' + body + '</p></div>');
}

// ---------- windows ----------
function openMain(sub) {
  if (win && !win.isDestroyed()) {
    if (sub) win.loadURL(url(sub));
    win.show(); if (win.isMinimized()) win.restore(); win.focus(); return win;
  }
  win = new BrowserWindow({ width: 1366, height: 860, minWidth: 900, minHeight: 600, title: NAME + ' · v' + VERSION, icon: path.join(ASSETS, 'icon.png'), backgroundColor: '#0b0f14', autoHideMenuBar: true, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false } });
  guardLinks(win);
  win.on('page-title-updated', (e) => e.preventDefault());
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => {
    if (quitting || !settings.get('closeToTray')) return;
    e.preventDefault(); win.hide();
    if (!settings.get('trayHintShown')) { settings.set({ trayHintShown: true }); notify('Still running', 'BBR Viewer Cards keeps running in the tray so the overlay keeps working. Right-click the BBR icon to quit.'); }
  });
  win.on('closed', () => { win = null; if (!quitting && !settings.get('closeToTray')) { quitting = true; app.quit(); } });
  win.loadURL(server.ready ? url(sub) : page('Starting', 'Starting up…'));
  return win;
}
function openDock() {
  if (dockWin && !dockWin.isDestroyed()) { dockWin.show(); dockWin.focus(); return dockWin; }
  dockWin = new BrowserWindow({ width: 440, height: 920, title: 'BBR dock', icon: path.join(ASSETS, 'icon.png'), backgroundColor: '#0b0f14', autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  guardLinks(dockWin);
  dockWin.on('page-title-updated', (e) => e.preventDefault());
  dockWin.on('closed', () => { dockWin = null; });
  dockWin.loadURL(server.ready ? url('/dock') : page('Starting', 'Starting up…'));
  return dockWin;
}
function reloadWindows() {
  if (win && !win.isDestroyed()) { const u = win.webContents.getURL(); win.loadURL(isLocal(u) ? u : url('/')); }
  if (dockWin && !dockWin.isDestroyed()) dockWin.loadURL(url('/dock'));
}
function showUpdate() { const w = openMain(); const go = () => w.webContents.executeJavaScript('window.bbrAppOpenUpdate && window.bbrAppOpenUpdate()').catch(() => {}); if (w.webContents.isLoading()) w.webContents.once('did-finish-load', () => setTimeout(go, 800)); else go(); }

// ---------- tray ----------
function buildTray() {
  if (!tray) return;
  const u = updates.state();
  const run = server.ready ? '● running' : server.status === 'port-busy' ? '■ port busy' : server.status === 'gave-up' ? '■ stopped' : '○ starting';
  const items = [
    { label: NAME + '   ' + run + ' · v' + VERSION + (liveNow ? ' · LIVE' : ''), enabled: false },
    { type: 'separator' },
    { label: 'Open the dashboard', click: () => openMain() },
    { label: 'Open the dock in a small window', click: () => openDock() },
    { label: 'Copy the overlay link for OBS', click: () => { clipboard.writeText(url('/overlay')); notify('Copied', url('/overlay') + ' (Browser Source, 1920 × 1080)'); } },
    { type: 'separator' },
    { label: extra.sgwOpen ? 'Giveaway: close entries' : 'Giveaway: open entries', enabled: server.ready, click: () => control(extra.sgwOpen ? 'sgw-close' : 'sgw-open') },
    { label: extra.battlesOff ? 'Battles: switch on' : 'Battles: switch off', enabled: server.ready, click: () => control(extra.battlesOff ? 'battles-on' : 'battles-off') },
    { label: 'PANIC: hide everything on stream', enabled: server.ready, click: () => control('panic') },
    { type: 'separator' }
  ];
  if (u.phase === 'ready') items.push({ label: 'Update to version ' + u.version + '…', click: () => showUpdate() });
  else if (u.phase === 'downloading') items.push({ label: 'Downloading version ' + u.version + ' (' + u.percent + '%)', enabled: false });
  items.push({ label: 'Restart the app', click: () => relaunch() });
  items.push({ label: 'Quit (the overlay stops)', click: () => quitAsk() });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(NAME + ' v' + VERSION + (server.ready ? ' · running' : '') + (u.phase === 'ready' ? ' · update ready' : ''));
}
async function quitAsk() {
  if (server.ready) await refreshLive();
  if (liveNow) {
    const r = await dialog.showMessageBox({ type: 'warning', title: NAME, message: 'You\'re live. Quit anyway?', detail: 'The overlay, cards, alerts and chat bot stop until you open the app again.', buttons: ['Keep it running', 'Quit'], defaultId: 0, cancelId: 0 });
    if (r.response !== 1) return;
  }
  quitting = true; app.quit();
}
function relaunch() { quitting = true; app.relaunch({ args: process.argv.slice(1).filter((a) => a !== '--hidden') }); app.quit(); }

// ---------- the server ----------
async function startServer() {
  const port = server.port = require('./lib/server-proc').readPort(HOME);
  const there = await probeAny(port);
  if (there) return portBusy({ port, bbr: there.bbr });
  server.start();
}
async function portBusy(info) {
  buildTray();
  const old = info && info.bbr;
  if (win) win.loadURL(page('Port busy', old ? 'The old BBR Cards window is still running. Close it, then press Try again.' : 'Another program is using port ' + server.port + '.'));
  const r = await dialog.showMessageBox({ type: 'warning', title: NAME,
    message: old ? 'The old BBR Cards window is still running' : 'Port ' + server.port + ' is being used by another program',
    detail: old ? 'Close the black "BBR Cards" window (or press Ctrl+C in it), then press Try again. Your OBS links stay the same.' : 'Close that program and press Try again. Or change the port in Setup › App (your OBS links would change too).',
    buttons: ['Try again', 'Quit'], defaultId: 0, cancelId: 1 });
  if (r.response === 0) { server.status = 'starting'; return startServer(); }
  quitting = true; app.quit();
}
server.on('ready', () => { log.write('Server running on port ' + server.port); buildTray(); reloadWindows(); poll(); });
server.on('port-busy', (m) => portBusy({ port: m.port }));
server.on('crash', () => buildTray());
server.on('gave-up', async () => {
  buildTray();
  const r = await dialog.showMessageBox({ type: 'error', title: NAME, message: 'The app keeps stopping', detail: 'It stopped 5 times in 2 minutes. Save a report and attach it in the chat with Claude so it can be fixed.', buttons: ['Save a report', 'Try again', 'Quit'], defaultId: 0 });
  if (r.response === 0) { await saveReport(); server.crashes = []; server.start(); }
  else if (r.response === 1) { server.crashes = []; server.start(); }
  else { quitting = true; app.quit(); }
});
async function saveReport() {
  const r = await dialog.showSaveDialog({ title: 'Save a report for Claude', defaultPath: path.join(app.getPath('desktop'), 'bbr-report-for-claude-v' + VERSION + '.txt') });
  if (r.canceled || !r.filePath) return null;
  const txt = 'BBR Viewer Cards v' + VERSION + ' report · ' + new Date().toString() + '\nWindows ' + os.release() + '\n\n' + log.tail(600).replace(/(secret|token|password|key|code)=\S+/gi, '$1=***');
  fs.writeFileSync(r.filePath, txt); shell.showItemInFolder(r.filePath); return r.filePath;
}

// every 15 s: live or not (updates wait for the end of the stream), battles / giveaway for the tray menu
let streamBackupFor = false;
async function poll() {
  if (!server.ready) return;
  const st = await getJson('/api/app/status');
  if (!st || !st.bbr) return;
  const was = liveNow; liveNow = !!st.live; lastStatus = st;
  if (liveNow && !was && settings.get('backups') === 'update+stream' && !streamBackupFor) {
    streamBackupFor = true;
    try { const b = backups.make('stream-start', VERSION, ''); backups.prune(settings.get('keepBackups')); log.write('Stream started: backup ' + b.id); } catch (e) { log.write('Stream backup failed: ' + e.message); }
  }
  if (!liveNow) streamBackupFor = false;
  const s = await getJson('/api/status'); if (s && s.battle) extra.battlesOff = !!s.battle.battlesOff;
  const g = await getJson('/api/sgw'); if (g && typeof g.open === 'boolean') extra.sgwOpen = g.open;
  const t = updates.tick(liveNow); if (t && t.then) t.then((r) => log.write('After-stream install: ' + JSON.stringify(r)));
  buildTray();
}

// ---------- Setup › App (the dashboard page asks through the server) ----------
function appState() {
  return {
    home: HOME, version: VERSION, port: server.port, packaged: app.isPackaged, live: liveNow,
    settings: Object.assign({}, settings.data),
    update: updates.state(), backups: backups.list().slice(0, 40), logFile: log.file
  };
}
async function confirmBox(message, detail, yes) {
  const r = await dialog.showMessageBox(win && !win.isDestroyed() ? win : null, { type: 'question', title: NAME, message, detail, buttons: ['Cancel', yes || 'Yes'], defaultId: 1, cancelId: 0 });
  return r.response === 1;
}
const ACTIONS = {
  state: async () => appState(),
  set: async (a) => {
    const before = Object.assign({}, settings.data);
    settings.set(a.patch || {});
    if (before.autostart !== settings.get('autostart')) applyAutostart();
    if (before.channel !== settings.get('channel')) updates.applyChannel();
    if (!before.autoCheck && settings.get('autoCheck')) updates.check(false);
    return appState();
  },
  check: async () => { await updates.check(true); return appState(); },
  install: async (a, reply) => { await refreshLive(); return accepted(reply, () => updates.install(a)); },
  'after-stream': async () => updates.afterStream(),
  skip: async () => updates.skip(),
  previous: async () => updates.previous(),
  goback: async (a, reply) => { await refreshLive(); return accepted(reply, () => updates.goBack(a)); },
  'install-file': async (a, reply) => {
    const r = await dialog.showOpenDialog(win && !win.isDestroyed() ? win : null, { title: 'Install from a file', properties: ['openFile'], filters: [{ name: 'BBR installer', extensions: ['exe'] }] });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const info = updates.inspectFile(r.filePaths[0]); if (info.error) return info;
    await refreshLive();
    const ok = await confirmBox('Install ' + (info.version ? 'version ' + info.version : info.name) + '?', 'You have version ' + VERSION + '. A full backup is made first; your cards, settings and logins are kept.' + (info.warn ? '\n\n' + info.warn : '') + (liveNow && !settings.get('neverWhileLive') ? '\n\nYou\'re live: the overlay goes away for about 20 seconds.' : ''), 'Install');
    if (!ok) return { canceled: true };
    return accepted(reply, () => updates.installFile(info.file, { confirmLive: true }));
  },
  'backup-now': async () => { const b = backups.make('manual', VERSION, 'by hand'); backups.prune(settings.get('keepBackups')); return { ok: true, backup: b, state: appState() }; },
  restore: async (a, reply) => {
    if (await refreshLive()) return { error: 'You\'re live. Restore a backup after your stream.' };
    const b = backups.get(a.id); if (!b) return { error: 'That backup is gone.' };
    if (!a.confirmed && !(await confirmBox('Put back the backup from ' + new Date(b.at).toLocaleString() + '?', 'Your cards, settings and logins go back to how they were then. A backup of right now is made first, so this can be undone.', 'Put it back'))) return { canceled: true };
    reply({ ok: true, started: true }); await new Promise((r) => setTimeout(r, 300));   // the server answering this stops now
    await server.stop();
    try { const out = backups.restore(b.id, VERSION); log.write('Restored backup ' + b.id + ' (safety copy ' + out.safety.id + ')'); notify('Backup put back', 'From ' + new Date(b.at).toLocaleString() + '. A copy of before is in the list.'); }
    catch (e) { log.write('Restore failed: ' + e.message); dialog.showMessageBox({ type: 'error', title: NAME, message: 'The backup couldn\'t be put back', detail: e.message }); }
    server.crashes = []; server.start();
    return undefined;
  },
  'open-folder': async () => { const e = await shell.openPath(HOME); return e ? { error: e } : { ok: true }; },
  'open-dock': async () => { openDock(); return { ok: true }; },
  restart: async () => { setTimeout(relaunch, 300); return { ok: true }; },
  'set-port': async (a, reply) => {
    const p = Math.round(Number(a.port));
    if (!(p >= 1024 && p <= 65535)) return { error: 'Use a number from 1024 to 65535 (3000 is normal).' };
    if (p === server.port) return { ok: true, port: p };
    if (await probeAny(p)) return { error: 'Port ' + p + ' is already in use.' };
    reply({ ok: true, port: p, url: 'http://localhost:' + p + '/' }); await new Promise((r) => setTimeout(r, 300));
    await server.stop();
    const f = path.join(HOME, 'config.json'); let c = {}; try { c = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { /* none yet */ }
    c.port = p; fs.writeFileSync(f, JSON.stringify(c, null, 2));
    server.crashes = []; server.start();
    return undefined;
  },
  log: async () => ({ text: log.tail(400) }),
  report: async () => { const f = await saveReport(); return f ? { ok: true, file: f } : { canceled: true }; }
};
// installing stops the server that is answering the dashboard: answer "started" first, then carry on
function accepted(reply, go) {
  let sent = false;
  updates.onAccept = () => { sent = true; reply({ ok: true, started: true }); return new Promise((r) => setTimeout(r, 300)); };
  return go().then((r) => { updates.onAccept = null; if (sent) { if (r && r.error) log.write('After "started": ' + r.error); return undefined; } return r; });
}
server.on('request', async (m, reply) => {
  const f = ACTIONS[m.action];
  if (!f) return reply({ error: 'Unknown action ' + m.action });
  try { const out = await f(m.args || {}, reply); if (out !== undefined) reply(out); } catch (e) { log.write('Action ' + m.action + ' failed: ' + e.message); reply({ error: e.message }); }
});

// ---------- first run: bring the old folder over ----------
function needsFirstRun() {
  if (settings.get('firstRunDone')) return false;
  if (fs.existsSync(path.join(HOME, 'config.json')) || fs.existsSync(path.join(HOME, 'data', 'viewers.json'))) { settings.set({ firstRunDone: true }); return false; }
  return true;
}
function searchRoots() {
  const h = os.homedir(); const L = [];
  for (const k of ['downloads', 'desktop', 'documents']) { try { L.push(app.getPath(k)); } catch (e) { /* none */ } }
  for (const d of ['OneDrive', 'OneDrive/Desktop', 'OneDrive/Documents', 'Downloads', 'Desktop', 'Documents']) L.push(path.join(h, d));
  if (process.platform === 'win32') for (const d of ['C:\\', 'D:\\']) L.push(d);
  return [...new Set(L)].filter((d) => { try { return fs.statSync(d).isDirectory(); } catch (e) { return false; } });
}
// is the old "Start BBR Cards" window still running? (on its own port, or the app's)
async function oldRunning(dirs) {
  const ports = new Set([server.port]); for (const d of dirs) ports.add(require('./lib/server-proc').readPort(d));
  for (const p of ports) { const r = await probeAny(p); if (r && r.bbr) return true; }
  return false;
}
function openFirstRun() {
  firstWin = new BrowserWindow({ width: 1180, height: 820, minWidth: 900, minHeight: 640, title: NAME + ' · first run', icon: path.join(ASSETS, 'icon.png'), backgroundColor: '#0b0f14', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  firstWin.on('closed', () => { firstWin = null; if (!settings.get('firstRunDone') && !quitting) { quitting = true; app.quit(); } });
  firstWin.loadFile(path.join(__dirname, 'ui', 'firstrun.html'));
}
const FR = {
  info: async () => ({ version: VERSION, home: HOME, port: server.port, settings: { autostart: settings.get('autostart'), autoCheck: settings.get('autoCheck'), openOnStart: settings.get('openOnStart') } }),
  scan: async () => {
    const roots = searchRoots();
    // the deep scan of whole drives is shallow; your user folders are searched a few levels down
    const near = M.findOldFolders(roots.filter((r) => !/^[A-Z]:\\$/i.test(r)), 3);
    const drives = M.findOldFolders(roots.filter((r) => /^[A-Z]:\\$/i.test(r)), 2);
    const all = [...near]; for (const d of drives) if (!all.some((x) => x.dir.toLowerCase() === d.dir.toLowerCase())) all.push(d);
    return { found: all.sort((a, b) => b.newest - a.newest), oldRunning: await oldRunning(all.map((f) => f.dir)) };
  },
  choose: async () => {
    const r = await dialog.showOpenDialog(firstWin, { title: 'Where is your old BBR Viewer Cards folder?', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { canceled: true };
    const d = r.filePaths[0];
    if (!M.isAppFolder(d)) return { error: 'That folder doesn\'t have BBR Viewer Cards in it (look for the folder with server.js and config.json).' };
    return { found: M.summarize(d) };
  },
  migrate: async (a) => {
    if (await oldRunning([a.dir])) return { error: 'The old BBR Cards window is still running. Close it first (so nothing changes while it\'s copied), then press Bring it all over again.' };
    try { const r = M.copyInto(a.dir, HOME, (m) => log.write('[first run] ' + m)); settings.set({ migratedFrom: a.dir }); log.write('[first run] brought over ' + r.cards + ' cards, ' + r.files + ' files from ' + a.dir); return r; } catch (e) { return { error: e.message }; }
  },
  start: async (a) => {
    settings.set({ autostart: a.autostart !== false, autoCheck: a.autoCheck !== false, openOnStart: a.openOnStart !== false });
    applyAutostart();
    if (!server.child && !server.ready) await startServer();
    for (let i = 0; i < 40 && !server.ready; i++) await new Promise((r) => setTimeout(r, 250));
    return { ready: server.ready, port: server.port, status: server.status };
  },
  status: async () => (server.ready ? getJson('/api/status') : null),
  open: async (a) => { if (a && a.url && isLocal(a.url)) { const x = new URL(a.url); openMain(x.pathname + x.search + x.hash); }; return { ok: true }; },
  external: async (a) => { if (a && /^https:\/\//.test(a.url)) shell.openExternal(a.url); return { ok: true }; },
  done: async () => { settings.set({ firstRunDone: true }); openMain(); setTimeout(() => { if (firstWin) firstWin.close(); }, 300); return { ok: true }; }
};
ipcMain.handle('fr', async (e, action, args) => { const f = FR[action]; if (!f) return { error: 'unknown' }; try { return await f(args || {}); } catch (x) { log.write('[first run] ' + action + ': ' + x.message); return { error: x.message }; } });

// ---------- start-up ----------
app.on('second-instance', () => { if (firstWin) { firstWin.show(); firstWin.focus(); } else openMain(); });
app.on('window-all-closed', () => { /* keep running in the tray */ });
app.on('before-quit', (e) => {
  quitting = true;
  if (stopped) return;
  e.preventDefault();
  log.write('Quitting: saving and stopping the server');
  server.stop(8000).then(() => { stopped = true; app.quit(); });
});

app.whenReady().then(async () => {
  tray = new Tray(icon(process.platform === 'win32' ? 'tray.ico' : 'tray.png'));
  tray.on('click', () => openMain());
  tray.on('double-click', () => openMain());
  buildTray();
  applyAutostart();
  if (needsFirstRun()) { openFirstRun(); }
  else {
    await startServer();
    if (!hidden || settings.get('openOnStart')) openMain();
  }
  setInterval(poll, 15000);
  const autoCheck = () => { if (settings.get('autoCheck') && (app.isPackaged || process.env.BBR_TEST_UPDATES)) updates.check(false); };
  setTimeout(autoCheck, Number(process.env.BBR_FIRST_CHECK_MS) || 20000);
  setInterval(autoCheck, 4 * 3600 * 1000);
});

module.exports = { ACTIONS, FR, updates, server, settings, backups, HOME, VERSION, state: () => ({ win, dockWin, firstWin, tray, liveNow, quitting, extra }), poll, buildTray };
}
