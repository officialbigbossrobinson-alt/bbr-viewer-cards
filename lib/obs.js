// OBS control over OBS's built-in WebSocket server (OBS 28+: Tools > WebSocket Server Settings).
// During a battle it shrinks everything in the scene you're on (your "Live" game capture, camera etc.)
// into a box in a corner so the battle has the screen, then puts it all back exactly as it was.
// The BBR overlay itself (and anything you list under "don't move") stays put.
const crypto = require('crypto');
const fs = require('fs');

const sha = (s) => crypto.createHash('sha256').update(s).digest('base64');
const DEFAULTS = { on: false, url: 'ws://127.0.0.1:4455', password: '', corner: 'tr', size: 33, keep: '', margin: 18, animMs: 600, keepAlerts: true, listenAudio: true };
// other alert tools on the stream (their browser sources are found by name or address)
const ALERT_RE = /tangia|streamlabs|alert ?box|streamelements|stream elements|channel ?points|sound ?alerts/i;
const ALERT_URL = /streamlabs\.com|tangia\.co|streamelements\.com|soundalerts\.com/i;
const alertKind = (name, url) => (/tangia/i.test(name + ' ' + url) ? 'tangia' : /streamlabs/i.test(name + ' ' + url) ? 'streamlabs' : 'other');

class OBS {
  constructor(getCfg, restoreFile, log) {
    this.getCfg = getCfg; this.restoreFile = restoreFile; this.log = log || (() => {});
    this.ws = null; this.ready = false; this.pending = new Map(); this.nextId = 1;
    this.error = null; this.version = null; this.cornered = null; this.busy = false;
    this.loud = {}; this.alertList = []; this.meters = false;
    try { this.cornered = JSON.parse(fs.readFileSync(restoreFile, 'utf8')); } catch (e) { /* nothing to restore */ }
  }
  settings() { return Object.assign({}, DEFAULTS, this.getCfg().obs || {}); }

  connect() {
    const S = this.settings();
    if (this.ws) { try { this.ws.close(); } catch (e) { /* ignore */ } }
    this.ready = false;
    if (!S.on) { this.error = null; return Promise.resolve(false); }
    if (typeof WebSocket === 'undefined') { this.error = 'This needs Node.js 22.4 or newer. Update Node from nodejs.org.'; return Promise.resolve(false); }
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok, err) => { if (done) return; done = true; this.error = err || null; resolve(ok); };
      let ws;
      try { ws = new WebSocket(S.url); } catch (e) { return finish(false, 'Bad OBS address: ' + e.message); }
      this.ws = ws;
      const timer = setTimeout(() => finish(false, 'OBS didn\'t answer. Is OBS open with the WebSocket server turned on?'), 6000);
      ws.onerror = () => { clearTimeout(timer); finish(false, 'Can\'t reach OBS at ' + S.url + '. Open OBS and turn on Tools > WebSocket Server Settings > Enable.'); };
      ws.onclose = (ev) => {
        this.ready = false;
        for (const [, p] of this.pending) p.reject(new Error('OBS disconnected'));
        this.pending.clear();
        if (ev && ev.code === 4009) { this.error = 'Wrong OBS WebSocket password.'; }
        clearTimeout(timer); finish(false, this.error || 'OBS closed the connection.');
        // try again in a while (OBS may have been closed)
        if (this.settings().on && ws === this.ws) setTimeout(() => { if (ws === this.ws && !this.ready) this.connect(); }, 30000);
      };
      ws.onmessage = (m) => {
        let msg; try { msg = JSON.parse(m.data); } catch (e) { return; }
        if (msg.op === 0) {   // Hello
          // InputVolumeMeters (1 << 16): lets the app hear when Tangia / Streamlabs are playing something
          // v38: Scenes (1 << 2) too, so a scene change is known at once (Starting Soon starts the moment you switch to it)
          const d = { rpcVersion: 1, eventSubscriptions: (1 << 2) | (S.listenAudio !== false ? (1 << 16) : 0) };
          const a = msg.d && msg.d.authentication;
          if (a) {
            if (!S.password) { clearTimeout(timer); return finish(false, 'OBS wants a password: copy it from Tools > WebSocket Server Settings > Show Connect Info.'); }
            d.authentication = sha(sha(S.password + a.salt) + a.challenge);
          }
          this.version = msg.d && msg.d.obsWebSocketVersion;
          ws.send(JSON.stringify({ op: 1, d }));
        } else if (msg.op === 2) {   // Identified
          this.ready = true; clearTimeout(timer); finish(true); this.urlCache = {};
          this.req('GetCurrentProgramScene').then((c) => { const sc = c.sceneName || c.currentProgramSceneName; if (sc) this.program(sc); }).catch(() => {});
          if (this.cornered) this.restore().catch(() => {});   // the app was closed mid-battle last time
        } else if (msg.op === 5) {   // Event
          if (msg.d && msg.d.eventType === 'CurrentProgramSceneChanged') { const sc = msg.d.eventData && msg.d.eventData.sceneName; if (sc) this.program(sc); }
          else if (msg.d && (msg.d.eventType === 'InputSettingsChanged' || msg.d.eventType === 'InputNameChanged' || msg.d.eventType === 'SceneItemCreated' || msg.d.eventType === 'SceneItemRemoved')) { this.urlCache = {}; this.withCache = null; }
          if (msg.d && msg.d.eventType === 'InputVolumeMeters') {
            this.meters = true;
            const now = Date.now();
            for (const inp of (msg.d.eventData && msg.d.eventData.inputs) || []) {
              let peak = 0; for (const ch of inp.inputLevelsMul || []) peak = Math.max(peak, ch[1] || 0);
              if (peak > 0.015) this.loud[inp.inputName] = now;
            }
          }
        } else if (msg.op === 7) {   // RequestResponse
          const p = this.pending.get(msg.d.requestId); if (!p) return;
          this.pending.delete(msg.d.requestId);
          if (msg.d.requestStatus && msg.d.requestStatus.result) p.resolve(msg.d.responseData || {});
          else p.reject(new Error((msg.d.requestStatus && msg.d.requestStatus.comment) || msg.d.requestType + ' failed'));
        }
      };
    });
  }
  req(type, data) {
    if (!this.ready || !this.ws) return Promise.reject(new Error('Not connected to OBS'));
    const id = 'r' + (this.nextId++);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: id, requestData: data || {} } }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(type + ' timed out')); } }, 5000);
    });
  }
  async ensure() { if (!this.ready) await this.connect(); if (!this.ready) throw new Error(this.error || 'Not connected to OBS'); }

  status() { const S = this.settings(); return { on: S.on, connected: this.ready, error: this.error, version: this.version, cornered: !!this.cornered, scene: this.cornered ? this.cornered.scene : null }; }

  // items in the scene that should move: everything except the BBR overlay and the "don't move" list
  async movable(scene) {
    const S = this.settings();
    const keep = String(S.keep || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    const { sceneItems } = await this.req('GetSceneItemList', { sceneName: scene });
    const out = [];
    for (const it of sceneItems || []) {
      if (!it.sceneItemEnabled) continue;
      if (keep.includes(String(it.sourceName).toLowerCase())) continue;
      if (S.keepAlerts !== false && this.alertList.some((a) => a.name === it.sourceName)) continue;   // Tangia / Streamlabs stay full size
      if (it.inputKind === 'browser_source') {
        try { const s = await this.req('GetInputSettings', { inputName: it.sourceName }); if (/\/overlay|localhost:\d+|127\.0\.0\.1:\d+/.test(String((s.inputSettings || {}).url || ''))) continue; } catch (e) { /* move it */ }
      }
      out.push(it);
    }
    return out;
  }
  static writable(t) {
    const o = { positionX: t.positionX, positionY: t.positionY, scaleX: t.scaleX, scaleY: t.scaleY };
    if (t.boundsType && t.boundsType !== 'OBS_BOUNDS_NONE') { o.boundsWidth = t.boundsWidth; o.boundsHeight = t.boundsHeight; }
    return o;
  }
  async animate(scene, items, from, to, ms) {
    const steps = Math.max(1, Math.round(ms / 50));
    for (let k = 1; k <= steps; k++) {
      const u = k / steps, e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      await Promise.all(items.map((it, i) => {
        const a = from[i], b = to[i], t = {};
        for (const key of Object.keys(b)) t[key] = a[key] + (b[key] - a[key]) * e;
        if (t.boundsWidth != null) { t.boundsWidth = Math.max(1, t.boundsWidth); t.boundsHeight = Math.max(1, t.boundsHeight); }
        return this.req('SetSceneItemTransform', { sceneName: scene, sceneItemId: it.sceneItemId, sceneItemTransform: t }).catch(() => {});
      }));
      if (steps > 1) await new Promise((r) => setTimeout(r, 30));
    }
  }

  // shrink the current scene into a corner box
  // box (optional) = { x, y, w, h } as fractions of the canvas (used by the Sports News goal replay)
  // v32: wait (a few seconds at most) for a camera effect to finish, so its in-between position isn't saved as "home"
  async waitCam(maxMs) { const t0 = Date.now(); while (this.camBusy && Date.now() - t0 < (maxMs || 12000)) await new Promise((r) => setTimeout(r, 150)); }
  async toCorner(box) {
    if (this.cornered || this.busy) return { ok: true, already: true };
    this.busy = true;
    await this.waitCam();
    try {
      await this.ensure();
      const S = this.settings();
      const cur = await this.req('GetCurrentProgramScene');
      const scene = cur.sceneName || cur.currentProgramSceneName;
      const vid = await this.req('GetVideoSettings');
      const W = vid.baseWidth || 1920, H = vid.baseHeight || 1080, k = W / 1920;
      const items = await this.movable(scene);
      if (!items.length) throw new Error('Nothing to move in scene "' + scene + '".');
      let s, ox, oy;
      if (box && box.w > 0 && box.h > 0) {
        s = Math.min(box.w, box.h);   // fit the whole canvas inside the box
        ox = box.x * W + (box.w * W - W * s) / 2; oy = box.y * H + (box.h * H - H * s) / 2;
      } else {
        s = Math.max(0.1, Math.min(0.6, S.size / 100));
        const bw = W * s, bh = H * s, m = S.margin * k;
        ox = /l$/.test(S.corner) ? m : W - bw - m; oy = /^t/.test(S.corner) ? m : H - bh - m;
      }
      const from = items.map((it) => OBS.writable(it.sceneItemTransform));
      const to = from.map((t) => { const o = { positionX: ox + t.positionX * s, positionY: oy + t.positionY * s, scaleX: t.scaleX * s, scaleY: t.scaleY * s }; if (t.boundsWidth != null) { o.boundsWidth = t.boundsWidth * s; o.boundsHeight = t.boundsHeight * s; } return o; });
      this.cornered = { scene, items: items.map((it, i) => ({ id: it.sceneItemId, name: it.sourceName, t: from[i] })) };
      try { fs.writeFileSync(this.restoreFile, JSON.stringify(this.cornered)); } catch (e) { /* ignore */ }
      await this.animate(scene, items, from, to, S.animMs);
      return { ok: true, scene, moved: items.map((x) => x.sourceName) };
    } finally { this.busy = false; }
  }
  // where is my camera? -> { x, y, w, h } in 1920x1080 overlay pixels (null if not found)
  static rectOf(tr, W, H) {
    let w, h;
    if (tr.boundsType && tr.boundsType !== 'OBS_BOUNDS_NONE') { w = tr.boundsWidth || 0; h = tr.boundsHeight || 0; }
    else { w = tr.width || (tr.sourceWidth || 0) * (tr.scaleX || 1); h = tr.height || (tr.sourceHeight || 0) * (tr.scaleY || 1); }
    if (!w || !h) return null;
    const al = tr.alignment == null ? 5 : tr.alignment;
    const x = (tr.positionX || 0) - ((al & 1) ? 0 : (al & 2) ? w : w / 2);
    const y = (tr.positionY || 0) - ((al & 4) ? 0 : (al & 8) ? h : h / 2);
    const k = 1920 / (W || 1920);
    return { x: x * k, y: y * k, w: w * k, h: h * (1080 / (H || 1080)) };
  }
  async cameraRect(name) {
    if (!this.ready) return null;
    const cur = await this.req('GetCurrentProgramScene');
    const scene = cur.sceneName || cur.currentProgramSceneName;
    const vid = await this.req('GetVideoSettings');
    const { sceneItems } = await this.req('GetSceneItemList', { sceneName: scene });
    const want = String(name || '').trim().toLowerCase();
    let item = null;
    if (want) item = (sceneItems || []).find((it) => String(it.sourceName).toLowerCase() === want);
    if (!item) item = (sceneItems || []).find((it) => it.sceneItemEnabled && /cam|brio|webcam|facecam|kiyo|c920|c922/i.test(it.sourceName) && !/elgato|capture card|4k|hd60|game/i.test(it.sourceName));
    if (!item) return null;
    let tr = item.sceneItemTransform;
    try { tr = (await this.req('GetSceneItemTransform', { sceneName: scene, sceneItemId: item.sceneItemId })).sceneItemTransform; } catch (e) { /* use the list's copy */ }
    const r = OBS.rectOf(tr, vid.baseWidth, vid.baseHeight);
    return r ? Object.assign(r, { name: item.sourceName, scene }) : null;
  }
  // find Tangia / Streamlabs (and similar) in the scene on air: name, where it sits, does OBS hear its sound
  async findAlerts(extra) {
    if (!this.ready) return this.alertList;
    const cur = await this.req('GetCurrentProgramScene');
    const scene = cur.sceneName || cur.currentProgramSceneName;
    const vid = await this.req('GetVideoSettings');
    const { sceneItems } = await this.req('GetSceneItemList', { sceneName: scene });
    const names = String(extra || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    const out = [];
    for (const it of sceneItems || []) {
      if (!it.sceneItemEnabled) continue;
      let url = '';
      if (it.inputKind === 'browser_source') { try { url = String(((await this.req('GetInputSettings', { inputName: it.sourceName })).inputSettings || {}).url || ''); } catch (e) { /* ignore */ } }
      if (/\/overlay(\b|$|\?)/.test(url) && /localhost|127\.0\.0\.1/.test(url)) continue;
      if (!(ALERT_RE.test(it.sourceName) || ALERT_URL.test(url) || names.includes(String(it.sourceName).toLowerCase()))) continue;
      let tr = it.sceneItemTransform;
      try { tr = (await this.req('GetSceneItemTransform', { sceneName: scene, sceneItemId: it.sceneItemId })).sceneItemTransform; } catch (e) { /* use list copy */ }
      const r = OBS.rectOf(tr, vid.baseWidth, vid.baseHeight);
      out.push({ name: it.sourceName, kind: alertKind(it.sourceName, url), rect: r, full: !r || (r.w > 1700 && r.h > 950), heard: !!this.loud[it.sourceName] || this.heardEver(it.sourceName) });
    }
    this.alertList = out;
    return out;
  }
  // v44: Tangia on / off in the scene on air (hidden + muted), and refresh every BBR browser source
  async toggleTangia(force) {
    await this.ensure();
    const cur = await this.req('GetCurrentProgramScene'); const scene = cur.sceneName || cur.currentProgramSceneName;
    const { sceneItems } = await this.req('GetSceneItemList', { sceneName: scene });
    const T = [];
    for (const it of sceneItems || []) { let url = ''; if (it.inputKind === 'browser_source') url = await this.inputUrl(it.sourceName); if (/tangia/i.test(it.sourceName + ' ' + url)) T.push(it); }
    if (!T.length) throw new Error('No Tangia source in the scene on air (' + scene + ')');
    const show = force != null ? !!force : !T.some((it) => it.sceneItemEnabled);
    for (const it of T) {
      await this.req('SetSceneItemEnabled', { sceneName: scene, sceneItemId: it.sceneItemId, sceneItemEnabled: show });
      try { await this.req('SetInputMute', { inputName: it.sourceName, inputMuted: !show }); } catch (e) { /* not an audio source */ }
    }
    return { shown: show, n: T.length, scene };
  }
  async refreshBBR(port) {
    await this.ensure();
    const { inputs } = await this.req('GetInputList', { inputKind: 'browser_source' });
    let n = 0; const re = new RegExp('(localhost|127\\.0\\.0\\.1|\\[::1\\]):' + port + '\\b');
    for (const i of inputs || []) { const url = await this.inputUrl(i.inputName); if (!re.test(url)) continue; try { await this.req('PressInputPropertiesButton', { inputName: i.inputName, propertyName: 'refreshnocache' }); n++; } catch (e) { /* ignore */ } }
    return n;
  }
  heardEver(name) { this.heard = this.heard || {}; if (this.loud[name]) this.heard[name] = true; return !!this.heard[name]; }
  // something from Tangia / Streamlabs made a sound in the last holdMs: treat it as "playing"
  alertPlaying(holdMs) {
    const now = Date.now();
    for (const a of this.alertList) { const t = this.loud[a.name]; if (t) { this.heardEver(a.name); if (now - t < holdMs) return a; } }
    return null;
  }

  // is the BBR overlay in the scene that's on air right now (directly or inside a nested scene)?
  // true / false, or null when we can't tell (OBS not connected)
  // the scene on air changed (OBS told us, or we asked)
  program(sc) { const prev = this.onAirScene; this.onAirScene = sc; if (sc !== prev && this.onProgram) { try { this.onProgram(sc, prev); } catch (e) { /* ignore */ } } }
  async inputUrl(name) {
    this.urlCache = this.urlCache || {};
    if (!(name in this.urlCache)) { try { this.urlCache[name] = String(((await this.req('GetInputSettings', { inputName: name })).inputSettings || {}).url || ''); } catch (e) { this.urlCache[name] = ''; } }
    return this.urlCache[name];
  }
  // does this scene (or a scene / group inside it) have a BBR browser source whose address matches re?
  async sceneHasUrl(scene, re, depth) {
    depth = depth || 0;
    let items = [];
    try { items = (await this.req('GetSceneItemList', { sceneName: scene })).sceneItems || []; } catch (e) { try { items = (await this.req('GetGroupSceneItemList', { sceneName: scene })).sceneItems || []; } catch (x) { return false; } }
    for (const it of items) {
      if (it.inputKind === 'browser_source') { const u = await this.inputUrl(it.sourceName); if (re.test(u) && /localhost|127\.0\.0\.1/.test(u)) return true; }
      else if (depth < 2 && (it.sourceType === 'OBS_SOURCE_TYPE_SCENE' || it.isGroup)) { if (await this.sceneHasUrl(it.sourceName, re, depth + 1)) return true; }
    }
    return false;
  }
  // every scene that shows a BBR screen (e.g. /starting), for the Starting Soon scene setting
  async scenesWithUrl(re) {
    if (!this.ready) return [];
    const L = ((await this.req('GetSceneList')).scenes || []).map((x) => x.sceneName);
    const out = []; for (const sc of L) if (await this.sceneHasUrl(sc, re)) out.push(sc);
    return out;
  }
  async overlayOnAir() {
    if (!this.ready) return null;
    this.urlCache = this.urlCache || {};
    const cur = await this.req('GetCurrentProgramScene');
    const scene = cur.sceneName || cur.currentProgramSceneName;
    const isOverlay = async (it) => {
      if (it.inputKind !== 'browser_source') return false;
      if (!(it.sourceName in this.urlCache)) { try { this.urlCache[it.sourceName] = String(((await this.req('GetInputSettings', { inputName: it.sourceName })).inputSettings || {}).url || ''); } catch (e) { this.urlCache[it.sourceName] = ''; } }
      return /\/overlay(\b|$|\?)/.test(this.urlCache[it.sourceName]) && /localhost|127\.0\.0\.1/.test(this.urlCache[it.sourceName]);
    };
    const check = async (sc, depth) => {
      const { sceneItems } = await this.req('GetSceneItemList', { sceneName: sc });
      for (const it of sceneItems || []) {
        if (!it.sceneItemEnabled) continue;
        if (await isOverlay(it)) return true;
        if (depth < 2 && (it.sourceType === 'OBS_SOURCE_TYPE_SCENE' || it.isGroup)) { try { if (await check(it.sourceName, depth + 1)) return true; } catch (e) { /* not a scene */ } }
      }
      return false;
    };
    this.program(scene);
    return check(scene, 0);
  }

  // is the BBR overlay above the camera in the Sources list? (if not, cards sit behind the camera)
  async layerCheck(camName) {
    if (!this.ready) return null;
    const cur = await this.req('GetCurrentProgramScene');
    const scene = cur.sceneName || cur.currentProgramSceneName;
    const { sceneItems } = await this.req('GetSceneItemList', { sceneName: scene });
    const items = sceneItems || [];
    const want = String(camName || '').trim().toLowerCase();
    const cam = (want && items.find((it) => String(it.sourceName).toLowerCase() === want)) || items.find((it) => it.sceneItemEnabled && /cam|brio|webcam|facecam|kiyo|c920|c922/i.test(it.sourceName) && !/elgato|capture card|4k|hd60|game/i.test(it.sourceName));
    let ov = null;
    for (const it of items.filter((x) => x.inputKind === 'browser_source')) {
      try { const r = await this.req('GetInputSettings', { inputName: it.sourceName }); if (/\/overlay(\b|$|\?)/.test(String((r.inputSettings || {}).url || ''))) { ov = it; break; } } catch (e) { /* skip */ }
    }
    if (!cam || !ov) return { scene, camera: cam && cam.sourceName, overlay: ov && ov.sourceName, ok: true, unknown: true };
    return { scene, camera: cam.sourceName, overlay: ov.sourceName, ok: ov.sceneItemIndex > cam.sceneItemIndex, ovId: ov.sceneItemId, top: items.length - 1 };
  }
  async overlayToTop(chk) {
    if (!chk || !chk.ovId) return false;
    await this.req('SetSceneItemIndex', { sceneName: chk.scene, sceneItemId: chk.ovId, sceneItemIndex: chk.top });
    return true;
  }
  // the box a battle moves the scene into (1920x1080 overlay pixels)
  boxRect() {
    const S = this.settings(), s = Math.max(0.1, Math.min(0.6, S.size / 100)), m = S.margin;
    const w = 1920 * s, h = 1080 * s;
    return { x: /l$/.test(S.corner) ? m : 1920 - w - m, y: /^t/.test(S.corner) ? m : 1080 - h - m, w, h };
  }

  // put everything back exactly where it was
  async restore() {
    const c = this.cornered; if (!c) return { ok: true, nothing: true };
    if (this.busy) await new Promise((r) => setTimeout(r, 800));
    this.busy = true;
    try {
      await this.ensure();
      const S = this.settings();
      const items = c.items.map((x) => ({ sceneItemId: x.id }));
      const now = await Promise.all(c.items.map((x) => this.req('GetSceneItemTransform', { sceneName: c.scene, sceneItemId: x.id }).then((r) => OBS.writable(r.sceneItemTransform)).catch(() => x.t)));
      // keep only fields both sides have
      const to = c.items.map((x) => x.t), from = now.map((t, i) => { const o = {}; for (const key of Object.keys(to[i])) o[key] = t[key] != null ? t[key] : to[i][key]; return o; });
      await this.animate(c.scene, items, from, to, S.animMs);
      this.cornered = null;
      try { fs.unlinkSync(this.restoreFile); } catch (e) { /* ignore */ }
      return { ok: true };
    } finally { this.busy = false; }
  }
}

module.exports = { OBS, OBS_DEFAULTS: DEFAULTS };
