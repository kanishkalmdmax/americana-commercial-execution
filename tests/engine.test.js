const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
const L = 5;
function ctxWith(FD, patch = {}) {
  const store = { id: 'S1', route: 'R1', vsr: 'V1', label: 'B', size: 'SMALL', tags: ['TAG_SCHOOL'], shelf: 'med', credit: 'OK', onboarding: 'APPROVED', days: [6, 1, 3] };
  const peers = Array.from({ length: 10 }, (_, i) => ({ ...store, id: 'P' + i }));
  const orders = [];
  peers.forEach(p => orders.push({ store: p.id, sku: '3040430754', date: '2026-11-10', units: 2 }));
  ['2026-10-05', '2026-10-12', '2026-10-19'].forEach(d => orders.push({ store: 'S1', sku: '3040421779', date: d, units: 2 }));
  return Object.assign({ world: { stores: [store, ...peers], promos: [] }, orders, returns: [], recs: [],
    rules: { lapsedDays: 21, cooldownDays: 14, maturityDays: 28, maxPerStore: 3, firstFillMax: 1, vanFeed: true },
    blocks: [], pins: [], watchlist: [], vanStock: { V1: Object.fromEntries(FD.SKUS.map(s => [s.code, 10])) } }, patch);
}
test('lapsed and gap candidates are found', () => {
  const FD = load(L); const c = FD.candidates(ctxWith(FD), 'S1', '2026-11-18');
  assert.ok(c.find(x => x.type === 'LAPSED' && x.sku === '3040421779'));
  assert.ok(c.find(x => x.type === 'GAP' && x.sku === '3040430754'));
});
test('hard gates remove candidates', () => {
  const FD = load(L);
  const blocked = ctxWith(FD); blocked.world.stores[0].credit = 'BLOCKED';
  assert.strictEqual(FD.recommend(blocked, 'S1', '2026-11-18').recs.length, 0);
  const noVan = ctxWith(FD); noVan.vanStock.V1['3040430754'] = 0;
  assert.ok(FD.recommend(noVan, 'S1', '2026-11-18').gated.some(g => g.gate === 'GATE_VAN'));
  const feedOff = ctxWith(FD); feedOff.rules.vanFeed = false; feedOff.vanStock.V1['3040430754'] = 0;
  assert.ok(FD.recommend(feedOff, 'S1', '2026-11-18').recs.some(r => r.sku === '3040430754'));
});
test('cooldown after a real no, not after buyer absent', () => {
  const FD = load(L);
  const c = ctxWith(FD, { recs: [{ store: 'S1', sku: '3040430754', date: '2026-11-10', outcome: 'NOT_SOLD', reason: 'R_PRICE' }] });
  assert.ok(FD.recommend(c, 'S1', '2026-11-18').gated.some(g => g.gate === 'GATE_COOLDOWN'));
  c.recs[0].reason = 'R_BUYER_ABSENT';
  assert.ok(!FD.recommend(c, 'S1', '2026-11-18').gated.some(g => g.gate === 'GATE_COOLDOWN'));
});
test('max 3, promo only in last slot, first fill capped at 1', () => {
  const FD = load(L); const c = ctxWith(FD);
  c.world.promos = [{ id: 'P', skus: ['3040421779'], promoId: 'PROMO_SR_10', start: '2026-11-01', end: '2026-11-30' }];
  const out = FD.recommend(c, 'S1', '2026-11-18').recs;
  assert.ok(out.length >= 1 && out.length <= 3);
  out.forEach((r, i) => { if (r.type === 'PROMO') assert.strictEqual(i, out.length - 1); });
  const gap = out.find(r => r.type === 'GAP'); assert.ok(gap); assert.strictEqual(gap.qty, 1);
});
test('blocks and watchlist gate; pin overrides watchlist', () => {
  const FD = load(L);
  const b = ctxWith(FD, { blocks: [{ sku: '3040430754' }] });
  assert.ok(FD.recommend(b, 'S1', '2026-11-18').gated.some(g => g.gate === 'GATE_BLOCKED'));
  const w = ctxWith(FD, { watchlist: ['3040430754'] });
  assert.ok(FD.recommend(w, 'S1', '2026-11-18').gated.some(g => g.gate === 'GATE_WATCH'));
  w.pins = [{ sku: '3040430754' }];
  assert.ok(FD.recommend(w, 'S1', '2026-11-18').recs.some(r => r.sku === '3040430754' && r.pinned));
});
test('grading: full, partial, alternative, not sold, modified qty', () => {
  const FD = load(L);
  const rec = { sku: '3040430754', qty: 2 };
  assert.strictEqual(FD.grade(rec, [{ sku: '3040430754', units: 2 }], []).outcome, 'FULL');
  assert.deepStrictEqual(FD.grade(rec, [{ sku: '3040430754', units: 1 }], []), { outcome: 'PARTIAL', got: 1, alt: null });
  assert.strictEqual(FD.grade(rec, [{ sku: '3040430756', units: 1 }], []).outcome, 'ALT');
  assert.strictEqual(FD.grade(rec, [{ sku: '3040430756', units: 1 }], [{ sku: '3040430756' }]).outcome, 'NOT_SOLD');
  assert.strictEqual(FD.grade(rec, [], []).outcome, 'NOT_SOLD');
  assert.strictEqual(FD.grade({ ...rec, qtyModified: 1 }, [{ sku: '3040430754', units: 1 }], []).outcome, 'FULL');
});
test('maturity: pending, sustained on repeat, returned on return', () => {
  const FD = load(L);
  const rec = { store: 'S1', sku: 'X', date: '2026-11-01', outcome: 'FULL' };
  const ctx = { orders: [], returns: [], rules: { maturityDays: 28 } };
  assert.strictEqual(FD.maturity(ctx, rec, '2026-11-10'), 'PENDING');
  ctx.orders.push({ store: 'S1', sku: 'X', date: '2026-11-08' });
  assert.strictEqual(FD.maturity(ctx, rec, '2026-11-10'), 'SUSTAINED');
  ctx.returns.push({ store: 'S1', sku: 'X', date: '2026-11-09' });
  assert.strictEqual(FD.maturity(ctx, rec, '2026-11-10'), 'RETURNED');
  assert.strictEqual(FD.maturity(ctx, { ...rec, outcome: 'NOT_SOLD' }, '2026-11-10'), null);
});
test('engine misses: unrecommended new SKU and alternative', () => {
  const FD = load(L);
  const ctx = { orders: [{ store: 'S1', sku: '3040421754', date: '2026-10-01' }] };
  const misses = FD.engineMisses(ctx, 'S1', '2026-11-18',
    [{ sku: '3040421650', units: 1 }, { sku: '3040421754', units: 1 }],
    [{ sku: '3040430754', outcome: 'ALT', alt: '3040430756' }]);
  assert.ok(misses.some(m => m.type === 'UNREC' && m.sku === '3040421650'));
  assert.ok(!misses.some(m => m.sku === '3040421754'));
  assert.ok(misses.some(m => m.type === 'ALT' && m.sku === '3040430756' && m.recSku === '3040430754'));
});
