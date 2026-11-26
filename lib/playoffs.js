// v43 Elite Playoffs: the playoff run tracker (and the switch that turns the stream black & gold).
// Pro Clubs playoffs give your club a set number of matches; how far you go depends on the wins. So: "Match 4 of 10",
// W / D / L for every match, and (if you set one) a wins target: "need 4 more wins from 6".
// Results come from the same W / D / L buttons as the team results (lib/results.js) while Playoff night is on.
// Settings: cfg.playoffs. The run itself: store.data.playoffs.
const TXT = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);
const CL = (x, a, b, d) => { const n = Math.round(+x); return isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
const RES = ['W', 'D', 'L'];

class Playoffs {
  // o: store, cfg(), saveCfg(), push(ev), say(msg) (to every platform), feed(text, colour)
  constructor(o) { Object.assign(this, o); }
  S() {
    const c = this.cfg().playoffs || {};
    return {
      on: !!c.on, title: TXT(c.title, 30) || 'ELITE PLAYOFFS', matches: CL(c.matches, 1, 40, 10), target: CL(c.target, 0, 40, 0),
      targetLabel: TXT(c.targetLabel, 24).toUpperCase(), show: c.show !== false, theme: c.theme !== false, chat: c.chat !== false,
    };
  }
  set(n) {
    n = n || {}; const c = Object.assign({}, this.cfg().playoffs || {});
    for (const k of ['on', 'show', 'theme', 'chat']) if (typeof n[k] === 'boolean') c[k] = n[k];
    for (const k of ['title', 'targetLabel']) if (typeof n[k] === 'string') c[k] = n[k];
    for (const k of ['matches', 'target']) if (n[k] != null && n[k] !== '' && isFinite(+n[k])) c[k] = +n[k];
    const was = !!(this.cfg().playoffs || {}).on;
    this.cfg().playoffs = c; this.saveCfg();
    if (typeof n.on === 'boolean' && n.on !== was && this.feed) this.feed(n.on ? 'Playoff night ON: Elite Playoffs theme' : 'Playoff night off', '#D9B45A');
    this.sync(); if (this.onChange) this.onChange();
    return this.S();
  }
  D() {
    const d = this.store.data;
    if (!d.playoffs || !Array.isArray(d.playoffs.list)) d.playoffs = { run: 1, list: [], startedAt: Date.now() };
    return d.playoffs;
  }
  // a new playoff run (the old one is kept as "last run")
  newRun() {
    const D = this.D(), prev = { run: D.run, list: D.list.slice(), endedAt: Date.now() };
    this.store.data.playoffs = { run: (D.run || 1) + 1, list: [], startedAt: Date.now(), last: prev.list.length ? prev : D.last || null };
    this.store.save(); this.sync(); return { ok: true, msg: 'New playoff run started' };
  }
  add(idx, score) {
    const S = this.S(), D = this.D();
    if (!(idx >= 0 && idx <= 2)) return { error: 'bad result' };
    if (D.list.length >= S.matches) return { error: 'All ' + S.matches + ' playoff matches are played: start a new run or raise the number of matches' };
    const e = { r: idx, at: Date.now() };
    if (score && isFinite(score.us) && isFinite(score.them)) Object.assign(e, { us: +score.us, them: +score.them, opp: TXT(score.opp, 30) });
    D.list.push(e); this.store.save(); this.sync();
    if (S.chat && this.say) this.say('🏆 ' + this.line());
    return { ok: true };
  }
  undo() { const D = this.D(); if (!D.list.length) return { error: 'No playoff results to undo' }; D.list.pop(); this.store.save(); this.sync(); return { ok: true }; }
  // replace the whole list (for fixing it by hand): ['W', 'L', 'D', ...]
  setList(L) {
    const D = this.D(), S = this.S();
    D.list = (Array.isArray(L) ? L : []).slice(0, S.matches).map((x) => ({ r: typeof x === 'number' ? CL(x, 0, 2, 0) : Math.max(0, RES.indexOf(String(x).toUpperCase()[0])), at: Date.now() }));
    this.store.save(); this.sync(); return { ok: true };
  }
  state() {
    const S = this.S(), D = this.D(), L = D.list, c = [0, 0, 0];
    for (const e of L) c[e.r]++;
    const played = L.length, left = Math.max(0, S.matches - played), W = c[0];
    let status = '', tone = 'run';
    if (S.target) {
      const need = Math.max(0, S.target - W);
      if (!need) { status = (S.targetLabel ? S.targetLabel + ' SECURED' : 'TARGET REACHED') + ' · ' + W + ' WINS'; tone = 'won'; }
      else if (need > left) { status = (S.targetLabel || 'TARGET') + ' OUT OF REACH'; tone = 'out'; }
      else if (need === left) { status = 'WIN ' + (left === 1 ? 'THE LAST GAME' : 'ALL ' + left + ' LEFT') + (S.targetLabel ? ' FOR ' + S.targetLabel : ''); tone = 'must'; }
      else { status = 'NEED ' + need + ' MORE WIN' + (need === 1 ? '' : 'S') + ' FROM ' + left + (S.targetLabel ? ' FOR ' + S.targetLabel : ''); }
    } else status = left ? left + ' GAME' + (left === 1 ? '' : 'S') + ' LEFT' : 'PLAYOFFS COMPLETE';
    if (!left && tone === 'run') tone = 'done';
    return {
      type: 'playoffs', on: S.on, show: S.on && S.show, title: S.title, matches: S.matches, target: S.target, targetLabel: S.targetLabel,
      run: D.run, list: L.map((e) => ({ r: RES[e.r], us: e.us, them: e.them, opp: e.opp })), counts: c, played, left, next: Math.min(S.matches, played + 1),
      status, tone, last: D.last ? { list: D.last.list.map((e) => RES[e.r]) } : null,
    };
  }
  line() {
    const s = this.state(), c = s.counts;
    return s.title.charAt(0) + s.title.slice(1).toLowerCase() + ': ' + (s.left ? 'match ' + s.next + ' of ' + s.matches : 'all ' + s.matches + ' played') + ' · ' + c[0] + 'W ' + c[1] + 'D ' + c[2] + 'L' +
      (s.list.length ? ' (' + s.list.map((e) => e.r).join(' ') + ')' : '') + ' · ' + s.status.toLowerCase() + (s.target ? ' (target ' + s.target + ' wins)' : '');
  }
  sync() { this.push(this.state()); }
}
module.exports = { Playoffs };
