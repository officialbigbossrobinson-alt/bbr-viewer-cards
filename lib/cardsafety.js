// v29 card safety: everything that keeps the cards honest while you're live.
//  - FREEZE: card changes are held (not lost). "Apply" adds them, "Throw away" drops them.
//  - CARD GUARD: if a card jumps a lot in a few minutes, cards freeze by themselves and the dock asks you.
//  - UNDO 10 MIN: every card change is journalled for 30 minutes; card points from the last N minutes can be taken back
//    (support from subs / gifts / bits / Kicks / Super Chats is kept).
//  - CARD CHECK: rebuilds every streak from the per-stream history (who was really in which stream), with restarts and
//    reconnects that used up a stream number joined back into one stream.
const DAY = 86400000;
const NUMS = ['xp', 'bonus', 'bank'];
const clone = (x) => (x == null ? null : JSON.parse(JSON.stringify(x)));

class CardSafety {
  // o: store, card(v), cfg(), saveCfg(), TK, feedAdd(text, colour), push(ev), streakRules()
  constructor(o) { Object.assign(this, o); this.journal = []; this.win = new Map(); this.real = null; }
  S() {
    const c = this.cfg().cardSafety || {};
    return { guard: c.guard !== false, guardOvr: Math.max(2, Math.min(30, +c.guardOvr || 5)), guardMins: Math.max(1, Math.min(60, +c.guardMins || 10)) };
  }
  set(n) { const c = Object.assign({}, this.cfg().cardSafety || {}); if (typeof n.guard === 'boolean') c.guard = n.guard; if (+n.guardOvr) c.guardOvr = +n.guardOvr; if (+n.guardMins) c.guardMins = +n.guardMins; this.cfg().cardSafety = c; this.saveCfg(); return this.S(); }
  frozen() { return this.cfg().cardsFrozen || null; }
  snap(v) { return { xp: clone(v.xp), bonus: clone(v.bonus), bank: clone(v.bank), manual: clone(v.manual), tk: clone(v.tk) }; }

  // ---- called by the server's update() around every change to a viewer ----
  before(v) { return this.snap(v); }
  // returns true when the change was held back (the caller then re-reads the card)
  after(v, pre, beforeCard, opts, now) {
    if (v.test || (opts && opts.test)) return false;
    // a locked card (card editor) doesn't change at all
    if (v.cardLock) { for (const g of NUMS) v[g] = pre[g] || {}; v.manual = pre.manual || v.manual; v.tk = pre.tk || v.tk; return true; }
    let fz = this.frozen();
    const afterCard = this.card(v);
    const support = !!(opts && /^(bits|kicks|superchat|sub|resub|gift|giftbomb|giftsub)$/.test(opts.kind || ''));
    // card guard: a big rise in a few minutes (that isn't someone paying for it) freezes the cards
    if (!fz && this.S().guard && afterCard.ovr > beforeCard.ovr && !support) {
      const S = this.S(), w = (this.win.get(v.key) || []).filter((x) => now - x.at < S.guardMins * 60000);
      w.push({ at: now, d: afterCard.ovr - beforeCard.ovr }); this.win.set(v.key, w);
      const rise = w.reduce((a, x) => a + x.d, 0);
      if (rise >= S.guardOvr) {
        fz = { by: 'guard', at: now, who: v.display || v.login, key: v.key, rise, mins: S.guardMins };
        this.cfg().cardsFrozen = fz; this.saveCfg();
        try { this.feedAdd('CARD GUARD: ' + fz.who + ' went up ' + rise + ' OVR in ' + S.guardMins + ' min, card changes are paused (dock › Fix it)', '#ffb020'); } catch (e) { /* ignore */ }
        try { this.push({ type: 'cardguard', frozen: fz }); } catch (e) { /* ignore */ }
      }
    }
    if (fz) {
      // hold the change: remember what it would have added, then put the card back
      const P = v.pending || (v.pending = { xp: {}, bonus: {}, bank: {}, since: now });
      for (const g of NUMS) for (const k of Object.keys(v[g] || {})) { const d = (v[g][k] || 0) - ((pre[g] || {})[k] || 0); if (d) P[g][k] = (P[g][k] || 0) + d; }
      if (JSON.stringify(v.tk) !== JSON.stringify(pre.tk)) P.tk = clone(v.tk);
      for (const g of NUMS) v[g] = pre[g] || {};
      v.manual = pre.manual || v.manual; v.tk = pre.tk || v.tk;
      if (!Object.keys(P.xp).length && !Object.keys(P.bonus).length && !Object.keys(P.bank).length && !P.tk) delete v.pending;
      return true;
    }
    // journal for "undo the last 10 minutes"
    const d = {}; let any = false;
    for (const g of NUMS) for (const k of Object.keys(v[g] || {})) { const x = (v[g][k] || 0) - ((pre[g] || {})[k] || 0); if (x) { (d[g] = d[g] || {})[k] = x; any = true; } }
    const tkChanged = JSON.stringify(v.tk) !== JSON.stringify(pre.tk);
    if (any || tkChanged) {
      this.journal.push({ at: now, key: v.key, d, tk0: tkChanged ? pre.tk : undefined, support });
      const cut = now - 30 * 60000; while (this.journal.length && (this.journal[0].at < cut || this.journal.length > 6000)) this.journal.shift();
    }
    return false;
  }

  // ---- freeze ----
  freeze(on) {
    if (on) { this.cfg().cardsFrozen = { by: 'you', at: Date.now() }; }
    else delete this.cfg().cardsFrozen;
    this.saveCfg();
    return this.state();
  }
  pendingList() { return Object.values(this.store.data.viewers).filter((v) => v.pending).map((v) => ({ key: v.key, name: v.display || v.login })); }
  // apply = add the held changes to the cards; otherwise throw them away. Either way the freeze ends.
  release(apply) {
    let n = 0; const now = Date.now();
    for (const v of Object.values(this.store.data.viewers)) {
      if (!v.pending) continue;
      if (apply) {
        const pre = this.snap(v), bc = this.card(v);
        for (const g of NUMS) { v[g] = v[g] || {}; for (const [k, x] of Object.entries(v.pending[g] || {})) v[g][k] = Math.max(0, (v[g][k] || 0) + x); }
        if (v.pending.tk) v.tk = v.pending.tk;
        void pre; void bc;
      }
      delete v.pending; n++;
    }
    delete this.cfg().cardsFrozen; this.saveCfg();
    this.win.clear(); this.store.save();
    void now;
    return { ok: true, cards: n, applied: !!apply };
  }

  // ---- undo the last N minutes of card points ----
  undoPreview(mins) {
    const cut = Date.now() - mins * 60000, per = new Map();
    for (const e of this.journal) { if (e.at < cut || e.support) continue; per.set(e.key, (per.get(e.key) || 0) + 1); }
    return per;
  }
  undo(mins, apply) {
    mins = Math.max(1, Math.min(30, +mins || 10));
    const cut = Date.now() - mins * 60000, keys = new Map();
    const take = this.journal.filter((e) => e.at >= cut && !e.support);
    const out = [];
    for (const e of take) { const r = keys.get(e.key) || { d: { xp: {}, bonus: {}, bank: {} }, tk0: undefined }; for (const g of NUMS) for (const [k, x] of Object.entries(e.d[g] || {})) r.d[g][k] = (r.d[g][k] || 0) + x; if (e.tk0 !== undefined && r.tk0 === undefined) r.tk0 = e.tk0; keys.set(e.key, r); }
    for (const [key, r] of keys) {
      const v = this.store.data.viewers[key]; if (!v) continue;
      const before = this.card(v).ovr;
      if (apply) {
        for (const g of NUMS) { v[g] = v[g] || {}; for (const [k, x] of Object.entries(r.d[g])) v[g][k] = Math.max(0, (v[g][k] || 0) - x); }
        if (r.tk0 !== undefined && r.tk0 !== null) v.tk = clone(r.tk0);
      }
      out.push({ key, name: v.display || v.login, ovrBefore: before, ovrAfter: apply ? this.card(v).ovr : null });
    }
    if (apply) { this.journal = this.journal.filter((e) => !(e.at >= cut && !e.support)); this.store.save(); }
    return { mins, viewers: out.length, list: out.slice(0, 40), applied: !!apply };
  }

  // ---- real streams: stream records with restarts / reconnects (gaps under an hour) joined into one ----
  realStreams(force) {
    const now = Date.now();
    if (!force && this.real && now - this.real.at < 60000) return this.real;
    const A = this.store.data.streams || {}, recs = Object.values(A).filter((s) => s && s.start).sort((a, b) => a.no - b.no);
    const list = [], ghost = new Set();
    for (const s of recs) {
      const p = list[list.length - 1];
      if (p && s.start - p.end < 3600000 && s.start >= p.start) {
        p.end = Math.max(p.end, s.end || s.start); for (let k = p.nos[p.nos.length - 1] + 1; k <= s.no; k++) { ghost.add(k); p.nos.push(k); }
        for (const k of Object.keys(s.v || {})) p.keys.add(k);
      } else {
        // stream numbers with no record between two records that are really one stream are ghosts too
        list.push({ no: s.no, nos: [s.no], start: s.start, end: s.end || s.start, keys: new Set(Object.keys(s.v || {})) });
      }
    }
    this.real = { at: now, list, ghost, first: recs.length ? recs[0].no : null };
    return this.real;
  }
  // how many real streams were missed between two stream numbers (for the streak)
  // a stream number is a real stream if it's older than the history, or has its own record that isn't a restart of the one
  // before. Numbers inside the history with no record were restarts / drops whose stats were folded into the real stream.
  missed(last, no) {
    const R = this.realStreams(), A = this.store.data.streams || {}; let n = 0;
    for (let k = last + 1; k < no; k++) { if (R.first == null || k < R.first) n++; else if (A[k] && !R.ghost.has(k)) n++; }
    return n;
  }
  // what the streak should be, from the history. null = can't tell (no history, or the history doesn't go back far enough)
  expected(v) {
    const R = this.realStreams(), L = R.list; if (L.length < 3) return null;
    const idx = []; L.forEach((s, i) => { if (s.keys.has(v.key)) idx.push(i); });
    if (!idx.length) return null;
    const SR = (this.streakRules && this.streakRules()) || {};
    // replay their attendance on a blank copy, with the same saver rules
    const t = { streak: 0, savers: 0, bestStreak: 0, lastStreamNo: 0 };
    let unbrokenFromStart = idx[0] === 0;
    for (const i of idx) {
      const no = i + 1, missed = t.lastStreamNo ? no - t.lastStreamNo - 1 : -1;
      if (missed < 0) t.streak = 1;
      else if (missed === 0) t.streak += 1;
      else if (t.savers >= missed) { t.savers -= missed; t.streak += 1; }
      else { t.streak = 1; t.savers = 0; unbrokenFromStart = false; }
      if (SR.saverEvery > 0 && t.streak % SR.saverEvery === 0) t.savers = Math.min(SR.saverMax == null ? 2 : SR.saverMax, t.savers + 1);
      t.bestStreak = Math.max(t.bestStreak, t.streak); t.lastStreamNo = no;
    }
    // their streak may have started before the history does: then the history only gives a lower bound
    return { streak: t.streak, savers: t.savers, best: t.bestStreak, partial: unbrokenFromStart, streams: idx.length, of: L.length, lastReal: L[idx[idx.length - 1]] };
  }
  check() {
    const out = [];
    for (const v of Object.values(this.store.data.viewers)) {
      if (v.test || v.isBroadcaster || !v.tk || !v.tk.streak) continue;
      const e = this.expected(v); if (!e) continue;
      const have = v.tk.streak || 0;
      // in every stream the history holds: their streak may go back further than the history, so it can't be checked
      if (e.partial) continue;
      const want = e.streak;
      if (have > want) out.push({ key: v.key, name: v.display || v.login, streak: have, should: want, best: v.tk.bestStreak || have, ovr: this.card(v).ovr, savers: v.tk.savers || 0, saversShould: e.savers });
    }
    out.sort((a, b) => (b.streak - b.should) - (a.streak - a.should));
    return { list: out, streams: this.realStreams().list.length, ghosts: this.realStreams().ghost.size };
  }
  fixOne(v) {
    const e = this.expected(v); if (!e || !v.tk) return null;
    if (e.partial) return null;
    const have = v.tk.streak || 0, want = e.streak;
    if (have <= want) return null;
    const ovr0 = this.card(v).ovr;
    v.tk.streak = want; v.tk.savers = Math.min(v.tk.savers || 0, e.savers);
    // best ever: if it only got that high through the bug, bring it down too
    if ((v.tk.bestStreak || 0) <= have) v.tk.bestStreak = Math.max(want, e.best);
    // they were last in the real stream that holds their last stream number
    const R = this.realStreams(); if (e.lastReal && v.tk.lastStreamNo && R.ghost.has(v.tk.lastStreamNo)) v.tk.lastStreamNo = e.lastReal.nos[e.lastReal.nos.length - 1];
    return { name: v.display || v.login, from: have, to: want, ovrFrom: ovr0, ovrTo: this.card(v).ovr };
  }
  fix(keys) {
    const want = keys ? new Set(keys) : null, done = [];
    for (const v of Object.values(this.store.data.viewers)) { if (want && !want.has(v.key)) continue; if (v.test || v.isBroadcaster) continue; const r = this.fixOne(v); if (r) done.push(r); }
    this.store.save();
    return { ok: true, fixed: done.length, list: done.slice(0, 60) };
  }

  state() {
    const fz = this.frozen(), P = this.pendingList();
    return { frozen: fz, pending: P.length, pendingNames: P.slice(0, 8).map((x) => x.name), guard: this.S(), undo10: this.undoPreview(10).size };
  }
}
module.exports = { CardSafety };
