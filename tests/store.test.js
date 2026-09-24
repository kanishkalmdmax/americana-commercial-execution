const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
const L = 6;
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; };
let cached; // one shared fresh boot for read-only checks keeps the suite fast
const boot = () => { const FD = load(L); FD.init(7, { storage: mem() }); return FD; };

test('init is deterministic and has pilot data in every state', () => {
  const FD = boot(); cached = FD; const a = JSON.stringify(FD.state.recs.slice(0, 80));
  const FD2 = boot(); assert.strictEqual(JSON.stringify(FD2.state.recs.slice(0, 80)), a);
  const recs = FD.state.recs;
  assert.ok(recs.length > 1000, 'recs ' + recs.length);
  for (const m of ['SUSTAINED', 'PENDING', 'RETURNED']) assert.ok(recs.some(r => r.maturity === m), m);
  for (const o of ['FULL', 'PARTIAL', 'ALT', 'NOT_SOLD', 'NOT_OFFERED']) assert.ok(recs.some(r => r.outcome === o), o);
  assert.ok(recs.some(r => r.outcome === 'NOT_SOLD' && !r.reason));
  assert.ok(recs.some(r => r.corrected));
  assert.ok(FD.state.misses.length > 0);
  assert.strictEqual(FD.state.clock.date, FD.TODAY);
});
test('today has a plan with recommendations and nothing actioned yet', () => {
  const FD = cached || boot();
  const plan = FD.planFor(FD.state, 'V1', FD.TODAY);
  assert.ok(plan.stops.length >= 7 && plan.stops.length <= 8);
  assert.ok(plan.recs.length > 0 && plan.recs.every(r => r.outcome === null));
});
test('storage throwing or corrupt still boots', () => {
  const FD = load(L);
  FD.init(7, { storage: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} } });
  assert.strictEqual(FD.state.world.stores.length, 90);
  const s = mem(); s.setItem('fielddrive.v1', '{not json'); const FD2 = load(L); FD2.init(7, { storage: s });
  assert.strictEqual(FD2.state.world.stores.length, 90);
});
test('events persist and replay on next load', () => {
  const s = mem(); const FD = load(L); FD.init(7, { storage: s });
  const r = FD.state.recs.find(x => x.outcome === 'NOT_SOLD' && !x.reason);
  FD.dispatch('REASON_SAVE', { key: 'p1', recId: r.id, reason: 'R_NO_SHELF' });
  const FD2 = load(L); FD2.init(7, { storage: s });
  assert.strictEqual(FD2.state.recs.find(x => x.id === r.id).reason, 'R_NO_SHELF');
});
test('reason save is idempotent', () => {
  const FD = boot();
  const r = FD.state.recs.find(x => x.outcome === 'NOT_SOLD' && !x.reason);
  FD.dispatch('REASON_SAVE', { key: 'k1', recId: r.id, reason: 'R_PRICE', comment: 'too dear' });
  FD.dispatch('REASON_SAVE', { key: 'k1', recId: r.id, reason: 'R_PRICE', comment: 'too dear' });
  assert.strictEqual(FD.state.log.filter(e => e.key === 'k1').length, 1);
  assert.strictEqual(FD.recMsgs(FD.state, r.id).filter(m => m.text === 'too dear').length, 1);
});
test('arrival notifies and SalesBuzz order grades today recs', () => {
  const FD = boot();
  const plan = FD.planFor(FD.state, 'V3', FD.TODAY); const stop = plan.stops.find(s => plan.recs.some(r => r.store === s.store));
  FD.dispatch('ARRIVE', { key: 'a1', vsr: 'V3', store: stop.store });
  assert.ok(FD.state.notifs.some(n => n.vsr === 'V3' && n.tpl.startsWith('N_ARRIVE')));
  FD.dispatch('SB_ORDER', { key: 'o1', vsr: 'V3', store: stop.store, mode: 'FULL' });
  const today = FD.state.recs.filter(r => r.store === stop.store && r.date === FD.TODAY);
  assert.ok(today.length && today.every(r => r.outcome === 'FULL' && r.maturity === 'PENDING'));
  assert.ok(FD.state.notifs.some(n => n.tpl === 'N_SOLD'));
});
test('delayed order waits, then grades on delivery; edit re-grades as corrected', () => {
  const FD = boot();
  const plan = FD.planFor(FD.state, 'V2', FD.TODAY); const stop = plan.stops.find(s => plan.recs.some(r => r.store === s.store));
  FD.dispatch('SB_ORDER_DELAY', { on: true });
  FD.dispatch('SB_ORDER', { key: 'o2', vsr: 'V2', store: stop.store, mode: 'NOT_SOLD' });
  const recs = () => FD.state.recs.filter(r => r.store === stop.store && r.date === FD.TODAY);
  assert.ok(recs().every(r => r.outcome === 'WAITING'));
  FD.dispatch('SB_DELIVER_DELAYED', { store: stop.store });
  assert.ok(recs().every(r => r.outcome === 'NOT_SOLD'));
  FD.dispatch('SB_ORDER_EDIT', { store: stop.store });
  assert.ok(recs().every(r => r.corrected && r.prevOutcome === 'NOT_SOLD' && r.outcome === 'FULL'));
});
test('block removes a live rec and cannot come back through regeneration', () => {
  const FD = boot();
  const rec = FD.planFor(FD.state, 'V1', FD.TODAY).recs[0];
  FD.dispatch('BLOCK_ADD', { key: 'b1', recId: rec.id });
  assert.ok(!FD.planFor(FD.state, 'V1', FD.TODAY).recs.some(r => r.id === rec.id));
  assert.ok(FD.state.notifs.some(n => n.tpl === 'N_REMOVED'));
  FD.dispatch('RULE_SET', { key: 'rs', rule: 'lapsedDays', value: 22 });
  assert.ok(!FD.planFor(FD.state, 'V1', FD.TODAY).recs.some(r => r.store === rec.store && r.sku === rec.sku));
});
test('rule change regenerates unactioned recs for today', () => {
  const FD = boot();
  FD.dispatch('RULE_SET', { key: 'm1', rule: 'maxPerStore', value: 1 });
  for (const v of FD.state.world.vsrs) {
    const plan = FD.planFor(FD.state, v.id, FD.TODAY);
    for (const s of plan.stops) assert.ok(plan.recs.filter(r => r.store === s.store).length <= 1);
  }
});
test('clock forward simulates, backwards keeps data', () => {
  const FD = boot(); const n = FD.state.recs.length;
  FD.dispatch('CLOCK_SET', { date: '2026-11-19', time: '07:00' });
  const n2 = FD.state.recs.length; assert.ok(n2 > n);
  assert.ok(FD.state.recs.filter(r => r.date === FD.TODAY).every(r => r.outcome !== null || r.blockedAt));
  FD.dispatch('CLOCK_SET', { date: '2026-11-17', time: '07:00' });
  assert.strictEqual(FD.state.recs.length, n2);
});
test('evening with missing reasons sends end-of-day nudge once', () => {
  const FD = boot();
  const plan = FD.planFor(FD.state, 'V4', FD.TODAY); const stop = plan.stops.find(s => plan.recs.some(r => r.store === s.store));
  FD.dispatch('SB_ORDER', { key: 'o3', vsr: 'V4', store: stop.store, mode: 'NOT_SOLD' });
  FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '19:00' });
  FD.dispatch('CLOCK_SET', { date: FD.TODAY, time: '21:30' });
  assert.strictEqual(FD.state.notifs.filter(n => n.vsr === 'V4' && n.tpl === 'N_EOD').length, 1);
});
test('offline queues and syncs on reconnect', () => {
  const FD = boot(); let toast = null; FD.bus.on('toast', t => { toast = t; });
  FD.dispatch('OFFLINE_SET', { on: true });
  const r = FD.state.recs.find(x => x.outcome === 'NOT_SOLD' && !x.reason);
  FD.dispatch('REASON_SAVE', { key: 'q1', recId: r.id, reason: 'R_ENOUGH' });
  assert.strictEqual(FD.state.queue.length, 1);
  FD.dispatch('OFFLINE_SET', { on: false });
  assert.strictEqual(FD.state.queue.length, 0);
  assert.strictEqual(toast.id, 'S_SYNCED');
});
test('chat: a store message goes into the salesman one-on-one, tagged with the store; reply notifies', () => {
  const FD = boot(); const v = FD.state.world.stores.find(x => x.id === 'ST-001').vsr;
  FD.dispatch('MSG_SEND', { key: 'm1', anchor: { type: 'store', id: 'ST-001' }, by: v, text: 'Return pickup please', topic: 'R_T_RETURN' });
  const th = FD.state.threads.find(t => t.anchor.type === 'vsr' && t.anchor.id === v);
  assert.ok(th && th.unreadSup); assert.strictEqual(th.messages[th.messages.length - 1].store, 'ST-001');
  assert.ok(FD.state.threads.every(t => t.anchor.type === 'vsr' || t.anchor.type === 'team'), 'only one-on-one and team threads');
  FD.dispatch('MSG_SEND', { key: 'm2', anchor: { type: 'store', id: 'ST-001' }, by: 'SUP', text: 'Noted', qr: 'QR_NOTED' });
  assert.ok(FD.state.notifs.some(n => n.vsr === v && n.tpl === 'N_REPLY_STORE'));
  FD.dispatch('MSG_SEND', { key: 'm3', anchor: { type: 'team', id: 'ALL' }, by: 'SUP', text: 'Promo Sunday' });
  const team = FD.state.threads.find(t => t.team); assert.ok(FD.state.world.vsrs.every(x => team.unreadVsrs[x.id]));
  FD.dispatch('THREAD_READ', { key: 'm4', thread: team.id, who: 'VSR', vsr: 'V2' }); assert.ok(!team.unreadVsrs.V2 && team.unreadVsrs.V1);
});
test('covering VSR receives the covered route stops', () => {
  const FD = boot();
  FD.dispatch('COVER_SET', { key: 'c1', date: FD.TODAY, route: 'R1', vsr: 'V4' });
  const p4 = FD.planFor(FD.state, 'V4', FD.TODAY), p1 = FD.planFor(FD.state, 'V1', FD.TODAY);
  assert.ok(p4.stops.some(s => s.route === 'R1'));
  assert.strictEqual(p1.stops.length, 0);
});
// ---- final-review regressions ----
const todayStopWithRecs = (FD, v, n = 1) => { const pl = FD.planFor(FD.state, v, FD.state.clock.date); return pl.stops.find(x => x.status === 'PLANNED' && pl.recs.filter(r => r.store === x.store && r.outcome === null).length >= n); };
test('C1: rule change keeps viewed/edited/threaded recs; follow-ups survive', () => {
  const FD = boot(); require('../src/05_metrics.js'); require('../src/05b_followups.js');
  const stop = todayStopWithRecs(FD, 'V3'); const rec = FD.state.recs.find(r => r.store === stop.store && r.date === FD.TODAY && r.outcome === null);
  FD.dispatch('REC_QTY', { key: 'q', recId: rec.id, qty: 2 });
  FD.dispatch('MSG_SEND', { key: 'm', anchor: { type: 'rec', id: rec.id }, by: 'V3', text: 'hi' });
  FD.dispatch('RULE_SET', { key: 'r', rule: 'lapsedDays', value: 25 });
  const again = FD.state.recs.find(r => r.id === rec.id);
  assert.ok(again && again.qtyModified === 2);
  assert.doesNotThrow(() => FD.followUps(FD.state));
});
test('C2: a second SalesBuzz order for a finished visit changes nothing', () => {
  const FD = boot(); const stop = todayStopWithRecs(FD, 'V3');
  FD.dispatch('SB_ORDER', { key: 'o1', vsr: 'V3', store: stop.store, mode: 'FULL' });
  const n = FD.state.orders.length; const outs = () => FD.state.recs.filter(r => r.store === stop.store && r.date === FD.TODAY).map(r => r.outcome).join();
  const before = outs();
  FD.dispatch('SB_ORDER', { key: 'o2', vsr: 'V3', store: stop.store, mode: 'NOT_SOLD' });
  assert.strictEqual(outs(), before); assert.strictEqual(FD.state.orders.length, n);
});
test('I1: random SalesBuzz outcome depends on the event, not on local log length', () => {
  const run = extra => { const FD = boot(); if (extra) FD.dispatch('SET_LANG', { lang: 'ar' }); const stop = todayStopWithRecs(FD, 'V1');
    FD.dispatch('SB_ORDER', { key: 'same-key', vsr: 'V1', store: stop.store, mode: 'RANDOM' });
    return FD.state.orders.filter(o => o.store === stop.store && o.date === FD.TODAY).map(o => o.sku + o.units).join(); };
  assert.strictEqual(run(false), run(true));
});
test('I2: delayed order delivered on a later day does not throw', () => {
  const FD = boot(); const stop = todayStopWithRecs(FD, 'V2');
  FD.dispatch('SB_ORDER_DELAY', { key: 'd', on: true }); FD.dispatch('SB_ORDER', { key: 'o', vsr: 'V2', store: stop.store, mode: 'FULL' });
  FD.dispatch('CLOCK_SET', { key: 'c', date: '2026-11-19', time: '07:00' });
  assert.doesNotThrow(() => FD.dispatch('SB_DELIVER_DELAYED', { key: 'dl' }));
  assert.strictEqual(Object.keys(FD.state.pendingOrders).length, 0);
});
test('I3: same-day return sticks as RETURNED', () => {
  const FD = boot(); const stop = todayStopWithRecs(FD, 'V6');
  FD.dispatch('SB_ORDER', { key: 'o', vsr: 'V6', store: stop.store, mode: 'FULL' });
  FD.dispatch('RETURN_ADD', { key: 'r' }); FD.dispatch('CLOCK_SET', { key: 'c', date: FD.TODAY, time: '13:00' });
  assert.ok(FD.state.recs.some(r => r.date === FD.TODAY && r.maturity === 'RETURNED'));
});
// ---- Revision 2 ----
const loadAll = () => { const FD = load(8); FD.init(7, { storage: mem() }); return FD; };
test('R2-Q3: not-followed reasons never count against conversion', () => {
  const FD = loadAll(); const stop = todayStopWithRecs(FD, 'V3', 2); const recs = FD.state.recs.filter(r => r.store === stop.store && r.date === FD.TODAY && r.outcome === null);
  FD.dispatch('REC_NOT_OFFERED', { key: 'n', recId: recs[0].id, reason: 'NF_TIME' });
  FD.dispatch('SB_ORDER', { key: 'o', vsr: 'V3', store: stop.store, mode: 'FULL' });
  const m = FD.vsrMetrics(FD.state, 'V3', FD.TODAY, FD.TODAY);
  assert.strictEqual(m.upsellConv, 100); assert.ok(m.notFollowedPct > 0);
  assert.ok(FD.CATALOG.NF_TIME && FD.state.recs.find(r => r.id === recs[0].id).reason === 'NF_TIME');
});
test('R2-Q4: temporary reason stays open and sells on a same-day revisit', () => {
  const FD = loadAll(); const stop = todayStopWithRecs(FD, 'V2'); const store = stop.store;
  FD.dispatch('SB_ORDER', { key: 'o1', vsr: 'V2', store, mode: 'NOT_SOLD' });
  const rec = FD.state.recs.find(r => r.store === store && r.date === FD.TODAY && r.outcome === 'NOT_SOLD');
  FD.dispatch('REASON_SAVE', { key: 'r', recId: rec.id, reason: 'R_BUYER_ABSENT' });
  FD.dispatch('REVISIT_ADD', { key: 'v', vsr: 'V2', store, when: 'today' });
  const stops = FD.planFor(FD.state, 'V2', FD.TODAY).stops.filter(s => s.store === store);
  assert.strictEqual(stops.length, 2); assert.ok(stops[1].revisit);
  FD.dispatch('SB_ORDER', { key: 'o2', vsr: 'V2', store, mode: 'FULL' });
  const after = FD.state.recs.find(r => r.id === rec.id);
  assert.strictEqual(after.outcome, 'FULL'); assert.ok(after.revisit); assert.strictEqual(after.firstReason, 'R_BUYER_ABSENT');
});
test('R2-Q4: revisit on the next day carries the open rec and does not duplicate it', () => {
  const FD = loadAll(); const stop = todayStopWithRecs(FD, 'V2'); const store = stop.store;
  FD.dispatch('SB_ORDER', { key: 'o1', vsr: 'V2', store, mode: 'NOT_SOLD' });
  const rec = FD.state.recs.find(r => r.store === store && r.date === FD.TODAY && r.outcome === 'NOT_SOLD');
  FD.dispatch('REASON_SAVE', { key: 'r', recId: rec.id, reason: 'R_CREDIT' });
  FD.dispatch('REVISIT_ADD', { key: 'v', vsr: 'V2', store, when: 'next' });
  FD.dispatch('CLOCK_SET', { key: 'c', date: '2026-11-19', time: '07:00' });
  const plan = FD.planFor(FD.state, 'V2', '2026-11-19');
  assert.ok(plan.stops.some(s => s.store === store && s.revisit));
  assert.ok(!plan.recs.some(r => r.store === store && r.sku === rec.sku && r.id !== rec.id), 'no duplicate rec for the open sku');
  FD.dispatch('SB_ORDER', { key: 'o2', vsr: 'V2', store, mode: 'FULL' });
  assert.ok(['FULL', 'PARTIAL'].includes(FD.state.recs.find(r => r.id === rec.id).outcome));
});
test('R2-Q1: reassign a store to another salesman from the next day, marked pending SalesBuzz', () => {
  const FD = loadAll(); const s = FD.state.world.stores.find(x => x.vsr === 'V1' && x.days.includes(FD.dow('2026-11-19')));
  const todayStops = FD.planFor(FD.state, 'V1', FD.TODAY).stops.map(x => x.store).join();
  FD.dispatch('STORE_ASSIGN', { key: 'a', store: s.id, vsr: 'V3' });
  assert.strictEqual(FD.state.world.stores.find(x => x.id === s.id).vsr, 'V3'); assert.ok(FD.state.sbPending.some(p => p.store === s.id));
  assert.strictEqual(FD.planFor(FD.state, 'V1', FD.TODAY).stops.map(x => x.store).join(), todayStops, 'today unchanged');
  FD.dispatch('CLOCK_SET', { key: 'c', date: '2026-11-19', time: '07:00' });
  assert.ok(FD.planFor(FD.state, 'V3', '2026-11-19').stops.some(x => x.store === s.id));
  assert.ok(!FD.planFor(FD.state, 'V1', '2026-11-19').stops.some(x => x.store === s.id));
});
test('R2-Q2: general conversation and follow-up', () => {
  const FD = loadAll();
  FD.dispatch('MSG_SEND', { key: 'g', anchor: { type: 'vsr', id: 'V4' }, by: 'V4', text: 'Van AC not working' });
  assert.ok(FD.followUps(FD.state).some(f => f.tpl === 'F_VSR_MSG'));
  FD.dispatch('MSG_SEND', { key: 'g2', anchor: { type: 'vsr', id: 'V4' }, by: 'SUP', text: 'Take van 7 tomorrow' });
  assert.ok(FD.state.notifs.some(n => n.vsr === 'V4' && n.tpl === 'N_MSG'));
});
test('R2-d: a metric switched off leaves the composite', () => {
  const FD = loadAll();
  FD.dispatch('WEIGHTS_SET', { key: 'w', weights: { net: 30, pvr: 20, drop: 15, xsell: 20, action: 15 }, off: { net: true, pvr: true, drop: true, action: true } });
  const m = FD.vsrMetrics(FD.state, 'V1', FD.PILOT_START, FD.TODAY); assert.ok(Math.abs(m.composite - m.score.xsell) < 0.01);
});
test('R2-Q5 + response: per-store product stats and response segment', () => {
  const FD = loadAll(); const st = FD.state.world.stores.find(x => Object.keys(x.carry).length > 3);
  const rows = FD.storeSkuStats(FD.state, st.id, FD.TODAY); const any = rows.find(x => x.units4w > 0);
  assert.ok(any && any.lastDate && any.lastQty > 0 && any.avgVisit > 0 && any.cover >= 0);
  const r = FD.storeResponse(FD.state, st.id); assert.ok(['SEG_RECEPTIVE', 'SEG_SELECTIVE', 'SEG_RESISTANT', 'SEG_NEW'].includes(r.segment));
});
// ---- Revision 2 review regressions ----
const tempNotSold = (FD, v, reason = 'R_BUYER_ABSENT') => { const stop = todayStopWithRecs(FD, v); FD.dispatch('SB_ORDER', { key: 'o1' + v, vsr: v, store: stop.store, mode: 'NOT_SOLD' });
  const rec = FD.state.recs.find(r => r.store === stop.store && r.date === FD.TODAY && r.outcome === 'NOT_SOLD'); FD.dispatch('REASON_SAVE', { key: 'r' + v, recId: rec.id, reason }); return { store: stop.store, rec }; };
test('RC1: a same-day revisit does not double the store day in net sales or visits', () => {
  const FD = loadAll(); const { store } = tempNotSold(FD, 'V2');
  const before = FD.vsrMetrics(FD.state, 'V2', FD.TODAY, FD.TODAY);
  FD.dispatch('REVISIT_ADD', { key: 'v', vsr: 'V2', store, when: 'today' }); FD.dispatch('SB_ORDER', { key: 'o2', vsr: 'V2', store, mode: 'FULL' });
  const after = FD.vsrMetrics(FD.state, 'V2', FD.TODAY, FD.TODAY);
  const dayValue = FD.SKUS.reduce((a, k) => a + FD.storeOrders(FD.state, store, k.code).filter(o => o.date === FD.TODAY && o.units > 0).reduce((b, o) => b + o.value, 0), 0);
  assert.ok(Math.abs(after.net + after.returnsValue - dayValue) < 0.01, (after.net + after.returnsValue) + ' vs ' + dayValue); assert.strictEqual(after.genuine, before.genuine);
});
test('RC2: next-day revisit sale starts its 28-day check on the sale day', () => {
  const FD = loadAll(); const { store, rec } = tempNotSold(FD, 'V2', 'R_CREDIT');
  FD.dispatch('REVISIT_ADD', { key: 'v', vsr: 'V2', store, when: 'next' }); FD.dispatch('CLOCK_SET', { key: 'c', date: '2026-11-19', time: '07:00' });
  FD.dispatch('SB_ORDER', { key: 'o2', vsr: 'V2', store, mode: 'FULL' }); FD.dispatch('CLOCK_SET', { key: 'c2', date: '2026-11-19', time: '13:00' });
  assert.strictEqual(FD.state.recs.find(r => r.id === rec.id).maturity, 'PENDING');
});
test('RI1: a rule change does not duplicate a carried open recommendation', () => {
  const FD = loadAll(); const { store, rec } = tempNotSold(FD, 'V2', 'R_CREDIT');
  FD.dispatch('REVISIT_ADD', { key: 'v', vsr: 'V2', store, when: 'next' }); FD.dispatch('CLOCK_SET', { key: 'c', date: '2026-11-19', time: '07:00' });
  FD.dispatch('RULE_SET', { key: 'rs', rule: 'lapsedDays', value: 21 });
  assert.ok(!FD.state.recs.some(r => r.store === store && r.date === '2026-11-19' && r.sku === rec.sku));
});
test('RI2+RI3: delayed revisit order grades the carried rec on the revisit and never sticks in WAITING', () => {
  const FD = loadAll(); const { store, rec } = tempNotSold(FD, 'V2');
  FD.dispatch('REVISIT_ADD', { key: 'v', vsr: 'V2', store, when: 'today' });
  FD.dispatch('SB_ORDER_DELAY', { key: 'd', on: true }); FD.dispatch('SB_ORDER', { key: 'o2', vsr: 'V2', store, mode: 'FULL' });
  assert.strictEqual(FD.state.recs.find(r => r.id === rec.id).outcome, 'WAITING');
  FD.dispatch('SB_DELIVER_DELAYED', { key: 'dl' });
  const r = FD.state.recs.find(x => x.id === rec.id); assert.strictEqual(r.outcome, 'FULL'); assert.ok(r.revisit); assert.strictEqual(r.firstReason, 'R_BUYER_ABSENT');
  const v2 = loadAll(); const t2 = tempNotSold(v2, 'V4'); v2.dispatch('REVISIT_ADD', { key: 'v', vsr: 'V4', store: t2.store, when: 'next' });
  v2.dispatch('CLOCK_SET', { key: 'c', date: '2026-11-19', time: '07:00' }); v2.dispatch('SB_ORDER_DELAY', { key: 'd', on: true }); v2.dispatch('SB_ORDER', { key: 'o2', vsr: 'V4', store: t2.store, mode: 'FULL' });
  v2.dispatch('CLOCK_SET', { key: 'c2', date: '2026-11-21', time: '07:00' });
  assert.notStrictEqual(v2.state.recs.find(x => x.id === t2.rec.id).outcome, 'WAITING');
});
test('RI3: skipping the revisit stop skips the revisit, not the finished first visit', () => {
  const FD = loadAll(); const { store } = tempNotSold(FD, 'V2');
  FD.dispatch('REVISIT_ADD', { key: 'v', vsr: 'V2', store, when: 'today' });
  const rv = FD.planFor(FD.state, 'V2', FD.TODAY).stops.find(s => s.store === store && s.revisit);
  FD.dispatch('STOP_SKIP', { key: 's', store, visitId: rv.id, reason: 'SK_CLOSED' });
  const vs = FD.state.visits.filter(v => v.store === store && v.date === FD.TODAY);
  assert.deepStrictEqual(vs.map(v => v.status), ['DONE', 'SKIPPED']);
});
test('RI4: reassigning a store keeps today\'s recommendations as planned for today\'s salesman', () => {
  const FD = loadAll(); const stop = todayStopWithRecs(FD, 'V1'); const ids = () => FD.state.recs.filter(r => r.store === stop.store && r.date === FD.TODAY).map(r => r.sku).sort().join();
  const before = ids(); FD.dispatch('STORE_ASSIGN', { key: 'a', store: stop.store, vsr: 'V3' });
  assert.strictEqual(ids(), before);
});
test('RI5: reassignment does not rewrite past net sales', () => {
  const FD = loadAll(); const n1 = FD.vsrMetrics(FD.state, 'V1', FD.PILOT_START, FD.TODAY).net, n2 = FD.vsrMetrics(FD.state, 'V2', FD.PILOT_START, FD.TODAY).net;
  FD.dispatch('ROUTE_ASSIGN', { key: 'ra', route: 'R1', vsr: 'V2' });
  assert.ok(Math.abs(FD.vsrMetrics(FD.state, 'V1', FD.PILOT_START, FD.TODAY).net - n1) < 0.01); assert.ok(Math.abs(FD.vsrMetrics(FD.state, 'V2', FD.PILOT_START, FD.TODAY).net - n2) < 0.01);
});
test('RI6: not-followed reasons are never counted as declines', () => {
  const FD = loadAll(); const r0 = FD.state.recs.find(r => r.date === FD.TODAY && r.outcome === null); const sku = r0.sku;
  const pl = []; for (const v of FD.state.world.vsrs) FD.planFor(FD.state, v.id, FD.TODAY).recs.filter(r => r.sku === sku && r.outcome === null).forEach(r => pl.push(r));
  let i = 0; for (const r of FD.state.recs.filter(x => x.sku === sku && x.date < FD.TODAY && FD.daysBetween(x.date, FD.TODAY) < 7).slice(0, 6)) { r.outcome = 'NOT_OFFERED'; r.reason = 'NF_FIT'; i++; }
  FD.state.dv++;
  assert.ok(!FD.followUps(FD.state).some(f => f.tpl === 'F_REPEAT_DECLINE' && f.slots.reasonCode && f.slots.reasonCode.startsWith('NF_')));
});
test('R3: an assigned store not on today plan can be added as an off-plan visit, once, with recs and a plan-change record', () => {
  const FD = loadAll(); const onPlan = new Set(FD.planFor(FD.state, 'V2', FD.TODAY).stops.map(s => s.store));
  const s = FD.state.world.stores.find(x => x.vsr === 'V2' && !onPlan.has(x.id) && FD.recommend(FD.state, x.id, FD.TODAY, 'V2').recs.length);
  FD.dispatch('OFFPLAN_ADD', { key: 'op', vsr: 'V2', store: s.id }); FD.dispatch('OFFPLAN_ADD', { key: 'op2', vsr: 'V2', store: s.id });
  const stops = FD.planFor(FD.state, 'V2', FD.TODAY).stops.filter(x => x.store === s.id);
  assert.strictEqual(stops.length, 1); assert.ok(stops[0].offPlan);
  assert.ok(FD.state.recs.some(r => r.store === s.id && r.date === FD.TODAY));
  assert.ok(FD.state.planChanges.some(c => c.store === s.id && c.reason === 'SK_OFFPLAN'));
});
