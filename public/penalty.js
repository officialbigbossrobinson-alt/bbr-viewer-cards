// Penalty shootout — 3D scene with live, hidden aiming (used by overlay.html)
window.PEN = (function () {
  let stage = null, onDone = null, root = null, sc = null, data = null, timers = [];
  let objs = {};
  let G = false;   // this game is drawn in the 3D stadium (pen3d.js) instead of the CSS scene
  const esc = (s) => BBR.esc(s);
  const W = 1560, H = 660;
  const ZONE = { TL: [-262, 190], TM: [0, 196], TR: [262, 190], ML: [-262, 118], MM: [0, 112], MR: [262, 118], BL: [-262, 42], BM: [0, 36], BR: [262, 42], WL: [-560, 150], WR: [560, 150], OVER: [40, 330], OVERL: [-230, 335], OVERR: [230, 335], STAY: [0, 0] };
  const ZNUM = { TL: 1, TM: 2, TR: 3, BL: 4, BM: 5, BR: 6 };
  const SPOT_Z = 1100;

  const EXTRA_CSS = `
  .pen .pball{width:30px;height:30px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 35% 30%,#fff,#d7dce2 60%,#7d838b);box-shadow:inset -4px -5px 8px rgba(0,0,0,.35),0 0 6px rgba(255,255,255,.25)}
  .pen .pball i{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 50%,#1b1b1b 0 4px,transparent 5px),radial-gradient(circle at 18% 30%,#1b1b1b 0 2.5px,transparent 3.5px),radial-gradient(circle at 82% 30%,#1b1b1b 0 2.5px,transparent 3.5px),radial-gradient(circle at 30% 86%,#1b1b1b 0 2.5px,transparent 3.5px),radial-gradient(circle at 72% 84%,#1b1b1b 0 2.5px,transparent 3.5px)}
  .pen .pcrowd{opacity:0}
  .pen.roar .pcrowd{animation-duration:.36s!important}
  @keyframes pjump{0%{opacity:0}50%{opacity:1}}
  .pen .pban{position:absolute;display:flex;align-items:center;justify-content:center;font:800 96px 'Barlow Condensed',sans-serif;letter-spacing:8px;white-space:nowrap;overflow:hidden;box-shadow:0 10px 24px rgba(0,0,0,.5);transform:rotate(var(--r));transform-origin:50% 0;animation:pbanw 3.4s ease-in-out infinite}
  .pen .pban::after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 3px,transparent 3px 160px),linear-gradient(180deg,rgba(255,255,255,.12),rgba(0,0,0,.25))}
  @keyframes pbanw{50%{transform:rotate(var(--r)) skewX(1.2deg) scaleY(.97)}}
  .pen .pflag{position:absolute;width:300px;height:190px;transform-origin:0 100%;box-shadow:0 8px 18px rgba(0,0,0,.45);animation:pflagw 1.3s ease-in-out infinite alternate}
  .pen .pflag::before{content:"";position:absolute;left:-6px;bottom:-140px;width:8px;height:330px;background:#bfc4ca}
  .pen .pflag::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.25),rgba(255,255,255,.15) 30%,rgba(0,0,0,.2) 60%,rgba(255,255,255,.1))}
  @keyframes pflagw{0%{transform:skewY(-6deg) scaleX(.94) rotate(-4deg)}100%{transform:skewY(5deg) scaleX(1) rotate(3deg)}}
  .pen .pflare{position:absolute;width:0;height:0}
  .pen .pflare .pool{position:absolute;left:-330px;top:-330px;width:660px;height:660px;border-radius:50%;background:radial-gradient(closest-side,var(--c),transparent);opacity:.45;animation:pflk .13s steps(2) infinite}
  .pen .pflare .core{position:absolute;left:-14px;top:-40px;width:28px;height:44px;border-radius:50%;background:#fff;box-shadow:0 0 30px 14px var(--c),0 0 90px 40px var(--c);animation:pflk .09s steps(2) infinite}
  @keyframes pflk{50%{opacity:.75;transform:scale(1.08)}}
  .pen .psmk{width:260px;height:260px;border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--c) 30%,rgba(200,190,195,.55)),rgba(200,190,195,0));animation:psmk 4.5s linear infinite}
  @keyframes psmk{0%{transform:translate(-50%,-100%) translateY(0) scale(.4);opacity:0}15%{opacity:.75}100%{transform:translate(-50%,-100%) translate(80px,-900px) scale(3.2);opacity:0}}
  .pen .pflash{position:absolute;width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 14px 6px rgba(255,255,255,.8);opacity:0;animation:flashpop 4s infinite}
  .pen .pglare{width:0;height:0}
  .pen .pglare::before{content:"";position:absolute;left:-160px;top:-160px;width:320px;height:320px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,245,.9),rgba(255,250,220,.25) 40%,transparent)}
  .pen .pglare i{position:absolute;left:-700px;top:-3px;width:1400px;height:6px;background:linear-gradient(90deg,transparent,rgba(190,220,255,.55),transparent)}
  .pen .phaze{position:absolute;inset:-10% -20%;background:radial-gradient(ellipse at 20% 60%,rgba(220,200,210,.16),transparent 40%),radial-gradient(ellipse at 70% 40%,rgba(220,210,220,.12),transparent 45%);animation:phaze 26s linear infinite alternate}
  .pen .phaze.b{animation-duration:38s;animation-direction:alternate-reverse;opacity:.7}
  @keyframes phaze{to{transform:translateX(12%)}}
  .pen .pfx{position:absolute;inset:0;pointer-events:none}
  .pen .pvig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 55%,rgba(0,0,0,.55) 100%)}
  .pen .pgrain{position:absolute;inset:-20px;opacity:.06;mix-blend-mode:overlay;animation:pgrain .5s steps(5) infinite}
  @keyframes pgrain{20%{transform:translate(-8px,6px)}40%{transform:translate(7px,-9px)}60%{transform:translate(-5px,-4px)}80%{transform:translate(9px,7px)}}
  @keyframes flashpop{0%,92%{opacity:0}94%{opacity:1}100%{opacity:0}}
  @keyframes ledscroll{to{background-position:-600px 0}}
  .pen .cmp{position:absolute;left:-4px;right:-4px;top:-78px;padding:6px 8px;border-radius:10px;background:rgba(10,12,15,.88);--cc:#3dff9a;transition:box-shadow .3s}
  .pen .cmp .cl{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;font-weight:800;letter-spacing:2px;color:#c3cad3}
  .pen .cmp .cl b{font-size:22px;color:var(--cc);letter-spacing:0}
  .pen .cmp .ct{height:9px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:3px}
  .pen .cmp .ct i{display:block;height:100%;width:50%;border-radius:5px;background:linear-gradient(90deg,color-mix(in srgb,var(--cc) 60%,#000),var(--cc));box-shadow:0 0 10px var(--cc);transition:width .8s cubic-bezier(.3,.9,.3,1),background .4s}
  .pen .cmp em{position:absolute;right:8px;top:-24px;font-style:normal;font-size:26px;font-weight:800;opacity:0}
  .pen .cmp.low{animation:cmpPulse .8s ease-in-out infinite}
  @keyframes cmpPulse{50%{box-shadow:0 0 0 2px #ff4d5e,0 0 24px #ff4d5e}}
  .pen .cmp.low .cl span::after{content:" · NERVES"}
  .pen .mc .bst{top:-26px}
  .pen .redvig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(200,0,20,.45) 100%);opacity:0}
  .pen .redvig.on{animation:redvig 1.1s ease-in-out infinite}
  @keyframes redvig{0%,100%{opacity:.25}20%{opacity:.8}35%{opacity:.35}50%{opacity:.7}}
  .pen .lk.must{background:#ff4d5e;color:#fff}
  .pen .nmw{display:flex;align-items:center;gap:10px}
  .pen .tm.r .nmw{flex-direction:row-reverse}
  .pen .sbav{width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.6)}
  `;
  const CSS = `
  .camflash{width:46px;height:46px;border-radius:50%;background:radial-gradient(closest-side,#fff 0 30%,rgba(255,255,255,.6) 50%,transparent);box-shadow:0 0 30px 12px rgba(255,255,255,.8)}
  .lzdot{width:22px;height:22px;border-radius:50%;background:radial-gradient(closest-side,#fff,#3dff6a 45%,rgba(61,255,106,0));box-shadow:0 0 18px 8px rgba(61,255,106,.8)}
  .pen{position:absolute;left:180px;top:396px;width:${W}px;height:${H}px;border-radius:20px;overflow:hidden;border:2px solid var(--acc);box-shadow:0 20px 60px rgba(0,0,0,.6);animation:arenaIn .7s cubic-bezier(.2,.9,.3,1.1) both;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;background:#0b1220}
  .pen.out{animation:arenaOut .6s ease-in both}
  .pen .hud{position:absolute;inset:0;pointer-events:none}
  .pen .sb{position:absolute;left:50%;top:16px;transform:translateX(-50%);display:flex;align-items:stretch;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.5)}
  .pen .sb .tm{background:rgba(10,12,15,.88);padding:8px 18px;min-width:240px;display:flex;flex-direction:column;gap:6px;backdrop-filter:blur(6px)}
  .pen .sb .tm.r{align-items:flex-end}
  .pen .sb .nm{font-size:28px;font-weight:800;text-transform:uppercase;line-height:1;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pen .sb .tm.on .nm{color:var(--acc)}
  .pen .sb .sc{background:var(--acc);color:#06110b;font-size:48px;font-weight:800;padding:0 22px;display:flex;align-items:center;letter-spacing:2px}
  .pen .dots{display:flex;gap:5px}
  .pen .dot{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.35);box-sizing:border-box}
  .pen .dot.hit{background:var(--acc);border-color:var(--acc)}.pen .dot.fail{background:#ff4d5e;border-color:#ff4d5e}
  .pen .mc{position:absolute;bottom:18px;width:180px;height:263px}
  .pen .mc.l{left:18px}.pen .mc.r{right:18px}
  .pen .mc .in{position:absolute;left:0;top:0;width:260px;height:380px;transform:scale(.69);transform-origin:0 0;transform-style:preserve-3d}
  .pen .mc .bst{position:absolute;left:0;right:0;top:-26px;display:flex;justify-content:center;gap:3px}
  .pen .mc .bst i{width:22px;height:10px;border-radius:3px;background:rgba(255,255,255,.18)}.pen .mc .bst i.on{background:var(--acc);box-shadow:0 0 8px var(--acc)}
  .pen .bar{position:absolute;left:230px;right:230px;bottom:18px;min-height:96px;border-radius:14px;background:rgba(10,12,15,.88);backdrop-filter:blur(6px);padding:12px 20px;box-sizing:border-box;display:flex;flex-direction:column;gap:6px;justify-content:center}
  .pen .bar .t1{font-size:30px;font-weight:800;text-transform:uppercase;letter-spacing:1px;line-height:1.05}
  .pen .bar .t1 b{color:var(--acc)}
  .pen .bar .t2{font-family:Inter,sans-serif;font-size:15px;color:#c3cad3}
  .pen .bar .t2 b{color:#fff}
  .pen .locks{display:flex;gap:10px}
  .pen .lk{padding:5px 12px;border-radius:999px;background:#1d2229;font-size:18px;font-weight:700;letter-spacing:1px}
  .pen .lk.on{background:var(--acc);color:#06110b}
  .pen .timer{height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}
  .pen .timer i{display:block;height:100%;background:var(--acc)}
  .pen .big{position:absolute;left:0;right:0;top:200px;text-align:center;font-size:150px;font-weight:800;letter-spacing:6px;opacity:0;text-shadow:0 8px 0 rgba(0,0,0,.45),0 0 40px rgba(0,0,0,.4)}
  .pen .zone{position:absolute;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:90px;color:rgba(255,255,255,.75);border:3px dashed rgba(255,255,255,.35);box-sizing:border-box}
  .pen .res{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:56px;background:radial-gradient(circle at 40% 50%,rgba(20,26,34,.9),rgba(5,6,8,.97));animation:resIn .5s ease-out both;overflow:hidden}
  .pen .res .wcard{width:260px;height:380px;transform-style:preserve-3d;animation:cardIn 1s cubic-bezier(.2,.8,.2,1) both}
  .pen .res .rk{font-size:22px;font-weight:700;letter-spacing:6px;color:var(--acc)}
  .pen .res .rn{font-weight:800;line-height:.95;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:640px}
  .pen .res .rs{font-size:34px;font-weight:700;color:#d6dce3}
  .pen.g3 .bar{left:300px;right:300px;bottom:12px;min-height:0;padding:8px 16px;gap:4px;border-radius:12px;background:rgba(6,10,20,.82)}
  .pen.g3 .bar .t1{font-size:24px}
  .pen.g3 .bar,.pen.g3 .sb .tm{backdrop-filter:none}
  .pen.g3 .bar .t2{font-size:13px}
  .pen.g3 .bar .lk{font-size:15px;padding:3px 10px}
  .pen.g3 .mc{transform:scale(.68);bottom:10px}
  .pen.g3 .mc.l{transform-origin:0 100%;left:12px}.pen.g3 .mc.r{transform-origin:100% 100%;right:12px}
  .pen.g3 .sb{top:10px;transform:translateX(-50%) scale(.86);transform-origin:50% 0}
  .pen.g3 .zone{font-size:44px!important;border-width:2px;color:rgba(255,255,255,.6)}
  .pen.g3 .big{top:150px;font-size:120px}
  /* while a penalty game is up, the right-hand widgets (fun counters, blood pressure) shrink into the space above it */
  #stage.pen-on .xc{scale:.58;left:1744px!important;top:var(--pt,118px)!important;transition:scale .4s,top .4s,left .4s}
  #stage.pen-on .xbp{scale:.5;left:1748px!important;top:var(--pt,240px)!important;transition:scale .4s,top .4s,left .4s}
  .pen .res .rr{font-family:Inter,sans-serif;font-size:18px;color:#b8c0ca;max-width:620px}
  `;

  function later(fn, t) { timers.push(setTimeout(fn, t)); }
  function clear() {
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    poseTok++;
    if (sc) sc.destroy(); sc = null; G = false;
    if (root) root.remove(); root = null;
    if (stage) stage.classList.remove('pen-on');
    objs = {};
  }
  const $ = (s) => root && root.querySelector(s);
  const tierCol = (c, acc) => BBR.tier(c.tier, acc).color;

  // ---------------- scene ----------------
  const STAND = { z: -1050, tilt: 26, w: 6000, h: 1500 };
  // a point on the sloped stand behind the goal: u = across (0 = left edge), v = up the slope from the front row
  function standPt(u, v) {
    const t = STAND.tilt * Math.PI / 180;
    return [u - STAND.w / 2, v * Math.cos(t), STAND.z - v * Math.sin(t)];
  }

  function build(a) {
    clear();
    data = a;
    if (!document.getElementById('pen-css')) { const s = document.createElement('style'); s.id = 'pen-css'; s.textContent = CSS + EXTRA_CSS; document.head.appendChild(s); }
    root = document.createElement('div');
    root.className = 'pen' + (a.teams ? ' teams' : '');
    root.style.setProperty('--acc', a.accent);
    stage.appendChild(root);
    stage.classList.add('pen-on');
    { let y = 118; stage.querySelectorAll('.xc, .xbp').forEach((el) => { el.style.setProperty('--pt', y + 'px'); y += Math.round(el.offsetHeight * (el.classList.contains('xbp') ? 0.5 : 0.58)) + 8; }); }
    const f = a.fighters, acc = a.accent;
    G = !!(window.PEN3D && PEN3D.usable());
    if (G) { sc = PEN3D.shim(); if (PEN3D.build(root, a)) objs.zones = PEN3D.zones(); else { sc = null; G = false; } }
    if (G) root.classList.add('g3');
    if (!G) { buildWorld(a); todTint(a); }
    buildHud(a, f, acc);
  }
  // v29: time of day on the classic (non-3D) scene too: a light colour wash, random each game unless set
  function todTint(a) {
    const c = (window.PEN3D && PEN3D.cfg && PEN3D.cfg().tod) || 'random', k = ['day', 'golden', 'dusk', 'night'].includes(a.tod) ? a.tod : ['day', 'golden', 'dusk', 'night'].includes(c) ? c : ['day', 'golden', 'dusk', 'night'][Math.floor(Math.random() * 4)];
    const col = { day: 'rgba(255,244,214,.10)', golden: 'rgba(255,150,60,.16)', dusk: 'rgba(110,50,140,.20)', night: '' }[k];
    root.dataset.tod = k;
    if (col) { const d = document.createElement('div'); d.className = 'pen-tod'; d.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;background:' + col; root.appendChild(d); }
  }
  function buildWorld(a) {
    sc = S3D.scene(root, { w: W, h: H, persp: 1100, horizon: 38, centerY: 0.5, css: 'background:' + TEX.sky() });
    const A = (el) => sc.add(el);
    const acc = a.accent;
    const tiltRot = { x: -STAND.tilt };

    // ---- main stand behind the goal: crowd (two frames so it bounces), banners, flares ----
    // everything on the stand lives in ONE flat plane (crowd frames, banners, flares, flashes),
    // so the browser never has to depth-sort them against each other
    const secW = STAND.w / 3;
    let standHtml = '<div style="position:absolute;inset:0;background:' + TEX.crowd(0, acc) + ' 0 0/2048px 1024px repeat"></div>';
    for (let i = 0; i < 3; i++) standHtml += '<div class="pcrowd" style="position:absolute;top:0;bottom:0;left:' + secW * i + 'px;width:' + secW + 'px;background:' + TEX.crowd(1, acc) + ' ' + (-secW * i) + 'px 0/2048px 1024px repeat;animation:pjump ' + (0.8 + i * 0.07) + 's ' + (i * 0.23) + 's steps(1) infinite"></div>';
    standHtml += decoHtml(acc);
    for (let i = 0; i < 46; i++) standHtml += '<div class="pflash" style="left:' + (Math.random() * 100) + '%;top:' + (Math.random() * 92) + '%;animation-duration:' + (2 + Math.random() * 4) + 's;animation-delay:' + (Math.random() * 4) + 's"></div>';
    A(S3D.wall(STAND.w, STAND.h, { z: STAND.z, rot: tiltRot, bg: '#151a22', html: standHtml, css: 'overflow:hidden' }));
    // front wall of the stand
    A(S3D.wall(STAND.w, 120, { z: STAND.z + 20, bg: 'linear-gradient(180deg,#1a212b,#0b0e13)' }));
    // roof edge and floodlight banks
    const top = standPt(STAND.w / 2, STAND.h);
    A(S3D.box(STAND.w + 400, 120, 260, { x: 0, y: top[1], z: top[2] - 40, color: '#0d1117', front: 'linear-gradient(180deg,#1b222c,#07090c)' }));
    const lights = S3D.wall(STAND.w - 600, 70, { y: top[1] + 120, z: top[2] + 80, bg: '#0a0d12', html: lightsHtml() });
    A(lights);
    for (const lx of [-2600, -900, 900, 2600]) sc.sprite('<div class="pglare"><i></i></div>', lx, top[1] + 115, top[2] + 120);
    // light shafts and smoke haze over the stand
    for (const lx of [-1800, 1800]) A(S3D.wall(900, top[1], { x: lx, z: -700, bg: 'linear-gradient(180deg,rgba(255,250,230,.10),rgba(255,250,230,0) 85%)', css: 'clip-path:polygon(40% 0,60% 0,100% 100%,0 100%)' }));
    // flare smoke rises straight up (billboards)
    FLARES.forEach(([u, v, col]) => {
      const [x, y, z] = standPt(u, v);
      for (let i = 0; i < 5; i++) sc.sprite('<div class="psmk" style="--c:' + col + ';animation-delay:' + (-i * 0.9 - Math.random()) + 's"></div>', x + (Math.random() - 0.5) * 40, y + 20, z + 30);
    });
    // ---- LED boards ----
    const adTxt = Array(14).fill('BBR · VIEWER CLUB · TYPE !CARD').join(' · ');
    const ads = S3D.box(4600, 70, 10, { color: '#0b0d10', front: 'linear-gradient(180deg,#10151b,#07090c)',
      html: { front: '<div style="height:100%;overflow:hidden;background:repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 2px,transparent 2px 5px)"><div style="height:100%;display:flex;align-items:center;padding-left:40px;font:800 40px Barlow Condensed,sans-serif;letter-spacing:6px;color:' + acc + ';text-shadow:0 0 14px ' + acc + ',0 0 30px ' + acc + ';white-space:nowrap;animation:ledscroll 9s linear infinite">' + adTxt + '</div></div>' } });
    S3D.place(ads, 0, 0, -480); A(ads);
    A(S3D.plane(4600, 60, { y: 1, z: -455, bg: 'linear-gradient(180deg,' + acc + '55,transparent)', css: 'opacity:.6' }));

    // ---- pitch: high-res grass, mowing stripes, worn goalmouth ----
    const L = 'rgba(255,255,255,.88)';
    const ground = '<div style="position:absolute;left:0;top:600px;width:100%;height:8px;background:' + L + '"></div>' +
      '<div style="position:absolute;left:-316px;top:600px;width:4032px;height:1650px;border:8px solid ' + L + ';border-top:none;box-sizing:border-box"></div>' +
      '<div style="position:absolute;left:784px;top:600px;width:1832px;height:550px;border:8px solid ' + L + ';border-top:none;box-sizing:border-box"></div>' +
      '<div style="position:absolute;left:1690px;top:1690px;width:20px;height:20px;border-radius:50%;background:' + L + '"></div>' +
      '<div style="position:absolute;left:785px;top:2250px;width:1830px;height:500px;border:8px solid ' + L + ';border-radius:0 0 50% 50%/0 0 100% 100%;border-top:none;box-sizing:border-box"></div>' +
      '<div style="position:absolute;left:1200px;top:600px;width:1000px;height:340px;background:radial-gradient(closest-side,rgba(120,95,55,.55),rgba(120,95,55,0));"></div>' +
      '<div style="position:absolute;left:1580px;top:1590px;width:240px;height:220px;background:radial-gradient(closest-side,rgba(130,105,60,.6),rgba(130,105,60,0));"></div>' +
      '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 35%,rgba(255,255,240,.10),rgba(0,0,0,0) 45%,rgba(0,0,0,.45) 100%)"></div>';
    A(S3D.plane(3400, 2700, { z: 750, css: 'overflow:hidden', html: ground,
      bg: 'repeating-linear-gradient(180deg,rgba(255,255,255,.055) 0 220px,rgba(0,0,0,.06) 220px 440px),' + TEX.grass() + ' 0 0/1024px 1024px repeat' }));

    // ---- goal ----
    const postBg = 'linear-gradient(90deg,#c9ced4,#ffffff 40%,#e6e9ec 70%,#9aa1a8)';
    const post = (x) => { const p = S3D.box(14, 244, 14, { color: '#f4f6f8', front: postBg, radius: 7 }); S3D.place(p, x, 0, 0); A(p); };
    post(-373); post(373);
    const bar = S3D.box(760, 14, 14, { color: '#f4f6f8', front: 'linear-gradient(180deg,#fff,#d8dce0 60%,#a7aeb5)', radius: 7 }); S3D.place(bar, 0, 230, 0); A(bar);
    for (const x of [-373, 373]) A(S3D.plane(18, 300, { x: x + 40, y: 1, z: 150, bg: 'linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0))', css: 'transform-origin:50% 0' }));
    const net = 'repeating-linear-gradient(60deg,rgba(255,255,255,.42) 0 1.5px,transparent 1.5px 13px),repeating-linear-gradient(-60deg,rgba(255,255,255,.42) 0 1.5px,transparent 1.5px 13px),rgba(0,0,0,.18)';
    objs.net = S3D.wall(746, 244, { z: -210, bg: net });
    A(objs.net);
    A(S3D.wall(210, 244, { x: -373, z: -105, rot: { y: 90 }, bg: net }));
    A(S3D.wall(210, 244, { x: 373, z: -105, rot: { y: -90 }, bg: net }));
    A(S3D.plane(746, 210, { y: 244, z: -105, bg: net }));

    // aim zones: 3 x 3 (v29), labelled with the shortest thing to type
    let zh = '';
    [['TL', 'LT', 'L'], ['TM', 'T', 'C'], ['TR', 'RT', 'R'], ['ML', 'L', 'L'], ['MM', 'C', 'C'], ['MR', 'R', 'R'], ['BL', 'LB', 'L'], ['BM', 'B', 'C'], ['BR', 'RB', 'R']].forEach(([z, n, d], i) => { zh += '<div class="zone" data-z="' + z + '" data-d="' + d + '" style="left:' + ((i % 3) * 244) + 'px;top:' + (Math.floor(i / 3) * 81) + 'px;width:244px;height:81px;font-size:54px;transition:background .3s">' + n + '</div>'; });
    objs.zones = S3D.wall(732, 244, { z: 6, bg: 'rgba(0,0,0,.18)', html: zh, css: 'opacity:0;transition:opacity .4s' });
    A(objs.zones);

    // ---- players ----
    objs.keeper = keeperRig();
    A(objs.keeper);
    A(objs.kShadow = S3D.shadow(60, { z: -12, squash: 0.6 }));
    objs.kTag = sc.sprite('<div class="s3-label" style="padding:3px 10px;border-radius:6px;background:rgba(10,12,15,.8);font-size:18px">AI KEEPER</div>', 0, 290, -12);
    setPose(READY);
    objs.taker = S3D.person({ kit: '#c33', shorts: '#fff', scale: 1.62, number: '9' });
    S3D.place(objs.taker, -150, 0, SPOT_Z + 200, { y: 180 }); A(objs.taker);
    A(objs.tShadow = S3D.shadow(50, { x: -150, z: SPOT_Z + 200, squash: 0.6 }));
    objs.ball = sc.sprite('<div class="pball"><i></i></div>', 0, 0, SPOT_Z);
    objs.ballSpin = objs.ball.querySelector('i');
    objs.bShadow = S3D.shadow(20, { z: SPOT_Z });
    A(objs.bShadow);
  }
  function buildHud(a, f, acc) {

    // ---- HUD + camera finish (vignette, grain) ----
    const fx = document.createElement('div');
    fx.className = 'pfx';
    // (no film grain over the 3D stadium: it would make OBS re-blend the whole game every frame)
    fx.innerHTML = '<div class="redvig" id="redvig"></div><div class="pvig"></div>' + (G ? '' : '<div class="pgrain" style="background-image:' + TEX.grain() + '"></div>');
    root.appendChild(fx);
    const hud = document.createElement('div');
    hud.className = 'hud';
    const mini = (c, side) => {
      let segs = ''; for (let i = 0; i < 5; i++) segs += '<i title="on-target shot"></i>';
      return '<div class="mc ' + side + '"><div class="cmp" id="cm' + side + '"><div class="cl"><span>COMPOSURE</span><b>--</b></div><div class="ct"><i></i></div><em></em></div><div class="bst" id="bs' + side + '">' + segs + '</div><div class="' + BBR.wrapClass(c.tier) + '"><div class="in">' + BBR.render(c, { accent: acc, edges: 6 }) + '</div></div></div>';
    };
    const chip = (c) => c.avatar && /^https:\/\//.test(c.avatar) ? '<img class="sbav" src="' + esc(c.avatar) + '" alt="" onerror="this.remove()">' : '';
    hud.innerHTML = '<div class="sb"><div class="tm" id="tm0"><div class="nmw">' + chip(f[0]) + '<div class="nm">' + esc(f[0].display) + '</div></div><div class="dots" id="d0"></div></div>' +
      '<div class="sc" id="score">0 – 0</div><div class="tm r" id="tm1"><div class="nmw">' + chip(f[1]) + '<div class="nm">' + esc(f[1].display) + '</div></div><div class="dots" id="d1"></div></div></div>' +
      mini(f[0], 'l') + mini(f[1], 'r') +
      '<div class="bar" id="bar"><div class="t1" id="t1"></div><div class="t2" id="t2"></div></div><div class="big" id="big"></div>';
    root.appendChild(hud);
    setBoosts(f.map((x) => x.boost || 0));
    dots([]);
    sc.set({ tx: 0, ty: 60, tz: 380, dist: 2500, pitch: 12, yaw: 14 });
    sc.to({ yaw: 0, dist: 2050, tz: 420 }, 3500);
  }

  // flares on the stand: [u across, v up the slope, colour]
  const FLARES = [[900, 230, '#ff3b2f'], [1900, 600, '#ff5a3c'], [3450, 330, '#ff2d55'], [4500, 680, '#ff4b2b'], [5300, 260, '#ff3b2f']];
  function decoHtml(acc) {
    const ban = (u, v, w, h, bg, txt, color, rot) => '<div class="pban" style="left:' + u + 'px;bottom:' + v + 'px;width:' + w + 'px;height:' + h + 'px;background:' + bg + ';color:' + color + ';--r:' + (rot || 0) + 'deg"><span>' + txt + '</span></div>';
    const flag = (u, v, a, b, delay) => '<div class="pflag" style="left:' + u + 'px;bottom:' + v + 'px;animation-delay:' + delay + 's;background:repeating-linear-gradient(90deg,' + a + ' 0 40px,' + b + ' 40px 80px)"></div>';
    let h = '';
    h += ban(140, 24, 1050, 140, '#0d0f12', 'BIG BOSS ROBINSON', acc, -1);
    h += ban(1330, 34, 800, 130, 'repeating-linear-gradient(90deg,#c8102e 0 70px,#111 70px 140px)', 'BBR ULTRAS', '#fff', 1);
    h += ban(2300, 20, 1350, 110, 'repeating-linear-gradient(90deg,' + acc + ' 0 90px,#0d0f12 90px 180px)', '', '#fff', 0);
    h += ban(3800, 30, 900, 130, acc, 'FORZA BBR', '#06110b', -1);
    h += ban(4850, 24, 1000, 140, 'repeating-linear-gradient(90deg,#111 0 60px,#f2f2f2 60px 120px)', '<b style="background:#c8102e;padding:0 24px">CURVA BOSS</b>', '#fff', 1);
    h += ban(2000, 900, 1200, 150, '#0d0f12', 'NO BOSS · NO PARTY', '#ffd23f', 0);
    h += ban(3700, 1080, 820, 120, '#1d3f8a', 'FC 27 · ATS · ETS', '#fff', -2);
    [[550, 700, '#c8102e', '#111'], [1250, 980, acc, '#0d0f12'], [3150, 760, '#ffd23f', '#111'], [4300, 960, '#f2f2f2', '#c8102e'], [5500, 720, acc, '#f2f2f2'], [1700, 470, '#1d3f8a', '#f2f2f2']]
      .forEach(([u, v, a, b], i) => { h += flag(u, v, a, b, (i * 0.37).toFixed(2)); });
    FLARES.forEach(([u, v, col]) => {
      h += '<div class="pflare" style="left:' + u + 'px;bottom:' + v + 'px;--c:' + col + '"><i class="pool"></i><i class="core"></i></div>';
    });
    return h;
  }
  function lightsHtml() {
    let h = '<div style="display:flex;gap:26px;justify-content:center;align-items:center;height:100%">';
    for (let b = 0; b < 4; b++) {
      h += '<div style="display:grid;grid-template-columns:repeat(8,22px);gap:6px;padding:0 60px">';
      for (let i = 0; i < 16; i++) h += '<i style="display:block;width:22px;height:22px;border-radius:4px;background:#fffef2;box-shadow:0 0 18px 6px rgba(255,252,225,.85)"></i>';
      h += '</div>';
    }
    return h + '</div>';
  }

  // ---------------- AI keeper rig (shoulders, hips and gloves bend) ----------------
  const KS = 1.62, ARM = 46 * KS, SHO_Y = 98 * KS, SHO_X = 26 * KS, HAND = 52 * KS;
  const READY = { x: 0, y: 0, rot: 0, aL: 38, aR: 38, fwd: 0, lL: 10, lR: 10, sq: 0.06 };
  function keeperRig() {
    const s = KS, kit = '#ffd23f', g = S3D.div('s3-g');
    const limb = (w, h, d, c, extra) => S3D.box(w * s, h * s, d * s, Object.assign({ color: c }, extra || {}));
    const pivot = () => S3D.div('s3-g');
    const legs = [-10, 10].map((x) => { const p = pivot(); const b = limb(14, 46, 16, '#1b1f25'); p.appendChild(b);
      const sock = limb(15, 14, 17, '#f2f2f2'); p.appendChild(sock); const boot = limb(16, 7, 24, '#0b0b0b'); S3D.place(boot, 0, 0, 3 * s); p.appendChild(boot);
      p._x = x * s; g.appendChild(p); return p; });
    const shorts = limb(42, 18, 23, '#1b1f25'); S3D.place(shorts, 0, 40 * s, 0); g.appendChild(shorts);
    const torso = limb(40, 54, 22, kit, { front: 'linear-gradient(160deg,#ffe36b,#f5c400 55%,#c99d00)', side: '#d9ad00' });
    S3D.place(torso, 0, 46 * s, 0); g.appendChild(torso);
    const fr = torso.querySelector('[data-face="front"]'); if (fr) fr.innerHTML = '<div class="s3-label" style="font-size:24px;line-height:' + 54 * s + 'px;color:rgba(0,0,0,.65);text-shadow:none">AI</div>';
    const bk = torso.querySelector('[data-face="back"]'); if (bk) bk.innerHTML = '<div class="s3-label" style="font-size:44px;line-height:' + 54 * s + 'px;color:rgba(0,0,0,.65);text-shadow:none">1</div>';
    const head = limb(22, 22, 22, '#d9a77c', { radius: 6 }); S3D.place(head, 0, 101 * s, 0); g.appendChild(head);
    const hair = S3D.box(24 * s, 7 * s, 24 * s, { color: '#141414', radius: 5 }); S3D.place(hair, 0, 120 * s, 0); g.appendChild(hair);
    const arms = [-1, 1].map((side) => { const p = pivot(); const b = limb(11, 46, 12, kit, { side: '#d9ad00' }); p.appendChild(b);
      const glove = limb(16, 15, 15, '#f4f6f8', { radius: 4, front: 'linear-gradient(180deg,#fff,#cfd5db)' }); S3D.place(glove, 0, -10 * s, 0); p.appendChild(glove);
      p._x = side * SHO_X; g.appendChild(p); return p; });
    g._legs = legs; g._arms = arms;
    return g;
  }
  let pose = Object.assign({}, READY), poseTok = 0;
  function setPose(p) {
    Object.assign(pose, p);
    const k = objs.keeper; if (!k) return;
    k.style.transform = S3D.pos(pose.x, pose.y, -12) + ' rotateZ(' + pose.rot + 'deg) scale3d(1,' + (1 - pose.sq) + ',1)';
    const [aL, aR] = k._arms;
    aL.style.transform = S3D.pos(aL._x, SHO_Y, 0) + ' rotateZ(' + pose.aL + 'deg) rotateX(' + pose.fwd + 'deg) translate3d(0,' + ARM + 'px,0)';
    aR.style.transform = S3D.pos(aR._x, SHO_Y, 0) + ' rotateZ(' + (-pose.aR) + 'deg) rotateX(' + pose.fwd + 'deg) translate3d(0,' + ARM + 'px,0)';
    const [lL, lR] = k._legs;
    lL.style.transform = S3D.pos(lL._x, 46 * KS, 0) + ' rotateZ(' + pose.lL + 'deg) translate3d(0,' + 46 * KS + 'px,0)';
    lR.style.transform = S3D.pos(lR._x, 46 * KS, 0) + ' rotateZ(' + (-pose.lR) + 'deg) translate3d(0,' + 46 * KS + 'px,0)';
    // shadow and name tag follow the keeper
    const lift = Math.max(0, pose.y), lying = Math.abs(Math.sin(pose.rot * Math.PI / 180));
    if (objs.kShadow) objs.kShadow.style.transform = S3D.pos(pose.x + Math.sin(pose.rot * Math.PI / 180) * 110, 1, -12) + ' rotateX(90deg) scale(' + (1 + lying * 1.4) + ',' + Math.max(0.5, 1 - lift / 300) + ')';
    if (objs.kTag) sc.moveSprite(objs.kTag, pose.x, 290 - lying * 150 + pose.y, -12);
    if (objs.hold) { const h = hands(); ballAt(h[0], h[1] - 14, h[2]); }
    else sc.apply();
  }
  // world position of the point between the gloves for a pose
  function hands(p) {
    p = p || pose;
    const R = (x, y, deg) => { const t = -deg * Math.PI / 180; return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)]; };
    const hl = R(0, -HAND, p.aL), hr = R(0, -HAND, -p.aR);
    const fw = Math.cos(p.fwd * Math.PI / 180);
    const mid = [((-SHO_X + hl[0]) + (SHO_X + hr[0])) / 2, SHO_Y * (1 - p.sq) + ((hl[1] + hr[1]) / 2) * fw];
    const w = R(mid[0], mid[1], p.rot);
    return [p.x + w[0], p.y + w[1], -12 + HAND * Math.max(0, Math.sin(p.fwd * Math.PI / 180)) + 12];
  }
  // pose whose gloves meet a target point
  function reachPose(tx, ty, extra) {
    const side = tx < -40 ? -1 : tx > 40 ? 1 : 0;
    if (!side) {
      // central: jump or drop with the arms up/forward
      const p = Object.assign({}, READY, { aL: ty > 150 ? 168 : 28, aR: ty > 150 ? 168 : 28, fwd: ty > 150 ? 0 : 62, lL: ty > 150 ? 6 : 16, lR: ty > 150 ? 6 : 16, sq: ty < 90 ? 0.2 : 0 }, extra || {});
      const h = hands(Object.assign({}, p, { x: 0, y: 0 }));
      p.x = tx - h[0]; p.y = Math.max(0, Math.min(70, ty - h[1]));
      return p;
    }
    const ang = ty > 120 ? 56 : 80;
    const p = Object.assign({ x: 0, y: 0, rot: side * ang, aL: 166, aR: 166, fwd: 0, lL: side < 0 ? 4 : 26, lR: side > 0 ? 4 : 26, sq: 0 }, extra || {});
    const h = hands(Object.assign({}, p, { x: 0, y: 0 }));
    p.x = tx - h[0]; p.y = Math.max(-6, ty - h[1]);
    return p;
  }
  const ease = { out: (t) => 1 - Math.pow(1 - t, 3), inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), lin: (t) => t, back: (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2) };
  function poseTo(target, ms, e, wobble) {
    const tok = poseTok, from = Object.assign({}, pose), t0 = performance.now(), fn = ease[e || 'inout'];
    return new Promise((res) => {
      const step = (now) => {
        if (tok !== poseTok || !objs.keeper) return res(false);
        const u = Math.min(1, (now - t0) / ms), k = fn(u), p = {};
        for (const key of Object.keys(target)) p[key] = from[key] + (target[key] - from[key]) * k;
        if (wobble) wobble(p, u);
        setPose(p);
        if (u < 1) requestAnimationFrame(step); else res(true);
      };
      requestAnimationFrame(step);
    });
  }
  // little steps while walking back to the line
  const walk = (p, u) => { const ph = u * Math.PI * 6; p.y = (p.y || 0) + Math.abs(Math.sin(ph)) * 7; p.lL = 10 + Math.sin(ph) * 14; p.lR = 10 - Math.sin(ph) * 14; p.rot = (p.rot || 0) + Math.sin(ph) * 2; };
  // ready stance: shuffling on the line while the shooter picks a side
  function idle() {
    const tok = ++poseTok, t0 = performance.now();
    objs.hold = false;
    const step = (now) => {
      if (tok !== poseTok || !objs.keeper) return;
      const t = (now - t0) / 1000;
      setPose(Object.assign({}, READY, { x: Math.sin(t * 1.9) * 26, y: Math.abs(Math.sin(t * 5.2)) * 6, aL: 38 + Math.sin(t * 3) * 6, aR: 38 - Math.sin(t * 3) * 6, rot: Math.sin(t * 1.9) * 2 }));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const compCol = (v) => (v >= 60 ? '#3dff9a' : v >= 35 ? '#ffb020' : '#ff4d5e');
  function setComp(c, prev) {
    if (!c) return;
    ['l', 'r'].forEach((side, i) => {
      const el = $('#cm' + side); if (!el || c[i] == null) return;
      const v = c[i];
      el.style.setProperty('--cc', compCol(v));
      el.querySelector('b').textContent = v;
      el.querySelector('.ct i').style.width = Math.max(2, v) + '%';
      el.classList.toggle('low', v < 35);
      const d = prev && prev[i] != null ? v - prev[i] : 0;
      if (d) {
        const em = el.querySelector('em');
        em.textContent = (d > 0 ? '+' : '') + d; em.style.color = d > 0 ? '#3dff9a' : '#ff4d5e';
        em.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none', offset: 0.2 }, { opacity: 1, offset: 0.7 }, { opacity: 0, transform: 'translateY(-14px)' }], { duration: 1600 });
      }
    });
    if (data) data.comp = c.slice();
  }
  function heart(on) {
    clearInterval(objs.hb); objs.hb = null;
    const rv = $('#redvig'); if (rv) rv.classList.toggle('on', !!on);
    if (on) { SFX.play('heartbeat'); objs.hb = setInterval(() => SFX.play('heartbeat'), 1100); timers.push(objs.hb); }
  }

  function setBoosts(b) {
    ['l', 'r'].forEach((s, i) => { const el = $('#bs' + s); if (el) Array.from(el.children).forEach((x, k) => x.classList.toggle('on', k < (b[i] || 0))); });
  }
  function dots(kicks) {
    [0, 1].forEach((s) => {
      const mine = kicks.filter((k) => k.s === s);
      let h = '';
      for (let j = 0; j < Math.max(5, mine.length); j++) { const k = mine[j]; h += '<div class="dot' + (k ? (k.result === 'goal' ? ' hit' : ' fail') : '') + '"></div>'; }
      const d = $('#d' + s); if (d) d.innerHTML = h;
    });
  }
  function bar(t1, t2) { const a = $('#t1'), b = $('#t2'); if (a) a.innerHTML = t1; if (b) b.innerHTML = t2 || ''; }
  function big(text, color, ms) {
    const b = $('#big'); if (!b) return;
    b.textContent = text; b.style.color = color;
    b.animate([{ opacity: 0, transform: 'scale(2.4)' }, { opacity: 1, transform: 'scale(1)', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0, transform: 'scale(.95)' }], { duration: ms || 1700, easing: 'ease-out' });
  }

  function dressPlayers(s) {
    const f = data.fighters, acc = data.accent;
    const shooter = f[s], keeper = f[1 - s];
    const recolor = (g, kit) => { for (const p of ['torso', 'armL', 'armR']) g.parts[p].querySelectorAll('.s3-face').forEach((fc) => { const n = fc.dataset.face; fc.style.background = S3D.shade(kit, { front: 1, back: 0.7, right: 0.8, left: 0.78, top: 1.18 }[n] || 1); }); };
    recolor(objs.taker, hexOf(tierCol(shooter, acc)));
    const back = objs.taker.parts.torso.querySelector('[data-face="back"]');
    if (back) back.innerHTML = '<div class="s3-label" style="font-size:15px;line-height:20px;padding-top:8px;color:rgba(0,0,0,.75)">' + esc(String(shooter.display).slice(0, 10).toUpperCase()) + '</div><div class="s3-label" style="font-size:40px;line-height:44px;color:rgba(0,0,0,.75);text-shadow:none">' + (shooter.ovr || 9) + '</div>';
    if (data.boss && objs.kTag) { const t = objs.kTag.querySelector('.s3-label'); if (t) t.textContent = s === 0 ? 'THE BOSS' : String(keeper.display).toUpperCase(); }
    $('#tm0').classList.toggle('on', s === 0);
    $('#tm1').classList.toggle('on', s === 1);
  }
  function hexOf(c) { return /^#[0-9a-f]{6}$/i.test(c) ? c : '#3dff9a'; }
  function keeperKit(c, acc) { return { bronze: '#e0a26a', silver: '#c9d0d8', gold: '#f6d77a', legend: acc }[c.tier] || '#ffd23f'; }

  function resetPositions() {
    poseTok++;
    objs.hold = false;
    setPose(READY);
    objs.taker.getAnimations().forEach((x) => x.cancel());
    objs.tShadow.getAnimations().forEach((x) => x.cancel());
    S3D.place(objs.taker, -150, 0, SPOT_Z + 200, { y: 180 });
    S3D.place(objs.tShadow, -150, 1, SPOT_Z + 200, null, ' rotateX(90deg)');
    ballAt(0, 15, SPOT_Z);
    objs.ball.style.opacity = 1;
    objs.net.getAnimations().forEach((x) => x.cancel());
  }
  function ballAt(x, y, z) {
    if (!sc || !objs.ball) return;   // the arena closed mid-kick
    sc.moveSprite(objs.ball, x, y - 15, z);
    sc.apply();
    const s = Math.max(0.3, 1 - y / 400);
    objs.bShadow.style.transform = S3D.pos(x, 1, z) + ' rotateX(90deg) scale(' + s + ')';
    objs.bShadow.style.opacity = s;
  }
  function flight(from, to, ms, height, curl) {
    return new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => {
        const u = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - u, 1.6);
        const x = from[0] + (to[0] - from[0]) * e + (curl || 0) * Math.sin(Math.PI * e);
        const y = from[1] + (to[1] - from[1]) * e + (height || 0) * 4 * e * (1 - e);
        const z = from[2] + (to[2] - from[2]) * e;
        ballAt(x, y, z);
        if (objs.ballSpin) objs.ballSpin.style.transform = 'rotate(' + (e * ms * 1.4) + 'deg)';
        if (u < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }
  // ---------------- phases ----------------
  function matchup(a) {
    build(a);
    const f = a.fighters;
    big('VS', a.accent, 2600);
    SFX.play('boom', 0); SFX.play('whoosh', 0.1); SFX.play('cheer', 0.4, 3);
    const upd = () => {
      const left = Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000));
      bar('<b>' + esc(f[0].display) + '</b> vs <b>' + esc(f[1].display) + '</b> vs the AI keeper · ' + left + 's to buy ON TARGET shots',
        'Cheer bits, Kicks or a Super Chat with a player\'s name: 100 = 1 kick that can\'t go wide or over (max 5) + steadier nerves · players: sub or gift for +2');
    };
    upd();
    timers.push(setInterval(upd, 1000));
    setComp(a.comp);
  }

  function boosted(a) {
    if (!root) return;
    setBoosts(a.boosts);
    if (a.comp) setComp(a.comp, data && data.comp);
    SFX.play('shield'); SFX.play('ding', 0.1);
  }

  function start(a) {
    if (!root) build(a);
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    data = Object.assign({}, data || {}, a);
    setBoosts(a.shields || a.fighters.map((x) => x.boost || 0));
    setComp(a.comp, data.comp);
    if (a.teams) {
      big('KICK OFF', '#f5c400', 2200);
      bar('<b>' + a.teams.size + ' v ' + a.teams.size + ' penalty shootout</b> · ' + a.teams.sides.map((s) => esc(s.name)).join(' v ') + ' · AI keeper in goal',
        'Sides take turns. On your kick type <b>L</b>, <b>C</b> or <b>R</b> (no pick = a miss). Crowd: <b>!boo</b> <b>!horn</b> <b>!flash</b> to put the shooter off, <b>!chant</b> to back them.');
    } else if (a.boss) {
      big('BEAT THE BOSS', '#ff3b3b', 2400);
      bar('<b>' + esc(a.fighters[0].display) + '</b> vs <b style="color:#ff6b6b">THE BOSS</b> · penalty shootout',
        '<b>' + esc(a.fighters[0].display) + '</b>: type <b>L</b>, <b>C</b> or <b>R</b> to shoot on your kick. AI keepers in both goals. Most goals from 5 wins. Beat him and take the bounty.');
    } else {
    big('SHOOTOUT', a.accent, 2200);
    bar('<b>Penalty shootout</b> · beat the AI keeper',
      'On your kick type <b>L</b>, <b>C</b> or <b>R</b>. <b>COMPOSURE</b> drops every kick and crashes in sudden death: low nerves = more misses and the keeper reads you. Chat can steady a player with bits, Kicks or Super Chats.');
    }
    SFX.play('whistle', 0.2, true); SFX.play('cheer', 0.3, 2.5);
    sc.to({ yaw: 0, dist: 2050, tz: 420, ty: 60, pitch: 12 }, 1500);
  }

  function aim(a) {
    if (!root) return;
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    data.kicks = a.kicks || data.kicks || [];
    if (a.shooter) { data.fighters = (data.fighters || []).slice(); data.fighters[a.s] = a.shooter; data.teams = a.teams; }
    if (G) { PEN3D.aim(Object.assign({}, a, { fighters: data.fighters })); $('#tm0').classList.toggle('on', a.s === 0); $('#tm1').classList.toggle('on', a.s === 1); }
    else { resetPositions(); idle(); dressPlayers(a.s); }
    const f = data.fighters, sh = f[a.s], kp = f[1 - a.s];
    $('#score').textContent = a.score[0] + ' – ' + a.score[1];
    objs.zones.style.opacity = 1;
    objs.zones.querySelectorAll('.zone').forEach((z) => { z.style.background = 'transparent'; });
    data.locks = {};
    setBoosts(a.shields || []);
    setComp(a.comp, data.comp);
    const myComp = (a.comp || [])[a.s];
    if (a.shock) {
      big('SUDDEN DEATH', '#ff4d5e', 2400); SFX.play('boom'); SFX.play('ooh', 0.2); sc.shake(8, 600);
      ['l', 'r'].forEach((sd) => { const el = $('#cm' + sd); if (el) el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 700 }); });
    }
    heart(myComp != null && myComp < 35);
    // shaky camera when the shooter is nervous
    if (myComp != null && myComp < 35) timers.push(setInterval(() => sc && sc.shake(2.5, 400), 900));
    const total = a.endsAt - Date.now();
    const draw = () => {
      const left = Math.max(0, a.endsAt - Date.now());
      const tok = (a.shields || [])[a.s] || 0;
      const picked = data.locks.dir ? (({ T: 'TOP ', B: 'BOTTOM ' }[data.locks.h] || '') + ({ L: 'LEFT', C: 'CENTRE', R: 'RIGHT' }[data.locks.dir])) : null;
      const kp = 'the AI keeper';
      bar((a.teams ? '<b style="color:' + a.teams.sides[a.s].color + '">' + esc(a.teams.sides[a.s].name) + '</b> · ' : '') + (a.sd || (!a.teams && a.round > 5) ? '<b style="color:#ff4d5e">SUDDEN DEATH</b> · ' : 'Kick ' + a.round + ' · ') + '<b>' + esc(a.s === 1 && data.boss ? 'THE BOSS' : sh.display) + '</b> vs ' + esc(kp),
        '<div class="locks"><span class="lk' + (picked ? ' on' : '') + '">' + (picked ? 'AIMING ' + picked : data.boss && a.s === 1 ? 'THE BOSS IS PICKING' : 'Type L / C / R · add T or B (LT, RB)') + '</span>' +
        '<span class="lk' + (tok ? ' on' : '') + '">' + (tok ? tok + ' ON TARGET' : 'No on-target shots') + '</span>' +
        (a.must ? '<span class="lk must">MUST SCORE</span>' : '') + (myComp != null && myComp < 35 ? '<span class="lk must">NERVES!</span>' : '') + '</div>' +
        (G ? '<div style="margin-top:3px"><b>No pick = miss</b> · Crowd: !boo !horn !flash · !chant to back them</div>' : '<div style="margin-top:6px"><b>No pick = you miss!</b> · Crowd: !boo !horn !flash !laser !flare !firework to put them off, !chant to back them</div>') +
        '<div class="timer" style="margin-top:6px"><i style="width:' + (100 * left / Math.max(1, total)) + '%"></i></div>');
    };
    draw();
    timers.push(setInterval(draw, 200));
    sc.to({ yaw: a.s === 0 ? 4 : -4, dist: 2050, tz: 420, ty: 60, pitch: 12 }, 900);
    SFX.play('whistle', 0.15);
  }

  // ---------- the crowd (viewers who aren't playing) ----------
  function crowd(a) {
    if (!root || !sc) return;
    if (a.comp) setComp(a.comp, data && data.comp);
    const who = esc(String(a.by || 'Someone'));
    const msg = { boo: who + ' starts the boos', flare: who + ' lit a flare', firework: who + ' set off fireworks', horn: who + ' blasts an air horn', drum: who + ' bangs the drum', chant: who + ' starts a chant for the shooter', flash: who + ' gets the camera flashes going', laser: who + ' shines a laser at the striker' }[a.kind] || who;
    crowdFeed(msg + (a.capped ? ' · they\'ve blocked it out' : a.kind === 'chant' ? ' · +' + (a.cost || 1) + ' composure' : ' · -' + (a.cost || (a.kind === 'flare' || a.kind === 'firework' ? 2 : 1)) + ' composure'), a.kind === 'chant');
    const u = 400 + Math.random() * (STAND.w - 800), v = 150 + Math.random() * 700;
    const [x, y, z] = standPt(u, v);
    if (a.kind === 'boo' || a.kind === 'horn' || a.kind === 'drum' || a.kind === 'chant') {
      const txt = { boo: 'BOOOO!', horn: 'HONK!', drum: 'BOOM BOOM!', chant: 'OLE OLE!' }[a.kind];
      const b = sc.sprite('<div class="s3-label" style="font-size:120px;color:' + (a.kind === 'chant' ? '#3dff9a' : '#ff5d6c') + ';text-shadow:0 6px 0 rgba(0,0,0,.6),0 0 30px rgba(0,0,0,.6)">' + txt + '</div>', x, y + 100, z + 60);
      b.firstChild.animate([{ transform: 'translate(-50%,-100%) scale(.4)', opacity: 0 }, { transform: 'translate(-50%,-100%) scale(1.1)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%,-160%) scale(1)', opacity: 0 }], { duration: 1600, fill: 'forwards' });
      setTimeout(() => sc && sc.removeSprite(b), 1700);
      if (a.kind === 'boo') { SFX.play('ooh'); SFX.play('whistle', 0.2); }
      if (a.kind === 'horn') SFX.play('horn', 0, 0.6);
      if (a.kind === 'drum') { SFX.play('thud'); SFX.play('thud', 0.3); SFX.play('thud', 0.6); }
      if (a.kind === 'chant') SFX.play('cheer', 0, 1.4);
    } else if (a.kind === 'flare') {
      const f = sc.sprite('<div style="width:90px;height:90px;border-radius:50%;background:radial-gradient(closest-side,#fff,#ff3b2f 35%,rgba(255,59,47,.35) 60%,transparent)"></div>', x, y + 20, z + 40);
      f.firstChild.animate([{ opacity: 0.4, transform: 'translate(-50%,-100%) scale(.8)' }, { opacity: 1, transform: 'translate(-50%,-100%) scale(1.15)' }], { duration: 120, iterations: 30, direction: 'alternate' });
      for (let i = 0; i < 6; i++) { const p = sc.sprite('<div class="psmk" style="--c:#ff3b2f;animation-duration:3.5s;animation-delay:' + (i * 0.4) + 's;animation-iteration-count:1"></div>', x + (Math.random() - 0.5) * 60, y + 20, z + 40); setTimeout(() => sc && sc.removeSprite(p), 4000 + i * 400); }
      setTimeout(() => sc && sc.removeSprite(f), 3600);
      SFX.play('burst'); SFX.play('cheer', 0.2, 1);
    } else if (a.kind === 'flash') {
      // a ripple of camera flashes across the stand, and the striker's view goes white for a moment
      for (let i = 0; i < 34; i++) {
        const [fx, fy, fz] = standPt(200 + Math.random() * (STAND.w - 400), 100 + Math.random() * 1100);
        const p = sc.sprite('<div class="camflash"></div>', fx, fy, fz + 50);
        p.firstChild.animate([{ opacity: 0, transform: 'translate(-50%,-100%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-100%) scale(1.3)', offset: 0.15 }, { opacity: 0, transform: 'translate(-50%,-100%) scale(.6)' }], { duration: 260, delay: Math.random() * 1600, fill: 'both' });
        setTimeout(() => sc && sc.removeSprite(p), 2000);
      }
      const w = document.createElement('div'); w.style.cssText = 'position:absolute;inset:0;background:#fff;pointer-events:none;opacity:0;z-index:4'; root.appendChild(w);
      w.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.08 }, { opacity: 0 }, { opacity: 0.35, offset: 0.4 }, { opacity: 0 }], { duration: 1500 }).onfinish = () => w.remove();
      for (let k = 0; k < 7; k++) SFX.play('tick', k * 0.18 + Math.random() * 0.1);
    } else if (a.kind === 'laser') {
      // green laser pointers from the crowd onto the striker's face
      const dot = sc.sprite('<div class="lzdot"></div>', -150, 236, SPOT_Z + 214);
      const svgNS = 'http://www.w3.org/2000/svg';
      const sv = document.createElementNS(svgNS, 'svg'); sv.setAttribute('width', '100%'); sv.setAttribute('height', '100%'); sv.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4';
      const box = root.getBoundingClientRect();
      const srcs = Array.from({ length: 3 }, () => [80 + Math.random() * (box.width - 160), 40 + Math.random() * box.height * 0.28]);
      const lines = srcs.map(() => { const l = document.createElementNS(svgNS, 'line'); l.setAttribute('stroke', '#3dff6a'); l.setAttribute('stroke-width', '3'); l.setAttribute('stroke-linecap', 'round'); l.style.filter = 'drop-shadow(0 0 6px #3dff6a)'; l.setAttribute('opacity', '.75'); sv.appendChild(l); return l; });
      root.appendChild(sv);
      const t0 = performance.now(), dur = 3200;
      const step = (now) => {
        if (!sc || !root) return;
        const u = (now - t0) / dur;
        if (u >= 1) { sv.remove(); sc.removeSprite(dot); return; }
        sc.moveSprite(dot, -150 + Math.sin(now / 90) * 10, 236 + Math.cos(now / 70) * 8, SPOT_Z + 214);
        const r = dot.firstChild.getBoundingClientRect(), b = root.getBoundingClientRect(), k = b.width / root.offsetWidth || 1;
        const tx = (r.left + r.width / 2 - b.left) / k, ty = (r.top + r.height / 2 - b.top) / k;
        lines.forEach((l, i) => { l.setAttribute('x1', srcs[i][0] / k); l.setAttribute('y1', srcs[i][1] / k); l.setAttribute('x2', tx + Math.sin(now / 60 + i) * 6); l.setAttribute('y2', ty + Math.cos(now / 50 + i) * 6); l.setAttribute('opacity', (0.5 + Math.random() * 0.4).toFixed(2)); });
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      SFX.play('laser', 0, -0.3); SFX.play('ooh', 0.4);
    } else if (a.kind === 'firework') {
      const sky = [x, y + 600 + Math.random() * 400, z - 200];
      for (let i = 0; i < 26; i++) {
        const ang = (i / 26) * Math.PI * 2, col = ['#ffd23f', '#ff5fa2', '#4dc3ff', '#3dff9a'][i % 4];
        const p = sc.sprite('<div style="width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 0 18px 6px ' + col + '"></div>', sky[0], sky[1], sky[2]);
        p.firstChild.animate([{ transform: 'translate(-50%,-100%)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + Math.cos(ang) * 320 + 'px),calc(-100% + ' + (Math.sin(ang) * 320 + 120) + 'px))', opacity: 0 }], { duration: 1400, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' });
        setTimeout(() => sc && sc.removeSprite(p), 1500);
      }
      SFX.play('boom'); SFX.play('sparkle', 0.1); SFX.play('boom', 0.4);
    }
    if (a.kind !== 'chant' && !a.capped && sc) sc.shake(3, 300);
  }
  function crowdFeed(text, good) {
    let f = $('#cfeed');
    if (!f) { f = document.createElement('div'); f.id = 'cfeed'; f.style.cssText = 'position:absolute;right:220px;top:110px;display:flex;flex-direction:column;gap:5px;align-items:flex-end;pointer-events:none'; root.querySelector('.hud').appendChild(f); }
    const d = document.createElement('div');
    d.style.cssText = 'padding:5px 12px;border-radius:8px;background:rgba(10,12,15,.88);font:700 18px Barlow Condensed,sans-serif;color:' + (good ? '#3dff9a' : '#ff8a96');
    d.innerHTML = text; f.appendChild(d);
    d.animate([{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'none' }], { duration: 250 });
    while (f.children.length > 4) f.firstChild.remove();
    setTimeout(() => d.remove(), 6000);
  }

  function lock(a) {
    if (!root || !data) return;
    data.locks = data.locks || {};
    data.locks[a.role] = true;
    if (a.dir) {
      data.locks.dir = a.dir; data.locks.h = a.h || 'M';
      if (objs.zones) objs.zones.querySelectorAll('.zone').forEach((z) => { const on = a.zone ? z.dataset.z === a.zone : z.dataset.d === a.dir; z.style.background = on ? 'rgba(61,255,154,.3)' : 'transparent'; });
    }
    SFX.play('pop'); SFX.play('tick', 0.05);
    if (a.dir) {
      const li = document.createElement('div');
      li.style.cssText = 'position:absolute;left:50%;top:40px;transform:translateX(-50%);padding:8px 22px;border-radius:999px;background:#3dff9a;color:#06110b;font-family:"Barlow Condensed",sans-serif;font-weight:800;font-size:30px;letter-spacing:3px;z-index:20;box-shadow:0 6px 20px rgba(0,0,0,.5);transition:opacity .4s';
      li.textContent = 'LOCKED IN: ' + ({ T: 'TOP ', B: 'BOTTOM ' }[a.h] || '') + ({ L: 'LEFT', C: 'CENTRE', R: 'RIGHT' }[a.dir] || a.dir);
      root.appendChild(li); setTimeout(() => { li.style.opacity = '0'; setTimeout(() => li.remove(), 500); }, 1600);
    }
  }

  async function kick(a) {
    if (!root) return;
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    if (G) return kick3d(a);
    const k = a.k, f = data.fighters, sh = f[k.s];
    const tok = ++poseTok;
    objs.hold = false;
    objs.zones.style.opacity = 0;
    bar('<b>' + esc(sh.display) + '</b> steps up…', '');
    // keeper settles into the set position
    poseTo(Object.assign({}, READY, { sq: 0.1, aL: 44, aR: 44 }), 500, 'out');
    // run-up
    objs.taker.animate([{ transform: S3D.pos(-150, 0, SPOT_Z + 200) + ' rotateY(180deg)' }, { transform: S3D.pos(-90, 6, SPOT_Z + 120) + ' rotateY(180deg)' },
      { transform: S3D.pos(-40, 0, SPOT_Z + 40) + ' rotateY(180deg) rotateX(-8deg)' }], { duration: 900, easing: 'ease-in', fill: 'forwards' });
    objs.tShadow.animate([{ transform: S3D.pos(-150, 1, SPOT_Z + 200) + ' rotateX(90deg)' }, { transform: S3D.pos(-40, 1, SPOT_Z + 40) + ' rotateX(90deg)' }], { duration: 900, easing: 'ease-in', fill: 'forwards' });
    sc.to({ dist: 1800, tz: 330, yaw: 0, pitch: 10 }, 1100);
    await wait(900);
    if (tok !== poseTok) return;
    SFX.play('kick');
    const tg = ZONE[k.target] || ZONE.BM;
    const sideOf = (z) => (z && z[1] === 'L' ? -1 : z && z[1] === 'R' ? 1 : 0);
    const F = 560;
    const save = k.result === 'save', goal = k.result === 'goal';
    // where the keeper goes
    let kp;
    if (save) kp = reachPose(tg[0], tg[1]);
    else if (goal && k.dive === k.target) kp = reachPose(tg[0] * 0.62, tg[1] - 50);           // right way, beaten to the corner
    else if (k.dive === 'STAY' || !ZONE[k.dive]) kp = Object.assign({}, READY, { y: 30, aL: 120, aR: 120, sq: 0 });
    else kp = reachPose(ZONE[k.dive][0], ZONE[k.dive][1]);
    const dir = Math.sign(kp.rot) || 0;
    later(() => { if (tok === poseTok) poseTo(kp, F - 90, 'out'); }, 90);
    // the ball: into the gloves on a save, otherwise to its target
    const ballEnd = save ? (() => { const h = hands(kp); return [h[0], h[1] - 14, h[2]]; })() : k.result === 'miss' ? [tg[0], tg[1], -60] : [tg[0], tg[1], -14];
    await flight([0, 15, SPOT_Z], ballEnd, F, k.target[0] === 'T' || /^OVER/.test(k.target) ? 70 : k.target[0] === 'M' ? 45 : 25, tg[0] * 0.08);
    if (tok !== poseTok) return;
    $('#score').textContent = k.score[0] + ' – ' + k.score[1];
    data.kicks.push(k);
    dots(data.kicks);
    const DN = { L: 'LEFT', C: 'CENTRE', R: 'RIGHT' };
    const kd = k.dive === 'STAY' ? 'stayed central' : 'dived ' + (sideOf(k.dive) < 0 ? 'left' : sideOf(k.dive) > 0 ? 'right' : 'centre');
    const how = k.noPick ? 'No direction picked in time, so the shot was scuffed' + (k.crowd ? ' · the crowd got to them' : '') : 'Shot <b>' + ({ T: 'TOP ', B: 'BOTTOM ' }[k.h] || '') + (DN[k.dir] || '') + '</b>' + ' · keeper ' + kd + (k.shield ? ' · <b>on-target shot used</b>' : '') + (k.nerves && k.result !== 'goal' ? ' · <b>nerves got to them</b>' : '');
    setBoosts(k.shields || []);
    heart(false);
    later(() => setComp(k.comp, k.compBefore), 900);
    const lying = (p) => Object.assign({}, p, { y: 2, rot: dir * 90, x: p.x + dir * 30, aL: 150, aR: 150, lL: 14, lR: 14 });
    const standUp = (x) => Object.assign({}, READY, { x, sq: 0 });

    if (goal) {
      SFX.play('net'); SFX.play('cheer', 0.05, 2.6);
      objs.net.animate([{ transform: S3D.pos(0, 0, -210) }, { transform: S3D.pos(tg[0] * 0.1, 0, -250) + ' scale(1.02,1.04)' }, { transform: S3D.pos(0, 0, -210) }], { duration: 700, easing: 'ease-out' });
      flight(ballEnd, [tg[0] * 0.95, 12, -190], 380, 10, 0);
      big('GOAL!', data.accent, 1800);
      sc.shake(10, 500);
      root.classList.add('roar'); later(() => root && root.classList.remove('roar'), 3500);
      sc.to({ dist: 1600, tz: 200, yaw: k.s === 0 ? -7 : 7 }, 1600);
      bar('<b>GOAL!</b> ' + esc(sh.display) + ' scores', how);
      takerReact(true);
      if (dir) {
        if (!await poseTo(lying(kp), 380, 'lin')) return;
        SFX.play('thud');
        // slaps the grass in frustration
        await poseTo(Object.assign({}, pose, { aR: 60 }), 260, 'out'); await poseTo(Object.assign({}, pose, { aR: 140 }), 200, 'out');
        await poseTo(Object.assign({}, pose, { aR: 60 }), 260, 'out');
        await wait(350);
      } else { await poseTo(Object.assign({}, READY, { aL: 20, aR: 20, sq: 0 }), 500); await wait(600); }
      if (!await poseTo(Object.assign(standUp(pose.x), { fwd: 0, aL: 8, aR: 8 }), 650, 'inout')) return;
      await poseTo(Object.assign(standUp(0), { fwd: 0, aL: 8, aR: 8 }), 1300, 'inout', walk);
      await poseTo(READY, 400);
    } else if (save) {
      const held = !!k.hold;
      sc.shake(5, 300);
      takerReact(false);
      if (held) {
        // catch: ball sticks in the gloves, keeper lands on it and gets up holding it
        objs.hold = true;
        SFX.play('glove'); SFX.play('ooh', 0.1); SFX.play('cheer', 0.5, 1.6);
        big('CAUGHT!', '#f2f5f7', 1800);
        bar('<b>CAUGHT</b> by the AI keeper!', how);
        if (dir) {
          if (!await poseTo(Object.assign(lying(kp), { aL: 20, aR: 20, fwd: 75 }), 420, 'lin')) return;
          SFX.play('thud'); sc.shake(4, 250);
          await wait(700);
          if (!await poseTo(Object.assign(standUp(pose.x), { aL: 20, aR: 20, fwd: 75 }), 650)) return;
        } else {
          if (!await poseTo(Object.assign({}, READY, { x: kp.x, aL: 20, aR: 20, fwd: 75, sq: 0.05 }), 450)) return;
          await wait(700);
        }
        await poseTo(Object.assign(standUp(0), { aL: 20, aR: 20, fwd: 75 }), 1100, 'inout', walk);
        // rolls it out to the side
        if (!await poseTo(Object.assign({}, pose, { aL: 10, aR: 10, fwd: 30, sq: 0.22 }), 300, 'out')) return;
        objs.hold = false;
        const h = hands();
        flight([h[0], h[1] - 14, h[2]], [-1400, 0, 1700], 1100, 10, 0);
        await poseTo(READY, 400);
      } else {
        // parry: fingertips push it round the post
        SFX.play('glove'); SFX.play('ooh', 0.1);
        big('SAVED!', '#f2f5f7', 1800);
        bar('<b>SAVED</b> by the AI keeper!', how);
        const out = [tg[0] === 0 ? 0 : tg[0] + Math.sign(tg[0]) * 520, tg[1] > 120 ? 330 : 120, 380];
        flight(ballEnd, out, 650, 60, 0);
        if (dir) {
          if (!await poseTo(lying(kp), 400, 'lin')) return;
          SFX.play('thud');
          await wait(650);
          if (!await poseTo(standUp(pose.x), 600)) return;
        } else await wait(500);
        // jogs back and claps the gloves together
        await poseTo(standUp(0), 1100, 'inout', walk);
        for (let i = 0; i < 2; i++) { await poseTo(Object.assign({}, READY, { aL: 8, aR: 8, fwd: 80, sq: 0 }), 150, 'out'); SFX.play('glove'); await poseTo(Object.assign({}, READY, { aL: 22, aR: 22, fwd: 80, sq: 0 }), 150, 'out'); }
        await poseTo(READY, 350);
      }
    } else {
      if (!/^OVER/.test(k.target) && Math.random() < 0.5) SFX.play('post');
      SFX.play('ooh', 0.1);
      flight(ballEnd, [tg[0] * 1.4, tg[1] + 40, -900], 600, 20, 0);
      big('MISSED!', '#ff5d6c', 1800);
      bar(esc(sh.display) + (k.noPick ? ' <b>didn\'t pick a side</b> and misses!' : ' <b>misses</b>!'), how);
      takerReact(false);
      if (dir) { if (!await poseTo(lying(kp), 380, 'lin')) return; SFX.play('thud'); await wait(500); if (!await poseTo(standUp(pose.x), 600)) return; }
      else await wait(700);
      // points at the shooter, then back to the line
      await poseTo(Object.assign({}, READY, { x: pose.x, aL: 20, aR: 95, sq: 0 }), 300, 'out');
      await wait(400);
      await poseTo(standUp(0), 1000, 'inout', walk);
      await poseTo(READY, 350);
    }
  }
  // the same kick in the 3D stadium: pen3d.js moves the players and ball, this keeps the scoreboard and bars
  function kick3d(a) {
    const k = a.k, f = data.fighters, sh = f[k.s];
    objs.zones.style.opacity = 0;
    bar('<b>' + esc(sh.display) + '</b> steps up…', '');
    const p = PEN3D.kick(k, () => {
      if (!root) return;
      $('#score').textContent = k.score[0] + ' – ' + k.score[1];
      data.kicks.push(k);
      dots(data.kicks);
      const DN = { L: 'LEFT', C: 'CENTRE', R: 'RIGHT' }, sideOf = (z) => (z && z[1] === 'L' ? -1 : z && z[1] === 'R' ? 1 : 0);
      const kd = k.dive === 'STAY' ? 'stayed central' : 'dived ' + (sideOf(k.dive) < 0 ? 'left' : sideOf(k.dive) > 0 ? 'right' : 'centre');
      const how = k.noPick ? 'No direction picked in time, so the shot was scuffed' + (k.crowd ? ' · the crowd got to them' : '') : 'Shot <b>' + ({ T: 'TOP ', B: 'BOTTOM ' }[k.h] || '') + (DN[k.dir] || '') + '</b>' + ' · keeper ' + kd + (k.shield ? ' · <b>on-target shot used</b>' : '') + (k.nerves && k.result !== 'goal' ? ' · <b>nerves got to them</b>' : '');
      setBoosts(k.shields || []);
      heart(false);
      later(() => setComp(k.comp, k.compBefore), 900);
      if (k.result === 'goal') {
        SFX.play('net'); SFX.play('cheer', 0.05, 2.6); big('GOAL!', data.accent, 1800); sc.shake(10, 500);
        bar('<b>GOAL!</b> ' + esc(sh.display) + ' scores', how);
      } else if (k.result === 'save') {
        SFX.play('glove'); SFX.play('ooh', 0.1); if (k.hold) SFX.play('cheer', 0.5, 1.6); sc.shake(5, 300);
        big(k.hold ? 'CAUGHT!' : 'SAVED!', '#f2f5f7', 1800); bar('<b>' + (k.hold ? 'CAUGHT' : 'SAVED') + '</b> by the AI keeper!', how);
      } else {
        if (!/^OVER/.test(k.target) && Math.random() < 0.5) SFX.play('post'); SFX.play('ooh', 0.1);
        big('MISSED!', '#ff5d6c', 1800); bar(esc(sh.display) + (k.noPick ? ' <b>didn\'t pick a side</b> and misses!' : ' <b>misses</b>!'), how);
      }
    });
    later(() => SFX.play('kick'), p ? Math.round(p.C) : 700);
  }
  function takerReact(scored) {
    const t = objs.taker, base = S3D.pos(-40, 0, SPOT_Z + 40) + ' rotateY(180deg)';
    if (scored) t.animate([{ transform: base }, { transform: S3D.pos(-40, 60, SPOT_Z + 40) + ' rotateY(180deg)' }, { transform: base }, { transform: S3D.pos(-40, 50, SPOT_Z + 40) + ' rotateY(200deg)' }, { transform: base }], { duration: 1100, easing: 'ease-out', fill: 'forwards' });
    else t.animate([{ transform: base }, { transform: base + ' rotateX(14deg) scaleY(.94)' }], { duration: 500, easing: 'ease-out', fill: 'forwards' });
  }

  function result(a) {
    if (!root) build(a);
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    const w = a.fighters[a.winner], l = a.fighters[1 - a.winner];
    const T = BBR.tier(w.tier, a.accent);
    const res = document.createElement('div');
    res.className = 'res';
    res.innerHTML = '<div class="' + BBR.wrapClass(w.tier) + '"><div class="wcard">' + BBR.render(Object.assign({}, w, { ribbon: 'WINNER' }), { accent: a.accent }) + '</div></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px"><div class="rk">SHOOTOUT WINNER</div><div class="rn" style="font-size:' + (w.display.length <= 10 ? 96 : w.display.length <= 14 ? 72 : 56) + 'px">' + esc(w.display) + '</div>' +
      '<div class="rs">' + a.score[a.winner] + ' – ' + a.score[1 - a.winner] + ' vs ' + esc(l.display) + '</div>' +
      '<div class="rr">Card boost: +' + a.rewards.win + ' to their two lowest stats. ' + esc(l.display) + ' gets +' + a.rewards.lose + ' for taking part.</div></div>';
    const colors = [a.accent, T.color, '#ffffff', '#ffb020'];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement('div');
      c.className = 'conf';
      c.style.left = Math.random() * W + 'px';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (2.2 + Math.random() * 2.5) + 's';
      c.style.animationDelay = (Math.random() * 1.2) + 's';
      res.appendChild(c);
    }
    root.querySelector('.hud').appendChild(res);
    SFX.play('impact', 0); SFX.play('fanfare', 0.15); SFX.play('cheer', 0.2, 4); SFX.tierFx(w.tier, 0.9);
    later(() => { if (root) root.classList.add('out'); }, a.outroMs - 700);
    later(() => { clear(); if (onDone) onDone(); }, a.outroMs);
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  return { crowd, _dbg: { setPose: (p) => { poseTok++; setPose(p); }, reachPose, hands, ballAt: (x, y, z) => ballAt(x, y, z), READY }, init: (o) => { stage = o.stage; onDone = o.done; }, matchup, boosted, start, aim, lock, kick, result, clear, active: () => !!root };
})();
