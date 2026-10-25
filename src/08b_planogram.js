(function(){
 const FD=globalThis.FD;
 // Process every selected image. A failed file never discards the other images.
 FD.pgReadPhotos=async files=>{const savedInputs=[],failed=[];for(const file of Array.from(files||[])){try{if(!file.type.startsWith('image/'))throw Error('image');savedInputs.push({id:'pg-photo-'+FD.key(),name:file.name,src:await FD.readPhoto(file)});}catch(e){failed.push(file.name);}}return {savedInputs,failed};};
 if(typeof document==='undefined')return;
 const h=FD.h,t=(...a)=>FD.t(...a),st=()=>FD.state;
 const current=(store,visitId)=>FD.pgAssessments(st(),store).find(a=>a.date===st().clock.date&&a.visitId===(visitId||null));
 const TONE={FIXED:'good',PARTLY_FIXED:'warn',STILL:'bad',NEW:'bad',WAIT:'info',OPEN:'',CANT_CHECK:''};
 const BRAND={LUSINE:'BR_LUSINE',SEVEN_DAYS:'BR_SEVEN_DAYS',SWITZ:'BR_SWITZ',SABAHOO:'BR_SABAHOO',ALMARAI:'BR_ALMARAI',SUNBULAH:'BR_SUNBULAH',AL_KABEER:'BR_AL_KABEER',OTHER:'BR_OTHER'};
 const pts=v=>t('SC_OF_100',{n:FD.fmt.num(Math.round(v))});
 const signed=v=>(v>0?'+':v<0?'−':'')+FD.fmt.num(Math.round(Math.abs(v)));
 const boxStyle=b=>({top:b[0]/10+'%',left:b[1]/10+'%',width:(b[3]-b[1])/10+'%',height:(b[2]-b[0])/10+'%'});
 FD.scScoreText=s=>s&&s.final?pts(s.score):s&&s.none?t('SC_NO_OURS'):'—';
 // Lists show the score as a chip, like other statuses in the app.
 FD.scChip=s=>!s?null:s.final?FD.chip(FD.fmt.num(Math.round(s.score)),s.score>=90?'good':s.score>=70?'warn':'bad'):FD.chip(t(s.none?'SC_NOT_IN_PHOTO':'SC_PENDING_SHORT'),'outline');
 // One panel for both roles. `editable` lets the salesman record what happened on today's visit.
 FD.scPanel=(id,{role='VSR',editable=false,redraw=()=>FD.render()}={})=>{
  const S=FD.scSummary(st(),id);if(!S||!S.photos.length)return null;
  const listed=S.analysed?S.findings.concat(S.fresh).map((f,i)=>({...f,n:i+1})):[];
  const marksOn=pid=>listed.filter(f=>f.mark&&f.mark.photoId===pid||f.markAfter&&f.markAfter.photoId===pid).map(f=>({...f,box:(f.mark&&f.mark.photoId===pid?f.mark:f.markAfter).box}));
  const statusOf=p=>{const r=FD.scResult(p.ref);return {status:r?r.photo.status:'NONE',reasons:r&&r.photo.status!=='OK'?r.photo.reasons||[]:[]};};
  const fig=p=>{const x=statusOf(p);return h('figure',{class:'sc-figure'},
   h('div',{class:'sc-photo'},FD.photoButton({src:p.src,label:t('PG_PHOTO_LABEL')}),marksOn(p.id).map(f=>h('span',{class:'sc-mark'+(f.urgent?' urgent':''),style:boxStyle(f.box),'aria-hidden':'true'},h('b',null,FD.fmt.num(f.n))))),
   h('figcaption',{class:'small muted'},t('SC_PHOTO_'+x.status)),x.reasons.length?h('p',{class:'small muted'},x.reasons.map(r=>t('SC_WHY_'+r)).join(' ')):null);};
  // Before | After side by side, each labelled with when and its score; an empty After says what happens next
  const head2=(label,ps,sc)=>h('div',{class:'sc-col-h'},h('div',null,h('b',null,label),ps[0]?h('div',{class:'small muted'},FD.fmt.date(ps[0].date)+' · '+FD.fmt.time(ps[0].time)):null),S.analysed&&sc?FD.scChip(sc):null);
  const bPs=S.analysed?S.cmp.before:S.photos.filter(x=>x.p.phase==='BEFORE').map(x=>x.p),aPs=S.analysed?S.cmp.after:S.photos.filter(x=>x.p.phase==='AFTER').map(x=>x.p);
  const side=FD.ui.local['sc:side:'+id]||'BEFORE';
  const beforeCol=bPs.length?h('div',{class:'sc-col'+(side==='BEFORE'?' on':'')},head2(t('PG_BEFORE'),bPs,S.before),bPs.map(fig)):null;
  const afterCol=!bPs.length&&!aPs.length?null:aPs.length?h('div',{class:'sc-col'+(side==='AFTER'?' on':'')},head2(S.analysed&&S.cmp.afterSource==='NEXT'?t('SC_NEXT_LABEL'):t('PG_AFTER'),aPs,S.after),aPs.map(fig))
   :(FD.pgAssessment(st(),id)||{}).noChange?h('div',{class:'sc-col sc-col-empty'+(side==='AFTER'?' on':'')},head2(t('PG_AFTER'),[],null),h('div',{class:'sc-empty'},FD.icon('check-circle','s20'),h('b',null,t('SC_NO_CHANGE')),h('span',{class:'small muted'},t('SC_NO_CHANGE_D')),
     role==='VSR'&&editable?FD.btn(t('SC_NO_CHANGE_UNDO'),()=>{FD.dx('SC_NO_CHANGE',{id,on:false});redraw();},'ghost sm','undo'):null))
   :h('div',{class:'sc-col sc-col-empty'+(side==='AFTER'?' on':'')},head2(t('PG_AFTER'),[],null),h('div',{class:'sc-empty'},FD.icon('camera','s20'),h('b',null,t('SC_NO_AFTER')),
     h('span',{class:'small muted'},t(role==='VSR'&&editable?'SC_NO_AFTER_VSR':'SC_NO_AFTER_SUP')),role==='VSR'&&editable?FD.btn(t('PG_CAPTURE_AFTER'),()=>FD.pgCaptureSheet({store:FD.pgAssessment(st(),id).store,visitId:FD.pgAssessment(st(),id).visitId,assessmentId:id,phase:'AFTER'}),'secondary sm','camera'):null,
     // one tap when the Before photo shows nothing to fix
     role==='VSR'&&editable&&!(S.findings||[]).some(f=>f.status==='OPEN')?FD.btn(t('SC_NO_CHANGE'),()=>{FD.dx('SC_NO_CHANGE',{id});redraw();},'ghost sm','check'):null));
  const sideSw=beforeCol&&afterCol?h('div',{class:'sc-side-sw'},FD.seg([{id:'BEFORE',label:t('PG_BEFORE')},{id:'AFTER',label:t('PG_AFTER')}],side,v=>{FD.ui.local['sc:side:'+id]=v;redraw();})):null;
  const swap=bPs.length&&aPs.length&&S.cmp?.afterSource!=='NEXT'&&(editable||role==='SUP')?FD.btn(t('SC_SWAP'),()=>{FD.dx('SC_SWAP',{id});redraw();},'ghost sm','refresh'):null;
  const photos=h('div',null,h('div',{class:'sc-photos-bar'},sideSw,swap),h('div',{class:'sc-cols'},beforeCol,afterCol));
  if(!S.analysed)return h('div',{class:'stack s12 sc-panel'},photos);
  const pending=[S.before,S.after].some(s=>s&&!s.final&&!s.none),none=[S.before,S.after].some(s=>s&&s.none);
  // one line: Shelf Score before → after and the change, so the points never float without context
  const head=S.before||S.after?h('div',{class:'sc-summary'},h('span',{class:'small muted'},t('SC_SCORE')),S.before?FD.scChip(S.before):null,S.before&&S.after?FD.icon('arrow-right','s14'):null,S.after?FD.scChip(S.after):null,
   S.change!=null?FD.chip(t('SC_CHANGE',{change:signed(S.change)}),S.change>0?'good':S.change<0?'bad':''):null,S.nextVisit?FD.chip(t('SC_NEXT_VISIT',{date:FD.fmt.date(S.nextVisit)}),'info'):null):null;
  // area bars only when the score is real; an unclear photo never shows 100s
  const cur=S.current&&S.current.final?S.current:null,areas=cur?h('div',{class:'sc-areas'},FD.SC_AREAS.map(a=>{const v=cur.areas[a.id].score;
   return h('div',{class:'sc-area'},h('span',null,t('SC_AREA_'+a.id)),h('span',{class:'sc-meter'},h('i',{style:{width:(v==null?0:v)+'%'}})),h('span',{class:'small tabular'},v==null?'—':FD.fmt.num(v,0)));})):null;
  // One row of choices: the likely answers first; for a fix, the three "couldn't" reasons sit behind one button.
  const set=(f,o)=>{FD.dx('SC_ACTION_SET',{id,check:f.check,outcome:f.outcome===o?null:o});redraw();};
  const choice=(f,o)=>h('button',{type:'button',class:'sc-out'+(f.outcome===o?' on':''),'aria-pressed':String(f.outcome===o),on:{click:()=>set(f,o)}},t('SC_OUT_'+o));
  const CANT=['NOT_IN_VAN','OWNER_NO','NEED_HELP'];
  const outcomes=f=>f.status==='NEW'?null:!editable?(f.outcome?h('div',{class:'row'},FD.chip(t('SC_OUT_'+f.outcome),['NOT_IN_VAN','OWNER_NO','NEED_HELP','OWNER_AWAY'].includes(f.outcome)?'warn':'')):null)
   :h('div',{class:'row sc-outcomes'},f.cls==='ASK'?FD.SC_OUTCOMES.ASK.map(o=>choice(f,o)):[choice(f,'DONE'),choice(f,'PARTLY_DONE'),
    h('button',{type:'button',class:'sc-out'+(CANT.includes(f.outcome)?' on':''),'aria-haspopup':'menu',on:{click:e=>FD.menu(e.currentTarget,CANT.map(o=>({icon:f.outcome===o?'check':null,label:t('SC_OUT_'+o),onClick:()=>set(f,o)})))}},
     CANT.includes(f.outcome)?t('SC_OUT_'+f.outcome):t('SC_OUT_CANT'),FD.icon('chevron-down','s14'))]);
  // where each issue goes after the After photo (or while waiting for one)
  const nextStep=f=>f.status==='FIXED'?'SC_NEXT_CLOSED':['NOT_IN_VAN','NEED_HELP'].includes(f.outcome)||f.urgent?'SC_NEXT_TODAY':f.outcome==='OWNER_NO'||f.outcome==='OWNER_AWAY'?'SC_NEXT_OWNER':f.status==='NEW'?'SC_NEXT_NEW':f.status==='OPEN'&&!f.outcome?'SC_NEXT_THIS':f.status==='OPEN'?'SC_NEXT_VERIFY':'SC_NEXT_OPEN';
  const card=f=>{const s=f.status==='OPEN'&&f.outcome==='DONE'?'WAIT':f.status;
   return h('article',{class:'sc-finding'+(f.urgent?' urgent':'')},
    h('div',{class:'row between wrap'},h('span',{class:'row'},h('span',{class:'sc-num'},FD.fmt.num(f.n)),h('b',null,t('SC_CHK_'+f.check))),FD.chip(t('SC_ST_'+s),TONE[s])),
    h('p',{class:'small'},t('SC_DO_'+f.check)),outcomes(f),nextStep(f)==='SC_NEXT_THIS'?null:h('p',{class:'small muted sc-next'},FD.icon('arrow-right','s14'),t(nextStep(f))), // the section heading already says 'to do on this visit'
    role==='SUP'&&f.status!=='NEW'?FD.btn(t('SC_NOT_CORRECT'),()=>{FD.dx('SC_DISMISS',{id,check:f.check});redraw();},'ghost sm'):null);};
  const main=listed.filter(f=>f.status!=='NEW'),fresh=listed.filter(f=>f.status==='NEW'),first=role==='VSR'?main.slice(0,3):main,rest=role==='VSR'?main.slice(3):[];
  const fx=S.fixes,fixes=fx.total?h('p',{class:'small'},h('b',null,t('SC_FIXES')),' ',t('SC_N_OF_M',{n:FD.fmt.num(fx.verified),m:FD.fmt.num(fx.total)}),fx.waiting?' · '+t('SC_WAITING',{n:FD.fmt.num(fx.waiting)}):null):null;
  const comp=h('section',{class:'stack s8'},h('h4',null,t('SC_COMPETITION')),
   S.competition.length?h('div',{class:'stack s8'},[...new Set(S.competition.map(c=>c.signal))].map(sig=>{const bs=S.competition.filter(c=>c.signal===sig&&BRAND[c.brand]).map(c=>t(BRAND[c.brand]));
     return h('div',{class:'sc-comp-row'},h('span',null,t('SC_'+sig)),bs.length?h('div',{class:'row wrap sc-chips'},bs.map(b=>FD.chip(b,'outline'))):null);})):h('p',{class:'small muted'},t('SC_COMP_NONE')));
  return h('div',{class:'stack s12 sc-panel'},
   S.urgent?h('div',{class:'banner bad'},FD.icon('alert'),h('span',null,t('SC_URGENT'))):null,
   S.mismatch?h('div',{class:'banner info'},FD.icon('info'),h('span',null,t('SC_NOT_SAME'))):null,
   head,pending?h('p',{class:'small muted'},t('SC_PENDING')):null,none?h('p',{class:'small muted'},t('SC_NO_OURS')):null,role==='SUP'?null:photos,role==='SUP'?null:areas,
   S.good?FD.chip(t('SC_GOOD'),'good'):null,
   main.length?h('section',{class:'stack s8'},h('h4',null,t(role==='VSR'&&editable&&!S.after?'SC_TODO':'SC_ISSUES')),first.map(card),
    rest.length?(FD.ui.local['sc:more:'+id]?rest.map(card):FD.btn(t('SC_MORE_TODO',{n:FD.fmt.num(rest.length)}),()=>{FD.ui.local['sc:more:'+id]=true;redraw();},'ghost sm')):null):null,
   fresh.length?h('section',{class:'stack s8'},h('h4',null,t('SC_NEW_ISSUES')),fresh.map(card)):null,
   role==='SUP'?photos:null,role==='SUP'?areas:null, // supervisor: issues first, evidence below
   fixes,
   role==='VSR'&&editable&&S.before&&!S.after&&main.length?h('p',{class:'small muted'},t('SC_TAKE_AFTER')):null,
   S.seen.length?h('p',{class:'small'},h('b',null,t('SC_SEEN')),' ',S.seen.map(x=>t('SC_FAM_'+x)).join(FD.lang==='ar'?'، ':', ')):null,
   comp);
 };
 FD.pgCaptureSheet=({store,visitId,assessmentId,phase='BEFORE'})=>{
  let id=assessmentId||current(store,visitId)?.id,busy=false,status='',failures=[];
  const save=async files=>{
   if(busy)return;const capturedPhase=phase;busy=true;status=t('PG_SAVING');FD.sheet.redraw();
   const result=await FD.pgReadPhotos(files);failures=result.failed.slice();
   // Known field photos carry their analysis by file name, so the result appears as soon as the photo is saved.
   const pending=result.savedInputs.map(p=>({id:p.id,src:p.src,phase:capturedPhase,ref:FD.scLookup(p.name),name:p.name}));
   if(pending.length){
    if(!id){id='pg-'+FD.key();FD.dx('PG_START',{id,store,visitId,vsr:st().vsrId});}
    const saved=FD.tryPhotoBatch({key:FD.key(),id,photos:pending.map(({name,...p})=>p)});
    status=saved?t('PG_SAVED'):t('PG_NOT_SAVED');if(!saved)failures.push(...pending.map(p=>p.name));
   }else status='';
   if(result.failed.length)status+=' '+t('PG_FAILED',{n:FD.fmt.num(result.failed.length)});
   busy=false;FD.sheet.redraw();
  };
  FD.sheet.open({title:t('PG_TAKE'),render:()=>{
   const input=h('input',{id:'pg-files',type:'file',accept:'image/*',multiple:true,hidden:true,on:{change:e=>{const fs=[...e.target.files];e.target.value='';return save(fs);}}});
   const photos=id?FD.pgPhotos(st(),id):[],before=photos.filter(p=>p.phase==='BEFORE').at(-1);
   const reference=phase==='AFTER'&&before&&!photos.some(p=>p.phase==='AFTER');
   const editable=!!id&&FD.pgAssessment(st(),id).date===st().clock.date;
   return h('div',{class:'stack s12 pg-capture'},
    FD.seg(['BEFORE','AFTER'].map(p=>({id:p,label:t('PG_'+p)})),phase,v=>{phase=v;FD.sheet.redraw();}),
    h('p',{class:'small muted'},t('PG_CAPTURE_HINT')),
    reference?h('div',{class:'capture-reference'},FD.photoButton({src:before.src,label:t('PG_BEFORE')}),h('span',{class:'small muted'},t('PG_MATCH_ANGLE'))):null,
    (ps=>ps.length?h('div',{class:'photo-strip'},ps.map(p=>h('button',{type:'button',class:'photo-thumb','aria-label':t('PG_'+phase),on:{click:()=>FD.lightbox(p.src)}},h('img',{src:p.src,alt:''})))):null)(photos.filter(p=>p.phase===phase)),
    input,h('button',{class:'btn primary block',type:'button',disabled:busy,on:{click:()=>input.click()}},FD.icon('camera','s16'),t(photos.some(p=>p.phase===phase)?'PG_ADD_MORE':'PG_ADD')),
    h('div',{role:'status','aria-live':'polite',class:'small'},status,failures.length?h('ul',null,failures.map(name=>h('li',null,name))):null),
    id?FD.scPanel(id,{role:'VSR',editable,redraw:()=>FD.sheet.redraw()}):null);
  },footer:()=>[FD.btn(t('L_DONE'),()=>{FD.sheet.close();FD.render();},'secondary block')]});
 };
 // App-bar camera: Before or After from one button; a phase that already has photos shows a tick and stays usable.
 FD.scCameraButton=({store,visitId})=>{
  const a=current(store,visitId),has=ph=>!!a&&FD.pgPhotos(st(),a.id).some(p=>p.phase===ph),done=has('BEFORE')||has('AFTER');
  return h('button',{type:'button',class:'icon-btn sc-camera'+(done?' has':''),'aria-label':t('PG_TAKE_PHOTOS'),title:t('PG_TAKE_PHOTOS'),'aria-haspopup':'menu',
   on:{click:e=>FD.menu(e.currentTarget,['BEFORE','AFTER'].map(phase=>({icon:has(phase)?'check-circle':'camera',label:t('PG_CAPTURE_'+phase)+(has(phase)?' · '+t('PG_TAKEN'):''),onClick:()=>FD.pgCaptureSheet({store,visitId,phase})})).concat({icon:'eye',label:t('PG_CAPTURE_COMP'),onClick:()=>FD.compCaptureSheet({store})}))}},
   FD.icon('camera'),done?h('span',{class:'sc-camera-tick','aria-hidden':'true'},FD.icon('check','s12')):null);
 };
 // Competitor photo: brand, what was seen, optional note. Saved as competition, never scored by Shelf Check.
 FD.compCaptureSheet=({store})=>{
  const S={srcs:[],brand:null,seen:[],note:''};
  const input=h('input',{type:'file',accept:'image/*',multiple:true,hidden:true,on:{change:async e=>{for(const f of [...e.target.files]){try{S.srcs.push(await FD.readPhoto(f));}catch(err){FD.toast('S_PHOTO_BIG');}}e.target.value='';FD.sheet.redraw();}}});
  const chip=(on,label,click)=>h('button',{type:'button',class:'chip lg chip-btn'+(on?' on':''),'aria-pressed':String(on),on:{click}},label);
  const save=()=>{const ok=S.srcs.every(src=>FD.tryCompPhoto({key:FD.key(),id:'cp-'+FD.key(),store,vsr:st().vsrId,src,brand:S.brand,seen:S.seen,note:S.note}));
   FD.toast(ok?'S_SAVED':'PG_NOT_SAVED');if(ok){FD.sheet.close();FD.render();}};
  FD.sheet.open({title:t('PG_CAPTURE_COMP'),render:()=>{
   const ta=h('textarea',{class:'textarea',dir:'auto',maxlength:'200',rows:'2',placeholder:t('L_ADD_COMMENT')+' · '+t('L_OPTIONAL'),'aria-label':t('L_ADD_COMMENT'),on:{input:e=>{S.note=e.target.value;}}});ta.value=S.note;
   return h('div',{class:'stack s12'},h('p',{class:'small muted'},t('CI_HINT')),input,
    S.srcs.length?h('div',{class:'photo-strip'},S.srcs.map((src,i)=>h('div',{class:'photo-thumb'},h('img',{src,alt:'',on:{click:()=>FD.lightbox(src)}}),h('button',{type:'button','aria-label':t('L_REMOVE'),on:{click:()=>{S.srcs.splice(i,1);FD.sheet.redraw();}}},FD.icon('x','s14'))))):null,
    h('button',{class:'btn '+(S.srcs.length?'secondary':'primary')+' block',type:'button',on:{click:()=>input.click()}},FD.icon('camera','s16'),t(S.srcs.length?'PG_ADD_MORE':'CI_ADD')),
    h('div',{class:'small muted'},t('L_WHICH_BRAND')),h('div',{class:'row wrap'},FD.COMP_BRANDS.map(b=>chip(S.brand===b,t(b),()=>{S.brand=b;FD.sheet.redraw();}))),
    h('div',{class:'small muted'},t('CI_WHAT')),h('div',{class:'row wrap'},FD.COMP_SEEN.map(k=>chip(S.seen.includes(k),t(k),()=>{S.seen=S.seen.includes(k)?S.seen.filter(x=>x!==k):S.seen.concat(k);FD.sheet.redraw();}))),
    ta);
  },footer:()=>[h('button',{type:'button',class:'btn primary lg block',disabled:!S.srcs.length||!S.brand,on:{click:save}},t('L_SAVE'))]});
 };
 // Store competition for both roles: one line per brand, then the latest competitor photos.
 FD.compSection=(store,{take=false,flat=false}={})=>{
  const C=FD.compIntel(st(),store),sig=k=>t(k.startsWith('CI_')?k:'SC_'+k);
  return h('div',{class:'stack s8'},
   take?FD.btn(t('PG_CAPTURE_COMP'),()=>FD.compCaptureSheet({store}),'secondary sm','camera'):null,
   C.brands.length?h('div',{class:flat?'':'card'},C.brands.map(b=>h('div',{class:'list-row',style:{alignItems:'flex-start'}},
    h('div',{class:'grow',style:{minWidth:0}},h('b',null,t(b.brand)),
     h('div',{class:'small muted'},[b.lost?t('CI_LOST',{n:FD.fmt.num(b.lost)}):null,b.photos?t('CI_PHOTOS',{n:FD.fmt.num(b.photos)}):null,t('CI_LAST',{date:FD.fmt.date(b.last)})].filter(Boolean).join(' · ')),
     b.signals.length?h('div',{class:'row wrap',style:{gap:'4px',marginTop:'4px'}},b.signals.map(k=>FD.chip(sig(k),'outline'))):null)))):h('p',{class:'small muted'},t('CI_NONE')),
   C.photos.length?h('div',{class:'photo-day'},C.photos.slice(0,4).map(p=>FD.photoButton({src:p.src,label:t(p.brand)+' · '+FD.fmt.date(p.date)+(p.note?' · '+p.note:'')}))):null,
   h('p',{class:'small muted'},t('CI_FROM')));
 };
 // Read-only (or today: editable) view of one check, opened from Offer and Profile.
 FD.scSheet=id=>{const a=FD.pgAssessment(st(),id);if(!a)return;
  FD.sheet.open({title:t('SC_TITLE')+' · '+FD.fmt.date(a.date),render:()=>FD.scPanel(id,{role:'VSR',editable:a.date===st().clock.date,redraw:()=>FD.sheet.redraw()}),
   footer:()=>[FD.btn(t('L_DONE'),()=>{FD.sheet.close();FD.render();},'secondary block')]});};
 // A supervisor request shows on the store until a Before photo answers it, or the salesman says why he couldn't.
 FD.scRequestCard=({store,visitId})=>{const r=FD.scRequest(st(),store);if(!r||r.status!=='OPEN')return null;
  return h('div',{class:'v-card sc-request'},h('div',{class:'row'},FD.icon('camera'),h('b',{class:'grow'},t('SC_REQ_VSR'))),h('div',{class:'small muted'},FD.fmt.date(r.at.date)),
   h('div',{class:'row wrap'},FD.btn(t('SC_REQ_TAKE'),()=>FD.pgCaptureSheet({store,visitId,phase:'BEFORE'}),'primary sm','camera'),
    h('button',{type:'button',class:'btn secondary sm','aria-haspopup':'menu',on:{click:e=>FD.menu(e.currentTarget,['CLOSED','OWNER_NO','NO_ACCESS'].map(k=>({label:t('SC_REQ_'+k),onClick:()=>{FD.dx('SC_REQUEST_BLOCK',{id:r.id,reason:k});FD.render();}})))}},t('SC_OUT_CANT'),FD.icon('chevron-down','s14'))));};
 // Offer tab: this visit's check in one line, with the first thing to do.
 FD.scVisitCard=({store,visitId})=>{
  const a=current(store,visitId),S=a&&FD.scSummary(st(),a.id);if(!S||!S.analysed||!S.current)return null;
  const next=S.findings.find(f=>f.status!=='FIXED'&&!f.outcome);
  return h('button',{type:'button',class:'v-card sc-visit'+(S.urgent?' urgent':''),on:{click:()=>FD.scSheet(a.id)}},
   h('div',{class:'row between'},h('b',null,t('SC_TITLE')),h('span',{class:'row'},FD.scChip(S.current),FD.icon('chevron-right','s16'))),
   h('div',{class:'small muted'},S.good?t('SC_GOOD'):t('SC_OPEN')+' · '+FD.fmt.num(S.open)),
   next?h('div',{class:'small'},t('SC_DO_'+next.check)):null);
 };
 FD.scHistory=(store,open=FD.scSheet)=>{
  const rows=FD.pgAssessments(st(),store).map(a=>({a,s:FD.scSummary(st(),a.id)})).filter(x=>x.s&&x.s.analysed&&x.s.current);
  if(!rows.length)return h('p',{class:'small muted'},t('SC_NONE'));
  return h('div',{class:'card'},rows.map(({a,s})=>h('button',{type:'button',class:'list-row click',style:{width:'100%',textAlign:'start'},on:{click:()=>open(a.id)}},
   h('span',{class:'grow'},FD.fmt.date(a.date)),h('span',{class:'small muted'},t('SC_OPEN')+' · '+FD.fmt.num(s.open)),FD.scChip(s.current))));
 };
 FD.pgOfferAdvice=rec=>{
  const candidate=FD.productPrice(rec.sku);
  const smaller=FD.SKUS.map(k=>FD.productPrice(k.code)).find(p=>FD.packValueComparison(p,candidate));const value=smaller&&FD.packValueComparison(smaller,candidate);
  return value?h('div',{class:'pg-offer-advice small'},FD.icon('check-circle','s14'),t('PG_VALUE_LINE',{label:FD.nameOf(FD.sku(smaller.code))})):null; // one plain line; percentages stay out of the salesman's way
 };
})();
