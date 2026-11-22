// Balance check for the shootout + composure: node tools/sim-shootout.js
const q = [];
global.setTimeout = (fn) => { q.push(fn); return q.length; };
global.clearTimeout = () => {};
const { Battle } = require('../lib/battle');
function play(c0, c1, b0, b1, picks) {
  let result = null, sd = false, minComp = 100;
  const b = new Battle({
    push: (m) => { if (m.phase === 'result') result = m; if (m.phase === 'aim' && m.sd) sd = true; if (m.comp) minComp = Math.min(minComp, ...m.comp); },
    say: () => {}, sayTo: () => {}, ensure: () => {}, reward: () => {},
    opts: () => ({ joinSecs: 30, boostSecs: 15, maxBoost: 10, maxShields: 5, intervalMin: 30, points: { shootout: [3, 1], race: [3, 2, 1, 1] } }),
    card: (k) => (k === 'a' ? c0 : c1)
  });
  b.mode = 'shootout'; b.phase = 'boost';
  b.fighters = [{ key: 'a', login: 'a', display: 'a', boost: 0 }, { key: 'b', login: 'b', display: 'b', boost: 0 }];
  if (b0) b.boost('x', 'x', b0, 'for a'); if (b1) b.boost('x', 'x', b1, 'for b');
  b.run();
  let guard = 0;
  while (q.length && !result && guard++ < 1000) {
    const fn = q.shift();
    if (b.so && b.so.aim && picks) b.aimInput('t', b.so.aim.s === 0 ? 'a' : 'b', ['L', 'C', 'R'][Math.floor(Math.random() * 3)]);
    fn();
  }
  return { w: result.winner, sd, minComp };
}
const C = (ovr, loy) => ({ ovr, stats: { LOY: loy || ovr } });
const N = 3000;
for (const [lbl, c0, c1, b0, b1] of [
  ['equal cards 50 v 50, no support', C(50), C(50), 0, 0],
  ['50 v 50, A gets 300 bits', C(50), C(50), 3, 0],
  ['50 v 50, A gets 1000 bits (max)', C(50), C(50), 10, 0],
  ['70 v 50, no support', C(70), C(50), 0, 0],
  ['50 v 70, underdog gets 500 bits', C(50), C(70), 5, 0],
  ['85 v 45, no support', C(85), C(45), 0, 0]]) {
  let w = 0, sd = 0, mc = 0;
  for (let k = 0; k < N; k++) { const r = play(c0, c1, b0, b1, true); if (r.w === 0) w++; if (r.sd) sd++; mc += r.minComp; }
  console.log(lbl.padEnd(38), 'A wins', (w / N * 100).toFixed(0) + '%', ' sudden death', (sd / N * 100).toFixed(0) + '%', ' lowest composure avg', (mc / N).toFixed(0));
}
