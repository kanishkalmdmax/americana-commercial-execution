const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
// Audit build, core agent: reorder cycle, usual quantity, carton cap, canned fit, similar stores, maturity, upsell split,
// credit maths, corrections, route change dates, van lock, snooze, expiry, stop tiers, payday. Relations only: no pinned data counts.
const ISO = '2026-11-18';
const D = (n, base = ISO) => load.__FD.addDays(base, n);
function fd(upTo) { const FD = load(upTo); load.__FD = FD; return FD; }
const cakeSku = FD => FD.SKUS.find(k => k.category === 'cake' && k.life === 30);
const canned = FD => FD.SKUS.filter(k => k.category === 'other');

// bare engine context: one store S1 (class B) with 10 similar stores close by, van stock 500 of everything
function ctxWith(FD, o = {}) {
  const store = { id: 'S1', route: 'R1', vsr: 'VX', label: 'B', size: 'SMALL', tags: [], shelf: o.shelf || 'med', credit: 'OK', onboarding: 'APPROVED', days: [0, 1, 2, 3, 4, 6], lat: 24.7, lng: 46.7, overdue: 0, closed: null };
  const peers = Array.from({ length: o.peers ?? 10 }, (_, i) => ({ ...store, id: 'P' + i, lat: 24.7 + (i + 1) * 0.001 }));
  return { world: { stores: [store, ...peers], promos: [] }, orders: [], returns: [], recs: [], preorders: [], planogram: { requests: [] }, clock: { date: ISO },
    rules: { cooldownDays: 14, maxPerStore: o.max || 3, firstFillMax: 1, vanFeed: true, mustStock: o.must || {}, cannedLift: o.lift ?? 1.1,
      catGap: { cake: 35, other: 38, biscuit: 44, rusk: 44 }, catWindow: { cake: 60, other: 75, biscuit: 90, rusk: 90 } },
    blocks: [], pins: [], watchlist: [], vanStock: { VX: Object.fromEntries(FD.SKUS.map(s => [s.code, 500])) } };
}
const ord = (c, store, sku, ago, units = 4, extra = {}) => c.orders.push({ store, sku, date: D(-ago), units, value: units * FD_cost(sku), ...extra });
let FD_cost = () => 1;

test('reorder cycle = (own gaps up to 120 days + 2 x category gap) / (gaps + 2); no gaps gives the category gap', () => {
  const FD = fd(6); FD_cost = c => FD.sku(c).cost; const cake = cakeSku(FD), can = canned(FD)[0], bis = FD.SKUS.find(k => k.category === 'biscuit'), rusk = FD.SKUS.find(k => k.category === 'rusk');
  const c = ctxWith(FD);
  assert.strictEqual(FD.cycle(c, 'S1', cake.code, ISO), 35); assert.strictEqual(FD.cycle(c, 'S1', can.code, ISO), 38);
  assert.strictEqual(FD.cycle(c, 'S1', bis.code, ISO), 44); assert.strictEqual(FD.cycle(c, 'S1', rusk.code, ISO), 44);
  [60, 50, 30].forEach(a => ord(c, 'S1', cake.code, a)); // gaps 10 and 20
  assert.strictEqual(FD.cycle(c, 'S1', cake.code, ISO), 25); // (30 + 70) / 4
  const d = ctxWith(FD); [300, 100, 90].forEach(a => ord(d, 'S1', cake.code, a)); // the 200-day gap is left out
  assert.strictEqual(FD.cycle(d, 'S1', cake.code, ISO), Math.round((10 + 70) / 3));
  const e = ctxWith(FD); [60, 60, 30].forEach(a => ord(e, 'S1', cake.code, a)); // two lines on one day are one order day
  assert.strictEqual(FD.cycle(e, 'S1', cake.code, ISO), Math.round((30 + 70) / 3));
  assert.strictEqual(FD.catWindow(cake.code), 60); assert.strictEqual(FD.catWindow(can.code), 75); assert.strictEqual(FD.catWindow(bis.code), 90); assert.strictEqual(FD.catWindow(rusk.code), 90);
});

test('due when days since the last order reach min(cycle, shelf life)', () => {
  const FD = fd(6); FD_cost = c => FD.sku(c).cost; const cake = cakeSku(FD);
  const mk = lastAgo => { const c = ctxWith(FD); [lastAgo + 30, lastAgo + 10, lastAgo].forEach(a => ord(c, 'S1', cake.code, a)); return c; }; // gaps 20 and 10 -> cycle 22.5 -> 23
  assert.strictEqual(FD.cycle(mk(1), 'S1', cake.code, ISO), Math.round((30 + 70) / 4));
  const lapsed = c => FD.candidates(c, 'S1', ISO).some(x => x.type === 'LAPSED' && x.sku === cake.code);
  assert.ok(!lapsed(mk(24))); assert.ok(lapsed(mk(25)));
  // a long cycle never waits past the shelf life (cake 30 days)
  const long = ctxWith(FD); [150, 90, 30].forEach(a => ord(long, 'S1', cake.code, a)); assert.ok(FD.cycle(long, 'S1', cake.code, ISO) > 30);
  assert.ok(lapsed(long)); const ok = ctxWith(FD); [150, 90, 29].forEach(a => ord(ok, 'S1', cake.code, a)); assert.ok(!lapsed(ok));
});

test('usual reorder quantity is the median of the last 3 orders and caps the offer', () => {
  const FD = fd(6); FD_cost = c => FD.sku(c).cost; const cake = cakeSku(FD); const c = ctxWith(FD);
  [[90, 10], [80, 30], [70, 20], [60, 2]].forEach(([a, u]) => ord(c, 'S1', cake.code, a, u)); // last 3: 30, 20, 2
  assert.strictEqual(FD.usual(c, 'S1', cake.code, ISO), 20);
  const r = FD.recommend(c, 'S1', ISO, 'VX').recs.find(x => x.sku === cake.code && x.type === 'LAPSED');
  assert.ok(r); assert.strictEqual(r.usual, 20); assert.strictEqual(r.extra, 0);
  assert.strictEqual(r.qty, Math.min(20, Math.max(1, Math.round(cake.line || 1))));
  c.vanStock.VX[cake.code] = 3; assert.strictEqual(FD.recommend(c, 'S1', ISO, 'VX').recs.find(x => x.sku === cake.code).qty, 3); // van stock still caps it
});

test('first order: the product\'s usual first order, never above one carton', () => {
  const FD = fd(6); FD_cost = c => FD.sku(c).cost; const cake = cakeSku(FD);
  const build = (firstUnits, o) => { const c = ctxWith(FD, o); c.world.stores.slice(1).forEach(p => { ord(c, p.id, cake.code, 100, firstUnits); ord(c, p.id, cake.code, 20, 4); }); return c; };
  const gap = c => FD.recommend(c, 'S1', ISO, 'VX').recs.find(x => x.sku === cake.code && x.type === 'GAP');
  assert.strictEqual(gap(build(6)).qty, 6); assert.strictEqual(FD.firstQty(build(6), cake.code, ISO), 6);
  assert.strictEqual(gap(build(6, { shelf: 'low' })).qty, 3);
  assert.strictEqual(gap(build(900)).qty, cake.pcsPerCrt); // the case cap set in the test rules
  const half = build(900); half.rules.firstFillMax = 0.5; assert.strictEqual(gap(half).qty, Math.floor(cake.pcsPerCrt * 0.5));
  assert.strictEqual(gap(build(6)).usual, null);
});

test('canned: offered as new only where the store fits; flavour logic applies', () => {
  const FD = fd(9); FD_cost = c => FD.sku(c).cost; const [A, B] = canned(FD);
  const build = (carrying, boughtB) => { const c = ctxWith(FD); c.world.stores.slice(1, 1 + carrying).forEach(p => ord(c, p.id, A.code, 10)); if (boughtB != null) ord(c, 'S1', B.code, boughtB); return c; };
  const gapA = c => FD.candidates(c, 'S1', ISO).find(x => x.type === 'GAP' && x.sku === A.code);
  assert.ok(gapA(build(2, 30)), '20% of similar stores and canned bought lately');
  assert.ok(!gapA(build(2, null)), '20% and no canned bought');
  assert.ok(!gapA(build(2, 120)), 'canned bought, but not in the last 90 days');
  assert.ok(!gapA(build(0, 30)), 'nobody carries it');
  const g = gapA(build(3, null)); assert.ok(g, '30% of similar stores carry it'); assert.strictEqual(g.reasonId, 'B_GAP_NEAR'); assert.strictEqual(g.slots.pct, 30);
  // a canned reorder follows the same cycle rule (category gap 38)
  const c = ctxWith(FD); ord(c, 'S1', A.code, 37); assert.ok(!FD.candidates(c, 'S1', ISO).some(x => x.type === 'LAPSED' && x.sku === A.code));
  const c2 = ctxWith(FD); ord(c2, 'S1', A.code, 38); assert.ok(FD.candidates(c2, 'S1', ISO).some(x => x.type === 'LAPSED' && x.sku === A.code));
  assert.ok(FD.CATALOG.B_GAP_NEAR.en.includes('{pct}% of similar stores nearby carry this') && FD.CATALOG.B_GAP_NEAR.ar);
});

test('must-stock is by class and nearby place and keeps its own reason', () => {
  const FD = fd(6); FD_cost = c => FD.sku(c).cost; const cake = cakeSku(FD);
  const c = ctxWith(FD, { must: { B: [cake.code] } }); c.world.stores.slice(1, 4).forEach(p => ord(c, p.id, cake.code, 10)); // 30%: below the usual 35%
  const g = FD.candidates(c, 'S1', ISO).find(x => x.sku === cake.code); assert.ok(g); assert.strictEqual(g.reasonId, 'B_GAP_MUST');
  const n = ctxWith(FD); n.world.stores.slice(1, 4).forEach(p => ord(n, p.id, cake.code, 10)); assert.ok(!FD.candidates(n, 'S1', ISO).some(x => x.sku === cake.code));
  const t = ctxWith(FD, { must: { TAG_SCHOOL: [cake.code] } }); t.world.stores[0].tags = ['TAG_SCHOOL']; t.world.stores.slice(1, 4).forEach(p => ord(t, p.id, cake.code, 10)); const tg = FD.candidates(t, 'S1', ISO).find(x => x.sku === cake.code); assert.ok(tg && tg.reasonId === 'B_GAP_MUST', 'nearby-place area assortment is read');
});

test('canned ranks higher while the salesman\'s canned share this month is under 30%', () => {
  const FD = fd(6); FD_cost = c => FD.sku(c).cost; const cake = cakeSku(FD), can = canned(FD)[0];
  const build = (lift, canShareOrders) => { const c = ctxWith(FD, { max: 1, lift }); [[70, 20], [60, 20]].forEach(([a, u]) => { ord(c, 'S1', cake.code, a, u); ord(c, 'S1', can.code, a, 2); });
    c.vanStock.VX[can.code] = 1; // canned offered at 1 pack: a much smaller margin than the cake line
    if (canShareOrders) c.orders.push({ store: 'P1', vsr: 'VX', sku: can.code, date: '2026-11-05', units: 50, value: 10000 });
    else c.orders.push({ store: 'P1', vsr: 'VX', sku: cake.code, date: '2026-11-05', units: 50, value: 10000 });
    return c; };
  const top = c => FD.recommend(c, 'S1', ISO, 'VX').recs[0].sku;
  assert.strictEqual(top(build(1, false)), cake.code);
  assert.strictEqual(top(build(1e6, false)), can.code, 'lift applies at 0% canned share');
  assert.strictEqual(top(build(1e6, true)), cake.code, 'no lift once canned is 30% of the month');
  assert.strictEqual(FD.cannedShare(build(1, true), 'VX', ISO), 1); assert.strictEqual(FD.cannedShare(build(1, false), 'VX', ISO), 0);
});

test('similar stores: same class, nearest within 3 km, at least 8, at most 40, closed ones never count', () => {
  const FD = fd(); FD.init(7, { storage: null }); const st = FD.state, all = st.world.stores;
  assert.ok(Math.abs(FD.distKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.19) < 0.5);
  let checked = 0;
  for (let i = 0; i < all.length; i += 37) {
    const s = all[i], ps = FD.peers(st, s); const sameClass = all.filter(p => p.label === s.label && p.id !== s.id && !p.closed);
    assert.ok(ps.every(p => p.label === s.label && p.id !== s.id), 'same class, not itself');
    assert.ok(ps.length <= 40 && ps.length === Math.min(sameClass.length, Math.min(40, Math.max(8, sameClass.filter(p => FD.distKm(s, p) <= 3).length))), s.id);
    if (sameClass.length >= 8) assert.ok(ps.length >= 8);
    const far = Math.max(...ps.map(p => FD.distKm(s, p))); const ids = new Set(ps.map(p => p.id));
    assert.ok(sameClass.filter(p => !ids.has(p.id)).every(p => FD.distKm(s, p) >= far - 1e-9), 'nearest first');
    if (sameClass.filter(p => FD.distKm(s, p) <= 3).length >= 8) assert.ok(ps.every(p => FD.distKm(s, p) <= 3 || ps.length === 40));
    checked++;
  }
  assert.ok(checked > 20);
  // other vans count too: some store has a peer from another salesman
  assert.ok(all.some((s, i) => i % 11 === 0 && FD.peers(st, s).some(p => p.vsr !== s.vsr)));
  const s0 = all[0], first = FD.peers(st, s0)[0]; first.closed = '2026-10-01'; FD.invalidate(st);
  assert.ok(!FD.peers(st, s0).some(p => p.id === first.id), 'closed stores are left out'); first.closed = null; FD.invalidate(st);
});

test('maturity: waiting, reordered on a real repeat, returned, not reordered when the category window closes', () => {
  const FD = fd(6); const cake = cakeSku(FD), can = canned(FD)[0], bis = FD.SKUS.find(k => k.category === 'biscuit');
  const mk = sku => ({ store: 'S1', sku: sku.code, date: '2026-10-01', outcome: 'FULL' });
  const ctx = () => ({ orders: [], returns: [], rules: {} }); const at = n => FD.addDays('2026-10-01', n);
  const c = ctx(); assert.strictEqual(FD.maturity(c, mk(cake), at(10)), 'PENDING');
  assert.strictEqual(FD.maturity(c, mk(cake), at(60)), 'PENDING'); assert.strictEqual(FD.maturity(c, mk(cake), at(61)), 'NOT_REORDERED');
  assert.strictEqual(FD.maturity(c, mk(can), at(75)), 'PENDING'); assert.strictEqual(FD.maturity(c, mk(can), at(76)), 'NOT_REORDERED');
  assert.strictEqual(FD.maturity(c, mk(bis), at(90)), 'PENDING'); assert.strictEqual(FD.maturity(c, mk(bis), at(91)), 'NOT_REORDERED');
  c.orders.push({ store: 'S1', sku: cake.code, date: '2026-10-01', units: 3 }); // same day is not a repeat
  assert.strictEqual(FD.maturity(c, mk(cake), at(10)), 'PENDING');
  c.orders.push({ store: 'S1', sku: cake.code, date: at(5), units: 3 });
  assert.strictEqual(FD.maturity(c, mk(cake), at(10)), 'SUSTAINED'); assert.strictEqual(FD.maturity(c, mk(cake), at(90)), 'SUSTAINED');
  const late = ctx(); late.orders.push({ store: 'S1', sku: cake.code, date: at(70), units: 3 }); // after the window: not a repeat
  assert.strictEqual(FD.maturity(late, mk(cake), at(70)), 'NOT_REORDERED');
  const ret = ctx(); ret.returns.push({ store: 'S1', sku: cake.code, date: at(20) }); ret.orders.push({ store: 'S1', sku: cake.code, date: at(5), units: 3 });
  assert.strictEqual(FD.maturity(ret, mk(cake), at(30)), 'RETURNED');
  const lateRet = ctx(); lateRet.returns.push({ store: 'S1', sku: cake.code, date: at(61) }); assert.strictEqual(FD.maturity(lateRet, mk(cake), at(62)), 'NOT_REORDERED');
  assert.strictEqual(FD.maturity(c, { ...mk(cake), outcome: 'NOT_SOLD' }, at(10)), null);
  assert.deepStrictEqual(FD.CLOSED, ['SUSTAINED', 'NOT_REORDERED', 'RETURNED']);
  // "carries it" uses the category window too
  const w = ctxWith(FD); ord(w, 'S1', cake.code, 59); ord(w, 'S1', can.code, 74); ord(w, 'S1', bis.code, 89);
  assert.ok(FD.carries(w, 'S1', cake.code, ISO) && FD.carries(w, 'S1', can.code, ISO) && FD.carries(w, 'S1', bis.code, ISO));
  const w2 = ctxWith(FD); ord(w2, 'S1', cake.code, 61); ord(w2, 'S1', can.code, 76); ord(w2, 'S1', bis.code, 91);
  assert.ok(!FD.carries(w2, 'S1', cake.code, ISO) && !FD.carries(w2, 'S1', can.code, ISO) && !FD.carries(w2, 'S1', bis.code, ISO));
});

test('upsell split: a reorder counts only above the usual; value follows', () => {
  const FD = fd(6); const k = cakeSku(FD);
  const re = (got, usual) => FD.setExtra({ type: 'LAPSED', sku: k.code, outcome: 'FULL', got, usual });
  assert.strictEqual(re(14, 10).extra, 4); assert.strictEqual(re(8, 10).extra, 0);
  assert.ok(!FD.isUpsell(re(8, 10))); assert.ok(FD.isUpsell(re(14, 10)));
  assert.ok(Math.abs(FD.upsellValue(re(14, 10)) - 4 * k.cost) < 1e-9); assert.strictEqual(FD.upsellValue(re(8, 10)), 0);
  const gap = { type: 'GAP', sku: k.code, outcome: 'PARTIAL', got: 5 }; assert.ok(FD.isUpsell(gap)); assert.ok(Math.abs(FD.upsellValue(gap) - 5 * k.cost) < 1e-9);
  assert.ok(!FD.isUpsell({ type: 'GAP', sku: k.code, outcome: 'NOT_SOLD', got: 0 }));
  assert.ok(FD.isUpsell({ type: 'UPGRADE', sku: k.code, outcome: 'ALT', got: 1, alt: k.code })); assert.ok(FD.isUpsell({ type: 'PROMO', sku: k.code, outcome: 'FULL', got: 2 }));
});

test('metrics use the split: upsell figures, reorder figures, closed-only rates, collected visits', () => {
  const FD = fd(); FD.init(7, { storage: null }); const st = FD.state; const from = FD.PILOT_START, to = FD.TODAY;
  for (const r of st.recs) if (FD.SOLD.includes(r.outcome)) { assert.ok(r.extra >= 0); if (r.type === 'LAPSED') assert.strictEqual(r.extra, Math.max(0, r.got - (r.usual || 0))); else assert.strictEqual(r.extra, 0); assert.ok(r.maturity); }
  let reorderSeen = 0, collectedSeen = 0;
  for (const v of st.world.vsrs.filter(x => x.kind === 'sales')) {
    const m = FD.vsrMetrics(st, v.id, from, to);
    const sold = st.recs.filter(r => r.vsr === v.id && !r.coveredBy && r.date >= from && r.date <= to && FD.SOLD.includes(r.outcome) && !r.blockedAt);
    const ups = sold.filter(FD.isUpsell); const re = sold.filter(r => r.type === 'LAPSED');
    assert.strictEqual(m.upsellCount, ups.length); assert.strictEqual(m.reorderCount, re.length);
    assert.ok(Math.abs(m.upsellValue - ups.reduce((a, r) => a + FD.upsellValue(r), 0)) < 1e-6);
    assert.ok(Math.abs(m.reorderValue - re.reduce((a, r) => a + r.got * FD.sku(r.alt || r.sku).cost, 0)) < 1e-6);
    assert.strictEqual(m.sustained + m.notReordered + m.returnedMat, m.closedUpsells); assert.strictEqual(m.closedUpsells + m.pending, m.upsellCount);
    assert.ok(Math.abs(m.xsell - (m.closedUpsells ? 100 * m.sustained / m.closedUpsells : 0)) < 1e-9);
    reorderSeen += m.reorderCount; collectedSeen += m.collected;
    const col = new Set(st.visits.filter(x => x.vsr === v.id && x.status === 'DONE' && x.collected > 0 && x.date >= from && x.date <= to && !st.covers.some(c => c.date === x.date && c.route === x.route)).map(x => x.store + x.date));
    assert.ok(m.collected <= col.size);
  }
  assert.ok(reorderSeen > 0 && collectedSeen > 0);
  assert.ok(st.visits.every(v => v.skipReason !== 'SK_COLLECT'), 'the simulation never skips a stop as collection-only');
  assert.ok(st.visits.filter(v => v.collected > 0).every(v => v.status === 'DONE'));
  assert.strictEqual(FD.PILOT_END, FD.addDays(FD.PILOT_START, 89)); assert.strictEqual(FD.BASE_FROM, FD.addDays(FD.PILOT_START, -90)); // 90-day pilot against the 90 days before
  const sk = FD.skuPerf(st, from, to).filter(x => x.sold); assert.ok(sk.every(x => x.sustainedPct >= 0 && x.sustainedPct <= 100));
  assert.ok(/overdue/.test(FD.CATALOG.KPI_TIP_COLLECT.en) && !/credit limit/.test(FD.CATALOG.KPI_TIP_COLLECT.en));
});

test('a blocked credit status no longer hides a store\'s visits from the metrics', () => {
  const a = fd(); a.init(7, { storage: null }); const v = a.state.world.vsrs.find(x => x.kind === 'sales' && a.state.visits.some(y => y.vsr === x.id && y.status === 'DONE')).id;
  const before = a.vsrMetrics(a.state, v, a.PILOT_START, a.TODAY).genuine;
  const b = fd(); b.init(7, { storage: null }); b.state.world.stores.forEach(s => { s.credit = 'BLOCKED'; });
  assert.strictEqual(b.vsrMetrics(b.state, v, b.PILOT_START, b.TODAY).genuine, before);
});

test('van credit: smallest whole SAR that brings overdue strictly under 10%', () => {
  const FD = fd(); const mk = (T, O) => ({ world: { stores: [{ id: 'A', vsr: 'V1', openAr: T - O, overdue: 0 }, { id: 'B', vsr: 'V1', openAr: O, overdue: O }] } });
  const x = (T, O) => FD.vanCredit(mk(T, O), 'V1');
  assert.strictEqual(x(1000, 99).toCollect, 0); assert.strictEqual(x(1000, 100).toCollect, 1); // exactly 10% is not under 10%
  assert.strictEqual(x(1000, 300).toCollect, 223); assert.ok((300 - 223) / (1000 - 223) < 0.1 && (300 - 222) / (1000 - 222) >= 0.1);
  assert.strictEqual(x(1000, 300).overduePct, 30); assert.strictEqual(x(1000, 300).outstanding, 1000); assert.deepStrictEqual(x(1000, 300).top, [{ store: 'B', overdue: 300 }]);
  assert.strictEqual(x(0, 0).toCollect, 0);
  const st = fd(), s2 = (st.init(7, { storage: null }), st.state);
  for (const v of s2.world.vsrs.filter(q => q.kind === 'sales')) {
    const c = st.vanCredit(s2, v.id); assert.ok(c.pending >= 0 && c.overduePct >= 0);
    if (c.toCollect === 0) assert.ok(c.overdue * 10 < c.outstanding || c.outstanding === 0);
    else { assert.ok((c.overdue - c.toCollect) * 10 < c.outstanding - c.toCollect); assert.ok((c.overdue - c.toCollect + 1) * 10 >= c.outstanding - c.toCollect + 1 - 1e-6); }
  }
});

test('corrections apply on accept; a closed store leaves future plans and the active count; a moved store takes the next visit\'s arrival point', () => {
  const FD = fd(); FD.init(7, { storage: null }); const st = FD.state, T = FD.TODAY;
  const planned = vsr => FD.planFor(st, vsr, T).stops.filter(s => s.status === 'PLANNED').map(s => s.store);
  const van = st.world.vsrs.find(v => v.kind === 'sales' && planned(v.id).length > 5).id; const [a, b, c, d] = planned(van).map(id => st.world.stores.find(s => s.id === id));
  const add = (store, kind, value) => { FD.dispatch('CORRECTION_ADD', { vsr: van, store: store.id, kind, value, comment: 'x' }); return st.corrections[st.corrections.length - 1]; };
  const size = a.size === 'LARGE' ? 'MINI' : 'LARGE'; const cr = add(a, 'CORR_SIZE', size); assert.notStrictEqual(a.size, size); FD.dispatch('CORRECTION_DECIDE', { id: cr.id, accept: true }); assert.strictEqual(a.size, size);
  const shelf = a.shelf === 'high' ? 'low' : 'high'; const c2 = add(a, 'CORR_SHELF', shelf); FD.dispatch('CORRECTION_DECIDE', { id: c2.id, accept: false }); assert.notStrictEqual(a.shelf, shelf);
  FD.dispatch('CORRECTION_DECIDE', { id: add(a, 'CORR_SHELF', shelf).id, accept: true }); assert.strictEqual(a.shelf, shelf);
  const prof = a.profile === 'AP_SCHOOL' ? 'AP_MEDICAL' : 'AP_SCHOOL'; FD.dispatch('CORRECTION_DECIDE', { id: add(a, 'CORR_PROFILE', prof).id, accept: true }); assert.strictEqual(a.profile, prof);
  // closed
  const before = FD.kpiStatus(st, van, T).parts.active.jp;
  FD.dispatch('CORRECTION_DECIDE', { id: add(b, 'CORR_CLOSED').id, accept: true });
  assert.strictEqual(b.closed, T); assert.ok(!planned(van).includes(b.id)); assert.ok(!st.recs.some(r => r.store === b.id && r.date >= T && r.outcome === null));
  assert.strictEqual(FD.kpiStatus(st, van, T).parts.active.jp, before - 1);
  let day = FD.addDays(T, 1); while (!b.days.includes(FD.dow(day)) || !FD.isSellingDay(day)) day = FD.addDays(day, 1);
  FD.ensureDay(st, day); assert.ok(!st.visits.some(v => v.store === b.id && v.date === day));
  assert.ok(!FD.peers(st, a).some(p => p.id === b.id) || a.label !== b.label);
  // moved
  FD.dispatch('CORRECTION_DECIDE', { id: add(c, 'CORR_MOVED').id, accept: true }); assert.strictEqual(c.relocate, true);
  const [lat, lng] = [c.lat, c.lng]; FD.dispatch('SB_ORDER', { vsr: van, store: c.id, mode: 'FULL' });
  // no arrival point in the mockup: the pin stays and the store stays "location to confirm"
  assert.ok(st.visits.some(v => v.store === c.id && v.date === T && v.status === 'DONE')); assert.strictEqual(c.relocate, true); assert.ok(c.lat === lat && c.lng === lng);
  // rejected closure changes nothing
  FD.dispatch('CORRECTION_DECIDE', { id: add(d, 'CORR_CLOSED').id, accept: false }); assert.ok(!d.closed);
});

test('route change: preview, and the owner switches on the effective date, past sales stay', () => {
  const FD = fd(); FD.init(7, { storage: null }); const st = FD.state;
  const [va, vb] = st.world.vsrs.filter(v => v.kind === 'sales' && st.world.stores.some(s => s.vsr === v.id)); const ra = va.route, rb = vb.route;
  const pv = FD.routeSwapPreview(st, ra, vb.id);
  assert.strictEqual(pv.from, FD.addDays(st.clock.date, 1));
  assert.deepStrictEqual(pv.moves, [{ vsr: vb.id, route: ra, prevVsr: va.id }, { vsr: va.id, route: rb, prevVsr: vb.id }]);
  assert.deepStrictEqual(FD.routeSwapPreview(st, ra, va.id).moves, []);
  const ordersBefore = st.orders.filter(o => o.vsr === va.id).length; const storesA = st.world.stores.filter(s => s.route === ra);
  FD.dispatch('ROUTE_ASSIGN', { route: ra, vsr: vb.id });
  assert.ok(storesA.length && storesA.every(s => s.vsr === va.id), 'nothing changes at Save');
  let d2 = pv.from; while (!FD.isSellingDay(d2)) d2 = FD.addDays(d2, 1);
  FD.planFor(st, vb.id, d2); FD.ensureDay(st, d2); // looking at a later plan with the clock still on today moves nothing
  assert.ok(storesA.every(s => s.vsr === va.id), 'viewing a future plan does not switch owners');
  assert.ok(st.visits.filter(v => v.date === d2 && v.route === ra).length > 0 && st.visits.filter(v => v.date === d2 && v.route === ra).every(v => v.vsr === vb.id), 'that plan already uses the new owner');
  assert.ok(st.routeAssign.every(x => x.from === pv.from) && st.routeAssign.length === 2);
  assert.strictEqual(FD.routeOwner(st, ra, st.clock.date), va.id); assert.strictEqual(FD.routeOwner(st, ra, pv.from), vb.id);
  FD.dispatch('CLOCK_SET', { date: pv.from, time: '07:00' });
  assert.ok(storesA.every(s => s.vsr === vb.id), 'the new owner from the effective date');
  assert.ok(st.world.stores.filter(s => s.route === rb).every(s => s.vsr === va.id));
  FD.planFor(st, va.id, '2026-10-05'); FD.ensureDay(st, '2026-10-06'); assert.ok(storesA.every(s => s.vsr === vb.id), 'opening a past day does not move owners back');
  assert.ok(st.orders.filter(o => o.vsr === va.id && o.date < pv.from).length >= ordersBefore, 'past sales stay with the old owner');
  // a single store moves on its date too
  const s = st.world.stores.find(x => x.route === ra && x.vsr === vb.id); const other = st.world.vsrs.find(v => v.kind === 'sales' && v.id !== vb.id && v.id !== va.id);
  FD.dispatch('STORE_ASSIGN', { store: s.id, vsr: other.id }); assert.strictEqual(s.vsr, vb.id); assert.ok(s.pend && s.pend.from === FD.addDays(st.clock.date, 1));
  FD.dispatch('CLOCK_SET', { date: FD.addDays(st.clock.date, 2), time: '07:00' }); assert.strictEqual(s.vsr, other.id); assert.ok(!s.pend);
});

test('close van locks plan edits; waiting-for-data until the 02:00 load', () => {
  const FD = fd(); FD.init(7, { storage: null }); const st = FD.state, T = FD.TODAY;
  const vans = st.world.vsrs.filter(v => v.kind === 'sales' && FD.planFor(st, v.id, T).recs.some(r => r.outcome === null));
  const [A, B] = vans; const recOf = v => FD.planFor(st, v.id, T).recs.find(r => r.outcome === null && !r.blockedAt);
  assert.ok(!FD.vanLocked(st, A.id, T));
  const ra = recOf(A), rb = recOf(B), visitA = FD.planFor(st, A.id, T).stops.find(s => s.status === 'PLANNED');
  FD.dispatch('VAN_CLOSE', { van: A.id, date: T }); assert.ok(FD.vanLocked(st, A.id, T)); assert.ok(!FD.vanLocked(st, B.id, T)); assert.ok(FD.waitingData(st, A.id, T)); assert.ok(!FD.waitingData(st, B.id, T));
  FD.dispatch('SUP_REC_REMOVE', { recId: ra.id }); assert.ok(!ra.blockedAt, 'locked: no change');
  FD.dispatch('SUP_REC_EDIT', { recId: ra.id, qty: 99 }); assert.strictEqual(ra.qtyModified, null);
  FD.dispatch('SUP_STOP_REMOVE', { store: visitA.store, date: T }); assert.strictEqual(visitA.status, 'PLANNED');
  FD.dispatch('SUP_REC_REMOVE', { recId: rb.id }); assert.ok(rb.blockedAt, 'other vans are free');
  FD.dispatch('VAN_REOPEN', { van: A.id, date: T }); FD.dispatch('SUP_REC_REMOVE', { recId: ra.id }); assert.ok(ra.blockedAt);
  const mock = (date, time, live) => ({ vanClosed: { 'V01|2026-10-22': {} }, clock: { date, time }, rules: { liveData: live } });
  assert.ok(FD.waitingData(mock('2026-10-22', '20:00'), 'V01', '2026-10-22')); assert.ok(FD.waitingData(mock('2026-10-23', '01:59'), 'V01', '2026-10-22'));
  assert.ok(!FD.waitingData(mock('2026-10-23', '02:00'), 'V01', '2026-10-22')); assert.ok(!FD.waitingData(mock('2026-10-22', '20:00', true), 'V01', '2026-10-22'));
});

test('snoozed follow-ups are not Done, are listed as snoozed and can be restored', () => {
  const FD = fd(); FD.init(7, { storage: null }); const st = FD.state; const f = FD.followUps(st)[0]; assert.ok(f);
  FD.dispatch('FOLLOWUP_SNOOZE', { fu: f.key, snap: { tpl: f.tpl, slots: f.slots } });
  assert.ok(!st.fuHistory.some(h => h.key === f.key), 'not in Done'); assert.ok(!FD.followUps(st).some(x => x.key === f.key));
  const sn = FD.snoozedFollowUps(st); const hit = sn.find(x => x.key === f.key); assert.ok(hit); assert.strictEqual(hit.until, FD.addDays(st.clock.date, 1)); assert.ok(hit.item);
  FD.dispatch('FOLLOWUP_UNSNOOZE', { key: f.key }); assert.ok(FD.followUps(st).some(x => x.key === f.key)); assert.ok(!FD.snoozedFollowUps(st).some(x => x.key === f.key));
});

test('expiry check: delivered + life - 9 <= today < delivered + life, no reorder since', () => {
  const FD = fd(6); FD_cost = c => FD.sku(c).cost; const cake = cakeSku(FD); const life = cake.life;
  const hit = ago => { const c = ctxWith(FD); ord(c, 'S1', cake.code, ago); return FD.expiryChecks(c, 'S1', ISO).filter(x => x.sku === cake.code); };
  assert.strictEqual(hit(life - 10).length, 0); const r = hit(life - 9); assert.strictEqual(r.length, 1);
  assert.deepStrictEqual(r[0], { sku: cake.code, delivered: D(-(life - 9)), expires: D(9) });
  assert.strictEqual(hit(life - 1).length, 1); assert.strictEqual(hit(life).length, 0); assert.strictEqual(hit(life + 5).length, 0);
  const re = ctxWith(FD); ord(re, 'S1', cake.code, life - 5); ord(re, 'S1', cake.code, 3); assert.strictEqual(FD.expiryChecks(re, 'S1', ISO).filter(x => x.sku === cake.code).length, 0, 'reordered since');
  const long = ctxWith(FD); ord(long, 'S1', canned(FD)[0].code, 20); assert.strictEqual(FD.expiryChecks(long, 'S1', ISO).length, 0);
});

test('stop tiers: 1 due reorder / pre-order / not invoiced this month, 2 overdue or shelf request, 3 ordered in the last 7 days; plan sorts by tier then map order', () => {
  const FD = fd(); FD.init(7, { storage: null }); const st = FD.state, T = FD.TODAY;
  const cake = cakeSku(FD); const c = ctxWith(FD); FD_cost = x => FD.sku(x).cost; const s = c.world.stores[0];
  const tier = (c2, extra = {}) => FD.stopTier(Object.assign(c2, { ensure: 1 }), { date: ISO, store: 'S1', ...extra });
  const base = () => { const k = ctxWith(FD); ord(k, 'S1', cake.code, 16); return k; }; // invoiced 16 days ago, same month, nothing due
  assert.strictEqual(tier(ctxWith(FD)), 1, 'never invoiced');
  assert.strictEqual(tier(base()), 2, 'neither urgent nor fresh');
  const k3 = ctxWith(FD); ord(k3, 'S1', cake.code, 4); assert.strictEqual(tier(k3), 3);
  const k3o = ctxWith(FD); ord(k3o, 'S1', cake.code, 4); k3o.world.stores[0].overdue = 120; assert.strictEqual(tier(k3o), 2, 'collection beats a recent order');
  const k3s = ctxWith(FD); ord(k3s, 'S1', cake.code, 4); k3s.planogram.requests.push({ store: 'S1', status: 'OPEN' }); assert.strictEqual(tier(k3s), 2, 'shelf request');
  const k3p = ctxWith(FD); ord(k3p, 'S1', cake.code, 4); k3p.preorders.push({ store: 'S1', status: 'NEW', forDate: ISO, at: { date: ISO } }); assert.strictEqual(tier(k3p), 1, 'pre-order');
  const kl = ctxWith(FD); ord(kl, 'S1', cake.code, 4); kl.recs.push({ store: 'S1', date: ISO, type: 'LAPSED' }); assert.strictEqual(tier(kl), 1, 'due reorder');
  const km = ctxWith(FD); ord(km, 'S1', cake.code, 19); assert.strictEqual(tier(km), 1, 'last order was last month'); // 2026-10-30
  // the real plan
  const vis = st.visits.filter(v => v.date === T && !v.offPlan); assert.ok(vis.length > 50 && vis.every(v => [1, 2, 3].includes(v.tier)));
  for (const v of st.world.vsrs) { const stops = FD.planFor(st, v.id, T).stops; for (let i = 1; i < stops.length; i++) { const a = stops[i - 1], b = stops[i]; assert.ok(a.tier < b.tier || (a.tier === b.tier && a.seq <= b.seq), v.id); } }
  const van = st.world.vsrs.find(v => FD.planFor(st, v.id, T).stops.some(x => x.status === 'PLANNED' && x.tier > 1)); const target = FD.planFor(st, van.id, T).stops.find(x => x.status === 'PLANNED' && x.tier > 1);
  FD.dispatch('PREORDER_ADD', { store: target.store, text: 'x' }); assert.strictEqual(FD.planFor(st, van.id, T).stops.find(x => x.id === target.id).tier, 1);
});

test('payday note', () => {
  const FD = fd(9); const n = FD.paydayNote;
  for (const d of ['2026-10-27', '2026-10-28', '2026-10-31']) assert.strictEqual(n(d), 'PAY_COLLECT');
  for (const d of ['2026-11-01', '2026-11-04', '2026-11-07']) assert.strictEqual(n(d), 'PAY_BIG');
  for (const d of ['2026-10-08', '2026-10-15', '2026-10-26']) assert.strictEqual(n(d), null);
});

test('supervisor filter: team compare, reasons and opportunities take a list of vans', () => {
  const FD = fd(); FD.init(7, { storage: null }); const st = FD.state; const sales = st.world.vsrs.filter(v => v.kind === 'sales').map(v => v.id); const pick = sales.slice(0, 2);
  const all = FD.teamCompare(st, FD.PILOT_START, FD.TODAY), two = FD.teamCompare(st, FD.PILOT_START, FD.TODAY, pick);
  assert.strictEqual(all.length, sales.length); assert.deepStrictEqual(two.map(x => x.rank), [1, 2]); assert.ok(two.every(x => pick.includes(x.vsr)));
  assert.strictEqual(FD.teamCompare(st, FD.PILOT_START, FD.TODAY).length, all.length);
  const tot = f => FD.reasonBreakdown(st, f).reduce((a, g) => a + g.count, 0);
  assert.strictEqual(tot({ vans: sales }), tot({})); assert.ok(tot({ vans: pick }) <= tot({}));
  assert.strictEqual(tot({ vans: pick }), tot({ vsr: pick[0] }) + tot({ vsr: pick[1] }));
  const op = FD.opportunities(st, { vans: pick }); assert.ok(op.length > 0 && op.every(o => pick.includes(st.world.stores.find(s => s.id === o.store).vsr)));
  assert.strictEqual(FD.opportunities(st, { vans: sales }).length, FD.opportunities(st, {}).length);
});

test('storage key and rules', () => {
  const FD = fd(); const keys = []; FD.storageAdapter({ getItem: k => { keys.push(k); return null; } }).get(); assert.deepStrictEqual(keys, ['fielddrive.v7']);
  FD.init(7, { storage: null }); const r = FD.state.rules;
  assert.deepStrictEqual(r.catGap, { cake: 35, other: 38, biscuit: 44, rusk: 44, nuts: 44 }); assert.deepStrictEqual(r.catWindow, { cake: 60, other: 75, biscuit: 90, rusk: 90, nuts: 90 });
  assert.strictEqual(r.cannedLift, 1.1); assert.strictEqual(r.firstFillMax, 3);
  assert.ok(FD.TAGS.every(t => Array.isArray(r.mustStock[t])), 'area assortment has a list per nearby place');
});
