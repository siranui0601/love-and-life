/** One stitched ground surface. Street shoulders must not overlay other streets.
 * Every coarse cell shares the same subdivided boundary with its neighbours;
 * cells near roads get a full grid, other cells a centre fan.
 */
export function buildGroundMesh({bounds,nx,nz,heightAt,localAt,refineAt,omitAt=()=>false,cutoutsAt=null,divisions=4}){
 const positions=[],indices=[],world=[],cache=new Map();
 const point=(u,v)=>[bounds.minX+(bounds.maxX-bounds.minX)*u/nx,bounds.minY+(bounds.maxY-bounds.minY)*v/nz];
 const vertex=(u,v)=>{const key=u+','+v;if(cache.has(key))return cache.get(key);const p=point(u,v),[x,z]=localAt(p),i=world.length;positions.push(x,heightAt(...p),z);world.push(p);cache.set(key,i);return i;};
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const p=point(i+.5,j+.5);if(omitAt(p))continue;
  if(refineAt(p)){
   for(let v=0;v<divisions;v++)for(let u=0;u<divisions;u++){
    const a=vertex(i+u/divisions,j+v/divisions),b=vertex(i+(u+1)/divisions,j+v/divisions),c=vertex(i+u/divisions,j+(v+1)/divisions),d=vertex(i+(u+1)/divisions,j+(v+1)/divisions);indices.push(a,c,b,b,c,d);
   }
  }else{
   const ring=[];for(let k=0;k<divisions;k++)ring.push(vertex(i+k/divisions,j));for(let k=0;k<divisions;k++)ring.push(vertex(i+1,j+k/divisions));for(let k=0;k<divisions;k++)ring.push(vertex(i+1-k/divisions,j+1));for(let k=0;k<divisions;k++)ring.push(vertex(i,j+1-k/divisions));
   const c=vertex(i+.5,j+.5);for(let k=0;k<ring.length;k++)indices.push(c,ring[(k+1)%ring.length],ring[k]);
  }
 }
 if(cutoutsAt){
  const clipped=[],added=new Map();
  const append=p=>{const key=p.map(v=>v.toFixed(12)).join(',');if(added.has(key))return added.get(key);const [x,z]=localAt(p),id=world.length;positions.push(x,heightAt(...p),z);world.push(p);added.set(key,id);return id;};
  for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3),triangle=ids.map(id=>world[id]),cuts=cutoutsAt(triangle);
   if(!cuts.length){clipped.push(...ids);continue;}
   let fragments=[triangle];for(const cut of cuts){fragments=fragments.flatMap(p=>subtractConvex(p,cut));if(!fragments.length)break;}
   for(const p of fragments){const ids=p.map(append);for(let j=1;j<ids.length-1;j++)clipped.push(ids[0],ids[j],ids[j+1]);}
  }
  return {positions,indices:clipped,world};
 }
 return {positions,indices,world};
}

/** Remove a convex road footprint from one convex ground fragment. The road
 * owns its walking surface; terrain triangles may not span across that surface.
 */
export function subtractConvex(subject,clip){
 const area=clip.reduce((sum,p,i)=>{const q=clip[(i+1)%clip.length];return sum+p[0]*q[1]-q[0]*p[1];},0),sign=area>=0?1:-1,out=[];
 let remaining=subject;
 for(let i=0;i<clip.length&&remaining.length>=3;i++){
  const a=clip[i],b=clip[(i+1)%clip.length],side=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])),inside=[],outside=[];
  for(let j=0;j<remaining.length;j++){
   const p=remaining[j],q=remaining[(j+1)%remaining.length],sp=side(p),sq=side(q),pin=sp>=0,qin=sq>=0;
   (pin?inside:outside).push(p);
   if(pin!==qin){const t=sp/(sp-sq),hit=p.map((v,k)=>v+(q[k]-v)*t);inside.push(hit);outside.push(hit);}
  }
  if(outside.length>=3)out.push(outside);remaining=inside;
 }
 return out;
}
