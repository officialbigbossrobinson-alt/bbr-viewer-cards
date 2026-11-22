// Camera studio: move, zoom, flip and spin your webcam in OBS from the dashboard (or let chat buy effects).
// Works on the camera source in the scene on air. Everything can be put back with Reset (the starting
// position is saved to data/cam-home.json, so even a restart can't lose it).
const fs = require('fs');
const { OBS } = require('./obs');

// effects: pos = stays until Reset or another position, timed = plays then goes back
const FX = {
  tl: { label: 'Top left', kind: 'pos' }, tr: { label: 'Top right', kind: 'pos' }, bl: { label: 'Bottom left', kind: 'pos' }, br: { label: 'Bottom right', kind: 'pos' },
  big: { label: 'Big centre', kind: 'pos' }, home: { label: 'Back to normal spot', kind: 'pos' },
  hide: { label: 'Hide / show', kind: 'toggle' }, mirror: { label: 'Mirror', kind: 'toggle' }, tilt: { label: 'Tilt', kind: 'toggle' },
  zoom: { label: 'Zoom 1.5x', kind: 'timed', secs: 8 }, spin: { label: 'Spin 360', kind: 'timed', secs: 2 }, upside: { label: 'Upside down', kind: 'timed', secs: 10 },
  shake: { label: 'Shake', kind: 'timed', secs: 2 }, bounce: { label: 'Bounce', kind: 'timed', secs: 2 },
  goal: { label: 'Goal cam', kind: 'timed', secs: 6 }, spotlight: { label: 'Spotlight', kind: 'timed', secs: 8 }, wanted: { label: 'Wanted poster', kind: 'timed', secs: 10 },
  bw: { label: 'Black and white', kind: 'timed', secs: 15 }, night: { label: 'Night vision', kind: 'timed', secs: 15 },
  commander: { label: 'Commander call (Raid Night)', kind: 'timed', secs: 12 },
  // face effects: bend the picture around your face (needs the free Shaderfilter plugin for OBS)
  bighead: { label: 'Big head', kind: 'face', secs: 20 }, tinyhead: { label: 'Tiny head', kind: 'face', secs: 20 }, forehead: { label: 'Mega forehead', kind: 'face', secs: 15 },
  bignose: { label: 'Big nose', kind: 'face', secs: 15 }, shatter: { label: 'Face shatter', kind: 'face', secs: 10 }, melt: { label: 'Melt', kind: 'face', secs: 12 },
  swirl: { label: 'Swirl', kind: 'face', secs: 12 }, squash: { label: 'Squash', kind: 'face', secs: 15 }, fisheye: { label: 'Fish-eye', kind: 'face', secs: 15 },
  pixel: { label: 'Pixel face', kind: 'face', secs: 15 }, bobble: { label: 'Bobblehead', kind: 'face', secs: 15 }, twins: { label: 'Mirror twins', kind: 'face', secs: 15 },
  reset: { label: 'Reset everything', kind: 'reset' }
};
const CHAT_FX = ['zoom', 'spin', 'upside', 'shake', 'bounce', 'goal', 'spotlight', 'wanted', 'bw', 'night', 'mirror', 'tilt', 'bighead', 'tinyhead', 'forehead', 'bignose', 'shatter', 'melt', 'swirl', 'squash', 'fisheye', 'pixel', 'bobble', 'twins'];
const FILTER = 'BBR Camera FX', FACE_FILTER = 'BBR Face FX';
const f3 = (n) => (+n).toFixed(4);
// the shader for each face effect. C = face centre (0..1 of the camera picture), R = face radius (of the height), A = width / height
function faceShader(fx, face, aspect) {
  const cx = f3(face.x), cy = f3(face.y), r = f3(face.r), A = f3(aspect);
  const head = 'float4 mainImage(VertData v_in) : TARGET\n{\n  float2 uv = v_in.uv;\n  float t = elapsed_time;\n  float2 C = float2(' + cx + ', ' + cy + ');\n  float R = ' + r + ';\n  float A = ' + A + ';\n  float2 d = uv - C; d.x = d.x * A;\n  float dist = length(d);\n';
  const tail = '  return image.Sample(textureSampler, uv);\n}\n';
  const bulge = (k, rr, cyo) => '  float2 C2 = float2(C.x, C.y + ' + f3(cyo || 0) + ');\n  float RR = R * ' + f3(rr) + ';\n  float2 e = uv - C2; e.x = e.x * A;\n  float de = length(e);\n  if (de < RR && de > 0.0001) { float p = de / RR; float q = pow(p, ' + f3(k) + '); e = e / de * (q * RR); e.x = e.x / A; uv = C2 + e; }\n';
  const B = {
    bighead: bulge(1.9, 1.5), tinyhead: bulge(0.45, 1.7), forehead: bulge(1.8, 0.9, -face.r * 0.55), bignose: bulge(2.4, 0.45, face.r * 0.12),
    squash: '  if (dist < R * 1.6) { float w = smoothstep(R * 1.6, R * 0.5, dist); uv.x = C.x + (uv.x - C.x) * lerp(1.0, 0.55, w); uv.y = C.y + (uv.y - C.y) * lerp(1.0, 1.7, w); }\n',
    swirl: '  if (dist < R * 1.4) { float w = 1.0 - dist / (R * 1.4); float a = w * w * 5.0 * sin(t * 1.5); float cs = cos(a); float sn = sin(a); float2 e = float2(d.x * cs - d.y * sn, d.x * sn + d.y * cs); e.x = e.x / A; uv = C + e; }\n',
    fisheye: '  float2 g = uv - float2(0.5, 0.5); g.x = g.x * A; float r2 = dot(g, g); g = g * (0.55 + 0.9 * r2); g.x = g.x / A; uv = float2(0.5, 0.5) + g;\n',
    pixel: '  if (dist < R * 1.15) { float s = 0.028; uv = (floor(uv / s) + 0.5) * s; }\n',
    twins: '  if (dist < R * 1.4 && d.x > 0.0) { uv.x = C.x - (uv.x - C.x); }\n',
    bobble: '  float a = sin(t * 7.0) * 0.28;\n  float2 N = float2(C.x, C.y + R);\n  if (dist < R * 1.5) { float2 e = uv - N; e.x = e.x * A; float cs = cos(a); float sn = sin(a); e = float2(e.x * cs - e.y * sn, e.x * sn + e.y * cs); e.x = e.x / A; uv = N + e; }\n' + bulge(1.6, 1.4).replace('C2 = float2(C.x', 'C2 = float2(C.x + sin(t * 7.0) * 0.02'),
    melt: '  float amt = clamp(t * 0.25, 0.0, 1.0);\n  if (abs(d.x) < R * 1.3 && uv.y > C.y - R) { float drip = amt * (0.12 + 0.1 * sin(uv.x * 70.0) + 0.05 * sin(uv.x * 23.0 + 1.3)); uv.y = uv.y - drip * smoothstep(R * 1.3, R * 0.6, abs(d.x)); }\n',
    shatter: '  float amt = clamp(t * 0.35, 0.0, 1.0);\n  if (dist < R * 1.3) { float ang = atan2(d.y, d.x); float idx = floor((ang + 3.1416) / 0.785); float2 dir = float2(cos(idx * 0.785 - 2.75), sin(idx * 0.785 - 2.75)); float jit = frac(sin(idx * 12.9898) * 43758.5453); float2 e = dir * amt * (0.05 + 0.06 * jit); e.x = e.x / A; uv = uv - e; float edge = abs(frac((ang + 3.1416) / 0.785) - 0.5); if (edge > 0.47 && amt > 0.05) return float4(0.0, 0.0, 0.0, 1.0); }\n'
  };
  return head + (B[fx] || '') + tail;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CamStudio {
  constructor(o) {
    this.obs = o.obs; this.cfg = o.cfg; this.saveCfg = o.saveCfg; this.push = o.push; this.file = o.file; this.log = o.log || (() => {});
    this.q = Promise.resolve(); this.state = { pos: 'home', size: 1, mirror: false, tilt: false, hidden: false };
    this.home = null; this.lastBuy = 0; this.playing = null;
    try { this.home = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { /* not moved yet */ }
  }
  settings() {
    const c = this.cfg().camFx || {};
    const face = c.face && isFinite(c.face.x) ? c.face : { x: 0.5, y: 0.38, r: 0.22 };
    return { chat: c.chat !== false, lock: !!c.lock, guard: c.guard !== false, cooldownSecs: c.cooldownSecs != null ? +c.cooldownSecs : 60, camName: c.camName || '', lens: Object.assign({}, c.lens || {}), face,
      rules: Array.isArray(c.rules) ? c.rules : [{ type: 'bits', amount: 300, fx: 'spin' }, { type: 'bits', amount: 500, fx: 'upside' }, { type: 'bits', amount: 1000, fx: 'goal' }, { type: 'reward', match: 'night vision', fx: 'night' }] };
  }
  setSettings(n) {
    const cur = this.settings(), c = {};
    c.chat = typeof n.chat === 'boolean' ? n.chat : cur.chat;
    c.lock = typeof n.lock === 'boolean' ? n.lock : cur.lock;
    c.guard = typeof n.guard === 'boolean' ? n.guard : cur.guard;
    c.cooldownSecs = n.cooldownSecs != null ? Math.max(0, Math.min(3600, Math.round(+n.cooldownSecs || 0))) : cur.cooldownSecs;
    c.camName = n.camName != null ? String(n.camName).slice(0, 80) : cur.camName;
    c.lens = Object.assign({}, cur.lens); if (n.lens && typeof n.lens === 'object') for (const [k, v] of Object.entries(n.lens)) if (FX[k] && FX[k].secs) c.lens[k] = Math.max(1, Math.min(300, Math.round(+v) || FX[k].secs));
    c.face = n.face && isFinite(+n.face.x) ? { x: Math.max(0, Math.min(1, +n.face.x)), y: Math.max(0, Math.min(1, +n.face.y)), r: Math.max(0.05, Math.min(0.6, +n.face.r || 0.22)) } : cur.face;
    c.rules = Array.isArray(n.rules) ? n.rules.map((r) => ({ type: r.type === 'reward' ? 'reward' : 'bits', amount: Math.max(1, Math.round(+r.amount || 0)) || undefined, match: r.type === 'reward' ? String(r.match || '').slice(0, 60) : undefined, fx: CHAT_FX.includes(r.fx) ? r.fx : 'spin' })).filter((r) => (r.type === 'bits' ? r.amount : r.match)) : cur.rules;
    this.cfg().camFx = c; this.saveCfg();
  }
  secsFor(fx, secs) { const D = FX[fx] || {}; return Math.max(1, +secs || +this.settings().lens[fx] || D.secs || 10); }
  // may chat trigger an effect right now? (lock + cooldown)
  allowed(test) {
    const S = this.settings();
    if (test) return true;
    if (!S.chat || S.lock || this.playing || Date.now() - this.lastBuy < S.cooldownSecs * 1000) return false;
    this.lastBuy = Date.now(); return true;
  }
  // a still from the camera, for lining up the face circle on the dashboard
  async snapshot() {
    const it = await this.item();
    const r = await this.obs.req('GetSourceScreenshot', { sourceName: it.name, imageFormat: 'jpg', imageWidth: 480, imageCompressionQuality: 70 });
    return { image: r.imageData, name: it.name };
  }
  async faceFx(fx, secs) {
    const name = this.home.name;
    let aspect = 16 / 9;
    try { const t = this.home.t; if (t.sourceWidth && t.sourceHeight) aspect = t.sourceWidth / t.sourceHeight; } catch (e) { /* default */ }
    const settings = { shader_text: faceShader(fx, this.settings().face, aspect), from_file: false };
    await this.obs.req('RemoveSourceFilter', { sourceName: name, filterName: FACE_FILTER }).catch(() => {});
    try { await this.obs.req('CreateSourceFilter', { sourceName: name, filterName: FACE_FILTER, filterKind: 'shader_filter', filterSettings: settings }); }
    catch (e) { throw new Error('Face effects need the free "Shaderfilter" plugin for OBS (obs-shaderfilter). Install it, restart OBS, then try again.'); }
    await this.nap(secs * 1000);
    await this.obs.req('RemoveSourceFilter', { sourceName: name, filterName: FACE_FILTER }).catch(() => {});
  }
  info() { return { fx: FX, chatFx: CHAT_FX, settings: this.settings(), state: this.state, moved: !!this.home, playing: this.playing, spots: Object.keys(this.spots()), guard: !(this.cfg().camFx && this.cfg().camFx.guard === false), cooldownLeft: Math.max(0, Math.ceil((this.lastBuy + this.settings().cooldownSecs * 1000 - Date.now()) / 1000)) }; }

  // ---------- OBS helpers ----------
  async item() {
    await this.obs.ensure();
    const cur = await this.obs.req('GetCurrentProgramScene');
    const scene = cur.sceneName || cur.currentProgramSceneName;
    if (this.home && this.home.scene === scene) return { scene, id: this.home.id, name: this.home.name };
    const r = await this.obs.cameraRect(this.settings().camName || (this.cfg().screen && this.cfg().screen.camName));
    if (!r) throw new Error('No camera found in scene "' + scene + '". Type its source name in Camera studio.');
    const { sceneItems } = await this.obs.req('GetSceneItemList', { sceneName: scene });
    const it = (sceneItems || []).find((x) => x.sourceName === r.name);
    return { scene, id: it.sceneItemId, name: it.sourceName };
  }
  // where the camera sits, in canvas pixels, measured from its centre
  static geom(tr) {
    const bounded = tr.boundsType && tr.boundsType !== 'OBS_BOUNDS_NONE';
    // v32: OBS's width / height already take the crop into account (a cropped webcam used to land in the wrong place)
    const cw = tr.sourceWidth ? Math.max(1, tr.sourceWidth - (tr.cropLeft || 0) - (tr.cropRight || 0)) : 0, ch = tr.sourceHeight ? Math.max(1, tr.sourceHeight - (tr.cropTop || 0) - (tr.cropBottom || 0)) : 0;
    const w = bounded ? tr.boundsWidth : Math.abs(tr.width || 0) || cw * Math.abs(tr.scaleX || 1);
    const h = bounded ? tr.boundsHeight : Math.abs(tr.height || 0) || ch * Math.abs(tr.scaleY || 1);
    const al = tr.alignment == null ? 5 : tr.alignment;
    const x = (tr.positionX || 0) - ((al & 1) ? 0 : (al & 2) ? w : w / 2);
    const y = (tr.positionY || 0) - ((al & 4) ? 0 : (al & 8) ? h : h / 2);
    return { cx: x + w / 2, cy: y + h / 2, w, h, bounded, sx: Math.abs(tr.scaleX || 1), sy: Math.abs(tr.scaleY || 1), rot: tr.rotation || 0 };
  }
  async ensureHome() {
    const it = await this.item();
    if (!this.home || this.home.scene !== it.scene || this.home.id !== it.id) {
      const { sceneItemTransform: t } = await this.obs.req('GetSceneItemTransform', { sceneName: it.scene, sceneItemId: it.id });
      const { sceneItemEnabled } = await this.obs.req('GetSceneItemEnabled', { sceneName: it.scene, sceneItemId: it.id }).catch(() => ({ sceneItemEnabled: true }));
      this.home = { scene: it.scene, id: it.id, name: it.name, t, enabled: sceneItemEnabled !== false };
      try { fs.writeFileSync(this.file, JSON.stringify(this.home)); } catch (e) { /* ignore */ }
      // centre alignment from now on, so zoom and spin happen around the middle of the camera
      const g = CamStudio.geom(t);
      await this.obs.req('SetSceneItemTransform', { sceneName: it.scene, sceneItemId: it.id, sceneItemTransform: { alignment: 0, positionX: g.cx, positionY: g.cy } });
    }
    return this.home;
  }
  // the transform for a state (+ an extra zoom / turn / nudge on top)
  target(st, extra) {
    extra = extra || {};
    const g = CamStudio.geom(this.home.t), vid = this.vid || { baseWidth: 1920, baseHeight: 1080 };
    const W = vid.baseWidth, H = vid.baseHeight, m = 30 * W / 1920;
    let k = st.size * (extra.zoom || 1), cx = g.cx, cy = g.cy;
    if (st.pos === 'big') { k = (H * 0.62 / g.h) * (extra.zoom || 1); cx = W / 2; cy = H / 2; }
    const w = g.w * k, h = g.h * k;
    if (/^(tl|tr|bl|br)$/.test(st.pos)) { cx = st.pos[1] === 'l' ? m + w / 2 : W - m - w / 2; cy = st.pos[0] === 't' ? m + h / 2 : H - m - h / 2; }
    // v32: never past the edge of the screen (a big camera stays centred, a small one stays fully on screen)
    cx = w >= W ? W / 2 : Math.max(w / 2, Math.min(W - w / 2, cx)); cy = h >= H ? H / 2 : Math.max(h / 2, Math.min(H - h / 2, cy));
    const flip = st.mirror ? -1 : 1;
    const o = { positionX: cx + (extra.dx || 0), positionY: cy + (extra.dy || 0), rotation: g.rot + (st.tilt ? -8 : 0) + (extra.rot || 0) };
    if (g.bounded) { o.boundsWidth = w; o.boundsHeight = h; o.scaleX = flip * g.sx; o.scaleY = g.sy; }
    else { o.scaleX = flip * g.sx * k; o.scaleY = g.sy * k; }
    return o;
  }
  async now() { const { sceneItemTransform: t } = await this.obs.req('GetSceneItemTransform', { sceneName: this.home.scene, sceneItemId: this.home.id }); return t; }
  async go(to, ms) {
    const t = await this.now(), from = {};
    for (const key of Object.keys(to)) from[key] = t[key] != null ? t[key] : to[key];
    // spin the short way round unless a spin asked for the long way
    await this.obs.animate(this.home.scene, [{ sceneItemId: this.home.id }], [from], [to], ms);
  }
  async filter(settings) {
    const name = this.home.name;
    if (!settings) { await this.obs.req('RemoveSourceFilter', { sourceName: name, filterName: FILTER }).catch(() => {}); return; }
    try { await this.obs.req('CreateSourceFilter', { sourceName: name, filterName: FILTER, filterKind: 'color_filter_v2', filterSettings: settings }); }
    catch (e) { await this.obs.req('SetSourceFilterSettings', { sourceName: name, filterName: FILTER, filterSettings: settings, overlay: false }).catch(() => {}); }
  }
  rect(tr) {
    const vid = this.vid || { baseWidth: 1920, baseHeight: 1080 };
    const g = CamStudio.geom(Object.assign({}, this.home.t, tr, { alignment: 0 }));
    const k = 1920 / vid.baseWidth;
    return { x: (g.cx - g.w / 2) * k, y: (g.cy - g.h / 2) * k, w: g.w * k, h: g.h * k };
  }

  // ---------- run an effect (queued, one at a time) ----------
  run(fx, by, secs) {
    const job = this.q.then(() => { if (fx !== 'reset') this.stopNow = false; return this.exec(fx, by, secs); }).then((r) => { if (fx === 'reset') this.stopNow = false; return r; }).catch((e) => { this.log('[camera] ' + e.message); return { error: e.message }; });
    this.q = job.then(() => {}, () => {});
    return job;
  }
  async exec(fx, by, secsIn) {
    if (!FX[fx]) throw new Error('Unknown camera effect');
    if (this.obs.cornered || this.obs.busy) throw new Error('A battle has the scene in a corner right now, try after it.');
    if (fx === 'reset') {   // v32: undo everything, then your saved spot (or pulled fully onto the screen)
      this.push({ type: 'camfx', fx, phase: 'start', by: by || null, label: FX.reset.label });
      try { await this.reset(true); const r = await this.fixPlace(true); try { const it = await this.item(); await this.obs.req('SetSceneItemEnabled', { sceneName: it.scene, sceneItemId: it.id, sceneItemEnabled: true }); } catch (e) { /* ignore */ } return { ok: true, how: r.how, msg: r.how === 'spot' ? 'Camera back on your saved spot' : r.how === 'onscreen' ? 'Camera pulled back onto the screen (save a spot to choose where it goes)' : 'Camera reset' }; }
      finally { this.push({ type: 'camfx', fx, phase: 'end' }); }
    }
    await this.ensureHome();
    this.vid = await this.obs.req('GetVideoSettings');
    const st = this.state, D = FX[fx], secs = this.secsFor(fx, secsIn);
    const base = () => this.target(st);
    this.playing = fx;
    const moves = !/^(hide|bw|night|spotlight|wanted)$/.test(fx) && D.kind !== 'face';
    if (moves) this.obs.camBusy = true;
    this.push({ type: 'camfx', fx, phase: 'start', by: by || null, label: D.label });
    let okEnd = false;
    try {
      if (fx === 'reset') return await this.reset();
      if (D.kind === 'pos') { st.pos = fx; await this.go(base(), 600); }
      else if (fx === 'hide') { st.hidden = !st.hidden; await this.obs.req('SetSceneItemEnabled', { sceneName: this.home.scene, sceneItemId: this.home.id, sceneItemEnabled: !st.hidden }); }
      else if (fx === 'mirror') { st.mirror = !st.mirror; await this.go(base(), 400); }
      else if (fx === 'tilt') { st.tilt = !st.tilt; await this.go(base(), 400); }
      else if (fx === 'zoom') { await this.go(this.target(st, { zoom: 1.5 }), 500); await this.nap(secs * 1000); await this.go(base(), 500); }
      else if (D.kind === 'face') { this.push({ type: 'camfx', fx, phase: 'frame', rect: this.rect(base()), ms: secs * 1000, by: by || null, label: D.label }); await this.faceFx(fx, secs); }
      else if (fx === 'spin') { const b = base(); await this.go(Object.assign({}, b, { rotation: b.rotation + 360 * Math.max(1, Math.round(secs / 2)) }), Math.max(800, secs * 1000 - 300)); await this.obs.req('SetSceneItemTransform', { sceneName: this.home.scene, sceneItemId: this.home.id, sceneItemTransform: { rotation: b.rotation } }); }
      else if (fx === 'upside') { const b = base(); await this.go(Object.assign({}, b, { rotation: b.rotation + 180 }), 700); await this.nap(secs * 1000); await this.go(b, 700); }
      else if (fx === 'shake') { await this.shake(secs * 900, 22); }
      else if (fx === 'bounce') { for (let i = 0; i < Math.max(1, Math.round(secs * 1.5)); i++) { await this.go(this.target(st, { zoom: 1.18, dy: -18 }), 160); await this.go(base(), 200); } }
      else if (fx === 'goal' || fx === 'commander') {
        const z = this.target(st, { zoom: fx === 'goal' ? 1.6 : 1.4, rot: fx === 'goal' ? -6 : 0 });
        await this.go(z, 450);
        this.push({ type: 'camfx', fx, phase: 'frame', rect: this.rect(z), ms: secs * 1000, by: by || null });
        if (fx === 'goal') await this.shake(1200, 16, z);
        await this.nap(secs * 1000 - (fx === 'goal' ? 1200 : 0)); await this.go(base(), 600);
      } else if (fx === 'spotlight' || fx === 'wanted') {
        this.push({ type: 'camfx', fx, phase: 'frame', rect: this.rect(base()), ms: secs * 1000, by: by || null });
        if (fx === 'wanted') await this.filter({ saturation: -0.6, color_multiply: 0xFF9CC8E6, contrast: 0.15 });
        await this.nap(secs * 1000);
        if (fx === 'wanted') await this.filter(null);
      } else if (fx === 'bw' || fx === 'night') {
        await this.filter(fx === 'bw' ? { saturation: -1, contrast: 0.2 } : { saturation: -1, color_multiply: 0xFF55FF55, contrast: 0.35, brightness: 0.05, gamma: 0.3 });
        this.push({ type: 'camfx', fx, phase: 'frame', rect: this.rect(base()), ms: secs * 1000, by: by || null });
        await this.nap(secs * 1000); await this.filter(null);
      }
      okEnd = true;
      // v32: an effect that came back to normal hands the camera back exactly as you set it up (same anchor, same everything)
      if ((D.kind === 'timed' || D.kind === 'face' || fx === 'home') && st.pos === 'home' && st.size === 1 && !st.mirror && !st.tilt && !st.hidden && !this.stopNow) await this.reset(true).catch(() => {});
      return { ok: true, state: st };
    } finally {
      // v32: if anything went wrong half way (OBS hiccup), snap the camera straight to where it should be
      if (!okEnd && moves && this.home && fx !== 'reset') { try { await this.obs.req('SetSceneItemTransform', { sceneName: this.home.scene, sceneItemId: this.home.id, sceneItemTransform: base() }); } catch (e) { /* OBS gone: the guard fixes it when it's back */ } }
      this.obs.camBusy = false; this.playing = null; this.push({ type: 'camfx', fx, phase: 'end' });
    }
  }
  async shake(ms, px, around) {
    const b = around || this.target(this.state), t0 = Date.now();
    while (Date.now() - t0 < ms && !this.stopNow) {
      const k = 1 - (Date.now() - t0) / ms;
      await this.obs.req('SetSceneItemTransform', { sceneName: this.home.scene, sceneItemId: this.home.id, sceneItemTransform: { positionX: b.positionX + (Math.random() - 0.5) * 2 * px * k, positionY: b.positionY + (Math.random() - 0.5) * 2 * px * k, rotation: b.rotation + (Math.random() - 0.5) * 4 * k } }).catch(() => {});
      await this.nap(40);
    }
    await this.obs.req('SetSceneItemTransform', { sceneName: this.home.scene, sceneItemId: this.home.id, sceneItemTransform: { positionX: b.positionX, positionY: b.positionY, rotation: b.rotation } }).catch(() => {});
  }
  // ---------- v32: your saved camera spot (per scene) + keeping the camera on screen ----------
  spots() { const c = this.cfg(); if (!c.camSpots || typeof c.camSpots !== 'object') c.camSpots = {}; return c.camSpots; }
  static keep(t) {
    const o = { alignment: t.alignment == null ? 5 : t.alignment, positionX: t.positionX, positionY: t.positionY, rotation: t.rotation || 0, scaleX: t.scaleX, scaleY: t.scaleY,
      cropLeft: t.cropLeft || 0, cropRight: t.cropRight || 0, cropTop: t.cropTop || 0, cropBottom: t.cropBottom || 0 };
    if (t.boundsType && t.boundsType !== 'OBS_BOUNDS_NONE') { o.boundsType = t.boundsType; o.boundsWidth = t.boundsWidth; o.boundsHeight = t.boundsHeight; if (t.boundsAlignment != null) o.boundsAlignment = t.boundsAlignment; }
    return o;
  }
  // remember where the camera is right now (after you've put it where you like it in OBS)
  saveSpot() {
    const job = this.q.then(async () => {
      if (this.playing) throw new Error('Wait for the camera effect to finish');
      if (this.obs.cornered) throw new Error('A battle has the scene in a corner right now, try after it.');
      // put back the app's own changes first so we save YOUR spot, not an effect
      if (this.home) await this.reset(true);
      const it = await this.item();
      const { sceneItemTransform: t } = await this.obs.req('GetSceneItemTransform', { sceneName: it.scene, sceneItemId: it.id });
      this.spots()[it.scene] = { name: it.name, t: CamStudio.keep(t), at: Date.now() };
      this.saveCfg();
      return { ok: true, saved: it.scene, name: it.name };
    }).catch((e) => ({ error: e.message }));
    this.q = job.then(() => {}, () => {});
    return job;
  }
  forgetSpot(scene) { const S = this.spots(); if (scene) delete S[scene]; else for (const k of Object.keys(S)) delete S[k]; this.saveCfg(); return { ok: true }; }
  // how much of the camera is on the canvas (0..1)
  static visible(tr, W, H) {
    const g = CamStudio.geom(tr); if (!g.w || !g.h) return 1;
    const x0 = Math.max(0, g.cx - g.w / 2), x1 = Math.min(W, g.cx + g.w / 2), y0 = Math.max(0, g.cy - g.h / 2), y1 = Math.min(H, g.cy + g.h / 2);
    return Math.max(0, x1 - x0) * Math.max(0, y1 - y0) / (g.w * g.h);
  }
  // put the camera somewhere sensible: your saved spot, else pulled fully onto the screen
  async fixPlace(force) {
    const it = await this.item();
    const vid = await this.obs.req('GetVideoSettings'), W = vid.baseWidth || 1920, H = vid.baseHeight || 1080;
    const { sceneItemTransform: t } = await this.obs.req('GetSceneItemTransform', { sceneName: it.scene, sceneItemId: it.id });
    const vis = CamStudio.visible(t, W, H), spot = this.spots()[it.scene];
    if (spot && spot.name === it.name) {
      const s = spot.t, d = Math.abs((t.positionX || 0) - s.positionX) + Math.abs((t.positionY || 0) - s.positionY) + Math.abs((t.scaleX || 1) - s.scaleX) * 500 + Math.abs((t.rotation || 0) - s.rotation);
      if (force || d > 2 || (t.alignment == null ? 5 : t.alignment) !== s.alignment) { await this.obs.req('SetSceneItemTransform', { sceneName: it.scene, sceneItemId: it.id, sceneItemTransform: s }); return { ok: true, how: 'spot', vis }; }
      return { ok: true, how: 'fine', vis };
    }
    if (vis > 0.97 && !force) return { ok: true, how: 'fine', vis };
    if (vis > 0.97) return { ok: true, how: 'fine', vis };
    const g = CamStudio.geom(t); let w = g.w, h = g.h, k = 1;
    if (w > W || h > H) k = Math.min(W / w, H / h) * 0.9;
    w *= k; h *= k;
    const cx = Math.max(w / 2, Math.min(W - w / 2, g.cx)), cy = Math.max(h / 2, Math.min(H - h / 2, g.cy));
    const o = { alignment: 0, positionX: cx, positionY: cy, rotation: 0 };
    if (g.bounded) { o.boundsWidth = w; o.boundsHeight = h; } else { o.scaleX = (t.scaleX || 1) * k; o.scaleY = (t.scaleY || 1) * k; }
    await this.obs.req('SetSceneItemTransform', { sceneName: it.scene, sceneItemId: it.id, sceneItemTransform: o });
    return { ok: true, how: 'onscreen', vis };
  }
  // Reset camera: stop effects, undo everything, then your saved spot (or fully on screen)
  // stops a running effect early (its wait ends at once), then resets
  resetAll() { this.stopNow = true; return this.run('reset', null); }
  async nap(ms) { const t0 = Date.now(); while (Date.now() - t0 < ms && !this.stopNow) await sleep(Math.min(100, ms)); }
  // the guard (every few seconds while OBS is connected): put back a camera left moved by a crash, and keep it on screen
  async guard() {
    if (this.playing || this.obs.cornered || this.obs.busy || this.obs.camBusy || this.guarding) return null;
    if (this.cfg().camFx && this.cfg().camFx.guard === false) return null;
    this.guarding = true;
    try {
      if (!this.started) { this.started = true; if (this.home) { await this.reset(true); this.log('[camera] put the camera back where it was before the app closed'); return 'restored'; } }
      const st = this.state; if (st.pos !== 'home' || st.size !== 1 || st.hidden) return null;   // you moved it on purpose
      const it = await this.item().catch(() => null); if (!it) return null;
      const vid = await this.obs.req('GetVideoSettings'), W = vid.baseWidth || 1920, H = vid.baseHeight || 1080;
      const { sceneItemTransform: t } = await this.obs.req('GetSceneItemTransform', { sceneName: it.scene, sceneItemId: it.id });
      if (CamStudio.visible(t, W, H) < 0.6) { const r = await this.fixPlace(true); this.log('[camera] camera was off screen: fixed (' + r.how + ')'); return 'fixed'; }
      return null;
    } catch (e) { return null; } finally { this.guarding = false; }
  }
  async reset(quiet) {
    if (!this.home) return { ok: true, nothing: true };
    this.state = { pos: 'home', size: 1, mirror: false, tilt: false, hidden: false };
    await this.filter(null);
    await this.obs.req('RemoveSourceFilter', { sourceName: this.home.name, filterName: FACE_FILTER }).catch(() => {});
    await this.obs.req('SetSceneItemEnabled', { sceneName: this.home.scene, sceneItemId: this.home.id, sceneItemEnabled: this.home.enabled !== false }).catch(() => {});
    await this.go(this.target(this.state), 500).catch(() => {});
    const t = this.home.t, back = { alignment: t.alignment, positionX: t.positionX, positionY: t.positionY, rotation: t.rotation || 0, scaleX: t.scaleX, scaleY: t.scaleY };
    if (t.boundsType && t.boundsType !== 'OBS_BOUNDS_NONE') { back.boundsWidth = t.boundsWidth; back.boundsHeight = t.boundsHeight; }
    await this.obs.req('SetSceneItemTransform', { sceneName: this.home.scene, sceneItemId: this.home.id, sceneItemTransform: back });
    this.home = null;
    try { fs.unlinkSync(this.file); } catch (e) { /* ignore */ }
    return { ok: true, reset: true };
  }
  setSize(pct) {
    const job = this.q.then(async () => {
      if (this.obs.cornered || this.obs.busy) throw new Error('A battle has the scene in a corner right now, try after it.');
      this.state.size = Math.max(0.5, Math.min(2, (+pct || 100) / 100));
      await this.ensureHome(); this.vid = await this.obs.req('GetVideoSettings');
      await this.go(this.target(this.state), 400);
      return { ok: true, state: this.state };
    }).catch((e) => ({ error: e.message }));
    this.q = job.then(() => {}, () => {});
    return job;
  }

  // ---------- chat buys an effect (bits amount or a channel point reward) ----------
  rewardRule(title) { const v = String(title || '').toLowerCase(); const c = this.cfg().camFx || {}; const r = (Array.isArray(c.rules) ? c.rules : []).find((x) => x.type === 'reward' && x.match && v.includes(String(x.match).toLowerCase())); return r ? r.fx : null; }
  fromPurchase(kind, value, by) {
    const S = this.settings();
    if (!S.chat) return null;
    const v = String(value).toLowerCase();
    const r = S.rules.find((x) => (kind === 'bits' ? x.type === 'bits' && +x.amount === +value : x.type === 'reward' && x.match && v.includes(String(x.match).toLowerCase())));
    if (!r) return null;
    if (S.lock) return { locked: true };
    if (this.playing || Date.now() - this.lastBuy < S.cooldownSecs * 1000) return { cooldown: true };
    this.lastBuy = Date.now();
    this.run(r.fx, by);
    return { fx: r.fx };
  }
}
module.exports = { CamStudio, FX, CHAT_FX, faceShader };
