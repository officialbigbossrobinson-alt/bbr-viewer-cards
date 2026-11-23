// v39 Giveaway spin: names scroll on stream (30 s by default) and land on a random winner, then the winner has
// 60 s to type !claim in chat FROM THE SAME ACCOUNT that entered (platform + login must match). Claimed = applause
// and they're the winner. Not claimed = out of the list, and you can spin again as many times as you need.
// Your own music plays during the spin and your own applause on a claim (both from Photos & music).
// The names come from the !giveaway list (people waiting for a bot check and people who already won are left out),
// or from the giveaway meter's own entries when that list is empty.
// Settings: cfg.spin. The running spin: data/spin.json (a restart carries on: a spin that ended while the app was
// off goes straight to the claim, a claim that ran out counts as not claimed).
const fs = require('fs');

const PLAT = ['twitch', 'kick', 'youtube'];
const txt = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);
const clamp = (x, a, b, d) => { const n = Math.round(+x); return isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
const DEF_MSG = {
  won: '🎉 @{user} the wheel picked YOU! Type {cmd} in the next {secs} seconds to claim your prize!',
  claimed: '✅ @{user} claimed it! Congratulations!',
  missed: '⌛ @{user} didn\'t claim in time, so they\'re out. Spinning again soon!',
};
const TEST_NAMES = ['MilanoMagic', 'Bosshausen_FC', 'DiamondDog22', 'PassTheBall', 'RossoneroRob', 'KitManKev', 'TikiTakaTom', 'Gaffer_Gaz', 'VARchecker', 'TopBinsTina',
  'NutmegNate', 'ExtraTimeEd', 'SweeperSam', 'Panenka_Pete', 'Curva_Sud', 'OffsideOllie', 'GoldenBootGus', 'Trequartista', 'CleanSheetCal', 'InjuryTimeIzzy'];

class Spin {
  // o: cfg(), saveCfg(), push(ev), file, media (Media), say(platform, msg), feed(text, colour),
  //    candidates() -> { from, list: [{ key, display, platform, login }] }, onClaim(rec), onMissed(rec)
  constructor(o) {
    Object.assign(this, o);
    this.st = this.blank();
    try { Object.assign(this.st, JSON.parse(fs.readFileSync(this.file, 'utf8'))); } catch (e) { /* first time */ }
    this.saveT = null;
    this.timer = setInterval(() => this.tick(), 250); if (this.timer.unref) this.timer.unref();
  }
  blank() { return { phase: 'idle', id: 0, names: [], winner: null, from: null, test: false, startedAt: null, spinEndsAt: null, claimEndsAt: null, endedAt: null, history: [] }; }
  S() {
    const c = this.cfg().spin || {}, m = c.msg || {};
    const msg = {}; for (const k of Object.keys(DEF_MSG)) msg[k] = m[k] != null && String(m[k]).trim() ? txt(m[k], 300) : DEF_MSG[k];
    return {
      spinSecs: clamp(c.spinSecs, 5, 120, 30), claimSecs: clamp(c.claimSecs, 10, 600, 60),
      cmd: (txt(c.cmd, 24) || '!claim').toLowerCase().replace(/^([^!])/, '!$1'),
      music: typeof c.music === 'string' && /^[a-f0-9]{12}$/.test(c.music) ? c.music : null, musicVol: clamp(c.musicVol, 0, 100, 70),
      applause: typeof c.applause === 'string' && /^[a-f0-9]{12}$/.test(c.applause) ? c.applause : null, applauseVol: clamp(c.applauseVol, 0, 100, 90),
      where: c.where === 'own' ? 'own' : 'overlay', chatSay: c.chatSay !== false, title: txt(c.title, 40), prize: txt(c.prize, 60),
      sounds: c.sounds !== false, hideAfter: clamp(c.hideAfter, 0, 600, 20), msg,
    };
  }
  set(n) {
    n = n || {};
    const c = Object.assign({}, this.cfg().spin || {});
    for (const k of ['spinSecs', 'claimSecs', 'musicVol', 'applauseVol', 'hideAfter']) if (n[k] != null && n[k] !== '' && isFinite(+n[k])) c[k] = +n[k];
    for (const k of ['cmd', 'title', 'prize']) if (typeof n[k] === 'string') c[k] = n[k];
    for (const k of ['music', 'applause']) if (n[k] !== undefined) c[k] = n[k] && /^[a-f0-9]{12}$/.test(String(n[k])) ? String(n[k]) : null;
    for (const k of ['chatSay', 'sounds']) if (typeof n[k] === 'boolean') c[k] = n[k];
    if (n.where === 'own' || n.where === 'overlay') c.where = n.where;
    if (n.msg && typeof n.msg === 'object') { c.msg = Object.assign({}, c.msg || {}); for (const k of Object.keys(DEF_MSG)) if (typeof n.msg[k] === 'string') c.msg[k] = n.msg[k]; }
    this.cfg().spin = c; this.saveCfg(); this.push(this.payload()); return this.S();
  }
  sound(id) { if (!id || !this.media) return null; const m = this.media.get(id); return m && m.kind === 'music' ? { id, name: m.name, url: m.url } : null; }
  save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.saveNow(), 200); }
  saveNow() { clearTimeout(this.saveT); try { fs.writeFileSync(this.file, JSON.stringify(this.st)); } catch (e) { /* ignore */ } }
  fill(t, v) { return String(t).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? String(v[k]) : m)); }
  busy() { return this.st.phase === 'spin' || this.st.phase === 'claim'; }
  payload(extra) {
    const T = this.st, S = this.S();
    return Object.assign({ type: 'spin', phase: T.phase, id: T.id, names: T.phase === 'spin' ? T.names : [], winner: T.winner ? { display: T.winner.display, platform: T.winner.platform } : null,
      test: T.test, startedAt: T.startedAt, spinEndsAt: T.spinEndsAt, claimEndsAt: T.claimEndsAt, endedAt: T.endedAt, spinMs: S.spinSecs * 1000, claimMs: S.claimSecs * 1000,
      cmd: S.cmd, title: S.title, prize: S.prize, where: S.where, sounds: S.sounds, music: this.sound(S.music), musicVol: S.musicVol, applause: this.sound(S.applause), applauseVol: S.applauseVol,
      now: Date.now() }, extra || {});
  }
  state() {
    let c = { from: null, list: [] }; try { c = this.candidates(); } catch (e) { /* ignore */ }
    return Object.assign(this.payload(), { settings: this.S(), defaults: DEF_MSG, ready: c.list.length, from: this.busy() ? this.st.from : c.from, history: this.st.history.slice(0, 15),
      winnerKey: this.st.winner ? this.st.winner.key : null });
  }

  // ---------- your buttons ----------
  start(o) {
    o = o || {};
    if (this.busy()) return { error: this.st.phase === 'spin' ? 'It\'s already spinning' : 'Waiting for ' + this.st.winner.display + ' to claim: Skip first to spin again' };
    let c;
    if (o.test) c = { from: 'test', list: TEST_NAMES.map((n) => ({ key: 'test:' + n.toLowerCase(), display: n, platform: 'twitch', login: n.toLowerCase() })) };
    else { try { c = this.candidates(); } catch (e) { c = { from: null, list: [] }; } }
    const L = (c.list || []).filter((x) => x && x.key && x.display);
    if (!L.length) return { error: c.why || 'Nobody to spin for: the giveaway list is empty' };
    const w = L[Math.floor(Math.random() * L.length)];
    // the reel: up to 60 other names in a random order, and the winner (the screen works out where to stop)
    const others = L.filter((x) => x.key !== w.key).sort(() => Math.random() - 0.5).slice(0, 60);
    const S = this.S(), now = Date.now();
    this.st.id = (this.st.id || 0) + 1;
    Object.assign(this.st, { phase: 'spin', names: [w.display].concat(others.map((x) => x.display)), winner: { key: w.key, display: w.display, platform: w.platform, login: w.login }, from: c.from,
      test: !!o.test, startedAt: now, spinEndsAt: now + S.spinSecs * 1000, claimEndsAt: null, endedAt: null, count: L.length });
    this.saveNow(); this.push(this.payload({ fx: 'spin' }));
    if (this.feed) this.feed((o.test ? 'Test spin' : 'Giveaway spin') + ': ' + L.length + ' names', '#ffd23f');
    return { ok: true, msg: (o.test ? 'Test spin (made-up names, nobody is told in chat)' : 'Spinning: ' + L.length + ' name' + (L.length === 1 ? '' : 's')) };
  }
  // the reel has stopped: the winner's claim clock starts
  land() {
    const T = this.st, S = this.S(), now = Date.now();
    T.phase = 'claim'; T.claimEndsAt = now + S.claimSecs * 1000; T.names = [];
    this.saveNow(); this.push(this.payload({ fx: 'land' }));
    if (!T.test && S.chatSay && this.say) this.say(T.winner.platform, this.fill(S.msg.won, { user: T.winner.display, cmd: S.cmd, secs: S.claimSecs }));
    if (this.feed) this.feed('Spin landed on ' + T.winner.display + (T.test ? ' (test)' : ': waiting for ' + S.cmd), '#ffd23f');
  }
  end(how, by) {
    const T = this.st, S = this.S(); if (!T.winner) return;
    const rec = { key: T.winner.key, display: T.winner.display, platform: T.winner.platform, login: T.winner.login, at: Date.now(), result: how, by: by || null, test: T.test, from: T.from };
    T.phase = how === 'claimed' ? 'claimed' : 'missed'; T.endedAt = Date.now(); T.claimEndsAt = null; T.names = [];
    T.history.unshift(rec); T.history = T.history.slice(0, 30);
    this.saveNow(); this.push(this.payload({ fx: T.phase }));
    if (T.test) return rec;
    if (how === 'claimed') {
      if (S.chatSay && this.say) this.say(rec.platform, this.fill(S.msg.claimed, { user: rec.display }));
      if (this.feed) this.feed('Giveaway: ' + rec.display + ' claimed the prize' + (by ? ' (' + by + ')' : ''), '#3dff9a');
      if (this.onClaim) try { this.onClaim(rec); } catch (e) { /* ignore */ }
    } else {
      if (S.chatSay && this.say && how !== 'banned') this.say(rec.platform, this.fill(S.msg.missed, { user: rec.display }));
      if (this.feed) this.feed('Giveaway: ' + rec.display + (how === 'banned' ? ' was banned' : ' didn\'t claim') + ': out of the list', '#ff6b7d');
      if (this.onMissed) try { this.onMissed(rec); } catch (e) { /* ignore */ }
    }
    return rec;
  }
  claim(by) { if (this.st.phase !== 'claim') return { error: 'Nobody is waiting to claim' }; const r = this.end('claimed', by || 'you'); return { ok: true, msg: r.display + ' marked as claimed' }; }
  skip() {
    if (this.st.phase === 'spin') { this.st.phase = 'idle'; this.st.names = []; this.st.winner = null; this.saveNow(); this.push(this.payload({ fx: 'hide' })); return { ok: true, msg: 'Spin stopped (nobody was picked)' }; }
    if (this.st.phase !== 'claim') return { error: 'Nobody is waiting to claim' };
    const r = this.end('missed', 'you'); return { ok: true, msg: r.display + ' is out (not claimed)' };
  }
  hide() { if (this.busy()) return this.skip(); this.st.phase = 'idle'; this.st.winner = null; this.saveNow(); this.push(this.payload({ fx: 'hide' })); return { ok: true, msg: 'Spin hidden' }; }
  // banned / timed out while they were on the wheel or waiting to claim: out at once
  ban(platform, login) {
    const T = this.st; if (!this.busy() || T.test || !T.winner) return false;
    if (T.winner.key !== platform + ':' + String(login || '').toLowerCase()) return false;
    this.end('banned'); return true;
  }
  tick() {
    const T = this.st, now = Date.now();
    if (T.phase === 'spin' && T.spinEndsAt && now >= T.spinEndsAt) this.land();
    else if (T.phase === 'claim' && T.claimEndsAt && now >= T.claimEndsAt) this.end('missed');
    else if ((T.phase === 'claimed' || T.phase === 'missed') && T.endedAt) { const H = this.S().hideAfter; if (H > 0 && now - T.endedAt > H * 1000) { T.phase = 'idle'; this.saveNow(); this.push(this.payload({ fx: 'hide' })); } }
  }

  // ---------- chat ----------
  // true when it was the claim command (nothing else answers it). Only the winner's own account counts.
  chat(platform, e) {
    const S = this.S(), t = String((e && e.text) || '').trim().toLowerCase(), word = t.split(/\s+/)[0];
    if (word !== S.cmd) return false;
    const T = this.st; if (T.phase !== 'claim' || T.test || !T.winner) return true;
    if (platform + ':' + String(e.login || '').toLowerCase() !== T.winner.key) return true;   // someone else (or the same name on another platform)
    this.end('claimed');
    return true;
  }
}
module.exports = { Spin, DEF_MSG, TEST_NAMES, PLAT };
