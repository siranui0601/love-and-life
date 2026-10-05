/** One stitched ground surface. Street shoulders must not overlay other streets.
 * Every coarse cell shares the same subdivided boundary with its neighbours;
 * cells near roads get a full grid, other cells a centre fan.
 */
export function buildGroundMesh({bounds,nx,nz,heightAt,localAt,refineAt,omitAt=()=>false,divisions=4}){
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
 return {positions,indices,world};
}
