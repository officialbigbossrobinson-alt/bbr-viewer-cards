/* BBR broadcast package: one TV look across the three battles (shootout, truck race, Queen raid).
   - intro sting when a battle's line-up is announced
   - "who's up" lower-third for each penalty
   - winner lower-third at the end
   - Light graphics mode (stops heavy effects so the game keeps its frames)  */
(function () {
  let stage = null, fighters = [], lt = null, ltT = null;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TIER = { bronze: '#e0a26a', silver: '#c9d0d8', gold: '#f6d77a' };
  const CSS = `
  .bcs{position:absolute;inset:0;z-index:40;pointer-events:none;overflow:hidden;font-family:'Barlow Condensed',sans-serif;color:#fff}
  .bcs .w1,.bcs .w2,.bcs .w3{position:absolute;top:-10%;bottom:-10%;width:140%;left:-20%;transform:skewX(-14deg) translateX(-120%)}
  .bcs .w1{background:var(--acc)}.bcs .w2{background:#0b0d10}.bcs .w3{background:linear-gradient(90deg,#0b0d10,#161a20)}
  .bcs .ct{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;opacity:0}
  .bcs .sh{width:120px;height:136px;clip-path:polygon(50% 0,100% 16%,100% 62%,50% 100%,0 62%,0 16%);background:var(--acc);display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:800;color:#0b0d10;letter-spacing:1px}
  .bcs .k{font-size:30px;letter-spacing:12px;color:var(--acc);font-weight:700}
  .bcs .t{font-size:150px;font-weight:800;line-height:.9;letter-spacing:4px;text-align:center}
  .bcs .vs{font-size:46px;font-weight:700;letter-spacing:3px;color:#dfe5ea;text-align:center;max-width:1500px}
  .bcs .vs i{font-style:normal;color:var(--acc);margin:0 18px}
  .bclt{position:absolute;left:60px;bottom:120px;z-index:38;display:flex;align-items:stretch;height:92px;pointer-events:none;font-family:'Barlow Condensed',sans-serif;color:#fff;box-shadow:0 18px 50px rgba(0,0,0,.55)}
  .bclt .r{width:92px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--tc,#3dff9a);color:#0b0d10;font-weight:800;line-height:.9}
  .bclt .r b{font-size:46px}.bclt .r small{font-size:15px;letter-spacing:2px}
  .bclt .m{background:rgba(9,11,14,.95);padding:8px 22px 8px 18px;display:flex;flex-direction:column;justify-content:center;min-width:360px}
  .bclt .m small{font-size:18px;letter-spacing:5px;color:var(--acc)}.bclt .m b{font-size:44px;line-height:1;letter-spacing:1px;white-space:nowrap}
  .bclt .x{background:#161a20;padding:0 18px;display:flex;flex-direction:column;justify-content:center;font-size:18px;letter-spacing:2px;color:#c3cad3}
  .bclt .x b{font-size:30px;color:#fff;letter-spacing:0}.bclt .cm{height:6px;width:150px;background:#2b313b;border-radius:3px;margin-top:4px;overflow:hidden}.bclt .cm i{display:block;height:100%;background:var(--acc)}
  .bclt.win{left:50%;transform:translateX(-50%);bottom:130px}.bclt.win .m small{color:#f6d77a}
  #stage.gfx-light *{backdrop-filter:none!important;filter:none!important}
  #stage.gfx-light .confetti,#stage.gfx-light .cf,#stage.gfx-light .rays,#stage.gfx-light .flare,#stage.gfx-light .lights,#stage.gfx-light .fl,#stage.gfx-light .spark,#stage.gfx-light .smoke{display:none!important}
  #stage.gfx-light .bcs .w1,#stage.gfx-light .bcs .w3{display:none}
  `;
  function init(o) { stage = o.stage; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  const acc = () => getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#3dff9a';
  function sting(a) {
    const names = (a.fighters || []).map((f) => f.display);
    const el = document.createElement('div'); el.className = 'bcs'; el.style.setProperty('--acc', a.accent || acc());
    const title = a.label || (a.mode === 'race' ? 'BBR HAULAGE CUP' : a.mode === 'arc' ? 'QUEEN RAID' : 'PENALTY SHOOTOUT');
    const vs = names.length === 2 ? esc(names[0]) + '<i>VS</i>' + esc(names[1]) : names.length ? esc(names.slice(0, 8).join(' · ')) + (names.length > 8 ? ' +' + (names.length - 8) : '') : '';
    el.innerHTML = '<div class="w1"></div><div class="w3"></div><div class="ct"><div class="sh">BBR</div><div class="k">LIVE ON BBR</div><div class="t">' + esc(title) + '</div>' + (vs ? '<div class="vs">' + vs + '</div>' : '') + '</div>';
    stage.appendChild(el);
    const ease = 'cubic-bezier(.7,0,.25,1)';
    el.querySelector('.w1').animate([{ transform: 'skewX(-14deg) translateX(-120%)' }, { transform: 'skewX(-14deg) translateX(0)', offset: 0.18 }, { transform: 'skewX(-14deg) translateX(0)', offset: 0.82 }, { transform: 'skewX(-14deg) translateX(120%)' }], { duration: 2600, easing: ease, fill: 'forwards' });
    el.querySelector('.w3').animate([{ transform: 'skewX(-14deg) translateX(-120%)' }, { transform: 'skewX(-14deg) translateX(-120%)', offset: 0.06 }, { transform: 'skewX(-14deg) translateX(0)', offset: 0.24 }, { transform: 'skewX(-14deg) translateX(0)', offset: 0.78 }, { transform: 'skewX(-14deg) translateX(120%)' }], { duration: 2600, easing: ease, fill: 'forwards' });
    el.querySelector('.ct').animate([{ opacity: 0, transform: 'scale(1.15)' }, { opacity: 0, offset: 0.22 }, { opacity: 1, transform: 'scale(1)', offset: 0.32 }, { opacity: 1, offset: 0.76 }, { opacity: 0 }], { duration: 2600, fill: 'forwards' });
    if (window.SFX) { SFX.play('whoosh', 0, 0.8); SFX.play('impact', 0.6); }
    setTimeout(() => el.remove(), 2650);
  }
  function lower(html, cls, ms, tc) {
    if (lt) { lt.remove(); lt = null; } clearTimeout(ltT);
    const el = document.createElement('div'); el.className = 'bclt ' + (cls || ''); el.style.setProperty('--acc', acc()); if (tc) el.style.setProperty('--tc', tc);
    el.innerHTML = html; stage.appendChild(el); lt = el;
    el.animate([{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], { duration: 450, easing: 'cubic-bezier(.2,.9,.3,1)' });
    ltT = setTimeout(() => { el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }); setTimeout(() => { el.remove(); if (lt === el) lt = null; }, 320); }, ms || 5000);
  }
  function card(f) { return '<div class="r"><b>' + (f.ovr || '') + '</b><small>' + esc(String(f.tier || '').toUpperCase().slice(0, 6)) + '</small></div>'; }
  function ev(a) {
    if (!stage || a.type !== 'battle') return;
    if (a.teams) {
      if (a.phase === 'matchup') return sting(Object.assign({}, a, { fighters: a.teams.sides.map((s) => ({ display: s.name })) }));
      if (a.phase === 'aim' && a.shooter) { const T = a.teams, sd = T.sides[a.s], comp = Array.isArray(a.comp) ? a.comp[a.s] : null, f = a.shooter;
        lower(card(f) + '<div class="m"><small>' + esc(sd.name) + ' · ' + (a.sd ? 'SUDDEN DEATH' : 'KICK ' + Math.min(T.size, sd.taken + 1) + ' OF ' + T.size) + ' · ' + T.sides.map((s) => s.score).join('–') + '</small><b>' + esc(String(f.display).toUpperCase()) + '</b></div>' +
          (comp != null ? '<div class="x">COMPOSURE<b>' + Math.round(comp) + '</b><div class="cm"><i style="width:' + Math.max(0, Math.min(100, comp)) + '%"></i></div></div>' : ''), '', 6500, sd.color); }
      if (a.phase === 'cancel' && lt) { lt.remove(); lt = null; }
      return;
    }
    if (a.phase === 'matchup') { fighters = a.fighters || []; sting(a); return; }
    if (a.phase === 'cancel') { if (lt) { lt.remove(); lt = null; } return; }
    if (a.mode === 'shootout' && a.phase === 'aim' && fighters[a.s]) {
      const f = fighters[a.s], comp = Array.isArray(a.comp) ? a.comp[a.s] : null, n = Math.floor(((a.kicks || []).length) / 2) + 1;
      lower(card(f) + '<div class="m"><small>' + (a.sd ? 'SUDDEN DEATH' : 'KICK ' + Math.min(n, 5) + ' OF 5') + ' · ' + (a.score ? a.score[0] + '–' + a.score[1] : '') + '</small><b>' + esc(String(f.display).toUpperCase()) + '</b></div>' +
        (comp != null ? '<div class="x">COMPOSURE<b>' + Math.round(comp) + '</b><div class="cm"><i style="width:' + Math.max(0, Math.min(100, comp)) + '%"></i></div></div>' : ''), '', 6500, TIER[f.tier] || acc());
      return;
    }
    if (a.phase === 'result') {
      const w = a.mode === 'shootout' ? (a.fighters || [])[a.winner] : (a.fighters || []).find((f) => f.place === 1 || f.win) || (a.order && (a.fighters || [])[a.order[0]]);
      if (!w) return;
      setTimeout(() => lower(card(w) + '<div class="m"><small>' + esc(a.label || 'WINNER') + ' · WINNER</small><b>' + esc(String(w.display).toUpperCase()) + '</b></div>', 'win', 6000, TIER[w.tier] || acc()), Math.min(4000, (a.outroMs || 4000) / 3));
    }
  }
  function light(on) { if (stage) stage.classList.toggle('gfx-light', !!on); }
  window.BC = { init, ev, light };
})();
