// Fun counters: track one player's habit on stream (GODFATHER giving away penalties).
// Each counter has a name, what it counts, levels for the meter, tonight + season totals, and a log for undo.
const DEF = [{ id: 'godfather', name: 'GODFATHER', what: 'PENALTIES GIVEN AWAY', short: 'PENS', color: '#ff3b3b', cmd: '!pens', ticker: true, popup: true,
  levels: [[0, 'CLEAN SHEET'], [1, 'CARELESS'], [2, 'LIABILITY'], [3, 'PENALTY MERCHANT'], [5, 'PUBLIC ENEMY No.1'], [8, 'SACK HIM']] }];
const LINES = ['{n} HAS DONE IT AGAIN', 'ANOTHER ONE FROM {n}', '{n}: WHAT WAS THAT?!', 'THE REF HAD NO CHOICE', '{n} STRIKES AGAIN', 'GET HIM OFF!'];
class Counters {
  constructor(o) { Object.assign(this, o); }   // store, cfg, saveCfg, push, streamNo
  list() { const c = this.cfg().counters; return Array.isArray(c) && c.length ? c : DEF; }
  get(id) { return this.list().find((x) => x.id === id) || this.list()[0]; }
  data(id) {
    const d = this.store.data; if (!d.counters) d.counters = {};
    const r = d.counters[id] || (d.counters[id] = { season: 0, stream: { no: 0, n: 0 }, log: [], best: 0 });
    const no = this.streamNo(); if (no && r.stream.no !== no) r.stream = { no, n: 0 };
    return r;
  }
  level(c, n, lock) { let L = c.levels[0]; for (const l of c.levels) if (n >= l[0]) L = l; if (lock != null && c.levels[lock]) L = c.levels[lock]; return { name: L[1], i: c.levels.indexOf(L), of: c.levels.length }; }
  state(id) {
    const c = this.get(id), r = this.data(c.id), lv = this.level(c, r.stream.n, r.stream.lock);
    const nextL = c.levels.find((l) => l[0] > r.stream.n);
    return { id: c.id, name: c.name, what: c.what, short: c.short, color: c.color, show: c.show !== false, tonight: r.stream.n, season: r.season, best: r.best || 0, lock: r.stream.lock != null ? r.stream.lock : null, levels: c.levels, lines: c.lines || null, level: lv.name, li: lv.i, lof: lv.of, next: nextL ? { at: nextL[0], name: nextL[1] } : null };
  }
  all() { return { type: 'counters', list: this.list().map((c) => this.state(c.id)) }; }
  sync() { this.push(this.all()); }
  add(id, d) {
    const c = this.get(id), r = this.data(c.id), before = this.level(c, r.stream.n, r.stream.lock);
    d = Math.round(+d) || 1;
    if (d < 0 && r.stream.n <= 0 && r.season <= 0) return { error: 'Already at 0' };
    r.stream.n = Math.max(0, r.stream.n + d); r.season = Math.max(0, r.season + d); r.best = Math.max(r.best || 0, r.stream.n);
    r.log.push({ d, at: Date.now() }); if (r.log.length > 300) r.log.shift();
    this.store.save(); this.sync();
    const st = this.state(c.id);
    if (d > 0 && c.popup !== false && c.show !== false) {
      const lv = this.level(c, r.stream.n, r.stream.lock), L = c.lines && c.lines.length ? c.lines : LINES;
      this.push({ type: 'counterHit', counter: st, line: L[Math.floor(Math.random() * L.length)].replace(/\{n\}/g, c.name), levelUp: lv.i > before.i ? lv.name : null });
    }
    return Object.assign({ ok: true }, st);
  }
  undo(id) { const c = this.get(id), r = this.data(c.id), e = r.log.pop(); if (!e) return { error: 'Nothing to undo' }; r.stream.n = Math.max(0, r.stream.n - e.d); r.season = Math.max(0, r.season - e.d); this.store.save(); this.sync(); return Object.assign({ ok: true }, this.state(c.id)); }
  // every number on the meter can be set by hand: tonight, season, worst night, and the level (auto = from tonight's count)
  setCounts(id, tonight, season, best, lock) { const c = this.get(id), r = this.data(c.id); if (tonight != null && tonight !== '') r.stream.n = Math.max(0, Math.round(+tonight) || 0); if (season != null && season !== '') r.season = Math.max(0, Math.round(+season) || 0); if (best != null && best !== '') r.best = Math.max(0, Math.round(+best) || 0);
    if (lock !== undefined) { if (lock === null || lock === '' || lock === 'auto') delete r.stream.lock; else r.stream.lock = Math.max(0, Math.min(c.levels.length - 1, Math.round(+lock) || 0)); }
    this.store.save(); this.sync(); return Object.assign({ ok: true }, this.state(c.id)); }
  save(list) {
    const out = (Array.isArray(list) ? list : []).slice(0, 4).map((c, i) => ({
      id: String(c.id || ('c' + Date.now().toString(36) + i)).replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || 'c' + i,
      name: String(c.name || 'PLAYER').toUpperCase().slice(0, 20), what: String(c.what || 'MISTAKES').toUpperCase().slice(0, 30), short: String(c.short || 'TOTAL').toUpperCase().slice(0, 8),
      color: /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#ff3b3b', lines: (Array.isArray(c.lines) ? c.lines : []).map((l) => String(l || '').trim().toUpperCase().slice(0, 60)).filter(Boolean).slice(0, 20), cmd: /^![a-z0-9]{2,20}$/i.test(c.cmd || '') ? c.cmd.toLowerCase() : '', ticker: c.ticker !== false, popup: c.popup !== false, show: c.show !== false,
      levels: (Array.isArray(c.levels) && c.levels.length ? c.levels : DEF[0].levels).map((l) => [Math.max(0, Math.round(+l[0]) || 0), String(l[1] || '').toUpperCase().slice(0, 24)]).filter((l) => l[1]).sort((a, b) => a[0] - b[0]).slice(0, 8)
    }));
    if (out.length && out[0].levels[0][0] !== 0) out.forEach((c) => { if (c.levels[0][0] !== 0) c.levels.unshift([0, 'CLEAN SHEET']); });
    this.cfg().counters = out; this.saveCfg(); this.sync();
  }
  chatLine(id) { const s = this.state(id); return s.name + ': ' + s.tonight + ' ' + s.what.toLowerCase() + ' tonight (' + s.level + '), ' + s.season + ' this season.'; }
}
module.exports = { Counters, DEF };
