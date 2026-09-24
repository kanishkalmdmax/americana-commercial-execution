const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
const L = 4;
test('24 SKUs with spec codes and prices', () => {
  const FD = load(L);
  assert.strictEqual(FD.SKUS.length, 24);
  const c = FD.sku('3040421754');
  assert.deepStrictEqual([c.pcs, c.cost, c.street, c.retail], [18, 8.81, 1.00, 18.00]);
  assert.strictEqual(FD.sku('3040421723').bigger, '3040421754');
  assert.ok(FD.sku('3040430754').sisters.includes('3040430756'));
});
test('world shape is deterministic and pilot-sized', () => {
  const FD = load(L);
  const a = FD.buildWorld(7), b = FD.buildWorld(7);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.vsrs.length, 6); assert.strictEqual(a.stores.length, 90);
  for (const r of a.routes) assert.strictEqual(a.stores.filter(s => s.route === r.id).length, 15);
  assert.ok(a.stores.some(s => s.credit === 'BLOCKED'));
  assert.ok(a.stores.some(s => s.onboarding === 'PENDING'));
  assert.strictEqual(a.promos.filter(p => p.end >= FD.TODAY).length, 3);
  for (const p of a.promos) assert.ok(FD.CATALOG[p.promoId], p.promoId);
});
test('stops per day: 7-8 on normal routes, 5 or fewer on remote', () => {
  const FD = load(L); const w = FD.buildWorld(7);
  const n = r => w.stores.filter(s => s.route === r && s.days.includes(3)).length;
  assert.ok(n('R1') >= 7 && n('R1') <= 8); assert.ok(n('R6') <= 5);
});
test('history has orders only on selling days', () => {
  const FD = load(L); const w = FD.buildWorld(7);
  const h = FD.buildHistory(w, 7, FD.BASE_START, FD.addDays(FD.PILOT_START, -1));
  assert.ok(h.orders.length > 5000, 'orders ' + h.orders.length);
  assert.ok(h.orders.every(o => FD.isSellingDay(o.date)));
});
test('behaviour seed: school stores over-index on singles and cake bars', () => {
  const FD = load(L); const w = FD.buildWorld(7);
  const h = FD.buildHistory(w, 7, FD.BASE_START, FD.addDays(FD.PILOT_START, -1));
  const singles = new Set(FD.SKUS.filter(s => s.group === 'GRP_SINGLES' || s.group === 'GRP_CAKEBAR').map(s => s.code));
  const rate = pred => { const ss = new Set(w.stores.filter(pred).map(s => s.id));
    return h.orders.filter(o => ss.has(o.store) && singles.has(o.sku)).reduce((a, o) => a + o.units * FD.sku(o.sku).pcs, 0) / ss.size; };
  assert.ok(rate(s => s.tags.includes('TAG_SCHOOL')) > 1.5 * rate(s => !s.tags.includes('TAG_SCHOOL')));
});
test('labels and sizes have display text', () => {
  const FD = load(L);
  for (const id of ['LBL_PERFECT', 'LBL_A', 'LBL_B', 'LBL_C', 'LBL_PRESALES', 'SIZE_SMALL', 'SIZE_LARGE', 'SIZE_MINI']) assert.ok(FD.CATALOG[id], id);
});
