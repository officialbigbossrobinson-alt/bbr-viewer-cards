// On-screen extras: the next-battle countdown (top centre), the "what to type" bar for each battle,
// and the leaderboards (battles and support) that you call up from the settings page, chat or a Stream Deck.
window.HUD = (function () {
  let stage = null, timerEl = null, cmdEl = null, boardEl = null, boardTimer = null, tick = null;
  let next = null, nextAt = 0, corner = null;
  const esc = (s) => BBR.esc(s);
  const PCOL = { twitch: '#9146ff', kick: '#53fc18', youtube: '#ff2a3d' };
  const CSS = `
  .nbt{position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:6px 16px 6px 12px;border-radius:999px;background:rgba(10,12,15,.82);border:1px solid rgba(255,255,255,.14);font-family:'Barlow Condensed',sans-serif;font-size:21px;font-weight:700;letter-spacing:1.5px;color:#f2f5f7;white-space:nowrap;transition:opacity .5s,transform .5s;z-index:5}
  .nbt.hide{opacity:0;transform:translateX(-50%) translateY(-20px)}
  .nbt i{width:9px;height:9px;border-radius:50%;background:var(--acc);box-shadow:0 0 8px var(--acc)}
  .nbt b{font-variant-numeric:tabular-nums;color:var(--acc);min-width:52px;text-align:right}
  .nbt.soon{border-color:var(--acc);animation:nbtP 1s ease-in-out infinite}
  @keyframes nbtP{50%{box-shadow:0 0 0 3px var(--acc)}}
  .nbt.paused i{background:#ffb020;box-shadow:0 0 8px #ffb020}.nbt.paused b{color:#ffb020}
  .cmdbar{position:absolute;display:flex;align-items:stretch;gap:0;border-radius:12px;overflow:hidden;background:rgba(10,12,15,.92);border:2px solid var(--acc);font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;z-index:6;transition:opacity .4s;box-shadow:0 10px 30px rgba(0,0,0,.45)}
  .cmdbar.hide{opacity:0}
  .cmdbar .ct{display:flex;align-items:center;flex-shrink:0;white-space:nowrap;padding:0 16px;background:var(--acc);color:#06110b;font-size:20px;font-weight:800;letter-spacing:2px}
  .cmdbar .cg{display:flex;align-items:center;gap:8px;padding:9px 14px;white-space:nowrap;border-left:1px solid rgba(255,255,255,.12);flex-wrap:nowrap}
  .cmdbar .cl{font-size:13px;font-weight:800;letter-spacing:2px;color:#9aa4af}
  .cmdbar kbd{display:inline-block;padding:2px 8px;border-radius:6px;background:#f2f5f7;color:#111;font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:800;box-shadow:0 2px 0 #9aa4af;line-height:1.1}
  .cmdbar .cn{font-family:Inter,sans-serif;font-size:13.5px;color:#c3cad3;white-space:nowrap}
  .lbd{position:absolute;top:20px;width:640px;border-radius:16px;overflow:hidden;background:rgba(10,12,15,.94);border:2px solid var(--acc);font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;box-shadow:0 20px 60px rgba(0,0,0,.6);z-index:7;animation:lbdIn .6s cubic-bezier(.2,.9,.3,1.1) both}
  .lbd.out{animation:lbdOut .5s ease-in both}
  @keyframes lbdIn{from{opacity:0;transform:translateY(-30px) scale(.96)}}
  @keyframes lbdOut{to{opacity:0;transform:translateY(-30px)}}
  .lbd .lh{display:flex;justify-content:space-between;align-items:baseline;padding:12px 18px 8px;border-bottom:1px solid rgba(255,255,255,.1)}
  .lbd .lh b{font-size:30px;font-weight:800;letter-spacing:2px}.lbd .lh span{font-size:16px;font-weight:700;letter-spacing:4px;color:var(--acc)}
  .lbd table{width:100%;border-collapse:collapse}
  .lbd th{font-size:12px;font-weight:800;letter-spacing:2px;color:#9aa4af;text-align:right;padding:6px 10px 4px}
  .lbd th:nth-child(2){text-align:left}
  .lbd td{height:34px;padding:0 10px;font-size:20px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums;border-top:1px solid rgba(255,255,255,.05)}
  .lbd td.r{width:30px;text-align:center;color:#9aa4af;font-weight:800}
  .lbd tr.t1 td.r{color:#f6d77a}.lbd tr.t2 td.r{color:#d0d6dd}.lbd tr.t3 td.r{color:#d39a62}
  .lbd td.nm{text-align:left;font-size:21px;font-weight:800;text-transform:uppercase;max-width:250px}
  .lbd td.nm div{display:flex;align-items:center;gap:8px;overflow:hidden;white-space:nowrap}
  .lbd td.nm .av{width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#20262e;display:flex;align-items:center;justify-content:center;font-size:11px}
  .lbd td.nm em{font-style:normal;overflow:hidden;text-overflow:ellipsis}
  .lbd td.nm .pd{display:flex;gap:3px}.lbd td.nm .pd i{width:7px;height:7px;border-radius:50%}
  .lbd td.pt{color:var(--acc);font-weight:800}
  .lbd .empty{padding:22px 18px;font-family:Inter,sans-serif;font-size:16px;color:#c3cad3}
  .lbd .lf{padding:6px 18px 10px;font-family:Inter,sans-serif;font-size:12.5px;color:#8f99a5}
  .lbd tr{animation:rowIn .4s ease-out both}
  @keyframes rowIn{from{opacity:0;transform:translateX(-20px)}}
  `;
  function init(o) {
    stage = o.stage;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    timerEl = document.createElement('div'); timerEl.className = 'nbt hide'; stage.appendChild(timerEl);
    tick = setInterval(drawTimer, 1000);
  }
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  // ---------- next battle countdown ----------
  function nextBattle(a) {
    next = a; nextAt = Date.now() + a.inMs;
    if (a.accent) stage.style.setProperty('--acc', a.accent);
    drawTimer();
  }
  function drawTimer() {
    if (!timerEl || !next) return;
    const busy = next.running || (window.RACE && RACE.active()) || (window.PEN && PEN.active()) || (window.ARC && ARC.active());
    const show = next.show && next.live && next.enabled && !busy;
    timerEl.classList.toggle('hide', !show);
    if (!show) return;
    const left = nextAt - Date.now();
    timerEl.classList.toggle('paused', !!next.paused);
    timerEl.classList.toggle('soon', !next.paused && left <= 60000);
    timerEl.innerHTML = '<i></i>' + (next.paused ? 'BATTLES PAUSED' : 'NEXT BATTLE · ' + esc(next.label || '')) + ' <b>' + (next.paused ? '' : fmt(left)) + '</b>';
  }
  // ---------- what to type ----------
  function chips(list) {
    let h = '';
    for (let k = 0; k < list.length; k += 2) h += list[k].map((c) => '<kbd>' + esc(c) + '</kbd>').join(' ') + (list[k + 1] ? ' <span class="cn">' + esc(list[k + 1]) + '</span>' : '');
    return h;
  }
  function cmds(a) {
    const c = a.cmds; if (!c) return;
    if (next) { next.running = true; drawTimer(); }
    corner = c.corner || corner;
    if (!cmdEl) { cmdEl = document.createElement('div'); cmdEl.className = 'cmdbar'; stage.appendChild(cmdEl); }
    if (a.accent) stage.style.setProperty('--acc', a.accent);
    const join = a.phase === 'join';
    cmdEl.innerHTML = '<div class="ct">' + esc(join ? 'HOW TO PLAY' : c.title) + '</div>' +
      (join ? '<div class="cg"><span class="cl">JOIN</span> ' + chips([[c.join.split(' ')[0]], c.join.split(' ').slice(1).join(' ')]) + '</div>' : '') +
      '<div class="cg"><span class="cl">' + (a.mode === 'race' ? 'DRIVERS' : a.mode === 'arc' ? 'RAIDERS' : 'SHOOTER') + '</span> ' + chips(c.players) + '</div>' +
      (c.chat && c.chat.length ? '<div class="cg"><span class="cl">CHAT</span> ' + chips(c.chat) + '</div>' : '') +
      (c.chat && c.chat.length && (join || c.corner) ? '' : '<div class="cg"><span class="cl">CHEER</span> <span class="cn">' + esc(c.support) + '</span></div>');
    // during the join the game is still full screen, so sit under the join banner. Then sit just above the arena,
    // on the side away from the Live box (if OBS is moving it into a corner).
    const s = cmdEl.style; s.left = s.right = s.transform = ''; s.top = '';
    if (join) { s.left = '50%'; s.top = '236px'; s.transform = 'translateX(-50%)'; }
    else { s.top = '332px'; if (c.corner === 'tl') s.right = '40px'; else if (c.corner === 'tr') s.left = '40px'; else { s.left = '50%'; s.transform = 'translateX(-50%)'; } }
    cmdEl.classList.remove('hide');
    // keep it inside the free space next to the Live box
    requestAnimationFrame(() => { if (!cmdEl) return; const w = cmdEl.offsetWidth, max = c.corner && !join ? 1200 : 1840; cmdEl.style.zoom = w > max ? (max / w).toFixed(3) : ''; });
  }
  function cmdsOff() { if (cmdEl) { const el = cmdEl; cmdEl = null; el.classList.add('hide'); setTimeout(() => el.remove(), 500); } }
  // ---------- leaderboards ----------
  function board(a) {
    if (boardEl) { boardEl.remove(); boardEl = null; }
    if (a.accent) stage.style.setProperty('--acc', a.accent);
    clearTimeout(boardTimer);
    const busy = (window.RACE && RACE.active()) || (window.PEN && PEN.active()) || (window.ARC && ARC.active());
    const rows = a.rows.slice(0, busy ? 8 : 10);
    const el = document.createElement('div'); el.className = 'lbd';
    // leaderboard goes on the side away from the Live box and the camera
    const avoid = (window.BBR_SCREEN && BBR_SCREEN.avoid) || [];
    const hitL = avoid.some((o) => o.x < 700 && o.y < 700), hitR = avoid.some((o) => o.x + o.w > 1220 && o.y < 700);
    if (corner === 'tl' || a.corner === 'tl' || (hitL && !hitR)) el.style.right = '40px'; else el.style.left = '40px';
    const av = (r) => r.avatar && /^https:\/\//.test(r.avatar) ? '<img class="av" src="' + esc(r.avatar) + '" alt="" onerror="this.remove()">' : '<div class="av">' + esc(String(r.display).slice(0, 2).toUpperCase()) + '</div>';
    const name = (r) => '<td class="nm"><div>' + av(r) + '<em>' + esc(r.display) + '</em><span class="pd">' + (r.platforms || []).map((p) => '<i style="background:' + (PCOL[p] || '#ccc') + '"></i>').join('') + '</span></div></td>';
    const cur = a.currency || '£';
    let head, body, foot;
    if (a.kind === 'support') {
      head = '<tr><th></th><th>SUPPORTER</th><th>SUBS</th><th>GIFTED</th><th>BITS</th><th>KICKS</th><th>SUPER CHAT</th><th>PTS</th></tr>';
      body = rows.map((r, n) => '<tr class="t' + (n + 1) + '" style="animation-delay:' + (n * 0.06) + 's"><td class="r">' + (n + 1) + '</td>' + name(r) + '<td>' + r.sub + '</td><td>' + r.gift + '</td><td>' + r.bits.toLocaleString() + '</td><td>' + r.kicks.toLocaleString() + '</td><td>' + (r.superchat ? cur + (r.superchat / 100).toFixed(2) : '0') + '</td><td class="pt">' + r.pts + '</td></tr>').join('');
      foot = 'Twitch, Kick and YouTube together · 100 bits / Kicks / ' + cur + '1 Super Chat = 1 pt · a sub or gift = 5 pts';
    } else {
      head = '<tr><th></th><th>PLAYER</th><th>WINS</th><th>PLAYED</th><th>MVP</th><th>PTS</th></tr>';
      body = rows.map((r, n) => '<tr class="t' + (n + 1) + '" style="animation-delay:' + (n * 0.06) + 's"><td class="r">' + (n + 1) + '</td>' + name(r) + '<td>' + r.wins + '</td><td>' + r.played + '</td><td>' + r.mvp + '</td><td class="pt">' + r.pts + '</td></tr>').join('');
      foot = 'Shootout or race win 3 pts · race podium 1 · Queen Raid won 1 · raid MVP 2';
    }
    el.innerHTML = '<div class="lh"><b>' + (a.kind === 'support' ? 'TOP SUPPORTERS' : 'BATTLE LEADERBOARD') + '</b><span>' + esc(a.periodLabel || '') + '</span></div>' +
      (rows.length ? '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>' : '<div class="empty">Nothing yet ' + esc(String(a.periodLabel || '').toLowerCase()) + '. Be the first!</div>') + '<div class="lf">' + foot + '</div>';
    stage.appendChild(el); boardEl = el;
    if (window.SFX) { SFX.play('whoosh'); SFX.play('ding', 0.3); }
    boardTimer = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); if (boardEl === el) boardEl = null; }, 520); }, (a.secs || 20) * 1000);
  }
  return { init, nextBattle, cmds, cmdsOff, board };
})();
