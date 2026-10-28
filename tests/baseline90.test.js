const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');

test('pilot selling day k is paired with baseline selling day k; days without sales data are left out', () => {
  const FD = load(9); FD.init(7, { storage: null });
  const B = FD.REAL.baseline, P = FD.pairs(FD.PILOT_START, FD.TODAY);
  const pil = [...P.pilot].sort(), bas = [...P.base].sort();
  assert.strictEqual(pil.length, bas.length); assert.ok(pil.length > 10);
  assert.ok(pil.every(FD.isSellingDay) && bas.every(FD.isSellingDay), 'only selling days are paired');
  assert.ok(bas.every(d => d >= B.dataStart && d >= FD.BASE_FROM && d < FD.PILOT_START), 'baseline days have sales data and sit before the pilot');
  const odd = new Set(FD.REAL.oddDays); assert.ok(!pil.some(d => odd.has(d)) && !bas.some(d => odd.has(d)), 'odd weeks are left out on both sides');
  // the first 10 pilot selling days pair with the first 10 baseline selling days (where both have data)
  const sell = (a, b) => { const o = []; for (let d = a; d <= b; d = FD.addDays(d, 1)) if (FD.isSellingDay(d)) o.push(d); return o; };
  const ps = sell(FD.PILOT_START, FD.PILOT_END), bs = sell(FD.BASE_FROM, FD.addDays(FD.PILOT_START, -1));
  for (const d of pil) assert.strictEqual(FD.baseDayOf(d), bs[ps.indexOf(d)]);
});

test('the baseline runs through the same measures as the pilot', () => {
  const FD = load(9); FD.init(7, { storage: null });
  const st = FD.state, v = st.world.vsrs.find(x => x.kind === 'sales' && x.id === 'V06');
  const P = FD.pairs(FD.PILOT_START, FD.TODAY), lfl = FD.likeForLike(st, v.id, FD.PILOT_START, FD.TODAY);
  const b = FD.vsrMetrics(FD.baseState(), v.id, P.from, P.to, null, P.base);
  assert.ok(b.days >= 3 && b.perDay > 0, 'V06 has a baseline');
  const a = FD.vsrMetrics(st, v.id, FD.PILOT_START, FD.TODAY, null, P.pilot);
  assert.ok(Math.abs(lfl.pct - 100 * (a.perDay - b.perDay) / b.perDay) < 1e-6, 'vs baseline = paired pilot per day against paired baseline per day');
  // a period that starts at the pilot is compared with the paired baseline days
  const cp = FD.comparePeriod(FD.PILOT_START, FD.TODAY); assert.ok(cp.base && cp.from === P.from && cp.to === P.to);
  // net = gross - resaleable returns on the baseline too
  const goodRet = FD.baseState().returns.filter(FD.goodReturn).length; assert.ok(goodRet > 0);
});
