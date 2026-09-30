import test from 'node:test';
import assert from 'node:assert/strict';
import {CAPITAL,pointInPolygon,polygonArea,distanceToLine} from '../public/capital-review/capital-data.js';
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
  for(const b of CAPITAL.buildings.filter(x=>!x.facilityId)){
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
