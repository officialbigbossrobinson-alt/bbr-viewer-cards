// v35 simple giveaway: viewers type !giveaway, their Twitch name goes in a list you can see in the dock
// (copy / add / delete / clear / pick a winner). The bot answers in chat with YOUR words, and you can ask for a
// minimum watch time this stream (the bot tells people how much they have and how much they still need).
// Settings: cfg.sgw. The list: data/sgiveaway.json (kept through restarts).
const fs = require('fs');

const DEF_MSG = {
  in: '@{user} you\'re in the giveaway! ({count} entered)',
  already: '@{user} you\'re already in the giveaway ({count} entered)',
  need: '@{user} you need {need} min of watch time this stream to enter. You have {have} min, so {left} min to go. Keep watching!',
  closed: '@{user} the giveaway isn\'t open right now',
  watch: '@{user} you\'ve watched {have} min this stream.{needline}',
  winner: '🎉 Congratulations @{user}, you won the giveaway!',
  open: 'The giveaway is OPEN! Type {cmd} to enter.{needline}',
  close: 'The giveaway is now closed: {count} entered. Good luck!',
};
const PLAT = ['twitch', 'kick', 'youtube'];
const txt = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);
const nameOk = (n) => /^[A-Za-z0-9_.\-]{2,40}$/.test(n);

class SimpleGiveaway {
  // o: cfg(), saveCfg(), push(ev), file, say(platform, msg), watchMins(platform, login) -> minutes this stream, feed(text, colour)
  constructor(o) {
    Object.assign(this, o);
    this.st = { open: false, entries: [], winners: [], openedAt: null, closedAt: null, blocked: {} };
    try { Object.assign(this.st, JSON.parse(fs.readFileSync(this.file, 'utf8'))); } catch (e) { /* first time */ }
    if (!this.st.blocked || typeof this.st.blocked !== 'object') this.st.blocked = {};
    this.q = {}; this.qT = null; this.saveT = null;
  }
  // ---------- v38: bot check + bans ----------
  bc() { const b = this.botcheck; return b && b.S().mode !== 'off' ? b : null; }
  rescore() {
    const b = this.bc(); let ch = false;
    for (const x of this.st.entries) {
      if (!b) { if (x.bot || x.held) { delete x.bot; x.held = false; ch = true; } continue; }
      const prev = x.bot ? x.bot.level + x.bot.score : '';
      const r = b.score(x, this.st.entries, this.st.openedAt);
      x.bot = r;
      const hold = b.S().mode === 'hold' && r.level === 'hold' && !x.approved && !x.ignored;
      if (hold !== !!x.held) { x.held = hold; ch = true; }
      if (prev !== r.level + r.score) { ch = true; if ((r.level === 'review' || r.level === 'hold') && !x.logged) { x.logged = true; b.log('flagged', x, { level: r.level }); } }
    }
    if (ch) this.changed();
    return ch;
  }
  find(key) { const k = String(key || '').trim().toLowerCase().replace(/^@/, ''); return this.st.entries.find((x) => (k.includes(':') ? x.key === k : x.login === k)) || null; }
  // Approve = in, and trusted from now on; Reject = out of this giveaway; Ignore = stays in, no more marker
  review(action, key, by) {
    const x = this.find(key); if (!x) return { error: 'Not in the list' };
    const b = this.botcheck;
    if (action === 'approve') { x.approved = true; x.held = false; if (b) { b.trust(x.key, true); b.log('approved', x, { by: by || 'you' }); } this.rescore(); this.changed(); return { ok: true, msg: 'Approved ' + x.display + ' (trusted from now on)' }; }
    if (action === 'ignore') { x.ignored = true; x.held = false; if (b) b.log('ignored', x, { by: by || 'you' }); this.changed(); return { ok: true, msg: x.display + ' stays in (no marker)' }; }
    if (action === 'reject') { if (b) b.log('rejected', x, { by: by || 'you' }); this.drop(x, 'Rejected by ' + (by || 'you')); return { ok: true, msg: 'Rejected ' + x.display + ' (out of this giveaway)' }; }
    return { error: 'Unknown action' };
  }
  drop(x, why) {
    this.st.entries = this.st.entries.filter((e) => e.key !== x.key);
    this.st.blocked[x.key] = { why, at: Date.now(), display: x.display };
    this.changed();
  }
  // banned (or timed out) on Twitch / Kick / YouTube: out of the giveaway, and can't enter again this round
  ban(platform, login, why) {
    const key = platform + ':' + String(login || '').toLowerCase();
    const x = this.st.entries.find((e) => e.key === key);
    if (!x) { if (this.st.open) { this.st.blocked[key] = { why, at: Date.now(), display: login }; this.save(); } return null; }
    if (this.botcheck) this.botcheck.log('banned', x, { why });
    this.drop(x, why);
    if (this.feed) this.feed('Giveaway: ' + x.display + ' removed (' + why + ')', '#ff6b7d');
    return x;
  }
  S() {
    const c = this.cfg().sgw || {}, m = c.msg || {};
    const msg = {}; for (const k of Object.keys(DEF_MSG)) msg[k] = m[k] != null && String(m[k]).trim() ? txt(m[k], 300) : DEF_MSG[k];
    const pf = {}; for (const p of PLAT) pf[p] = c.platforms && typeof c.platforms[p] === 'boolean' ? c.platforms[p] : p === 'twitch';
    return {
      cmd: (txt(c.cmd, 24) || '!giveaway').toLowerCase().replace(/^([^!])/, '!$1'), watchCmd: (txt(c.watchCmd, 24) || '!watchtime').toLowerCase().replace(/^([^!])/, '!$1'),
      needMins: Math.max(0, Math.min(1440, Math.round(+c.needMins || 0))), platforms: pf, msg,
      reply: c.reply !== false, replyAlready: c.replyAlready !== false, announce: c.announce !== false, subsOnly: !!c.subsOnly, followersOnly: !!c.followersOnly,
      autoOpen: !!c.autoOpen, showOnTimer: c.showOnTimer !== false, on: c.on !== false,
    };
  }
  set(n) {
    const c = Object.assign({}, this.cfg().sgw || {});
    for (const k of ['cmd', 'watchCmd']) if (typeof n[k] === 'string') c[k] = n[k];
    if (n.needMins != null && isFinite(+n.needMins)) c.needMins = +n.needMins;
    for (const k of ['reply', 'replyAlready', 'announce', 'subsOnly', 'followersOnly', 'autoOpen', 'showOnTimer', 'on']) if (typeof n[k] === 'boolean') c[k] = n[k];
    if (n.platforms && typeof n.platforms === 'object') { c.platforms = Object.assign({}, c.platforms || {}); for (const p of PLAT) if (typeof n.platforms[p] === 'boolean') c.platforms[p] = n.platforms[p]; }
    if (n.msg && typeof n.msg === 'object') { c.msg = Object.assign({}, c.msg || {}); for (const k of Object.keys(DEF_MSG)) if (typeof n.msg[k] === 'string') c.msg[k] = n.msg[k]; }
    this.cfg().sgw = c; this.saveCfg(); this.changed(); return this.S();
  }
  save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => { try { fs.writeFileSync(this.file, JSON.stringify(this.st)); } catch (e) { /* ignore */ } }, 200); }
  changed() { this.save(); if (this.push) this.push(this.payload()); }
  count() { return this.st.entries.length; }
  flagged() { return this.st.entries.filter((x) => x.bot && (x.bot.level === 'review' || x.bot.level === 'hold') && !x.ignored && !x.approved); }
  payload() { return { type: 'sgw', open: this.st.open, count: this.count(), recent: this.st.entries.slice(-3).reverse().map((x) => x.display), cmd: this.S().cmd, winner: this.st.winners[0] || null }; }
  state() {
    const b = this.botcheck, bs = b ? b.S() : null;
    return Object.assign(this.payload(), { settings: this.S(), defaults: DEF_MSG, entries: this.st.entries.slice().reverse(), winners: this.st.winners.slice(0, 10), openedAt: this.st.openedAt, closedAt: this.st.closedAt,
      blocked: Object.entries(this.st.blocked).map(([key, x]) => Object.assign({ key }, x)).sort((a, c) => c.at - a.at).slice(0, 50),
      bot: bs ? { mode: bs.mode, review: bs.review, hold: bs.hold, flagged: this.flagged().length, held: this.st.entries.filter((x) => x.held).length } : null });
  }
  fill(t, vars) { return String(t).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m)); }
  needLine(S) { return S.needMins ? ' You need ' + S.needMins + ' min of watch time this stream to enter.' : ''; }

  // ---------- your buttons ----------
  open() {
    if (this.st.open) return 'The giveaway is already open';
    this.st.open = true; this.st.openedAt = Date.now(); this.st.closedAt = null; this.changed();
    const S = this.S();
    if (S.announce && this.say) this.sayAll(this.fill(S.msg.open, { cmd: S.cmd, needline: this.needLine(S), need: S.needMins, count: this.count() }));
    if (this.feed) this.feed('Giveaway OPEN: people type ' + S.cmd, '#ffd23f');
    return 'Giveaway open: people type ' + S.cmd + (S.needMins ? ' (needs ' + S.needMins + ' min watch time)' : '');
  }
  close() {
    if (!this.st.open) return 'The giveaway is already closed';
    this.st.open = false; this.st.closedAt = Date.now(); this.changed();
    const S = this.S();
    if (S.announce && this.say) this.sayAll(this.fill(S.msg.close, { count: this.count(), cmd: S.cmd }));
    return 'Giveaway closed: ' + this.count() + ' entered';
  }
  toggle() { return this.st.open ? this.close() : this.open(); }
  clear() { const n = this.count(); this.st.entries = []; this.st.winners = []; this.st.blocked = {}; this.changed(); return 'Giveaway list cleared (' + n + ' names)'; }
  // add a name by hand (no watch-time check: you decide)
  add(name, platform) {
    name = txt(name, 40).replace(/^@/, '');
    if (!nameOk(name)) return { error: 'That doesn\'t look like a username' };
    platform = PLAT.includes(platform) ? platform : 'twitch';
    const key = platform + ':' + name.toLowerCase();
    if (this.st.entries.some((x) => x.key === key)) return { error: name + ' is already in the list' };
    delete this.st.blocked[key];   // you decide: adding someone by hand lets them back in
    this.st.entries.push({ key, login: name.toLowerCase(), display: name, platform, at: Date.now(), mins: this.mins(platform, name), byHand: true, approved: true });
    this.changed(); this.rescore(); return { ok: true, msg: 'Added ' + name };
  }
  remove(key) {
    // a full key ("twitch:name") or just the name
    const k = String(key || '').trim().toLowerCase().replace(/^@/, ''), n = this.count();
    this.st.entries = this.st.entries.filter((x) => (k.includes(':') ? x.key !== k : x.login !== k));
    if (this.count() === n) return { error: 'Not in the list' };
    this.changed(); return { ok: true, msg: 'Removed' };
  }
  // a random winner from the list (not someone who already won this round); posts it in chat
  pick() {
    const won = new Set(this.st.winners.map((w) => w.key));
    const L = this.st.entries.filter((x) => !won.has(x.key) && !x.held);
    if (!L.length) return { error: this.count() ? (this.st.entries.some((x) => x.held && !won.has(x.key)) ? 'Everyone left is waiting for a bot check (Approve them first)' : 'Everyone in the list has already won') : 'Nobody has entered yet' };
    const w = L[Math.floor(Math.random() * L.length)];
    const rec = { key: w.key, display: w.display, platform: w.platform, at: Date.now(), mins: this.mins(w.platform, w.login), bot: w.bot && !w.ignored && !w.approved && w.bot.level !== 'clear' && w.bot.level !== 'trusted' ? { score: w.bot.score, level: w.bot.level, reasons: w.bot.reasons.map((r) => r.text) } : null };
    this.st.winners.unshift(rec); this.st.winners = this.st.winners.slice(0, 20);
    this.changed();
    const S = this.S();
    if (S.announce && this.say) this.say(w.platform, this.fill(S.msg.winner, { user: w.display, count: this.count(), have: rec.mins }));
    if (this.onWinner) try { this.onWinner(rec); } catch (e) { /* ignore */ }
    if (this.feed) this.feed('Giveaway winner: ' + w.display, '#ffd23f');
    return { ok: true, winner: rec, msg: 'Winner: ' + w.display };
  }
  text(sep) { return this.st.entries.map((x) => x.display).join(sep == null ? '\n' : sep); }
  mins(platform, login) { try { return Math.max(0, Math.floor(this.watchMins(platform, login) || 0)); } catch (e) { return 0; } }

  // ---------- chat ----------
  // returns true when the message was a giveaway command (so nothing else answers it)
  chat(platform, e, info) {
    const S = this.S(), t = String(e.text || '').trim().toLowerCase(), word = t.split(/\s+/)[0];
    if (!S.on) return false;
    // mods: !approve name / !reject name for the bot check
    if ((word === '!approve' || word === '!reject') && info && info.mod) {
      const who = t.split(/\s+/)[1]; if (!who) return true;
      const r = this.review(word === '!approve' ? 'approve' : 'reject', who.replace(/^@/, ''), e.display || e.login);
      if (this.say) this.say(platform, r.error ? '@' + (e.display || e.login) + ' ' + who + ' isn\'t in the giveaway' : r.msg);
      return true;
    }
    if (word !== S.cmd && word !== S.watchCmd) return false;
    if (!S.platforms[platform]) return word === S.cmd;   // that platform doesn't take part
    const user = e.display || e.login, have = this.mins(platform, e.login), vars = { user, have, need: S.needMins, left: Math.max(0, S.needMins - have), count: this.count(), cmd: S.cmd };
    if (word === S.watchCmd) {
      vars.needline = S.needMins ? (have >= S.needMins ? ' That\'s enough for the giveaway: type ' + S.cmd + '!' : ' The giveaway needs ' + S.needMins + ' min, so ' + vars.left + ' min to go.') : '';
      this.reply(platform, 'watch', this.fill(S.msg.watch, vars), user, true);
      return true;
    }
    if (!this.st.open) { if (S.reply) this.reply(platform, 'closed', this.fill(S.msg.closed, vars), user, true); return true; }
    const key = platform + ':' + String(e.login).toLowerCase();
    if (this.st.blocked[key]) return true;   // banned / timed out / rejected this round: no entry, no answer
    if (this.st.entries.some((x) => x.key === key)) { if (S.reply && S.replyAlready) this.reply(platform, 'already', S.msg.already, user); return true; }
    if (S.subsOnly && !(info && info.sub)) { if (S.reply) this.reply(platform, 'need', '@' + user + ' this giveaway is for subscribers only', user, true); return true; }
    if (S.followersOnly && !(info && info.follower)) { if (S.reply) this.reply(platform, 'need', '@' + user + ' follow the channel to enter the giveaway', user, true); return true; }
    if (S.needMins && have < S.needMins) { if (S.reply) this.reply(platform, 'need', this.fill(S.msg.need, vars), user, true); return true; }
    this.st.entries.push({ key, login: String(e.login).toLowerCase(), display: user, platform, at: Date.now(), mins: have });
    this.changed();
    if (this.botcheck) { this.botcheck.want(platform, e.login); this.rescore(); }
    if (S.reply) this.reply(platform, 'in', S.msg.in, user);
    return true;
  }
  // replies are bundled for a few seconds so a rush of entries is one chat message ("@a @b @c you're in!")
  reply(platform, kind, text, user, single) {
    if (!this.say) return;
    if (single) { this.say(platform, text); return; }
    const k = platform + '|' + kind; (this.q[k] = this.q[k] || { platform, text, users: [] }).users.push(user);
    if (!this.qT) this.qT = setTimeout(() => this.flush(), this.flushMs || 4000);
  }
  flush() {
    this.qT = null;
    for (const [k, x] of Object.entries(this.q)) {
      delete this.q[k];
      const users = x.users.slice(0, 15), more = x.users.length - users.length;
      const msg = this.fill(x.text.replace('{user}', users.join(' @') + (more > 0 ? ' (+' + more + ' more)' : '')), { count: this.count(), cmd: this.S().cmd });
      this.say(x.platform, msg);
    }
  }
  sayAll(msg) { const S = this.S(); for (const p of PLAT) if (S.platforms[p]) this.say(p, msg); }
}
module.exports = { SimpleGiveaway, DEF_MSG };
