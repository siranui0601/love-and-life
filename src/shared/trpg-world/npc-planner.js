import {distance,followPath} from './navigation.js';
import {willingToCooperate} from './relationships.js';

export function planForGoal(state,content,npc,template,chosen) {
  const region=content.regions.find(r=>r.id===npc.region);
  const home=npc.displacedHome||(template.region===npc.region?template.home:region.spawn);
  const work=template.region===npc.region?template.work:region.objects.find(o=>o.kind==='job')?.position||home;
  npc.possessions||={supplies:1};npc.money??=8;
  const steps=[],move=position=>steps.push({action:'move',position:[...(position||home)]});
  if(chosen.goal==='eat') {
    if(!(npc.possessions.supplies>0)) {
      const shop=region.objects.find(o=>o.kind==='shop');
      if(!shop)return {goal:'seek-food',steps:[{action:'move',position:[...home]},{action:'ask-food'}],cursor:0,createdAt:state.time};
      if(npc.money<4){move(work);steps.push({action:'work',minutes:60,pay:6});}
      move(shop.position);steps.push({action:'purchase-food',targetId:shop.id});
    }
    move(home);steps.push({action:'consume-food',minutes:15});
  } else {
    move(chosen.target||home);
    steps.push({action:chosen.goal==='sleep'?'rest':chosen.goal==='work'?'work':'observe',minutes:30,pay:chosen.goal==='work'?3:0});
  }
  return {goal:chosen.goal,steps,cursor:0,createdAt:state.time,reasons:chosen.goal==='respond'&&willingToCooperate(state,npc)?
    npc.memories.filter(m=>m.kind==='promise-kept').map(m=>m.factId):[]};
}
export function advancePlan(state,content,npc,seconds) {
  const plan=npc.plan;if(!plan)return false;
  const region=content.regions.find(r=>r.id===npc.region),step=plan.steps[plan.cursor];
  if(!step)return true;
  if(step.action==='move') {
    followPath(region,npc,step.position,seconds/(content.time?.scale||60)*(npc.goal==='flee'?3.2:1.55));
    if(distance(npc.position,step.position)<2)plan.cursor++;
    return false;
  }
  step.elapsed=(step.elapsed||0)+seconds;
  if(step.elapsed<(step.minutes||5)*60)return true;
  if(step.action==='purchase-food') {
    if(npc.money>=4&&state.regions[npc.region].stock>.15){npc.money-=4;npc.possessions.supplies=(npc.possessions.supplies||0)+1;state.regions[npc.region].stock-=.001;}
    else {npc.nextDecision=0;delete npc.plan;return true;}
  }
  if(step.action==='consume-food'&&npc.possessions.supplies>0){npc.possessions.supplies--;npc.hunger=Math.max(0,npc.hunger-55);}
  if(step.action==='rest')npc.fatigue=Math.max(0,npc.fatigue-12);
  if(step.action==='work'){npc.money+=step.pay||3;state.regions[npc.region].stock=Math.min(1.8,state.regions[npc.region].stock+.002);}
  plan.cursor++;
  if(plan.cursor>=plan.steps.length){npc.nextDecision=0;delete npc.plan;}
  return true;
}
