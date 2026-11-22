// Balance check for the Queen Raid: node tools/sim-raid.js [share of raiders typing !fire] [table on/off]
const A = require('../lib/arc');
const ACTIVE = +(process.argv[2] || 0.6);
if (process.argv[3] === 'off') A.configure({ useWinTable: false });
console.log('share of raiders typing !fire:', ACTIVE, '| win % table', A.TUNE.useWinTable ? 'ON' : 'OFF');
const card = () => { const o = 40 + Math.floor(Math.random() * 18); const st = {}; for (const k of ['WAT', 'SUB', 'SUP', 'CHT', 'LOY', 'RAI', 'STK']) st[k] = o + Math.floor(Math.random() * 8 - 4); return { ovr: o, stats: st }; };
function run(n, b, team, N) {
  let wins = 0, time = 0, left = 0, losses = 0;
  for (let k = 0; k < N; k++) {
    const cards = Array.from({ length: n }, card);
    const boosts = cards.map(() => (Math.random() < 0.2 ? b : 0));
    const r = new A.QueenRaid(cards, boosts); if (team) r.boost(-1, team);
    const keen = cards.map(() => Math.random() < ACTIVE);
    const cool = cards.map(() => 0);
    while (!r.done) { keen.forEach((k, i) => { if (k && r.t >= cool[i]) { r.fire(i); cool[i] = r.t + 2; if (Math.random() < 0.05) r.grenade(i); if (Math.random() < 0.04) r.heal(i); } }); r.tick(); }
    if (r.win) { wins++; time += r.t; } else { losses++; left += r.queen.hp / r.queen.max; }
  }
  return { win: wins / N * 100, time: wins ? time / wins : 0, left: losses ? left / losses * 100 : 0 };
}
module.exports = run;
if (require.main === module) for (const n of [1, 2, 4, 8, 15, 30, 60]) for (const [label, b, team] of [['no boosts', 0, 0], ['a few donors', 5, 5]]) {
  const s = run(n, b, team, 300);
  console.log(String(n).padStart(2), 'raiders', label.padEnd(14), 'table', String(A.tablePct(n)).padStart(3) + '%', '-> win', s.win.toFixed(0) + '%', s.win ? 'avg ' + s.time.toFixed(0) + 's' : '', 'losses end with Queen at', s.left.toFixed(0) + '%');
}
