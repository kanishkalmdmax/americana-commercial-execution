const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const load = require('./load');
const L = 10; // all non-DOM modules, so every catalog extension is slot-checked
const spec = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'superpowers', 'specs', '2026-09-23-fielddrive-supervisor-vsr-design.md'), 'utf8');
const section = spec.slice(spec.indexOf('## 9. Reason codes'), spec.indexOf('## 15. Testing')) + spec.slice(spec.indexOf('## 17.1'));
const specIds = new Set([...section.matchAll(/\b([A-Z]{1,2}_[A-Z0-9_]{2,})\b/g)].map(m => m[1]));
test('every spec id exists in catalog (title id for K rows)', () => {
  const FD = load(L);
  const missing = [...specIds].filter(id => !FD.CATALOG[id] && !FD.CATALOG[id + '_T']);
  assert.deepStrictEqual(missing, []);
});
test('every entry has en and ar, and only known slots', () => {
  const FD = load(L);
  for (const [id, e] of Object.entries(FD.CATALOG)) {
    assert.ok(e.en && e.ar, id + ' missing language');
    for (const lang of ['en', 'ar']) for (const m of e[lang].matchAll(/\{(\w+)\}/g))
      assert.ok(FD.SLOTS.includes(m[1]), `${id}.${lang} unknown slot ${m[1]}`);
  }
});
test('plan-introduced ids exist', () => {
  const FD = load(L);
  const ids = ['SK_CLOSED','SK_LATER','SK_ROAD','SK_COLLECT','SK_TIME','SK_OTHER','RG_BUYER','RG_STOCK','RG_MONEY','RG_COMP','RG_OURS',
    'BR_LUSINE','BR_7DAYS','BR_SABAHOO','BR_OTHER','TAG_SCHOOL','TAG_MOSQUE','TAG_DENSE','TAG_VILLA','TAG_WORKERS','TAG_OFFICE','TAG_PETROL','TAG_HOSPITAL','TAG_UNI',
    'GATE_ONBOARD','GATE_CREDIT','GATE_WATCH','GATE_BLOCKED','GATE_COOLDOWN','GATE_VAN','GATE_FIRSTFILL','GATE_SHELF','GATE_LIFE',
    'GRP_SINGLES','GRP_CUPBOX','GRP_CAKEBAR','GRP_SLICE','GRP_SWISS','GRP_POUND','GRP_BUTTER','GRP_RUSK','PACK_SINGLE','PACK_FAMILY',
    'QR_AGAIN','QR_ONEBOX','QR_NOTED','QR_CALL','QR_SKIP','QR_PROMO','R_EXEMPTED','R_NONE'];
  assert.deepStrictEqual(ids.filter(i => !FD.CATALOG[i]), []);
});
test('t fills slots and switches language', () => {
  const FD = load(L);
  assert.strictEqual(FD.t('E_PARTIAL', { got: 1, qty: 2, unit: 'boxes' }), 'Sold partly (1 of 2 boxes)');
  FD.lang = 'ar'; assert.strictEqual(FD.t('L_NAV_HOME'), 'الرئيسية');
  assert.throws(() => FD.t('NOPE'));
});
test('fmt digits follow language', () => {
  const FD = load(L);
  FD.lang = 'en'; assert.strictEqual(FD.fmt.money(18), '18.00 SAR');
  FD.lang = 'ar'; FD.digits = 'arab'; assert.match(FD.fmt.money(18), /١٨/);
  FD.digits = 'latn'; assert.match(FD.fmt.money(18), /18/);
});
