// QUEEN RAID: community co-op battle overlay, set in the streamer's own Ashfall Frontier artwork
// (maps, the Veydr machines and the six raider crew in public/art).
// Server sends: matchup (roster), boost, arc (start state), tick (every second), result.
window.ARC = (function () {
  let stage = null, onDone = null, root = null, sc = null, data = null, timers = [], raf = null;
  let raiders = [], minis = [], queen = null, last = null, scoreOrder = [];
  const esc = (s) => BBR.esc(s);
  const W = 1840, H = 660, SHOW = 24;
  const PCOL = { twitch: '#9146ff', kick: '#53fc18', youtube: '#ff2a3d' };
  // the Ashfall crew. Each raider's role picks their look (matches the character art).
  const LOOK = {
    kite: { name: 'KITE', kit: '#e9e4d8', trim: '#2f6fd1', shorts: '#2a3550', skin: '#e3b48f', hair: '#ecc86a', head: 'glasses', scarf: '#2f6fd1', col: '#4d9bff' },
    bulwark: { name: 'BULWARK', kit: '#1f7d86', trim: '#e08a1e', shorts: '#2b2f36', skin: '#6b4430', hair: '#1a1410', head: 'helmet', col: '#3fd0c9' },
    rivet: { name: 'RIVET', kit: '#e5a823', trim: '#2a2e38', shorts: '#2a2e38', skin: '#e0a98a', hair: '#4a2c1c', head: 'goggles', col: '#ffc233' },
    merek: { name: 'MEREK', kit: '#ece6d8', trim: '#c8282e', shorts: '#3a3434', skin: '#e0ad8c', hair: '#141414', head: 'hood', cape: '#c8282e', col: '#ff5a5a' },
    cinder: { name: 'CINDER', kit: '#ddd5c6', trim: '#b02a2a', shorts: '#3a2f2a', skin: '#c98f6c', hair: '#8a8580', head: 'cap', scarf: '#b02a2a', col: '#ff7a3a' },
    orchid: { name: 'ORCHID', kit: '#7b3fa8', trim: '#2a2440', shorts: '#2a2440', skin: '#ecc2a2', hair: '#121018', head: 'phones', col: '#c58bff' }
  };
  // Veydr machine materials: cream plates, rust, orange paint, dark joints, cyan cores
  const RUST = 'radial-gradient(circle at 22% 30%,#b8621f 0 5%,transparent 6%),radial-gradient(circle at 70% 64%,#a4521a 0 4%,transparent 5%),radial-gradient(circle at 48% 84%,#8a4a1a 0 3%,transparent 4%),radial-gradient(circle at 82% 22%,#c8742a 0 3%,transparent 4%),';
  const PLATE = RUST + 'linear-gradient(160deg,#f1e9da,#d5c8b0 60%,#b9aa90)';
  const PLATE_O = RUST + 'linear-gradient(135deg,#efe6d6 0 46%,#e08a1e 46% 70%,#efe6d6 70%)';
  const JOINT = 'linear-gradient(180deg,#3a3d42,#1d1f23)';
  const MAPGROUND = { verdant: '#4f5a3a', glasswaste: '#8a4a36', skygrave: '#5e5048', hollow: '#4d5a45', frostspire: '#b8c4d4', saltwake: '#b9a47e', thundercrest: '#7b7f86', ember: '#5a2a1c' };
  const TINT = { day: '', dusk: 'linear-gradient(180deg,rgba(120,50,20,.35),rgba(40,10,0,.25)),', night: 'linear-gradient(180deg,rgba(4,8,28,.72),rgba(4,8,28,.55)),', storm: 'linear-gradient(180deg,rgba(40,20,70,.55),rgba(20,10,40,.4)),' };

  const CSS = `
  .aarena{position:absolute;left:40px;top:392px;width:${W}px;height:${H}px;border-radius:20px;overflow:hidden;border:2px solid var(--acc);box-shadow:0 20px 60px rgba(0,0,0,.6);animation:arenaIn .7s cubic-bezier(.2,.9,.3,1.1) both;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7}
  .aarena.out{animation:arenaOut .6s ease-in both}
  .aarena .hud{position:absolute;inset:0;pointer-events:none}
  .aarena .top{position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;width:900px}
  .aarena .tt{display:flex;align-items:center;gap:14px}
  .aarena .ttl{font-size:16px;font-weight:800;letter-spacing:6px;color:var(--acc)}
  .aarena .clock{font-size:54px;font-weight:800;line-height:1;padding:2px 18px;border-radius:10px;background:rgba(10,12,15,.85);font-variant-numeric:tabular-nums}
  .aarena .clock.low{color:#ff4d5e;animation:clk .6s steps(1) infinite}
  @keyframes clk{50%{color:#fff}}
  .aarena .boss{width:900px;padding:8px 14px;border-radius:12px;background:rgba(10,12,15,.86)}
  .aarena .bn{display:flex;justify-content:space-between;align-items:baseline;font-size:22px;font-weight:800;letter-spacing:2px}
  .aarena .bn small{font-size:14px;color:#c3cad3;letter-spacing:1px;font-family:Inter,sans-serif;font-weight:600}
  .aarena .hp{position:relative;height:16px;border-radius:8px;background:#2a1414;overflow:hidden;margin-top:5px}
  .aarena .hp i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ff2a2a,#ff7a3a);box-shadow:0 0 14px #ff3a2a;transition:width .8s}
  .aarena .hp em{position:absolute;left:0;top:0;bottom:0;background:repeating-linear-gradient(135deg,#ffb020 0 8px,#3a2a00 8px 16px);opacity:.9;transition:width .8s}
  .aarena .hp b{position:absolute;left:0;top:0;bottom:0;background:#fff;opacity:.5;transition:width 1.6s .4s}
  .aarena .boss.rage{animation:rage .7s ease-in-out infinite}
  @keyframes rage{50%{box-shadow:0 0 0 2px #ff2a2a,0 0 30px #ff2a2a}}
  .aarena .board{position:absolute;left:18px;top:18px;width:300px;display:flex;flex-direction:column;gap:4px}
  .aarena .bh{font-size:14px;font-weight:800;letter-spacing:4px;color:#c3cad3;padding:0 6px}
  .aarena .br{display:flex;align-items:center;gap:8px;height:42px;padding:0 10px 0 6px;border-radius:9px;background:rgba(10,12,15,.84);transition:transform .4s}
  .aarena .br .n{width:18px;font-size:20px;font-weight:800;text-align:center;color:#c3cad3}
  .aarena .br.r1 .n{color:#f6d77a}.aarena .br.r1{box-shadow:inset 0 0 0 2px #f6d77a}
  .aarena .br .av{width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;background:#20262e;box-sizing:border-box}
  .aarena .br .nm{flex:1;min-width:0;font-size:19px;font-weight:800;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .aarena .br .nm small{display:block;font-size:11px;letter-spacing:2px;color:#9aa4af;font-weight:700}
  .aarena .br .sc{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
  .aarena .br.dn{background:rgba(70,10,14,.86)}.aarena .br.dn .sc::after{content:" DOWN";font-size:12px;color:#ff6a75}
  .aarena .hpb{position:relative;height:5px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:3px;overflow:hidden}
  .aarena .hpb i{position:absolute;left:0;top:0;bottom:0;background:#3dff9a;transition:width .5s}.aarena .hpb em{position:absolute;left:0;top:0;bottom:0;background:#4dc3ff;opacity:.85}
  .aarena .br.act{box-shadow:inset 3px 0 0 #ffb020}
  .aarena .ahelp{position:absolute;left:18px;bottom:18px;width:300px;padding:8px 14px;border-radius:10px;background:rgba(10,12,15,.86);font-family:Inter,sans-serif;font-size:14px;color:#c3cad3;line-height:1.5}
  .aarena .ahelp b{color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:17px;letter-spacing:1px}
  .aarena .wp{display:flex;gap:1px;margin-top:2px}.aarena .wp i{width:5px;height:4px;background:rgba(255,255,255,.15)}.aarena .wp i.on{background:var(--acc)}
  .aarena .side{position:absolute;right:18px;top:18px;width:280px;display:flex;flex-direction:column;gap:6px;align-items:flex-end}
  .aarena .chip{padding:6px 12px;border-radius:999px;background:rgba(10,12,15,.84);font-size:17px;font-weight:700;letter-spacing:1px;white-space:nowrap}
  .aarena .chip b{color:var(--acc)}
  .aarena .feed{position:absolute;right:18px;bottom:18px;width:520px;display:flex;flex-direction:column;gap:5px;align-items:flex-end}
  .aarena .fi{padding:5px 12px;border-radius:8px;background:rgba(10,12,15,.86);font-size:19px;font-weight:700;white-space:nowrap;max-width:520px;overflow:hidden;text-overflow:ellipsis}
  .aarena .fi b{color:var(--acc)}.aarena .fi .r{color:#ff6a75}.aarena .fi .g{color:#3dff9a}.aarena .fi .y{color:#ffb020}
  .aarena .bigt{position:absolute;left:0;right:0;top:250px;text-align:center;font-size:110px;font-weight:800;letter-spacing:6px;opacity:0;pointer-events:none;text-shadow:0 6px 0 rgba(0,0,0,.5),0 0 40px rgba(0,0,0,.5)}
  .aarena .subt{position:absolute;left:0;right:0;top:372px;text-align:center;font-size:30px;font-weight:700;opacity:0;pointer-events:none;text-shadow:0 3px 0 rgba(0,0,0,.6)}
  .aarena .roster{position:absolute;left:340px;right:320px;top:150px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-content:flex-start;max-height:330px;overflow:hidden}
  .aarena .rc{display:flex;align-items:center;gap:7px;padding:4px 10px 4px 4px;border-radius:999px;background:rgba(10,12,15,.86);font-size:18px;font-weight:800;text-transform:uppercase;animation:rcIn .4s cubic-bezier(.3,1.4,.5,1) both}
  .aarena .rc .av{width:28px;height:28px;border-radius:50%;object-fit:cover;display:flex;align-items:center;justify-content:center;font-size:12px;background:#20262e}
  .aarena .rc em{font-style:normal;font-size:12px;letter-spacing:2px;color:var(--acc)}
  @keyframes rcIn{from{opacity:0;transform:scale(.5)}}
  .aarena .gear{position:absolute;left:340px;right:320px;bottom:20px;padding:12px 18px;border-radius:12px;background:rgba(10,12,15,.88);text-align:center}
  .aarena .gear .g1{font-size:34px;font-weight:800;letter-spacing:2px}.aarena .gear .g1 b{color:var(--acc)}
  .aarena .gear .g2{font-family:Inter,sans-serif;font-size:15px;color:#c3cad3;margin-top:4px}
  .aarena .supply{position:absolute;right:18px;top:110px;width:280px;padding:8px 12px;border-radius:10px;background:rgba(10,12,15,.84)}
  .aarena .supply .sl{display:flex;justify-content:space-between;font-size:15px;font-weight:800;letter-spacing:2px;color:#c3cad3}
  .aarena .supply .sl b{color:var(--acc)}
  .aarena .supply .st{height:8px;border-radius:4px;background:rgba(255,255,255,.12);margin-top:4px;overflow:hidden}.aarena .supply .st i{display:block;height:100%;background:var(--acc);transition:width .6s}
  .aarena .apr{width:12px;height:12px;border-radius:50%;background:#fff1b8;box-shadow:0 0 14px 5px #ffb020}
  .aarena .epr{width:14px;height:14px;border-radius:50%;background:#e8fdff;box-shadow:0 0 14px 6px #22c6f0}
  .aarena .apr.c{width:16px;height:16px;background:#fff;box-shadow:0 0 22px 8px var(--acc)}
  .aarena .spk{width:60px;height:60px;border-radius:50%;background:radial-gradient(closest-side,#fff,#ffb020 35%,rgba(255,80,20,.5) 60%,transparent)}
  .aarena .boom{width:340px;height:340px;border-radius:50%;background:radial-gradient(closest-side,#fff7d0,#ffb020 25%,#ff4a1a 50%,rgba(60,30,20,.6) 70%,transparent)}
  .aarena .dmg{font-size:30px;font-weight:800;color:#fff;text-shadow:0 2px 0 #000,0 0 10px #ff6a00}
  .aarena .dmg.c{font-size:42px;color:#ffd23f}
  .aarena .tagr{width:max-content;padding:3px 10px;border-radius:6px;background:rgba(10,12,15,.8);font-size:24px;font-weight:800;white-space:nowrap;opacity:0;transition:opacity .3s}
  .aarena .tagr.top{opacity:1;background:#f6d77a;color:#111}
  .aarena .tagr.dn{opacity:1;background:#c8102e;color:#fff}
  .aarena .tagr.el{opacity:1;background:#3a3d42;color:#ff9aa8;text-decoration:line-through}
  .aarena .qshield{width:1700px;height:1250px;border-radius:50%;background:radial-gradient(closest-side,rgba(90,216,255,0) 62%,rgba(90,216,255,.18) 80%,rgba(160,240,255,.55) 96%,rgba(90,216,255,0) 100%);box-shadow:0 0 60px rgba(90,216,255,.35) inset;animation:qsh 1.6s ease-in-out infinite}
  @keyframes qsh{50%{filter:brightness(1.35)}}
  .aarena.trueform .qcore{background:radial-gradient(circle,#fff 0 12%,#e6b3ff 24%,#a03cff 52%,rgba(120,0,255,0) 72%)!important;box-shadow:0 0 80px 30px rgba(170,80,255,.8)!important}
  .aarena .mhp{width:110px;height:8px;border-radius:4px;background:rgba(0,0,0,.6);overflow:hidden;border:1px solid rgba(255,255,255,.3)}.aarena .mhp i{display:block;height:100%;background:#ff3a2a;transition:width .5s}
  .aarena .vcore{position:absolute;border-radius:50%;background:radial-gradient(circle,#fff 0 14%,#a8f6ff 26%,#22c6f0 52%,rgba(20,170,230,0) 72%);box-shadow:0 0 24px 8px rgba(60,210,255,.75)}
  .aarena.rage .qcore{background:radial-gradient(circle,#fff 0 12%,#ffd0a0 22%,#ff4a1a 50%,rgba(255,40,0,0) 72%);box-shadow:0 0 60px 22px rgba(255,70,20,.8)}
  .aarena .shard{clip-path:polygon(50% 0,100% 38%,50% 100%,0 38%)}
  .aarena .ring{border-radius:50%}
  .aarena .spin{animation:vspin 7s linear infinite}.aarena .spin.f{animation-duration:3s}.aarena .spin.r{animation-direction:reverse}
  @keyframes vspin{to{transform:rotate(360deg)}}
  .aarena .spinY{animation:vspinY 9s linear infinite}
  @keyframes vspinY{from{transform:rotateY(0)}to{transform:rotateY(360deg)}}
  .aarena .rp{width:24px;height:24px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid #fff;margin-left:-20px;margin-top:18px;position:relative}
  .aarena .incoming{position:absolute;left:50%;top:150px;transform:translateX(-50%);display:flex;gap:10px;padding:10px 14px;border-radius:14px;background:rgba(10,12,15,.86);animation:rcIn .5s cubic-bezier(.3,1.4,.5,1) both}
  .aarena .incoming .ec{width:120px;text-align:center;font-size:17px;font-weight:800;letter-spacing:1px}
  .aarena .incoming .ec img{width:120px;height:108px;object-fit:cover;border-radius:8px;display:block;margin-bottom:4px;border:2px solid rgba(255,255,255,.2)}
  .aarena .incoming .ec small{display:block;font-size:12px;color:#9aa4af;letter-spacing:0;font-family:Inter,sans-serif;font-weight:600}
  .aarena .incoming .ec b{color:#5ad8ff}
  .aarena .crew{display:flex;gap:6px;justify-content:center;margin-top:8px}
  .aarena .crew div{display:flex;flex-direction:column;align-items:center;font-size:12px;font-weight:800;letter-spacing:1px}
  .aarena .crew img{width:46px;height:46px;border-radius:50%;object-fit:cover;border:2px solid var(--c)}
  .aarena .eye{position:absolute;border-radius:50%;background:radial-gradient(circle,#fff 0 15%,#ff2a2a 35%,#a00 70%);box-shadow:0 0 18px 6px #ff2a2a}
  .aarena .core{border-radius:50%;background:radial-gradient(circle,#fff 0 12%,#ffb3a0 20%,#ff3a1a 45%,#7a0a00 75%,transparent 76%);box-shadow:0 0 60px 20px rgba(255,60,20,.7)}
  .aarena .wup{position:absolute;left:50%;top:150px;transform:translateX(-50%);display:flex;align-items:center;gap:18px;padding:14px 26px 14px 16px;border-radius:18px;background:radial-gradient(ellipse at 20% 0%,rgba(255,154,31,.35),rgba(10,12,15,.94) 70%);border:2px solid #ff9a1f;box-shadow:0 0 40px rgba(255,154,31,.45);z-index:30;pointer-events:none;animation:wupIn 2.9s ease-out both}
  @keyframes wupIn{0%{opacity:0;transform:translateX(-50%) scale(1.6)}10%{opacity:1;transform:translateX(-50%) scale(1)}85%{opacity:1;transform:translateX(-50%) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-20px)}}
  .aarena .wup .wa{width:64px;height:64px;border-radius:50%;border:3px solid #ff9a1f;background:#2b313b;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;overflow:hidden;position:relative}
  .aarena .wup .wa img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .aarena .wup .w1{font-size:20px;font-weight:800;letter-spacing:2px;white-space:nowrap}
  .aarena .wup .w2{font-size:50px;font-weight:800;line-height:1;color:#ff9a1f;white-space:nowrap}
  .aarena .wup .w3{font-family:Inter,sans-serif;font-size:14px;color:#ffe2bd}
  .aarena .wup .wb{height:7px;border-radius:4px;background:#2b313b;margin-top:6px;overflow:hidden}.aarena .wup .wb i{display:block;height:100%;background:#ff9a1f}
  .aarena .tagr .wpn{display:block;font-size:11px;letter-spacing:1px;color:#ffb85a}
  .aarena.qd1 .qcore{filter:saturate(1.3) drop-shadow(0 0 14px #ff6a1a)}
  .aarena.qd2 .qcore{filter:saturate(1.6) drop-shadow(0 0 26px #ff3a1a)}
  .aarena.qd3 .qcore{filter:saturate(2) drop-shadow(0 0 40px #ff1a1a);animation:corep .25s ease-in-out infinite}
  .aarena .smk{width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(70,66,62,.75),rgba(40,38,36,0) 70%);filter:blur(6px)}
  .aarena .deb{width:46px;height:30px;background:linear-gradient(135deg,#6b7178,#2b2f34);clip-path:polygon(0 20%,60% 0,100% 40%,80% 100%,10% 80%)}
  .aarena .shock{width:300px;height:300px;border-radius:50%;border:10px solid rgba(255,255,255,.85);box-shadow:0 0 60px #fff}
  .aarena .flare{width:16px;height:16px;border-radius:50%;background:#fff3b0;box-shadow:0 0 24px 10px var(--c)}
  .aarena.wrath{animation:wrathT 2.6s ease-in-out both}
  @keyframes wrathT{0%{filter:none}30%{filter:sepia(.6) saturate(3) hue-rotate(-30deg) brightness(.85)}100%{filter:sepia(.5) saturate(2.6) hue-rotate(-30deg) brightness(.7)}}
  .aarena .beam{position:absolute;left:50%;top:0;width:60px;height:1400px;transform-origin:50% 0;background:linear-gradient(90deg,transparent,#ff3a3a 30%,#fff 50%,#ff3a3a 70%,transparent);box-shadow:0 0 60px #ff2a2a;z-index:25;pointer-events:none;opacity:.9}
  .aarena.rage .core{animation:corep .4s ease-in-out infinite}
  @keyframes corep{50%{filter:brightness(1.6)}}
  .aarena .laser{background:linear-gradient(180deg,transparent,#ff2a2a 35%,#fff 50%,#ff2a2a 65%,transparent);box-shadow:0 0 30px #ff2a2a}
  .aarena .flashx{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
  .aarena .res{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:50px;background:radial-gradient(circle at 40% 50%,rgba(20,26,34,.92),rgba(5,6,8,.97));animation:resIn .5s ease-out both;overflow:hidden}
  .aarena .res .rk{font-size:22px;font-weight:700;letter-spacing:6px;color:var(--acc)}
  .aarena .res .rh{font-size:84px;font-weight:800;line-height:.95;text-transform:uppercase}
  .aarena .res .rd{font-family:Inter,sans-serif;font-size:18px;color:#c4cbd3;max-width:640px;margin-top:6px}
  .aarena .res .tl{display:flex;flex-direction:column;gap:6px;margin-top:14px}
  .aarena .res .tr{display:flex;align-items:center;gap:12px;font-size:26px;font-weight:800;text-transform:uppercase}
  .aarena .res .tr span{color:var(--acc);font-size:22px}
  .aarena .res .tr em{font-style:normal;font-family:Inter,sans-serif;font-size:15px;color:#9aa4af;text-transform:none;font-weight:600}
  `;

  function later(fn, t) { timers.push(setTimeout(fn, t)); }
  function clear() {
    shieldEls = [];
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    if (raf) cancelAnimationFrame(raf); raf = null;
    if (sc) sc.destroy(); sc = null;
    if (root) root.remove(); root = null;
    raiders = []; minis = []; queen = null; last = null; scoreOrder = []; qStage = 0; wupQ = []; clearTimeout(wupT); wupT = null; wupEl = null;
  }
  const $ = (s) => root && root.querySelector(s);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const avatar = (c, sz) => c.avatar && /^https:\/\//.test(c.avatar)
    ? '<img class="av" src="' + esc(c.avatar) + '" alt="" onerror="this.remove()">'
    : '<div class="av" style="color:' + (PCOL[c.platform] || '#ccc') + '">' + esc(String(c.display).slice(0, 2).toUpperCase()) + '</div>';

  const ROLE_ORDER = ['kite', 'bulwark', 'rivet', 'merek', 'cinder', 'orchid'];
  let groundEls = [];
  const art = (n) => '/art/' + n + '.jpg';
  // the map's artwork is the backdrop; the time of day tints it
  function setMap(id, cond) {
    if (!sc) return;
    const c = (cond && cond.id) || 'day';
    sc.view.style.background = id ? (TINT[c] || '') + 'url("' + art('map-' + id) + '") center 38%/cover no-repeat, #20252c' : 'linear-gradient(180deg,#1a2330,#3a4656 50%,#2a2622 50.2%)';
    const gcol = MAPGROUND[id];
    if (gcol && groundEls.length) { groundEls[0].style.background = gcol; groundEls[1].style.background = groundEls[1].style.background.replace(/#[0-9a-f]{6}$|rgb\([^)]*\)$/i, gcol); }
  }
  const part = (g, w, h, d, x, y, z, o, rot) => { const b = S3D.box(w, h, d, o); S3D.place(b, x, y, z, rot); g.appendChild(b); return b; };
  // flat card centred on (x,y,z): shards, rings, capes
  const card2 = (g, w, h, x, y, z, rot, bg, cls, css) => { const d = S3D.div('s3-plane ' + (cls || ''), 'left:' + (-w / 2) + 'px;top:' + (-h / 2) + 'px;width:' + w + 'px;height:' + h + 'px;background:' + bg + ';' + (css || '')); d.style.transform = S3D.pos(x, y, z) + S3D.rotStr(rot); g.appendChild(d); return d; };
  const coreHtml = (sz, cls) => '<div class="vcore ' + (cls || '') + '" style="left:50%;top:50%;width:' + sz + 'px;height:' + sz + 'px;transform:translate(-50%,-50%)"></div>';
  // a horizontal spinning ring (Lantern, Lookout, the Queen's crown)
  function ring(g, size, y, z, band, speed, tilt) {
    const holder = S3D.div('s3-g'); holder.style.transform = S3D.pos(0, y, z || 0) + ' rotateX(' + (90 + (tilt || 0)) + 'deg)'; g.appendChild(holder);
    const r = S3D.div('s3-plane ring spin' + (speed || ''), 'left:' + (-size / 2) + 'px;top:' + (-size / 2) + 'px;width:' + size + 'px;height:' + size + 'px;background:radial-gradient(closest-side,transparent ' + (100 - band - 4) + '%,#3a3d42 ' + (100 - band - 3) + '%,#e6dccb ' + (100 - band) + '%,#c8742a ' + (100 - band / 2) + '%,#efe6d6 ' + (100 - band / 3) + '%,#3a3d42 99%,transparent 100%),repeating-conic-gradient(from 0deg,transparent 0 8deg,rgba(0,0,0,.25) 8deg 10deg)');
    r.style.webkitMaskImage = r.style.maskImage = 'radial-gradient(closest-side,transparent ' + (100 - band - 4) + '%,#000 ' + (100 - band - 3) + '%,#000 99%,transparent 100%)';
    holder.appendChild(r);
    return holder;
  }
  // leg from a foot on the ground leaning in towards the body: foot at angle A (deg) and radius rr, height h
  function legTo(g, A, rr, h, w, bg, lean) {
    const rad = A * Math.PI / 180;
    const len = Math.sqrt(h * h + (lean || 0) * (lean || 0));
    const t = Math.atan2(lean || 0, h) * 180 / Math.PI;
    return part(g, w, len, w, Math.sin(rad) * rr, 0, Math.cos(rad) * rr, { color: '#2b2e33', front: bg || JOINT }, { y: A, x: t });
  }

  // ---------------- the Ashfall crew ----------------
  function makeRaider(role) {
    const L = LOOK[role] || LOOK.kite, s = 1.25;
    const g = S3D.person({ kit: L.kit, shorts: L.shorts, skin: L.skin, hair: L.head === 'hood' || L.head === 'helmet' || L.head === 'cap' ? null : L.hair, scale: s, gloves: '#2a2a2a' });
    // harness straps across the jacket
    const tb = g.parts.torso.querySelector('[data-face="back"]'), tf = g.parts.torso.querySelector('[data-face="front"]');
    const straps = 'linear-gradient(115deg,transparent 30%,' + L.trim + ' 30% 40%,transparent 40%),linear-gradient(65deg,transparent 30%,' + L.trim + ' 30% 40%,transparent 40%),';
    if (tb) tb.style.background = straps + L.kit;
    if (tf) tf.style.background = straps + L.kit;
    // salvage backpack: cream + orange cases, a little screen and an antenna (the crew's signature kit)
    part(g, 34 * s, 40 * s, 12 * s, 0, 50 * s, -20 * s, { color: '#d8cdb6', front: PLATE, back: 'linear-gradient(180deg,#e08a1e 0 30%,#d8cdb6 30%)' });
    part(g, 26 * s, 16 * s, 10 * s, 0, 88 * s, -20 * s, { color: '#e08a1e', back: role === 'rivet' || role === 'orchid' ? 'linear-gradient(90deg,#1a2a30,#5ad8ff 50%,#1a2a30)' : '#e08a1e' });
    part(g, 3 * s, 70 * s, 3 * s, 12 * s, 90 * s, -22 * s, { color: '#222' });
    if (role === 'bulwark') part(g, 3 * s, 54 * s, 3 * s, -12 * s, 90 * s, -22 * s, { color: '#222' });
    // headgear
    const hy = 101 * s;
    if (L.head === 'hood') part(g, 28 * s, 26 * s, 28 * s, 0, hy - 2 * s, -2 * s, { color: '#ece6d8', front: 'transparent', back: PLATE, radius: 10, skip: ['front'] });
    if (L.head === 'helmet') { part(g, 26 * s, 12 * s, 26 * s, 0, hy + 14 * s, 0, { color: '#efe9dc', radius: 8 }); part(g, 24 * s, 7 * s, 4 * s, 0, hy + 14 * s, 12 * s, { color: '#2f6fd1', front: 'linear-gradient(90deg,#123,#5aa0ff 50%,#123)' }); for (const sx of [-1, 1]) part(g, 5 * s, 12 * s, 12 * s, sx * 14 * s, hy + 4 * s, 0, { color: '#e08a1e', radius: 4 }); }
    if (L.head === 'cap') { part(g, 25 * s, 9 * s, 25 * s, 0, hy + 18 * s, 0, { color: '#e2dccf', back: 'linear-gradient(180deg,#e2dccf 60%,#c8742a 60%)', radius: 5 }); part(g, 22 * s, 3 * s, 12 * s, 0, hy + 18 * s, 16 * s, { color: '#cfc7b6' }); part(g, 22 * s, 12 * s, 6 * s, 0, hy, 10 * s, { color: '#8a8580' }); }
    if (L.head === 'goggles' || L.head === 'glasses') part(g, 24 * s, 6 * s, 25 * s, 0, hy + (L.head === 'goggles' ? 16 : 10) * s, 0, { color: L.head === 'goggles' ? '#c8742a' : '#2a2a2a', front: L.head === 'goggles' ? 'linear-gradient(90deg,#c8742a,#5ad8ff 30% 45%,#c8742a 45% 55%,#5ad8ff 55% 70%,#c8742a)' : 'linear-gradient(90deg,#222,#ffc233 30% 70%,#222)' });
    if (L.head === 'phones') for (const sx of [-1, 1]) part(g, 6 * s, 12 * s, 12 * s, sx * 13 * s, hy + 5 * s, 0, { color: '#e08a1e', radius: 6 });
    // scarf / cape
    if (L.scarf) part(g, 30 * s, 9 * s, 26 * s, 0, 96 * s, 0, { color: L.scarf, radius: 4 });
    if (L.cape) card2(g, 44 * s, 70 * s, 0, 66 * s, -14 * s, { x: -8 }, 'linear-gradient(180deg,' + L.cape + ',#7a1418)', '', 'border-radius:4px 4px 10px 10px');
    if (role === 'merek') part(g, 12 * s, 12 * s, 2 * s, -14 * s, 80 * s, 12 * s, { color: '#fff', front: 'linear-gradient(#c8282e,#c8282e) 50% 0/30% 100% no-repeat,linear-gradient(#c8282e,#c8282e) 0 50%/100% 30% no-repeat,#fff' });
    // rifle
    part(g, 10, 10, 70, 22, 82, 30, { color: '#1d1f22' });
    part(g, 6, 6, 30, 22, 86, 80, { color: '#2a2d32' });
    return g;
  }

  // ---------------- scene ----------------
  function build(a) {
    clear();
    data = a;
    if (!document.getElementById('arc-css')) { const st = document.createElement('style'); st.id = 'arc-css'; st.textContent = CSS; document.head.appendChild(st); }
    root = document.createElement('div');
    root.className = 'aarena';
    root.style.setProperty('--acc', a.accent);
    stage.appendChild(root);
    sc = S3D.scene(root, { w: W, h: H, persp: 1100, horizon: 40, centerY: 0.56, css: 'background:#20252c' });
    setMap(a.mapId, a.cond);
    const A = (el) => sc.add(el);
    // ground: far plane in the map's colour, and a closer scuffed area where the fight happens
    const gcol = MAPGROUND[a.mapId] || '#5a5048';
    groundEls = [A(S3D.plane(20000, 9000, { z: -3000, y: -2, bg: gcol })),
      A(S3D.plane(6000, 5200, { z: -1000, bg: 'radial-gradient(ellipse at 30% 40%,rgba(0,0,0,.22),transparent 30%),radial-gradient(ellipse at 70% 60%,rgba(255,255,255,.06),transparent 30%),repeating-linear-gradient(37deg,rgba(0,0,0,.1) 0 2px,transparent 2px 140px),repeating-linear-gradient(-61deg,rgba(0,0,0,.08) 0 2px,transparent 2px 190px),' + gcol }))];
    // Ashfall ruins: weathered concrete blocks, rusted salvage crates and a relay mast
    const conc = 'linear-gradient(180deg,#d8d2c4,#a49d8e)', crate = RUST + 'linear-gradient(180deg,#e08a1e,#a85a12)';
    const rub = [[-1500, -500, 400, 180, 300, conc], [1400, -300, 300, 260, 260, conc], [-900, -1500, 260, 380, 260, conc], [1100, -1600, 520, 220, 300, conc], [-2100, 200, 340, 140, 300, conc], [2000, 400, 260, 200, 240, conc], [-520, -260, 130, 110, 130, crate], [-380, -300, 110, 90, 110, crate], [700, -150, 140, 120, 140, crate]];
    for (const [x, z, w, h, d, bg] of rub) A(S3D.box(w, h, d, { x, z, color: '#8a8478', front: bg, top: bg === crate ? '#e9a24a' : '#e2ddd0', side: bg, rot: { y: rnd(-20, 20) } }));
    const mast = S3D.group(-2400, 0, -2200);
    for (const [px, pz] of [[-60, -60], [60, -60], [-60, 60], [60, 60]]) { const l = S3D.box(12, 900, 12, { color: '#3a3d42' }); S3D.place(l, px, 0, pz, { x: pz > 0 ? 3.8 : -3.8, z: px > 0 ? -3.8 : 3.8 }); mast.appendChild(l); }
    const dish = S3D.box(180, 120, 30, { color: '#e9e4d8', front: 'radial-gradient(circle,#fff 0 20%,#d8d2c4 60%,#a49d8e)', radius: 90 }); S3D.place(dish, 0, 880, 0, { x: -20 }); mast.appendChild(dish);
    A(mast);
    // ---- raiders ----
    const f = a.fighters;
    const shown = Math.min(SHOW, f.length);
    for (let i = 0; i < shown; i++) {
      const row = Math.floor(i / 8), col = i % 8, inRow = Math.min(8, shown - row * 8);
      const x = (col - (inRow - 1) / 2) * 190 + (row % 2) * 60, z = 280 + row * 240;
      const role = (a.raiders && a.raiders[i] && a.raiders[i].role) || ROLE_ORDER[i % ROLE_ORDER.length];
      const g = makeRaider(role);
      S3D.place(g, x, 0, z, { y: 180 });
      A(g);
      A(S3D.shadow(40, { x, z, squash: 0.7 }));
      const L = LOOK[role] || LOOK.kite;
      const tag = sc.sprite('<div class="tagr" style="box-shadow:inset 0 -3px 0 ' + L.col + '">' + esc(String(f[i].display).slice(0, 12)) + '</div>', x, 200, z);
      raiders.push({ i, g, x, z, tag, down: false, role });
    }
    // HUD
    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML = '<div class="top"><div class="tt"><div class="ttl">QUEEN RAID</div><div class="clock" id="clk">3:00</div><div class="ttl" id="cnd"></div></div>' +
      '<div class="boss" id="boss"><div class="bn"><span id="bnm">CLEAR THE SWARM</span><small id="bsub"></small></div><div class="hp"><b id="hpw"></b><i id="hpi" style="width:100%"></i><em id="hpa" style="width:0"></em></div></div></div>' +
      '<div class="board" id="board"><div class="bh">TOP RAIDERS</div></div>' +
      '<div class="side"><div class="chip"><b id="cnt">' + f.length + '</b> RAIDERS</div><div class="chip" id="mapc"></div></div>' +
      '<div class="supply" style="top:104px"><div class="sl"><span>TEAM SUPPLY</span><b id="sup">+0%</b></div><div class="st"><i id="supi" style="width:0"></i></div></div>' +
      '<div class="ahelp" id="ahelp" style="display:none"></div>' +
      '<div class="feed" id="feed"></div><div class="bigt" id="big"></div><div class="subt" id="sub"></div><div class="flashx" id="flx"></div>';
    root.appendChild(hud);
    sc.set({ tx: 0, ty: 260, tz: -300, dist: 2400, pitch: 9, yaw: -24 });
    sc.to({ yaw: 0, dist: 2250 }, 6000);
    // slow idle camera drift
    const t0 = performance.now();
    const loop = (now) => { if (!sc) return; sc.st.yaw += (Math.sin((now - t0) / 4000) * 4 - sc.st.yaw) * 0.01; sc.apply(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }

  // ---------------- the Veydr machines (built from the Ashfall artwork) ----------------
  const HEIGHT = { scrabbler: 150, clusterwisp: 300, lantern: 470, lookout: 440, boreback: 170, quarrymaw: 330 };
  const FLY = { clusterwisp: 280 };
  function buildMachine(type, g) {
    if (type === 'scrabbler') {
      // low six-legged scout with an angular cream shell and a cyan eye
      part(g, 150, 46, 110, 0, 52, 0, { color: '#d8cdb6', front: PLATE_O, top: PLATE, side: PLATE, html: { front: coreHtml(28) } });
      card2(g, 190, 120, 0, 104, -6, { x: 75 }, PLATE, 'shard', '');
      card2(g, 90, 50, -60, 100, 40, { x: 70, z: 20 }, PLATE_O, 'shard', '');
      card2(g, 90, 50, 60, 100, 40, { x: 70, z: -20 }, PLATE_O, 'shard', '');
      for (const sx of [-1, 1]) for (const lz of [-44, 0, 44]) {
        const hip = S3D.group(sx * 70, 60, lz);
        part(hip, 16, 76, 16, 0, 0, 0, { color: '#d8cdb6', front: PLATE }, { z: sx * 58 });
        g.appendChild(hip);
        part(g, 9, 110, 9, sx * 170, 0, lz * 1.25, { color: '#2b2e33', front: JOINT }, { z: -sx * 32 });
      }
    } else if (type === 'clusterwisp') {
      // a floating star of cream shards around a cyan core, always turning
      const spin = S3D.div('s3-g spinY'); g.appendChild(spin);
      card2(spin, 80, 80, 0, 0, 0, null, 'transparent', '', '');
      spin.lastChild.innerHTML = coreHtml(70);
      for (let k = 0; k < 12; k++) {
        const ring2 = k < 8 ? 0 : 90;
        const holder = S3D.div('s3-g'); holder.style.transform = 'rotateY(' + (ring2 + (k % 2) * 30) + 'deg) rotateZ(' + (k * 45 + (k >= 8 ? 22 : 0)) + 'deg)'; spin.appendChild(holder);
        card2(holder, 40, 110, 0, 105, 0, null, k % 3 === 0 ? PLATE_O : PLATE, 'shard', '');
      }
    } else if (type === 'lantern') {
      // tall tripod survey machine with a spinning disc crown and a hanging lamp
      for (const A of [0, 120, 240]) legTo(g, A, 150, 380, 12, 'linear-gradient(180deg,#d8cdb6 0 40%,#2b2e33 40%)', 150);
      part(g, 70, 80, 70, 0, 330, 0, { color: '#d8cdb6', front: PLATE_O, side: PLATE, html: { front: coreHtml(36) } });
      part(g, 30, 60, 30, 0, 270, 0, { color: '#2b2e33' });
      ring(g, 380, 430, 0, 22, '', 0);
      part(g, 6, 90, 6, 0, 430, 0, { color: '#3a3d42' });
      part(g, 16, 16, 16, 0, 520, 0, { color: '#e08a1e', radius: 8 });
    } else if (type === 'lookout') {
      // four-legged relay tower with gyroscope rings round its core
      for (const A of [45, 135, 225, 315]) legTo(g, A, 170, 340, 14, 'linear-gradient(180deg,#d8cdb6 0 35%,#2b2e33 35%)', 170);
      part(g, 60, 60, 60, 0, 300, 0, { color: '#2b2e33', html: { front: coreHtml(50) } });
      const gy = S3D.div('s3-g spinY'); gy.style.transform = S3D.pos(0, 330, 0); g.appendChild(gy);
      ring(gy, 240, 0, 0, 10, ' f', -90);
      ring(gy, 220, 0, 0, 10, ' r', 0);
      ring(g, 300, 380, 0, 8, '', 12);
      part(g, 5, 80, 5, 0, 380, 0, { color: '#3a3d42' });
    } else if (type === 'boreback') {
      // tracked tunnelling machine with a striped drill
      for (const sx of [-1, 1]) part(g, 46, 56, 190, sx * 72, 0, 0, { color: '#202226', front: 'repeating-linear-gradient(90deg,#2b2e33 0 10px,#15171a 10px 14px)', side: 'repeating-linear-gradient(90deg,#2b2e33 0 14px,#15171a 14px 20px)' });
      part(g, 120, 70, 160, 0, 50, -10, { color: '#d8cdb6', front: PLATE_O, top: PLATE, side: PLATE });
      card2(g, 150, 110, 0, 128, -30, { x: 60 }, PLATE, 'shard', '');
      const drill = S3D.group(0, 100, 70, { x: -72 });
      const sizes = [72, 60, 48, 36, 22, 8];
      sizes.forEach((w, k) => part(drill, w, 34, w, 0, k * 34, 0, { color: '#e08a1e', front: 'repeating-linear-gradient(160deg,#e9a23a 0 10px,#2b2e33 10px 16px)', side: 'repeating-linear-gradient(160deg,#e9a23a 0 10px,#2b2e33 10px 16px)', radius: w / 2 }));
      g.appendChild(drill);
      part(g, 40, 40, 20, 0, 70, 70, { color: '#2b2e33', front: '#2b2e33', html: { front: coreHtml(26) } });
    } else {
      // Quarrymaw: hulking knuckle-walking hauler, armour slabs on the shoulders, core in the chest
      part(g, 230, 170, 160, 0, 120, 0, { color: '#d8cdb6', front: PLATE, top: PLATE, side: PLATE, html: { front: '<div style="position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:70px;height:70px;background:#1d1f23;border-radius:12px"></div>' + coreHtml(52) } });
      for (const sx of [-1, 1]) {
        part(g, 120, 110, 150, sx * 150, 220, 0, { color: '#d8cdb6', front: PLATE_O, top: PLATE, side: PLATE }, { z: sx * 12 });
        part(g, 80, 180, 80, sx * 180, 0, 30, { color: '#2b2e33', front: JOINT });
        part(g, 96, 90, 96, sx * 180, 90, 30, { color: '#d8cdb6', front: PLATE, side: PLATE });
        part(g, 60, 110, 60, sx * 70, 0, -20, { color: '#2b2e33', front: JOINT });
      }
      part(g, 80, 54, 70, 0, 280, 70, { color: '#d8cdb6', front: PLATE_O, html: { front: coreHtml(20) } });
    }
  }
  function makeMini(m, k, n) {
    const perRow = Math.min(7, n);
    const x = ((k % perRow) - (perRow - 1) / 2) * 300 + rnd(-40, 40), z = -620 - Math.floor(k / perRow) * 340;
    const y = FLY[m.type] || 0;
    const g = S3D.group(x, y, z);
    buildMachine(m.type, g);
    S3D.place(g, x, y, z);
    sc.add(g);
    const sh = S3D.shadow(m.type === 'clusterwisp' ? 60 : m.type === 'quarrymaw' || m.type === 'lookout' || m.type === 'lantern' ? 130 : 90, { x, z }); sc.add(sh);
    const bar = sc.sprite('<div class="mhp"><i style="width:100%"></i></div>', x, y + (HEIGHT[m.type] || 200) + 20, z);
    // drop-in from the sky
    g.animate([{ transform: S3D.pos(x, y + 1400, z), opacity: 0 }, { transform: S3D.pos(x, y, z), opacity: 1 }], { duration: 700 + k * 90, easing: 'cubic-bezier(.3,.6,.4,1)' });
    // idle motion
    if (m.type === 'clusterwisp') g.animate([{ transform: S3D.pos(x, y, z) }, { transform: S3D.pos(x + 30, y + 50, z) }, { transform: S3D.pos(x, y, z) }], { duration: 2200 + rnd(0, 800), delay: 800, iterations: Infinity, easing: 'ease-in-out' });
    if (m.type === 'scrabbler' || m.type === 'boreback') g.animate([{ transform: S3D.pos(x, y, z) }, { transform: S3D.pos(x + 70, y, z + 20) }, { transform: S3D.pos(x, y, z) }], { duration: 1700 + rnd(0, 600), delay: 800, iterations: Infinity, easing: 'ease-in-out' });
    if (m.type === 'quarrymaw') g.animate([{ transform: S3D.pos(x, y, z) }, { transform: S3D.pos(x, y + 14, z) + ' rotateZ(2deg)' }, { transform: S3D.pos(x, y, z) }], { duration: 1400, delay: 800, iterations: Infinity, easing: 'ease-in-out' });
    return { g, sh, bar, x, y, z, type: m.type, max: m.max, dead: false, top: HEIGHT[m.type] || 200 };
  }
  // panel showing what's in this swarm, using the machine artwork
  function incoming(list) {
    const counts = {}; list.forEach((m) => { counts[m.type] = (counts[m.type] || 0) + 1; });
    const el = document.createElement('div'); el.className = 'incoming'; el.id = 'incoming';
    el.innerHTML = Object.keys(counts).map((t) => '<div class="ec"><img src="' + art('arc-' + t) + '" alt="">' + esc((list.find((m) => m.type === t) || {}).name || t) + ' <b>×' + counts[t] + '</b>' + (TIPS[t] ? '<small>' + TIPS[t] + '</small>' : '') + '</div>').join('');
    root.querySelector('.hud').appendChild(el);
    later(() => { el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(-50%) translateY(-20px)' }], { duration: 500, fill: 'forwards' }); later(() => el.remove(), 520); }, 6000);
  }
  const TIPS = { lantern: 'repairs other ARC: kill first', lookout: 'makes ARC hit more often', boreback: 'hits hard', quarrymaw: 'elite: very tough', clusterwisp: 'fast, fragile', scrabbler: 'scout' };

  const QZ = -1700, QS = 1.55;
  function makeQueen() {
    // the Veydr Queen: a colossal six-legged walker in cream war-plate with a spinning crown and a cyan core
    const outer = S3D.group(0, 0, QZ);
    const g = S3D.div('s3-g'); g.style.transform = 'scale3d(' + QS + ',' + QS + ',' + QS + ')'; outer.appendChild(g);
    part(g, 900, 240, 600, 0, 470, 0, { color: '#d8cdb6', front: PLATE, top: PLATE_O, side: PLATE, back: PLATE,
      html: { front: '<div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(224,138,30,.95) 0 18px,rgba(30,30,34,.95) 18px 36px) 0 100%/100% 24px no-repeat"></div>' } });
    part(g, 760, 80, 520, 0, 400, 0, { color: '#2b2e33', front: JOINT });
    // dorsal armour slabs
    for (const [px, pz, rz] of [[-300, -100, 14], [300, -100, -14], [0, -160, 0]]) card2(g, 340, 220, px, 760, pz, { x: 70, z: rz }, PLATE_O, 'shard', '');
    // legs: six, each a plated thigh angled out and a long dark shin down to the ground
    for (const sx of [-1, 1]) for (const lz of [-220, 0, 220]) {
      part(g, 56, 360, 56, sx * 450, 560, lz, { color: '#d8cdb6', front: PLATE, side: PLATE }, { z: sx * -50 });
      part(g, 40, 810, 40, sx * 900, 0, lz, { color: '#202326', front: JOINT }, { z: sx * 12.4 }).dataset.leg = '1';
      part(g, 80, 80, 80, sx * 726, 756, lz, { color: '#e08a1e', radius: 20 });
    }
    // head with a cluster of cyan eyes
    let eyes = '';
    [[50, 40, 46], [25, 30, 26], [75, 30, 26], [20, 62, 20], [80, 62, 20], [50, 72, 22]].forEach(([l, t, sz]) => { eyes += '<div class="vcore qcore" style="left:' + l + '%;top:' + t + '%;width:' + sz + 'px;height:' + sz + 'px;transform:translate(-50%,-50%)"></div>'; });
    part(g, 320, 190, 220, 0, 700, 330, { color: '#d8cdb6', front: 'linear-gradient(180deg,#2b2e33,#15171a)', side: PLATE, top: PLATE, radius: 30, html: { front: eyes } });
    // crown: a huge spinning ring above her back, and a mast
    ring(g, 1250, 980, -40, 12, '', 0);
    ring(g, 900, 1040, -40, 10, ' r', 8);
    part(g, 14, 420, 14, 0, 760, -40, { color: '#3a3d42' });
    part(g, 40, 40, 40, 0, 1180, -40, { color: '#e08a1e', radius: 20 });
    // glowing core under the head, ringed by four armour plates
    const core = S3D.wall(200, 200, { y: 470, z: 312, bg: 'transparent', html: '<div class="vcore qcore" style="left:0;top:0;width:200px;height:200px"></div>' }); g.appendChild(core);
    const plates = [[-170, 520], [170, 520], [0, 650], [0, 400]].map(([px, py]) => {
      const p = S3D.box(150, 120, 40, { color: '#d8cdb6', front: PLATE_O, side: PLATE, html: { front: '<div style="position:absolute;inset:8px;background:repeating-linear-gradient(135deg,rgba(224,138,30,.85) 0 10px,transparent 10px 20px);opacity:.55"></div>' } });
      S3D.place(p, px, py - 60, 330); g.appendChild(p); return p;
    });
    sc.add(outer);
    const sh = S3D.shadow(1500, { z: QZ, squash: 0.6, alpha: 0.55 }); sc.add(sh);
    return { g: outer, plates, core, sh, platesLeft: plates.length };
  }

  // ---------------- effects ----------------
  function spr(html, x, y, z, ms, frames) {
    const b = sc.sprite(html, x, y, z);
    const el = b.firstChild;
    if (frames) el.animate(frames, { duration: ms, easing: 'ease-out', fill: 'forwards' });
    later(() => { if (sc) sc.removeSprite(b); }, ms + 50);
    return b;
  }
  function targetPos(t) {
    if (t === 'q' && queen) return [rnd(-280, 280), rnd(600, 1050), QZ + 480];
    const m = minis[t];
    return m ? [m.x + rnd(-40, 40), m.y + (m.type === 'clusterwisp' ? rnd(-40, 40) : m.top * rnd(0.3, 0.75)), m.z] : [0, 300, -800];
  }
  function shoot(r, t, crit) {
    const R = raiders[r % Math.max(1, raiders.length)];
    if (!R || R.down) return;
    const [tx, ty, tz] = targetPos(t);
    const from = [R.x + 20, 140, R.z - 60];
    const b = sc.sprite('<div class="apr' + (crit ? ' c' : '') + '"></div>', from[0], from[1], from[2]);
    const t0 = performance.now(), dur = 240 + Math.random() * 120, delay = Math.random() * 700;
    const step = (now) => {
      if (!sc) return;
      const u = (now - t0 - delay) / dur;
      if (u < 0) { requestAnimationFrame(step); return; }
      if (u >= 1) {
        sc.removeSprite(b);
        spr('<div class="spk"></div>', tx, ty, tz, 300, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(' + (crit ? 2.2 : 1.4) + ')', opacity: 0 }]);
        if (crit && Math.random() < 0.5) spr('<div class="dmg c">CRIT!</div>', tx, ty + 60, tz, 900, [{ transform: 'translate(-50%,-100%)', opacity: 1 }, { transform: 'translate(-50%,-220%)', opacity: 0 }]);
        return;
      }
      sc.moveSprite(b, from[0] + (tx - from[0]) * u, from[1] + (ty - from[1]) * u, from[2] + (tz - from[2]) * u);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    if (Math.random() < 0.35) SFX.play(crit ? 'burstfire' : 'shot', delay / 1000, (R.x / 1500));
  }
  // a Veydr machine fires a cyan bolt at the squad
  function arcShot(mi) {
    const m = minis[mi]; if (!m || m.dead || !raiders.length) return;
    const R = raiders[Math.floor(Math.random() * raiders.length)];
    const from = [m.x, m.y + m.top * 0.5, m.z], to = [R.x + rnd(-30, 30), 110, R.z];
    const b = sc.sprite('<div class="epr"></div>', from[0], from[1], from[2]);
    const t0 = performance.now(), dur = 420;
    const step = (now) => { if (!sc) return; const u = (now - t0) / dur; if (u >= 1) { sc.removeSprite(b); spr('<div class="spk" style="background:radial-gradient(closest-side,#fff,#5ad8ff 35%,rgba(20,150,230,.5) 60%,transparent)"></div>', to[0], to[1], to[2], 300, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.3)', opacity: 0 }]); return; }
      sc.moveSprite(b, from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u); requestAnimationFrame(step); };
    requestAnimationFrame(step);
    if (Math.random() < 0.4) SFX.play('laser', 0, -0.3);
  }
  function explode(x, y, z, big) {
    spr('<div class="boom"></div>', x, y, z, 900, [{ transform: 'translate(-50%,-50%) scale(' + (big ? 0.6 : 0.25) + ')', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(' + (big ? 3 : 1.2) + ')', opacity: 0 }]);
    SFX.play(big ? 'explosion' : 'boom');
    if (sc) sc.shake(big ? 14 : 6, big ? 800 : 400);
  }
  function feed(html) {
    const f = $('#feed'); if (!f) return;
    const d = document.createElement('div'); d.className = 'fi'; d.innerHTML = html;
    f.appendChild(d);
    d.animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 300 });
    while (f.children.length > 5) f.firstChild.remove();
  }
  function big(text, color, ms, sub) {
    const b = $('#big'); if (!b) return;
    b.textContent = text; b.style.color = color || '#fff';
    b.animate([{ opacity: 0, transform: 'scale(2.2)' }, { opacity: 1, transform: 'scale(1)', offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: ms || 1800 });
    if (sub) { const s = $('#sub'); s.textContent = sub; s.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: ms || 1800 }); }
  }
  function flash() { const f = $('#flx'); if (f) f.animate([{ opacity: 0.8 }, { opacity: 0 }], { duration: 500 }); }
  const nm = (i) => esc(data.fighters[i] ? data.fighters[i].display : '?');

  function setDown(i, down) {
    const R = raiders[i]; if (!R || R.down === down) return;
    R.down = down;
    R.g.animate([{ transform: S3D.pos(R.x, 0, R.z) + ' rotateY(180deg)' + (down ? '' : ' rotateX(-85deg)') }, { transform: S3D.pos(R.x, 0, R.z) + ' rotateY(180deg)' + (down ? ' rotateX(-85deg)' : '') }],
      { duration: down ? 300 : 500, fill: 'forwards', easing: down ? 'ease-in' : 'ease-out' });
    const tg = R.tag.firstChild; if (tg) tg.classList.toggle('dn', down);
    if (!down) spr('<div style="font-size:60px;font-weight:800;color:#3dff9a;text-shadow:0 0 16px #3dff9a">+</div>', R.x, 230, R.z, 900, [{ transform: 'translate(-50%,-100%) scale(.5)', opacity: 1 }, { transform: 'translate(-50%,-180%) scale(1.3)', opacity: 0 }]);
  }

  function roleImg(i) {
    const r = data.raiders && data.raiders[i] && data.raiders[i].role;
    return r && LOOK[r] ? '<img class="rp" src="' + art('raider-' + r) + '" alt="" style="border-color:' + LOOK[r].col + '">' : '';
  }
  function board(scores) {
    const b = $('#board'); if (!b || !data) return;
    const order = scores.map((x, i) => i).sort((p, q) => scores[p][0] - scores[q][0] ? scores[q][0] - scores[p][0] : p - q).slice(0, 8);
    raiders.forEach((R) => { const tg = R.tag.firstChild; if (tg) tg.classList.toggle('top', order.indexOf(R.i) > -1 && order.indexOf(R.i) < 3 && scores[R.i][0] > 0); });
    if (order.join() !== scoreOrder.join() || true) {
      scoreOrder = order;
      b.innerHTML = '<div class="bh">TOP RAIDERS</div>' + order.map((i, n) => {
        const c = data.fighters[i], s = scores[i];
        let wp = ''; const mw = Math.min(15, data.maxWeapon || 10); for (let k = 0; k < mw; k++) wp += '<i' + (k < s[2] ? ' class="on"' : '') + '></i>';
        return '<div class="br' + (n === 0 ? ' r1' : '') + (s[1] ? ' dn' : '') + (s[5] ? ' act' : '') + '"><div class="n">' + (n + 1) + '</div>' + avatar(c) + roleImg(i) +
          '<div class="nm">' + esc(c.display) + '<small>' + esc((data.raiders && data.raiders[i] && data.raiders[i].roleLabel) || '') + (s[5] ? ' · FIRING' : ' · idle') + '</small><div class="hpb"><i style="width:' + (s[3] != null ? s[3] : 100) + '%;background:' + ((s[3] != null ? s[3] : 100) > 50 ? '#3dff9a' : (s[3] || 0) > 25 ? '#ffb020' : '#ff4d5e') + '"></i><em style="width:' + Math.min(50, s[4] || 0) + '%"></em></div><div class="wp">' + wp + '</div></div><div class="sc">' + s[0].toLocaleString() + '</div></div>';
      }).join('');
    }
  }

  // ---------------- phases ----------------
  function matchup(a) {
    build(a);
    const r = document.createElement('div');
    r.className = 'roster'; r.id = 'roster';
    r.innerHTML = a.fighters.slice(0, 60).map((c, i) => '<div class="rc" style="animation-delay:' + Math.min(2, i * 0.04) + 's">' + avatar(c) + esc(String(c.display).slice(0, 14)) + '</div>').join('');
    const g = document.createElement('div');
    g.className = 'gear'; g.id = 'gear';
    root.querySelector('.hud').appendChild(r);
    root.querySelector('.hud').appendChild(g);
    const upd = () => {
      const left = Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000));
      g.innerHTML = '<div class="g1">GEAR UP · <b>' + left + 's</b></div><div class="g2">Cheer bits / Kicks / Super Chat with a raider\'s name = more firepower (100 = +1) · no name = SUPPLY DROP for the whole team · raiders: sub for +5. Boosts also work during the fight and pick downed raiders straight back up.</div>' +
        '<div class="crew">' + ROLE_ORDER.map((r) => '<div style="--c:' + LOOK[r].col + '"><img src="' + art('raider-' + r) + '" alt="">' + LOOK[r].name + '</div>').join('') + '</div>';
    };
    upd();
    timers.push(setInterval(upd, 1000));
    setTeam(a.team || 0);
    big('QUEEN RAID', a.accent, 2600, a.fighters.length + ' raider' + (a.fighters.length === 1 ? '' : 's') + ' ready to drop');
    SFX.play('alarm', 0, 1.6); SFX.play('riser', 0.2, 2); SFX.play('boom', 1.8);
  }

  function setTeam(t) {
    const s = $('#sup'), i = $('#supi');
    if (s) s.textContent = '+' + t + '%';
    if (i) i.style.width = (t / ((data && data.maxTeam) || 30) * 100) + '%';
  }

  function boosted(a) {
    if (!root) return;
    if (a.team != null && a.side == null) {
      setTeam(a.team);
      // supply crate on a parachute
      const x = rnd(-500, 500), z = rnd(300, 700);
      const b = sc.sprite('<div style="display:flex;flex-direction:column;align-items:center"><div style="width:140px;height:70px;border-radius:70px 70px 0 0;background:repeating-linear-gradient(90deg,' + data.accent + ' 0 20px,#f2f2f2 20px 40px)"></div><div style="width:2px;height:60px;background:#ccc;box-shadow:-40px 0 #ccc,40px 0 #ccc"></div><div style="width:70px;height:60px;background:linear-gradient(#6a5a3a,#3a2e1e);border:3px solid #ffb020;font:800 16px Barlow Condensed;color:#ffb020;display:flex;align-items:center;justify-content:center">SUPPLY</div></div>', x, 1400, z);
      const t0 = performance.now();
      const step = (now) => { if (!sc) return; const u = Math.min(1, (now - t0) / 2200); sc.moveSprite(b, x + Math.sin(u * 8) * 30, 1400 * (1 - u), z); if (u < 1) requestAnimationFrame(step); else { later(() => sc && sc.removeSprite(b), 600); } };
      requestAnimationFrame(step);
      feed('<span class="y">SUPPLY DROP</span> from ' + esc(a.from || 'chat') + ': team firepower <b>+' + a.team + '%</b>');
      SFX.play('drop'); SFX.play('ding', 0.3);
      return;
    }
    const R = raiders[a.side];
    if (a.revived) { setDown(a.side, false); feed('<span class="g">ADRENALINE!</span> ' + nm(a.side) + ' is back up thanks to chat'); }
    if (a.hp != null && !a.revived) feed('<b>' + nm(a.side) + '</b> healed to full' + (a.shield ? ' + <span class="y">' + a.shield + ' armour</span>' : ''));
    if (a.points) {
      const wName = WEAPONS[Math.max(0, Math.min(WEAPONS.length - 1, a.w || 0))], prevW = R ? R.wlv || 0 : 0;
      feed('<b>' + nm(a.side) + '</b> firepower <span class="y">+' + a.points + '</span>: <b>' + wName + '</b>');
      if (R) { R.wlv = a.w; const tg = R.tag && R.tag.firstChild; if (tg) { let w = tg.querySelector('.wpn'); if (!w) { w = document.createElement('span'); w.className = 'wpn'; tg.appendChild(w); } w.textContent = wName; } }
      if ((a.w || 0) > prevW) weaponBanner(a.side, wName, a.w, a.from);
      if (R) spr('<div class="dmg" style="color:' + data.accent + '">+' + a.points + ' FIREPOWER</div>', R.x, 260, R.z, 1400, [{ transform: 'translate(-50%,-100%)', opacity: 1 }, { transform: 'translate(-50%,-260%)', opacity: 0 }]);
    }
    SFX.play('shield'); SFX.play('ding', 0.1);
  }

  // each firepower level is a named weapon, so chat can see exactly what their support did
  const WEAPONS = ['PISTOL', 'SMG', 'ASSAULT RIFLE', 'COMBAT SHOTGUN', 'MINIGUN', 'GRENADE LAUNCHER', 'RPG LAUNCHER', 'BAZOOKA', 'RAILGUN', 'PLASMA CANNON', 'ORBITAL BEAM'];
  let wupEl = null, wupQ = [], wupT = null;
  function weaponBanner(side, name, lvl, from) {
    wupQ = wupQ.filter((x) => x.side !== side); wupQ.push({ side, name, lvl, from });
    if (!wupT) showWup();
  }
  function showWup() {
    wupT = null;
    const x = wupQ.shift(); if (!x || !root) return;
    if (wupEl) wupEl.remove();
    const f = data.fighters[x.side] || {}, max = data.maxWeapon || 10;
    const av = f.avatar && /^https:\/\//.test(f.avatar) ? '<img src="' + esc(f.avatar) + '" alt="" onerror="this.remove()">' : '';
    const el = document.createElement('div'); el.className = 'wup';
    el.innerHTML = '<div class="wa">' + esc(String(f.display || '?').slice(0, 2).toUpperCase()) + av + '</div><div><div class="w1">' + esc(String(f.display || '').toUpperCase()) + '\'S WEAPON UPGRADED</div><div class="w2">' + esc(x.name) + '</div>' +
      '<div class="w3">' + (x.from && String(x.from).toLowerCase() !== String(f.login || '').toLowerCase() ? 'Thanks to ' + esc(x.from) + ' · ' : '') + 'level ' + x.lvl + ' of ' + max + '</div><div class="wb"><i style="width:' + Math.min(100, x.lvl / max * 100) + '%"></i></div></div>';
    root.querySelector('.hud').appendChild(el); wupEl = el;
    SFX.play('impact'); SFX.play('shield', 0.1); SFX.play('ding', 0.25);
    const R = raiders[x.side]; if (R) { spr('<div class="boom" style="filter:hue-rotate(20deg)"></div>', R.x, 160, R.z, 700, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.1)', opacity: 0 }]); }
    wupT = setTimeout(() => { if (wupEl === el) { el.remove(); wupEl = null; } showWup(); }, 3000);
  }

  // the Queen breaks apart as she weakens: 75%, 50%, 25%
  let qStage = 0;
  function queenDamage(frac) {
    const st = frac <= 0.25 ? 3 : frac <= 0.5 ? 2 : frac <= 0.75 ? 1 : 0;
    if (st <= qStage || !queen) return;
    qStage = st;
    root.classList.remove('qd1', 'qd2', 'qd3'); root.classList.add('qd' + st);
    const fly = st === 3 ? 900 : 700;
    for (let k = 0; k < 3 + st; k++) later(() => explode(rnd(-320, 320), rnd(fly - 300, fly + 250), QZ + rnd(150, 450), k === 0), k * 220);
    for (let k = 0; k < 6 + st * 3; k++) {
      const x = rnd(-300, 300), y = rnd(500, 1000), dx = rnd(-500, 500), dy = rnd(200, 600);
      later(() => spr('<div class="deb"></div>', x, y, QZ + 400, 1600, [{ transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) rotate(' + rnd(-540, 540) + 'deg)', opacity: 0 }]), 150 + k * 40);
    }
    for (let k = 0; k < st * 2; k++) later(() => spr('<div class="smk"></div>', rnd(-250, 250), rnd(600, 1000), QZ + 300, 4000, [{ transform: 'translate(-50%,-50%) scale(.4)', opacity: .9 }, { transform: 'translate(-50%,-150%) scale(2.2)', opacity: 0 }]), k * 400);
    feed('<span class="r">' + (st === 1 ? 'Her armour is cracking!' : st === 2 ? 'She\'s falling apart!' : 'One more push, she\'s nearly done!') + '</span>');
    SFX.play('explosion'); SFX.play('rumble', 0.2, 1.2); flash();
  }

  // raiders celebrate a win: they jump, fist-pump and fire flares into the sky
  function celebrate() {
    raiders.forEach((R, i) => {
      if (R.down) setDown(i, false);
      const base = R.g.style.transform || S3D.pos(R.x, 0, R.z);
      later(() => { try { R.g.animate([{ transform: base }, { transform: 'translateY(-90px) ' + base }, { transform: base }], { duration: 520, iterations: 6, delay: (i % 5) * 90, easing: 'ease-in-out' }); } catch (e) { /* fine */ } }, 200);
      if (i % 2 === 0) for (let k = 0; k < 2; k++) later(() => { const c = ['#ffb020', '#3dff9a', '#ff5a5a', '#4dc3ff'][(i + k) % 4]; spr('<div class="flare" style="--c:' + c + '"></div>', R.x, 220, R.z, 1800, [{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(-50%,-1200px)', opacity: 0.2 }]); SFX.play('whoosh'); }, 600 + k * 900 + i * 60);
    });
    SFX.play('cheer', 0.2, 4); SFX.play('fanfare', 0.4);
  }

  // she wins: a beam sweeps the map and the arena burns
  function wrath() {
    if (!root) return;
    root.classList.add('wrath');
    if (queen) { try { queen.g.animate([{ transform: S3D.pos(0, 0, QZ) }, { transform: S3D.pos(0, 220, QZ) }], { duration: 1200, fill: 'forwards', easing: 'ease-out' }); } catch (e) { /* fine */ } }
    SFX.play('roar'); SFX.play('alarm', 0.4, 2);
    const bm = document.createElement('div'); bm.className = 'beam';
    root.appendChild(bm);
    bm.animate([{ transform: 'translateX(-50%) rotate(55deg)' }, { transform: 'translateX(-50%) rotate(-55deg)' }], { duration: 2400, easing: 'ease-in-out', fill: 'forwards' });
    later(() => bm.remove(), 2600);
    for (let k = 0; k < 14; k++) later(() => explode(rnd(-900, 900), rnd(0, 400), rnd(-400, 900), k % 3 === 0), 300 + k * 160);
    raiders.forEach((R, i) => later(() => setDown(i, true), 500 + i * 90));
    later(() => { flash(); sc && sc.shake(26, 1500); }, 1500);
  }

  function run(a) {
    if (!root) build(a);
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    data = Object.assign({}, data || {}, a);
    ['#roster', '#gear'].forEach((s) => { const e = $(s); if (e) e.remove(); });
    $('#cnd').textContent = '';
    setMap(a.mapId, a.cond);
    $('#mapc').textContent = (a.map || '') + ' · ' + ((a.cond && a.cond.label) || '');
    setTeam(a.team || 0);
    $('#bsub').textContent = a.minis.length + ' ARC machines · Queen strength ' + (a.level || 100) + '%';
    big('DROP!', a.accent, 2000, a.map + ' · ' + ((a.cond && a.cond.label) || ''));
    const hp = $('#ahelp'); if (hp) { hp.style.display = ''; hp.innerHTML = '<b>RAIDERS</b> type <b>!fire</b> (every ' + (a.fireCooldown || 2) + 's, idle = weak) · <b>!grenade</b> every ' + (a.grenadeCd || 25) + 's · <b>!heal</b><br><b>CHAT</b> cheer / sub with a raider\'s name = full heal + armour + firepower · no name = supply drop for everyone'; }
    SFX.play('elevator', 0.1); SFX.play('alarm', 1.2, 1.5);
    sc.to({ dist: 2100, ty: 240, pitch: 8 }, 3000);
    // the swarm arrives
    later(() => {
      minis = a.minis.map((m, k) => makeMini(m, k, a.minis.length));
      incoming(a.minis);
      SFX.play('drone', 0, 2); SFX.play('alarm', 0.4, 1);
      big('CLEAR THE SWARM', '#ff6a3a', 1800);
    }, Math.max(1500, (a.introMs || 6000) - 2500));
    if (a.fighters.length > SHOW) feed('<b>+' + (a.fighters.length - SHOW) + '</b> more raiders fighting off-screen');
    board(a.fighters.map(() => [0, 0, 0]).map((s, i) => [0, 0, (a.raiders[i] && a.raiders[i].w) || 0]));
  }

  function tick(a) {
    if (!root || !data) return;
    if (a.limit) data.timeLimit = a.limit;
    const left = Math.max(0, (data.timeLimit || 180) - a.t);
    const ck = $('#clk'); if (ck) { ck.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); ck.classList.toggle('low', left <= 30); }
    if (left <= 10 && left > 0) SFX.play('tick');
    setTeam(a.team || 0);
    // health bars
    if (a.stage === 1) {
      const alive = a.minis.filter((h) => h > 0).length;
      $('#bnm').textContent = 'CLEAR THE SWARM';
      $('#bsub').textContent = alive + ' / ' + a.minis.length + ' ARC left';
      const tot = data.minis.reduce((s, m) => s + m.max, 0), now = a.minis.reduce((s, h) => s + h, 0);
      $('#hpi').style.width = (now / tot * 100) + '%'; $('#hpw').style.width = (now / tot * 100) + '%';
      a.minis.forEach((h, k) => { const m = minis[k]; if (m && m.bar.firstChild) m.bar.firstChild.firstChild.style.width = (h / m.max * 100) + '%'; });
    } else if (queen) {
      const q = data.queen, Q = a.queen;
      $('#bnm').textContent = 'THE VEYDR QUEEN' + (Q.qp === 3 ? ' · TRUE FORM' : Q.qp === 2 ? ' · ENRAGED' : '');
      $('#bsub').textContent = (Q.shields && Q.shields.length ? Q.shields.length + ' shield' + (Q.shields.length > 1 ? 's' : '') + ' up · ' : '') + (Q.armour > 0 ? Q.plates + ' armour plates left' : Q.qp === 3 ? 'she hits harder the weaker she gets' : 'CORE EXPOSED · crits do double') + (a.extendsLeft != null && data.extendSecs ? ' · cheer "time" for +' + data.extendSecs + 's' : '');
      setShields(Q.shields || []);
      $('#hpi').style.width = (Q.hp / q.max * 100) + '%'; $('#hpw').style.width = (Q.hp / q.max * 100) + '%';
      if (Q.hp > 0) queenDamage(Q.hp / q.max);
      $('#hpa').style.width = (Q.armour / q.max * 100) + '%';
      $('#boss').classList.toggle('rage', !!Q.enraged); root.classList.toggle('rage', !!Q.enraged);
    }
    // shots
    for (const s of a.shots) shoot(s.r, s.m, s.c);
    // raider states
    a.raiders.forEach((r, i) => { if (i < raiders.length) { setDown(i, !!r[1]); const tg = raiders[i].tag.firstChild; if (tg) tg.classList.toggle('el', r[1] === 2); } });
    // events
    for (const e of a.ev) {
      if (e.k === 'kill') {
        const m = minis[e.m];
        if (m && !m.dead) {
          m.dead = true;
          later(() => { explode(m.x, m.y + m.top * 0.4, m.z, m.type === 'quarrymaw' || m.type === 'lantern' || m.type === 'lookout'); m.g.animate([{ opacity: 1 }, { opacity: 0, transform: S3D.pos(m.x, m.y - 40, m.z) + ' rotateZ(40deg) scale(.6)' }], { duration: 500, fill: 'forwards' }); if (sc) sc.removeSprite(m.bar); m.sh.remove(); }, 400);
        }
        feed('<b>' + nm(e.r) + '</b> destroyed a ' + esc((data.minis[e.m] && data.minis[e.m].name) || 'machine'));
      } else if (e.k === 'down') {
        feed('<span class="r">DOWN</span> ' + nm(e.r) + (e.by === 'q' ? ' (the Queen)' : ''));
        if (e.r < raiders.length) SFX.play('down');
      } else if (e.k === 'nade') {
        const [x, y, z] = targetPos(e.m != null ? e.m : 'q');
        later(() => explode(x, y, z, true), 350);
        feed('<span class="y">GRENADE</span> from <b>' + nm(e.r) + '</b>!');
      } else if (e.k === 'heal') {
        const R = raiders[e.r];
        if (R) spr('<div style="font-size:54px;font-weight:800;color:#3dff9a;text-shadow:0 0 14px #3dff9a">+HP</div>', R.x, 240, R.z, 900, [{ transform: 'translate(-50%,-100%) scale(.6)', opacity: 1 }, { transform: 'translate(-50%,-200%) scale(1.2)', opacity: 0 }]);
        feed('<span class="g">HEAL</span> ' + (e.by === e.r ? nm(e.r) + ' patched up' : nm(e.by) + ' healed ' + nm(e.r)));
        SFX.play('shield');
      } else if (e.k === 'revive') {
        if (e.by !== e.r) feed('<span class="g">REVIVE</span> ' + nm(e.by) + ' picked up ' + nm(e.r));
      } else if (e.k === 'phase') {
        queenArrives();
      } else if (e.k === 'plate') {
        breakPlate(e.r, e.left);
      } else if (e.k === 'qphase') {
        queenPhase(e.p);
      } else if (e.k === 'shield') {
        feed('<span class="y">SHIELD UP</span> the Queen raises ' + (e.n > 1 ? e.n + ' energy shields' : 'an energy shield') + '!'); SFX.play('shield'); SFX.play('riser', 0, 0.6);
      } else if (e.k === 'shieldBreak') {
        feed('<b>' + nm(e.r) + '</b> broke a shield!' + (e.left ? ' <span class="y">' + e.left + ' left</span>' : '')); explode(rnd(-300, 300), 700, QZ + 500, false); SFX.play('burst');
      } else if (e.k === 'elim') {
        feed('<span class="r">ELIMINATED</span> ' + nm(e.r) + ' · cheer their name to bring them back'); if (e.r < raiders.length) SFX.play('down', 0.1);
      } else if (e.k === 'extend') {
        big('+' + e.secs + ' SECONDS', '#5ad8ff', 1600, 'Extra time from ' + esc(e.by || 'chat') + (e.left != null ? ' · ' + e.left + ' left' : ''));
        feed('<span class="g">EXTRA TIME</span> +' + e.secs + 's from <b>' + esc(e.by || 'chat') + '</b>'); SFX.play('ding'); SFX.play('riser', 0.1, 0.8);
        const ck = $('#clk'); if (ck) ck.animate([{ transform: 'scale(1.4)', color: '#5ad8ff' }, { transform: 'none' }], { duration: 900 });
      } else if (e.k === 'enrage') {
        big('SHE\'S ENRAGED', '#ff2a2a', 1800, 'Attacks are faster and hit harder');
        SFX.play('roar'); SFX.play('alarm', 0.3, 1.2);
      } else if (e.k === 'qatk') queenAttack(e.type);
      else if (e.k === 'queenDown') queenDown(e.r);
      else if (e.k === 'timeout') { big('TIME\'S UP', '#ff4d5e', 2400, 'The Queen survived'); SFX.play('alarm'); later(wrath, 900); }
      else if (e.k === 'mhit') arcShot(e.m);
    }
    board(a.raiders);
  }

  function queenArrives() {
    big('THE VEYDR QUEEN', '#5ad8ff', 2600, 'Break her armour plates, then destroy the core');
    SFX.play('roar'); SFX.play('riser', 0, 1.6);
    sc.to({ dist: 3700, ty: 860, pitch: 1, tz: -200 }, 2000);
    queen = makeQueen();
    queen.g.animate([{ transform: S3D.pos(0, 3200, QZ) }, { transform: S3D.pos(0, 0, QZ) }], { duration: 1500, easing: 'cubic-bezier(.6,0,.9,.6)' });
    later(() => {
      explode(0, 60, QZ + 300, true); flash();
      queen.g.animate([{ transform: S3D.pos(0, 0, QZ) }, { transform: S3D.pos(0, 30, QZ) }, { transform: S3D.pos(0, 0, QZ) }], { duration: 3600, iterations: Infinity, easing: 'ease-in-out' });
    }, 1500);
    $('#hpa').style.width = (data.queen.armourMax / data.queen.max * 100) + '%';
  }
  function breakPlate(r, left) {
    if (!queen) return;
    const pm = (data.queen && data.queen.plates) || 4;
    const p = queen.plates[Math.max(0, Math.min(3, Math.floor(left / pm * 4)))];
    if (p) {
      explode(rnd(-250, 250), 800, QZ + 480, false);
      p.animate([{ opacity: 1 }, { transform: p.style.transform + ' translate3d(' + rnd(-300, 300) + 'px,600px,400px) rotateX(200deg)', opacity: 0 }], { duration: 1100, fill: 'forwards', easing: 'ease-in' });
    }
    feed('<b>' + nm(r) + '</b> blew off an armour plate! <span class="y">' + left + ' left</span>');
    if (left === 0) { big('CORE EXPOSED', '#ffb020', 1800, 'Crits now do double damage'); SFX.play('burst'); }
  }
  // energy shields: one dome per shield, in front of the Queen
  let shieldEls = [];
  function setShields(list) {
    if (!sc || !queen) return;
    while (shieldEls.length > list.length) { const b = shieldEls.pop(); b.firstChild.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-100%) scale(1.3)' }], { duration: 400, fill: 'forwards' }); setTimeout(() => sc && sc.removeSprite(b), 420); }
    while (shieldEls.length < list.length) {
      const k = shieldEls.length, b = sc.sprite('<div class="qshield" style="transform:translate(-50%,-100%) scale(' + (1 + k * 0.12) + ')"></div>', 0, 0, QZ + 520 + k * 40);
      b.firstChild.animate([{ opacity: 0, transform: 'translate(-50%,-100%) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-100%) scale(' + (1 + k * 0.12) + ')' }], { duration: 500 });
      shieldEls.push(b);
    }
    list.forEach((pct, k) => { const el = shieldEls[k] && shieldEls[k].firstChild; if (el) el.style.opacity = 0.35 + Math.max(0, Math.min(100, pct)) / 100 * 0.65; });
  }
  function queenPhase(p) {
    if (!queen) return;
    if (p === 2) {
      big('SHE IS ENRAGED', '#ff2a2a', 2400, 'Heavy attacks can eliminate raiders');
      SFX.play('roar'); SFX.play('alarm', 0.3, 1.2); sc.shake(18, 1000); flash();
      root.classList.add('rage');
    } else if (p === 3) {
      big('HER TRUE FORM', '#c58bff', 3000, 'She takes flight. The weaker she gets, the harder she hits');
      SFX.play('roar'); SFX.play('riser', 0, 2); SFX.play('explosion', 1.2); flash();
      root.classList.add('trueform');
      // the legs fold away, wings of shards open and she rises into the air
      queen.g.getAnimations().forEach((x) => x.cancel());
      queen.g.querySelectorAll('[data-leg]').forEach((l) => l.animate([{ opacity: 1 }, { opacity: 0, transform: l.style.transform + ' scale3d(1,.2,1)' }], { duration: 1400, fill: 'forwards' }));
      const inner = queen.g.firstChild;
      for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
        const w = S3D.div('s3-plane shard', 'left:-120px;top:-380px;width:240px;height:760px;background:linear-gradient(180deg,#f1e9da,#c58bff 60%,#5a2aa8);opacity:.92');
        w.style.transform = S3D.pos(sx * (480 + k * 40), 700, -40 - k * 30) + ' rotateZ(' + (sx * (60 + k * 18)) + 'deg)';
        w.animate([{ opacity: 0, transform: S3D.pos(sx * 300, 600, 0) + ' rotateZ(0deg) scale(.2)' }, { opacity: 0.92, transform: w.style.transform }], { duration: 1400, delay: 400 + k * 80, fill: 'backwards' });
        inner.appendChild(w);
      }
      queen.g.animate([{ transform: S3D.pos(0, 0, QZ) }, { transform: S3D.pos(0, 700, QZ) }], { duration: 2200, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => {
        if (!queen) return;
        queen.g.animate([{ transform: S3D.pos(-120, 700, QZ) + ' rotateZ(-3deg)' }, { transform: S3D.pos(120, 780, QZ) + ' rotateZ(3deg)' }, { transform: S3D.pos(-120, 700, QZ) + ' rotateZ(-3deg)' }], { duration: 5200, iterations: Infinity, easing: 'ease-in-out' });
      };
      sc.to({ dist: 3900, ty: 1100, pitch: -4 }, 2400);
      queen.flying = true;
    }
  }
  function queenAttack(type) {
    if (!queen) return;
    if (type === 'meteor') {
      feed('<span class="r">CORE METEORS</span> raining down!'); SFX.play('alarm', 0, 0.8);
      for (let k = 0; k < 10; k++) later(() => { const R = raiders[Math.floor(Math.random() * raiders.length)] || { x: 0, z: 400 }; const x = R.x + rnd(-160, 160), z = R.z + rnd(-120, 120);
        const m = sc.sprite('<div style="width:60px;height:60px;border-radius:50%;background:radial-gradient(closest-side,#fff,#ffb020 40%,#ff3a1a 70%,transparent);box-shadow:0 0 40px 14px #ff5a1a"></div>', x, 1600, z);
        const t0 = performance.now(); const step = (now) => { if (!sc) return; const u = Math.min(1, (now - t0) / 500); sc.moveSprite(m, x, 1600 * (1 - u), z); if (u < 1) requestAnimationFrame(step); else { sc.removeSprite(m); explode(x, 30, z, true); } }; requestAnimationFrame(step); }, 200 + k * 180);
      return;
    }
    if (type === 'overload') {
      feed('<span class="r">OVERLOAD</span> pulse from the core!'); SFX.play('laser'); SFX.play('explosion', 0.6);
      const ring = S3D.plane(400, 400, { y: 6, z: QZ + 300, bg: 'radial-gradient(closest-side,transparent 55%,rgba(255,60,40,.9) 66%,rgba(255,200,120,.7) 72%,transparent 80%)' });
      sc.add(ring);
      ring.animate([{ transform: S3D.pos(0, 6, QZ + 300) + ' rotateX(90deg) scale(.4)', opacity: 1 }, { transform: S3D.pos(0, 6, -300) + ' rotateX(90deg) scale(12)', opacity: 0 }], { duration: 1500, easing: 'ease-out' }).onfinish = () => ring.remove();
      flash(); sc.shake(22, 1100); return;
    }
    if (type === 'dive') {
      feed('<span class="r">SKY DIVE</span> she swoops at the squad!'); SFX.play('whoosh'); SFX.play('explosion', 0.8);
      queen.g.animate([{ transform: S3D.pos(0, 720, QZ) }, { transform: S3D.pos(0, 180, QZ + 900) }, { transform: S3D.pos(0, 720, QZ) }], { duration: 1600, easing: 'ease-in-out', composite: 'replace' });
      later(() => { explode(rnd(-400, 400), 40, 500, true); sc.shake(20, 900); }, 800); return;
    }
    if (type === 'storm') {
      feed('<span class="r">SHARD STORM</span>!'); SFX.play('laser'); SFX.play('laser', 0.2); SFX.play('laser', 0.4);
      for (let k = 0; k < 16; k++) later(() => { const R = raiders[Math.floor(Math.random() * raiders.length)] || { x: 0, z: 400 }; spr('<div class="spk" style="background:radial-gradient(closest-side,#fff,#c58bff 40%,rgba(120,0,255,.4) 65%,transparent)"></div>', R.x + rnd(-80, 80), 60, R.z, 400, [{ transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }]); }, k * 90);
      return;
    }
    if (!queen) return;
    if (type === 'sweep') {
      feed('<span class="r">LASER SWEEP</span> incoming!');
      SFX.play('laser'); SFX.play('laser', 0.4);
      const beam = S3D.wall(5000, 26, { y: 120, z: 600, bg: 'transparent', html: '<div class="laser" style="width:100%;height:100%"></div>' });
      sc.add(beam);
      beam.animate([{ transform: S3D.pos(0, 120, -800), opacity: 0 }, { opacity: 1, offset: 0.1 }, { transform: S3D.pos(0, 120, 1100), opacity: 1, offset: 0.9 }, { opacity: 0, transform: S3D.pos(0, 120, 1200) }], { duration: 1300, easing: 'ease-in-out' }).onfinish = () => beam.remove();
    } else if (type === 'mortar') {
      feed('<span class="r">MORTAR BARRAGE</span>!');
      for (let k = 0; k < 6; k++) later(() => { const R = raiders[Math.floor(Math.random() * raiders.length)] || { x: 0, z: 400 }; explode(R.x + rnd(-120, 120), 40, R.z + rnd(-120, 120), false); }, 300 + k * 220);
    } else {
      feed('<span class="r">GROUND SLAM</span>!');
      SFX.play('thud'); SFX.play('boom', 0.1);
      const ring = S3D.plane(400, 400, { y: 4, z: QZ + 300, bg: 'radial-gradient(closest-side,transparent 60%,rgba(255,170,90,.8) 70%,transparent 80%)' });
      sc.add(ring);
      ring.animate([{ transform: S3D.pos(0, 4, QZ + 300) + ' rotateX(90deg) scale(.5)', opacity: 1 }, { transform: S3D.pos(0, 4, -600) + ' rotateX(90deg) scale(9)', opacity: 0 }], { duration: 1200, easing: 'ease-out' }).onfinish = () => ring.remove();
      sc.shake(16, 900);
    }
  }
  function queenDown(r) {
    // slow motion: the core overloads, white flash, a chain of blasts, a shockwave, then she crashes down
    root.classList.remove('qd1', 'qd2'); root.classList.add('qd3');
    SFX.play('riser', 0, 1); SFX.play('rumble', 0, 1.4);
    if (sc) sc.shake(8, 1000);
    later(() => { flash(); flash(); big('QUEEN DOWN!', data.accent, 3600, nm(r) + ' landed the final shot'); SFX.play('explosion'); SFX.play('boom', 0.1); }, 700);
    for (let k = 0; k < 12; k++) later(() => explode(rnd(-650, 650), rnd(350, 1250), QZ + rnd(0, 450), k % 2 === 0), 800 + k * 170);
    later(() => spr('<div class="shock"></div>', 0, 120, QZ + 500, 1400, [{ transform: 'translate(-50%,-50%) rotateX(80deg) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) rotateX(80deg) scale(9)', opacity: 0 }]), 1200);
    for (let k = 0; k < 18; k++) { const dx = rnd(-900, 900), dy = rnd(200, 700); later(() => spr('<div class="deb"></div>', rnd(-200, 200), rnd(600, 1000), QZ + 400, 1900, [{ transform: 'translate(-50%,-50%) rotate(0) scale(1.4)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + dx + 'px),calc(-50% + ' + dy + 'px)) rotate(' + rnd(-720, 720) + 'deg)', opacity: 0 }]), 900 + k * 30); }
    later(() => { for (let k = 0; k < 6; k++) spr('<div class="smk"></div>', rnd(-700, 700), rnd(0, 200), QZ + rnd(0, 600), 5000, [{ transform: 'translate(-50%,-50%) scale(.6)', opacity: .9 }, { transform: 'translate(-50%,-120%) scale(3)', opacity: 0 }]); }, 2600);
    later(celebrate, 2900);
    SFX.play('fanfare', 1.2);
    later(() => { if (queen) { queen.g.getAnimations().forEach((x) => x.cancel()); queen.g.animate([{ transform: S3D.pos(0, 0, QZ) }, { transform: S3D.pos(0, -450, QZ) + ' rotateZ(-14deg) rotateX(8deg)' }], { duration: 1600, fill: 'forwards', easing: 'ease-in' }); } }, 600);
    later(() => { flash(); sc && sc.shake(20, 1200); }, 1900);
  }

  function result(a) {
    if (!root) build(a);
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    const f = a.fighters, top = a.ranking.slice(0, 5), mvp = f[a.mvp];
    const T = BBR.tier(mvp.tier, data.accent);
    const res = document.createElement('div');
    res.className = 'res';
    const mm = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    const pct = Math.round(a.queenLeft / a.queenMax * 100);
    const rest = a.win ? 'Everyone else who scored: +' + ((data.points && data.points.win.rest) || 1) + ' card point.' : '';
    res.innerHTML = '<div class="' + BBR.wrapClass(mvp.tier) + '"><div style="width:260px;height:380px;transform-style:preserve-3d;animation:cardIn 1s cubic-bezier(.2,.8,.2,1) both">' + BBR.render(Object.assign({}, mvp, { ribbon: 'MVP' }), { accent: data.accent }) + '</div></div>' +
      '<div><div class="rk">' + (a.win ? 'QUEEN DOWN · ' + mm(a.time) : 'RAID FAILED') + '</div><div class="rh" style="color:' + (a.win ? '#fff' : '#ff6a75') + '">' + (a.win ? 'RAID COMPLETE' : 'THE QUEEN SURVIVED') + '</div>' +
      '<div class="rd">' + (a.win ? 'MVP <b style="color:' + T.color + '">' + esc(mvp.display) + '</b> led ' + f.length + ' raider' + (f.length === 1 ? '' : 's') + ' to victory. ' + rest : 'She had ' + pct + '% health left. Top raider still earns +' + ((a.ranking[0] && a.ranking[0].pts) || 1) + '.') + '</div>' +
      '<div class="tl">' + top.map((r, n) => '<div class="tr"><span>' + (n + 1) + '.</span>' + esc(f[r.i].display) + ' <em>' + r.score.toLocaleString() + ' pts · ' + r.kills + ' kills · ' + r.revives + ' revives</em>' + (r.pts ? ' <span>+' + r.pts + '</span>' : '') + '</div>').join('') + '</div></div>';
    if (a.win) for (let i = 0; i < 80; i++) { const c = document.createElement('div'); c.className = 'conf'; c.style.left = Math.random() * W + 'px'; c.style.background = [data.accent, T.color, '#fff', '#ffb020'][i % 4]; c.style.animationDuration = (2.2 + Math.random() * 2.5) + 's'; c.style.animationDelay = (Math.random() * 1.2) + 's'; res.appendChild(c); }
    later(() => { if (!root) return; root.querySelector('.hud').appendChild(res); if (a.win) { SFX.play('impact'); SFX.play('fanfare', 0.15); SFX.tierFx(mvp.tier, 0.8); } else { SFX.play('down'); SFX.play('ooh', 0.2); } }, a.win ? 3200 : 2400);
    later(() => { if (root) root.classList.add('out'); }, a.outroMs - 700);
    later(() => { clear(); if (onDone) onDone(); }, a.outroMs);
  }

  return { init: (o) => { stage = o.stage; onDone = o.done; }, matchup, boosted, run, tick, result, clear, active: () => !!root };
})();
