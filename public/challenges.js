// Challenge tracker on stream: the running challenge (e.g. EYEPATCH · 3 of 5 games left) plus what's next.
// Sits in a top corner away from the camera, hides itself while a battle is on screen.
window.CH = (function () {
  let stage = null, box = null, st = null;
  const esc = (s) => BBR.esc(s);
  const CSS = `
  .chw{position:absolute;top:40px;width:330px;display:flex;flex-direction:column;gap:8px;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;z-index:4;transition:opacity .5s}
  .chw.hid{opacity:0}
  .chw .c1{display:flex;gap:12px;align-items:center;background:rgba(10,12,15,.93);border:2px solid #ffb020;border-radius:14px;padding:10px 14px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
  .chw .c1.fin{animation:chPulse 1s ease-in-out infinite}
  @keyframes chPulse{50%{box-shadow:0 0 30px #ffb020}}
  .chw .ic{width:46px;height:46px;flex-shrink:0;border-radius:50%;background:#ffb020;display:flex;align-items:center;justify-content:center}
  .chw .nm{font-size:24px;font-weight:800;letter-spacing:1px;line-height:1;text-transform:uppercase}
  .chw .sb{font-family:Inter,sans-serif;font-size:12.5px;color:#c9d0d7;margin-top:3px}
  .chw .pp{display:flex;gap:4px;margin-top:6px}
  .chw .pp i{flex:1;height:7px;border-radius:4px;background:#ffb020}
  .chw .pp i.u{background:#4a5059}
  .chw .c2{background:rgba(10,12,15,.9);border:2px solid #4dc3ff;border-radius:12px;padding:6px 12px;font-size:17px;font-weight:800;letter-spacing:1px}
  .chw .c2 span{color:#4dc3ff}
  .chw .c2 small{display:block;font-family:Inter,sans-serif;font-size:11.5px;font-weight:400;color:#c9d0d7;letter-spacing:0}
  .chstamp{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);z-index:30;text-align:center;font-family:'Barlow Condensed',sans-serif;color:#fff;pointer-events:none}
  .chstamp .s1{display:inline-block;white-space:nowrap;padding:10px 26px;border:6px solid #ffb020;border-radius:14px;color:#ffb020;font-size:64px;font-weight:800;letter-spacing:4px;line-height:1;background:rgba(10,12,15,.85);transform:rotate(-6deg)}
  .chstamp .s2{margin-top:14px;font-size:40px;font-weight:800;text-transform:uppercase;text-shadow:0 3px 10px #000}
  .chstamp .s3{font-family:Inter,sans-serif;font-size:20px;color:#e6eaee;text-shadow:0 2px 6px #000}
  .chstamp .cf{position:absolute;width:12px;height:18px;top:0}
  `;
  const EYE = '<svg width="30" height="30" viewBox="0 0 44 44" aria-hidden="true"><path d="M4 14 L40 30" stroke="#0b0d10" stroke-width="3"/><ellipse cx="16" cy="22" rx="9" ry="7" fill="#0b0d10"/></svg>';
  const FLAG = '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4h11l-2 4 2 4H7" fill="#0b0d10"/></svg>';
  const word = (u, n) => (n === 1 ? ({ games: 'game', deliveries: 'delivery', raids: 'raid', matches: 'match', minutes: 'minute' }[u] || 'game') : u);
  const mmss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  function init(o) { stage = o.stage; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); setInterval(tick, 1000); }
  function side() {
    // stay off the camera: left unless the camera (or Live box) is in the top-left
    const A = (window.BBR_SCREEN && BBR_SCREEN.cam) || [];
    return A.some((r) => r.x < 400 && r.y < 300) ? 'right' : 'left';
  }
  function render() {
    if (!stage || !st) return;
    const L = (st.list || []).filter((c) => !c.hidden);
    if (!st.show || !L.length || L[0].paused) { if (box) { box.remove(); box = null; } return; }
    if (!box) { box = document.createElement('div'); box.className = 'chw'; stage.appendChild(box); }
    box.style.left = box.style.right = '';
    box.style[side()] = '40px';
    const c = L[0], timer = c.unit === 'minutes' && c.leftSecs != null;
    const pips = timer ? '' : '<div class="pp">' + Array.from({ length: Math.min(12, c.total) }, (_, i) => '<i' + (i < c.total - c.left ? ' class="u"' : ' style="background:' + (c.color || '#ffb020') + '"') + '></i>').join('') + '</div>';
    const col = c.color || '#ffb020';
    let h = '<div class="c1' + (c.left === 1 && !timer ? ' fin' : '') + '" style="border-color:' + col + '"><div class="ic" style="background:' + col + '">' + (/eye ?patch/i.test(c.name) ? EYE : FLAG) + '</div><div style="flex-grow:1;min-width:0">' +
      '<div class="nm">' + esc(c.name) + '</div><div class="sb">' + (c.by.length ? 'from ' + esc(c.by.join(' + ')) + ' · ' : '') +
      (timer ? '<b id="chT">' + mmss(c.leftSecs) + '</b> left' : (c.left === 1 ? '<b style="color:#ffb020">FINAL ' + esc(word(c.unit, 1).toUpperCase()) + '</b>' : (c.unit === 'minutes' ? c.left + ' of ' + c.total + ' ' + esc(word(c.unit, c.total)) + ' left' : esc(word(c.unit, 1)) + ' ' + (c.total - c.left + 1) + ' of ' + c.total + ' · ' + c.left + ' left'))) + '</div>' + pips + '</div></div>';
    if (L[1]) h += '<div class="c2">' + esc(L[1].name) + ' <span>· NEXT UP</span>' + (L.length > 2 ? ' <span>+' + (L.length - 2) + '</span>' : '') + '<small>' + (L[1].by.length ? 'from ' + esc(L[1].by.join(' + ')) + ' · ' : '') + L[1].total + ' ' + esc(word(L[1].unit, L[1].total)) + '</small></div>';
    box.innerHTML = h;
  }
  let endAt = 0;
  function tick() {
    if (box) box.classList.toggle('hid', !!stage.querySelector('.aarena,.rarena,.pen,.scr,.rnb,.lbb'));
    const L = st && st.list;
    if (L && L[0] && L[0].unit === 'minutes' && L[0].leftSecs != null) {
      if (!endAt) endAt = Date.now() + L[0].leftSecs * 1000;
      const t = document.getElementById('chT'); if (t) t.textContent = mmss(Math.max(0, Math.round((endAt - Date.now()) / 1000)));
    }
  }
  function state(a) { st = a; endAt = 0; render(); }
  function stamp(big, name, sub, color) {
    const el = document.createElement('div'); el.className = 'chstamp';
    el.innerHTML = '<div class="s1" style="border-color:' + color + ';color:' + color + '">' + big + '</div><div class="s2">' + esc(name) + '</div><div class="s3">' + esc(sub) + '</div>';
    stage.appendChild(el);
    el.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(2.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.08 }, { opacity: 1, offset: 0.85 }, { opacity: 0, transform: 'translate(-50%,-60%) scale(.9)' }], { duration: 4200, fill: 'forwards' });
    setTimeout(() => el.remove(), 4300);
    return el;
  }
  // events: accepted / step / final / complete. Returns ms the stamp needs (for the alert queue)
  function event(a) {
    const c = a.ch || {};
    if (a.kind === 'accepted') {
      stamp('CHALLENGE ACCEPTED', c.name, (a.by ? a.by + ' · ' : '') + c.total + ' ' + word(c.unit, c.total) + (a.queued ? ' · queued' : ''), c.color || '#ffb020');
      SFX.play('impact'); SFX.play('ooh', 0.3); SFX.play('ding', 0.6);
      return 4300;
    }
    if (a.kind === 'final') { SFX.play('alarm', 0, 0.8); return 0; }
    if (a.kind === 'step') { SFX.play('tick'); return 0; }
    if (a.kind === 'complete') {
      const el = stamp('CHALLENGE COMPLETE', c.name, c.by && c.by.length ? 'Thanks ' + c.by.join(', ') + '!' : 'Done!', '#3dff9a');
      for (let i = 0; i < 60; i++) { const f = document.createElement('i'); f.className = 'cf'; f.style.left = (Math.random() * 900 - 450) + 'px'; f.style.background = ['#ffb020', '#3dff9a', '#4dc3ff', '#ff5aa0'][i % 4]; el.appendChild(f); f.animate([{ transform: 'translateY(-200px) rotate(0)' }, { transform: 'translateY(' + (300 + Math.random() * 300) + 'px) rotate(' + (Math.random() * 720) + 'deg)', opacity: 0 }], { duration: 2600 + Math.random() * 1200, delay: Math.random() * 400, fill: 'forwards' }); }
      SFX.play('fanfare'); SFX.play('cheer', 0.2, 2.5);
      return 4300;
    }
    return 0;
  }
  return { init, state, event };
})();
