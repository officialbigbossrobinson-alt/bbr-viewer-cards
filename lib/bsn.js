// BOSS SPORTS NEWS, built into the BBR app (it used to be its own Python server on port 8765).
//  * real scores from ESPN for the ticker (no API key)
//  * goal alerts for chosen leagues: a small GOAL flash in the ticker, or the full TV treatment
//    (breaking band, 3D reconstruction with your game in a box, your report) for big moments
//  * your team: every goal they score gets the full treatment (goals against them are ignored)
//  * VAR alerts, hold alerts ("while you were playing" summary), full-time round-up
//  * !lastgoal (anyone) and !roundup (you + mods) on Twitch, Kick and YouTube
// Settings live in config.json under "bsn" and are edited on the settings page (Sports News).
const fs = require('fs');
const path = require('path');

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', Accept: 'application/json, text/plain, */*' };
const SLUG_OK = /^[a-z0-9.]+$/, DATES_OK = /^\d{8}(-\d{8})?$/;

const LEAGUES = [
  ['eng.1', 'PREMIER LEAGUE', 1], ['uefa.champions', 'CHAMPIONS LEAGUE', 1], ['uefa.europa', 'EUROPA LEAGUE'], ['esp.1', 'LA LIGA'], ['ita.1', 'SERIE A'],
  ['ger.1', 'BUNDESLIGA'], ['fra.1', 'LIGUE 1'], ['fifa.world', 'WORLD CUP'], ['uefa.euro', 'EURO'], ['uefa.nations', 'NATIONS LEAGUE'],
  ['fifa.worldq.uefa', 'WORLD CUP QUALIFIERS'], ['uefa.euroq', 'EURO QUALIFIERS'], ['fifa.friendly', 'INTERNATIONAL FRIENDLY'],
  ['eng.2', 'CHAMPIONSHIP', 0, 0], ['sco.1', 'SCOTTISH PREMIERSHIP', 0, 0], ['ned.1', 'EREDIVISIE', 0, 0], ['por.1', 'PRIMEIRA LIGA', 0, 0],
  ['eng.fa', 'FA CUP', 0, 0], ['eng.league_cup', 'LEAGUE CUP', 0, 0], ['uefa.europa.conf', 'CONFERENCE LEAGUE', 0, 0]
].map(([slug, name, alerts, ticker]) => ({ slug, name, alerts: !!alerts, ticker: ticker !== 0 }));

const TEMPLATES = [
  ['BREAKING', '{p} SPOTTED LEAVING THE TRAINING GROUND IN A HURRY — {club} REFUSE TO COMMENT'],
  ['BREAKING', '{club} CONFIRM {p} WILL TAKE PENALTIES THIS WEEKEND — FANS ALREADY BRACING'],
  ['BREAKING', '{owner} SPOTTED IN THE DIRECTORS’ BOX TAKING NOTES DURING {p}’S WARM-UP'],
  ['TRANSFER WHISPERS', '{suitor} WEIGHING UP A SHOCK BID FOR {p}'],
  ['TRANSFER WHISPERS', '{p}’S AGENT SEEN AT THE AIRPORT — FANS FEAR THE WORST'],
  ['TRANSFER WHISPERS', '{p} SAID TO BE “FLATTERED” BY INTEREST FROM {suitor}'],
  ['TRANSFER WHISPERS', '{club} PREPARED TO LISTEN TO OFFERS FOR {p} IN THE REGION OF {fee}'],
  ['RUMOUR MILL', '{p} AND {q} NO LONGER SHARING A LIFT TO TRAINING, SOURCES CLAIM'],
  ['RUMOUR MILL', '{p} SEEN HAVING DINNER WITH {rival} — {club} FANS DEMAND ANSWERS'],
  ['RUMOUR MILL', '{p} AND {q} NOW COMMUNICATING EXCLUSIVELY THROUGH {manager}'],
  ['DRESSING ROOM', '{p} PUT IN CHARGE OF THE MATCHDAY PLAYLIST — MORALE SAID TO BE AT AN ALL-TIME LOW'],
  ['DRESSING ROOM', '{p} CALLED IN BY {manager} OVER EXCESSIVE USE OF THE SKILL MOVE BUTTON'],
  ['DRESSING ROOM', 'SPECULATION GROWS THAT {p} COULD BE IN LINE FOR A BIGGER LEADERSHIP ROLE'],
  ['TRAINING GROUND', '{p} NUTMEGS {q} THREE TIMES IN ONE SESSION — {q} REPORTEDLY DEMANDING A REMATCH'],
  ['TRAINING GROUND', '{q} LEFT FURIOUS AFTER {p} SCORES A CHEEKY PANENKA PAST HIM IN SHOOTING PRACTICE'],
  ['TRAINING GROUND', 'UNCONFIRMED TALK OF A RIFT BETWEEN {p} AND {q} AFTER A FIERY FIVE-A-SIDE'],
  ['FITNESS UPDATE', '{p} A DOUBT FOR THE WEEKEND AFTER PULLING A HAMSTRING CELEBRATING A TRAINING GOAL'],
  ['FITNESS UPDATE', '{p} INSISTS HE IS “FEELING SHARP” DESPITE MISSING EVERY SHOT IN FINISHING DRILLS'],
  ['FITNESS UPDATE', '{p} PASSES MEDICAL AT THE SECOND ATTEMPT AFTER STOPPING AT LEVEL {n} ON THE BLEEP TEST'],
  ['OWNER WATCH', '{owner} SAID TO BE DRAWING UP A SHORTLIST OF NEW MANAGERS — JUST IN CASE'],
  ['OWNER WATCH', '{owner} PROMISES A “SIGNIFICANT” TRANSFER BUDGET, BELIEVED TO BE AROUND {fee}'],
  ['OWNER WATCH', '{owner} REPORTEDLY KEEPING A CLOSE EYE ON {club} PERFORMANCES'],
  ['CONTRACT CHAT', '{p} REJECTS NEW DEAL AFTER A DISPUTE OVER SHIRT NUMBERS'],
  ['CONTRACT CHAT', '{p} CLOSE TO AN EXTENSION AFTER {club} AGREE TO UNLIMITED POST-MATCH PIZZA'],
  ['CONTRACT CHAT', '{p} WANTS A RELEASE CLAUSE IN CASE {suitor} COMES CALLING'],
  ['TACTICAL TALK', '{manager} TRIALLING A BOLD 2-3-5 — {p} UNSURE WHERE HE IS MEANT TO STAND'],
  ['TACTICAL TALK', '{manager} UNDER PRESSURE TO START {p} AFTER A RUN OF ASSURED DISPLAYS'],
  ['TACTICAL TALK', '{manager} FACING BIG DECISIONS AS {club} CHASE PROMOTION'],
  ['SELECTION TALK', '{p} TIPPED TO START AHEAD OF {q} IN A SHOCK SELECTION CALL'],
  ['SELECTION TALK', '{p} DETERMINED TO LET HIS FOOTBALL DO THE TALKING AMID RUMOURS OF A DROP'],
  ['CAPTAINCY', '{captain} REFUSES TO HAND OVER THE ARMBAND, CITING “VIBES”'],
  ['CAPTAINCY', '{captain} CLAIMS {club} ARE “THE BEST TEAM IN THE DIVISION IF YOU IGNORE THE RESULTS”'],
  ['RIVAL WATCH', '{rival} TAKES A SWIPE AT {club}, CALLING THEIR DEFENDING “OPTIONAL”'],
  ['RIVAL WATCH', '{rival} REPORTEDLY TRIED TO TAP UP {p} WITH A PARTY CHAT INVITE'],
  ['SCOUTING WATCH', 'SCOUTS FROM {suitor} IN ATTENDANCE TO WATCH {p} THIS WEEKEND'],
  ['INTERNATIONAL WATCH', '{p} HOPEFUL OF A SHOCK CALL-UP AFTER POSTING A HIGHLIGHTS REEL'],
  ['STAT ATTACK', '{p} HAS NOW GONE {n} MATCHES WITHOUT PASSING TO {q}'],
  ['STAT ATTACK', '{p} LEADS THE SQUAD IN SPRINTS — MOSTLY BACK TOWARDS HIS OWN GOAL'],
  ['PRESS CONFERENCE', '{manager}: “{p} KNOWS EXACTLY WHAT HE DID”'],
  ['PRESS CONFERENCE', '{manager} REFUSES TO RULE OUT A RETURN FOR {p} AT LEFT BACK'],
  ['FASHION DESK', '{p} ARRIVES AT THE STADIUM IN SLIDERS AND A FULL TRACKSUIT — PUNDITS DIVIDED'],
  ['MEDICAL ROOM', '{p} TREATED FOR CRAMP AFTER A {n}-HOUR GAMING SESSION'],
  ['SQUAD NEWS', '{p} RETURNS TO FULL TRAINING AND IMMEDIATELY CLAIMS THE BEST SEAT ON THE BUS'],
  ['ACADEMY', '{club} YOUNGSTERS SAID TO BE STUDYING {p}’S TACKLING — AS A WARNING']
];

const DEFAULTS = {
  on: true,
  ticker: { speed: 125, between: 3, refresh: 60, upcoming: true, duringBattles: false },
  leagues: LEAGUES,
  myTeam: 'AC Milan',
  myTeamLeagues: [['ita.1', 'SERIE A'], ['ita.coppa_italia', 'COPPA ITALIA'], ['ita.super_cup', 'SUPERCOPPA ITALIANA'], ['uefa.champions', 'CHAMPIONS LEAGUE'], ['uefa.europa', 'EUROPA LEAGUE'], ['uefa.europa.conf', 'CONFERENCE LEAGUE']],
  checkSec: 20, bigMinute: 80, cooldownMin: 10, batchSec: 60, skipUnimportant: false, quietScenes: ['Live'], autoRoundup: true, varAlerts: true,
  holdDuringBattles: true, lastgoalCooldown: 60,
  squad: {
    captain: 'BigBossRobinson', manager: 'BigBossRobinson', owner: 'ELDI EL MUHAMMED', rivalManager: 'CREAMYGLAZE',
    clubs: ['BOSSHAUSENS', 'DIAMOND DOGS', 'PASSTHEBALL UTD'],
    players: ['WillRKO1094', 'Crambeu', 'godfarther2007', 'riley5121', 'Kuroo6833', 'G2_masonL2', 'L0veS05a', 'Raging_Ginge98', 'BigBossRobinson', 'LeeJ2509', 'YNWA GINGE', 'El Kremit',
      'JordoPP', 'BOOF__X', 'Lk Syncs', 'pogsone', 'natsbyrne98', 'ak47_bigsm0kes', 'Daithi_420', 'Angeldimaria91', 'Blake_Mozzy6', 'Snipepro6001', 'CxPabz', 'CoolKid9912',
      'EthanHunt7gamer', 'AdamLallana__', 'LBad-S', 'kenan_zuid', 'Saxczy7858', 'Orichieva', 'read25736884', 'HyVeSniper11', 'StainCare', 'DXTomi', 'RyannnUTB', 'Lingling6534',
      'T3mpss', 'Luca-bazuka2014', 'diegoias03', 'ShatteredVain', 'Kara za 7081', 'CerealCircle528', 'Sycuya', 'Sneakyman420834', 'tigerthetheo', 'Eclipxed', 'BDB_221',
      'rrman7', 'DaAmazingTiDus', 'DkDaVillain_7', 'AbdelWeshh', 'BIH-Begic', 'OatieBoy', 'XLVII-XXIV', 'Gartenboy', 'Torben_758']
  },
  viewersInStories: false,
  suitors: ['A MYSTERY SAUDI PRO LEAGUE CLUB', 'AN UNNAMED SERIE A SIDE', 'A CASH-RICH MLS FRANCHISE', '{rival}’S SIDE', 'A BUNDESLIGA GIANT', 'A NEWLY PROMOTED CHAMPIONSHIP CLUB', 'AN AMBITIOUS LIGUE 1 OUTFIT'],
  fees: ['£12.50', '£40 AND A MEAL DEAL', '£3 MILLION', '£150 MILLION', 'TWO PACKETS OF CRISPS'],
  pinned: [],
  templates: TEMPLATES,
  offCats: []
};
const IMAGES = ['boss-grin', 'boss-grin-bandana', 'boss-celebrate', 'boss-laugh', 'boss-gutted', 'boss-pirate', 'boss-headwrap'];

const TEST = {
  goal: { type: 'goal', comp: 'PREMIER LEAGUE', minute: '67', venue: 'Emirates Stadium', home: 'Arsenal', away: 'Chelsea', hs: 2, as: 1, scorer: 'Bukayo Saka',
    text: 'Goal! Arsenal 2, Chelsea 1. Bukayo Saka (Arsenal) left footed shot from the right side of the box to the bottom left corner. Assisted by Martin Ødegaard with a through ball.' },
  milan: { type: 'goal', comp: 'SERIE A', minute: '58', venue: 'San Siro', my_team: true, home: 'AC Milan', away: 'Inter', hs: 2, as: 1, scorer: 'Rafael Leão',
    text: 'Goal! AC Milan 2, Inter 1. Rafael Leão (AC Milan) left footed shot from the left side of the box to the top right corner. Assisted by Christian Pulisic with a through ball.' },
  var: { type: 'var', comp: 'PREMIER LEAGUE', home: 'Arsenal', away: 'Chelsea', hs: 1, as: 1, minute: '72', venue: 'Emirates Stadium', scorer: 'Kai Havertz' },
  roundup: { type: 'roundup', label: 'TEST', results: [
    { comp: 'PREMIER LEAGUE', home: 'Arsenal', away: 'Chelsea', hs: 2, as: 1 }, { comp: 'PREMIER LEAGUE', home: 'Liverpool', away: 'Man City', hs: 1, as: 1 },
    { comp: 'PREMIER LEAGUE', home: 'Brighton', away: 'Newcastle', hs: 0, as: 3 }, { comp: 'CHAMPIONS LEAGUE', home: 'Real Madrid', away: 'Bayern Munich', hs: 4, as: 0 },
    { comp: 'SERIE A', home: 'AC Milan', away: 'Inter', hs: 2, as: 1, my_team: true }] },
  flash: { type: 'flash', goals: [
    { home: 'Everton', away: 'West Ham', hs: 0, as: 1, scorer: 'Jarrod Bowen', minute: '17', comp: 'PREMIER LEAGUE' },
    { home: 'Brighton', away: 'Chelsea', hs: 2, as: 2, scorer: 'Kaoru Mitoma', minute: '18', comp: 'PREMIER LEAGUE' },
    { home: 'Liverpool', away: 'Man United', hs: 3, as: 1, scorer: 'Mohamed Salah', minute: '18', comp: 'PREMIER LEAGUE' }] },
  summary: { type: 'summary', goals: [
    { home: 'Arsenal', away: 'Chelsea', hs: 2, as: 1, scorer: 'Bukayo Saka', minute: '67', comp: 'PREMIER LEAGUE' },
    { home: 'Brighton', away: 'Newcastle', hs: 0, as: 3, scorer: 'Anthony Gordon', minute: '71', comp: 'PREMIER LEAGUE' },
    { home: 'Arsenal', away: 'Chelsea', hs: 1, as: 1, scorer: 'Kai Havertz', minute: '72', comp: 'PREMIER LEAGUE', var: true }] }
};

const toInt = (v) => { const n = parseInt(v, 10); return isFinite(n) ? n : 0; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
const dayKey = (d) => d.toDateString();

class BSN {
  // o: { cfg(), saveCfg(), obs, push(ev) (to the main overlay), dataDir, publicDir, viewerNames() }
  constructor(o) {
    Object.assign(this, o);
    this.cache = new Map(); this.bus = []; this.held = []; this.nextId = 1;
    this.state = { holding: false, quick: false, sound: true };
    this.battleHold = false;
    this.watch = { matches: 0, live: 0, checked: null, error: null };
    this.lastGoal = null; this.lastGoalByMatch = {}; this.lastLastgoalAt = 0; this.lastFullAt = 0;
    this.batch = []; this.batchStarted = 0;
    this.seenScores = new Map(); this.seenUnfinished = new Set(); this.roundupDone = new Set();
    this.log = []; this.feed = [];
    this.imgDir = path.join(this.dataDir, 'bsn-images');
    setInterval(() => this.batchTick(), 2000).unref();
    this.loop();
  }
  S() {
    const c = this.cfg().bsn || {};
    const s = Object.assign({}, DEFAULTS, c);
    s.ticker = Object.assign({}, DEFAULTS.ticker, c.ticker || {});
    s.squad = Object.assign({}, DEFAULTS.squad, c.squad || {});
    return s;
  }
  note(text) { this.log.push({ at: Date.now(), text }); if (this.log.length > 200) this.log.shift(); }
  addFeed(what, detail, tag) { this.feed.unshift({ at: Date.now(), what, detail, tag }); if (this.feed.length > 30) this.feed.pop(); }

  // ---------- ESPN ----------
  async getJson(url, maxAge) {
    const hit = this.cache.get(url);
    if (hit && Date.now() - hit.at < (maxAge == null ? 30000 : maxAge * 1000)) return hit.data;
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
      if (!r.ok) throw new Error('ESPN replied ' + r.status);
      const data = await r.json();
      this.cache.set(url, { at: Date.now(), data });
      if (this.cache.size > 300) this.cache.delete(this.cache.keys().next().value);
      return data;
    } finally { clearTimeout(t); }
  }
  async scoreboard(slug, dates, maxAge) {
    const base = ESPN + slug + '/scoreboard';
    const days = dates ? dates.split('-') : [];
    const tries = [];
    if (days.length) tries.push(days.map((d) => base + '?dates=' + d));
    tries.push([base]);
    let last = null;
    for (const urls of tries) {
      try {
        const events = [], seen = new Set();
        for (const u of urls) for (const ev of (await this.getJson(u, maxAge)).events || []) { const k = ev.id || ev.date + '-' + events.length; if (!seen.has(k)) { seen.add(k); events.push(ev); } }
        return events;
      } catch (e) { last = e; }
    }
    throw last;
  }

  // ---------- event bus (the ticker page polls /bsn/events) ----------
  _push(ev) { this.bus.push(Object.assign({}, ev, { id: this.nextId++ })); if (this.bus.length > 200) this.bus.splice(0, this.bus.length - 200); }
  holding() { return this.state.holding || this.battleHold; }
  publish(ev) {
    if (!this.S().on) return;
    if (this.holding()) { this.held.push(ev); this.note('Alert held (' + this.held.length + ' waiting): ' + ev.type); return; }
    this._push(ev);
  }
  release() {
    const keep = [], entries = [];
    for (const ev of this.held) {
      const t = ev.type;
      if ((t === 'goal' && (ev.my_team || ev.replay)) || t === 'roundup') keep.push(ev);
      else if (t === 'goal') entries.push(this.entry(ev));
      else if (t === 'flash') entries.push(...(ev.goals || []));
      else if (t === 'var') entries.push(this.entry(ev, true));
    }
    if (entries.length) this._push({ type: 'summary', goals: entries });
    for (const ev of keep) this._push(ev);
    if (this.held.length) this.note('Released ' + this.held.length + ' held alert(s)');
    this.held = [];
  }
  entry(ev, isVar) { return { home: ev.home, away: ev.away, hs: ev.hs, as: ev.as, scorer: ev.scorer, minute: ev.minute, comp: ev.comp, var: !!isVar }; }
  // a battle started / ended: goal takeovers wait so they never cover a battle
  setBattle(active) {
    const S = this.S();
    const want = !!(active && S.holdDuringBattles);
    if (want === this.battleHold) return;
    this.battleHold = want;
    if (!want && !this.state.holding) this.release();
  }
  publicState() {
    const S = this.S(), g = this.lastGoal;
    return {
      on: S.on, holding: this.state.holding, battleHold: this.battleHold, quick: this.state.quick, sound: this.state.sound, held: this.held.length,
      chat_connected: true, chat_channel: 'all platforms', obs_ok: this.obs && this.obs.ready ? true : (this.obs && this.obs.settings().on ? false : null),
      obs_message: this.obs ? (this.obs.ready ? 'ready' : this.obs.error || 'OBS not connected') : '',
      matches_today: this.watch.matches, live_now: this.watch.live, last_check: this.watch.checked, error: this.watch.error,
      full_ready_in: Math.max(0, Math.round((this.lastFullAt + S.cooldownMin * 60000 - Date.now()) / 1000)),
      last_goal: g ? g.home + ' ' + g.hs + '-' + g.as + ' ' + g.away + ' (' + (g.scorer || 'goal') + ')' : null
    };
  }

  // ---------- matches ----------
  isMine(name) { const S = this.S(); const n = String(name || '').toLowerCase(), key = String(S.myTeam || '').toLowerCase().replace(/^ac /, '').trim(); return !!key && n.includes(key) && !n.includes('inter'); }
  mySide(m) { return !this.S().myTeam ? null : this.isMine(m.home) ? 'home' : this.isMine(m.away) ? 'away' : null; }
  goalLeagues() { const o = {}; for (const l of this.S().leagues) if (l.alerts) o[l.slug] = l.name; return o; }
  watched() { const o = this.goalLeagues(); for (const [slug, name] of this.S().myTeamLeagues) if (!o[slug]) o[slug] = name; return o; }
  readMatch(ev, slug, comp) {
    const c = (ev.competitions || [])[0] || {}, teams = c.competitors || [];
    const home = teams.find((t) => t.homeAway === 'home') || teams[0] || {}, away = teams.find((t) => t.homeAway === 'away') || teams[1] || {};
    const st = c.status || ev.status || {}, ty = st.type || {};
    const name = (t) => ((t.team || {}).shortDisplayName || (t.team || {}).displayName || 'TBC');
    return { id: ev.id, slug, comp, home: name(home), away: name(away), home_id: (home.team || {}).id, away_id: (away.team || {}).id, hs: toInt(home.score), as: toInt(away.score),
      state: ty.state || '', status_name: ty.name || '', clock: st.displayClock || '', venue: (c.venue || {}).fullName || '', date: ev.date || '', details: c.details || [] };
  }
  minuteOf(clock) { const m = /\s*(\d+)(?:'|\s*\+\s*(\d+))?/.exec(clock || ''); return m ? m[1] + (m[2] ? '+' + m[2] : '') : ''; }
  findGoalText(summary, score) {
    let best = null;
    const walk = (o) => {
      if (typeof o === 'string') {
        const low = o.toLowerCase();
        if (!low.includes('goal') || o.length > 600) return;
        const re = /([A-Za-z][^,.!]*?)\s(\d+),\s([A-Za-z][^,.!]*?)\s(\d+)\./g; let m;
        while ((m = re.exec(o))) if (toInt(m[2]) === score[0] && toInt(m[4]) === score[1]) { const rank = /^(goal!|own goal)/.test(low) ? 2 : 1; if (!best || rank > best[0] || (rank === best[0] && o.length > best[1].length)) best = [rank, o.trim()]; }
      } else if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') Object.values(o).forEach(walk);
    };
    walk(summary);
    return best ? best[1] : null;
  }
  async fallbackText(m, score) {
    let details = m.details;
    try { const fresh = await this.scoreboard(m.slug, ymd(new Date()), 0); const ev = fresh.find((e) => e.id === m.id); details = (((ev || {}).competitions || [{}])[0] || {}).details || details; } catch (e) { /* use what we have */ }
    const goals = details.filter((d) => d.scoringPlay);
    const head = 'Goal! ' + m.home + ' ' + score[0] + ', ' + m.away + ' ' + score[1] + '.';
    if (!goals.length) return head;
    const d = goals[goals.length - 1], people = d.athletesInvolved || [];
    const scorer = people[0] && (people[0].displayName || people[0].shortName);
    if (!scorer) return head;
    const tid = (d.team || {}).id, team = tid === m.home_id ? m.home : tid === m.away_id ? m.away : null, kind = String((d.type || {}).text || '').toLowerCase();
    if (kind.includes('own')) return 'Own Goal by ' + scorer + ', ' + (team === m.home ? m.away : m.home) + '. ' + m.home + ' ' + score[0] + ', ' + m.away + ' ' + score[1] + '.';
    return head + ' ' + scorer + ' (' + (team || '') + ') ' + (kind.includes('penalty') ? 'converts the penalty' : kind.includes('header') ? 'header' : 'scores') + '.';
  }
  async handleGoal(m, score, mine, big, unimportant) {
    let text = null;
    for (const wait of [0, 10, 10, 10, 15]) {
      await sleep(wait * 1000);
      try {
        const summary = await this.getJson(ESPN + m.slug + '/summary?event=' + m.id, 0);
        try { fs.writeFileSync(path.join(this.dataDir, 'last_goal_debug.json'), JSON.stringify(summary)); } catch (e) { /* ignore */ }
        text = this.findGoalText(summary, score);
      } catch (e) { /* not ready yet */ }
      if (text) break;
    }
    if (!text) text = await this.fallbackText(m, score);
    const pm = /\.\s([^.()]+?)\s\(/.exec(text) || /Own Goal by ([^,]+),/.exec(text);
    const ev = { type: 'goal', text, comp: m.comp, minute: this.minuteOf(m.clock), venue: m.venue, home: m.home, away: m.away, hs: score[0], as: score[1], scorer: pm ? pm[1].trim() : null, my_team: mine };
    this.lastGoal = ev; this.lastGoalByMatch[m.id] = ev;
    await this.routeGoal(ev, big, unimportant);
  }
  isBig(m, score, side) {
    const mm = /\s*(\d+)/.exec(m.clock || ''); if (!mm || toInt(mm[1]) < this.S().bigMinute) return false;
    const [h, a] = score, mine = side === 'home' ? h : a, theirs = side === 'home' ? a : h;
    return mine - theirs === 0 || mine - theirs === 1;
  }
  isUnimportant(score, side) { const [h, a] = score, mine = side === 'home' ? h : a, theirs = side === 'home' ? a : h; return mine - 1 - theirs >= 3; }
  async scene() { try { if (!this.obs || !this.obs.ready) return null; const r = await this.obs.req('GetCurrentProgramScene'); return r.sceneName || r.currentProgramSceneName; } catch (e) { return null; } }
  async routeGoal(ev, big, unimportant) {
    const S = this.S(), label = ev.home + ' ' + ev.hs + '-' + ev.as + ' ' + ev.away + ' (' + (ev.scorer || 'scorer unknown') + ')';
    if (ev.my_team) { this.note('GOAL (' + S.myTeam + '): ' + label + ' - full alert'); this.addFeed(S.myTeam + ' goal' + (ev.minute ? ' (' + ev.minute + '’)' : ''), 'Full takeover: ' + label, this.holding() ? 'HELD' : 'TAKEOVER'); this.publish(ev); return; }
    if (big) {
      const wait = this.lastFullAt + S.cooldownMin * 60000 - Date.now(), sc = await this.scene();
      if (wait <= 0 && !(sc && S.quietScenes.includes(sc))) { this.lastFullAt = Date.now(); this.addFeed('Big moment: ' + ev.comp, 'Full takeover: ' + label, this.holding() ? 'HELD' : 'TAKEOVER'); this.publish(ev); return; }
    }
    if (unimportant && S.skipUnimportant) { this.addFeed('Goal skipped', label + ' (game already won)', 'SKIPPED'); return; }
    this.addFeed(ev.comp + ' goal', 'Ticker flash: ' + label, this.holding() ? 'HELD' : 'FLASH');
    if (!this.batch.length) this.batchStarted = Date.now();
    this.batch.push(this.entry(ev));
  }
  batchTick() { if (this.batch.length && Date.now() - this.batchStarted >= this.S().batchSec * 1000) { const goals = this.batch; this.batch = []; this.publish({ type: 'flash', goals }); } }
  roundupEvent(matches, label) {
    const order = Object.values(this.watched());
    const done = matches.filter((m) => m.state === 'post' && !/POSTPONED|CANCEL|ABANDON/.test(m.status_name))
      .sort((a, b) => ((order.indexOf(a.comp) + 1 || 99) - (order.indexOf(b.comp) + 1 || 99)) || String(a.date).localeCompare(String(b.date)));
    return { type: 'roundup', label, results: done.map((m) => ({ comp: m.comp, home: m.home, away: m.away, hs: m.hs, as: m.as, my_team: !!this.mySide(m) })) };
  }
  async roundupNow() {
    const gl = this.goalLeagues();
    for (const [off, label] of [[0, 'TODAY'], [1, 'YESTERDAY']]) {
      const day = new Date(Date.now() - off * 86400000), matches = [];
      for (const [slug, name] of Object.entries(this.watched())) {
        try { for (const ev of await this.scoreboard(slug, ymd(day))) { const m = this.readMatch(ev, slug, name); if (!gl[slug] && !this.mySide(m)) continue; if (m.date && dayKey(new Date(m.date)) === dayKey(day)) matches.push(m); } } catch (e) { /* skip */ }
      }
      const ev = this.roundupEvent(matches, label);
      if (ev.results.length) return ev;
    }
    return null;
  }
  async checkGoals() {
    const S = this.S(), today = new Date(), todays = [], gl = this.goalLeagues();
    let errors = 0, total = 0;
    for (const [slug, name] of Object.entries(this.watched())) {
      total++;
      let events;
      try { events = await this.scoreboard(slug, ymd(today), S.checkSec - 3); } catch (e) { errors++; continue; }
      for (const ev of events) {
        const m = this.readMatch(ev, slug, name), side = this.mySide(m);
        if (!m.id || (!gl[slug] && !side)) continue;
        if (m.date && dayKey(new Date(m.date)) === dayKey(today)) todays.push(m);
        if (m.state === 'pre' || m.state === 'in') this.seenUnfinished.add(m.id);
        const now = [m.hs, m.as], prev = this.seenScores.get(m.id);
        this.seenScores.set(m.id, now);
        if (!prev || m.state === 'pre') continue;
        if (now[0] + now[1] > prev[0] + prev[1]) {
          let [h, a] = prev;
          while (h !== now[0] || a !== now[1]) {
            let scorer;
            if (h < now[0]) { h++; scorer = 'home'; } else if (a < now[1]) { a++; scorer = 'away'; } else break;
            if (side && scorer !== side) continue;   // goals against your team are ignored
            this.handleGoal(m, [h, a], !!side, this.isBig(m, [h, a], scorer), this.isUnimportant([h, a], scorer)).catch((e) => this.note('Goal problem: ' + e.message));
          }
        } else if (now[0] + now[1] < prev[0] + prev[1] && S.varAlerts) {
          const from = now[0] < prev[0] ? 'home' : 'away';
          if (side && from !== side) continue;
          const before = this.lastGoalByMatch[m.id] || {};
          this.addFeed('Goal taken off by VAR', m.home + ' ' + now[0] + '-' + now[1] + ' ' + m.away, 'VAR');
          this.publish({ type: 'var', home: m.home, away: m.away, hs: now[0], as: now[1], comp: m.comp, minute: this.minuteOf(m.clock), venue: m.venue, scorer: before.scorer, my_team: !!side });
        }
      }
    }
    this.lastTodays = todays; this.lastTodaysAt = Date.now();
    this.watch = { matches: todays.length, live: todays.filter((m) => m.state === 'in').length, checked: Date.now(), error: total && errors === total ? 'Can\'t reach ESPN (internet down or blocked?)' : null };
    const key = today.toDateString();
    if (S.autoRoundup && todays.length && !this.roundupDone.has(key)) {
      const real = todays.filter((m) => !/POSTPONED|CANCEL/.test(m.status_name));
      if (real.length && real.every((m) => m.state === 'post') && real.some((m) => this.seenUnfinished.has(m.id))) { this.roundupDone.add(key); this.addFeed('Full-time round-up', real.length + ' results', 'ROUND-UP'); this.publish(this.roundupEvent(real, 'TODAY')); }
    }
  }
  async loop() {
    try { if (this.S().on) await this.checkGoals(); } catch (e) { this.note('Goal watch problem: ' + e.message); }
    setTimeout(() => this.loop(), Math.max(10, this.S().checkSec) * 1000).unref();
  }

  // ---------- commands ----------
  lastgoal(who, force) {
    if (!this.lastGoal) return 'no goal yet';
    if (!force && Date.now() - this.lastLastgoalAt < this.S().lastgoalCooldown * 1000) return 'cooling down';
    this.lastLastgoalAt = Date.now();
    const clean = String(who || '').replace(/[^\w .-]/g, '').slice(0, 25) || 'CHAT';
    this.addFeed('!lastgoal from ' + clean, 'Replayed the last goal', 'CHAT');
    this.publish(Object.assign({}, this.lastGoal, { replay: true, requested_by: clean }));
    return 'ok';
  }
  async command(name) {
    if (name === 'toggle-hold') { if (this.state.holding) { this.state.holding = false; if (!this.battleHold) this.release(); } else this.state.holding = true; }
    else if (name === 'hold') this.state.holding = true;
    else if (name === 'release') { this.state.holding = false; if (!this.battleHold) this.release(); }
    else if (name === 'quick') this.state.quick = !this.state.quick;
    else if (name === 'sound') this.state.sound = !this.state.sound;
    else if (name === 'lastgoal') this.lastgoal('THE BOSS', true);
    else if (name === 'roundup') { const ev = await this.roundupNow(); if (ev) this.publish(ev); else this.note('Round-up: no finished games today or yesterday'); }
    else if (/^test-(goal|milan|var|roundup|flash|summary)$/.test(name)) this.publish(JSON.parse(JSON.stringify(TEST[name.slice(5)])));
    else return false;
    return true;
  }
  // chat: !lastgoal (anyone) and !roundup (you + mods), on every platform
  async chat(cmd, who, isMod) {
    if (!this.S().on) return false;
    if (cmd === '!lastgoal') { this.lastgoal(who); return true; }
    if (cmd === '!roundup' && isMod) { const ev = await this.roundupNow(); if (ev) this.publish(ev); return true; }
    return false;
  }

  // ---------- what the ticker page needs ----------
  tickerConfig() {
    const S = this.S(), clean = S.cleanNames !== false;
    const map = nameMap(S.squad.players), nm = (x) => { const k = String(x || '').trim(); return k ? (map[k.toLowerCase()] || (clean ? niceName(k) : k)) : ''; };
    let players = S.squad.players.map((l) => nm(String(l).split('=')[0]));
    if (S.viewersInStories && this.viewerNames) players = players.concat(this.viewerNames().slice(0, 40).map(nm));
    players = Array.from(new Set(players.filter(Boolean)));
    const sq = Object.assign({}, S.squad, { captain: nm(S.squad.captain) || 'THE CAPTAIN', manager: nm(S.squad.manager) || 'THE MANAGER', owner: nm(S.squad.owner) || 'THE OWNER', rivalManager: nm(S.squad.rivalManager) || 'A RIVAL MANAGER', clubs: (S.squad.clubs || []).filter(Boolean).length ? S.squad.clubs.filter(Boolean) : ['THE CLUB'] });
    if (players.length < 2) players = players.concat(['THE NEW SIGNING', 'THE KIT MAN']).slice(0, 2);
    const off = new Set(S.offCats || []);
    const templates = S.templates.filter(([label]) => !off.has(label));
    return {
      squad: Object.assign(sq, { players }), suitors: (S.suitors || []).map(normTokens), fees: S.fees, pinned: (S.pinned || []).map(([l, t]) => [l, normTokens(t)]), templates: (templates.length ? templates : S.templates).map(([l, t]) => [l, normTokens(t)]),
      leagues: S.leagues.filter((l) => l.ticker).map((l) => [l.slug, l.name]), ticker: S.ticker, myTeam: S.myTeam
    };
  }
  image(name) {
    const base = path.basename(name).replace(/\.(jpe?g|png)$/i, '');
    if (!IMAGES.includes(base)) return null;
    for (const ext of ['.jpg', '.png']) { const f = path.join(this.imgDir, base + ext); if (fs.existsSync(f)) return f; }
    const f = path.join(this.publicDir, 'bsn', 'images', base + '.jpg');
    return fs.existsSync(f) ? f : null;
  }
  saveImage(name, dataUrl) {
    if (!IMAGES.includes(name)) throw new Error('Unknown picture');
    const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
    if (!m) throw new Error('Use a JPG or PNG picture');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4 * 1024 * 1024) throw new Error('Picture too big (max 4 MB)');
    fs.mkdirSync(this.imgDir, { recursive: true });
    for (const ext of ['.jpg', '.png']) try { fs.unlinkSync(path.join(this.imgDir, name + ext)); } catch (e) { /* none */ }
    fs.writeFileSync(path.join(this.imgDir, name + (m[1] === 'png' ? '.png' : '.jpg')), buf);
  }

  // handles /bsn/* requests. Returns true if it answered.
  async http(p, url, req, res, send) {
    if (p === '/bsn/events') {
      const after = /^-?\d+$/.test(url.searchParams.get('after') || '') ? parseInt(url.searchParams.get('after'), 10) : -1;
      return send(res, 200, { last_id: this.nextId - 1, events: after < 0 ? [] : this.bus.filter((e) => e.id > after), state: this.publicState() }), true;
    }
    if (p === '/bsn/state') return send(res, 200, this.publicState()), true;
    if (p === '/bsn/config') return send(res, 200, this.tickerConfig()), true;
    const cm = /^\/bsn\/command\/([a-z-]+)$/.exec(p);
    if (cm) { const ok = await this.command(cm[1]); return send(res, ok ? 200 : 404, { ok, state: this.publicState() }), true; }
    if (p === '/bsn/obs/check') { if (this.obs) await this.obs.connect().catch(() => {}); return send(res, 200, this.publicState()), true; }
    if (p === '/bsn/obs/gamebox') {
      const on = url.searchParams.get('on') === '1';
      if (!this.obs || !this.obs.settings().on) return send(res, 200, { ok: false, message: 'OBS control is off' }), true;
      try {
        if (on) {
          if (this.obs.cornered) return send(res, 200, { ok: false, message: 'a battle has the screen' }), true;
          const v = ['x', 'y', 'w', 'h'].map((k) => parseFloat(url.searchParams.get(k)) || 0);
          await this.obs.toCorner({ x: v[0], y: v[1], w: v[2], h: v[3] }); this.boxOn = true;
        } else if (this.boxOn) { this.boxOn = false; await this.obs.restore(); }   // only undo our own move, never a battle's
        return send(res, 200, { ok: true }), true;
      } catch (e) { return send(res, 200, { ok: false, message: e.message }), true; }
    }
    const em = /^\/bsn\/espn\/([^/]+)\/scoreboard$/.exec(p);
    if (em) {
      const slug = em[1], dates = url.searchParams.get('dates') || '';
      if (!SLUG_OK.test(slug) || (dates && !DATES_OK.test(dates))) return send(res, 400, { error: 'bad request' }), true;
      try { return send(res, 200, { events: await this.scoreboard(slug, dates) }), true; } catch (e) { return send(res, 502, { error: e.message }), true; }
    }
    const im = /^\/bsn\/images\/([\w-]+\.(?:jpg|jpeg|png))$/.exec(p);
    if (im) {
      const f = this.image(im[1]); if (!f) return send(res, 404, 'not found', 'text/plain'), true;
      res.writeHead(200, { 'Content-Type': f.endsWith('.png') ? 'image/png' : 'image/jpeg', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res); return true;
    }
    const files = { '/bsn/': 'ticker.html', '/bsn': 'ticker.html', '/bsn/ticker.html': 'ticker.html', '/bsn/control': 'control.html', '/bsn/goalflash.js': 'goalflash.js', '/bsn/goalflash.css': 'goalflash.css' };
    if (files[p]) {
      if (p === '/bsn') { res.writeHead(302, { Location: '/bsn/' }); res.end(); return true; }
      const f = path.join(this.publicDir, 'bsn', files[p]);
      const type = f.endsWith('.js') ? 'text/javascript; charset=utf-8' : f.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(res); return true;
    }
    return false;
  }
}

// Gamertags into names for the ticker: WillRKO1094 -> WILL RKO, Daithi_420 -> DAITHI, L0veS05a -> LOVESOSA.
// "tag = NAME" in the squad list wins over the automatic name.
function nameMap(lines) { const m = {}; for (const l of lines || []) { const i = String(l).indexOf('='); if (i > 0) { const k = l.slice(0, i).trim().toLowerCase(), v = l.slice(i + 1).trim(); if (k && v) m[k] = v.toUpperCase(); } } return m; }
function niceName(tag) {
  let t = String(tag || '').trim();
  if (!t) return '';
  t = t.replace(/^[xX]{1,2}(?=[A-Z0-9_])/, '').replace(/(?<=[a-z0-9_])[xX]{1,2}$/, '');
  t = t.replace(/[_\-.]+/g, ' ');
  const words = t.split(/\s+/).map((w) => {
    w = w.replace(/\d+$/, '');                                    // numbers on the end
    w = w.replace(/^\d+(?=[A-Za-z]{3})/, '');                      // numbers at the start of a word
    if (/^[A-Za-z][A-Za-z0135]*[A-Za-z]$/.test(w) && /[0135]/.test(w)) w = w.replace(/[0135]/g, (d) => ({ 0: 'o', 1: 'i', 3: 'e', 5: 's' }[d]));   // leet: L0veS05a -> LoveSOSa
    if (/[A-Za-z]\d|\d[A-Za-z]/.test(w)) {
      w = w.replace(/(?<=[A-Za-z])[0135](?=[A-Za-z])|(?<=[A-Za-z]{2})[0135]$|^[0135](?=[A-Za-z]{2})/g, (d) => ({ 0: 'o', 1: 'i', 3: 'e', 5: 's' }[d]));   // leet: L0ve -> Love
      w = w.replace(/\d+/g, ' ');
    }
    w = w.replace(/([a-z]{3,})[A-Z]$/, '$1');                     // masonL -> mason
    let prev; do { prev = w; w = w.replace(/([a-z])([A-Z][a-z]{2,})/, '$1 $2'); } while (w !== prev);   // AdamLallana -> Adam Lallana
    return w.replace(/([a-z]{2,})([A-Z]{2,})$/, '$1 $2');           // WillRKO -> Will RKO
  }).join(' ').split(/\s+/).filter((w) => w.length > 1 || /^[A-Z]$/.test(w) && false);
  const out = words.join(' ').trim().toUpperCase();
  return out.length >= 2 ? out : String(tag).trim().toUpperCase();
}
// placeholders written any way ([p], (P), {player}, <club>, [team] ...) become the ones the ticker knows: {p} {q} {club} ...
const TOKEN_ALIAS = { p: 'p', player: 'p', player1: 'p', name: 'p', q: 'q', player2: 'q', other: 'q', club: 'club', team: 'club', owner: 'owner', chairman: 'owner', rival: 'rival', manager: 'manager', boss: 'manager', captain: 'captain', skipper: 'captain', suitor: 'suitor', fee: 'fee', n: 'n', number: 'n' };
const TOKEN_RE = /[\[{(<]\s*(player1|player2|player|name|other|p|q|club|team|owner|chairman|rival|manager|boss|captain|skipper|suitor|fee|number|n)\s*[\]})>]/gi;
function normTokens(t) { return String(t == null ? '' : t).replace(TOKEN_RE, (m, k) => '{' + TOKEN_ALIAS[k.toLowerCase()] + '}'); }
const LEFTOVER_RE = /[\[{<][^\]}>]{1,14}[\]}>]/g;
// fill one headline the same way the ticker does (used for the dashboard check)
function fillStory(text, c, pick) {
  pick = pick || ((l) => l[Math.floor(Math.random() * l.length)]);
  const sq = c.squad || {}, pl = sq.players || [], p = pick(pl) || 'THE NEW SIGNING', q = pick(pl.filter((x) => x !== p)) || 'THE KIT MAN';
  return normTokens(text).replaceAll('{suitor}', pick(c.suitors || []) || 'A MYSTERY CLUB').replaceAll('{p}', p).replaceAll('{q}', q).replaceAll('{captain}', sq.captain || 'THE CAPTAIN')
    .replaceAll('{manager}', sq.manager || 'THE MANAGER').replaceAll('{owner}', sq.owner || 'THE OWNER').replaceAll('{rival}', sq.rivalManager || 'A RIVAL MANAGER')
    .replaceAll('{club}', pick(sq.clubs || []) || 'THE CLUB').replaceAll('{fee}', pick(c.fees || []) || '£5').replaceAll('{n}', String(3 + Math.floor(Math.random() * 12)));
}
module.exports = { BSN, BSN_DEFAULTS: DEFAULTS, BSN_IMAGES: IMAGES, niceName, nameMap, normTokens, fillStory, LEFTOVER_RE };
