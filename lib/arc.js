// "QUEEN RAID": a community co-op battle set in the streamer's own Ashfall Frontier world.
// Everyone who types !join drops in together. Phase 1: clear a swarm of Veydr machines.
// Phase 2: break the Veydr Queen's armour plates, then destroy her core before the timer runs out.
// Runs live, one tick per second, so bits / Kicks / Super Chats / subs during the fight count straight away.
//
// WIN CHANCE: with "use win % table" on, the streamer sets the team's chance of winning for each
// squad size (settings page, Battles tab). Chat activity (!fire) and support can push it up or down a
// little. The outcome is rolled when the Queen lands, and her health is steered so the fight still
// looks natural (close finishes, not instant kills).
const crypto = require('crypto');
const rnd = () => crypto.randomInt(0, 1000000) / 1000000;
const pick = (a) => a[Math.floor(rnd() * a.length)];

// maps match the artwork in public/art (map-<id>.jpg)
const MAPS = [
  { id: 'verdant', label: 'Verdant Spillway' }, { id: 'glasswaste', label: 'The Glasswaste' },
  { id: 'skygrave', label: 'Skygrave Terminal' }, { id: 'hollow', label: 'The Hollow Divide' },
  { id: 'frostspire', label: 'Frostspire Vault' }, { id: 'saltwake', label: 'Saltwake Coast' },
  { id: 'thundercrest', label: 'Thundercrest Array' }, { id: 'ember', label: 'Ember Orchard' }
];
const CONDITIONS = [
  { id: 'day', label: 'Clear day' }, { id: 'dusk', label: 'Ash dusk' }, { id: 'night', label: 'Night raid' },
  { id: 'storm', label: 'Signal storm' }
];
// roles come from the card's best stat. Each role is one of the Ashfall crew.
const ROLES = {
  WAT: { id: 'kite', label: 'KITE · RECON', crit: 0.2, dps: 1, armour: 1, down: 1 },
  SUB: { id: 'bulwark', label: 'BULWARK · HEAVY', crit: 0.1, dps: 1.15, armour: 1, down: 0.85 },
  SUP: { id: 'rivet', label: 'RIVET · TECH', crit: 0.1, dps: 1, armour: 1.6, down: 1 },
  CHT: { id: 'merek', label: 'MEREK · MEDIC', crit: 0.1, dps: 0.9, armour: 1, down: 0.9, medic: true },
  LOY: { id: 'cinder', label: 'CINDER · SCAVENGER', crit: 0.12, dps: 1, armour: 1, down: 0.6 },
  RAI: { id: 'orchid', label: 'ORCHID · ANALYST', crit: 0.1, dps: 1, armour: 1, down: 1, rally: 0.02 }
};

// Everything below can be changed on the settings page (Battles tab > Game tuning).
const ENEMY_INFO = {
  scrabbler: { name: 'Scrabbler', tag: 'Scout // Harvest', fly: false },
  clusterwisp: { name: 'Clusterwisp', tag: 'Swarm // Process', fly: true },
  lantern: { name: 'Lantern', tag: 'Survey // Illuminate: repairs other ARC', fly: false },
  lookout: { name: 'Lookout', tag: 'Relay // Detect: ARC hit more often', fly: false },
  boreback: { name: 'Boreback', tag: 'Tunnel // Excavate: hits hard', fly: false },
  quarrymaw: { name: 'Quarrymaw', tag: 'Extraction // Haul: elite brute', fly: false }
};
const TUNE = {
  // timing
  timeLimit: 180, swarmSecs: 42, queenSecs: 165,
  // swarm size: min, max, and how many extra per raider
  swarmMin: 3, swarmMax: 14, swarmPerRaider: 0.5,
  // enemies: spawn = % chance each slot is this type, hp = toughness, dmg = damage, hit = how often it hits
  enemies: {
    scrabbler: { spawn: 30, hp: 0.8, dmg: 1, hit: 1 },
    clusterwisp: { spawn: 22, hp: 0.55, dmg: 0.7, hit: 1.4 },
    lantern: { spawn: 12, hp: 1.3, dmg: 0.6, hit: 0.7 },
    lookout: { spawn: 14, hp: 1.2, dmg: 0.8, hit: 1 },
    boreback: { spawn: 14, hp: 1.8, dmg: 1.6, hit: 0.8 },
    quarrymaw: { spawn: 8, hp: 2.8, dmg: 2, hit: 0.9 }
  },
  lanternRepair: 0.6, lookoutBuff: 15,
  // raiders
  hp: 100, base: 10, idle: 45, activeSecs: 6, fireCooldown: 2, maxShield: 50, shieldPerBoost: 5,
  grenadeMult: 6, grenadeCd: 25, healMedic: 35, healSelf: 20, medicCd: 10, selfCd: 25,
  reviveMin: 3, reviveMax: 5, reviveHp: 50, weapon: 8, maxWeapon: 10, team: 1, maxTeam: 30,
  // ARC damage to raiders
  miniDmgMin: 15, miniDmgMax: 28, miniHit: 12,
  queenDmgMin: 35, queenDmgMax: 60, queenHitMult: 1.7, queenEveryMin: 7, queenEveryMax: 10, enragedEveryMin: 4, enragedEveryMax: 7,
  plates: 4, armourShare: 35, levelMin: 85, levelMax: 120,
  // THE QUEEN'S THREE PHASES (by % of her health left)
  // 1 ARMOURED: plates + energy shields that pop up at random (1, sometimes 2 at once)
  shieldChance: 6, shieldMax: 2, shieldHp: 6, shieldCooldown: 8,
  // 2 ENRAGED (from phase2At %): heavy attacks that hit hard and can ELIMINATE raiders (out until chat revives them)
  phase2At: 66, enragedDmg: 160, elimChance: 25, elimMax: 30,
  // 3 TRUE FORM (from phase3At %): she transforms and takes flight; her damage climbs the weaker she gets
  phase3At: 33, trueFormDmg: 120, trueFormRamp: 100,
  // TIME: chat can buy extra time with a cheer that says "time" (or !time if free)
  extendSecs: 30, maxExtends: 4, extendCost: 1, freeTime: false,
  // win chance
  useWinTable: true,
  // ACTIVE players = raiders who typed !fire / !grenade / !heal in the last activeWindow seconds.
  // pct = chance with no support at all, pctSupport = chance once chat has sent supportFull points
  // (100 bits / Kicks / 1 Super Chat = 1 point, a sub or gift = 5). In between it slides evenly.
  winTable: [{ upTo: 1, pct: 0, pctSupport: 50 }, { upTo: 3, pct: 25, pctSupport: 60 }, { upTo: 6, pct: 45, pctSupport: 70 }, { upTo: 10, pct: 55, pctSupport: 75 }, { upTo: 20, pct: 60, pctSupport: 80 }, { upTo: 9999, pct: 65, pctSupport: 85 }],
  supportFull: 10,
  activeWindow: 30
};
const DEFAULTS = JSON.parse(JSON.stringify(TUNE));
const SCORE = { kill: 250, plate: 400, revive: 200, queen: 1500, heal: 60 };
const QUEEN_HIT = { sweep: 0.22, mortar: 0.18, stomp: 0.28, meteor: 0.3, overload: 0.24, dive: 0.26, storm: 0.34 };
const QUEEN_MOVES = { 1: ['sweep', 'mortar', 'stomp'], 2: ['meteor', 'overload', 'sweep', 'stomp'], 3: ['dive', 'storm', 'sweep'] };
const EXPECT_ACTIVE = 0.6;

function configure(t) {
  const src = t || {};
  for (const k of Object.keys(DEFAULTS)) {
    if (k === 'enemies') {
      for (const e of Object.keys(DEFAULTS.enemies)) TUNE.enemies[e] = Object.assign({}, DEFAULTS.enemies[e], (src.enemies || {})[e] || {});
    } else if (k === 'winTable') {
      const w = Array.isArray(src.winTable) && src.winTable.length ? src.winTable : DEFAULTS.winTable;
      TUNE.winTable = w.map((r) => { const pct = Math.max(0, Math.min(100, +r.pct || 0)); return { upTo: Math.max(1, r.upTo | 0), pct, pctSupport: Math.max(pct, Math.min(100, r.pctSupport != null ? +r.pctSupport : pct)) }; }).sort((a, b) => a.upTo - b.upTo);
    } else TUNE[k] = src[k] != null && src[k] !== '' ? (typeof DEFAULTS[k] === 'boolean' ? !!src[k] : +src[k]) : DEFAULTS[k];
  }
  return TUNE;
}
function tableRow(n) { return TUNE.winTable.find((r) => n <= r.upTo) || TUNE.winTable[TUNE.winTable.length - 1] || { pct: 50, pctSupport: 50 }; }
// win % for this many ACTIVE players and this much support (points)
function winPct(active, support) {
  const r = tableRow(Math.max(1, active));
  const base = active > 0 ? r.pct : 0;
  const f = TUNE.supportFull > 0 ? Math.min(1, Math.max(0, support) / TUNE.supportFull) : 0;
  return base + (Math.max(base, r.pctSupport) - base) * f;
}
function tablePct(n) { return tableRow(n).pct; }

// role from the card's standout stat (watch time counts less, almost everyone has lots of it).
// Brand-new cards with no standout stat get a role from their name so the squad is mixed.
function roleOf(card) {
  const st = card.stats || {}, W = { WAT: 0.6, SUB: 1, SUP: 1, CHT: 1, LOY: 1, RAI: 1, STK: 0.8 };
  let best = null, v = 2;
  for (const k of Object.keys(W)) { const x = ((st[k] || 40) - 40) * W[k]; if (x > v) { v = x; best = k; } }
  if (!best) { const keys = Object.keys(W); let h = 0; for (const ch of String(card.display || card.key || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; best = keys[h % keys.length]; }
  return ROLES[best === 'STK' ? 'LOY' : best] || ROLES.WAT;
}
const skill = (c) => 0.8 + ((c.ovr || 40) - 40) * 0.008;

function rollEnemy() {
  const E = TUNE.enemies, keys = Object.keys(E);
  const tot = keys.reduce((a, k) => a + Math.max(0, +E[k].spawn || 0), 0);
  if (tot <= 0) return 'scrabbler';
  let x = rnd() * tot;
  for (const k of keys) { x -= Math.max(0, +E[k].spawn || 0); if (x <= 0) return k; }
  return keys[0];
}

class QueenRaid {
  constructor(cards, boosts) {
    const T = TUNE;
    this.n = cards.length;
    this.map = pick(MAPS);
    this.cond = pick(CONDITIONS);
    this.t = 0;
    this.team = 0;
    this.raiders = cards.map((c, i) => ({ i, role: roleOf(c), skill: skill(c), w: Math.min(T.maxWeapon, boosts[i] || 0), down: 0, score: 0, dmg: 0, kills: 0, revives: 0,
      hp: T.hp, shield: Math.min(T.maxShield, (boosts[i] || 0) * T.shieldPerBoost), activeUntil: 0, nadeReady: 0, nade: false, healReady: 0 }));
    this.queued = [];
    this.level = (T.levelMin + rnd() * (T.levelMax - T.levelMin)) / 100;
    const act = T.idle / 100 + (1 - T.idle / 100) * EXPECT_ACTIVE;
    const exp = this.raiders.reduce((a, r) => a + T.base * r.skill * r.role.dps, 0) * 0.92 * act * this.level * (0.95 + 0.06 * Math.log(this.n));
    const count = Math.max(T.swarmMin, Math.min(T.swarmMax, Math.round(T.swarmMin - 1 + this.n * T.swarmPerRaider)));
    const swarmHp = exp * T.swarmSecs;
    const types = Array.from({ length: count }, rollEnemy);
    const weight = types.reduce((a, k) => a + T.enemies[k].hp, 0) || 1;
    this.minis = types.map((k, id) => { const hp = Math.max(1, Math.round(swarmHp * T.enemies[k].hp / weight)); return { id, type: k, name: ENEMY_INFO[k].name, max: hp, hp }; });
    const qHp = Math.round(exp * T.queenSecs);
    this.queen = { max: qHp, hp: qHp, armourMax: Math.round(qHp * T.armourShare / 100), plates: T.plates, enraged: false, nextAtk: 0, qp: 1, shields: [], nextShield: 0 };
    this.limit = T.timeLimit; this.extends = 0; this.elims = 0; this.timeBuyers = new Set();
    this.queen.armour = this.queen.armourMax;
    this.phase = 1;
    this.done = false;
    this.win = false;
    // director (win % table)
    this.support = (boosts || []).reduce((a, b) => a + (b || 0), 0);
    this.actTicks = 0; this.raiderTicks = 0;
    this.fate = null; this.pRoll = null; this.floor = 0; this.ema = null;
  }

  // the team's chance of winning right now (0..1)
  activeCount() { const w = TUNE.activeWindow; return this.raiders.filter((r) => r.lastInput != null && this.t - r.lastInput <= w).length; }
  chance() {
    const p = winPct(this.activeCount(), this.support + this.team);
    return Math.max(0, Math.min(0.99, p / 100));
  }

  state() {
    return {
      map: this.map.label, mapId: this.map.id, cond: this.cond, timeLimit: this.limit, extendSecs: TUNE.extendSecs, maxExtends: TUNE.maxExtends, freeTime: TUNE.freeTime, n: this.n, level: Math.round(this.level * 100),
      raiders: this.raiders.map((r) => ({ role: r.role.id, roleLabel: r.role.label, w: r.w })),
      minis: this.minis.map((m) => ({ type: m.type, name: m.name, max: m.max })),
      queen: { max: this.queen.max, armourMax: this.queen.armourMax, plates: TUNE.plates },
      maxWeapon: TUNE.maxWeapon, maxTeam: TUNE.maxTeam, fireCooldown: TUNE.fireCooldown, grenadeCd: TUNE.grenadeCd
    };
  }

  // a named boost (raider index) or team supply (idx = -1). Returns what was added.
  boost(idx, pts) {
    const T = TUNE;
    if (this.t > 0) this.support += pts > 0 ? pts : 0;
    if (idx < 0) { const add = Math.min(T.maxTeam - this.team, pts); if (add > 0) this.team += add; return { team: add > 0 ? add : 0 }; }
    const r = this.raiders[idx]; if (!r) return {};
    const add = Math.min(T.maxWeapon - r.w, pts);
    if (add > 0) r.w += add;
    const revived = r.down > 0 || r.elim;
    r.down = 0; r.elim = false;   // adrenaline: a boost gets a downed (or eliminated) raider straight back up
    r.hp = T.hp; r.shield = Math.min(T.maxShield, r.shield + pts * T.shieldPerBoost);   // and heals them, plus armour
    return { add: add > 0 ? add : 0, revived, hp: r.hp, shield: r.shield };
  }
  // ---- extra time (cheer with "time", or !time when free) ----
  extend(by, pts) {
    const T = TUNE;
    if (this.done || this.extends >= T.maxExtends) return { msg: 'no more extra time this raid' };
    if (pts != null && pts < T.extendCost) return null;
    this.extends++; this.limit += T.extendSecs;
    this.queued.push({ k: 'extend', secs: T.extendSecs, by: by || 'chat', left: T.maxExtends - this.extends });
    return { ok: true };
  }
  // ---- raider inputs from chat ----
  fire(i) { const r = this.raiders[i]; if (!r || this.done) return null; r.lastInput = this.t; const was = this.t <= r.activeUntil; r.activeUntil = this.t + TUNE.activeSecs; return { ok: true, was }; }
  grenade(i) {
    const r = this.raiders[i]; if (!r || this.done || r.down) return null;
    r.lastInput = this.t;
    if (this.t < r.nadeReady) return { msg: 'grenade ready in ' + (r.nadeReady - this.t) + 's' };
    r.nadeReady = this.t + TUNE.grenadeCd; r.nade = true; r.activeUntil = this.t + TUNE.activeSecs;
    return { ok: true };
  }
  heal(i) {
    const T = TUNE, r = this.raiders[i]; if (!r || this.done || r.down) return null;
    r.lastInput = this.t;
    if (this.t < r.healReady) return { msg: 'heal ready in ' + (r.healReady - this.t) + 's' };
    if (r.role.medic) {
      const t = this.raiders.filter((x) => !x.down).sort((a, b) => a.hp - b.hp)[0];
      t.hp = Math.min(T.hp, t.hp + T.healMedic); r.healReady = this.t + T.medicCd; r.score += SCORE.heal;
      this.queued.push({ k: 'heal', r: t.i, by: r.i });
    } else { r.hp = Math.min(T.hp, r.hp + T.healSelf); r.healReady = this.t + T.selfCd; this.queued.push({ k: 'heal', r: r.i, by: r.i }); }
    r.activeUntil = Math.max(r.activeUntil, this.t + 1);
    return { ok: true };
  }

  // how much of the raiders' damage reaches the Queen this tick (the win % director)
  steer(raw) {
    const T = TUNE, q = this.queen;
    this.ema = this.ema == null ? raw : this.ema * 0.8 + raw * 0.2;
    if (!T.useWinTable || this.fate == null) return 1;
    // late support can still turn a losing raid around
    const p = this.chance();
    if (!this.fate && p > this.pRoll) { if (rnd() < (p - this.pRoll) / Math.max(0.01, 1 - this.pRoll)) { this.fate = true; } this.pRoll = p; }
    const left = Math.max(1, this.limit - this.t), rate = Math.max(1, this.ema);
    const shieldHp = q.shields.reduce((a, x) => a + x, 0);
    if (this.fate) {
      const cap = left < 20 ? 12 : 5;
      const need = (q.hp + shieldHp) / (rate * left * 0.8);
      return need > 1 ? Math.min(cap, need) : 1;
    }
    const room = q.hp - this.floor;
    if (room <= 0) return 0;
    return Math.min(1, room / (rate * left * 1.05));
  }

  tick() {
    if (this.done) return null;
    const T = TUNE;
    this.t++;
    const ev = this.queued; this.queued = [];
    const shots = [];
    const up = this.raiders.filter((r) => !r.down && !r.elim);
    const rally = 1 + Math.min(0.1, this.raiders.reduce((a, r) => a + (r.role.rally || 0), 0));
    const teamMult = (1 + this.team * T.team / 100) * rally;
    for (const r of up) { this.raiderTicks++; if (this.t <= r.activeUntil) this.actTicks++; }
    // ---- revives ----
    for (const r of this.raiders) {
      if (!r.down || r.elim) continue;
      r.down--;
      if (r.down === 0) {
        const medics = up.filter((x) => x.role.medic);
        const by = medics.length ? pick(medics) : up.length ? pick(up) : null;
        r.hp = Math.round(T.hp * T.reviveHp / 100);
        if (by) { by.revives++; by.score += SCORE.revive * (by.role.medic ? 1.5 : 1); ev.push({ k: 'revive', r: r.i, by: by.i }); }
        else ev.push({ k: 'revive', r: r.i, by: r.i });   // nobody left standing: gets up alone
      }
    }
    // ---- raiders shoot ----
    const dmgs = [];
    const crit2 = this.phase === 2 && this.queen.armour <= 0 ? 2 : 1;
    for (const r of up) {
      let dmg = T.base * r.skill * r.role.dps * (1 + r.w * T.weapon / 100) * teamMult * (0.7 + rnd() * 0.6) * (this.t <= r.activeUntil ? 1 : T.idle / 100);
      let nade = false;
      if (r.nade) { r.nade = false; nade = true; dmg = T.base * r.skill * T.grenadeMult * (1 + r.w * T.weapon / 100) * teamMult; }
      const crit = rnd() < r.role.crit * crit2;
      if (crit) dmg *= 2;
      dmgs.push([r, dmg, crit, nade]);
    }
    if (this.phase === 1) {
      // if chat has gone quiet the swarm still gets cleared eventually, so the Queen always shows up
      const assist = this.t > T.swarmSecs * 1.4 ? 2.5 : 1;
      for (const [r, dmg0, crit, nade] of dmgs) {
        const alive = this.minis.filter((m) => m.hp > 0);
        if (!alive.length) break;
        const m = rnd() < 0.6 ? alive[0] : pick(alive);   // mostly focus fire
        const dmg = dmg0 * assist;
        if (nade) ev.push({ k: 'nade', r: r.i, m: m.id });
        const d = Math.min(m.hp, dmg);
        m.hp -= d; r.dmg += d; r.score += d;
        shots.push({ r: r.i, m: m.id, c: crit ? 1 : 0 });
        if (m.hp <= 0) { m.hp = 0; r.kills++; r.score += SCORE.kill; ev.push({ k: 'kill', r: r.i, m: m.id }); }
      }
      // lanterns repair the other ARC
      const lanterns = this.minis.filter((m) => m.hp > 0 && m.type === 'lantern').length;
      if (lanterns && T.lanternRepair > 0) for (const m of this.minis) if (m.hp > 0 && m.type !== 'lantern') m.hp = Math.min(m.max, m.hp + m.max * T.lanternRepair / 100 * lanterns);
    } else {
      const q = this.queen;
      const raw = dmgs.reduce((a, x) => a + x[1], 0);
      const dm = this.steer(raw);
      for (const [r, dmg0, crit, nade] of dmgs) {
        let dmg = dmg0 * dm;
        if (nade) ev.push({ k: 'nade', r: r.i, m: 'q' });
        // energy shields soak damage first
        while (dmg > 0 && q.shields.length) {
          const take = Math.min(q.shields[0], dmg); q.shields[0] -= take; dmg -= take; r.score += take * 0.5;
          if (q.shields[0] <= 0.5) { q.shields.shift(); r.score += 150; ev.push({ k: 'shieldBreak', r: r.i, left: q.shields.length }); }
        }
        if (dmg <= 0) { shots.push({ r: r.i, m: 'q', c: crit ? 1 : 0, s: 1 }); continue; }
        if (q.armour > 0) {
          const d = Math.min(q.armour, dmg * r.role.armour, Math.max(0, q.hp - (this.fate === false ? this.floor : 0)));
          const before = Math.ceil(q.armour / (q.armourMax / T.plates));
          q.armour -= d; q.hp -= d; r.dmg += d; r.score += dmg0;
          const after = Math.ceil(Math.max(0, q.armour) / (q.armourMax / T.plates));
          if (after < before) { q.plates = after; r.score += SCORE.plate; ev.push({ k: 'plate', r: r.i, left: after }); }
        } else {
          const d = Math.min(q.hp - (this.fate === false ? this.floor : 0), dmg);
          if (d > 0) { q.hp -= d; r.dmg += d; }
          r.score += dmg0;
        }
        shots.push({ r: r.i, m: 'q', c: crit ? 1 : 0 });
        if (q.hp <= 0.5) { q.hp = 0; r.score += SCORE.queen; ev.push({ k: 'queenDown', r: r.i }); this.done = true; this.win = true; break; }
      }
    }
    // ---- phase change: the Queen lands and the outcome is rolled ----
    if (this.phase === 1 && this.minis.every((m) => m.hp <= 0)) {
      this.phase = 2;
      this.queen.nextAtk = this.t + 5;
      if (T.useWinTable) {
        this.pRoll = this.chance();
        this.fate = rnd() < this.pRoll;
        this.floor = this.queen.max * (0.04 + rnd() * 0.18);
      }
      ev.push({ k: 'phase', p: 2 });
    }
    // ---- the ARC fights back ----
    const standing = () => this.raiders.filter((r) => !r.down);
    const knock = (r, by) => { r.hp = 0; r.down = T.reviveMin + Math.floor(rnd() * (T.reviveMax - T.reviveMin + 1)); ev.push({ k: 'down', r: r.i, by }); };
    const hurt = (r, lo, hi, by) => {
      let d = (lo + rnd() * (hi - lo)) * r.role.down;
      const s = Math.min(r.shield, d); r.shield -= s; d -= s;
      r.hp -= d;
      if (r.hp <= 0) knock(r, by);
    };
    if (!this.done && this.phase === 1) {
      const buff = this.minis.some((m) => m.hp > 0 && m.type === 'lookout') ? 1 + T.lookoutBuff / 100 : 1;
      for (const m of this.minis) {
        if (m.hp <= 0) continue;
        const E = T.enemies[m.type], s = standing();
        if (s.length && rnd() < T.miniHit / 100 * E.hit * buff) { hurt(pick(s), T.miniDmgMin * E.dmg, T.miniDmgMax * E.dmg, m.id); ev.push({ k: 'mhit', m: m.id }); }
      }
    } else if (!this.done) {
      const q = this.queen, frac = q.hp / q.max;
      // phase changes
      if (q.qp === 1 && frac * 100 <= T.phase2At) { q.qp = 2; q.enraged = true; q.shields = []; ev.push({ k: 'qphase', p: 2 }); ev.push({ k: 'enrage' }); q.nextAtk = Math.min(q.nextAtk, this.t + 2); }
      if (q.qp === 2 && frac * 100 <= T.phase3At) { q.qp = 3; ev.push({ k: 'qphase', p: 3 }); q.nextAtk = this.t + 4; }
      // phase 1: energy shields at random moments
      if (q.qp === 1 && q.shields.length < T.shieldMax && this.t >= q.nextShield && rnd() < T.shieldChance / 100) {
        const n = q.shields.length === 0 && T.shieldMax > 1 && rnd() < 0.3 ? 2 : 1;
        for (let k = 0; k < n && q.shields.length < T.shieldMax; k++) q.shields.push(q.max * T.shieldHp / 100);
        q.nextShield = this.t + T.shieldCooldown;
        ev.push({ k: 'shield', n: q.shields.length });
      }
      if (this.t >= q.nextAtk) {
        const type = pick(QUEEN_MOVES[q.qp]);
        ev.push({ k: 'qatk', type, p: q.qp });
        // how hard she hits: enraged moves hurt more, and the true form gets stronger the weaker she is
        let mult = 1;
        if (q.qp === 2) mult = T.enragedDmg / 100;
        if (q.qp === 3) mult = T.trueFormDmg / 100 * (1 + Math.max(0, 1 - frac / (T.phase3At / 100)) * T.trueFormRamp / 100);
        if (this.fate === true) mult *= 0.7;   // on course to win: still scary, but survivable
        const heavy = q.qp === 2 && (type === 'meteor' || type === 'overload');
        for (const r of standing()) {
          if (rnd() >= QUEEN_HIT[type] * T.queenHitMult * (q.enraged ? 1.2 : 1)) continue;
          hurt(r, T.queenDmgMin * mult, T.queenDmgMax * mult, 'q');
          // a heavy enraged hit can take a downed raider out for good (until chat revives them)
          // never the last raiders standing, and not when the raid is on course to win (keeps the win % honest)
          const notOut = this.raiders.filter((x) => !x.elim).length;
          if (heavy && r.down && this.fate !== true && notOut > Math.max(1, Math.ceil(this.n / 2)) && this.elims < Math.floor(this.n * T.elimMax / 100) && rnd() < T.elimChance / 100) { r.elim = true; this.elims++; ev.push({ k: 'elim', r: r.i }); }
        }
        const [a, b] = q.qp >= 2 ? [T.enragedEveryMin, T.enragedEveryMax] : [T.queenEveryMin, T.queenEveryMax];
        q.nextAtk = this.t + a + Math.floor(rnd() * (Math.max(a, b) - a + 1));
      }
    }
    if (!this.done && this.t >= this.limit) { this.done = true; this.win = false; ev.push({ k: 'timeout' }); }
    // only a sample of shots is sent to the overlay (it can't draw hundreds)
    for (let k = shots.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [shots[k], shots[j]] = [shots[j], shots[k]]; }
    return {
      t: this.t, stage: this.phase, ev, shots: shots.slice(0, 14), team: this.team,
      minis: this.minis.map((m) => Math.round(m.hp)),
      queen: { hp: Math.round(this.queen.hp), armour: Math.round(Math.max(0, this.queen.armour)), plates: this.queen.plates, enraged: this.queen.enraged, qp: this.queen.qp, shields: this.queen.shields.map((x) => Math.round(x / Math.max(1, this.queen.max * TUNE.shieldHp / 100) * 100)) },
      limit: this.limit, extendsLeft: TUNE.maxExtends - this.extends,
      raiders: this.raiders.map((r) => [Math.round(r.score), r.elim ? 2 : r.down ? 1 : 0, r.w, Math.max(0, Math.round(r.hp / T.hp * 100)), Math.round(r.shield / Math.max(1, T.maxShield) * 50), this.t <= r.activeUntil ? 1 : 0])
    };
  }

  // final ranking + card points for each raider
  result(points) {
    const order = this.raiders.slice().sort((a, b) => b.score - a.score);
    const P = this.win ? points.win : points.loss;
    const out = order.map((r, rank) => {
      const pts = rank === 0 ? P.mvp : rank < 3 ? P.top3 : r.score > 0 ? P.rest : 0;
      return { i: r.i, score: Math.round(r.score), dmg: Math.round(r.dmg), kills: r.kills, revives: r.revives, role: r.role.label, pts };
    });
    return { win: this.win, time: this.t, queenLeft: Math.round(this.queen.hp), queenMax: this.queen.max, ranking: out, order: out.map((x) => x.i), mvp: out[0] ? out[0].i : 0,
      winChance: this.pRoll != null ? Math.round(this.pRoll * 100) : null };
  }
}

module.exports = { QueenRaid, TUNE, DEFAULTS, ENEMY_INFO, ROLES, MAPS, configure, tablePct, winPct, BAL: TUNE };
