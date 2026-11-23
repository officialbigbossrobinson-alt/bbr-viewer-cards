// v38 giveaway bot check: every giveaway entrant gets a suspicion score. Points for red flags, points off for signs
// of a real person. Nobody is blocked by the score alone:
//   review mode (the default): flagged names are only marked (amber / red) with the reasons, for you or a mod to look at.
//   hold mode: 7+ points = the entry is paused (left out of the draw) until a mod presses Approve.
// Approve = trusted from then on (never flagged again). Reject = out of this giveaway. Ignore = stays in, no more marker.
// Everything is logged (data/botcheck.json) so you can answer "why didn't I get in?".
const fs = require('fs');

const DEF_POINTS = {
  newAcc7: 4,        // account under 7 days old (Twitch)
  newAcc30: 2,       // account 7–30 days old (Twitch)
  newFollow: 3,      // followed under 24 hours before entering
  onlyCmd: 3,        // their only message this stream is the entry command
  firstTime: 2,      // first stream they've ever been in
  genericName: 1,    // name like word + 4 digits, or random letters
  noAvatar: 1,       // default profile picture (Twitch)
  fastEntry: 2,      // entered within 2 seconds of the giveaway opening
  burst: 3,          // several new accounts entering together with similar names / creation dates
  copyPaste: 2,      // the same message as other users, word for word
  noWatch: 2,        // no watch time this stream
  streak: -4,        // viewer card with a streak of 3+ streams
  regular: -3,       // chatted across 2+ earlier streams
  supporter: -5,     // has ever subbed, cheered bits or sent Kicks
};
const LABEL = {
  newAcc7: 'Account under 7 days old', newAcc30: 'Account 7–30 days old', newFollow: 'Followed under 24 hours before entering',
  onlyCmd: 'Only message this stream is the entry command', firstTime: 'First time in your chat', genericName: 'Generic-looking name',
  noAvatar: 'No profile picture', fastEntry: 'Entered within 2 seconds of opening', burst: 'Entered with a group of new look-alike accounts',
  copyPaste: 'Copy-paste message (same as other people)', noWatch: 'No watch time this stream', streak: 'Card streak of 3+ streams',
  regular: 'Chatted in 2+ earlier streams', supporter: 'Has subbed / cheered / sent Kicks',
};
const DAY = 86400000;
// "word + 4 or more digits" (kevin84629) or a run of random letters with digits mixed in (xk7qpz93)
function genericName(n) {
  n = String(n || '').toLowerCase();
  if (/^[a-z]{3,}_?\d{4,}$/.test(n)) return true;
  if (n.length >= 7 && /\d/.test(n) && /[a-z]/.test(n) && !/[aeiou]{1}[a-z]*[aeiou]/.test(n.replace(/\d/g, ''))) return true;
  return false;
}
// two names look alike: same 4+ letter start, or the same letters with different numbers on the end
function alike(a, b) {
  a = String(a).toLowerCase(); b = String(b).toLowerCase();
  if (a === b) return false;
  const sa = a.replace(/[\d_]+$/, ''), sb = b.replace(/[\d_]+$/, '');
  if (sa.length >= 4 && sa === sb) return true;
  return a.length >= 6 && b.length >= 6 && a.slice(0, 5) === b.slice(0, 5);
}

class BotCheck {
  // o: cfg(), saveCfg(), file, viewer(platform, login) -> store viewer or null, watchMins(platform, login),
  //    twitchUsers(logins) -> Promise<[{login, created_at, profile_image_url}]>, streamNo() -> number, changed()
  constructor(o) {
    Object.assign(this, o);
    this.d = { log: [], acc: {} };
    try { Object.assign(this.d, JSON.parse(fs.readFileSync(this.file, 'utf8'))); } catch (e) { /* first time */ }
    this.chat = new Map();   // key -> { no, msgs: [lower text...], nonCmd } this stream
    this.wanted = new Set(); this.lookT = null; this.saveT = null;
  }
  S() {
    const c = this.cfg().botcheck || {};
    const pts = Object.assign({}, DEF_POINTS); for (const k of Object.keys(DEF_POINTS)) if (c.points && isFinite(+c.points[k])) pts[k] = Math.max(-20, Math.min(20, Math.round(+c.points[k])));
    const review = Math.max(1, Math.min(30, Math.round(+c.review || 4))), hold = Math.max(review + 1, Math.min(40, Math.round(+c.hold || 7)));
    return { mode: ['off', 'review', 'hold'].includes(c.mode) ? c.mode : 'review', points: pts, review, hold, trusted: Array.isArray(c.trusted) ? c.trusted : [] };
  }
  set(n) {
    const c = Object.assign({}, this.cfg().botcheck || {});
    if (['off', 'review', 'hold'].includes(n.mode)) c.mode = n.mode;
    if (n.review != null && isFinite(+n.review)) c.review = +n.review;
    if (n.hold != null && isFinite(+n.hold)) c.hold = +n.hold;
    if (n.points && typeof n.points === 'object') { c.points = Object.assign({}, c.points || {}); for (const k of Object.keys(DEF_POINTS)) if (n.points[k] != null && isFinite(+n.points[k])) c.points[k] = +n.points[k]; }
    if (n.resetPoints) delete c.points;
    this.cfg().botcheck = c; this.saveCfg(); return this.S();
  }
  isTrusted(key) { return this.S().trusted.includes(key); }
  trust(key, on) {
    const c = Object.assign({}, this.cfg().botcheck || {}); const L = new Set(Array.isArray(c.trusted) ? c.trusted : []);
    if (on) L.add(key); else L.delete(key);
    c.trusted = [...L].slice(-5000); this.cfg().botcheck = c; this.saveCfg();
  }
  log(kind, entry, extra) {
    this.d.log.unshift(Object.assign({ at: Date.now(), kind, key: entry.key, display: entry.display, platform: entry.platform, score: entry.bot ? entry.bot.score : null, reasons: entry.bot ? entry.bot.reasons.map((r) => r.text) : [] }, extra || {}));
    this.d.log = this.d.log.slice(0, 500); this.save();
  }
  save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => { try { fs.writeFileSync(this.file, JSON.stringify(this.d)); } catch (e) { /* ignore */ } }, 300); }

  // every chat message (for "only message was the command" and copy-paste)
  noteChat(platform, e) {
    const key = platform + ':' + String(e.login || '').toLowerCase(), no = this.streamNo();
    let c = this.chat.get(key); if (!c || c.no !== no) { c = { no, msgs: [], nonCmd: 0 }; this.chat.set(key, c); }
    const t = String(e.text || '').trim().toLowerCase();
    if (!t) return;
    if (!t.startsWith('!')) { c.nonCmd++; if (t.length >= 12) { c.msgs.push(t); c.msgs = c.msgs.slice(-20); } }
    if (this.chat.size > 20000) this.chat.clear();
  }
  copyPasted(key) {
    const c = this.chat.get(key); if (!c || !c.msgs.length) return false;
    const mine = new Set(c.msgs);
    let others = 0;
    for (const [k, x] of this.chat) { if (k === key || x.no !== c.no) continue; if (x.msgs.some((m) => mine.has(m))) { others++; if (others >= 2) return true; } }
    return false;
  }

  // Twitch account age + picture, looked up in batches (cached a week)
  account(platform, login) { return platform === 'twitch' ? this.d.acc[String(login).toLowerCase()] || null : null; }
  want(platform, login) {
    if (platform !== 'twitch' || !this.twitchUsers) return;
    const l = String(login).toLowerCase(), a = this.d.acc[l];
    if (a && Date.now() - a.got < 7 * DAY) return;
    this.wanted.add(l);
    if (!this.lookT) this.lookT = setTimeout(() => this.lookup(), this.lookMs != null ? this.lookMs : 1500);
  }
  async lookup() {
    this.lookT = null;
    const L = [...this.wanted].slice(0, 100); L.forEach((l) => this.wanted.delete(l));
    if (!L.length) return;
    try {
      const got = await this.twitchUsers(L);
      for (const u of got || []) this.d.acc[String(u.login).toLowerCase()] = { created: Date.parse(u.created_at) || null, avatar: !/user-default-pictures/.test(u.profile_image_url || ''), got: Date.now() };
      const keys = Object.keys(this.d.acc); if (keys.length > 20000) for (const k of keys.slice(0, 5000)) delete this.d.acc[k];
      this.save();
      if (this.changed) this.changed();
    } catch (e) { /* not logged in to Twitch: account age just isn't used */ }
    if (this.wanted.size) this.lookT = setTimeout(() => this.lookup(), 1000);
  }

  // score one entry (all = every entry in the giveaway, openedAt = when it opened)
  score(entry, all, openedAt) {
    const S = this.S(), P = S.points, R = [];
    const add = (k, extra) => { if (P[k]) R.push({ k, pts: P[k], text: LABEL[k] + (extra ? ' (' + extra + ')' : '') }); };
    if (this.isTrusted(entry.key)) return { score: 0, level: 'trusted', reasons: [{ k: 'trusted', pts: 0, text: 'Approved before: trusted' }] };
    const v = this.viewer(entry.platform, entry.login) || {};
    const acc = this.account(entry.platform, entry.login), now = entry.at || Date.now();
    if (acc && acc.created) { const age = (now - acc.created) / DAY; const dd = Math.max(0, Math.floor(age)), dl = dd === 0 ? 'today' : dd === 1 ? '1 day' : dd + ' days'; if (age < 7) add('newAcc7', dl); else if (age < 30) add('newAcc30', dl); }
    if (acc && acc.got && acc.avatar === false) add('noAvatar');
    if (v.followedAt && now - v.followedAt < DAY && now >= v.followedAt) { const h = Math.max(1, Math.round((now - v.followedAt) / 3600000)); add('newFollow', h + (h === 1 ? ' hour' : ' hours') + ' before'); }
    const c = this.chat.get(entry.key);
    if (!c || c.no !== this.streamNo() || c.nonCmd === 0) add('onlyCmd');
    if ((v.streams || 0) <= 1 && (v.messages || 0) <= 3) add('firstTime');
    if (genericName(entry.login)) add('genericName');
    if (openedAt && entry.at - openedAt >= 0 && entry.at - openedAt <= 2000 && !entry.byHand) add('fastEntry');
    // a group: 3+ entries inside 15 seconds that are new accounts (created within 3 days of each other) or look-alike names
    const near = (all || []).filter((x) => x.key !== entry.key && Math.abs((x.at || 0) - (entry.at || 0)) <= 15000);
    const mine = acc && acc.created;
    const group = near.filter((x) => { const a = this.account(x.platform, x.login); return alike(x.login, entry.login) || (mine && a && a.created && Math.abs(a.created - mine) < 3 * DAY && now - mine < 30 * DAY); });
    if (group.length >= 2) add('burst', group.length + 1 + ' at once');
    if (this.copyPasted(entry.key)) add('copyPaste');
    if (!entry.byHand && (this.watchMins(entry.platform, entry.login) || 0) < 1) add('noWatch');
    if (v.tk && (v.tk.streak || 0) >= 3) add('streak', v.tk.streak + ' streams');
    if ((v.streams || 0) >= 3) add('regular', (v.streams - 1) + ' earlier streams');
    if ((v.subMonths || 0) > 0 || (v.bits || 0) > 0 || (v.gifted || 0) > 0 || (v.giftsAll || 0) > 0) add('supporter');
    const score = R.reduce((a, r) => a + r.pts, 0);
    const level = score >= S.hold ? 'hold' : score >= S.review ? 'review' : 'clear';
    return { score, level, reasons: R };
  }
}

module.exports = { BotCheck, DEF_POINTS, LABEL, genericName, alike };
