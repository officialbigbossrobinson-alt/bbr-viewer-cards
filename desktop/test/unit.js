// Tests for the desktop app's own parts (settings, first-run copy, backups, releases, updates).
// No Electron needed: node desktop/test/unit.js   (GitHub runs this before every build)
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { Settings } = require('../lib/settings');
const M = require('../lib/migrate');
const { Backups } = require('../lib/backup');
const R = require('../lib/releases');
const { Updates, notesText } = require('../lib/updates');

let pass = 0, fail = 0;
const ok = (c, n, i) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (i != null && !c ? ' · ' + i : '')); };
const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), 'bbr-' + n + '-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const write = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

function oldFolder(root, cards) {
  const d = path.join(root, 'BBR-Viewer-Cards');
  write(path.join(d, 'server.js'), "const APP_VERSION = '35';\n");
  write(path.join(d, 'lib', 'store.js'), '//');
  write(path.join(d, 'config.json'), JSON.stringify({ twitchTokens: { access: 'secret-abc' }, kickSlug: 'bbr', accent: '#ff0000' }));
  const v = { viewers: {} };
  for (let i = 0; i < cards; i++) v.viewers['twitch:v' + i] = { key: 'twitch:v' + i, login: 'v' + i };
  v.viewers['kick:v0'] = { aliasOf: 'twitch:v0' };
  write(path.join(d, 'data', 'viewers.json'), JSON.stringify(v));
  write(path.join(d, 'data', 'clips', 'a.mp4'), 'x'.repeat(1000));
  write(path.join(d, 'data', 'media', 'song.mp3'), 'x'.repeat(500));
  write(path.join(d, 'data', 'backups', 'old.json'), '{}');
  write(path.join(d, 'sounds', 'README.txt'), 'readme');
  write(path.join(d, 'sounds', 'reward.mp3'), 'mine');
  write(path.join(d, 'textures', 'grass.jpg'), 'grass');
  return d;
}

(async () => {
  // ---------- settings ----------
  { const h = tmp('set'); const s = new Settings(h);
    ok(s.get('autostart') === true && s.get('closeToTray') === true && s.get('neverWhileLive') === true && s.get('channel') === 'latest', 'settings: safe defaults (start with Windows, tray, never while live, tested versions)');
    s.set({ channel: 'beta', keepBackups: 1, autostart: 0, nonsense: 1 });
    const s2 = new Settings(h);
    ok(s2.get('channel') === 'beta' && s2.get('keepBackups') === 3 && s2.get('autostart') === false && !('nonsense' in s2.data), 'settings: saved, checked and read back');
  }

  // ---------- first run: find + copy the old folder ----------
  const root = tmp('home'); const dl = path.join(root, 'Downloads'); const old = oldFolder(dl, 7);
  write(path.join(root, 'Documents', 'random', 'server.js'), 'not bbr');
  { const f = M.findOldFolders([root], 3);
    ok(f.length === 1 && f[0].dir === old, 'first run: finds the old folder in Downloads (and not a random server.js)', JSON.stringify(f.map((x) => x.dir)));
    ok(f[0].cards === 7 && f[0].version === '35' && f[0].settings && f[0].logins.join() === 'Twitch,Kick' && f[0].clips === 1 && f[0].media === 1 && f[0].sounds === 1 && f[0].textures === 1, 'first run: summary (7 cards, v35, logins, clips, music, own sounds)', JSON.stringify(f[0]));
    ok(M.findOldFolders([root], 0).length === 0, 'first run: respects the search depth');
    const home = tmp('appdata'); const before = fs.readFileSync(path.join(old, 'config.json'), 'utf8');
    const r = M.copyInto(old, home);
    ok(r.cards === 7 && fs.existsSync(path.join(home, 'config.json')) && fs.existsSync(path.join(home, 'data', 'clips', 'a.mp4')) && fs.existsSync(path.join(home, 'data', 'media', 'song.mp3')), 'first run: copies settings, logins, cards, clips, music');
    ok(fs.existsSync(path.join(home, 'sounds', 'reward.mp3')) && !fs.existsSync(path.join(home, 'sounds', 'README.txt')) && fs.existsSync(path.join(home, 'textures', 'grass.jpg')), 'first run: copies your own sounds / textures only');
    ok(fs.readFileSync(path.join(old, 'config.json'), 'utf8') === before && fs.existsSync(path.join(old, 'data', 'viewers.json')), 'first run: the old folder is not changed');
    let e1 = null; try { M.copyInto(path.join(root, 'Documents'), home); } catch (e) { e1 = e.message; }
    ok(/isn't a BBR/.test(e1 || ''), 'first run: refuses a folder that isn\'t BBR');
    let e2 = null; try { M.copyInto(home, home); } catch (e) { e2 = e.message; }
    ok(!!e2, 'first run: refuses copying a folder onto itself');
  }

  // ---------- backups ----------
  const home = tmp('bk'); M.copyInto(old, home); write(path.join(home, 'app-settings.json'), '{"x":1}');
  const B = new Backups(home);
  { const b = B.make('before-update', '35', 'to-36');
    const dir = path.join(home, 'app-backups', b.id);
    ok(fs.existsSync(path.join(dir, 'config.json')) && fs.existsSync(path.join(dir, 'data', 'viewers.json')) && fs.existsSync(path.join(dir, 'data', 'media', 'song.mp3')) && fs.existsSync(path.join(dir, 'sounds', 'reward.mp3')), 'backup: settings, logins, cards, music, own sounds');
    ok(!fs.existsSync(path.join(dir, 'data', 'clips')) && !fs.existsSync(path.join(dir, 'data', 'backups')), 'backup: leaves out clips and the per-stream card backups');
    ok(B.list().length === 1 && B.list()[0].version === '35' && B.beforeVersion('36').id === b.id, 'backup: listed, and found as "before version 36"');
    // change data, then put the backup back
    write(path.join(home, 'data', 'viewers.json'), '{"viewers":{}}'); write(path.join(home, 'config.json'), '{}');
    const r = B.restore(b.id, '36');
    ok(JSON.parse(fs.readFileSync(path.join(home, 'config.json'), 'utf8')).kickSlug === 'bbr' && Object.keys(JSON.parse(fs.readFileSync(path.join(home, 'data', 'viewers.json'), 'utf8')).viewers).length === 8, 'restore: cards and settings back');
    ok(fs.existsSync(path.join(home, 'data', 'clips', 'a.mp4')), 'restore: clips are kept');
    ok(r.safety && B.list().some((x) => x.id === r.safety.id && x.reason === 'before-restore'), 'restore: a backup of right now is made first');
    const safety = JSON.parse(fs.readFileSync(path.join(home, 'app-backups', r.safety.id, 'data', 'viewers.json'), 'utf8'));
    ok(Object.keys(safety.viewers).length === 0, 'restore: that safety copy really is the "before"');
    for (let i = 0; i < 6; i++) { B.make('stream-start', '36'); await sleep(5); }
    const removed = B.prune(4);
    ok(B.list().length === 4 && B.list().some((x) => x.id === b.id) && removed.length === 4, 'prune: keeps the newest 4 and always the last "before update"', B.list().map((x) => x.reason).join());
    fs.mkdirSync(path.join(home, 'app-backups', 'broken.partial'));
    ok(!B.list().some((x) => /partial/.test(x.id)), 'backup: a half-finished backup is never listed');
  }

  // ---------- releases ----------
  ok(R.cmp('35', 'v36') < 0 && R.cmp('36.1', '36') > 0 && R.cmp('v36.0.0', '36') === 0 && R.cmp('28.4', '28.10') < 0, 'versions compare (35 < 36, 36.1 > 36, 28.4 < 28.10)');
  ok(R.toSemver('36') === '36.0.0' && R.short('36.0.0') === '36' && R.short('36.1.0') === '36.1', 'version names (36 <-> 36.0.0)');
  const rel = (t, o) => Object.assign({ tag_name: t, draft: false, prerelease: false, assets: [{ name: 'BBR-Viewer-Cards-Setup-' + R.toSemver(t.slice(1)) + '.exe', browser_download_url: 'u', size: 10 }, { name: 'latest.yml', browser_download_url: 'y' }] }, o || {});
  const RL = [rel('v37.0.0'), rel('v36.0.0'), rel('v35.1.0', { prerelease: true }), rel('v35.0.0'), rel('v34.0.0', { draft: true }), rel('v33.0.0', { assets: [] })];
  ok(R.findPrevious('36', RL, false).tag_name === 'v35.0.0', 'go back: picks the version before (skips newer, test versions)');
  ok(R.findPrevious('36', RL, true).tag_name === 'v35.1.0', 'go back: with test versions on, a test version counts');
  ok(R.findPrevious('35', RL, false) === null, 'go back: nothing older with an installer = none (drafts and empty releases ignored)');
  const yml = 'version: 35.0.0\nfiles:\n  - url: BBR-Viewer-Cards-Setup-35.0.0.exe\n    sha512: AAA==\n    size: 10\npath: BBR-Viewer-Cards-Setup-35.0.0.exe\nsha512: AAA==\nreleaseDate: x\n';
  ok(R.shaFromYml(yml, 'BBR-Viewer-Cards-Setup-35.0.0.exe') === 'AAA==' && R.shaFromYml('files:\n  - url: other.exe\n    sha512: B==\n', 'x.exe') === 'B==', 'go back: reads the checksum from latest.yml');
  ok(/Fixed: thing\n· one\n· two/.test(notesText('<p>Fixed: thing</p><ul><li>one</li><li>two</li></ul>')), 'what\'s new: release notes as plain lines');

  // a fake release page: releases list, latest.yml, the installer
  const exe = crypto.randomBytes(1.5 * 1024 * 1024); const exeSha = crypto.createHash('sha512').update(exe).digest('base64');
  const srv = http.createServer((q, s) => {
    if (q.url === '/rel') { s.end(JSON.stringify([rel('v36.0.0'), Object.assign(rel('v35.0.0'), { published_at: '2026-11-01', assets: [{ name: 'BBR-Viewer-Cards-Setup-35.0.0.exe', browser_download_url: base + '/exe', size: exe.length }, { name: 'latest.yml', browser_download_url: base + '/yml' }] })])); return; }
    if (q.url === '/yml') { s.end('version: 35.0.0\nfiles:\n  - url: BBR-Viewer-Cards-Setup-35.0.0.exe\n    sha512: ' + exeSha + '\npath: BBR-Viewer-Cards-Setup-35.0.0.exe\nsha512: ' + exeSha + '\n'); return; }
    if (q.url === '/badyml') { s.end('sha512: nope\n'); return; }
    if (q.url === '/exe') { s.writeHead(200, { 'Content-Length': exe.length }); s.end(exe); return; }
    s.writeHead(404); s.end();
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); const base = 'http://127.0.0.1:' + srv.address().port;
  const fakeFetch = (u, o) => fetch(/api\.github\.com/.test(u) ? base + '/rel' : u, o);
  { const d = tmp('dl'); let prog = 0;
    const r = await R.download(fetch, base + '/exe', path.join(d, 'a.exe'), { sha512: exeSha, onProgress: (n) => { prog = n; } });
    ok(r.bytes === exe.length && fs.readFileSync(path.join(d, 'a.exe')).equals(exe) && prog === 100, 'download: whole file, progress to 100%');
    let e = null; try { await R.download(fetch, base + '/exe', path.join(d, 'b.exe'), { sha512: 'wrong' }); } catch (x) { e = x.message; }
    ok(/checksum/.test(e || '') && !fs.existsSync(path.join(d, 'b.exe')) && !fs.existsSync(path.join(d, 'b.exe.part')), 'download: a wrong checksum is refused and deleted');
  }

  // ---------- updates ----------
  function rig(o) {
    const h = tmp('upd'); M.copyInto(old, h);
    const up = new EventEmitter(); const calls = { quitAndInstall: 0, download: 0, spawn: [], quit: 0, stop: 0, start: 0, notify: [] };
    up.checkForUpdates = async () => { up.emit('checking-for-update'); if (o && o.none) up.emit('update-not-available', {}); else up.emit('update-available', { version: '37.0.0', releaseNotes: '<p>New thing</p>' }); };
    up.downloadUpdate = async () => { calls.download++; up.emit('download-progress', { percent: 50 }); await sleep(10); up.emit('update-downloaded', { version: '37.0.0' }); };
    up.quitAndInstall = (a, b) => { calls.quitAndInstall++; calls.qa = [a, b]; };
    const st = new Settings(h); const bk = new Backups(h);
    const server = { stop: async () => { calls.stop++; }, start: () => { calls.start++; } };
    let live = false;
    const U = new Updates({ updater: up, settings: st, backups: bk, server, current: '36', isLive: () => live, log: () => {}, quit: () => calls.quit++, spawn: (f, a) => calls.spawn.push([f, a]), fetch: fakeFetch, notify: (t) => calls.notify.push(t) });
    return { h, up, calls, st, bk, U, setLive: (v) => { live = v; } };
  }
  { const T = rig({ none: true }); await T.U.check(true);
    ok(T.U.state().phase === 'none' && T.U.state().lastChecked, 'update: nothing new = "You have the newest version"'); }
  { const T = rig(); await T.U.check(false); await sleep(40);
    const s = T.U.state();
    ok(s.phase === 'ready' && s.version === '37' && /New thing/.test(s.notes) && T.calls.download === 1, 'update: found, downloaded by itself, notes kept', JSON.stringify(s));
    ok(T.calls.notify.some((n) => /37 is ready/.test(n)), 'update: tells you it\'s ready');
    ok(T.up.autoInstallOnAppQuit === false && T.up.autoDownload === false, 'update: never installs by itself on quit');
    const r = await T.U.install({});
    ok(r.ok && T.calls.stop === 1 && T.calls.quitAndInstall === 1 && T.calls.qa.join() === 'true,true', 'update now (not live): saves, backs up, installs silently and reopens');
    ok(T.bk.list()[0].reason === 'before-update' && T.bk.list()[0].label === 'to-37' && T.bk.list()[0].version === '36', 'update now: the backup is made first (before version 37, from 36)');
  }
  { const T = rig(); await T.U.check(false); await sleep(40); T.setLive(true);
    const r = await T.U.install({});
    ok(r.waiting && T.calls.quitAndInstall === 0 && T.calls.stop === 0, 'update while live: waits (never while live)', JSON.stringify(r));
    ok(T.st.get('afterStream') === '37' && T.U.state().afterStream, 'update while live: set to install after the stream');
    ok(T.U.tick(true) === null && T.calls.quitAndInstall === 0, 'still live: not yet');
    T.setLive(false); ok(T.U.tick(false) === null && T.calls.quitAndInstall === 0, 'stream just ended: not yet');
    const t = T.U.tick(false); await t;
    ok(T.calls.quitAndInstall === 1 && T.st.get('afterStream') === null, 'stream ended (a minute later): installs by itself');
  }
  { const T = rig(); await T.U.check(false); await sleep(40); T.st.set({ neverWhileLive: false }); T.setLive(true);
    const r = await T.U.install({});
    ok(r.needConfirm && T.calls.quitAndInstall === 0, 'live with "never while live" off: asks first');
    const r2 = await T.U.install({ confirmLive: true });
    ok(r2.ok && T.calls.quitAndInstall === 1, '... and installs when you say now');
  }
  { const T = rig(); await T.U.check(false); await sleep(40);
    const r = T.U.afterStream(); ok(r.ok && /next stream/.test(r.msg), 'after my stream (not live): installs after the next stream');
    T.U.skip(); ok(T.st.get('skipVersion') === '37' && T.st.get('afterStream') === null, 'skip this version: remembered');
    const T2 = { U: new Updates(Object.assign({}, T.U.o, { updater: Object.assign(new EventEmitter(), { checkForUpdates: async function () { this.emit('update-available', { version: '37.0.0' }); }, downloadUpdate: async () => { T.calls.download += 100; } }) })) };
    await T2.U.check(false); ok(T2.U.state().phase === 'skipped' && T.calls.download < 100, 'skipped version: not downloaded again by itself');
    await T2.U.check(true); ok(T.calls.download >= 100, '... but Check now still gets it');
  }
  { const T = rig(); await T.U.check(false); await sleep(40);
    T.bk.make = () => { throw new Error('Backup failed: disk full'); };
    const r = await T.U.install({});
    ok(r.error && /Nothing was installed/.test(r.error) && T.calls.quitAndInstall === 0 && T.calls.start === 1, 'backup fails: nothing installed, the app starts again', JSON.stringify(r));
  }
  { const T = rig(); const p = await T.U.previous();
    ok(p && p.version === '35' && p.url === base + '/exe', 'go back: finds version 35 on the release page', JSON.stringify(p));
    const r = await T.U.goBack({});
    ok(r.ok && T.calls.spawn.length === 1 && /BBR-Viewer-Cards-Setup-35\.0\.0\.exe$/.test(T.calls.spawn[0][0]) && T.calls.spawn[0][1].join(' ') === '/S --force-run', 'go back: downloads 35, checks it, runs it quietly', JSON.stringify(r));
    ok(fs.readFileSync(T.calls.spawn[0][0]).equals(exe), 'go back: the installer it runs is the checked one');
    ok(T.bk.list()[0].reason === 'before-goback', 'go back: a backup is made first');
    await sleep(500); ok(T.calls.quit === 1, 'go back: the app closes so the installer can run');
  }
  { const T = rig(); write(path.join(T.h, 'config.json'), '{"changed":true}');
    const pre = T.bk.make('before-update', '35', 'to-36'); write(path.join(T.h, 'config.json'), '{"after":true}');
    const p = await T.U.previous(); ok(p.dataBackup && p.dataBackup.id === pre.id, 'go back: offers the data backup from before 36');
    const r = await T.U.goBack({ restoreData: true });
    ok(r.ok && JSON.parse(fs.readFileSync(path.join(T.h, 'config.json'), 'utf8')).changed === true, 'go back + put data back: settings as they were before 36');
  }
  { const T = rig(); T.setLive(true); const r = await T.U.goBack({}); ok(r.error && /live/.test(r.error) && !T.calls.spawn.length, 'go back while live: refused'); }
  { const T = rig(); T.U.o.fetch = (u, o) => fetch(/api\.github\.com/.test(u) ? base + '/rel' : u.endsWith('/yml') ? base + '/badyml' : u, o);
    const r = await T.U.goBack({}); ok(r.error && /checksum/.test(r.error) && !T.calls.spawn.length && T.calls.stop === 0, 'go back: a download that doesn\'t match is never run', JSON.stringify(r)); }
  { const T = rig(); const d = tmp('file');
    ok(/isn't there/.test(T.U.inspectFile(path.join(d, 'nope.exe')).error), 'install from a file: missing file');
    write(path.join(d, 'x.zip'), 'x'); ok(/installer/.test(T.U.inspectFile(path.join(d, 'x.zip')).error), 'install from a file: not an .exe');
    write(path.join(d, 'tiny.exe'), 'x'); ok(/too small/.test(T.U.inspectFile(path.join(d, 'tiny.exe')).error), 'install from a file: too small to be ours');
    const f = path.join(d, 'BBR-Viewer-Cards-Setup-36.1.0.exe'); fs.writeFileSync(f, exe);
    const i = T.U.inspectFile(f); ok(i.ok && i.version === '36.1' && !i.warn, 'install from a file: reads the version from the name');
    const g = path.join(d, 'setup.exe'); fs.writeFileSync(g, exe); ok(T.U.inspectFile(g).warn, 'install from a file: warns about a strange name');
    T.setLive(true); const r0 = await T.U.installFile(f, {}); ok(r0.error && !T.calls.spawn.length, 'install from a file while live: refused');
    T.setLive(false); const r = await T.U.installFile(f, {});
    ok(r.ok && T.calls.spawn[0][0] === f && T.bk.list()[0].label === 'to-36.1', 'install from a file: backup, then runs it');
  }
  srv.close();
  console.log('passed', pass, 'failed', fail);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
