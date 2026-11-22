// Raid Night on the overlay: the pill + War Chest bars all stream, the scout drone (!shoot), the Queen's taunt,
// and the briefing screen (countdown, intel, !enlist roll call).
window.RN = (function () {
  let stage = null, pill = null, st = null, drone = null, brief = null, briefIv = null;
  const esc = (s) => BBR.esc(s);
  const PUR = '#c58bff';
  const CSS = `
  .rnp{position:absolute;top:64px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:6px 14px 6px 8px;border-radius:999px;background:rgba(10,12,15,.9);border:2px solid ${PUR};font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;z-index:4;transition:opacity .5s;box-shadow:0 0 24px rgba(197,139,255,.35)}
  .rnp.hid{opacity:0}
  .rnp.awake{border-color:#ff3b3b;box-shadow:0 0 30px rgba(255,59,59,.55);animation:rnAw 1.4s ease-in-out infinite}.rnp.awake .k{color:#ff6b6b}
  @keyframes rnAw{50%{box-shadow:0 0 50px rgba(255,59,59,.85)}}
  .rnp .q{width:30px;height:30px;border-radius:50%;background:${PUR};display:flex;align-items:center;justify-content:center}
  .rnp .k{font-size:18px;font-weight:800;letter-spacing:2px;color:${PUR};white-space:nowrap}
  .rnp .k b{color:#fff}
  .rnp .bars{display:flex;gap:10px}
  .rnp .bw{display:flex;flex-direction:column;gap:2px;width:108px}
  .rnp .bw span{font-size:11px;letter-spacing:1.5px;color:#c9d0d7;white-space:nowrap}
  .rnp .bw i{display:block;height:6px;border-radius:3px;background:rgba(255,255,255,.15);overflow:hidden}
  .rnp .bw i b{display:block;height:100%;transition:width .8s}
  .rnp.pop{animation:rnPop .6s}
  @keyframes rnPop{40%{transform:translateX(-50%) scale(1.12)}}
  .rnd{position:absolute;left:0;top:150px;width:1920px;height:300px;pointer-events:none;z-index:8;font-family:'Barlow Condensed',sans-serif;color:#fff}
  .rnd .dr{position:absolute;top:40px;left:-260px;width:220px;animation:rnFly 30s linear forwards}
  @keyframes rnFly{0%{left:-260px;top:40px}25%{top:90px}50%{top:30px}75%{top:100px}100%{left:1960px;top:50px}}
  .rnd .dr svg{animation:rnBob .6s ease-in-out infinite alternate;display:block}
  @keyframes rnBob{to{transform:translateY(10px) rotate(-3deg)}}
  .rnd .bx{position:absolute;left:50%;top:190px;transform:translateX(-50%);padding:10px 22px;border-radius:14px;background:rgba(10,12,15,.92);border:3px solid #ffb020;text-align:center;white-space:nowrap}
  .rnd .bx .a{font-size:38px;font-weight:800;letter-spacing:3px;color:#ffb020;line-height:1}
  .rnd .bx .b{font-size:22px;font-weight:700}
  .rnd .bx .m{height:10px;border-radius:5px;background:rgba(255,255,255,.15);margin-top:6px;overflow:hidden}.rnd .bx .m b{display:block;height:100%;background:#ffb020;transition:width .3s}
  .rnd .boom{position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(#fff,#ffb020 30%,#ff4d1a 55%,transparent 70%);animation:rnBoom .9s ease-out forwards}
  @keyframes rnBoom{from{transform:scale(.2);opacity:1}to{transform:scale(2.2);opacity:0}}
  .rnt{position:absolute;inset:0;pointer-events:none;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;color:#fff;background:radial-gradient(ellipse at center,rgba(60,0,90,.55),rgba(10,0,20,.85));animation:rnFlick 7s forwards}
  @keyframes rnFlick{0%{opacity:0}4%{opacity:1}6%{opacity:.3}8%{opacity:1}88%{opacity:1}100%{opacity:0}}
  .rnt .a{font-size:26px;letter-spacing:10px;color:${PUR};font-weight:700}
  .rnt .b{font-size:84px;font-weight:800;line-height:1;text-shadow:0 0 40px ${PUR};text-align:center;max-width:1500px}
  .rnt .c{font-family:Inter,sans-serif;font-size:24px;margin-top:16px;color:#e6dcff}
  .rnb{position:absolute;left:160px;top:120px;width:1600px;height:840px;border-radius:24px;background:linear-gradient(160deg,rgba(18,10,30,.96),rgba(6,4,12,.97));border:3px solid ${PUR};box-shadow:0 0 80px rgba(197,139,255,.35);z-index:7;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto 1fr;gap:20px 30px;padding:34px 44px;box-sizing:border-box;animation:rnIn .7s cubic-bezier(.2,.9,.3,1.1) both;overflow:hidden}
  @keyframes rnIn{from{opacity:0;transform:scale(.92)}}
  .rnb .hd{grid-column:1/3;display:flex;align-items:center;gap:24px}
  .rnb .hd .t1{font-size:22px;letter-spacing:10px;color:${PUR};font-weight:700}
  .rnb .hd .t2{font-size:76px;font-weight:800;line-height:.95}
  .rnb .cd{margin-left:auto;text-align:right}
  .rnb .cd .n{font-size:120px;font-weight:800;line-height:.9;font-variant-numeric:tabular-nums;color:#fff;text-shadow:0 0 30px ${PUR}}
  .rnb .cd .l{font-size:18px;letter-spacing:6px;color:#c9d0d7}
  .rnb .pn{background:rgba(255,255,255,.04);border:1px solid rgba(197,139,255,.3);border-radius:16px;padding:18px 22px;display:flex;flex-direction:column;gap:12px;min-height:0}
  .rnb .pn h3{margin:0;font-size:24px;letter-spacing:5px;color:${PUR}}
  .rnb .row{display:flex;justify-content:space-between;align-items:baseline;font-size:26px;font-weight:700}
  .rnb .row span{font-family:Inter,sans-serif;font-size:17px;font-weight:500;color:#c9d0d7}
  .rnb .bar{height:14px;border-radius:7px;background:rgba(255,255,255,.12);overflow:hidden}.rnb .bar b{display:block;height:100%}
  .rnb .names{display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start;overflow:hidden;flex:1}
  .rnb .names i{font-style:normal;padding:4px 12px;border-radius:8px;background:rgba(197,139,255,.18);border:1px solid rgba(197,139,255,.5);font-size:22px;font-weight:700;animation:rnName .5s both}
  @keyframes rnName{from{opacity:0;transform:scale(1.5)}}
  .rnb .cta{font-size:44px;font-weight:800;letter-spacing:3px;text-align:center;padding:10px;border-radius:12px;background:${PUR};color:#12081e}
  `;
  const QUEEN = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-2-10-4 4-3-7-3 7-4-4z" fill="#0b0d10"/></svg>';
  const DRONE = '<svg width="220" height="110" viewBox="0 0 220 110" aria-hidden="true"><rect x="10" y="14" width="70" height="8" rx="4" fill="#9aa4af"/><rect x="140" y="14" width="70" height="8" rx="4" fill="#9aa4af"/><path d="M60 30 h100 l-14 40 h-72z" fill="#2a3038" stroke="#ff4d5e" stroke-width="3"/><circle cx="110" cy="52" r="12" fill="#ff4d5e"/><circle cx="110" cy="52" r="5" fill="#fff"/><path d="M45 22 L60 34 M175 22 L160 34" stroke="#9aa4af" stroke-width="5"/><path d="M80 70 L72 96 M140 70 L148 96" stroke="#2a3038" stroke-width="5"/></svg>';
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const hm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  function init(o) { stage = o.stage; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); setInterval(tick, 1000); }
  function tick() {
    if (pill) pill.classList.toggle('hid', !!stage.querySelector('.aarena,.rarena,.pen,.scr,.rnb,.rnt,.lbb'));
    if (st && st.stage === 'ready' && st.startAt) { const t = document.getElementById('rnPillT'); if (t) t.textContent = '· ' + mmss(Math.max(0, st.startAt - Date.now())); }
    if (brief && brief.endsAt) { const n = brief.el.querySelector('#rnCd'); if (n) n.textContent = mmss(brief.endsAt - Date.now()); }
  }
  function bar(v, cap, col) { return '<b style="width:' + Math.min(100, Math.round(100 * v / cap)) + '%;background:' + col + '"></b>'; }
  function drawPill() {
    if (!st || !st.on || st.stage === 'done') { if (pill) { pill.remove(); pill = null; } return; }
    if (!pill) { pill = document.createElement('div'); pill.className = 'rnp'; stage.appendChild(pill); }
    const C = st.chest || { armour: 0, fire: 0, time: 0 }, K = st.cap;
    const awake = st.stage === 'ready', left = st.startAt ? Math.max(0, Math.ceil((st.startAt - Date.now()) / 1000)) : null;
    const k = awake ? (st.afterGame ? 'QUEEN AWAKE <b>· AFTER THIS GAME</b>' : left != null ? 'QUEEN AWAKE <b id="rnPillT">· ' + mmss(left * 1000) + '</b>' : 'QUEEN AWAKE <b>· SOON</b>')
      : st.stage === 'briefing' || st.stage === 'raid' ? 'RAID NIGHT <b>· NOW</b>'
      : st.viewers != null ? 'QUEEN AT <b>' + st.need + '</b>' : 'RAID NIGHT';
    pill.classList.toggle('awake', awake);
    pill.innerHTML = '<div class="q">' + QUEEN + '</div><div class="k">' + k + '</div>' + (!awake && st.viewers != null && st.stage !== 'briefing' && st.stage !== 'raid' ? '<div class="bw" style="width:84px"><span>VIEWERS ' + st.viewers + '</span><i>' + bar(st.viewers, st.need, PUR) + '</i></div>' : '') + '<div class="bars">' +
      '<div class="bw"><span>ARMOUR ' + C.armour + '</span><i>' + bar(C.armour, K.armour, '#4dc3ff') + '</i></div>' +
      '<div class="bw"><span>FIREPOWER ' + C.fire + '</span><i>' + bar(C.fire, K.fire, '#ff7a3a') + '</i></div>' +
      '<div class="bw"><span>TIME +' + C.time + 's</span><i>' + bar(C.time, K.time, '#3dff9a') + '</i></div></div>';
  }
  function event(a) {
    if (!stage) return;
    if (a.kind === 'state') { st = a; drawPill(); return; }
    if (a.kind === 'chest') { if (st) { st.chest = a.chest; drawPill(); if (pill) { pill.classList.remove('pop'); void pill.offsetWidth; pill.classList.add('pop'); } } if (brief) briefChest(a.chest, a.cap); SFX.play('ding', 0, 0.5); return; }
    if (a.kind === 'taunt') {
      const el = document.createElement('div'); el.className = 'rnt';
      el.innerHTML = '<div class="a">THE QUEEN STIRS</div><div class="b">"' + esc(a.line) + '"</div><div class="c">' + (a.need ? 'She comes out at ' + a.need + ' viewers' + (a.viewers != null ? ' (' + a.viewers + ' now)' : '') + ' · share the stream!' : 'Fill the War Chest') + '</div>';
      stage.appendChild(el); setTimeout(() => el.remove(), 7100);
      SFX.play('roar'); SFX.play('thunder', 0.4); SFX.play('alarm', 1, 1);
      return;
    }
    if (a.kind === 'awake') {
      const el = document.createElement('div'); el.className = 'rnt';
      el.innerHTML = '<div class="a">THE QUEEN IS AWAKE</div><div class="b">' + (a.viewers ? a.viewers + ' raiders on stream' : 'The stream is busy enough') + '</div><div class="c">' + (a.startAt ? 'Raid Night briefing in ' + mmss(a.startAt - Date.now()) : 'Raid Night is coming') + ' · fill the War Chest</div>';
      stage.appendChild(el); setTimeout(() => el.remove(), 7100);
      SFX.play('roar'); SFX.play('alarm', 0.3, 2); SFX.play('thunder', 0.6);
      return;
    }
    if (a.kind === 'drone') return droneEv(a);
    if (a.kind === 'briefing') return showBrief(a);
    if (a.kind === 'enlist') { if (brief) { const box = brief.el.querySelector('#rnNames'); if (box) { const i = document.createElement('i'); i.textContent = a.display; box.appendChild(i); } const n = brief.el.querySelector('#rnN'); if (n) n.textContent = a.n; SFX.play('pop'); } return; }
    if (a.kind === 'launch' || a.kind === 'cancel') { closeBrief(); return; }
    if (a.kind === 'result') { if (st) { st.stage = 'done'; drawPill(); } return; }
  }
  function droneEv(a) {
    if (a.phase === 'start') {
      if (drone) drone.remove();
      drone = document.createElement('div'); drone.className = 'rnd';
      drone.innerHTML = '<div class="dr">' + DRONE + '</div><div class="bx"><div class="a">SCOUT DRONE · TYPE !shoot</div><div class="b"><span id="rnH">0</span> / ' + a.need + ' hits · <span id="rnT">' + a.secs + '</span>s</div><div class="m"><b id="rnM" style="width:0%"></b></div></div>';
      stage.appendChild(drone);
      const end = a.endsAt; const iv = setInterval(() => { const t = drone && drone.querySelector('#rnT'); if (!t) return clearInterval(iv); t.textContent = Math.max(0, Math.ceil((end - Date.now()) / 1000)); }, 500);
      SFX.play('alarm', 0, 1.2); SFX.play('whoosh', 0.5);
    } else if (a.phase === 'hit' && drone) {
      const h = drone.querySelector('#rnH'); if (h) h.textContent = a.hits;
      const m = drone.querySelector('#rnM'); if (m) m.style.width = Math.min(100, 100 * a.hits / a.need) + '%';
      SFX.play('shot', 0, 0.3);
    } else if (a.phase === 'end' && drone) {
      const d = drone, dr = d.querySelector('.dr'), bx = d.querySelector('.bx');
      if (a.down && dr) {
        const r = dr.getBoundingClientRect(), s = stage.getBoundingClientRect(), k = 1920 / (s.width || 1920);
        const b = document.createElement('div'); b.className = 'boom'; b.style.left = ((r.left - s.left) * k - 40) + 'px'; b.style.top = ((r.top - s.top) * k - 150 - 100) + 'px'; d.appendChild(b);
        dr.remove(); SFX.play('boom'); SFX.play('cheer', 0.2, 1.5);
      } else SFX.play('whoosh');
      if (bx) bx.innerHTML = '<div class="a">' + (a.down ? 'DRONE DOWN!' : 'IT GOT AWAY') + '</div><div class="b">' + (a.down ? '+' + a.add + ' firepower in the War Chest' : a.hits + ' of ' + a.need + ' hits') + '</div>';
      setTimeout(() => { d.remove(); if (drone === d) drone = null; }, 3500);
      if (a.chest && st) { st.chest = a.chest; drawPill(); }
    }
  }
  function briefChest(C, K) {
    if (!brief) return;
    const p = brief.el.querySelector('#rnChest'); if (!p) return;
    p.innerHTML = '<div class="row">Armour <span>from subs</span></div><div class="bar">' + bar(C.armour, K.armour, '#4dc3ff') + '</div>' +
      '<div class="row">Firepower <span>bits, Kicks, Super Chats, drones</span></div><div class="bar">' + bar(C.fire, K.fire, '#ff7a3a') + '</div>' +
      '<div class="row">Extra time +' + C.time + 's <span>gifted subs</span></div><div class="bar">' + bar(C.time, K.time, '#3dff9a') + '</div>';
  }
  function showBrief(a) {
    closeBrief();
    const el = document.createElement('div'); el.className = 'rnb';
    const I = a.intel || {};
    el.innerHTML = '<div class="hd"><div><div class="t1">RAID NIGHT · BRIEFING</div><div class="t2">THE VEYDR QUEEN</div></div><div class="cd"><div class="n" id="rnCd">' + mmss(a.endsAt - Date.now()) + '</div><div class="l">UNTIL THE DROP</div></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:20px;min-height:0"><div class="pn"><h3>INTEL</h3>' +
      '<div class="row">Queen strength <span>' + (I.level ? '+' + Math.round((I.mult - 1) * 100) + '% (she has won ' + I.queenWins + ')' : 'normal') + '</span></div>' +
      '<div class="row">Season <span>raiders ' + (I.raidWins || 0) + ' - ' + (I.queenWins || 0) + ' Queen' + (I.streak ? ' · ' + I.streak + ' wins in a row' : '') + '</span></div></div>' +
      '<div class="pn"><h3>WAR CHEST</h3><div id="rnChest"></div></div></div>' +
      '<div class="pn"><h3>ROLL CALL · <span id="rnN">' + (a.enlisted || []).length + '</span> ENLISTED</h3><div class="names" id="rnNames">' + (a.enlisted || []).map((n) => '<i>' + esc(n) + '</i>').join('') + '</div><div class="cta">TYPE !enlist</div></div>';
    stage.appendChild(el);
    brief = { el, endsAt: a.endsAt };
    briefChest(a.chest || { armour: 0, fire: 0, time: 0 }, a.cap || { armour: 20, fire: 30, time: 120 });
    SFX.play('alarm', 0, 3); SFX.play('impact', 0.2);
  }
  function closeBrief() { if (brief) { const el = brief.el; el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.95)' }], { duration: 400, fill: 'forwards' }); setTimeout(() => el.remove(), 420); brief = null; } }
  return { init, event, hm };
})();
