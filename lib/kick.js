// Kick connection.
//  * Reading chat, subs, gifted subs, Kicks, hosts and follows: Kick's realtime feed
//    (Centrifugo, the same feed kick.com uses since Oct 2026). Needs no login.
//  * Replying in chat and live/category detection: Kick's official API (optional login).
// Kick's realtime feed is undocumented and can change; anything unrecognised is written
// to data/kick-events.log so it can be fixed quickly.
const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const WEB_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json', Origin: 'https://kick.com', Referer: 'https://kick.com/', 'User-Agent': UA };
const SCOPES = 'user:read channel:read chat:write';

// finds the first value for any of the keys, anywhere in a nested object
function dig(obj, keys, depth) {
  if (!obj || typeof obj !== 'object' || (depth || 0) > 4) return undefined;
  for (const k of keys) if (obj[k] != null && typeof obj[k] !== 'object') return obj[k];
  for (const v of Object.values(obj)) {
    const r = dig(v, keys, (depth || 0) + 1);
    if (r != null) return r;
  }
  return undefined;
}

class Kick extends EventEmitter {
  constructor(cfg, saveCfg, port, dataDir) {
    super();
    this.cfg = cfg;
    this.saveCfg = saveCfg;
    this.redirect = 'http://localhost:' + port + '/auth/kick/callback';
    this.logFile = path.join(dataDir, 'kick-events.log');
    this.logged = new Set();
    this.ws = null;
    this.connected = false;
    this.lastError = null;
    this.live = false;
    this.streamId = null;
    this.game = null;
    this.user = null;          // official API login (optional)
    this.pkce = null;
  }

  configured() { return !!(this.cfg.kickSlug || this.cfg.kickChatroomId); }
  apiConfigured() { return !!(this.cfg.kickClientId && this.cfg.kickClientSecret); }

  log(name, data) {
    if (this.logged.has(name)) return;
    this.logged.add(name);
    try {
      fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
      fs.appendFileSync(this.logFile, new Date().toISOString() + ' ' + name + ' ' + JSON.stringify(data).slice(0, 4000) + '\n');
    } catch (e) { /* ignore */ }
  }

  // ---------- reading: realtime feed ----------
  async lookup() {
    const r = await fetch('https://kick.com/api/v2/channels/' + encodeURIComponent(this.cfg.kickSlug), { headers: { Accept: 'application/json', 'User-Agent': UA } });
    if (!r.ok) throw new Error('Kick blocked the channel lookup (' + r.status + '). Enter your Chatroom ID and Channel ID on the dashboard.');
    const j = await r.json();
    this.cfg.kickChatroomId = String(j.chatroom.id);
    this.cfg.kickChannelId = String(j.id);
    this.saveCfg();
    if (j.livestream && j.livestream.is_live) { this.live = true; this.streamId = 'kick-' + j.livestream.id; }
  }

  // viewers right now (Kick's public channel page; null if blocked or offline)
  async viewerCount() {
    if (!this.cfg.kickSlug) return null;
    const r = await fetch('https://kick.com/api/v2/channels/' + encodeURIComponent(this.cfg.kickSlug), { headers: { Accept: 'application/json', 'User-Agent': UA } });
    if (!r.ok) return null;
    const j = await r.json(); return j.livestream && j.livestream.is_live ? j.livestream.viewer_count || 0 : null;
  }

  // Kick's realtime handshake (Oct 2026):
  //  1. POST /realtime/connection with a client id → which provider + websocket URL to use
  //  2. POST /realtime/auth/connection with { client_id } → { data: { token } }
  async realtime() {
    const base = 'https://web.kick.com/api/v1/realtime';
    const post = async (url, body) => {
      const r = await fetch(url, { method: 'POST', headers: WEB_HEADERS, body: JSON.stringify(body) });
      const t = await r.text();
      let j = {};
      try { j = t ? JSON.parse(t) : {}; } catch (e) { /* not json */ }
      if (!r.ok) { this.log('realtime-' + r.status, { url, body: t.slice(0, 500) }); throw new Error('Kick realtime ' + r.status + ' at ' + url.replace(base, '') + (j.message ? ' (' + j.message + ')' : '')); }
      return j;
    };
    this.clientId = this.clientId || crypto.randomUUID();
    const client = { id: this.clientId, type: 'web' };
    const accepted = [{ provider: 'centrifugo' }, { provider: 'pusher' }];
    const desc = await post(base + '/connection', { client, capabilities: { accepted_providers: accepted } });
    const conns = (desc.data && desc.data.connections) || desc.connections || [];
    // a chatroom-specific endpoint can point at a different region
    let room = null;
    try {
      const rd = await post(base + '/channels/' + this.cfg.kickChatroomId + '/chat/connection', { client, capabilities: { accepted_providers: accepted } });
      room = ((rd.data && rd.data.connections) || rd.connections || [])[0] || null;
    } catch (e) { /* use the general endpoint */ }
    const pickConn = (list) => list.find((c) => c.provider === 'centrifugo') || list.find((c) => c.provider === 'pusher');
    const conn = (room && room.provider ? room : null) || pickConn(conns);
    if (!conn) { this.log('realtime-descriptor', desc); throw new Error('Kick realtime: no supported connection offered'); }
    const cred = conn.credentials || {};
    if (conn.provider === 'pusher') {
      const key = cred.app_key, cluster = cred.cluster || 'us2';
      if (!key) throw new Error('Kick realtime: pusher details missing');
      return { provider: 'pusher', url: 'wss://ws-' + cluster + '.pusher.com/app/' + key + '?protocol=7&client=js&version=8.4.0&flash=false' };
    }
    const tok = await post(base + '/auth/connection', { client_id: this.clientId });
    const token = (tok.data && tok.data.token) || tok.token || dig(tok, ['token']);
    if (!token) { this.log('auth-response', tok); throw new Error('Kick realtime: no token in response'); }
    let url = cred.url || dig(conn, ['url']) || 'wss://realtime.us-east-1.platform.kick.com/connection/websocket';
    if (!/^wss:\/\/[a-z0-9.-]+\//i.test(url)) url = 'wss://realtime.us-east-1.platform.kick.com/connection/websocket';
    return { provider: 'centrifugo', url, token };
  }

  async start() {
    this.stop();
    if (!this.configured()) return;
    let rt;
    try {
      if (!this.cfg.kickChatroomId) await this.lookup();
      rt = await this.realtime();
    } catch (e) {
      this.lastError = e.message;
      console.error('[kick]', e.message);
      this.retry = setTimeout(() => this.start(), 60000);
      return;
    }
    const ws = new WebSocket(rt.url, { headers: { Origin: 'https://kick.com', 'User-Agent': UA } });
    this.ws = ws;
    let id = 1;
    const send = (o) => { try { ws.send(JSON.stringify(o)); } catch (e) { /* closed */ } };
    const room = this.cfg.kickChatroomId, chan = this.cfg.kickChannelId;
    const channels = ['chatrooms.' + room + '.v2', 'chatroom_' + room, 'chatrooms.' + room];
    if (chan) channels.push('channel_' + chan, 'channel.' + chan);
    if (rt.provider === 'pusher') {
      ws.onopen = () => {
        for (const c of channels) send({ event: 'pusher:subscribe', data: { auth: '', channel: c } });
        this.connected = true; this.lastError = null;
        console.log('[kick] listening to chatroom', room, '(pusher)');
        this.ping = setInterval(() => send({ event: 'pusher:ping', data: {} }), 60000);
      };
      ws.onmessage = (m) => {
        let f; try { f = JSON.parse(m.data); } catch (e) { return; }
        if (f.event === 'pusher:error') { this.lastError = 'Kick realtime error: ' + JSON.stringify(f.data).slice(0, 120); return; }
        if (f.event && !f.event.startsWith('pusher')) this.dispatch({ event: f.event, data: f.data });
      };
      ws.onclose = () => {
        clearInterval(this.ping);
        this.connected = false;
        if (ws.stopped) return;
        this.retry = setTimeout(() => { if (this.ws === ws) this.start(); }, 10000);
      };
      ws.onerror = () => { /* onclose handles it */ };
      return;
    }
    ws.onopen = () => send({ connect: { token: rt.token, name: 'js' }, id: id++ });
    ws.onmessage = (m) => {
      for (const line of String(m.data).split('\n')) {
        if (!line.trim()) continue;
        let f;
        try { f = JSON.parse(line); } catch (e) { continue; }
        if (Object.keys(f).length === 0) { ws.send('{}'); continue; } // ping → pong
        if (f.connect) {
          this.connected = true;
          this.lastError = null;
          for (const c of channels) send({ subscribe: { channel: c }, id: id++ });
          console.log('[kick] listening to chatroom', room);
          // tokens expire; reconnect with a fresh one shortly before
          const ttl = (f.connect.ttl || 2700) * 1000;
          clearTimeout(this.renew);
          this.renew = setTimeout(() => this.start(), Math.max(60000, ttl - 120000));
        } else if (f.error) {
          this.lastError = 'Kick realtime error: ' + (f.error.message || f.error.code);
        } else if (f.push && f.push.pub) {
          this.dispatch(f.push.pub.data);
        }
      }
    };
    ws.onclose = () => {
      this.connected = false;
      if (ws.stopped) return;
      this.retry = setTimeout(() => { if (this.ws === ws) this.start(); }, 10000);
    };
    ws.onerror = () => { /* onclose handles it */ };
  }

  stop() {
    clearTimeout(this.renew); clearTimeout(this.retry); clearInterval(this.ping);
    if (this.ws) { this.ws.stopped = true; try { this.ws.close(); } catch (e) { /* ignore */ } }
    this.ws = null;
    this.connected = false;
  }

  dispatch(raw) {
    let d = raw;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
    if (!d) return;
    const evName = String(d.event || d.name || d.type || '');
    let payload = d.data !== undefined ? d.data : d;
    if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch (e) { payload = {}; } }
    const name = evName.split('\\').pop();
    try { this.handle(name, payload || {}); } catch (e) { console.error('[kick] event error', name, e.message); }
  }

  handle(name, d) {
    switch (name) {
      case 'ChatMessageEvent':
      case 'ChatMessageSentEvent': {
        const s = d.sender || {};
        const badges = ((s.identity && s.identity.badges) || []).map((b) => b.type);
        if (this.cfg.kickSlug && (s.slug === this.cfg.kickSlug)) badges.push('broadcaster');
        return this.emit('chat', { login: s.slug || s.username, display: s.username, text: d.content || '', badges, kickId: s.id });
      }
      case 'SubscriptionEvent':
        return this.emit('resub', { login: d.username, display: d.username, months: d.months || 1 });
      case 'GiftedSubscriptionsEvent': {
        const gifter = d.gifter_username || d.username;
        const list = d.gifted_usernames || [];
        if (gifter) this.emit('gift', { login: gifter, display: gifter, total: list.length || d.quantity || 1 });
        for (const u of list) this.emit('sub', { login: u, display: u, isGift: true });
        return;
      }
      case 'KicksGifted':
      case 'KicksGiftedEvent':
      case 'GiftedKicksEvent': {
        this.log(name, d);
        const sender = (d.sender && (d.sender.username || d.sender.slug)) || (d.user && d.user.username) || d.username || (d.gifter && d.gifter.username);
        const amount = Number((d.gift && (d.gift.amount || d.gift.kicks)) || d.amount || d.kicks || d.gift_amount || d.quantity || 0);
        const text = d.message || (d.gift && d.gift.message) || d.text || '';
        if (!sender || !(amount > 0)) return;
        return this.emit('cheer', { login: sender, display: sender, bits: amount, text, reason: 'Gifted ' + amount + ' Kicks' });
      }
      case 'StreamHostEvent':
        return this.emit('raid', { login: d.host_username, display: d.host_username, viewers: d.number_viewers || 0 });
      case 'FollowersUpdated':
        if (d.followed && d.username) this.emit('follow', { login: d.username, display: d.username, at: Date.now() });
        return;
      case 'StreamerIsLive':
        this.live = true;
        this.streamId = 'kick-' + ((d.livestream && d.livestream.id) || new Date().toISOString().slice(0, 10));
        return this.emit('online');
      case 'StopStreamBroadcast':
        this.live = false; this.streamId = null;
        return this.emit('offline');
      case 'ChatMessageDeletedEvent': case 'PinnedMessageCreatedEvent': case 'PinnedMessageDeletedEvent':
      case 'PollUpdateEvent': case 'UserBannedEvent': case 'UserUnbannedEvent': case 'ChatroomUpdatedEvent':
      case 'LivestreamUpdated': case 'ChatroomClearEvent':
        return;
      default:
        this.log(name || 'unknown', d);
    }
  }

  // ---------- writing + live status: official API (optional) ----------
  authUrl(state) {
    const verifier = crypto.randomBytes(48).toString('base64url');
    this.pkce = verifier;
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return 'https://id.kick.com/oauth/authorize?' + new URLSearchParams({
      response_type: 'code', client_id: this.cfg.kickClientId, redirect_uri: this.redirect, scope: SCOPES,
      code_challenge: challenge, code_challenge_method: 'S256', state
    });
  }

  async tokenRequest(params) {
    const r = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.assign({ client_id: this.cfg.kickClientId, client_secret: this.cfg.kickClientSecret }, params))
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(j.error_description || j.message || ('Kick login failed (' + r.status + ')'));
    this.cfg.kickTokens = { access: j.access_token, refresh: j.refresh_token, expiresAt: Date.now() + ((j.expires_in || 3600) - 120) * 1000 };
    this.saveCfg();
  }

  exchange(code) {
    return this.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: this.redirect, code_verifier: this.pkce || '' });
  }

  async token() {
    const t = this.cfg.kickTokens;
    if (!t) throw new Error('Kick not logged in');
    if (Date.now() > t.expiresAt) {
      try { await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh }); }
      catch (e) { this.cfg.kickTokens = null; this.saveCfg(); this.user = null; throw new Error('Kick login expired. Click "Log in to Kick" again.'); }
    }
    return this.cfg.kickTokens.access;
  }

  async api(method, p, body) {
    const tok = await this.token();
    const r = await fetch('https://api.kick.com/public/v1' + p, {
      method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const t = await r.text();
    let j = {};
    try { j = t ? JSON.parse(t) : {}; } catch (e) { /* not json */ }
    if (!r.ok) throw new Error('Kick API ' + method + ' ' + p.split('?')[0] + ' → ' + r.status + ' ' + (j.message || t).slice(0, 200));
    return j;
  }

  async startApi() {
    clearInterval(this.poll);
    if (!this.apiConfigured() || !this.cfg.kickTokens) return;
    try {
      const u = await this.api('GET', '/users');
      const me = (u.data || [])[0] || {};
      this.user = { id: me.user_id, name: me.name };
      await this.checkLive();
      this.poll = setInterval(() => this.checkLive().catch(() => {}), 60000);
    } catch (e) { this.lastError = e.message; console.error('[kick api]', e.message); }
  }

  async checkLive() {
    const c = await this.api('GET', '/channels');
    const ch = (c.data || [])[0];
    if (!ch) return;
    if (!this.cfg.kickSlug && ch.slug) { this.cfg.kickSlug = ch.slug; this.saveCfg(); }
    const s = ch.stream || {};
    const wasLive = this.live;
    this.live = !!s.is_live;
    this.game = (ch.category && ch.category.name) || this.game;
    if (this.live && !wasLive) { this.streamId = 'kick-' + (s.start_time || new Date().toISOString().slice(0, 10)); this.emit('online'); }
    if (!this.live && wasLive) { this.streamId = null; this.emit('offline'); }
  }

  canSay() { return !!(this.user && this.cfg.kickTokens); }
  async say(message) {
    if (!this.canSay()) return;
    try { await this.api('POST', '/chat', { type: 'user', content: message.slice(0, 480), broadcaster_user_id: this.user.id }); }
    catch (e) { console.error('[kick] chat reply failed:', e.message); }
  }

  async avatar(kickId) {
    if (!kickId || !this.cfg.kickTokens) return null;
    try { const j = await this.api('GET', '/users?id=' + encodeURIComponent(kickId)); return ((j.data || [])[0] || {}).profile_picture || null; }
    catch (e) { return null; }
  }
}

module.exports = Kick;
