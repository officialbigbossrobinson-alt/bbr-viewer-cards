// Versions on your GitHub release page: used by "Go back a version" (downloads the installer of the version
// before this one, checks it against the release's own checksum, then runs it).
const fs = require('fs');
const crypto = require('crypto');

const OWNER = 'officialbigbossrobinson-alt', REPO = 'bbr-viewer-cards';

// '36' / 'v36' / '36.1' / '36.0.0' -> [36, 0, 0]
function parts(v) { const m = String(v || '').replace(/^v/i, '').split(/[.-]/).map((x) => parseInt(x, 10)); return [m[0] || 0, m[1] || 0, m[2] || 0]; }
function cmp(a, b) { const A = parts(a), B = parts(b); for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] < B[i] ? -1 : 1; return 0; }
// semver for the installer (36 -> 36.0.0) and the short name people see (36.0.0 -> 36, 36.1.0 -> 36.1)
const toSemver = (v) => parts(v).join('.');
const short = (v) => { const p = parts(v); return p[2] ? p.join('.') : p[1] ? p[0] + '.' + p[1] : String(p[0]); };

function installerAsset(rel) { return (rel.assets || []).find((a) => /setup.*\.exe$/i.test(a.name)) || null; }

async function listReleases(fetchFn) {
  const r = await fetchFn('https://api.github.com/repos/' + OWNER + '/' + REPO + '/releases?per_page=50', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'BBR-Viewer-Cards' } });
  if (r.status === 404) throw new Error('The release page isn\'t there yet (github.com/' + OWNER + '/' + REPO + ').');
  if (!r.ok) throw new Error('GitHub said ' + r.status + '. Try again in a minute.');
  return r.json();
}

// the newest version older than the one running (test versions only if you get test versions)
function findPrevious(current, releases, allowPre) {
  return (releases || [])
    .filter((r) => !r.draft && (allowPre || !r.prerelease) && installerAsset(r) && cmp(r.tag_name, current) < 0)
    .sort((a, b) => cmp(b.tag_name, a.tag_name))[0] || null;
}

// latest.yml -> the sha512 of the installer called `name`
function shaFromYml(yml, name) {
  const lines = String(yml).split(/\r?\n/);
  let cur = null, top = null;
  for (const l of lines) {
    let m = /^\s*-?\s*url:\s*(.+?)\s*$/.exec(l); if (m) { cur = m[1].replace(/^['"]|['"]$/g, ''); continue; }
    m = /^\s*path:\s*(.+?)\s*$/.exec(l); if (m) { cur = m[1].replace(/^['"]|['"]$/g, ''); continue; }
    m = /^\s*sha512:\s*(.+?)\s*$/.exec(l);
    if (m) { const v = m[1].replace(/^['"]|['"]$/g, ''); if (!top) top = v; if (cur && (cur === name || cur.replace(/ /g, '.') === name || cur.replace(/ /g, '-') === name)) return v; }
  }
  return top;
}

async function download(fetchFn, url, dest, opts) {
  const o = opts || {};
  const r = await fetchFn(url, { headers: { 'User-Agent': 'BBR-Viewer-Cards', Accept: 'application/octet-stream' }, redirect: 'follow' });
  if (!r.ok || !r.body) throw new Error('Download failed (' + r.status + ')');
  const total = Number(r.headers.get('content-length')) || o.size || 0;
  const hash = crypto.createHash('sha512');
  const tmp = dest + '.part';
  const out = fs.createWriteStream(tmp);
  let got = 0;
  try {
    const rd = r.body.getReader();
    for (;;) {
      const { value, done } = await rd.read();
      if (done) break;
      const buf = Buffer.from(value);
      hash.update(buf); got += buf.length;
      if (!out.write(buf)) await new Promise((res) => out.once('drain', res));
      if (o.onProgress && total) o.onProgress(Math.min(100, Math.round(got * 100 / total)));
    }
  } finally { await new Promise((res) => out.end(res)); }
  const sha = hash.digest('base64');
  if (o.sha512 && sha !== o.sha512) { fs.rmSync(tmp, { force: true }); throw new Error('The download doesn\'t match the release\'s checksum, so it wasn\'t used. Try again.'); }
  fs.renameSync(tmp, dest);
  return { bytes: got, sha512: sha };
}

function sha512File(file) {
  return new Promise((resolve, reject) => { const h = crypto.createHash('sha512'); fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('base64'))).on('error', reject); });
}

module.exports = { OWNER, REPO, parts, cmp, toSemver, short, installerAsset, listReleases, findPrevious, shaFromYml, download, sha512File };
