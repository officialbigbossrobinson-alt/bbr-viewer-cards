// Battle screen fillers: when a battle moves your Live scene into a corner, the rest of the screen would be
// empty. This paints a backdrop (with a hole where your game box is) and the widgets you placed on the
// settings page (Battles > Battle screen): how to play, battle leaderboard, and your channel links.
// It also tells the alert cards where your camera is, so they never sit on top of it.
window.SCREEN = (function () {
  let stage = null, root = null, st = null, previewT = null;
  const esc = (s) => BBR.esc(s);
  const CSS = `
  .scr{position:absolute;inset:0;pointer-events:none;z-index:0;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;opacity:0;transition:opacity .6s}
  .scr.on{opacity:1}
  .scr-rules .cmdbar{display:none}
  .scr .rl.sp{color:#f6d77a;font-size:14px}
  .scr .bd{position:absolute;background:var(--bdbg)}
  .scr.brand{--bdbg:radial-gradient(ellipse at 20% 0%,color-mix(in srgb,var(--acc) 18%,transparent),transparent 55%),radial-gradient(ellipse at 90% 100%,rgba(145,70,255,.14),transparent 50%),repeating-linear-gradient(115deg,rgba(255,255,255,.025) 0 2px,transparent 2px 22px),linear-gradient(160deg,#0f1420,#0a0c11 60%,#0d0f15)}
  .scr.dark{--bdbg:#0b0d10}
  .scr .wm{position:absolute;left:40px;bottom:30px;font-size:150px;font-weight:800;letter-spacing:6px;color:rgba(255,255,255,.03);white-space:nowrap}
  .scr .w{position:absolute;transform-origin:0 0}
  .scr .pane{box-sizing:border-box;width:100%;height:100%;border-radius:16px;background:rgba(10,12,15,.88);border:2px solid rgba(255,255,255,.1);padding:16px 18px;overflow:hidden;box-shadow:0 14px 40px rgba(0,0,0,.45)}
  .scr .ph{font-size:15px;font-weight:800;letter-spacing:4px;color:var(--acc);margin-bottom:8px}
  .scr .rl{font-family:Inter,sans-serif;font-size:15px;line-height:1.45;color:#d6dce3;margin:0 0 6px}
  .scr .rl b{color:#fff}
  .scr .kc{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}
  .scr .kc kbd{padding:2px 8px;border-radius:6px;background:#f2f5f7;color:#111;font-family:'Barlow Condensed',sans-serif;font-size:19px;font-weight:800;box-shadow:0 2px 0 #9aa4af}
  .scr .kc span{font-family:Inter,sans-serif;font-size:13px;color:#aab3bd}
  .scr .br{display:flex;align-items:center;gap:8px;height:34px;border-bottom:1px solid rgba(255,255,255,.06);font-size:19px;font-weight:700}
  .scr .br i{font-style:normal;width:20px;color:#9aa4af;font-weight:800}.scr .br:first-of-type i{color:#f6d77a}
  .scr .br em{font-style:normal;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase}
  .scr .br b{color:var(--acc)}
  .scr .soc{position:relative;width:100%;height:100%}
  .scr .sc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:16px;border:2px solid var(--c);background:linear-gradient(160deg,color-mix(in srgb,var(--c) 30%,#0a0c11),#0a0c11 70%);box-shadow:0 0 40px color-mix(in srgb,var(--c) 40%,transparent);opacity:0;transform:rotateY(70deg) scale(.9);transition:opacity .6s,transform .8s cubic-bezier(.3,1.3,.5,1)}
  .scr .sc.on{opacity:1;transform:none}
  .scr .sc .pl{font-size:22px;font-weight:800;letter-spacing:5px;color:var(--c)}
  .scr .sc .hd{font-size:38px;font-weight:800;line-height:1;text-align:center;white-space:nowrap;max-width:94%;overflow:hidden;text-overflow:ellipsis}
  .scr .sc .url{font-family:Inter,sans-serif;font-size:15px;color:#c9d0d7}
  .scr .sc .fl{padding:6px 16px;border-radius:999px;background:var(--c);color:#0a0c11;font-size:18px;font-weight:800;letter-spacing:2px;animation:scp 1.6s ease-in-out infinite}
  @keyframes scp{50%{transform:scale(1.07)}}
  `;
  const DESIGN = { rules: [560, 292], board: [300, 292], socials: [300, 292] };
  const SOC = [['twitch', 'TWITCH', '#9146ff', (h) => 'twitch.tv/' + h], ['kick', 'KICK', '#53fc18', (h) => 'kick.com/' + h], ['youtube', 'YOUTUBE', '#ff2a3d', (h) => 'youtube.com/' + (h.startsWith('@') ? h : '@' + h)]];
  let socT = null;

  function init(o) { stage = o.stage; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  function rectsAvoid() {
    const out = [];
    if (!st) return out;
    if (st.cam) out.push(st.cam);
    if (st.show && st.liveBox) out.push(st.liveBox);
    const cc = st.camCorner;
    if (!st.cam && cc && cc !== 'none') out.push({ x: /l$/.test(cc) ? 0 : 1920 - 560, y: /^t/.test(cc) ? 0 : 1080 - 340, w: 560, h: 340 });
    return out;
  }
  function on(a) {
    st = a;
    const cam = rectsAvoid(), zones = (a.zones || []).map((z) => Object.assign({ zone: true }, z));
    // avoid = everything cards should keep off (camera, Live box, Tangia / Streamlabs areas). cam = only the camera (for full-screen moments)
    window.BBR_SCREEN = { avoid: cam.concat(zones), cam: cam.filter((r) => r !== st.liveBox || st.show), zones, pos: (a.settings && a.settings.cards && a.settings.cards.pos) || 'auto', alerts: (a.settings && a.settings.alerts) || {}, ticker: false };
    render();
    clearTimeout(previewT);
    if (a.preview) previewT = setTimeout(() => { if (st) { st.show = false; render(); } }, a.preview * 1000);
  }
  function render() {
    if (!stage || !st) return;
    const S = st.settings || {};
    stage.classList.toggle('scr-rules', !!(st.show && S.widgets && S.widgets.rules && S.widgets.rules.on && st.cmds));
    if (!st.show) { if (root) { const r = root; root = null; r.classList.remove('on'); setTimeout(() => r.remove(), 650); } clearInterval(socT); return; }
    if (!root) { root = document.createElement('div'); root.className = 'scr'; stage.insertBefore(root, stage.firstChild); requestAnimationFrame(() => root && root.classList.add('on')); }
    root.style.setProperty('--acc', st.accent || '#3dff9a');
    root.className = 'scr on ' + (S.backdrop || 'brand');
    let h = '';
    // backdrop, with a hole where the Live box is
    if (S.backdrop !== 'none') {
      const b = st.liveBox;
      if (b) {
        h += '<div class="bd" style="left:0;top:0;width:1920px;height:' + b.y + 'px"></div>';
        h += '<div class="bd" style="left:0;top:' + (b.y + b.h) + 'px;width:1920px;height:' + (1080 - b.y - b.h) + 'px"></div>';
        h += '<div class="bd" style="left:0;top:' + b.y + 'px;width:' + b.x + 'px;height:' + b.h + 'px"></div>';
        h += '<div class="bd" style="left:' + (b.x + b.w) + 'px;top:' + b.y + 'px;width:' + (1920 - b.x - b.w) + 'px;height:' + b.h + 'px"></div>';
      } else h += '<div class="bd" style="inset:0"></div>';
      h += '<div class="wm">BIGBOSSROBINSON</div>';
    }
    const W = S.widgets || {};
    const box = (k, inner) => { const w = W[k], d = DESIGN[k], sc = Math.min(w.w / d[0], w.h / d[1]); return '<div class="w" style="left:' + w.x + 'px;top:' + w.y + 'px;width:' + d[0] + 'px;height:' + d[1] + 'px;transform:scale(' + sc.toFixed(3) + ')">' + inner + '</div>'; };
    if (W.rules && W.rules.on && st.cmds) {
      const c = st.cmds, chips = (list) => { let o = ''; for (let i = 0; i < (list || []).length; i += 2) o += (list[i] || []).map((x) => '<kbd>' + esc(x) + '</kbd>').join('') + (list[i + 1] ? '<span>' + esc(list[i + 1]) + '</span>' : ''); return o; };
      h += box('rules', '<div class="pane"><div class="ph">HOW TO PLAY · ' + esc(c.title) + '</div>' + (st.rules || []).map((l) => '<p class="rl">' + esc(l) + '</p>').join('') +
        '<div class="kc">' + chips(c.players) + '</div>' + (c.chat && c.chat.length ? '<div class="kc">' + chips(c.chat) + '</div>' : '') + (c.support ? '<p class="rl sp" style="margin-top:10px">' + esc(c.support) + '</p>' : '') + '</div>');
    }
    if (W.board && W.board.on) {
      const rows = st.board || [];
      h += box('board', '<div class="pane"><div class="ph">LEADERBOARD · WEEK</div>' + (rows.length ? rows.map((r, i) => '<div class="br"><i>' + (i + 1) + '</i><em>' + esc(r.display) + '</em><b>' + r.pts + '</b></div>').join('') : '<p class="rl">No battles yet this week. Type <b>!join</b> to get on the board!</p>') + '</div>');
    }
    if (W.socials && W.socials.on) {
      const so = S.socials || {};
      const cards = SOC.filter(([k]) => so[k]).map(([k, label, col, url], i) => '<div class="sc' + (i === 0 ? ' on' : '') + '" style="--c:' + col + '"><div class="pl">' + label + '</div><div class="hd" style="font-size:' + Math.min(38, Math.round(500 / Math.max(1, so[k].length))) + 'px">' + esc(so[k]) + '</div><div class="url">' + esc(url(so[k])) + '</div><div class="fl">FOLLOW</div></div>').join('');
      h += box('socials', '<div class="soc" style="perspective:900px">' + cards + '</div>');
    }
    root.innerHTML = h;
    clearInterval(socT);
    let k = 0;
    socT = setInterval(() => { if (!root) return clearInterval(socT); const list = root.querySelectorAll('.sc'); if (list.length < 2) return; list.forEach((x) => x.classList.remove('on')); k = (k + 1) % list.length; list[k].classList.add('on'); }, 4000);
  }
  return { init, on };
})();
