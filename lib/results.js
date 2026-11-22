// Team results: your team name and record (W / D / L, or your own counters for other games), typed in by you.
// Shows on stream, pops a full-time card, goes into the ticker and the credits. Tonight-only or the whole season.
const DEF_TEAMS = [
  { id: 'fc', name: 'Bosshausens', short: 'BH', color: '#c8102e', type: 'wdl', game: 'fc|fifa|football|ea sports', labels: ['Win', 'Draw', 'Loss'] },
  { id: 'arc', name: 'Arc Raiders', short: 'AR', color: '#c58bff', type: 'custom', game: 'arc raiders', labels: ['Extracted', 'Downed'] },
  { id: 'truck', name: 'Haulage', short: 'BBR', color: '#ff9a1f', type: 'custom', game: 'truck|ats|ets', labels: ['Deliveries', 'Crashes'] }
];
class Results {
  constructor(o) { Object.assign(this, o); }   // store, cfg, saveCfg, push, streamNo, currentGame, say
  S() {
    const c = this.cfg().results || {};
    return { show: c.show !== false, card: c.card !== false, scope: c.scope === 'season' ? 'season' : 'stream', auto: c.auto !== false, teams: Array.isArray(c.teams) && c.teams.length ? c.teams : DEF_TEAMS, active: c.active || null };
  }
  set(n) {
    const cur = this.S(), c = Object.assign({}, this.cfg().results || {});
    for (const k of ['show', 'card', 'auto']) if (typeof n[k] === 'boolean') c[k] = n[k];
    if (n.scope) c.scope = n.scope === 'season' ? 'season' : 'stream';
    if (Array.isArray(n.teams)) c.teams = n.teams.slice(0, 12).map((t, i) => ({ id: String(t.id || 't' + i + Date.now().toString(36)).slice(0, 30), name: String(t.name || 'Team').slice(0, 30), short: String(t.short || t.name || 'T').slice(0, 4).toUpperCase(), color: /^#[0-9a-f]{6}$/i.test(t.color || '') ? t.color : '#4dc3ff',
      type: ['wdl', 'wl', 'custom'].includes(t.type) ? t.type : 'wdl', game: String(t.game || '').slice(0, 80), labels: (Array.isArray(t.labels) ? t.labels : []).map((x) => String(x).slice(0, 16)).slice(0, 3) }));
    if (n.active !== undefined) c.active = n.active;
    if (!c.teams) c.teams = cur.teams;
    this.cfg().results = c; this.saveCfg(); this.sync();
  }
  team() {
    const S = this.S(), g = String(this.currentGame() || '');
    if (S.auto) { const t = S.teams.find((x) => x.game && new RegExp(x.game, 'i').test(g)); if (t) return t; }
    return S.teams.find((x) => x.id === S.active) || S.teams[0];
  }
  data(t) {
    const d = this.store.data; if (!d.results) d.results = {};
    const r = d.results[t.id] || (d.results[t.id] = { season: { c: [0, 0, 0], form: [] }, stream: { no: 0, c: [0, 0, 0], form: [] }, last: null, log: [] });
    const no = this.streamNo();
    if (no && r.stream.no !== no) r.stream = { no, c: [0, 0, 0], form: [] };
    return r;
  }
  labels(t) { return t.type === 'wdl' ? ['W', 'D', 'L'] : t.type === 'wl' ? ['W', 'L'] : (t.labels.length ? t.labels : ['Yes', 'No']); }
  state() {
    const S = this.S(), t = this.team(), r = this.data(t), b = S.scope === 'season' ? r.season : r.stream;
    const run = (() => { if (t.type === 'custom') return 0; let n = 0; for (let i = b.form.length - 1; i >= 0; i--) { if (b.form[i] === 2) break; n++; } return n; })();
    return { type: 'results', show: S.show, team: t, labels: this.labels(t), counts: b.c, form: b.form.slice(-6), last: r.last, scope: S.scope, unbeaten: run >= 3 ? run : 0 };
  }
  sync() { this.push(this.state()); }
  // idx: 0 = win / first counter, 1 = draw / second, 2 = loss. Or a score: us, them
  add(idx, score) {
    const S = this.S(), t = this.team(), r = this.data(t);
    if (score && isFinite(score.us) && isFinite(score.them) && t.type !== 'custom') idx = score.us > score.them ? 0 : score.us === score.them ? (t.type === 'wl' ? 2 : 1) : 2;
    if (t.type === 'wl' && idx === 1) idx = 2;
    const L = this.labels(t), max = t.type === 'custom' ? L.length : 3;
    if (!(idx >= 0 && idx < max)) return { error: 'bad result' };
    for (const b of [r.season, r.stream]) { b.c[idx] = (b.c[idx] || 0) + 1; b.form.push(idx); if (b.form.length > 30) b.form.shift(); }
    r.last = score && isFinite(score.us) ? { us: +score.us, them: +score.them, opp: String(score.opp || '').slice(0, 30), idx, at: Date.now() } : { idx, at: Date.now() };
    r.log.push({ idx, score: score || null, at: Date.now() }); if (r.log.length > 200) r.log.shift();
    this.store.save(); this.sync();
    if (S.card && S.show) this.push({ type: 'fulltime', team: t, idx, label: t.type === 'custom' ? L[idx] : ['WIN', 'DRAW', 'LOSS'][idx], last: r.last, state: this.state() });
    return { ok: true, idx };
  }
  undo() {
    const t = this.team(), r = this.data(t), e = r.log.pop(); if (!e) return { error: 'Nothing to undo' };
    for (const b of [r.season, r.stream]) { b.c[e.idx] = Math.max(0, (b.c[e.idx] || 0) - 1); const i = b.form.lastIndexOf(e.idx); if (i >= 0) b.form.splice(i, 1); }
    const prev = r.log[r.log.length - 1]; r.last = prev ? Object.assign({ idx: prev.idx, at: prev.at }, prev.score ? { us: +prev.score.us, them: +prev.score.them, opp: prev.score.opp || '' } : {}) : null;
    this.store.save(); this.sync(); return { ok: true };
  }
  edit(counts, scope) { const t = this.team(), r = this.data(t), b = scope === 'season' ? r.season : r.stream; b.c = (counts || []).slice(0, 3).map((n) => Math.max(0, Math.round(+n) || 0)); this.store.save(); this.sync(); return { ok: true }; }
  newSession() { const t = this.team(), r = this.data(t); r.stream = { no: this.streamNo(), c: [0, 0, 0], form: [] }; this.store.save(); this.sync(); return { ok: true }; }
  line() {
    const st = this.state(), t = st.team, c = st.counts;
    if (t.type === 'custom') return t.name + ': ' + st.labels.map((l, i) => (c[i] || 0) + ' ' + l.toLowerCase()).join(', ') + (st.scope === 'stream' ? ' tonight' : ' this season');
    return t.name + ' ' + (st.scope === 'stream' ? 'tonight' : 'this season') + ': ' + (c[0] || 0) + ' W' + (t.type === 'wdl' ? ', ' + (c[1] || 0) + ' D' : '') + ', ' + (c[2] || 0) + ' L' + (st.last && st.last.us != null ? '. Last: ' + st.last.us + '-' + st.last.them + (st.last.opp ? ' v ' + st.last.opp : '') : '');
  }
  // every team's tonight record for the credits
  tonight() {
    const out = [];
    for (const t of this.S().teams) { const r = (this.store.data.results || {})[t.id]; if (!r || r.stream.no !== this.streamNo() || !r.stream.c.some((n) => n > 0)) continue; out.push({ team: t, counts: r.stream.c, labels: this.labels(t) }); }
    return out;
  }
}
module.exports = { Results };
