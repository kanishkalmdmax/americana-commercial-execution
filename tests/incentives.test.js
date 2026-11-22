const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');

test('incentives: rec earnings, today, lost visits and drafts that never touch the live plan', () => {
  const FD = load(); FD.init(7, { storage: null });
  const st = FD.state, d = st.clock.date;
  for (const v of st.world.vsrs.filter(x => x.kind === 'sales')) {
    const p = FD.kpiStatus(st, v.id, d), open = st.recs.filter(r => r.date === d && r.outcome === null && FD.recVsr(r) === v.id);
    const te = FD.todayEarn(st, v.id, d);
    assert.strictEqual(te.n, open.length);
    assert.ok(Math.abs(te.value - open.reduce((a, r) => a + (r.qtyModified ?? r.qty) * FD.sku(r.sku).cost, 0)) < 1e-6);
    for (const r of open) { const e = FD.recEarn(st, r, d), c = FD.recChances(st, r, d);
      assert.ok(e.bonus >= 0 && e.value > 0 && ['cake', 'grocery'].includes(e.k));
      assert.ok(c.sale >= 0 && c.sale <= 100 && c.ret >= 0 && (c.n === 0) === (c.last === null)); }
    // lost = missed plan visits + done visits without an order, this month before today
    const l = FD.lostThisMonth(st, v.id, d), m0 = d.slice(0, 8) + '01';
    assert.strictEqual(l.missed, st.visits.filter(x => x.vsr === v.id && !x.offPlan && x.status === 'MISSED' && x.date >= m0 && x.date < d).length);
    assert.strictEqual(l.rows.length, l.missed + l.noSale);
    assert.strictEqual(l.storesAtRisk, p.parts.active.status === 'AT_RISK' ? FD.BONUS.active : 0);
  }
  const before = JSON.stringify(FD.BONUS);
  assert.strictEqual(JSON.stringify(FD.BONUS), before);
});
