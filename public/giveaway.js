// Giveaway overlay: entries banner, prize pot meter, the draw reel and the winner reveal.
window.GIVE = (function () {
  let stage = null, banner = null, pot = null, potTimer = null, drawEl = null, claimIv = null;
  const esc = (s) => BBR.esc(s);
  const css = `
  .gw-ban{position:absolute;left:40px;top:40px;display:flex;align-items:center;gap:16px;padding:12px 20px 12px 14px;border-radius:14px;background:rgba(10,12,15,.92);border:2px solid #ffd23f;box-shadow:0 0 30px rgba(255,210,63,.35);font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;animation:gwIn .6s cubic-bezier(.3,1.3,.5,1) both}
  @keyframes gwIn{from{transform:translateX(-120%)}}
  .gw-ban.out{animation:gwOut .5s ease-in both}@keyframes gwOut{to{transform:translateX(-130%)}}
  .gw-gift{width:56px;height:56px;flex-shrink:0;animation:gwBob 1.6s ease-in-out infinite}@keyframes gwBob{50%{transform:translateY(-5px) rotate(-6deg)}}
  .gw-k{font-size:15px;font-weight:800;letter-spacing:4px;color:#ffd23f}
  .gw-t{font-size:34px;font-weight:800;line-height:1;text-transform:uppercase;max-width:560px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .gw-s{font-family:Inter,sans-serif;font-size:15px;color:#c3cad3;margin-top:3px}
  .gw-s b{color:#fff}
  .gw-n{min-width:74px;text-align:center;padding:6px 10px;border-radius:10px;background:#ffd23f;color:#111;font-size:30px;font-weight:800;line-height:1}
  .gw-n small{display:block;font-size:11px;letter-spacing:2px}
  .gw-pot{position:absolute;left:40px;bottom:40px;width:560px;padding:14px 18px;border-radius:14px;background:rgba(10,12,15,.92);border:2px solid var(--acc);font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;animation:gwUp .6s cubic-bezier(.3,1.3,.5,1) both}
  @keyframes gwUp{from{transform:translateY(140%)}}
  .gw-pot.out{animation:gwDown .5s ease-in both}@keyframes gwDown{to{transform:translateY(140%)}}
  .gw-ph{display:flex;justify-content:space-between;align-items:baseline}
  .gw-ph b{font-size:28px;font-weight:800;letter-spacing:2px}.gw-ph span{font-family:Inter,sans-serif;font-size:14px;color:#c3cad3}
  .gw-row{display:grid;grid-template-columns:140px 1fr 100px;align-items:center;gap:10px;margin-top:7px;font-size:19px;font-weight:700}
  .gw-row .tr{height:12px;border-radius:6px;background:#232a33;overflow:hidden}
  .gw-row .tr i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#b8862b,#ffd23f);box-shadow:0 0 10px #ffd23f;transition:width 1.4s cubic-bezier(.3,.9,.3,1)}
  .gw-row.full .tr i{background:linear-gradient(90deg,#29c26c,#3dff9a);box-shadow:0 0 12px #3dff9a}
  .gw-row .v{text-align:right;font-variant-numeric:tabular-nums}
  .gw-why{font-family:Inter,sans-serif;font-size:14px;color:#ffd23f;margin-top:8px}
  .gw-sch{position:absolute;left:40px;top:150px;width:520px;padding:14px 18px;border-radius:14px;background:rgba(10,12,15,.92);border:2px solid #ffd23f;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;animation:gwIn .6s cubic-bezier(.3,1.3,.5,1) both}
  .gw-sch.out{animation:gwOut .5s ease-in both}
  .gw-sch .k{font-size:15px;font-weight:800;letter-spacing:4px;color:#ffd23f}
  .gw-sch .t{font-size:40px;font-weight:800;line-height:1;text-transform:uppercase}
  .gw-sch .d{font-family:Inter,sans-serif;font-size:15px;color:#c3cad3;margin-top:4px}.gw-sch .d b{color:#fff}
  .gw-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}
  .gw-steps div{padding:6px 4px;border-radius:8px;background:#1b2027;text-align:center;font-size:16px;font-weight:800;color:#7d8792;letter-spacing:1px}
  .gw-steps div.done{color:#c3cad3}.gw-steps div.on{background:#ffd23f;color:#111;box-shadow:0 0 16px rgba(255,210,63,.6)}
  .gw-steps div.big{border:2px solid #ffd23f}
  .gw-big{margin-top:10px;display:flex;justify-content:space-between;align-items:baseline;font-size:22px;font-weight:800}
  .gw-big span{color:#ffd23f}
  .gw-dbl{font-size:54px;font-weight:800;line-height:1;background:linear-gradient(90deg,#ffd23f,#fff,#ffd23f);-webkit-background-clip:text;background-clip:text;color:transparent;background-size:200% 100%;animation:gwShine 2s linear infinite}
  @keyframes gwShine{to{background-position:-200% 0}}
  .gw-draw{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7}
  .gw-dim{position:absolute;inset:0;background:radial-gradient(circle,rgba(10,12,15,.88),rgba(5,6,8,.55) 70%,rgba(0,0,0,0));animation:gwFade .5s both}@keyframes gwFade{from{opacity:0}}
  .gw-box{position:relative;display:flex;flex-direction:column;align-items:center;gap:14px}
  .gw-lbl{font-size:22px;font-weight:800;letter-spacing:8px;color:#ffd23f}
  .gw-prize{font-size:56px;font-weight:800;text-transform:uppercase;line-height:1;text-align:center;max-width:1300px}
  .gw-reelw{position:relative;width:760px;height:120px;overflow:hidden;border-radius:16px;background:#0b0d10;border:3px solid #ffd23f;box-shadow:0 0 50px rgba(255,210,63,.4),inset 0 0 40px rgba(0,0,0,.8)}
  .gw-reelw::before,.gw-reelw::after{content:"";position:absolute;left:0;right:0;height:30px;z-index:2}
  .gw-reelw::before{top:0;background:linear-gradient(#0b0d10,transparent)}.gw-reelw::after{bottom:0;background:linear-gradient(transparent,#0b0d10)}
  .gw-reel{position:absolute;left:0;right:0;top:0}
  .gw-reel div{height:120px;display:flex;align-items:center;justify-content:center;font-size:72px;font-weight:800;text-transform:uppercase;white-space:nowrap}
  .gw-win{display:flex;align-items:center;gap:40px;opacity:0}
  .gw-card{width:260px;height:380px;transform-style:preserve-3d}
  .gw-wt{display:flex;flex-direction:column;gap:6px}
  .gw-wn{font-size:96px;font-weight:800;line-height:.9;text-transform:uppercase;color:#ffd23f;text-shadow:0 0 30px rgba(255,210,63,.6)}
  .gw-odds{font-family:Inter,sans-serif;font-size:18px;color:#c3cad3}
  .gw-claim{margin-top:8px;padding:10px 18px;border-radius:12px;background:#ffd23f;color:#111;font-size:36px;font-weight:800;align-self:flex-start}
  .gw-claim.ok{background:#3dff9a}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const GIFT = '<svg class="gw-gift" viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="12" rx="1.5" fill="#ffd23f"/><rect x="2" y="6.5" width="20" height="4" rx="1" fill="#ffb020"/><path d="M12 6.5V21" stroke="#7a4a00" stroke-width="2"/><path d="M12 6.5C9 1 5 3.5 7.5 6.5M12 6.5C15 1 19 3.5 16.5 6.5" stroke="#ffd23f" stroke-width="2" fill="none"/></svg>';

  function onMsg(a) {
    if (a.type === 'pot') return showPot(a);
    if (a.phase === 'schedule') return schedule(a);
    if (a.phase === 'open') return openBanner(a);
    if (a.phase === 'count') return count(a);
    if (a.phase === 'closed') { setSub('<b>Entries closed</b> · draw coming up'); return; }
    if (a.phase === 'draw') return draw(a);
    if (a.phase === 'claimed') return claimed(a);
    if (a.phase === 'noclaim') return noclaim(a);
    if (a.phase === 'done' || a.phase === 'cancel') { hideBanner(); if (a.phase === 'cancel') clearDraw(); }
  }
  function openBanner(a) {
    hideBanner(true);
    banner = document.createElement('div');
    banner.className = 'gw-ban';
    banner.innerHTML = GIFT + '<div><div class="gw-k">' + esc(a.label) + ' · ' + esc(a.currency || '') + a.value + '</div><div class="gw-t">' + esc(a.prize) + '</div>' +
      '<div class="gw-s" id="gwsub">Type <b>!enter</b> for a free entry' + (a.card ? ' (' + esc(a.card.toUpperCase()) + ' card+)' : ' (followers)') + ' · <b>!enter 5</b> = extra entries for ' + a.cost + ' ticket' + (a.cost > 1 ? 's' : '') + ' each' +
      (a.drawDate ? ' · drawn <b>' + (a.drawDate === new Date().toISOString().slice(0, 10) ? 'TONIGHT' : new Date(a.drawDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })) + '</b>' : '') + '</div></div>' +
      '<div class="gw-n"><span id="gwn">' + (a.count || 0) + '</span><small>ENTERED</small></div>';
    stage.appendChild(banner);
    SFX.play('whoosh'); SFX.play('sparkle', 0.3); SFX.play('ding', 0.5);
  }
  function setSub(h) { const s = banner && banner.querySelector('#gwsub'); if (s) s.innerHTML = h; }
  function count(a) {
    const n = banner && banner.querySelector('#gwn'); if (!n) return;
    n.textContent = a.count;
    n.parentNode.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300 });
    SFX.play('pop');
  }
  function hideBanner(now) { if (!banner) return; const b = banner; banner = null; if (now) return b.remove(); b.classList.add('out'); setTimeout(() => b.remove(), 600); }

  function showPot(a) {
    if (pot) pot.remove();
    clearTimeout(potTimer);
    pot = document.createElement('div');
    pot.className = 'gw-pot';
    pot.innerHTML = '<div class="gw-ph"><b>PRIZE POT</b><span>' + esc(a.currency) + a.total.toFixed(2) + ' collected so far</span></div>' +
      a.tiers.map((t) => '<div class="gw-row' + (t.have >= t.max ? ' full' : '') + '"><span>' + esc(t.label.replace(' Drop', '').replace(' Jackpot', '')) + '</span><div class="tr"><i style="width:0"></i></div><span class="v">' + esc(a.currency) + Math.floor(t.have) + ' / ' + t.max + '</span></div>').join('') +
      (a.why ? '<div class="gw-why">Thanks ' + esc(a.why) + '! A share of every sub, bit, Kick and Super Chat goes into the pot.</div>' : '<div class="gw-why">A share of every sub, bit, Kick and Super Chat goes into the pot. Earn tickets by watching: !tickets</div>');
    stage.appendChild(pot);
    requestAnimationFrame(() => pot && pot.querySelectorAll('.tr i').forEach((el, k) => { el.style.width = Math.min(100, a.tiers[k].have / a.tiers[k].max * 100) + '%'; }));
    SFX.play('swoosh'); SFX.play('ding', 0.6);
    const p = pot;
    potTimer = setTimeout(() => { p.classList.add('out'); setTimeout(() => { p.remove(); if (pot === p) pot = null; }, 600); }, 10000);
  }

  let sch = null;
  function schedule(a) {
    if (sch) sch.remove();
    sch = document.createElement('div');
    sch.className = 'gw-sch';
    const steps = ['community', 'bronze', 'silver', 'gold'], names = ['COMMUNITY', 'BRONZE', 'SILVER', 'THE BIG ONE'];
    const at = steps.indexOf(a.slot);
    const strip = '<div class="gw-steps">' + steps.map((x, i) => '<div class="' + (i === at ? 'on' : at > i ? 'done' : '') + (x === 'gold' ? ' big' : '') + '">' + names[i] + '</div>').join('') + '</div>';
    const big = a.daysToBig != null ? '<div class="gw-big"><span>THE BIG ONE · ' + esc(a.currency) + a.bigValue + '</span>' + (a.daysToBig === 0 ? 'TONIGHT' : 'in ' + a.daysToBig + ' day' + (a.daysToBig === 1 ? '' : 's')) + '</div>' : '';
    if (a.slot === 'double') sch.innerHTML = '<div class="k">THIS WEEK</div><div class="gw-dbl">DOUBLE TICKETS</div><div class="d">Everyone earns tickets <b>twice as fast</b> this week. Stock up for the next draw: <b>!tickets</b></div>' + big;
    else sch.innerHTML = '<div class="k">THIS WEEK\'S DRAW · ' + (a.isToday ? 'TONIGHT' : esc(a.drawDay).toUpperCase()) + '</div><div class="t">' + esc(a.label) + '</div>' +
      '<div class="d">' + (a.prize ? '<b>' + esc(a.prize) + '</b> · worth up to ' + esc(a.currency) + a.value + ' · ' : '') + 'type <b>!enter</b></div>' + strip + big;
    stage.appendChild(sch);
    SFX.play('whoosh'); SFX.play('ding', 0.4);
    const el = sch;
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); if (sch === el) sch = null; }, 600); }, 12000);
  }

  function clearDraw() { clearInterval(claimIv); if (drawEl) drawEl.remove(); drawEl = null; }
  function draw(a) {
    clearDraw();
    drawEl = document.createElement('div');
    drawEl.className = 'gw-draw';
    const names = a.reel.length ? a.reel : [a.winner];
    const list = names.concat(names).concat(names).slice(0, 44);
    list.push(a.winner);
    drawEl.innerHTML = '<div class="gw-dim"></div><div class="gw-box"><div class="gw-lbl">' + esc(a.label) + ' DRAW</div><div class="gw-prize">' + esc(a.prize) + '</div>' +
      '<div class="gw-reelw"><div class="gw-reel">' + list.map((n) => '<div>' + esc(n) + '</div>').join('') + '</div></div>' +
      '<div class="gw-win"><div class="' + (a.card ? BBR.wrapClass(a.card.tier) : '') + '"><div class="gw-card">' + (a.card ? BBR.render(Object.assign({}, a.card, { ribbon: 'WINNER' }), { accent: '#ffd23f' }) : '') + '</div></div>' +
      '<div class="gw-wt"><div class="gw-lbl" style="align-self:flex-start">WINNER</div><div class="gw-wn">' + esc(a.winner) + '</div><div class="gw-odds">' + a.entries + ' of ' + a.totalEntries + ' entries</div><div class="gw-claim" id="gwc">TYPE !claim · ' + a.claimMinutes + ':00</div></div></div></div>';
    stage.appendChild(drawEl);
    const reel = drawEl.querySelector('.gw-reel');
    const end = (list.length - 1) * 120;
    reel.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-' + end + 'px)' }], { duration: 7000, easing: 'cubic-bezier(.12,.6,.12,1)', fill: 'forwards' });
    SFX.play('riser', 0, 6.5); SFX.play('rumble', 0, 6);
    for (let k = 0; k < 26; k++) SFX.play('tick', Math.pow(k / 26, 2.2) * 6.8);
    setTimeout(() => {
      if (!drawEl) return;
      SFX.play('impact'); SFX.play('fanfare', 0.1); SFX.play('cheer', 0.2, 3); SFX.play('sparkle', 0.3);
      drawEl.querySelector('.gw-reelw').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 500 });
    }, 7000);
    setTimeout(() => {
      if (!drawEl) return;
      drawEl.querySelector('.gw-reelw').animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.8)' }], { duration: 400, fill: 'forwards' });
      const w = drawEl.querySelector('.gw-win');
      w.style.position = 'absolute'; w.style.top = '150px';
      w.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 700, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' });
      drawEl.querySelector('.gw-card').animate([{ transform: 'perspective(900px) rotateY(540deg) scale(1.4)' }, { transform: 'perspective(900px) rotateY(0) scale(1)' }], { duration: 1100, easing: 'cubic-bezier(.2,.8,.2,1)' });
      SFX.tierFx(a.card ? a.card.tier : 'gold', 0.3);
      const c = drawEl.querySelector('#gwc');
      claimIv = setInterval(() => {
        const left = Math.max(0, Math.ceil((a.claimBy - Date.now()) / 1000));
        if (c && !c.classList.contains('ok')) c.textContent = 'TYPE !claim · ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
      }, 1000);
    }, 8200);
    // the reveal stays up for 25s, the claim timer keeps going on the banner
    setTimeout(() => { if (drawEl) { drawEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: 'forwards' }); const d = drawEl; setTimeout(() => { if (drawEl === d) clearDraw(); }, 650); } }, 33000);
    setSub('<b>' + esc(a.winner) + '</b> drawn! Type <b>!claim</b> to win');
  }
  function claimed(a) {
    const c = drawEl && drawEl.querySelector('#gwc');
    if (c) { c.textContent = 'CLAIMED!'; c.classList.add('ok'); }
    clearInterval(claimIv);
    setSub('<b>' + esc(a.winner) + '</b> claimed ' + esc(a.prize) + '!');
    SFX.play('fanfare'); SFX.play('cheer', 0.1, 3);
    if (!drawEl) { const t = document.createElement('div'); t.className = 'gw-draw'; t.innerHTML = '<div class="gw-box" style="margin-top:-500px"><div class="gw-claim ok" style="font-size:44px">' + esc(a.winner) + ' CLAIMED ' + esc(a.prize) + '!</div></div>'; stage.appendChild(t); setTimeout(() => t.remove(), 6000); }
  }
  function noclaim(a) {
    clearDraw();
    setSub('<b>' + esc(a.winner) + '</b> didn\'t claim in time · redraw coming');
    SFX.play('ooh');
  }
  return { init: (o) => { stage = o.stage; }, onMsg };
})();
