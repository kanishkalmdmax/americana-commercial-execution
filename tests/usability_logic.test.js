const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load');
test('all metric comparisons use relative percent changes and handle zero baselines',()=>{
 const FD=load();
 assert.ok(Math.abs(FD.relativeChange(59,51.1)-15.45988258)<1e-6);
 assert.ok(Math.abs(FD.relativeChange(7,9.9)+29.29292929)<1e-6);
 assert.ok(Math.abs(FD.relativeChange(8.7,10)+13)<1e-6);
 assert.equal(FD.relativeChange(0,0),0);assert.equal(FD.relativeChange(2,0),null);
 for(const pair of [[null,2],[2,null],[NaN,2],[2,Infinity]])assert.equal(FD.relativeChange(...pair),null);
});
test('unread team messages remain represented in navigation badges',()=>{
 const FD=load();FD.init(7,{storage:null});const s=FD.state;s.threads=[{team:true,unreadSup:1}];s.ownerMsgs=[];
 assert.equal(FD.supervisorBadgeCounts(s).msgs,1);assert.equal(FD.supervisorBadgeCounts(s,[s.world.vsrs[0].id]).msgs,1);
});
test('metric action context scopes alerts and follow-ups and carries historical dates',()=>{
 const FD=load();FD.init(7,{storage:null});const s=FD.state,id=s.world.vsrs.find(v=>v.kind==='sales').id,ctx=FD.metricActionContext(s,{ids:[id],from:FD.PILOT_START,to:FD.dataDay(s)});
 assert.ok(ctx.groups.every(g=>g.van===id));assert.ok(ctx.followUps.every(f=>f.slots.vsrId===id||s.world.stores.some(x=>x.id===f.slots.storeId&&x.vsr===id)));
 assert.equal(ctx.to,FD.dataDay(s));assert.ok(ctx.groups.every(g=>g.day===ctx.to));
 const old=FD.addDays(s.clock.date,-2);assert.equal(FD.metricActionContext(s,{ids:[id],from:old,to:old}).to,old);
});
test('store count uses the complete filtered result and badges share one scoped count',()=>{
 const FD=load();FD.init(7,{storage:null});const s=FD.state,ids=s.world.vsrs.map(v=>v.id),rows=FD.visibleStoreRows(s,{},ids);
 assert.equal(rows.length,s.world.stores.length);assert.ok(rows.length>50);
 const one=rows[0].s;assert.equal(FD.visibleStoreRows(s,{q:one.id},ids).length,1);
 const badges=FD.supervisorBadgeCounts(s,ids);assert.equal(badges.today,FD.supervisorAlertGroups(s,ids).length);
 assert.equal(FD.supervisorBadgeCounts(s,[]).today,0);
});
