// Draws a BBR shield plaque card as HTML. Used by the overlay and the dashboard.
(function () {
  function shield(w, h) {
    const f = (n) => n.toFixed(1);
    const n = w * 0.077, p = h * 0.028, s = h * 0.08, hw = w * 0.12;
    return 'M0 ' + f(s) + ' L' + f(n) + ' ' + f(p) + ' H' + f(w / 2 - hw) + ' L' + f(w / 2) + ' 0 L' + f(w / 2 + hw) + ' ' + f(p) +
      ' H' + f(w - n) + ' L' + f(w) + ' ' + f(s) + ' V' + f(h * 0.52) +
      ' C' + f(w) + ' ' + f(h * 0.77) + ' ' + f(w * 0.76) + ' ' + f(h * 0.9) + ' ' + f(w / 2) + ' ' + f(h) +
      ' C' + f(w * 0.24) + ' ' + f(h * 0.9) + ' 0 ' + f(h * 0.77) + ' 0 ' + f(h * 0.52) + ' Z';
  }
  function box(l, t, w, h) {
    return 'left:' + l + 'px;top:' + t + 'px;width:' + w + 'px;height:' + h + 'px;clip-path:path(\'' + shield(w, h) + '\')';
  }
  const S = { outer: box(0, 0, 260, 380), bevel: box(4, 4, 252, 370), groove: box(13, 13, 234, 354), face: box(16, 16, 228, 346) };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function tier(t, acc) {
    const T = {
      bronze: {
        label: 'BRONZE', fx: 'smoke', color: '#c8894f',
        rim: 'linear-gradient(160deg,#8a5228,#3e220c)', bevel: 'linear-gradient(160deg,#ffd2a3,#c98a52 30%,#7a4520 60%,#e0a26a 85%,#8a5228)',
        edge: '#2e1808', groove: '#140a03', ink: '#f0c59a', statC: '#ffe2c4', plateInk: '#2a1505', ring: '#e0a26a', avBg: '#2e1a0a',
        face: 'repeating-linear-gradient(90deg,rgba(255,226,196,.05) 0px,rgba(255,226,196,.05) 1px,transparent 1px,transparent 3px),repeating-linear-gradient(90deg,rgba(0,0,0,.12) 0px,rgba(0,0,0,.12) 1px,transparent 1px,transparent 7px),linear-gradient(170deg,#4a2c16,#1f1208)'
      },
      silver: {
        label: 'SILVER', fx: 'frost', color: '#c9ced6',
        rim: 'linear-gradient(160deg,#7f8a96,#333a42)', bevel: 'linear-gradient(160deg,#ffffff,#c9d0d8 30%,#7f8a96 60%,#eef1f4 85%,#8f99a5)',
        edge: '#2b3138', groove: '#0a0d10', ink: '#dde3ea', statC: '#ffffff', plateInk: '#12161b', ring: '#c9d0d8', avBg: '#1b2129',
        face: 'repeating-linear-gradient(45deg,rgba(255,255,255,.06) 0px,rgba(255,255,255,.06) 3px,transparent 3px,transparent 6px),repeating-linear-gradient(-45deg,rgba(0,0,0,.35) 0px,rgba(0,0,0,.35) 3px,transparent 3px,transparent 6px),linear-gradient(170deg,#2a323d,#10141a)'
      },
      gold: {
        label: 'GOLD', fx: 'fire', color: '#f6d77a',
        rim: 'linear-gradient(160deg,#a47414,#4f3806)', bevel: 'linear-gradient(160deg,#fff1b8,#e8bd52 30%,#a47414 60%,#f6d77a 85%,#b8861f)',
        edge: '#3a2904', groove: '#100b02', ink: '#f6d77a', statC: '#fff1b8', plateInk: '#2a1c00', ring: '#f6d77a', avBg: '#241a05',
        face: 'radial-gradient(circle,rgba(246,215,122,.16) 1px,transparent 1.6px) 0 0/9px 9px,radial-gradient(circle,rgba(246,215,122,.08) 1px,transparent 1.6px) 4.5px 4.5px/9px 9px,linear-gradient(170deg,#3a2c0a,#140e03)'
      },
      legend: {
        label: 'LEGEND', fx: 'lightning', color: acc,
        rim: 'linear-gradient(160deg,#3a434c,#07080a)', bevel: 'linear-gradient(160deg,#8a96a3,#2b3238 30%,#0b0d10 60%,#59636e 85%,#14181c)',
        edge: acc, groove: acc, ink: '#f2f5f7', statC: acc, plateInk: acc, ring: acc, avBg: '#0b0d10',
        face: 'repeating-linear-gradient(135deg,transparent 0px,transparent 17px,' + acc + '22 17px,' + acc + '22 18px),repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0px,rgba(255,255,255,.04) 3px,transparent 3px,transparent 6px),repeating-linear-gradient(-45deg,rgba(0,0,0,.4) 0px,rgba(0,0,0,.4) 3px,transparent 3px,transparent 6px),linear-gradient(170deg,#141a1f,#040506)'
      }
    };
    return T[t] || T.bronze;
  }

  const RIBBONS = {
    'SUPPORTER 10': ['linear-gradient(180deg,#9a6bff,#5a2fc0)', '#fff'], 'BENEFACTOR 25': ['linear-gradient(180deg,#9a6bff,#5a2fc0)', '#fff'],
    'PATRON 50': ['linear-gradient(180deg,#c58bff,#7b3cf0)', '#fff'], 'LEGEND 100': ['linear-gradient(180deg,#f6d77a,#7b3cf0)', '#fff'], 'HALL OF FAME 250': ['linear-gradient(180deg,#fff1b8,#c58bff)', '#2a0f4a'],
    'THE BOSS': null, // uses the accent colour
    '1 YEAR SUB': ['linear-gradient(180deg,#2f6fe0,#1a3f8f)', '#ffffff'],
    'RAID HERO': ['linear-gradient(180deg,#d42a3c,#8a1020)', '#ffe9a8'],
    'NEW SIGNING': ['linear-gradient(180deg,#d42a3c,#8a1020)', '#ffe9a8'],
    'SHOOTOUT KING': ['linear-gradient(180deg,#2a2a2a,#050505)', '#f6d77a'],
    'KING OF THE ROAD': ['linear-gradient(180deg,#ff9a2e,#b4500a)', '#1a0d00'],
    '1ST PLACE': ['linear-gradient(180deg,#f6d77a,#b8861f)', '#2a1c00'],
    'WINNER': ['linear-gradient(180deg,#f6d77a,#b8861f)', '#2a1c00'],
    'MVP': ['linear-gradient(180deg,#fff1b8,#c99a2a)', '#2a1c00'], 'BOSS SLAYER': ['linear-gradient(180deg,#d42a3c,#3a0000)', '#fff'], 'SUPER SUB': ['linear-gradient(180deg,#3dff9a,#0f7a45)', '#06110b']
  };

  function rng(seed) {
    let s = seed;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }
  const px = (n) => n.toFixed(0) + 'px';
  function particles(kind) {
    const r = rng(kind.length * 7 + 3);
    let h = '';
    const add = (cls, l, t, w, hh, delay, dur) => {
      h += '<div class="' + cls + '" style="left:' + px(l) + ';top:' + px(t) + ';width:' + px(w) + ';height:' + px(hh) +
        ';animation-delay:' + delay.toFixed(2) + 's;animation-duration:' + dur.toFixed(2) + 's"></div>';
    };
    if (kind === 'flames') {
      for (let i = 0; i < 22; i++) {
        const side = i % 3;
        const l = side === 0 ? -34 + r() * 26 : side === 1 ? 226 + r() * 26 : 20 + r() * 200;
        const t = side === 2 ? -24 + r() * 30 : 30 + r() * 230;
        add('bbr-flame', l, t, 30 + r() * 22, 46 + r() * 30, -r() * 1.4, 0.9 + r() * 0.7);
      }
    } else if (kind === 'embers') {
      for (let i = 0; i < 12; i++) { const z = 3 + r() * 3; add('bbr-ember', -20 + r() * 300, 140 + r() * 240, z, z, -r() * 3, 2 + r() * 1.5); }
    } else if (kind === 'smoke') {
      for (let i = 0; i < 12; i++) {
        const side = i % 3;
        const l = side === 0 ? -70 + r() * 40 : side === 1 ? 210 + r() * 40 : 20 + r() * 160;
        const t = side === 2 ? -50 + r() * 40 : 60 + r() * 260;
        const z = 80 + r() * 50;
        add('bbr-smoke', l, t, z, z, -r() * 5, 4 + r() * 2);
      }
    } else if (kind === 'sparks') {
      for (let i = 0; i < 14; i++) { const z = 9 + r() * 9; add('bbr-spark', -16 + r() * 284, -16 + r() * 380, z, z, -r() * 2.4, 1.4 + r() * 1.2); }
    }
    return h;
  }

  const BOLTS = [
    ['bbr-z1', 'M30 90 L46 128 L26 166 L48 206 L28 250 L50 290 L44 320'],
    ['bbr-z2', 'M312 100 L292 140 L314 180 L290 222 L312 262 L292 300 L298 326'],
    ['bbr-z3', 'M80 40 L124 50 L170 26 L214 50 L260 40'],
    ['bbr-z4', 'M70 340 L104 370 L120 392 L166 424'],
    ['bbr-z5', 'M272 340 L238 368 L222 394 L176 424']
  ];

  function render(c, opts) {
    opts = opts || {};
    const acc = opts.accent || '#3dff9a';
    const T = tier(c.tier, acc);
    const fx = opts.effects === false ? null : T.fx;
    const name = String(c.display || '');
    const nameSize = name.length <= 11 ? 22 : name.length <= 15 ? 19 : 16;
    const initials = esc(name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?');
    const avatarOk = c.avatar && /^https:\/\/(static-cdn\.jtvnw\.net|yt\d\.ggpht\.com|yt\d\.googleusercontent\.com|lh\d\.googleusercontent\.com|files\.kick\.com)\//.test(c.avatar);
    const avatar = avatarOk
      ? '<div class="bbr-av" style="background:' + T.avBg + ';color:' + T.ink + ';border:3px solid ' + T.ring + ';position:relative;overflow:hidden">' + initials +
        '<img src="' + esc(c.avatar) + '" alt="" onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%"></div>'
      : '<div class="bbr-av" style="background:' + T.avBg + ';color:' + T.ink + ';border:3px solid ' + T.ring + '">' + initials + '</div>';
    if (c.style && c.style !== 'fc' && STYLES[c.style]) return styled(c, opts, acc, T, initials, avatarOk);
    // big stats with a bar each (they fill the lower half of the shield)
    const stats = KEYS.map((k) => { const n = Number((c.stats || {})[k] != null ? c.stats[k] : (c.stats || {}).BIT || 40); return '<div class="bbr-st"><div class="bbr-stn"><b>' + n + '</b><span style="color:' + T.statC + '">' + k + '</span></div><i><u style="width:' + Math.max(4, Math.round((n - 40) / 59 * 100)) + '%;background:' + T.statC + '"></u></i></div>'; }).join('');
    const sb = subBand(c);
    const sk = c.streak || {}, lvl = sk.level || 0, SC = STREAK_C[lvl] || null;

    let h = '<div class="bbr-card' + (lvl ? ' bbr-streak bbr-sk' + lvl : '') + '" style="--acc:' + acc + (SC ? ';--sk:' + SC : '') + '"><div class="bbr-tilt">';
    if (lvl) h += '<div class="bbr-skglow"></div>';
    if (lvl >= 2 && opts.effects !== false) h += '<div class="bbr-fxb bbr-skfx">' + particles('flames') + '</div>';
    if (fx === 'lightning') h += '<div class="bbr-fxb"><div class="bbr-aura"></div></div>';
    if (fx === 'fire') h += '<div class="bbr-fxb">' + particles('flames') + '</div>';
    if (fx === 'smoke') h += '<div class="bbr-fxb">' + particles('smoke') + '</div>';
    const edges = opts.edges == null ? 14 : opts.edges;
    for (let i = edges; i >= 1; i--) h += '<div class="bbr-layer" style="' + S.outer + ';background:' + T.edge + ';transform:translateZ(-' + i + 'px)"></div>';
    h += '<div class="bbr-layer" style="' + S.outer + ';background:' + T.rim + ';transform:translateZ(0px)"></div>';
    h += '<div class="bbr-layer" style="' + S.bevel + ';background:' + T.bevel + ';transform:translateZ(1px)"></div>';
    h += '<div class="bbr-layer" style="' + S.groove + ';background:' + T.groove + ';transform:translateZ(2px)"></div>';
    h += '<div class="bbr-layer bbr-face" style="' + S.face + ';background:' + T.face + ';color:' + T.ink + ';transform:translateZ(3px)">' +
      '<div class="bbr-wm">BBR</div>' +
      '<div class="bbr-top"><div class="bbr-ovrcol"><div class="bbr-ovr" style="color:' + T.statC + '">' + Number(c.ovr) + '</div>' +
      '<div class="bbr-role">' + esc(c.role) + (c.form === 'up' ? ' <span style="color:#3dff9a">&#9650;</span>' : c.form === 'down' ? ' <span style="color:#ff5d6c">&#9660;</span>' : '') + '</div><div class="bbr-plat">' + esc((c.platforms && c.platforms.length > 1 ? c.platforms.map((x) => ({ twitch: 'TW', kick: 'KICK', youtube: 'YT' }[x] || x)).join(' + ') : String(c.platform || '')).toUpperCase()) + '</div></div>' + avatar + '</div>' +
      '<div class="bbr-plate" style="background:' + T.bevel + ';color:' + T.plateInk + ';font-size:' + nameSize + 'px">' + esc(name) + '</div>' +
      (sb ? '<div class="bbr-subsp"></div>' : '') +
      '<div class="bbr-stats">' + stats + '</div>' +
      facts(c, T, sk) +
      (c.ribbon || c.facts ? '' : '<div class="bbr-mark">&#9733; BBR &#9733;</div>') +
      '</div>';
    h += '<div class="bbr-layer bbr-gleam" style="' + S.outer + ';transform:translateZ(3.5px)"></div>';
    if (sb) h += '<div class="bbr-subband" style="background:' + sb.bg + ';color:' + sb.ink + '"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (sb.crown ? 'M3 18h18l-2-10-4 4-3-7-3 7-4-4z' : 'M12 2l3 7 7 .6-5.3 4.6L18.4 21 12 17.3 5.6 21l1.7-6.8L2 9.6 9 9z') + '" fill="currentColor"/></svg>' + esc(sb.text) + '</div>';
    for (const [l, t] of [[4, 70], [248, 70], [4, 180], [248, 180]]) h += '<div class="bbr-rivet" style="left:' + l + 'px;top:' + t + 'px;transform:translateZ(4px)"></div>';
    if (c.ribbon) {
      const rc = RIBBONS[c.ribbon] || (/^MVP x/.test(c.ribbon) ? RIBBONS.MVP : null) || [acc, '#06110b'];
      const bg = rc ? rc[0] : acc, ink = rc ? rc[1] : '#06110b';
      h += '<div class="bbr-ribbon' + (opts.ribbonClass ? ' ' + opts.ribbonClass : '') + '"><div class="bbr-rb-tail bbr-rb-l" style="background:' + bg + '"></div><div class="bbr-rb-tail bbr-rb-r" style="background:' + bg + '"></div>' +
        '<div class="bbr-rb-main" style="background:' + bg + ';color:' + ink + '">' + esc(c.ribbon) + '</div></div>';
    }
    if (c.crown) h += '<div class="bbr-crown" title="First in chat tonight"><svg viewBox="0 0 48 32" width="56" height="38" aria-hidden="true"><path d="M3 28h42l-4-20-9 8-8-14-8 14-9-8z" fill="#f6d77a" stroke="#7a5600" stroke-width="2" stroke-linejoin="round"/><circle cx="24" cy="5" r="3" fill="#ff5aa0"/><circle cx="7" cy="8" r="2.5" fill="#4dc3ff"/><circle cx="41" cy="8" r="2.5" fill="#4dc3ff"/></svg></div>';
    if (sk.now >= 3) h += '<div class="bbr-skchip" style="background:' + SC + '">' + sk.now + ' IN A ROW</div>';
    if (fx === 'fire') h += '<div class="bbr-fxf">' + particles('embers') + '</div>';
    if (fx === 'frost') h += '<div class="bbr-fxf">' + particles('sparks') + '</div>';
    if (fx === 'lightning') {
      h += '<div class="bbr-fxf"><svg class="bbr-bolts" width="340" height="460" viewBox="0 0 340 460" aria-hidden="true">' +
        BOLTS.map(([z, d]) => '<path class="bbr-bolt ' + z + '" d="' + d + '"></path><path class="bbr-core ' + z + '" d="' + d + '"></path>').join('') + '</svg></div>';
    }
    h += '</div></div>';
    return h;
  }

  // A: the facts strip in the tip of the shield (best two numbers for that person, plus their streak)
  function facts(c, T, sk) {
    const f = c.facts; if (!f) return '';
    const chips = (f.chips || []).slice(0, 2).concat(sk && sk.best > 1 ? [{ k: 'BEST RUN', v: String(sk.best) }] : sk && sk.now > 0 ? [{ k: 'STREAK', v: String(sk.now) }] : []).slice(0, 3);
    if (!chips.length) return '';
    return '<div class="bbr-facts">' + chips.map((x) => '<div><b>' + esc(x.v) + '</b><span style="color:' + T.statC + '">' + esc(x.k) + '</span></div>').join('') + '</div>';
  }
  // B: the back of the card (the player file). Same shield, same tier colours.
  function back(c, p, opts) {
    opts = opts || {};
    const acc = opts.accent || '#3dff9a', T = tier(c.tier, acc), sk = c.streak || {}, sb = subBand(c);
    const n = (x) => Number(x || 0).toLocaleString('en-GB');
    const rows = [];
    if (c.facts && c.facts.since) rows.push(['Member since', c.facts.since]);
    if (p) { if (p.streams) rows.push(['Streams watched', n(p.streams)]); if (p.watchH) rows.push(['Watch time', n(p.watchH) + ' h']); }
    if (sk.best > 1) rows.push(['Best streak', sk.best + ' in a row']);
    if (sb) rows.push(['Sub', sb.text.replace(/ SUB/, '').toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase())]);
    if (p && p.bits) rows.push(['Bits, all time', n(p.bits)]);
    if (p && p.gifted) rows.push(['Gifted subs', n(p.gifted)]);
    if (p && (p.battlesW || p.battlesL)) rows.push(['Battles', p.battlesW + ' W · ' + p.battlesL + ' L']);
    if (p && p.queen) rows.push(['Queen kills', String(p.queen)]);
    if (p && p.rank) rows.push(['Club rank', '#' + p.rank + ' of ' + p.of]);
    if (c.facts && c.facts.style) rows.push(['Plays like', c.facts.style.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase())]);
    let h = '<div class="bbr-card bbr-back" style="--acc:' + acc + '"><div class="bbr-tilt">';
    for (let i = 10; i >= 1; i--) h += '<div class="bbr-layer" style="' + S.outer + ';background:' + T.edge + ';transform:translateZ(-' + i + 'px)"></div>';
    h += '<div class="bbr-layer" style="' + S.outer + ';background:' + T.rim + '"></div><div class="bbr-layer" style="' + S.bevel + ';background:' + T.bevel + ';transform:translateZ(1px)"></div>';
    h += '<div class="bbr-layer" style="' + S.groove + ';background:' + T.groove + ';transform:translateZ(2px)"></div>';
    h += '<div class="bbr-layer bbr-bface" style="' + S.face + ';background:repeating-linear-gradient(135deg,' + T.statC + '12 0 2px,transparent 2px 9px),' + T.avBg + ';color:' + T.ink + ';transform:translateZ(3px)">' +
      '<div class="bbr-bh" style="color:' + T.statC + '">PLAYER FILE</div><div class="bbr-bn">' + esc(String(c.display || '').toUpperCase()) + '</div>' +
      rows.slice(0, 8).map((r) => '<div class="bbr-br" style="border-color:' + T.statC + '33"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>').join('') +
      '<div class="bbr-bw" style="color:' + T.statC + '">' + esc(T.label) + ' · ' + Number(c.ovr) + '</div></div>';
    h += '<div class="bbr-layer bbr-gleam" style="' + S.outer + ';transform:translateZ(3.5px)"></div></div></div>';
    return h;
  }

  // ---- other looks for other games: same numbers, new style ----
  const KEYS = ['WAT', 'SUB', 'SUP', 'CHT', 'LOY', 'RAI', 'STK'];
  const STREAK_C = [null, '#ff8a3d', '#ff5a1f', '#3db8ff', '#b26bff', '#ffd34d'];
  const STYLES = {
    ats: { labels: ['HRS', 'SUB', 'SUP', 'CB', 'LOY', 'CNV', 'STK'], cls: { bronze: 'CLASS C', silver: 'CLASS B', gold: 'CLASS A', legend: 'CLASS A + HAZMAT' } },
    ets: { labels: ['KM', 'SUB', 'SUP', 'CB', 'LOY', 'CNV', 'STK'], cls: { bronze: 'CAT B', silver: 'CAT B · C1', gold: 'CAT B · C1 · C', legend: 'CAT B · C1 · C · CE' } },
    arc: { labels: ['FIELD', 'SUB', 'SUP', 'COMMS', 'LOY', 'SQUAD', 'STK'], cls: { bronze: 'CLEARANCE I', silver: 'CLEARANCE II', gold: 'CLEARANCE III', legend: 'CLEARANCE IV' } },
    // v31 Sunset Heist (GTA-style): an original sunset / neon crew file, no game logos
    heist: { labels: ['HUSTLE', 'SUB', 'SUP', 'CHAT', 'LOY', 'CREW', 'STK'], cls: { bronze: 'STREET', silver: 'CREW', gold: 'BOSS', legend: 'KINGPIN' } }
  };
  function licNo(c) { let h = 0; for (const ch of String(c.key || c.display)) h = (h * 31 + ch.charCodeAt(0)) % 1e6; return 'BBR-' + String(h).padStart(6, '0'); }
  function styled(c, opts, acc, T, initials, avatarOk) {
    const st = STYLES[c.style], sk = c.streak || {}, lvl = sk.level || 0, SC = STREAK_C[lvl];
    const img = avatarOk ? '<img src="' + esc(c.avatar) + '" alt="" onerror="this.remove()">' : '';
    const stats = KEYS.map((k, i) => '<div><span>' + st.labels[i] + '</span><b>' + Number((c.stats || {})[k] || 40) + '</b></div>').join('');
    const nm0 = String(c.display || '').toUpperCase(), name = '<span style="font-size:' + (nm0.length <= 9 ? 22 : nm0.length <= 12 ? 18 : 15) + 'px">' + esc(nm0) + '</span>';
    const sb = subBand(c), subl = sb ? '<div class="sx-sub" style="background:' + sb.bg + ';color:' + sb.ink + '">' + esc(sb.text) + '</div>' : '';
    const chip = sk.now >= 3 ? '<div class="sx-sk" style="background:' + SC + '">' + sk.now + ' IN A ROW' + (sk.name ? ' · ' + sk.name : '') + '</div>' : '';
    const fl = (lvl ? '<div class="bbr-skglow"></div>' : '') + (lvl >= 2 && opts.effects !== false ? '<div class="bbr-fxb bbr-skfx">' + particles('flames') + '</div>' : '');
    let body = '';
    if (c.style === 'heist') {
      const heat = Math.min(5, ({ bronze: 1, silver: 2, gold: 3, legend: 4 }[c.tier] || 1) + (sk.now >= 3 ? 1 : 0));
      const bars = [1, 2, 3, 4, 5].map((i) => '<i class="' + (i <= heat ? 'on' : '') + '"></i>').join('');
      body = '<div class="sx sx-heist"><div class="hx-sky"></div><div class="hx-sun"></div><div class="hx-palms"></div>' +
        '<div class="hx-top"><span>CREW FILE</span><span>#' + licNo(c).slice(4) + '</span></div>' +
        '<div class="sx-row"><div class="sx-ph">' + initials + img + '</div><div class="sx-d"><div class="sx-n">' + name + '</div>' +
        '<div class="hx-rank">' + st.cls[c.tier] + '</div><div class="hx-ovr">' + Number(c.ovr) + '<small>REP</small></div>' +
        '<div class="hx-heat"><em>HEAT</em>' + bars + '</div></div></div>' +
        subl + '<div class="sx-st">' + stats + '</div>' + chip + '<div class="hx-ft">SUNSET COAST · KNOWN ASSOCIATE OF BBR</div></div>';
    } else if (c.style === 'arc') {
      body = '<div class="sx sx-arc"><div class="sx-hole"></div><div class="sx-haz"></div><div class="sx-k">ASHFALL RAIDER · TAG ' + licNo(c).slice(4) + '</div>' +
        '<div class="sx-row"><div class="sx-ph">' + initials + img + '</div><div><div class="sx-n">' + name + '</div><div class="sx-cl" style="color:' + T.color + '">' + st.cls[c.tier] + '</div><div class="sx-ovr">' + Number(c.ovr) + '</div></div></div>' +
        subl + '<div class="sx-st">' + stats + '</div>' + chip + '<div class="sx-ft">QUEEN KILLS ' + ((c.arc && c.arc.won) || 0) + ' · ' + esc(c.role || '') + '</div></div>';
    } else {
      const eu = c.style === 'ets';
      body = '<div class="sx sx-' + c.style + '"><div class="sx-hd"><span>' + (eu ? 'EURO HAULAGE DRIVING LICENCE' : 'BBR HAULAGE · COMMERCIAL DRIVER LICENSE') + '</span></div>' +
        '<div class="sx-row"><div class="sx-ph">' + initials + img + '</div><div class="sx-d"><div><i>' + (eu ? '5.' : 'DL NO') + '</i> ' + licNo(c) + '</div><div class="sx-n">' + name + '</div>' +
        '<div><i>' + (eu ? '9.' : 'CLASS') + '</i> <b style="color:' + (eu ? '#1f3a8a' : '#b3262e') + '">' + st.cls[c.tier] + '</b></div><div><i>RATING</i> <b>' + Number(c.ovr) + ' ' + esc(T.label) + '</b></div></div></div>' +
        subl + '<div class="sx-st">' + stats + '</div>' + chip + '<div class="sx-bar"></div></div>';
    }
    return '<div class="bbr-card bbr-styled' + (lvl ? ' bbr-streak bbr-sk' + lvl : '') + '" style="--acc:' + acc + ';--tc:' + T.color + (SC ? ';--sk:' + SC : '') + '"><div class="bbr-tilt">' + fl + body + '</div></div>';
  }

  // the band across the card for anyone subscribed: says exactly what they have
  function subBand(c) {
    const s = c.sub; if (!s) return null;
    const pf = s.platform || c.platform, mo = s.months ? ' · ' + s.months + (s.months === 1 ? ' MONTH' : ' MONTHS') : '';
    if (s.gifted) return { bg: pf === 'kick' ? '#53fc18' : pf === 'youtube' ? '#e01e2e' : '#7b3cf0', ink: pf === 'kick' ? '#06110b' : '#fff', text: 'GIFTED SUB' + mo };
    if (pf === 'kick') return { bg: '#53fc18', ink: '#06110b', text: 'KICK SUB' + mo };
    if (pf === 'youtube') return { bg: '#e01e2e', ink: '#fff', text: 'YOUTUBE MEMBER' + mo };
    if (s.prime) return { bg: '#1f6fd6', ink: '#fff', text: 'PRIME SUB' + mo, crown: true };
    return { bg: '#7b3cf0', ink: '#fff', text: 'TIER ' + (s.tier || 1) + ' SUB' + mo };
  }
  function wrapClass(t) { return 'bbr-shadow' + (t === 'gold' ? ' bbr-glow-gold' : t === 'legend' ? ' bbr-glow-legend' : ''); }

  window.BBR = { render, back, tier, esc, wrapClass, subBand };
})();
