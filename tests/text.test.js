const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const path = require('path');
const load = require('./load');
const L = 11; // all non-DOM modules, so every catalog extension is slot-checked
const spec = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'superpowers', 'specs', '2026-09-23-fielddrive-supervisor-vsr-design.md'), 'utf8');
const section = spec.slice(spec.indexOf('## 9. Reason codes'), spec.indexOf('## 15. Testing')) + spec.slice(spec.indexOf('## 17.1'));
const specIds = new Set([...section.matchAll(/\b([A-Z]{1,2}_[A-Z0-9_]{2,})\b/g)].map(m => m[1]));

test('end-user copy avoids technical shelf-planning terminology',()=>{
  const FD=load(L);
  for(const [id,entry] of Object.entries(FD.CATALOG)){
    assert.ok(!/planogram|تنظيم الأرفف|بلانوغرام/i.test(entry.en+' '+entry.ar),id+' exposes the rejected term');
  }
});
test('end-user copy uses data and order wording without source-system branding',()=>{
  const FD=load(L);
  for(const [id,entry] of Object.entries(FD.CATALOG))assert.ok(!/salesbuzz|سيلز\s*باز/i.test(entry.en+' '+entry.ar),id+' exposes the source-system name');
});

test('new planogram labels retain readable Arabic characters', () => {
  const FD=load(L);
  for(const [id,entry] of Object.entries(FD.CATALOG).filter(([id])=>id.startsWith('PG_'))){
    assert.ok(/[\u0600-\u06ff]/.test(entry.ar), id+' lost its Arabic translation');
    assert.ok(!/\?{2,}/.test(entry.ar), id+' contains encoding replacements');
  }
});
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
test('every audit and notification id used in code has text', () => {
  const FD = load(L); const src = fs.readFileSync(path.join(__dirname, '..', 'src', '04_store.js'), 'utf8');
  const ids = [...src.matchAll(/audit\(st, '([A-Z_]+)'/g), ...src.matchAll(/notify\(st, [^,]+, '([A-Z_]+)'/g)].map(m => m[1]);
  assert.ok(ids.length > 10);
  assert.deepStrictEqual([...new Set(ids)].filter(id => !FD.CATALOG[id]), []);
});
test('every visit status in the data has a status label', () => {
  const FD = load(); FD.init(7, { storage: null }); FD.dispatch('CLOCK_SET', { date: FD.addDays(FD.TODAY, 1), time: '07:00' });
  const statuses = [...new Set(FD.state.visits.map(v => v.status))];
  assert.deepStrictEqual(statuses.filter(x => !FD.CATALOG['L_STATUS_' + x]), []);
});
test('every fixed text id used in code has a label', () => {
  const FD = load(); const fs = require('fs'); const path = require('path'); const dir = path.join(__dirname, '..', 'src'); const miss = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js'))) for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/\btx?\('([A-Z][A-Z0-9_]*[A-Z0-9])'/g)) if (!FD.CATALOG[m[1]]) miss.push(f + ':' + m[1]);
  assert.deepStrictEqual(miss, []);
});

test('a label redefined later keeps the same {slots} (else callers get the wrong text)', () => {
  const fs = require('fs'); const path = require('path'); const seen = {}; const bad = [];
  const slots = en => [...en.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  for (const f of ['01_text_catalog.js', '06b_labels.js']) for (const m of fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8').matchAll(/\b([A-Z][A-Z0-9_]*[A-Z0-9]): E\('((?:[^'\\]|\\.)*)'/g)) {
    if (m[1] in seen && seen[m[1]] !== slots(m[2])) bad.push(m[1]); seen[m[1]] = slots(m[2]); }
  assert.deepStrictEqual(bad, []);
});
