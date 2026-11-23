// Twitch connection: login, live events (EventSub WebSocket), chatters list, chat replies.
const EventEmitter = require('events');

const SCOPES = [
  'moderator:read:followers', 'channel:read:subscriptions', 'bits:read',
  'moderator:read:chatters', 'user:read:chat', 'user:write:chat', 'user:read:whispers', 'channel:read:redemptions', 'channel:manage:broadcast', 'channel:manage:predictions',
  'clips:edit', 'channel:manage:clips'   // one-tap Twitch clips (make + download): how every replay is made
].join(' ');

const tierNo = (t) => (String(t) === '3000' ? 3 : String(t) === '2000' ? 2 : 1);

class Twitch extends EventEmitter {
  constructor(cfg, saveCfg, port) {
    super();
    this.cfg = cfg;
    this.saveCfg = saveCfg;
    this.redirect = 'http://localhost:' + port + '/auth/twitch/callback';
    this.user = null;
    this.connected = false;
    this.live = false;
    this.streamId = null;
    this.lastError = null;
    this.ws = null;
  }

  // does the saved login include these permissions? (older logins don't have the clip ones)
  hasScopes(list) { const s = (this.cfg.twitchTokens && this.cfg.twitchTokens.scope) || []; return list.every((x) => s.includes(x)); }

  configured() { return !!(this.cfg.twitchClientId && this.cfg.twitchClientSecret); }

  authUrl(state) {
    return 'https://id.twitch.tv/oauth2/authorize?' + new URLSearchParams({
      client_id: this.cfg.twitchClientId, redirect_uri: this.redirect,
      response_type: 'code', scope: SCOPES, state, force_verify: 'true'
    });
  }

  async tokenRequest(params) {
    const r = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams(Object.assign({
        client_id: this.cfg.twitchClientId, client_secret: this.cfg.twitchClientSecret
      }, params))
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || ('Twitch login failed (' + r.status + ')'));
    this.cfg.twitchTokens = {
      access: j.access_token, refresh: j.refresh_token, scope: Array.isArray(j.scope) ? j.scope : (this.cfg.twitchTokens && this.cfg.twitchTokens.scope) || null,
      expiresAt: Date.now() + ((j.expires_in || 3600) - 120) * 1000
    };
    this.saveCfg();
  }

  exchange(code) {
    return this.tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: this.redirect });
  }

  async refresh() {
    const t = this.cfg.twitchTokens;
    if (!t || !t.refresh) throw new Error('Twitch not connected');
    try {
      await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh });
    } catch (e) {
      this.cfg.twitchTokens = null;
      this.saveCfg();
      this.connected = false;
      throw new Error('Twitch login expired. Click "Connect Twitch" again.');
    }
  }

  async token() {
    const t = this.cfg.twitchTokens;
    if (!t) throw new Error('Twitch not connected');
    if (Date.now() > t.expiresAt) await this.refresh();
    return this.cfg.twitchTokens.access;
  }

  async api(method, p, body, retried) {
    const tok = await this.token();
    const r = await fetch((process.env.BBR_TWITCH_API || 'https://api.twitch.tv/helix') + p, {   // (the env var points tests at a stand-in Twitch)
      method,
      headers: { 'Client-Id': this.cfg.twitchClientId, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (r.status === 401 && !retried) { await this.refresh(); return this.api(method, p, body, true); }
    const txt = await r.text();
    let j = {};
    try { j = txt ? JSON.parse(txt) : {}; } catch (e) { /* not json */ }
    if (!r.ok) throw new Error(method + ' ' + p.split('?')[0] + ' → ' + r.status + ' ' + (j.message || txt));
    return j;
  }

  // every channel point reward on the channel (title, cost, enabled)
  async rewards() {
    if (!this.user) throw new Error('Twitch not connected');
    const j = await this.api('GET', '/channel_points/custom_rewards?broadcaster_id=' + this.user.id);
    return (j.data || []).map((r) => ({ title: r.title, cost: r.cost, enabled: r.is_enabled, kind: 'points' }));
  }
  // a stream marker (shows up in your Twitch video producer, handy for clips)
  async marker(desc) {
    if (!this.user) throw new Error('Twitch not connected');
    const j = await this.api('POST', '/streams/markers', { user_id: this.user.id, description: String(desc || 'BBR moment').slice(0, 140) });
    return (j.data || [])[0] || null;
  }
  // your next scheduled stream (Twitch schedule)
  // how many people are watching right now (null when offline)
  async viewerCount() { if (!this.user) return null; const j = await this.api('GET', '/streams?user_id=' + this.user.id); const d = (j.data || [])[0]; return d ? d.viewer_count || 0 : null; }
  async nextStream() {
    if (!this.user) return null;
    try { const j = await this.api('GET', '/schedule?broadcaster_id=' + this.user.id + '&first=3'); const seg = ((j.data || {}).segments || []).find((x) => !x.canceled_until && new Date(x.start_time) > new Date()); return seg ? { at: seg.start_time, title: seg.title || '' } : null; } catch (e) { return null; }
  }
  // channel points predictions (affiliates / partners)
  async predictionStart(title, outcomes, secs) {
    const j = await this.api('POST', '/predictions', { broadcaster_id: this.user.id, title: String(title).slice(0, 45), outcomes: outcomes.map((t) => ({ title: String(t).slice(0, 25) })), prediction_window: Math.max(30, Math.min(1800, secs || 60)) });
    return (j.data || [])[0] || null;
  }
  async predictionEnd(id, winningOutcomeId, cancel) {
    return this.api('PATCH', '/predictions', Object.assign({ broadcaster_id: this.user.id, id, status: cancel ? 'CANCELED' : 'RESOLVED' }, cancel ? {} : { winning_outcome_id: winningOutcomeId }));
  }
  // the channel's all-time bits leaderboard (Twitch keeps the top 100)
  async bitsLeaderboard() {
    const j = await this.api('GET', '/bits/leaderboard?count=100&period=all');
    return (j.data || []).map((x) => ({ login: x.user_login, display: x.user_name, bits: x.score }));
  }

  async start() {
    if (!this.configured() || !this.cfg.twitchTokens) return;
    try {
      const u = await this.api('GET', '/users');
      this.user = u.data[0];
      const s = await this.api('GET', '/streams?user_id=' + this.user.id);
      this.live = s.data.length > 0;
      this.streamId = this.live ? s.data[0].id : null;
      this.lastError = null;
      this.connectWs();
    } catch (e) {
      this.lastError = e.message;
      console.error('[twitch]', e.message);
      if (this.cfg.twitchTokens) setTimeout(() => this.start(), 30000);
    }
  }

  stop() {
    if (this.ws) { this.ws.replaced = true; try { this.ws.close(); } catch (e) { /* ignore */ } }
    this.ws = null;
    this.connected = false;
  }

  connectWs(url, isReconnect) {
    const ws = new WebSocket(url || 'wss://eventsub.wss.twitch.tv/ws');
    const prev = this.ws;
    this.ws = ws;
    let keepalive = null;
    const resetKeepalive = (secs) => {
      clearTimeout(keepalive);
      ws.kaSecs = secs || ws.kaSecs || 10;
      keepalive = setTimeout(() => { try { ws.close(); } catch (e) { /* ignore */ } }, (ws.kaSecs + 10) * 1000);
    };
    ws.onmessage = async (m) => {
      let msg;
      try { msg = JSON.parse(m.data); } catch (e) { return; }
      const type = msg.metadata && msg.metadata.message_type;
      if (type === 'session_welcome') {
        this.sessionId = msg.payload.session.id;
        resetKeepalive(msg.payload.session.keepalive_timeout_seconds);
        if (prev && isReconnect) { prev.replaced = true; try { prev.close(); } catch (e) { /* ignore */ } }
        if (!isReconnect) await this.subscribeAll();
        this.connected = true;
        console.log('[twitch] connected as', this.user.login);
      } else if (type === 'session_keepalive') {
        resetKeepalive();
      } else if (type === 'notification') {
        resetKeepalive();
        // Twitch can resend a message (reconnects): handle each one once
        const mid = msg.metadata.message_id; this.seenMsg = this.seenMsg || new Map();
        if (mid) { if (this.seenMsg.has(mid)) return; this.seenMsg.set(mid, Date.now()); if (this.seenMsg.size > 500) this.seenMsg.delete(this.seenMsg.keys().next().value); }
        try { this.handle(msg.metadata.subscription_type, msg.payload.event); } catch (e) { console.error('[twitch] event error', e); }
      } else if (type === 'session_reconnect') {
        this.connectWs(msg.payload.session.reconnect_url, true);
      } else if (type === 'revocation') {
        console.warn('[twitch] subscription revoked:', msg.payload.subscription.type);
      }
    };
    ws.onclose = () => {
      clearTimeout(keepalive);
      if (ws.replaced) return;
      this.connected = false;
      console.warn('[twitch] disconnected, retrying in 5s');
      setTimeout(() => { if (this.ws === ws) this.connectWs(); }, 5000);
    };
    ws.onerror = () => { /* onclose handles it */ };
  }

  async subscribeAll() {
    const b = this.user.id;
    const subs = [
      ['channel.follow', '2', { broadcaster_user_id: b, moderator_user_id: b }],
      ['channel.subscribe', '1', { broadcaster_user_id: b }],
      ['channel.subscription.message', '1', { broadcaster_user_id: b }],
      ['channel.subscription.gift', '1', { broadcaster_user_id: b }],
      ['channel.cheer', '1', { broadcaster_user_id: b }],
      ['channel.raid', '1', { to_broadcaster_user_id: b }],
      ['channel.chat.message', '1', { broadcaster_user_id: b, user_id: b }],
      ['channel.chat.notification', '1', { broadcaster_user_id: b, user_id: b }],
      // v38: someone's messages were cleared = they were banned or timed out (no new login permission needed)
      ['channel.chat.clear_user_messages', '1', { broadcaster_user_id: b, user_id: b }],
      ['channel.channel_points_custom_reward_redemption.add', '1', { broadcaster_user_id: b }],
      // every Bits use, including Power-ups (Gigantify, message effects, celebrations, custom Power-ups) and combos
      ['channel.bits.use', '1', { broadcaster_user_id: b }],
      ['channel.custom_power_up_redemption.add', '1', { broadcaster_user_id: b }],
      ['stream.online', '1', { broadcaster_user_id: b }],
      ['stream.offline', '1', { broadcaster_user_id: b }],
      ['user.whisper.message', '1', { user_id: b }]
    ];
    for (const [type, version, condition] of subs) {
      try {
        await this.api('POST', '/eventsub/subscriptions', {
          type, version, condition, transport: { method: 'websocket', session_id: this.sessionId }
        });
      } catch (e) {
        console.error('[twitch] could not listen for', type, '-', e.message);
        (this.cantListen = this.cantListen || new Set()).add(type);
      }
    }
  }

  // A custom Power-up arrives twice from Twitch (as a Bits use AND as a Power-up redemption).
  // Count it once: the same person + same Power-up within 20 seconds is the same purchase.
  powerupOnce(x, src) {
    // src: 'bits' or 'redeem'. One purchase = one of each. A repeat from the same source is a second purchase.
    const k = String(x.login || '').toLowerCase() + '|' + String(x.title || '').trim().toLowerCase(), now = Date.now();
    this.puSeen = this.puSeen || new Map();
    for (const [kk, v] of this.puSeen) if (now - v.at > 20000) this.puSeen.delete(kk);
    const prev = this.puSeen.get(k);
    if (prev && prev.waiting.includes(src)) { prev.waiting = prev.waiting.filter((w) => w !== src); if (!prev.waiting.length) this.puSeen.delete(k); return; }
    this.puSeen.set(k, { at: now, waiting: x.custom ? [src === 'bits' ? 'redeem' : 'bits'] : [] });
    return this.emit('powerup', x);
  }
  handle(type, e) {
    switch (type) {
      case 'channel.follow':
        return this.emit('follow', { login: e.user_login, display: e.user_name, at: Date.parse(e.followed_at) || Date.now() });
      case 'channel.subscribe':
        return this.emit('sub', { login: e.user_login, display: e.user_name, isGift: !!e.is_gift, tier: tierNo(e.tier) });
      case 'channel.subscription.message':
        return this.emit('resub', { login: e.user_login, display: e.user_name, months: e.cumulative_months || 1, tier: tierNo(e.tier) });
      case 'channel.chat.notification': {
        // the only place Twitch says whether a sub is Prime
        const x = e.sub || e.resub;
        if (!x || !e.chatter_user_login) return;
        return this.emit('subinfo', { login: e.chatter_user_login, display: e.chatter_user_name, tier: tierNo(x.sub_tier), prime: !!x.is_prime, gifted: !!x.is_gift });
      }
      case 'channel.subscription.gift':
        // v35: anonymous gifts still count (earnings, stream stats, giveaway meter): they just don't get a card
        if (e.is_anonymous || !e.user_login) return this.emit('gift', { anonymous: true, login: 'ananonymousgifter', display: 'An anonymous gifter', total: e.total || 1, tier: tierNo(e.tier) });
        return this.emit('gift', { login: e.user_login, display: e.user_name, total: e.total || 1, tier: tierNo(e.tier), cumulative: e.cumulative_total != null ? +e.cumulative_total : null });
      case 'channel.cheer':
        if (e.is_anonymous || !e.user_login) return this.emit('cheer', { anonymous: true, login: 'ananonymouscheerer', display: 'An anonymous cheerer', bits: e.bits || 0, text: e.message || '' });
        return this.emit('cheer', { login: e.user_login, display: e.user_name, bits: e.bits || 0, text: e.message || '' });
      case 'channel.channel_points_custom_reward_redemption.add':
        return this.emit('redeem', { login: e.user_login, display: e.user_name, reward: (e.reward && e.reward.title) || '', input: e.user_input || '' });
      case 'channel.bits.use': {
        // plain cheers already arrive through channel.cheer, so only Power-ups and combos are counted here
        if (!e.user_login || e.type === 'cheer') return;
        const cp = e.custom_power_up || null, pu = e.power_up || null;
        const title = (cp && (cp.title || cp.name)) || (pu && ({ message_effect: 'Message effect', celebration: 'On-screen celebration', gigantify_an_emote: 'Gigantify an emote' }[pu.type] || pu.type)) || (e.type === 'combo' ? 'Combo' : 'Power-up');
        this.emit('cheer', { login: e.user_login, display: e.user_name, bits: e.bits || 0, text: '', reason: 'Power-up: ' + title + ' (' + (e.bits || 0) + ' Bits)', powerup: true });
        return this.powerupOnce({ login: e.user_login, display: e.user_name, title, bits: e.bits || 0, custom: !!cp }, 'bits');
      }
      case 'channel.custom_power_up_redemption.add': {
        const t = (e.custom_power_up && (e.custom_power_up.title || e.custom_power_up.name)) || (e.reward && e.reward.title) || e.title || 'Custom Power-up';
        return this.powerupOnce({ login: e.user_login, display: e.user_name, title: t, bits: 0, custom: true }, 'redeem');
      }
      case 'channel.raid':
        return this.emit('raid', { login: e.from_broadcaster_user_login, display: e.from_broadcaster_user_name, viewers: e.viewers || 0 });
      case 'channel.chat.message':
        return this.emit('chat', {
          login: e.chatter_user_login, display: e.chatter_user_name,
          text: (e.message && e.message.text) || '', badges: (e.badges || []).map((x) => x.set_id)
        });
      case 'channel.chat.clear_user_messages':
        if (!e.target_user_login) return;
        return this.emit('ban', { login: e.target_user_login, display: e.target_user_name, either: true });
      case 'user.whisper.message':
        return this.emit('whisper', { login: e.from_user_login, display: e.from_user_name, text: (e.whisper && e.whisper.text) || '' });
      case 'stream.online':
        this.live = true; this.streamId = e.id; return this.emit('online');
      case 'stream.offline':
        this.live = false; this.streamId = null; return this.emit('offline');
    }
  }

  async chatters() {
    const id = this.user.id;
    const out = [];
    let cursor = null;
    do {
      const j = await this.api('GET', '/chat/chatters?broadcaster_id=' + id + '&moderator_id=' + id + '&first=1000' + (cursor ? '&after=' + cursor : ''));
      for (const c of j.data) out.push({ login: c.user_login, display: c.user_name });
      cursor = j.pagination && j.pagination.cursor;
    } while (cursor);
    return out;
  }

  async say(message) {
    if (!this.user || !this.connected) return;
    try {
      const j = await this.api('POST', '/chat/messages', { broadcaster_id: this.user.id, sender_id: this.user.id, message: message.slice(0, 490) });
      const d = j && j.data && j.data[0];
      if (d && d.is_sent === false) {
        const why = (d.drop_reason && (d.drop_reason.message || d.drop_reason.code)) || 'no reason given';
        this.lastDrop = { at: Date.now(), why, message: message.slice(0, 120) };
        console.error('[twitch] chat reply was not sent:', why);
      }
    } catch (e) { this.lastDrop = { at: Date.now(), why: e.message, message: message.slice(0, 120) }; console.error('[twitch] chat reply failed:', e.message); }
  }

  async pages(pathBase) {
    const out = [];
    let cursor = null;
    do {
      const j = await this.api('GET', pathBase + (cursor ? '&after=' + cursor : ''));
      out.push(...j.data);
      cursor = j.pagination && j.pagination.cursor;
    } while (cursor && out.length < 50000);
    return out;
  }

  followers() { return this.pages('/channels/followers?broadcaster_id=' + this.user.id + '&first=100'); }
  subscriptions() { return this.pages('/subscriptions?broadcaster_id=' + this.user.id + '&first=100'); }
  async bitsLeaders() { return (await this.api('GET', '/bits/leaderboard?count=100&period=all')).data; }

  // up to 100 logins per call -> { login: url }
  async avatars(logins) {
    const out = {};
    for (let i = 0; i < logins.length; i += 100) {
      const q = logins.slice(i, i + 100).map((l) => 'login=' + encodeURIComponent(l)).join('&');
      try {
        const j = await this.api('GET', '/users?' + q);
        for (const u of j.data || []) out[u.login.toLowerCase()] = u.profile_image_url || null;
      } catch (e) { /* try again next round */ }
    }
    return out;
  }

  async avatar(login) {
    try {
      const j = await this.api('GET', '/users?login=' + encodeURIComponent(login));
      return (j.data[0] && j.data[0].profile_image_url) || null;
    } catch (e) { return null; }
  }
}

module.exports = Twitch;
