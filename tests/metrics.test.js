const fx = require('./fx');
const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
const L = 9;
let shared;
const boot = () => { const FD = load(L); FD.init(7, { storage: null }); return FD; };
const get = () => shared || (shared = boot());

test('pilot display uses the approved primary KPI and four supporting KPIs verbatim', () => {
  const FD = require('./load')();
  assert.deepStrictEqual(FD.PILOT_METRICS.map(m => FD.CATALOG[m.label].en), [
    'Net Sales per Salesman per Selling Day', 'Visits', 'Visits with a Sale (%)', 'Average Sale Value', 'Damage & expiry (% of sales)'
  ]);
  assert.deepStrictEqual(FD.PILOT_METRICS.slice(1).map(m => FD.CATALOG[m.info].en), [
    'Completed store visits per salesman per selling day.',
    'Share of completed visits that end in a posted order.',
    'Sales value per visit with a sale, including reorders and upsells.',
    'Damaged and expired returns as a share of gross sales.'
  ]);
  assert.deepStrictEqual(FD.PILOT_ADOPTION.map(m => [FD.CATALOG[m.label].en, FD.CATALOG[m.target].en]), [
    ['Morning queue action rate', '100% of alerts'], ['Low-usage route follow-up', 'Same-day call'],
    ['Daily plan open rate', '≥95% before first stop'], ['Store action execution rate', '≥80% by Week 4'],
    ['Upsell offer pitch rate', '100% of target stores'], ['Reason & stock-out capture', 'Reasons ≥90%; stock-outs 100%']
  ]);
});

test('primary KPI equals the four-factor formula for pooled data and repeated store visits', () => {
  const FD = boot(), s = FD.state, ids = s.world.vsrs.filter(v => v.kind === 'sales').map(v => v.id);
  const verify = m => assert.ok(Math.abs(m.perDay - m.visits * m.withSale / 100 * m.avgSale * (1 - m.resale / 100)) < 1e-7); // net deducts resaleable returns only
  verify(FD.teamLevers(s, ids, FD.PILOT_START, FD.TODAY));
  const v = s.visits.find(v => ids.includes(v.vsr) && v.status === 'DONE' && v.date >= FD.PILOT_START && v.date <= FD.TODAY && s.world.stores.find(x => x.id === v.store).credit !== 'BLOCKED');
  s.visits.push({...v,id:'contract-repeat-visit'}); s.dv++;
  const m = FD.vsrMetrics(s,v.vsr,FD.PILOT_START,FD.TODAY);
  verify({...m.lev,perDay:m.perDay});
  verify(FD.teamLevers(s, ids, FD.PILOT_START, FD.TODAY));
});

test('composite is the weighted sum of metric scores within 0..100', () => {
  const FD = get(); const m = FD.vsrMetrics(FD.state, fx.V1, FD.PILOT_START, FD.TODAY);
  const w = FD.DEFAULT_WEIGHTS; const tot = FD.METRIC_KEYS.reduce((a, k) => a + w[k], 0);
  const c = FD.METRIC_KEYS.reduce((a, k) => a + m.score[k] * w[k], 0) / tot;
  assert.ok(Math.abs(m.composite - c) < 0.01 && c >= 0 && c <= 100, JSON.stringify(m.score));
  assert.ok(m.net > 0 && m.upsellSales > 0 && m.upsellConv > 0 && m.upsellConv < 100);
  // the five levers: visits per selling day, % with a sale, average sale value, upsell sales, returns %
  assert.ok(m.lev.visits > 0 && m.lev.withSale > 0 && m.lev.withSale <= 100 && m.lev.avgSale > 0 && m.lev.returns >= 0);
});
test('missing reasons lower reason completion; exempting raises action completion', () => {
  const FD = boot();
  const sv = FD.state.skipVan; const other = fx.V1 === sv ? fx.V2 : fx.V1;
  const v5 = FD.vsrMetrics(FD.state, sv, FD.PILOT_START, FD.TODAY), v3 = FD.vsrMetrics(FD.state, other, FD.PILOT_START, FD.TODAY);
  assert.ok(v5.reasonsPct < v3.reasonsPct, v5.reasonsPct + ' vs ' + v3.reasonsPct);
  const before = v5.action;
  FD.state.recs.filter(r => r.vsr === sv && ['NOT_SOLD', 'NOT_OFFERED'].includes(r.outcome) && !r.reason).forEach(r => { r.exempted = true; });
  FD.state.dv++;
  assert.ok(FD.vsrMetrics(FD.state, sv, FD.PILOT_START, FD.TODAY).action > before);
});
test('ranking ranks every sales van once in both modes with 8-week sparklines', () => {
  const FD = get(); const n = FD.state.world.vsrs.filter(v => v.kind === 'sales').length;
  for (const mode of ['ABS', 'IMP']) {
    const r = FD.ranking(FD.state, mode, FD.PILOT_START, FD.TODAY);
    assert.deepStrictEqual(r.map(x => x.rank).sort((a, b) => a - b), Array.from({ length: n }, (_, i) => i + 1));
    assert.strictEqual(r[0].spark.length, 8);
    assert.ok(r.every(x => typeof x.move === 'number'));
  }
});
test('followed change compares stores that took upsells with those that did not', () => {
  const FD = get(); const m = FD.vsrMetrics(FD.state, fx.V1, FD.PILOT_START, FD.TODAY);
  assert.strictEqual(typeof m.followed.withRecs, 'number'); assert.strictEqual(typeof m.followed.without, 'number');
});
test('store health bands and shelf states', () => {
  const FD = get(); const h = FD.storeHealth(FD.state, fx.ST('ST-001'), FD.TODAY);
  assert.ok(h.score >= 0 && h.score <= 100 && ['GOOD', 'WATCH', 'LOW'].includes(h.band));
  for (const k of ['coverage', 'fresh', 'consistency', 'uptake']) assert.ok(h.parts[k] >= 0 && h.parts[k] <= 100, k);
  const blocked = fx.ST('ST-047'); FD.state.world.stores.find(x => x.id === blocked).credit = 'BLOCKED'; FD.invalidate(FD.state); FD.state.dv++;
  const sh = FD.shelf(FD.state, blocked, FD.TODAY);
  assert.strictEqual(Object.keys(sh).length, FD.SKUS.length);
  assert.ok(Object.values(sh).includes('GATED'));
  assert.strictEqual(sh.gates[Object.keys(sh).find(k => sh[k] === 'GATED')], 'GATE_CREDIT');
  const states = new Set(); FD.state.world.stores.forEach(s => Object.values(FD.shelf(FD.state, s.id, FD.TODAY)).forEach(v => states.add(v)));
  for (const s of ['CARRIED', 'PENDING', 'OPPORTUNITY', 'GATED', 'RETURNED']) assert.ok(states.has(s), s);
});
test('follow-ups fire from seeded behaviour, are ordered, and respect done/snooze', () => {
  const FD = boot(); const fu = FD.followUps(FD.state);
  for (const t of ['F_MISSING_REASONS', 'F_CORRECTION', 'F_VSR_STORE_MSG']) assert.ok(fu.some(f => f.tpl === t), t);
  assert.ok(fu.some(f => f.tpl === 'F_MISSING_REASONS' && f.slots.vsrId === FD.state.skipVan));
  for (let i = 1; i < fu.length; i++) assert.ok(fu[i - 1].pri <= fu[i].pri);
  FD.dispatch('FOLLOWUP_DONE', { key: 'd1', fu: fu[0].key });
  assert.ok(!FD.followUps(FD.state).some(f => f.key === fu[0].key));
  FD.dispatch('FOLLOWUP_SNOOZE', { key: 'd2', fu: fu[1].key });
  assert.ok(!FD.followUps(FD.state).some(f => f.key === fu[1].key));
});
test('every follow-up and coaching template renders without empty slots in both languages', () => {
  const FD = get();
  const drafts = FD.coachDrafts(FD.state);
  assert.ok(drafts.some(k => k.vsr === FD.state.priceVan)); // 27 Oct: with the new upsell split, return/promo tips outrank K_PRICE in the top-2 cap
  for (const lang of ['en', 'ar']) {
    FD.lang = lang;
    for (const f of FD.followUps(FD.state)) for (const id of [f.tpl, f.tpl + '_C']) assert.doesNotMatch(FD.t(id, FD.slotText(f.slots)), /\{|\s{2}|\(\s*\)|undefined|NaN/, id);
    for (const k of drafts) for (const id of [k.tpl, k.tpl + '_T']) assert.doesNotMatch(FD.t(id, FD.slotText(k.slots)), /\{|\s{2}|undefined|NaN/, id);
    for (const i of FD.insights(FD.state)) assert.doesNotMatch(FD.t(i.tpl, FD.slotText(i.slots)), /\{|\s{2}|undefined|NaN/, i.tpl);
  }
  FD.lang = 'en';
});
test('insights obey thresholds', () => {
  const FD = get(); const ins = FD.insights(FD.state);
  assert.ok(ins.length <= 5);
  assert.ok(ins.every(i => i.chart && i.chart.values.length === 2));
});
test('breakdowns: reasons, product performance, opportunities, accuracy', () => {
  const FD = get();
  const rb = FD.reasonBreakdown(FD.state, { kind: 'NOT_SOLD' });
  assert.ok(rb.find(g => g.group === 'RG_MONEY').count > 0);
  assert.ok(rb.some(g => g.group === 'R_NONE'));
  const sp = FD.skuPerf(FD.state, FD.PILOT_START, FD.TODAY);
  assert.strictEqual(sp.length, FD.SKUS.length); assert.ok(sp.some(x => x.watch));
  const op = FD.opportunities(FD.state, {});
  assert.ok(op.length > 10); for (let i = 1; i < op.length; i++) assert.ok(op[i - 1].ev >= op[i].ev);
  const acc = FD.recAccuracy(FD.state);
  assert.deepStrictEqual(acc.map(a => a.type).sort(), ['GAP', 'LAPSED', 'PROMO', 'UPGRADE']);
});
test('scorecard weights are editable and drive the composite (normalised to their total)', () => {
  const FD = boot(); const m0 = (k) => FD.vsrMetrics(FD.state, fx.V1, FD.PILOT_START, FD.TODAY);
  const before = m0();
  FD.dispatch('WEIGHTS_SET', { key: 'w1', weights: { visits: 0, withSale: 0, avgSale: 0, upsell: 100, returns: 0 } });
  const after = m0(); assert.ok(Math.abs(after.composite - after.score.upsell) < 0.01); assert.ok(before.composite > 0);
  FD.dispatch('WEIGHTS_SET', { key: 'w2', weights: { visits: 30, withSale: 20, avgSale: 15, upsell: 20, returns: 30 } }); // total 115
  const m = m0(), s = m.score;
  assert.ok(Math.abs(m.composite - (s.visits * 30 + s.withSale * 20 + s.avgSale * 15 + s.upsell * 20 + s.returns * 30) / 115) < 0.01);
});
test('old scorecard weights saved before the five levers are ignored', () => {
  const FD = boot(); FD.dispatch('WEIGHTS_SET', { key: 'old', weights: { net: 30, pvr: 20, drop: 15, xsell: 20, action: 15 } });
  const m = FD.vsrMetrics(FD.state, fx.V1, FD.PILOT_START, FD.TODAY); assert.ok(Number.isFinite(m.composite) && m.composite > 0);
});
test('watchlist: reviewed after 2 weeks with before/since returns, keep extends, remove keeps history', () => {
  const FD = boot(); const code = FD.state.watchlist[0]; const w = FD.watchStats(FD.state, code);
  assert.strictEqual(w.since, FD.PILOT_START); assert.ok(w.due); assert.ok(typeof w.before === 'number' && typeof w.after === 'number');
  const fu = FD.followUps(FD.state).find(f => f.key.startsWith('F_WATCH_') && f.slots.skuCode === code); assert.ok(fu, 'review follow-up');
  FD.dispatch('WATCH_KEEP', { key: 'k', sku: code }); assert.ok(!FD.watchStats(FD.state, code).due);
  assert.ok(!FD.followUps(FD.state).some(f => f.key.startsWith('F_WATCH_')));
  FD.dispatch('WATCH_REMOVE', { key: 'r', sku: code });
  assert.ok(!FD.state.watchlist.includes(code)); assert.strictEqual(FD.state.watchHistory[0].since, FD.PILOT_START);
});
test('blocksAt: a product blocked here, a product blocked everywhere, and a whole-store block all show at the store', () => {
  const FD = boot(); const s = fx.ST('ST-003');
  FD.dispatch('BLOCK_ADD', { key: 'b1', store: s, sku: fx.K['3040311723'] }); FD.dispatch('BLOCK_ADD', { key: 'b2', sku: fx.K['3040421724'] }); FD.dispatch('BLOCK_ADD', { key: 'b3', store: fx.ST('ST-004'), sku: fx.K['3040430754'] });
  const ba = FD.blocksAt(FD.state, s);
  assert.deepStrictEqual(Object.keys(ba.skus).sort(), [fx.K['3040311723'], fx.K['3040421724']].sort()); assert.strictEqual(ba.store, null);
  FD.dispatch('BLOCK_ADD', { key: 'b4', store: s }); assert.ok(FD.blocksAt(FD.state, s).store);
  assert.strictEqual(FD.skuBlocks(FD.state, fx.K['3040421724']).length, 1);
});
