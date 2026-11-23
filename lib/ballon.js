// v38 Ballon d'Or: chat votes for the player of the season.
// The chat vote is the FAN VOTE: one vote per person per stream (they can change it during that stream), counted until
// the closing date. Your own vote: don't vote / one vote like a fan / a Manager's vote (your 1st, 2nd, 3rd, worth a share
// of the result you choose). If your Manager's vote changes the winner, the ceremony also shows the Fans' favourite.
// Results stay hidden on stream (only the vote count) until you show them: Show all votes, or the ceremony reveal.
const fs = require('fs');

const DEF_S = { opensAt: null, closesAt: null, who: 'everyone', botCheck: true, ack: false, platforms: { twitch: true, kick: true, youtube: true } };
const MGR_SHARE = [60, 30, 10];   // your 1st / 2nd / 3rd as a share of the Manager's vote

class Ballon {
  // o: file, push(msg), say(platform, msg), streamNo(), viewer(platform, login) -> { key, display, streams, followed } | null, botcheck, feed(msg)
  constructor(o) {
    Object.assign(this, o);
    this.st = { title: "Ballon d'Or", noms: [], S: Object.assign({}, DEF_S), status: 'setup', openedAt: null, closedAt: null, votes: {}, boss: { mode: 'fan', rank: [], weight: 25, keys: [] }, show: { screen: 'off', stage: 0 }, nextId: 1 };
    try { const d = JSON.parse(fs.readFileSync(this.file, 'utf8')); Object.assign(this.st, d); this.st.S = Object.assign({}, DEF_S, d.S || {}); this.st.boss = Object.assign({ mode: 'fan', rank: [], weight: 25, keys: [] }, d.boss || {}); } catch (e) { /* first time */ }
    this.saveT = null; this.toastAt = 0; this.ackAt = {};
  }
  save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.saveNow(), 250); }
  saveNow() { clearTimeout(this.saveT); try { const t = this.file + '.tmp'; fs.writeFileSync(t, JSON.stringify(this.st)); fs.renameSync(t, this.file); } catch (e) { console.error('[ballon] save', e.message); } }
  changed() { this.save(); if (this.push) this.push(Object.assign({ type: 'ballon' }, this.screen())); }

  // ---------- nominees ----------
  nom(id) { return this.st.noms.find((n) => n.id === id) || null; }
  num(id) { return this.st.noms.findIndex((n) => n.id === id) + 1; }
  add(n) {
    const name = String((n && n.name) || '').trim().slice(0, 40); if (!name) return { error: 'Type a name' };
    if (this.st.noms.length >= 30) return { error: '30 nominees at most' };
    if (this.st.noms.some((x) => x.name.toLowerCase() === name.toLowerCase())) return { error: name + ' is already in the list' };
    const x = { id: 'n' + (this.st.nextId++), name, pos: String(n.pos || '').trim().slice(0, 8).toUpperCase(), club: String(n.club || '').trim().slice(0, 40) };
    this.st.noms.push(x); this.changed(); return { ok: true, nom: x, msg: 'Added ' + name + ' as #' + this.st.noms.length };
  }
  edit(id, p) {
    const x = this.nom(id); if (!x) return { error: 'Not found' };
    if (p.name != null) { const nm = String(p.name).trim().slice(0, 40); if (!nm) return { error: 'Type a name' }; x.name = nm; }
    if (p.pos != null) x.pos = String(p.pos).trim().slice(0, 8).toUpperCase();
    if (p.club != null) x.club = String(p.club).trim().slice(0, 40);
    this.changed(); return { ok: true };
  }
  // removing a nominee while voting is open throws away the votes for them (the dashboard asks first)
  remove(id) {
    const x = this.nom(id); if (!x) return { error: 'Not found' };
    let lost = 0; for (const no of Object.keys(this.st.votes)) for (const [k, v] of Object.entries(this.st.votes[no])) if (v.n === id) { delete this.st.votes[no][k]; lost++; }
    this.st.noms = this.st.noms.filter((n) => n.id !== id); this.st.boss.rank = this.st.boss.rank.filter((r) => r !== id);
    this.changed(); return { ok: true, msg: 'Removed ' + x.name + (lost ? ' (' + lost + ' votes for them removed)' : ''), lost };
  }
  move(id, dir) {
    if (this.st.status === 'open') return { error: 'Numbers can\'t change while voting is open (chat is typing them)' };
    const i = this.st.noms.findIndex((n) => n.id === id), j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= this.st.noms.length) return { ok: true };
    const L = this.st.noms; [L[i], L[j]] = [L[j], L[i]]; this.changed(); return { ok: true };
  }
  settings(p) {
    const S = this.st.S;
    for (const k of ['opensAt', 'closesAt']) if (p[k] !== undefined) { const t = p[k] ? Date.parse(p[k]) || Number(p[k]) || null : null; S[k] = t; }
    if (['everyone', 'followers', 'regulars'].includes(p.who)) S.who = p.who;
    if (p.botCheck != null) S.botCheck = !!p.botCheck;
    if (p.ack != null) S.ack = !!p.ack;
    if (p.platforms) for (const k of ['twitch', 'kick', 'youtube']) if (p.platforms[k] != null) S.platforms[k] = !!p.platforms[k];
    if (p.title != null) this.st.title = String(p.title).trim().slice(0, 40) || "Ballon d'Or";
    if (S.opensAt && S.closesAt && S.closesAt <= S.opensAt) return { error: 'The closing time has to be after the opening time' };
    this.changed(); return { ok: true };
  }

  // ---------- open / close ----------
  open(by) {
    if (this.st.noms.length < 2) return { error: 'Add at least 2 nominees first' };
    if (this.st.S.closesAt && this.st.S.closesAt <= Date.now()) return { error: 'The closing time has already passed: set a new one' };
    this.st.status = 'open'; this.st.openedAt = this.st.openedAt || Date.now(); this.st.closedAt = null;
    if (this.feed) this.feed("Ballon d'Or: voting open" + (by ? ' (' + by + ')' : ''), '#e8c468');
    this.changed(); return { ok: true, msg: 'Voting is open: chat types !vote 1–' + this.st.noms.length };
  }
  close(by) {
    if (this.st.status !== 'open') return { error: 'Voting isn\'t open' };
    this.st.status = 'closed'; this.st.closedAt = Date.now();
    if (this.feed) this.feed("Ballon d'Or: voting closed (" + (by || 'you') + ')', '#e8c468');
    this.changed(); return { ok: true, msg: 'Voting closed. Results are still hidden: the ceremony is ready' };
  }
  reset() { this.st.votes = {}; this.st.status = 'setup'; this.st.openedAt = null; this.st.closedAt = null; this.st.show = { screen: 'off', stage: 0 }; this.st.boss.rank = []; this.changed(); return { ok: true, msg: 'All votes cleared (the nominees stay)' }; }
  // every 10 s: opens / closes by itself at the times you set
  tick(now) {
    now = now || Date.now(); const S = this.st.S;
    if (this.st.status === 'setup' && S.opensAt && now >= S.opensAt && (!S.closesAt || now < S.closesAt) && this.st.noms.length >= 2) return this.open('opened by itself at the time you set');
    if (this.st.status === 'open' && S.closesAt && now >= S.closesAt) { const r = this.close('closed by itself at the time you set'); if (this.sayAll) this.sayAll("Ballon d'Or voting is closed! Thanks for voting. The winner is revealed at the ceremony."); return r; }
    return null;
  }

  // ---------- votes ----------
  isBoss(key) { return this.st.boss.keys.includes(key); }
  findNom(arg) {
    const a = String(arg || '').trim().toLowerCase().replace(/^#/, ''); if (!a) return null;
    if (/^\d+$/.test(a)) return this.st.noms[Number(a) - 1] || null;
    const exact = this.st.noms.filter((n) => n.name.toLowerCase() === a); if (exact.length === 1) return exact[0];
    const part = this.st.noms.filter((n) => n.name.toLowerCase().includes(a)); return part.length === 1 ? part[0] : null;
  }
  // chat: !vote 4 (or a name), !nominees, !myvote. Returns true when the message was for the vote.
  chat(platform, e, info) {
    const t = String(e.text || '').trim(); let word = t.split(/\s+/)[0].toLowerCase();
    // !ballon always works; !vote too, except while a Man of the Match vote is open (then !vote is for that)
    if (word === '!vote' && info && info.motmOpen) return false;
    if (word === '!ballon' || word === '!bdo') word = '!vote';
    if (!['!vote', '!nominees', '!myvote'].includes(word)) return false;
    const S = this.st.S, d = e.display || e.login;
    if (word === '!nominees') {
      if (!this.st.noms.length) return true;
      const L = this.st.noms.map((n, i) => (i + 1) + ' ' + n.name).join(' · ');
      this.reply(platform, (this.st.title + ': ' + L).slice(0, 420) + (this.st.status === 'open' ? ' · type !vote 1–' + this.st.noms.length : ''), true);
      return true;
    }
    if (this.st.status !== 'open' || !S.platforms[platform]) return true;
    const v = this.viewer(platform, e.login); if (!v) return true;
    const key = v.key;
    if (info && info.broadcaster && !this.isBoss(key)) { this.st.boss.keys.push(key); }
    const no = String(this.streamNo());
    if (word === '!myvote') {
      const mine = this.st.votes[no] && this.st.votes[no][key];
      this.reply(platform, '@' + d + ' ' + (mine ? 'your vote this stream: #' + this.num(mine.n) + ' ' + (this.nom(mine.n) || {}).name + (mine.held ? ' (waiting for a mod to check it)' : '') : 'you haven\'t voted this stream yet: type !vote 1–' + this.st.noms.length), true);
      return true;
    }
    // you (the streamer): "Don't vote" ignores your chat votes; with a Manager's vote you vote in the dashboard instead
    if (this.isBoss(key) && this.st.boss.mode !== 'fan') return true;
    if (S.who === 'followers' && info && info.follower === false) { this.reply(platform, '@' + d + ' only followers can vote in the ' + this.st.title); return true; }
    if (S.who === 'regulars' && (v.streams || 0) < 2) { this.reply(platform, '@' + d + ' the ' + this.st.title + ' vote is for regulars (2+ streams)'); return true; }
    const n = this.findNom(t.split(/\s+/).slice(1).join(' ')); if (!n) { this.reply(platform, '@' + d + ' type !vote and a number from 1 to ' + this.st.noms.length + ' (!nominees for the list)'); return true; }
    this.st.votes[no] = this.st.votes[no] || {};
    // you: one vote per stream, whether you vote in chat or in the dashboard (the last one counts)
    if (this.isBoss(key)) for (const k of this.st.boss.keys) if (k !== key) delete this.st.votes[no][k];
    const prev = this.st.votes[no][key];
    if (prev && prev.n === n.id) return true;
    // bot check: in "Hold high scores" a high score waits for you; in "Review only" it counts but is listed for you to look at
    let held = false, flag = false, reasons = null;
    if (S.botCheck && this.botcheck && this.botcheck.S().mode !== 'off' && !this.isBoss(key)) {
      this.botcheck.want(platform, e.login);
      const r = this.botcheck.score({ key: platform + ':' + String(e.login).toLowerCase(), login: String(e.login).toLowerCase(), display: d, platform, at: Date.now(), byHand: false }, [], null);
      if (r.level === 'hold' || r.level === 'review') { flag = true; reasons = r.reasons.filter((x) => x.pts > 0).map((x) => x.text); held = r.level === 'hold' && this.botcheck.S().mode === 'hold'; }
    }
    this.st.votes[no][key] = { n: n.id, at: Date.now(), pf: platform, d, held, flag, reasons, login: String(e.login).toLowerCase() };
    if (S.ack) this.reply(platform, '@' + d + ' ' + (prev ? 'changed to' : 'your vote for') + ' #' + this.num(n.id) + ' ' + n.name + (held ? ' is waiting for a mod to check it' : ' is in'));
    if (this.push && !held && this.st.show.screen === 'corner' && Date.now() - this.toastAt > 1200) { this.toastAt = Date.now(); this.push({ type: 'ballon', action: 'toast', d, num: this.num(n.id), changed: !!prev }); }
    this.save();
    if (this.push && Date.now() - (this.lastCount || 0) > 2000) { this.lastCount = Date.now(); this.push(Object.assign({ type: 'ballon' }, this.screen())); }
    return true;
  }
  reply(platform, msg, force) { if (!this.say) return; const k = platform + msg.slice(0, 20); if (!force && Date.now() - (this.ackAt[k] || 0) < 3000) return; this.ackAt[k] = Date.now(); this.say(platform, msg); }
  // you vote from the dashboard (One vote like a fan): your vote for this stream
  bossVote(id) {
    if (this.st.status !== 'open') return { error: 'Voting isn\'t open' };
    if (this.st.boss.mode !== 'fan') return { error: 'Your vote is set to ' + (this.st.boss.mode === 'none' ? '"Don\'t vote"' : '"Manager\'s vote"') };
    const n = this.nom(id); if (!n) return { error: 'Pick a nominee' };
    const no = String(this.streamNo()); this.st.votes[no] = this.st.votes[no] || {};
    for (const k of this.st.boss.keys) delete this.st.votes[no][k];
    this.st.votes[no]['you'] = { n: n.id, at: Date.now(), pf: 'dashboard', d: 'You', held: false, boss: true };
    if (!this.isBoss('you')) this.st.boss.keys.push('you');
    this.changed(); return { ok: true, msg: 'Your vote this stream: #' + this.num(n.id) + ' ' + n.name };
  }
  // your vote setting: none (don't vote) / fan (one vote like everyone) / manager (your top 3 + weight)
  setBoss(p) {
    const B = this.st.boss;
    if (['none', 'fan', 'manager'].includes(p.mode)) { B.mode = p.mode; if (p.mode !== 'fan') this.removeBossFanVotes(); if (p.mode !== 'manager') B.rank = []; }
    if (Array.isArray(p.rank)) { const L = []; for (const id of p.rank) if (id && this.nom(id) && !L.includes(id)) L.push(id); B.rank = L.slice(0, 3); }
    if (p.weight != null && isFinite(+p.weight)) B.weight = Math.max(5, Math.min(50, Math.round(+p.weight)));
    this.changed(); return { ok: true };
  }
  removeBossFanVotes() { let n = 0; for (const no of Object.keys(this.st.votes)) for (const k of Object.keys(this.st.votes[no])) if (this.isBoss(k)) { delete this.st.votes[no][k]; n++; } return n; }
  removeMyVote() { const n = this.removeBossFanVotes(); const had = this.st.boss.rank.length; this.st.boss.rank = []; this.changed(); return { ok: true, msg: n || had ? 'Your vote is removed' : 'You hadn\'t voted', removed: n + (had ? 1 : 0) }; }

  // held votes (bot check): Approve = counts (and trusted), Reject = thrown away
  // votes to look at: held (not counted yet) and flagged (counted, but the score was high)
  held() { const out = []; for (const [no, V] of Object.entries(this.st.votes)) for (const [k, v] of Object.entries(V)) if (v.held || v.flag) out.push({ no: +no, key: k, d: v.d, pf: v.pf, num: this.num(v.n), name: (this.nom(v.n) || {}).name, reasons: v.reasons || [], held: !!v.held }); return out; }
  review(action, key) {
    let n = 0; for (const V of Object.values(this.st.votes)) { const v = V[key]; if (!v || !(v.held || v.flag)) continue; if (action === 'approve') { v.held = false; v.flag = false; n++; if (this.botcheck && v.login) this.botcheck.trust(v.pf + ':' + v.login, true); } else if (action === 'reject') { delete V[key]; n++; } }
    if (!n) return { error: 'No vote to check for them' };
    this.changed(); return { ok: true, msg: (action === 'approve' ? 'Counted ' : 'Thrown away ') + n + ' vote' + (n === 1 ? '' : 's') };
  }

  // ---------- results (only you see these unless you show them) ----------
  results() {
    const fan = {}; this.st.noms.forEach((n) => { fan[n.id] = 0; });
    const voters = new Set(); let total = 0, streams = 0, heldN = 0;
    // votes cast while you're offline all go in one bucket ("0"): they count, but not as a stream
    for (const [no, V] of Object.entries(this.st.votes)) { let any = false; for (const [k, v] of Object.entries(V)) { if (v.held) { heldN++; continue; } if (!(v.n in fan)) continue; fan[v.n]++; total++; voters.add(k); any = true; } if (any && no !== '0') streams++; }
    const B = this.st.boss, mgr = {}; const useMgr = B.mode === 'manager' && B.rank.length > 0;
    if (useMgr) B.rank.forEach((id, i) => { mgr[id] = MGR_SHARE[i] * (100 / MGR_SHARE.slice(0, B.rank.length).reduce((a, x) => a + x, 0)); });
    const w = useMgr ? B.weight / 100 : 0;
    const rows = this.st.noms.map((n, i) => {
      const fanPct = total ? fan[n.id] * 100 / total : 0, mgrPct = mgr[n.id] || 0;
      return { id: n.id, num: i + 1, name: n.name, pos: n.pos, club: n.club, votes: fan[n.id], fanPct: Math.round(fanPct * 10) / 10, mgrPct: Math.round(mgrPct * 10) / 10, pct: Math.round((fanPct * (1 - w) + mgrPct * w) * 10) / 10 };
    }).sort((a, b) => b.pct - a.pct || b.votes - a.votes || a.num - b.num);
    const fansFav = rows.slice().sort((a, b) => b.votes - a.votes || a.num - b.num)[0] || null;
    return { rows, total, voters: voters.size, streams, held: heldN, manager: useMgr ? { weight: B.weight, rank: B.rank.map((id) => this.num(id)) } : null, fansFav: fansFav && fansFav.votes ? fansFav : null, differs: !!(useMgr && rows[0] && fansFav && fansFav.votes && rows[0].id !== fansFav.id) };
  }
  myVote() { const no = String(this.streamNo()); const v = this.st.votes[no] && Object.entries(this.st.votes[no]).find(([k]) => this.isBoss(k)); return v ? { num: this.num(v[1].n), name: (this.nom(v[1].n) || {}).name } : null; }
  state() { return Object.assign({}, this.st, { votes: undefined, results: this.results(), held: this.held(), myVote: this.myVote(), streamNo: this.streamNo(), now: Date.now() }); }

  // ---------- on stream ----------
  // screen: off / vote (full screen) / corner (small reminder during play) / all (every nominee's votes) / ceremony (stage 1 = 3rd, 2 = 2nd, 3 = winner, 4 = + fans' favourite)
  setShow(screen, stage) {
    if (!['off', 'vote', 'corner', 'all', 'ceremony'].includes(screen)) return { error: 'Unknown screen' };
    if (screen === 'ceremony' && this.st.status === 'open') return { error: 'Close voting before the ceremony' };
    this.st.show = { screen, stage: screen === 'ceremony' ? Math.max(0, Math.min(4, Number(stage) || 0)) : 0 };
    this.changed(); return { ok: true };
  }
  screen() {
    const r = this.results(), sh = this.st.show;
    const out = { title: this.st.title, status: this.st.status, closesAt: this.st.S.closesAt, noms: this.st.noms.map((n, i) => ({ num: i + 1, name: n.name, pos: n.pos, club: n.club })), total: r.total, voters: r.voters, streams: r.streams, show: sh };
    // what's revealed, and only that
    if (sh.screen === 'all') out.all = r.rows.map((x) => ({ num: x.num, name: x.name, pos: x.pos, club: x.club, votes: x.votes, pct: x.pct, fanPct: x.fanPct }));
    if (sh.screen === 'ceremony') {
      const top = r.rows.slice(0, 3).map((x) => ({ num: x.num, name: x.name, pos: x.pos, club: x.club, pct: x.pct, votes: x.votes }));
      out.reveal = { third: sh.stage >= 1 ? top[2] || null : null, second: sh.stage >= 2 ? top[1] || null : null, winner: sh.stage >= 3 ? top[0] || null : null, fansFav: sh.stage >= 4 && r.differs ? { num: r.fansFav.num, name: r.fansFav.name, votes: r.fansFav.votes, fanPct: r.fansFav.fanPct } : null, manager: r.manager ? r.manager.weight : null };
    }
    return out;
  }
}

module.exports = { Ballon, MGR_SHARE };
