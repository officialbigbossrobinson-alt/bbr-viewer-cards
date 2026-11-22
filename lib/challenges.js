// Challenge tracker: things viewers pay for that last a while ("wear an eyepatch for 5 games").
// Started by a custom Power-up or channel point reward (matched by name), or from the dashboard.
// The first challenge in the list is the one running; the rest wait their turn.
const DEFAULT_RULES = [
  { match: 'eyepatch', name: 'Eyepatch', count: 5, unit: 'games' }
];
const UNITS = ['games', 'deliveries', 'raids', 'matches', 'minutes'];

class Challenges {
  constructor(o) {
    this.store = o.store; this.cfg = o.cfg; this.push = o.push; this.say = o.say; this.saveCfg = o.saveCfg;
    setInterval(() => this.tickTimers(), 5000).unref();
  }
  data() { const d = this.store.data; if (!d.challenges) d.challenges = { list: [], done: [] }; return d.challenges; }
  settings() { const c = this.cfg().challenges || {}; return { show: c.show !== false, rules: Array.isArray(c.rules) ? c.rules : DEFAULT_RULES }; }
  setSettings(n) {
    const cur = this.settings();
    const rules = Array.isArray(n.rules) ? n.rules.map((r) => ({ match: String(r.match || '').trim().slice(0, 60), name: String(r.name || r.match || '').trim().slice(0, 40), count: Math.max(1, Math.min(99, Math.round(+r.count || 1))), unit: UNITS.includes(r.unit) ? r.unit : 'games' })).filter((r) => r.match && r.name) : (this.cfg().challenges || {}).rules;   // don't switch the old rules on by accident
    this.cfg().challenges = { show: typeof n.show === 'boolean' ? n.show : cur.show, rules };
    this.saveCfg(); this.sync();
  }
  state() {
    const d = this.data(), now = Date.now();
    return { show: this.settings().show, list: d.list.map((c, i) => Object.assign({}, c, { active: i === 0, leftSecs: c.unit === 'minutes' && c.endsAt ? Math.max(0, Math.round((c.endsAt - now) / 1000)) : null })), done: d.done.slice(-10).reverse() };
  }
  sync() { this.push(Object.assign({ type: 'challenges' }, this.state())); }
  save() { this.store.save(); }

  // someone bought something: does it match a challenge rule?
  // older settings: a rule whose words are in the reward's name (now shown on the Rewards page)
  ruleFor(title) {
    const t = String(title || '').toLowerCase();
    if (!Array.isArray((this.cfg().challenges || {}).rules)) return null;
    return this.settings().rules.find((x) => t.includes(String(x.match).toLowerCase())) || null;
  }
  add({ name, count, unit, by, platform, source, color, hidden, again, anon }) {
    const d = this.data();
    count = Math.max(1, Math.min(99, Math.round(+count || 1))); unit = UNITS.includes(unit) ? unit : 'games';
    let c = again === 'new' ? null : d.list.find((x) => x.name.toLowerCase() === String(name).toLowerCase() && x.unit === unit);
    if (c) {
      // bought again: more games on the same challenge
      c.total += count; c.left += count; if (c.unit === 'minutes' && c.endsAt) c.endsAt += count * 60000;
      if (by && !anon && !c.by.includes(by)) c.by.push(by);
    } else {
      c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: String(name).slice(0, 40), total: count, left: count, unit, by: by && !anon ? [by] : [], platform: platform || null, source: source || '', at: Date.now(), color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#ffb020', hidden: !!hidden };
      d.list.push(c);
      if (d.list.length === 1) this.begin(c);
    }
    this.save();
    if (!c.hidden) this.push({ type: 'challenge', kind: 'accepted', ch: c, by: anon ? null : by || null, queued: d.list.indexOf(c) > 0 });
    if (by) this.say((by ? by + ' set a challenge: ' : 'New challenge: ') + c.name + ' for ' + count + ' ' + unitWord(unit, count) + (d.list.indexOf(c) > 0 ? ' (queued, ' + d.list.indexOf(c) + ' ahead)' : '') + '!');
    this.sync();
    return c;
  }
  begin(c) { if (c.unit === 'minutes') c.endsAt = Date.now() + c.left * 60000; c.startedAt = Date.now(); }
  // one game / delivery finished
  step(delta) {
    const d = this.data(), c = d.list[0];
    if (!c) return null;
    if (c.unit === 'minutes') { if (delta < 0 && c.endsAt) c.endsAt += 60000; else if (c.endsAt) c.endsAt -= 60000; c.left = Math.max(0, Math.ceil((c.endsAt - Date.now()) / 60000)); }
    else c.left = Math.max(0, Math.min(c.total, c.left - (delta || 1)));
    if (c.left <= 0 && (delta || 1) > 0) return this.complete();
    this.save();
    this.push({ type: 'challenge', kind: c.left === 1 ? 'final' : 'step', ch: c });
    this.sync();
    return c;
  }
  complete() {
    const d = this.data(), c = d.list.shift();
    if (!c) return null;
    c.doneAt = Date.now(); c.left = 0;
    d.done.push(c); if (d.done.length > 50) d.done.shift();
    if (d.list[0]) this.begin(d.list[0]);
    this.save();
    this.push({ type: 'challenge', kind: 'complete', ch: c, next: d.list[0] || null });
    this.say('CHALLENGE COMPLETE: ' + c.name + (c.by.length ? ' (thanks ' + c.by.join(', ') + ')' : '') + '!' + (d.list[0] ? ' Next up: ' + d.list[0].name + '.' : ''));
    this.sync();
    return c;
  }
  start(id) { const d = this.data(), i = d.list.findIndex((x) => x.id === id); if (i > 0) { const [c] = d.list.splice(i, 1); d.list.unshift(c); this.begin(c); this.save(); this.push({ type: 'challenge', kind: 'step', ch: c }); this.sync(); } }
  // the Boss fixes what's on screen: name, who it's from, games left / current game / total, pause
  edit(id, o) {
    const d = this.data(), c = d.list.find((x) => x.id === id) || (id ? null : d.list[0]); if (!c) return null;
    if (typeof o.name === 'string' && o.name.trim()) c.name = o.name.trim().slice(0, 40);
    if (o.by != null) c.by = (Array.isArray(o.by) ? o.by : String(o.by).split(/\s*[+,]\s*/)).map((x) => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 6);
    if (o.total != null && isFinite(o.total)) { const t = Math.max(1, Math.min(99, Math.round(+o.total))); c.left = Math.max(0, Math.min(t, c.left + (t - c.total))); c.total = t; }
    if (o.current != null && isFinite(o.current)) c.left = Math.max(1, Math.min(c.total, c.total - Math.round(+o.current) + 1));
    if (o.left != null && isFinite(o.left)) { c.left = Math.max(0, Math.min(99, Math.round(+o.left))); if (c.left > c.total) c.total = c.left; }
    if (c.unit === 'minutes' && (o.left != null || o.total != null) && d.list[0] === c) c.endsAt = Date.now() + c.left * 60000;
    if (typeof o.paused === 'boolean') { c.paused = o.paused; if (c.unit === 'minutes' && d.list[0] === c) { if (o.paused) { c.left = Math.max(1, Math.ceil((c.endsAt - Date.now()) / 60000)); c.endsAt = null; } else c.endsAt = Date.now() + c.left * 60000; } }
    if (c.left <= 0 && d.list[0] === c) return this.complete();
    this.save(); this.sync();
    return c;
  }
  remove(id) { const d = this.data(), i = d.list.findIndex((x) => x.id === id); if (i >= 0) { d.list.splice(i, 1); if (i === 0 && d.list[0]) this.begin(d.list[0]); this.save(); this.sync(); } }
  tickTimers() {
    const c = this.data().list[0];
    if (c && c.unit === 'minutes' && c.endsAt && !c.paused && Date.now() >= c.endsAt) this.complete();
  }
  chatLine() {
    const l = this.data().list;
    if (!l.length) return 'No challenges running right now.';
    return 'Challenges: ' + l.map((c, i) => (i === 0 ? 'NOW ' : '') + c.name + ' (' + (c.unit === 'minutes' && c.endsAt ? Math.max(0, Math.ceil((c.endsAt - Date.now()) / 60000)) + ' min' : c.left + ' of ' + c.total + ' ' + unitWord(c.unit, c.total)) + ' left' + (c.by.length ? ', from ' + c.by.join(' + ') : '') + ')').join(' · ');
  }
}
function unitWord(u, n) { const s = { games: 'game', deliveries: 'delivery', raids: 'raid', matches: 'match', minutes: 'minute' }[u] || 'game'; return n === 1 ? s : u; }

module.exports = { Challenges, UNITS };
