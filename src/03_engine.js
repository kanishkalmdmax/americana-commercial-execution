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

  // Append-only index over orders and recs. ponytail: in-place deletions or store edits need FD.invalidate(ctx).
  function idx(ctx) {
    let x = ctx._idx;
    if (!x || x.orders !== ctx.orders || x.recs !== ctx.recs || x.storesArr !== ctx.world.stores || x.no > ctx.orders.length || x.nr > (ctx.recs || []).length) {
      const peers = new Map();
      for (const s of ctx.world.stores) peers.set(s.id, ctx.world.stores.filter(p => p.id !== s.id && p.size === s.size && (p.label === s.label || p.tags.some(t => s.tags.includes(t)))));
      x = { orders: ctx.orders, recs: ctx.recs, storesArr: ctx.world.stores, no: 0, nr: 0, by: new Map(), rby: new Map(), stores: new Map(ctx.world.stores.map(s => [s.id, s])), peers };
      Object.defineProperty(ctx, '_idx', { value: x, writable: true, configurable: true, enumerable: false });
    }
    for (; x.no < ctx.orders.length; x.no++) { const o = ctx.orders[x.no]; const k = o.store + '|' + o.sku; (x.by.get(k) || x.by.set(k, []).get(k)).push(o); }
    const recs = ctx.recs || [];
    for (; x.nr < recs.length; x.nr++) { const r = recs[x.nr]; (x.rby.get(r.store) || x.rby.set(r.store, []).get(r.store)).push(r); }
    return x;
  }
  FD.invalidate = ctx => { if (ctx) ctx._idx = null; };
  FD.storeRecs = (ctx, storeId) => idx(ctx).rby.get(storeId) || [];
  const ordersOf = (ctx, storeId, code) => idx(ctx).by.get(storeId + '|' + code) || [];
  const storeOf = (ctx, id) => idx(ctx).stores.get(id);

  FD.storeOrders = ordersOf;
  FD.lastOrder = (ctx, storeId, code, before) => {
    let last = null; for (const o of ordersOf(ctx, storeId, code)) if (o.date < before && (!last || o.date > last)) last = o.date; return last;
  };
  FD.carries = (ctx, storeId, code, asOf, win = 28) => ordersOf(ctx, storeId, code).some(o => o.date <= asOf && FD.daysBetween(o.date, asOf) <= win);
  FD.peers = (ctx, s) => idx(ctx).peers.get(s.id) || [];
  FD.activePromo = (ctx, code, iso) => (ctx.world.promos || []).find(p => p.skus.includes(code) && p.start <= iso && p.end >= iso);
  const mustStock = (ctx, s, code) => { const m = ctx.rules.mustStock || {}; return [s.label, ...s.tags].some(k => (m[k] || []).includes(code)); };
  const pinnedFor = (ctx, s, code, iso) => (ctx.pins || []).some(p => p.sku === code && (!p.until || p.until >= iso) &&
    (!p.scope || (p.scope === 'store' && p.id === s.id) || (p.scope === 'tag' && s.tags.includes(p.id)) || (p.scope === 'label' && s.label === p.id) || (p.scope === 'route' && s.route === p.id)));

  FD.candidates = function (ctx, storeId, iso) {
    const s = storeOf(ctx, storeId); const out = []; const peers = FD.peers(ctx, s);
    for (const sku of FD.SKUS) {
      const code = sku.code; const all = ordersOf(ctx, storeId, code).filter(o => o.date < iso);
      const last = all.length ? all.reduce((m, o) => o.date > m ? o.date : m, all[0].date) : null;
      if (all.length >= 2 && FD.daysBetween(last, iso) >= ctx.rules.lapsedDays) {
        const avg = Math.max(1, Math.round(all.reduce((a, o) => a + o.units, 0) / all.length));
        out.push({ sku: code, type: 'LAPSED', reasonId: 'B_LAPSED', slots: { days: FD.daysBetween(last, iso), qty: avg } });
        continue;
      }
      if (all.length === 0) {
        if (!peers.length) continue;
        const carryPct = Math.round(100 * peers.filter(p => FD.carries(ctx, p.id, code, iso)).length / peers.length);
        const must = mustStock(ctx, s, code);
        if (carryPct >= 40 && (must || carryPct >= 60)) {
          const sharedTag = s.tags.find(t => peers.some(p => p.tags.includes(t)));
          out.push({ sku: code, type: 'GAP', reasonId: must ? 'B_GAP_MUST' : (sharedTag ? 'B_GAP_TAG' : 'B_GAP_LABEL'), slots: { pct: carryPct, tagId: sharedTag, labelId: s.label } });
        }
        continue;
      }
      const recent = all.filter(o => FD.daysBetween(o.date, iso) <= 28).length;
      if (recent >= 3) {
        if (sku.bigger && !ordersOf(ctx, storeId, sku.bigger).some(o => o.date < iso && FD.daysBetween(o.date, iso) <= 60))
          out.push({ sku: sku.bigger, type: 'UPGRADE', reasonId: 'B_UP_PACK', slots: { skuSmall: code } });
        for (const sis of sku.sisters) if (!ordersOf(ctx, storeId, sis).some(o => o.date < iso) && !out.some(c => c.sku === sis)) {
          out.push({ sku: sis, type: 'UPGRADE', reasonId: 'B_UP_FLAVOUR', slots: { skuHave: code } }); break;
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
      const returned = ctx.returns.some(x => x.store === storeId && FD.sku(x.sku).group === sku.group && x.date <= iso && FD.daysBetween(x.date, iso) < ctx.rules.maturityDays);
      if (open || returned) return 'GATE_FIRSTFILL';
    }
    if (s.shelf === 'low' && sku.pcs >= 18) return 'GATE_SHELF';
    const gap = s.days.length ? Math.ceil(7 / s.days.length) : 7;
    if (sku.life < gap + 7) return 'GATE_LIFE';
    return null;
  };

  FD.qty = function (ctx, storeId, cand, vsr) {
    const s = storeOf(ctx, storeId); const sku = FD.sku(cand.sku);
    const days = Math.ceil(7 / s.days.length);
    const rates = FD.peers(ctx, s).map(p => (p.carry && p.carry[cand.sku]) || 0).filter(Boolean);
    const weekly = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : sku.pcs;
    const caps = [Math.max(1, Math.round(weekly / 7 * days / sku.pcs)), { low: 1, med: 2, high: 3 }[s.shelf]];
    if (cand.type === 'GAP') caps.push(ctx.rules.firstFillMax);
    if (cand.type === 'LAPSED') caps.push(cand.slots.qty);
    if (ctx.rules.vanFeed) caps.push((ctx.vanStock[vsr || s.vsr] || {})[cand.sku] || 0);
    return Math.max(1, Math.min(...caps));
  };

  FD.recommend = function (ctx, storeId, iso, vsr) {
    const recs = [], gated = [];
    const s = storeOf(ctx, storeId);
    for (const c of FD.candidates(ctx, storeId, iso)) {
      const g = FD.gate(ctx, storeId, c, iso, vsr);
      if (g) { gated.push({ sku: c.sku, gate: g, type: c.type }); continue; }
      const sku = FD.sku(c.sku); const qty = FD.qty(ctx, storeId, c, vsr);
      const margin = qty * (sku.retail - sku.cost);
      const pin = pinnedFor(ctx, s, c.sku, iso) ? 0.2 : 0;
      recs.push({ store: storeId, sku: c.sku, type: c.type, qty, reasonId: c.reasonId, slots: c.slots, promo: c.promo || null, pinned: !!pin,
        ev: +(margin * PRIOR[c.type]).toFixed(2), value: +(qty * sku.cost).toFixed(2), score: margin * PRIOR[c.type] * (WEIGHT[c.type] + pin) });
    }
    const nonPromo = recs.filter(r => r.type !== 'PROMO').sort((a, b) => b.score - a.score);
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
    const related = [...sku.sisters, sku.bigger].filter(Boolean);
    const known = new Set(storeHistory.map(o => o.sku));
    const alt = lines.find(l => related.includes(l.sku) && !known.has(l.sku));
    if (alt) return { outcome: 'ALT', got: alt.units, alt: alt.sku };
    return { outcome: 'NOT_SOLD', got: 0, alt: null };
  };
  FD.maturity = function (ctx, rec, iso) {
    if (!SOLD.includes(rec.outcome)) return null;
    // the 28-day window starts on the day it actually sold (a revisit sale can be days after the recommendation)
    const sku = rec.alt || rec.sku; const base = rec.soldOn || rec.date; const end = FD.addDays(base, ctx.rules.maturityDays);
    if (ctx.returns.some(x => x.store === rec.store && x.sku === sku && x.date >= base && x.date <= end && x.date <= iso)) return 'RETURNED';
    if (ctx.orders.some(o => o.store === rec.store && o.sku === sku && o.date > base && o.date <= end && o.date <= iso)) return 'SUSTAINED';
    return iso > end ? 'SUSTAINED' : 'PENDING';
  };
  FD.engineMisses = function (ctx, storeId, iso, lines, recs) {
    const known = new Set(ctx.orders.filter(o => o.store === storeId && o.date < iso).map(o => o.sku));
    const recSkus = new Set(recs.map(r => r.sku)); const altSkus = new Set(recs.filter(r => r.alt).map(r => r.alt));
    const out = lines.filter(l => !known.has(l.sku) && !recSkus.has(l.sku) && !altSkus.has(l.sku)).map(l => ({ store: storeId, sku: l.sku, type: 'UNREC', recSku: null }));
    recs.filter(r => r.outcome === 'ALT').forEach(r => out.push({ store: storeId, sku: r.alt, type: 'ALT', recSku: r.sku }));
    return out;
  };
})();
