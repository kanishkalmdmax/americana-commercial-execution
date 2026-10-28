const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
const L = 5; // up to 02_data.js
const FD = load(L); const R = FD.REAL; const world = FD.buildWorld(7);
const hist = FD.buildHistory(world, 7, FD.HIST_START, FD.TODAY);
const vanIds = R.vans.filter(v => v.kind !== 'inactive').map(v => v.id);

test('pending cash per active van', () => {
  assert.ok(R.pendingCash);
  for (const v of vanIds) { const p = R.pendingCash[v]; assert.ok(p, v); assert.ok(p.sar >= 0 && p.n >= 0, v); assert.ok(p.n === 0 ? p.oldest === null : /^\d{4}-\d\d-\d\d$/.test(p.oldest) && p.oldest <= FD.TODAY, v); assert.ok((p.sar > 0) === (p.n > 0), v); }
  assert.ok(vanIds.some(v => R.pendingCash[v].sar > 0));
  const route = R.vans.find(v => v.id === vanIds[0]).route;
  assert.deepStrictEqual(FD.pendingCash(route), FD.pendingCash(vanIds[0]));
  assert.deepStrictEqual(FD.pendingCash('NOPE'), { sar: 0, n: 0, oldest: null });
});
test('collection visits carry the SAR collected and have no order', () => {
  const col = hist.visits.filter(v => v.collected);
  assert.ok(col.length > 100, 'collected visits ' + col.length);
  const withOrder = new Set(hist.orders.map(o => o.date + '|' + o.vsr + '|' + o.store));
  for (const v of col) { assert.ok(v.collected > 0 && v.status === 'DONE', v.id); assert.ok(!withOrder.has(v.date + '|' + v.vsr + '|' + v.store), v.id + ' has an order'); }
  assert.ok(hist.visits.some(v => !v.collected && v.status === 'DONE'));
  assert.ok(FD.realStops(FD.TODAY).some(s => s.collected > 0));
  assert.ok(FD.realStops(FD.TODAY).every(s => s.collected >= 0));
});
test('collected total never exceeds the payments recorded', () => {
  const paid = R.pays.reduce((a, p) => a + p[4], 0);
  assert.ok(R.stops.reduce((a, s) => a + (s[7] || 0), 0) <= paid + 0.01);
});
test('stores carry an area profile, nearby places that agree with it, and the new flags', () => {
  const PT = { AP_SCHOOL: 'TAG_SCHOOL', AP_EXPAT: 'TAG_WORKERS', AP_FAMILY: 'TAG_MOSQUE', AP_HIGHINC: 'TAG_VILLA', AP_MEDICAL: 'TAG_HOSPITAL', AP_HIGHWAY: 'TAG_PETROL' };
  assert.strictEqual(FD.PROFILES.length, 7);
  for (const p of FD.PROFILES) { const c = FD.CATALOG['PROFN_' + p]; assert.ok(c && c.en && /[؀-ۿ]/.test(c.ar), p); }
  for (const s of world.stores) { assert.ok(FD.PROFILES.includes(s.profile), s.id); assert.ok(s.tags.length >= 1 && s.tags.every(t => FD.TAGS.includes(t)) && (!PT[s.profile] || s.tags[0] === PT[s.profile]), s.id); assert.strictEqual(s.closed, null); assert.strictEqual(s.relocate, FD.REAL.stores.find(x => x.id === s.id).gps === 'a'); } // relocate: no known position -> confirm on the next visit
  assert.ok(new Set(world.stores.map(s => s.profile)).size >= 5);
  assert.deepStrictEqual(FD.buildWorld(7).stores.map(s => s.profile), world.stores.map(s => s.profile)); // seeded from the store id
  assert.ok(Array.isArray(FD.TAGS)); // still defined for the screens that read it
});
test('oldestDue is set only for stores with overdue invoices', () => {
  for (const s of world.stores) {
    if (s.overdue > 0) { assert.match(s.oldestDue, /^\d{4}-\d\d-\d\d$/, s.id); assert.ok(s.oldestDue < FD.TODAY, s.id); assert.strictEqual(FD.overdueDays(s.id, FD.TODAY), FD.daysBetween(s.oldestDue, FD.TODAY), s.id); }
    else assert.strictEqual(s.oldestDue, null, s.id);
  }
  assert.ok(world.stores.some(s => s.oldestDue));
});
