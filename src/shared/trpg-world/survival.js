import {setActivity} from './activity.js';
import {distance,findPath,followPath,hasLineOfSight} from './navigation.js';
import {rememberAction,evaluateCooperation} from './relationships.js';
export const NEEDS=Object.freeze({limit:100,hungerPerDay:45,fatiguePerDay:48,sleepRecoveryPerHour:12,mealRelief:40,treatmentSeconds:7200});
export function collapse(state,content,cause) {
  if(state.player.collapse?.status==='active')return;
  const p=state.player,region=content.regions.find(r=>r.id===p.region);
  const nearby=Object.values(state.npcs).filter(n=>n.hp>0&&!n.travel&&n.region===p.region&&distance(n.position,p.position)<25&&hasLineOfSight(region,n.position,p.position));
  p.collapse={status:'active',cause,at:state.time,location:{region:p.region,position:[...p.position]},
    nearbyEntities:nearby.map(n=>n.id),witnesses:nearby.map(n=>n.id),weather:structuredClone(state.weather[p.region]),
    danger:Object.values(state.monsters).filter(m=>m.hp>0&&m.region===p.region&&distance(m.position,p.position)<15).map(m=>m.id),
    possessions:structuredClone(p.inventory),eventContext:Object.values(state.events).filter(e=>['active','critical'].includes(e.status)&&content.events.some(t=>t.id===e.id&&t.region===p.region)).map(e=>e.id),
    injury:{kind:cause==='hp'?'trauma':'exhaustion',treated:false},rescue:null};
  setActivity(state,'collapsed');rememberAction(state,content,'collapse',{payload:{cause}});
}
export function advanceNeeds(state,content,seconds) {
  const p=state.player;p.hunger??=20;p.fatigue??=0;
  if(p.collapse?.status!=='active') {
    p.hunger=Math.min(NEEDS.limit,p.hunger+seconds/86400*NEEDS.hungerPerDay);
    p.fatigue=Math.max(0,Math.min(NEEDS.limit,p.fatigue+seconds*(p.activity.kind==='sleeping'?-NEEDS.sleepRecoveryPerHour/3600:NEEDS.fatiguePerDay/86400)));
    if(p.hp<=0||p.hunger>=NEEDS.limit||p.fatigue>=NEEDS.limit)collapse(state,content,p.hp<=0?'hp':p.hunger>=NEEDS.limit?'hunger':'fatigue');
  }
}
export function advanceRescue(state,content,seconds) {
  const p=state.player,c=p.collapse;if(c?.status!=='active')return;
  const region=content.regions.find(r=>r.id===p.region);
  if(!c.rescue) {
    const facility=region.objects?.find(o=>['inn','clinic'].includes(o.kind)&&findPath(region,p.position,o.position).length);
    if(!facility)return;
    const reasoning=new Map();
    const rescuer=Object.values(state.npcs).filter(n=>n.hp>0&&!n.travel&&!n.captive&&!n.injury&&!n.causalAssignment&&!n.rescueAssignment&&n.region===p.region&&
      distance(n.position,p.position)<25&&hasLineOfSight(region,n.position,p.position)&&findPath(region,n.position,p.position).length&&
      !Object.values(state.monsters).some(m=>m.hp>0&&m.region===n.region&&distance(m.position,n.position)<10))
      .filter(n=>{
        const template=content.npcs.find(t=>t.id===n.id),role=template?.role||'',personality=template?.personality||'';
        const capable=n.hp>30&&n.fatigue<85&&!/幼児|子供|少年|少女|赤子/.test(role);
        const duty=/医|薬|衛|兵|農|宿|修道|神官/.test(role),compassion=/親切|慈悲|世話|温厚/.test(personality);
        const relation=evaluateCooperation(state,n,{risk:.2,purpose:'rescue'});
        const motivation=(duty?3:0)+(compassion?2:0)+Math.max(0,relation.utility)-(n.hunger>85?4:0)-(n.goal==='flee'?10:0);
        const reason={capable,motivation,duty,compassion,relationshipEvidence:relation.evidence,resources:{medicine:n.possessions?.medicine||0},currentActivity:n.goal};reasoning.set(n.id,reason);
        return capable&&motivation>0;
      })
      .sort((a,b)=>reasoning.get(b.id).motivation-reasoning.get(a.id).motivation||distance(a.position,p.position)-distance(b.position,p.position)||a.id.localeCompare(b.id))[0];
    if(!rescuer)return;
    c.rescue={actorId:rescuer.id,facilityId:facility.id,phase:'approaching',discoveredAt:state.time,reasoning:reasoning.get(rescuer.id),services:[]};
    rescuer.rescueAssignment='player';rescuer.nextDecision=0;
  }
  const rescue=c.rescue,npc=state.npcs[rescue.actorId],facility=region.objects.find(o=>o.id===rescue.facilityId);
  if(!npc||npc.hp<=0||npc.travel||npc.captive||npc.region!==p.region||!facility) {
    if(npc)delete npc.rescueAssignment;c.rescue=null;return;
  }
  const budget=seconds/(content.time?.scale||60)*1.4;
  if(rescue.phase==='approaching') {
    npc.activity='倒れた人のもとへ向かう';followPath(region,npc,p.position,budget);
    if(distance(npc.position,p.position)<2){
      if(c.injury.kind==='trauma'&&npc.possessions?.medicine>0){npc.possessions.medicine--;rescue.services.push({kind:'medicine',itemId:'medicine',quantity:1,providerId:npc.id,cost:content.items.find(i=>i.id==='medicine')?.price||0});}
      rescue.phase='carrying';rescue.pickedUpAt=state.time;
    }
  } else if(rescue.phase==='carrying') {
    npc.activity='負傷者を運ぶ';followPath(region,npc,facility.position,budget);p.position=[...npc.position];
    if(distance(npc.position,facility.position)<2){rescue.phase='treatment';rescue.treatmentStartedAt=state.time;rescue.services.push({kind:'bed',providerId:facility.id,quantity:1,cost:facility.services?.bed?.price??(facility.kind==='inn'?8:0)});setActivity(state,'recovering',{expectedEndAt:state.time+NEEDS.treatmentSeconds});}
  } else if(state.time-rescue.treatmentStartedAt>=NEEDS.treatmentSeconds) {
    c.status='recovered';c.recoveredAt=state.time;c.injury.treated=true;
    p.hp=Math.max(30,p.hp);p.hunger=Math.min(p.hunger,40);p.fatigue=Math.min(p.fatigue,35);
    let paid=0;p.medicalDebts||=[];
    for(const service of rescue.services){const payment=Math.min(p.gold,service.cost);p.gold-=payment;paid+=payment;service.paid=payment;
      if(service.cost>payment)p.medicalDebts.push({creditor:service.providerId,facilityId:facility.id,service:service.kind,amount:service.cost-payment,at:state.time});}

    rememberAction(state,content,'rescue',{actorId:npc.id,targetId:'player',payload:{collapseAt:c.at,facilityId:facility.id,paid}});
    delete npc.rescueAssignment;setActivity(state,'idle');
  }
}
