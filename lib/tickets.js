// Tickets, prize pot and tiered giveaways.
// Rule that keeps this legal and fair: money fills the POT, it never buys tickets or odds.
// Tickets come only from watching, turning up and playing battles.
const crypto = require('crypto');
const DAY = 86400000;
const rnd = () => crypto.randomInt(0, 1000000) / 1000000;

const TICKETS = {
  daily: 15,            // most tickets one viewer can earn per day
  cap: 250,             // balance stops growing here
  expireDays: 60,       // balance is lost after this long without attending a stream
  watchMinutes: 30,     // 1 ticket per 30 minutes watched (faster when watching on 2-3 platforms)
  multi: [1, 1.5, 2],   // ticket earn speed when present on 1 / 2 / 3 platforms at once
  attend: 2,            // per stream turned up to
  streakFrom: 3,        // +1 per stream once the streak reaches this
  anniversary: 5
};

const TIERS = [
  { id: 'community', label: 'Community Drop', max: 10, card: null, followDays: 7, cost: 1, maxExtra: 5 },
  { id: 'bronze', label: 'Bronze Drop', max: 30, card: 'bronze', followDays: 7, recent: 3, cost: 3, maxExtra: 10 },
  { id: 'silver', label: 'Silver Drop', max: 75, card: 'silver', followDays: 7, cost: 6, maxExtra: 10 },
  { id: 'gold', label: 'Gold Drop', max: 100, card: 'gold', followDays: 14, cost: 10, maxExtra: 10 },
  { id: 'legend', label: 'Legend Jackpot', max: 250, card: 'legend', followDays: 30, cost: 20, maxExtra: 10 }
];
const TIER_RANK = { bronze: 0, silver: 1, gold: 2, legend: 3 };
const AFTER = { refund: 0.5, maxCharms: 3, sameTierCooldownDays: 30, anyTierCooldownDays: 7, claimMinutes: 10 };

const POT_DEFAULTS = { share: 20, subValue: 2, per100Value: 0.75, split: [30, 30, 20, 12, 8], currency: '£', monthlyCap: 200 };

function tk(v) {
  if (!v.tk) v.tk = { bal: 0, day: '', today: 0, total: 0, wm: 0, streak: 0, lastStreamNo: 0, charms: {}, wins: [], cool: {} };
  return v.tk;
}
const dayOf = (now) => new Date(now).toISOString().slice(0, 10);

// add tickets (respects the daily and balance limits). Returns how many were added.
let multFn = () => 1;   // Double Tickets Week sets this to 2
function setMult(fn) { multFn = fn; }
let streakRulesFn = () => null;   // card settings (saverEvery, saverMax)
function setStreakRules(fn) { streakRulesFn = fn; }
// v29: how many REAL streams were missed between two stream numbers (restarts / reconnects that used up a number don't count)
let missedFn = null;
function setMissed(fn) { missedFn = fn; }
let enabledFn = () => true;   // tickets only build up while giveaways are switched on
function setEnabled(fn) { enabledFn = fn; }
function earn(v, n, now) {
  if (!enabledFn()) return 0;
  const t = tk(v);
  const d = dayOf(now);
  if (t.day !== d) { t.day = d; t.today = 0; }
  const m = multFn(now) || 1;
  const add = Math.max(0, Math.min(n * m, TICKETS.daily * m - t.today, TICKETS.cap - t.bal));
  t.bal += add; t.today += add; t.total += add;
  return add;
}
// watch credit: minutes watched while present on `platforms` platforms at once
function watched(v, minutes, platforms, now) {
  const t = tk(v);
  t.wm += minutes * (TICKETS.multi[Math.min(3, Math.max(1, platforms)) - 1]);
  let got = 0;
  while (t.wm >= TICKETS.watchMinutes) { t.wm -= TICKETS.watchMinutes; got += earn(v, 1, now); }
  return got;
}
// first time a viewer is seen in stream number `no`: attendance tickets + streak
function attended(v, no, now) {
  const t = tk(v);
  if (!no || t.lastStreamNo === no) return 0;
  // stream streak, with savers: every `saverEvery` streams in a row earns one; a missed stream uses one up
  const SR = streakRulesFn() || {};
  const missed = t.lastStreamNo ? (missedFn && no > t.lastStreamNo ? missedFn(t.lastStreamNo, no) : no - t.lastStreamNo - 1) : -1;
  const before = t.streak || 0;
  t.saverUsed = 0;
  if (missed < 0) t.streak = 1;
  else if (missed === 0) t.streak = before + 1;
  else if ((t.savers || 0) >= missed) { t.savers -= missed; t.saverUsed = missed; t.streak = before + 1; }
  else { t.brokeAt = before; t.streak = 1; t.savers = 0; }
  if (SR.saverEvery > 0 && t.streak % SR.saverEvery === 0) t.savers = Math.min(SR.saverMax == null ? 2 : SR.saverMax, (t.savers || 0) + 1);
  t.bestStreak = Math.max(t.bestStreak || 0, t.streak);
  t.lastStreamNo = no;
  t.lastAttendAt = now;
  let n = TICKETS.attend + (t.streak >= TICKETS.streakFrom ? 1 : 0);
  // follow anniversary bonus, once per year
  const yrs = v.followedAt ? Math.floor((now - v.followedAt) / (365.25 * DAY)) : 0;
  if (yrs > (t.annYears || 0)) { t.annYears = yrs; n += TICKETS.anniversary; }
  return earn(v, n, now);
}
function expire(v, now) {
  const t = tk(v);
  if (t.bal > 0 && t.lastAttendAt && now - t.lastAttendAt > TICKETS.expireDays * DAY) { t.bal = 0; t.expiredAt = now; }
}

// ---------- the pot ----------
function potState(data, cfg) {
  if (!data.pot) data.pot = { total: 0, tiers: {}, log: [] };
  for (const T of TIERS) if (typeof data.pot.tiers[T.id] !== 'number') data.pot.tiers[T.id] = 0;
  return data.pot;
}
function potSettings(cfg) { return Object.assign({}, POT_DEFAULTS, cfg.giveaway || {}); }
// value: money the support is worth to the streamer (in their currency). Adds share% to the pot.
function potAdd(data, cfg, value, why) {
  const P = potSettings(cfg), pot = potState(data, cfg);
  const add = value * P.share / 100;
  if (!(add > 0)) return 0;
  const split = P.split, sum = split.reduce((a, b) => a + b, 0) || 1;
  TIERS.forEach((T, i) => { pot.tiers[T.id] += add * (split[i] || 0) / sum; });
  pot.total += add;
  pot.log.push({ at: Date.now(), add: +add.toFixed(2), why });
  if (pot.log.length > 300) pot.log.splice(0, pot.log.length - 300);
  return add;
}

// ---------- eligibility ----------
// card: computed card; v: raw viewer; returns null if OK, else the reason
function whyNot(T, v, card, now) {
  if (!v.followedAt) return 'you need to follow the channel (on any platform) to enter';
  if (now - v.followedAt < T.followDays * DAY) return 'you need to have followed for ' + T.followDays + ' days';
  if (T.card && !(TIER_RANK[card.tier] >= TIER_RANK[T.card])) return 'this one needs a ' + T.card.toUpperCase() + ' card or better (yours is ' + String(card.tier).toUpperCase() + ')';
  if (T.recent && (v.recent || []).filter((x) => now - x < 30 * DAY).length < T.recent) return 'you need ' + T.recent + ' streams attended in the last 30 days';
  const t = tk(v);
  if (t.cool[T.id] && now < t.cool[T.id]) return 'you won this tier recently, back in ' + Math.ceil((t.cool[T.id] - now) / DAY) + ' days';
  if (t.cool.any && now < t.cool.any) return 'you won a giveaway this week, back in ' + Math.ceil((t.cool.any - now) / DAY) + ' days';
  return null;
}

// ---------- giveaways ----------
class Giveaways {
  // o: { data (store.data), cfg(), save(), viewer(key) -> raw primary, card(v), push, say }
  constructor(o) { Object.assign(this, o); if (!this.data.giveaways) this.data.giveaways = []; }
  current() { return this.data.giveaways.find((g) => ['open', 'closed', 'drawn'].includes(g.status)) || null; }
  tier(id) { return TIERS.find((t) => t.id === id); }

  create({ tier, prize, value, sponsor, winners, test, scheduled, drawDate, fromBudget }) {
    if (this.current()) throw new Error('Finish the current giveaway first.');
    const T = this.tier(tier); if (!T) throw new Error('Pick a tier.');
    value = Number(value);
    if (!(value > 0)) throw new Error('Enter the prize value.');
    if (value > T.max) throw new Error(T.label + ' prizes are worth up to ' + T.max + '. Use a higher tier.');
    const pot = potState(this.data, this.cfg()), P = potSettings(this.cfg());
    // monthly spending limit (prizes you pay for; sponsor prizes don't count)
    if (!sponsor && P.monthlyCap > 0) {
      const m = new Date().toISOString().slice(0, 7);
      const spent = this.data.giveaways.filter((x) => !x.sponsor && !x.test && x.status !== 'cancelled' && new Date(x.openedAt).toISOString().slice(0, 7) === m).reduce((a, x) => a + x.value, 0);
      if (spent + value > P.monthlyCap + 0.001) throw new Error('That would take this month\'s prizes to ' + P.currency + (spent + value) + ', over your monthly limit of ' + P.currency + P.monthlyCap + '. Lower the value, wait for next month, or tick "sponsor".');
    }
    // fromBudget: you pay it from your monthly prize budget even if the pot is short (the pot covers what it can)
    if (!sponsor && !fromBudget && value > pot.tiers[T.id] + 0.001) throw new Error('The ' + T.label + ' pot has ' + pot.tiers[T.id].toFixed(2) + '. Tick "sponsor / my own money" to run it anyway.');
    const g = { id: Date.now().toString(36), tier: T.id, label: T.label, prize: String(prize || '').slice(0, 80), value, sponsor: !!sponsor, winners: Math.max(1, Math.min(5, winners | 0 || 1)),
      status: 'open', openedAt: Date.now(), entries: {}, picked: [], tried: [], test: !!test, scheduled: scheduled || null, drawDate: drawDate || null, fromBudget: !!fromBudget };
    this.data.giveaways.push(g);
    this.save();
    this.announce(g, 'open');
    return g;
  }

  // chat: !enter [extra]
  enter(v, extra) {
    const g = this.current(), now = Date.now();
    if (!g || g.status !== 'open') return { msg: 'no giveaway is open right now' };
    const T = this.tier(g.tier), c = this.card(v);
    const why = whyNot(T, v, c, now);
    if (why) return { msg: why };
    const t = tk(v);
    const e = g.entries[v.key] || (g.entries[v.key] = { free: 1, extra: 0, tickets: 0, charms: Math.min(AFTER.maxCharms, t.charms[T.id] || 0), display: v.display, platform: v.platform });
    let want = Math.max(0, Math.min(T.maxExtra - e.extra, extra | 0));
    const afford = Math.floor(t.bal / T.cost);
    want = Math.min(want, afford);
    if (want > 0) { t.bal -= want * T.cost; e.extra += want; e.tickets += want * T.cost; }
    this.save();
    this.push({ type: 'giveaway', phase: 'count', count: Object.keys(g.entries).length, entries: this.totalEntries(g), last: v.display });
    const n = e.free + e.extra + e.charms;
    return { msg: 'you\'re in the ' + T.label + ' with ' + n + ' entr' + (n === 1 ? 'y' : 'ies') + (e.charms ? ' (incl. ' + e.charms + ' lucky charm' + (e.charms > 1 ? 's' : '') + ')' : '') +
      (extra > 0 && want < extra ? '. Extra entries cost ' + T.cost + ' ticket' + (T.cost > 1 ? 's' : '') + ' each (max ' + T.maxExtra + '), you have ' + t.bal : '') + '. Tickets left: ' + t.bal };
  }
  totalEntries(g) { return Object.values(g.entries).reduce((a, e) => a + e.free + e.extra + e.charms, 0); }

  close() { const g = this.current(); if (!g || g.status !== 'open') throw new Error('No open giveaway.'); g.status = 'closed'; g.closedAt = Date.now(); this.save(); this.announce(g, 'closed'); return g; }

  // weighted draw among entries not yet tried
  draw() {
    const g = this.current();
    if (!g) throw new Error('No giveaway running.');
    if (g.status === 'open') this.close();
    const pool = Object.entries(g.entries).filter(([k]) => !g.tried.includes(k) && !g.picked.includes(k));
    if (!pool.length) throw new Error('Nobody left to draw.');
    const total = pool.reduce((a, [, e]) => a + e.free + e.extra + e.charms, 0);
    let r = rnd() * total, key = pool[0][0];
    for (const [k, e] of pool) { r -= e.free + e.extra + e.charms; if (r <= 0) { key = k; break; } }
    g.tried.push(key);
    g.pending = { key, claimBy: Date.now() + AFTER.claimMinutes * 60000 };
    g.status = 'drawn';
    this.save();
    const v = this.viewer(key), e = g.entries[key];
    // reel: a weighted sample of names for the animation
    const reel = [];
    for (let i = 0; i < 40; i++) { let x = rnd() * total; for (const [, en] of pool) { x -= en.free + en.extra + en.charms; if (x <= 0) { reel.push(en.display); break; } } }
    this.push({ type: 'giveaway', phase: 'draw', label: g.label, prize: g.prize, value: g.value, currency: potSettings(this.cfg()).currency, reel, winner: e.display,
      card: v ? this.card(v) : null, entries: e.free + e.extra + e.charms, totalEntries: total, claimBy: g.pending.claimBy, claimMinutes: AFTER.claimMinutes });
    this.say(g.label + ': ' + e.display + ' is drawn for ' + g.prize + '! ' + e.display + ', type !claim in chat within ' + AFTER.claimMinutes + ' minutes to win it.');
    clearTimeout(this.claimTimer);
    this.claimTimer = setTimeout(() => this.noClaim(), AFTER.claimMinutes * 60000 + 2000);
    return { winner: e.display, key };
  }
  noClaim() {
    const g = this.current();
    if (!g || g.status !== 'drawn' || !g.pending || Date.now() < g.pending.claimBy) return;
    const who = g.entries[g.pending.key].display;
    g.pending = null; g.status = 'closed';
    this.save();
    this.push({ type: 'giveaway', phase: 'noclaim', winner: who });
    this.say(who + ' didn\'t claim in time. Redraw coming up!');
  }
  // chat: !claim
  claim(v) {
    const g = this.current();
    if (!g || g.status !== 'drawn' || !g.pending || g.pending.key !== v.key) return null;
    clearTimeout(this.claimTimer);
    g.picked.push(v.key);
    g.pending = null;
    const e = g.entries[v.key];
    this.push({ type: 'giveaway', phase: 'claimed', winner: e.display, prize: g.prize, card: this.card(v) });
    this.say(e.display + ' claimed ' + g.prize + '! The streamer will contact you privately for delivery.');
    if (g.picked.length >= g.winners) this.finish(g);
    else { g.status = 'closed'; this.save(); }
    return g;
  }
  // after the last winner claims: spend / refund tickets, lucky charms, cooldowns, pot, hall of fame
  finish(g) {
    const now = Date.now(), T = this.tier(g.tier);
    for (const [key, e] of Object.entries(g.entries)) {
      const v = this.viewer(key); if (!v) continue;
      const t = tk(v);
      if (g.picked.includes(key)) {
        t.charms[T.id] = 0;
        t.cool[T.id] = now + AFTER.sameTierCooldownDays * DAY;
        t.cool.any = now + AFTER.anyTierCooldownDays * DAY;
        t.wins.push({ at: now, tier: T.id, label: g.label, prize: g.prize });
      } else {
        t.bal = Math.min(TICKETS.cap, t.bal + Math.ceil(e.tickets * AFTER.refund));
        t.charms[T.id] = Math.min(AFTER.maxCharms, (t.charms[T.id] || 0) + 1);   // stacks to 3, resets on a win
      }
    }
    if (!g.sponsor) { const pot = potState(this.data, this.cfg()); pot.tiers[T.id] = Math.max(0, pot.tiers[T.id] - g.value); pot.log.push({ at: now, add: -g.value, why: g.label + ': ' + g.prize }); }
    g.status = 'done'; g.doneAt = now;
    g.winnerNames = g.picked.map((k) => g.entries[k].display);
    this.save();
    this.push({ type: 'giveaway', phase: 'done', winners: g.winnerNames, prize: g.prize, label: g.label });
  }
  cancel() {
    const g = this.current(); if (!g) throw new Error('Nothing to cancel.');
    for (const [key, e] of Object.entries(g.entries)) { const v = this.viewer(key); if (v) tk(v).bal = Math.min(TICKETS.cap, tk(v).bal + e.tickets); }   // full refund
    g.status = 'cancelled'; clearTimeout(this.claimTimer);
    this.save();
    this.push({ type: 'giveaway', phase: 'cancel' });
  }
  announce(g, phase) {
    const T = this.tier(g.tier), P = potSettings(this.cfg());
    this.push({ type: 'giveaway', phase, label: g.label, prize: g.prize, value: g.value, currency: P.currency, cost: T.cost, maxExtra: T.maxExtra, card: T.card, drawDate: g.drawDate || null, count: Object.keys(g.entries).length, entries: this.totalEntries(g) });
    if (phase === 'open') this.say(g.label + ' is OPEN: ' + g.prize + ' (worth ' + P.currency + g.value + '). Type !enter for your free entry' +
      (T.card ? ' (' + T.card.toUpperCase() + ' card or better)' : ' (followers)') + ', or !enter 5 to add extra entries for ' + T.cost + ' ticket' + (T.cost > 1 ? 's' : '') + ' each. !tickets shows yours.');
    if (phase === 'closed') this.say(g.label + ' entries are closed! ' + Object.keys(g.entries).length + ' viewers entered. Draw coming up.');
  }
  spentThisMonth() {
    const m = new Date().toISOString().slice(0, 7);
    return this.data.giveaways.filter((x) => !x.sponsor && !x.test && x.status !== 'cancelled' && new Date(x.openedAt).toISOString().slice(0, 7) === m).reduce((a, x) => a + x.value, 0);
  }
  status() {
    const g = this.current(), pot = potState(this.data, this.cfg());
    return {
      tiers: TIERS, pot, settings: potSettings(this.cfg()), spentThisMonth: this.spentThisMonth(), current: g ? Object.assign({}, g, { entrants: Object.keys(g.entries).length, totalEntries: this.totalEntries(g),
        top: Object.values(g.entries).sort((a, b) => (b.free + b.extra + b.charms) - (a.free + a.extra + a.charms)).slice(0, 15).map((e) => ({ display: e.display, n: e.free + e.extra + e.charms, tickets: e.tickets })), entries: undefined }) : null,
      history: this.data.giveaways.filter((x) => x.status === 'done' && !x.test).slice(-30).reverse().map((x) => ({ at: x.doneAt, label: x.label, prize: x.prize, value: x.value, winners: x.winnerNames, entrants: Object.keys(x.entries).length, sponsor: x.sponsor }))
    };
  }
}

module.exports = { setStreakRules, setMissed, setEnabled, setMult, TICKETS, TIERS, AFTER, POT_DEFAULTS, tk, earn, watched, attended, expire, potAdd, potState, potSettings, whyNot, Giveaways };
