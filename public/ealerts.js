/* v44 BBR alerts on the overlay: follows, subs, gifts, bits, raids, hosts, Super Chats...
   Three looks (banner, card, takeover) in the stream's theme (football, elite, trucking, heist), with your own
   sound, picture / GIF, video and a read-out of their message. EALERT.play(stage, a, finish) → { el, dur }. */
(function () {
  const esc = (s) => (window.BBR && BBR.esc ? BBR.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const css = `
.ea{position:absolute;inset:0;pointer-events:none;font-family:'Barlow Condensed',sans-serif;color:#fff;z-index:58}
.ea .nm{color:var(--ek);}
.ea-kick{font-weight:800;letter-spacing:6px;font-size:22px;color:var(--ek)}
.ea-msg{font-family:Inter,sans-serif;font-size:19px;line-height:1.35;color:#dfe5ec;max-width:820px}
.ea-msg::before{content:"\\201C"}.ea-msg::after{content:"\\201D"}
.ea-names{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.ea-names span{font:600 16px Inter,sans-serif;background:rgba(255,255,255,.1);border-radius:999px;padding:3px 10px}
.ea-media{display:block;object-fit:contain;border-radius:10px;background:rgba(0,0,0,.25)}
.ea-av{border-radius:50%;object-fit:cover;background:#222a33;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;overflow:hidden;flex:0 0 auto}
.ea-av img{width:100%;height:100%;object-fit:cover}
/* banner: top centre */
.ea-ban{position:absolute;left:50%;top:70px;transform:translateX(-50%);display:flex;align-items:center;gap:18px;min-width:560px;max-width:1240px;padding:14px 26px 14px 14px;border-radius:16px;background:rgba(10,12,15,.94);border:2px solid var(--ek);box-shadow:0 14px 40px rgba(0,0,0,.5),0 0 30px color-mix(in srgb,var(--ek) 40%,transparent)}
.ea-ban .ea-icon{width:78px;height:78px;border-radius:12px;display:grid;place-items:center;background:var(--ek);color:#0a0c0f;flex:0 0 auto}
.ea-ban .ea-icon svg{width:44px;height:44px}
.ea-ban .ea-media{width:110px;height:110px}
.ea-ban .t{display:flex;flex-direction:column;gap:2px;min-width:0}
.ea-ban .big{font-size:44px;font-weight:800;line-height:1;text-transform:uppercase;letter-spacing:.5px}
.ea-vid{position:absolute;left:50%;transform:translateX(-50%);top:210px;width:640px;max-height:360px;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.6);border:2px solid var(--ek);background:#000}
/* card: bottom right, with their BBR card */
.ea-crd{position:absolute;right:60px;bottom:70px;width:900px;min-height:300px;border-radius:18px;background:linear-gradient(115deg,rgba(14,17,22,.97),rgba(10,12,15,.95) 55%,color-mix(in srgb,var(--ek) 22%,rgba(10,12,15,.95)));border:2px solid var(--ek);box-shadow:0 0 40px color-mix(in srgb,var(--ek) 45%,transparent),0 20px 50px rgba(0,0,0,.5);display:flex;gap:26px;padding:24px 30px 24px 26px;align-items:center}
.ea-crd .cd{position:relative;width:203px;height:296px;flex:0 0 auto}
.ea-crd .cd .m{position:absolute;left:0;top:0;width:260px;height:380px;transform:scale(.78);transform-origin:0 0}
.ea-crd .ea-media{width:200px;height:200px}
.ea-crd .t{display:flex;flex-direction:column;gap:6px;min-width:0}
.ea-crd .big{font-size:56px;font-weight:800;line-height:1;text-transform:uppercase}
.ea-crd .ea-vid{position:relative;left:auto;top:auto;transform:none;width:420px;max-height:236px;flex:0 0 auto}
/* takeover: the whole screen */
.ea-tk{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center}
.ea-tk .dim{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(10,12,16,.88) 0,rgba(5,6,8,.72) 55%,rgba(0,0,0,.45) 100%)}
.ea-tk .glow{position:absolute;left:50%;top:50%;width:1400px;height:1400px;transform:translate(-50%,-50%);background:radial-gradient(circle,color-mix(in srgb,var(--ek) 40%,transparent),transparent 60%)}
.ea-tk>*:not(.dim):not(.glow){position:relative}
.ea-tk .ea-kick{font-size:38px;letter-spacing:14px}
.ea-tk .big{font-size:150px;font-weight:800;line-height:.88;text-transform:uppercase;text-shadow:0 10px 40px rgba(0,0,0,.6),0 0 50px color-mix(in srgb,var(--ek) 50%,transparent);max-width:1800px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ea-tk .line{font-size:44px;font-weight:700;letter-spacing:1px}
.ea-tk .row{display:flex;gap:36px;align-items:center;justify-content:center}
.ea-tk .cd{position:relative;width:260px;height:380px}
.ea-tk .ea-media{max-width:520px;max-height:420px}
.ea-tk>.ea-vid{position:relative;left:auto;top:auto;transform:none;width:960px;max-height:540px}
.ea-tk .ea-msg{font-size:26px;max-width:1200px}
/* themes */
.ea.th-football{--ek:#e3132c}
.ea.th-football .ea-ban,.ea.th-football .ea-crd{background:#0b0f14;border:0;border-left:10px solid #e3132c;border-radius:4px;box-shadow:0 14px 36px rgba(0,0,0,.55)}
.ea.th-football .ea-ban .ea-icon{background:#fff;color:#e3132c;border-radius:2px}
.ea.th-football .ea-kick{background:#e3132c;color:#fff;align-self:flex-start;padding:2px 12px;letter-spacing:4px}
.ea.th-football .ea-tk .ea-kick{align-self:center}
.ea.th-elite{--ek:#d9b45a}
.ea.th-elite .ea-ban,.ea.th-elite .ea-crd{background:linear-gradient(180deg,#121212,#07070a);border:1px solid #d9b45a;box-shadow:0 0 0 6px #0b0b0e,0 0 0 7px rgba(217,180,90,.45),0 18px 44px rgba(0,0,0,.6);border-radius:6px}
.ea.th-elite .ea-ban .ea-icon{background:linear-gradient(#f3d58a,#a7802e);color:#0b0b0e;border-radius:4px}
.ea.th-elite .big{color:#f3d58a;letter-spacing:3px}.ea.th-elite .ea-kick{color:#f3d58a;letter-spacing:8px}
.ea.th-elite .ea-tk .dim{background:radial-gradient(circle at 50% 45%,rgba(30,26,16,.92),rgba(7,7,10,.85) 65%)}
.ea.th-ets{--ek:#f5b544}
.ea.th-ets .ea-ban,.ea.th-ets .ea-crd{background:#1f6b3a;border:4px solid #fff;border-radius:12px;box-shadow:0 14px 36px rgba(0,0,0,.55)}
.ea.th-ets .ea-ban .ea-icon{background:#f5b544;color:#1b1200;border-radius:6px}
.ea.th-ets .big{font-family:Inter,sans-serif;font-weight:800;text-transform:none;font-size:38px}
.ea.th-ets .ea-kick{color:#ffe08a}
.ea.th-ets .ea-tk .big{font-size:120px}
.ea.th-heist{--ek:#ff4fd8}
.ea.th-heist .ea-ban,.ea.th-heist .ea-crd{background:linear-gradient(120deg,rgba(43,15,58,.95),rgba(122,30,92,.92));border:2px solid #ff4fd8;box-shadow:0 0 0 3px #1a0626,0 0 0 5px #3ee6ff,0 0 40px #ff4fd8}
.ea.th-heist .big{color:#ffe3fa;text-shadow:0 0 10px #ff4fd8,0 0 26px #ff4fd8}.ea.th-heist .ea-kick{color:#d8fbff;text-shadow:0 0 10px #3ee6ff}
/* in / out */
@keyframes eaIn{from{opacity:0;transform:translate(-50%,-40px) scale(.92)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes eaInR{from{opacity:0;transform:translateX(120px)}to{opacity:1;transform:none}}
@keyframes eaFade{from{opacity:0}to{opacity:1}}
@keyframes eaPop{0%{opacity:0;transform:scale(.6)}60%{opacity:1;transform:scale(1.06)}100%{transform:scale(1)}}
.ea-ban{animation:eaIn .55s cubic-bezier(.2,1.2,.4,1) both}
.ea-crd{animation:eaInR .6s cubic-bezier(.2,1.1,.4,1) both}
.ea-tk{animation:eaFade .4s ease-out both}.ea-tk .big{animation:eaPop .7s .15s cubic-bezier(.2,1.3,.4,1) both}
.ea.out{transition:opacity .5s;opacity:0}
.ea-ad{position:absolute;left:50%;top:18px;transform:translateX(-50%);z-index:59;display:flex;align-items:center;gap:14px;padding:8px 18px;border-radius:999px;background:rgba(10,12,15,.92);border:2px solid #f5c400;font-family:'Barlow Condensed',sans-serif;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.ea-ad b{font-size:22px;letter-spacing:4px;color:#f5c400}.ea-ad span{font-size:34px;font-weight:800;font-variant-numeric:tabular-nums}.ea-ad small{font:500 14px Inter,sans-serif;color:#c9d1db}
.ea-ad.th-elite{border-color:#d9b45a}.ea-ad.th-elite b{color:#f3d58a}.ea-ad.th-football{border-radius:2px;border:0;border-left:8px solid #e3132c}.ea-ad.th-football b{color:#fff}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const I = {
    follow: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    gift: '<path d="M3 8h18v4H3zM12 8v13M5 12v9h14v-9M12 8C10 4 7 4 7 6s3 2 5 2c2 0 5 0 5-2s-3-2-5 2"/>',
    gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21 8 9l4-6 4 6z"/>',
    raid: '<path d="M2 12h13M10 6l6 6-6 6M19 4v16"/>',
    train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/>',
    heart2: '<path d="M12 21s-8-5-8-11a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 6-8 11-8 11zM9 11h6M12 8v6"/>',
    mega: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1 1.3-1.5 3-1.5s3 .7 3 1.8-1.3 1.6-3 2-3 1-3 2 1.3 1.8 3 1.8 3-.6 3-1.6"/>'
  };
  const ICON = { follow: 'follow', sub: 'star', resub: 'star', member: 'star', milestone: 'star', gift: 'gift', giftbomb: 'gift', giftsub: 'gift', giftmember: 'gift', bits: 'gem', powerup: 'gem', kicks: 'gem', redeem: 'star', raid: 'raid', host: 'raid', hypetrain: 'train', charity: 'heart2', shoutout: 'mega', superchat: 'coin', supersticker: 'coin' };
  const KICK = { follow: 'NEW FOLLOWER', sub: 'NEW SUB', resub: 'RESUB', gift: 'GIFTED SUBS', giftbomb: 'GIFT BOMB', giftsub: 'GIFTED SUB', bits: 'BITS', powerup: 'POWER-UP', redeem: 'CHANNEL POINTS', raid: 'INCOMING RAID', host: 'INCOMING HOST', hypetrain: 'HYPE TRAIN', charity: 'CHARITY', shoutout: 'SHOUT-OUT', kicks: 'KICKS', superchat: 'SUPER CHAT', supersticker: 'SUPER STICKER', member: 'NEW MEMBER', milestone: 'MEMBER MILESTONE', giftmember: 'GIFTED MEMBERSHIPS' };
  const ACC = { follow: '#3dff9a', sub: '#6c8cff', resub: '#6c8cff', member: '#6c8cff', milestone: '#6c8cff', gift: '#ff5fa2', giftbomb: '#b26bff', giftsub: '#ff5fa2', giftmember: '#ff5fa2', bits: '#b56bff', powerup: '#b56bff', kicks: '#53fc18', redeem: '#4dc3ff', raid: '#ff8a1f', host: '#53fc18', hypetrain: '#9146ff', charity: '#3dff9a', shoutout: '#4dc3ff', superchat: '#ff4d5e', supersticker: '#ff4d5e' };
  const svg = (k) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[ICON[k] || 'star'] + '</svg>';
  let theme = 'football';
  function setTheme(t) { theme = t || 'football'; }
  function titleHtml(a) {
    const t = esc(a.title || ''), n = esc(a.name || '');
    return n && t.includes(n) && !a.names ? t.replace(n, '<span class="nm">' + n + '</span>') : t;
  }
  function avatar(a, size) {
    const s = 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.42) + 'px';
    return '<div class="ea-av" style="' + s + '">' + (a.avatar ? '<img src="' + esc(a.avatar) + '" alt="">' : esc(String(a.name || '?').slice(0, 1).toUpperCase())) + '</div>';
  }
  function cardHtml(a, scale) {
    if (!a.card || !window.BBR || !BBR.render) return '';
    try { return '<div class="cd"><div class="' + BBR.wrapClass(a.card.tier) + '"><div class="m"' + (scale ? ' style="transform:scale(' + scale + ')"' : '') + '>' + BBR.render(a.card, { accent: a.accent || '#3dff9a', edges: 8 }) + '</div></div></div>'; } catch (e) { return ''; }
  }
  function mediaHtml(a) {
    if (a.image && a.image.url) return '<img class="ea-media" src="' + esc(a.image.url) + '" alt="">';
    return '';
  }
  const names = (a) => (a.names && a.names.length ? '<div class="ea-names">' + a.names.map((n) => '<span>' + esc(n) + '</span>').join('') + '</div>' : '');
  const msg = (a) => (a.message ? '<div class="ea-msg">' + esc(a.message) + '</div>' : '');
  function build(a) {
    const k = a.kind, kick = KICK[k] || String(a.label || '').toUpperCase();
    if (a.look === 'takeover') {
      return '<div class="ea-tk"><div class="dim"></div><div class="glow"></div><div class="ea-kick">' + esc(kick) + '</div>' +
        '<div class="big">' + esc(a.names ? a.title : a.name) + '</div>' + (a.names ? '' : '<div class="line">' + titleHtml(a) + '</div>') + names(a) +
        '<div class="row">' + (a.video ? '' : cardHtml(a) || (a.image ? '' : (a.avatar ? avatar(a, 220) : ''))) + mediaHtml(a) + '</div>' + (a.video ? '<video class="ea-vid" playsinline></video>' : '') + msg(a) + '</div>';
    }
    if (a.look === 'card') {
      const left = a.video ? '<video class="ea-vid" playsinline></video>' : a.image ? mediaHtml(a) : cardHtml(a) || avatar(a, 200);
      return '<div class="ea-crd">' + left + '<div class="t"><div class="ea-kick">' + esc(kick) + '</div><div class="big">' + titleHtml(a) + '</div>' + names(a) + msg(a) + '</div></div>';
    }
    return '<div class="ea-ban">' + (a.image ? mediaHtml(a) : a.avatar && !a.names ? avatar(a, 78) : '<div class="ea-icon">' + svg(k) + '</div>') +
      '<div class="t"><div class="ea-kick">' + esc(kick) + '</div><div class="big">' + titleHtml(a) + '</div>' + names(a) + msg(a) + '</div></div>' + (a.video ? '<video class="ea-vid" playsinline></video>' : '');
  }
  const audios = new Set();
  function sound(url, vol, delay) {
    const au = new Audio(url); au.volume = Math.max(0, Math.min(1, (vol == null ? 70 : vol) / 100)); audios.add(au);
    const go = () => au.play().catch(() => {}); if (delay) setTimeout(go, delay); else go();
    au.onended = () => audios.delete(au); return au;
  }
  function defaultSound(a) {
    if (!window.SFX) return;
    const k = a.kind;
    SFX.play('whoosh', 0);
    if (/raid|host|hypetrain|giftbomb/.test(k)) { SFX.play('horn', 0.3, 0.6); SFX.play('cheer', 0.8, 2.2); SFX.play('impact', 0.5); }
    else if (/bits|kicks|superchat|supersticker|powerup|charity/.test(k)) { SFX.play('sparkle', 0.3, 1.2); SFX.play('ding', 0.6); }
    else { SFX.play('pop', 0.3); SFX.play('sparkle', 0.5); }
  }
  // a = the ealert, finish() = end it now (the overlay's queue moves on)
  function play(stage, a, finish) {
    const el = document.createElement('div');
    el.className = 'ea th-' + (theme || 'football') + ' look-' + a.look + ' k-' + a.kind;
    if (!/^(football|elite|ets|heist)$/.test(theme)) el.style.setProperty('--ek', ACC[a.kind] || '#3dff9a');
    el.innerHTML = build(a);
    el.dataset.id = a.id || '';
    stage.appendChild(el);
    let dur = Math.max(2, Math.min(60, a.secs || 0)) * 1000;
    const silent = !!a.muted;
    if (!silent) { if (a.sound && a.sound.url) sound(a.sound.url, a.vol, 0); else if (!(a.video && a.videoSound)) defaultSound(a); }
    const v = el.querySelector('video');
    if (v && a.video) {
      v.src = a.video.url; v.muted = silent || !a.videoSound; v.volume = Math.max(0, Math.min(1, (a.vol == null ? 70 : a.vol) / 100));
      v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
      if (!a.secs) { dur = 60000; v.onended = () => setTimeout(finish, 300); v.onerror = () => setTimeout(finish, 1500); }
    }
    if (!silent && a.tts) {
      const at = 1100;
      if (a.tts.url) { const au = sound(a.tts.url, a.ttsVol, at); au.onloadedmetadata = () => { if (au.duration && isFinite(au.duration) && a.secs && (au.duration * 1000 + at + 600) > dur) EALERT.extend(a.id, au.duration * 1000 + at + 600); }; }
      else if (a.tts.speak && window.speechSynthesis && window.SpeechSynthesisUtterance) setTimeout(() => { try { const u = new SpeechSynthesisUtterance(a.tts.speak); u.volume = Math.max(0, Math.min(1, (a.ttsVol || 80) / 100)); speechSynthesis.speak(u); } catch (e) { /* no voice */ } }, at);
    }
    // fade out at the end (the overlay removes it)
    const fadeAt = Math.max(500, dur - 500);
    el._fade = setTimeout(() => el.classList.add('out'), fadeAt);
    return { el, dur };
  }
  // ad warning: a countdown at the top of the screen
  let adEl = null, adT = null;
  function adWarn(stage, a) {
    clearInterval(adT);
    if (!a.endsAt || a.endsAt <= Date.now()) { if (adEl) { adEl.remove(); adEl = null; } return; }
    if (!adEl) { adEl = document.createElement('div'); adEl.className = 'ea-ad th-' + theme; stage.appendChild(adEl); }
    const draw = () => { const left = Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000)); adEl.innerHTML = '<b>AD BREAK IN</b><span>' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + '</span><small>Subs skip the ads</small>'; if (!left) { clearInterval(adT); setTimeout(() => { if (adEl) { adEl.remove(); adEl = null; } }, 1500); } };
    draw(); adT = setInterval(draw, 500);
  }
  function stopSounds() { for (const au of audios) { try { au.pause(); } catch (e) { /* ignore */ } } audios.clear(); try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
  window.EALERT = { play, setTheme, stopSounds, adWarn, extend: () => {}, ICON, ACC };
})();
