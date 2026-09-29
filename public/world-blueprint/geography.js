/**
 * World geography – reference-traced Phase A revision (design-only).
 *
 * Everything below is ONE shared continuous geography. Terrain, streets,
 * settlement footprints and hydrology are drawn from normalized positions in
 * the supplied 1448×1086 illustrated reference, not a separate set of boxes.
 *
 * The reference is painted in perspective, so this is an INTERPRETATION of its
 * relative silhouette rather than a survey or a claim about actual GIS area.
 * 48×36 km is a provisional physical design frame; R01–R15 travel times are
 * macro baselines and are NOT lengths/speed inferred from the image.
 */
export const REFERENCE={width:1448,height:1086};
export const WORLD={widthKm:48,heightKm:36,areaKm2:1728,origin:'south-west',x:'east',y:'north',projection:'reference-normalized; provisional'};
export const fromRef=([x,y])=>[+(x*WORLD.widthKm/REFERENCE.width).toFixed(6),+((REFERENCE.height-y)*WORLD.heightKm/REFERENCE.height).toFixed(6)];
export const toRef=([x,y])=>[x*REFERENCE.width/WORLD.widthKm,REFERENCE.height-y*REFERENCE.height/WORLD.heightKm];
const coords=p=>p.map(fromRef);
export function areaOf(points){let n=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];n+=a[0]*b[1]-b[0]*a[1];}return Math.abs(n)/2;}
export function pointInPolygon([x,y],p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [xi,yi]=p[i],[xj,yj]=p[j];if((yi>y)!==(yj>y)&&x<((xj-xi)*(y-yi))/(yj-yi)+xi)inside=!inside;}return inside;}
const shape=(id,name,color,referencePoints,detail={})=>({id,name,color,points:coords(referencePoints),...detail});
export const mainland=coords([
 [0,0],[1448,0],[1448,564],[1402,598],[1347,619],[1286,626],[1234,619],
 [1169,613],[1095,599],[1033,590],[977,587],[952,600],[995,630],
 [1064,648],[1139,667],[1197,685],[1257,688],[1320,705],[1393,701],[1448,715],
 [1448,1086],[1340,1086],[1255,1066],[1184,1054],[1117,1037],[1051,1036],
 [993,1047],[920,1041],[847,1034],[783,1019],[732,996],[672,977],[606,946],
 [553,922],[514,893],[468,869],[428,838],[406,807],[403,768],[423,727],
 [407,687],[373,638],[357,586],[334,543],[311,520],[276,520],[239,532],
 [191,522],[148,508],[112,482],[103,453],[118,410],[139,376],[158,347],
 [122,320],[82,305],[39,280],[0,266]
]);
export const crimeIsland=coords([
 [52,752],[70,711],[105,685],[155,671],[196,695],[230,726],
 [243,776],[227,825],[196,861],[149,874],[108,858],[74,818]
]);
export const islets=[
 coords([[11,375],[23,349],[45,366],[42,389],[21,396]]),
 coords([[263,598],[279,580],[307,595],[315,621],[290,637],[268,623]]),
 coords([[341,692],[355,681],[380,703],[370,719]]),
 coords([[378,855],[389,836],[416,848],[409,876]]),
 coords([[170,930],[187,912],[210,932],[201,954]]),
 coords([[120,886],[131,870],[151,877],[147,901]])
];

export const terrain=[
 shape('central-plain','緑の平原・河畔耕作地','#b6ad75',[
  [264,349],[387,299],[512,309],[605,350],[681,398],[807,393],[840,455],[804,544],
  [743,617],[675,688],[560,717],[437,662],[329,606],[269,526],[255,445]
 ],{kind:'region',description:'王都・港湾への物流、穀倉と麦畑がつながる生活のある平原。'}),
 shape('western-foothills','西岸の岩場・山麓','#888b76',[
  [0,166],[85,167],[157,208],[234,216],[305,235],[357,304],[349,354],
  [299,403],[254,441],[194,444],[129,394],[75,338],[0,307]
 ],{kind:'terrain'}),
 shape('drylands','乾きの高原・黄昏の荒野','#d5b17b',[
  [632,632],[715,604],[803,609],[875,620],[957,641],[1044,647],[1123,679],
  [1199,692],[1297,700],[1448,699],[1448,1086],[661,1086],[565,944],[512,831],[552,734]
 ],{kind:'terrain',description:'神殿の外周は荒廃した巡礼地。全面を無意味な砂地として扱わない。'}),
 shape('north-range','北の山脈・雪稜','#8996a0',[
  [157,0],[1017,0],[983,76],[934,120],[896,177],[846,218],[793,238],
  [745,268],[696,250],[661,296],[605,278],[573,324],[522,301],[484,355],
  [427,337],[397,363],[351,346],[299,376],[267,336],[214,338],[192,289],
  [137,276],[165,217],[117,196]
 ],{kind:'mountains',description:'峠・採掘路・補給路が実地形に沿う山岳地帯。'}),
 shape('black-range','黒の山脈・火山高地','#514c52',[
  [865,0],[1448,0],[1448,307],[1370,315],[1330,279],[1265,267],[1204,272],
  [1151,247],[1091,243],[1031,231],[964,245],[919,207],[858,205],[821,158]
 ],{kind:'mountains',description:'黒嶺連合領は火山に囲まれた「多種族の生活する国家」。溶岩軍営だけではない。'}),
 shape('emerald-forest','翡翠の森（連続した地形）','#376c4b',[
  [694,309],[748,275],[831,245],[912,239],[984,230],[1080,245],[1180,272],
  [1278,290],[1361,315],[1425,367],[1448,401],[1448,554],[1404,596],
  [1338,611],[1264,610],[1181,592],[1097,580],[1014,562],[944,556],[876,548],
  [806,533],[768,510],[749,479],[776,428],[734,389]
 ],{kind:'biome',description:'外縁の狩人道、迷いの森、世界樹と隠れ里を含む「面」の地形。'})
];
export const forest=terrain.find(t=>t.id==='emerald-forest');

export const landUse=[
 shape('trade-port-belt','交易都市の港湾・倉庫・船大工圏','#cfb47b',[
  [59,390],[99,363],[184,352],[281,364],[342,416],[371,479],[340,532],
  [295,554],[220,558],[164,546],[91,528],[57,492]
 ],{kind:'commercial'}),
 shape('capital-exurbs','王都近郊・河岸・橋詰','#d0bb87',[
  [530,343],[596,318],[699,327],[768,355],[830,403],[830,513],
  [785,548],[699,565],[603,553],[544,506]
 ],{kind:'residential'}),
 shape('farmlands','王都南方の耕地・用水・麦畑','#c9bd6d',[
  [298,493],[390,507],[476,508],[555,521],[644,526],[731,533],
  [782,599],[741,672],[665,695],[574,696],[493,682],[407,653],[335,605]
 ],{kind:'agricultural',description:'村落の建築域と、広がる地域農地を分離する。'}),
 shape('temple-pilgrimage','古代神殿の参道・遺構外縁','#ccb68b',[
  [399,673],[475,650],[579,665],[658,702],[735,747],[720,829],[655,871],
  [565,882],[470,851],[408,803]
 ],{kind:'ruins',description:'遺跡は大きいが商業都市ではない。正式宿泊は辺境の村。'}),
 shape('blackridge-lived','黒嶺の多種族生活・市街周縁','#907468',[
  [956,80],[1042,72],[1125,72],[1222,102],[1281,142],[1271,223],
  [1209,249],[1123,243],[1033,219],[965,193]
 ],{kind:'settled',description:'市場・共同宿・評議場・水路区・亡命者区・軍営が分化する。'}),
 shape('dwarf-industrial','ドワーフ坑口と採掘外縁','#aa9374',[
  [278,207],[343,188],[416,205],[485,252],[483,322],[421,357],
  [348,352],[284,323]
 ],{kind:'workshops'}),
 shape('forest-edge-use','森の外縁利用域','#709366',[
  [742,431],[794,406],[845,425],[893,479],[860,536],[782,531],[748,492]
 ],{kind:'managed',description:'狩人小屋・野営地・馬留めなど。森全域が人間の管理地という意味ではない。'})
];

const footprint=(id,name,type,refCenter,outlineRef,activityRef,description,districts=[])=>{
 const points=coords(outlineRef),activity=coords(activityRef);
 return {id,name,type,center:fromRef(refCenter),refCenter,points,activity,
 areaKm2:areaOf(points),activityKm2:areaOf(activity),description,
 districts:districts.map(d=>({id:d[0],name:d[1],points:coords(d[2]),color:d[3]}))};
};
export const settlements=[
 footprint('capital','王都','royal-city',[674,431],
  [[587,407],[618,367],[666,350],[705,346],[755,366],[784,402],[792,453],[774,481],[733,507],[676,511],[624,496],[591,465]],
  [[526,351],[611,316],[705,315],[797,346],[842,405],[832,505],[785,547],[681,560],[578,527],[527,461]],
  '王城、貴族街、中央市場、下層、役所、魔術塔、孤児院、亜人街を持つ城郭都市。',[
   ['castle','王城',[[663,380],[687,357],[719,376],[725,408],[703,428],[676,424]],'#e9cf96'],
   ['noble','貴族街',[[635,374],[660,359],[669,421],[630,439],[604,413]],'#e1d4b3'],
   ['market','中央市場',[[618,430],[666,428],[674,469],[628,469],[599,452]],'#d5a76d'],
   ['administration','役所・魔術塔',[[725,379],[764,392],[779,437],[741,450],[720,419]],'#a9b8b7'],
   ['lower','下層・亜人街',[[668,463],[737,455],[766,482],[732,499],[683,499]],'#bc987a']
  ]),
 footprint('trade','交易都市','harbour-city',[213,451],
  [[108,424],[134,390],[184,367],[240,366],[291,392],[316,432],[318,474],[282,513],[220,529],[156,514],[115,486]],
  [[62,380],[104,352],[184,342],[275,356],[352,409],[365,485],[335,544],[250,557],[151,542],[68,513]],
  '大型港湾、魚市場、商館街、税関・倉庫、領主館、船宿、船大工通り。',[
   ['harbor','大港湾・埠頭',[[86,449],[132,435],[178,460],[186,504],[134,525],[90,495]],'#a77c53'],
   ['warehouse','倉庫・税関',[[139,414],[185,394],[209,438],[184,464],[131,447]],'#ad8b62'],
   ['market','魚市場・商人街',[[183,390],[244,374],[272,413],[254,467],[195,452]],'#d5b27c'],
   ['manor','領主館・商館',[[246,392],[292,413],[307,450],[258,457]],'#9eacb0'],
   ['shipyard','船大工・裏荷役',[[184,473],[249,477],[280,507],[215,517]],'#be986a']
  ]),
 footprint('blackridge','黒嶺連合領','multi-species-capital',[1104,164],
  [[1003,147],[1032,104],[1083,86],[1139,96],[1192,119],[1234,153],[1224,195],[1177,230],[1114,236],[1052,214],[1009,185]],
  [[950,80],[1041,68],[1149,72],[1241,104],[1280,148],[1268,233],[1212,257],[1107,252],[1005,224],[951,185]],
  '王国側呼称「魔王領」。多種族市場、共同宿、連合評議場、水路区、亡命者区、軍営などの生活を持つ独立国家。',[
   ['council','連合評議場',[[1094,108],[1133,104],[1159,130],[1143,157],[1110,150]],'#c8a78b'],
   ['market','多種族市場・共同宿',[[1037,149],[1089,128],[1114,156],[1083,195],[1033,186]],'#a99a80'],
   ['water','水路区',[[1120,171],[1170,162],[1207,181],[1170,210],[1126,208]],'#6f9398'],
   ['refuge','亡命者区',[[1070,195],[1117,203],[1160,226],[1104,228],[1055,212]],'#9c8e82'],
   ['military','黒嶺軍営・門',[[1185,119],[1217,148],[1203,178],[1164,165]],'#685e5d']
  ]),
 footprint('crime','犯罪都市','island-city',[154,775],
  [[92,753],[118,714],[163,706],[197,724],[219,765],[211,808],[170,840],[120,827],[95,795]],
  [[52,752],[70,711],[105,685],[155,671],[196,695],[230,726],[243,776],[227,825],[196,861],[149,874],[108,858],[74,818]],
  '闇港、裏酒場、密輸倉庫、情報街、偽造屋、裏厩舎が絡み合う海上犯罪都市。'),
 footprint('fortress','北陵要塞','military-fort',[586,139],
  [[532,124],[556,91],[594,80],[624,108],[635,144],[613,172],[566,176],[532,154]],
  [[483,107],[549,57],[626,62],[665,119],[649,184],[590,212],[514,186]],
  '軍事拠点。司令部、城壁、兵舎、補給倉庫、厩舎、廃街道監視所。'),
 footprint('dwarf','ドワーフ洞窟','underground-city-entrance',[363,275],
  [[306,258],[316,226],[347,213],[381,222],[423,249],[431,277],[405,304],[359,313],[322,295]],
  [[264,214],[311,181],[389,180],[463,217],[490,273],[450,342],[363,355],[290,319]],
  '地表は坑口と工房、地下には工房街・酒場宿・採掘坑道・深部坑道が続く。地下床面積は別算。'),
 footprint('farm','田園の村','rural-village',[578,610],
  [[541,580],[558,559],[584,557],[614,581],[625,615],[600,641],[563,639],[540,619]],
  [[504,548],[546,528],[611,532],[646,565],[660,632],[635,673],[574,683],[513,657]],
  '麦畑、共同穀倉、麦穂亭、パン屋、井戸、村長宅、北柵、農具修理屋などが近接する。'),
 footprint('temple','古代神殿','ruins-not-city',[566,766],
  [[446,721],[473,686],[524,675],[589,681],[652,696],[687,729],[692,784],[661,826],[586,846],[520,826],[463,797]],
  [[399,670],[467,650],[584,650],[692,687],[749,746],[728,837],[644,888],[528,874],[419,821]],
  '荒野の巨大遺跡。正門、管理棟、白石回廊、地下封印区画、巨神兵格納区。商業性は低い。'),
 footprint('frontier','辺境の村','pilgrim-hamlet',[594,917],
  [[565,894],[583,881],[615,894],[629,920],[610,941],[576,938],[562,919]],
  [[536,870],[586,852],[647,868],[667,923],[630,972],[557,967]],
  '古代神殿への巡礼宿・土産物屋・馬屋・畑が支える小村。軍事前線ではない。'),
 footprint('elf','エルフの隠れ里','hidden-worldtree-settlement',[1283,424],
  [[1222,414],[1245,380],[1284,369],[1320,390],[1352,425],[1330,454],[1291,465],[1251,452]],
  [[1180,377],[1235,342],[1307,330],[1381,369],[1413,424],[1380,482],[1283,504],[1201,464]],
  '世界樹と結界石、長老庵・若枝の住居区・薬草園・樹上客間。人間向け宿や一般市場はない。')
];
export const places=[...settlements,{
 id:'forest',name:'森（地形）',type:'terrain',center:fromRef([1019,472]),
 areaKm2:areaOf(forest.points),points:forest.points,
 description:'王都から外縁森は通常到達可能。森奥は世界樹の迷いによって通行条件が変わる。'
}];

export const waterways=[
 {id:'royal-river',name:'北山の大河・王都本流',visualWidthPx:17,widthMeters:[55,185],
  path:coords([[836,214],[795,258],[758,298],[711,330],[691,355],[728,384],[761,414],[764,453],[745,489],[710,523],[678,551],[699,571],[774,565],[842,551],[905,568],[970,589],[1041,608],[1113,626],[1200,631],[1300,619],[1374,616],[1446,604]])},
 {id:'capital-fork',name:'王都西水道',visualWidthPx:10,widthMeters:[25,90],
  path:coords([[710,329],[668,364],[631,397],[598,434],[597,475],[634,507],[680,545]])},
 {id:'mountain-feeder',name:'山間の支流',visualWidthPx:9,widthMeters:[18,80],
  path:coords([[947,215],[916,247],[865,286],[845,335],[837,384],[799,410],[765,453]])},
 {id:'forest-feeder',name:'翡翠の森の支流',visualWidthPx:9,widthMeters:[20,100],
  path:coords([[1189,296],[1150,335],[1127,377],[1087,424],[1079,476],[1030,521],[982,565],[970,589]])},
 {id:'elf-cascade',name:'世界樹の滝と森海への流れ',visualWidthPx:11,widthMeters:[12,95],
  path:coords([[1343,349],[1327,390],[1311,439],[1292,477],[1282,519],[1266,566],[1300,614],[1356,625],[1438,607]])},
 {id:'farm-canals',name:'田園の用水路',visualWidthPx:5,widthMeters:[3,16],
  path:coords([[680,545],[631,552],[600,577],[569,619],[589,659],[617,687]])}
];

export const routes=[
 {id:'R01',from:'dwarf',to:'fortress',hours:2,type:'mountain-road',notes:'峠と山腹を選んで上る。',path:coords([[363,275],[418,233],[469,195],[524,164],[586,139]])},
 {id:'R02',from:'fortress',to:'blackridge',hours:6,type:'ruined-dangerous',notes:'廃れた街道。山稜を迂回し危険な斜面を通る。',path:coords([[586,139],[672,117],[748,126],[847,148],[954,162],[1044,175],[1104,164]])},
 {id:'R03',from:'trade',to:'fortress',hours:6,type:'mountain-road',notes:'沿岸から谷筋を通って山へ。',path:coords([[213,451],[269,401],[339,345],[393,286],[452,233],[525,174],[586,139]])},
 {id:'R04',from:'trade',to:'dwarf',hours:4,type:'mine-road',notes:'山麓の鉱山・荷駄獣用の道。',path:coords([[213,451],[260,416],[289,379],[310,345],[348,316],[363,275]])},
 {id:'R05',from:'dwarf',to:'blackridge',hours:6,type:'hidden-tunnel',notes:'地下の危険ルート。地上を真っすぐ横断する道ではない。',path:coords([[363,275],[450,278],[578,256],[722,248],[879,224],[1015,207],[1104,164]])},
 {id:'R06',from:'trade',to:'capital',hours:2,type:'main-road',notes:'河川を橋で渡り、農地・集落を経由する主要街道。',path:coords([[213,451],[289,465],[368,459],[435,450],[493,443],[549,465],[584,487],[633,482],[674,431]])},
 {id:'R07',from:'trade',to:'temple',hours:5,type:'wilderness-road',notes:'海食崖を避け、乾燥した高原を巡る街道。',path:coords([[213,451],[273,496],[323,545],[369,600],[399,649],[459,692],[512,726],[566,766]])},
 {id:'R08',from:'trade',to:'crime',hours:3,type:'sea',notes:'船。交易港・闇港と海況・航行許可が必要。',path:coords([[213,451],[158,510],[120,587],[107,654],[127,720],[154,775]])},
 {id:'R09',from:'temple',to:'frontier',hours:.5,type:'pilgrim',notes:'神殿観光・巡礼者が歩く参道。',path:coords([[566,766],[582,810],[596,861],[594,917]])},
 {id:'R10',from:'farm',to:'temple',hours:3,type:'wilderness-road',notes:'用水路と耕地の縁から荒野道へ。',path:coords([[578,610],[595,657],[608,700],[585,740],[566,766]])},
 {id:'R11',from:'capital',to:'temple',hours:4,type:'road',notes:'南橋を渡って丘を迂回する神殿方面の街道。',path:coords([[674,431],[736,495],[773,565],[788,621],[750,681],[681,721],[616,742],[566,766]])},
 {id:'R12',from:'capital',to:'farm',hours:1,type:'farmland-road',notes:'農村の畦・用水・柵に沿う生活道。',path:coords([[674,431],[659,503],[637,548],[605,577],[578,610]])},
 {id:'R13',from:'capital',to:'forest',hours:6,type:'forest-road',notes:'森外縁へ向かい、渡河地点・狩人道を使う。',path:coords([[674,431],[761,449],[819,454],[865,443],[926,457],[1019,472]])},
 {id:'R14',from:'forest',to:'elf',hours:1/6,type:'maze-conditional',notes:'10分〜∞。案内・承認・迷わない術なしでは到達不可。描画長と到達時間は一致しない。',path:coords([[1019,472],[1098,467],[1177,449],[1229,431],[1283,424]])},
 {id:'R15',from:'forest',to:'blackridge',hours:5,type:'guided-conditional',notes:'森奥の案内を要する山裾ルート。世界樹倒壊で条件と危険が変わる。',path:coords([[1019,472],[1056,407],[1080,336],[1101,267],[1094,215],[1104,164]])}
];
export const alternatePaths=[
 {id:'royal-shallow-ford',name:'大河の浅瀬（危険な近道）',kind:'risky-ford',notes:'増水で渡河不可。橋の迂回路とは異なる。',path:coords([[213,451],[361,428],[480,410],[567,406],[674,431]])},
 {id:'north-hunter-trail',name:'北柵の獣道',kind:'monster-trail',notes:'赤牙狼等の縄張りと交差し得る。街道ではない。',path:coords([[578,610],[554,570],[531,544],[510,515],[500,477],[520,436]])},
 {id:'forest-hunter-trail',name:'森の外縁の狩人道',kind:'hunting-trail',notes:'狩人小屋・野営地・馬留めの生活導線。',path:coords([[845,533],[866,507],[890,477],[926,457],[950,428]])}
];
export const hazards=[
 shape('north-wolves','北柵・赤牙狼の生息範囲','#98674b',[[484,473],[536,456],[571,493],[569,547],[540,574],[491,550]],{kind:'habitat',description:'T03の魔物が縄張り・痕跡を残す想定。単純なrandom spawnの印ではない。'}),
 shape('north-pass','険しい雪山の尾根','#737884',[[430,115],[516,82],[601,91],[637,147],[597,224],[529,203],[461,171]],{kind:'terrain-risk',description:'街道が迂回する理由。山を最短線で貫通させない。'}),
 shape('east-floodplain','森海沿いの増水・湿地','#608d84',[[1053,565],[1149,561],[1249,581],[1358,585],[1438,579],[1440,642],[1291,657],[1182,642]],{kind:'seasonal',description:'河川増水や橋の利用条件が変わる。'}),
 shape('maze','世界樹に守られた迷いの森奥','#49735a',[[1045,345],[1154,326],[1263,350],[1346,401],[1316,491],[1200,510],[1094,464]],{kind:'conditional',description:'承認・案内・迷わない術がなければ到達できず森へ戻される。'})
];

export const serviceSites=[
 ['trade-fish','魚市場・船大工通り',[157,491],'trade','trade'],
 ['royal-office','王都の市場・役所通り',[614,456],'capital','capital'],
 ['granary','共同穀倉・パン屋',[549,594],'farm','farm'],
 ['farm-well','村井戸と北柵',[569,566],'farm','farm'],
 ['dwarf-workshops','名工工房と鉱石市場',[358,300],'dwarf','dwarf'],
 ['temple-pilgrims','神殿案内所・休憩所',[493,776],'temple','temple'],
 ['border-inn','巡礼宿・土産物屋',[581,924],'frontier','frontier'],
 ['forest-camp','狩人の野営地',[868,506],'forest','forest'],
 ['elf-worldtree','世界樹と結界石',[1279,386],'elf','elf'],
 ['fort-supply','軍用補給庫・検問',[575,141],'fortress','fortress'],
 ['ridge-council','連合評議場と共同市場',[1096,151],'blackridge','blackridge'],
 ['crime-dock','闇港と裏通り',[127,792],'crime','crime']
].map(([id,name,refPoint,context,place])=>({id,name,point:fromRef(refPoint),context,place}));
export const coast={mainlandAreaKm2:areaOf(mainland),islandAreaKm2:areaOf(crimeIsland),isletAreaKm2:islets.reduce((n,p)=>n+areaOf(p),0)};
export const landAreaKm2=coast.mainlandAreaKm2+coast.islandAreaKm2+coast.isletAreaKm2;
export const seaAreaKm2=WORLD.areaKm2-landAreaKm2;
export function exportBlueprint(){
 return {version:'2026-09-30-reference-rebuild',status:'PROPOSED; independent from live 3D runtime',
  world:WORLD,reference:REFERENCE,mainland,crimeIsland,islets,terrain,landUse,settlements,places,
  waterways,routes,alternatePaths,hazards,serviceSites,coast,landAreaKm2,seaAreaKm2,
  areaNote:'Measured as planar polygon footprints from the reference-traced design, not authoritative spreadsheet figures. Perspective illustration may exaggerate scale.',
  travelNote:'R01–R15 are provisional macro adjacency/time constraints. Road geometry can detour around mountains, floodwater and habitats. Off-road travel remains possible.'};
}
