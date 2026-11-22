// Modern sound engine — everything is generated live (no files, no copyright issues),
// mixed through a stereo reverb, compressor and limiter so it sounds like a produced stream package.
// Want your own sound for something? Put an .mp3/.wav/.ogg with the sound's name in the "sounds"
// folder (e.g. sounds/pack-burst.mp3 replaces "burst") and it's used instead.
window.SFX = (function () {
  let ctx = null, master = null, dry = null, verb = null, noiseBuf = null, vol = 0.6;
  const custom = {};   // name → AudioBuffer from the sounds folder

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
      const glue = ctx.createDynamicsCompressor();
      glue.threshold.value = -18; glue.ratio.value = 3; glue.attack.value = 0.01; glue.release.value = 0.25;
      master = ctx.createGain(); master.gain.value = vol;
      dry = ctx.createGain();
      verb = ctx.createConvolver(); verb.buffer = impulse(2.6, 2.4);
      const verbGain = ctx.createGain(); verbGain.gain.value = 0.32;
      dry.connect(glue); verb.connect(verbGain); verbGain.connect(glue);
      glue.connect(master); master.connect(limiter); limiter.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(2, ctx.sampleRate * 3, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = noiseBuf.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      loadCustom();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // stereo reverb impulse (a "room")
  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 200 ? i / 200 : 1);
    }
    return b;
  }

  async function loadCustom() {
    try {
      const list = await fetch('/api/sounds').then((r) => r.json());
      for (const f of list) {
        const name = f.replace(/\.[a-z0-9]+$/i, '');
        const buf = await fetch('/sounds/' + encodeURIComponent(f)).then((r) => r.arrayBuffer());
        custom[name] = await ctx.decodeAudioData(buf);
      }
    } catch (e) { /* no custom sounds */ }
  }

  // ---------- building blocks ----------
  // routes a node to the mix with pan and reverb amount
  function out(node, o) {
    const p = ctx.createStereoPanner(); p.pan.value = o.pan || 0;
    node.connect(p); p.connect(dry);
    if (o.verb !== 0) { const s = ctx.createGain(); s.gain.value = o.verb == null ? 0.5 : o.verb; p.connect(s); s.connect(verb); }
    if (o.panTo != null) p.pan.linearRampToValueAtTime(o.panTo, ctx.currentTime + (o.at || 0) + o.dur);
    return p;
  }
  function env(param, t, a, peak, dur, rel) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.003, a));
    param.setTargetAtTime(0.0001, t + Math.max(a, dur - (rel || dur * 0.6)), (rel || dur * 0.6) / 4);
  }
  function noise(o) {
    const t = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + (o.sweep || o.dur));
    const g = ctx.createGain(); env(g.gain, t, o.attack || 0.01, o.gain || 0.3, o.dur, o.rel);
    src.connect(f); f.connect(g); out(g, o);
    src.start(t, Math.random() * 2); src.stop(t + o.dur + 1.5);
    return g;
  }
  function osc(o) {
    const t = ctx.currentTime + (o.at || 0);
    const s = ctx.createOscillator(); s.type = o.wave || 'sine';
    s.frequency.setValueAtTime(o.f0, t);
    if (o.f1) s.frequency.exponentialRampToValueAtTime(o.f1, t + (o.sweep || o.dur));
    if (o.detune) s.detune.value = o.detune;
    let node = s;
    if (o.lp || o.hp) {
      const f = ctx.createBiquadFilter(); f.type = o.lp ? 'lowpass' : 'highpass'; f.Q.value = o.q || 0.7;
      f.frequency.setValueAtTime(o.lp || o.hp, t);
      if (o.lp1) f.frequency.exponentialRampToValueAtTime(o.lp1, t + o.dur * 0.8);
      node.connect(f); node = f;
    }
    if (o.fm) { // FM: a modulator wobbling the pitch gives bells, lasers and metal
      const m = ctx.createOscillator(), mg = ctx.createGain();
      m.frequency.value = o.f0 * o.fm[0]; mg.gain.setValueAtTime(o.f0 * o.fm[1], t);
      mg.gain.exponentialRampToValueAtTime(Math.max(1, o.f0 * o.fm[1] * 0.05), t + o.dur);
      m.connect(mg); mg.connect(s.frequency); m.start(t); m.stop(t + o.dur + 1.5);
    }
    if (o.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + o.dur + 1.5);
    }
    if (o.drive) { const w = ctx.createWaveShaper(); w.curve = curve(o.drive); node.connect(w); node = w; }
    const g = ctx.createGain(); env(g.gain, t, o.attack || 0.005, o.gain || 0.2, o.dur, o.rel);
    node.connect(g); out(g, o);
    s.start(t); s.stop(t + o.dur + 1.5);
    return g;
  }
  function curve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
  const rnd = (a, b) => a + Math.random() * (b - a);
  // a lush detuned chord ("supersaw" pad)
  function pad(at, notes, dur, gain, open) {
    for (const f of notes) for (const d of [-14, -5, 5, 14]) osc({ at, f0: f, wave: 'sawtooth', detune: d, dur, gain: gain / 4, lp: 300, lp1: open || 3200, attack: 0.25, rel: dur * 0.5, verb: 0.9, pan: d / 20 });
  }
  function bell(at, f, gain, pan) { osc({ at, f0: f, fm: [3.5, 1.4], dur: 2.2, gain, attack: 0.002, rel: 1.8, verb: 0.9, pan }); }
  function sub(at, f0, f1, dur, gain) { osc({ at, f0, f1, dur, gain, attack: 0.004, rel: dur * 0.8, verb: 0.2 }); }

  // ---------- the sound library ----------
  const S = {
    // --- general / cards ---
    whoosh: (at) => { noise({ at, dur: 0.6, f0: 300, f1: 3500, sweep: 0.45, q: 1.1, gain: 0.32, attack: 0.25, pan: -0.8, panTo: 0.8, verb: 0.4 }); noise({ at, dur: 0.5, type: 'lowpass', f0: 200, f1: 900, gain: 0.15, attack: 0.2, verb: 0.2 }); },
    swoosh: (at) => noise({ at, dur: 0.35, f0: 4000, f1: 700, q: 1.3, gain: 0.22, attack: 0.04, pan: 0.6, panTo: -0.6, verb: 0.3 }),
    impact: (at) => { sub(at, 120, 38, 0.9, 0.85); noise({ at, dur: 0.25, type: 'lowpass', f0: 1800, f1: 200, gain: 0.5, verb: 0.6 }); osc({ at, f0: 70, f1: 45, wave: 'triangle', dur: 0.4, gain: 0.4, drive: 6, verb: 0.3 }); },
    boom: (at) => { sub(at, 90, 28, 2.2, 0.95); noise({ at, dur: 1.6, type: 'lowpass', f0: 900, f1: 60, gain: 0.45, rel: 1.4, verb: 1 }); noise({ at, dur: 0.12, type: 'highpass', f0: 2500, gain: 0.25, verb: 0.8 }); },
    ding: (at) => { at = at || 0; bell(at, 1318.5, 0.11, -0.2); bell(at + 0.07, 1975.5, 0.08, 0.25); osc({ at, f0: 2637, dur: 1.4, gain: 0.03, verb: 1 }); },
    pop: (at) => { osc({ at, f0: 900, f1: 220, dur: 0.12, gain: 0.25, verb: 0.3 }); noise({ at, dur: 0.03, type: 'highpass', f0: 3000, gain: 0.15, verb: 0.2 }); },
    tick: (at) => { osc({ at, f0: 1800, f1: 900, dur: 0.05, gain: 0.08, verb: 0.2 }); noise({ at, dur: 0.02, type: 'highpass', f0: 5000, gain: 0.06, verb: 0 }); },
    riser: (at, dur) => {
      at = at || 0; dur = dur || 1.8;
      noise({ at, dur, f0: 250, f1: 6000, q: 2.5, gain: 0.22, attack: dur * 0.95, rel: 0.15, pan: -0.3, panTo: 0.3, verb: 0.6 });
      for (const d of [-12, 12]) osc({ at, f0: 110, f1: 880, wave: 'sawtooth', detune: d, dur, gain: 0.03, lp: 400, lp1: 6000, attack: dur * 0.9, rel: 0.1, verb: 0.7 });
    },
    rumble: (at, dur) => { dur = dur || 1.7; noise({ at, dur, type: 'lowpass', f0: 80, f1: 400, q: 1, gain: 0.5, attack: dur * 0.9, rel: 0.1, verb: 0.3 }); sub(at, 40, 60, dur, 0.35); S.riser(at, dur); },
    burst: (at) => { S.boom(at); noise({ at, dur: 1.2, f0: 6000, f1: 1500, q: 0.6, gain: 0.3, rel: 1, verb: 1 }); for (let i = 0; i < 6; i++) bell((at || 0) + 0.05 + i * 0.04, rnd(1800, 4200), 0.025, rnd(-1, 1)); },
    sparkle: (at) => { at = at || 0; for (let i = 0; i < 10; i++) bell(at + i * 0.05 + rnd(0, 0.03), rnd(2200, 5200), 0.03, rnd(-0.9, 0.9)); },
    fanfare: (at) => { // modern "reward" stinger: sub hit + opening pad + bells
      at = at || 0;
      sub(at, 100, 40, 1.4, 0.7);
      pad(at, [261.6, 329.6, 392, 523.3], 2.4, 0.16, 4200);
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(at + 0.08 + i * 0.09, f, 0.06, -0.6 + i * 0.4));
      noise({ at, dur: 1.6, f0: 8000, f1: 3000, q: 0.5, gain: 0.08, rel: 1.4, verb: 1 });
    },
    // --- crowd ---
    cheer: (at, dur) => {
      at = at || 0; dur = dur || 2.6;
      for (const [f, g, p] of [[650, 0.22, -0.7], [1100, 0.2, 0.7], [1800, 0.12, 0], [2900, 0.06, -0.3]]) {
        const n = noise({ at: at + rnd(0, 0.15), dur, f0: f, q: 0.9, gain: g, attack: 0.35, rel: dur * 0.55, pan: p, verb: 0.8 });
        const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = rnd(3, 7); lg.gain.value = g * 0.35; l.connect(lg); lg.connect(n.gain); l.start(ctx.currentTime + at); l.stop(ctx.currentTime + at + dur + 1);
      }
      for (let i = 0; i < 10; i++) osc({ at: at + rnd(0.1, dur * 0.6), f0: rnd(300, 700), f1: rnd(500, 1000), wave: 'sawtooth', dur: rnd(0.4, 0.9), gain: 0.006, lp: 1400, attack: 0.08, pan: rnd(-1, 1), verb: 0.9 });
    },
    ooh: (at) => {
      at = at || 0;
      noise({ at, dur: 1.4, f0: 700, f1: 380, q: 2.2, gain: 0.3, attack: 0.18, rel: 1, pan: -0.4, verb: 0.8 });
      noise({ at: at + 0.04, dur: 1.4, f0: 1200, f1: 600, q: 2.2, gain: 0.18, attack: 0.2, rel: 1, pan: 0.4, verb: 0.8 });
    },
    // --- football ---
    whistle: (at, long) => {
      const dur = long ? 1.0 : 0.45;
      osc({ at, f0: 2950, dur, gain: 0.07, attack: 0.01, rel: 0.05, vib: [34, 120], verb: 0.5 });
      noise({ at, dur, f0: 2900, q: 6, gain: 0.08, attack: 0.01, rel: 0.05, verb: 0.5 });
    },
    kick: (at) => { sub(at, 160, 55, 0.18, 0.8); noise({ at, dur: 0.06, f0: 1400, q: 1.5, gain: 0.45, verb: 0.3 }); },
    net: (at) => { noise({ at, dur: 0.7, f0: 5000, f1: 900, q: 0.7, gain: 0.25, attack: 0.02, verb: 0.6 }); noise({ at, dur: 0.3, type: 'lowpass', f0: 500, gain: 0.2, verb: 0.3 }); },
    glove: (at) => { sub(at, 200, 80, 0.15, 0.6); noise({ at, dur: 0.09, type: 'lowpass', f0: 1800, gain: 0.45, verb: 0.4 }); },
    post: (at) => { [523, 1351, 2693, 4102].forEach((f, i) => osc({ at, f0: f, dur: 1.4 - i * 0.2, gain: 0.07 / (i + 1), fm: [1.41, 0.3], verb: 0.7 })); sub(at, 140, 90, 0.2, 0.4); },
    // --- trucks ---
    horn: (at, dur) => {
      dur = dur || 0.9;
      for (const f of [196, 247, 294]) for (const d of [-8, 8]) osc({ at, f0: f * 0.97, f1: f, sweep: 0.12, wave: 'sawtooth', detune: d, dur, gain: 0.045, lp: 1500, q: 2, attack: 0.04, rel: 0.15, drive: 2, verb: 0.6, pan: d / 30 });
    },
    airbrake: (at) => { noise({ at, dur: 0.9, type: 'highpass', f0: 3500, f1: 1800, gain: 0.3, attack: 0.005, rel: 0.6, verb: 0.5 }); noise({ at, dur: 0.15, type: 'lowpass', f0: 600, gain: 0.2, verb: 0.2 }); },
    engine: (at, dur) => {
      dur = dur || 30;
      osc({ at, f0: 42, f1: 70, sweep: 3, wave: 'sawtooth', dur, gain: 0.16, lp: 260, attack: 0.8, rel: 1.2, drive: 3, vib: [9, 2], verb: 0.15 });
      osc({ at, f0: 84, f1: 140, sweep: 3, wave: 'sawtooth', dur, gain: 0.05, lp: 500, attack: 0.8, rel: 1.2, vib: [7, 4], verb: 0.15 });
      noise({ at, dur, type: 'lowpass', f0: 220, gain: 0.12, attack: 1, rel: 1.2, verb: 0.2 });
    },
    revs: (at) => { osc({ at, f0: 40, f1: 110, sweep: 0.7, wave: 'sawtooth', dur: 1.3, gain: 0.2, lp: 420, drive: 4, vib: [12, 3], verb: 0.3 }); noise({ at, dur: 1.2, type: 'lowpass', f0: 180, f1: 700, gain: 0.15, verb: 0.3 }); },
    cb: (at) => { at = at || 0; noise({ at, dur: 0.14, f0: 1900, q: 3, gain: 0.22, verb: 0.1 }); osc({ at: at + 0.13, f0: 1250, dur: 0.06, gain: 0.04, verb: 0.1 }); noise({ at: at + 0.2, dur: 0.7, f0: 1700, q: 1.2, gain: 0.04, verb: 0.1 }); },
    beep: (at) => { osc({ at, f0: 880, dur: 0.3, gain: 0.08, fm: [2, 0.3], verb: 0.5 }); sub(at, 110, 80, 0.2, 0.25); },
    go: (at) => { osc({ at, f0: 1320, dur: 0.6, gain: 0.09, fm: [2, 0.3], verb: 0.7 }); S.impact(at); },
    thud: (at) => { sub(at, 95, 40, 0.4, 0.6); noise({ at, dur: 0.3, type: 'lowpass', f0: 700, gain: 0.35, verb: 0.5 }); noise({ at: (at || 0) + 0.05, dur: 0.5, f0: 2500, f1: 800, gain: 0.08, verb: 0.6 }); },
    heartbeat: (at) => { sub(at, 62, 40, 0.16, 0.7); sub((at || 0) + 0.22, 56, 38, 0.2, 0.55); },
    thunder: (at) => { noise({ at, dur: 3.2, type: 'lowpass', f0: 400, f1: 90, gain: 0.5, attack: 0.02, verb: 0.9 }); sub(at, 50, 30, 2.2, 0.5); },
    skid: (at) => { noise({ at, dur: 1.1, type: 'bandpass', f0: 2600, f1: 1800, q: 4, gain: 0.18, verb: 0.3 }); },
    crash: (at) => { S.boom(at); noise({ at, dur: 1.4, f0: 5000, f1: 1500, gain: 0.25, verb: 0.6 }); for (let i = 0; i < 6; i++) noise({ at: (at || 0) + 0.1 + i * 0.12, dur: 0.12, type: 'bandpass', f0: 3000 + i * 400, q: 3, gain: 0.12 }); },
    moo: (at) => { osc({ at, f0: 180, f1: 140, dur: 1.1, gain: 0.07, fm: [3, 12], verb: 0.6 }); },
    roar: (at) => { noise({ at, dur: 2.2, type: 'bandpass', f0: 220, f1: 120, q: 1.2, gain: 0.45, attack: 0.15, verb: 0.8 }); sub(at, 70, 40, 2, 0.6); },
    // --- ARC Raiders battle ---
    shot: (at, pan) => { noise({ at, dur: 0.18, f0: 1800, f1: 500, q: 0.7, gain: 0.35, pan: pan || 0, verb: 0.5 }); sub(at, 140, 60, 0.12, 0.45); },
    burstfire: (at, pan) => { for (let i = 0; i < 4; i++) S.shot((at || 0) + i * 0.09, pan); },
    laser: (at, pan) => { osc({ at, f0: 2400, f1: 300, dur: 0.35, gain: 0.08, fm: [0.5, 2], pan: pan || 0, verb: 0.7 }); noise({ at, dur: 0.2, type: 'highpass', f0: 4000, gain: 0.06, pan: pan || 0, verb: 0.6 }); },
    explosion: (at, pan) => { S.boom(at); noise({ at: (at || 0) + 0.05, dur: 1.8, f0: 1200, f1: 200, q: 0.5, gain: 0.25, rel: 1.5, pan: pan || 0, verb: 0.9 }); for (let i = 0; i < 8; i++) noise({ at: (at || 0) + rnd(0.2, 1.2), dur: 0.05, f0: rnd(2000, 5000), q: 3, gain: 0.08, pan: rnd(-1, 1), verb: 0.6 }); },
    drone: (at, dur) => { dur = dur || 3; for (const d of [-20, 20]) osc({ at, f0: 180, wave: 'sawtooth', detune: d, dur, gain: 0.03, lp: 900, attack: 0.5, rel: 0.8, vib: [26, 8], verb: 0.5, pan: d / 25 }); },
    alarm: (at, n) => { at = at || 0; for (let i = 0; i < (n || 3); i++) { osc({ at: at + i * 0.8, f0: 660, dur: 0.38, gain: 0.07, fm: [1.01, 0.1], verb: 0.8 }); osc({ at: at + i * 0.8 + 0.4, f0: 880, dur: 0.38, gain: 0.07, fm: [1.01, 0.1], verb: 0.8 }); } },
    elevator: (at) => { sub(at, 55, 70, 2.5, 0.35); noise({ at, dur: 2.5, type: 'lowpass', f0: 300, gain: 0.15, attack: 0.5, verb: 0.6 }); S.thud((at || 0) + 2.4); },
    shield: (at) => { osc({ at, f0: 300, f1: 1200, dur: 0.5, gain: 0.07, fm: [1.5, 1], verb: 0.8 }); S.sparkle((at || 0) + 0.1); },
    drop: (at) => { noise({ at, dur: 2.2, type: 'lowpass', f0: 300, f1: 1800, q: 0.7, gain: 0.35, attack: 1.2, rel: 0.6, pan: -0.5, panTo: 0.5, verb: 0.5 }); S.impact((at || 0) + 2.1); },
    loot: (at) => { bell(at || 0, 1760, 0.06, 0.3); bell((at || 0) + 0.08, 2637, 0.05, -0.3); },
    down: (at) => { osc({ at, f0: 400, f1: 120, dur: 0.6, gain: 0.08, fm: [0.5, 1.5], verb: 0.8 }); S.thud(at); }
  };

  // custom-file names that replace built-in sounds
  const ALIAS = { burst: 'pack-burst', impact: 'impact', fanfare: 'reward', ding: 'ding', whoosh: 'whoosh', cheer: 'crowd-cheer', ooh: 'crowd-ooh', horn: 'air-horn', explosion: 'explosion' };

  function play(name) {
    try {
      if (vol <= 0) return;
      ac();
      const args = Array.prototype.slice.call(arguments, 1);
      const file = custom[name] || custom[ALIAS[name]];
      if (file) {
        const src = ctx.createBufferSource(); src.buffer = file;
        const g = ctx.createGain(); g.gain.value = 0.9; src.connect(g); g.connect(dry);
        src.start(ctx.currentTime + (args[0] || 0));
        return;
      }
      if (S[name]) S[name].apply(null, args);
    } catch (e) { /* audio unavailable */ }
  }

  // signature sound for each card tier
  function tierFx(tier, at) {
    at = at || 0;
    if (tier === 'legend') { // electric surge
      for (let i = 0; i < 5; i++) { noise({ at: at + i * 0.13 + rnd(0, 0.05), dur: 0.09, type: 'highpass', f0: rnd(2500, 6000), gain: 0.2, pan: rnd(-0.8, 0.8), verb: 0.7 }); osc({ at: at + i * 0.13, f0: rnd(600, 1400), f1: rnd(80, 200), dur: 0.12, gain: 0.05, fm: [0.25, 3], verb: 0.7 }); }
      sub(at, 60, 30, 1.2, 0.5); S.riser(at - 0.6, 0.6);
    } else if (tier === 'gold') { // fire whoomp + crackle
      noise({ at, dur: 0.9, type: 'lowpass', f0: 200, f1: 1600, q: 1.2, gain: 0.4, attack: 0.15, verb: 0.5 });
      for (let i = 0; i < 24; i++) noise({ at: at + rnd(0.1, 1.6), dur: 0.025, f0: rnd(1500, 4500), q: 4, gain: rnd(0.08, 0.2), pan: rnd(-0.7, 0.7), verb: 0.3 });
    } else if (tier === 'silver') { S.sparkle(at); noise({ at, dur: 1.2, f0: 7000, f1: 3500, q: 0.5, gain: 0.05, verb: 1 }); }
    else S.swoosh(at);
  }

  return {
    play, tierFx,
    setVolume: (v) => { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = vol; },
    unlock: () => ac()
  };
})();
