// Shelf Check scoring, pairing and follow-through.
const test=require('node:test');const assert=require('node:assert/strict');const load=require('./load');
const result=(FD,checks={},extra={})=>({scope:'AMBIENT_SHELF',photo:{status:'OK',reasons:[],display:'RACK'},
 checks:Object.fromEntries(FD.SC_CHECKS.map(c=>[c,checks[c]||{result:'PASS'}])),
 findings:Object.entries(checks).filter(([,v])=>['FAIL','PARTLY'].includes(v.result)).map(([check])=>({check,box_2d:[100,100,400,400]})),
 americana_seen:['CUPCAKE'],competition:[{signal:'COMP_NEXT',brand:'LUSINE',box_2d:[1,1,300,300]}],confidence:'HIGH',...extra});
const boot=(photos={},groups=[])=>{const FD=load();FD.SHELF_RESULTS={model:'test',photos,groups};FD.init(7,{storage:null});return FD;};
const fixture=FD=>({
 0:{file:'before.jpeg',result:result(FD,{FULL_EMPTY_SPACE:{result:'PARTLY',met:0.5},FIND_HIDDEN:{result:'FAIL'},FIND_WRONG_AREA:{result:'FAIL'},COND_DAMAGED_PACK:{result:'FAIL'},COND_ROTATION:{result:'CANT_SEE'},FULL_EMPTY_CARTON:{result:'NOT_APPLICABLE'},COND_CARTON:{result:'NOT_APPLICABLE'}})},
 1:{file:'after.jpeg',result:result(FD,{FULL_EMPTY_SPACE:{result:'PARTLY',met:0.75},FIND_WRONG_AREA:{result:'FAIL'},COND_ROTATION:{result:'CANT_SEE'},FIND_FACING:{result:'FAIL'},FULL_EMPTY_CARTON:{result:'NOT_APPLICABLE'},COND_CARTON:{result:'NOT_APPLICABLE'}})},
 2:{file:'other.jpeg',result:result(FD)},
 3:{file:'freezer.jpeg',result:{...result(FD),scope:'FREEZER',photo:{status:'NOT_SHELF',reasons:[],display:'OTHER'}}}});
const capture=(FD,id,photos)=>{const s=FD.state,store=s.world.stores[0].id;if(!FD.pgAssessment(s,id))FD.dispatch('PG_START',{id,store});FD.dispatch('PG_PHOTOS_ADD',{id,photos:photos.map(([pid,phase,ref])=>({id:pid,src:'x',phase,ref}))});return store;};

test('Shelf Score uses check importance, keeps unclear checks out and drops checks that cannot apply',()=>{
 const FD=load(),vals=FD.scCombine([fixture(FD)[0].result]),s=FD.scScore(vals,FD.SC_DEFAULT_WEIGHTS);
 // FULL: space 0.5×50 + forward 30 over 80 applicable; FIND: (0×35+0×30+20+15)/100; COND: damaged 0 of 40 assessed, rotation unclear
 assert.equal(+s.areas.FULL.score.toFixed(2),68.75);assert.equal(s.areas.FIND.score,35);assert.equal(s.areas.COND.score,0);
 const budget={FULL:40*0.8,FIND:35,COND:25*0.7},seen={FULL:32,FIND:35,COND:10};
 assert.equal(+s.coverage.toFixed(2),+(100*(seen.FULL+seen.FIND+seen.COND)/(budget.FULL+budget.FIND+budget.COND)).toFixed(2));
 assert.equal(s.final,true);
 const unclear=FD.scScore(FD.scCombine([result(FD,Object.fromEntries(FD.SC_CHECKS.map(c=>[c,{result:'CANT_SEE'}])))]),FD.SC_DEFAULT_WEIGHTS);
 assert.equal(unclear.score,null);assert.equal(unclear.final,false);
});
test('a matched After verifies each finding and reports change only on the same display',()=>{
 let FD=boot();FD=boot(fixture(FD),[[0,1]]);const s=FD.state;
 capture(FD,'A',[['b','BEFORE',0],['a','AFTER',1]]);
 const S=FD.scSummary(s,'A'),by=Object.fromEntries(S.findings.map(f=>[f.check,f.status]));
 assert.equal(S.comparable,true);assert.equal(by.FIND_HIDDEN,'FIXED');assert.equal(by.FULL_EMPTY_SPACE,'PARTLY_FIXED');assert.equal(by.FIND_WRONG_AREA,'STILL');assert.equal(by.COND_DAMAGED_PACK,'FIXED');
 assert.deepEqual(S.fresh.map(f=>f.check),['FIND_FACING']);assert.equal(S.findings[0].check,'COND_DAMAGED_PACK');
 assert.equal(+S.change.toFixed(4),+(S.after.score-S.before.score).toFixed(4));
 assert.equal(S.competition.length,1,'one sighting across Before and After');
 capture(FD,'B',[['b2','BEFORE',0],['a2','AFTER',2]]);const M=FD.scSummary(s,'B');
 assert.equal(M.mismatch,true);assert.equal(M.change,null);assert.ok(M.findings.every(f=>f.status==='CANT_CHECK'));
});
test('outcomes follow the action type; blockers leave Fixes done and reach the supervisor',()=>{
 let FD=boot();FD=boot(fixture(FD),[[0,1]]);const s=FD.state;capture(FD,'A',[['b','BEFORE',0]]);
 FD.dispatch('SC_ACTION_SET',{id:'A',check:'FIND_WRONG_AREA',outcome:'DONE'});assert.equal(FD.pgAssessment(s,'A').actions.FIND_WRONG_AREA,undefined,'ask-owner work cannot be marked done');
 FD.dispatch('SC_ACTION_SET',{id:'A',check:'FIND_WRONG_AREA',outcome:'OWNER_NO'});FD.dispatch('SC_ACTION_SET',{id:'A',check:'FIND_HIDDEN',outcome:'DONE'});FD.dispatch('SC_ACTION_SET',{id:'A',check:'FULL_EMPTY_SPACE',outcome:'NOT_IN_VAN'});
 let S=FD.scSummary(s,'A');assert.deepEqual(S.fixes,{verified:0,total:2,waiting:1});assert.equal(S.blockers.length,2);
 const fu=FD.pgFollowUps(s).find(f=>f.action.assessmentId==='A');assert.equal(fu.slots.n,2,'not in van plus the damaged pack; owner refusals stay on the store');
 FD.dispatch('PG_PHOTOS_ADD',{id:'A',photos:[{id:'a',src:'x',phase:'AFTER',ref:1}]});S=FD.scSummary(s,'A');assert.equal(S.fixes.verified,2,'hidden packs and the damaged pack are both fixed in the After');
 FD.dispatch('SC_DISMISS',{id:'A',check:'COND_DAMAGED_PACK'});assert.ok(!FD.scSummary(s,'A').findings.some(f=>f.check==='COND_DAMAGED_PACK'));
});
test('weights validate, freeze per check and only change new checks',()=>{
 let FD=boot();FD=boot(fixture(FD));const s=FD.state;capture(FD,'A',[['b','BEFORE',0]]);const before=FD.scSummary(s,'A').before.score;
 FD.dispatch('SC_WEIGHTS_SET',{weights:{FULL:50,FIND:50,COND:10}});assert.equal(s.rules.shelfWeights,undefined);
 FD.dispatch('SC_WEIGHTS_SET',{weights:{FULL:60,FIND:20,COND:20}});assert.deepEqual(FD.scWeights(s),{FULL:60,FIND:20,COND:20});
 assert.equal(FD.scSummary(s,'A').before.score,before);capture(FD,'N',[['n','BEFORE',0]]);assert.notEqual(FD.scSummary(s,'N').before.score,before);
 FD.dispatch('SC_WEIGHTS_SET',{weights:null});assert.deepEqual(FD.scWeights(s),FD.SC_DEFAULT_WEIGHTS);
});
test('photos without a result, unusable photos and the team view stay honest',()=>{
 let FD=boot();FD=boot(fixture(FD));const s=FD.state;
 capture(FD,'U',[['u','BEFORE',99]]);assert.equal(FD.scSummary(s,'U').analysed,false);assert.equal(s.photos.find(p=>p.id==='u').ref,null);
 capture(FD,'F',[['f','BEFORE',3]]);const F=FD.scSummary(s,'F');assert.equal(F.before,null);assert.equal(F.photos[0].status,'NOT_SHELF');
 capture(FD,'A',[['b','BEFORE',0]]);const vsr=FD.pgAssessment(s,'A').vsr,row=FD.scTeam(s,s.clock.date,s.clock.date,[vsr])[0];
 assert.equal(row.stores,1,'latest check per store');assert.equal(row.change,null);assert.ok(!('rank' in row));
});
test('seeded field photos become Before checks and same-display groups supply After photos',()=>{
 let FD=load();const photos=Object.fromEntries((FD.PHOTOS||[]).map((_,i)=>[i,{file:'p'+i+'.jpeg',result:fixture(FD)[i%2===0?0:1].result}]));
 FD=boot(photos,[[0,1]]);const s=FD.state,as=s.planogram.assessments.filter(a=>a.seeded);
 assert.ok(as.length>0);assert.ok(as.every(a=>FD.scSummary(s,a.id).analysed));assert.ok(as.some(a=>FD.scSummary(s,a.id).comparable));
 assert.ok(as.some(a=>Object.keys(a.actions).length));
});
test('a supervisor request is answered by a Before photo, or closed with a reason',()=>{
 let FD=boot();FD=boot(fixture(FD),[[0,1]]);const s=FD.state,store=s.world.stores[0].id,other=s.world.stores[1].id;
 FD.dispatch('SC_REQUEST',{store});FD.dispatch('SC_REQUEST',{store});assert.equal(s.planogram.requests.filter(r=>r.store===store&&r.status==='OPEN').length,1,'one open request per store');
 capture(FD,'R',[['rb','BEFORE',0]]);const r=FD.scRequest(s,store);assert.equal(r.status,'DONE');assert.equal(r.assessmentId,'R');
 FD.dispatch('SC_REQUEST',{store:other});const r2=FD.scRequest(s,other);FD.dispatch('SC_REQUEST_BLOCK',{id:r2.id,reason:'CLOSED'});assert.equal(FD.scRequest(s,other).status,'BLOCKED');
 FD.dispatch('SC_REQUEST_BLOCK',{id:r2.id,reason:'NONSENSE'});assert.equal(FD.scRequest(s,other).reason,'CLOSED');
});
test('issues without an After photo are checked on the next visit, and swapped photos can be flipped',()=>{
 let FD=boot();FD=boot(fixture(FD),[[0,1]]);const s=FD.state;
 capture(FD,'V1',[['v1b','BEFORE',0]]);assert.ok(FD.scSummary(s,'V1').findings.every(f=>f.status==='OPEN'));
 s.clock.time='23:59';capture(FD,'V2',[['v2b','BEFORE',1]]);const S1=FD.scSummary(s,'V1');
 assert.ok(S1.nextVisit,'checked by the later visit');assert.equal(S1.findings.find(f=>f.check==='FIND_HIDDEN').status,'FIXED');assert.equal(S1.findings.find(f=>f.check==='FIND_WRONG_AREA').status,'STILL');
 capture(FD,'SW',[['sa','AFTER',0],['sb','BEFORE',1]]);FD.dispatch('SC_SWAP',{id:'SW'});
 assert.deepEqual(FD.pgPhotos(s,'SW').map(p=>p.phase).sort(),['AFTER','BEFORE']);assert.equal(s.photos.find(p=>p.id==='sa').phase,'BEFORE');
});
test('a supervisor-added stop can be undone and the plan returns to how it was',()=>{
 const FD=boot(),s=FD.state,van=s.world.vsrs.find(v=>v.kind==='sales'),tm=FD.nextSellingDay(s.clock.date);
 const x=FD.planSuggestions(s,van.id,tm).find(y=>y.type!=='X_QUESTION'&&y.type!=='X_PREORDER');assert.ok(x);
 const before=s.visits.filter(v=>v.date===tm).length;FD.dispatch('OFFPLAN_ADD',{vsr:van.id,store:x.store,bySup:true,date:tm});
 assert.equal(s.visits.filter(v=>v.date===tm).length,before+1);FD.dispatch('SUP_STOP_UNADD',{store:x.store,date:tm});
 assert.equal(s.visits.filter(v=>v.date===tm).length,before);assert.ok(FD.planSuggestions(s,van.id,tm).some(y=>y.store===x.store),'suggestion returns');
});
