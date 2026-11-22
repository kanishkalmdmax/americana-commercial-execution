(function () {
  // Incentives: what a recommendation adds to the bonus, what missed visits and no-sale visits cost, and the incentive plan.
  const FD = globalThis.FD, E = (en, ar) => ({ en, ar });
  FD.SLOTS.push('pct', 'k', 'amount');
  Object.assign(FD.CATALOG, {
    // recommendation card
    RE_HIST: E('Bought {n} times in 90 days · last {date}', 'اشترى {n} مرات خلال ٩٠ يوماً · آخرها {date}'),
    RE_HIST_NONE: E('Not bought here in 90 days', 'لم يُشترَ هنا خلال ٩٠ يوماً'),
    RE_SALE: E('Est. chance of sale {pct}%', 'فرصة البيع التقديرية {pct}٪'),
    RE_RETURN: E('Returns {pct}%', 'المرتجع {pct}٪'),
    RE_BONUS: E('Est. +{money} bonus', 'تقديري: +{money} مكافأة'),
    RE_TOWARD: E('Est. +{money} to {kpi}', 'تقديري: +{money} إلى {kpi}'),
    // today and consequences (salesman)
    ME_TODAY_EARN: E('Sell today\'s offers: +{money} bonus', 'بِع عروض اليوم: +{money} مكافأة'),
    ME_TODAY_SALES: E('Today\'s offers add {money} to your sales', 'عروض اليوم تضيف {money} لمبيعاتك'),
    ME_LOST_CARD: E('Missed this month', 'الفائت هذا الشهر'),
    ME_LOST_MISSED: E('{n} plan visits missed', '{n} زيارات مخطط لها لم تتم'),
    ME_LOST_NOSALE: E('{n} visits without a sale', '{n} زيارات بدون بيع'),
    ME_LOST_STORES: E('Est. bonus at risk: {money}', 'المكافأة التقديرية في خطر: {money}'),
    ME_LOST_NONE: E('No missed visits this month', 'لا زيارات فائتة هذا الشهر'),
    ME_LOST_LIST: E('Missed visits', 'الزيارات الفائتة'),
    ME_LOST_MISSED_TAG: E('Missed', 'فائتة'), ME_LOST_NOSALE_TAG: E('No sale', 'بدون بيع'),
    ME_UPS_LINE: E('Upsells {money}', 'البيع الإضافي {money}'),
    ME_LOST_PLAN_N: E('Plan visits', 'زيارات الخطة'),
    ME_LOST_SALE_N: E('No sale', 'بدون بيع'),
    L_TODAY_STOPS: E('Today: {n} stops', 'اليوم: {n} زيارات'), L_TODAY_EST: E('Est. {money}', 'تقديري {money}'),
    L_PLAN_CHANGED: E('Plan changed', 'تغيرت الخطة'), L_NO_MESSAGES: E('No new messages', 'لا توجد رسائل جديدة'),
    // supervisor: team KPIs
    L_TEAM_RESULTS: E('Results', 'النتائج'), L_TEAM_KPIS: E('KPIs and bonus', 'المؤشرات والمكافأة'),
    L_COL_BONUS: E('Est. bonus', 'المكافأة التقديرية'), L_COL_LOST: E('Missed this month', 'الفائت هذا الشهر'),
    L_COL_NEXT: E('Next action', 'الإجراء التالي'), L_COL_ONTRACK: E('On track', 'على المسار'),
    L_KPI_OF: E('of {total}', 'من {total}'),
    L_SEND_KPI_TIP: E('Send as tip', 'إرسال كنصيحة'), L_MSG_SALESMAN: E('Message', 'رسالة'),
    L_KPI_TEAM_NOTE: E('Estimate at this month\'s pace.', 'تقدير بوتيرة هذا الشهر.'),
    // supervisor: incentive plan
    INC_RULES: E('Incentives', 'الحوافز'),
    INC_LIVE: E('Bonus plan', 'خطة المكافآت'),
    INC_COL_ITEM: E('Incentive', 'الحافز'), INC_COL_RULE: E('Rule', 'القاعدة'), INC_COL_AMOUNT: E('Monthly amount', 'المبلغ الشهري'),
    INC_R_CAKE: E('{pct}% of route target', '{pct}٪ من هدف المسار'),
    INC_R_GROCERY: E('{pct}% of route target', '{pct}٪ من هدف المسار'),
    INC_R_ACTIVE: E('Invoice {pct}% of plan stores', 'فوترة {pct}٪ من محلات الخطة'),
    INC_R_COLLECT: E('Overdue under {pct}% at month close', 'المتأخر أقل من {pct}٪ عند إقفال الشهر'),
    INC_TIERS: E('Sales tiers', 'شرائح المبيعات'),
    INC_COL_ACH: E('Sales vs target', 'المبيعات مقابل الهدف'), INC_COL_PAY: E('Pays', 'يدفع'),
    INC_T_UNDER: E('Under {pct}%', 'أقل من {pct}٪'), INC_T_ABOVE: E('Above {pct}%', 'أكثر من {pct}٪'), INC_T_UPTO: E('Up to {pct}%', 'حتى {pct}٪'),
    INC_TOTAL: E('Total at 100%: {money}', 'الإجمالي عند ١٠٠٪: {money}'),
    // salesman sees sales as % of target only, never a SAR sales or bonus amount (Americana, 16 Nov)
    ME_OF_DAY_TARGET: E('of day target', 'من هدف اليوم'),
    ME_OF_TARGET: E('of target', 'من الهدف'),
    ME_NO_TARGET: E('Target not set', 'الهدف غير محدد'),
    ME_TARGET_MET: E('Target reached', 'تحقق الهدف'),
    ME_NO_BASE: E('No earlier figures', 'لا توجد أرقام سابقة'),
    KPI_BONUS_LATER: E('Bonus pace shows from tomorrow', 'وتيرة المكافأة تظهر من الغد'),
    ME_NOT_MET: E('Below target', 'تحت الهدف'),
    ME_UP: E('Better than before', 'أفضل من قبل'), ME_DOWN: E('Lower than before', 'أقل من قبل'),
    ME_RET_UP: E('More than before', 'أكثر من قبل'), ME_RET_DOWN: E('Less than before', 'أقل من قبل'),
    ME_DAYS_HIT: E('Day target reached on {n} of {total} days', 'تحقق هدف اليوم في {n} من {total} أيام'),
    KPI_PCT_LINE: E('{pct}% of month target done', 'تم {pct}٪ من هدف الشهر'),
    KPI_NEED_MORE: E('Sell more than your day target each day', 'بِع أكثر من هدف اليوم كل يوم'),
    KPI_NEED_KEEP: E('Reaching your day target each day is enough', 'تحقيق هدف اليوم كل يوم يكفي'),
    KPI_NEXT_BAND: E('Reach {pct}% for a bigger bonus', 'حقق {pct}٪ لمكافأة أكبر'),
    KPI_FULL_PACE: E('Full bonus at this pace', 'مكافأة كاملة بهذه الوتيرة'),
    KPI_PAY_WHEN_MET: E('Paid in full when met', 'يُدفع كاملاً عند التحقيق'),
    KPI_TIP_KEEP_PCT: E('On track. Keep reaching 100% of your day target.', 'على المسار. حافظ على ١٠٠٪ من هدف اليوم.'),
    ME_UPS_COUNT: E('Upsells sold: {n}', 'البيع الإضافي المباع: {n}'),
    ME_LOST_ACTIVE: E('Stores invoiced: Behind', 'المحلات المفوترة: متأخر'),
    RE_COUNTS: E('Counts toward your {kpi} target', 'يُحسب ضمن هدف {kpi}'),
  });

  const KEYS = ['cake', 'grocery', 'active', 'collect'];
  FD.INC_MEASURES = ['INC_M_UPSELL', 'INC_M_VISITS', 'INC_M_WITHSALE', 'INC_M_RETURNS', 'INC_M_PLAN'];
  const bucketOf = code => (FD.sku(code) || {}).category === 'other' ? 'grocery' : 'cake';
  const kpi = (st, vsrId, d) => FD.cached('kpiS', st, vsrId + d, () => FD.kpiStatus(st, vsrId, d));
  // bonus change on one sales bucket when `extra` SAR of sales is added to its month-end pace
  const bonusDelta = (part, k, extra) => part.goal ? FD.BONUS[k] * (FD.payoutPct(part.projAch + 100 * extra / part.goal) - FD.payoutPct(part.projAch)) / 100 : 0;
  FD.bonusDelta = bonusDelta;
  const saleValue = rec => (rec.qtyModified ?? rec.qty) * FD.sku(rec.sku).cost; // ex-VAT, like the sales KPIs

  // what selling this recommendation adds: SAR to its sales KPI, and bonus at this month's pace
  FD.recEarn = function (st, rec, d) {
    const vsr = FD.recVsr(rec), p = kpi(st, vsr, d), k = bucketOf(rec.sku), value = saleValue(rec);
    return { k, value, bonus: Math.max(0, bonusDelta(p.parts[k], k, value)) };
  };
  // history at this store, chance of sale (this product's past offers, else the type's prior), returns rate of the product
  FD.recChances = function (st, rec, d) {
    return FD.cached('recCh', st, rec.id + d, () => {
      const from = FD.addDays(d, -90), mine = st.orders.filter(o => o.store === rec.store && o.sku === rec.sku && o.units > 0 && o.date >= from && o.date < d);
      const days = [...new Set(mine.map(o => o.date))].sort();
      const past = st.recs.filter(r => r.sku === rec.sku && r.date < d && ['FULL', 'PARTIAL', 'ALT', 'NOT_SOLD'].includes(r.outcome));
      const sold = past.filter(r => FD.SOLD.includes(r.outcome)).length;
      const sale = past.length >= 10 ? sold / past.length : FD.PRIOR[rec.type] || 0.3; // ponytail: own history once 10 offers exist; model team replaces this
      const out = st.orders.filter(o => o.sku === rec.sku && o.date >= from && o.date < d).reduce((a, o) => a + o.units, 0);
      const back = st.returns.filter(x => x.sku === rec.sku && x.date >= from && x.date < d && !FD.goodReturn(x)).reduce((a, x) => a + Math.abs(x.units || 0), 0);
      return { n: days.length, last: days[days.length - 1] || null, sale: Math.round(100 * sale), ret: out ? Math.round(100 * back / out) : 0 };
    });
  };
  // all of today's open offers sold: sales added and bonus gained (buckets added up before the tiers apply)
  FD.todayEarn = function (st, vsrId, d) {
    const open = st.recs.filter(r => r.date === d && r.outcome === null && FD.recVsr(r) === vsrId);
    const add = { cake: 0, grocery: 0 }; for (const r of open) add[bucketOf(r.sku)] += saleValue(r);
    const p = kpi(st, vsrId, d);
    return { n: open.length, value: add.cake + add.grocery, bonus: Math.max(0, bonusDelta(p.parts.cake, 'cake', add.cake)) + Math.max(0, bonusDelta(p.parts.grocery, 'grocery', add.grocery)) };
  };

  // consequences this month: plan visits missed and visits without a sale, as counts; no SAR estimate
  FD.lostThisMonth = function (st, vsrId, d) {
    return FD.cached('lost', st, vsrId + d, () => {
      const m0 = d.slice(0, 8) + '01';
      const sold = new Set(st.orders.filter(o => o.vsr === vsrId && o.value > 0 && o.date >= m0 && o.date < d).map(o => o.store + '|' + o.date));
      const rows = [];
      for (const v of st.visits) {
        if (v.vsr !== vsrId || v.offPlan || v.date < m0 || v.date >= d) continue;
        const kind = v.status === 'MISSED' ? 'MISSED' : v.status === 'DONE' && !sold.has(v.store + '|' + v.date) ? 'NOSALE' : null;
        if (kind) rows.push({ kind, store: v.store, date: v.date });
      }
      const count = k => rows.filter(r => r.kind === k).length;
      return { rows: rows.sort((a, b) => b.date.localeCompare(a.date)), missed: count('MISSED'), noSale: count('NOSALE'),
        storesAtRisk: kpi(st, vsrId, d).parts.active.status === 'AT_RISK' ? FD.BONUS.active : 0 };
    });
  };

  // the bonus plan from Americana's worked example (FD.BONUS / FD.KPI_RULE); view-only
  FD.incentivePlan = () => KEYS.map(k => ({ k, name: 'KPI_' + k.toUpperCase(), rule: 'INC_R_' + k.toUpperCase(), amount: FD.BONUS[k],
    pct: Math.round(100 * { cake: FD.KPI_RULE.cakeShare, grocery: 1 - FD.KPI_RULE.cakeShare, active: FD.KPI_RULE.activePct, collect: FD.KPI_RULE.overdueMax }[k]) }));

})();
