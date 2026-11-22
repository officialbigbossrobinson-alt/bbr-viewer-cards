/* Team penalty shootout (3 v 3 / 5 v 5): join lobby, line-ups, the live team HUD over the 3D shootout, and the full-time card.
   Boss Sports News colours. The kicks themselves are drawn by penalty.js (same goal, same AI keeper). */
window.TPEN = (function () {
  let stage = null, lobby = null, hud = null, res = null, tick = null, last = null;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PL = { twitch: ['TW', '#b98cff'], kick: ['KICK', '#53fc18'], youtube: ['YT', '#ff6b6b'] };
  const play = (n, d, v) => { try { window.SFX && SFX.play(n, d, v); } catch (e) { /* no sound */ } };
  const CSS = `
  .tpl{position:absolute;left:50%;top:150px;width:1240px;transform:translateX(-50%);background:radial-gradient(ellipse at 50% 20%,#16337a,#0d2459 55%,#061233);color:#f6f7fa;font-family:'Barlow Condensed',sans-serif;box-shadow:0 30px 80px rgba(0,0,0,.6);overflow:hidden;animation:tpIn .55s cubic-bezier(.2,.9,.3,1.1) both;z-index:40}
  .tpl.out{animation:tpOut .45s ease-in both}
  .tpl .sw{position:absolute;left:-60px;right:-60px;bottom:40px;height:150px;background:#e3132c;opacity:.22;transform:skewY(-6deg)}
  .tpl .hd{position:relative;text-align:center;padding:26px 30px 10px}
  .tpl .k{font-size:20px;letter-spacing:7px;color:#f5c400;font-weight:700}
  .tpl .t{font-size:64px;font-weight:800;letter-spacing:2px;line-height:1}
  .tpl .h{font-size:22px;letter-spacing:2px;color:#c3cad3;margin-top:6px}.tpl .h b{color:#fff;padding:0 8px}
  .tpl .cols{position:relative;display:grid;gap:34px;padding:16px 40px 20px}
  .tpl .col{display:flex;flex-direction:column;gap:7px}
  .tpl .ch{display:flex;justify-content:space-between;align-items:center;padding:5px 14px;font-size:26px;font-weight:800;letter-spacing:2px}
  .tpl .sl{height:44px;display:flex;align-items:center;gap:10px;padding:0 14px;background:rgba(6,18,51,.85);font-size:24px;font-weight:700;border:2px solid transparent;animation:tpSlot .35s ease-out both}
  .tpl .sl.open{background:transparent;border:2px dashed rgba(255,255,255,.3);color:rgba(255,255,255,.5);animation:none}
  .tpl .sl .n{width:18px;font-size:17px;color:#a7b0ba}.tpl .sl .nm{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .tpl .sl .o{font-size:20px;color:#f5c400}.tpl .sl .c{background:#f5c400;color:#061233;font-size:14px;padding:0 6px;font-weight:800}
  .tpl .sl .ai{font-size:13px;letter-spacing:1px;color:#a7b0ba;border:1px solid #556;padding:0 5px}
  .tpl .pt{font-family:Inter,sans-serif;font-size:11px;font-weight:700;padding:2px 5px;border-radius:3px;color:#061233}
  .tpl .bn{position:relative;padding:0 40px 10px;font-size:18px;color:#f5c400;letter-spacing:1px;min-height:22px}
  .tpl .ft{position:relative;height:46px;background:#f6f7fa;color:#061233;display:flex;align-items:center;font-size:22px;font-weight:800}
  .tpl .ft .cd{background:#e3132c;color:#fff;height:100%;display:flex;align-items:center;padding:0 16px;min-width:70px;justify-content:center}
  .tpl .ft span:last-child{padding-left:14px}
  .tpl .shd{font-size:16px;background:#f5c400;color:#061233;padding:1px 8px;letter-spacing:1px}
  @keyframes tpIn{from{opacity:0;transform:translateX(-50%) translateY(40px) scale(.96)}to{opacity:1;transform:translateX(-50%)}}
  @keyframes tpOut{to{opacity:0;transform:translateX(-50%) translateY(-30px)}}
  @keyframes tpSlot{from{transform:translateX(-16px);opacity:0}to{transform:none;opacity:1}}
  .tph{position:absolute;left:180px;top:14px;width:1560px;height:376px;font-family:'Barlow Condensed',sans-serif;color:#f6f7fa;z-index:39;pointer-events:none;animation:tpFade .5s both}
  .tph .sb{position:absolute;left:50%;top:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px}
  .tph .sbr{display:flex;align-items:stretch;height:58px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
  .tph .tn{min-width:150px;padding:0 16px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;letter-spacing:2px}
  .tph .sc{background:#f6f7fa;color:#061233;min-width:62px;display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:800}
  .tph .tn.out{opacity:.45}
  .tph .sub{background:#061233;font-size:16px;font-weight:700;letter-spacing:3px;padding:3px 14px}.tph .sub.sd{background:#e3132c}
  .tph .bug{position:absolute;left:0;top:0;display:flex;height:40px}.tph .bug b{background:#e3132c;font-size:22px;letter-spacing:3px;padding:0 14px;display:flex;align-items:center}.tph .bug span{background:#0d2459;font-size:15px;letter-spacing:2px;padding:0 12px;display:flex;align-items:center;font-weight:700}
  .tph .ros{position:absolute;top:104px;display:flex;flex-direction:column;gap:5px}
  .tph .rh{display:flex;justify-content:space-between;align-items:center;font-size:19px;font-weight:800;letter-spacing:3px;padding:3px 12px}
  .tph .rr{display:flex;align-items:center;gap:9px;height:40px;padding:0 10px;background:rgba(6,18,51,.88);border-left:4px solid transparent;transition:background .3s}
  .tph .rr.now{background:rgba(245,196,0,.28);border-left-color:#f5c400}.tph .rr.nx{border-left-color:rgba(255,255,255,.55)}
  .tph .rr .n{width:14px;font-size:15px;color:#a7b0ba}.tph .rr .nm{flex:1;font-size:21px;font-weight:700;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .tph .rr .ks{display:flex;gap:4px}.tph .rr .ks i{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:15px;font-weight:800;color:#061233}
  .tph .rr .ks i.g{background:#3dff9a}.tph .rr .ks i.m{background:#ff6b7d}.tph .rr .ks i.w{background:rgba(255,255,255,.16)}
  .tph .rr .ks i.pop{animation:tpPop .5s cubic-bezier(.2,1.6,.4,1)}
  .tph .shd{align-self:flex-end;background:#f5c400;color:#061233;font-size:15px;font-weight:800;letter-spacing:2px;padding:2px 10px}
  .tph .pz{position:absolute;left:50%;top:120px;transform:translateX(-50%);background:#e3132c;font-size:30px;font-weight:800;letter-spacing:4px;padding:6px 20px}
  @keyframes tpPop{from{transform:scale(.2)}to{transform:scale(1)}}
  @keyframes tpFade{from{opacity:0}to{opacity:1}}
  .pen.teams .sb,.pen.teams .mc{display:none}
  .tpr{position:absolute;left:50%;top:120px;width:1560px;height:800px;transform:translateX(-50%);overflow:hidden;background:radial-gradient(ellipse at 30% 20%,#16337a,#0d2459 45%,#061233);color:#f6f7fa;font-family:'Barlow Condensed',sans-serif;box-shadow:0 30px 90px rgba(0,0,0,.65);z-index:41;animation:tpIn .6s cubic-bezier(.2,.9,.3,1.1) both}
  .tpr.out{animation:tpOut .5s ease-in both}
  .tpr .s1{position:absolute;left:-80px;right:-80px;top:520px;height:220px;background:#e3132c;opacity:.85;transform:skewY(-7deg)}
  .tpr .s2{position:absolute;left:-80px;right:-80px;top:575px;height:32px;background:#f5c400;transform:skewY(-7deg)}
  .tpr .wm{position:absolute;right:-30px;top:-90px;font-size:560px;font-weight:800;color:rgba(255,255,255,.045);line-height:1}
  .tpr .l{position:absolute;left:70px;top:56px;display:flex;flex-direction:column;gap:8px}
  .tpr .k{font-size:22px;letter-spacing:7px;color:#f5c400;font-weight:700}
  .tpr .w{font-size:104px;font-weight:800;line-height:.9;letter-spacing:1px}
  .tpr .scr{display:flex;align-items:stretch;height:64px;margin-top:10px}.tpr .scr span{display:flex;align-items:center;justify-content:center;padding:0 20px;font-size:28px;font-weight:800;letter-spacing:2px}.tpr .scr .v{background:#f6f7fa;color:#061233;font-size:46px;min-width:70px}
  .tpr .grid{position:absolute;left:70px;top:350px;display:flex;flex-direction:column;gap:10px}
  .tpr .gr{display:flex;align-items:center;gap:8px}.tpr .gr b{width:170px;font-size:22px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .tpr .gr i{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:22px;font-weight:800;color:#061233;border:3px solid transparent;box-sizing:border-box}
  .tpr .gr i.g{background:#3dff9a}.tpr .gr i.m{background:#ff6b7d}.tpr .gr i.sd{border-color:#f5c400}
  .tpr .mvp{position:absolute;right:80px;top:60px;display:flex;flex-direction:column;align-items:center;gap:10px}
  .tpr .mvp .lb{background:#f5c400;color:#061233;font-size:30px;font-weight:800;letter-spacing:6px;padding:4px 26px}
  .tpr .mvp .cw{width:260px;height:380px;position:relative}
  .tpr .mvp .nm{font-size:40px;font-weight:800;line-height:1}.tpr .mvp .ds{font-family:Inter,sans-serif;font-size:15px;color:#c3cad3;text-align:center;max-width:320px}
  .tpr .ft{position:absolute;left:0;right:0;bottom:0;height:60px;background:#f6f7fa;color:#061233;display:flex;align-items:center;font-size:24px;font-weight:800}
  .tpr .ft b{background:#e3132c;color:#fff;height:100%;display:flex;align-items:center;padding:0 18px;letter-spacing:2px}.tpr .ft span{padding-left:16px;flex:1}.tpr .ft em{font-style:normal;font-size:18px;color:#33404f;padding-right:18px}
  .tpr .conf{position:absolute;top:-20px;width:12px;height:22px;animation:tpConf linear forwards}
  @keyframes tpConf{to{transform:translateY(860px) rotate(720deg)}}`;
  function css() { if (!document.getElementById('tpen-css')) { const s = document.createElement('style'); s.id = 'tpen-css'; s.textContent = CSS; document.head.appendChild(s); } }
  const pt = (p) => p && PL[p] ? '<span class="pt" style="background:' + PL[p][1] + '">' + PL[p][0] + '</span>' : '';
  const word = (s, T) => T.make === 'platform' ? '' : T.make === 'random' ? '' : s.word;

  // ---------- the join lobby / line-ups ----------
  function lobbyHtml(a, lineups) {
    const T = a.teams, K = T.sides.length;
    const how = T.make === 'random' ? 'TYPE <b style="background:#e3132c">!join</b> · TEAMS DRAWN BY CARD RATING' : T.make === 'platform' ? 'TYPE <b style="background:#e3132c">!join</b> · PLAY FOR YOUR PLATFORM' :
      'TYPE ' + T.sides.map((s) => '<b style="background:' + s.color + '">!join ' + esc(s.word) + '</b>').join(' OR ') + ' · <b>!join</b> = WHERE YOU\'RE NEEDED';
    const cols = T.sides.map((s, si) => {
      let rows = '';
      for (let i = 0; i < T.size; i++) {
        const p = s.players[i];
        if (!p) { rows += '<div class="sl open">OPEN SLOT</div>'; continue; }
        rows += '<div class="sl"' + (lineups ? '' : ' style="animation-delay:0s"') + '>' + (lineups ? '<span class="n">' + (i + 1) + '</span>' : '') + '<span class="nm">' + esc(p.display) + '</span>' + (p.captain && a.captainOrder ? '<span class="c">C</span>' : '') + (p.bot ? '<span class="ai">AI</span>' : pt(p.platform)) + (lineups && p.ovr ? '<span class="o">' + p.ovr + '</span>' : '') + '</div>';
      }
      return '<div class="col"><div class="ch" style="background:' + s.color + (s.color === '#53fc18' ? ';color:#061233' : '') + '"><span>' + esc(s.name) + '</span><span>' + (lineups ? (s.shields ? '<span class="shd">' + s.shields + ' ON TARGET</span>' : '') : Math.min(T.size, s.players.length) + ' / ' + T.size) + '</span></div>' + rows + '</div>';
    }).join('');
    return '<div class="sw"></div><div class="hd"><div class="k">BOSS SPORTS NEWS PRESENTS</div><div class="t">' + T.size + ' v ' + T.size + (lineups ? ' · THE LINE-UPS' : ' PENALTY SHOOTOUT') + '</div>' +
      '<div class="h">' + (lineups ? 'SIDES TAKE TURNS · AI KEEPER IN GOAL · ' + (T.sides.some((s) => s.players.some((p) => p.captain)) && a.captainOrder ? 'CAPTAINS: <b>!order</b> NAME NAME NAME' : 'BEST PLAYER TAKES THE LAST KICK') : how) + '</div></div>' +
      '<div class="cols" style="grid-template-columns:repeat(' + K + ',minmax(0,1fr))">' + cols + '</div>' +
      '<div class="bn" id="tpbn">' + (!lineups && T.bench && T.bench.length ? 'BENCH: ' + T.bench.map(esc).join(', ') : lineups ? 'Bits / Kicks / Super Chat with "' + T.sides.map((s) => esc(s.word)).join('" or "') + '" = ON TARGET shots for that side' : '') + '</div>' +
      '<div class="ft"><span class="cd" id="tpcd">--</span><span id="tpft">' + (lineups ? 'KICK-OFF IN A MOMENT' : 'EMPTY SLOTS GET BENCH PLAYERS, THEN THE AI') + '</span></div>';
  }
  function countdown(a, label) {
    clearInterval(tick);
    const up = () => { const left = Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000)); const c = document.getElementById('tpcd'), f = document.getElementById('tpft'); if (c) c.textContent = left; if (f && label) f.textContent = label(left); if (left > 0 && left <= 5) play('tick'); };
    up(); tick = setInterval(up, 1000);
  }
  function join(a) {
    css(); clearAll();
    lobby = document.createElement('div'); lobby.className = 'tpl';
    lobby.innerHTML = lobbyHtml(a, false);
    stage.appendChild(lobby);
    play('whistle', 0, true); play('cheer', 0.3, 1.8);
    countdown(a, (l) => 'KICK-OFF IN ' + l + ' SECONDS · EMPTY SLOTS GET BENCH PLAYERS, THEN THE AI');
    last = a;
  }
  function count(a) {
    if (!lobby) return join(Object.assign({}, last || {}, a));
    const keep = last || a;
    lobby.innerHTML = lobbyHtml(a, false);
    countdown(keep, (l) => 'KICK-OFF IN ' + l + ' SECONDS · EMPTY SLOTS GET BENCH PLAYERS, THEN THE AI');
    play('ding');
  }
  function matchup(a) {
    css();
    if (!lobby) { lobby = document.createElement('div'); lobby.className = 'tpl'; stage.appendChild(lobby); }
    lobby.innerHTML = lobbyHtml(Object.assign({ captainOrder: a.teams.order === 'captain' }, a), true);
    countdown(a, (l) => 'KICK-OFF IN ' + l + ' SECONDS');
    play('boom', 0); play('whoosh', 0.1); play('cheer', 0.4, 3);
    last = a;
  }
  function order(a) { if (lobby) { lobby.innerHTML = lobbyHtml(Object.assign({ captainOrder: a.teams.order === 'captain' }, a), true); countdown(last || a, (l) => 'KICK-OFF IN ' + l + ' SECONDS'); } }
  function lobbyOut() { clearInterval(tick); if (lobby) { const l = lobby; l.classList.add('out'); setTimeout(() => l.remove(), 500); lobby = null; } }
  function boosted(a) {
    if (lobby && a.teams) { lobby.innerHTML = lobbyHtml(Object.assign({ captainOrder: a.teams.order === 'captain' }, a), true); countdown(last || a, (l) => 'KICK-OFF IN ' + l + ' SECONDS'); }
    if (hud) draw(a);
    play('shield'); play('ding', 0.1);
  }

  // ---------- the live HUD above the shootout ----------
  function draw(a, pop) {
    css();
    const T = a.teams, K = T.sides.length;
    if (!hud) { hud = document.createElement('div'); hud.className = 'tph'; stage.appendChild(hud); }
    const sh = T.shooter, nx = T.next, N = T.size;
    const maxTaken = Math.max(...T.sides.map((s) => s.taken));
    const minTaken = Math.min(...T.sides.filter((s) => !s.out).map((s) => s.taken));
    const sub = T.sd ? 'SUDDEN DEATH' : sh ? 'KICK ' + Math.min(N, T.sides[sh.side].taken + 1) + ' OF ' + N + ' · ' + T.sides[sh.side].name + ' TO SHOOT' : 'KICK ' + Math.min(N, minTaken + 1) + ' OF ' + N;
    const score = T.sides.map((s, i) => (i ? '<span class="sc" style="background:#061233;color:#a7b0ba;min-width:26px;font-size:28px">-</span>' : '') + '<span class="tn' + (s.out ? ' out' : '') + '" style="background:' + s.color + (s.color === '#53fc18' ? ';color:#061233' : '') + '">' + esc(s.name) + '</span><span class="sc">' + s.score + '</span>').join('');
    const W = K === 3 ? 500 : 430, X = K === 3 ? [0, 530, 1060] : [0, 1560 - 430];
    const ros = T.sides.map((s, si) => {
      const rows = s.players.map((p, pi) => {
        const now = sh && sh.side === si && sh.idx === pi, nxt = !now && nx && nx.side === si && nx.idx === pi;
        let ks = p.res.map((r, k) => '<i class="' + r + (pop && pop.s === si && pop.pi === pi && k === p.res.length - 1 ? ' pop' : '') + '">' + (r === 'g' ? '✓' : '✕') + '</i>').join('');
        if (!p.res.length) ks = '<i class="w"></i>';
        return '<div class="rr' + (now ? ' now' : nxt ? ' nx' : '') + '"><span class="n">' + (pi + 1) + '</span><span class="nm">' + esc(p.display) + '</span>' + (p.bot ? '<span class="pt" style="background:#a7b0ba">AI</span>' : pt(p.platform)) + '<span class="ks">' + ks + '</span></div>';
      }).join('');
      return '<div class="ros" style="left:' + X[si] + 'px;width:' + W + 'px"><div class="rh" style="background:' + s.color + (s.color === '#53fc18' ? ';color:#061233' : '') + '"><span>' + esc(s.name) + '</span><span>' + s.score + '</span></div>' + rows + (s.shields ? '<span class="shd">' + s.shields + ' ON-TARGET SHOT' + (s.shields > 1 ? 'S' : '') + '</span>' : '') + '</div>';
    }).join('');
    hud.innerHTML = (K > 2 ? '' : '<div class="bug"><b>PENALTIES</b><span>BOSS SPORTS NEWS · ' + N + ' v ' + N + '</span></div>') +
      '<div class="sb"><div class="sbr">' + score + '</div><span class="sub' + (T.sd ? ' sd' : '') + '">' + sub + '</span></div>' + ros + (T.paused ? '<div class="pz">PAUSED AFTER THIS KICK</div>' : '');
  }
  function start(a) { lobbyOut(); draw(a); }
  function aim(a) { draw(a); }
  function kick(a) { setTimeout(() => { if (hud) draw(a, a.k ? { s: a.k.s, pi: a.k.pi } : null); }, 1400); }
  function paused(a) { if (hud) draw(a); }

  // ---------- full time ----------
  function result(a, done) {
    css(); lobbyOut();
    const T = a.teams, w = T.sides[a.winner];
    if (hud) { hud.remove(); hud = null; }
    res = document.createElement('div'); res.className = 'tpr';
    const N = T.size;
    const grid = T.sides.map((s, si) => {
      const ks = [];
      // the kicks in the order they were taken: the order list repeats in sudden death
      for (let r = 0; r < s.taken; r++) { const p = s.players[r % N], k = p.res[Math.floor(r / N)]; ks.push('<i class="' + (k || 'm') + (r >= N ? ' sd' : '') + '">' + (k === 'g' ? '✓' : '✕') + '</i>'); }
      return '<div class="gr"><b style="color:' + s.color + '">' + esc(s.name) + '</b>' + ks.join('') + '</div>';
    }).join('');
    const m = a.mvp;
    let mvp = '';
    if (m) {
      let cardHtml = '';
      try { cardHtml = '<div class="' + BBR.wrapClass(m.tier) + '"><div class="cw">' + BBR.render(Object.assign({}, m, { ribbon: 'MVP' }), { accent: a.accent || '#f5c400' }) + '</div></div>'; } catch (e) { cardHtml = '<div class="cw" style="background:#e3132c"></div>'; }
      mvp = '<div class="mvp"><span class="lb">MVP</span>' + cardHtml + '<span class="nm">' + esc(String(m.display).toUpperCase()) + '</span><span class="ds">' + (a.sd ? 'Scored the sudden-death winner' : m.goals + ' goal' + (m.goals === 1 ? '' : 's') + ' for ' + esc(T.sides[m.side].name)) + '. MVP badge on their card.</span></div>';
    }
    const R = a.rewards || {};
    res.innerHTML = '<div class="s1"></div><div class="s2"></div><div class="wm">BSN</div>' +
      '<div class="l"><span class="k">FULL TIME' + (a.sd ? ' · AFTER SUDDEN DEATH' : '') + '</span><span class="w">' + esc(w.name) + ' WIN</span>' +
      '<div class="scr">' + T.sides.map((s, i) => (i ? '<span class="v" style="min-width:30px;padding:0 6px">-</span>' : '') + '<span style="background:' + s.color + (s.color === '#53fc18' ? ';color:#061233' : '') + '">' + esc(s.name) + '</span><span class="v">' + s.score + '</span>').join('') + '</div></div>' +
      '<div class="grid">' + grid + '</div>' + mvp +
      '<div class="ft"><b>BOSS</b><span>CARD POINTS: WIN +' + (R.win || 0) + ' · EVERY GOAL +' + (R.goal || 0) + (R.mvpDouble ? ' · MVP DOUBLE' : '') + ' · TAKING PART +' + (R.lose || 0) + '</span><em>!card to see yours</em></div>';
    const cols = [w.color, '#f5c400', '#ffffff', '#e3132c'];
    for (let i = 0; i < 80; i++) { const c = document.createElement('div'); c.className = 'conf'; c.style.left = Math.random() * 1560 + 'px'; c.style.background = cols[i % cols.length]; c.style.animationDuration = (2.2 + Math.random() * 2.5) + 's'; c.style.animationDelay = (Math.random() * 1.2) + 's'; res.appendChild(c); }
    stage.appendChild(res);
    play('impact', 0); play('fanfare', 0.15); play('cheer', 0.2, 4);
    const ms = a.outroMs || 12000;
    setTimeout(() => { if (res) res.classList.add('out'); }, ms - 600);
    setTimeout(() => { clearAll(); if (done) done(); }, ms);
  }
  function clearAll() {
    clearInterval(tick); tick = null;
    for (const el of [lobby, hud, res]) if (el) el.remove();
    lobby = hud = res = null;
  }
  return { init: (o) => { stage = o.stage; }, join, count, matchup, order, boosted, start, aim, kick, paused, result, clear: clearAll, active: () => !!(lobby || hud || res) };
})();
