// v39 Giveaway spin on stream (the BBR overlay, or its own Browser Source at /spin).
// The app sends { type: 'spin', phase: idle | spin | claim | claimed | missed, names, winner, spinEndsAt, claimEndsAt, ... }.
// The reel is worked out from the clock, so a source that reloads mid-spin carries on in the same place.
window.SPIN = (function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const H = 92, ROWS = 5;   // row height on the reel, rows you can see
  const PF = { twitch: ['Twitch', '#9146FF'], kick: ['Kick', '#53FC18'], youtube: ['YouTube', '#FF0033'] };
  let stage = null, el = null, st = null, skew = 0, raf = 0, css = false, reel = null, lastRow = -1, music = null, cheer = null, shownId = null, shownPhase = null, hideT = null;
  const now = () => Date.now() + skew;
  function addCss() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `
.spn{position:absolute;left:50%;top:50%;z-index:60;width:1120px;transform:translate(-50%,-50%);font-family:'Barlow Condensed','Arial Narrow',sans-serif;color:#F2F5F9;pointer-events:none}
.spn *{box-sizing:border-box}
.spn .bx{position:relative;border-radius:22px;background:linear-gradient(170deg,#141a2b,#0b0f19 70%);border:2px solid rgba(232,196,104,.55);box-shadow:0 30px 90px rgba(0,0,0,.65),0 0 0 8px rgba(0,0,0,.25);overflow:hidden}
.spn .hd{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:22px 34px;background:linear-gradient(90deg,rgba(232,196,104,.2),rgba(232,196,104,0))}
.spn .hd b{font-size:56px;font-weight:800;letter-spacing:3px;line-height:1;text-transform:uppercase}
.spn .hd span{font-size:30px;font-weight:700;letter-spacing:1.5px;color:#E8C468;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:560px}
.spn .win{position:relative;height:${H * ROWS}px;margin:6px 34px 0;overflow:hidden;-webkit-mask-image:linear-gradient(transparent,#000 22%,#000 78%,transparent);mask-image:linear-gradient(transparent,#000 22%,#000 78%,transparent)}
.spn .band{position:absolute;left:0;right:0;top:${H * 2}px;height:${H}px;border-radius:16px;background:rgba(232,196,104,.12);border:3px solid #E8C468;box-shadow:0 0 40px rgba(232,196,104,.35) inset}
.spn .band::before,.spn .band::after{content:'';position:absolute;top:50%;margin-top:-18px;border:18px solid transparent}
.spn .band::before{left:0;border-left-color:#E8C468}.spn .band::after{right:0;border-right-color:#E8C468}
.spn .strip{position:absolute;left:0;right:0;top:0;will-change:transform}
.spn .row{height:${H}px;display:flex;align-items:center;justify-content:center;font-size:62px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;overflow:hidden;color:#E6EBF2}
.spn .ft{display:flex;justify-content:space-between;align-items:center;padding:16px 34px 22px;font-size:26px;font-weight:700;letter-spacing:2px;color:#9AA4B1;text-transform:uppercase}
.spn .ft em{font-style:normal;color:#E8C468}
.spn .test{position:absolute;right:30px;bottom:18px;font-size:20px;font-weight:800;letter-spacing:3px;color:#111;background:#ffb020;padding:3px 12px;border-radius:999px}
/* the winner */
.spn .who{padding:34px 34px 10px;text-align:center}
.spn .who small{display:block;font-size:30px;font-weight:800;letter-spacing:6px;color:#E8C468}
.spn .who b{display:block;font-size:118px;font-weight:800;line-height:1.05;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.spn .pf{display:inline-flex;align-items:center;gap:10px;margin-top:6px;font-size:26px;font-weight:700;letter-spacing:2px;color:#C9D1DB;text-transform:uppercase}.spn .pf i{width:16px;height:16px;border-radius:50%}
.spn .cl{margin:22px 34px 0;padding:22px 28px;border-radius:16px;background:#E8C468;color:#14110A;display:flex;align-items:center;justify-content:space-between;gap:20px}
.spn .cl span{font-size:44px;font-weight:800;letter-spacing:1px;text-transform:uppercase}.spn .cl span code{font:inherit;text-transform:none;background:#14110A;color:#E8C468;padding:0 14px;border-radius:10px}
.spn .cl b{font-size:84px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums;min-width:120px;text-align:right}
.spn .cl.hot b{animation:spP .8s ease-in-out infinite}@keyframes spP{50%{transform:scale(1.12)}}
.spn .tb{margin:14px 34px 0;height:12px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden}.spn .tb i{display:block;height:100%;background:#E8C468;border-radius:999px}
.spn .res{margin:22px 34px 0;padding:22px;border-radius:16px;text-align:center;font-size:76px;font-weight:800;letter-spacing:4px;line-height:1}
.spn .res.ok{background:#3dff9a;color:#06210f}.spn .res.no{background:#ff4d63;color:#fff}
.spn .res small{display:block;margin-top:8px;font-size:28px;letter-spacing:2px;font-weight:700;opacity:.85}
.spn .cf{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.spn .cf i{position:absolute;top:-30px;width:14px;height:24px;border-radius:3px;animation:spF linear forwards}
@keyframes spF{to{transform:translateY(900px) rotate(720deg);opacity:.2}}
`;
    document.head.appendChild(s);
  }
  // the long strip of names: the winner is row K, which lands in the middle when the clock runs out
  function build(a) {
    const N = a.names || [], w = N[0] || (a.winner && a.winner.display) || '?', others = N.slice(1);
    const T = Math.max(1, a.spinMs / 1000), K = Math.max(40, Math.min(640, Math.round(T * 8)));
    const rows = []; let r = Math.floor(Math.random() * 1000);
    for (let i = 0; i <= K + 3; i++) {
      if (i === K) { rows.push(w); continue; }
      // the winner can show up on the way too (it's a real list), just not right next to where it stops
      if (!others.length || (i % 11 === 5 && Math.abs(i - K) > 3)) rows.push(w); else rows.push(others[(r++) % others.length]);
    }
    return { K, rows, start: a.startedAt, end: a.spinEndsAt };
  }
  const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  function head(a) { return '<div class="hd"><b>' + esc(a.title || 'GIVEAWAY DRAW') + '</b>' + (a.prize ? '<span>' + esc(a.prize) + '</span>' : '') + '</div>'; }
  function drawSpin(a) {
    reel = build(a); lastRow = -1;
    el.innerHTML = '<div class="bx">' + head(a) + '<div class="win"><div class="strip">' + reel.rows.map((n) => '<div class="row">' + esc(n) + '</div>').join('') + '</div><div class="band"></div></div>' +
      '<div class="ft"><span><em>' + (a.names || []).length + (a.names && a.names.length > 60 ? '+' : '') + '</em> in the draw</span><span>Watch the gold line…</span></div>' + (a.test ? '<div class="test">TEST</div>' : '') + '</div>';
    // fit long names
    el.querySelectorAll('.row').forEach((r) => { let f = 62; while (r.scrollWidth > r.clientWidth + 1 && f > 30) { f -= 4; r.style.fontSize = f + 'px'; } });
    loop();
  }
  function loop() {
    cancelAnimationFrame(raf);
    const go = () => {
      if (!st || !el) return;
      if (st.phase === 'spin' && reel) {
        const x = (now() - reel.start) / Math.max(1, reel.end - reel.start), off = reel.K * H * ease(x);
        const s = el.querySelector('.strip'); if (s) s.style.transform = 'translateY(' + (2 * H - off) + 'px)';
        const row = Math.floor((off + H / 2) / H);
        if (row !== lastRow) { if (lastRow >= 0 && x < 1 && (!music || x > 0.6)) snd('tick'); lastRow = row; }
        if (x < 1) { raf = requestAnimationFrame(go); return; }
      }
      if (st.phase === 'claim') {
        const l = Math.max(0, (st.claimEndsAt || 0) - now()), c = el.querySelector('.cl b'), b = el.querySelector('.tb i');
        if (c) c.textContent = Math.ceil(l / 1000); if (b) b.style.width = (100 * l / Math.max(1, st.claimMs)) + '%';
        const cl = el.querySelector('.cl'); if (cl) cl.classList.toggle('hot', l <= 10000);
        if (l > 0) { raf = requestAnimationFrame(go); return; }
      }
    };
    raf = requestAnimationFrame(go);
  }
  function drawWho(a, res) {
    const p = PF[(a.winner && a.winner.platform) || 'twitch'] || PF.twitch;
    el.innerHTML = '<div class="bx">' + head(a) + '<div class="who"><small>' + (res === 'claimed' ? 'WINNER' : res === 'missed' ? 'PICKED' : 'THE WHEEL PICKED') + '</small><b>' + esc(a.winner ? a.winner.display : '') + '</b>' +
      '<span class="pf"><i style="background:' + p[1] + '"></i>' + p[0] + '</span></div>' +
      (res === 'claim' ? '<div class="cl"><span>Type <code>' + esc(a.cmd) + '</code> in chat to claim</span><b></b></div><div class="tb"><i></i></div>' :
        res === 'claimed' ? '<div class="res ok">CLAIMED!<small>Congratulations</small></div>' : '<div class="res no">NOT CLAIMED<small>' + esc(a.winner ? a.winner.display : '') + ' is out: spinning again</small></div>') +
      '<div class="ft"><span>' + (res === 'claim' ? 'Only ' + esc(a.winner ? a.winner.display : '') + '\'s own account counts' : '&nbsp;') + '</span><span></span></div>' + (a.test ? '<div class="test">TEST</div>' : '') + '</div>';
    const b = el.querySelector('.who b'); if (b) { let f = 118; while (b.scrollWidth > b.clientWidth + 1 && f > 50) { f -= 6; b.style.fontSize = f + 'px'; } }
    if (res === 'claimed') confetti();
    loop();
  }
  function confetti() {
    const box = document.createElement('div'); box.className = 'cf'; el.querySelector('.bx').appendChild(box);
    const C = ['#E8C468', '#3dff9a', '#4dc3ff', '#ff6b7d', '#ffffff', '#c58bff'];
    for (let i = 0; i < 90; i++) { const c = document.createElement('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = C[i % C.length]; c.style.animationDuration = (2 + Math.random() * 2.5) + 's'; c.style.animationDelay = (Math.random() * 1.2) + 's'; box.appendChild(c); }
  }
  // ---------- sound ----------
  const snd = (n, at) => { try { if (st && st.sounds !== false && window.SFX && SFX.play) SFX.play(n, at || 0); } catch (e) { /* no audio */ } };
  function stopMusic(fade) {
    const m = music; music = null; if (!m) return;
    if (!fade) { try { m.pause(); } catch (e) { /* ignore */ } return; }
    const v0 = m.volume, t0 = Date.now(); const f = setInterval(() => { const k = 1 - (Date.now() - t0) / 1200; if (k <= 0) { clearInterval(f); try { m.pause(); } catch (e) { /* ignore */ } } else m.volume = v0 * k; }, 60);
  }
  function startMusic(a) {
    stopMusic(false);
    if (!a.music || !a.music.url || a.sounds === false) return;
    try {
      music = new Audio(a.music.url); music.loop = true; music.volume = Math.max(0, Math.min(1, (a.musicVol == null ? 70 : a.musicVol) / 100));
      // join the song where it would be (a reload mid-spin doesn't start it from the top)
      const into = Math.max(0, (now() - (a.startedAt || now())) / 1000);
      if (into > 0.5) music.addEventListener('loadedmetadata', () => { try { if (isFinite(music.duration) && music.duration > 0) music.currentTime = into % music.duration; } catch (e) { /* ignore */ } }, { once: true });
      const p = music.play(); if (p && p.catch) p.catch(() => {});
    } catch (e) { music = null; }
  }
  function applause(a) {
    if (a.sounds === false) return;
    if (a.applause && a.applause.url) {
      try { if (cheer) cheer.pause(); cheer = new Audio(a.applause.url); cheer.volume = Math.max(0, Math.min(1, (a.applauseVol == null ? 90 : a.applauseVol) / 100)); const p = cheer.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
    } else { snd('fanfare'); snd('cheer', 0.25); }
  }
  // ---------- events ----------
  function hide() {
    cancelAnimationFrame(raf); stopMusic(true); clearTimeout(hideT);
    if (!el) return; const e2 = el; el = null; reel = null;
    e2.animate([{ opacity: 1, transform: 'translate(-50%,-50%)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.92)' }], { duration: 400, fill: 'forwards' }).onfinish = () => e2.remove();
  }
  function event(a) {
    addCss();
    st = a; skew = (a.now || Date.now()) - Date.now();
    if (!a.phase || a.phase === 'idle') { shownId = null; shownPhase = null; return hide(); }
    const fresh = !el;
    if (!el) { el = document.createElement('div'); el.className = 'spn'; (stage || document.body).appendChild(el); }
    const same = shownId === a.id && shownPhase === a.phase;
    if (same) return;   // settings pushes etc.: nothing to redraw
    const prev = shownPhase; shownId = a.id; shownPhase = a.phase;
    if (fresh) el.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.9)' }, { opacity: 1, transform: 'translate(-50%,-50%)' }], { duration: 450, easing: 'cubic-bezier(.2,1.3,.4,1)' });
    if (a.phase === 'spin') { drawSpin(a); startMusic(a); if (!a.music || a.sounds === false) snd('riser'); return; }
    stopMusic(a.phase === 'claim');
    if (a.phase === 'claim') { drawWho(a, 'claim'); if (prev === 'spin') { snd('impact'); snd('ding', 0.15); } el.querySelector('.bx').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 500 }); return; }
    if (a.phase === 'claimed') { drawWho(a, 'claimed'); if (prev === 'claim' || a.fx === 'claimed') applause(a); return; }
    if (a.phase === 'missed') { drawWho(a, 'missed'); if (prev === 'claim' || a.fx === 'missed') snd('whistle'); }
  }
  return { init: (s) => { stage = s; }, event };
})();
