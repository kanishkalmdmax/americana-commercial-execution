const test = require('node:test'); const assert = require('node:assert');
require('../src/00_core.js'); require('../src/01z_real_data.js');
const R = globalThis.FD.REAL;
test('real data shape and shift', () => {
  assert.strictEqual(R.today, '2026-10-22');
  assert.strictEqual(R.vans.length, 11);
  assert.ok(!R.vans.some(v => v.kind === 'collection')); // collection is a per-visit outcome, not a van type
  assert.deepStrictEqual(R.vans.filter(v => v.kind === 'inactive').map(v => v.route), ['RYD_04', 'RYD_05']); // stopped after August; RYD_11 runs RYD_04's stores in October
  assert.ok(R.plan.every(p => p[0] >= '2026-09-15' && p[0] <= '2026-10-31'));
  assert.ok(R.stops.every(s => s[0] <= '2026-10-22'));
  assert.ok(R.stops.some(s => s[0] === '2026-10-22'));
});
test('stops merged per van, store and day', () => {
  const k = new Set(R.stops.map(s => s[0] + s[1] + s[2]));
  assert.strictEqual(k.size, R.stops.length);
});
test('names translated per language', () => {
  const ar = /[؀-ۿ]/;
  for (const x of [...R.stores, ...R.vans, ...R.skus, ...R.sups]) { assert.ok(!ar.test(x.name_en), x.name_en); assert.ok(ar.test(x.name_ar), x.name_ar); }
});
test('product categories', () => {
  assert.ok(R.skus.length >= 90);
  assert.ok(R.skus.filter(s => s.category === 'other').every(s => s.group === 'GRP_OTHER'));
  assert.ok(R.skus.every(s => s.cost > 0 && s.pcsPerCrt >= 1));
});
test('customer master credit, van stock and return saleDate from October extract', () => {
  assert.ok(R.stores.some(s => s.credit === 'WATCH' && s.balance > 0 && s.creditLimit > 0));
  assert.strictEqual(Object.keys(R.vanStock).length, 11);
  assert.ok(Object.values(R.vanStock.V07).some(n => n > 0));
  assert.ok(R.returns.some(r => r[7] && r[7] < r[0]));
});
