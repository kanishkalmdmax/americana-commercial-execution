const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
const mem = () => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } }; };
const boot = () => { const FD = load(8); FD.init(7, { storage: mem() }); return FD; };
const stopWith = (FD, v, n) => { const pl = FD.planFor(FD.state, v, FD.TODAY); return pl.stops.find(x => x.status === 'PLANNED' && pl.recs.filter(r => r.store === x.store && r.outcome === null).length >= n); };
const live = (FD, store) => FD.state.recs.filter(r => r.store === store && r.date === FD.TODAY && !r.blockedAt);
const newSku = (FD, store) => FD.SKUS.find(k => !FD.state.recs.some(r => r.store === store && r.date === FD.TODAY && r.sku === k.code)).code;

test('FR2: a supervisor-added product does not push out an engine rec on the next rule save', () => {
  const FD = boot(); const s = stopWith(FD, 'V2', 3).store; const before = live(FD, s).map(r => r.sku);
  FD.dispatch('SUP_REC_ADD', { key: 'a', store: s, sku: newSku(FD, s), qty: 1 });
  FD.dispatch('RULE_SET', { key: 'r', rule: 'cooldownDays', value: FD.state.rules.cooldownDays });
  const after = live(FD, s).map(r => r.sku); assert.ok(before.every(id => after.includes(id)), 'engine recs kept'); assert.strictEqual(after.length, before.length + 1);
});
test('FR3: restoring a removed rec is refused when the same product was added again', () => {
  const FD = boot(); const s = stopWith(FD, 'V2', 1).store; const r = live(FD, s)[0];
  FD.dispatch('SUP_REC_REMOVE', { key: 'x', recId: r.id }); FD.dispatch('SUP_REC_ADD', { key: 'a', store: s, sku: r.sku, qty: 1 }); FD.dispatch('SUP_REC_RESTORE', { key: 'y', recId: r.id });
  assert.strictEqual(live(FD, s).filter(x => x.sku === r.sku).length, 1);
});
test('FR4: re-adding a supervisor-removed stop restores it instead of making a second visit', () => {
  const FD = boot(); const s = stopWith(FD, 'V2', 1).store;
  FD.dispatch('SUP_STOP_REMOVE', { key: 'x', store: s }); FD.dispatch('OFFPLAN_ADD', { key: 'a', vsr: 'V2', store: s, bySup: true }); FD.dispatch('SUP_STOP_RESTORE', { key: 'y', store: s });
  assert.strictEqual(FD.state.visits.filter(v => v.date === FD.TODAY && v.store === s && v.status === 'PLANNED').length, 1);
});
test('FR5: a supervisor add on a covered route goes to the covering salesman', () => {
  const FD = boot(); const s = stopWith(FD, 'V2', 1).store; const route = FD.state.visits.find(v => v.date === FD.TODAY && v.store === s).route;
  FD.dispatch('COVER_SET', { key: 'c', route, vsr: 'V3' }); FD.dispatch('SUP_REC_ADD', { key: 'a', store: s, sku: newSku(FD, s), qty: 1 });
  const r = FD.state.recs[FD.state.recs.length - 1]; assert.strictEqual(FD.recVsr(r), 'V3');
});
test('FR7: the message follow-up quotes the salesman, and a supervisor reply clears it', () => {
  const FD = boot(); FD.dispatch('MSG_SEND', { key: 'm', anchor: { type: 'vsr', id: 'V3' }, by: 'V3', text: 'Van is short on rusks' });
  let f = FD.followUps(FD.state).find(x => x.key.startsWith('F_VSR_MSG') && x.slots.vsrId === 'V3'); assert.ok(f && f.slots.snippet.includes('rusks'));
  FD.dispatch('MSG_SEND', { key: 'n', anchor: { type: 'vsr', id: 'V3' }, by: 'SUP', text: 'OK' });
  assert.ok(!FD.followUps(FD.state).some(x => x.key.startsWith('F_VSR_MSG') && x.slots.vsrId === 'V3'));
});
test('FR8: records with a deleted custom reason stay in reports', () => {
  const FD = boot(); FD.dispatch('REASON_ADD', { key: 'a', group: 'RG_MONEY', en: 'Too dear' });
  const r = FD.state.recs.find(x => x.outcome === 'NOT_SOLD' && !x.reason); FD.dispatch('REASON_SAVE', { key: 's', recId: r.id, reason: 'RC_1' });
  FD.dispatch('REASON_HIDE', { key: 'h', id: 'RC_1', hide: true });
  assert.ok(FD.REASON_GROUPS.RG_MONEY.includes('RC_1')); assert.ok(!FD.reasonPick('RG_MONEY').includes('RC_1'));
});
