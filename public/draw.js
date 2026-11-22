/* BBR analysis drawings: one renderer for the stream (overlay) and the drawing desk (dashboard / phone).
   Shapes use 0..1 coordinates inside the replay clip, so they line up whatever size they're drawn at.
   { id, type: ring|arrow|run|pass|line|zone|pen|tag|text, color, w (1-3), p: [[x,y],...], r (ring), text } */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = { red: '#e3132c', yellow: '#f5c400', white: '#f6f7fa', blue: '#4dc3ff', green: '#3dff9a', navy: '#0d2459' };
  const col = (c) => COLORS[c] || (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#e3132c');
  function head(x1, y1, x2, y2, size, color) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = size;
    const p = [[x2 + Math.cos(a) * s * 0.4, y2 + Math.sin(a) * s * 0.4], [x2 - Math.cos(a - 0.5) * s, y2 - Math.sin(a - 0.5) * s], [x2 - Math.cos(a + 0.5) * s, y2 - Math.sin(a + 0.5) * s]];
    return '<path class="hd" d="M' + p.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L') + ' Z" fill="' + color + '"/>';
  }
  // one shape -> svg (W, H = pixel size of the clip area)
  function shape(s, W, H, k, isNew) {
    const P = (s.p || []).map((q) => [q[0] * W, q[1] * H]), c = col(s.color), sw = [0, 4, 7, 11][s.w || 2] * k, cls = 'sh' + (isNew ? ' nw' : '');
    const glow = 'filter="url(#bbrglow)"';
    if (!P.length) return '';
    if (s.type === 'ring') {
      const rx = Math.max(6, (s.r || 0.03) * W), ry = rx * 0.38;
      return '<g class="' + cls + ' ring" style="transform-origin:' + P[0][0] + 'px ' + P[0][1] + 'px"><ellipse cx="' + P[0][0] + '" cy="' + P[0][1] + '" rx="' + rx + '" ry="' + ry + '" fill="' + c + '" fill-opacity=".22" stroke="' + c + '" stroke-width="' + sw + '" ' + glow + '/></g>';
    }
    if (s.type === 'tag' || s.type === 'text') {
      const fs = (s.type === 'tag' ? 34 : 40) * k * (0.8 + (s.w || 2) * 0.15), t = esc(s.text || (s.type === 'tag' ? 'PLAYER' : 'TEXT'));
      const tw = t.length * fs * 0.66 + 28 * k;
      if (s.type === 'text') return '<g class="' + cls + ' tx"><text x="' + P[0][0] + '" y="' + P[0][1] + '" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="' + fs + '" fill="' + c + '" stroke="#000" stroke-opacity=".55" stroke-width="' + 3 * k + '" paint-order="stroke">' + t + '</text></g>';
      return '<g class="' + cls + ' tg"><rect x="' + (P[0][0] - tw / 2) + '" y="' + (P[0][1] - fs * 1.15) + '" width="' + tw + '" height="' + fs * 1.3 + '" fill="' + c + '"/><text x="' + P[0][0] + '" y="' + (P[0][1] - fs * 0.15) + '" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="' + fs + '" fill="' + (s.color === 'yellow' || s.color === 'white' || s.color === 'green' ? '#061233' : '#fff') + '">' + t + '</text></g>';
    }
    if (s.type === 'zone') {
      return '<g class="' + cls + ' zn"><polygon points="' + P.map((q) => q.join(',')).join(' ') + '" fill="' + c + '" fill-opacity=".2" stroke="' + c + '" stroke-width="' + Math.max(2, sw * 0.6) + '" stroke-dasharray="' + 14 * k + ' ' + 10 * k + '"/></g>';
    }
    let d;
    if (s.type === 'run' && P.length >= 3) d = 'M' + P[0].join(' ') + ' Q' + P[1].join(' ') + ' ' + P[2].join(' ');
    else if (s.type === 'pen') d = 'M' + P.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L');
    else if (P.length >= 2) d = 'M' + P[0].join(' ') + ' L' + P[P.length - 1].join(' ');
    else return '';
    const end = P[P.length - 1], before = s.type === 'run' && P.length >= 3 ? P[1] : P[P.length - 2] || P[0];
    const dash = s.type === 'pass' ? ' stroke-dasharray="' + 18 * k + ' ' + 14 * k + '"' : '';
    const hasHead = /^(arrow|run|pass)$/.test(s.type);
    return '<g class="' + cls + ' ln' + (dash ? ' ps' : '') + '"><path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round"' + dash + (dash ? '' : ' pathLength="1000"') + ' ' + (s.type === 'line' ? glow : '') + '/>' + (hasHead ? head(before[0], before[1], end[0], end[1], Math.max(16, sw * 3.2), c) : '') + '</g>';
  }
  function handles(s, W, H) {
    if (!s) return '';
    let pts = (s.p || []).map((q) => [q[0] * W, q[1] * H]);
    if (s.type === 'pen') pts = pts.slice(0, 1);
    if (s.type === 'ring' && pts[0]) pts = [pts[0], [pts[0][0] + (s.r || 0.03) * W, pts[0][1]]];
    return pts.map((q, i) => '<circle class="hdl" data-h="' + i + '" cx="' + q[0] + '" cy="' + q[1] + '" r="11" fill="#fff" stroke="#061233" stroke-width="3"/>').join('');
  }
  // full svg markup for a list of shapes
  function svg(shapes, W, H, o) {
    o = o || {};
    const k = W / 1920, seen = o.seen || null;
    const defs = '<defs><filter id="bbrglow" filterUnits="userSpaceOnUse" x="' + (-W * 0.2) + '" y="' + (-H * 0.2) + '" width="' + W * 1.4 + '" height="' + H * 1.4 + '"><feGaussianBlur stdDeviation="' + 5 * k + '" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    const body = (shapes || []).map((s) => shape(s, W, H, Math.max(0.35, k), seen ? !seen.has(s.id) : false)).join('');
    const sel = o.selected ? handles((shapes || []).find((s) => s.id === o.selected), W, H) : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="position:absolute;inset:0;overflow:visible">' + defs + body + sel + '</svg>';
  }
  // which shape is under a point (0..1 coordinates)? top-most first
  function hit(shapes, x, y, W, H) {
    const px = x * W, py = y * H;
    const near = (a, b, t) => Math.hypot(a[0] - b[0], a[1] - b[1]) < t;
    const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
    for (let i = (shapes || []).length - 1; i >= 0; i--) {
      const s = shapes[i], P = (s.p || []).map((q) => [q[0] * W, q[1] * H]), pt = [px, py];
      if (s.type === 'ring') { const rx = (s.r || 0.03) * W, ry = rx * 0.38, dx = (px - P[0][0]) / rx, dy = (py - P[0][1]) / ry; if (dx * dx + dy * dy < 1.6) return s; }
      else if (s.type === 'tag' || s.type === 'text') { if (Math.abs(px - P[0][0]) < 110 * W / 1920 + 40 && py < P[0][1] + 15 && py > P[0][1] - 60 * W / 1920 - 20) return s; }
      else if (s.type === 'zone') { let inside = false; for (let a = 0, b = P.length - 1; a < P.length; b = a++) { if ((P[a][1] > py) !== (P[b][1] > py) && px < (P[b][0] - P[a][0]) * (py - P[a][1]) / (P[b][1] - P[a][1]) + P[a][0]) inside = !inside; } if (inside) return s; }
      else { for (let j = 1; j < P.length; j++) if (segD(pt, P[j - 1], P[j]) < 18) return s; if (P.length === 1 && near(pt, P[0], 18)) return s; }
    }
    return null;
  }
  const CSS = `
  .bbrdraw .sh.nw.ln:not(.ps) path{stroke-dasharray:1000;stroke-dashoffset:1000;animation:bbrDraw .55s ease-out forwards}
  .bbrdraw .sh.nw.ln .hd{opacity:0;animation:bbrFade .2s .45s forwards}
  .bbrdraw .sh.nw.ring{animation:bbrPop .45s cubic-bezier(.2,1.6,.4,1)}
  .bbrdraw .sh.nw.ps,.bbrdraw .sh.nw.tg,.bbrdraw .sh.nw.tx,.bbrdraw .sh.nw.zn{animation:bbrFade .35s}
  @keyframes bbrDraw{to{stroke-dashoffset:0}}@keyframes bbrFade{from{opacity:0}to{opacity:1}}@keyframes bbrPop{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}`;
  window.BBRDRAW = { svg, hit, COLORS, CSS };
})();
