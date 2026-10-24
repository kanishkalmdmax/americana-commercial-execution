(function () {
  const FD=globalThis.FD;
  const state=st=>{const p=st.planogram||(st.planogram={assessments:[],columnPrefs:{}});p.requests=p.requests||[];return p;};
  FD.pgAssessment=(st,id)=>state(st).assessments.find(a=>a.id===id)||null;
  FD.pgAssessments=(st,store)=>state(st).assessments.filter(a=>a.store===store).slice().sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time));
  FD.pgPhotos=(st,id)=>{const a=FD.pgAssessment(st,id);return a?st.photos.filter(p=>a.photoIds.includes(p.id)):[];};
  FD.registerReducer('PG_START',(st,p)=>{
    const pg=state(st),so=st.world.stores.find(s=>s.id===p.store); if(!p.id||!so||pg.assessments.some(a=>a.id===p.id))return;
    const visit=p.visitId&&st.visits.find(v=>v.id===p.visitId); if(visit&&(visit.store!==p.store||visit.date!==st.clock.date))return;
    pg.assessments.push({id:p.id,store:p.store,vsr:visit?.vsr||p.vsr||so.vsr,visitId:p.visitId||null,date:st.clock.date,time:st.clock.time,photoIds:[],weights:null,actions:{},dismissed:{}});
  });
  // `ref` links a photo to its analysis result; weights freeze on the first analysed photo so later setting changes never rewrite this check.
  FD.registerReducer('PG_PHOTOS_ADD',(st,p)=>{
    const a=FD.pgAssessment(st,p.id); if(!a)return;
    for(const ph of p.photos||[]) {
      if(!ph.id||typeof ph.src!=='string'||!ph.src||!['BEFORE','AFTER'].includes(ph.phase)||st.photos.some(x=>x.id===ph.id))continue;
      const ref=FD.scResult&&FD.scResult(ph.ref)?ph.ref:null;
      st.photos.push({id:ph.id,src:ph.src,store:a.store,vsr:a.vsr,date:st.clock.date,time:st.clock.time,assessmentId:a.id,phase:ph.phase,ref});a.photoIds.push(ph.id);
      if(ref!=null&&!a.weights)a.weights=FD.scWeights(st);
      // a Before photo answers the supervisor's open request for this store
      if(ph.phase==='BEFORE')for(const r of state(st).requests.filter(r=>r.store===a.store&&r.status==='OPEN'))Object.assign(r,{status:'DONE',assessmentId:a.id,doneAt:{date:st.clock.date,time:st.clock.time}});
    }
  });
  FD.registerReducer('SC_ACTION_SET',(st,p)=>{
    const a=FD.pgAssessment(st,p.id); if(!a||!FD.SC_CHECKS.includes(p.check))return;
    if(p.outcome===null){delete a.actions[p.check];return;}
    if(FD.SC_OUTCOMES[FD.scClass(p.check)].includes(p.outcome))a.actions[p.check]=p.outcome;
  });
  // supervisor asks for a shelf check at the next visit; one open request per store
  FD.registerReducer('SC_REQUEST',(st,p)=>{const so=st.world.stores.find(s=>s.id===p.store),pg=state(st);if(!so||pg.requests.some(r=>r.store===p.store&&r.status==='OPEN'))return;
    pg.requests.push({id:'SR'+(pg.requests.length+1),store:p.store,vsr:FD.routeOwner?FD.routeOwner(st,so.route,st.clock.date)||so.vsr:so.vsr,at:{date:st.clock.date,time:st.clock.time},status:'OPEN',reason:null});});
  FD.registerReducer('SC_REQUEST_BLOCK',(st,p)=>{const r=state(st).requests.find(x=>x.id===p.id);if(r&&r.status==='OPEN'&&['CLOSED','OWNER_NO','NO_ACCESS'].includes(p.reason))Object.assign(r,{status:'BLOCKED',reason:p.reason,doneAt:{date:st.clock.date,time:st.clock.time}});});
  // photos saved in the wrong slot: flip Before and After for the whole check
  FD.registerReducer('SC_SWAP',(st,p)=>{for(const ph of FD.pgPhotos(st,p.id))if(ph.phase==='BEFORE'||ph.phase==='AFTER')ph.phase=ph.phase==='BEFORE'?'AFTER':'BEFORE';});
  FD.registerReducer('SC_DISMISS',(st,p)=>{const a=FD.pgAssessment(st,p.id);if(a&&FD.SC_CHECKS.includes(p.check))a.dismissed[p.check]={date:st.clock.date,time:st.clock.time,by:p.by||'SUP'};});
  FD.registerReducer('SC_WEIGHTS_SET',(st,p)=>{
    if(p.weights===null){delete st.rules.shelfWeights;return;}
    const w=p.weights||{},keys=Object.keys(FD.SC_DEFAULT_WEIGHTS);
    if(!keys.every(k=>Number.isInteger(w[k])&&w[k]>=0)||keys.reduce((s,k)=>s+w[k],0)!==100)return;
    st.rules.shelfWeights=Object.fromEntries(keys.map(k=>[k,w[k]]));
  });
  FD.registerReducer('PRODUCT_COLUMNS_SET',(st,p)=>{state(st).columnPrefs.products=FD.productColumns(p.keys);});
  // Competitor photo: its own kind of store photo, kept out of Shelf Check scoring.
  FD.COMP_BRANDS=['BR_LUSINE','BR_7DAYS','BR_SWITZ','BR_SABAHOO','BR_OTHER'];
  FD.COMP_SEEN=['CI_PRICE','CI_DISPLAY','CI_NEW','CI_SPACE'];
  FD.registerReducer('COMP_PHOTO_ADD',(st,p)=>{
    const so=st.world.stores.find(s=>s.id===p.store);if(!so||!p.id||typeof p.src!=='string'||!p.src||st.photos.some(x=>x.id===p.id))return;
    st.photos.push({id:p.id,src:p.src,store:p.store,vsr:p.vsr||so.vsr,date:st.clock.date,time:st.clock.time,kind:'COMP',
      brand:FD.COMP_BRANDS.includes(p.brand)?p.brand:'BR_OTHER',seen:(p.seen||[]).filter(x=>FD.COMP_SEEN.includes(x)),note:typeof p.note==='string'?p.note.trim().slice(0,200)||null:null});
  });
  // Shelf Check names brands without the BR_ prefix and spells 7Days out.
  const brandOf=b=>b==='SEVEN_DAYS'?'BR_7DAYS':FD.COMP_BRANDS.includes('BR_'+b)?'BR_'+b:'BR_OTHER';
  // One store's competition in the last `days`: salesman photos, sales lost to a competitor deal, and what the latest Shelf Check saw.
  FD.compIntel=(st,store,days=60)=>{
    const from=FD.addDays(st.clock.date,-days),by=new Map(),row=b=>by.get(b)||by.set(b,{brand:b,photos:0,lost:0,signals:new Set(),last:''}).get(b);
    const touch=(r,d)=>{if(d>r.last)r.last=d;};
    const photos=st.photos.filter(p=>p.kind==='COMP'&&p.store===store&&p.date>=from).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
    for(const p of photos){const r=row(p.brand);r.photos++;p.seen.forEach(x=>r.signals.add(x));touch(r,p.date);}
    for(const x of st.recs)if(x.store===store&&x.reason==='R_COMPETITOR'&&x.date>=from){const r=row(x.brand||'BR_OTHER');r.lost++;touch(r,x.date);}
    const a=FD.scSummary&&FD.pgAssessments(st,store).find(a=>a.date>=from&&FD.scSummary(st,a.id)?.analysed);
    if(a)for(const c of FD.scSummary(st,a.id).competition){const r=row(brandOf(c.brand));r.signals.add(c.signal);touch(r,a.date);}
    const brands=[...by.values()].map(r=>({...r,signals:[...r.signals]})).sort((x,y)=>y.last.localeCompare(x.last)||y.lost-x.lost);
    return {photos,brands,checkDate:a?a.date:null};
  };
  // Demo: every third store has a competitor photo from its last visit, using field photos where Shelf Check saw a named brand.
  FD.compSeed=st=>{const P=FD.PHOTOS,R=(FD.SHELF_RESULTS||{}).photos||{};if(!P)return;
    const refs=Object.keys(R).map(Number).filter(k=>(R[k].result?.competition||[]).some(c=>c.brand&&!['OTHER','UNKNOWN'].includes(c.brand)));if(!refs.length)return;
    st.world.stores.forEach((so,i)=>{if(i%3)return;const v=st.visits.filter(x=>x.store===so.id&&x.status==='DONE'&&x.date<st.clock.date).at(-1);if(!v)return;
      const ref=refs[i%refs.length],cs=R[ref].result.competition.filter(c=>c.brand&&!['OTHER','UNKNOWN'].includes(c.brand));
      const seen=[...new Set(R[ref].result.competition.map(c=>({COMP_TRAY:'CI_DISPLAY',COMP_OFFER:'CI_PRICE',COMP_NO_AMERICANA:'CI_SPACE'})[c.signal]).filter(Boolean))];
      st.photos.push({id:'CP'+i,src:P[ref],store:so.id,vsr:v.vsr,date:v.date,time:v.leftAt||'12:00',kind:'COMP',brand:brandOf(cs[0].brand),seen,note:null});});
  };
})();
