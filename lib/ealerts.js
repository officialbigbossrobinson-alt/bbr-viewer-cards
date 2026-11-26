// v44 BBR alerts: follows, subs, gifts, bits, raids, hosts, Super Chats and the rest, played by BBR on the overlay
// instead of Streamlabs. Every type has its own look, length, sound(s), picture / GIF, video, text and read-out,
// plus "variations" for bigger amounts (a 1,000 bit cheer, a 10-gift bomb, a 50-viewer raid).
// Settings live in cfg.ealerts. The overlay plays them one at a time in the same queue as the cards.
const crypto = require('crypto');

const TW = ['twitch'], KI = ['kick'], YT = ['youtube'];
// amt: what "amount" means for that type (used for "from" and the variations)
const TYPES = {
  follow:      { label: 'Follow', pf: ['twitch', 'kick', 'youtube'], look: 'banner', secs: 5, text: '{name} just followed!', amt: null, sub: 'YouTube: new subscribers (public ones)' },
  sub:         { label: 'New sub', pf: ['twitch', 'kick'], look: 'card', secs: 7, text: '{name} just subscribed{tier}!', amt: null, tiers: true },
  resub:       { label: 'Resub', pf: ['twitch', 'kick'], look: 'card', secs: 7, text: '{name} resubscribed: {amount} months!', amt: 'months', tiers: true, tts: true },
  gift:        { label: 'Gifted subs', pf: ['twitch', 'kick'], look: 'card', secs: 7, text: '{name} gifted {amount} sub{s}!', amt: 'subs', tiers: true },
  giftbomb:    { label: 'Gift bomb', pf: ['twitch', 'kick'], look: 'takeover', secs: 9, text: '{name} dropped {amount} gifted subs!', amt: 'subs', min: 5, tiers: true, sub: 'Used instead of "Gifted subs" from this many' },
  giftsub:     { label: 'Received a gift', pf: ['twitch', 'kick'], look: 'banner', secs: 4, text: '{name} got a gifted sub', amt: null, on: false, sub: 'Each person who gets one (off: the gifter\'s alert covers it)' },
  bits:        { label: 'Bits', pf: TW, look: 'banner', secs: 6, text: '{name} cheered {amount} bits!', amt: 'bits', min: 1, tts: true },
  powerup:     { label: 'Power-ups', pf: TW, look: 'banner', secs: 5, text: '{name} used {what}', amt: 'bits', sub: 'Gigantify, message effects, celebrations, your own' },
  redeem:      { label: 'Channel points', pf: TW, look: 'banner', secs: 5, text: '{name} redeemed {what}', amt: null, on: false, rewards: true, tts: true, sub: 'Only the rewards you list (blank = all)' },
  raid:        { label: 'Raid', pf: TW, look: 'takeover', secs: 8, text: '{name} is raiding with {amount} viewers!', amt: 'viewers', min: 1 },
  hypetrain:   { label: 'Hype Train', pf: TW, look: 'takeover', secs: 7, text: 'HYPE TRAIN: level {amount}!', amt: 'level', sub: 'Starts and each new level' },
  charity:     { label: 'Charity donation', pf: TW, look: 'card', secs: 7, text: '{name} donated {money} to charity!', amt: 'money', tts: true },
  shoutout:    { label: 'Shout-out received', pf: TW, look: 'banner', secs: 6, text: '{name} shouted you out to {amount} viewers!', amt: 'viewers' },
  kicks:       { label: 'Kicks', pf: KI, look: 'banner', secs: 6, text: '{name} sent {amount} Kicks!', amt: 'kicks', min: 1, tts: true },
  host:        { label: 'Host', pf: KI, look: 'takeover', secs: 8, text: '{name} is hosting with {amount} viewers!', amt: 'viewers', min: 1 },
  superchat:   { label: 'Super Chat', pf: YT, look: 'banner', secs: 7, text: '{name} sent a {money} Super Chat!', amt: 'money', tts: true },
  supersticker:{ label: 'Super Sticker', pf: YT, look: 'banner', secs: 6, text: '{name} sent a {money} Super Sticker!', amt: 'money' },
  member:      { label: 'New member', pf: YT, look: 'card', secs: 7, text: '{name} became a member!', amt: null },
  milestone:   { label: 'Member milestone', pf: YT, look: 'card', secs: 7, text: '{name}: {amount} months as a member!', amt: 'months', tts: true },
  giftmember:  { label: 'Gifted memberships', pf: YT, look: 'card', secs: 8, text: '{name} gifted {amount} membership{s}!', amt: 'memberships' }
};
const ORDER = Object.keys(TYPES);
const LOOKS = ['banner', 'card', 'takeover'];
const clamp = (n, a, b, d) => { n = Number(n); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
const isId = (x) => typeof x === 'string' && /^[a-f0-9]{12}$/.test(x);
const ids = (L, n) => (Array.isArray(L) ? L : L ? [L] : []).map(String).filter(isId).slice(0, n || 10);
const txt = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').slice(0, n || 120);

function cleanType(t, n) {
  const D = TYPES[t]; n = n || {};
  const look = LOOKS.includes(n.look) ? n.look : D.look;
  return {
    on: n.on != null ? !!n.on : D.on !== false,
    look,
    secs: clamp(n.secs, 0, 60, D.secs),            // 0 = as long as the video
    sounds: ids(n.sounds), vol: clamp(n.vol, 0, 100, 70),
    image: isId(n.image) ? n.image : '', video: isId(n.video) ? n.video : '', videoSound: n.videoSound !== false,
    text: n.text != null && String(n.text).trim() ? txt(n.text, 120) : D.text,
    tts: n.tts != null ? !!n.tts : false,
    min: clamp(n.min, 0, 1e7, D.min || 0),
    rewards: D.rewards ? txt(n.rewards, 300) : undefined,
    vars: (Array.isArray(n.vars) ? n.vars : []).slice(0, 8).map((v) => ({
      min: clamp(v.min, 0, 1e7, 0), tier: ['any', '1', '2', '3', 'prime'].includes(String(v.tier)) ? String(v.tier) : 'any',
      look: LOOKS.includes(v.look) ? v.look : '', secs: v.secs === '' || v.secs == null ? null : clamp(v.secs, 0, 60, null),
      sounds: ids(v.sounds), image: isId(v.image) ? v.image : '', video: isId(v.video) ? v.video : '', text: v.text ? txt(v.text, 120) : ''
    }))
  };
}
function settings(c) {
  c = c || {};
  const types = {}; for (const t of ORDER) types[t] = cleanType(t, (c.types || {})[t]);
  return {
    on: !!c.on, paused: !!c.paused, muted: !!c.muted,
    merge: c.merge !== false, mergeSecs: clamp(c.mergeSecs, 2, 60, 10),
    cards: ['changes', 'always', 'never'].includes(c.cards) ? c.cards : 'changes',   // the viewer's card after their alert
    ttsVoice: txt(c.ttsVoice, 80), ttsVol: clamp(c.ttsVol, 0, 100, 80), ttsMax: clamp(c.ttsMax, 20, 300, 120),
    blocked: txt(c.blocked, 600), gapSecs: clamp(c.gapSecs, 0, 10, 1),
    tangia: Object.assign({ on: true, look: 'auto' }, c.tangia || {}),
    types
  };
}
const nf = (n) => Number(n || 0).toLocaleString('en-GB');
function money(n, cur) { const v = Math.round(Number(n || 0) * 100) / 100; return (cur && cur !== 'USD' && cur !== '$' ? cur + ' ' : '$') + (v % 1 ? v.toFixed(2) : String(v)); }

class EAlerts {
  // o: cfg(), saveCfg(), push(a), media (Media), tts(text, voice) → Promise<url|null>, card(platform, login) → card|null
  constructor(o) { Object.assign(this, o); this.history = []; this.pending = []; this.followBuf = null; this.n = 0; this.lastRaider = null; }
  S() { return settings(this.cfg().ealerts); }
  set(p) {
    const c = this.cfg(); const cur = c.ealerts || {};
    const next = Object.assign({}, cur);
    for (const k of ['on', 'paused', 'muted', 'merge', 'mergeSecs', 'cards', 'ttsVoice', 'ttsVol', 'ttsMax', 'blocked', 'gapSecs']) if (p[k] !== undefined) next[k] = p[k];
    if (p.tangia && typeof p.tangia === 'object') next.tangia = Object.assign({}, cur.tangia || {}, p.tangia);
    if (p.types && typeof p.types === 'object') { next.types = Object.assign({}, cur.types || {}); for (const t of Object.keys(p.types)) if (TYPES[t]) next.types[t] = cleanType(t, Object.assign({}, (cur.types || {})[t] || {}, p.types[t])); }
    const wasPaused = !!cur.paused;
    c.ealerts = next; this.saveCfg();
    const S = this.S();
    if (wasPaused && !S.paused) this.flushPending();
    this.state();
    return S;
  }
  state() { const S = this.S(); this.push({ type: 'ealertState', on: S.on, paused: S.paused, muted: S.muted, cards: S.cards, tangia: S.tangia }); return S; }
  info() { return { types: ORDER.map((k) => Object.assign({ id: k }, TYPES[k])), looks: LOOKS }; }

  // the variation that fits: the biggest "from" at or under the amount (and the right tier)
  pick(T, a) {
    let best = null;
    for (const v of T.vars) {
      if (a.amount < v.min) continue;
      if (v.tier !== 'any' && !(v.tier === 'prime' ? a.prime : String(a.tier || 1) === v.tier && !a.prime)) continue;
      if (!best || v.min >= best.min) best = v;
    }
    return best;
  }
  words(tpl, a) {
    const D = TYPES[a.type];
    const tier = a.prime ? ' with Prime' : a.tier > 1 ? ' at Tier ' + a.tier : '';
    return String(tpl).replace(/\{name\}/g, a.name).replace(/\{amount\}/g, nf(a.amount)).replace(/\{s\}/g, a.amount === 1 ? '' : 's')
      .replace(/\{tier\}/g, D.tiers ? tier : '').replace(/\{what\}/g, a.what || '').replace(/\{money\}/g, a.money || money(a.amount)).replace(/\{platform\}/g, a.platform || '').replace(/\{message\}/g, a.message || '');
  }
  clean(msg) {
    let m = txt(msg, 300).trim(); if (!m) return '';
    const bad = this.S().blocked.split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    for (const b of bad) m = m.replace(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    m = m.replace(/https?:\/\/\S+/gi, '').replace(/\b\w*(Cheer|cheer|Corgo|PogChamp|BibleThump)\d+\b/g, '').replace(/\s+/g, ' ').trim();
    return m;
  }
  mediaOf(id) { const m = id && this.media.get(id); return m && m.url ? { id, url: m.url, name: m.name, kind: m.kind } : null; }

  // fire(type, { name, platform, amount, tier, prime, message, what, money, avatar, card, login }, { test })
  async fire(type, e, o) {
    o = o || {};
    const S = this.S(), D = TYPES[type];
    if (!D) return { error: 'Unknown alert type' };
    if (!S.on && !o.test) return { skipped: 'off' };
    const T = S.types[type];
    if (!T.on && !o.test) return { skipped: 'type off' };
    const a = { type, name: txt(e.name || 'Someone', 40), platform: e.platform || 'twitch', amount: Math.max(0, Number(e.amount) || (D.amt ? 0 : 1)), tier: e.tier || 1, prime: !!e.prime, what: txt(e.what, 60), money: e.money || '', message: e.message || '', avatar: e.avatar || '', card: e.card || null, login: e.login || '' };
    if (D.amt && a.amount < T.min && !o.test) return { skipped: 'under the minimum' };
    if (D.rewards && T.rewards && T.rewards.trim() && !o.test) {
      const L = T.rewards.split(/[,\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
      if (L.length && !L.some((r) => a.what.toLowerCase().includes(r))) return { skipped: 'not one of your rewards' };
    }
    if ((type === 'raid' || type === 'host') && !o.test) this.lastRaider = { name: a.name, login: a.login || a.name, platform: a.platform, at: Date.now() };
    // lots of follows together: one alert
    if (type === 'follow' && S.merge && !o.test && !o.merged) return this.bufferFollow(a, S);
    return this.build(a, S, T, o);
  }
  bufferFollow(a, S) {
    if (!this.followBuf) { this.followBuf = { list: [], t: setTimeout(() => this.flushFollows(), S.mergeSecs * 1000) }; if (this.followBuf.t.unref) this.followBuf.t.unref(); }
    if (!this.followBuf.list.some((x) => x.name.toLowerCase() === a.name.toLowerCase())) this.followBuf.list.push(a);
    return { buffered: this.followBuf.list.length };
  }
  async flushFollows() {
    const B = this.followBuf; this.followBuf = null; if (!B || !B.list.length) return null;
    const S = this.S(), T = S.types.follow;
    if (B.list.length === 1) return this.build(B.list[0], S, T, { merged: true });
    const a = Object.assign({}, B.list[0], { name: B.list.length + ' new followers', amount: B.list.length, names: B.list.map((x) => x.name).slice(0, 12), card: null, avatar: '', merged: true });
    return this.build(a, S, T, { merged: true, text: '{name}' });
  }
  async build(a, S, T, o) {
    const V = this.pick(T, a) || {};
    const look = V.look || T.look;
    const secs = V.secs != null ? V.secs : T.secs;
    const soundIds = V.sounds && V.sounds.length ? V.sounds : T.sounds;
    const sid = soundIds.length ? soundIds[Math.floor(Math.random() * soundIds.length)] : '';
    const sound = this.mediaOf(sid), image = this.mediaOf(V.image || T.image), video = this.mediaOf(V.video || T.video);
    const title = this.words(o.text || V.text || T.text, a);
    const msg = this.clean(a.message);
    let tts = null;
    if (T.tts && msg && this.tts && !S.muted) {
      const say = (a.name + ' says: ' + msg).slice(0, S.ttsMax);
      try { tts = await Promise.race([this.tts(say, S.ttsVoice), new Promise((r) => setTimeout(() => r(null), 6000))]); } catch (err) { tts = null; }
      if (!tts) tts = { speak: say };   // no voice on this PC: the overlay tries the browser's own voice
    }
    const al = {
      type: 'ealert', id: 'ea' + (++this.n) + '-' + crypto.randomBytes(3).toString('hex'), at: Date.now(), kind: a.type, label: TYPES[a.type].label,
      look, secs, title, name: a.name, names: a.names || null, amount: a.amount, amt: TYPES[a.type].amt, money: a.money || null, what: a.what || null,
      message: msg, platform: a.platform, tier: a.tier, prime: a.prime, avatar: a.avatar || (a.card && a.card.avatar) || '', card: look === 'card' ? a.card : null,
      sound, vol: T.vol, image, video, videoSound: T.videoSound, tts, ttsVol: S.ttsVol, muted: S.muted, test: !!o.test, variation: V.min != null ? { min: V.min, tier: V.tier } : null
    };
    this.history.unshift(al); if (this.history.length > 30) this.history.pop();
    if (S.paused && !o.test) { this.pending.push(al); this.state(); return { held: true, alert: al }; }
    this.push(al);
    return { ok: true, alert: al };
  }
  flushPending() { const L = this.pending; this.pending = []; for (const a of L) this.push(a); return L.length; }
  pause(on) { return this.set({ paused: on == null ? !this.S().paused : !!on }).paused; }
  mute(on) { return this.set({ muted: on == null ? !this.S().muted : !!on }).muted; }
  skip() { this.push({ type: 'ealertSkip' }); return true; }
  replay(id) {
    const a = id ? this.history.find((x) => x.id === id) : this.history.find((x) => !x.test) || this.history[0];
    if (!a) return { error: 'No alert to replay yet' };
    this.push(Object.assign({}, a, { replay: true, at: Date.now(), muted: this.S().muted })); return { ok: true, alert: a };
  }
  list() { return this.history.map((a) => ({ id: a.id, at: a.at, kind: a.kind, label: a.label, title: a.title, name: a.name, platform: a.platform, test: a.test, look: a.look, variation: a.variation })); }
}
// what an event from a platform becomes
function typeFor(event, platform, e) {
  if (event === 'follow') return 'follow';
  if (event === 'sub') return platform === 'youtube' ? (e.isGift ? 'giftsub' : 'member') : e.isGift ? 'giftsub' : 'sub';
  if (event === 'resub') return platform === 'youtube' ? 'milestone' : 'resub';
  if (event === 'gift') return platform === 'youtube' ? 'giftmember' : 'gift';
  if (event === 'cheer') { if (platform === 'kick') return 'kicks'; if (platform === 'youtube') return /sticker/i.test(e.reason || '') ? 'supersticker' : 'superchat'; return e.powerup ? 'powerup' : 'bits'; }
  if (event === 'raid') return platform === 'kick' ? 'host' : 'raid';
  return null;
}
module.exports = { EAlerts, TYPES, ORDER, LOOKS, settings, typeFor, money };
