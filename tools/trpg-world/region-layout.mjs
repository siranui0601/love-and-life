import {canOccupy,findPath,distance} from '../../src/shared/trpg-world/navigation.js';

// Coordinates are authored staging, not coordinates claimed by the source sheet.
// Facility order follows each sheet's LOC rows; no facility is silently omitted.
const layouts={
 farm:{identity:'畑から広場へ曲がる村道',sites:[[0,-13],[-18,20],[17,27],[-43,33],[-37,-25],[10,-8],[-17,-38],[38,30],[43,-39],[6,-59],[30,-27]],spine:[[0,63],[5,38],[0,8],[-8,-16],[0,-62]],plots:[[-53,35,17,32],[-51,-11,18,22],[-28,50,18,20]]},
 capital:{identity:'王城と市場を結ぶ大通り・東の大河',sites:[[0,-51],[29,-44],[-39,28],[0,-20],[-24,-28],[29,-22],[-41,51],[-20,48],[-31,-52],[20,43],[2,58],[37,29]],spine:[[0,74],[0,35],[0,8],[0,-8],[16,-8],[16,-48]],water:[{id:'great-river',x:60,z:0,width:12,depth:160,kind:'river'}],bridges:[{id:'east-gate',x:60,z:8,width:15,depth:12}]},
 trade:{identity:'西向きの埠頭・海岸通りと丘の領主館',sites:[[-42,-17],[-25,24],[-5,45],[32,-44],[12,-22],[-43,-43],[-15,-42],[33,31],[31,52],[-42,43]],spine:[[-47,0],[-31,8],[0,8],[12,15],[48,14]],water:[{id:'western-sea',x:-66,z:0,width:28,depth:160,kind:'sea'}],bridges:[],dock:[-49,0,0]},
 crime:{identity:'岩島の東埠頭・折れ曲がる裏通り',sites:[[43,-17],[14,34],[-7,-23],[-33,23],[-34,-27],[22,-41],[43,30],[-24,47],[1,54]],spine:[[49,0],[25,13],[0,8],[-15,18],[-10,43]],water:[{id:'island-sea',x:66,z:0,width:28,depth:160,kind:'sea'}],bridges:[],dock:[49,0,0],ridges:[[-62,-43,9,15],[-63,37,10,12],[-15,-63,9,13]]},
 frontier:{identity:'井戸の集落と北へ伸びる巡礼参道',sites:[[-19,23],[20,-23],[-44,32],[0,-25],[35,29],[-12,-6],[-17,-48],[10,-49]],spine:[[-8,57],[0,29],[0,8],[2,-16],[8,-58]],plots:[[-48,37,19,28],[-45,-25,17,19]],ridges:[[-64,-49,9,8],[62,42,10,6]]},
 temple:{identity:'正門・白石回廊・地下装置の三つの庭',sites:[[0,43],[-29,23],[27,36],[26,17],[-17,-25],[-32,-50],[26,-49],[-29,43],[12,-16]],spine:[[0,66],[0,8],[0,-13],[0,-40],[0,-62]],ridges:[[-62,-42,12,17],[59,-40,12,18],[-58,49,10,12]]},
 forest:{identity:'大河の渡しと樹林を縫う枝道',sites:[[-49,28],[-17,29],[-37,-29],[15,19],[-43,49],[42,-40],[38,38],[-15,-52],[1,-25]],spine:[[-53,19],[-16,17],[0,8],[19,8],[36,8],[44,-13],[30,-40]],water:[{id:'middle-river',x:22,z:0,width:9,depth:160,kind:'river'}],bridges:[{id:'forest-ford',x:22,z:8,width:12,depth:12}]},
 elf:{identity:'世界樹を囲む環状の根道',sites:[[0,-26],[-25,-42],[28,-39],[38,23],[-43,-12],[-31,31],[3,47],[-42,51],[13,31]],spine:[[0,8],[-17,8],[-37,0],[-40,-29],[-9,-47],[21,-47],[39,-18],[39,3],[23,13],[0,8]],water:[{id:'spirit-stream',x:60,z:0,width:7,depth:160,kind:'river'}],bridges:[{id:'root-bridge',x:60,z:8,width:10,depth:12}]},
 fortress:{identity:'北門の検問庭と左右の兵舎区',sites:[[0,-47],[-26,-27],[25,29],[24,-44],[-25,30],[-29,51],[-36,-55],[30,-24],[10,-13]],spine:[[0,72],[0,8],[0,-21],[0,-35]],ridges:[[-64,-41,11,22],[62,-40,12,24],[-61,37,11,16],[61,47,9,13]]},
 dwarf:{identity:'岩の間の坑夫街・三つの工房枝道',sites:[[2,49],[-26,29],[-29,-24],[17,25],[-16,-53],[20,-45],[31,47],[42,-24],[0,-20]],spine:[[0,72],[-9,43],[0,8],[-7,-14],[0,-36],[35,-39]],ridges:[[-63,-30,12,23],[64,-48,11,25],[-47,54,10,21],[57,19,9,19],[4,-72,8,22]]},
 blackridge:{identity:'水路を挟む共同市場と連合評議場',sites:[[-40,36],[-16,33],[33,27],[-24,-43],[41,-44],[23,-21],[-45,-24],[34,49],[-10,-23],[1,-9]],spine:[[-53,16],[-16,8],[0,8],[16,8],[36,8],[47,-17]],water:[{id:'common-canal',x:15,z:0,width:8,depth:160,kind:'canal'}],bridges:[{id:'market-bridge',x:15,z:8,width:11,depth:12}],ridges:[[-65,-48,10,18],[65,-50,10,22],[62,49,9,18]]},
};
const outdoor=/(SQUARE|FIELD|FARM|WELL|EDGE|FENCE|RIVER|POOL|WORLD_TREE|MAZE|NEST|PATH|HERB_GARDEN|ARCHERY_GROVE|BARRIER_STONE|NOTICE|BOARD|HORSE_TIE|HORSE_POST|WATERWAY|NEWSPAPER|DOCK|PORT|WALL)$/;
const kindOf=r=>/INN|REST|GUEST|HUT/.test(r[0])?'inn':/STABLE|HORSE|BEAST/.test(r[0])?'stable':/BOARD|NOTICE|SQUARE|CHIEF|COUNCIL|COMMAND|OFFICE/.test(r[0])?'board':/FORGE|MAGE|ARCHERY|ENGINEER/.test(r[0])?'trainer':/MARKET|SHOP|APOTHECARY|BAKERY|REPAIR|SOUVENIR|GAMBLING|FORGER/.test(r[0])?'shop':/FIELD|FARM|SUPPLY|PORT|WAREHOUSE|GRANARY|SHIPYARD/.test(r[0])?'job':'landmark';
const point=(x,z)=>[x,0,z];
const footprint=o=>({id:`${o.id}:footprint`,x:o.buildingPosition[0],z:o.buildingPosition[2],width:o.width,depth:o.depth,height:o.height});
function roadRegion(region,width=3.2){return {...region,obstacles:[...region.obstacles.filter(o=>!/:left$|:right$|:back$/.test(o.id)),...region.objects.filter(o=>o.buildingPosition).map(footprint)].map(o=>({...o,width:o.width+width-.9,depth:o.depth+width-.9}))};}
function clearLine(region,a,b){const steps=Math.ceil(distance(a,b)/.45);for(let i=0;i<=steps;i++){const t=i/Math.max(1,steps);if(!canOccupy(region,point(a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t)))return false;}return true;}
function addRoad(region,from,to,width=3.2,kind='lane'){
 if(distance(from,to)<.2)return;
 const navigation=roadRegion(region,width),path=findPath(navigation,from,to);
 if(!canOccupy(navigation,from)||!path.length||!path.every((p,i)=>clearLine(navigation,i?path[i-1]:from,p)))throw new Error(`${region.id}: cannot author ${kind} road ${from} → ${to}`);
 region.terrain.paths.push({points:[from,...path],width,kind});
}
function addWaterObstacles(region){
 for(const water of region.terrain.water){
  const crossings=region.terrain.bridges.filter(b=>Math.abs(b.x-water.x)<water.width/2).sort((a,b)=>a.z-b.z);
  let start=water.z-water.depth/2;const end=water.z+water.depth/2;
  for(const [i,bridge] of [...crossings,{z:end,depth:0}].entries()){
   const edge=bridge.z-bridge.depth/2;if(edge>start)region.obstacles.push({id:`water:${water.id}:${i}`,x:water.x,z:(start+edge)/2,width:water.width,depth:edge-start,height:.15});start=bridge.z+bridge.depth/2;
  }
 }
}
export function createRegion(spec,sheet,sourceUrl){
 const [id,name,biome,color,worldPosition,description]=spec,layout=layouts[id],facilities=sheet.rows.filter(r=>/^LOC_/.test(r[0]||''));
 if(facilities.length!==layout.sites.length)throw new Error(`${id}: authored site count no longer matches source`);
 const region={id,name,biome,color,worldPosition,description,size:160,spawn:[0,0,8],identity:layout.identity,obstacles:[],objects:[],portals:[],source:{sheet:name,url:sheet.url||sourceUrl},terrain:{paths:[],water:layout.water||[],bridges:layout.bridges||[],ridges:(layout.ridges||[]).map(([x,z,radius,height])=>({x,z,radius,height})),plots:(layout.plots||[]).map(([x,z,width,depth])=>({x,z,width,depth,color:id==='farm'?'#b8a050':'#9b885a'})),trees:[]}};
 facilities.forEach((r,i)=>{
  const [x,z]=layout.sites[i],kind=kindOf(r),built=!outdoor.test(r[0]),width=/CASTLE|COLOSSUS/.test(r[0])?15:biome==='city'?11:10,depth=/CASTLE|COLOSSUS/.test(r[0])?12:9,height=/CASTLE|MAGE_TOWER|COLOSSUS/.test(r[0])?8:['city','ruins'].includes(biome)?5:3.8;
  const position=point(x,built?z+depth/2+3.5:z),asset=built?'building':kind==='board'?'sign':/WELL|POOL/.test(r[0])?'well':/FIELD|FARM/.test(r[0])?'field':/WORLD_TREE/.test(r[0])?'world-tree':'landmark';
  const o={id:r[0],name:r[1],kind,position,asset,source:{sheet:name,row:sheet.rows.indexOf(r)+1,url:sheet.url||sourceUrl,id:r[0]},description:r[3]||r[1],placement:'authored-geography'};
  if(built){o.buildingPosition=point(x,z);Object.assign(o,{width,depth,height,interior:{entrance:point(x,z+depth/2),floorY:0,openFront:true}});region.obstacles.push({id:`${o.id}:left`,x:x-width/2,z,width:.4,depth,height},{id:`${o.id}:right`,x:x+width/2,z,width:.4,depth,height},{id:`${o.id}:back`,x,z:z-depth/2,width,depth:.4,height});}
  if(kind==='stable')o.skills=['riding'];region.objects.push(o);
 });
 region.objects.push({id:`${id}:trainer`,name:id==='farm'?'旅支度の稽古場':'地域の師匠',kind:'trainer',position:[8,0,17],asset:'stall',skills:['combat','investigation','riding','magic','broom','negotiation','crafting','tracking','stealth','survival'],description:'学んだ技能は、旅の手段と事件への関わり方を変える。',placement:'authored-service'});
 region.objects.push({id:`${id}:board`,name:'旅人の掲示板',kind:'board',position:[-7,0,8],asset:'sign',description:'この土地に届いた知らせと、地元の仕事が掲示されている。',placement:'authored-service'});
 addWaterObstacles(region);
 for(const r of region.terrain.ridges)region.obstacles.push({id:`ridge:${r.x}:${r.z}`,x:r.x,z:r.z,width:r.radius*2,depth:r.radius*2,height:r.height});
 return region;
}
export function createPortal(region,target,route){
 const dx=target.worldPosition[0]-region.worldPosition[0],dz=target.worldPosition[1]-region.worldPosition[1],angle=Math.atan2(dz,dx),navigation=roadRegion(region,4),dock=layouts[region.id].dock;
 let position;
 if(route.modes.includes('boat')&&dock)position=[...dock];
 else for(const radius of [70,66,61,56,51,46]){for(const turn of [0,.12,-.12,.24,-.24,.36,-.36]){const candidate=point(Math.round(Math.cos(angle+turn)*radius),Math.round(Math.sin(angle+turn)*radius));if(canOccupy(navigation,candidate)&&findPath(navigation,region.spawn,candidate).length){position=candidate;break;}}if(position)break;}
 if(!position)throw new Error(`${region.id}/${route.id}: no reachable exit`);
 return {id:`${region.id}:${route.id}`,to:target.id,routeId:route.id,position,radius:3,bearing:[dx,dz],kind:route.modes.includes('boat')?'harbor':'road'};
}
export function placeNPC(reg,npcRow,index){
 const primary=reg.objects.find(o=>o.id===npcRow[21]),related=reg.objects.find(o=>String(npcRow[22]||'').includes(o.id)),fallback=reg.objects.find(o=>o.kind==='board');
 const workObject=primary||related||fallback,work=[...workObject.position];
 const residences=reg.objects.filter(o=>o.buildingPosition&&(/INN|HOUSE|ORPHANAGE|GUEST|BARRACKS|CHIEF|CAMP/.test(o.id)));
 const homeObject=residences[index%Math.max(1,residences.length)]||reg.objects.find(o=>o.buildingPosition);
 const target=homeObject?point(homeObject.buildingPosition[0]+(index%3-1)*1.5,homeObject.buildingPosition[2]+1.2):point(work[0]+1.5,work[2]+2);
 const home=canOccupy(reg,target)&&findPath(reg,work,target).length?target:[...work];
 return {home,work,workFacilityId:workObject.id,homeFacilityId:homeObject?.id||workObject.id,placement:'source-workplace-authored-residence',scheduleSource:npcRow[15]||''};
}
const segmentDistance=(p,a,b)=>{const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);};
export function finalizeRegions(regions,npcs,events){
 for(const region of regions){
  const spine=layouts[region.id].spine.map(([x,z])=>point(x,z));
  for(let i=1;i<spine.length;i++)addRoad(region,spine[i-1],spine[i],region.id==='capital'?5:3.5,'main');
  const targets=[...region.objects.map(o=>({id:o.id,position:o.position})),...region.portals,...events.filter(e=>e.region===region.id)];
  for(const target of targets){const anchors=[region.spawn,...region.terrain.paths.flatMap(p=>p.points)].sort((a,b)=>distance(a,target.position)-distance(b,target.position));addRoad(region,anchors[0],target.position,target.routeId?4:3.2,target.routeId?'exit':'access');}
  const reserved=[region.spawn,...targets.map(o=>o.position),...npcs.filter(n=>n.region===region.id).flatMap(n=>[n.home,n.work])],built=region.objects.filter(o=>o.buildingPosition).map(footprint);
  const count=['forest','grove'].includes(region.biome)?90:region.biome==='city'?20:['cave','ruins','snow','volcanic'].includes(region.biome)?22:46;
  for(let i=0;i<400&&region.terrain.trees.length<count;i++){
   const x=((i*47+region.id.length*19)%149)-74,z=((i*71+23)%149)-74,p=point(x,z),rock=['desert','cave','ruins','volcanic'].includes(region.biome),clearance=rock?3.5:4;
   if(reserved.some(q=>distance(p,q)<6)||[...region.obstacles,...built].some(o=>Math.abs(x-o.x)<o.width/2+clearance&&Math.abs(z-o.z)<o.depth/2+clearance))continue;
   if(region.terrain.paths.some(path=>path.points.some((b,j)=>j>0&&segmentDistance(p,path.points[j-1],b)<path.width/2+clearance)))continue;
   const id=`${region.id}:foliage:${i}`,height=rock?3+(i%3):6+(i%4)*1.3,asset=rock?'town/rock-wide.glb':i%3?'town/tree.glb':'town/tree-high.glb',collisionWidth=rock?3.4:1.1,collisionDepth=collisionWidth;
   region.terrain.trees.push({id,x,z,height,asset,collisionWidth,collisionDepth});region.obstacles.push({id:`tree:${id}`,x,z,width:collisionWidth,depth:collisionDepth,height:rock?height:Math.min(height,4.2)});
  }
  for(const target of targets)if(!canOccupy(region,target.position)||!findPath(region,region.spawn,target.position).length)throw new Error(`${region.id}/${target.id}: unreachable after scenery placement`);
 }
}
