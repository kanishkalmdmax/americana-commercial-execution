(function () {
  const FD = globalThis.FD;
  const KEY = 'fielddrive.v7'; // v7: audit build (reorder cycles, category windows, similar stores by distance, upsell split); v6 logs are not replayable
  const subs = [];
  let storage = null, chan = null, replaying = false;

  FD.storageAdapter = s => ({
    get() { try { return s ? s.getItem(KEY) : null; } catch (e) { return null; } },
    set(v) { try { if (s) s.setItem(KEY, v); return true; } catch (e) { return false; /* quota or denied: app keeps working in memory */ } },
    clear() { try { if (s) s.removeItem(KEY); } catch (e) { } }
  });
  FD.subscribe = fn => { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; };
  const changed = () => { if (replaying) return; subs.forEach(fn => fn(FD.state)); FD.bus.emit('change', FD.state); };
  const toast = (id, slots) => { if (!replaying) FD.bus.emit('toast', { id, slots }); };

  // ---------- helpers ----------
  const hhmm = mins => String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  const storeById = (st, id) => st.world.stores.find(s => s.id === id);
  const nextId = (st, p) => p + (++st.seq);
  const hashKey = s => { let x = 2166136261; for (const c of String(s)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
  const now = st => ({ date: st.clock.date, time: st.clock.time });
  function notify(st, vsr, tpl, slots, target) {
    const n = { id: nextId(st, 'N'), vsr, tpl, slots, target, at: now(st), read: false };
    st.notifs.push(n);
    if (!replaying) FD.bus.emit('notif', n);
    return n;
  }
  const knownSkus = (st, store, date) => FD.SKUS.filter(s => FD.storeOrders(st, store, s.code).some(o => o.date < date && o.units > 0)).map(s => s.code);
  const recsFor = (st, date, store) => FD.storeRecs(st, store).filter(r => r.date === date);
  const coverFor = (st, date, route) => st.covers.find(c => c.date === date && c.route === route);
  // route owner on a date: last reassignment effective on/before it, else the original owner
  FD.routeOwner = (st, route, date) => { let o = st.world.vsrs.find(v => v.route === route); o = o ? o.id : null; let at = ''; for (const a of (st.routeAssign || [])) if (a.route === route && a.from <= date && a.from >= at) { o = a.vsr; at = a.from; } return o; };
  // recommendations that failed for a temporary reason stay open until the store's next visit (R2-Q4)
  FD.openTemps = (st, store, date, visitId) => FD.storeRecs(st, store).filter(r => r.outcome === 'NOT_SOLD' && FD.TEMP.includes(r.reason) && !r.revisitClosed && r.date <= date && FD.daysBetween(r.date, date) <= 14 && r.gradedVisit !== visitId);
  FD.recVsr = r => r.coveredBy || r.vsr;

  // ---------- day planning ----------
  function makeRec(st, draft, vsr, date) {
    return Object.assign({ id: nextId(st, 'RC'), vsr, date, stage: 'SENT', outcome: null, got: 0, alt: null, reason: null, brand: null, comment: null, photo: null,
      exempted: false, exemptNote: null, corrected: false, prevOutcome: null, maturity: null, blockedAt: null, qtyModified: null, untickedAt: null, coveredBy: null, viewedAt: null }, draft);
  }
  function genRecs(st, store, date, vsr, exclude = [], limit) {
    if (!FD.salesVan(st, vsr)) return; // collection / inactive vans never get recommendations
    const { recs } = FD.recommend(st, store.id, date, vsr);
    recs.filter(r => !exclude.includes(r.sku)).slice(0, limit ?? st.rules.maxPerStore).forEach(d => st.recs.push(makeRec(st, d, vsr, date)));
  }
  FD.salesVan = (st, id) => { const v = st.world.vsrs.find(x => x.id === id); return !!v && v.kind === 'sales'; };
  // Route and store changes take effect on their date: s.vsr / s.route switch when the plan for that day is built (past sales stay with the old owner)
  // Route and store changes take effect on their date: the clock moving forward switches s.vsr / s.route (past sales stay with the old owner).
  // Planning a day is date-aware without changing anything (vsrAt / routeAt), so looking at another day never moves a store.
  const ownLast = new WeakMap();
  FD.applyOwnership = function (st, iso) {
    const last = ownLast.get(st); if (last && iso <= last) return; ownLast.set(st, iso); let changed = false;
    for (const s of st.world.stores) if (s.pend && s.pend.from <= iso) { s.vsr = s.pend.vsr; s.route = s.pend.route; s.movedFrom = s.pend.from; s.pend = null; changed = true; }
    if (st.routeAssign.length) for (const s of st.world.stores) { const o = s.pend ? null : FD.routeOwner(st, s.route, iso); if (o && o !== s.vsr) { s.vsr = o; changed = true; } }
    if (changed) FD.invalidate(st);
  };
  const vsrAt = (st, s, iso) => s.pend && s.pend.from <= iso ? s.pend.vsr : (st.routeAssign.length ? FD.routeOwner(st, s.route, iso) || s.vsr : s.vsr);
  // stop tier: 1 = due reorder, pre-order or not invoiced this month; 2 = overdue collection or a Shelf Check request; 3 = ordered in the last 7 days (else 2)
  FD.stopTier = function (st, v) {
    const iso = v.date, id = v.store, s = storeById(st, id); if (!s) return 2;
    const due = FD.storeRecs(st, id).some(r => r.date === iso && r.type === 'LAPSED' && !r.blockedAt);
    const pre = (st.preorders || []).some(p => p.store === id && p.status !== 'DONE' && (p.forDate ? p.forDate === iso : p.at.date === iso));
    let last = null; for (const o of FD.storeAllOrders(st, id)) if (o.units > 0 && o.date < iso && (!last || o.date > last)) last = o.date;
    if (due || pre || !last || last < iso.slice(0, 8) + '01') return 1;
    const sc = FD.scRequest ? FD.scRequest(st, id) : null;
    if ((iso < FD.TODAY && FD.overdueAt ? FD.overdueAt(id, iso) : (s.overdue || 0)) > 0 || (sc && sc.status === 'OPEN')) return 2;
    return FD.daysBetween(last, iso) <= 7 ? 3 : 2;
  };
  FD.ensureDay = function (st, iso) {
    if (st.planned[iso]) return;
    st.planned[iso] = true;
    if (!FD.isSellingDay(iso)) return;
    const routeOf = id => (st.world.vsrs.find(v => v.id === id) || {}).route;
    if (!st.visits.some(v => v.date === iso)) { // past days already hold the real visits
      let plan = FD.realPlan(iso);
      if (!plan.length) { const dw = FD.dow(iso); plan = []; // beyond the extract: each store's usual weekdays
        for (const v of st.world.vsrs) st.world.stores.filter(s => vsrAt(st, s, iso) === v.id && s.days.includes(dw)).forEach((s, i) => plan.push({ van: v.id, store: s.id, seq: i + 1, route: s.pend && s.pend.from <= iso ? s.pend.route : s.route })); }
      for (const p of plan) { const s = storeById(st, p.store); if (!s || (s.closed && s.closed <= iso) || (st.world.vsrs.find(v => v.id === p.van) || {}).kind === 'inactive') continue; const route = p.route || (s.pend && s.pend.from <= iso ? s.pend.route : s.movedFrom && s.movedFrom <= iso ? s.route : routeOf(p.van)); if (!route) continue;
        st.visits.push({ id: nextId(st, 'VI'), store: p.store, vsr: FD.routeOwner(st, route, iso) || p.van, route, date: iso, seq: p.seq, status: 'PLANNED', arrivedAt: null, leftAt: null, skipReason: null, moved: false }); }
    }
    for (const v of st.visits.filter(x => x.date === iso && !x.offPlan && x.status !== 'SKIPPED'))
      if (FD.salesVan(st, v.vsr) && !recsFor(st, iso, v.store).length) genRecs(st, storeById(st, v.store), iso, v.vsr, FD.openTemps(st, v.store, iso).map(r => r.sku));
    for (const rv of (st.revisitQueue || []).filter(x => x.date === iso)) addRevisit(st, rv);
    for (const v of st.visits) if (v.date === iso && v.tier == null) v.tier = FD.stopTier(st, v);
    const vr = new Map(st.visits.filter(v => v.date === iso).map(v => [v.store, v.route]));
    for (const c of st.covers.filter(c => c.date === iso)) st.recs.filter(r => r.date === iso && vr.get(r.store) === c.route).forEach(r => { r.coveredBy = c.vsr; });
  };
  function addRevisit(st, rv) {
    const s = storeById(st, rv.store); const same = st.visits.filter(v => v.date === rv.date && v.route === s.route);
    const planned = same.find(v => v.store === rv.store && v.status === 'PLANNED');
    if (planned) { planned.revisit = true; return; } // already on that day's plan
    const seq = Math.max(0, ...same.map(v => v.seq)) + 1;
    st.visits.push({ id: nextId(st, 'VI'), store: rv.store, vsr: FD.routeOwner(st, s.route, rv.date), route: s.route, date: rv.date, seq, status: 'PLANNED', arrivedAt: null, leftAt: null, skipReason: null, moved: false, revisit: true });
  }
  FD.planFor = function (st, vsrId, iso) {
    FD.ensureDay(st, iso);
    const routes = new Set();
    for (const rt of st.world.routes) if (FD.routeOwner(st, rt.id, iso) === vsrId && !coverFor(st, iso, rt.id)) routes.add(rt.id);
    st.covers.filter(c => c.date === iso && c.vsr === vsrId).forEach(c => routes.add(c.route));
    const stops = st.visits.filter(v => v.date === iso && routes.has(v.route));
    for (const v of stops) if (v.status === 'PLANNED') v.tier = FD.stopTier(st, v); // follows pre-orders and shelf requests that arrive during the day
    const rank = v => v.moved ? 9 : v.tier || 2; // a stop the supervisor moved to the end stays at the end
    stops.sort((a, b) => (rank(a) - rank(b)) || a.seq - b.seq); // tier first, then map order
    const ids = new Set(stops.map(s => s.store));
    const recs = st.recs.filter(r => r.date === iso && ids.has(r.store) && !r.blockedAt);
    const carried = [...ids].flatMap(sid => FD.openTemps(st, sid, iso).filter(r => r.date < iso));
    return { stops, recs, carried, covering: st.covers.filter(c => c.date === iso && c.vsr === vsrId) };
  };
  // Rules/blocks/pins changed: rebuild today's recs for stores not yet visited, keeping anything already actioned.
  function regenToday(st) {
    const iso = st.clock.date; if (!FD.isSellingDay(iso)) return;
    FD.ensureDay(st, iso);
    const open = new Set(st.visits.filter(v => v.date === iso && v.status === 'PLANNED').map(v => v.store));
    const threaded = new Set(st.threads.flatMap(t => t.messages.map(m => m.rec).filter(Boolean)));
    // keep anything the salesman already touched (viewed, qty edited, discussed); only untouched slots regenerate
    const drop = r => r.date === iso && open.has(r.store) && r.outcome === null && !r.blockedAt && !r.untickedAt && r.stage === 'SENT' && r.qtyModified == null && !r.supEdited && !threaded.has(r.id);
    st.recs = st.recs.filter(r => !drop(r)); FD.invalidate(st);
    for (const sid of open) {
      const s = storeById(st, sid); const kept = recsFor(st, iso, sid).filter(r => (!r.blockedAt || r.supRemoved) && !(r.supEdited && !r.supEdited.prev));
      const v = st.visits.find(x => x.date === iso && x.store === sid && x.status === 'PLANNED');
      genRecs(st, s, iso, v.vsr, recsFor(st, iso, sid).map(r => r.sku).concat(FD.openTemps(st, sid, iso).map(r => r.sku)), Math.max(0, st.rules.maxPerStore - kept.length));
      const c = coverFor(st, iso, v.route); if (c) recsFor(st, iso, sid).forEach(r => { r.coveredBy = c.vsr; });
    }
  }

  // ---------- orders and grading ----------
  // a store marked "moved" gets its new location from the next completed visit's arrival point
  function settleRelocate(st, visit) {
    const s = storeById(st, visit.store); if (!s || !s.relocate) return; const a = visit.arrival;
    if (!a) return; // ponytail: no GPS trace in the mockup, so the old pin stays and the store keeps "location to confirm" until a visit has an arrival point
    s.lat = a.lat; s.lng = a.lng; s.relocate = false; s.relocatedOn = visit.date; FD.invalidate(st);
  }
  function applyLines(st, visit, lines, date, time, opts = {}) {
    const store = visit.store; const known = knownSkus(st, store, date);
    const recs = recsFor(st, date, store).filter(r => !r.blockedAt && (r.outcome === null || r.outcome === 'WAITING'));
    const temps = FD.openTemps(st, store, date, visit.id);
    if (opts.push !== false) for (const l of lines) st.orders.push({ id: nextId(st, 'O'), store, vsr: visit.vsr, date, sku: l.sku, units: l.units, value: l.value ?? +(l.units * FD.sku(l.sku).cost).toFixed(2), time: l.time || time, src: opts.src || 'SB' });
    const hist = known.map(sku => ({ sku }));
    const graded = [];
    for (const r of recs) {
      const g = FD.grade(r, lines, hist);
      r.outcome = g.outcome; r.got = g.got; r.alt = g.alt; r.gradedAt = time; r.gradedVisit = visit.id;
      r.maturity = FD.SOLD.includes(g.outcome) ? 'PENDING' : null; FD.setExtra(r);
      graded.push(r);
    }
    for (const r of temps) {
      const g = FD.grade(r, lines, hist);
      if (FD.SOLD.includes(g.outcome)) { Object.assign(r, { firstReason: r.reason, outcome: g.outcome, got: g.got, alt: g.alt, revisit: true, soldOn: date, gradedAt: time, gradedVisit: visit.id, maturity: 'PENDING' }); FD.setExtra(r); graded.push(r); }
      else r.revisitClosed = true; // offered again on the next visit and still not taken
    }
    const recSkus = new Set(recs.concat(temps).map(r => r.sku)), altSkus = new Set(recs.concat(temps).filter(r => r.alt).map(r => r.alt));
    // a miss only means something when the visit had recommendations to compare against
    if (recs.length || temps.length) for (const l of lines) if (FD.recommendable(l.sku) && !known.includes(l.sku) && !FD.orderedElsewhen(store, l.sku, date) && !recSkus.has(l.sku) && !altSkus.has(l.sku)) st.misses.push({ id: nextId(st, 'M'), store, vsr: visit.vsr, date, sku: l.sku, type: 'UNREC', recSku: null, mark: null });
    for (const r of recs.concat(temps.filter(x => x.revisit && x.soldOn === date))) if (r.outcome === 'ALT') st.misses.push({ id: nextId(st, 'M'), store, vsr: visit.vsr, date, sku: r.alt, type: 'ALT', recSku: r.sku, mark: null });
    visit.status = 'DONE'; visit.leftAt = visit.leftAt || time; settleRelocate(st, visit);
    st.lastOrder = { store, date };
    return graded;
  }
  function linesFor(st, r, store, date, recs, mode) {
    const lines = FD.baselineLines(r, store, date).filter(l => !recs.some(x => x.sku === l.sku || x.alt === l.sku));
    const known = knownSkus(st, store.id, date);
    recs.forEach((rec, i) => {
      const q = rec.qtyModified ?? rec.qty;
      let m = mode === 'RANDOM' ? FD.pick(r, ['FULL', 'FULL', 'PARTIAL', 'ALT', 'NOT_SOLD', 'NOT_SOLD']) : mode;
      if (m === 'PARTIAL' && q < 2) m = 'FULL';
      if (m === 'ALT') {
        const s = FD.sku(rec.sku); const alt = [...FD.sistersOf(s), s.bigger].filter(Boolean).find(c => !known.includes(c) && !lines.some(l => l.sku === c));
        if (alt && (mode !== 'ALT' || i === 0)) { lines.push({ sku: alt, units: 1 }); return; }
        m = mode === 'ALT' && i > 0 ? 'NOT_SOLD' : 'FULL';
      }
      if (m === 'FULL') lines.push({ sku: rec.sku, units: q });
      if (m === 'PARTIAL') lines.push({ sku: rec.sku, units: Math.max(1, Math.floor(q / 2)) });
    });
    return lines;
  }
  function gradeNotify(st, graded, visit) {
    for (const r of graded) {
      const vsr = FD.recVsr(r); const target = { screen: 'store', store: visit.store, rec: r.id };
      if (FD.SOLD.includes(r.outcome)) notify(st, vsr, 'N_SOLD', { skuCode: r.alt || r.sku, storeId: visit.store }, target);
      else if (r.outcome === 'NOT_SOLD') notify(st, vsr, 'N_NOT_SOLD', { skuCode: r.sku, storeId: visit.store }, { ...target, reason: true });
    }
  }

  // ---------- simulation ----------
  const REASONS = [['R_PRICE', 18], ['R_ENOUGH', 16], ['R_NO_SHELF', 12], ['R_BUYER_NO', 10], ['R_BUYER_ABSENT', 10], ['R_COMPETITOR', 10], ['R_NOT_ON_VAN', 6], ['R_CREDIT', 5], ['R_SYSTEM', 3], ['R_OTHER', 3]];
  const BRANDS = [['BR_LUSINE', 50], ['BR_7DAYS', 35], ['BR_SABAHOO', 10], ['BR_OTHER', 5]];
  // SalesBuzz no-sale reason of the visit -> our reason code
  const NC_REASON = { 1: 'R_BUYER_ABSENT', 3: 'R_BUYER_ABSENT', 2: 'R_CREDIT', 6: 'R_ENOUGH', 7: 'R_BUYER_NO' };
  const weighted = (r, list) => { const tot = list.reduce((a, x) => a + x[1], 0); let x = r() * tot; for (const [k, w] of list) { if ((x -= w) < 0) return k; } return list[0][0]; };
  const factor = (st, vsr) => (st.vanFactor && st.vanFactor[vsr]) || 1;
  function drawReason(r, rec, vsr, st) {
    let list = REASONS;
    // seeds from the real data: the lowest-converting van hears "price" more; the next one often skips reasons
    if (vsr === st.priceVan) list = REASONS.map(([k, w]) => [k, k === 'R_PRICE' ? w * (FD.sku(rec.sku).group === 'GRP_CUPBOX' ? 16 : 7) : w]);
    if (r() < (vsr === st.skipVan ? 0.4 : 0.015)) return;
    rec.reason = weighted(r, list);
    if (rec.reason === 'R_COMPETITOR') rec.brand = weighted(r, BRANDS);
    if (rec.reason === 'R_OTHER') rec.comment = 'Owner travelling this week';
  }
  // Past days: real visits and real order lines; recommendations taken up at the engine's priors are added as UPLIFT lines.
  function simulatePast(st, d) {
    FD.ensureDay(st, d);
    const r = FD.rng(st.seed * 7919 + FD.daysBetween(FD.HIST_START, d));
    const done = st.visits.filter(v => v.date === d && v.status === 'DONE' && !v.offPlan).sort((a, b) => a.vsr.localeCompare(b.vsr) || a.seq - b.seq);
    for (const v of done) {
      const recs = recsFor(st, d, v.store).filter(x => !x.blockedAt && x.outcome === null && x.vsr === v.vsr);
      if (!recs.length) continue;
      const lines = FD.realLines(d, v.vsr, v.store).map(l => ({ sku: l.sku, units: l.units }));
      const known = knownSkus(st, v.store, d); const extra = [];
      for (const rec of recs) {
        rec.stage = 'VIEWED'; rec.viewedAt = v.arrivedAt;
        if (!lines.length) continue;
        if (r() < 0.10) { rec.outcome = 'NOT_OFFERED'; if (r() > 0.05) rec.reason = FD.pick(r, ['NF_FIT', 'NF_FIT', 'NF_TIME', 'NF_BUSY']); continue; }
        if (lines.some(l => l.sku === rec.sku) || r() >= FD.PRIOR[rec.type] * factor(st, v.vsr)) continue;
        const x = r(), q = rec.qty, s = FD.sku(rec.sku);
        if (x < 0.6 || q < 2) extra.push({ sku: rec.sku, units: q });
        else if (x < 0.85) extra.push({ sku: rec.sku, units: Math.max(1, Math.floor(q / 2)) });
        else { const alt = [...FD.sistersOf(s), s.bigger].filter(Boolean).find(c => !known.includes(c) && !lines.concat(extra).some(l => l.sku === c)); extra.push(alt ? { sku: alt, units: 1 } : { sku: rec.sku, units: q }); }
      }
      for (const l of extra) st.orders.push({ id: nextId(st, 'O'), store: v.store, vsr: v.vsr, date: d, sku: l.sku, units: l.units, value: +(l.units * FD.sku(l.sku).cost).toFixed(2), time: v.leftAt, src: 'UPLIFT' });
      const graded = applyLines(st, v, lines.concat(extra), d, v.leftAt || '12:00', { push: false });
      for (const rec of graded) {
        if (rec.outcome === 'NOT_SOLD') { if (!lines.length && NC_REASON[v.nc]) rec.reason = NC_REASON[v.nc]; else drawReason(r, rec, v.vsr, st); }
        if (FD.SOLD.includes(rec.outcome) && ++st.soldCount % 60 === 0) { rec.corrected = true; rec.prevOutcome = 'NOT_SOLD'; } // SalesBuzz edits an order now and then
      }
    }
    for (const rec of st.recs) if (rec.date === d && rec.outcome === null && !rec.blockedAt) rec.outcome = 'CARRIED';
    settlePending(st, d);
  }
  // Today: the real visits and orders of the day appear as the clock passes their time. A stop the salesman already closed in the app is left as is.
  FD.applyRealUntil = function (st, time) {
    const d = FD.TODAY; if (st.clock.date !== d) return;
    FD.ensureDay(st, d); st.realApplied = st.realApplied || {};
    for (const x of FD.realStops(d)) {
      const k = x.van + '|' + x.store; if (st.realApplied[k] || x.start > time) continue;
      st.realApplied[k] = true;
      const route = (st.world.vsrs.find(v => v.id === x.van) || {}).route;
      let v = st.visits.find(y => y.date === d && y.store === x.store && (y.route === route || (y.reassigned && y.reassigned.from === x.van)) && y.status !== 'SKIPPED');
      if (v && v.status === 'DONE') continue;
      if (!v) { v = { id: nextId(st, 'VI'), store: x.store, vsr: x.van, route, date: d, seq: Math.max(0, ...st.visits.filter(y => y.date === d && y.route === route).map(y => y.seq)) + 1, status: 'PLANNED', arrivedAt: null, leftAt: null, skipReason: null, moved: false, offPlan: true }; st.visits.push(v); }
      v.arrivedAt = v.arrivedAt || x.start; v.nc = x.nc; v.real = true; if (x.collected) v.collected = x.collected; // collection-only stop: a completed visit, never a skip
      gradeNotify(st, applyLines(st, v, FD.realLines(d, x.van, x.store), d, x.end), v);
      v.leftAt = x.end;
      for (const rt of FD.realReturns(d).filter(y => y.store === x.store && y.van === x.van)) st.returns.push({ id: nextId(st, 'RT'), store: rt.store, sku: rt.sku, date: d, saleDate: null, units: rt.units, value: rt.value, reason: rt.reason, vsr: rt.van });
    }
  };
  function closeToday(st, d) {
    FD.applyRealUntil(st, '23:59');
    const visited = new Set(st.visits.filter(v => v.date === d && v.status === 'DONE').map(v => v.store));
    for (const v of st.visits) if (v.date === d && v.status === 'PLANNED') v.status = visited.has(v.store) ? 'SKIPPED' : 'MISSED';
    for (const rec of st.recs) if (rec.date === d && rec.outcome === null && !rec.blockedAt) rec.outcome = 'CARRIED';
    settlePending(st, d);
  }
  function simulateDay(st, d) {
    if (d < FD.TODAY) return simulatePast(st, d);
    if (d === FD.TODAY) { const c = st.clock; st.clock = { date: d, time: '23:59' }; closeToday(st, d); st.clock = c; return; }
    FD.ensureDay(st, d);
    const r = FD.rng(st.seed * 7919 + FD.daysBetween(FD.HIST_START, d));
    const todays = st.visits.filter(v => v.date === d && (v.status === 'PLANNED' || v.status === 'ARRIVED')).sort((a, b) => a.vsr.localeCompare(b.vsr) || a.seq - b.seq);
    for (const v of todays) {
      const store = storeById(st, v.store); const start = 8 * 60 + (v.seq - 1) * 55;
      if (st.pendingOrders[v.store] && (st.pendingOrders[v.store].date || d) === d) { const p = st.pendingOrders[v.store]; delete st.pendingOrders[v.store]; restoreWaiting(st, p); applyLines(st, st.visits.find(x => x.id === p.visitId) || v, p.lines, d, p.time); continue; }
      if (v.status === 'PLANNED' && r() < 0.01) { v.status = 'SKIPPED'; v.skipReason = 'SK_CLOSED'; continue; }
      v.status = 'ARRIVED'; v.arrivedAt = v.arrivedAt || hhmm(start);
      const vsr = v.vsr; const recs = recsFor(st, d, v.store).filter(x => !x.blockedAt && x.outcome === null);
      const plannedLines = [];
      for (const rec of recs) {
        rec.stage = 'VIEWED'; rec.viewedAt = hhmm(start);
        if (r() < 0.10) { rec.outcome = 'NOT_OFFERED'; if (r() > 0.05) rec.reason = FD.pick(r, ['NF_FIT', 'NF_FIT', 'NF_TIME', 'NF_BUSY']); continue; }
        const win = r() < FD.PRIOR[rec.type] * factor(st, vsr);
        if (win) { const x = r(); rec._m = x < 0.6 ? 'FULL' : x < 0.85 ? 'PARTIAL' : 'ALT'; } else rec._m = 'NOT_SOLD';
        plannedLines.push(rec);
      }
      const lines = FD.baselineLines(r, store, d).filter(l => !recs.some(x => x.sku === l.sku));
      const known = knownSkus(st, v.store, d);
      for (const rec of plannedLines) {
        const q = rec.qty; const s = FD.sku(rec.sku);
        if (rec._m === 'FULL' || (rec._m === 'PARTIAL' && q < 2)) lines.push({ sku: rec.sku, units: q });
        else if (rec._m === 'PARTIAL') lines.push({ sku: rec.sku, units: Math.max(1, Math.floor(q / 2)) });
        else if (rec._m === 'ALT') {
          const alt = [...FD.sistersOf(s), s.bigger].filter(Boolean).find(c => !known.includes(c) && !lines.some(l => l.sku === c));
          lines.push(alt ? { sku: alt, units: 1 } : { sku: rec.sku, units: q });
        }
        delete rec._m;
      }
      for (const tr of FD.openTemps(st, v.store, d, v.id)) if (r() < 0.35 && !lines.some(l => l.sku === tr.sku)) lines.push({ sku: tr.sku, units: tr.qty });
      if (r() < 0.03) { const cand = FD.SKUS.filter(s => !known.includes(s.code) && !lines.some(l => l.sku === s.code) && !recs.some(x => x.sku === s.code)); if (cand.length) lines.push({ sku: FD.pick(r, cand).code, units: 1 }); }
      // expiry returns on regular stock: Fruit Slice is the known problem SKU (watchlist), other cakes rarely
      for (const l of lines) { const s = FD.sku(l.sku); const pr = s.category === 'cake' ? 0.01 : 0;
        if (pr && r() < pr) st.returns.push({ id: nextId(st, 'RT'), store: v.store, sku: l.sku, date: FD.addDays(d, FD.int(r, 5, 12)), saleDate: d, units: 1, value: +s.cost.toFixed(2), expiry: true }); }
      v.leftAt = hhmm(start + 20);
      const graded = applyLines(st, v, lines, d, hhmm(start + 15));
      for (const rec of graded) {
        if (rec.outcome === 'NOT_SOLD') drawReason(r, rec, vsr, st);
        if (FD.SOLD.includes(rec.outcome)) {
          st.soldCount = (st.soldCount || 0) + 1;
          if (st.soldCount % 300 === 0) { rec.corrected = true; rec.prevOutcome = 'NOT_SOLD'; }
          const sku = rec.alt || rec.sku;
          if (st.watchlist.includes(sku) && r() < 0.10)
            st.returns.push({ id: nextId(st, 'RT'), store: v.store, sku, date: FD.addDays(d, 7), saleDate: d, units: rec.got || 1, value: +((rec.got || 1) * FD.sku(sku).cost).toFixed(2) });
        }
      }
    }
    // Anything still ungraded on a finished day carries to the next visit.
    for (const rec of st.recs) if (rec.date === d && rec.outcome === null && !rec.blockedAt) rec.outcome = 'CARRIED';
    settlePending(st, d);
  }
  FD.refreshMaturity = st => { for (const r of st.recs) if (FD.SOLD.includes(r.outcome)) r.maturity = FD.maturity(st, r, st.clock.date); };
  FD.simulatePilot = function (st, from, to) {
    for (let d = from; d <= to; d = FD.addDays(d, 1)) if (FD.isSellingDay(d)) simulateDay(st, d); else st.planned[d] = true;
    st.simulatedThrough = to;
  };

  // Area / class assortment: products carried by >=60% of stores of that class or area type (last 8 weeks when a date is given)
  FD.computeMustStock = (world, orders, iso) => {
    const from = iso ? FD.addDays(iso, -56) : null; const carried = new Map();
    for (const o of orders) if (o.units > 0 && (!from || (o.date > from && o.date <= iso))) (carried.get(o.store) || carried.set(o.store, new Set()).get(o.store)).add(o.sku);
    const by = pred => { const ss = world.stores.filter(pred); return FD.SKUS.filter(k => ss.length && ss.filter(x => (carried.get(x.id) || new Set()).has(k.code)).length / ss.length >= 0.6).map(k => k.code); };
    const m = {}; for (const l of FD.LABELS) m[l] = by(s => s.label === l); for (const t of FD.TAGS) m[t] = by(s => (s.tags || []).includes(t)); return m;
  };

  // ---------- fresh state ----------
  function fresh(seed) {
    const world = FD.buildWorld(seed);
    const hist = FD.buildHistory(world, seed, FD.HIST_START, FD.addDays(FD.TODAY, -1));
    const r = FD.rng(seed + 99); const sales = world.vsrs.filter(v => v.kind === 'sales');
    // van stock from HH_CarStore when available, falling back to each van's weekly store mix with one stocked-out product
    const vanStock = {}; const realVS = (FD.REAL && FD.REAL.vanStock) || {};
    for (const v of world.vsrs) { vanStock[v.id] = {}; const mine = world.stores.filter(s => s.vsr === v.id); const rv = realVS[v.id] || {};
      const recSkus = FD.SKUS.filter(k => FD.recommendable(k.code)); const realZeros = recSkus.filter(k => rv[k.code] === 0);
      const zero = (realZeros.length ? realZeros[0] : FD.pick(r, recSkus)).code;
      for (const k of FD.SKUS) { const wk = mine.reduce((a, s) => a + (s.carry[k.code] || 0), 0); const realQty = rv[k.code];
        vanStock[v.id][k.code] = k.code === zero ? 0 : (realQty > 0 ? realQty : Math.max(FD.int(r, 4, 10), Math.round(wk / 4))); } }
    // conversion factor per van from its real order rate (orders per visit), 0.8-1.2
    const rate = {}; for (const v of sales) { const vis = hist.visits.filter(x => x.vsr === v.id && x.status === 'DONE').length; const ord = new Set(hist.orders.filter(o => o.vsr === v.id).map(o => o.store + o.date)).size; rate[v.id] = vis ? ord / vis : 0; }
    const avg = Object.values(rate).reduce((a, b) => a + b, 0) / Math.max(1, sales.length);
    const vanFactor = {}; for (const v of sales) vanFactor[v.id] = Math.max(0.8, Math.min(1.2, avg ? rate[v.id] / avg : 1));
    // seeded behaviours go to the vans with the most real visits (enough outcomes for the patterns to show)
    const doneN = {}; for (const x of hist.visits) if (x.status === 'DONE') doneN[x.vsr] = (doneN[x.vsr] || 0) + 1;
    const byRate = sales.slice().sort((a, b) => (doneN[b.id] || 0) - (doneN[a.id] || 0));
    const mustStock = FD.computeMustStock(world, hist.orders, null);
    // watchlist seed: the cake with the highest real return rate
    const sold = {}, ret = {}; for (const o of hist.orders) sold[o.sku] = (sold[o.sku] || 0) + o.units; for (const x of hist.returns) ret[x.sku] = (ret[x.sku] || 0) + x.units;
    const watch = FD.SKUS.filter(k => k.category === 'cake' && (sold[k.code] || 0) > 50).sort((a, b) => (ret[b.code] || 0) / sold[b.code] - (ret[a.code] || 0) / sold[a.code])[0];
    const planned = {}; for (let d = FD.HIST_START; d < FD.PILOT_START; d = FD.addDays(d, 1)) planned[d] = true;
    const st = {
      v: 1, dv: 0, seed, clock: { date: FD.PILOT_START, time: '07:00' }, lang: 'en', digits: 'arab', role: 'sup', vsrId: (sales.find(v => v.id === 'V06') || sales[0]).id, textSize: 'normal', theme: 'auto',
      world, orders: hist.orders, returns: hist.returns, visits: hist.visits, recs: [], misses: [], threads: [], tips: [], notifs: [], corrections: [],
      rules: { lapsedDays: 14, cooldownDays: 14, maturityDays: 28, /* lapsedDays and maturityDays are retired (engine uses catGap / catWindow); kept only while screens still read them */ catGap: Object.assign({}, FD.CAT_GAP), catWindow: Object.assign({}, FD.CAT_WINDOW), cannedLift: 1.1,
        maxPerStore: 3, firstFillMax: 3 /* cases: a guard only, the usual first order drives the quantity */, vanFeed: true, mustStock },
      blocks: [], pins: [], watchlist: watch ? [watch.code] : [], watchMeta: watch ? { [watch.code]: { since: FD.PILOT_START, review: FD.addDays(FD.PILOT_START, FD.WATCH_DAYS) } } : {}, watchHistory: [],
      reasonEdit: { custom: {}, hidden: [], names: {} }, vanStock, vanFactor, priceVan: byRate[0] && byRate[0].id, skipVan: byRate[1] && byRate[1].id, cooldownOverrides: [], covers: [],
      followupDone: {}, followupSnooze: {}, tipDone: {}, tourSeen: { sup: false, vsr: false }, dayConfirmed: {}, offline: false, queue: [], log: [], audit: [],
      planned, pendingOrders: {}, fuHistory: [], revisitQueue: [], planChanges: [], routeAssign: [], sbPending: [], photos: [], delaySync: false, notifSent: {}, seq: 0, simulatedThrough: null, lastOrder: null, keys: {}, soldCount: 0,
      realApplied: {}, released: {}, vanClosed: {}, dayClosed: {}, preorders: [], freqChanges: [], ownerMsgs: [],
      planogram: { assessments: [], observations: [], columnPrefs: {}, deferred: {} }
    };
    FD.simulatePilot(st, FD.PILOT_START, FD.addDays(FD.TODAY, -1));
    st.clock = { date: FD.TODAY, time: '07:00' };
    FD.refreshMaturity(st);
    FD.ensureDay(st, FD.TODAY);
    seedExtras(st);
    return st;
  }
  // seeded text that a store owner or supervisor would really write, in the language the viewer reads
  FD.txtOf = v => (v && typeof v === 'object' ? (v[FD.lang] || v.en) : v);
  const E2 = (en, ar) => ({ en, ar });
  function seedOwnerChats(st) {
    const y = FD.addDays(FD.TODAY, -1), y2 = FD.addDays(FD.TODAY, -2);
    const withOrders = st.world.stores.filter(s => FD.salesVan(st, s.vsr) && st.orders.some(o => o.store === s.id && o.date < FD.TODAY));
    const promo = (st.world.promos || []).find(p => p.start <= FD.TODAY && p.end >= FD.TODAY);
    const [a, b, c] = [withOrders[3], withOrders[11], withOrders[24]];
    if (a && promo) { R.OWNER_MSG_SEND(st, { store: a.id, kind: 'PROMO', ref: promo.id, at: { date: y2, time: '10:05' } });
      R.OWNER_MSG_IN(st, { store: a.id, kind: 'PHOTO', photo: FD.PHOTOS ? FD.PHOTOS[7] : null, text: E2('This is my shelf now. Good, send 3 cartons with the next visit please.', 'هذا الرف الآن. تمام، أرسلوا ٣ كراتين مع الزيارة القادمة لو سمحتم.'), at: { date: y2, time: '11:40' } }); }
    if (b) { R.OWNER_MSG_IN(st, { store: b.id, kind: 'PHOTO', photo: FD.PHOTOS ? FD.PHOTOS[2] : null, text: E2('Cake shelf is almost empty.', 'رف الكيك شبه فاضي.'), at: { date: y, time: '18:20' } });
      R.OWNER_MSG_SEND(st, { store: b.id, kind: 'TEXT', text: E2('Thank you. Our salesman will bring cake bars tomorrow.', 'شكرًا لك. مندوبنا سيحضر كيك بار غدًا.'), at: { date: y, time: '18:42' } }); }
    if (c) { R.OWNER_MSG_IN(st, { store: c.id, kind: 'PHOTO', photo: FD.PHOTOS ? FD.PHOTOS[12] : null, text: E2('New stock is on the shelf.', 'البضاعة الجديدة على الرف.'), at: { date: y, time: '19:34' } }); }
    // three pre-orders that came in this morning from stores on today's plan
    const planned = [...new Set(st.visits.filter(v => v.date === FD.TODAY && v.status === 'PLANNED' && FD.salesVan(st, v.vsr)).map(v => v.store))];
    const notes = [E2('Please bring 2 cartons of rolls today.', 'لو سمحت أحضر كرتونين رولات اليوم.'), E2('Need cake bars, shelf is empty.', 'نحتاج كيك بار، الرف فاضي.'), E2('Add 1 carton of slice cake to my order.', 'أضف كرتون كيك شرائح لطلبي.')];
    const later = st.world.stores.find(x => !planned.includes(x.id) && FD.salesVan(st, x.vsr) && !st.visits.some(v => v.store === x.id && v.date === FD.TODAY) && st.orders.some(o => o.store === x.id));
    [planned[5], planned[17], later ? later.id : planned[40]].filter(Boolean).forEach((sid, i) => R.PREORDER_ADD(st, { store: sid, text: notes[i], photo: i === 1 && FD.PHOTOS ? FD.PHOTOS[4] : null, at: { date: FD.TODAY, time: ['06:12', '06:35', '06:51'][i] } }));
  }
  // WhatsApp cards sent yesterday evening and the owners' button replies (simulated, deterministic): about a third reply
  function seedWaCards(st) {
    const r = FD.rng(st.seed * 31 + 7), pick = (xs, ws) => { let x = r(), i = 0; for (; i < ws.length - 1 && x >= ws[i]; i++) x -= ws[i]; return xs[i]; };
    let y = FD.addDays(FD.TODAY, -1); while (!FD.isSellingDay(y)) y = FD.addDays(y, -1); const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    const send = (store, card, slots, sentMin, by) => { R.OWNER_MSG_SEND(st, { store, kind: 'CARD', card, slots, by: by || 'SUP', at: { date: y, time: hm(sentMin) } }); return st.ownerMsgs[st.ownerMsgs.length - 1]; };
    const reply = (m, choice, sub, min) => R.WA_REPLY(st, { msg: m.id, choice, sub, at: { date: y, time: hm(min) } });
    const sent = { VISIT: [], BALANCE: [], EXPIRY: [], RATING: [], NEWPROD: [] };
    // visit notices for today's plan (one per store, from its salesman), times spread along the route
    const today = st.visits.filter(v => v.date === FD.TODAY && !v.offPlan && FD.salesVan(st, v.vsr)).sort((a, b) => a.seq - b.seq);
    for (const v of today) { const m = send(v.store, 'VISIT', { vsrId: v.vsr, date: FD.TODAY, time: hm(8 * 60 + Math.min(v.seq, 20) * 25) }, 19 * 60 + 30, v.vsr); sent.VISIT.push(m);
      if (r() < 0.34) { const c = pick(['W_R_CONFIRM', 'W_R_CHANGE', 'W_R_NOT'], [0.72, 0.14, 0.14]); reply(m, c, c === 'W_R_NOT' ? pick(['W_S_STOCK', 'W_S_CLOSED', 'W_S_DAY'], [0.55, 0.25, 0.2]) : null, 19 * 60 + 35 + Math.floor(r() * 90)); } }
    // balance reminders to stores with an open balance on today's plan
    for (const v of today.filter(v => FD.dueBefore(v.store, FD.TODAY) >= 100).slice(0, 14)) { const m = send(v.store, 'BALANCE', { money: Math.round(FD.dueBefore(v.store, FD.TODAY)) }, 10 * 60); sent.BALANCE.push(m);
      if (r() < 0.45) reply(m, pick(['W_R_PAYVISIT', 'W_R_PAID'], [0.7, 0.3]), null, 10 * 60 + 20 + Math.floor(r() * 300)); }
    // ratings after yesterday's visits that had an order
    const done = [...new Map(st.visits.filter(v => v.date === y && v.status === 'DONE' && FD.salesVan(st, v.vsr)).map(v => [v.store, v])).values()]
      .filter(v => st.orders.some(o => o.date === y && o.store === v.store)).slice(0, 12);
    for (const v of done) { const g = send(v.store, 'RATING', { vsrId: v.vsr }, 21 * 60); sent.RATING.push(g); if (r() < 0.45) reply(g, pick(['W_R_GOOD', 'W_R_FAIR', 'W_R_POOR'], [0.7, 0.2, 0.1]), null, 21 * 60 + 5 + Math.floor(r() * 50)); }
    // expiry checks and a new-product card to a few stores on today's plan
    const sku = (FD.SKUS.find(k => FD.recommendable(k.code)) || FD.SKUS[0]).code;
    today.slice(30, 38).forEach(v => { const m = send(v.store, 'EXPIRY', {}, 11 * 60); sent.EXPIRY.push(m); if (r() < 0.5) reply(m, pick(['W_R_NO', 'W_R_YES'], [0.7, 0.3]), null, 11 * 60 + 30 + Math.floor(r() * 200)); });
    today.slice(50, 56).forEach(v => { const m = send(v.store, 'NEWPROD', { skuCode: sku, n: 6 }, 12 * 60); sent.NEWPROD.push(m); if (r() < 0.5) reply(m, pick(['W_R_ADD', 'W_R_NOTNOW'], [0.4, 0.6]), null, 12 * 60 + 15 + Math.floor(r() * 200)); });
    // make sure each reply that drives a rule appears at least once in the demo
    for (const [card, choice, sub] of [['VISIT', 'W_R_NOT', 'W_S_STOCK'], ['VISIT', 'W_R_CHANGE'], ['BALANCE', 'W_R_PAID'], ['BALANCE', 'W_R_PAYVISIT'], ['RATING', 'W_R_POOR'], ['EXPIRY', 'W_R_YES'], ['NEWPROD', 'W_R_ADD']]) {
      if (sent[card].some(m => m.reply && m.reply.choice === choice)) continue; const m = sent[card].find(x => !x.reply); if (m) reply(m, choice, sub || null, 21 * 60 + 40); }
  }
  function seedExtras(st) {
    seedOwnerChats(st); seedWaCards(st);
    const y = FD.addDays(FD.TODAY, -1); const sales = st.world.vsrs.filter(v => v.kind === 'sales');
    const doneStores = [...new Set(st.visits.filter(x => x.status === 'DONE' && x.date < FD.TODAY && FD.salesVan(st, x.vsr)).map(x => x.store))];
    // shelf photos: every store on today's plan and every third visited store has 1-3 photos from its last visits
    if (FD.PHOTOS) { const P = FD.PHOTOS; let n = 0;
      const todayStores = new Set(st.visits.filter(x => x.date === FD.TODAY).map(x => x.store));
      const lastDone = {}; for (const x of st.visits) if (x.status === 'DONE' && x.date < FD.TODAY) (lastDone[x.store] = lastDone[x.store] || []).push(x);
      st.world.stores.forEach((so, i) => { const vs = (lastDone[so.id] || []).slice(-2);
        if (!vs.length) vs.push({ vsr: so.vsr, date: FD.addDays(FD.TODAY, -3 - (i % 9)), leftAt: '11:30' });
        vs.forEach((v, j) => { for (let k = 0; k < (j === vs.length - 1 ? 1 + (i % 2) : 1); k++) { n++; const ref = (i * 7 + j * 3 + k) % P.length; st.photos.push({ id: 'PH' + n, store: so.id, vsr: v.vsr, date: v.date, time: v.leftAt || '12:00', src: P[ref], ref, seeded: true }); } }); });
      // a reason with a photo is how the salesman proves a full shelf or a competitor on display
      st.recs.filter(r => ['R_NO_SHELF', 'R_COMPETITOR', 'R_ENOUGH'].includes(r.reason)).forEach((r, i) => { if (i % 4 === 0) r.photo = P[(i * 5) % P.length]; });  if (FD.scSeed) FD.scSeed(st); if (FD.compSeed) FD.compSeed(st); }
    const at = { date: y, time: '16:40' };
    const pv = st.priceVan; const pr = st.recs.filter(r => r.vsr === pv && r.reason === 'R_PRICE').pop();
    if (pr) { postMsg(st, { type: 'rec', id: pr.id }, pv, { text: 'Owner says the carton is too much. He wants a few packs only.', at });
      postMsg(st, { type: 'rec', id: pr.id }, 'SUP', { text: FD.CATALOG.QR_ONEBOX.en, qr: 'QR_ONEBOX', at: { date: y, time: '18:05' } });
      const th = st.threads.find(x => x.anchor.id === pv); if (th) { th.unreadSup = false; th.seenSup = y + ' 18:05'; } }
    const sv = st.skipVan; const sstore = st.world.stores.find(s => s.vsr === sv);
    // the reason-skipping van always shows the pattern: its 4 latest "not sold" have no reason yet
    st.recs.filter(r => r.vsr === sv && r.outcome === 'NOT_SOLD' && r.date < FD.TODAY && r.reason).slice(-4).forEach(r => { r.reason = null; r.brand = null; r.comment = null; });
    if (sstore) postMsg(st, { type: 'store', id: sstore.id }, sv, { text: 'Two expired cake packs to pick up here.', topic: 'R_T_RETURN', at: { date: y, time: '13:20' } });
    const good = sales[sales.length - 1];
    st.tips.push({ id: nextId(st, 'TP'), vsr: good.id, tpl: 'K_GOOD', slots: { pct: 12 }, status: 'SENT', sentAt: { date: FD.addDays(FD.TODAY, -6), time: '09:00' }, read: true, text: null });
    const gstore = st.world.stores.find(s => s.vsr === good.id && s.profile !== 'AP_SCHOOL');
    if (gstore) st.corrections.push({ id: nextId(st, 'CR'), vsr: good.id, store: gstore.id, kind: 'CORR_TAG', value: 'TAG_SCHOOL', comment: 'There is a girls school opposite now.', status: 'PENDING', at });
    for (const r of st.recs.filter(r => r.date === y)) {
      const target = { screen: 'store', store: r.store, rec: r.id };
      if (FD.SOLD.includes(r.outcome)) st.notifs.push({ id: nextId(st, 'N'), vsr: r.vsr, tpl: 'N_SOLD', slots: { skuCode: r.alt || r.sku, storeId: r.store }, target, at: { date: y, time: r.gradedAt || '12:00' }, read: true });
      if (r.outcome === 'NOT_SOLD') st.notifs.push({ id: nextId(st, 'N'), vsr: r.vsr, tpl: 'N_NOT_SOLD', slots: { skuCode: r.sku, storeId: r.store }, target: { ...target, reason: true }, at: { date: y, time: r.gradedAt || '12:00' }, read: !!r.reason });
    }
  }

  // ---------- reducers ----------
  const R = {};
  FD.registerReducer = (type, fn) => { if (R[type]) throw new Error('Reducer already registered: ' + type); if (typeof fn !== 'function') throw new Error('Reducer must be a function'); R[type] = fn; };
  const rec = (st, id) => st.recs.find(r => r.id === id);
  const visitOf = (st, store, date, id, prefer) => {
    if (id) { const v = st.visits.find(x => x.id === id); if (v) return v; }
    const vs = st.visits.filter(v => v.store === store && v.date === date);
    return vs.find(v => v.status === (prefer || 'ARRIVED')) || vs.find(v => v.status === 'PLANNED' || v.status === 'ARRIVED') || vs[vs.length - 1];
  };
  function restoreWaiting(st, po) { for (const w of po.waiting || []) { const r = rec(st, w.id); if (r && r.outcome === 'WAITING') r.outcome = w.prev; } }
  // an order that never arrived: recommendations of that visit become 'no order found'; carried ones stay open
  function settlePending(st, d) {
    for (const [sid, po] of Object.entries(st.pendingOrders)) if ((po.date || d) <= d) {
      for (const w of po.waiting || []) { const r = rec(st, w.id); if (r && r.outcome === 'WAITING') { if (w.prev === null) { r.outcome = 'NOT_SOLD'; r.noOrder = true; } else r.outcome = w.prev; } }
      delete st.pendingOrders[sid];
    }
    for (const r of st.recs) if (r.outcome === 'WAITING' && r.date <= d && !Object.values(st.pendingOrders).some(po => (po.waiting || []).some(w => w.id === r.id))) { r.outcome = 'NOT_SOLD'; r.noOrder = true; }
  }
  const audit = (st, id, slots) => st.audit.push({ at: now(st), id, slots });
  R.SET_LANG = (st, p) => { st.lang = p.lang; };
  R.SET_DIGITS = (st, p) => { st.digits = p.digits; };
  R.SET_ROLE = (st, p) => { st.role = p.role; };
  R.SET_VSR = (st, p) => { st.vsrId = p.vsr; };
  R.SET_TEXT_SIZE = (st, p) => { st.textSize = p.size; };
  R.SET_THEME = (st, p) => { st.theme = p.theme; };
  R.TOUR_SEEN = (st, p) => { st.tourSeen[p.role] = true; };
  R.TOUR_RESET = st => { st.tourSeen = { sup: false, vsr: false }; };
  R.CLOCK_SET = (st, p) => {
    const target = p.date || st.clock.date;
    if (target > st.clock.date) {
      const from = FD.addDays(st.simulatedThrough, 1);
      if (from <= FD.addDays(target, -1)) FD.simulatePilot(st, from, FD.addDays(target, -1));
    }
    st.clock = { date: target, time: p.time || st.clock.time };
    FD.applyOwnership(st, target);
    FD.ensureDay(st, target);
    if (target === FD.TODAY) FD.applyRealUntil(st, st.clock.time);
    FD.refreshMaturity(st);
    if (st.clock.time >= '19:00') for (const v of st.world.vsrs) {
      const n = st.recs.filter(r => r.date === target && FD.recVsr(r) === v.id && (r.outcome === 'NOT_SOLD' || r.outcome === 'NOT_OFFERED') && !r.reason && !r.exempted).length;
      const k = 'EOD|' + v.id + '|' + target;
      if (n && !st.notifSent[k]) { st.notifSent[k] = true; notify(st, v.id, 'N_EOD', { n }, { screen: 'todo' }); }
    }
    if (st.clock.time >= '21:30') settlePending(st, target);
  };
  R.SYNC_NEXT = st => { const h = parseInt(st.clock.time, 10) + 1; R.CLOCK_SET(st, { date: st.clock.date, time: h > 23 ? '23:59' : String(h).padStart(2, '0') + ':00' }); };
  R.DAY_CONFIRM = (st, p) => { st.dayConfirmed[p.vsr + '|' + (p.date || st.clock.date)] = true; };
  R.DAY_UNCONFIRM = (st, p) => { delete st.dayConfirmed[p.vsr + '|' + (p.date || st.clock.date)]; };
  R.REC_UNTICK = (st, p) => { const r = rec(st, p.recId); r.outcome = 'NOT_OFFERED'; r.untickedAt = st.clock.time; r.reason = p.reason || null; r.comment = p.comment || null; };
  R.REC_RETICK = (st, p) => { const r = rec(st, p.recId); r.outcome = null; r.untickedAt = null; r.reason = null; r.comment = null; };
  // the salesman asked the owner for more shelf space for this product: GOT or NO (null clears it)
  R.SHELF_ASK = (st, p) => { const r = rec(st, p.recId); r.shelfAsk = p.result || null; r.shelfAskAt = p.result ? now(st) : null; };
  R.REC_VIEW = (st, p) => { const r = rec(st, p.recId); if (r.stage === 'SENT') { r.stage = 'VIEWED'; r.viewedAt = st.clock.time; } };
  R.REC_QTY = (st, p) => { rec(st, p.recId).qtyModified = p.qty; };
  R.REC_NOT_OFFERED = (st, p) => { const r = rec(st, p.recId); r.outcome = 'NOT_OFFERED'; if (p.reason) R.REASON_SAVE(st, p); };
  R.REASON_SAVE = (st, p) => {
    const r = rec(st, p.recId); r.reason = p.reason; r.brand = p.brand || null; r.comment = p.comment || null; r.photo = p.photo || null; r.reasonAt = now(st);
    if (p.comment || p.photo) postMsg(st, { type: 'rec', id: r.id }, FD.recVsr(r), { text: p.comment || '', photo: p.photo || null, system: 'REASON', reason: p.reason });
  };
  R.ARRIVE = (st, p) => {
    FD.ensureDay(st, st.clock.date);
    const plan = FD.planFor(st, p.vsr, st.clock.date);
    const v = p.store ? (plan.stops.find(s => s.store === p.store && s.status === 'PLANNED') || plan.stops.find(s => s.store === p.store)) : plan.stops.find(s => s.status === 'PLANNED');
    if (!v) return;
    v.status = 'ARRIVED'; v.arrivedAt = st.clock.time; st.lastArrive = { vsr: p.vsr, store: v.store };
    const recs = plan.recs.filter(r => r.store === v.store && r.outcome === null).concat(FD.openTemps(st, v.store, st.clock.date, v.id));
    const target = { screen: 'store', store: v.store };
    if (recs.length === 1) { const s = FD.sku(recs[0].sku); notify(st, p.vsr, 'N_ARRIVE_ONE', { storeId: v.store, skuCode: recs[0].sku, qty: recs[0].qtyModified ?? recs[0].qty, unitOf: s.code }, target); }
    else if (recs.length > 1) notify(st, p.vsr, 'N_ARRIVE', { storeId: v.store, n: recs.length, skuCodes: recs.map(r => r.sku) }, target);
  };
  R.DEPART = (st, p) => { const v = visitOf(st, p.store, st.clock.date, p.visitId); if (v) { v.status = 'DONE'; v.leftAt = st.clock.time; } };
  R.STOP_SKIP = (st, p) => { const v = visitOf(st, p.store, st.clock.date, p.visitId); if (!v) return; v.status = 'SKIPPED'; v.skipReason = p.reason; v.skipComment = p.comment || null; };
  R.STOP_UNSKIP = (st, p) => { const v = visitOf(st, p.store, st.clock.date, p.visitId, 'SKIPPED'); if (!v) return; v.status = 'PLANNED'; v.skipReason = null; };
  // supervisor reorders today's plan: two stops swap places
  R.STOP_SWAP = (st, p) => { const a = st.visits.find(v => v.id === p.a), b = st.visits.find(v => v.id === p.b); if (!a || !b || FD.vanLocked(st, a.vsr, a.date)) return; [a.seq, b.seq] = [b.seq, a.seq]; if (a.seq === b.seq) b.seq += 0.5; };
  R.STOP_ORDER = (st, p) => { const vs = p.ids.map(id => st.visits.find(v => v.id === id)).filter(v => v && v.status === 'PLANNED' && !FD.vanLocked(st, v.vsr, v.date)); const seqs = vs.map(v => v.seq).sort((a, b) => a - b); vs.forEach((v, i) => { v.seq = seqs[i]; }); };
  R.STOP_MOVE = (st, p) => {
    const v = visitOf(st, p.store, st.clock.date, p.visitId); if (!v || FD.vanLocked(st, v.vsr, v.date)) return;
    const max = Math.max(...st.visits.filter(x => x.date === v.date && x.route === v.route).map(x => x.seq));
    v.seq = max + 1; v.moved = true; v.moveReason = p.reason;
  };
  R.SB_ORDER_DELAY = (st, p) => { st.delaySync = !!p.on; };
  R.SB_ORDER = (st, p) => {
    const d = st.clock.date; FD.ensureDay(st, d);
    const plan = FD.planFor(st, p.vsr, d);
    const v = plan.stops.find(s => s.store === p.store && s.status !== 'DONE' && s.status !== 'SKIPPED');
    if (!v || st.pendingOrders[p.store]) return; // one order per visit; a revisit is a new visit
    if (v.status === 'PLANNED') { v.status = 'ARRIVED'; v.arrivedAt = st.clock.time; }
    const store = storeById(st, p.store);
    const recs = recsFor(st, d, p.store).filter(r => !r.blockedAt && (r.outcome === null)).concat(FD.openTemps(st, p.store, d, v.id));
    const r = FD.rng(st.seed + hashKey(p.key || (p.store + st.clock.date + st.clock.time)));
    const lines = linesFor(st, r, store, d, recs, p.mode || 'RANDOM');
    if (st.delaySync) { st.pendingOrders[p.store] = { lines, time: st.clock.time, vsr: p.vsr, date: d, visitId: v.id, waiting: recs.map(x => ({ id: x.id, prev: x.outcome })) }; recs.forEach(x => { x.outcome = 'WAITING'; }); v.status = 'DONE'; v.leftAt = st.clock.time; return; }
    gradeNotify(st, applyLines(st, v, lines, d, st.clock.time), v);
  };
  R.SB_DELIVER_DELAYED = (st, p) => {
    const stores = p.store ? [p.store] : Object.keys(st.pendingOrders);
    for (const sid of stores) {
      const po = st.pendingOrders[sid]; if (!po) continue;
      const date = po.date || st.clock.date; const v = st.visits.find(x => x.id === po.visitId) || visitOf(st, sid, date);
      delete st.pendingOrders[sid]; restoreWaiting(st, po); if (!v) continue;
      gradeNotify(st, applyLines(st, v, po.lines, date, st.clock.time), v);
    }
  };
  R.SB_ORDER_EDIT = (st, p) => {
    const sid = p.store || (st.lastOrder && st.lastOrder.store); if (!sid) return;
    const date = p.store ? st.clock.date : st.lastOrder.date;
    const recs = recsFor(st, date, sid).filter(r => ['FULL', 'PARTIAL', 'ALT', 'NOT_SOLD'].includes(r.outcome));
    for (const r of recs) {
      const prev = r.outcome;
      const dayLines = FD.SKUS.flatMap(s => FD.storeOrders(st, sid, s.code).filter(o => o.date === date));
      if (prev === 'NOT_SOLD') st.orders.push({ id: nextId(st, 'O'), store: sid, vsr: r.vsr, date, sku: r.sku, units: r.qtyModified ?? r.qty, value: +((r.qtyModified ?? r.qty) * FD.sku(r.sku).cost).toFixed(2), src: 'SB', edited: true });
      else dayLines.filter(o => o.sku === (r.alt || r.sku)).forEach(o => { o.units = 0; o.value = 0; o.edited = true; });
      const after = FD.SKUS.flatMap(s => FD.storeOrders(st, sid, s.code).filter(o => o.date === date && o.units > 0));
      const g = FD.grade(r, after, knownSkus(st, sid, date).map(sku => ({ sku })));
      r.outcome = g.outcome; r.got = g.got; r.alt = g.alt; r.corrected = true; r.prevOutcome = prev;
      r.maturity = FD.SOLD.includes(g.outcome) ? 'PENDING' : null; FD.setExtra(r);
    }
  };
  R.RETURN_ADD = (st, p) => {
    const r = p.recId ? rec(st, p.recId) : st.recs.filter(x => x.maturity === 'PENDING').sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!r) return;
    const sku = r.alt || r.sku; const units = r.got || 1;
    st.returns.push({ id: nextId(st, 'RT'), store: r.store, sku, date: st.clock.date, saleDate: r.date, units, value: +(units * FD.sku(sku).cost).toFixed(2) });
    r.maturity = 'RETURNED';
  };
  R.EXEMPT = (st, p) => { const r = rec(st, p.recId); r.exempted = true; r.exemptNote = p.note || null; };
  R.UNEXEMPT = (st, p) => { const r = rec(st, p.recId); r.exempted = false; r.exemptNote = null; };
  const REGEN = fn => (st, p) => { fn(st, p); regenToday(st); };
  R.BLOCK_ADD = REGEN((st, p) => {
    const b = { id: nextId(st, 'B'), at: now(st) };
    if (p.recId) {
      const r = rec(st, p.recId); Object.assign(b, { recId: r.id, store: r.store, sku: r.sku, date: r.date }); r.blockedAt = now(st);
      if (r.date === st.clock.date && r.outcome === null) notify(st, FD.recVsr(r), 'N_REMOVED', { skuCode: r.sku, storeId: r.store }, { screen: 'store', store: r.store });
    } else Object.assign(b, { store: p.store || null, sku: p.sku || null });
    st.blocks.push(b); audit(st, 'AU_BLOCK', { storeId: b.store, skuCode: b.sku });
  });
  // blocks that apply at a store: whole store, product at this store, or product everywhere
  FD.blocksAt = (st, storeId) => { const bs = st.blocks.filter(b => !b.recId && (b.store === storeId || (!b.store && b.sku)));
    const skus = {}; for (const b of bs) if (b.sku && (!skus[b.sku] || b.store)) skus[b.sku] = b;
    return { store: bs.find(b => b.store === storeId && !b.sku) || null, skus, list: bs }; };
  FD.skuBlocks = (st, code) => st.blocks.filter(b => !b.recId && b.sku === code);
  R.BLOCK_REMOVE = REGEN((st, p) => {
    const b = st.blocks.find(x => x.id === p.blockId); if (!b) return;
    st.blocks = st.blocks.filter(x => x !== b);
    if (b.recId) { const r = rec(st, b.recId); if (r) r.blockedAt = null; }
    audit(st, 'AU_UNBLOCK', { storeId: b.store, skuCode: b.sku });
  });
  // pin.id is the scope target (store/tag/label/route id) read by the engine; pin.pinId identifies the pin itself
  R.PIN_ADD = REGEN((st, p) => { st.pins.push({ pinId: nextId(st, 'PN'), sku: p.sku, scope: p.scope || null, id: p.scope ? p.id : null, until: p.until || null, at: now(st) }); audit(st, 'AU_PIN', { skuCode: p.sku }); });
  R.PIN_REMOVE = REGEN((st, p) => { const x = st.pins.find(q => q.pinId === p.pinId); st.pins = st.pins.filter(q => q !== x); if (x) audit(st, 'AU_UNPIN', { skuCode: x.sku }); });
  R.COOLDOWN_OVERRIDE = REGEN((st, p) => { st.cooldownOverrides.push(p.store + '|' + p.sku); });
  // returns watchlist: a watched product is not recommended; it is reviewed after WATCH_DAYS (before vs since returns)
  FD.WATCH_DAYS = 14;
  R.WATCH_ADD = REGEN((st, p) => { if (!st.watchlist.includes(p.sku)) { st.watchlist.push(p.sku); st.watchMeta[p.sku] = { since: st.clock.date, review: FD.addDays(st.clock.date, FD.WATCH_DAYS) }; } audit(st, 'AU_WATCH', { skuCode: p.sku }); });
  R.WATCH_REMOVE = REGEN((st, p) => {
    const m = st.watchMeta[p.sku];
    if (m) { const w = FD.watchStats ? FD.watchStats(st, p.sku) : {}; st.watchHistory.push({ sku: p.sku, since: m.since, until: st.clock.date, before: w.before, after: w.after }); delete st.watchMeta[p.sku]; }
    st.watchlist = st.watchlist.filter(x => x !== p.sku); audit(st, 'AU_UNWATCH', { skuCode: p.sku });
  });
  const reE = st => st.reasonEdit = st.reasonEdit || { custom: {}, hidden: [], names: {} };
  R.REASON_ADD = (st, p) => { const e = reE(st); const id = 'RC_' + (Object.keys(e.custom).length + 1); e.custom[id] = { group: p.group, en: (p.en || '').trim(), ar: (p.ar || '').trim() }; audit(st, 'AU_REASON_ADD', {}); };
  R.REASON_RENAME = (st, p) => { const e = reE(st); const v = { en: (p.en || '').trim(), ar: (p.ar || '').trim() }; if (e.custom[p.id]) Object.assign(e.custom[p.id], v); else e.names = Object.assign(e.names || {}, { [p.id]: v }); audit(st, 'AU_REASON_EDIT', {}); };
  R.REASON_HIDE = (st, p) => { const e = reE(st); if (e.custom[p.id]) e.custom[p.id].deleted = !!p.hide; else if (p.hide) { if (!e.hidden.includes(p.id)) e.hidden.push(p.id); } else e.hidden = e.hidden.filter(x => x !== p.id); audit(st, p.hide ? 'AU_REASON_HIDE' : 'AU_REASON_SHOW', {}); };
  R.WATCH_KEEP = (st, p) => { const m = st.watchMeta[p.sku]; if (m) m.review = FD.addDays(st.clock.date, FD.WATCH_DAYS); audit(st, 'AU_WATCH_KEEP', { skuCode: p.sku }); };
  R.RULE_SET = REGEN((st, p) => { st.rules[p.rule] = p.value; audit(st, 'AU_RULE', { rule: p.rule, n: p.value }); });
  // reorder days by category (catGap / catWindow) or product exception (skuGap / skuWindow); value null removes an exception
  R.RULE_DAYS_SET = REGEN((st, p) => { if (!['catGap', 'catWindow', 'skuGap', 'skuWindow'].includes(p.rule)) return;
    const m = st.rules[p.rule] = Object.assign({}, st.rules[p.rule]); if (p.value == null) delete m[p.id]; else m[p.id] = p.value; audit(st, 'AU_RULE', { rule: p.rule, n: p.value || 0 }); });
  R.MUSTSTOCK_SET = REGEN((st, p) => {
    const list = st.rules.mustStock[p.group] = st.rules.mustStock[p.group] || [];
    if (p.on && !list.includes(p.sku)) list.push(p.sku);
    if (!p.on) st.rules.mustStock[p.group] = list.filter(x => x !== p.sku);
  });
  R.WEIGHTS_SET = (st, p) => { st.rules.weights = Object.assign({}, p.weights); if (p.off) st.rules.metricsOff = Object.assign({}, p.off); audit(st, 'AU_WEIGHTS', {}); };
  R.VISIBILITY_SET = (st, p) => { st.rules.vsrSees = Object.assign({}, st.rules.vsrSees, p.sees); audit(st, 'AU_WEIGHTS', {}); };
  R.MUSTSTOCK_RECALC = REGEN(st => { st.rules.mustStock = FD.computeMustStock(st.world, st.orders, st.clock.date); audit(st, 'AU_RULE', {}); });
  R.PHOTOS_ADD = (st, p) => { for (const ph of p.photos || []) st.photos.push({ id: nextId(st, 'PH'), store: p.store, vsr: p.vsr, date: st.clock.date, time: st.clock.time, src: ph }); };
  R.REVISIT_ADD = (st, p) => {
    let date = st.clock.date;
    if (p.when === 'next') date = FD.addDays(date, 1);
    while (!FD.isSellingDay(date)) date = FD.addDays(date, 1);
    if (st.planned[date]) { const s0 = storeById(st, p.store); const already = st.visits.find(v => v.date === date && v.store === p.store && v.status === 'PLANNED' && v.route === s0.route); if (already) { already.revisit = true; return; } }
    const last = FD.storeRecs(st, p.store).filter(r => FD.TEMP.includes(r.reason)).sort((a, b) => b.date.localeCompare(a.date))[0];
    const rv = { vsr: p.vsr, store: p.store, date, reason: last ? last.reason : null, at: now(st) };
    st.planChanges.push(rv);
    if (st.planned[date]) addRevisit(st, rv); else st.revisitQueue.push(rv);
  };
  // salesman adds a store that is not on today's plan (tracked as an off-plan visit)
  // ---------- supervisor edits today's plan (the salesman is told; edits stay through regeneration) ----------
  // a closed van's day is final for the supervisor: plan edits for that van and date do nothing
  FD.vanLocked = (st, van, date) => !!(st.vanClosed || {})[van + '|' + (date || st.clock.date)];
  // closed in the app and SalesBuzz has not sent that day yet (it arrives with the 02:00 load); with live data there is nothing to wait for
  FD.waitingData = (st, van, date) => { const d = date || st.clock.date; return FD.vanLocked(st, van, d) && !(st.rules && st.rules.liveData) && (d === st.clock.date || (d === FD.addDays(st.clock.date, -1) && st.clock.time < '02:00')); };
  const recLocked = (st, r) => FD.vanLocked(st, FD.recVsr(r), r.date);
  const planNote = (st, vsr, store) => notify(st, vsr, 'N_PLAN_SUP', { supId: 'S1', storeId: store }, { screen: 'store', store });
  const openRec = (st, id) => { const r = rec(st, id); return r && r.date === st.clock.date && r.outcome === null ? r : null; };
  const supDraft = (st, store, sku, qty) => { const pr = FD.activePromo ? FD.activePromo(st, sku, st.clock.date) : null; const k = FD.sku(sku); return { store, sku, type: 'SUP', qty, reasonId: 'B_SUP', slots: {}, promo: pr ? pr.id : null, pinned: false, ev: +(qty * k.cost).toFixed(2), value: +(qty * k.cost).toFixed(2) }; };
  R.SUP_REC_EDIT = (st, p) => { const r = openRec(st, p.recId); if (!r || recLocked(st, r)) return;
    r.supEdited = { at: now(st), prev: { sku: r.sku, qty: r.qtyModified ?? r.qty } };
    if (p.sku && p.sku !== r.sku) Object.assign(r, supDraft(st, r.store, p.sku, p.qty || r.qty), { qtyModified: null });
    if (p.qty != null) r.qtyModified = p.qty;
    FD.invalidate(st); planNote(st, FD.recVsr(r), r.store); };
  R.SUP_REC_ADD = (st, p) => { const d = st.clock.date; const v = st.visits.find(x => x.date === d && x.store === p.store && (x.status === 'PLANNED' || x.status === 'ARRIVED')); if (!v || FD.vanLocked(st, v.vsr, d)) return;
    if (recsFor(st, d, p.store).some(r => r.sku === p.sku && !r.blockedAt)) return;
    const r = makeRec(st, supDraft(st, p.store, p.sku, p.qty), v.vsr, d); r.supEdited = { at: now(st), prev: null }; const c = coverFor(st, d, v.route); if (c) r.coveredBy = c.vsr;
    st.recs.push(r); FD.invalidate(st); planNote(st, FD.recVsr(r), p.store); };
  R.SUP_REC_REMOVE = (st, p) => { const r = openRec(st, p.recId); if (!r || recLocked(st, r)) return; r.blockedAt = now(st); r.supRemoved = true; FD.invalidate(st); notify(st, FD.recVsr(r), 'N_REMOVED', { skuCode: r.sku, storeId: r.store }, { screen: 'store', store: r.store }); };
  R.SUP_REC_RESTORE = (st, p) => { const r = rec(st, p.recId); if (!r || !r.supRemoved || r.date !== st.clock.date || recLocked(st, r)) return; if (recsFor(st, r.date, r.store).some(x => x.id !== r.id && x.sku === r.sku && !x.blockedAt)) return; r.blockedAt = null; r.supRemoved = false; FD.invalidate(st); planNote(st, FD.recVsr(r), r.store); };
  R.SUP_STOP_REMOVE = (st, p) => { const v = st.visits.find(x => x.date === (p.date || st.clock.date) && x.store === p.store && x.status === 'PLANNED'); if (!v || FD.vanLocked(st, v.vsr, v.date)) return;
    v.status = 'SKIPPED'; v.skipReason = 'SK_SUP'; v.bySup = true; st.planChanges.push({ vsr: v.vsr, store: v.store, date: v.date, reason: 'SK_SUP', at: now(st), bySup: true }); planNote(st, v.vsr, v.store); };
  R.SUP_STOP_RESTORE = (st, p) => { const v = st.visits.find(x => x.date === (p.date || st.clock.date) && x.store === p.store && x.status === 'SKIPPED' && x.bySup); if (!v || FD.vanLocked(st, v.vsr, v.date)) return; if (st.visits.some(x => x !== v && x.date === v.date && x.store === v.store && (x.status === 'PLANNED' || x.status === 'ARRIVED'))) return; v.status = 'PLANNED'; v.skipReason = null; v.bySup = false; planNote(st, v.vsr, v.store); };
  // undo a supervisor-added stop that has not been visited: the plan goes back to how it was
  R.SUP_STOP_UNADD = (st, p) => { const d = p.date || st.clock.date; const i = st.visits.findIndex(v => v.date === d && v.store === p.store && v.supAdded && v.status === 'PLANNED'); if (i < 0 || FD.vanLocked(st, st.visits[i].vsr, d)) return;
    const v = st.visits[i]; st.visits.splice(i, 1); st.recs = st.recs.filter(r => !(r.store === p.store && r.date === d && r.outcome == null && r.stage === 'SENT'));
    const c = st.planChanges.findIndex(x => x.store === p.store && x.date === d && x.reason === 'SK_SUP_ADDED'); if (c >= 0) st.planChanges.splice(c, 1); planNote(st, v.vsr, v.store); };
  R.OFFPLAN_ADD = (st, p) => {
    const d = p.date || st.clock.date; if (!FD.isSellingDay(d) || FD.vanLocked(st, p.vsr, d)) return; FD.ensureDay(st, d);
    if (st.visits.some(v => v.date === d && v.store === p.store && (v.status === 'PLANNED' || v.status === 'ARRIVED'))) return;
    const removed = st.visits.find(v => v.date === d && v.store === p.store && v.status === 'SKIPPED' && v.bySup); if (removed) return R.SUP_STOP_RESTORE(st, { store: p.store, date: d });
    const s = storeById(st, p.store); const route = st.world.routes.find(r => FD.routeOwner(st, r.id, d) === p.vsr) || st.world.routes.find(r => r.id === s.route);
    const seq = Math.max(0, ...st.visits.filter(v => v.date === d && v.route === route.id).map(v => v.seq)) + 1;
    st.visits.push({ id: nextId(st, 'VI'), store: s.id, vsr: p.vsr, route: route.id, date: d, seq, status: 'PLANNED', arrivedAt: null, leftAt: null, skipReason: null, moved: false, offPlan: !p.bySup, supAdded: !!p.bySup }); // a stop the supervisor adds is part of the plan
    if (!recsFor(st, d, s.id).length) genRecs(st, s, d, p.vsr, FD.openTemps(st, s.id, d).map(r => r.sku));
    { const c = coverFor(st, d, route.id); if (c) recsFor(st, d, s.id).forEach(r => { r.coveredBy = c.vsr; }); }
    st.planChanges.push({ vsr: p.vsr, store: s.id, date: d, reason: p.bySup ? 'SK_SUP_ADDED' : 'SK_OFFPLAN', at: now(st), bySup: !!p.bySup });
    if (p.bySup) planNote(st, p.vsr, s.id);
  };
  // both changes take effect on the first day they can (tomorrow, or after the days already simulated); s.vsr switches then, past sales stay with the old owner
  const effective = st => { let from = FD.addDays(st.clock.date, 1); if (st.simulatedThrough && from <= st.simulatedThrough) from = FD.addDays(st.simulatedThrough, 1); return from; };
  R.STORE_ASSIGN = (st, p) => {
    const s = storeById(st, p.store); const to = st.world.vsrs.find(v => v.id === p.vsr); const from = FD.addDays(st.clock.date, 1);
    const route = st.world.routes.find(r => FD.routeOwner(st, r.id, from) === to.id) || st.world.routes.find(r => r.id === to.route);
    s.pend = { vsr: to.id, route: route.id, from }; // plans already made keep their stops; the store moves on `from`
    st.sbPending = st.sbPending.filter(x => x.store !== s.id); st.sbPending.push({ kind: 'store', store: s.id, vsr: to.id, at: now(st) }); audit(st, 'AU_ASSIGN', { storeId: s.id, vsrId: to.id });
  };
  // who takes which route, and from when (swap so every route keeps one owner)
  FD.routeSwapPreview = (st, route, vsrId) => {
    const from = effective(st); const prev = FD.routeOwner(st, route, from); if (prev === vsrId) return { from, moves: [] };
    const moves = [{ vsr: vsrId, route, prevVsr: prev }];
    const theirs = st.world.routes.find(r => FD.routeOwner(st, r.id, from) === vsrId);
    if (theirs && prev && theirs.id !== route) moves.push({ vsr: prev, route: theirs.id, prevVsr: vsrId });
    return { from, moves };
  };
  R.ROUTE_ASSIGN = (st, p) => {
    const pv = FD.routeSwapPreview(st, p.route, p.vsr); if (!pv.moves.length) return;
    for (const m of pv.moves) st.routeAssign.push({ route: m.route, vsr: m.vsr, from: pv.from });
    st.sbPending.push({ kind: 'route', route: p.route, vsr: p.vsr, at: now(st) }); audit(st, 'AU_ASSIGN', { vsrId: p.vsr });
  };
  R.ALERT_RESOLVE = (st, p) => { st.alertDone = st.alertDone || {}; for (const k of p.keys) { if (p.undo) delete st.alertDone[k]; else st.alertDone[k] = p.how || 'RESOLVED'; } };
  R.LIVE_SET = (st, p) => { st.rules.liveNotifs = !!p.on; };
  R.LIVEDATA_SET = (st, p) => { st.rules.liveData = !!p.on; audit(st, 'AU_DATA_MODE', {}); };
  R.VANFEED_SET = REGEN((st, p) => { st.rules.vanFeed = !!p.on; audit(st, 'AU_VANFEED', {}); });
  R.STORE_EDIT = REGEN((st, p) => { Object.assign(storeById(st, p.store), p.patch); FD.invalidate(st); audit(st, 'AU_STORE', { storeId: p.store }); });
  R.CORRECTION_ADD = (st, p) => { st.corrections.push({ id: nextId(st, 'CR'), vsr: p.vsr, store: p.store, kind: p.kind, value: p.value == null ? null : p.value, comment: p.comment || '', status: 'PENDING', at: now(st) }); };
  // a store closed for good: out of future plans, recommendations and the active-store count; its history stays
  function closeStore(st, s) {
    s.closed = st.clock.date; const today = st.clock.date;
    st.visits = st.visits.filter(v => !(v.store === s.id && v.date >= today && v.status === 'PLANNED' && !v.real));
    st.recs = st.recs.filter(r => !(r.store === s.id && r.date >= today && r.outcome === null));
    st.revisitQueue = (st.revisitQueue || []).filter(x => x.store !== s.id);
    FD.invalidate(st);
  }
  R.CORRECTION_DECIDE = (st, p) => {
    const c = st.corrections.find(x => x.id === p.id); if (!c) return; const was = c.status; c.status = p.accept ? 'ACCEPTED' : 'REJECTED'; c.decidedAt = now(st); c.seen = false;
    const s = storeById(st, c.store); if (!p.accept || was !== 'PENDING' || !s) return;
    if (c.kind === 'CORR_SIZE' && FD.SIZES.includes(c.value)) s.size = c.value;
    else if (c.kind === 'CORR_SHELF' && ['low', 'med', 'high'].includes(c.value)) s.shelf = c.value;
    else if (c.kind === 'CORR_PROFILE' && (!FD.PROFILES || FD.PROFILES.includes(c.value))) s.profile = c.value;
    else if (c.kind === 'CORR_TAG' && FD.TAGS.includes(c.value) && !(s.tags || []).includes(c.value)) s.tags = (s.tags || []).concat(c.value);
    else if (c.kind === 'CORR_CLOSED') closeStore(st, s);
    else if (c.kind === 'CORR_MOVED') s.relocate = true;
  };
  R.CORRECTION_SEEN = (st, p) => { const c = st.corrections.find(x => x.id === p.id); if (c) c.seen = true; };
  R.TIP_SEND = (st, p) => {
    const t = { id: nextId(st, 'TP'), vsr: p.vsr, tpl: p.tpl, slots: p.slots || {}, text: p.text || null, status: 'SENT', sentAt: now(st), read: false, draftKey: p.draftKey || null };
    st.tips.push(t); if (p.draftKey) st.tipDone[p.draftKey] = true;
    postMsg(st, { type: 'vsr', id: p.vsr }, 'SUP', { text: null, tip: t.id, store: (p.slots || {}).storeId || null, sku: (p.slots || {}).skuCode || null }); // the tip is a card in his chat
    notify(st, p.vsr, 'N_TIP', { tipTpl: p.tpl }, { screen: 'tip', tip: t.id });
  };
  R.TIP_DISMISS = (st, p) => { st.tipDone[p.draftKey] = true; };
  R.TIP_READ = (st, p) => { const t = st.tips.find(x => x.id === p.id); if (t) t.read = true; };
  R.TIP_ACK = (st, p) => { const t = st.tips.find(x => x.id === p.id); if (t) { t.read = true; t.ack = t.ack || now(st); } };
  // one conversation per salesman + one team group; store / product / recommendation travel as tags on the message
  function postMsg(st, anchor, by, msg) {
    let vsr = null, tag = { store: msg.store || null, sku: msg.sku || null, rec: msg.rec || null };
    if (anchor.type === 'rec') { const r = rec(st, anchor.id); if (!r) return { messages: [] }; vsr = FD.recVsr(r); Object.assign(tag, { store: r.store, sku: r.sku, rec: r.id }); }
    else if (anchor.type === 'store') { const x = storeById(st, anchor.id); if (!x) return { messages: [] }; vsr = FD.routeOwner(st, x.route, st.clock.date) || x.vsr; tag.store = x.id; }
    else if (anchor.type === 'fu') vsr = msg.vsr;
    else if (anchor.type === 'vsr') vsr = anchor.id;
    const team = anchor.type === 'team'; if (!team && !vsr) return { messages: [] };
    const key = team ? { type: 'team', id: 'ALL' } : { type: 'vsr', id: vsr };
    let th = st.threads.find(t => t.anchor.type === key.type && t.anchor.id === key.id);
    if (!th) { th = { id: nextId(st, 'TH'), anchor: key, store: null, vsr: team ? null : vsr, messages: [], unreadSup: false, unreadVsr: false, team, unreadVsrs: {}, seenVsrs: {} }; st.threads.push(th); }
    const at = msg.at || now(st); const seen = at.date + ' ' + at.time;
    const m = { id: nextId(st, 'MS'), by, at, text: msg.text, photo: msg.photo || null, files: msg.files || [], replyTo: msg.replyTo || null, qr: msg.qr || null, topic: msg.topic || null, system: msg.system || null, reason: msg.reason || null,
      store: team ? null : tag.store, sku: team ? null : tag.sku, rec: team ? null : tag.rec, tip: msg.tip || null };
    th.messages.push(m);
    if (th.team) { th.unreadVsrs = th.unreadVsrs || {}; th.seenVsrs = th.seenVsrs || {}; for (const v of st.world.vsrs) if (v.id !== by) th.unreadVsrs[v.id] = true; if (by !== 'SUP') { th.unreadSup = true; th.seenVsrs[by] = seen; } else th.seenSup = seen; }
    else if (by === 'SUP') { th.unreadVsr = true; th.unreadSup = false; th.seenSup = seen; } else { th.unreadSup = true; th.seenVsr = seen; }
    th.last = m; return th;
  }
  FD.recMsgs = (st, recId) => st.threads.filter(x => !x.team).flatMap(x => x.messages.filter(m => m.rec === recId));
  R.MSG_SEND = (st, p) => {
    const th = postMsg(st, p.anchor, p.by, p); if (!th.id) return; // anchor no longer exists
    if (p.by !== 'SUP') return; const m = th.last; const target = { screen: 'thread', thread: th.id };
    if (th.team) st.world.vsrs.forEach(v => notify(st, v.id, 'N_MSG', { supId: 'S1', snippet: (p.text || '').slice(0, 60) }, target));
    else if (m.rec && m.sku) notify(st, th.vsr, 'N_REPLY', { skuCode: m.sku, storeId: m.store }, target);
    else if (m.store) notify(st, th.vsr, 'N_REPLY_STORE', { storeId: m.store }, target);
    else notify(st, th.vsr, 'N_MSG', { supId: 'S1', snippet: (p.text || '').slice(0, 60) }, target);
  };
  R.THREAD_READ = (st, p) => { const th = st.threads.find(t => t.id === p.thread); if (!th) return; const at = now(st); const seen = at.date + ' ' + at.time;
    if (p.who === 'SUP') { th.unreadSup = false; th.seenSup = seen; }
    else if (th.team) { const v = p.vsr || st.vsrId; th.unreadVsrs = th.unreadVsrs || {}; th.seenVsrs = th.seenVsrs || {}; th.unreadVsrs[v] = false; th.seenVsrs[v] = seen; }
    else { th.unreadVsr = false; th.seenVsr = seen; } };
  // follow-up history keeps what the item said and what was done, so the Done tab can show it after the rule stops firing
  const fuLog = (st, p, how) => st.fuHistory.push({ key: p.fu, how, at: now(st), snap: p.snap || null });
  R.FOLLOWUP_DONE = (st, p) => { st.followupDone[p.fu] = { at: now(st), how: p.how || 'DONE', snap: p.snap || null }; fuLog(st, p, p.how || 'DONE'); };
  R.FOLLOWUP_DISMISS = (st, p) => { st.followupDone[p.fu] = { at: now(st), how: p.why || 'FU_HANDLED', snap: p.snap || null }; fuLog(st, p, p.why || 'FU_HANDLED'); };
  R.FOLLOWUP_UNDO = (st, p) => { delete st.followupDone[p.fu]; delete st.followupSnooze[p.fu]; fuLog(st, p, 'FU_UNDO'); };
  // a snoozed item is not "done": it comes back tomorrow, or when restored from the snoozed list
  R.FOLLOWUP_SNOOZE = (st, p) => { st.followupSnooze[p.fu] = FD.addDays(st.clock.date, 1); (st.followupSnap = st.followupSnap || {})[p.fu] = p.snap || null; };
  R.FOLLOWUP_UNSNOOZE = (st, p) => { delete st.followupSnooze[p.key]; if (st.followupSnap) delete st.followupSnap[p.key]; };
  R.FOLLOWUP_NOTE = (st, p) => fuLog(st, p, p.how);
  R.MISS_MARK = (st, p) => { const m = st.misses.find(x => x.id === p.id); if (m) m.mark = p.mark; };
  R.NOTIF_READ = (st, p) => { const n = st.notifs.find(x => x.id === p.id); if (n) n.read = true; };
  R.NOTIFS_READ_ALL = (st, p) => { st.notifs.forEach(n => { if (n.vsr === p.vsr) n.read = true; }); };
  R.OFFLINE_SET = (st, p) => {
    st.offline = !!p.on;
    if (!p.on && st.queue.length) { const n = st.queue.length; st.queue = []; toast('S_SYNCED', { n }); }
  };
  R.COVER_SET = (st, p) => {
    const date = p.date || st.clock.date;
    st.covers = st.covers.filter(c => !(c.date === date && c.route === p.route));
    if (p.vsr) st.covers.push({ date, route: p.route, vsr: p.vsr });
    const vr = new Map(st.visits.filter(v => v.date === date).map(v => [v.store, v.route]));
    st.recs.filter(r => r.date === date && vr.get(r.store) === p.route).forEach(r => { r.coveredBy = p.vsr || null; });
  };

  // ---------- control room (R7): release, close, move stops, pre-orders ----------
  const nextSellingDay = iso => { let d = FD.addDays(iso, 1); while (!FD.isSellingDay(d)) d = FD.addDays(d, 1); return d; };
  // the store's next planned visit day within a week, from `from` (inclusive); null when none
  const nextPlanned = (st, store, from) => { const s = storeById(st, store); for (let i = 0; i < 7; i++) { const x = FD.addDays(from, i); if (FD.isSellingDay(x) && (FD.realPlan(x).some(q => q.store === store) || (!FD.realPlan(x).length && s.days.includes(FD.dow(x))))) return x; } return null; };
  R.VAN_RELEASE = (st, p) => { const d = p.date || st.clock.date; const k = p.van + '|' + d; if (st.released[k]) return; st.released[k] = now(st); notify(st, p.van, 'N_RELEASED', {}, { screen: 'today' }); audit(st, 'AU_RELEASE', { vsrId: p.van }); };
  R.VAN_RELEASE_ALL = (st, p) => { const d = p.date || st.clock.date; for (const v of st.world.vsrs) if ((!p.vans || p.vans.includes(v.id)) && FD.stageFor(st, v.id, d) === 'PLAN_READY') R.VAN_RELEASE(st, { van: v.id, date: d }); };
  R.VAN_CLOSE = (st, p) => { const d = p.date || st.clock.date; st.vanClosed[p.van + '|' + d] = now(st); audit(st, 'AU_CLOSE_VAN', { vsrId: p.van }); };
  R.VAN_REOPEN = (st, p) => { delete st.vanClosed[p.van + '|' + (p.date || st.clock.date)]; };
  R.DAY_CLOSE = (st, p) => {
    const d = p.date || st.clock.date; if (st.dayClosed[d]) return; st.dayClosed[d] = now(st);
    const next = nextSellingDay(d);
    for (const x of st.preorders) {
      if (x.status === 'DONE' || (x.forDate && x.forDate > d)) continue;
      if (x.forDate && st.visits.some(v => v.date === x.forDate && v.store === x.store && v.status === 'DONE')) { x.status = 'DONE'; continue; } // delivered on that visit
      x.forDate = nextPlanned(st, x.store, next);
    }
    audit(st, 'AU_CLOSE_DAY', {});
  };
  // supervisor moves one of today's stops to another van (not the same as STOP_MOVE, which reorders within a route)
  R.STOP_REASSIGN = (st, p) => {
    const v = st.visits.find(x => x.id === p.visitId); const to = st.world.vsrs.find(x => x.id === p.toVan); if (!v || !to || v.status !== 'PLANNED' || to.kind === 'inactive' || FD.vanLocked(st, v.vsr, v.date) || FD.vanLocked(st, to.id, v.date)) return;
    if (st.visits.some(x => x !== v && x.date === v.date && x.store === v.store && x.vsr === to.id && x.status !== 'SKIPPED')) return; // already on that van's plan
    const from = v.vsr; v.vsr = to.id; v.route = to.route; v.seq = Math.max(0, ...st.visits.filter(x => x.date === v.date && x.route === to.route).map(x => x.seq)) + 1; v.reassigned = { from, at: now(st) };
    st.recs.filter(r => r.date === v.date && r.store === v.store && r.vsr === from && r.outcome === null).forEach(r => { r.vsr = to.id; r.coveredBy = null; });
    FD.invalidate(st);
    st.planChanges.push({ vsr: to.id, store: v.store, date: v.date, reason: 'SK_SUP_ADDED', at: now(st), bySup: true });
    planNote(st, to.id, v.store); notify(st, from, 'N_REMOVED_STOP', { storeId: v.store }, { screen: 'today' });
  };
  R.LOAD_CONFIRM = (st, p) => R.DAY_CONFIRM(st, p);
  // store owner WhatsApp: the supervisor or salesman sends a card, a promotion or a note; owners send pre-orders, shelf photos, notes and card replies
  const OWNER_OUT = ['PROMO', 'TEXT', 'CARD'];
  FD.ownerThread = (st, store) => (st.ownerMsgs || []).filter(m => m.store === store);
  // owner messages plus card replies; read state is this count, so a message stamped with the same clock minute still shows as new
  FD.ownerEvents = (st, store) => FD.ownerThread(st, store).reduce((n, m) => n + (m.by === 'OWNER' ? 1 : 0) + (m.reply ? 1 : 0), 0);
  R.OWNER_MSG_SEND = (st, p) => {
    if (!OWNER_OUT.includes(p.kind)) throw new Error('Not an outbound store message: ' + p.kind);
    if (p.kind === 'CARD' && FD.WA_CARDS && !FD.WA_CARDS[p.card]) return; // a card type that was removed (saved demo history) is dropped
    // by: 'SUP' or the salesman's id; sign: the name the owner sees under a written reply
    const m = { id: nextId(st, 'WM'), store: p.store, by: p.by || 'SUP', kind: p.kind, at: p.at || now(st), text: p.text || null, promo: p.kind === 'PROMO' ? p.ref : null, sign: p.sign || null,
      card: p.kind === 'CARD' ? p.card : null, slots: p.kind === 'CARD' ? (p.slots || {}) : null, photo: p.photo || null, reply: null };
    (st.ownerMsgs = st.ownerMsgs || []).push(m);
  };
  R.OWNER_MSG_IN = (st, p) => { (st.ownerMsgs = st.ownerMsgs || []).push({ id: nextId(st, 'WM'), store: p.store, by: 'OWNER', kind: p.kind || 'TEXT', at: p.at || now(st), text: p.text || null, photo: p.photo || null }); };
  R.OWNER_READ = (st, p) => { (st.ownerSeen = st.ownerSeen || {})[p.who + '|' + p.store] = FD.ownerEvents(st, p.store); };
  // the owner tapped a card button; 'See or change items' on a visit notice becomes a pre-order for that visit
  R.WA_REPLY = (st, p) => { const m = (st.ownerMsgs || []).find(x => x.id === p.msg); if (!m || m.kind !== 'CARD' || m.reply) return;
    m.reply = { choice: p.choice, sub: p.sub || null, at: p.at || now(st) };
    if (m.card === 'VISIT' && p.choice === 'W_R_CHANGE') st.preorders.push({ id: nextId(st, 'PO'), store: m.store, text: '', photo: null, at: m.reply.at, status: 'NEW', forDate: m.slots.date, via: 'WHATSAPP' }); };
  R.PREORDER_ADD = (st, p) => {
    const d = st.clock.date; const vis = st.visits.find(v => v.date === d && v.store === p.store && (v.status === 'PLANNED' || v.status === 'ARRIVED'));
    const forDate = vis ? d : nextPlanned(st, p.store, FD.addDays(d, 1));
    st.preorders.push({ id: nextId(st, 'PO'), store: p.store, text: p.text || '', photo: p.photo || null, at: p.at || now(st), status: 'NEW', forDate, via: 'WHATSAPP' });
    R.OWNER_MSG_IN(st, { store: p.store, kind: 'PREORDER', text: p.text || '', photo: p.photo || null, at: p.at });
  };
  R.PREORDER_STATUS = (st, p) => { const x = st.preorders.find(q => q.id === p.id); if (x) { x.status = p.status; if (p.forDate) x.forDate = p.forDate; } };
  R.FREQ_ACCEPT = (st, p) => { st.freqChanges.push({ store: p.store, freq: p.freq, at: now(st) }); st.sbPending.push({ kind: 'freq', store: p.store, freq: p.freq, at: now(st) }); audit(st, 'AU_FREQ', { storeId: p.store }); };

  // ---------- dispatch, persistence, sync ----------
  const QUEUEABLE = ['LOAD_CONFIRM', 'REASON_SAVE', 'REC_NOT_OFFERED', 'REC_QTY', 'MSG_SEND', 'STOP_SKIP', 'STOP_MOVE', 'DAY_CONFIRM', 'REC_UNTICK', 'REC_RETICK', 'CORRECTION_ADD'];
  const LOCAL = ['SET_LANG', 'SET_ROLE', 'SET_VSR', 'SET_DIGITS', 'SET_TEXT_SIZE', 'SET_THEME', 'TOUR_SEEN', 'TOUR_RESET'];
  function apply(st, type, payload, ev) {
    if (st.offline && QUEUEABLE.includes(type) && !payload._remote) { st.queue.push(ev); ev.queued = true; }
    R[type](st, payload);
    if (!LOCAL.includes(type)) st.dv = (st.dv || 0) + 1; // data version: UI-only events don't invalidate metric caches
    if (payload.key) st.keys[payload.key] = true;
    st.log.push(ev);
  }
  FD.dispatch = function (type, payload = {}) {
    const st = FD.state;
    if (!R[type]) throw new Error('Unknown event ' + type);
    if (payload.key && st.keys[payload.key]) return;
    const ev = { type, key: payload.key, payload, at: st.clock.date + ' ' + st.clock.time };
    apply(st, type, payload, ev);
    persist();
    if (chan && !payload._remote && !LOCAL.includes(type)) { try { chan.postMessage({ type, payload: Object.assign({}, payload, { _remote: true }) }); } catch (e) { } }
    changed();
  };
  FD.pending = key => FD.state.queue.some(e => e.payload && (e.payload.recId === key || e.payload.key === key));
  let persistTimer = null, warned = false;
  function write() { persistTimer = null; if (!storage) return false; const ok = storage.set(JSON.stringify({ v: 1, seed: FD.state.seed, log: FD.state.log })); if (!ok && !warned) { warned = true; toast('S_STORAGE', {}); } return ok; }
  // browser: debounce so a burst of taps writes once; node tests: write immediately
  function persist() { if (typeof window === 'undefined') return write(); clearTimeout(persistTimer); persistTimer = setTimeout(write, 250); }
  FD.flushPersistence = () => { clearTimeout(persistTimer); return write(); };
  // Check the durable log before admitting image bytes to canonical state.
  // A rejected batch must not make every later ordinary event exceed quota.
  const tryDurable = (type, payload) => {
    const st=FD.state;
    if(payload.key&&st.keys[payload.key])return true;
    const ev={type,key:payload.key,payload,at:st.clock.date+' '+st.clock.time};
    let ok=false;
    try { ok=!!storage&&storage.set(JSON.stringify({v:1,seed:st.seed,log:st.log.concat(ev)})); } catch(e) { ok=false; }
    if(!ok)return false;
    FD.dispatch(type,payload);
    return true;
  };
  FD.tryPhotoBatch = (payload = {}) => !!FD.pgAssessment(FD.state,payload.id) && tryDurable('PG_PHOTOS_ADD',payload);
  FD.tryCompPhoto = (payload = {}) => tryDurable('COMP_PHOTO_ADD',payload);
  FD.init = function (seed = 7, opts = {}) {
    if (FD.resetBaseState) FD.resetBaseState(); // the baseline state is rebuilt against the new world
    storage = FD.storageAdapter(opts.storage !== undefined ? opts.storage : (typeof localStorage !== 'undefined' ? localStorage : null));
    let saved = null; try { saved = JSON.parse(storage.get()); } catch (e) { saved = null; }
    FD.state = fresh(seed);
    if (saved && saved.v === 1 && saved.seed === seed && Array.isArray(saved.log)) {
      replaying = true;
      for (const ev of saved.log) { try { if (R[ev.type]) apply(FD.state, ev.type, ev.payload || {}, ev); } catch (e) { /* skip a bad event, keep the rest */ } }
      replaying = false;
    }
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' && !chan) {
      try { chan = new BroadcastChannel('fielddrive'); chan.onmessage = e => { try { if (e.data.type === '__RESET') FD.reset(true); else FD.dispatch(e.data.type, e.data.payload); } catch (err) { } }; } catch (e) { chan = null; }
    }
  };
  // demo: drop the dismiss / resolve events and replay, so tested-away items come back; everything else stays
  FD.undismiss = function () { const seed = FD.state.seed, gone = ['ALERT_RESOLVE', 'FOLLOWUP_DISMISS', 'TIP_DISMISS', 'SUP_REC_REMOVE', 'SC_DISMISS', 'REASON_HIDE'];
    const log = FD.state.log.filter(ev => !gone.includes(ev.type)), n = FD.state.log.length - log.length;
    try { storage.set(JSON.stringify({ v: 1, seed, log })); } catch (e) { return 0; }
    FD.init(seed); changed(); return n; };
  FD.reset = function (fromRemote) { const seed = FD.state.seed; if (storage) storage.clear(); FD.state = fresh(seed); if (chan && !fromRemote) { try { chan.postMessage({ type: '__RESET' }); } catch (e) { } } changed(); };
})();
