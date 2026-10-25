const test = require('node:test'); const assert = require('node:assert'); const load = require('./load');
const boot = () => { const FD = load(); FD.init(7, { storage: null }); return FD; };
test('mockup shows only vans with data (no inactive van)', () => {
  const FD = boot(); const st = FD.state;
  assert.ok(st.world.vsrs.every(v => v.kind !== 'inactive'));
  assert.strictEqual(st.world.vsrs.length, 9);
});
test('store glance: plain metrics from real orders and visits', () => {
  const FD = boot(); const st = FD.state; const d = FD.TODAY;
  const withOrders = st.world.stores.filter(s => st.orders.some(o => o.store === s.id && o.date < d)).slice(0, 50);
  for (const s of withOrders) {
    const g = FD.storeGlance(st, s.id, d);
    assert.ok(g.lastOrder && g.lastOrder < d, 'last order');
    assert.ok(g.daysSinceOrder >= 1);
    assert.ok(g.orderDays28 >= 0 && g.wasted28 >= 0 && g.wasted28 <= g.visits28);
    assert.ok(g.avgOrder > 0);
    assert.ok(g.returnsPct >= 0);
    assert.ok(['STEADY', 'IRREGULAR', 'NONE'].includes(g.demand));
  }
});
test('stores needing attention have a plain reason and are worst first', () => {
  const FD = boot(); const st = FD.state;
  const list = FD.storesNeedingAttention(st, st.world.stores.map(s => s.id), FD.TODAY);
  assert.ok(list.length > 0);
  for (const x of list) assert.ok(x.reasons.length && x.reasons.every(r => ['SA_WASTED', 'SA_RETURNS', 'SA_NO_ORDER'].includes(r)));
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].score >= list[i].score);
});
test('van positions: depot before the first visit, last visited store after', () => {
  const FD = boot(); const st = FD.state; const d = FD.TODAY;
  const v = st.world.vsrs.find(x => x.kind === 'sales');
  assert.strictEqual(FD.vanPosition(st, v.id, d).at, 'DEPOT');
  FD.dispatch('CLOCK_SET', { date: d, time: '14:00' });
  const p = FD.vanPosition(st, v.id, d);
  assert.ok(p.at === 'STORE' && p.store && typeof p.lat === 'number');
  const last = st.visits.filter(x => x.date === d && x.vsr === v.id && x.status === 'DONE').sort((a, b) => (b.leftAt || '').localeCompare(a.leftAt || ''))[0];
  assert.strictEqual(p.store, last.store);
});
test('store WhatsApp: supervisor sends a promotion or a note; pre-orders arrive in the same thread', () => {
  const FD = boot(); const st = FD.state; const s = st.world.stores.find(x => st.orders.some(o => o.store === x.id));
  FD.dispatch('OWNER_MSG_SEND', { store: s.id, kind: 'PROMO', ref: st.world.promos[0].id });
  FD.dispatch('OWNER_MSG_SEND', { store: s.id, kind: 'TEXT', text: 'Thank you' });
  FD.dispatch('PREORDER_ADD', { store: s.id, text: 'Need 2 cartons' });
  const th = FD.ownerThread(st, s.id);
  assert.deepStrictEqual(th.map(m => m.kind).slice(-3), ['PROMO', 'TEXT', 'PREORDER']);
  assert.strictEqual(th[th.length - 1].by, 'OWNER');
  assert.throws(() => FD.dispatch('OWNER_MSG_SEND', { store: s.id, kind: 'PAYMENT_REMINDER' })); // not in scope (Q1 = A)
});
test('seeded owner conversations exist for the demo', () => {
  const FD = boot(); assert.ok(FD.state.ownerMsgs.filter(m => m.by === 'OWNER').length >= 3);
});
test('pre-order can be moved to a visit today, live notifications can be switched off', () => {
  const FD = load(); FD.init(7, { storage: null }); const st = FD.state;
  const p = st.preorders.find(x => x.forDate !== FD.TODAY); assert.ok(p, 'a seeded pre-order for a later visit');
  FD.dispatch('PREORDER_STATUS', { id: p.id, status: 'ATTACHED', forDate: FD.TODAY });
  assert.strictEqual(p.forDate, FD.TODAY); assert.strictEqual(p.status, 'ATTACHED');
  assert.notStrictEqual(st.rules.liveNotifs, false); FD.dispatch('LIVE_SET', { on: false }); assert.strictEqual(st.rules.liveNotifs, false);
});
test('resolving an alert hides it, undo brings it back; every store has shelf photos', () => {
  const FD = boot(); const st = FD.state; FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '14:00' });
  const g = FD.alertGroups(st, FD.TODAY)[0]; assert.ok(g); const keys = g.items.map(a => FD.alertKey(a, FD.TODAY)); const n = FD.alerts(st, FD.TODAY).length;
  FD.dispatch('ALERT_RESOLVE', { keys }); assert.strictEqual(FD.alerts(st, FD.TODAY).length, n - g.count);
  FD.dispatch('ALERT_RESOLVE', { keys, undo: true }); assert.strictEqual(FD.alerts(st, FD.TODAY).length, n);
  const withPhoto = new Set(st.photos.map(p => p.store)); assert.ok(st.world.stores.every(s => withPhoto.has(s.id)));
});
