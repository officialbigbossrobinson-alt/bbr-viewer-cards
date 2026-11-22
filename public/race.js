// BBR Haulage Cup — 3D truck race overlay (used by overlay.html)
window.RACE = (function () {
  let stage = null, onDone = null, root = null, sc = null, data = null, timers = [], raf = null;
  let trucks = [], scenery = [], tags = [], gantry = null, roadEls = [], dashG = null, lmFrom = null, lmTo = null;
  let snowCv = null, flakes = [], obsEls = new Map(), forkSign = null, packSpan = 0;
  const PACK = 0.14;   // the camera keeps trucks within this much of the leader in shot; the rest get a card in the corner
  let leadRing = null, rainCv = null, drops = [], leader = -1, finalShown = false, lastSpray = 0, nextBolt = 0;
  const esc = (s) => BBR.esc(s);
  const W = 1840, H = 660, SCALE = 40000, LANE = 300, DASH = 520, NL = 5, SEG = 400;
  const laneX = (l) => (l - (NL - 1) / 2) * LANE;
  // bends: the road swings left and right; every object is shifted by the same curve so the world stays joined up
  const bendX = (p) => { const B = (data && data.setup && data.setup.bends) || []; let x = 0; for (const b of B) { const u = (p - b.c) / b.w; x += b.a * Math.exp(-u * u); } return x; };
  const heading = (p) => Math.atan((bendX(p + 0.002) - bendX(p - 0.002)) / (0.004 * SCALE)) * 180 / Math.PI;
  const inFork = (p) => { const F = data && data.setup && data.setup.fork; return !!F && p >= F.from && p <= F.to; };
  const SUB = [-80, 0, 80];
  const PCOL = { twitch: '#9146ff', kick: '#53fc18', youtube: '#ff2a3d' };
  const PTAG = { twitch: 'TWITCH', kick: 'KICK', youtube: 'YOUTUBE' };

  const CSS = `
  .rarena{position:absolute;left:40px;top:392px;width:${W}px;height:${H}px;border-radius:20px;overflow:hidden;border:2px solid var(--acc);box-shadow:0 20px 60px rgba(0,0,0,.6);animation:arenaIn .7s cubic-bezier(.2,.9,.3,1.1) both;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7}
  .rarena.out{animation:arenaOut .6s ease-in both}
  .rarena .hud{position:absolute;inset:0;pointer-events:none}
  .rhead{position:absolute;left:24px;top:16px;right:24px;display:flex;align-items:flex-start;gap:18px}
  .rhead .ttl{padding:10px 16px;border-radius:12px;background:rgba(10,12,15,.82);backdrop-filter:blur(6px)}
  .rhead .k{font-size:15px;font-weight:700;letter-spacing:5px;color:var(--acc)}
  .rhead .route{font-size:38px;font-weight:800;line-height:1;text-transform:uppercase;white-space:nowrap}
  .chips{margin-left:auto;display:flex;gap:8px}
  .chip{padding:8px 14px;border-radius:999px;background:rgba(10,12,15,.82);font-size:18px;font-weight:700;letter-spacing:1px;white-space:nowrap}
  .chip b{color:var(--acc)}
  .stand{position:absolute;left:24px;top:110px;width:330px;height:420px}
  .srow{position:absolute;left:0;width:330px;height:80px;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:12px;background:rgba(10,12,15,.82);backdrop-filter:blur(6px);transition:transform .5s cubic-bezier(.3,.8,.3,1)}
  .srow.compact{height:54px;padding:4px 10px;gap:8px}.srow.compact .av{width:34px;height:34px;font-size:14px}.srow.compact .pos{font-size:28px}.srow.compact .nm{font-size:18px}.srow.compact .st{display:none}
  .turb{display:flex;gap:3px;margin-left:6px}.turb i{width:9px;height:9px;transform:rotate(45deg);background:rgba(255,255,255,.2)}.turb i.on{background:#ff8a1f;box-shadow:0 0 6px #ff8a1f}
  .rhelp{position:absolute;right:24px;bottom:90px;max-width:520px;padding:8px 14px;border-radius:10px;background:rgba(10,12,15,.86);font-family:Inter,sans-serif;font-size:14px;color:#c3cad3;line-height:1.5;text-align:right}
  .rhelp b{color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:17px;letter-spacing:1px}
  .bolt{width:160px;height:900px}
  .srow .pos{font-size:38px;font-weight:800;width:28px;text-align:center}
  .srow .av{width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:800;box-sizing:border-box}
  .srow .info{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}
  .srow .nm{font-size:21px;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .srow .meta{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:2px}
  .fuel{display:flex;gap:2px;margin-left:auto}.fuel i{width:7px;height:8px;border-radius:2px;background:rgba(255,255,255,.18)}.fuel i.on{background:var(--acc);box-shadow:0 0 6px var(--acc)}
  .srow .st{font-family:Inter,sans-serif;font-size:12px;color:#c3cad3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mmap{position:absolute;right:24px;top:90px;width:300px;padding:12px 14px;border-radius:12px;background:rgba(10,12,15,.82);backdrop-filter:blur(6px)}
  .mmap .lbl{display:flex;justify-content:space-between;font-size:14px;font-weight:700;letter-spacing:2px;color:#c3cad3}
  .mmap .line{position:relative;height:8px;margin:14px 6px 6px;border-radius:4px;background:rgba(255,255,255,.15)}
  .mmap .dotp{position:absolute;top:50%;width:14px;height:14px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #0b0d10}
  .ticker{position:absolute;left:24px;right:24px;bottom:18px;height:60px;display:flex;align-items:center;gap:16px;border-radius:12px;background:rgba(10,12,15,.86);backdrop-filter:blur(6px);padding:0 18px;overflow:hidden}
  .ticker .ch{font-size:17px;font-weight:800;letter-spacing:3px;color:#ffb020;flex-shrink:0}
  .ticker .msg{font-size:27px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ticker .msg b{color:var(--acc)}
  .wx{position:absolute;inset:0;pointer-events:none}
  .rain{background:repeating-linear-gradient(103deg,rgba(200,220,255,0) 0 14px,rgba(200,220,255,.32) 14px 15px,rgba(200,220,255,0) 15px 36px);background-size:300% 300%;animation:rain .3s linear infinite}
  .lmw{display:flex;flex-direction:column;align-items:center}.lmw .lmk svg{display:block}
  .lmcap{margin-top:10px;padding:6px 18px;border-radius:10px;background:rgba(10,12,15,.8);font:800 40px 'Barlow Condensed',sans-serif;letter-spacing:2px;color:#fff;white-space:nowrap;text-transform:uppercase}
  @keyframes rain{to{background-position:-70px 160px}}
  .fog{background:linear-gradient(180deg,rgba(215,222,230,.75) 0%,rgba(215,222,230,.45) 45%,rgba(215,222,230,.15) 100%)}
  .nightwx{background:radial-gradient(ellipse at 50% 75%,rgba(0,0,0,0) 0%,rgba(2,6,20,.55) 60%)}
  .cd{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:40px;pointer-events:none}
  .lights{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:16px;background:#111;border:3px solid #333;box-shadow:0 10px 40px rgba(0,0,0,.6)}
  .lamp{width:58px;height:58px;border-radius:50%;background:#2a2a2a}
  .lamp.r.on{background:#ff3b3b;box-shadow:0 0 30px #ff3b3b}.lamp.a.on{background:#ffb020;box-shadow:0 0 30px #ffb020}.lamp.g.on{background:#3dff6a;box-shadow:0 0 30px #3dff6a}
  .cdn{font-size:200px;font-weight:800;line-height:1;text-shadow:0 8px 0 rgba(0,0,0,.45)}
  .rcard{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(10,12,15,.6);pointer-events:none}
  .rcard .a{font-size:20px;font-weight:700;letter-spacing:6px;color:var(--acc)}
  .rcard .b{font-size:88px;font-weight:800;line-height:1;text-transform:uppercase;text-shadow:0 6px 0 rgba(0,0,0,.4)}
  .rcard .c{font-family:Inter,sans-serif;font-size:22px;color:#e6eaee}
  .bigtxt{position:absolute;left:0;right:0;top:230px;text-align:center;font-size:120px;font-weight:800;letter-spacing:4px;opacity:0;pointer-events:none;text-shadow:0 6px 0 rgba(0,0,0,.45)}
  .photo{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
  .ttag{padding:4px 10px;border-radius:6px;font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:800;letter-spacing:1px;white-space:nowrap}
  .ttag.bad{background:#ff4d5e;color:#fff}.ttag.good{background:var(--acc);color:#06110b}
  .rres{position:absolute;inset:0;border-radius:18px;background:radial-gradient(circle at 50% 40%,rgba(20,26,34,.94),rgba(5,6,8,.98));overflow:hidden;animation:resIn .5s ease-out both}
  .rres .top{position:absolute;left:0;top:26px;width:100%;text-align:center}
  .rres .k{font-size:22px;font-weight:700;letter-spacing:6px;color:var(--acc)}
  .rres .h{font-size:64px;font-weight:800;line-height:1;text-transform:uppercase}
  .rres .d{font-family:Inter,sans-serif;font-size:19px;color:#c4cbd3;margin-top:6px}
  .podium{position:absolute;left:0;right:0;bottom:30px;display:flex;align-items:flex-end;justify-content:center;gap:34px}
  .pod{display:flex;flex-direction:column;align-items:center;gap:6px}
  .pod .slot{position:relative}
  .pod .block{width:240px;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:center;font-size:54px;font-weight:800;color:#0b0d10}
  .pod .pn{font-size:26px;font-weight:800;text-transform:uppercase;max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pod .pt{font-family:Inter,sans-serif;font-size:15px;color:#b8c0ca}
  .others{position:absolute;right:40px;bottom:40px;font-family:Inter,sans-serif;font-size:16px;color:#b8c0ca;text-align:right}
  .pplate{display:flex;align-items:center;gap:8px;padding:4px 12px 4px 6px;border-radius:10px;background:rgba(10,12,15,.88);border:3px solid #6b7480;font-family:'Barlow Condensed',sans-serif;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.5)}
  .pplate b{display:flex;align-items:center;justify-content:center;min-width:52px;height:46px;border-radius:7px;background:#6b7480;color:#0b0d10;font-size:38px;font-weight:800}
  .pplate span{font-size:26px;font-weight:800;color:#fff;text-transform:uppercase}
  .pplate.p1{border-color:#f6d77a;box-shadow:0 0 26px rgba(246,215,122,.8)}.pplate.p1 b{background:#f6d77a}
  .pplate.p1::before{content:"";position:absolute;left:50%;top:-34px;width:44px;height:30px;transform:translateX(-50%);background:#f6d77a;clip-path:polygon(0 100%,0 25%,25% 60%,50% 0,75% 60%,100% 25%,100% 100%);filter:drop-shadow(0 0 8px #f6d77a)}
  .pplate.p2{border-color:#d5dae0}.pplate.p2 b{background:#d5dae0}
  .pplate.p3{border-color:#d08a50}.pplate.p3 b{background:#d08a50}
  .leadbox{position:absolute;left:50%;top:92px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:8px 20px 8px 10px;border-radius:14px;background:rgba(10,12,15,.88);border:2px solid #f6d77a;box-shadow:0 0 30px rgba(246,215,122,.35)}
  .leadbox .lk{font-size:15px;font-weight:800;letter-spacing:4px;color:#f6d77a}
  .leadbox .ln{font-size:34px;font-weight:800;text-transform:uppercase;line-height:1;max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .leadbox .lg{font-family:Inter,sans-serif;font-size:15px;color:#c3cad3}
  .leadbox .crown{width:40px;height:28px;background:#f6d77a;clip-path:polygon(0 100%,0 25%,25% 60%,50% 0,75% 60%,100% 25%,100% 100%)}
  .srow.lead{box-shadow:inset 0 0 0 3px #f6d77a,0 0 22px rgba(246,215,122,.35)}
  .srow.lead .pos{color:#f6d77a}
  .rainc{position:absolute;inset:0;pointer-events:none}
  .flash{position:absolute;inset:0;background:#eef4ff;opacity:0;pointer-events:none}
  .rdrop{position:absolute;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.55),rgba(200,220,255,.12) 45%,rgba(0,0,0,.08) 70%,transparent 72%);pointer-events:none}
  .glare{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 45%,rgba(255,255,240,.95),rgba(255,255,220,.3) 25%,transparent 55%);opacity:0}
  .rbanner{position:absolute;left:0;right:0;top:300px;text-align:center;pointer-events:none;opacity:0}
  .rbanner span{display:inline-block;padding:8px 30px;border-radius:10px;background:rgba(10,12,15,.9);border:3px solid var(--bc);font-size:54px;font-weight:800;letter-spacing:6px;color:var(--bc)}
  .rseg .fkw,.rseg .fkb{display:none}.rseg.fk .fkw,.rseg.fk .fkb{display:block}.rseg.fk .ln2{display:none}
  .bpk{position:absolute;right:24px;bottom:90px;width:300px;display:flex;flex-direction:column;gap:6px;pointer-events:none}
  .bpk .h{font-size:14px;font-weight:800;letter-spacing:3px;color:#c3cad3}
  .bpk .r{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:10px;background:rgba(10,12,15,.88);border:2px solid #3a404a;font-size:20px;font-weight:800;text-transform:uppercase}
  .bpk .r span{margin-left:auto;font-size:16px;color:#ff9a7a}
  .mmap .fork{position:absolute;top:-6px;height:20px;border-radius:4px;background:rgba(255,176,32,.35);border:1px solid #ffb020}
  @keyframes rbale{to{rotate:360deg}}
  .bars{display:flex;flex-direction:column;gap:3px;width:86px;margin-left:auto}
  .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.15);overflow:hidden}.bar i{display:block;height:100%;border-radius:3px;transition:width .6s}
  .bar.tk i{background:#3dff9a}.bar.tk.low i{background:#ffb020}.bar.tk.dry i{background:#ff4d5e}
  .bar.dm i{background:#ff4d5e}
  .spc{font-size:11px;letter-spacing:1px;color:#ffb020;white-space:nowrap}.spc.used{color:#6b7480;text-decoration:line-through}
  .lanes3{display:flex;gap:2px;margin-left:4px}.lanes3 i{width:7px;height:12px;border-radius:2px;background:rgba(255,255,255,.18)}.lanes3 i.on{background:#fff}
  .hz.on{animation:hz .5s steps(1) infinite}
  @keyframes hz{50%{background:#ffb020!important;box-shadow:0 0 30px 10px #ffb020}}
  .brk.on{background:#ff1a1a!important;box-shadow:0 0 30px 12px #ff1a1a}
  .copl{animation:copl .4s steps(1) infinite}
  @keyframes copl{0%{background:#1f6bff;box-shadow:0 0 40px 14px #1f6bff}50%{background:#ff2a2a;box-shadow:0 0 40px 14px #ff2a2a}}
  `;

  function later(fn, t) { timers.push(setTimeout(fn, t)); }
  function clear() {
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    if (raf) cancelAnimationFrame(raf); raf = null;
    if (sc) sc.destroy(); sc = null;
    if (root) root.remove(); root = null;
    trucks = []; scenery = []; tags = []; gantry = null; roadEls = []; dashG = null; lmFrom = null; lmTo = null;
    leadRing = null; rainCv = null; drops = []; leader = -1; finalShown = false; lastSpray = 0; nextBolt = 0;
    camProg = 0; travelled = 0; live = null; snowCv = null; flakes = []; obsEls = new Map(); forkSign = null; packSpan = 0;
  }
  const $ = (s) => root && root.querySelector(s);

  const SKY_OLD = {
    clear: 'linear-gradient(180deg,#4f8fd6 0%,#8fc1ec 40%,#d9ecf7 50%,#3b4a2e 50.2%)',
    rain: 'linear-gradient(180deg,#3d4a58 0%,#6d7d8c 40%,#9aa7b2 50%,#2c3528 50.2%)',
    fog: 'linear-gradient(180deg,#a9b4bf 0%,#cdd5dc 45%,#dfe5ea 50%,#4a5146 50.2%)',
    night: 'linear-gradient(180deg,#02040c 0%,#0b1430 40%,#1b2547 50%,#0b0f0a 50.2%)'
  };
  const GROUND = { ATS: '#b8925a', ETS: '#4f7a3a' };
  const TOD_SKY = {
    day: ['#4f8fd6', '#8fc1ec', '#d9ecf7'], sunrise: ['#33406e', '#e98a6a', '#ffd1a0'], sunset: ['#231d48', '#d0526a', '#ffae5a'],
    night: ['#02040c', '#0b1430', '#1b2547'], golden: ['#5f86bf', '#f2b25c', '#ffe0a0']
  };
  function skyFor(tod, wid) {
    let c = TOD_SKY[tod] || TOD_SKY.day;
    if (wid === 'rain' || wid === 'storm') c = tod === 'night' ? ['#020308', '#0d121c', '#1a2230'] : [wid === 'storm' ? '#262d36' : '#3d4a58', '#6d7d8c', '#9aa7b2'];
    else if (wid === 'fog') c = tod === 'night' ? ['#141820', '#2a3038', '#3a4048'] : ['#a9b4bf', '#cdd5dc', '#dfe5ea'];
    else if (wid === 'snow') c = tod === 'night' ? ['#0a0e18', '#202838', '#3a4458'] : ['#9aa6b2', '#c7d0d9', '#e6ebf0'];
    return 'linear-gradient(180deg,' + c[0] + ' 0%,' + c[1] + ' 40%,' + c[2] + ' 50%,#2c3528 50.2%)';
  }
  // things in the lanes: road obstacles, cargo specials and fuel pads
  const OB_HTML = {
    cones: () => '<div style="display:flex;gap:30px">' + '<i style="display:block;width:44px;height:70px;background:linear-gradient(#ff6a00 0 30%,#fff 30% 45%,#ff6a00 45%);clip-path:polygon(50% 0,100% 100%,0 100%)"></i>'.repeat(3) + '</div>',
    car: () => '<div style="width:170px;height:90px;position:relative"><div style="position:absolute;left:20px;top:0;width:120px;height:46px;border-radius:24px 24px 0 0;background:#8fb3d9"></div><div style="position:absolute;left:0;top:36px;width:170px;height:44px;border-radius:12px;background:#b3262e"></div><i style="position:absolute;left:24px;bottom:0;width:30px;height:30px;border-radius:50%;background:#111"></i><i style="position:absolute;right:24px;bottom:0;width:30px;height:30px;border-radius:50%;background:#111"></i><b style="position:absolute;right:-30px;top:-30px;font:800 40px Barlow Condensed;color:#ffb020">!</b></div>',
    tyre: () => '<div style="width:110px;height:60px;border-radius:50%;border:16px solid #151515;box-sizing:border-box"></div>',
    pothole: () => '<div style="width:180px;height:50px;border-radius:50%;background:radial-gradient(#050505 40%,#2a2a2a 70%,transparent 72%)"></div>',
    puddle: () => '<div style="width:260px;height:60px;border-radius:50%;background:radial-gradient(rgba(170,200,240,.8),rgba(120,150,190,.4) 60%,transparent 70%)"></div>',
    logs: () => '<div style="display:flex;flex-direction:column;gap:4px">' + '<i style="display:block;width:280px;height:30px;border-radius:15px;background:linear-gradient(90deg,#c69a62 0 8%,#6e4523 8% 92%,#c69a62 92%)"></i>'.repeat(3) + '</div>',
    slick: () => '<div style="width:300px;height:80px;border-radius:50%;background:radial-gradient(rgba(140,255,90,.9),rgba(60,200,120,.5) 55%,transparent 70%);box-shadow:0 0 30px #7dff5a"></div>',
    cows: () => '<div style="display:flex;gap:14px">' + animalHtml('cow').replace('width="200"', 'width="120"').replace('height="160"', 'height="96"').repeat(2) + '</div>',
    stones: () => '<div style="width:300px;height:50px;background:radial-gradient(circle at 10% 50%,#8a8a8a 9px,transparent 10px),radial-gradient(circle at 30% 30%,#9a9a9a 12px,transparent 13px),radial-gradient(circle at 55% 60%,#777 10px,transparent 11px),radial-gradient(circle at 80% 40%,#999 13px,transparent 14px),radial-gradient(circle at 95% 70%,#888 8px,transparent 9px)"></div>',
    ice: () => '<div style="width:320px;height:70px;border-radius:50%;background:radial-gradient(rgba(230,250,255,.95),rgba(160,220,255,.6) 55%,transparent 70%);box-shadow:0 0 30px #bfefff"></div>',
    boxes: () => '<div style="display:grid;grid-template-columns:repeat(4,56px);gap:4px">' + '<i style="display:block;height:50px;background:#c08a4a;border:3px solid #8a5a2a"></i>'.repeat(6) + '</div>',
    bales: () => '<div style="display:flex;gap:20px">' + '<i style="display:block;width:90px;height:90px;border-radius:50%;background:repeating-radial-gradient(#e8c25a 0 6px,#c9a03a 6px 10px);animation:rbale .8s linear infinite"></i>'.repeat(2) + '</div>',
    concrete: () => '<div style="width:300px;height:70px;border-radius:40%;background:radial-gradient(#b8b8b0,#8d8d85 60%,transparent 72%)"></div>',
    fuel: () => '<div style="display:flex;flex-direction:column;align-items:center"><div style="width:90px;height:110px;border-radius:12px;background:#3dff9a;box-shadow:0 0 40px #3dff9a;display:flex;align-items:center;justify-content:center;font:800 34px Barlow Condensed;color:#062">FUEL</div></div>'
  };

  // made-up haulage firms: every truck in a race gets its own livery
  const LIVERY = [
    { brand: 'ROBINSON ROADLINES', cab: '#c8102e', box: '#f4f1ea', stripe: '#c8102e', ink: '#1a1a1a', band: '#111' },
    { brand: 'BOSS FREIGHT CO.', cab: '#111418', box: '#16191e', stripe: '#3dff9a', ink: '#ffffff', band: '#3dff9a' },
    { brand: 'IRONHORSE HAULAGE', cab: '#2f6fd1', box: '#dfe8f5', stripe: '#2f6fd1', ink: '#0d2459', band: '#f5c400' },
    { brand: 'GOLDEN MILE TRANSPORT', cab: '#e8b931', box: '#2a2a2a', stripe: '#e8b931', ink: '#e8b931', band: '#e8b931' },
    { brand: 'THUNDERWAY EXPRESS', cab: '#6b2fa8', box: '#efe9f7', stripe: '#6b2fa8', ink: '#3a1560', band: '#ff7a1a' },
    { brand: 'COPPERLINE CARRIERS', cab: '#b5633f', box: '#f3e6dc', stripe: '#b5633f', ink: '#4a2416', band: '#2a2a2a' },
    { brand: 'SILVERBACK LOGISTICS', cab: '#9aa4af', box: '#3a4048', stripe: '#d9dee4', ink: '#ffffff', band: '#ff2a3d' },
    { brand: 'GREENLANE HAULIERS', cab: '#1f7d4a', box: '#e7f2ea', stripe: '#1f7d4a', ink: '#103d24', band: '#f5c400' },
    { brand: 'POLAR STAR FREIGHT', cab: '#e9edf2', box: '#1d3a5c', stripe: '#7fc4ff', ink: '#ffffff', band: '#7fc4ff' },
    { brand: 'REDHILL & SONS', cab: '#7a1418', box: '#f6efe0', stripe: '#7a1418', ink: '#7a1418', band: '#c9a86a' }
  ];
  let liveries = [];
  function truckGroup(c, acc, idx) {
    const L = liveries[idx % liveries.length] || LIVERY[idx % LIVERY.length];
    const T = BBR.tier(c.tier, acc);
    const col = L.box;
    const g = S3D.group(0, 0, 0);
    const body = S3D.div('s3-g'); g.appendChild(body);
    const trl = S3D.div('s3-g'); body.appendChild(trl);
    const name = esc(String(c.display).toUpperCase().slice(0, 14));
    const stripe = PCOL[c.platform] || '#888';
    const side = '<div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 0 70%,' + L.stripe + ' 70% 80%,' + L.band + ' 80% 86%,transparent 86%)"></div>' +
      '<div style="position:relative;height:72%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-family:Barlow Condensed,sans-serif">' +
      '<span style="font-size:' + (L.brand.length > 16 ? 30 : 36) + 'px;font-weight:800;font-style:italic;letter-spacing:1px;color:' + L.ink + ';line-height:1">' + esc(L.brand) + '</span>' +
      '<span style="font-size:22px;font-weight:700;letter-spacing:2px;color:' + L.ink + ';opacity:.8">' + name + '</span></div>';
    const back = '<div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:800 22px Barlow Condensed,sans-serif;color:' + L.ink + '">' + esc(L.brand.split(' ')[0]) + '<span style="font-size:18px;opacity:.8">' + name + '</span><div style="width:70%;height:8px;background:' + stripe + '"></div></div>';
    const trailer = S3D.box(96, 118, 340, { color: col, top: 'linear-gradient(90deg,' + L.stripe + ' 0 12%,' + S3D.shade(col, 1.05) + ' 12% 88%,' + L.stripe + ' 88%)', html: { left: side, right: side, back } });
    S3D.place(trailer, 0, 34, 70); trl.appendChild(trailer);
    for (const z of [140, 180]) for (const x of [-46, 46]) { const w = S3D.box(16, 40, 40, { color: '#121212', radius: 10 }); S3D.place(w, x, 0, z); trl.appendChild(w); }
    const tail = S3D.box(96, 8, 4, { color: '#ff2a2a', back: '#a01010' }); S3D.place(tail, 0, 40, 242); trl.appendChild(tail);
    const haz = [-40, 40].map((x) => { const h = S3D.box(16, 10, 4, { color: '#7a5200', back: '#7a5200' }); S3D.place(h, x, 52, 242); trl.appendChild(h); return h.querySelector('[data-face="back"]'); });
    const chassis = S3D.box(80, 18, 250, { color: '#1a1d22' }); S3D.place(chassis, 0, 22, -120); body.appendChild(chassis);
    const cabCol = L.cab;
    const cab = S3D.box(98, 104, 110, { color: cabCol, front: 'linear-gradient(180deg,#9fd3ff 0 38%,' + S3D.shade(cabCol, 0.9) + ' 38% 80%,' + L.band + ' 80% 86%,' + S3D.shade(cabCol, 0.8) + ' 86%)',
      side: 'linear-gradient(180deg,#9fd3ff 0 30%,' + S3D.shade(cabCol, 0.85) + ' 30% 80%,' + L.band + ' 80% 86%,' + S3D.shade(cabCol, 0.75) + ' 86%)', top: S3D.shade(cabCol, 1.1) });
    // roof light bar + air deflector in the livery colour
    const roof = S3D.box(90, 34, 60, { color: S3D.shade(cabCol, 0.95), front: 'linear-gradient(180deg,' + S3D.shade(cabCol, 1.1) + ',' + S3D.shade(cabCol, 0.8) + ')' }); S3D.place(roof, 0, 134, -175); body.appendChild(roof);
    const lbar = S3D.box(80, 6, 6, { color: '#ffb020', front: '#ffd27a' }); S3D.place(lbar, 0, 168, -205); body.appendChild(lbar);
    S3D.place(cab, 0, 30, -190); body.appendChild(cab);
    const stack = S3D.box(10, 60, 10, { color: '#b9c0c8' }); S3D.place(stack, 40, 120, -130); body.appendChild(stack);
    for (const z of [-205, -40, 0]) for (const x of [-46, 46]) { const w = S3D.box(16, 40, 40, { color: '#121212', radius: 10 }); S3D.place(w, x, 0, z); body.appendChild(w); }
    const lights = S3D.box(80, 10, 4, { color: '#ffe9a8', front: '#fff7d0', faceCss: 'box-shadow:0 0 20px #ffe9a8' }); S3D.place(lights, 0, 52, -247); body.appendChild(lights);
    g._body = body; g._trl = trl; g._haz = haz; g._tail = tail.querySelector('[data-face="back"]');
    if (g._tail) g._tail.classList.add('brk');
    haz.forEach((h) => h && h.classList.add('hz'));
    return g;
  }

  // ---------- effects that travel with a truck (built inside its group) ----------
  function fxEl(t, html, css) { const d = S3D.div('s3-plane', css || ''); if (html) d.innerHTML = html; t.g.appendChild(d); return d; }
  function puffs(t, x, y, z, color, n, rise, life) {
    for (let k = 0; k < n; k++) {
      const sz = 60 + Math.random() * 80;
      const d = fxEl(t, '', 'left:' + (-sz / 2) + 'px;top:' + (-sz / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;background:radial-gradient(closest-side,' + color + ',transparent)');
      const dx = (Math.random() - 0.5) * 120, dl = Math.random() * 400;
      d.animate([{ transform: S3D.pos(x, y, z) + ' scale(.4)', opacity: 0.9 }, { transform: S3D.pos(x + dx, y + (rise || 220), z + 150 + Math.random() * 200) + ' scale(2.6)', opacity: 0 }],
        { duration: life || 1600, delay: dl, easing: 'ease-out', fill: 'both' }).onfinish = () => d.remove();
    }
  }
  function sparks(t, x, y, z, n) {
    for (let k = 0; k < n; k++) {
      const d = fxEl(t, '', 'left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:#fff3b0;box-shadow:0 0 12px 4px #ffb020');
      const vx = (Math.random() - 0.5) * 400, vy = 80 + Math.random() * 220, vz = 100 + Math.random() * 300;
      d.animate([{ transform: S3D.pos(x, y, z) }, { transform: S3D.pos(x + vx * 0.6, y + vy, z + vz * 0.6), offset: 0.4 }, { transform: S3D.pos(x + vx, y - 20, z + vz), opacity: 0 }],
        { duration: 700 + Math.random() * 500, delay: Math.random() * 300, easing: 'ease-out', fill: 'both' }).onfinish = () => d.remove();
    }
  }
  const ANIMAL_SVG = {
    deer: ['#8a5a32', true, false], moose: ['#4a3322', true, true], cow: ['#f2f2f2', false, false, '#222'], sheep: ['#efe9dc', false, false],
    bear: ['#3b2a1e', false, true], boar: ['#5a4636', false, false]
  };
  function animalHtml(kind) {
    const [c, antlers, big, spots] = ANIMAL_SVG[kind] || ANIMAL_SVG.deer;
    const w = big ? 260 : 200;
    return '<svg width="' + w + '" height="' + (w * 0.8) + '" viewBox="0 0 100 80"><g fill="' + c + '">' +
      '<ellipse cx="50" cy="40" rx="30" ry="15"/>' + (kind === 'sheep' ? '<circle cx="35" cy="34" r="12"/><circle cx="52" cy="30" r="13"/><circle cx="66" cy="36" r="11"/>' : '') +
      '<rect x="27" y="48" width="6" height="28" rx="2"/><rect x="38" y="50" width="6" height="26" rx="2"/><rect x="58" y="50" width="6" height="26" rx="2"/><rect x="69" y="48" width="6" height="28" rx="2"/>' +
      '<path d="M76 34 L88 18 L96 22 L92 34 L82 40Z"/></g>' +
      (spots ? '<ellipse cx="42" cy="38" rx="7" ry="5" fill="' + spots + '"/><ellipse cx="60" cy="44" rx="6" ry="4" fill="' + spots + '"/>' : '') +
      (antlers ? '<path d="M88 18 L84 4 M86 10 L80 6 M92 19 L96 4 M94 11 L99 7" stroke="#d9c7a0" stroke-width="2.5" fill="none"/>' : '') +
      '<circle cx="91" cy="23" r="1.6" fill="#111"/></svg>';
  }

  function build(a) {
    clear();
    data = a;
    if (!document.getElementById('race-css')) { const st = document.createElement('style'); st.id = 'race-css'; st.textContent = CSS; document.head.appendChild(st); }
    const s = a.setup, f = a.fighters;
    liveries = LIVERY.slice().sort(() => Math.random() - 0.5);
    root = document.createElement('div');
    root.className = 'rarena';
    root.style.setProperty('--acc', a.accent);
    stage.appendChild(root);
    const wid = s.weather.id === 'night' ? 'clear' : s.weather.id;
    const tod = (s.tod && s.tod.id) || (s.weather.id === 'night' ? 'night' : 'day');
    const isNight = tod === 'night', wet = wid === 'rain' || wid === 'storm';
    const dim = { night: 0.35, sunrise: 0.72, sunset: 0.68, golden: 0.9, day: 1 }[tod] || 1;
    sc = S3D.scene(root, { w: W, h: H, persp: 1000, horizon: 42, centerY: 0.55, css: 'background:' + skyFor(tod, wid) });

    // mountains / skyline far away
    const hc = isNight ? '#0d1424' : tod === 'sunset' || tod === 'sunrise' ? '#5a3a4a' : wid === 'snow' ? '#e8edf2' : wid === 'fog' ? '#aab4bd' : s.route.game === 'ATS' ? '#9c7b58' : '#4d6b52';
    const hills = '<svg width="100%" height="100%" viewBox="0 0 1000 100" preserveAspectRatio="none"><path d="M0 100 L0 70 L60 52 L120 66 L190 34 L260 62 L330 44 L400 68 L470 26 L560 60 L640 40 L720 64 L800 36 L880 58 L940 46 L1000 60 L1000 100Z" fill="' + hc + '" opacity=".75"/><path d="M0 100 L0 82 L90 70 L170 80 L260 64 L350 78 L450 66 L560 80 L650 68 L760 82 L860 70 L1000 78 L1000 100Z" fill="' + hc + '"/></svg>';
    sc.add(S3D.wall(30000, 1800, { z: -13000, y: -60, bg: 'transparent', html: hills }));
    // ground either side + road
    sc.add(S3D.plane(36000, 30000, { z: -4000, y: -14, bg: wid === 'snow' ? '#e9eef3' : GROUND[s.route.game] || '#4f7a3a', css: 'filter:brightness(' + dim + ')' + (wid === 'fog' ? ' saturate(.5)' : tod === 'golden' || tod === 'sunset' ? ' sepia(.25)' : '') }));
    const lanes = NL;
    const roadW = lanes * LANE + 160;
    // ROAD: short static segments (no moving textures, so nothing has to be re-painted while driving = no flicker).
    // The lane dashes are small separate pieces in one group that slides along, then jumps back by one dash gap.
    const roadBg = wid === 'ice' ? 'linear-gradient(90deg,#4a5866,#5d7080 50%,#4a5866)' : wid === 'snow' ? 'linear-gradient(90deg,#8b939b,#6d757d 50%,#8b939b)' : wet ? 'repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 30px,transparent 30px 90px),linear-gradient(90deg,#2b3037,#262a30 50%,#2b3037)' : 'linear-gradient(90deg,#3a3f46,#33383e 50%,#3a3f46)';
    const edges = '<div style="position:absolute;top:0;bottom:0;left:60px;width:10px;background:#f1ecd2"></div><div style="position:absolute;top:0;bottom:0;right:60px;width:10px;background:#f1ecd2"></div>';
    // ROAD: short segments that follow the bends. Lane dashes are painted on each one (one dash per segment, so they line up).
    // In the fork a barrier splits the short cut (2 lanes, roadworks) from the motorway (3 lanes)
    const dc = isNight ? '#8d8a78' : '#f1ecd2';
    let laneLines = ''; for (let i = 1; i < lanes; i++) laneLines += '<div class="ln' + i + '" style="position:absolute;top:0;height:150px;left:' + (80 + i * LANE - 4) + 'px;width:8px;background:' + dc + '"></div>';
    const forkBits = '<div class="fkw" style="position:absolute;top:0;bottom:0;left:80px;width:' + (2 * LANE) + 'px;background:repeating-linear-gradient(90deg,rgba(255,140,0,.12) 0 40px,transparent 40px 80px),rgba(120,80,40,.35)"></div>' +
      '<div class="fkb" style="position:absolute;top:0;bottom:0;left:' + (80 + 2 * LANE - 22) + 'px;width:44px;background:repeating-linear-gradient(0deg,#d8dde3 0 60px,#c8102e 60px 100px);box-shadow:0 0 0 4px #555"></div>';
    roadEls = [];
    for (let k = 0; k < 62; k++) { const el = S3D.plane(roadW, SEG + 40, { z: 0, bg: roadBg, html: edges + laneLines + forkBits, css: 'filter:brightness(' + Math.max(0.55, dim) + ');backface-visibility:hidden' }); el.classList.add('rseg'); sc.add(el); roadEls.push(el); }
    if (wet || wid === 'ice') sc.add(S3D.plane(roadW - 140, 4000, { z: -300, y: 1, bg: 'linear-gradient(180deg,rgba(170,195,230,.05),rgba(170,195,230,.2))' }));
    dashG = null;
    // the fork sign gantry
    if (s.fork) forkSign = sc.sprite('<div style="display:flex;gap:30px;align-items:flex-end"><div style="padding:14px 26px;border-radius:12px;background:#b36b00;border:5px solid #fff;font:800 56px Barlow Condensed,sans-serif;color:#fff;white-space:nowrap">&#8592; L · SHORT CUT</div><div style="padding:14px 26px;border-radius:12px;background:#1f6b3a;border:5px solid #fff;font:800 56px Barlow Condensed,sans-serif;color:#fff;white-space:nowrap">MOTORWAY · R &#8594;</div></div>', 0, 380, -30000);
    // landmarks: the city you leave (beside the road at the start) and the one you're heading to (at the finish)
    if (window.LM) {
      const cap = (n) => '<div class="lmcap">' + esc(n) + '</div>';
      if (LM.has(s.route.from)) lmFrom = { b: sc.sprite('<div class="lmw">' + LM.svg(s.route.from, 1.0) + cap(s.route.from + ' · ' + (s.route.lmFrom || '')) + '</div>', roadW / 2 + 650, 0, -6500), x: roadW / 2 + 650, z: -6500 };
      if (LM.has(s.route.to)) lmTo = { b: sc.sprite('<div class="lmw">' + LM.svg(s.route.to, 1.25) + cap('Welcome to ' + s.route.to + ' · ' + (s.route.lmTo || '')) + '</div>', -(roadW / 2 + 750), 0, -30000), x: -(roadW / 2 + 750) };
    }
    // roadside scenery (moves towards the camera to give speed)
    const kinds = s.route.game === 'ATS' ? ['cactus', 'pole', 'rock', 'sign'] : ['tree', 'pole', 'tree', 'sign'];
    for (let i = 0; i < 26; i++) {
      const left = i % 2 === 0;
      const x = (left ? -1 : 1) * (roadW / 2 + 140 + Math.random() * 500);
      const z = -i * 600;
      const kind = kinds[i % kinds.length];
      const html = kind === 'tree' ? '<div style="width:140px;height:220px;background:radial-gradient(ellipse at 50% 40%,#3f7a3a 0 45%,transparent 46%) 0 0/140px 170px no-repeat,linear-gradient(#5a3b22,#5a3b22) 62px 150px/16px 70px no-repeat"></div>'
        : kind === 'cactus' ? '<div style="width:90px;height:180px;background:linear-gradient(#4f8a3c,#4f8a3c) 36px 0/18px 180px no-repeat,linear-gradient(#4f8a3c,#4f8a3c) 6px 60px/14px 60px no-repeat,linear-gradient(#4f8a3c,#4f8a3c) 70px 40px/14px 70px no-repeat;border-radius:8px"></div>'
          : kind === 'rock' ? '<div style="width:150px;height:70px;border-radius:50% 50% 10% 10%;background:linear-gradient(#9b7d5b,#6e5840)"></div>'
            : kind === 'sign' ? '<div style="width:130px;height:180px;display:flex;flex-direction:column;align-items:center"><div style="width:130px;height:70px;border-radius:6px;background:#1f6b3a;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font:800 22px Barlow Condensed,sans-serif;color:#fff">' + esc(s.route.to.toUpperCase().slice(0, 12)) + '</div><div style="width:8px;height:110px;background:#9aa4af"></div></div>'
              : '<div style="width:10px;height:240px;background:linear-gradient(#5b4632,#3f2f20)"><div style="position:absolute;top:0;left:-30px;width:70px;height:8px;background:#3f2f20"></div></div>';
      const b = sc.sprite(html, x, 0, z);
      scenery.push({ b, x, z });
    }
    // trucks
    f.forEach((c, i) => {
      const g = truckGroup(c, a.accent, i);
      sc.add(g);
      const sh = S3D.shadow(160, { squash: 3 }); sc.add(sh);
      const tag = sc.sprite('<div class="ttag" style="opacity:0"></div>', 0, 210, 0);
      const plate = sc.sprite('<div class="pplate"><b>' + (i + 1) + '</b><span>' + esc(String(c.display).slice(0, 12)) + '</span></div>', 0, 330, 0);
      const lane0 = (a.lanes && a.lanes[i] != null) ? a.lanes[i] : [2, 1, 3, 0, 4][i % 5];
      const sub = [0, 0, 0, 0, 0, -60, 60, -60][i] || 0;
      trucks.push({ g, sh, x: laneX(lane0) + sub, lane: lane0, sub, tag, plate, fx: null, rank: i });
    });
    leadRing = S3D.plane(330, 700, { bg: 'radial-gradient(closest-side,rgba(246,215,122,.75),rgba(246,215,122,.25) 60%,transparent)' });
    sc.add(leadRing);
    // weather + HUD
    if (wid === 'fog') { const w = document.createElement('div'); w.className = 'wx fog'; root.appendChild(w); }
    if (wet) { const w = document.createElement('div'); w.className = 'wx rain'; root.appendChild(w); const d2 = document.createElement('div'); d2.className = 'wx'; d2.style.background = 'rgba(30,40,55,' + (wid === 'storm' ? '.35' : '.2') + ')'; root.appendChild(d2); }
    if (isNight) { const w = document.createElement('div'); w.className = 'wx nightwx'; root.appendChild(w); }
    if (tod === 'golden' || tod === 'sunset' || tod === 'sunrise') { const w = document.createElement('div'); w.className = 'wx'; w.style.background = 'linear-gradient(180deg,rgba(255,150,60,' + (tod === 'golden' ? '.12' : '.2') + '),transparent 60%)'; root.appendChild(w); }
    if (wid === 'storm') root.classList.add('windy');
    if (wid === 'snow' || wid === 'ice') {
      snowCv = document.createElement('canvas'); snowCv.className = 'rainc'; snowCv.width = W; snowCv.height = H; root.appendChild(snowCv);
      flakes = Array.from({ length: wid === 'snow' ? 260 : 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 1.5 + Math.random() * 3, v: 0.05 + Math.random() * 0.08, s: Math.random() * 6 }));
    }
    if (wet) {
      rainCv = document.createElement('canvas'); rainCv.className = 'rainc'; rainCv.width = W; rainCv.height = H; root.appendChild(rainCv);
      drops = Array.from({ length: 420 }, () => ({ x: Math.random() * W, y: Math.random() * H, l: 18 + Math.random() * 30, v: 1.2 + Math.random() * 1.2 }));
      const fl = document.createElement('div'); fl.className = 'flash'; fl.id = 'flash'; root.appendChild(fl);
      for (let k = 0; k < 9; k++) { const d = document.createElement('div'); d.className = 'rdrop'; const sz = 16 + Math.random() * 40; d.style.cssText = 'left:' + Math.random() * W + 'px;top:' + Math.random() * H + 'px;width:' + sz + 'px;height:' + sz + 'px;animation:none'; root.appendChild(d); }
    }
    const gl = document.createElement('div'); gl.className = 'glare'; gl.id = 'glare'; root.appendChild(gl);
    const hud = document.createElement('div');
    hud.className = 'hud';
    let rows = '', mm = '';
    f.forEach((c, i) => {
      const T = BBR.tier(c.tier, a.accent);
      const av = c.avatar && /^https:\/\//.test(c.avatar) ? '<img class="av" src="' + esc(c.avatar) + '" alt="" style="border:3px solid ' + T.color + '">'
        : '<div class="av" style="background:#0b0d10;color:' + T.color + ';border:3px solid ' + T.color + '">' + esc(String(c.display).slice(0, 2).toUpperCase()) + '</div>';
      let fuel = ''; for (let k = 0; k < 10; k++) fuel += '<i></i>';
      rows += '<div class="srow' + (f.length > 4 ? ' compact' : '') + '" id="sr' + i + '" style="transform:translateY(' + (i * rowH()) + 'px)"><div class="pos" id="ps' + i + '">' + (i + 1) + '</div>' + av +
        '<div class="info"><div class="nm">' + esc(c.display) + '</div><div class="meta"><span style="color:' + (PCOL[c.platform] || '#999') + '">' + (PTAG[c.platform] || '') + '</span>' +
        '<span style="color:' + T.color + '">' + esc(T.label) + ' ' + c.ovr + '</span>' + (a.live ? '<div class="lanes3" id="ln' + i + '"><i></i><i></i><i></i><i></i><i></i></div>' : '') + '<div class="fuel" id="fu' + i + '"' + (a.live ? ' style="display:none"' : '') + '>' + fuel + '</div><div class="turb" id="tb' + i + '">' + (a.live ? '<i class="on"></i><i class="on"></i><i class="on"></i>' : '') + '</div>' +
        (a.live ? '<div class="bars"><div class="bar tk" id="tk' + i + '" title="fuel"><i style="width:' + ((a.tanks && a.tanks[i]) || 60) + '%"></i></div><div class="bar dm" id="dm' + i + '" title="damage"><i style="width:0%"></i></div></div>' : '') + '</div>' +
        '<div class="st" id="st' + i + '">' + (a.specials && a.specials[i] ? '<span class="spc" id="sp' + i + '">' + esc(a.specials[i].cargo.toUpperCase()) + ' · !special = ' + esc(a.specials[i].name.toUpperCase()) + '</span>' : 'On the start grid') + '</div></div></div>';
      mm += '<div class="dotp" id="mm' + i + '" style="left:0;background:' + T.color + '"></div>';
    });
    hud.innerHTML = '<div class="rhead"><div class="ttl"><div class="k">' + esc(a.label || 'BBR HAULAGE CUP') + '</div><div class="route">' + esc(s.route.from) + ' &rarr; ' + esc(s.route.to) + '</div></div>' +
      '<div class="chips"><div class="chip"><b>' + esc(s.route.game) + '</b></div><div class="chip">' + s.route.km + ' km</div><div class="chip">Cargo: <b>' + esc(s.cargo) + '</b></div><div class="chip">' + esc(s.weather.label) + '</div></div></div>' +
      '<div class="stand">' + rows + '</div>' +
      '<div class="mmap" style="top:96px"><div class="lbl"><span>' + esc(s.route.from.toUpperCase().slice(0, 12)) + '</span><span>' + esc(s.route.to.toUpperCase().slice(0, 12)) + '</span></div><div class="line">' + (s.fork ? '<div class="fork" style="left:' + (s.fork.from * 100) + '%;width:' + ((s.fork.to - s.fork.from) * 100) + '%"></div>' : '') + mm + '</div></div>' +
      '<div class="leadbox" id="leadbox" style="opacity:0"><div class="crown"></div><div><div class="lk">RACE LEADER</div><div class="ln" id="ln"></div><div class="lg" id="lg"></div></div></div>' +
      '<div class="rbanner" id="rban"><span></span></div>' +
      (a.live ? '<div class="rhelp"><b>DRIVERS</b> L / R change lane (L2 / R2) · !turbo (x' + (a.turbo || 3) + ') · !special · !horn · !dodge<br><b>CHAT</b> !rain · !wind · !lightning · !traffic (one each, ' + (a.leaderPct != null ? a.leaderPct : 80) + '% hit the leader) · cheer a driver\'s name for fuel</div>' : '') +
      '<div class="bpk" id="bpk"></div>' +
      '<div class="bigtxt" id="big"></div>' +
      '<div class="ticker"><div class="ch">CB CH 19</div><div class="msg" id="tick"></div></div><div class="photo" id="photo"></div>';
    root.appendChild(hud);
    setFuel(f.map((x) => x.boost || 0));
    place(f.map(() => 0), 0);
    sc.set({ tx: 0, ty: 120, tz: -150, dist: 1500, pitch: 8, yaw: 150 });
    sc.to({ yaw: 205, dist: 1600 }, 30000, (t) => t);
  }

  function setFuel(b) { b.forEach((n, i) => { const fu = $('#fu' + i); if (fu) Array.from(fu.children).forEach((x, k) => x.classList.toggle('on', k < n)); }); }

  let camProg = 0, travelled = 0, live = null;
  const rowH = () => (trucks.length > 4 ? 60 : 88);
  function place(prog, dt) {
    // PACK CAM: aim at the middle of the pack (the leaders and everyone within reach of them)
    const lead = Math.max.apply(null, prog);
    const fin = live ? live.finished : null;
    const racing = prog.filter((p, i) => !(fin && fin.has(i)));
    const P = racing.length ? racing : prog;
    const top = Math.max.apply(null, P), low = Math.max(Math.min.apply(null, P), top - PACK);
    const target = Math.min(1.03, (top + low) / 2);
    packSpan = (top - low) * SCALE;
    camProg += (target - camProg) * Math.min(1, (dt || 16) / 500);
    const now = performance.now();
    trucks.forEach((t, i) => {
      const z = Math.max(-14000, Math.min(9000, -(prog[i] - camProg) * SCALE));
      // event motion: slides, jackknifes, swerves
      let yaw = 0, drift = 0, trlA = 0, pitch = 0;
      if (t.fx) {
        const u = (now - t.fx.t0) / t.fx.dur;
        if (u >= 1) { endFx(t); }
        else if (t.fx.kind === 'slide' || t.fx.kind === 'spray') { const k = 1 - u; yaw = Math.sin(u * Math.PI * 5) * 11 * k; drift = Math.sin(u * Math.PI * 2) * 70; trlA = Math.sin(u * Math.PI * 5 + 1.2) * 16 * k; }
        else if (t.fx.kind === 'crash') { const e = u < 0.2 ? u / 0.2 : u > 0.75 ? (1 - u) / 0.25 : 1; yaw = 32 * e * t.fx.dir; trlA = -58 * e * t.fx.dir; drift = 90 * e * t.fx.dir; }
        else if (t.fx.kind === 'animal') { const k = Math.sin(Math.min(1, u * 1.6) * Math.PI); yaw = Math.sin(u * Math.PI * 3) * 7 * (1 - u); pitch = 3 * k; drift = Math.sin(u * Math.PI) * -50; }
        else if (t.fx.kind === 'blowout') { trlA = Math.sin(u * Math.PI * 7) * 6 * (1 - u); yaw = Math.sin(u * Math.PI * 7) * 2; }
      }
      const tx = laneX(t.lane) + t.sub;
      t.x += (tx - t.x) * Math.min(1, (dt || 16) / 260);
      const steerYaw = Math.max(-14, Math.min(14, (tx - t.x) * 0.08));
      yaw += -steerYaw;
      const bx = bendX(prog[i]); yaw += -heading(prog[i]);
      const X = t.x + drift + bx;
      S3D.place(t.g, X, 0, z);
      t.g._body.style.transform = 'rotateY(' + yaw + 'deg) rotateX(' + pitch + 'deg)';
      t.g._trl.style.transform = 'translate3d(0,0,-110px) rotateY(' + trlA + 'deg) translate3d(0,0,110px)';
      t.sh.style.transform = S3D.pos(X, 1, z) + ' rotateX(90deg)';
      sc.moveSprite(t.tag, X, 230, z - 100);
      sc.moveSprite(t.plate, X, 330, z + 120);
      // trucks right behind the camera would show giant plates: hide them, the standings list still has them
      const near = z > 4000;   // (top-down camera: only hide labels far behind it)
      if (t.near !== near) { t.near = near; t.plate.style.opacity = near ? 0 : 1; t.tag.style.opacity = near ? 0 : 1; }
      t.z = z; t.dx = drift + bx;
      const mm = $('#mm' + i); if (mm) mm.style.left = (Math.min(1, prog[i]) * 100) + '%';
    });
    // the finish line is fixed in the world: it appears in the distance and the road carries it towards you
    if ((1 - camProg) * SCALE < 11000) {
      if (!gantry) {
        const lanesW = NL * LANE + 260;
        gantry = S3D.group(0, 0, 0);
        const L = S3D.box(30, 420, 30, { color: '#d9dee4' }); S3D.place(L, -lanesW / 2, 0, 0); gantry.appendChild(L);
        const Rr = S3D.box(30, 420, 30, { color: '#d9dee4' }); S3D.place(Rr, lanesW / 2, 0, 0); gantry.appendChild(Rr);
        const banner = S3D.box(lanesW + 30, 110, 20, { color: '#111', front: 'conic-gradient(#fff 25%,#111 0 50%,#fff 0 75%,#111 0) 0 0/40px 40px',
          back: 'conic-gradient(#fff 25%,#111 0 50%,#fff 0 75%,#111 0) 0 0/40px 40px', html: { front: '<div style="height:100%;display:flex;align-items:center;justify-content:center"><span style="background:#111;padding:4px 18px;font:800 54px Barlow Condensed,sans-serif;letter-spacing:6px;color:' + data.accent + '">FINISH · ' + esc(data.setup.route.to.toUpperCase()) + '</span></div>' } });
        S3D.place(banner, 0, 340, 0); gantry.appendChild(banner);
        sc.add(gantry);
      }
      S3D.place(gantry, bendX(1), 0, -(1 - camProg) * SCALE - 260);
    }
    // speed effect: scenery + lane dashes stream past
    travelled = camProg * SCALE;   // scenery, road and finish all move with the same camera = a static world
    for (const s of scenery) {
      let z = s.z + travelled % 15600;
      if (z > 6000) z -= 15600;
      if (z > 6000) z -= 15600;
      sc.moveSprite(s.b, s.x + bendX(camProg - z / SCALE), 0, z);
    }
    // road segments ride along with the world, bending with the curve
    for (let k = 0; k < roadEls.length; k++) {
      const z = 6200 - k * SEG + (travelled % SEG), p = camProg - z / SCALE;
      const el = roadEls[k], fk = inFork(p);
      el.style.transform = S3D.pos(bendX(p), 0, z) + ' rotateY(' + (-heading(p)).toFixed(2) + 'deg) rotateX(90deg)';
      if (el._fk !== fk) { el._fk = fk; el.classList.toggle('fk', fk); }
    }
    if (forkSign) { const F = data.setup.fork, z = -(F.from - 0.012 - camProg) * SCALE; forkSign.style.display = z > 3000 || z < -16000 ? 'none' : ''; sc.moveSprite(forkSign, bendX(F.from - 0.012), 380, z); }
    if (root && root.classList.contains('windy')) { const k = Math.sin(performance.now() / 260); for (const s of scenery) if (s.b.firstChild) s.b.firstChild.style.rotate = (k * 6) + 'deg'; }
    if (dashG) dashG.style.transform = S3D.pos(0, 0, travelled % DASH);
    for (const o of obsEls.values()) {
      const z = -(o.d - camProg) * SCALE;
      o.b.style.display = z > 3000 || z < -16000 ? 'none' : '';
      sc.moveSprite(o.b, laneX(o.lane) + bendX(o.d), 0, z);
    }
    if (lmFrom) { const z = lmFrom.z + travelled; lmFrom.b.style.display = z > 2200 ? 'none' : ''; sc.moveSprite(lmFrom.b, lmFrom.x + bendX(camProg - z / SCALE), 0, z); }
    if (lmTo) { const z = -(1 - camProg) * SCALE - 1800; lmTo.b.style.display = z < -16000 ? 'none' : ''; sc.moveSprite(lmTo.b, lmTo.x + bendX(1.04), 0, z); }
    backOfPack(prog);
    sc.apply();
    const order = prog.map((p, i) => i).sort((x, y) => prog[y] - prog[x]);
    order.forEach((d, rank) => {
      const r = $('#sr' + d); if (r) { r.style.transform = 'translateY(' + (rank * rowH()) + 'px)'; r.classList.toggle('lead', rank === 0); }
      const ps = $('#ps' + d); if (ps) ps.textContent = rank + 1;
      const t = trucks[d];
      if (t && t.rank !== rank) {
        t.rank = rank;
        const pl = t.plate.firstChild; pl.className = 'pplate' + (rank < 3 ? ' p' + (rank + 1) : ''); pl.querySelector('b').textContent = 'P' + (rank + 1);
      }
    });
    const L = trucks[order[0]];
    if (L && leadRing) leadRing.style.transform = S3D.pos(L.x + (L.dx || 0), 2, (L.z || 0) + 20) + ' rotateX(90deg)';
    return order;
  }
  // trucks too far back for the camera: a card each in the corner, so nobody disappears
  function backOfPack(prog) {
    const box = $('#bpk'); if (!box || !data) return;
    const top = Math.max.apply(null, prog), km = data.setup.route.km;
    const out = prog.map((p, i) => [p, i]).filter(([p, i]) => top - p > PACK && !(live && live.finished.has(i))).sort((a, b) => b[0] - a[0]);
    const html = out.length ? '<div class="h">BACK OF THE PACK</div>' + out.slice(0, 4).map(([p, i]) => '<div class="r">' + esc(String(data.fighters[i].display).slice(0, 14)) + '<span>-' + ((top - p) * km).toFixed(1) + ' km</span></div>').join('') : '';
    if (box._h !== html) { box._h = html; box.innerHTML = html; }
  }
  function endFx(t) {
    if (!t.fx) return;
    if (t.fx.kind === 'crash' || t.fx.kind === 'smoke') t.g._haz.forEach((h) => h && h.classList.remove('on'));
    if (t.g._tail) t.g._tail.classList.remove('on');
    if (t.fx.cop) t.fx.cop.remove();
    t.fx = null;
  }
  // start the animation for a race event on truck i
  function eventFx(i, e) {
    const t = trucks[i]; if (!t) return;
    endFx(t);
    const dur = { crash: 3200, slide: 2200, spray: 1800, animal: 2200, blowout: 1800 }[e.kind] || 1800;
    t.fx = { kind: e.kind, t0: performance.now(), dur, dir: Math.random() < 0.5 ? -1 : 1 };
    if (e.kind === 'crash') {
      t.g._haz.forEach((h) => h && h.classList.add('on'));
      SFX.play('skid'); SFX.play('crash', 0.35); SFX.play('ooh', 0.6);
      later(() => { sparks(t, 0, 10, 100, 26); puffs(t, 0, 60, 120, 'rgba(70,70,70,.8)', 10, 320, 2400); }, 350);
      later(() => puffs(t, 40, 120, -150, 'rgba(60,60,60,.75)', 8, 360, 2600), 1200);
      sc.shake(9, 600);
      rbanner('CRASH!', '#ff4d5e');
    } else if (e.kind === 'slide' || e.kind === 'spray') {
      SFX.play('skid'); puffs(t, 0, 20, 260, 'rgba(220,230,240,.6)', 8, 120, 1200);
    } else if (e.kind === 'animal') {
      const an = e.animal || 'deer';
      const el = fxEl(t, animalHtml(an), 'left:-100px;top:-170px;width:200px;height:170px;display:flex;align-items:flex-end;justify-content:center');
      const from = (Math.random() < 0.5 ? -1 : 1) * 420;
      el.animate([{ transform: S3D.pos(from, 0, -650), opacity: 0 }, { opacity: 1, offset: 0.1 }, { transform: S3D.pos(from * 0.1, 0, -520), offset: 0.55 }, { transform: S3D.pos(-from, 0, -380), opacity: 0 }],
        { duration: 2300, easing: 'linear', fill: 'both' }).onfinish = () => el.remove();
      if (t.g._tail) t.g._tail.classList.add('on');
      SFX.play('horn', 0, 0.6); SFX.play('airbrake', 0.3);
      if (an === 'cow') SFX.play('moo', 0.5); if (an === 'bear') SFX.play('roar', 0.3);
    } else if (e.kind === 'blowout') {
      SFX.play('boom'); sparks(t, 46, 10, 160, 18); puffs(t, 46, 20, 170, 'rgba(90,90,90,.75)', 6, 200, 1600);
    } else if (e.kind === 'smoke') {
      t.g._haz.forEach((h) => h && h.classList.add('on'));
      puffs(t, 0, 140, -200, 'rgba(80,80,80,.75)', 10, 300, 2600); later(() => puffs(t, 0, 140, -200, 'rgba(80,80,80,.7)', 8, 300, 2600), 1200);
    } else if (e.kind === 'police') {
      const cop = S3D.box(80, 60, 160, { color: '#f2f2f2', html: { back: '<div style="height:100%;background:linear-gradient(#f2f2f2 0 40%,#111 40% 60%,#f2f2f2 60%)"></div>' } });
      S3D.place(cop, 90, 0, 520);
      const bar = S3D.box(60, 10, 14, { color: '#1f6bff', faceCss: 'animation:copl .4s steps(1) infinite' }); S3D.place(bar, 90, 60, 520);
      t.g.appendChild(cop); t.g.appendChild(bar);
      t.fx.cop = { remove: () => { cop.remove(); bar.remove(); } };
      t.fx.dur = 2600; SFX.play('alarm', 0, 1.2);
      if (t.g._tail) t.g._tail.classList.add('on');
    } else if (e.kind === 'stop' || e.kind === 'cones' || e.kind === 'detour') {
      if (t.g._tail) t.g._tail.classList.add('on');
      if (e.kind === 'cones') for (let k = 0; k < 5; k++) {
        const c = fxEl(t, '', 'left:-14px;top:-50px;width:28px;height:50px;background:linear-gradient(#ff6a00 0 30%,#fff 30% 45%,#ff6a00 45%);clip-path:polygon(50% 0,100% 100%,0 100%)');
        c.animate([{ transform: S3D.pos(-70 + k * 10, 0, -800 - k * 160) }, { transform: S3D.pos(-70 + k * 10, 0, 900 - k * 160) }], { duration: 1800, delay: k * 60, fill: 'both' }).onfinish = () => c.remove();
      }
    } else if (e.kind === 'glare') {
      const g = $('#glare'); if (g) g.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.15 }, { opacity: 0.6, offset: 0.6 }, { opacity: 0 }], { duration: 1600 });
    } else if (e.good) {
      // slipstream / downhill / shortcut: speed streaks behind the truck
      for (let k = 0; k < 6; k++) {
        const d = fxEl(t, '', 'left:-3px;top:-200px;width:6px;height:200px;background:linear-gradient(transparent,' + data.accent + ');box-shadow:0 0 12px ' + data.accent);
        d.animate([{ transform: S3D.pos(-60 + k * 24, 80 + Math.random() * 60, 260) + ' rotateX(90deg)', opacity: 0.9 }, { transform: S3D.pos(-60 + k * 24, 80, 900) + ' rotateX(90deg)', opacity: 0 }],
          { duration: 600, delay: k * 90, iterations: 2, fill: 'both' }).onfinish = () => d.remove();
      }
    }
  }
  function rbanner(text, color) {
    const b = $('#rban'); if (!b) return;
    b.style.setProperty('--bc', color); b.firstChild.textContent = text;
    b.animate([{ opacity: 0, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(1)', offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1900 });
  }
  function rain(dt, now) {
    if (snowCv) {
      const g = snowCv.getContext('2d'); g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.85)';
      for (const f of flakes) { f.y += f.v * dt; f.x += Math.sin((now / 700) + f.s) * 0.4 - 0.15; if (f.y > H) { f.y = -5; f.x = Math.random() * W; } g.beginPath(); g.arc(f.x, f.y, f.r, 0, 6.3); g.fill(); }
    }
    if (!rainCv) return;
    const g = rainCv.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(205,220,245,.45)'; g.lineWidth = 1.4;
    g.beginPath();
    for (const d of drops) {
      d.y += d.v * dt; d.x -= d.v * dt * 0.22;
      if (d.y > H) { d.y = -d.l; d.x = Math.random() * (W + 200); }
      g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * 0.22, d.y - d.l);
    }
    g.stroke();
    // lightning
    if (!nextBolt) nextBolt = now + 4000 + Math.random() * 6000;
    if (now > nextBolt) {
      nextBolt = now + 7000 + Math.random() * 9000;
      const fl = $('#flash'); if (fl) fl.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.05 }, { opacity: 0.1, offset: 0.2 }, { opacity: 0.6, offset: 0.3 }, { opacity: 0 }], { duration: 700 });
      SFX.play('thunder', 0.4);
    }
    // spray thrown up behind every truck
    if (now - lastSpray > 260) {
      lastSpray = now;
      trucks.forEach((t) => puffs(t, (Math.random() - 0.5) * 80, 10, 250, 'rgba(210,222,235,.5)', 1, 90, 900));
    }
  }

  function ticker(html, sound) { const t = $('#tick'); if (t) { t.innerHTML = html; t.animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 350 }); } if (sound) SFX.play('cb'); }
  function big(text, color, dur) {
    const b = $('#big'); if (!b) return;
    b.textContent = text; b.style.color = color || '#f2f5f7';
    b.animate([{ opacity: 0, transform: 'scale(2)' }, { opacity: 1, transform: 'scale(1)', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: dur || 1400 });
  }
  function tag(i, text, good) {
    const t = trucks[i] && trucks[i].tag.firstChild; if (!t) return;
    t.className = 'ttag ' + (good ? 'good' : 'bad'); t.textContent = text.toUpperCase();
    t.animate([{ opacity: 0, transform: 'translate(-50%,-80%)' }, { opacity: 1, transform: 'translate(-50%,-100%)', offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 2400, fill: 'forwards' });
    const st = $('#st' + i); if (st) { st.textContent = text; st.style.color = good ? 'var(--acc)' : '#ff8a96'; }
  }

  // ---------- phases ----------
  function matchup(a) {
    build(a);
    SFX.play('boom', 0); SFX.play('revs', 0.3); SFX.play('horn', 1.3, 0.7);
    const upd = () => {
      const left = Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000));
      ticker('FUEL UP <b>' + left + 's</b> · cheer bits / Kicks / Super Chat with a driver\'s name (100 = +1 fuel) · drivers: sub or gift for +5');
    };
    upd();
    timers.push(setInterval(upd, 1000));
  }

  function boosted(a) {
    if (!root) return;
    setFuel(a.boosts);
    if (trucks[a.side]) tag(a.side, '+' + a.points + ' FUEL', true);
    SFX.play('revs'); SFX.play('ding', 0.15);
  }

  function run(a) {
    if (!root || (a.live && !$('#tk0'))) build(a);
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    data = a;
    setFuel(a.fighters.map((x) => x.boost || 0));
    const T = a.timing, f = a.fighters, s = a.setup;
    const rc = document.createElement('div');
    rc.className = 'rcard';
    rc.innerHTML = '<div class="a">TODAY\'S DELIVERY</div><div class="b">' + esc(s.route.from) + ' &rarr; ' + esc(s.route.to) + '</div><div class="c">' + s.route.km + ' km · ' + esc(s.cargo) + ' · ' + esc(s.weather.label) + '</div>';
    root.querySelector('.hud').appendChild(rc);
    ticker('Breaker breaker, <b>' + f.length + ' rigs</b> heading for ' + esc(s.route.to) + '. Keep the shiny side up!', true);
    SFX.play('whoosh', 0.1);
    sc.to({ yaw: 180, dist: 1300, pitch: 6, tz: -100 }, T.intro - 3200);
    later(() => {
      rc.remove();
      sc.to({ yaw: 360, dist: 1850, pitch: 15, tz: -250, ty: 100 }, 2800);
      const cd = document.createElement('div');
      cd.className = 'cd';
      cd.innerHTML = '<div class="lights"><div class="lamp r"></div><div class="lamp a"></div><div class="lamp g"></div></div><div class="cdn" id="cdn"></div>';
      root.querySelector('.hud').appendChild(cd);
      const step = (n, lamp, snd) => { const c = cd.querySelector('#cdn'); if (c) c.textContent = n; const l = cd.querySelector('.lamp.' + lamp); if (l) l.classList.add('on'); SFX.play(snd); };
      step('3', 'r', 'beep');
      later(() => step('2', 'a', 'beep'), 1000);
      later(() => step('1', 'a', 'beep'), 2000);
      SFX.play('revs', 0.2); SFX.play('revs', 1.6);
      later(() => {
        const c = cd.querySelector('#cdn'); if (c) { c.textContent = 'GO!'; c.style.color = a.accent; }
        cd.querySelectorAll('.lamp').forEach((x) => x.classList.remove('on'));
        cd.querySelector('.lamp.g').classList.add('on');
        SFX.play('go'); SFX.play('horn', 0.05, 1.1); SFX.play('engine', 0.1, a.ticks ? a.ticks + 1 : 55);
        f.forEach((x, i) => { const st = $('#st' + i); if (st) st.textContent = 'Rolling'; });
        later(() => cd.remove(), 900);
        if (a.live) startLive(a); else drive(a);
      }, 3000);
    }, T.intro - 3000);
  }

  function drive(a) {
    const start = performance.now();
    let last = start;
    const tick = a.timing.tick;
    const shown = new Set(), finished = new Set();
    const lerp = (arr, t) => { const i = Math.min(arr.length - 2, Math.floor(t)); const fr = Math.min(1, t - i); return arr[i] + (arr[i + 1] - arr[i]) * fr; };
    let swayT = 0;
    const frame = (now) => {
      if (!root) return;
      const dt = now - last; last = now;
      const t = Math.min(a.ticks, (now - start) / tick);
      const prog = a.positions.map((p) => lerp(p, t));
      swayT += dt;
      sc.st.yaw = 360 + Math.sin(swayT / 2600) * 12;
      const order = place(prog, finished.size === prog.length ? 0 : dt);
      rain(dt, now);
      // leader + gap
      const lb = $('#leadbox');
      if (lb && t > 0.5) {
        lb.style.opacity = 1;
        const gap = Math.max(0, (prog[order[0]] - (prog[order[1]] != null ? prog[order[1]] : 0)) * a.setup.route.km);
        $('#ln').textContent = a.fighters[order[0]].display;
        $('#lg').textContent = order.length > 1 ? (gap < 0.05 ? 'Neck and neck with ' : '+' + gap.toFixed(1) + ' km ahead of ') + a.fighters[order[1]].display : 'Out on their own';
      }
      if (order[0] !== leader) {
        if (leader >= 0 && t > 2 && finished.size === 0) {
          rbanner('NEW LEADER', '#f6d77a');
          ticker('<b>' + esc(a.fighters[order[0]].display) + '</b> takes the lead from ' + esc(a.fighters[leader].display) + '!', true);
          SFX.play('whoosh'); SFX.play('horn', 0.1, 0.5); SFX.play('cheer', 0.1, 1.2);
          if (lb) lb.animate([{ transform: 'translateX(-50%) scale(1.15)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 500 });
        }
        leader = order[0];
      }
      if (!finalShown && prog[order[0]] > 0.86) { finalShown = true; rbanner('FINAL STRETCH', a.accent); SFX.play('riser', 0, 1.5); sc.to({ dist: 1500, pitch: 10 }, 1500); }
      a.events.forEach((e, k) => {
        if (!shown.has(k) && t >= e.t - 1) {
          shown.add(k);
          tag(e.d, e.text, e.good);
          ticker('<b>' + esc(a.fighters[e.d].display) + '</b>: ' + esc(e.text), true);
          eventFx(e.d, e);
          if (!e.kind || ['stop', 'detour', 'smoke', 'cones', 'fog', 'glare'].includes(e.kind)) SFX.play(e.good ? 'whoosh' : (/weigh|fuel|breakdown/i.test(e.text) ? 'airbrake' : 'thud'), 0.15);
          if (e.good) SFX.play('whoosh', 0.15);
        }
      });
      prog.forEach((p, i) => {
        if (p >= 1 && !finished.has(i)) {
          finished.add(i);
          const st = $('#st' + i); if (st) { st.textContent = 'Delivered!'; st.style.color = 'var(--acc)'; }
          if (finished.size === 1) {
            if (a.photoFinish) {
              const ph = $('#photo'); if (ph) ph.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.1 }, { opacity: 0 }], { duration: 600 });
              SFX.play('burst'); big('PHOTO FINISH!', '#ffffff', 1600);
            } else big('FINISH!', a.accent, 1400);
            sc.shake(8, 500);
            SFX.play('horn', 0.1, 1.3); SFX.play('cheer', 0.2, 2.5);
            ticker('<b>' + esc(a.fighters[i].display) + '</b> delivers first to ' + esc(a.setup.route.to) + '!', true);
          } else SFX.play('airbrake');
        }
      });
      if (t < a.ticks) raf = requestAnimationFrame(frame);
      else later(() => results(a), 700);
    };
    raf = requestAnimationFrame(frame);
  }

  // ---------- live race: the server sends positions every second, we glide between them ----------
  const CAM = { pitch: 60, dist: 2300, orbitMs: 48000 };
  const cam = { yaw: 360 };
  function startLive(a) {
    cam.yaw = sc ? sc.st.yaw : 360;
    const n = a.fighters.length;
    live = { prev: new Array(n).fill(0), next: new Array(n).fill(0), t0: performance.now(), finished: new Set(), raining: a.setup.weather.id === 'rain', a };
    let last = performance.now();
    const frame = (now) => {
      if (!root || !live) return;
      const dt = now - last; last = now;
      const u = Math.min(1, (now - live.t0) / 1000);
      const prog = live.next.map((x, i) => live.prev[i] + (x - live.prev[i]) * u);
      live.cur = prog;
      // PACK CAM: high up over the middle of the pack, pulling back far enough to fit everyone in reach of the leader,
      // easing in when they bunch up. A gentle sway instead of a full orbit, so the road always reads the same way.
      if (trucks.length) {
        const k = Math.min(1, dt / 600);
        cam.t = (cam.t || 0) + dt;
        sc.st.tx += (bendX(camProg) - sc.st.tx) * k;
        sc.st.tz += (-60 - sc.st.tz) * k;
        sc.st.ty += (40 - sc.st.ty) * k;
        sc.st.pitch += (CAM.pitch - sc.st.pitch) * Math.min(1, dt / 1500);
        const want = Math.max(CAM.dist, Math.min(5600, 1900 + packSpan * 0.62));
        sc.st.dist += (want - sc.st.dist) * Math.min(1, dt / 1200);
        sc.st.yaw = 360 + Math.sin(cam.t / 9000) * 18;
      }
      const order = place(prog, dt);
      rain(dt, now);
      const lb = $('#leadbox');
      if (lb) {
        lb.style.opacity = 1;
        const gap = Math.max(0, (prog[order[0]] - (prog[order[1]] != null ? prog[order[1]] : 0)) * a.setup.route.km);
        $('#ln').textContent = a.fighters[order[0]].display;
        $('#lg').textContent = order.length > 1 ? (gap < 0.05 ? 'Neck and neck with ' : '+' + gap.toFixed(1) + ' km ahead of ') + a.fighters[order[1]].display : 'Out on their own';
      }
      if (order[0] !== leader) {
        if (leader >= 0 && live.finished.size === 0 && prog[order[0]] > 0.05) {
          rbanner('NEW LEADER', '#f6d77a');
          ticker('<b>' + esc(a.fighters[order[0]].display) + '</b> takes the lead from ' + esc(a.fighters[leader].display) + '!', true);
          SFX.play('whoosh'); SFX.play('horn', 0.1, 0.5);
        }
        leader = order[0];
      }
      if (!finalShown && prog[order[0]] > 0.86) { finalShown = true; rbanner('FINAL STRETCH', a.accent); SFX.play('riser', 0, 1.5); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  function setRain(on) {
    if (!root) return;
    const has = !!rainCv;
    if (on && !has) {
      rainCv = document.createElement('canvas'); rainCv.className = 'rainc'; rainCv.width = W; rainCv.height = H; root.insertBefore(rainCv, root.querySelector('.hud'));
      drops = Array.from({ length: 420 }, () => ({ x: Math.random() * W, y: Math.random() * H, l: 18 + Math.random() * 30, v: 1.2 + Math.random() * 1.2 }));
      if (!$('#flash')) { const fl = document.createElement('div'); fl.className = 'flash'; fl.id = 'flash'; root.insertBefore(fl, root.querySelector('.hud')); }
      rainCv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1500 });
    } else if (!on && has) { const c = rainCv; rainCv = null; c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1500 }).onfinish = () => c.remove(); }
  }
  function strike(i) {
    const t = trucks[i]; if (!t) return;
    const b = sc.sprite('<svg class="bolt" viewBox="0 0 40 220"><path d="M22 0 L8 90 L20 92 L4 220 L34 70 L20 68 L32 0Z" fill="#fff" stroke="#9fd0ff" stroke-width="2" style="filter:drop-shadow(0 0 12px #9fd0ff)"/></svg>', t.x + (t.dx || 0), 0, (t.z || 0) - 50);
    b.firstChild.animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards' });
    setTimeout(() => sc && sc.removeSprite(b), 700);
    const fl = $('#flash') || (() => { const f = document.createElement('div'); f.className = 'flash'; f.id = 'flash'; root.insertBefore(f, root.querySelector('.hud')); return f; })();
    fl.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.05 }, { opacity: 0.1, offset: 0.25 }, { opacity: 0.6, offset: 0.35 }, { opacity: 0 }], { duration: 700 });
    SFX.play('thunder'); SFX.play('crash', 0.05);
    sparks(t, 0, 140, 100, 30); puffs(t, 0, 120, 0, 'rgba(60,60,70,.8)', 8, 300, 2200);
    sc.shake(10, 500);
  }
  function tick(a) {
    if (!root || !live) return;
    live.prev = live.cur ? live.cur.slice() : live.next.slice();
    live.next = a.pos; live.t0 = performance.now();
    if (a.wx) { setRain(a.wx.rain); root.classList.toggle('windy', !!a.wx.wind); }
    (a.drivers || []).forEach((d, i) => {
      const fu = $('#fu' + i); if (fu) Array.from(fu.children).forEach((x, k) => x.classList.toggle('on', k < d[0]));
      const tb = $('#tb' + i); if (tb) Array.from(tb.children).forEach((x, k) => x.classList.toggle('on', k < d[1]));
      if (d.length > 5) {
        if (trucks[i]) trucks[i].lane = d[5];
        const ln = $('#ln' + i); if (ln) Array.from(ln.children).forEach((x, k) => x.classList.toggle('on', k === d[5]));
        const tk = $('#tk' + i); if (tk) { tk.firstChild.style.width = d[6] + '%'; tk.classList.toggle('low', d[6] < 25); tk.classList.toggle('dry', d[6] <= 0); }
        const dm = $('#dm' + i); if (dm) dm.firstChild.style.width = d[7] + '%';
        const sp = $('#sp' + i); if (sp) sp.classList.toggle('used', d[8] <= 0);
      }
    });
    if (a.obs && sc) {
      const seen = new Set();
      for (const [id, d, lane, kind] of a.obs) {
        seen.add(id);
        if (!obsEls.has(id)) {
          const b = sc.sprite('<div style="display:flex;align-items:flex-end;justify-content:center">' + (OB_HTML[kind] || OB_HTML.cones)() + '</div>', laneX(lane), 0, -30000);
          obsEls.set(id, { b, d, lane, kind });
        }
      }
      for (const [id, o] of obsEls) if (!seen.has(id)) { sc.removeSprite(o.b); obsEls.delete(id); }
    }
    for (const e of a.ev) {
      const L = live.a;
      if (e.d < 0) {
        if (e.kind === 'rainstart') { rbanner('CHAT CALLED IN RAIN!', '#7fb6e6'); SFX.play('thunder'); }
        if (e.kind === 'windstart') { rbanner('CROSSWINDS!', '#c9d0d8'); SFX.play('whoosh'); SFX.play('whoosh', 0.3); }
        if (e.kind === 'forkwarn') { rbanner('FORK AHEAD: L SHORT CUT · R MOTORWAY', '#ffb020'); SFX.play('alarm', 0, 0.6); }
        ticker((e.by ? '<b>' + esc(String(e.by).split(':').pop()) + '</b>: ' : '') + esc(e.text), true);
        continue;
      }
      const name = esc(L.fighters[e.d].display);
      if (e.kind === 'finish') {
        live.finished.add(e.d);
        const st = $('#st' + e.d); if (st) { st.textContent = 'Delivered!'; st.style.color = 'var(--acc)'; }
        if (live.finished.size === 1) {
          big('FINISH!', L.accent, 1400); sc.shake(8, 500); SFX.play('horn', 0.1, 1.3); SFX.play('cheer', 0.2, 2.5);
          ticker('<b>' + name + '</b> delivers first to ' + esc(L.setup.route.to) + '!', true);
        } else SFX.play('airbrake');
        continue;
      }
      if (e.kind === 'lane') { if (trucks[e.d]) trucks[e.d].lane = e.lane; if (!e.good && e.text) { tag(e.d, e.text, false); } continue; }
      if (e.kind === 'horn') { SFX.play('horn', 0, 0.8); tag(e.d, 'HONK!', true); if (e.target != null) ticker('<b>' + name + '</b> honks <b>' + esc(L.fighters[e.target].display) + '</b> out of the lane!', false); continue; }
      if (e.kind === 'fuelup') { tag(e.d, 'FUEL +', true); SFX.play('ding'); SFX.play('revs', 0.1); const o = obsEls.get(e.ob); if (o) { o.b.firstChild.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 400, fill: 'forwards' }); } continue; }
      if (e.kind === 'dry') { tag(e.d, 'OUT OF FUEL!', false); ticker('<b>' + name + '</b> is running on fumes! Cheer their name for fuel!', true); SFX.play('airbrake'); continue; }
      if (e.kind === 'limp') { tag(e.d, 'WRECKED!', false); const t = trucks[e.d]; if (t) { t.g._haz.forEach((h) => h && h.classList.add('on')); puffs(t, 0, 140, -200, 'rgba(60,60,60,.8)', 10, 300, 2600); } ticker('<b>' + name + '</b>: ' + esc(e.text), true); continue; }
      if (e.kind === 'special') {
        rbanner(e.name.toUpperCase() + '!', '#ffb020');
        ticker('<b>' + name + '</b> ' + esc(e.text) + (e.target != null ? ' Incoming for <b>' + esc(L.fighters[e.target].display) + '</b>!' : ''), true);
        SFX.play('impact'); SFX.play('ooh', 0.3);
        const t = trucks[e.d];
        if (t && e.sp === 'fireworks') { for (let k = 0; k < 4; k++) later(() => { sparks(t, (Math.random() - 0.5) * 300, 300 + Math.random() * 200, 0, 30); SFX.play('burst'); }, k * 300); }
        if (t && (e.sp === 'fuel' || e.sp === 'pit')) { tag(e.d, e.sp === 'fuel' ? 'TANK FULL' : 'REPAIRED', true); SFX.play('ding', 0.2); }
        if (t && e.sp === 'stones') sparks(t, 0, 60, 300, 20);
        continue;
      }
      if (e.kind === 'ob') {
        const t = trucks[e.d];
        tag(e.d, e.text, false);
        ticker('<b>' + name + '</b>: ' + esc(e.text) + (e.by ? ' (thanks to <b>' + esc(e.by) + '</b>)' : ''), true);
        const o = obsEls.get(e.obId); if (o) o.b.firstChild.animate([{ transform: 'none' }, { transform: 'translateY(-60px) rotate(25deg)', opacity: 0.2 }], { duration: 600, fill: 'forwards' });
        if (t) { sparks(t, 0, 20, -240, 12); if (['slick', 'ice', 'puddle'].includes(e.ob)) eventFx(e.d, { kind: 'slide' }); else if (e.ob === 'car' || e.ob === 'logs' || e.ob === 'bales') { eventFx(e.d, { kind: 'blowout' }); sc.shake(6, 400); } }
        SFX.play(['slick', 'ice', 'puddle'].includes(e.ob) ? 'skid' : 'thud'); if (e.ob === 'cows') SFX.play('moo', 0.2);
        continue;
      }
      if (e.kind === 'turbo') { tag(e.d, 'TURBO!', true); eventFx(e.d, { good: true, kind: 'boost' }); SFX.play('revs'); SFX.play('whoosh', 0.1); continue; }
      if (e.kind === 'dodge') { tag(e.d, 'DODGED!', true); ticker('<b>' + name + '</b> dodges it!', false); SFX.play('skid'); continue; }
      tag(e.d, e.text, e.good);
      ticker((e.by ? '<b>' + esc(String(e.by).split(':').pop()) + '</b> hits ' : '<b>') + name + (e.by ? '' : '</b>') + ': ' + esc(e.text), true);
      if (e.kind === 'lightning') { strike(e.d); continue; }
      if (e.kind === 'traffic') { eventFx(e.d, { kind: 'cones' }); const t = trucks[e.d]; if (t) { puffs(t, 120, 40, -700, 'rgba(70,70,70,.8)', 8, 260, 2200); } SFX.play('crash'); SFX.play('airbrake', 0.4); continue; }
      if (e.kind === 'gust') { eventFx(e.d, { kind: 'slide' }); SFX.play('whoosh'); continue; }
      eventFx(e.d, e);
      if (!e.kind || ['stop', 'detour', 'smoke', 'cones', 'fog', 'glare'].includes(e.kind)) SFX.play(e.good ? 'whoosh' : (/weigh|fuel|breakdown/i.test(e.text) ? 'airbrake' : 'thud'), 0.15);
      if (e.good) SFX.play('whoosh', 0.15);
    }
  }
  function result(a) {
    if (!root) return;
    if (raf) cancelAnimationFrame(raf); raf = null;
    const T = (data && data.timing) || { intro: 5500, tick: 1000 };
    const r = Object.assign({}, a, { timing: T, durationMs: a.outroMs + T.intro + a.ticks * T.tick + 700, accent: (data && data.accent) || a.accent });
    later(() => results(r), 900);
  }

  function results(a) {
    if (!root) return;
    const f = a.fighters, s = a.setup, res = a.results, w = f[a.winner];
    const box = document.createElement('div');
    box.className = 'rres';
    const pod = (r, rank) => {
      if (!r) return '';
      const c = f[r.d];
      const T = BBR.tier(c.tier, a.accent);
      const scale = rank === 0 ? 0.72 : 0.56;
      const cw = Math.round(260 * scale), ch = Math.round(380 * scale);
      const cardData = Object.assign({}, c, { ribbon: rank === 0 ? '1ST PLACE' : c.ribbon });
      const colors = ['#f6d77a', '#d5dae0', '#d08a50'];
      const heights = [120, 86, 64];
      return '<div class="pod"><div class="slot ' + BBR.wrapClass(c.tier) + '" style="width:' + cw + 'px;height:' + ch + 'px"><div style="position:absolute;left:0;top:0;width:260px;height:380px;transform:scale(' + scale + ');transform-origin:0 0;transform-style:preserve-3d">' +
        BBR.render(cardData, { accent: a.accent, edges: 8, effects: rank === 0 }) + '</div></div>' +
        '<div class="pn" style="color:' + T.color + '">' + esc(c.display) + '</div><div class="pt">' + (r.finished ? r.time : '+' + r.behindKm + ' km behind') + '</div>' +
        '<div class="block" style="height:' + heights[rank] + 'px;background:' + colors[rank] + '">' + (rank + 1) + '</div></div>';
    };
    const others = res.slice(3).map((r, k) => (k + 4) + '. ' + esc(f[r.d].display) + ' · ' + (r.finished ? r.time : '+' + r.behindKm + ' km')).join('<br>');
    box.innerHTML = '<div class="top"><div class="k">KING OF THE ROAD</div><div class="h">' + esc(w.display) + '</div>' +
      '<div class="d">Delivered ' + esc(s.cargo) + ' to ' + esc(s.route.to) + ' in ' + esc(res[0].time || '') + (a.leadChanges ? ' · ' + a.leadChanges + ' lead change' + (a.leadChanges === 1 ? '' : 's') : '') + ' · card points: 1st +' + (a.points || [3])[0] + ', 2nd +' + ((a.points || [])[1] || 2) + ', everyone else +1' + '</div></div>' +
      '<div class="podium">' + pod(res[1], 1) + pod(res[0], 0) + pod(res[2], 2) + '</div>' + (others ? '<div class="others">' + others + '</div>' : '');
    const colors = [a.accent, BBR.tier(w.tier, a.accent).color, '#ffffff', '#ffb020'];
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('div');
      c.className = 'conf';
      c.style.left = Math.random() * W + 'px';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (2.2 + Math.random() * 2.5) + 's';
      c.style.animationDelay = (Math.random() * 1.2) + 's';
      box.appendChild(c);
    }
    root.querySelector('.hud').appendChild(box);
    SFX.play('impact', 0); SFX.play('fanfare', 0.15); SFX.play('horn', 0.9, 0.7); SFX.play('cheer', 0.2, 3.5); SFX.tierFx(w.tier, 1.2);
    const remain = a.durationMs - (a.timing.intro + a.ticks * a.timing.tick) - 700;
    later(() => { if (root) root.classList.add('out'); }, Math.max(1500, remain - 600));
    later(() => { clear(); if (onDone) onDone(); }, Math.max(2100, remain));
  }

  return { init: (o) => { stage = o.stage; onDone = o.done; }, matchup, boosted, run, tick, result, clear, active: () => !!root };
})();
