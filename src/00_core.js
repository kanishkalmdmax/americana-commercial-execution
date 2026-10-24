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
  FD.isSellingDay = iso => FD.dow(iso) !== 5;
  FD.daysBetween = (a, b) => Math.round((parseIso(b) - parseIso(a)) / 864e5);
  FD.BASE_START = '2026-09-15'; FD.PILOT_START = '2026-09-22'; // PILOT_START: recommendations live from here (one week of before-data)
  FD.TODAY = '2026-10-22'; FD.PILOT_END = '2026-10-31';
  FD.lang = 'en'; FD.digits = 'arab';
  const subs = {};
  FD.bus = {
    on(evt, fn) { (subs[evt] = subs[evt] || []).push(fn); return () => { subs[evt] = subs[evt].filter(f => f !== fn); }; },
    emit(evt, data) { (subs[evt] || []).forEach(fn => fn(data)); }
  };
})();
