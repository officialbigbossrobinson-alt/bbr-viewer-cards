// v44 read-outs for alerts. Windows: the voices built into Windows (System.Speech), saved as a .wav the overlay plays.
// Elsewhere: espeak if it's installed. No voice = null (the overlay then tries the browser's own voice).
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');

function silentWav(secs) {
  const rate = 8000, n = Math.round(rate * (secs || 0.3)), b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40); b.fill(128, 44);
  return b;
}
class TTS {
  constructor(dir) { this.dir = dir; fs.mkdirSync(dir, { recursive: true }); this.voicesCache = null; this.clean(); }
  clean() { try { const now = Date.now(); for (const f of fs.readdirSync(this.dir)) { const p = path.join(this.dir, f); if (now - fs.statSync(p).mtimeMs > 3600000) fs.unlinkSync(p); } } catch (e) { /* ignore */ } }
  which() {
    if (process.env.BBR_TTS_FAKE === '1') return 'fake';
    if (process.platform === 'win32') return 'windows';
    for (const b of ['espeak-ng', 'espeak']) { try { cp.execFileSync('which', [b], { stdio: 'ignore' }); return b; } catch (e) { /* not there */ } }
    return null;
  }
  run(file, args, env, ms) {
    return new Promise((resolve) => {
      const c = cp.execFile(file, args, { env: Object.assign({}, process.env, env || {}), timeout: ms || 8000, windowsHide: true }, (err, out) => resolve(err ? null : String(out || '')));
      c.on('error', () => resolve(null));
    });
  }
  async voices() {
    if (this.voicesCache) return this.voicesCache;
    const w = this.which(); let L = [];
    if (w === 'fake') L = ['Test Voice'];
    if (w === 'windows') { const out = await this.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }']); L = String(out || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean); }
    this.voicesCache = { engine: w, voices: L };
    return this.voicesCache;
  }
  // → { url } or null
  async say(text, voice) {
    text = String(text || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 300).trim(); if (!text) return null;
    const w = this.which(); if (!w) return null;
    const id = crypto.randomBytes(6).toString('hex'), f = path.join(this.dir, id + '.wav');
    if (w === 'fake') { fs.writeFileSync(f, silentWav(0.4)); return { url: '/tts/' + id + '.wav', text }; }
    if (w === 'windows') {
      // the words go in through an environment variable, never into the command itself
      const ps = 'Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; if ($env:BBR_TTS_VOICE) { try { $s.SelectVoice($env:BBR_TTS_VOICE) } catch {} }; $s.SetOutputToWaveFile($env:BBR_TTS_FILE); $s.Speak($env:BBR_TTS_TEXT); $s.Dispose()';
      await this.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { BBR_TTS_TEXT: text, BBR_TTS_FILE: f, BBR_TTS_VOICE: voice || '' }, 10000);
    } else {
      await this.run(w, ['-w', f, '--', text]);
    }
    return fs.existsSync(f) && fs.statSync(f).size > 100 ? { url: '/tts/' + id + '.wav', text } : null;
  }
  serve(req, res, file) {
    if (!/^[a-f0-9]{12}\.wav$/.test(file)) { res.writeHead(404); return res.end(); }
    const p = path.join(this.dir, file); if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' }); fs.createReadStream(p).pipe(res);
  }
}
module.exports = { TTS, silentWav };
