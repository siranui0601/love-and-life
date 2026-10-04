import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPITAL,pointInPolygon,polygonArea,distanceToLine,distance,elevationAt} from '../public/capital-review/capital-data.js';
import {findAlternatives,edgeAvailability,normalizeState,pathMetrics,stateClosures} from '../public/capital-review/capital-routing.js';

const facilityIds=new Set(CAPITAL.facilities.map(f=>f.id));
const node=id=>CAPITAL.nodes.find(n=>n.id===id);
const edge=id=>CAPITAL.edges.find(e=>e.id===id);

test('authored core is 6.5 km² and activity envelope is a distinct terrain-led 20–24 km² footprint',()=>{
 assert.ok(Math.abs(CAPITAL.core.areaKm2-6.5)<.001);
 assert.ok(CAPITAL.activityEnvelope.areaKm2>=20&&CAPITAL.activityEnvelope.areaKm2<=24);
 assert.ok(CAPITAL.activityEnvelope.designLogic.includes('非相似形'));
 assert.ok(Math.abs(polygonArea(CAPITAL.activityEnvelope.polygon)-CAPITAL.activityEnvelope.areaKm2)<1e-9);
 assert.notEqual(CAPITAL.core.polygon.length,0);
 for(const gate of CAPITAL.gates)assert.ok(pointInPolygon(gate.position,CAPITAL.activityEnvelope.polygon),gate.id+' must sit in activity envelope');
});

test('all twelve canonical capital facilities resolve, including canonical weapon shop ID and conditional reuse of orphanage parcel',()=>{
 const expected=['LOC_CAP_CASTLE','LOC_CAP_MAGE_TOWER','LOC_CAP_LOWER_INN','LOC_CAP_MARKET','LOC_CAP_WEAPON_SHOP','LOC_CAP_APOTHECARY',
  'LOC_CAP_ORPHANAGE','LOC_CAP_BIG_STORE','LOC_CAP_OFFICE','LOC_CAP_NEWSPAPER','LOC_CAP_STABLE','LOC_CAP_AJIN_QUARTER'];
 assert.deepEqual([...expected].sort(),[...facilityIds].sort());
 assert.equal(facilityIds.has('LOC_CAP_WEAPON'),false);
 const orphanage=CAPITAL.facilities.find(f=>f.id==='LOC_CAP_ORPHANAGE'),store=CAPITAL.facilities.find(f=>f.id==='LOC_CAP_BIG_STORE');
 assert.deepEqual(orphanage.position,store.position);
 assert.deepEqual(store.activeWhen,{event:'T10',state:'failed'});
 for(const f of CAPITAL.facilities)assert.ok(pointInPolygon(f.position,CAPITAL.core.polygon),f.id+' must be inside authored core');
});

test('three public gates each have at least two meaningfully distinct routes to the market in normal conditions',()=>{
 const state=normalizeState({access:'public'});
 for(const gate of ['west_gate','south_gate','east_gate']){
  const paths=findAlternatives(gate,'market',state,CAPITAL,3);
  assert.ok(paths.length>=2,gate+' requires two routes');
  assert.notDeepEqual(paths[0].edgeIds,paths[1].edgeIds);
  assert.ok(paths.every(p=>p.metrics.distanceM>0&&p.metrics.minutes>0));
 }
});

test('social gating is topology, not an enemy-level wall',()=>{
 assert.equal(findAlternatives('market','castle',{access:'public'},CAPITAL,2).length,0);
 const permitted=findAlternatives('market','castle',{access:'permitted'},CAPITAL,2);
 assert.ok(permitted.length>=1);
 assert.ok(permitted[0].edgeIds.some(id=>id.includes('royal')));
});

test('flood closes the low bridge but leaves high-bridge urban circulation',()=>{
 const low=edge('west_bridge');
 assert.equal(edgeAvailability(low,{weather:'clear'},CAPITAL).open,true);
 const flooded=edgeAvailability(low,{weather:'flood'},CAPITAL);
 assert.equal(flooded.open,false);assert.equal(flooded.reason,'flood');
 const alt=findAlternatives('stable','inn',{weather:'flood',access:'public'},CAPITAL,2);
 assert.ok(alt.length>=1,'flood must detour rather than partition ordinary city');
 assert.equal(alt[0].edgeIds.includes('west_bridge'),false);
});

test('T10/T11/T16/T17 reuse the city graph and only active incidents impose their authored temporary barriers',()=>{
 for(const id of ['T10','T11','T16','T17']){
  const incident=CAPITAL.encounterStates[id];
  assert.ok(incident.districts.length);
  assert.ok(incident.investigationNodes.every(n=>node(n)));
  const idle=stateClosures({events:{[id]:'idle'}},CAPITAL).filter(c=>incident.blockedEdgeIds.includes(c.edgeId));
  assert.equal(idle.length,0);
  const active=stateClosures({events:{[id]:'active'},access:'permitted'},CAPITAL).filter(c=>incident.blockedEdgeIds.includes(c.edgeId));
  assert.equal(active.length,incident.blockedEdgeIds.length);
  for(const edgeId of incident.blockedEdgeIds)assert.ok(edge(edgeId),'missing '+edgeId);
 }
});

test('NPC life routes are physically routable in the same graph',()=>{
 for(const flow of CAPITAL.npcFlows){
  const access=flow.access?'permitted':'public';
  const paths=findAlternatives(flow.from,flow.to,{access},CAPITAL,1);
  assert.ok(paths.length,flow.id+' has no physical route');
  const metrics=pathMetrics(paths[0],CAPITAL);
  assert.ok(metrics.distanceM>0&&Number.isFinite(metrics.walkSeconds));
 }
});

test('level-design contracts include distinct landmarks, compression/release nodes, vertical change and connected macro approaches',()=>{
 assert.equal(CAPITAL.gates.length,3);
 assert.ok(CAPITAL.bridges.length>=4);
 assert.ok(CAPITAL.buildings.length>1000);
 assert.ok(CAPITAL.viewpoints.some(v=>v.target==='castle'));
 assert.ok(CAPITAL.viewpoints.some(v=>v.target==='mage_tower'));
 assert.ok(CAPITAL.nodes.filter(n=>n.kind==='plaza').length>=5);
 assert.ok(CAPITAL.nodes.filter(n=>n.kind==='checkpoint').length>=3);
 assert.deepEqual(CAPITAL.worldConnections.map(c=>c.id).sort(),['R06','R11','R12','R13']);
 const castle=node('castle'),market=node('market');
 assert.ok(castle&&market);
 assert.ok(CAPITAL.facilities.find(f=>f.id==='LOC_CAP_CASTLE').heightM>CAPITAL.facilities.find(f=>f.id==='LOC_CAP_OFFICE').heightM);
});


test('authored sight corridors stay physically clear enough for cognitive-map landmarks',()=>{
 assert.ok(CAPITAL.sightCorridors.length>=3);
 for(const corridor of CAPITAL.sightCorridors){
  const target=node(corridor.target);assert.ok(target,'missing target '+corridor.target);
  for(const b of CAPITAL.buildings.filter(x=>!x.facilityId&&!x.canonicalParent)){
   const radius=Math.hypot(b.widthM,b.depthM)/2;
   const clearance=distanceToLine(b.position,corridor.points);
   assert.ok(clearance>=radius+corridor.widthM/2-1e-6,
    b.id+' blocks '+corridor.id+' at '+clearance.toFixed(2)+'m');
  }
 }
});

test('compression/release rhythm is encoded as gates/checkpoints feeding plazas rather than a uniform street field',()=>{
 const compressions=CAPITAL.nodes.filter(n=>['gate','checkpoint','bridge-end'].includes(n.kind));
 const releases=CAPITAL.nodes.filter(n=>n.kind==='plaza');
 assert.ok(compressions.length>=10);
 assert.ok(releases.length>=5);
 assert.ok(CAPITAL.edges.some(e=>e.class==='alley'));
 assert.ok(CAPITAL.edges.some(e=>e.class==='stairs'));
 assert.ok(CAPITAL.edges.some(e=>e.class==='ceremonial'));
});


test('gate-to-market alternatives are spatially different, not cosmetic branches that immediately rejoin',()=>{
 const jaccard=(a,b)=>{const A=new Set(a.edgeIds),B=new Set(b.edgeIds),union=new Set([...A,...B]);return [...A].filter(x=>B.has(x)).length/union.size;};
 for(const gate of ['west_gate','south_gate','east_gate']){
  const routes=findAlternatives(gate,'market',{access:'public'},CAPITAL,2);
  assert.equal(routes.length,2);
  assert.ok(jaccard(routes[0],routes[1])<.75,gate+' alternatives share too much topology');
  assert.notEqual(routes[0].edges[0].designRole,undefined);
 }
});

test('Deep Research spatial principles exist as inspectable beats rather than prose-only guidance',()=>{
 const types=new Set(CAPITAL.levelDesignBeats.map(b=>b.type));
 for(const required of ['compression','release','prospect','refuge','desire-path','social-gate','decision','hazard-edge','reveal'])
  assert.ok(types.has(required),'missing '+required);
 for(const beat of CAPITAL.levelDesignBeats){
  assert.ok(node(beat.nodeId),'beat must resolve to a physical node: '+beat.id);
  assert.deepEqual(beat.position,node(beat.nodeId).position);
  assert.equal(beat.source,'deep-research-application');
  assert.ok(beat.intent.length>12);
 }
});

test('street hierarchy carries semantic traversal roles for logistics, daily life, shortcuts and ceremonial orientation',()=>{
 const roles=new Set(CAPITAL.edges.map(e=>e.designRole));
 for(const required of ['critical-logistics','orientation-ceremonial','optional-life','service-logistics','desire-path','desire-shortcut','world-connector'])
  assert.ok(roles.has(required),'missing '+required);
});

// Regression + physical acceptance: graph connectivity alone missed the old geometry mutation.
import {pathPolyline,shortestPath} from '../public/capital-review/capital-routing.js';
import {sampleLine,moveWalker,activeBarriers,edgeHeightAt,surfaceAt,landmarkVisibility,obstacleAt} from '../public/capital-review/capital-spatial.js';
import {trafficPlans,trafficAgents} from '../public/capital-review/capital-traffic.js';
const majorPairs=[['west_gate','market'],['south_gate','market'],['east_gate','market'],['market','castle'],['market','lower_court'],['market','ajin'],['ajin','east_gate'],['inn','castle']];
function assertPhysicalRoute(path,state){
 assert.ok(path,'route missing');const ps=sampleLine(pathPolyline(path),3),barriers=activeBarriers(state);
 for(let i=1;i<ps.length;i++){
  const a=ps[i-1],b=ps[i],result=moveWalker(a,[(b[0]-a[0])*1000,(b[1]-a[1])*1000],state,{barriers});
  assert.equal(result.blocked,null,'physical route blocked: '+result.blocked+' near '+b.join(','));
 }
}
test('repeated 2D/NPC/state rendering cannot mutate roads or change metrics',()=>{
 const before=JSON.stringify(CAPITAL.edges),expected=majorPairs.map(pair=>findAlternatives(...pair,{access:'permitted'},CAPITAL,1)[0].metrics);
 for(let pass=0;pass<4;pass++){
  for(const pair of majorPairs)for(const p of findAlternatives(...pair,{access:'permitted'},CAPITAL,3))pathPolyline(p);
  for(const hour of [7,12,18])trafficAgents(trafficPlans({hour}),pass*100);
 }
 assert.equal(JSON.stringify(CAPITAL.edges),before);
 assert.deepEqual(majorPairs.map(pair=>findAlternatives(...pair,{access:'permitted'},CAPITAL,1)[0].metrics),expected);
 assert.ok(expected[0].distanceM>1200&&expected[0].distanceM<1250);
});
test('reverse routes measure uphill/downhill in travel order and include slopes between endpoints',()=>{
 const path=shortestPath('market','castle',{access:'permitted'}),reverse={...path,nodes:[...path.nodes].reverse(),edges:[...path.edges].reverse()};
 const up=pathMetrics(path),down=pathMetrics(reverse);
 assert.ok(up.ascentM>60,'sample the hill crest, not just endpoint differences');
 assert.ok(Math.abs(up.ascentM-down.descentM)<1e-7);
 assert.ok(Math.abs(up.descentM-down.ascentM)<1e-7);
 assert.ok(up.walkSeconds>down.walkSeconds);
});
test('every rendered road including facility doors, roof deck and world connections is physically traversable',()=>{
 const state={access:'permitted'};
 for(const e of CAPITAL.edges)assertPhysicalRoute({nodes:[e.from,e.to],edges:[e],edgeIds:[e.id]},state);
});
test('eight requested routes physically connect at eye height, rather than merely passing graph tests',()=>{
 for(const pair of majorPairs)assertPhysicalRoute(shortestPath(...pair,{access:'permitted'}),{access:'permitted'});
});
test('public city services stay connected under all 16 simultaneous incident combinations and flood',()=>{
 for(const weather of ['clear','flood'])for(let mask=0;mask<16;mask++){
  const state={weather,access:'public',events:Object.fromEntries(['T10','T11','T16','T17'].map((id,i)=>[id,mask&(1<<i)?'active':'idle']))};
  for(const facility of CAPITAL.facilities.filter(f=>!f.gateTag&&f.id!=='LOC_CAP_BIG_STORE'))assert.ok(shortestPath('market',facility.nodeId,state),weather+' mask '+mask+' '+facility.id);
 }
 const combined={weather:'flood',events:{T10:'active',T11:'active',T16:'active',T17:'active'}};
 assertPhysicalRoute(shortestPath('market','orphanage',combined),combined);
});
test('bridges and roof routes have continuous real height, and river/closures prevent crossing',()=>{
 const bridge=CAPITAL.bridges.find(b=>b.id==='south_bridge'),e=edge('south_bridge');
 assert.ok(edgeHeightAt(e,bridge.position)>surfaceAt(node('south_quay').position).heightM+2);
 const roof=CAPITAL.edges.find(e=>e.class==='roof');assert.ok(roof,'roof must exist as a physical surface');
 assert.ok(edgeHeightAt(roof,roof.points[0])>elevationAt(...roof.points[0])+4);
 const low=CAPITAL.bridges.find(b=>b.id==='west_bridge');assert.equal(obstacleAt(low.position,{weather:'flood'}),'closure:west_bridge');
 const river=CAPITAL.rivers[0];assert.equal(obstacleAt([22.1,21.08],{}),'river');
 const crossing=CAPITAL.bridges.find(b=>b.outside);assert.ok(crossing,'R06 needs a real exterior bridge');
});
test('landmarks are physically visible at reserved viewpoints and intermittently hidden along streets',()=>{
 for(const v of CAPITAL.viewpoints)assert.equal(landmarkVisibility(v.position,v.target).visible,true,v.id);
 for(const from of ['west_gate','south_gate','east_gate']){
  const samples=sampleLine(pathPolyline(shortestPath(from,'market')),40),visible=samples.map(p=>landmarkVisibility(p,'castle').visible);
  assert.ok(visible.includes(true)&&visible.includes(false),from+' must have conceal/reveal, not a permanently exposed castle');
 }
});
test('street frontage encloses roads while negative spaces retain their authored footprints',()=>{
 assert.ok(CAPITAL.buildings.filter(b=>b.frontageEdgeId).length>300);
 for(const space of CAPITAL.negativeSpaces)for(const b of CAPITAL.buildings.filter(b=>!b.facilityId))
  assert.ok(distance(b.position,space.position)>=space.radiusM+Math.hypot(b.widthM,b.depthM)/2,space.id+' invaded by '+b.id);
});
test('traffic changes with time, reflects at endpoints without warps and reroutes across incidents',()=>{
 const morning=trafficPlans({hour:7}),noon=trafficPlans({hour:12}),evening=trafficPlans({hour:18});
 assert.ok(morning.find(p=>p.id==='coach').count>noon.find(p=>p.id==='coach').count);
 assert.ok(evening.find(p=>p.id==='guest').count>noon.find(p=>p.id==='guest').count);
 for(const hour of [7,12,18]){
  const plans=trafficPlans({hour}),a=trafficAgents(plans,300),b=trafficAgents(plans,300.1);
  for(let i=0;i<a.length;i++)assert.ok(distance(a[i].position,b[i].position)<.15,'no endpoint teleport');
 }
 const evacuation=trafficPlans({events:{T16:'active'}});assert.ok(evacuation.filter(p=>p.oneWay).length>=3);
 for(const p of evacuation.filter(p=>p.oneWay)){assert.equal(p.from,p.id==='courtyard-ajin'?CAPITAL.courtyards.find(c=>c.district==='ajin').innerFrom:'ajin');assert.ok(p.route);assert.equal(p.route.edgeIds.includes('ajin_east__ajin'),false);}
 const flood=trafficPlans({weather:'flood'});for(const p of flood)assert.ok(!p.route?.edgeIds.includes('west_bridge'));
});
test('state barriers span the full actual road width and manual movement cannot bypass a social boundary',()=>{
 const closures=activeBarriers({events:{T11:'active'},access:'permitted'}),b=closures.find(b=>b.edgeId==='royal_gate__castle_court');
 assert.ok(b.widthM>edge(b.edgeId).widthM);
 const start=[22.568,22.025],result=moveWalker(start,[0,10],{access:'public'});
 assert.ok(result.blocked,'public access must not slip through a district edge');
});
