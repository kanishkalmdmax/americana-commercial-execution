const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
const L = 5; // up to 02_data.js
test('world from real data', () => {
  const FD = load(L); const w = FD.buildWorld(7);
  assert.strictEqual(w.vsrs.length, 9); // vans with no order in the last 21 days are left out of the mockup
  assert.ok(w.stores.length > 1000);
  assert.ok(w.stores.every(s => s.route && s.vsr && s.days.length && s.label));
  assert.ok(FD.SKUS.every(k => k.cost > 0 && k.retail > k.cost));
  assert.deepStrictEqual(FD.buildWorld(7), w);
  for (const p of w.promos) assert.ok(FD.CATALOG[p.promoId], p.promoId);
});
test('history uses real orders before today', () => {
  const FD = load(L); const w = FD.buildWorld(7); const h = FD.buildHistory(w, 7, FD.BASE_START, FD.addDays(FD.TODAY, -1));
  assert.ok(h.orders.length > 5000, 'orders ' + h.orders.length);
  assert.ok(h.orders.every(o => o.date < FD.TODAY));
  assert.ok(h.visits.some(v => v.offPlan));
  assert.ok(h.visits.some(v => v.status === 'MISSED'));
});
test('today plan and stops available', () => {
  const FD = load(L);
  assert.ok(FD.realPlan(FD.TODAY).length > 100);
  assert.ok(FD.realStops(FD.TODAY).length > 50);
  const s = FD.realStops(FD.TODAY).find(x => FD.realLines(FD.TODAY, x.van, x.store).length);
  assert.ok(s, 'a stop with order lines today');
});
test('upgrade path: single cupcake points to a box of the same flavour', () => {
  const FD = load(L);
  const single = FD.SKUS.find(k => k.group === 'GRP_SINGLES' && k.bigger);
  assert.ok(single && FD.sku(single.bigger).group === 'GRP_CUPBOX');
});
test('labels and sizes have display text', () => {
  const FD = load(L);
  for (const id of ['LBL_A', 'LBL_B', 'LBL_C', 'SIZE_SMALL', 'SIZE_LARGE', 'SIZE_MINI', 'CAT_OTHER']) assert.ok(FD.CATALOG[id], id);
});
