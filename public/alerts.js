/* BBR alerts: follows, subs, bits/Kicks/Super Chats, raids, battles, tier ups.
   Everything is DOM + Web Animations, no libraries. */
(function () {
  const esc = (s) => BBR.esc(s);
  const css = `
.al{position:absolute;inset:0;pointer-events:none;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7}
.al-wrap{position:absolute;right:60px;bottom:60px;width:880px;height:340px}.ci-cards{display:flex;gap:14px;align-items:flex-end}.ci-c{position:relative;width:161px;height:250px}.ci-c .m{position:absolute;left:0;top:0;width:260px;height:380px;transform:scale(.62);transform-origin:0 0;transform-style:preserve-3d}.ci-up{position:absolute;left:50%;top:-14px;transform:translateX(-50%);padding:2px 10px;border-radius:999px;background:#3dff9a;color:#06110b;font-size:16px;font-weight:800;letter-spacing:1px;white-space:nowrap;box-shadow:0 4px 10px rgba(0,0,0,.5);z-index:3}.ci-cn{position:absolute;left:0;right:0;bottom:-24px;text-align:center;font-size:16px;font-weight:800;letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 4px #000}.ci-cn em{font-style:normal;color:#f6d77a}.pf-wrap{position:absolute;right:60px;bottom:60px;width:1060px;height:440px;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7}.pf-pan{position:absolute;inset:0;border-radius:22px;background:linear-gradient(160deg,rgba(26,22,8,.96),rgba(11,13,16,.96));border:2px solid var(--k);box-shadow:0 24px 70px rgba(0,0,0,.6)}.pf-card{position:absolute;left:34px;top:30px;width:260px;height:380px;perspective:1400px}.pf-r{position:absolute;left:330px;top:34px;right:34px;bottom:30px;display:grid;grid-template-columns:300px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);gap:8px 26px}.pf-hd{grid-column:1/-1}.pf-k{font-size:17px;font-weight:700;letter-spacing:4px;color:var(--k)}.pf-n{font-size:64px;font-weight:800;line-height:.95;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pf-s{font-family:Inter,sans-serif;font-size:17px;color:#c9d0d7;margin-top:4px}.pf-s b{color:var(--k)}.pf-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;align-content:center}.pf-g div{border-bottom:1px solid rgba(255,255,255,.12);padding-bottom:6px}.pf-g small{display:block;font-family:Inter,sans-serif;font-size:12px;letter-spacing:1.5px;color:#a7b0ba;text-transform:uppercase}.pf-g b{font-size:34px;font-weight:800;line-height:1}
.ci-wrap{position:absolute;bottom:84px;left:60px;width:900px;display:flex;flex-direction:column;gap:8px;align-items:flex-start;justify-content:flex-end;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7}
.ci-strip{display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:rgba(10,12,15,.93);border:2px solid var(--acc,#3dff9a);border-radius:30px;padding:7px 10px 7px 16px;box-shadow:0 8px 24px rgba(0,0,0,.45)}
.ci-h{font-size:19px;font-weight:800;letter-spacing:3px;color:var(--acc,#3dff9a)}
.ci-p{display:flex;align-items:center;gap:6px;background:#1b1f26;border-radius:20px;padding:4px 12px 4px 6px;font-size:18px;font-weight:700}
.ci-p i{width:12px;height:12px;border-radius:50%}
.ci-p b{font-size:14px}
.ci-new{display:flex;gap:12px;align-items:center;background:rgba(10,12,15,.93);border:2px solid #f6d77a;border-radius:16px;padding:10px 16px;box-shadow:0 8px 24px rgba(0,0,0,.45)}
.ci-av{position:relative;width:48px;height:48px;border-radius:50%;border:3px solid;background:#2a2f39;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;overflow:hidden}
.ci-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.ci-t1{font-size:22px;font-weight:800;letter-spacing:2px;color:#f6d77a}
.ci-t2{font-family:Inter,sans-serif;font-size:16px}
.sk-wrap .sk-hd{position:absolute;z-index:5;left:24px;top:-26px;padding:6px 18px;border-radius:999px;background:linear-gradient(90deg,#ff8a3d,#ff3d1f);color:#1a0800;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:30px;letter-spacing:4px;box-shadow:0 6px 18px rgba(0,0,0,.5)}
.sk-row{position:absolute;left:30px;top:44px;display:flex;gap:20px}
.sk-it{width:190px;display:flex;flex-direction:column;align-items:center;gap:4px;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;animation:skIn .7s cubic-bezier(.2,1.3,.4,1) var(--d) both}
.sk-cd{width:190px;height:258px;position:relative}
.sk-cd>div{position:absolute;left:-35px;top:-61px;transform:scale(.66);transform-origin:50% 50%}
.sk-n{font-size:22px;font-weight:700;letter-spacing:2px}.sk-n b{font-size:34px;color:var(--c)}
.sk-l{font-size:17px;font-weight:800;letter-spacing:1px;text-align:center}
.sk-s{font-size:14px;font-weight:700;letter-spacing:2px;color:#9fe0ff}
@keyframes skIn{from{opacity:0;transform:translateY(60px) scale(.6)}to{opacity:1;transform:none}}
.al-panel{position:absolute;inset:0;border-radius:18px;background:linear-gradient(115deg,rgba(14,17,22,.96) 0%,rgba(10,12,15,.94) 55%,color-mix(in srgb,var(--k) 22%,rgba(10,12,15,.94)) 100%);border:2px solid var(--k);box-shadow:0 0 40px color-mix(in srgb,var(--k) 45%,transparent),inset 0 0 60px color-mix(in srgb,var(--k) 12%,transparent);overflow:hidden}
.al-panel::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.035) 0 2px,transparent 2px 14px)}
.al-sheen{position:absolute;top:-40%;left:-30%;width:26%;height:180%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);transform:rotate(18deg)}
.al-edge{position:absolute;top:-10px;bottom:-10px;width:6px;border-radius:3px;background:#fff;box-shadow:0 0 18px 6px var(--k),0 0 50px 12px var(--k)}
.al-streak{position:absolute;height:3px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--k),#fff);filter:drop-shadow(0 0 6px var(--k))}
.al-badge{position:absolute;left:-26px;top:-34px;display:flex;align-items:center;gap:10px;padding:8px 18px 8px 10px;border-radius:40px;background:var(--k);color:#0a0c0f;font-weight:800;font-size:24px;letter-spacing:3px;box-shadow:0 0 30px var(--k);z-index:5}
.al-badge svg{width:34px;height:34px}
.al-badge .ic{width:40px;height:40px;border-radius:50%;background:#0a0c0f;display:flex;align-items:center;justify-content:center;color:var(--k)}
.al-card{position:absolute;left:36px;top:22px;width:203px;height:296px;transform-style:preserve-3d;z-index:3}
.al-card .m{position:absolute;left:0;top:0;width:260px;height:380px;transform:scale(.78);transform-origin:0 0;transform-style:preserve-3d}
.al-txt{position:absolute;left:280px;top:34px;right:30px;display:flex;flex-direction:column;gap:6px}
.al-kick{font-size:19px;font-weight:700;letter-spacing:5px;color:var(--k);display:flex;gap:14px;align-items:baseline}
.al-amt{font-size:44px;font-weight:800;letter-spacing:1px;color:#fff;text-shadow:0 0 18px var(--k);line-height:.9}
.al-name{font-size:62px;font-weight:800;line-height:1;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:2px 0}
.al-name span{display:inline-block;white-space:pre}
.al-why{font-family:Inter,sans-serif;font-size:16px;color:#b8c0ca;line-height:1.35}
.al-why b{color:var(--k);font-weight:600}
.al-bars{display:flex;flex-direction:column;gap:7px;margin-top:6px}
.al-bar{display:grid;grid-template-columns:52px 1fr 92px;align-items:center;gap:12px}
.al-bar .k{font-size:17px;font-weight:700;letter-spacing:2px;color:#b8c0ca}
.al-bar .tr{position:relative;height:12px;border-radius:6px;background:#232a33;overflow:hidden}
.al-bar .fi{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,color-mix(in srgb,var(--k) 55%,#000),var(--k));box-shadow:0 0 12px var(--k)}
.al-bar .gh{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:rgba(255,255,255,.18)}
.al-bar .n{font-size:30px;font-weight:800;text-align:right;font-variant-numeric:tabular-nums}
.al-bar .n i{font-style:normal;font-size:18px;color:var(--k);margin-left:6px}
.al-chip{align-self:flex-start;margin-top:4px;padding:4px 12px;border-radius:6px;border:2px solid var(--k);font-size:18px;font-weight:700;letter-spacing:3px;color:var(--k)}
.al-p{position:absolute;left:0;top:0;border-radius:50%;pointer-events:none}
.al-ring{position:absolute;border-radius:50%;border:3px solid var(--k);pointer-events:none;box-shadow:0 0 20px var(--k),inset 0 0 20px var(--k)}
.al-ember{position:absolute;width:6px;height:6px;border-radius:50%;background:var(--k);box-shadow:0 0 10px var(--k)}
/* tier up takeover */
.tu-dim{position:absolute;inset:0;background:radial-gradient(circle at 50% 46%,rgba(16,20,26,.9) 0,rgba(5,6,8,.55) 45%,rgba(0,0,0,0) 75%)}
.tu-beams{position:absolute;left:460px;top:-40px;width:1000px;height:1000px;border-radius:50%;-webkit-mask-image:radial-gradient(circle,#000 10%,transparent 66%);mask-image:radial-gradient(circle,#000 10%,transparent 66%)}
.tu-card{position:absolute;left:830px;top:215px;width:260px;height:380px;transform-style:preserve-3d}
.tu-stamp{position:absolute;left:0;top:40px;width:1920px;text-align:center;font-size:130px;font-weight:800;letter-spacing:10px;line-height:1;color:#fff;text-shadow:0 0 30px var(--k),0 0 80px var(--k),0 8px 0 rgba(0,0,0,.5)}
.tu-tiers{position:absolute;left:0;top:618px;width:1920px;display:flex;justify-content:center;align-items:center;gap:30px;font-size:54px;font-weight:800;letter-spacing:6px}
.tu-tiers .old{color:#7d8792;position:relative}
.tu-tiers .old::after{content:"";position:absolute;left:-6px;right:-6px;top:52%;height:5px;background:#ff4d5e;transform:scaleX(0);transform-origin:left;animation:tuStrike .4s 3.1s ease-out forwards}
@keyframes tuStrike{to{transform:scaleX(1)}}
.tu-tiers .arr{color:var(--k);font-size:48px}
.tu-tiers .new{color:var(--k);text-shadow:0 0 24px var(--k)}
.tu-name{position:absolute;left:0;top:690px;width:1920px;text-align:center;font-size:78px;font-weight:800;text-transform:uppercase;line-height:1}
.tu-name span{display:inline-block;white-space:pre}
.tu-why{position:absolute;left:0;top:782px;width:1920px;text-align:center;font-family:Inter,sans-serif;font-size:20px;color:#c4ccd5}
.tu-stats{position:absolute;left:0;top:830px;width:1920px;display:flex;justify-content:center;gap:44px}
.tu-stat{display:flex;flex-direction:column;align-items:center}
.tu-stat .k{font-size:18px;font-weight:700;letter-spacing:3px;color:#b8c0ca}
.tu-stat .v{font-size:48px;font-weight:800;font-variant-numeric:tabular-nums}
.tu-stat .v i{font-style:normal;color:var(--k);font-size:24px;margin-left:6px}
.al-shard{position:absolute;left:0;top:0;width:60px;height:60px}
`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  const I = {
    heart: '<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" fill="currentColor"/>',
    star: '<path d="M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z" fill="currentColor"/>',
    gift: '<rect x="3" y="9" width="18" height="12" rx="1.5" fill="currentColor"/><rect x="2" y="6.5" width="20" height="4" rx="1" fill="currentColor"/><path d="M12 6.5V21" stroke="#0a0c0f" stroke-width="2"/><path d="M12 6.5C9 1 5 3.5 7.5 6.5M12 6.5C15 1 19 3.5 16.5 6.5" stroke="currentColor" stroke-width="2" fill="none"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9z" fill="currentColor"/><path d="M2 9h20M9 3l3 18 3-18" stroke="#0a0c0f" stroke-width="1.2" fill="none"/>',
    bolt: '<path d="M13.5 2L4 13.5h6.5L9 22l11-12.5h-6.8z" fill="currentColor"/>',
    coin: '<circle cx="12" cy="12" r="9.5" fill="currentColor"/><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="800" fill="#0a0c0f" font-family="Barlow Condensed,sans-serif">$</text>',
    raid: '<path d="M2 12h13M10 6l6 6-6 6" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 4v16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    trophy: '<path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H3.5a3.5 3.5 0 0 0 3.8 4M17 5h3.5a3.5 3.5 0 0 1-3.8 4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10.5 13h3v4h-3zM7 18h10v3H7z" fill="currentColor"/>',
    up: '<path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor"/>',
    card: '<path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5z" fill="currentColor"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
  };
  const KINDS = {
    follow: { label: 'NEW FOLLOWER', c: '#3dff9a', i: 'heart' },
    sub: { label: 'NEW SUB', c: '#a970ff', i: 'star' },
    resub: { label: 'RESUB', c: '#a970ff', i: 'star', amt: (n) => 'MONTH ' + n },
    giftsub: { label: 'GIFTED SUB', c: '#ff5fa2', i: 'gift' },
    gift: { label: 'SUB GIFTER', c: '#ff5fa2', i: 'gift', amt: (n) => n + ' GIFTED', count: true },
    giftbomb: { label: 'GIFT BOMB', c: '#b26bff', i: 'gift', amt: (n) => n + ' SUBS GIFTED', count: true },
    bits: { label: 'BITS', c: '#b56bff', i: 'gem', amt: (n) => n + ' BITS', count: true },
    kicks: { label: 'KICKS', c: '#53fc18', i: 'bolt', amt: (n) => n + ' KICKS', count: true },
    superchat: { label: 'SUPER CHAT', c: '#ffb020', i: 'coin' },
    raid: { label: 'RAID', c: '#ff8a1f', i: 'raid', amt: (n) => n + ' VIEWERS', count: true },
    battle: { label: 'BATTLE WIN', c: '#ffd23f', i: 'trophy' },
    upgrade: { label: 'CARD UPGRADE', c: null, i: 'up' },
    show: { label: 'VIEWER CARD', c: null, i: 'card' },
    link: { label: 'CARDS LINKED', c: '#4dc3ff', i: 'link' }
  };
  // gift subs: their all-time total, rank and the next milestone (it's about making gifters feel seen)
  const GIFT_CSS = `.al-gift{display:flex;gap:10px;margin-top:8px}.al-gift .t{flex:1;border-radius:10px;padding:6px 10px;background:rgba(197,139,255,.16);border:1px solid rgba(197,139,255,.55)}
  .al-gift .t.r{background:rgba(246,215,122,.12);border-color:rgba(246,215,122,.55)}.al-gift .t small{display:block;font:600 11px Inter,sans-serif;letter-spacing:2px;color:#e2d2ff}
  .al-gift .t.r small{color:#f6d77a}.al-gift .t b{font:800 38px 'Barlow Condensed',sans-serif;line-height:1;color:#fff}.al-gift .t b i{font-style:normal;font-size:18px;color:#f6d77a;margin-left:4px}
  .al-gm{margin-top:8px}.al-gm .l{display:flex;justify-content:space-between;font:500 13px Inter,sans-serif;color:#e2d2ff}.al-gm .l b{color:#fff}
  .al-gm .tr{height:9px;border-radius:5px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:4px}.al-gm .tr i{display:block;height:100%;background:linear-gradient(90deg,#8a4dff,#c58bff)}`;
  function giftBlock(g) {
    const pct = g.next ? Math.round(100 * (g.allTime - (g.prevAt || 0)) / Math.max(1, g.next - (g.prevAt || 0))) : 100;
    return '<div class="al-gift"><div class="t"><small>ALL-TIME GIFTED</small><b>' + g.allTime + '</b></div>' + (g.rank ? '<div class="t r"><small>RANK</small><b>#' + g.rank + '<i>OF ALL TIME</i></b></div>' : '') + '</div>' +
      (g.next ? '<div class="al-gm"><div class="l"><span><b>' + (g.next - g.allTime) + ' more</b> to ' + esc(g.nextName) + ' (' + g.next + ')</span><span>' + esc(g.level || '') + '</span></div><div class="tr"><i style="width:' + Math.max(3, Math.min(100, pct)) + '%"></i></div></div>'
        : '<div class="al-gm"><div class="l"><span><b>' + esc(g.level) + '</b>: the top level</span></div></div>');
  }
  function kindOf(a) {
    if (a.type === 'show') return a.note === 'CARDS LINKED' ? 'link' : 'show';
    return KINDS[a.kind] ? a.kind : 'upgrade';
  }
  function kinfo(a) {
    const k = kindOf(a);
    const K = Object.assign({}, KINDS[k]);
    if (!K.c) K.c = a.accent;
    if (k === 'raid' && /^hosted/i.test(a.reason || '')) K.label = 'HOST';
    if (k === 'show' && a.note) K.label = String(a.note).toUpperCase();
    return K;
  }
  const svg = (name) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + I[name] + '</svg>';
  const rnd = (a, b) => a + Math.random() * (b - a);
  const letters = (s) => Array.from(String(s)).map((ch) => '<span>' + esc(ch) + '</span>').join('');

  function anim(el, frames, opts) { return el.animate(frames, Object.assign({ fill: 'both', easing: 'ease-out' }, opts)); }

  // ---------- particles ----------
  function sparks(parent, x, y, color, n, power, delay) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('div');
      const s = rnd(3, 9);
      p.className = 'al-p';
      p.style.cssText = 'width:' + s + 'px;height:' + s + 'px;background:' + (Math.random() < 0.35 ? '#fff' : color) + ';box-shadow:0 0 ' + (s * 2) + 'px ' + color;
      parent.appendChild(p);
      const ang = rnd(0, Math.PI * 2), dist = rnd(0.35, 1) * power;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      const life = rnd(700, 1400);
      anim(p, [
        { transform: 'translate(' + x + 'px,' + y + 'px) scale(1)', opacity: 1 },
        { transform: 'translate(' + (x + dx * 0.8) + 'px,' + (y + dy * 0.8) + 'px) scale(.8)', opacity: 1, offset: 0.55 },
        { transform: 'translate(' + (x + dx) + 'px,' + (y + dy + power * 0.35) + 'px) scale(.2)', opacity: 0 }
      ], { duration: life, delay: delay || 0, easing: 'cubic-bezier(.15,.7,.3,1)' }).onfinish = () => p.remove();
    }
  }
  function ring(parent, x, y, size, delay, dur) {
    const r = document.createElement('div');
    r.className = 'al-ring';
    r.style.cssText = 'left:' + (x - size / 2) + 'px;top:' + (y - size / 2) + 'px;width:' + size + 'px;height:' + size + 'px';
    parent.appendChild(r);
    anim(r, [{ transform: 'scale(.1)', opacity: 0 }, { opacity: 1, offset: 0.1 }, { transform: 'scale(1)', opacity: 0 }], { duration: dur || 900, delay: delay || 0 }).onfinish = () => r.remove();
  }
  function embers(parent, w, h, n, dur) {
    for (let i = 0; i < n; i++) {
      const e = document.createElement('div');
      e.className = 'al-ember';
      const x = rnd(0, w), s = rnd(2, 6);
      e.style.cssText += 'left:' + x + 'px;top:' + h + 'px;width:' + s + 'px;height:' + s + 'px';
      parent.appendChild(e);
      anim(e, [{ transform: 'translate(0,0)', opacity: 0 }, { opacity: 0.9, offset: 0.2 }, { transform: 'translate(' + rnd(-40, 40) + 'px,' + (-rnd(h * 0.6, h * 1.3)) + 'px)', opacity: 0 }],
        { duration: rnd(1800, 3200), delay: rnd(600, dur - 2500), easing: 'linear' });
    }
  }
  function shake(el, at, power) {
    const p = power || 10;
    anim(el, [
      { transform: 'translate(0,0)' }, { transform: 'translate(' + -p + 'px,' + p * 0.6 + 'px)' }, { transform: 'translate(' + p * 0.8 + 'px,' + -p * 0.5 + 'px)' },
      { transform: 'translate(' + -p * 0.5 + 'px,' + -p * 0.3 + 'px)' }, { transform: 'translate(' + p * 0.3 + 'px,' + p * 0.2 + 'px)' }, { transform: 'translate(0,0)' }
    ], { duration: 420, delay: at, fill: 'none', easing: 'linear' });
  }
  function countUp(el, from, to, delay, dur, fmt) {
    const f = fmt || ((v) => v);
    el.textContent = f(from);
    setTimeout(() => {
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = f(Math.round(from + (to - from) * e));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
  }
  function revealLetters(container, delay, gap) {
    Array.from(container.children).forEach((s, i) => anim(s, [
      { transform: 'translateY(40px) rotateX(80deg) scale(1.4)', opacity: 0, filter: 'blur(6px)' },
      { transform: 'none', opacity: 1, filter: 'blur(0)' }
    ], { duration: 420, delay: delay + i * (gap || 35), easing: 'cubic-bezier(.2,.9,.3,1.3)' }));
  }

  // ---------- side panel alert (follows, subs, bits, raids, battle wins, !card) ----------
  // keep cards off your camera (and off the Live box during battles). Positions are 1920x1080 overlay pixels.
  function placeCard(el, w, h) {
    if (!el) return;
    const S = window.BBR_SCREEN || { avoid: [], pos: 'auto' };
    const spots = { br: { right: 60, bottom: 84 }, bl: { left: 60, bottom: 84 }, tr: { right: 60, top: 80 }, tl: { left: 60, top: 80 } };
    const rectOf = (p, z) => ({ x: p.left != null ? p.left : 1920 - p.right - w * z, y: p.top != null ? p.top : 1080 - p.bottom - h * z, w: w * z, h: h * z });
    const over = (a, o) => Math.max(0, Math.min(a.x + a.w, o.x + o.w) - Math.max(a.x, o.x)) * Math.max(0, Math.min(a.y + a.h, o.y + o.h) - Math.max(a.y, o.y));
    // camera / Live box overlap counts far more than a Tangia or Streamlabs area
    const cost = (r) => (S.avoid || []).reduce((t, o) => t + over(r, o) * (o.zone ? 1 : 50), 0);
    let best = null;
    const order = S.pos && S.pos !== 'auto' ? [S.pos] : ['br', 'bl', 'tr', 'tl'];
    // shrink only to get off the camera / Live box; Tangia and Streamlabs areas just pick the best corner
    // (the cards already wait while those are playing)
    const camCost = (r) => (S.avoid || []).reduce((t, o) => t + (o.zone ? 0 : over(r, o)), 0);
    for (const z of [1, 0.8, 0.65]) {
      for (const k of order) { const r = rectOf(spots[k], z), c = cost(r); if (!best || (best.z === z ? c < best.c - 1 : camCost(r) < best.cam)) best = { k, z, c, cam: camCost(r) }; }
      if (best.cam === 0) break;
    }
    const p = spots[best.k], z = best.z;
    el.style.left = p.left != null ? p.left + 'px' : 'auto'; el.style.right = p.right != null ? p.right + 'px' : 'auto';
    el.style.top = p.top != null ? p.top + 'px' : 'auto'; el.style.bottom = p.bottom != null ? p.bottom + 'px' : 'auto';
    if (z !== 1) { el.style.transform = 'scale(' + z + ')'; el.style.transformOrigin = (p.top != null ? 'top ' : 'bottom ') + (p.left != null ? 'left' : 'right'); }
    el.dataset.spot = best.k;
  }

  // full-screen moments (pack opening, tier up): if the card would land on the camera, slide it sideways, then shrink
  function rectOf(el) { let x = 0, y = 0, e = el; while (e && e.id !== 'stage') { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; }
  function dodge(root, sel) {
    const S = window.BBR_SCREEN || {}, avoid = S.cam || S.avoid || [];
    if (!avoid.length) return;
    const els = Array.from(root.querySelectorAll(sel)).filter((e) => e.offsetWidth && e.offsetWidth < 1800);
    if (!els.length) return;
    const R = els.map(rectOf);
    const box = { x: Math.min(...R.map((r) => r.x)), y: Math.min(...R.map((r) => r.y)) }; box.w = Math.max(...R.map((r) => r.x + r.w)) - box.x; box.h = Math.max(...R.map((r) => r.y + r.h)) - box.y;
    const hit = (b) => avoid.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
    if (!hit(box)) return;
    for (const z of [1, 0.8, 0.65]) for (const dx of [-480, 480, -720, 720, -260, 260]) {
      const w = box.w * z, h = box.h * z, cx = box.x + box.w / 2 + dx, cy = box.y + box.h / 2;
      const b = { x: cx - w / 2, y: cy - h / 2, w, h };
      if (b.x < 10 || b.x + b.w > 1910) continue;
      if (hit(b)) continue;
      els.forEach((e) => { e.style.marginLeft = dx + 'px'; if (z !== 1) { e.style.zoom = z; } });
      return;
    }
  }

  // stream streak roll-call: everyone who reached a new streak level, side by side
  const SKC = [null, '#ff8a3d', '#ff5a1f', '#3db8ff', '#b26bff', '#ffd34d'];
  function streakUp(stage, a, dur) {
    const list = (a.cards || []).slice(0, 4), n = list.length;
    const W = 60 + n * 210, H = 410;
    const root = document.createElement('div');
    root.className = 'al';
    root.style.setProperty('--acc', a.accent);
    root.innerHTML = '<div class="al-wrap sk-wrap" style="width:' + W + 'px;height:' + H + 'px">' +
      '<div class="al-panel" style="background:linear-gradient(160deg,rgba(40,18,6,.95),rgba(10,12,15,.95))"><div class="al-sheen"></div></div>' +
      '<div class="sk-hd">STREAK!</div><div class="sk-row">' + list.map((c, i) => {
        const col = SKC[c.streak.level] || '#ff8a3d';
        return '<div class="sk-it" style="--d:' + (0.35 + i * 0.25) + 's;--c:' + col + '"><div class="sk-cd"><div class="' + BBR.wrapClass(c.tier) + '">' + BBR.render(c, { accent: a.accent, edges: 6 }) + '</div></div>' +
          '<div class="sk-n"><b>' + c.streak.now + '</b> IN A ROW</div><div class="sk-l" style="color:' + col + '">' + esc(c.streak.name) + ' · +' + c.boost + ' EVERY STAT</div>' + (c.gotSaver ? '<div class="sk-s">+ STREAK SAVER</div>' : '') + '</div>';
      }).join('') + '</div></div>';
    stage.appendChild(root);
    const wrap = root.querySelector('.al-wrap');
    placeCard(wrap, W, H);
    anim(wrap, [{ opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.93 }, { opacity: 0 }], { duration: dur, easing: 'linear' });
    list.forEach((c, i) => setTimeout(() => { const it = root.querySelectorAll('.sk-it')[i]; if (it) sparks(it, 95, 120, SKC[c.streak.level] || '#ff8a3d', 18, 140); }, 600 + i * 250));
    return root;
  }

  // check-in strip: who said hello this stream (and merged follows after an off-air hold)
  const PC = { twitch: '#9146ff', kick: '#53fc18', youtube: '#ff2a3d' };
  function checkin(stage, a, dur) {
    const root = document.createElement('div');
    root.className = 'al';
    root.style.setProperty('--acc', a.accent || '#3dff9a');
    const list = a.list || [];
    const first = list.filter((x) => x.first), rest = list.filter((x) => !x.first);
    let h = '<div class="ci-wrap">';
    for (const x of first.slice(0, 2)) if (!x.card) h += '<div class="ci-new"><div class="ci-av" style="border-color:#f6d77a">' + (x.avatar && /^https:\/\//.test(x.avatar) ? '<img src="' + esc(x.avatar) + '" alt="" onerror="this.remove()">' : '') + esc(String(x.display).slice(0, 2).toUpperCase()) + '</div><div><div class="ci-t1">FIRST TIME HERE</div><div class="ci-t2">Welcome <b>' + esc(x.display) + '</b>! Your card is ready: type !card</div></div></div>';
    const cards = list.filter((x) => x.card).slice(0, 5), withCard = new Set(cards);
    if (cards.length) h += '<div class="ci-cards">' + cards.map((x) => '<div class="ci-c">' + (x.stat ? '<div class="ci-up">+' + Math.max(1, (x.to || 0) - (x.from || 0)) + ' ' + esc(x.stat) + '</div>' : x.first ? '<div class="ci-up" style="background:#f6d77a">NEW</div>' : '') +
      '<div class="m">' + BBR.render(x.card, { accent: a.accent, edges: 6 }) + '</div><div class="ci-cn">' + esc(x.display) + (x.ovrFrom != null && x.ovrFrom !== x.ovr ? ' <em>' + x.ovrFrom + '&rarr;' + x.ovr + '</em>' : '') + '</div></div>').join('') + '</div>';
    const pills = rest.concat(first.slice(2)).filter((x) => !withCard.has(x));
    if (pills.length) h += '<div class="ci-strip"><span class="ci-h">' + esc(a.title || 'CHECKED IN') + '</span>' + pills.map((x) => '<span class="ci-p"><i style="background:' + (PC[x.platform] || '#888') + '"></i>' + esc(x.display) + (x.follow ? '' : '<b style="color:' + (x.streak >= 10 ? '#3db8ff' : x.streak >= 3 ? '#ff8a3d' : '#7dffb8') + '">' + (x.streak > 1 ? x.streak : 'NEW') + '</b>') + '</span>').join('') + (a.more ? '<span class="ci-p">+' + a.more + ' more</span>' : '') + '</div>';
    h += '</div>';
    root.innerHTML = h;
    stage.appendChild(root);
    const wrap = root.querySelector('.ci-wrap');
    placeCard(wrap, 900, cards.length ? 330 : 120);
    anim(wrap, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none', offset: 0.08 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: dur, easing: 'ease-out' });
    wrap.querySelectorAll('.ci-p').forEach((p, i) => anim(p, [{ opacity: 0, transform: 'translateX(-20px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 250 + i * 120 }));
    wrap.querySelectorAll('.ci-c').forEach((p, i) => { anim(p, [{ opacity: 0, transform: 'translateY(60px) rotateY(80deg)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 200 + i * 160, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
      const up = p.querySelector('.ci-up'); if (up) { anim(up, [{ opacity: 0, transform: 'translateX(-50%) scale(.3)' }, { opacity: 1, transform: 'translateX(-50%) scale(1.25)', offset: 0.7 }, { opacity: 1, transform: 'translateX(-50%) scale(1)' }], { duration: 500, delay: 900 + i * 160 }); setTimeout(() => sparks(p, 80, 10, '#3dff9a', 14, 90), 1100 + i * 160); } });
    return root;
  }

  // the card turns over to show its back, then turns home (B)
  function flipHtml(c, p, accent, edges) { return '<div class="bbr-flip"><div class="f">' + BBR.render(c, { accent, edges }) + '</div><div class="b">' + BBR.back(c, p, { accent }) + '</div></div>'; }
  function runFlip(el, dur) {
    const f = el && el.querySelector('.bbr-flip'); if (!f) return;
    const at = Math.min(3200, dur * 0.3), back = Math.min(dur - 1600, at + 3800);
    // squash to a sliver, swap faces, open back out (looks like a turn, works with all the 3D card layers)
    const turn = (showBack) => { f.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0.02)' }], { duration: 300, easing: 'cubic-bezier(.6,0,1,1)' }).onfinish = () => { f.classList.toggle('back', showBack); f.animate([{ transform: 'scaleX(0.02)' }, { transform: 'scaleX(1)' }], { duration: 360, easing: 'cubic-bezier(0,0,.3,1.3)' }); }; };
    setTimeout(() => { turn(true); SFX.play('whoosh'); }, at);
    setTimeout(() => { turn(false); SFX.play('swoosh'); }, back);
  }
  // C: !card as a player profile (card + stat shape + their numbers)
  const RADAR = ['WAT', 'SUB', 'SUP', 'CHT', 'LOY', 'RAI', 'STK'];
  function radar(c, col) {
    const cx = 160, cy = 128, R0 = 92, pt = (i, r) => { const an = -Math.PI / 2 + i * 2 * Math.PI / RADAR.length; return [cx + Math.cos(an) * r, cy + Math.sin(an) * r]; };
    const poly = (r) => RADAR.map((k, i) => pt(i, typeof r === 'function' ? r(k) : r).map((n) => n.toFixed(1)).join(',')).join(' ');
    const val = (k) => R0 * Math.max(0.06, (Number((c.stats || {})[k] || 40) - 40) / 59);
    return '<svg viewBox="0 0 320 260" width="300" height="244" role="img" aria-label="Stat shape" style="overflow:visible"><g fill="none" stroke="rgba(255,255,255,.14)"><polygon points="' + poly(R0) + '"/><polygon points="' + poly(R0 * 0.5) + '"/></g>' +
      '<polygon class="pf-shape" points="' + poly(val) + '" fill="' + col + '55" stroke="' + col + '" stroke-width="3" stroke-linejoin="round"/>' +
      RADAR.map((k, i) => { const [x, y] = pt(i, R0 + 18); return '<text x="' + x.toFixed(0) + '" y="' + (y + 5).toFixed(0) + '" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="800" font-size="16" fill="' + col + '">' + k + ' <tspan fill="#fff">' + Number((c.stats || {})[k] || 40) + '</tspan></text>'; }).join('') + '</svg>';
  }
  function profile(stage, a, dur) {
    const c = a.card, p = a.profile, T = BBR.tier(c.tier, a.accent), col = T.color, sb = BBR.subBand(c);
    const root = document.createElement('div'); root.className = 'al';
    root.style.setProperty('--k', col); root.style.setProperty('--acc', a.accent);
    const n = (x) => Number(x || 0).toLocaleString('en-GB');
    const cells = [['Watch time', n(p.watchH) + ' h'], ['Streams', n(p.streams)], ['Bits', n(p.bits)], ['Gifted', n(p.gifted)], ['Battles', p.battlesW + ' W · ' + p.battlesL + ' L'], [p.queen ? 'Queen kills' : 'Raids', n(p.queen || p.raids)]];
    root.innerHTML = '<div class="pf-wrap"><div class="pf-pan"></div><div class="pf-card"><div class="' + BBR.wrapClass(c.tier) + '">' + (a.flip ? flipHtml(c, p, a.accent, 10) : BBR.render(c, { accent: a.accent, edges: 10 })) + '</div></div>' +
      '<div class="pf-r"><div class="pf-hd"><div class="pf-k">PLAYER PROFILE · ' + esc(T.label) + ' ' + c.ovr + '</div><div class="pf-n">' + letters(c.display) + '</div>' +
      '<div class="pf-s">' + (p.rank ? '<b>#' + p.rank + '</b> of ' + p.of + ' in the club' : '') + (sb ? ' · ' + esc(sb.text.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase())) : '') + (c.facts && c.facts.style ? ' · ' + esc(c.facts.style.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase())) : '') + '</div></div>' +
      '<div>' + radar(c, col) + '</div><div class="pf-g">' + cells.map((x) => '<div><small>' + esc(x[0]) + '</small><b>' + esc(x[1]) + '</b></div>').join('') + '</div></div></div>';
    stage.appendChild(root);
    const wrap = root.querySelector('.pf-wrap'); placeCard(wrap, 1060, 440);
    anim(wrap, [{ opacity: 0, transform: 'translateX(80px)' }, { opacity: 1, transform: 'none', offset: 0.06 }, { opacity: 1, offset: 0.93 }, { opacity: 0, transform: 'translateX(40px)' }], { duration: dur });
    anim(root.querySelector('.pf-card'), [{ transform: 'translateY(40px) rotateY(-70deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 250, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
    anim(root.querySelector('.pf-shape'), [{ transform: 'scale(0)', transformOrigin: '160px 128px' }, { transform: 'scale(1)', transformOrigin: '160px 128px' }], { duration: 900, delay: 700, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
    root.querySelectorAll('.pf-g div').forEach((d, i) => anim(d, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 350, delay: 900 + i * 110 }));
    runFlip(root, dur);
    return root;
  }

  function panel(stage, a, dur) {
    const c = a.card, K = kinfo(a), T = BBR.tier(c.tier, a.accent);
    const root = document.createElement('div');
    root.className = 'al';
    if (a.gift && !document.getElementById('gift-css')) { const st = document.createElement('style'); st.id = 'gift-css'; st.textContent = GIFT_CSS; document.head.appendChild(st); }
    root.style.setProperty('--k', K.c);
    root.style.setProperty('--acc', a.accent);

    let why = esc(a.type === 'show' ? (a.why || T.label + ' · Requested with !card') : (a.reason || ''));
    if (a.type === 'show' && c.lockHint) why += '<br><span style="font-size:14px">' + esc(c.lockHint) + '</span>';
    if (a.banked) why += '<br><span style="font-size:14px">Extra support banked: it keeps adding over the next days</span>';
    const bars = [];
    if (a.type !== 'show') {
      (a.raised || []).slice(0, 3).forEach((r) => bars.push(r));
      if (a.ovrFrom != null && a.ovrFrom !== c.ovr) bars.push({ k: 'OVR', from: a.ovrFrom, to: c.ovr });
    }
    const amt = K.amt && a.amount ? '<span class="al-amt" id="alamt">' + esc(K.amt(a.amount)) + '</span>' : '';
    root.innerHTML =
      '<div class="al-wrap">' +
        '<div class="al-panel"><div class="al-sheen"></div></div>' +
        '<div class="al-edge"></div>' +
        '<div class="al-badge"><div class="ic">' + svg(K.i) + '</div>' + esc(K.label) + '</div>' +
        '<div class="al-card"><div class="' + BBR.wrapClass(c.tier) + '"><div class="m" style="perspective:1400px">' + (a.flip ? flipHtml(c, a.profile, a.accent, 10) : BBR.render(c, { accent: a.accent, edges: 10 })) + '</div></div></div>' +
        '<div class="al-txt">' +
          '<div class="al-kick">' + (a.type === 'show' ? esc(T.label) + ' · OVR ' + c.ovr : (a.tierUp ? 'TIER UP · ' + esc(T.label) : esc(T.label) + ' CARD')) + amt + '</div>' +
          '<div class="al-name">' + letters(c.display) + '</div>' +
          '<div class="al-why">' + why + '</div>' +
          (a.gift ? giftBlock(a.gift) : '') +
          (!a.gift && bars.length ? '<div class="al-bars">' + bars.map((b, i) => '<div class="al-bar" data-i="' + i + '"><div class="k">' + esc(b.k) + '</div><div class="tr"><div class="gh"></div><div class="fi"></div></div><div class="n"><span>' + b.from + '</span><i>+' + (b.to - b.from) + '</i></div></div>').join('') + '</div>' : '') +
          (a.newRibbon ? '<div class="al-chip">' + esc(a.newRibbon) + ' RIBBON EARNED</div>' : '') +
        '</div>' +
      '</div>';
    stage.appendChild(root);
    const wrap = root.querySelector('.al-wrap'), pan = root.querySelector('.al-panel'), edge = root.querySelector('.al-edge');
    placeCard(wrap, 880, 340);
    const card = root.querySelector('.al-card'), badge = root.querySelector('.al-badge'), txt = root.querySelector('.al-txt');
    const W = 880, H = 340;

    // light streaks race in from the right edge of the screen
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('div');
      s.className = 'al-streak';
      const y = rnd(-40, H + 20), w = rnd(300, 700);
      s.style.cssText = 'top:' + y + 'px;left:' + (W - w) + 'px;width:' + w + 'px';
      wrap.appendChild(s);
      anim(s, [{ transform: 'translateX(' + (w + 200) + 'px) scaleX(.3)', opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: 'translateX(' + (-W - 300) + 'px) scaleX(1)', opacity: 0 }],
        { duration: rnd(500, 800), delay: i * 70, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => s.remove();
    }
    // panel wipes open behind a glowing edge
    anim(pan, [{ clipPath: 'inset(0 0 0 100% round 18px)' }, { clipPath: 'inset(0 0 0 0 round 18px)' }], { duration: 560, delay: 180, easing: 'cubic-bezier(.7,0,.2,1)' });
    anim(edge, [{ transform: 'translateX(' + W + 'px)', opacity: 0 }, { opacity: 1, offset: 0.1 }, { transform: 'translateX(-4px)', opacity: 1, offset: 0.85 }, { transform: 'translateX(-4px)', opacity: 0 }], { duration: 700, delay: 180, easing: 'cubic-bezier(.7,0,.2,1)' });
    anim(root.querySelector('.al-sheen'), [{ transform: 'translateX(0) rotate(18deg)' }, { transform: 'translateX(' + W * 1.6 + 'px) rotate(18deg)' }], { duration: 1300, delay: 900, iterations: 3, endDelay: 1200, easing: 'ease-in-out' });
    // badge slams in
    anim(badge, [{ transform: 'scale(3) rotate(-12deg)', opacity: 0 }, { transform: 'scale(.9) rotate(2deg)', opacity: 1, offset: 0.7 }, { transform: 'scale(1) rotate(0)', opacity: 1 }], { duration: 420, delay: 520, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    setTimeout(() => { ring(wrap, 60, -10, 180, 0, 700); sparks(wrap, 60, -10, K.c, 16, 120); }, 760);
    // card flies in spinning and lands with a shockwave
    anim(card, [
      { transform: 'translate(-520px,-420px) rotateY(-900deg) rotateZ(-30deg) scale(.25)', opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { transform: 'translate(0,-10px) rotateY(-20deg) rotateZ(2deg) scale(1.12)', opacity: 1, offset: 0.82 },
      { transform: 'translate(0,0) rotateY(0) rotateZ(0) scale(1)', opacity: 1 }
    ], { duration: 1000, delay: 380, easing: 'cubic-bezier(.25,.8,.3,1)' });
    setTimeout(() => {
      ring(wrap, 137, 170, 380, 0, 800); ring(wrap, 137, 170, 260, 120, 700);
      sparks(wrap, 137, 170, K.c, 34, 260);
      shake(wrap, 0, 8);
    }, 1330);
    // idle float after landing
    anim(card.firstChild, [{ transform: 'rotateY(0) translateY(0)' }, { transform: 'rotateY(12deg) translateY(-6px)' }, { transform: 'rotateY(-10deg) translateY(2px)' }, { transform: 'rotateY(0) translateY(0)' }],
      { duration: 4200, delay: 1500, iterations: Infinity, easing: 'ease-in-out' });
    // text
    anim(txt.querySelector('.al-kick'), [{ opacity: 0, transform: 'translateX(30px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 950 });
    revealLetters(txt.querySelector('.al-name'), 1050, 32);
    anim(txt.querySelector('.al-why'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 1500 });
    const am = root.querySelector('#alamt');
    if (am) {
      am.removeAttribute('id');
      if (K.count) countUp(am, 0, a.amount, 1200, 1100, (v) => K.amt(v));
      anim(am, [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.5 }, { transform: 'scale(1)' }], { duration: 380, delay: 2300, fill: 'none' });
    }
    root.querySelectorAll('.al-bar').forEach((row, i) => {
      const b = bars[i], d = 1900 + i * 260;
      const pct = (v) => Math.max(3, Math.min(100, ((v - 40) / 59) * 100)) + '%';
      anim(row, [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: d - 200 });
      row.querySelector('.gh').style.width = pct(b.to);
      anim(row.querySelector('.gh'), [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: d });
      anim(row.querySelector('.fi'), [{ width: pct(b.from) }, { width: pct(b.to) }], { duration: 900, delay: d + 150, easing: 'cubic-bezier(.3,.9,.3,1)' });
      countUp(row.querySelector('.n span'), b.from, b.to, d + 150, 900);
      anim(row.querySelector('.n i'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: d + 900 });
      setTimeout(() => { if (row.isConnected) { const r = row.getBoundingClientRect(), w = wrap.getBoundingClientRect(); sparks(wrap, r.right - w.left - 70, r.top - w.top + 14, K.c, 10, 70); } }, d + 1050);
    });
    const chip = root.querySelector('.al-chip');
    if (chip) anim(chip, [{ opacity: 0, transform: 'scale(1.8) rotate(-6deg)' }, { opacity: 1, transform: 'scale(1) rotate(0)' }], { duration: 380, delay: 2600 + bars.length * 260, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    embers(wrap, W, H, 18, dur);
    // exit
    const out = dur - 650;
    anim(card, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-30px) rotateY(180deg) scale(.6)', opacity: 0 }], { duration: 500, delay: out, fill: 'forwards', easing: 'ease-in', composite: 'replace' });
    anim(wrap, [{ clipPath: 'inset(-60px -60px -60px -60px)', opacity: 1 }, { clipPath: 'inset(-60px -60px -60px 100%)', opacity: 0.3 }], { duration: 600, delay: out + 50, fill: 'forwards', easing: 'cubic-bezier(.7,0,.6,1)' });
    return root;
  }

  // ---------- tier up: full-screen takeover ----------
  function tierUp(stage, a, dur) {
    const c = a.card, T = BBR.tier(c.tier, a.accent), F = BBR.tier(a.tierFrom || 'bronze', a.accent), K = kinfo(a);
    const col = c.tier === 'legend' ? a.accent : T.color;
    const root = document.createElement('div');
    root.className = 'al';
    root.style.setProperty('--k', col);
    root.style.setProperty('--acc', a.accent);
    const stats = [];
    (a.raised || []).slice(0, 3).forEach((r) => stats.push(r));
    if (a.ovrFrom != null) stats.push({ k: 'OVR', from: a.ovrFrom, to: c.ovr });
    root.innerHTML =
      '<div class="tu-dim"></div>' +
      '<div class="tu-beams" style="background:repeating-conic-gradient(from 0deg,' + col + '77 0deg 4deg,transparent 4deg 18deg)"></div>' +
      '<div class="tu-card"><div class="' + BBR.wrapClass(c.tier) + '"><div class="sw">' + BBR.render(Object.assign({}, c, { ribbon: a.newRibbon || c.ribbon }), { accent: a.accent }) + '</div></div></div>' +
      '<div class="tu-stamp">TIER UP</div>' +
      '<div class="tu-tiers"><span class="old">' + esc(F.label) + '</span><span class="arr">▶</span><span class="new">' + esc(T.label) + '</span></div>' +
      '<div class="tu-name">' + letters(c.display) + '</div>' +
      '<div class="tu-why">' + esc(K.label) + ' · ' + esc(a.reason || '') + (a.newRibbon ? ' · ' + esc(a.newRibbon) + ' ribbon earned' : '') + '</div>' +
      '<div class="tu-stats">' + stats.map((s) => '<div class="tu-stat"><div class="k">' + esc(s.k) + '</div><div class="v"><span>' + s.from + '</span><i>+' + (s.to - s.from) + '</i></div></div>').join('') + '</div>';
    stage.appendChild(root);
    const q = (s) => root.querySelector(s);
    anim(q('.tu-dim'), [{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
    anim(q('.tu-beams'), [{ opacity: 0, transform: 'scale(.6) rotate(0deg)' }, { opacity: 1, transform: 'scale(1) rotate(40deg)', offset: 0.1 }, { opacity: 1, transform: 'scale(1) rotate(200deg)' }], { duration: dur, delay: 1900, easing: 'linear' });
    // the card arrives in the OLD tier's colour feel: spinning fast, then slows and bursts
    const cardEl = q('.tu-card');
    anim(cardEl, [
      { transform: 'translateY(500px) rotateY(0) scale(.4)', opacity: 0, filter: 'brightness(.4) grayscale(1)' },
      { transform: 'translateY(0) rotateY(1080deg) scale(.9)', opacity: 1, filter: 'brightness(.6) grayscale(.8)', offset: 0.55 },
      { transform: 'translateY(0) rotateY(1440deg) scale(.95)', opacity: 1, filter: 'brightness(3) grayscale(0)', offset: 0.92 },
      { transform: 'translateY(0) rotateY(1440deg) scale(1)', opacity: 1, filter: 'brightness(1) grayscale(0)' }
    ], { duration: 2000, easing: 'cubic-bezier(.3,.6,.4,1)' });
    anim(q('.sw'), [{ transform: 'rotateY(0) rotateX(0)' }, { transform: 'rotateY(-16deg) rotateX(4deg)' }, { transform: 'rotateY(16deg) rotateX(-3deg)' }, { transform: 'rotateY(0) rotateX(0)' }], { duration: 5000, delay: 2100, iterations: Infinity, easing: 'ease-in-out' });
    setTimeout(() => {
      const fl = document.createElement('div');
      fl.style.cssText = 'position:absolute;inset:0;background:#fff';
      root.appendChild(fl);
      anim(fl, [{ opacity: 0.95 }, { opacity: 0 }], { duration: 700 }).onfinish = () => fl.remove();
      ring(root, 960, 405, 900, 0, 1100); ring(root, 960, 405, 600, 150, 900); ring(root, 960, 405, 1400, 250, 1300);
      sparks(root, 960, 405, col, 70, 620);
      shake(root, 0, 16);
    }, 1850);
    anim(q('.tu-stamp'), [{ transform: 'scale(4)', opacity: 0, filter: 'blur(10px)' }, { transform: 'scale(.92)', opacity: 1, filter: 'blur(0)', offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 450, delay: 2300, easing: 'cubic-bezier(.4,1.4,.6,1)' });
    setTimeout(() => shake(root, 0, 10), 2620);
    anim(q('.tu-tiers'), [{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 2700 });
    anim(q('.tu-tiers .new'), [{ transform: 'scale(1)' }, { transform: 'scale(1.4)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 500, delay: 3450, fill: 'none' });
    setTimeout(() => { const r = q('.tu-tiers .new'); if (r) { const b = r.getBoundingClientRect(), s = root.getBoundingClientRect(); sparks(root, b.left - s.left + b.width / 2, b.top - s.top + b.height / 2, col, 30, 200); } }, 3500);
    revealLetters(q('.tu-name'), 3300, 40);
    anim(q('.tu-why'), [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 3900 });
    root.querySelectorAll('.tu-stat').forEach((el, i) => {
      const s = stats[i], d = 4200 + i * 220;
      anim(el, [{ opacity: 0, transform: 'translateY(24px) scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: d, easing: 'cubic-bezier(.3,1.4,.5,1)' });
      countUp(el.querySelector('span'), s.from, s.to, d + 200, 800);
    });
    embers(root, 1920, 1080, 40, dur);
    anim(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: dur - 650, fill: 'forwards' });
    return root;
  }

  // ---------- extra effects layered on the pack opening ----------
  function packFx(el, a) {
    const c = a.card, T = BBR.tier(c.tier, a.accent), col = c.tier === 'legend' ? a.accent : T.color;
    const K = kinfo(a);
    el.style.setProperty('--k', col);
    // kind banner at the top
    const ban = document.createElement('div');
    ban.className = 'al';
    ban.style.setProperty('--k', K.c);
    ban.innerHTML = '<div class="al-badge" style="left:50%;top:150px;transform:translateX(-50%);font-size:30px;padding:10px 26px 10px 12px"><div class="ic">' + svg(K.i) + '</div>' + esc(K.label) + '</div>';
    el.appendChild(ban);
    const b = ban.firstChild;
    anim(b, [{ transform: 'translateX(-50%) translateY(-200px)', opacity: 0 }, { transform: 'translateX(-50%) translateY(10px)', opacity: 1, offset: 0.7 }, { transform: 'translateX(-50%)', opacity: 1 }], { duration: 600, delay: 200, easing: 'cubic-bezier(.3,1.3,.5,1)' });
    anim(ban, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 2100, fill: 'forwards' });
    // glowing cracks build up on the pack before it bursts
    const pack = el.querySelector('.pack');
    if (pack) {
      for (let i = 0; i < 6; i++) {
        const cr = document.createElement('div');
        cr.style.cssText = 'position:absolute;left:' + rnd(20, 180) + 'px;top:' + rnd(30, 300) + 'px;width:' + rnd(40, 110) + 'px;height:3px;background:#fff;box-shadow:0 0 12px 3px ' + col + ';transform:rotate(' + rnd(-70, 70) + 'deg);z-index:4';
        pack.appendChild(cr);
        anim(cr, [{ opacity: 0, transform: cr.style.transform + ' scaleX(0)' }, { opacity: 1, transform: cr.style.transform + ' scaleX(1)' }], { duration: 250, delay: 1200 + i * 150 });
      }
    }
    setTimeout(() => {
      // burst: shards, rings, sparks, shake
      for (let i = 0; i < 16; i++) {
        const s = document.createElement('div');
        s.className = 'al-shard';
        const sz = rnd(30, 80);
        s.style.cssText = 'width:' + sz + 'px;height:' + sz + 'px;background:linear-gradient(135deg,#3a434e,#0b0d10);border:2px solid ' + col + ';clip-path:polygon(' + [0, 1, 2].map(() => rnd(0, 100) + '% ' + rnd(0, 100) + '%').join(',') + ')';
        el.appendChild(s);
        const ang = rnd(0, Math.PI * 2), d = rnd(300, 800);
        anim(s, [
          { transform: 'translate(' + (960 - sz / 2) + 'px,' + (540 - sz / 2) + 'px) rotate(0)', opacity: 1 },
          { transform: 'translate(' + (960 + Math.cos(ang) * d) + 'px,' + (540 + Math.sin(ang) * d + 200) + 'px) rotate(' + rnd(-720, 720) + 'deg)', opacity: 0 }
        ], { duration: rnd(900, 1500), easing: 'cubic-bezier(.1,.7,.4,1)' }).onfinish = () => s.remove();
      }
      ring(el, 960, 540, 700, 0, 900); ring(el, 960, 540, 1200, 120, 1100);
      sparks(el, 960, 540, col, 60, 520);
      shake(el, 0, 14);
    }, 2250);
    // card landing
    setTimeout(() => { ring(el, 960, 480, 600, 0, 900); sparks(el, 960, 480, col, 40, 380); shake(el, 0, 8); }, 5800);
    embers(el, 1920, 1080, 30, 10000);
  }

  function duration(a) {
    if (a.type === 'pack') return 10000;
    if (a.type === 'checkin') return 5200 + Math.min(6, (a.list || []).length) * ((a.list || []).some((x) => x.card) ? 500 : 250);
    if (a.type === 'show' && a.profile && a.wide) return a.flip ? 11500 : 9000;
    if (a.type === 'show' && a.flip) return 10000;
    if (a.type === 'streakup') return 6500 + (a.cards || []).length * 700;
    if (a.type === 'levelup' && a.tierUp) return 10500;
    if (a.type === 'levelup') return 8500;
    return 7500;
  }
  function sounds(a) {
    if (a.type === 'checkin') { (a.list || []).slice(0, 6).forEach((x, i) => SFX.play('pop', 0.25 + i * 0.12)); if ((a.list || []).some((x) => x.first)) SFX.play('sparkle', 0.2); return; }
    if (a.type === 'streakup') { SFX.play('whoosh', 0); SFX.play('riser', 0.1, 1); (a.cards || []).slice(0, 4).forEach((c, i) => { SFX.play('pop', 0.4 + i * 0.25); SFX.play('sparkle', 0.6 + i * 0.25); }); SFX.play('cheer', 1.2, 2); return; }
    if (!a.card) return;
    const t = a.card.tier;
    if (a.type === 'levelup' && a.tierUp) {
      SFX.play('riser', 0, 1.8); SFX.play('rumble', 0.2, 1.6); SFX.play('whoosh', 0.1);
      SFX.play('boom', 1.85); SFX.play('burst', 1.85); SFX.tierFx(t, 1.9);
      SFX.play('impact', 2.35); SFX.play('fanfare', 2.5); SFX.play('cheer', 2.5, 3);
      SFX.play('sparkle', 3.45); SFX.play('ding', 4.2);
      return;
    }
    const k = kindOf(a);
    SFX.play('whoosh', 0); SFX.play('swoosh', 0.2); SFX.play('pop', 0.55);
    SFX.play('whoosh', 0.4); SFX.play('impact', 1.33); SFX.tierFx(t, 1.35);
    if (k === 'bits' || k === 'kicks' || k === 'superchat' || k === 'gift') SFX.play('sparkle', 1.2);
    if (k === 'raid') { SFX.play('horn', 0.5, 0.6); SFX.play('cheer', 1.4, 2.2); }
    if (k === 'battle') SFX.play('cheer', 1.4, 2);
    if (k === 'sub' || k === 'resub' || k === 'giftsub' || k === 'follow') SFX.play('sparkle', 1.5);
    const n = a.type === 'show' ? 0 : Math.min(4, (a.raised || []).length + (a.ovrFrom !== a.card.ovr ? 1 : 0));
    for (let i = 0; i < n; i++) SFX.play('tick', 2.05 + i * 0.26);
    if (n) SFX.play('ding', 2.1 + n * 0.26);
    if (a.newRibbon) { SFX.play('impact', 2.6 + n * 0.26); SFX.play('fanfare', 2.7 + n * 0.26); }
  }
  function play(stage, a) {
    const dur = duration(a);
    if (!(a.type === 'show' && a.profile && a.wide)) sounds(a);
    if (a.type === 'show' && a.profile && a.wide && a.card) { const el = profile(stage, a, dur); SFX.play('whoosh', 0); SFX.play('impact', 0.5); SFX.tierFx(a.card.tier, 0.55); SFX.play('sparkle', 1); return { el, dur }; }
    const el = a.type === 'checkin' ? checkin(stage, a, dur) : a.type === 'streakup' ? streakUp(stage, a, dur) : a.type === 'levelup' && a.tierUp ? tierUp(stage, a, dur) : panel(stage, a, dur);
    if (a.flip) runFlip(el, dur);
    if (a.type === 'levelup' && a.tierUp) requestAnimationFrame(() => dodge(el, '.tu-card, .tu-stamp, .tu-tiers, .tu-name, .tu-why, .tu-stats'));
    return { el, dur };
  }

  window.ALERTS = { play, packFx, duration, placeCard, dodge };
})();
