// Common durable envelope for completed and macro world actions. Physical simulation
// remains authoritative; clients cannot supply effects, duration, outcome, or fact IDs.
export function beginWorldAction(state,candidate) {
 const action={id:`world-action:${state.nextId++}`,actorId:'player',type:candidate.action,targetId:candidate.targetId||null,
  location:{region:state.player.region,position:[...state.player.position]},startedAt:{world:state.time,simulation:state.simulationTime},
  duration:{domain:'simulation',seconds:0},preconditions:['contextual-candidate-validated'],observable:{channel:['shout'].includes(candidate.action)?'audible':'visible'},status:'active',createdFactIds:[]};
 state.worldActionHistory||=[];state.worldActionHistory.push(action);if(state.worldActionHistory.length>100)state.worldActionHistory.shift();return action;
}
export function completeWorldAction(state,action,result) {
 action.status='completed';action.outcome=result.outcome||'performed';action.completedAt={world:state.time,simulation:state.simulationTime};action.createdFactIds=result.factId?[result.factId]:[];
 action.effects={factIds:action.createdFactIds,custodyIds:(state.propertyTransfers||[]).filter(t=>t.sourceFactId===result.factId).map(t=>t.id)};
 return {...result,worldActionId:action.id};
}
