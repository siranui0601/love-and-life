import {distance,hasLineOfSight,followPath} from './navigation.js';
import {worldSite} from './actor-journey.js';
import {consumeResources} from './world-semantics.js';
import {rememberAction} from './relationships.js';
import {damageStructure} from './aftermath.js';

// A closed physical vocabulary, not an arbitrary authored state mutation.
// These actions use the same persistent approach/windup state as assaults.
export function advancePhysicalOperation(state,content,spec,op,actor,seconds){
 const target=spec.kind==='ignite-structure'?worldSite(content,spec.targetSiteId):state.npcs[spec.targetActorId];
 const region=content.regions.find(r=>r.id===actor.region);
 const visible=target&&target.hp!==0&&!target.travel&&!actor.travel&&target.region===actor.region&&distance(actor.position,target.position)<18&&hasLineOfSight(region,actor.position,target.position);
 const withdraw=reason=>{const fact=rememberAction(state,content,'physical-attempt-abandoned',{actorId:actor.id,targetId:spec.targetSiteId,payload:{reason}});op.phase='withdrawn';op.stoppedAt=state.time;op.stopFactId=fact.id;delete actor.operationAssignment;delete actor.plan;actor.nextDecision=0;};
 if(!visible){delete op.hitAt;if(state.time-(op.searchStartedAt??state.time)>(spec.searchSeconds||4*3600))withdraw('target-not-observed');return;}
 const structure=spec.structureId&&state.structures[spec.structureId],patient=spec.patientProcessId&&state.processes[spec.patientProcessId];
 if(spec.kind==='ignite-structure'&&(!structure||structure.fuel===false||structure.fire>0)){withdraw('no-exposed-fuel');return;}
 if(spec.kind==='administer-substance'&&(!patient||patient.medicineSecured||patient.exposed)){withdraw('medicine-not-accessible');return;}
 if(Object.entries(spec.requiredResources||{}).some(([id,n])=>(actor.possessions[id]||0)<n)){withdraw('required-material-missing');return;}
 actor.activity=spec.kind==='ignite-structure'?'燃えやすい物のそばで手を動かしている':'薬包を持って相手へ近づく';
 if(distance(actor.position,target.position)>=2.5){delete op.hitAt;followPath(region,actor,target.position,seconds/(content.time?.scale||60)*1.55);return;}
 if(op.hitAt===undefined){const fact=rememberAction(state,content,'physical-action-started',{actorId:actor.id,targetId:target.id,payload:{action:spec.kind}});op.attemptFactId=fact.id;op.hitAt=state.time+spec.windupSeconds;return;}
 if(state.time<op.hitAt)return;
 if(!consumeResources(actor.possessions,spec.requiredResources||{}))return;
 const fact=rememberAction(state,content,spec.kind==='ignite-structure'?'ignition':'substance-administered',{actorId:actor.id,targetId:target.id,payload:{attemptFactId:op.attemptFactId,resources:spec.requiredResources}});
 if(spec.kind==='ignite-structure'){
  structure.ignitionFactId=fact.id;damageStructure(state,content,content.structures.find(s=>s.id===spec.structureId));
 }else{
  patient.exposed=true;patient.exposureFactId=fact.id;target.injury={kind:'poison',treated:false,at:state.time,sourceFactId:fact.id};target.hp=Math.min(target.hp,40);
 }
 op.phase='completed';op.completedAt=state.time;op.resultFactId=fact.id;delete actor.operationAssignment;delete actor.plan;actor.nextDecision=0;
}
