import {canOccupy,distance,findPath} from '../../src/shared/trpg-world/navigation.js';
// Land use is authored from livelihood and terrain, not generated from a
// nearest-facility road tree. IDs survive later mesh replacement. These parcels
// do not mint resources, grant legal ownership, or invent unseen inhabitants.
const parcel=(id,use,site,x,z,width,depth,reason)=>({id,use,site,x,z,width,depth,reason});
export const landUsePlans={
 farm:[
  parcel('north-crops','cropland','LOC_FARM_FIELD',-33,84,48,24,'麦畑の続き。村道は畦と集荷口を回る'),
  parcel('west-crops','cropland','LOC_FARM_FIELD',-88,-8,32,98,'西の耕作帯。家と耕地を離れすぎさせない'),
  parcel('south-crops','cropland','LOC_FARM_FIELD',-29,-88,60,28,'王都へ出荷する耕地'),
  parcel('grazing','pasture','LOC_FARM_STABLE',79,39,44,62,'厩舎から出せる飼養地'),
  parcel('kitchen-garden','garden','LOC_FARM_INN',-17,47,18,18,'宿の裏の小菜園'),
  parcel('grain-yard','loading','LOC_FARM_GRANARY',-38,-46,20,14,'集荷と荷車の作業面。倉庫とは別の屋外空間'),
 ],
 capital:[
  parcel('gate-pasture','pasture','LOC_CAP_STABLE',-29,83,36,34,'城外の駅馬車用飼養地'),
  parcel('river-gardens','garden','LOC_CAP_AJIN_QUARTER',81,31,24,64,'河岸の住民が使う菜園帯'),
  parcel('lower-common','commons','LOC_CAP_LOWER_INN',-66,25,17,37,'下層住居に接する共同庭。洗濯・休息の余白'),
  parcel('market-receiving','loading','LOC_CAP_MARKET',9,10,18,22,'市場の荷改め・荷車の待避面'),
  parcel('castle-court','commons','LOC_CAP_CASTLE',1,-81,28,18,'城番と使用人の作業庭'),
  parcel('west-orchard','orchard','LOC_CAP_MARKET',-92,-23,25,100,'西の市街外縁に残る果樹畑'),
 ],
 trade:[
  parcel('customs-yard','loading','LOC_TRADE_CUSTOMS',-20,-14,26,21,'検査・積替え用の屋外面'),
  parcel('timber-yard','timber','LOC_TRADE_SHIPYARD',-21,77,32,24,'船材を乾かす置場'),
  parcel('wagon-pasture','pasture','LOC_TRADE_STABLE',77,49,35,42,'内陸輸送の荷駄の飼養地'),
  parcel('workers-common','commons','trade:workers-house',-25,-83,27,18,'長屋の共同庭'),
  parcel('market-gardens','garden','LOC_TRADE_INN',12,77,23,22,'食堂へ通う生活圏の菜園'),
 ],
 crime:[
  parcel('dock-loading','loading','LOC_CRIME_DOCK',38,1,21,18,'狭い岸壁と倉庫間の荷捌き'),
  parcel('warehouse-court','loading','LOC_CRIME_WAREHOUSE',39,53,24,22,'倉庫の裏庭。滞留と受渡しの場所'),
  parcel('lodgers-common','commons','crime:quay-tenement',4,12,14,15,'借家から使う小さな共同庭'),
  parcel('western-gardens','garden','LOC_CRIME_INFO_STREET',-66,4,20,26,'島の水と食料を補う小菜園'),
  parcel('stable-grazing','pasture','LOC_CRIME_STABLE',-28,79,35,28,'荷駄の限られた飼養場所'),
 ],
 frontier:[
  parcel('dry-fields','cropland','LOC_BORDER_FARM',-42,2,31,26,'乾いた耕地は井戸のある生活圏に近接する'),
  parcel('south-fields','cropland','LOC_BORDER_FARM',-40,-54,34,23,'参道から外れた村の耕地'),
  parcel('pilgrim-court','commons','LOC_BORDER_PILGRIM_SQUARE',4,-43,23,15,'旅人が腰を下ろす共同の休憩面'),
  parcel('stable-paddock','pasture','LOC_BORDER_STABLE',55,14,22,30,'馬屋に接する待機地'),
 ],
 temple:[
  parcel('arrival-court','commons','LOC_TEMPLE_GATE',0,60,28,20,'参拝前の集合と休憩'),
  parcel('staff-garden','garden','LOC_TEMPLE_ADMIN',-45,2,20,20,'管理者の生活区画に付属する菜園'),
  parcel('repair-yard','timber','LOC_TEMPLE_ADMIN',-42,52,20,16,'回廊の修繕資材を置く作業面'),
  parcel('pilgrim-garden','garden','LOC_TEMPLE_REST',44,9,18,21,'巡礼の休息場所に隣接する庭'),
 ],
 forest:[
  parcel('managed-wood','woodland','LOC_FOREST_EDGE',-85,22,36,115,'外縁の林。人が利用する林から奥の森へ移る'),
  parcel('deep-wood','woodland','LOC_FOREST_MAZE',77,-24,48,130,'獣道と結界への枝道を囲む深い森'),
  parcel('headwater-wood','woodland','LOC_FOREST_SPIRIT_POOL',-10,-87,115,25,'川の源流側の林帯'),
  parcel('camp-supply','timber','LOC_FOREST_CAMP',-17,48,16,13,'野営の薪と補修の作業面'),
 ],
 elf:[
  parcel('nursery','garden','LOC_ELF_HERB_GARDEN',47,44,26,22,'薬草園の育苗と手入れの場所'),
  parcel('root-commons','commons','LOC_ELF_YOUNG_HOUSE',-30,51,24,16,'住居の共同生活面'),
  parcel('protected-grove','woodland','LOC_ELF_WORLD_TREE',-55,-44,22,28,'世界樹の根道を守る林'),
  parcel('eastern-grove','woodland','LOC_ELF_MARKET',40,-5,23,32,'交換所から住まいへ続く林'),
 ],
 fortress:[
  parcel('supply-court','loading','LOC_FORT_SUPPLY',-24,8,25,22,'補給庫の搬入と整理'),
  parcel('muster','commons','LOC_FORT_BARRACKS',-25,-7,22,18,'兵舎から出る点呼と交代の場所'),
  parcel('horse-paddock','pasture','LOC_FORT_STABLE',-47,29,18,28,'軍馬の待機と飼養'),
  parcel('clinic-garden','garden','LOC_FORT_CLINIC',45,-6,20,20,'軍医室に接する静かな休息庭'),
 ],
 dwarf:[
  parcel('ore-sorting','loading','LOC_DWARF_MARKET',17,40,18,10,'鉱石の仕分けと坑内運搬の接点'),
  parcel('forge-yard','loading','LOC_DWARF_FORGE',-28,-10,18,10,'工房脇の作業面。空洞内だけに配置'),
  parcel('common-table','commons','LOC_DWARF_INN',-25,14,20,12,'坑夫の食事と休息の空洞'),
 ],
 blackridge:[
  parcel('exile-gardens','garden','LOC_BLACKRIDGE_EXILE',-51,0,22,26,'定住へ移る住民の菜園'),
  parcel('market-yard','loading','LOC_BLACKRIDGE_MARKET',34,8,25,20,'水路から市場へ運ぶ受渡し面'),
  parcel('shared-court','commons','LOC_BLACKRIDGE_COMMON_INN',-18,53,27,16,'多種族の共同宿に接する庭'),
  parcel('mount-paddock','pasture','LOC_BLACKRIDGE_STABLE',49,29,20,24,'乗獣の飼養場所'),
  parcel('council-garden','garden','LOC_BLACKRIDGE_COUNCIL',-42,-46,19,23,'評議場に隣接する休息の庭'),
 ],
};

const colors={cropland:'#978149',pasture:'#788054',garden:'#61724b',orchard:'#6b7950',woodland:'#4a6043',loading:'#8b8071',commons:'#a2947e',timber:'#79694f'};
export function authorLandUse(region){
 const plans=landUsePlans[region.id];if(!plans)throw new Error(`Missing land use ${region.id}`);
 region.terrain.parcels=plans.map(p=>{
  if(!region.objects.some(o=>o.id===p.site))throw new Error(`Unbound land use ${region.id}/${p.id}`);
  return {...p,id:`parcel:${region.id}:${p.id}`,color:colors[p.use],implementation:'outdoor-graybox',economicStatus:'not-an-inventory-source'};
 });
}

const roadDistance=(p,a,b)=>{
 const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz||1)));
 return Math.hypot(p[0]-a[0]-dx*t,p[2]-a[2]-dz*t);
};
export function furnishLandUse(region,npcs,events){
 authorLandUse(region);
 const reserved=[region.spawn,...region.objects.flatMap(o=>[o.position,o.interior?.entrance].filter(Boolean)),...region.portals.map(p=>p.position),...npcs.filter(n=>n.region===region.id).flatMap(n=>[n.home,n.work]),...events.filter(e=>e.region===region.id).map(e=>e.position)];
 const clear=(p,r)=>canOccupy(region,p,r)&&!reserved.some(q=>distance(p,q)<r+3)
  &&!region.objects.some(o=>o.buildingPosition&&Math.abs(p[0]-o.buildingPosition[0])<o.width/2+r&&Math.abs(p[2]-o.buildingPosition[2])<o.depth/2+r)
  &&!region.terrain.paths.some(path=>path.points.some((b,i)=>i&&roadDistance(p,path.points[i-1],b)<path.width/2+r));
 region.terrain.landUseProps=[];
 for(const parcel of region.terrain.parcels){
  parcel.tiles=[];
  for(let x=parcel.x-parcel.width/2+2;x<parcel.x+parcel.width/2-1;x+=4)for(let z=parcel.z-parcel.depth/2+2;z<parcel.z+parcel.depth/2-1;z+=4){
   const p=[x,0,z];if(!clear(p,3))continue;
   parcel.tiles.push({x,z,width:4,depth:4});
  }
  const asset=['woodland','orchard','pasture'].includes(parcel.use)?'town/tree.glb':parcel.use==='commons'?'town/stall-bench.glb':parcel.use==='loading'?'town/cart.glb':parcel.use==='timber'?'town/planks.glb':null;
  if(!asset)continue;
  const limit=parcel.use==='woodland'?60:parcel.use==='orchard'?25:parcel.use==='pasture'?3:4;
  // Deterministic spatial distribution, not the first N cells along one edge.
  const ordered=[...parcel.tiles].sort((a,b)=>((a.x*73856093+a.z*19349663)>>>0)-((b.x*73856093+b.z*19349663)>>>0));
  for(const tile of ordered){
   if(region.terrain.landUseProps.filter(p=>p.parcelId===parcel.id).length>=limit)break;
   const p=[tile.x,0,tile.z];if(!clear(p,2.2)||region.terrain.landUseProps.some(o=>distance(o.position,p)<8))continue;
   const tree=['woodland','orchard','pasture'].includes(parcel.use),width=tree?1.1:2,depth=tree?1.1:2,height=tree?6:parcel.use==='timber'?.6:1.1,id=`${parcel.id}:prop:${region.terrain.landUseProps.length}`;
   region.terrain.landUseProps.push({id,parcelId:parcel.id,asset,position:p,size:tree?[3.5,height,3.5]:[width,height,depth]});
   region.obstacles.push({id,x:p[0],z:p[2],width,depth,height:tree?4:height});
  }
 }
}

export function bindOutdoorWorksites(regions,jobs){
 for(const region of regions)for(const parcel of region.terrain.parcels){
  const compatible={cropland:/草取り|収穫|畑/,loading:/袋運び|棚卸|荷運び|鉱石運び|鉱石選別|荷札/,timber:/帆布|船具/}[parcel.use];
  if(!compatible)continue;
  const offers=jobs.filter(j=>j.facilityId===parcel.site&&compatible.test(j.name));if(!offers.length)continue;
  const tile=parcel.tiles.find(t=>canOccupy(region,[t.x,0,t.z])&&findPath(region,region.spawn,[t.x,0,t.z]).length);
  if(!tile)throw new Error(`Work parcel has no reachable standing point ${parcel.id}`);
  const parent=region.objects.find(o=>o.id===parcel.site),id=`worksite:${parcel.id}`;
  region.objects.push({id,name:`${parent.name}・${parcel.use==='cropland'?'耕作区':parcel.use==='timber'?'修繕場':'荷捌き場'}`,kind:'job',asset:'field',position:[tile.x,0,tile.z],workplaceId:parent.id,jobIds:offers.map(j=>j.id),description:'作業道具が置かれ、仕事の跡が残っている。',placement:'authored-outdoor-workplace'});
  parcel.worksiteId=id;parcel.economicStatus='existing-job-at-physical-worksite';
 }
}
