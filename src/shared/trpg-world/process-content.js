// Source-inspired world objects and institutional files. These are bindings,
// not an ordered solution route. The process interpreter knows no T numbers.
const device=(id,eventId,sourceId,region,targetId,name,observation,magical=false)=>({id,eventId,sourceId,region,targetId,name,observation,kind:'device',magical,initial:{powered:true,integrity:40},aftermath:{closedTarget:targetId}});
const supply=(id,eventId,sourceId,region,targetId,name,observation,required)=>({id,eventId,sourceId,region,targetId,name,observation,kind:'supply',initial:{},required,resourceNames:{gold:'預り賃金',supplies:'生活物資',timber:'木材',medicine:'傷薬'},aftermath:{closedTarget:targetId}});
const inquiry=(id,eventId,sourceId,region,targetId,name,observation,order,documents)=>({id,eventId,sourceId,region,targetId,name,observation,kind:'inquiry',initial:{},order,documents:documents.map(([suffix,targetId,text])=>({id:`${id}:${suffix}`,targetId,text}))});
export const DEFAULT_PROCESSES=[
 device('pasture-gate','lost-road','T03','farm','LOC_FARM_NORTH_FENCE','壊れた退避柵','獣道と家畜の通路が重なり、開いた退避柵に引っかいた跡がある。'),
 device('pilgrim-transfer','resonance','T04','temple','LOC_TEMPLE_CORRIDOR','転移回廊の送出系','床の文字を踏むと送出環が発光する。固定具が割れ、行き先を示す針が定まらない。',true),
 {id:'lord-treatment',eventId:'harbor',sourceId:'T05',region:'trade',targetId:'NPC009',actorId:'NPC009',name:'領主の容体と薬',observation:'本人の手元の薬に沈殿があり、処方の封が破れている。',kind:'patient',initial:{treated:false,exposed:false},damagePerHour:1,aftermath:{closedTarget:'LOC_TRADE_LORD_MANOR'}},
 supply('dock-payroll','harbor','T06','trade','LOC_TRADE_PORT','港の賃金供託と配給','支払簿には未払分が残り、仕事中の配給箱も空になっている。',{gold:60,supplies:3}),
 inquiry('bond-review','roots','T07','capital','LOC_CAP_OFFICE','身柄引渡契約の審理','人を貨物として引き渡す契約が持ち込まれている。本人の同意書と運送契約は別の筆跡だ。','void-coerced-bond',[
  ['contract','LOC_CRIME_SLAVE_MARKET','契約原本にはリュシアの名があるが、署名欄は代理人が代筆している。'],
  ['register','LOC_ELF_YOUNG_HOUSE','出立の届には就労の希望と、身柄を売ることへの拒否が記されている。']]),
 inquiry('forest-passage','roots','T08','elf','LOC_ELF_COUNCIL','通行協定の審理','通行を認める条件として、身柄引渡しと河川工事の記録を提出する窓口が設けられている。','protected-passage',[
  ['river','LOC_FOREST_RIVER','水路番の測定記録では減水は吸収核付近から始まり、人間の取水口より上流で発生している。'],
  ['passage','LOC_ELF_BARRIER_STONE','旧協定の通行証は、家族の救出と治療目的の往来を認めている。']]),
 inquiry('palace-protection','crown','T11','capital','LOC_CAP_CASTLE','王城の警備審理','警備当番表の差し替えが見つかり、原本を比べるための受付が置かれている。','withdraw-falsified-guard-order',[
  ['pay','LOC_CRIME_INFO_STREET','依頼金の控えには王城の裏門当番を外す報酬が記されている。'],
  ['roster','LOC_CAP_ORPHANAGE','孤児院に預けられた配達帳には、裏門の当番表を夜に交換した人物の配送記録が残る。']]),
 inquiry('border-testimony','border','T12','fortress','LOC_FORT_COMMAND','越境報告の照合','襲撃報告と武器の払い出し記録を照合する受付がある。','suspend-disputed-offensive',[
  ['supply','LOC_FORT_SUPPLY','襲撃地点で拾われた鏃と同じ刻印の武器が、要塞内部の部隊へ払い出されている。'],
  ['watch','LOC_BLACKRIDGE_GATE','黒嶺外門の出入記録には、申告された襲撃時刻に外へ出た部隊がない。']]),
 inquiry('customs-cargo','harbor','T14','trade','LOC_TRADE_CUSTOMS','武器貨物の差止め審理','荷札と税関申告の品目が一致しない貨物が保留されている。','impound-unmanifested-arms',[
  ['bill','LOC_CRIME_WAREHOUSE','運送状には武器の箱数と、港の商会への引渡し先が記されている。'],
  ['manifest','LOC_TRADE_WAREHOUSE','同じ船の申告書では、武器箱が農具として数えられている。']]),
 device('harbor-chain','harbor','T15','trade','LOC_TRADE_SHIPYARD','港口の鎖と送出機','港口を開閉する鎖の固定具が損傷し、送出機が回り続けている。'),
 inquiry('civic-protection','crown','T16','capital','LOC_CAP_OFFICE','住民保護の審理','住民の出身を理由にした退去指示が、正規の命令なのか照会されている。','void-discriminatory-clearance',[
  ['notice','LOC_CAP_AJIN_QUARTER','貼られた退去指示書は役所の発行番号を持たず、別人の印影を写している。'],
  ['printer','LOC_CAP_NEWSPAPER','印刷台帳は退去指示の発注者と、無関係な住民へ責任を転嫁する見出しの校正指示を記録している。']]),
 device('summoning-feed','resonance','T17','capital','LOC_CAP_MAGE_TOWER','召喚系への動力供給','実験記録と送出計の値が食い違い、余った魔力が地下へ流れている。',true),
 device('colossus-feed','resonance','T18','temple','LOC_TEMPLE_COLOSSUS','格納兵器の動力輪','巨体の関節に繋がる動力輪の留め具が割れ、封印の継ぎ目が震えている。',true),
 inquiry('joint-ceasefire','border','T19','blackridge','LOC_BLACKRIDGE_COUNCIL','越境動員の審議','動員の根拠となった河川被害と召喚設備の情報について、双方の記録を集めている。','hold-cross-border-deployment',[
  ['river','LOC_FOREST_RIVER','測定値は河川の減水が兵器ではなく川中の吸収に一致することを示す。'],
  ['mage','LOC_CAP_MAGE_TOWER','宮廷の動力記録には制御不能の実験損失が記され、対外攻撃の送出命令は付いていない。']]),
];

// Dependencies are world conditions, not route selection. Institutional orders
// change access/custody policy at actual sites; they are not event victory receipts.
const byId=new Map(DEFAULT_PROCESSES.map(p=>[p.id,p]));
Object.assign(byId.get('pilgrim-transfer'),{startsAt:86400+9*3600,transfer:{destinationId:'LOC_TEMPLE_SEALED',shelterId:'LOC_TEMPLE_REST',radius:2,windupSeconds:180,charges:1,damage:20},documents:[{id:'pilgrim-transfer:receiver',targetId:'LOC_TEMPLE_ADMIN',text:'回廊の整備図では、割れた選路器の残存出力が地下封印区画の受信環へ接続されている。'}]});
Object.assign(byId.get('bond-review'),{protectedActor:'NPC027',affectedTarget:'NPC027',enforcement:{actorId:'NPC024',meetingId:'LOC_CAP_LOWER_INN',postId:'LOC_CRIME_SLAVE_MARKET',protectActorId:'NPC027',custodySiteId:'LOC_CAP_LOWER_INN',routeIds:['R06','R08'],modes:['foot','ship'],stoppedOperations:['coerced-transfer'],text:'本人の同意のない身柄引渡しを止め、拘束されている場合は本人を保護する。'}});
Object.assign(byId.get('forest-passage'),{access:{targetId:'LOC_ELF_BARRIER_STONE',closed:false}});
Object.assign(byId.get('customs-cargo'),{access:{targetId:'LOC_TRADE_WAREHOUSE',closed:true},impoundShipments:['unmanifested-arms']});
Object.assign(byId.get('civic-protection'),{reviewers:['NPC067'],access:{targetId:'LOC_CAP_AJIN_QUARTER',closed:false},restoresClaims:['quarter-clearance']});
Object.assign(byId.get('palace-protection'),{reviewers:['NPC016'],enforcement:{actorId:'NPC024',meetingId:'LOC_CAP_LOWER_INN',postId:'LOC_CAP_CASTLE',protectActorId:'NPC016',custodySiteId:'LOC_CAP_LOWER_INN',routeIds:[],modes:['foot'],stoppedOperations:['palace-assault'],text:'偽造された警備交代を撤回し、国王がいる王城の持ち場を守る。'}});
Object.assign(byId.get('border-testimony'),{reviewers:['NPC039'],enforcement:{kind:'recall',actorId:'NPC040',meetingId:'LOC_FORT_BARRACKS',postId:'LOC_BLACKRIDGE_GATE',protectActorId:'NPC107',routeIds:['R02'],modes:['foot'],stoppedOperations:['disputed-sortie'],text:'報告の不一致が確認された。越境部隊の出撃を中止し、兵舎へ帰還せよ。'}});
for(const id of ['colossus-feed','joint-ceasefire'])byId.get(id).activation={path:['events','roots','causal','forestBarrier'],value:false};
byId.get('harbor-chain').activation={any:[{path:['npcs','NPC009','hp'],op:'lte',value:0},{path:['processes','dock-payroll','failedAt'],op:'gte',value:0}]};

// Initial possessions and a commercial assignment, not a solver reward.
// The captain carries the bill and knows this sea route. Replacing the map
// changes site coordinates without changing the shipment or its legal owner.
export const DEFAULT_SHIPMENTS=[{id:'unmanifested-arms',name:'農具と申告された武器箱',ownerId:'NPC048',carrierId:'NPC052',receiverId:'NPC076',
 originId:'LOC_CRIME_WAREHOUSE',destinationId:'LOC_TRADE_WAREHOUSE',billId:'customs-cargo:bill',dispatchAt:2*86400+8*3600,routeIds:['R08'],modes:['ship'],
 manifest:[{name:'封をされた武器の包み',assetId:'weapon-crate',quantity:6}]}];

export const DEFAULT_ACTOR_OPERATIONS=[{id:'palace-assault',actorId:'NPC020',targetActorId:'NPC016',targetSiteId:'LOC_CAP_CASTLE',
 intention:'警備が薄い時刻に王城へ入り、国王を襲う依頼を引き受けた。',departAt:7*86400+12*3600,searchSeconds:4*3600,routeIds:[],modes:['foot'],weaponItemId:'EQP-W-0001',windupSeconds:60,damage:75},
 {id:'coerced-transfer',kind:'seize-person',actorId:'NPC033',targetActorId:'NPC027',targetSiteId:'LOC_ELF_YOUNG_HOUSE',holdingSiteId:'LOC_CRIME_SLAVE_MARKET',
 intention:'代筆した契約を使い、本人を探して市場へ連れ戻すつもりだ。',departAt:2*86400+8*3600,searchSeconds:24*3600,routeIds:['R08','R06','R13','R14'],modes:['foot','ship'],restraintItemId:'rope',windupSeconds:120},
 {id:'disputed-sortie',actorId:'NPC040',memberIds:['NPC041','NPC094'],assemblySiteId:'LOC_FORT_BARRACKS',requiredResources:{supplies:3},
 targetActorId:'NPC107',targetSiteId:'LOC_BLACKRIDGE_GATE',intention:'襲撃報告を根拠に、二人の兵を連れて黒嶺の門へ出撃する。',partyInstruction:'食料を受け取り、将校とともに黒嶺の外門へ向かう。',
 departAt:5*86400+9*3600,searchSeconds:8*3600,routeIds:['R02'],modes:['foot'],weaponItemId:'EQP-W-0001',windupSeconds:300,damage:30}];

// Claimants carry their notices and must meet the actual residents. These
// assertions of control do not change legal ownership or evict remote people.
export const DEFAULT_OCCUPANCY_CLAIMS=[
 {id:'orphanage-clearance',actorId:'NPC023',documentId:'orphanage:vacate-notice',facilityId:'LOC_CAP_ORPHANAGE',shelterId:'LOC_CAP_LOWER_INN',residentIds:['NPC021','NPC022','NPC071','NPC072'],departAt:6*86400+9*3600,noticeSeconds:600,routeIds:[],modes:['foot']},
 {id:'quarter-clearance',actorId:'NPC019',documentId:'quarter:counterfeit-notice',facilityId:'LOC_CAP_AJIN_QUARTER',shelterId:'LOC_CAP_LOWER_INN',residentIds:['NPC026'],departAt:6*86400+10*3600,noticeSeconds:600,routeIds:[],modes:['foot']},
];

// Machinery failures reuse the same physical exposure, shelter and maintenance
// model as fires and mine collapses. No new casualty is spawned by these bindings.
export const DEFAULT_PROCESS_STRUCTURES=[
 ['harbor-chain','collapse','LOC_TRADE_INN'],
 ['pilgrim-transfer','discharge','LOC_TEMPLE_REST'],
 ['summoning-feed','fire','LOC_CAP_LOWER_INN'],
].map(([id,kind,shelterId])=>{
 const process=byId.get(id),structureId='structure:'+id;process.structureId=structureId;
 return {id:structureId,processId:id,targetId:process.targetId,region:process.region,hazardEventId:process.eventId,shelterId,
 initial:{integrity:40,water:0,operating:true,fire:0,fuel:false,blocked:false},safe:{integrity:80,water:0,operating:false,fire:0,blocked:false},
 failure:{kind,traps:kind==='collapse',exposureRange:kind==='discharge'?0:8,effects:{integrity:0,operating:false,blocked:kind!=='discharge',fire:kind==='fire'?100:0}},
 actions:[
 {id:'extinguish',label:'燃えている機構へ水を運び、消火する',minutes:30,when:{fire:100},requirements:{items:{rope:1}},effects:{fire:0}},
 {id:'shore',label:'壊れた固定具と支持部を補修する',minutes:30,when:{fire:0},requirements:{items:{timber:2,...(process.magical?{crystal:1}:{})},skills:[process.magical?'magic':'crafting']},effects:{integrity:100}},
 {id:'clear-rubble',label:'補強した機構の周囲から残骸を取り除く',minutes:30,when:{fire:0,integrity:100,blocked:true},requirements:{items:{rope:1}},effects:{blocked:false}}]};
});
