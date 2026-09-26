import {canOccupy,findPath} from '../../src/shared/trpg-world/navigation.js';
// Semantic travel corridors. Coordinates below are replaceable graybox geometry;
// route and site IDs, not these points, are the persistent itinerary vocabulary.
export const corridors = {
 R01:{terrain:'雪解けの鞍部',road:'military-road',landmarks:['石切場','鞍部の烽火台'],stop:'鉱夫の風除け',habitat:'岩羊・北方獣',traffic:'鉱夫・補給兵',cargo:'鉱石・武具',horse:'山道用の荷獣',carriage:false,broom:'横風と峰の遮蔽',water:false},
 R02:{terrain:'旧戦場と荒れた峠',road:'abandoned-road',landmarks:['崩れた関門','停戦碑'],stop:'旧監視所',habitat:'荒野の捕食獣',traffic:'斥候・部隊・使節',cargo:'食料・軍需',horse:'旧石道のみ',carriage:false,broom:'軍の監視域',water:false},
 R03:{terrain:'北方の丘陵と河谷',road:'supply-road',landmarks:['雪線','補給橋'],stop:'荷車の中継宿',habitat:'谷の野獣',traffic:'補給商・兵士',cargo:'食料・薬・木材',horse:'適',carriage:true,broom:'峠の天候',water:false},
 R04:{terrain:'鉱山斜面',road:'mine-road',landmarks:['鉱滓斜面','折返し道'],stop:'荷駄の水場',habitat:'岩場の獣',traffic:'鉱夫・職人',cargo:'鉱石・工具',horse:'荷駄向き',carriage:false,broom:'崖風',water:false},
 R05:{terrain:'古代地下坑道',road:'tunnel',landmarks:['通風縦坑','地下分水路'],stop:'坑道避難所',habitat:'地下生物',traffic:'坑夫・案内人',cargo:'金属・密輸物',horse:'不可',carriage:false,broom:'飛行不可',water:false},
 R06:{terrain:'海岸段丘から王都の河岸',road:'highway',landmarks:['塩荷の分岐','石橋'],stop:'街道宿',habitat:'畑の小害獣',traffic:'行商・使者・荷車',cargo:'魚・塩・穀物',horse:'適',carriage:true,broom:'着陸は城外',water:false},
 R07:{terrain:'乾いた谷と遺跡の台地',road:'wilderness-road',landmarks:['枯れ川','石柱群'],stop:'隊商の井戸',habitat:'荒野の獣',traffic:'隊商・巡礼者',cargo:'水・布・神殿資材',horse:'給水が必要',carriage:true,broom:'砂塵',water:false},
 R08:{terrain:'岩島と西海の航路',road:'sea-lane',landmarks:['防波堤','岩礁灯台'],stop:'沿岸の泊地',habitat:'海鳥・海獣',traffic:'船員・旅客',cargo:'武器・輸入品・人員',horse:'船積みが必要',carriage:false,broom:'荒天・海上の離着陸不可',water:true},
 R09:{terrain:'乾いた畑から白石の参道',road:'pilgrim-path',landmarks:['小祠','神殿を望む曲がり角'],stop:'巡礼者の休み石',habitat:'小動物',traffic:'巡礼者・案内人',cargo:'水・食料・供物',horse:'馬繋ぎ場まで',carriage:true,broom:'聖域の着陸制約',water:false},
 R10:{terrain:'麦畑から荒野への境',road:'farm-road',landmarks:['最後の用水路','見張り丘'],stop:'農家の軒先',habitat:'野犬・草地の獣',traffic:'農民・巡礼者',cargo:'穀物・縄・木材',horse:'適',carriage:true,broom:'地上の井戸・人との接触を失う',water:false},
 R11:{terrain:'旧王国の巡礼街道',road:'stone-road',landmarks:['王国里程標','遺跡の稜線'],stop:'巡礼宿場',habitat:'荒野の獣',traffic:'役人・巡礼者・研究者',cargo:'文書・神殿資材',horse:'適',carriage:true,broom:'王都の飛行制約',water:false},
 R12:{terrain:'用水路・麦畑・王都の前庭',road:'market-road',landmarks:['小橋','並木の切れ目','城門の前庭'],stop:'農産物の荷改め場',habitat:'畑ネズミ・野犬',traffic:'農民・行商・通勤者',cargo:'パン・穀物・飼葉',horse:'適',carriage:true,broom:'城外で降りる',water:false,alternate:'堤沿いの徒歩道'},
 R13:{terrain:'河岸の林から深い森',road:'forest-road',landmarks:['炭焼き跡','川の渡し','森の道標'],stop:'狩人の休み場',habitat:'苔狼・蜘蛛・川の粘体',traffic:'狩人・斥候・旅人',cargo:'薬草・木材・獣皮',horse:'馬留めまで',carriage:false,broom:'樹冠・川霧、地上の痕跡を見落とす',water:false,alternate:'狩人の獣道'},
 R14:{terrain:'精霊の森と根道',road:'hidden-path',landmarks:['結界石','世界樹の根'],stop:'根の庇',habitat:'森の精霊域',traffic:'承認客・エルフ',cargo:'薬草・生活物資',horse:'不可',carriage:false,broom:'結界は空からも迂回不可',water:false},
 R15:{terrain:'森奥の河谷から黒嶺',road:'forest-pass',landmarks:['源流の分岐','黒い稜線'],stop:'河谷の野営地',habitat:'移動する大型獣',traffic:'案内人・密使・避難民',cargo:'薬・水路資材',horse:'案内と地形制約',carriage:false,broom:'霧と峠風、案内条件は残る',water:false},
};

// Land-use loops precede service spurs. Every junction is explicit and reusable
// by the renderer and the NPC street navigator; no facility-to-facility MST.
export const streetPlans = {
 farm:[['field-edge',2.4,[[-8,-16],[-22,-13],[-30,4],[-30,14],[-15,8],[0,8]]],['pasture-lane',2.8,[[0,8],[20,8],[27,15],[43,16],[50,2],[46,-16],[22,-16],[-8,-16]]]],
 capital:[['market-street',4,[[0,8],[-16,8],[-25,0],[-48,0],[-56,-16],[-56,-38],[-43,-39],[-10,-39],[16,-48]]],['river-street',4,[[16,-8],[45,-8],[48,8],[38,13],[16,17],[0,35]]],['lower-alley',1.8,[[-48,0],[-57,17],[-57,39],[-48,42],[-28,38],[-16,35],[0,35]]]],
 forest:[['hunter-trail',1.8,[[-16,17],[-26,7],[-47,0],[-54,-16],[-51,-39],[-29,-42],[-16,-24],[0,-15],[19,8]]],['river-bank',2.1,[[36,8],[43,18],[53,23],[53,48],[38,52],[30,35],[36,8]]]],
 trade:[['quay-road',4,[[-47,0],[-40,9],[-38,27],[-20,33],[0,25],[12,15]]],['warehouse-lane',2.2,[[-47,0],[-49,-22],[-49,-33],[-30,-30],[-6,-27],[0,8]]]],
 crime:[['dock-street',3,[[49,0],[49,13],[37,18],[25,13]]],['warehouse-alley',1.7,[[25,13],[7,22],[-9,18],[-19,5],[-48,3],[-52,21],[-46,40],[-34,38],[-10,43]]]],
};

export function authorCorridors(routes){
 for(const route of routes){const plan=corridors[route.id];if(!plan)throw new Error(`Missing corridor ${route.id}`);
  route.spatial={id:`corridor:${route.id}`, ...plan, baseline:{mode:plan.water?'ship':'foot',weather:'clear',minutes:route.sourceMinutes},
   sections:[{id:`${route.id}:departure`,kind:'approach',share:.15},{id:`${route.id}:reach`,kind:plan.road,share:.7},{id:`${route.id}:arrival`,kind:'approach',share:.15}]};
 }
}

export function authorHabitats(regions){
 const specs=[
  ['farm','field-margin','LOC_FARM_FIELD',['MON-0001','MON-0002','MON-0003'],[[-12,-8],[-7,4],[4,8]],[[5,10],[16,20]]],
  ['forest','wet-bank','LOC_FOREST_RIVER',['MON-0008'],[[-7,-14],[-5,-7],[-2,0]],[[0,24]]],
  ['forest','moss-den','LOC_FOREST_MONSTER_NEST',['MON-0009','MON-0010'],[[-10,0],[0,9],[10,3]],[[0,6],[18,24]]],
 ];
 for(const [regionId,id,siteId,templateIds,offsets,activeHours] of specs){
  const region=regions.find(r=>r.id===regionId),site=region.objects.find(o=>o.id===siteId);
  const resolve=([x,z])=>{
   const p=[site.position[0]+x,0,site.position[2]+z];
   for(let radius=0;radius<=6;radius++)for(let i=0;i<8;i++){
    const point=[p[0]+Math.cos(i*Math.PI/4)*radius,0,p[2]+Math.sin(i*Math.PI/4)*radius];
    if(canOccupy(region,point)&&findPath(region,site.position,point).length)return point;
   }
   throw new Error(`Unreachable habitat ${id}`);
  };
  const [nest,food,water]=offsets.map(resolve);
  (region.habitats??=[]).push({id:`habitat:${regionId}:${id}`,siteId,templateIds,nest,food,water,activeHours,
   provenance:{sheet:'地域別エンカウント',rows:regionId==='farm'?'5:6':'12:14'},populationPolicy:'persistent-residents'});
 }
}
