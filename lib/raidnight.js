// Raid Night: the Queen wakes up when the stream is busy enough to beat her.
//  All stream: support fills the War Chest (subs = armour, bits / Kicks / Super Chats / Power-ups = firepower, gifts = extra time).
//  2-3 times: a scout drone flies over, chat types !shoot together for a bonus.
//  Viewers climbing towards the target: the Queen taunts ("get to 20 and I'll come out").
//  Viewers at the target for a couple of minutes: THE QUEEN IS AWAKE. The briefing starts after a short warning, after this game,
//  or when you say (delay / not tonight). Briefing: siren, countdown, intel, !enlist roll call. Then the raid.
//  The Queen gets stronger every time she wins (season story).
const CAP = { armour: 20, fire: 30, time: 120 };

class RaidNight {
  constructor(o) {
    Object.assign(this, o);   // store, cfg, saveCfg, push, say, isLive, streamNo, battle, startRaid, cam, obs, sceneHeld, rollCredits, displayOf
    this.drone = null; this.briefTimer = null;
    setInterval(() => { try { this.tick(); } catch (e) { console.error('[raidnight]', e.message); } }, 5000).unref();
  }
  S() {
    const c = this.cfg().raidNight || {};
    return { on: !!c.on, minViewers: Math.max(1, Math.min(10000, Math.round(+c.minViewers) || 20)), holdMin: Math.max(0, Math.min(15, c.holdMin != null ? +c.holdMin : 2)), mode: c.mode === 'ask' ? 'ask' : 'auto',
      warnSecs: Math.max(15, Math.min(600, Math.round(+c.warnSecs) || 90)), earliestMin: Math.max(0, Math.min(240, c.earliestMin != null ? +c.earliestMin : 20)),
      briefMin: Math.max(1, Math.min(30, +c.briefMin || 5)), drones: Math.max(0, Math.min(6, c.drones != null ? +c.drones : 3)),
      scene: c.scene || '', season: c.season !== false, quiet: c.quiet !== false, commander: c.commander !== false, autoCredits: c.creditsAfter === true, fair: c.fair !== false, discordAt: Math.max(0, Math.min(1000, c.discordAt != null ? +c.discordAt : 15)) };
  }
  set(n) {
    const cur = this.S(), out = {};
    for (const k of Object.keys(cur)) out[k] = n[k] != null ? n[k] : cur[k];
    out.on = !!out.on; out.fair = !!out.fair; out.season = !!out.season; out.quiet = !!out.quiet; out.commander = !!out.commander; out.creditsAfter = !!out.autoCredits; delete out.autoCredits;
    out.scene = String(out.scene || '').slice(0, 80);
    this.cfg().raidNight = out; this.saveCfg(); this.sync();
  }
  data() {
    const d = this.store.data;
    if (!d.raidNight) d.raidNight = { season: { queenWins: 0, raidWins: 0, streak: 0, best: 0, slayers: {} }, nights: {}, last: null };
    return d.raidNight;
  }
  night() {
    const no = this.streamNo(); if (!no) return null;
    const N = this.data().nights;
    if (!N[no]) {
      N[no] = { no, start: Date.now(), chest: { armour: 0, fire: 0, time: 0 }, enlisted: [], drones: [], droneAt: [], stage: 'chest', skipped: false };
      const keys = Object.keys(N).map(Number).sort((a, b) => a - b); while (keys.length > 30) delete N[keys.shift()];
    }
    return N[no];
  }
  viewersNow() { try { const v = this.viewers ? this.viewers() : null; return v && v.n != null ? v : { n: null }; } catch (e) { return { n: null }; } }
  queenMult() { const s = this.data().season; return this.S().season ? Math.round(Math.pow(1.1, Math.min(10, s.level || 0)) * 100) / 100 : 1; }
  state() {
    const S = this.S(), n = this.S().on && this.isLive() ? this.night() : null, s = this.data().season;
    const vw = this.viewersNow();
    return { type: 'raidnight', kind: 'state', on: S.on && !!n && !n.skipped, need: S.minViewers, viewers: vw.n, startAt: n && n.stage === 'ready' ? n.startAt || null : null, afterGame: !!(n && n.afterGame), delayUntil: n && n.delayUntil > Date.now() ? n.delayUntil : null, mode: S.mode,
      stage: n ? n.stage : null, chest: n ? n.chest : null, cap: CAP,
      enlisted: n ? n.enlisted.length : 0, season: { queenWins: s.queenWins, raidWins: s.raidWins, level: s.level || 0, mult: this.queenMult() } };
  }
  sync() { this.push(this.state()); }
  // anything that happened this stream (called from the stream log)
  fromLog(kind, n, extra) {
    if (!this.S().on || !this.isLive()) return;
    const N = this.night(); if (!N || N.stage === 'done' || N.stage === 'raid') return;
    const C = N.chest; let what = null, add = 0;
    if (kind === 'sub') { add = extra && extra.tier === 3 ? 5 : extra && extra.tier === 2 ? 2 : 1; C.armour = Math.min(CAP.armour, C.armour + add); what = 'armour'; }
    else if (kind === 'gift') { add = 10 * (n || 1); C.time = Math.min(CAP.time, C.time + add); what = 'time'; }
    else if (kind === 'bits' || kind === 'kicks' || kind === 'sc') { add = Math.floor((n || 0) / 100); if (!add) return; C.fire = Math.min(CAP.fire, C.fire + add); what = 'fire'; }
    if (!what) return;
    this.store.save();
    this.push({ type: 'raidnight', kind: 'chest', what, add, chest: C, cap: CAP, who: extra && extra.who });
  }
  blocksBattles() {
    const S = this.S(); if (!S.on || !this.isLive()) return false;
    const N = this.night(); if (!N || N.skipped || N.stage === 'done') return false;
    if (N.stage === 'briefing' || N.stage === 'raid') return true;
    return S.quiet && N.stage === 'ready' && !N.afterGame;
  }
  // ---------- the clock ----------
  tick() {
    const S = this.S(); if (!S.on || !this.isLive()) return;
    const N = this.night(); if (!N || N.skipped || N.stage === 'done') return;
    // raid cancelled from the dashboard: don't block battles forever
    if (N.stage === 'raid') { if (this.battle.phase === 'idle') { N.idleRaid = (N.idleRaid || 0) + 1; if (N.idleRaid > 12) { N.stage = 'done'; this.store.save(); this.sync(); } } else N.idleRaid = 0; return; }
    if (N.stage === 'briefing') { if (!this.briefTimer) { const ms = (N.briefEnds || 0) - Date.now(); if (ms <= 0) this.launch(); else this.briefTimer = setTimeout(() => { this.briefTimer = null; this.launch(); }, ms); } return; }
    const now = Date.now(), vw = this.viewersNow(), n = vw.n;
    const idle = this.battle.phase === 'idle' && !this.sceneHeld();
    // drones: the first 20 minutes in, then about every 35 minutes, until the Queen comes out
    if (!N.droneAt.length && S.drones) { for (let i = 0; i < S.drones; i++) N.droneAt.push(N.start + (20 + i * 35) * 60000); this.store.save(); }
    const due = N.droneAt.find((t) => t <= now && now - t < 30 * 60000 && !N.drones.some((d) => d.at === t));
    if (due && idle && !this.drone && N.stage !== 'ready') this.startDrone(due);
    if (N.stage === 'ready') {
      if (!N.afterGame && N.startAt && now >= N.startAt && this.battle.phase === 'idle') this.briefing().catch(() => {});
      return;
    }
    if (N.stage !== 'chest' && N.stage !== 'taunt') return;
    if (n == null) return;   // no viewer count yet (platforms not connected): start it from the dashboard
    // the Queen stirs when the stream is close to the target
    if (!N.taunted && n >= Math.max(3, Math.round(S.minViewers * 0.7)) && n < S.minViewers) { N.taunted = true; N.stage = 'taunt'; this.store.save(); this.taunt(n); }
    if (S.discordAt && !N.discordPosted && n >= S.discordAt && n < S.minViewers && this.discordPing) { N.discordPosted = true; this.store.save(); this.discordPing(n, S.minViewers); }
    if (n >= S.minViewers) { if (!N.overSince) N.overSince = now; } else N.overSince = 0;
    const longEnough = N.overSince && now - N.overSince >= S.holdMin * 60000;
    const liveLongEnough = now - N.start >= S.earliestMin * 60000;
    if (longEnough && liveLongEnough && !(N.delayUntil > now)) this.wake(n);
  }
  // viewers hit the target: the Queen is awake. Auto = the briefing starts after a warning; Ask = waits for you.
  wake(n) {
    const S = this.S(), N = this.night(); if (!N || (N.stage !== 'chest' && N.stage !== 'taunt')) return { error: 'not now' };
    N.stage = 'ready'; N.readyAt = Date.now(); N.afterGame = false; N.startAt = S.mode === 'auto' ? Date.now() + S.warnSecs * 1000 : null; this.store.save();
    this.push({ type: 'raidnight', kind: 'awake', viewers: n, startAt: N.startAt, need: S.minViewers });
    this.say('THE QUEEN IS AWAKE! ' + (n ? n + ' of you are here. ' : '') + (N.startAt ? 'Raid Night briefing in ' + Math.round(S.warnSecs / 60 * 10) / 10 + ' min.' : 'Raid Night is coming.') + ' Fill the War Chest: subs = armour, bits = firepower, gifted subs = extra time.');
    if (this.onAwake) this.onAwake(n);
    this.sync(); return { ok: true };
  }
  // the streamer's buttons while the Queen is awake
  delay(mins) { const N = this.night(); if (!N || !/^(ready|chest|taunt)$/.test(N.stage)) return { error: 'nothing to delay' }; N.stage = 'chest'; N.afterGame = false; N.startAt = null; N.overSince = 0; N.delayUntil = Date.now() + Math.max(1, mins) * 60000; this.store.save(); this.push({ type: 'raidnight', kind: 'delay', mins }); this.sync(); return { ok: true }; }
  afterThisGame() { const N = this.night(); if (!N) return { error: 'not live' }; if (N.stage === 'chest' || N.stage === 'taunt') { N.stage = 'ready'; N.readyAt = Date.now(); } if (N.stage !== 'ready') return { error: 'already started' }; N.afterGame = true; N.startAt = null; this.store.save(); this.push({ type: 'raidnight', kind: 'aftergame' }); this.say('The Queen is waiting... Raid Night briefing straight after this game.'); this.sync(); return { ok: true }; }
  // a result was logged / a game finished
  gameOver() { const N = this.isLive() && this.S().on && this.night(); if (N && N.stage === 'ready' && N.afterGame) { setTimeout(() => this.briefing().catch(() => {}), 8000); return true; } return false; }
  taunt(n) {
    const lv = this.data().season.level || 0, need = this.S().minViewers;
    const lines = ['You think a few bits will save you? I\'ll be waiting.', 'Thirty minutes, little raiders. Then I feast.', 'Your War Chest is cute. Fill it faster.', lv ? 'I\'ve won ' + lv + ' time' + (lv === 1 ? '' : 's') + '. I only get stronger.' : 'Come and find me. If you dare.'];
    const line = lines[Math.floor(Math.random() * lines.length)];
    this.push({ type: 'raidnight', kind: 'taunt', line, need, viewers: n });
    this.say('THE QUEEN STIRS: "' + line + '" She comes out at ' + need + ' viewers (' + (n || '?') + ' now). Share the stream! Fill the War Chest: subs = armour, bits = firepower, gifted subs = extra time.');
  }
  // ---------- drone mini-game: everyone !shoot ----------
  startDrone(at) {
    const N = this.night(); const secs = 30;
    const need = Math.max(3, Math.min(12, Math.round((this.chatters ? this.chatters() : 6) * 0.35)));
    this.drone = { at: at || Date.now(), ends: Date.now() + secs * 1000, need, shooters: new Map() };
    this.push({ type: 'raidnight', kind: 'drone', phase: 'start', endsAt: this.drone.ends, need, secs });
    this.say('SCOUT DRONE overhead! Everyone type !shoot in the next ' + secs + 's. ' + need + ' hits brings it down and fills the War Chest.');
    this.droneTimer = setTimeout(() => this.endDrone(), secs * 1000);
    if (N && !at) N.droneAt.push(this.drone.at);
  }
  shoot(key, display) {
    const D = this.drone; if (!D || Date.now() > D.ends || D.shooters.has(key)) return !!D;
    D.shooters.set(key, display);
    this.push({ type: 'raidnight', kind: 'drone', phase: 'hit', hits: D.shooters.size, need: D.need, by: display });
    if (D.shooters.size >= D.need) { clearTimeout(this.droneTimer); this.endDrone(); }
    return true;
  }
  endDrone() {
    const D = this.drone; if (!D) return; this.drone = null;
    const N = this.night(), down = D.shooters.size >= D.need, add = down ? Math.min(5, 2 + Math.floor((D.shooters.size - D.need) / 3)) : 0;
    if (N) { N.drones.push({ at: D.at, down, hits: D.shooters.size, by: Array.from(D.shooters.keys()).slice(0, 60) }); if (down) N.chest.fire = Math.min(CAP.fire, N.chest.fire + add); this.store.save(); }
    this.push({ type: 'raidnight', kind: 'drone', phase: 'end', down, add, hits: D.shooters.size, need: D.need, chest: N ? N.chest : null, cap: CAP });
    this.say(down ? 'DRONE DOWN! ' + D.shooters.size + ' shooters. +' + add + ' firepower in the War Chest.' : 'The drone got away (' + D.shooters.size + ' of ' + D.need + ' hits). Next time!');
  }
  // ---------- the briefing ----------
  async briefing() {
    const S = this.S(), N = this.night(); if (!N || N.stage === 'briefing' || N.stage === 'raid') return { error: 'already started' };
    if (this.battle.phase !== 'idle') return { error: 'a battle is running, try after it' };
    N.stage = 'briefing'; N.briefEnds = Date.now() + S.briefMin * 60000; this.store.save();
    if (S.scene && this.obs && this.obs.ready) { try { await this.obs.req('SetCurrentProgramScene', { sceneName: S.scene }); } catch (e) { /* scene missing */ } }
    if (S.commander && this.cam) this.cam.run('commander', null);
    const s = this.data().season;
    this.push({ type: 'raidnight', kind: 'briefing', endsAt: N.briefEnds, chest: N.chest, cap: CAP, enlisted: N.enlisted.map((e) => e.display), intel: { level: s.level || 0, mult: this.queenMult(), queenWins: s.queenWins, raidWins: s.raidWins, streak: s.streak } });
    this.say('RAID NIGHT BRIEFING! ' + S.briefMin + ' minutes to the drop. Type !enlist to join the squad. War Chest: ' + N.chest.armour + ' armour, ' + N.chest.fire + ' firepower, +' + N.chest.time + 's.');
    clearTimeout(this.briefTimer);
    this.briefTimer = setTimeout(() => { this.briefTimer = null; this.launch(); }, S.briefMin * 60000);
    this.sync();
    return { ok: true };
  }
  enlist(key, display, platform, login) {
    const N = this.night(); if (!N || N.stage !== 'briefing') return false;
    if (N.enlisted.some((e) => e.key === key)) return true;
    N.enlisted.push({ key, display, platform, login }); this.store.save();
    this.push({ type: 'raidnight', kind: 'enlist', display, n: N.enlisted.length });
    return true;
  }
  launch() {
    clearTimeout(this.briefTimer); this.briefTimer = null;
    const N = this.night(); if (!N || N.stage === 'raid' || N.stage === 'done') return { error: 'nothing to launch' };
    if (this.battle.phase !== 'idle') return { error: 'a battle is running' };
    N.stage = 'raid'; this.store.save();
    this.push({ type: 'raidnight', kind: 'launch' });
    this.battle.raidMods = { armour: N.chest.armour, fire: N.chest.fire, time: N.chest.time, queenMult: this.queenMult(), raidNight: true, fair: this.S().fair };
    const ok = this.startRaid(N.enlisted);
    if (!ok) { N.stage = 'briefing'; this.battle.raidMods = null; return { error: 'could not start the raid' }; }
    this.sync();
    return { ok: true };
  }
  // the raid finished (from the battle reward)
  onResult(ranked, sim) {
    const N = this.isLive() && this.night();
    if (!N || N.stage !== 'raid') return;
    N.stage = 'done';
    const s = this.data().season;
    if (sim.win) { s.raidWins++; s.streak = (s.streak || 0) + 1; s.best = Math.max(s.best || 0, s.streak); }
    else { s.queenWins++; s.streak = 0; s.level = Math.min(10, (s.level || 0) + 1); }
    const mvp = ranked[0];
    if (sim.win && mvp) s.slayers[mvp.key] = (s.slayers[mvp.key] || 0) + 1;
    // everyone who took part gets a Raid Night on their card (ribbon at 5, 10, 25, 50)
    for (const f of ranked) { const v = this.store.data.viewers[f.key]; if (v && !v.test) v.raidNights = (v.raidNights || 0) + 1; }
    N.result = { win: !!sim.win, mvp: mvp ? mvp.display : null, squad: ranked.length, time: sim.time, queenLeft: sim.queenLeft, queenMax: sim.queenMax, slayers: sim.win ? ranked.slice(0, 3).map((f) => f.display) : [], level: s.level, at: Date.now(), chest: N.chest };
    this.data().last = Object.assign({ no: N.no, season: { raidWins: s.raidWins, queenWins: s.queenWins } }, N.result);
    this.store.save();
    this.push({ type: 'raidnight', kind: 'result', result: N.result, season: s });
    this.say(sim.win ? 'RAID NIGHT WON! The Queen is down. MVP ' + (N.result.mvp || '?') + '. Season: raiders ' + s.raidWins + ' - ' + s.queenWins + ' Queen.' : 'The Queen survives Raid Night... she\'ll be back next stream, stronger. Season: raiders ' + s.raidWins + ' - ' + s.queenWins + ' Queen.');
    this.sync();
    if (this.S().autoCredits && this.rollCredits) setTimeout(() => this.rollCredits(), 14000);
  }
  skip() { const N = this.night(); if (N) { N.skipped = true; clearTimeout(this.briefTimer); this.store.save(); } this.push({ type: 'raidnight', kind: 'cancel' }); this.sync(); return { ok: true }; }
  info() {
    const s = this.data().season, N = this.isLive() ? this.night() : null;
    const slayers = Object.entries(s.slayers || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => ({ name: this.displayOf(k), n }));
    return { settings: this.S(), state: this.state(), night: N ? { stage: N.stage, chest: N.chest, enlisted: N.enlisted.map((e) => e.display), drones: N.drones, droneAt: N.droneAt, stage2: N.stage, readyAt: N.readyAt || null, startAt: N.startAt || null, afterGame: !!N.afterGame, delayUntil: N.delayUntil || null, overSince: N.overSince || null, taunted: !!N.taunted, skipped: N.skipped } : null, viewers: this.viewersNow(), season: Object.assign({}, s, { slayers, mult: this.queenMult() }), last: this.data().last, cap: CAP };
  }
  chatLine() {
    const N = this.night(), s = this.data().season, S = this.S(), vw = this.viewersNow();
    if (!S.on || !N || N.skipped) return 'No Raid Night tonight.';
    const when = N.stage === 'done' ? 'is over' : N.stage === 'briefing' || N.stage === 'raid' ? 'is ON: type !enlist' : N.stage === 'ready' ? (N.afterGame ? 'starts after this game' : 'starts very soon') : 'starts when we hit ' + S.minViewers + ' viewers' + (vw.n != null ? ' (' + vw.n + ' now)' : '');
    return 'RAID NIGHT ' + when + '. War Chest: ' + N.chest.armour + '/' + CAP.armour + ' armour (subs), ' + N.chest.fire + '/' + CAP.fire + ' firepower (bits, Kicks, Super Chats), +' + N.chest.time + 's (gifted subs). Season: raiders ' + s.raidWins + ' - ' + s.queenWins + ' Queen.';
  }
}
module.exports = { RaidNight, CAP };
