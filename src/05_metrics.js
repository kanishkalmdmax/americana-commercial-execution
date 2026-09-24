(function () {
  const FD = globalThis.FD;
  const E = (en, ar) => ({ en, ar });
  Object.assign(FD.CATALOG, {
    CTX_REMOTE: E('Remote route · {n} stops/day', 'مسار بعيد · {n} زيارات يومياً'),
    CTX_COVERED: E('Covered on {date}', 'تمت التغطية في {date}'),
    S_STORAGE: E('Browser storage is full. Changes stay until you close this tab', 'مساحة التخزين ممتلئة، ستبقى التغييرات حتى إغلاق الصفحة'),
  });
  FD.WEIGHTS = { net: 0.30, pvr: 0.20, drop: 0.15, xsell: 0.20, action: 0.15 };
  // editable in Rules (percent points); composite is normalised by their total so any mix stays 0–100
  FD.weights = st => (st && st.rules && st.rules.weights) || { net: 30, pvr: 20, drop: 15, xsell: 20, action: 15 };
  // ponytail: placeholder targets until Americana/Finance approve them (spec §16)
  FD.TARGETS = { netUplift: 1.05, xsell: 30, action: 90 };
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
    return { net, gross, ret, genuine: seen.size, productive, days: days.size, pvr: pct(productive, vs.length), drop: productive ? net / productive : 0, perDay: days.size ? net / days.size : 0 };
  }
  FD.baseline = (st, vsrId) => cached('base', st, vsrId, () => core(st, vsrId, FD.BASE_START, FD.addDays(FD.PILOT_START, -1)));

  // returns belong to whoever last served the store before the return, so reassignment never rewrites history (I5)
  function returnVsr(st) { return cached('retvsr', st, '', () => { const m = new Map(); for (const x of st.returns) { let best = null; for (const v of st.visits) if (v.store === x.store && v.status === 'DONE' && v.date <= x.date && (!best || v.date >= best.date)) best = v; m.set(x.id, best ? best.vsr : (st.world.stores.find(s => s.id === x.store) || {}).vsr); } return m; }); }
  function storeDaily(st, storeIds, from, to) {
    const idx = dayIndex(st); let sum = 0; const days = new Set(), seen = new Set();
    for (const v of st.visits) if (storeIds.has(v.store) && v.date >= from && v.date <= to && v.status === 'DONE') { const k = v.store + '|' + v.date; if (seen.has(k)) continue; seen.add(k); sum += idx.get(k) || 0; days.add(v.date); }
    return days.size ? sum / days.size : 0;
  }

  FD.vsrMetrics = function (st, vsrId, from, to, cut) {
    return cached('vm', st, vsrId + from + to + (cut ? cut.date + cut.time : ''), () => {
      const lim = to > st.clock.date ? st.clock.date : to;
      const c = core(st, vsrId, from, to, cut), b = FD.baseline(st, vsrId);
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
      const target = b.perDay * c.days * FD.TARGETS.netUplift;
      const xsell = pct(sustained, offered.length);
      const action = pct(acted.length, counted.length);
      const score = {
        net: cap(pct(c.net, target)),
        pvr: cap(pct(c.pvr, b.pvr * FD.TARGETS.netUplift)),
        drop: cap(pct(c.drop, b.drop * FD.TARGETS.netUplift)),
        xsell: cap(pct(xsell, FD.TARGETS.xsell)),
        action: cap(pct(action, FD.TARGETS.action)),
      };
      const w0 = FD.weights(st), off = (st.rules && st.rules.metricsOff) || {};
      const w = {}; for (const k of ['net', 'pvr', 'drop', 'xsell', 'action']) w[k] = off[k] ? 0 : w0[k];
      const wt = w.net + w.pvr + w.drop + w.xsell + w.action || 1;
      const composite = (score.net * w.net + score.pvr * w.pvr + score.drop * w.drop + score.xsell * w.xsell + score.action * w.action) / wt;
      const mine = [...new Set(visitsOf(st, vsrId, from, lim).map(v => v.store))]; // stores this salesman actually served in the period
      // split at the median upsell uptake per store: "took most recommendations" vs "the rest"
      const rate = id => { const rs = recs.filter(r => r.store === id && r.outcome !== 'NOT_OFFERED'); return rs.length ? rs.filter(r => SOLD.includes(r.outcome)).length / rs.length : 0; };
      const rates = mine.map(rate).sort((x, y) => x - y); const med = rates[Math.floor(rates.length / 2)] || 0;
      const A = new Set(mine.filter(id => rate(id) > med || (rate(id) === med && med > 0))), B = new Set(mine.filter(id => !A.has(id)));
      const chg = set => { const base = storeDaily(st, set, FD.BASE_START, FD.addDays(FD.PILOT_START, -1)); const now = storeDaily(st, set, from, lim); return base ? pct(now - base, base) : 0; };
      return {
        vsr: vsrId, net: c.net, target, perDay: c.perDay, genuine: c.genuine, productive: c.productive, pvr: c.pvr, drop: c.drop, days: c.days, returnsValue: c.ret,
        xsell, action, score, composite,
        sent: counted.length, sold: sold.length, offeredCount: offered.length, notOffered: recs.filter(r => r.outcome === 'NOT_OFFERED').length,
        upsellConv: pct(sold.length, offered.length), upsellValue, sustained, pending, notFollowedPct: pct(recs.filter(r => r.outcome === 'NOT_OFFERED').length, recs.length),
        followedPct: pct(recs.length - recs.filter(r => r.outcome === 'NOT_OFFERED').length, recs.length),
        followed: { withRecs: chg(A), without: chg(B), stores: A.size, pending: pending > 0 },
        reasonsPct: pct(withReason.length, needReason.length), missingReasons: needReason.length - withReason.length,
        returnRate: pct(c.ret, c.gross), vsBaseline: b.perDay ? pct(c.perDay - b.perDay, b.perDay) : 0,
      };
    });
  };

  FD.ranking = function (st, mode, from, to) {
    return cached('rank', st, mode + from + to, () => {
      const lim = to > st.clock.date ? st.clock.date : to;
      const order = (f, t) => st.world.vsrs.map(v => ({ v, m: FD.vsrMetrics(st, v.id, f, t) }))
        .sort((a, b) => (mode === 'IMP' ? b.m.vsBaseline - a.m.vsBaseline : b.m.composite - a.m.composite) || b.m.net - a.m.net)
        .map((x, i) => ({ vsr: x.v.id, rank: i + 1, m: x.m }));
      const now = order(from, lim);
      const prevTo = FD.addDays(lim, -7);
      const prev = prevTo >= from ? order(from, prevTo) : now;
      return now.map(x => {
        const spark = [];
        for (let w = 7; w >= 0; w--) { const t = FD.addDays(lim, -7 * w); const f = FD.addDays(t, -6); spark.push(t < FD.PILOT_START ? null : Math.round(FD.vsrMetrics(st, x.vsr, f < FD.PILOT_START ? FD.PILOT_START : f, t).upsellValue)); } // weekly upsell value (lead metric)
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
        const f2 = step === 1 ? t2 : FD.addDays(t2, -6); spark.push(t2 < FD.PILOT_START ? null : Math.round(FD.vsrMetrics(st, x.vsr, f2 < FD.PILOT_START ? FD.PILOT_START : f2, t2).upsellValue)); }
      return Object.assign({}, x, { prev, prePilot, prevRange: p, partial, spark, trendStep: step, netChg: partial ? (prev.net ? (x.m.net - prev.net) / prev.net * 100 : null) : x.change,
        move: partial ? 0 : prevRank ? prevRank.find(y => y.vsr === x.vsr).rank - x.rank : x.move }); });
  });

  FD.storeHealth = function (st, storeId, iso) {
    return cached('health', st, storeId + iso, () => {
      const s = st.world.stores.find(x => x.id === storeId);
      const must = [...new Set([s.label, ...s.tags].flatMap(k => st.rules.mustStock[k] || []))];
      const carried = must.filter(c => FD.carries(st, storeId, c, iso));
      const coverage = must.length ? pct(carried.length, must.length) : 100;
      const from28 = FD.addDays(iso, -28);
      let ordered = 0; for (const c of FD.SKUS) for (const o of FD.storeOrders(st, storeId, c.code)) if (o.date > from28 && o.date <= iso) ordered += o.value;
      const returned = st.returns.filter(x => x.store === storeId && x.date > from28 && x.date <= iso).reduce((a, x) => a + x.value, 0);
      const fresh = ordered ? cap(100 - pct(returned, ordered)) : 100;
      const coreSkus = FD.SKUS.filter(c => FD.storeOrders(st, storeId, c.code).filter(o => o.units > 0 && o.date > FD.addDays(iso, -56) && o.date <= from28).length >= 3).map(c => c.code);
      const reordered = coreSkus.filter(c => FD.storeOrders(st, storeId, c).some(o => o.units > 0 && o.date > FD.addDays(iso, -14) && o.date <= iso));
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
