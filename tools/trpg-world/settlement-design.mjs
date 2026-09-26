import {findStreetPath,pathIsTraversable,distance} from '../../src/shared/trpg-world/navigation.js';
// Authoring model, not player knowledge. Land use and traffic explain the graybox.
// Stable site IDs bind functions; replacement geometry must not rename a shop.
const district=(id,name,sites,purpose)=>({id,name,sites,purpose});
const flow=(id,kind,stops,reason,window)=>({id,kind,stops,reason,window});
export const settlementDesigns={
 farm:{
  role:'王都へ穀物を供給する農村。畑・集荷・生活の動線を井戸と広場で接続する。',
  population:{planningRange:[180,320],status:'scale-target-only'},
  districts:[
   district('production','耕作・集荷帯',['LOC_FARM_FIELD','LOC_FARM_GRANARY'],'畑の収穫を共同穀倉へ集める。荷車は井戸端を横切らず外縁を回る。'),
   district('commons','共同生活の中心',['LOC_FARM_SQUARE','LOC_FARM_WELL','LOC_FARM_CHIEF'],'水汲み、相談、荷改めが重なる接点。'),
   district('road-services','旅人・生活商業',['LOC_FARM_INN','LOC_FARM_BAKERY','LOC_FARM_STABLE','LOC_FARM_REPAIR'],'宿とパン屋は住民も使う。馬屋は客室から離し、荷車が回れる側へ置く。'),
   district('fringe','牧草地・警戒縁',['LOC_FARM_EDGE','LOC_FARM_NORTH_FENCE'],'生活圏と獣の移動域の境界。見張り道は輸送幹線と分ける。'),
  ],
  flows:[
   flow('grain','cargo',['LOC_FARM_FIELD','LOC_FARM_GRANARY','R12'],'収穫を保管・計量して王都へ搬出','朝の集荷'),
   flow('bread','household',['LOC_FARM_GRANARY','LOC_FARM_BAKERY','LOC_FARM_INN'],'穀物を生活の食事へつなぐ','早朝仕込み・昼夕の食事'),
   flow('traveler','visitor',['R12','LOC_FARM_STABLE','LOC_FARM_INN','LOC_FARM_SQUARE'],'馬を預けて宿を取り、村の用務を知る','到着から夕方'),
   flow('watch','patrol',['LOC_FARM_CHIEF','LOC_FARM_NORTH_FENCE','LOC_FARM_EDGE'],'北柵と家畜の側を見回る','夕方から夜'),
  ],
  contactSites:['LOC_FARM_WELL','LOC_FARM_SQUARE','LOC_FARM_INN'],
  risks:['穀倉裏は荷の出入りが多く、人目が広場より薄い','北柵の外では野生動物と農作業の道が交わる'],
 },
 capital:{
  role:'政治・消費・加工の中心。食料をR12、海産物と輸入品をR06、薬草と木材をR13に依存する。',
  population:{planningRange:[6000,12000],status:'scale-target-only'},
  districts:[
   district('civic','王城・行政街',['LOC_CAP_CASTLE','LOC_CAP_MAGE_TOWER','LOC_CAP_OFFICE'],'王城、審理、魔術施設を北側へまとめ、日常商業の通過交通と分ける。'),
   district('market','中央市場・職人商業',['LOC_CAP_MARKET','LOC_CAP_WEAPON_SHOP','LOC_CAP_APOTHECARY'],'三方向から来る食料・武具・薬を受ける。武器製造はドワーフ工房、王都は販売と補修の結節点。'),
   district('arrival','南の到着街',['LOC_CAP_STABLE','LOC_CAP_NEWSPAPER'],'駅馬車、案内、瓦版。旅人が行政街へ入る前に情報を得る。'),
   district('lower','西の下層住宅街',['LOC_CAP_LOWER_INN','LOC_CAP_ORPHANAGE','LOC_CAP_BIG_STORE'],'安宿と生活支援が近接。大型店は争われている同じ土地の将来用途で、別の繁盛店として数えない。'),
   district('river-homes','東の居住街',['LOC_CAP_AJIN_QUARTER'],'河岸の労働と市場へ通う住民の地区。民族名を危険度として扱わない。'),
  ],
  flows:[
   flow('food-import','cargo',['R12','LOC_CAP_STABLE','LOC_CAP_MARKET'],'門前で荷を整え、市場の荷捌き側へ運ぶ','朝の搬入'),
   flow('coastal-import','cargo',['R06','LOC_CAP_MARKET','LOC_CAP_WEAPON_SHOP'],'北西の陸路から入荷。王都に未実装の海港を仮定しない','日中の商隊'),
   flow('herbs','cargo',['R13','LOC_CAP_APOTHECARY','LOC_CAP_MARKET'],'東の渡河地点から薬草を運ぶ','採取者の帰還時'),
   flow('visitor','visitor',['R12','LOC_CAP_STABLE','LOC_CAP_LOWER_INN','LOC_CAP_MARKET'],'到着、宿泊、買物を王城通過なしで済ませる','午後の到着'),
   flow('resident','commute',['LOC_CAP_AJIN_QUARTER','LOC_CAP_MARKET','LOC_CAP_NEWSPAPER'],'居住地と仕事・買物・情報の接触','朝夕'),
   flow('official','institution',['LOC_CAP_OFFICE','LOC_CAP_ORPHANAGE','LOC_CAP_AJIN_QUARTER'],'役人は命令を現地へ持参する。行政街だけで完結しない','窓口の執務時間'),
   flow('guard','patrol',['LOC_CAP_CASTLE','LOC_CAP_MARKET','LOC_CAP_STABLE'],'大門・市場の警備から離れた荷捌き裏は監視が薄くなり得る','交代制'),
  ],
  contactSites:['LOC_CAP_MARKET','LOC_CAP_STABLE','LOC_CAP_NEWSPAPER','LOC_CAP_LOWER_INN'],
  risks:['市場裏の荷捌きと下層の生活路地は大通りから見通せない','行政街への少ない入口は人の集中と検問を生む'],
 },
 trade:{
  role:'港湾と内陸物流の積替都市。港・税関・保管・市場・陸路が連続する。',
  population:{planningRange:[2500,5000],status:'scale-target-only'},
  districts:[
   district('freight','港湾・保税倉庫',['LOC_TRADE_PORT','LOC_TRADE_WAREHOUSE','LOC_TRADE_CUSTOMS'],'荷揚げ後に税関と保管を通す。宿泊客の歩道と荷車道は分ける。'),
   district('waterfront','魚市場・船大工',['LOC_TRADE_FISH_MARKET','LOC_TRADE_SHIPYARD'],'傷みやすい魚と重い船材を水辺から遠ざけない。'),
   district('exchange','商人・行政街',['LOC_TRADE_GUILD','LOC_TRADE_LORD_MANOR'],'契約と行政は港を監督するが全倉庫内を透視できない。'),
   district('arrival','宿泊・陸送街',['LOC_TRADE_INN','LOC_TRADE_APOTHECARY','LOC_TRADE_STABLE'],'御者、船員、商人が食事と宿で出会う。馬屋は内陸への積替口。'),
  ],
  flows:[
   flow('imports','cargo',['R08','LOC_TRADE_PORT','LOC_TRADE_CUSTOMS','LOC_TRADE_WAREHOUSE','LOC_TRADE_STABLE','R06'],'船荷を陸送へ積み替える','入港から荷揚げ・通関後'),
   flow('fish','household',['LOC_TRADE_PORT','LOC_TRADE_FISH_MARKET','LOC_TRADE_INN'],'水揚げした魚を市場と食卓へ運ぶ','朝の水揚げ'),
   flow('timber','cargo',['R06','LOC_TRADE_STABLE','LOC_TRADE_SHIPYARD'],'重い船材は倉庫裏から岸壁へ運ぶ','日中'),
   flow('passenger','visitor',['R08','LOC_TRADE_PORT','LOC_TRADE_INN','LOC_TRADE_GUILD'],'船客が宿で陸の情報を聞き、商談へ向かう','入港後'),
  ],
  contactSites:['LOC_TRADE_FISH_MARKET','LOC_TRADE_INN','LOC_TRADE_STABLE'],
  risks:['倉庫裏は契約上の監視と実際の見通しが食い違う','税関や岸壁の閉鎖は旅客と補給の両方へ波及する'],
 },
};

// Back walls of working yards, not decorative screens or sealed fake houses.
// They leave two passages around a loading court and hide the market on entry.
export const spatialBoundaries={
 capital:[{id:'market-loading-wall',x:0,z:25,width:17,depth:1,height:5,purpose:'市場の荷捌き庭と駅馬車から来る歩行者を分ける背壁'},
          {id:'workshop-yard-wall',x:25,z:13,width:1,depth:18,height:4,purpose:'工房・薬屋側の作業庭を居住街への通りから分ける壁'}],
};

export function bindSettlementDesign(region){
 const design=settlementDesigns[region.id];if(!design)return;
 region.settlement=structuredClone(design);
 region.settlement.status='functional-layout-foundation';
 const assigned=new Set();
 for(const ward of region.settlement.districts)for(const id of ward.sites){
  const site=region.objects.find(o=>o.id===id);if(!site||assigned.has(id))throw new Error(`Invalid district site ${region.id}/${id}`);
  assigned.add(id);site.districtId=ward.id;
 }
 for(const f of region.settlement.flows)for(const id of f.stops){
  if(!region.objects.some(o=>o.id===id)&&!region.portals.some(p=>p.routeId===id))throw new Error(`Unbound traffic stop ${region.id}/${f.id}/${id}`);
 }
 // Plans do not silently mint citizens, cargo or jobs. Existing actors and
 // shipments execute; unassigned design flows remain explicit authoring tasks.
}

export function compileSettlementTraffic(regions,npcs){
 for(const region of regions){
  if(!region.settlement)continue;
  region.settlement.simulatedResidents=npcs.filter(n=>n.region===region.id).length;
  for(const ward of region.settlement.districts){
   ward.workerIds=npcs.filter(n=>n.region===region.id&&ward.sites.includes(n.workFacilityId)).map(n=>n.id);
   ward.residentIds=npcs.filter(n=>n.region===region.id&&ward.sites.includes(n.homeFacilityId)).map(n=>n.id);
  }
  for(const flow of region.settlement.flows){
   const stops=flow.stops.map(id=>region.objects.find(o=>o.id===id)||region.portals.find(p=>p.routeId===id));
   flow.legs=[];
   for(let i=1;i<stops.length;i++){
    const from=stops[i-1],to=stops[i],path=findStreetPath(region,from.position,to.position);
    if(!path.length||!pathIsTraversable(region,from.position,path))throw new Error(`Unreachable settlement flow ${region.id}/${flow.id}/${from.id}/${to.id}`);
    flow.legs.push({fromId:from.id,toId:to.id,points:[from.position,...path],metres:path.reduce((sum,p,j)=>sum+distance(j?path[j-1]:from.position,p),0)});
   }
   flow.execution='traversable-layout-not-an-automatic-shipment';
  }
 }
}
