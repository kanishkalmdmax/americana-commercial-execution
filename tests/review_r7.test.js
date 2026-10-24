const test = require('node:test'); const assert = require('node:assert'); const load = require('./load');
const boot = () => { const FD = load(); FD.init(7, { storage: null }); return FD; };
test('C1: an inactive van has no plan, so it never captures shared stores', () => {
  const FD = boot(); const st = FD.state; const d = st.clock.date;
  assert.ok(!st.visits.some(v => v.vsr === 'V11'));
  FD.dispatch('RULE_SET', { rule: 'maxPerStore', value: 3 });
  assert.ok(!st.recs.some(r => !FD.salesVan(st, r.vsr)));
  const v = st.visits.find(x => x.date === d && x.vsr === 'V09' && x.status === 'PLANNED');
  FD.dispatch('SUP_STOP_REMOVE', { store: v.store });
  assert.strictEqual(v.status, 'SKIPPED');
});
test('I2: a reassigned stop takes its real visit; no phantom off-plan visit', () => {
  const FD = boot(); const st = FD.state; const d = st.clock.date;
  const x = FD.realStops(d).find(s => s.onPlan && s.start > '10:00' && FD.salesVan(st, s.van));
  const v = st.visits.find(y => y.date === d && y.store === x.store && y.vsr === x.van);
  const to = st.world.vsrs.find(w => w.kind === 'sales' && w.id !== x.van && !st.visits.some(y => y.date === d && y.store === x.store && y.vsr === w.id));
  FD.dispatch('STOP_REASSIGN', { visitId: v.id, toVan: to.id });
  FD.dispatch('CLOCK_SET', { date: d, time: '23:59' });
  const vs = st.visits.filter(y => y.date === d && y.store === x.store);
  assert.strictEqual(vs.length, 1, JSON.stringify(vs.map(y => [y.vsr, y.status, !!y.offPlan])));
  assert.strictEqual(vs[0].status, 'DONE');
});
test('I2: a stop cannot be moved to a van that already plans that store', () => {
  const FD = boot(); const st = FD.state; const d = st.clock.date;
  const v = st.visits.find(y => y.date === d && y.status === 'PLANNED' && FD.salesVan(st, y.vsr));
  const other = st.visits.find(y => y.date === d && y.store !== v.store && y.vsr !== v.vsr && FD.salesVan(st, y.vsr));
  st.visits.push(Object.assign({}, other, { id: 'VX', store: v.store }));
  FD.dispatch('STOP_REASSIGN', { visitId: v.id, toVan: other.vsr });
  assert.notStrictEqual(v.vsr, other.vsr);
});
test('I3: day close carries a pre-order to the store\'s next planned visit and keeps attached ones', () => {
  const FD = boot(); const st = FD.state; const d = st.clock.date;
  const s = st.world.stores.find(x => st.visits.some(v => v.date === d && v.store === x.id && v.status === 'PLANNED') && !FD.realStops(d).some(r => r.store === x.id));
  FD.dispatch('PREORDER_ADD', { store: s.id, text: 'x' });
  const p = st.preorders[st.preorders.length - 1]; FD.dispatch('PREORDER_STATUS', { id: p.id, status: 'ATTACHED' });
  FD.dispatch('CLOCK_SET', { date: d, time: '23:59' }); FD.dispatch('DAY_CLOSE', {});
  assert.strictEqual(p.status, 'ATTACHED');
  assert.ok(p.forDate === null || FD.realPlan(p.forDate).some(q => q.store === s.id) || s.days.includes(FD.dow(p.forDate)));
});
test('I4: release all only releases the vans it is given', () => {
  const FD = boot(); const st = FD.state; const d = st.clock.date;
  FD.dispatch('VAN_RELEASE_ALL', { vans: ['V01', 'V02'] });
  assert.strictEqual(FD.vanStage(st, 'V01', d), 'DISPATCHED');
  assert.strictEqual(FD.vanStage(st, 'V03', d), 'PLAN_READY');
});
test('M1: closing the day does not mark a stop missed when the store was visited', () => {
  const FD = boot(); const st = FD.state; const d = st.clock.date;
  FD.dispatch('CLOCK_SET', { date: FD.addDays(d, 1), time: '07:00' });
  const done = new Set(st.visits.filter(v => v.date === d && v.status === 'DONE').map(v => v.store));
  assert.ok(!st.visits.some(v => v.date === d && v.status === 'MISSED' && done.has(v.store)));
});
