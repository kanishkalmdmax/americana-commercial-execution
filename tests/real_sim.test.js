const test = require('node:test'); const assert = require('node:assert'); const load = require('./load');
const boot = () => { const FD = load(); FD.init(7, { storage: null }); return FD; };
test('starts today 07:00 with today plan and history', () => {
  const FD = boot(); const st = FD.state;
  assert.deepStrictEqual(st.clock, { date: '2026-10-22', time: '07:00' });
  assert.ok(st.visits.filter(v => v.date === FD.TODAY && v.status === 'PLANNED').length > 100);
  assert.ok(st.recs.filter(r => r.date < FD.TODAY && FD.SOLD.includes(r.outcome)).length > 20);
});
test('real events apply once and never twice', () => {
  const FD = boot(); const st = FD.state;
  FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '12:00' });
  const n1 = st.orders.filter(o => o.date === FD.TODAY).length;
  FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '08:00' });
  FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '12:00' });
  assert.ok(n1 > 0);
  assert.strictEqual(st.orders.filter(o => o.date === FD.TODAY).length, n1);
});
test('today is graded on real lines only', () => {
  const FD = boot(); const st = FD.state; FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '23:59' });
  assert.ok(!st.orders.some(o => o.date === FD.TODAY && o.src === 'UPLIFT'));
  assert.ok(st.orders.some(o => o.date < FD.TODAY && o.src === 'UPLIFT'));
});
test('manual order on a stop skips its real event', () => {
  const FD = boot(); const st = FD.state;
  const v = st.visits.find(x => x.date === FD.TODAY && x.status === 'PLANNED' && FD.realLines(FD.TODAY, x.vsr, x.store).length);
  FD.dispatch('ARRIVE', { vsr: v.vsr, store: v.store }); FD.dispatch('SB_ORDER', { vsr: v.vsr, store: v.store, mode: 'FULL' });
  const before = st.orders.filter(o => o.store === v.store && o.date === FD.TODAY).length;
  FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '23:59' });
  assert.strictEqual(st.orders.filter(o => o.store === v.store && o.date === FD.TODAY).length, before);
});
test('no recommendations for collection or inactive vans; canned offered through the normal logic', () => {
  const FD = boot(); const st = FD.state;
  const off = new Set(st.world.vsrs.filter(v => v.kind !== 'sales').map(v => v.id));
  assert.ok(!st.recs.some(r => off.has(r.vsr)));
  assert.ok(st.recs.every(r => FD.recommendable(r.sku)));
  assert.ok(st.recs.some(r => FD.sku(r.sku).category === 'other')); // canned reorders/new lines, no separate grocery path (27 Oct decision)
});
test('off-plan visits today are added as visits', () => {
  const FD = boot(); const st = FD.state; FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '23:59' });
  assert.ok(st.visits.some(v => v.date === FD.TODAY && v.offPlan && v.status === 'DONE'));
});
test('sync next moves to the next full hour', () => {
  const FD = boot(); const st = FD.state; FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '09:20' });
  FD.dispatch('SYNC_NEXT', {}); assert.strictEqual(st.clock.time, '10:00');
});
