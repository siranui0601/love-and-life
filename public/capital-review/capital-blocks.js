/** Street enclosure, before land subdivision. Coordinates are kilometres.
 * Half-edge faces describe land bounded by physical streets and the curtain wall;
 * they are not district colours or circles placed between scattered buildings.
 */
export function buildStreetBlocks({edges,walls,inside,core}) {
 const raw=[];
 for(const e of [...edges.filter(e=>!['world','roof'].includes(e.class)),...walls])
  for(let i=1;i<e.points.length;i++)raw.push({a:e.points[i-1],b:e.points[i],cuts:[0,1],streetId:e.id});
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],buckets=new Map(),pairs=new Set();
 // Split ALL intersections, including old authored streets and wall endpoints.
 // This planar land survey does not change the gameplay graph or create routes.
 for(let i=0;i<raw.length;i++){const s=raw[i];
  for(let x=Math.floor(Math.min(s.a[0],s.b[0])*10);x<=Math.floor(Math.max(s.a[0],s.b[0])*10);x++)
   for(let y=Math.floor(Math.min(s.a[1],s.b[1])*10);y<=Math.floor(Math.max(s.a[1],s.b[1])*10);y++){
    const key=x+','+y,list=buckets.get(key)||[];
    for(const j of list){const pair=j+':'+i;if(pairs.has(pair))continue;pairs.add(pair);
     const t=raw[j],r=sub(s.b,s.a),v=sub(t.b,t.a),q=sub(t.a,s.a),den=cross(r,v);
     if(Math.abs(den)<1e-14)continue;
     const u=cross(q,v)/den,w=cross(q,r)/den;
     if(u>=-1e-9&&u<=1+1e-9&&w>=-1e-9&&w<=1+1e-9){s.cuts.push(Math.max(0,Math.min(1,u)));t.cuts.push(Math.max(0,Math.min(1,w)));}
    }
    list.push(i);buckets.set(key,list);
   }
 }
 const vertices=new Map(),arcs=[],segments=new Set();
 const vertex=p=>{const key=p.map(v=>v.toFixed(8)).join(',');if(!vertices.has(key))vertices.set(key,{key,p,out:[]});return vertices.get(key);};
 for(const s of raw){const cuts=[...new Set(s.cuts.map(t=>+t.toFixed(10)))].sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++){const point=t=>s.a.map((v,k)=>v+(s.b[k]-v)*t),a=vertex(point(cuts[i-1])),b=vertex(point(cuts[i]));if(a===b)continue;
   const key=[a.key,b.key].sort().join('|');if(segments.has(key))continue;segments.add(key);
   const ab={a,b,streetId:s.streetId},ba={a:b,b:a,streetId:s.streetId};ab.twin=ba;ba.twin=ab;a.out.push(ab);b.out.push(ba);arcs.push(ab,ba);
  }
 }
 for(const v of vertices.values())v.out.sort((a,b)=>Math.atan2(a.b.p[1]-v.p[1],a.b.p[0]-v.p[0])-Math.atan2(b.b.p[1]-v.p[1],b.b.p[0]-v.p[0]));
 const blocks=[];
 for(const start of arcs){if(start.visited)continue;const polygon=[],boundary=[];let a=start;
  do{if(a.visited)break;a.visited=true;polygon.push(a.a.p);boundary.push(a.streetId);const fan=a.b.out,i=fan.indexOf(a.twin);a=fan[(i+fan.length-1)%fan.length];}while(a!==start);
  if(a!==start||polygon.length<3)continue;
  const signed=polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
  if(signed<.0002)continue;
  // A point just left of the first directed edge belongs to this face. A mean
  // centroid need not lie inside a concave block.
  const p=polygon[0],q=polygon[1],len=Math.hypot(q[0]-p[0],q[1]-p[1]),probe=[(p[0]+q[0])/2-(q[1]-p[1])/len*.0001,(p[1]+q[1])/2+(q[0]-p[0])/len*.0001];
  if(!inside(probe,core))continue;
  blocks.push({id:'street_block_'+blocks.length,polygon,areaM2:signed*1e6,boundaryStreetIds:[...new Set(boundary)]});
 }
 return blocks;
}

export function indexStreetBlocks(blocks,inside){
 const buckets=new Map();
 for(const b of blocks){const xs=b.polygon.map(p=>p[0]),ys=b.polygon.map(p=>p[1]);
  for(let x=Math.floor(Math.min(...xs)*20);x<=Math.floor(Math.max(...xs)*20);x++)for(let y=Math.floor(Math.min(...ys)*20);y<=Math.floor(Math.max(...ys)*20);y++){const k=x+','+y;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(b);}
 }
 return p=>(buckets.get(Math.floor(p[0]*20)+','+Math.floor(p[1]*20))||[]).find(b=>inside(p,b.polygon));
}
