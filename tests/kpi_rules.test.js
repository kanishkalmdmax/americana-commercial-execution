const test = require('node:test'), assert = require('node:assert');
const load = require('./load');

test('only returns of deliveries from Day 1, after the first 30 days, count against the pilot', () => {
  const FD = load(); const D1 = FD.PILOT_START, at = n => FD.addDays(D1, n), st = {};
  assert.ok(FD.pilotReturn(st, { saleDate: at(5), date: at(40) }));
  assert.ok(!FD.pilotReturn(st, { saleDate: at(5), date: at(29) }), 'logged in the first 30 days');
  assert.ok(!FD.pilotReturn(st, { saleDate: at(-1), date: at(40) }), 'delivered before Day 1');
  assert.ok(!FD.pilotReturn(st, { saleDate: null, date: at(40) }), 'no earlier delivery');
});

test('strike rate leaves out collection-only stops, Friday adds sales and visits but no Selling Day', () => {
  const FD = load(); FD.init(7, { storage: null });
  const fri = '2026-10-16', thu = '2026-10-15', sat = '2026-10-17';
  assert.strictEqual(new Date(fri + 'T00:00:00Z').getUTCDay(), 5);
  const visit = (store, date, x) => Object.assign({ store, date, vsr: 'X', status: 'DONE', route: 'R' }, x);
  const st = { dv: 0, lang: 'en', clock: { date: sat, time: '23:59' }, covers: [], recs: [], returns: [], world: { stores: [], vsrs: [] }, rules: {},
    orders: [['A', thu], ['B', fri]].map(([store, date]) => ({ store, date, vsr: 'X', sku: '*', units: 1, value: 100 })),
    visits: [visit('A', thu), visit('B', fri), visit('C', thu, { collected: 50 }), visit('D', thu, { nc: 10 }), visit('E', thu, { collected: 50, nc: 7 }), visit('F', sat, { nc: 1 })] };
  const m = FD.vsrMetrics(st, 'X', thu, sat);
  assert.strictEqual(m.genuine, 6);
  assert.strictEqual(m.collected, 2, 'a stop with a decline reason is not collection-only');
  assert.strictEqual(m.days, 2, 'Thursday and Saturday; Friday adds no Selling Day');
  assert.strictEqual(m.lev.withSale, 50, '2 sales of 4 visits');
  assert.strictEqual(m.lev.avgSale, 100);
  assert.strictEqual(m.perDay, 100, 'Friday sales count: 200 over 2 days');
});

test('Phase 1 Shelf Check: photos only, no score or issues; any Before photo answers a request', () => {
  const FD = load(); FD.init(7, { storage: null });
  const s = FD.state, store = s.world.stores[0];
  assert.strictEqual(FD.SHELF_AI, false);
  for (const a of (s.planogram.assessments || [])) assert.strictEqual(FD.scSummary(s, a.id).analysed, false);
  assert.strictEqual(FD.pgFollowUps(s).length, 0);
  FD.dispatch('SC_REQUEST', { store: store.id });
  assert.strictEqual(FD.scRequest(FD.state, store.id).status, 'OPEN');
  FD.dispatch('PG_START', { id: 'x1', store: store.id, vsr: store.vsr });
  FD.dispatch('PG_PHOTOS_ADD', { key: 'k1', id: 'x1', photos: [{ id: 'p1', src: 'data:x', phase: 'BEFORE', ref: null }] });
  assert.strictEqual(FD.scRequest(FD.state, store.id).status, 'DONE');
});
