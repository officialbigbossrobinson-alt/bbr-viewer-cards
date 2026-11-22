/* Boss Sports News — TV-style goal alerts: breaking band, full-screen 3D reconstruction with your
   game in a box, pitchside lower third, VAR and full-time round-up. Loaded by ticker.html;
   events come from boss_sports_news_server.py (/events). */
(() => {
'use strict';
/* =====================================================================
   1. Read the goal description
   ===================================================================== */
function parseGoal(text) {
  const t = text.toLowerCase();
  const g = { raw: text };
  const sm = text.match(/Goal!\s*(.+?)\s(\d+),\s*(.+?)\s(\d+)\./i);
  if (sm) { g.home = sm[1].trim(); g.hs = sm[2]; g.away = sm[3].trim(); g.as = sm[4]; }
  const og = text.match(/Own Goal by ([^,]+),\s*([^.]+)\./i);
  const pm = text.match(/(?:\.\s|^)([^.()]+?)\s\(([^)]+)\)/);
  if (og) {
    g.owngoal = true; g.scorer = og[1].trim();
    const ogTeam = og[2].trim().toLowerCase();
    g.team = g.home && g.home.toLowerCase() === ogTeam ? g.away : g.home;
  } else if (pm) { g.scorer = pm[1].trim(); g.team = pm[2].trim(); }
  g.scorer = g.scorer || 'The scorer';
  g.team = g.team || g.home || 'Home';
  g.opp = g.team === g.home ? (g.away || 'Away') : (g.home || 'Home');

  g.penalty = /penalty/.test(t) && !/following a penalty/.test(t);
  g.freekick = /free kick/.test(t);
  g.body = /header/.test(t) ? 'header' : /left footed/.test(t) ? 'left' : 'right';
  g.zone = /very close range|six yard box/.test(t) ? 'six' : /outside the box|long range|more than 35/.test(t) ? 'outside' : 'box';
  g.side = /left side|on the left/.test(t) ? 'left' : /right side|on the right/.test(t) ? 'right' : 'centre';
  g.angle = /difficult angle/.test(t);
  g.vert = /top|high centre/.test(t) ? 'top' : /bottom/.test(t) ? 'bottom' : 'middle';
  g.horiz = /(top|bottom) left|left corner/.test(t) ? 'left' : /(top|bottom) right|right corner/.test(t) ? 'right' : 'centre';

  const am = text.match(/Assisted by ([^.]+?)(?: with| following|\.|$)/i);
  g.assister = am ? am[1].trim() : null;
  g.assist = g.penalty ? 'penalty' : g.freekick ? 'freekick'
    : /following a corner/.test(t) ? 'corner' : /cross/.test(t) ? 'cross'
    : /through ball/.test(t) ? 'through' : g.assister ? 'pass' : 'solo';

  if (g.owngoal) { g.zone = 'six'; g.assist = 'cross'; }
  // Did the report say how it was scored? If not, the reporter keeps it general.
  g.detailed = /footed|header|corner|centre of the goal|penalty|free kick/.test(t);
  const parts = g.scorer.split(' ');
  g.surname = parts.length > 1 ? parts.slice(1).join(' ') : g.scorer;
  return g;
}

/* Team colours (generic kit colours only — no badges or real kits) */
const KITS = [
  [/milan/, 0xd5001c, 0xffffff],
  [/arsenal/, 0xef0107, 0xffffff], [/chelsea/, 0x034694, 0x034694], [/liverpool/, 0xc8102e, 0xc8102e],
  [/manchester city|man city/, 0x6cabdd, 0xffffff], [/manchester united|man utd|man united/, 0xda291c, 0xffffff],
  [/tottenham|spurs/, 0xf4f4f4, 0x132257], [/newcastle/, 0x2a2a2a, 0x2a2a2a], [/aston villa/, 0x670e36, 0xffffff],
  [/real madrid/, 0xf5f5f5, 0xf5f5f5], [/bayern/, 0xdc052d, 0xdc052d], [/barcelona/, 0xa50044, 0x004d98],
  [/inter/, 0x0068a8, 0x111111], [/paris|psg/, 0x004170, 0x004170], [/everton/, 0x003399, 0xffffff],
  [/west ham/, 0x7a263a, 0xffffff], [/brighton/, 0x0057b8, 0x0057b8], [/juventus/, 0x1b1b1b, 0xffffff],
];
function kitFor(name, fallback) {
  const n = (name || '').toLowerCase();
  const k = KITS.find(([re]) => re.test(n));
  return k ? { shirt: k[1], shorts: k[2] } : fallback;
}
function colourGap(a, b) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return Math.abs(ca.r - cb.r) + Math.abs(ca.g - cb.g) + Math.abs(ca.b - cb.b);
}

/* =====================================================================
   2. Turn the description into a play (pure functions of time t)
   ===================================================================== */
const GX = 52.5;                    // goal line x (attacking towards +x)
const lerp = (a, b, u) => a + (b - a) * u;
const clamp01 = u => Math.max(0, Math.min(1, u));
const easeOut = u => 1 - Math.pow(1 - u, 3);

function track(keys) {             // keys: [[t, x, z], ...]
  return t => {
    if (t <= keys[0][0]) return { x: keys[0][1], z: keys[0][2] };
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, x0, z0] = keys[i - 1], [t1, x1, z1] = keys[i];
        const u = (t - t0) / Math.max(1e-6, t1 - t0);
        return { x: lerp(x0, x1, u), z: lerp(z0, z1, u) };
      }
    }
    const k = keys[keys.length - 1];
    return { x: k[1], z: k[2] };
  };
}

function buildPlay(g) {
  let seed = 7;
  for (const ch of g.raw) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

  const sideZ = { left: -1, right: 1, centre: 0 }[g.side];
  // shot origin
  let sx = g.zone === 'six' ? 48 : g.zone === 'outside' ? 29.5 : 42;
  let sz = sideZ * (g.zone === 'six' ? 3 : g.zone === 'outside' ? 9 : 7.5) + (sideZ === 0 ? (rnd() - .5) * 3 : 0);
  if (g.body === 'header') { sx = Math.max(sx, 44); sz = sideZ ? sideZ * 4 : (rnd() - .5) * 3; }
  if (g.angle) { sx = 49; sz = (sideZ || 1) * 12; }
  if (g.penalty) { sx = 41.5; sz = 0; }
  if (g.freekick) { sx = 30; sz = sideZ ? sideZ * 7 : (rnd() < .5 ? -5 : 5); }

  // target in the goal (shooter's left = -z)
  const tz = { left: -2.85, right: 2.85, centre: (rnd() - .5) * 0.8 }[g.horiz];
  const ty = { top: 2.05, bottom: 0.32, middle: 1.15 }[g.vert];

  const actors = [];
  const ball = [];                  // segments
  let shotT;
  const scorerKeys = [];
  const attackers = [], defenders = [];
  const w = sideZ === 0 ? (rnd() < .5 ? -1 : 1) : -sideZ;   // wing the cross comes from

  const add = (keys, team, extra = {}) => { const a = { pos: track(keys), keys, team, ...extra }; actors.push(a); return a; };

  if (g.assist === 'cross' || g.assist === 'corner') {
    const corner = g.assist === 'corner';
    const kickT = corner ? 0.8 : 0.9;
    const from = corner ? { x: GX - 0.5, z: w * 33.4 } : { x: 43, z: w * 28 };
    const crosser = add(corner ? [[0, GX - 2.6, w * 31.4], [kickT, from.x - 0.3, from.z - w * 0.2], [kickT + 0.8, GX - 4, w * 30]]
                               : [[0, 35, w * 27], [kickT, from.x - 0.4, from.z], [kickT + 0.8, 46, w * 27]], 'att', { kickAt: kickT });
    attackers.push(crosser);
    const contactY = g.body === 'header' ? 2.05 : 0.25;
    const flight = corner ? 1.3 : 1.0;
    shotT = kickT + flight;
    if (corner) ball.push({ t0: 0, t1: kickT, rest: { x: GX - 0.3, y: 0.16, z: w * 33.7 } });
    else ball.push({ t0: 0, t1: kickT, carry: crosser });
    ball.push({ t0: kickT, t1: shotT, from: { ...from, y: 0.16 }, to: { x: sx, y: contactY, z: sz }, peak: corner ? 7 : 4.5 });
    scorerKeys.push([0, sx - 7, sz + w * 4], [shotT - 0.7, sx - 2.6, sz + w * 1.4], [shotT, sx, sz]);
  } else if (g.assist === 'through') {
    const px = 27, pz = sz * 0.3 - sideZ * 4;
    const passer = add([[0, px - 2, pz], [0.5, px, pz], [1.4, px + 4, pz]], 'att', { kickAt: 0.5 });
    attackers.push(passer);
    const meet = { x: sx - 3, z: sz * 0.9 };
    ball.push({ t0: 0, t1: 0.5, carry: passer });
    ball.push({ t0: 0.5, t1: 1.35, from: { x: px + 0.5, y: 0.16, z: pz }, to: { x: meet.x + 0.45, y: 0.16, z: meet.z }, peak: 0.2 });
    shotT = 1.9;
    scorerKeys.push([0, sx - 11, sz - sideZ * 6 + 2], [1.35, meet.x, meet.z], [shotT, sx, sz]);
    ball.push({ t0: 1.35, t1: shotT, carry: 'scorer' });
  } else if (g.assist === 'pass') {
    const px = sx - 8, pz = sz + (sz > 0 ? -8 : 8);
    const passer = add([[0, px - 1.5, pz], [0.45, px, pz], [1.3, px + 3, pz]], 'att', { kickAt: 0.45 });
    attackers.push(passer);
    ball.push({ t0: 0, t1: 0.45, carry: passer });
    ball.push({ t0: 0.45, t1: 1.1, from: { x: px + 0.5, y: 0.16, z: pz }, to: { x: sx - 2.8, y: 0.16, z: sz }, peak: 0.2 });
    shotT = 1.8;
    scorerKeys.push([0, sx - 5, sz - 2], [1.1, sx - 3.2, sz], [shotT, sx, sz]);
    ball.push({ t0: 1.1, t1: shotT, carry: 'scorer' });
  } else if (g.assist === 'penalty') {
    shotT = 1.7;
    ball.push({ t0: 0, t1: shotT, rest: { x: 41.5, y: 0.16, z: 0 } });
    scorerKeys.push([0, 37.6, -1.8], [0.9, 37.6, -1.8], [shotT, 41.05, -0.3]);
  } else if (g.assist === 'freekick') {
    shotT = 1.6;
    ball.push({ t0: 0, t1: shotT, rest: { x: sx + 0.45, y: 0.16, z: sz } });
    const f = g.body === 'left' ? 1 : -1;
    scorerKeys.push([0, sx - 3.2, sz + f * 1.8], [1.0, sx - 3.2, sz + f * 1.8], [shotT, sx, sz + f * 0.3]);
  } else {
    shotT = 1.9;
    scorerKeys.push([0, sx - 12, sz - 5 * (sz >= 0 ? 1 : -1)], [shotT, sx, sz]);
    ball.push({ t0: 0, t1: shotT, carry: 'scorer' });
  }

  // the shot
  const contactY = g.body === 'header' ? 2.05 : 0.2;
  const shotFrom = g.assist === 'penalty' ? { x: 41.5, y: 0.16, z: 0 }
    : g.assist === 'freekick' ? { x: sx + 0.45, y: 0.16, z: sz } : { x: sx + 0.4, y: contactY, z: sz };
  const target = { x: GX + 0.25, y: ty, z: tz };
  const dist = Math.hypot(target.x - shotFrom.x, target.z - shotFrom.z);
  const speed = g.body === 'header' ? 13 : g.penalty ? 24 : g.freekick ? 21 : g.zone === 'outside' ? 27 : 22;
  const flight = Math.max(0.32, dist / speed);
  const impactT = shotT + flight;
  const curl = (g.zone === 'outside' || g.freekick) ? (g.body === 'left' ? 1 : -1) * Math.min(3.2, dist * 0.09) : 0;
  const peak = g.freekick ? 3.6 : g.vert === 'top' ? Math.max(ty, contactY) + 0.6 : Math.max(ty, contactY) * 0.6;
  ball.push({ t0: shotT, t1: impactT, from: shotFrom, to: target, peak, curl, shot: true });
  ball.push({ t0: impactT, t1: impactT + 0.22, from: target, to: { x: GX + 1.7, y: Math.max(0.3, ty * 0.75), z: tz * 0.92 }, peak: 0 });
  ball.push({ t0: impactT + 0.22, t1: impactT + 0.7, from: { x: GX + 1.7, y: Math.max(0.3, ty * 0.75), z: tz * 0.92 }, to: { x: GX + 1.5, y: 0.16, z: tz * 0.9 }, peak: 0, drop: true });
  ball.push({ t0: impactT + 0.7, t1: 999, rest: { x: GX + 1.5, y: 0.16, z: tz * 0.9 } });

  // scorer: follow-through, then celebrate towards the corner flag
  const cz = (sz >= 0 ? 1 : -1) * 23;
  const last = scorerKeys[scorerKeys.length - 1];
  scorerKeys.push([impactT + 0.35, last[1] + 1.4, last[2] * 0.95], [impactT + 3.0, GX - 7, cz]);
  const scorer = add(scorerKeys, 'att', { kickAt: g.body === 'header' ? null : shotT, headAt: g.body === 'header' ? shotT : null, celebrateAt: impactT + 0.4, isScorer: true });

  // carry segments that reference the scorer
  ball.forEach(s => { if (s.carry === 'scorer') s.carry = scorer; });

  // supporting attackers
  if (!g.penalty) {
    [[-1, 0.5], [1, 0.8]].forEach(([s, d]) => {
      const bx = Math.min(sx - 3, 44), bz = sz + s * 9;
      const a = add([[0, bx - 7, bz + s * 2], [shotT, bx - d, bz], [impactT + 0.9, bx + 1, bz * 0.9], [impactT + 3.2, GX - 8.6, cz * 0.9 + s * 1.2]], 'att', { celebrateAt: impactT + 1.0 });
      attackers.push(a);
    });
  } else {
    [[-1], [1]].forEach(([s]) => add([[0, 35, s * 10], [shotT, 35.5, s * 9], [impactT + 0.6, 36.5, s * 8], [impactT + 3.2, GX - 8.6, cz * 0.9 + s * 1.2]], 'att', { celebrateAt: impactT + 0.7 }));
  }

  // defenders
  if (g.penalty) {
    [-12, -5, 5, 12].forEach(z => add([[0, 34.5, z], [shotT, 35, z * 0.95], [impactT + 1, 36, z * 0.9]], 'def'));
  } else if (g.freekick) {
    const dx = (GX - sx), dz = (0 - sz), L = Math.hypot(dx, dz);
    const wx = sx + dx / L * 9.15, wz = sz + dz / L * 9.15;
    const px = -dz / L, pz = dx / L;
    [-1.5, -0.5, 0.5, 1.5].forEach(o => add([[0, wx + px * o * 0.62, wz + pz * o * 0.62], [99, wx + px * o * 0.62, wz + pz * o * 0.62]], 'def', { jumpAt: shotT + 0.15 }));
    [[47, -5], [47, 6]].forEach(([x, z]) => add([[0, x, z], [impactT, x + 0.5, z * 0.8]], 'def'));
  } else {
    [[47.2, -8.5], [46.4, -2.8], [46.6, 3.2], [47.4, 8.8]].forEach(([x, z], i) => {
      const toward = i === 1 || i === 2 ? 0.45 : 0.25;
      add([[0, x - 1.5, z], [shotT, lerp(x, sx, toward), lerp(z, sz, toward)], [impactT + 1.5, lerp(x, sx, toward) - 1, lerp(z, sz, toward)]], 'def');
    });
    if (g.assist === 'solo' || g.assist === 'through') {
      add([[0, sx - 10, sz + 3], [shotT, sx - 1.6, sz + 1.2], [impactT + 1, sx - 1, sz + 1]], 'def');
    }
  }

  // keeper
  const kz = Math.max(-1.6, Math.min(1.6, sz * 0.18));
  const diveDir = g.penalty ? -Math.sign(tz || 1) : Math.sign(tz - kz || 1);
  const keeper = {
    pos: track([[0, GX - 0.7, kz * 0.6], [shotT, GX - 0.9, kz]]),
    diveAt: shotT + (g.penalty ? 0.02 : Math.min(0.12, flight * 0.4)),
    diveDir,
    reach: g.penalty ? 1.9 : Math.min(1.9, Math.abs(tz - kz) * 0.6),
  };

  return { g, actors, ball, keeper, shotT, impactT, end: impactT + 3.1, shotFrom, target, dist, sx, sz };
}

function bez(p0, c, p1, u) {
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
  return { x: a * p0.x + b * c.x + d * p1.x, y: a * p0.y + b * c.y + d * p1.y, z: a * p0.z + b * c.z + d * p1.z };
}

function facingAt(actor, t) {
  const a = actor.pos(t), b = actor.pos(t + 0.08);
  const dx = b.x - a.x, dz = b.z - a.z, v = Math.hypot(dx, dz) / 0.08;
  return { a, v, dx, dz };
}

function ballAt(play, t) {
  const seg = play.ball.find(s => t >= s.t0 && t < s.t1) || play.ball[play.ball.length - 1];
  if (seg.rest) return { ...seg.rest };
  if (seg.carry) {
    const f = facingAt(seg.carry, t);
    let hx = f.dx, hz = f.dz, L = Math.hypot(hx, hz);
    if (L < 1e-4) { hx = 1; hz = 0; L = 1; }
    return { x: f.a.x + hx / L * 0.55, y: 0.16 + Math.abs(Math.sin(t * 9)) * 0.05, z: f.a.z + hz / L * 0.55 };
  }
  const u = clamp01((t - seg.t0) / (seg.t1 - seg.t0));
  if (seg.drop) {
    return { x: lerp(seg.from.x, seg.to.x, u), y: Math.max(0.16, seg.from.y * (1 - u * u) + 0.16 * u * u), z: lerp(seg.from.z, seg.to.z, u) };
  }
  const mid = { x: (seg.from.x + seg.to.x) / 2, y: 0, z: (seg.from.z + seg.to.z) / 2 + (seg.curl || 0) * 2 };
  mid.y = seg.peak ? seg.peak * 2 - (seg.from.y + seg.to.y) / 2 : (seg.from.y + seg.to.y) / 2;
  return bez(seg.from, mid, seg.to, u);
}

/* =====================================================================
   3. The 3D scene (three.js)
   ===================================================================== */
const has3D = (() => {
  try { const c = document.createElement('canvas'); return !!(window.THREE && (c.getContext('webgl') || c.getContext('experimental-webgl'))); }
  catch (e) { return false; }
})();

let renderer, scene, camera, ballMesh, netBack, netBase, playObjs = [], keeperObj, current = null;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function pitchTexture() {
  const S = 20, W = 105 * S, H = 68 * S;
  return canvasTexture(W, H, (ctx) => {
    for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 ? '#2f7d36' : '#357f3a'; ctx.fillRect(i * W / 14, 0, W / 14 + 1, H); }
    const grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
    grad.addColorStop(0, 'rgba(255,255,255,0.05)'); grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 0.12 * S;
    const X = x => (x + 52.5) * S, Z = z => (z + 34) * S;
    ctx.strokeRect(X(-52.5) + 2, Z(-34) + 2, 105 * S - 4, 68 * S - 4);
    ctx.beginPath(); ctx.moveTo(X(0), Z(-34)); ctx.lineTo(X(0), Z(34)); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(0), Z(0), 9.15 * S, 0, Math.PI * 2); ctx.stroke();
    [-1, 1].forEach(s => {
      const gx = s * 52.5;
      ctx.strokeRect(Math.min(X(gx), X(gx - s * 16.5)), Z(-20.16), 16.5 * S, 40.32 * S);
      ctx.strokeRect(Math.min(X(gx), X(gx - s * 5.5)), Z(-9.16), 5.5 * S, 18.32 * S);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(X(gx - s * 11), Z(0), 0.2 * S, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      const a = Math.acos(5.5 / 9.15);
      if (s > 0) ctx.arc(X(gx - 11), Z(0), 9.15 * S, Math.PI - a, Math.PI + a);
      else ctx.arc(X(gx + 11), Z(0), 9.15 * S, -a, a);
      ctx.stroke();
    });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X(0), Z(0), 0.25 * S, 0, Math.PI * 2); ctx.fill();
  });
}

function crowdTexture() {
  const tex = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#121a33'; ctx.fillRect(0, 0, w, h);
    const cols = ['#e8e8f0', '#d10a22', '#c4c9d9', '#2d4fa0', '#f5c400', '#7b86a8', '#a0182a', '#ffffff'];
    for (let r = 0; r < 26; r++) {
      ctx.fillStyle = r % 2 ? '#0d142b' : '#141d3a'; ctx.fillRect(0, r * 10, w, 4);
      for (let i = 0; i < 70; i++) {
        if (Math.random() < 0.12) continue;
        const x = i * 7.3 + (r % 2) * 3 + Math.random() * 2, y = r * 10 + 3;
        ctx.fillStyle = cols[Math.floor(Math.random() * cols.length)];
        ctx.fillRect(x, y, 4.2, 5);
        ctx.fillStyle = ['#e9c1a0', '#c48b65', '#8c5a3e', '#5b3a28'][Math.floor(Math.random() * 4)];
        ctx.fillRect(x + 0.8, y - 2.4, 2.6, 2.6);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function initScene() {
  const canvas = document.getElementById('pitch3d');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(1280, 720, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070d22);
  scene.fog = new THREE.Fog(0x070d22, 110, 220);

  camera = new THREE.PerspectiveCamera(30, 1280 / 720, 0.1, 500);

  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x1b2a12, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(25, 60, -35);
  sun.target.position.set(42, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 10, far: 140 });
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x9fb6ff, 0.35);
  fill.position.set(80, 40, 50);
  scene.add(fill);

  // pitch + surround
  const surround = new THREE.Mesh(new THREE.PlaneGeometry(150, 110), new THREE.MeshStandardMaterial({ color: 0x24622b, roughness: 1 }));
  surround.rotation.x = -Math.PI / 2; surround.position.y = -0.02; surround.receiveShadow = true; scene.add(surround);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; scene.add(pitch);

  // stands
  const crowd = crowdTexture();
  const standMat = (rx, ry) => { const t = crowd.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshStandardMaterial({ map: t, roughness: 1, side: THREE.DoubleSide }); };
  const makeStand = (len, x, z, rotY, frontDist) => {
    const g = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(len, 30), standMat(len / 22, 3));
    face.rotation.x = -1.0;
    face.position.set(0, 1.2 + 15 * Math.sin(1.0) * 0.64, -(15 * Math.cos(1.0) * 1.55));
    g.add(face);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(len, 0.8, 16), new THREE.MeshStandardMaterial({ color: 0x0c1226, roughness: 1 }));
    roof.position.set(0, 23, -22); g.add(roof);
    const ad = new THREE.Mesh(new THREE.BoxGeometry(len * 0.92, 0.9, 0.2), new THREE.MeshStandardMaterial({ color: 0xd10a22, emissive: 0x5a0410, roughness: .6 }));
    ad.position.set(0, 0.45, 2.2); g.add(ad);
    g.position.set(x, 0, z); g.rotation.y = rotY;
    scene.add(g);
  };
  makeStand(140, 0, -40, 0);
  makeStand(140, 0, 40, Math.PI);
  makeStand(90, 59, 0, -Math.PI / 2);
  makeStand(90, -59, 0, Math.PI / 2);

  // floodlight glows
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfffbe8 });
  [[-56, -44], [56, -44], [-56, 44], [56, 44]].forEach(([x, z]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 0.6), glowMat);
    p.position.set(x, 32, z); p.lookAt(0, 0, 0); scene.add(p);
  });

  // goals
  [1, -1].forEach(s => buildGoal(s));

  // ball
  const ballTex = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f7f7f7'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d10a22';
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc((i * 37) % w + 10, (i * 53) % h + 12, 9, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#10162b';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc((i * 61 + 30) % w, (i * 29 + 60) % h, 7, 0, Math.PI * 2); ctx.fill(); }
  });
  ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshStandardMaterial({ map: ballTex, roughness: .45 }));
  ballMesh.castShadow = true;
  scene.add(ballMesh);
}

function buildGoal(s) {
  const post = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .3 });
  const gx = s * GX;
  const g = new THREE.Group();
  [-3.66, 3.66].forEach(z => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.44, 12), post);
    p.position.set(gx, 1.22, z); p.castShadow = true; g.add(p);
  });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.44, 12), post);
  bar.rotation.x = Math.PI / 2; bar.position.set(gx, 2.44, 0); bar.castShadow = true; g.add(bar);

  const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: .42 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(7.32, 2.44, 30, 10), netMat);
  back.rotation.y = Math.PI / 2; back.position.set(gx + s * 2, 1.22, 0); g.add(back);
  [-3.66, 3.66].forEach(z => {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.44, 8, 10), netMat);
    side.position.set(gx + s * 1, 1.22, z); g.add(side);
  });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(2, 7.32, 8, 30), netMat);
  top.rotation.x = Math.PI / 2; top.position.set(gx + s * 1, 2.44, 0); g.add(top);
  scene.add(g);
  if (s === 1) { netBack = back; netBase = Float32Array.from(back.geometry.attributes.position.array); }
}

const SKIN = [0xf1c7a5, 0xd9a27e, 0xb67b55, 0x8a5a3c, 0x5d3a26];
const HAIR = [0x1b1410, 0x3a2416, 0x6b4a2b, 0x0c0c0c, 0xc9a46a];

function makePlayer(kit, rndIdx) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: SKIN[rndIdx % SKIN.length], roughness: .8 });
  const shirt = new THREE.MeshStandardMaterial({ color: kit.shirt, roughness: .7 });
  const shorts = new THREE.MeshStandardMaterial({ color: kit.shorts, roughness: .8 });
  const boot = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .5 });
  const hair = new THREE.MeshStandardMaterial({ color: HAIR[(rndIdx * 3) % HAIR.length], roughness: 1 });
  const mesh = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; return m; };

  const body = new THREE.Group(); g.add(body);
  body.add(mesh(new THREE.CylinderGeometry(0.25, 0.21, 0.62, 12), shirt, 1.22));
  body.add(mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.26, 12), shorts, 0.84));
  body.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 8), skin, 1.58));
  body.add(mesh(new THREE.SphereGeometry(0.135, 14, 10), skin, 1.72));
  const cap = mesh(new THREE.SphereGeometry(0.142, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), hair, 1.735);
  body.add(cap);

  const legs = [-0.11, 0.11].map(x => {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.76, 0);
    const thigh = mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.44, 8), shorts === shirt ? shirt : skin, -0.22);
    const shin = mesh(new THREE.CylinderGeometry(0.068, 0.055, 0.36, 8), shirt, -0.6);
    const foot = mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), boot, -0.79); foot.position.z = 0.05;
    pivot.add(thigh, shin, foot); body.add(pivot); return pivot;
  });
  const arms = [-0.31, 0.31].map(x => {
    const pivot = new THREE.Group(); pivot.position.set(x, 1.47, 0);
    pivot.add(mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.3, 8), shirt, -0.15));
    pivot.add(mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.3, 8), skin, -0.44));
    pivot.rotation.z = x > 0 ? 0.12 : -0.12;
    body.add(pivot); return pivot;
  });
  g.userData = { body, legs, arms };
  scene.add(g);
  return g;
}

function loadPlay(play) {
  playObjs.forEach(o => scene.remove(o.mesh));
  if (keeperObj) scene.remove(keeperObj.outer);
  playObjs = [];

  const g = play.g;
  const att = kitFor(g.team, { shirt: 0xd10a22, shorts: 0xffffff });
  let def = kitFor(g.opp, { shirt: 0x0d2459, shorts: 0x0d2459 });
  if (colourGap(att.shirt, def.shirt) < 0.6) def = { shirt: 0xf2f2f2, shorts: 0x10162b };

  play.actors.forEach((a, i) => playObjs.push({ a, mesh: makePlayer(a.team === 'att' ? att : def, i + 1) }));

  const outer = new THREE.Group();
  const inner = makePlayer({ shirt: 0x9be03c, shorts: 0x1a1a1a }, 2);
  scene.remove(inner); outer.add(inner); scene.add(outer);
  keeperObj = { outer, inner };
}

function poseActor(o, t, ballPos) {
  const { a, mesh } = o;
  const f = facingAt(a, t);
  const { body, legs, arms } = mesh.userData;
  mesh.position.set(f.a.x, 0, f.a.z);
  const yaw = f.v > 0.4 ? Math.atan2(f.dx, f.dz) : Math.atan2(ballPos.x - f.a.x, ballPos.z - f.a.z);
  mesh.rotation.y = yaw;

  const run = Math.min(1, f.v / 7);
  const ph = t * (7 + f.v * 0.9) + (a.keys[0][1] * 3);
  legs[0].rotation.x = Math.sin(ph) * 0.85 * run;
  legs[1].rotation.x = -Math.sin(ph) * 0.85 * run;
  arms[0].rotation.x = -Math.sin(ph) * 0.7 * run;
  arms[1].rotation.x = Math.sin(ph) * 0.7 * run;
  arms[0].rotation.z = -0.12; arms[1].rotation.z = 0.12;
  body.position.y = Math.abs(Math.sin(ph)) * 0.06 * run;
  body.rotation.x = 0.12 * run;

  // kicks (the right leg is legs[1]; left-footers use legs[0])
  if (a.kickAt != null) {
    const u = (t - (a.kickAt - 0.22)) / 0.42;
    if (u > 0 && u < 1) {
      const leg = (a.isScorer && current && current.g.body === 'left') ? legs[0] : legs[1];
      leg.rotation.x = u < 0.5 ? lerp(0, 1.1, u / 0.5) : lerp(1.1, -1.25, (u - 0.5) / 0.5);
      body.rotation.x = -0.15;
    }
  }
  if (a.headAt != null) {
    const u = (t - (a.headAt - 0.35)) / 0.7;
    if (u > 0 && u < 1) { body.position.y = Math.sin(u * Math.PI) * 0.62; body.rotation.x = lerp(-0.3, 0.45, u); arms[0].rotation.z = -0.9; arms[1].rotation.z = 0.9; }
  }
  if (a.jumpAt != null) {
    const u = (t - a.jumpAt) / 0.6;
    if (u > 0 && u < 1) body.position.y = Math.sin(u * Math.PI) * 0.45;
  }
  if (a.celebrateAt != null && t > a.celebrateAt) {
    const u = clamp01((t - a.celebrateAt) / 0.4);
    arms[0].rotation.z = lerp(-0.12, -2.7, u); arms[1].rotation.z = lerp(0.12, 2.7, u);
    arms[0].rotation.x = 0; arms[1].rotation.x = 0;
  }
}

function poseKeeper(play, t) {
  const k = play.keeper, { outer, inner } = keeperObj;
  const p = k.pos(t);
  const u = easeOut(clamp01((t - k.diveAt) / 0.5));
  outer.position.set(p.x, 0, p.z + k.diveDir * k.reach * u);
  outer.rotation.y = -Math.PI / 2;
  const { body, legs, arms } = inner.userData;
  inner.rotation.z = -k.diveDir * 1.25 * u;
  inner.position.y = Math.sin(u * Math.PI) * 0.55 + u * 0.25;
  const ready = t < k.diveAt;
  legs[0].rotation.x = ready ? 0.25 : 0; legs[1].rotation.x = ready ? -0.1 : 0;
  body.rotation.x = ready ? 0.25 : 0;
  arms[0].rotation.z = lerp(-0.5, -2.8, u); arms[1].rotation.z = lerp(0.5, 2.8, u);
}

function updateNet(play, t) {
  const pos = netBack.geometry.attributes.position;
  const arr = pos.array;
  const dt = t - play.impactT;
  const amp = dt > 0 ? 0.85 * Math.exp(-dt * 2.6) * (0.65 + 0.35 * Math.cos(dt * 10)) : 0;
  const lx = -play.target.z, ly = play.target.y - 1.22;
  for (let i = 0; i < arr.length; i += 3) {
    const bx = netBase[i], by = netBase[i + 1];
    const d2 = (bx - lx) * (bx - lx) + (by - ly) * (by - ly);
    arr[i + 2] = netBase[i + 2] + amp * Math.exp(-d2 / 1.1);
  }
  pos.needsUpdate = true;
}

let camFocus = null;
function placeCamera(play, t, mode, b) {
  if (mode === 'replay') {
    camera.fov = 38;
    const c = { x: GX + 6.2, y: 2.3, z: play.target.z * 0.35 };
    camera.position.set(c.x, c.y, c.z);
    camera.lookAt(lerp(play.shotFrom.x, b.x, 0.3), 1.0, lerp(play.shotFrom.z, b.z, 0.3));
  } else {
    camera.fov = 29;
    if (!camFocus) camFocus = { x: b.x, z: b.z };
    camFocus.x = lerp(camFocus.x, b.x, 0.08);
    camFocus.z = lerp(camFocus.z, b.z, 0.06);
    const fx = Math.min(camFocus.x, 47);
    camera.position.set(fx - 7, 15.5, -44);
    camera.lookAt(fx + 2.5, 0, camFocus.z * 0.55 + 2);
  }
  camera.updateProjectionMatrix();
}

function renderAt(play, t, mode) {
  const b = ballAt(play, t);
  ballMesh.position.set(b.x, b.y, b.z);
  ballMesh.rotation.z = -t * 12; ballMesh.rotation.x = t * 5;
  playObjs.forEach(o => poseActor(o, t, b));
  poseKeeper(play, t);
  updateNet(play, t);
  placeCamera(play, t, mode, b);
  renderer.render(scene, camera);
}


/* =====================================================================
   4. TV broadcast sequence (live)
   ===================================================================== */
const $ = id => document.getElementById(id);
const IMG = {
  grin: 'images/boss-grin.jpg', bandana: 'images/boss-grin-bandana.jpg', celebrate: 'images/boss-celebrate.jpg',
  laugh: 'images/boss-laugh.jpg', gutted: 'images/boss-gutted.jpg',
};
Object.values(IMG).forEach(src => { const i = new Image(); i.src = src; });
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const sleepers = new Set();
const sleep = ms => new Promise(r => {
  const done = () => { clearTimeout(timer); sleepers.delete(done); r(); };
  const timer = setTimeout(done, ms);
  sleepers.add(done);
});
function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

// The game box, in the 1280x720 design stage (OBS gets the same box as fractions of your canvas)
const BOX = { x: 900, y: 24, w: 356, h: 200 };

function teamShort(name) {
  const map = { 'manchester city': 'MCI', 'man city': 'MCI', 'manchester united': 'MUN', 'man united': 'MUN', 'tottenham hotspur': 'TOT', 'tottenham': 'TOT', 'spurs': 'TOT',
    'aston villa': 'AVL', 'newcastle united': 'NEW', 'newcastle': 'NEW', 'west ham united': 'WHU', 'west ham': 'WHU', 'real madrid': 'RMA', 'bayern munich': 'BAY',
    'liverpool': 'LIV', 'arsenal': 'ARS', 'chelsea': 'CHE', 'barcelona': 'BAR', 'inter': 'INT', 'internazionale': 'INT', 'ac milan': 'MIL', 'milan': 'MIL',
    'juventus': 'JUV', 'napoli': 'NAP', 'everton': 'EVE', 'brighton': 'BHA', 'brighton & hove albion': 'BHA', 'nottingham forest': 'NFO', 'crystal palace': 'CRY',
    'wolverhampton wanderers': 'WOL', 'wolves': 'WOL', 'bournemouth': 'BOU', 'afc bournemouth': 'BOU', 'as roma': 'ROM', 'roma': 'ROM', 'lazio': 'LAZ', 'atalanta': 'ATA' };
  const n = (name || '').toLowerCase();
  return map[n] || n.replace(/[^a-z]/g, '').slice(0, 3).toUpperCase();
}
const PLACE = g => g.horiz === 'centre' ? (g.vert === 'top' ? 'ROOF OF THE NET' : 'MIDDLE OF THE GOAL')
  : `${g.vert === 'top' ? 'TOP' : g.vert === 'bottom' ? 'BOTTOM' : ''} ${g.horiz.toUpperCase()} CORNER`.trim();

function lines(g, play, venue, milan) {
  const S = g.surname.toUpperCase();
  const A = (g.assister || '').split(' ').slice(-1)[0].toUpperCase();
  const score = `${(g.home || '').toUpperCase()} ${g.hs}, ${(g.away || '').toUpperCase()} ${g.as}`;
  let intro = g.owngoal ? `OWN GOAL! ${S} PUTS IT INTO HIS OWN NET — IT’S ${score}!`
    : pickOne([`IT’S ${score} — ${venue.toUpperCase()} HAS ERUPTED!`, `${S} HAS SCORED! IT’S ${score}!`]);
  if (milan) intro = g.owngoal ? `OWN GOAL! WE’LL TAKE IT! FORZA MILAN! IT’S ${score}!`
    : pickOne([`GET IN!!! ${S}! FORZA MILAN! IT’S ${score}!`, `YESSS! ${S} FOR THE ROSSONERI! ${score}!`]);
  const setup = g.owngoal ? 'THE BALL COMES IN…' : {
    cross: `${A} WHIPS IN THE CROSS…`, corner: `CORNER SWUNG IN BY ${A}…`, through: `${A} THREADS IT THROUGH…`,
    pass: `${A} FINDS ${S}…`, solo: `${S} PICKS IT UP AND GOES…`, penalty: `${S} STEPS UP FROM THE SPOT…`, freekick: `${S} STANDS OVER IT…`,
  }[g.assist];
  const finish = g.owngoal ? `…AND ${S} TURNS IT INTO HIS OWN NET!`
    : !g.detailed ? `…AND IT’S IN! ${S}! GET IN!`
    : g.body === 'header' ? `…AND HE BULLETS A HEADER INTO THE ${PLACE(g)}!`
    : `…${g.body.toUpperCase()} FOOT — ${PLACE(g)}! GET IN!`;
  const yards = Math.round(play.dist * 1.094);
  const replay = g.penalty ? 'SENT THE KEEPER THE WRONG WAY. ICE COLD.'
    : g.zone === 'outside' && g.detailed ? `FROM ${yards} YARDS. THE KEEPER NEVER MOVED.` : 'LOOK AT THE FINISH ON THAT. NO CHANCE FOR THE KEEPER.';
  return { intro, setup, finish, replay };
}

let runId = 0, typeToken = 0;
async function typeInto(text, id) {
  const el = $('ltQuote');
  const my = ++typeToken;
  el.textContent = '';
  for (let i = 0; i < text.length; i++) {
    if (id !== runId || my !== typeToken) return;
    el.textContent += text[i];
    await sleep(text[i] === ' ' ? 13 : 22);
  }
}

/* ---------- Your OBS game box (moved by the server through OBS WebSocket) ---------- */
let gameBoxOn = false;
async function gameBox(on) {
  const q = on ? `on=1&x=${BOX.x / 1280}&y=${BOX.y / 720}&w=${BOX.w / 1280}&h=${BOX.h / 720}` : 'on=0';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`/bsn/obs/gamebox?${q}`, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    const data = await res.json();
    gameBoxOn = on && !!data.ok;
    return !!data.ok;
  } catch (e) { gameBoxOn = false; return false; }
}
function cutHole(on) {
  const c = $('pitch3d');
  if (!on) { c.style.clipPath = ''; return; }
  const x1 = BOX.x, y1 = BOX.y, x2 = BOX.x + BOX.w, y2 = BOX.y + BOX.h;
  c.style.clipPath = `polygon(0 0, 1280px 0, 1280px 720px, 0 720px, 0 0, ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ${x2}px ${y1}px, ${x1}px ${y1}px, 0 0)`;
}
function cover() { sound('swoosh'); $('wipe').classList.remove('go', 'cover'); void $('wipe').offsetWidth; $('wipe').classList.add('cover'); }
function wipe() { sound('swoosh'); $('wipe').classList.remove('go', 'cover'); void $('wipe').offsetWidth; $('wipe').classList.add('go'); }

function resetStage() {
  ['band', 'lt', 'bug', 'stats', 'recon', 'goalflash', 'gbox', 'gboxTag', 'roundup'].forEach(k => $(k).classList.remove('on', 'out'));
  $('band').classList.remove('milan', 'against', 'var');
  $('goalflash').classList.remove('dark');
  $('ltLab').className = 'lab';
  $('pitch3d').classList.remove('on');
  cutHole(false);
  $('bugState').classList.remove('replay');
  $('moreChip').classList.remove('show');
  if (gameBoxOn) gameBox(false);
  mode = 'idle';
}

/* ---------- Sound (made in the browser) ---------- */
let actx = null, noiseBuf = null;
function audio() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
function noise(c) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function crowd(c, t0, dur, peak, groan) {
  const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.6;
  bp.frequency.setValueAtTime(groan ? 700 : 500, t0);
  bp.frequency.linearRampToValueAtTime(groan ? 260 : 1100, t0 + (groan ? dur : 0.6));
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + (groan ? 0.3 : 0.5));
  g.gain.setValueAtTime(peak, t0 + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(c.destination); src.start(t0); src.stop(t0 + dur + 0.1);
}
function sting(c, t0, notes, type) {
  notes.forEach(([f, at, len]) => {
    const o = c.createOscillator(); o.type = type || 'sawtooth'; o.frequency.value = f;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const g = c.createGain(); const s0 = t0 + at;
    g.gain.setValueAtTime(0.0001, s0); g.gain.exponentialRampToValueAtTime(0.16, s0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, s0 + (len || 0.35));
    o.connect(lp).connect(g).connect(c.destination); o.start(s0); o.stop(s0 + (len || 0.35) + 0.05);
  });
}
function sound(kind) {
  if (!serverState.sound) return;
  try {
    const c = audio(), t = c.currentTime + 0.03;
    if (kind === 'goal') { sting(c, t, [[659, 0], [880, 0.1], [1319, 0.2, 0.6]]); crowd(c, t + 0.05, 3.6, 0.55); }
    if (kind === 'milan') { sting(c, t, [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3, 0.8]]); crowd(c, t + 0.05, 4.6, 0.7); }
    if (kind === 'var') { sting(c, t, [[523, 0, 0.3], [415, 0.22, 0.3], [311, 0.44, 0.7]], 'triangle'); crowd(c, t + 0.15, 2.4, 0.3, true); }
    if (kind === 'ft') sting(c, t, [[784, 0, 0.9], [784, 0.5, 0.9], [784, 1.0, 1.6]], 'triangle');
    if (kind === 'swoosh') crowd(c, t, 0.45, 0.18);
    if (kind === 'flash') sting(c, t, [[880, 0, 0.25], [1319, 0.09, 0.45]], 'triangle');
  } catch (e) { /* no audio */ }
}

/* ---------- 3D loop ---------- */
let mode = 'idle', tPlay = 0, lastFrame = 0, onLiveDone = null, onReplayDone = null, replayTo = 0;
function frame(now) {
  const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  if (current && renderer && mode !== 'idle') {
    if (mode === 'live') { tPlay += dt; if (tPlay >= current.end) { tPlay = current.end; const cb = onLiveDone; onLiveDone = null; cb && cb(); } renderAt(current, tPlay, 'live'); }
    else if (mode === 'replay') { tPlay += dt * 0.42; if (tPlay >= replayTo) { tPlay = replayTo; const cb = onReplayDone; onReplayDone = null; cb && cb(); } renderAt(current, tPlay, 'replay'); }
    else if (mode === 'hold') renderAt(current, tPlay, 'replay');
  }
  requestAnimationFrame(frame);
}
function ensureScene() {
  if (renderer || !has3D) return !!renderer;
  try { initScene(); return true; } catch (e) { console.error('3D unavailable:', e); return false; }
}

/* ---------- Goal ---------- */
async function playGoal(ev, opts = {}) {
  const id = ++runId;
  const ok = () => id === runId;
  resetStage();
  const g = parseGoal(ev.text);
  const venue = ev.venue || 'the ground';
  const p = buildPlay(g);
  current = p; camFocus = null;
  const milan = !!ev.my_team;
  const L = lines(g, p, venue, milan);
  const pending = opts.pending || 0;
  const show3D = ensureScene();
  const quick = !show3D || (serverState.quick && !ev.replay);
  const S = g.owngoal ? `${g.surname.toUpperCase()} (OG)` : g.surname.toUpperCase();
  const comp = ev.comp || 'PREMIER LEAGUE';
  const home = g.home || ev.home || '', away = g.away || ev.away || '';
  const hs = g.hs ?? ev.hs, as = g.as ?? ev.as;
  const scoringTeam = (g.team || '').toUpperCase();

  $('bandWord').textContent = ev.replay ? 'REPLAY' : 'GOAL';
  $('bandMain').textContent = `${home.toUpperCase()} ${hs}–${as} ${away.toUpperCase()}`;
  $('bandSub').textContent = `${S}${ev.minute ? ' ' + ev.minute + '’' : ''} · ${comp}`;
  $('band').classList.toggle('milan', milan);
  $('flashText').innerHTML = `${esc(comp)} · ${esc(home.toUpperCase())} <em>${esc(hs)}–${esc(as)}</em> ${esc(away.toUpperCase())} · ${esc(S)} ${ev.minute ? esc(ev.minute) + '’' : ''}`;
  $('stampText').textContent = ev.replay ? 'REPLAY' : 'GOAL';
  $('moreChip').textContent = pending ? `+${pending} MORE GOAL${pending > 1 ? 'S' : ''}` : '';
  $('moreChip').classList.toggle('show', pending > 0);
  $('ltLab').textContent = ev.replay ? `REPLAY · REQUESTED BY ${(ev.requested_by || 'CHAT').toUpperCase()}`
    : `${milan ? 'FORZA MILAN' : 'GOAL'} · ${comp} · ${venue.toUpperCase()}`;
  $('ltLab').className = 'lab' + (milan ? ' milan' : '');
  $('ltHead').textContent = g.owngoal ? `OWN GOAL · ${home.toUpperCase()} ${hs}–${as} ${away.toUpperCase()}` : `${S} SCORES FOR ${scoringTeam}`;
  $('bugHome').textContent = teamShort(home); $('bugAway').textContent = teamShort(away);
  $('bugScore').textContent = `${hs}–${as}`; $('bugMin').textContent = ev.minute ? ev.minute + '’' : '';
  $('bugText').textContent = 'LIVE';
  $('stScorer').textContent = g.scorer;
  $('stFinish').textContent = !g.detailed ? '–' : g.body === 'header' ? 'Header' : `${g.body} foot`;
  $('stDist').textContent = !g.detailed ? '–' : g.penalty ? 'Penalty spot' : `${Math.round(p.dist * 1.094)} yds`;
  $('stBuild').textContent = !g.detailed && !g.assister ? '–' : ({ cross: 'Cross', corner: 'Corner', through: 'Through ball', pass: 'Pass', solo: 'Solo run', penalty: 'Penalty', freekick: 'Free kick' }[g.assist] + (g.assister ? ` · ${g.assister.split(' ').slice(-1)[0]}` : ''));
  $('stPlace').textContent = !g.detailed ? '–' : PLACE(g).toLowerCase();
  $('photo').src = pickOne([IMG.grin, IMG.bandana]);
  const finishPhoto = pickOne([IMG.celebrate, IMG.laugh]);
  let intro = opts.followOn ? `AND ANOTHER! ${L.intro}` : L.intro;
  if (ev.replay) intro = `${(ev.requested_by || 'CHAT').toUpperCase()} WANTS TO SEE IT AGAIN! HERE’S ${S}…`;

  // 1. breaking band + ticker flash
  await sleep(120); if (!ok()) return;
  sound(milan ? 'milan' : 'goal');
  $('goalflash').classList.add('on');
  $('band').classList.add('on');
  await sleep(1500); if (!ok()) return;

  if (quick) {
    $('band').classList.add('out');
    await sleep(250); if (!ok()) return;
    $('lt').classList.add('on');
    await typeInto(intro, id); if (!ok()) return;
    await sleep(900); if (!ok()) return;
    $('photo').src = finishPhoto;
    await typeInto(`${L.setup} ${L.finish}`, id); if (!ok()) return;
    await sleep(2200); if (!ok()) return;
    $('lt').classList.remove('on');
    await sleep(500); if (!ok()) return;
    $('goalflash').classList.remove('on');
    await sleep(500);
    return;
  }

  // 2. cover the screen, move your game into the box, reconstruction takes the screen
  loadPlay(p); tPlay = 0; renderAt(p, 0, 'live');
  cover();
  await sleep(380); if (!ok()) return;
  $('band').classList.remove('on');
  const boxed = await gameBox(true); if (!ok()) { if (boxed) gameBox(false); return; }
  cutHole(boxed);
  $('pitch3d').classList.add('on');
  if (boxed) { $('gbox').classList.add('on'); $('gboxTag').classList.add('on'); }
  $('bug').classList.add('on'); $('recon').classList.add('on');
  await sleep(500); if (!ok()) return;
  $('lt').classList.add('on');
  await typeInto(intro, id); if (!ok()) return;

  // 3. live speed
  await sleep(300); if (!ok()) return;
  const liveDone = new Promise(r => { onLiveDone = r; });
  tPlay = 0; mode = 'live';
  typeInto(L.setup, id);
  setTimeout(() => { if (ok()) { $('photo').src = finishPhoto; typeInto(L.finish, id); } }, (p.shotT + 0.1) * 1000);
  await liveDone; if (!ok()) return;

  // 4. slow-motion replay with the goal stats
  if (!pending) {
    mode = 'hold'; wipe();
    await sleep(350); if (!ok()) return;
    tPlay = Math.max(0, p.shotT - 1.2); replayTo = p.impactT + 1.3;
    $('bugText').textContent = 'REPLAY'; $('bugState').classList.add('replay');
    $('stats').classList.add('on');
    $('photo').src = pickOne([IMG.grin, IMG.laugh]);
    typeInto(L.replay, id);
    const replayDone = new Promise(r => { onReplayDone = r; });
    mode = 'replay';
    await replayDone; if (!ok()) return;
    mode = 'hold';
    await sleep(700); if (!ok()) return;
    $('stats').classList.remove('on');
  }

  // 5. back to your game
  await sleep(300); if (!ok()) return;
  $('lt').classList.remove('on');
  cover();
  await sleep(380); if (!ok()) return;
  ['bug', 'recon', 'gbox', 'gboxTag'].forEach(k => $(k).classList.remove('on'));
  if (gameBoxOn) await gameBox(false);
  $('pitch3d').classList.remove('on'); cutHole(false);
  mode = 'idle';
  await sleep(500); if (!ok()) return;
  $('goalflash').classList.remove('on');
  await sleep(pending ? 300 : 600);
}

/* ---------- VAR ---------- */
async function playVar(ev) {
  const id = ++runId;
  const ok = () => id === runId;
  resetStage();
  const S = ev.scorer ? (ev.scorer.split(' ').slice(1).join(' ') || ev.scorer).toUpperCase() : '';
  $('band').classList.add('var');
  $('bandWord').textContent = 'VAR';
  $('bandMain').textContent = 'GOAL DISALLOWED';
  $('bandSub').textContent = `${ev.home} ${ev.hs}–${ev.as} ${ev.away}${ev.minute ? ' · ' + ev.minute + '’' : ''}`.toUpperCase();
  $('flashText').innerHTML = `GOAL DISALLOWED · ${esc(ev.home.toUpperCase())} <em>${esc(ev.hs)}–${esc(ev.as)}</em> ${esc(ev.away.toUpperCase())}`;
  $('stampText').textContent = 'VAR';
  $('goalflash').classList.add('dark');
  $('ltLab').textContent = `VAR · ${(ev.comp || '').toUpperCase()} · ${(ev.venue || '').toUpperCase()}`; $('ltLab').className = 'lab against';
  $('ltHead').textContent = S ? `${S}’S GOAL RULED OUT` : 'GOAL RULED OUT';
  $('photo').src = IMG.grin;
  await sleep(120); if (!ok()) return;
  sound('var');
  $('goalflash').classList.add('on'); $('band').classList.add('on');
  await sleep(1800); if (!ok()) return;
  $('band').classList.add('out');
  await sleep(250); if (!ok()) return;
  $('lt').classList.add('on');
  await typeInto('HOLD ON… VAR’S HAD A LOOK AT THIS ONE…', id); if (!ok()) return;
  await sleep(1200); if (!ok()) return;
  $('photo').src = IMG.gutted;
  await typeInto(`IT’S CHALKED OFF! BACK TO ${ev.hs}–${ev.as}.`, id); if (!ok()) return;
  await sleep(2400); if (!ok()) return;
  $('lt').classList.remove('on');
  await sleep(500); if (!ok()) return;
  $('goalflash').classList.remove('on');
  await sleep(500);
}

/* ---------- Full-time round-up ---------- */
function resultLine(r) {
  const H = r.home.toUpperCase(), A = r.away.toUpperCase(), hs = +r.hs, as = +r.as, d = hs - as;
  if (r.my_team) {
    const milanHome = /milan/i.test(r.home) && !/inter/i.test(r.home);
    const mg = milanHome ? hs : as, og = milanHome ? as : hs;
    if (mg > og) return `MILAN WIN ${mg}–${og}! FORZA MILAN!`;
    if (mg === og) return `MILAN DRAW ${mg}–${og} WITH ${milanHome ? A : H}.`;
    return `A DAY TO FORGET FOR MILAN. ${H} ${hs}, ${A} ${as}.`;
  }
  if (d === 0) return hs === 0 ? `${H} AND ${A} — GOALLESS.` : `${H} ${hs}, ${A} ${as}. HONOURS EVEN.`;
  const W = d > 0 ? H : A, Lo = d > 0 ? A : H, hi = Math.max(hs, as), lo = Math.min(hs, as);
  if (Math.abs(d) >= 3) return `${W} ${hi}, ${Lo} ${lo} — A HAMMERING.`;
  if (d < 0) return `AWAY WIN. ${A} WIN ${as}–${hs} AT ${H}.`;
  return `${H} ${hs}, ${A} ${as}. JOB DONE FOR ${H}.`;
}

async function playRoundup(ev) {
  const id = ++runId;
  const ok = () => id === runId;
  resetStage();
  const results = ev.results || [];
  if (!results.length) return;
  const comps = [...new Set(results.map(r => r.comp))];
  $('bandWord').textContent = 'FULL TIME';
  $('bandMain').textContent = ev.label === 'YESTERDAY' ? 'YESTERDAY’S RESULTS' : 'TODAY’S RESULTS';
  $('bandSub').textContent = comps.join(' · ');
  $('flashText').innerHTML = `FULL TIME · ${esc(comps.join(' & '))} · ${results.length} RESULT${results.length > 1 ? 'S' : ''}`;
  $('stampText').textContent = 'FULL TIME';
  $('goalflash').classList.add('dark');
  $('ltLab').textContent = 'FULL-TIME ROUND-UP'; $('ltLab').className = 'lab';
  $('ltHead').textContent = 'HOW IT FINISHED';
  $('photo').src = IMG.grin;

  const pages = [];
  let page = [], lastComp = null;
  results.forEach(r => {
    const needHead = r.comp !== lastComp;
    if (page.length + (needHead ? 2 : 1) > 9) { pages.push(page); page = []; lastComp = null; }
    if (r.comp !== lastComp) { page.push({ head: r.comp }); lastComp = r.comp; }
    page.push(r);
  });
  if (page.length) pages.push(page);

  await sleep(120); if (!ok()) return;
  sound('ft');
  $('goalflash').classList.add('on'); $('band').classList.add('on');
  await sleep(1700); if (!ok()) return;
  $('band').classList.add('out');
  await sleep(250); if (!ok()) return;
  $('lt').classList.add('on');
  await typeInto('IT’S ALL OVER! HERE’S HOW EVERYTHING FINISHED…', id); if (!ok()) return;

  for (let pi = 0; pi < pages.length; pi++) {
    $('ruRows').innerHTML = pages[pi].map(r => {
      if (r.head) return `<div class="ru-comp">${esc(r.head)}</div>`;
      const hs = +r.hs, as = +r.as;
      const cls = hs > as ? 'lose-a' : as > hs ? 'lose-h' : '';
      return `<div class="ru-row ${cls}"><span class="h">${esc(r.home)}</span><span class="s">${hs}–${as}</span><span class="a">${esc(r.away)}</span></div>`;
    }).join('');
    $('ruPage').textContent = pages.length > 1 ? `${pi + 1}/${pages.length}` : '';
    if (pi === 0) { sound('swoosh'); $('roundup').classList.add('on'); await sleep(600); if (!ok()) return; }
    const rows = [...$('ruRows').querySelectorAll('.ru-row')];
    const res = pages[pi].filter(r => !r.head);
    for (let i = 0; i < res.length; i++) {
      rows.forEach(el => el.classList.remove('on'));
      rows[i].classList.add('on');
      const d = Math.abs(+res[i].hs - +res[i].as);
      $('photo').src = res[i].my_team ? (resultLine(res[i]).startsWith('MILAN WIN') ? IMG.celebrate : resultLine(res[i]).startsWith('A DAY') ? IMG.gutted : IMG.grin)
        : d >= 3 ? IMG.laugh : pickOne([IMG.grin, IMG.bandana]);
      await typeInto(resultLine(res[i]), id); if (!ok()) return;
      await sleep(1100); if (!ok()) return;
    }
    rows.forEach(el => el.classList.remove('on'));
  }
  $('photo').src = IMG.celebrate;
  await typeInto('THAT’S YOUR LOT! BACK TO THE BOSS!', id); if (!ok()) return;
  await sleep(1800); if (!ok()) return;
  $('roundup').classList.remove('on'); $('lt').classList.remove('on');
  await sleep(600); if (!ok()) return;
  $('goalflash').classList.remove('on');
  await sleep(500);
}

/* ---------- Ticker flash (most goals): just the GOAL bar, nothing covers your game ---------- */
function surnameOf(name) {
  const parts = (name || '').trim().split(' ');
  return (parts.length > 1 ? parts.slice(1).join(' ') : parts[0] || '').toUpperCase();
}
function flashLine(gl) {
  const S = gl.scorer ? ` · ${esc(surnameOf(gl.scorer))}${gl.minute ? ' ' + esc(gl.minute) + '’' : ''}` : '';
  const comp = gl.comp ? `${esc(gl.comp)} · ` : '';
  if (gl.var) return `${comp}VAR: GOAL RULED OUT · ${esc((gl.home || '').toUpperCase())} <em>${esc(gl.hs)}–${esc(gl.as)}</em> ${esc((gl.away || '').toUpperCase())}`;
  return `${comp}${esc((gl.home || '').toUpperCase())} <em>${esc(gl.hs)}–${esc(gl.as)}</em> ${esc((gl.away || '').toUpperCase())}${S}`;
}
async function cycleGoals(goals, id, ok) {
  for (let i = 0; i < goals.length; i++) {
    const gl = goals[i];
    $('stampText').textContent = gl.var ? 'VAR' : 'GOAL';
    $('goalflash').classList.toggle('dark', !!gl.var);
    $('flashText').innerHTML = flashLine(gl);
    $('moreChip').textContent = goals.length > 1 ? `${i + 1} OF ${goals.length}` : '';
    $('moreChip').classList.toggle('show', goals.length > 1);
    if (i === 0) { sound('flash'); $('goalflash').classList.add('on'); }
    await sleep(i === goals.length - 1 ? 6000 : 3800); if (!ok()) return false;
  }
  return true;
}
async function playFlash(ev) {
  const id = ++runId;
  const ok = () => id === runId;
  resetStage();
  const goals = ev.goals || [];
  if (!goals.length) return;
  await sleep(100); if (!ok()) return;
  if (!(await cycleGoals(goals, id, ok))) return;
  $('goalflash').classList.remove('on');
  await sleep(600);
}

/* ---------- After holding alerts: one "while you were playing" summary ---------- */
async function playSummary(ev) {
  const id = ++runId;
  const ok = () => id === runId;
  resetStage();
  const goals = ev.goals || [];
  if (!goals.length) return;
  const n = goals.filter(g => !g.var).length, v = goals.length - n;
  $('bandWord').textContent = 'MISSED';
  $('bandMain').textContent = 'WHILE YOU WERE PLAYING';
  $('bandSub').textContent = `${n} GOAL${n === 1 ? '' : 'S'}${v ? ` · ${v} VAR DECISION${v > 1 ? 'S' : ''}` : ''}`;
  await sleep(100); if (!ok()) return;
  sound('flash');
  $('band').classList.add('on');
  await sleep(2200); if (!ok()) return;
  $('band').classList.add('out');
  await sleep(200); if (!ok()) return;
  if (!(await cycleGoals(goals, id, ok))) return;
  $('goalflash').classList.remove('on');
  await sleep(600);
}

/* ---------- Queue + server ---------- */
let serverState = { quick: false, sound: true };
let queue = [], processing = false;
async function processQueue() {
  if (processing) return;
  processing = true;
  while (queue.length) {
    const ev = queue.shift();
    try {
      if (ev.type === 'goal') await playGoal(ev, { pending: queue.filter(e => e.type === 'goal' && !e.replay).length, followOn: ev._follow });
      else if (ev.type === 'var') await playVar(ev);
      else if (ev.type === 'roundup') await playRoundup(ev);
      else if (ev.type === 'flash') await playFlash(ev);
      else if (ev.type === 'summary') await playSummary(ev);
    } catch (e) { console.error('Alert failed:', e); resetStage(); }
  }
  processing = false;
}
let lastId = null;
async function poll() {
  try {
    const res = await fetch(`/bsn/events?after=${lastId == null ? -1 : lastId}`, { cache: 'no-store' });
    const data = await res.json();
    serverState = data.state || serverState;
    if (lastId == null) lastId = data.last_id;
    else if (data.events && data.events.length) {
      const busy = processing || queue.some(e => e.type === 'goal');
      data.events.forEach((e, i) => {
        lastId = Math.max(lastId, e.id);
        queue.push({ ...e, _follow: e.type === 'goal' && !e.replay && (i > 0 || busy) });
      });
      processQueue();
    }
  } catch (e) { /* server not running: the ticker keeps going on its own */ }
  setTimeout(poll, 2000);
}

/* ---------- Fit the 1280x720 stage to the Browser Source ---------- */
function fitStage() {
  const stage = $('stage');
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  stage.style.transform = `scale(${s})`;
  stage.style.left = ((window.innerWidth - 1280 * s) / 2) + 'px';
  stage.style.top = ((window.innerHeight - 720 * s) / 2) + 'px';
  const ticker = document.querySelector('.ticker-container');
  const tickerSpace = ticker ? ticker.getBoundingClientRect().height + (parseFloat(getComputedStyle(ticker).bottom) || 0) : 60;
  const gap = window.innerHeight - (parseFloat(stage.style.top) + 720 * s);
  stage.style.setProperty('--gf-bottom', Math.max(10, (tickerSpace + 18 - gap) / s) + 'px');
  if (window.innerHeight < 300) console.warn('Boss Sports News: make the Browser Source full-screen (e.g. 1920x1080) so goal alerts have room to appear.');
}
window.addEventListener('resize', fitStage);
fitStage();
gameBox(false);              // if OBS was left with your game in the box, put it back
requestAnimationFrame(frame);
poll();

})();
