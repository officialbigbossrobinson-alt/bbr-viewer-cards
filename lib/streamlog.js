// Per-stream stats: follows, subs, gifted, bits, Kicks, Super Chats, raids, check-ins, watch time,
// messages and battles, for every viewer, kept for the last 60 streams (Viewers > Stream stats).
const KEEP = 60;

class StreamLog {
  constructor(o) { this.store = o.store; this.streamNo = o.streamNo; this.isLive = o.isLive; this.game = o.game; }
  all() { const d = this.store.data; if (!d.streams) d.streams = {}; return d.streams; }
  cur() {
    const no = this.streamNo(); if (!no) return null;
    const A = this.all();
    if (!A[no]) {
      A[no] = { no, start: Date.now(), end: Date.now(), games: {}, peak: 0, t: { follows: 0, subs: 0, prime: 0, t2: 0, t3: 0, gifted: 0, bits: 0, kicks: 0, sc: 0, raids: 0, raidViewers: 0, checkins: 0, newFaces: 0, battles: 0, messages: 0, watchMin: 0 }, v: {}, ev: [] };
      const keys = Object.keys(A).map(Number).sort((a, b) => a - b);
      while (keys.length > KEEP) delete A[keys.shift()];
    }
    A[no].end = Date.now();
    return A[no];
  }
  row(s, key) { if (!s.v[key]) s.v[key] = { w: 0, m: 0, s: 0, g: 0, b: 0, k: 0, sc: 0, bt: 0, f: 0, n: 0 }; return s.v[key]; }
  // kind: follow | sub | gift | bits | kicks | sc | raid | checkins | battle | message | watch | newface
  event(kind, n, key, extra) {
    if (!this.isLive()) return;
    const s = this.cur(); if (!s) return;
    n = n || 1;
    const T = s.t, r = key ? this.row(s, key) : null;
    switch (kind) {
      case 'follow': T.follows++; if (r) r.f = 1; break;
      case 'sub': T.subs++; if (extra && extra.prime) T.prime++; else if (extra && extra.tier === 2) T.t2++; else if (extra && extra.tier === 3) T.t3++; if (r) r.s++; break;
      case 'gift': T.gifted += n; if (r) r.g += n; break;
      case 'bits': T.bits += n; if (r) r.b += n; break;
      case 'kicks': T.kicks += n; if (r) r.k += n; break;
      case 'sc': T.sc += n; if (r) r.sc += n; break;
      case 'raid': T.raids++; T.raidViewers += n; break;
      case 'checkins': T.checkins += n; break;
      case 'battle': T.battles++; if (r) r.bt++; break;
      case 'message': T.messages++; if (r) r.m++; break;
      case 'watch': T.watchMin += n; if (r) r.w += n; break;
      case 'newface': T.newFaces++; if (r) r.n = 1; break;
      default: break;
    }
    if (/^(follow|sub|gift|bits|kicks|sc|raid|battle)$/.test(kind)) { s.ev.push([Date.now(), kind, (extra && extra.who) || '', n]); if (s.ev.length > 400) s.ev.shift(); }
  }
  tickMinute(present) {
    if (!this.isLive()) return;
    const s = this.cur(); if (!s) return;
    const g = this.game() || 'Unknown'; s.games[g] = (s.games[g] || 0) + 1;
    if (present > s.peak) s.peak = present;
  }
  list() {
    return Object.values(this.all()).sort((a, b) => b.no - a.no).map((s) => ({ no: s.no, start: s.start, end: s.end, games: s.games, t: s.t, peak: s.peak, chatters: Object.values(s.v).filter((x) => x.m > 0).length }));
  }
  one(no, nameOf) {
    const s = this.all()[no]; if (!s) return null;
    return Object.assign({}, s, { rows: Object.entries(s.v).map(([k, x]) => Object.assign({ key: k }, nameOf(k), x)) });
  }
}
module.exports = { StreamLog };
