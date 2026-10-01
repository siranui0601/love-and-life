/** Physical review contract shared by the renderer, walking, traffic and audits.
 * Metres for heights/distance; world positions remain SW-origin kilometres.
 */
import {CAPITAL,distance,nearestOnSegment,distanceToLine,elevationAt,terrainBaseAt,pointInPolygon} from './capital-data.js';
import {normalizeState,stateClosures,pathPolyline,polylineLengthM} from './capital-routing.js';

import {sampleLine,locateOnLine,edgeHeightAt,surfaceAt} from './capital-surfaces.js';
export {sampleLine,locateOnLine,edgeHeightAt,surfaceAt} from './capital-surfaces.js';
export function barrierFor(edge){
 const hit=locateOnLine(edge.points,polylineLengthM(edge.points)/2),d=hit.direction,len=Math.hypot(...d)||1;
 const tangent=[d[0]/len,d[1]/len],normal=[-tangent[1],tangent[0]],half=(edge.widthM/2+2.5)/1000;
 return {edgeId:edge.id,position:hit.position,points:[hit.position.map((v,i)=>v-normal[i]*half),hit.position.map((v,i)=>v+normal[i]*half)],heightM:2.4,widthM:edge.widthM+5};
}
const physicalBarriers=new Map(CAPITAL.edges.map(e=>[e.id,barrierFor(e)]));
export function activeBarriers(input={}){return stateClosures(input).map(c=>({...physicalBarriers.get(c.edgeId),reason:c.reason}));}
// Oriented footprint, matching the exact rendered mass (including the larger castle).
export function massFootprint(b){
 const castle=b.facilityId==='LOC_CAP_CASTLE';
 return {...b,widthM:b.widthM,depthM:b.depthM,heightM:castle?210:b.facilityId==='LOC_CAP_MAGE_TOWER'?157:b.royalPart?b.heightM+53:b.heightM+(b.roofHeightM||0)};
}
export function pointInMass(position,b,paddingM=0){
 const dx=(position[0]-b.position[0])*1000,dz=-(position[1]-b.position[1])*1000,angle=b.rotationRad||0;
 const x=dx*Math.cos(angle)-dz*Math.sin(angle),z=dx*Math.sin(angle)+dz*Math.cos(angle);
 return Math.abs(x)<b.widthM/2+paddingM&&Math.abs(z)<b.depthM/2+paddingM;
}
const masses=[...CAPITAL.buildings,...CAPITAL.furnishings].map(massFootprint);
// Spatial buckets keep eye-level movement independent of total city building count.
const cellM=80,buckets=new Map();
const key=p=>Math.floor(p[0]*1000/cellM)+','+Math.floor(p[1]*1000/cellM);
for(const b of masses){const r=Math.hypot(b.widthM,b.depthM)/2+1;for(let x=Math.floor((b.position[0]*1000-r)/cellM);x<=Math.floor((b.position[0]*1000+r)/cellM);x++)for(let y=Math.floor((b.position[1]*1000-r)/cellM);y<=Math.floor((b.position[1]*1000+r)/cellM);y++){const k=x+','+y;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(b);}}
export function obstacleAt(position,input={},radiusM=.48,barriers=activeBarriers(input)){
 const state=normalizeState(input);
 for(const b of buckets.get(key(position))||[])if(pointInMass(position,b,radiusM))return 'mass:'+b.id;
 for(const w of CAPITAL.walls)if(distanceToLine(position,w.points)<w.widthM/2+radiusM)return 'wall:'+w.id;
 for(const b of barriers)if(distanceToLine(position,b.points)<1+radiusM)return 'closure:'+b.edgeId;
 
 const crossing=CAPITAL.bridges.find(b=>distanceToLine(position,b.points)<=b.widthM/2-radiusM);
 for(const river of CAPITAL.rivers){const waterWidth=state.weather==='flood'?river.highFlowWidthM:river.widthM;if(distanceToLine(position,river.points)<waterWidth/2+radiusM&&!crossing)return 'river';}
 return null;
}
export function moveWalker(from,deltaM,input={},options={}){
 const total=Math.hypot(...deltaM),steps=Math.max(1,Math.ceil(total/.4)),barriers=options.barriers||activeBarriers(input),state=normalizeState(input);
 let position=[...from],heightM=surfaceAt(from).heightM,travelledM=0,blocked=null;
 for(let i=0;i<steps;i++){
  const next=[position[0]+deltaM[0]/steps/1000,position[1]+deltaM[1]/steps/1000],surface=surfaceAt(next);
  blocked=obstacleAt(next,state,.48,barriers);
  const entersRestricted=state.access!=='permitted'&&CAPITAL.districts.some(d=>d.gateTag&&pointInPolygon(next,d.polygon)&&!pointInPolygon(position,d.polygon));
  if(entersRestricted)blocked='social-boundary';
  if(surface.heightM-heightM>.5)blocked='unreachable-ledge';
  if(blocked)break;
  travelledM+=distance(position,next);position=next;heightM=surface.heightM;
 }
 return {position,heightM,travelledM,blocked};
}
export function orientedRouteSamples(path,spacingM=8){
 return sampleLine(pathPolyline(path),spacingM).map(position=>({position,...surfaceAt(position)}));
}
// Height-sensitive visibility, not an infinitely empty ground-plane ray. Target spires
// may be visible while their lower silhouette is hidden. Camera-facing visibility is separate.
export function landmarkVisibility(position,targetId,eyeHeightM=1.7){
 const f=CAPITAL.facilities.find(f=>f.nodeId===targetId),target=f?.buildingPosition||CAPITAL.nodes.find(n=>n.id===targetId)?.position;
 if(!target)return {visible:false,reason:'unknown-target'};
 const eyeY=surfaceAt(position).heightM+eyeHeightM,top=elevationAt(...target)+(targetId==='castle'?210:targetId==='mage_tower'?157:12);
 const ray=sampleLine([position,target],4),length=distance(position,target);
 for(const p of ray.slice(1,-3)){
  const y=eyeY+(top-eyeY)*distance(position,p)/(length||1);
  if(elevationAt(...p)>y)return {visible:false,reason:'terrain'};
  for(const b of buckets.get(key(p))||[])if(b.facilityId!==f?.id&&b.canonicalParent!==f?.id&&pointInMass(p,b)&&elevationAt(...b.position)+b.heightM>y)return {visible:false,reason:b.id};
 }
 return {visible:true,distanceM:length};
}
