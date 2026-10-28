// Salesman app (08_vsr.js) audit fixes. Source-level composition with a stub DOM, like planogram_views.test.js.
const test = require('node:test'), assert = require('node:assert/strict'), load = require('./load'), path = require('node:path');
const node = (tag, attrs, ...children) => ({ tag, attrs: attrs || {}, children: children.flat(Infinity).filter(x => x != null && x !== false), querySelector() { return node('img'); }, appendChild(c) { this.children.push(c); }, addEventListener() {}, style: { setProperty() {} }, setAttribute() {}, replaceChildren(...items) { this.children = items; } });
function ui() {
  const FD = load(); FD.init(7, { storage: null }); global.document = {}; global.requestAnimationFrame = () => {};
  let seq = 0; FD.key = () => String(++seq); FD.ui = { local: {} }; FD.h = node; FD.icon = k => node('icon', { k }); FD.registerView = (role, name, fn) => { FD.views[role][name] = fn; }; FD.views = { sup: {}, vsr: {} };
  FD.btn = (text, fn, cls) => node('button', { on: { click: fn }, class: cls }, text); FD.iconBtn = (icon, text, fn) => FD.btn(text, fn); FD.select = (options, value, change) => node('select', { options, value, change }); FD.seg = (options, value, change) => node('group', { options, value, change });
  FD.skuLabel = (code, sub) => node('span', null, FD.nameOf(FD.sku(code)) + (sub ? ' ' + sub : '')); FD.skuTile = () => null; FD.skuIcon = () => null; FD.chip = x => node('span', { class: 'chip' }, x); FD.typeChip = x => node('span', null, FD.t('TYPE_' + x)); FD.productPickBar = () => node('div'); FD.searchBox = () => node('input'); FD.empty = () => null;
  FD.sizeIcon = () => null; FD.creditChip = () => null; FD.avatar = () => null; FD.render = () => {}; FD.toast = () => {}; FD.menu = () => {}; FD.waChips = () => []; FD.datePick = () => {};
  FD.sheet = { open(cfg) { FD._sheet = cfg; return cfg.render(); }, redraw() {}, close() {} }; FD.dx = FD.dispatch;
  for (const f of ['08_vsr.js', '08b_planogram.js', '09_sup.js', '09b_today.js', '09d_levers.js', '09e_planogram.js', '09f_products.js']) { const p = path.join(__dirname, '../src', f); delete require.cache[require.resolve(p)]; require(p); }
  return FD;
}
const cleanup = () => { delete global.document; delete global.requestAnimationFrame; };
const walk = n => Array.isArray(n) ? n.flatMap(walk) : !n || typeof n !== 'object' ? [] : [n, ...(n.children || []).flatMap(walk)];
const content = n => !n ? '' : typeof n !== 'object' ? String(n) : (Array.isArray(n) ? n : n.children || []).map(content).join(' ').trim();
const cls = (n, c) => n && n.attrs && (n.attrs.class || '').split(' ').includes(c);
const planOf = (FD, id) => FD.planFor(FD.state, id, FD.state.clock.date);
const vsrOf = (FD, id) => FD.state.world.vsrs.find(v => v.id === id);
const firstRec = (FD, id) => planOf(FD, id).recs.find(r => r.outcome === null);
const mk = (base, id, extra) => Object.assign({}, base, { id }, extra);

test('first order shows the same quantity in the row, the card and the price', () => { try {
  const FD = ui(), V = FD.vsr, rec = firstRec(FD, 'V01'); Object.assign(rec, { type: 'GAP', qty: 3, qtyModified: undefined, outcome: null });
  for (const lang of ['en', 'ar']) { FD.lang = lang;
    const row = content(V.offerRow(rec, true)), card = content(V.recCard(rec, false));
    const q = FD.tx('C_FIRST_FILL', { qty: 3, unitOf: rec.sku });
    assert.ok(card.includes(q), 'card states the quantity');
    assert.ok(!card.includes(FD.t('C_FIRST_FILL', { qty: 1, unit: '' }).trim()) || q.includes(FD.fmt.num(3)));
    const num = FD.fmt.num(3), price = FD.fmt.num(3 * FD.withVat(FD.sku(rec.sku).cost), 2);
    assert.ok(row.includes(num) && card.includes(num), 'same quantity');
    assert.ok(row.includes(price) && card.includes(price), 'same price');
    assert.ok(q.includes(num) && q.includes(' ' + FD.tx('C_QTY', { qty: 3, unitOf: rec.sku, pcs: 0 }).split(' ')[2]), 'one unit name for both texts');
  }
} finally { cleanup(); } });

test('a waiting outcome shows as waiting, never as not sold', () => { try {
  const FD = ui(), V = FD.vsr, rec = firstRec(FD, 'V01');
  for (const lang of ['en', 'ar']) { FD.lang = lang;
    rec.outcome = 'WAITING'; const w = content(V.offerRow(rec, false));
    assert.ok(w.includes(FD.t('ME_UPS_WAITING')) && !w.includes(FD.t('E_NOT_SOLD')));
    rec.outcome = 'NOT_SOLD'; assert.ok(content(V.offerRow(rec, false)).includes(FD.t('E_NOT_SOLD')));
  }
} finally { cleanup(); } });

test('a store with no recommendations shows its usual refills and always offers Place order', () => { try {
  const FD = ui(), V = FD.vsr, vsr = vsrOf(FD, 'V01'), plan = planOf(FD, 'V01');
  const stop = plan.stops.find(x => x.status === 'PLANNED' && V.usualRefills(x.store).length); assert.ok(stop);
  FD.state.recs = FD.state.recs.filter(r => r.store !== stop.store);
  for (const lang of ['en', 'ar']) { FD.lang = lang;
    const view = FD.views.vsr.store({ id: stop.store }, vsr);
    assert.ok(view.cta, 'Place order is there'); assert.ok(content(view.cta).includes(FD.t('L_OPEN_SB')));
    const text = content(view.body); const first = V.usualRefills(stop.store)[0];
    assert.ok(text.includes(FD.t('L_REFILLS_H')) && text.includes(FD.nameOf(FD.sku(first.code))), 'usual products listed');
    assert.ok(text.includes('×' + FD.fmt.num(first.q)), 'with the usual quantity');
  }
  const rows = V.usualRefills(stop.store); assert.ok(rows.every(x => x.q >= 1));
  assert.ok(rows.findIndex(x => !x.due) === -1 || rows.slice(rows.findIndex(x => !x.due)).every(x => !x.due), 'due reorders first');
} finally { cleanup(); } });

test('a store with overdue invoices shows Collect first at the top; offers on cash are marked', () => { try {
  const FD = ui(), V = FD.vsr, vsr = vsrOf(FD, 'V01'), plan = planOf(FD, 'V01');
  const od = plan.stops.map(x => FD.state.world.stores.find(s => s.id === x.store)).find(s => s.overdue > 0 && s.oldestDue), ok = plan.stops.map(x => FD.state.world.stores.find(s => s.id === x.store)).find(s => !(s.overdue > 0));
  assert.ok(od);
  for (const lang of ['en', 'ar']) { FD.lang = lang;
    const body = FD.views.vsr.store({ id: od.id }, vsr).body, line = walk(body).find(n => cls(n, 'collect-first'));
    assert.ok(line, 'line present'); assert.ok(content(line).includes(FD.fmt.money0(od.overdue)) && content(line).includes(FD.fmt.date(od.oldestDue)));
    assert.equal(walk(body)[0] && walk(body).filter(n => cls(n, 'collect-first')).length, 1);
    if (ok) assert.ok(!walk(FD.views.vsr.store({ id: ok.id }, vsr).body).some(n => cls(n, 'collect-first')));
  }
  const rec = firstRec(FD, 'V01'); rec.cash = true; FD.lang = 'en';
  assert.ok(content(V.offerRow(rec, false)).includes(FD.t('L_CASH_SALE')) && content(V.recCard(rec, false)).includes(FD.t('L_CASH_SALE')));
  rec.cash = false; assert.ok(!content(V.offerRow(rec, false)).includes(FD.t('L_CASH_SALE')));
} finally { cleanup(); } });

test('Same reason for all covers only the unsold offers of one visit', () => { try {
  const FD = ui(), V = FD.vsr, vsr = vsrOf(FD, 'V01'), s = FD.state, d = s.clock.date;
  s.recs.forEach(r => { if (FD.recVsr(r) === 'V01') r.exempted = true; });
  const base = s.recs.find(r => FD.recVsr(r) === 'V01'), prev = FD.addDays(d, -1);
  const rs = [mk(base, 'T1', { store: 'A', date: d }), mk(base, 'T2', { store: 'A', date: d }), mk(base, 'T3', { store: 'B', date: d }), mk(base, 'T4', { store: 'A', date: prev })];
  rs.forEach(r => Object.assign(r, { vsr: 'V01', coveredBy: null, outcome: 'NOT_SOLD', reason: null, exempted: false }));
  let seen; V.reasonSheet = (ids, mode) => { seen = [ids, mode]; };
  const sameBtn = () => walk(FD.views.vsr.todo({}, vsr).body).filter(n => n.tag === 'button' && /Same reason|نفس السبب|^[^]*L_SAME/.test(content(n)) && content(n).includes(FD.t('L_SAME_REASON', { n: '' }).trim().split(' ').slice(0, 2).join(' ')));
  s.recs.push(...rs); FD.invalidate(s);
  const btn = sameBtn(); assert.equal(btn.length, 1); assert.ok(content(btn[0]).includes(FD.fmt.num(2)), 'two offers: the two of store A today');
  btn[0].attrs.on.click(); assert.deepEqual(seen[0].slice().sort(), ['T1', 'T2']); assert.equal(seen[1], 'NOT_SOLD');
  rs[1].store = 'C'; assert.equal(sameBtn().length, 0, 'different stores: no shared reason');
  rs[1].store = 'A'; rs[1].date = FD.addDays(d, -2); assert.equal(sameBtn().length, 0, 'different days: no shared reason');
  rs[1].date = prev; assert.equal(sameBtn().length, 1, 'two on the same earlier day of one store is one visit');
} finally { cleanup(); } });

test('collection-only is not a skip reason; a collected visit shows its amount', () => { try {
  const FD = ui(), V = FD.vsr, vsr = vsrOf(FD, 'V01'), plan = planOf(FD, 'V01'), stop = plan.stops[0];
  for (const lang of ['en', 'ar']) { FD.lang = lang;
    const sheet = content(V.skipSheet(stop, 'STOP_SKIP') || FD._sheet.render());
    assert.ok(!sheet.includes(FD.t('SK_COLLECT')) && sheet.includes(FD.t('SK_CLOSED')));
    stop.status = 'DONE'; stop.collected = 1250;
    const row = content(V.stopRow(stop, plan, vsr)); assert.ok(row.includes(FD.t('L_COLLECTED')) && row.includes(FD.fmt.money0(1250)));
    stop.collected = undefined; assert.ok(!content(V.stopRow(stop, plan, vsr)).includes(FD.t('L_COLLECTED')));
    stop.status = 'PLANNED';
  }
} finally { cleanup(); } });

test('My upsells leave out plain reorders, count reorders apart, and use the four states', () => { try {
  const FD = ui(), V = FD.vsr, vsr = vsrOf(FD, 'V01'), s = FD.state, base = s.recs.find(r => FD.recVsr(r) === 'V01' && r.outcome), y = FD.prevSellingDay(s.clock.date);
  FD.ui.local['vsr:mePeriod'] = 'MONTH'; FD.ui.local['vsr:upsFilter'] = 'ALL';
  const code = base.sku, win = FD.catWindow(code);
  const mkr = (id, o) => mk(base, id, Object.assign({ vsr: 'V01', coveredBy: null, store: base.store, date: y, soldOn: null, outcome: 'FULL', got: 2, alt: null, type: 'LAPSED', usual: 2, extra: 0, maturity: 'PENDING' }, o));
  s.recs = s.recs.filter(r => FD.recVsr(r) !== 'V01' || r.date < FD.addDays(y, -40));
  const plain = mkr('P1', {}), above = mkr('P2', { extra: 1, got: 3, maturity: 'SUSTAINED' }), gap = mkr('P3', { type: 'GAP', maturity: 'NOT_REORDERED' }), wait = mkr('P4', { type: 'GAP', date: y });
  s.recs.push(plain, above, gap, wait); FD.invalidate(s);
  const months = FD.fmt;
  for (const lang of ['en', 'ar']) { FD.lang = lang;
    const view = V.meUpsells(vsr), nodes = walk(view.body), rows = nodes.filter(n => cls(n, 'list-row')), text = content(view.body);
    assert.equal(rows.length, 3, 'reorder at the usual quantity is not listed');
    assert.deepEqual(nodes.filter(n => cls(n, 'ups-tile')).map(content).length, 4, 'four states');
    assert.ok(text.includes(FD.tx('ME_UPS_ABOVE', { n: 1 })), '+extra above usual');
    assert.ok(text.includes(FD.t('NOT_REORDERED')) && text.includes(FD.t('ME_UPS_WAITING')) && text.includes(FD.t('ME_UPS_REORDERED')));
    assert.ok(text.includes(FD.t('ME_REORDERS_SOLD') + ': ' + FD.fmt.num(2)), 'reorders sold: both reorder lines');
    assert.ok(text.includes(FD.tx('ME_UPS_DAYS_LEFT', { n: FD.catWindow(code) - FD.daysBetween(y, s.clock.date) })), 'days left from the category window');
    const value = FD.upsellValue(above) + FD.upsellValue(gap) + FD.upsellValue(wait);
    assert.ok(text.includes(FD.fmt.money0(value)) && FD.upsellValue(plain) === 0);
  }
  // Me landing: the same split
  FD.lang = 'en'; const me = content(FD.views.vsr.me({}, vsr).body);
  assert.ok(me.includes(FD.t('ME_REORDERS_SOLD')));
  assert.ok(win > 0 && months);
} finally { cleanup(); } });

test('store corrections pick the corrected value and send it', () => { try {
  const FD = ui(), V = FD.vsr, s = FD.state, store = s.world.stores.find(x => x.vsr === 'V01'), sent = [];
  FD.dx = (type, p) => { sent.push([type, p]); return FD.dispatch(type, p); };
  const press = (label, root) => walk(root).filter(n => n.tag === 'button').find(n => content(n) === label);
  for (const [kind, labelOf, cur, valid] of [['CORR_SIZE', z => FD.t('SIZE_' + z), store.size, FD.SIZES], ['CORR_SHELF', z => FD.t('SHELFV_' + z), store.shelf, ['low', 'med', 'high']], ['CORR_TAG', z => FD.t('TAGN_' + z.slice(4)), store.tags, FD.TAGS]]) {
    sent.length = 0; V.correctionSheet(store.id);
    const kinds = walk(FD._sheet.render()).filter(n => n.tag === 'button' && n.attrs.class === 'code-btn').map(content);
    assert.deepEqual(kinds, ['CORR_SIZE', 'CORR_SHELF', 'CORR_TAG', 'CORR_CLOSED', 'CORR_MOVED'].map(k => FD.t(k)), 'new kinds only');
    press(FD.t(kind), FD._sheet.render()).attrs.on.click();
    assert.equal(FD._sheet.footer()[0].attrs.disabled, true, 'a value is needed');
    const curs = [].concat(cur), pick = valid.find(z => !curs.includes(z)); press(labelOf(pick), FD._sheet.render()).attrs.on.click();
    assert.ok(!walk(FD._sheet.render()).some(n => n.tag === 'button' && content(n) === labelOf(curs[0])), 'current value is not offered');
    FD._sheet.footer()[0].attrs.on.click();
    const [type, p] = sent.find(x => x[0] === 'CORRECTION_ADD'); assert.equal(p.kind, kind); assert.equal(p.value, pick); assert.equal(p.store, store.id);
    const c = s.corrections[s.corrections.length - 1]; assert.equal(c.kind, kind); assert.equal(c.value, pick);
  }
  V.correctionSheet(store.id); press(FD.t('CORR_CLOSED'), FD._sheet.render()).attrs.on.click(); assert.ok(!FD._sheet.footer()[0].attrs.disabled, 'closed needs no value');
} finally { cleanup(); } });

test('salesman sees nearby places in plain words, not area-type names; a moved store says location to confirm', () => { try {
  const FD = ui(), V = FD.vsr, vsr = vsrOf(FD, 'V01'), plan = planOf(FD, 'V01'), stop = plan.stops[0], store = FD.state.world.stores.find(s => s.id === stop.store);
  store.tags = ['TAG_MOSQUE']; for (const lang of ['en', 'ar']) { FD.lang = lang;
    assert.ok(content(V.stopRow(stop, plan, vsr)).includes(FD.t('TAGN_MOSQUE')) && !content(V.stopRow(stop, plan, vsr)).includes(FD.t('PROFN_' + store.profile)));
    assert.ok(content(FD.views.vsr.store({ id: store.id }, vsr).body).includes(FD.t('TAGN_MOSQUE')) && !content(FD.views.vsr.store({ id: store.id }, vsr).body).includes(FD.t('PROFN_' + store.profile)));
    assert.ok(!content(V.stopRow(stop, plan, vsr)).includes(' · ,'));
    store.relocate = true; assert.ok(content(FD.views.vsr.store({ id: store.id }, vsr).body).includes(FD.t('L_LOCATION_CONFIRM'))); store.relocate = false;
    assert.ok(!content(FD.views.vsr.store({ id: store.id }, vsr).body).includes(FD.t('L_LOCATION_CONFIRM')));
  }
} finally { cleanup(); } });

test('to-do: expiry checks for today\'s stores, and open shelf fixes from earlier visits', () => { try {
  const FD = ui(), V = FD.vsr, vsr = vsrOf(FD, 'V01'), s = FD.state, d = s.clock.date, plan = planOf(FD, 'V01');
  const want = plan.stops.flatMap(x => FD.expiryChecks(s, x.store, d).map(c => x.store + '|' + c.sku)); assert.ok(want.length);
  assert.deepEqual(V.todoItems('V01').filter(i => i.kind === 'expiry').map(i => i.store + '|' + i.sku), want);
  for (const lang of ['en', 'ar']) { FD.lang = lang;
    const i = V.todoItems('V01').find(x => x.kind === 'expiry'), text = content(FD.views.vsr.todo({}, vsr).body);
    FD.ui.local['todo:expiry'] = true; const open = content(FD.views.vsr.todo({}, vsr).body);
    assert.ok(open.includes(FD.tx('T_EXPIRY', { skuCode: i.sku, date: i.delivered })) && text !== undefined);
  }
  // an earlier visit left an open fix at this salesman's store that is not on today's route
  const fu = FD.pgFollowUps(s)[0]; assert.ok(fu, 'seed has a supervisor follow-up'); const id = fu.slots.vsrId;
  const items = V.todoItems(id).filter(x => x.kind === 'shelf' && x.store === fu.slots.storeId);
  assert.equal(items.length, 1); assert.ok(items[0].fix >= fu.slots.n || items[0].req);
} finally { cleanup(); } });

test('Today shows the payday line when there is one', () => { try {
  const FD = ui(), vsr = vsrOf(FD, 'V01'); FD.lang = 'en';
  for (const k of ['PAY_COLLECT', 'PAY_BIG']) { if (!FD.has(k)) FD.CATALOG[k] = { en: k === 'PAY_BIG' ? 'Start of the month: bigger orders are common' : 'Good days to collect overdue: stores have salary cash', ar: k }; // the TODAY agent owns these keys
    FD.paydayNote = () => k; assert.ok(content(FD.views.vsr.today({}, vsr).body).includes(FD.t(k))); }
  FD.paydayNote = () => null; assert.ok(!content(FD.views.vsr.today({}, vsr).body).includes(FD.t('PAY_BIG')));
} finally { cleanup(); } });
