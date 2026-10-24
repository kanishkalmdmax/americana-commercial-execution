// Fixture map: the old synthetic ids in the tests -> real equivalents (same role, same product group, same day offset from today).
require('../src/00_core.js'); require('../src/01z_real_data.js');
const FD = globalThis.FD; const R = FD.REAL;
// vans with real selling activity (the two low-activity vans are sales vans too, but have almost no orders)
const sales = R.vans.filter(v => v.kind === 'sales' && R.lines.filter(l => l[2] === v.id).length >= 50);
const fx = {};
sales.slice(0, 6).forEach((v, i) => { fx['V' + (i + 1)] = v.id; fx['R' + (i + 1)] = v.route; });
fx.K = { '3040430754': '1518644', '3040430755': '1518643', '3040430756': '1518642', '3040421754': '1518650', '3040421779': '1518648', '3040421778': '1518649',
  '3040421723': '1518646', '3040421724': '1518645', '3040421650': '1616626', '3040421651': '1616627', '3040311723': '209872', '3040311722': '209871', '3040311721': '209870',
  '3040441124': '209996', '3040441106': '209989', '3040441206': '210000', '3050402701': '3135961', '3050402703': '3135960', '3050402704': '3135962',
  '3040321140': '2828970', '3040321142': '2828971', '3040321144': '2828973', '3040421157': '1518630', '3040421156': '1518631' };
// offsets count selling days (Fridays skipped), so 'the next day' is always a working day
fx.D = iso => { let n = FD.daysBetween('2026-11-18', iso), d = R.today; const step = n < 0 ? -1 : 1; while (n) { d = FD.addDays(d, step); if (FD.isSellingDay(d)) n -= step; } return d; };
// old ST-0nn = store k of route r (15 per route) -> store k of that sales van
fx.ST = id => { const n = +id.slice(3) - 1; const van = sales[Math.floor(n / 15)]; return R.stores.filter(s => s.van === van.id)[n % 15].id; };
module.exports = fx;
