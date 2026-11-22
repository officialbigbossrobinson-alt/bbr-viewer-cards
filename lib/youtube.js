// YouTube connection: finds your live stream, reads live chat, Super Chats, Super Stickers,
// new members, member milestones and gifted memberships, and can reply in chat.
// YouTube gives each project 10,000 "quota units" a day: reading chat costs 5 per check
// and posting a message costs 20, so this paces itself to stay inside the limit.
const EventEmitter = require('events');

const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
// rough conversion of Super Chat currencies to US dollars (1 USD = 100 bits)
const USD = {
  USD: 1, GBP: 1.27, EUR: 1.08, CAD: 0.73, AUD: 0.66, NZD: 0.6, CHF: 1.13, SEK: 0.095, NOK: 0.093, DKK: 0.145,
  PLN: 0.25, CZK: 0.043, HUF: 0.0027, RON: 0.22, JPY: 0.0067, KRW: 0.00073, INR: 0.012, BRL: 0.18, MXN: 0.055,
  ARS: 0.001, CLP: 0.001, COP: 0.00025, PEN: 0.27, PHP: 0.017, IDR: 0.000063, MYR: 0.22, SGD: 0.74, HKD: 0.128,
  TWD: 0.031, THB: 0.028, VND: 0.00004, ZAR: 0.055, TRY: 0.03, ILS: 0.27, AED: 0.27, SAR: 0.27, RUB: 0.011, UAH: 0.024
};

// YouTube's quota day resets at midnight Pacific time
const quotaDay = () => new Date(Date.now() - 8 * 3600000).toISOString().slice(0, 10);

class YouTube extends EventEmitter {
  constructor(cfg, saveCfg, port) {
    super();
    this.cfg = cfg;
    this.saveCfg = saveCfg;
    this.redirect = 'http://localhost:' + port + '/auth/youtube/callback';
    this.user = null;
    this.connected = false;
    this.live = false;
    this.streamId = null;
    this.chatId = null;
    this.pageToken = null;
    this.startedAt = 0;
    this.lastError = null;
    this.timer = null;
  }

  configured() { return !!(this.cfg.ytClientId && this.cfg.ytClientSecret); }

  quota(add) {
    const q = this.cfg.ytQuota && this.cfg.ytQuota.day === quotaDay() ? this.cfg.ytQuota : { day: quotaDay(), used: 0 };
    if (add) { q.used += add; this.cfg.ytQuota = q; }
    return q.used;
  }
  budget() { return Number(this.cfg.ytQuotaBudget) || 9500; }

  authUrl(state) {
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: this.cfg.ytClientId, redirect_uri: this.redirect, response_type: 'code', scope: SCOPE,
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state
    });
  }

  async tokenRequest(params) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.assign({ client_id: this.cfg.ytClientId, client_secret: this.cfg.ytClientSecret }, params))
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || ('YouTube login failed (' + r.status + ')'));
    const prev = this.cfg.ytTokens || {};
    this.cfg.ytTokens = { access: j.access_token, refresh: j.refresh_token || prev.refresh, expiresAt: Date.now() + ((j.expires_in || 3600) - 120) * 1000 };
    this.saveCfg();
  }

  exchange(code) { return this.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: this.redirect }); }

  async token() {
    const t = this.cfg.ytTokens;
    if (!t) throw new Error('YouTube not connected');
    if (Date.now() > t.expiresAt) {
      try { await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh }); }
      catch (e) { this.cfg.ytTokens = null; this.saveCfg(); this.connected = false; throw new Error('YouTube login expired. Click "Connect YouTube" again.'); }
    }
    return this.cfg.ytTokens.access;
  }

  async api(method, p, body, cost) {
    const tok = await this.token();
    this.quota(cost || 1);
    const r = await fetch('https://www.googleapis.com/youtube/v3' + p, {
      method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const t = await r.text();
    let j = {};
    try { j = t ? JSON.parse(t) : {}; } catch (e) { /* not json */ }
    if (!r.ok) {
      const reason = j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason;
      const err = new Error('YouTube ' + p.split('?')[0] + ' → ' + r.status + ' ' + ((j.error && j.error.message) || t).slice(0, 200));
      err.reason = reason;
      throw err;
    }
    return j;
  }

  async start() {
    this.stop();
    if (!this.configured() || !this.cfg.ytTokens) return;
    try {
      const c = await this.api('GET', '/channels?part=snippet&mine=true');
      const ch = (c.items || [])[0];
      if (!ch) throw new Error('No YouTube channel found on this Google account.');
      this.user = { id: ch.id, title: ch.snippet.title };
      this.connected = true;
      this.lastError = null;
      console.log('[youtube] connected as', this.user.title);
      this.findLive();
    } catch (e) {
      this.lastError = e.message;
      console.error('[youtube]', e.message);
      if (this.cfg.ytTokens) this.timer = setTimeout(() => this.start(), 120000);
    }
  }

  stop() { clearTimeout(this.timer); this.connected = false; }

  // concurrent viewers on the live broadcast (1 quota unit)
  async viewerCount() {
    if (!this.live || !this.streamId || this.quota() >= this.budget()) return null;
    const j = await this.api('GET', '/videos?part=liveStreamingDetails&id=' + encodeURIComponent(this.streamId.replace(/^yt-/, '')));
    const d = (j.items || [])[0]; return d && d.liveStreamingDetails && d.liveStreamingDetails.concurrentViewers != null ? +d.liveStreamingDetails.concurrentViewers : null;
  }
  async findLive() {
    clearTimeout(this.timer);
    try {
      if (this.quota() < this.budget()) {
        const j = await this.api('GET', '/liveBroadcasts?part=snippet&broadcastStatus=active&broadcastType=all&maxResults=5');
        const b = (j.items || []).find((x) => x.snippet && x.snippet.liveChatId);
        if (b) {
          const fresh = this.streamId !== 'yt-' + b.id;
          this.live = true;
          this.streamId = 'yt-' + b.id;
          this.chatId = b.snippet.liveChatId;
          if (fresh) { this.pageToken = null; this.startedAt = Date.now(); this.emit('online'); }
          return this.pollChat();
        }
      }
      if (this.live) { this.live = false; this.chatId = null; this.emit('offline'); }
    } catch (e) { this.lastError = e.message; }
    this.timer = setTimeout(() => this.findLive(), 120000);
  }

  async pollChat() {
    clearTimeout(this.timer);
    if (!this.chatId) return this.findLive();
    if (this.quota() + 5 > this.budget()) {
      this.lastError = 'Daily YouTube quota used up. Chat tracking resumes after midnight Pacific time.';
      this.timer = setTimeout(() => this.pollChat(), 600000);
      return;
    }
    let wait = 8000;
    try {
      const j = await this.api('GET', '/liveChat/messages?liveChatId=' + encodeURIComponent(this.chatId) + '&part=snippet,authorDetails&maxResults=2000' +
        (this.pageToken ? '&pageToken=' + encodeURIComponent(this.pageToken) : ''), null, 5);
      const first = !this.pageToken;
      this.pageToken = j.nextPageToken;
      for (const it of j.items || []) {
        // skip the backlog that was already in chat before the app connected
        if (first && Date.parse(it.snippet.publishedAt) < this.startedAt - 5000) continue;
        try { this.handle(it); } catch (e) { console.error('[youtube] event error', e.message); }
      }
      // read quickly while chat is busy, slower when it's quiet, and slower again when the day's allowance runs low
      const base = Math.max(j.pollingIntervalMillis || 5000, (Number(this.cfg.ytPollSecs) || 7) * 1000);
      this.quiet = (j.items || []).length ? 0 : Math.min(6, (this.quiet || 0) + 1);
      wait = base + this.quiet * 2000 + (this.quota() > this.budget() * 0.7 ? 8000 : 0);
      this.lastError = null;
    } catch (e) {
      if (['liveChatEnded', 'liveChatNotFound', 'liveChatDisabled', 'forbidden'].includes(e.reason)) {
        this.chatId = null;
        return this.findLive();
      }
      this.lastError = e.message;
      wait = 30000;
    }
    this.timer = setTimeout(() => this.pollChat(), wait);
  }

  handle(it) {
    const s = it.snippet || {}, a = it.authorDetails || {};
    const login = a.channelId, display = a.displayName;
    if (!login) return;
    const avatar = a.profileImageUrl || null;
    const badges = [];
    if (a.isChatOwner) badges.push('broadcaster');
    if (a.isChatModerator) badges.push('moderator');
    if (a.isChatSponsor) badges.push('subscriber');
    const base = { login, display, avatar };
    const money = (d) => {
      const usd = (Number(d.amountMicros) || 0) / 1e6 * (USD[d.currency] || 0);
      return { bits: Math.round(usd * 100), label: d.amountDisplayString || '' };
    };
    switch (s.type) {
      case 'textMessageEvent':
        return this.emit('chat', Object.assign({ text: s.displayMessage || (s.textMessageDetails && s.textMessageDetails.messageText) || '', badges }, base));
      case 'superChatEvent': {
        const d = s.superChatDetails || {};
        const m = money(d);
        return this.emit('cheer', Object.assign({ bits: m.bits || 100, text: d.userComment || '', reason: 'Super Chat ' + m.label }, base));
      }
      case 'superStickerEvent': {
        const m = money(s.superStickerDetails || {});
        return this.emit('cheer', Object.assign({ bits: m.bits || 100, text: '', reason: 'Super Sticker ' + m.label }, base));
      }
      case 'newSponsorEvent':
        return this.emit('sub', Object.assign({ isGift: false, label: 'Became a member' }, base));
      case 'memberMilestoneChatEvent':
        return this.emit('resub', Object.assign({ months: (s.memberMilestoneChatDetails && s.memberMilestoneChatDetails.memberMonth) || 1, label: 'Member' }, base));
      case 'membershipGiftingEvent':
        return this.emit('gift', Object.assign({ total: (s.membershipGiftingDetails && s.membershipGiftingDetails.giftMembershipsCount) || 1 }, base));
      case 'giftMembershipReceivedEvent':
        return this.emit('sub', Object.assign({ isGift: true }, base));
    }
  }

  canSay() { return !!(this.connected && this.chatId); }
  // a chat reply costs about 50 quota units (reading chat costs 5), so ordinary replies stop
  // once 60% of the day's allowance is used; important ones (link codes) keep going
  async say(message, important) {
    if (!this.canSay() || this.quota() + 50 > this.budget()) return;
    if (!important && this.quota() > this.budget() * 0.6) return;
    try {
      await this.api('POST', '/liveChat/messages?part=snippet', {
        snippet: { liveChatId: this.chatId, type: 'textMessageEvent', textMessageDetails: { messageText: message.slice(0, 190) } }
      }, 50);
    } catch (e) { console.error('[youtube] chat reply failed:', e.message); }
  }
}

module.exports = YouTube;
