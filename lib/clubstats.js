// Pro Clubs extras: a Man of the Match vote after each result, and a season table per player
// (games, wins, draws, losses, goals, MOTMs, red cards). Fed by the Matchday squad team sheet.
const key = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');

class ClubStats {
  constructor(o) { Object.assign(this, o); this.vote = null; }   // store, cfg, saveCfg, push, say, sheet(), givePoint(key,n), story(text), redCount(name)
  S() { const c = this.cfg().motm || {}; return { on: c.on !== false, secs: Math.max(20, Math.min(180, +c.secs || 60)), points: Math.max(0, Math.min(5, c.points != null ? +c.points : 1)), auto: c.auto !== false }; }
  set(n) { const c = Object.assign({}, this.cfg().motm || {}); for (const k of ['on', 'auto']) if (typeof n[k] === 'boolean') c[k] = n[k]; for (const k of ['secs', 'points']) if (n[k] != null && isFinite(n[k])) c[k] = +n[k]; this.cfg().motm = c; this.saveCfg(); }
  T() {
    const d = this.store.data, y = new Date().getFullYear();
    if (!d.clubSeason || d.clubSeason.year !== y) { if (d.clubSeason) (d.clubSeasons = d.clubSeasons || []).push(d.clubSeason); d.clubSeason = { year: y, players: {} }; }
    return d.clubSeason;
  }
  row(name) { const T = this.T(), k = key(name); if (!k) return null; return T.players[k] || (T.players[k] = { name: String(name).toUpperCase().slice(0, 30), games: 0, w: 0, d: 0, l: 0, goals: 0, motm: 0 }); }
  lineup() { const sh = this.sheet(); return sh ? sh.players.map((p) => ({ name: p.name, key: p.key && p.key !== '__boss' ? p.key : null })) : []; }
  // a result was logged: everyone on the sheet gets the game, then the vote opens
  result(idx, type) {
    if (type === 'custom') return;
    const L = this.lineup(); if (!L.length) return;
    for (const p of L) { const r = this.row(p.name); if (!r) continue; r.games++; if (idx === 0) r.w++; else if (idx === 1 && type !== 'wl') r.d++; else r.l++; }
    this.store.save();
    if (this.S().on && this.S().auto) this.open();
  }
  goal(name, n) { const r = this.row(name); if (!r) return { error: 'No name' }; r.goals = Math.max(0, r.goals + (n || 1)); this.store.save(); return { ok: true, goals: r.goals }; }
  open() {
    const L = this.lineup(); if (L.length < 2) return { error: 'Need a team sheet with at least 2 players' };
    const S = this.S();
    this.vote = { cands: L, votes: {}, endsAt: Date.now() + S.secs * 1000 };
    clearTimeout(this.voteT); this.voteT = setTimeout(() => this.close(), S.secs * 1000);
    this.pushState('open');
    if (this.say) this.say('MAN OF THE MATCH: vote now! Type !motm and the name or number: ' + L.map((p, i) => (i + 1) + ' ' + p.name).join(' · ') + ' (' + S.secs + ' s)');
    return { ok: true };
  }
  cast(voter, text) {
    const V = this.vote; if (!V) return false;
    const t = String(text || '').trim(); if (!t) return false;
    let i = /^\d+$/.test(t) ? +t - 1 : V.cands.findIndex((p) => key(p.name) === key(t));
    if (i < 0) i = V.cands.findIndex((p) => key(p.name).startsWith(key(t)) && key(t).length >= 3);
    if (i < 0 || i >= V.cands.length) return false;
    V.votes[voter] = i; this.pushState('open');
    return true;
  }
  tally() { const V = this.vote, n = V.cands.map(() => 0); for (const i of Object.values(V.votes)) n[i]++; return n; }
  close() {
    const V = this.vote; if (!V) return { error: 'No vote running' };
    clearTimeout(this.voteT); const n = this.tally(), total = n.reduce((a, b) => a + b, 0);
    this.vote = null;
    if (!total) { this.push({ type: 'motm', phase: 'none' }); return { ok: true, winner: null }; }
    const best = Math.max(...n), wi = n.indexOf(best), w = V.cands[wi];
    const r = this.row(w.name); if (r) r.motm++;
    const pts = this.S().points; if (w.key && pts && this.givePoint) this.givePoint(w.key, pts);
    this.store.save();
    this.push({ type: 'motm', phase: 'result', winner: w.name, votes: best, total, pct: Math.round(best / total * 100), points: w.key ? pts : 0, cands: V.cands.map((p, i) => ({ name: p.name, n: n[i] })) });
    if (this.say) this.say('MAN OF THE MATCH: ' + w.name + ' with ' + Math.round(best / total * 100) + '% of the vote!' + (w.key && pts ? ' +' + pts + ' card point' + (pts > 1 ? 's' : '') + '.' : ''));
    if (this.story) this.story(w.name + ' VOTED MAN OF THE MATCH BY THE FANS');
    return { ok: true, winner: w.name };
  }
  pushState(phase) { const V = this.vote; if (!V) return; const n = this.tally(); this.push({ type: 'motm', phase, endsAt: V.endsAt, secs: Math.max(0, Math.round((V.endsAt - Date.now()) / 1000)), cands: V.cands.map((p, i) => ({ name: p.name, n: n[i] })), total: Object.keys(V.votes).length }); }
  table() {
    const T = this.T();
    return Object.values(T.players).map((r) => Object.assign({}, r, { reds: this.redCount ? this.redCount(r.name) : 0 })).sort((a, b) => b.games - a.games || b.motm - a.motm || b.goals - a.goals);
  }
  statsLine(name) {
    const r = this.T().players[key(name)]; if (!r) return null;
    return r.name + ' this season: ' + r.games + ' games (' + r.w + 'W ' + r.d + 'D ' + r.l + 'L), ' + r.goals + ' goals, ' + r.motm + ' MOTM' + (this.redCount ? ', ' + this.redCount(r.name) + ' red cards' : '') + '.';
  }
  state() { return { settings: this.S(), vote: this.vote ? { cands: this.vote.cands.map((p, i) => ({ name: p.name, n: this.tally()[i] })), endsAt: this.vote.endsAt } : null, table: this.table(), year: this.T().year }; }
}
module.exports = { ClubStats };
