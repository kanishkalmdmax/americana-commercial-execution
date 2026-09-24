const test = require('node:test'); const assert = require('node:assert');
const load = require('./load');
test('rng is deterministic', () => {
  const FD = load(1); const a = FD.rng(42), b = FD.rng(42);
  assert.deepStrictEqual([a(), a(), a()], [b(), b(), b()]);
});
test('calendar facts', () => {
  const FD = load(1);
  assert.strictEqual(FD.dow('2026-11-18'), 3);
  assert.strictEqual(FD.daysBetween(FD.PILOT_START, FD.TODAY), 37);
  assert.strictEqual(FD.isSellingDay('2026-11-20'), false);
  assert.strictEqual(FD.addDays('2026-10-31', 1), '2026-11-01');
});
test('bus delivers', () => {
  const FD = load(1); let got; FD.bus.on('x', d => got = d); FD.bus.emit('x', 7);
  assert.strictEqual(got, 7);
});
