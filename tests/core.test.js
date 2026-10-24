const fx = require('./fx');
const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
test('rng is deterministic', () => {
  const FD = load(1); const a = FD.rng(42), b = FD.rng(42);
  assert.deepStrictEqual([a(), a(), a()], [b(), b(), b()]);
});
test('calendar facts', () => {
  const FD = load(1);
  assert.strictEqual(FD.dow(FD.TODAY), 4); // Thu 22 Oct 2026
  assert.strictEqual(FD.daysBetween(FD.PILOT_START, FD.TODAY), 30);
  assert.strictEqual(FD.isSellingDay('2026-10-09'), false); // Friday
  assert.strictEqual(FD.addDays('2026-10-31', 1), '2026-11-01');
});
test('bus delivers', () => {
  const FD = load(1); let got; FD.bus.on('x', d => got = d); FD.bus.emit('x', 7);
  assert.strictEqual(got, 7);
});
