const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');

test('pay status: components, yesterday and tips hold together', () => {
  const FD = load(9); FD.init(7, { storage: null });
  const st = FD.state, d = st.clock.date;
  for (const v of st.world.vsrs.filter(x => x.kind === 'sales')) {
    const p = FD.kpiStatus(st, v.id, d);
    assert.strictEqual(p.pot, 2500);
    assert.ok(Math.abs(p.parts.cake.goal + p.parts.grocery.goal - p.target) < 1e-6);
    assert.strictEqual(p.parts.active.need, Math.ceil(p.parts.active.jp * 0.9));
    assert.ok(FD.isSellingDay(p.yesterday.date) && p.yesterday.date < d);
    // likely pay = sum of components not at risk
    assert.strictEqual(p.likely, Object.keys(FD.BONUS).reduce((a, k) => a + (p.parts[k].status === 'AT_RISK' ? 0 : FD.BONUS[k]), 0));
    for (let i = 1; i < p.tips.length; i++) assert.ok(p.tips[i - 1].risk > p.tips[i].risk || p.tips[i - 1].risk === p.tips[i].risk && p.tips[i - 1].stake >= p.tips[i].stake);
  }
});
