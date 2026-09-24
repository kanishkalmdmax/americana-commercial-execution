(function () {
  const FD = globalThis.FD;
  const E = (en, ar) => ({ en, ar });
  Object.assign(FD.CATALOG, {
    ACT_REVIEW_STORE: E('Review store', 'مراجعة المحل'), ACT_REMIND: E('Send reminder', 'إرسال تذكير'), ACT_TIP: E('Send coaching tip', 'إرسال نصيحة'),
    ACT_VIEW_STORES: E('View stores', 'عرض المحلات'), ACT_PIN_STORES: E('Pin for these stores', 'تثبيت لهذه المحلات'), ACT_OPEN_VSR: E('Open salesman', 'فتح المندوب'),
    ACT_DECIDE: E('Accept / Reject', 'قبول / رفض'), ACT_REPLY: E('Reply', 'رد'), ACT_VIEW: E('View', 'عرض'), ACT_LEARN: E('Open learning', 'فتح التعلّم'),
    ACT_REVIEW_SKU: E('Review product', 'مراجعة المنتج'), ACT_PIN_PROMO: E('Pin promo', 'تثبيت العرض'), ACT_OPEN_ROUTE: E('Open route', 'فتح المسار'),
    TYPE_SUP: E('Supervisor pick', 'اختيار المشرف'), TYPE_LAPSED: E('Lapsed', 'انقطع الطلب'), TYPE_GAP: E('New for store', 'جديد للمحل'), TYPE_UPGRADE: E('Upgrade', 'ترقية'), TYPE_PROMO: E('Promo', 'عرض'),
    CREDIT_OK: E('OK', 'سليم'), CREDIT_WATCH: E('on watch', 'تحت المراقبة'), CREDIT_BLOCKED: E('blocked', 'موقوف'),
    CORR_TAG: E('Tag is wrong', 'التصنيف غير صحيح'), CORR_LABEL: E('Label is wrong', 'الفئة غير صحيحة'), CORR_CLOSED: E('Store closed permanently', 'المحل مغلق نهائياً'), CORR_MOVED: E('Store moved', 'المحل انتقل'),
    FU_HANDLED: E('Already handled', 'تمت معالجته'), FU_IRRELEVANT: E('Not relevant', 'غير مهم'),
    MSG_REMIND: E('Please add the missing reasons today.', 'الرجاء إضافة الأسباب الناقصة اليوم.'),
    ST_ACCEPTED: E('accepted', 'قبول'), ST_REJECTED: E('rejected', 'رفض'),
    INS_OTHERS: E('All other stores', 'باقي المحلات'),
  });
  const SOLD = FD.SOLD;
  const NEEDS = ['NOT_SOLD', 'NOT_OFFERED'];
  FD.REASON_GROUPS = { RG_BUYER: ['R_BUYER_ABSENT', 'R_BUYER_NO'], RG_STOCK: ['R_ENOUGH', 'R_NO_SHELF'], RG_MONEY: ['R_PRICE', 'R_CREDIT'], RG_COMP: ['R_COMPETITOR'], RG_OURS: ['R_NOT_ON_VAN', 'R_SYSTEM'] };
  // built-in groups stay fixed; the supervisor can rename or hide reasons and add new ones (st.reasonEdit)
  const BASE_GROUPS = FD.REASON_GROUPS;
  const RE = () => (FD.state && FD.state.reasonEdit) || { custom: {}, hidden: [] };
  Object.defineProperty(FD, 'REASON_GROUPS', { configurable: true, get() { const out = {}; const e = RE();
    for (const g of Object.keys(BASE_GROUPS)) out[g] = BASE_GROUPS[g].concat(Object.keys(e.custom).filter(id => e.custom[id].group === g)); return out; } });
  FD.reasonPick = g => FD.REASON_GROUPS[g].filter(c => !RE().hidden.includes(c) && !(RE().custom[c] || {}).deleted);
  FD.reasonIsCustom = c => !!RE().custom[c];
  FD.groupOf = code => Object.keys(FD.REASON_GROUPS).find(g => FD.REASON_GROUPS[g].includes(code)) || code;
  const pct = (a, b) => (b ? (100 * a) / b : 0);
  const mode = arr => { const c = {}; let best = null; for (const x of arr) { c[x] = (c[x] || 0) + 1; if (best === null || c[x] > c[best]) best = x; } return best; };
  const weekKey = st => FD.addDays(st.clock.date, -FD.dow(st.clock.date));
  const inLast = (st, d, days) => d <= st.clock.date && FD.daysBetween(d, st.clock.date) < days;
  const store = (st, id) => st.world.stores.find(s => s.id === id);

  // ---------- ids in slots -> display text in the current language ----------
  FD.nameOf = o => (o ? (FD.lang === 'ar' && o.name_ar ? o.name_ar : o.name) : '');
  FD.slotText = function (slots) {
    const st = FD.state; const out = {};
    for (const [k, v] of Object.entries(slots || {})) {
      if (v == null) continue;
      switch (k) {
        case 'vsrId': out.vsr = FD.nameOf(st.world.vsrs.find(x => x.id === v)); break;
        case 'vsr2Id': out.vsr2 = FD.nameOf(st.world.vsrs.find(x => x.id === v)); break;
        case 'supId': out.sup = FD.nameOf(st.world.supervisor); break;
        case 'storeId': out.store = FD.nameOf(store(st, v)); break;
        case 'skuCode': out.sku = FD.nameOf(FD.sku(v)); break;
        case 'sku2Code': out.sku2 = FD.nameOf(FD.sku(v)); break;
        case 'altCode': out.alt = FD.nameOf(FD.sku(v)); break;
        case 'skuSmall': out.sku_small = FD.nameOf(FD.sku(v)); break;
        case 'skuHave': out.sku_have = FD.nameOf(FD.sku(v)); break;
        case 'skuCodes': out.sku_list = v.slice(0, 3).map(c => FD.nameOf(FD.sku(c))).join(FD.lang === 'ar' ? '، ' : ', '); break;
        case 'tagId': out.tag = FD.t(v); break;
        case 'labelId': out.label = FD.t('LBL_' + v); break;
        case 'sizeId': out.size = FD.t('SIZE_' + v); break;
        case 'groupId': out.sku_group = FD.t(v); break;
        case 'packId': out.pack_type = FD.t(v); break;
        case 'catId': out.category = FD.t(v); break;
        case 'typeId': out.type = FD.t('TYPE_' + v); break;
        case 'reasonCode': out.reason = FD.t(v); break;
        case 'brandId': out.brand = FD.t(v); break;
        case 'promoId': out.promo = FD.t(v); break;
        case 'gateId': out.gate = FD.t(v); break;
        case 'statusId': out.status = FD.t(v); break;
        case 'changeId': out.change = FD.t(v); break;
        case 'topicId': out.topic = FD.t(v); break;
        case 'tipTpl': out.tip_title = FD.t(v + '_T'); break;
        case 'routeId': out.route = FD.nameOf(st.world.routes.find(r => r.id === v)); break;
        case 'unitOf': { const s = FD.sku(v); const plural = (slots.qty || 1) > 1; out.unit = FD.lang === 'ar' ? (plural ? s.units_ar : s.unit_ar) : (plural ? s.units : s.unit); break; }
        case 'date': out.date = FD.fmt.date(v); break;
        case 'time': out.time = FD.fmt.time(v); break;
        case 'ratio': out.ratio = FD.fmt.num(v, 1); break;
        case 'cost': case 'rev': case 'earn': case 'price': out[k] = FD.fmt.num(v, 2); break;
        case 'n': case 'qty': case 'got': case 'days': case 'pct': case 'pcs': case 'rank': out[k] = FD.fmt.num(Math.round(v)); break;
        default: out[k] = v;
      }
    }
    return out;
  };
  FD.tx = (id, slots) => FD.t(id, FD.slotText(slots));

  // returns watchlist review: return rate (returns value / sales value) 28 days before vs since it was added
  FD.watchStats = (st, code) => {
    const today = st.clock.date; const m = (st.watchMeta || {})[code] || { since: today, review: FD.addDays(today, FD.WATCH_DAYS) };
    // by sale date: a return lands 5-12 days after its sale, so the last 12 days of sales are not settled yet
    const rate = (a, b) => { let sales = 0; for (const x of st.world.stores) for (const o of FD.storeOrders(st, x.id, code)) if (o.date >= a && o.date <= b) sales += o.value;
      const ret = st.returns.reduce((n, x) => n + (x.sku === code && (x.saleDate || x.date) >= a && (x.saleDate || x.date) <= b ? x.value : 0), 0); return sales ? ret / sales * 100 : 0; };
    const settled = FD.addDays(today, -12);
    const before = rate(FD.addDays(m.since, -28), FD.addDays(m.since, -1)); const after = m.since <= settled ? rate(m.since, settled) : null;
    return { since: m.since, review: m.review, days: FD.daysBetween(m.since, today), before, after, due: today >= m.review, improved: after != null && (after <= before * 0.6 || after < 3) };
  };

  // ---------- Follow-ups (spec §14.J) ----------
  const snippet = th => { const m = th.messages[th.messages.length - 1]; const t = m.text || ''; return t.length > 48 ? t.slice(0, 48) + '…' : t; };
  const FU_RULES = [
    ['F_RETURN_UPSELL', 1, st => st.recs.filter(r => r.maturity === 'RETURNED').map(r => {
      const x = st.returns.filter(x => x.store === r.store && x.sku === (r.alt || r.sku) && x.date >= r.date && x.date <= st.clock.date).pop();
      return x && inLast(st, x.date, 7) ? { key: 'F_RETURN_UPSELL|' + r.id, at: x.date, slots: { storeId: r.store, skuCode: r.alt || r.sku, qty: r.got || 1, unitOf: r.alt || r.sku, vsrId: r.vsr }, action: { label: 'ACT_REVIEW_STORE', kind: 'store', store: r.store } } : null;
    })],
    ['F_MISSING_REASONS', 1, st => st.world.vsrs.map(v => {
      const miss = st.recs.filter(r => FD.recVsr(r) === v.id && NEEDS.includes(r.outcome) && !r.reason && !r.exempted && r.date < st.clock.date);
      if (miss.length < 3) return null;
      const oldest = miss.reduce((m, r) => (r.date < m ? r.date : m), miss[0].date);
      return { key: 'F_MISSING_REASONS|' + v.id + '|' + st.clock.date, at: st.clock.date, slots: { n: miss.length, vsrId: v.id, date: oldest }, action: { label: 'ACT_REMIND', kind: 'remind', vsr: v.id } };
    })],
    ['F_REPEAT_DECLINE', 2, st => {
      const by = {};
      st.recs.filter(r => r.outcome === 'NOT_SOLD' && r.reason && !FD.TEMP.includes(r.reason) && inLast(st, r.date, 7)).forEach(r => { (by[r.sku + '|' + r.reason] = by[r.sku + '|' + r.reason] || []).push(r); });
      return Object.entries(by).filter(([, rs]) => rs.length >= 5).map(([k, rs]) => {
        const [sku, reason] = k.split('|'); const vsr = mode(rs.map(FD.recVsr));
        return { key: 'F_REPEAT_DECLINE|' + k + '|' + weekKey(st), at: rs[rs.length - 1].date, slots: { skuCode: sku, n: rs.length, reasonCode: reason, vsrId: vsr }, action: { label: 'ACT_TIP', kind: 'tip', vsr, reason, sku } };
      });
    }],
    ['F_COMPETITOR', 2, st => {
      const by = {};
      st.recs.filter(r => r.reason === 'R_COMPETITOR' && r.brand && inLast(st, r.date, 7)).forEach(r => { (by[r.brand] = by[r.brand] || []).push(r); });
      return Object.entries(by).filter(([, rs]) => rs.length >= 3).map(([b, rs]) => ({ key: 'F_COMPETITOR|' + b + '|' + weekKey(st), at: rs[rs.length - 1].date,
        slots: { brandId: b, n: new Set(rs.map(r => r.store)).size, skuCode: mode(rs.map(r => r.sku)) }, action: { label: 'ACT_VIEW_STORES', kind: 'reasons', filter: { reason: 'R_COMPETITOR', brand: b } } }));
    }],
    ['F_GAP_CLUSTER', 2, st => {
      const out = [];
      for (const tag of FD.TAGS) {
        const ss = st.world.stores.filter(s => s.tags.includes(tag) && s.credit !== 'BLOCKED'); if (ss.length < 8) continue;
        for (const sku of FD.SKUS) {
          const missing = ss.filter(s => !FD.carries(st, s.id, sku.code, st.clock.date));
          const carry = pct(ss.length - missing.length, ss.length);
          if (carry >= 60 && missing.length >= 5) out.push({ key: 'F_GAP_CLUSTER|' + tag + '|' + sku.code, at: st.clock.date, n: missing.length,
            slots: { n: missing.length, tagId: tag, skuCode: sku.code, pct: carry }, action: { label: 'ACT_PIN_STORES', kind: 'pin', sku: sku.code, scope: 'tag', id: tag, stores: missing.map(s => s.id) } });
        }
      }
      return out.sort((a, b) => b.n - a.n).slice(0, 3);
    }],
    ['F_VSR_BELOW', 2, st => st.world.vsrs.map(v => {
      const b = FD.baseline(st, v.id); if (!b.perDay) return null;
      const w1 = FD.vsrMetrics(st, v.id, FD.addDays(st.clock.date, -6), st.clock.date), w2 = FD.vsrMetrics(st, v.id, FD.addDays(st.clock.date, -13), FD.addDays(st.clock.date, -7));
      const d1 = pct(w1.perDay - b.perDay, b.perDay), d2 = pct(w2.perDay - b.perDay, b.perDay);
      return d1 <= -10 && d2 <= -10 ? { key: 'F_VSR_BELOW|' + v.id + '|' + weekKey(st), at: st.clock.date, slots: { vsrId: v.id, pct: -Math.max(d1, d2) }, action: { label: 'ACT_OPEN_VSR', kind: 'vsr', vsr: v.id } } : null;
    })],
    ['F_NOT_OFFERED', 2, st => st.world.vsrs.map(v => {
      const rs = st.recs.filter(r => FD.recVsr(r) === v.id && r.outcome && r.outcome !== 'CARRIED' && inLast(st, r.date, 7));
      const p = pct(rs.filter(r => r.outcome === 'NOT_OFFERED').length, rs.length);
      return rs.length >= 10 && p >= 40 ? { key: 'F_NOT_OFFERED|' + v.id + '|' + weekKey(st), at: st.clock.date, slots: { vsrId: v.id, pct: p }, action: { label: 'ACT_OPEN_VSR', kind: 'vsr', vsr: v.id } } : null;
    })],
    ['F_CREDIT', 2, st => st.world.stores.filter(s => s.credit !== 'OK').map(s => ({ key: 'F_CREDIT|' + s.id + '|' + s.credit, at: st.clock.date,
      slots: { storeId: s.id, statusId: 'CREDIT_' + s.credit }, action: { label: 'ACT_REVIEW_STORE', kind: 'store', store: s.id } }))],
    ['F_CORRECTION', 3, st => st.corrections.filter(c => c.status === 'PENDING').map(c => ({ key: 'F_CORRECTION|' + c.id, at: c.at.date,
      slots: { vsrId: c.vsr, storeId: c.store, changeId: c.kind }, action: { label: 'ACT_DECIDE', kind: 'correction', id: c.id } }))],
    ['F_VSR_MSG', 2, st => st.threads.filter(t => !t.team && t.unreadSup && t.messages.length).map(t => { const m = t.messages.filter(x => x.by !== 'SUP').pop(); if (!m) return null; const base = { key: 'F_VSR_MSG|' + t.id + '|' + t.messages.length, at: m.at.date, action: { label: 'ACT_REPLY', kind: 'thread', thread: t.id } };
      if (m.rec && m.sku) { const r = st.recs.find(x => x.id === m.rec); return Object.assign(base, { tpl: 'F_VSR_COMMENT', slots: { vsrId: t.vsr, skuCode: m.sku, storeId: m.store, snippet: (m.text || '').slice(0, 48) || FD.t((r && r.reason) || 'R_NONE') } }); }
      if (m.store) return Object.assign(base, { tpl: 'F_VSR_STORE_MSG', slots: { vsrId: t.vsr, topicId: m.topic || 'R_T_OTHER', storeId: m.store, snippet: snippet(t) } });
      return Object.assign(base, { slots: { vsrId: t.vsr, snippet: (m.text || '').slice(0, 48) } }); })],
    ['F_PLAN_CHANGE', 3, st => st.planChanges.filter(p => p.date >= st.clock.date && !p.bySup).map((p, i) => ({ key: 'F_PLAN_CHANGE|' + p.store + '|' + p.date, at: p.at.date,
      slots: { vsrId: p.vsr, storeId: p.store, date: p.date, reasonCode: p.reason || 'SK_LATER' }, action: { label: 'ACT_OPEN_VSR', kind: 'vsr', vsr: p.vsr } }))],
    ['F_WATCH_OK', 2, st => (st.watchlist || []).map(code => { const w = FD.watchStats(st, code); return w.due && w.improved ? { key: 'F_WATCH_OK|' + code + '|' + w.review, at: w.review, slots: { skuCode: code, days: w.days, n: w.before, pct: w.after }, action: { label: 'ACT_UNWATCH', kind: 'unwatch', sku: code } } : null; })],
    ['F_WATCH_BAD', 2, st => (st.watchlist || []).map(code => { const w = FD.watchStats(st, code); return w.due && !w.improved ? { key: 'F_WATCH_BAD|' + code + '|' + w.review, at: w.review, slots: { skuCode: code, days: w.days, n: w.before, pct: w.after || 0 }, action: { label: 'ACT_REVIEW_PRODUCT', kind: 'sku', sku: code } } : null; })],
    ['F_ASSIGN_PENDING', 4, st => st.sbPending.filter(p => p.kind === 'store').map(p => ({ key: 'F_ASSIGN_PENDING|' + p.store + '|' + p.vsr, at: p.at.date,
      slots: { storeId: p.store, vsrId: p.vsr }, action: { label: 'ACT_REVIEW_STORE', kind: 'store', store: p.store } }))],
    ['F_PHOTO', 3, st => st.recs.filter(r => r.photo && r.reasonAt && inLast(st, r.reasonAt.date, 3)).map(r => ({ key: 'F_PHOTO|' + r.id, at: r.reasonAt.date,
      slots: { storeId: r.store, vsrId: FD.recVsr(r), date: r.reasonAt.date }, action: { label: 'ACT_VIEW', kind: 'rec', rec: r.id } }))],
    ['F_ENGINE_MISS', 3, st => {
      const by = {}; st.misses.filter(m => m.type === 'UNREC' && inLast(st, m.date, 7)).forEach(m => { (by[m.sku] = by[m.sku] || []).push(m); });
      return Object.entries(by).filter(([, ms]) => ms.length >= 3).map(([sku, ms]) => ({ key: 'F_ENGINE_MISS|' + sku + '|' + weekKey(st), at: ms[ms.length - 1].date, slots: { skuCode: sku, n: new Set(ms.map(m => m.store)).size }, action: { label: 'ACT_REVIEW_SKU', kind: 'sku', sku } }));
    }],
    ['F_WATCHLIST', 2, st => FD.skuPerf(st, FD.addDays(st.clock.date, -27), st.clock.date).filter(x => x.returnRate >= 8 && !x.watch).map(x => ({ key: 'F_WATCHLIST|' + x.code + '|' + weekKey(st), at: st.clock.date,
      slots: { skuCode: x.code, pct: x.returnRate }, action: { label: 'ACT_REVIEW_SKU', kind: 'sku', sku: x.code } }))],
    ['F_SKIPPED', 3, st => st.world.vsrs.map(v => {
      const sk = FD.planFor(st, v.id, st.clock.date).stops.filter(s => s.status === 'SKIPPED');
      return sk.length >= 2 ? { key: 'F_SKIPPED|' + v.id + '|' + st.clock.date, at: st.clock.date, slots: { vsrId: v.id, n: sk.length, reasonCode: mode(sk.map(s => s.skipReason)) }, action: { label: 'ACT_OPEN_VSR', kind: 'vsr', vsr: v.id } } : null;
    })],
    ['F_PROMO_LOW', 3, st => st.world.promos.filter(p => p.start <= st.clock.date && p.end >= st.clock.date && FD.daysBetween(st.clock.date, p.end) <= 5).map(p => {
      const code = p.skus[0]; const carrying = st.world.stores.filter(s => FD.carries(st, s.id, code, st.clock.date, 56));
      const took = carrying.filter(s => FD.storeOrders(st, s.id, code).some(o => o.date >= p.start && o.units > 0));
      const u = pct(took.length, carrying.length);
      return carrying.length && u < 30 ? { key: 'F_PROMO_LOW|' + p.id, at: st.clock.date, slots: { promoId: p.promoId, date: p.end, pct: u }, action: { label: 'ACT_PIN_PROMO', kind: 'pin', sku: code, until: p.end } } : null;
    })],
    ['F_COVER', 4, st => st.covers.filter(c => c.date === st.clock.date).map(c => ({ key: 'F_COVER|' + c.date + '|' + c.route, at: c.date,
      slots: { vsr2Id: c.vsr, vsrId: st.world.vsrs.find(v => v.route === c.route).id, routeId: c.route }, action: { label: 'ACT_OPEN_ROUTE', kind: 'vsr', vsr: c.vsr } }))],
  ];
  FD.followUps = st => FD.cached('fu', st, '', () => FU_RULES.flatMap(([tpl, pri, run]) => run(st).filter(Boolean).map(x => Object.assign(x, { tpl: x.tpl || tpl, pri })))
    .filter(f => !st.followupDone[f.key] && !(st.followupSnooze[f.key] > st.clock.date))
    .sort((a, b) => a.pri - b.pri || ((b.slots.n || 0) - (a.slots.n || 0)) || String(b.at).localeCompare(String(a.at))));

  // ---------- coaching drafts (spec §14.K) ----------
  FD.K_BY_REASON = { R_PRICE: 'K_PRICE', R_ENOUGH: 'K_ENOUGH', R_NO_SHELF: 'K_NO_SHELF', R_BUYER_NO: 'K_BUYER_NO', R_COMPETITOR: 'K_COMPETITOR', R_BUYER_ABSENT: 'K_BUYER_ABSENT' };
  FD.tipSlots = (sku, extra = {}) => {
    const s = sku ? FD.sku(sku) : null;
    return Object.assign(s ? { skuCode: s.code, cost: s.cost, rev: s.retail, price: s.street, earn: s.retail - s.cost, unitOf: s.code } : {}, extra);
  };
  FD.coachDrafts = st => FD.cached('coach', st, '', () => {
    const out = []; const wk = weekKey(st);
    for (const v of st.world.vsrs) {
      const mine = st.recs.filter(r => FD.recVsr(r) === v.id && inLast(st, r.date, 7));
      const add = (tpl, key, slots) => { const k = tpl + '|' + v.id + '|' + key + '|' + wk; if (!st.tipDone[k]) out.push({ key: k, vsr: v.id, tpl, slots }); };
      const priceBySku = {}; mine.filter(r => r.reason === 'R_PRICE').forEach(r => { priceBySku[r.sku] = (priceBySku[r.sku] || 0) + 1; });
      Object.entries(priceBySku).filter(([, n]) => n >= 3).forEach(([sku]) => add('K_PRICE', sku, FD.tipSlots(sku)));
      for (const [code, tpl] of [['R_ENOUGH', 'K_ENOUGH'], ['R_NO_SHELF', 'K_NO_SHELF'], ['R_BUYER_NO', 'K_BUYER_NO']]) if (mine.filter(r => r.reason === code).length >= 3) add(tpl, '', {});
      const comp = mine.filter(r => r.reason === 'R_COMPETITOR');
      if (comp.length >= 3) add('K_COMPETITOR', '', FD.tipSlots(mode(comp.map(r => r.sku)), { brandId: mode(comp.map(r => r.brand).filter(Boolean)) || 'BR_OTHER' }));
      const absent = {}; mine.filter(r => r.reason === 'R_BUYER_ABSENT').forEach(r => { absent[r.store] = (absent[r.store] || 0) + 1; });
      Object.entries(absent).filter(([, n]) => n >= 3).forEach(([s, n]) => add('K_BUYER_ABSENT', s, { storeId: s, n }));
      const decided = mine.filter(r => r.outcome && r.outcome !== 'CARRIED');
      if (decided.length >= 10 && pct(decided.filter(r => r.outcome === 'NOT_OFFERED').length, decided.length) >= 40) add('K_NOT_OFFERED', '', {});
      if (st.recs.filter(r => FD.recVsr(r) === v.id && NEEDS.includes(r.outcome) && !r.reason && !r.exempted && r.date < st.clock.date).length >= 3) add('K_REASONS', '', {});
      const ret = st.recs.find(r => r.vsr === v.id && r.maturity === 'RETURNED' && inLast(st, r.date, 28));
      if (ret) add('K_RETURN', ret.id, { unitOf: ret.alt || ret.sku, qty: 1 });
      const promoSkip = mine.find(r => r.type === 'PROMO' && r.outcome === 'NOT_OFFERED');
      if (promoSkip) { const p = st.world.promos.find(q => q.id === promoSkip.promo); if (p && p.end >= st.clock.date) add('K_PROMO', p.id, { promoId: p.promoId, date: p.end }); }
      const m = FD.vsrMetrics(st, v.id, FD.PILOT_START, st.clock.date);
      if (m.vsBaseline >= 10) add('K_GOOD', '', { pct: m.vsBaseline });
    }
    return out;
  });

  // ---------- insights (spec §14.L): sample ≥8 stores, ratio ≥1.5× or ≤0.67× ----------
  const GROUPS = ['GRP_SINGLES', 'GRP_CUPBOX', 'GRP_CAKEBAR', 'GRP_SLICE', 'GRP_SWISS', 'GRP_POUND', 'GRP_BUTTER', 'GRP_RUSK'];
  function pcsByStore(st) {
    return FD.cached('pcs', st, '', () => {
      const from = FD.addDays(st.clock.date, -56); const m = new Map();
      for (const o of st.orders) if (o.units > 0 && o.date > from && o.date <= st.clock.date) {
        const s = FD.sku(o.sku); const g = m.get(o.store) || m.set(o.store, {}).get(o.store); g[s.group] = (g[s.group] || 0) + o.units * s.pcs;
      }
      return m;
    });
  }
  FD.insights = st => FD.cached('ins', st, '', () => {
    const pcs = pcsByStore(st); const all = st.world.stores;
    const avg = (ss, g) => ss.reduce((a, s) => a + ((pcs.get(s.id) || {})[g] || 0), 0) / (ss.length || 1) / 8;
    const cands = [];
    for (const tag of FD.TAGS) {
      const ss = all.filter(s => s.tags.includes(tag)); if (ss.length < 8) continue;
      const rest = all.filter(s => !s.tags.includes(tag));
      for (const g of GROUPS) {
        const a = avg(ss, g), b = avg(rest, g); if (!b) continue; const ratio = a / b;
        const chart = { labels: ['TAGN_' + tag.slice(4), 'INS_OTHERS'], values: [a, b] };
        if (ratio >= 1.5) cands.push({ tpl: 'I_TAG_OVER', strength: ratio, slots: { tagId: tag, ratio, groupId: g }, chart, filter: { tag, group: g } });
        else if (ratio <= 0.67) cands.push({ tpl: 'I_TAG_UNDER', strength: 1 / ratio - 0.5, slots: { tagId: tag, pct: (1 - ratio) * 100, groupId: g }, chart, filter: { tag, group: g } });
      }
    }
    for (const l of FD.LABELS) {
      const ss = all.filter(s => s.label === l); if (ss.length < 8) continue; const rest = all.filter(s => s.label !== l);
      for (const g of GROUPS) { const a = avg(ss, g), b = avg(rest, g); if (b && a / b >= 1.5) cands.push({ tpl: 'I_LABEL_OVER', strength: a / b, slots: { labelId: l, ratio: a / b, groupId: g }, chart: { labels: ['LBL_' + l, 'INS_OTHERS'], values: [a, b] }, filter: { label: l, group: g } }); }
    }
    for (const z of FD.SIZES) {
      const ss = all.filter(s => s.size === z); if (ss.length < 8) continue;
      const single = avg(ss, 'GRP_SINGLES') + avg(ss, 'GRP_CAKEBAR') + avg(ss, 'GRP_SLICE'), fam = avg(ss, 'GRP_CUPBOX') + avg(ss, 'GRP_POUND') + avg(ss, 'GRP_SWISS');
      const share = pct(Math.max(single, fam), single + fam);
      if (share >= 60) cands.push({ tpl: 'I_SIZE_PACK', strength: share / 40, slots: { sizeId: z, packId: single >= fam ? 'PACK_SINGLE' : 'PACK_FAMILY', pct: share, catId: 'CAT_CAKE' }, chart: { labels: ['PACK_SINGLE', 'PACK_FAMILY'], values: [single, fam] }, filter: { size: z } });
    }
    const acc = FD.recAccuracy(st).slice().sort((a, b) => b.conv - a.conv);
    if (acc.length) cands.push({ tpl: 'I_TYPE_CONV', strength: 1.4, slots: { typeId: acc[0].type, pct: acc[0].conv }, chart: { labels: ['TYPE_' + acc[0].type, 'INS_OTHERS'], values: [acc[0].conv, acc.slice(1).reduce((a, x) => a + x.conv, 0) / Math.max(1, acc.length - 1)] }, filter: {} });
    const picked = []; const perTpl = {};
    for (const c of cands.sort((a, b) => b.strength - a.strength)) {
      if ((perTpl[c.tpl] || 0) >= 2) continue;
      perTpl[c.tpl] = (perTpl[c.tpl] || 0) + 1; picked.push(Object.assign(c, { key: c.tpl + '|' + JSON.stringify(c.slots) }));
      if (picked.length === 5) break;
    }
    return picked;
  });

  // ---------- breakdowns ----------
  FD.recsIn = (st, f = {}) => st.recs.filter(r => r.outcome && r.outcome !== 'CARRIED' && r.date <= st.clock.date && (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to)
    && (!f.route || store(st, r.store).route === f.route) && (!f.vsr || FD.recVsr(r) === f.vsr) && (!f.sku || r.sku === f.sku) && (!f.store || r.store === f.store));
  FD.reasonBreakdown = (st, f = {}) => FD.cached('rb', st, JSON.stringify(f), () => {
    const rs = FD.recsIn(st, f).filter(r => (f.kind ? r.outcome === f.kind : NEEDS.includes(r.outcome)) && !r.exempted);
    const groups = f.kind === 'NOT_OFFERED' ? FD.NF.map(c => ({ group: c, codes: [{ code: c, count: rs.filter(r => r.reason === c).length }] }))
      : Object.keys(FD.REASON_GROUPS).map(g => ({ group: g, codes: FD.REASON_GROUPS[g].map(c => ({ code: c, count: rs.filter(r => r.reason === c).length })) }));
    if (f.kind !== 'NOT_OFFERED') groups.push({ group: 'R_OTHER', codes: [{ code: 'R_OTHER', count: rs.filter(r => r.reason === 'R_OTHER').length }] });
    groups.push({ group: 'R_NONE', codes: [{ code: 'R_NONE', count: rs.filter(r => !r.reason).length }] });
    groups.forEach(g => { g.count = g.codes.reduce((a, c) => a + c.count, 0); });
    return groups;
  });
  FD.skuPerf = (st, from, to) => FD.cached('sp', st, from + to, () => FD.SKUS.map(s => {
    const carrying = st.world.stores.filter(x => FD.carries(st, x.id, s.code, to)).length;
    let sales = 0; for (const x of st.world.stores) for (const o of FD.storeOrders(st, x.id, s.code)) if (o.date >= from && o.date <= to) sales += o.value;
    const rs = FD.recsIn(st, { from, to, sku: s.code }).filter(r => SOLD.includes(r.outcome) || r.outcome === 'NOT_SOLD');
    const sold = rs.filter(r => SOLD.includes(r.outcome));
    const ret = st.returns.filter(x => x.sku === s.code && x.date >= from && x.date <= to).reduce((a, x) => a + x.value, 0);
    const promo = st.world.promos.find(p => p.skus.includes(s.code) && p.start <= to && p.end >= to);
    let promoUptake = null;
    if (promo) { const car = st.world.stores.filter(x => FD.carries(st, x.id, s.code, to, 56)); promoUptake = pct(car.filter(x => FD.storeOrders(st, x.id, s.code).some(o => o.date >= promo.start && o.units > 0)).length, car.length); }
    return { code: s.code, carrying, carryingPct: pct(carrying, st.world.stores.length), sales, attempts: rs.length, sold: sold.length, conv: pct(sold.length, rs.length),
      sustainedPct: pct(sold.filter(r => r.maturity === 'SUSTAINED').length, sold.length), returnRate: pct(ret, sales), promo: promo ? promo.id : null, promoUptake, watch: st.watchlist.includes(s.code) };
  }));
  FD.opportunities = (st, f = {}) => FD.cached('op', st, JSON.stringify(f), () => {
    const out = [];
    for (const s of st.world.stores) {
      if ((f.route && s.route !== f.route) || (f.vsr && s.vsr !== f.vsr) || (f.label && s.label !== f.label) || (f.tag && !s.tags.includes(f.tag))) continue;
      for (const r of FD.recommend(st, s.id, st.clock.date).recs) if (!f.cat || FD.sku(r.sku).category === f.cat)
        out.push({ store: s.id, sku: r.sku, type: r.type, ev: r.ev, value: r.value, qty: r.qty, reasonId: r.reasonId, slots: r.slots });
    }
    return out.sort((a, b) => b.ev - a.ev);
  });
  FD.recAccuracy = st => FD.cached('acc', st, '', () => ['LAPSED', 'UPGRADE', 'GAP', 'PROMO'].map(type => {
    const rs = FD.recsIn(st, {}).filter(r => r.type === type && (SOLD.includes(r.outcome) || r.outcome === 'NOT_SOLD'));
    return { type, sent: rs.length, conv: pct(rs.filter(r => SOLD.includes(r.outcome)).length, rs.length) };
  }));
})();
