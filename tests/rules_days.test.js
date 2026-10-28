const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');

test('reorder days: category is editable and a product exception beats it', () => {
  const FD = load(9); FD.init(7, { storage: null }); const d = FD.dispatch, c = FD.SKUS.find(k => k.category === 'cake').code;
  d('RULE_DAYS_SET', { rule: 'catGap', id: 'cake', value: 40 }); assert.strictEqual(FD.cycleGap(c), 40);
  d('RULE_DAYS_SET', { rule: 'skuGap', id: c, value: 28 }); d('RULE_DAYS_SET', { rule: 'skuWindow', id: c, value: 56 });
  assert.strictEqual(FD.cycleGap(c), 28); assert.strictEqual(FD.catWindow(c), 56);
  d('RULE_DAYS_SET', { rule: 'skuGap', id: c, value: null }); assert.strictEqual(FD.cycleGap(c), 40);
  d('RULE_DAYS_SET', { rule: 'lapsedDays', id: c, value: 1 }); assert.strictEqual(FD.state.rules.lapsedDays, 14); // only the four day maps
});
