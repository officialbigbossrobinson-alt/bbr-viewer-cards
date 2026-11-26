// v30 screens: Be Right Back, Big Cam backdrops, links flash, game stingers (with scene switching), music.
// Everything here pushes plain events to the browser sources (brb.html, bigcam.html, overlay.html, starting.html).
const { musicCfg, musicSet } = require('./media');

const FOOTY = /\bfc\b|fc \d|fifa|football|soccer|ea sports/i;
// which look fits the game on stream
function lookOf(game, theme) {
  const g = String(game || '');
  if (/american truck|\bats\b/i.test(g)) return 'ats';
  if (/euro truck|ets\s?2|truck/i.test(g)) return 'ets';
  if (FOOTY.test(g)) return theme === 'elite' ? 'elite' : 'football';   // v43: Playoff night = Elite Playoffs
  if (/arc raiders/i.test(g)) return 'arc';
  if (/metal gear|\bmgs\b/i.test(g)) return 'mgs';
  if (/grand theft auto|\bgta\b/i.test(g)) return 'heist';
  return theme === 'ets' || theme === 'heist' || theme === 'elite' ? theme : 'football';
}
const LOOKS = { football: 'Football (Boss Sports News)', elite: 'Elite Playoffs (black & gold)', ets: 'Euro Truck Simulator', ats: 'American Truck Simulator', arc: 'Arc Raiders', mgs: 'Metal Gear', heist: 'Sunset Heist (GTA-style)', neon: 'Neon (anything)' };
// Big Cam sets: a back wall behind you and a desk / table in front of you
const SETS = {
  studio: { name: 'Pundit studio', look: 'football', idea: 'TV football studio: LED wall with the BSN logo and a pitch, curved glossy pundit desk' },
  haulage: { name: 'Haulage office', look: 'ets', idea: 'BBR Haulage depot office: window onto the motorway with lorries going past at dusk, Europe route map, wooden desk with a CB radio, logbook and a brew' },
  cab: { name: 'Truck cab', look: 'ets', idea: 'Inside the cab: the windscreen shows the road rolling towards you, dashboard and steering wheel in front of you' },
  diner: { name: 'Roadside diner', look: 'ats', idea: 'American truck-stop diner at night: neon OPEN 24 HRS, window onto the desert interstate, red counter with a coffee cup' },
  bunker: { name: 'Raider bunker', look: 'arc', idea: 'Underground raider bunker: concrete, hazard stripes, a sweeping red alarm light, metal workbench with crates' },
  command: { name: 'Command room', look: 'mgs', idea: 'Mother-Base style command room: green codec screens, radar sweep, steel console' },
  safehouse: { name: 'Beach safehouse', look: 'heist', idea: 'Sunset-coast safehouse: big window onto palm trees, the ocean and a neon city skyline at sunset, a heist planning board with photos and red string, glass desk with a burner phone and a stack of cash' },
  penthouse: { name: 'Penthouse', look: 'heist', idea: 'Penthouse at night: floor-to-ceiling glass over a neon city, helicopter lights going past, marble desk with a gold edge' },
  den: { name: 'Neon den', look: 'neon', idea: 'Gaming den: BBR neon sign, LED strips, shelves, desk with a glowing edge' },
};
const AUTO_SET = { football: 'studio', elite: 'studio', ets: 'haulage', ats: 'diner', arc: 'bunker', mgs: 'command', heist: 'safehouse', neon: 'den' };
// v32: the words on the Starting Soon screen, for each game (you can change any of them: Live › Starting soon › Words)
// air = the little chip next to the BBR bug: [before the timer starts, while it counts down, at kick-off]
const START_FIELDS = { bug: 'Top bar', airWait: 'Chip: before the timer', airRun: 'Chip: while counting down', airLive: 'Chip: at the start', kick: 'Line above the title', title: 'Big title', clock: 'Above the timer', clockDone: 'Above the timer at 0:00', arrivals: 'Arrivals board', here: 'Arrivals count word', chat: 'Chat box title', chatSub: 'Chat box subtitle', go: 'Kick-off splash', goSub: 'Kick-off splash, small line' };
const START_WORDS = {
  football: { bug: 'BOSS SPORTS NEWS · PRE-MATCH', airWait: 'PRE-MATCH', airRun: 'ON AIR SOON', airLive: 'LIVE', kick: 'TONIGHT ON BIGBOSSROBINSON', title: 'STARTING SOON', clock: 'KICK-OFF IN', clockDone: 'KICK-OFF', arrivals: 'ARRIVALS', here: 'IN THE BUILDING', chat: 'THE TERRACE', chatSub: 'LIVE CHAT', go: 'KICK-OFF!', goSub: 'WE ARE LIVE' },
  elite: { bug: 'ELITE PLAYOFFS · MATCHDAY', airWait: 'PRE-MATCH', airRun: 'WALK-OUT SOON', airLive: 'LIVE', kick: 'ELITE PLAYOFFS · TONIGHT ON BIGBOSSROBINSON', title: 'PLAYOFF NIGHT', clock: 'KICK-OFF IN', clockDone: 'KICK-OFF', arrivals: 'ARRIVALS', here: 'IN THE STANDS', chat: 'THE TERRACE', chatSub: 'LIVE CHAT', go: 'KICK-OFF!', goSub: 'PLAYOFF NIGHT IS LIVE' },
  ets: { bug: 'BBR HAULAGE · TONIGHT\'S RUN', airWait: 'IN THE DEPOT', airRun: 'LOADING UP', airLive: 'ON THE ROAD', kick: 'BBR HAULAGE · TONIGHT ON BIGBOSSROBINSON', title: 'DEPARTING SOON', clock: 'ENGINE ON IN', clockDone: 'ENGINE ON', arrivals: 'CONVOY ARRIVALS', here: 'ON THE ROAD', chat: 'CB RADIO', chatSub: 'CHANNEL 19 · LIVE CHAT', go: 'ENGINE ON!', goSub: 'WE ARE ROLLING' },
  ats: { bug: 'BBR FREIGHT LINES · TONIGHT\'S HAUL', airWait: 'AT THE YARD', airRun: 'HITCHING UP', airLive: 'ON THE INTERSTATE', kick: 'BBR FREIGHT LINES · COAST TO COAST', title: 'HITTING THE ROAD SOON', clock: 'WHEELS ROLL IN', clockDone: 'WHEELS ROLLING', arrivals: 'TRUCK STOP', here: 'IN THE CONVOY', chat: 'CB CHANNEL 19', chatSub: 'BREAKER BREAKER · LIVE CHAT', go: '10-4, LET\'S ROLL!', goSub: 'WE ARE ON THE ROAD' },
  heist: { bug: 'SUNSET COAST · TONIGHT\'S JOB', airWait: 'LAYING LOW', airRun: 'GEARING UP', airLive: 'ON THE JOB', kick: 'THE CREW ASSEMBLES · BIGBOSSROBINSON', title: 'THE JOB STARTS SOON', clock: 'THE JOB STARTS IN', clockDone: 'THE JOB IS ON', arrivals: 'CREW CHECK-IN', here: 'IN THE CREW', chat: 'BURNER PHONE', chatSub: 'ENCRYPTED · LIVE CHAT', go: 'IT\'S GO TIME!', goSub: 'THE JOB IS ON' },
  arc: { bug: 'TOPSIDE · RAID BRIEFING', airWait: 'IN THE BUNKER', airRun: 'GEARING UP', airLive: 'TOPSIDE', kick: 'RAIDERS ASSEMBLE · BIGBOSSROBINSON', title: 'DEPLOYING SOON', clock: 'DROPPING IN', clockDone: 'DEPLOYED', arrivals: 'SQUAD CHECK-IN', here: 'RAIDERS READY', chat: 'RAIDER COMMS', chatSub: 'SQUAD CHANNEL · LIVE CHAT', go: 'DROP IN!', goSub: 'RAIDERS, MOVE OUT' },
  mgs: { bug: 'MOTHER BASE · MISSION BRIEFING', airWait: 'STANDING BY', airRun: 'INFILTRATING', airLive: 'MISSION LIVE', kick: 'MISSION BRIEFING · BIGBOSSROBINSON', title: 'MISSION STARTS SOON', clock: 'INSERTION IN', clockDone: 'INSERTION', arrivals: 'UNITS REPORTING IN', here: 'ON STANDBY', chat: 'CODEC', chatSub: '140.85 · LIVE CHAT', go: 'MISSION START!', goSub: 'OPERATION UNDERWAY' },
  neon: { bug: 'BIGBOSSROBINSON · TONIGHT', airWait: 'GETTING READY', airRun: 'STARTING SOON', airLive: 'LIVE', kick: 'TONIGHT ON BIGBOSSROBINSON', title: 'STARTING SOON', clock: 'STARTING IN', clockDone: 'STARTING', arrivals: 'ARRIVALS', here: 'IN CHAT', chat: 'LIVE CHAT', chatSub: 'SAY HI', go: 'LET\'S GO!', goSub: 'WE ARE LIVE' },
};
// the words for a look, with your own changes on top (blank = the default)
function startWords(look, custom) {
  const base = START_WORDS[look] || START_WORDS.football, mine = (custom && custom[look]) || {}, out = {};
  for (const k of Object.keys(START_FIELDS)) { const v = String(mine[k] == null ? '' : mine[k]).trim(); out[k] = v ? v.toUpperCase().slice(0, 60) : base[k]; }
  return out;
}
const PLATFORMS = ['twitch', 'youtube', 'kick', 'tiktok', 'x', 'instagram', 'discord'];

class Screens {
  // o: cfg(), saveCfg(), push(ev), obs, media, game(), theme(), feed(text, colour), socials(), live(), say(text)
  constructor(o) {
    Object.assign(this, o);
    this.BRB = { on: false, running: false, endsAt: null, left: null, prev: null };
    this.lastLinks = Date.now();
    this.scenes = [];
    setInterval(() => this.linksTick(), 15000).unref();
  }
  c(k) { const c = this.cfg(); if (!c[k]) c[k] = {}; return c[k]; }
  look(want) { return want && want !== 'auto' && LOOKS[want] ? want : lookOf(this.game(), this.theme()); }
  photos(ids) { return (Array.isArray(ids) ? ids : []).map((id) => this.media.url(id)).filter(Boolean); }

  // ================= Be Right Back =================
  brbS() {
    const c = this.c('brb');
    return { look: LOOKS[c.look] ? c.look : 'auto', title: String(c.title != null ? c.title : '').slice(0, 40), message: String(c.message != null ? c.message : '').slice(0, 120),
      mins: Math.max(0, Math.min(120, c.mins != null ? +c.mins : 5)), scene: String(c.scene != null ? c.scene : 'BRB').slice(0, 80), switchScene: c.switchScene !== false, stinger: c.stinger !== false,
      photos: Array.isArray(c.photos) ? c.photos.filter((x) => typeof x === 'string').slice(0, 30) : [], photoSecs: Math.max(4, Math.min(120, +c.photoSecs || 10)), chat: c.chat !== false, ticker: c.ticker !== false, music: musicCfg(c.music, this.media), musicRaw: c.music || {} };
  }
  brbSet(n) {
    const c = this.c('brb');
    for (const k of ['title', 'message', 'scene']) if (typeof n[k] === 'string') c[k] = n[k];
    for (const k of ['mins', 'photoSecs']) if (n[k] != null && n[k] !== '') c[k] = +n[k];
    if (LOOKS[n.look] || n.look === 'auto') c.look = n.look;
    for (const k of ['switchScene', 'stinger', 'chat', 'ticker']) if (typeof n[k] === 'boolean') c[k] = n[k];
    if (Array.isArray(n.photos)) c.photos = n.photos.map(String).slice(0, 30);
    if (n.music) c.music = musicSet(n.music);
    this.saveCfg(); this.brbPush(); return this.brbS();
  }
  brbLeft() { const B = this.BRB; return B.running ? Math.max(0, B.endsAt - Date.now()) : B.left != null ? B.left : this.brbS().mins * 60000; }
  brbState() {
    const S = this.brbS(), look = this.look(S.look), B = this.BRB;
    return { type: 'brb', now: Date.now(), on: B.on, running: B.running, endsAt: B.running ? B.endsAt : null, left: this.brbLeft(), dur: S.mins * 60000, look, game: this.game() || '',
      S: { title: S.title, message: S.message, photos: this.photos(S.photos), photoSecs: S.photoSecs, chat: S.chat, ticker: S.ticker, timer: S.mins > 0 }, music: S.music, socials: this.socials() };
  }
  brbPush() { this.push(this.brbState()); }
  async brbStart() {
    const S = this.brbS(), B = this.BRB;
    if (!B.on) { B.on = true; B.left = S.mins * 60000; B.running = S.mins > 0; B.endsAt = B.running ? Date.now() + B.left : null; }
    let msg = 'BRB screen on';
    if (S.switchScene && this.obs.ready) {
      try { const cur = (await this.obs.req('GetCurrentProgramScene')).currentProgramSceneName; if (cur && cur !== S.scene) B.prev = cur; } catch (e) { /* ignore */ }
      const r = await this.toScene(S.scene, S.stinger, { look: this.look(S.look) }); msg = r.error ? 'BRB on, but: ' + r.error : 'BRB: switched to ' + S.scene;
    }
    this.brbPush(); return msg;
  }
  async brbEnd() {
    const S = this.brbS(), B = this.BRB, back = B.prev;
    B.on = false; B.running = false; B.endsAt = null; B.left = null;
    this.push({ type: 'brb', action: 'end' });
    let msg = 'BRB screen off';
    if (S.switchScene && this.obs.ready && back) { const r = await this.toScene(back, S.stinger, { look: this.look(S.look) }); msg = r.error ? 'BRB off, but: ' + r.error : 'Back to ' + back; }
    setTimeout(() => this.brbPush(), 2500);
    return msg;
  }
  brbTimer(act, secs) {
    const B = this.BRB;
    if (act === 'start') { if (!B.running) { const l = B.left != null && B.left > 0 ? B.left : this.brbS().mins * 60000; B.endsAt = Date.now() + l; B.running = true; } }
    else if (act === 'stop') { if (B.running) { B.left = Math.max(0, B.endsAt - Date.now()); B.running = false; B.endsAt = null; } }
    else if (act === 'add') { if (B.running) B.endsAt = Math.max(Date.now() + 1000, B.endsAt + secs * 1000); else B.left = Math.max(0, this.brbLeft() + secs * 1000); }
    else if (act === 'set') { const ms = Math.max(0, Math.min(7200, Math.round(+secs || 0))) * 1000; if (B.running) B.endsAt = Date.now() + ms; else B.left = ms; }
    this.brbPush(); return this.brbLeft();
  }

  // ================= Big Cam =================
  bigS() {
    const c = this.c('bigcam');
    return { set: SETS[c.set] || c.set === 'photo' ? c.set : 'auto', photo: typeof c.photo === 'string' ? c.photo : null, dim: Math.max(0, Math.min(80, c.dim != null ? +c.dim : 15)), blur: Math.max(0, Math.min(20, +c.blur || 0)),
      desk: c.desk !== false, deskSet: SETS[c.deskSet] ? c.deskSet : 'auto', motion: c.motion !== false, scene: String(c.scene != null ? c.scene : 'Big Cam').slice(0, 80), music: musicCfg(c.music, this.media), musicRaw: c.music || {}, follow: c.follow !== false };
  }
  bigSet(n) {
    const c = this.c('bigcam');
    if (SETS[n.set] || n.set === 'auto' || n.set === 'photo') c.set = n.set;
    if (SETS[n.deskSet] || n.deskSet === 'auto') c.deskSet = n.deskSet;
    if (n.photo === null || typeof n.photo === 'string') c.photo = n.photo || null;
    for (const k of ['dim', 'blur']) if (n[k] != null && n[k] !== '') c[k] = +n[k];
    for (const k of ['desk', 'motion', 'follow']) if (typeof n[k] === 'boolean') c[k] = n[k];
    if (typeof n.scene === 'string') c.scene = n.scene;
    if (n.music) c.music = musicSet(n.music);
    this.saveCfg(); this.bigPush(); return this.bigS();
  }
  bigResolved() {
    const S = this.bigS(), look = this.look('auto');
    const set = S.set === 'auto' ? AUTO_SET[look] : S.set;
    const desk = S.deskSet === 'auto' ? (set === 'photo' ? AUTO_SET[look] : set) : S.deskSet;
    return { set, desk };
  }
  bigState() {
    const S = this.bigS(), R = this.bigResolved();
    return { type: 'bigcam', set: R.set, deskSet: R.desk, desk: S.desk, photo: S.photo ? this.media.url(S.photo) : null, dim: S.dim, blur: S.blur, motion: S.motion, music: S.music, look: this.look('auto'), name: R.set === 'photo' ? 'My photo' : (SETS[R.set] || {}).name };
  }
  bigPush() { this.push(this.bigState()); }
  bigStep(d) {
    const ids = Object.keys(SETS).concat(this.bigS().photo ? ['photo'] : []), cur = this.bigResolved().set;
    const i = (ids.indexOf(cur) + d + ids.length) % ids.length;
    this.c('bigcam').set = ids[i]; this.saveCfg(); this.bigPush();
    return ids[i] === 'photo' ? 'My photo' : SETS[ids[i]].name;
  }
  // put the two Big Cam layers in your Big Cam scene: the back wall at the bottom, the desk on top
  async bigSetupObs(port) {
    if (!this.obs.ready) return { error: 'OBS is not connected' };
    const S = this.bigS(), done = [];
    try { await this.obs.req('CreateScene', { sceneName: S.scene }); done.push('made the scene "' + S.scene + '"'); } catch (e) { /* already there */ }
    const add = async (name, layer) => {
      let id = null;
      try { id = (await this.obs.req('GetSceneItemId', { sceneName: S.scene, sourceName: name })).sceneItemId; } catch (e) { id = null; }
      if (id == null) {
        try { id = (await this.obs.req('CreateInput', { sceneName: S.scene, inputName: name, inputKind: 'browser_source', inputSettings: { url: 'http://localhost:' + port + '/bigcam?layer=' + layer, width: 1920, height: 1080, reroute_audio: layer === 'back' }, sceneItemEnabled: true })).sceneItemId; done.push('added ' + name); }
        catch (e) { id = (await this.obs.req('GetSceneItemId', { sceneName: S.scene, sourceName: name })).sceneItemId; await this.obs.req('CreateSceneItem', { sceneName: S.scene, sourceName: name, sceneItemEnabled: true }).catch(() => {}); done.push('added ' + name); }
      } else done.push(name + ' was already there');
      return id;
    };
    try {
      const back = await add('BBR Big Cam back', 'back'), front = await add('BBR Big Cam front', 'front');
      const { sceneItems } = await this.obs.req('GetSceneItemList', { sceneName: S.scene });
      const top = Math.max(0, sceneItems.length - 1);
      await this.obs.req('SetSceneItemIndex', { sceneName: S.scene, sceneItemId: back, sceneItemIndex: 0 }).catch(() => {});
      await this.obs.req('SetSceneItemIndex', { sceneName: S.scene, sceneItemId: front, sceneItemIndex: top }).catch(() => {});
      done.push('back wall at the bottom, desk on top: your camera goes in between');
      return { ok: true, done };
    } catch (e) { return { error: e.message, done }; }
  }

  // ================= links flash =================
  linksS() {
    const c = this.c('links'), so = this.socials() || {};
    const def = { twitch: so.twitch ? 'twitch.tv/' + so.twitch : 'twitch.tv/bigbossrobinson', youtube: so.youtube ? 'youtube.com/' + String(so.youtube).replace(/^(?!@)/, '@') : 'youtube.com/@bigbossrobinson', kick: so.kick ? 'kick.com/' + so.kick : 'kick.com/bigbossrobinson', tiktok: 'tiktok.com/@bigbossrobinson', x: 'x.com/bigbossrobinson', instagram: 'instagram.com/bigbossrobinson', discord: 'discord.gg/' };
    const L = c.list || {};
    const list = PLATFORMS.map((k) => ({ k, text: String(L[k] && L[k].text != null ? L[k].text : def[k]).slice(0, 60), on: L[k] ? L[k].on !== false : ['twitch', 'youtube', 'kick'].includes(k) }));
    return { on: c.on !== false, everyMins: Math.max(1, Math.min(120, +c.everyMins || 10)), secs: Math.max(5, Math.min(60, +c.secs || 14)), pos: ['tl', 'tc', 'tr', 'ml', 'mr', 'bl', 'bc', 'br'].includes(c.pos) ? c.pos : 'bl',
      x: Math.max(-800, Math.min(800, +c.x || 0)), y: Math.max(-500, Math.min(500, +c.y || 0)), scale: Math.max(50, Math.min(200, +c.scale || 100)), style: ['flip', 'slide', 'neon'].includes(c.style) ? c.style : 'flip', liveOnly: c.liveOnly !== false, list, title: String(c.title != null ? c.title : 'FIND BIGBOSSROBINSON').slice(0, 40) };
  }
  linksSet(n) {
    const c = this.c('links');
    for (const k of ['everyMins', 'secs', 'x', 'y', 'scale']) if (n[k] != null && n[k] !== '') c[k] = +n[k];
    for (const k of ['on', 'liveOnly']) if (typeof n[k] === 'boolean') c[k] = n[k];
    if (typeof n.pos === 'string') c.pos = n.pos; if (typeof n.style === 'string') c.style = n.style; if (typeof n.title === 'string') c.title = n.title;
    if (Array.isArray(n.list)) { c.list = {}; for (const x of n.list) if (PLATFORMS.includes(x.k)) c.list[x.k] = { text: String(x.text || '').slice(0, 60), on: x.on !== false }; }
    this.saveCfg(); this.push(Object.assign({ type: 'linkscfg' }, this.linksPayload())); return this.linksS();
  }
  linksPayload() { const S = this.linksS(); return { pos: S.pos, x: S.x, y: S.y, scale: S.scale, style: S.style, secs: S.secs, title: S.title, list: S.list.filter((l) => l.on && l.text) }; }
  linksNow() { const p = this.linksPayload(); if (!p.list.length) return { error: 'No links switched on (Live › Links & stingers)' }; this.lastLinks = Date.now(); this.push(Object.assign({ type: 'links' }, p)); return { ok: true }; }
  linksTick() {
    const S = this.linksS(); if (!S.on) return;
    if (S.liveOnly && !this.live()) return;
    if (Date.now() - this.lastLinks >= S.everyMins * 60000) this.linksNow();
  }
  linksNext() { const S = this.linksS(); return S.on ? Math.max(0, S.everyMins * 60000 - (Date.now() - this.lastLinks)) : null; }

  // ================= stingers =================
  stingS() {
    const c = this.c('stinger');
    return { look: LOOKS[c.look] ? c.look : 'auto', variant: ['auto', 'truck', 'sign', 'tacho', 'wipe', 'comic'].includes(c.variant) ? c.variant : 'auto', photo: typeof c.photo === 'string' ? c.photo : null,
      text: String(c.text != null ? c.text : '').slice(0, 30), sub: String(c.sub != null ? c.sub : '').slice(0, 40), ms: Math.max(900, Math.min(4000, +c.ms || 1800)), cut: Math.max(20, Math.min(80, +c.cut || 50)), sound: c.sound !== false, color: /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '' };
  }
  stingSet(n) {
    const c = this.c('stinger');
    for (const k of ['look', 'variant', 'text', 'sub', 'color']) if (typeof n[k] === 'string') c[k] = n[k];
    if (n.photo === null || typeof n.photo === 'string') c.photo = n.photo || null;
    for (const k of ['ms', 'cut']) if (n[k] != null && n[k] !== '') c[k] = +n[k];
    if (typeof n.sound === 'boolean') c.sound = n.sound;
    this.saveCfg(); return this.stingS();
  }
  stingEvent(o) {
    const S = Object.assign(this.stingS(), o || {}), look = this.look(S.look);
    const variant = S.variant === 'auto' ? ({ ets: 'truck', ats: 'truck', football: 'wipe', arc: 'wipe', mgs: 'wipe', heist: 'comic', neon: 'wipe' }[look]) : S.variant;
    return { type: 'stinger', look, variant, photo: S.photo ? this.media.url(S.photo) : null, text: S.text, sub: S.sub, ms: S.ms, cut: S.cut, sound: S.sound, color: S.color, at: Date.now() + 120 };
  }
  // play the stinger; with a scene, OBS cuts to it while the screen is covered
  async toScene(scene, useStinger, o) {
    if (!scene) return { error: 'No scene' };
    if (!useStinger) { try { await this.obs.req('SetCurrentProgramScene', { sceneName: scene }); return { ok: true }; } catch (e) { return { error: e.message }; } }
    const ev = this.stingEvent(o); this.push(ev);
    await new Promise((r) => setTimeout(r, 120 + ev.ms * ev.cut / 100));
    if (!this.obs.ready) return { error: 'OBS is not connected (the stinger played, but the scene didn\'t change)' };
    let was = null;
    try { was = (await this.obs.req('GetCurrentSceneTransition')).transitionName; } catch (e) { was = null; }
    try {
      if (was && was !== 'Cut') await this.obs.req('SetCurrentSceneTransition', { transitionName: 'Cut' }).catch(() => {});
      await this.obs.req('SetCurrentProgramScene', { sceneName: scene });
    } catch (e) { return { error: 'OBS: ' + e.message }; }
    finally { if (was && was !== 'Cut') setTimeout(() => this.obs.req('SetCurrentSceneTransition', { transitionName: was }).catch(() => {}), 400); }
    return { ok: true, scene };
  }
  async sceneList() { if (!this.obs.ready) return this.scenes; try { this.scenes = ((await this.obs.req('GetSceneList')).scenes || []).map((x) => x.sceneName).reverse(); } catch (e) { /* keep old */ } return this.scenes; }
}
module.exports = { Screens, LOOKS, SETS, AUTO_SET, PLATFORMS, lookOf, START_WORDS, START_FIELDS, startWords };
