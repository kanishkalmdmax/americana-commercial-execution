(function () {
  const FD = globalThis.FD;
  FD.SLOTS = ['vsr', 'vsr2', 'sup', 'store', 'sku', 'sku2', 'sku_small', 'sku_have', 'sku_list', 'sku_group', 'alt', 'n', 'qty', 'got', 'unit', 'pcs', 'price', 'cost', 'rev', 'earn', 'days', 'pct', 'ratio', 'tag', 'label', 'size', 'pack_type', 'category', 'type', 'area', 'reason', 'gate', 'brand', 'promo', 'date', 'time', 'route', 'status', 'change', 'snippet', 'tip', 'tip_title', 'rank', 'move', 'topic', 'money'];

  // Ids the spec lists as prose (not tables) plus ids introduced by the plan.
  // Spec tables are generated into 01_text_catalog.js by gen_catalog.py.
  const E = (en, ar) => ({ en, ar });
  FD.CATALOG = Object.assign(FD.CATALOG || {}, {
    SK_CLOSED: E('Store closed', 'المحل مغلق'), SK_LATER: E('Buyer asked to come later', 'طلب المشتري الحضور لاحقاً'),
    SK_ROAD: E('Road closed or no access', 'الطريق مغلق أو لا يمكن الوصول'), SK_COLLECT: E('Collection only', 'تحصيل فقط'),
    SK_TIME: E('Out of time', 'انتهى الوقت'), SK_OTHER: E('Other', 'أخرى'),
    RG_BUYER: E('Buyer', 'المشتري'), RG_STOCK: E('Stock at store', 'المخزون في المحل'), RG_MONEY: E('Money', 'السعر والائتمان'),
    RG_COMP: E('Competition', 'المنافسون'), RG_OURS: E('Our side', 'من جهتنا'),
    BR_LUSINE: E("L'usine", 'لوزين'), BR_7DAYS: E('7Days', 'سفن دايز'), BR_SABAHOO: E('Sabahoo', 'صباحو'), BR_OTHER: E('Other brand', 'علامة أخرى'),
    TAG_SCHOOL: E('near a school', 'قرب مدرسة'), TAG_MOSQUE: E('near a mosque', 'قرب مسجد'), TAG_DENSE: E('in high-density housing', 'في حي سكني مكتظ'),
    TAG_VILLA: E('in villa areas', 'في أحياء الفلل'), TAG_WORKERS: E("near workers' housing", 'قرب سكن العمال'), TAG_OFFICE: E('in office areas', 'في المناطق المكتبية'),
    TAG_PETROL: E('at petrol stations', 'في محطات الوقود'), TAG_HOSPITAL: E('near a hospital', 'قرب مستشفى'), TAG_UNI: E('near a university', 'قرب جامعة'),
    TAGN_SCHOOL: E('Near school', 'قرب مدرسة'), TAGN_MOSQUE: E('Near mosque', 'قرب مسجد'), TAGN_DENSE: E('High-density residential', 'سكني مكتظ'),
    TAGN_VILLA: E('Villas', 'فلل'), TAGN_WORKERS: E("Workers' housing", 'سكن عمال'), TAGN_OFFICE: E('Offices', 'مكاتب'),
    TAGN_PETROL: E('Petrol / highway', 'محطة وقود / طريق سريع'), TAGN_HOSPITAL: E('Near hospital', 'قرب مستشفى'), TAGN_UNI: E('University', 'جامعة'),
    GATE_ONBOARD: E('onboarding pending', 'التسجيل غير مكتمل'), GATE_CREDIT: E('credit blocked', 'الائتمان موقوف'),
    GATE_WATCH: E('on returns watchlist', 'ضمن قائمة المرتجعات'), GATE_BLOCKED: E('blocked by supervisor', 'موقوف من المشرف'),
    GATE_COOLDOWN: E('asked again too soon', 'تم عرضه مؤخراً'), GATE_VAN: E('not on van', 'غير متوفر في السيارة'),
    GATE_FIRSTFILL: E('earlier first order not settled', 'طلب أول سابق لم يستقر'), GATE_SHELF: E('shelf too small', 'الرف صغير'),
    GATE_LIFE: E('shelf life too short', 'مدة الصلاحية قصيرة'),
    GRP_SINGLES: E('single cupcakes', 'الكب كيك المفرد'), GRP_CUPBOX: E('cupcake boxes', 'علب الكب كيك'), GRP_CAKEBAR: E('cake bars', 'الكيك بار'),
    GRP_SLICE: E('slice cakes', 'كيك الشرائح'), GRP_SWISS: E('swiss rolls', 'السويس رول'), GRP_POUND: E('pound cakes', 'الباوند كيك'),
    GRP_BUTTER: E('cookies', 'البسكويت'), GRP_RUSK: E('rusks', 'الشابورة'),
    PACK_SINGLE: E('singles', 'القطع المفردة'), PACK_FAMILY: E('family packs', 'العبوات العائلية'),
    QR_AGAIN: E('Try again next visit', 'حاول في الزيارة القادمة'), QR_ONEBOX: E('Start with one box', 'ابدأ بعلبة واحدة'),
    QR_NOTED: E('Noted, thank you', 'تم، شكراً'), QR_CALL: E('I will call the store', 'سأتصل بالمحل'),
    QR_SKIP: E('Skip this store for now', 'تجاوز هذا المحل حالياً'), QR_PROMO: E('Use the current promo', 'استخدم العرض الحالي'),
    F_WATCH_OK: E('{sku} returns fell from {n}% to {pct}% on the watchlist', 'انخفضت مرتجعات {sku} من {n}٪ إلى {pct}٪ خلال المراقبة'),
    F_WATCH_OK_C: E('{days} days on the watchlist. Take it off so it can be recommended again.', '{days} يوماً في قائمة المراقبة. أزله ليعود للتوصيات.'),
    F_WATCH_BAD: E('{sku} returns are still {pct}% after {days} days on the watchlist', 'مرتجعات {sku} ما زالت {pct}٪ بعد {days} يوماً من المراقبة'),
    F_WATCH_BAD_C: E('Before the watchlist: {n}%. Keep watching or block it.', 'قبل المراقبة: {n}٪. استمر في المراقبة أو أوقفه.'),
    ACT_UNWATCH: E('Take off watchlist', 'إزالة من المراقبة'), ACT_REVIEW_PRODUCT: E('Review product', 'مراجعة المنتج'), AU_WATCH_KEEP: E('Watchlist extended', 'تم تمديد المراقبة'),
    B_SUP: E('Your supervisor picked this for this store.', 'اختاره مشرفك لهذا المحل.'),
    N_PLAN_SUP: E('{sup} updated your plan at {store}', 'حدّث {sup} خطتك في {store}'),
    SK_SUP: E('Removed by supervisor', 'أزاله المشرف'), SK_SUP_ADDED: E('Added by supervisor', 'أضافه المشرف'),
    AU_REASON_ADD: E('Reason added', 'أضيف سبب'), AU_REASON_EDIT: E('Reason renamed', 'أعيدت تسمية سبب'), AU_REASON_HIDE: E('Reason hidden', 'أخفي سبب'), AU_REASON_SHOW: E('Reason shown again', 'أعيد إظهار سبب'),
    R_EXEMPTED: E('Exempted', 'معفى'), R_NONE: E('No reason given', 'لا يوجد سبب'),
  });

  FD.t = function (id, slots) {
    const ov = FD.state && FD.state.reasonEdit && ((FD.state.reasonEdit.custom || {})[id] || (FD.state.reasonEdit.names || {})[id]);
    const e = ov && (ov.en || ov.ar) ? { en: ov.en || ov.ar, ar: ov.ar || ov.en } : FD.CATALOG[id];
    if (!e) throw new Error('Unknown text id ' + id);
    if (ov && (ov.en || ov.ar)) return e[FD.lang] || e.en;
    return (e[FD.lang] || e.en).replace(/\{(\w+)\}/g, (m, k) => (slots && slots[k] != null) ? String(slots[k]) : '');
  };
  FD.has = id => !!FD.CATALOG[id];

  const loc = () => FD.lang === 'ar' ? (FD.digits === 'arab' ? 'ar-SA-u-nu-arab' : 'ar-SA-u-nu-latn') : 'en-GB';
  const nf = {};
  const numFmt = dp => { const k = loc() + dp; return nf[k] || (nf[k] = new Intl.NumberFormat(loc(), { minimumFractionDigits: dp, maximumFractionDigits: dp })); };
  FD.fmt = {
    num: (n, dp = 0) => numFmt(dp).format(n),
    money: n => FD.fmt.num(n, 2) + (FD.lang === 'ar' ? ' ريال' : ' SAR'),
    money0: n => FD.fmt.num(Math.round(n)) + (FD.lang === 'ar' ? ' ريال' : ' SAR'),
    pct: n => FD.fmt.num(Math.round(n)) + (FD.lang === 'ar' ? '٪' : '%'),
    signedPct: n => (n > 0 ? '+' : n < 0 ? '−' : '') + FD.fmt.pct(Math.abs(n)),
    date: iso => new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z')),
    dateLong: iso => new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z')),
    time: hhmm => { const [h, m] = hhmm.split(':').map(Number); return FD.fmt.num(h) + ':' + (numFmt(0).format(m).length === 1 ? numFmt(0).format(0) : '') + numFmt(0).format(m); }
  };
})();
