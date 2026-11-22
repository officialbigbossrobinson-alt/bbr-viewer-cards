// 3D stadium director for the penalty games (used by penalty.js when "3D stadium" is on and WebGL works).
// It owns the players, ball and cameras; penalty.js keeps the scoreboard, cards and chat bars on top.
window.PEN3D = (function () {
  'use strict';
  let cfg = { on: false, replays: true, cams: true, lightClassic: true, credit: true, preload: true, quality: 'balanced', tod: 'random' }, light = false;
  let root = null, a0 = null, kits = ['bosshausens', 'diamonddogs'], zonesEl = null, cur = null, frameJobs = [], creditEl = null;
  const M = () => G3.M;
  const now = () => performance.now();
  // old penalty-scene units (goal 746 wide, spot 1100 out) -> stadium units
  const toW = (x, y, z) => { const P = G3.P; return [P.cx - x * P.k, y * P.k, P.gz - z * P.k]; };
  const ZONE = { TL: [-262, 190], TM: [0, 196], TR: [262, 190], ML: [-262, 118], MM: [0, 112], MR: [262, 118], BL: [-262, 42], BM: [0, 36], BR: [262, 42], WL: [-560, 150], WR: [560, 150], OVER: [40, 330], OVERL: [-230, 335], OVERR: [230, 335], STAY: [0, 0] };

  function config(c) {
    const was = cfg.on;
    cfg = Object.assign(cfg, c || {});
    if (window.G3 && G3.quality) G3.quality(cfg.quality);
    if (cfg.on && cfg.preload && window.G3 && !G3.ready()) setTimeout(() => G3.load().catch(() => {}), was ? 0 : 1500);
  }
  // zone, what to type, column
  const ZGRID = [['TL', 'LT', 'L'], ['TM', 'T', 'C'], ['TR', 'RT', 'R'], ['ML', 'L', 'L'], ['MM', 'C', 'C'], ['MR', 'R', 'R'], ['BL', 'LB', 'L'], ['BM', 'B', 'C'], ['BR', 'RB', 'R']];
  const SKY = {
    day: 'linear-gradient(180deg,#4f8fd6 0%,#8cc2f0 55%,#d8ecfb 100%)',
    golden: 'linear-gradient(180deg,#3d5f9e 0%,#d99a5b 60%,#f6c27a 100%)',
    dusk: 'linear-gradient(180deg,#1d2552 0%,#6b3f78 55%,#e0745a 100%)',
    night: 'radial-gradient(ellipse 120% 80% at 50% 100%,#1b2b52 0%,#0a1330 45%,#03060f 100%)',
  };
  let tod = 'night';
  function pickTod(a) {
    const k = (a && a.tod) || cfg.tod;
    if (SKY[k]) return k;
    return ['day', 'golden', 'dusk', 'night'][Math.floor(Math.random() * 4)];
  }
  const usable = () => !!(cfg.on && window.G3 && G3.ready() && !(light && cfg.lightClassic));
  function status() { return { on: cfg.on, ready: !!(window.G3 && G3.ready()), error: window.G3 ? G3.error() : 'not loaded', light, use: usable(), stats: window.G3 ? G3.stats() : null }; }

  // ---------- kits ----------
  function pickKits(a) {
    const K = window.KITS;
    if (a.teams && a.teams.sides) return a.teams.sides.slice(0, 3).map((s, i) => s.kit || (K.find(s.name) || {}).id || (K.byId(s.id) || {}).id || (i ? 'diamonddogs' : 'bosshausens'));
    if (a.boss) { let k = K.pair()[0]; if (k.id === 'bosshausens') k = K.byId('diamonddogs'); return [k.id, 'bosshausens']; }
    return K.pair().map((k) => k.id);
  }
  const shortName = (s) => String(s || '').replace(/^@/, '').slice(0, 12);

  // ---------- scene ----------
  function build(r, a) {
    root = r; a0 = a; kits = pickKits(a); cur = null;
    G3.quality(cfg.quality); G3.action(false);
    if (!G3.mount(root, 1560, 660)) return false;
    G3.boards(a.accent || '#3dff9a');
    G3.setFrame(onFrame);
    // v29: time of day (random each game unless set): light, colour grade, sky and floodlights
    tod = pickTod(a);
    G3.tod(tod);
    const sky = document.createElement('div'); sky.className = 'g3-sky';
    sky.style.cssText = 'position:absolute;inset:0;background:' + SKY[tod];
    root.insertBefore(sky, root.firstChild);
    const P = G3.P, glow = tod === 'night' ? 1 : tod === 'dusk' ? 0.75 : 0;
    if (glow) for (const [x, z] of [[-151, 478], [546, 480], [630, 179], [-222, 179], [630, -402], [-222, -402], [-151, -768], [546, -766]])
      G3.sprite('<div style="width:460px;height:460px;margin-bottom:-230px;border-radius:50%;opacity:' + glow + ';background:radial-gradient(circle,rgba(255,250,225,.95) 0,rgba(255,244,205,.5) 4%,rgba(210,225,255,.12) 22%,rgba(160,190,255,0) 60%)"></div>', [x, 240, z], { scale: 260 });
    const tl = document.createElement('div'); tl.className = 'g3-tod';
    tl.style.cssText = 'position:absolute;left:24px;bottom:16px;z-index:3;pointer-events:none;font:800 20px \'Barlow Condensed\',sans-serif;letter-spacing:2px;color:#fff;background:rgba(6,18,51,.75);padding:3px 12px;border-radius:4px;transition:opacity 1s';
    tl.textContent = G3.TOD[tod].label; root.appendChild(tl); setTimeout(() => { tl.style.opacity = 0; }, 6000);
    // aim zones: 3 x 3 on the goal mouth, labelled with the shortest thing to type
    zonesEl = document.createElement('div');
    zonesEl.style.cssText = 'position:absolute;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);opacity:0;transition:opacity .4s;pointer-events:none;z-index:1';
    zonesEl.innerHTML = ZGRID.map(([z, n, d]) => '<div class="zone" data-z="' + z + '" data-d="' + d + '" style="position:relative;font-size:34px;transition:background .3s">' + n + '</div>').join('');
    root.appendChild(zonesEl);
    if (cfg.credit) { creditEl = document.createElement('div'); creditEl.style.cssText = 'position:absolute;right:10px;bottom:4px;font:400 11px Inter,Arial,sans-serif;color:rgba(255,255,255,.5);z-index:3;pointer-events:none'; creditEl.textContent = 'Stadium: "Soccer Stadium" by nermin (CC-BY 4.0)'; root.appendChild(creditEl); }
    // everyone lines up for the walk-out shot
    lineup(a);
    void P;
    return true;
  }
  function onFrame(t) {
    for (const f of frameJobs) f(t);
    // aim zones sit on the goal mouth
    if (zonesEl) {
      const P = G3.P, a = G3.project([P.cx + P.gw, P.gh, P.gz]), b = G3.project([P.cx - P.gw, 0, P.gz]);
      if (a && b && a[2] > 0) { zonesEl.style.left = a[0] + 'px'; zonesEl.style.top = a[1] + 'px'; zonesEl.style.width = (b[0] - a[0]) + 'px'; zonesEl.style.height = (b[1] - a[1]) + 'px'; }
    }
  }
  function clearPlayers() { G3.players().clear(); tags.forEach((t) => G3.removeSprite(t)); tags = []; frameJobs = []; }
  let tags = [];
  function tag(pl, text, col, up) {
    const el = G3.sprite('<div style="padding:3px 9px;border-radius:6px;background:rgba(6,18,51,.92);border-bottom:4px solid ' + col + ';font:800 19px \'Barlow Condensed\',sans-serif;letter-spacing:1px;color:#fff;white-space:nowrap;text-transform:uppercase;margin-bottom:6px">' + text + '</div>', () => { const p = pl.pp ? G3.jointWorld(pl.pp, G3.J().head) : [pl.pos[0], 19, pl.pos[1]]; return [p[0], p[1] + 3.2 + (up ? 3.4 : 0), p[2]]; });
    tags.push(el); return el;
  }
  function sideColor(i) { const k = KITS.byId(kits[i]); return (a0 && a0.teams && a0.teams.sides[i] && a0.teams.sides[i].color) || (k ? k.ui : '#3dff9a'); }
  let warmT = null;
  function warmKits(groups) {
    clearTimeout(warmT);
    const jobs = []; groups.forEach((g, si) => g.forEach((p) => jobs.push([kits[si], a0 && a0.boss && si === 1 ? 'BOSS' : shortName(p.name), p.ovr || ''])));
    const next = () => { if (!jobs.length || !G3.mounted()) return; const [k, n, o] = jobs.shift(); try { G3.kitTexture(k, n, o); } catch (e) { /* ignore */ } warmT = setTimeout(next, 120); };
    warmT = setTimeout(next, 300);
  }
  function lineup(a) {
    clearPlayers();
    const P = G3.P, H = ((s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
    let groups;
    if (a.teams && a.teams.sides) groups = a.teams.sides.slice(0, 3).map((s, _, all) => (s.players || []).slice(0, all.length > 2 ? 4 : 5).map((p) => ({ name: p.display, ovr: p.ovr })));
    else groups = (a.fighters || []).slice(0, 2).map((f, i) => [{ name: a.boss && i === 1 ? 'THE BOSS' : f.display, ovr: f.ovr }]);
    const n = groups.reduce((s, g) => s + g.length, 0), gap = 10;
    let x = P.cx - ((n - 1) * gap + 6) / 2, idx = 0;
    groups.forEach((g, si) => { g.forEach((p) => { const pl = G3.player('L' + idx, { kit: kits[si], pos: [x, P.spotZ + 2], yaw: 0, show: true }); pl.bg = true; G3.setAnim(pl, 'idle', Math.random() * 3, true); tag(pl, H(shortName(p.name)), sideColor(si), idx % 2 === 1); x += gap; idx++; }); x += 6; });
    const k = G3.player('K', { kit: 'keeper', pos: [P.cx, P.gz - 1], yaw: 180 }); G3.setAnim(k, 'gk_idle', 0, true);
    G3.ball.show = false;
    warmKits(groups);
    // slow drift across the line
    const sh = G3.shot('lineup', { n }), t0 = now();
    G3.camFollow((t) => { const u = (t - t0) / 1000; return { eye: [sh.eye[0] + Math.sin(u * 0.25) * 18, sh.eye[1], sh.eye[2]], at: sh.at, fov: sh.fov }; });
    const t1 = now(); frameJobs.push((t) => { const dt = (t - t1) / 1000; G3.players().forEach((pl) => { if (pl.a.loop) pl.a.t = (pl.t0 || 0) + dt; }); });
    G3.players().forEach((pl) => { pl.t0 = pl.a.t; });
  }
  // the shootout itself: shooter on the spot, keeper on the line, everyone else waiting
  function aim(a) {
    if (!G3.mounted()) return;
    clearPlayers();
    const P = G3.P, s = a.s, sh = a.shooter || (a.fighters ? a.fighters[s] : null) || (a0.fighters || [])[s] || {};
    const name = a0.boss && s === 1 ? 'BOSS' : shortName(sh.display);
    const ki = kits[s] || kits[0];
    const t = G3.player('T', { kit: ki, name, num: sh.ovr || '', pos: [P.cx, P.spotZ - 6], yaw: 0 });
    const start = kickStart(); t.pos = start.pos.slice(); t.yaw = 0; G3.setAnim(t, 'idle', 0, true);
    const k = G3.player('K', { kit: s ? 'keeper2' : 'keeper', pos: [P.cx, P.gz - 1], yaw: 180, off: null, mirror: false }); G3.setAnim(k, 'gk_idle', 0, true);
    // the rest wait at the edge of the box
    const wait = [];
    if (a.teams && a.teams.sides) a.teams.sides.slice(0, 3).forEach((sd, si) => (sd.players || []).forEach((p, pi) => { if (!(si === s && a.teams.shooter && a.teams.shooter.idx === pi)) wait.push([si, p]); }));
    else (a0.fighters || []).forEach((f, i) => { if (i !== s) wait.push([i, { display: a0.boss && i === 1 ? 'BOSS' : f.display, ovr: f.ovr }]); });
    const cnt = [0, 0, 0];
    wait.slice(0, 11).forEach(([si, p], n) => { const j = cnt[si]++, sx = si === 1 ? -1 : 1, far = si === 2 ? 24 : 0; const pl = G3.player('W' + n, { kit: kits[si] || kits[0], pos: [P.cx + sx * (40 + far + j * 6), P.spotZ - 30 - (j % 2) * 5 - far], yaw: sx > 0 ? -35 : 35 }); pl.bg = true; G3.setAnim(pl, 'idle', Math.random() * 4, true); pl.t0 = pl.a.t; });
    G3.ball.show = true; G3.ball.p = [P.cx, 1.15, P.spotZ]; G3.ball.spin = 0;
    const t1 = now(); frameJobs.push((tt) => { const dt = (tt - t1) / 1000; G3.players().forEach((pl) => { if (pl.a.loop) pl.a.t = (pl.t0 || 0) + dt; }); });
    G3.players().forEach((pl) => { pl.t0 = pl.a.t; });
    G3.action(false);
    G3.cam(G3.shot('behind', { side: s ? 2 : -2 }), cur ? 900 : 1400);
    cur = null;
    if (zonesEl) { zonesEl.style.opacity = 1; zonesEl.querySelectorAll('.zone').forEach((z) => { z.style.background = 'transparent'; }); }
  }
  // where the taker must start so his right foot meets the ball
  let KS = null;
  function kickStart() {
    if (KS) return KS;
    const SK = G3.J(), P = G3.P, d = G3.dur('kick');
    const probe = { pos: [0, 0], yaw: 0, a: { anim: 'kick', t: 0, loop: false } };
    let tc = 0.75, best = 1e9;
    for (let t = 0.55; t <= 0.95; t += 0.01) { probe.a.t = t; const pp = G3.playerPose(probe), r = G3.jointWorld(pp, SK.rToe), l = G3.jointWorld(pp, SK.lToe); const dz = Math.abs(r[2] - (l[2] + 1.5)); if (dz < best) { best = dz; tc = t; } }
    probe.a.t = tc; const toe = G3.jointWorld(G3.playerPose(probe), SK.rToe);
    KS = { tc, toe, dur: d, pos: [P.cx - toe[0] + 0.3, P.spotZ - toe[2] - 1.0] };
    return KS;
  }
  const KEEP = {
    dive: { anim: 'gk_dive2', tc: 0.85, dir: +1 },   // high dive, towards world +x when not mirrored
    low: { anim: 'gk_block', tc: 1.0, dir: -1 },     // low dive, towards world -x when not mirrored
    jump: { anim: 'gk_miss', tc: 0.6, dir: 0 },
    catch: { anim: 'gk_catch', tc: 0.72, dir: 0 },
  };
  function keeperPlan(k, target) {
    const z = ZONE[k.dive] || ZONE.STAY, stay = k.dive === 'STAY' || !ZONE[k.dive];
    const sd = stay ? 0 : Math.sign(-z[0]) || 0;   // world direction of the dive
    const high = z[1] > 80;   // top and middle height: the full dive; bottom: the low block
    let K;
    if (stay) K = k.result === 'save' && target[1] > 14 ? KEEP.jump : KEEP.catch;
    else if (!sd) K = high ? KEEP.jump : KEEP.catch;
    else K = high ? KEEP.dive : KEEP.low;
    const mirror = K.dir ? sd !== K.dir : false;
    return { K, sd, stay, mirror };
  }
  function handsAt(anim, t, pos, mirror, off) {
    const SK = G3.J(), pp = G3.playerPose({ pos, yaw: 180, mirror, off, a: { anim, t, loop: false } });
    const r = G3.jointWorld(pp, SK.rHand), l = G3.jointWorld(pp, SK.lHand); return [(r[0] + l[0]) / 2, (r[1] + l[1]) / 2, (r[2] + l[2]) / 2];
  }
  // everything about one kick as a function of time, so the replay can re-run it from any angle
  function plan(k) {
    const P = G3.P, ks = kickStart(), C = ks.tc * 1000;
    const tz = ZONE[k.target] || ZONE.BM, tgt = toW(tz[0], tz[1], 0); tgt[2] = P.gz + 0.6;
    const ball0 = [P.cx, 1.15, P.spotZ];
    const kp = keeperPlan(k, tgt), kpos = [P.cx, P.gz - 1];
    const h0 = handsAt(kp.K.anim, kp.K.tc, kpos, kp.mirror, null);
    let off = [0, 0, 0], end = tgt.slice();
    if (k.result === 'save') { off = [M().clamp(tgt[0] - h0[0], -16, 16), M().clamp(tgt[1] - h0[1], -5, 9), 0]; end = [h0[0] + off[0], h0[1] + off[1], h0[2]]; }
    else if (k.result === 'goal' && !kp.stay && Math.sign(tgt[0] - P.cx) === kp.sd) { off = [M().clamp(tgt[0] - h0[0] - kp.sd * 9, -16, 16), M().clamp(tgt[1] - h0[1] - 3, -5, 6), 0]; }
    if (k.result === 'miss') end = [tgt[0], tgt[1], P.gz + 1];
    const F = k.result === 'miss' && /^OVER/.test(k.target) ? 600 : 520;
    const Sk = C + F - kp.K.tc * 1000;
    const hold = k.result === 'save' && !!k.hold;
    const arc = tz[1] > 120 ? 3 : 1;
    const curl = (tgt[0] - P.cx) * 0.06;
    const mv = G3.rootMove('kick'), rs = G3.localScale();
    const takerEnd = [ks.pos[0] + mv[0] * rs, ks.pos[1] + mv[1] * rs];
    const goal = k.result === 'goal';
    return { k, C, F, Sk, kp, off, end, tgt, ball0, hold, arc, curl, ks, kpos, takerEnd, mv, goal, A: C + F };
  }
  function bounceY(u, h) { return Math.abs(Math.sin(u * Math.PI * 2.2)) * h * (1 - u); }
  function apply(p, t) {
    const T = G3.player('T'), K = G3.player('K'), b = G3.ball, L = M().lerp, sm = M().smooth;
    // ---- taker ----
    const kd = G3.dur('kick') * 1000;
    if (t < kd + 150) { T.pos = p.ks.pos.slice(); T.yaw = 0; G3.setAnim(T, 'kick', Math.max(0, t) / 1000, false, t < 150 ? { anim: 'idle', t: 0, loop: true } : null, t / 150); }
    else {
      const from = { anim: 'kick', t: kd / 1000, loop: false, shift: p.mv };
      const w = (t - kd - 150) / 300;
      T.pos = p.takerEnd.slice();
      // extra Mixamo animations are used when player.glb has them (see tools/3d/README.txt)
      if (p.goal && G3.dur('celebrate')) { T.yaw = 160; G3.setAnim(T, 'celebrate', (t - kd - 150) / 1000, false, from, w); }
      else if (p.goal) {
        // a short celebration run towards the crowd, then he stops
        const jt = (t - kd - 150) / 1000, JOG = 2.4, rm = G3.rootMove('runup'), rs = G3.localScale(), D = G3.dur('runup') || 1;
        T.yaw = 150;
        if (jt < JOG) G3.setAnim(T, 'runup', jt, true, from, w);
        else { const n = JOG / D, a = 150 * Math.PI / 180, dx = rm[0] * rs * n, dz = rm[1] * rs * n; T.pos = [p.takerEnd[0] + Math.cos(a) * dx + Math.sin(a) * dz, p.takerEnd[1] - Math.sin(a) * dx + Math.cos(a) * dz];
          G3.setAnim(T, 'idle', jt - JOG, true, { anim: 'runup', t: JOG, loop: true, shift: [rm[0] * n, rm[1] * n] }, (jt - JOG) / 0.3); }
      }
      else if (G3.dur('dejected')) { T.yaw = 0; G3.setAnim(T, 'dejected', (t - kd - 150) / 1000, false, from, w); }
      else { T.yaw = 0; G3.setAnim(T, 'idle', (t - kd) / 1000, true, from, w); }
    }
    // ---- keeper ----
    const KK = p.kp.K, ka = (t - p.Sk) / 1000;
    K.pos = p.kpos.slice(); K.yaw = 180; K.mirror = p.kp.mirror;
    if (ka < 0) { K.off = null; G3.setAnim(K, 'gk_idle', t / 1000 + 2, true); }
    else {
      const u = sm(ka / KK.tc), back = KK.tc > 0 ? sm((ka - KK.tc) / 0.45) : 0;
      K.off = [p.off[0] * u, p.off[1] * u * (1 - back), 0];
      G3.setAnim(K, KK.anim, ka, false, ka < 0.15 ? { anim: 'gk_idle', t: p.Sk / 1000 + 2, loop: true } : null, ka / 0.15);
    }
    // ---- ball ----
    b.show = true;
    b.side = Math.sign(p.curl) * Math.min(1, Math.abs(p.curl) / 6);
    if (t < p.C) { b.p = p.ball0.slice(); b.spin = 0; return; }
    const ft = t - p.C;
    if (ft < p.F) { const u = ft / p.F, e = 1 - Math.pow(1 - u, 1.4); b.p = [L(p.ball0[0], p.end[0], e) + p.curl * Math.sin(Math.PI * e), L(p.ball0[1], p.end[1], e) + p.arc * 4 * e * (1 - e), L(p.ball0[2], p.end[2], e)]; b.spin = ft * 0.026; return; }
    const at = ft - p.F;
    if (p.k.result === 'goal') {
      if (at < 220) { const u = at / 220; b.p = [p.end[0] + (p.end[0] - p.ball0[0]) * 0.02 * u, Math.max(1.15, p.end[1] - u * 3), p.end[2] + u * 8]; }
      else { const u = Math.min(1, (at - 220) / 900); b.p = [p.end[0], Math.max(1.15, L(Math.max(1.15, p.end[1] - 3), 1.15, Math.min(1, u * 3)) + bounceY(u, 2)), p.end[2] + 8 + u * 1.5]; }
      b.spin = ft * 0.03 * Math.max(0, 1 - at / 1500); return;
    }
    if (p.k.result === 'save' && p.hold) { const pp = G3.playerPose(K), SK = G3.J(), r = G3.jointWorld(pp, SK.rHand), l = G3.jointWorld(pp, SK.lHand); b.p = [(r[0] + l[0]) / 2, (r[1] + l[1]) / 2, (r[2] + l[2]) / 2 - 0.6]; return; }
    if (p.k.result === 'save' && p.kp.K === KEEP.jump) { // tipped over the bar
      const u = Math.min(1, at / 900), top = G3.P.gh + 6; b.p = [p.end[0] + 2 * u, Math.max(1.15, L(p.end[1], top, Math.min(1, u * 2.2)) - (u > 0.75 ? (u - 0.75) * 70 : 0)), p.end[2] + 36 * u]; b.spin = ft * 0.03; return;
    }
    if (p.k.result === 'save') { // parried away
      const sd = p.kp.sd || 1, u = Math.min(1, at / 900), o = [p.end[0] + sd * 34 * u, 0, p.end[2] - 10 * u];
      o[1] = Math.max(1.15, p.end[1] + 9 * u - 22 * u * u) + (u > 0.7 ? bounceY((u - 0.7) / 0.3, 1.2) : 0); b.p = o; b.spin = ft * 0.02; return;
    }
    const u = Math.min(1, at / 600), dir = M().norm(M().sub(p.end, p.ball0)); b.p = [p.end[0] + dir[0] * 45 * u, Math.max(1.15, p.end[1] + dir[1] * 45 * u - 8 * u * u), p.end[2] + dir[2] * 45 * u]; b.spin = ft * 0.03;
  }
  // live kick + camera work + replay. onArrive() is called when the ball gets there (penalty.js updates the scoreboard)
  function kick(k, onArrive) {
    if (!G3.mounted()) { onArrive(); return; }
    const p = plan(k), t0 = now(), P = G3.P; let arrived = false, rp = null;
    G3.action(true);
    cur = p;
    if (zonesEl) zonesEl.style.opacity = 0;
    const job = (t) => {
      if (cur !== p) return;
      const lt = t - t0;
      if (rp) { const rt = rp.from + (t - rp.t0) * rp.speed; apply(p, Math.min(rt, rp.to)); if (rt >= rp.to && !rp.done) { rp.done = true; endReplay(); } return; }
      apply(p, lt);
      if (!arrived && lt >= p.A) { arrived = true; try { onArrive(); } catch (e) { console.error(e); } }
    };
    job.kick = true; frameJobs = frameJobs.filter((f) => !f.kick); frameJobs.push(job);
    // live cameras
    G3.cam(G3.shot('push', { side: 0 }), p.A + 300);
    if (cfg.cams) {
      setTimeout(() => { if (cur !== p || rp) return;
        if (p.goal) { const T = G3.player('T'); G3.camFollow(() => { const h = T.pp ? G3.jointWorld(T.pp, G3.J().hips) : [T.pos[0], 9, T.pos[1]]; const f = [Math.sin(150 * Math.PI / 180), 0, Math.cos(150 * Math.PI / 180)]; return { eye: [h[0] + f[0] * 34, 12, h[2] + f[2] * 34], at: [h[0], h[1] + 1, h[2]], fov: 36 }; }); }
        else G3.cam(G3.shot('goalside', { side: -(p.kp.sd || -1) }), 700);
      }, p.A + 500);
    }
    // replay
    const rpAt = p.A + (cfg.cams ? 2100 : 1700);
    if (cfg.replays) setTimeout(() => { if (cur !== p) return; startReplay(p); }, rpAt);
    function startReplay(pp) {
      const bug = document.createElement('div'); bug.className = 'g3-replay';
      bug.style.cssText = 'position:absolute;left:24px;top:96px;z-index:5;display:flex;gap:8px;align-items:center;font:800 24px \'Barlow Condensed\',sans-serif;letter-spacing:2px;pointer-events:none';
      const how = pp.goal ? 'BALL CAM' : 'REVERSE ANGLE';
      bug.innerHTML = '<span style="background:#ff3d5a;color:#fff;padding:4px 12px">● REPLAY</span><span style="background:rgba(6,18,51,.9);color:#ffd23f;padding:4px 12px">' + how + ' · 0.6×</span>';
      root.appendChild(bug);
      const fl = document.createElement('div'); fl.style.cssText = 'position:absolute;inset:0;background:#fff;z-index:4;pointer-events:none'; root.appendChild(fl);
      fl.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 450 }).onfinish = () => fl.remove();
      rp = { from: pp.C - 500, to: pp.A + 900, t0: now(), speed: 0.6, bug };
      if (pp.goal) {
        const dir = M().norm(M().sub(pp.end, pp.ball0));
        G3.camFollow(() => { const b = G3.ball.p; const back = [b[0] - dir[0] * 15, Math.max(2.4, b[1] + 2.2), b[2] - dir[2] * 15]; return { eye: back, at: [b[0] + dir[0] * 30, b[1] + dir[1] * 30 + 1, b[2] + dir[2] * 30], fov: 50 }; });
      } else G3.cam(G3.shot('reverse'), 0);
    }
    function endReplay() {
      if (rp && rp.bug) rp.bug.remove();
      G3.cam(G3.shot('wide'), 0);
      const t1 = now(); G3.camFollow((t) => { const u = (t - t1) / 1000; return G3.shot('orbit', { a: 0.6 - u * 0.08 }); });
    }
    void P;
    return p;
  }
  function lock(dir, zone) { if (zonesEl) zonesEl.querySelectorAll('.zone').forEach((z) => { const on = zone ? z.dataset.z === zone : z.dataset.d === dir; z.style.background = on ? 'rgba(61,255,154,.3)' : 'transparent'; }); }
  function end() { clearTimeout(warmT); frameJobs = []; cur = null; tags = []; zonesEl = null; root = null; if (window.G3) G3.unmount(); }
  // a stand-in for the CSS scene object penalty.js uses for crowd effects
  function shim() {
    return {
      sprite: (html, x, y, z) => G3.sprite(html, toW(x, y, z)),
      moveSprite: (el, x, y, z) => G3.moveSprite(el, toW(x, y, z)),
      removeSprite: (el) => G3.removeSprite(el),
      shake: (a, ms) => G3.shake(a, ms),
      to() {}, set() {}, apply() {}, add() {},
      destroy: end,
    };
  }
  return { tod: () => tod, config, cfg: () => cfg, setLight: (on) => { light = !!on; }, usable, status, build, aim, kick, lock, end, shim, zones: () => zonesEl, kits: () => kits, lineup: (a) => lineup(Object.assign({}, a0 || {}, a)), _plan: plan, _apply: apply };
})();
