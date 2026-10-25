const test = require('node:test'); const assert = require('node:assert'); const load = require('./load');
const boot = () => { const FD = load(); FD.init(7, { storage: null }); return FD; };

test('seeded WhatsApp cards: visit notices for today, about a third answered, every rule reply present', () => {
  const FD = boot(); const st = FD.state; const visit = st.ownerMsgs.filter(m => m.card === 'VISIT');
  assert.ok(visit.length > 50 && visit.every(m => m.slots.date === FD.TODAY));
  const rate = visit.filter(m => m.reply).length / visit.length; assert.ok(rate > 0.2 && rate < 0.5, String(rate));
  const choices = new Set(FD.waReplies(st).map(r => r.choice));
  for (const c of ['W_R_NOT', 'W_R_CHANGE', 'W_R_PAID', 'W_R_PAYVISIT', 'W_R_POOR', 'W_R_YES', 'W_R_ADD']) assert.ok(choices.has(c), c);
});
test('replies drive fixed rules: pre-order, plan check, follow-ups, stop chips', () => {
  const FD = boot(); const st = FD.state;
  const not = FD.waReplies(st).find(r => r.choice === 'W_R_NOT'); const vsr = st.visits.find(v => v.date === FD.TODAY && v.store === not.store && !v.offPlan).vsr;
  assert.ok(FD.dispatchExceptions(st, vsr, FD.TODAY).some(x => x.type === 'X_OWNER_NOT' && x.store === not.store));
  const chg = FD.waReplies(st).find(r => r.choice === 'W_R_CHANGE'); assert.ok(st.preorders.some(p => p.store === chg.store && p.forDate === FD.TODAY));
  const fu = FD.followUps(st).map(f => f.tpl); for (const t of ['F_WA_PAID', 'F_WA_POOR']) assert.ok(fu.includes(t), t);
  assert.ok(FD.waStopFacts(st, not.store, FD.TODAY).length >= 1);
});
test('owner unread counts in the Messages badge until read', () => {
  const FD = boot(); const st = FD.state; const store = st.ownerMsgs.find(m => m.reply).store;
  const n0 = FD.supervisorBadgeCounts(st).msgs; assert.ok(FD.ownerUnread(st, store, 'SUP'));
  FD.dispatch('OWNER_READ', { store, who: 'SUP' }); assert.ok(!FD.ownerUnread(st, store, 'SUP')); assert.strictEqual(FD.supervisorBadgeCounts(st).msgs, n0 - 1);
  // a message in the same clock minute as the read still counts as new; reading by one side leaves the other unread
  FD.dispatch('OWNER_MSG_IN', { store, text: 'One more carton' }); FD.dispatch('OWNER_MSG_IN', { store, text: 'Thanks' });
  assert.strictEqual(FD.ownerUnreadN(st, store, 'SUP'), 2); assert.ok(FD.ownerUnreadN(st, store, st.world.stores.find(s => s.id === store).vsr) >= 2);
});
test('no invoice copies or delivery receipts go to owners', () => {
  const FD = boot(); const st = FD.state; assert.ok(!FD.WA_CARDS.RECEIPT); assert.ok(!st.ownerMsgs.some(m => m.kind === 'INVOICE' || m.card === 'RECEIPT'));
  assert.throws(() => FD.dispatch('OWNER_MSG_SEND', { store: st.world.stores[0].id, kind: 'INVOICE' }));
  const n = st.ownerMsgs.length; FD.dispatch('OWNER_MSG_SEND', { store: st.world.stores[0].id, kind: 'CARD', card: 'RECEIPT', slots: {} }); assert.strictEqual(st.ownerMsgs.length, n);
});
test('salesman reply to an owner carries his name; a tip lands in his chat and can be acknowledged', () => {
  const FD = boot(); const st = FD.state; const v = st.world.vsrs.find(x => x.kind === 'sales'); const store = st.world.stores.find(s => s.vsr === v.id).id;
  FD.dispatch('OWNER_MSG_SEND', { store, kind: 'TEXT', text: 'Coming at 10', by: v.id, sign: FD.waSign(st, v.id) });
  const m = st.ownerMsgs[st.ownerMsgs.length - 1]; assert.strictEqual(m.by, v.id); assert.ok(m.sign.includes(FD.nameOf(v)));
  FD.dispatch('TIP_SEND', { vsr: v.id, tpl: 'K_PRICE', slots: FD.tipSlots(FD.SKUS[0].code) });
  const tip = st.tips[st.tips.length - 1]; const th = st.threads.find(t => t.anchor.type === 'vsr' && t.anchor.id === v.id);
  assert.ok(th.messages.some(x => x.tip === tip.id)); FD.dispatch('TIP_ACK', { id: tip.id }); assert.ok(tip.ack && tip.read);
  const o = FD.tipOutcome(st, tip); assert.ok(o.sold <= o.offered);
});
