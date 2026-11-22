// Weekly giveaway rotation that builds to "The Big One" on the last draw day of the month.
//   1st draw day of the month: Community Drop   2nd: Bronze   3rd: Silver   LAST: Gold (The Big One)
//   A 5th draw day in a month (before the last) = Double Tickets Week, no prize.
//   Skipped dates (Christmas Eve etc.) are left out; the Big One moves to the last draw day that isn't skipped.
const DAY = 86400000;

const SCHED_DEFAULTS = {
  on: false,
  weekday: 4,                   // 0 Sun .. 6 Sat. 4 = Thursday
  openMode: 'week',             // 'week' = entries open at the first stream of the week, 'day' = on draw day only
  remindMins: 30,
  skip: ['12-24', '12-25', '12-31', '01-01'],   // MM-DD, every year
  prizes: {
    community: { prize: 'Game key', value: 10 },
    bronze: { prize: 'Gift card', value: 25 },
    silver: { prize: 'New game', value: 50 },
    gold: { prize: 'The Big One', value: 100 }
  }
};
const LABEL = { community: 'Community Drop', bronze: 'Bronze Drop', silver: 'Silver Drop', gold: 'THE BIG ONE: Gold Drop', double: 'Double Tickets Week' };

function settings(cfg) {
  const s = Object.assign({}, SCHED_DEFAULTS, cfg.schedule || {});
  s.prizes = Object.assign({}, SCHED_DEFAULTS.prizes, (cfg.schedule && cfg.schedule.prizes) || {});
  return s;
}
const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const mmdd = (d) => String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// all draw days in a month with their slot
function month(y, m, S) {
  const days = [];
  for (let d = new Date(y, m, 1); d.getMonth() === m; d = new Date(y, m, d.getDate() + 1)) if (d.getDay() === S.weekday && !S.skip.includes(mmdd(d))) days.push(new Date(d));
  const order = ['community', 'bronze', 'silver'];
  return days.map((d, i) => ({ date: ymd(d), at: d.getTime(), slot: i === days.length - 1 ? 'gold' : i < 3 ? order[i] : 'double' }));
}
// the draw day for the week containing `now` (weeks run Monday-Sunday), with its slot
function thisWeek(now, S) {
  const d = midnight(new Date(now));
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const draw = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + ((S.weekday + 6) % 7));
  const list = month(draw.getFullYear(), draw.getMonth(), S);
  const hit = list.find((x) => x.date === ymd(draw));
  // a skipped week (Christmas etc.) becomes a Double Tickets Week instead
  return { week: ymd(mon), drawDate: ymd(draw), drawAt: draw.getTime(), slot: hit ? hit.slot : (draw.getDay() === S.weekday ? 'double' : null), skipped: !hit };
}
function upcoming(now, n, S) {
  const out = [], d0 = midnight(new Date(now));
  for (let k = 0; out.length < n && k < 6; k++) {
    const y = d0.getFullYear(), m = d0.getMonth() + k;
    for (const x of month(new Date(y, m, 1).getFullYear(), new Date(y, m, 1).getMonth(), S)) if (x.at >= d0.getTime() && out.length < n) out.push(Object.assign({ label: LABEL[x.slot] }, x));
  }
  return out;
}
function nextBigOne(now, S) { return upcoming(now, 12, S).find((x) => x.slot === 'gold') || null; }
function isDoubleWeek(now, S) { if (!S.on) return false; const w = thisWeek(now, S); return w.slot === 'double'; }

module.exports = { SCHED_DEFAULTS, LABEL, settings, month, thisWeek, upcoming, nextBigOne, isDoubleWeek, DAY };
