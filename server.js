// BBR Viewer Cards — runs on your streaming PC. Twitch, Kick and YouTube are treated equally.
// Dashboard: http://localhost:3000   OBS browser source: http://localhost:3000/overlay
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Store = require('./lib/store');
const Twitch = require('./lib/twitch');
const Kick = require('./lib/kick');
const YouTube = require('./lib/youtube');
const S = require('./lib/stats');
const { Battle } = require('./lib/battle');
const TK = require('./lib/tickets');
// Giveaways, tickets and the prize pot are switched OFF unless turned on in Settings (data is kept).
const GA_ON = () => cfg.giveawaysOn === true;
const SC = require('./lib/schedule');
const TU = require('./lib/tuning');
const { OBS } = require('./lib/obs');
const { Diag } = require('./lib/diag');
const { BSN, BSN_IMAGES, normTokens, fillStory, LEFTOVER_RE } = require('./lib/bsn');
const APP_VERSION = '39';
const ARCX = require('./lib/arc');
const RLX = require('./lib/race');
const BTX = require('./lib/battle');

const ROOT = __dirname;
// v36: the desktop app keeps your settings, logins and data in your user folder (%APPDATA%\BBR Viewer Cards),
// so updates never touch them. Started by hand ("Start BBR Cards.bat") everything stays in this folder, as before.
const HOME = process.env.BBR_HOME ? path.resolve(process.env.BBR_HOME) : ROOT;
try { fs.mkdirSync(HOME, { recursive: true }); } catch (e) { /* reported when saving */ }
const DATA = path.join(HOME, 'data');
const CFG_FILE = path.join(HOME, 'config.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch (e) { /* first run */ }
const PORT = Number(process.env.PORT || cfg.port || 3000);
const saveCfg = () => fs.writeFileSync(CFG_FILE, JSON.stringify(cfg, null, 2));
if (TU.migrate(cfg)) saveCfg();
let TV = TU.apply(cfg);   // game tuning from the settings page
// card rules: config.json "rules" plus Game tuning > Viewer cards
const rulesNow = () => S.mergeRules(Object.assign({}, cfg.rules, { cards: TV.cards }));
let R = rulesNow();

const store = new Store(path.join(DATA, 'viewers.json'));
const twitch = new Twitch(cfg, saveCfg, PORT);
const kick = new Kick(cfg, saveCfg, PORT, DATA);
const youtube = new YouTube(cfg, saveCfg, PORT);
const PLATFORMS = { twitch, kick, youtube };
const NAMES = { twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube' };

const accent = () => (/^#[0-9a-fA-F]{6}$/.test(cfg.accent || '') ? cfg.accent : '#3dff9a');
const volume = () => (typeof cfg.volume === 'number' ? Math.max(0, Math.min(1, cfg.volume)) : 0.6);
const battleOpts = () => ({
  intervalMin: Number(cfg.battleIntervalMin) || 30, joinSecs: TV.general.joinSecs, boostSecs: TV.general.boostSecs, penBoostSecs: TV.general.penBoostSecs != null ? TV.general.penBoostSecs : 5, startIdleSecs: TV.general.startIdleSecs != null ? TV.general.startIdleSecs : 10, maxBoost: TV.general.maxBoost, maxShields: TV.general.maxShields,
  game: currentGame(), routesOff: cfg.routesOff || [], raceTods: cfg.raceTods || null, raceWx: cfg.raceWx || null,
  points: { shootout: R.battlePoints.shootout, race: R.battlePoints.race },
  raidPoints: { win: R.battlePoints.raidWin, loss: R.battlePoints.raidLoss }
});
// the card's look follows the game on stream: FC = football card, ATS / ETS2 = trucker's licence, Arc Raiders = raider tag
// v31: GTA on stream = the Sunset Heist look (an original sunset/neon crime-caper style, no Rockstar logos or art)
const HEIST_RE = /grand theft auto|\bgta\b|gta ?(v|vi|5|6|online)\b/i;
function cardStyle() {
  const o = cfg.cardStyle || 'auto';
  if (o !== 'auto') return o;
  const g = currentGame();
  return /american truck/i.test(g) ? 'ats' : /euro truck/i.test(g) ? 'ets' : /arc raiders/i.test(g) ? 'arc' : HEIST_RE.test(g) ? 'heist' : (cfg.themeAuto === false && cfg.theme === 'heist') ? 'heist' : 'fc';
}
const PLAYSTYLE = { WAT: 'LOYAL WATCHER', SUB: 'SUPPORTER', SUP: 'BIG BACKER', CHT: 'CHATTERBOX', LOY: 'DAY ONE', RAI: 'RAID LEADER', STK: 'ALWAYS HERE' };
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// ---------- who gets a card: followers (and subs, mods, VIPs). Everyone's stats still count in the background ----------
function gateS() { const g = cfg.cardGate || {}; return { on: g.on !== false, kick: g.kick === 'anyone' ? 'anyone' : 'follow', youtube: g.youtube === 'members' ? 'members' : 'anyone' }; }
function hasCard(v0) {
  if (!v0) return false;
  const G = gateS(); if (!G.on) return true;
  const v = (store.primary && store.primary(v0)) || v0;
  if (v.test || v.isBroadcaster || v.isMod || v.isVip || v0.isBroadcaster || v0.isMod || v0.isVip) return true;
  if (v.followedAt || v.lastSubAt || v.subMonths > 0 || v0.followedAt || v0.lastSubAt) return true;
  const plats = v.platforms || [v.platform];
  if (G.youtube === 'anyone' && plats.includes('youtube')) return true;   // YouTube doesn't tell apps who subscribed
  if (G.kick === 'anyone' && plats.includes('kick')) return true;
  return false;
}
const card = (v) => {
  const c = Object.assign(S.compute(v, R), { style: cardStyle() });
  if (!hasCard(v)) c.noCard = true;
  try {
    const sn = (store.data.meta && store.data.meta.streamNo) || 0;
    if (v.crownNo && v.crownNo === sn && isLive() && showOn('crown')) c.crown = true;
    if (!showOn('subBand')) c.sub = null;
    if (v.isBroadcaster && store.data.boss && store.data.boss.form) { const f = store.data.boss.form, floor = Math.min(c.ovr, bossS().floor); c.ovr = Math.max(floor, Math.min(99, c.ovr + f)); c.form = f < 0 ? 'down' : 'up'; c.bossForm = f; }
    if (showOn('cardFacts') && !v.isBroadcaster) {
      const chips = [];
      if ((v.bits || 0) > 0) chips.push({ k: 'BITS', v: v.bits >= 10000 ? (Math.round(v.bits / 100) / 10) + 'K' : String(v.bits) });
      const g = S.giftsAllTime(v); if (g > 0) chips.push({ k: 'GIFTED', v: String(g) });
      if ((v.subMonths || 0) > 0) chips.push({ k: 'SUB MO', v: String(v.subMonths) });
      if ((v.raids || 0) > 0) chips.push({ k: 'RAIDS', v: String(v.raids) });
      if ((v.streams || 0) > 0) chips.push({ k: 'STREAMS', v: String(v.streams) });
      const best = S.STAT_KEYS.slice().sort((a, b) => c.stats[b] - c.stats[a])[0];
      const since = new Date(Math.min(v.firstSeen || Date.now(), v.followedAt || Date.now()));
      c.facts = { chips: chips.slice(0, 2), since: MON[since.getMonth()] + ' ' + since.getFullYear(), style: PLAYSTYLE[best] || '' };
    }
  } catch (e) { /* ignore */ }
  return c;
};
const tierMonths = (t) => (t === 3 ? R.cards.t3Months : t === 2 ? R.cards.t2Months : 1);
function setSub(v, platform, e) { v.subPlatform = platform; if (e.tier) v.subTier = e.tier; else if (!v.subTier) v.subTier = 1; v.subGifted = !!e.isGift; if (e.prime != null) v.subPrime = !!e.prime; }
const isLive = () => twitch.live || kick.live || youtube.live || !!cfg.liveMode;
// v36: running inside the desktop app (BBR Viewer Cards.exe). The app talks to this server over a private channel:
// it asks "are we live?" before installing an update, and the dashboard's Setup > App page goes through here.
const DESK = { on: typeof process.send === 'function' && process.env.BBR_DESKTOP === '1', seq: 0, wait: new Map() };
function deskAsk(msg, ms) {
  return new Promise((resolve) => {
    if (!DESK.on) return resolve({ desktop: false });
    const id = ++DESK.seq;
    const t = setTimeout(() => { DESK.wait.delete(id); resolve({ error: 'The app didn\'t answer. Try again.' }); }, ms || 20000);
    DESK.wait.set(id, (r) => { clearTimeout(t); resolve(r || {}); });
    try { process.send(Object.assign({}, msg, { type: 'app', id })); } catch (e) { clearTimeout(t); DESK.wait.delete(id); resolve({ error: 'The app isn\'t connected' }); }
  });
}
let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return; shuttingDown = true;
  try { store.flush(); } catch (e) { console.error('Could not save the cards: ' + e.message); }
  try { saveCfg(); } catch (e) { console.error('Could not save the settings: ' + e.message); }
  try { ballon.saveNow(); } catch (e) { /* not started */ }
  try { spin.saveNow(); } catch (e) { /* not started */ }
  process.exit(code || 0);
}
if (DESK.on) {
  process.on('message', (m) => {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'app-reply' && DESK.wait.has(m.id)) { const f = DESK.wait.get(m.id); DESK.wait.delete(m.id); f(m.data); }
    else if (m.type === 'shutdown') shutdown(0);
  });
  process.on('disconnect', () => shutdown(0));   // the app closed: save and stop
}
const currentGame = () => twitch.game || kick.game || cfg.manualGame || '';
// v29 stream theme: 'football' (Boss Sports News), 'ets' (Euro Truck Simulator: motorway signs, BBR Haulage), v31 'heist' (Sunset Heist, GTA-style).
// With "switch by itself" on, a truck game on Twitch / Kick picks ETS and a football game picks football.
const TRUCK_RE = /truck|ats\b|ets\s?2|euro truck|american truck/i, FOOTY_RE = /\bfc\b|fc \d|fifa|football|soccer|ea sports/i;
function themeName() {
  const g = currentGame(), auto = cfg.themeAuto !== false;
  if (auto && HEIST_RE.test(g)) return 'heist';
  if (auto && TRUCK_RE.test(g)) return 'ets';
  if (auto && FOOTY_RE.test(g)) return 'football';
  return cfg.theme === 'ets' || cfg.theme === 'heist' ? cfg.theme : 'football';
}

// ---------- chat output ----------
// every bot reply is also kept here (System check reads it to prove commands answer)
const sayLog = [];
// what the bot said recently (so its own messages coming back through chat are ignored) and a flood limit
const saidRecent = [], sayRate = {};
function sayAllowed(platform, msg) {
  if (cfg.botMuted) return false;
  const now = Date.now(), r = sayRate[platform] || (sayRate[platform] = []);
  while (r.length && now - r[0] > 60000) r.shift();
  if (r.length >= (cfg.botMaxPerMin || 8)) { if (!sayRate.warned || now - sayRate.warned > 60000) { sayRate.warned = now; try { feedAdd('Chat bot held back: more than ' + (cfg.botMaxPerMin || 8) + ' messages a minute', '#ff6b7d'); } catch (e) { /* not ready */ } console.warn('[say] flood limit: dropped "' + String(msg).slice(0, 80) + '"'); } return false; }
  r.push(now); return true;
}
function say(platform, msg, important) { if (typeof QUIET !== 'undefined' && QUIET.on) { QUIET.says.push({ platform, msg: String(msg) }); return; } if (!sayAllowed(platform, msg)) return; saidRecent.push({ at: Date.now(), t: String(msg).slice(0, 60).toLowerCase() }); while (saidRecent.length > 60) saidRecent.shift(); sayLog.push({ at: Date.now(), platform, msg: String(msg).slice(0, 300) }); if (sayLog.length > 80) sayLog.shift(); const p = PLATFORMS[platform]; if (p && p.say) { try { p.say(msg, important); } catch (e) { console.error('[say]', platform, e.message); } } }
function sayAll(msg) { for (const k of Object.keys(PLATFORMS)) say(k, msg); }

// ---------- overlay push (Server-Sent Events) ----------
const clients = new Set();
const BOOT_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function push(alert) {
  if (typeof QUIET !== 'undefined' && QUIET.on) { QUIET.pushes.push(alert); if (QUIET.pushes.length > 500) QUIET.pushes.shift(); return; }
  if (!GA_ON() && (alert.type === 'pot' || alert.type === 'giveaway')) return;
  if (alert.type === 'battle' && (alert.phase === 'join' || alert.phase === 'matchup' || (alert.phase === 'arc' || alert.phase === 'race' || alert.phase === 'shootout'))) alert.cmds = battleCommands(alert.mode);
  alert.accent = accent();
  alert.volume = volume();
  if (sceneHeld && HOLDABLE.test(alert.type)) { heldList.push({ type: alert.type, kind: alert.kind || null, who: (alert.card && alert.card.display) || (alert.ch && alert.ch.name) || (alert.list ? alert.list.length + ' viewers' : ''), at: Date.now() }); if (heldList.length > 100) heldList.shift(); }
  const line = 'data: ' + JSON.stringify(alert) + '\n\n';
  for (const res of clients) res.write(line);
  try { feedFrom(alert); moveFrom(alert); hypeFrom(alert); predictFrom(alert); } catch (e) { /* ignore */ }
}
// ---------- the Live desk feed: what just happened ----------
const feed = [];
function feedAdd(text, color) { feed.push({ at: Date.now(), text: String(text).slice(0, 120), color: color || '#4dc3ff' }); if (feed.length > 80) feed.shift(); }
// v29: freeze / card guard / undo 10 minutes / card check (lib/cardsafety.js)
const { CardSafety } = require('./lib/cardsafety');
const safety = new CardSafety({ store, card: (v) => S.compute(v, R), cfg: () => cfg, saveCfg: () => saveCfg(), TK, feedAdd: (a, b) => feedAdd(a, b), push: (e) => push(e), streakRules: () => R.cards });
function feedFrom(a) {
  const nm = (a.card && a.card.display) || '';
  if (a.type === 'levelup' && a.kind && a.kind !== 'upgrade' && a.kind !== 'battle') feedAdd(nm + ': ' + (a.reason || a.kind) + (a.gift ? ' (' + a.gift.allTime + ' all time)' : ''), /gift/.test(a.kind) ? '#c58bff' : /bits|kicks|superchat/.test(a.kind) ? '#ffb020' : '#9146ff');
  else if (a.type === 'pack') feedAdd(nm + ' ' + (a.kind === 'follow' ? 'followed' : 'joined'), '#3dff9a');
  else if (a.type === 'challenge' && (a.kind === 'accepted' || a.kind === 'complete')) feedAdd((a.kind === 'accepted' ? (a.by ? a.by + ' set ' : 'New: ') : 'Done: ') + a.ch.name, '#ffb020');
  else if (a.type === 'camfx' && a.phase === 'start' && a.fx !== 'reset') feedAdd('Camera: ' + (a.label || a.fx) + (a.by ? ' (' + a.by + ')' : ''), '#ff5aa0');
  else if (a.type === 'checkin') feedAdd(((a.list || []).length) + ' checked in', '#4dc3ff');
  else if (a.type === 'battle' && a.phase === 'result') feedAdd((a.label || a.mode) + ' finished', '#3dff9a');
  else if (a.type === 'raidnight' && a.kind === 'result') feedAdd('Raid Night: ' + (a.result.win ? 'the Queen fell' : 'the Queen survived'), '#c58bff');
  else if (a.type === 'raidnight' && a.kind === 'drone' && a.phase === 'end') feedAdd(a.down ? 'Drone down, +' + a.add + ' firepower' : 'The drone got away', '#c58bff');
}

// profile pictures: a linked card prefers the Twitch picture, then Kick, then YouTube
const AVATAR_RETRY = 6 * 3600000, AVATAR_REFRESH = 7 * 86400000;
function accountsOf(v) { return [v].concat(store.aliases().filter((a) => a.aliasOf === v.key)); }
async function withAvatar(v) {
  if (!v || v.test) return;
  const now = Date.now();
  if (v.avatar && now - (v.avatarAt || 0) < AVATAR_REFRESH) return;
  if (!v.avatar && now - (v.avatarTriedAt || 0) < AVATAR_RETRY) return;
  v.avatarTriedAt = now;
  const acc = accountsOf(v);
  let url = null;
  const tw = acc.find((a) => a.platform === 'twitch');
  if (tw && twitch.user) url = await twitch.avatar(tw.login);
  if (!url) { const k = acc.find((a) => a.platform === 'kick' && a.kickId); if (k) url = await kick.avatar(k.kickId); }
  if (!url) { const y = acc.find((a) => a.avatar); if (y) url = y.avatar; }
  if (url) { v.avatar = url; v.avatarAt = now; }
  store.save();
}
// fill in Twitch profile pictures for every card in the background (100 per request)
async function backfillAvatars() {
  if (!twitch.user || !twitch.connected) return 0;
  const now = Date.now(), want = new Map();
  for (const v of store.all()) {
    if (v.test) continue;
    if (v.avatar && now - (v.avatarAt || 0) < AVATAR_REFRESH) continue;
    if (!v.avatar && now - (v.avatarTriedAt || 0) < AVATAR_RETRY && v.avatarTriedAt) continue;
    const tw = accountsOf(v).find((a) => a.platform === 'twitch');
    if (tw) want.set(String(tw.login).toLowerCase(), v);
  }
  if (!want.size) return 0;
  const got = await twitch.avatars(Array.from(want.keys()).slice(0, 2000));
  let n = 0;
  for (const [login, v] of want) {
    v.avatarTriedAt = now;
    if (got[login]) { if (v.avatar !== got[login]) n++; v.avatar = got[login]; v.avatarAt = now; }
  }
  store.save();
  if (n) console.log('[avatars] updated ' + n + ' Twitch profile pictures');
  return n;
}
setTimeout(() => backfillAvatars().catch(() => {}), 20000);
setInterval(() => backfillAvatars().catch(() => {}), 30 * 60000);

// ---------- the core: apply activity to a viewer, decide what to show ----------
let lastPackAt = 0;
// a gifter's all-time total, rank and next milestone (shown on their gift alert)
function giftInfo(v) {
  const all = S.giftsAllTime(v);
  const ranked = store.all().filter((x) => !x.isBroadcaster && S.giftsAllTime(x) > 0).map((x) => S.giftsAllTime(x)).sort((a, b) => b - a);
  const rank = all > 0 ? ranked.findIndex((n) => n <= all) + 1 : null;
  const M = S.GIFT_MILESTONES, nxt = M.find((m) => m.n > all), prev = M.filter((m) => m.n <= all).pop();
  return { allTime: all, rank: rank || null, next: nxt ? nxt.n : null, nextName: nxt ? nxt.name : null, prevAt: prev ? prev.n : 0, level: prev ? prev.name : null };
}
// ---------- chat bots: no cards, no alerts, not in any list ----------
const BOT_NAMES = ['streamelements', 'nightbot', 'streamlabs', 'moobot', 'fossabot', 'wizebot', 'sery_bot', 'soundalerts', 'tangiabot', 'tangia', 'kofistreambot', 'botrix', 'botrixoficial',
  'kickbot', 'streamstickers', 'commanderroot', 'pokemoncommunitygame', 'own3d', 'blerp', 'lumiastream', 'creatisbot', 'frostytoolsdotcom', 'streamcaptainbot', 'songlistbot', 'buttsbot',
  'deepbot', 'phantombot', 'ankhbot', 'vivbot', 'coebot', 'stay_hydrated_bot', 'restreambot', 'restream', 'botisimo', 'twitchbot', 'nightbot_', 'streamlootsbot', 'kick_bot', 'mixitupbot', 'firebot', 'thepositivebot', 'drapsnatt', 'lurxx', 'regressz', 'aliceydra'];
function botList() { return BOT_NAMES.concat((cfg.bots || []).map((x) => String(x).toLowerCase().trim()).filter(Boolean)); }
function isBot(login) { const l = String(login || '').toLowerCase().replace(/^@/, ''); if (!l) return false; if (cfg.botsOff === true) return (cfg.bots || []).map((x) => String(x).toLowerCase()).includes(l); return botList().includes(l) || (cfg.botSuffix !== false && /_bot$/.test(l)); }
store.isBot = isBot;
function removeBotCards() {
  const gone = [];
  for (const [k, v] of Object.entries(store.data.viewers)) if (!v.test && !v.isBroadcaster && isBot(v.login)) { gone.push(v.display || v.login); delete store.data.viewers[k]; }
  if (gone.length) { store.save(); console.log('[bots] removed cards: ' + gone.join(', ')); }
  return gone;
}
setTimeout(() => { try { removeBotCards(); } catch (e) { console.error('[bots]', e.message); } }, 3000);
async function update(platform, login, display, mutate, opts) {
  opts = opts || {};
  if (!login || isBot(login)) return null;
  const { v } = store.upsert(platform, login, display);
  S.migrate(v);
  const now = Date.now();
  S.decay(v, R, now);
  S.releaseBank(v, R, now);
  const before = card(v);
  const pre = safety.before(v);
  if (opts.seen !== false) v.lastSeen = now;
  mutate(v, now);
  if (opts.test) v.test = true;
  try { safety.after(v, pre, before, opts, now); } catch (e) { console.error('[safety]', e.message); }
  store.save();
  const after = card(v);
  const raised = S.STAT_KEYS.filter((k) => after.stats[k] > before.stats[k]).map((k) => ({ k, from: before.stats[k], to: after.stats[k] }));
  const tierUp = after.tier !== before.tier && after.ovr > before.ovr;
  const newRibbon = after.ribbons.find((r) => !before.ribbons.includes(r)) || null;

  if (opts.pack && !v.packShown) {
    v.packShown = true;
    lastPackAt = now;
    await withAvatar(v);
    push({ type: 'pack', kind: opts.kind || 'follow', card: card(v) });
  } else if (opts.alert ? (raised.length || tierUp || newRibbon || opts.always || /^(bits|kicks|superchat|sub|resub|gift|giftbomb|giftsub|raid)$/.test(opts.kind || '')) : (tierUp || newRibbon)) {   // support always shows the card (a thank-you), even when no stat moved
    await withAvatar(v);
    push({ type: 'levelup', gift: opts.gift ? opts.gift(v) : undefined, kind: opts.kind || (opts.reason && /won|mvp/i.test(opts.reason) ? 'battle' : 'upgrade'), amount: opts.amount || null, card: card(v), raised, ovrFrom: before.ovr, tierUp, tierFrom: before.tier, newRibbon, banked: after.banked, reason: opts.reason || 'Card upgraded' });
  }
  return { v, card: after };
}

function streamId(platform) {
  const p = PLATFORMS[platform];
  if (p && p.streamId) return p.streamId;
  if (platform !== 'twitch' || cfg.liveMode) return platform + '-' + new Date().toISOString().slice(0, 10);
  return null;
}
let liveHeld = false;   // true for up to 3 minutes after the platforms say offline (see the live check)
const streamNo = () => ((isLive() || liveHeld) && store.data.meta && store.data.meta.streamNo) || 0;
function attend(v, now) {
  const sno = streamNo();
  if (S.attendStream(v, sno ? 'bbr-' + sno : streamId(v.platform), now)) S.addXp(v, 'LOY', 1, R, false, now);
  TK.expire(v, now);
  const lvl = S.streakLevel((v.tk && v.tk.streak) || 0);
  const lastNo = v.tk ? v.tk.lastStreamNo : null;
  TK.attended(v, streamNo(), now);   // automatic check-in: tickets + streak, once per stream across all platforms
  const t = v.tk || {}, lvl2 = S.streakLevel(t.streak || 0);
  // v29: only when this message really was their check-in for the stream (it used to fire on every message)
  if (t.lastStreamNo === lastNo || v.test) return;
  try { streamLog.event('here', 0, v.key); } catch (e) { /* not ready */ }   // marks them as in this stream (the card check reads it)
  if (lvl2 > lvl) streakUp(v, lvl2);
  else if (t.streak >= 3 && R.cards.saverEvery > 0 && t.streak % R.cards.saverEvery === 0 && t.savers) streakUp(v, lvl2, true);
}
// streak level-ups are grouped: one on-screen roll-call and one chat line every few seconds
let streakQ = [], streakT = null;
function streakUp(v, level, saver) {
  if (streakQ.some((x) => x.key === v.key)) return;
  const sn = streamNo(); if (sn && v.streakShownNo === sn) return;   // one streak alert per viewer per stream, ever
  if (sn) v.streakShownNo = sn;
  streakQ.push({ key: v.key, level, saver });
  if (!streakT) streakT = setTimeout(flushStreaks, 6000);
}
async function flushStreaks() {
  streakT = null;
  const list = streakQ.splice(0, 8); streakQ = [];
  const cards = [];
  for (const x of list) { const v = store.data.viewers[x.key]; if (!v) continue; await withAvatar(v); cards.push(Object.assign(card(v), { gotSaver: !!x.saver })); }
  if (!cards.length) return;
  push({ type: 'streakup', cards });
  const L = (c) => c.display + ' ' + c.streak.now + ' in a row (' + c.streak.name + ', +' + c.boost + ' every stat)' + (c.gotSaver ? ' + a streak saver' : '');
  // one STREAK line in chat at most every 10 minutes (the cards still show on screen)
  if (Date.now() - (flushStreaks.saidAt || 0) > 600000) { flushStreaks.saidAt = Date.now(); sayAll('STREAK! ' + cards.map(L).join(' · ')); }
}

// ---------- battles ----------
const joinQ = {};
const battle = new Battle({
  push, opts: battleOpts,
  resolveKey: (platform, login) => store.resolveKey(platform, login),
  say: sayAll,
  sayTo: (platform, msg) => { if (platform !== 'youtube' || !onCooldown('yt-aim', 20000)) say(platform, msg); },
  card: (key) => { const v = store.data.viewers[key]; return v ? card(v) : null; },
  teamCfg: () => tpS(),
  // v29: confirm joins in chat (grouped, one line every few seconds per platform) and "Let me play" for the streamer
  onJoin: (platform, name, count) => { if (cfg.joinReplies === false) return; const q = joinQ[platform] || (joinQ[platform] = { names: [], t: null }); q.names.push(name); q.count = count; if (!q.t) q.t = setTimeout(() => { const n = q.names.splice(0, 6); q.t = null; if (n.length && battle.phase === 'join') say(platform, n.map((x) => '@' + x).join(' ') + ' you\'re in! (' + q.count + ' joined)'); }, 4000); },
  alwaysIn: (key) => { if (cfg.letMePlay === false) return false; const v = store.data.viewers[key]; return !!(v && v.isBroadcaster && !v.test); },
  isSub: (key) => { const v = store.data.viewers[key]; return !!(v && v.lastSubAt && Date.now() - v.lastSubAt < 35 * 86400000); },
  onTeamResult: (r) => { if (tpS().ticker) addStory({ cat: 'Shootout', text: r.winner + ' WIN THE ' + r.size + ' V ' + r.size + ' SHOOTOUT ' + r.line + (r.sd ? ' IN SUDDEN DEATH' : '') + (r.mvp ? ' - MVP ' + String(r.mvp).toUpperCase() : ''), keep: 'stream', freq: 'loop', tag: 'teampens' }); feedAdd('Team shootout: ' + r.winner + ' win (' + r.score + ')', '#3dff9a'); },
  ensure: (platform, login, display) => update(platform, login, display, () => {}, {}),
  reward: async (ranked, mode, sim) => {
    if (mode === 'arc') { try { raidNight.onResult(ranked, sim); } catch (e) { console.error('[raidnight]', e.message); } }
    // each point goes to the card's lowest stat at that moment; daily cap so battles can't out-earn real support
    const givePoints = (v, n) => {
      const day = new Date().toISOString().slice(0, 10);
      if (v.battleDay !== day) { v.battleDay = day; v.battlePts = 0; }
      const can = Math.max(0, Math.min(n, R.battleDailyCap - (v.battlePts || 0)));
      for (let k = 0; k < can; k++) {
        const c = card(v);
        const low = S.XP_KEYS.filter((x) => (v.bonus[x] || 0) < R.bonusMax).sort((a, b) => c.stats[a] - c.stats[b])[0];
        if (!low) break;
        v.bonus[low] = Math.min(R.bonusMax, (v.bonus[low] || 0) + 1);
        v.battlePts = (v.battlePts || 0) + 1;
      }
      return can;
    };
    const P = R.battlePoints;
    for (let i = 0; i < ranked.length; i++) {
      const f = ranked[i];
      let pts = 0, reason = null, win = false;
      if (mode === 'arc') {
        const r = sim.ranking[i];
        pts = r ? r.pts : 0;
        win = sim.win;
        reason = sim.win ? (i === 0 ? 'Queen Raid MVP · ' + r.score + ' pts' : 'Took down the Queen') : (i === 0 ? 'Top raider vs the Queen' : null);
      } else if (mode === 'teampens') {
        const T = sim.pts; pts = (f.win ? T.win : T.lose) + f.goals * T.goal; if (f.mvp && T.mvpDouble) pts *= 2; win = !!f.win;
        reason = f.mvp ? 'MVP of the team shootout' : f.win ? 'Won the team shootout' + (f.goals ? ' · ' + f.goals + ' goal' + (f.goals > 1 ? 's' : '') : '') : f.goals ? 'Scored in the team shootout' : null;
      } else if (mode === 'race') {
        pts = P.race[Math.min(i, P.race.length - 1)] || 0; win = i === 0; reason = win ? 'Won the BBR Haulage Cup' : null;
      } else {
        pts = P.shootout[i === 0 ? 0 : 1] || 0; win = i === 0; reason = win ? 'Won the penalty shootout' : null;
      }
      await update(f.platform, f.login, f.display, (v) => {
        streamLog.event('battle', 1, v.key);
        if (mode === 'arc') {
          v.arc = v.arc || { played: 0, won: 0, mvp: 0, mvpWins: 0 };
          v.arc.played++;
          if (sim.win) v.arc.won++;
          if (i === 0) { v.arc.mvp++; if (sim.win) v.arc.mvpWins = (v.arc.mvpWins || 0) + 1; }
        } else if (mode === 'race') {
          v.races.played++;
          if (i === 0) v.races.won++;
          if (i < 3) v.races.podiums++;
        } else if (mode === 'teampens') {
          v.battles.played++;
          if (f.win) v.battles.won++;
          v.teamPens = v.teamPens || { played: 0, won: 0, goals: 0, mvp: 0 }; v.teamPens.played++; if (f.win) v.teamPens.won++; v.teamPens.goals += f.goals; if (f.mvp) v.teamPens.mvp++;
        } else {
          v.battles.played++;
          if (i === 0) v.battles.won++;
        }
        logBattle(v, mode === 'teampens' ? 'shootout' : mode, mode === 'teampens' ? (f.win ? 0 : 1) : i, mode === 'arc' ? sim.win : mode === 'teampens' ? !!f.win : i === 0);
        if (pts) givePoints(v, pts);
        // tickets for playing (free, so they're fair game for giveaways)
        let tix = 0;
        if (mode === 'arc') { const r = sim.ranking[i]; if (r && r.score > 0) tix = 1 + (sim.win ? 1 : 0) + (i === 0 ? 2 : 0); }
        else if (mode === 'teampens') tix = 1 + (f.win ? 2 : 0) + (f.mvp ? 2 : 0);
        else tix = 1 + (i === 0 ? 2 : 0);
        if (tix) TK.earn(v, tix, Date.now());
      }, reason && pts ? { alert: mode === 'teampens' ? !!(f.mvp || f.win) : mode !== 'arc' || i < 3, kind: 'battle', reason } : {});
    }
  }
});
// v35: battles switched off completely = nothing can start one, !join and the game commands are ignored,
// nothing battle-related shows on stream. (Live › Battles › "Battles on" / dock › Games / Stream Deck.)
const battlesOff = () => cfg.battlesOff === true;
for (const m of ['open', 'openTeams', 'join', 'chatInput']) { const f = battle[m].bind(battle); battle[m] = (...a) => (battlesOff() ? false : f(...a)); }
function setBattlesOff(off) {
  cfg.battlesOff = !!off; saveCfg();
  if (off) { try { if (battle.phase !== 'idle') battle.cancel(); } catch (e) { /* ignore */ } feedAdd('Battles switched OFF (nothing can start, !join is ignored)', '#ff6b7d'); }
  else feedAdd('Battles switched back on', '#3dff9a');
  try { pushNext(); } catch (e) { /* not ready */ }
  return off ? 'Battles are OFF: nothing starts, !join is ignored, nothing shows on stream' : 'Battles are back ON';
}

let liveMs = 0, lastBattleLive = 0, lastAutoMode = 'race';
// peek = just say which battle would come next, without moving the "take turns" cycle on
function chooseMode(requested, peek) {
  if (requested === 'shootout' || requested === 'race' || requested === 'arc') return requested;
  if (['shootout', 'race', 'arc'].includes(cfg.nextModeOnce)) return cfg.nextModeOnce;   // "Swap game" on the Live desk
  const setting = cfg.battleMode || 'auto';
  if (setting === 'shootout' || setting === 'race' || setting === 'arc') return setting;
  const game = currentGame();
  if (setting === 'auto' && /truck|ats\b|ets\s?2|euro truck|american truck/i.test(game)) return 'race';
  if (setting === 'auto' && themeName() === 'ets') return 'race';   // v29: the ETS theme plays the truck race by default
  if (setting === 'auto' && /\bfc\b|fc \d|fifa|football|soccer|ea sports/i.test(game)) return 'shootout';
  if (setting === 'auto' && /arc raiders/i.test(game)) return 'arc';
  const cycle = ['shootout', 'race', 'arc'];
  const next = cycle[(cycle.indexOf(lastAutoMode) + 1) % cycle.length];
  if (!peek) lastAutoMode = next;
  return next;
}
// ---------- team shootout (3 v 3 / 5 v 5) ----------
function tpS() { const c = cfg.teamPens || {}; return { size: c.size === 3 ? 3 : 5, make: ['redblue', 'platform', 'clubs', 'random'].includes(c.make) ? c.make : 'redblue', order: ['rating', 'joined', 'captain'].includes(c.order) ? c.order : 'rating',
  subsFirst: c.subsFirst !== false, boosts: c.boosts !== false, ticker: c.ticker !== false, rotate: !!c.rotate, joinSecs: [30, 45, 60, 90, 120].includes(+c.joinSecs) ? +c.joinSecs : 60,
  clubs: Array.isArray(c.clubs) && c.clubs.length === 2 && c.clubs.every((x) => String(x || '').trim()) ? c.clubs.map((x) => String(x).trim().slice(0, 18)) : ['Bosshausens', 'Diamond Dogs'],
  winPts: c.winPts != null ? Math.max(0, Math.min(20, Math.round(+c.winPts) || 0)) : 3, losePts: c.losePts != null ? Math.max(0, Math.min(20, Math.round(+c.losePts) || 0)) : 1, goalPts: c.goalPts != null ? Math.max(0, Math.min(10, Math.round(+c.goalPts) || 0)) : 1, mvpDouble: c.mvpDouble !== false }; }
function tpSet(n) { const c = Object.assign({}, cfg.teamPens || {}); for (const k of ['size', 'joinSecs', 'winPts', 'losePts', 'goalPts']) if (n[k] != null && n[k] !== '') c[k] = +n[k]; for (const k of ['make', 'order']) if (typeof n[k] === 'string') c[k] = n[k]; for (const k of ['subsFirst', 'boosts', 'ticker', 'rotate', 'mvpDouble']) if (typeof n[k] === 'boolean') c[k] = n[k]; if (Array.isArray(n.clubs)) c.clubs = n.clubs.slice(0, 2).map((x) => String(x || '').slice(0, 18)); cfg.teamPens = c; saveCfg(); return tpS(); }
function startTeams(o) { if (battlesOff() || battle.phase !== 'idle') return false; const ok = battle.openTeams(() => { lastBattleLive = liveMs; }, o || {}); pushNext(); return ok; }
// test: fills both sides with test viewers who pick by themselves
function testTeams(o) {
  if (!startTeams(Object.assign({ test: true }, o || {}))) return false;
  const names = [['twitch', 'TestStriker', 'red'], ['kick', 'KickKeeper', 'blue'], ['youtube', 'YTRocket', ''], ['twitch', 'DieselDan', 'blue'], ['kick', 'GearJammer', 'red'], ['youtube', 'MooseMagnet', ''], ['twitch', 'BoltBetty', 'red'], ['kick', 'CopperKid', 'blue']];
  for (const [pl, n] of names) { const { v } = store.upsert(pl, n, n); v.test = true; }
  const W = battle.tm && battle.tm.defs ? battle.tm.defs.map((d) => d.words[0]) : ['red', 'blue'], sw = (x) => (x === 'red' ? W[0] : x === 'blue' ? W[1] || '' : x);
  names.forEach(([pl, n, side], i) => setTimeout(() => battle.join(pl, n, n, sw(side), { test: true }), 800 + i * 700));
  setTimeout(() => battle.boost('kick', 'someone', 2, 'come on ' + (W[1] || '')), 14000);
  return true;
}
function startBattle(requested) {
  if (battlesOff()) return false;
  if (requested === 'teampens' || (!requested && chooseMode(null, true) === 'shootout' && tpS().rotate && (lastShootKind = lastShootKind === 'team' ? 'solo' : 'team') === 'team')) return startTeams();
  const ok = battle.open(chooseMode(requested), () => { lastBattleLive = liveMs; }); if (ok && cfg.nextModeOnce) { delete cfg.nextModeOnce; saveCfg(); } pushNext(); return ok; }
let lastShootKind = 'team';
const battleInterval = () => battleOpts().intervalMin * 60000;
const nextInMs = () => Math.max(0, battleInterval() - (liveMs - lastBattleLive));
// pause = the countdown stops; delay = push the next battle back
function pauseBattles(on) { cfg.battlesPaused = !!on; saveCfg(); pushNext(); return cfg.battlesPaused; }
function delayBattle(min) { const m = Math.max(1, Math.min(120, Number(min) || 5)); lastBattleLive += m * 60000; pushNext(); return m; }
function nextInfo() {
  const mode = chooseMode(null, true);
  const teamNext = mode === 'shootout' && tpS().rotate && lastShootKind !== 'team';
  return { type: 'nextBattle', inMs: nextInMs(), mode, label: teamNext ? tpS().size + ' v ' + tpS().size + ' SHOOTOUT' : (BTX.MODES[mode] || {}).label || '', paused: !!cfg.battlesPaused, enabled: cfg.battlesEnabled !== false && !battlesOff(), off: battlesOff(),
    live: isLive(), running: battle.phase !== 'idle', show: cfg.showNextTimer !== false };
}
function pushNext() { push(nextInfo()); }
// ---------- undo panel: the last things you pressed, each with an Undo (only the newest of each kind can be undone) ----------
const undoList = [];
function undoAdd(kind, label, fn) { undoList.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: Date.now(), kind, label, fn, done: false }); while (undoList.length > 15) undoList.shift(); }
function undoState() { return undoList.slice().reverse().map((u) => ({ id: u.id, at: u.at, label: u.label, done: u.done, can: !u.done && undoList.filter((x) => x.kind === u.kind && !x.done).pop() === u })); }
function undoRun(id) { const u = undoList.find((x) => x.id === id); if (!u) return { error: 'Not in the list any more' }; if (u.done) return { error: 'Already undone' }; if (undoList.filter((x) => x.kind === u.kind && !x.done).pop() !== u) return { error: 'Undo the newer one first' }; try { const r = u.fn(); if (r && r.error) return r; } catch (e) { return { error: e.message }; } u.done = true; feedAdd('Undone: ' + u.label, '#a7b0ba'); return { ok: true }; }
// ---------- backups: the same file as "Download a backup" (logins and keys never in it), kept in data/backups, last 14 ----------
function backupJson() {
  const SECRET = /token|secret|password|passwd|webhook|clientid|client_id|apikey|api_key|refresh|access|cookie|^key$|obs.*pass/i;
  const clean = (o) => Array.isArray(o) ? o.map(clean) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).filter(([k]) => !SECRET.test(k)).map(([k, v]) => [k, clean(v)])) : o;
  return JSON.stringify({ bbrBackup: 1, version: APP_VERSION, at: new Date().toISOString(), data: store.data, settings: clean(cfg) });
}
function autoBackup(why) {
  try {
    const dir = path.join(DATA, 'backups'); fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, 'auto-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json');
    fs.writeFileSync(f, backupJson());
    const old = fs.readdirSync(dir).filter((x) => x.startsWith('auto-')).sort(); while (old.length > 14) { try { fs.unlinkSync(path.join(dir, old.shift())); } catch (e) { /* ignore */ } }
    store.data.meta = store.data.meta || {}; store.data.meta.lastAutoBackup = Date.now(); store.save();
    console.log('Backup saved (' + why + '): ' + f);
  } catch (e) { console.log('Backup failed: ' + e.message); }
}
setTimeout(() => { const m = store.data.meta || {}; if (cfg.autoBackup !== false && (!m.lastAutoBackup || Date.now() - m.lastAutoBackup > 24 * 3600000)) autoBackup('daily'); }, 60000).unref();
setInterval(() => { const m = store.data.meta || {}; if (cfg.autoBackup !== false && !isLive() && (!m.lastAutoBackup || Date.now() - m.lastAutoBackup > 24 * 3600000)) autoBackup('daily'); }, 3600000).unref();
let wasLive = false, liveSince = 0;
let offSince = 0;
setInterval(() => {
  let live = isLive();
  const M0 = store.data.meta || (store.data.meta = {});
  // going offline only counts after 3 minutes (a dropped connection or a Twitch reconnect is not the end of the stream)
  if (live) offSince = 0;
  else if (wasLive) { if (!offSince) offSince = Date.now(); if (Date.now() - offSince < 180000) live = true; }
  liveHeld = live && !isLive();
  if (live && !wasLive) {
    // back within 45 minutes of the last time we were live (a dropped stream, a Twitch reconnect, or the app restarted
    // mid-stream) = the SAME stream: no new check-ins, streaks or tickets
    const lastSeen = Math.max(M0.lastLiveEnd || 0, M0.lastLiveAt || 0);
    const resumed = !!(M0.streamNo && lastSeen && Date.now() - lastSeen < 45 * 60000);
    if (resumed) { liveSince = M0.streamStart || Date.now(); console.log('[live] back on air within 45 min: carrying on stream #' + M0.streamNo); }
    else {
      liveSince = Date.now(); M0.streamStart = liveSince;
      liveMs = 0; lastBattleLive = 0;   // new stream: first battle after one full interval
      try { autoBackup('start of stream ' + ((M0.streamNo || 0) + 1)); } catch (e) { /* ignore */ }
      M0.streamNo = (M0.streamNo || 0) + 1;
      if (cfg.lbStart) setTimeout(() => { try { showLb('cards', 'all', 20, 30); } catch (e) { /* ignore */ } }, 90000);
    }
    store.save();
  }
  if (!live && wasLive) {
    M0.lastLiveEnd = Date.now(); store.save();
    bpStreamEnd(M0.streamNo || 0);
    if (cfg.autoBackup !== false) setTimeout(() => autoBackup('after the stream'), 10 * 60000);
  }
  if (live) { M0.lastLiveAt = Date.now(); if (Date.now() - (M0.lastLiveSaved || 0) > 60000) { M0.lastLiveSaved = Date.now(); store.save(); } }
  wasLive = live;
  if (live) {
    liveMs += 5000;
    if (cfg.battlesPaused || battle.phase !== 'idle' || sceneHeld || replay.playing || replay.busy) lastBattleLive += 5000;   // paused, or a battle is on: the clock waits
    if (!battlesOff() && !cfg.battlesPaused && !sceneHeld && !(raidNight && raidNight.blocksBattles()) && cfg.battlesEnabled !== false && battle.phase === 'idle' && !replay.playing && !replay.busy && liveMs - lastBattleLive >= battleInterval()) startBattle();
  }
  pushNext();
}, 5000);

// ---------- what to type, for each battle (shown on screen) ----------
function battleCommands(mode) {
  const A = ARCX.TUNE, B = RLX.BAL;
  const corner = obs.settings().on ? obs.settings().corner : null;
  const add = (o) => Object.assign(o, { corner });
  if (mode === 'shootout') return add({ title: 'PENALTY SHOOTOUT', join: '!join (2 players)',
    players: [['L', 'C', 'R'], 'on your kick · no pick = miss'], chat: [['!boo', '!horn', '!flash', '!laser', '!flare', '!firework'], 'put them off', ['!chant'], 'back them'],
    support: 'Cheer bits / Kicks / Super Chat with a player\'s name = ON TARGET shot' });
  if (mode === 'race') return add({ title: 'BBR HAULAGE CUP', join: '!join (up to 8 drivers)',
    players: [['L', 'R'], 'change lane (L2 / R2)', ['!turbo'], '×' + B.turbo.uses, ['!special'], 'your cargo', ['!horn', '!dodge'], ''], chat: [['!rain', '!wind', '!lightning', '!traffic'], 'one each · hits the leader ' + Math.round(B.chat.leaderChance * 100) + '%'],
    support: 'Cheer with a driver\'s name = fuel · dodge obstacles, grab FUEL pads' });
  if (mode === 'arc') return add({ title: 'QUEEN RAID', join: '!join (everyone plays)',
    players: [['!fire'], 'every ' + A.fireCooldown + 's', ['!grenade'], A.grenadeCd + 's cooldown', ['!heal'], ''], chat: [],
    support: 'Cheer with a raider\'s name = heal + armour + firepower · no name = supply drop · cheer "time" = +' + A.extendSecs + 's' });
  return null;
}

// ---------- leaderboards (battles and support), by week / month / all time ----------
const SUP_PTS = { sub: 5, gift: 5 };
function logSup(v, kind, n) {
  if (!v || v.test || !(n > 0)) return;
  const L = store.data.supportLog || (store.data.supportLog = []);
  L.push([Date.now(), v.key, kind, n]);
  v.cheers = v.cheers || { bits: 0, kicks: 0, superchat: 0 };
  if (kind in v.cheers) v.cheers[kind] += n;
  const cut = Date.now() - 400 * 86400000; while (L.length && L[0][0] < cut) L.shift();
  if (L.length > 50000) L.splice(0, L.length - 50000);
}
function logBattle(v, mode, place, win) {
  if (!v || v.test) return;
  const L = store.data.battleLog || (store.data.battleLog = []);
  L.push([Date.now(), v.key, mode, place, win ? 1 : 0]);
  const cut = Date.now() - 400 * 86400000; while (L.length && L[0][0] < cut) L.shift();
}
function periodStart(period) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (period === 'week') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
  if (period === 'month') { d.setDate(1); return d.getTime(); }
  return 0;
}
const PERIOD_LABEL = { week: 'THIS WEEK', month: 'THIS MONTH', all: 'ALL TIME' };
// battle points: win a shootout or race 3, race podium 1, Queen Raid won 1, raid MVP 2
const battlePts = (b) => b.sw * 3 + b.rw * 3 + b.pod + b.aw + b.mvp * 2;
function boardRows(kind, period) {
  const per = PERIOD_LABEL[period] ? period : 'week';
  const rows = new Map();
  const row = (key) => { if (!rows.has(key)) rows.set(key, { key, sw: 0, rw: 0, pod: 0, aw: 0, mvp: 0, played: 0, sub: 0, gift: 0, bits: 0, kicks: 0, superchat: 0 }); return rows.get(key); };
  if (per === 'all') {
    for (const v of store.all()) {
      if (v.test || v.isBroadcaster) continue;
      const r = row(v.key);
      if (kind === 'battles') {
        const b = v.battles || {}, ra = v.races || {}, a = v.arc || {};
        r.sw = b.won || 0; r.rw = ra.won || 0; r.pod = Math.max(0, (ra.podiums || 0) - (ra.won || 0)); r.aw = a.won || 0; r.mvp = a.mvp || 0;
        r.played = (b.played || 0) + (ra.played || 0) + (a.played || 0);
      } else {
        r.sub = v.subMonths || 0; r.gift = v.giftedSubs || 0;
        const c = v.cheers || { bits: 0, kicks: 0, superchat: 0 };
        Object.assign(r, { bits: c.bits, kicks: c.kicks, superchat: c.superchat });
        const legacy = Math.max(0, (v.bits || 0) - c.bits - c.kicks - c.superchat);   // cheers from before the log existed
        r[v.platform === 'kick' ? 'kicks' : v.platform === 'youtube' ? 'superchat' : 'bits'] += legacy;
      }
    }
  } else {
    const since = periodStart(per);
    if (kind === 'battles') {
      for (const [at, key, mode, place, win] of store.data.battleLog || []) {
        if (at < since) continue;
        const r = row(key); r.played++;
        if (mode === 'shootout' && place === 0) r.sw++;
        if (mode === 'race') { if (place === 0) r.rw++; else if (place < 3) r.pod++; }
        if (mode === 'arc') { if (win) r.aw++; if (place === 0) r.mvp++; }
      }
    } else {
      for (const [at, key, k, n] of store.data.supportLog || []) { if (at < since) continue; const r = row(key); if (k in r) r[k] += n; }
    }
  }
  const P = TK.potSettings(cfg);
  const out = [];
  for (const r of rows.values()) {
    const v = store.data.viewers ? store.data.viewers[r.key] : null;
    const vv = v || store.all().find((x) => x.key === r.key);
    if (!vv || vv.test) continue;
    const pts = kind === 'battles' ? battlePts(r) : (r.sub + r.gift) * SUP_PTS.sub + (r.bits + r.kicks + r.superchat) / 100;
    if (!(pts > 0) && !(kind === 'battles' && r.played > 0)) continue;
    const c = card(vv);
    out.push(Object.assign(r, { display: vv.display, avatar: vv.avatar || null, platforms: c.platforms, tier: c.tier, pts: Math.round(pts * 10) / 10, wins: r.sw + r.rw + r.aw }));
  }
  out.sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.played - a.played);
  return { kind, period: per, periodLabel: PERIOD_LABEL[per], currency: P.currency, rows: out.slice(0, arguments[2] || 10) };
}

// ---------- every leaderboard (Viewers > Leaderboards, and on stream) ----------
const LB_CATS = {
  cards: { label: 'Top cards', unit: 'OVR', allOnly: true }, gifts: { label: 'Gift subs', unit: 'gifted' }, support: { label: 'Bits + support', unit: 'pts' },
  bits: { label: 'Bits, Kicks + Super Chats', unit: 'bits' }, months: { label: 'Sub months', unit: 'months', allOnly: true }, streaks: { label: 'Streaks', unit: 'in a row', allOnly: true },
  watch: { label: 'Watch time', unit: 'hours' }, battles: { label: 'Battle points', unit: 'pts' }, races: { label: 'Race wins', unit: 'wins' },
  slayers: { label: 'Queen slayers', unit: 'MVPs' }, checkins: { label: 'Check-ins', unit: 'streams' }, drones: { label: 'Drone hunters', unit: 'drones' }, raids: { label: 'Raids', unit: 'raids', allOnly: true }
};
function lbRows(cat, period, top) {
  const C = LB_CATS[cat] ? cat : 'cards', per = LB_CATS[C].allOnly ? 'all' : (PERIOD_LABEL[period] ? period : 'all');
  const since = per === 'all' ? 0 : periodStart(per);
  const val = new Map(), add = (k, n) => { if (!k) return; const v = store.data.viewers[k]; const key = v ? (store.primary ? store.primary(v).key : v.key) : k; val.set(key, (val.get(key) || 0) + n); };
  const people = store.all().filter((v) => !v.test && !v.isBroadcaster && hasCard(v));
  if (C === 'cards') for (const v of people) add(v.key, card(v).ovr);
  else if (C === 'months') for (const v of people) add(v.key, v.subMonths || 0);
  else if (C === 'streaks') for (const v of people) add(v.key, (card(v).streak || {}).now || 0);
  else if (C === 'raids') for (const v of people) add(v.key, v.raids || 0);
  else if (C === 'support' || C === 'battles') { for (const r of boardRows(C, per, 999).rows) add(r.key, r.pts); }
  else if (C === 'gifts') { if (per === 'all') for (const v of people) add(v.key, S.giftsAllTime(v)); else for (const [at, k, kind, n] of store.data.supportLog || []) if (at >= since && kind === 'gift') add(k, n); }
  else if (C === 'bits') { if (per === 'all') for (const v of people) add(v.key, v.bits || 0); else for (const [at, k, kind, n] of store.data.supportLog || []) if (at >= since && /bits|kicks|superchat/.test(kind)) add(k, n); }
  else if (C === 'races' || C === 'slayers') {
    if (per === 'all') for (const v of people) add(v.key, C === 'races' ? ((v.races || {}).won || 0) : ((v.arc || {}).mvpWins || 0));
    else for (const [at, k, mode, place, win] of store.data.battleLog || []) if (at >= since && place === 0 && (C === 'races' ? mode === 'race' : mode === 'arc' && win)) add(k, 1);
  } else if (C === 'watch' || C === 'checkins') {
    for (const st of Object.values(store.data.streams || {})) { if (st.start < since) continue; for (const [k, r] of Object.entries(st.v || {})) add(k, C === 'watch' ? (r.w || 0) / 60 : (r.m > 0 ? 1 : 0)); }
  } else if (C === 'drones') {
    for (const n of Object.values((store.data.raidNight && store.data.raidNight.nights) || {})) { if (n.start < since) continue; for (const d of n.drones || []) if (d.down) for (const k of d.by || []) add(k, 1); }
  }
  const rows = [];
  for (const [k, n] of val) {
    const v = store.data.viewers[k]; if (!v || v.test || v.isBroadcaster || !(n > 0)) continue;
    const c = card(v);
    rows.push({ key: k, display: v.display, avatar: v.avatar || null, platforms: c.platforms, tier: c.tier, ovr: c.ovr, sub: c.sub, value: Math.round(n * 10) / 10, card: c });
  }
  rows.sort((a, b) => b.value - a.value || b.ovr - a.ovr);
  // movement since last week (cards only, from a weekly snapshot)
  if (C === 'cards') {
    const snapS = store.data.lbSnap || {}, wk = periodStart('week');
    if (!snapS.at || snapS.at < wk) { store.data.lbSnap = { at: Date.now(), ranks: Object.fromEntries(rows.map((r, i) => [r.key, i + 1])), prev: snapS.ranks || {} }; }
    const prev = (store.data.lbSnap || {}).prev || {};
    rows.forEach((r, i) => { r.move = prev[r.key] ? prev[r.key] - (i + 1) : null; });
  }
  const outRows = rows.slice(0, Math.max(1, Math.min(100, top || 20))).map((r, i) => (i < 3 ? r : Object.assign({}, r, { card: undefined })));
  return { cat: C, label: LB_CATS[C].label, unit: LB_CATS[C].unit, period: per, periodLabel: PERIOD_LABEL[per], rows: outRows, allOnly: !!LB_CATS[C].allOnly };
}
function showLb(cat, period, top, secs) {
  const b = lbRows(cat, period, Math.min(20, top || 20));
  b.rows.forEach((r, i) => { if (i > 2) delete r.card; });
  push(Object.assign({ type: 'lb', secs: Math.max(8, Math.min(180, Number(secs) || 30)) }, b));
  return b;
}
// rotate through boards (for a BRB / starting soon scene)
let lbRotate = null;
function setLbRotate(on, secs) {
  clearInterval(lbRotate); lbRotate = null;
  if (!on) return false;
  const cats = ['cards', 'gifts', 'support', 'streaks', 'battles', 'watch'], s = Math.max(10, Math.min(120, +secs || 20));
  let i = 0; const go = () => { showLb(cats[i % cats.length], 'all', 20, s - 1); i++; };
  go(); lbRotate = setInterval(go, s * 1000);
  return true;
}
function showBoard(kind, period, secs) {
  const b = boardRows(kind === 'support' ? 'support' : 'battles', period);
  push(Object.assign({ type: 'board', secs: Math.max(5, Math.min(120, Number(secs) || 20)) }, b));
  return b;
}

// ---------- OBS: shrink the Live scene into a corner during battles ----------
const obs = new OBS(() => cfg, path.join(DATA, 'obs-restore.json'));
// ---------- Light graphics: heavy effects off so the game keeps its frames (on, off, or auto when OBS drops frames) ----------
let gfxAutoOn = false, gfxLast = null;
function gfxMode() { return ['on', 'auto'].includes(cfg.gfxLight) ? cfg.gfxLight : 'off'; }
function gfxOn() { return gfxMode() === 'on' || (gfxMode() === 'auto' && gfxAutoOn); }
function pushGfx() { push({ type: 'gfx', light: gfxOn(), mode: gfxMode(), auto: gfxAutoOn }); }
setInterval(async () => {
  if (gfxMode() !== 'auto' || !obs.ready) return;
  try {
    const st = await obs.req('GetStats'), now = { r: st.renderSkippedFrames || 0, rt: st.renderTotalFrames || 0, o: st.outputSkippedFrames || 0, ot: st.outputTotalFrames || 0 };
    if (gfxLast) { const dr = now.rt - gfxLast.rt, dot = now.ot - gfxLast.ot, bad = (dr > 0 && (now.r - gfxLast.r) / dr > 0.02) || (dot > 0 && (now.o - gfxLast.o) / dot > 0.02); if (bad && !gfxAutoOn) { gfxAutoOn = true; pushGfx(); feedAdd('OBS was dropping frames: Light graphics switched on', '#ffb020'); } }
    gfxLast = now;
  } catch (e) { /* older OBS */ }
}, 30000).unref();
setImmediate(() => connectHooks.push(() => ({ type: 'gfx', light: gfxOn(), mode: gfxMode(), auto: gfxAutoOn })));
// ---- 3D stadium for the penalty games (public/stadium3d.js + pen3d.js) ----
function p3S() { const c = cfg.pen3d || {}; return { on: c.on !== false, replays: c.replays !== false, cams: c.cams !== false, lightClassic: c.lightClassic !== false, credit: c.credit !== false, preload: c.preload !== false, quality: ['high', 'balanced', 'performance'].includes(c.quality) ? c.quality : 'balanced', tod: ['random', 'day', 'golden', 'dusk', 'night'].includes(c.tod) ? c.tod : 'random' }; }
function p3Set(n) { const c = Object.assign({}, cfg.pen3d || {}); for (const k of ['on', 'replays', 'cams', 'lightClassic', 'credit', 'preload']) if (typeof n[k] === 'boolean') c[k] = n[k]; if (['high', 'balanced', 'performance'].includes(n.quality)) c.quality = n.quality; if (['random', 'day', 'golden', 'dusk', 'night'].includes(n.tod)) c.tod = n.tod; cfg.pen3d = c; saveCfg(); p3Push(); return p3S(); }
// what the overlay last said about the 3D engine
function p3Live() { return overlayState && Date.now() - overlayState.at < 20000 ? overlayState.g3 || null : null; }
// replays need longer between kicks, but only when the overlay really draws in 3D
function p3Timing() { const t = BTX.MODES.shootout.timing, S = p3S(), g = p3Live(); if (t.kick >= 5000) t.kick = S.on && S.replays && g && g.use ? 8400 : 6200; }
function p3Push() { push(Object.assign({ type: 'pen3d' }, p3S())); p3Timing(); }
function p3Files() { return ['stadium.glb', 'player.glb', 'kitmask.png'].filter((f) => !fs.existsSync(path.join(ROOT, 'public', '3d', f))); }
setImmediate(() => connectHooks.push(() => Object.assign({ type: 'pen3d' }, p3S())));
// v29: the theme goes to every overlay (and again whenever the game on stream changes it)
let lastTheme = null;
function themePush() { lastTheme = themeName(); push({ type: 'theme', theme: lastTheme }); try { stPush(); } catch (e) { /* ignore */ } }
setImmediate(() => connectHooks.push(() => ({ type: 'theme', theme: themeName() })));
setInterval(() => { if (themeName() !== lastTheme) themePush(); }, 20000).unref();
let lastStLook = null; setInterval(() => { try { const l = stLook(); if (lastStLook && l !== lastStLook && ST.on) stPush(); lastStLook = l; } catch (e) { /* not ready */ } }, 15000).unref();
const { Replay } = require('./lib/replay');
const replay = new Replay({ obs, store, cfg: () => cfg, saveCfg, push: (a) => push(a), streamNo, restoreFile: path.join(DATA, 'replay-restore.json'), log: (m) => console.log(m),
  dataDir: DATA, bsnPic: path.join(ROOT, 'public', 'replay-cam-bsn.png'),
  defaultLink: (k) => { try { if (k === 'twitch') return twitch.user && twitch.user.login ? 'twitch.tv/' + twitch.user.login : ''; if (k === 'kick') return cfg.kickSlug ? 'kick.com/' + cfg.kickSlug : ''; if (k === 'youtube') return ''; } catch (e) { /* ignore */ } return ''; },
  camName: () => (cam.settings().camName || (cfg.screen && cfg.screen.camName) || ''),
  blocked: () => battle.phase !== 'idle' ? 'A battle is on: replay it after the battle' : obs.cornered ? 'The game is in the battle corner right now' : null,
  score: () => { try { const t = results.team(), d = results.data(t), sh = squad.state().sheet, club = (sh && sh.team) || t.name || ''; if (d && d.last && d.last.us != null && d.last.at > liveSince) return String(club).toUpperCase() + ' ' + d.last.us + ' - ' + d.last.them; return club ? String(club).toUpperCase() : ''; } catch (e) { return ''; } } });
const replayTest = new (require('./lib/replaytest').ReplayTest)({ obs, replay, isLive: () => isLive() });
replay.onFail = (m) => feedAdd('Replay: ' + m, '#ff6b7d');
// ---- Twitch clips (lib/clips.js): the only way replays are made ----
const CLIP_DIR = path.join(DATA, 'clips');
replay.clipDir = CLIP_DIR;
const clips = new (require('./lib/clips').Clips)({ twitch, dir: CLIP_DIR, log: (m) => console.log(m),
  onChange: (j) => { push({ type: 'clipjob', job: { key: j.key, status: j.status, label: j.label, secs: j.secs, error: j.error || null, auto: !!j.auto } });
    if (j.status === 'failed') feedAdd('Clip failed: ' + j.error, '#ff6b7d'); },
  onReady: async (j, out, o) => {
    const r = await replay.addFile(out.file, out.twitch, Object.assign({}, o, { label: j.label }));
    feedAdd('Clip #' + r.clip.n + ' ready' + (r.clip.label ? ' · ' + r.clip.label : '') + (o.play ? (r.playError ? ' (saved: ' + r.playError + ')' : ' · playing') : ' · in the clip list'), '#4dc3ff');
    if (replay.S().discord && cfg.discord && cfg.discord.webhook) postDiscordText('🎬 ' + (r.clip.label || 'New clip') + ' · ' + out.twitch.url).catch(() => {});
    return r;
  } });
replay.clips = clips;
replay.gameLook = () => screens.look('auto');
// v32: which Twitch clips are in the replay list already (Twitch clip id → replay clip id)
clips.have = () => { const m = {}; for (const c of replay.D().list) if (c.twitch && c.twitch.id) m[c.twitch.id] = c.id; return m; };
// clips still waiting for Twitch's video file carry on after a restart
let clipsResumed = false;
setInterval(() => { if (clipsResumed || clips.why()) return; clipsResumed = true; const n = clips.resume(); if (n) feedAdd(n + ' clip' + (n === 1 ? '' : 's') + ' still coming from Twitch: carrying on', '#4dc3ff'); }, 15000).unref();
// pull in clips made on Twitch while you're live (by you on Twitch, or by chat), so they're in the list to pick and play
const clipsPulled = new Set();
async function pullTwitchClips(manual) {
  if (clips.why()) return { error: clips.why() };
  const r = await clips.list({ days: 1, first: 30 }); if (r.error) return r;
  const have = clips.have(), since = Date.now() - 6 * 3600000; let n = 0;
  for (const c of r.list) {
    if (have[c.id] || clipsPulled.has(c.id) || c.job || (c.at && c.at < since)) continue;
    if (n >= (manual ? 10 : 3)) break;
    clipsPulled.add(c.id); clips.get(c.id, { play: false, auto: true, by: c.by || null }); n++;
  }
  return { ok: true, started: n, total: r.list.length };
}
setInterval(() => { if (!twitch.live || !replay.S().on || !replay.S().pullTwitch) return; pullTwitchClips(false).catch(() => {}); }, 120000).unref();
// what replays need now: Twitch login with clip permission, a folder to save to, OBS to play them
async function replayObsCheck() {
  const checks = [];
  const why = clips.why();
  checks.push(why ? { level: 'bad', what: why, fix: 'Setup › Twitch › Connect Twitch, and say yes to the clip permissions.' } : { level: 'ok', what: 'Twitch clips: ready (' + (twitch.live ? 'you are live' : 'they work once you are live') + ')' });
  try { fs.mkdirSync(CLIP_DIR, { recursive: true }); fs.accessSync(CLIP_DIR, fs.constants.W_OK); checks.push({ level: 'ok', what: 'Clips are saved in ' + CLIP_DIR }); } catch (e) { checks.push({ level: 'bad', what: 'Can\'t save clips in ' + CLIP_DIR, fix: 'Move the app folder somewhere you can write to (e.g. Documents).' }); }
  return { checks, last: replay.lastCapture || null, clipsReady: !why };
}
// put the game and camera back if the app or OBS stopped in the middle of a replay
setInterval(() => { try { if (obs.ready && !replay.playing && !replay.busy && fs.existsSync(path.join(DATA, 'replay-restore.json'))) replay.restore().then(() => console.log('Replay: put the scene back')).catch(() => {}); } catch (e) { /* ignore */ } }, 7000).unref();
// chat calls for a replay: "replay" from 5 different people inside 10 seconds lights a button on the dock
const replayCalls = new Map(); let replayWanted = null;
function replayCall(v, text) {
  if (!replay.S().on || !replay.S().chatCall || !/\breplay\b/i.test(text) || /^!/.test(text)) return;
  const now = Date.now(); replayCalls.set(v.key, now); for (const [k, t] of replayCalls) if (now - t > 10000) replayCalls.delete(k);
  if (replayCalls.size >= 5 && (!replayWanted || now - replayWanted.at > 60000)) { replayWanted = { at: now, n: replayCalls.size }; replayCalls.clear(); feedAdd('Chat wants a replay!', '#4dc3ff'); }
}
// make a Twitch clip; manual taps play it as soon as it's ready (setting), automatic ones just go in the clip list
async function replayNow(o) { o = Object.assign({}, o || {}); if (o.play == null) o.play = !o.auto && replay.S().playNow; const r = replay.capture(o); if (r.ok) feedAdd('Clipping the last ' + r.job.secs + ' s' + (r.job.label ? ' · ' + r.job.label : '') + '… (ready in about 20 s)', '#4dc3ff'); return r; }
const CAMX = require('./lib/camera');
const cam = new CAMX.CamStudio({ obs, cfg: () => cfg, saveCfg, push: (a) => push(a), file: path.join(DATA, 'cam-home.json'), log: (m) => console.log(m) });
// v32 camera guard: after a crash / restart the camera goes back where it was, and it never stays off screen
setInterval(() => { if (!obs.ready || replay.playing || replay.busy) return; cam.guard().then((r) => { if (r === 'fixed') feedAdd('Camera was off screen: put back', '#ff5aa0'); else if (r === 'restored') feedAdd('Camera put back where it was', '#ff5aa0'); }).catch(() => {}); }, 6000).unref();
// teeth whitening: stays on the camera; checked every 30 seconds so it comes back after OBS restarts
const { Teeth } = require('./lib/teeth');
const teeth = new Teeth({ obs, cfg: () => cfg, saveCfg, cam, log: (m) => console.log(m) });
let teethOk = false;
setInterval(async () => {
  if (!teeth.S().on || !obs.ready) { teethOk = false; return; }
  try { const it = await cam.item(); const { filters } = await obs.req('GetSourceFilterList', { sourceName: it.name }); if (!(filters || []).some((f) => f.filterName === 'BBR Teeth') || !teethOk) { const r = await teeth.apply(); teethOk = !!r.ok; } } catch (e) { teethOk = false; }
}, 30000).unref();
function camBuy(kind, value, by) {
  const r = cam.fromPurchase(kind, value, by);
  if (r && r.fx) toast((by || 'Chat') + ' bought a camera effect', CAMX.FX[r.fx].label, 6000);
}
setTimeout(() => obs.connect().catch(() => {}), 3000);
// ---------- battle screen: fill the empty space around the Live box, and keep cards off the camera ----------
const SCREEN_DEFAULTS = {
  backdrop: 'brand', withoutObs: false,
  widgets: { rules: { on: true, x: 40, y: 64, w: 560, h: 292 }, board: { on: true, x: 620, y: 64, w: 300, h: 292 }, socials: { on: true, x: 940, y: 64, w: 300, h: 292 } },
  socials: { twitch: 'bigbossrobinson', kick: 'bigbossrobinson', youtube: '@bigbossrobinson' },
  cards: { pos: 'auto', camera: '', cameraCorner: 'none' },
  // other alert tools (Tangia channel points, Streamlabs subs/follows/bits/raids): where they play, and wait for them
  alerts: { on: true, wait: true, holdSecs: 2, maxWaitSecs: 30, delaySecs: 6, redeemSecs: 10, names: '',
    zones: { streamlabs: { on: true, x: 610, y: 40, w: 700, h: 520 }, tangia: { on: true, x: 510, y: 180, w: 900, h: 620 } } }
};
function screenSettings() {
  const c = cfg.screen || {}, s = Object.assign({}, SCREEN_DEFAULTS, c);
  s.widgets = {}; for (const k of Object.keys(SCREEN_DEFAULTS.widgets)) s.widgets[k] = Object.assign({}, SCREEN_DEFAULTS.widgets[k], (c.widgets || {})[k] || {});
  s.socials = Object.assign({}, SCREEN_DEFAULTS.socials, c.socials || {});
  s.cards = Object.assign({}, SCREEN_DEFAULTS.cards, c.cards || {});
  const ca = c.alerts || {};
  s.alerts = Object.assign({}, SCREEN_DEFAULTS.alerts, ca, { zones: {} });
  for (const k of Object.keys(SCREEN_DEFAULTS.alerts.zones)) s.alerts.zones[k] = Object.assign({}, SCREEN_DEFAULTS.alerts.zones[k], (ca.zones || {})[k] || {});
  return s;
}
let camRect = null;
const RULES_LINES = {
  shootout: ['Two players vs the AI keeper. Most goals from 5 kicks, then sudden death.', 'Shooter: type L, C or R on your kick. Add T or B to go top / bottom: LT, RB, T. No pick = a miss.', 'Low composure = more misses. The crowd can rattle you.'],
  race: ['Up to 8 trucks, 3 lanes: steer round obstacles with L / R.', 'Watch your fuel and damage bars. Each truck\'s cargo is a !special.', 'Chat chaos usually hits whoever is leading.'],
  arc: ['Everyone plays. Clear the swarm, then beat the Veydr Queen.', 'Raiders: keep typing !fire. !grenade when it\'s ready, !heal when you\'re hurt.', 'Running out of time? Cheer with the word "time" for extra seconds.']
};
function screenState() {
  const S = screenSettings(), o = obs.settings();
  const active = battle.phase !== 'idle' && battle.phase !== 'join';
  const show = active && (o.on || S.withoutObs) && !battle.tm;   // the team shootout uses the top of the screen for its line-ups
  // a Tangia / Streamlabs source that isn't full screen tells us exactly where it plays; otherwise use the zone set on the page
  const zones = [];
  if (S.alerts.on) for (const k of Object.keys(S.alerts.zones)) {
    const z = S.alerts.zones[k], found = obs.alertList.find((a) => a.kind === k && !a.full && a.rect);
    if (!z.on) continue;
    zones.push(found && !z.custom ? Object.assign({ kind: k }, found.rect) : { kind: k, x: z.x, y: z.y, w: z.w, h: z.h });
  }
  return { type: 'screen', settings: S, show, mode: battle.mode, liveBox: o.on ? obs.boxRect() : null, cam: camRect, camCorner: S.cards.cameraCorner, zones,
    rules: battle.mode ? RULES_LINES[battle.mode] : null, cmds: battle.mode ? battleCommands(battle.mode) : null,
    board: show && S.widgets.board.on ? boardRows('battles', 'week').rows.slice(0, 6).map((r) => ({ display: r.display, pts: r.pts, wins: r.wins, avatar: r.avatar })) : null };
}
function pushScreen() { push(screenState()); }
// look up where the camera is in OBS every 20 seconds (and right after a battle moves things)
setInterval(async () => {
  try {
    const S = screenSettings();
    const r = obs.ready ? await obs.cameraRect(S.cards.camera) : null;
    const key = JSON.stringify(r && [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)]);
    if (key !== JSON.stringify(camRect && [Math.round(camRect.x), Math.round(camRect.y), Math.round(camRect.w), Math.round(camRect.h)])) { camRect = r; pushScreen(); }
  } catch (e) { /* OBS busy */ }
}, 20000).unref();

// ---------- Boss Sports News (ticker, live scores, goal alerts) ----------
// ---------- hold everything while the overlay isn't on air (Starting soon, Big Cam, BRB, end video) ----------
let sceneHeld = false, sceneHeldName = '', heldList = [], playAnywayScene = null;
const HOLDABLE = /^(levelup|pack|show|streakup|checkin|challenge|raidmsg)$/;
setInterval(async () => {
  let held = false;
  try {
    if (obs.ready && cfg.holdOffScene !== false) {
      const on = await obs.overlayOnAir();
      held = on === false && playAnywayScene !== obs.onAirScene;
      if (on !== false || playAnywayScene !== obs.onAirScene) { if (on !== false) playAnywayScene = null; }
    }
  } catch (e) { held = false; }
  if (ST.on && !ST.ended) held = stS().alerts === 'hold';   // Starting Soon: hold everything for kick-off, or show it on that screen
  if (held !== sceneHeld) {
    sceneHeld = held; sceneHeldName = held ? obs.onAirScene : '';
    if (!held) heldList = [];
    push({ type: 'sceneHold', hold: held, scene: sceneHeldName, gapSecs: holdGap() });
  }
}, 2000).unref();
const holdGap = () => (typeof cfg.holdGapSecs === 'number' ? cfg.holdGapSecs : 8);

// things the overlay needs to know as soon as it connects (challenges, scene hold, raid night...)
const connectHooks = [() => ({ type: 'sceneHold', hold: sceneHeld, scene: sceneHeldName, gapSecs: holdGap() }), () => stState()];
// ---------- v30: media library + BRB / Big Cam / links / stingers (lib/media.js, lib/screens.js) ----------
const { Media, musicCfg, musicSet } = require('./lib/media');
const SCR = require('./lib/screens');
const media = new Media({ dir: path.join(DATA, 'media'), store, extraPhotos: () => stS().pics.map((p) => ({ id: 'st-' + p.id, kind: 'photo', name: 'Starting Soon picture', url: '/starting-pic/' + p.id + '.' + p.ext, from: 'starting' })) });
// v33 giveaway meter (lib/gmeter.js): on-screen meter + countdown, fills from subs / gifts / bits / follows / chat entries
const gmeter = new (require('./lib/gmeter').GMeter)({ cfg: () => cfg, saveCfg: () => saveCfg(), push: (e) => push(e), file: path.join(DATA, 'gmeter.json'),
  gameLook: () => screens.look('auto'), feed: (a, b) => feedAdd(a, b), say: (m) => sayAll(m) });
setImmediate(() => connectHooks.push(() => gmeter.payload()));
let gmLook = null; setInterval(() => { try { const l = gmeter.look(); if (gmLook && l !== gmLook && gmeter.st.on) push(gmeter.payload()); gmLook = l; } catch (e) { /* not ready */ } }, 10000).unref();
// v35 simple giveaway (lib/sgiveaway.js): !giveaway puts names in a list on the dock, with a watch-time rule
function watchMinsThisStream(platform, login) { const v = store.get(platform, login); return v && v.swNo === streamNo() ? (v.swMins || 0) : 0; }
const sgw = new (require('./lib/sgiveaway').SimpleGiveaway)({ cfg: () => cfg, saveCfg: () => saveCfg(), push: (e) => push(e), file: path.join(DATA, 'sgiveaway.json'),
  say: (pf, m) => say(pf, m), watchMins: watchMinsThisStream, feed: (a, b) => feedAdd(a, b),
  onWinner: (w) => { try { if (gmeter.st.on) { gmeter.st.winner = { name: w.display, platform: w.platform, at: w.at }; gmeter.save(); push(gmeter.payload({ fx: 'winner' })); } } catch (e) { /* ignore */ } } });
// v38: giveaway bot check (lib/botcheck.js): a suspicion score for each entrant, shown in Giveaways > Giveaway list
const botcheck = new (require('./lib/botcheck').BotCheck)({ cfg: () => cfg, saveCfg: () => saveCfg(), file: path.join(DATA, 'botcheck.json'),
  viewer: (pf, login) => { const v0 = store.get(pf, login); if (!v0) return null; const v = store.primary(v0) || v0; return Object.assign({}, v, { giftsAll: (() => { try { return S.giftsAllTime(v); } catch (e) { return 0; } })() }); },
  watchMins: (pf, login) => watchMinsThisStream(pf, login), streamNo: () => streamNo(),
  twitchUsers: async (logins) => { if (!twitch.user) return []; const j = await twitch.api('GET', '/users?' + logins.map((l) => 'login=' + encodeURIComponent(l)).join('&')); return (j && j.data) || []; },
  changed: () => sgw.rescore() });
sgw.botcheck = botcheck;
setInterval(() => { try { if (sgw.st.open && sgw.count()) sgw.rescore(); } catch (e) { /* ignore */ } }, 20000).unref();
// v38: banned or timed out on Twitch / Kick / YouTube: out of every giveaway (and can't enter again this round)
function onBanned(platform, e) {
  const how = (e.either ? 'banned or timed out' : e.timeout ? 'timed out' : 'banned') + ' on ' + ({ twitch: 'Twitch', kick: 'Kick', youtube: 'YouTube' }[platform] || platform);
  let out = []; try { if (sgw.ban(platform, e.login, how)) out.push('the giveaway list'); } catch (x) { console.error('[ban]', x.message); }
  try { if (spin.ban(platform, e.login)) out.push('the spin'); } catch (x) { console.error('[ban]', x.message); }
  try { if (gmeter.ban(platform, e.login)) { out.push('the giveaway meter'); feedAdd('Giveaway meter: ' + (e.display || e.login) + ' removed (' + how + ')', '#ff6b7d'); } } catch (x) { console.error('[ban]', x.message); }
  try {
    const v0 = store.get(platform, e.login), p0 = v0 && store.primary(v0);
    const keys = [...new Set([v0 && v0.key, p0 && p0.key, platform + ':' + String(e.login).toLowerCase()].filter(Boolean))];
    let hit = false; for (const k of keys) if (giveaways.ban(k, how)) hit = true;
    if (hit) out.push('the ticket giveaway');
  } catch (x) { console.error('[ban]', x.message); }
  if (out.length) console.log('[ban] ' + (e.display || e.login) + ' ' + how + ': removed from ' + out.join(' and '));
  return out;
}
gmeter.ext = () => (sgw.S().showOnTimer ? sgw.payload() : null);
// v38: Ballon d'Or (lib/ballon.js): chat votes once per stream until the closing date; results hidden until you show them
const ballon = new (require('./lib/ballon').Ballon)({ file: path.join(DATA, 'ballon.json'), push: (m) => push(m), say: (pf, m) => say(pf, m), sayAll: (m) => sayAll(m), streamNo: () => streamNo(), botcheck,
  viewer: (pf, login) => { const v0 = store.get(pf, login); if (!v0) return null; const v = store.primary(v0) || v0; return { key: v.key, display: v.display, streams: v.streams || 0 }; },
  feed: (m, c) => feedAdd(m, c) });
setInterval(() => { try { ballon.tick(); } catch (e) { console.error('[ballon]', e.message); } }, 10000).unref();
// the giveaway timer shows the count as people enter
const _sgwPush = sgw.changed.bind(sgw); sgw.changed = () => { _sgwPush(); try { if (gmeter.st.on) push(gmeter.payload()); } catch (e) { /* ignore */ } };
// v39: giveaway spin (lib/spin.js): names scroll on stream, land on a winner, the winner has to type !claim from their own account
function spinCandidates() {
  const won = new Set(sgw.st.winners.map((w) => w.key));
  const all = sgw.st.entries.filter((x) => !won.has(x.key));
  const L = all.filter((x) => !x.held);
  if (L.length) return { from: 'sgw', list: L.map((x) => ({ key: x.key, display: x.display, platform: x.platform, login: x.login })) };
  if (all.length) return { from: 'sgw', list: [], why: 'Everyone left is waiting for a bot check: approve them first' };
  if (sgw.count()) return { from: 'sgw', list: [], why: 'Everyone in the giveaway list has already won' };
  const G = gmeter.st.entries || [];
  if (G.length) return { from: 'gmeter', list: G.map((x) => ({ key: x.key, display: x.name, platform: x.platform, login: x.key.split(':').slice(1).join(':') })) };
  return { from: null, list: [], why: 'Nobody to spin for: the giveaway list is empty (people type ' + sgw.S().cmd + ')' };
}
const spin = new (require('./lib/spin').Spin)({ cfg: () => cfg, saveCfg: () => saveCfg(), push: (e) => push(e), file: path.join(DATA, 'spin.json'), media,
  say: (pf, m) => say(pf, m), feed: (a, b) => feedAdd(a, b), candidates: spinCandidates,
  onClaim: (r) => {
    if (r.from === 'sgw') { sgw.st.winners.unshift({ key: r.key, display: r.display, platform: r.platform, at: r.at, mins: sgw.mins(r.platform, r.login), claimed: true }); sgw.st.winners = sgw.st.winners.slice(0, 20); sgw.changed(); }
    try { if (gmeter.st.on) { gmeter.st.winner = { name: r.display, platform: r.platform, at: r.at }; gmeter.note('Winner: ' + r.display + ' (claimed)'); gmeter.save(); push(gmeter.payload({ fx: 'winner' })); } } catch (e) { /* ignore */ }
  },
  onMissed: (r) => {
    const why = r.result === 'banned' ? 'Banned while picked' : 'Didn\'t claim in time';
    if (r.from === 'sgw') { const x = sgw.st.entries.find((e) => e.key === r.key); if (x) sgw.drop(x, why); else { sgw.st.blocked[r.key] = { why, at: Date.now(), display: r.display }; sgw.changed(); } }
    if (r.from === 'gmeter') { gmeter.st.blocked = gmeter.st.blocked || {}; gmeter.st.blocked[r.key] = Date.now(); gmeter.drop(r.key); gmeter.note('Removed ' + r.display + ' (' + why.toLowerCase() + ')'); }
  } });
setImmediate(() => connectHooks.push(() => spin.payload()));
const screens = new SCR.Screens({ cfg: () => cfg, saveCfg: () => saveCfg(), push: (e) => push(e), obs, media, game: () => currentGame(), theme: () => themeName(), feed: (a, b) => feedAdd(a, b), socials: () => screenSettings().socials, live: () => isLive() });
setInterval(() => { screens.sceneList().catch(() => {}); }, 60000).unref(); setTimeout(() => { screens.sceneList().catch(() => {}); }, 8000).unref();
connectHooks.push(() => ({ type: 'music', act: cfg.musicMuted ? 'mute' : 'unmute' }), () => screens.brbState(), () => screens.bigState(), () => Object.assign({ type: 'linkscfg' }, screens.linksPayload()));
setInterval(() => { try { const s = screens.bigState(); const k = s.set + s.deskSet + s.look; if (k !== screens._bigKey) { if (screens._bigKey) screens.bigPush(); screens._bigKey = k; } } catch (e) { /* ignore */ } }, 20000).unref();

// ---------- per-stream stats ----------
const { StreamLog } = require('./lib/streamlog');
const streamLog = new StreamLog({ store, streamNo, isLive, game: currentGame });
const { Earnings } = require('./lib/earnings');
const earnings = new Earnings({ store, cfg: () => cfg, saveCfg, streamNo, isLive, liveSince: () => liveSince });
function earnAdd(v, platform, kind, n, tier) { try { if (v && !v.test) earnings.add(platform, kind, n, tier); } catch (e) { /* ignore */ } }
setInterval(() => { const cut = Date.now() - 10 * 60000; streamLog.tickMinute(store.all().filter((v) => (v.lastChatAt || 0) > cut || (v.nowOn && (v.lastSeen || 0) > cut)).length); }, 60000).unref();

// ---------- card editor: past support + hand adjustments (with history and undo) ----------
const SNAP_KEYS = ['xp', 'bonus', 'manual', 'bank', 'bits', 'giftsBase', 'giftedSubs', 'subMonths', 'tk', 'cardLock'];
function snap(v) { const o = {}; for (const k of SNAP_KEYS) o[k] = v[k] == null ? null : JSON.parse(JSON.stringify(v[k])); return o; }

// v29 card editor: what each stat is made of (earned from real data, card points, streak boost, your edits)
function cardDetail(v) {
  S.migrate(v);
  const c = card(v), span = R.max - R.start, sk = S.streakInfo(v), boost = Math.min((R.cards || {}).streakBoostMax || 5, sk.level);
  const clampS = (n) => Math.max(R.start, Math.min(R.max, Math.floor(n)));
  const YRS = v.followedAt ? Math.max(0, Math.floor((Date.now() - v.followedAt) / (365.25 * 86400000))) : 0;
  const parts = {};
  for (const k of S.XP_KEYS) { let x = v.xp[k] || 0; if (k === 'LOY') x += YRS * R.anniversaryXp; parts[k] = { earned: clampS(R.start + span * (1 - Math.exp(-x / R.curve[k]))), xp: Math.round(v.xp[k] || 0), points: v.bonus[k] || 0, boost, manual: (v.manual && v.manual[k]) || 0, total: c.stats[k] }; }
  parts.STK = { earned: clampS(R.start + span * (1 - Math.exp(-(sk.now + 0.5 * sk.best) / ((R.cards || {}).stkSpeed || 10)))), points: 0, boost, manual: (v.manual && v.manual.STK) || 0, total: c.stats.STK };
  const t = v.tk || {}, e = safety.expected(v);
  return { key: v.key, card: c, parts, facts: { watchHours: Math.round((v.watchMinutes || 0) / 60), messages: v.messages || 0, bits: v.bits || 0, gifts: S.giftsAllTime(v), subMonths: v.subMonths || 0, streams: v.streams || 0, raids: v.raids || 0 },
    tk: { streak: t.streak || 0, best: t.bestStreak || 0, savers: t.savers || 0, tickets: t.bal || 0 }, history: e ? { streak: e.streak, partial: e.partial, streams: e.streams, of: e.of } : null,
    locked: !!v.cardLock, pending: v.pending ? true : false, edits: (v.edits || []).slice().reverse().slice(0, 12).map((x) => ({ at: x.at, what: x.what })) };
}
function editLog(v, what, before) { v.edits = v.edits || []; v.edits.push({ at: Date.now(), what, before }); if (v.edits.length > 30) v.edits.shift(); }
// "they've given at least this much in total": adds the difference (big amounts are paid out over the next streams)
function setAllTime(v, o, now) {
  const did = [];
  if (o.bits != null && +o.bits > (v.bits || 0)) { const add = Math.round(+o.bits - (v.bits || 0)); v.bits = Math.round(+o.bits); S.addXp(v, 'SUP', add, R, false, now); did.push('+' + add + ' bits'); }
  if (o.gifts != null && +o.gifts > S.giftsAllTime(v)) { const add = Math.round(+o.gifts - S.giftsAllTime(v)); v.giftsBase = Math.max(0, v.giftsBase || 0) + add; S.addXp(v, 'SUP', add * R.cards.giftSup, R, false, now); did.push('+' + add + ' gifted subs'); }
  if (o.months != null && +o.months > (v.subMonths || 0)) { const add = Math.round(+o.months - (v.subMonths || 0)); v.subMonths = Math.round(+o.months); S.addXp(v, 'SUB', add, R, true, now); did.push('+' + add + ' sub months'); }
  return did;
}
function findViewerByName(name) {
  const n = String(name || '').trim().toLowerCase().replace(/^@/, ''); if (!n) return null;
  for (const pf of ['twitch', 'kick', 'youtube']) { const v = store.get(pf, n); if (v) return v; }
  return store.all().find((v) => String(v.display).toLowerCase() === n) || null;
}

// ---------- Raid Night (the Queen Raid as the last thing every stream) ----------
const { RaidNight } = require('./lib/raidnight');
// ---------- live viewer count (Twitch + Kick + YouTube), checked every minute while live ----------
let viewerCache = { n: null, at: 0, by: {} };
async function refreshViewers() {
  if (!isLive()) { viewerCache = { n: null, at: Date.now(), by: {} }; return; }
  const by = {};
  try { if (twitch.user && cfg.twitchOn !== false) by.twitch = await twitch.viewerCount(); } catch (e) { /* ignore */ }
  try { if (kick.configured && kick.configured() && kick.live) by.kick = await kick.viewerCount(); } catch (e) { /* ignore */ }
  try { if (youtube.live) by.youtube = await youtube.viewerCount(); } catch (e) { /* ignore */ }
  const vals = Object.values(by).filter((x) => x != null);
  viewerCache = { n: vals.length ? vals.reduce((a, b) => a + b, 0) : (cfg.testViewers != null ? +cfg.testViewers : null), at: Date.now(), by };
  if (cfg.testViewers != null && !vals.length) viewerCache.test = true;
  if (viewerCache.n !== lastViewerN) { lastViewerN = viewerCache.n; try { raidNight.sync(); } catch (e) { /* ignore */ } }
}
let lastViewerN = null;
setInterval(() => { refreshViewers().catch(() => {}); }, 60000).unref();
setTimeout(() => { refreshViewers().catch(() => {}); }, 8000);
var raidNight = new RaidNight({
  discordPing: (n, need) => { const D = cfg.discord || {}; if (!D.webhook || D.queenPing === false) return; const link = twitch.user ? 'https://twitch.tv/' + twitch.user.login : ''; fetch(D.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'BBR Viewer Club', content: '**The Queen is stirring!** ' + n + ' watching, ' + Math.max(1, need - n) + ' more and she wakes up for Raid Night. Come and help: ' + link }) }).then((r) => feedAdd(r.ok ? 'Posted "Queen stirring" to Discord' : 'Discord said ' + r.status, '#4dc3ff')).catch(() => {}); },
  viewers: () => viewerCache,
  store, cfg: () => cfg, saveCfg, push, say: (m) => sayAll(m), isLive, streamNo, battle, cam, obs,
  sceneHeld: () => sceneHeld,
  chatters: () => { const cut = Date.now() - 10 * 60000; return store.all().filter((v) => !v.test && (v.lastChatAt || 0) > cut).length; },
  displayOf: (k) => (store.data.viewers[k] && store.data.viewers[k].display) || k,
  startRaid: (enlisted) => {
    if (!battle.open('arc', () => { lastBattleLive = liveMs; })) return false;
    setTimeout(() => enlisted.forEach((e) => { try { battle.join(e.platform, e.login, e.display); } catch (err) { /* skip */ } }), 800);
    pushNext(); return true;
  },
  rollCredits: () => rollCredits()
});
{ const ev = streamLog.event.bind(streamLog); streamLog.event = (k, n, key, extra) => { ev(k, n, key, extra); try { raidNight.fromLog(k, n, extra); if ((k === 'sub' || k === 'gift') && showOn('subGoal')) push(subGoalState()); } catch (e) { /* ignore */ } }; }
connectHooks.push(() => raidNight.state());

// ---------- end credits (a browser source over your end video) ----------
function creditsSettings() { const c = cfg.credits || {}; return { secs: Math.max(15, Math.min(600, +c.secs || 60)), teaser: c.teaser || '', auto: c.auto !== false, video: c.video || '' }; }
async function endVideoSecs() {
  if (!obs.ready) return null;
  try {
    const { inputs } = await obs.req('GetInputList', { inputKind: 'ffmpeg_source' });
    const want = creditsSettings().video.toLowerCase();
    const it = (inputs || []).find((x) => want ? x.inputName.toLowerCase() === want : /end|outro|credit|ending|bye/i.test(x.inputName));
    if (!it) return null;
    const st = await obs.req('GetMediaInputStatus', { inputName: it.inputName });
    return st.mediaDuration > 0 ? { name: it.inputName, secs: Math.round(st.mediaDuration / 1000) } : null;
  } catch (e) { return null; }
}
function creditsData(no) {
  const all = store.data.streams || {};
  const n = no || streamNo() || Math.max(0, ...Object.keys(all).map(Number));
  const s = all[n];
  if (!s) return { no: n, empty: true, sections: [] };
  const V = store.data.viewers, name = (k) => (V[k] && V[k].display) || String(k).split(':').pop();
  const ok = (k) => !(V[k] && V[k].isBroadcaster);
  const rows = Object.entries(s.v || {}).filter(([k]) => ok(k));
  const by = (f, fmt) => rows.filter(([, x]) => f(x) > 0).sort((a, b) => f(b[1]) - f(a[1])).map(([k, x]) => ({ name: name(k), note: fmt ? fmt(x) : '' }));
  const sections = [];
  const add = (role, list, sub) => { if (list.length) sections.push({ role, sub: sub || '', names: list }); };
  add('Executive Producers', by((x) => x.s), 'subscribers');
  add('Patrons of the Arts', by((x) => x.g, (x) => x.g + ' gifted'), 'gifted subs');
  add('Special Effects', by((x) => x.b + x.k + x.sc, (x) => [x.b ? x.b + ' bits' : '', x.k ? x.k + ' Kicks' : '', x.sc ? 'Super Chat' : ''].filter(Boolean).join(' · ')), 'bits, Kicks, Super Chats and Power-ups');
  add('The Raid Party', (s.ev || []).filter((e) => e[1] === 'raid').map((e) => ({ name: e[2], note: e[3] + ' viewers' })));
  const rn = store.data.raidNight && store.data.raidNight.nights && store.data.raidNight.nights[n];
  if (rn && rn.result) {
    if (rn.result.win) add('Queen Slayers', rn.result.slayers.map((x) => ({ name: x, note: x === rn.result.mvp ? 'MVP' : '' })), 'Raid Night ' + new Date(rn.result.at).toLocaleDateString('en-GB'));
    add(rn.result.win ? 'The Squad' : 'Fell to the Queen', rn.enlisted.map((e) => ({ name: e.display, note: '' })));
  }
  add('Drone Hunters', Array.from(new Set(((rn && rn.drones) || []).filter((d) => d.down).flatMap((d) => d.by))).map((k) => ({ name: name(k), note: '' })));
  add('New Signings', by((x) => x.n), 'first time here, welcome!');
  add('Battle Cast', by((x) => x.bt, (x) => x.bt + (x.bt === 1 ? ' battle' : ' battles')));
  add('Starring the Chat', by((x) => x.m), 'everyone who said hello');
  // viewer of the stream: support + chat + battles + time watched
  const mvpTop = mvpStandings(n)[0];
  const mvp = mvpTop ? mvpTop.name : null;
  if (mvp) sections.unshift({ role: 'Viewer of the Stream', sub: 'tonight\'s MVP', names: [{ name: mvp, note: '' }] });
  let res = []; try { res = results.tonight().map((r) => r.team.name + ': ' + r.labels.map((l, i) => (r.counts[i] || 0) + ' ' + l).join(' · ')); } catch (e) { /* ignore */ }
  try { const bn = bp.S().credits && bp.night(n); if (bn) { const r0 = bp.reading(bn.peak || 0); sections.push({ role: 'The Boss\'s Blood Pressure', sub: bn.calmest ? 'calmest stream of the season' : bn.calm ? 'cool as ice tonight' : '', names: [{ name: 'Peak ' + r0.sys + '/' + r0.dia, note: bp.level(bn.peak || 0).name + (bn.melts ? ' · ' + bn.melts + ' meltdown' + (bn.melts > 1 ? 's' : '') : '') }] }); } } catch (e) { /* ignore */ }
  if (res.length) sections.push({ role: 'Tonight\'s Results', sub: '', names: res.map((t) => ({ name: t, note: '' })) });
  const T = s.t || {}, games = Object.keys(s.games || {}).sort((a, b) => s.games[b] - s.games[a]);
  const gags = ['No trucks were harmed in the making of this stream (a few were)', 'The keeper\'s feelings were hurt. Repeatedly.', 'Catering by whatever was in the fridge', 'Filmed on location at the Boss\'s desk'];
  const queenWon = rn && rn.result && !rn.result.win;
  return { no: n, start: s.start, end: s.end, games, totals: T, peak: s.peak, sections, gags,
    teaser: queenWon ? 'She\'ll be back next stream... stronger.' : creditsSettings().teaser || (nextStreamCache ? 'Next stream: ' + nextStreamCache.text : 'See you next stream!'), raid: rn && rn.result ? rn.result : null, settings: creditsSettings(), mvp, results: res };
}
let nextStreamCache = null, mvpAnnounced = 0;
async function refreshNextStream() { try { const n = await twitch.nextStream(); nextStreamCache = n ? { at: n.at, title: n.title, text: new Date(n.at).toLocaleString('en-GB', { weekday: 'long', hour: 'numeric', minute: '2-digit' }) + (n.title ? ' · ' + n.title : '') } : null; } catch (e) { /* ignore */ } }
setInterval(refreshNextStream, 30 * 60000).unref(); setTimeout(refreshNextStream, 20000);
// ---------- Viewer of the Stream: everything they did tonight, one score ----------
function mvpWeights() { const w = cfg.mvpWeights || {}; return { support: w.support != null ? +w.support : 1, chat: w.chat != null ? +w.chat : 1, battles: w.battles != null ? +w.battles : 1, watch: w.watch != null ? +w.watch : 1, raids: w.raids != null ? +w.raids : 1 }; }
function mvpStandings(no) {
  const all = store.data.streams || {}, n = no || streamNo() || Math.max(0, ...Object.keys(all).map(Number)), s = all[n]; if (!s) return [];
  const V = store.data.viewers, W = mvpWeights();
  const raids = {}; for (const e of s.ev || []) if (e[1] === 'raid') { const v = Object.values(V).find((x) => x.display === e[2]); if (v) raids[v.key] = (raids[v.key] || 0) + 1; }
  const out = [];
  for (const [k, x] of Object.entries(s.v || {})) {
    const v = V[k]; if (!v || v.isBroadcaster || v.test || isBot(v.login) || !hasCard(v)) continue;
    const parts = { support: ((x.s || 0) * 5 + (x.g || 0) * 5 + ((x.b || 0) + (x.k || 0) + (x.sc || 0)) / 100) * W.support, chat: Math.min(60, (x.m || 0) * 0.2) * W.chat, battles: (x.bt || 0) * 2 * W.battles, watch: Math.min(10, (x.w || 0) / 30) * W.watch, raids: (raids[k] || 0) * 6 * W.raids };
    const score = Object.values(parts).reduce((a, b) => a + b, 0); if (score <= 0) continue;
    out.push({ key: k, name: v.display, score: Math.round(score * 10) / 10, parts, raw: { subs: x.s || 0, gifted: x.g || 0, bits: (x.b || 0) + (x.k || 0), sc: x.sc || 0, msgs: x.m || 0, battles: x.bt || 0, watchMin: x.w || 0, raids: raids[k] || 0 } });
  }
  out.sort((a, b) => b.score - a.score);
  const pick = (cfg.mvpPick || {})[n]; if (pick) { const i = out.findIndex((r) => r.key === pick); if (i > 0) out.unshift(out.splice(i, 1)[0]); }
  return out;
}
function mvpRaceState() { const L = isLive() ? mvpStandings().slice(0, 3) : []; return { type: 'mvprace', list: L.map((r) => ({ name: r.name, score: r.score })) }; }
connectHooks.push(mvpRaceState);
setInterval(() => { if (isLive() && showOn('mvpRace')) push(mvpRaceState()); }, 60000).unref();
async function mvpReveal() {
  const sn = streamNo(), L = mvpStandings(sn), top = L[0]; if (!top) return { error: 'No viewer of the stream yet (nobody has done anything tonight)' };
  const v = store.primary(store.data.viewers[top.key]) || store.data.viewers[top.key];
  const meta = store.data.meta || (store.data.meta = {});
  let first = false;
  if (meta.mvpNo !== sn) {
    meta.mvpNo = sn; first = true;
    v.mvps = (v.mvps || 0) + 1; v.mvpLast = sn;
    // +2 card points, to the lowest stats (same as a check-in point)
    for (let i = 0; i < 2; i++) { const c0 = card(v), low = S.XP_KEYS.filter((x) => (v.bonus[x] || 0) < R.bonusMax).sort((a2, b2) => c0.stats[a2] - c0.stats[b2])[0]; if (low) v.bonus[low] = Math.min(R.bonusMax, (v.bonus[low] || 0) + 1); }
    store.save();
  }
  await withAvatar(v).catch(() => {});
  const r = top.raw, mx = (k) => Math.max(1, ...L.slice(0, 5).map((x) => x.parts[k]));
  const fmtW = (m) => m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm';
  const bars = [['SUPPORT', 'support', [r.subs ? r.subs + ' sub' + (r.subs > 1 ? 's' : '') : '', r.gifted ? r.gifted + ' gifted' : '', r.bits ? r.bits + ' bits' : '', r.sc ? 'Super Chat' : ''].filter(Boolean).join(' · ') || '-'],
    ['CHAT', 'chat', r.msgs + ' msgs'], ['BATTLES', 'battles', r.battles + ' played'], ['WATCHED', 'watch', fmtW(r.watchMin)], ['RAIDS', 'raids', r.raids ? r.raids + ' raid' : '-']]
    .map(([k, p, val]) => ({ k, v: val, w: Math.round(100 * top.parts[p] / mx(p)) }));
  push({ type: 'mvp', card: card(v), name: v.display, bars, times: v.mvps || 1, runnerUp: L[1] ? { name: L[1].name, gap: Math.round((top.score - L[1].score) * 10) / 10 } : null, streamNo: sn, points: first ? 2 : 0 });
  feedAdd('Viewer of the Stream: ' + v.display, '#f6d77a');
  if (first) sayAll('VIEWER OF THE STREAM: ' + v.display + '! Thank you for everything tonight. +2 card points and the MVP ribbon.');
  return { ok: true, name: v.display };
}
async function rollCredits() {
  try { const R = replay.S(), c = R.on && R.ofNight ? replay.bestOfNight(streamNo()) : null; if (c && obs.ready) { const r = await replay.play(c.id, { label: 'REPLAY OF THE NIGHT' + (c.label ? ' · ' + c.label : ''), ofNight: true, temp: true }); if (r.ok) await new Promise((res) => setTimeout(res, (r.playing.secs / r.playing.speed * r.playing.times + 2.5) * 1000)); } } catch (e) { /* ignore */ }
  try { if (cfg.mvpAuto !== false && showOn('mvpReveal') && (store.data.meta || {}).mvpNo !== streamNo()) { const r = await mvpReveal(); if (r.ok) await new Promise((res) => setTimeout(res, 13000)); } } catch (e) { /* ignore */ }
  const v = await endVideoSecs(); push({ type: 'credits', action: 'roll', secs: v ? v.secs : creditsSettings().secs });
  try {
    const d = creditsData(0), sn = d.no;
    if (d.mvp && mvpAnnounced !== sn && !showOn('mvpReveal')) { mvpAnnounced = sn; push({ type: 'toast', text: 'VIEWER OF THE STREAM: ' + d.mvp, sub: 'thank you!', ms: 9000 }); }
    if ((cfg.discord || {}).auto && (cfg.discord || {}).webhook && (cfg.discord.lastNo !== sn)) { cfg.discord.lastNo = sn; saveCfg(); postDiscord(d).then((r) => feedAdd(r.ok ? 'Posted the night to Discord' : 'Discord: ' + r.error, '#4dc3ff')); }
  } catch (e) { console.log('[credits] ' + e.message); }
}

// ---------- challenge tracker ----------
const { Challenges } = require('./lib/challenges');
const challenges = new Challenges({ store, cfg: () => cfg, saveCfg, push, say: (m) => sayAll(m) });
connectHooks.push(() => Object.assign({ type: 'challenges' }, challenges.state()));
{ const st = challenges.step.bind(challenges); challenges.step = (d) => { const r = st(d); if (r && (d || 1) > 0 && !r.doneAt) undoAdd('ch-' + r.id, r.name + ': game done (' + r.left + ' left)', () => st(-1)); return r; }; }

// ---------- rewards: every Power-up and channel point reward, matched to challenges / camera effects ----------
const { Rewards } = require('./lib/rewards');
const rewards = new Rewards({ store, cfg: () => cfg, saveCfg, push, challenges, cam, twitch, showNames: () => showOn('rewardNames'),
  oldRules: (t) => { const c = challenges.ruleFor(t); return { challenge: c ? { name: c.name, count: c.count, unit: c.unit } : null, camera: cam.rewardRule(t) }; } });


const bsn = new BSN({ cfg: () => cfg, obs, dataDir: DATA, publicDir: path.join(ROOT, 'public'),
  viewerNames: () => store.all().filter((v) => !v.test && !v.isBroadcaster).sort((a, b) => (b.messages || 0) - (a.messages || 0)).map((v) => v.display) });
function bsnTickerEv() { const S = bsn.S(), L = cfg.tickerLayer || 'overlay'; return { type: 'bsnTicker', on: S.on, hide: L === 'hidden' || (battle.phase !== 'idle' && !S.ticker.duringBattles), separate: L === 'front' || L === 'behind' }; }
function bsnTicker() { push(bsnTickerEv()); }

// ======================= v19: on-screen switches, layout, results, scores, stories, extras =======================
// every thing the app puts on screen can be switched off (Battle screen > On screen)
var SHOW_DEF = { bp: 1, bossRecord: 1, chat: 0, mvpReveal: 1, mvpRace: 0, redCard: 1, squadSheet: 1, counters: 1, checkinCards: 1, cardFacts: 1, cardFlip: 1, cardProfile: 1, rewardNames: 0, rnPill: 1, results: 1, resultsCard: 1, scores: 1, scoresPanel: 0, subGoal: 0,
  hype: 1, crown: 1, gameBanner: 1, featured: 1, camFrames: 1, giftAllTime: 1, subBand: 1, breaking: 1, predictions: 0, raidTaunt: 1, drones: 1 };
function showOn(k) { const s = cfg.show || {}; return s[k] != null ? !!s[k] : !!(SHOW_DEF || {})[k]; }
function showState() { return { type: 'showcfg', show: Object.fromEntries(Object.keys(SHOW_DEF).map((k) => [k, showOn(k)])), panic: !!cfg.panic }; }
function pushShow() { push(showState()); }
connectHooks.push(showState);
function setPanic(on) {
  on = !!on; if (!!cfg.panic === on) return on;
  if (on) { cfg.panicPrev = { paused: !!cfg.battlesPaused, lock: cam.settings().lock }; cfg.panic = true; pauseBattles(true); cam.setSettings({ lock: true }); feedAdd('PANIC: everything hidden', '#ff6b7d'); move.fire('panic'); }
  else { const P = cfg.panicPrev || {}; cfg.panic = false; pauseBattles(!!P.paused); cam.setSettings({ lock: !!P.lock }); feedAdd('Back on screen', '#3dff9a'); }
  saveCfg(); pushShow(); return on;
}

// ---------- layout: drag widgets anywhere (saved per game) ----------
const WIDGETS = {
  bp: { label: 'Blood pressure meter', w: 340, h: 170, x: 1540, y: 500 },
  challenges: { label: 'Challenge tracker', w: 330, h: 120, x: 40, y: 40 }, rnPill: { label: 'Raid Night pill', w: 640, h: 46, x: 640, y: 64 },
  results: { label: 'Team results', w: 560, h: 84, x: 1320, y: 40 }, chat: { label: 'Chat', w: 440, h: 330, x: 40, y: 660 }, mvpRace: { label: 'Race for MVP', w: 300, h: 130, x: 40, y: 230 }, redCard: { label: 'Red card reminder', w: 300, h: 86, x: 40, y: 380 }, squadSheet: { label: 'Team sheet / squad', w: 420, h: 150, x: 1460, y: 660 }, scores: { label: 'Live score', w: 560, h: 50, x: 1320, y: 140 },
  subGoal: { label: 'Sub goal bar', w: 620, h: 46, x: 650, y: 120 }, nextTimer: { label: 'Next battle timer', w: 420, h: 44, x: 750, y: 18 }
};
function layoutGroup() { const g = currentGame(); return HEIST_RE.test(g) ? 'gta' : /truck|ats\b|ets\s?2|euro truck|american truck/i.test(g) ? 'truck' : /arc raiders/i.test(g) ? 'arc' : /\bfc\b|fc \d|fifa|football|soccer|ea sports/i.test(g) ? 'fc' : 'other'; }
function layoutState() { const g = layoutGroup(); return { type: 'layout', group: g, pos: ((cfg.layouts || {})[g]) || {} }; }
connectHooks.push(layoutState);
let lastGroup = null, lastGameSeen = null;
setInterval(() => {
  const g = layoutGroup(); if (g !== lastGroup) { lastGroup = g; push(layoutState()); results.sync(); }
  const game = currentGame();
  if (lastGameSeen !== null && game && game !== lastGameSeen && isLive() && showOn('gameBanner')) push({ type: 'gamebanner', game });
  lastGameSeen = game;
}, 5000).unref();

// ---------- Beat the Boss: one viewer vs you in a penalty shootout, your card on the line ----------
function bossS() { const b = cfg.boss || {}; return { stakes: ['friendly', 'normal', 'allin'].includes(b.stakes) ? b.stakes : 'normal', floor: Math.max(40, Math.min(99, +b.floor || 75)), bountyStart: Math.max(0, Math.min(20, b.bountyStart != null ? +b.bountyStart : 2)), bountyStep: Math.max(0, Math.min(10, b.bountyStep != null ? +b.bountyStep : 2)), subsFirst: b.subsFirst !== false }; }
function bossData() { const d = store.data; if (!d.boss) d.boss = { form: 0, wins: 0, losses: 0, bounty: null, dirs: { shoot: { L: 1, C: 1, R: 1 }, dive: { L: 1, C: 1, R: 1 } }, slayers: {} }; if (d.boss.bounty == null) d.boss.bounty = bossS().bountyStart; return d.boss; }
function bossInfo() { const B = bossData(), S2 = bossS(); return { form: B.form, wins: B.wins, losses: B.losses, bounty: B.bounty * (S2.stakes === 'allin' ? 2 : 1), stakes: S2.stakes, settings: S2, slayers: Object.entries(B.slayers || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ name: (store.data.viewers[k] || {}).display || k, n })) }; }
// points straight onto a card (lowest stats first), not counted against the daily battle cap
function giveCardPoints(v, n) { for (let k = 0; k < n; k++) { const c = card(v), low = S.XP_KEYS.filter((x) => (v.bonus[x] || 0) < R.bonusMax).sort((a, b) => c.stats[a] - c.stats[b])[0]; if (low) v.bonus[low] = Math.min(R.bonusMax, (v.bonus[low] || 0) + 1); else { const lo2 = S.STAT_KEYS.slice().sort((a, b) => c.stats[a] - c.stats[b])[0]; v.manual = v.manual || {}; v.manual[lo2] = Math.min(59, (v.manual[lo2] || 0) + 1); } } }
Object.assign(battle, {
  bossFighter: () => { const v = store.all().find((x) => x.isBroadcaster && !x.test); return v ? { key: v.key, platform: v.platform, login: v.login, display: v.display } : null; },
  bossPrefer: (key) => { if (!bossS().subsFirst) return 0; const v = store.data.viewers[key]; return v && v.lastSubAt && Date.now() - v.lastSubAt < 35 * 86400000 ? 1 : 0; },
  bossAuto: (role) => { const D = bossData().dirs[role] || { L: 1, C: 1, R: 1 }, t = D.L + D.C + D.R, r = Math.random() * t; return r < D.L ? 'L' : r < D.L + D.C ? 'C' : 'R'; },
  bossLearn: (role, d) => { const D = bossData().dirs[role]; if (D) { D[d] = (D[d] || 0) + 1; store.save(); } },
  bossInfo,
  onBossTurn: (role) => push({ type: 'bossturn', role }),
  onBoss: (r) => {
    try { bp.auto(r.viewerWon ? 'bossLost' : 'bossWon', r.viewerWon ? 'Lost Beat the Boss' : 'Won Beat the Boss'); } catch (e) { /* ignore */ }
    const B = bossData(), S2 = bossS(), step = S2.stakes === 'friendly' ? 0 : S2.stakes === 'allin' ? 3 : 1, bounty = B.bounty * (S2.stakes === 'allin' ? 2 : 1);
    if (r.viewerWon) {
      B.losses++; B.form = Math.max(-25, B.form - step);
      const v = store.data.viewers[r.viewer.key];
      if (v) { const p2 = store.primary(v) || v; p2.bossWins = (p2.bossWins || 0) + 1; B.slayers[p2.key] = (B.slayers[p2.key] || 0) + 1; if (S2.stakes !== 'friendly') giveCardPoints(p2, bounty); }
      if (S2.stakes !== 'friendly') B.bounty = S2.bountyStart;
      addStory({ cat: 'Breaking', text: String(r.viewer.display).toUpperCase() + ' BEATS THE BOSS ' + r.score[0] + '-' + r.score[1] + (S2.stakes !== 'friendly' ? ' AND TAKES A ' + bounty + '-POINT BOUNTY' : ''), keep: 'stream', freq: 'often', breaking: showOn('breaking') });
      feedAdd(r.viewer.display + ' beat the Boss ' + r.score[0] + '-' + r.score[1], '#ff6b7d');
    } else {
      B.wins++; B.form = Math.min(10, B.form + step);
      if (S2.stakes !== 'friendly') B.bounty = Math.min(40, B.bounty + S2.bountyStep);
      feedAdd('The Boss beat ' + r.viewer.display + ' ' + r.score[1] + '-' + r.score[0], '#3dff9a');
    }
    store.save(); push(Object.assign({ type: 'bossrecord' }, bossInfo()));
  }
});
connectHooks.push(() => Object.assign({ type: 'bossrecord' }, bossInfo()));

// ---------- buttons: one list for the OBS dock, Stream Deck and the phone ----------
function actionList() {
  const A = [];
  const add = (group, id, label, u, color) => A.push({ group, id, label, u, color });
  add('Game', 'result-win', 'Result: win', '/control/result-win', '#3dff9a'); add('Game', 'result-draw', 'Result: draw', '/control/result-draw', '#ffd23f'); add('Game', 'result-loss', 'Result: loss', '/control/result-loss', '#ff6b7d'); add('Game', 'result-undo', 'Result: undo', '/control/result-undo', '#a7b0ba');
  for (const c of counters.list()) { add('Game', 'counter-plus:' + c.id, c.name + ' +1', '/control/counter-plus?id=' + encodeURIComponent(c.id), c.color); add('Game', 'counter-minus:' + c.id, c.name + ' -1', '/control/counter-minus?id=' + encodeURIComponent(c.id), c.color); }
  add('Game', 'redcard', 'Red card rule (tap again to clear)', '/control/redcard', '#ff3b3b');
  for (const r of rcS().rules) add('Game', 'redcard:' + r.id, 'Red card: ' + (r.text || r.title).slice(0, 30), '/control/redcard?rule=' + encodeURIComponent(r.id), '#ff3b3b');
  add('Game', 'redcard-y2', 'Two yellows (' + rcS().yellowBan + ' match ban)', '/control/redcard?kind=yellow2', '#ffd23f');
  add('Game', 'redcard-red', 'Straight red (' + rcS().redBan + ' match ban)', '/control/redcard?kind=red', '#ff3b3b');
  add('Game', 'redcard-clear', 'Red card: clear', '/control/redcard-clear', '#ff3b3b');
  add('Replay', 'replay', 'Clip + replay the last ' + replay.S().secs + ' s', '/control/replay', '#4dc3ff');
  add('Replay', 'clip', 'Clip only (save for later)', '/control/clip', '#4dc3ff');
  add('Stream', 'bot-mute', 'Mute / unmute the chat bot', '/control/bot-mute', '#ff6b7d');
  add('Replay', 'replay-slow', 'Replay in slow-mo', '/control/replay-slow', '#4dc3ff');
  for (const L of replay.S().labels.slice(0, 6)) add('Replay', 'replay:' + L, 'Replay: ' + L, '/control/replay?label=' + encodeURIComponent(L), '#4dc3ff');
  add('Replay', 'replay-studio', 'Studio replay (clip left, game right)', '/control/replay?look=studio', '#4dc3ff');
  add('Replay', 'replay-again', 'Replay again', '/control/replay-again', '#4dc3ff');
  add('Replay', 'replay-freeze', 'Freeze / play (analysis)', '/control/replay-freeze', '#f5c400'); add('Replay', 'replay-clear', 'Clear the drawings', '/control/replay-clear', '#f5c400');
  add('Replay', 'replay-stop', 'Stop replay (back to live)', '/control/replay-stop', '#4dc3ff');
  add('Giveaway', 'sgw-toggle', 'Giveaway list: open / close', '/control/sgw-toggle', '#ffd23f'); add('Giveaway', 'sgw-open', 'Giveaway list: open', '/control/sgw-open', '#3dff9a'); add('Giveaway', 'sgw-close', 'Giveaway list: close', '/control/sgw-close', '#ff6b7d');
  add('Giveaway', 'spin-start', 'Giveaway: SPIN for a winner', '/control/spin-start', '#ffd23f'); add('Giveaway', 'spin-claim', 'Giveaway spin: mark as claimed', '/control/spin-claim', '#3dff9a'); add('Giveaway', 'spin-skip', 'Giveaway spin: not claimed (out)', '/control/spin-skip', '#ff6b7d'); add('Giveaway', 'spin-hide', 'Giveaway spin: hide', '/control/spin-hide', '#a7b0ba');
  add('Giveaway', 'gmeter-hideclock', 'Giveaway clock: hide / show on stream', '/control/gmeter-hideclock', '#ffd23f');
  add('Giveaway', 'sgw-pick', 'Giveaway list: pick a winner', '/control/sgw-pick', '#ffd23f'); add('Giveaway', 'sgw-clear', 'Giveaway list: clear', '/control/sgw-clear', '#ff6b7d');
  add('Giveaway', 'gmeter-toggle', 'Giveaway meter: on / off', '/control/gmeter-toggle', '#ffd23f'); add('Giveaway', 'gmeter-start', 'Giveaway meter: start', '/control/gmeter-start', '#3dff9a');
  add('Giveaway', 'gmeter-pause', 'Giveaway meter: pause / resume', '/control/gmeter-pause', '#f5c400'); add('Giveaway', 'gmeter-stop', 'Giveaway meter: stop (hide)', '/control/gmeter-stop', '#ff6b7d');
  add('Giveaway', 'gmeter-restart', 'Giveaway meter: restart from 0', '/control/gmeter-restart', '#4dc3ff'); add('Giveaway', 'gmeter-add', 'Giveaway meter: +1', '/control/gmeter-add', '#3dff9a');
  add('Giveaway', 'gmeter-minus', 'Giveaway meter: -1', '/control/gmeter-minus', '#ff6b7d'); add('Giveaway', 'gmeter-plus1', 'Giveaway clock: +1 min', '/control/gmeter-plus1', '#ffd23f');
  add('Giveaway', 'gmeter-minus1', 'Giveaway clock: -1 min', '/control/gmeter-minus1', '#ffd23f'); add('Giveaway', 'gmeter-addtime-10', 'Giveaway clock: +10 min', '/control/gmeter-addtime?mins=10', '#ffd23f'); add('Giveaway', 'gmeter-addtime-60', 'Giveaway clock: +1 hour', '/control/gmeter-addtime?hours=1', '#ffd23f');
  add('Giveaway', 'gmeter-mode-timer', 'Giveaway: countdown only', '/control/gmeter-mode?m=timer', '#ffd23f'); add('Giveaway', 'gmeter-mode-meter', 'Giveaway: meter + countdown', '/control/gmeter-mode?m=meter', '#ffd23f'); add('Giveaway', 'gmeter-pick', 'Giveaway: pick a winner', '/control/gmeter-pick', '#ffd23f');
  add('Battles', 'battles-switch', 'Battles: ON / OFF completely', '/control/battles-switch', '#ff6b7d'); add('Battles', 'battles-off', 'Battles: OFF completely', '/control/battles-off', '#ff6b7d'); add('Battles', 'battles-on', 'Battles: back ON', '/control/battles-on', '#3dff9a');
  add('Replay', 'replay-pause', 'Pause / play the replay', '/control/replay-pause', '#f5c400'); add('Replay', 'replay-back', 'Replay: back 2 seconds', '/control/replay-back', '#f5c400'); add('Replay', 'replay-fwd', 'Replay: forward 2 seconds', '/control/replay-fwd', '#f5c400');
  add('Replay', 'replay-frame-back', 'Replay: one frame back', '/control/replay-frame-back', '#f5c400'); add('Replay', 'replay-frame-fwd', 'Replay: one frame forward', '/control/replay-frame-fwd', '#f5c400'); add('Replay', 'clip-pull', 'Get tonight\'s Twitch clips', '/control/clip-pull', '#4dc3ff');
  add('Stream', 'undo-last', 'Undo the last thing', '/control/undo-last', '#a7b0ba');
  add('Game', 'motm-open', 'Man of the match: start vote', '/control/motm-open', '#f6d77a'); add('Game', 'motm-close', 'Man of the match: close vote', '/control/motm-close', '#f6d77a');
  add('Game', 'redcard-shame', 'Hall of Shame on screen', '/control/redcard-shame', '#ff3b3b');
  add('Game', 'challenge-done', 'Challenge: game done', '/control/challenge-done', '#ffb020'); add('Game', 'challenge-undo', 'Challenge: undo', '/control/challenge-undo', '#ffb020'); add('Game', 'challenge-pause', 'Challenge: pause / show', '/control/challenge-pause', '#ffb020');
  add('Game', 'squad-next', 'Squad: next team sheet', '/control/squad-next', '#f6d77a'); add('Game', 'squad-show', 'Squad: show team sheet', '/control/squad-show', '#f6d77a');
  add('Stream', 'show:chat', 'Chat on / off', '/control/show?k=chat', '#4dc3ff'); add('Stream', 'mvp', 'Viewer of the Stream', '/control/mvp', '#f6d77a'); add('Stream', 'marker', 'Mark this moment', '/control/marker', '#9146ff');
  add('Stream', 'panic', 'Panic: hide everything', '/control/panic', '#ff3b3b'); add('Stream', 'scores', 'Scores round-up', '/control/scores', '#e01e2e'); add('Stream', 'top20', 'Top 20 cards', '/control/board?type=cards&top=20', '#3dff9a');
  add('Stream', 'credits', 'Roll the credits', '/control/credits', '#4dc3ff'); add('Stream', 'held-play', 'Play waiting alerts', '/control/held-play', '#4dc3ff');
  for (const k of ['results', 'scores', 'subGoal', 'counters', 'mvpRace', 'redCard', 'squadSheet', 'featured', 'hype']) add('Stream', 'show:' + k, 'On / off: ' + k.replace(/([A-Z])/g, ' $1').toLowerCase(), '/control/show?k=' + k, '#4dc3ff');
  add('Battles', 'start', 'Start a battle now', '/control/start', '#3dff9a'); add('Battles', 'delay', 'Battle +5 min', '/control/delay?min=5', '#3dff9a'); add('Battles', 'cancel', 'Cancel battle', '/control/cancel', '#ff6b7d'); add('Battles', 'toggle', 'Battles on / off', '/control/toggle', '#3dff9a');
  add('Battles', 'boss-start', 'Beat the Boss: open', '/control/boss-start', '#ff3b3b'); add('Battles', 'boss-l', 'Boss: LEFT', '/control/boss-l', '#ff3b3b'); add('Battles', 'boss-c', 'Boss: CENTRE', '/control/boss-c', '#ff3b3b'); add('Battles', 'boss-r', 'Boss: RIGHT', '/control/boss-r', '#ff3b3b');
  add('Game', 'bp-up', 'Blood pressure +5', '/control/bp-up', '#ff8a2a'); add('Game', 'bp-up15', 'Blood pressure +15', '/control/bp-up15', '#ff3b3b'); add('Game', 'bp-down', 'Blood pressure: calm -10', '/control/bp-down', '#3dff9a'); add('Game', 'bp-melt', 'MELTDOWN', '/control/bp-melt', '#ff1744'); add('Game', 'bp-reset', 'Blood pressure reset', '/control/bp-reset', '#a7b0ba');
  add('Stream', 'starting-start', 'Starting soon: start', '/control/starting-start', '#4dc3ff'); add('Stream', 'starting-pause', 'Starting soon: pause / go', '/control/starting-pause', '#4dc3ff'); add('Stream', 'starting-add30', 'Starting soon +30s', '/control/starting-add30', '#4dc3ff'); add('Stream', 'starting-live', 'Kick-off: go live now', '/control/starting-live', '#3dff9a');
  add('Battles', 'teampens-open', 'Team shootout: open', '/control/teampens-open', '#f5c400'); add('Battles', 'teampens-3', 'Team shootout 3 v 3', '/control/teampens-3', '#f5c400'); add('Battles', 'teampens-5', 'Team shootout 5 v 5', '/control/teampens-5', '#f5c400'); add('Battles', 'teampens-skip', 'Team shootout: skip AFK shooter', '/control/teampens-skip', '#f5c400'); add('Battles', 'teampens-pause', 'Team shootout: pause / go', '/control/teampens-pause', '#f5c400'); add('Battles', 'teampens-end', 'Team shootout: end', '/control/teampens-end', '#ff6b7d');
  add('Battles', 'queen-wake', 'Wake the Queen', '/control/queen-wake', '#c58bff'); add('Battles', 'queen-now', 'Queen: start now', '/control/queen-now', '#c58bff'); add('Battles', 'queen-aftergame', 'Queen after this game', '/control/queen-aftergame', '#c58bff'); add('Battles', 'queen-later', 'Queen later +10', '/control/queen-later', '#c58bff'); add('Battles', 'raidnight-drone', 'Send a drone', '/control/raidnight-drone', '#c58bff');
  add('Camera', 'cam-reset', 'Camera: reset (back to your saved spot)', '/control/cam-reset', '#ff5aa0'); add('Camera', 'cam-savespot', 'Camera: save this spot', '/control/cam-savespot', '#ff5aa0'); add('Camera', 'corner', 'Game to corner', '/control/corner', '#ff5aa0'); add('Camera', 'restore', 'Game back', '/control/restore', '#ff5aa0');
  for (const k of Object.keys(CAMX.FX).filter((x) => x !== 'reset')) add('Camera', 'cam-' + k, 'Camera: ' + CAMX.FX[k].label, '/control/cam-' + k, '#ff5aa0');
  // v29
  add('Battles', 'start-now', 'Start the game now (stop waiting for joins)', '/control/start-now', '#f5c400');
  add('Stream', 'cards-freeze', 'Freeze / unfreeze all cards', '/control/cards-freeze', '#ffb020'); add('Stream', 'cards-undo10', 'Undo the last 10 minutes of card points', '/control/cards-undo10', '#ffb020');
  add('Stream', 'reconnect', 'Reconnect Twitch / Kick / YouTube / OBS', '/control/reconnect', '#a7b0ba'); add('Battles', 'stop-games', 'Stop all games', '/control/stop-games', '#ff6b7d');
  add('Stream', 'starting-stop', 'Starting soon: STOP', '/control/starting-stop', '#4dc3ff'); add('Stream', 'starting-plus1', 'Starting soon +1 min', '/control/starting-plus1', '#4dc3ff'); add('Stream', 'starting-minus1', 'Starting soon −1 min', '/control/starting-minus1', '#4dc3ff');
  add('Replay', 'replay-last-slow', 'Last clip in slow-mo', '/control/replay-last-slow', '#4dc3ff');
  // v30
  add('Stream', 'brb', 'Be right back / I\'m back (with stinger)', '/control/brb', '#c58bff'); add('Stream', 'brb-plus1', 'BRB timer +1 min', '/control/brb-plus1', '#c58bff'); add('Stream', 'brb-timer-stop', 'BRB timer stop', '/control/brb-timer-stop', '#c58bff'); add('Stream', 'brb-timer-start', 'BRB timer start', '/control/brb-timer-start', '#c58bff');
  add('Camera', 'bigcam-go', 'Stinger to Big Cam', '/control/bigcam-go', '#4dc3ff'); add('Camera', 'bigcam-next', 'Big Cam: next set', '/control/bigcam-next', '#4dc3ff'); add('Camera', 'bigcam-prev', 'Big Cam: previous set', '/control/bigcam-prev', '#4dc3ff'); add('Camera', 'bigcam-music', 'Big Cam music on / off', '/control/bigcam-music', '#4dc3ff');
  add('Stream', 'links-now', 'Show my links now', '/control/links-now', '#9146ff'); add('Stream', 'links-toggle', 'Links timer on / off', '/control/links-toggle', '#9146ff'); add('Stream', 'stinger', 'Play the stinger', '/control/stinger', '#ffd400');
  add('Stream', 'music-mute', 'Music on / off', '/control/music-mute', '#a7b0ba'); add('Stream', 'music-skip', 'Next song', '/control/music-skip', '#a7b0ba');
  for (const sc of (screens.scenes || []).slice(0, 15)) add('Camera', 'scene:' + sc, 'Stinger to: ' + sc, '/control/stinger-to?scene=' + encodeURIComponent(sc), '#ffd400');
  add('Stream', 'theme-ets', 'Theme: Euro Truck Simulator', '/control/theme-ets', '#ffd400'); add('Stream', 'theme-football', 'Theme: Football', '/control/theme-football', '#e3132c'); add('Stream', 'theme-heist', 'Theme: Sunset Heist (GTA-style)', '/control/theme-heist', '#ff3d8b');
  return A;
}
const BTN_DEFAULT = [['result-win', 'WIN', 'W', 'Game'], ['result-draw', 'DRAW', 'D', 'Game'], ['result-loss', 'LOSS', 'L', 'Game'], ['counter-plus:godfather', 'GODFATHER', '+1', 'Game'], ['redcard-y2', '2 YELLOWS', 'YY', 'Game'], ['redcard-red', 'STRAIGHT RED', 'RED', 'Game'], ['replay', 'REPLAY', 'RPL', 'Replay'], ['replay-slow', 'SLOW-MO', '0.5×', 'Replay'], ['replay-stop', 'BACK TO LIVE', 'LIVE', 'Replay'], ['challenge-done', 'GAME DONE', '✓', 'Game'],
  ['show:chat', 'CHAT', 'CHAT', 'Stream'], ['mvp', 'MVP', 'MVP', 'Stream'], ['marker', 'MARK', 'M', 'Stream'], ['cam-goal', 'GOAL CAM', 'GC', 'Camera'], ['start', 'BATTLE', 'GO', 'Battles'], ['panic', 'PANIC', '!', 'Stream'],
  ['boss-start', 'BEAT BOSS', 'BB', 'Battles'], ['queen-aftergame', 'QUEEN AFTER', 'Q+', 'Battles'], ['squad-next', 'TEAM SHEET', 'XI', 'Game']];

// v30: every Stream Deck key worth having, page by page (Buttons & Stream Deck › Stream Deck: every button)
function deckPack() {
  const P = [], k = (page, label, icon, color, u) => P.push({ page, label, icon, color, u });
  // Live
  k('Live', 'WIN', 'W', '#3dff9a', '/control/result-win'); k('Live', 'DRAW', 'D', '#ffd23f', '/control/result-draw'); k('Live', 'LOSS', 'L', '#ff6b7d', '/control/result-loss');
  k('Live', 'MARK IT', 'M', '#9146ff', '/control/marker'); k('Live', 'CHAT ON/OFF', 'CH', '#4dc3ff', '/control/show?k=chat'); k('Live', 'MVP', 'MVP', '#f6d77a', '/control/mvp');
  k('Live', 'UNDO', '↶', '#a7b0ba', '/control/undo-last'); k('Live', 'CREDITS', 'END', '#4dc3ff', '/control/credits'); k('Live', 'TOP 20', '20', '#f6d77a', '/control/board?type=cards&top=20');
  k('Live', 'RED CARD', 'RC', '#ff3b3b', '/control/redcard'); k('Live', '2 YELLOWS', 'YY', '#ffd23f', '/control/redcard?kind=yellow2'); k('Live', 'BP +5', 'BP', '#ff8a2a', '/control/bp-up');
  k('Live', 'BP CALM', 'BP', '#3dff9a', '/control/bp-down'); k('Live', 'PANIC', '!', '#ff3b3b', '/control/panic'); k('Live', 'BOT MUTE', 'BOT', '#ff6b7d', '/control/bot-mute');
  // Screens
  k('Screens', 'BRB / BACK', 'BRB', '#c58bff', '/control/brb'); k('Screens', 'BIG CAM', 'CAM', '#4dc3ff', '/control/bigcam-go'); k('Screens', 'NEXT SET', 'SET', '#4dc3ff', '/control/bigcam-next');
  k('Screens', 'PREV SET', 'SET', '#4dc3ff', '/control/bigcam-prev'); k('Screens', 'CAM MUSIC', '♪', '#4dc3ff', '/control/bigcam-music'); k('Screens', 'LINKS NOW', '@', '#9146ff', '/control/links-now');
  k('Screens', 'LINKS TIMER', '@', '#9146ff', '/control/links-toggle'); k('Screens', 'STINGER', '>>', '#ffd400', '/control/stinger'); k('Screens', 'MUSIC MUTE', '♪', '#a7b0ba', '/control/music-mute');
  k('Screens', 'NEXT SONG', '♪>', '#a7b0ba', '/control/music-skip'); k('Screens', 'ETS THEME', 'ETS', '#ffd400', '/control/theme-ets'); k('Screens', 'FOOTY THEME', 'FC', '#e3132c', '/control/theme-football'); k('Screens', 'HEIST THEME', 'GTA', '#ff3d8b', '/control/theme-heist');
  k('Screens', 'GAME CORNER', '◱', '#ff5aa0', '/control/corner'); k('Screens', 'GAME BACK', '▣', '#ff5aa0', '/control/restore'); k('Screens', 'SCORES', 'FT', '#e01e2e', '/control/scores');
  // Timers
  k('Timers', 'SOON START', '▶', '#3dff9a', '/control/starting-start'); k('Timers', 'SOON STOP', '■', '#ff6b7d', '/control/starting-stop'); k('Timers', 'SOON +1', '+1', '#4dc3ff', '/control/starting-plus1');
  k('Timers', 'SOON -1', '-1', '#4dc3ff', '/control/starting-minus1'); k('Timers', 'SOON 5:00', '5:00', '#4dc3ff', '/control/starting-set?secs=300'); k('Timers', 'GO LIVE', 'GO', '#ffd400', '/control/starting-live');
  k('Timers', 'BRB START', '▶', '#c58bff', '/control/brb-timer-start'); k('Timers', 'BRB STOP', '■', '#c58bff', '/control/brb-timer-stop'); k('Timers', 'BRB +1', '+1', '#c58bff', '/control/brb-plus1');
  k('Timers', 'BRB -1', '-1', '#c58bff', '/control/brb-minus1'); k('Timers', 'BRB 5:00', '5:00', '#c58bff', '/control/brb-set?secs=300'); k('Timers', 'BRB 10:00', '10:00', '#c58bff', '/control/brb-set?secs=600');
  k('Timers', 'SOON 10:00', '10:00', '#4dc3ff', '/control/starting-set?secs=600'); k('Timers', 'SOON RESET', '↺', '#4dc3ff', '/control/starting-reset'); k('Timers', 'I\'M BACK', 'BACK', '#c58bff', '/control/brb-end');
  // Replay
  k('Replay', 'CLIP', '●', '#4dc3ff', '/control/replay'); k('Replay', 'VIEW LAST', '▶', '#4dc3ff', '/control/replay-again'); k('Replay', 'SLOW-MO', '½', '#f6d77a', '/control/replay-last-slow');
  k('Giveaway', 'GIVEAWAY OPEN/CLOSE', '!GW', '#ffd23f', '/control/sgw-toggle'); k('Giveaway', 'GIVEAWAY WINNER', 'WIN', '#ffd23f', '/control/sgw-pick'); k('Giveaway', 'GIVEAWAY SPIN', 'SPIN', '#ffd23f', '/control/spin-start');
  k('Giveaway', 'GW ON/OFF', 'GW', '#ffd23f', '/control/gmeter-toggle'); k('Giveaway', 'GW PAUSE', '❚❚', '#f5c400', '/control/gmeter-pause'); k('Giveaway', 'GW STOP', '■', '#ff6b7d', '/control/gmeter-stop');
  k('Giveaway', 'GW RESTART', '↺', '#4dc3ff', '/control/gmeter-restart'); k('Giveaway', 'GW +1', '+1', '#3dff9a', '/control/gmeter-add'); k('Giveaway', 'GW -1', '-1', '#ff6b7d', '/control/gmeter-minus');
  k('Giveaway', 'GW +5', '+5', '#3dff9a', '/control/gmeter-add?n=5'); k('Giveaway', 'GW +1 MIN', '+1m', '#ffd23f', '/control/gmeter-plus1'); k('Giveaway', 'GW -1 MIN', '-1m', '#ffd23f', '/control/gmeter-minus1');
  k('Giveaway', 'GW WINNER', '★', '#ffd23f', '/control/gmeter-pick'); k('Giveaway', 'GW +10 MIN', '+10', '#ffd23f', '/control/gmeter-addtime?mins=10'); k('Giveaway', 'GW +1 HOUR', '+1h', '#ffd23f', '/control/gmeter-addtime?hours=1');
  k('Replay', 'PAUSE', '❚❚', '#f5c400', '/control/replay-pause'); k('Replay', 'BACK 2S', '«', '#f5c400', '/control/replay-back'); k('Replay', 'FWD 2S', '»', '#f5c400', '/control/replay-fwd'); k('Replay', 'GET CLIPS', '⇩', '#4dc3ff', '/control/clip-pull');
  k('Replay', 'STOP', '■', '#ff6b7d', '/control/replay-stop'); k('Replay', 'CLIP ONLY', '+', '#4dc3ff', '/control/clip'); k('Replay', 'FREEZE', '❚❚', '#f5c400', '/control/replay-freeze');
  k('Replay', 'GOAL CLIP', 'GOAL', '#3dff9a', '/control/replay?label=GOAL'); k('Replay', 'SAVE CLIP', 'SAVE', '#4dc3ff', '/control/replay?label=SAVE'); k('Replay', 'HOWLER', 'LOL', '#ff6b7d', '/control/replay?label=HOWLER');
  // Games
  k('Games', 'PENS 1v1', '1v1', '#3dff9a', '/control/start?mode=shootout'); k('Games', 'TEAM PENS', '5v5', '#f5c400', '/control/teampens-open'); k('Games', 'BEAT BOSS', 'BB', '#ff3b3b', '/control/boss-start');
  k('Games', 'TRUCK RACE', 'RACE', '#ffd400', '/control/start?mode=race'); k('Games', 'QUEEN RAID', 'Q', '#c58bff', '/control/start?mode=arc'); k('Games', 'START NOW', 'GO', '#f5c400', '/control/start-now');
  k('Games', 'BATTLES ON/OFF', 'OFF', '#ff6b7d', '/control/battles-switch'); k('Games', 'CANCEL', '✕', '#ff6b7d', '/control/cancel'); k('Games', 'AUTO GAMES', 'A', '#3dff9a', '/control/toggle'); k('Games', 'SKIP AFK', '>>', '#f5c400', '/control/teampens-skip');
  k('Games', 'GAME +5 MIN', '+5', '#3dff9a', '/control/delay?min=5'); k('Games', 'QUEEN AFTER', 'Q+', '#c58bff', '/control/queen-aftergame'); k('Games', 'TEAM 3v3', '3v3', '#f5c400', '/control/teampens-3');
  // Boss kick (number-pad layout)
  for (const [lab, id] of [['TOP L', 'lt'], ['TOP', 'ct'], ['TOP R', 'rt'], ['LEFT', 'l'], ['CENTRE', 'c'], ['RIGHT', 'r'], ['LOW L', 'lb'], ['LOW', 'cb'], ['LOW R', 'rb']]) k('Boss kick', lab, id.toUpperCase(), '#ff3b3b', '/control/boss-' + id);
  // Fix it
  k('Fix it', 'RESET CAMERA', 'CAM', '#ff5aa0', '/control/cam-reset'); k('Fix it', 'SAVE CAM SPOT', 'SPOT', '#ff5aa0', '/control/cam-savespot');
  k('Fix it', 'FREEZE CARDS', '❄', '#ffb020', '/control/cards-freeze'); k('Fix it', 'APPLY HELD', '✓', '#3dff9a', '/control/cards-apply'); k('Fix it', 'THROW AWAY', '✕', '#ff6b7d', '/control/cards-discard');
  k('Fix it', 'UNDO 10 MIN', '10', '#ffb020', '/control/cards-undo10'); k('Fix it', 'RECONNECT', '⟳', '#a7b0ba', '/control/reconnect'); k('Fix it', 'STOP GAMES', '■', '#ff6b7d', '/control/stop-games');
  // Scenes with the stinger
  for (const sc of (screens.scenes || []).slice(0, 15)) k('Scenes', String(sc).toUpperCase().slice(0, 14), '>>', '#ffd400', '/control/stinger-to?scene=' + encodeURIComponent(sc));
  return P;
}
function buttons() {
  const A = actionList(), byId = Object.fromEntries(A.map((x) => [x.id, x]));
  const list = Array.isArray(cfg.buttons) ? cfg.buttons : BTN_DEFAULT.map(([action, label, icon, group], i) => ({ id: 'b' + i, action, label, icon, group, color: (byId[action] || {}).color || '#3dff9a' }));
  return list.filter((b) => byId[b.action]).map((b) => Object.assign({}, b, { u: byId[b.action].u }));
}
function redPlayers() { let L = []; try { L = squad.state().queue.map((x) => x.name); } catch (e) { /* ignore */ } try { L = L.concat(bsn.tickerConfig().squad.players); } catch (e) { /* ignore */ } return Array.from(new Set(L.filter((x) => x && !/^THE (NEW SIGNING|KIT MAN)$/.test(x)))); }
// v29 Fix it tab
function reconnectAll() {
  const did = [];
  try { if (twitch.configured()) { twitch.stop(); twitch.start(); did.push('Twitch'); } } catch (e) { /* ignore */ }
  try { if (kick.configured()) { kick.stop(); kick.start(); did.push('Kick'); } } catch (e) { /* ignore */ }
  try { if (youtube.configured()) { youtube.stop(); youtube.start(); did.push('YouTube'); } } catch (e) { /* ignore */ }
  try { obs.connect().catch(() => {}); did.push('OBS'); } catch (e) { /* ignore */ }
  feedAdd('Reconnecting: ' + did.join(', '), '#4dc3ff');
  return did.length ? 'Reconnecting ' + did.join(', ') + '…' : 'Nothing to reconnect';
}
function stopAllGames() {
  const was = battle.phase !== 'idle';
  try { battle.cancel(); } catch (e) { /* ignore */ }
  try { if (replay.playing) replay.stop(); } catch (e) { /* ignore */ }
  return was ? 'Game stopped' : 'No game was running';
}
function dockState() {
  const st = { bp: (() => { try { const b = bp.state(); return { on: b.on, sys: b.sys, dia: b.dia, level: b.level, color: b.color }; } catch (e) { return null; } })(), starting: ST.on ? { running: ST.running, left: stLeft(), ended: ST.ended, here: ST.arrivals.size, held: sceneHeld ? heldList.length : 0 } : null, live: isLive(), liveSince: liveSince || null, viewers: viewerCache.n, results: results.line(), queen: raidNight.state(), boss: battle.status(), red: redActive ? { player: redActive.player || '', kind: redActive.kind, ban: redActive.ban, players: redActive.player ? [] : redPlayers().slice(0, 40) } : false, chat: showOn('chat'), panic: !!cfg.panic, battle: battle.phase, next: nextInfo() };
  try { st.counters = counters.all().list.map((c) => ({ name: c.name, tonight: c.tonight })); } catch (e) { /* ignore */ }
  try { st.squad = squadDock(); } catch (e) { /* ignore */ }
  try { const R = replay.state(); st.replay = { err: R.lastCapture && !R.lastCapture.ok && Date.now() - R.lastCapture.at < 120000 ? R.lastCapture.error : null, wanted: replayWanted && Date.now() - replayWanted.at < 45000 && !R.playing ? replayWanted.n : 0, look: R.settings.look, on: R.settings.on, playing: R.playing, jobs: (R.jobs || []).filter((j) => /^(waiting|clipping|processing|downloading|saved)$/.test(j.status) || Date.now() - j.at < 120000).slice(0, 5), clipsReady: R.clipsReady, recent: R.clips.slice(0, 12).map((c) => ({ id: c.id, n: c.n, label: c.label, thumb: c.thumb, secs: c.secs, star: c.star, tonight: c.tonight, by: c.by, auto: c.auto, ok: c.ok })), pos: R.playing ? { cursor: R.playing.cursor || 0, duration: R.playing.duration || 0, frozen: !!R.playing.frozen } : null, style: replay.style(), secs: R.settings.secs, speed: R.settings.speed, labels: R.settings.labels, error: R.error, last: R.clips[0] || null }; } catch (e) { /* ignore */ }
  try { const c = challenges.data().list[0]; if (c) st.challenge = { id: c.id, name: c.name, left: c.left, total: c.total, unit: c.unit, paused: !!c.paused }; } catch (e) { /* ignore */ }
  // v29: the simple dock (Live / Replay / Games / Fix it)
  st.botMuted = !!cfg.botMuted; st.botFlood = !!(sayRate.warned && Date.now() - sayRate.warned < 120000); st.panic = !!cfg.panic;
  try { st.lobby = battle.lobby(); } catch (e) { st.lobby = null; }
  st.game = battle.phase !== 'idle' && battle.phase !== 'join' ? { mode: battle.mode, phase: battle.phase, boss: !!battle.bossMode } : null;
  try { st.safety = safety.state(); } catch (e) { /* ignore */ }
  st.health = { twitch: twitch.configured() ? !!twitch.connected : null, kick: kick.configured() ? !!kick.connected : null, youtube: youtube.configured() ? !!youtube.connected : null, obs: !!obs.ready, overlay: clients.size > 0, cards: !(st.safety && st.safety.frozen) };
  st.gamesOpts = { letMePlay: cfg.letMePlay !== false, joinReplies: cfg.joinReplies !== false, idle: TV.general.startIdleSecs != null ? TV.general.startIdleSecs : 10, battlesPaused: !!cfg.battlesPaused };
  st.theme = themeName();
  try { const P = spin.payload(); st.spin = { phase: P.phase, winner: P.winner, spinEndsAt: P.spinEndsAt, claimEndsAt: P.claimEndsAt, cmd: P.cmd, test: P.test, now: P.now }; } catch (e) { /* ignore */ }
  try { const X = sgw.state(); st.sgw = { open: X.open, count: X.count, cmd: X.settings.cmd, needMins: X.settings.needMins, on: X.settings.on, winners: X.winners.slice(0, 3), entries: X.entries.slice(0, 400).map((e) => ({ key: e.key, d: e.display, p: e.platform, m: e.mins, h: !!e.byHand })) }; } catch (e) { /* ignore */ }
  try { const G = gmeter.payload(); st.gmeter = { mode: G.mode, enabled: G.enabled, prize: G.words.prize, on: G.on, running: G.running, paused: G.paused, ended: G.ended, left: G.left, endsAt: G.endsAt, value: G.value, goal: G.goal, hit: G.hit, entries: G.entries, title: G.words.title, unit: G.words.unit, hasTimer: G.hasTimer, winner: G.winner }; } catch (e) { /* ignore */ }
  try { const B = screens.brbState(); st.brb = { on: B.on, running: B.running, left: B.left, look: B.look }; st.bigcam = screens.bigState().name; st.linksNext = screens.linksNext(); st.musicMuted = !!cfg.musicMuted; } catch (e) { /* ignore */ }
  try { st.nextBattleMs = battlesOff() || cfg.battlesEnabled === false || cfg.battlesPaused ? null : nextInMs(); } catch (e) { /* ignore */ }
  st.battlesOff = battlesOff();
  return st;
}

// ---------- Matchday Squad (!squad, subs only) ----------
const { Squad } = require('./lib/squad');
const squad = new Squad({ store, cfg: () => cfg, saveCfg, push: (a) => push(a), streamNo, say: (m) => sayAll(m),
  givePoints: (k, n) => { const v = store.data.viewers[k]; if (v && n > 0) { giveCardPoints(store.primary(v) || v, n); store.save(); } },
  onBench: (k, n) => { const v0 = store.data.viewers[k]; if (!v0) return; const v = store.primary(v0) || v0; v.benchedTotal = (v.benchedTotal || 0) + 1; if (n > 0) giveCardPoints(v, n); store.save(); },
  displayName: (k) => (store.data.viewers[k] || {}).display || k, boss: () => 'THE BOSS', banned: (name) => banFor(name) });
connectHooks.push(() => squad.state());
function squadDock() { const st = squad.state(); return { waiting: st.waiting, match: st.match, next: st.queue.slice(0, 4).map((x) => x.name) }; }

// ---------- red card rule: flash it on screen with one tap ----------
const RC_FILE = path.join(DATA, 'redcard-image');
function rcS() { const c = cfg.redCard || {}; return { rules: Array.isArray(c.rules) && c.rules.length ? c.rules : [{ id: 'r1', title: 'RED CARD RULE', text: 'NO UNNECESSARY RED CARDS' }], flashSecs: Math.max(2, Math.min(30, +c.flashSecs || 6)), stay: c.stay !== false, ticker: c.ticker !== false, image: !!c.image, yellowBan: Math.max(0, Math.min(10, c.yellowBan != null ? +c.yellowBan : 1)), redBan: Math.max(0, Math.min(10, c.redBan != null ? +c.redBan : 2)), bans: c.bans !== false }; }
// bans: 2 yellows = 1 match, straight red = 2 matches. The match it happens in doesn't count; each result logged after that takes one off.
function bans() { const d = store.data; if (!d.bans) d.bans = {}; return d.bans; }
const banKey = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function banFor(name) { const B = bans(), k = banKey(name); if (!k) return null; if (B[k]) return B[k]; let nice = ''; try { nice = banKey(require('./lib/bsn').niceName(name)); } catch (e) { /* ignore */ } return (nice && B[nice]) || Object.values(B).find((b) => b.alias && b.alias.includes(k)) || null; }
function bansAfterMatch() { const B = bans(); let ch = false; for (const [k, b] of Object.entries(B)) { ch = true; if (b.pending) { b.pending = false; continue; } b.left--; if (b.left <= 0) delete B[k]; } if (ch) { store.save(); try { squad.sync(); } catch (e) { /* ignore */ } } }
function banList() { return Object.values(bans()).map((b) => ({ name: b.name, left: b.left, kind: b.kind, pending: !!b.pending })); }
let redActive = null;
function redData(name) { const d = store.data; if (!d.redcards) d.redcards = {}; const k = String(name || '').toUpperCase(); if (!k) return null; const r = d.redcards[k] || (d.redcards[k] = { season: 0, stream: { no: 0, n: 0 } }); const no = streamNo(); if (no && r.stream.no !== no) r.stream = { no, n: 0 }; return r; }
function redState() { return Object.assign({ type: 'redcard' }, redActive ? { on: true } : { on: false }, redActive || {}, { flashSecs: rcS().flashSecs, stay: rcS().stay, image: rcS().image ? '/redcard-image?v=' + ((cfg.redCard || {}).imageV || 0) : null }); }
connectHooks.push(() => Object.assign(redState(), { replay: true }));
function redShow(o) {
  if (!showOn('redCard')) return { error: 'The red card is switched off on the On screen page' };
  const S2 = rcS(), rule = S2.rules.find((r) => r.id === o.rule) || S2.rules[0], player = String(o.player || '').toUpperCase().slice(0, 30);
  let count = null;
  const kind = o.kind === 'yellow2' ? 'yellow2' : o.kind === 'warn' ? 'warn' : 'red', ban = kind === 'warn' || !S2.bans ? 0 : kind === 'yellow2' ? S2.yellowBan : S2.redBan;
  if (player) count = redApply(player, kind, ban);
  try { if (kind !== 'warn') bp.auto(kind === 'yellow2' ? 'yellow2' : 'red', (kind === 'yellow2' ? 'Two yellows' : 'Red card') + (player ? ': ' + player : '')); } catch (e) { /* ignore */ }
  redActive = { rule: { title: rule.title, text: rule.text }, player, count, kind, ban, table: S2.bans ? { yellow: S2.yellowBan, red: S2.redBan } : null, at: Date.now() };
  push(redState());
  if (S2.ticker && player) addStory({ cat: 'Discipline', text: player + (kind === 'yellow2' ? ' SENT OFF FOR TWO YELLOWS' : ' SEES RED') + (ban ? ' - ' + ban + ' MATCH BAN' : '') + (count && count.tonight > 1 ? ' FOR THE ' + count.tonight + (count.tonight === 2 ? 'ND' : count.tonight === 3 ? 'RD' : 'TH') + ' TIME TONIGHT' : '') + ' - THE BOSS IS NOT HAPPY', keep: 'stream', freq: 'loop', tag: 'red-' + player });
  feedAdd('Red card rule' + (player ? ': ' + player : ''), '#ff3b3b');
  if (kind !== 'warn' && replay.S().autoRed) setTimeout(() => replayNow({ label: (kind === 'yellow2' ? 'SECOND YELLOW' : 'RED CARD') + (player ? ' · ' + player : '') }).catch(() => {}), (S2.flashSecs + 1) * 1000);
  return { ok: true };
}
// every card ever, for the all-time offenders list: { id, at, name, kind (red | yellow2), ban, no }
function redLog() { const d = store.data; if (!d.redLog) { d.redLog = []; for (const [n, x] of Object.entries(d.redcards || {})) for (let i = 0; i < (x.season || 0); i++) d.redLog.push({ id: 'old' + n + i, at: 0, name: n, kind: 'red', ban: 0, no: 0, old: true }); } return d.redLog; }
function offenders(period) {
  const now = new Date(), sn = streamNo();
  const from = period === 'season' ? new Date(now.getFullYear(), 0, 1).getTime() : period === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1).getTime() : 0;
  const M = {};
  for (const e of redLog()) {
    if (period === 'tonight' ? e.no !== sn || !sn : (from && (e.old || e.at < from))) continue;
    const k = banKey(e.name), r = M[k] || (M[k] = { name: e.name, red: 0, y2: 0, banned: 0, last: 0, nights: {}, ids: [] });
    if (e.kind === 'yellow2') r.y2++; else r.red++;
    r.banned += e.ban || 0; r.last = Math.max(r.last, e.at || 0); if (e.no) r.nights[e.no] = (r.nights[e.no] || 0) + 1; r.ids.push(e.id);
  }
  const B = bans();
  return Object.values(M).map((r) => { const w = Object.entries(r.nights).sort((a, b) => b[1] - a[1])[0]; const s2 = w ? (store.data.streams || {})[w[0]] : null; return { name: r.name, red: r.red, y2: r.y2, total: r.red + r.y2, banned: r.banned, worst: w ? w[1] : 0, worstAt: s2 ? s2.start : null, last: r.last, banLeft: (B[banKey(r.name)] || {}).left || 0 }; })
    .sort((a, b) => b.total - a.total || b.red - a.red || b.last - a.last);
}
function redUndo(id) {
  const L = redLog(), i = L.findIndex((x) => x.id === id); if (i < 0) return { error: 'Card not found' };
  const e = L[i]; L.splice(i, 1);
  const rd = (store.data.redcards || {})[String(e.name).toUpperCase()]; if (rd) { rd.season = Math.max(0, rd.season - 1); if (rd.stream) rd.stream.n = Math.max(0, rd.stream.n - 1); }
  if (e.ban) { const B = bans(), k = banKey(e.name); if (B[k]) { B[k].left -= e.ban; if (B[k].left <= 0) delete B[k]; } }
  store.save(); squad.sync(); return { ok: true };
}
function redApply(player, kind, ban) {
  redLog();   // (moves old counts over first)
  const r = redData(player); r.season++; r.stream.n++;
  const top0 = (offenders('all')[0] || {}).name;
  const rid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  redLog().push({ id: rid, at: Date.now(), name: player, kind: kind === 'yellow2' ? 'yellow2' : 'red', ban: ban || 0, no: streamNo() || 0 });
  undoAdd('red-' + rid, (kind === 'yellow2' ? 'Two yellows: ' : 'Red card: ') + player, () => { redUndo(rid); if (redActive && redActive.player === player) redClear(); });
  const top1 = offenders('all')[0];
  if (top1 && top1.name === player && top0 !== player && top1.total > 1 && rcS().ticker) addStory({ cat: 'Discipline', text: player + ' TAKES TOP SPOT IN THE HALL OF SHAME', keep: 'stream', freq: 'loop', tag: 'shame' });
  if (ban > 0) { const B = bans(), k = banKey(player), prev = B[k]; B[k] = { name: player, kind, left: (prev ? prev.left : 0) + ban, pending: true, at: Date.now() }; }
  store.save(); try { squad.sync(); } catch (e) { /* ignore */ }
  return { tonight: r.stream.n, season: r.season };
}
// the card went up from the dock / Stream Deck without a name: say who it was afterwards (no second flash)
function redAssign(name) {
  const player = String(name || '').toUpperCase().slice(0, 30);
  if (!redActive || !player) return { error: 'No red card on screen' };
  if (redActive.player) return { error: 'Already given to ' + redActive.player };
  redActive.player = player; redActive.count = redApply(player, redActive.kind, redActive.ban);
  push(Object.assign(redState(), { replay: true }));
  if (rcS().ticker) addStory({ cat: 'Discipline', text: player + (redActive.kind === 'yellow2' ? ' SENT OFF FOR TWO YELLOWS' : ' SEES RED') + (redActive.ban ? ' - ' + redActive.ban + ' MATCH BAN' : ''), keep: 'stream', freq: 'loop', tag: 'red-' + player });
  return { ok: true };
}
function showShame(period) { if (!showOn('redCard')) return { error: 'The red card is switched off on the On screen page' }; const rows = offenders(period).slice(0, 6); if (!rows.length) return { error: 'Nobody has a card yet' }; push({ type: 'shame', rows, period, secs: 14 }); return { ok: true }; }
function redClear() { redActive = null; push(redState()); return { ok: true }; }

// ---------- fun counters (GODFATHER's penalties) ----------
const { Counters } = require('./lib/counters');
const counters = new Counters({ store, cfg: () => cfg, saveCfg, push: (a) => push(a), streamNo });
connectHooks.push(() => counters.all());
function widgets() { const W = Object.assign({}, WIDGETS); counters.list().forEach((c, i) => { W['ctr-' + c.id] = { label: c.name + ' meter', w: 300, h: 150, x: 1580, y: 300 + i * 170 }; }); return W; }
function counterUndo(id) {
  const c = counters.get(id), r = counters.undo(id);
  if (r.ok) { const L = stories(), i = L.map((x) => x.cat === 'Discipline' && x.text.indexOf(c.name + ' ') === 0 && Date.now() - x.at < 600000).lastIndexOf(true); if (i >= 0) { L.splice(i, 1); store.save(); push({ type: 'bsnReload' }); } }
  return r;
}
function counterAdd(id, d) {
  const r = counters.add(id, d);
  const c = counters.get(id);
  if (r.ok && d > 0 && c.ticker !== false && showOn('counters')) addStory({ cat: 'Discipline', text: c.name + ' ' + (r.tonight === 1 ? 'GIVES AWAY A PENALTY' : 'GIVES AWAY PENALTY NUMBER ' + r.tonight + ' OF THE NIGHT') + (r.level && r.tonight > 1 ? ' - NOW RATED "' + r.level + '"' : ''), keep: 'stream', freq: 'loop', tag: 'ctr-' + id });
  if (r.ok && d > 0 && counters.list()[0] && counters.list()[0].id === c.id) try { bp.auto('godfather', c.name + ' +1'); } catch (e) { /* ignore */ }
  if (r.ok && d > 0) { feedAdd(c.name + ' +1 (' + r.tonight + ' tonight)', c.color); undoAdd('ctr-' + id, c.name + ' +1 (' + r.tonight + ' tonight)', () => counterUndo(id)); }
  return r;
}

// ---------- team results ----------
const { Results } = require('./lib/results');
const results = new Results({ store, cfg: () => cfg, saveCfg, push: (a) => push(a), streamNo, currentGame, say: (m) => sayAll(m) });
connectHooks.push(() => results.state());
const { ClubStats } = require('./lib/clubstats');
const clubStats = new ClubStats({ store, cfg: () => cfg, saveCfg, push: (a) => push(a), say: (m) => sayAll(m), sheet: () => squad.state().sheet,
  givePoint: (k, n) => { const v = store.data.viewers[k]; if (v && n > 0) { giveCardPoints(store.primary(v) || v, n); store.save(); } },
  story: (t) => addStory({ cat: 'Matchday', text: t, keep: 'stream', freq: 'loop', tag: 'motm' }),
  redCount: (n) => { const r = offenders('season').find((x) => banKey(x.name) === banKey(n)); return r ? r.total : 0; } });
{ const ra = results.add.bind(results); results.add = (...x) => { const r = ra(...x); try { if (r && r.ok) { bansAfterMatch(); const t = results.team(), d = results.data(t); if (d && d.last) clubStats.result(d.last.idx, t.type); if (d && d.last) bp.auto(['win', 'draw', 'loss'][d.last.idx] || 'draw', ['Win', 'Draw', 'Loss'][d.last.idx] || 'Result'); const L = results.labels ? results.labels(t) : null; undoAdd('result', 'Result: ' + (L && L[d.last.idx] ? L[d.last.idx] : ['win', 'draw', 'loss'][d.last.idx] || 'logged') + (d.last.us != null ? ' ' + d.last.us + '-' + d.last.them : ''), () => results.undo()); } } catch (e) { console.log('[club] ' + e.message); } return r; }; }

// ---------- Move plugin ----------
const MOVEX = require('./lib/move');
const move = new MOVEX.Move({ obs, cfg: () => cfg, saveCfg, log: (m) => console.log(m) });
function moveFrom(a) {
  if (a.type === 'levelup') { if (a.kind === 'giftbomb') move.fire('giftbomb'); if (a.kind === 'raid') move.fire('raid'); if (a.tierUp) move.fire('tierup'); }
  else if (a.type === 'challenge' && a.kind === 'complete') move.fire('challengeDone');
  else if (a.type === 'raidnight' && a.kind === 'briefing') move.fire('briefing');
  else if (a.type === 'raidnight' && a.kind === 'result') move.fire(a.result.win ? 'raidWin' : 'raidLoss');
  else if (a.type === 'fulltime') { if (a.idx === 0) { move.fire('win'); if (a.team.type !== 'custom') move.fire('goal'); } if (a.idx === 2) move.fire('loss'); }
  else if (a.type === 'checkin') move.fire('checkins');
  else if (a.type === 'camfx' && a.fx === 'goal' && a.phase === 'start') move.fire('goal');
  else if (a.type === 'hype') move.fire('hype');
}
{ const pub = bsn.publish.bind(bsn); bsn.publish = (ev) => { try { if (ev && ev.type === 'goal' && ev.my_team) move.fire('goal'); } catch (e) { /* ignore */ } return pub(ev); }; }

// ---------- live scores (from the Sports News score checks) ----------
function liveScores(all) {
  const L = (bsn.lastTodays || []).filter((m) => all || m.state === 'in');
  const my = String((bsn.S().myTeam) || '').toLowerCase();
  const mine = (m) => my && (String(m.home).toLowerCase().includes(my.replace(/^ac /, '')) || String(m.away).toLowerCase().includes(my.replace(/^ac /, '')));
  return L.map((m) => ({ id: m.id, comp: m.comp, home: m.home, away: m.away, hs: m.hs, as: m.as, state: m.state, min: m.state === 'in' ? (bsn.minuteOf(m.clock) ? bsn.minuteOf(m.clock) + "'" : m.clock || '') : m.state === 'post' ? 'FT' : new Date(m.date).toTimeString().slice(0, 5), mine: !!mine(m) }))
    .sort((a, b) => (b.mine - a.mine) || ((a.state === 'in' ? 0 : 1) - (b.state === 'in' ? 0 : 1)));
}
let lastScoresSig = '', lastPanelAt = 0;
setInterval(() => {
  if (cfg.panic) return;
  const list = showOn('scores') && isLive() ? liveScores(false).slice(0, 12) : [];
  const sig = JSON.stringify(list.map((m) => [m.id, m.hs, m.as, m.min]));
  if (sig !== lastScoresSig) { lastScoresSig = sig; push({ type: 'scores', list }); }
  if (showOn('scoresPanel') && list.length && Date.now() - lastPanelAt > 10 * 60000 && battle.phase === 'idle') { lastPanelAt = Date.now(); push({ type: 'scoresPanel', list: liveScores(true).slice(0, 8), secs: 20 }); }
}, 20000).unref();
connectHooks.push(() => ({ type: 'scores', list: showOn('scores') && isLive() ? liveScores(false).slice(0, 12) : [] }));

// ---------- your own ticker stories ----------
function stories() { const d = store.data; if (!d.stories) d.stories = []; return d.stories; }
function storyPins() {
  const sn = (store.data.meta && store.data.meta.streamNo) || 0, out = [];
  for (const st of stories()) {
    if (st.pending || st.off) continue;
    if (st.keep === 'stream' && st.no !== sn) continue;
    const item = [String(st.cat || 'BOSS NEWS').toUpperCase().replace(/:+\s*$/, ''), String(st.text).toUpperCase()];
    for (let i = 0; i < (st.freq === 'often' ? 3 : 1); i++) out.push(item);
  }
  return out;
}
{ const tc = bsn.tickerConfig.bind(bsn); bsn.tickerConfig = () => { const c = tc(); c.pinned = (c.pinned || []).concat(storyPins()); return c; }; }
function addStory(o) {
  const st = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), cat: String(o.cat || 'Dressing room').slice(0, 24), text: String(o.text || '').trim().slice(0, 140), freq: o.freq === 'often' ? 'often' : 'loop', keep: o.keep === 'forever' ? 'forever' : 'stream',
    no: (store.data.meta && store.data.meta.streamNo) || 0, at: Date.now(), by: o.by || null, pending: !!o.pending };
  if (!st.text) return null;
  if (o.tag) { st.tag = String(o.tag); const L = stories(); for (let i = L.length - 1; i >= 0; i--) if (L[i].tag === st.tag) L.splice(i, 1); }   // one live headline per thing (latest wins)
  stories().push(st); while (stories().length > 200) stories().shift();
  store.save(); push({ type: 'bsnReload' });
  if (o.breaking && showOn('breaking')) push({ type: 'breaking', label: st.cat.toUpperCase(), text: st.text.toUpperCase() });
  return st;
}
// ---------- ticker health check: sample headlines + anything that would show wrong ----------
function tickerCheck(fix) {
  const fixed = [];
  if (fix) {
    const c = cfg.bsn = cfg.bsn || {}, S0 = bsn.S();
    const nt = (L) => (L || []).map(([l, t]) => [normTokens(l), normTokens(t)]);
    const t2 = nt(S0.templates), p2 = nt(S0.pinned);
    if (JSON.stringify(t2) !== JSON.stringify(S0.templates)) { c.templates = t2; fixed.push('Story placeholders tidied ([p] style changed to {p})'); }
    if (JSON.stringify(p2) !== JSON.stringify(S0.pinned || [])) { c.pinned = p2; fixed.push('Pinned headline placeholders tidied'); }
    // app headlines: one per player / meter (the latest), never "often"
    const L = stories(), seen = new Set(); let gone = 0;
    for (let i = L.length - 1; i >= 0; i--) {
      const st = L[i]; if (st.by || st.pending) continue;
      if (st.cat === 'Discipline') { const who = st.tag || String(st.text).split(/ (GIVES|SEES) /)[0]; if (seen.has(who)) { L.splice(i, 1); gone++; continue; } seen.add(who); st.tag = st.tag || who; }
      if (st.freq === 'often') st.freq = 'loop';
      if (/[\[{<]/.test(st.text)) st.text = normTokens(st.text);
    }
    if (gone) fixed.push(gone + ' repeated GODFATHER / red card headlines removed (the latest one stays)');
    saveCfg(); store.save(); push({ type: 'bsnReload' });
  }
  const c = bsn.tickerConfig(), problems = [], samples = [];
  const players = c.squad.players || [];
  if (players.length < 3) problems.push({ what: 'Only ' + players.length + ' player names: add your Pro Clubs players in Sports News › Squad (one per line).' });
  const odd = players.filter((n) => /[\[\]{}<>]/.test(n)); if (odd.length) problems.push({ what: 'Player names with brackets: ' + odd.slice(0, 5).join(', ') });
  if (!(c.squad.clubs || []).filter((x) => x && x !== 'THE CLUB').length) problems.push({ what: 'No club names: add them in Sports News › Squad.' });
  const leftovers = new Set();
  for (const [l, t] of (c.templates || []).concat(c.pinned || [])) { const out = fillStory(l + ' ' + t, c); (out.match(LEFTOVER_RE) || []).forEach((m) => leftovers.add(m)); }
  if (leftovers.size) problems.push({ what: 'Unknown placeholders (they are hidden on the ticker): ' + Array.from(leftovers).slice(0, 8).join(' ') + '. Use {p} {q} {club} {owner} {rival} {manager} {captain} {suitor} {fee} {n}.' });
  const pins = storyPins(), uniq = new Set(pins.map((x) => x.join(' ')));
  const disc = stories().filter((st) => st.cat === 'Discipline' && !st.off && !(st.keep === 'stream' && st.no !== ((store.data.meta || {}).streamNo || 0)));
  if (disc.length > counters.list().length + 3) problems.push({ what: disc.length + ' GODFATHER / red card headlines are queued up: press Fix to keep only the latest one each.', fix: true });
  if (uniq.size < pins.length) problems.push({ what: 'Some app headlines are in the list more than once.', fix: true });
  if (JSON.stringify(bsn.S().templates).match(/[\[(<]\s*(p|q|club|player)\s*[\])>]/i)) problems.push({ what: 'Some stories use [p] style placeholders. They work now, press Fix to tidy them.', fix: true });
  const T = c.templates || [];
  for (let i = 0; i < 10 && T.length; i++) { const [l, t] = T[Math.floor(Math.random() * T.length)]; samples.push(fillStory(l, c) + ': ' + fillStory(t, c)); }
  return { ok: true, fixed, problems, samples, players: players.slice(0, 20), appHeadlines: Array.from(uniq).slice(0, 12), shareNote: 'App headlines (GODFATHER, red cards, your own) take at most 1 in 4 stories.' };
}

// a rough idea into 3 ticker-style headlines (simple rewrites, no AI)
function headlineIdeas(t) {
  t = String(t || '').trim().replace(/\s+/g, ' ').replace(/[.!]+$/, ''); if (!t) return [];
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return [cap.toUpperCase(), ('SOURCES: ' + cap).toUpperCase(), ('BOSS: "' + cap + '"').toUpperCase(), (cap + ' (MORE TO FOLLOW)').toUpperCase()].slice(0, 3);
}

// ---------- card points calculator ----------
function calcApply(v, o, now, instant) {
  const did = [], bits = Math.max(0, +o.bits || 0), kicks = Math.max(0, +o.kicks || 0), sc = Math.max(0, Math.round((+o.sc || 0) * 125)), gifts = Math.max(0, Math.round(+o.gifts || 0)), months = Math.max(0, Math.round(+o.months || 0));
  if (bits) { v.bits = (v.bits || 0) + bits; if (o.source === 'tangia') v.twBits = (v.twBits || 0) + bits; S.addXp(v, 'SUP', bits, R, instant, now); did.push('+' + bits + ' bits'); }
  if (kicks) { v.bits = (v.bits || 0) + kicks; S.addXp(v, 'SUP', kicks, R, instant, now); did.push('+' + kicks + ' Kicks'); }
  if (sc) { v.bits = (v.bits || 0) + sc; S.addXp(v, 'SUP', sc, R, instant, now); did.push('+£' + (+o.sc) + ' Super Chats'); }
  if (gifts) { v.giftsBase = Math.max(0, v.giftsBase || 0) + gifts; S.addXp(v, 'SUP', gifts * R.cards.giftSup, R, instant, now); did.push('+' + gifts + ' gifted subs'); }
  if (months) { v.subMonths = (v.subMonths || 0) + months; S.addXp(v, 'SUB', months, R, true, now); did.push('+' + months + ' sub months'); }
  if (o.manual && typeof o.manual === 'object') { v.manual = v.manual || {}; for (const [k, d] of Object.entries(o.manual)) if (S.STAT_KEYS.includes(k) && +d) { v.manual[k] = Math.max(-59, Math.min(59, (v.manual[k] || 0) + Math.round(+d))); did.push((+d > 0 ? '+' : '') + Math.round(+d) + ' ' + k); } }
  return did;
}

// ---------- Tangia bits: chat lines + the Twitch totals check ----------
function tangiaS() { const t = cfg.tangia || {}; return { chat: !!t.chat, sync: !!t.sync, bot: String(t.bot || '').toLowerCase(), sample: t.sample || '', alert: !!t.alert }; }
function tangiaRegex(sample) {
  const m = /^(.*?)@?([A-Za-z0-9_]{3,25})(.*?)(\d[\d,]*)(\s*bits?.*)$/i.exec(String(sample || '').trim());
  if (!m) return null;
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // name, then "what they did" (any words), then the number of bits
  return new RegExp('^' + esc(m[1]) + '@?([A-Za-z0-9_]{3,25})' + (m[3].trim() ? '(.*?)' : '(\\s*)') + '(\\d[\\d,]*)' + esc(m[5].replace(/[!.]+$/, '')), 'i');
}
function tangiaMatch(platform, e) {
  const T = tangiaS(); if (!T.chat || platform !== 'twitch' || !T.sample) return false;
  if (T.bot && String(e.login).toLowerCase() !== T.bot) return false;
  const re = tangiaRegex(T.sample), m = re && re.exec(String(e.text || '').trim()); if (!m) return false;
  const login = m[1], bits = +String(m[3]).replace(/,/g, ''), what = (m[2] || '').replace(/^\s*(used|redeemed|triggered|sent|played)\s+/i, '').replace(/\s+(for|with)\s*$/i, '').trim();
  if (!(bits > 0) || bits > 1000000) return false;
  twitch.emit('cheer', { login: login.toLowerCase(), display: login, bits, text: '', reason: 'Tangia' + (what ? ': ' + what : '') + ' (' + bits + ' bits)', tangia: true, silent: !T.alert });
  feedAdd(login + ': Tangia ' + bits + ' bits', '#c58bff');
  return true;
}
async function tangiaSync(force) {
  if (!force && !tangiaS().sync) return { skipped: true };
  const lb = await twitch.bitsLeaderboard();
  const S2 = store.data.bitsSync || (store.data.bitsSync = { last: {}, at: 0 }), first = !S2.at;
  let added = 0, people = 0;
  for (const x of lb) {
    const v0 = store.get('twitch', x.login); const v = v0 ? (store.primary(v0) || v0) : null;
    const prevTw = S2.last[x.login];
    if (v) { if (v.twBits == null) v.twBits = (v.cheers && v.cheers.bits) || 0; }
    if (!first && prevTw != null && v) {
      const grew = x.bits - prevTw, saw = (v.twBits || 0) - (v.twSeen || 0), extra = grew - saw;
      if (extra > 0) { twitch.emit('cheer', { login: x.login, display: x.display, bits: extra, text: '', reason: 'Other bits (Tangia etc.)', tangia: true, silent: true }); added += extra; people++; }
    }
    S2.last[x.login] = x.bits; if (v) v.twSeen = (v.twBits || 0) + (first ? 0 : 0);
  }
  S2.at = Date.now(); store.save();
  if (added) feedAdd('Twitch check: +' + added + ' other bits for ' + people, '#c58bff');
  return { ok: true, first, added, people };
}
setInterval(() => { if (tangiaS().sync && twitch.user) tangiaSync().catch((e) => console.log('[tangia] ' + e.message)); }, 30 * 60000).unref();

// ---------- sub goal bar ----------
function subGoalState() {
  const G = cfg.subGoal || {}, s = streamLog.cur && isLive() ? streamLog.cur() : null, n = s ? (s.t.subs || 0) + (s.t.gifted || 0) : 0;
  const rewards = (Array.isArray(G.rewards) ? G.rewards : []).filter((r) => r && r.at > 0).sort((a, b) => a.at - b.at);
  return { type: 'subgoal', n, target: Math.max(1, +G.target || 10), label: G.label || 'SUB GOAL', next: rewards.find((r) => r.at > n) || null, done: rewards.filter((r) => r.at <= n) };
}
connectHooks.push(subGoalState);

// ---------- hype meter: 3+ alerts in a minute ----------
let hypeHits = [], hypeUntil = 0;
function hypeFrom(a) {
  if (!showOn('hype') || cfg.panic) return;
  if (!((a.type === 'levelup' && /gift|giftbomb|bits|kicks|superchat|sub|resub|raid/.test(a.kind || '')) || a.type === 'pack')) return;
  const now = Date.now(); hypeHits = hypeHits.filter((t) => now - t < 60000); hypeHits.push(now);
  if (hypeHits.length >= 3 && now > hypeUntil + 5 * 60000) { hypeUntil = now + 30000; hypeHits = []; push({ type: 'hype', secs: 30 }); feedAdd('HYPE!', '#ffb020'); }
}

// ---------- Starting Soon screen (its own browser source: /starting) ----------
// countdown (4:15 by default), chat as mini player cards, an arrivals board, rotating card spotlight,
// your own pictures behind it, and alerts either held for kick-off or shown on this screen
const ST_DIR = path.join(DATA, 'starting');
function stS() {
  const c = cfg.starting || {};
  const pics = Array.isArray(c.pics) ? c.pics.filter((p) => p && /^[a-z0-9]{4,20}$/.test(p.id) && fs.existsSync(path.join(ST_DIR, p.id + '.' + p.ext))) : [];
  return { mins: Math.max(0, Math.min(59, c.mins != null ? +c.mins : 4)), secs: Math.max(0, Math.min(59, c.secs != null ? +c.secs : 15)),
    title: String(c.title != null ? c.title : 'STARTING SOON').slice(0, 30), tonight: String(c.tonight != null ? c.tonight : '').slice(0, 60),
    alerts: c.alerts === 'show' ? 'show' : 'hold', scene: String(c.scene != null ? c.scene : 'Live').slice(0, 80), autoSwitch: c.autoSwitch !== false, switchDelay: Math.max(0, Math.min(30, c.switchDelay != null ? +c.switchDelay : 4)),
    startScene: String(c.startScene != null ? c.startScene : 'Starting Soon').slice(0, 80), autoStart: c.autoStart !== false, chatCountdown: c.chatCountdown !== false,
    pics, pic: c.pic === 'rotate' || c.pic === 'bsn' || pics.some((p) => p.id === c.pic) ? c.pic : (pics.length ? pics[pics.length - 1].id : 'bsn'), rotateSecs: Math.max(5, Math.min(300, +c.rotateSecs || 20)), zoom: c.zoom !== false,
    chat: c.chat !== false, arrivals: c.arrivals !== false, spotlight: c.spotlight !== false, ticker: c.ticker !== false, socials: c.socials !== false, cardsStat: c.cardsStat !== false, musicRaw: c.music || {} };
}
const ST = { on: false, running: false, endsAt: null, left: null, arrivals: new Map(), spot: [], said: {}, kickT: null, ended: false, srcActive: false, srcAt: 0 };
// v38: which OBS scenes have the Starting Soon screen in them (found by its address, so the scene can be called anything)
const ST_URL = /\/starting(\b|\?|#|$)/;
let stScenes = { names: [], at: 0, busy: false };
async function stFindScenes(force) {
  if (!obs.ready || stScenes.busy || (!force && Date.now() - stScenes.at < 30000)) return stScenes.names;
  stScenes.busy = true;
  try { stScenes.names = await obs.scenesWithUrl(ST_URL); stScenes.at = Date.now(); } catch (e) { /* OBS busy */ } finally { stScenes.busy = false; }
  return stScenes.names;
}
function isStartScene(x) {
  if (!x) return false; const S = stS(), l = String(x).trim().toLowerCase();
  return (!!S.startScene && l === S.startScene.trim().toLowerCase()) || stScenes.names.some((n) => n.toLowerCase() === l);
}
// you switched to the Starting Soon scene (or its screen went on air): start, or start again after an earlier kick-off
function stEnter(why) {
  if (ST.running) return false;
  if (ST.ended || !ST.on) { clearTimeout(ST.kickT); ST.ended = false; ST.left = null; ST.said = {}; ST.on = false; }
  stStart(); feedAdd('Starting Soon: countdown started (' + why + ')', '#4dc3ff'); return true;
}
const stDur = () => { const S = stS(); return (S.mins * 60 + S.secs) * 1000; };
function stLeft() { return ST.running ? Math.max(0, ST.endsAt - Date.now()) : ST.left != null ? ST.left : stDur(); }
function stSpotlight() {
  const out = [];
  const add = (label, cat, period, unit) => { try { const r = lbRows(cat, period, 1).rows[0]; if (r && r.card) out.push({ label, card: r.card, value: r.value, unit }); } catch (e) { /* ignore */ } };
  add('TOP CARD IN THE CLUB', 'cards', 'all', 'OVR'); add('TOP SUPPORTER THIS WEEK', 'support', 'week', 'pts'); add('GIFT SUBS THIS WEEK', 'gifts', 'week', 'gifted');
  add('LONGEST STREAK', 'streaks', 'all', 'streams in a row'); add('BATTLE KING THIS WEEK', 'battles', 'week', 'pts'); add('MOST CHECK-INS THIS MONTH', 'checkins', 'month', 'streams');
  // best card that has turned up so far
  const here = Array.from(ST.arrivals.values()).sort((a, b) => (b.ovr || 0) - (a.ovr || 0))[0];
  if (here) { const v = store.data.viewers[here.key]; if (v) out.unshift({ label: 'BEST CARD IN THE BUILDING', card: card(v), value: null, unit: '' }); }
  const seen = new Set(); return out.filter((x) => { const k = x.label + x.card.display; if (seen.has(k)) return false; seen.add(k); return true; });
}
// v32: which game's words the Starting Soon screen uses (follows the game unless you pick one)
function stLook() {
  const w = cfg.startingWords || {};
  if (w.look && w.look !== 'auto' && SCR.START_WORDS[w.look]) return w.look;
  return SCR.lookOf(currentGame(), themeName());
}
function stWords() { return SCR.startWords(stLook(), (cfg.startingWords || {}).custom); }
function stState() {
  const S = stS(), held = sceneHeld ? heldList : [];
  const kinds = {}; for (const h of held) { const k = h.kind || h.type; kinds[k] = (kinds[k] || 0) + 1; }
  return { type: 'starting', now: Date.now(), on: ST.on, running: ST.running, endsAt: ST.running ? ST.endsAt : null, left: stLeft(), dur: stDur(), ended: ST.ended,
    S: Object.assign({}, S, { pics: S.pics.map((p) => '/starting-pic/' + p.id + '.' + p.ext + '?v=' + (p.v || 1)) , picIds: S.pics.map((p) => p.id) }),
    socials: screenSettings().socials, game: currentGame(), result: (() => { try { return results.line(); } catch (e) { return ''; } })(),
    cards: store.all().filter((v) => !v.test && hasCard(v)).length, here: ST.arrivals.size, arrivals: Array.from(ST.arrivals.values()).slice(-12).reverse(),
    spot: ST.spot, held: S.alerts === 'hold' ? held.length : 0, heldKinds: kinds, theme: themeName(), look: stLook(), words: stWords(), music: (() => { try { return musicCfg(S.musicRaw, media); } catch (e) { return { on: false, tracks: [] }; } })() };
}
function stPush() { push(stState()); }
function stStart() {
  if (!ST.running) { const left = ST.left != null && ST.left > 0 ? ST.left : stDur(); ST.endsAt = Date.now() + left; ST.running = true; }
  if (!ST.on) { ST.on = true; ST.arrivals.clear(); ST.said = {}; ST.ended = false; }
  ST.spot = stSpotlight(); stPush(); stSay('start'); return true;
}
function stPause() { if (!ST.running) return stStart(); ST.left = Math.max(0, ST.endsAt - Date.now()); ST.running = false; ST.endsAt = null; stPush(); return false; }
// v29: plain START / STOP buttons (STOP freezes the clock on screen, START carries on), and set the clock to a time
function stStop() { if (!ST.running) { if (!ST.on) { ST.on = true; ST.left = stLeft(); } stPush(); return false; } ST.left = Math.max(0, ST.endsAt - Date.now()); ST.running = false; ST.endsAt = null; stPush(); return true; }
function stSet(secs) { secs = Math.max(0, Math.min(3600, Math.round(+secs || 0))); ST.ended = false; if (ST.running) ST.endsAt = Date.now() + secs * 1000; else ST.left = secs * 1000; if (!ST.on) ST.on = true; stPush(); }
function stReset() { ST.running = false; ST.endsAt = null; ST.left = null; ST.ended = false; ST.said = {}; clearTimeout(ST.kickT); stPush(); }
function stAdd(secs) { if (ST.running) ST.endsAt = Math.max(Date.now() + 1000, ST.endsAt + secs * 1000); else ST.left = Math.max(0, stLeft() + secs * 1000); ST.ended = false; stPush(); }
// kick-off: the screen shows KICK-OFF, then (if set) OBS switches to your Live scene
function stLive(now) {
  clearTimeout(ST.kickT);
  ST.running = false; ST.endsAt = null; ST.left = 0; ST.ended = true;
  push({ type: 'starting', action: 'kickoff' }); stSay('kickoff');
  const S = stS();
  const off = () => { ST.on = false; ST.left = null; stPush(); };
  if (S.autoSwitch && S.scene && obs.ready) ST.kickT = setTimeout(async () => { try { if (!obs.onAirScene || isStartScene(obs.onAirScene) || ST.srcActive || obs.onAirScene === S.scene) await obs.req('SetCurrentProgramScene', { sceneName: S.scene }); } catch (e) { feedAdd('Starting soon: could not switch to "' + S.scene + '" (' + e.message + ')', '#ff6b7d'); } off(); }, (now ? 1.5 : S.switchDelay) * 1000);
  else ST.kickT = setTimeout(off, 8000);
}
function stOff() { clearTimeout(ST.kickT); ST.on = false; ST.running = false; ST.endsAt = null; ST.left = null; ST.ended = false; stPush(); }
function stSay(k) {
  if (!stS().chatCountdown || ST.said[k]) return; ST.said[k] = true;
  const m = { start: 'Stream starts in ' + Math.floor(stLeft() / 60000) + ':' + String(Math.round(stLeft() / 1000) % 60).padStart(2, '0') + '! Say hi to check in: your card goes on the arrivals board.', min: 'One minute to kick-off!', kickoff: 'KICK-OFF! We are live!' }[k];
  if (m) sayAll(m);
}
setInterval(() => {
  if (ST.running) {
    const left = ST.endsAt - Date.now();
    if (left <= 60000 && left > 50000) stSay('min');
    if (left <= 0) stLive(false);
  }
}, 500).unref();
setInterval(() => { if (ST.on) { ST.spot = stSpotlight(); stPush(); } }, 60000).unref();
setInterval(() => { if (ST.on && sceneHeld) stPush(); }, 6000).unref();   // the 'waiting for kick-off' count
// open the Starting Soon scene in OBS = the countdown starts by itself (v38: straight away, whatever the scene is called)
let stLastScene = '';
async function stSceneCheck() {
  const S = stS(), sc = obs.onAirScene || '';
  if (sc === stLastScene) return;
  const prev = stLastScene; stLastScene = sc;
  if (sc && !isStartScene(sc)) await stFindScenes(false);   // a scene we haven't looked inside yet
  if (S.autoStart && isStartScene(sc)) stEnter('you switched OBS to ' + sc);
  // you left the Starting Soon scene yourself (went live early): the countdown ends quietly and alerts play
  else if (ST.on && !ST.ended && isStartScene(prev) && !isStartScene(sc)) { clearTimeout(ST.kickT); ST.on = false; ST.running = false; ST.endsAt = null; ST.left = null; stPush(); feedAdd('Starting Soon ended (you switched to ' + sc + ')', '#4dc3ff'); }
}
obs.onProgram = () => { stSceneCheck().catch(() => {}); };
setInterval(async () => {
  try { if (obs.ready) { const c = await obs.req('GetCurrentProgramScene'); const sc = c.sceneName || c.currentProgramSceneName; if (sc) obs.program(sc); } } catch (e) { /* OBS busy */ }
  stSceneCheck().catch(() => {});
}, 3000).unref();
setInterval(() => { stFindScenes(false).catch(() => {}); }, 30000).unref();
// the Starting Soon screen itself says when OBS puts it on air (works even without the OBS connection)
function stSource(active) {
  ST.srcActive = !!active; ST.srcAt = Date.now();
  if (active) { if (stS().autoStart) stEnter('the Starting Soon screen went on air'); return; }
  setTimeout(() => {
    if (ST.srcActive || !ST.on || ST.ended) return;
    if (obs.ready && isStartScene(obs.onAirScene)) return;
    clearTimeout(ST.kickT); ST.on = false; ST.running = false; ST.endsAt = null; ST.left = null; stPush(); feedAdd('Starting Soon ended (its screen went off air)', '#4dc3ff');
  }, 2500);
}
// chat on the Starting Soon screen (and the arrivals board)
function startingChat(platform, e, v) {
  if (!ST.on && !screens.BRB.on && isLive()) return;
  const text = String(e.text || '').trim(); if (!text) return;
  const c = v && hasCard(v) ? card(store.primary(v) || v) : null, b = e.badges || [];
  if (ST.on && v && !v.isBroadcaster && !ST.arrivals.has(v.key)) {
    const a = { key: v.key, display: e.display || e.login, platform, ovr: c ? c.ovr : null, tier: c ? c.tier : null, avatar: v.avatar || null, at: Date.now(), first: !!(v.messages <= 1) };
    ST.arrivals.set(v.key, a);
    push({ type: 'sarrive', a, here: ST.arrivals.size });
  }
  if (text.startsWith('!')) return;
  push({ type: 'schat', id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), platform, display: e.display || e.login, text: text.slice(0, 200),
    ovr: c && !(v && v.isBroadcaster) ? c.ovr : null, tier: c ? c.tier : null, boss: !!(v && v.isBroadcaster), mod: b.includes('moderator'), sub: b.includes('subscriber') || b.includes('founder'), first: !!(v && (v.messages || 0) <= 1) });
}

// ---------- SYSTEM CHECK: tests every feature for real (Setup > System check) ----------
// Runs quietly: nothing goes to chat and nothing shows on stream (unless you ask for a test card on stream).
var QUIET = { on: false, pushes: [], says: [] };
let selfTestRunning = false, selfTestLast = null;
async function systemCheck(o) {
  o = o || {};
  if (selfTestRunning) return { error: 'A check is already running' };
  selfTestRunning = true;
  const t0 = Date.now(), sections = [];
  const sec = (name) => { const s = { name, items: [] }; sections.push(s); return (lv, n, d) => s.items.push({ lv, name: n, detail: d || '' }); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms) => { const end = Date.now() + ms; while (Date.now() < end) { const r = fn(); if (r) return r; await wait(120); } return null; };
  const TEST = 'BBRCheck' + Date.now().toString(36).slice(-4);
  try {
    // ===== 1. CARDS =====
    const C = sec('Cards');
    let bad = 0, n = 0, first = null;
    for (const v of store.all()) { n++; try { const c = card(v); if (!c || !(c.ovr >= 1) || !c.tier || !c.stats || Object.keys(c.stats).length < 7) { bad++; first = first || v.display; } } catch (e) { bad++; first = first || v.display + ' (' + e.message + ')'; } }
    C(bad ? 'bad' : 'ok', 'Every card builds', bad ? bad + ' of ' + n + ' cards are broken, e.g. ' + first : n + ' viewers, ' + store.all().filter((v) => hasCard(v)).length + ' with a card');
    QUIET.on = true; QUIET.pushes = []; QUIET.says = [];
    if (!store.get('twitch', TEST)) store.upsert('twitch', TEST, TEST).v.test = true;
    const tv = store.get('twitch', TEST); if (tv) tv.test = true;
    const fire = async (type, expect, label) => {
      const from = QUIET.pushes.length;
      try { const fn = testEvent('twitch', type, TEST); if (fn) await fn(); } catch (e) { return C('bad', label, 'crashed: ' + e.message); }
      const got = await until(() => QUIET.pushes.slice(from).find((a) => expect.test(a.type)), 4000);
      C(got ? 'ok' : 'bad', label, got ? 'the card alert was sent to the overlay (' + got.type + (got.kind ? ' · ' + got.kind : '') + ')' : 'no card alert was sent');
    };
    await fire('follow', /^(pack|levelup|checkin)$/, 'Follow → card');
    await fire('sub', /^(levelup|pack)$/, 'Sub → card upgrade');
    await fire('gift5', /^(levelup|pack)$/, 'Gift subs → card upgrade');
    await fire('cheer1000', /^(levelup|pack)$/, 'Bits → card upgrade');
    {
      const from = QUIET.pushes.length; cooldown.delete(store.resolveKey('twitch', TEST)); lastCardShown = 0;
      try { await onChat('twitch', { login: TEST, display: TEST, text: '!card', badges: [] }, true); } catch (e) { C('bad', '!card on stream', 'crashed: ' + e.message); }
      const got = await until(() => QUIET.pushes.slice(from).find((a) => a.type === 'show'), 3000);
      C(got ? 'ok' : 'bad', '!card → card on stream', got ? 'sent to the overlay' : 'nothing was sent (on-screen card switched off, or a cooldown)');
    }
    // the overlay itself
    const ov = overlayState && Date.now() - overlayState.at < 15000 ? overlayState : null;
    if (!ov) C('bad', 'Overlay in OBS', clients.size ? 'something is connected but the overlay is not reporting: refresh the BBR overlay Browser Source in OBS (right click > Refresh)' : 'not open: add http://localhost:' + PORT + '/overlay as a Browser Source (1920 × 1080)');
    else {
      const why = [];
      if (ov.sceneHold) why.push('cards are being HELD: the overlay isn\'t in the scene on air' + (ST.on ? ' (Starting Soon is on, set to hold alerts)' : '') + '. They play when it is.');
      if (ov.panic) why.push('PANIC is on (everything hidden): switch it off on the Live desk');
      if (ov.battleBusy) why.push('a battle screen is up (cards wait for it)');
      if (ov.rpOn) why.push('a replay is on (cards wait for it)');
      if (ov.otherBusy) why.push('Tangia / Streamlabs is playing (cards wait for it)');
      if (ov.busy && ov.queue > 3) why.push('one card is showing with ' + ov.queue + ' waiting');
      C(why.length ? 'warn' : 'ok', 'Overlay card queue', why.length ? why.join(' · ') : 'ready: ' + (ov.queue || 0) + ' waiting');
      if (ov.err) C('warn', 'Overlay last problem', ov.err + ' (it fixed itself)');
      {
        const S = p3S(), g = ov.g3, miss = p3Files();
        if (!S.on) C('ok', '3D stadium', 'switched off: the penalty games use the classic scene');
        else if (miss.length) C('bad', '3D stadium', 'files missing from public/3d: ' + miss.join(', ') + ' (re-copy the app folder)');
        else if (!g) C('warn', '3D stadium', 'the overlay is an older version: refresh the BBR overlay Browser Source');
        else if (g.error) C('bad', '3D stadium', g.error + ' · the penalty games fall back to the classic scene');
        else if (!g.ready) C('warn', '3D stadium', 'still loading in the overlay (takes a few seconds after OBS starts)');
        else if (!g.use) C('warn', '3D stadium', 'ready, but Light graphics is on so the classic scene is used (change it on the Battles tab)');
        else C('ok', '3D stadium', 'ready in the overlay' + (g.stats && g.stats.fps ? ' · last game drew at ' + g.stats.fps + ' fps' : '') + (S.replays ? ' · replays on' : ''));
      }
      if (o.screen) {
        const was = ov.shown || 0;
        QUIET.on = false;
        const v = store.all().filter((x) => hasCard(x) && !x.test).sort((a, b) => card(b).ovr - card(a).ovr)[0] || tv;
        push({ type: 'show', card: card(v), note: 'SYSTEM CHECK' });
        QUIET.on = true;
        const ok = await until(() => overlayState && (overlayState.shown || 0) > was, 20000);
        C(ok ? 'ok' : 'bad', 'Test card on stream', ok ? 'the overlay showed ' + v.display + '\'s card' : 'the overlay got it but did not show it within 20 s' + (ov.sceneHold ? ' (held: overlay not on air)' : ''));
      }
    }
    C(showOn('cardFlip') || showOn('cardProfile') || true ? 'ok' : 'warn', 'On-screen switches', 'chat ' + (showOn('chat') ? 'on' : 'off') + ' · counters ' + (showOn('counters') ? 'on' : 'off') + ' · blood pressure ' + (showOn('bp') ? 'on' : 'off'));

    // ===== 2. CHAT COMMANDS =====
    const K = sec('Chat commands');
    const must = [['!card', 'card reply'], ['!top', 'top cards'], ['!top gifts', 'top gifters'], ['!top10', 'top 10'], ['!rules', 'commands'], ['!rules card', 'how cards work'], ['!rules battles', 'how battles work'], ['!here', 'check-in'], ['!shame', 'hall of shame'], ['!bans', 'red card bans'], ['!challenges', 'challenges'], ['!results', 'results'], ['!bp', 'blood pressure']];
    const ctr = counters.list()[0]; if (ctr && ctr.cmd) must.push([ctr.cmd, ctr.name + ' meter']);
    if (GA_ON()) must.push(['!tickets', 'tickets']);
    const maybe = ['!meltdown', '!stats', '!squad', '!scores', '!lastgoal', '!predict 2-1', '!queen', '!warchest', '!lb', '!motm', '!join', '!link', '!calm'].filter((c) => !(battlesOff() && /^!(join|queen)$/.test(c)));
    const run = async (cmd) => {
      for (const k of Array.from(cooldown.keys())) if (/^!/.test(String(k)) || String(k).includes(cmd.split(' ')[0]) || String(k).includes(store.resolveKey('twitch', TEST))) cooldown.delete(k);
      for (const k of Object.keys(lastSaid)) delete lastSaid[k];
      const from = QUIET.says.length;
      try { await onChat('twitch', { login: TEST, display: TEST, text: cmd, badges: [] }, true); } catch (e) { return { err: e.message }; }
      try { flushReplies('twitch'); } catch (e) { /* none queued */ }
      const got = await until(() => QUIET.says.slice(from).find((x) => !/^(THE QUEEN IS AWAKE|RAID NIGHT|QUEEN RAID|BATTLE|PENALTY SHOOTOUT|NEXT BATTLE)/i.test(x.msg)), 1500);
      return { reply: got ? got.msg : null };
    };
    for (const [cmd, what] of must) { const r = await run(cmd); K(r.err ? 'bad' : r.reply ? 'ok' : 'bad', cmd, r.err ? 'crashed: ' + r.err : r.reply ? r.reply.slice(0, 110) : 'no reply (' + what + ')'); }
    for (const cmd of maybe) { const r = await run(cmd); K(r.err ? 'bad' : r.reply ? 'ok' : 'info', cmd, r.err ? 'crashed: ' + r.err : r.reply ? r.reply.slice(0, 110) : 'quiet right now (only answers when there\'s something to say)'); }
    const anyChat = twitch.connected || kick.connected || youtube.connected;
    K(anyChat ? 'ok' : 'bad', 'Bot can talk in chat', anyChat ? ['twitch', 'kick', 'youtube'].filter((p) => ({ twitch, kick, youtube })[p].connected).join(', ') + ' connected' : 'no chat connected: commands can\'t answer');

    // ===== 3. BATTLES (played through off screen, at high speed) =====
    const B = sec('Battles');
    if (battle.phase !== 'idle') B('info', 'Battles', 'a battle is on, so the battle test was skipped');
    else {
      const BT = require('./lib/battle');
      const saveT = Object.assign({}, BT.MODES.shootout.timing);
      BT.MODES.shootout.timing = { intro: 5, aim: 0.3, kick: 5, outro: 5 };
      const sim = (mk) => new Promise((resolve) => {
        const ev = [];
        let b = null;
        b = new BT.Battle({ push: (a) => { ev.push(a); if (a.phase === 'aim' && !a.boss) setTimeout(() => { const A = b.so && b.so.aim; if (A && !A.pick) { A.pick = ['L', 'C', 'R'][Math.floor(Math.random() * 3)]; clearTimeout(b.timer); b.timer = setTimeout(() => b.resolveKick(), 5); } }, 0); }, say: () => {}, sayTo: () => {}, card: (k) => ({ display: k, ovr: 50 + (k.length * 7) % 40, tier: 'gold', stats: { LOY: 50 } }), ensure: () => {},
          reward: () => resolve(ev), opts: () => ({ boostSecs: 0, joinSecs: 1, maxShields: 5, maxBoost: 10, points: { shootout: [3, 1], race: [3, 2, 1] }, intervalMin: 30 }), teamCfg: () => ({ size: mk.size, make: mk.make, joinSecs: 20 }),
          bossFighter: () => ({ key: 'boss', platform: 'twitch', login: 'boss', display: 'THE BOSS' }) });
        setTimeout(() => resolve(ev), 20000);
        mk.go(b, ev);
      });
      const fast = (b) => { const orig = setTimeout; b._t = null; };
      const tests = [
        ['Penalty shootout 1 v 1', { go: (b) => { b.open('shootout'); clearTimeout(b.timer); ['a1', 'b22'].forEach((x) => b.join('twitch', x, x)); b.pick(); clearTimeout(b.timer); b.run(); } }],
        ['Team shootout 3 v 3', { size: 3, make: 'redblue', go: (b) => { b.openTeams(null, { size: 3 }); clearTimeout(b.timer); const W = b.tm.defs.map((d) => d.words[0]); [['t1', W[0]], ['t22', W[1]], ['t333', ''], ['t4444', W[0]]].forEach(([x, s]) => b.join('twitch', x, x, s, { test: true })); b.teamPick(); clearTimeout(b.timer); b.teamRun(); } }],
        ['Team shootout 5 v 5 (platform war)', { size: 5, make: 'platform', go: (b) => { b.openTeams(null, { size: 5, make: 'platform' }); clearTimeout(b.timer); [['twitch', 'p1'], ['kick', 'p22'], ['youtube', 'p333']].forEach(([pl, x]) => b.join(pl, x, x, '', { test: true })); b.teamPick(); clearTimeout(b.timer); b.teamRun(); } }]
      ];
      for (const [name, mk] of tests) {
        const t1 = Date.now();
        let ev = [];
        try { ev = await sim(mk); } catch (e) { B('bad', name, 'crashed: ' + e.message); continue; }
        const res = ev.filter((a) => a.phase === 'result').pop(), kicks = ev.filter((a) => a.phase === 'kick').length;
        B(res ? 'ok' : 'bad', name, res ? 'played to the end: ' + kicks + ' kicks, ' + (res.teams ? res.teams.sides.map((s) => s.name + ' ' + s.score).join(' - ') : res.score.join(' - ')) + ' (' + Math.round((Date.now() - t1) / 100) / 10 + ' s)' : 'did not finish (' + kicks + ' kicks)');
      }
      BT.MODES.shootout.timing = saveT;
      try { const r = BT.simulateRace([{ display: 'a', ovr: 60, stats: {} }, { display: 'b', ovr: 50, stats: {} }, { display: 'c', ovr: 70, stats: {} }], [0, 2, 0], BT.raceSetup({ game: 'ATS' })); B(r && r.order ? 'ok' : 'bad', 'Truck race', r && r.order ? 'finished, winner #' + (r.order[0] + 1) : 'no result'); } catch (e) { B('bad', 'Truck race', 'crashed: ' + e.message); }
      try { const ARC = require('./lib/arc'); const q = new ARC.QueenRaid([{ display: 'a', ovr: 60, stats: {} }, { display: 'b', ovr: 55, stats: {} }], [0, 0]); B(q ? 'ok' : 'bad', 'Queen raid', 'starts fine'); } catch (e) { B('bad', 'Queen raid', 'crashed: ' + e.message); }
      B('ok', 'Battle timer', cfg.battlesEnabled === false ? 'battles switched off' : cfg.battlesPaused ? 'paused' : 'next in ' + Math.round(nextInMs() / 60000) + ' min of stream time');
    }

    // ===== 4. REPLAY =====
    const RP = sec('Replay');
    if (!replay.S().on) RP('info', 'Replays', 'switched off (Live > Replay)');
    else if (!obs.ready) RP('bad', 'OBS', 'not connected: replays need OBS');
    else {
      try {
        const d = await replayObsCheck();
        for (const c of d.checks || []) RP(c.level, /Twitch/.test(c.what) ? 'Twitch clips' : 'Clip folder', c.what + (c.fix ? ' FIX: ' + c.fix : ''));
        if (d.last) RP(d.last.ok ? 'ok' : 'bad', 'Last clip', d.last.ok ? 'downloaded fine' : d.last.error);
      } catch (e) { RP('bad', 'Replay check', e.message); }
    }

    // ===== 5. EVERYTHING ELSE =====
    const X = sec('Other features');
    // v38: the Starting Soon scene (found by the screen inside it, so the scene can be called anything)
    try {
      if (!obs.ready) X('warn', 'Starting Soon scene', 'OBS isn\'t connected, so the app can\'t see which scene has the Starting Soon screen (it still starts when OBS shows the screen)');
      else { const L = await stFindScenes(true); const S0 = stS(); X(L.length ? 'ok' : 'warn', 'Starting Soon scene', L.length ? 'the Starting Soon screen is in ' + L.join(', ') + ': switching to it starts the countdown' : 'no OBS scene has http://localhost:' + PORT + '/starting in it yet' + (S0.startScene ? ' (and none is called ' + S0.startScene + ')' : '')); }
    } catch (e) { X('warn', 'Starting Soon scene', 'couldn\'t look: ' + e.message); }
    // v38: the giveaway bot check works on a copy (nothing real changes)
    try {
      const BCX = require('./lib/botcheck'); const c0 = { botcheck: { mode: 'review' } };
      const t = new BCX.BotCheck({ cfg: () => c0, saveCfg() {}, file: path.join(os.tmpdir(), 'bbr-bc-check.json'), viewer: () => ({ streams: 0, messages: 0 }), watchMins: () => 0, streamNo: () => 1 });
      t.d.acc.xk7qpz93 = { created: Date.now() - 2 * 86400000, avatar: false, got: Date.now() };
      const r = t.score({ key: 'twitch:xk7qpz93', login: 'xk7qpz93', display: 'xk7qpz93', platform: 'twitch', at: Date.now() }, [], Date.now() - 1000);
      X(r.level === 'hold' ? 'ok' : 'bad', 'Giveaway bot check', r.level === 'hold' ? 'a test bot scores ' + r.score + ' (' + r.reasons.length + ' red flags): it works' : 'the test bot only scored ' + r.score);
    } catch (e) { X('bad', 'Giveaway bot check', 'crashed: ' + e.message); }
    // the meter's bets, award and credits, worked through on a private copy (your real meter isn't touched)
    try {
      const BPX = require('./lib/bp'); const mem = { data: {}, save() {} }, c0 = { bp: Object.assign({}, cfg.bp || {}, { on: true, bets: true, calmAward: true }) };
      const t = new BPX.BP({ cfg: () => c0, saveCfg() {}, store: mem, push() {}, say() {}, streamNo: () => 999 });
      t.add(5, 'x'); t.bet('a', 'A', true); t.bet('b', 'B', false); t.add(100, 'x');
      const r1 = t.settle(true), e1 = t.endStream(999);
      X(r1 && r1.winners.length === 1 && r1.winners[0].key === 'a' && e1 && e1.melts === 1 ? 'ok' : 'bad', 'Meltdown bets + end of stream', r1 ? 'YES won at the meltdown, peak ' + e1.peakR.sys + '/' + e1.peakR.dia + ' saved for the credits' : 'did not settle');
      X('ok', 'Meter extras', ['camTint', 'bets', 'credits', 'calmAward', 'rageRedeem'].map((k) => k + ' ' + (bp.S()[k] ? 'on' : 'off')).join(' · '));
    } catch (e) { X('bad', 'Meltdown bets', e.message); }
    try { const before = bp.v; const s1 = bp.state(); X(s1 && s1.sys ? 'ok' : 'bad', 'Blood pressure meter', s1.on ? s1.sys + '/' + s1.dia + ' ' + s1.level : 'switched off'); bp.v = before; } catch (e) { X('bad', 'Blood pressure meter', e.message); }
    try { const s2 = stState(); X(ST.on && !ST.running && !ST.ended ? 'warn' : 'ok', 'Starting Soon screen', ST.on ? (ST.running ? 'counting down' : ST.ended ? 'kick-off' : 'on but paused: press Hide (off) if you are live, or alerts may be held') : 'ready (' + Math.floor(s2.dur / 60000) + ':' + String(s2.dur / 1000 % 60).padStart(2, '0') + ')'); } catch (e) { X('bad', 'Starting Soon screen', e.message); }
    try { X('ok', 'Challenges', challenges.state().list.length + ' running'); } catch (e) { X('bad', 'Challenges', e.message); }
    try { X('ok', 'Team results', results.line()); } catch (e) { X('bad', 'Team results', e.message); }
    try { const st0 = bsn.publicState ? bsn.publicState() : null; X(st0 ? 'ok' : 'warn', 'Sports News', st0 ? 'ticker ' + (bsn.S().on ? 'on' : 'off') : 'no state'); } catch (e) { X('bad', 'Sports News', e.message); }
    X(sceneHeld ? 'warn' : 'ok', 'Alerts held?', sceneHeld ? 'YES: ' + heldList.length + ' waiting because the overlay is not on air (' + (sceneHeldName || 'scene') + ')' + (ST.on ? ' / Starting Soon' : '') : 'no');
    X(cfg.panic ? 'bad' : 'ok', 'Panic button', cfg.panic ? 'ON: everything is hidden' : 'off');
    X(obs.ready ? 'ok' : 'warn', 'OBS', obs.ready ? 'connected' : 'not connected');
    try { store.save(); X('ok', 'Saving data', 'works'); } catch (e) { X('bad', 'Saving data', e.message); }
    const errs = diag && diag.errors ? diag.errors.filter((e) => Date.now() - e.at < 3600000 && e.level === 'error') : [];
    X(errs.length ? 'warn' : 'ok', 'Errors in the last hour', errs.length ? errs.slice(-3).map((e) => e.msg.slice(0, 90)).join(' · ') : 'none');
  } catch (e) {
    sections.push({ name: 'System check', items: [{ lv: 'bad', name: 'The check itself crashed', detail: e.message }] });
  } finally {
    QUIET.on = false; selfTestRunning = false;
    // tidy up: the test viewer goes again
    setTimeout(() => { try { for (const v of store.all()) if (v.test && /^bbrcheck/i.test(v.login || v.display || '')) store.remove(v.key); store.save(); } catch (e) { /* ignore */ } }, 30000);
  }
  const all = [].concat(...sections.map((s) => s.items));
  selfTestLast = { at: Date.now(), secs: Math.round((Date.now() - t0) / 1000), sections, bad: all.filter((i) => i.lv === 'bad').length, warn: all.filter((i) => i.lv === 'warn').length, ok: all.filter((i) => i.lv === 'ok').length };
  return selfTestLast;
}

let overlayState = null, overlayErrLast = '';
// ---------- BOSS BLOOD PRESSURE ----------
const bp = new (require('./lib/bp').BP)({ cfg: () => cfg, saveCfg, store, push: (a) => push(a), say: sayAll, streamNo: () => streamNo(),
  onMeltdown: () => { feedAdd('MELTDOWN: the Boss has lost it', '#ff1744'); if (replay.S().on && replay.S().autoMeltdown && isLive()) setTimeout(() => replayNow({ label: 'MELTDOWN', auto: true }).catch(() => {}), 6000); if (bp.S().ticker) addStory({ cat: 'Breaking', text: 'MEDICAL EMERGENCY: THE BOSS HAS HIT MELTDOWN - DOCTORS ON STANDBY', keep: 'stream', freq: 'often', tag: 'bp-melt', breaking: showOn('breaking') }); } });
connectHooks.push(() => bp.state());
// +1 card point to someone's lowest stat (bet winners)
function bonusPoint(key) { const v = store.data.viewers[key]; if (!v || v.test || !hasCard(v)) return false; v.bonus = v.bonus || {}; const c = card(v), low = S.XP_KEYS.filter((x) => (v.bonus[x] || 0) < R.bonusMax).sort((a, b) => c.stats[a] - c.stats[b])[0]; if (!low) return false; v.bonus[low] = (v.bonus[low] || 0) + 1; return true; }
function bpPayout(r) {
  if (!r) return;
  r.winners.forEach((w) => bonusPoint(w.key)); store.save();
  const names = r.winners.slice(0, 8).map((w) => w.display).join(', ') + (r.winners.length > 8 ? ' +' + (r.winners.length - 8) : '');
  sayAll((r.meltdown ? 'MELTDOWN! ' : 'No meltdown tonight! ') + (r.winners.length ? r.winners.length + ' called it right (+1 card point each): ' + names : 'Nobody called it right.'));
  feedAdd('Meltdown bets: ' + (r.meltdown ? 'YES' : 'NO') + ' won (' + r.winners.length + ' winners)', '#ff8a2a');
}
// red tint on your camera when you're boiling (its own OBS filter on the camera source)
let bpTinted = null;
async function bpCam(s) {
  const S = bp.S(), want = S.on && S.camTint && s.v >= S.camTintAt ? (s.v >= 95 ? 2 : 1) : 0;
  if (want === bpTinted || !obs.ready) return;
  let name = (cam.home && cam.home.name) || cam.settings().camName || (cfg.screen && cfg.screen.camName) || '';
  if (!name) { try { const r = await obs.cameraRect(''); name = (r && r.name) || ''; } catch (e) { /* no camera found */ } }
  if (!name) return;
  bpTinted = want;
  try {
    if (!want) { await obs.req('SetSourceFilterEnabled', { sourceName: name, filterName: 'BBR Blood Pressure', filterEnabled: false }); return; }
    const settings = { color_multiply: want === 2 ? 0xFF3C3CFF : 0xFF7272FF, saturation: want === 2 ? 0.25 : 0.1, contrast: 0.08 };
    try { await obs.req('CreateSourceFilter', { sourceName: name, filterName: 'BBR Blood Pressure', filterKind: 'color_filter_v2', filterSettings: settings }); }
    catch (e) { await obs.req('SetSourceFilterSettings', { sourceName: name, filterName: 'BBR Blood Pressure', filterSettings: settings, overlay: true }); }
    await obs.req('SetSourceFilterEnabled', { sourceName: name, filterName: 'BBR Blood Pressure', filterEnabled: true });
  } catch (e) { bpTinted = null; }
}
bp.onChange = (s) => { bpCam(s).catch(() => {}); };
bp.onCross = () => { try { bpPayout(bp.settle(true)); } catch (e) { /* ignore */ } };
// ---------- repair: "streams" that were really one stream that dropped and came back ----------
// Before v28.3 every short drop (a Twitch reconnect) counted as a new stream: everyone who chatted got another
// check-in point, another streak step (and its boost on every stat) and attendance tickets. This finds those
// ghost streams (started within 45 minutes of the previous one ending) and takes the extra points back.
function ghostStreams() {
  const A = (store.data.streams) || {}, nos = Object.keys(A).map(Number).sort((a, b) => a - b), out = [];
  let root = null;
  for (const no of nos) {
    const prev = A[no - 1];
    if (prev && A[no].start - prev.end < 45 * 60000 && A[no].start >= prev.start) { out.push({ no, root: root == null ? no - 1 : root }); }
    else root = no;
  }
  // the current stream number can be a ghost even if it has no stats record yet
  return out;
}
function repairStreams(apply) {
  const G = ghostStreams(); if (!G.length) return { ghosts: 0, viewers: 0, done: false };
  const A = store.data.streams, gset = new Map(G.map((g) => [g.no, g.root]));
  const per = new Map();   // viewer key -> number of ghost streams they were counted in
  for (const g of G) for (const k of Object.keys((A[g.no] && A[g.no].v) || {})) per.set(k, (per.get(k) || 0) + 1);
  for (const [k, v] of Object.entries(store.data.viewers)) { const t = v.tk || {}; if (gset.has(t.lastStreamNo) && !per.has(k)) per.set(k, 1); }
  const fixes = [];
  for (const [k, c] of per) {
    const v = store.data.viewers[k]; if (!v) continue;
    const t = v.tk || {}, f = { name: v.display || v.login, streak: t.streak || 0, c };
    if (apply) {
      const old = t.streak || 0; t.streak = Math.max(1, old - c);
      if ((t.bestStreak || 0) >= old) t.bestStreak = Math.max(t.streak, (t.bestStreak || 0) - c);
      if (gset.has(t.lastStreamNo)) t.lastStreamNo = gset.get(t.lastStreamNo);
      t.bal = Math.max(0, (t.bal || 0) - c * TK.TICKETS.attend);
      if (gset.has(v.checkinNo)) { v.checkinNo = gset.get(v.checkinNo); let left = c; const B = v.bonus || {}; for (const key of Object.keys(B).sort((a, b) => (B[b] || 0) - (B[a] || 0))) { while (left > 0 && B[key] > 0) { B[key]--; left--; } } }
      if (gset.has(v.crownNo)) v.crownNo = gset.get(v.crownNo);
    }
    f.after = apply ? t.streak : Math.max(1, (t.streak || 0) - c);
    fixes.push(f);
  }
  if (apply) {
    // fold the ghost streams' stats into the real stream and carry on its number
    for (const g of G) { const a = A[g.root], b = A[g.no]; if (a && b) { a.end = Math.max(a.end, b.end); for (const [k, x] of Object.entries(b.t || {})) if (typeof x === 'number') a.t[k] = (a.t[k] || 0) + x; for (const [k, r] of Object.entries(b.v || {})) { const q = a.v[k] || (a.v[k] = {}); for (const [kk, x] of Object.entries(r)) if (typeof x === 'number') q[kk] = (q[kk] || 0) + x; } } delete A[g.no]; }
    const M = store.data.meta || {}; const top = Math.max(...G.map((g) => g.no));
    if (M.streamNo && M.streamNo <= top) M.streamNo = gset.get(M.streamNo) || M.streamNo;
    if (M.crownNo && gset.has(M.crownNo)) M.crownNo = gset.get(M.crownNo);
    store.save();
  }
  return { ghosts: G.length, viewers: fixes.length, done: !!apply, list: fixes.sort((a, b) => b.c - a.c).slice(0, 30) };
}
// ---------- reset everyone's card progress to a backup taken before this stream ----------
// Puts back watch / chat / loyalty XP, check-in points, streaks, tickets and attendance from the backup.
// Kept as they are now: tonight's support (subs, gifts, bits: SUB + SUP), new followers, everything else.
function backupList() {
  const dir = path.join(DATA, 'backups'); let L = [];
  try { L = fs.readdirSync(dir).filter((f) => /^(auto-|viewers-).*\.json$/.test(f)).map((f) => ({ f, at: fs.statSync(path.join(dir, f)).mtimeMs, why: /^viewers-/.test(f) ? 'daily copy' : 'automatic backup' })); } catch (e) { /* none */ }
  return L.sort((a, b) => b.at - a.at);
}
function tonightStart() {
  // the start of tonight's stream, following back through any restarts/drops (45 min rule)
  const A = store.data.streams || {}, M = store.data.meta || {};
  // walk back through the stream records (skipping numbers with no record) while each began within 45 min of the one before ending
  const nos = Object.keys(A).map(Number).filter((n) => n <= (M.streamNo || 0)).sort((a, b) => b - a);
  let start = (A[nos[0]] && nos[0] === M.streamNo) ? A[nos[0]].start : (M.streamStart || liveSince || Date.now());
  for (let i = 0; i < nos.length; i++) {
    const cur = A[nos[i]], prev = A[nos[i + 1]];
    if (i === 0 && nos[0] !== M.streamNo && cur && start - cur.end >= 45 * 60000) break;
    if (i === 0 && nos[0] !== M.streamNo) { if (cur) start = Math.min(start, cur.start); }
    else if (i === 0) start = cur.start;
    if (!prev || cur.start - prev.end >= 45 * 60000) break;
    start = prev.start;
  }
  return start;
}
function readBackup(f) {
  const j = JSON.parse(fs.readFileSync(path.join(DATA, 'backups', path.basename(f)), 'utf8'));
  const d = j.bbrBackup ? j.data : j; if (!d || !d.viewers) throw new Error('That file has no cards in it'); return d;
}
function resetCards(file, apply) {
  const d = readBackup(file), bv = d.viewers, now = Date.now();
  const st = tonightStart(), newNo = ((d.meta && d.meta.streamNo) || 0) + 1;
  const CARD_FIELDS = ['bonus', 'bank', 'tk', 'streams', 'recent', 'lastStream', 'lastAttendAt', 'checkinNo', 'crownNo', 'dayXp', 'day', 'decayedTo'];
  let changed = 0, fresh = 0; const sample = [];
  for (const [k, v] of Object.entries(store.data.viewers)) {
    if (v.test) continue;
    const before = hasCard(v) ? card(v) : null;
    const o = bv[k];
    const seenTonight = (v.lastSeen || 0) >= st;
    if (apply) {
      if (o) {
        for (const f of CARD_FIELDS) { if (o[f] === undefined) delete v[f]; else v[f] = JSON.parse(JSON.stringify(o[f])); }
        const keepSup = v.xp ? { SUB: v.xp.SUB, SUP: v.xp.SUP } : {};
        v.xp = Object.assign(JSON.parse(JSON.stringify(o.xp || {})), keepSup);
      } else {
        // a new viewer tonight: no streak or check-in points from the duplicate streams
        v.bonus = {}; if (v.tk) { v.tk.streak = 0; v.tk.bestStreak = 0; v.tk.lastStreamNo = 0; v.tk.bal = 0; } delete v.checkinNo; v.streams = 0; v.recent = []; delete v.lastStream; delete v.lastAttendAt;
        fresh++;
      }
      // tonight counts once: one streak step, one check-in point, one attendance (no chat message posted)
      if (seenTonight && hasCard(v)) {
        TK.attended(v, newNo, now);
        S.attendStream(v, 'bbr-' + newNo, now);
        const c0 = card(v), low = S.XP_KEYS.filter((x) => (v.bonus[x] || 0) < R.bonusMax).sort((a2, b2) => c0.stats[a2] - c0.stats[b2])[0];
        if (low && cfg.checkinPoint !== false) v.bonus[low] = Math.min(R.bonusMax, (v.bonus[low] || 0) + 1);
        v.checkinNo = newNo;
      }
    }
    const after = apply && hasCard(v) ? card(v) : null;
    if (o || seenTonight) { changed++; if (before && sample.length < 12) {
      // the streak they will have: the backup's streak, plus tonight if they've been here (a gap breaks it unless savers cover it)
      const bt = (o && o.tk) || {}; let will = bt.streak || 0;
      if (seenTonight) { const missed = bt.lastStreamNo ? newNo - bt.lastStreamNo - 1 : -1; will = missed < 0 ? 1 : missed === 0 ? will + 1 : (bt.savers || 0) >= missed ? will + 1 : 1; }
      sample.push({ name: v.display || v.login, ovr: before.ovr, streakNow: apply ? null : (v.tk && v.tk.streak) || 0, streak: apply ? (v.tk && v.tk.streak) || 0 : will, ovrAfter: after ? after.ovr : null });
    } }
  }
  if (apply) {
    // tonight becomes the stream after the backup's; the duplicate stream records fold into it
    const A = store.data.streams || {}, M = store.data.meta || (store.data.meta = {});
    const ghosts = Object.keys(A).map(Number).filter((n) => n >= newNo).sort((a, b) => a - b);
    if (ghosts.length) { const base = A[ghosts[0]]; for (const g of ghosts.slice(1)) { const x = A[g]; base.end = Math.max(base.end, x.end); for (const [k2, n] of Object.entries(x.t || {})) if (typeof n === 'number') base.t[k2] = (base.t[k2] || 0) + n; for (const [k2, r] of Object.entries(x.v || {})) { const q = base.v[k2] || (base.v[k2] = {}); for (const [kk, n] of Object.entries(r)) if (typeof n === 'number') q[kk] = (q[kk] || 0) + n; } delete A[g]; } if (ghosts[0] !== newNo) { A[newNo] = Object.assign(base, { no: newNo }); delete A[ghosts[0]]; } }
    if (M.crownNo && M.crownNo >= newNo) M.crownNo = newNo;
    M.streamNo = newNo;
    store.save();
  }
  return { ok: true, file: path.basename(file), backupAt: fs.statSync(path.join(DATA, 'backups', path.basename(file))).mtimeMs, tonightStart: st, streamNo: newNo, viewers: changed, newTonight: fresh, done: !!apply, sample };
}
function bpStreamEnd(no) {
  try { bpPayout(bp.settle(false)); } catch (e) { /* ignore */ }
  try { const r = bp.endStream(no); if (r && (r.calm || r.calmest) && bp.S().ticker) addStory({ cat: 'Dressing room', text: r.calmest ? 'CALMEST STREAM OF THE SEASON: THE BOSS PEAKED AT JUST ' + r.peakR.sys + '/' + r.peakR.dia : 'COOL AS ICE: THE BOSS NEVER LOST HIS TEMPER (PEAK ' + r.peakR.sys + '/' + r.peakR.dia + ')', keep: 'stream', freq: 'loop', tag: 'bp-calm' }); bpCam({ v: 0 }).catch(() => {}); } catch (e) { /* ignore */ }
}
// ---------- featured chat message ----------
const chatLog = [];
// ---------- the BBR chat overlay: Twitch + Kick + YouTube in one, with card ratings ----------
const TIER_C = { bronze: '#c8894f', silver: '#c9ced6', gold: '#f6d77a' };
function chatS() { const c = cfg.chatOverlay || {}; return { max: Math.max(2, Math.min(15, +c.max || 6)), fadeSecs: Math.max(0, Math.min(600, c.fadeSecs != null ? +c.fadeSecs : 40)), ovr: c.ovr !== false, platforms: c.platforms !== false, oldSource: String(c.oldSource || ''), dodge: c.dodge !== false, size: Math.max(14, Math.min(30, +c.size || 19)) }; }
let chatLast = { key: '', text: '', at: 0 };
function chatShow(platform, e, v) {
  if (!showOn('chat') || cfg.panic) return;
  const text = String(e.text || '').trim(); if (!text || text.startsWith('!')) return;
  if (v && v.key === chatLast.key && text === chatLast.text && Date.now() - chatLast.at < 30000) return;   // repeated spam
  chatLast = { key: v ? v.key : '', text, at: Date.now() };
  const c = v && hasCard(v) ? card(store.primary(v) || v) : null, b = e.badges || [];
  push({ type: 'chat', id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), platform, display: e.display || e.login, text: text.slice(0, 220),
    color: c ? (c.tier === 'legend' ? accent() : TIER_C[c.tier] || '#c9ced6') : '#c9ced6', ovr: c && !(v && v.isBroadcaster) ? c.ovr : null, boss: !!(v && v.isBroadcaster), mod: b.includes('moderator'),
    sub: b.includes('subscriber') || b.includes('founder'), first: !!(v && (v.messages || 0) <= 1), S: chatS() });
}
// switching the BBR chat on hides your old chat source in OBS (and back)
async function chatOldSource(on) {
  const name = chatS().oldSource; if (!name || !obs.ready) return;
  try { const cur = await obs.req('GetCurrentProgramScene'); const scene = cur.sceneName || cur.currentProgramSceneName; const { sceneItems } = await obs.req('GetSceneItemList', { sceneName: scene }); const it = (sceneItems || []).find((x) => x.sourceName === name); if (it) await obs.req('SetSceneItemEnabled', { sceneName: scene, sceneItemId: it.sceneItemId, sceneItemEnabled: !on }); } catch (e) { /* ignore */ }
}
connectHooks.push(() => ({ type: 'chatcfg', S: chatS() }));
function chatRemember(platform, e, v) { if (!e.text || e.text.startsWith('!')) return; chatLog.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4), platform, key: v && v.key, display: e.display || e.login, text: String(e.text).slice(0, 300), at: Date.now() }); if (chatLog.length > 60) chatLog.shift(); }

// ---------- predictions on shootouts (Twitch affiliates / partners) ----------
let prediction = null;
async function predictFrom(a) {
  if (!showOn('predictions') || a.type !== 'battle' || a.mode !== 'shootout' || !twitch.user) return;
  try {
    if (a.phase === 'matchup' && a.fighters && a.fighters.length === 2 && !prediction) { const p = await twitch.predictionStart('Who wins the shootout?', a.fighters.map((f) => f.display), 90); if (p) prediction = p; }
    if (a.phase === 'result' && prediction) { const win = prediction.outcomes[a.winner]; await twitch.predictionEnd(prediction.id, win && win.id); prediction = null; }
  } catch (e) { console.log('[predictions] ' + e.message); prediction = null; }
}

// ---------- Discord: post the night after the credits ----------
function recapExtra() {
  const out = [];
  try { const l = results.line(); if (l) out.push('**Pro Clubs:** ' + l); } catch (e) { /* ignore */ }
  try { const T = clubStats.table().filter((r) => r.motm).sort((a, b) => b.motm - a.motm).slice(0, 3); if (T.length) out.push('**Man of the match leaders:** ' + T.map((r) => r.name + ' ' + r.motm).join(', ')); } catch (e) { /* ignore */ }
  try { const R = offenders('tonight'); if (R.length) out.push('**Red cards tonight:** ' + R.map((r) => r.name + (r.total > 1 ? ' ×' + r.total : '')).join(', ')); } catch (e) { /* ignore */ }
  try { const c = replay.bestOfNight(streamNo()); if (c) out.push('**Replay of the night:** ' + (c.label || 'clip #' + c.n)); } catch (e) { /* ignore */ }
  return out;
}
async function postDiscordText(text) {
  const url = (cfg.discord || {}).webhook; if (!url || !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) return { error: 'No Discord webhook set' };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'BBR Viewer Club', content: String(text).slice(0, 1900) }) });
  return r.ok ? { ok: true } : { error: 'Discord said ' + r.status };
}
async function postDiscord(d) {
  const url = (cfg.discord || {}).webhook; if (!url || !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) return { error: 'No Discord webhook set' };
  const T = d.totals || {}, lines = (d.sections || []).slice(0, 6).map((s) => '**' + s.role + '**: ' + s.names.slice(0, 8).map((n) => n.name).join(', ') + (s.names.length > 8 ? ' +' + (s.names.length - 8) : ''));
  const body = { username: 'BBR Viewer Club', embeds: [{ title: 'Stream #' + d.no + ': thanks for tonight!', color: 0x3dff9a,
    description: [T.follows + ' new followers · ' + ((T.subs || 0) + (T.gifted || 0)) + ' subs + gifts · ' + (T.bits || 0) + ' bits · ' + (T.battles || 0) + ' battles', d.mvp ? '**Viewer of the stream: ' + d.mvp + '**' : '', ...recapExtra(), d.raid ? (d.raid.win ? 'Raid Night: the Queen fell' : 'Raid Night: the Queen survived') : '', (d.results || []).map((r) => r).join(' · '), '', lines.join('\n'), '', d.teaser || ''].filter((x) => x !== null).join('\n').slice(0, 3900) }] };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok ? { ok: true } : { error: 'Discord said ' + r.status };
}

// ---------- pre-stream check ----------
async function precheck() {
  const out = [], add = (ok, t, fix) => out.push({ ok, t, fix: fix || '' });
  add(obs.ready, 'OBS linked', 'Battles page: connect OBS (Tools > WebSocket Server Settings)');
  add(clients.size > 0, 'Overlay open in OBS (' + clients.size + ')', 'Add the overlay browser source');
  add(!!twitch.user || !twitch.configured(), 'Twitch connected', 'Platforms page: Connect Twitch');
  add(!kick.configured() || kick.connected, 'Kick chat connected', 'Platforms page: check your Kick name');
  add(!youtube.configured() || youtube.connected || !youtube.live, 'YouTube connected', 'Platforms page: connect YouTube when you go live');
  let camOk = false; try { camOk = !!(await obs.cameraRect(cam.settings().camName)); } catch (e) { /* ignore */ }
  add(camOk, 'Camera found in the scene on air', 'Camera studio: type your camera source name');
  add(!raidNight.S().on || viewerCache.n != null, 'Viewer count working for Raid Night' + (viewerCache.n != null ? ' (' + viewerCache.n + ' watching)' : ''), 'Connect Twitch / Kick / YouTube on the Platforms page (or start the Queen yourself from the Live desk)');
  add(!cfg.panic, 'Panic mode off', 'Live desk: tap Panic again');
  add(!cfg.battlesPaused, 'Battles on', 'Live desk: switch Battles on');
  return out;
}

// ---------- card profile (for !card) ----------
// rewards page: everything the page needs, plus which challenges on screen came from each reward
function liveFromReward(key) { const RW = require('./lib/rewards'); return challenges.data().list.filter((c) => c.source && RW.keyOf(c.source) === key); }
function rewardsPayload() {
  const list = rewards.list().map((x) => { const L = liveFromReward(x.key); return Object.assign(x, { live: L.length, liveLeft: L.map((c) => (c.unit === 'minutes' && c.endsAt ? Math.max(0, Math.ceil((c.endsAt - Date.now()) / 60000)) : c.left) + ' ' + (c.left === 1 && c.unit !== 'minutes' ? c.unit.replace(/ies$/, 'y').replace(/es$/, '').replace(/s$/, '') : c.unit) + ' left' + (c.hidden ? ' (hidden)' : '')).join(', ') }); });
  return { list, camFx: CAMX.CHAT_FX.map((k) => ({ id: k, label: CAMX.FX[k].label, secs: cam.secsFor(k) })), units: ['games', 'matches', 'deliveries', 'raids', 'minutes'], twitch: !!twitch.user };
}
function profileOf(v) {
  const c = card(v), all = store.all().filter((x) => !x.test && !x.isBroadcaster).map((x) => card(x).ovr).sort((a, b) => b - a);
  const watchMin = Object.values(store.data.streams || {}).reduce((a, s) => a + (((s.v || {})[v.key] || {}).w || 0), 0);
  const b = v.battles || {}, ra = v.races || {}, ar = v.arc || {};
  return { rank: all.findIndex((n) => n <= c.ovr) + 1, of: all.length, watchH: Math.round(watchMin / 60), streams: v.streams || 0, bits: v.bits || 0, gifted: S.giftsAllTime(v),
    battlesW: (b.won || 0) + (ra.won || 0) + (ar.won || 0), battlesL: Math.max(0, (b.played || 0) + (ra.played || 0) + (ar.played || 0) - (b.won || 0) - (ra.won || 0) - (ar.won || 0)), queen: ar.mvpWins || 0, raids: v.raids || 0 };
}
// the Sports News ticker as its own OBS source, so it can sit in front of or behind your camera
const TICKER_SRC = 'BBR Sports News';
function tickerInfo() { return { layer: cfg.tickerLayer || 'overlay', source: TICKER_SRC }; }
async function setTickerLayer(layer) {
  if (!['overlay', 'front', 'behind', 'hidden'].includes(layer)) return { error: 'unknown layer' };
  cfg.tickerLayer = layer; saveCfg(); bsnTicker();
  if (!obs.ready) return { ok: true, note: 'OBS not connected: add a Browser Source called "' + TICKER_SRC + '" with http://localhost:' + PORT + '/bsn/?standalone=1 (1920x1080) yourself.' };
  try {
    const cur = await obs.req('GetCurrentProgramScene'); const scene = cur.sceneName || cur.currentProgramSceneName;
    let items = (await obs.req('GetSceneItemList', { sceneName: scene })).sceneItems || [];
    let it = items.find((x) => x.sourceName === TICKER_SRC);
    const want = layer === 'front' || layer === 'behind';
    if (!it && want) {
      try { await obs.req('CreateInput', { sceneName: scene, inputName: TICKER_SRC, inputKind: 'browser_source', inputSettings: { url: 'http://localhost:' + PORT + '/bsn/?standalone=1', width: 1920, height: 1080 }, sceneItemEnabled: true }); }
      catch (e) { await obs.req('CreateSceneItem', { sceneName: scene, sourceName: TICKER_SRC, sceneItemEnabled: true }); }
      items = (await obs.req('GetSceneItemList', { sceneName: scene })).sceneItems || [];
      it = items.find((x) => x.sourceName === TICKER_SRC);
    }
    if (!it) return { ok: true };
    await obs.req('SetSceneItemEnabled', { sceneName: scene, sceneItemId: it.sceneItemId, sceneItemEnabled: want });
    if (want) {
      const chk = await obs.layerCheck(cam.settings().camName || (cfg.screen && cfg.screen.camName));
      const camIt = chk && chk.camera && items.find((x) => x.sourceName === chk.camera);
      if (camIt) {
        const ci = camIt.sceneItemIndex, ti = it.sceneItemIndex;
        // OBS: a higher index is drawn on top
        const to = layer === 'front' ? (ti > ci ? ci + 1 : ci) : (ti > ci ? ci : ci - 1);
        await obs.req('SetSceneItemIndex', { sceneName: scene, sceneItemId: it.sceneItemId, sceneItemIndex: Math.max(0, to) });
      }
    }
    return { ok: true };
  } catch (e) { return { error: e.message }; }
}
const diag = new Diag({ cfg: () => cfg, dataDir: DATA, file: path.join(DATA, 'viewers.json'), platforms: PLATFORMS, obs, battle, overlays: () => clients.size, isLive,
  reloadOverlays: () => push({ type: 'reload' }), resume: () => pauseBattles(false), version: APP_VERSION,
  extraFix: async (id) => { if (id !== 'layer') return null; const ok = await obs.overlayToTop(obsLayer); obsLayer = await obs.layerCheck(screenSettings().cards.camera); return ok ? 'Moved the overlay above the camera in OBS' : 'Could not move the overlay'; },
  extra: () => { const out = [];
    if (obsLayer && !obsLayer.unknown) out.push(obsLayer.ok ? { id: 'layer', level: 'ok', title: 'Overlay is above your camera in OBS', detail: '"' + obsLayer.overlay + '" is over "' + obsLayer.camera + '" in the ' + obsLayer.scene + ' scene.' }
      : { id: 'layer', level: 'warn', title: 'Cards can show BEHIND your camera', detail: 'In the ' + obsLayer.scene + ' scene, "' + obsLayer.overlay + '" is below "' + obsLayer.camera + '" in the Sources list.', fix: { id: 'layer', label: 'Move the overlay to the top', auto: false } });
    if (twitch.lastDrop && Date.now() - twitch.lastDrop.at < 3600000) out.push({ id: 'chatdrop', level: 'warn', title: 'Twitch refused a chat reply', detail: twitch.lastDrop.why + ' (message: "' + twitch.lastDrop.message + '")' });
    const AL = obs.alertList || [];
    if (AL.length) out.push(AL.some((a) => a.heard) ? { id: 'alerts', level: 'ok', title: 'Tangia / Streamlabs found', detail: AL.map((a) => a.name).join(', ') + '. Cards wait while they play.' }
      : { id: 'alerts', level: 'info', title: 'Can\'t hear Tangia / Streamlabs yet', detail: 'Found ' + AL.map((a) => a.name).join(', ') + '. In OBS, double-click each one and tick "Control audio via OBS" so cards can wait while they play. (It only shows once something has played.)' });
    if (twitch.cantListen && twitch.cantListen.has('channel.channel_points_custom_reward_redemption.add')) out.push({ id: 'redeem', level: 'info', title: 'Channel point redemptions not visible', detail: 'Press Reconnect Twitch on the Platforms page once, so cards can wait for Tangia when someone redeems channel points.' });
    return out.concat(bsnCheck()); } });
function bsnCheck() { const S = bsn.S(); if (!S.on) return []; const st = bsn.publicState(); return [{ id: 'bsn', level: st.error ? 'warn' : 'ok', title: st.error ? 'Sports News: scores feed offline' : 'Sports News scores feed', detail: st.error || (st.matches_today + ' games today in your competitions, ' + st.live_now + ' live now.') }]; }
let obsLayer = null;
setInterval(async () => { try { obsLayer = obs.ready ? await obs.layerCheck(screenSettings().cards.camera) : null; } catch (e) { /* OBS busy */ } }, 60000).unref();
let lastPhase = 'idle';
setInterval(() => {
  const ph = battle.phase;
  if (ph === lastPhase) return;
  const was = lastPhase; lastPhase = ph;
  bsn.setBattle(ph !== 'idle'); bsnTicker(); pushScreen();
  setTimeout(async () => { try { if (obs.ready) { camRect = await obs.cameraRect(screenSettings().cards.camera); pushScreen(); } } catch (e) { /* ignore */ } }, 2500);
  const S = obs.settings();
  if (!S.on) return;
  // the arena appears at the matchup, and goes away when the battle ends
  if (was === 'join' && ph !== 'idle') { move.fire('battleStart'); if (!move.replacesCorner()) obs.toCorner().catch((e) => { obs.error = e.message; }); }
  if (ph === 'idle' && was !== 'join') setTimeout(() => { if (battle.phase === 'idle') { move.fire('battleEnd'); if (!move.replacesCorner()) obs.restore().catch((e) => { obs.error = e.message; }); } }, 400);
}, 300);

// ---------- chat ----------
const cooldown = new Map();
let lastCardShown = 0;
function cardLine(c) {
  const arrow = c.form === 'up' ? ' ▲' : c.form === 'down' ? ' ▼' : '';
  return c.display + ': ' + c.tier.toUpperCase() + ' ' + c.ovr + arrow + ' | ' + S.STAT_KEYS.map((k) => k + ' ' + c.stats[k]).join(' ') +
    (c.streak && c.streak.now ? ' | ' + c.streak.now + '-stream streak' + (c.streak.name ? ' (' + c.streak.name + ' +' + c.boost + ')' : '') : '') +
    (c.ribbon ? ' | ' + c.ribbon : '') + (GA_ON() ? ' | ' + (c.tickets || 0) + ' tickets' : '') + (c.lockHint ? ' | ' + c.lockHint : '') + (c.banked ? ' | extra support banked' : '');
}
// chat replies for !card and !here are grouped per platform so the bot never floods chat
const replyQ = {};
function queueReply(platform, kind, v) {
  const q = replyQ[platform] = replyQ[platform] || { card: [], here: [], t: null };
  if (!q[kind].includes(v.key)) q[kind].push(v.key);
  if (!q.t) q.t = setTimeout(() => flushReplies(platform), Math.max(1, R.cards.cardReplyGap) * 1000 + (platform === 'youtube' ? 6000 : 0));
}
function flushReplies(platform) {
  const q = replyQ[platform]; if (!q) return;
  q.t = null;
  const cards = q.card.splice(0).map((k) => store.data.viewers[k]).filter(Boolean).map(card);
  const here = q.here.splice(0).map((k) => store.data.viewers[k]).filter(Boolean).map(card);
  const msgs = [];
  if (cards.length === 1) msgs.push('@' + cardLine(cards[0]));
  else if (cards.length) msgs.push('Cards: ' + cards.map((c) => '@' + c.display + ' ' + c.tier.toUpperCase() + ' ' + c.ovr + (c.streak.now ? ' (' + c.streak.now + ' in a row)' : '')).join(' · ') + ' | type !card again in ' + Math.ceil(R.cards.cardCooldown / 60) + ' min');
  if (here.length) msgs.push('Checked in: ' + here.map((c) => c.display + ' ' + c.streak.now + ' in a row').join(' · '));
  for (const m of msgs) sayOnce(platform, m);
}
// Twitch quietly refuses the same text twice in 30 seconds, so a repeat gets a tiny change
const lastSaid = {};
function sayOnce(platform, msg, important) {
  const L = lastSaid[platform];
  let out = msg.length > 480 ? msg.slice(0, 477) + '...' : msg;
  if (L && L.msg === out && Date.now() - L.at < 35000) out += ' ·';
  lastSaid[platform] = { msg: out, at: Date.now() };
  say(platform, out, important);
}
// check-ins are grouped: one strip with up to 6 names, at most every 10 seconds
let checkinQ = [], checkinT = null, lastCheckinPush = 0;
function checkinQueue(v, firstEver, platform, extra) {
  checkinQ.push(Object.assign({ key: v.key, first: firstEver, platform }, extra || {}));
  if (!checkinT) checkinT = setTimeout(flushCheckins, Math.max(3000, 10000 - (Date.now() - lastCheckinPush)));
}
async function flushCheckins() {
  checkinT = null; lastCheckinPush = Date.now();
  const batch = checkinQ.splice(0, 6);
  const list = [];
  for (const x of batch) { const v = store.data.viewers[x.key]; if (!v) continue; const pv = store.primary(v) || v; await withAvatar(pv).catch(() => {}); const c = card(pv); list.push({ display: c.display, avatar: c.avatar, platform: x.platform, streak: c.streak.now, first: x.first, tier: c.tier, ovr: c.ovr, ovrFrom: x.ovrFrom, stat: x.stat, from: x.from, to: x.stat ? c.stats[x.stat] : null, crown: x.crown, card: showOn('checkinCards') ? c : undefined }); }
  if (list.length) { push({ type: 'checkin', list }); streamLog.event('checkins', list.length); }
  if (checkinQ.length) checkinT = setTimeout(flushCheckins, 10000);
}
function onCooldown(key, ms) { const now = Date.now(); if (now - (cooldown.get(key) || 0) < ms) return true; cooldown.set(key, now); return false; }

async function onChat(platform, e, test) {
  try { if (tangiaMatch(platform, e)) return; } catch (err) { /* ignore */ }
  const text = (e.text || '').trim();
  // the app posts as your account: when its own message comes back through chat, ignore it (no card points, no commands)
  if (!test && (e.badges || []).includes('broadcaster')) { const t60 = text.slice(0, 60).toLowerCase(), nowE = Date.now(); if (saidRecent.some((x) => nowE - x.at < 120000 && (x.t === t60 || t60.startsWith(x.t.slice(0, 40))))) return; }
  const now = Date.now();
  const b = e.badges || [];
  // v33: the giveaway meter's entry word (one entry each)
  try { gmeter.chat(platform, e.login, e.display, text, b.some((x) => /sub|founder|member/i.test(x))); } catch (err) { /* ignore */ }
  const res = await update(platform, e.login, e.display, (v) => {
    v.isBroadcaster = b.includes('broadcaster');
    v.isMod = b.includes('moderator');
    v.isVip = b.includes('vip');
    if (e.kickId) v.kickId = e.kickId;
    if (e.avatar && !v.avatar) v.avatar = e.avatar;
    if (b.includes('subscriber') || b.includes('founder')) {
      if (!v.subMonths) { v.subMonths = 1; S.addXp(v, 'SUB', 1, R, true, now); }
      v.lastSubAt = now; if (!v.subPlatform) v.subPlatform = platform;
    }
    const firstEver = !v.lastChatAt && !(v.messages > 0);
    v.lastChatAt = now;
    v.seenOn = v.seenOn || {}; v.seenOn[platform] = now;
    attend(v, now);
    // first words of the stream = check-in: +1 card point (to the lowest stat) and a spot on the check-in strip
    const sn = streamNo();
    if (sn && isLive() && v.checkinNo !== sn && hasCard(v)) {
      v.checkinNo = sn;
      const c0 = card(v), low = S.XP_KEYS.filter((x) => (v.bonus[x] || 0) < R.bonusMax).sort((a2, b2) => c0.stats[a2] - c0.stats[b2])[0];
      if (low && cfg.checkinPoint !== false && !v.test) v.bonus[low] = Math.min(R.bonusMax, (v.bonus[low] || 0) + 1);
      // first chatter of the stream wears the crown tonight
      const meta = store.data.meta || (store.data.meta = {});
      let crown = false; if (meta.crownNo !== sn && !v.test && !v.isBroadcaster) { meta.crownNo = sn; v.crownNo = sn; crown = true; }
      checkinQueue(v, firstEver, platform, { stat: low, from: low ? c0.stats[low] : null, ovrFrom: c0.ovr, crown });
    }
    const lower = text.toLowerCase();
    if (text.length >= 3 && lower !== v.lastText && now - (v.lastCounted || 0) > 5000 && !text.startsWith('!')) {
      v.messages = (v.messages || 0) + 1;
      v.lastCounted = now;
      v.lastText = lower;
      S.addXp(v, 'CHT', 1, R, false, now);
      streamLog.event('message', 1, v.key);
    }
    if (firstEver) streamLog.event('newface', 1, v.key);
  }, { test });
  if (!res) return;
  const v = res.v;
  chatRemember(platform, e, v);
  try { replayCall(v, text); } catch (err) { /* ignore */ }
  if (platform === 'twitch' && !hasCard(v)) followSyncSoon();
  try { chatShow(platform, e, v); } catch (err) { /* ignore */ }
  try { startingChat(platform, e, v); } catch (err) { /* ignore */ }
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  // v35: the simple giveaway's command (!giveaway) and !watchtime
  try { botcheck.noteChat(platform, e); } catch (err) { /* ignore */ }
  try { if (spin.chat(platform, e)) return; } catch (err) { console.error('[spin]', err.message); }
  try { if (ballon.chat(platform, e, { follower: !!v.followedAt || platform !== 'twitch', broadcaster: b.includes('broadcaster') || !!v.isBroadcaster, motmOpen: !!clubStats.vote })) return; } catch (err) { console.error('[ballon]', err.message); }
  try { if (sgw.chat(platform, e, { mod: b.includes('moderator') || b.includes('broadcaster') || !!v.isBroadcaster, sub: b.some((x) => /sub|founder|member/i.test(x)) || !!v.subMonths && v.lastSubAt > Date.now() - 32 * 86400000, follower: !!v.followedAt || platform !== 'twitch' })) return; } catch (err) { console.error('[giveaway]', err.message); }
  if (battle.chatInput(platform, e.login, text)) return;

  // first appearance of an imported/known follower or sub gets their pack opening
  if (!v.packShown && (v.followedAt || v.lastSubAt) && now - lastPackAt > 30000 && battle.phase === 'idle') {
    v.packShown = true; lastPackAt = now;
    await withAvatar(v);
    push({ type: 'pack', card: card(v) });
    if (cmd === '!card') { onCooldown(v.key, R.cards.cardCooldown * 1000); queueReply(platform, 'card', v); return; }
  }
  if (cmd === '!here' || cmd === '!checkin') { if (!onCooldown('here-' + v.key, 600000)) queueReply(platform, 'here', v); return; }

  if (cmd === '!lastgoal' || cmd === '!roundup') { bsn.chat(cmd, e.display || e.login, !!(v.isBroadcaster || v.isMod)).catch(() => {}); return; }
  if (!GA_ON() && ['!tickets', '!ticket', '!pot', '!enter', '!claim', '!giveaway'].includes(cmd)) return;
  if (cmd === '!card' && !hasCard(v)) {
    if (!onCooldown('nocard-' + v.key, 120000)) say(platform, '@' + v.display + ' ' + (platform === 'youtube' ? 'subscribe to the channel' : 'follow the channel') + ' to unlock your BBR card! Your watch time and chat are already counting, so it starts with everything you have done.');
    if (platform === 'twitch') followSyncSoon();
    return;
  }
  if (cmd === '!card') {
    if (onCooldown(v.key, R.cards.cardCooldown * 1000)) return;   // per person
    if (now - lastCardShown > R.cards.cardScreenGap * 1000) {      // whole chat, on screen
      lastCardShown = now;
      await withAvatar(v);
      push({ type: 'show', card: card(v), profile: showOn('cardProfile') || showOn('cardFlip') ? profileOf(v) : null, flip: showOn('cardFlip'), wide: showOn('cardProfile') });
    }
    queueReply(platform, 'card', v);                                // whole chat, replies are grouped
  } else if (counters.list().some((c) => c.cmd && c.cmd === cmd)) {
    if (onCooldown(cmd + platform, 30000)) return;
    sayOnce(platform, counters.chatLine(counters.list().find((c) => c.cmd === cmd).id));
  } else if ((cmd === '!replay' || cmd === '!clip') && replay.S().chat !== 'off' && (v.isMod || v.isBroadcaster || (replay.S().chat === 'subs' && (v.subMonths || 0) > 0))) {
    // chat clips go in the clip list (you choose when to play them): one every 45 seconds
    if (onCooldown('!clip', 45000)) return;
    replayNow({ label: parts.slice(1).join(' ').slice(0, 30), by: v.display, auto: true }).then((r) => { if (r.ok) sayOnce(platform, 'Clipping it! @' + v.display + ' it will be in the replay list in about 20 seconds.'); else sayOnce(platform, '@' + v.display + ' ' + r.error); }).catch(() => {});
  } else if (cmd === '!motm' || cmd === '!vote') {
    if (clubStats.cast(v.key, parts.slice(1).join(' '))) return;
  } else if (cmd === '!stats') {
    if (onCooldown('!stats-' + platform, 15000)) return;
    const who = parts.slice(1).join(' ') || v.display; const line = clubStats.statsLine(who);
    if (line) sayOnce(platform, line);
  } else if (cmd === '!shame' || cmd === '!hallofshame') {
    if (onCooldown('!shame-' + platform, 30000)) return;
    const T = offenders('all').slice(0, 3);
    sayOnce(platform, T.length ? 'Hall of Shame (all time): ' + T.map((r, i) => (i + 1) + '. ' + r.name + ' ' + r.total + ' (' + r.red + ' red, ' + r.y2 + ' two-yellows)').join(' · ') : 'The Hall of Shame is empty. For now.');
  } else if (cmd === '!bans' || cmd === '!redcard' || cmd === '!redcards') {
    if (onCooldown('!bans-' + platform, 30000)) return;
    const R2 = rcS(), B = banList();
    sayOnce(platform, 'Red card rule: no unnecessary red cards. 2 yellows = ' + R2.yellowBan + ' match ban, straight red = ' + R2.redBan + ' match ban. ' + (B.length ? 'Banned: ' + B.map((b) => b.name + ' (' + b.left + ')').join(', ') : 'Nobody is banned right now.'));
  } else if (cmd === '!squad' || cmd === '!out' || cmd === '!leave') {
    const arg = (parts[1] || '').toLowerCase();
    if (cmd !== '!squad' || arg === 'leave' || arg === 'out') { const r = squad.leave(v.key); if (r.ok) say(platform, '@' + v.display + ' you are off the squad list.'); return; }
    const r = squad.join(v, platform, e.badges || []);
    if (r.error) { if (!onCooldown('!squad-no-' + v.key, 60000)) say(platform, '@' + v.display + ' the squad is ' + (r.error === 'subs only' ? 'for Twitch subs only: sub to join the squad!' : r.error === 'you are the Boss' ? 'yours anyway, Boss.' : r.error + '.')); return; }
    if (!onCooldown('!squad-' + v.key, 20000)) say(platform, '@' + v.display + ' ' + (r.joined ? 'you are on the squad list! ' : '') + squad.chatLine(v.key));
  } else if (cmd === '!predict') {
    const m = /(\d{1,2})\s*[-:]\s*(\d{1,2})/.exec(text); if (!m) return;
    const r = squad.predict(v.key, +m[1], +m[2]);
    if (!onCooldown('!predict-' + v.key, 15000)) say(platform, '@' + v.display + ' ' + (r.error ? r.error : 'prediction locked in: ' + m[1] + '-' + m[2] + '.'));
  } else if (cmd === '!record' || cmd === '!results') {
    if (onCooldown('!record-' + platform, 30000)) return;
    sayOnce(platform, results.line());
  } else if (cmd === '!scores' || cmd === '!score') {
    if (onCooldown('!scores-' + platform, 30000)) return;
    const L = liveScores(true).slice(0, 5); sayOnce(platform, L.length ? L.map((m) => m.home + ' ' + (m.state === 'pre' ? 'v' : m.hs + '-' + m.as) + ' ' + m.away + ' (' + m.min + ')').join(' · ') : 'No games on today.');
  } else if (cmd === '!news' && (v.isMod || v.isBroadcaster)) {
    const t = text.replace(/^!news\s*/i, '').trim(); if (t.length > 5) { addStory({ text: t, cat: 'Fan zone', by: v.display, pending: !v.isBroadcaster }); say(platform, v.isBroadcaster ? 'Story added to the ticker.' : 'Thanks! The Boss will check it before it goes on the ticker.'); }
  } else if ((cmd === '!leaderboard' || cmd === '!lb' || cmd === '!top20') && cfg.lbChat) {
    if (onCooldown('!leaderboard', 600000)) return;
    showLb('cards', 'all', 20, 30);
  } else if (cmd === '!enlist' || cmd === '!enroll' || cmd === '!enrol') {
    raidNight.enlist(v.key, v.display, platform, e.login);
  } else if (cmd === '!shoot' || cmd === '!bang' || cmd === '!pew') {
    raidNight.shoot(v.key, v.display);
  } else if (cmd === '!raidnight' || cmd === '!warchest' || cmd === '!queen') {
    if (onCooldown('!raidnight-' + platform, 30000)) return;
    sayOnce(platform, raidNight.chatLine());
  } else if (cmd === '!challenges' || cmd === '!challenge') {
    if (onCooldown('!challenges-' + platform, 30000)) return;
    sayOnce(platform, challenges.chatLine());
  } else if (cmd === '!bp' || cmd === '!bloodpressure' || cmd === '!pressure') {
    if (!bp.S().on || onCooldown('!bp-' + platform, 20000)) return;
    sayOnce(platform, bp.chatLine());
  } else if (cmd === '!meltdown' || (cmd === '!bet' && /^(yes|no|y|n)$/i.test(parts[1] || ''))) {
    const a1 = (parts[1] || '').toLowerCase();
    if (!/^(yes|no|y|n)$/.test(a1)) { if (bp.S().bets && !onCooldown('!meltdown-' + platform, 20000)) { const B = bp.bets(); sayOnce(platform, 'Will the Boss hit MELTDOWN tonight? Type !meltdown yes or !meltdown no. Right = +1 card point. So far: ' + B.yes.length + ' yes, ' + B.nay.length + ' no.'); } return; }
    const r = bp.bet(v.key, v.display, a1[0] === 'y');
    if (r.error === 'already' && !onCooldown('!meltdown-late-' + platform, 30000)) sayOnce(platform, 'Too late: the Boss already had his meltdown tonight!');
    else if (r.ok && !onCooldown('!meltdown-ack-' + platform, 15000)) sayOnce(platform, 'Meltdown bets: ' + r.yes + ' say YES, ' + r.nay + ' say NO. Settled at the meltdown or the end of the stream.');
  } else if (cmd === '!calm' || cmd === '!chill' || cmd === '!breathe') {
    if (bp.calm(v.key, v.display) && !onCooldown('!calm-say-' + platform, 60000)) sayOnce(platform, v.display + ' tells the Boss to breathe... ' + bp.state().sys + '/' + bp.state().dia + ' (' + bp.state().level + ')');
  } else if (cmd === '!top' || /^!top\d+$/.test(cmd)) {
    // !top, !top 10, !top20, !top gifts / support / streaks / battles / watch / checkins
    const arg = (parts[1] || '').toLowerCase(), n = Math.max(3, Math.min(10, +(cmd.slice(4) || arg.replace(/\D/g, '')) || 5));
    const CAT = { gift: 'gifts', gifts: 'gifts', gifted: 'gifts', subs: 'gifts', support: 'support', supporters: 'support', bits: 'bits', streak: 'streaks', streaks: 'streaks', battle: 'battles', battles: 'battles', watch: 'watch', watchtime: 'watch', checkins: 'checkins', checkin: 'checkins', races: 'races' };
    const cat = CAT[arg] || 'cards';
    if (onCooldown('!top-' + platform + cat, 15000)) return;
    let line;
    if (cat === 'cards') {
      const top = store.all().filter((x) => !x.test && !x.isBroadcaster && hasCard(x)).map(card).sort((a, c) => c.ovr - a.ovr).slice(0, n);
      line = top.length ? 'Top cards: ' + top.map((c, i) => (i + 1) + '. ' + c.display + ' ' + String(c.tier || '').toUpperCase() + ' ' + c.ovr).join(' · ') : 'No cards yet: follow and chat to get yours!';
    } else {
      const b = lbRows(cat, LB_CATS[cat].allOnly ? 'all' : 'month', n);
      line = b.rows.length ? b.label + ' (' + String(b.periodLabel).toLowerCase() + '): ' + b.rows.map((r, i) => (i + 1) + '. ' + r.display + ' ' + r.value).join(' · ') : 'Nobody on the ' + b.label.toLowerCase() + ' board yet.';
    }
    sayOnce(platform, line);
  } else if (cmd === '!rules' || cmd === '!help' || cmd === '!commands' || cmd === '!howto') {
    if (onCooldown('!rules-' + platform + (parts[1] || ''), 30000)) return;
    const topic = (parts[1] || '').toLowerCase();
    const BITS = {
      card: 'Your card: 7 stats (watch, sub, support, chat, loyalty, raids, streak), average = your rating. Bronze, Silver 65+, Gold 75+, Legend 90+. Streams in a row boost every stat (3 = +1 up to 40 = +5). Type !card. Lurking? !here checks you in. Link platforms with !link.',
      battles: 'Type !join when a battle opens. SHOOTOUT: type L, C or R each kick, add T / B for top / bottom e.g. LT RB (no pick = miss); fans !boo !horn !flare !chant. RACE (8 trucks): drivers !turbo !dodge; fans !rain !wind !lightning !traffic (usually hits the leader). RAID: !fire !grenade !heal. Cheer bits with a name to help them.',
      tickets: 'Tickets are free: 2 per hour watching (more on 2-3 linked platforms at once), 2 per stream, bonus for streaks and battles. Max 15 a day. Type !tickets.',
      giveaway: 'Giveaways every Thursday, The Big One on the last Thursday. Follow + type !enter for a free entry, !enter 5 adds extra entries with tickets. Winner has 10 minutes to type !claim. No purchase needed.'
    };
    if (!GA_ON()) { delete BITS.tickets; delete BITS.giveaway; }
    const key = /card|stat|tier|link/.test(topic) ? 'card' : /battle|game|shoot|race|raid|queen/.test(topic) ? 'battles' : /ticket/.test(topic) ? 'tickets' : /give|draw|prize|comp|enter|win/.test(topic) ? 'giveaway' : null;
    const link = cfg.rulesUrl ? ' Full rules: ' + cfg.rulesUrl : '';
    say(platform, '@' + (e.display || e.login) + ' ' + (key && BITS[key] ? BITS[key] : GA_ON() ? 'Commands: !card !top !link !join !tickets !pot !giveaway !enter !claim. Type !rules card / battles / tickets / giveaway for a quick explainer.' : 'Commands: !card !top !link !here !join. Type !rules card or !rules battles for a quick explainer.') + link);
  } else if (cmd === '!tickets' || cmd === '!ticket') {
    if (onCooldown('tk-' + v.key, 20000)) return;
    const t = TK.tk(v);
    say(platform, '@' + (e.display || e.login) + ' you have ' + t.bal + ' tickets (' + t.today + '/' + TK.TICKETS.daily + ' earned today' + (t.streak > 1 ? ', ' + t.streak + '-stream streak' : '') +
      (v.nowOn && v.nowOn.length > 1 ? ', watching on ' + v.nowOn.length + ' platforms = faster tickets' : '') + '). Earn them by watching, turning up and playing battles.' + (v.followedAt ? '' : ' Follow the channel to enter giveaways!'));
  } else if (cmd === '!pot') {
    if (onCooldown('!pot', 30000)) return;
    const P = TK.potSettings(cfg), pot = TK.potState(store.data, cfg);
    say(platform, 'Prize pot: ' + TK.TIERS.map((T) => T.label + ' ' + P.currency + pot.tiers[T.id].toFixed(0) + '/' + T.max).join(' · ') + '. ' + P.share + '% of every sub, bit, Kick and Super Chat goes in!');
    showPot();
  } else if (cmd === '!enter') {
    const r = giveaways.enter(v, parseInt(parts[1], 10) || 0);
    if (platform !== 'youtube' || !onCooldown('yt-enter-' + v.key, 30000)) say(platform, '@' + (e.display || e.login) + ' ' + r.msg);
  } else if (cmd === '!claim') {
    giveaways.claim(v);
  } else if (cmd === '!giveaway') {
    if (onCooldown('!giveaway', 30000)) return;
    const g = giveaways.current();
    const { S, w, big, daysToBig } = schedInfo(now);
    const sched = S.on ? ' Schedule: ' + (w.slot === 'double' ? 'this week is DOUBLE TICKETS' : 'this week ' + (SC.LABEL[w.slot] || 'no draw') + ' on ' + fmtDay(w.drawDate)) + (big ? ' · The Big One (' + TK.potSettings(cfg).currency + S.prizes.gold.value + ') in ' + daysToBig + ' day' + (daysToBig === 1 ? '' : 's') : '') + '.' : '';
    say(platform, (g ? g.label + ': ' + g.prize + ' (' + TK.potSettings(cfg).currency + g.value + '). ' + (g.status === 'open' ? 'Type !enter to join, !enter 5 for extra entries.' : 'Entries closed.') : 'No giveaway open right now. Earn tickets by watching (!tickets), check the pot with !pot.') + sched);
    showSchedule();
  } else if (cmd === '!join') {
    battle.join(platform, e.login, e.display, parts.slice(1).join(' '));
    withAvatar(store.get(platform, e.login)).catch(() => {});
  } else if (cmd === '!link') {
    linkCommand(platform, e, v, (parts[1] || '').toUpperCase());
  } else if (cmd === '!confirm') {
    confirmLink(platform, e, v, parts.slice(1).join(' '));
  } else if (cmd === '!cancel') {
    cancelLink(platform, e, v);
  } else if (cmd === '!battle' && (v.isBroadcaster || v.isMod)) {
    const want = (parts[1] || '').toLowerCase();
    if (/^(pause|stop|hold|off)$/.test(want)) { pauseBattles(true); say(platform, 'Battles paused. Type !battle resume to start the countdown again.'); return; }
    if (/^(resume|unpause|go|on)$/.test(want)) { pauseBattles(false); say(platform, 'Battles back on. Next one in ' + Math.ceil(nextInMs() / 60000) + ' min.'); return; }
    if (want === 'delay') { const m = delayBattle(parts[2] || 5); say(platform, 'Next battle pushed back ' + m + ' min.'); return; }
    if (want === 'cancel') { battle.cancel(); return; }
    startBattle(/race|truck/.test(want) ? 'race' : /shoot|pen/.test(want) ? 'shootout' : /arc|raid|queen|topside|squad/.test(want) ? 'arc' : null);
  } else if ((cmd === '!lb' || cmd === '!leaderboard' || cmd === '!board') && (v.isBroadcaster || v.isMod)) {
    const a = (parts[1] || '').toLowerCase(), b2 = (parts[2] || '').toLowerCase();
    const kind = /sup|bit|sub|don|money|chat/.test(a) ? 'support' : 'battles';
    const period = /all|ever/.test(a + b2) ? 'all' : /month/.test(a + b2) ? 'month' : 'week';
    showBoard(kind, period);
  }
}

// ---------- linking accounts across platforms ----------
// 1. On platform A:  !link              → gets a one-use code (10 minutes)
// 2. On platform B:  !link CODE         → asks A to confirm
// 3. On platform A:  !confirm B-NAME    → both accounts now share one card
// Typing the other account's NAME means nobody can sneak onto a card when its owner types !confirm
// without reading. A code someone else grabbed is reported to its owner and the request is cancelled.
// Wrong codes are limited, every link is logged on the dashboard, and big tier gaps can need a mod.
const linkCodes = new Map();     // code → { key, platform, display, expires }
const linkPending = new Map();   // main card key → { fromKey, fromPlatform, fromDisplay, fromLogin, expires, code }
const usedCodes = new Map();     // code → { by, byPlatform, ownerKey, at }  (to warn the owner if someone else used it)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() { let c = ''; for (let i = 0; i < 5; i++) c += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)]; return c; }
function toast(text, sub, ms) { push({ type: 'toast', text, sub: sub || '', ms: ms || 9000 }); }
const LINK_TIER = { bronze: 0, silver: 1, gold: 2, legend: 3 };
const linkSettings = () => Object.assign({ modApproveGap: 0 }, cfg.linking || {});   // 0 = off, 2 = mod approves Bronze<->Gold or wider
const normName = (x) => String(x || '').toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
function logLink(entry) {
  const L = store.data.linkLog || (store.data.linkLog = []);
  L.push(Object.assign({ at: Date.now() }, entry));
  if (L.length > 300) L.splice(0, L.length - 300);
  store.save();
}

function linkCommand(platform, e, v, code) {
  const now = Date.now(), me = e.display || e.login;
  for (const [c, x] of linkCodes) if (x.expires < now) linkCodes.delete(c);
  for (const [c, x] of usedCodes) if (now - x.at > 30 * 60000) usedCodes.delete(c);
  if (!code) {
    if (onCooldown('link-' + v.key, 20000)) return;
    for (const [c, x] of linkCodes) if (x.key === v.key) linkCodes.delete(c);
    const c = newCode();
    linkCodes.set(c, { key: v.key, platform, display: me, expires: now + 10 * 60000 });
    sayOnce(platform, '@' + me + ' your link code is ' + c + '. On your other platform type: !link ' + c + ' (10 minutes, one use)', true);
    toast('LINK CODE for ' + me + ' (' + NAMES[platform] + '): ' + c, 'Type !link ' + c + ' on your other platform within 10 minutes', 45000);
    return;
  }
  // too many wrong codes: 3 per account per hour
  const tries = (v.linkTries || []).filter((t) => now - t < 3600000);
  if (tries.length >= 3) return sayOnce(platform, '@' + me + ' too many wrong link codes. Try again in an hour, or ask a mod.');
  const entry = linkCodes.get(code);
  if (!entry) {
    const used = usedCodes.get(code);
    if (used && used.by !== v.key) {
      // someone else typed this code first: warn the owner and cancel whatever they asked for
      const pend = linkPending.get(used.ownerKey);
      if (pend && pend.code === code) linkPending.delete(used.ownerKey);
      usedCodes.delete(code);
      logLink({ kind: 'sniped', owner: used.ownerDisplay, ownerPlatform: used.ownerPlatform, by: used.byDisplay, byPlatform: used.byPlatform });
      sayOnce(used.ownerPlatform, '@' + used.ownerDisplay + ' careful: your link code was used by ' + used.byDisplay + ' on ' + NAMES[used.byPlatform] + ' before you. That request is cancelled. Type !link for a new code and do NOT confirm anyone else.');
      return sayOnce(platform, '@' + me + ' that code was already used by someone else, so it has been cancelled. Type !link on your other platform for a new one.');
    }
    v.linkTries = tries.concat(now); store.save();
    return sayOnce(platform, '@' + me + ' that link code is wrong or expired. Type !link on your other platform to get a new one.');
  }
  if (entry.platform === platform) return sayOnce(platform, '@' + me + ' type that code on your OTHER platform, not this one.');
  if (entry.key === v.key || store.primary(v) === store.primary(store.data.viewers[entry.key])) { linkCodes.delete(code); return sayOnce(platform, '@' + me + ' these accounts are already linked.'); }
  linkCodes.delete(code);
  usedCodes.set(code, { by: v.key, byDisplay: me, byPlatform: platform, ownerKey: entry.key, ownerDisplay: entry.display, ownerPlatform: entry.platform, at: now });
  linkPending.set(entry.key, { fromKey: v.key, fromPlatform: platform, fromDisplay: me, fromLogin: e.login, expires: now + 5 * 60000, code });
  sayOnce(platform, '@' + me + ' almost done! Now on ' + NAMES[entry.platform] + ' (as ' + entry.display + ') type: !confirm ' + me);
  sayOnce(entry.platform, '@' + entry.display + ' "' + me + '" on ' + NAMES[platform] + ' wants to join your card. ONLY if that is your own account, type: !confirm ' + me + '   (not you? type !cancel)', true);
  toast(entry.display + ': type !confirm ' + me + ' on ' + NAMES[entry.platform], 'only if ' + me + ' on ' + NAMES[platform] + ' is your own account', 30000);
}

function cancelLink(platform, e, v) {
  const p = linkPending.get(v.key);
  for (const [c, x] of linkCodes) if (x.key === v.key) linkCodes.delete(c);
  if (!p) return;
  linkPending.delete(v.key);
  logLink({ kind: 'cancelled', owner: e.display || e.login, ownerPlatform: platform, by: p.fromDisplay, byPlatform: p.fromPlatform });
  sayOnce(platform, '@' + (e.display || e.login) + ' link request from ' + p.fromDisplay + ' cancelled.');
}

function confirmLink(platform, e, v, name) {
  const p = linkPending.get(v.key), me = e.display || e.login;
  if (!p || p.expires < Date.now()) { linkPending.delete(v.key); return; }
  if (!name) return sayOnce(platform, '@' + me + ' type the other account\'s name to confirm: !confirm ' + p.fromDisplay + ' (only if it is yours)');
  if (normName(name) !== normName(p.fromDisplay) && normName(name) !== normName(p.fromLogin)) return sayOnce(platform, '@' + me + ' that name doesn\'t match. The request is from "' + p.fromDisplay + '" on ' + NAMES[p.fromPlatform] + '. If that isn\'t you, type !cancel.');
  // big tier gap: a mod approves it on the dashboard (optional)
  const S = linkSettings(), a = card(store.primary(v)), b = card(store.primary(store.data.viewers[p.fromKey]));
  if (S.modApproveGap > 0 && Math.abs(LINK_TIER[a.tier] - LINK_TIER[b.tier]) >= S.modApproveGap) {
    linkPending.delete(v.key);
    const Q = store.data.linkQueue || (store.data.linkQueue = []);
    Q.push({ id: Date.now().toString(36), at: Date.now(), mainKey: v.key, main: me, mainPlatform: platform, fromKey: p.fromKey, from: p.fromDisplay, fromPlatform: p.fromPlatform, mainTier: a.tier, fromTier: b.tier });
    store.save();
    logLink({ kind: 'waiting', owner: me, ownerPlatform: platform, by: p.fromDisplay, byPlatform: p.fromPlatform });
    return sayOnce(platform, '@' + me + ' thanks! Because the two cards are very different tiers, a mod will approve this link shortly.');
  }
  linkPending.delete(v.key);
  finishLink(v.key, p.fromKey, { owner: me, ownerPlatform: platform, by: p.fromDisplay, byPlatform: p.fromPlatform }, [platform, p.fromPlatform]);
}
function finishLink(mainKey, fromKey, info, platforms) {
  const res = linkAccounts(mainKey, fromKey);
  if (!res) return null;
  logLink(Object.assign({ kind: 'linked', mainKey, fromKey }, info));
  const msg = 'Cards linked! ' + res.display + ' now has one card across ' + res.platforms.map((x) => NAMES[x]).join(' + ') + ': ' + res.tier.toUpperCase() + ' ' + res.ovr;
  for (const pf of new Set(platforms || [])) sayOnce(pf, msg);
  return res;
}

// merges card `sKey` into card `pKey`; `sKey`'s account(s) become aliases of `pKey`
function linkAccounts(pKey, sKey) {
  const all = store.data.viewers;
  const p = store.primary(all[pKey]), s = store.primary(all[sKey]);
  if (!p || !s || p.key === s.key) return null;
  S.migrate(p); S.migrate(s);
  const now = Date.now();
  S.decay(p, R, now); S.decay(s, R, now);
  S.merge(p, s, R);
  for (const a of store.aliases()) if (a.aliasOf === s.key) a.aliasOf = p.key;
  all[s.key] = { key: s.key, platform: s.platform, login: s.login, display: s.display, aliasOf: p.key, linkedAt: now, avatar: s.avatar || null };
  store.save();
  const c = card(p);
  push({ type: 'show', card: c, note: 'CARDS LINKED', why: c.platforms.map((x) => NAMES[x]).join(' + ') + ' · one card from now on' });
  return c;
}

// splits an account back off (its past activity stays on the main card; it starts a fresh card)
function unlinkAccount(aliasKey) {
  const a = store.data.viewers[aliasKey];
  if (!a || !a.aliasOf) return false;
  const p = store.primary(a);
  delete store.data.viewers[aliasKey];
  const { v } = store.upsert(a.platform, a.login, a.display);
  if (a.avatar) v.avatar = a.avatar;
  if (p) {
    p.links = (p.links || []).filter((k) => k !== aliasKey);
    const rest = store.aliases().filter((x) => x.aliasOf === p.key && x.key !== aliasKey).map((x) => x.platform);
    p.platforms = Array.from(new Set([p.platform].concat(rest)));
  }
  store.save();
  return true;
}

function linkedInfo(c) {
  return Object.assign(c, { linked: store.aliases().filter((a) => a.aliasOf === c.key).map((a) => ({ key: a.key, platform: a.platform, display: a.display })) });
}

// ---------- prize pot + giveaways ----------
let lastPotShow = 0;
function potIn(value, why) {
  if (!GA_ON()) return;
  const add = TK.potAdd(store.data, cfg, value, why);
  if (!add) return;
  store.save();
  // show the pot meter on stream, at most once a minute
  if (Date.now() - lastPotShow > 60000) { lastPotShow = Date.now(); showPot(why); }
}
function showPot(why) {
  const P = TK.potSettings(cfg), pot = TK.potState(store.data, cfg), g = giveaways.current();
  push({ type: 'pot', currency: P.currency, why: why || '', tiers: TK.TIERS.map((T) => ({ id: T.id, label: T.label, have: +pot.tiers[T.id].toFixed(2), max: T.max })), total: +pot.total.toFixed(2), live: g ? g.label : null });
}
const giveaways = new TK.Giveaways({
  data: store.data, cfg: () => cfg, save: () => store.save(), push,
  viewer: (key) => store.data.viewers[key], card: (v) => card(v), say: sayAll
});
TK.setEnabled(GA_ON);
TK.setStreakRules(() => R.cards);
TK.setMissed((a, b) => { try { return safety.missed(a, b); } catch (e) { return b - a - 1; } });
TK.setMult((now) => (SC.isDoubleWeek(now, SC.settings(cfg)) ? 2 : 1));

// ---------- weekly giveaway schedule ----------
// Every minute while live: open this week's draw (from the first stream of the week, or on draw day),
// remind chat, and show what's coming. The draw itself is pressed by you at the end of the stream.
const fmtDay = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
function schedInfo(now) {
  const S = SC.settings(cfg), w = SC.thisWeek(now, S), big = SC.nextBigOne(now, S);
  return { S, w, big, daysToBig: big ? Math.max(0, Math.ceil((big.at - new Date(new Date(now).toDateString()).getTime()) / 86400000)) : null };
}
function showSchedule() {
  const { S, w, big, daysToBig } = schedInfo(Date.now());
  if (!S.on) return;
  const P = TK.potSettings(cfg), pr = w.slot && S.prizes[w.slot];
  push({ type: 'giveaway', phase: 'schedule', slot: w.slot, label: SC.LABEL[w.slot] || 'No draw this week', prize: pr ? pr.prize : '', value: pr ? pr.value : 0, currency: P.currency,
    drawDay: fmtDay(w.drawDate), isToday: w.drawDate === new Date().toISOString().slice(0, 10), bigDay: big ? fmtDay(big.date) : '', daysToBig, bigPrize: S.prizes.gold.prize, bigValue: S.prizes.gold.value });
}
let schedShownStream = 0, lastRemind = 0;
setInterval(() => {
  const now = Date.now(), { S, w } = schedInfo(now);
  if (!GA_ON() || !S.on || !isLive()) return;
  store.data.sched = store.data.sched || {};
  const rec = store.data.sched[w.week] || (store.data.sched[w.week] = {});
  // show the week's plan once per stream, a couple of minutes in
  if (schedShownStream !== streamNo() && liveMs > 120000) { schedShownStream = streamNo(); showSchedule(); if (w.slot === 'double') sayAll('DOUBLE TICKETS WEEK! Everyone earns tickets twice as fast until ' + fmtDay(w.drawDate) + '. The Big One is coming: !tickets to check yours.'); }
  // open this week's draw
  const today = new Date(now).toISOString().slice(0, 10);
  if (w.slot && w.slot !== 'double' && !rec.opened && !giveaways.current() && (S.openMode === 'week' || today >= w.drawDate)) {
    rec.opened = true;
    const pr = S.prizes[w.slot] || {};
    try {
      giveaways.create({ tier: w.slot, prize: pr.prize, value: pr.value, scheduled: w.week, drawDate: w.drawDate, fromBudget: true });
      rec.id = giveaways.current().id; rec.error = null;
      sayAll('This week\'s draw is the ' + SC.LABEL[w.slot] + ', drawn ' + (today === w.drawDate ? 'at the end of tonight\'s stream' : 'on ' + fmtDay(w.drawDate)) + '.');
    } catch (e) { rec.error = e.message; console.log('[schedule] ' + e.message); }
    store.save();
  }
  // reminders while it's open
  const g = giveaways.current();
  if (g && g.status === 'open' && now - lastRemind > S.remindMins * 60000 && liveMs > 300000) {
    lastRemind = now;
    sayAll(g.label + ' is open: ' + g.prize + (today === (g.drawDate || today) ? '. Drawn at the END of tonight\'s stream' : '. Drawn ' + fmtDay(g.drawDate)) + '! Type !enter (free for followers), !enter 5 for extra entries with tickets.');
  }
}, 60000);

// ---------- platform events (identical handling for every platform) ----------
function wire(src, platform) {
  src.on('follow', (e) => update(platform, e.login, e.display, (v) => { if (!v.followedAt) { v.followedAt = e.at; streamLog.event('follow', 1, v.key, { who: e.display || e.login }); } },
    { pack: true, alert: true, kind: 'follow', reason: platform === 'youtube' ? 'Subscribed to the channel' : 'Followed the channel' }));
  src.on('sub', (e) => {
    battle.boost(platform, e.login, 5);
    if (!e.isGift) potIn(TK.potSettings(cfg).subValue, (e.display || e.login) + ' subscribed');
    update(platform, e.login, e.display, (v, now) => {
      if (e.avatar && !v.avatar) v.avatar = e.avatar;
      v.subMonths = (v.subMonths || 0) + 1; v.lastSubAt = now; setSub(v, platform, e);
      // v29: a gifted sub is already counted (and paid for) in the gifter's 'gift' event: counting it again here doubled the money
      if (!e.isGift) { streamLog.event('sub', 1, v.key, { tier: v.subTier, prime: v.subPrime, who: e.display || e.login }); earnAdd(v, platform, 'sub', 1, v.subPrime ? 'prime' : (v.subTier || 1)); logSup(v, 'sub', 1); }
      S.addXp(v, 'SUB', tierMonths(v.subTier), R, true, now);
    }, { alert: true, kind: e.isGift ? 'giftsub' : 'sub', reason: e.label || (e.isGift ? 'Received a gifted sub' : 'Subscribed') });
  });
  src.on('resub', (e) => {
    battle.boost(platform, e.login, 5);
    potIn(TK.potSettings(cfg).subValue, (e.display || e.login) + ' resubbed');
    update(platform, e.login, e.display, (v, now) => {
      if (e.avatar && !v.avatar) v.avatar = e.avatar;
      const prev = v.subMonths || 0;
      v.subMonths = Math.max(prev, e.months);
      v.lastSubAt = now; setSub(v, platform, e);
      streamLog.event('sub', 1, v.key, { tier: v.subTier, prime: v.subPrime, who: e.display || e.login }); earnAdd(v, platform, 'sub', 1, v.subPrime ? 'prime' : (v.subTier || 1));
      S.addXp(v, 'SUB', Math.max(0, v.subMonths - prev) * tierMonths(v.subTier), R, true, now);
      logSup(v, 'sub', 1);
    }, { alert: true, kind: 'resub', amount: e.months, reason: (e.label || 'Resubbed') + ' · month ' + e.months });
  });
  src.on('subinfo', (e) => {
    const key = store.resolveKey(platform, e.login), v = key && store.data.viewers[key];
    if (v) { v.subTier = e.tier || v.subTier || 1; v.subPrime = !!e.prime; v.subGifted = !!e.gifted; v.subPlatform = platform; store.save(); }
  });
  src.on('gift', (e) => {
    // v35: anonymous gifts: money + stats only (no card for "an anonymous gifter")
    if (e.anonymous) { potIn(TK.potSettings(cfg).subValue * e.total, 'Anonymous gift x' + e.total); streamLog.event('gift', e.total, null, { who: 'Anonymous' }); try { earnings.add(platform, 'gift', e.total, e.tier || 1); } catch (x) { /* ignore */ } feedAdd('Anonymous gift: ' + e.total + ' sub' + (e.total === 1 ? '' : 's'), '#c58bff'); return; }
    battle.boost(platform, e.login, Math.min(10, 5 * e.total));
    // a big gift: clip the moment (the alert and your reaction) for the clip list
    if (replay.S().on && replay.S().autoGifts && e.total >= replay.S().giftMin && isLive()) setTimeout(() => replayNow({ label: 'GIFT BOMB · ' + String(e.display || e.login).toUpperCase() + ' x' + e.total, auto: true }).catch(() => {}), 9000);
    potIn(TK.potSettings(cfg).subValue * e.total, (e.display || e.login) + ' gifted ' + e.total);
    update(platform, e.login, e.display, (v, now) => {
      if (e.avatar && !v.avatar) v.avatar = e.avatar;
      // gift subs fill SUPPORT (worth more than their cash value, because they bring new people in)
      v.giftedSubs = (v.giftedSubs || 0) + e.total; S.addXp(v, 'SUP', e.total * R.cards.giftSup * tierMonths(e.tier), R, false, now);
      // Twitch tells us their all-time total for the channel: older gifts (before the cards) become the base
      if (e.cumulative != null && e.cumulative > S.giftsAllTime(v)) v.giftsBase = e.cumulative - (v.giftedSubs || 0);
      logSup(v, 'gift', e.total); streamLog.event('gift', e.total, v.key, { who: e.display || e.login }); earnAdd(v, platform, 'gift', e.total, e.tier || 1);
    }, { alert: true, always: true, gift: giftInfo, kind: e.total >= 5 ? 'giftbomb' : 'gift', amount: e.total, reason: 'Gifted ' + e.total + (platform === 'youtube' ? ' membership' : ' sub') + (e.total === 1 ? '' : 's') });
  });
  // bits (Twitch), Kicks (Kick) and Super Chats/Stickers (YouTube, converted at $1 = 100) all feed SUP (support)
  src.on('cheer', (e) => {
    if (e.anonymous) { streamLog.event('bits', e.bits, null, { who: 'Anonymous' }); try { earnings.add(platform, 'bits', e.bits); } catch (x) { /* ignore */ } feedAdd('Anonymous cheer: ' + e.bits + ' bits', '#9146ff'); return; }
    battle.boost(platform, e.login, Math.floor(e.bits / 100), e.text || ' ');
    potIn(TK.potSettings(cfg).per100Value * e.bits / 100, (e.display || e.login) + ' sent ' + e.bits + (platform === 'kick' ? ' Kicks' : platform === 'youtube' ? ' (Super Chat)' : ' bits'));
    update(platform, e.login, e.display, (v, now) => {
      if (e.avatar && !v.avatar) v.avatar = e.avatar;
      v.bits = (v.bits || 0) + e.bits; S.addXp(v, 'SUP', e.bits, R, false, now);
      if (platform === 'twitch') v.twBits = (v.twBits == null ? ((v.cheers && v.cheers.bits) || 0) : v.twBits) + e.bits;
      logSup(v, platform === 'kick' ? 'kicks' : platform === 'youtube' ? 'superchat' : 'bits', e.bits);
      streamLog.event(platform === 'kick' ? 'kicks' : platform === 'youtube' ? 'sc' : 'bits', e.bits, v.key, { who: e.display || e.login }); earnAdd(v, platform, platform === 'kick' ? 'kicks' : platform === 'youtube' ? 'sc' : 'bits', e.bits);
    }, { alert: !e.silent, kind: platform === 'kick' ? 'kicks' : platform === 'youtube' ? 'superchat' : 'bits', amount: e.bits, reason: e.reason || ('Cheered ' + e.bits + ' bits') });
  });
  src.on('raid', (e) => update(platform, e.login, e.display, (v, now) => {
    if (e.viewers >= R.raidMinViewers) { v.raids = (v.raids || 0) + 1; S.addXp(v, 'RAI', 1, R, false, now); }
    streamLog.event('raid', e.viewers || 0, v.key, { who: e.display || e.login });
  }, { alert: true, kind: 'raid', amount: e.viewers, reason: (platform === 'kick' ? 'Hosted' : 'Raided') + ' with ' + e.viewers + ' viewers' }));
  src.on('chat', (e) => onChat(platform, e).catch((err) => console.error('[chat]', err)));
  src.on('ban', (e) => onBanned(platform, e));
  // v33: the giveaway meter counts these too
  src.on('follow', (e) => { try { gmeter.event('follow', 1, e.display || e.login); } catch (x) { /* ignore */ } });
  src.on('sub', (e) => { try { if (!e.isGift) gmeter.event('sub', 1, e.display || e.login); } catch (x) { /* ignore */ } });
  src.on('resub', (e) => { try { gmeter.event('sub', 1, e.display || e.login); } catch (x) { /* ignore */ } });
  src.on('gift', (e) => { try { gmeter.event('gift', e.total || 1, e.display || e.login); } catch (x) { /* ignore */ } });
  src.on('cheer', (e) => { try { gmeter.event('bits', e.bits || 0, e.display || e.login); } catch (x) { /* ignore */ } });
  src.on('whisper', (e) => battle.chatInput(platform, e.login, e.text));
}
for (const [k, p] of Object.entries(PLATFORMS)) wire(p, k);

// ---------- sharing the screen with Tangia + Streamlabs ----------
// When one of them is playing (OBS hears its sound, or a channel point was just redeemed), our cards wait.
let redeemUntil = 0, alertBusy = false, busySince = 0;
function bpRage(title, by) { const S = bp.S(); if (!S.on || !S.rageRedeem || !/\b(rage|blood ?pressure|wind (him|the boss) up|tilt the boss|annoy the boss)\b/i.test(title || '')) return false; bp.add(S.rageAmount, by + ': ' + String(title).slice(0, 24), by); return true; }
twitch.on('redeem', (e) => { try { bpRage(e.reward, e.display || e.login); } catch (err) { /* ignore */ } try { rewards.handle(e.reward, e.display || e.login, 'twitch', 'points'); } catch (err) { console.error('[rewards]', err.message); } });
twitch.on('cheer', (e) => { if (!/^Power-up/.test(e.reason || '') && !e.tangia) camBuy('bits', e.bits, e.display || e.login); try { bp.bits(e.bits || 0, e.text, e.display || e.login); } catch (err) { /* ignore */ } });
twitch.on('powerup', (e) => { try { bpRage(e.title, e.display || e.login); } catch (err) { /* ignore */ } try { rewards.handle(e.title, e.display || e.login, 'twitch', 'powerup', { cost: e.bits ? e.bits + ' bits' : null }); } catch (err) { console.error('[rewards]', err.message); } });
twitch.on('redeem', () => { const A = screenSettings().alerts; if (A.on && A.wait) redeemUntil = Date.now() + A.redeemSecs * 1000; });
setInterval(() => {
  const A = screenSettings().alerts, now = Date.now();
  let who = null;
  if (A.on && A.wait) { const a = obs.ready ? obs.alertPlaying(A.holdSecs * 1000) : null; who = a ? a.kind : now < redeemUntil ? 'tangia' : null; }
  let busy = !!who;
  if (busy && !alertBusy) busySince = now;
  if (busy && now - busySince > A.maxWaitSecs * 1000) busy = false;   // never hold cards forever
  if (busy !== alertBusy) { alertBusy = busy; push({ type: 'alertBusy', busy, who }); }
}, 300).unref();
setInterval(async () => {
  try { if (obs.ready) { const before = JSON.stringify(obs.alertList.map((a) => [a.name, a.rect && Math.round(a.rect.x), a.full])); await obs.findAlerts(screenSettings().alerts.names); if (JSON.stringify(obs.alertList.map((a) => [a.name, a.rect && Math.round(a.rect.x), a.full])) !== before) pushScreen(); } } catch (e) { /* OBS busy */ }
}, 30000).unref();
setTimeout(() => { if (obs.ready) obs.findAlerts(screenSettings().alerts.names).then(pushScreen).catch(() => {}); }, 4000);

// ---------- watch time: every 5 minutes ----------
// Each person is credited ONCE per 5 minutes, then multiplied if they're watching on 2 or 3 platforms at once
// (linked cards only). Twitch shares its viewer list (lurkers count); on Kick and YouTube a chat message
// counts as being there for the next 15 minutes.
const WATCH_MULT = [1, 1.25, 1.5];
setInterval(async () => {
  if (!isLive()) return;
  const present = new Map();   // primary key -> Set(platforms)
  const mark = (v, pf) => { if (!v) return; if (!present.has(v.key)) present.set(v.key, new Set()); present.get(v.key).add(pf); };
  if (twitch.live && twitch.user && twitch.connected) {
    try {
      for (const c of await twitch.chatters()) {
        if (c.login === twitch.user.login) continue;
        const { v } = store.upsert('twitch', c.login, c.display);
        mark(store.primary(v), 'twitch');
      }
    } catch (e) { console.error('[watch]', e.message); }
  }
  const cutoff = Date.now() - 15 * 60000;
  for (const v of store.all()) for (const pf of ['twitch', 'kick', 'youtube']) if (v.seenOn && (v.seenOn[pf] || 0) > cutoff) mark(v, pf);
  for (const [key, set] of present) {
    const v0 = store.data.viewers[key]; if (!v0) continue;
    const n = Math.min(3, set.size);
    await update(v0.platform, v0.login, null, (v, now) => {
      v.watchMinutes = (v.watchMinutes || 0) + 5; streamLog.event('watch', 5, v.key);
      // v35: watch time this stream (for the giveaway watch-time rule and !watchtime)
      if (v.swNo !== streamNo()) { v.swNo = streamNo(); v.swMins = 0; } v.swMins = (v.swMins || 0) + 5;
      S.addXp(v, 'WAT', 5 * WATCH_MULT[n - 1], R, false, now);
      attend(v, now);
      TK.watched(v, 5, n, now);
      if (n >= 2 && v.multiStreamNo !== streamNo()) { v.multiStreamNo = streamNo(); v.multiStreams = (v.multiStreams || 0) + 1; }
      v.nowOn = Array.from(set);
    }, {});
  }
}, 5 * 60000);

// ---------- upkeep ----------
function upkeep() {
  const now = Date.now();
  for (const v of store.all()) { S.migrate(v); S.decay(v, R, now); S.releaseBank(v, R, now); }
  store.save();
  saveCfg();
}
upkeep();
setInterval(upkeep, 60 * 60000);

// Twitch game category (used to pick shootout vs truck race)
async function twitchGame() {
  if (!twitch.user || !twitch.connected) return;
  try { const j = await twitch.api('GET', '/channels?broadcaster_id=' + twitch.user.id); twitch.game = (j.data[0] && j.data[0].game_name) || null; } catch (e) { /* ignore */ }
}
setInterval(twitchGame, 5 * 60000);
setTimeout(twitchGame, 15000);
twitch.on('online', twitchGame);

async function syncSubs() {
  if (!twitch.user || !twitch.connected) return 0;
  const now = Date.now();
  let n = 0;
  for (const s of await twitch.subscriptions()) {
    if (s.user_id === twitch.user.id) continue;
    const { v } = store.upsert('twitch', s.user_login, s.user_name);
    S.migrate(v);
    v.subTier = s.tier === '3000' ? 3 : s.tier === '2000' ? 2 : 1; v.subGifted = !!s.is_gift; v.subPlatform = 'twitch';
    if (!v.subMonths) { v.subMonths = 1; S.addXp(v, 'SUB', tierMonths(v.subTier), R, true, now); }
    v.lastSubAt = now;
    n++;
  }
  store.save();
  return n;
}
setInterval(() => syncSubs().catch((e) => console.error('[subs]', e.message)), 6 * 3600000);

let importState = { running: false, result: null };
async function importTwitch() {
  if (!twitch.user || !twitch.connected) throw new Error('Connect Twitch first.');
  importState = { running: true, result: null };
  const now = Date.now();
  const res = { followers: 0, subs: 0, cheerers: 0 };
  try {
    for (const f of await twitch.followers()) {
      const { v } = store.upsert('twitch', f.user_login, f.user_name);
      S.migrate(v);
      const at = Date.parse(f.followed_at);
      if (at && (!v.followedAt || at < v.followedAt)) v.followedAt = at;
      if (!v.lastSeen) v.lastSeen = now;
      res.followers++;
    }
    res.subs = await syncSubs();
    for (const l of await twitch.bitsLeaders()) {
      const { v } = store.upsert('twitch', l.user_login, l.user_name);
      S.migrate(v);
      const diff = (l.score || 0) - (v.bits || 0);
      if (diff > 0) { v.bits = l.score; S.addXp(v, 'SUP', diff, R, true, now); }
      res.cheerers++;
    }
    store.save();
    importState = { running: false, result: res };
  } catch (e) {
    importState = { running: false, result: { error: e.message } };
    throw e;
  }
  return res;
}

// keep Twitch followers up to date by itself (so long-time followers have their card without pressing Import)
let followSyncAt = 0, followSyncT = null;
async function syncFollowers() {
  if (!twitch.user || !twitch.connected) return 0;
  followSyncAt = Date.now(); let n = 0;
  try {
    for (const f of await twitch.followers()) {
      const { v } = store.upsert('twitch', f.user_login, f.user_name); S.migrate(v);
      const at = Date.parse(f.followed_at);
      if (at && (!v.followedAt || at < v.followedAt)) { v.followedAt = at; n++; }
    }
    if (n) store.save();
  } catch (e) { console.log('Follower check failed: ' + e.message); }
  return n;
}
function followSyncSoon() { if (followSyncT || Date.now() - followSyncAt < 5 * 60000) return; followSyncT = setTimeout(() => { followSyncT = null; syncFollowers(); }, 3000); }
setInterval(() => { if (gateS().on) syncFollowers(); }, 30 * 60000).unref();
setTimeout(() => { if (gateS().on) syncFollowers(); }, 20000).unref();

// "paste a list" import for Kick and YouTube (they don't offer follower lists to apps)
function importList(platform, text, kind) {
  const now = Date.now();
  let n = 0;
  for (const raw of String(text || '').split(/[\n,;\t]+/)) {
    const name = raw.trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9_.\-]{2,40}$/.test(name)) continue;
    const { v } = store.upsert(platform, name, name);
    S.migrate(v);
    if (!v.followedAt) v.followedAt = now;
    if (kind === 'subs') { if (!v.subMonths) { v.subMonths = 1; S.addXp(v, 'SUB', 1, R, true, now); } v.lastSubAt = now; }
    if (!v.lastSeen) v.lastSeen = now;
    n++;
  }
  store.save();
  return n;
}

// ---------- web server ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const PAGES = { '/gmeter': 'gmeter.html', '/gmeter.js': 'gmeter.js', '/brb': 'brb.html', '/bigcam': 'bigcam.html', '/music.js': 'music.js', '/links.js': 'links.js', '/stinger.js': 'stinger.js', '/': 'dashboard.html', '/overlay': 'overlay.html', '/credits': 'credits.html', '/card.js': 'card.js', '/card.css': 'card.css', '/sfx.js': 'sfx.js',
  '/race.js': 'race.js', '/scene3d.js': 'scene3d.js', '/penalty.js': 'penalty.js', '/teampens.js': 'teampens.js', '/bp.js': 'bp.js', '/starting': 'starting.html', '/ballon': 'ballon.html', '/spin': 'spin.html', '/spin.js': 'spin.js', '/arc.js': 'arc.js', '/alerts.js': 'alerts.js', '/textures.js': 'textures.js', '/giveaway.js': 'giveaway.js', '/hud.js': 'hud.js', '/challenges.js': 'challenges.js', '/camfx.js': 'camfx.js', '/boards.js': 'boards.js', '/raidnight.js': 'raidnight.js', '/landmarks.js': 'landmarks.js', '/screen.js': 'screen.js', '/extras.js': 'extras.js', '/broadcast.js': 'broadcast.js', '/scenes': 'scenes.html', '/teeth-tracker': 'teeth.html', '/dock': 'dock.html', '/analysis': 'analysis.html', '/draw.js': 'draw.js', '/stadium3d.js': 'stadium3d.js', '/kits.js': 'kits.js', '/pen3d.js': 'pen3d.js' };
// your own textures / sounds: the user folder first, then the ones that come with the app
const TEX_DIRS = [...new Set([path.join(HOME, 'textures'), path.join(ROOT, 'textures')])];
const IMG = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const SOUND_DIRS = [...new Set([path.join(HOME, 'sounds'), path.join(ROOT, 'sounds')])];
const listDirs = (dirs, ok) => { const L = []; for (const d of dirs) { try { for (const f of fs.readdirSync(d)) if (ok(f) && !L.includes(f)) L.push(f); } catch (e) { /* no folder */ } } return L; };
const findIn = (dirs, name) => { for (const d of dirs) { const f = path.join(d, name); if (fs.existsSync(f)) return f; } return null; };
const AUDIO = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const oauthStates = new Map();

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 16e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } });
  });
}

function testEvent(platform, type, n) {
  const p = PLATFORMS[platform];
  const amount = { twitch: 'Cheered 1000 bits', kick: 'Gifted 1000 Kicks', youtube: 'Super Chat $10.00' }[platform];
  const T = {
    follow: () => p.emit('follow', { login: n, display: n, at: Date.now() }),
    sub: () => p.emit('sub', { login: n, display: n, isGift: false }),
    resub12: () => p.emit('resub', { login: n, display: n, months: 12 }),
    gift5: () => p.emit('gift', { login: n, display: n, total: 5 }),
    cheer1000: () => p.emit('cheer', { login: n, display: n, bits: 1000, text: '', reason: amount }),
    raid20: () => p.emit('raid', { login: n, display: n, viewers: 20 }),
    card: () => { cooldown.delete(store.resolveKey(platform, n)); lastCardShown = 0; return onChat(platform, { login: n, display: n, text: '!card', badges: [] }, true); },
    // Raid Night: a squad enlists and shoots the drone
    raidsquad: async () => { for (const x of [n, 'RustRat', 'MagnetMo', 'GearGrinder', 'ZipLineZoe', 'CopperKid']) { await onChat(platform, { login: x, display: x, text: '!enlist', badges: [] }, true); await onChat(platform, { login: x, display: x, text: '!shoot', badges: [] }, true); } },
    // first words of the stream: a few viewers say hello (check-in strip)
    hello: async () => { for (const x of [n, 'RustRat', 'MagnetMo', 'GearGrinder', 'NewFan' + Math.floor(Math.random() * 99)]) { const v = store.getRaw(platform, x); if (v) delete v.checkinNo; await onChat(platform, { login: x, display: x, text: 'hello chat', badges: [] }, true); } },
    // simulates the full !link flow: this platform + the next one, same name
    link: async () => {
      const other = platform === 'twitch' ? 'kick' : platform === 'kick' ? 'youtube' : 'twitch';
      if (!store.getRaw(other, n)) store.upsert(other, n, n).v.test = true;
      cooldown.delete('link-' + store.resolveKey(platform, n));
      await onChat(platform, { login: n, display: n, text: '!link', badges: [] }, true);
      const code = Array.from(linkCodes.entries()).find(([, x]) => x.key === store.resolveKey(platform, n));
      if (!code) return;
      await onChat(other, { login: n, display: n, text: '!link ' + code[0], badges: [] }, true);
      await onChat(platform, { login: n, display: n, text: '!confirm ' + n, badges: [] }, true);
    },
    // someone else grabs the code first: the owner should be warned and nothing links
    snipe: async () => {
      const other = platform === 'twitch' ? 'kick' : 'twitch', thief = 'Sn1per' + n.slice(0, 6);
      if (!store.getRaw(other, n)) store.upsert(other, n, n).v.test = true;
      if (!store.getRaw(other, thief)) store.upsert(other, thief, thief).v.test = true;
      cooldown.delete('link-' + store.resolveKey(platform, n));
      await onChat(platform, { login: n, display: n, text: '!link', badges: [] }, true);
      const code = Array.from(linkCodes.entries()).find(([, x]) => x.key === store.resolveKey(platform, n));
      if (!code) return;
      await onChat(other, { login: thief, display: thief, text: '!link ' + code[0], badges: [] }, true);
      await onChat(platform, { login: n, display: n, text: '!confirm', badges: [] }, true);              // careless confirm: refused (needs the name)
      await onChat(platform, { login: n, display: n, text: '!confirm ' + n, badges: [] }, true);         // wrong name: refused
      await onChat(other, { login: n, display: n, text: '!link ' + code[0], badges: [] }, true);         // real owner tries: warned, cancelled
    }
  };
  return T[type];
}

function testBattle(mode) {
  if (battle.phase !== 'idle') return false;
  const names = mode === 'race' ? [['twitch', 'TestTrucker'], ['kick', 'KickHauler'], ['youtube', 'YTRoadKing'], ['twitch', 'DieselDan'], ['kick', 'GearJammer'], ['youtube', 'MooseMagnet'], ['twitch', 'NightOwlHaul'], ['kick', 'RedLineRita']]
    : mode === 'arc' ? ['ScrapperSam', 'RustRat', 'TopsideTess', 'LootGoblin', 'ArcHunter', 'SperanzaSue', 'BoltBetty', 'GearGrinder', 'DustDevil', 'CopperKid', 'ZipLineZoe', 'MagnetMo']
      .map((n, i) => [['twitch', 'kick', 'youtube'][i % 3], n])
      : [['twitch', 'TestStriker'], ['kick', 'KickKeeper']];
  if (!battle.open(mode, () => { lastBattleLive = liveMs; })) return false;
  for (const [pl, n] of names) { const { v } = store.upsert(pl, n, n); v.test = true; }
  setTimeout(() => names.forEach(([pl, n]) => battle.join(pl, n, n)), 1500);
  clearTimeout(battle.timer);
  battle.timer = setTimeout(() => battle.pick(), 6000);
  setTimeout(() => battle.boost('kick', 'someone', 4, 'go ' + names[0][1]), 10000);
  setTimeout(() => battle.boost(names[1][0], names[1][1], 5), 14000);
  if (mode !== 'shootout') setTimeout(() => battle.boost('youtube', 'fan', 7, 'fuel for ' + names[3][1]), 18000);
  // simulated chat inputs so the test shows everything
  const iv2 = setInterval(() => {
    if (battle.phase === 'idle') return clearInterval(iv2);
    if (battle.phase === 'race') {
      names.forEach(([pl, n]) => { if (Math.random() < 0.08) battle.chatInput(pl, n, '!turbo'); if (Math.random() < 0.3) battle.chatInput(pl, n, '!dodge'); if (Math.random() < 0.15) battle.chatInput(pl, n, ['L', 'R', 'l2', 'r', 'M'][Math.floor(Math.random() * 5)]); if (Math.random() < 0.04) battle.chatInput(pl, n, '!special'); if (Math.random() < 0.03) battle.chatInput(pl, n, '!horn'); });
      if (Math.random() < 0.08) battle.chatInput('twitch', 'chaos' + Math.floor(Math.random() * 99), ['!rain', '!wind', '!lightning', '!traffic'][Math.floor(Math.random() * 4)]);
    }
    if (battle.phase === 'arc') names.forEach(([pl, n], i) => { if (i % 3 !== 2) battle.chatInput(pl, n, '!fire'); if (Math.random() < 0.04) battle.chatInput(pl, n, '!grenade'); if (Math.random() < 0.03) battle.chatInput(pl, n, '!heal'); });
    if (battle.phase === 'shootout' && battle.so && battle.so.aim && Math.random() < 0.35) battle.chatInput('kick', 'fan' + Math.floor(Math.random() * 99), ['!boo', '!flash', '!laser', '!flare', '!firework', '!horn', '!chant'][Math.floor(Math.random() * 7)]);
  }, 1000);
  if (mode === 'arc') {
    setTimeout(() => battle.boost('twitch', 'lurkerlarry', 6, 'supply drop!'), 12000);
    setTimeout(() => battle.boost('kick', 'bigfan', 5, 'for ' + names[5][1]), 60000);
    setTimeout(() => battle.boost('youtube', 'superfan', 10, 'everyone go!'), 90000);
  }
  if (mode === 'shootout') {
    // the two test players "type" their picks a moment into each kick
    let lastAim = null;
    const iv = setInterval(() => {
      if (battle.phase === 'idle') return clearInterval(iv);
      const aim = battle.so && battle.so.aim;
      if (!aim || aim === lastAim) return;
      lastAim = aim;
      const sh = battle.fighters[aim.s];
      if (Math.random() < 0.85) setTimeout(() => battle.aimInput(sh.platform, sh.login, ['L', 'C', 'R'][Math.floor(Math.random() * 3)]), 2500);
    }, 300);
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (req.method === 'GET' && PAGES[p]) {
      const file = PAGES[p];
      return send(res, 200, fs.readFileSync(path.join(ROOT, 'public', file), 'utf8'), TYPES[path.extname(file)]);
    }
    if (p === '/api/sounds') {
      return send(res, 200, listDirs(SOUND_DIRS, (f) => !!AUDIO[path.extname(f).toLowerCase()]));
    }
    if (p.startsWith('/sounds/')) {
      const name = path.basename(decodeURIComponent(p.slice(8)));
      const type = AUDIO[path.extname(name).toLowerCase()];
      const file = type && findIn(SOUND_DIRS, name);
      if (!type || !file) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      return fs.createReadStream(file).pipe(res);
    }
    if (p === '/api/textures') {
      return send(res, 200, listDirs(TEX_DIRS, (f) => !!IMG[path.extname(f).toLowerCase()]));
    }
    if (p.startsWith('/3d/')) {
      // 3D stadium + player models (big files: cached by the browser source between games)
      const name = path.basename(decodeURIComponent(p.slice(4)));
      const type = { '.glb': 'model/gltf-binary', '.png': 'image/png' }[path.extname(name).toLowerCase()];
      const file = path.join(ROOT, 'public', '3d', name);
      if (!type || !fs.existsSync(file)) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=86400', 'Content-Length': fs.statSync(file).size });
      return fs.createReadStream(file).pipe(res);
    }
    if (p.startsWith('/art/')) {
      const name = path.basename(decodeURIComponent(p.slice(5)));
      const type = IMG[path.extname(name).toLowerCase()];
      const file = path.join(ROOT, 'public', 'art', name);
      if (!type || !fs.existsSync(file)) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=86400' });
      return fs.createReadStream(file).pipe(res);
    }
    if (p.startsWith('/textures/')) {
      const name = path.basename(decodeURIComponent(p.slice(10)));
      const type = IMG[path.extname(name).toLowerCase()];
      const file = type && findIn(TEX_DIRS, name);
      if (!type || !file) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=3600' });
      return fs.createReadStream(file).pipe(res);
    }
    if (p === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write('retry: 3000\n\n');
      res.write('data: ' + JSON.stringify({ type: 'hello', boot: BOOT_ID }) + '\n\n');
      res.write('data: ' + JSON.stringify(Object.assign(screenState(), { accent: accent() })) + '\n\n');
      res.write('data: ' + JSON.stringify(bsnTickerEv()) + '\n\n');
      for (const f of connectHooks) { try { const ev = f(); if (ev) res.write('data: ' + JSON.stringify(Object.assign({ accent: accent() }, ev)) + '\n\n'); } catch (e) { /* skip */ } }
      clients.add(res);
      const hb = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => { clients.delete(res); clearInterval(hb); });
      return;
    }
    if (p === '/api/ready') {
      const b = req.method === 'POST' ? await readBody(req) : {};
      if (b.fix === 'obs') { try { await obs.connect(); } catch (e) { /* shown below */ } }
      const C = [], add = (k, ok, label, detail, fix, optional) => C.push({ k, ok: !!ok, label, detail: detail || '', fix: fix || null, optional: !!optional });
      add('obs', obs.ready, 'OBS connected', obs.ready ? 'version ' + (obs.version || '?') : (obs.error || 'not connected'), obs.ready ? null : 'obs');
      add('overlay', clients.size > 0, 'Overlay open', clients.size ? clients.size + ' open' : 'add http://localhost:' + PORT + '/overlay as a Browser Source');
      let onAir = null; try { onAir = obs.ready ? await obs.overlayOnAir() : null; } catch (e) { onAir = null; }
      if (obs.ready) add('onair', onAir, 'Overlay in the scene on air', onAir ? obs.onAirScene : 'the scene on air (' + (obs.onAirScene || '?') + ') has no BBR overlay');
      const anyChat = twitch.connected || kick.connected || youtube.connected;
      add('twitch', twitch.connected, 'Twitch chat', twitch.connected ? (twitch.user && twitch.user.login) || 'connected' : twitch.configured() ? 'not connected' : 'not set up', null, !twitch.configured());
      if (kick.configured()) add('kick', kick.connected, 'Kick chat', kick.connected ? 'connected' : 'not connected', null, true);
      if (youtube.configured()) add('youtube', youtube.connected, 'YouTube chat', youtube.connected ? 'connected' : 'starts when you go live on YouTube', null, true);
      if (!anyChat) add('chat', false, 'Chat', 'no platform connected: commands and cards will not work');
      if (replay.S().on) { const why = clips.why(); add('replay', !why, 'Twitch clips (replays)', why || 'ready', null, true); }
      const T = teeth.S ? teeth.S() : {}; if (T.on && T.follow) add('teeth', teeth.lastTrack && Date.now() - teeth.lastTrack < 20000, 'Teeth tracker', teeth.lastTrack && Date.now() - teeth.lastTrack < 20000 ? 'following your mouth' : 'open the Teeth tracker page (Camera studio)', null, true);
      add('backup', true, 'Backup', store.data.meta && store.data.meta.lastAutoBackup ? 'last one ' + new Date(store.data.meta.lastAutoBackup).toLocaleString('en-GB') : 'made by itself after each stream', null, true);
      try { for (const x of await precheck()) { if (/OBS linked|Overlay open|Twitch connected|Kick chat|YouTube connected/.test(x.t)) continue; add('pc-' + x.t, x.ok, x.t, x.ok ? '' : x.fix, null, /Viewer count|Battles on|Camera found/.test(x.t)); } } catch (e) { /* ignore */ }
      const must = C.filter((c) => !c.optional), ready = must.every((c) => c.ok);
      return send(res, 200, { ready, checks: C, live: isLive() });
    }
    // v36 desktop app: is this the BBR server, which version, are we live (the app checks this before an update)
    if (p === '/api/app/status' && req.method === 'GET') {
      return send(res, 200, { bbr: true, version: APP_VERSION, live: isLive(), desktop: DESK.on, home: HOME, port: PORT, pid: process.pid,
        platforms: { twitch: twitch.live, kick: kick.live, youtube: youtube.live, manual: !!cfg.liveMode } });
    }
    // Setup > App (updates, backups, start-up): answered by the desktop app itself
    if (p === '/api/app') {
      if (!DESK.on) return send(res, 200, { desktop: false, version: APP_VERSION, live: isLive() });
      if (req.method === 'POST') { const b = await readBody(req); if (!b || typeof b.action !== 'string') return send(res, 400, { error: 'action' }); return send(res, 200, await deskAsk({ action: b.action, args: b.args || {} }, b.action === 'check' ? 60000 : 20000)); }
      const r = await deskAsk({ action: 'state', args: {} });
      return send(res, 200, Object.assign({}, r, { desktop: true, version: APP_VERSION, live: isLive() }));
    }
    if (p === '/api/app/report' && req.method === 'GET') {
      // one file to attach in the chat: the system check + errors + the app's own log (no logins in it)
      const log = DESK.on ? await deskAsk({ action: 'log', args: {} }) : {};
      const txt = diag.report() + '\n\nApp log (last lines):\n' + String(log.text || '(not running in the desktop app)').replace(/(secret|token|password|key|code)=\S+/gi, '$1=***').replace(/("(?:[a-z]*(?:token|secret|password)[a-z]*)"\s*:\s*)"[^"]*"/gi, '$1"***"');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="bbr-report-for-claude-v' + APP_VERSION + '.txt"' }); return res.end(txt);
    }
    if (p === '/api/status') {
      const interval = battleOpts().intervalMin * 60000;
      return send(res, 200, {
        accent: accent(), volume: volume(), port: PORT, viewers: store.all().length, overlays: clients.size,
        twitch: { configured: twitch.configured(), loggedIn: !!cfg.twitchTokens, connected: twitch.connected, login: twitch.user && twitch.user.login, live: twitch.live, game: twitch.game || null, error: twitch.lastError, clientId: cfg.twitchClientId || '', hasSecret: !!cfg.twitchClientSecret },
        kick: { configured: kick.configured(), connected: kick.connected, live: kick.live, game: kick.game, slug: cfg.kickSlug || '', chatroomId: cfg.kickChatroomId || '', channelId: cfg.kickChannelId || '', error: kick.lastError,
          apiConfigured: kick.apiConfigured(), loggedIn: !!cfg.kickTokens, apiUser: kick.user && kick.user.name, clientId: cfg.kickClientId || '', hasSecret: !!cfg.kickClientSecret },
        youtube: { configured: youtube.configured(), loggedIn: !!cfg.ytTokens, connected: youtube.connected, channel: youtube.user && youtube.user.title, live: youtube.live, error: youtube.lastError,
          quotaUsed: youtube.quota(), quotaBudget: youtube.budget(), clientId: cfg.ytClientId || '', hasSecret: !!cfg.ytClientSecret },
        battle: Object.assign(battle.status(), {
          enabled: cfg.battlesEnabled !== false, battlesOff: battlesOff(), intervalMin: battleOpts().intervalMin, liveMode: !!cfg.liveMode, setting: cfg.battleMode || 'auto',
          manualGame: cfg.manualGame || '', game: currentGame(), live: isLive(), nextInMs: nextInMs(), paused: !!cfg.battlesPaused, nextMode: chooseMode(null, true), showNextTimer: cfg.showNextTimer !== false
        }),
        import: importState, obs: obs.status(), giveawaysOn: GA_ON()
      });
    }
    if (p === '/api/config/cardstyle') {
      if (req.method === 'POST') { const b = await readBody(req); if (['auto', 'fc', 'ats', 'ets', 'arc', 'heist'].includes(b.style)) { cfg.cardStyle = b.style; saveCfg(); } }
      return send(res, 200, { style: cfg.cardStyle || 'auto', now: cardStyle(), game: currentGame() });
    }
    if (p === '/api/streaks') {
      const now = Date.now(), lastNo = (store.data.meta && store.data.meta.streamNo) || 0;
      const monthAgo = now - 30 * 864e5;
      const giftMonth = {}; for (const [t, k, kind, n] of store.data.supportLog || []) if (t > monthAgo && kind === 'gift') giftMonth[k] = (giftMonth[k] || 0) + n;
      const rows = store.all().filter((v) => !v.isBroadcaster).map((v) => {
        const c = card(v), t = v.tk || {};
        const missed = c.streak.now > 0 && t.lastStreamNo && t.lastStreamNo < lastNo;
        return { key: v.key, display: c.display, platforms: c.platforms, tier: c.tier, ovr: c.ovr, streak: c.streak, boost: c.boost, sub: c.sub, gifted: v.giftedSubs || 0, giftedMonth: giftMonth[v.key] || 0,
          support: v.bits || 0, lastSeen: v.lastSeen || v.firstSeen || 0, here: t.lastStreamNo === lastNo && isLive(), missedLast: !!missed, atRisk: !!(missed && c.streak.now >= 5 && !c.streak.savers), test: !!v.test };
      });
      const subs = rows.filter((r) => r.sub);
      const sum = {
        streak5: rows.filter((r) => r.streak.now >= 5).length, streak10: rows.filter((r) => r.streak.now >= 10).length,
        subs: subs.length, t1: subs.filter((r) => r.sub.platform === 'twitch' && r.sub.tier === 1 && !r.sub.prime).length, t2: subs.filter((r) => r.sub.tier === 2).length, t3: subs.filter((r) => r.sub.tier === 3).length,
        prime: subs.filter((r) => r.sub.prime).length, kick: subs.filter((r) => r.sub.platform === 'kick').length, yt: subs.filter((r) => r.sub.platform === 'youtube').length,
        giftedMonth: rows.reduce((a, r) => a + r.giftedMonth, 0), gifters: rows.filter((r) => r.giftedMonth).length, atRisk: rows.filter((r) => r.atRisk).length, streamNo: lastNo, live: isLive()
      };
      rows.sort((a, b) => b.streak.now - a.streak.now || b.ovr - a.ovr);
      return send(res, 200, { sum, rows: rows.slice(0, 500) });
    }
    if (p === '/api/cardgate' && req.method === 'GET') { const all = store.all().filter((x) => !x.test && !x.isBroadcaster); return send(res, 200, Object.assign(gateS(), { withCard: all.filter(hasCard).length, without: all.filter((x) => !hasCard(x)).length, twitch: !!(twitch.user && twitch.connected), lastSync: followSyncAt })); }
    if (p === '/api/cardgate' && req.method === 'POST') { const b = await readBody(req); const g = Object.assign({}, cfg.cardGate || {}); if (typeof b.on === 'boolean') g.on = b.on; if (b.kick) g.kick = b.kick; if (b.youtube) g.youtube = b.youtube; cfg.cardGate = g; saveCfg(); let n = null; if (b.sync) n = await syncFollowers(); return send(res, 200, { ok: true, found: n }); }
    if (p === '/api/viewers') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const pf = url.searchParams.get('platform') || '';
      const hit = (x) => !q || x.login.includes(q) || String(x.display).toLowerCase().includes(q);
      const viaAlias = new Set(store.aliases().filter((a) => hit(a) && (!pf || a.platform === pf)).map((a) => a.aliasOf));
      const list = store.all().filter((v) => viaAlias.has(v.key) || (hit(v) && (!pf || (v.platforms || [v.platform]).includes(pf)))).map(card).map(linkedInfo)
        .sort((a, b) => b.ovr - a.ovr || a.display.localeCompare(b.display)).slice(0, 300);
      return send(res, 200, list);
    }
    // ----- Stream Deck / hotkey control: plain GET links -----
    const ctl = /^\/control\/([a-z0-9-]+)$/.exec(p);
    if (ctl) {
      const a = ctl[1], q = url.searchParams;
      let msg = 'ok';
      if (a === 'pause') { pauseBattles(true); msg = 'Battles paused'; }
      else if (a === 'resume') { pauseBattles(false); msg = 'Battles resumed'; }
      else if (a === 'toggle') msg = battlesOff() ? 'Battles are switched OFF: turn them on first' : pauseBattles(!cfg.battlesPaused) ? 'Battles paused' : 'Battles resumed';
      else if (a === 'battles-off') msg = setBattlesOff(true);
      else if (a === 'battles-on') msg = setBattlesOff(false);
      else if (a === 'battles-switch') msg = setBattlesOff(!battlesOff());
      else if (a === 'delay') msg = 'Delayed ' + delayBattle(q.get('min') || 5) + ' min';
      else if (a === 'start') msg = battlesOff() ? 'Battles are switched OFF (turn them on: Battles page, dock › Games or /control/battles-on)' : startBattle(q.get('mode')) ? 'Battle starting' : 'A battle is already running';
      else if (a === 'cancel') { battle.cancel(); msg = 'Cancelled'; }
      else if (a === 'board' && LB_CATS[q.get('type')] && !['battles', 'support'].includes(q.get('type'))) { showLb(q.get('type'), q.get('period') || 'all', +q.get('top') || 20, q.get('secs')); msg = 'Showing leaderboard'; }
      else if (a === 'board-rotate') msg = setLbRotate(!lbRotate, q.get('secs')) ? 'Rotating boards' : 'Stopped rotating';
      else if (a === 'board') { showBoard(q.get('type') || 'battles', q.get('period') || 'week', q.get('secs')); msg = 'Showing leaderboard'; }
      else if (a === 'challenge-done') { const c = challenges.step(1); msg = c ? c.name + ': ' + (c.left || 0) + ' left' : 'No challenge running'; }
      else if (a === 'challenge-pause') { const c0 = challenges.data().list[0]; const c = c0 ? challenges.edit(c0.id, { paused: !c0.paused }) : null; msg = c ? c.name + (c.paused ? ' paused (hidden)' : ' back on screen') : 'No challenge running'; }
      else if (a === 'challenge-undo') { const c = challenges.step(-1); msg = c ? c.name + ': ' + c.left + ' left' : 'No challenge running'; }
      else if (a === 'raidnight-brief') { const r = await raidNight.briefing(); msg = r.error || 'Briefing started'; }
      else if (a === 'raidnight-drone') { if (!raidNight.drone) raidNight.startDrone(); msg = 'Drone up'; }
      else if (a === 'credits') { await rollCredits(); msg = 'Credits rolling'; }
      else if (/^result-(win|draw|loss|undo)$/.test(a)) { const k = a.slice(7); const r = k === 'undo' ? results.undo() : results.add({ win: 0, draw: 1, loss: 2 }[k], null); if (k !== 'undo' && r.ok) { try { if (squad.D().list.length) squad.matchDone(null); } catch (e) { /* ignore */ } } if (k !== 'undo' && r.ok && raidNight.gameOver()) msg = 'Raid Night briefing starting'; else msg = r.error || results.line(); }
      else if (/^queen-(wake|now|later|aftergame|skip)$/.test(a)) { const k = a.slice(6); const r = k === 'wake' ? raidNight.wake(viewerCache.n) : k === 'now' ? await raidNight.briefing() : k === 'later' ? raidNight.delay(10) : k === 'aftergame' ? raidNight.afterThisGame() : raidNight.skip(); msg = r.error || { wake: 'The Queen is awake', now: 'Briefing started', later: 'Queen delayed 10 minutes', aftergame: 'Queen after this game', skip: 'No Queen tonight' }[k]; }
      else if (a === 'counter-plus' || a === 'counter-minus' || a === 'counter-undo') { const id = url.searchParams.get('id') || counters.list()[0].id; const r = a === 'counter-undo' ? counterUndo(id) : counterAdd(id, a === 'counter-plus' ? 1 : -1); msg = r.error || r.name + ': ' + r.tonight + ' tonight (' + r.level + ')'; }
      else if (a === 'show') { const k = q.get('k'); if (k && SHOW_DEF[k] != null) { const on = !showOn(k); cfg.show = Object.assign({}, cfg.show, { [k]: on }); saveCfg(); pushShow(); if (k === 'chat') chatOldSource(on); if (k === 'subGoal') push(subGoalState()); msg = k + (on ? ' on' : ' off'); } else msg = 'Unknown switch'; }
      else if (a === 'squad-next') { const r = squad.next(); msg = r.error || 'Team sheet for match ' + r.match; }
      else if (a === 'squad-show') { if (squad.D().sheet) { push(Object.assign(squad.state(), { type: 'squadsheet', show: true })); msg = 'Showing the team sheet'; } else msg = 'No team sheet yet'; }
      else if (a === 'redcard') { const q2 = url.searchParams; if (redActive && !q2.get('player') && !q2.get('rule') && !q2.get('kind')) { redClear(); msg = 'Red card cleared'; } else { const r = redShow({ kind: q2.get('kind') || '', player: q2.get('player') || '', rule: q2.get('rule') || '' }); msg = r.error || 'RED CARD'; } }
      else if (a === 'redcard-clear') { redClear(); msg = 'Red card cleared'; }
      else if (a === 'undo-last') { const u = undoState().find((x) => x.can); const r = u ? undoRun(u.id) : { error: 'Nothing to undo' }; msg = r.error || 'Undone: ' + u.label; }
      else if (a === 'motm-open') { const r = clubStats.open(); msg = r.error || 'Man of the match vote open'; }
      else if (a === 'motm-close') { const r = clubStats.close(); msg = r.error || (r.winner ? 'MOTM: ' + r.winner : 'No votes'); }
      else if (a === 'replay' || a === 'replay-slow' || a === 'clip') { const q2 = url.searchParams; const r = await replayNow({ play: a === 'clip' ? false : undefined, secs: +q2.get('secs') || undefined, speed: a === 'replay-slow' ? 0.5 : (+q2.get('speed') || undefined), label: q2.get('label') || '', look: q2.get('look') || undefined }); if (!r.error) replayWanted = null; msg = r.error || 'Clipping the last ' + r.job.secs + ' s…'; }
      else if (a === 'bot-mute') { cfg.botMuted = !cfg.botMuted; saveCfg(); msg = cfg.botMuted ? 'Chat bot MUTED: the app won\'t post in chat' : 'Chat bot back on'; feedAdd(msg, cfg.botMuted ? '#ff6b7d' : '#3dff9a'); }
      else if (/^gmeter-/.test(a)) {
        const q2 = url.searchParams, n = +q2.get('n'), k = a.slice(7);
        const G = { start: () => gmeter.start(), pause: () => gmeter.pause(), resume: () => gmeter.resume(), stop: () => gmeter.stop(), restart: () => gmeter.restart(), toggle: () => gmeter.toggle(),
          show: () => gmeter.show(true), hide: () => gmeter.show(false), add: () => gmeter.add(isFinite(n) && n ? n : 1, 'by hand'), minus: () => gmeter.add(-(isFinite(n) && n ? Math.abs(n) : 1), 'by hand'),
          set: () => gmeter.setValue(isFinite(n) ? n : 0), goal: () => gmeter.setGoal(isFinite(n) && n > 0 ? n : gmeter.S().goal), plus1: () => gmeter.addTime(60000), minus1: () => gmeter.addTime(-60000),
          time: () => gmeter.setTime((+q2.get('hours') || 0) * 3600000 + (+q2.get('mins') || 0) * 60000 + (+q2.get('secs') || 0) * 1000),
          addtime: () => gmeter.addTime(((+q2.get('hours') || 0) * 60 + (+q2.get('mins') || 0)) * 60000 || 60000), at: () => gmeter.setAt(q2.get('time') || ''),
          on: () => gmeter.enable(true), off: () => gmeter.enable(false), mode: () => { const m = q2.get('m'); if (!/^(meter|timer|meteronly)$/.test(m || '')) return 'Use m=meter, m=timer or m=meteronly'; gmeter.set({ mode: m }); return 'Giveaway: ' + require('./lib/gmeter').MODES[m]; }, pick: () => { const r = gmeter.pick(); return r.error || 'Winner: ' + r.winner.name; }, clear: () => gmeter.clearEntries(), hideclock: () => { const on = !gmeter.S().hideClock; gmeter.set({ hideClock: on }); return on ? 'Giveaway clock hidden on stream' : 'Giveaway clock shown on stream'; } };
        msg = G[k] ? G[k]() : 'Unknown giveaway meter button';
      }
      else if (a === 'showcard') { const v0 = store.data.viewers[url.searchParams.get('key') || '']; const v = v0 && (store.primary(v0) || v0); if (!v) msg = 'No such viewer'; else { await withAvatar(v).catch(() => {}); push({ type: 'show', card: card(v), profile: showOn('cardProfile') || showOn('cardFlip') ? profileOf(v) : null, flip: showOn('cardFlip'), wide: showOn('cardProfile') }); msg = 'Showing ' + v.display + '\'s card'; } }
      else if (/^spin-/.test(a)) {
        const k = a.slice(5), r = k === 'start' ? spin.start() : k === 'test' ? spin.start({ test: true }) : k === 'claim' ? spin.claim('you') : k === 'skip' ? spin.skip() : k === 'hide' ? spin.hide() : { error: 'Unknown spin button' };
        msg = r.error || r.msg;
      }
      else if (/^sgw-/.test(a)) {
        const k = a.slice(4), q2 = url.searchParams;
        if (k === 'open') msg = sgw.open(); else if (k === 'close') msg = sgw.close(); else if (k === 'toggle') msg = sgw.toggle(); else if (k === 'clear') msg = sgw.clear();
        else if (k === 'pick') { const r = sgw.pick(); msg = r.error || r.msg; } else if (k === 'add') { const r = sgw.add(q2.get('name'), q2.get('platform')); msg = r.error || r.msg; }
        else if (k === 'remove') { const r = sgw.remove(q2.get('key') || q2.get('name')); msg = r.error || r.msg; } else msg = 'Unknown giveaway button';
      }
      else if (a === 'replay-pause') { const r = await replay.pauseToggle(); msg = r.error || (r.frozen ? 'Paused' : 'Playing'); }
      else if (a === 'replay-back' || a === 'replay-fwd') { const ms = Math.max(100, Math.min(30000, +url.searchParams.get('ms') || 2000)); const r = await replay.jump(a === 'replay-back' ? -ms : ms); msg = r.error || ((a === 'replay-back' ? 'Back ' : 'Forward ') + (ms / 1000) + ' s'); }
      else if (a === 'replay-seek') { const q2 = url.searchParams, st = await replay.status(); let r; if (!st) r = { error: 'No replay playing' }; else if (q2.get('pct') != null) r = await replay.seekTo(st.duration * Math.max(0, Math.min(100, +q2.get('pct'))) / 100); else r = await replay.seekTo(+q2.get('to') || 0); msg = r.error || 'Moved to ' + (Math.round((r.cursor || 0) / 100) / 10) + ' s'; }
      else if (a === 'replay-frame-back' || a === 'replay-frame-fwd') { const r = await replay.step(a === 'replay-frame-back' ? -33 : 33); msg = r.error || 'One frame ' + (a === 'replay-frame-back' ? 'back' : 'forward'); }
      else if (a === 'clip-get') { const id = require('./lib/clips').Clips.idOf(url.searchParams.get('id') || ''); const have = clips.have()[id]; if (have) { const r = await replay.play(have, {}); msg = r.error || 'Playing the clip'; } else { const r = clips.get(id, { play: url.searchParams.get('play') !== '0' }); msg = r.error || 'Getting the clip from Twitch: it plays when it has downloaded'; } }
      else if (a === 'clip-retry') { const r = clips.retry(url.searchParams.get('key') || ''); msg = r.error || 'Trying that clip again'; }
      else if (a === 'clip-pull') { const r = await pullTwitchClips(true); msg = r.error || (r.started ? 'Getting ' + r.started + ' clip' + (r.started === 1 ? '' : 's') + ' from Twitch' : 'All your Twitch clips from tonight are in the list already'); }
      else if (a === 'replay-play') { const id = url.searchParams.get('id'); const r = id ? await replay.play(id, {}) : { error: 'No clip id' }; msg = r.error || 'Playing the clip'; }
      else if (a === 'replay-last-slow') { const L = replay.D().list, c = L[L.length - 1]; const r = c ? await replay.play(c.id, { speed: 0.5 }) : { error: 'No clip yet: tap CLIP first' }; msg = r.error || 'Last clip in slow-mo'; }
      else if (a === 'replay-again') { const L = replay.D().list, c = L[L.length - 1]; const r = c ? await replay.play(c.id, {}) : { error: 'No replay yet' }; msg = r.error || 'Replay again'; }
      else if (a === 'replay-stop') { await replay.stop(); msg = 'Back to live'; }
      else if (a === 'replay-freeze') { const r = replay.playing ? await replay.freeze(!replay.playing.frozen) : { error: 'No replay playing' }; msg = r.error || (r.frozen ? 'Frozen: draw on the Analysis page' : 'Playing'); }
      else if (a === 'replay-clear') { const r = replay.draw([]); msg = r.error || 'Drawings cleared'; }
      else if (a === 'redcard-shame') { const r = showShame('all'); msg = r.error || 'Hall of Shame on screen'; }
      else if (a === 'redcard-assign') { const r = redAssign(url.searchParams.get('player')); msg = r.error || 'Given to ' + String(url.searchParams.get('player')).toUpperCase(); }
      else if (/^bp-(up|up15|down|reset|melt)$/.test(a)) { const k = a.slice(3); const r = k === 'reset' ? bp.setTo(bp.S().start, 'Reset') : k === 'melt' ? bp.setTo(100, 'Meltdown') : bp.add(k === 'up' ? 5 : k === 'up15' ? 15 : -10, k === 'down' ? 'Calming down' : 'Getting wound up'); msg = 'Blood pressure ' + r.sys + '/' + r.dia + ' (' + r.level + ')'; }
      else if (a === 'starting-start') { stStart(); msg = 'Countdown running'; }
      else if (a === 'starting-pause') msg = stPause() ? 'Countdown running' : 'Countdown paused';
      else if (a === 'starting-reset') { stReset(); msg = 'Countdown reset'; }
      // v30
      else if (a === 'brb') msg = screens.BRB.on ? await screens.brbEnd() : await screens.brbStart();
      else if (a === 'brb-start') msg = await screens.brbStart();
      else if (a === 'brb-end') msg = await screens.brbEnd();
      else if (a === 'brb-timer-start') { screens.brbTimer('start'); msg = 'BRB timer running'; }
      else if (a === 'brb-timer-stop') { screens.brbTimer('stop'); msg = 'BRB timer stopped'; }
      else if (a === 'brb-plus1' || a === 'brb-minus1') { screens.brbTimer('add', a === 'brb-plus1' ? 60 : -60); msg = a === 'brb-plus1' ? 'BRB +1 minute' : 'BRB -1 minute'; }
      else if (a === 'brb-set') { screens.brbTimer('set', +q.get('secs') || 300); msg = 'BRB timer set'; }
      else if (a === 'bigcam-next' || a === 'bigcam-prev') msg = 'Big Cam: ' + screens.bigStep(a === 'bigcam-next' ? 1 : -1);
      else if (a === 'bigcam-set') { const id = q.get('id') || 'auto'; if (!SCR.SETS[id] && id !== 'auto' && id !== 'photo') msg = 'Unknown set'; else { screens.bigSet({ set: id }); msg = 'Big Cam: ' + (screens.bigState().name || id); } }
      else if (a === 'bigcam-music') { const c = screens.bigS().musicRaw; screens.bigSet({ music: Object.assign({}, c, { on: c.on === false }) }); msg = screens.bigS().music.on ? 'Big Cam music on' : 'Big Cam music off'; }
      else if (a === 'links-now') { const r = screens.linksNow(); msg = r.error || 'Links on screen'; }
      else if (a === 'links-toggle') { screens.linksSet({ on: !screens.linksS().on }); msg = screens.linksS().on ? 'Links every ' + screens.linksS().everyMins + ' min: on' : 'Links timer off'; }
      else if (a === 'stinger') { push(screens.stingEvent()); msg = 'Stinger'; }
      else if (a === 'stinger-to') { const sc = q.get('scene'); const r = await screens.toScene(sc, true); msg = r.error || 'Stinger to ' + sc; }
      else if (a === 'bigcam-go') { const r = await screens.toScene(screens.bigS().scene, true); msg = r.error || 'Stinger to ' + screens.bigS().scene; }
      else if (a === 'music-skip') { const w = url.searchParams.get('where'); push({ type: 'music', act: 'skip', where: /^(starting|brb|bigcam)$/.test(w || '') ? w : 'all' }); msg = 'Next song'; }
      // v33: put one song on right now (Starting Soon, BRB or Big Cam)
      else if (a === 'music-play') { const m = media.get(url.searchParams.get('id') || ''), w = url.searchParams.get('where'); if (!m || m.kind !== 'music') msg = 'That song isn\'t in Photos & music'; else { push({ type: 'music', act: 'play', url: media.url(m.id), name: m.name, where: /^(starting|brb|bigcam)$/.test(w || '') ? w : 'all' }); msg = 'Playing ' + m.name; } }
      else if (a === 'music-stopsong') { const w = url.searchParams.get('where'); push({ type: 'music', act: 'stopsong', where: /^(starting|brb|bigcam)$/.test(w || '') ? w : 'all' }); msg = 'Song stopped'; }
      else if (a === 'music-mute') { cfg.musicMuted = !cfg.musicMuted; saveCfg(); push({ type: 'music', act: cfg.musicMuted ? 'mute' : 'unmute' }); msg = cfg.musicMuted ? 'Music muted' : 'Music on'; }
      else if (a === 'theme-ets' || a === 'theme-football' || a === 'theme-heist') { cfg.theme = a.slice(6); cfg.themeAuto = false; saveCfg(); themePush(); msg = a === 'theme-ets' ? 'Euro Truck Simulator theme on' : a === 'theme-heist' ? 'Sunset Heist (GTA-style) theme on' : 'Football theme on'; }
      else if (a === 'starting-stop') { stStop(); msg = 'Countdown stopped'; }
      else if (a === 'starting-plus1') { stAdd(60); msg = '+1 minute'; }
      else if (a === 'starting-minus1') { stAdd(-60); msg = '-1 minute'; }
      else if (a === 'starting-set') { stSet(+url.searchParams.get('secs') || 300); msg = 'Countdown set'; }
      else if (a === 'starting-add30') { stAdd(30); msg = '+30 seconds'; }
      else if (a === 'starting-minus30') { stAdd(-30); msg = '-30 seconds'; }
      else if (a === 'starting-live') { stLive(true); msg = 'Kick-off!'; }
      else if (a === 'teampens-open' || a === 'teampens-3' || a === 'teampens-5') msg = startTeams(a === 'teampens-open' ? {} : { size: +a.slice(-1) }) ? 'Team shootout open: chat types !join' : 'A battle is already running';
      else if (a === 'cards-freeze') { const fz = safety.frozen(); msg = fz ? (safety.release(true), 'Cards un-frozen: held changes added') : (safety.freeze(true), 'Cards frozen: changes are held until you un-freeze'); }
      else if (a === 'cards-apply') { const r = safety.release(true); msg = 'Held changes added to ' + r.cards + ' card' + (r.cards === 1 ? '' : 's'); }
      else if (a === 'cards-discard') { const r = safety.release(false); msg = 'Held changes thrown away (' + r.cards + ' card' + (r.cards === 1 ? '' : 's') + ')'; }
      else if (a === 'cards-undo10') { autoBackup('before undoing 10 minutes of card points'); const r = safety.undo(10, true); msg = r.viewers ? 'Took back the last 10 minutes of card points from ' + r.viewers + ' card' + (r.viewers === 1 ? '' : 's') : 'No card points in the last 10 minutes'; }
      else if (a === 'reconnect') { msg = reconnectAll(); }
      else if (a === 'stop-games') { msg = stopAllGames(); }
      else if (a === 'start-now') { const r = battle.startNow(); msg = r.error || 'Starting with ' + r.players + ' player' + (r.players === 1 ? '' : 's'); }
      else if (a === 'teampens-test') msg = testTeams() ? 'Test team shootout started (test viewers)' : 'A battle is already running';
      else if (a === 'teampens-skip') { const r = battle.teamSkip(); msg = r.error || 'The AI took the kick for ' + r.who; }
      else if (a === 'teampens-pause') { const r = battle.teamPause(); msg = r.error || (r.paused ? 'Paused after this kick' : 'Back on'); }
      else if (a === 'teampens-end') { if (battle.tm) { battle.cancel(); msg = 'Team shootout ended'; } else msg = 'No team shootout running'; }
      else if (a === 'boss-start') msg = battle.openBoss(() => { lastBattleLive = liveMs; }) ? 'Beat the Boss is open: chat types !join' : 'A battle is already running';
      else if (/^boss-([lcr][tmb]?|[1-9])$/.test(a)) { const r = battle.bossInput(a.slice(5).toUpperCase()); msg = r.error || 'You shoot ' + ({ T: 'top ', M: '', B: 'bottom ' }[r.h] || '') + ({ L: 'left', C: 'centre', R: 'right' }[r.dir] || r.dir); }
      else if (a === 'mvp') { const r = await mvpReveal(); msg = r.error || 'Viewer of the Stream: ' + r.name; }
      else if (a === 'scores') { const L = liveScores(true).slice(0, 8); if (L.length) { push({ type: 'scoresPanel', list: L, secs: 20 }); msg = 'Showing scores'; } else msg = 'No games today'; }
      else if (a === 'panic') msg = setPanic(!cfg.panic) ? 'PANIC: everything hidden' : 'Back on screen';
      else if (a === 'marker') { try { await twitch.marker('BBR moment'); feedAdd('Marked a moment', '#4dc3ff'); msg = 'Marked'; } catch (e) { msg = e.message; } }
      else if (a === 'held-play') { playAnywayScene = obs.onAirScene; sceneHeld = false; heldList = []; push({ type: 'sceneHold', hold: false, scene: '', gapSecs: holdGap() }); msg = 'Playing the waiting alerts'; }
      else if (a === 'cam-reset' || a === 'cam-fix') { const r = await cam.resetAll(); msg = r.error || r.msg; }
      else if (a === 'cam-savespot') { const r = await cam.saveSpot(); msg = r.error || ('Camera spot saved for "' + r.saved + '": Reset camera always puts it back here'); }
      else if (/^cam-[a-z]+$/.test(a)) { const fx = a.slice(4); if (!CAMX.FX[fx]) msg = 'Unknown camera effect'; else { cam.run(fx, null); msg = 'Camera: ' + CAMX.FX[fx].label; } }
      else if (a === 'corner') { try { await obs.toCorner(); msg = 'Moved to corner'; } catch (e) { msg = e.message; } }
      else if (a === 'restore') { try { await obs.restore(); msg = 'Put back'; } catch (e) { msg = e.message; } }
      else return send(res, 404, 'Unknown control: ' + a, 'text/plain');
      return send(res, 200, msg, 'text/plain');
    }
    // ----- teeth whitening -----
    if (p === '/api/teeth' && req.method === 'GET') return send(res, 200, teeth.info());
    if (p === '/api/teeth' && req.method === 'POST') { const b = await readBody(req); const r = await teeth.set(b); return send(res, 200, Object.assign(teeth.info(), r)); }
    if (p === '/api/teeth/frame' && req.method === 'GET') { try { return send(res, 200, Object.assign(await teeth.frame(+url.searchParams.get('w') || 320), { follow: teeth.S().follow, on: teeth.S().on })); } catch (e) { return send(res, 200, { error: e.message }); } }
    if (p === '/api/teeth/track' && req.method === 'POST') { const b = await readBody(req); teeth.tracked(b); return send(res, 200, { ok: true }); }
    // ----- one-click backup (cards, results, settings; never logins) -----
    if (p === '/api/backup' && req.method === 'GET') {
      const body = backupJson();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="bbr-backup-' + new Date().toISOString().slice(0, 10) + '.json"' }); return res.end(body);
    }
    if (p === '/api/backup' && req.method === 'POST') {
      const b = await readBody(req);
      if (!b || b.bbrBackup !== 1 || !b.data || !b.data.viewers) return send(res, 200, { error: 'That is not a BBR backup file' });
      try { fs.mkdirSync(path.join(DATA, 'backups'), { recursive: true }); fs.writeFileSync(path.join(DATA, 'backups', 'before-restore-' + Date.now() + '.json'), JSON.stringify(store.data)); } catch (e) { return send(res, 200, { error: 'Could not save a safety copy first: ' + e.message }); }
      store.data = b.data; store.save();
      if (b.restoreSettings && b.settings) { const keep = Object.fromEntries(Object.entries(cfg).filter(([k]) => /token|secret|password|webhook|client|key|slug|channel|chatroom/i.test(k))); for (const k of Object.keys(cfg)) if (!(k in keep)) delete cfg[k]; Object.assign(cfg, b.settings, keep); saveCfg(); }
      return send(res, 200, { ok: true, viewers: Object.keys(store.data.viewers).length });
    }
    // ----- matchday squad -----
    if (p === '/api/squad' && req.method === 'GET') return send(res, 200, squad.state());
    if (p === '/api/squad' && req.method === 'POST') {
      const b = await readBody(req); let r = { ok: true };
      if (b.settings) squad.set(b.settings);
      if (b.next) r = squad.next();
      if (b.edit) r = squad.edit(b.edit);
      if (b.show && squad.D().sheet) push(Object.assign(squad.state(), { type: 'squadsheet', show: true }));
      if (b.remove) r = squad.leave(b.remove);
      if (b.clear) { const D = squad.D(); D.list = []; D.sheet = null; D.match = 0; store.save(); squad.sync(); }
      if (b.add) { const v = store.data.viewers[b.add]; if (v && v.isBroadcaster) r = { error: 'You are already in as the Boss' }; else if (v) { const D = squad.D(); if (!squad.find(v.key)) { D.list.push({ key: v.key, display: v.display, platform: v.platform, tier: squad.tierOf(v, v.platform), joinedAt: Date.now(), played: 0, inRow: 0, sat: 0, satLast: false }); store.save(); squad.sync(); } } else r = { error: 'Viewer not found' }; }
      if (b.bump) { const x = squad.find(b.bump); if (x) { x.satLast = true; x.played = Math.max(0, x.played - 1); store.save(); squad.sync(); } }
      return send(res, 200, Object.assign({}, r, squad.state()));
    }
    // ----- buttons, dock -----
    if (p === '/api/deckpack' && req.method === 'GET') { await screens.sceneList(); return send(res, 200, { pages: deckPack(), port: PORT }); }
    if (p === '/api/actions' && req.method === 'GET') return send(res, 200, { list: actionList() });
    if (p === '/api/buttons' && req.method === 'GET') return send(res, 200, { list: buttons(), port: PORT });
    if (p === '/api/buttons' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.reset) delete cfg.buttons;
      else if (Array.isArray(b.list)) cfg.buttons = b.list.slice(0, 60).map((x, i) => ({ id: String(x.id || 'b' + i + Date.now().toString(36)).slice(0, 30), action: String(x.action || '').slice(0, 80), label: String(x.label || '').toUpperCase().slice(0, 16), icon: String(x.icon || '').slice(0, 5), group: ['Game', 'Stream', 'Battles', 'Camera'].includes(x.group) ? x.group : 'Game', color: /^#[0-9a-f]{6}$/i.test(x.color || '') ? x.color : '#3dff9a' }));
      saveCfg(); return send(res, 200, { ok: true, list: buttons() });
    }
    if (p === '/api/dock' && req.method === 'GET') return send(res, 200, Object.assign(dockState(), { buttons: buttons() }));
    // ----- red card rule -----
    if (p === '/api/redcard' && req.method === 'GET') { let players = []; try { players = bsn.tickerConfig().squad.players; } catch (e) { /* none */ } players = redPlayers(); return send(res, 200, Object.assign(rcS(), { offenders: offenders(url.searchParams.get('period') || 'all'), log: redLog().slice(-200).reverse(), active: redActive, players, counts: store.data.redcards || {}, banList: banList() })); }
    if (p === '/api/redcard' && req.method === 'POST') {
      const b = await readBody(req); let r = { ok: true };
      if (b.settings) { const n = b.settings; cfg.redCard = Object.assign({}, cfg.redCard, { rules: (Array.isArray(n.rules) ? n.rules : []).slice(0, 10).map((x, i) => ({ id: String(x.id || 'r' + i + Date.now().toString(36)).slice(0, 20), title: String(x.title || 'RED CARD RULE').toUpperCase().slice(0, 30), text: String(x.text || '').toUpperCase().slice(0, 120) })).filter((x) => x.text || x.title), flashSecs: +n.flashSecs || 6, stay: n.stay !== false, ticker: n.ticker !== false, yellowBan: n.yellowBan != null ? +n.yellowBan : 1, redBan: n.redBan != null ? +n.redBan : 2, bans: n.bans !== false }); saveCfg(); }
      if (b.image === null) { cfg.redCard = Object.assign({}, cfg.redCard, { image: false }); saveCfg(); try { fs.unlinkSync(RC_FILE); } catch (e) { /* none */ } }
      else if (b.image) { const m = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(b.image); if (!m) return send(res, 200, { error: 'Use a PNG, JPG, WEBP or GIF' }); const buf = Buffer.from(m[2], 'base64'); if (buf.length > 6 * 1024 * 1024) return send(res, 200, { error: 'Picture too big (max 6 MB)' }); fs.writeFileSync(RC_FILE, buf); cfg.redCard = Object.assign({}, cfg.redCard, { image: true, imageType: 'image/' + m[1], imageV: Date.now() }); saveCfg(); }
      if (b.show) r = redShow(b.show);
      if (b.assign) r = redAssign(b.assign);
      if (b.clear) r = redClear();
      if (b.resetCounts) { store.data.redcards = {}; if (b.alsoLog) store.data.redLog = []; store.save(); }
      if (b.shame) { r = showShame(b.period || 'all'); }
      if (b.logDelete) redUndo(b.logDelete);
      if (b.logEdit && b.logEdit.id) { const e = redLog().find((x) => x.id === b.logEdit.id); if (e) { if (b.logEdit.name) e.name = String(b.logEdit.name).toUpperCase().slice(0, 30); if (b.logEdit.kind) e.kind = b.logEdit.kind === 'yellow2' ? 'yellow2' : 'red'; store.save(); } }
      if (b.banClear) { delete bans()[banKey(b.banClear)]; store.save(); squad.sync(); }
      if (b.banSet && b.banSet.name) { const k = banKey(b.banSet.name), n = Math.max(0, Math.min(10, +b.banSet.left || 0)); if (n) bans()[k] = Object.assign(bans()[k] || { name: String(b.banSet.name).toUpperCase(), kind: 'red' }, { left: n, pending: false }); else delete bans()[k]; store.save(); squad.sync(); }
      return send(res, 200, Object.assign({}, r, rcS(), { active: redActive, counts: store.data.redcards || {}, banList: banList(), offenders: offenders(b.period || 'all'), log: redLog().slice(-200).reverse() }));
    }
    if (p === '/api/gamesopts') {
      if (req.method === 'POST') { const b = await readBody(req); if (typeof b.letMePlay === 'boolean') cfg.letMePlay = b.letMePlay; if (typeof b.joinReplies === 'boolean') cfg.joinReplies = b.joinReplies; saveCfg(); }
      return send(res, 200, { letMePlay: cfg.letMePlay !== false, joinReplies: cfg.joinReplies !== false });
    }
    if (p === '/api/cardreset') {
      const L = backupList(), st = tonightStart(), best = L.find((x) => x.at <= st) || null;
      if (req.method === 'POST') { const b = await readBody(req); const f = b.file || (best && best.f); if (!f) return send(res, 200, { error: 'No backup from before this stream' });
        try { if (b.apply) { autoBackup('before the card reset'); } return send(res, 200, resetCards(f, !!b.apply)); } catch (e) { return send(res, 200, { error: e.message }); } }
      return send(res, 200, { tonightStart: st, best: best ? best.f : null, list: L.slice(0, 20) });
    }
    if (p === '/api/bot') {
      if (req.method === 'POST') { const b = await readBody(req); if (typeof b.muted === 'boolean') cfg.botMuted = b.muted; if (b.maxPerMin) cfg.botMaxPerMin = Math.max(2, Math.min(30, +b.maxPerMin)); saveCfg();
        if (b.repair) { try { autoBackup('before the stream repair'); } catch (e) { /* ignore */ } return send(res, 200, Object.assign({ muted: !!cfg.botMuted, maxPerMin: cfg.botMaxPerMin || 8 }, repairStreams(true))); } }
      return send(res, 200, Object.assign({ muted: !!cfg.botMuted, maxPerMin: cfg.botMaxPerMin || 8, said: sayLog.slice(-15) }, repairStreams(false)));
    }
    // ----- v30: media library -----
    { const m = /^\/media\/([a-f0-9]{12}\.[a-z0-9]{2,5})$/.exec(p); if (m && req.method === 'GET') return media.serve(req, res, m[1]); }
    if (p === '/api/media/upload' && req.method === 'POST') return send(res, 200, await media.upload(req, url.searchParams.get('name') || 'file'));
    if (p === '/api/media') {
      if (req.method === 'POST') { const b = await readBody(req); const r = b.action === 'remove' ? media.remove(String(b.id)) : b.action === 'rename' ? media.rename(String(b.id), b.name) : { error: 'unknown action' }; return send(res, 200, Object.assign(r, { list: media.list() })); }
      return send(res, 200, { list: media.list(url.searchParams.get('kind') || null) });
    }
    // ----- v30: BRB / Big Cam / links / stingers -----
    if (p === '/api/brb') {
      let r = {};
      if (req.method === 'POST') { const b = await readBody(req); if (b.settings) screens.brbSet(b.settings); if (b.action === 'start') r.msg = await screens.brbStart(); else if (b.action === 'end') r.msg = await screens.brbEnd(); else if (b.timer) screens.brbTimer(b.timer, b.secs); }
      return send(res, 200, Object.assign(r, { state: screens.brbState(), settings: Object.assign({}, screens.brbS(), { music: screens.brbS().musicRaw }), looks: SCR.LOOKS, scenes: await screens.sceneList() }));
    }
    if (p === '/api/bigcam') {
      let r = {};
      if (req.method === 'POST') { const b = await readBody(req); if (b.settings) screens.bigSet(b.settings); if (b.action === 'next') r.msg = screens.bigStep(1); else if (b.action === 'prev') r.msg = screens.bigStep(-1); else if (b.action === 'setup') r = await screens.bigSetupObs(PORT); }
      return send(res, 200, Object.assign(r, { state: screens.bigState(), settings: Object.assign({}, screens.bigS(), { music: screens.bigS().musicRaw }), sets: SCR.SETS, auto: SCR.AUTO_SET }));
    }
    if (p === '/api/links') {
      let r = {};
      if (req.method === 'POST') { const b = await readBody(req); if (b.settings) screens.linksSet(b.settings); if (b.action === 'now') r = screens.linksNow(); }
      return send(res, 200, Object.assign(r, { settings: screens.linksS(), nextMs: screens.linksNext() }));
    }
    if (p === '/api/stinger') {
      let r = {};
      if (req.method === 'POST') { const b = await readBody(req); if (b.settings) screens.stingSet(b.settings); if (b.action === 'play') r = b.scene ? await screens.toScene(String(b.scene), true) : (push(screens.stingEvent()), { ok: true }); }
      return send(res, 200, Object.assign(r, { settings: screens.stingS(), looks: SCR.LOOKS, scenes: await screens.sceneList() }));
    }
    if (p === '/api/theme') {
      if (req.method === 'POST') { const b = await readBody(req); if (['ets', 'football', 'heist'].includes(b.theme)) cfg.theme = b.theme; if (typeof b.auto === 'boolean') cfg.themeAuto = b.auto; saveCfg(); themePush(); }
      return send(res, 200, { theme: themeName(), chosen: ['ets', 'heist'].includes(cfg.theme) ? cfg.theme : 'football', auto: cfg.themeAuto !== false, game: currentGame() });
    }
    if (p === '/api/pen3d') { if (req.method === 'POST') { const b = await readBody(req); if (b.settings) p3Set(b.settings); } return send(res, 200, { settings: p3S(), live: p3Live(), missing: p3Files(), kickMs: BTX.MODES.shootout.timing.kick, clubs: require('./public/kits.js').KITS.map((k) => ({ id: k.id, name: k.name, ui: k.ui, words: k.words })) }); }
    if (p === '/api/gfx') { if (req.method === 'POST') { const b = await readBody(req); if (b.mode) { cfg.gfxLight = ['on', 'auto'].includes(b.mode) ? b.mode : 'off'; saveCfg(); } if (b.resetAuto) gfxAutoOn = false; pushGfx(); } return send(res, 200, { mode: gfxMode(), light: gfxOn(), auto: gfxAutoOn }); }
    if (p === '/api/undo') { if (req.method === 'POST') { const b = await readBody(req); return send(res, 200, Object.assign(undoRun(b.id), { list: undoState() })); } return send(res, 200, { list: undoState() }); }
    if (p === '/api/club' && req.method === 'GET') return send(res, 200, clubStats.state());
    if (p === '/api/club' && req.method === 'POST') { const b = await readBody(req); let r = { ok: true }; if (b.settings) clubStats.set(b.settings); if (b.open) r = clubStats.open(); if (b.close) r = clubStats.close(); if (b.goal) { r = clubStats.goal(b.goal.name, +b.goal.n || 1); if (r.ok && (+b.goal.n || 1) > 0) { const nm = b.goal.name; undoAdd('goal-' + nm, 'Goal: ' + nm, () => clubStats.goal(nm, -1)); if (replay.S().goalReplay) replayNow({ label: 'GOAL · ' + String(nm).toUpperCase() }).catch(() => {}); } } if (b.resetSeason) { const d = store.data; if (d.clubSeason) (d.clubSeasons = d.clubSeasons || []).push(d.clubSeason); d.clubSeason = null; store.save(); } return send(res, 200, Object.assign({}, r, clubStats.state())); }
    if (p === '/api/replay/obs' && req.method === 'GET') { try { return send(res, 200, await replayObsCheck()); } catch (e) { return send(res, 200, { error: e.message }); } }
    if (p === '/api/replay/test' && req.method === 'GET') return send(res, 200, Object.assign({ error: replayTest.lastError || null }, replayTest.state()));
    if (p === '/api/replay/test' && req.method === 'POST') {
      const b = await readBody(req);
      if (replayTest.running) return send(res, 200, Object.assign({ error: 'A test is already running' }, replayTest.state()));
      replayTest.run({ look: b.look === 'studio' || b.look === 'quick' ? b.look : undefined }).then((r) => { if (r && r.error) replayTest.lastError = r.error; else replayTest.lastError = null; feedAdd('Replay load test: ' + (r.error ? r.error : r.verdict === 'ok' ? 'all good' : 'OBS dropped frames, see Live › Replay'), r.verdict === 'ok' ? '#3dff9a' : '#ffb020'); }).catch(() => {});
      return send(res, 200, Object.assign({ ok: true }, replayTest.state()));
    }
    if (p === '/api/replay' && req.method === 'GET') return send(res, 200, replay.state());
    if (p === '/api/replay' && req.method === 'POST') {
      const b = await readBody(req); let r = { ok: true };
      if (b.settings) replay.set(b.settings);
      if (b.capture) r = await replayNow(b.capture);
      if (b.play) r = await replay.play(b.play.id, b.play);
      if (b.stop) r = await replay.stop();
      if (b.star) r = replay.star(b.star);
      if (b.remove) r = replay.remove(b.remove, !!b.deleteFile);
      if (b.ended) replay.ended(b.ended);
      if (b.overlayError) replay.overlayError(b.overlayError, b.msg);
      return send(res, 200, Object.assign({}, replay.state(), r));
    }
    if (p === '/api/analysis') {
      if (req.method === 'GET') return send(res, 200, { playing: replay.playing, analysis: replay.analysis || { shapes: [] }, boxes: replay.playing ? replay.boxes(replay.playing.look) : null, names: redPlayers().slice(0, 30) });
      const b = await readBody(req); let r = { ok: true };
      if (b.freeze != null) r = await replay.freeze(!!b.freeze);
      if (b.step) r = await replay.step(+b.step);
      if (b.frame) r = await replay.frame();
      if (b.shapes) r = Object.assign(replay.draw(b.shapes, b.hidden), r.image ? { image: r.image } : {});
      if (b.live) r = await replay.stop();
      return send(res, 200, Object.assign({ playing: replay.playing }, r));
    }
    if (p.startsWith('/replay-file/') && req.method === 'GET') {
      const k = p.slice(13); const f = k === 'music' ? replay.musicFile() : /^(wall|cam)$/.test(k) ? replay.picFile(k) : null;
      if (!f) return send(res, 404, { error: 'none' });
      const type = k === 'music' ? ((cfg.replay || {}).musicType || 'audio/mpeg') : 'image/png';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); return res.end(fs.readFileSync(f));
    }
    if (p === '/api/selftest' && req.method === 'GET') return send(res, 200, selfTestLast || { none: true, running: selfTestRunning });
    if (p === '/api/selftest' && req.method === 'POST') { const b = await readBody(req); return send(res, 200, await systemCheck({ screen: !!b.screen })); }
    if (p === '/api/saylog' && req.method === 'GET') return send(res, 200, { list: sayLog.slice(-40) });
    // ----- the overlay reports how its card queue is doing (System check reads it) -----
    if (p === '/api/overlay-state' && req.method === 'GET') return send(res, 200, overlayState || {});
    if (p === '/api/overlay-state' && req.method === 'POST') { const b = await readBody(req); overlayState = Object.assign({ at: Date.now() }, b); p3Timing(); if (b.err && b.err !== overlayErrLast) { overlayErrLast = b.err; console.warn('[overlay] ' + b.err); } return send(res, 200, { battle: battle.phase, replay: !!(replay.playing || replay.busy) }); }
    if (p === '/api/bp' && req.method === 'GET') return send(res, 200, Object.assign(bp.state(), { bets: (() => { const B = bp.bets(); return { yes: B.yes.length, nay: B.nay.length, settled: B.settled }; })(), settings: bp.S(), log: (bp.D().log || []).slice(-15).reverse(), meltdowns: bp.D().meltdowns || 0 }));
    if (p === '/api/bp' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.settings) bp.set(b.settings);
      if (b.add != null) bp.add(+b.add || 0, String(b.why || (+b.add > 0 ? 'Getting wound up' : 'Calming down')).slice(0, 40));
      if (b.set != null) bp.setTo(+b.set, 'Set by hand');
      return send(res, 200, Object.assign(bp.state(), { bets: (() => { const B = bp.bets(); return { yes: B.yes.length, nay: B.nay.length, settled: B.settled }; })(), settings: bp.S(), log: (bp.D().log || []).slice(-15).reverse(), meltdowns: bp.D().meltdowns || 0 }));
    }
    // ----- Starting Soon screen -----
    // v32: Twitch clips on your channel: list, pull one in (and play it), try a stuck one again, check the whole chain
    if (p === '/api/sgw/text' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(sgw.text(url.searchParams.get('sep') === 'comma' ? ', ' : url.searchParams.get('sep') === 'space' ? ' ' : '\n')); }
    if (p === '/api/ballon' && req.method === 'GET') return send(res, 200, ballon.state());
    if (p === '/api/ballon/screen' && req.method === 'GET') return send(res, 200, ballon.screen());
    if (p === '/api/ballon' && req.method === 'POST') {
      const b = await readBody(req) || {}; const a = String(b.action || ''); let r;
      if (a === 'add') r = ballon.add(b.nom || {});
      else if (a === 'edit') r = ballon.edit(String(b.id), b.nom || {});
      else if (a === 'remove') r = ballon.remove(String(b.id));
      else if (a === 'move') r = ballon.move(String(b.id), Number(b.dir));
      else if (a === 'settings') r = ballon.settings(b.settings || {});
      else if (a === 'open') r = ballon.open('you');
      else if (a === 'close') r = ballon.close('you');
      else if (a === 'reset') r = ballon.reset();
      else if (a === 'boss') r = ballon.setBoss(b.boss || {});
      else if (a === 'myvote') r = ballon.bossVote(String(b.id || ''));
      else if (a === 'unvote') r = ballon.removeMyVote();
      else if (a === 'review') r = ballon.review(String(b.review || ''), String(b.key || ''));
      else if (a === 'show') r = ballon.setShow(String(b.screen || 'off'), b.stage);
      else r = { error: 'Unknown action' };
      return send(res, 200, Object.assign({}, r, { state: ballon.state() }));
    }
    if (p === '/api/sgw/bot' && req.method === 'GET') {
      const S0 = botcheck.S(); const q = String(url.searchParams.get('q') || '').toLowerCase();
      return send(res, 200, { settings: S0, defaults: require('./lib/botcheck').DEF_POINTS, labels: require('./lib/botcheck').LABEL, trusted: S0.trusted.length,
        log: botcheck.d.log.filter((x) => !q || String(x.display || '').toLowerCase().includes(q) || String(x.key).includes(q)).slice(0, 100) });
    }
    if (p === '/api/spin') {
      if (req.method === 'POST') {
        const b = await readBody(req); let r = {};
        if (b.settings && typeof b.settings === 'object') { spin.set(b.settings); r.msg = 'Spin settings saved'; }
        const A = { start: () => spin.start(), test: () => spin.start({ test: true }), claim: () => spin.claim('you'), skip: () => spin.skip(), hide: () => spin.hide() };
        if (b.action && A[b.action]) { const x = A[b.action](); r = x.error ? { error: x.error } : { msg: x.msg }; }
        return send(res, 200, Object.assign(spin.state(), r));
      }
      return send(res, 200, spin.state());
    }
    if (p === '/api/sgw') {
      if (req.method === 'POST') {
        const b = await readBody(req); let r = {};
        if (b.settings) sgw.set(b.settings);
        const A = { open: () => sgw.open(), close: () => sgw.close(), toggle: () => sgw.toggle(), clear: () => sgw.clear() };
        if (b.action && A[b.action]) r.msg = A[b.action]();
        if (b.action === 'pick') { const x = sgw.pick(); r = x.error ? { error: x.error } : { msg: x.msg, winner: x.winner }; }
        if (b.add) { const x = sgw.add(b.add.name || b.add, b.add.platform); r = x.error ? { error: x.error } : { msg: x.msg }; }
        if (b.remove) { const x = sgw.remove(b.remove); r = x.error ? { error: x.error } : { msg: x.msg }; }
        if (b.review && typeof b.review === 'object') { const x = sgw.review(String(b.review.action || ''), String(b.review.key || ''), 'you'); r = x.error ? { error: x.error } : { msg: x.msg }; }
        if (b.bot && typeof b.bot === 'object') { botcheck.set(b.bot); sgw.rescore(); r = { msg: 'Bot check saved' }; }
        if (b.unblock) { delete sgw.st.blocked[String(b.unblock).toLowerCase()]; sgw.changed(); r = { msg: 'They can enter again' }; }
        if (b.check) r.check = { user: String(b.check), mins: watchMinsThisStream(b.platform || 'twitch', String(b.check)) };
        return send(res, 200, Object.assign(sgw.state(), r));
      }
      return send(res, 200, sgw.state());
    }
    if (p === '/api/gmeter') {
      if (req.method === 'POST') {
        const b = await readBody(req); let msg = null;
        if (b.settings) gmeter.set(b.settings);
        const A = { start: () => gmeter.start(), pause: () => gmeter.pause(), resume: () => gmeter.resume(), stop: () => gmeter.stop(), restart: () => gmeter.restart(), show: () => gmeter.show(true), hide: () => gmeter.show(false), clear: () => gmeter.clearEntries() };
        if (b.action && A[b.action]) msg = A[b.action]();
        if (b.action === 'pick') { const r = gmeter.pick(); msg = r.error || 'Winner: ' + r.winner.name; }
        if (b.add != null && isFinite(+b.add)) msg = gmeter.add(+b.add, 'by hand');
        if (b.value != null && isFinite(+b.value)) msg = gmeter.setValue(+b.value);
        if (b.goal != null && +b.goal > 0) msg = gmeter.setGoal(+b.goal);
        if (b.addTime != null && isFinite(+b.addTime)) msg = gmeter.addTime(+b.addTime * 1000);
        if (b.time != null && isFinite(+b.time)) msg = gmeter.setTime(+b.time * 1000);
        if (typeof b.at === 'string') msg = gmeter.setAt(b.at);
        if (typeof b.enable === 'boolean') msg = gmeter.enable(b.enable);
        return send(res, 200, Object.assign(gmeter.state(), { msg }));
      }
      return send(res, 200, gmeter.state());
    }
    if (p === '/api/replay/pos') {
      if (req.method === 'POST') { const b = await readBody(req); let r = { error: 'nothing to do' }; if (b.to != null) r = await replay.seekTo(+b.to); else if (b.by != null) r = await replay.jump(+b.by); else if (b.pause != null) r = await replay.pauseToggle(); return send(res, 200, r); }
      const st = await replay.status(); return send(res, 200, st ? Object.assign({ ok: true }, st) : { ok: false, playing: false });
    }
    if (p === '/api/replay/twitch' && req.method === 'GET') return send(res, 200, await clips.list({ days: +url.searchParams.get('days') || 7 }));
    if (p === '/api/replay/twitch' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.pull) return send(res, 200, await pullTwitchClips(true));
      if (b.retry) return send(res, 200, clips.retry(String(b.retry)));
      if (b.check) return send(res, 200, await clips.check());
      if (b.get) {
        b.get = require('./lib/clips').Clips.idOf(b.get);
        const have = clips.have()[String(b.get)];
        if (have) { if (b.play) { const r = await replay.play(have, {}); return send(res, 200, Object.assign({ ok: !r.error, have: true, clip: have }, r)); } return send(res, 200, { ok: true, have: true, clip: have }); }
        return send(res, 200, clips.get(String(b.get), { play: !!b.play, label: b.label || '' }));
      }
      return send(res, 400, { error: 'nothing to do' });
    }
    if (p === '/api/starting-words') {
      const W = cfg.startingWords || (cfg.startingWords = {});
      if (req.method === 'POST') {
        const b = await readBody(req);
        if (typeof b.look === 'string' && (b.look === 'auto' || SCR.START_WORDS[b.look])) W.look = b.look;
        if (b.custom && typeof b.custom === 'object') { W.custom = W.custom || {}; for (const [lk, f] of Object.entries(b.custom)) { if (!SCR.START_WORDS[lk] || !f || typeof f !== 'object') continue; const o = {}; for (const k of Object.keys(SCR.START_FIELDS)) if (f[k] != null && String(f[k]).trim()) o[k] = String(f[k]).trim().slice(0, 60); W.custom[lk] = o; } }
        if (b.reset && SCR.START_WORDS[b.reset] && W.custom) delete W.custom[b.reset];
        saveCfg(); stPush();
      }
      return send(res, 200, { look: W.look || 'auto', now: stLook(), game: currentGame(), fields: SCR.START_FIELDS, defaults: SCR.START_WORDS, custom: W.custom || {}, looks: SCR.LOOKS, words: stWords() });
    }
    if (p === '/api/starting' && req.method === 'GET') { stFindScenes(false).catch(() => {}); const st = stState(); st.found = { scenes: stScenes.names, at: stScenes.at, onAir: obs.onAirScene || null, obs: !!obs.ready, srcActive: ST.srcActive, srcAt: ST.srcAt }; let scenes = []; try { if (obs.ready) scenes = ((await obs.req('GetSceneList')).scenes || []).map((x) => x.sceneName).reverse(); } catch (e) { /* ignore */ } return send(res, 200, Object.assign(st, { settings: stS(), scenes })); }
    if (p === '/api/starting' && req.method === 'POST') {
      const b = await readBody(req); let r = { ok: true };
      if (b.settings) {
        const c = Object.assign({}, cfg.starting || {}), n = b.settings;
        for (const k of ['mins', 'secs', 'switchDelay', 'rotateSecs']) if (n[k] != null && n[k] !== '') c[k] = +n[k];
        for (const k of ['title', 'tonight', 'alerts', 'scene', 'startScene', 'pic']) if (typeof n[k] === 'string') c[k] = n[k];
        for (const k of ['autoSwitch', 'autoStart', 'chatCountdown', 'zoom', 'chat', 'arrivals', 'spotlight', 'ticker', 'socials', 'cardsStat']) if (typeof n[k] === 'boolean') c[k] = n[k];
        if (n.music) c.music = musicSet(n.music);
        cfg.starting = c; saveCfg(); if (!ST.running && !ST.ended) ST.left = null;
      }
      if (b.upload) {
        const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.upload || '');
        if (!m) r = { error: 'Use a PNG, JPG or WEBP picture' };
        else { const buf = Buffer.from(m[2], 'base64'); if (buf.length > 15 * 1024 * 1024) r = { error: 'Too big (max 15 MB)' }; else {
          const c = Object.assign({}, cfg.starting || {}); c.pics = Array.isArray(c.pics) ? c.pics : [];
          if (c.pics.length >= 12) r = { error: 'Up to 12 pictures: remove one first' };
          else { fs.mkdirSync(ST_DIR, { recursive: true }); const id = Date.now().toString(36), ext = m[1] === 'jpeg' ? 'jpg' : m[1]; fs.writeFileSync(path.join(ST_DIR, id + '.' + ext), buf); c.pics.push({ id, ext, v: 1 }); c.pic = id; cfg.starting = c; saveCfg(); } } }
      }
      if (b.removePic) { const c = Object.assign({}, cfg.starting || {}); const x = (c.pics || []).find((q) => q.id === b.removePic); if (x) { try { fs.unlinkSync(path.join(ST_DIR, x.id + '.' + x.ext)); } catch (e) { /* gone */ } c.pics = c.pics.filter((q) => q !== x); if (c.pic === x.id) c.pic = c.pics.length ? c.pics[c.pics.length - 1].id : 'bsn'; cfg.starting = c; saveCfg(); } }
      const a = b.action;
      if (a === 'start') stStart(); else if (a === 'pause') stPause(); else if (a === 'stop') stStop(); else if (a === 'set') stSet(b.secs); else if (a === 'reset') stReset(); else if (a === 'add') stAdd(+b.secs || 30);
      else if (a === 'live') stLive(true); else if (a === 'off') stOff(); else if (a === 'onair') stSource(b.active === true);
      else if (a === 'find') { await stFindScenes(true); }
      else if (a === 'test') {
        // preview: a few of your real cards say hello (nothing is saved)
        const ppl = store.all().filter((v) => !v.isBroadcaster && hasCard(v)).sort(() => Math.random() - 0.5).slice(0, 6);
        const lines = ['Hi Boss! Ready for kick-off', 'Lets gooo', 'Bosshausens tonight?', 'Eyepatch game when?', 'Evening all', 'GODFATHER better behave tonight'];
        const wasOn = ST.on; if (!ST.on) { ST.on = true; ST.arrivals.clear(); }
        ppl.forEach((v, i) => setTimeout(() => { startingChat(Object.keys(v.seenOn || { twitch: 1 })[0] || 'twitch', { login: v.login || v.display, display: v.display, text: lines[i % lines.length], badges: i % 3 === 0 ? ['subscriber'] : [] }, v); if (i === ppl.length - 1 && !wasOn) setTimeout(() => { if (!ST.running) { ST.on = false; ST.arrivals.clear(); stPush(); } }, 15000); }, 400 + i * 1300));
      }
      else if (b.settings || b.upload || b.removePic) stPush();
      return send(res, 200, Object.assign(stState(), r, { settings: stS() }));
    }
    { const m = /^\/starting-pic\/([a-z0-9]{4,20})\.(png|jpg|webp)$/.exec(p); if (m && req.method === 'GET') { const f = path.join(ST_DIR, m[1] + '.' + m[2]); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': m[2] === 'jpg' ? 'image/jpeg' : 'image/' + m[2], 'Cache-Control': 'max-age=86400' }); return fs.createReadStream(f).pipe(res); } }
    if (p === '/api/replay/file' && req.method === 'POST') {
      const b = await readBody(req), k = String(b.kind || '');
      if (!/^(cam|wall|music)$/.test(k)) return send(res, 200, { error: 'bad kind' });
      const f = k === 'music' ? path.join(DATA, 'replay-music.audio') : path.join(DATA, 'replay-' + k + '.png');
      if (b.remove) { try { fs.unlinkSync(f); } catch (e) { /* none */ } return send(res, 200, Object.assign({ ok: true }, replay.state())); }
      const m = k === 'music' ? /^data:(audio\/(?:mpeg|mp3|wav|x-wav|wave|ogg|webm|aac|mp4|x-m4a));base64,([A-Za-z0-9+/=]+)$/.exec(b.data || '') : /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.data || '');
      if (!m) return send(res, 200, { error: k === 'music' ? 'Use an MP3, WAV, OGG or M4A file' : 'Use a PNG, JPG or WEBP picture' });
      const buf = Buffer.from(m[2], 'base64'); if (buf.length > 12 * 1024 * 1024) return send(res, 200, { error: 'Too big (max 12 MB)' });
      fs.writeFileSync(f, buf);
      cfg.replay = Object.assign({}, cfg.replay, { v: Date.now() }, k === 'music' ? { musicType: m[1] === 'audio/mp3' ? 'audio/mpeg' : m[1] } : {}); saveCfg();
      return send(res, 200, Object.assign({ ok: true }, replay.state()));
    }
    if (p.startsWith('/replay/clip/') && req.method === 'GET') return replay.serve(decodeURIComponent(p.slice(13)), req, res);
    if (p === '/redcard-image' && req.method === 'GET') { try { const buf = fs.readFileSync(RC_FILE); res.writeHead(200, { 'Content-Type': (cfg.redCard || {}).imageType || 'image/png', 'Cache-Control': 'no-store' }); return res.end(buf); } catch (e) { return send(res, 404, { error: 'no image' }); } }
    // ----- beat the boss -----
    if (p === '/api/teampens' && req.method === 'GET') return send(res, 200, { settings: tpS(), status: battle.status() });
    if (p === '/api/teampens' && req.method === 'POST') {
      const b = await readBody(req); let r = { ok: true };
      if (b.settings) tpSet(b.settings);
      if (b.open) r = startTeams({ size: +b.open.size, make: b.open.make }) ? { ok: true } : { error: 'A battle is already running' };
      if (b.test) r = testTeams({ size: +b.test.size, make: b.test.make }) ? { ok: true } : { error: 'A battle is already running' };
      if (b.skip) r = battle.teamSkip();
      if (b.pause) r = battle.teamPause();
      if (b.end) { if (battle.tm) battle.cancel(); }
      return send(res, 200, Object.assign({}, r, { settings: tpS(), status: battle.status() }));
    }
    if (p === '/api/boss' && req.method === 'GET') return send(res, 200, Object.assign(bossInfo(), { status: battle.status() }));
    if (p === '/api/boss' && req.method === 'POST') {
      const b = await readBody(req); let r = { ok: true };
      if (b.settings) { cfg.boss = Object.assign({}, cfg.boss, { stakes: b.settings.stakes, floor: +b.settings.floor, bountyStart: +b.settings.bountyStart, bountyStep: +b.settings.bountyStep, subsFirst: b.settings.subsFirst !== false }); saveCfg(); }
      if (b.start) r = battle.openBoss(() => { lastBattleLive = liveMs; }) ? { ok: true } : { error: 'A battle is already running' };
      if (b.pick) r = battle.bossInput(String(b.pick).toUpperCase());
      if (b.resetSeason) { const B = bossData(); Object.assign(B, { form: 0, wins: 0, losses: 0, bounty: bossS().bountyStart, slayers: {} }); store.save(); }
      return send(res, 200, Object.assign({}, r, bossInfo(), { status: battle.status() }));
    }
    // ----- viewer of the stream -----
    if (p === '/api/mvp' && req.method === 'GET') return send(res, 200, { list: mvpStandings().slice(0, 10), weights: mvpWeights(), auto: cfg.mvpAuto !== false, revealed: (store.data.meta || {}).mvpNo === streamNo(), pick: (cfg.mvpPick || {})[streamNo()] || null });
    if (p === '/api/mvp' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.weights) { cfg.mvpWeights = Object.fromEntries(Object.entries(b.weights).filter(([k]) => ['support', 'chat', 'battles', 'watch', 'raids'].includes(k)).map(([k, v]) => [k, Math.max(0, Math.min(5, +v || 0))])); saveCfg(); }
      if (b.auto != null) { cfg.mvpAuto = !!b.auto; saveCfg(); }
      if (b.pick !== undefined) { cfg.mvpPick = Object.assign({}, cfg.mvpPick, { [streamNo()]: b.pick || null }); saveCfg(); }
      if (b.reveal) { const r = await mvpReveal(); if (r.error) return send(res, 200, r); }
      return send(res, 200, { ok: true, list: mvpStandings().slice(0, 10), weights: mvpWeights(), auto: cfg.mvpAuto !== false, revealed: (store.data.meta || {}).mvpNo === streamNo() });
    }
    // ----- chat overlay settings -----
    if (p === '/api/chatoverlay' && req.method === 'GET') return send(res, 200, Object.assign(chatS(), { on: showOn('chat') }));
    if (p === '/api/chatoverlay' && req.method === 'POST') { const b = await readBody(req); cfg.chatOverlay = Object.assign({}, cfg.chatOverlay, { max: +b.max || 6, fadeSecs: b.fadeSecs != null ? +b.fadeSecs : 40, ovr: b.ovr !== false, platforms: b.platforms !== false, dodge: b.dodge !== false, size: +b.size || 19, oldSource: String(b.oldSource || '').slice(0, 120) }); saveCfg(); push({ type: 'chatcfg', S: chatS() }); if (b.test) push({ type: 'chat', id: 't' + Date.now(), platform: 'twitch', display: 'TestViewer', text: 'This is what chat looks like on stream', color: '#f6d77a', ovr: 78, sub: true, first: false, S: chatS() }); return send(res, 200, Object.assign(chatS(), { on: showOn('chat') })); }
    // ----- fun counters -----
    if (p === '/api/counters' && req.method === 'GET') return send(res, 200, Object.assign(counters.all(), { settings: counters.list() }));
    if (p === '/api/counters' && req.method === 'POST') {
      const b = await readBody(req); let r = { ok: true };
      if (b.save) counters.save(b.save);
      if (b.add) r = counterAdd(b.add.id, +b.add.d || 1);
      if (b.undo) r = counterUndo(b.undo);
      if (b.set) r = counters.setCounts(b.set.id, b.set.tonight, b.set.season, b.set.best, b.set.lock);
      return send(res, 200, Object.assign({}, r, counters.all(), { settings: counters.list() }));
    }
    // ----- chat bots -----
    if (p === '/api/bots' && req.method === 'GET') return send(res, 200, { builtIn: BOT_NAMES, mine: cfg.bots || [], suffix: cfg.botSuffix !== false, found: store.all().filter((v) => !v.test && isBot(v.login)).map((v) => v.display) });
    if (p === '/api/bots' && req.method === 'POST') {
      const b = await readBody(req);
      if (Array.isArray(b.mine)) { cfg.bots = b.mine.map((x) => String(x).toLowerCase().replace(/^@/, '').trim()).filter((x) => /^[a-z0-9_]{2,30}$/.test(x)).slice(0, 100); saveCfg(); }
      if (b.suffix != null) { cfg.botSuffix = !!b.suffix; saveCfg(); }
      const gone = b.clean ? removeBotCards() : [];
      return send(res, 200, { ok: true, removed: gone, mine: cfg.bots || [] });
    }
    // ======== v19 APIs ========
    if (p === '/api/show' && req.method === 'GET') return send(res, 200, Object.assign(showState(), { challenges: challenges.settings().show, nextTimer: cfg.showNextTimer !== false, ticker: bsn.S().on, layout: layoutState(), widgets: widgets() }));
    if (p === '/api/show' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.k === 'challenges') challenges.setSettings({ show: !!b.on });
      else if (b.k === 'nextTimer') { cfg.showNextTimer = !!b.on; saveCfg(); pushNext(); }
      else if (b.k && SHOW_DEF[b.k] != null) { cfg.show = Object.assign({}, cfg.show, { [b.k]: !!b.on }); saveCfg(); pushShow(); if (b.k === 'chat') chatOldSource(!!b.on); if (b.k === 'subGoal') push(subGoalState()); if (b.k === 'scores') lastScoresSig = ''; }
      if (b.panic != null) setPanic(!!b.panic);
      return send(res, 200, Object.assign(showState(), { challenges: challenges.settings().show, nextTimer: cfg.showNextTimer !== false }));
    }
    if (p === '/api/layout' && req.method === 'GET') { const g = url.searchParams.get('group') || layoutGroup(); return send(res, 200, { group: g, live: layoutGroup(), pos: ((cfg.layouts || {})[g]) || {}, widgets: widgets(), groups: ['fc', 'truck', 'arc', 'gta', 'other'] }); }
    if (p === '/api/layout' && req.method === 'POST') {
      const b = await readBody(req), g = ['fc', 'truck', 'arc', 'gta', 'other'].includes(b.group) ? b.group : layoutGroup();
      cfg.layouts = cfg.layouts || {}; const L = cfg.layouts[g] = cfg.layouts[g] || {};
      if (b.reset) { delete cfg.layouts[g]; }
      else if (b.copyFrom && cfg.layouts[b.copyFrom]) cfg.layouts[g] = JSON.parse(JSON.stringify(cfg.layouts[b.copyFrom]));
      else if (b.id && widgets()[b.id]) { if (b.clear) delete L[b.id]; else L[b.id] = { x: Math.round(Math.max(0, Math.min(1900, +b.x || 0))), y: Math.round(Math.max(0, Math.min(1070, +b.y || 0))), s: Math.max(0.5, Math.min(1.6, +b.s || 1)) }; }
      saveCfg(); push(layoutState());
      return send(res, 200, { ok: true, group: g, pos: (cfg.layouts || {})[g] || {} });
    }
    if (p === '/api/results' && req.method === 'GET') return send(res, 200, Object.assign(results.state(), { settings: results.S(), line: results.line() }));
    if (p === '/api/results' && req.method === 'POST') {
      const b = await readBody(req); let r = { ok: true };
      if (b.settings) results.set(b.settings);
      if (b.add != null || b.score) { r = results.add(b.add != null ? +b.add : null, b.score || null); if (r && r.ok) { raidNight.gameOver(); try { if (squad.D().list.length) squad.matchDone(b.score ? { us: +b.score.us, them: +b.score.them } : null); } catch (e) { /* ignore */ } } }
      if (b.undo) r = results.undo();
      if (b.edit) r = results.edit(b.edit.counts, b.edit.scope);
      if (b.newSession) r = results.newSession();
      if (r && r.ok && (b.add != null || b.score) && b.ticker !== false) { const st = results.state(); if (st.last && st.last.us != null && st.team.type !== 'custom') addStory({ cat: 'Full time', text: st.team.name + ' ' + st.last.us + '-' + st.last.them + (st.last.opp ? ' ' + st.last.opp : ''), keep: 'stream' }); }
      return send(res, 200, Object.assign({}, r, results.state(), { settings: results.S(), line: results.line() }));
    }
    if (p === '/api/stories' && req.method === 'GET') return send(res, 200, { list: stories().slice().reverse(), streamNo: (store.data.meta && store.data.meta.streamNo) || 0, cats: ['Dressing room', 'Transfer news', 'Breaking', 'Rival watch', 'Press conference', 'Injury news', 'Fan zone', 'Full time'] });
    if (p === '/api/stories' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.add) { const st = addStory(b.add); if (!st) return send(res, 200, { error: 'Type a headline first' }); }
      if (b.idea) return send(res, 200, { ideas: headlineIdeas(b.idea) });
      const st = b.id && stories().find((x) => x.id === b.id);
      if (st && b.remove) stories().splice(stories().indexOf(st), 1);
      if (st && b.approve) st.pending = false;
      if (st && b.toggle) { st.off = !st.off; if (st.keep === 'stream') st.no = (store.data.meta && store.data.meta.streamNo) || 0; }
      if (st && b.breaking && showOn('breaking')) push({ type: 'breaking', label: String(st.cat).toUpperCase(), text: String(st.text).toUpperCase() });
      store.save(); push({ type: 'bsnReload' });
      return send(res, 200, { ok: true, list: stories().slice().reverse() });
    }
    if (p === '/api/calc' && req.method === 'POST') {
      const b = await readBody(req), v0 = store.data.viewers[b.key || '']; if (!v0) return send(res, 200, { error: 'Pick a viewer' });
      const v = store.primary(v0) || v0, now = Date.now(), before = card(v);
      const clone = JSON.parse(JSON.stringify(v)); S.migrate(clone);
      calcApply(clone, b, now, true);
      const after = card(clone), capped = JSON.parse(JSON.stringify(v)); S.migrate(capped); calcApply(capped, b, now, false); const today = card(capped);
      if (!b.apply) return send(res, 200, { before, after, today, bankedLater: after.ovr - today.ovr });
      const snapB = snap(v), did = calcApply(v, b, now, !!b.instant);
      if (did.length) { editLog(v, 'Calculator' + (b.source === 'tangia' ? ' (Tangia)' : '') + ': ' + did.join(', ') + (b.reason ? ' · ' + String(b.reason).slice(0, 80) : ''), snapB); S.releaseBank(v, R, now); if (b.bits && b.source === 'tangia') { logSup(v, 'bits', +b.bits); streamLog.event('bits', +b.bits, v.key, { who: v.display }); earnAdd(v, 'twitch', 'bits', +b.bits); } store.save(); }
      const nowC = card(v);
      if (b.show && did.length) { await withAvatar(v).catch(() => {}); push({ type: 'levelup', kind: 'upgrade', card: nowC, raised: S.STAT_KEYS.filter((k) => nowC.stats[k] > before.stats[k]).map((k) => ({ k, from: before.stats[k], to: nowC.stats[k] })), ovrFrom: before.ovr, tierUp: nowC.tier !== before.tier && nowC.ovr > before.ovr, tierFrom: before.tier, reason: b.reason || 'Card upgraded' }); }
      return send(res, 200, { ok: true, did, card: nowC });
    }
    if (p === '/api/tangia' && req.method === 'GET') { const T = tangiaS(); return send(res, 200, Object.assign({}, T, { lastSync: (store.data.bitsSync || {}).at || 0, pattern: !!tangiaRegex(T.sample) })); }
    if (p === '/api/tangia' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.settings) { cfg.tangia = Object.assign({}, cfg.tangia, { chat: !!b.settings.chat, sync: !!b.settings.sync, alert: !!b.settings.alert, bot: String(b.settings.bot || '').replace(/^@/, '').slice(0, 30), sample: String(b.settings.sample || '').slice(0, 200) }); saveCfg(); }
      if (b.check) { const re = tangiaRegex(b.check), m = re && re.exec(b.check); return send(res, 200, m ? { found: { name: m[1], what: (m[2] || '').trim(), bits: +String(m[3]).replace(/,/g, '') } } : { error: 'Could not find a name and a number of bits in that message' }); }
      if (b.sync) { try { return send(res, 200, await tangiaSync(true)); } catch (e) { return send(res, 200, { error: e.message }); } }
      return send(res, 200, Object.assign({ ok: true }, tangiaS()));
    }
    if (p === '/api/move' && req.method === 'GET') { let l = { filters: [] }; try { l = await move.list(); } catch (e) { l = { error: e.message, filters: [] }; } return send(res, 200, Object.assign(l, { binds: move.binds(), events: MOVEX.EVENTS, corner: !!cfg.moveCorner })); }
    if (p === '/api/move' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.bind) move.set(b.bind.ev, b.bind.filter ? { source: b.bind.source, filter: b.bind.filter } : null);
      if (b.corner != null) { cfg.moveCorner = !!b.corner; saveCfg(); }
      if (b.test) { try { await move.play(b.test.source, b.test.filter); } catch (e) { return send(res, 200, { error: e.message }); } }
      return send(res, 200, { ok: true, binds: move.binds(), corner: !!cfg.moveCorner });
    }
    if (p === '/api/subgoal' && req.method === 'POST') { const b = await readBody(req); cfg.subGoal = { target: Math.max(1, Math.min(1000, Math.round(+b.target) || 10)), label: String(b.label || 'SUB GOAL').slice(0, 30), rewards: (Array.isArray(b.rewards) ? b.rewards : []).map((r) => ({ at: Math.max(1, Math.round(+r.at) || 1), text: String(r.text || '').slice(0, 60) })).filter((r) => r.text).slice(0, 8) }; saveCfg(); push(subGoalState()); return send(res, 200, Object.assign({ ok: true }, subGoalState(), { settings: cfg.subGoal })); }
    if (p === '/api/subgoal' && req.method === 'GET') return send(res, 200, Object.assign(subGoalState(), { settings: cfg.subGoal || { target: 10, label: 'SUB GOAL', rewards: [] } }));
    if (p === '/api/chatlog' && req.method === 'GET') return send(res, 200, { list: chatLog.slice(-30).reverse() });
    if (p === '/api/feature' && req.method === 'POST') {
      const b = await readBody(req), m = chatLog.find((x) => x.id === b.id); if (!m) return send(res, 200, { error: 'Message not found' });
      if (!showOn('featured')) return send(res, 200, { error: 'Featured messages are switched off (On screen page)' });
      const v = m.key && store.data.viewers[m.key]; if (v) await withAvatar(v).catch(() => {});
      push({ type: 'featured', text: m.text, display: m.display, platform: m.platform, card: v ? card(v) : null, secs: 10 });
      return send(res, 200, { ok: true });
    }
    if (p === '/api/marker' && req.method === 'POST') { const b = await readBody(req); try { const m = await twitch.marker(b.desc || 'BBR moment'); feedAdd('Marked a moment' + (m ? ' at ' + Math.floor(m.position_seconds / 60) + ':' + String(m.position_seconds % 60).padStart(2, '0') : ''), '#4dc3ff'); return send(res, 200, { ok: true }); } catch (e) { return send(res, 200, { error: e.message + (/401|403|scope/.test(e.message) ? ' (press Reconnect Twitch)' : '') }); } }
    if (p === '/api/precheck' && req.method === 'GET') return send(res, 200, { list: await precheck() });
    if (p === '/api/discord' && req.method === 'GET') return send(res, 200, { webhook: !!(cfg.discord || {}).webhook, auto: !!(cfg.discord || {}).auto, queenPing: (cfg.discord || {}).queenPing !== false });
    if (p === '/api/discord' && req.method === 'POST') { const b = await readBody(req); if (b.webhook != null || b.auto != null || b.queenPing != null) { cfg.discord = Object.assign({}, cfg.discord, b.webhook != null ? { webhook: String(b.webhook).trim() } : {}, b.auto != null ? { auto: !!b.auto } : {}, b.queenPing != null ? { queenPing: !!b.queenPing } : {}); saveCfg(); } if (b.test) { try { return send(res, 200, await postDiscord(creditsData(0))); } catch (e) { return send(res, 200, { error: e.message }); } } return send(res, 200, { ok: true }); }
    if (p === '/api/scenes' && req.method === 'GET') {
      const sc = cfg.scenes || {}, top = lbRows('cards', 'all', 5).rows.map((r) => ({ name: r.display, ovr: r.ovr, tier: r.tier }));
      const last = Object.values(store.data.streams || {}).sort((a, b) => b.no - a.no).find((x) => x.no !== streamNo() && x.t && x.t.messages > 0);
      const s0 = streamLog.cur && isLive() ? streamLog.cur() : null;
      return send(res, 200, { tonight: sc.tonight || '', startMin: sc.startMin || 5, top, checkins: s0 ? s0.t.checkins : 0, next: nextStreamCache, results: results.tonight().length ? results.line() : '', lastNo: last ? last.no : null,
        lastLine: last && (last.t.follows + last.t.subs + last.t.gifted + last.t.bits) > 0 ? (last.t.follows + ' follows · ' + (last.t.subs + last.t.gifted) + ' subs + gifts · ' + last.t.bits + ' bits') : '', challenges: challenges.state().list.slice(0, 3), accent: accent(), thanks: s0 ? creditsData(0).sections.slice(0, 3) : [] });
    }
    if (p === '/api/scenes' && req.method === 'POST') { const b = await readBody(req); cfg.scenes = { tonight: String(b.tonight || '').slice(0, 100), startMin: Math.max(1, Math.min(60, +b.startMin || 5)) }; saveCfg(); return send(res, 200, { ok: true }); }
    // ----- live desk -----
    if (p === '/api/live' && req.method === 'GET') {
      const pf = (P) => ({ on: P.configured ? P.configured() : false, connected: !!P.connected, live: !!P.live });
      return send(res, 200, {
        live: isLive(), liveSince, scene: obs.onAirScene || null, obs: obs.ready, next: nextInfo(), battle: battle.phase, nextMode: chooseMode(null, true),
        platforms: { twitch: pf(twitch), kick: pf(kick), youtube: pf(youtube) },
        toggles: { battles: !cfg.battlesPaused && cfg.battlesEnabled !== false, hold: cfg.holdOffScene !== false, tickerFront: (cfg.tickerLayer || 'overlay') === 'front', camChat: cam.settings().chat, camLock: cam.settings().lock, raidNight: raidNight.S().on },
        challenge: challenges.data().list[0] || null, held: sceneHeld ? heldList.length : 0, raid: raidNight.info().night, queen: raidNight.state(), viewers: viewerCache, feed: feed.slice(-25).reverse(), pins: cfg.pins || null, phone: phoneInfo()
      });
    }
    if (p === '/api/live' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.toggle) {
        const on = !!b.toggle.on;
        if (b.toggle.id === 'battles') { cfg.battlesEnabled = true; pauseBattles(!on); }
        else if (b.toggle.id === 'hold') { cfg.holdOffScene = on; saveCfg(); }
        else if (b.toggle.id === 'tickerFront') { const r = await setTickerLayer(on ? 'front' : 'behind'); if (r && r.error) return send(res, 200, r); }
        else if (b.toggle.id === 'camChat') cam.setSettings({ chat: on });
        else if (b.toggle.id === 'camLock') cam.setSettings({ lock: on });
        else if (b.toggle.id === 'raidNight') raidNight.set({ on });
        feedAdd('You: ' + b.toggle.id + ' ' + (on ? 'on' : 'off'), '#a7b0ba');
      }
      if (Array.isArray(b.pins)) { cfg.pins = b.pins.filter((x) => typeof x === 'string').slice(0, 24); saveCfg(); }
      if (b.swap && ['shootout', 'race', 'arc'].includes(b.swap)) { cfg.nextModeOnce = b.swap; saveCfg(); pushNext(); }
      if (b.phone) { cfg.phone = Object.assign({}, cfg.phone, { on: !!b.phone.on }); if (!cfg.phone.key) cfg.phone.key = crypto.randomBytes(9).toString('base64url'); saveCfg(); startPhone(); }
      return send(res, 200, { ok: true, phone: phoneInfo() });
    }
    // ----- leaderboards -----
    if (p === '/api/lb' && req.method === 'GET') {
      const b = lbRows(url.searchParams.get('cat'), url.searchParams.get('period'), +url.searchParams.get('top') || 100);
      b.rows.forEach((r) => delete r.card);
      return send(res, 200, Object.assign(b, { cats: Object.entries(LB_CATS).map(([id, c]) => ({ id, label: c.label, allOnly: !!c.allOnly })), rotating: !!lbRotate, settings: { start: !!cfg.lbStart, chat: !!cfg.lbChat } }));
    }
    if (p === '/api/lb' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.show) showLb(b.show.cat, b.show.period, b.show.top, b.show.secs);
      if (b.rotate != null) setLbRotate(!!b.rotate, b.secs);
      if (b.settings) { if (b.settings.start != null) cfg.lbStart = !!b.settings.start; if (b.settings.chat != null) cfg.lbChat = !!b.settings.chat; saveCfg(); }
      return send(res, 200, { ok: true, rotating: !!lbRotate });
    }
    // ----- card editor + history import -----
    // ----- v29: card safety (freeze / guard / undo / card check) + the card editor -----
    if (p === '/api/safety' && req.method === 'GET') { const ck = safety.check(); return send(res, 200, Object.assign(safety.state(), { check: { count: ck.list.length, list: ck.list.slice(0, 60), streams: ck.streams, ghosts: ck.ghosts } })); }
    if (p === '/api/safety' && req.method === 'POST') {
      const b = await readBody(req); let r;
      if (b.action === 'freeze') r = safety.freeze(true);
      else if (b.action === 'unfreeze' || b.action === 'apply') r = safety.release(true);
      else if (b.action === 'discard') r = safety.release(false);
      else if (b.action === 'undo') { if (b.apply) autoBackup('before undoing ' + (b.mins || 10) + ' minutes of card points'); r = safety.undo(b.mins || 10, !!b.apply); }
      else if (b.action === 'fix') { autoBackup('before the card check fix'); r = safety.fix(Array.isArray(b.keys) ? b.keys : null); }
      else if (b.action === 'settings') r = { guard: safety.set(b.settings || {}) };
      else r = { error: 'unknown action' };
      return send(res, 200, Object.assign({}, r, { state: safety.state() }));
    }
    if (p === '/api/card29' && req.method === 'GET') {
      const v = store.data.viewers[url.searchParams.get('key') || '']; if (!v) return send(res, 404, { error: 'not found' });
      return send(res, 200, cardDetail(v));
    }
    if (p === '/api/card29' && req.method === 'POST') {
      const b = await readBody(req), v = store.data.viewers[b.key || '']; if (!v) return send(res, 404, { error: 'not found' });
      S.migrate(v);
      const before = snap(v), did = [], c0 = card(v);
      if (b.rebuild) { const r = safety.fixOne(v); if (r) did.push('streak rebuilt from history ' + r.from + ' → ' + r.to); else did.push('streak already matches the history'); }
      const t0 = TK.tk(v);
      if (b.streak != null && b.streak !== '' && +b.streak !== (t0.streak || 0)) { const n = Math.max(0, Math.min(500, Math.round(+b.streak))); did.push('streak ' + (t0.streak || 0) + ' → ' + n); t0.streak = n; if ((t0.bestStreak || 0) < n) t0.bestStreak = n; }
      if (b.best != null && b.best !== '' && +b.best !== (t0.bestStreak || 0)) { const n = Math.max(t0.streak || 0, Math.min(500, Math.round(+b.best))); did.push('best streak ' + (t0.bestStreak || 0) + ' → ' + n); t0.bestStreak = n; }
      if (b.savers != null && b.savers !== '' && +b.savers !== (t0.savers || 0)) { const n = Math.max(0, Math.min(10, Math.round(+b.savers))); did.push('savers ' + (t0.savers || 0) + ' → ' + n); t0.savers = n; }
      if (b.tickets != null && b.tickets !== '' && +b.tickets !== (t0.bal || 0)) { const n = Math.max(0, Math.min(100000, Math.round(+b.tickets))); did.push('tickets ' + (t0.bal || 0) + ' → ' + n); t0.bal = n; }
      if (b.stats && typeof b.stats === 'object') {
        // the number you type is what the card shows: the app works out the extra points needed
        v.manual = v.manual || {};
        for (const [k, want] of Object.entries(b.stats)) {
          if (!S.STAT_KEYS.includes(k) || want === '' || want == null || !isFinite(+want)) continue;
          const cur = card(v).stats[k], d = Math.round(+want) - cur; if (!d) continue;
          v.manual[k] = Math.max(-98, Math.min(98, (v.manual[k] || 0) + d)); did.push(k + ' ' + cur + ' → ' + Math.round(+want));
        }
      }
      if (typeof b.lock === 'boolean' && b.lock !== !!v.cardLock) { if (b.lock) v.cardLock = true; else delete v.cardLock; did.push(b.lock ? 'card locked' : 'card unlocked'); }
      if (!did.length) return send(res, 200, Object.assign(cardDetail(v), { ok: true, did: [] }));
      editLog(v, 'Card editor: ' + did.join(', ') + (b.reason ? ' · ' + String(b.reason).slice(0, 80) : '') + ' (OVR ' + c0.ovr + ' → ' + card(v).ovr + ')', before);
      store.save();
      return send(res, 200, Object.assign(cardDetail(v), { ok: true, did }));
    }
    if (p === '/api/viewer/edit' && req.method === 'GET') {
      const v = store.data.viewers[url.searchParams.get('key') || '']; if (!v) return send(res, 404, { error: 'not found' });
      return send(res, 200, { key: v.key, bits: v.bits || 0, gifts: S.giftsAllTime(v), months: v.subMonths || 0, manual: v.manual || {}, edits: (v.edits || []).slice().reverse().map((e) => ({ at: e.at, what: e.what })), card: card(v) });
    }
    if (p === '/api/viewer/edit' && req.method === 'POST') {
      const b = await readBody(req), v = store.data.viewers[b.key || ''];
      if (!v) return send(res, 404, { error: 'not found' });
      const now = Date.now();
      if (b.undo) { const e = (v.edits || []).pop(); if (!e) return send(res, 200, { error: 'Nothing to undo' }); for (const k of SNAP_KEYS) { if (e.before[k] == null) delete v[k]; else v[k] = e.before[k]; } store.save(); return send(res, 200, { ok: true, undone: e.what, card: card(v) }); }
      const before = snap(v), did = [];
      if (b.manual && typeof b.manual === 'object') {
        v.manual = v.manual || {};
        for (const [k, d] of Object.entries(b.manual)) if (S.STAT_KEYS.includes(k) && +d) { v.manual[k] = Math.max(-59, Math.min(59, (v.manual[k] || 0) + Math.round(+d))); did.push((+d > 0 ? '+' : '') + Math.round(+d) + ' ' + k); }
      }
      did.push(...setAllTime(v, b, now));
      if (!did.length) return send(res, 200, { ok: true, card: card(v) });
      editLog(v, did.join(', ') + (b.reason ? ' · ' + String(b.reason).slice(0, 80) : ''), before);
      S.releaseBank(v, R, now); store.save();
      return send(res, 200, { ok: true, did, card: card(v) });
    }
    if (p === '/api/import' && req.method === 'POST') {
      const b = await readBody(req);
      let rows = [];
      try {
        if (b.source === 'twitch') rows = (await twitch.bitsLeaderboard()).map((x) => ({ name: x.display || x.login, login: x.login, platform: 'twitch', bits: x.bits }));
        else rows = String(b.text || '').split(/\r?\n/).map((l) => l.split(/[,\t;]/).map((x) => x.trim())).filter((a) => a[0]).map((a) => ({ name: a[0], bits: a[1] ? +a[1].replace(/[^0-9]/g, '') || 0 : null, gifts: a[2] ? +a[2].replace(/[^0-9]/g, '') || 0 : null, months: a[3] ? +a[3].replace(/[^0-9]/g, '') || 0 : null }));
      } catch (e) { return send(res, 200, { error: e.message }); }
      const out = rows.slice(0, 500).map((r) => {
        const v = r.platform ? store.get(r.platform, r.login) : findViewerByName(r.name);
        const add = [];
        if (r.bits != null && r.bits > ((v && v.bits) || 0)) add.push('+' + (r.bits - ((v && v.bits) || 0)) + ' bits');
        if (r.gifts != null && r.gifts > (v ? S.giftsAllTime(v) : 0)) add.push('+' + (r.gifts - (v ? S.giftsAllTime(v) : 0)) + ' gifts');
        if (r.months != null && r.months > ((v && v.subMonths) || 0)) add.push('+' + (r.months - ((v && v.subMonths) || 0)) + ' months');
        return Object.assign(r, { key: v ? v.key : null, have: v ? { bits: v.bits || 0, gifts: S.giftsAllTime(v), months: v.subMonths || 0 } : null, add: add.join(', '), newCard: !v && !!r.platform });
      });
      if (b.apply) {
        let n = 0; const now = Date.now();
        for (const r of out) {
          if (!r.add) continue;
          let v = r.key ? store.data.viewers[r.key] : null;
          if (!v && r.platform) v = store.upsert(r.platform, r.login, r.name).v;
          if (!v) continue;
          S.migrate(v);
          const before = snap(v), did = setAllTime(v, r, now);
          if (did.length) { editLog(v, 'Import (' + (b.source === 'twitch' ? 'Twitch bits leaderboard' : 'pasted list') + '): ' + did.join(', '), before); n++; }
        }
        store.save();
        return send(res, 200, { ok: true, applied: n });
      }
      return send(res, 200, { rows: out, changes: out.filter((r) => r.add).length });
    }
    // ----- rewards (Power-ups + channel points) -----
    if (p === '/api/rewards' && req.method === 'GET') return send(res, 200, rewardsPayload());
    if (p === '/api/rewards' && req.method === 'POST') {
      const b = await readBody(req);
      try {
        if (b.action === 'refresh') { const n = await rewards.refresh(); return send(res, 200, Object.assign(rewardsPayload(), { ok: true, found: n })); }
        if (b.action === 'set' && b.key) rewards.set(String(b.key), b.rule || {});
        if (b.action === 'reset' && b.key) rewards.set(String(b.key), null);
        if (b.action === 'add' && b.title) rewards.add(String(b.title).slice(0, 80));
        if (b.action === 'remove' && b.key) { liveFromReward(b.key).forEach((c) => challenges.remove(c.id)); delete rewards.seen()[b.key]; rewards.set(String(b.key), null); store.save(); }
        if (b.action === 'clear' && b.key) liveFromReward(b.key).forEach((c) => challenges.remove(c.id));
        if (b.action === 'set' && b.key && b.rule && b.rule.show != null) { const hide = !b.rule.show; let ch = false; for (const c of liveFromReward(b.key)) if (!!c.hidden !== hide) { c.hidden = hide; ch = true; } if (ch) { challenges.save(); challenges.sync(); } }
        if (b.action === 'test' && b.title) rewards.handle(String(b.title), 'TestViewer', 'twitch', b.kind || 'points', { test: true });
      } catch (e) { return send(res, 200, Object.assign(rewardsPayload(), { error: e.message })); }
      return send(res, 200, Object.assign(rewardsPayload(), { ok: true }));
    }
    // ----- raid night -----
    if (p === '/api/raidnight' && req.method === 'GET') return send(res, 200, raidNight.info());
    if (p === '/api/raidnight' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.settings) raidNight.set(b.settings);
      let r = { ok: true };
      if (b.action === 'brief') r = await raidNight.briefing();
      else if (b.action === 'raid') { const N = raidNight.night(); if (N && (N.stage === 'chest' || N.stage === 'taunt')) N.stage = 'briefing'; r = raidNight.launch(); }
      else if (b.action === 'drone') r = raidNight.drone ? { error: 'a drone is already up' } : (raidNight.startDrone(), { ok: true });
      else if (b.action === 'skip') r = raidNight.skip();
      else if (b.action === 'wake') { await refreshViewers().catch(() => {}); r = raidNight.wake(viewerCache.n); }
      else if (b.action === 'delay') r = raidNight.delay(+b.mins || 10);
      else if (b.action === 'aftergame') r = raidNight.afterThisGame();
      else if (b.action === 'testViewers') { cfg.testViewers = b.n === '' || b.n == null ? null : Math.max(0, Math.round(+b.n) || 0); saveCfg(); await refreshViewers().catch(() => {}); raidNight.sync(); }
      else if (b.action === 'season-reset') { raidNight.data().season = { queenWins: 0, raidWins: 0, streak: 0, best: 0, slayers: {}, level: 0 }; store.save(); raidNight.sync(); }
      else if (b.action === 'credits') { await rollCredits(); r = { ok: true }; }
      if (b.action && !isLive() && ['brief', 'raid', 'drone', 'wake', 'aftergame'].includes(b.action)) r = { error: 'Raid Night runs while you are live (or turn on test mode / live mode).' };
      return send(res, 200, Object.assign(raidNight.info(), r));
    }
    // ----- end credits -----
    if (p === '/api/credits' && req.method === 'GET') { const d = creditsData(Number(url.searchParams.get('no')) || 0); const v = await endVideoSecs(); d.video = v; d.secs = v ? v.secs : creditsSettings().secs; return send(res, 200, d); }
    if (p === '/api/credits' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.settings) { const c = creditsSettings(); cfg.credits = { secs: b.settings.secs != null ? Math.max(15, Math.min(600, +b.settings.secs || 60)) : c.secs, teaser: b.settings.teaser != null ? String(b.settings.teaser).slice(0, 120) : c.teaser, auto: b.settings.auto != null ? !!b.settings.auto : c.auto, video: b.settings.video != null ? String(b.settings.video).slice(0, 80) : c.video }; saveCfg(); }
      if (b.roll) await rollCredits();
      return send(res, 200, { ok: true, settings: creditsSettings() });
    }
    // ----- camera studio -----
    if (p === '/api/camera/snapshot' && req.method === 'GET') { try { return send(res, 200, await cam.snapshot()); } catch (e) { return send(res, 200, { error: e.message }); } }
    if (p === '/api/camera' && req.method === 'GET') return send(res, 200, Object.assign(cam.info(), { obs: obs.status(), ticker: tickerInfo() }));
    if (p === '/api/camera' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.settings) cam.setSettings(b.settings);
      if (b.ticker) { const r = await setTickerLayer(b.ticker); if (r && r.error) return send(res, 200, r); }
      if (b.size != null) return send(res, 200, await cam.setSize(b.size));
      if (b.resetAll) return send(res, 200, Object.assign(await cam.resetAll(), cam.info()));
      if (b.saveSpot) return send(res, 200, Object.assign(await cam.saveSpot(), cam.info()));
      if (b.forgetSpot) return send(res, 200, Object.assign(cam.forgetSpot(b.forgetSpot === true ? null : String(b.forgetSpot)), cam.info()));
      if (b.fx) { if (b.wait) return send(res, 200, await cam.run(String(b.fx), null)); cam.run(String(b.fx), null).then((r) => { if (r && r.error) toast('Camera studio', r.error, 8000); }); }
      return send(res, 200, Object.assign({ ok: true }, cam.info(), { ticker: tickerInfo() }));
    }
    // ----- stream stats -----
    if (p === '/api/earnings' && req.method === 'GET') return send(res, 200, earnings.report());
    if (p === '/api/earnings/log' && req.method === 'GET') return send(res, 200, earnings.entries(+url.searchParams.get('days') || 14));
    if (p === '/api/earnings/log' && req.method === 'POST') { const b = await readBody(req); const r = b.remove ? earnings.remove(b.remove) : b.add ? earnings.addManual(b.add) : { error: 'nothing to do' }; return send(res, 200, Object.assign(earnings.entries(+b.days || 14), r)); }
    if (p === '/api/earnings' && req.method === 'POST') { const b = await readBody(req); earnings.set(b || {}); return send(res, 200, earnings.report()); }
    if (p === '/api/streams' && req.method === 'GET') {
      const no = Number(url.searchParams.get('no'));
      const nameOf = (k) => { const v = store.data.viewers[k]; const pv = v ? (store.primary(v) || v) : null; return { display: pv ? pv.display : k, platforms: pv ? (pv.platforms || [pv.platform]) : [] }; };
      if (no) { const one = streamLog.one(no, nameOf); if (one) { try { one.earned = earnings.forStream(one); } catch (e) { /* ignore */ } } return send(res, 200, one || { error: 'No such stream' }); }
      return send(res, 200, { list: streamLog.list(), current: streamNo() && isLive() ? streamNo() : null });
    }
    // ----- alerts held while the overlay is off air -----
    if (p === '/api/held' && req.method === 'GET') return send(res, 200, { hold: sceneHeld, scene: sceneHeldName, list: heldList.slice(-30), gapSecs: holdGap(), on: cfg.holdOffScene !== false, obs: obs.ready });
    if (p === '/api/held' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.action === 'play') { playAnywayScene = obs.onAirScene; sceneHeld = false; heldList = []; push({ type: 'sceneHold', hold: false, scene: '', gapSecs: holdGap() }); }
      if (b.action === 'clear') { heldList = []; push({ type: 'queueClear' }); }
      if (typeof b.on === 'boolean') { cfg.holdOffScene = b.on; saveCfg(); }
      if (typeof b.gapSecs === 'number') { cfg.holdGapSecs = Math.max(0, Math.min(60, Math.round(b.gapSecs))); saveCfg(); }
      return send(res, 200, { hold: sceneHeld, scene: sceneHeldName, list: heldList, gapSecs: holdGap(), on: cfg.holdOffScene !== false });
    }
    // ----- challenges -----
    if (p === '/api/challenges' && req.method === 'GET') return send(res, 200, Object.assign(challenges.state(), { rules: challenges.settings().rules }));
    if (p === '/api/challenges' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.action === 'add') challenges.add({ name: String(b.name || '').trim() || 'Challenge', count: b.count, unit: b.unit, by: String(b.by || '').slice(0, 40) || null, source: 'dashboard' });
      else if (b.action === 'done') challenges.step(1);
      else if (b.action === 'undo') challenges.step(-1);
      else if (b.action === 'complete') challenges.complete();
      else if (b.action === 'start') challenges.start(b.id);
      else if (b.action === 'remove') challenges.remove(b.id);
      else if (b.action === 'edit') challenges.edit(b.id, b);
      else if (b.action === 'settings') challenges.setSettings(b.settings || {});
      return send(res, 200, Object.assign(challenges.state(), { rules: challenges.settings().rules }));
    }
    // ----- leaderboards -----
    if (p === '/api/board' && req.method === 'GET') return send(res, 200, boardRows(url.searchParams.get('kind') === 'support' ? 'support' : 'battles', url.searchParams.get('period') || 'week'));
    if (p === '/api/board' && req.method === 'POST') { const b = await readBody(req); const r = showBoard(b.kind, b.period, b.secs); return send(res, 200, { ok: true, rows: r.rows.length }); }
    // ----- OBS -----
    if (p === '/api/obs' && req.method === 'GET') return send(res, 200, Object.assign(obs.status(), { settings: Object.assign({}, obs.settings(), { password: '', hasPassword: !!(cfg.obs && cfg.obs.password) }) }));
    if (p === '/api/obs' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.settings) {
        const cur = Object.assign({}, obs.settings()), n = b.settings;
        if (typeof n.on === 'boolean') cur.on = n.on;
        if (typeof n.url === 'string' && /^wss?:\/\/[\w.\-]+(:\d+)?\/?$/.test(n.url.trim())) cur.url = n.url.trim();
        if (typeof n.password === 'string' && n.password) cur.password = n.password;
        if (n.clearPassword) cur.password = '';
        if (['tl', 'tr', 'bl', 'br'].includes(n.corner)) cur.corner = n.corner;
        if (Number(n.size) >= 10 && Number(n.size) <= 60) cur.size = Math.round(Number(n.size));
        if (typeof n.keep === 'string') cur.keep = n.keep.slice(0, 500);
        if (Number(n.margin) >= 0 && Number(n.margin) <= 200) cur.margin = Math.round(Number(n.margin));
        if (Number(n.animMs) >= 0 && Number(n.animMs) <= 3000) cur.animMs = Math.round(Number(n.animMs));
        cfg.obs = cur; saveCfg();
        await obs.connect().catch(() => {});
      }
      try {
        if (b.action === 'test') await obs.connect();
        if (b.action === 'corner') await obs.toCorner();
        if (b.action === 'restore') await obs.restore();
      } catch (e) { return send(res, 200, Object.assign(obs.status(), { error: e.message })); }
      return send(res, 200, obs.status());
    }
    // ----- battle screen layout -----
    if (p === '/api/screen' && req.method === 'GET') return send(res, 200, { alertsFound: obs.alertList, meters: obs.meters, keepAlerts: obs.settings().keepAlerts !== false, redeemOk: !(twitch.cantListen && twitch.cantListen.has('channel.channel_points_custom_reward_redemption.add')), zonesNow: screenState().zones, settings: screenSettings(), defaults: SCREEN_DEFAULTS, liveBox: obs.settings().on ? obs.boxRect() : obs.boxRect(), obsOn: obs.settings().on, cam: camRect, corner: obs.settings().corner });
    if (p === '/api/screen' && req.method === 'POST') {
      const b = await readBody(req), cur = cfg.screen || {};
      if (b.reset) { cfg.screen = {}; saveCfg(); pushScreen(); return send(res, 200, { ok: true, settings: screenSettings() }); }
      const n = b.settings || {};
      if (['brand', 'dark', 'none'].includes(n.backdrop)) cur.backdrop = n.backdrop;
      if (typeof n.withoutObs === 'boolean') cur.withoutObs = n.withoutObs;
      if (n.widgets) { cur.widgets = cur.widgets || {}; for (const k of Object.keys(SCREEN_DEFAULTS.widgets)) if (n.widgets[k]) { const w = n.widgets[k], c = (v, lo, hi) => Math.round(Math.max(lo, Math.min(hi, +v || 0)));
        cur.widgets[k] = { on: !!w.on, x: c(w.x, 0, 1880), y: c(w.y, 0, 1040), w: c(w.w, 160, 1920), h: c(w.h, 120, 1080) }; } }
      if (n.socials) cur.socials = { twitch: String(n.socials.twitch || '').replace(/[^\w.@-]/g, '').slice(0, 40), kick: String(n.socials.kick || '').replace(/[^\w.@-]/g, '').slice(0, 40), youtube: String(n.socials.youtube || '').replace(/[^\w.@-]/g, '').slice(0, 40) };
      if (n.cards) cur.cards = { pos: ['auto', 'br', 'bl', 'tr', 'tl'].includes(n.cards.pos) ? n.cards.pos : 'auto', camera: String(n.cards.camera || '').slice(0, 80), cameraCorner: ['none', 'tl', 'tr', 'bl', 'br'].includes(n.cards.cameraCorner) ? n.cards.cameraCorner : 'none' };
      if (n.alerts) {
        const a = n.alerts, num = (v, lo, hi, d) => (isFinite(+v) ? Math.round(Math.max(lo, Math.min(hi, +v))) : d), D = SCREEN_DEFAULTS.alerts;
        cur.alerts = { on: a.on !== false, wait: a.wait !== false, holdSecs: num(a.holdSecs, 0, 10, D.holdSecs), maxWaitSecs: num(a.maxWaitSecs, 5, 120, D.maxWaitSecs), delaySecs: num(a.delaySecs, 0, 30, D.delaySecs), redeemSecs: num(a.redeemSecs, 0, 60, D.redeemSecs),
          names: String(a.names || '').slice(0, 200), zones: {} };
        for (const k of Object.keys(D.zones)) { const z = (a.zones || {})[k] || D.zones[k]; cur.alerts.zones[k] = { on: z.on !== false, custom: !!z.custom, x: num(z.x, 0, 1880, D.zones[k].x), y: num(z.y, 0, 1040, D.zones[k].y), w: num(z.w, 80, 1920, D.zones[k].w), h: num(z.h, 60, 1080, D.zones[k].h) }; }
        if (typeof a.keepAlerts === 'boolean') { cfg.obs = Object.assign({}, cfg.obs || {}, { keepAlerts: a.keepAlerts }); }
      }
      cfg.screen = cur; saveCfg();
      try { if (obs.ready) await obs.findAlerts(screenSettings().alerts.names); } catch (e) { /* ignore */ }
      try { if (obs.ready) camRect = await obs.cameraRect(screenSettings().cards.camera); } catch (e) { /* ignore */ }
      pushScreen();
      return send(res, 200, { ok: true, settings: screenSettings(), cam: camRect });
    }
    if (p === '/api/screen/preview' && req.method === 'POST') { const st = screenState(); st.show = true; st.preview = 15; st.mode = st.mode || 'arc'; st.rules = st.rules || RULES_LINES.arc; st.cmds = st.cmds || battleCommands('arc'); st.board = boardRows('battles', 'week').rows.slice(0, 6).map((r) => ({ display: r.display, pts: r.pts, wins: r.wins, avatar: r.avatar })); push(st); return send(res, 200, { ok: true }); }
    // ----- Boss Sports News -----
    if (p.startsWith('/bsn') && await bsn.http(p, url, req, res, send)) return;
    if (p === '/api/bsn/check') { const b = req.method === 'POST' ? await readBody(req) : {}; return send(res, 200, tickerCheck(!!b.fix)); }
    if (p === '/api/bsn' && req.method === 'GET') return send(res, 200, { names: bsn.tickerConfig().squad.players.slice(0, 60), settings: bsn.S(), state: bsn.publicState(), feed: bsn.feed, log: bsn.log.slice(-40).reverse(), images: BSN_IMAGES });
    if (p === '/api/bsn/games' && req.method === 'GET') {
      const S = bsn.S(), out = [], d = new Date(), ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
      for (const l of S.leagues.filter((x) => x.ticker || x.alerts)) {
        try { for (const ev of await bsn.scoreboard(l.slug, ymd)) { const m = bsn.readMatch(ev, l.slug, l.name); if (m.date && new Date(m.date).toDateString() === d.toDateString()) out.push(m); } } catch (e) { /* skip */ }
      }
      out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return send(res, 200, out.slice(0, 60).map((m) => ({ comp: m.comp, home: m.home, away: m.away, hs: m.hs, as: m.as, state: m.state, clock: m.clock, date: m.date, mine: !!bsn.mySide(m) })));
    }
    if (p === '/api/bsn' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.command) { const ok = await bsn.command(String(b.command)); return send(res, 200, { ok, state: bsn.publicState() }); }
      if (b.image) { try { bsn.saveImage(String(b.image), b.data); push({ type: 'bsnReload' }); return send(res, 200, { ok: true }); } catch (e) { return send(res, 200, { error: e.message }); } }
      if (b.settings && typeof b.settings === 'object') {
        const cur = cfg.bsn || {}, n = b.settings, num = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v)));
        const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 120);
        if (typeof n.on === 'boolean') cur.on = n.on;
        if (n.ticker) cur.ticker = { speed: num(n.ticker.speed, 40, 300) || 125, between: num(n.ticker.between, 0, 10), refresh: num(n.ticker.refresh, 20, 600) || 60, upcoming: !!n.ticker.upcoming, duringBattles: !!n.ticker.duringBattles };
        if (Array.isArray(n.leagues)) cur.leagues = n.leagues.filter((l) => l && /^[a-z0-9.]+$/.test(l.slug)).slice(0, 40).map((l) => ({ slug: l.slug, name: str(l.name, 40).toUpperCase(), ticker: !!l.ticker, alerts: !!l.alerts }));
        if (typeof n.myTeam === 'string') cur.myTeam = str(n.myTeam, 40);
        for (const [k, lo, hi] of [['checkSec', 10, 300], ['bigMinute', 1, 120], ['cooldownMin', 0, 240], ['batchSec', 0, 600], ['lastgoalCooldown', 0, 3600]]) if (n[k] != null && isFinite(+n[k])) cur[k] = num(n[k], lo, hi);
        for (const k of ['skipUnimportant', 'autoRoundup', 'varAlerts', 'holdDuringBattles', 'viewersInStories', 'cleanNames']) if (typeof n[k] === 'boolean') cur[k] = n[k];
        if (Array.isArray(n.quietScenes)) cur.quietScenes = n.quietScenes.map((x) => str(x, 60)).filter(Boolean).slice(0, 10);
        if (n.squad) cur.squad = { captain: str(n.squad.captain, 40), manager: str(n.squad.manager, 40), owner: str(n.squad.owner, 40), rivalManager: str(n.squad.rivalManager, 40),
          clubs: (n.squad.clubs || []).map((x) => str(x, 40).toUpperCase()).filter(Boolean).slice(0, 10), players: (n.squad.players || []).map((x) => str(x, 40)).filter(Boolean).slice(0, 300) };
        for (const k of ['suitors', 'fees']) if (Array.isArray(n[k])) cur[k] = n[k].map((x) => str(x, 120).toUpperCase()).filter(Boolean).slice(0, 60);
        if (Array.isArray(n.templates)) cur.templates = n.templates.filter((t) => Array.isArray(t) && t[0] && t[1]).slice(0, 300).map((t) => [str(t[0], 40).toUpperCase(), str(t[1], 240).toUpperCase()]);
        if (Array.isArray(n.pinned)) cur.pinned = n.pinned.filter((t) => Array.isArray(t) && t[0] && t[1]).slice(0, 20).map((t) => [str(t[0], 40).toUpperCase(), str(t[1], 240).toUpperCase()]);
        if (Array.isArray(n.offCats)) cur.offCats = n.offCats.map((x) => str(x, 40)).slice(0, 60);
        if (n.reset === true) { cfg.bsn = { on: cur.on }; } else cfg.bsn = cur;
        saveCfg(); bsnTicker(); push({ type: 'bsnReload' });
        return send(res, 200, { ok: true, settings: bsn.S() });
      }
      return send(res, 400, { error: 'nothing to do' });
    }
    // ----- diagnostics -----
    if (p === '/api/diag' && req.method === 'GET') return send(res, 200, { checks: diag.checks(), errors: diag.errors.slice(-60).reverse(), fixes: diag.fixes.slice(-40).reverse(), autoFix: cfg.autoFix !== false, version: APP_VERSION, backups: diag.backups() });
    if (p === '/api/diag/report' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': 'attachment; filename="bbr-diagnostics.txt"' }); return res.end(diag.report()); }
    if (p === '/api/diag' && req.method === 'POST') {
      const b = await readBody(req);
      if (typeof b.autoFix === 'boolean') { cfg.autoFix = b.autoFix; saveCfg(); }
      if (b.fix) { try { const msg = await diag.fix(String(b.fix), false); return send(res, 200, { ok: true, msg }); } catch (e) { return send(res, 200, { error: e.message }); } }
      return send(res, 200, { ok: true });
    }
    // ----- truck race routes -----
    if (p === '/api/routes' && req.method === 'GET') return send(res, 200, Object.assign(RLX.routeList({ game: currentGame(), disabled: cfg.routesOff || [] }), { game: currentGame() }));
    if (p === '/api/routes' && req.method === 'POST') {
      const b = await readBody(req);
      const off = new Set(cfg.routesOff || []);
      if (typeof b.id === 'string' && RLX.ROUTES.some((r) => RLX.routeId(r) === b.id)) { if (b.on) off.delete(b.id); else off.add(b.id); }
      if (b.all === true) off.clear();
      cfg.routesOff = Array.from(off); saveCfg();
      return send(res, 200, Object.assign(RLX.routeList({ game: currentGame(), disabled: cfg.routesOff }), { game: currentGame() }));
    }
    // ----- truck race: time of day + weather chances -----
    if (p === '/api/racewx' && req.method === 'GET') return send(res, 200, { tods: RLX.TODS, weather: RLX.WEATHER, on: cfg.raceTods || RLX.TOD_IDS, wx: Object.assign(Object.fromEntries(RLX.WEATHER.map((w) => [w.id, w.w])), cfg.raceWx || {}), specials: RLX.SPECIALS });
    if (p === '/api/racewx' && req.method === 'POST') {
      const b = await readBody(req);
      if (Array.isArray(b.on)) cfg.raceTods = b.on.filter((x) => RLX.TOD_IDS.includes(x));
      if (b.wx && typeof b.wx === 'object') { cfg.raceWx = {}; for (const id of RLX.WX_IDS) cfg.raceWx[id] = Math.max(0, Math.min(100, Math.round(+b.wx[id] || 0))); }
      saveCfg();
      return send(res, 200, { ok: true });
    }
    // ----- game tuning -----
    if (p === '/api/tuning' && req.method === 'GET') return send(res, 200, Object.assign(TU.info(), { values: TU.values(cfg), defaults: TU.defaults() }));
    if (p === '/api/tuning' && req.method === 'POST') {
      const b = await readBody(req);
      const cur = TU.values(cfg);
      if (b.reset && cur[b.reset]) cur[b.reset] = TU.defaults()[b.reset];
      if (b.values && typeof b.values === 'object') for (const g of Object.keys(cur)) if (b.values[g] && typeof b.values[g] === 'object') Object.assign(cur[g], b.values[g]);
      cfg.tuning = TU.clampAll(cur);
      saveCfg();
      TV = TU.apply(cfg); R = rulesNow();
      return send(res, 200, { ok: true, values: TV, note: battle.phase !== 'idle' ? 'Saved. A battle is running, so some changes start with the next one.' : 'Saved.' });
    }
    if (p === '/api/tuning/odds' && req.method === 'POST') {
      const b = await readBody(req);
      BTX.configureShootout(Object.assign({}, TV.shootout, b.values || {}));
      const o = BTX.sideOdds();
      BTX.configureShootout(TV.shootout);
      const pc = (x) => Math.round(x * 100);
      return send(res, 200, { L: pc(o.L), C: pc(o.C), R: pc(o.R), avg: pc((o.L + o.C + o.R) / 3), zones: Object.fromEntries(Object.entries(o.zones || {}).map(([k, v]) => [k, pc(v)])) });
    }
    if (p === '/api/tuning/sim' && req.method === 'GET') {
      const g = url.searchParams.get('game');
      if (battle.phase !== 'idle') return send(res, 409, { error: 'Wait for the current battle to finish first.' });
      return send(res, 200, { game: g, rows: TU.simulate(g) });
    }
    if (p === '/api/config' && req.method === 'POST') {
      const b = await readBody(req);
      const str = (x) => (typeof x === 'string' ? x.trim() : '');
      if ('twitchClientId' in b) cfg.twitchClientId = str(b.twitchClientId);
      if (str(b.twitchClientSecret)) cfg.twitchClientSecret = str(b.twitchClientSecret);
      if ('kickClientId' in b) cfg.kickClientId = str(b.kickClientId);
      if (str(b.kickClientSecret)) cfg.kickClientSecret = str(b.kickClientSecret);
      if ('ytClientId' in b) cfg.ytClientId = str(b.ytClientId);
      if (str(b.ytClientSecret)) cfg.ytClientSecret = str(b.ytClientSecret);
      if ('kickSlug' in b) {
        const slug = str(b.kickSlug).toLowerCase();
        if (slug !== (cfg.kickSlug || '')) { cfg.kickChatroomId = ''; cfg.kickChannelId = ''; }
        cfg.kickSlug = slug;
      }
      if (str(b.kickChatroomId)) cfg.kickChatroomId = str(b.kickChatroomId).replace(/\D/g, '');
      if (str(b.kickChannelId)) cfg.kickChannelId = str(b.kickChannelId).replace(/\D/g, '');
      if (/^#[0-9a-fA-F]{6}$/.test(str(b.accent))) cfg.accent = str(b.accent);
      if (typeof b.rulesUrl === 'string' && (b.rulesUrl === '' || /^https:\/\/\S{4,300}$/.test(b.rulesUrl.trim()))) cfg.rulesUrl = b.rulesUrl.trim();
      if (typeof b.volume === 'number') cfg.volume = Math.max(0, Math.min(1, b.volume));
      if (typeof b.liveMode === 'boolean') cfg.liveMode = b.liveMode;
      if (typeof b.battlesEnabled === 'boolean') cfg.battlesEnabled = b.battlesEnabled;
      if (typeof b.battlesOff === 'boolean') setBattlesOff(b.battlesOff);
      if (typeof b.showNextTimer === 'boolean') cfg.showNextTimer = b.showNextTimer;
      if (typeof b.giveawaysOn === 'boolean') cfg.giveawaysOn = b.giveawaysOn;
      if (['auto', 'shootout', 'race', 'arc', 'alternate'].includes(b.battleMode)) cfg.battleMode = b.battleMode;
      if ('manualGame' in b) cfg.manualGame = str(b.manualGame).slice(0, 60);
      if (Number(b.battleIntervalMin) >= 5) cfg.battleIntervalMin = Math.min(240, Math.round(Number(b.battleIntervalMin)));
      saveCfg();
      R = rulesNow();
      if (b.restartKick) kick.start();
      return send(res, 200, { ok: true });
    }
    // ----- logins -----
    const login = /^\/auth\/(twitch|kick|youtube)$/.exec(p);
    if (login) {
      const k = login[1], pl = PLATFORMS[k];
      if (k === 'kick' ? !pl.apiConfigured() : !pl.configured()) return send(res, 400, 'Save the ' + NAMES[k] + ' Client ID and Secret on the dashboard first.', 'text/plain');
      const state = crypto.randomBytes(16).toString('hex');
      oauthStates.set(state, k);
      res.writeHead(302, { Location: pl.authUrl(state) });
      return res.end();
    }
    const cb = /^\/auth\/(twitch|kick|youtube)\/callback$/.exec(p);
    if (cb) {
      const k = cb[1], state = url.searchParams.get('state');
      if (oauthStates.get(state) !== k) return send(res, 400, 'Login link expired. Go back to the dashboard and try again.', 'text/plain');
      oauthStates.delete(state);
      if (url.searchParams.get('error')) return send(res, 400, NAMES[k] + ' login was cancelled.', 'text/plain');
      await PLATFORMS[k].exchange(url.searchParams.get('code'));
      if (k === 'twitch') { twitch.stop(); twitch.start(); }
      if (k === 'kick') kick.startApi();
      if (k === 'youtube') youtube.start();
      res.writeHead(302, { Location: '/?connected=' + k });
      return res.end();
    }
    if (p === '/api/disconnect' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.platform === 'twitch') { cfg.twitchTokens = null; twitch.stop(); twitch.user = null; }
      if (b.platform === 'kick') { cfg.kickTokens = null; kick.user = null; }
      if (b.platform === 'youtube') { cfg.ytTokens = null; youtube.stop(); youtube.user = null; }
      saveCfg();
      return send(res, 200, { ok: true });
    }
    // ----- imports -----
    if (p === '/api/import/twitch' && req.method === 'POST') {
      if (importState.running) return send(res, 409, { error: 'Import already running' });
      try { const r = await importTwitch(); backfillAvatars().catch(() => {}); return send(res, 200, r); } catch (e) { return send(res, 400, { error: e.message }); }
    }
    if (p === '/api/avatars' && req.method === 'POST') {
      if (!twitch.user || !twitch.connected) return send(res, 400, { error: 'Connect Twitch first.' });
      for (const v of store.all()) { v.avatarTriedAt = 0; v.avatarAt = 0; }
      return send(res, 200, { ok: true, updated: await backfillAvatars() });
    }
    if (p === '/api/import/list' && req.method === 'POST') {
      const b = await readBody(req);
      if (!PLATFORMS[b.platform]) return send(res, 400, { error: 'Pick a platform' });
      return send(res, 200, { ok: true, added: importList(b.platform, b.text, b.kind) });
    }
    // ----- linking from the dashboard -----
    if (p === '/api/link' && req.method === 'POST') {
      const b = await readBody(req);
      const keys = (b.keys || []).filter((k) => store.data.viewers[k] && !store.data.viewers[k].aliasOf);
      if (keys.length < 2) return send(res, 400, { error: 'Pick at least two cards' });
      // the strongest card becomes the main one
      keys.sort((x, y) => card(store.data.viewers[y]).ovr - card(store.data.viewers[x]).ovr);
      let c = null;
      for (const k of keys.slice(1)) c = linkAccounts(keys[0], k) || c;
      return send(res, 200, { ok: true, card: c });
    }
    if (p === '/api/linklog' && req.method === 'GET') {
      const now = Date.now();
      const codes = Array.from(linkCodes.entries()).filter(([, x]) => x.expires > now).map(([c, x]) => ({ code: c, who: x.display, platform: x.platform, mins: Math.ceil((x.expires - now) / 60000) }));
      const pend = Array.from(linkPending.entries()).filter(([, x]) => x.expires > now).map(([k, x]) => ({ owner: (store.data.viewers[k] || {}).display, ownerPlatform: (store.data.viewers[k] || {}).platform, from: x.fromDisplay, fromPlatform: x.fromPlatform }));
      return send(res, 200, { codes, pending: pend, log: (store.data.linkLog || []).slice(-100).reverse(), queue: store.data.linkQueue || [], settings: linkSettings() });
    }
    if (p === '/api/linklog' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.settings) { cfg.linking = { modApproveGap: [0, 1, 2, 3].includes(+b.settings.modApproveGap) ? +b.settings.modApproveGap : 0 }; saveCfg(); }
      if (b.approve || b.deny) {
        const Q = store.data.linkQueue || [], i = Q.findIndex((x) => x.id === (b.approve || b.deny));
        if (i >= 0) {
          const x = Q.splice(i, 1)[0];
          if (b.approve) finishLink(x.mainKey, x.fromKey, { owner: x.main, ownerPlatform: x.mainPlatform, by: x.from, byPlatform: x.fromPlatform, approvedBy: 'dashboard' }, [x.mainPlatform, x.fromPlatform]);
          else { logLink({ kind: 'denied', owner: x.main, ownerPlatform: x.mainPlatform, by: x.from, byPlatform: x.fromPlatform }); sayOnce(x.mainPlatform, '@' + x.main + ' the link with ' + x.from + ' was not approved.'); }
          store.save();
        }
      }
      return send(res, 200, { ok: true, log: (store.data.linkLog || []).slice(-100).reverse(), queue: store.data.linkQueue || [], settings: linkSettings() });
    }
    if (p === '/api/unlink' && req.method === 'POST') {
      const b = await readBody(req);
      const a = store.data.viewers[b.key], ok = unlinkAccount(b.key);
      if (ok && a) logLink({ kind: 'unlinked', owner: a.display, ownerPlatform: a.platform });
      return send(res, 200, { ok });
    }
    // ----- battles -----
    // ----- giveaways, tickets, prize pot -----
    if (p === '/api/giveaway' && req.method === 'GET') {
      const st = giveaways.status();
      st.leaders = store.all().filter((x) => !x.test && x.tk && x.tk.bal > 0).sort((a, b) => b.tk.bal - a.tk.bal).slice(0, 20)
        .map((x) => ({ display: x.display, platforms: x.platforms || [x.platform], bal: x.tk.bal, streak: x.tk.streak || 0, following: !!x.followedAt, tier: card(x).tier, wins: (x.tk.wins || []).length }));
      st.ticketRules = TK.TICKETS; st.after = TK.AFTER; st.rulesUrl = cfg.rulesUrl || '';
      st.viewers = { total: store.all().filter((x) => !x.test).length, following: store.all().filter((x) => !x.test && x.followedAt).length };
      { const { S, w } = schedInfo(Date.now()); st.schedule = { settings: S, thisWeek: w, record: (store.data.sched || {})[w.week] || {}, upcoming: SC.upcoming(Date.now(), 8, S).map((x) => Object.assign(x, { day: fmtDay(x.date), prize: S.prizes[x.slot] || null })), double: SC.isDoubleWeek(Date.now(), S) }; }
      return send(res, 200, st);
    }
    if (p === '/api/giveaway' && req.method === 'POST') {
      const b = await readBody(req);
      try {
        if (b.action === 'create') giveaways.create(b);
        else if (b.action === 'close') giveaways.close();
        else if (b.action === 'draw') return send(res, 200, { ok: true, drawn: giveaways.draw() });
        else if (b.action === 'cancel') giveaways.cancel();
        else if (b.action === 'showPot') showPot();
        else if (b.action === 'showSchedule') showSchedule();
        else if (b.action === 'schedule') {
          const S = SC.settings(cfg);
          if (typeof b.on === 'boolean') S.on = b.on;
          if (Number.isInteger(+b.weekday) && +b.weekday >= 0 && +b.weekday <= 6) S.weekday = +b.weekday;
          if (b.openMode === 'week' || b.openMode === 'day') S.openMode = b.openMode;
          if (Array.isArray(b.skip)) S.skip = b.skip.map(String).filter((x) => /^\d\d-\d\d$/.test(x));
          if (b.prizes && typeof b.prizes === 'object') for (const k of ['community', 'bronze', 'silver', 'gold']) if (b.prizes[k]) {
            const T = TK.TIERS.find((x) => x.id === k), val = Math.max(0, Math.min(T.max, Number(b.prizes[k].value) || 0));
            S.prizes[k] = { prize: String(b.prizes[k].prize || '').slice(0, 80) || S.prizes[k].prize, value: val };
          }
          cfg.schedule = S; saveCfg();
        }
        else if (b.action === 'test') {
          // preview: 8 test followers with tickets enter a sponsor Community Drop, draw, then the winner claims
          if (giveaways.current()) throw new Error('Finish the current giveaway first.');
          const names = ['TicketTina', 'LuckyLuke', 'DropDan', 'PotPete', 'RaffleRita', 'EntryEd', 'CharmChloe', 'StreakSam'];
          const now = Date.now();
          names.forEach((n, i) => { const { v } = store.upsert(['twitch', 'kick', 'youtube'][i % 3], n, n); v.test = true; v.followedAt = now - 30 * 86400000; TK.tk(v).bal = 5 + i * 3; });
          giveaways.create({ tier: 'community', prize: 'Test prize: Steam game key', value: 10, sponsor: true, test: true });
          names.forEach((n, i) => setTimeout(() => { const v = store.get(['twitch', 'kick', 'youtube'][i % 3], n); giveaways.enter(v, i % 4); }, 1500 + i * 700));
          setTimeout(() => { try { const d = giveaways.draw(); setTimeout(() => giveaways.claim(store.data.viewers[d.key]), 14000); } catch (e) { /* cancelled */ } }, 9000);
        }
        else if (b.action === 'potAdjust') {
          const pot = TK.potState(store.data, cfg), amt = Number(b.amount);
          if (!TK.TIERS.find((T) => T.id === b.tier) || !isFinite(amt)) throw new Error('Pick a tier and amount.');
          pot.tiers[b.tier] = Math.max(0, pot.tiers[b.tier] + amt); pot.total += amt; pot.log.push({ at: Date.now(), add: amt, why: 'Manual adjustment' }); store.save();
        } else if (b.action === 'settings') {
          const g = Object.assign({}, TK.potSettings(cfg));
          const num = (x, lo, hi) => { const n = Number(x); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; };
          if (num(b.share, 0, 100) != null) g.share = num(b.share, 0, 100);
          if (num(b.subValue, 0, 1000) != null) g.subValue = num(b.subValue, 0, 1000);
          if (num(b.per100Value, 0, 1000) != null) g.per100Value = num(b.per100Value, 0, 1000);
          if (Array.isArray(b.split) && b.split.length === 5) g.split = b.split.map((x) => num(x, 0, 100) || 0);
          if (typeof b.currency === 'string' && b.currency.length <= 3) g.currency = b.currency;
          if (num(b.monthlyCap, 0, 100000) != null) g.monthlyCap = num(b.monthlyCap, 0, 100000);
          cfg.giveaway = g; saveCfg();
        } else return send(res, 400, { error: 'unknown action' });
        return send(res, 200, { ok: true });
      } catch (e) { return send(res, 400, { error: e.message }); }
    }
    if (p === '/api/battle' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.action === 'start') return send(res, 200, { ok: startBattle(b.mode) });
      if (b.action === 'cancel') { battle.cancel(); return send(res, 200, { ok: true }); }
      if (b.action === 'pause') return send(res, 200, { ok: true, paused: pauseBattles(true) });
      if (b.action === 'resume') return send(res, 200, { ok: true, paused: pauseBattles(false) });
      if (b.action === 'delay') return send(res, 200, { ok: true, delayed: delayBattle(b.min), nextInMs: nextInMs() });
      if (b.action === 'test') {
        if (!testBattle(['race', 'arc'].includes(b.mode) ? b.mode : 'shootout')) return send(res, 409, { error: 'A battle is already running' });
        return send(res, 200, { ok: true });
      }
      return send(res, 400, { error: 'unknown action' });
    }
    // ----- tests -----
    if (p === '/api/test' && req.method === 'POST') {
      const b = await readBody(req);
      const platform = PLATFORMS[b.platform] ? b.platform : 'twitch';
      const name = String(b.name || 'TestViewer').replace(/[^A-Za-z0-9_]/g, '').slice(0, 25) || 'TestViewer';
      if (b.type === 'chat') { await onChat(platform, { login: name, display: name, text: String(b.text || 'hello').slice(0, 300), badges: Array.isArray(b.badges) ? b.badges.slice(0, 5) : [] }, !b.real); return send(res, 200, { ok: true }); }
      const fn = testEvent(platform, b.type, name);
      if (!fn) return send(res, 400, { error: 'unknown test' });
      if (!store.get(platform, name)) store.upsert(platform, name, name).v.test = true;
      await fn();
      return send(res, 200, { ok: true, viewer: name });
    }
    // developer tests only (start the app with BBR_TEST=1): feed a raw platform event through the real handlers
    if (p === '/api/test/emit' && req.method === 'POST' && process.env.BBR_TEST === '1') { const b = await readBody(req); const src = { twitch, kick, youtube }[b.platform]; if (!src) return send(res, 400, { error: 'platform' }); src.emit(b.event, b.data || {}); return send(res, 200, { ok: true }); }
    if (p === '/api/test/clear' && req.method === 'POST') {
      let n = 0;
      for (const v of store.all()) if (v.test) { store.remove(v.key); n++; }
      return send(res, 200, { ok: true, removed: n });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error('[server]', e);
    send(res, 500, { error: e.message });
  }
});


// ---------- phone remote: a second, LAN-only door that needs a secret key and only opens /phone and the control links ----------
const os = require('os');
let phoneSrv = null;
const PHONE_PORT = PORT + 1;
function lanIp() { for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) return a.address; return null; }
function phoneInfo() { const P = cfg.phone || {}; const ip = lanIp(); return { on: !!P.on, url: P.on && ip ? 'http://' + ip + ':' + PHONE_PORT + '/phone?key=' + P.key : null }; }
function startPhone() {
  if (phoneSrv) { phoneSrv.close(); phoneSrv = null; }
  const P = cfg.phone || {}; if (!P.on || !P.key) return;
  phoneSrv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname !== '/draw.js' && u.searchParams.get('key') !== P.key) { res.writeHead(403, { 'Content-Type': 'text/plain' }); res.end('Wrong or missing key. Open the link from the Live desk again.'); return; }
    if (u.pathname === '/phone') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(path.join(ROOT, 'public', 'phone.html'))); return; }
    if (u.pathname === '/phone/state') {
      const st = { botMuted: !!cfg.botMuted, botFlood: sayRate.warned && Date.now() - sayRate.warned < 120000, next: nextInfo(), challenge: challenges.data().list[0] || null, pins: cfg.pins || null, battle: battle.phase, held: sceneHeld ? heldList.length : 0, raid: raidNight.S().on, queen: raidNight.state().stage, bossRole: battle.status().bossRole, replayPlaying: !!replay.playing, red: !!redActive };
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(st)); return;
    }
    if (u.pathname === '/analysis' || u.pathname === '/draw.js') { res.writeHead(200, { 'Content-Type': (u.pathname === '/draw.js' ? 'text/javascript' : 'text/html') + '; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(path.join(ROOT, 'public', u.pathname === '/draw.js' ? 'draw.js' : 'analysis.html'))); return; }
    if (u.pathname === '/api/analysis') {
      const r2 = http.request({ host: '127.0.0.1', port: PORT, path: '/api/analysis', method: req.method, headers: { 'Content-Type': 'application/json' } }, (r) => { res.writeHead(r.statusCode, { 'Content-Type': 'application/json' }); r.pipe(res); });
      r2.on('error', () => { res.writeHead(500); res.end('{}'); }); req.pipe(r2); return;
    }
    if (/^\/control\/[a-z-]+$/.test(u.pathname)) {
      // pass through to the main server on this machine (same rules as a Stream Deck)
      const r2 = http.request({ host: '127.0.0.1', port: PORT, path: u.pathname + u.search.replace(/([?&])key=[^&]*&?/, '$1'), method: 'GET' }, (r) => { res.writeHead(r.statusCode, { 'Content-Type': 'text/plain' }); r.pipe(res); });
      r2.on('error', () => { res.writeHead(500); res.end('error'); }); r2.end(); return;
    }
    res.writeHead(404); res.end('Not here');
  });
  phoneSrv.on('error', (e) => console.error('[phone] ' + e.message));
  phoneSrv.listen(PHONE_PORT, '0.0.0.0');
}
startPhone();
server.on('error', (e) => {
  // e.g. the old "Start BBR Cards" window is still open on the same port
  console.error('Could not start on port ' + PORT + ': ' + e.message);
  if (DESK.on) { try { process.send({ type: 'listen-error', code: e.code, port: PORT }); } catch (x) { /* ignore */ } }
  setTimeout(() => process.exit(3), 300);
});
server.listen(PORT, '127.0.0.1', () => {
  if (DESK.on) { try { process.send({ type: 'ready', port: PORT, version: APP_VERSION }); } catch (e) { /* ignore */ } }
  console.log('');
  console.log('  BBR Viewer Cards is running.');
  console.log('  Dashboard:  http://localhost:' + PORT);
  console.log('  OBS overlay (Browser Source, 1920x1080):  http://localhost:' + PORT + '/overlay');
  console.log('  Leave this window open while you stream.');
  console.log('');
  twitch.start();
  kick.start();
  kick.startApi();
  youtube.start();
  if (process.platform === 'win32' && !process.env.NO_BROWSER) {
    require('child_process').exec('start "" "http://localhost:' + PORT + '"');
  }
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
