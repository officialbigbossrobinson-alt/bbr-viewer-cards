// Big leaderboards on stream: the top 3 as real cards on a podium, then the rest of the top 20 in columns.
window.LB = (function () {
  let stage = null, el = null, timer = null;
  const esc = (s) => BBR.esc(s);
  const PC = { twitch: '#9146ff', kick: '#53fc18', youtube: '#ff2a3d' };
  const CSS = `
  .lbb{position:absolute;left:160px;top:70px;width:1600px;height:940px;border-radius:26px;background:radial-gradient(ellipse at 50% 0%,rgba(28,42,34,.97),rgba(8,10,12,.97) 70%);border:2px solid var(--acc);box-shadow:0 30px 80px rgba(0,0,0,.6);z-index:6;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;overflow:hidden;animation:lbIn .7s cubic-bezier(.2,.9,.3,1.1) both}
  .lbb.out{animation:lbOut .5s ease-in both}
  @keyframes lbIn{from{opacity:0;transform:translateY(40px) scale(.96)}}
  @keyframes lbOut{to{opacity:0;transform:translateY(30px) scale(.97)}}
  .lbb .hd{text-align:center;margin-top:22px}
  .lbb .k{font-size:20px;font-weight:700;letter-spacing:9px;color:var(--acc)}
  .lbb .t{font-size:64px;font-weight:800;line-height:1;text-transform:uppercase}
  .lbb .pod{display:flex;justify-content:center;align-items:flex-end;gap:40px;margin-top:6px;height:360px}
  .lbb .pc{display:flex;flex-direction:column;align-items:center;gap:6px}
  .lbb .pc .cw{position:relative}
  .lbb .pc .nm{font-size:24px;font-weight:800;text-transform:uppercase;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lbb .pc .vl{font-size:18px;color:#c9d0d7;font-family:Inter,sans-serif}
  .lbb .pc .bk{width:220px;border-radius:10px 10px 0 0;display:flex;align-items:center;justify-content:center;font-size:44px;font-weight:800;color:#0b0d10}
  .lbb .rest{position:absolute;left:50px;right:50px;bottom:34px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 22px;grid-auto-flow:column;grid-template-rows:repeat(6,auto)}
  .lbb .rw{display:flex;align-items:center;gap:12px;padding:7px 14px;border-radius:10px;background:rgba(10,12,15,.85);border:1px solid #232831;opacity:0;animation:lbRow .4s ease-out forwards}
  @keyframes lbRow{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:none}}
  .lbb .rw .r{width:34px;font-size:24px;font-weight:800;color:#a7b0ba}
  .lbb .rw .d{width:9px;height:9px;border-radius:50%;flex-shrink:0}
  .lbb .rw .n{flex-grow:1;font-size:24px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lbb .rw .v{font-size:24px;font-weight:800}
  .lbb .rw .s{font-size:12px;font-weight:700;letter-spacing:1px;padding:1px 6px;border-radius:4px;background:#7b3cf0;color:#fff}
  .lbb .empty{position:absolute;inset:200px 0 0;text-align:center;font-size:30px;color:#c9d0d7}
  `;
  function init(o) { stage = o.stage; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  const TC = (t) => ({ legend: '#3dff9a', gold: '#f6d77a', silver: '#d9dee4', bronze: '#e0a26a' }[t] || '#e0a26a');
  const fmt = (a, r) => (a.cat === 'cards' ? '' + r.ovr : (Math.round(r.value * 10) / 10).toLocaleString() + ' ' + a.unit);
  function show(a) {
    if (!stage) return;
    hide(true);
    el = document.createElement('div'); el.className = 'lbb'; el.style.setProperty('--acc', a.accent || '#3dff9a');
    const R = a.rows || [];
    const pod = [R[1], R[0], R[2]].map((r, i) => {
      if (!r) return '<div class="pc" style="width:220px"></div>';
      const place = [2, 1, 3][i], sc = place === 1 ? 0.78 : 0.64, w = Math.round(260 * sc), h = Math.round(380 * sc);
      const c = r.card || { display: r.display, ovr: r.ovr, tier: r.tier, stats: {}, platform: (r.platforms || [])[0] };
      return '<div class="pc"><div class="cw ' + BBR.wrapClass(c.tier) + '" style="width:' + w + 'px;height:' + h + 'px"><div style="position:absolute;left:0;top:0;width:260px;height:380px;transform:scale(' + sc + ');transform-origin:0 0;transform-style:preserve-3d">' + BBR.render(c, { accent: a.accent, edges: 8, effects: place === 1 }) + '</div></div>' +
        (a.cat === 'cards' ? '' : '<div class="vl">' + esc(fmt(a, r)) + '</div>') +
        '<div class="bk" style="height:' + [56, 80, 40][i] + 'px;background:' + ['#d5dae0', '#f6d77a', '#d08a50'][i] + '">' + place + '</div></div>';
    }).join('');
    const rest = R.slice(3, 21).map((r, i) => '<div class="rw" style="animation-delay:' + (0.6 + i * 0.06).toFixed(2) + 's"><span class="r">' + (i + 4) + '</span><span class="d" style="background:' + (PC[(r.platforms || [])[0]] || '#888') + '"></span><span class="n">' + esc(r.display) + '</span>' + (r.sub ? '<span class="s">SUB</span>' : '') + '<span class="v" style="color:' + TC(r.tier) + '">' + esc(fmt(a, r)) + '</span></div>').join('');
    el.innerHTML = '<div class="hd"><div class="k">BBR VIEWER CLUB · ' + esc(a.periodLabel || 'ALL TIME') + '</div><div class="t">' + (a.cat === 'cards' ? 'TOP ' + Math.min(20, R.length || 20) + ' CARDS' : esc(a.label)) + '</div></div>' +
      (R.length ? '<div class="pod">' + pod + '</div><div class="rest">' + rest + '</div>' : '<div class="empty">Nobody on this board yet. Be the first!</div>');
    stage.appendChild(el);
    SFX.play('whoosh'); SFX.play('fanfare', 0.4);
    const me = el;
    timer = setTimeout(() => { if (el === me) hide(); }, (a.secs || 30) * 1000);
  }
  function hide(now) {
    clearTimeout(timer);
    if (!el) return;
    const e = el; el = null;
    if (now) { e.remove(); return; }
    e.classList.add('out'); setTimeout(() => e.remove(), 520);
  }
  return { init, show, hide, active: () => !!el };
})();
