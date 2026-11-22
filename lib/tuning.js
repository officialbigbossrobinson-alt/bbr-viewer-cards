// Game tuning: every number the streamer can change on the settings page (Battles tab > Game tuning).
// Values are saved in config.json under "tuning" and applied to the games straight away.
const ARC = require('./arc');
const RL = require('./race');
const BT = require('./battle');
const ST = require('./stats');

// [key, label, min, max, step, help]
const SCHEMA = {
  cards: {
    label: 'Viewer cards',
    groups: [
      ['Stream streaks', [
        ['streakBoostMax', 'Most streak boost on every stat', 0, 10, 1, 'Ember (3 in a row) +1, Flame (5) +2, Blue Flame (10) +3, Inferno (20) +4, Phoenix (40) +5. This caps it.'],
        ['saverEvery', 'Streams in a row to earn a streak saver', 0, 50, 1, 'A saver covers one missed stream. 0 = no savers.'],
        ['saverMax', 'Most savers a viewer can hold', 0, 5, 1],
        ['stkSpeed', 'How fast STK grows (higher = slower)', 2, 60, 1, 'Roughly the streak length that gets STK about two thirds of the way to 99.']
      ]],
      ['Support value', [
        ['giftSup', 'SUPPORT points per gift sub (100 bits = 100)', 0, 3000, 10, 'Default 500: about twice what a gift sub pays you, because gifts bring new people in.'],
        ['t2Months', 'SUB months counted for a Tier 2 sub', 1, 10, 1],
        ['t3Months', 'SUB months counted for a Tier 3 sub', 1, 20, 1],
        ['supCurve', 'SUPPORT needed to get the stat about two thirds full', 500, 50000, 100]
      ]],
      ['!card', [
        ['cardCooldown', 'Seconds before the same person can use !card again', 0, 3600, 5],
        ['cardScreenGap', 'Seconds between cards on screen (whole chat)', 0, 120, 1],
        ['cardReplyGap', 'Seconds to group chat replies together', 0, 60, 1, 'Several !card in a row become one chat message, so the bot never spams.']
      ]]
    ]
  },
  general: {
    label: 'All battles',
    groups: [
      ['Timing', [
        ['joinSecs', 'Seconds to type !join', 10, 120, 1],
        ['boostSecs', 'Seconds to boost before it starts (race, raid)', 0, 60, 1],
        ['penBoostSecs', 'Penalty games: seconds to buy ON TARGET shots before kick-off', 0, 30, 1],
        ['startIdleSecs', 'Start early when nobody new joins for this many seconds (0 = wait for the full join time)', 0, 60, 1, 'Games also start the moment they are full (2 for a shootout without the draw, 8 trucks, every team slot).']
      ]],
      ['Support limits', [
        ['maxBoost', 'Most boost a player can get (race fuel / raid firepower)', 1, 30, 1],
        ['maxShields', 'Most ON TARGET shots a shooter can get', 0, 10, 1]
      ]]
    ]
  },
  shootout: {
    label: 'Penalty Shootout',
    groups: [
      ['Odds', [
        ['goalPct', 'Goal chance per kick (%)', 5, 99, 1, 'For an average card with steady nerves. Misses and saves are scaled to hit this.'],
        ['keeperCentre', 'Keeper stays in the centre (%)', 0, 100, 1, 'The rest is split between diving left and right.'],
        ['centreSave', 'Centre save chance when he stays (%)', 0, 100, 1],
        ['sideSave', 'Side save chance, middle height, when he guesses right (%)', 0, 100, 1],
        ['topSave', 'Top corner save chance when he guesses side + height (%)', 0, 100, 1, 'Top corners are the hardest to reach.'],
        ['lowSave', 'Bottom corner save chance when he guesses side + height (%)', 0, 100, 1],
        ['centreTopSave', 'Top centre save chance when he stays (%)', 0, 100, 1],
        ['centreLowSave', 'Bottom centre save chance when he stays (%)', 0, 100, 1],
        ['topMissUp', 'Top shots go over / wide more (+%)', 0, 200, 5, 'Aiming high is riskier: 70 = 1.7 x the misses of a middle-height shot.'],
        ['keeperHigh', 'Keeper guesses high (%)', 0, 100, 1, 'When he dives. Guessing the wrong height cuts his save chance a lot.'],
        ['keeperLow', 'Keeper guesses low (%)', 0, 100, 1, 'The rest is middle height.'],
        ['centreMissCut', 'Centre shots go wide less (%)', 0, 90, 1, 'How much safer centre is from missing the target. 0 = same as the sides.'],
        ['keeperReads', 'Keeper reads you (+% per centre kick in a row)', 0, 40, 1, 'Go centre twice in a row and he stays put more often.'],
        ['onTargetSave', 'Extra save chance on an ON TARGET shot (%)', 0, 50, 1]
      ]],
      ['Timing', [
        ['aimSecs', 'Seconds to pick a shot (L / C / R, add T or B for top / bottom)', 3, 30, 1],
        ['ytExtraSecs', 'Extra seconds for YouTube shooters (YouTube chat arrives late)', 0, 20, 1],
        ['autoStartSecs', 'Seconds to start once 2 players join', 1, 30, 1]
      ]],
      ['Who plays', [
        ['drawPick', 'Pick players: 1 = random draw from everyone who joins, 0 = first two to join', 0, 1, 1],
        ['noRepeat', 'Skip last shootout\'s players when others joined (1 = yes, 0 = no)', 0, 1, 1]
      ]],
      ['Crowd', [
        ['booCost', '!boo !horn !drum !whistle composure hit', 0, 10, 1],
        ['flareCost', '!flare !firework composure hit', 0, 10, 1],
        ['flashCost', '!flash (camera flashes) composure hit', 0, 10, 1],
        ['laserCost', '!laser (laser pointers) composure hit', 0, 10, 1],
        ['chantGain', '!chant composure boost', 0, 10, 1],
        ['comp_crowdMax', 'Most the crowd can take off per kick', 0, 40, 1],
        ['comp_crowdChantMax', 'Most !chant can add per kick', 0, 40, 1]
      ]],
      ['Composure', [
        ['comp_drain', 'Drop every kick', 0, 30, 1],
        ['comp_sdDrain', 'Drop every kick in sudden death', 0, 40, 1],
        ['comp_sdShock', 'Drop when sudden death starts', 0, 50, 1],
        ['comp_goal', 'Gain after scoring', 0, 30, 1],
        ['comp_fail', 'Loss after missing', 0, 30, 1],
        ['comp_mustScore', 'Extra pressure on a must-score kick', 0, 40, 1],
        ['comp_perBoost', 'Gain per 100 bits of support', 0, 20, 1],
        ['comp_perSub', 'Gain per sub', 0, 30, 1],
        ['comp_maxChat', 'Most support can add in total', 0, 60, 1]
      ]]
    ]
  },
  race: {
    label: 'Truck Race',
    groups: [
      ['Driver inputs (how much typing beats idling)', [
        ['turboUses', 'Turbos per race', 0, 10, 1],
        ['turboBoost', 'Turbo speed boost (%)', 0, 100, 1],
        ['turboSecs', 'Turbo lasts (seconds)', 1, 10, 1],
        ['turboCooldown', 'Seconds between turbos', 0, 30, 1],
        ['dodgeWindow', 'Seconds to type !dodge', 1, 6, 1],
        ['dodgeSave', 'Slowdown a dodge removes (%)', 0, 100, 1]
      ]],
      ['Lanes, fuel and cargo specials', [
        ['obstacleChance', 'Lane obstacle appears (% per second)', 0, 100, 1],
        ['pickupChance', 'Fuel pad appears (% per second)', 0, 100, 1],
        ['warnSecs', 'Obstacles appear this many seconds ahead', 3, 15, 1, 'Give viewers time for stream delay.'],
        ['fuelBurn', 'Fuel used per second (tank = 100)', 0, 3, 0.05],
        ['startTank', 'Starting tank (bits fuel adds on top)', 10, 100, 1],
        ['autoSteer', 'Co-driver swerve chance for idle drivers (%)', 0, 100, 1],
        ['specialsPerRace', 'Cargo specials per driver', 0, 5, 1]
      ]],
      ['Chat chaos', [
        ['leaderChance', 'Chance !lightning / !traffic hits the leader (%)', 0, 100, 1, 'Otherwise it hits a random truck. Nobody can pick a target.'],
        ['hitsPerTruck', 'Most chat hits per truck', 0, 10, 1],
        ['lightningSlow', 'Lightning slowdown (%)', 0, 100, 1],
        ['trafficSlow', 'Traffic slowdown (%)', 0, 100, 1],
        ['gustSlow', 'Wind gust slowdown (%)', 0, 100, 1],
        ['rainSecs', 'Rain lasts (seconds)', 1, 60, 1],
        ['windSecs', 'Wind lasts (seconds)', 1, 60, 1],
        ['weatherCooldown', 'Seconds between weather changes', 0, 60, 1],
        ['hitCooldown', 'Seconds between chat hits', 0, 30, 1]
      ]],
      ['Road events (chance per truck per second, %)', [
        ['raceTicks', 'Race length (seconds for the leader)', 20, 120, 1],
        ['breakdownChance', 'Breakdowns, police, roadworks', 0, 30, 0.1],
        ['luckyChance', 'Lucky breaks (shortcuts, slipstream)', 0, 30, 0.1],
        ['crashChance', 'Crash (dry)', 0, 10, 0.1],
        ['rainCrashChance', 'Crash (rain)', 0, 10, 0.1],
        ['animalChance', 'Animal on the road', 0, 10, 0.1]
      ]]
    ]
  },
  raid: {
    label: 'Queen Raid',
    groups: [
      ['Win chance', [
        ['supportFull', 'Support for the full "with support" chance (points)', 1, 200, 1, '100 bits / Kicks / 1 Super Chat = 1 point, a sub or gift = 5. Less support = part of the way.'],
        ['activeWindow', 'Counts as an active player if they typed in the last (seconds)', 5, 120, 1]
      ]],
      ['Raiders', [
        ['hp', 'Raider health', 10, 500, 5],
        ['base', 'Raider damage per second', 1, 50, 1],
        ['idle', 'Idle raider damage (% of full)', 0, 100, 1],
        ['activeSecs', 'Seconds one !fire keeps you shooting', 1, 20, 1],
        ['fireCooldown', '!fire cooldown per raider (seconds)', 0, 10, 0.5],
        ['grenadeMult', 'Grenade damage (x normal)', 1, 20, 0.5],
        ['grenadeCd', 'Grenade cooldown (seconds)', 1, 120, 1],
        ['healMedic', 'Medic heal amount', 0, 200, 1],
        ['healSelf', 'Self heal amount', 0, 200, 1],
        ['medicCd', 'Medic heal cooldown (seconds)', 1, 60, 1],
        ['selfCd', 'Self heal cooldown (seconds)', 1, 120, 1],
        ['reviveMin', 'Downed for at least (seconds)', 1, 30, 1],
        ['reviveMax', 'Downed for at most (seconds)', 1, 30, 1],
        ['reviveHp', 'Health after a revive (%)', 1, 100, 1],
        ['maxShield', 'Most armour', 0, 200, 5],
        ['shieldPerBoost', 'Armour per 100 bits', 0, 50, 1],
        ['weapon', 'Damage per firepower level (%)', 0, 50, 1],
        ['maxWeapon', 'Most firepower levels', 0, 30, 1],
        ['team', 'Team damage per supply point (%)', 0, 10, 0.5],
        ['maxTeam', 'Most team supply (%)', 0, 100, 1]
      ]],
      ['Swarm', [
        ['swarmSecs', 'Swarm length (seconds, average chat)', 5, 120, 1],
        ['swarmMin', 'Fewest machines', 1, 30, 1],
        ['swarmMax', 'Most machines', 1, 30, 1],
        ['swarmPerRaider', 'Extra machines per raider', 0, 3, 0.1],
        ['miniHit', 'Chance a machine hits each second (%)', 0, 100, 1],
        ['miniDmgMin', 'Machine damage, low', 0, 200, 1],
        ['miniDmgMax', 'Machine damage, high', 0, 200, 1],
        ['lanternRepair', 'Lantern repairs other ARC (% per second)', 0, 10, 0.1],
        ['lookoutBuff', 'Lookout makes ARC hit more often (%)', 0, 200, 1]
      ]],
      ['The Queen: three phases', [
        ['shieldChance', 'Phase 1: chance a shield pops up each second (%)', 0, 100, 1],
        ['shieldMax', 'Phase 1: most shields at once', 0, 4, 1],
        ['shieldHp', 'Phase 1: shield strength (% of her health)', 0, 30, 0.5],
        ['shieldCooldown', 'Phase 1: seconds between shields', 0, 60, 1],
        ['phase2At', 'Phase 2 (enraged) starts at health (%)', 5, 95, 1],
        ['enragedDmg', 'Phase 2: damage (% of normal)', 50, 400, 5],
        ['elimChance', 'Phase 2: chance a heavy hit eliminates a downed raider (%)', 0, 100, 1],
        ['elimMax', 'Phase 2: most of the squad that can be eliminated (%)', 0, 100, 1],
        ['phase3At', 'Phase 3 (true form, flying) starts at health (%)', 1, 90, 1],
        ['trueFormDmg', 'Phase 3: damage (% of normal)', 50, 400, 5],
        ['trueFormRamp', 'Phase 3: extra damage as she nears 0 (%)', 0, 300, 5]
      ]],
      ['Time', [
        ['timeLimit', 'Raid time limit (seconds)', 60, 600, 5],
        ['extendSecs', 'Extra time per "time" cheer (seconds)', 0, 120, 5],
        ['maxExtends', 'Most extra-time cheers per raid', 0, 20, 1],
        ['extendCost', 'Support needed per extra time (points, 100 bits = 1)', 1, 50, 1]
      ]],
      ['The Queen', [
        ['queenSecs', 'Queen health (seconds of average damage)', 10, 600, 5],
        ['plates', 'Armour plates', 1, 8, 1],
        ['armourShare', 'Armour share of her health (%)', 0, 90, 1],
        ['levelMin', 'Random strength, low (%)', 10, 300, 1],
        ['levelMax', 'Random strength, high (%)', 10, 300, 1],
        ['queenDmgMin', 'Queen damage, low', 0, 300, 1],
        ['queenDmgMax', 'Queen damage, high', 0, 300, 1],
        ['queenHitMult', 'Queen accuracy (x)', 0, 5, 0.1],
        ['queenEveryMin', 'Seconds between attacks, low', 1, 30, 1],
        ['queenEveryMax', 'Seconds between attacks, high', 1, 30, 1],
        ['enragedEveryMin', 'Enraged: seconds between attacks, low', 1, 30, 1],
        ['enragedEveryMax', 'Enraged: seconds between attacks, high', 1, 30, 1]
      ]]
    ]
  }
};
const GENERAL_DEFAULTS = { joinSecs: 30, boostSecs: 15, penBoostSecs: 5, startIdleSecs: 10, maxBoost: 10, maxShields: 5 };
const RAID_FLAT = SCHEMA.raid.groups.flatMap((g) => g[1].map((x) => x[0]));

function defaults() {
  const raid = {}; for (const k of RAID_FLAT) raid[k] = ARC.DEFAULTS[k];
  raid.useWinTable = ARC.DEFAULTS.useWinTable;
  raid.winTable = JSON.parse(JSON.stringify(ARC.DEFAULTS.winTable));
  raid.enemies = JSON.parse(JSON.stringify(ARC.DEFAULTS.enemies));
  return { cards: Object.assign({}, ST.CARD_DEFAULTS), general: Object.assign({}, GENERAL_DEFAULTS), shootout: BT.shootoutDefaults(), race: Object.assign({}, RL.DEFAULTS), raid };
}
// current values = defaults with the saved ones on top
function values(cfg) {
  const d = defaults(), t = (cfg && cfg.tuning) || {};
  for (const g of Object.keys(d)) {
    const src = t[g] || {};
    for (const k of Object.keys(d[g])) {
      if (src[k] == null) continue;
      if (k === 'enemies') { for (const e of Object.keys(d[g].enemies)) Object.assign(d[g].enemies[e], (src.enemies || {})[e] || {}); }
      else d[g][k] = src[k];
    }
  }
  return d;
}
function clampAll(v) {
  for (const g of Object.keys(SCHEMA)) for (const [, items] of SCHEMA[g].groups) for (const [k, , min, max] of items) {
    const x = +v[g][k];
    v[g][k] = isFinite(x) ? Math.max(min, Math.min(max, x)) : defaults()[g][k];
  }
  const r = v.raid;
  r.useWinTable = !!r.useWinTable;
  r.winTable = (Array.isArray(r.winTable) ? r.winTable : []).map((x) => { const pct = Math.max(0, Math.min(100, Math.round(+x.pct || 0))); return { upTo: Math.max(1, Math.min(9999, Math.round(+x.upTo || 1))), pct, pctSupport: Math.max(pct, Math.min(100, Math.round(x.pctSupport != null ? +x.pctSupport : pct))) }; })
    .sort((a, b) => a.upTo - b.upTo).filter((x, i, a) => i === 0 || x.upTo !== a[i - 1].upTo).slice(0, 12);
  if (!r.winTable.length) r.winTable = defaults().raid.winTable;
  r.winTable[r.winTable.length - 1].upTo = 9999;   // last row covers everyone above
  for (const e of Object.keys(r.enemies)) {
    const E = r.enemies[e] || {};
    r.enemies[e] = { spawn: Math.max(0, Math.min(100, +E.spawn || 0)), hp: Math.max(0.1, Math.min(10, +E.hp || 1)), dmg: Math.max(0, Math.min(10, +E.dmg || 0)), hit: Math.max(0, Math.min(10, +E.hit || 0)) };
  }
  if (r.reviveMax < r.reviveMin) r.reviveMax = r.reviveMin;
  if (r.swarmMax < r.swarmMin) r.swarmMax = r.swarmMin;
  return v;
}
// older saves: race was 43s and the raid table had a single column. Move them to the new defaults once.
function migrate(cfg) {
  const t = cfg && cfg.tuning; if (!t) return false;
  const ver = cfg.tuningVer || 1;
  if (ver >= 4) return false;
  if (ver < 2) {
    if (t.race && +t.race.raceTicks === 43) t.race.raceTicks = 73;
    if (t.raid) {
      if (Array.isArray(t.raid.winTable) && t.raid.winTable.some((r) => r.pctSupport == null)) t.raid.winTable = JSON.parse(JSON.stringify(ARC.DEFAULTS.winTable));
      delete t.raid.activitySwing; delete t.raid.boostBonus; delete t.raid.boostBonusMax;
    }
  }
  // v17: shootouts were too hard (about 1 in 2 scored). Old default values move to the new ones; your own changes stay.
  if (t.shootout && ver < 3) {
    const o = t.shootout, swap = (k, from, to) => { if (+o[k] === from) o[k] = to; };
    swap('goalPct', 60, 70); swap('comp_drain', 4, 2); swap('comp_sdDrain', 9, 6); swap('comp_sdShock', 12, 10); swap('comp_fail', 8, 4); swap('comp_crowdMax', 8, 5);
  }
  // v18: centre was the easy pick. The keeper stays in the middle more (old default 24 -> 34)
  if (t.shootout && +t.shootout.keeperCentre === 24) t.shootout.keeperCentre = 34;
  cfg.tuningVer = 4;
  return true;
}
function apply(cfg) {
  migrate(cfg);
  const v = values(cfg);
  ARC.configure(v.raid);
  RL.configure(v.race);
  BT.configureShootout(v.shootout);
  return v;
}
function info() { return { schema: SCHEMA, enemies: ARC.ENEMY_INFO }; }

// quick odds check for the settings page
function simulate(game, n) {
  const N = 300;
  if (game === 'raid') {
    // every raider keeps typing !fire; "with support" = chat sends the full support amount during the swarm
    const card = () => { const o = 40 + Math.floor(Math.random() * 18); const st = {}; for (const k of ['WAT', 'SUB', 'SUP', 'CHT', 'LOY', 'RAI', 'STK']) st[k] = o + Math.floor(Math.random() * 8 - 4); return { ovr: o, stats: st }; };
    const out = [];
    for (const size of [1, 2, 4, 8, 15, 30]) {
      const row = { raiders: size };
      for (const sup of [0, 1]) {
        let wins = 0, time = 0;
        const runs = Math.max(60, Math.round(N / Math.sqrt(size)));
        for (let k = 0; k < runs; k++) {
          const cards = Array.from({ length: size }, card);
          const r = new ARC.QueenRaid(cards, cards.map(() => 0));
          const cool = cards.map(() => 0);
          let given = false;
          while (!r.done) {
            cards.forEach((x, i) => { if (r.t >= cool[i]) { r.fire(i); cool[i] = r.t + Math.max(1, ARC.TUNE.fireCooldown); if (Math.random() < 0.05) r.grenade(i); } });
            if (sup && !given && r.t === 10) { given = true; r.boost(-1, Math.ceil(ARC.TUNE.supportFull)); }
            r.tick();
          }
          if (r.win) { wins++; time += r.t; }
        }
        row[sup ? 'withSupport' : 'noSupport'] = Math.round(wins / runs * 100);
        row[sup ? 'tableSupport' : 'table'] = ARC.TUNE.useWinTable ? Math.round(ARC.winPct(size, sup ? ARC.TUNE.supportFull : 0)) : null;
        if (!sup) row.avgWinSecs = wins ? Math.round(time / wins) : null;
      }
      out.push(row);
    }
    return out;
  }
  if (game === 'race') {
    // one driver uses every turbo and dodges everything, the rest do nothing
    const out = [];
    for (const size of [2, 4, 8]) {
      let wins = 0;
      for (let k = 0; k < N; k++) {
        const cards = Array.from({ length: size }, () => ({ ovr: 60 }));
        const r = new RL.RaceLive(cards, cards.map(() => 0), RL.raceSetup()); r.queued = []; r.pendingHazards = [];
        while (!r.done) { r.turbo(0); r.dodge(0); r.tick(); r.dodge(0); }
        if (r.result().winner === 0) wins++;
      }
      out.push({ drivers: size, fair: Math.round(100 / size), active: Math.round(wins / N * 100) });
    }
    return out;
  }
  return null;
}

module.exports = { migrate, SCHEMA, defaults, values, clampAll, apply, info, simulate, GENERAL_DEFAULTS };
