// v30 links flash: your channels pop up on a timer (or when you press "Links" on the dock / Stream Deck).
// { type: 'links', list: [{ k, text }], pos: tl|tc|tr|ml|mr|bl|bc|br, x, y, scale, style: flip|slide|neon, secs, title }
window.LINKS = (function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // platform colour + a short tag (plain text, no logos)
  const P = { twitch: ['TWITCH', '#9146ff', '#fff'], youtube: ['YOUTUBE', '#ff2d2d', '#fff'], kick: ['KICK', '#53fc18', '#0b0e0f'], tiktok: ['TIKTOK', '#111', '#25f4ee'], x: ['X', '#111', '#fff'], instagram: ['INSTAGRAM', '#d62976', '#fff'], discord: ['DISCORD', '#5865f2', '#fff'] };
  let css = false, stage = null, cur = null;
  function addCss() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `
.lk-box{position:absolute;z-index:40;display:flex;flex-direction:column;gap:10px;pointer-events:none;font-family:'Barlow Condensed','Arial Narrow',sans-serif;perspective:900px}
.lk-hd{display:flex;align-items:center;gap:10px;align-self:flex-start;background:#0b0d10;color:#fff;font-size:26px;font-weight:800;letter-spacing:3px;padding:6px 16px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.45)}
.lk-hd i{width:14px;height:14px;border-radius:50%;background:#ff3b3b;box-shadow:0 0 12px #ff3b3b;animation:lkPulse 1s ease-in-out infinite}
@keyframes lkPulse{50%{opacity:.25}}
.lk-row{display:flex;align-items:stretch;border-radius:10px;overflow:hidden;box-shadow:0 10px 26px rgba(0,0,0,.45);transform-origin:50% 0;backface-visibility:hidden}
.lk-row .t{display:flex;align-items:center;justify-content:center;min-width:150px;padding:0 16px;font-size:26px;font-weight:800;letter-spacing:2px}
.lk-row .u{flex:1;display:flex;align-items:center;background:rgba(11,13,16,.92);color:#fff;font-size:36px;font-weight:700;letter-spacing:1px;padding:8px 22px 6px;white-space:nowrap}
.lk-box.neon .lk-row{background:transparent;box-shadow:none;border:3px solid var(--c);box-shadow:0 0 18px var(--c),inset 0 0 14px var(--c)}
.lk-box.neon .lk-row .t{background:transparent!important;color:var(--c)!important;text-shadow:0 0 12px var(--c)}
.lk-box.neon .lk-row .u{background:rgba(0,0,0,.55);text-shadow:0 0 10px var(--c)}
.lk-slide{position:relative;height:66px;overflow:hidden;width:760px}
.lk-slide .lk-row{position:absolute;left:0;top:0}
`;
    document.head.appendChild(s);
  }
  function place(el, ev) {
    const pos = ev.pos || 'bl', sc = (ev.scale || 100) / 100, m = 50;
    const H = { l: 'left:' + (m + (ev.x || 0)) + 'px', c: 'left:50%', r: 'right:' + (m - (ev.x || 0)) + 'px' }[pos[1]];
    const V = { t: 'top:' + (m + (ev.y || 0)) + 'px', m: 'top:50%', b: 'bottom:' + (m + 70 - (ev.y || 0)) + 'px' }[pos[0]];
    const tx = pos[1] === 'c' ? 'translateX(calc(-50% + ' + (ev.x || 0) + 'px))' : '', ty = pos[0] === 'm' ? 'translateY(calc(-50% + ' + (ev.y || 0) + 'px))' : '';
    el.style.cssText = H + ';' + V + ';transform:' + (tx + ' ' + ty).trim() + ' scale(' + sc + ');transform-origin:' + (pos[1] === 'l' ? 'left' : pos[1] === 'r' ? 'right' : 'center') + ' ' + (pos[0] === 't' ? 'top' : pos[0] === 'b' ? 'bottom' : 'center');
    if (pos[1] === 'r') el.style.alignItems = 'flex-end';
  }
  const row = (l) => { const p = P[l.k] || [l.k.toUpperCase(), '#444', '#fff']; return '<div class="lk-row" style="--c:' + p[1] + '"><span class="t" style="background:' + p[1] + ';color:' + p[2] + '">' + p[0] + '</span><span class="u">' + esc(l.text) + '</span></div>'; };
  function show(ev) {
    addCss();
    if (cur) { cur.remove(); cur = null; }
    const host = stage || document.body, el = document.createElement('div');
    el.className = 'lk-box' + (ev.style === 'neon' ? ' neon' : '');
    const list = (ev.list || []).slice(0, 7); if (!list.length) return;
    const secs = (ev.secs || 14) * 1000;
    if (ev.style === 'slide') {
      // one bar, the links take turns
      el.innerHTML = '<div class="lk-hd"><i></i>' + esc(ev.title || 'FIND ME') + '</div><div class="lk-slide">' + list.map(row).join('') + '</div>';
      host.appendChild(el); place(el, ev);
      const rows = el.querySelectorAll('.lk-slide .lk-row'), each = secs / rows.length;
      rows.forEach((r, i) => { r.style.opacity = 0; r.animate([{ transform: 'translateY(70px)', opacity: 0 }, { transform: 'none', opacity: 1, offset: 0.12 }, { transform: 'none', opacity: 1, offset: 0.88 }, { transform: 'translateY(-70px)', opacity: 0 }], { duration: each, delay: i * each, fill: 'both' }); });
    } else {
      el.innerHTML = '<div class="lk-hd"><i></i>' + esc(ev.title || 'FIND ME') + '</div>' + list.map(row).join('');
      host.appendChild(el); place(el, ev);
      const hd = el.querySelector('.lk-hd'); hd.animate([{ transform: 'translateX(-40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 400, fill: 'both' });
      el.querySelectorAll('.lk-row').forEach((r, i) => {
        const flicker = ev.style === 'neon';
        r.animate(flicker ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.2, offset: 0.3 }, { opacity: 1, offset: 0.45 }, { opacity: 0.4, offset: 0.55 }, { opacity: 1 }] : [{ transform: 'rotateX(-95deg)', opacity: 0 }, { transform: 'rotateX(12deg)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: flicker ? 700 : 520, delay: 250 + i * 180, fill: 'both', easing: 'cubic-bezier(.2,.9,.3,1.2)' });
        // a shine that runs along each link in turn while it's up
        r.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.6)', offset: 0.5 }, { filter: 'brightness(1)' }], { duration: 600, delay: 1500 + i * 900, iterations: Math.max(1, Math.floor((secs - 2000) / (list.length * 900 + 600))) });
      });
    }
    try { if (window.SFX) SFX.play('whoosh'); } catch (e) { /* no audio */ }
    cur = el;
    setTimeout(() => { if (cur !== el) return; el.animate([{ opacity: 1, transform: el.style.transform }, { opacity: 0, transform: el.style.transform + ' translateY(20px)' }], { duration: 450, fill: 'forwards' }).onfinish = () => { el.remove(); if (cur === el) cur = null; }; }, secs);
  }
  return { init: (s) => { stage = s; }, show, preview: show };
})();
