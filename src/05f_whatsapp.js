(function () {
  // Store owner WhatsApp: business cards (approved templates with reply buttons). Every tap is a fact with one fixed rule;
  // the replies are kept as a list (FD.waReplies) for later suggested alerts and model training.
  const FD = globalThis.FD, E = (en, ar) => ({ en, ar });
  Object.assign(FD.CATALOG, {
    W_WA: E('WhatsApp', 'واتساب'), W_AMERICANA: E('Americana', 'أمريكانا'), W_SIGN: E('Sign with my name', 'التوقيع باسمي'),
    W_SEND_CARD: E('Send card', 'إرسال بطاقة'), W_AWAITING: E('No reply yet', 'لا رد بعد'), W_OWNER_TAPPED: E('Owner tapped', 'اختار صاحب المحل'),
    W_INTERNAL: E('Internal chat', 'محادثة داخلية'), W_F_VSRS: E('Salesmen', 'المندوبون'),
    W_NEXT_VISIT: E('Next visit {date} · stop {n}', 'الزيارة القادمة {date} · المحطة {n}'), W_NO_VISIT: E('No visit in the next 7 days', 'لا زيارة خلال 7 أيام'),
    W_BALANCE: E('Open balance {money}', 'رصيد مستحق {money}'), W_TELL: E('Tell {vsr}', 'أبلغ {vsr}'),
    // cards: what the owner reads
    W_CARD_VISIT: E('Visit notice', 'إشعار زيارة'), W_C_VISIT: E('Your Americana salesman {vsr} visits on {date}, around {time}. He will carry your usual items.', 'مندوب أمريكانا {vsr} سيزورك يوم {date} حوالي {time}، ومعه منتجاتك المعتادة.'),
    W_CARD_NEWPROD: E('New product', 'منتج جديد'), W_C_NEWPROD: E('New from Americana: {sku}. Shops near you sell about {n} a week.', 'جديد من أمريكانا: {sku}. المحلات القريبة منك تبيع حوالي {n} أسبوعياً.'),
    W_CARD_BALANCE: E('Balance reminder', 'تذكير بالرصيد'), W_C_BALANCE: E('Your open balance with Americana is {money}.', 'رصيدك المفتوح لدى أمريكانا {money}.'),
    W_CARD_EXPIRY: E('Expiry check', 'فحص الصلاحية'), W_C_EXPIRY: E('Any of our items close to expiry on your shelf?', 'هل لديك منتجات منا قريبة من انتهاء الصلاحية؟'),
    W_CARD_RATING: E('Visit rating', 'تقييم الزيارة'), W_C_RATING: E('How was the visit by {vsr}?', 'كيف كانت زيارة {vsr}؟'),
    // reply buttons
    W_R_CONFIRM: E('See you then', 'أراك حينها'), W_R_CHANGE: E('See or change items', 'عرض أو تعديل المنتجات'), W_R_NOT: E('Not that day', 'ليس ذلك اليوم'),
    W_S_STOCK: E('I still have enough stock', 'لدي مخزون كافٍ'), W_S_CLOSED: E('Shop closed that day', 'المحل مغلق ذلك اليوم'), W_S_DAY: E('Come another day', 'تعال في يوم آخر'),
    W_R_ADD: E('Add to my order', 'أضف إلى طلبي'), W_R_NOTNOW: E('Not now', 'ليس الآن'),
    W_R_PAYVISIT: E('Pay on visit', 'الدفع عند الزيارة'), W_R_PAID: E('Already paid', 'تم الدفع'),
    W_R_NO: E('No', 'لا'), W_R_YES: E('Yes, some items', 'نعم، بعض المنتجات'),
    W_R_GOOD: E('Good', 'جيدة'), W_R_FAIR: E('OK', 'مقبولة'), W_R_POOR: E('Poor', 'سيئة'),
    // what each reply does (internal; the owner never sees these)
    W_E_CONFIRM: E('Stop shows "Owner confirmed"', 'تظهر المحطة "أكد صاحب المحل"'), W_E_CHANGE: E('Pre-order added to the visit', 'تمت إضافة طلب مسبق للزيارة'),
    W_E_NOT: E('Plan check: remove or move the visit', 'فحص الخطة: إزالة الزيارة أو نقلها'), W_E_ADD: E('Stop shows "Owner wants to try it"', 'تظهر المحطة "يريد التجربة"'),
    W_E_NOTNOW: E('Recorded, no action', 'تم التسجيل، دون إجراء'), W_E_PAYVISIT: E('Collection task on the next visit', 'مهمة تحصيل في الزيارة القادمة'),
    W_E_PAID: E('Follow-up: check the payment', 'متابعة: التحقق من الدفع'), W_E_NO: E('Recorded, no action', 'تم التسجيل، دون إجراء'),
    W_E_YES: E('Recorded for the supervisor to review', 'تم التسجيل لمراجعة المشرف'), W_E_RATED: E('Added to the salesman\'s visit ratings', 'أضيفت إلى تقييمات زيارات المندوب'),
    W_E_POOR: E('Follow-up: review the visit with the salesman', 'متابعة: مراجعة الزيارة مع المندوب'),
    // chips on the stop
    W_F_CONFIRMED: E('Owner confirmed', 'أكد صاحب المحل'), W_F_ITEMS: E('Owner set items', 'حدد صاحب المحل المنتجات'), W_F_NOT: E('Owner: not that day', 'صاحب المحل: ليس ذلك اليوم'),
    W_F_PAYVISIT: E('Collect payment', 'تحصيل الدفعة'), W_F_TRIAL: E('Owner wants to try {sku}', 'يريد صاحب المحل تجربة {sku}'),
    // plan check and follow-ups
    X_OWNER_NOT: E('Owner replied "Not that day": {reason}', 'رد صاحب المحل "ليس ذلك اليوم": {reason}'),
    X_OWNER_NOT_G: E('{n} owners replied "Not that day"', '{n} من أصحاب المحلات ردوا "ليس ذلك اليوم"'), X_OWNER_NOT_G1: E('An owner replied "Not that day"', 'رد صاحب محل "ليس ذلك اليوم"'), CAT_X_OWNER_NOT: E('Owner: not that day', 'صاحب المحل: ليس ذلك اليوم'),
    F_WA_PAID: E('{store} says the balance is already paid', '{store} يقول إن الرصيد مدفوع'), F_WA_PAID_C: E('Check the payment before the next visit', 'تحقق من الدفع قبل الزيارة القادمة'),
    F_WA_POOR: E('{store} rated the visit by {vsr} as poor', '{store} قيّم زيارة {vsr} بأنها سيئة'), F_WA_POOR_C: E('Review the visit with the salesman', 'راجع الزيارة مع المندوب'),
    CAT_F_WA_PAID: E('Payment claims', 'إفادات الدفع'), CAT_F_WA_POOR: E('Poor visit ratings', 'تقييمات زيارة سيئة'),
    ACT_OPEN_CHAT: E('Open chat', 'فتح المحادثة'),
    // tips in the salesman's chat
    W_TIP: E('Tip', 'نصيحة'), W_TIP_SENT: E('Sent {time}', 'أُرسلت {time}'), W_TIP_SEEN: E('Seen', 'شوهدت'), W_TIP_GOT: E('Got it', 'فهمت'),
    W_TIP_OUT: E('After the tip: offered at {n} stores, sold at {m}', 'بعد النصيحة: عُرض في {n} محلات، وبيع في {m}'),
    W_RULES: E('WhatsApp cards', 'بطاقات واتساب'), W_RULES_D: E('What store owners receive, the buttons they can tap, and what each reply does.', 'ما يصل لأصحاب المحلات، والأزرار المتاحة، وما يحدث عند كل رد.'),
    W_COL_CARD: E('Card', 'البطاقة'), W_COL_REPLY: E('Reply', 'الرد'), W_COL_DOES: E('What it does', 'ما يحدث'),
  });

  // card -> reply buttons; a reply with sub-options opens a short list on the owner's phone
  FD.WA_CARDS = {
    VISIT: { replies: ['W_R_CONFIRM', 'W_R_CHANGE', 'W_R_NOT'], subs: { W_R_NOT: ['W_S_STOCK', 'W_S_CLOSED', 'W_S_DAY'] } },
    NEWPROD: { replies: ['W_R_ADD', 'W_R_NOTNOW'] },
    BALANCE: { replies: ['W_R_PAYVISIT', 'W_R_PAID'] },
    EXPIRY: { replies: ['W_R_NO', 'W_R_YES'] },
    RATING: { replies: ['W_R_GOOD', 'W_R_FAIR', 'W_R_POOR'] },
  };
  FD.WA_EFFECT = { W_R_CONFIRM: 'W_E_CONFIRM', W_R_CHANGE: 'W_E_CHANGE', W_R_NOT: 'W_E_NOT', W_R_ADD: 'W_E_ADD', W_R_NOTNOW: 'W_E_NOTNOW', W_R_PAYVISIT: 'W_E_PAYVISIT',
    W_R_PAID: 'W_E_PAID', W_R_NO: 'W_E_NO', W_R_YES: 'W_E_YES', W_R_GOOD: 'W_E_RATED', W_R_FAIR: 'W_E_RATED', W_R_POOR: 'W_E_POOR' };

  const stamp = at => at.date + ' ' + at.time;
  const cards = st => (st.ownerMsgs || []).filter(m => m.kind === 'CARD');
  // card slots are stored raw; money is formatted when shown so it follows the language
  FD.waCardText = m => FD.tx('W_C_' + m.card, Object.assign({}, m.slots, m.slots && m.slots.money != null ? { money: FD.fmt.money0(m.slots.money) } : null));
  FD.waReplyText = r => FD.t(r.choice) + (r.sub ? ' · ' + FD.t(r.sub) : '');
  // one row per reply: the base for suggested alerts and model training
  FD.waReplies = st => cards(st).filter(m => m.reply).map(m => ({ id: m.id, store: m.store, card: m.card, choice: m.reply.choice, sub: m.reply.sub || null, sentAt: m.at, at: m.reply.at, slots: m.slots }));
  FD.waLastAt = (st, store) => FD.ownerThread(st, store).reduce((a, m) => { const s = stamp(m.reply ? m.reply.at : m.at), s0 = stamp(m.at); return [a, s, s0].sort().pop(); }, '');
  FD.ownerUnreadN = (st, store, who) => Math.max(0, FD.ownerEvents(st, store) - ((st.ownerSeen || {})[who + '|' + store] || 0));
  FD.ownerUnread = (st, store, who) => FD.ownerUnreadN(st, store, who) > 0;
  // WhatsApp mark (Simple Icons, CC0) in place of the word; the hover says what the thread is
  FD.waLogo = (cls = 's16') => { const NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path'), ti = document.createElementNS(NS, 'title');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'wa-logo ' + cls); s.setAttribute('role', 'img'); s.setAttribute('aria-label', FD.t('W_WA'));
    ti.textContent = FD.t('W_WA'); p.setAttribute('d', 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z');
    s.append(ti, p); return s; };
  // unread count bubble shared by chat lists
  FD.unreadN = n => n ? FD.h('span', { class: 'unread-n', 'aria-label': FD.fmt.num(n) + ' ' + FD.t('L_UNREAD') }, FD.fmt.num(n)) : null;
  FD.waSign = (st, who) => (who === 'SUP' ? FD.nameOf(st.world.supervisor) : FD.nameOf(st.world.vsrs.find(v => v.id === who))) + ' · ' + FD.t('W_AMERICANA');

  // the visit-notice reply for one store and day
  FD.waVisitReply = (st, store, iso) => { const m = cards(st).filter(x => x.card === 'VISIT' && x.store === store && x.slots.date === iso && x.reply).pop(); return m ? m.reply : null; };
  // chips for a stop on a day: the visit reply, plus pay / swap / trial replies from the last 7 days
  FD.waStopFacts = (st, store, iso) => {
    const out = []; const v = FD.waVisitReply(st, store, iso);
    if (v) out.push(v.choice === 'W_R_CONFIRM' ? ['W_F_CONFIRMED', 'good'] : v.choice === 'W_R_CHANGE' ? ['W_F_ITEMS', 'info'] : ['W_F_NOT', 'bad']);
    const recent = cards(st).filter(m => m.store === store && m.reply && m.reply.at.date <= iso && FD.daysBetween(m.reply.at.date, iso) <= 7);
    if (recent.some(m => m.reply.choice === 'W_R_PAYVISIT')) out.push(['W_F_PAYVISIT', 'warn']);
    const trial = recent.find(m => m.reply.choice === 'W_R_ADD'); if (trial) out.push(['W_F_TRIAL', 'info', { skuCode: trial.slots.skuCode }]);
    return out.map(([id, tone, slots]) => ({ text: FD.tx(id, slots || {}), tone }));
  };
  // small inline facts (logo + text), lighter than chips so they sit next to the stop's status
  FD.waChips = (st, store, iso) => FD.waStopFacts(st, store, iso).map(x => FD.h('span', { class: 'wa-fact ' + x.tone }, FD.waLogo('s14'), x.text));

  // replies that need the supervisor become follow-ups (last 3 days)
  const FU = { W_R_PAID: ['F_WA_PAID', 2], W_R_POOR: ['F_WA_POOR', 2] };
  FD.waFollowUps = st => FD.waReplies(st).filter(r => FU[r.choice] && FD.daysBetween(r.at.date, st.clock.date) <= 3 && r.at.date <= st.clock.date).map(r => {
    const s = st.world.stores.find(x => x.id === r.store); const [tpl, pri] = FU[r.choice];
    return { key: tpl + '|' + r.id, tpl, pri, at: r.at.date, slots: { storeId: r.store, vsrId: (r.slots && r.slots.vsrId) || (s && s.vsr) }, action: { label: 'ACT_OPEN_CHAT', kind: 'wa', store: r.store } };
  });

  // a tip's result: this salesman's offers after the tip (same product when the tip names one)
  FD.tipOutcome = (st, tip) => { const sku = tip.slots && tip.slots.skuCode; const after = stamp(tip.sentAt);
    const rs = st.recs.filter(r => FD.recVsr(r) === tip.vsr && r.date >= tip.sentAt.date && (!sku || r.sku === sku) && (FD.SOLD.includes(r.outcome) || r.outcome === 'NOT_SOLD') && (!r.at || stamp(r.at) >= after));
    return { offered: new Set(rs.map(r => r.store)).size, sold: new Set(rs.filter(r => FD.SOLD.includes(r.outcome)).map(r => r.store)).size }; };

  // Messages badge also counts store chats with an unread owner message
  const base = FD.supervisorBadgeCounts;
  FD.supervisorBadgeCounts = (st, ids) => { const c = base(st, ids); const scope = new Set(ids || st.world.vsrs.map(v => v.id));
    c.msgs += [...new Set((st.ownerMsgs || []).map(m => m.store))].filter(id => { const s = st.world.stores.find(x => x.id === id); return s && scope.has(s.vsr) && FD.ownerUnread(st, id, 'SUP'); }).length;
    return c; };
})();
