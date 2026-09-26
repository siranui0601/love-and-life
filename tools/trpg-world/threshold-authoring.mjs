// Street → threshold → room. These dimensions describe accessible grayboxes,
// not legal ownership or an automatically granted right to enter a home.
export function authorThresholds(region){
 if(!['farm','capital','trade'].includes(region.id))return;
 for(const site of region.objects.filter(o=>o.buildingPosition)){
  const [x,,z]=site.buildingPosition,front=z+site.depth/2;
  const use=site.kind==='residence'?'domestic':['shop','inn'].includes(site.kind)?'public-service':['stable','job'].includes(site.kind)?'loading':'institution';
  const opening=use==='domestic'?1.8:use==='loading'?4:3.2;
  const panel=(site.width-opening)/2;
  const walls=[-1,1].map(side=>({id:`${site.id}:front:${side<0?'left':'right'}`,x:x+side*(opening/2+panel/2),z:front,width:panel,depth:.4,height:site.height}));
  region.obstacles.push(...walls);
  // Renderer consumes the exact same bodies, rather than inventing a visual door.
  site.interior={...site.interior,openFront:false,threshold:{use,opening,walls,approach:[x,0,front+2],inside:[x,0,front-2]}};
  // Ordinary business identification only. Do not label future developments,
  // private households, crisis clues or owners from hidden world state.
  if(['shop','inn'].includes(site.kind)&&!site.id.endsWith('BIG_STORE'))site.signage={text:site.name,position:[x,Math.min(site.height-.4,3.5),front+.25],width:Math.min(6,site.width-1),height:.75};
 }
}
