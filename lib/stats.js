// How viewer activity turns into card stats — with fair progression:
//  * diminishing returns: early points come fast, 90+ takes real dedication
//  * daily caps: big one-off spends are "banked" and paid out over the next days
//  * tier gates: Gold and Legend need time in the community, not just money
//  * form & decay: stats slowly fade when a viewer stops showing up,
//    and SUB fades once a sub lapses
// Every number can be overridden in config.json under "rules".

const DAY = 864e5;

const DEFAULT_RULES = {
  start: 40,
  max: 99,
  // XP needed to get ~63% of the way from 40 to 99 (a stat of ~77)
  curve: { WAT: 2400, SUB: 5, SUP: 4000, CHT: 1000, LOY: 18, RAI: 4 },
  // most XP each stat can gain per day; anything above is banked for later days
  dailyCap: { WAT: 480, SUB: 5, SUP: 2500, CHT: 250, LOY: 1, RAI: 2 },
  giftXp: 0,                // (old) SUB XP per sub gifted to others. Gifts now fill SUPPORT instead (cards.giftSup)
  anniversaryXp: 4,         // LOY XP per follow anniversary
  raidMinViewers: 5,
  graceDays: 7,             // no decay for a week after a viewer was last seen
  decayPerDay: 0.02,        // then each stat loses 2% of its progress per day away
  subDecayPerDay: 0.03,     // SUB loses 3% per day once a sub has lapsed
  subLapseDays: 35,         // a sub counts as lapsed this long after we last saw it active
  gates: {
    gold: { days: 14, streams: 5 },
    legend: { days: 60, streams: 20, recentStreams: 4 }
  },
  battleWinBonus: 2,        // (old setting, kept so old config files still load)
  battleLoseBonus: 1,
  // card points from battles. Each point = +1 to the card's lowest stat at that moment.
  battlePoints: {
    shootout: [3, 1],                         // winner, loser
    race: [3, 2, 1, 1],                       // 1st..4th
    raidWin: { mvp: 3, top3: 2, rest: 1 },    // Queen Raid won: top scorer, 2nd-3rd, everyone else who scored
    raidLoss: { mvp: 1, top3: 0, rest: 0 }    // Queen survived
  },
  battleDailyCap: 5,        // most battle points one viewer can earn per day (spread across stats)
  bonusMax: 6,              // most bonus any single stat can hold
  ribbonYearSubMonths: 12,
  ribbonRaidHero: 3,
  ribbonShootoutKing: 5,
  ribbonRoadKing: 5,
  ribbonMultiPlatform: 10,   // streams watched on 2+ platforms at once
  ribbonQueenSlayer: 3       // times top scorer in a won Queen Raid
};

// SUP = support (bits, Kicks, Super Chats, gift subs). STK = stream streak (worked out from the streak, not XP).
const STAT_KEYS = ['WAT', 'SUB', 'SUP', 'CHT', 'LOY', 'RAI', 'STK'];
const XP_KEYS = ['WAT', 'SUB', 'SUP', 'CHT', 'LOY', 'RAI'];
// card settings from Game tuning > Viewer cards
const CARD_DEFAULTS = { streakBoostMax: 5, saverEvery: 10, saverMax: 2, stkSpeed: 14, giftSup: 500, t2Months: 2, t3Months: 5, supCurve: 4000, cardCooldown: 120, cardScreenGap: 10, cardReplyGap: 4 };
const STREAK_LEVELS = [[3, 'EMBER'], [5, 'FLAME'], [10, 'BLUE FLAME'], [20, 'INFERNO'], [40, 'PHOENIX']];
function streakLevel(n) { let l = 0; STREAK_LEVELS.forEach(([at], i) => { if (n >= at) l = i + 1; }); return l; }
function streakInfo(v) {
  const t = v.tk || {};
  const n = t.streak || 0, lvl = streakLevel(n);
  return { now: n, best: Math.max(n, t.bestStreak || 0), savers: t.savers || 0, level: lvl, name: lvl ? STREAK_LEVELS[lvl - 1][1] : '', next: (STREAK_LEVELS[lvl] || [])[0] || null };
}

function mergeRules(user) {
  const u = user || {};
  const r = Object.assign({}, DEFAULT_RULES, u);
  r.cards = Object.assign({}, CARD_DEFAULTS, u.cards);
  const uc = Object.assign({}, u.curve); if (uc.BIT != null && uc.SUP == null) uc.SUP = uc.BIT; delete uc.BIT;
  const ud = Object.assign({}, u.dailyCap); if (ud.BIT != null && ud.SUP == null) ud.SUP = ud.BIT; delete ud.BIT;
  r.curve = Object.assign({}, DEFAULT_RULES.curve, uc, { SUP: r.cards.supCurve });
  r.dailyCap = Object.assign({}, DEFAULT_RULES.dailyCap, ud);
  r.battlePoints = Object.assign({}, DEFAULT_RULES.battlePoints, u.battlePoints);
  const g = u.gates || {};
  r.gates = {
    gold: Object.assign({}, DEFAULT_RULES.gates.gold, g.gold),
    legend: Object.assign({}, DEFAULT_RULES.gates.legend, g.legend)
  };
  return r;
}

const today = (now) => new Date(now || Date.now()).toISOString().slice(0, 10);
const years = (ts, now) => (ts ? Math.max(0, Math.floor((now - ts) / (365.25 * DAY))) : 0);

// Upgrades records saved by older versions and fills in missing fields.
function migrate(v) {
  if (!v.xp) {
    v.xp = {
      WAT: v.watchMinutes || 0, SUB: (v.subMonths || 0) + (v.giftedSubs || 0) * 0.4, BIT: v.bits || 0,
      CHT: v.messages || 0, LOY: v.streams || 0, RAI: v.raids || 0
    };
    v.lastSeen = v.lastSeen || v.lastChatAt || v.firstSeen;
    if (v.subMonths && !v.lastSubAt) v.lastSubAt = Date.now();
  }
  v.bank = v.bank || {};
  v.bonus = v.bonus || {};
  v.dayXp = v.dayXp || {};
  // v16: the BIT stat became SUP (support), and gift subs now count there
  if (!v.v16) {
    v.v16 = true;
    for (const o of [v.xp, v.bank, v.bonus, v.dayXp]) if (o.BIT != null) { o.SUP = (o.SUP || 0) + o.BIT; delete o.BIT; }
    if (v.giftedSubs) { v.xp.SUB = Math.max(0, v.xp.SUB - v.giftedSubs * 0.4); v.xp.SUP = (v.xp.SUP || 0) + v.giftedSubs * CARD_DEFAULTS.giftSup; }
  }
  for (const k of XP_KEYS) if (typeof v.xp[k] !== 'number') v.xp[k] = 0;
  delete v.bonus.STK;
  v.recent = v.recent || [];
  v.battles = v.battles || { played: 0, won: 0 };
  v.races = v.races || { played: 0, won: 0, podiums: 0 };
  return v;
}

function rollDay(v, now) {
  const d = today(now);
  if (v.day !== d) { v.day = d; v.dayXp = {}; }
}

// Adds XP to a stat. force = historic/verified activity that skips the daily cap.
function addXp(v, stat, amount, R, force, now) {
  migrate(v);
  now = now || Date.now();
  if (!(amount > 0)) return 0;
  if (force) { v.xp[stat] += amount; return amount; }
  rollDay(v, now);
  const used = v.dayXp[stat] || 0;
  const take = Math.min(Math.max(0, R.dailyCap[stat] - used), amount);
  v.xp[stat] += take;
  v.dayXp[stat] = used + take;
  if (amount > take) v.bank[stat] = (v.bank[stat] || 0) + (amount - take);
  return take;
}

// Pays banked XP out, within today's cap.
function releaseBank(v, R, now) {
  migrate(v);
  rollDay(v, now);
  let moved = false;
  for (const k of Object.keys(v.bank)) {
    const left = v.bank[k];
    if (!(left > 0)) { delete v.bank[k]; continue; }
    const used = v.dayXp[k] || 0;
    const take = Math.min(Math.max(0, R.dailyCap[k] - used), left);
    if (take > 0) {
      v.xp[k] += take; v.dayXp[k] = used + take; v.bank[k] = left - take; moved = true;
      if (v.bank[k] < 0.001) delete v.bank[k];
    }
  }
  return moved;
}

function subActive(v, R, now) {
  return !!v.lastSubAt && now - v.lastSubAt < R.subLapseDays * DAY;
}

function attendStream(v, sid, now) {
  migrate(v);
  if (!sid || v.lastStream === sid) return false;
  // a simulcast seen on two linked platforms counts once (same 4-hour window)
  const plat = (x) => (/^(kick|yt|youtube|twitch|manual)-/.exec(String(x)) || ['', 'twitch'])[1];
  // same stream on another linked platform (4 h), or a reconnect on the same platform (45 min): counts once
  if (v.lastAttendAt && ((now - v.lastAttendAt < 4 * 3600000 && plat(v.lastStream) !== plat(sid)) || now - v.lastAttendAt < 45 * 60000)) {
    v.lastStream = sid;
    return false;
  }
  v.lastStream = sid;
  v.lastAttendAt = now;
  v.streams = (v.streams || 0) + 1;
  v.recent = v.recent.filter((t) => now - t < 30 * DAY);
  v.recent.push(now);
  return true;
}

// Fades stats for viewers who've been away, and SUB for lapsed subs.
function decay(v, R, now) {
  migrate(v);
  now = now || Date.now();
  const active = subActive(v, R, now);
  const last = v.lastSeen || v.firstSeen;
  const from = Math.max(last + R.graceDays * DAY, v.decayedTo || 0);
  if (now > from) {
    const f = Math.pow(1 - R.decayPerDay, (now - from) / DAY);
    for (const k of XP_KEYS) if (k !== 'SUB' || !active) v.xp[k] *= f;
    for (const k of Object.keys(v.bonus)) v.bonus[k] *= f;
    v.decayedTo = now;
  }
  if (v.lastSubAt && !active) {
    const sFrom = Math.max(v.lastSubAt + R.subLapseDays * DAY, v.subDecayedTo || 0);
    if (now > sFrom) {
      v.xp.SUB *= Math.pow(1 - R.subDecayPerDay, (now - sFrom) / DAY);
      v.subDecayedTo = now;
    }
  }
}

// what the viewer's sub looks like right now (for the dashboard)
function subInfo(v, R, now) {
  const on = subActive(v, R, now);
  if (!on) return null;
  return { tier: v.subTier || 1, prime: !!v.subPrime, gifted: !!v.subGifted, months: v.subMonths || 0, platform: v.subPlatform || v.platform };
}

function compute(v, R, now) {
  migrate(v);
  now = now || Date.now();
  const span = R.max - R.start;
  const clamp = (n) => Math.max(R.start, Math.min(R.max, Math.floor(n)));
  const stats = {};
  const C = R.cards || CARD_DEFAULTS, sk = streakInfo(v);
  const boost = Math.min(C.streakBoostMax, sk.level);
  for (const k of XP_KEYS) {
    let x = v.xp[k];
    if (k === 'LOY') x += years(v.followedAt, now) * R.anniversaryXp;
    stats[k] = v.isBroadcaster ? 99 : clamp(R.start + span * (1 - Math.exp(-x / R.curve[k])) + (v.bonus[k] || 0) + boost + ((v.manual && v.manual[k]) || 0));
  }
  // STK: current streak plus half the best ever, so a broken streak hurts but never wipes you out
  stats.STK = v.isBroadcaster ? 99 : clamp(R.start + span * (1 - Math.exp(-(sk.now + 0.5 * sk.best) / C.stkSpeed)) + boost + ((v.manual && v.manual.STK) || 0));
  let ovr = Math.round(STAT_KEYS.reduce((a, k) => a + stats[k], 0) / STAT_KEYS.length);
  const known = Math.min(v.firstSeen || now, v.followedAt || now);
  const daysKnown = Math.floor((now - known) / DAY);
  const streams = v.streams || 0;
  const recent = v.recent.filter((t) => now - t < 30 * DAY).length;
  const gG = R.gates.gold, gL = R.gates.legend;
  let locked = null, lockHint = null;
  if (!v.isBroadcaster) {
    if (ovr >= 90 && !(daysKnown >= gL.days && streams >= gL.streams && recent >= gL.recentStreams)) {
      ovr = 89; locked = 'legend';
      lockHint = 'Legend unlocks after ' + gL.days + ' days, ' + gL.streams + ' streams and ' + gL.recentStreams +
        ' streams this month (now ' + daysKnown + 'd, ' + streams + ', ' + recent + ')';
    }
    if (ovr >= 75 && !(daysKnown >= gG.days && streams >= gG.streams)) {
      ovr = 74; locked = 'gold';
      lockHint = 'Gold unlocks after ' + gG.days + ' days and ' + gG.streams + ' streams (now ' + daysKnown + 'd, ' + streams + ')';
    }
  }
  const tier = ovr >= 90 ? 'legend' : ovr >= 75 ? 'gold' : ovr >= 65 ? 'silver' : 'bronze';
  const active = subActive(v, R, now);
  const idle = now - (v.lastSeen || v.firstSeen || now);
  const form = v.isBroadcaster ? 'up'
    : (idle > R.graceDays * DAY || (v.lastSubAt && !active)) ? 'down'
      : idle < 3 * DAY ? 'up' : 'steady';
  const role = v.isBroadcaster ? 'BOSS' : v.isMod ? 'MOD' : v.isVip ? 'VIP' : active ? 'SUB' : v.followedAt ? 'FOL' : 'FAN';
  const ribbons = [];
  if (v.isBroadcaster) ribbons.push('THE BOSS');
  if ((v.subMonths || 0) >= R.ribbonYearSubMonths) ribbons.push('1 YEAR SUB');
  if (v.battles.won >= R.ribbonShootoutKing) ribbons.push('SHOOTOUT KING');
  if (v.races.won >= R.ribbonRoadKing) ribbons.push('KING OF THE ROAD');
  if (v.arc && v.arc.mvpWins >= R.ribbonQueenSlayer) ribbons.push('QUEEN SLAYER');
  if ((v.multiStreams || 0) >= R.ribbonMultiPlatform) ribbons.push('MULTI-PLATFORM');
  if (v.tk && v.tk.wins && v.tk.wins.length) {
    // a recent win shows first on the card for 30 days, then sits with the other ribbons
    if (now - v.tk.wins[v.tk.wins.length - 1].at < 30 * DAY) ribbons.unshift('WINNER'); else ribbons.push('WINNER');
  }
  if ((v.raids || 0) >= R.ribbonRaidHero) ribbons.push('RAID HERO');
  if ((v.mvps || 0) >= 1) ribbons.push((v.mvps || 0) >= 2 ? 'MVP x' + Math.min(99, v.mvps) : 'MVP');
  if ((v.bossWins || 0) >= 1) ribbons.push('BOSS SLAYER');
  if ((v.benchedTotal || 0) >= 5) ribbons.push('SUPER SUB');
  const ga = giftsAllTime(v), gm = GIFT_MILESTONES.filter((m) => m.n <= ga).pop();
  if (gm) ribbons.splice(v.isBroadcaster ? 1 : 0, 0, gm.name.toUpperCase() + ' ' + gm.n);
  const rn = v.raidNights || 0;
  if (rn >= 5) ribbons.push('RAID NIGHT ' + (rn >= 50 ? 50 : rn >= 25 ? 25 : rn >= 10 ? 10 : 5));
  return {
    key: v.key, display: v.display, platform: v.platform, platforms: v.platforms || [v.platform], avatar: v.avatar || null,
    stats, ovr, tier, role, form, locked, lockHint, ribbon: ribbons[0] || null, ribbons,
    banked: Object.values(v.bank).some((x) => x >= 1), tickets: v.tk ? v.tk.bal : 0, streak: sk, boost,
    sub: subInfo(v, R, now), gifted: v.giftedSubs || 0, battles: v.battles, races: v.races, arc: v.arc || null, test: !!v.test
  };
}

// Merges card `s` into card `p` (linking two accounts of the same person).
function merge(p, s, R) {
  migrate(p); migrate(s);
  for (const k of XP_KEYS) {
    p.xp[k] = (p.xp[k] || 0) + (s.xp[k] || 0);
    if (s.bank[k]) p.bank[k] = (p.bank[k] || 0) + s.bank[k];
    if (s.bonus[k]) p.bonus[k] = Math.min(R.bonusMax, (p.bonus[k] || 0) + s.bonus[k]);
  }
  if (p.day === s.day) for (const k of Object.keys(s.dayXp)) p.dayXp[k] = (p.dayXp[k] || 0) + s.dayXp[k];
  for (const f of ['watchMinutes', 'giftedSubs', 'bits', 'messages', 'streams', 'raids', 'subMonths']) p[f] = (p[f] || 0) + (s[f] || 0);
  const min = (a, b) => (a && b ? Math.min(a, b) : a || b || null);
  const max = (a, b) => (a && b ? Math.max(a, b) : a || b || null);
  p.followedAt = min(p.followedAt, s.followedAt);
  p.firstSeen = min(p.firstSeen, s.firstSeen);
  p.lastSeen = max(p.lastSeen, s.lastSeen);
  p.lastSubAt = max(p.lastSubAt, s.lastSubAt);
  p.lastChatAt = max(p.lastChatAt, s.lastChatAt);
  p.recent = Array.from(new Set(p.recent.concat(s.recent))).sort();
  p.battles.played += s.battles.played; p.battles.won += s.battles.won;
  p.races.played += s.races.played; p.races.won += s.races.won; p.races.podiums += s.races.podiums;
  p.multiStreams = (p.multiStreams || 0) + (s.multiStreams || 0);
  if (s.tk) {
    const a = p.tk || (p.tk = { bal: 0, day: '', today: 0, total: 0, wm: 0, streak: 0, lastStreamNo: 0, charms: {}, wins: [], cool: {} }), b = s.tk;
    a.bal = Math.min(250, a.bal + b.bal); a.total += b.total || 0; a.wm += b.wm || 0;
    a.streak = Math.max(a.streak, b.streak || 0); a.bestStreak = Math.max(a.bestStreak || 0, b.bestStreak || 0, a.streak); a.savers = Math.max(a.savers || 0, b.savers || 0); a.lastStreamNo = Math.max(a.lastStreamNo, b.lastStreamNo || 0);
    a.lastAttendAt = Math.max(a.lastAttendAt || 0, b.lastAttendAt || 0) || undefined;
    for (const k of Object.keys(b.charms || {})) a.charms[k] = Math.max(a.charms[k] || 0, b.charms[k]);
    for (const k of Object.keys(b.cool || {})) a.cool[k] = Math.max(a.cool[k] || 0, b.cool[k]);
    a.wins = (a.wins || []).concat(b.wins || []).sort((x, y) => x.at - y.at);
  }
  if (s.arc) { p.arc = p.arc || { played: 0, won: 0, mvp: 0, mvpWins: 0 }; for (const k of ['played', 'won', 'mvp', 'mvpWins']) p.arc[k] = (p.arc[k] || 0) + (s.arc[k] || 0); }
  p.packShown = !!(p.packShown || s.packShown);
  p.isMod = !!(p.isMod || s.isMod); p.isVip = !!(p.isVip || s.isVip);
  if (!p.avatar && s.avatar) p.avatar = s.avatar;
  if (s.test) p.test = true;
  const uniq = (a) => Array.from(new Set(a.filter(Boolean)));
  p.platforms = uniq([p.platform].concat(p.platforms || [], [s.platform], s.platforms || []));
  p.links = uniq((p.links || []).concat([s.key], s.links || []));
}

// gifted subs: the app's own count plus older gifts (Twitch's all-time total or an import)
const GIFT_MILESTONES = [{ n: 10, name: 'Supporter' }, { n: 25, name: 'Benefactor' }, { n: 50, name: 'Patron' }, { n: 100, name: 'Legend' }, { n: 250, name: 'Hall of Fame' }];
function giftsAllTime(v) { return (v.giftedSubs || 0) + Math.max(0, v.giftsBase || 0); }
module.exports = { GIFT_MILESTONES, giftsAllTime, CARD_DEFAULTS, STREAK_LEVELS, streakLevel, streakInfo, XP_KEYS, subInfo, merge, DAY, DEFAULT_RULES, STAT_KEYS, mergeRules, migrate, addXp, releaseBank, attendStream, decay, subActive, compute };
