import {canOccupy,findPath} from '../../src/shared/trpg-world/navigation.js';

// Explicit households/tenancies, never modulo the NPC row number. Room numbers
// are authoring IDs; shared accommodation does not imply a family relationship.
const npc=id=>`NPC${String(id).padStart(3,'0')}`;
const home=(id,region,site,mode,people,reason)=>({id,region,siteId:site,mode,residentIds:people.map(npc),reason});
export const dwellings=[
 ['farm:mira-house','farm','北畑の家',-18,-58,'commons'],
 ['farm:eda-house','farm','畑沿いの農家',-65,10,'production'],
 ['farm:granary-house','farm','穀倉番の家',-57,-38,'production'],
 ['farm:hunter-house','farm','林縁の家',63,-22,'fringe'],
 ['farm:well-house','farm','井戸道の家',29,5,'commons'],
 ['farm:south-house','farm','畑道の家',-39,57,'road-services'],
 ['capital:noble-house','capital','北街の屋敷',35,-65,'civic'],
 ['capital:guard-quarters','capital','城番の宿舎',3,-76,'civic'],
 ['capital:clerk-house','capital','役所裏の長屋',-62,-54,'civic'],
 ['capital:news-house','capital','瓦版通りの長屋',30,67,'arrival'],
 ['capital:stable-house','capital','駅馬車場の住居',20,84,'arrival'],
 ['capital:market-house','capital','市場西の長屋',-31,9,'market'],
 ['trade:workers-house','trade','港の職人長屋',-26,-65,'freight'],
 ['trade:customs-house','trade','税関通りの長屋',12,-60,'exchange'],
 ['trade:guild-house','trade','商人街の住居',0,-42,'exchange'],
 ['trade:stable-house','trade','荷馬車組合の住居',48,50,'arrival'],
 ['trade:shipwright-house','trade','船大工の長屋',-23,57,'waterfront'],
];

export const residences=[
 home('mira-household','farm','farm:mira-house','household',[1,2],'母と子が同じ家に住む'),
 home('village-chief','farm','LOC_FARM_CHIEF','staff-quarters',[3],'村長宅'),
 home('eda-household','farm','farm:eda-house','household',[4],'耕地に通う農家'),
 home('granary-keeper','farm','farm:granary-house','household',[5],'集荷所の近くに住む管理人'),
 home('village-lodgers','farm','LOC_FARM_INN','temporary-lodging',[6,8],'出稼ぎと行商の滞在。宿を家族の家と混同しない'),
 home('wheat-innkeeper','farm','LOC_FARM_INN','staff-quarters',[58],'宿の居住区'),
 home('baker-household','farm','LOC_FARM_BAKERY','shop-house',[59],'早朝仕込みのため職住一体'),
 home('hunter-household','farm','farm:hunter-house','household',[60],'林縁から狩場へ通う'),
 home('herbalist-household','farm','farm:well-house','household',[61],'井戸へ通う生活圏'),
 home('south-household','farm','farm:south-house','household',[62],'村の定住者。未登場の家族を自動生成しない'),
 home('ranch-household','farm','LOC_FARM_STABLE','staff-quarters',[63],'厩舎に付属する居住区'),
 home('repair-household','farm','LOC_FARM_REPAIR','shop-house',[111],'修理屋の住居区'),
 home('capital-visitors','capital','LOC_CAP_LOWER_INN','temporary-lodging',[15,18,46,56],'使者・旅人の滞在先'),
 home('royal-residence','capital','LOC_CAP_CASTLE','household',[16],'王は城内の居住区に住む'),
 home('court-mage','capital','LOC_CAP_MAGE_TOWER','staff-quarters',[17],'宮廷勤務の居住区'),
 home('noble-residence','capital','capital:noble-house','household',[19],'行政街の屋敷'),
 home('capital-tenants','capital','LOC_CAP_LOWER_INN','rented-room',[20,25],'長期の部屋借り。宿泊者と同じ世帯ではない'),
 home('orphanage-household','capital','LOC_CAP_ORPHANAGE','communal-care',[21,22,71,72],'院長と入所児童の実際の居住先'),
 home('market-tenants','capital','capital:market-house','rented-room',[23,70],'商業街へ通う別々の借家人'),
 home('capital-guard','capital','capital:guard-quarters','barracks',[24],'衛兵の当直・帰還先'),
 home('riverside-representative','capital','LOC_CAP_AJIN_QUARTER','household',[26],'代表者自身も地区の住民'),
 home('capital-innkeeper','capital','LOC_CAP_LOWER_INN','staff-quarters',[64],'安宿主人の居住区'),
 home('arms-shop-house','capital','LOC_CAP_WEAPON_SHOP','shop-house',[65],'武器屋の職住一体'),
 home('pharmacy-house','capital','LOC_CAP_APOTHECARY','shop-house',[66],'薬屋の職住一体'),
 home('clerk-tenancy','capital','capital:clerk-house','rented-room',[67],'徒歩で土地課へ出勤'),
 home('news-tenancy','capital','capital:news-house','rented-room',[68],'瓦版売りの帰宅先'),
 home('capital-horse-house','capital','capital:stable-house','household',[69],'駅馬車場へ通う馬商'),
 home('guild-tenants','trade','trade:guild-house','rented-room',[7,14],'ギルドに通う商人。血縁は仮定しない'),
 home('lord-household','trade','LOC_TRADE_LORD_MANOR','household',[9,10],'領主館の居住区'),
 home('manor-staff','trade','LOC_TRADE_LORD_MANOR','staff-quarters',[11,12],'住込みの医師・使用人は別室'),
 home('port-workers','trade','trade:workers-house','rented-room',[13,74,76],'港湾労働者・魚売り・倉庫番が通う長屋'),
 home('captain-lodging','trade','LOC_TRADE_INN','temporary-lodging',[52],'入港中の船長の滞在先'),
 home('harbor-innkeeper','trade','LOC_TRADE_INN','staff-quarters',[73],'宿酒場の居住区'),
 home('customs-tenancy','trade','trade:customs-house','rented-room',[75],'税関へ徒歩出勤'),
 home('port-herbalist','trade','LOC_TRADE_APOTHECARY','shop-house',[77],'薬草商の住居区'),
 home('carter-household','trade','trade:stable-house','household',[78],'荷馬車組合の居住区'),
 home('shipwright-tenancy','trade','trade:shipwright-house','rented-room',[79],'船大工へ通う長屋'),
 home('island-tenants','crime','LOC_CRIME_BACK_INN','rented-room',[33,49,51,81],'裏港での継続的な部屋借り'),
 home('island-arms-house','crime','LOC_CRIME_WEAPON_MARKET','shop-house',[48],'市場の住居区'),
 home('island-scribe-house','crime','LOC_CRIME_FORGER','shop-house',[50],'職住一体'),
 home('island-innkeeper','crime','LOC_CRIME_BACK_INN','staff-quarters',[80],'店主の住居区'),
 home('island-warehouse-quarters','crime','LOC_CRIME_WAREHOUSE','staff-quarters',[82],'夜間当番のため倉庫に付属する部屋'),
 home('island-horse-quarters','crime','LOC_CRIME_STABLE','staff-quarters',[83],'厩舎の付属住居'),
 home('island-watch-quarters','crime','LOC_CRIME_SLAVE_MARKET','staff-quarters',[84],'見張りの住込み部屋'),
 home('pilgrim-innkeeper','frontier','LOC_BORDER_INN','staff-quarters',[54],'宿の住込み'),
 home('souvenir-shop-house','frontier','LOC_BORDER_SOUVENIR','shop-house',[95],'土産店の住居区'),
 home('pilgrim-lodging','frontier','LOC_BORDER_INN','temporary-lodging',[98],'巡礼団の滞在'),
 home('pilgrim-stable-house','frontier','LOC_BORDER_STABLE','staff-quarters',[99],'馬屋の付属住居'),
 home('shrine-residence','frontier','LOC_BORDER_SMALL_SHRINE','household',[100],'祠に付属する生活区画'),
 home('temple-staff','temple','LOC_TEMPLE_ADMIN','staff-quarters',[53,96,97],'管理者・案内人・警備員の別室'),
 home('temple-guest','temple','LOC_TEMPLE_REST','temporary-lodging',[55],'巡礼中の滞在先'),
 home('colossus-depot','temple','LOC_TEMPLE_COLOSSUS','depot',[57],'非住民actorの格納場所。人間の家とは区別'),
 home('forest-camp','forest','LOC_FOREST_CAMP','field-camp',[29,32],'任務・探索中の別々の野営場所'),
 home('river-habitat','forest','LOC_FOREST_RIVER','habitat',[34],'生物actorの生息地。宿ではない'),
 home('young-bough-household','elf','LOC_ELF_YOUNG_HOUSE','household',[27,101],'家出していても元の家と親との所属を失わない'),
 home('young-bough-tenancy','elf','LOC_ELF_YOUNG_HOUSE','rented-room',[31],'同じ住居区の別室'),
 home('elder-household','elf','LOC_ELF_COUNCIL','household',[28],'長老庵'),
 home('grove-quarters','elf','LOC_ELF_GUEST_BOUGH','rented-room',[30,102,103,104],'里の住民の居住室。来客用と部屋IDを分ける'),
 home('fort-command-quarters','fortress','LOC_FORT_COMMAND','staff-quarters',[39],'司令部の居住区'),
 home('fort-barracks','fortress','LOC_FORT_BARRACKS','barracks',[40,41,42,90,92,93,94],'常駐兵・補給担当の兵舎。軍用宿の客とは区別'),
 home('fort-clinic-quarters','fortress','LOC_FORT_CLINIC','staff-quarters',[91],'軍医の当直住居'),
 home('forge-household','dwarf','LOC_DWARF_FORGE','shop-house',[35],'工房の居住区'),
 home('miners-tenancy','dwarf','LOC_DWARF_INN','rented-room',[36,38,86],'坑夫街の長期借室'),
 home('engineers-quarters','dwarf','LOC_DWARF_ENGINEER','staff-quarters',[37,89],'技師・救護担当の別室'),
 home('iron-innkeeper','dwarf','LOC_DWARF_INN','staff-quarters',[85],'酒場宿の居住区'),
 home('ore-shop-house','dwarf','LOC_DWARF_MARKET','shop-house',[87],'鉱石商の住居区'),
 home('beast-keeper','dwarf','LOC_DWARF_BEAST_STABLE','staff-quarters',[88],'荷駄獣舎の付属住居'),
 home('council-quarters','blackridge','LOC_BLACKRIDGE_COUNCIL','staff-quarters',[43,108],'評議会の住込み区画'),
 home('ridge-barracks','blackridge','LOC_BLACKRIDGE_BARRACKS','barracks',[44],'軍営の住居'),
 home('ridge-common-tenants','blackridge','LOC_BLACKRIDGE_COMMON_INN','rented-room',[45,106,107],'共同宿の長期借室'),
 home('exile-tenancy','blackridge','LOC_BLACKRIDGE_EXILE','sheltered-residence',[47],'亡命者区の実際の住まい'),
 home('ridge-innkeeper','blackridge','LOC_BLACKRIDGE_COMMON_INN','staff-quarters',[105],'共同宿管理者の部屋'),
 home('mito-household','blackridge','LOC_BLACKRIDGE_COMMON_INN','household',[109],'共同宿内の家族用住居。未登場の家族は生成しない'),
 home('rasha-household','blackridge','LOC_BLACKRIDGE_COMMON_INN','household',[110],'別世帯の住居。出典にないミトとの親子関係は作らない'),
];

export function addDwellings(region){
 for(const [id,regionId,name,x,z,districtId] of dwellings.filter(d=>d[1]===region.id)){
  const width=8,depth=7,height=3.8;
  const object={id,name,kind:'residence',asset:'building',position:[x,0,z+7],buildingPosition:[x,0,z],width,depth,height,
   interior:{entrance:[x,0,z+3.5],floorY:0,openFront:true},description:'住民の生活に使われている家。通りに入口がある。',districtId,placement:'authored-household'};
  region.objects.push(object);
  for(const [side,px,pz,w,d] of [['left',x-4,z,.4,7],['right',x+4,z,.4,7],['back',x,z-3.5,8,.4]])region.obstacles.push({id:`${id}:${side}`,x:px,z:pz,width:w,depth:d,height});
 }
}

export function assignResidences(regions,npcs){
 const assigned=new Set(),slots=new Map();
 for(const spec of residences){
  const region=regions.find(r=>r.id===spec.region),site=region?.objects.find(o=>o.id===spec.siteId);
  if(!site)throw new Error(`Missing residence site ${spec.id}`);
  (region.residences??=[]).push(structuredClone(spec));
  for(const id of spec.residentIds){
   const actor=npcs.find(n=>n.id===id);if(!actor||assigned.has(id)||actor.region!==region.id)throw new Error(`Invalid residence assignment ${id}`);
   assigned.add(id);const slot=slots.get(site.id)||0;slots.set(site.id,slot+1);
   const base=site.buildingPosition||site.position;
   const p=[base[0]+(slot%4-1.5)*1.2,0,base[2]+1.8-Math.floor(slot/4)*1.2];
   if(!canOccupy(region,p)||!findPath(region,site.position,p).length)throw new Error(`Unreachable room ${spec.id}/${id}`);
   actor.home=p;actor.homeFacilityId=site.id;actor.residenceId=spec.id;actor.roomId=`${spec.id}:${id}`;
   actor.residenceMode=spec.mode;actor.placement='source-workplace-authored-household';
  }
 }
 if(assigned.size!==npcs.length)throw new Error(`Residents without a home: ${npcs.filter(n=>!assigned.has(n.id)).map(n=>n.id)}`);
}
