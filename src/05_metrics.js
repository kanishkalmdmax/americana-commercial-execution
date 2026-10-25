(function () {
  const FD = globalThis.FD;
  const E = (en, ar) => ({ en, ar });
  Object.assign(FD.CATALOG, {
    CTX_REMOTE: E('Remote route · {n} stops/day', 'مسار بعيد · {n} زيارات يومياً'),
    CTX_COVERED: E('Covered on {date}', 'تمت التغطية في {date}'),
    S_STORAGE: E('Browser storage is full. Changes stay until you close this tab', 'مساحة التخزين ممتلئة، ستبقى التغييرات حتى إغلاق الصفحة'),
  });
  // The five sales levers (names fixed by the business; every screen uses these and only these)
  FD.METRICS = [
    { k: 'visits', label: 'M_VISITS', info: 'MI_VISITS', icon: 'route' },
    { k: 'withSale', label: 'M_WITH_SALE', info: 'MI_WITH_SALE', icon: 'check-circle' },
    { k: 'avgSale', label: 'M_AVG_SALE', info: 'MI_AVG_SALE', icon: 'wallet' },
    { k: 'upsell', label: 'M_UPSELL', info: 'MI_UPSELL', icon: 'coins' },
    { k: 'returns', label: 'M_RETURNS', info: 'MI_RETURNS', icon: 'undo', lowerBetter: true }];
  FD.METRIC_KEYS = FD.METRICS.map(x => x.k);
  // Approved pilot contract. Upsell value remains an operational diagnostic, outside the four supporting KPIs.
  FD.routeArea = r => !r ? '' : FD.nameOf(r).split(' · ').pop(); // route names lead with an internal code
  FD.PILOT_METRICS = [{ k: 'primary', label: 'M_PRIMARY', info: 'MI_PRIMARY', formula: 'MF_PRIMARY', icon: 'chart' },
    ...FD.METRICS.filter(m => m.k !== 'upsell').map((m, i) => ({...m, number: i + 1, formula: 'MF_' + m.k.toUpperCase()}))];
  FD.PILOT_ADOPTION = [
    { role: 'supervisor', label: 'PA_QUEUE', target: 'PAT_QUEUE', info: 'PAI_QUEUE', status: 'PAS_NOT_MEASURED' },
    { role: 'supervisor', label: 'PA_FOLLOWUP', target: 'PAT_FOLLOWUP', info: 'PAI_FOLLOWUP', status: 'PAS_PLAN_EVENTS' },
    { role: 'salesman', label: 'PA_OPEN', target: 'PAT_OPEN', info: 'PAI_OPEN', status: 'PAS_PLAN_EVENTS' },
    { role: 'salesman', label: 'PA_EXECUTION', target: 'PAT_EXECUTION', info: 'PAI_EXECUTION', status: 'PAS_INVOICE_EVENTS' },
    { role: 'salesman', label: 'PA_PITCH', target: 'PAT_PITCH', info: 'PAI_PITCH', status: 'PAS_PITCH_EVENTS' },
    { role: 'salesman', label: 'PA_REASON', target: 'PAT_REASON', info: 'PAI_REASON', status: 'PAS_REASON_PARTIAL' }
  ];
  FD.DEFAULT_WEIGHTS = { visits: 20, withSale: 20, avgSale: 20, upsell: 25, returns: 15 };
  // editable in Rules (percent points); composite is normalised by their total so any mix stays 0–100.
  // Weights saved before the five levers (net/pvr/drop/...) are ignored.
  FD.weights = st => { const w = st && st.rules && st.rules.weights; return w && 'visits' in w ? w : FD.DEFAULT_WEIGHTS; };
  // ponytail: placeholder targets until Americana/Finance approve them (spec §16)
  FD.TARGETS = { uplift: 1.05, upsellPerDay: 150, returnsCut: 0.9 };
  // one lever value -> display text
  FD.metricText = (k, v) => v == null ? '—' : k === 'visits' ? FD.fmt.num(v, 1) : k === 'withSale' || k === 'returns' ? FD.fmt.pct(v) : FD.fmt.money0(v);
  const SOLD = ['FULL', 'PARTIAL', 'ALT'];
  const NEEDS_REASON = ['NOT_SOLD', 'NOT_OFFERED'];
  const cap = x => Math.max(0, Math.min(100, x));
  const pct = (a, b) => (b ? (100 * a) / b : 0);

  // Memo per state version: every dispatch appends to the log, and sim/clock changes grow orders/recs.
  const memo = new Map();
  const ver = st => (st.dv || 0) + '|' + st.orders.length + '|' + st.recs.length + '|' + st.returns.length + '|' + st.clock.date + '|' + st.clock.time + '|' + st.lang;
  function cached(name, st, key, fn) {
    const v = ver(st); if (memo.get('__v') !== v || memo.get('__s') !== st) { memo.clear(); memo.set('__v', v); memo.set('__s', st); }
    const k = name + '|' + key; if (!memo.has(k)) memo.set(k, fn()); return memo.get(k);
  }
  FD.cached = cached;

  // store|date -> net order value of positive lines
  function dayIndex(st) {
    return cached('dayIndex', st, '', () => {
      const m = new Map();
      for (const o of st.orders) if (o.units > 0) { const k = o.store + '|' + o.date; m.set(k, (m.get(k) || 0) + o.value); }
      return m;
    });
  }
  const covered = (st, v) => st.covers.some(c => c.date === v.date && c.route === v.route);
  // cut {date, time}: on that day only count visits finished by that time (fair "today so far" comparisons)
  const inCut = (v, cut) => !cut || v.date !== cut.date || (v.leftAt || '99:99') <= cut.time;
  function visitsOf(st, vsrId, from, to, cut) {
    const lim = to > st.clock.date ? st.clock.date : to;
    return st.visits.filter(v => v.vsr === vsrId && v.date >= from && v.date <= lim && v.status === 'DONE' && !covered(st, v) && inCut(v, cut));
  }
  function core(st, vsrId, from, to, cut) {
    const idx = dayIndex(st);
    const stores = new Map(st.world.stores.map(s => [s.id, s]));
    const vs = visitsOf(st, vsrId, from, to, cut).filter(v => stores.get(v.store).credit !== 'BLOCKED');
    // a revisit is the same store-day: its value and visit count once (C1)
    let gross = 0, productive = 0; const days = new Set(), seen = new Set();
    for (const v of vs) { const k = v.store + '|' + v.date; if (seen.has(k)) continue; seen.add(k); const val = idx.get(k) || 0; gross += val; if (val > 0) productive++; days.add(v.date); }
    const lim = to > st.clock.date ? st.clock.date : to;
    const rv = returnVsr(st);
    const ret = st.returns.filter(x => rv.get(x.id) === vsrId && x.date >= from && x.date <= lim).reduce((a, x) => a + x.value, 0);
    const net = gross - ret;
    return { net, gross, ret, genuine: seen.size, productive, days: days.size, pvr: pct(productive, seen.size), drop: productive ? net / productive : 0, perDay: days.size ? net / days.size : 0 };
  }
  FD.baseline = (st, vsrId) => cached('base', st, vsrId, () => core(st, vsrId, FD.BASE_START, FD.addDays(FD.PILOT_START, -1)));
  // like-for-like: actual net sales on the days he worked vs what his own weekday averages (4 weeks before recommendations) predict for those days.
  // Odd weeks (team under half the median week) are left out on both sides. Baseline figures come from the data load (R.base, R.oddDays).
  FD.likeForLike = (st, vsrId, from, to) => cached('lfl', st, vsrId + from + to, () => {
    const base = (FD.REAL.base || {})[vsrId]; const odd = new Set(FD.REAL.oddDays || []); const lim = to > st.clock.date ? st.clock.date : to;
    if (!base) return { actual: 0, expected: 0, days: 0, pct: 0 };
    const worked = new Set(visitsOf(st, vsrId, from, lim).map(v => v.date).filter(d => !odd.has(d) && base[FD.dow(d)] != null));
    const sum = xs => xs.filter(x => worked.has(x.date) && x.vsr === vsrId).reduce((a, x) => a + x.value, 0);
    const actual = sum(st.orders) - sum(st.returns), expected = [...worked].reduce((a, d) => a + base[FD.dow(d)], 0);
    return { actual, expected, days: worked.size, pct: expected > 0 ? pct(actual - expected, expected) : 0 };
  });

  // returns belong to whoever last served the store before the return, so reassignment never rewrites history (I5)
  function returnVsr(st) { return cached('retvsr', st, '', () => { const m = new Map(); for (const x of st.returns) { let best = null; for (const v of st.visits) if (v.store === x.store && v.status === 'DONE' && v.date <= x.date && (!best || v.date >= best.date)) best = v; m.set(x.id, best ? best.vsr : (st.world.stores.find(s => s.id === x.store) || {}).vsr); } return m; }); }
  function storeDaily(st, storeIds, from, to) {
    const idx = dayIndex(st); let sum = 0; const days = new Set(), seen = new Set();
    for (const v of st.visits) if (storeIds.has(v.store) && v.date >= from && v.date <= to && v.status === 'DONE') { const k = v.store + '|' + v.date; if (seen.has(k)) continue; seen.add(k); sum += idx.get(k) || 0; days.add(v.date); }
    return days.size ? sum / days.size : 0;
  }

  // existing store = already a customer in the SalesBuzz customer list (not a newly signed-up shop)
  FD.isExistingStore = (st, storeId) => { const s = byStoreId(st).get(storeId); return !!s && s.onboarding === 'APPROVED'; };
  FD.vsrMetrics = function (st, vsrId, from, to, cut) {
    return cached('vm', st, vsrId + from + to + (cut ? cut.date + cut.time : ''), () => {
      const lim = to > st.clock.date ? st.clock.date : to;
      const c = core(st, vsrId, from, to, cut), b = FD.baseline(st, vsrId), lfl = FD.likeForLike(st, vsrId, from, to);
      const okCut = cut ? new Set(st.visits.filter(v => v.date === cut.date && v.status === 'DONE' && inCut(v, cut)).map(v => v.store)) : null;
      const recs = st.recs.filter(r => r.vsr === vsrId && !r.coveredBy && r.date >= from && r.date <= lim && r.outcome && r.outcome !== 'CARRIED' && !r.blockedAt && (!cut || r.date !== cut.date || okCut.has(r.store)));
      const counted = recs.filter(r => !r.exempted);
      const sold = recs.filter(r => SOLD.includes(r.outcome));
      const offered = recs.filter(r => SOLD.includes(r.outcome) || r.outcome === 'NOT_SOLD');
      const needReason = counted.filter(r => NEEDS_REASON.includes(r.outcome));
      const withReason = needReason.filter(r => r.reason);
      const acted = counted.filter(r => SOLD.includes(r.outcome) || (NEEDS_REASON.includes(r.outcome) && r.reason));
      const sustained = sold.filter(r => r.maturity === 'SUSTAINED').length, pending = sold.filter(r => r.maturity === 'PENDING').length;
      const upsellValue = sold.reduce((a, r) => a + (r.got || 0) * FD.sku(r.alt || r.sku).cost, 0);
      // Upsell Sales at Existing Stores: sold recommendations at stores that had bought from us before the recommendation day
      const upsellSales = sold.filter(r => FD.isExistingStore(st, r.store, r.date)).reduce((a, r) => a + (r.got || 0) * FD.sku(r.alt || r.sku).cost, 0);
      const xsell = pct(sustained, offered.length);
      const action = pct(acted.length, counted.length);
      // the five levers; a selling day is a day the salesman made at least one visit
      const lev = { primary: c.days ? c.perDay : null, visits: c.days ? c.genuine / c.days : 0, withSale: c.pvr, avgSale: c.productive ? c.gross / c.productive : 0, upsell: upsellSales, returns: pct(c.ret, c.gross) };
      const base = { primary: lfl.days ? lfl.expected / lfl.days : null, visits: b.days ? b.genuine / b.days : 0, withSale: b.pvr, avgSale: b.productive ? b.gross / b.productive : 0, upsell: 0, returns: pct(b.ret, b.gross) };
      const T = FD.TARGETS; const retT = base.returns * T.returnsCut;
      const target = { visits: base.visits * T.uplift, withSale: base.withSale * T.uplift, avgSale: base.avgSale * T.uplift, upsell: T.upsellPerDay * c.days, returns: retT };
      const score = {
        visits: cap(pct(lev.visits, target.visits)), withSale: cap(pct(lev.withSale, target.withSale)), avgSale: cap(pct(lev.avgSale, target.avgSale)),
        upsell: cap(pct(lev.upsell, target.upsell)),
        returns: !c.gross ? 0 : lev.returns <= retT ? 100 : cap(pct(retT, lev.returns)), // lower is better
      };
      const w0 = FD.weights(st), off = (st.rules && st.rules.metricsOff) || {};
      const w = {}; for (const k of FD.METRIC_KEYS) w[k] = off[k] ? 0 : (w0[k] || 0);
      const wt = FD.METRIC_KEYS.reduce((a, k) => a + w[k], 0) || 1;
      const composite = FD.METRIC_KEYS.reduce((a, k) => a + score[k] * w[k], 0) / wt;
      const mine = [...new Set(visitsOf(st, vsrId, from, lim).map(v => v.store))]; // stores this salesman actually served in the period
      // split at the median upsell uptake per store: "took most recommendations" vs "the rest"
      const rate = id => { const rs = recs.filter(r => r.store === id && r.outcome !== 'NOT_OFFERED'); return rs.length ? rs.filter(r => SOLD.includes(r.outcome)).length / rs.length : 0; };
      const rates = mine.map(rate).sort((x, y) => x - y); const med = rates[Math.floor(rates.length / 2)] || 0;
      const A = new Set(mine.filter(id => rate(id) > med || (rate(id) === med && med > 0))), B = new Set(mine.filter(id => !A.has(id)));
      const chg = set => { const base = storeDaily(st, set, FD.BASE_START, FD.addDays(FD.PILOT_START, -1)); const now = storeDaily(st, set, from, lim); return base ? pct(now - base, base) : 0; };
      return {
        vsr: vsrId, net: c.net, target, perDay: c.perDay, genuine: c.genuine, productive: c.productive, pvr: c.pvr, drop: c.drop, days: c.days, returnsValue: c.ret,
        xsell, action, score, composite, lev, base, target, upsellSales,
        sent: counted.length, sold: sold.length, offeredCount: offered.length, notOffered: recs.filter(r => r.outcome === 'NOT_OFFERED').length,
        upsellConv: pct(sold.length, offered.length), upsellValue, sustained, pending, notFollowedPct: pct(recs.filter(r => r.outcome === 'NOT_OFFERED').length, recs.length),
        followedPct: pct(recs.length - recs.filter(r => r.outcome === 'NOT_OFFERED').length, recs.length),
        followed: { withRecs: chg(A), without: chg(B), stores: A.size, pending: pending > 0 },
        reasonsPct: pct(withReason.length, needReason.length), missingReasons: needReason.length - withReason.length,
        returnRate: pct(c.ret, c.gross), vsBaseline: lfl.pct, hasBaseline: lfl.expected > 0 && lfl.days > 0,
      };
    });
  };

  // the five levers for a group of salesmen: pooled (sums first, then ratios), not an average of averages
  FD.teamLevers = (st, vsrIds, from, to) => {
    const ms = vsrIds.map(id => FD.vsrMetrics(st, id, from, to)); const S = f => ms.reduce((a, m) => a + f(m), 0);
    const days = S(m => m.days), visits = S(m => m.genuine), sold = S(m => m.productive), gross = S(m => m.net + m.returnsValue), ret = S(m => m.returnsValue);
    return { primary: days ? (gross - ret) / days : null, perDay: days ? (gross - ret) / days : null, visits: days ? visits / days : null, withSale: visits ? pct(sold, visits) : null, avgSale: sold ? gross / sold : null, upsell: S(m => m.upsellSales), returns: gross ? pct(ret, gross) : null, net: gross - ret, days };
  };

  FD.ranking = function (st, mode, from, to) {
    return cached('rank', st, mode + from + to, () => {
      const lim = to > st.clock.date ? st.clock.date : to;
      const order = (f, t) => st.world.vsrs.filter(v => v.kind === 'sales').map(v => ({ v, m: FD.vsrMetrics(st, v.id, f, t) }))
        .sort((a, b) => (b.m.hasBaseline - a.m.hasBaseline) || (b.m.vsBaseline - a.m.vsBaseline) || b.m.net - a.m.net) // both modes: net sales per selling day vs own baseline
        .map((x, i) => ({ vsr: x.v.id, rank: i + 1, m: x.m }));
      const now = order(from, lim);
      const prevTo = FD.addDays(lim, -7);
      const prev = prevTo >= from ? order(from, prevTo) : now;
      return now.map(x => {
        const spark = [];
        for (let w = 7; w >= 0; w--) { const t = FD.addDays(lim, -7 * w); const f = FD.addDays(t, -6); spark.push(t < FD.PILOT_START ? null : Math.round(FD.vsrMetrics(st, x.vsr, f < FD.PILOT_START ? FD.PILOT_START : f, t).perDay || 0)); } // weekly net sales per selling day
        const v = st.world.vsrs.find(q => q.id === x.vsr); const route = st.world.routes.find(r => r.id === v.route);
        const context = [];
        if (route.remote) context.push({ id: 'CTX_REMOTE', slots: { n: st.world.stores.filter(s => s.route === route.id && s.days.includes(3)).length } });
        st.covers.filter(c => c.route === route.id && c.date >= from && c.date <= lim).forEach(c => context.push({ id: 'CTX_COVERED', slots: { date: c.date } }));
        st.covers.filter(c => c.vsr === x.vsr && c.date >= from && c.date <= lim).forEach(c => context.push({ id: 'CTX_COVERED', slots: { date: c.date } }));
        return { vsr: x.vsr, rank: x.rank, composite: x.m.composite, change: x.m.vsBaseline, move: prev.find(p => p.vsr === x.vsr).rank - x.rank, spark, context, m: x.m };
      });
    });
  };

  // the same number of days just before the range; before the pilot there were no upsells to compare
  FD.prevRange = (from, to) => { const n = FD.daysBetween(from, to) + 1; return { from: FD.addDays(from, -n), to: FD.addDays(from, -1) }; };
  // today: compare with the last selling day up to the same time; longer ranges: the same number of days just before
  const prevSelling = d => { let x = FD.addDays(d, -1); for (let i = 0; i < 7 && !FD.isSellingDay(x); i++) x = FD.addDays(x, -1); return x; };
  FD.teamCompare = (st, from, to) => cached('tc', st, from + to, () => {
    const lim = to > st.clock.date ? st.clock.date : to; const n = FD.daysBetween(from, lim) + 1;
    const partial = n === 1 && lim === st.clock.date;
    const p = partial ? { from: prevSelling(lim), to: prevSelling(lim) } : FD.prevRange(from, lim); const prePilot = p.to < FD.PILOT_START;
    const cut = partial ? { date: p.to, time: st.clock.time } : null;
    const prevRank = prePilot ? null : FD.ranking(st, 'ABS', p.from, p.to);
    // trend follows the chosen period: 8 days for one day, otherwise 8 weeks
    const step = n === 1 ? 1 : 7;
    return FD.ranking(st, 'ABS', from, to).map(x => { const prev = FD.vsrMetrics(st, x.vsr, p.from, p.to, cut);
      const spark = []; for (let i = 7; i >= 0; i--) { const t2 = n === 1 ? (i ? (() => { let d = lim; for (let k = 0; k < i; k++) d = prevSelling(d); return d; })() : lim) : FD.addDays(lim, -7 * i);
        const f2 = step === 1 ? t2 : FD.addDays(t2, -6); spark.push(t2 < FD.PILOT_START ? null : Math.round(FD.vsrMetrics(st, x.vsr, f2 < FD.PILOT_START ? FD.PILOT_START : f2, t2).perDay || 0)); }
      return Object.assign({}, x, { prev, prePilot, prevRange: p, partial, spark, trendStep: step, netChg: partial ? (prev.net ? (x.m.net - prev.net) / prev.net * 100 : null) : x.change,
        move: partial ? 0 : prevRank ? prevRank.find(y => y.vsr === x.vsr).rank - x.rank : x.move }); });
  });

  // per-change indexes (rebuilt when the data version moves): one pass instead of a scan per store
  const group = (rows, key) => { const m = new Map(); for (const r of rows) (m.get(r[key]) || m.set(r[key], []).get(r[key])).push(r); return m; };
  const ordersByStore = st => cached('ordByStore', st, '', () => group(st.orders, 'store'));
  const returnsByStore = st => cached('retByStore', st, '', () => group(st.returns, 'store'));
  const byStoreId = st => cached('storeById', st, '', () => new Map(st.world.stores.map(s => [s.id, s])));
  const visitsByStore = st => cached('visByStore', st, '', () => group(st.visits, 'store'));
  // what a supervisor reads in one glance: last visit and order, order days, average order, visits that ended without an order, returns, demand
  FD.storeGlance = function (st, storeId, iso) {
    return cached('glance', st, storeId + iso, () => {
      const from28 = FD.addDays(iso, -28); const val = {}; const skus = new Set();
      for (const o of ordersByStore(st).get(storeId) || []) if (o.units > 0 && o.date <= iso) { val[o.date] = (val[o.date] || 0) + o.value; if (o.date > from28) skus.add(o.sku); }
      const days = Object.keys(val).sort(); const lastOrder = days.length ? days[days.length - 1] : null;
      const days28 = days.filter(d => d > from28); const sales28 = days28.reduce((a, d) => a + val[d], 0);
      const vs = (visitsByStore(st).get(storeId) || []).filter(v => v.status === 'DONE' && v.date <= iso);
      const lastVisit = vs.reduce((m, v) => (v.date > m ? v.date : m), '') || null;
      const vdays28 = [...new Set(vs.filter(v => v.date > from28).map(v => v.date))];
      const returned = (returnsByStore(st).get(storeId) || []).filter(x => x.date > from28 && x.date <= iso).reduce((a, x) => a + x.value, 0);
      return { lastVisit, lastOrder, daysSinceOrder: lastOrder ? FD.daysBetween(lastOrder, iso) : null, daysSinceVisit: lastVisit ? FD.daysBetween(lastVisit, iso) : null,
        orderDays28: days28.length, avgOrder: days.length ? days.reduce((a, d) => a + val[d], 0) / days.length : 0, sales28,
        visits28: vdays28.length, wasted28: vdays28.filter(d => !val[d]).length, returnsPct: sales28 ? 100 * returned / sales28 : 0,
        demand: days28.length >= 2 ? 'STEADY' : days28.length === 1 ? 'IRREGULAR' : 'NONE', products28: skus.size };
    });
  };
  // stores worth a look, with the plain reason, worst first
  FD.storesNeedingAttention = (st, ids, iso) => ids.map(id => { const g = FD.storeGlance(st, id, iso); const reasons = [];
      if (g.wasted28 >= 2) reasons.push('SA_WASTED');
      if (g.sales28 >= 200 && g.returnsPct >= 20) reasons.push('SA_RETURNS');
      if (g.visits28 >= 1 && (g.daysSinceOrder == null || g.daysSinceOrder >= 21)) reasons.push('SA_NO_ORDER');
      return { id, g, reasons, score: g.wasted28 * 2 + (reasons.includes('SA_RETURNS') ? 3 : 0) + (reasons.includes('SA_NO_ORDER') ? 2 : 0) }; })
    .filter(x => x.reasons.length).sort((a, b) => b.score - a.score);
  FD.storeHealth = function (st, storeId, iso) {
    return cached('health', st, storeId + iso, () => {
      const s = byStoreId(st).get(storeId); const mine = ordersByStore(st).get(storeId) || [];
      const must = [...new Set([s.label, ...s.tags].flatMap(k => st.rules.mustStock[k] || []))];
      const carried = must.filter(c => FD.carries(st, storeId, c, iso));
      const coverage = must.length ? pct(carried.length, must.length) : 100;
      const from28 = FD.addDays(iso, -28), from56 = FD.addDays(iso, -56), from14 = FD.addDays(iso, -14);
      let ordered = 0; const early = {}, recent = new Set();
      for (const o of mine) { if (o.date > from28 && o.date <= iso) ordered += o.value;
        if (o.units > 0 && o.date > from56 && o.date <= from28) early[o.sku] = (early[o.sku] || 0) + 1;
        if (o.units > 0 && o.date > from14 && o.date <= iso) recent.add(o.sku); }
      const returned = (returnsByStore(st).get(storeId) || []).filter(x => x.date > from28 && x.date <= iso).reduce((a, x) => a + x.value, 0);
      const fresh = ordered ? cap(100 - pct(returned, ordered)) : 100;
      const coreSkus = Object.keys(early).filter(c => early[c] >= 3);
      const reordered = coreSkus.filter(c => recent.has(c));
      const consistency = coreSkus.length ? pct(reordered.length, coreSkus.length) : 100;
      const recs = FD.storeRecs(st, storeId).filter(r => r.date <= iso && r.outcome && r.outcome !== 'CARRIED' && !r.blockedAt);
      const uptakeRaw = pct(recs.filter(r => r.maturity === 'SUSTAINED').length, recs.length);
      const uptake = recs.length ? cap(pct(uptakeRaw, FD.TARGETS.xsell)) : 100;
      const score = Math.round(0.4 * coverage + 0.2 * fresh + 0.2 * consistency + 0.2 * uptake);
      const lapsed = FD.candidates(st, storeId, iso).filter(c => c.type === 'LAPSED').map(c => c.sku);
      return { score, band: score >= 80 ? 'GOOD' : score >= 60 ? 'WATCH' : 'LOW', parts: { coverage: Math.round(coverage), fresh: Math.round(fresh), consistency: Math.round(consistency), uptake: Math.round(uptake) },
        missing: must.filter(c => !carried.includes(c)), lapsed, must, uptakeRaw, returnedValue: returned, orderedValue: ordered };
    });
  };

  FD.shelf = function (st, storeId, iso) {
    return cached('shelf', st, storeId + iso, () => {
      const out = {}; const gates = {};
      const rec = FD.recommend(st, storeId, iso);
      const cands = FD.candidates(st, storeId, iso);
      const recsHere = FD.storeRecs(st, storeId).filter(r => r.date <= iso);
      for (const s of FD.SKUS) {
        const c = s.code;
        const returned = st.returns.some(x => x.store === storeId && x.sku === c && x.date <= iso && FD.daysBetween(x.date, iso) < 28);
        const pending = recsHere.some(r => (r.alt || r.sku) === c && r.maturity === 'PENDING');
        const lastNo = recsHere.filter(r => r.sku === c && NEEDS_REASON.includes(r.outcome) && r.reason && !FD.NO_COOLDOWN.includes(r.reason) && FD.daysBetween(r.date, iso) < st.rules.cooldownDays).length;
        const g = rec.gated.find(x => x.sku === c);
        const cand = cands.find(x => x.sku === c);
        if (returned) out[c] = 'RETURNED';
        else if (pending) out[c] = 'PENDING';
        else if (FD.carries(st, storeId, c, iso)) out[c] = 'CARRIED';
        else if (rec.recs.some(x => x.sku === c)) out[c] = cand && cand.type === 'LAPSED' ? 'LAPSED' : 'OPPORTUNITY';
        else if (lastNo) out[c] = 'DECLINED';
        else if (g) { out[c] = 'GATED'; gates[c] = g.gate; }
        else if (cand && cand.type === 'LAPSED') out[c] = 'LAPSED';
        else out[c] = 'NONE';
      }
      Object.defineProperty(out, 'gates', { value: gates, enumerable: false });
      return out;
    });
  };
})();

(function () {
  const FD = globalThis.FD;
  const SOLD = ['FULL', 'PARTIAL', 'ALT'];
  const pct = (a, b) => (b ? (100 * a) / b : 0);
  // Per store x product, from SalesBuzz sell-in only (R2-Q5): no shelf count.
  // a store with an order (units > 0) from the 1st of the month up to the day; drives the stores-that-bought bonus
  FD.invoicedThisMonth = (st, store, iso) => st.orders.some(o => o.store === store && o.units > 0 && o.date <= iso && o.date >= iso.slice(0, 8) + '01');

  FD.storeSkuStats = (st, storeId, iso) => FD.cached('sks', st, storeId + iso, () => {
    const from28 = FD.addDays(iso, -28); const visits28 = st.visits.filter(v => v.store === storeId && v.status === 'DONE' && v.date > from28 && v.date <= iso).length || 1;
    return FD.SKUS.map(k => {
      const os = FD.storeOrders(st, storeId, k.code).filter(o => o.units > 0 && o.date <= iso);
      if (!os.length) return { code: k.code, units4w: 0 };
      const last = os.reduce((m, o) => (o.date > m.date ? o : m), os[0]);
      const units4w = os.filter(o => o.date > from28).reduce((a, o) => a + o.units, 0);
      const perDay = (units4w * k.pcs) / 28;
      const cover = perDay ? Math.max(0, Math.round((last.units * k.pcs) / perDay - FD.daysBetween(last.date, iso))) : null;
      return { code: k.code, lastDate: last.date, lastQty: last.units, units4w, avgVisit: +(units4w / visits28).toFixed(1), cover };
    }).filter(x => x.lastDate).sort((a, b) => b.units4w - a.units4w);
  });
  // How a store responds to recommendations: feeds the analysis model (receptive / selective / resistant)
  FD.storeResponse = (st, storeId, vsrId) => FD.cached('resp', st, storeId + (vsrId || ''), () => {
    const rs = FD.storeRecs(st, storeId).filter(r => r.outcome && !['CARRIED', 'WAITING'].includes(r.outcome) && r.date <= st.clock.date && (!vsrId || FD.recVsr(r) === vsrId));
    const offered = rs.filter(r => r.outcome !== 'NOT_OFFERED'); const sold = offered.filter(r => SOLD.includes(r.outcome));
    const conv = pct(sold.length, offered.length);
    const segment = offered.length < 3 ? 'SEG_NEW' : conv >= 40 ? 'SEG_RECEPTIVE' : conv < 15 ? 'SEG_RESISTANT' : 'SEG_SELECTIVE';
    return { sent: rs.length, offered: offered.length, sold: sold.length, conv, notFollowed: pct(rs.length - offered.length, rs.length), confirmed: pct(sold.filter(r => r.maturity === 'SUSTAINED').length, sold.length), revisits: sold.filter(r => r.revisit).length, segment };
  });
})();

// ---------- salesman monthly KPIs and the bonus they earn (Americana Q22-Q26) ----------
(function () {
  const FD = globalThis.FD;
  const E = (en, ar) => ({ en, ar });
  // Monthly gross-sales target per route, FACT_SALES_TARGET_NEW period 202604 (latest shared).
  FD.ROUTE_TARGET = { RYD_01: 84250, RYD_02: 83707, RYD_03: 78208, RYD_04: 75396, RYD_05: 82427, RYD_06: 74910, RYD_07: 43404, RYD_08: 79412, RYD_09: 83226, RYD_10: 83826, RYD_11: 85501 };
  // ponytail: Americana's SAR 2,500 worked example, sales part split 70/30 cake/grocery and each part needing 100%. Swap for real per-salesman bonus sheets when shared.
  FD.BONUS = { cake: 1225, grocery: 525, active: 375, collect: 375 };
  FD.KPI_RULE = { cakeShare: 0.7, activePct: 0.9, overdueMax: 0.1 };
  FD.SLOTS.push('done', 'target', 'need', 'total', 'kpi');
  Object.assign(FD.CATALOG, {
    ME_UPDATED: E('Updated to {date}', 'آخر تحديث {date}'),
    ME_KPI_CARD: E('My KPIs this month', 'مؤشراتي هذا الشهر'),
    ME_KPI_ON_TRACK: E('{n} of 4 KPIs on track', '{n} من ٤ مؤشرات على المسار'),
    ME_DAYS_LEFT: E('{n} selling days left', 'باقي {n} أيام بيع'),
    ME_BONUS_EXPECTED: E('Expected bonus {money} of {total}', 'المكافأة المتوقعة {money} من {total}'),
    ME_NEXT: E('Next: {tip}', 'التالي: {tip}'),
    ME_MORE_TODO: E('{n} more to do', 'باقي {n}'),
    ME_YDAY_CARD: E('Yesterday, {date}', 'أمس، {date}'),
    ME_STORES_BOUGHT: E('{done} of {need} stores bought', 'اشترى {done} من {need} محلات'),
    ME_UPS_CARD: E('My upsells this month', 'مبيعاتي الإضافية هذا الشهر'),
    ME_UPS_TITLE: E('My upsells', 'مبيعاتي الإضافية'),
    ME_UPS_SOLD: E('Sold', 'مباع'), ME_UPS_REORDERED: E('Reordered', 'أعاد الطلب'), ME_UPS_RETURNED: E('Returned', 'مرتجع'), ME_UPS_WAITING: E('Waiting', 'قيد الانتظار'),
    ME_UPS_DAYS_LEFT: E('{n} days left', 'باقي {n} يوماً'),
    ME_UPS_EMPTY: E('No upsells sold in this period', 'لا توجد مبيعات إضافية في هذه الفترة'),
    ME_RESULTS: E('My results', 'نتائجي'),
    ME_YDAY: E('Yesterday', 'أمس'), ME_WEEK: E('7 days', '٧ أيام'), ME_MONTH: E('This month', 'هذا الشهر'),
    ME_PICK: E('Pick a day', 'اختر يوماً'),
    ME_DAY: E('Day', 'يوم'),
    ME_DAY_TARGET: E('Day target {money}', 'هدف اليوم {money}'),
    ME_TARGET: E('Target {money}', 'الهدف {money}'),
    ME_ABOVE: E('{money} above target', '{money} فوق الهدف'),
    ME_BELOW: E('{money} below target', '{money} تحت الهدف'),
    ME_NO_SELLING: E('Not a selling day', 'ليس يوم بيع'),
    ME_K_SALES: E('Sales per day', 'المبيعات يومياً'),
    ME_K_VISITS: E('Visits per day', 'الزيارات يومياً'),
    ME_K_BOUGHT: E('Stores that bought', 'المحلات التي اشترت'),
    ME_K_AVG: E('Average sale', 'متوسط البيع'),
    ME_K_RETURNS: E('Returns', 'المرتجعات'),
    ME_MORE_MONEY: E('{money} more than before', '{money} أكثر من قبل'),
    ME_LESS_MONEY: E('{money} less than before', '{money} أقل من قبل'),
    ME_MORE_N: E('{n} more than before', '{n} أكثر من قبل'),
    ME_LESS_N: E('{n} fewer than before', '{n} أقل من قبل'),
    ME_SAME: E('Same as before', 'مثل قبل'),
    KPI_CAKE: E('Cake sales', 'مبيعات الكيك'),
    KPI_GROCERY: E('Grocery sales', 'مبيعات المواد الغذائية'),
    KPI_ACTIVE: E('Stores that bought', 'المحلات التي اشترت'),
    KPI_COLLECT: E('Collections', 'التحصيل'),
    KPI_SHORT_CAKE: E('Cake', 'الكيك'), KPI_SHORT_GROCERY: E('Grocery', 'مواد غذائية'), KPI_SHORT_ACTIVE: E('Stores', 'المحلات'), KPI_SHORT_COLLECT: E('Collections', 'التحصيل'),
    KPI_MET: E('Met', 'تحقق'), KPI_ON_TRACK: E('On track', 'على المسار'), KPI_BEHIND: E('Behind', 'متأخر'),
    KPI_SALES_LINE: E('{done} of {target}', '{done} من {target}'),
    KPI_SELL_DAY: E('Sell {money} a day', 'بِع {money} يومياً'),
    KPI_ACTIVE_LINE: E('{done} of {need} stores bought', 'اشترى {done} من {need} محلاً'),
    KPI_ACTIVE_LEFT: E('{n} to go', 'باقي {n}'),
    KPI_OVERDUE: E('Overdue {money}', 'المتأخر {money}'),
    KPI_LIMIT: E('Limit {money}', 'الحد {money}'),
    KPI_BONUS_WHEN_MET: E('Bonus when met: {money}', 'المكافأة عند التحقيق: {money}'),
    KPI_NEXT: E('Next to do', 'المطلوب التالي'),
    KPI_FOR: E('{kpi} · Bonus {money}', '{kpi} · المكافأة {money}'),
    KPI_TIP_UNVISITED: E('Visit {n} stores not seen this month', 'زُر {n} محلات لم تزرها هذا الشهر'),
    KPI_TIP_NOBUY: E('Get an order from {n} stores you visited', 'احصل على طلب من {n} محلات زرتها'),
    KPI_TIP_GROCERY: E('Offer grocery to {n} stores that bought only cake', 'اعرض المواد الغذائية على {n} محلات اشترت الكيك فقط'),
    KPI_TIP_CAKE: E('Sell {money} of cake a day', 'بِع كيك بقيمة {money} يومياً'),
    KPI_TIP_CAKE_B: E('About {n} more orders a day', 'حوالي {n} طلبات إضافية يومياً'),
    KPI_TIP_COLLECT: E('Collect from {n} stores near their credit limit', 'حصّل من {n} محلات قريبة من حد الائتمان'),
    KPI_TIP_KEEP: E('All on track. Keep each day at {money} or more.', 'كل المؤشرات على المسار. أبقِ كل يوم عند {money} أو أكثر.'),
  });

  const isGrocery = code => (FD.sku(code) || {}).category === 'other';
  const prevSellingDay = iso => { let d = FD.addDays(iso, -1); while (!FD.isSellingDay(d)) d = FD.addDays(d, -1); return d; };
  const countSelling = (from, to) => { let n = 0; for (let d = from; d <= to; d = FD.addDays(d, 1)) if (FD.isSellingDay(d)) n++; return n; };
  const monthEnd = iso => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
  const sum = xs => xs.reduce((a, o) => a + o.value, 0);
  FD.prevSellingDay = prevSellingDay;
  // 0..1 toward one KPI; collections is full while overdue stays under the limit
  FD.kpiProgress = x => x.limit != null ? (x.overdue <= x.limit ? 1 : x.limit / x.overdue) : Math.min(1, (x.goal ?? x.need) ? x.done / (x.goal ?? x.need) : 0);

  // Sales against the route target for any date range; the day target is the month target over that month's selling days.
  FD.periodSales = function (st, vsrId, from, to) {
    const vsr = st.world.vsrs.find(v => v.id === vsrId), month = FD.ROUTE_TARGET[vsr.route] || 0;
    const xs = st.orders.filter(o => o.vsr === vsrId && o.date >= from && o.date <= to && o.value > 0);
    let target = 0, days = 0;
    for (let d = from; d <= to; d = FD.addDays(d, 1)) if (FD.isSellingDay(d)) { days++; target += month / countSelling(d.slice(0, 8) + '01', monthEnd(d)); }
    return { sales: sum(xs), target, days, orders: new Set(xs.map(o => o.store + o.date)).size };
  };

  // Where a salesman stands on each monthly KPI, plus the actions that protect the most bonus.
  FD.kpiStatus = function (st, vsrId, d) {
    const vsr = st.world.vsrs.find(v => v.id === vsrId);
    const target = FD.ROUTE_TARGET[vsr.route] || 0;
    const m0 = d.slice(0, 8) + '01', yday = prevSellingDay(d);
    const daysAll = countSelling(m0, monthEnd(d)), daysGone = countSelling(m0, FD.addDays(d, -1)), daysLeft = Math.max(1, daysAll - daysGone);
    const orders = st.orders.filter(o => o.vsr === vsrId && o.date >= m0 && o.date <= d && o.value > 0);
    // pace from completed days only; today is still running
    const pace = (xs, goal) => { const done = sum(xs), before = sum(xs.filter(o => o.date < d)), perDay = daysGone ? before / daysGone : 0;
      const proj = before + perDay * daysLeft;
      return { done, goal, perDay, needDay: Math.max(0, goal - before) / daysLeft, status: done >= goal ? 'DONE' : proj >= goal ? 'ON_TRACK' : 'AT_RISK' }; };
    const cake = pace(orders.filter(o => !isGrocery(o.sku)), target * FD.KPI_RULE.cakeShare);
    const grocery = pace(orders.filter(o => isGrocery(o.sku)), target * (1 - FD.KPI_RULE.cakeShare));

    // monthly JP = stores on his plan this month so far (weekly cycles cover the month); falls back to assigned stores before the first plan
    const planned = new Set(st.visits.filter(v => v.vsr === vsrId && !v.offPlan && v.date >= m0 && v.date <= monthEnd(d)).map(v => v.store));
    const jp = st.world.stores.filter(s => planned.size ? planned.has(s.id) : s.vsr === vsrId && s.days && s.days.length);
    const bought = new Set(orders.map(o => o.store));
    const seen = new Set(st.visits.filter(v => v.vsr === vsrId && v.status === 'DONE' && v.date >= m0 && v.date <= d).map(v => v.store));
    const need = Math.ceil(jp.length * FD.KPI_RULE.activePct), invoiced = jp.filter(s => bought.has(s.id)).length;
    // each JP store is planned at least once a month, so stores not yet visited are still reachable
    const reachable = invoiced + jp.filter(s => !seen.has(s.id) && !bought.has(s.id)).length * 0.9;
    const active = { done: invoiced, need, jp: jp.length, status: invoiced >= need ? 'DONE' : reachable >= need ? 'ON_TRACK' : 'AT_RISK' };

    const mine = st.world.stores.filter(s => s.vsr === vsrId);
    const owed = mine.reduce((a, s) => a + (s.openAr || 0), 0);
    const late = mine.filter(s => s.overdue > 0).sort((a, b) => b.overdue - a.overdue);
    const overduePct = owed ? sum(late.map(s => ({ value: s.overdue }))) / owed : 0;
    const collect = { owed, overduePct, overdue: overduePct * owed, limit: FD.KPI_RULE.overdueMax * owed, status: overduePct < FD.KPI_RULE.overdueMax ? 'ON_TRACK' : 'AT_RISK' };

    const parts = { cake, grocery, active, collect };
    const pot = Object.values(FD.BONUS).reduce((a, b) => a + b, 0);
    const likely = Object.keys(parts).reduce((a, k) => a + (parts[k].status === 'AT_RISK' ? 0 : FD.BONUS[k]), 0);

    const yOrders = st.orders.filter(o => o.vsr === vsrId && o.date === yday && o.value > 0);
    const yesterday = { date: yday, sales: sum(yOrders), target: target / daysAll, stores: new Set(yOrders.map(o => o.store)).size };
    const drops = new Set(orders.map(o => o.store + o.date)).size, avgOrder = drops ? sum(orders) / drops : 0;

    // actions, behind KPIs first then biggest bonus; each names the stores to act on
    const stake = k => parts[k].status === 'DONE' ? 0 : FD.BONUS[k], risk = k => parts[k].status === 'AT_RISK';
    const tips = [];
    if (active.status !== 'DONE') {
      const unvisited = jp.filter(s => !seen.has(s.id) && !bought.has(s.id)), noBuy = jp.filter(s => seen.has(s.id) && !bought.has(s.id));
      if (unvisited.length) tips.push({ k: 'UNVISITED', stake: stake('active'), risk: risk('active'), n: unvisited.length, stores: unvisited.map(s => s.id) });
      if (noBuy.length) tips.push({ k: 'NOBUY', stake: stake('active'), risk: risk('active'), n: noBuy.length, stores: noBuy.map(s => s.id) });
    }
    if (grocery.status !== 'DONE') {
      const cakeOnly = [...bought].filter(id => !orders.some(o => o.store === id && isGrocery(o.sku)));
      if (cakeOnly.length) tips.push({ k: 'GROCERY', stake: stake('grocery'), risk: risk('grocery'), n: cakeOnly.length, stores: cakeOnly });
    }
    if (cake.status !== 'DONE') tips.push({ k: 'CAKE', stake: stake('cake'), risk: risk('cake'), money: cake.needDay, avg: avgOrder, n: avgOrder ? Math.max(0, Math.ceil((cake.needDay - cake.perDay) / avgOrder)) : 0, stores: [] });
    if (collect.status === 'AT_RISK' && late.length) tips.push({ k: 'COLLECT', stake: stake('collect'), risk: risk('collect'), n: late.length, stores: late.map(s => s.id) });
    return { target, daysAll, daysLeft, parts, pot, likely, yesterday, tips: tips.filter(x => x.stake > 0).sort((a, b) => b.risk - a.risk || b.stake - a.stake) };
  };
})();
