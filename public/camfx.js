// Camera studio effects drawn on the overlay around your camera: spotlight, wanted poster, goal cam,
// night vision scanlines and the Raid Night commander frame. OBS moves the camera itself.
window.CAMFX = (function () {
  let stage = null;
  const esc = (s) => BBR.esc(s);
  const CSS = `
  .cfx{position:absolute;pointer-events:none;z-index:6;font-family:'Barlow Condensed',sans-serif;color:#fff}
  .cfx-dim{position:absolute;inset:0;pointer-events:none;z-index:5;transition:opacity .6s}
  .cfx-want{border:14px solid #6b4a26;background:transparent;box-shadow:0 0 0 6px #c9a46a,0 18px 40px rgba(0,0,0,.6)}
  .cfx-want .t{position:absolute;left:-20px;right:-20px;top:-96px;height:90px;background:#e8d3a8;color:#3b2612;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;font-size:56px;letter-spacing:8px;line-height:1;border:4px solid #6b4a26}
  .cfx-want .t small{font-size:18px;letter-spacing:4px}
  .cfx-want .b{position:absolute;left:-20px;right:-20px;bottom:-84px;height:78px;background:#e8d3a8;color:#3b2612;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;font-size:40px;letter-spacing:3px;border:4px solid #6b4a26}
  .cfx-want .b small{font-size:16px;letter-spacing:2px}
  .cfx-goal{border:8px solid #3dff9a;border-radius:12px;box-shadow:0 0 40px #3dff9a}
  .cfx-goal .t,.cfx-cmd .t,.cfx-nv .t{position:absolute;left:50%;top:-58px;transform:translateX(-50%);white-space:nowrap;padding:4px 18px;border-radius:8px;background:#3dff9a;color:#06110b;font-weight:800;font-size:38px;letter-spacing:4px}
  .cfx-cmd{border:8px solid #ff3b3b;box-shadow:0 0 50px rgba(255,59,59,.8);animation:cfxPulse 1s ease-in-out infinite}
  .cfx-cmd .t{background:#ff3b3b;color:#fff}
  .cfx-cmd::before,.cfx-cmd::after{content:"";position:absolute;width:60px;height:60px;border:6px solid #fff}
  .cfx-cmd::before{left:-24px;top:-24px;border-right:0;border-bottom:0}.cfx-cmd::after{right:-24px;bottom:-24px;border-left:0;border-top:0}
  @keyframes cfxPulse{50%{box-shadow:0 0 90px rgba(255,59,59,1)}}
  .cfx-nv{background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 2px,transparent 2px 5px);border:3px solid rgba(80,255,120,.6)}
  .cfx-nv .t{background:rgba(10,30,12,.9);color:#5aff7a;font-size:24px}
  .cfx-buy{position:absolute;padding:6px 14px;border-radius:10px;background:rgba(10,12,15,.9);border:2px solid #ffb020;font-weight:800;font-size:22px;letter-spacing:1px;white-space:nowrap;z-index:7}
  .cfx-buy b{color:#ffb020}
  `;
  function init(o) { stage = o.stage; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  function box(cls, r, html, ms) {
    const el = document.createElement('div'); el.className = 'cfx ' + cls;
    el.style.cssText = 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px';
    el.innerHTML = html || ''; stage.appendChild(el);
    el.animate([{ opacity: 0, transform: 'scale(1.15)' }, { opacity: 1, transform: 'none' }], { duration: 350, fill: 'both' });
    setTimeout(() => { el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }); setTimeout(() => el.remove(), 420); }, Math.max(500, ms - 400));
    return el;
  }
  function event(a) {
    if (!stage) return;
    if (a.phase === 'start' && a.by) {
      const el = document.createElement('div'); el.className = 'cfx-buy';
      const C = (window.BBR_SCREEN && BBR_SCREEN.cam && BBR_SCREEN.cam[0]) || { x: 1500, y: 700, w: 400, h: 300 };
      el.style.left = Math.max(10, Math.min(1500, C.x)) + 'px'; el.style.top = Math.max(10, C.y - 50) + 'px';
      el.innerHTML = esc(a.by) + ' bought <b>' + esc(String(a.label || a.fx).toUpperCase()) + '</b>';
      stage.appendChild(el); el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 3500, fill: 'forwards' });
      setTimeout(() => el.remove(), 3600);
      SFX.play('ding');
      return;
    }
    if (a.phase !== 'frame' || !a.rect) return;
    const r = a.rect, ms = a.ms || 8000;
    if (a.fx === 'spotlight') {
      const d = document.createElement('div'); d.className = 'cfx-dim';
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.max(r.w, r.h) * 0.62;
      d.style.background = 'radial-gradient(circle ' + rad + 'px at ' + cx + 'px ' + cy + 'px,transparent 0 92%,rgba(0,0,0,.82) 100%)';
      stage.appendChild(d); d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: 'both' });
      setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 700); }, ms - 600);
      SFX.play('impact');
    } else if (a.fx === 'wanted') {
      const el = box('cfx-want', r, '<div class="t">WANTED<small>DEAD OR ALIVE</small></div><div class="b">' + esc(a.by ? '$' + (Math.floor(Math.random() * 90) + 10) + ',000 REWARD' : 'BIGBOSSROBINSON') + '<small>' + (a.by ? 'BOUNTY SET BY ' + esc(String(a.by).toUpperCase()) : 'FOR CRIMES AGAINST THE KEEPER') + '</small></div>', ms);
      // camera near the edge of the screen: tuck the labels inside the frame
      if (r.y + r.h + 90 > 1080) { const b = el.querySelector('.b'); b.style.bottom = '0'; b.style.left = b.style.right = '0'; }
      if (r.y < 100) { const t = el.querySelector('.t'); t.style.top = '0'; t.style.left = t.style.right = '0'; }
      if (r.x + r.w + 20 > 1920 || r.x < 20) { el.querySelectorAll('.t,.b').forEach((x) => { x.style.left = x.style.right = '0'; }); }
      SFX.play('whoosh');
    } else if (a.fx === 'goal') {
      box('cfx-goal', r, '<div class="t">GOAL CAM</div>', ms); SFX.play('cheer', 0, 2); SFX.play('horn', 0.1, 0.6);
    } else if (a.fx === 'commander') {
      box('cfx-cmd', r, '<div class="t">COMMANDER</div>', ms); SFX.play('alarm', 0, 2.5);
    } else if (a.fx === 'night' || a.fx === 'bw') {
      box('cfx-nv', r, '<div class="t">' + (a.fx === 'night' ? 'NIGHT VISION' : 'FLASHBACK') + '</div>', ms);
    }
  }
  return { init, event };
})();
