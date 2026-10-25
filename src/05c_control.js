(function () {
  const FD = globalThis.FD;
  // Supervisor control room: van stages, live alerts, dispatch exceptions, expected sales (spec R7 §5-§6). Stages change on actions, never on clock times.
  const vanOf = (st, id) => st.world.vsrs.find(v => v.id === id);
  const who = (st, v) => { const c = st.covers.find(x => x.date === v.date && x.route === v.route); return c ? c.vsr : v.vsr; };
  const dayVisits = (st, vanId, iso) => st.visits.filter(v => v.date === iso && who(st, v) === vanId);
  const mins = t => { const [h, m] = String(t || '00:00').split(':').map(Number); return h * 60 + m; };
  const CLOSE_AFTER = 60; // SalesBuzz closes a van's day about an hour after its last visit

  // last real stop of the van today, once the clock has passed it (the van's SalesBuzz day closing)
  function sbClosed(st, vanId, iso) {
    if (iso < st.clock.date) return true;
    if (iso > st.clock.date) return false;
    const real = FD.realStops(iso).filter(s => s.van === vanId); if (!real.length) return false;
    const last = Math.max(...real.map(s => mins(s.end)));
    return mins(st.clock.time) >= Math.min(last + CLOSE_AFTER, 23 * 60 + 59); // SalesBuzz closes the day by midnight at the latest
  }
  FD.vanStage = function (st, id, iso) {
    const v = vanOf(st, id); const vs = dayVisits(st, id, iso);
    if (!v || v.kind === 'inactive' || !vs.length) return 'NO_ACTIVITY';
    const k = id + '|' + iso; const started = vs.some(x => x.status === 'DONE' || x.status === 'ARRIVED');
    const open = vs.filter(x => !x.offPlan && (x.status === 'PLANNED' || x.status === 'ARRIVED'));
    if (st.vanClosed[k] || (started && (!open.length || sbClosed(st, id, iso)))) return 'CLOSED';
    if (started) return 'LIVE';
    return st.released[k] ? 'DISPATCHED' : 'PLAN_READY';
  };
  // Which of the five sales metrics each alert, pre-release check and follow-up moves. Shared by both apps.
  FD.LEVER_OF = {
    A_MISSED: 'visits', A_OFFPLAN: 'visits', A_PACE: 'visits', A_PREORDER: 'withSale',
    X_CARRY: 'visits', X_OWNER_NOT: 'visits', X_PREORDER: 'withSale', X_DUE: 'withSale', X_QUESTION: 'withSale', X_SKIPPED: 'visits', X_SHORT: 'upsell', X_DAMAGED: 'returns',
    F_RETURN_UPSELL: 'returns', F_WATCH_OK: 'returns', F_WATCH_BAD: 'returns', F_WATCHLIST: 'returns',
    F_MISSING_REASONS: 'upsell', F_REPEAT_DECLINE: 'upsell', F_COMPETITOR: 'upsell', F_GAP_CLUSTER: 'upsell', F_NOT_OFFERED: 'upsell', F_PLANOGRAM:'upsell', F_ENGINE_MISS: 'upsell', F_PROMO_LOW: 'upsell',
    F_VSR_BELOW: 'avgSale', F_CREDIT: 'withSale', F_SKIPPED: 'visits', F_PLAN_CHANGE: 'visits', F_COVER: 'visits',
  };
  FD.leverOf = type => FD.LEVER_OF[type] || null;
  FD.dayClosed = (st, iso) => !!st.dayClosed[iso];
  // SalesBuzz sends a day's visits, orders and returns overnight, so by default the supervisor works on the last full selling day.
  // Rules can switch to live data if SalesBuzz ever streams during the day. WhatsApp (pre-orders, owner photos) is always live.
  FD.liveData = st => !!(st && st.rules && st.rules.liveData);
  FD.prevSellingDay = d => { let x = FD.addDays(d, -1); for (let i = 0; i < 7 && !FD.isSellingDay(x); i++) x = FD.addDays(x, -1); return x; };
  FD.dataDay = st => FD.liveData(st) ? st.clock.date : FD.prevSellingDay(st.clock.date);
  FD.nextSellingDay = d => { let x = FD.addDays(d, 1); for (let i = 0; i < 7 && !FD.isSellingDay(x); i++) x = FD.addDays(x, 1); return x; };
  // what the supervisor can know about a van today: without live data only his own actions (released, closed) show
  FD.stageFor = function (st, id, iso) {
    if (FD.liveData(st) || iso !== st.clock.date) return FD.vanStage(st, id, iso);
    const v = vanOf(st, id); const k = id + '|' + iso;
    if (!v || v.kind === 'inactive' || !dayVisits(st, id, iso).length) return 'NO_ACTIVITY';
    return st.vanClosed[k] ? 'CLOSED' : st.released[k] ? 'DISPATCHED' : 'PLAN_READY';
  };
  // stores planned on the latest data day and not visited, not yet back on a plan: candidates to carry into a later plan
  FD.carryOvers = function (st, vanId, forDate) {
    const dd = FD.dataDay(st); if (dd >= forDate) return [];
    const later = new Set(st.visits.filter(v => v.date > dd && v.date <= forDate && v.status !== 'SKIPPED').map(v => v.store));
    return FD.alerts(st, dd).filter(a => a.type === 'A_MISSED' && a.van === vanId && !later.has(a.store)).map(a => ({ type: 'X_CARRY', store: a.store, slots: { storeId: a.store, date: dd } }));
  };
  // suggestions for a van's plan on a later day: carry-overs, stores due to order, and stores that rarely order (to drop)
  // ponytail: top 6 per van by expected sale (pre-orders first, stores to drop last), so the evening review stays short
  FD.planSuggestions = (st, vanId, iso) => { FD.ensureDay(st, iso);
    const all = FD.carryOvers(st, vanId, iso).concat(FD.dispatchExceptions(st, vanId, iso).filter(x => ['X_DUE', 'X_QUESTION', 'X_PREORDER', 'X_OWNER_NOT'].includes(x.type)));
    const rank = x => x.type === 'X_PREORDER' ? 1e9 : x.type === 'X_OWNER_NOT' ? 1e8 : x.type === 'X_QUESTION' ? -1 : FD.expectedSales(st, x.store);
    const seen = new Set(); return all.filter(x => !seen.has(x.store + x.type) && seen.add(x.store + x.type)).sort((a, b) => rank(b) - rank(a)).slice(0, 6); };
  FD.DEPOT = { lat: 24.598, lng: 46.781 }; // Americana Riyadh depot (map pin)
  FD.vanPosition = function (st, id, iso) {
    const done = dayVisits(st, id, iso).filter(x => x.status === 'DONE' || x.status === 'ARRIVED').sort((a, b) => (b.leftAt || b.arrivedAt || '').localeCompare(a.leftAt || a.arrivedAt || ''));
    if (!done.length) return { at: 'DEPOT', lat: FD.DEPOT.lat, lng: FD.DEPOT.lng };
    const s = st.world.stores.find(x => x.id === done[0].store);
    return { at: 'STORE', store: s.id, lat: s.lat, lng: s.lng, time: done[0].leftAt || done[0].arrivedAt };
  };
  FD.allVansClosed = (st, iso) => st.world.vsrs.every(v => ['CLOSED', 'NO_ACTIVITY'].includes(FD.vanStage(st, v.id, iso)));

  // expected sales per store visit: average order value on its ordering days x how often a planned visit ended in an order (history only)
  const exp = new WeakMap();
  FD.expectedSales = function (st, storeId) {
    let m = exp.get(st.world);
    if (!m) {
      m = new Map(); const val = {}, days = {}, planned = {};
      for (const o of st.orders) if (o.date < FD.TODAY && o.src === 'SB') { val[o.store] = (val[o.store] || 0) + o.value; (days[o.store] || (days[o.store] = new Set())).add(o.date); }
      const active = new Set(st.world.vsrs.filter(v => v.kind !== 'inactive').map(v => v.id));
      for (const p of FD.REAL.plan) if (p[0] < FD.TODAY && active.has(p[1])) planned[p[2]] = (planned[p[2]] || 0) + 1;
      for (const s of st.world.stores) { const n = days[s.id] ? days[s.id].size : 0; m.set(s.id, n ? (val[s.id] / n) * Math.min(1, n / Math.max(n, planned[s.id] || n)) : 0); }
      exp.set(st.world, m);
    }
    return m.get(storeId) || 0;
  };

  FD.vanProgress = function (st, id, iso) {
    FD.ensureDay(st, iso);
    const vs = dayVisits(st, id, iso); const plan = vs.filter(x => !x.offPlan && x.status !== 'SKIPPED');
    const missed = FD.alerts(st, iso).filter(a => a.type === 'A_MISSED' && a.van === id).length;
    const sales = st.orders.filter(o => o.date === iso && o.vsr === id).reduce((a, o) => a + o.value, 0);
    const t = iso === st.clock.date ? st.clock.time : '23:59';
    const collected = FD.realPays(iso).filter(p => p.van === id && p.time <= t).reduce((a, p) => a + p.amount, 0);
    const returns = st.returns.filter(r => r.date === iso && r.vsr === id).reduce((a, r) => a + r.value, 0);
    // one entry per planned stop in route order, for the adherence squares on the van tile
    const sold = new Set(st.orders.filter(o => o.date === iso && o.vsr === id).map(o => o.store));
    const paid = {}; for (const x of FD.realPays(iso)) if (x.van === id && x.time <= t) paid[x.store] = (paid[x.store] || 0) + x.amount;
    const stops = plan.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0)).map(x => ({ store: x.store, at: x.arrivedAt,
      kind: x.status === 'DONE' ? (sold.has(x.store) ? 'sale' : 'nosale') : x.status === 'ARRIVED' ? 'now' : x.status === 'MISSED' ? 'missed' : 'todo',
      col: paid[x.store] ? 'paid' : x.status === 'DONE' && FD.overdueAt(x.store, iso) > 0 ? 'due' : null, paid: paid[x.store] || 0 }));
    return { stops, planned: plan.length, done: plan.filter(x => x.status === 'DONE').length, offPlan: vs.filter(x => x.offPlan && x.status === 'DONE').length, missed,
      sales: +sales.toFixed(2), expected: +plan.reduce((a, x) => a + FD.expectedSales(st, x.store), 0).toFixed(2), collected: +collected.toFixed(2), returns: +returns.toFixed(2) };
  };

  const RANK = { A_MISSED: 0, A_OFFPLAN: 1, A_PACE: 2, A_PREORDER: 3 };
  // an alert the supervisor resolved stays hidden; a new stop or van problem raises a new one
  FD.alertKey = (a, iso) => [a.type, a.van, a.store || a.visit || a.preorder || '', iso].join('|');
  // what was done about a missed stop: put back on a later plan, or marked handled (and how)
  FD.missOutcome = (st, van, store, iso) => {
    const later = st.visits.find(v => v.store === store && v.date > iso && v.supAdded && v.status !== 'SKIPPED'); // only a stop someone put back counts, not the next routine visit
    if (later) return { id: 'L_OUT_REPLANNED', slots: { date: later.date } };
    const how = (st.alertDone || {})[['A_MISSED', van, store, iso].join('|')];
    if (how === 'REPLANNED') { const next = st.visits.find(v => v.store === store && v.date > iso && v.status !== 'SKIPPED'); return next ? { id: 'L_OUT_REPLANNED', slots: { date: next.date } } : { id: 'L_OUT_RESOLVED' }; }
    return how ? { id: 'L_OUT_' + (how === true ? 'RESOLVED' : how) } : null; };
  FD.alerts = (st, iso) => { const done = st.alertDone || {}; return allAlerts(st, iso).filter(a => !done[FD.alertKey(a, iso)]); };
  function allAlerts(st, iso) {
    return FD.cached('alerts', st, iso + st.clock.time, () => {
      const out = []; const doneAny = new Set(st.visits.filter(x => x.date === iso && x.status === 'DONE').map(x => x.store));
      for (const v of st.world.vsrs) {
        const stage = FD.vanStage(st, v.id, iso); if (stage !== 'LIVE' && stage !== 'CLOSED') continue;
        const vs = dayVisits(st, v.id, iso);
        // salesmen do not follow the plan order, so a stop is only missed once the van's day is over (closed, or past its usual end)
        const over = stage === 'CLOSED' || iso < st.clock.date || mins(st.clock.time) >= mins(v.last);
        for (const x of vs) {
          if (!x.offPlan && (x.status === 'PLANNED' || x.status === 'MISSED') && !doneAny.has(x.store) && over)
            out.push({ type: 'A_MISSED', van: v.id, store: x.store, visit: x.id, slots: { storeId: x.store } });
          if (x.offPlan && x.status === 'DONE') out.push({ type: 'A_OFFPLAN', van: v.id, store: x.store, visit: x.id, at: x.arrivedAt, slots: { vsrId: v.id, storeId: x.store } });
        }
        if (stage === 'LIVE' && v.kind === 'sales' && iso === st.clock.date) {
          const a = mins(v.first), b = Math.max(mins(v.last), a + 60); const share = Math.max(0, Math.min(1, (mins(st.clock.time) - a) / (b - a)));
          const planned = vs.filter(x => !x.offPlan && x.status !== 'SKIPPED').length; const done = vs.filter(x => x.status === 'DONE').length;
          if (done >= 1 && planned && done < Math.floor(planned * share * 0.8)) out.push({ type: 'A_PACE', van: v.id, slots: { vsrId: v.id, n: done, m: planned } });
        }
      }
      for (const p of st.preorders) if (p.status === 'NEW' && p.at.date === iso) {
        const x = st.visits.find(y => y.date === p.forDate && y.store === p.store); out.push({ type: 'A_PREORDER', van: x ? x.vsr : (st.world.stores.find(s => s.id === p.store) || {}).vsr, store: p.store, preorder: p.id, slots: { storeId: p.store } });
      }
      return out.sort((a, b) => RANK[a.type] - RANK[b.type]);
    });
  }
  // one row per van and alert type, with its stops, so 14 missed stops read as one line
  FD.alertGroups = function (st, iso) {
    const g = new Map();
    for (const a of FD.alerts(st, iso)) { const k = a.type + '|' + a.van; if (!g.has(k)) g.set(k, { type: a.type, van: a.van, count: 0, items: [] }); const x = g.get(k); x.count++; x.items.push(a); }
    return [...g.values()].sort((a, b) => RANK[a.type] - RANK[b.type] || b.count - a.count);
  };

  // what the supervisor should look at before releasing a van's plan (spec §5.1)
  FD.dispatchExceptions = function (st, vanId, iso) {
    return FD.cached('dispx', st, vanId + iso, () => {
      const out = []; const v = vanOf(st, vanId); if (!v || v.kind === 'inactive') return out;
      const today = dayVisits(st, vanId, iso).filter(x => !x.offPlan && x.status !== 'SKIPPED'); const onPlan = new Set(today.map(x => x.store));
      const from = FD.addDays(iso, -28);
      const active = new Set(st.world.vsrs.filter(x => x.kind !== 'inactive').map(x => x.id));
      const planN = {}; for (const p of FD.REAL.plan) if (p[0] >= from && p[0] < iso && active.has(p[1])) planN[p[2]] = (planN[p[2]] || 0) + 1;
      const ordDays = {}; for (const o of st.orders) if (o.date < iso && o.src === 'SB') (ordDays[o.store] || (ordDays[o.store] = new Set())).add(o.date);
      for (const x of today) {
        // stores here order about once a month, so only a store with no order in 45 days is questioned (one monthly order keeps it on plan)
        const n = planN[x.store] || 0, m = ordDays[x.store] ? [...ordDays[x.store]].filter(d => d >= FD.addDays(iso, -45)).length : 0;
        if (v.kind === 'sales' && n >= 4 && m === 0) out.push({ type: 'X_QUESTION', store: x.store, visit: x.id, slots: { storeId: x.store, n, m } });
        // missed on its last two planned visits (one miss is the norm in this data, two in a row is a pattern)
        const prev = st.visits.filter(y => y.store === x.store && y.date < iso && !y.offPlan).sort((a, b) => b.date.localeCompare(a.date));
        if (prev.length >= 2 && prev[0].status === 'MISSED' && prev[1].status === 'MISSED') out.push({ type: 'X_SKIPPED', store: x.store, visit: x.id, slots: { storeId: x.store, date: prev[0].date } });
        for (const p of st.preorders.filter(p => p.store === x.store && p.forDate === iso && p.status !== 'DONE')) out.push({ type: 'X_PREORDER', store: x.store, visit: x.id, preorder: p.id, slots: { storeId: x.store } });
        const wa = FD.waVisitReply && FD.waVisitReply(st, x.store, iso); if (wa && wa.choice === 'W_R_NOT') out.push({ type: 'X_OWNER_NOT', store: x.store, visit: x.id, slots: { storeId: x.store, reasonCode: wa.sub || 'W_R_NOT' } });
      }
      const due = [];
      if (v.kind === 'sales') for (const s of st.world.stores) if (s.vsr === vanId && !onPlan.has(s.id) && ordDays[s.id] && ordDays[s.id].size >= 2) {
        const d = [...ordDays[s.id]].sort(); const gap = Math.round(FD.daysBetween(d[0], d[d.length - 1]) / (d.length - 1)); const since = FD.daysBetween(d[d.length - 1], iso);
        if (gap >= 3 && since >= gap) due.push({ type: 'X_DUE', store: s.id, slots: { storeId: s.id, n: gap, days: since }, over: since - gap });
      }
      due.sort((a, b) => b.over - a.over).slice(0, 5).forEach(x => { delete x.over; out.push(x); });
      if (st.rules.vanFeed && v.kind === 'sales') { const need = {}; for (const r of st.recs) if (r.date === iso && FD.recVsr(r) === vanId && !r.blockedAt && r.outcome === null) need[r.sku] = (need[r.sku] || 0) + (r.qtyModified ?? r.qty);
        for (const [sku, n] of Object.entries(need)) { const m = (st.vanStock[vanId] || {})[sku] || 0; if (n > m) out.push({ type: 'X_SHORT', sku, slots: { skuCode: sku, n, m } }); } }
      // damaged returns still on the van (van stock snapshot of the extract day): unload before loading
      const dmg = iso === FD.TODAY ? Object.values((FD.REAL.vanDamaged || {})[vanId] || {}).reduce((a, n) => a + n, 0) : 0;
      if (dmg > 0 && v.kind === 'sales') out.push({ type: 'X_DAMAGED', slots: { n: dmg } });
      return out;
    });
  };
})();
