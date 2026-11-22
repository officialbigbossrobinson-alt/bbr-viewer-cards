// v33 Giveaway meter: an on-screen meter that fills from subs, gifts, bits, follows or chat entries, with a
// countdown, your own words, and a look that follows the game. Start / pause / resume / stop / restart, and you
// can change the number, the goal and the clock by hand at any time.
// Settings live in cfg.gmeter, the running state in data/gmeter.json (so a restart carries on where it was).
const fs = require('fs');

const PRESETS = {
  subs: { label: 'Subs (gifted ones count too)', unit: 'SUBS', w: { sub: 1, gift: 1, bits: 0, follow: 0, entry: 0 } },
  gifts: { label: 'Gift subs only', unit: 'GIFTED SUBS', w: { sub: 0, gift: 1, bits: 0, follow: 0, entry: 0 } },
  bits: { label: 'Bits / Kicks / Super Chats (per 100)', unit: 'x100 BITS', w: { sub: 0, gift: 0, bits: 1, follow: 0, entry: 0 } },
  follows: { label: 'Follows', unit: 'FOLLOWS', w: { sub: 0, gift: 0, bits: 0, follow: 1, entry: 0 } },
  entries: { label: 'Chat entries (people typing the word)', unit: 'ENTRIES', w: { sub: 0, gift: 0, bits: 0, follow: 0, entry: 1 } },
  mixed: { label: 'Everything (points)', unit: 'POINTS', w: { sub: 5, gift: 5, bits: 1, follow: 1, entry: 0 } },
  manual: { label: 'Only when I change it', unit: '', w: { sub: 0, gift: 0, bits: 0, follow: 0, entry: 0 } },
};
const POS = ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'];
const LOOK_RE = /^(football|ets|ats|heist|arc|mgs|neon)$/;
// the words for each look until you write your own (blank boxes use these)
// countdown-only words (no target): "GIVEAWAY IN 3:59:59"
const TWORDS = {
  football: { timer: 'GIVEAWAY IN', timeUp: 'GIVEAWAY TIME!' }, ets: { timer: 'GIVEAWAY ARRIVES IN', timeUp: 'GIVEAWAY HAS ARRIVED!' }, ats: { timer: 'GIVEAWAY ROLLS IN', timeUp: 'GIVEAWAY TIME!' },
  heist: { timer: 'THE DROP IS IN', timeUp: 'THE DROP IS ON!' }, arc: { timer: 'SUPPLY DROP IN', timeUp: 'SUPPLY DROP INCOMING!' }, mgs: { timer: 'SUPPLY DROP IN', timeUp: 'SUPPLY DROP: GO!' }, neon: { timer: 'GIVEAWAY IN', timeUp: 'GIVEAWAY TIME!' },
};
const MODES = { meter: 'Meter + countdown', timer: 'Countdown only (no target)', meteronly: 'Meter only (no clock)' };
const MAXMS = 72 * 3600000;
const WORDS = {
  football: { title: 'GIVEAWAY', timer: 'DRAW IN', done: 'GOAL REACHED: DRAW TIME!', timeUp: 'FULL TIME: THE DRAW IS ON' },
  ets: { title: 'GIVEAWAY CONVOY', timer: 'ARRIVING IN', done: 'DELIVERED: DRAW TIME!', timeUp: 'END OF THE ROAD: DRAW TIME' },
  ats: { title: 'GIVEAWAY HAUL', timer: 'DRAW IN', done: 'LOAD DELIVERED: DRAW TIME!', timeUp: 'LAST STOP: DRAW TIME' },
  heist: { title: 'THE BIG SCORE', timer: 'THE DROP IN', done: 'SCORE SECURED: DRAW TIME!', timeUp: 'TIME\'S UP: DRAW TIME' },
  arc: { title: 'SUPPLY DROP', timer: 'DROP IN', done: 'DROP UNLOCKED: DRAW TIME!', timeUp: 'EXTRACTION: DRAW TIME' },
  mgs: { title: 'SUPPLY DROP', timer: 'DROP IN', done: 'MISSION COMPLETE: DRAW TIME!', timeUp: 'TIME\'S UP: DRAW TIME' },
  neon: { title: 'GIVEAWAY', timer: 'ENDS IN', done: 'GOAL HIT: DRAW TIME!', timeUp: 'TIME\'S UP: DRAW TIME' },
};
const clampInt = (x, a, b, d) => { const n = Math.round(+x); return isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
const txt = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);

class GMeter {
  // o: cfg(), saveCfg(), push(ev), file, look() (the game's look), feed(text, colour), say(text), sound(name)
  constructor(o) {
    Object.assign(this, o);
    this.st = this.blank();
    try { Object.assign(this.st, JSON.parse(fs.readFileSync(this.file, 'utf8'))); } catch (e) { /* first time */ }
    // a countdown that was running when the app closed carries on from where it was (the app may have been off for a bit)
    if (this.st.running && this.st.endsAt && this.st.endsAt <= Date.now()) { this.st.running = false; this.st.left = 0; this.st.ended = true; }
    this.saveT = null;
    setInterval(() => this.tick(), 500).unref();
  }
  blank() { return { on: false, running: false, paused: false, ended: false, endsAt: null, left: null, value: 0, goalHitAt: null, entries: [], winner: null, startedAt: null, log: [] }; }
  S() {
    const c = this.cfg().gmeter || {};
    const preset = PRESETS[c.preset] ? c.preset : 'subs';
    const w = Object.assign({}, PRESETS[preset].w, preset === 'mixed' && c.weights ? c.weights : {});
    for (const k of Object.keys(w)) w[k] = Math.max(0, Math.min(1000, +w[k] || 0));
    return {
      preset, weights: w, goal: clampInt(c.goal, 1, 1000000, 50), unit: c.unit != null ? txt(c.unit, 24) : PRESETS[preset].unit,
      title: txt(c.title, 40), prize: c.prize != null ? txt(c.prize, 60) : '', sub: c.sub != null ? txt(c.sub, 80) : 'HIT THE GOAL TO UNLOCK THE DRAW',
      enter: c.enter != null ? txt(c.enter, 60) : '', timerLabel: txt(c.timerLabel, 30), done: txt(c.done, 60), timeUp: txt(c.timeUp, 60),
      hours: clampInt(c.hours, 0, 72, 0), mins: clampInt(c.mins, 0, 600, 10), secs: clampInt(c.secs, 0, 59, 0),
      mode: MODES[c.mode] ? c.mode : 'meter', enabled: c.enabled !== false,
      keyword: (txt(c.keyword, 20) || '!enter').toLowerCase(), look: c.look && (c.look === 'auto' || LOOK_RE.test(c.look)) ? c.look : 'auto',
      pos: POS.includes(c.pos) ? c.pos : 'tc', scale: clampInt(c.scale, 50, 200, 100), x: clampInt(c.x, -800, 800, 0), y: clampInt(c.y, -500, 500, 0),
      overflow: c.overflow !== false, sound: c.sound !== false, chatSay: c.chatSay !== false, subsOnlyEntries: !!c.subsOnlyEntries,
      stopAtTimeUp: c.stopAtTimeUp !== false, hideAfter: clampInt(c.hideAfter, 0, 600, 0), showEntries: c.showEntries !== false, where: c.where === 'own' ? 'own' : 'overlay',
    };
  }
  set(n) {
    const c = Object.assign({}, this.cfg().gmeter || {});
    n = Object.assign({}, n);
    if (n.preset && PRESETS[n.preset]) {
      const old = PRESETS[c.preset] ? c.preset : 'subs';
      // a new "what fills it" brings its own word (SUBS, FOLLOWS…) unless you wrote your own
      if (n.preset !== old && (n.unit == null || String(n.unit).trim().toUpperCase() === PRESETS[old].unit)) { delete c.unit; delete n.unit; }
      c.preset = n.preset;
    }
    for (const k of ['title', 'prize', 'sub', 'enter', 'timerLabel', 'done', 'timeUp', 'unit', 'keyword']) if (typeof n[k] === 'string') c[k] = n[k];
    if (MODES[n.mode]) c.mode = n.mode;
    if (typeof n.enabled === 'boolean') c.enabled = n.enabled;
    for (const k of ['goal', 'hours', 'mins', 'secs', 'scale', 'x', 'y', 'hideAfter']) if (n[k] != null && n[k] !== '' && isFinite(+n[k])) c[k] = +n[k];
    for (const k of ['overflow', 'sound', 'chatSay', 'subsOnlyEntries', 'stopAtTimeUp', 'showEntries']) if (typeof n[k] === 'boolean') c[k] = n[k];
    if (typeof n.look === 'string' && (n.look === 'auto' || LOOK_RE.test(n.look))) c.look = n.look;
    if (POS.includes(n.pos)) c.pos = n.pos;
    if (n.where === 'own' || n.where === 'overlay') c.where = n.where;
    if (n.weights && typeof n.weights === 'object') { c.weights = {}; for (const k of ['sub', 'gift', 'bits', 'follow', 'entry']) if (n.weights[k] != null) c.weights[k] = +n.weights[k] || 0; }
    this.cfg().gmeter = c; this.saveCfg();
    // a new length while it isn't running sets the clock to the new length
    // turned off: hidden at once, and nothing can show it until it's turned back on
    if (n.enabled === false && this.st.on) { if (this.st.running) { this.st.left = Math.max(0, this.st.endsAt - Date.now()); this.st.running = false; this.st.endsAt = null; } this.st.on = false; this.note('Turned off'); this.save(); this.push(this.payload({ fx: 'hide' })); return this.S(); }
    if ((n.hours != null || n.mins != null || n.secs != null || n.mode != null) && !this.st.running && !this.st.ended && !this.st.startedAt) this.st.left = null;
    this.save(); this.push(this.payload()); return this.S();
  }
  look() { const S = this.S(); if (S.look !== 'auto') return S.look; let l = 'football'; try { l = this.gameLook() || 'football'; } catch (e) { /* default */ } return LOOK_RE.test(l) ? l : 'neon'; }
  words() {
    const S = this.S(), W = WORDS[this.look()] || WORDS.football, TW = TWORDS[this.look()] || TWORDS.football, tm = S.mode === 'timer';
    const X = this.extEntries(), xe = X && X.open ? 'TYPE ' + String(X.cmd).toUpperCase() + ' TO ENTER' : '';
    if (tm) return { title: S.title || W.title, prize: S.prize, sub: '', enter: S.enter || xe || (S.showEntries && this.st.entries.length ? 'TYPE ' + S.keyword.toUpperCase() + ' TO ENTER' : ''), timer: S.timerLabel || TW.timer, done: '', timeUp: S.timeUp || TW.timeUp, unit: '' };
    return { title: S.title || W.title, prize: S.prize, sub: S.sub, enter: S.enter || (this.S().weights.entry > 0 ? 'TYPE ' + this.S().keyword.toUpperCase() + ' TO ENTER' : xe),
      timer: S.timerLabel || W.timer, done: S.done || W.done, timeUp: S.timeUp || W.timeUp, unit: S.unit };
  }
  dur() { const S = this.S(); if (S.mode === 'meteronly') return 0; return Math.min(MAXMS, (S.hours * 3600 + S.mins * 60 + S.secs) * 1000); }
  left() { const T = this.st; if (T.running && T.endsAt) return Math.max(0, T.endsAt - Date.now()); return T.left != null ? T.left : this.dur(); }
  save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => { try { fs.writeFileSync(this.file, JSON.stringify(this.st)); } catch (e) { /* ignore */ } }, 300); }
  note(what) { this.st.log.unshift({ at: Date.now(), what: String(what).slice(0, 80) }); this.st.log = this.st.log.slice(0, 30); }
  // v35: the simple !giveaway list can feed the entries line (when this meter has no entries of its own)
  extEntries() { const T = this.st; if (T.entries.length || !this.ext) return null; try { const x = this.ext(); return x && (x.open || x.count) ? x : null; } catch (e) { return null; } }
  payload(extra) {
    const S = this.S(), T = this.st, X = this.extEntries();
    return Object.assign({ type: 'gmeter', on: T.on, running: T.running, paused: T.paused, ended: T.ended, endsAt: T.running ? T.endsAt : null, left: this.left(), dur: this.dur(), hasTimer: this.dur() > 0,
      value: T.value, goal: S.goal, pct: Math.min(S.overflow ? 999 : 100, Math.round(100 * T.value / S.goal)), hit: T.value >= S.goal, entries: X ? X.count : T.entries.length,
      recent: X ? X.recent : T.entries.slice(-3).reverse().map((x) => x.name), winner: T.winner, look: this.look(), words: this.words(), pos: S.pos, scale: S.scale, x: S.x, y: S.y,
      sound: S.sound, showEntries: S.showEntries, where: S.where, mode: S.mode, enabled: S.enabled, now: Date.now() }, extra || {});
  }
  state() { return Object.assign(this.payload(), { modes: MODES, tdefaults: TWORDS, settings: this.S(), presets: Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, v.label])), defaults: WORDS, log: this.st.log, entryList: this.st.entries.slice(-200).reverse() }); }

  // ---------- the buttons ----------
  off() { return this.S().enabled ? null : 'The giveaway meter is turned off: turn it on in Live › Giveaway meter'; }
  start() {
    if (this.off()) return this.off();
    const T = this.st;
    if (T.ended) return this.restart();
    T.on = true;
    if (this.dur() > 0) { const l = this.left(); T.endsAt = Date.now() + l; T.running = l > 0; T.left = null; }
    T.paused = false; T.startedAt = T.startedAt || Date.now(); this.hideT = null;
    this.note('Started'); this.save(); this.push(this.payload({ fx: 'show' }));
    if (this.S().chatSay && this.say) { const W = this.words(); this.say(W.title + (W.prize ? ': ' + W.prize : '') + ' · ' + (this.S().mode === 'timer' ? W.timer.toLowerCase() + ' ' + fmt(this.left()) : this.S().goal + ' ' + (W.unit || '').toLowerCase() + ' to unlock it') + (W.enter ? ' · ' + W.enter.toLowerCase() : '')); }
    return 'Giveaway meter on' + (T.running ? ' · clock running' : '');
  }
  pause() {
    const T = this.st; if (!T.on) return 'The giveaway meter isn\'t on';
    if (T.paused) return this.resume();
    if (T.running) { T.left = Math.max(0, T.endsAt - Date.now()); T.running = false; T.endsAt = null; }
    T.paused = true; this.note('Paused'); this.save(); this.push(this.payload());
    return 'Giveaway meter paused (nothing counts until you resume)';
  }
  resume() {
    const T = this.st; if (!T.on) return this.start();
    T.paused = false;
    if (!T.ended && this.dur() > 0) { const l = this.left(); if (l > 0) { T.endsAt = Date.now() + l; T.running = true; T.left = null; } }
    this.note('Resumed'); this.save(); this.push(this.payload());
    return 'Giveaway meter running again';
  }
  stop() {
    const T = this.st;
    if (T.running) { T.left = Math.max(0, T.endsAt - Date.now()); T.running = false; T.endsAt = null; }
    T.on = false; T.paused = false; this.note('Stopped'); this.save(); this.push(this.payload({ fx: 'hide' }));
    return 'Giveaway meter stopped and hidden (the number is kept: Restart sets it back to 0)';
  }
  restart() {
    if (this.off()) return this.off();
    const keepOn = true, T = this.st;
    this.st = Object.assign(this.blank(), { log: T.log, on: keepOn });
    if (this.dur() > 0) { this.st.endsAt = Date.now() + this.dur(); this.st.running = true; }
    this.st.startedAt = Date.now();
    this.note('Restarted from 0'); this.save(); this.push(this.payload({ fx: 'show' }));
    return 'Giveaway meter back to 0' + (this.dur() > 0 ? ' and the clock started again' : '');
  }
  toggle() { return this.st.on ? this.stop() : this.start(); }
  enable(on) { this.set({ enabled: !!on }); return on ? 'Giveaway meter turned on (press Start to show it)' : 'Giveaway meter turned off'; }
  show(on) { if (on && this.off()) return this.off(); this.st.on = !!on; this.save(); this.push(this.payload({ fx: on ? 'show' : 'hide' })); return on ? 'Giveaway meter shown' : 'Giveaway meter hidden'; }
  // change the meter by hand
  add(n, why) {
    const before = this.st.value, S = this.S();
    this.st.value = Math.max(0, Math.round((this.st.value + (+n || 0)) * 100) / 100);
    if (!S.overflow) this.st.value = Math.min(S.goal, this.st.value);
    this.note((n >= 0 ? '+' : '') + n + (why ? ' · ' + why : ''));
    this.afterChange(before, why);
    return 'Meter: ' + this.st.value + ' / ' + S.goal;
  }
  setValue(n) { const before = this.st.value; this.st.value = Math.max(0, Math.round((+n || 0) * 100) / 100); this.note('Set to ' + this.st.value); this.afterChange(before, null); return 'Meter set to ' + this.st.value + ' / ' + this.S().goal; }
  setGoal(n) { this.set({ goal: n }); const before = this.st.value; this.afterChange(before, null, true); return 'Goal is now ' + this.S().goal; }
  addTime(ms) {
    const T = this.st; if (this.dur() <= 0 && !T.running && T.left == null) { T.left = 0; }
    if (T.running) T.endsAt = Math.max(Date.now() + 1000, Math.min(Date.now() + MAXMS, T.endsAt + ms));
    else T.left = Math.max(0, Math.min(MAXMS, this.left() + ms));
    if (T.ended && this.left() > 0) { T.ended = false; if (T.on && !T.paused) { T.endsAt = Date.now() + this.left(); T.running = true; T.left = null; } }
    this.note((ms > 0 ? '+' : '') + Math.round(ms / 60000 * 10) / 10 + ' min'); this.save(); this.push(this.payload());
    return 'Clock: ' + fmt(this.left());
  }
  setTime(ms) {
    const T = this.st; ms = Math.max(0, Math.min(MAXMS, ms));
    T.ended = false;
    if (T.running) T.endsAt = Date.now() + ms; else T.left = ms;
    if (ms > 0 && T.on && !T.paused && !T.running) { T.endsAt = Date.now() + ms; T.running = true; T.left = null; }
    this.note('Clock set to ' + fmt(ms)); this.save(); this.push(this.payload());
    return 'Clock set to ' + fmt(ms);
  }
  // the countdown ends at a time of day ("21:00" = 9 pm today, or tomorrow if that's already gone)
  setAt(hhmm) {
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(hhmm || '').trim()); if (!m || +m[1] > 23 || +m[2] > 59) return 'Use a time like 21:00';
    const d = new Date(); d.setHours(+m[1], +m[2], 0, 0); if (d.getTime() <= Date.now() + 1000) d.setDate(d.getDate() + 1);
    this.setTime(d.getTime() - Date.now());
    return 'Clock ends at ' + m[1].padStart(2, '0') + ':' + m[2] + ' (' + fmt(this.left()) + ' from now)';
  }
  afterChange(before, why, quiet) {
    const S = this.S(), T = this.st;
    let fx = null;
    if (before < S.goal && T.value >= S.goal) { T.goalHitAt = Date.now(); fx = 'goal'; this.note('Goal reached'); if (this.feed) this.feed('Giveaway goal reached: ' + T.value + ' / ' + S.goal, '#3dff9a'); if (S.chatSay && this.say) this.say('GIVEAWAY GOAL HIT! ' + this.words().done); }
    else if (T.value < S.goal) T.goalHitAt = null;
    this.save();
    this.push(this.payload(fx ? { fx } : !quiet && T.value > before ? { fx: 'bump', why: why || null } : {}));
  }
  // ---------- what fills it (platform events) ----------
  counting() { const T = this.st, S = this.S(); return S.enabled && S.mode !== 'timer' && T.on && !T.paused && !(T.ended && S.stopAtTimeUp); }
  event(kind, n, who) {
    if (!this.counting()) return;
    const w = this.S().weights[kind] || 0; if (!w) return;
    const pts = kind === 'bits' ? Math.floor((+n || 0) / 100) * w : (+n || 1) * w;
    if (pts > 0) this.add(pts, (who ? who + ' · ' : '') + ({ sub: 'sub', gift: n + ' gifted', bits: n + ' bits', follow: 'follow', entry: 'entered' }[kind] || kind));
  }
  // someone typed the entry word: one entry each
  chat(platform, login, display, text, isSub) {
    const S = this.S(); if (!S.enabled || !this.st.on || this.st.paused) return null;
    const t = String(text || '').trim().toLowerCase(); if (!t || (t !== S.keyword && !t.startsWith(S.keyword + ' '))) return null;
    if (this.st.ended && S.stopAtTimeUp) return 'closed';
    if (S.subsOnlyEntries && !isSub) return 'subs';
    const key = platform + ':' + String(login).toLowerCase();
    if (this.st.entries.some((x) => x.key === key)) return 'already';
    this.st.entries.push({ key, name: display || login, platform, at: Date.now() });
    if (this.st.entries.length > 5000) this.st.entries.shift();
    if (S.weights.entry > 0) this.event('entry', 1, display || login); else { this.save(); this.push(this.payload()); }
    return 'in';
  }
  pick() {
    const L = this.st.entries; if (!L.length) return { error: 'Nobody has entered yet (people type ' + this.S().keyword + ' in chat)' };
    const w = L[Math.floor(Math.random() * L.length)];
    this.st.winner = { name: w.name, platform: w.platform, at: Date.now() };
    this.note('Winner: ' + w.name); this.save(); this.push(this.payload({ fx: 'winner' }));
    if (this.S().chatSay && this.say) this.say('🎉 The giveaway winner is @' + w.name + '! Congratulations!');
    return { ok: true, winner: this.st.winner };
  }
  clearEntries() { this.st.entries = []; this.st.winner = null; this.note('Entries cleared'); this.save(); this.push(this.payload()); return 'Entries cleared'; }
  tick() {
    const T = this.st;
    if (T.running && T.endsAt && Date.now() >= T.endsAt) {
      T.running = false; T.endsAt = null; T.left = 0; T.ended = true; T.endedAt = Date.now();
      this.note('Time up'); this.save(); this.push(this.payload({ fx: 'timeup' }));
      if (this.feed) this.feed('Giveaway clock finished', '#ffd23f');
      if (this.S().chatSay && this.say) this.say(this.words().timeUp);
    }
    const H = this.S().hideAfter;
    if (T.on && T.ended && H > 0 && T.endedAt && Date.now() - T.endedAt > H * 1000) { T.on = false; this.save(); this.push(this.payload({ fx: 'hide' })); }
  }
}
function fmt(ms) { const s = Math.ceil(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); }
module.exports = { GMeter, PRESETS, WORDS, TWORDS, MODES };
