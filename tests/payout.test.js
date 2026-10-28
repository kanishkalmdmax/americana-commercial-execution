const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');

test('payout table matches Americana commission bands', () => {
  const FD = load(9);
  const cases = [[84, 0], [85, 60], [89.9, 60], [90, 80], [94, 80], [95, 95], [99, 95], [100, 100], [103, 103.75], [105, 106.25], [110, 113.75], [120, 133.75], [121, 150], [200, 150]];
  for (const [a, pct] of cases) assert.strictEqual(FD.payoutPct(a), pct, 'achievement ' + a);
});
