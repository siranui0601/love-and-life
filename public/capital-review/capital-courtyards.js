/** Parcel-local metres: u follows the street, v goes inward from its facade.
 * The same component boxes drive 2D, 3D, collision and landmark occlusion. */
export function parcelPoint(b,u,v){
 const [x,y]=b.frontage.position,[dx,dy]=b.frontage.tangent,s=b.frontage.side;
 return [x+(u*dx-v*dy*s)/1000,y+(u*dy+v*dx*s)/1000];
}
export function buildingParts(b){return b.parts||[b];}
export function courtyardHeight(b,p){
 const dx=(p[0]-b.frontage.position[0])*1000,dy=(p[1]-b.frontage.position[1])*1000;
 return b.benchHeightM+(b.courtSlope||0)*(dx*b.frontage.tangent[0]+dy*b.frontage.tangent[1]);
}
export function makeCourtyard(b){
 const wing=3,portal=3.6,frontDepth=7,backDepth=6,w=b.widthM,d=b.depthM;
 const entranceU=w/2-wing-portal/2,centreWidth=w-2*(wing+portal);
 const boxes=[['left',-w/2+wing/2,d/2,wing,d],['right',w/2-wing/2,d/2,wing,d],['rear',0,d-backDepth/2,w-2*wing,backDepth],['front',0,frontDepth/2,centreWidth,frontDepth]];
 b.parts=boxes.map(([name,u,v,widthM,depthM])=>({...b,id:b.id+':'+name,parentParcelId:b.id,position:parcelPoint(b,u,v),widthM,depthM,heightM:name==='front'?b.heightM:Math.min(b.heightM,name==='rear'?6.4:9.6),frontage:null,roofHeightM:Math.min(3,b.roofHeightM),benchHeightM:b.benchHeightM+b.courtSlope*u}));
 const court={id:'court_'+b.id,parcelId:b.id,district:b.district,position:parcelPoint(b,0,(frontDepth+d-backDepth)/2),widthM:w-2*wing,depthM:d-frontDepth-backDepth,portalWidthM:portal,entranceU,frontDepth,backDepth,parts:b.parts.map(p=>p.id)};
 b.courtyardId=court.id;return court;
}
export function buildCourtyards({buildings,edges,node,edge,distance,distanceToLine,nearestOnSegment,terrainBaseAt,blockedIds,isPublic}){
 const courts=[],replaced=new Map(),usedRoads=new Set();
 for(const b of buildings){
  if(!['lower','market','ajin','west','administration','quay'].includes(b.district)||b.widthM<17||b.depthM<26)continue;
  if([-1,1].some(s=>[0,b.depthM].some(v=>!isPublic(parcelPoint(b,s*b.widthM/2,v)))))continue;
  if(courts.some(c=>distance(c.position,b.position)<70))continue;
  const road=edges.find(e=>e.id===b.frontageEdgeId);
  if(!road||usedRoads.has(road.id)||road.points.length!==2||!['alley','secondary','service'].includes(road.class)||blockedIds.has(road.id)||road.gateTag)continue;
  const ends=[-1,1].map(s=>parcelPoint(b,s*(b.widthM/2-4.8),0));
  const ports=ends.map(p=>nearestOnSegment(p,...road.points));
  if(ports.some(p=>!isPublic(p)))continue;
  if(ports.some(p=>Math.min(...road.points.map(q=>distance(p,q)))<4)||distance(...ports)<7)continue;
  // Two entrances meet the actual street heights; the interior has a gentle
  // crossfall instead of a flat slab with a ledge at the uphill doorway.
  b.courtSlope=(terrainBaseAt(...ends[1])-terrainBaseAt(...ends[0]))/(b.widthM-9.6);
  if(Math.abs(b.courtSlope)>.14)continue;
  // Reject a plot if its street threshold cannot meet the continuous court
  // plane within the same ordinary-walking grade contract.
  if(ends.some((end,i)=>{const a=ports[i],len=distance(a,end),n=Math.ceil(len/.25);let prev=terrainBaseAt(...a);for(let j=1;j<=n;j++){const p=a.map((v,k)=>v+(end[k]-v)*j/n),h=j===n?courtyardHeight(b,end):terrainBaseAt(...p);if(Math.abs(h-prev)/(len/n)>.195)return true;prev=h;}return false;}))continue;
  const court=makeCourtyard(b),portNodes=ports.map((p,i)=>node(court.id+'_street_'+i,'中庭入口の辻',p,b.district,'junction'));
  const ordered=portNodes.sort((a,c)=>distance(road.points[0],a.position)-distance(road.points[0],c.position));
  const chain=[{id:road.from,position:road.points[0]},...ordered,{id:road.to,position:road.points[1]}],parts=[];
  for(let i=1;i<chain.length;i++)parts.push({...road,id:road.id+'_courtpart_'+i,from:chain[i-1].id,to:chain[i].id,points:[chain[i-1].position,chain[i].position],parentEdgeId:road.parentEdgeId||road.id});
  edges.splice(edges.indexOf(road),1,...parts);replaced.set(road.id,parts);usedRoads.add(road.id);
  const inner=[-1,1].map((s,i)=>node(court.id+'_inner_'+i,'建物に囲まれた共同庭',parcelPoint(b,s*court.entranceU,court.frontDepth+8),b.district,'court'));
  // Recover physical left/right after ordering the road intersections.
  const entries=ports.map(p=>portNodes.find(n=>distance(n.position,p)<.01));
  const segments=[[entries[0],inner[0]],[inner[0],inner[1]],[inner[1],entries[1]]];
  court.edgeIds=segments.map(([a,c])=>edge(a.id,c.id,'共同庭の回遊路','alley',{widthM:3,courtyardId:court.id,designRole:'optional-life',value:'滞留・住民接触・小さな回遊',reason:'二つの入口を持つ建物内側の生活庭。大通りの速度とは別の価値。'}).id);
  court.from=entries[0].id;court.to=entries[1].id;court.innerFrom=inner[0].id;court.innerTo=inner[1].id;courts.push(court);
 }
 for(const b of buildings){const parts=replaced.get(b.frontageEdgeId);if(parts)b.frontageEdgeId=parts.reduce((best,e)=>distanceToLine(b.frontage.position,e.points)<distanceToLine(b.frontage.position,best.points)?e:best).id;}
 return courts;
}
