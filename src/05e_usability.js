(function(){
 const FD=globalThis.FD;
 FD.relativeChange=(now,before)=>{
  if(!Number.isFinite(now)||!Number.isFinite(before))return null;
  if(before===0)return now===0?0:null;
  return 100*(now-before)/Math.abs(before);
 };
 const owns=(st,ids,vsr,store)=>ids.includes(vsr)||!!store&&st.world.stores.some(x=>x.id===store&&ids.includes(x.vsr));
 FD.supervisorAlertGroups=(st,scopeIds)=>{
  const d=st.clock.date,dd=FD.dataDay(st),ids=scopeIds||st.world.vsrs.map(v=>v.id);
  const groups=dd===d?FD.alertGroups(st,d):FD.alertGroups(st,dd).filter(x=>!['A_PREORDER','A_PACE'].includes(x.type)).concat(FD.alertGroups(st,d).filter(x=>x.type==='A_PREORDER'));
  return groups.filter(g=>ids.includes(g.van)).map(g=>({...g,day:g.type==='A_PREORDER'?d:dd}));
 };
 FD.metricActionContext=(st,{ids,from,to})=>{
  ids=ids||st.world.vsrs.map(v=>v.id);return {ids,from,to,groups:FD.alertGroups(st,to).filter(g=>ids.includes(g.van)).map(g=>({...g,day:to})),followUps:FD.followUps(st).filter(f=>owns(st,ids,f.slots.vsrId,f.slots.storeId))};
 };
 FD.supervisorBadgeCounts=(st,scopeIds)=>{
  const ids=scopeIds||st.world.vsrs.map(v=>v.id);return {today:FD.supervisorAlertGroups(st,ids).length,weekly:FD.followUps(st).filter(f=>owns(st,ids,f.slots.vsrId,f.slots.storeId)).length,msgs:st.threads.filter(x=>x.unreadSup&&(x.team||owns(st,ids,x.vsr,x.store||x.anchor?.type==='store'&&x.anchor.id))).length};
 };
 FD.visibleStoreRows=(st,f={},scopeIds)=>{
  const ids=scopeIds||st.world.vsrs.map(v=>v.id),stores=st.world.stores.filter(x=>ids.includes(x.vsr)),attn=new Map(FD.storesNeedingAttention(st,stores.map(x=>x.id),st.clock.date).map(x=>[x.id,x])),q=(f.q||'').trim().toLowerCase();
  return stores.filter(x=>(!f.label||x.label===f.label)&&(!f.size||x.size===f.size)&&(!f.tag||x.tags.includes(f.tag))&&(!f.attn||attn.has(x.id))&&(!q||(x.name+' '+x.name_ar+' '+x.id).toLowerCase().includes(q))).map(s=>({s,g:FD.storeGlance(st,s.id,st.clock.date),a:attn.get(s.id),score:attn.get(s.id)?.score||0,resp:FD.storeResponse(st,s.id)}));
 };
})();
