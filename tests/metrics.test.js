const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
const L = 8;
let shared;
const boot = () => { const FD = load(L); FD.init(7, { storage: null }); return FD; };
const get = () => shared || (shared = boot());

test('composite is the weighted sum of metric scores within 0..100', () => {
  const FD = get(); const m = FD.vsrMetrics(FD.state, 'V1', FD.PILOT_START, FD.TODAY);
  const w = FD.WEIGHTS; const c = m.score.net * w.net + m.score.pvr * w.pvr + m.score.drop * w.drop + m.score.xsell * w.xsell + m.score.action * w.action;
  assert.ok(Math.abs(m.composite - c) < 0.01 && c >= 0 && c <= 100, JSON.stringify(m.score));
  assert.ok(m.net > 0 && m.upsellValue > 0 && m.upsellConv > 0 && m.upsellConv < 100);
});
test('missing reasons lower reason completion; exempting raises action completion', () => {
  const FD = boot();
  const v5 = FD.vsrMetrics(FD.state, 'V5', FD.PILOT_START, FD.TODAY), v3 = FD.vsrMetrics(FD.state, 'V3', FD.PILOT_START, FD.TODAY);
  assert.ok(v5.reasonsPct < v3.reasonsPct, v5.reasonsPct + ' vs ' + v3.reasonsPct);
  const before = v5.action;
  FD.state.recs.filter(r => r.vsr === 'V5' && ['NOT_SOLD', 'NOT_OFFERED'].includes(r.outcome) && !r.reason).forEach(r => { r.exempted = true; });
  FD.state.dv++;
  assert.ok(FD.vsrMetrics(FD.state, 'V5', FD.PILOT_START, FD.TODAY).action > before);
});
test('ranking has 6 unique ranks in both modes with 8-week sparklines', () => {
  const FD = get();
  for (const mode of ['ABS', 'IMP']) {
    const r = FD.ranking(FD.state, mode, FD.PILOT_START, FD.TODAY);
    assert.deepStrictEqual(r.map(x => x.rank).sort(), [1, 2, 3, 4, 5, 6]);
    assert.strictEqual(r[0].spark.length, 8);
    assert.ok(r.every(x => typeof x.move === 'number'));
  }
  const ctx = FD.ranking(FD.state, 'ABS', FD.PILOT_START, FD.TODAY).find(x => x.vsr === 'V6').context;
  assert.ok(ctx.some(c => c.id === 'CTX_REMOTE'));
});
test('followed change compares stores that took upsells with those that did not', () => {
  const FD = get(); const m = FD.vsrMetrics(FD.state, 'V1', FD.PILOT_START, FD.TODAY);
  assert.strictEqual(typeof m.followed.withRecs, 'number'); assert.strictEqual(typeof m.followed.without, 'number');
});
test('store health bands and shelf states', () => {
  const FD = get(); const h = FD.storeHealth(FD.state, 'ST-001', FD.TODAY);
  assert.ok(h.score >= 0 && h.score <= 100 && ['GOOD', 'WATCH', 'LOW'].includes(h.band));
  for (const k of ['coverage', 'fresh', 'consistency', 'uptake']) assert.ok(h.parts[k] >= 0 && h.parts[k] <= 100, k);
  const sh = FD.shelf(FD.state, 'ST-047', FD.TODAY); // credit blocked
  assert.strictEqual(Object.keys(sh).length, 24);
  assert.ok(Object.values(sh).includes('GATED'));
  assert.strictEqual(sh.gates[Object.keys(sh).find(k => sh[k] === 'GATED')], 'GATE_CREDIT');
  const states = new Set(); FD.state.world.stores.forEach(s => Object.values(FD.shelf(FD.state, s.id, FD.TODAY)).forEach(v => states.add(v)));
  for (const s of ['CARRIED', 'PENDING', 'OPPORTUNITY', 'DECLINED', 'GATED', 'RETURNED']) assert.ok(states.has(s), s);
});
test('follow-ups fire from seeded behaviour, are ordered, and respect done/snooze', () => {
  const FD = boot(); const fu = FD.followUps(FD.state);
  for (const t of ['F_MISSING_REASONS', 'F_REPEAT_DECLINE', 'F_CREDIT', 'F_CORRECTION', 'F_VSR_STORE_MSG', 'F_GAP_CLUSTER']) assert.ok(fu.some(f => f.tpl === t), t);
  assert.ok(fu.find(f => f.tpl === 'F_MISSING_REASONS').slots.vsrId === 'V5');
  for (let i = 1; i < fu.length; i++) assert.ok(fu[i - 1].pri <= fu[i].pri);
  FD.dispatch('FOLLOWUP_DONE', { key: 'd1', fu: fu[0].key });
  assert.ok(!FD.followUps(FD.state).some(f => f.key === fu[0].key));
  FD.dispatch('FOLLOWUP_SNOOZE', { key: 'd2', fu: fu[1].key });
  assert.ok(!FD.followUps(FD.state).some(f => f.key === fu[1].key));
});
test('every follow-up and coaching template renders without empty slots in both languages', () => {
  const FD = get();
  const drafts = FD.coachDrafts(FD.state);
  assert.ok(drafts.some(k => k.tpl === 'K_PRICE' && k.vsr === 'V2'));
  for (const lang of ['en', 'ar']) {
    FD.lang = lang;
    for (const f of FD.followUps(FD.state)) for (const id of [f.tpl, f.tpl + '_C']) assert.doesNotMatch(FD.t(id, FD.slotText(f.slots)), /\{|\s{2}|\(\s*\)|undefined|NaN/, id);
    for (const k of drafts) for (const id of [k.tpl, k.tpl + '_T']) assert.doesNotMatch(FD.t(id, FD.slotText(k.slots)), /\{|\s{2}|undefined|NaN/, id);
    for (const i of FD.insights(FD.state)) assert.doesNotMatch(FD.t(i.tpl, FD.slotText(i.slots)), /\{|\s{2}|undefined|NaN/, i.tpl);
  }
  FD.lang = 'en';
});
test('insights obey thresholds and find the school seed', () => {
  const FD = get(); const ins = FD.insights(FD.state);
  assert.ok(ins.length >= 1 && ins.length <= 5);
  assert.ok(ins.some(i => i.tpl === 'I_TAG_OVER' && i.slots.tagId === 'TAG_SCHOOL'));
  assert.ok(ins.every(i => i.chart && i.chart.values.length === 2));
});
test('breakdowns: reasons, product performance, opportunities, accuracy', () => {
  const FD = get();
  const rb = FD.reasonBreakdown(FD.state, { kind: 'NOT_SOLD' });
  assert.ok(rb.find(g => g.group === 'RG_MONEY').count > 0);
  assert.ok(rb.some(g => g.group === 'R_NONE'));
  const sp = FD.skuPerf(FD.state, FD.PILOT_START, FD.TODAY);
  assert.strictEqual(sp.length, 24); assert.ok(sp.some(x => x.watch));
  const op = FD.opportunities(FD.state, {});
  assert.ok(op.length > 10); for (let i = 1; i < op.length; i++) assert.ok(op[i - 1].ev >= op[i].ev);
  const acc = FD.recAccuracy(FD.state);
  assert.deepStrictEqual(acc.map(a => a.type).sort(), ['GAP', 'LAPSED', 'PROMO', 'UPGRADE']);
});
test('scorecard weights are editable and drive the composite (normalised to their total)', () => {
  const FD = boot(); const before = FD.vsrMetrics(FD.state, 'V1', FD.PILOT_START, FD.TODAY);
  FD.dispatch('WEIGHTS_SET', { key: 'w1', weights: { net: 0, pvr: 0, drop: 0, xsell: 100, action: 0 } });
  const after = FD.vsrMetrics(FD.state, 'V1', FD.PILOT_START, FD.TODAY);
  assert.ok(Math.abs(after.composite - after.score.xsell) < 0.01);
  FD.dispatch('WEIGHTS_SET', { key: 'w1b', weights: { net: 100, pvr: 0, drop: 0, xsell: 0, action: 0 } });
  assert.ok(Math.abs(FD.vsrMetrics(FD.state, 'V1', FD.PILOT_START, FD.TODAY).composite - after.score.net) < 0.01); assert.ok(before.composite > 0);
  FD.dispatch('WEIGHTS_SET', { key: 'w2', weights: { net: 30, pvr: 20, drop: 15, xsell: 20, action: 30 } }); // total 115
  const m = FD.vsrMetrics(FD.state, 'V1', FD.PILOT_START, FD.TODAY), s = m.score;
  assert.ok(Math.abs(m.composite - (s.net * 30 + s.pvr * 20 + s.drop * 15 + s.xsell * 20 + s.action * 30) / 115) < 0.01);
});
test('watchlist: reviewed after 2 weeks with before/since returns, keep extends, remove keeps history', () => {
  const FD = boot(); const code = '3040421651'; const w = FD.watchStats(FD.state, code);
  assert.strictEqual(w.since, '2026-11-02'); assert.ok(w.due); assert.ok(w.before > w.after, w.before + ' vs ' + w.after);
  const fu = FD.followUps(FD.state).find(f => f.key.startsWith('F_WATCH_') && f.slots.skuCode === code); assert.ok(fu, 'review follow-up');
  FD.dispatch('WATCH_KEEP', { key: 'k', sku: code }); assert.ok(!FD.watchStats(FD.state, code).due);
  assert.ok(!FD.followUps(FD.state).some(f => f.key.startsWith('F_WATCH_')));
  FD.dispatch('WATCH_REMOVE', { key: 'r', sku: code });
  assert.ok(!FD.state.watchlist.includes(code)); assert.strictEqual(FD.state.watchHistory[0].since, '2026-11-02');
});
test('blocksAt: a product blocked here, a product blocked everywhere, and a whole-store block all show at the store', () => {
  const FD = boot(); const s = 'ST-003';
  FD.dispatch('BLOCK_ADD', { key: 'b1', store: s, sku: '3040311723' }); FD.dispatch('BLOCK_ADD', { key: 'b2', sku: '3040421724' }); FD.dispatch('BLOCK_ADD', { key: 'b3', store: 'ST-004', sku: '3040430754' });
  const ba = FD.blocksAt(FD.state, s);
  assert.deepStrictEqual(Object.keys(ba.skus).sort(), ['3040311723', '3040421724']); assert.strictEqual(ba.store, null);
  FD.dispatch('BLOCK_ADD', { key: 'b4', store: s }); assert.ok(FD.blocksAt(FD.state, s).store);
  assert.strictEqual(FD.skuBlocks(FD.state, '3040421724').length, 1);
});
