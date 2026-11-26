// v30 stingers: a full-screen transition that covers the screen while OBS cuts to the next scene.
// The app sends { type: 'stinger', look, variant, photo, text, sub, ms, cut, sound, color, at }. Every BBR browser
// source plays it at the same moment (`at`), so it carries on seamlessly across the cut. Only the overlay plays sound.
//   truck: a lorry drives across, its trailer covers the screen at the cut (ETS: cab-over + curtain-sider, ATS: long-nose + reefer)
//   sign:  a giant motorway sign drops down (blue in Europe, green in the US), then lifts away
//   tacho: a tachograph dial opens from the middle and closes again
//   wipe:  angled bands in the game's colours sweep across (football, Arc Raiders, Metal Gear, neon)
window.STINGER = (function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COL = {
    ets: { a: '#0b4fa8', b: '#ffd400', c: '#ffffff', text: 'BBR HAULAGE', sub: 'BIGBOSSROBINSON · EUROPE' },
    ats: { a: '#b3121b', b: '#f2f2f2', c: '#1d3f8f', text: 'BBR FREIGHT LINES', sub: 'BIGBOSSROBINSON · COAST TO COAST' },
    football: { a: '#0d2459', b: '#e3132c', c: '#f5c400', text: 'BOSS SPORTS NEWS', sub: 'BIGBOSSROBINSON' },
    arc: { a: '#141414', b: '#f2c200', c: '#e53b2c', text: 'RAIDER INCOMING', sub: 'BIGBOSSROBINSON' },
    mgs: { a: '#06140c', b: '#3dff7a', c: '#bfffd4', text: 'INFILTRATING', sub: 'BIGBOSSROBINSON' },
    elite: { a: '#0b0b0c', b: '#D9B45A', c: '#F3E7C9', text: 'ELITE PLAYOFFS', sub: 'BIGBOSSROBINSON · PLAYOFF NIGHT' },
    heist: { a: '#c2306f', b: '#2ef2ff', c: '#ffe48a', text: 'THE CREW IS BACK', sub: 'BIGBOSSROBINSON' },
    neon: { a: '#12061f', b: '#c58bff', c: '#22d3ee', text: 'BIGBOSSROBINSON', sub: 'TWITCH · KICK · YOUTUBE' },
  };
  let css = false;
  function addCss() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `
.stg{position:fixed;left:0;top:0;width:1920px;height:1080px;z-index:99999;pointer-events:none;overflow:hidden;font-family:'Barlow Condensed','Arial Narrow',sans-serif}
.stg *{box-sizing:border-box}
.stg-truck{position:absolute;top:0;height:1080px;left:0;display:flex;align-items:stretch;will-change:transform}
.stg-cab{position:relative;width:700px;height:1080px;flex:none}
.stg-trl{position:relative;width:4200px;height:1080px;flex:none;border-radius:18px 0 0 18px;overflow:hidden}
.stg-trl .ln{position:absolute;left:0;right:0;height:26px}
.stg-trl .brand{position:absolute;left:1420px;top:250px;width:1300px;text-align:center;white-space:nowrap}
.stg-trl .brand b{display:inline-block;white-space:nowrap;font-size:200px;font-weight:800;line-height:.85;letter-spacing:4px}
.stg-trl .brand i{display:block;font-style:normal;font-size:64px;font-weight:700;letter-spacing:10px;margin-top:22px}
.stg-ph{position:absolute;width:420px;height:420px;border-radius:50%;background-size:cover;background-position:center;border:16px solid #fff;box-shadow:0 10px 40px rgba(0,0,0,.4)}
.stg-wh{position:absolute;bottom:20px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,#c9ced6 0 22%,#2a2d33 23% 30%,#111 31% 100%);border:10px solid #050505}
.stg-wh::after{content:'';position:absolute;inset:28%;border:8px dashed #8b9098;border-radius:50%;animation:stgSpin .35s linear infinite}
@keyframes stgSpin{to{transform:rotate(360deg)}}
.stg-sign{position:absolute;left:-30px;top:-1150px;width:1980px;height:1140px;border:30px solid #fff;border-radius:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;box-shadow:0 40px 80px rgba(0,0,0,.5);will-change:transform}
.stg-sign b{display:inline-block;white-space:nowrap;font-size:230px;font-weight:800;line-height:.85;color:#fff;letter-spacing:6px;text-align:center}
.stg-sign i{font-style:normal;font-size:72px;font-weight:700;color:#fff;letter-spacing:8px}
.stg-sign .arw{width:180px;height:180px}
.stg-tacho{position:absolute;left:960px;top:540px;width:2400px;height:2400px;margin:-1200px 0 0 -1200px;border-radius:50%;transform:scale(0);will-change:transform;display:flex;align-items:center;justify-content:center}
.stg-band{position:absolute;left:-600px;width:3200px;transform:skewY(-9deg);will-change:transform}
.stg-mid{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;gap:50px;opacity:0}
.stg-mid b{display:block;font-size:180px;font-weight:800;letter-spacing:6px;line-height:.9;white-space:nowrap}
.stg-mid i{display:block;font-style:normal;font-size:56px;font-weight:700;letter-spacing:10px}
.stg-pan{position:absolute;overflow:hidden;border:14px solid #12061f;will-change:transform}
.stg-pan::after{content:'';position:absolute;inset:0;background:radial-gradient(circle,rgba(18,6,31,.28) 2px,transparent 2.6px) 0 0/16px 16px;mix-blend-mode:multiply}
.stg-cap{position:absolute;left:0;right:0;top:420px;text-align:center;z-index:3;opacity:0}
.stg-cap b{display:inline-block;white-space:nowrap;font-size:210px;font-weight:900;font-style:italic;letter-spacing:4px;line-height:.9;color:#ffe48a;text-shadow:8px 8px 0 #12061f,-3px -3px 0 #12061f,3px -3px 0 #12061f,-3px 3px 0 #12061f}
.stg-cap i{display:inline-block;margin-top:24px;font-style:normal;font-size:58px;font-weight:800;letter-spacing:10px;background:#12061f;color:#2ef2ff;padding:6px 30px;transform:skewX(-10deg)}
`;
    document.head.appendChild(s);
  }
  const photoHtml = (url, x, y, size, border) => url ? '<div class="stg-ph" style="left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size + 'px;border-color:' + (border || '#fff') + ';background-image:url(&quot;' + esc(url) + '&quot;)"></div>' : '';

  // ---------- the lorry ----------
  function truck(root, ev, C) {
    const us = ev.look === 'ats';
    const cab = us
      // American long-nose with chrome stacks
      ? '<svg viewBox="0 0 700 1080" width="700" height="1080" aria-hidden="true"><rect x="40" y="420" width="380" height="430" rx="40" fill="' + C.a + '"/><rect x="40" y="400" width="140" height="460" rx="20" fill="#d9dde3"/><rect x="60" y="430" width="100" height="380" fill="#8b929c"/>' +
        '<rect x="300" y="160" width="400" height="690" rx="30" fill="' + C.a + '"/><rect x="330" y="200" width="250" height="230" rx="16" fill="#9fd3ff" opacity=".85"/><rect x="600" y="0" width="40" height="420" rx="16" fill="#e8eaed"/><rect x="0" y="830" width="700" height="60" fill="#111"/>' +
        '<rect x="10" y="560" width="70" height="40" rx="8" fill="#fff7c2"/><text x="500" y="640" font-size="70" font-weight="800" fill="#fff" text-anchor="middle" font-family="Barlow Condensed">BBR</text></svg>'
      // European cab-over
      : '<svg viewBox="0 0 700 1080" width="700" height="1080" aria-hidden="true"><rect x="60" y="120" width="620" height="740" rx="60" fill="' + C.a + '"/><rect x="100" y="170" width="300" height="320" rx="24" fill="#9fd3ff" opacity=".85"/><rect x="60" y="560" width="620" height="40" fill="' + C.b + '"/>' +
        '<rect x="40" y="700" width="90" height="60" rx="10" fill="#fff7c2"/><rect x="30" y="840" width="680" height="60" fill="#111"/><text x="420" y="720" font-size="90" font-weight="800" fill="#fff" text-anchor="middle" font-family="Barlow Condensed">BBR</text><rect x="420" y="170" width="220" height="320" rx="20" fill="#000" opacity=".25"/></svg>';
    const trailerBg = us ? 'linear-gradient(180deg,#f4f6f8,#d8dde3)' : C.c;
    const stripes = us ? '<div class="ln" style="top:760px;background:' + C.a + '"></div><div class="ln" style="top:800px;background:' + C.c + '"></div>' : '<div class="ln" style="top:120px;background:' + C.a + ';height:60px"></div><div class="ln" style="top:780px;background:' + C.a + ';height:60px"></div><div class="ln" style="top:860px;background:' + C.b + '"></div>';
    const brandCol = us ? C.a : C.a;
    const h = '<div class="stg-truck">' +
      '<div class="stg-cab">' + cab + '<div class="stg-wh" style="left:' + (us ? 400 : 330) + 'px"></div></div>' +
      '<div class="stg-trl" style="background:' + trailerBg + '">' + stripes +
        '<div class="brand"><b style="color:' + brandCol + '">' + esc(ev.text || C.text) + '</b><i style="color:#1a1a1a">' + esc(ev.sub || C.sub) + '</i></div>' +
        photoHtml(ev.photo, 900, 290, 440, brandCol) + photoHtml(ev.photo, 3150, 290, 440, brandCol) +
        (us ? '<svg viewBox="0 0 200 220" width="300" height="330" style="position:absolute;left:600px;top:330px" aria-hidden="true"><path d="M10 30 Q100 -10 190 30 L180 140 Q100 230 20 140 Z" fill="' + C.c + '" stroke="#fff" stroke-width="8"/><path d="M10 30 Q100 -10 190 30 L188 60 L12 60 Z" fill="' + C.a + '"/><text x="100" y="140" font-size="80" font-weight="800" fill="#fff" text-anchor="middle" font-family="Barlow Condensed">80</text></svg>' : '<div style="position:absolute;left:560px;top:330px;width:340px;height:220px;border-radius:24px;background:' + C.a + ';border:10px solid #fff;color:#fff;font-size:120px;font-weight:800;display:flex;align-items:center;justify-content:center">E40</div>') +
        '<div class="stg-wh" style="left:3200px"></div><div class="stg-wh" style="left:3460px"></div><div class="stg-wh" style="left:3720px"></div>' +
      '</div></div>';
    root.innerHTML = h;
    const el = root.firstChild, cut = ev.cut / 100, half = 0.15;
    // fast in, slow while the trailer covers the screen (cut ± 15%), fast out
    el.animate([{ transform: 'translateX(1920px)' }, { transform: 'translateX(-700px)', offset: Math.max(0.05, cut - half) }, { transform: 'translateX(-2280px)', offset: Math.min(0.95, cut + half) }, { transform: 'translateX(-4900px)' }], { duration: ev.ms, fill: 'forwards' });
  }
  // ---------- the motorway sign ----------
  function sign(root, ev, C) {
    const us = ev.look === 'ats', bg = ev.color || (us ? '#0c6b35' : ev.look === 'ets' ? '#0b4fa8' : C.a);
    root.innerHTML = '<div class="stg-sign" style="background:' + bg + '">' +
      '<svg class="arw" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20V5"/><path d="M5 11l7-7 7 7"/></svg>' +
      '<b>' + esc(ev.text || C.text) + '</b><i>' + esc(ev.sub || C.sub) + '</i>' + photoHtml(ev.photo, 110, 60, 300) + '</div>';
    const el = root.firstChild, cut = ev.cut / 100;
    el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(1150px)', offset: Math.max(0.1, cut - 0.15), easing: 'ease-out' }, { transform: 'translateY(1120px)', offset: cut }, { transform: 'translateY(1150px)', offset: Math.min(0.9, cut + 0.15), easing: 'ease-in' }, { transform: 'translateY(2400px)' }], { duration: ev.ms, fill: 'forwards' });
  }
  // ---------- the tachograph dial ----------
  function tacho(root, ev, C) {
    const ticks = Array.from({ length: 48 }, (_, i) => '<line x1="50" y1="3" x2="50" y2="' + (i % 4 ? 7 : 11) + '" stroke="#111" stroke-width="' + (i % 4 ? 0.5 : 1) + '" transform="rotate(' + i * 7.5 + ' 50 50)"/>').join('');
    root.innerHTML = '<div class="stg-tacho" style="background:' + (ev.color || C.b) + '"><svg viewBox="0 0 100 100" width="2400" height="2400" style="position:absolute;inset:0" aria-hidden="true">' + ticks + '<circle cx="50" cy="50" r="30" fill="none" stroke="#111" stroke-width=".6"/></svg>' +
      '<div style="position:relative;text-align:center;color:#111"><b style="display:block;font-size:200px;font-weight:800;letter-spacing:6px">' + esc(ev.text || C.text) + '</b><i style="font-style:normal;font-size:60px;font-weight:700;letter-spacing:10px">' + esc(ev.sub || C.sub) + '</i></div>' + photoHtml(ev.photo, 1500, 1500, 300, '#111') + '</div>';
    const el = root.firstChild, cut = ev.cut / 100;
    el.animate([{ transform: 'scale(0) rotate(-90deg)' }, { transform: 'scale(1) rotate(0deg)', offset: Math.max(0.1, cut - 0.12), easing: 'ease-out' }, { transform: 'scale(1) rotate(8deg)', offset: Math.min(0.9, cut + 0.12) }, { transform: 'scale(0) rotate(90deg)', easing: 'ease-in' }], { duration: ev.ms, fill: 'forwards' });
  }
  // ---------- angled bands ----------
  function wipe(root, ev, C) {
    const look = ev.look, hazard = look === 'arc';
    const bands = [[C.a, -80, 640], [C.b, 520, 180], [C.c, 660, 120], [C.a, 760, 520]];
    root.innerHTML = bands.map(([col, top, h], i) => '<div class="stg-band" style="top:' + top + 'px;height:' + h + 'px;background:' + (hazard && i === 1 ? 'repeating-linear-gradient(45deg,#f2c200 0 60px,#111 60px 120px)' : col) + '"></div>').join('') +
      '<div class="stg-mid" style="color:' + (look === 'mgs' ? C.b : '#fff') + '">' + (ev.photo ? '<div class="stg-ph" style="position:relative;flex:none;width:340px;height:340px;border-color:' + C.b + ';background-image:url(&quot;' + esc(ev.photo) + '&quot;)"></div>' : '') + '<div><b>' + esc(ev.text || C.text) + '</b><i style="color:#fff;text-shadow:0 3px 10px rgba(0,0,0,.7)">' + esc(ev.sub || C.sub) + '</i></div></div>';
    const cut = ev.cut / 100;
    root.querySelectorAll('.stg-band').forEach((b, i) => {
      const d = i * 0.03;
      b.animate([{ transform: 'skewY(-9deg) translateX(3300px)' }, { transform: 'skewY(-9deg) translateX(0)', offset: Math.max(0.1, cut - 0.18 + d), easing: 'cubic-bezier(.2,.8,.2,1)' }, { transform: 'skewY(-9deg) translateX(0)', offset: Math.min(0.9, cut + 0.12 + d) }, { transform: 'skewY(-9deg) translateX(-3600px)', easing: 'cubic-bezier(.7,0,.8,.2)' }], { duration: ev.ms, fill: 'forwards' });
    });
    root.querySelector('.stg-mid').animate([{ opacity: 0 }, { opacity: 0, offset: Math.max(0.1, cut - 0.14) }, { opacity: 1, offset: cut - 0.05 }, { opacity: 1, offset: cut + 0.1 }, { opacity: 0, offset: Math.min(0.95, cut + 0.18) }, { opacity: 0 }], { duration: ev.ms, fill: 'forwards' });
  }
  // ---------- v31 comic panels (Sunset Heist): three slanted panels slam in, the title stamps on, they fly off ----------
  function comic(root, ev, C) {
    const sky = 'linear-gradient(180deg,#2b0f4d,#a0216f 45%,#ff6a5a 75%,#ffb35c)';
    const P = [
      { css: 'left:-40px;top:-40px;width:1100px;height:640px;clip-path:polygon(0 0,100% 0,88% 100%,0 100%);background:' + sky, from: 'translate(-1300px,-200px) rotate(-6deg)' },
      { css: 'left:900px;top:-40px;width:1080px;height:640px;clip-path:polygon(12% 0,100% 0,100% 100%,0 100%);background:' + (ev.photo ? 'center/cover url(&quot;' + esc(ev.photo) + '&quot;),' : '') + C.a, from: 'translate(1300px,-260px) rotate(5deg)' },
      { css: 'left:-40px;top:560px;width:2000px;height:560px;clip-path:polygon(0 8%,100% 0,100% 100%,0 100%);background:linear-gradient(180deg,' + C.b + ',#12061f)', from: 'translate(0,700px) rotate(3deg)' },
    ];
    root.innerHTML = P.map((p) => '<div class="stg-pan" style="' + p.css + '"></div>').join('') + '<div class="stg-cap"><b>' + esc(ev.text || C.text) + '</b><br><i>' + esc(ev.sub || C.sub) + '</i></div>';
    const cut = ev.cut / 100;
    root.querySelectorAll('.stg-pan').forEach((el, i) => {
      const f = P[i].from, d = i * 0.05;
      el.animate([{ transform: f }, { transform: 'none', offset: Math.max(0.1, cut - 0.22 + d), easing: 'cubic-bezier(.2,1.2,.3,1)' }, { transform: 'none', offset: Math.min(0.9, cut + 0.14), easing: 'cubic-bezier(.7,0,.8,.2)' }, { transform: f.replace(/-?\d+px/g, (m) => String(-parseInt(m, 10)) + 'px') }], { duration: ev.ms, fill: 'forwards' });
    });
    root.querySelector('.stg-cap').animate([{ opacity: 0, transform: 'scale(2.2) rotate(-4deg)' }, { opacity: 0, offset: Math.max(0.1, cut - 0.12) }, { opacity: 1, transform: 'scale(1) rotate(-4deg)', offset: cut - 0.04, easing: 'cubic-bezier(.2,1.4,.3,1)' }, { opacity: 1, transform: 'scale(1) rotate(-4deg)', offset: cut + 0.1 }, { opacity: 0, transform: 'scale(.9) rotate(-4deg)', offset: Math.min(0.95, cut + 0.16) }, { opacity: 0 }], { duration: ev.ms, fill: 'forwards' });
  }
  function sounds(ev) {
    if (!ev.sound || !window.SFX) return;
    const t = ev.ms / 1000, c = ev.cut / 100;
    try {
      if (ev.variant === 'truck') { SFX.play('engine'); SFX.play('horn', t * c * 0.6); SFX.play('airbrake', t * 0.85); }
      else if (ev.variant === 'sign') { SFX.play('whoosh'); SFX.play('thud', t * (c - 0.15)); }
      else if (ev.variant === 'tacho') { SFX.play('riser'); SFX.play('beep', t * c); }
      else if (ev.look === 'arc') { SFX.play('alarm'); SFX.play('whoosh', t * 0.2); }
      else if (ev.variant === 'comic') { SFX.play('whoosh'); SFX.play('thud', t * (c - 0.1)); SFX.play('impact', t * c); }
      else if (ev.look === 'mgs') { SFX.play('beep'); SFX.play('whoosh', t * 0.2); }
      else { SFX.play('whoosh'); if (ev.look === 'football' || ev.look === 'elite') SFX.play('whistle', t * c); }
    } catch (e) { /* no audio */ }
  }
  // play: o.sound = false on every source except the overlay
  function play(ev, o) {
    o = o || {}; addCss();
    const C = Object.assign({}, COL[ev.look] || COL.neon); if (ev.color) C.a = ev.color;
    const wait = Math.max(0, (ev.at || Date.now()) - Date.now());
    setTimeout(() => {
      const root = document.createElement('div'); root.className = 'stg';
      document.body.appendChild(root);
      try { ({ truck, sign, tacho, wipe, comic }[ev.variant] || wipe)(root, ev, C); } catch (e) { console.error('stinger', e); }
      // big words never run off the screen (whatever font loaded)
      root.querySelectorAll('.stg-sign b,.stg-mid b,.stg-trl .brand b,.stg-cap b').forEach((b) => { const max = b.closest('.stg-cap') ? 1700 : b.closest('.stg-mid') ? 1300 : b.closest('.brand') ? 1250 : 1750; let fs = parseFloat(getComputedStyle(b).fontSize); while (b.scrollWidth > max && fs > 60) { fs -= 8; b.style.fontSize = fs + 'px'; } });
      if (o.sound !== false) sounds(ev);
      setTimeout(() => root.remove(), ev.ms + 200);
    }, wait);
  }
  return { play, COL };
})();
