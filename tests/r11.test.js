const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
const boot = () => { const FD = load(); FD.init(7, { storage: null }); return FD; };

test('five metrics: team values are pooled, and each salesman has value, baseline and target', () => {
  const FD = boot(); const s = FD.state; const ids = s.world.vsrs.filter(v => v.kind === 'sales').map(v => v.id);
  const t = FD.teamLevers(s, ids, FD.PILOT_START, s.clock.date);
  const ms = ids.map(id => FD.vsrMetrics(s, id, FD.PILOT_START, s.clock.date));
  const visits = ms.reduce((a, m) => a + m.genuine, 0), days = ms.reduce((a, m) => a + m.days, 0);
  assert.ok(Math.abs(t.visits - visits / days) < 1e-9, 'visits per selling day is total visits / total selling days');
  assert.ok(t.withSale > 0 && t.withSale < 100 && t.avgSale > 0 && t.returns >= 0 && t.upsell > 0);
  for (const m of ms) for (const k of FD.METRIC_KEYS) assert.ok(Number.isFinite(m.lev[k]) && Number.isFinite(m.score[k]), k);
  assert.deepStrictEqual(FD.METRICS.map(m => FD.CATALOG[m.label].en), ['Visits', 'Visits with a Sale (%)', 'Average Sale Value', 'Upsell Sales at Existing Stores', 'Damage & expiry (% of sales)']);
});

test('returns: lower is better in the score', () => {
  const FD = boot(); const s = FD.state; const id = s.world.vsrs.find(v => v.kind === 'sales').id;
  const m = FD.vsrMetrics(s, id, FD.PILOT_START, s.clock.date);
  if (m.lev.returns <= m.target.returns) assert.strictEqual(m.score.returns, 100);
  else assert.ok(m.score.returns < 100);
});

test('at most one new product per store, unless pinned', () => {
  const FD = boot(); const s = FD.state;
  for (const st of s.world.stores.slice(0, 200)) { const r = FD.recommend(s, st.id, s.clock.date).recs; assert.ok(r.filter(x => x.type === 'GAP' && !x.pinned).length <= 1, st.id); }
});

test('next-day data: the latest day is yesterday, today shows only what the supervisor did', () => {
  const FD = boot(); const s = FD.state; const d = s.clock.date;
  assert.strictEqual(FD.dataDay(s), FD.prevSellingDay(d));
  const v = s.world.vsrs.find(x => x.kind === 'sales');
  assert.strictEqual(FD.stageFor(s, v.id, d), 'PLAN_READY');
  FD.dispatch('VAN_RELEASE', { key: 'r1', van: v.id }); assert.strictEqual(FD.stageFor(s, v.id, d), 'DISPATCHED');
  FD.dispatch('LIVEDATA_SET', { key: 'l1', on: true }); assert.strictEqual(FD.dataDay(FD.state), d);
});

test('plan tomorrow: suggestions are capped and accepting one adds the store to that day only', () => {
  const FD = boot(); const s = FD.state; const tm = FD.nextSellingDay(s.clock.date);
  const vans = s.world.vsrs.filter(v => v.kind === 'sales');
  for (const v of vans) assert.ok(FD.planSuggestions(s, v.id, tm).length <= 6);
  const v = vans.find(x => FD.planSuggestions(s, x.id, tm).some(y => y.type !== 'X_QUESTION' && y.type !== 'X_PREORDER'));
  const sug = FD.planSuggestions(s, v.id, tm).find(y => y.type !== 'X_QUESTION' && y.type !== 'X_PREORDER');
  FD.dispatch('OFFPLAN_ADD', { key: 'a1', vsr: v.id, store: sug.store, bySup: true, date: tm });
  const added = FD.state.visits.find(x => x.date === tm && x.store === sug.store && x.supAdded);
  assert.ok(added && added.status === 'PLANNED' && !added.offPlan);
  assert.ok(!FD.planSuggestions(FD.state, v.id, tm).some(y => y.store === sug.store && y.type === sug.type), 'accepted suggestion disappears');
  FD.dispatch('VAN_RELEASE_ALL', { key: 'a2', vans: [v.id], date: tm }); assert.ok(FD.state.released[v.id + '|' + tm]);
});

test('shelf space ask is recorded and can be cleared', () => {
  const FD = boot(); const s = FD.state; const r = s.recs.find(x => x.date === s.clock.date && x.outcome === null);
  FD.dispatch('SHELF_ASK', { key: 'h1', recId: r.id, result: 'GOT' }); assert.strictEqual(FD.state.recs.find(x => x.id === r.id).shelfAsk, 'GOT');
  FD.dispatch('SHELF_ASK', { key: 'h2', recId: r.id, result: null }); assert.strictEqual(FD.state.recs.find(x => x.id === r.id).shelfAsk, null);
});

test('every alert, check and plan suggestion type maps to one of the five metrics', () => {
  const FD = boot();
  for (const k of ['A_MISSED', 'A_OFFPLAN', 'A_PREORDER', 'X_PREORDER', 'X_DUE', 'X_QUESTION', 'X_SKIPPED', 'X_SHORT', 'X_CARRY']) assert.ok(FD.METRIC_KEYS.includes(FD.leverOf(k)), k);
});
