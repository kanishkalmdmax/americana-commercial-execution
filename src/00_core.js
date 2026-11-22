(function () {
  const FD = globalThis.FD = globalThis.FD || {};
  // mulberry32: tiny seeded PRNG so every load produces the same demo data
  FD.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  FD.int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  FD.pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const ADD_MEMO = new Map(), PARSE_MEMO = new Map(), DOW_MEMO = new Map();
  const parseIso = s => { let v = PARSE_MEMO.get(s); if (v === undefined) PARSE_MEMO.set(s, v = Date.parse(s)); return v; };
  FD.addDays = (iso, n) => { if (!n) return iso; const k = iso + '|' + n; let v = ADD_MEMO.get(k); if (v === undefined) { const d = new Date(parseIso(iso)); d.setUTCDate(d.getUTCDate() + n); ADD_MEMO.set(k, v = d.toISOString().slice(0, 10)); } return v; };
  FD.dow = iso => { let v = DOW_MEMO.get(iso); if (v === undefined) DOW_MEMO.set(iso, v = new Date(parseIso(iso)).getUTCDay()); return v; };
  // the pilot's salesman app is view-only; salesman entry returns after Phase 1
  FD.SALESMAN_ENTRY = false;
  // Shelf Check in Phase 1 is photos only; scores, issues and AI insights switch on in Phase 2
  FD.SHELF_AI = false;
  // nearby places need reliable store locations; held until those are fixed
  FD.NEARBY_DATA = false;
  FD.isSellingDay = iso => FD.dow(iso) !== 5;
  FD.daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 864e5);
  // HIST_START: first day of the simulated history in the app state. PILOT_START: recommendations live from here.
  // The pilot runs PILOT_DAYS Working Days; it is compared with the 2 months before it (data load: FD.REAL.baseline).
  FD.HIST_START = '2026-09-15'; FD.PILOT_START = '2026-09-22'; FD.PILOT_DAYS = 90;
  // ponytail: Fridays only; add official holidays to isSellingDay when Americana sends the list
  FD.PILOT_END = (() => { let d = FD.PILOT_START, n = FD.isSellingDay(d) ? 1 : 0; while (n < FD.PILOT_DAYS) { d = FD.addDays(d, 1); if (FD.isSellingDay(d)) n++; } return d; })();
  FD.BASE_FROM = (() => { const d = new Date(Date.parse(FD.PILOT_START)); d.setUTCMonth(d.getUTCMonth() - 2); return d.toISOString().slice(0, 10); })();
  FD.TODAY = '2026-10-22';
  FD.lang = 'en'; FD.digits = 'arab';
  const subs = {};
  FD.bus = {
    on(evt, fn) { (subs[evt] = subs[evt] || []).push(fn); return () => { subs[evt] = subs[evt].filter(f => f !== fn); }; },
    emit(evt, data) { (subs[evt] || []).forEach(fn => fn(data)); }
  };
})();
