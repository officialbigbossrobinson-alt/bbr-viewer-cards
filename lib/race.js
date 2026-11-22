// BBR Haulage Cup: a LIVE truck race, one tick per second.
// Drivers can use !turbo (3 per race) and !dodge (when a hazard hits them).
// Chat can mess with the race: !rain !wind !lightning !traffic (free, limited, no picking targets: usually hits the leader), plus bits/subs.
const crypto = require('crypto');
const rnd = () => crypto.randomInt(0, 1000000) / 1000000;
const pick = (a) => a[Math.floor(rnd() * a.length)];

// a real landmark for every city, drawn on the overlay as you leave and as you arrive
const LANDMARKS = {
  'Los Angeles': 'Griffith Observatory', 'Las Vegas': '"Welcome to Fabulous Las Vegas" sign', Phoenix: 'Camelback Mountain', Albuquerque: 'Balloon Fiesta over the Sandia Mountains',
  'San Francisco': 'Golden Gate Bridge', Reno: 'The Reno Arch', Seattle: 'Space Needle', Portland: 'Mount Hood and the St. Johns Bridge',
  Denver: 'Colorado State Capitol', 'Salt Lake City': 'Utah State Capitol', Dallas: 'Reunion Tower', Houston: 'Downtown skyline and Saturn V rocket',
  Boise: 'Idaho State Capitol', Missoula: 'The "M" on Mount Sentinel', Calais: 'Calais Town Hall belfry', Duisburg: 'Landschaftspark blast furnaces',
  Rotterdam: 'Erasmus Bridge', Berlin: 'Brandenburg Gate and TV Tower', London: 'Elizabeth Tower (Big Ben)', Edinburgh: 'Edinburgh Castle',
  Paris: 'Eiffel Tower', Lyon: 'Basilica of Notre-Dame de Fourvière', Milano: 'Duomo di Milano', 'München': 'Frauenkirche',
  Stockholm: 'Stockholm City Hall', Oslo: 'Oslo Opera House', Warszawa: 'Palace of Culture and Science', Praha: 'Týn Church'
};
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
// Truck race 2.0: time of day and weather are picked from what's ticked on the dashboard (Battles > Truck race).
const TODS = [
  { id: 'day', label: 'Day' }, { id: 'sunrise', label: 'Sunrise' }, { id: 'sunset', label: 'Sunset' }, { id: 'night', label: 'Night' }, { id: 'golden', label: 'Golden hour' }
];
const WEATHER = [
  { id: 'clear', label: 'Clear skies', w: 40 }, { id: 'rain', label: 'Heavy rain', w: 25 }, { id: 'fog', label: 'Thick fog', w: 10 },
  { id: 'snow', label: 'Snow', w: 10 }, { id: 'storm', label: 'Thunderstorm', w: 10 }, { id: 'ice', label: 'Black ice', w: 5 }
];
const TOD_IDS = TODS.map((x) => x.id), WX_IDS = WEATHER.map((x) => x.id);
// every truck carries its own cargo, and the cargo is that driver's !special (once per race)
//  where: behind = dropped behind you (hits whoever follows in that lane), ahead = lands in front of the truck ahead of you,
//         area = everyone close to you, self = helps you
const SPECIALS = [
  { id: 'logs', cargo: 'Timber Logs', name: 'Log drop', where: 'behind', lanes: 1, text: 'dropped the logs!' },
  { id: 'slick', cargo: 'Chemical Tanks', name: 'Chemical slick', where: 'behind', lanes: 1, text: 'left a chemical slick!' },
  { id: 'cows', cargo: 'Live Cattle', name: 'Cows loose', where: 'ahead', lanes: 1, text: 'let the cows out!' },
  { id: 'stones', cargo: '40t of Gravel', name: 'Stone shower', where: 'behind', lanes: 2, text: 'showered the road with stones!' },
  { id: 'car', cargo: 'Car Transporter', name: 'Drop a car', where: 'behind', lanes: 1, text: 'dropped a car off the trailer!' },
  { id: 'ice', cargo: 'Frozen Pizzas', name: 'Ice patch', where: 'ahead', lanes: 1, text: 'iced the road ahead!' },
  { id: 'fireworks', cargo: '22t of Fireworks', name: 'Fireworks show', where: 'area', lanes: 3, text: 'set off the fireworks!' },
  { id: 'boxes', cargo: 'Parcel Boxes', name: 'Box avalanche', where: 'behind', lanes: 3, text: 'started a box avalanche!' },
  { id: 'bales', cargo: 'Hay Bales', name: 'Rolling bales', where: 'ahead', lanes: 1, text: 'sent hay bales rolling!' },
  { id: 'fuel', cargo: 'Diesel Tanker', name: 'Fuel top-up', where: 'self', lanes: 0, text: 'topped up from the tanker!' },
  { id: 'pit', cargo: 'Mobile Workshop', name: 'Pit stop', where: 'self', lanes: 0, text: 'pulled a pit stop: fully repaired!' },
  { id: 'concrete', cargo: 'Cement Mixer', name: 'Wet concrete', where: 'behind', lanes: 1, text: 'poured wet concrete!' }
];
// what an obstacle in a lane does when you drive into it: slowdown (mult), how long, damage
const OBST = {
  cones: { text: 'Ploughed through the cones', mult: 0.5, len: 2, dmg: 10 },
  car: { text: 'Hit a broken-down car', mult: 0.3, len: 2, dmg: 28 },
  tyre: { text: 'Ran over tyre debris', mult: 0.6, len: 1, dmg: 12 },
  pothole: { text: 'Smashed into a pothole', mult: 0.55, len: 1, dmg: 15 },
  puddle: { text: 'Aquaplaned through a puddle', mult: 0.5, len: 2, dmg: 0 },
  logs: { text: 'Hit the logs', mult: 0.3, len: 2, dmg: 25 },
  slick: { text: 'Spun on the chemical slick', mult: 0.35, len: 2, dmg: 10 },
  cows: { text: 'Cows in the road!', mult: 0.25, len: 2, dmg: 8 },
  stones: { text: 'Stones cracked the windscreen', mult: 0.6, len: 1, dmg: 18 },
  ice: { text: 'Slid on the ice patch', mult: 0.4, len: 2, dmg: 10 },
  boxes: { text: 'Buried in boxes', mult: 0.45, len: 2, dmg: 8 },
  bales: { text: 'Flattened by a hay bale', mult: 0.4, len: 2, dmg: 15 },
  concrete: { text: 'Stuck in wet concrete', mult: 0.2, len: 2, dmg: 5 }
};
const NL = 5, RUNOUT = 1.045;   // lanes, how far past the finish trucks roll
const ROAD_OBST = ['cones', 'car', 'tyre', 'pothole', 'cones', 'tyre'];
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
  night: [{ text: 'Dazzled by full beams', mult: 0.55, len: 2, kind: 'glare' }],
  snow: [{ text: 'Whiteout! Crawling along', mult: 0.5, len: 2, kind: 'fog' }, { text: 'Wheels spinning in the snow', mult: 0.5, len: 2, kind: 'slide' }],
  ice: [{ text: 'Black ice! Sliding everywhere', mult: 0.35, len: 2, kind: 'slide' }],
  storm: [{ text: 'Aquaplaning! Sliding all over', mult: 0.4, len: 2, kind: 'slide' }, { text: 'Storm gust shoves the trailer', mult: 0.55, len: 1, kind: 'gust' }]
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

const BAL = {
  lead: 73,                 // ticks the leader needs with no events (about 80 seconds of racing)
  ovr: 0.0012, fuel: 0.0028, noise: 0.5, wetNoise: 0.7, wet: 0.95,
  bad: 0.045, good: 0.05, crash: 0.008, rainCrash: 0.02, animal: 0.022, nightAnimal: 0.045, draft: 0.05,
  turbo: { uses: 3, mult: 1.2, len: 3, cooldown: 6 },
  dodge: { window: 2, save: 0.5 },
  lanes: { spawn: 0.2, pickup: 0.1, ahead: 7, burn: 0.85, tank: 55, perFuel: 4.5, refill: 30, auto: 0.4, limp: 0.6, dry: 0.4, specials: 1, hornCool: 8 },     // ticks after a hazard to type !dodge, and how much of the slowdown a dodge removes
  chat: { perTruck: 3, lightning: 0.3, traffic: 0.45, gust: 0.8, rainLen: 10, windLen: 8, weatherCooldown: 12, hitCooldown: 5, leaderChance: 0.8 }
};
// flat, settings-page friendly view of BAL (percentages where that reads better)
const TUNE_MAP = {
  raceTicks: ['lead', 1], turboUses: ['turbo.uses', 1], turboBoost: ['turbo.mult', 'pct+'], turboSecs: ['turbo.len', 1], turboCooldown: ['turbo.cooldown', 1],
  dodgeWindow: ['dodge.window', 1], dodgeSave: ['dodge.save', 'pct'],
  leaderChance: ['chat.leaderChance', 'pct'], hitsPerTruck: ['chat.perTruck', 1], lightningSlow: ['chat.lightning', 'slow'], trafficSlow: ['chat.traffic', 'slow'],
  gustSlow: ['chat.gust', 'slow'], rainSecs: ['chat.rainLen', 1], windSecs: ['chat.windLen', 1], weatherCooldown: ['chat.weatherCooldown', 1], hitCooldown: ['chat.hitCooldown', 1],
  obstacleChance: ['lanes.spawn', 'pct'], pickupChance: ['lanes.pickup', 'pct'], warnSecs: ['lanes.ahead', 1], fuelBurn: ['lanes.burn', 1], startTank: ['lanes.tank', 1], autoSteer: ['lanes.auto', 'pct'], specialsPerRace: ['lanes.specials', 1],
  breakdownChance: ['bad', 'pct'], luckyChance: ['good', 'pct'], crashChance: ['crash', 'pct'], rainCrashChance: ['rainCrash', 'pct'], animalChance: ['animal', 'pct']
};
const getP = (o, path) => path.split('.').reduce((a, k) => a[k], o);
const setP = (o, path, v) => { const ks = path.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
const toFlat = (v, how) => how === 'pct' ? +(v * 100).toFixed(2) : how === 'pct+' ? +((v - 1) * 100).toFixed(2) : how === 'slow' ? +((1 - v) * 100).toFixed(2) : v;
const fromFlat = (v, how) => how === 'pct' ? v / 100 : how === 'pct+' ? 1 + v / 100 : how === 'slow' ? 1 - v / 100 : v;
const BAL0 = JSON.parse(JSON.stringify(BAL));
const DEFAULTS = {}; for (const [k, [path, how]] of Object.entries(TUNE_MAP)) DEFAULTS[k] = toFlat(getP(BAL0, path), how);
function configure(t) {
  t = t || {};
  for (const [k, [path, how]] of Object.entries(TUNE_MAP)) {
    const v = t[k] != null && t[k] !== '' && isFinite(+t[k]) ? +t[k] : DEFAULTS[k];
    setP(BAL, path, fromFlat(v, how));
  }
}
const HAZARD = ['smoke', 'stop', 'police', 'detour', 'blowout', 'cones', 'slide', 'spray', 'fog', 'glare', 'crash', 'animal', 'lightning', 'traffic', 'gust'];

// HOW THE ROUTE IS PICKED: routes you switched off are skipped. Playing American Truck Simulator =
// ATS routes only, Euro Truck Simulator 2 = ETS routes only, anything else = all of them.
// The last 4 routes used are avoided so it doesn't repeat. Then one is picked at random.
const recentRoutes = [];
const routeId = (r) => r.from + '>' + r.to;
function routePool(o) {
  o = o || {};
  const off = new Set(o.disabled || []);
  let pool = ROUTES.filter((r) => !off.has(routeId(r)));
  if (!pool.length) pool = ROUTES.slice();
  const game = String(o.game || '');
  const want = /american truck|\bats\b/i.test(game) ? 'ATS' : /euro truck|\bets\s?2?\b/i.test(game) ? 'ETS' : null;
  if (want && pool.some((r) => r.game === want)) pool = pool.filter((r) => r.game === want);
  return { pool, want };
}
function raceSetup(o) {
  o = o || {};
  const tods = TODS.filter((x) => !Array.isArray(o.tods) || !o.tods.length || o.tods.includes(x.id));
  const tod = pick(tods.length ? tods : TODS);
  const wts = WEATHER.map((x) => Object.assign({}, x, { w: o.wx && o.wx[x.id] != null && isFinite(+o.wx[x.id]) ? Math.max(0, +o.wx[x.id]) : x.w }));
  const w = wts.some((x) => x.w > 0) ? pickW(wts) : WEATHER[0];
  const { pool } = routePool(o);
  const fresh = pool.filter((r) => !recentRoutes.includes(routeId(r)));
  const route = pick(fresh.length ? fresh : pool);
  recentRoutes.push(routeId(route)); if (recentRoutes.length > 4) recentRoutes.shift();
  const label = w.label + ({ day: '', sunrise: ' at sunrise', sunset: ' at sunset', night: ' at night', golden: ' in golden hour' }[tod.id] || '');
  // a fork somewhere in the middle, and a few bends (the overlay draws the same road)
  const f0 = 0.38 + rnd() * 0.12, fork = { from: +f0.toFixed(3), to: +(f0 + 0.14 + rnd() * 0.05).toFixed(3) };
  const bends = []; for (let i = 0; i < 5; i++) bends.push({ c: +(0.08 + i * 0.19 + rnd() * 0.08).toFixed(3), w: +(0.05 + rnd() * 0.04).toFixed(3), a: Math.round((rnd() < 0.5 ? -1 : 1) * (300 + rnd() * 350)) });
  return { route: Object.assign({}, route, { lmFrom: LANDMARKS[route.from] || '', lmTo: LANDMARKS[route.to] || '' }), cargo: pick(CARGO), weather: { id: w.id, label }, tod: { id: tod.id, label: tod.label }, fork, bends, lanes: NL };
}
function routeList(o) { const { pool, want } = routePool(o); const off = new Set((o && o.disabled) || []); return { want, routes: ROUTES.map((r) => Object.assign({ id: routeId(r), on: !off.has(routeId(r)), inPool: pool.includes(r), lmFrom: LANDMARKS[r.from], lmTo: LANDMARKS[r.to] }, r)) }; }

class RaceLive {
  constructor(cards, fuel, setup) {
    this.n = cards.length; this.cards = cards; this.setup = setup;
    this.t = 0; this.done = false;
    const wid = setup.weather.id;
    this.wx = { rain: wid === 'rain' || wid === 'storm' ? 9999 : 0, wind: wid === 'storm' ? 9999 : 0 };
    const L = BAL.lanes;
    // a different cargo (and so a different !special) for every truck
    const sps = SPECIALS.slice().sort(() => rnd() - 0.5);
    this.d = cards.map((c, i) => ({
      i, dist: 0, fuel: fuel[i] || 0, base: 1 + (c.ovr - 60) * BAL.ovr,
      fx: null, bads: 0, goods: 0, crashed: false, hits: 0,
      turbo: BAL.turbo.uses, turboUntil: 0, turboReady: 0, dodgeUntil: 0, dodged: 0, finish: null,
      lane: [2, 1, 3, 0, 4][i % 5], steerAt: -99, tank: Math.min(100, L.tank + (fuel[i] || 0) * L.perFuel), dmg: 0, dry: false, limp: false,
      sp: sps[i % sps.length], spLeft: L.specials, hornAt: -99, autoSeen: new Set()
    }));
    this.obs = []; this.obId = 0;
    this.leadHist = [];
    this.lastWeather = -99; this.lastHit = -99;
    this.used = new Set();   // one free chat command per viewer per race
  }
  inFork(d) { const F = this.setup.fork; return !!F && d >= F.from && d <= F.to; }
  isWet() { return this.wx.rain > this.t || this.setup.weather.id === 'rain' || this.setup.weather.id === 'storm'; }
  night() { return (this.setup.tod && this.setup.tod.id === 'night') || this.setup.weather.id === 'night'; }
  specials() { return this.d.map((r) => ({ id: r.sp.id, name: r.sp.name, cargo: r.sp.cargo })); }
  addOb(d, lane, kind, by) { const o = { id: ++this.obId, d, lane, kind, by: by == null ? -1 : by, hit: new Set(by == null ? [] : [by]) }; this.obs.push(o); return o; }
  // ---- lanes: L / R (L2 / R2 = two lanes), M = middle ----
  steer(i, to) {
    const r = this.d[i]; if (!r || r.finish != null || this.done) return null;
    let lane = Math.max(0, Math.min(NL - 1, to));
    r.steerAt = this.t;
    // in the fork the short cut (lanes 1-2) and the motorway (3-5) are split by a barrier
    if (this.inFork(r.dist) && (r.lane <= 1) !== (lane <= 1)) { lane = r.lane <= 1 ? 1 : 2; if (lane === r.lane) return { msg: 'there is a barrier: you picked your side of the fork' }; }
    if (lane === r.lane) return { ok: true, same: true };
    r.lane = lane;
    this.queued.push({ d: i, kind: 'lane', lane, good: true, text: '' });
    return { ok: true, lane };
  }
  special(i) {
    const r = this.d[i]; if (!r || r.finish != null || this.done) return null;
    if (r.spLeft <= 0) return { msg: 'your ' + r.sp.name + ' is used up this race' };
    r.spLeft--;
    const sp = r.sp, ev = { d: i, kind: 'special', sp: sp.id, name: sp.name, text: sp.text, good: true, lane: r.lane };
    const lanesFor = (lane, n) => (n >= 3 ? [lane - 1, lane, lane + 1].filter((l) => l >= 0 && l < NL) : n === 2 ? [lane, lane === NL - 1 ? lane - 1 : lane + 1] : [lane]);
    if (sp.where === 'behind') {
      for (const l of lanesFor(r.lane, sp.lanes)) this.addOb(Math.max(0.01, r.dist - 0.006), l, sp.id, i);
    } else if (sp.where === 'ahead') {
      const ahead = this.d.filter((x) => x.finish == null && x.i !== i && x.dist > r.dist).sort((a, b) => a.dist - b.dist)[0]
        || this.d.filter((x) => x.finish == null && x.i !== i).sort((a, b) => b.dist - a.dist)[0];
      if (ahead) { this.addOb(Math.min(0.995, ahead.dist + 0.035), ahead.lane, sp.id, i); ev.target = ahead.i; }
    } else if (sp.where === 'area') {
      for (const x of this.d) if (x.i !== i && x.finish == null && Math.abs(x.dist - r.dist) < 0.05) this.pendingHazards.push([x, { text: 'Dazzled by ' + (this.cards[i].display || 'the') + '\'s fireworks', mult: 0.5, len: 2, kind: 'glare' }]);
    } else if (sp.id === 'fuel') { r.tank = Math.min(100, r.tank + 45); r.dry = false; }
    else if (sp.id === 'pit') { r.dmg = 0; r.limp = false; r.fx = { mult: 0.2, until: this.t + 1, kind: 'stop' }; }
    this.queued.push(ev);
    return { ok: true };
  }
  // !horn: the truck right in front of you in your lane moves over
  horn(i) {
    const r = this.d[i]; if (!r || r.finish != null || this.done) return null;
    if (this.t - r.hornAt < BAL.lanes.hornCool) return null;
    r.hornAt = this.t;
    const front = this.d.filter((x) => x.i !== i && x.finish == null && x.lane === r.lane && x.dist > r.dist && x.dist - r.dist < 0.03).sort((a, b) => a.dist - b.dist)[0];
    const ev = { d: i, kind: 'horn', good: true, text: 'HONK!' };
    if (front) { const ok = [front.lane - 1, front.lane + 1].filter((l) => l >= 0 && l < NL && !(this.inFork(front.dist) && (l <= 1) !== (front.lane <= 1))); if (ok.length) front.lane = pick(ok); ev.target = front.i; this.queued.push({ d: front.i, kind: 'lane', lane: front.lane, good: false, text: 'Honked out of the way' }); }
    this.queued.push(ev);
    return { ok: true };
  }
  hazard(r, e, ev) {
    r.fx = { mult: e.mult, until: this.t + e.len - 1, kind: e.kind };
    r.dodgeUntil = this.t + BAL.dodge.window;
    ev.push(Object.assign({ d: r.i, text: e.text, good: false, kind: e.kind, dmg: Math.round(r.dmg) }, e.animal ? { animal: e.animal } : {}, e.by ? { by: e.by } : {}));
  }
  // ---- inputs ----
  turbo(i) {
    const r = this.d[i]; if (!r || r.finish != null || this.done) return null;
    if (r.turbo <= 0) return { msg: 'no turbos left' };
    if (this.t < r.turboReady) return { msg: 'turbo is cooling down' };
    r.turbo--; r.turboUntil = this.t + BAL.turbo.len; r.turboReady = this.t + BAL.turbo.cooldown;
    this.queued.push({ d: i, kind: 'turbo', text: 'TURBO!', good: true, left: r.turbo });
    return { ok: true, left: r.turbo };
  }
  dodge(i) {
    const r = this.d[i]; if (!r || !r.fx || this.t > r.dodgeUntil || r.dodged === r.fx.until) return null;
    // a good dodge halves the slowdown and cuts it short
    r.fx.mult = r.fx.mult + (1 - r.fx.mult) * BAL.dodge.save; r.fx.until = Math.max(this.t, r.fx.until - 1); r.dodged = r.fx.until;
    this.queued.push({ d: i, kind: 'dodge', text: 'Great dodge!', good: true });
    return { ok: true };
  }
  addFuel(i, n) { const r = this.d[i]; if (!r) return 0; const add = Math.max(0, Math.min(10 - r.fuel, n)); r.fuel += add; return add; }
  // chat chaos. who = viewer key (null for paid = no limit per viewer).
  // Nobody picks the target: it lands on the race leader most of the time (leaderChance), otherwise a random truck.
  chaos(kind, who, paid) {
    if (this.done) return { msg: 'race is over' };
    if (who && this.used.has(who)) return { msg: 'one chaos command per race' };
    if (kind === 'rain' || kind === 'wind') {
      if (!paid && this.t - this.lastWeather < BAL.chat.weatherCooldown) return { msg: 'the weather just changed, try again in a few seconds' };
      this.lastWeather = this.t;
      if (kind === 'rain') this.wx.rain = Math.max(this.wx.rain, this.t) + BAL.chat.rainLen * (paid ? 2 : 1);
      else this.wx.wind = Math.max(this.wx.wind, this.t) + BAL.chat.windLen * (paid ? 2 : 1);
      if (who) this.used.add(who);
      this.queued.push({ d: -1, kind: kind === 'rain' ? 'rainstart' : 'windstart', text: kind === 'rain' ? 'Chat called in a downpour!' : 'Crosswinds picking up!', good: false, by: who });
      return { ok: true };
    }
    if (kind === 'lightning' || kind === 'traffic') {
      if (!paid && this.t - this.lastHit < BAL.chat.hitCooldown) return { msg: 'wait a few seconds' };
      const alive = this.d.filter((r) => r.finish == null && r.hits < BAL.chat.perTruck);
      if (!alive.length) return { msg: 'every truck has taken enough hits from chat' };
      const leader = alive.reduce((a, r) => (r.dist > a.dist ? r : a), alive[0]);
      const r = rnd() < BAL.chat.leaderChance ? leader : pick(alive);
      r.hits++; this.lastHit = this.t; if (who) this.used.add(who);
      this.pendingHazards.push([r, kind === 'lightning'
        ? { text: 'LIGHTNING STRIKE from chat!', mult: BAL.chat.lightning * (paid ? 0.5 : 1), len: paid ? 2 : 1, kind: 'lightning', by: who }
        : { text: 'Car crash ahead! Traffic jam', mult: BAL.chat.traffic * (paid ? 0.7 : 1), len: 2, kind: 'traffic', by: who }]);
      return { ok: true, target: r.i };
    }
    return null;
  }

  tick() {
    if (this.done) return null;
    this.t++;
    const ev = this.queued || []; this.queued = [];
    const ph = this.pendingHazards || []; this.pendingHazards = [];
    const wid = this.setup.weather.id, wet = this.isWet(), windy = this.wx.wind > this.t;
    const lead = Math.max.apply(null, this.d.map((r) => r.dist));
    for (const [r, e] of ph) this.hazard(r, e, ev);
    const LB = BAL.lanes, step = 1 / BAL.lead;
    // new lane obstacles and fuel pads appear far enough ahead to react (stream delay included)
    if (this.t > 3 && lead < 0.9) {
      const alive = this.d.filter((r) => r.finish == null);
      if (alive.length && rnd() < LB.spawn) {
        const r = pick(alive), at = r.dist + LB.ahead * step;
        // the short cut has roadworks: more cones there
        const fk = this.inFork(at), lane = fk && rnd() < 0.55 ? Math.floor(rnd() * 2) : rnd() < 0.6 ? r.lane : Math.floor(rnd() * NL);
        if (at < 0.97) this.addOb(at, lane, fk && lane <= 1 ? pick(['cones', 'cones', 'pothole']) : wet && rnd() < 0.4 ? 'puddle' : pick(ROAD_OBST), null);
      }
      if (alive.length && rnd() < LB.pickup) { const r = pick(alive), at = r.dist + LB.ahead * step; if (at < 0.97) this.addOb(at, this.inFork(at) ? 2 + Math.floor(rnd() * 3) : Math.floor(rnd() * NL), 'fuel', null); }
      // fuel stations along the motorway side of the fork
      if (this.inFork(lead + LB.ahead * step) && rnd() < 0.35) this.addOb(lead + LB.ahead * step, 2 + Math.floor(rnd() * 3), 'fuel', null);
    }
    if (!this.forkWarned && lead > this.setup.fork.from - 0.12) {
      this.forkWarned = true;
      ev.push({ d: -1, kind: 'forkwarn', text: 'FORK AHEAD: L for the short cut (roadworks), R for the motorway (fuel)', good: true });
    }
    // drivers who haven't steered lately get a co-driver who sometimes swerves in time
    for (const r of this.d) {
      if (r.finish != null || this.t - r.steerAt < 15) continue;
      for (const o of this.obs) {
        if (o.kind === 'fuel' || o.lane !== r.lane || o.hit.has(r.i) || r.autoSeen.has(o.id)) continue;
        if (o.d > r.dist && o.d - r.dist < 2.2 * step) {
          r.autoSeen.add(o.id);
          if (rnd() < LB.auto) { const opts = [r.lane - 1, r.lane + 1].filter((l) => l >= 0 && l < NL && !(this.inFork(r.dist) && (l <= 1) !== (r.lane <= 1))); r.lane = pick(opts); ev.push({ d: r.i, kind: 'lane', lane: r.lane, good: true, text: '' }); }
        }
      }
    }
    for (const r of this.d) {
      // over the line: keep rolling through the finish, then brake to a stop
      if (r.finish != null) { r.dist = Math.min(RUNOUT, r.dist + Math.max(0.0008, (RUNOUT - r.dist) * 0.3)); continue; }
      if (r.fx && this.t > r.fx.until) r.fx = null;
      if (!r.fx && this.t > 2 && lead < 0.97) {
        const fuelSafe = r.fuel * 0.003;
        const pCrash = Math.max(0.003, (wet ? BAL.rainCrash : BAL.crash) - fuelSafe / 3);
        const pAnimal = this.night() ? BAL.nightAnimal : BAL.animal;
        if (!r.crashed && r.bads < 6 && rnd() < pCrash * (wid === 'ice' ? 1.8 : 1)) { r.crashed = true; r.bads++; r.dmg = Math.min(100, r.dmg + 35); this.hazard(r, pick(CRASH), ev); }
        else if (r.bads < 6 && rnd() < pAnimal) { const [animal, text] = pick(ANIMALS[this.setup.route.game] || ANIMALS.ATS); r.bads++; this.hazard(r, { text, mult: 0.3, len: 2, kind: 'animal', animal }, ev); }
        else if (windy && rnd() < 0.12) this.hazard(r, { text: 'Hit by a gust, fighting the wheel', mult: BAL.chat.gust, len: 1, kind: 'gust' }, ev);
        else if (r.bads < 6 && rnd() < Math.max(0.03, BAL.bad - fuelSafe)) {
          const wb = WEATHER_BAD[wid] || (wet ? WEATHER_BAD.rain : this.night() ? WEATHER_BAD.night : null);
          r.bads++; this.hazard(r, wb && rnd() < (wet ? 0.55 : 0.35) ? pick(wb) : pick(BAD), ev);
        } else if (r.goods < 5 && rnd() < BAL.good + r.fuel * 0.002) {
          const e = pick(GOOD); r.goods++; r.fx = { mult: e.mult, until: this.t + e.len - 1, kind: e.kind, good: true };
          ev.push({ d: r.i, text: e.text, good: true, kind: e.kind });
        }
      }
      const gap = lead - r.dist;
      const draft = gap > 0 && gap < 0.03 ? 1 + BAL.draft : 1;
      const turbo = this.t <= r.turboUntil ? BAL.turbo.mult : 1;
      const noise = wet || wid === 'snow' || wid === 'ice' ? BAL.wetNoise : BAL.noise;
      // fuel tank burns down (turbo burns more); empty = crawling. Damage at 100% = limping
      r.tank = Math.max(0, r.tank - LB.burn * (turbo > 1 ? 2.5 : 1));
      if (r.tank <= 0 && !r.dry) { r.dry = true; ev.push({ d: r.i, kind: 'dry', text: 'OUT OF FUEL! Crawling', good: false }); }
      if (r.dmg >= 100 && !r.limp) { r.limp = true; ev.push({ d: r.i, kind: 'limp', text: 'Truck wrecked, limping on', good: false }); }
      const slip = (wid === 'snow' || wid === 'ice' ? 0.93 : 1) * (this.inFork(r.dist) && r.lane <= 1 ? 1.07 : 1);
      const sp = (r.base + r.fuel * BAL.fuel) * (wet ? BAL.wet : 1) * slip * draft * turbo * (1 - noise / 2 + rnd() * noise) * (r.fx ? r.fx.mult : 1) * (r.dry ? LB.dry : 1) * (r.limp ? LB.limp : 1) / BAL.lead;
      const before = r.dist;
      r.dist += sp;
      for (const o of this.obs) {
        if (o.lane !== r.lane || o.hit.has(r.i) || !(before < o.d && r.dist >= o.d)) continue;
        o.hit.add(r.i);
        if (o.kind === 'fuel') { r.tank = Math.min(100, r.tank + LB.refill); r.dry = false; ev.push({ d: r.i, kind: 'fuelup', text: 'Fuel pad! +' + LB.refill, good: true, ob: o.id }); continue; }
        const X = OBST[o.kind] || OBST.cones;
        r.dmg = Math.min(100, r.dmg + X.dmg);
        this.hazard(r, { text: X.text, mult: X.mult, len: X.len, kind: 'ob', ob: o.kind, by: o.by >= 0 ? (this.cards[o.by] && this.cards[o.by].display) : undefined }, ev);
        ev[ev.length - 1].ob = o.kind; ev[ev.length - 1].obId = o.id;
      }
      if (r.dist >= 1) { r.finish = this.t - 1 + (1 - before) / (r.dist - before); ev.push({ d: r.i, kind: 'finish', text: 'Delivered!', good: true }); }
    }
    let l = 0; for (let i = 1; i < this.n; i++) if (this.d[i].dist > this.d[l].dist) l = i;
    this.leadHist.push(l);
    const finished = this.d.filter((r) => r.finish != null);
    const first = finished.length ? Math.min.apply(null, finished.map((r) => r.finish)) : null;
    if (finished.length === this.n || (first != null && this.t >= first + 10) || this.t >= Math.round(BAL.lead * 1.75)) this.done = true;
    return {
      t: this.t, ev, wx: { rain: wet, wind: windy },
      pos: this.d.map((r) => +r.dist.toFixed(4)),   // can go a little past 1: trucks drive through the finish
      drivers: this.d.map((r) => [r.fuel, r.turbo, this.t <= r.turboUntil ? 1 : 0, r.fx && !r.fx.good ? r.fx.kind : 0, r.finish != null ? 1 : 0, r.lane, Math.round(r.tank), Math.round(r.dmg), r.spLeft]),
      obs: this.liveObs()
    };
  }

  // obstacles still in front of someone (the overlay draws these in their lanes)
  liveObs() {
    const back = Math.min.apply(null, this.d.map((r) => (r.finish != null ? 2 : r.dist)));
    this.obs = this.obs.filter((o) => o.d > back - 0.03 && o.hit.size < this.n);
    return this.obs.map((o) => [o.id, +o.d.toFixed(4), o.lane, o.kind]);
  }
  result() {
    const order = this.d.map((r) => r.i).sort((a, b) => {
      const A = this.d[a], B = this.d[b];
      if (A.finish != null && B.finish != null) return A.finish - B.finish;
      if (A.finish != null) return -1; if (B.finish != null) return 1;
      return B.dist - A.dist;
    });
    const km = this.setup.route.km, w = this.d[order[0]], winnerHours = km / 84;
    const results = order.map((i) => {
      const r = this.d[i];
      const hours = r.finish != null && w.finish ? winnerHours * (r.finish / w.finish) : null;
      return { d: i, finished: r.finish != null, time: hours != null ? Math.floor(hours) + 'h ' + String(Math.round((hours % 1) * 60)).padStart(2, '0') + 'm' : null, behindKm: r.finish == null ? Math.max(1, Math.round((1 - r.dist) * km)) : 0 };
    });
    let leadChanges = 0; for (let k = 1; k < this.leadHist.length; k++) if (this.leadHist[k] !== this.leadHist[k - 1]) leadChanges++;
    const photo = order.length > 1 && this.d[order[1]].finish != null && this.d[order[1]].finish - w.finish < 0.3;
    return { setup: this.setup, order, results, photoFinish: photo, leadChanges, winner: order[0], ticks: this.t };
  }
}

module.exports = { TODS, WEATHER, TOD_IDS, WX_IDS, SPECIALS, RaceLive, raceSetup, routeList, routeId, ROUTES, LANDMARKS, BAL, HAZARD, DEFAULTS, TUNE_MAP, configure };
