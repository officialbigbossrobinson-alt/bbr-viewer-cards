/* v44 a frame around Tangia while it plays, in the look of the game on stream (football, elite, trucking, heist).
   BBR hears Tangia through OBS (or a channel point was just redeemed), then slides the frame in around the Tangia area. */
(function () {
  const css = `
.tf{position:absolute;pointer-events:none;z-index:57;opacity:0;transition:opacity .35s,transform .45s cubic-bezier(.2,1.2,.4,1);transform:scale(.96)}
.tf.on{opacity:1;transform:none}
.tf .b{position:absolute;inset:0}
.tf .lab{position:absolute;white-space:nowrap}
.tf.football .b{border:6px solid #fff;box-shadow:0 0 0 4px #e3132c,0 20px 40px rgba(0,0,0,.5)}
.tf.football .lab{left:-10px;top:-46px;display:flex;font:800 26px 'Barlow Condensed',sans-serif;color:#fff}
.tf.football .lab b{background:#e3132c;padding:4px 14px;letter-spacing:2px}.tf.football .lab span{background:#0b0f14;padding:4px 14px}
.tf.elite .b{border:2px solid #d9b45a;box-shadow:0 0 0 8px #0b0b0e,0 0 0 10px rgba(217,180,90,.5),0 0 60px rgba(217,180,90,.25)}
.tf.elite .c{position:absolute;width:34px;height:34px;border:4px solid #f3d58a}
.tf.elite .c1{left:-14px;top:-14px;border-right:0;border-bottom:0}.tf.elite .c2{right:-14px;top:-14px;border-left:0;border-bottom:0}.tf.elite .c3{left:-14px;bottom:-14px;border-right:0;border-top:0}.tf.elite .c4{right:-14px;bottom:-14px;border-left:0;border-top:0}
.tf.elite .lab{left:50%;top:-50px;transform:translateX(-50%);font:700 22px 'Barlow Condensed',sans-serif;letter-spacing:6px;color:#f3d58a;background:#0b0b0e;border-top:1px solid rgba(217,180,90,.5);border-bottom:1px solid rgba(217,180,90,.5);padding:4px 20px}
.tf.ets .b{border:14px solid #15181b;border-radius:18px;box-shadow:0 20px 40px rgba(0,0,0,.5),inset 0 0 0 2px #2c3237}
.tf.ets .lab{left:50%;top:-58px;transform:translateX(-50%);background:#1f6b3a;border:3px solid #fff;border-radius:8px;padding:4px 18px;font:700 22px Inter,sans-serif;color:#fff}
.tf.ets .rec{position:absolute;left:24px;top:22px;font:600 15px ui-monospace,Menlo,monospace;color:#fff;display:flex;gap:8px;align-items:center;text-shadow:0 1px 2px #000}
.tf.ets .rec i{width:10px;height:10px;border-radius:50%;background:#ff3b30;animation:tfBlink 1s steps(2) infinite}
@keyframes tfBlink{50%{opacity:0}}
.tf.heist .b{border:3px solid #ff4fd8;border-radius:6px;box-shadow:0 0 0 3px #1a0626,0 0 0 6px #3ee6ff,0 0 40px #ff4fd8,0 0 80px rgba(62,230,255,.4);animation:tfPulse 1.2s ease-in-out infinite}
@keyframes tfPulse{50%{box-shadow:0 0 0 3px #1a0626,0 0 0 6px #3ee6ff,0 0 70px #ff4fd8,0 0 120px rgba(62,230,255,.55)}}
.tf.heist .lab{left:50%;top:-66px;transform:translateX(-50%);font:800 44px 'Barlow Condensed',sans-serif;letter-spacing:6px;color:#ffe3fa;text-shadow:0 0 8px #ff4fd8,0 0 22px #ff4fd8}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  let stage = null, el = null, S = { on: true, look: 'auto' }, theme = 'football', rect = null, onNow = false, offT = null;
  function lookNow() { const L = S.look && S.look !== 'auto' ? S.look : theme; return /^(football|elite|ets|heist)$/.test(L) ? L : 'football'; }
  function html(L) {
    if (L === 'elite') return '<div class="b"></div><i class="c c1"></i><i class="c c2"></i><i class="c c3"></i><i class="c c4"></i><div class="lab">TANGIA</div>';
    if (L === 'ets') return '<div class="b"></div><div class="lab">Tangia · next exit</div><div class="rec"><i></i>REC</div>';
    if (L === 'heist') return '<div class="b"></div><div class="lab">TANGIA</div>';
    return '<div class="b"></div><div class="lab"><b>TANGIA</b><span>LIVE INTERACTION</span></div>';
  }
  function draw() {
    if (!stage) return;
    const want = onNow && S.on !== false && rect && !(window.EXTRAS && EXTRAS.panic && EXTRAS.panic());
    if (!want) { if (el) { const e = el; e.classList.remove('on'); clearTimeout(offT); offT = setTimeout(() => { if (e !== el || !onNow) { e.remove(); if (e === el) el = null; } }, 500); } return; }
    const L = lookNow();
    if (!el || el.dataset.look !== L) { if (el) el.remove(); el = document.createElement('div'); el.dataset.look = L; el.className = 'tf ' + L; el.innerHTML = html(L); stage.appendChild(el); }
    Object.assign(el.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
    requestAnimationFrame(() => el && el.classList.add('on'));
  }
  window.TFRAME = {
    init(o) { stage = o.stage; },
    state(a) { if (a && a.tangia) { S = Object.assign({ on: true, look: 'auto' }, a.tangia); draw(); } },
    theme(t) { theme = t || 'football'; if (el) { el.remove(); el = null; } draw(); },
    busy(a) { onNow = !!(a && a.busy && a.who === 'tangia'); if (a && a.rect) rect = a.rect; draw(); },
    look: () => lookNow(), shown: () => !!(el && el.classList.contains('on'))
  };
})();
