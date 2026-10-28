(function () {
  const FD = globalThis.FD;
  const R = FD.REAL;
  const E = (en, ar) => ({ en, ar });
  Object.assign(FD.CATALOG, {
    CAT_OTHER: E('Canned', 'معلبات'), CAT_NUTS: E('Nuts', 'المكسرات'), PROMO_CB_51: E('5 cases + 1 free', '٥ كراتين + ١ مجاناً'), PROMO_BC_1OFF: E('1 SAR off per piece', 'خصم ١ ريال لكل قطعة'), PROMO_SR_10: E('10% off', 'خصم ١٠٪'),
    LBL_PERFECT: E('Perfect Store', 'متجر مثالي'), LBL_A: E('Class A', 'فئة أ'), LBL_B: E('Class B', 'فئة ب'), LBL_C: E('Class C', 'فئة ج'), LBL_PRESALES: E('Pre-Sales', 'ما قبل البيع'),
    SIZE_SMALL: E('Small baqala', 'بقالة صغيرة'), SIZE_LARGE: E('Large baqala', 'بقالة كبيرة'), SIZE_MINI: E('Mini-market', 'ميني ماركت'),
    CAT_CAKE: E('Cakes', 'الكيك'), CAT_BISCUIT: E('Cookies', 'البسكويت'), CAT_RUSK: E('Rusks', 'الشابورة'), 
    // area profiles (name of the kind of area around a store)
    PROFN_AP_SCHOOL: E('School & youth belt', 'حزام المدارس والشباب'), PROFN_AP_EXPAT: E('Expat bachelor & market', 'عزاب الوافدين والأسواق'),
    PROFN_AP_FAMILY: E('Saudi family residential', 'سكني عائلي سعودي'), PROFN_AP_HIGHINC: E('High-income & compound', 'دخل مرتفع ومجمعات سكنية'),
    PROFN_AP_MEDICAL: E('Hospital & shift workers', 'مستشفيات وعمال النوبات'), PROFN_AP_HIGHWAY: E('Highway, fuel & industrial', 'طرق سريعة ووقود وصناعي'),
    PROFN_AP_GENERAL: E('General', 'عام'),
  });

  // ---------- products (SalesBuzz EA pack is the unit; a CRT line = pcsPerCrt packs) ----------
  const LIFE = { cake: 30, biscuit: 270, rusk: 120, nuts: 270, other: 365 }; // default shelf life (days) until Americana supplies it
  // sku.cost = SalesBuzz uPrice per piece, SAR ex-VAT. The store's invoice adds 15% VAT, so anything quoted to a store uses FD.withVat.
  FD.VAT = 0.15; FD.withVat = v => +(v * (1 + FD.VAT)).toFixed(2);
  // ponytail: shelf price = what the store pays incl. VAT x 1.3, until real shelf prices are collected
  const shelf = c => Math.max(c + 0.25, Math.round(FD.withVat(c) * 1.3 * 4) / 4);
  FD.SKUS = R.skus.map(k => {
    const retail = shelf(k.cost);
    return { code: k.code, name: k.name_en, name_ar: k.name_ar, group: k.group, category: k.category, unit: 'piece', units: 'pieces', unit_ar: 'قطعة', units_ar: 'قطع',
      pcs: 1, cost: k.cost, street: retail, retail, life: LIFE[k.category], rank: k.rank, crt: k.crt, pcsPerCrt: k.pcsPerCrt, sisters: [], bigger: null };
  });
  const byCode = Object.fromEntries(FD.SKUS.map(s => [s.code, s]));
  { const q = {}; for (const l of R.lines) (q[l[4]] || (q[l[4]] = [])).push(l[5]); // median packs per real order line
    for (const k of FD.SKUS) { const v = (q[k.code] || [1]).sort((a, b) => a - b); k.line = v[Math.floor(v.length / 2)]; } }
  FD.sku = code => byCode[code];
  FD.recommendable = code => !!byCode[code]; // 27 Oct: canned goes through the same recommendation logic
  const flavour = n => (n.match(/Vanilla|Chocolate|Strawberry|Marble|Fruit|Original|Peanut|Raspberry/) || [''])[0];
  for (const s of FD.SKUS) {
    s.sisters = FD.SKUS.filter(o => o !== s && o.group === s.group && o.cost === s.cost && o.category !== 'other').map(o => o.code);
    const grams = n => +((n.match(/(\d+)g/) || [0, 0])[1]);
    if (s.group === 'GRP_SINGLES') { const b = FD.SKUS.filter(o => o.group === 'GRP_CUPBOX' && flavour(o.name) === flavour(s.name)).sort((x, y) => Math.abs(grams(x.name) - grams(s.name)) - Math.abs(grams(y.name) - grams(s.name)))[0]; if (b) s.bigger = b.code; }
  }

  // ponytail: profiles are placeholders (seeded from the store id) until the data team's area profiles arrive.
  // Area type = one profile per store; nearby places (tags) = the map points behind it, shown to the supervisor only.
  FD.PROFILES = ['AP_SCHOOL', 'AP_EXPAT', 'AP_FAMILY', 'AP_HIGHINC', 'AP_MEDICAL', 'AP_HIGHWAY', 'AP_GENERAL'];
  // anchors within 300 m (school, mosque, hospital, petrol station, university, market), then neighbourhood types (geospatial plan section 4)
  FD.TAGS = ['TAG_SCHOOL', 'TAG_MOSQUE', 'TAG_HOSPITAL', 'TAG_PETROL', 'TAG_UNI', 'TAG_MARKET', 'TAG_DENSE', 'TAG_VILLA', 'TAG_WORKERS', 'TAG_OFFICE'];
  const PROFILE_TAG = { AP_SCHOOL: 'TAG_SCHOOL', AP_EXPAT: 'TAG_WORKERS', AP_FAMILY: 'TAG_MOSQUE', AP_HIGHINC: 'TAG_VILLA', AP_MEDICAL: 'TAG_HOSPITAL', AP_HIGHWAY: 'TAG_PETROL' };
  FD.LABELS = ['A', 'B', 'C'];
  FD.RELIEF_ROUTES = ['RYD_11']; // reference list: RYD_11 is the relief van (covers absent salesmen's routes)
  FD.SIZES = ['SMALL', 'LARGE', 'MINI'];
  FD.HOOD_AR = Object.fromEntries(R.stores.map(s => [s.hood_en, s.hood_ar]));

  // ---------- real feeds by date ----------
  const byDate = (rows, at = 0) => { const m = new Map(); for (const r of rows) (m.get(r[at]) || m.set(r[at], []).get(r[at])).push(r); return m; };
  const PLAN = byDate(R.plan), STOPS = byDate(R.stops), LINES = byDate(R.lines), PAYS = byDate(R.pays), RETS = byDate(R.returns);
  FD.realPlan = iso => (PLAN.get(iso) || []).map(([, van, store, seq]) => ({ van, store, seq }));
  FD.realStops = iso => (STOPS.get(iso) || []).map(([, van, store, start, end, nc, onPlan, collected]) => ({ van, store, start, end, nc, onPlan: !!onPlan, collected: collected || 0 })); // collected = SAR paid on a stop with no order
  // cash collected but not yet approved by the cashier, per van: { sar, n, oldest }; takes the van id (V01) or its route (RYD_01)
  const PENDING = R.pendingCash || {};
  FD.pendingCash = van => PENDING[van] || PENDING['V' + String(van).slice(-2)] || { sar: 0, n: 0, oldest: null };
  FD.realLines = (iso, van, store) => (LINES.get(iso) || []).filter(l => l[2] === van && l[3] === store).map(([, time, , , sku, units, value]) => ({ sku, units, value, time }));
  FD.realPays = iso => (PAYS.get(iso) || []).map(([, time, van, store, amount]) => ({ time, van, store, amount }));
  // open invoices a store already had before a day (still open at extract time), and the part past its due date on that day
  FD.dueBefore = (store, iso) => ((FD.REAL.dues || {})[store] || []).filter(([d]) => d < iso).reduce((a, [, v]) => a + v, 0);
  FD.overdueAt = (store, iso) => ((FD.REAL.dues || {})[store] || []).filter(([d, , due]) => d < iso && due < iso).reduce((a, [, v]) => a + v, 0);
  FD.overdueDays = (store, iso) => ((FD.REAL.dues || {})[store] || []).filter(([d, , due]) => d < iso && due < iso).reduce((a, [, , due]) => Math.max(a, FD.daysBetween(due, iso)), 0);
  FD.realReturns = iso => (RETS.get(iso) || []).map(([, van, store, sku, units, value, reason, saleDate]) => ({ van, store, sku, units, value, reason, saleDate: saleDate || null }));
  FD.ncReason = id => { const e = FD.CATALOG['NC_' + id]; return e ? [e.en, e.ar] : null; }; // fixed text per SalesBuzz no-sale code
  const DAYS = new Map(); for (const l of R.lines) { const k = l[3] + '|' + l[4]; (DAYS.get(k) || DAYS.set(k, new Set()).get(k)).add(l[0]); }
  FD.orderedElsewhen = (store, sku, iso) => { const d = DAYS.get(store + '|' + sku); return !!d && [...d].some(x => x !== iso); }; // store buys it on some other day in the extract

  FD.buildWorld = function () {
    const hood = {}; for (const s of R.stores) hood[s.van] = [s.hood_en, s.hood_ar];
    const routes = R.vans.filter(v => v.kind !== 'inactive').map(v => ({ id: v.route, name: `${v.route} · ${(hood[v.id] || [''])[0]}`, name_ar: `${v.route.replace('RYD_', 'مسار ')} · ${(hood[v.id] || ['', ''])[1]}`, hoods: [(hood[v.id] || [''])[0]], remote: false, relief: FD.RELIEF_ROUTES.includes(v.route) }));
    const vans = R.vans.filter(v => v.kind !== 'inactive'); // a van with a plan and no visits all month adds nothing to the mockup
    const vsrs = vans.map(v => ({ id: v.id, name: v.name_en, name_ar: v.name_ar, route: v.route, kind: v.kind, sup: v.sup, first: v.first, last: v.last, outOfRoute: v.outOfRoute || null }));
    const routeOf = Object.fromEntries(vsrs.map(v => [v.id, v.route]));
    // weekly packs per product per store over the history weeks (drives quantities and future-day orders)
    const weeks = FD.daysBetween(FD.HIST_START, FD.TODAY) / 7; const carry = {};
    for (const l of R.lines) if (l[0] < FD.TODAY) { const c = carry[l[3]] || (carry[l[3]] = {}); c[l[4]] = (c[l[4]] || 0) + l[5] / weeks; }
    const hash = s => { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
    // size from the trade name (markets / centres are mini-markets; baqala, shop, corner are small), else from the store's sales class;
    // shelf space follows the sales class. Area profile is a seeded placeholder (see FD.PROFILES).
    const sizeOf = s => /أسواق|اسواق|سوبر|هايبر|مركز/.test(s.name_ar) ? 'MINI' : /بقالة|بقاله|محل|ركن|كشك/.test(s.name_ar) ? 'SMALL' : s.cls === 'A' ? 'LARGE' : 'SMALL';
    const stores = R.stores.map(s => {
      const r = FD.rng(hash(s.id)); const profile = FD.pick(r, FD.PROFILES);
      // ponytail: nearby places are placeholders that agree with the area type, until the map join (geospatial plan §4) arrives
      const rt = FD.rng(hash(s.id + 'tag')), tags = [PROFILE_TAG[profile] || FD.pick(rt, FD.TAGS)];
      if (rt() < 0.5) { const x = FD.pick(rt, FD.TAGS); if (!tags.includes(x)) tags.push(x); }
      const due = ((R.dues || {})[s.id] || []).filter(([d, , x]) => d < FD.TODAY && x < FD.TODAY).map(x => x[2]).sort()[0] || null; // same test as FD.overdueAt
      const c = {}; for (const [k, w] of Object.entries(carry[s.id] || {})) c[k] = Math.max(1, Math.round(w));
      return { id: s.id, sb: s.sb, name: s.name_en, name_ar: s.name_ar, route: routeOf[s.van], vsr: s.van, hood: s.hood_en, lat: s.lat, lng: s.lng,
        label: s.cls, size: sizeOf(s), tags, profile, closed: null, relocate: s.gps === 'a' /* no known position: confirm on the next visit */, shelf: { A: 'high', B: 'med', C: 'low' }[s.cls] || 'med',
        credit: FD.overdueDays(s.id, FD.TODAY) > 30 ? 'WATCH' : 'OK', overdue: +FD.overdueAt(s.id, FD.TODAY).toFixed(2), openAr: +FD.dueBefore(s.id, FD.TODAY).toFixed(2), oldestDue: due, balance: s.balance || 0, creditLimit: s.creditLimit || 0, onboarding: 'APPROVED', days: s.days, phone: '+9665' + String(10000000 + hash(s.sb) % 89999999), carry: c, dropped: {} };
    });
    const top = FD.SKUS.filter(k => k.category !== 'other').slice(0, 8);
    const promos = [
      { id: 'P1', skus: [top[0].code], promoId: 'PROMO_CB_51', start: '2026-10-01', end: '2026-10-31' },
      { id: 'P2', skus: [top[3].code], promoId: 'PROMO_BC_1OFF', start: '2026-10-10', end: '2026-10-31' },
      { id: 'P3', skus: [top[5].code], promoId: 'PROMO_SR_10', start: '2026-10-15', end: '2026-10-25' },
      { id: 'P4', skus: [top[7].code], promoId: 'PROMO_SR_10', start: '2026-09-22', end: '2026-10-14' },
    ];
    const sups = R.sups.map(s => ({ id: s.id, name: s.name_en, name_ar: s.name_ar }));
    return { supervisor: sups[0], sups, vsrs, routes, stores, promos };
  };

  // Order lines for a future day (beyond the extract), from each store's real weekly packs.
  FD.baselineLines = function (r, s, d) {
    const out = [];
    if (s.credit === 'BLOCKED' || s.onboarding === 'PENDING') return out;
    for (const [code, weekly] of Object.entries(s.carry)) {
      if (s.dropped[code] && d >= s.dropped[code]) continue;
      const units = Math.floor(weekly / Math.max(1, s.days.length) * (0.7 + r() * 0.6) + r());
      if (units > 0) out.push({ sku: code, units });
    }
    return out;
  };

  // Real visits, orders and returns between two dates (inclusive), plus pre-baseline order history in R.lines for 14-28d lookback.
  FD.buildHistory = function (world, seed, from, to) {
    const visits = [], orders = [], returns = []; let vid = 0, oid = 0, rid = 0;
    for (const [d, time, van, store, sku, units, value] of R.lines) if (d < from)
      orders.push({ id: 'OH' + (++oid), store, vsr: van, date: d, sku, units, value, time, src: 'SB' });
    for (let d = from; d <= to; d = FD.addDays(d, 1)) {
      const stops = FD.realStops(d); const key = (v, s) => v + '|' + s;
      const done = new Map(stops.map(x => [key(x.van, x.store), x])); const routeOf = v => (world.vsrs.find(x => x.id === v) || {}).route;
      const plan = FD.realPlan(d); const planned = new Set(plan.map(p => key(p.van, p.store)));
      for (const p of plan) { const x = done.get(key(p.van, p.store));
        visits.push({ id: 'VH' + (++vid), store: p.store, vsr: p.van, route: routeOf(p.van), date: d, seq: p.seq, status: x ? 'DONE' : 'MISSED', arrivedAt: x ? x.start : null, leftAt: x ? x.end : null, nc: x ? x.nc : 0, real: true, ...(x && x.collected > 0 ? { collected: x.collected } : {}) }); }
      const maxSeq = {}; for (const p of plan) maxSeq[p.van] = Math.max(maxSeq[p.van] || 0, p.seq);
      for (const x of stops) if (!planned.has(key(x.van, x.store)))
        visits.push({ id: 'VH' + (++vid), store: x.store, vsr: x.van, route: routeOf(x.van), date: d, seq: (maxSeq[x.van] = (maxSeq[x.van] || 0) + 1), status: 'DONE', arrivedAt: x.start, leftAt: x.end, nc: x.nc, offPlan: true, real: true, ...(x.collected > 0 ? { collected: x.collected } : {}) });
      for (const x of stops) for (const l of FD.realLines(d, x.van, x.store))
        orders.push({ id: 'OH' + (++oid), store: x.store, vsr: x.van, date: d, sku: l.sku, units: l.units, value: l.value, time: l.time, src: 'SB' });
      for (const x of FD.realReturns(d)) returns.push({ id: 'RH' + (++rid), store: x.store, sku: x.sku, date: d, saleDate: x.saleDate || null, units: x.units, value: x.value, reason: x.reason, vsr: x.van });
    }
    return { visits, orders, returns };
  };
})();
