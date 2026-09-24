(function () {
  const FD = globalThis.FD;
  const KEY = 'fielddrive.v2'; // v2: one chat thread per salesman (v1 logs would replay with shifted ids)
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
    const { recs } = FD.recommend(st, store.id, date, vsr);
    recs.filter(r => !exclude.includes(r.sku)).slice(0, limit ?? st.rules.maxPerStore).forEach(d => st.recs.push(makeRec(st, d, vsr, date)));
  }
  FD.ensureDay = function (st, iso) {
    if (st.planned[iso]) return;
    st.planned[iso] = true;
    if (!FD.isSellingDay(iso)) return;
    const dw = FD.dow(iso);
    for (const rt of st.world.routes) {
      const vid = FD.routeOwner(st, rt.id, iso);
      st.world.stores.filter(s => s.route === rt.id && s.days.includes(dw)).forEach((s, i) => {
        st.visits.push({ id: nextId(st, 'VI'), store: s.id, vsr: vid, route: s.route, date: iso, seq: i + 1, status: 'PLANNED', arrivedAt: null, leftAt: null, skipReason: null, moved: false });
        genRecs(st, s, iso, vid, FD.openTemps(st, s.id, iso).map(r => r.sku));
      });
    }
    for (const rv of (st.revisitQueue || []).filter(x => x.date === iso)) addRevisit(st, rv);
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
    const stops = st.visits.filter(v => v.date === iso && routes.has(v.route)).sort((a, b) => a.seq - b.seq);
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
  function applyLines(st, visit, lines, date, time) {
    const store = visit.store; const known = knownSkus(st, store, date);
    const recs = recsFor(st, date, store).filter(r => !r.blockedAt && (r.outcome === null || r.outcome === 'WAITING'));
    const temps = FD.openTemps(st, store, date, visit.id);
    for (const l of lines) st.orders.push({ id: nextId(st, 'O'), store, vsr: visit.vsr, date, sku: l.sku, units: l.units, value: +(l.units * FD.sku(l.sku).cost).toFixed(2), src: 'SB' });
    const hist = known.map(sku => ({ sku }));
    const graded = [];
    for (const r of recs) {
      const g = FD.grade(r, lines, hist);
      r.outcome = g.outcome; r.got = g.got; r.alt = g.alt; r.gradedAt = time; r.gradedVisit = visit.id;
      r.maturity = FD.SOLD.includes(g.outcome) ? 'PENDING' : null;
      graded.push(r);
    }
    for (const r of temps) {
      const g = FD.grade(r, lines, hist);
      if (FD.SOLD.includes(g.outcome)) { Object.assign(r, { firstReason: r.reason, outcome: g.outcome, got: g.got, alt: g.alt, revisit: true, soldOn: date, gradedAt: time, gradedVisit: visit.id, maturity: 'PENDING' }); graded.push(r); }
      else r.revisitClosed = true; // offered again on the next visit and still not taken
    }
    const recSkus = new Set(recs.concat(temps).map(r => r.sku)), altSkus = new Set(recs.concat(temps).filter(r => r.alt).map(r => r.alt));
    for (const l of lines) if (!known.includes(l.sku) && !recSkus.has(l.sku) && !altSkus.has(l.sku)) st.misses.push({ id: nextId(st, 'M'), store, vsr: visit.vsr, date, sku: l.sku, type: 'UNREC', recSku: null, mark: null });
    for (const r of recs.concat(temps.filter(x => x.revisit && x.soldOn === date))) if (r.outcome === 'ALT') st.misses.push({ id: nextId(st, 'M'), store, vsr: visit.vsr, date, sku: r.alt, type: 'ALT', recSku: r.sku, mark: null });
    visit.status = 'DONE'; visit.leftAt = visit.leftAt || time;
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
        const s = FD.sku(rec.sku); const alt = [...s.sisters, s.bigger].filter(Boolean).find(c => !known.includes(c) && !lines.some(l => l.sku === c));
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
  const VSR_FACTOR = { V1: 1.1, V2: 0.8, V3: 1.0, V4: 1.05, V5: 0.9, V6: 1.0 };
  const REASONS = [['R_PRICE', 18], ['R_ENOUGH', 16], ['R_NO_SHELF', 12], ['R_BUYER_NO', 10], ['R_BUYER_ABSENT', 10], ['R_COMPETITOR', 10], ['R_NOT_ON_VAN', 6], ['R_CREDIT', 5], ['R_SYSTEM', 3], ['R_OTHER', 3]];
  const BRANDS = [['BR_LUSINE', 50], ['BR_7DAYS', 35], ['BR_SABAHOO', 10], ['BR_OTHER', 5]];
  const weighted = (r, list) => { const tot = list.reduce((a, x) => a + x[1], 0); let x = r() * tot; for (const [k, w] of list) { if ((x -= w) < 0) return k; } return list[0][0]; };
  function drawReason(r, rec, vsr) {
    let list = REASONS;
    // seeds: Imran hears "price" far more than others (cupcake boxes most), Rashid often skips reasons
    if (vsr === 'V2') list = REASONS.map(([k, w]) => [k, k === 'R_PRICE' ? w * (FD.sku(rec.sku).group === 'GRP_CUPBOX' ? 16 : 7) : w]);
    if (r() < (vsr === 'V5' ? 0.25 : 0.015)) return;
    rec.reason = weighted(r, list);
    if (rec.reason === 'R_COMPETITOR') rec.brand = weighted(r, BRANDS);
    if (rec.reason === 'R_OTHER') rec.comment = 'Owner travelling this week';
  }
  function simulateDay(st, d) {
    FD.ensureDay(st, d);
    const r = FD.rng(st.seed * 7919 + FD.daysBetween(FD.BASE_START, d));
    const todays = st.visits.filter(v => v.date === d && (v.status === 'PLANNED' || v.status === 'ARRIVED')).sort((a, b) => a.vsr.localeCompare(b.vsr) || a.seq - b.seq);
    if (d >= '2026-11-02' && !st.watchSeeded) { st.watchSeeded = true; if (!st.watchlist.includes('3040421651')) { st.watchlist.push('3040421651'); st.watchMeta['3040421651'] = { since: d, review: FD.addDays(d, FD.WATCH_DAYS) }; } }
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
        const win = r() < FD.PRIOR[rec.type] * (VSR_FACTOR[vsr] || 1);
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
          const alt = [...s.sisters, s.bigger].filter(Boolean).find(c => !known.includes(c) && !lines.some(l => l.sku === c));
          lines.push(alt ? { sku: alt, units: 1 } : { sku: rec.sku, units: q });
        }
        delete rec._m;
      }
      for (const tr of FD.openTemps(st, v.store, d, v.id)) if (r() < 0.35 && !lines.some(l => l.sku === tr.sku)) lines.push({ sku: tr.sku, units: tr.qty });
      if (r() < 0.03) { const cand = FD.SKUS.filter(s => !known.includes(s.code) && !lines.some(l => l.sku === s.code) && !recs.some(x => x.sku === s.code)); if (cand.length) lines.push({ sku: FD.pick(r, cand).code, units: 1 }); }
      // expiry returns on regular stock: Fruit Slice is the known problem SKU (watchlist), other cakes rarely
      for (const l of lines) { const s = FD.sku(l.sku); const pr = l.sku === '3040421651' ? (st.watchlist.includes(l.sku) ? 0.12 : 0.35) : // ponytail: flat drop once watched (no upsell overstock), a real feed would show it
           s.category === 'cake' ? 0.01 : 0;
        if (pr && r() < pr) st.returns.push({ id: nextId(st, 'RT'), store: v.store, sku: l.sku, date: FD.addDays(d, FD.int(r, 5, 12)), saleDate: d, units: 1, value: +s.cost.toFixed(2), expiry: true }); }
      v.leftAt = hhmm(start + 20);
      const graded = applyLines(st, v, lines, d, hhmm(start + 15));
      for (const rec of graded) {
        if (rec.outcome === 'NOT_SOLD') drawReason(r, rec, vsr);
        if (FD.SOLD.includes(rec.outcome)) {
          st.soldCount = (st.soldCount || 0) + 1;
          if (st.soldCount % 300 === 0) { rec.corrected = true; rec.prevOutcome = 'NOT_SOLD'; }
          const sku = rec.alt || rec.sku;
          const fixedReturn = (v.store === 'ST-012' || v.store === 'ST-055') && rec.type === 'GAP' && !st.returns.some(x => x.store === v.store);
          if (fixedReturn || (sku === '3040421651' && r() < 0.10))
            st.returns.push({ id: nextId(st, 'RT'), store: v.store, sku, date: FD.addDays(d, fixedReturn ? 9 : 7), saleDate: d, units: rec.got || 1, value: +((rec.got || 1) * FD.sku(sku).cost).toFixed(2) });
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
    const m = {}; for (const l of FD.LABELS) m[l] = by(s => s.label === l); for (const t of FD.TAGS) m[t] = by(s => s.tags.includes(t)); return m;
  };

  // ---------- fresh state ----------
  function fresh(seed) {
    const world = FD.buildWorld(seed);
    const hist = FD.buildHistory(world, seed, FD.BASE_START, FD.addDays(FD.PILOT_START, -1));
    const r = FD.rng(seed + 99);
    const vanStock = {};
    for (const v of world.vsrs) { vanStock[v.id] = {}; const zero = [FD.pick(r, FD.SKUS).code]; for (const s of FD.SKUS) vanStock[v.id][s.code] = zero.includes(s.code) ? 0 : FD.int(r, 6, 14); }
    const mustStock = FD.computeMustStock(world, hist.orders, null);
    const st = {
      v: 1, dv: 0, seed, clock: { date: FD.PILOT_START, time: '07:00' }, lang: 'en', digits: 'arab', role: 'sup', vsrId: 'V1', textSize: 'normal', theme: 'auto',
      world, orders: hist.orders, returns: hist.returns, visits: hist.visits, recs: [], misses: [], threads: [], tips: [], notifs: [], corrections: [],
      rules: { lapsedDays: 21, cooldownDays: 14, maturityDays: 28, maxPerStore: 3, firstFillMax: 1, vanFeed: true, mustStock },
      blocks: [], pins: [], watchlist: [], watchMeta: {}, watchHistory: [], reasonEdit: { custom: {}, hidden: [], names: {} }, vanStock, cooldownOverrides: [], covers: [{ date: '2026-11-02', route: 'R1', vsr: 'V4' }],
      followupDone: {}, followupSnooze: {}, tipDone: {}, tourSeen: { sup: false, vsr: false }, dayConfirmed: {}, offline: false, queue: [], log: [], audit: [],
      planned: {}, pendingOrders: {}, fuHistory: [], revisitQueue: [], planChanges: [], routeAssign: [], sbPending: [], photos: [], delaySync: false, notifSent: {}, seq: 0, simulatedThrough: null, lastOrder: null, keys: {}, soldCount: 0, watchSeeded: false
    };
    FD.simulatePilot(st, FD.PILOT_START, FD.addDays(FD.TODAY, -1));
    st.clock = { date: FD.TODAY, time: '07:00' };
    FD.refreshMaturity(st); // statuses first, so today's plan is built on current first-fill gates
    FD.ensureDay(st, FD.TODAY);
    seedExtras(st);
    return st;
  }
  function seedExtras(st) {
    const y = FD.addDays(FD.TODAY, -1);
    if (FD.PHOTOS) FD.PHOTOS.forEach((src, i) => { const s = st.world.stores[(i * 7 + 3) % st.world.stores.length]; const v = st.visits.filter(x => x.store === s.id && x.status === 'DONE' && x.date < FD.TODAY).slice(-1 - (i % 3))[0];
      if (v) st.photos.push({ id: 'PH' + (i + 1), store: s.id, vsr: v.vsr, date: v.date, time: v.leftAt || '12:00', src, seeded: true }); });
    // a couple of stores get several photos on different visits (timeline)
    if (FD.PHOTOS) [0, 1, 2, 3].forEach(i => { const s = st.world.stores[3]; const v = st.visits.filter(x => x.store === s.id && x.status === 'DONE' && x.date < FD.TODAY).slice(-1 - i)[0]; if (v) st.photos.push({ id: 'PHx' + i, store: s.id, vsr: v.vsr, date: v.date, time: v.leftAt || '12:00', src: FD.PHOTOS[(i + 5) % FD.PHOTOS.length], seeded: true }); });
    const at = { date: y, time: '16:40' };
    const pr = st.recs.filter(r => r.vsr === 'V2' && r.reason === 'R_PRICE' && FD.sku(r.sku).group === 'GRP_CUPBOX').pop();
    if (pr) { postMsg(st, { type: 'rec', id: pr.id }, 'V2', { text: 'Owner says the 18 box is too much. He sells singles only.', at });
      postMsg(st, { type: 'rec', id: pr.id }, 'SUP', { text: FD.CATALOG.QR_ONEBOX.en, qr: 'QR_ONEBOX', at: { date: y, time: '18:05' } });
      const th = st.threads.find(x => x.anchor.id === 'V2'); th.unreadSup = false; th.seenSup = y + ' 18:05'; }
    const v5store = st.world.stores.find(s => s.vsr === 'V5');
    postMsg(st, { type: 'store', id: v5store.id }, 'V5', { text: 'Two expired cake boxes to pick up here.', topic: 'R_T_RETURN', at: { date: y, time: '13:20' } });
    st.tips.push({ id: nextId(st, 'TP'), vsr: 'V3', tpl: 'K_GOOD', slots: { pct: 12 }, status: 'SENT', sentAt: { date: FD.addDays(FD.TODAY, -6), time: '09:00' }, read: true, text: null });
    const v3store = st.world.stores.find(s => s.vsr === 'V3' && !s.tags.includes('TAG_SCHOOL'));
    st.corrections.push({ id: nextId(st, 'CR'), vsr: 'V3', store: v3store.id, kind: 'CORR_TAG', comment: 'There is a girls school opposite now.', status: 'PENDING', at });
    for (const r of st.recs.filter(r => r.date === y)) {
      const target = { screen: 'store', store: r.store, rec: r.id };
      if (FD.SOLD.includes(r.outcome)) st.notifs.push({ id: nextId(st, 'N'), vsr: r.vsr, tpl: 'N_SOLD', slots: { skuCode: r.alt || r.sku, storeId: r.store }, target, at: { date: y, time: r.gradedAt || '12:00' }, read: true });
      if (r.outcome === 'NOT_SOLD') st.notifs.push({ id: nextId(st, 'N'), vsr: r.vsr, tpl: 'N_NOT_SOLD', slots: { skuCode: r.sku, storeId: r.store }, target: { ...target, reason: true }, at: { date: y, time: r.gradedAt || '12:00' }, read: !!r.reason });
    }
  }

  // ---------- reducers ----------
  const R = {};
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
    FD.refreshMaturity(st);
    FD.ensureDay(st, target);
    FD.refreshMaturity(st);
    if (st.clock.time >= '19:00') for (const v of st.world.vsrs) {
      const n = st.recs.filter(r => r.date === target && FD.recVsr(r) === v.id && (r.outcome === 'NOT_SOLD' || r.outcome === 'NOT_OFFERED') && !r.reason && !r.exempted).length;
      const k = 'EOD|' + v.id + '|' + target;
      if (n && !st.notifSent[k]) { st.notifSent[k] = true; notify(st, v.id, 'N_EOD', { n }, { screen: 'todo' }); }
    }
    if (st.clock.time >= '21:30') settlePending(st, target);
  };
  R.DAY_CONFIRM = (st, p) => { st.dayConfirmed[p.vsr + '|' + (p.date || st.clock.date)] = true; };
  R.DAY_UNCONFIRM = (st, p) => { delete st.dayConfirmed[p.vsr + '|' + (p.date || st.clock.date)]; };
  R.REC_UNTICK = (st, p) => { const r = rec(st, p.recId); r.outcome = 'NOT_OFFERED'; r.untickedAt = st.clock.time; r.reason = p.reason || null; r.comment = p.comment || null; };
  R.REC_RETICK = (st, p) => { const r = rec(st, p.recId); r.outcome = null; r.untickedAt = null; r.reason = null; r.comment = null; };
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
  R.STOP_MOVE = (st, p) => {
    const v = visitOf(st, p.store, st.clock.date, p.visitId); if (!v) return;
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
      r.maturity = FD.SOLD.includes(g.outcome) ? 'PENDING' : null;
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
  const planNote = (st, vsr, store) => notify(st, vsr, 'N_PLAN_SUP', { supId: 'S1', storeId: store }, { screen: 'store', store });
  const openRec = (st, id) => { const r = rec(st, id); return r && r.date === st.clock.date && r.outcome === null ? r : null; };
  const supDraft = (st, store, sku, qty) => { const pr = FD.activePromo ? FD.activePromo(st, sku, st.clock.date) : null; const k = FD.sku(sku); return { store, sku, type: 'SUP', qty, reasonId: 'B_SUP', slots: {}, promo: pr ? pr.id : null, pinned: false, ev: +(qty * (k.retail - k.cost)).toFixed(2), value: +(qty * k.cost).toFixed(2) }; };
  R.SUP_REC_EDIT = (st, p) => { const r = openRec(st, p.recId); if (!r) return;
    r.supEdited = { at: now(st), prev: { sku: r.sku, qty: r.qtyModified ?? r.qty } };
    if (p.sku && p.sku !== r.sku) Object.assign(r, supDraft(st, r.store, p.sku, p.qty || r.qty), { qtyModified: null });
    if (p.qty != null) r.qtyModified = p.qty;
    FD.invalidate(st); planNote(st, FD.recVsr(r), r.store); };
  R.SUP_REC_ADD = (st, p) => { const d = st.clock.date; const v = st.visits.find(x => x.date === d && x.store === p.store && (x.status === 'PLANNED' || x.status === 'ARRIVED')); if (!v) return;
    if (recsFor(st, d, p.store).some(r => r.sku === p.sku && !r.blockedAt)) return;
    const r = makeRec(st, supDraft(st, p.store, p.sku, p.qty), v.vsr, d); r.supEdited = { at: now(st), prev: null }; const c = coverFor(st, d, v.route); if (c) r.coveredBy = c.vsr;
    st.recs.push(r); FD.invalidate(st); planNote(st, FD.recVsr(r), p.store); };
  R.SUP_REC_REMOVE = (st, p) => { const r = openRec(st, p.recId); if (!r) return; r.blockedAt = now(st); r.supRemoved = true; FD.invalidate(st); notify(st, FD.recVsr(r), 'N_REMOVED', { skuCode: r.sku, storeId: r.store }, { screen: 'store', store: r.store }); };
  R.SUP_REC_RESTORE = (st, p) => { const r = rec(st, p.recId); if (!r || !r.supRemoved || r.date !== st.clock.date) return; if (recsFor(st, r.date, r.store).some(x => x.id !== r.id && x.sku === r.sku && !x.blockedAt)) return; r.blockedAt = null; r.supRemoved = false; FD.invalidate(st); planNote(st, FD.recVsr(r), r.store); };
  R.SUP_STOP_REMOVE = (st, p) => { const v = st.visits.find(x => x.date === st.clock.date && x.store === p.store && x.status === 'PLANNED'); if (!v) return;
    v.status = 'SKIPPED'; v.skipReason = 'SK_SUP'; v.bySup = true; st.planChanges.push({ vsr: v.vsr, store: v.store, date: v.date, reason: 'SK_SUP', at: now(st), bySup: true }); planNote(st, v.vsr, v.store); };
  R.SUP_STOP_RESTORE = (st, p) => { const v = st.visits.find(x => x.date === st.clock.date && x.store === p.store && x.status === 'SKIPPED' && x.bySup); if (!v) return; if (st.visits.some(x => x !== v && x.date === v.date && x.store === v.store && (x.status === 'PLANNED' || x.status === 'ARRIVED'))) return; v.status = 'PLANNED'; v.skipReason = null; v.bySup = false; planNote(st, v.vsr, v.store); };
  R.OFFPLAN_ADD = (st, p) => {
    const d = st.clock.date; if (!FD.isSellingDay(d)) return; FD.ensureDay(st, d);
    if (st.visits.some(v => v.date === d && v.store === p.store && (v.status === 'PLANNED' || v.status === 'ARRIVED'))) return;
    const removed = st.visits.find(v => v.date === d && v.store === p.store && v.status === 'SKIPPED' && v.bySup); if (removed) return R.SUP_STOP_RESTORE(st, { store: p.store });
    const s = storeById(st, p.store); const route = st.world.routes.find(r => FD.routeOwner(st, r.id, d) === p.vsr) || st.world.routes.find(r => r.id === s.route);
    const seq = Math.max(0, ...st.visits.filter(v => v.date === d && v.route === route.id).map(v => v.seq)) + 1;
    st.visits.push({ id: nextId(st, 'VI'), store: s.id, vsr: p.vsr, route: route.id, date: d, seq, status: 'PLANNED', arrivedAt: null, leftAt: null, skipReason: null, moved: false, offPlan: true });
    if (!recsFor(st, d, s.id).length) genRecs(st, s, d, p.vsr, FD.openTemps(st, s.id, d).map(r => r.sku));
    { const c = coverFor(st, d, route.id); if (c) recsFor(st, d, s.id).forEach(r => { r.coveredBy = c.vsr; }); }
    st.planChanges.push({ vsr: p.vsr, store: s.id, date: d, reason: p.bySup ? 'SK_SUP_ADDED' : 'SK_OFFPLAN', at: now(st), bySup: !!p.bySup });
    if (p.bySup) planNote(st, p.vsr, s.id);
  };
  R.STORE_ASSIGN = REGEN((st, p) => {
    const s = storeById(st, p.store); const to = st.world.vsrs.find(v => v.id === p.vsr);
    const route = st.world.routes.find(r => FD.routeOwner(st, r.id, FD.addDays(st.clock.date, 1)) === to.id) || st.world.routes.find(r => r.id === to.route);
    s.vsr = to.id; s.route = route.id; FD.invalidate(st); // plans already made (today) keep their stops; new days use the new owner
    st.sbPending = st.sbPending.filter(x => x.store !== s.id); st.sbPending.push({ kind: 'store', store: s.id, vsr: to.id, at: now(st) }); audit(st, 'AU_ASSIGN', { storeId: s.id, vsrId: to.id });
  });
  R.ROUTE_ASSIGN = (st, p) => {
    let from = FD.addDays(st.clock.date, 1); if (st.simulatedThrough && from <= st.simulatedThrough) from = FD.addDays(st.simulatedThrough, 1);
    const prev = FD.routeOwner(st, p.route, from);
    const theirs = st.world.routes.find(r => FD.routeOwner(st, r.id, from) === p.vsr);
    st.routeAssign.push({ route: p.route, vsr: p.vsr, from });
    if (theirs && prev && theirs.id !== p.route) st.routeAssign.push({ route: theirs.id, vsr: prev, from }); // swap so every route keeps one owner
    for (const s of st.world.stores) s.vsr = FD.routeOwner(st, s.route, from) || s.vsr;
    st.sbPending.push({ kind: 'route', route: p.route, vsr: p.vsr, at: now(st) }); audit(st, 'AU_ASSIGN', { vsrId: p.vsr });
  };
  R.VANFEED_SET = REGEN((st, p) => { st.rules.vanFeed = !!p.on; audit(st, 'AU_VANFEED', {}); });
  R.STORE_EDIT = REGEN((st, p) => { Object.assign(storeById(st, p.store), p.patch); FD.invalidate(st); audit(st, 'AU_STORE', { storeId: p.store }); });
  R.CORRECTION_ADD = (st, p) => { st.corrections.push({ id: nextId(st, 'CR'), vsr: p.vsr, store: p.store, kind: p.kind, comment: p.comment || '', status: 'PENDING', at: now(st) }); };
  R.CORRECTION_DECIDE = (st, p) => { const c = st.corrections.find(x => x.id === p.id); c.status = p.accept ? 'ACCEPTED' : 'REJECTED'; c.decidedAt = now(st); c.seen = false; };
  R.CORRECTION_SEEN = (st, p) => { const c = st.corrections.find(x => x.id === p.id); if (c) c.seen = true; };
  R.TIP_SEND = (st, p) => {
    const t = { id: nextId(st, 'TP'), vsr: p.vsr, tpl: p.tpl, slots: p.slots || {}, text: p.text || null, status: 'SENT', sentAt: now(st), read: false, draftKey: p.draftKey || null };
    st.tips.push(t); if (p.draftKey) st.tipDone[p.draftKey] = true;
    notify(st, p.vsr, 'N_TIP', { tipTpl: p.tpl }, { screen: 'tip', tip: t.id });
  };
  R.TIP_DISMISS = (st, p) => { st.tipDone[p.draftKey] = true; };
  R.TIP_READ = (st, p) => { const t = st.tips.find(x => x.id === p.id); if (t) t.read = true; };
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
      store: team ? null : tag.store, sku: team ? null : tag.sku, rec: team ? null : tag.rec };
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
  R.FOLLOWUP_SNOOZE = (st, p) => { st.followupSnooze[p.fu] = FD.addDays(st.clock.date, 1); fuLog(st, p, 'L_SNOOZE'); };
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

  // ---------- dispatch, persistence, sync ----------
  const QUEUEABLE = ['REASON_SAVE', 'REC_NOT_OFFERED', 'REC_QTY', 'MSG_SEND', 'STOP_SKIP', 'STOP_MOVE', 'DAY_CONFIRM', 'REC_UNTICK', 'REC_RETICK', 'CORRECTION_ADD'];
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
  function write() { persistTimer = null; if (!storage) return; const ok = storage.set(JSON.stringify({ v: 1, seed: FD.state.seed, log: FD.state.log })); if (!ok && !warned) { warned = true; toast('S_STORAGE', {}); } }
  // browser: debounce so a burst of taps writes once; node tests: write immediately
  function persist() { if (typeof window === 'undefined') return write(); clearTimeout(persistTimer); persistTimer = setTimeout(write, 250); }
  FD.init = function (seed = 7, opts = {}) {
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
  FD.reset = function (fromRemote) { const seed = FD.state.seed; if (storage) storage.clear(); FD.state = fresh(seed); if (chan && !fromRemote) { try { chan.postMessage({ type: '__RESET' }); } catch (e) { } } changed(); };
})();
