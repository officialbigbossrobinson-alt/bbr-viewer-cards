// v30: background music for the Starting Soon, BRB and Big Cam browser sources.
// MUSIC.set({ on, tracks: [{ url, name }], vol 0-100, shuffle }) plays the list on a loop with soft fades.
// In OBS, the browser source's sound shows in the Audio Mixer: tick "Control audio via OBS" on the source to mix it.
window.MUSIC = (function () {
  'use strict';
  let muted = false, cfg = { on: false, tracks: [], vol: 40, shuffle: false }, key = '', order = [], at = -1, el = null, gain = 1, onTrack = null, stopped = false;
  const target = () => (muted ? 0 : Math.max(0, Math.min(1, cfg.vol / 100)) * gain);
  function fade(to, ms, done) {
    const a = el; if (!a) { if (done) done(); return; }
    clearInterval(a._ft);
    const from = a.volume, t0 = performance.now();
    a._ft = setInterval(() => { const u = Math.min(1, (performance.now() - t0) / (ms || 1)); try { a.volume = Math.max(0, Math.min(1, from + (to - from) * u)); } catch (e) { /* ignore */ } if (u >= 1) { clearInterval(a._ft); if (done) done(); } }, 50);
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function next() {
    if (!cfg.on || !cfg.tracks.length || stopped) return;
    if (!order.length || at >= order.length - 1) { order = cfg.tracks.map((_, i) => i); if (cfg.shuffle) shuffle(order); at = -1; }
    at++;
    const tr = cfg.tracks[order[at]];
    if (el) { el.onended = null; el.onerror = null; el.pause(); }
    el = new Audio(tr.url); el.volume = 0; el.preload = 'auto';
    el.onended = () => next();
    el.onerror = () => setTimeout(next, 1500);
    const p = el.play(); if (p && p.catch) p.catch(() => { setTimeout(next, 4000); });
    fade(target(), 1500);
    if (onTrack) try { onTrack(tr); } catch (e) { /* ignore */ }
  }
  // v33: play one song right now (the list carries on after it)
  function playNow(tr) {
    if (!tr || !tr.url || stopped) return false;
    const go = () => {
      el = new Audio(tr.url); el.volume = 0; el.preload = 'auto';
      el.onended = () => { if (cfg.on && cfg.tracks.length) next(); else el = null; };
      el.onerror = () => { if (cfg.on && cfg.tracks.length) setTimeout(next, 1500); };
      const p = el.play(); if (p && p.catch) p.catch(() => {});
      el._now = tr.name; fade(target(), 1200);
      if (onTrack) try { onTrack(tr); } catch (e) { /* ignore */ }
    };
    if (el) { const old = el; old.onended = null; fade(0, 500, () => { old.pause(); go(); }); } else go();
    return true;
  }
  // which screen this is (the app can send a song to one screen only)
  const page = /\/starting/.test(location.pathname) ? 'starting' : /\/brb/.test(location.pathname) ? 'brb' : /\/bigcam/.test(location.pathname) ? 'bigcam' : 'other';
  function set(c) {
    c = c || {}; const k = JSON.stringify([c.on, (c.tracks || []).map((t) => t.url), c.shuffle]);
    cfg = { on: !!c.on, tracks: c.tracks || [], vol: c.vol != null ? +c.vol : 40, shuffle: !!c.shuffle };
    if (k !== key) { key = k; order = []; at = -1; if (el) { const old = el; fade(0, cfg.on ? 800 : 2500, () => { old.pause(); }); el = null; } if (cfg.on && !stopped) setTimeout(next, 900); }
    else if (el) fade(target(), 600);
  }
  return {
    set,
    // kick-off / back from BRB: fade out and stop
    stop: (ms) => { stopped = true; if (el) { const old = el; fade(0, ms || 2500, () => old.pause()); } },
    start: () => { if (!stopped) return; stopped = false; order = []; at = -1; next(); },
    mute: (on) => { muted = !!on; if (el) fade(target(), 500); },
    // events from the app: { type: 'music', act: 'skip' | 'mute' | 'unmute' }
    event: (a) => {
      if (a.where && a.where !== 'all' && a.where !== page) return;
      if (a.act === 'skip') MUSIC.skip(); else if (a.act === 'mute') MUSIC.mute(true); else if (a.act === 'unmute') MUSIC.mute(false);
      else if (a.act === 'play') playNow({ url: a.url, name: a.name });
      else if (a.act === 'stopsong') { if (el) { const old = el; fade(0, 800, () => old.pause()); el = null; } }
    },
    playNow, page,
    duck: (on) => { gain = on ? 0.3 : 1; if (el) fade(target(), 400); },
    skip: () => { if (el) { const old = el; fade(0, 600, () => { old.pause(); next(); }); } else next(); },
    onTrack: (fn) => { onTrack = fn; },
    state: () => ({ on: cfg.on, playing: !!(el && !el.paused), track: el && el._now ? el._now : el && at >= 0 && cfg.tracks[order[at]] ? cfg.tracks[order[at]].name : null, stopped }),
  };
})();
