const test = require('node:test'); const assert = require('node:assert'); const load = require('./load');
const boot = () => { const FD = load(); FD.init(7, { storage: null }); return FD; };
const salesVan = FD => FD.state.world.vsrs.find(x => x.kind === 'sales' && FD.realStops(FD.TODAY).some(s => s.van === x.id) && FD.REAL.lines.some(l => l[0] === FD.TODAY && l[2] === x.id));
test('stages follow actions', () => {
  const FD = boot(); const st = FD.state; const v = salesVan(FD);
  assert.strictEqual(FD.vanStage(st, v.id, FD.TODAY), 'PLAN_READY');
  FD.dispatch('VAN_RELEASE', { van: v.id }); assert.strictEqual(FD.vanStage(st, v.id, FD.TODAY), 'DISPATCHED');
  FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '12:00' }); assert.ok(['LIVE', 'CLOSED'].includes(FD.vanStage(st, v.id, FD.TODAY)));
  FD.dispatch('VAN_CLOSE', { van: v.id }); assert.strictEqual(FD.vanStage(st, v.id, FD.TODAY), 'CLOSED');
});
test('first visit auto-releases', () => {
  const FD = boot(); const st = FD.state; const v = salesVan(FD);
  FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '23:59' });
  assert.notStrictEqual(FD.vanStage(st, v.id, FD.TODAY), 'PLAN_READY');
  assert.notStrictEqual(FD.vanStage(st, v.id, FD.TODAY), 'DISPATCHED');
});
test('salesman day closes once SalesBuzz has closed it (end of day)', () => {
  const FD = boot(); const st = FD.state; FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '23:59' });
  const worked = new Set(FD.REAL.stops.filter(x => x[0] === FD.TODAY).map(x => x[1])); // a van with a plan but no SalesBuzz day stays unclosed
  for (const v of st.world.vsrs.filter(x => worked.has(x.id))) assert.ok(['CLOSED', 'NO_ACTIVITY'].includes(FD.vanStage(st, v.id, FD.TODAY)), v.id + ' ' + FD.vanStage(st, v.id, FD.TODAY));
});
test('collection vans never raise a pace alert, and no van without data is shown', () => {
  const FD = boot(); const st = FD.state; FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '15:00' });
  assert.ok(!st.world.vsrs.some(v => v.kind === 'inactive'));
  const coll = new Set(st.world.vsrs.filter(v => v.kind === 'collection').map(v => v.id));
  assert.ok(!FD.alerts(st, FD.TODAY).some(a => a.type === 'A_PACE' && coll.has(a.van)));
});
test('missed excludes stores visited the same day, off plan or by another van', () => {
  const FD = boot(); const st = FD.state; FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '23:59' });
  const missed = FD.alerts(st, FD.TODAY).filter(a => a.type === 'A_MISSED');
  assert.ok(missed.length > 0);
  for (const a of missed) assert.ok(!st.visits.some(x => x.date === FD.TODAY && x.store === a.store && x.status === 'DONE'));
});
test('no missed alerts before a van is live', () => {
  const FD = boot(); assert.strictEqual(FD.alerts(FD.state, FD.TODAY).filter(a => a.type === 'A_MISSED').length, 0);
});
test('alerts are ranked and grouped per van and type', () => {
  const FD = boot(); FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '14:00' });
  const rank = { A_MISSED: 0, A_OFFPLAN: 1, A_PACE: 2, A_PREORDER: 3 };
  const a = FD.alerts(FD.state, FD.TODAY).map(x => rank[x.type]);
  assert.deepStrictEqual(a, [...a].sort((x, y) => x - y));
  const g = FD.alertGroups(FD.state, FD.TODAY);
  const keys = g.map(x => x.type + x.van); assert.strictEqual(new Set(keys).size, keys.length);
  assert.strictEqual(g.reduce((n, x) => n + x.count, 0), FD.alerts(FD.state, FD.TODAY).length);
  for (const x of g) assert.strictEqual(x.items.length, x.count);
});
test('pace uses the van usual window and never fires for collection vans', () => {
  const FD = boot(); const st = FD.state; FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '14:00' });
  for (const a of FD.alerts(st, FD.TODAY).filter(x => x.type === 'A_PACE')) {
    assert.strictEqual(st.world.vsrs.find(v => v.id === a.van).kind, 'sales');
    assert.ok(a.slots.n < a.slots.m);
  }
});
test('progress adds up', () => {
  const FD = boot(); const st = FD.state; const v = salesVan(FD); FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '23:59' });
  const p = FD.vanProgress(st, v.id, FD.TODAY);
  assert.ok(p.planned > 0 && p.done <= p.planned && p.expected > 0 && p.sales > 0);
  const real = FD.realStops(FD.TODAY).filter(s => s.van === v.id).length;
  assert.strictEqual(p.done + p.offPlan, real);
});
test('close day carries pre-orders to the next selling day', () => {
  const FD = boot(); const st = FD.state; const s = st.world.stores.find(x => !st.visits.some(v => v.date === FD.TODAY && v.store === x.id));
  FD.dispatch('PREORDER_ADD', { store: s.id, text: 'Need 2 cartons' });
  assert.ok(FD.alerts(st, FD.TODAY).some(a => a.type === 'A_PREORDER' && a.store === s.id));
  st.world.vsrs.forEach(v => FD.dispatch('VAN_CLOSE', { van: v.id })); FD.dispatch('DAY_CLOSE', {});
  assert.ok(FD.dayClosed(st, FD.TODAY));
  const p = st.preorders.find(x => x.store === s.id); assert.ok(p.forDate > FD.TODAY && FD.isSellingDay(p.forDate));
});
test('dispatch question rule and exception shape', () => {
  const FD = boot(); const st = FD.state;
  let any = 0;
  for (const v of st.world.vsrs.filter(x => x.kind === 'sales')) for (const e of FD.dispatchExceptions(st, v.id, FD.TODAY)) {
    any++; assert.ok(['X_QUESTION', 'X_DUE', 'X_SKIPPED', 'X_SHORT', 'X_DAMAGED', 'X_PREORDER', 'X_OWNER_NOT'].includes(e.type));
    if (e.type === 'X_QUESTION') assert.ok(e.slots.n >= 4 && e.slots.m <= 1);
  }
  assert.ok(any > 0);
});
test('reassigning a stop moves it to the other van today', () => {
  const FD = boot(); const st = FD.state; const vans = st.world.vsrs.filter(x => x.kind === 'sales');
  const v = st.visits.find(x => x.date === FD.TODAY && x.vsr === vans[0].id && x.status === 'PLANNED');
  FD.dispatch('STOP_REASSIGN', { visitId: v.id, toVan: vans[1].id });
  assert.strictEqual(v.vsr, vans[1].id); assert.strictEqual(v.route, vans[1].route);
  assert.ok(FD.planFor(st, vans[1].id, FD.TODAY).stops.some(x => x.id === v.id));
});
test('release all releases every van with a plan', () => {
  const FD = boot(); const st = FD.state; FD.dispatch('VAN_RELEASE_ALL', {});
  for (const v of st.world.vsrs) { const s = FD.vanStage(st, v.id, FD.TODAY); assert.ok(['DISPATCHED', 'NO_ACTIVITY'].includes(s), v.id + s); }
});
