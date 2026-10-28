(function(){
 const FD=globalThis.FD;if(typeof document==='undefined')return;
 const S=FD.sup,h=FD.h,t=(...a)=>FD.t(...a),st=()=>FD.state,L=FD.ui.local;
 const analysed=store=>FD.pgAssessments(st(),store).filter(a=>{const s=FD.scSummary(st(),a.id);return s&&s.photos.length;});
 // Coaching tip from the fixed "what to do" lines of the open issues; the supervisor edits it before sending.
 S.pgCoach=(store,request=false,assessmentId)=>{
  const so=st().world.stores.find(s=>s.id===store),a=FD.pgAssessment(st(),assessmentId||L['pg:assessment:'+store])||analysed(store)[0],sum=a&&FD.scSummary(st(),a.id);
  const tip=sum&&sum.analysed?sum.findings.concat(sum.fresh).filter(f=>f.status!=='FIXED').map(f=>t('SC_DO_'+f.check)).join(' '):'';
  const text=request?t('PG_NEXT_CHECK',{store:FD.nameOf(so),tip:tip||t('SC_TAKE_AFTER')}):tip||t('SC_GOOD');
  S.tipComposer(FD.routeOwner(st(),so.route,st().clock.date)||so.vsr,'K_CUSTOM',{storeId:store},null,null,{title:t('SC_TITLE')+' · '+FD.nameOf(so),text});
 };
 // Shelf Check lives in the store Overview: a short card there, the full check in place of the Overview until Back.
 S.pgOpen=(store,id)=>{L['store:tab']='overview';L['store:sc:'+store]=id||'latest';S.storeDrawer(store);};
 const refresh=()=>{FD.drawer.refresh(false);FD.render();};
 // the latest request and what happened to it, in one line plus the buttons: ask, and take the photo yourself
 S.scRequestLine=store=>{const r=FD.scRequest(st(),store),ask=FD.btn(t('SC_REQ_ASK'),()=>{FD.dx('SC_REQUEST',{store});FD.toast('S_SENT',{vsrId:storeOf(store).vsr});refresh();},'secondary sm','camera'),
  snap=FD.btn(t('PG_TAKE_PHOTOS'),()=>FD.pgCaptureSheet({store,phase:'BEFORE',by:'SUP'}),'secondary sm','camera');
  if(!r||r.status!=='OPEN'&&r.at.date<FD.addDays(st().clock.date,-14))return h('div',{class:'row wrap sc-req'},ask,snap);
  return h('div',{class:'row wrap sc-req'},r.status==='OPEN'?FD.chip(t('SC_REQ_OPEN',{date:FD.fmt.date(r.at.date)}),'info'):r.status==='DONE'?FD.chip(t('SC_REQ_DONE',{date:FD.fmt.date(r.doneAt.date)}),'good'):FD.chip(t('SC_REQ_BLOCKED',{reason:t('SC_REQ_'+r.reason)}),'warn'),r.photoReceived?FD.chip(t('SC_REQ_PHOTO'),'warn'):null,r.status==='OPEN'?null:ask,snap);};
 const storeOf=id=>st().world.stores.find(s=>s.id===id);
 S.scCard=store=>{const a=analysed(store)[0],s=a&&FD.scSummary(st(),a.id);
  if(!s||!s.analysed||!s.current)return h('section',{class:'card sc-card'},h('div',{class:'row between wrap'},h('h3',null,t('SC_TITLE')),S.scRequestLine(store)),h('p',{class:'small muted'},t('SC_REQ_NONE')));
  const open=()=>{L['store:sc:'+store]=a.id;refresh();},issues=s.findings.concat(s.fresh).filter(f=>f.status!=='FIXED').slice(0,3);
  return h('section',{class:'card sc-card'},
   h('div',{class:'row between wrap'},h('div',null,h('h3',null,t('SC_TITLE')),h('div',{class:'small muted'},FD.fmt.date(a.date)+' · '+FD.nameOf(st().world.vsrs.find(v=>v.id===a.vsr)))),
    h('div',{class:'row'},s.current.none?null:s.before&&s.after?[FD.scChip(s.before),FD.icon('arrow-right','s14'),FD.scChip(s.after)]:FD.scChip(s.current))),
   s.current.none?h('p',{class:'small muted'},t('SC_NO_OURS')):null,
   s.urgent?FD.chip(t('SC_URGENT'),'bad'):null,
   issues.length?h('ul',{class:'sc-lines'},issues.map(f=>h('li',null,h('span',null,t('SC_CHK_'+f.check)),FD.chip(t('SC_ST_'+(f.status==='OPEN'&&f.outcome==='DONE'?'WAIT':f.status)))))):s.good?h('p',{class:'small'},t('SC_GOOD')):null,
   h('div',{class:'row between wrap'},h('div',{class:'sc-thumbs'},s.photos.slice(0,4).map(x=>h('img',{src:x.p.src,alt:'',loading:'lazy'}))),h('div',{class:'row wrap'},S.scRequestLine(store),FD.btn(t('ACT_PLANOGRAM'),open,'secondary sm'))));};
 S.scFull=store=>{
  const all=analysed(store),want=L['store:sc:'+store],a=all.find(x=>x.id===want)||all[0];
  const back=FD.btn(t('L_BACK'),()=>{L['store:sc:'+store]=null;refresh();},'ghost sm','arrow-left');
  if(!a)return h('div',{class:'stack s12'},back,h('p',{class:'muted'},t('SC_NONE')));
  const label=x=>FD.fmt.date(x.date)+' · '+FD.nameOf(st().world.vsrs.find(v=>v.id===x.vsr));
  return h('div',{class:'stack s16 pg-view'},h('div',{class:'row between wrap'},back,all.length>1?FD.select(all.map(x=>({id:x.id,label:label(x)})),a.id,v=>{L['store:sc:'+store]=v;refresh();}):h('span',{class:'small muted'},label(a))),
   FD.scPanel(a.id,{role:'SUP',redraw:refresh}),
   h('div',{class:'row wrap'},FD.btn(t('PG_COACH'),()=>S.pgCoach(store,false,a.id),'secondary','message'),S.scRequestLine(store)));
 };
 S.pgContent=(store,{assessmentId}={})=>{L['store:sc:'+store]=assessmentId||L['store:sc:'+store]||'latest';return S.scFull(store);};
 // Analytics: shelf condition and follow-through per salesman. Sorted by name, never ranked.
 S.scTeamCard=(ids,from,to,narrow)=>{
  const rows=FD.scTeam(st(),from,to,ids).filter(r=>r.stores).sort((a,b)=>FD.nameOf(st().world.vsrs.find(v=>v.id===a.vsr)).localeCompare(FD.nameOf(st().world.vsrs.find(v=>v.id===b.vsr))));
  const paired=rows.some(r=>r.change!=null),nm=id=>FD.nameOf(st().world.vsrs.find(v=>v.id===id));
  const cols=[{key:'v',label:t('L_COL_SALESMAN'),render:r=>nm(r.vsr)},
   {key:'n',label:t('SC_COL_STORES'),num:true,render:r=>FD.fmt.num(r.stores)},
   {key:'s',label:t('SC_SCORE'),num:true,render:r=>r.score==null?'—':h('span',{title:t('SC_N_OF_M',{n:FD.fmt.num(r.finalStores),m:FD.fmt.num(r.stores)})},FD.fmt.num(r.score,1))},
   paired?{key:'c',label:t('L_COL_CHANGE'),num:true,render:r=>r.change==null?'—':h('span',{title:t('SC_PAIRED',{n:FD.fmt.num(r.paired)})},t('SC_CHANGE',{change:(r.change>0?'+':r.change<0?'−':'')+FD.fmt.num(Math.abs(r.change),1)}))}:null,
   {key:'f',label:t('SC_FIXES'),num:true,render:r=>r.fixes.total?t('SC_N_OF_M',{n:FD.fmt.num(r.fixes.verified),m:FD.fmt.num(r.fixes.total)}):'—'},
   {key:'o',label:t('SC_OPEN'),num:true,render:r=>r.open?h('button',{type:'button',class:'link-btn tabular',on:{click:e=>{e.stopPropagation();S.scIssues(r);}}},FD.fmt.num(r.open)):FD.fmt.num(0)},
   {key:'b',label:t('SC_BLOCKERS'),num:true,render:r=>FD.fmt.num(r.blockers)},
   {key:'p',label:t('SC_COL_PHOTOS'),num:true,render:r=>r.photos?t('SC_N_OF_M',{n:FD.fmt.num(r.photosOk),m:FD.fmt.num(r.photos)}):'—'}].filter(Boolean);
  // Phone: name, score, fixes and open issues; the row drawer carries the rest.
  const compact=cols.filter(c=>['v','s','f','o'].includes(c.key)),facts=r=>h('dl',{class:'sc-facts'},cols.filter(c=>c.key!=='v').flatMap(c=>[h('dt',null,c.label),h('dd',null,c.render(r))]));
  const so=id=>st().world.stores.find(x=>x.id===id),val=x=>x.s.current.final?x.s.current.score:1000; // no score sorts after every score
  const cols2=[
   {key:'st',label:t('L_COL_STORE'),sort:(x,y)=>FD.nameOf(so(x.a.store)).localeCompare(FD.nameOf(so(y.a.store))),render:x=>h('div',null,h('div',null,FD.nameOf(so(x.a.store))),h('div',{class:'small muted'},FD.fmt.date(x.a.date)))},
   {key:'sc',label:t('SC_SCORE'),num:true,firstDir:'asc',sort:(x,y)=>val(x)-val(y),render:x=>FD.scChip(x.s.current)},
   {key:'op',label:t('SC_OPEN'),num:true,sort:(x,y)=>x.s.open-y.s.open,render:x=>FD.fmt.num(x.s.open)}];
  // stores that need something first; the rest fold away like other long lists
  const open=r=>FD.drawer.open({title:t('SC_TITLE')+' · '+nm(r.vsr),render:()=>{const busy=r.stores_.filter(x=>x.s.open),quiet=r.stores_.filter(x=>!x.s.open),k='sc:quiet:'+r.vsr;
   return h('div',{class:'stack s12'},facts(r),
    // one list: stores with open issues first, the rest added below on Show more
    h('div',{class:'card'},FD.table({id:'scStores',rows:L[k]?busy.concat(quiet):busy,onRow:x=>S.pgOpen(x.a.store,x.a.id),columns:cols2}),
     quiet.length&&!L[k]?h('div',{class:'card-f'},FD.btn(t('L_SHOW_MORE'),()=>{L[k]=true;FD.drawer.refresh(false);},'ghost sm')):null));}});
  // narrow: the card sits beside Team on Analytics, so it always uses the short columns
  return S.card(t('SC_TEAM'),null,!rows.length?FD.empty('SC_NO_TEAM'):narrow?FD.table({id:'scTeamCompact',rows,columns:compact,onRow:open}):h('div',{class:'team-comparison'},h('div',{class:'team-wide'},FD.table({id:'scTeam',rows,columns:cols,onRow:open})),h('div',{class:'team-compact'},FD.table({id:'scTeamCompact',rows,columns:compact,onRow:open}))),{flush:true,icon:'camera'});
 };
 // Every open issue of one salesman, grouped by store; each opens its check
 S.scIssues=r=>FD.drawer.open({title:t('SC_OPEN')+' · '+FD.nameOf(st().world.vsrs.find(v=>v.id===r.vsr)),render:()=>h('div',{class:'stack s12'},r.stores_.filter(x=>x.s.open).sort((x,y)=>y.s.open-x.s.open).map(({a,s})=>
   h('div',{class:'card'},h('button',{type:'button',class:'list-row click',on:{click:()=>S.pgOpen(a.store,a.id)}},h('span',{class:'grow'},h('b',{style:{display:'block'}},FD.nameOf(st().world.stores.find(x=>x.id===a.store))),h('span',{class:'small muted'},FD.fmt.date(a.date))),FD.scChip(s.current),FD.icon('chevron-right','s16')),
    s.findings.concat(s.fresh).filter(f=>f.status!=='FIXED').map(f=>h('div',{class:'list-row sc-issue-row'},h('span',{class:'grow'},t('SC_CHK_'+f.check)),f.outcome?FD.chip(t('SC_OUT_'+f.outcome),['NOT_IN_VAN','OWNER_NO','NEED_HELP','OWNER_AWAY'].includes(f.outcome)?'warn':''):null,FD.chip(t('SC_ST_'+(f.status==='OPEN'&&f.outcome==='DONE'?'WAIT':f.status)),f.status==='STILL'||f.status==='NEW'?'bad':''))))))});
 // Settings: the three area weights. Check importance inside each area is fixed and shown read-only.
 S.scWeightsBody=()=>{
  const saved=FD.scWeights(st()),draft=L['sc:weights']=L['sc:weights']||{...saved},keys=Object.keys(FD.SC_DEFAULT_WEIGHTS),total=keys.reduce((s,k)=>s+draft[k],0);
  const changed=keys.some(k=>draft[k]!==saved[k]),pct=n=>FD.fmt.pct(n);
  return h('div',null,
   keys.map(k=>h('div',{class:'list-row'},h('div',{class:'grow'},h('div',null,t('SC_AREA_'+k)),h('div',{class:'small muted'},FD.SC_AREAS.find(a=>a.id===k).checks.map(c=>t('SC_CHK_'+c.check)+' '+pct(c.weight)).join(' · '))),
    FD.stepper(draft[k],0,100,v=>{if(v>=0&&v<=100){draft[k]=v;FD.render();}},t('SC_AREA_'+k),5))),
   h('div',{class:'list-row'},h('b',{class:'grow',style:total===100?null:{color:'var(--bad)'}},t('SC_TOTAL',{pct:pct(total)})),
    FD.btn(t('SC_RESET'),()=>{FD.dx('SC_WEIGHTS_SET',{weights:null});L['sc:weights']=null;FD.toast('S_SAVED');FD.render();},'ghost sm'),
    h('button',{type:'button',class:'btn primary sm',disabled:total!==100||!changed,on:{click:()=>{FD.dx('SC_WEIGHTS_SET',{weights:{...draft}});FD.toast('S_SAVED');FD.render();}}},t('L_SAVE'))),
   h('p',{class:'small muted',style:{padding:'8px 14px'}},t('SC_INSIDE')));
 };
})();
