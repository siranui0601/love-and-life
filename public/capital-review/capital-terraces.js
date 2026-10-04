/** Engineering terrain: horizontal urban benches, then surveyed street cuts.
 * The continuous regional datum is a survey input, never the finished city floor.
 */
export const BENCH_RISE_M=32;
export function benchElevation(datum){
 const n=Math.floor((datum-14)/BENCH_RISE_M),boundary=14+n*BENCH_RISE_M+16;
 const t=Math.max(0,Math.min(1,(datum-boundary+.4)/.8));
 return 14+n*BENCH_RISE_M+BENCH_RISE_M*t*t*(3-2*t);
}

export function surveyStreetLevels(edges,datum,distance){
 const vertices=new Map(),key=p=>p.map(v=>v.toFixed(8)).join(',');
 const vertex=p=>{const k=key(p);if(!vertices.has(k))vertices.set(k,{position:p,height:benchElevation(datum(...p)),links:[],queued:false});return vertices.get(k);};
 for(const e of edges.filter(e=>!e.bridgeId&&e.class!=='roof')){
  e.surveyVertices=e.points.map(vertex);
  for(let i=1;i<e.points.length;i++){const a=e.surveyVertices[i-1],b=e.surveyVertices[i],limit=distance(a.position,b.position)*(e.class==='stairs'?.45:.18);a.links.push({v:b,limit});b.links.push({v:a,limit});}
 }
 // A shared junction has exactly one elevation. Propagate cut levels until all
 // carriageways meet the grade budget; do not clamp a walking delta afterward.
 const queue=[...vertices.values()];for(const v of queue)v.queued=true;
 for(let i=0;i<queue.length;i++){const a=queue[i];a.queued=false;for(const {v,limit}of a.links)if(v.height>a.height+limit+1e-8){v.height=a.height+limit;if(!v.queued){v.queued=true;queue.push(v);}}}
 for(const e of edges)if(e.surveyVertices){e.streetHeightsM=e.surveyVertices.map(v=>v.height);delete e.surveyVertices;}
 return {junctionCount:vertices.size,maxCarriagewayGrade:.18,stairGrade:.45};
}

export function surveyedHeightAt(e,p){
 let best=Infinity,height=null;
 for(let i=1;i<e.points.length;i++){const a=e.points[i-1],b=e.points[i],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);
  if(d<best){best=d;let progress=t;
   if(e.stairLayout==='contour-switchback'){
    const length=Math.hypot(dx,dy)*1000,effective=s=>Math.floor(s/12)*10+Math.min(s%12,10),run=effective(length);
    // Ten metres of flight, two metres of level refuge. The same longitudinal
    // profile drives both the physical walker and the rendered stair treads.
    progress=run?effective(t*length)/run:t;
   }
   height=e.streetHeightsM[i-1]*(1-progress)+e.streetHeightsM[i]*progress;
  }
 }
 return height;
}

export function surveyRetainingFaces({datum,core,inside,spacingM=24}){
 const xs=core.map(p=>p[0]),ys=core.map(p=>p[1]),step=spacingM/1000,faces=[];
 // Marching squares follows real height contours, including the river-facing
 // cutback. The previous decorative concentric rings did not follow the ground.
 for(let level=30;level<300;level+=BENCH_RISE_M){const lines=[];
  for(let x=Math.min(...xs);x<Math.max(...xs);x+=step)for(let y=Math.min(...ys);y<Math.max(...ys);y+=step){
   const ps=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]],values=ps.map(p=>datum(...p)-level),hits=[];
   for(let i=0;i<4;i++){const j=(i+1)%4;if((values[i]<0)===(values[j]<0))continue;const t=values[i]/(values[i]-values[j]);hits.push(ps[i].map((v,k)=>v+(ps[j][k]-v)*t));}
   for(let i=1;i<hits.length;i+=2)if(inside(hits[i-1],core)&&inside(hits[i],core))lines.push([hits[i-1],hits[i]]);
  }
  faces.push({id:'surveyed_bench_'+level,datumM:level,lowerM:level-16,upperM:level+16,lines});
 }
 return faces;
}
