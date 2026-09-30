import {CAPITAL,elevationAt,distance} from './capital-data.js';

export const DEFAULT_CITY_STATE=Object.freeze({
 weather:'clear',
 hour:12,
 access:'public',
 events:Object.freeze({T10:'idle',T11:'idle',T16:'idle',T17:'idle'})
});

const restrictedDistricts=new Set(['castle','noble','mage']);
const nodeById=()=>new Map(CAPITAL.nodes.map(n=>[n.id,n]));
const edgeById=()=>new Map(CAPITAL.edges.map(e=>[e.id,e]));
const bridgeById=()=>new Map(CAPITAL.bridges.map(b=>[b.id,b]));

export function normalizeState(input={}){
 return {
  weather:input.weather||DEFAULT_CITY_STATE.weather,
  hour:Number.isFinite(Number(input.hour))?Number(input.hour):12,
  access:input.access||DEFAULT_CITY_STATE.access,
  events:{...DEFAULT_CITY_STATE.events,...(input.events||{})}
 };
}

export function polylineLengthM(points){
 let total=0;
 for(let i=1;i<points.length;i++)total+=distance(points[i-1],points[i]);
 return total;
}

export function edgeAvailability(edge,inputState={},capital=CAPITAL){
 const state=normalizeState(inputState),nodes=new Map(capital.nodes.map(n=>[n.id,n]));
 const a=nodes.get(edge.from),b=nodes.get(edge.to);
 if(!a||!b)return {open:false,reason:'missing-node'};
 if(state.weather==='flood'&&edge.bridgeId){
  const bridge=capital.bridges.find(x=>x.id===edge.bridgeId);
  if(bridge?.floodClosed)return {open:false,reason:'flood'};
 }
 for(const [id,phase] of Object.entries(state.events)){
  if(phase!=='active')continue;
  const incident=capital.encounterStates[id];
  if(incident?.blockedEdgeIds?.includes(edge.id))return {open:false,reason:id};
 }
 if(state.access!=='permitted'){
  const crossing=(restrictedDistricts.has(a.district)&&!restrictedDistricts.has(b.district))||
   (restrictedDistricts.has(b.district)&&!restrictedDistricts.has(a.district));
  if(crossing)return {open:false,reason:'social-gate'};
 }
 return {open:true,reason:null};
}

function graphFor(inputState={},capital=CAPITAL,banned=new Set()){
 const state=normalizeState(inputState),graph=new Map(capital.nodes.map(n=>[n.id,[]]));
 for(const edge of capital.edges){
  if(banned.has(edge.id))continue;
  const avail=edgeAvailability(edge,state,capital);
  if(!avail.open)continue;
  const metres=polylineLengthM(edge.points);
  const penalty=edge.class==='alley'?1.06:edge.class==='stairs'?1.12:edge.class==='roof'?1.14:1;
  const weight=metres*penalty;
  graph.get(edge.from)?.push({to:edge.to,edge,weight});
  graph.get(edge.to)?.push({to:edge.from,edge,weight});
 }
 return graph;
}

export function shortestPath(from,to,inputState={},capital=CAPITAL,banned=new Set()){
 if(from===to)return {nodes:[from],edgeIds:[],edges:[],cost:0};
 const graph=graphFor(inputState,capital,banned);
 if(!graph.has(from)||!graph.has(to))return null;
 const dist=new Map([...graph.keys()].map(k=>[k,Infinity])),prev=new Map(),unvisited=new Set(graph.keys());
 dist.set(from,0);
 while(unvisited.size){
  let u=null,best=Infinity;
  for(const key of unvisited){const d=dist.get(key);if(d<best){best=d;u=key;}}
  if(u==null||best===Infinity)break;
  unvisited.delete(u);
  if(u===to)break;
  for(const arc of graph.get(u)||[]){
   if(!unvisited.has(arc.to))continue;
   const next=best+arc.weight;
   if(next<dist.get(arc.to)){dist.set(arc.to,next);prev.set(arc.to,{node:u,edge:arc.edge});}
  }
 }
 if(!prev.has(to))return null;
 const nodes=[to],edges=[];let cursor=to;
 while(cursor!==from){
  const step=prev.get(cursor);if(!step)return null;
  edges.unshift(step.edge);cursor=step.node;nodes.unshift(cursor);
 }
 return {nodes,edges,edgeIds:edges.map(e=>e.id),cost:dist.get(to)};
}

export function pathMetrics(path,capital=CAPITAL){
 if(!path)return null;
 let distanceM=0,ascentM=0,descentM=0;
 for(const edge of path.edges){
  distanceM+=polylineLengthM(edge.points);
  for(let i=1;i<edge.points.length;i++){
   const a=elevationAt(...edge.points[i-1]),b=elevationAt(...edge.points[i]);
   const delta=b-a;if(delta>0)ascentM+=delta;else descentM-=delta;
  }
 }
 const walkSeconds=distanceM/capital.walkingSpeedMps+ascentM*1.5;
 return {distanceM,ascentM,descentM,walkSeconds,minutes:walkSeconds/60};
}

const signature=path=>path?.edgeIds.slice().sort().join('|')||'';
export function findAlternatives(from,to,inputState={},capital=CAPITAL,limit=3){
 const first=shortestPath(from,to,inputState,capital);
 if(!first)return [];
 const found=[first],seen=new Set([signature(first)]),candidates=[];
 const searchBans=path=>{
  for(const id of path.edgeIds){
   const alt=shortestPath(from,to,inputState,capital,new Set([id]));
   if(!alt)continue;const sig=signature(alt);
   if(seen.has(sig)||candidates.some(x=>signature(x)===sig))continue;
   candidates.push(alt);
  }
 };
 searchBans(first);
 while(found.length<limit&&candidates.length){
  candidates.sort((a,b)=>a.cost-b.cost);
  const next=candidates.shift(),sig=signature(next);
  if(seen.has(sig))continue;
  found.push(next);seen.add(sig);searchBans(next);
 }
 return found.map((path,index)=>({...path,index,metrics:pathMetrics(path,capital)}));
}

export function pathPolyline(path){
 if(!path?.edges?.length)return [];
 const out=[];
 for(let i=0;i<path.edges.length;i++){
  const edge=path.edges[i],forward=path.nodes[i]===edge.from;
  const pts=forward?edge.points:[...edge.points].reverse();
  if(i)pts.shift();out.push(...pts);
 }
 return out;
}

export function stateClosures(inputState={},capital=CAPITAL){
 const state=normalizeState(inputState),closed=[];
 for(const edge of capital.edges){
  const result=edgeAvailability(edge,state,capital);
  if(!result.open)closed.push({edgeId:edge.id,reason:result.reason});
 }
 return closed;
}
