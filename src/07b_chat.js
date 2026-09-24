(function () {
  // Chat: one conversation per salesman with the supervisor, plus one Whole team group.
  // Messages carry tags (store from SalesBuzz location or the screen it was sent from, product for a recommendation),
  // so the supervisor filters inside a conversation instead of juggling one thread per store.
  const FD = globalThis.FD;
  if (typeof document === 'undefined') return;
  const h = FD.h, I = FD.icon, t = (...a) => FD.t(...a);
  const st = () => FD.state;
  const C = FD.chat = { drafts: {}, scroll: {}, stick: {}, q: {}, divider: {}, cache: {}, reading: {}, typing: null, active: {}, f: {}, ctx: {}, showF: {} };
  const MAX_FILES = 5, MAX_BYTES = 2 * 1024 * 1024;

  // ---------- attachments live in IndexedDB so the event log stays small (memory fallback for this session) ----------
  let dbp = null; const mem = {};
  const db = () => dbp || (dbp = new Promise(res => { try { const r = indexedDB.open('fielddrive-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }));
  FD.filePut = async (id, data) => { C.cache[id] = mem[id] = data; const d = await db(); if (!d) return;
    await new Promise(r => { try { const x = d.transaction('f', 'readwrite'); x.objectStore('f').put(data, id); x.oncomplete = x.onerror = x.onabort = r; } catch (e) { r(); } }); };
  FD.fileGet = async id => { if (C.cache[id]) return C.cache[id]; const d = await db(); if (!d) return mem[id] || null;
    return new Promise(r => { try { const q = d.transaction('f').objectStore('f').get(id); q.onsuccess = () => r(C.cache[id] = q.result || mem[id] || null); q.onerror = () => r(mem[id] || null); } catch (e) { r(mem[id] || null); } }); };
  const readData = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
  const fmtSize = n => n < 1048576 ? FD.fmt.num(Math.max(1, Math.round(n / 1024))) + ' KB' : FD.fmt.num(n / 1048576, 1) + ' MB';

  // ---------- thread helpers ----------
  FD.chatKey = a => a.type + '~' + a.id;
  FD.chatAnchor = k => { const i = (k || '').indexOf('~'); return i < 1 ? null : { type: k.slice(0, i), id: k.slice(i + 1) }; };
  const findTh = a => st().threads.find(x => x.anchor.type === a.type && x.anchor.id === a.id);
  FD.chatFind = findTh;
  const stamp = at => at.date + ' ' + at.time;
  const storeOf = id => st().world.stores.find(x => x.id === id);
  const nameBy = by => by === 'SUP' ? FD.nameOf(st().world.supervisor) : FD.nameOf(st().world.vsrs.find(v => v.id === by));
  const isMine = (m, who, vsr) => who === 'SUP' ? m.by === 'SUP' : m.by === vsr;
  FD.chatUnread = (th, who, vsr) => who === 'SUP' ? !!th.unreadSup : th.team ? !!(th.unreadVsrs || {})[vsr] : !!th.unreadVsr;
  const seenAt = (th, who, vsr) => (who === 'SUP' ? th.seenSup : th.team ? (th.seenVsrs || {})[vsr] : th.seenVsr) || '';
  FD.chatSnippet = (m, who, vsr) => (isMine(m, who, vsr) ? t('L_YOU') + ': ' : '') + (m.text || ((m.files || []).length || m.photo ? t('L_ATTACHMENT') : ''));
  FD.chatTitle = (a, who) => a.type === 'team' ? t('L_WHOLE_TEAM') : who === 'SUP' ? nameBy(a.id) : FD.nameOf(st().world.supervisor);
  FD.chatSub = (a, who) => a.type === 'team' ? t('L_TEAM_SUB', { n: FD.fmt.num(st().world.vsrs.length) }) : who === 'SUP' ? FD.nameOf(st().world.routes.find(r => r.id === (st().world.vsrs.find(v => v.id === a.id) || {}).route)) : t('L_SUPERVISOR');
  FD.chatIcon = a => a.type === 'team' ? 'megaphone' : 'user';

  // where a Message button points: the salesman's conversation, pre-filtered and pre-tagged with its store / product
  FD.chatResolve = (a, who) => { const s = st(); const me = s.vsrId;
    if (a.type === 'team') return { th: a, filter: null, tag: null };
    if (a.type === 'vsr') return { th: who === 'SUP' ? a : { type: 'vsr', id: me }, filter: null, tag: null };
    if (a.type === 'rec') { const r = s.recs.find(x => x.id === a.id); if (!r) return null; return { th: { type: 'vsr', id: who === 'SUP' ? FD.recVsr(r) : me }, filter: { store: r.store }, tag: { store: r.store, rec: r.id, sku: r.sku } }; }
    if (a.type === 'store') { const x = storeOf(a.id); if (!x) return null; return { th: { type: 'vsr', id: who === 'SUP' ? (FD.routeOwner(s, x.route, s.clock.date) || x.vsr) : me }, filter: { store: x.id }, tag: { store: x.id } }; }
    return null; };
  const fullHash = (a, who) => who === 'SUP' ? '#/sup/msgs/' + encodeURIComponent(FD.chatKey(a)) : '#/vsr/' + st().vsrId + '/msgs/' + encodeURIComponent(FD.chatKey(a));
  // open the full conversation; any filter / tag travels with it
  FD.chatOpen = (a, who, filter, tag) => { const k = FD.chatKey(a); C.f[k] = filter ? Object.assign({}, filter) : {}; C.ctx[k] = tag || null; FD.go(fullHash(a, who)); };
  FD.chatSearchToggle = a => { const slot = FD.chatKey(a) + '|full'; C.q[slot] = C.q[slot] == null ? '' : null; FD.render(); };
  FD.chatFilterToggle = a => { const k = FD.chatKey(a); C.showF[k] = !C.showF[k]; FD.render(); };
  // store the salesman is standing in right now (SalesBuzz arrival)
  const hereStore = vsr => { const s = st(); const v = s.visits.find(x => x.date === s.clock.date && x.vsr === vsr && x.status === 'ARRIVED'); return v ? v.store : null; };

  const dayLabel = d => { const today = st().clock.date; return d === today ? t('L_P_TODAY') : d === FD.addDays(today, -1) ? t('L_YESTERDAY') : FD.fmt.dateLong(d); };
  const mark = (text, q) => { if (!q) return text; const out = []; const low = text.toLowerCase(); let i = 0, j;
    while ((j = low.indexOf(q, i)) >= 0) { out.push(text.slice(i, j), h('mark', null, text.slice(j, j + q.length))); i = j + q.length; } out.push(text.slice(i)); return out; };
  function fileNode(f) {
    if (f.kind === 'img') { const img = h('img', { alt: f.name, class: 'chat-img', on: { click: async () => { const d = await FD.fileGet(f.id); if (d) FD.lightbox(d); } } });
      FD.fileGet(f.id).then(d => { if (d) img.src = d; else img.replaceWith(h('span', { class: 'chat-file gone' }, I('image', 's16'), t('L_FILE_GONE'))); }); return img; }
    return h('a', { class: 'chat-file', href: '#', title: f.name, on: { click: async e => { e.preventDefault(); const d = await FD.fileGet(f.id); if (!d) return FD.toast(null, null, { text: t('L_FILE_GONE') });
        const l = h('a', { href: d, download: f.name }); document.body.appendChild(l); l.click(); l.remove(); } } },
      h('span', { class: 'chat-file-ic' }, I('file', 's16')), h('span', { class: 'grow', style: { minWidth: 0 } }, h('span', { class: 'ellipsis', style: { display: 'block' } }, f.name),
        h('span', { class: 'small muted' }, fmtSize(f.size) + ' · ' + (f.name.split('.').pop() || '').toUpperCase())), I('download', 's16'));
  }
  // filters live inside the conversation
  const hasFiles = m => (m.files || []).length > 0 || !!m.photo;
  const passes = (m, F) => { if (!F) return true; const x = m.store && storeOf(m.store);
    if (F.store && m.store !== F.store) return false;
    if (F.label && (!x || x.label !== F.label)) return false;
    if (F.tag && (!x || !x.tags.includes(F.tag))) return false;
    if (F.topic && m.topic !== F.topic) return false;
    if (F.files && !hasFiles(m)) return false; return true; };
  const activeF = F => F ? Object.keys(F).filter(k => F[k]) : [];

  // ---------- the conversation ----------
  FD.chatView = function (anchor, who, opts = {}) {
    const s = st(); const key = FD.chatKey(anchor); const vsr = who === 'SUP' ? null : (opts.vsr || s.vsrId);
    const mode = opts.mode || 'full'; const slot = key + '|' + mode;
    const th = findTh(anchor);
    const F = C.f[key] = C.f[key] || {};
    const D = C.drafts[key] = C.drafts[key] || { text: '', files: [], replyTo: null, topic: null, untag: false };
    const rerender = opts.rerender || (() => FD.render());
    if (C.active[mode] !== key) { C.active[mode] = key; C.stick[slot] = true; delete C.scroll[slot]; C.divider[slot] = th && FD.chatUnread(th, who, vsr) ? seenAt(th, who, vsr) : null; C.first = slot; }
    if (th && FD.chatUnread(th, who, vsr) && !C.reading[th.id]) { C.reading[th.id] = true; setTimeout(() => { C.reading[th.id] = false; const x = findTh(anchor); if (x && FD.chatUnread(x, who, vsr)) FD.dx('THREAD_READ', { thread: x.id, who, vsr }); }, 700); }
    const q = (C.q[slot] || '').trim().toLowerCase(); const searching = C.q[slot] != null;
    const msgs = th ? th.messages : [];
    const nF = activeF(F).length;

    // header: one line only (the phone app bar and the popup already carry the name)
    const searchBtn = FD.iconBtn('search', t('L_SEARCH_CHAT'), () => { C.q[slot] = searching ? null : ''; rerender(); });
    const filterBtn = FD.iconBtn('filter', t('L_FILTERS'), () => { C.showF[key] = !C.showF[key]; rerender(); }, nF ? FD.fmt.num(nF) : null);
    const header = opts.header === false ? null : h('div', { class: 'chat-h' },
      opts.onBack ? h('span', { class: 'chat-back' }, FD.iconBtn('arrow-left', t('L_BACK'), opts.onBack)) : null,
      anchor.type === 'vsr' && who === 'SUP' ? FD.avatar(s.world.vsrs.find(v => v.id === anchor.id)) : h('span', { class: 'chat-av' }, I(FD.chatIcon(anchor), 's16')),
      h('div', { class: 'grow', style: { minWidth: 0 } }, h('b', { class: 'ellipsis', style: { display: 'block' } }, FD.chatTitle(anchor, who)), h('span', { class: 'small muted ellipsis', style: { display: 'block' } }, FD.chatSub(anchor, who))),
      mode === 'full' ? searchBtn : null, mode === 'full' ? filterBtn : null,
      opts.onMin ? FD.iconBtn('minus', t('L_MINIMISE'), opts.onMin) : null,
      opts.onExpand ? FD.iconBtn('maximize', t('L_OPEN_FULL'), opts.onExpand) : null,
      opts.onClose ? FD.iconBtn('x', t('L_CLOSE'), opts.onClose) : null);
    const hitsAll = msgs.filter(m => passes(m, F) && (!q || (m.text || '').toLowerCase().includes(q)));
    const searchBar = searching ? h('div', { class: 'chat-search' }, FD.searchBox('chat-' + slot, t('L_SEARCH_CHAT'), C.q[slot], v => { C.q[slot] = v; rerender(); }),
      q ? h('span', { class: 'small muted nowrap' }, t('L_N_MATCHES', { n: FD.fmt.num(hitsAll.length) })) : null, FD.iconBtn('x', t('L_CLOSE'), () => { C.q[slot] = null; rerender(); })) : null;

    // filter panel + active filter chips
    const setF = (k, v) => { F[k] = v || null; C.stick[slot] = true; rerender(); };
    const usedStores = [...new Set(msgs.map(m => m.store).filter(Boolean))].map(storeOf).filter(Boolean).sort((a, b) => FD.nameOf(a).localeCompare(FD.nameOf(b)));
    if (F.store && !usedStores.some(x => x.id === F.store) && storeOf(F.store)) usedStores.unshift(storeOf(F.store));
    const panel = mode === 'full' && C.showF[key] ? h('div', { class: 'chat-fpanel' },
      FD.select([{ id: '', label: t('L_ALL_STORES_F') }].concat(usedStores.map(x => ({ id: x.id, label: FD.nameOf(x) }))), F.store || '', v => setF('store', v)),
      FD.select([{ id: '', label: t('L_ALL_LABELS') }].concat(FD.LABELS.map(x => ({ id: x, label: t('LBL_' + x) }))), F.label || '', v => setF('label', v)),
      FD.select([{ id: '', label: t('L_ALL_TAGS') }].concat(FD.TAGS.map(x => ({ id: x, label: t('TAGN_' + x.slice(4)) }))), F.tag || '', v => setF('tag', v)),
      FD.select([{ id: '', label: t('L_ALL_TOPICS') }].concat(['R_T_RETURN', 'R_T_REQUEST', 'R_T_PRICE', 'R_T_ACCESS', 'R_T_OTHER'].map(x => ({ id: x, label: t(x) }))), F.topic || '', v => setF('topic', v)),
      h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!F.files, on: { change: e => setF('files', e.target.checked) } }), t('L_HAS_FILES'))) : null;
    const chipOf = k => ({ store: () => FD.nameOf(storeOf(F.store)), label: () => t('LBL_' + F.label), tag: () => t('TAGN_' + F.tag.slice(4)), topic: () => t(F.topic), files: () => t('L_HAS_FILES') })[k]();
    const chips = nF ? h('div', { class: 'chat-fchips' }, h('span', { class: 'small muted' }, t('L_SHOWING')), activeF(F).map(k => h('button', { type: 'button', class: 'chip info chip-btn', on: { click: () => setF(k, null) } }, chipOf(k), I('x', 's14'))),
      nF > 1 ? h('button', { type: 'button', class: 'btn ghost sm', on: { click: () => { C.f[key] = {}; rerender(); } } }, t('L_CLEAR_ALL')) : null) : null;

    // messages
    const filtered = msgs.filter(m => passes(m, F) && (!q || (m.text || '').toLowerCase().includes(q)));
    const shown = opts.last && !q ? filtered.slice(-opts.last) : filtered;
    const list = h('div', { class: 'chat-msgs', role: 'log', 'aria-live': 'polite', on: { scroll: e => { const el = e.currentTarget; C.scroll[slot] = el.scrollTop; C.stick[slot] = el.scrollHeight - el.scrollTop - el.clientHeight < 40; } } });
    const nodes = [];
    if (opts.last && !q && filtered.length > opts.last) nodes.push(h('button', { type: 'button', class: 'chat-earlier', on: { click: opts.onExpand || (() => FD.chatOpen(anchor, who, F)) } }, t('L_EARLIER', { n: FD.fmt.num(filtered.length - opts.last) })));
    let lastDay = null, divDone = false;
    const jump = id => { const el = list.querySelector('#m-' + id); if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); };
    const tagLine = m => (m.store || m.sku) ? h('button', { type: 'button', class: 'msg-tag', title: t('L_FILTER_STORE'), on: { click: () => { if (m.store) setF('store', m.store); } } },
      I('map-pin', 's14'), h('span', { class: 'ellipsis' }, [m.store ? FD.nameOf(storeOf(m.store)) : null, m.sku ? FD.nameOf(FD.sku(m.sku)) : null].filter(Boolean).join(' · '))) : null;
    for (const m of shown) {
      if (m.at.date !== lastDay) { lastDay = m.at.date; nodes.push(h('div', { class: 'chat-day' }, h('span', null, dayLabel(m.at.date)))); }
      const mine = isMine(m, who, vsr);
      if (!divDone && !q && C.divider[slot] != null && stamp(m.at) > C.divider[slot] && !mine) { divDone = true; nodes.push(h('div', { class: 'chat-new' }, h('span', null, t('L_NEW_MSGS')))); }
      if (m.system) { nodes.push(h('div', { class: 'msg sys', id: 'm-' + (m.id || '') }, h('div', { class: 'bubble sys' }, tagLine(m), h('b', null, t('L_REASON_IS', { reason: t(m.reason) })), m.text ? h('div', { dir: 'auto' }, mark(m.text, q)) : null,
        m.photo ? h('img', { src: m.photo, alt: '', on: { click: () => FD.lightbox(m.photo) } }) : null, h('div', { class: 'msg-meta' }, h('time', null, nameBy(m.by) + ' · ' + FD.fmt.time(m.at.time)))))); continue; }
      const photos = (m.photos || []).concat(m.photo ? [m.photo] : []); const files = m.files || [];
      const quoted = m.replyTo && msgs.find(x => x.id === m.replyTo);
      const seen = mine && (th.team && who === 'SUP' ? s.world.vsrs.every(v => ((th.seenVsrs || {})[v.id] || '') >= stamp(m.at)) : (who === 'SUP' ? (th.seenVsr || '') : (th.seenSup || '')) >= stamp(m.at));
      const showBy = !mine && th.team;
      nodes.push(h('div', { class: 'msg ' + (mine ? 'me' : 'them'), id: 'm-' + (m.id || '') },
        h('div', { class: 'bubble ' + (mine ? 'me' : 'them') },
          showBy ? h('div', { class: 'msg-by' }, nameBy(m.by)) : null,
          tagLine(m),
          m.topic ? h('div', { class: 'msg-topic' }, t(m.topic)) : null,
          quoted ? h('button', { type: 'button', class: 'msg-quote', on: { click: () => jump(quoted.id) } }, h('b', null, isMine(quoted, who, vsr) ? t('L_YOU') : nameBy(quoted.by)), h('span', { class: 'ellipsis', dir: 'auto' }, quoted.text || t('L_ATTACHMENT'))) : null,
          m.text ? h('div', { class: 'msg-text', dir: 'auto' }, mark(m.text, q)) : null,
          photos.length || files.some(f => f.kind === 'img') ? h('div', { class: 'msg-photos' }, photos.map(p => h('img', { src: p, alt: '', class: 'chat-img', on: { click: () => FD.lightbox(p) } })), files.filter(f => f.kind === 'img').map(fileNode)) : null,
          files.filter(f => f.kind !== 'img').map(fileNode),
          h('div', { class: 'msg-meta' }, h('time', null, FD.fmt.time(m.at.time)), mine ? h('span', { class: 'tick' + (seen ? ' seen' : ''), title: t(seen ? 'L_SEEN' : 'L_SENT'), 'aria-label': t(seen ? 'L_SEEN' : 'L_SENT') }, I(seen ? 'check-check' : 'check', 's14')) : null)),
        m.id && mode !== 'popup' ? h('button', { type: 'button', class: 'msg-reply', 'aria-label': t('L_REPLY'), title: t('L_REPLY'), on: { click: () => { D.replyTo = m.id; C.typing = key; rerender(); } } }, I('reply', 's14')) : null));
    }
    if (!msgs.length) nodes.push(h('div', { class: 'chat-empty' }, FD.empty('X_THREAD', null, 'message')));
    else if (!shown.length) nodes.push(h('div', { class: 'chat-empty' }, FD.empty('X_FILTER')));
    list.append(...nodes);
    const firstOpen = C.first === slot; C.first = null;
    requestAnimationFrame(() => { if (!list.isConnected) return;
      const nw = list.querySelector('.chat-new');
      if (firstOpen && nw) nw.scrollIntoView({ block: 'start' });
      else if (C.stick[slot] !== false) list.scrollTop = list.scrollHeight;
      else list.scrollTop = C.scroll[slot] || 0; });

    // composer: the store tag is set for you (where the salesman is, or the store being looked at); one tap removes it
    const ctx = C.ctx[key];
    const tag = D.untag || anchor.type === 'team' ? null : ctx ? ctx : F.store ? { store: F.store } : who !== 'SUP' && hereStore(vsr) ? { store: hereStore(vsr) } : null;
    const fileIn = h('input', { type: 'file', multiple: true, hidden: true, accept: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt', on: { change: e => { addFiles([...e.target.files]); e.target.value = ''; } } });
    const camIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, on: { change: e => { addFiles([...e.target.files]); e.target.value = ''; } } });
    async function addFiles(fs) {
      for (const f of fs) {
        if (D.files.length >= MAX_FILES) { FD.toast(null, null, { text: t('L_FILES_MAX', { n: FD.fmt.num(MAX_FILES) }) }); break; }
        const img = /^image\//.test(f.type);
        if (!img && f.size > MAX_BYTES) { FD.toast(null, null, { text: t('L_FILE_BIG', { label: f.name }) }); continue; }
        try { const data = img ? await FD.readPhoto(f) : await readData(f);
          D.files.push({ id: 'F' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), name: f.name || 'photo.jpg', type: img ? 'image/jpeg' : (f.type || 'application/octet-stream'), size: img ? Math.round(data.length * 0.75) : f.size, kind: img ? 'img' : 'doc', data });
        } catch (err) { FD.toast(null, null, { text: t('L_FILE_BIG', { label: f.name }) }); }
      }
      C.typing = key; rerender();
    }
    let sending = false;
    async function send(text, qr) {
      text = (text || '').trim(); if (sending || (!text && !D.files.length)) return; sending = true;
      try { for (const f of D.files) await FD.filePut(f.id, f.data); } catch (e) { /* kept in memory for this session */ }
      FD.dx('MSG_SEND', { anchor, by: who === 'SUP' ? 'SUP' : vsr, text, files: D.files.map(f => ({ id: f.id, name: f.name, type: f.type, size: f.size, kind: f.kind })), replyTo: D.replyTo || null, qr: qr || null,
        store: tag ? tag.store || null : null, sku: tag ? tag.sku || null : null, rec: tag ? tag.rec || null : null, topic: who !== 'SUP' && tag && tag.store ? D.topic : null });
      C.drafts[key] = { text: '', files: [], replyTo: null, topic: null, untag: false }; C.stick[slot] = true; C.divider[slot] = null; C.typing = key;
      const x = findTh(anchor); if (x && FD.chatUnread(x, who, vsr)) FD.dx('THREAD_READ', { thread: x.id, who, vsr });
      rerender();
    }
    const autosize = el => { el.style.height = 'auto'; el.style.height = Math.min(140, el.scrollHeight) + 'px'; };
    const ta = h('textarea', { class: 'textarea chat-input', dir: 'auto', rows: '1', placeholder: t('L_TYPE_MSG'), 'aria-label': t('L_TYPE_MSG'), maxlength: '1000',
      on: { input: e => { D.text = e.target.value; autosize(e.target); }, focus: () => { C.typing = key; }, blur: e => { if (e.target.isConnected) C.typing = null; },
        keydown: e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(pointer: fine)').matches) { e.preventDefault(); send(D.text); } } } });
    ta.value = D.text;
    requestAnimationFrame(() => { if (!ta.isConnected) return; autosize(ta); if (C.typing === key && document.activeElement !== ta && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('input, textarea, select'))) { ta.focus({ preventScroll: true }); ta.setSelectionRange(ta.value.length, ta.value.length); } });
    const quoted = D.replyTo && msgs.find(x => x.id === D.replyTo);
    const quick = who === 'SUP' ? ['QR_AGAIN', 'QR_ONEBOX', 'QR_NOTED', 'QR_CALL', 'QR_SKIP', 'QR_PROMO'] : ['QV_OK', 'QV_DONE', 'QV_LATER', 'QV_CALL'];
    const composer = h('div', { class: 'chat-compose' },
      tag ? h('div', { class: 'chat-tagrow' }, h('span', { class: 'chip outline' }, I('map-pin', 's14'), [tag.store ? FD.nameOf(storeOf(tag.store)) : null, tag.sku ? FD.nameOf(FD.sku(tag.sku)) : null].filter(Boolean).join(' · '),
          h('button', { type: 'button', class: 'chip-x', 'aria-label': t('L_REMOVE'), on: { click: () => { D.untag = true; rerender(); } } }, I('x', 's14'))),
        who !== 'SUP' && tag.store ? ['R_T_RETURN', 'R_T_REQUEST', 'R_T_PRICE', 'R_T_ACCESS'].map(x => h('button', { type: 'button', class: 'chip chip-btn' + (D.topic === x ? ' on' : ''), on: { click: () => { D.topic = D.topic === x ? null : x; rerender(); } } }, t(x))) : null) : null,
      mode === 'popup' ? null : h('div', { class: 'chat-chips' }, quick.map(x => h('button', { type: 'button', class: 'chip chip-btn', on: { click: FD.once(() => send(t(x), x)) } }, t(x)))),
      quoted ? h('div', { class: 'chat-replying' }, I('reply', 's14'), h('div', { class: 'grow', style: { minWidth: 0 } }, h('b', { class: 'small' }, t('L_REPLYING', { label: isMine(quoted, who, vsr) ? t('L_YOU') : nameBy(quoted.by) })), h('div', { class: 'small muted ellipsis', dir: 'auto' }, quoted.text || t('L_ATTACHMENT'))),
        FD.iconBtn('x', t('L_REMOVE'), () => { D.replyTo = null; rerender(); })) : null,
      D.files.length ? h('div', { class: 'chat-attach' }, D.files.map((f, i) => h('div', { class: 'att' }, f.kind === 'img' ? h('img', { src: f.data, alt: '' }) : h('span', { class: 'chat-file-ic' }, I('file', 's16')),
        h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'small ellipsis' }, f.name), h('div', { class: 'small muted' }, fmtSize(f.size))),
        h('button', { type: 'button', class: 'att-x', 'aria-label': t('L_REMOVE'), on: { click: () => { D.files.splice(i, 1); rerender(); } } }, I('x', 's14'))))) : null,
      h('div', { class: 'chat-row' }, fileIn, camIn, FD.iconBtn('paperclip', t('L_ATTACH'), () => fileIn.click()), who !== 'SUP' ? FD.iconBtn('camera', t('L_PHOTO'), () => camIn.click()) : null,
        h('div', { class: 'grow' }, ta), h('button', { class: 'btn primary chat-send', type: 'button', 'aria-label': t('L_SEND'), on: { click: () => send(D.text) } }, I('send', 's16'))));
    return h('div', { class: 'chat chat-' + mode }, header, searchBar, panel, chips, list, composer);
  };

  // ---------- quick popup (desktop supervisor, can be minimised) / sheet (phones) ----------
  const P = { anchor: null, who: null, el: null, min: false };
  function drawPop() {
    if (!P.anchor) { if (P.el) P.el.remove(); P.el = null; return; }
    if (!P.el || !P.el.isConnected) { P.el = h('div', { class: 'chat-pop', role: 'dialog', 'aria-label': t('L_MESSAGES'), on: { keydown: e => { if (e.key === 'Escape') { e.stopPropagation(); closePop(); } } } }); document.body.appendChild(P.el); }
    const a = P.anchor, who = P.who; const k = FD.chatKey(a);
    P.el.classList.toggle('min', P.min);
    if (P.min) { const th = findTh(a); const un = th && FD.chatUnread(th, who);
      P.el.replaceChildren(h('button', { type: 'button', class: 'chat-pop-bar', on: { click: () => { P.min = false; drawPop(); } } }, FD.avatar(st().world.vsrs.find(v => v.id === a.id)) || null,
        h('b', { class: 'grow ellipsis' }, FD.chatTitle(a, who) + (C.f[k] && C.f[k].store ? ' · ' + FD.nameOf(storeOf(C.f[k].store)) : '')), un ? h('span', { class: 'unread-dot' }) : null, I('chevron-up', 's16')),
        FD.iconBtn('x', t('L_CLOSE'), closePop)); return; }
    P.el.replaceChildren(FD.chatView(a, who, { mode: 'popup', last: 4, rerender: drawPop, onClose: closePop, onMin: () => { P.min = true; drawPop(); },
      onExpand: () => { const f = C.f[k], tg = C.ctx[k]; closePop(); FD.chatOpen(a, who, f, tg); } }));
  }
  function closePop() { P.anchor = null; P.min = false; C.active.popup = null; drawPop(); }
  // every Message button outside the Messages page: quick popup on desktop, sheet on phones
  FD.chatPopup = (anchor0, who, filter, tag) => {
    const r = FD.chatResolve(anchor0, who); if (!r) return; if (filter !== undefined) { r.filter = filter; r.tag = tag || null; }
    const a = r.th, k = FD.chatKey(a); C.f[k] = r.filter ? Object.assign({}, r.filter) : {}; C.ctx[k] = r.tag; if (C.drafts[k]) C.drafts[k].untag = false;
    if (who !== 'SUP' || innerWidth < 768) {
      const view = () => FD.chatView(a, who, { mode: 'sheet', header: false, last: 4, rerender: () => FD.sheet.refreshLive(), onExpand: () => { FD.sheet.close(); setTimeout(() => FD.chatOpen(a, who, C.f[k], C.ctx[k]), 320); } });
      return FD.sheet.open({ title: () => FD.chatTitle(a, who) + (r.filter && r.filter.store ? ' · ' + FD.nameOf(storeOf(r.filter.store)) : ''), live: view, render: () => h('div', { 'data-live': '' }, view()),
        footer: () => [h('span', { class: 'grow' }), FD.btn(t('L_OPEN_FULL'), () => { FD.sheet.close(); setTimeout(() => FD.chatOpen(a, who, C.f[k], C.ctx[k]), 320); }, 'ghost sm', 'maximize')], onClose: () => { C.active.sheet = null; } });
    }
    FD.menu.close(); P.anchor = a; P.who = who; P.min = false; C.typing = k; drawPop();
  };
  FD.threadSheet = FD.chatPopup;
  FD.chatClose = () => { if (P.anchor) closePop(); };
  FD.bus.on('change', () => { if (P.anchor) drawPop(); });
  addEventListener('hashchange', () => { if (P.anchor && !P.min) closePop(); });
  // the full chat page fills the window below the top bar
  const setTb = () => { const tb = document.querySelector('.topbar'); if (tb) document.documentElement.style.setProperty('--tb', tb.offsetHeight + 'px'); };
  FD.afterRender = setTb; addEventListener('resize', setTb);
})();
