// Teeth whitening: a permanent shader on the camera that only touches teeth.
// It looks inside a soft oval around the mouth, and only changes pixels that look like teeth (bright, pale, not red),
// so lips, gums, skin and everything outside the mouth stay as they are. The mouth spot is set by hand, or follows the
// mouth when the tracker page is open (it finds the lips in the camera picture a few times a second).
// Needs the free "Shaderfilter" plugin for OBS (obs-shaderfilter), same as the face effects.
const FILTER = 'BBR Teeth';
const SHADER = `// BBR Teeth: whitening that only touches teeth inside the mouth
uniform float strength = 0.5;
uniform float brighten = 0.25;
uniform float sensitivity = 0.5;
uniform float mx = 0.5;
uniform float my = 0.62;
uniform float mw = 0.16;
uniform float mh = 0.08;
uniform float aspect = 1.7778;
uniform float show_mask = 0.0;
uniform float use_poly = 0.0;
uniform float closed = 0.0;
uniform float learned = 0.0;
uniform float tr = 0.85;
uniform float tg = 0.82;
uniform float tb = 0.7;
uniform float feather = 0.004;
uniform float p0x = 0.5;
uniform float p0y = 0.6;
uniform float p1x = 0.5;
uniform float p1y = 0.6;
uniform float p2x = 0.5;
uniform float p2y = 0.6;
uniform float p3x = 0.5;
uniform float p3y = 0.6;
uniform float p4x = 0.5;
uniform float p4y = 0.6;
uniform float p5x = 0.5;
uniform float p5y = 0.6;
uniform float p6x = 0.5;
uniform float p6y = 0.6;
uniform float p7x = 0.5;
uniform float p7y = 0.6;
uniform float p8x = 0.5;
uniform float p8y = 0.6;
uniform float p9x = 0.5;
uniform float p9y = 0.6;

float4 mainImage(VertData v_in) : TARGET
{
  float4 c = image.Sample(textureSampler, v_in.uv);
  if (closed > 0.5) return c;
  float area = 0.0;
  if (use_poly > 0.5) {
    float2 P = float2(v_in.uv.x * aspect, v_in.uv.y);
    float inside = 0.0;
    float dmin = 10.0;
  { float2 a = float2(p0x * aspect, p0y); float2 b = float2(p1x * aspect, p1y);
    if (((a.y > P.y) != (b.y > P.y)) && (P.x < (b.x - a.x) * (P.y - a.y) / (b.y - a.y + 0.000001) + a.x)) inside = 1.0 - inside;
    float2 ab = b - a; float t = saturate(dot(P - a, ab) / max(dot(ab, ab), 0.00000001)); dmin = min(dmin, length(P - (a + ab * t))); }
  { float2 a = float2(p1x * aspect, p1y); float2 b = float2(p2x * aspect, p2y);
    if (((a.y > P.y) != (b.y > P.y)) && (P.x < (b.x - a.x) * (P.y - a.y) / (b.y - a.y + 0.000001) + a.x)) inside = 1.0 - inside;
    float2 ab = b - a; float t = saturate(dot(P - a, ab) / max(dot(ab, ab), 0.00000001)); dmin = min(dmin, length(P - (a + ab * t))); }
  { float2 a = float2(p2x * aspect, p2y); float2 b = float2(p3x * aspect, p3y);
    if (((a.y > P.y) != (b.y > P.y)) && (P.x < (b.x - a.x) * (P.y - a.y) / (b.y - a.y + 0.000001) + a.x)) inside = 1.0 - inside;
    float2 ab = b - a; float t = saturate(dot(P - a, ab) / max(dot(ab, ab), 0.00000001)); dmin = min(dmin, length(P - (a + ab * t))); }
  { float2 a = float2(p3x * aspect, p3y); float2 b = float2(p4x * aspect, p4y);
    if (((a.y > P.y) != (b.y > P.y)) && (P.x < (b.x - a.x) * (P.y - a.y) / (b.y - a.y + 0.000001) + a.x)) inside = 1.0 - inside;
    float2 ab = b - a; float t = saturate(dot(P - a, ab) / max(dot(ab, ab), 0.00000001)); dmin = min(dmin, length(P - (a + ab * t))); }
  { float2 a = float2(p4x * aspect, p4y); float2 b = float2(p5x * aspect, p5y);
    if (((a.y > P.y) != (b.y > P.y)) && (P.x < (b.x - a.x) * (P.y - a.y) / (b.y - a.y + 0.000001) + a.x)) inside = 1.0 - inside;
    float2 ab = b - a; float t = saturate(dot(P - a, ab) / max(dot(ab, ab), 0.00000001)); dmin = min(dmin, length(P - (a + ab * t))); }
  { float2 a = float2(p5x * aspect, p5y); float2 b = float2(p6x * aspect, p6y);
    if (((a.y > P.y) != (b.y > P.y)) && (P.x < (b.x - a.x) * (P.y - a.y) / (b.y - a.y + 0.000001) + a.x)) inside = 1.0 - inside;
    float2 ab = b - a; float t = saturate(dot(P - a, ab) / max(dot(ab, ab), 0.00000001)); dmin = min(dmin, length(P - (a + ab * t))); }
  { float2 a = float2(p6x * aspect, p6y); float2 b = float2(p7x * aspect, p7y);
    if (((a.y > P.y) != (b.y > P.y)) && (P.x < (b.x - a.x) * (P.y - a.y) / (b.y - a.y + 0.000001) + a.x)) inside = 1.0 - inside;
    float2 ab = b - a; float t = saturate(dot(P - a, ab) / max(dot(ab, ab), 0.00000001)); dmin = min(dmin, length(P - (a + ab * t))); }
  { float2 a = float2(p7x * aspect, p7y); float2 b = float2(p8x * aspect, p8y);
    if (((a.y > P.y) != (b.y > P.y)) && (P.x < (b.x - a.x) * (P.y - a.y) / (b.y - a.y + 0.000001) + a.x)) inside = 1.0 - inside;
    float2 ab = b - a; float t = saturate(dot(P - a, ab) / max(dot(ab, ab), 0.00000001)); dmin = min(dmin, length(P - (a + ab * t))); }
  { float2 a = float2(p8x * aspect, p8y); float2 b = float2(p9x * aspect, p9y);
    if (((a.y > P.y) != (b.y > P.y)) && (P.x < (b.x - a.x) * (P.y - a.y) / (b.y - a.y + 0.000001) + a.x)) inside = 1.0 - inside;
    float2 ab = b - a; float t = saturate(dot(P - a, ab) / max(dot(ab, ab), 0.00000001)); dmin = min(dmin, length(P - (a + ab * t))); }
  { float2 a = float2(p9x * aspect, p9y); float2 b = float2(p0x * aspect, p0y);
    if (((a.y > P.y) != (b.y > P.y)) && (P.x < (b.x - a.x) * (P.y - a.y) / (b.y - a.y + 0.000001) + a.x)) inside = 1.0 - inside;
    float2 ab = b - a; float t = saturate(dot(P - a, ab) / max(dot(ab, ab), 0.00000001)); dmin = min(dmin, length(P - (a + ab * t))); }
    area = inside * smoothstep(0.0, feather, dmin);
  } else {
    float2 d = v_in.uv - float2(mx, my);
    d.x = d.x * aspect;
    float e = length(float2(d.x / max(mw * aspect, 0.001), d.y / max(mh, 0.001)));
    area = 1.0 - smoothstep(0.75, 1.0, e);
  }
  if (area <= 0.0) return c;
  float3 rgb = c.rgb;
  float mxc = max(rgb.r, max(rgb.g, rgb.b));
  float mnc = min(rgb.r, min(rgb.g, rgb.b));
  float sat = (mxc - mnc) / max(mxc, 0.0001);
  float lum = dot(rgb, float3(0.299, 0.587, 0.114));
  float red = rgb.r - rgb.g;
  float yel = (rgb.r + rgb.g) * 0.5 - rgb.b;
  float colour = 0.0;
  if (learned > 0.5) {
    float3 t3 = float3(tr, tg, tb);
    float tl = dot(t3, float3(0.299, 0.587, 0.114));
    float dc = length(rgb / max(lum, 0.02) - t3 / max(tl, 0.02));
    colour = (1.0 - smoothstep(lerp(0.10, 0.30, sensitivity), lerp(0.22, 0.55, sensitivity), dc)) * smoothstep(tl * 0.42, tl * 0.68, lum);
  } else {
    float satMax = lerp(0.22, 0.48, sensitivity);
    float lumMin = lerp(0.42, 0.22, sensitivity);
    colour = (1.0 - smoothstep(satMax * 0.7, satMax, sat)) * smoothstep(lumMin, lumMin + 0.12, lum);
  }
  float mask = colour * (1.0 - smoothstep(0.10, 0.20, red)) * area;
  if (show_mask > 0.5) return float4(lerp(rgb, float3(1.0, 0.0, 1.0), mask * 0.85), c.a);
  float k = clamp(mask * strength, 0.0, 1.0);
  float3 white = float3(lum, lum, lum) + float3(0.0, 0.0, max(yel, 0.0) * 0.35);
  float3 outc = lerp(rgb, white, k);
  outc = outc + mask * brighten * 0.18 * (1.0 - outc);
  return float4(saturate(outc), c.a);
}
`;
class Teeth {
  constructor(o) { Object.assign(this, o); this.track = null; this.lastSend = 0; this.pending = null; this.sm = null; }   // obs, cfg, saveCfg, cam (CamStudio), log
  S() {
    const t = this.cfg().teeth || {}, f = this.cam.settings().face;
    const def = { x: f.x, y: Math.min(0.95, f.y + f.r * 0.55), w: f.r * 0.3, h: f.r * 0.22 };   // w in picture widths, h in picture heights
    return { on: !!t.on, strength: t.strength != null ? +t.strength : 0.5, brighten: t.brighten != null ? +t.brighten : 0.25, sensitivity: t.sensitivity != null ? +t.sensitivity : 0.5,
      follow: !!t.follow, spot: t.spot && isFinite(t.spot.x) ? t.spot : def, size: t.size != null ? +t.size : 1, mask: !!t.mask, shade: t.shade && isFinite(t.shade.r) ? t.shade : null };
  }
  set(n) {
    const c = Object.assign({}, this.cfg().teeth || {});
    for (const k of ['on', 'follow', 'mask']) if (n[k] != null) c[k] = !!n[k];
    for (const k of ['strength', 'brighten', 'sensitivity']) if (n[k] != null && isFinite(n[k])) c[k] = Math.max(0, Math.min(1, +n[k]));
    if (n.size != null && isFinite(n.size)) c.size = Math.max(0.5, Math.min(2.5, +n.size));
    if (n.shade === null) delete c.shade; else if (n.shade && isFinite(n.shade.r)) c.shade = { r: clamp(n.shade.r, 0, 1), g: clamp(n.shade.g, 0, 1), b: clamp(n.shade.b, 0, 1) };
    if (n.spot && isFinite(n.spot.x) && isFinite(n.spot.y)) c.spot = { x: clamp(n.spot.x, 0, 1), y: clamp(n.spot.y, 0, 1), w: clamp(n.spot.w || 0.08, 0.02, 0.5), h: clamp(n.spot.h || 0.05, 0.01, 0.4) };
    this.cfg().teeth = c; this.saveCfg();
    return this.apply();
  }
  // where the mouth is now: the tracker's latest (if following and fresh) or the hand-set spot; "size" makes the oval bigger
  spot() {
    const S = this.S(), t = this.track && Date.now() - this.track.at < 3000 && S.follow ? this.track : S.spot;
    return { x: t.x, y: t.y, w: t.w * S.size, h: t.h * S.size };
  }
  async aspect() { try { const t = this.cam.home && this.cam.home.t; if (t && t.sourceWidth && t.sourceHeight) return t.sourceWidth / t.sourceHeight; } catch (e) { /* default */ } return 16 / 9; }
  async settingsFor() {
    const S = this.S(), p = this.spot();
    return Object.assign({ strength: S.strength, brighten: S.brighten, sensitivity: S.sensitivity, mx: p.x, my: p.y, mw: p.w, mh: p.h, aspect: await this.aspect(), show_mask: S.mask ? 1 : 0,
      learned: S.shade ? 1 : 0, tr: S.shade ? S.shade.r : 0.85, tg: S.shade ? S.shade.g : 0.82, tb: S.shade ? S.shade.b : 0.7 }, this.polySettings());
  }
  // the lip outline from the tracker, made a touch bigger by the "size" slider, or the plain oval when not tracking
  polySettings() {
    const S = this.S(), t = this.track;
    if (!(S.follow && t && t.poly && Date.now() - t.at < 3000)) return { use_poly: 0, closed: 0 };
    const k = 0.92 + (S.size - 1) * 0.5, cx = t.poly.reduce((a, q) => a + q[0], 0) / t.poly.length, cy = t.poly.reduce((a, q) => a + q[1], 0) / t.poly.length, o = { use_poly: 1, closed: t.closed ? 1 : 0, feather: 0.0035 };
    t.poly.forEach((q, i) => { o['p' + i + 'x'] = cx + (q[0] - cx) * k; o['p' + i + 'y'] = cy + (q[1] - cy) * k; });
    return o;
  }
  // put the filter on the camera (or take it off) and send the numbers
  async apply() {
    if (!this.obs.ready) return { error: 'OBS is not connected' };
    let it; try { it = await this.cam.item(); } catch (e) { return { error: e.message }; }
    const S = this.S();
    const { filters } = await this.obs.req('GetSourceFilterList', { sourceName: it.name }).catch(() => ({ filters: [] }));
    const has = (filters || []).some((f) => f.filterName === FILTER);
    if (!S.on) { if (has) await this.obs.req('RemoveSourceFilter', { sourceName: it.name, filterName: FILTER }).catch(() => {}); return { ok: true, on: false }; }
    const settings = Object.assign({ shader_text: SHADER, from_file: false }, await this.settingsFor());
    try {
      if (!has) await this.obs.req('CreateSourceFilter', { sourceName: it.name, filterName: FILTER, filterKind: 'shader_filter', filterSettings: settings });
      else await this.obs.req('SetSourceFilterSettings', { sourceName: it.name, filterName: FILTER, filterSettings: settings, overlay: true });
      await this.obs.req('SetSourceFilterEnabled', { sourceName: it.name, filterName: FILTER, filterEnabled: true }).catch(() => {});
    } catch (e) { return { error: 'Teeth whitening needs the free "Shaderfilter" plugin for OBS (obs-shaderfilter). Install it, restart OBS, then switch it on again.' }; }
    this.source = it.name;
    return { ok: true, on: true, camera: it.name };
  }
  // the tracker page found the mouth (0..1 of the camera picture): the oval, plus 10 points around the inside of the lips.
  // Smoothed lightly (fast moves follow quickly, small jitters are calmed) and sent up to ~14 times a second.
  tracked(m) {
    if (!m || !isFinite(m.x) || !isFinite(m.y)) return;
    this.lastTrack = Date.now();
    const s = this.sm, mv = s ? Math.hypot(m.x - s.x, m.y - s.y) : 1, a = Math.min(0.9, 0.35 + mv * 40);
    const poly = Array.isArray(m.poly) && m.poly.length === 10 && m.poly.every((q) => isFinite(q[0]) && isFinite(q[1])) ? m.poly.map((q) => [clamp(q[0], 0, 1), clamp(q[1], 0, 1)]) : null;
    this.sm = s ? { x: s.x + (m.x - s.x) * a, y: s.y + (m.y - s.y) * a, w: s.w + (clamp(m.w, 0.02, 0.5) - s.w) * a, h: s.h + (clamp(m.h, 0.01, 0.4) - s.h) * a,
      poly: poly && s.poly ? poly.map((q, i) => [s.poly[i][0] + (q[0] - s.poly[i][0]) * a, s.poly[i][1] + (q[1] - s.poly[i][1]) * a]) : poly } : { x: m.x, y: m.y, w: clamp(m.w, 0.02, 0.5), h: clamp(m.h, 0.01, 0.4), poly };
    this.track = Object.assign({ at: Date.now(), closed: !!m.closed }, this.sm);
    const S = this.S(); if (!S.on || !S.follow || !this.source || !this.obs.ready) return;
    if (Date.now() - this.lastSend < 70) return;
    this.lastSend = Date.now();
    const p = this.spot();
    this.obs.req('SetSourceFilterSettings', { sourceName: this.source, filterName: FILTER, filterSettings: Object.assign({ mx: p.x, my: p.y, mw: p.w, mh: p.h }, this.polySettings()), overlay: true }).catch(() => {});
  }
  // a small still for the tracker page
  async frame(width) {
    let it; try { it = await this.cam.item(); } catch (e) { return { error: e.message }; }
    const r = await this.obs.req('GetSourceScreenshot', { sourceName: it.name, imageFormat: 'jpg', imageWidth: Math.max(160, Math.min(960, width || 480)), imageCompressionQuality: 70 });
    return { image: r.imageData };
  }
  info() { return Object.assign(this.S(), { tracking: !!(this.track && Date.now() - this.track.at < 3000), track: this.track, filter: FILTER }); }
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, +n)); }
module.exports = { Teeth, SHADER, FILTER };
