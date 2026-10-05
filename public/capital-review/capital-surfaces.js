import {CAPITAL,distance,nearestOnSegment,distanceToLine,elevationAt,terrainBaseAt} from './capital-data.js';
import {surveyedHeightAt} from './capital-terraces.js';
export function sampleLine(points,spacingM=8){
 const out=[points[0]];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(distance(a,b)/spacingM));
  if(distance(a,b)<1e-8)continue;
  for(let j=1;j<=steps;j++)out.push([a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps]);
 }
 return out;
}
export function locateOnLine(points,metres){
 let remaining=Math.max(0,metres);
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],len=distance(a,b);
  if(remaining<=len||i===points.length-1){const t=Math.min(1,remaining/(len||1));return {position:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],direction:[b[0]-a[0],b[1]-a[1]],segment:i-1,t};}
  remaining-=len;
 }
 return {position:points[0],direction:[0,1],segment:0,t:0};
}
export function edgeHeightAt(edge,position){
 const contextBridge=CAPITAL.bridges.find(b=>b.context&&b.edgeId===edge.id&&distanceToLine(position,b.points)<b.widthM/2+.1&&distance(position,b.position)<b.lengthM/2);
 if(edge.bridgeId||contextBridge){
  const bridge=contextBridge||CAPITAL.bridges.find(b=>b.id===edge.bridgeId),a=bridge.points[0],b=bridge.points.at(-1),total=distance(a,b),travel=distance(a,nearestOnSegment(position,a,b));
  const rise=Math.min(1,travel/32,(total-travel)/32);
  // Both ends meet their approach exactly; the deck clears the water in the middle.
  return terrainBaseAt(...position)+.28+Math.max(0,rise)*(bridge.deckHeightM-terrainBaseAt(...bridge.position));
 }
 if(edge.surfaceOffsetsM){
  const a=edge.points[0],b=edge.points.at(-1),total=distance(a,b),travel=distance(a,nearestOnSegment(position,a,b));let t=travel/(total||1);if(edge.surfaceRampM)t=edge.surfaceOffsetsM[0]<edge.surfaceOffsetsM[1]?Math.max(0,(travel-total+edge.surfaceRampM)/edge.surfaceRampM):Math.min(1,travel/edge.surfaceRampM);
  const u=travel/(total||1),base=edge.deckBaseHeightsM?edge.deckBaseHeightsM[0]*(1-u)+edge.deckBaseHeightsM.at(-1)*u:elevationAt(...position);
  return base+.28+edge.surfaceOffsetsM[0]*(1-t)+edge.surfaceOffsetsM[1]*t;
 }
 return (edge.streetHeightsM?surveyedHeightAt(edge,position):elevationAt(...position))+.28;
}
// Local queries must remain practical as neighbourhood lanes become a real mesh.
const roadBuckets=new Map(),roadCell=.06,courtPlots=CAPITAL.buildings.filter(b=>b.courtyardId);
for(const e of CAPITAL.edges)for(let i=1;i<e.points.length;i++){const a=e.points[i-1],b=e.points[i],pad=(e.widthM/2+1)/1000;for(let x=Math.floor((Math.min(a[0],b[0])-pad)/roadCell);x<=Math.floor((Math.max(a[0],b[0])+pad)/roadCell);x++)for(let y=Math.floor((Math.min(a[1],b[1])-pad)/roadCell);y<=Math.floor((Math.max(a[1],b[1])+pad)/roadCell);y++){const key=x+','+y;if(!roadBuckets.has(key))roadBuckets.set(key,new Set());roadBuckets.get(key).add(e);}}
export function surfaceAt(position){
 let best=null,min=Infinity;
 for(const e of roadBuckets.get(Math.floor(position[0]/roadCell)+','+Math.floor(position[1]/roadCell))||[]){
  const d=distanceToLine(position,e.points);
  if(d<=e.widthM/2+.15&&d<min){best=e;min=d;}
 }
 let heightM=best?edgeHeightAt(best,position):elevationAt(...position);
 if(!best&&courtPlots.some(b=>{const dx=(position[0]-b.position[0])*1000,dy=(position[1]-b.position[1])*1000,t=b.rotationRad;return Math.abs(dx*Math.cos(t)+dy*Math.sin(t))<b.widthM/2&&Math.abs(-dx*Math.sin(t)+dy*Math.cos(t))<b.depthM/2;}))heightM+=.28;
 if(!best?.bridgeId&&!best?.surfaceOffsetsM&&CAPITAL.negativeSpaces.some(s=>distance(position,s.position)<=s.radiusM))heightM=Math.max(heightM,elevationAt(...position)+.3);
 return {heightM,edgeId:best?.id||null,edge:best};
}
