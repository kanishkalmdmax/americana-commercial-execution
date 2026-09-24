(function () {
  const FD = globalThis.FD;
  const E = (en, ar) => ({ en, ar });
  Object.assign(FD.CATALOG, {
    PROMO_CB_51: E('5 boxes + 1 free', '٥ علب + ١ مجاناً'), PROMO_BC_1OFF: E('1 SAR off per box', 'خصم ١ ريال لكل علبة'), PROMO_SR_10: E('10% off', 'خصم ١٠٪'),
    LBL_PERFECT: E('Perfect Store', 'متجر مثالي'), LBL_A: E('Class A', 'فئة أ'), LBL_B: E('Class B', 'فئة ب'), LBL_C: E('Class C', 'فئة ج'), LBL_PRESALES: E('Pre-Sales', 'ما قبل البيع'),
    SIZE_SMALL: E('Small baqala', 'بقالة صغيرة'), SIZE_LARGE: E('Large baqala', 'بقالة كبيرة'), SIZE_MINI: E('Mini-market', 'ميني ماركت'),
    CAT_CAKE: E('Cakes', 'الكيك'), CAT_BISCUIT: E('Cookies', 'البسكويت'), CAT_RUSK: E('Rusks', 'الشابورة'),
  });

  // [code, name, name_ar, group, category, unit, pcs, cost, street, life, rank] — spec §5.1
  const RAW = [
    ['3040421754', 'Vanilla Cupcake 18s', 'كب كيك فانيلا ١٨ قطعة', 'GRP_CUPBOX', 'cake', 'box', 18, 8.81, 1.00, 21, 88],
    ['3040421723', 'Vanilla Cupcake Single', 'كب كيك فانيلا مفرد', 'GRP_SINGLES', 'cake', 'inner', 10, 5.55, 1.00, 21, 34],
    ['3040421779', 'Chocolate Cupcake 18s', 'كب كيك شوكولاتة ١٨ قطعة', 'GRP_CUPBOX', 'cake', 'box', 18, 9.55, 1.00, 21, 84],
    ['3040421724', 'Chocolate Cupcake Single', 'كب كيك شوكولاتة مفرد', 'GRP_SINGLES', 'cake', 'inner', 10, 5.68, 1.00, 21, 32],
    ['3040421778', 'Strawberry Cupcake 18s', 'كب كيك فراولة ١٨ قطعة', 'GRP_CUPBOX', 'cake', 'box', 18, 9.29, 1.00, 21, 74],
    ['3040430755', 'Cake Bar Chocolate 12s', 'كيك بار شوكولاتة ١٢', 'GRP_CAKEBAR', 'cake', 'box', 12, 14.13, 1.50, 60, 12],
    ['3040430754', 'Cake Bar Vanilla 12s', 'كيك بار فانيلا ١٢', 'GRP_CAKEBAR', 'cake', 'box', 12, 14.24, 1.50, 60, 10],
    ['3040430756', 'Cake Bar Strawberry 12s', 'كيك بار فراولة ١٢', 'GRP_CAKEBAR', 'cake', 'box', 12, 14.06, 1.50, 60, 15],
    ['3040421650', 'Vanilla Slice Cake 70g', 'كيك شرائح فانيلا ٧٠ غ', 'GRP_SLICE', 'cake', 'box', 24, 22.48, 1.50, 30, 52],
    ['3040421651', 'Fruit Slice Cake 70g', 'كيك شرائح فواكه ٧٠ غ', 'GRP_SLICE', 'cake', 'box', 24, 23.24, 1.50, 30, 58],
    ['3040311723', 'Swiss Roll Chocolate 3 pcs', 'سويس رول شوكولاتة ٣ قطع', 'GRP_SWISS', 'cake', 'carton', 8, 28.07, 5.50, 45, 3],
    ['3040311722', 'Swiss Roll Strawberry 3 pcs', 'سويس رول فراولة ٣ قطع', 'GRP_SWISS', 'cake', 'carton', 8, 27.87, 5.50, 45, 5],
    ['3040311721', 'Swiss Roll Vanilla 3 pcs', 'سويس رول فانيلا ٣ قطع', 'GRP_SWISS', 'cake', 'carton', 8, 27.15, 5.50, 45, 7],
    ['3040321140', 'Pound Cake Vanilla Packet', 'باوند كيك فانيلا', 'GRP_POUND', 'cake', 'carton', 6, 72.11, 17.00, 30, 2],
    ['3040321142', 'Pound Cake Chocolate Packet', 'باوند كيك شوكولاتة', 'GRP_POUND', 'cake', 'carton', 6, 70.00, 17.00, 30, 4],
    ['3040321144', 'Pound Cake Marble Packet', 'باوند كيك رخامي', 'GRP_POUND', 'cake', 'carton', 6, 68.92, 17.00, 30, 16],
    ['3040421157', 'Pound Cake Chocolate 220g', 'باوند كيك شوكولاتة ٢٢٠ غ', 'GRP_POUND', 'cake', 'carton', 6, 64.25, 14.50, 30, 6],
    ['3040421156', 'Pound Cake Vanilla 220g', 'باوند كيك فانيلا ٢٢٠ غ', 'GRP_POUND', 'cake', 'carton', 6, 62.31, 14.50, 30, 9],
    ['3040441124', 'Butter Cookies Blue 12×44g', 'بسكويت زبدة أزرق ١٢×٤٤ غ', 'GRP_BUTTER', 'biscuit', 'box', 12, 9.60, 1.50, 270, 28],
    ['3040441106', 'Butter Cookies Tin 454g', 'بسكويت زبدة علبة معدنية ٤٥٤ غ', 'GRP_BUTTER', 'biscuit', 'tin', 1, 15.28, 21.00, 365, 19],
    ['3040441206', 'Choco Cookies Tin 605g', 'كوكيز شوكولاتة علبة معدنية ٦٠٥ غ', 'GRP_BUTTER', 'biscuit', 'tin', 1, 16.15, 25.75, 365, 67],
    ['3050402701', 'Fresh Rusk Brown 375g', 'شابورة بر ٣٧٥ غ', 'GRP_RUSK', 'rusk', 'bag', 1, 4.83, 8.00, 120, 56],
    ['3050402703', 'Fresh Rusk Red 375g', 'شابورة حمراء ٣٧٥ غ', 'GRP_RUSK', 'rusk', 'bag', 1, 4.71, 8.00, 120, 59],
    ['3050402704', 'Fresh Rusk Diet 350g', 'شابورة دايت ٣٥٠ غ', 'GRP_RUSK', 'rusk', 'bag', 1, 4.64, 9.25, 120, 61],
  ];
  const UNIT = { box: ['box', 'boxes', 'علبة', 'علب'], inner: ['inner', 'inners', 'كرتونة صغيرة', 'كراتين صغيرة'], carton: ['carton', 'cartons', 'كرتونة', 'كراتين'], tin: ['tin', 'tins', 'علبة معدنية', 'علب معدنية'], bag: ['bag', 'bags', 'كيس', 'أكياس'] };
  FD.SKUS = RAW.map(([code, name, name_ar, group, category, unit, pcs, cost, street, life, rank]) => ({
    code, name, name_ar, group, category, unit: UNIT[unit][0], units: UNIT[unit][1], unit_ar: UNIT[unit][2], units_ar: UNIT[unit][3],
    pcs, cost, street, retail: +(pcs * street).toFixed(2), life, rank, sisters: [], bigger: null }));
  const byCode = Object.fromEntries(FD.SKUS.map(s => [s.code, s]));
  FD.sku = code => byCode[code];
  for (const s of FD.SKUS) s.sisters = FD.SKUS.filter(o => o !== s && o.group === s.group && o.pcs === s.pcs && o.unit === s.unit).map(o => o.code);
  byCode['3040421723'].bigger = '3040421754'; byCode['3040421724'].bigger = '3040421779';
  byCode['3040421157'].bigger = '3040321142'; byCode['3040421156'].bigger = '3040321140';

  const VSRS = [['V1', 'Omar Farooq', 'عمر فاروق'], ['V2', 'Imran Siddiqui', 'عمران صديقي'], ['V3', 'Ahmed Saleh', 'أحمد صالح'],
    ['V4', 'Faisal Al-Harbi', 'فيصل الحربي'], ['V5', 'Rashid Khan', 'راشد خان'], ['V6', 'Yousef Nasser', 'يوسف ناصر']];
  const HOODS = [['Al Olaya', 'Al Malaz', 'Al Naseem'], ['Al Rawdah', 'Al Sulay', 'Al Aziziyah'], ['Al Shifa', 'Al Suwaidi', 'Al Badiah'],
    ['Al Yarmouk', 'Al Nahdah', 'Al Hamra'], ['Al Uraija', 'Al Munsiyah', 'Tuwaiq'], ['Al Dar Al Baida', 'Al Qirawan', 'Al Nakheel']];
  FD.HOOD_AR = { 'Al Olaya': 'العليا', 'Al Malaz': 'الملز', 'Al Naseem': 'النسيم', 'Al Rawdah': 'الروضة', 'Al Sulay': 'السلي', 'Al Aziziyah': 'العزيزية', 'Al Shifa': 'الشفا', 'Al Suwaidi': 'السويدي', 'Al Badiah': 'البديعة', 'Al Yarmouk': 'اليرموك', 'Al Nahdah': 'النهضة', 'Al Hamra': 'الحمراء', 'Al Uraija': 'عريجاء', 'Al Munsiyah': 'المونسية', 'Tuwaiq': 'طويق', 'Al Dar Al Baida': 'الدار البيضاء', 'Al Qirawan': 'القيروان', 'Al Nakheel': 'النخيل' };
  const CENTER = [[24.69, 46.68], [24.73, 46.77], [24.57, 46.69], [24.80, 46.80], [24.60, 46.57], [24.55, 46.85]];
  const NAMES = [['Baqala Al Nour', 'بقالة النور'], ['Al Rayyan Grocery', 'تموينات الريان'], ['Tamayoz Mini Market', 'ميني ماركت التميز'], ['Baqala Al Salam', 'بقالة السلام'], ['Al Waha Grocery', 'تموينات الواحة'], ['Baqala Al Fajr', 'بقالة الفجر'], ['Al Madina Market', 'أسواق المدينة'], ['Baqala Al Khair', 'بقالة الخير'], ['Al Hayat Grocery', 'تموينات الحياة'], ['Baqala Al Rawabi', 'بقالة الروابي'], ['Al Yamamah Mini Market', 'ميني ماركت اليمامة'], ['Baqala Al Amal', 'بقالة الأمل'], ['Al Diyar Grocery', 'تموينات الديار'], ['Baqala Al Sadaqah', 'بقالة الصداقة'], ['Al Bayan Market', 'أسواق البيان']];
  FD.TAGS = ['TAG_SCHOOL', 'TAG_MOSQUE', 'TAG_DENSE', 'TAG_VILLA', 'TAG_WORKERS', 'TAG_OFFICE', 'TAG_PETROL', 'TAG_HOSPITAL', 'TAG_UNI'];
  FD.LABELS = ['PERFECT', 'A', 'B', 'C', 'PRESALES'];
  FD.SIZES = ['SMALL', 'LARGE', 'MINI'];
  const BASE = { GRP_SINGLES: 20, GRP_CUPBOX: 10, GRP_CAKEBAR: 14, GRP_SLICE: 12, GRP_SWISS: 6, GRP_POUND: 3, GRP_BUTTER: 8, GRP_RUSK: 4 };
  const MULT = { TAG_SCHOOL: { GRP_SINGLES: 3, GRP_CAKEBAR: 2.5 }, TAG_DENSE: { GRP_CUPBOX: 2, GRP_POUND: 2 }, TAG_VILLA: { GRP_CUPBOX: 1.8, GRP_POUND: 2.2, GRP_BUTTER: 1.5 },
    TAG_WORKERS: { GRP_RUSK: 2.5, GRP_SWISS: 2, GRP_POUND: 0.4 }, TAG_OFFICE: { GRP_CAKEBAR: 1.6, GRP_SLICE: 1.5 }, TAG_PETROL: { GRP_SINGLES: 1.8, GRP_SLICE: 1.6 } };

  FD.buildWorld = function (seed) {
    const r = FD.rng(seed);
    const routes = HOODS.map((h, i) => ({ id: 'R' + (i + 1), name: `Route ${i + 1} · ${h[0]} – ${h[2]}`, name_ar: `المسار ${i + 1} · ${FD.HOOD_AR[h[0]]} – ${FD.HOOD_AR[h[2]]}`, hoods: h, remote: i === 5 }));
    const vsrs = VSRS.map(([id, name, name_ar], i) => ({ id, name, name_ar, route: routes[i].id }));
    const labels = ['PERFECT', 'A', 'A', 'B', 'B', 'B', 'B', 'C', 'C', 'PRESALES'];
    const stores = []; let n = 0;
    routes.forEach((rt, ri) => {
      for (let k = 0; k < 15; k++) {
        n++; const [nm, nmAr] = NAMES[(k + ri * 4) % NAMES.length];
        const hood = rt.hoods[k % 3];
        const tags = [FD.TAGS[FD.int(r, 0, FD.TAGS.length - 1)]];
        if (r() < 0.5) { const t = FD.pick(r, FD.TAGS); if (!tags.includes(t)) tags.push(t); }
        const days = rt.remote ? [[6, 2], [0, 3], [1, 4]][k % 3] : (k < 8 ? [6, 1, 3] : [0, 2, 4]);
        const s = { id: 'ST-' + String(n).padStart(3, '0'), name: `${nm}, ${hood}`, name_ar: `${nmAr}، ${FD.HOOD_AR[hood]}`,
          route: rt.id, vsr: vsrs[ri].id, hood, lat: +(CENTER[ri][0] + (r() - 0.5) * 0.04).toFixed(5), lng: +(CENTER[ri][1] + (r() - 0.5) * 0.04).toFixed(5),
          label: FD.pick(r, labels), size: FD.pick(r, ['SMALL', 'SMALL', 'LARGE', 'MINI']), tags, shelf: FD.pick(r, ['low', 'med', 'med', 'high']),
          credit: 'OK', onboarding: 'APPROVED', days, phone: '+9665' + String(FD.int(r, 10000000, 99999999)), carry: {}, dropped: {} };
        for (const sku of FD.SKUS) {
          let w = BASE[sku.group] * (0.6 + r() * 0.8);
          for (const t of tags) w *= (MULT[t] && MULT[t][sku.group]) || 1;
          if (r() < Math.min(0.9, 0.25 + w / 60)) s.carry[sku.code] = Math.round(w);
        }
        const carried = Object.keys(s.carry);
        if (carried.length > 2 && r() < 0.25) s.dropped[FD.pick(r, carried)] = FD.addDays(FD.TODAY, -FD.int(r, 22, 40));
        stores.push(s);
      }
    });
    ['ST-004', 'ST-033', 'ST-061'].forEach(id => { stores.find(s => s.id === id).credit = 'WATCH'; });
    stores.find(s => s.id === 'ST-047').credit = 'BLOCKED';
    stores.find(s => s.id === 'ST-078').onboarding = 'PENDING';
    const promos = [
      { id: 'P1', skus: ['3040430754'], promoId: 'PROMO_CB_51', start: '2026-11-01', end: '2026-11-30' },
      { id: 'P2', skus: ['3040441124'], promoId: 'PROMO_BC_1OFF', start: '2026-11-05', end: '2026-11-25' },
      { id: 'P3', skus: ['3040311723'], promoId: 'PROMO_SR_10', start: '2026-11-10', end: '2026-11-21' },
      { id: 'P4', skus: ['3040421754'], promoId: 'PROMO_SR_10', start: '2026-10-12', end: '2026-10-25' },
      { id: 'P5', skus: ['3050402701'], promoId: 'PROMO_BC_1OFF', start: '2026-10-15', end: '2026-10-31' },
    ];
    return { supervisor: { id: 'S1', name: 'Khalid Al-Mutairi', name_ar: 'خالد المطيري' }, vsrs, routes, stores, promos };
  };

  // Baseline order lines for one store visit (shared by history and pilot simulation).
  FD.baselineLines = function (r, s, d) {
    const out = [];
    if (s.credit === 'BLOCKED' || s.onboarding === 'PENDING') return out;
    for (const [code, weekly] of Object.entries(s.carry)) {
      if (s.dropped[code] && d >= s.dropped[code]) continue;
      const sku = FD.sku(code);
      const units = Math.floor(weekly / s.days.length * (0.7 + r() * 0.6) / sku.pcs + r());
      if (units > 0) out.push({ sku: code, units });
    }
    return out;
  };

  FD.buildHistory = function (world, seed, from, to) {
    const r = FD.rng(seed + 1); const visits = [], orders = [], returns = [];
    let oid = 0, vid = 0;
    for (let d = from; d <= to; d = FD.addDays(d, 1)) {
      if (!FD.isSellingDay(d)) continue;
      const dw = FD.dow(d);
      for (const v of world.vsrs) {
        world.stores.filter(s => s.vsr === v.id && s.days.includes(dw)).forEach((s, i) => {
          visits.push({ id: 'VI' + (++vid), store: s.id, vsr: v.id, date: d, seq: i + 1, status: 'DONE' });
          for (const l of FD.baselineLines(r, s, d))
            orders.push({ id: 'O' + (++oid), store: s.id, vsr: v.id, date: d, sku: l.sku, units: l.units, value: +(l.units * FD.sku(l.sku).cost).toFixed(2), src: 'SB' });
        });
      }
    }
    return { visits, orders, returns };
  };
})();
