// Replay load test (plays your latest Twitch clip): runs one full replay and watches OBS's own numbers the whole time,
// so you can see if (and at which step) OBS struggles, BEFORE you go live.
// It also reads the OBS settings that most often cause replay stutter and says what to change.
const PHASES = {
  before: 'Normal (before the replay)', save: 'Saving', load: 'Opening the clip', move: 'Moving game + camera',
  play: 'Clip playing', slow: 'Slow-mo', back: 'Wiping back to live', live: 'Back to live', after: 'Normal (after)'
};

class ReplayTest {
  constructor(o) { Object.assign(this, o); this.running = false; this.last = null; this.progress = null; }   // obs, replay, isLive()

  async param(cat, name) { try { const r = await this.obs.req('GetProfileParameter', { parameterCategory: cat, parameterName: name }); return r.parameterValue != null ? r.parameterValue : r.defaultParameterValue; } catch (e) { return null; } }

  // the OBS settings behind most replay stutter
  async setup() {
    const O = this.obs, out = { checks: [] };
    const add = (level, what, fix) => out.checks.push({ level, what, fix: fix || '' });
    try { const v = await O.req('GetVersion'); out.obs = v.obsVersion; } catch (e) { /* ignore */ }
    try {
      const v = await O.req('GetVideoSettings');
      out.fps = v.fpsNumerator && v.fpsDenominator ? Math.round(v.fpsNumerator / v.fpsDenominator * 100) / 100 : 60;
      out.base = v.baseWidth + 'x' + v.baseHeight; out.output = v.outputWidth + 'x' + v.outputHeight;
      if (v.baseWidth > 1920) add('warn', 'OBS is drawing everything at ' + out.base + ' (Base/canvas resolution). That is ' + Math.round(v.baseWidth * v.baseHeight / (1920 * 1080) * 10) / 10 + 'x the work of 1080p for every scene, effect and clip.', 'OBS › Settings › Video: set Base (Canvas) Resolution to 1920x1080. The Elgato can still capture in 4K; OBS just draws the scene at 1080p.');
    } catch (e) { /* ignore */ }
    const mode = await this.param('Output', 'Mode'); out.mode = mode || 'Simple';
    let streamEnc, recEnc, separate = false;
    if (out.mode === 'Advanced') {
      streamEnc = await this.param('AdvOut', 'Encoder'); recEnc = await this.param('AdvOut', 'RecEncoder');
      separate = !!recEnc && recEnc !== 'none';
      
    } else {
      streamEnc = await this.param('SimpleOutput', 'StreamEncoder'); recEnc = await this.param('SimpleOutput', 'RecEncoder');
      const q = await this.param('SimpleOutput', 'RecQuality'); out.recQuality = q;
      separate = !!q && q !== 'Stream';
      
    }
    out.streamEnc = streamEnc; out.recEnc = recEnc;
    const isX264 = (e) => /x264/i.test(e || '');
    if (isX264(streamEnc) || (separate && isX264(recEnc))) add('bad', 'Video is encoded by the CPU (x264). With a game, a capture card and a replay clip all running, the CPU runs out and frames drop.', 'OBS › Settings › Output: choose a hardware encoder (NVIDIA NVENC, AMD or Intel QuickSync).');
    try { const st = await O.req('GetStats'); out.cpu = Math.round(st.cpuUsage || 0); out.mem = Math.round(st.memoryUsage || 0); out.disk = Math.round((st.availableDiskSpace || 0) / 1024); if (out.disk && out.disk < 20) add('warn', 'Only ' + out.disk + ' GB free on the recording drive. A nearly full or slow disk makes saving the replay stall.', 'Free up space, or point OBS › Settings › Output › Recording Path to a faster drive (an SSD).'); } catch (e) { /* ignore */ }
    if (this.replay.S().decode !== 'cpu') out.decode = 'gpu'; else out.decode = 'cpu';
    return out;
  }

  async sample(phase) {
    const st = await this.obs.req('GetStats');
    return { at: Date.now(), phase, r: st.renderSkippedFrames || 0, rt: st.renderTotalFrames || 0, o: st.outputSkippedFrames || 0, ot: st.outputTotalFrames || 0, ms: st.averageFrameRenderTime || 0, fps: st.activeFps || 0, cpu: st.cpuUsage || 0 };
  }

  async run(o) {
    o = o || {};
    if (this.running) return { error: 'A test is already running' };
    if (!this.obs.ready) return { error: 'OBS is not connected' };
    if (this.replay.playing || this.replay.busy) return { error: 'A replay is playing: wait for it to finish' };
    if (this.replay.blocked && this.replay.blocked()) return { error: this.replay.blocked() };
    this.running = true; this.progress = { step: 'Reading your OBS settings', at: Date.now() };
    const samples = []; let phase = 'before', timer = null, clipId = null;
    const tick = async () => { try { samples.push(await this.sample(phase)); } catch (e) { /* OBS busy */ } };
    try {
      const setup = await this.setup();
      this.progress = { step: 'Measuring normal load (8 s)', at: Date.now() };
      await tick(); timer = setInterval(tick, 500);
      await new Promise((r) => setTimeout(r, 8000));
      this.replay.onPhase = (p) => { phase = p; this.progress = { step: PHASES[p] || p, at: Date.now() }; tick(); };
      // plays a clip you already have (the newest one), exactly like a live replay
      const L = this.replay.D().list.filter((c) => { try { return require('fs').existsSync(c.path); } catch (e) { return false; } });
      const c = o.id ? L.find((x) => x.id === o.id) : L[L.length - 1];
      if (!c) throw new Error('No clip to test with yet: make one clip first (tap Replay while you are live, or the bandwidth test stream), then run the test');
      const r = await this.replay.play(c.id, { label: 'LOAD TEST', look: o.look, temp: true });
      if (r.error) throw new Error(r.error);
      for (let i = 0; i < 240 && (this.replay.playing || this.replay.busy); i++) await new Promise((res) => setTimeout(res, 500));
      phase = 'after'; this.progress = { step: 'Measuring after (6 s)', at: Date.now() };
      await new Promise((res) => setTimeout(res, 6000));
      clearInterval(timer); timer = null; await tick();
      this.last = Object.assign({ at: Date.now(), live: !!(this.isLive && this.isLive()), look: o.look || this.replay.S().look }, this.report(samples, setup));
      return this.last;
    } catch (e) {
      return { error: e.message };
    } finally {
      if (timer) clearInterval(timer);
      this.replay.onPhase = null; this.running = false; this.progress = null;
      if (clipId && o.keep !== true) { try { this.replay.remove(clipId, false); } catch (e) { /* ignore */ } }
    }
  }

  report(samples, setup) {
    const fps = setup.fps || 60, budget = 1000 / fps;
    const by = {};
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i], ph = b.phase;
      const P = by[ph] || (by[ph] = { phase: ph, name: PHASES[ph] || ph, secs: 0, frames: 0, missed: 0, outFrames: 0, skipped: 0, ms: [], cpu: [], fps: [] });
      P.secs += (b.at - a.at) / 1000; P.frames += Math.max(0, b.rt - a.rt); P.missed += Math.max(0, b.r - a.r);
      P.outFrames += Math.max(0, b.ot - a.ot); P.skipped += Math.max(0, b.o - a.o);
      P.ms.push(b.ms); P.cpu.push(b.cpu); P.fps.push(b.fps);
    }
    const order = ['before', 'save', 'load', 'move', 'play', 'slow', 'back', 'live', 'after'];
    const phases = order.filter((k) => by[k]).map((k) => {
      const P = by[k], avg = (x) => x.length ? x.reduce((s, v) => s + v, 0) / x.length : 0;
      const missPct = P.frames ? P.missed / P.frames * 100 : 0, skipPct = P.outFrames ? P.skipped / P.outFrames * 100 : 0;
      const ms = Math.max(...P.ms, 0);
      const level = missPct > 1 || skipPct > 1 || P.missed + P.skipped >= 6 ? 'bad' : P.missed + P.skipped > 0 || (ms > budget * 0.8 && P.secs >= 1) ? 'warn' : 'ok';
      return { phase: k, name: P.name, secs: Math.round(P.secs * 10) / 10, missed: P.missed, skipped: P.skipped, missPct: Math.round(missPct * 10) / 10, skipPct: Math.round(skipPct * 10) / 10, renderMs: Math.round(ms * 10) / 10, cpu: Math.round(avg(P.cpu)), fps: Math.round(Math.min(...P.fps.filter((f) => f > 0), fps)), level };
    });
    const tot = phases.filter((p) => !['before', 'after'].includes(p.phase)).reduce((t, p) => ({ m: t.m + p.missed, s: t.s + p.skipped }), { m: 0, s: 0 });
    const base = phases.find((p) => p.phase === 'before') || { missed: 0, skipped: 0, renderMs: 0 };
    const worst = phases.filter((p) => p.level !== 'ok' && !['before', 'after'].includes(p.phase)).sort((a, b) => (b.missed + b.skipped) - (a.missed + a.skipped))[0] || null;
    const advice = [];
    const has = (k, f) => phases.some((p) => p.phase === k && f(p));
    if (base.missed + base.skipped > 0) advice.push({ level: 'bad', what: 'OBS was already dropping frames BEFORE the replay started (' + base.missed + ' render, ' + base.skipped + ' encoding). The replay is not the only cause: OBS is at its limit with your normal scene.', fix: 'Fix this first: the setup checks below, then lower the game\'s frame rate (cap it at 60) so the graphics card has room for OBS.' });
    if (tot.m > 0) advice.push({ level: 'bad', what: tot.m + ' frames missed due to RENDERING lag during the replay: the graphics card couldn\'t draw the scene in time' + (worst ? ' (worst: ' + worst.name + ')' : '') + '.', fix: '1) Run OBS as administrator (Windows gives it graphics card priority over the game). 2) Cap the game at 60 fps / turn on V-Sync. 3) In the app: Replay settings › Clip decoding › try "CPU" (frees the graphics card) and test again.' });
    if (tot.s > 0) advice.push({ level: 'bad', what: tot.s + ' frames skipped due to ENCODING lag during the replay: the encoder couldn\'t keep up' + (worst ? ' (worst: ' + worst.name + ')' : '') + '.', fix: 'Use a hardware encoder (NVENC) and a lower encoder preset (e.g. P5 → P4).' });
    if (has('load', (p) => p.level !== 'ok') || has('slow', (p) => p.level !== 'ok')) advice.push({ level: 'warn', what: 'The hiccup happens when OBS OPENS the clip' + (has('slow', (p) => p.level !== 'ok') ? ' (and when slow-mo starts)' : '') + '.', fix: 'Replay settings › Clip decoding: switch between GPU and CPU and test again. Turning off the slow-motion finish removes the second clip.' });
    if (has('play', (p) => p.renderMs > budget * 0.8)) advice.push({ level: 'warn', what: 'Drawing a frame took up to ' + phases.find((p) => p.phase === 'play').renderMs + ' ms during the clip (budget at ' + fps + ' fps: ' + Math.round(budget * 10) / 10 + ' ms).', fix: 'Turn on Light graphics (Setup) and use the Quick look rather than Studio; both draw less on top of the clip.' });
    if (!tot.m && !tot.s && base.missed + base.skipped === 0) advice.push({ level: 'ok', what: 'No frames dropped at any step. Replays are safe on this setup' + (this.isLive && this.isLive() ? '.' : ' (test once more while streaming, see below: the stream encoder adds load).'), fix: '' });
    const verdict = tot.m + tot.s === 0 && base.missed + base.skipped === 0 ? 'ok' : tot.m + tot.s >= 6 || base.missed + base.skipped > 0 ? 'bad' : 'warn';
    return { verdict, fps, budget: Math.round(budget * 10) / 10, phases, advice, setup };
  }
  state() { return { running: this.running, progress: this.progress, last: this.last }; }
}
module.exports = { ReplayTest };
