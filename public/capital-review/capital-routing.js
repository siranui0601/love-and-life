import {CAPITAL,distance,distanceToLine} from './capital-data.js';
import {sampleLine,edgeHeightAt} from './capital-surfaces.js';

export const DEFAULT_CITY_STATE=Object.freeze({
 weather:'clear',
 hour:12,
 access:'public',
 events:Object.freeze({T10:'idle',T11:'idle',T16:'idle',T17:'idle'})
});

const restrictedDistricts=new Set(['castle','noble','mage']);
const nodeMaps=new WeakMap();const nodesFor=capital=>{if(!nodeMaps.has(capital))nodeMaps.set(capital,new Map(capital.nodes.map(n=>[n.id,n])));return nodeMaps.get(capital);};
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
 const state=normalizeState(inputState),nodes=nodesFor(capital);
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
 const dist=new Map([[from,0]]),prev=new Map(),heap=[];
 const push=entry=>{heap.push(entry);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].cost<=entry.cost)break;heap[i]=heap[p];i=p;}heap[i]=entry;};
 const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(heap[c].cost>=last.cost)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;};
 push({id:from,cost:0});
 while(heap.length){const {id:u,cost}=pop();if(cost!==dist.get(u))continue;if(u===to)break;
  for(const arc of graph.get(u)||[]){const next=cost+arc.weight;if(next>=(dist.get(arc.to)??Infinity))continue;dist.set(arc.to,next);prev.set(arc.to,{node:u,edge:arc.edge});push({id:arc.to,cost:next});}
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
 for(let edgeIndex=0;edgeIndex<path.edges.length;edgeIndex++){
  const edge=path.edges[edgeIndex];
  const points=sampleLine(path.nodes[edgeIndex]===edge.from?edge.points:[...edge.points].reverse(),8);
  distanceM+=polylineLengthM(edge.points);
  for(let i=1;i<points.length;i++){
   const a=edgeHeightAt(edge,points[i-1]),b=edgeHeightAt(edge,points[i]);
   const delta=b-a;if(delta>0)ascentM+=delta;else descentM-=delta;
  }
 }
 const walkSeconds=distanceM/capital.walkingSpeedMps+ascentM*1.5;
 return {distanceM,ascentM,descentM,walkSeconds,minutes:walkSeconds/60};
}

// Compare shared physical distance, not merely the number of graph edges.
// Splitting a short block detour into many edges cannot manufacture a major route.
export function routeOverlap(a,b){
 const fraction=(one,other)=>{const ps=sampleLine(pathPolyline(one),25),line=pathPolyline(other);let shared=0,total=0;for(let i=1;i<ps.length;i++){const length=distance(ps[i-1],ps[i]),mid=[(ps[i-1][0]+ps[i][0])/2,(ps[i-1][1]+ps[i][1])/2];total+=length;if(distanceToLine(mid,line)<35)shared+=length;}return total?shared/total:1;};
 return Math.max(fraction(a,b),fraction(b,a));
}

const signature=path=>path?.edgeIds.slice().sort().join('|')||'';
export function findAlternatives(from,to,inputState={},capital=CAPITAL,limit=3){
 const first=shortestPath(from,to,inputState,capital);
 if(!first)return [];
 if(limit<=1||!first.edges.length)return [{...first,index:0,metrics:pathMetrics(first,capital)}];
 const found=[first],seen=new Set([signature(first)]),candidates=[];
 const searchBans=path=>{
  for(const id of path.edgeIds){
   const alt=shortestPath(from,to,inputState,capital,new Set([id]));
   if(!alt)continue;const sig=signature(alt);
   if(seen.has(sig)||candidates.some(x=>signature(x)===sig))continue;
   candidates.push(alt);
  }
 };
 // A dense mesh needs corridor-scale exclusions as well as individual-edge
 // exclusions; one-edge bans otherwise only find the next immediate micro-loop.
 const line=pathPolyline(first),start=line[0],end=line.at(-1);
 for(const clearance of [60,130]){
  const banned=new Set(capital.edges.filter(e=>!e.bridgeId&&e.points.every(p=>distance(p,start)>180&&distance(p,end)>180)&&e.points.some(p=>distanceToLine(p,line)<clearance)).map(e=>e.id));
  const alt=shortestPath(from,to,inputState,capital,banned);if(alt)candidates.push(alt);
 }
 searchBans(first);
 while(found.length<limit&&candidates.length){
  candidates.sort((a,b)=>a.cost-b.cost);
  const next=candidates.shift(),sig=signature(next);
  if(seen.has(sig))continue;
  if(found.some(path=>routeOverlap(path,next)>=.74)){seen.add(sig);continue;}
  found.push(next);seen.add(sig);searchBans(next);
 }
 return found.map((path,index)=>({...path,index,metrics:pathMetrics(path,capital)}));
}

export function pathPolyline(path){
 if(!path?.edges?.length)return [];
 const out=[];
 for(let i=0;i<path.edges.length;i++){
  const edge=path.edges[i],forward=path.nodes[i]===edge.from;
  const pts=forward?[...edge.points]:[...edge.points].reverse();
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
