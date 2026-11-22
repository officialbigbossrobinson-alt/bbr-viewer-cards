/* BOSS BLOOD PRESSURE: the medical-monitor meter on the overlay, and the MELTDOWN moment. Moves with the layout editor ("Blood pressure meter"). */
window.BPM = (function () {
  let stage = null, el = null, st = null, shown = { sys: 0, dia: 0 }, anim = null;
  const CSS = `
  .xbp{position:absolute;left:1540px;top:500px;width:340px;font-family:'Barlow Condensed',sans-serif;color:#f6f7fa;z-index:4;background:rgba(6,10,20,.94);border:2px solid var(--bc,#3dff9a);box-shadow:0 10px 30px rgba(0,0,0,.5),0 0 22px color-mix(in srgb,var(--bc,#3dff9a) 35%,transparent);transform-origin:0 0;transition:border-color .5s,box-shadow .5s}
  #stage.no-bp .xbp{display:none}
  .xbp .hd{display:flex;align-items:stretch;height:30px}
  .xbp .hd b{background:#e3132c;font-size:16px;letter-spacing:3px;padding:0 10px;display:flex;align-items:center}
  .xbp .hd span{flex:1;background:#0d2459;font-size:13px;letter-spacing:2px;padding:0 10px;display:flex;align-items:center;justify-content:space-between;font-weight:700}
  .xbp .hd svg{width:18px;height:18px;animation:bpBeat var(--beat,1s) infinite}
  .xbp .rd{display:flex;align-items:flex-end;gap:10px;padding:6px 12px 0}
  .xbp .big{font-size:52px;white-space:nowrap;font-weight:800;line-height:.9;color:var(--bc);font-variant-numeric:tabular-nums;letter-spacing:1px;text-shadow:0 0 14px color-mix(in srgb,var(--bc) 50%,transparent)}
  .xbp .big small{font-size:16px;color:#a7b0ba;letter-spacing:1px;margin-left:4px}
  .xbp .hr{margin-left:auto;text-align:right;font-size:14px;color:#a7b0ba;letter-spacing:2px;line-height:1}
  .xbp .hr b{display:block;font-size:30px;color:#f6f7fa;letter-spacing:0}
  .xbp .ecg{height:34px;margin:2px 0;overflow:hidden;position:relative}
  .xbp .ecg svg{position:absolute;left:0;top:0;width:680px;height:34px;animation:bpScroll var(--scroll,3s) linear infinite}
  .xbp .ft{display:flex;align-items:center;gap:8px;padding:0 12px 8px}
  .xbp .bar{flex:1;display:grid;grid-template-columns:repeat(20,1fr);gap:2px;height:12px}
  .xbp .bar i{background:rgba(255,255,255,.12)}
  .xbp .lv{font-size:18px;font-weight:800;letter-spacing:2px;padding:0 8px;background:var(--bc);color:#061233;min-width:92px;text-align:center}
  .xbp.hot{animation:bpShake .25s infinite}
  .xbp .chg{position:absolute;right:6px;top:-34px;font-size:28px;font-weight:800;opacity:0;text-shadow:0 2px 8px rgba(0,0,0,.8)}
  .xbp .chg.go{animation:bpChg 1.6s ease-out}
  .xbp .stm{position:absolute;left:0;right:0;top:-30px;height:40px;pointer-events:none;display:none}
  .xbp.boil .stm{display:block}
  .xbp .stm i{position:absolute;bottom:0;width:26px;height:26px;border-radius:50%;background:rgba(235,240,245,.55);filter:blur(6px);animation:bpSteam 2.2s ease-out infinite}
  @keyframes bpBeat{0%,100%{transform:scale(1)}15%{transform:scale(1.35)}30%{transform:scale(1)}}
  @keyframes bpScroll{from{transform:translateX(0)}to{transform:translateX(-340px)}}
  @keyframes bpShake{0%{transform:translate(0,0)}25%{transform:translate(1px,-1px)}50%{transform:translate(-1px,1px)}75%{transform:translate(1px,1px)}}
  @keyframes bpChg{0%{opacity:0;transform:translateY(10px)}15%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0;transform:translateY(-14px)}}
  @keyframes bpSteam{from{transform:translateY(0) scale(.5);opacity:.9}to{transform:translateY(-60px) scale(1.8);opacity:0}}
  .bpmelt{position:absolute;inset:0;z-index:60;pointer-events:none;overflow:hidden}
  .bpmelt .vg{position:absolute;inset:0;box-shadow:inset 0 0 260px 60px rgba(255,23,68,.85);animation:bpVg .5s ease-in-out 12 alternate}
  .bpmelt .bn{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%) rotate(-4deg);display:flex;flex-direction:column;align-items:center;animation:bpIn .5s cubic-bezier(.2,1.6,.4,1) both}
  .bpmelt .bn b{background:#ff1744;font-size:190px;font-weight:800;letter-spacing:10px;padding:0 40px;line-height:1.05;font-family:'Barlow Condensed',sans-serif;color:#fff;box-shadow:0 20px 70px rgba(0,0,0,.6)}
  .bpmelt .bn span{background:#f6f7fa;color:#061233;font-family:'Barlow Condensed',sans-serif;font-size:38px;font-weight:800;letter-spacing:6px;padding:4px 24px}
  .bpmelt .sm{position:absolute;bottom:-60px;width:180px;height:180px;border-radius:50%;background:rgba(230,235,240,.5);filter:blur(30px);animation:bpRise 3.4s ease-out forwards}
  @keyframes bpVg{from{opacity:.35}to{opacity:1}}
  @keyframes bpIn{from{transform:translate(-50%,-50%) rotate(-4deg) scale(2.4);opacity:0}to{transform:translate(-50%,-50%) rotate(-4deg) scale(1);opacity:1}}
  @keyframes bpRise{from{transform:translateY(0) scale(.6);opacity:.9}to{transform:translateY(-900px) scale(2.4);opacity:0}}`;
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5 18.8 5 21 8.3 19.5 11.8 17.5 16.4 12 21 12 21z" fill="#ff3b5c"/></svg>';
  function ecgPath(v) {
    // one beat every 85px; taller spikes when wound up
    const h = 8 + v * 0.18; let d = 'M0 20';
    for (let x = 0; x < 680; x += 85) d += ' L' + (x + 30) + ' 20 L' + (x + 36) + ' ' + (20 - 3) + ' L' + (x + 42) + ' 20 L' + (x + 47) + ' ' + (20 + 4) + ' L' + (x + 52) + ' ' + Math.max(1, 20 - h) + ' L' + (x + 57) + ' ' + Math.min(33, 22 + h * 0.35) + ' L' + (x + 62) + ' 20 L' + (x + 85) + ' 20';
    return d;
  }
  function css() { if (!document.getElementById('bp-css')) { const s = document.createElement('style'); s.id = 'bp-css'; s.textContent = CSS; document.head.appendChild(s); } }
  function draw(a) {
    css();
    if (!a.on) { if (el) { el.remove(); el = null; } return; }
    if (!el) {
      el = document.createElement('div'); el.className = 'xbp';
      el.innerHTML = '<div class="stm"><i style="left:20%"></i><i style="left:50%;animation-delay:.7s"></i><i style="left:78%;animation-delay:1.4s"></i></div><div class="hd"><b>BOSS</b><span>BLOOD PRESSURE ' + HEART + '</span></div>' +
        '<div class="rd"><div class="big"><span class="n">--/--</span><small>mmHg</small></div><div class="hr">BPM<b class="bpm">--</b></div></div>' +
        '<div class="ecg"><svg viewBox="0 0 680 34" preserveAspectRatio="none" aria-hidden="true"><path class="ep" fill="none" stroke-width="2.4" stroke-linejoin="round"/></svg></div>' +
        '<div class="ft"><div class="bar">' + '<i></i>'.repeat(20) + '</div><span class="lv">--</span></div><span class="chg"></span>';
      stage.appendChild(el);
    }
    el.style.setProperty('--bc', a.color);
    el.style.setProperty('--beat', (60 / Math.max(40, a.bpm)).toFixed(2) + 's');
    el.style.setProperty('--scroll', Math.max(0.8, 4.2 - a.v * 0.032).toFixed(2) + 's');
    el.querySelector('.ep').setAttribute('d', ecgPath(a.v)); el.querySelector('.ep').setAttribute('stroke', a.color);
    el.querySelector('.bpm').textContent = a.bpm;
    el.querySelector('.lv').textContent = a.level;
    el.querySelectorAll('.bar i').forEach((x, i) => { x.style.background = i < Math.round(a.v / 5) ? a.color : ''; });
    el.classList.toggle('hot', a.v >= 80); el.classList.toggle('boil', a.v >= 80);
    // the numbers roll to the new reading
    cancelAnimationFrame(anim);
    const from = Object.assign({}, shown), t0 = performance.now(), n = el.querySelector('.n');
    const step = (now) => { const u = Math.min(1, (now - t0) / 700); shown = { sys: Math.round(from.sys + (a.sys - from.sys) * u), dia: Math.round(from.dia + (a.dia - from.dia) * u) }; n.textContent = (shown.sys || a.sys) + '/' + (shown.dia || a.dia); if (u < 1) anim = requestAnimationFrame(step); };
    if (!from.sys) { shown = { sys: a.sys, dia: a.dia }; n.textContent = a.sys + '/' + a.dia; } else anim = requestAnimationFrame(step);
    if (a.change) {
      const c = el.querySelector('.chg'); c.textContent = (a.change > 0 ? '+' : '') + a.change; c.style.color = a.change > 0 ? '#ff5d6c' : '#3dff9a';
      c.classList.remove('go'); void c.offsetWidth; c.classList.add('go');
      try { if (a.change > 0) { SFX.play('thud'); if (a.levelUp) { SFX.play('boom', 0.1); SFX.play('ooh', 0.3); } } else SFX.play('ding'); } catch (e) { /* no audio */ }
    }
    if (a.meltdown && a.meltFx) melt();
  }
  function melt() {
    const m = document.createElement('div'); m.className = 'bpmelt';
    let h = '<div class="vg"></div><div class="bn"><b>MELTDOWN</b><span>THE BOSS HAS LOST IT</span></div>';
    for (let i = 0; i < 9; i++) h += '<div class="sm" style="left:' + (i * 230 - 40) + 'px;animation-delay:' + (i * 0.25).toFixed(2) + 's"></div>';
    m.innerHTML = h; stage.appendChild(m);
    try { SFX.play('alarm', 0, 3); SFX.play('boom', 0.2); SFX.play('ooh', 0.6); SFX.play('cheer', 1.2, 2); } catch (e) { /* no audio */ }
    setTimeout(() => m.remove(), 6500);
  }
  return { init: (o) => { stage = o.stage; }, event: (a) => { st = a; draw(a); } };
})();
