// A court belongs to an existing occupied site, with a street mouth and a
// service passage. It is not a new shop, owner, inventory or private-law flag.
export const courtyardPlans=[
 {siteId:'capital:market-house',width:18,depth:8,height:1.4,opening:3.6,side:'west',use:'residential',reason:'市場へ通う借家人の共同庭。荷運びの通過路から生活面を区別する'},
 {siteId:'capital:clerk-house',width:16,depth:10,height:1.4,opening:3.6,side:'east',use:'residential',reason:'役所裏の長屋で出勤前後に使う共同庭'},
 {siteId:'capital:guard-quarters',width:18,depth:9,height:1.4,opening:3.6,side:'west',use:'residential',reason:'当直と帰宅の動線を分ける宿舎の前庭'},
 {siteId:'crime:quay-tenement',width:18,depth:7,height:1.4,opening:3.6,side:'east',use:'residential',reason:'港の借家人の共同庭。船客の通過する路地へ二方向から出られる'},
 {siteId:'LOC_CAP_MARKET',width:20,depth:12,height:1.2,opening:6.4,side:'east',use:'market',reason:'市場前の荷改めと買物客の待避。側道から荷を出せる'},
 {siteId:'LOC_CAP_WEAPON_SHOP',width:20,depth:12,height:2.3,opening:3.6,side:'west',use:'workshop',reason:'武具の補修と受渡しを通過交通から分ける作業庭'},
 {siteId:'LOC_CRIME_FORGER',width:20,depth:12,height:2.3,opening:2.4,side:'east',use:'workshop',reason:'工房の出入りと相談を分ける庭。脇道からも出入りできる'},
 {siteId:'LOC_CRIME_WAREHOUSE',width:16,depth:12,height:2.6,opening:4.8,side:'west',use:'freight',reason:'倉庫の扉前に搬入待ちの場所を取り、生活路地へ逃がす'},
];

export function authorCourtyards(region){
 region.terrain.courts=[];
 for(const plan of courtyardPlans){
  const site=region.objects.find(o=>o.id===plan.siteId);if(!site)continue;
  if(site.interior.facing!=='south')throw new Error(`Court needs an authored cardinal layout: ${site.id}`);
  const [x,,z]=site.buildingPosition,back=z+site.depth/2,front=back+plan.depth;
  const left=x-plan.width/2,right=x+plan.width/2,sideZ=back+plan.depth*.55,sideOpening=5.2;
  const id=`court:${site.id}`,walls=[];
  const wall=(name,x,z,width,depth)=>{if(width>.05&&depth>.05)walls.push({id:`${id}:${name}`,x,z,width,depth,height:plan.height});};
  const half=(plan.width-plan.opening)/2;
  wall('mouth-left',left+half/2,front,half,.4);wall('mouth-right',right-half/2,front,half,.4);
  for(const side of ['west','east']){
   const sx=side==='west'?left:right;
   if(side!==plan.side)wall(side,sx,(back+front)/2,.4,plan.depth);
   else{
    const end=sideZ-sideOpening/2,start=sideZ+sideOpening/2;
    wall(`${side}-rear`,sx,(back+end)/2,.4,end-back);
    wall(`${side}-front`,sx,(start+front)/2,.4,front-start);
   }
  }
  const shoulder=(plan.width-site.width)/2;
  wall('rear-left',left+shoulder/2,back,shoulder,.4);wall('rear-right',right-shoulder/2,back,shoulder,.4);
  const mouth=[x,0,front],service=[plan.side==='west'?left:right,0,sideZ];
  region.terrain.courts.push({...plan,id,x,z:(back+front)/2,mouth,service,entrance:[...site.interior.entrance],walls});
  region.terrain.boundaries.push(...walls);region.obstacles.push(...walls);
 }
}


