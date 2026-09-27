// Shared graybox massing. Solid rock is the complement of authored chambers
// and routes, not scenery that actors can walk through. No semantic IDs change.
const segmentDistance=(x,z,a,b)=>{
 const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1)));
 return Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t);
};
export function encloseCavern(region,npcs,events){
 if(region.id!=='dwarf')return;
 const chambers=region.objects.map(o=>({id:`chamber:${o.id}`,x:(o.buildingPosition||o.position)[0],z:(o.buildingPosition||o.position)[2],width:(o.width||5)+10,depth:(o.depth||5)+14}));
 const refuges=[region.spawn,...npcs.filter(n=>n.region===region.id).flatMap(n=>[n.home,n.work]),...events.filter(e=>e.region===region.id).map(e=>e.position),...region.portals.flatMap(p=>[p.position,p.approach])];
 const cell=4,half=region.size/2,margin=cell*Math.SQRT2/2+1.2;
 const open=(x,z)=>chambers.some(c=>Math.abs(x-c.x)<c.width/2+margin&&Math.abs(z-c.z)<c.depth/2+margin)
  ||refuges.some(p=>Math.hypot(x-p[0],z-p[2])<5+margin)
  ||region.terrain.paths.some(p=>p.points.some((b,i)=>i&&segmentDistance(x,z,p.points[i-1],b)<p.width/2+margin));
 // Merge equal horizontal runs vertically to keep renderer/nav obstacle cost bounded.
 const rows=[],active=new Map();
 for(let z=-half+cell/2;z<half;z+=cell){
  const spans=[];let start=null;
  for(let x=-half+cell/2;x<=half+cell/2;x+=cell){
   const solid=x<half&&!open(x,z);
   if(solid&&start===null)start=x-cell/2;
   if(!solid&&start!==null){spans.push([start,x-cell/2]);start=null;}
  }
  const keys=new Set();
  for(const [left,right] of spans){const key=`${left}:${right}`;keys.add(key);const prior=active.get(key);
   if(prior){prior.depth+=cell;prior.z+=cell/2;}
   else{const wall={id:`dwarf:bedrock:${left}:${z}`,x:(left+right)/2,z,width:right-left,depth:cell,height:15,material:'bedrock'};rows.push(wall);active.set(key,wall);}
  }
  for(const key of active.keys())if(!keys.has(key))active.delete(key);
 }
 region.terrain.boundaries.push(...rows);region.obstacles.push(...rows);
 region.terrain.enclosure={kind:'cavern',ceilingY:15,chambers,rockBodies:rows.length};
 region.spatial.geometryRevision='enclosed-cavern-v1';
}
