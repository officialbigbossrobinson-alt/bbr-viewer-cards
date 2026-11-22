// BBR 3D stadium: a small WebGL2 engine for the penalty games.
// Loads the stadium (public/3d/stadium.glb) and the Mixamo player (public/3d/player.glb, made by tools/fbx2glb.py),
// paints club kits onto the player, and draws only while a game is on screen.
// Stadium: "Soccer Stadium" by nermin (Sketchfab), CC-BY 4.0. Player and animations: Mixamo.
window.G3 = (function () {
  'use strict';
  const BASE = '/3d/';
  // ---------- small maths ----------
  const M4 = {
    id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    mul(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
    trs(t, q, s) { t = t || [0, 0, 0]; q = q || [0, 0, 0, 1]; s = s || [1, 1, 1]; const [x, y, z, w] = q;
      return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0, 2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1]; },
    persp(fov, a, n, f) { const t = 1 / Math.tan(fov / 2); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; },
    look(e, c, u) { const z = norm(sub(e, c)), x = norm(cross(u, z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; },
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp = (a, b, t) => a + (b - a) * t, lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const tp = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  const yq = (deg) => { const a = deg * Math.PI / 360; return [0, Math.sin(a), 0, Math.cos(a)]; };
  function invert(m) { const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
    return [(a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d, (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d, (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d, (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d]; }

  // ---------- state ----------
  let gl = null, cv = null, loadP = null, err = null, ready = false;
  let host = null, layer = null, raf = 0, running = false, W = 1560, H = 660;
  let pg, spg, U, U2, draws = [], cube, sphere, boardsTex = null, JT = null, maskData = null, atlasImg = null;
  let SK = null;                    // skinned player data
  const kitCache = new Map();       // kit key -> GL texture
  const players = new Map();        // id -> player
  const sprites = new Set();
  let onFrame = null;
  // quality: render scale (pixels drawn vs. shown) and frame caps (full rate only while the ball is moving)
  const QUALITY = { high: { scale: 1, fps: 60, idle: 60 }, balanced: { scale: 0.85, fps: 60, idle: 30 }, performance: { scale: 0.7, fps: 30, idle: 30 } };
  let Q = QUALITY.balanced, action = false, lastDraw = 0;
  // v29: time of day. sun direction, how bright the shade is, and a colour grade over everything
  const TOD = {
    day: { sun: [0.35, 1, -0.45], amb: 0.55, grade: [1.08, 1.06, 1.0], label: 'AFTERNOON' },
    golden: { sun: [0.9, 0.5, -0.3], amb: 0.5, grade: [1.12, 0.96, 0.8], label: 'GOLDEN HOUR' },
    dusk: { sun: [-0.7, 0.45, 0.2], amb: 0.5, grade: [1.0, 0.84, 0.9], label: 'DUSK' },
    night: { sun: [0.2, 1, -0.3], amb: 0.45, grade: [1, 1, 1], label: 'UNDER THE LIGHTS' },
  };
  const scene = { light: TOD.night, ball: { p: [0, 0, 0], show: false, spin: 0, side: 0 }, cam: { eye: [0, 20, 0], at: [0, 0, 100], fov: 40 }, camTw: null, camFn: null, shake: { a: 0, until: 0, dur: 1 }, t0: performance.now() };
  // pitch geometry, filled in from the model when it loads
  const P = { cx: 202, gz: 421, gw: 40, gh: 26.2, spotZ: 303, k: 0.1075 };

  const CT = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array };
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  function parseGlb(buf) {
    const dv = new DataView(buf), jl = dv.getUint32(12, true);
    const J = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
    const bo = 20 + jl + 8;
    const acc = (i) => { const a = J.accessors[i], v = J.bufferViews[a.bufferView], T = CT[a.componentType], n = NC[a.type], off = bo + (v.byteOffset || 0) + (a.byteOffset || 0);
      if (v.byteStride && v.byteStride !== n * T.BYTES_PER_ELEMENT) { const out = new T(a.count * n), src = new DataView(buf); for (let k = 0; k < a.count; k++) for (let j = 0; j < n; j++) { const o = off + k * v.byteStride + j * T.BYTES_PER_ELEMENT; out[k * n + j] = T === Float32Array ? src.getFloat32(o, true) : T === Uint16Array ? src.getUint16(o, true) : T === Uint8Array ? src.getUint8(o) : src.getUint32(o, true); } return out; }
      return new T(buf.slice(off, off + a.count * n * T.BYTES_PER_ELEMENT)); };
    const img = (i) => { const im = J.images[i], v = J.bufferViews[im.bufferView]; return createImageBitmap(new Blob([new Uint8Array(buf, bo + (v.byteOffset || 0), v.byteLength)], { type: im.mimeType }), { imageOrientation: 'none' }); };
    return { J, acc, img };
  }
  function texFrom(src, repeat) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const w = repeat === false ? gl.CLAMP_TO_EDGE : gl.REPEAT; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w); return t;
  }

  // ---------- shaders ----------
  const FS = `#version 300 es
  precision highp float; in vec3 vn; in vec2 vuv; in vec3 wp; uniform sampler2D t; uniform int ht; uniform vec4 bc; uniform vec3 sun; uniform float amb; uniform vec3 eye; uniform int mode; uniform float unlit; uniform float tm; uniform vec4 tint; uniform mat3 BR; uniform vec3 grade; out vec4 o;
  float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
  void main(){ vec3 N = normalize(vn); if (mode == 4) { o = vec4(0., 0., 0., tint.a * pow(abs(N.y), 1.5)); return; }
    vec4 c = bc; if (ht==1) c *= texture(t, vuv);
    if (mode != 3 && c.a < 0.4) discard;
    if (mode == 1) { vec3 cs = vec3(4.6, 3.6, 4.6); vec3 cp = floor(wp / cs); float r = h3(cp), r2 = h3(cp + 7.1); vec3 f = fract(wp / cs);
      vec3 shirt = r < .45 ? vec3(.04,.05,.08) : r < .58 ? vec3(.0,.6,.33) : r < .66 ? vec3(.7,.7,.72) : r < .73 ? vec3(.5,.06,.08) : r < .78 ? vec3(.7,.55,.1) : r < .9 ? vec3(.1,.13,.25) : vec3(.25,.25,.28);
      float bob = step(.5, fract(tm * (1.3 + r2) + r)) * .12 * step(.5, r2);
      float head = step(.62 - bob, f.y) * step(.25, f.x) * step(f.x, .75); vec3 skin = mix(vec3(.85,.62,.48), vec3(.35,.22,.16), r2);
      c.rgb = mix(shirt * (.55 + .45*r2), skin * .8, head); if (h3(cp+3.3) < .12) c.rgb = vec3(.18,.18,.2); if (h3(cp + floor(tm*3.)) > .997) c.rgb = vec3(2.5); }
    if (mode == 3) { vec3 A = abs(N); vec2 q = A.z > A.x && A.z > A.y ? wp.xy : A.x > A.y ? wp.zy : wp.xz; vec2 g = abs(fract(q / 1.6) - .5); if (max(g.x, g.y) < .445) discard; c = vec4(.92,.92,.92,1.); }
    if (mode == 2) { const float P = 1.618; float m = 0.; vec3 D[6] = vec3[6](vec3(0,1,P), vec3(0,-1,P), vec3(1,P,0), vec3(-1,P,0), vec3(P,0,1), vec3(-P,0,1));
      vec3 Nb = BR * N; for (int i = 0; i < 6; i++) m = max(m, abs(dot(Nb, normalize(D[i])))); c.rgb = mix(vec3(.97), vec3(.06,.07,.09), smoothstep(.93,.95,m)); N = vn; }
    float d = abs(dot(N, normalize(sun)));
    vec3 col = c.rgb * mix(amb + (1.-amb) * d, 1., unlit); col = mix(col, tint.rgb, tint.a); col *= mix(grade, vec3(1.), unlit * .5); o = vec4(col, 1.); }`;
  const VS = `#version 300 es
  in vec3 p; in vec3 n; in vec2 uv; uniform mat4 M, VP; uniform mat3 NM; out vec3 vn; out vec2 vuv; out vec3 wp;
  void main(){ vec4 w = M * vec4(p,1.); wp = w.xyz; vn = NM * n; vuv = uv; gl_Position = VP * w; }`;
  const SVS = `#version 300 es
  in vec3 p; in vec3 n; in vec2 uv; in vec4 jj; in vec4 ww; uniform highp sampler2D JT; uniform int jo; uniform mat4 M, VP; out vec3 vn; out vec2 vuv; out vec3 wp;
  mat4 jm(float j){ int i = (jo + int(j)) * 4; ivec2 q = ivec2(i % 1024, i / 1024); return mat4(texelFetch(JT, q, 0), texelFetch(JT, q + ivec2(1,0), 0), texelFetch(JT, q + ivec2(2,0), 0), texelFetch(JT, q + ivec2(3,0), 0)); }
  void main(){ mat4 S = jm(jj.x)*ww.x + jm(jj.y)*ww.y + jm(jj.z)*ww.z + jm(jj.w)*ww.w; vec4 w = M * S * vec4(p,1.); wp = w.xyz; vn = mat3(M*S) * n; vuv = uv; gl_Position = VP * w; }`;
  function prog(vs, fs) {
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p;
  }
  const nm3 = (m) => [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];

  // ---------- loading ----------
  async function doLoad() {
    cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block';
    gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available in this browser source (OBS: turn on "Browser Source Hardware Acceleration")');
    if (!gl.getExtension('EXT_color_buffer_float')) { /* only needed for render targets; float textures are core in WebGL2 */ }
    pg = prog(VS, FS); spg = prog(SVS, FS);
    U = (n) => gl.getUniformLocation(pg, n); U2 = (n) => gl.getUniformLocation(spg, n);
    const [sb, pb, mk] = await Promise.all([fetch(BASE + 'stadium.glb').then(okBuf), fetch(BASE + 'player.glb').then(okBuf), fetch(BASE + 'kitmask.png').then((r) => { if (!r.ok) throw new Error('kitmask.png missing'); return r.blob(); }).then((b) => createImageBitmap(b, { imageOrientation: 'none' }))]);
    await loadStadium(sb);
    await loadPlayer(pb);
    const mc = document.createElement('canvas'); mc.width = 1024; mc.height = 1024; const mx = mc.getContext('2d'); mx.drawImage(mk, 0, 0, 1024, 1024); maskData = mx.getImageData(0, 0, 1024, 1024).data;
    makeBoards('#3dff9a');
    JT = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, JT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1024, 16, 0, gl.RGBA, gl.FLOAT, null);
    gl.enable(gl.DEPTH_TEST);
    ready = true;
  }
  const okBuf = (r) => { if (!r.ok) throw new Error(r.url.split('/').pop() + ' missing (' + r.status + ')'); return r.arrayBuffer(); };
  function vao(prg, attrs, idx) {
    const v = gl.createVertexArray(); gl.bindVertexArray(v);
    for (const [name, arr, n] of attrs) { const loc = gl.getAttribLocation(prg, name); if (loc < 0 || !arr) continue; const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, arr instanceof Float32Array ? arr : new Float32Array(arr), gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0); }
    let it = null, cnt = 0; if (idx) { const b = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); cnt = idx.length; it = idx instanceof Uint32Array ? gl.UNSIGNED_INT : idx instanceof Uint8Array ? gl.UNSIGNED_BYTE : gl.UNSIGNED_SHORT; }
    return { v, it, cnt };
  }
  async function loadStadium(buf) {
    const G = parseGlb(buf), J = G.J;
    const tex = await Promise.all((J.images || []).map(async (_, i) => texFrom(await G.img(i))));
    const texOf = (ti) => (ti == null ? null : tex[J.textures[ti].source]);
    let goal = null;
    const walk = (ni, parent) => { const N = J.nodes[ni], L = N.matrix || M4.trs(N.translation, N.rotation, N.scale), Wm = M4.mul(parent, L);
      if (N.mesh != null) for (const pr of J.meshes[N.mesh].primitives) {
        const pos = G.acc(pr.attributes.POSITION), mesh = J.meshes[N.mesh].name || N.name || '';
        const nrm = pr.attributes.NORMAL != null ? G.acc(pr.attributes.NORMAL) : null, uv = pr.attributes.TEXCOORD_0 != null ? G.acc(pr.attributes.TEXCOORD_0) : null;
        let idx = pr.indices != null ? G.acc(pr.indices) : null; if (idx instanceof Uint8Array) idx = new Uint16Array(idx);
        const o = vao(pg, [['p', pos, 3], ['n', nrm, 3], ['uv', uv, 2]], idx); if (!idx) o.cnt = pos.length / 3;
        const mat = J.materials[pr.material] || {}, pbm = mat.pbrMetallicRoughness || {};
        const a = J.accessors[pr.attributes.POSITION];
        const corners = []; for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) corners.push(tp(Wm, [x ? a.max[0] : a.min[0], y ? a.max[1] : a.min[1], z ? a.max[2] : a.min[2]]));
        const bmin = [0, 1, 2].map((k) => Math.min(...corners.map((c) => c[k]))), bmax = [0, 1, 2].map((k) => Math.max(...corners.map((c) => c[k])));
        const mn = mat.name || '';
        const d = Object.assign(o, { corners, W: Wm, NM: nm3(Wm), name: mesh, mat: mn, tex: texOf(pbm.baseColorTexture && pbm.baseColorTexture.index), bc: pbm.baseColorFactor || [1, 1, 1, 1], bmin, bmax,
          mode: /^net/i.test(mesh) ? 3 : mn === 'Mat_7' ? 1 : 0, board: mn === 'Mat.3' });
        draws.push(d);
        if (/^goal_2/i.test(mesh)) goal = d;
      }
      for (const c of N.children || []) walk(c, Wm);
    };
    for (const r of J.scenes[J.scene || 0].nodes) walk(r, M4.id());
    if (goal) { P.cx = (goal.bmin[0] + goal.bmax[0]) / 2; P.gw = (goal.bmax[0] - goal.bmin[0]) / 2 - 1; P.gh = goal.bmax[1] - 1; P.gz = goal.bmin[2] + 1.2; }
    P.k = P.gw / 373; P.spotZ = P.gz - 1100 * P.k;
    // spheres for the ball and its shadow
    const Pp = [], I = [], R = 14; for (let i = 0; i <= R; i++) for (let j = 0; j <= R * 2; j++) { const a = i / R * Math.PI, b = j / (R * 2) * Math.PI * 2; Pp.push(Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)); }
    for (let i = 0; i < R; i++) for (let j = 0; j < R * 2; j++) { const k = i * (R * 2 + 1) + j; I.push(k, k + R * 2 + 1, k + 1, k + 1, k + R * 2 + 1, k + R * 2 + 2); }
    sphere = vao(pg, [['p', Pp, 3], ['n', Pp, 3]], new Uint16Array(I));
  }
  async function loadPlayer(buf) {
    const G = parseGlb(buf), J = G.J;
    const bm = await G.img(0); atlasImg = bm;
    const baseTex = texFrom(bm, false);
    const tx = await Promise.all((J.images || []).map(async (_, i) => (i === 0 ? baseTex : texFrom(await G.img(i), false))));
    const prims = J.meshes[0].primitives.map((pr) => {
      const o = vao(spg, [['p', G.acc(pr.attributes.POSITION), 3], ['n', G.acc(pr.attributes.NORMAL), 3], ['uv', G.acc(pr.attributes.TEXCOORD_0), 2], ['jj', Float32Array.from(G.acc(pr.attributes.JOINTS_0)), 4], ['ww', G.acc(pr.attributes.WEIGHTS_0), 4]], G.acc(pr.indices));
      const m = J.materials[pr.material] || {}, ti = m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture;
      return Object.assign(o, { tex: ti ? tx[J.textures[ti.index].source] : null, kitable: ti && J.textures[ti.index].source === 0 });
    });
    const ibm = G.acc(J.skins[0].inverseBindMatrices), joints = J.skins[0].joints;
    const anims = {}; for (const a of J.animations || []) anims[a.name] = a.channels.map((c) => { const s = a.samplers[c.sampler]; return { node: c.target.node, path: c.target.path, t: G.acc(s.input), v: G.acc(s.output) }; });
    const parent = {}; J.nodes.forEach((nd, i) => (nd.children || []).forEach((c) => { parent[c] = i; }));
    const dur = {}; for (const [k, ch] of Object.entries(anims)) dur[k] = Math.max(...ch.map((c) => c.t[c.t.length - 1]));
    const idx = (nm) => J.nodes.findIndex((n) => (n.name || '').endsWith(':' + nm));
    SK = { J, prims, ibm, ibmM: joints.map((_, k) => Array.from(ibm.subarray(k * 16, k * 16 + 16))), joints, anims, parent, dur, meshNode: J.nodes.findIndex((n) => n.mesh != null), hips: idx('Hips'), rHand: idx('RightHand'), lHand: idx('LeftHand'), head: idx('Head'), rToe: idx('RightToeBase'), lToe: idx('LeftToeBase'), baseTex,
      rootScale: (J.nodes[0].scale || [1, 1, 1])[0] };
    // root motion of each animation (model units, before the root scale)
    SK.rootMove = {}; for (const k of Object.keys(anims)) { const a = localPose(k, 0, false), b = localPose(k, dur[k], false); SK.rootMove[k] = [b[SK.hips].t[0] - a[SK.hips].t[0], b[SK.hips].t[2] - a[SK.hips].t[2]]; }
  }

  // ---------- animation ----------
  function localPose(anim, time, loop) {
    const J = SK.J; const L = J.nodes.map((nd) => ({ t: (nd.translation || [0, 0, 0]).slice(), r: (nd.rotation || [0, 0, 0, 1]).slice(), s: (nd.scale || [1, 1, 1]).slice() }));
    const ch = SK.anims[anim]; if (!ch) return L;
    const D = SK.dur[anim] || 1; let t = loop ? ((time % D) + D) % D : clamp(time, 0, D);
    for (const c of ch) {
      const T = c.t, n = c.path === 'rotation' ? 4 : 3; let i = 0, lo = 0, hi = T.length - 1;
      if (t >= T[hi]) i = Math.max(0, hi - 1); else { while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; } i = lo; }
      const f = T[i + 1] > T[i] ? clamp((t - T[i]) / (T[i + 1] - T[i]), 0, 1) : 0;
      const o = new Array(n); let dq = 0;
      if (n === 4) for (let k = 0; k < 4; k++) dq += c.v[i * 4 + k] * c.v[(i + 1) * 4 + k];
      const sg = dq < 0 ? -1 : 1;
      for (let k = 0; k < n; k++) { const a = c.v[i * n + k], b = c.v[(i + 1) * n + k] * (n === 4 ? sg : 1); o[k] = a + (b - a) * f; }
      if (n === 4) { const l = Math.hypot(o[0], o[1], o[2], o[3]) || 1; for (let k = 0; k < 4; k++) o[k] /= l; }
      L[c.node][c.path === 'rotation' ? 'r' : c.path === 'translation' ? 't' : 's'] = o;
    }
    // looping walk/jog: keep travelling instead of snapping back each cycle
    if (loop && SK.rootMove && SK.rootMove[anim]) { const n = Math.floor(time / D), m = SK.rootMove[anim]; L[SK.hips].t[0] += n * m[0]; L[SK.hips].t[2] += n * m[1]; }
    return L;
  }
  function blendPose(A, B, w) {
    if (w <= 0) return A; if (w >= 1) return B;
    return A.map((a, i) => { const b = B[i]; let d = 0; for (let k = 0; k < 4; k++) d += a.r[k] * b.r[k]; const s = d < 0 ? -1 : 1;
      const r = a.r.map((x, k) => x + (b.r[k] * s - x) * w), l = Math.hypot(...r) || 1;
      return { t: a.t.map((x, k) => x + (b.t[k] - x) * w), r: r.map((x) => x / l), s: a.s.map((x, k) => x + (b.s[k] - x) * w) }; });
  }
  function globalPose(L) {
    const G = []; const g = (i) => { if (G[i]) return G[i]; const m = M4.trs(L[i].t, L[i].r, L[i].s); G[i] = SK.parent[i] != null ? M4.mul(g(SK.parent[i]), m) : m; return G[i]; };
    for (let i = 0; i < L.length; i++) g(i); return G;
  }
  // a player's pose right now: { G: global node matrices, base: world matrix of the model root }
  function playerPose(pl) {
    const a = pl.a; let L = localPose(a.anim, a.t, a.loop);
    if (a.shift) { L[SK.hips].t[0] -= a.shift[0]; L[SK.hips].t[2] -= a.shift[1]; }
    if (pl.b && pl.bw > 0) { const b = pl.b; const L2 = localPose(b.anim, b.t, b.loop); if (b.shift) { L2[SK.hips].t[0] -= b.shift[0]; L2[SK.hips].t[2] -= b.shift[1]; } L = blendPose(L2, L, 1 - pl.bw); }
    const G = globalPose(L);
    const base = M4.mul(M4.trs([pl.pos[0] + (pl.off ? pl.off[0] : 0), (pl.off ? pl.off[1] : 0), pl.pos[1] + (pl.off ? pl.off[2] : 0)], yq(pl.yaw || 0), [pl.mirror ? -1 : 1, 1, 1]), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    return { G, base };
  }
  const jointWorld = (pp, j) => { const m = M4.mul(pp.base, pp.G[j]); return [m[12], m[13], m[14]]; };

  // ---------- kits ----------
  function seeded(s) { let x = 0; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
  function drawPattern(x, k, key) {
    const S = k.shirt, rnd = seeded(key);
    x.fillStyle = S.base; x.fillRect(0, 0, 1024, 1024);
    const strokes = (n, col, wmin, wmax, ang, alpha) => { x.save(); x.globalAlpha = alpha; x.strokeStyle = col; x.lineCap = 'round';
      for (let i = 0; i < n; i++) { const cx = rnd() * 1024, cy = rnd() * 1024, l = 60 + rnd() * 220, a = ang + (rnd() - 0.5) * 0.35; x.lineWidth = wmin + rnd() * (wmax - wmin); x.beginPath(); x.moveTo(cx - Math.cos(a) * l, cy - Math.sin(a) * l); x.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.stroke(); } x.restore(); };
    switch (S.pattern) {
      case 'slash': strokes(70, S.alt, 6, 34, -0.75, 0.85); strokes(40, S.trim, 2, 6, -0.75, 0.6); break;
      case 'brush': strokes(60, S.alt, 10, 44, -0.6, 0.8); strokes(30, S.trim, 3, 10, -0.6, 0.45); break;
      case 'pinstripe': x.fillStyle = S.alt; for (let i = 0; i < 1024; i += 36) x.fillRect(i, 0, 2, 1024); strokes(10, S.alt, 2, 3, -1.1, 0.8); break;
      case 'stripes': x.fillStyle = S.alt; for (let i = 0; i < 1024; i += 96) x.fillRect(i, 0, 48, 1024); break;
      case 'chevron': x.fillStyle = S.alt; for (const [cx, cy, w] of [[175, 330, 330], [550, 820, 260]]) { x.beginPath(); x.moveTo(cx - w * 0.6, cy - w * 0.25); x.lineTo(cx, cy + w * 0.35); x.lineTo(cx + w * 0.6, cy - w * 0.25); x.lineTo(cx + w * 0.6, cy - w * 0.05); x.lineTo(cx, cy + w * 0.55); x.lineTo(cx - w * 0.6, cy - w * 0.05); x.closePath(); x.fill(); } break;
      case 'argyle': x.save(); x.globalAlpha = 0.85; x.fillStyle = S.alt; for (let yy = -64; yy < 1100; yy += 128) for (let xx = (yy / 128) % 2 ? 0 : 64; xx < 1100; xx += 128) { x.beginPath(); x.moveTo(xx, yy - 64); x.lineTo(xx + 40, yy); x.lineTo(xx, yy + 64); x.lineTo(xx - 40, yy); x.closePath(); x.fill(); } x.restore(); break;
      case 'circuit': { const g = x.createLinearGradient(0, 0, 1024, 1024); g.addColorStop(0, S.base); g.addColorStop(0.5, S.trim); g.addColorStop(1, S.base); x.globalAlpha = 0.45; x.fillStyle = g; x.fillRect(0, 0, 1024, 1024); x.globalAlpha = 1;
        x.strokeStyle = S.alt; x.lineWidth = 3; for (let i = 0; i < 46; i++) { let px = rnd() * 1024, py = rnd() * 1024; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 3; s++) { if (s % 2) py += (rnd() - 0.5) * 160; else px += (rnd() - 0.5) * 160; x.lineTo(px, py); } x.stroke(); x.fillStyle = S.alt; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); } break; }
      case 'waves': x.strokeStyle = S.alt; for (let i = 0; i < 18; i++) { x.lineWidth = 8 + rnd() * 22; x.globalAlpha = 0.5 + rnd() * 0.4; x.beginPath(); const y0 = rnd() * 1024; for (let xx = 0; xx <= 1024; xx += 16) x.lineTo(xx, y0 + Math.sin(xx / 70 + i) * 40 + xx * 0.25); x.stroke(); } x.globalAlpha = 1; break;
      case 'tiger': x.fillStyle = S.alt; for (let i = 0; i < 36; i++) { const cx = rnd() * 1024, cy = rnd() * 1024, l = 90 + rnd() * 140, w = 10 + rnd() * 22, a = -0.6 + (rnd() - 0.5) * 0.4; x.beginPath(); x.moveTo(cx - Math.cos(a) * l, cy - Math.sin(a) * l); x.quadraticCurveTo(cx + Math.sin(a) * w, cy - Math.cos(a) * w, cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.quadraticCurveTo(cx - Math.sin(a) * w * 0.4, cy + Math.cos(a) * w * 0.4, cx - Math.cos(a) * l, cy - Math.sin(a) * l); x.fill(); } break;
      case 'tricolour': x.fillStyle = S.alt; for (let i = 0; i < 1024; i += 64) x.fillRect(0, i, 1024, 26); for (const [px, pw] of [[20, 14], [320, 14], [430, 12], [665, 12]]) { x.fillStyle = '#0f6b34'; x.fillRect(px, 0, pw, 1024); x.fillStyle = '#ffffff'; x.fillRect(px + pw, 0, pw, 1024); x.fillStyle = S.trim; x.fillRect(px + pw * 2, 0, pw, 1024); } break;
      case 'gpo': x.fillStyle = S.alt; for (let i = 0; i < 1024; i += 48) x.fillRect(0, i, 1024, 20);
        for (const [cx, by] of [[175, 520], [550, 1000]]) { x.fillStyle = 'rgba(210,210,200,.85)'; x.fillRect(cx - 110, by - 70, 220, 70); x.fillRect(cx - 40, by - 110, 80, 40); x.beginPath(); x.moveTo(cx - 50, by - 110); x.lineTo(cx, by - 140); x.lineTo(cx + 50, by - 110); x.fill(); x.fillStyle = 'rgba(40,40,40,.7)'; for (let c = -95; c <= 95; c += 19) x.fillRect(cx + c, by - 62, 7, 56); } break;
      default: break;
    }
  }
  // the player texture + which pixels belong to the shirt / shorts / socks, worked out once
  let KB = null;
  function kitBase() {
    if (KB) return KB;
    const oc = document.createElement('canvas'); oc.width = oc.height = 1024; const ox = oc.getContext('2d'); ox.drawImage(atlasImg, 0, 0, 1024, 1024);
    const data = ox.getImageData(0, 0, 1024, 1024).data;
    const L = [], T = [], S = [];
    for (let i = 0; i < data.length; i += 4) {
      const m0 = maskData[i], m1 = maskData[i + 1], m2 = maskData[i + 2]; if (m0 < 128 && m1 < 128 && m2 < 128) continue;
      L.push(i); T.push(m0 >= 128 ? 0 : m1 >= 128 ? 1 : 2);
      const lum = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 205; S.push(clamp(0.35 + 0.7 * lum, 0.45, 1.08));
    }
    KB = { data, list: Int32Array.from(L), type: Uint8Array.from(T), shade: Float32Array.from(S) };
    return KB;
  }
  function kitTexture(kitId, name, num) {
    const key = kitId + '|' + (name || '') + '|' + (num || '');
    if (kitCache.has(key)) { const t = kitCache.get(key); kitCache.delete(key); kitCache.set(key, t); return t; }
    const k = (window.KITS && KITS.byId(kitId)) || (window.KITS && KITS.EXTRA.keeper);
    if (!k || !maskData) return SK.baseTex;
    const pc = document.createElement('canvas'); pc.width = pc.height = 1024; const x = pc.getContext('2d');
    drawPattern(x, k, kitId);
    // badge where the model's crest was
    x.fillStyle = k.shirt.trim; x.beginPath(); x.arc(214, 268, 17, 0, 7); x.fill(); x.fillStyle = k.shirt.base; x.font = '800 15px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(k.name.replace(/^The\s+/i, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase(), 214, 269);
    // club name across the chest, player name + number on the back
    const txt = (s, cx, cy, size, maxW, col) => { x.font = '800 ' + size + 'px "Barlow Condensed", Arial Narrow, Arial'; x.lineJoin = 'round'; x.lineWidth = Math.max(3, size / 9); x.strokeStyle = 'rgba(0,0,0,.55)'; x.fillStyle = col; x.strokeText(s, cx, cy, maxW); x.fillText(s, cx, cy, maxW); };
    const words = k.name.split(/\s+/); const l1 = words.length > 2 ? words.slice(0, words.length - 1).join(' ') : words[0], l2 = words.length > 2 ? words[words.length - 1] : words.slice(1).join(' ');
    txt(l1, 172, l2 ? 332 : 348, 34, 190, k.shirt.text); if (l2) txt(l2, 172, 368, 34, 190, k.shirt.text);
    if (name) txt(String(name).toUpperCase().slice(0, 14), 556, 712, 34, 190, k.shirt.text);
    if (num != null && num !== '') txt(String(num).slice(0, 2), 556, 800, 116, 190, k.shirt.text);
    const pat = x.getImageData(0, 0, 1024, 1024).data;
    // shading from the original texture (folds), coloured by the kit. Only the kit's pixels are touched.
    const B = kitBase();
    const id = new ImageData(new Uint8ClampedArray(B.data), 1024, 1024), d = id.data;
    const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const SH = hx(k.shorts.base), SO = hx(k.socks.base), SB = hx(k.socks.band);
    const L = B.list, T = B.type, SHd = B.shade;
    for (let n = 0; n < L.length; n++) {
      const i = L[n], sh = SHd[n], ty = T[n];
      let r, g, b;
      if (ty === 0) { r = pat[i]; g = pat[i + 1]; b = pat[i + 2]; }
      else if (ty === 1) { r = SH[0]; g = SH[1]; b = SH[2]; }
      else { const py = (i >> 12); const c = ((py >= 30 && py < 44) || (py >= 790 && py < 804)) ? SB : SO; r = c[0]; g = c[1]; b = c[2]; }
      d[i] = r * sh; d[i + 1] = g * sh; d[i + 2] = b * sh;
    }
    const oc = document.createElement('canvas'); oc.width = oc.height = 1024; const ox = oc.getContext('2d');
    ox.putImageData(id, 0, 0);
    const sm = document.createElement('canvas'); sm.width = sm.height = 512; sm.getContext('2d').drawImage(oc, 0, 0, 512, 512);
    const t = texFrom(sm, false);
    kitCache.set(key, t);
    while (kitCache.size > 16) { const [k0, t0] = kitCache.entries().next().value; gl.deleteTexture(t0); kitCache.delete(k0); }
    return t;
  }
  function makeBoards(acc, items) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#2a2f37'; x.fillRect(0, 0, 1024, 57);
    const f = document.createElement('canvas'); f.width = 1024; f.height = 71; const y = f.getContext('2d');
    const g = y.createLinearGradient(0, 0, 1024, 0); g.addColorStop(0, '#061233'); g.addColorStop(0.5, '#0b1f55'); g.addColorStop(1, '#061233'); y.fillStyle = g; y.fillRect(0, 0, 1024, 71);
    y.fillStyle = acc; y.fillRect(0, 0, 1024, 5); y.fillRect(0, 66, 1024, 5);
    y.font = '900 40px "Arial Black", Arial'; y.textBaseline = 'middle'; y.textAlign = 'center';
    (items || [['BIGBOSSROBINSON', '#ffffff'], ['BSN', acc], ['!JOIN THE SHOOTOUT', '#ffd23f']]).forEach(([t, col], i) => { y.fillStyle = col; y.fillText(t, 170 + i * 340, 32, 320); });
    x.save(); x.translate(0, 128); x.scale(1, -1); x.drawImage(f, 0, 0); x.restore();
    if (boardsTex) gl.deleteTexture(boardsTex); boardsTex = texFrom(c);
  }

  // ---------- drawing ----------
  let curVP = null, frameNo = 0, jbuf = null;
  function camNow(now) {
    let c = scene.cam;
    if (scene.camFn) c = scene.camFn(now) || c;
    else if (scene.camTw) { const tw = scene.camTw, u = smooth((now - tw.t0) / tw.ms); c = { eye: lerp3(tw.a.eye, tw.b.eye, u), at: lerp3(tw.a.at, tw.b.at, u), fov: lerp(tw.a.fov, tw.b.fov, u) }; if (u >= 1) { scene.cam = tw.b; scene.camTw = null; } }
    const sk = scene.shake; let eye = c.eye, at = c.at;
    if (now < sk.until) { const a = sk.a * (sk.until - now) / sk.dur; const j = [(Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a]; eye = add(eye, j); at = add(at, scl(j, 0.5)); }
    return { eye, at, fov: c.fov };
  }
  // camera fov is given as the vertical fov of a 16:9 shot; keep the same width on the wider arena
  const vfov = (f169) => 2 * Math.atan(Math.tan(f169 * Math.PI / 360) * (16 / 9) / (W / H));
  function render(now) {
    const c = camNow(now); scene.lastCam = c;
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const VP = M4.mul(M4.persp(vfov(c.fov), W / H, 0.5, 3000), M4.look(c.eye, c.at, [0, 1, 0])); curVP = VP;
    const tm = (now - scene.t0) / 1000, L0 = scene.light, sun = L0.sun;
    gl.useProgram(pg);
    gl.uniformMatrix3fv(U('BR'), false, [1, 0, 0, 0, 1, 0, 0, 0, 1]); gl.uniform3fv(U('grade'), L0.grade);
    gl.uniformMatrix4fv(U('VP'), false, VP); gl.uniform3fv(U('sun'), sun); gl.uniform1f(U('amb'), L0.amb); gl.uniform3fv(U('eye'), c.eye); gl.uniform1f(U('tm'), tm); gl.uniform4fv(U('tint'), [0, 0, 0, 0]);
    for (const d of draws) {
      if (!onScreen(VP, d.corners)) continue;
      gl.bindVertexArray(d.v); gl.uniformMatrix4fv(U('M'), false, d.W); gl.uniformMatrix3fv(U('NM'), false, d.NM); gl.uniform4fv(U('bc'), d.bc);
      gl.uniform1i(U('mode'), d.mode); gl.uniform1f(U('unlit'), d.board ? 1 : 0);
      const tx = d.board ? boardsTex : d.tex; gl.uniform1i(U('ht'), tx && d.mode !== 1 && d.mode !== 3 ? 1 : 0);
      if (tx) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1i(U('t'), 0); }
      if (d.it) gl.drawElements(gl.TRIANGLES, d.cnt, d.it, 0); else gl.drawArrays(gl.TRIANGLES, 0, d.cnt);
    }
    gl.uniform1f(U('unlit'), 0); gl.uniform1i(U('ht'), 0);
    // ball + shadows (players get a soft blob shadow too)
    const shadow = (p, r, a) => { gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.uniform1i(U('mode'), 4); gl.uniform4fv(U('tint'), [0, 0, 0, a]); const m = M4.trs([p[0], 0.08, p[2]], null, [r, 0.05, r]); gl.uniformMatrix4fv(U('M'), false, m); gl.uniformMatrix3fv(U('NM'), false, nm3([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])); gl.bindVertexArray(sphere.v); gl.drawElements(gl.TRIANGLES, sphere.cnt, sphere.it, 0); gl.depthMask(true); gl.disable(gl.BLEND); };
    const b = scene.ball;
    if (b.show) {
      shadow(b.p, clamp(1.4 - b.p[1] * 0.03, 0.5, 1.4), clamp(0.8 - b.p[1] * 0.02, 0.2, 0.8));
      gl.uniform4fv(U('tint'), [0, 0, 0, 0]); gl.uniform1i(U('mode'), 2); gl.uniform4fv(U('bc'), [1, 1, 1, 1]);
      // v29: the panel pattern turns with the spin (topspin plus a little sidespin from the curl), so the ball visibly rotates
      const m = M4.trs(b.p, null, [1.15, 1.15, 1.15]), ax = b.spin, ay = b.spin * (b.side || 0) * 0.45;
      const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
      // R = Ry(ay) * Rx(ax); the shader wants R transposed (world normal back into the ball's own frame), column-major
      const R = [cy, 0, -sy, sy * sx, cx, cy * sx, sy * cx, -sx, cy * cx];
      gl.uniformMatrix3fv(U('BR'), false, [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]);
      gl.uniformMatrix4fv(U('M'), false, m); gl.uniformMatrix3fv(U('NM'), false, nm3(m)); gl.bindVertexArray(sphere.v); gl.drawElements(gl.TRIANGLES, sphere.cnt, sphere.it, 0);
      gl.uniformMatrix3fv(U('BR'), false, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
    const poses = [];
    frameNo++;
    for (const pl of players.values()) { if (!pl.show) continue; const pp = pl.bg && pl.pp && frameNo % 3 ? pl.pp : playerPose(pl); pl.pp = pp; poses.push([pl, pp]); const h = jointWorld(pp, SK.hips); shadow([h[0], 0, h[2]], 4.5, 0.5); }
    gl.uniform4fv(U('tint'), [0, 0, 0, 0]);
    // skinned players: all joint matrices go into one float texture, one row block per player
    if (poses.length) {
      const rows = Math.min(16, Math.ceil(poses.length * 280 / 1024)), J = jbuf || (jbuf = new Float32Array(1024 * 16 * 4));
      poses.forEach(([pl, pp], n) => {
        // joint matrices are only rebuilt when the pose changed (background players reuse theirs)
        if (pl.jmFor !== pp) { const invM = invert(pp.G[SK.meshNode]), jm = pl.jm || (pl.jm = new Float32Array(70 * 16)); SK.joints.forEach((j, k) => { jm.set(M4.mul(invM, M4.mul(pp.G[j], SK.ibmM[k])), k * 16); }); pl.jmFor = pp; }
        J.set(pl.jm, n * 70 * 16);
      });
      gl.useProgram(spg);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, JT); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, rows, gl.RGBA, gl.FLOAT, J.subarray(0, rows * 4096)); gl.uniform1i(U2('JT'), 1);
      gl.uniformMatrix4fv(U2('VP'), false, VP); gl.uniform3fv(U2('sun'), sun); gl.uniform1f(U2('amb'), Math.min(0.9, L0.amb + 0.05)); gl.uniform3fv(U2('grade'), L0.grade); gl.uniformMatrix3fv(U2('BR'), false, [1, 0, 0, 0, 1, 0, 0, 0, 1]); gl.uniform3fv(U2('eye'), c.eye); gl.uniform1i(U2('mode'), 0); gl.uniform1f(U2('unlit'), 0); gl.uniform4fv(U2('tint'), [0, 0, 0, 0]); gl.uniform4fv(U2('bc'), [1, 1, 1, 1]);
      poses.forEach(([pl, pp], n) => {
        gl.uniform1i(U2('jo'), n * 70);
        gl.uniformMatrix4fv(U2('M'), false, M4.mul(pp.base, pp.G[SK.meshNode]));
        for (const pr of SK.prims) { gl.bindVertexArray(pr.v); const tx = pr.kitable ? (pl.tex || SK.baseTex) : pr.tex; gl.uniform1i(U2('ht'), tx ? 1 : 0); if (tx) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx); gl.uniform1i(U2('t'), 0); } gl.drawElements(gl.TRIANGLES, pr.cnt, pr.it, 0); }
      });
    }
    // DOM sprites (name tags, glows, crowd effects)
    for (const s of sprites) { const q = project(typeof s.pos === 'function' ? s.pos() : s.pos); if (!q || q[2] < 0) { s.el.style.visibility = 'hidden'; continue; } s.el.style.visibility = ''; s.el.style.transform = 'translate(' + q[0].toFixed(1) + 'px,' + q[1].toFixed(1) + 'px)' + (s.scale ? ' scale(' + clamp(s.scale / q[2], 0.2, 2).toFixed(3) + ')' : ''); }
  }
  // skip stadium parts that are completely off camera (all 8 box corners outside the same clip plane)
  function onScreen(m, cs) {
    let l = 0, r = 0, b = 0, t = 0, n = 0;
    for (const p of cs) { const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
      if (x < -w) l++; if (x > w) r++; if (y < -w) b++; if (y > w) t++; if (w < 0) n++; }
    return !(l === 8 || r === 8 || b === 8 || t === 8 || n === 8);
  }
  function project(p) {
    if (!curVP || !p) return null; const m = curVP, x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    if (w <= 0.1) return [0, 0, -1]; return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H, w];
  }
  let fpsN = 0, fpsT = 0; const stats = { fps: 0, frames: 0, ms: 0 };
  let frozen = false;
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (frozen) return;
    const cap = action || scene.camTw ? Q.fps : Q.idle;
    if (cap < 60 && now - lastDraw < 1000 / cap - 3) return;
    lastDraw = now;
    const t0 = performance.now();
    try { if (onFrame) onFrame(now); render(now); } catch (e) { err = String(e && e.message || e); console.error('G3', e); }
    stats.ms = stats.ms * 0.9 + (performance.now() - t0) * 0.1; stats.frames++;
    fpsN++; if (now - fpsT > 1000) { stats.fps = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; }
  }

  // ---------- public API ----------
  function mount(parent, w, h) {
    if (!ready) return false;
    host = parent; W = w || parent.clientWidth || 1560; H = h || parent.clientHeight || 660; cv.width = Math.round(W * Q.scale); cv.height = Math.round(H * Q.scale);
    host.insertBefore(cv, host.firstChild);
    layer = document.createElement('div'); layer.className = 'g3-layer'; layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    cv.after(layer);
    if (!running) { running = true; fpsT = performance.now(); raf = requestAnimationFrame(loop); }
    return true;
  }
  function unmount() {
    running = false; cancelAnimationFrame(raf); onFrame = null;
    for (const s of sprites) s.el.remove(); sprites.clear();
    if (layer) layer.remove(); layer = null; if (cv && cv.parentNode) cv.remove(); host = null;
    players.clear(); scene.ball.show = false; scene.camFn = null; scene.camTw = null;
  }
  function player(id, o) {
    let pl = players.get(id);
    if (!pl) { pl = { id, pos: [P.cx, P.spotZ], yaw: 0, show: true, a: { anim: 'idle', t: 0, loop: true }, b: null, bw: 0 }; players.set(id, pl); }
    if (o) { if (o.kit) pl.tex = kitTexture(o.kit, o.name, o.num); Object.assign(pl, o); }
    return pl;
  }
  // set what a player is doing at this moment; a crossfade from `from` over `fade` seconds
  // progress 0..1 = how far through the crossfade from `from` to the new animation
  function setAnim(pl, anim, t, loop, from, progress) { pl.a = { anim, t, loop: !!loop }; pl.b = from || null; pl.bw = from ? 1 - smooth(progress) : 0; }
  function cam(c, ms) { scene.camFn = null; if (!ms) { scene.cam = c; scene.camTw = null; return; } scene.camTw = { a: scene.lastCam || scene.cam, b: c, t0: performance.now(), ms }; }
  function camFollow(fn) { scene.camFn = fn; scene.camTw = null; }
  function shake(a, ms) { scene.shake = { a: a * 0.08, until: performance.now() + ms, dur: ms }; }
  function sprite(html, pos, o) { if (!layer) return null; const el = document.createElement('div'); el.style.cssText = 'position:absolute;left:0;top:0;will-change:transform'; el.innerHTML = '<div style="transform:translate(-50%,-100%)">' + html + '</div>'; layer.appendChild(el); const s = { el, pos, scale: o && o.scale }; sprites.add(s); el._g3 = s; return el; }
  function moveSprite(el, pos) { if (el && el._g3) el._g3.pos = pos; }
  function removeSprite(el) { if (el && el._g3) { sprites.delete(el._g3); el.remove(); } }
  // shots used by the director (all relative to the goal and the spot)
  function shot(name, o) {
    o = o || {}; const cx = P.cx, gz = P.gz, sz = P.spotZ;
    switch (name) {
      case 'wide': return { eye: [cx + 128, 92, sz - 80], at: [cx, 4, sz + 52], fov: 40 };
      case 'orbit': { const a = o.a || 0; return { eye: [cx + Math.sin(a) * 105, 40, sz + 30 - Math.cos(a) * 105], at: [cx, 5, sz + 40], fov: 40 }; }
      // framed so the shooter and ball sit above the chat bar at the bottom of the game
      case 'behind': return { eye: [cx - 3 + (o.side || 0), 33, sz - 113], at: [cx, -4, gz], fov: 32 };
      case 'push': return { eye: [cx - 2 + (o.side || 0), 26, sz - 80], at: [cx, -1, gz], fov: 32 };
      case 'strike': return { eye: [cx + 30, 7, sz - 12], at: [cx - 2, 9, sz + 26], fov: 42 };
      case 'reverse': return { eye: [cx + 22, 27, gz + 66], at: [cx - 2, 9, gz - 18], fov: 46 };
      case 'goalside': { const sd = o.side || 1; return { eye: [cx + sd * 58, 15, gz - 38], at: [cx - sd * 6, 8, gz - 3], fov: 40 }; }
      case 'lineup': { const n = o.n || 6; const d = 50 + n * 6; return { eye: [cx, 12, sz + 8 + d], at: [cx, 8.5, sz + 2], fov: 40 }; }
      default: return { eye: [cx, 22, sz - 66], at: [cx, 11, gz + 10], fov: 40 };
    }
  }
  return {
    load: () => { if (!loadP) loadP = doLoad().catch((e) => { err = String(e && e.message || e); ready = false; throw e; }); return loadP; },
    ready: () => ready, error: () => err, stats: () => Object.assign({ players: players.size, kits: kitCache.size, running, scale: Q.scale }, stats),
    mount, unmount, mounted: () => running,
    player, players: () => players, removePlayer: (id) => players.delete(id), setAnim, playerPose, jointWorld, J: () => SK,
    dur: (a) => (SK ? SK.dur[a] || 0 : 0), rootMove: (a) => (SK ? SK.rootMove[a] : [0, 0]), localScale: () => (SK ? SK.rootScale : 1),
    ball: scene.ball, cam, camFollow, shake, shot, sprite, moveSprite, removeSprite, project, P, kitTexture, boards: makeBoards,
    setFrame: (fn) => { onFrame = fn; }, size: () => [W, H],
    tod: (k) => { if (k && TOD[k]) scene.light = TOD[k]; return Object.keys(TOD).find((x) => TOD[x] === scene.light); }, TOD,
    quality: (q) => { Q = QUALITY[q] || QUALITY.balanced; if (cv && running) { cv.width = Math.round(W * Q.scale); cv.height = Math.round(H * Q.scale); } return Q; }, action: (on) => { action = !!on; },
    // tests: stop the frame loop and draw single frames at chosen times
    freeze: (on) => { frozen = !!on; }, tick: (now) => { if (onFrame) onFrame(now); }, frame: (now) => { const t0 = performance.now(); if (onFrame) onFrame(now); render(now); return performance.now() - t0; },
    // helpers for the director
    M: { lerp, lerp3, clamp, smooth, add, sub, scl, norm },
  };
})();
