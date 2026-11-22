// BOSS BLOOD PRESSURE: a fun meter for how wound-up the Boss is getting.
// 0 = chilled, 100 = MELTDOWN. Goes up from buttons (dock / Stream Deck / dashboard) and, if switched on,
// by itself on a red card, a GODFATHER penalty, a loss, losing Beat the Boss... Chat can calm him down (!calm)
// or (with Bits) wind him up. It cools down slowly on its own.
const LEVELS = [[0, 'CHILLED', '#3dff9a'], [20, 'SIMMERING', '#a8e05f'], [40, 'HEATED', '#f5c400'], [60, 'FUMING', '#ff8a2a'], [80, 'BOILING', '#ff3b3b'], [95, 'MELTDOWN', '#ff1744']];
const AUTO = { red: 15, yellow2: 10, godfather: 10, loss: 20, draw: 6, win: -15, bossLost: 12, bossWon: -8, concede: 6 };

class BP {
  constructor(o) {
    Object.assign(this, o);   // cfg(), saveCfg(), store, push(), say(), streamNo(), onMeltdown()
    this.v = 0; this.peak = 0; this.lastUp = 0; this.calmBy = new Map(); this.calmMin = []; this.lastMelt = 0;
    const d = this.D(); if (d.no === this.streamNo()) { this.v = d.v || 0; this.peak = d.peak || 0; }
    setInterval(() => this.cool(), 5000).unref();
  }
  D() { const d = this.store.data; if (!d.bp) d.bp = { v: 0, peak: 0, no: 0, meltdowns: 0, log: [] }; return d.bp; }
  S() {
    const c = this.cfg().bp || {};
    const auto = Object.assign({}, AUTO, c.auto || {});
    const x = (k, d) => (typeof c[k] === 'boolean' ? c[k] : d);
    return { camTint: x('camTint', true), camTintAt: Math.max(40, Math.min(100, c.camTintAt != null ? +c.camTintAt : 80)), bets: x('bets', true), credits: x('credits', true), calmAward: x('calmAward', true),
      rageRedeem: x('rageRedeem', true), rageAmount: Math.max(1, Math.min(50, c.rageAmount != null ? +c.rageAmount : 10)),
      on: c.on !== false, coolSecs: Math.max(5, Math.min(300, +c.coolSecs || 30)), chatCalm: c.chatCalm !== false, bitsRage: c.bitsRage !== false, autoOn: c.autoOn !== false, auto, meltFx: c.meltFx !== false, ticker: c.ticker !== false, start: Math.max(0, Math.min(60, c.start != null ? +c.start : 10)) };
  }
  set(n) {
    const c = Object.assign({}, this.cfg().bp || {});
    for (const k of ['on', 'chatCalm', 'bitsRage', 'autoOn', 'meltFx', 'ticker', 'camTint', 'bets', 'credits', 'calmAward', 'rageRedeem']) if (typeof n[k] === 'boolean') c[k] = n[k];
    for (const k of ['coolSecs', 'start', 'camTintAt', 'rageAmount']) if (n[k] != null && n[k] !== '') c[k] = +n[k];
    if (n.auto && typeof n.auto === 'object') { c.auto = Object.assign({}, c.auto || {}); for (const k of Object.keys(AUTO)) if (n.auto[k] != null && n.auto[k] !== '') c.auto[k] = Math.max(-50, Math.min(50, Math.round(+n.auto[k]) || 0)); }
    this.cfg().bp = c; this.saveCfg(); this.sync();
  }
  level(v) { let L = LEVELS[0]; for (const l of LEVELS) if (v >= l[0]) L = l; return { name: L[1], color: L[2], i: LEVELS.indexOf(L) }; }
  // like a real reading: 110/70 when calm, 220/120 at meltdown
  reading(v) { return { sys: Math.round(112 + v * 1.08), dia: Math.round(72 + v * 0.48), bpm: Math.round(62 + v * 1.1) }; }
  state() {
    const S = this.S(), L = this.level(this.v), R = this.reading(this.v);
    return { type: 'bp', on: S.on, v: Math.round(this.v), level: L.name, color: L.color, li: L.i, sys: R.sys, dia: R.dia, bpm: R.bpm, peak: Math.round(this.peak), peakR: this.reading(this.peak), melt: this.v >= 95, meltFx: S.meltFx };
  }
  sync(extra) { const s = this.state(); this.push(Object.assign(s, extra || {})); if (this.onChange) { try { this.onChange(s); } catch (e) { /* ignore */ } } }
  newStream() { const d = this.D(), no = this.streamNo(); if (no && d.no !== no) { d.no = no; this.v = this.S().start; this.peak = this.v; d.log = []; d.meltTonight = 0; d.bets = { no, yes: [], nay: [], settled: false }; this.save(); } }
  save() { const d = this.D(); d.v = this.v; d.peak = this.peak; this.store.save(); }
  add(n, why, by) {
    const S = this.S(); if (!S.on) return this.state();
    this.newStream();
    const before = this.v, lb = this.level(before);
    this.v = Math.max(0, Math.min(100, this.v + n));
    if (n > 0) this.lastUp = Date.now();
    this.peak = Math.max(this.peak, this.v);
    const d = this.D(); d.log.push([Date.now(), Math.round(n), String(why || '').slice(0, 40)]); if (d.log.length > 100) d.log.shift();
    const L = this.level(this.v), up = L.i > lb.i;
    let melt = false;
    // reaching MELTDOWN always counts (bets settle); the sirens and headline only once every 2 minutes
    if (this.v >= 95 && before < 95) {
      d.meltdowns = (d.meltdowns || 0) + 1; d.meltTonight = (d.meltTonight || 0) + 1;
      if (Date.now() - this.lastMelt > 120000) { melt = true; this.lastMelt = Date.now(); if (this.onMeltdown) try { this.onMeltdown(); } catch (e) { /* ignore */ } }
      if (this.onCross) try { this.onCross(); } catch (e) { /* ignore */ }
    }
    this.save();
    this.sync({ change: Math.round(this.v - before), why: why || null, by: by || null, levelUp: up ? L.name : null, meltdown: melt });
    return this.state();
  }
  setTo(v, why) { return this.add(Math.max(0, Math.min(100, +v || 0)) - this.v, why || 'Set'); }
  // cools down by itself: 1 point every coolSecs, but not straight after something wound him up
  cool() {
    const S = this.S(); if (!S.on || this.v <= 0) return;
    if (Date.now() - this.lastUp < 20000) return;
    this.tickAcc = (this.tickAcc || 0) + 5;
    if (this.tickAcc >= S.coolSecs) { this.tickAcc = 0; this.v = Math.max(0, this.v - 1); this.save(); this.sync(); }
  }
  auto(kind, label) { const S = this.S(); if (!S.on || !S.autoOn) return; const n = S.auto[kind]; if (n) this.add(n, label || kind); }
  // chat: !calm (once every 5 minutes each, at most -10 a minute from chat)
  calm(key, display) {
    const S = this.S(); if (!S.on || !S.chatCalm) return false;
    const now = Date.now();
    if (now - (this.calmBy.get(key) || 0) < 300000) return false;
    this.calmMin = this.calmMin.filter((t) => now - t < 60000); if (this.calmMin.length >= 10) return false;
    this.calmBy.set(key, now); this.calmMin.push(now);
    this.add(-1, 'Calmed by ' + display, display);
    return true;
  }
  bits(n, text, display) { const S = this.S(); if (!S.on || !S.bitsRage || !/\b(rage|wind|tilt|angry|bp|pressure)\b/i.test(text || '')) return false; this.add(Math.min(20, Math.max(1, Math.floor(n / 100))), display + ' wound him up', display); return true; }
  // ---------- chat bets: will the Boss hit MELTDOWN tonight? ----------
  bets() { const d = this.D(), no = this.streamNo(); if (!d.bets || d.bets.no !== no) d.bets = { no, yes: [], nay: [], settled: false }; return d.bets; }
  bet(key, display, yes) {
    const S = this.S(); if (!S.on || !S.bets || !this.streamNo()) return { error: 'off' };
    this.newStream();
    const B = this.bets(); if (B.settled) return { error: 'settled' };
    if ((this.D().meltTonight || 0) > 0) return { error: 'already' };
    B.yes = B.yes.filter((x) => x.key !== key); B.nay = B.nay.filter((x) => x.key !== key);
    (yes ? B.yes : B.nay).push({ key, display });
    this.store.save();
    return { ok: true, yes: B.yes.length, nay: B.nay.length };
  }
  // meltdown = YES wins straight away; end of stream without one = NO wins
  settle(meltdown) {
    const S = this.S(), B = this.bets(); if (!S.bets || B.settled || (!B.yes.length && !B.nay.length)) return null;
    B.settled = true; const win = meltdown ? B.yes : B.nay;
    this.store.save();
    return { meltdown: !!meltdown, winners: win.slice(), yes: B.yes.length, nay: B.nay.length };
  }
  // the end of a stream: peak reading kept for the season, calmest stream award
  endStream(no) {
    const d = this.D(), S = this.S(); if (!no) return null;
    d.hist = d.hist || {}; d.hist[no] = { peak: Math.round(this.peak), melts: d.meltTonight || 0, at: Date.now() };
    const keys = Object.keys(d.hist).map(Number).sort((a, b) => b - a).slice(0, 40); for (const k of Object.keys(d.hist)) if (!keys.includes(+k)) delete d.hist[k];
    const others = keys.filter((k) => k !== no).map((k) => d.hist[k].peak);
    const calm = S.calmAward && this.peak < 60 && !(d.meltTonight > 0);
    const calmest = S.calmAward && others.length >= 2 && this.peak < Math.min(...others);
    d.hist[no].calm = calm; d.hist[no].calmest = calmest;
    this.save();
    return { peak: Math.round(this.peak), peakR: this.reading(this.peak), level: this.level(this.peak).name, melts: d.meltTonight || 0, calm, calmest };
  }
  night(no) { const d = this.D(); return (d.hist || {})[no] || (no === d.no ? { peak: Math.round(this.peak), melts: d.meltTonight || 0 } : null); }
  chatLine() { const s = this.state(); return 'The Boss\'s blood pressure: ' + s.sys + '/' + s.dia + ' (' + s.level + ', ' + s.bpm + ' bpm). Peak tonight: ' + s.peakR.sys + '/' + s.peakR.dia + '. Type !calm to help.'; }
}
module.exports = { BP, LEVELS, AUTO };
