/** Streets surveyed around the castle's contours, before parcel placement.
 * Curved contour lanes, staggered cross-slope stairs and real intersections.
 * No canonical facilities, watercourses or cultures are added here.
 */
export function buildStreetFabric({nodes,edges,districts,core,rivers,facilities,inside,distance,distanceToLine,node,edge}){
 const originals=[...edges],centre=[22.70,22.62],rings=[],added=[],restricted=p=>districts.filter(d=>d.gateTag&&inside(p,d.polygon)).map(d=>d.id).join('|');
 const district=p=>districts.find(d=>inside(p,d.polygon))?.id||(p[1]>22.6?'castle':'lower');
 function valid(p){return inside(p,core)&&distanceToLine(p,[...core,core[0]])>25&&distanceToLine(p,rivers[0].points)>27&&facilities.every(f=>!f.footprintM[0]||Math.abs(p[0]-f.buildingPosition[0])*1000>f.footprintM[0]/2+24||Math.abs(p[1]-f.buildingPosition[1])*1000>f.footprintM[1]/2+24)&&!(p[1]>22.39&&p[1]<22.91&&p[0]>22.36&&p[0]<23.04);}
 function legal(points){const region=restricted(points[0]);return points.every((p,i)=>valid(p)&&restricted(p)===region&&(!i||Array.from({length:12},(_,j)=>[points[i-1][0]+(p[0]-points[i-1][0])*(j+1)/12,points[i-1][1]+(p[1]-points[i-1][1])*(j+1)/12]).every(q=>valid(q)&&restricted(q)===region)));}
 // Rings follow the hill rather than a Cartesian grid. Each varies its survey
 // spacing and has different angular phase, so cross lanes form irregular blocks.
 for(let ring=0,r=340;r<3100;ring++,r+=ring%3===0?122:147){
  const count=Math.round(2*Math.PI*r/125),row=[];
  for(let i=0;i<count;i++){
   const a=2*Math.PI*(i+.27*(ring%2))/count,rr=r+17*Math.sin(i*2.7+ring),p=[centre[0]+Math.cos(a)*rr/1000,centre[1]+Math.sin(a)*rr/1000];
   if(!valid(p)){row.push(null);continue;}const n=node('fabric_'+ring+'_'+i,'生活路の曲がり角',p,district(p),'junction');row.push(n);
  }
  rings.push(row);
  function connect(a,b,kind){if(!a||!b)return;const mid=[(a.position[0]+b.position[0])/2,(a.position[1]+b.position[1])/2],radial=[mid[0]-centre[0],mid[1]-centre[1]],len=Math.hypot(...radial)||1,bend=kind==='contour'?8:0,via=[mid[0]+radial[0]/len*bend/1000,mid[1]+radial[1]/len*bend/1000],points=[a.position,via,b.position];
   if(!legal(points))return;const cls=kind==='contour'?'alley':r<1450?'stairs':'alley',e=edge(a.id,b.id,kind==='contour'?'城丘の等高生活路':'段丘をつなぐ横路・石段',cls,{id:'fabric_lane_'+added.length,via:[via],widthM:a.district==='noble'?6:a.district==='lower'?3.8:4.6,fabric:true,fabricRole:kind,reason:kind==='contour'?'段丘の街区前面と裏口をつなぐ生活路。':'等高道の間を上り下りし、街区を通り抜ける徒歩路。'});added.push(e);
  }
  for(let i=0;i<row.length;i++)connect(row[i],row[(i+1)%row.length],'contour');
  if(ring)for(let i=0;i<row.length;i++){const n=row[i];if(!n)continue;const candidates=rings[ring-1].filter(Boolean).sort((a,b)=>distance(n.position,a.position)-distance(n.position,b.position));if(candidates[0]&&distance(n.position,candidates[0].position)<200)connect(n,candidates[0],'cross-slope');}
 }
 // The lanes meet existing streets at physical intersections. Both sides share
 // an actual graph junction, not crossing lines with disconnected NPC paths.
 const cuts=new Map(edges.map(e=>[e,[]]));let junction=0;
 function intersect(a,b,c,d){const rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1],den=rx*sy-ry*sx;if(Math.abs(den)<1e-12)return null;const t=((c[0]-a[0])*sy-(c[1]-a[1])*sx)/den,u=((c[0]-a[0])*ry-(c[1]-a[1])*rx)/den;return t>.0001&&t<.9999&&u>.0001&&u<.9999?{p:[a[0]+t*rx,a[1]+t*ry],t,u}:null;}
 const streets=edges.filter(e=>!e.bridgeId&&!['roof','world'].includes(e.class)&&!e.surfaceOffsetsM);
 for(let i=0;i<streets.length;i++)for(let j=i+1;j<streets.length;j++){
  const one=streets[i],two=streets[j];if(!one.fabric&&!two.fabric)continue;
  for(let a=1;a<one.points.length;a++)for(let b=1;b<two.points.length;b++){const hit=intersect(one.points[a-1],one.points[a],two.points[b-1],two.points[b]);if(!hit)continue;
   let n=nodes.find(n=>distance(n.position,hit.p)<.2);if(!n)n=node('fabric_junction_'+junction++,'生活路と街道の辻',hit.p,district(hit.p),'junction');
   cuts.get(one).push({segment:a,t:hit.t,node:n});cuts.get(two).push({segment:b,t:hit.u,node:n});
  }
 }
 const splitMap=new Map();
 for(const original of [...edges]){
  const list=cuts.get(original)||[];if(!list.length)continue;list.sort((a,b)=>a.segment-b.segment||a.t-b.t);const parts=[],points=[original.points[0]],unique=list.filter((c,i)=>!i||c.node.id!==list[i-1].node.id);let from=original.from,index=0;
  for(let segment=1;segment<original.points.length;segment++){
   for(const cut of unique.filter(c=>c.segment===segment)){points.push(cut.node.position);parts.push({...original,id:index?original.id+'__part_'+index:original.id,parentEdgeId:original.id,from,to:cut.node.id,points:[...points]});index++;from=cut.node.id;points.splice(0,points.length,cut.node.position);}
   points.push(original.points[segment]);
  }
  parts.push({...original,id:original.id+'__part_'+index,parentEdgeId:original.id,from,to:original.to,points:[...points]});edges.splice(edges.indexOf(original),1,...parts);splitMap.set(original.id,parts.map(e=>e.id));
 }
 // Remove isolated construction fragments; every surviving lane must reach the
 // authored graph. No disconnected decorative lanes or unreachable parcels.
 const linked=new Map(nodes.map(n=>[n.id,[]]));for(const e of edges){linked.get(e.from).push(e.to);linked.get(e.to).push(e.from);}
 const reachable=new Set(['market']),queue=['market'];for(let i=0;i<queue.length;i++)for(const id of linked.get(queue[i])||[])if(!reachable.has(id)){reachable.add(id);queue.push(id);}
 for(let i=edges.length-1;i>=0;i--)if(edges[i].fabric&&!reachable.has(edges[i].from))edges.splice(i,1);
 for(let i=nodes.length-1;i>=0;i--)if(nodes[i].id.startsWith('fabric_')&&!edges.some(e=>e.from===nodes[i].id||e.to===nodes[i].id))nodes.splice(i,1);
 return {splitMap,surveyLines:[...originals,...added].filter(e=>!e.fabric||reachable.has(e.from)),lanes:edges.filter(e=>e.fabric),rings:rings.length,originals};
}
