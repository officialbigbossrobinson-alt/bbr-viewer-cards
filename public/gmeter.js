// v33 Giveaway meter on stream (the overlay, or its own Browser Source at /gmeter).
// The app sends { type: 'gmeter', on, value, goal, pct, words, look, endsAt, left, ... }; this draws it.
window.GMETER = (function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let stage = null, el = null, st = null, skew = 0, tickT = null, css = false, lastVal = null, lastLook = '';
  const ICON = {
    football: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#fff" stroke="#111" stroke-width="2"/><path d="M20 9l7 5-3 8h-8l-3-8z" fill="#111"/><path d="M13 14l-6 3M27 14l6 3M16 22l-4 7M24 22l4 7" stroke="#111" stroke-width="2"/></svg>',
    truck: '<svg viewBox="0 0 64 36" aria-hidden="true"><rect x="2" y="4" width="38" height="22" rx="2" fill="#fff" stroke="#111" stroke-width="2"/><path d="M40 10h12l8 9v7H40z" fill="var(--acc)" stroke="#111" stroke-width="2"/><rect x="44" y="12" width="7" height="6" fill="#bfe3ff"/><circle cx="14" cy="29" r="5" fill="#111"/><circle cx="50" cy="29" r="5" fill="#111"/><circle cx="14" cy="29" r="2" fill="#ccc"/><circle cx="50" cy="29" r="2" fill="#ccc"/></svg>',
    heist: '<svg viewBox="0 0 44 36" aria-hidden="true"><rect x="3" y="8" width="38" height="22" rx="3" fill="#2e9c53" stroke="#0c3b1d" stroke-width="2"/><rect x="6" y="5" width="38" height="22" rx="3" fill="#3fbf6a" stroke="#0c3b1d" stroke-width="2"/><circle cx="25" cy="16" r="6" fill="none" stroke="#0c3b1d" stroke-width="2"/><text x="25" y="20" font-size="10" text-anchor="middle" font-weight="900" fill="#0c3b1d">$</text></svg>',
    arc: '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="9" width="30" height="24" fill="#6b5a32" stroke="#141414" stroke-width="2"/><path d="M5 17h30M20 9v24" stroke="#141414" stroke-width="2"/><rect x="5" y="5" width="30" height="5" fill="#f2c200"/></svg>',
    mgs: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3l17 32H3z" fill="#ff3b3b" stroke="#300" stroke-width="2"/><text x="20" y="31" font-size="20" text-anchor="middle" font-weight="900" fill="#fff">!</text></svg>',
    neon: '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="#fff" stroke="var(--acc)" stroke-width="2"/></svg>',
  };
  const iconOf = (L) => L === 'elite' && window.BBR_CREST ? window.BBR_CREST(40) : ICON[L === 'ets' || L === 'ats' ? 'truck' : L === 'elite' ? 'football' : L] || ICON.neon;
  function addCss() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `
.gm{position:absolute;z-index:38;width:540px;box-sizing:border-box;pointer-events:none;font-family:'Barlow Condensed','Arial Narrow',sans-serif;color:var(--ink);--bg:#0d2459;--ink:#fff;--acc:#e3132c;--acc2:#f5c400;--track:rgba(255,255,255,.14);--sub:#c9d3e6}
.gm *{box-sizing:border-box}
.gm .bx{position:relative;background:var(--bg);border-radius:14px;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.5);padding:0 0 12px}
.gm .hd{display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--acc);color:var(--hdink,#fff)}
.gm .hd .ic{width:44px;height:44px;flex:none}.gm .hd .ic svg{width:100%;height:100%}
.gm .hd b{font-size:36px;font-weight:800;letter-spacing:2px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gm .hd i{margin-left:auto;font-style:normal;font-size:15px;font-weight:800;letter-spacing:2px;background:rgba(0,0,0,.25);padding:3px 10px;border-radius:999px;white-space:nowrap}
.gm .pz{padding:8px 16px 0;font-size:26px;font-weight:800;letter-spacing:1px;color:var(--acc2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gm .bar{position:relative;margin:12px 16px 0;height:34px;border-radius:17px;background:var(--track);overflow:visible}
.gm .bar .fill{position:absolute;left:0;top:0;bottom:0;border-radius:17px;background:linear-gradient(90deg,var(--acc),var(--acc2));transition:width 1.1s cubic-bezier(.3,1.2,.4,1);min-width:34px}
.gm .bar .fill::after{content:'';position:absolute;inset:0;border-radius:17px;background:repeating-linear-gradient(135deg,rgba(255,255,255,.18) 0 12px,transparent 12px 24px);animation:gmMove 1.2s linear infinite}
@keyframes gmMove{to{background-position:34px 0}}
.gm .bar .head{position:absolute;top:50%;width:48px;height:48px;margin:-24px 0 0 -30px;transition:left 1.1s cubic-bezier(.3,1.2,.4,1);filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))}
.gm .bar .head svg{width:100%;height:100%}
.gm .bar .pc{position:absolute;right:12px;top:0;bottom:0;display:flex;align-items:center;font-size:22px;font-weight:800;color:var(--ink);text-shadow:0 1px 4px rgba(0,0,0,.7)}
.gm .nums{display:flex;justify-content:space-between;align-items:baseline;padding:8px 16px 0}
.gm .nums b{font-size:40px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}.gm .nums b small{font-size:22px;opacity:.75;margin-left:6px}
.gm .nums span{font-size:20px;font-weight:700;letter-spacing:2px;color:var(--sub)}
.gm .ln{padding:4px 16px 0;font-family:Inter,sans-serif;font-size:17px;font-weight:600;color:var(--sub)}
.gm .ln.en{color:var(--acc2);font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:800;letter-spacing:2px}
.gm .tm{display:flex;align-items:center;gap:12px;margin:10px 16px 0;padding:6px 12px;border-radius:10px;background:rgba(0,0,0,.28)}
.gm .tm span{font-size:20px;font-weight:800;letter-spacing:3px;color:var(--sub)}
.gm .tm b{margin-left:auto;font-size:38px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;color:var(--ink)}
.gm .tm.hot b{color:var(--acc2);animation:gmPulse .9s ease-in-out infinite}@keyframes gmPulse{50%{transform:scale(1.08)}}
.gm .tm.pa b{opacity:.55}
.gm .ent{display:flex;gap:8px;align-items:center;padding:8px 16px 0;font-size:18px;font-weight:700;letter-spacing:1px;color:var(--sub);white-space:nowrap;overflow:hidden}
.gm .ent em{font-style:normal;background:var(--acc2);color:#111;padding:1px 8px;border-radius:999px}
.gm .ban{margin:10px 16px 0;padding:8px 12px;border-radius:10px;text-align:center;font-size:30px;font-weight:800;letter-spacing:2px;background:var(--acc2);color:#111;animation:gmBan 1.6s ease-in-out infinite}
@keyframes gmBan{50%{filter:brightness(1.25)}}
.gm .win{margin:10px 16px 0;padding:10px;border-radius:12px;text-align:center;background:#fff;color:#111}.gm .win small{display:block;font-size:18px;font-weight:800;letter-spacing:4px;color:var(--acc)}.gm .win b{font-size:44px;font-weight:800;line-height:1}
.gm .pop{position:absolute;right:28px;top:96px;font-size:44px;font-weight:800;color:var(--acc2);text-shadow:0 3px 10px rgba(0,0,0,.7);pointer-events:none}
.gm.tmode .tm{margin:14px 16px 2px;padding:10px 16px;flex-direction:column;align-items:flex-start;gap:2px}
.gm.tmode .tm span{font-size:24px;color:var(--acc2)}.gm.tmode .tm b{margin-left:0;font-size:84px;letter-spacing:2px}
.gm.tmode .ban{font-size:40px}
.gm .ban.open{animation:none;background:rgba(0,0,0,.28);color:var(--acc2)}
.gm.hit .bx{box-shadow:0 0 0 4px var(--acc2),0 0 50px var(--acc2),0 18px 44px rgba(0,0,0,.5)}
/* looks */
.gm.lk-football{--bg:linear-gradient(160deg,#16337a,#0d2459 60%,#061233);--acc:#e3132c;--acc2:#f5c400}
.gm.lk-ets{--bg:#0b4fa8;--acc:#ffd400;--hdink:#111;--acc2:#ffd400;--track:rgba(0,0,0,.3);--sub:#dbe8ff}.gm.lk-ets .bx,.gm.lk-ats .bx{border:6px solid #fff;border-radius:18px}
.gm.lk-ets .bar,.gm.lk-ats .bar{border-radius:4px;background:repeating-linear-gradient(90deg,rgba(0,0,0,.35) 0 40px,rgba(0,0,0,.25) 40px 44px)}.gm.lk-ets .fill,.gm.lk-ats .fill{border-radius:4px}
.gm.lk-ets .bar .head,.gm.lk-ats .bar .head{width:70px;height:40px;margin:-28px 0 0 -52px}
.gm.lk-ats{--bg:#0c6b35;--acc:#ffffff;--hdink:#0c6b35;--acc2:#ffcc33;--track:rgba(0,0,0,.3);--sub:#d9f2e2}
.gm.lk-elite{--bg:radial-gradient(140% 160% at 0% 0%,#1d1a14,#0b0b0c 55%,#060607);--acc:#D9B45A;--hdink:#16110a;--acc2:#F3E7C9;--sub:#cbbf9f}
.gm.lk-elite .bx{border-radius:6px;box-shadow:0 18px 40px rgba(0,0,0,.55),0 0 0 2px #050505,0 0 0 5px #D9B45A}
.gm.lk-elite .fill{background:linear-gradient(90deg,#8a6a24,#f6e3a1 40%,#c9a24a 70%,#fff2c2)}
.gm.lk-elite .hd{background:linear-gradient(135deg,#8a6a24 0%,#f6e3a1 22%,#c9a24a 45%,#fff2c2 58%,#b48a33 78%,#6e5219 100%)}.gm.lk-elite .hd b{color:#16110a;letter-spacing:6px}
.gm.lk-heist{--bg:linear-gradient(160deg,#2b0f4d,#7a1d6a 55%,#c2306f);--acc:#ff3d8b;--acc2:#2ef2ff;--sub:#ffd9ea}
.gm.lk-heist .bx{border-radius:4px;border:3px solid #fff;box-shadow:8px 8px 0 #12061f}.gm.lk-heist .hd b,.gm.lk-heist .nums b,.gm.lk-heist .tm b{font-style:italic}
.gm.lk-heist .hd b{text-shadow:3px 3px 0 #12061f}.gm.lk-heist .pz{color:#ffe48a}
.gm.lk-arc{--bg:#141414;--acc:#f2c200;--hdink:#141414;--acc2:#e53b2c;--sub:#cfc6a8}.gm.lk-arc .bx::before{content:'';position:absolute;left:0;right:0;bottom:0;height:8px;background:repeating-linear-gradient(135deg,#f2c200 0 14px,#141414 14px 28px)}
.gm.lk-mgs{--bg:#03140a;--acc:#0d3a1d;--acc2:#3dff7a;--ink:#bfffd4;--sub:#7fdc9a;--track:rgba(61,255,122,.12)}.gm.lk-mgs .bx{border:2px solid #3dff7a;box-shadow:0 0 30px rgba(61,255,122,.35)}
.gm.lk-mgs .hd b,.gm.lk-mgs .nums b,.gm.lk-mgs .tm b{font-family:VT323,monospace;font-weight:400}.gm.lk-mgs .hd{color:#3dff7a}
.gm.lk-neon{--bg:#12061f;--acc:#7b3cf0;--acc2:#22d3ee;--sub:#d9c6ff}.gm.lk-neon .bx{border:3px solid #c58bff;box-shadow:0 0 30px #c58bff}
`;
    document.head.appendChild(s);
  }
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const left = () => !st ? 0 : st.running && st.endsAt ? Math.max(0, st.endsAt - (Date.now() + skew)) : st.left;
  function place() {
    const p = st.pos || 'tr', sc = (st.scale || 100) / 100, m = 40;
    const H = { l: 'left:' + (m + (st.x || 0)) + 'px', c: 'left:50%', r: 'right:' + (m - (st.x || 0)) + 'px' }[p[1]];
    const V = { t: 'top:' + (m + (p === 'tc' ? 30 : 0) + (st.y || 0)) + 'px', m: 'top:50%', b: 'bottom:' + (m + 70 - (st.y || 0)) + 'px' }[p[0]];
    const tx = (p[1] === 'c' ? 'translateX(calc(-50% + ' + (st.x || 0) + 'px)) ' : '') + (p[0] === 'm' ? 'translateY(calc(-50% + ' + (st.y || 0) + 'px)) ' : '');
    el.style.cssText = H + ';' + V + ';transform:' + tx + 'scale(' + sc + ');transform-origin:' + (p[1] === 'l' ? 'left' : p[1] === 'r' ? 'right' : 'center') + ' ' + (p[0] === 't' ? 'top' : p[0] === 'b' ? 'bottom' : 'center');
  }
  function clock() {
    if (!el || !st) return;
    const t = el.querySelector('.tm'); if (!t) return;
    const l = left();
    t.querySelector('b').textContent = st.ended ? '0:00' : fmt(l);
    t.classList.toggle('hot', st.running && l <= 10000 && l > 0); t.classList.toggle('pa', !!st.paused);
  }
  function draw(a) {
    const W = a.words || {}, L = a.look || 'football', pct = Math.max(0, Math.min(100, a.pct || 0));
    const fresh = !el;
    if (!el) { el = document.createElement('div'); (stage || document.body).appendChild(el); }
    const tm = a.mode === 'timer';
    el.className = 'gm lk-' + L + (a.hit && !tm ? ' hit' : '') + (tm ? ' tmode' : '');
    const tag = a.paused ? 'PAUSED' : a.ended ? (tm ? 'NOW' : 'CLOSED') : a.hit && !tm ? 'UNLOCKED' : 'LIVE';
    if (tm) {
      // countdown only: no target, just "GIVEAWAY IN 3:59:59"
      el.innerHTML = '<div class="bx"><div class="hd"><span class="ic">' + iconOf(L) + '</span><b>' + esc(W.title) + '</b><i>' + tag + '</i></div>' +
        (W.prize ? '<div class="pz">' + esc(W.prize) + '</div>' : '') +
        (a.winner ? '<div class="win"><small>WINNER</small><b>' + esc(a.winner.name) + '</b></div>' : a.ended ? '<div class="ban">' + esc(W.timeUp) + '</div>' : a.hideClock ? '<div class="ban open">ENTRIES OPEN</div>' : (a.hasTimer ? '<div class="tm"><span>' + esc(W.timer) + '</span><b></b></div>' : '')) +
        (W.enter && !a.ended && !a.winner ? '<div class="ln en">' + esc(W.enter) + '</div>' : '') +
        (a.showEntries && a.entries ? '<div class="ent"><em>' + a.entries + '</em> ENTERED' + (a.recent && a.recent.length ? ' · ' + a.recent.map(esc).join(', ') : '') + '</div>' : '') + '</div>';
      return after(a, L, fresh);
    }
    el.innerHTML = '<div class="bx"><div class="hd"><span class="ic">' + iconOf(L) + '</span><b>' + esc(W.title) + '</b><i>' + tag + '</i></div>' +
      (W.prize ? '<div class="pz">' + esc(W.prize) + '</div>' : '') +
      '<div class="bar"><div class="fill" style="width:' + pct + '%"></div><div class="head" style="left:' + pct + '%">' + iconOf(L) + '</div><div class="pc">' + Math.round(a.pct || 0) + '%</div></div>' +
      '<div class="nums"><b>' + fmtN(a.value) + '<small>/ ' + fmtN(a.goal) + '</small></b><span>' + esc(W.unit || '') + '</span></div>' +
      (a.winner ? '<div class="win"><small>WINNER</small><b>' + esc(a.winner.name) + '</b></div>' : a.ended ? '<div class="ban">' + esc(W.timeUp) + '</div>' : a.hit ? '<div class="ban">' + esc(W.done) + '</div>' : (W.sub ? '<div class="ln">' + esc(W.sub) + '</div>' : '')) +
      (W.enter && !a.ended && !a.winner ? '<div class="ln en">' + esc(W.enter) + '</div>' : '') +
      (a.hasTimer && !a.hideClock ? '<div class="tm"><span>' + esc(a.ended ? 'TIME' : W.timer) + '</span><b></b></div>' : '') +
      (a.showEntries && a.entries ? '<div class="ent"><em>' + a.entries + '</em> ENTERED' + (a.recent && a.recent.length ? ' · ' + a.recent.map(esc).join(', ') : '') + '</div>' : '') + '</div>';
    return after(a, L, fresh);
  }
  function after(a, L, fresh) {
    place(); clock();
    // long titles shrink to fit instead of being cut off
    const hb = el.querySelector('.hd b'); if (hb) { let fs = 36; while (hb.scrollWidth > hb.clientWidth + 1 && fs > 22) { fs -= 2; hb.style.fontSize = fs + 'px'; } }
    if (fresh || a.fx === 'show' || L !== lastLook) el.animate([{ opacity: 0, transform: el.style.transform + ' translateY(-30px)' }, { opacity: 1, transform: el.style.transform }], { duration: 500, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    lastLook = L;
    if (a.fx === 'bump' && lastVal != null && a.value > lastVal) {
      const p = document.createElement('div'); p.className = 'pop'; p.textContent = '+' + fmtN(a.value - lastVal); el.appendChild(p);
      p.animate([{ opacity: 0, transform: 'translateY(10px) scale(.6)' }, { opacity: 1, transform: 'translateY(-10px) scale(1.1)', offset: 0.25 }, { opacity: 0, transform: 'translateY(-50px)' }], { duration: 1500, fill: 'forwards' });
      el.querySelector('.bx').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 400 });
      snd('ding');
    }
    if (a.fx === 'goal') { el.querySelector('.bx').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12) rotate(-1deg)' }, { transform: 'scale(1)' }], { duration: 900 }); snd('fanfare'); snd('cheer', 0.3); }
    if (a.fx === 'timeup') { if (a.mode === 'timer') { const bn = el.querySelector('.ban'); if (bn) bn.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], { duration: 800 }); snd('fanfare'); snd('cheer', 0.3); } else snd('whistle'); }
    if (a.fx === 'winner') { el.querySelector('.win').animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], { duration: 800 }); snd('fanfare'); }
    lastVal = a.value;
  }
  const fmtN = (n) => { n = +n || 0; return Number.isInteger(n) ? String(n) : n.toFixed(1); };
  const snd = (n, at) => { try { if (st && st.sound !== false && window.SFX && SFX.play) SFX.play(n, at || 0); } catch (e) { /* no audio */ } };
  function event(a) {
    addCss();
    st = a; skew = (a.now || Date.now()) - Date.now();
    if (!a.on) { if (el) { const e2 = el; el = null; lastVal = null; e2.animate([{ opacity: 1 }, { opacity: 0, transform: e2.style.transform + ' translateY(-30px)' }], { duration: 400, fill: 'forwards' }).onfinish = () => e2.remove(); } return; }
    draw(a);
    clearInterval(tickT); tickT = setInterval(clock, 250);
  }
  return { init: (s) => { stage = s; }, event };
})();
