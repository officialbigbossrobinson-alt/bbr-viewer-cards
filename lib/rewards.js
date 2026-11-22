// Rewards: every Power-up and channel point reward the channel has, in one list.
// Each one is matched automatically from its name ("Eyepatch for 5 games" -> challenge EYEPATCH, 5 games;
// "Spin the camera" -> camera effect) and the streamer can change anything on the Rewards page.
const UNITS = ['games', 'matches', 'deliveries', 'raids', 'minutes'];
const BUILTIN = /^(gigantify an emote|message effect|on-screen celebration|combo|power-up)$/i;
const CAM_WORDS = [
  [/big ?head|giant head/, 'bighead'], [/tiny head|small head|little head/, 'tinyhead'], [/forehead/, 'forehead'], [/big nose|nose/, 'bignose'],
  [/shatter|break ?apart|crack/, 'shatter'], [/melt/, 'melt'], [/swirl|twist/, 'swirl'], [/squash|squish|flat/, 'squash'], [/fish ?eye|doorbell/, 'fisheye'],
  [/pixel/, 'pixel'], [/bobble/, 'bobble'], [/twins|mirror face/, 'twins'], [/spin/, 'spin'], [/upside/, 'upside'], [/zoom/, 'zoom'], [/shake/, 'shake'],
  [/bounce/, 'bounce'], [/goal ?cam/, 'goal'], [/spotlight/, 'spotlight'], [/wanted/, 'wanted'], [/night ?vision/, 'night'], [/black and white|b&w|flashback/, 'bw'],
  [/mirror|flip/, 'mirror'], [/tilt/, 'tilt']
];
const CHALLENGE_WORDS = /\b(only|wear|wearing|no |must|play with|challenge|without|eyepatch|blindfold|hat|accent|sing|weak foot|keeper|left foot|right foot)\b/i;
const keyOf = (t) => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');

const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30 };
function guess(title, old) {
  // "Eyepatch for FIVE GAMES" reads the same as "Eyepatch for 5 games"
  const t = String(title || '').trim().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty)\b(?=\s*(games?|matches?|match|minutes?|mins?|deliveries|delivery|raids?)\b)/ig, (w) => String(WORDNUM[w.toLowerCase()])), low = t.toLowerCase();
  if (BUILTIN.test(t)) return { action: 'alert', name: t.toUpperCase(), amount: null, unit: null, why: 'Twitch Power-up' };
  // older Challenges / Camera settings still count
  if (old && old.camera) return { action: 'camera', fx: old.camera, name: t.toUpperCase(), amount: null, unit: 'seconds', why: 'From your Camera studio settings' };
  for (const [re, fx] of CAM_WORDS) if (re.test(low) && /cam|camera|head|face|nose|forehead|mode|vision|spin|upside|zoom|shake|bounce|wanted|spotlight|shatter|melt|swirl|squash|pixel|bobble|twins|eye/.test(low)) {
    return { action: 'camera', fx, name: t.toUpperCase().replace(/!+$/, '') + '!', amount: null, unit: 'seconds', why: 'Auto-matched from the name' };
  }
  const m = /(\d+)\s*(games?|matches?|match|minutes?|mins?|deliveries|delivery|raids?)/i.exec(t);
  const next = /\bnext (game|match|delivery|raid)\b/i.exec(t);
  if (m || next || CHALLENGE_WORDS.test(t)) {
    let amount = 1, unit = 'games';
    if (m) { amount = Math.max(1, Math.min(99, +m[1])); const u = m[2].toLowerCase(); unit = /^min/.test(u) ? 'minutes' : /^match/.test(u) ? 'matches' : /^deliver/.test(u) ? 'deliveries' : /^raid/.test(u) ? 'raids' : 'games'; }
    else if (next) { const u = next[1].toLowerCase(); unit = u === 'match' ? 'matches' : u === 'delivery' ? 'deliveries' : u === 'raid' ? 'raids' : 'games'; }
    const name = t.replace(/\s*(for\s+)?(the\s+)?(\d+\s*(games?|matches?|match|minutes?|mins?|deliveries|delivery|raids?)|next (game|match|delivery|raid))\s*/ig, ' ').replace(/\s+(for|in)\s*$/i, '').trim().replace(/^(with|one|a|an|1)\s+/i, '').replace(/\s+(game|match)$/i, '').trim();
    return { action: 'challenge', name: (name || t).toUpperCase(), amount, unit, why: 'Auto-matched from the name' };
  }
  // older Challenges settings: only when the reward's own name doesn't already say what it is
  // (it used to win over the name, so "1 eyepatch game", "5 games eyepatch" and "two eyepatches" all became the same thing)
  if (old && old.challenge) return { action: 'challenge', name: old.challenge.name.toUpperCase(), amount: old.challenge.count, unit: old.challenge.unit, why: 'From your Challenges settings' };
  return { action: 'alert', name: t.toUpperCase(), amount: null, unit: null, why: 'Not a challenge or camera effect: a normal alert' };
}

class Rewards {
  constructor(o) { Object.assign(this, o); }   // store, cfg, saveCfg, push, challenges, cam, twitch, oldRules()
  seen() { const d = this.store.data; if (!d.rewards) d.rewards = {}; return d.rewards; }
  rules() { const c = this.cfg(); if (!c.rewardRules) c.rewardRules = {}; return c.rewardRules; }
  note(title, kind, extra) {
    const k = keyOf(title); if (!k) return null;
    const S = this.seen();
    const r = S[k] || (S[k] = { title: String(title).trim(), kind: kind || 'points', firstSeen: Date.now(), count: 0 });
    Object.assign(r, extra || {});
    if (kind && r.kind !== 'powerup') r.kind = kind;
    return r;
  }
  effective(title) {
    const k = keyOf(title), R = this.rules()[k] || {};
    const g = guess(title, this.oldRules ? this.oldRules(title) : null);
    const e = Object.assign({ show: true, color: R.color || (g.action === 'camera' ? '#ff5aa0' : '#ffb020'), sound: 'stamp', again: 'add' }, g, R);
    e.edited = !!this.rules()[k]; e.why = e.edited ? 'Your settings' : g.why;
    if (e.action === 'camera' && !e.secs) e.secs = null;
    return e;
  }
  list() {
    const S = this.seen();
    return Object.entries(S).map(([k, r]) => Object.assign({ key: k }, r, { rule: this.effective(r.title), isNew: !this.rules()[k] && Date.now() - (r.firstSeen || 0) < 7 * 86400000 && r.count > 0 }))
      .sort((a, b) => (b.count || 0) - (a.count || 0) || a.title.localeCompare(b.title));
  }
  async refresh() {
    const found = await this.twitch.rewards();
    for (const r of found) this.note(r.title, 'points', { cost: r.cost + ' points', enabled: r.enabled });
    this.store.save();
    return found.length;
  }
  set(key, n) {
    const R = this.rules();
    if (n === null) { delete R[key]; this.saveCfg(); return; }
    const cur = R[key] || {};
    const out = {
      action: ['challenge', 'camera', 'alert', 'none'].includes(n.action) ? n.action : cur.action || 'alert',
      name: String(n.name != null ? n.name : cur.name || '').slice(0, 40),
      amount: n.amount != null && n.amount !== '' ? Math.max(1, Math.min(99, Math.round(+n.amount) || 1)) : cur.amount || null,
      unit: UNITS.includes(n.unit) ? n.unit : cur.unit || 'games',
      show: n.show != null ? !!n.show : cur.show !== false,
      color: /^#[0-9a-f]{6}$/i.test(n.color || '') ? n.color : cur.color || '#ffb020',
      fx: n.fx || cur.fx || null, secs: n.secs != null && n.secs !== '' ? Math.max(1, Math.min(300, Math.round(+n.secs) || 10)) : cur.secs || null,
      again: n.again === 'new' ? 'new' : 'add'
    };
    R[key] = out; this.saveCfg();
  }
  add(title) { this.note(title, 'points', {}); this.store.save(); }
  // someone redeemed / bought it
  handle(title, by, platform, kind, opts) {
    opts = opts || {};
    const r = this.note(title, kind, opts.cost ? { cost: opts.cost } : {}); if (!r) return null;
    if (!opts.test) { r.count = (r.count || 0) + 1; r.last = Date.now(); r.lastBy = by; this.store.save(); }
    const e = this.effective(title);
    // channel points: nobody's name on screen (unless switched on); Power-ups (paid) still thank the person
    const anon = kind !== 'powerup' && !(this.showNames && this.showNames());
    if (e.action === 'challenge') return this.challenges.add({ name: e.name, count: e.amount || 1, unit: e.unit || 'games', by, platform, source: title, color: e.color, hidden: !e.show, again: e.again, anon });
    if (e.action === 'camera' && e.fx) { if (this.cam.allowed(opts.test)) this.cam.run(e.fx, anon ? null : by, e.secs); return { camera: e.fx }; }
    if (e.action === 'alert' && e.show) this.push({ type: 'toast', text: (by && !anon ? by + ': ' : '') + e.name, sub: kind === 'powerup' ? 'Power-up' : 'Channel points', ms: 6000 });
    return { action: e.action };
  }
}
module.exports = { Rewards, guess, keyOf, UNITS };
