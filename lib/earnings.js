// Estimated earnings: every sub, gift, bit, Kick and Super Chat is logged with its platform, then valued
// with YOUR rates (Stream stats page). Shows this stream / week / month / year: so far + on pace for.
// Dashboard only: never on stream, in chat or in Discord.
const DAY = 86400000;
const DEF = {
  currency: '£', fx: 0.79, perWeek: 4,
  // what YOU receive for each, in US dollars (check your own deals and change them)
  twT1: 2.50, twT2: 5.00, twT3: 12.50, twPrime: 2.50, bit: 0.01,
  kickSub: 4.75, kick: 0.01,
  ytMember: 3.49, ytShare: 70,
  monthGoal: 0
};

class Earnings {
  constructor(o) { this.store = o.store; this.cfg = o.cfg; this.saveCfg = o.saveCfg; this.streamNo = o.streamNo; this.isLive = o.isLive; this.liveSince = o.liveSince; }
  S() { const c = this.cfg().earn || {}; const s = Object.assign({}, DEF, c); s.set = !!c.saved; return s; }
  set(n) {
    const c = Object.assign({}, this.cfg().earn || {});
    for (const k of Object.keys(DEF)) if (n[k] != null) c[k] = k === 'currency' ? String(n[k]).slice(0, 4) : Math.max(0, +n[k] || 0);
    c.saved = true; this.cfg().earn = c; this.saveCfg();
  }
  log() { const d = this.store.data; if (!d.earnLog) { d.earnLog = []; this.backfill(); } if (!(d.meta && d.meta.earnFix29)) this.fixGiftDoubles(); return d.earnLog; }
  // v29: before this version every gifted sub was counted twice (once in the gift, once as a 'sub' for whoever got it).
  // Take those extra 'sub' lines out once: up to N subs on the same platform within 20 s before / 90 s after a gift of N.
  fixGiftDoubles() {
    const d = this.store.data, L = d.earnLog || []; d.meta = d.meta || {};
    const drop = new Set();
    for (let i = 0; i < L.length; i++) {
      const g = L[i]; if (g[2] !== 'gift') continue;
      let left = g[3];
      for (let j = 0; j < L.length && left > 0; j++) { const s = L[j]; if (drop.has(j) || s[2] !== 'sub' || s[1] !== g[1] || s[0] < g[0] - 20000 || s[0] > g[0] + 90000) continue; drop.add(j); left--; }
    }
    if (drop.size) d.earnLog = L.filter((_, i) => !drop.has(i));
    d.meta.earnFix29 = { at: Date.now(), removed: drop.size };
    this.fixed = drop.size;
  }
  // stream records, with restarts / reconnects (gaps under an hour) joined back into one stream
  streams() {
    const all = Object.values(this.store.data.streams || {}).filter((s) => s && s.start).sort((a, b) => a.start - b.start), out = [];
    for (const s of all) {
      const p = out[out.length - 1];
      if (p && s.start - (p.end || p.start) < 3600000) { p.end = Math.max(p.end || 0, s.end || s.start); p.nos.push(s.no); for (const [g, n] of Object.entries(s.games || {})) p.games[g] = (p.games[g] || 0) + n; }
      else out.push({ no: s.no, nos: [s.no], start: s.start, end: s.end || s.start, games: Object.assign({}, s.games || {}) });
    }
    return out;
  }
  // [at, platform, kind, n, tier]   kind: sub | gift | bits | kicks | sc
  add(platform, kind, n, tier) {
    if (!(n > 0)) return;
    const L = this.log(); L.push([Date.now(), platform, kind, n, tier || 1]);
    const cut = Date.now() - 800 * DAY; while (L.length && L[0][0] < cut) L.shift();
  }
  // first run: rebuild from the support log the app already keeps (subs counted as Tier 1)
  backfill() {
    const d = this.store.data, L = d.earnLog;
    for (const [at, key, kind, n] of d.supportLog || []) {
      const v = d.viewers[key] || {}, pf = kind === 'kicks' ? 'kick' : kind === 'superchat' ? 'youtube' : kind === 'bits' ? 'twitch' : (v.subPlatform || v.platform || 'twitch');
      const k = kind === 'superchat' ? 'sc' : kind;
      if (/^(sub|gift|bits|kicks|sc)$/.test(k)) L.push([at, pf, k, n, kind === 'sub' && v.subPrime ? 'prime' : (v.subTier || 1)]);
    }
    L.sort((a, b) => a[0] - b[0]);
  }
  value(e, S) {
    const [, pf, kind, n, tier] = e, usd = (x) => x * S.fx;
    if (kind === 'sub' || kind === 'gift') {
      if (pf === 'kick') return usd(n * S.kickSub);
      if (pf === 'youtube') return usd(n * S.ytMember);
      const per = tier === 'prime' ? S.twPrime : tier === 3 ? S.twT3 : tier === 2 ? S.twT2 : S.twT1;
      return usd(n * per);
    }
    if (kind === 'bits') return usd(n * S.bit);
    if (kind === 'kicks') return usd(n * S.kick);
    if (kind === 'sc') return usd(n / 100 * S.ytShare / 100);   // Super Chats are logged as $1 = 100
    return 0;
  }
  srcOf(e) { const [, pf, kind, , tier] = e; if (kind === 'gift') return 'gifts'; if (kind === 'sub') return pf === 'kick' ? 'kickSubs' : pf === 'youtube' ? 'ytMembers' : tier === 'prime' ? 'prime' : 'twSubs'; return kind; }
  sum(from, to, S) {
    const out = { total: 0, by: {}, n: {} };
    for (const e of this.log()) { if (e[0] < from || e[0] >= to) continue; const v = this.value(e, S), k = this.srcOf(e); out.total += v; out.by[k] = (out.by[k] || 0) + v; out.n[k] = (out.n[k] || 0) + e[3]; }
    return out;
  }
  report() {
    const S = this.S(), now = Date.now(), d = new Date(now);
    const streams = this.streams();
    const live = this.isLive(), curNo = this.streamNo();
    let cur = live ? streams.find((s) => s.nos.includes(curNo)) : streams[streams.length - 1];
    if (live && !cur) {
      // v35: the live stream has no record yet (nothing happened in it, or the app restarted): carry on from the
      // last stream if that ended under an hour before (a restart / reconnect), so "this stream" doesn't reset to 0
      const ls = (this.liveSince && this.liveSince()) || now, last = streams[streams.length - 1];
      cur = last && ls - (last.end || last.start) < 3600000 ? Object.assign({}, last, { nos: last.nos.concat(curNo), end: now }) : { no: curNo, nos: [curNo], start: ls, end: now, games: {} };
    }
    const sOf = (s) => this.sum(s.start - 60000, (s.end || now) + 10 * 60000, S).total;
    const recent = streams.filter((s) => s.start > now - 45 * DAY && !(live && s.nos.includes(curNo)));
    const avg = recent.length ? recent.reduce((a, s) => a + sOf(s), 0) / recent.length : 0;
    const avgLen = recent.length ? recent.reduce((a, s) => a + Math.max(30, ((s.end || s.start) - s.start) / 60000), 0) / recent.length : 180;
    const dow = (d.getDay() + 6) % 7, wk = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow).getTime();
    const mo = new Date(d.getFullYear(), d.getMonth(), 1).getTime(), moEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const yr = new Date(d.getFullYear(), 0, 1).getTime(), yrEnd = new Date(d.getFullYear() + 1, 0, 1).getTime();
    const doneIn = (from) => streams.filter((s) => s.start >= from).length;
    // streams still to come in a period: your streams-per-week spread over the time left (the week also stops at your usual number)
    const leftStreams = (from, to) => { let n = S.perWeek * Math.max(0, to - now) / (7 * DAY); if (to - from <= 7 * DAY + 1) n = Math.min(n, Math.max(0, S.perWeek - doneIn(from))); return n; };
    const tile = (k, from, to, label, sub) => { const s = this.sum(from, to, S); const left = leftStreams(from, to); return { k, label, so: s.total, pace: s.total + avg * left, sub, by: s.by, n: s.n }; };
    const tiles = [];
    if (cur) {
      const s = this.sum(cur.start - 60000, live ? now + 1 : (cur.end || now) + 10 * 60000, S), mins = Math.max(1, ((live ? now : cur.end) - cur.start) / 60000);
      tiles.push({ k: 'stream', label: live ? 'THIS STREAM' : 'LAST STREAM', so: s.total, pace: live ? s.total + avg * Math.max(0, 1 - mins / avgLen) : s.total, sub: (live ? 'so far · ' : '') + Math.floor(mins / 60) + 'h ' + Math.round(mins % 60) + 'm' + (live ? '' : ' long'), by: s.by, n: s.n, live });
    }
    tiles.push(tile('week', wk, wk + 7 * DAY, 'THIS WEEK', doneIn(wk) + (doneIn(wk) <= S.perWeek ? ' of ' + S.perWeek : '') + ' streams'));
    tiles.push(tile('month', mo, moEnd, 'THIS MONTH', doneIn(mo) + ' streams so far'));
    tiles.push(tile('year', yr, yrEnd, 'THIS YEAR', 'since 1 January'));
    const months = [];
    for (let m = 0; m < 12; m++) { const a = new Date(d.getFullYear(), m, 1).getTime(), b = new Date(d.getFullYear(), m + 1, 1).getTime(); months.push({ m, v: a > now ? null : this.sum(a, b, S).total }); }
    const best = streams.map((s) => ({ no: s.no, start: s.start, v: sOf(s), game: Object.entries(s.games || {}).filter((x) => x[0] !== 'Unknown').sort((a, b) => b[1] - a[1]).map((x) => x[0])[0] || '' })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5);
    return { settings: S, tiles, months, best, fix29: (this.store.data.meta || {}).earnFix29 || null, avgPerStream: avg, goal: S.monthGoal || 0, monthSoFar: tiles.find((t) => t.k === 'month').so };
  }
}
// v35: what one stream (as Stream stats lists it) made, using the same rates, so the two pages agree
Earnings.prototype.forStream = function (rec) {
  if (!rec || !rec.start) return null;
  const S = this.S(), live = this.isLive() && rec.no === this.streamNo();
  const s = this.sum(rec.start - 60000, live ? Date.now() + 1 : (rec.end || rec.start) + 10 * 60000, S);
  return { total: s.total, by: s.by, n: s.n, currency: S.currency, set: !!S.set };
};
// the money log, newest first (to check it, delete a wrong line, or add one the app missed)
Earnings.prototype.entries = function (days) {
  const S = this.S(), cut = Date.now() - Math.max(1, Math.min(400, +days || 14)) * 86400000, L = this.log(), out = [];
  for (let i = L.length - 1; i >= 0 && out.length < 400; i--) { const e = L[i]; if (e[0] < cut) break; out.push({ id: e[0] + '-' + i, at: e[0], platform: e[1], kind: e[2], n: e[3], tier: e[4], value: this.value(e, S), manual: !!e[5] }); }
  return { list: out, currency: S.currency };
};
Earnings.prototype.remove = function (id) {
  const m = /^(\d+)-(\d+)$/.exec(String(id || '')); if (!m) return { error: 'Bad id' };
  const L = this.log(), i = +m[2];
  if (!L[i] || L[i][0] !== +m[1]) return { error: 'That line has changed: reload' };
  L.splice(i, 1); this.store.save(); return { ok: true };
};
Earnings.prototype.addManual = function (o) {
  const pf = ['twitch', 'kick', 'youtube'].includes(o.platform) ? o.platform : 'twitch', kind = ['sub', 'gift', 'bits', 'kicks', 'sc'].includes(o.kind) ? o.kind : null, n = Math.max(0, Math.round(+o.n || 0));
  if (!kind || !n) return { error: 'Pick what it was and how many' };
  const tier = o.tier === 'prime' ? 'prime' : [1, 2, 3].includes(+o.tier) ? +o.tier : 1;
  const at = o.at && isFinite(+o.at) ? Math.min(Date.now(), +o.at) : Date.now();
  const L = this.log(); L.push([at, pf, kind, n, tier, 1]); L.sort((a, b) => a[0] - b[0]); this.store.save();
  return { ok: true };
};
module.exports = { Earnings };
