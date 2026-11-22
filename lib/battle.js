// Viewer battles. Same flow for every mode:
//   join (chat types !join) → matchup + boost window → the event → results & card rewards.
// Modes: "shootout" (2 players, penalty shootout) and "race" (2–4 drivers, BBR Haulage Cup truck race).
const crypto = require('crypto');

const ARC = require('./arc');
const { QueenRaid } = ARC;
const RL = require('./race');
const KITS = require('../public/kits.js');
const rnd = () => crypto.randomInt(0, 1000000) / 1000000;
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ======================= PENALTY SHOOTOUT =======================
const ZONES = ['TL', 'TM', 'TR', 'ML', 'MM', 'MR', 'BL', 'BM', 'BR'];
const MISS = ['WL', 'WR', 'OVER'];

function simulateShootout(cards, boosts) {
  const score = [0, 0], taken = [0, 0], kicks = [];
  const chance = (s) => {
    const k = 1 - s;
    const p = 0.72 + (cards[s].ovr - cards[k].ovr) * 0.003 + boosts[s] * 0.009 - boosts[k] * 0.004;
    return Math.max(0.35, Math.min(0.93, p));
  };
  const other = (z) => pick(ZONES.filter((x) => x !== z));
  const kick = (s, round, forceGoal) => {
    const zone = pick(ZONES);
    let result, target = zone, dive;
    if (forceGoal || rnd() < chance(s)) { result = 'goal'; dive = rnd() < 0.15 ? 'STAY' : other(zone); }
    else if (rnd() < 0.72) { result = 'save'; dive = zone; }
    else { result = 'miss'; target = pick(MISS); dive = pick(ZONES); }
    taken[s]++;
    if (result === 'goal') score[s]++;
    kicks.push({ s, round, result, target, dive, score: score.slice() });
  };
  const decided = () => score[0] + (5 - taken[0]) < score[1] || score[1] + (5 - taken[1]) < score[0];
  let done = false, round;
  for (round = 1; round <= 5 && !done; round++) {
    for (const s of [0, 1]) { kick(s, round); if (decided()) { done = true; break; } }
  }
  round = 6;
  while (score[0] === score[1] && round <= 11) { kick(0, round); kick(1, round); round++; }
  if (score[0] === score[1]) kick(rnd() < 0.5 ? 0 : 1, round, true);
  const winner = score[0] > score[1] ? 0 : 1;
  return { kicks, score, winner, order: [winner, 1 - winner] };
}

// ======================= BBR HAULAGE CUP (truck race) =======================
const ROUTES = [
  { game: 'ATS', from: 'Los Angeles', to: 'Las Vegas', km: 434 },
  { game: 'ATS', from: 'Phoenix', to: 'Albuquerque', km: 676 },
  { game: 'ATS', from: 'San Francisco', to: 'Reno', km: 350 },
  { game: 'ATS', from: 'Seattle', to: 'Portland', km: 280 },
  { game: 'ATS', from: 'Denver', to: 'Salt Lake City', km: 837 },
  { game: 'ATS', from: 'Dallas', to: 'Houston', km: 385 },
  { game: 'ATS', from: 'Boise', to: 'Missoula', km: 545 },
  { game: 'ETS', from: 'Calais', to: 'Duisburg', km: 412 },
  { game: 'ETS', from: 'Rotterdam', to: 'Berlin', km: 657 },
  { game: 'ETS', from: 'London', to: 'Edinburgh', km: 666 },
  { game: 'ETS', from: 'Paris', to: 'Lyon', km: 465 },
  { game: 'ETS', from: 'Milano', to: 'München', km: 493 },
  { game: 'ETS', from: 'Stockholm', to: 'Oslo', km: 528 },
  { game: 'ETS', from: 'Warszawa', to: 'Praha', km: 683 }
];
const CARGO = ['22t of Fireworks', '18t of Bananas', 'an Excavator', 'Fragile Glass Panels', 'Live Chickens', '40t of Gravel',
  'Frozen Pizzas', 'a Wind Turbine Blade', 'Medical Supplies', '30,000 Rubber Ducks', 'Cheese Wheels', 'Office Chairs', 'Scrap Metal', 'a Yacht Hull'];
const WEATHER = [
  { id: 'clear', label: 'Clear skies', w: 3 }, { id: 'rain', label: 'Heavy rain', w: 4 },
  { id: 'fog', label: 'Thick fog', w: 1.5 }, { id: 'night', label: 'Night run', w: 2 }
];
// kind drives the animation on the overlay
const BAD = [
  { text: 'Breakdown! Hazards on', mult: 0.25, len: 3, kind: 'smoke' },
  { text: 'Pulled into a weigh station', mult: 0, len: 2, kind: 'stop' },
  { text: 'Speed trap! Fined and slowed', mult: 0.5, len: 2, kind: 'police' },
  { text: 'Missed the exit, rerouting', mult: 0.4, len: 2, kind: 'detour' },
  { text: 'Tyre blowout on the trailer', mult: 0.35, len: 3, kind: 'blowout' },
  { text: 'Stuck in roadworks', mult: 0.3, len: 2, kind: 'cones' },
  { text: 'Running on fumes, fuel stop', mult: 0.15, len: 2, kind: 'stop' }
];
const ANIMALS = {
  ATS: [['deer', 'Deer on the road!'], ['moose', 'MOOSE! Hard on the brakes'], ['cow', 'Loose cattle across the lanes'], ['bear', 'A bear wanders out!']],
  ETS: [['deer', 'Deer on the road!'], ['sheep', 'Flock of sheep crossing'], ['cow', 'Cows on the motorway'], ['boar', 'Wild boar charges out!']]
};
const WEATHER_BAD = {
  rain: [{ text: 'Aquaplaning! Sliding all over', mult: 0.4, len: 2, kind: 'slide' }, { text: 'Spray everywhere, can\'t see a thing', mult: 0.6, len: 2, kind: 'spray' }],
  fog: [{ text: 'Lost in the fog', mult: 0.5, len: 2, kind: 'fog' }],
  night: [{ text: 'Dazzled by full beams', mult: 0.55, len: 2, kind: 'glare' }]
};
const CRASH = [
  { text: 'JACKKNIFED! Trailer swings round', mult: 0.05, len: 3, kind: 'crash' },
  { text: 'CRASH! Slid into the barrier', mult: 0.05, len: 3, kind: 'crash' }
];
const GOOD = [
  { text: 'Slipstreaming the pack', mult: 1.4, len: 2, kind: 'draft' },
  { text: 'Green lights all the way', mult: 1.3, len: 2, kind: 'boost' },
  { text: 'Long downhill, full send', mult: 1.35, len: 2, kind: 'boost' },
  { text: 'Clear highway ahead', mult: 1.25, len: 2, kind: 'boost' },
  { text: 'CB tip-off: found a shortcut', mult: 1.5, len: 1, kind: 'shortcut' }
];
function pickW(list) { let t = list.reduce((a, x) => a + x.w, 0) * rnd(); for (const x of list) { t -= x.w; if (t <= 0) return x; } return list[0]; }

function raceSetup() {
  const w = pickW(WEATHER);
  return { route: pick(ROUTES), cargo: pick(CARGO), weather: { id: w.id, label: w.label } };
}

const BAL = { ovr: 0.0012, boost: 0.0028, bad: 0.09, badBoost: 0.003, good: 0.06, noise: 0.5, crash: 0.009, rainCrash: 0.022, animal: 0.025, nightAnimal: 0.05, draft: 0.05 };

function simulateRace(cards, boosts, setup) {
  const MAXT = 54, LEAD = 43, n = cards.length;
  const dist = cards.map(() => [0]);
  const fx = cards.map(() => null), bads = cards.map(() => 0), goods = cards.map(() => 0), crashed = cards.map(() => false);
  const events = [];
  const wid = setup.weather.id, wet = wid === 'rain';
  // rain: slower, less predictable
  const base = cards.map((c, i) => (1 + (c.ovr - 60) * BAL.ovr + boosts[i] * BAL.boost) * (wet ? 0.95 : 1));
  const noise = wet ? 0.7 : BAL.noise;
  const add = (t, i, e, good) => {
    fx[i] = { mult: e.mult, until: t + e.len - 1 };
    events.push(Object.assign({ t, d: i, text: e.text, good, kind: e.kind }, e.animal ? { animal: e.animal } : {}));
  };
  for (let t = 1; t <= MAXT; t++) {
    const lead = Math.max.apply(null, dist.map((d) => d[t - 1]));
    for (let i = 0; i < n; i++) {
      if (fx[i] && t > fx[i].until) fx[i] = null;
      if (!fx[i] && t > 2 && t < LEAD) {
        const fuel = boosts[i] * BAL.badBoost;
        const pCrash = Math.max(0.004, (wet ? BAL.rainCrash : BAL.crash) - fuel / 3);
        const pAnimal = wid === 'night' ? BAL.nightAnimal : BAL.animal;
        const pBad = Math.max(0.03, BAL.bad - fuel), pGood = BAL.good + boosts[i] * 0.002;
        if (!crashed[i] && bads[i] < 4 && rnd() < pCrash) { crashed[i] = true; bads[i]++; add(t, i, pick(CRASH), false); }
        else if (bads[i] < 4 && rnd() < pAnimal) {
          const [animal, text] = pick(ANIMALS[setup.route.game] || ANIMALS.ATS);
          bads[i]++; add(t, i, { text, mult: 0.3, len: 2, kind: 'animal', animal }, false);
        } else if (bads[i] < 4 && rnd() < pBad) {
          const wb = WEATHER_BAD[wid];
          bads[i]++; add(t, i, wb && rnd() < (wet ? 0.55 : 0.35) ? pick(wb) : pick(BAD), false);
        } else if (goods[i] < 3 && rnd() < pGood) { goods[i]++; add(t, i, pick(GOOD), true); }
      }
      // close behind someone? catch their slipstream (keeps the pack together, more overtakes)
      const gap = lead - dist[i][t - 1];
      const draft = gap > 0 && gap < 1.2 ? 1 + BAL.draft : 1;
      const speed = base[i] * draft * (1 - noise / 2 + rnd() * noise) * (fx[i] ? fx[i].mult : 1);
      dist[i].push(dist[i][t - 1] + speed);
    }
  }
  const finish = Math.max.apply(null, dist.map((d) => d[LEAD]));
  const finishTick = dist.map((d) => {
    for (let t = 1; t <= MAXT; t++) if (d[t] >= finish) return t - 1 + (finish - d[t - 1]) / (d[t] - d[t - 1]);
    return null;
  });
  const done = finishTick.filter((x) => x != null);
  const TICKS = Math.min(MAXT, Math.ceil(Math.max.apply(null, done)) + 1);
  // keep events that happen before the race ends
  for (let k = events.length - 1; k >= 0; k--) if (events[k].t > TICKS) events.splice(k, 1);
  const order = cards.map((c, i) => i).sort((a, b) => {
    const fa = finishTick[a], fb = finishTick[b];
    if (fa != null && fb != null) return fa - fb;
    if (fa != null) return -1;
    if (fb != null) return 1;
    return dist[b][MAXT] - dist[a][MAXT];
  });
  const km = setup.route.km;
  const winnerHours = km / 84;
  const results = order.map((i) => {
    const ft = finishTick[i];
    const hours = ft != null ? winnerHours * (ft / finishTick[order[0]]) : null;
    return {
      d: i, finished: ft != null, finishTick: ft,
      time: hours != null ? Math.floor(hours) + 'h ' + String(Math.round((hours % 1) * 60)).padStart(2, '0') + 'm' : null,
      behindKm: ft == null ? Math.max(1, Math.round((1 - dist[i][TICKS] / finish) * km)) : 0
    };
  });
  let leadChanges = 0, prevLead = -1;
  for (let t = 1; t <= TICKS; t++) {
    let l = 0; for (let i = 1; i < n; i++) if (dist[i][t] > dist[l][t]) l = i;
    if (prevLead >= 0 && l !== prevLead) leadChanges++;
    prevLead = l;
  }
  const photo = order.length > 1 && finishTick[order[1]] != null && finishTick[order[1]] - finishTick[order[0]] < 0.3;
  return {
    setup, ticks: TICKS,
    positions: dist.map((d) => d.slice(0, TICKS + 1).map((x) => Math.min(1, +(x / finish).toFixed(4)))),
    events, order, results, photoFinish: photo, winner: order[0], leadChanges
  };
}

// ======================= COMPOSURE (penalty shootout) =======================
// Every player starts with composure from their card (OVR + LOY = big-game experience).
// It drains with every kick, more after a miss and much more in sudden death.
// Low composure = more shots wide / over, weaker shots and the keeper reads you.
// Chat can steady a player's nerves (bits / Kicks / Super Chat / subs), capped so it helps but can't buy a win.
const COMP = { drain: 2, sdDrain: 6, sdShock: 10, goal: 5, fail: 4, oppGoal: 3, oppFail: 3, mustScore: 8, perBoost: 3, perSub: 8, maxChat: 18, crowdMax: 5, crowdChantMax: 4 };
// Shootout tuning (settings page, Battles tab > Game tuning). goalPct = goal chance per kick for an
// average card with steady nerves; the miss and save chances are scaled to hit it.
const SO = { drawPick: 1, noRepeat: 1, ytExtraSecs: 8, goalPct: 70, aimSecs: 10, autoStartSecs: 3, keeperCentre: 34, centreSave: 85, sideSave: 75, topSave: 36, lowSave: 80, centreTopSave: 55, centreLowSave: 80, topMissUp: 70, keeperHigh: 35, keeperLow: 35, centreMissCut: 20, keeperReads: 15, onTargetSave: 12, booCost: 1, flareCost: 2, flashCost: 1, laserCost: 2, chantGain: 1 };
const COMP_KEYS = ['drain', 'sdDrain', 'sdShock', 'goal', 'fail', 'oppGoal', 'oppFail', 'mustScore', 'perBoost', 'perSub', 'maxChat', 'crowdMax', 'crowdChantMax'];
const SO_DEFAULTS = Object.assign({}, SO);
let soK = 1;
// v29: 9 shot zones. Column L / C / R and height T (top) / M (middle) / B (bottom).
// Top corners are the hardest to save but go over / wide most; middle height is the safest on target
// but the easiest to save if the keeper guesses the side. The keeper guesses a side AND a height.
const COLS = ['L', 'C', 'R'], ROWS = ['T', 'M', 'B'];
const zoneOf = (d, r) => (r || 'M') + (d === 'L' ? 'L' : d === 'R' ? 'R' : 'M');
// base save chance when the keeper goes the right way at the right height (before scaling)
function baseSave(d, h) {
  if (d === 'C') return (h === 'T' ? SO.centreTopSave : h === 'B' ? SO.centreLowSave : SO.centreSave) / 100;
  return (h === 'T' ? SO.topSave : h === 'B' ? SO.lowSave : SO.sideSave) / 100;
}
// how well the keeper reaches a height he didn't guess: same 1, one row off 0.55, top vs bottom 0.2
const reach = (g, h) => (g === h ? 1 : (g === 'M' || h === 'M') ? 0.55 : 0.2);
const missMul = (d, h) => (h === 'T' ? 1 + SO.topMissUp / 100 : h === 'B' ? 0.85 : 1) * (d === 'C' ? 1 - Math.max(0, Math.min(90, SO.centreMissCut)) / 100 : 1);
function keeperRows() { const hi = Math.max(0, SO.keeperHigh) / 100, lo = Math.max(0, SO.keeperLow) / 100, mid = Math.max(0, 1 - hi - lo); const s = hi + lo + mid || 1; return { T: hi / s, M: mid / s, B: lo / s }; }
// the chance the keeper stops a shot in zone (d, h), given he picks his side with `stay` % staying central
function saveChance(d, h, k, stay, adj) {
  const kr = keeperRows(), pc = stay / 100, ps = (1 - pc) / 2;
  const sv = (g) => Math.min(0.97, Math.max(0, baseSave(d, h) * k + (adj || 0))) * reach(g, h);
  if (d === 'C') return pc * Math.min(0.97, Math.max(0, baseSave(d, h) * k + (adj || 0)));   // standing up he covers every height
  return ps * (kr.T * sv('T') + kr.M * sv('M') + kr.B * sv('B'));
}
// goal chance for each of the 9 zones, for an average card (OVR 60) with steady nerves
function zoneOdds(k) {
  if (k == null) k = soK;
  const out = {};
  for (const d of COLS) for (const h of ROWS) out[zoneOf(d, h)] = (1 - Math.min(1, 0.11 * missMul(d, h) * k)) * (1 - saveChance(d, h, k, SO.keeperCentre));
  return out;
}
function calibrate() {
  const G = Math.max(5, Math.min(99, SO.goalPct)) / 100;
  const at = (k) => { const o = zoneOdds(k); const v = Object.values(o); return v.reduce((a, b) => a + b, 0) / v.length; };
  let lo = 0, hi = 6;
  for (let i = 0; i < 40; i++) { const k = (lo + hi) / 2; if (at(k) > G) lo = k; else hi = k; }
  soK = (lo + hi) / 2;
}
// by side (averaged over the three heights), for the settings page
function sideOdds(k) {
  const z = zoneOdds(k), av = (c) => (z['T' + c] + z['M' + c] + z['B' + c]) / 3;
  return { L: av('L'), C: av('M'), R: av('R'), zones: z };
}
// chat text → { d: L|C|R, h: T|M|B } or null. Quick forms: L, LT, TL, L TOP, top left, 7..9 / 4..6 / 1..3 (number pad), T, B, C
function parseShot(text) {
  let t = String(text || '').trim().toLowerCase().replace(/^!/, '').replace(/^(?:aim|shoot|kick|pick|go)\s+/, '');
  if (/^[1-9]$/.test(t)) { const n = +t - 1; return { d: COLS[n % 3], h: ['B', 'M', 'T'][Math.floor(n / 3)] }; }
  t = t.replace(/[!.?,*~+_-]+$/, '').replace(/([a-z])\d+$/, '$1').trim();
  const W = { l: 'L', left: 'L', r: 'R', right: 'R', c: 'C', centre: 'C', center: 'C', middle: 'C', mid: 'C', m: 'C' };
  const H = { t: 'T', top: 'T', high: 'T', up: 'T', h: 'T', b: 'B', bottom: 'B', low: 'B', down: 'B', lo: 'B', bot: 'B' };
  // two letters stuck together: LT TL LB BL CT TC CB BC RT TR RB BR (and LM / ML = middle)
  let m = /^([lcrm])([tbhm])$/.exec(t) || /^([tbh])([lcrm])$/.exec(t);
  if (m) { const a = m[1], b = m[2]; const col = W[a] && /[lcrm]/.test(a) && !/^[tbh]/.test(a) ? a : b, row = col === a ? b : a; return { d: W[col], h: row === 'm' ? 'M' : H[row] }; }
  const parts = t.split(/\s+/).filter(Boolean);
  if (!parts.length || parts.length > 3) return null;
  let d = null, h = null;
  for (const w of parts) { if (W[w] && !d) d = W[w]; else if (H[w] && !h) h = H[w]; else if (w === 'mid' && !h && d) h = 'M'; else if (parts.length === 1) return null; }
  if (!d && !h) return null;
  if (parts.length > 1 && !(d || h)) return null;
  return { d: d || 'C', h: h || 'M' };
}
calibrate();
let COMP_DEFAULTS = null;
function configureShootout(t) {
  t = t || {};
  if (!COMP_DEFAULTS) COMP_DEFAULTS = Object.assign({}, COMP);
  const num = (v, d) => (v != null && v !== '' && isFinite(+v) ? +v : d);
  for (const k of Object.keys(SO_DEFAULTS)) SO[k] = num(t[k], SO_DEFAULTS[k]);
  for (const k of COMP_KEYS) COMP[k] = num(t['comp_' + k], COMP_DEFAULTS[k]);
  MODES.shootout.timing.aim = SO.aimSecs;
  calibrate();
}
function shootoutDefaults() { if (!COMP_DEFAULTS) COMP_DEFAULTS = Object.assign({}, COMP); const o = Object.assign({}, SO_DEFAULTS); for (const k of COMP_KEYS) o['comp_' + k] = COMP_DEFAULTS[k]; return o; }
const startComposure = (c) => Math.max(30, Math.min(85, Math.round(52 + ((c.ovr || 40) - 40) * 0.45 + (((c.stats && c.stats.LOY) || 40) - 40) * 0.15)));
const clampC = (x) => Math.max(0, Math.min(100, Math.round(x)));

// ======================= battle manager =======================
const MODES = {
  shootout: {
    label: 'PENALTY SHOOTOUT', min: 2, max: 2, phase: 'shootout', timing: { intro: 4500, aim: 10, kick: 6200, outro: 9000 },
    joinMsg: (s) => 'PENALTY SHOOTOUT! Type !join in the next ' + s + ' seconds to enter. ' + (SO.drawPick ? 'Two players are drawn at random from everyone who joins.' : 'The first two to join play.'),
    matchMsg: (f, secs) => f[0].display + ' vs ' + f[1].display + ' vs the AI keeper! ' + secs + 's to buy ON TARGET shots: cheer bits / Kicks / Super Chat with a player\'s name ' +
      '(100 = 1 kick that can\'t go wide or over, max 5). Players: sub or gift for +2.',
    resultMsg: (f, sim) => f[sim.winner].display + ' wins the shootout ' + sim.score[sim.winner] + '-' + sim.score[1 - sim.winner] +
      ' against ' + f[1 - sim.winner].display + '! Their card got a boost.'
  },
  race: {
    label: 'BBR HAULAGE CUP', min: 2, max: 8, phase: 'race', timing: { intro: 5500, tick: 1000, outro: 10000 },
    duration: (sim, T) => T.intro + sim.ticks * T.tick + T.outro,
    joinMsg: (s) => 'BBR HAULAGE CUP! Truckers, type !join in the next ' + s + ' seconds. Up to 8 drivers race for the cup.',
    matchMsg: (f, secs, max, setup) => 'Drivers: ' + f.map((x) => x.display).join(', ') + '. Route: ' + setup.route.from + ' to ' + setup.route.to +
      ' hauling ' + setup.cargo + ' (' + setup.weather.label + '). ' + secs + 's to fuel up: cheer bits / Kicks / Super Chat with a driver\'s name ' +
      '(100 = +1 fuel), drivers can sub for +5. DRIVERS: L / R to change lane (L2 / R2 = two lanes), !turbo, !special (your cargo), !horn, !dodge. EVERYONE ELSE: !rain !wind !lightning !traffic (one each, usually hits the leader).',
    resultMsg: (f, sim) => f[sim.winner].display + ' wins the BBR Haulage Cup, first to ' + sim.setup.route.to + ' with ' + sim.setup.cargo + '! Podium: ' +
      sim.order.slice(0, 3).map((i, n) => (n + 1) + '. ' + f[i].display).join('  ')
  },
  arc: {
    label: 'QUEEN RAID', min: 1, max: 60, phase: 'arc', timing: { intro: 6000, outro: 12000 },
    joinMsg: (s) => 'QUEEN RAID! Everyone type !join in the next ' + s + ' seconds. All raiders drop in together: clear the ARC swarm, then take down the Veydr Queen before the clock runs out.',
    matchMsg: (f, secs) => f.length + ' raider' + (f.length === 1 ? '' : 's') + ' dropping in! ' + secs + 's to gear up: cheer bits / Kicks / Super Chat with a raider\'s name for firepower (100 = +1, max 10), ' +
      'or without a name for a team supply drop. Raiders can sub for +5. Boosts work during the fight too, and get a downed raider straight back up.',
    resultMsg: (f, sim) => (sim.win ? 'THE QUEEN IS DOWN in ' + Math.floor(sim.time / 60) + ':' + String(sim.time % 60).padStart(2, '0') + '! ' : 'The Queen survived with ' + Math.round(sim.queenLeft / sim.queenMax * 100) + '% left. ') +
      'Top raiders: ' + sim.ranking.slice(0, 3).map((r, n) => (n + 1) + '. ' + f[r.i].display + ' (' + r.score + ')').join('  ')
  }
};

class Battle {
  // o: { push, say, card(key), ensure(platform, login, display), reward(rankedFighters, mode, sim), opts() }
  constructor(o) {
    Object.assign(this, o);
    this.phase = 'idle';
    this.mode = null;
    this.joiners = new Map();
    this.fighters = [];
    this.timer = null;
    this.endsAt = null;
    this.setup = null;
  }

  openBoss(extra) { if (this.phase !== 'idle') return false; this.bossMode = true; if (!this.open('shootout', extra)) { this.bossMode = false; return false; } return true; }
  status() {
    return { teams: this.tm ? { size: this.tm.size, make: this.tm.make, paused: !!this.tm.paused, aiming: !!(this.so && this.so.aim && !this.so.aim.pick), shooter: this.so && this.so.aim ? this.fighters[this.so.aim.s].display : null, side: this.so && this.so.aim && this.tm.sides ? this.tm.sides[this.so.aim.s].name : null, score: this.so && this.tm.sides ? this.tm.sides.map((x, i) => x.name + ' ' + this.so.score[i]).join(' - ') : null } : null, boss: !!this.bossMode, bossRole: this.bossMode && this.so && this.so.aim && this.so.aim.s === 1 && !this.so.aim.pick ? 'shoot' : null, phase: this.phase, mode: this.mode, joiners: this.joiners.size, endsAt: this.endsAt, fighters: this.fighters.map((f) => ({ display: f.display, boost: f.boost })) };
  }

  // v29: who's in while a game is joining (dock Games tab)
  lobby() {
    if (this.phase !== 'join') return null;
    const label = this.tm ? this.tm.size + ' v ' + this.tm.size + ' TEAM SHOOTOUT' : this.bossMode ? 'BEAT THE BOSS' : (MODES[this.mode] || {}).label;
    const o = { mode: this.mode, label, endsAt: this.endsAt, starting: !!this.autoGo, min: this.joinMin(), names: Array.from(this.joiners.values()).map((j) => j.display).slice(0, 40), count: this.tm ? this.tm.joined.size : this.joiners.size };
    if (this.tm) { try { o.teams = this.teamLobby().teams.sides.map((s) => ({ name: s.name, color: s.color, size: this.tm.size, players: s.players.filter((p) => p.display).map((p) => p.display) })); } catch (e) { /* ignore */ } }
    return o;
  }
  open(mode, extra) {
    if (this.phase !== 'idle' || !MODES[mode]) return false;
    const M = MODES[mode];
    const secs = this.opts().joinSecs;
    this.mode = mode;
    this.phase = 'join';
    this.joiners.clear();
    this.fighters = [];
    this.endsAt = Date.now() + secs * 1000;
    const boss = mode === 'shootout' && this.bossMode;
    this.push({ type: 'battle', mode, label: boss ? 'BEAT THE BOSS' : M.label, phase: 'join', secs, endsAt: this.endsAt, max: boss ? 1 : M.max, draw: mode === 'shootout' && (boss || !!SO.drawPick), boss });
    this.say(boss ? 'BEAT THE BOSS! Type !join in the next ' + secs + ' seconds. One name is drawn to take on the Boss in a penalty shootout' + (this.bossInfo ? ' · bounty: +' + this.bossInfo().bounty + ' card points' : '') + '.' : M.joinMsg(secs));
    this.timer = setTimeout(() => this.pick(), secs * 1000);
    if (extra) extra();
    return true;
  }

  join(platform, login, display, arg, o) {
    if (this.phase !== 'join' || !login) return;
    if (this.tm) return this.teamJoin(platform, login, display, arg, o);
    this.ensure(platform, login, display);
    // linked accounts resolve to one card, so a person can't join twice from two platforms
    const key = this.resolveKey ? this.resolveKey(platform, login) : platform + ':' + String(login).toLowerCase();
    if (this.joiners.has(key)) return;
    this.joiners.set(key, { key, platform, login: String(login).toLowerCase(), display: display || login });
    this.push({ type: 'battle', mode: this.mode, phase: 'count', count: this.joiners.size, last: display || login });
    if (this.onJoin) { try { this.onJoin(platform, display || login, this.joiners.size); } catch (e) { /* ignore */ } }
    this.joinTick();
  }
  // v29: games start straight away once they're full, or when nobody new has joined for a few seconds
  joinFull() {
    if (this.tm) { const T = this.tm; return T.joined.size >= T.size * T.defs.length; }
    if (this.bossMode) return false;
    if (this.mode === 'shootout') return !SO.drawPick && this.joiners.size >= MODES.shootout.max;
    return this.joiners.size >= MODES[this.mode].max;
  }
  joinMin() { return this.tm ? 2 : this.bossMode ? 1 : MODES[this.mode].min; }
  joinTick() {
    if (this.phase !== 'join' || this.autoGo) return;
    clearTimeout(this.idleT);
    const n = this.tm ? this.tm.joined.size : this.joiners.size;
    if (this.joinFull()) {
      this.autoGo = true; clearTimeout(this.timer);
      this.say(this.mode === 'shootout' && !this.tm ? 'We have two players! Shootout starting...' : 'Everyone\'s in! Starting now...');
      this.timer = setTimeout(() => this.pick(), SO.autoStartSecs * 1000);
      this.push({ type: 'battle', mode: this.mode, phase: 'count', count: n, starting: true, endsAt: Date.now() + SO.autoStartSecs * 1000 });
      return;
    }
    const idle = this.opts().startIdleSecs;
    if (idle > 0 && n >= this.joinMin() && this.endsAt - Date.now() > idle * 1000 + 500) {
      this.idleT = setTimeout(() => { if (this.phase !== 'join' || this.autoGo) return; this.autoGo = true; this.startNow(true); }, idle * 1000);
    }
  }
  // START NOW button (dock / dashboard / Stream Deck): end the joining and play with who's in
  startNow(auto) {
    if (this.phase !== 'join') return { error: 'No game is waiting for players' };
    const n = this.tm ? this.tm.joined.size : this.joiners.size;
    if (n < this.joinMin() && !(this.tm && this.tm.test)) return { error: 'Not enough players yet (' + n + ' of ' + this.joinMin() + ')' };
    clearTimeout(this.timer); clearTimeout(this.idleT); this.autoGo = true;
    if (!auto || n > 1) this.say((auto ? 'Nobody else joining: ' : '') + 'Starting with ' + n + ' player' + (n === 1 ? '' : 's') + '!');
    this.timer = setTimeout(() => this.pick(), 1200);
    return { ok: true, players: n };
  }

  pick() {
    if (this.tm) return this.teamPick();
    const M = MODES[this.mode];
    let list = Array.from(this.joiners.values());
    if (this.bossMode && this.bossFighter) {
      const bf = this.bossFighter(); list = list.filter((j) => !bf || j.key !== bf.key);
      if (!list.length || !bf) { this.push({ type: 'battle', mode: this.mode, phase: 'cancel', reason: bf ? 'Nobody joined to take on the Boss' : 'No Boss card yet (chat once as the broadcaster)' }); this.say(bf ? 'Nobody joined. The Boss wins by default...' : 'Beat the Boss needs your own card: say something in chat first.'); return this.reset(); }
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      if (this.bossPrefer) list.sort((a, b) => this.bossPrefer(b.key) - this.bossPrefer(a.key));   // subs (or whoever you choose) first
      this.fighters = [Object.assign({}, list[0], { boost: 0 }), Object.assign({}, bf, { boost: 0, boss: true })];
      if (list.length > 1) { this.phase = 'draw'; this.push({ type: 'battle', mode: 'shootout', phase: 'draw', names: list.map((j) => j.display).slice(0, 30), picked: this.fighters.map((f) => f.display), count: list.length, boss: true }); this.say('THE DRAW: ' + list[0].display + ' takes on the Boss!'); this.timer = setTimeout(() => this.matchup(), 5200); return; }
      return this.matchup();
    }
    if (list.length < M.min) {
      this.push({ type: 'battle', mode: this.mode, phase: 'cancel', reason: 'Not enough players joined' });
      this.say('Not enough players joined. Next battle in ' + this.opts().intervalMin + ' minutes of stream time!');
      return this.reset();
    }
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    // shootout draw: last shootout's players go to the back of the draw (they only play if there aren't enough others)
    if (this.mode === 'shootout' && SO.noRepeat && this.lastShooters) {
      const fresh = list.filter((j) => !this.lastShooters.includes(j.key)), old = list.filter((j) => this.lastShooters.includes(j.key));
      list.splice(0, list.length, ...fresh, ...old);
    }
    // v29 "Let me play": the streamer (or whoever alwaysIn says) is always in when they join
    if (this.alwaysIn) { const me = list.filter((j) => this.alwaysIn(j.key)); if (me.length) list.splice(0, list.length, ...me, ...list.filter((j) => !me.includes(j))); }
    this.fighters = list.slice(0, M.max).map((j) => Object.assign({}, j, { boost: 0 }));
    if (this.mode === 'shootout') this.lastShooters = this.fighters.map((f) => f.key);
    if (this.mode === 'shootout' && SO.drawPick && list.length > M.max && !this.drawn) {
      // show the draw first: every name spins on two reels, then the matchup
      this.drawn = true;
      this.phase = 'draw';
      const names = list.map((j) => j.display).slice(0, 30);
      this.push({ type: 'battle', mode: 'shootout', phase: 'draw', names, picked: this.fighters.map((f) => f.display), count: list.length });
      this.say('THE DRAW: ' + list.length + ' joined... ' + this.fighters.map((f) => f.display).join(' and ') + ' are taking the penalties!');
      this.timer = setTimeout(() => this.matchup(), 5200);
      return;
    }
    this.matchup();
  }

  matchup() {
    if (this.tm) return this.teamMatchup();
    const M = MODES[this.mode];
    this.drawn = false;
    this.setup = this.mode === 'race' ? RL.raceSetup({ game: this.opts().game, disabled: this.opts().routesOff, tods: this.opts().raceTods, wx: this.opts().raceWx }) : null;
    this.team = 0;
    const o = this.opts(), secs = this.mode === 'shootout' ? (o.penBoostSecs != null ? o.penBoostSecs : 5) : o.boostSecs;
    this.phase = 'boost';
    this.endsAt = Date.now() + secs * 1000;
    this.push({ type: 'battle', mode: this.mode, label: this.bossMode && this.mode === 'shootout' ? 'BEAT THE BOSS' : M.label, boss: !!(this.bossMode && this.mode === 'shootout'), phase: 'matchup', fighters: this.cards(), setup: this.setup, secs, endsAt: this.endsAt, comp: this.mode === 'shootout' ? this.preComp() : undefined, team: this.team });
    this.say(this.bossMode && this.mode === 'shootout' ? this.fighters[0].display + ' vs THE BOSS! Shootout: ' + this.fighters[0].display + ' types L / C / R to shoot (add T or B for top / bottom: LT, RB...). AI keepers in both goals. Cheer bits with their name for ON TARGET shots.' : M.matchMsg(this.fighters, secs, this.opts().maxBoost, this.setup));
    this.timer = setTimeout(() => this.run(), secs * 1000);
  }

  preComp() { return this.fighters.map((f) => clampC(startComposure(this.card(f.key) || {}) + Math.min(COMP.maxChat, f.calm || 0))); }

  cards() {
    return this.fighters.map((f) => Object.assign({}, this.card(f.key), { boost: f.boost }));
  }

  // points: boost to add. text: message used to find who it's for (else the sender, if they're playing).
  boost(platform, login, points, text) {
    const so = this.mode === 'shootout', arc = this.mode === 'arc', race = this.mode === 'race';
    if (!(points > 0) || !(this.phase === 'boost' || (so && this.phase === 'shootout' && this.so) || (arc && this.phase === 'arc' && this.raid) || (race && this.phase === 'race' && this.race))) return false;
    // race, live: bits with "lightning" / "crash" / "rain" / "wind" = paid chaos (still capped per truck, usually hits the leader)
    if (race && this.race && text && text.trim()) {
      const t = String(text).toLowerCase();
      const kind = /lightning|strike/.test(t) ? 'lightning' : /crash|traffic/.test(t) ? 'traffic' : /\brain|storm/.test(t) ? 'rain' : /wind|gust/.test(t) ? 'wind' : null;
      if (kind && points >= 1) {
        const r = this.race.chaos(kind, null, true);   // nobody picks the target: usually the leader
        if (r && r.ok) return true;
      }
    }
    // queen raid: a cheer that says "time" buys extra time on the clock
    if (arc && this.raid && this.phase === 'arc' && text && /\b(time|clock|extra time|\+30)\b/i.test(text)) {
      const r = this.raid.extend(login, points);
      if (r && r.ok) return true;
    }
    if (this.tm) return (this.phase === 'boost' || this.phase === 'shootout') && this.teamBoost(platform, login, points, text);
    const isSub = !text;
    if (so && isSub) points = Math.min(points, 2);
    const key = this.resolveKey ? this.resolveKey(platform, login || '') : platform + ':' + String(login || '').toLowerCase();
    let f = null;
    if (text) {
      const t = String(text).toLowerCase();
      f = this.fighters.find((x) => t.includes(x.login) || t.includes(x.display.toLowerCase()));
    }
    if (!f) f = this.fighters.find((x) => x.key === key);
    if (!f) {
      // queen raid: support from someone not playing goes to the whole team
      if (!arc) return false;
      if (this.raid) {
        const r = this.raid.boost(-1, points);
        if (!r.team) return false;
        this.push({ type: 'battle', mode: 'arc', phase: 'boost', team: this.raid.team, points: r.team, from: login || '' });
        return true;
      }
      const add = Math.min(30 - this.team, points);
      if (add <= 0) return false;
      this.team += add;
      this.push({ type: 'battle', mode: 'arc', phase: 'boost', team: this.team, points: add, from: login || '' });
      return true;
    }
    const idx = this.fighters.indexOf(f);
    if (race && this.race) {
      const add = this.race.addFuel(idx, points);
      f.boost = this.race.d[idx].fuel;
      if (add) this.push({ type: 'battle', mode: 'race', phase: 'boost', side: idx, points: add, boosts: this.race.d.map((r) => r.fuel) });
      return add > 0;
    }
    if (arc && this.raid) {
      const r = this.raid.boost(idx, points);
      f.boost = this.raid.raiders[idx].w;
      this.push({ type: 'battle', mode: 'arc', phase: 'boost', side: idx, w: f.boost, from: login, big: points >= 5, points: r.add || 0, revived: !!r.revived, hp: r.hp, shield: r.shield });
      return true;
    }
    if (so && this.phase === 'shootout') {
      const st = this.so, sh = st.shields;
      const add = Math.min(this.opts().maxShields - sh[idx], points);
      const room = COMP.maxChat - st.compChat[idx];
      const calm = Math.min(room, isSub ? COMP.perSub : points * COMP.perBoost);
      if (add <= 0 && calm <= 0) return false;
      if (add > 0) sh[idx] += add;
      if (calm > 0) { st.compChat[idx] += calm; st.comp[idx] = clampC(st.comp[idx] + calm); }
      this.push({ type: 'battle', mode: this.mode, phase: 'boost', boosts: sh.slice(), comp: st.comp.slice(), side: idx, points: Math.max(0, add), calm });
      return true;
    }
    const max = so ? this.opts().maxShields : this.opts().maxBoost;
    if (f.boost >= max) return false;
    const add = Math.min(max - f.boost, points);
    f.boost += add;
    if (so) f.calm = (f.calm || 0) + (isSub ? COMP.perSub : add * COMP.perBoost);
    this.push({ type: 'battle', mode: this.mode, phase: 'boost', boosts: this.fighters.map((x) => x.boost), side: idx, points: add, team: this.team, comp: so ? this.preComp() : undefined, w: f.boost });
    return true;
  }

  run() {
    if (this.tm) return this.teamRun();
    if (this.mode === 'shootout') return this.runShootout();
    if (this.mode === 'arc') return this.runRaid();
    return this.runRace();
  }

  // ---------- truck race: live, one tick per second ----------
  runRace() {
    const M = MODES.race, opts = this.opts(), T = M.timing;
    this.phase = 'race';
    const cards = this.cards();
    this.race = new RL.RaceLive(cards, this.fighters.map((f) => f.boost), this.setup);
    this.race.queued = []; this.race.pendingHazards = [];
    const specials = this.race.specials();
    this.push({ type: 'battle', mode: 'race', label: M.label, phase: 'race', fighters: cards, setup: this.setup, timing: T, live: true, points: opts.points.race, turbo: RL.BAL.turbo.uses, leaderPct: Math.round(RL.BAL.chat.leaderChance * 100), specials, lanes: this.race.d.map((r) => r.lane), tanks: this.race.d.map((r) => Math.round(r.tank)) });
    const fighters = this.fighters;
    this.say('Cargo specials (type !special once): ' + fighters.map((f, i) => f.display + ' = ' + specials[i].name).join(', ') + '. Steer with L / R!');
    this.timer = setTimeout(() => {
      const loop = () => {
        const tk = this.race.tick();
        this.push(Object.assign({ type: 'battle', mode: 'race', phase: 'tick' }, tk));
        // nudge drivers to dodge when trouble hits
        for (const e of tk.ev) if (e.kind === 'forkwarn') this.say('FORK AHEAD! Drivers: L for the short cut (faster, roadworks), R for the motorway (fuel pads). Once you are in, a barrier keeps you there.');
        for (const e of tk.ev) if (!e.good && e.d >= 0 && RL.HAZARD.includes(e.kind) && this.sayTo) { const f = fighters[e.d]; if (f && !this.dodgeNag) { this.dodgeNag = true; this.sayTo(f.platform, '@' + f.display + ' ' + e.text + ' Type !dodge NOW!'); setTimeout(() => { this.dodgeNag = false; }, 4000); } }
        if (!this.race.done) { this.timer = setTimeout(loop, T.tick); return; }
        const sim = this.race.result();
        this.phase = 'result';
        this.push(Object.assign({ type: 'battle', mode: 'race', label: M.label, phase: 'result', fighters: cards, outroMs: T.outro, points: opts.points.race }, sim));
        this.say(M.resultMsg(fighters, sim));
        this.timer = setTimeout(() => { const mode = this.mode; this.reset(); this.reward(sim.order.map((i) => fighters[i]), mode, sim); }, T.outro);
      };
      loop();
    }, T.intro);
  }

  // ---------- queen raid: live co-op fight, one tick per second ----------
  runRaid() {
    const M = MODES.arc, opts = this.opts();
    this.phase = 'arc';
    const cards = this.cards();
    this.raid = new QueenRaid(cards, this.fighters.map((f) => f.boost));
    if (this.team) this.raid.boost(-1, this.team);
    // Raid Night: the War Chest filled all stream, and a Queen who gets stronger every time she wins
    const RM = this.raidMods; this.raidMods = null;
    if (RM) {
      const q = this.raid.queen, n = this.fighters.length;
      // a small squad gets a fairer Queen: her season strength is capped and she has less health (8 raiders = -10%, 4 = -20%)
      let k = RM.queenMult || 1;
      if (RM.fair !== false && n < 12) { k = Math.min(k, 1.25) * (0.7 + 0.025 * n); RM.fairNote = 'Small squad: the Queen is weaker tonight'; }
      if (k !== 1) { q.max = Math.round(q.max * k); q.hp = q.max; q.armourMax = Math.round(q.armourMax * k); q.armour = q.armourMax; }
      if (RM.fire) this.raid.boost(-1, RM.fire);
      if (RM.armour) for (const r of this.raid.raiders) r.shield = Math.min(ARC.TUNE.maxShield, r.shield + RM.armour * ARC.TUNE.shieldPerBoost);
      if (RM.time) this.raid.limit += RM.time;
      this.raid.warChest = RM;
    }
    const points = opts.raidPoints;
    this.push(Object.assign({ type: 'battle', mode: 'arc', label: RM ? 'RAID NIGHT' : M.label, phase: 'arc', fighters: cards, introMs: M.timing.intro, team: this.raid.team, points, warChest: RM || null }, this.raid.state()));
    this.say('DROP! ' + this.raid.map.label + ' (' + this.raid.cond.label + '). Clear the swarm, then kill the Veydr Queen. ' + Math.round(ARC.TUNE.timeLimit / 60 * 10) / 10 + ' minutes on the clock. Raiders: !fire (every ' + ARC.TUNE.fireCooldown + 's), !grenade, !heal. Bits / Kicks / Super Chats with a raider\'s name = more firepower, without a name = supply drop for everyone.');
    const fighters = this.fighters;
    this.timer = setTimeout(() => {
      const loop = () => {
        const tk = this.raid.tick();
        this.push(Object.assign({ type: 'battle', mode: 'arc', phase: 'tick' }, tk));
        if (!this.raid.done) { this.timer = setTimeout(loop, 1000); return; }
        const sim = this.raid.result(points);
        this.phase = 'result';
        this.push(Object.assign({ type: 'battle', mode: 'arc', label: M.label, phase: 'result', fighters: cards, outroMs: M.timing.outro }, sim));
        this.say(M.resultMsg(fighters, sim));
        this.timer = setTimeout(() => { this.reset(); this.reward(sim.order.map((i) => fighters[i]), 'arc', sim); }, M.timing.outro);
      };
      loop();
    }, M.timing.intro);
  }

  // ---------- penalty shootout: each player vs an AI keeper ----------
  // On their kick a player types L, C or R (or 1 / 2 / 3). Shots can go wide or over the bar
  // (less likely with a better card). Each "on target" token (bought with bits / Kicks /
  // Super Chats, 100 = 1) guarantees one kick hits the target. The AI keeper guesses at random.
  runShootout() {
    const M = MODES.shootout, T = M.timing, opts = this.opts();
    this.phase = 'shootout';
    const cards = this.cards();
    const compChat = this.fighters.map((f) => Math.min(COMP.maxChat, f.calm || 0));
    this.so = { cards, shields: this.fighters.map((f) => Math.min(opts.maxShields, f.boost)), score: [0, 0], taken: [0, 0], kicks: [], round: 1, turn: 0, aim: null,
      comp: cards.map((c, i) => clampC(startComposure(c) + compChat[i])), compChat, sd: false };
    this.push({ type: 'battle', mode: 'shootout', label: this.bossMode ? 'BEAT THE BOSS' : M.label, boss: !!this.bossMode, phase: 'shootout', fighters: cards, shields: this.so.shields, comp: this.so.comp, aimSecs: T.aim, rewards: { win: opts.points.shootout[0], lose: opts.points.shootout[1] } });
    if (this.bossMode) this.say('BEAT THE BOSS: ' + this.fighters[0].display + ', type L, C or R on your kick (LT = top left, RB = bottom right). AI keepers in both goals. Most goals from 5 wins.');
    else this.say('SHOOTOUT vs the AI keeper! On your kick type L, C or R (add T or B for top / bottom: LT, CB, RT... or 1-9 like a number pad). Better cards miss less. ' +
      'Watch your COMPOSURE: it drops every kick and crashes in sudden death. Cheer bits / Kicks / Super Chat with a player\'s name (100 = 1 ON TARGET shot + steadier nerves). Most goals from 5 wins.');
    this.timer = setTimeout(() => this.aimNext(), T.intro);
  }

  soDecided() {
    const st = this.so;
    const [t0, t1] = st.taken, [s0, s1] = st.score;
    if (t0 < 5 || t1 < 5) return s0 + (5 - t0) < s1 || s1 + (5 - t1) < s0;
    return t0 === t1 && s0 !== s1;
  }

  aimNext() {
    if (this.tm) return this.teamAimNext();
    const st = this.so, T = MODES.shootout.timing;
    if (this.soDecided() || (st.taken[0] === st.taken[1] && st.taken[0] >= 15)) return this.endShootout();
    const s = st.turn;
    st.round = st.taken[s] + 1;
    let shock = false;
    if (!st.sd && st.taken[0] >= 5 && st.taken[1] >= 5) {
      st.sd = true; shock = true;
      st.comp = st.comp.map((c) => clampC(c - COMP.sdShock));
    }
    const o = 1 - s;
    const must = st.taken[s] < 5 ? st.score[s] + (5 - st.taken[s] - 1) < st.score[o] : st.taken[s] + 1 === st.taken[o] && st.score[o] > st.score[s];
    // YouTube chat reaches the app several seconds late, so YouTube shooters get extra time
    const aimSecs = T.aim + (this.fighters[s].platform === 'youtube' ? SO.ytExtraSecs : 0);
    st.aim = { s, pick: null, keep: null, endsAt: Date.now() + aimSecs * 1000, must, crowd: 0, crowdBy: new Set(), chant: 0 };
    if (this.bossMode) {
      const v = this.fighters[0];
      this.push({ type: 'battle', mode: 'shootout', phase: 'aim', boss: true, bossRole: s === 1 ? 'shoot' : null, s, round: st.round, score: st.score.slice(), shields: st.shields.slice(), comp: st.comp.slice(), sd: st.sd, shock, must, endsAt: st.aim.endsAt, kicks: st.kicks });
      if (this.sayTo) this.sayTo(v.platform, '@' + v.display + (s === 0 ? ' your penalty! Type L, C or R, add T / B for top / bottom (LT, RB) (' + aimSecs + 's).' : ' the BOSS is shooting. The AI keeper is in goal for you!'));
      if (this.onBossTurn && s === 1) this.onBossTurn('shoot');
      this.timer = setTimeout(() => this.resolveKick(), aimSecs * 1000);
      return;
    }
    this.push({ type: 'battle', mode: 'shootout', phase: 'aim', s, round: st.round, score: st.score.slice(), shields: st.shields.slice(), comp: st.comp.slice(), sd: st.sd, shock, must, endsAt: st.aim.endsAt, kicks: st.kicks });
    const sh = this.fighters[s];
    if (this.sayTo) this.sayTo(sh.platform, '@' + sh.display + ' your penalty! L / C / R, add T or B for top / bottom (LT, RB, T) (' + aimSecs + 's). No pick = you miss!' + (st.shields[s] ? ' · ' + st.shields[s] + ' on-target shot' + (st.shields[s] > 1 ? 's' : '') + ' left' : ''));
    this.timer = setTimeout(() => this.resolveKick(), aimSecs * 1000);
  }

  // chat input during a kick. Returns true if it was used.
  aimInput(platform, login, text) {
    if (this.phase !== 'shootout' || !this.so || !this.so.aim) return false;
    // any small variation counts, so chat's "same message twice" filter never blocks a pick: L, l, left, L1, L!, go left, !l
    // v29: add a height: LT / TL / L TOP (top left), LB / BL (bottom left), T (top centre), B (bottom centre), or 1-9 like a number pad
    const sh = parseShot(text);
    if (!sh) return false;
    const key = this.resolveKey ? this.resolveKey(platform, login) : platform + ':' + String(login).toLowerCase();
    const aim = this.so.aim;
    if (this.bossMode) {
      if (this.fighters[0].key !== key) return false;
      if (aim.s !== 0) return true;   // the Boss is shooting: the AI keeper is in goal, nothing to type
      if (aim.pick) return true; aim.pick = sh.d; aim.h = sh.h; this.push({ type: 'battle', mode: 'shootout', phase: 'lock', role: 'shooter', hidden: true });
      if (this.bossReady(aim)) { clearTimeout(this.timer); this.timer = setTimeout(() => this.resolveKick(), 700); }
      return true;
    }
    if (this.fighters[aim.s].key !== key || aim.pick) return this.fighters.some((f) => f.key === key);
    aim.pick = sh.d; aim.h = sh.h;
    this.push({ type: 'battle', mode: 'shootout', phase: 'lock', role: 'shooter', dir: aim.pick, h: aim.h, zone: zoneOf(aim.pick, aim.h) });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.resolveKick(), 700);
    return true;
  }

  // Beat the Boss: AI keepers in both goals, so the kick goes the moment the shooter picks (no waiting for the bar)
  bossReady(aim) { return !!aim.pick; }
  // the Boss's own buttons (dock / phone / Stream Deck): shoot L / C / R on his kick
  bossInput(dir) {
    if (!this.bossMode || this.phase !== 'shootout' || !this.so || !this.so.aim) return { error: 'No Beat the Boss kick right now' };
    const aim = this.so.aim, sh = parseShot(dir) || { d: 'C', h: 'M' }, d = sh.d;
    if (aim.s !== 1) return { error: 'It\'s their kick: the AI keeper is in goal' };
    if (aim.pick) return { error: 'Already picked' }; aim.pick = d; aim.h = sh.h;
    if (this.bossLearn) this.bossLearn('shoot', d);
    this.push({ type: 'battle', mode: 'shootout', phase: 'lock', role: 'shooter', boss: true, hidden: true });   // no direction on screen: the other side would see it
    if (this.bossReady(aim)) { clearTimeout(this.timer); this.timer = setTimeout(() => this.resolveKick(), 700); }
    return { ok: true, role: 'shoot', dir: d, h: sh.h, zone: zoneOf(d, sh.h) };
  }

  // ---------- chat inputs for every battle. Returns true if the message was used. ----------
  // who: viewer key. Players and non-players get different commands.
  chatInput(platform, login, text) {
    const raw = String(text || '').trim(), t = raw.toLowerCase();
    const key = this.resolveKey ? this.resolveKey(platform, login) : platform + ':' + String(login).toLowerCase();
    const idx = this.fighters.findIndex((f) => f.key === key);
    if (this.tm && /^!order\b/.test(t)) return this.teamOrder(platform, login, raw);
    // ----- shootout -----
    if (this.mode === 'shootout' && this.phase === 'shootout' && this.so) {
      if (this.aimInput(platform, login, raw)) return true;
      const aim = this.so.aim;
      const m = /^!(boo|whistle|flare|firework|fireworks|horn|drum|chant|flash|flashes|camera|photo|laser|lasers|pointer)\b/.exec(t);
      if (!m || !aim || idx === aim.s) return !!m;
      if (aim.crowdBy.has(key)) return true;
      aim.crowdBy.add(key);
      const st = this.so;
      if (m[1] === 'chant') {
        // support the shooter (or a named player)
        if (aim.chant >= COMP.crowdChantMax) return true;
        aim.chant += 1; st.comp[aim.s] = clampC(st.comp[aim.s] + SO.chantGain);
        this.push({ type: 'battle', mode: 'shootout', phase: 'crowd', kind: 'chant', by: login, comp: st.comp.slice(), side: aim.s, cost: SO.chantGain });
        return true;
      }
      if (idx >= 0 && idx !== aim.s) { /* the other player can try to put them off too */ }
      if (aim.crowd >= COMP.crowdMax) { this.push({ type: 'battle', mode: 'shootout', phase: 'crowd', kind: m[1].replace(/s$/, ''), by: login, comp: st.comp.slice(), side: aim.s, capped: true }); return true; }
      const kind = /^(flash|flashes|camera|photo)$/.test(m[1]) ? 'flash' : /^(laser|lasers|pointer)$/.test(m[1]) ? 'laser' : m[1].replace(/s$/, '').replace('whistle', 'boo');
      const d = Math.min(COMP.crowdMax - aim.crowd, kind === 'flare' || kind === 'firework' ? SO.flareCost : kind === 'flash' ? SO.flashCost : kind === 'laser' ? SO.laserCost : SO.booCost);
      aim.crowd += d; st.comp[aim.s] = clampC(st.comp[aim.s] - d);
      this.push({ type: 'battle', mode: 'shootout', phase: 'crowd', kind, by: login, comp: st.comp.slice(), side: aim.s, cost: d });
      return true;
    }
    // ----- truck race -----
    if (this.mode === 'race' && this.phase === 'race' && this.race) {
      const R = this.race;
      if (idx >= 0) {
        if (/^!(turbo|boost|nitro)(?![a-z])/.test(t)) { const r = R.turbo(idx); if (r && r.msg && this.sayTo) this.sayTo(platform, '@' + this.fighters[idx].display + ' ' + r.msg); return true; }
        if (/^!(dodge|swerve|brake)(?![a-z])/.test(t)) { R.dodge(idx); return true; }
        // lanes: L / R / L2 / R2 / M (any small variation, so chat's duplicate filter never blocks a move)
        const lm = /^!?(l|left|r|right|m|mid|middle|centre|center)\s*([12])?(?:[\s!.?,*~+_-]*)$/.exec(t);
        if (lm) {
          const r = R.d[idx], w = lm[1], n = +(lm[2] || 1);
          const to = /^(m|mid|middle|centre|center)$/.test(w) ? 1 : r.lane + (/^l/.test(w) ? -n : n);
          R.steer(idx, to); return true;
        }
        if (/^!(special|cargo|sp)(?![a-z])/.test(t)) { const r = R.special(idx); if (r && r.msg && this.sayTo) this.sayTo(platform, '@' + this.fighters[idx].display + ' ' + r.msg); return true; }
        if (/^!(horn|honk|beep)(?![a-z])/.test(t)) { R.horn(idx); return true; }
        return false;
      }
      const m = /^!(rain|wind|lightning|traffic|crash)\b/.exec(t);
      if (!m) return false;
      const kind = m[1] === 'crash' ? 'traffic' : m[1];
      const r = R.chaos(kind, key, false);
      if (r && r.msg && this.sayTo && !this.nagCool) { this.nagCool = true; setTimeout(() => { this.nagCool = false; }, 5000); this.sayTo(platform, '@' + login + ' ' + r.msg); }
      return true;
    }
    // ----- queen raid -----
    if (this.mode === 'arc' && this.phase === 'arc' && this.raid) {
      if (/^!(time|extratime|clock)(?![a-z])/.test(t)) {
        if (!ARC.TUNE.freeTime) return true;
        if (this.raid.timeBuyers.has(key)) return true;
        this.raid.timeBuyers.add(key);
        this.raid.extend(login, null);
        return true;
      }
      if (idx < 0) return false;
      if (/^(!fire|!f|!shoot|!pew|pew+|f)$/.test(t) || /^!(fire|shoot|f)(?![a-z])/.test(t)) {   // !fire2, !fire!, !f1 etc. also count
        // per-raider cooldown so !fire isn't chat spam (Twitch also drops fast repeats)
        const now = Date.now(), cd = (this.fireCd || (this.fireCd = new Map()));
        if (now < (cd.get(key) || 0)) return true;
        cd.set(key, now + ARC.TUNE.fireCooldown * 1000);
        this.raid.fire(idx); return true;
      }
      if (/^!(grenade|nade|g)(?![a-z])/.test(t)) { const r = this.raid.grenade(idx); if (r && r.msg && this.sayTo && !this.nagCool) { this.nagCool = true; setTimeout(() => { this.nagCool = false; }, 5000); this.sayTo(platform, '@' + this.fighters[idx].display + ' ' + r.msg); } return true; }
      if (/^!(heal|medic|h)(?![a-z])/.test(t)) { this.raid.heal(idx); return true; }
      return false;
    }
    return false;
  }

  resolveKick() {
    const st = this.so, aim = st.aim, T = MODES.shootout.timing;
    if (!aim) return;
    st.aim = null;
    const s = aim.s, ovr = st.cards[s].ovr;
    // Beat the Boss: if the Boss didn't press a button, the AI picks for him (in his usual style)
    if (this.bossMode && s === 1 && !aim.pick) { aim.pick = this.bossAuto ? this.bossAuto('shoot') : pick(['L', 'C', 'R']); aim.h = pick(ROWS); }
    const dir = aim.pick || pick(['L', 'C', 'R']);
    const noPick = !aim.pick;   // no input = the shot is scuffed and misses
    const h = aim.pick ? (aim.h || 'M') : pick(ROWS);
    let target = zoneOf(dir, h);
    const shield = st.shields[s] > 0 && !!aim.pick;
    if (shield && aim.pick) st.shields[s]--;
    // composure: below ~55 the nerves show, above it the player is ice cold
    const o = 1 - s;
    const eff = st.comp[s] - (aim.must ? COMP.mustScore : 0);
    const nerves = Math.max(-0.6, Math.min(1, (55 - eff) / 55));
    // accuracy from the card: OVR 40 misses ~24% of the time, OVR 99 ~3%. Top corners miss most, centre least.
    const missP = Math.min(0.9, Math.max(0.01, (0.16 - (ovr - 40) * 0.0025) * (1 + nerves * 0.5)) * missMul(dir, h) * soK);
    // the keeper reads you: every centre kick in a row by this player makes him stay put more often
    st.cRun = st.cRun || [0, 0];
    const stay = Math.min(85, SO.keeperCentre + SO.keeperReads * st.cRun[s]);
    const side = (100 - stay) / 200, kr = rnd();
    st.cRun[s] = dir === 'C' ? st.cRun[s] + 1 : 0;
    let kDir = kr < side ? 'L' : kr < side * 2 ? 'R' : 'C';   // AI keeper: dives left / right, or stays in the centre (keeperCentre %)
    const rows = keeperRows(), hr = rnd();
    let kH = hr < rows.T ? 'T' : hr < rows.T + rows.M ? 'M' : 'B';  // ...and guesses a height
    if (eff < 35 && rnd() < (35 - eff) / 100) { kDir = dir; kH = h; }   // a nervous run-up gives it away
    let result, dive;
    if (noPick || (!shield && rnd() < missP)) {
      result = 'miss';
      // the miss goes where they aimed: wide, or over the bar from a high shot
      const over = h === 'T' ? rnd() < 0.75 : h === 'M' ? rnd() < 0.35 : false;
      target = dir === 'L' ? (over ? 'OVERL' : 'WL') : dir === 'R' ? (over ? 'OVERR' : 'WR') : 'OVER';
      dive = kDir === 'C' ? 'STAY' : zoneOf(kDir, kH);
    } else if (kDir === dir) {
      // right way: the save chance depends on the zone (top corner hardest) and how close his height guess was
      const base = Math.max(0, Math.min(0.97, (baseSave(dir, h) - (ovr - 60) * 0.003 + nerves * 0.1) * soK + (shield ? SO.onTargetSave / 100 : 0)));   // a safe, guaranteed-on-target shot is easier to save
      const saveP = Math.max(0.03, Math.min(0.97, base * (dir === 'C' ? 1 : reach(kH, h))));
      result = rnd() < saveP ? 'save' : 'goal';
      dive = dir === 'C' ? 'STAY' : (result === 'save' ? target : zoneOf(kDir, kH));
    } else {
      result = 'goal';
      dive = kDir === 'C' ? 'STAY' : zoneOf(kDir, kH);
    }
    st.taken[s]++;
    if (result === 'goal') st.score[s]++;
    const compBefore = st.comp.slice();
    st.comp[s] = clampC(st.comp[s] - (st.sd ? COMP.sdDrain : COMP.drain) + (result === 'goal' ? COMP.goal : -COMP.fail));
    if (!this.tm) st.comp[o] = clampC(st.comp[o] + (result === 'goal' ? -COMP.oppGoal : COMP.oppFail));
    // a save is either held (catch) or pushed away (parry); centre shots are usually held
    const hold = result === 'save' && rnd() < (dir === 'C' ? 0.8 : 0.45);
    const crowd = aim.crowd || 0;
    const kick = { s, round: st.round, dir, h, zone: zoneOf(dir, h), result, hold, target, dive, shield, noPick, crowd, picked: !!aim.pick, score: st.score.slice(), shields: st.shields.slice(), comp: st.comp.slice(), compBefore, must: !!aim.must, nerves: eff < 35 };
    if (this.tm) { kick.pi = aim.pi; kick.auto = !!aim.auto; st.pcomp[this.fighters[s].key] = st.comp[s]; st.last = s; st.kicks.push(kick); this.push(Object.assign({ type: 'battle', mode: 'shootout', phase: 'kick', k: kick }, this.teamState())); this.timer = setTimeout(() => this.teamAimNext(), T.kick); return; }
    st.kicks.push(kick);
    this.push({ type: 'battle', mode: 'shootout', phase: 'kick', k: kick });
    st.turn = 1 - s;
    this.timer = setTimeout(() => this.aimNext(), T.kick);
  }

  endShootout() {
    if (this.tm) return;
    const st = this.so, M = MODES.shootout, opts = this.opts();
    const winner = st.score[0] > st.score[1] ? 0 : st.score[1] > st.score[0] ? 1 : (rnd() < 0.5 ? 0 : 1);
    const sim = { score: st.score, winner, order: [winner, 1 - winner], kicks: st.kicks };
    const fighters = this.fighters;
    this.phase = 'result';
    this.push({ type: 'battle', mode: 'shootout', label: this.bossMode ? 'BEAT THE BOSS' : M.label, boss: !!this.bossMode, phase: 'result', fighters: st.cards, winner, score: st.score, outroMs: M.timing.outro, rewards: { win: opts.points.shootout[0], lose: opts.points.shootout[1] } });
    if (this.bossMode) { this.say(winner === 0 ? fighters[0].display + ' BEATS THE BOSS ' + st.score[0] + '-' + st.score[1] + '!' : 'The Boss survives ' + st.score[1] + '-' + st.score[0] + ' against ' + fighters[0].display + '.'); if (this.onBoss) { try { this.onBoss({ viewer: fighters[0], viewerWon: winner === 0, score: st.score.slice() }); } catch (e) { /* ignore */ } } }
    else this.say(M.resultMsg(fighters, sim));
    this.timer = setTimeout(() => { this.reset(); this.reward([fighters[winner], fighters[1 - winner]], 'shootout', sim); }, M.timing.outro);
  }

  // ======================= TEAM SHOOTOUT (3 v 3 / 5 v 5) =======================
  // Sides take turns like a real shootout, AI keeper in every goal. Each side has 3 or 5 viewers;
  // the shooter of the moment sits in this.fighters[side] so the normal kick code (cards, composure,
  // on-target shots, crowd) works unchanged.
  tcfg() { const c = (this.teamCfg && this.teamCfg()) || {}; return { size: c.size === 3 ? 3 : 5, make: ['redblue', 'platform', 'clubs', 'random'].includes(c.make) ? c.make : 'redblue', order: ['rating', 'joined', 'captain'].includes(c.order) ? c.order : 'rating', subsFirst: c.subsFirst !== false, boosts: c.boosts !== false, clubs: Array.isArray(c.clubs) && c.clubs.length === 2 ? c.clubs : ['random', 'random'], joinSecs: Math.max(20, Math.min(180, +c.joinSecs || 60)) }; }
  teamDefs(make, C) {
    const words = (n) => { const w = String(n).toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 1); return w.concat([w.map((x) => x[0]).join('')]); };
    if (make === 'platform') return [{ id: 'twitch', name: 'TWITCH', color: '#9146ff', words: ['twitch', 'tw'], kit: 'twitch' }, { id: 'kick', name: 'KICK', color: '#53fc18', words: ['kick'], kit: 'kick' }, { id: 'youtube', name: 'YOUTUBE', color: '#ff2d2d', words: ['youtube', 'yt'], kit: 'youtube' }];
    // the streamer's Pro Clubs teams (public/kits.js): the two picked in settings, or two drawn at random
    const def = (k) => ({ id: k.id, name: k.name.toUpperCase().slice(0, 18), color: k.ui, words: k.words.slice(), kit: k.id });
    let pair = KITS.pair();
    if (make === 'clubs') {
      const a = KITS.find(C.clubs[0]), b = KITS.find(C.clubs[1]);
      if (a && b && a !== b) pair = [a, b];
      else if (a) pair = [a, KITS.KITS.filter((k) => k !== a && !KITS.near(k, a))[Math.floor(Math.random() * 6)] || pair[1]];
      else if (b) pair = [KITS.KITS.filter((k) => k !== b && !KITS.near(k, b))[Math.floor(Math.random() * 6)] || pair[0], b];
      // a typed name that isn't one of the 12 clubs still works, it just gets a plain kit
      if (!a && String(C.clubs[0] || '').trim() && !/^random$/i.test(C.clubs[0])) return [{ id: 'c0', name: String(C.clubs[0]).toUpperCase().slice(0, 18), color: pair[0].ui, words: words(C.clubs[0]), kit: pair[0].id }, def(pair[1])];
    }
    return pair.map(def);
  }
  openTeams(extra, o) {
    if (this.phase !== 'idle') return false;
    const C = this.tcfg(); o = o || {};
    const size = o.size === 3 || o.size === 5 ? o.size : C.size, make = ['redblue', 'platform', 'clubs', 'random'].includes(o.make) ? o.make : C.make;
    this.tm = { size, make, order: C.order, subsFirst: C.subsFirst, boosts: C.boosts, defs: this.teamDefs(make, C), joined: new Map(), shields: [], test: !!o.test, paused: false };
    this.mode = 'shootout'; this.phase = 'join'; this.joiners.clear(); this.fighters = [];
    const secs = o.test ? 12 : C.joinSecs;
    this.endsAt = Date.now() + secs * 1000;
    this.push(Object.assign({ type: 'battle', mode: 'shootout', label: size + ' v ' + size + ' PENALTY SHOOTOUT', phase: 'join', secs, endsAt: this.endsAt }, this.teamLobby()));
    const how = make === 'random' ? 'Type !join: teams are drawn and balanced by card rating.' : make === 'platform' ? 'Type !join: you play for your platform (Twitch v Kick v YouTube).' :
      'Type ' + this.tm.defs.map((d) => '!join ' + d.words[0]).join(' or ') + ' (just !join = wherever you\'re needed).';
    this.say(size + ' v ' + size + ' PENALTY SHOOTOUT! ' + how + ' ' + secs + ' seconds to get in.');
    this.timer = setTimeout(() => this.teamPick(), secs * 1000);
    if (extra) extra();
    return true;
  }
  teamWant(platform, arg) {
    const T = this.tm;
    if (T.make === 'platform') return T.defs.find((d) => d.id === platform) ? platform : null;
    if (T.make === 'random') return null;
    const a = String(arg || '').toLowerCase().trim();
    if (!a) return null;
    const d = T.defs.find((x) => x.words.includes(a) || x.words.some((w) => w.length > 2 && a.startsWith(w)));
    return d ? d.id : null;
  }
  teamJoin(platform, login, display, arg, o) {
    const T = this.tm;
    this.ensure(platform, login, display);
    const key = this.resolveKey ? this.resolveKey(platform, login) : platform + ':' + String(login).toLowerCase();
    const want = this.teamWant(platform, arg);
    const had = T.joined.get(key);
    if (had) { if (want && had.want !== want) { had.want = want; this.push(Object.assign({ type: 'battle', mode: 'shootout', phase: 'count', count: T.joined.size, last: had.display }, this.teamLobby())); } return; }
    T.joined.set(key, { key, platform, login: String(login).toLowerCase(), display: display || login, want, at: Date.now(), test: !!(o && o.test), sub: !!(this.isSub && this.isSub(key)) });
    this.joiners.set(key, T.joined.get(key));
    this.push(Object.assign({ type: 'battle', mode: 'shootout', phase: 'count', count: T.joined.size, last: display || login }, this.teamLobby()));
    if (this.onJoin && !(o && o.test)) { try { this.onJoin(platform, display || login, T.joined.size); } catch (e) { /* ignore */ } }
    this.joinTick();
  }
  // who plays where. final = fill the gaps (bench, then AI) and fix the order
  teamAssign(final) {
    const T = this.tm, N = T.size;
    let defs = T.defs.slice();
    let list = Array.from(T.joined.values());
    if (T.subsFirst) list = list.slice().sort((a, b) => (b.sub ? 1 : 0) - (a.sub ? 1 : 0) || a.at - b.at);
    if (final && T.make === 'platform') {
      const used = defs.filter((d) => list.some((j) => j.want === d.id));
      if (used.length >= 2) defs = used;
      else { defs = this.teamDefs('redblue', this.tcfg()); list = list.map((j) => Object.assign({}, j, { want: null })); }
    }
    const sides = defs.map((d) => Object.assign({}, d, { players: [] })), bench = [];
    const ovr = (j) => ((this.card(j.key) || {}).ovr || 50);
    if (T.make === 'random' && final) {
      const pool = list.slice().sort((a, b) => ovr(b) - ovr(a));
      // snake draft by card rating: 1-2, 2-1 ... keeps the sides even
      pool.forEach((j, i) => { const r = Math.floor(i / sides.length), k = i % sides.length, s = sides[r % 2 ? sides.length - 1 - k : k]; if (s.players.length < N) s.players.push(j); else bench.push(j); });
    } else {
      const loose = [];
      for (const j of list) { const s = j.want && sides.find((x) => x.id === j.want); if (!s) loose.push(j); else if (s.players.length < N) s.players.push(j); else bench.push(j); }
      for (const j of loose) { const s = sides.filter((x) => x.players.length < N).sort((a, b) => a.players.length - b.players.length)[0]; if (s) s.players.push(j); else bench.push(j); }
    }
    if (final) {
      // gaps: bench players first, then the AI
      for (const s of sides) while (s.players.length < N && bench.length) s.players.push(bench.shift());
      let n = 0;
      const BOTS = ['AI ROBO', 'AI SPARKY', 'AI BOLT', 'AI DYNAMO', 'AI CIRCUIT', 'AI GIGA', 'AI PIXEL', 'AI TURBO', 'AI VECTOR', 'AI ZAPPER', 'AI NEON', 'AI COBALT', 'AI ROTOR', 'AI LASER', 'AI QUARK'];
      for (const s of sides) while (s.players.length < N) { s.players.push({ key: 'ai:' + n, display: BOTS[n % BOTS.length], bot: true, ovr: 52 + Math.floor(rnd() * 12) }); n++; }
      for (const s of sides) {
        if (T.order === 'rating') s.players.sort((a, b) => (a.bot ? a.ovr : ovr(a)) - (b.bot ? b.ovr : ovr(b)));   // best player takes the last kick
        s.captain = (s.players.find((p) => !p.bot) || {}).key || null;
      }
    }
    return { sides, bench };
  }
  teamCard(p) {
    if (p.bot) return { key: p.key, display: p.display, ovr: p.ovr, tier: 'bronze', stats: { LOY: 40 }, bot: true };
    return Object.assign({}, this.card(p.key) || { display: p.display, ovr: 50, tier: 'bronze', stats: {} }, { key: p.key });
  }
  teamLobby() {
    const T = this.tm, A = this.teamAssign(false);
    return { teams: { size: T.size, make: T.make, lobby: true, sides: A.sides.map((s) => ({ id: s.id, name: s.name, color: s.color, word: s.words[0], players: s.players.map((p) => ({ display: p.display, platform: p.platform })) })), bench: A.bench.map((p) => p.display).slice(0, 12) } };
  }
  teamPick() {
    const T = this.tm;
    const humans = Array.from(T.joined.values());
    if (humans.length < 2 && !T.test) {
      this.push({ type: 'battle', mode: 'shootout', phase: 'cancel', reason: 'Not enough players joined (2 or more needed)' });
      this.say('Not enough players joined the team shootout. Next time!');
      return this.reset();
    }
    const A = this.teamAssign(true);
    T.sides = A.sides; T.bench = A.bench;
    T.shields = T.sides.map(() => 0);
    this.fighters = T.sides.map((s) => s.players[0]);
    this.teamMatchup();
  }
  teamMatchup() {
    const T = this.tm, o = this.opts(), secs = T.test ? 5 : Math.max(T.order === 'captain' ? 15 : 0, o.penBoostSecs != null ? o.penBoostSecs : 5);
    this.phase = 'boost';
    this.endsAt = Date.now() + secs * 1000;
    this.push(Object.assign({ type: 'battle', mode: 'shootout', label: T.size + ' v ' + T.size + ' PENALTY SHOOTOUT', phase: 'matchup', secs, endsAt: this.endsAt, fighters: this.fighters.map((p) => this.teamCard(p)) }, this.teamState()));
    this.say('LINE-UPS: ' + T.sides.map((s) => s.name + ': ' + s.players.map((p) => p.display).join(', ')).join(' · ') +
      (T.order === 'captain' ? ' · Captains (' + T.sides.map((s) => (s.players.find((p) => p.key === s.captain) || {}).display || 'none').join(', ') + '): type !order name name name to set your kicking order.' : '') +
      (T.boosts ? ' · Cheer bits / Kicks / Super Chat with "' + T.sides.map((s) => s.words[0]).join('" or "') + '" for ON TARGET shots.' : ''));
    this.timer = setTimeout(() => this.teamRun(), secs * 1000);
  }
  teamState(extra) {
    const T = this.tm, st = this.so;
    const res = (si, pi) => (st ? st.kicks.filter((k) => k.s === si && k.pi === pi).map((k) => (k.result === 'goal' ? 'g' : 'm')) : []);
    return Object.assign({ teams: { size: T.size, make: T.make, order: T.order, sides: (T.sides || []).map((s, si) => ({ id: s.id, name: s.name, color: s.color, word: s.words[0], kit: s.kit || null,
      score: st ? st.score[si] : 0, taken: st ? st.taken[si] : 0, shields: st ? st.shields[si] : T.shields[si] || 0, out: st ? !st.alive.includes(si) : false,
      players: s.players.map((p, pi) => { const c = this.teamCard(p); return { display: p.display, platform: p.platform || null, bot: !!p.bot, ovr: c.ovr, tier: c.tier, captain: p.key === s.captain, res: res(si, pi) }; }) })),
      shooter: st && st.aim ? { side: st.aim.s, idx: st.aim.pi } : null, next: st ? this.teamNextInfo() : null, sd: st ? st.sd : false, paused: !!T.paused } }, extra || {});
  }
  teamOrder(platform, login, text) {
    const T = this.tm; if (!T || T.order !== 'captain' || this.phase !== 'boost' || !T.sides) return false;
    const key = this.resolveKey ? this.resolveKey(platform, login) : platform + ':' + String(login).toLowerCase();
    const s = T.sides.find((x) => x.captain === key); if (!s) return false;
    const want = String(text).replace(/^!order\s*/i, '').toLowerCase().split(/[\s,]+/).filter(Boolean);
    const out = [];
    for (const w of want) { const p = s.players.find((x) => !out.includes(x) && x.display.toLowerCase().replace(/^@/, '').startsWith(w.replace(/^@/, ''))); if (p) out.push(p); }
    if (!out.length) return true;
    s.players = out.concat(s.players.filter((p) => !out.includes(p)));
    this.fighters = T.sides.map((x) => x.players[0]);
    this.push(Object.assign({ type: 'battle', mode: 'shootout', phase: 'order', side: T.sides.indexOf(s) }, this.teamState()));
    if (this.sayTo) this.sayTo(platform, s.name + ' kicking order: ' + s.players.map((p) => p.display).join(', '));
    return true;
  }
  teamRun() {
    const T = this.tm, opts = this.opts(), K = T.sides.length;
    this.phase = 'shootout';
    const pcomp = {};
    for (const s of T.sides) for (const p of s.players) pcomp[p.key] = clampC(startComposure(this.teamCard(p)));
    this.so = { cards: T.sides.map((s) => this.teamCard(s.players[0])), shields: T.shields.slice(), score: Array(K).fill(0), taken: Array(K).fill(0), kicks: [], round: 1, turn: 0, aim: null,
      comp: T.sides.map((s) => pcomp[s.players[0].key]), compChat: Array(K).fill(0), sd: false, alive: T.sides.map((_, i) => i), pcomp, cRun: Array(K).fill(0), last: -1 };
    this.push(Object.assign({ type: 'battle', mode: 'shootout', label: T.size + ' v ' + T.size + ' PENALTY SHOOTOUT', phase: 'shootout', fighters: this.so.cards, shields: this.so.shields, comp: this.so.comp, aimSecs: MODES.shootout.timing.aim }, this.teamState()));
    this.say('KICK OFF! Shooters: type L, C or R when it\'s your kick, add T or B for top / bottom (LT, RB) (no pick = a miss). AI keeper in goal. Crowd: !boo !horn !flash to put the shooter off, !chant to back them.');
    this.timer = setTimeout(() => this.teamAimNext(), MODES.shootout.timing.intro);
  }
  // whose kick is next: the side (still in it) that has taken the fewest, going round in order
  teamNextSide() {
    const st = this.so, K = this.tm.sides.length;
    const min = Math.min(...st.alive.map((i) => st.taken[i]));
    for (let d = 1; d <= K; d++) { const i = (st.last + d + K) % K; if (st.alive.includes(i) && st.taken[i] === min) return i; }
    return st.alive[0];
  }
  teamNextInfo() {
    const st = this.so; if (!st) return null;
    try { const s = this.teamNextSide(); return { side: s, idx: st.taken[s] % this.tm.size }; } catch (e) { return null; }
  }
  // -1 = keep going, else the winning side
  teamDecided() {
    const st = this.so, N = this.tm.size, A = st.alive;
    const regulation = A.some((i) => st.taken[i] < N);
    if (regulation) {
      for (const i of A) if (A.every((j) => j === i || st.score[j] + Math.max(0, N - st.taken[j]) < st.score[i])) return i;
      return -1;
    }
    if (!A.every((i) => st.taken[i] === st.taken[A[0]])) return -1;     // finish the round first
    const top = Math.max(...A.map((i) => st.score[i])), tied = A.filter((i) => st.score[i] === top);
    if (tied.length === 1) return tied[0];
    if (st.taken[A[0]] >= N + 10) return tied[Math.floor(rnd() * tied.length)];
    if (!st.sd) { st.sd = true; st.shock = true; for (const k of Object.keys(st.pcomp)) st.pcomp[k] = clampC(st.pcomp[k] - COMP.sdShock); }
    st.alive = tied;
    return -1;
  }
  teamAimNext() {
    const T = this.tm, st = this.so, MT = MODES.shootout.timing;
    if (!T || !st) return;
    if (T.paused) { this.timer = setTimeout(() => this.teamAimNext(), 1000); return; }
    const w = this.teamDecided();
    if (w >= 0) return this.teamEnd(w);
    const s = this.teamNextSide(), pi = st.taken[s] % T.size, p = T.sides[s].players[pi];
    this.fighters[s] = p; st.cards[s] = this.teamCard(p); st.comp[s] = st.pcomp[p.key];
    st.round = st.taken[s] + 1;
    const shock = !!st.shock; st.shock = false;
    const aimSecs = MT.aim + (p.platform === 'youtube' ? SO.ytExtraSecs : 0);
    st.aim = { s, pi, pick: null, keep: null, endsAt: Date.now() + aimSecs * 1000, must: false, crowd: 0, crowdBy: new Set(), chant: 0 };
    this.push(Object.assign({ type: 'battle', mode: 'shootout', phase: 'aim', s, round: st.round, score: st.score.slice(), shields: st.shields.slice(), comp: st.comp.slice(), sd: st.sd, shock, must: false, endsAt: st.aim.endsAt, kicks: st.kicks, shooter: st.cards[s] }, this.teamState()));
    if (p.bot || p.test) {
      const aim = st.aim;
      setTimeout(() => { if (this.so && this.so.aim === aim && !aim.pick) { aim.pick = pick(['L', 'C', 'R', 'L', 'R']); aim.h = pick(['T', 'M', 'B']); clearTimeout(this.timer); this.timer = setTimeout(() => this.resolveKick(), 700); } }, 1500 + rnd() * 2000);
    } else if (this.sayTo) this.sayTo(p.platform, '@' + p.display + ' your penalty for ' + T.sides[s].name + '! L / C / R, add T or B for top / bottom (LT, RB) (' + aimSecs + 's). No pick = you miss!' + (st.shields[s] ? ' · ' + st.shields[s] + ' on-target shot' + (st.shields[s] > 1 ? 's' : '') + ' left for your team' : ''));
    this.timer = setTimeout(() => this.resolveKick(), aimSecs * 1000);
  }
  teamSkip() {
    const st = this.so; if (!this.tm || !st || !st.aim) return { error: 'Nobody is taking a kick right now' };
    const aim = st.aim; if (aim.pick) return { error: 'They already picked' };
    aim.pick = pick(['L', 'C', 'R']); aim.h = pick(['T', 'M', 'B']); aim.auto = true;
    clearTimeout(this.timer); this.timer = setTimeout(() => this.resolveKick(), 500);
    return { ok: true, who: this.fighters[aim.s].display };
  }
  teamPause(on) { if (!this.tm) return { error: 'No team shootout running' }; this.tm.paused = on == null ? !this.tm.paused : !!on; this.push(Object.assign({ type: 'battle', mode: 'shootout', phase: 'paused' }, this.teamState())); return { ok: true, paused: this.tm.paused }; }
  teamBoost(platform, login, points, text) {
    const T = this.tm; if (!T.boosts || !T.sides) return false;
    const t = String(text || '').toLowerCase();
    let si = -1;
    if (t) si = T.sides.findIndex((s) => s.words.some((w) => w.length > 1 && new RegExp('\\b' + w + '\\b').test(t)));
    const key = this.resolveKey ? this.resolveKey(platform, login || '') : platform + ':' + String(login || '').toLowerCase();
    if (si < 0) si = T.sides.findIndex((s) => s.players.some((p) => p.key === key));
    if (si < 0) return false;
    const sh = this.so ? this.so.shields : T.shields;
    const add = Math.min(this.opts().maxShields - sh[si], text ? points : Math.min(points, 2));
    if (add <= 0) return false;
    sh[si] += add;
    this.push(Object.assign({ type: 'battle', mode: 'shootout', phase: 'boost', side: si, points: add, from: login || '', boosts: sh.slice() }, this.teamState()));
    return true;
  }
  teamEnd(w) {
    const T = this.tm, st = this.so, opts = this.opts(), MT = MODES.shootout.timing;
    this.phase = 'result';
    // MVP: the sudden-death winner, else the winning side's top scorer (later goals count more)
    const goals = (si, pi) => st.kicks.filter((k) => k.s === si && k.pi === pi && k.result === 'goal').length;
    let mvp = null;
    const human = (pi) => !T.sides[w].players[pi].bot || T.sides[w].players.every((p) => p.bot);   // an AI filler is never MVP if a viewer is on the side
    const lastGoal = st.kicks.slice().reverse().find((k) => k.s === w && k.result === 'goal' && human(k.pi));
    if (st.sd && lastGoal) mvp = { si: w, pi: lastGoal.pi };
    else { let best = -1; T.sides[w].players.forEach((p, pi) => { if (!human(pi)) return; const g = goals(w, pi) * 10 + (st.kicks.filter((k) => k.s === w && k.pi === pi && k.result === 'goal').pop() || { round: 0 }).round; if (g > best) { best = g; mvp = { si: w, pi }; } }); }
    const mp = mvp ? T.sides[mvp.si].players[mvp.pi] : null;
    const C = (this.teamCfg && this.teamCfg()) || {};
    const pts = { win: +C.winPts || opts.points.shootout[0] || 3, lose: C.losePts != null ? +C.losePts : (opts.points.shootout[1] || 1), goal: C.goalPts != null ? +C.goalPts : 1, mvpDouble: C.mvpDouble !== false };
    this.push(Object.assign({ type: 'battle', mode: 'shootout', label: T.size + ' v ' + T.size + ' PENALTY SHOOTOUT', phase: 'result', winner: w, score: st.score.slice(), sd: st.sd, outroMs: MT.outro < 1000 ? MT.outro : 12000,
      mvp: mp ? Object.assign(this.teamCard(mp), { display: mp.display, side: mvp.si, goals: goals(mvp.si, mvp.pi) }) : null, rewards: pts, fighters: this.fighters.map((p) => this.teamCard(p)) }, this.teamState()));
    const sc = T.sides.map((s, i) => s.name + ' ' + st.score[i]).join(' - ');
    this.say('FULL TIME' + (st.sd ? ' after sudden death' : '') + ': ' + T.sides[w].name + ' WIN! ' + sc + (mp ? ' · MVP: ' + mp.display : '') + '. Card points paid out. !card to see yours.');
    if (this.onTeamResult) { try { this.onTeamResult({ winner: T.sides[w].name, score: sc, sd: st.sd, mvp: mp ? mp.display : null, size: T.size, line: st.score[w] + '-' + Math.max(...st.score.filter((_, i) => i !== w)) + (T.sides.length > 2 ? ' (' + T.sides.filter((_, i) => i !== w).map((s) => s.name).join(', ') + ')' : ' V ' + T.sides[1 - w].name) }); } catch (e) { /* ignore */ } }
    const players = [];
    T.sides.forEach((s, si) => s.players.forEach((p, pi) => { if (!p.bot && !p.test) players.push(Object.assign({}, p, { win: si === w, goals: goals(si, pi), mvp: !!(mvp && mvp.si === si && mvp.pi === pi) })); }));
    this.timer = setTimeout(() => { this.reset(); this.reward(players, 'teampens', { winner: w, pts }); }, MT.outro < 1000 ? MT.outro : 12000);
  }

  cancel() {
    if (this.phase === 'idle') return;
    this.push({ type: 'battle', mode: this.mode, phase: 'cancel', reason: 'Cancelled' });
    this.reset();
  }

  reset() {
    clearTimeout(this.timer);
    this.phase = 'idle';
    this.mode = null;
    this.joiners.clear();
    this.fighters = [];
    this.endsAt = null;
    this.setup = null;
    this.so = null;
    this.raid = null;
    this.race = null;
    this.team = 0;
    this.drawn = false;
    this.autoGo = false;
    clearTimeout(this.idleT);
    this.bossMode = false;
    this.tm = null;
  }
}

module.exports = { sideOdds, zoneOdds, parseShot, zoneOf, Battle, MODES, COMP, SO, startComposure, simulateShootout, simulateRace, raceSetup: RL.raceSetup, configureShootout, shootoutDefaults };
