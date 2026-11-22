// Matchday Squad: subs type !squad to get in the queue for the next Pro Clubs match.
// The app picks each team sheet fairly: whoever sat out last time goes first, then fewest games tonight,
// then sub tier, then who joined first. Nobody plays more than N in a row while others wait.
// Sitting out earns card points (and a Super Sub ribbon at 5). The bench can predict the score for points.
class Squad {
  constructor(o) { Object.assign(this, o); }   // store, cfg, saveCfg, push, streamNo, say, givePoints, displayName
  S() {
    const c = this.cfg().squad2 || {};
    return { size: Math.max(1, Math.min(10, +c.size || 10)), twitch: c.twitch !== false, kick: !!c.kick, youtube: !!c.youtube, bossIn: c.bossIn !== false, maxInRow: Math.max(1, Math.min(10, +c.maxInRow || 2)),
      benchPoints: Math.max(0, Math.min(5, c.benchPoints != null ? +c.benchPoints : 1)), tierFirst: c.tierFirst !== false, overflow: !!c.overflow, overflowName: String(c.overflowName || 'DIAMOND DOGS').toUpperCase().slice(0, 24),
      clubName: String(c.clubName || 'BOSSHAUSENS').toUpperCase().slice(0, 24), matchMins: Math.max(5, Math.min(40, +c.matchMins || 15)), predictions: c.predictions !== false, autoNext: c.autoNext !== false, open: c.open !== false };
  }
  set(n) {
    const c = Object.assign({}, this.cfg().squad2 || {});
    for (const k of ['twitch', 'kick', 'youtube', 'bossIn', 'tierFirst', 'overflow', 'predictions', 'autoNext', 'open']) if (typeof n[k] === 'boolean') c[k] = n[k];
    for (const k of ['size', 'maxInRow', 'benchPoints', 'matchMins']) if (n[k] != null && isFinite(n[k])) c[k] = +n[k];
    for (const k of ['overflowName', 'clubName']) if (typeof n[k] === 'string') c[k] = n[k];
    this.cfg().squad2 = c; this.saveCfg(); this.sync();
  }
  D() {
    const d = this.store.data, no = this.streamNo();
    if (!d.squadQ || d.squadQ.no !== no) d.squadQ = { no, match: 0, list: [], sheet: null, preds: {}, history: [] };
    return d.squadQ;
  }
  // who can join: Twitch subs (Prime and gifted count); Kick subs and YouTube members only if switched on
  eligible(platform, badges, v) {
    const S = this.S(), b = badges || [], sub = b.includes('subscriber') || b.includes('founder') || b.includes('og');
    if (b.includes('broadcaster')) return { ok: false, why: 'you are the Boss' };
    if (platform === 'twitch') return S.twitch && (sub || (v && v.subPlatform === 'twitch' && v.lastSubAt && Date.now() - v.lastSubAt < 35 * 86400000)) ? { ok: true } : { ok: false, why: 'subs only' };
    if (platform === 'kick') return S.kick && sub ? { ok: true } : { ok: false, why: S.kick ? 'Kick subs only' : 'Twitch subs only for now' };
    if (platform === 'youtube') return S.youtube && sub ? { ok: true } : { ok: false, why: S.youtube ? 'channel members only' : 'Twitch subs only for now' };
    return { ok: false, why: 'subs only' };
  }
  tierOf(v, platform) { if (platform !== 'twitch') return platform === 'kick' ? 'KICK' : 'MEMBER'; if (v.subGifted) return 'GIFT'; if (v.subPrime) return 'PRIME'; return 'T' + (v.subTier || 1); }
  tierRank(t) { return { T3: 3, T2: 2 }[t] || 1; }
  ban(x) { if (!this.banned) return null; const b = this.banned(x.display); return b && b.left > 0 ? b : null; }
  find(key) { return this.D().list.find((x) => x.key === key); }
  join(v, platform, badges) {
    const S = this.S(), D = this.D();
    if (!S.open) return { error: 'The squad list is closed right now' };
    const e = this.eligible(platform, badges, v); if (!e.ok) return { error: e.why };
    let p = this.find(v.key);
    if (!p) { p = { key: v.key, display: v.display, platform, tier: this.tierOf(v, platform), joinedAt: Date.now(), played: 0, inRow: 0, sat: 0, satLast: false }; D.list.push(p); this.store.save(); this.sync(); return { ok: true, joined: true, place: this.place(v.key) }; }
    p.tier = this.tierOf(v, platform); p.left = false;
    return { ok: true, joined: false, place: this.place(v.key) };
  }
  leave(key) { const D = this.D(), i = D.list.findIndex((x) => x.key === key); if (i < 0) return { error: 'Not in the list' }; D.list.splice(i, 1); this.store.save(); this.sync(); return { ok: true }; }
  // the order for the next match
  order() {
    const S = this.S(), D = this.D(), L = D.list.filter((x) => !x.left && !this.ban(x));
    const tired = (x) => x.inRow >= S.maxInRow && L.length > S.size ? 1 : 0;
    return L.slice().sort((a, b) => (b.satLast - a.satLast) || (tired(a) - tired(b)) || (a.played - b.played) || (S.tierFirst ? this.tierRank(b.tier) - this.tierRank(a.tier) : 0) || (a.joinedAt - b.joinedAt));
  }
  place(key) {
    const S = this.S(), O = this.order(), i = O.findIndex((x) => x.key === key); if (i < 0) return null;
    const on = this.D().sheet && this.D().sheet.players.includes(key);
    const waitMatches = Math.floor(i / S.size);
    return { pos: i + 1, of: O.length, playingNow: !!on, matchesAway: waitMatches, mins: waitMatches * S.matchMins };
  }
  // make the next team sheet (and pay the bench)
  next() {
    const S = this.S(), D = this.D(), O = this.order();
    if (!O.length) return { error: 'Nobody in the squad list yet (subs type !squad)' };
    const players = O.slice(0, S.size), bench = O.slice(S.size), overflow = S.overflow ? bench.slice(0, S.size) : [];
    const inOverflow = new Set(overflow.map((x) => x.key));
    D.match++;
    for (const x of D.list) {
      if (players.includes(x)) { x.cameBack = x.satLast; x.played++; x.inRow++; x.satLast = false; }
      else if (inOverflow.has(x.key)) { x.cameBack = x.satLast; x.played++; x.inRow = 0; x.satLast = false; }
      else if (this.ban(x)) { x.cameBack = false; x.inRow = 0; }   // banned: sits out, no bench points, keeps their place for when it ends
      else { x.cameBack = false; x.inRow = 0; x.satLast = true; x.sat++; if (this.onBench) this.onBench(x.key, S.benchPoints); }
    }
    D.sheet = { match: D.match, players: players.map((x) => x.key), bench: bench.filter((x) => !inOverflow.has(x.key)).map((x) => x.key), banned: D.list.filter((x) => this.ban(x)).map((x) => x.key), overflow: overflow.map((x) => x.key), team: D.team || null, at: Date.now() };
    D.preds = {};
    D.history.push({ match: D.match, players: D.sheet.players.slice() }); if (D.history.length > 40) D.history.shift();
    this.store.save();
    const st = this.state();
    this.push(Object.assign({}, st, { type: 'squadsheet', show: true }));
    this.sync();
    if (this.say) this.say(S.clubName + ' MATCH ' + D.match + ': ' + players.map((x) => x.display).join(', ') + (D.sheet.bench.length ? ' · BENCH (first in next match): ' + D.sheet.bench.map((k) => this.name(k)).slice(0, 8).join(', ') : '') + (overflow.length ? ' · ' + S.overflowName + ': ' + overflow.map((x) => x.display).join(', ') : ''));
    return Object.assign({ ok: true }, st);
  }
  name(k) { const p = this.D().list.find((x) => x.key === k); return p ? p.display : (this.displayName ? this.displayName(k) : k); }
  // bench predictions: one per person per match, "2-1"
  predict(key, us, them) {
    const S = this.S(), D = this.D(); if (!S.predictions || !D.sheet) return { error: 'No match to predict' };
    const p = this.find(key); if (!p || D.sheet.players.includes(key)) return { error: 'Only people waiting in the squad list can predict' };
    if (D.preds[key]) return { error: 'You already predicted ' + D.preds[key].us + '-' + D.preds[key].them };
    D.preds[key] = { us: Math.max(0, Math.min(20, us)), them: Math.max(0, Math.min(20, them)) }; this.store.save(); return { ok: true };
  }
  // a result was logged: pay the predictions, then (optionally) the next team sheet
  matchDone(score) {
    const D = this.D(), S = this.S(), winners = [];
    if (D.sheet && score && isFinite(score.us)) {
      const res = (a, b) => (a > b ? 1 : a < b ? -1 : 0);
      for (const [k, p] of Object.entries(D.preds)) {
        const exact = p.us === score.us && p.them === score.them, right = res(p.us, p.them) === res(score.us, score.them);
        if (exact || right) { const pts = exact ? 2 : 1; if (this.givePoints) this.givePoints(k, pts); winners.push(this.name(k) + (exact ? ' (spot on, +2)' : ' (+1)')); }
      }
      if (winners.length && this.say) this.say('Bench predictions: ' + winners.join(', ') + '. Card points added!');
    }
    D.preds = {}; this.store.save();
    if (S.autoNext && D.list.length) setTimeout(() => this.next(), 6000);
    return winners;
  }
  // positions are remembered per player (GK, CB, CDM, CM, LW, RW, ST ...)
  posMap() { const d = this.store.data; if (!d.squadPos) d.squadPos = {}; return d.squadPos; }
  posOf(k, name) { const M = this.posMap(); return M[k] || M[String(name || '').toLowerCase()] || ''; }
  // the Boss edits the team sheet by hand: names, order, positions, team name, match number.
  // Fairness still counts: whoever is taken off goes first next match (and gets the bench point), whoever comes on has played.
  edit(o) {
    const D = this.D(), S = this.S(), sh = D.sheet; if (!sh) return { error: 'Make a team sheet first (Next team sheet)' };
    const lineup = (Array.isArray(o.lineup) ? o.lineup : []).slice(0, 14).map((x) => ({ key: x.key ? String(x.key) : null, name: String(x.name || '').trim().slice(0, 30), pos: String(x.pos || '').toUpperCase().slice(0, 4) })).filter((x) => x.key || x.name);
    const before = new Set(sh.players), after = lineup.filter((x) => x.key && x.key !== '__boss' && this.find(x.key)).map((x) => x.key);
    for (const k of before) if (!after.includes(k)) { const x = this.find(k); if (x) { x.played = Math.max(0, x.played - 1); x.inRow = 0; x.satLast = true; x.sat++; x.cameBack = false; if (this.onBench) this.onBench(x.key, S.benchPoints); } }
    for (const k of after) if (!before.has(k)) { const x = this.find(k); if (x) { x.cameBack = x.satLast; x.played++; x.inRow++; x.satLast = false; } }
    const M = this.posMap(); for (const x of lineup) if (x.pos) M[x.key && x.key !== '__boss' ? x.key : x.name.toLowerCase()] = x.pos;
    sh.players = after; sh.lineup = lineup;
    if (o.team != null) { sh.team = String(o.team).toUpperCase().trim().slice(0, 24) || null; D.team = sh.team; }
    if (o.match != null && isFinite(o.match)) { sh.match = Math.max(1, Math.min(99, Math.round(+o.match))); D.match = Math.max(D.match, sh.match); }
    sh.bench = this.order().filter((x) => !after.includes(x.key)).map((x) => x.key);
    if (D.history.length) D.history[D.history.length - 1].players = after.slice();
    this.store.save(); this.sync();
    if (o.show) this.push(Object.assign({}, this.state(), { type: 'squadsheet', show: true }));
    return { ok: true };
  }
  state() {
    const S = this.S(), D = this.D(), sh = D.sheet;
    const tag = (k) => { const p = this.find(k); return p ? (p.cameBack ? 'BENCHED' : p.tier) : ''; };
    return { type: 'squad', settings: S, match: D.match, waiting: D.list.length, clubName: sh && sh.team ? sh.team : S.clubName,
      sheet: sh ? { match: sh.match, team: sh.team || S.clubName, edited: !!sh.lineup,
        players: sh.lineup ? sh.lineup.map((x) => x.key === '__boss' ? { key: '__boss', name: x.name || (this.boss ? this.boss() : 'THE BOSS'), tag: 'BOSS', pos: x.pos } : { key: x.key, name: x.name || (x.key ? this.name(x.key) : ''), tag: x.key ? tag(x.key) : '', pos: x.pos })
          : (S.bossIn && this.boss ? [{ key: '__boss', name: this.boss(), tag: 'BOSS', pos: this.posOf('__boss', this.boss()) }] : []).concat(sh.players.map((k) => ({ key: k, name: this.name(k), tag: tag(k), pos: this.posOf(k, this.name(k)) }))), bench: sh.bench.map((k) => this.name(k)), banned: (sh.banned || []).map((k) => this.name(k)), overflow: sh.overflow.map((k) => this.name(k)), overflowName: S.overflowName } : null,
      queue: this.order().map((x, i) => ({ key: x.key, name: x.display, tier: x.tier, played: x.played, sat: x.sat, satLast: x.satLast, pos: i + 1, platform: x.platform })).concat(D.list.filter((x) => this.ban(x)).map((x) => ({ key: x.key, name: x.display, tier: 'BANNED', banLeft: this.ban(x).left, played: x.played, sat: x.sat, satLast: false, pos: null, platform: x.platform }))), preds: Object.keys(D.preds).length };
  }
  sync() { this.push(this.state()); }
  chatLine(key) {
    const p0 = this.find(key), b = p0 && this.ban(p0);
    if (b) return 'you are banned for ' + b.left + ' more match' + (b.left > 1 ? 'es' : '') + ' (red card rule). You keep your place in the list.';
    const pl = this.place(key), S = this.S();
    if (!pl) return null;
    if (pl.playingNow) return 'you are on the team sheet for match ' + this.D().match + '. Good luck!';
    return 'you are #' + pl.pos + ' of ' + pl.of + (pl.matchesAway === 0 ? ': in the next match' : ': about ' + pl.matchesAway + ' match' + (pl.matchesAway > 1 ? 'es' : '') + ' away (~' + pl.mins + ' min)') + '.';
  }
}
module.exports = { Squad };
