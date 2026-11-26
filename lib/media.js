// v30 media library: your photos and music, shared by the BRB screen, Starting Soon, Big Cam and the stingers.
// Files live in data/media. Uploads stream straight to disk (big music files are fine), and files are served
// with Range support so the browser sources can seek in a song.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PHOTO = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const MUSIC = { mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac' };
const VIDEO = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4' };   // v44: alert videos
const MAX = { photo: 25 * 1024 * 1024, music: 80 * 1024 * 1024, video: 300 * 1024 * 1024 };

class Media {
  // o: dir, store (index lives in store.data.media), extraPhotos() -> [{ id, name, url }] (e.g. Starting Soon pictures)
  constructor(o) { Object.assign(this, o); fs.mkdirSync(this.dir, { recursive: true }); }
  idx() { const d = this.store.data; if (!d.media) d.media = { list: [] }; return d.media; }
  list(kind) {
    const own = this.idx().list.filter((m) => !kind || m.kind === kind).filter((m) => fs.existsSync(path.join(this.dir, m.file)))
      .map((m) => ({ id: m.id, kind: m.kind, name: m.name, size: m.size, at: m.at, url: '/media/' + m.file }));
    if (kind === 'photo' && this.extraPhotos) { try { return own.concat(this.extraPhotos()); } catch (e) { return own; } }
    return own;
  }
  get(id) { const m = this.idx().list.find((x) => x.id === id); if (m) return Object.assign({ url: '/media/' + m.file }, m); if (this.extraPhotos) { try { return this.extraPhotos().find((x) => x.id === id) || null; } catch (e) { return null; } } return null; }
  url(id) { const m = this.get(id); return m ? m.url : null; }
  // upload: the raw request body is the file. name = the original file name (its extension decides the kind)
  upload(req, name) {
    return new Promise((resolve) => {
      const ext = String(path.extname(String(name || '')).slice(1) || '').toLowerCase();
      const kind = PHOTO[ext] ? 'photo' : MUSIC[ext] ? 'music' : VIDEO[ext] ? 'video' : null;
      if (!kind) { req.resume(); return resolve({ error: 'Use a picture (PNG, JPG, WEBP, GIF), a sound or music (MP3, OGG, M4A, WAV) or a video (MP4, WEBM, MOV)' }); }
      const id = crypto.randomBytes(6).toString('hex'), file = id + '.' + ext, tmp = path.join(this.dir, file + '.part');
      let size = 0, bad = false;
      const out = fs.createWriteStream(tmp);
      req.on('data', (c) => { size += c.length; if (size > MAX[kind] && !bad) { bad = true; req.unpipe(out); out.destroy(); try { fs.unlinkSync(tmp); } catch (e) { /* gone */ } resolve({ error: 'Too big (max ' + Math.round(MAX[kind] / 1048576) + ' MB)' }); } });
      req.pipe(out);
      out.on('finish', () => {
        if (bad) return;
        if (size < 10) { try { fs.unlinkSync(tmp); } catch (e) { /* gone */ } return resolve({ error: 'The file was empty' }); }
        fs.renameSync(tmp, path.join(this.dir, file));
        const m = { id, kind, file, name: String(name).replace(/\.[^.]+$/, '').slice(0, 60) || kind, size, at: Date.now() };
        this.idx().list.push(m); this.store.save();
        resolve({ ok: true, item: { id, kind, name: m.name, size, url: '/media/' + file } });
      });
      out.on('error', (e) => { if (!bad) resolve({ error: e.message }); });
    });
  }
  rename(id, name) { const m = this.idx().list.find((x) => x.id === id); if (!m) return { error: 'not found' }; m.name = String(name || '').slice(0, 60) || m.name; this.store.save(); return { ok: true }; }
  remove(id) {
    const L = this.idx().list, i = L.findIndex((x) => x.id === id); if (i < 0) return { error: 'not found' };
    try { fs.unlinkSync(path.join(this.dir, L[i].file)); } catch (e) { /* already gone */ }
    L.splice(i, 1); this.store.save(); return { ok: true };
  }
  // GET /media/<file>, with Range (so audio can seek)
  serve(req, res, file) {
    if (!/^[a-f0-9]{12}\.[a-z0-9]{2,5}$/.test(file)) { res.writeHead(404); return res.end(); }
    const f = path.join(this.dir, file); let st; try { st = fs.statSync(f); } catch (e) { res.writeHead(404); return res.end(); }
    const ext = file.split('.').pop(), type = PHOTO[ext] || MUSIC[ext] || VIDEO[ext] || 'application/octet-stream';
    const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (r) {
      let a = r[1] === '' ? st.size - (+r[2] || 0) : +r[1], b = r[1] !== '' && r[2] !== '' ? +r[2] : st.size - 1;
      a = Math.max(0, a); b = Math.min(st.size - 1, b);
      if (a > b) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': 'bytes ' + a + '-' + b + '/' + st.size, 'Content-Length': b - a + 1, 'Cache-Control': 'max-age=86400' });
      return fs.createReadStream(f, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size, 'Cache-Control': 'max-age=86400' });
    fs.createReadStream(f).pipe(res);
  }
}
// music settings for a screen: { tracks: [ids], vol 0-100, shuffle, on }
function musicCfg(c, media) {
  c = c || {};
  const tracks = (Array.isArray(c.tracks) ? c.tracks : []).map((id) => media.get(id)).filter((m) => m && m.kind === 'music').map((m) => ({ id: m.id, name: m.name, url: m.url }));
  return { on: c.on !== false && tracks.length > 0, tracks, vol: Math.max(0, Math.min(100, c.vol != null ? +c.vol : 40)), shuffle: !!c.shuffle, ids: tracks.map((t) => t.id) };
}
function musicSet(n) {
  n = n || {};
  return { on: n.on !== false, tracks: (Array.isArray(n.tracks) ? n.tracks : []).map(String).filter((x) => /^[a-f0-9]{12}$/.test(x)).slice(0, 50), vol: Math.max(0, Math.min(100, n.vol != null && n.vol !== '' ? +n.vol || 0 : 40)), shuffle: !!n.shuffle };
}
module.exports = { Media, musicCfg, musicSet, PHOTO, MUSIC, VIDEO };
