/** Deterministic review schedules, not live-game NPC identities or an event clock. */
import {CAPITAL} from './capital-data.js';
import {normalizeState,findAlternatives,pathPolyline,polylineLengthM} from './capital-routing.js';
import {locateOnLine,surfaceAt} from './capital-spatial.js';

const activity={merchant:[3,5,1],guard:[3,2,3],clerk:[4,3,0],noble:[1,2,1],porter:[4,5,1],artisan:[3,4,1],coach:[5,2,1],carer:[2,2,2],news:[4,3,1],resident:[2,2,5],guest:[4,1,5]};
export function trafficPlans(input={}){
 const s=normalizeState(input),period=s.hour<10?0:s.hour<18?1:2;
 const plans=CAPITAL.npcFlows.map(flow=>{
  let from=flow.from,to=flow.to,purpose=period===0?'朝の到着・出勤':period===1?'昼の仕事・買物':'夕方の帰宅・宿泊';
  if(period===2)[from,to]=[to,from];
  if(period===2&&flow.id==='guest'){from='market';to='inn';}
  if(period===2&&flow.id==='resident'){from='east_gate';to='ajin';}
  if(s.events.T10==='failed'&&flow.id==='carer'){from='inn';to='apothecary';purpose='用地変更後の生活導線（レビュー案）';}
  if(s.events.T10==='active'&&flow.id==='clerk'){from='office';to='orphanage';purpose='用地問題の執行・確認導線';}
  if(s.events.T11==='active'&&flow.id==='news'){from='office';to='market';purpose='市場への捜査情報';}
  if(s.events.T16==='active'&&['resident','carer','artisan'].includes(flow.id)){
   from='ajin';to=flow.id==='resident'?'inn':flow.id==='carer'?(s.events.T10==='failed'?'inn':'orphanage'):'market';purpose='同じ街路で避難・誘導';
  }
  if(s.events.T17==='active'&&flow.id==='guard'){from='office';to='mage_tower';purpose='宮廷連絡路から塔へ迂回';}
  const route=findAlternatives(from,to,{...s,access:flow.access?'permitted':'public'},CAPITAL,1)[0];
  const points=route?pathPolyline(route):[],lengthM=polylineLengthM(points);
  return {id:flow.id,name:flow.name,flow,from,to,purpose,count:activity[flow.id][period],route,points,lengthM,speedMps:['coach','porter','merchant'].includes(flow.id)?1.1:1.3,oneWay:s.events.T16==='active'&&['resident','carer','artisan'].includes(flow.id)};
 });
 for(const district of ['lower','ajin','quay']){const court=CAPITAL.courtyards.find(c=>c.district===district);if(!court)continue;
  const evacuation=district==='ajin'&&s.events.T16==='active',edges=court.edgeIds.map(id=>CAPITAL.edges.find(e=>e.id===id));
  const route=evacuation?findAlternatives(court.innerFrom,'inn',{...s,access:'public'},CAPITAL,1)[0]:{edges,edgeIds:court.edgeIds,nodes:[court.from,...edges.map(e=>e.to)]};
  const points=route?pathPolyline(route):[],purpose=evacuation?'共同庭から同じ街路を通って避難':period===2?'帰宅後の共同庭と路地の往来':district==='quay'?'荷役の合間に庭へ戻る':'共同庭での用事と近隣の往来';
  plans.push({id:'courtyard-'+district,name:district==='quay'?'河岸の作業者':'共同庭の住民',flow:{reason:'二つの入口を使う生活回遊'},from:evacuation?court.innerFrom:court.from,to:evacuation?'inn':court.to,purpose,count:[2,1,3][period],route,points,lengthM:polylineLengthM(points),speedMps:1.1,oneWay:evacuation});
 }
 return plans;
}
export function trafficAgents(plans,seconds=0){
 const out=[];
 for(const plan of plans){
  if(!plan.route||!plan.lengthM)continue;
  for(let i=0;i<plan.count;i++){
   const phase=i/(plan.count||1),dwell=20,cycle=plan.lengthM*2/plan.speedMps+dwell*2;
   let t=(seconds+phase*cycle)%cycle,metres,direction=1;
   if(plan.oneWay){metres=Math.min(plan.lengthM,seconds*plan.speedMps+phase*plan.lengthM*.6);}
   else if(t<plan.lengthM/plan.speedMps)metres=t*plan.speedMps;
   else if((t-=plan.lengthM/plan.speedMps)<dwell)metres=plan.lengthM;
   else if((t-=dwell)<plan.lengthM/plan.speedMps){metres=plan.lengthM-t*plan.speedMps;direction=-1;}
   else metres=0;
   const hit=locateOnLine(plan.points,metres),heightM=surfaceAt(hit.position).heightM;
   out.push({id:plan.id+':'+i,planId:plan.id,name:plan.name,position:hit.position,heightM,direction:hit.direction.map(v=>v*direction),cart:['coach','porter','merchant'].includes(plan.id),purpose:plan.purpose});
  }
 }
 return out;
}
export function trafficPressure(plans){
 const pressure=new Map();
 for(const p of plans)for(const id of p.route?.edgeIds||[])pressure.set(id,(pressure.get(id)||0)+p.count);
 return pressure;
}
