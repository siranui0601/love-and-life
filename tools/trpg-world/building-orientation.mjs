// Cardinal orientation preserves AABB collision while allowing a door to face
// its actual street. Site/household identity is independent of this geometry.
const facings={LOC_CAP_APOTHECARY:'west',LOC_CAP_AJIN_QUARTER:'north',LOC_CRIME_INFO_STREET:'east',LOC_TRADE_INN:'north'};
const turns={south:0,west:1,north:2,east:3};
export function orientBuildings(region){
 for(const site of region.objects.filter(o=>o.buildingPosition)){
  const facing=facings[site.id]||'south',q=turns[facing],[x,,z]=site.buildingPosition,w=site.width,d=site.depth;
  const point=p=>{let dx=p[0]-x,dz=p[2]-z;for(let i=0;i<q;i++)[dx,dz]=[-dz,dx];return [x+dx,p[1],z+dz];};
  const bodies=region.obstacles.filter(o=>o.id.startsWith(`${site.id}:`)&&(/:(left|right|back)$/.test(o.id)||o.id.includes(':front:')));
  for(const body of bodies){const p=point([body.x,0,body.z]);body.x=p[0];body.z=p[2];if(q%2)[body.width,body.depth]=[body.depth,body.width];}
  site.position=point(site.position);site.interior.entrance=point(site.interior.entrance);
  const t=site.interior.threshold;if(t){t.approach=point(t.approach);t.inside=point(t.inside);}
  if(site.signage){site.signage.position=point(site.signage.position);site.signage.rotation=Math.PI-q*Math.PI/2;}
  site.interior.facing=facing;
  site.interior.shellWalls=bodies.filter(o=>!o.id.includes(':front:')).map(o=>({...o}));
  site.interior.furnishingPosition=point(site.kind==='residence'?[x+w/2-1.3,0,z-d/2+1.4]:[x,0,z-1]);
  site.interior.lanternPosition=point([x-3,2,z+d/2]);
  site.interior.assetRotation=-q*Math.PI/2;
  site.interior.roofSize=[w+1,2.1,d+1];
  if(q%2)[site.width,site.depth]=[d,w];
 }
}
