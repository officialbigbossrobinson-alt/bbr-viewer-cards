// Tiny 3D toolkit built on the browser's own 3D engine (CSS 3D), used by all battle scenes.
// World units are px, y points UP, z points towards the camera.
window.S3D = (function () {
  const CSS = `
  .s3-view{position:absolute;overflow:hidden}
  .s3-cam,.s3-world,.s3-g{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}
  .s3-face,.s3-plane{position:absolute;box-sizing:border-box}
  .s3-bb{position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d}
  .s3-bb>*{position:absolute;transform:translate(-50%,-100%)}
  .s3-label{white-space:nowrap;font-family:'Barlow Condensed',sans-serif;font-weight:800;letter-spacing:1px;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.9);text-align:center}
  `;
  function css() {
    if (document.getElementById('s3d-css')) return;
    const s = document.createElement('style'); s.id = 's3d-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  function div(cls, style) { const d = document.createElement('div'); if (cls) d.className = cls; if (style) d.style.cssText = style; return d; }
  const pos = (x, y, z) => 'translate3d(' + (x || 0) + 'px,' + (-(y || 0)) + 'px,' + (z || 0) + 'px)';

  function shade(hex, f) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
    return 'rgb(' + c.join(',') + ')';
  }

  // group: a movable container. rot = {x,y,z} degrees.
  function group(x, y, z, rot) {
    const g = div('s3-g');
    g.style.transform = pos(x, y, z) + rotStr(rot);
    return g;
  }
  function rotStr(r) { return r ? ' rotateY(' + (r.y || 0) + 'deg) rotateX(' + (r.x || 0) + 'deg) rotateZ(' + (r.z || 0) + 'deg)' : ''; }
  function place(el, x, y, z, rot, extra) { el.style.transform = pos(x, y, z) + rotStr(rot) + (extra || ''); }

  // box sitting on its base: w (x) × h (y) × d (z). o.color, or per-face o.front/o.top/... (any CSS background)
  function box(w, h, d, o) {
    o = o || {};
    const g = div('s3-g');
    const c = o.color || '#888';
    const faces = [
      ['front', w, h, 'translateY(' + (-h / 2) + 'px) translateZ(' + (d / 2) + 'px)', o.front || shade(c, 1)],
      ['back', w, h, 'translateY(' + (-h / 2) + 'px) rotateY(180deg) translateZ(' + (d / 2) + 'px)', o.back || shade(c, 0.7)],
      ['right', d, h, 'translateY(' + (-h / 2) + 'px) rotateY(90deg) translateZ(' + (w / 2) + 'px)', o.right || o.side || shade(c, 0.8)],
      ['left', d, h, 'translateY(' + (-h / 2) + 'px) rotateY(-90deg) translateZ(' + (w / 2) + 'px)', o.left || o.side || shade(c, 0.78)],
      ['top', w, d, 'translateY(' + (-h / 2) + 'px) rotateX(90deg) translateZ(' + (h / 2) + 'px)', o.top || shade(c, 1.18)]
    ];
    if (o.bottom) faces.push(['bottom', w, d, 'translateY(' + (-h / 2) + 'px) rotateX(-90deg) translateZ(' + (h / 2) + 'px)', o.bottom]);
    for (const [name, fw, fh, tf, bg] of faces) {
      if (o.skip && o.skip.includes(name)) continue;
      const f = div('s3-face', 'left:' + (-fw / 2) + 'px;top:' + (-fh / 2) + 'px;width:' + fw + 'px;height:' + fh + 'px;transform:' + tf + ';background:' + bg + (o.radius ? ';border-radius:' + o.radius + 'px' : '') + (o.faceCss ? ';' + o.faceCss : ''));
      f.dataset.face = name;
      if (o.html && o.html[name]) f.innerHTML = o.html[name];
      g.appendChild(f);
    }
    if (o.x != null || o.y != null || o.z != null || o.rot) place(g, o.x, o.y, o.z, o.rot);
    return g;
  }

  // flat ground plane w × d at height y (content: CSS background / html)
  function plane(w, d, o) {
    o = o || {};
    const p = div('s3-plane', 'left:' + (-w / 2) + 'px;top:' + (-d / 2) + 'px;width:' + w + 'px;height:' + d + 'px;background:' + (o.bg || '#333') + ';' + (o.css || ''));
    p.style.transform = pos(o.x, o.y, o.z) + ' rotateX(90deg)';
    if (o.html) p.innerHTML = o.html;
    return p;
  }
  // upright wall w × h facing the camera (+z), base at y
  function wall(w, h, o) {
    o = o || {};
    const p = div('s3-plane', 'left:' + (-w / 2) + 'px;top:' + (-h) + 'px;width:' + w + 'px;height:' + h + 'px;background:' + (o.bg || '#333') + ';' + (o.css || ''));
    p.style.transform = pos(o.x, o.y, o.z) + rotStr(o.rot);
    p.style.transformOrigin = '50% 100%';
    if (o.html) p.innerHTML = o.html;
    return p;
  }
  // round blob shadow on the ground
  function shadow(r, o) {
    o = o || {};
    return plane(r * 2, r * 2 * (o.squash || 1), { x: o.x, y: 1, z: o.z, bg: 'radial-gradient(closest-side,rgba(0,0,0,' + (o.alpha || 0.45) + '),rgba(0,0,0,0))' });
  }

  // scene with a camera. cam params: tx,ty,tz (look-at point), dist, pitch (deg, + = looking down), yaw (deg)
  function scene(parent, o) {
    css();
    const view = div('s3-view', 'left:0;top:0;width:' + o.w + 'px;height:' + o.h + 'px;perspective:' + (o.persp || 1200) + 'px;perspective-origin:50% ' + (o.horizon || 45) + '%;' + (o.css || ''));
    const cam = div('s3-cam');
    const world = div('s3-world');
    cam.style.top = (o.h * (o.centerY || 0.5)) + 'px';
    cam.appendChild(world);
    view.appendChild(cam);
    parent.appendChild(view);
    const P = o.persp || 1200;
    const st = { tx: 0, ty: 0, tz: 0, dist: 1500, pitch: 15, yaw: 0, roll: 0, shake: 0 };
    const billboards = new Set();
    let raf = null;
    function apply() {
      let sx = 0, sy = 0;
      if (st.shake > 0.2) { sx = (Math.random() - 0.5) * st.shake; sy = (Math.random() - 0.5) * st.shake; }
      cam.style.transform = 'translate(' + sx + 'px,' + sy + 'px) translateZ(' + (P - st.dist) + 'px) rotateZ(' + st.roll + 'deg) rotateX(' + (-st.pitch) + 'deg) rotateY(' + st.yaw + 'deg) translate3d(' + (-st.tx) + 'px,' + st.ty + 'px,' + (-st.tz) + 'px)';
      const face = ' rotateY(' + (-st.yaw) + 'deg) rotateX(' + st.pitch + 'deg)';
      for (const b of billboards) b.style.transform = b._pos + face;
    }
    function set(p) { Object.assign(st, p); apply(); }
    // smooth camera move
    function to(p, ms, ease) {
      cancelAnimationFrame(raf);
      const from = Object.assign({}, st), t0 = performance.now();
      const e = ease || ((t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2));
      return new Promise((res) => {
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms), f = e(k);
          for (const key of Object.keys(p)) st[key] = from[key] + (p[key] - from[key]) * f;
          apply();
          if (k < 1) raf = requestAnimationFrame(step); else res();
        };
        raf = requestAnimationFrame(step);
      });
    }
    function shake(amount, ms) {
      const t0 = performance.now();
      const step = (now) => {
        const k = (now - t0) / ms;
        st.shake = k < 1 ? amount * (1 - k) : 0;
        apply();
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    // billboard: html that always faces the camera, anchored at its bottom-centre
    function sprite(html, x, y, z) {
      const b = div('s3-bb');
      b.innerHTML = html;
      b._pos = pos(x, y, z);
      billboards.add(b);
      world.appendChild(b);
      apply();
      return b;
    }
    function moveSprite(b, x, y, z) { b._pos = pos(x, y, z); }
    function removeSprite(b) { billboards.delete(b); b.remove(); }
    function add(el) { world.appendChild(el); return el; }
    function destroy() { cancelAnimationFrame(raf); billboards.clear(); view.remove(); }
    apply();
    return { view, cam, world, st, set, to, shake, sprite, moveSprite, removeSprite, add, apply, destroy };
  }

  // simple low-poly person: legs, torso, arms, head. Returns group with .parts
  function person(o) {
    o = o || {};
    const kit = o.kit || '#d33', shorts = o.shorts || '#1b1f25', skin = o.skin || '#d9a77c', s = o.scale || 1;
    const g = div('s3-g');
    const P = (w, h, d, c, x, y, z, extra) => { const b = box(w * s, h * s, d * s, Object.assign({ color: c }, extra || {})); place(b, x * s, y * s, z * s); g.appendChild(b); return b; };
    const legL = P(14, 46, 16, shorts, -10, 0, 0), legR = P(14, 46, 16, shorts, 10, 0, 0);
    const torso = P(40, 54, 22, kit, 0, 46, 0);
    if (o.number) torso.querySelector('[data-face="back"]').innerHTML = '<div class="s3-label" style="font-size:' + (20 * s) + 'px;line-height:' + (54 * s) + 'px;color:rgba(255,255,255,.85)">' + o.number + '</div>';
    const armL = P(11, 46, 12, kit, -26, 52, 0), armR = P(11, 46, 12, kit, 26, 52, 0);
    const head = P(22, 22, 22, skin, 0, 101, 0, { radius: 6 });
    if (o.hair) { const h = box(24 * s, 7 * s, 24 * s, { color: o.hair, radius: 5 }); place(h, 0, 120 * s, 0); g.appendChild(h); }
    if (o.gloves) { for (const x of [-26, 26]) { const gl = box(14 * s, 12 * s, 14 * s, { color: o.gloves, radius: 4 }); place(gl, x * s, 44 * s, 0); g.appendChild(gl); } }
    if (o.pack) { const pk = box(30 * s, 34 * s, 14 * s, { color: o.pack }); place(pk, 0, 56 * s, -16 * s); g.appendChild(pk); }
    g.parts = { legL, legR, torso, armL, armR, head };
    if (o.x != null) place(g, o.x, o.y, o.z, o.rot);
    return g;
  }

  return { css, div, pos, place, rotStr, shade, group, box, plane, wall, shadow, scene, person };
})();
