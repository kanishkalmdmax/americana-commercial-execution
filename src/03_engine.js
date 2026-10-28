(function () {
  const FD = globalThis.FD;
  const PRIOR = { LAPSED: 0.55, UPGRADE: 0.40, GAP: 0.25, PROMO: 0.45 };
  const WEIGHT = { LAPSED: 1.0, UPGRADE: 0.85, GAP: 0.7, PROMO: 0.6 };
  // temporary reasons keep a rec open for the next visit; not-followed reasons are the salesman's call, not the store's no
  const TEMP = ['R_BUYER_ABSENT', 'R_NOT_ON_VAN', 'R_SYSTEM', 'R_CREDIT'];
  const NF = ['NF_FIT', 'NF_TIME', 'NF_BUSY', 'NF_OTHER'];
  const NO_COOLDOWN = TEMP.concat(NF);
  FD.TEMP = TEMP; FD.NF = NF;
  FD.PRIOR = PRIOR; FD.NO_COOLDOWN = NO_COOLDOWN;
  // reorder fallback gap and "carries it" window per category, in days (rules.catGap / rules.catWindow override)
  FD.CAT_GAP = { cake: 35, other: 38, biscuit: 44, rusk: 44, nuts: 44 };
  FD.CAT_WINDOW = { cake: 60, other: 75, biscuit: 90, rusk: 90, nuts: 90 }; // 'other' = canned; nuts follow cookies ("cookies and other")
  const catOf = code => (FD.sku(code) || {}).category;
  // a product exception (rules.skuGap / skuWindow) beats its category
  const gapOf = (ctx, code) => { const r = ctx.rules || {}; return (r.skuGap || {})[code] || (r.catGap || FD.CAT_GAP)[catOf(code)] || 44; };
  const winOf = (ctx, code) => { const r = ctx.rules || {}; return (r.skuWindow || {})[code] || (r.catWindow || FD.CAT_WINDOW)[catOf(code)] || 90; };
  FD.catWindow = (code, ctx) => winOf(ctx || FD.state || {}, code);
  FD.cycleGap = (code, ctx) => gapOf(ctx || FD.state || {}, code);
  // canned has no sisters in the product list (02_data skips it): same family and pack price is the same flavour line
  const canSis = new Map();
  FD.sistersOf = sku => { if (sku.category !== 'other') return sku.sisters; let v = canSis.get(sku.code);
    if (!v) { const fam = k => (FD.productMeta ? (FD.productMeta(k.code) || {}).family : k.group); v = FD.SKUS.filter(o => o !== sku && o.category === 'other' && o.cost === sku.cost && fam(o) === fam(sku)).map(o => o.code); canSis.set(sku.code, v); } return v; };
  const km = (a, b) => { if (!(isFinite(a.lat) && isFinite(a.lng) && isFinite(b.lat) && isFinite(b.lng))) return Infinity; const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dg = (b.lng - a.lng) * r;
    const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dg / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
  FD.distKm = km;
  const med = xs => { const s = xs.slice().sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2)) : 0; };

  // Append-only index over orders and recs. ponytail: in-place deletions or store edits need FD.invalidate(ctx).
  function idx(ctx) {
    let x = ctx._idx;
    if (!x || x.orders !== ctx.orders || x.recs !== ctx.recs || x.returns !== ctx.returns || x.storesArr !== ctx.world.stores || x.no > ctx.orders.length || x.nr > (ctx.recs || []).length || x.nret > (ctx.returns || []).length) {
      x = { orders: ctx.orders, recs: ctx.recs, returns: ctx.returns, storesArr: ctx.world.stores, no: 0, nr: 0, nret: 0, by: new Map(), byStore: new Map(), retByStore: new Map(), last: new Map(), rby: new Map(), stores: new Map(ctx.world.stores.map(s => [s.id, s])),
        peers: new Map(), byLabel: null, bySku: new Map(), vday: new Map(), fq: new Map(), cs: new Map() };
      Object.defineProperty(ctx, '_idx', { value: x, writable: true, configurable: true, enumerable: false });
    }
    for (; x.no < ctx.orders.length; x.no++) { const o = ctx.orders[x.no]; const k = o.store + '|' + o.sku; let a = x.by.get(k); if (!a) { x.by.set(k, a = []); (x.bySku.get(o.sku) || x.bySku.set(o.sku, []).get(o.sku)).push(a); } a.push(o); (x.byStore.get(o.store) || x.byStore.set(o.store, []).get(o.store)).push(o); if (!(x.last.get(k) >= o.date)) x.last.set(k, o.date);
      if (o.units > 0 && o.vsr) { const dk = o.vsr + '|' + o.date; const d = x.vday.get(dk) || x.vday.set(dk, [0, 0]).get(dk); d[0] += o.value || 0; if (catOf(o.sku) === 'other') d[1] += o.value || 0; } }
    const recs = ctx.recs || [];
    for (; x.nr < recs.length; x.nr++) { const r = recs[x.nr]; (x.rby.get(r.store) || x.rby.set(r.store, []).get(r.store)).push(r); }
    const rets = ctx.returns || [];
    for (; x.nret < rets.length; x.nret++) { const rt = rets[x.nret]; (x.retByStore.get(rt.store) || x.retByStore.set(rt.store, []).get(rt.store)).push(rt); }
    return x;
  }
  FD.invalidate = ctx => { if (ctx) ctx._idx = null; };
  FD.storeRecs = (ctx, storeId) => idx(ctx).rby.get(storeId) || [];
  FD.returnsOf = (ctx, storeId) => { idx(ctx); return idx(ctx).retByStore.get(storeId) || []; };
  FD.storeAllOrders = (ctx, storeId) => idx(ctx).byStore.get(storeId) || []; // every order line of a store, oldest first
  // products delivered to a store that are about to expire: delivered + life - 9 <= iso < delivered + life, with no reorder of that product since
  FD.expiryChecks = (ctx, storeId, iso) => { const last = new Map();
    for (const o of FD.storeAllOrders(ctx, storeId)) if (o.units > 0 && o.date <= iso && !(last.get(o.sku) >= o.date)) last.set(o.sku, o.date);
    const out = []; for (const [sku, delivered] of last) { const k = FD.sku(sku); if (!k) continue; const expires = FD.addDays(delivered, k.life);
      if (FD.addDays(expires, -9) <= iso && iso < expires) out.push({ sku, delivered, expires }); }
    return out.sort((a, b) => (a.expires < b.expires ? -1 : 1)); };
  const ordersOf = (ctx, storeId, code) => idx(ctx).by.get(storeId + '|' + code) || [];
  const storeOf = (ctx, id) => idx(ctx).stores.get(id);

  FD.storeOrders = ordersOf;
  FD.lastOrder = (ctx, storeId, code, before) => {
    let last = null; for (const o of ordersOf(ctx, storeId, code)) if (o.date < before && (!last || o.date > last)) last = o.date; return last;
  };
  // fast path: the latest order is on or before asOf (always true up to today); otherwise scan
  // a store "carries" a product while its last order is inside the product's category window (cake 60, canned 75, cookies and rusks 90 days)
  FD.carries = (ctx, storeId, code, asOf, win) => { if (win == null) win = winOf(ctx, code); const last = idx(ctx).last.get(storeId + '|' + code); if (!last) return false;
    if (last <= asOf) return FD.daysBetween(last, asOf) <= win; return ordersOf(ctx, storeId, code).some(o => o.date <= asOf && FD.daysBetween(o.date, asOf) <= win); };
  // similar stores: same sales class, any salesman; the nearest within 3 km, at least 8 (reaching further), at most 40; closed stores never count
  FD.peers = (ctx, s) => { const x = idx(ctx); let v = x.peers.get(s.id);
    if (!v) { if (!x.byLabel) { x.byLabel = new Map(); for (const p of ctx.world.stores) if (!p.closed) (x.byLabel.get(p.label) || x.byLabel.set(p.label, []).get(p.label)).push(p); }
      const ds = (x.byLabel.get(s.label) || []).filter(p => p.id !== s.id).map(p => ({ p, d: km(s, p) })).sort((a, b) => a.d - b.d);
      const near = ds.filter(e => e.d <= 3).length; v = ds.slice(0, Math.min(40, Math.max(8, near))).map(e => e.p); x.peers.set(s.id, v); }
    return v; };
  // last order date per product (units > 0, before iso), memoised per store order count (the GAP check asks this for every peer)
  const lastMap = (ctx, storeId, iso) => { const x = idx(ctx); const os = x.byStore.get(storeId) || []; const k = storeId + '|' + iso + '|' + os.length; let v = x.cs.get(k);
    if (!v) { v = new Map(); for (const o of os) if (o.units > 0 && o.date < iso && !(v.get(o.sku) >= o.date)) v.set(o.sku, o.date); x.cs.set(k, v); } return v; };
  // products a store carried (inside each product's category window) before iso
  const carriedSet = (ctx, storeId, iso) => { const v = new Set(); for (const [c, d] of lastMap(ctx, storeId, iso)) if (FD.daysBetween(d, iso) <= winOf(ctx, c)) v.add(c); return v; };
  FD.carriedSet = carriedSet;
  FD.activePromo = (ctx, code, iso) => (ctx.world.promos || []).find(p => p.skus.includes(code) && p.start <= iso && p.end >= iso);
  const mustStock = (ctx, s, code) => { const m = ctx.rules.mustStock || {}; return [s.label, ...(s.tags || [])].some(k => (m[k] || []).includes(code)); }; // area assortment: by sales class and nearby places
  const pinnedFor = (ctx, s, code, iso) => (ctx.pins || []).some(p => p.sku === code && (!p.until || p.until >= iso) &&
    (!p.scope || (p.scope === 'store' && p.id === s.id) || (p.scope === 'tag' && (s.tags || []).includes(p.id)) || (p.scope === 'label' && s.label === p.id) || (p.scope === 'route' && s.route === p.id)));

  // order days of a store x product before iso (units > 0), oldest first, with the packs ordered that day
  const hist = (ctx, storeId, code, iso) => { const m = new Map(); for (const o of ordersOf(ctx, storeId, code)) if (o.date < iso && o.units > 0) m.set(o.date, (m.get(o.date) || 0) + o.units); return [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1)); };
  // reorder cycle: the store-product's own gaps (up to 120 days) plus the category gap counted twice, averaged; no gaps gives the category gap
  const cycleOf = (days, cg) => { let sum = 0, n = 0; for (let i = 1; i < days.length; i++) { const g = FD.daysBetween(days[i - 1][0], days[i][0]); if (g <= 120) { sum += g; n++; } } return Math.round((sum + 2 * cg) / (n + 2)); };
  const usualOf = days => Math.max(1, med(days.slice(-3).map(d => d[1])));
  FD.cycle = (ctx, storeId, code, iso) => cycleOf(hist(ctx, storeId, code, iso), gapOf(ctx, code));
  FD.usual = (ctx, storeId, code, iso) => { const d = hist(ctx, storeId, code, iso); return d.length ? usualOf(d) : 0; }; // median of the last 3 orders
  // the product's usual first order: median over stores of the packs on their first order day (before iso); too few stores falls back to the median order line
  FD.firstQty = (ctx, code, iso) => { const x = idx(ctx); const k = code + '|' + iso; let v = x.fq.get(k);
    if (v === undefined) { const firsts = [];
      for (const arr of x.bySku.get(code) || []) { let d0 = null; for (const o of arr) if (o.units > 0 && o.date < iso && (d0 === null || o.date < d0)) d0 = o.date;
        if (d0 !== null) firsts.push(arr.reduce((a, o) => a + (o.date === d0 && o.units > 0 ? o.units : 0), 0)); }
      v = firsts.length >= 3 ? Math.max(1, med(firsts)) : Math.max(1, (FD.sku(code) || {}).line || 1); x.fq.set(k, v); }
    return v; };
  // the salesman's canned share of this month's sales so far (0..1)
  const cannedShare = (ctx, vsr, iso) => { const x = idx(ctx); let tot = 0, can = 0; for (let d = iso.slice(0, 8) + '01'; d < iso; d = FD.addDays(d, 1)) { const a = x.vday.get(vsr + '|' + d); if (a) { tot += a[0]; can += a[1]; } } return tot ? can / tot : 0; };
  FD.cannedShare = cannedShare;
  const cashAt = (s, iso) => (FD.overdueAt && FD.TODAY && iso < FD.TODAY ? FD.overdueAt(s.id, iso) : (s.overdue || 0)) > 0;

  FD.candidates = function (ctx, storeId, iso) {
    const s = storeOf(ctx, storeId); const out = []; const peers = FD.peers(ctx, s);
    const peerCarry = new Map(); for (const p of peers) for (const c of carriedSet(ctx, p.id, iso)) peerCarry.set(c, (peerCarry.get(c) || 0) + 1);
    // a store that bought any canned product in the last 90 days fits the grocery range
    const cannedRecent = FD.SKUS.some(k => k.category === 'other' && ordersOf(ctx, storeId, k.code).some(o => o.units > 0 && o.date < iso && FD.daysBetween(o.date, iso) <= 90));
    for (const sku of FD.SKUS) {
      const code = sku.code; const days = hist(ctx, storeId, code, iso);
      if (days.length) {
        const since = FD.daysBetween(days[days.length - 1][0], iso);
        // due once the days since the last order reach the store's own cycle for this product (never beyond the shelf life)
        if (since >= Math.min(cycleOf(days, gapOf(ctx, code)), sku.life)) {
          const usual = usualOf(days);
          out.push({ sku: code, type: 'LAPSED', reasonId: 'B_LAPSED', slots: { days: since, qty: usual }, usual });
          continue;
        }
      } else {
        if (!peers.length) continue;
        const carryPct = Math.round(100 * (peerCarry.get(code) || 0) / peers.length);
        const must = mustStock(ctx, s, code);
        // canned: fits where the store bought canned lately (and some similar stores carry it) or a quarter of its similar stores carry it; ponytail: the 10% floor keeps a never-carried line out
        const fits = sku.category === 'other' ? (carryPct >= 25 || (cannedRecent && carryPct >= 10)) : (carryPct >= 25 && (must || carryPct >= 35));
        if (fits) out.push({ sku: code, type: 'GAP', reasonId: must ? 'B_GAP_MUST' : 'B_GAP_NEAR', slots: { pct: carryPct, labelId: s.label }, first: true });
        continue;
      }
      // steady buyer (23 Oct rule): 2+ order days in 56 days, or a usual-size order in the last 35 days with no return of the product since
      const recent = days.filter(d => FD.daysBetween(d[0], iso) <= 56).length, u = usualOf(days);
      const fullRecent = days.find(d => FD.daysBetween(d[0], iso) <= 35 && d[1] >= u);
      if (recent >= 2 || (fullRecent && !FD.returnsOf(ctx, storeId).some(x => x.sku === code && x.date >= fullRecent[0] && x.date < iso))) {
        if (sku.bigger && !ordersOf(ctx, storeId, sku.bigger).some(o => o.date < iso && FD.daysBetween(o.date, iso) <= 60))
          out.push({ sku: sku.bigger, type: 'UPGRADE', reasonId: 'B_UP_PACK', slots: { skuSmall: code }, first: !ordersOf(ctx, storeId, sku.bigger).some(o => o.date < iso && o.units > 0) });
        for (const sis of FD.sistersOf(sku)) if (!ordersOf(ctx, storeId, sis).some(o => o.date < iso) && !out.some(c => c.sku === sis)) {
          out.push({ sku: sis, type: 'UPGRADE', reasonId: 'B_UP_FLAVOUR', slots: { skuHave: code }, first: true }); break;
        }
        const promo = FD.activePromo(ctx, code, iso);
        if (promo) out.push({ sku: code, type: 'PROMO', reasonId: 'B_PROMO', slots: { promoId: promo.promoId, date: promo.end }, promo: promo.id });
      }
    }
    const seen = new Set(); return out.filter(c => !seen.has(c.sku) && seen.add(c.sku));
  };

  FD.gate = function (ctx, storeId, cand, iso, vsr) {
    const s = storeOf(ctx, storeId); const sku = FD.sku(cand.sku); const van = ctx.vanStock[vsr || s.vsr] || {};
    if (s.onboarding !== 'APPROVED') return 'GATE_ONBOARD';
    if (s.credit === 'BLOCKED') return 'GATE_CREDIT';
    const pinned = pinnedFor(ctx, s, cand.sku, iso);
    if ((ctx.watchlist || []).includes(cand.sku) && !pinned) return 'GATE_WATCH';
    if ((ctx.blocks || []).some(b => b.recId ? (b.store === storeId && b.sku === cand.sku && b.date === iso)
      : ((b.store === storeId && !b.sku) || (b.sku === cand.sku && (!b.store || b.store === storeId))))) return 'GATE_BLOCKED';
    let lastNo = null;
    const srecs = FD.storeRecs(ctx, storeId);
    for (const r of srecs) if (r.sku === cand.sku && r.date < iso && (r.outcome === 'NOT_SOLD' || r.outcome === 'NOT_OFFERED') && r.reason && !NO_COOLDOWN.includes(r.reason) && (!lastNo || r.date > lastNo.date)) lastNo = r;
    if (lastNo && FD.daysBetween(lastNo.date, iso) < ctx.rules.cooldownDays && !(ctx.cooldownOverrides || []).includes(storeId + '|' + cand.sku)) return 'GATE_COOLDOWN';
    if (ctx.rules.vanFeed && (van[cand.sku] || 0) <= 0) return 'GATE_VAN';
    if (cand.type === 'GAP') {
      // ponytail: gated per product group (cupcake boxes, cake bars...), not the handoff's whole "cake" category, which blocked almost every gap
      const open = srecs.some(r => r.date < iso && r.type === 'GAP' && FD.sku(r.sku).group === sku.group && ['FULL', 'PARTIAL', 'ALT'].includes(r.outcome) && r.maturity === 'PENDING');
      const returned = (idx(ctx).retByStore.get(storeId) || []).some(x => FD.sku(x.sku).group === sku.group && x.date <= iso && FD.daysBetween(x.date, iso) < winOf(ctx, x.sku));
      if (open || returned) return 'GATE_FIRSTFILL';
    }
    if (s.shelf === 'low' && sku.pcs >= 18) return 'GATE_SHELF';
    const gap = s.days.length ? Math.ceil(7 / s.days.length) : 7;
    if (sku.life < gap + 7) return 'GATE_LIFE';
    return null;
  };

  // quantity (packs): a reorder offers the store's usual (median of its last 3 orders), capped by shelf space and van stock;
  // a first order offers the product's usual first order, never above firstFillMax cartons (units per carton = pcsPerCrt)
  FD.qty = function (ctx, storeId, cand, vsr, iso) {
    const s = storeOf(ctx, storeId); const sku = FD.sku(cand.sku); const caps = [];
    if (cand.first) {
      caps.push(Math.max(1, Math.round(FD.firstQty(ctx, cand.sku, iso || (ctx.clock || {}).date || FD.TODAY) * (s.shelf === 'low' ? 0.5 : 1))));
      if (sku.pcsPerCrt) caps.push(Math.max(1, Math.floor(sku.pcsPerCrt * ((ctx.rules && ctx.rules.firstFillMax) || 1))));
    } else {
      caps.push(Math.max(1, Math.round((sku.line || 1) * ({ low: 0.5, med: 1, high: 1.5 }[s.shelf] || 1))));
      if (cand.type === 'LAPSED') caps.push(cand.usual || cand.slots.qty);
    }
    if (ctx.rules.vanFeed) caps.push((ctx.vanStock[vsr || s.vsr] || {})[cand.sku] || 0);
    return Math.max(1, Math.min(...caps));
  };

  FD.recommend = function (ctx, storeId, iso, vsr) {
    const recs = [], gated = [];
    const s = storeOf(ctx, storeId); let share = null; const cash = cashAt(s, iso);
    for (const c of FD.candidates(ctx, storeId, iso)) {
      const g = FD.gate(ctx, storeId, c, iso, vsr);
      if (g) { gated.push({ sku: c.sku, gate: g, type: c.type }); continue; }
      const sku = FD.sku(c.sku); const qty = FD.qty(ctx, storeId, c, vsr, iso);
      const value = qty * sku.cost; // sale value, SAR ex-VAT (store margin needs observed shelf prices, which are not collected yet)
      const pin = pinnedFor(ctx, s, c.sku, iso) ? 0.2 : 0;
      // canned ranks higher while the salesman's canned share of this month's sales is under 30%
      let lift = 1; if (sku.category === 'other') { if (share === null) share = cannedShare(ctx, vsr || s.vsr, iso); if (share < 0.3) lift = (ctx.rules && ctx.rules.cannedLift) || 1.1; }
      // usual = what the store takes on a reorder; extra (units above usual) is filled when the order is graded; cash = the store has overdue invoices, so the offer is a cash sale
      recs.push({ store: storeId, sku: c.sku, type: c.type, qty, usual: c.type === 'LAPSED' ? c.usual : null, extra: 0, cash, reasonId: c.reasonId, slots: c.slots, promo: c.promo || null, pinned: !!pin,
        ev: +(value * PRIOR[c.type]).toFixed(2), value: +value.toFixed(2), score: value * PRIOR[c.type] * (WEIGHT[c.type] + pin) * lift }); // ev: expected sale = value x chance
    }
    // priority is growing what the store already buys: at most one new product per store, unless the supervisor pinned it
    let gaps = 0;
    const nonPromo = recs.filter(r => r.type !== 'PROMO').sort((a, b) => b.score - a.score).filter(r => r.type !== 'GAP' || r.pinned || gaps++ < 1);
    const promos = recs.filter(r => r.type === 'PROMO').sort((a, b) => b.score - a.score);
    const max = ctx.rules.maxPerStore;
    let out = nonPromo.slice(0, max);
    if (promos.length && max >= 3 && (out.length < max || promos[0].score > out[max - 1].score)) out = [...out.slice(0, Math.min(out.length, max - 1)), promos[0]];
    out.forEach(r => delete r.score);
    return { recs: out, gated };
  };
})();
(function () {
  const FD = globalThis.FD;
  const SOLD = ['FULL', 'PARTIAL', 'ALT'];
  FD.SOLD = SOLD;
  // SalesBuzz order lines for the visit -> outcome. Compares pieces so box/piece invoicing both grade correctly.
  FD.grade = function (rec, lines, storeHistory) {
    const sku = FD.sku(rec.sku);
    const want = (rec.qtyModified ?? rec.qty) * sku.pcs;
    const got = lines.filter(l => l.sku === rec.sku).reduce((a, l) => a + l.units, 0);
    if (got > 0 && got * sku.pcs >= want) return { outcome: 'FULL', got, alt: null };
    if (got > 0) return { outcome: 'PARTIAL', got, alt: null };
    const related = [...FD.sistersOf(sku), sku.bigger].filter(Boolean);
    const known = new Set(storeHistory.map(o => o.sku));
    const alt = lines.find(l => related.includes(l.sku) && !known.has(l.sku));
    if (alt) return { outcome: 'ALT', got: alt.units, alt: alt.sku };
    return { outcome: 'NOT_SOLD', got: 0, alt: null };
  };
  // maturity states: PENDING (waiting), SUSTAINED (a real repeat order inside the window), RETURNED (returned inside the window), NOT_REORDERED (window closed with neither)
  FD.CLOSED = ['SUSTAINED', 'NOT_REORDERED', 'RETURNED']; // rates count only these
  FD.maturity = function (ctx, rec, iso) {
    if (!SOLD.includes(rec.outcome)) return null;
    // the category window (cake 60 ... cookies 90 days) starts on the day it actually sold (a revisit sale can be days after the recommendation)
    const sku = rec.alt || rec.sku; const base = rec.soldOn || rec.date; const end = FD.addDays(base, FD.catWindow(sku, ctx));
    const rets = ctx.world ? FD.returnsOf(ctx, rec.store) : ctx.returns.filter(x => x.store === rec.store); // bare fixtures have no world to index
    const ords = ctx.world ? FD.storeOrders(ctx, rec.store, sku) : ctx.orders.filter(o => o.store === rec.store && o.sku === sku);
    if (rets.some(x => x.sku === sku && x.date >= base && x.date <= end && x.date <= iso)) return 'RETURNED';
    if (ords.some(o => !(o.units <= 0) && o.date > base && o.date <= end && o.date <= iso)) return 'SUSTAINED';
    return iso > end ? 'NOT_REORDERED' : 'PENDING';
  };
  // upsell = a sold recommendation that is not a plain reorder; a reorder counts only for the units above the store's usual (rec.extra)
  FD.isUpsell = rec => !!rec && SOLD.includes(rec.outcome) && (rec.type !== 'LAPSED' || (rec.extra || 0) > 0);
  FD.upsellValue = rec => { if (!FD.isUpsell(rec)) return 0; const c = FD.sku(rec.alt || rec.sku).cost; return rec.type === 'LAPSED' ? (rec.extra || 0) * c : (rec.got || 0) * c; };
  FD.setExtra = rec => { rec.extra = rec.type === 'LAPSED' && SOLD.includes(rec.outcome) ? Math.max(0, (rec.got || 0) - (rec.usual || 0)) : 0; return rec; };
  FD.engineMisses = function (ctx, storeId, iso, lines, recs) {
    const known = new Set(ctx.orders.filter(o => o.store === storeId && o.date < iso).map(o => o.sku));
    const recSkus = new Set(recs.map(r => r.sku)); const altSkus = new Set(recs.filter(r => r.alt).map(r => r.alt));
    const out = lines.filter(l => !known.has(l.sku) && !recSkus.has(l.sku) && !altSkus.has(l.sku)).map(l => ({ store: storeId, sku: l.sku, type: 'UNREC', recSku: null }));
    recs.filter(r => r.outcome === 'ALT').forEach(r => out.push({ store: storeId, sku: r.alt, type: 'ALT', recSku: r.sku }));
    return out;
  };
})();
