/** Capital vertical slice. World coordinates are kilometres, SW origin; geometry is a proposal.
 * Canonical IDs and PDF anchors are preserved. No terrain/atlas source is rewritten.
 */
import { WORLD, settlements, waterways, routes, areaOf, pointInPolygon as inside } from '../world-blueprint/geography.js';

export const ORIGIN = [22.35, 21.45];
export const toLocal = ([x,y]) => [(x-ORIGIN[0])*1000, -(y-ORIGIN[1])*1000];
export const fromLocal = ([x,z]) => [ORIGIN[0]+x/1000, ORIGIN[1]-z/1000];
export const pointInPolygon = inside;
export const polygonArea = areaOf;
export const distance = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1])*1000;
export function nearestOnSegment(p,a,b) {
 const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
 return [a[0]+dx*t,a[1]+dy*t];
}
export function distanceToLine(p,line) { let best=Infinity;for(let i=1;i<line.length;i++)best=Math.min(best,distance(p,nearestOnSegment(p,line[i-1],line[i])));return best; }
const corePolygon=[[21.160,21.263],[21.322,20.615],[21.849,20.170],[22.618,20.049],[23.346,20.332],[23.832,20.858],[23.954,21.546],[23.792,22.275],[23.346,22.801],[22.658,23.004],[21.889,22.882],[21.363,22.356],[21.120,21.749]];
const atlas=settlements.find(s=>s.id==='capital');
// Activity envelope is NOT a scaled copy of the walls. It follows the four macro-road approaches,
// river/quay labour, southern produce yards and northern administrative/castle hinterland.
const envelopePolygon=[[19.818,21.184],[20.239,19.870],[21.133,18.976],[22.132,18.607],[23.236,18.818],[24.078,19.291],[24.919,20.133],[25.235,21.079],[24.972,22.026],[24.393,22.867],[23.604,23.761],[22.658,24.130],[21.448,23.867],[20.502,23.288],[19.870,22.236]];
const core={polygon:corePolygon,areaKm2:areaOf(corePolygon),targetAreaKm2:6.5};
const activityEnvelope={polygon:envelopePolygon,areaKm2:areaOf(envelopePolygon),targetAreaKm2:22,designLogic:'門外街道・河岸物流・郊外農地・行政/王城背面の生活圏に沿う非相似形'};
function projectGate(id,name,originalPosition) {
 let projection,wallIndex,min=Infinity;corePolygon.forEach((a,i)=>{const p=nearestOnSegment(originalPosition,a,corePolygon[(i+1)%corePolygon.length]),d=distance(originalPosition,p);if(d<min){min=d;projection=p;wallIndex=i;}});
 return {id,nodeId:id,name,position:projection,originalPosition,shiftM:min,wallIndex,widthM:18,reason:'PDF候補を同じcore外周へ最小距離投影し、城壁と開口を一致させる。'};
}
const gates=[projectGate('west_gate','西門・交易街道口',[21.16,21.55]),projectGate('south_gate','南門・田園／神殿街道口',[22.35,20.05]),projectGate('east_gate','東門・森街道口',[23.94,21.55])];
const walls=[];
corePolygon.forEach((a,i)=>{const b=corePolygon[(i+1)%corePolygon.length],gate=gates.find(g=>g.wallIndex===i);if(!gate){walls.push({id:`wall_${i}`,points:[a,b],widthM:4,heightM:15});return;}const len=distance(a,b),u=[(b[0]-a[0])/len,(b[1]-a[1])/len],half=gate.widthM/2;walls.push({id:`wall_${i}a`,points:[a,[gate.position[0]-u[0]*half,gate.position[1]-u[1]*half]],widthM:4,heightM:15},{id:`wall_${i}b`,points:[[gate.position[0]+u[0]*half,gate.position[1]+u[1]*half],b],widthM:4,heightM:15});});

const districts=[
 {id:'castle',name:'王城高台',polygon:[[22.43,22.03],[23.05,22.03],[23.40,22.66],[22.67,22.96],[22.37,22.65]],color:'#d7cbb0',ground:'切石・儀礼路',streetWidthM:22,heightRangeM:[18,38],density:.27,npcJobs:['衛兵','宮廷役人'],gateTag:'royal',risk:'許可による入域・平時D0',identity:'北の高台。儀礼軸と軍務迂回路。王城は地盤約90m＋高塔。'},
 {id:'noble',name:'貴族街',polygon:[[21.40,21.95],[22.34,21.94],[22.44,22.66],[21.91,22.80],[21.47,22.37]],color:'#ccc8a9',ground:'石畳・庭園',streetWidthM:18,heightRangeM:[12,21],density:.38,npcJobs:['貴族','庭師','従者'],gateTag:'noble',risk:'身分・服装・紹介',identity:'広い曲線路と塀、静かな植栽。城の西斜面。'},
 {id:'mage',name:'宮廷魔術塔周辺',polygon:[[23.06,21.96],[23.75,21.98],[23.73,22.33],[23.36,22.73],[23.17,22.65]],color:'#aaaec5',ground:'幾何学石舗装',streetWidthM:14,heightRangeM:[14,26],density:.35,npcJobs:['研究者','警備'],gateTag:'mage',risk:'T17発生時の封鎖と調査',identity:'王城とは東へ離れた垂直ランドマーク。'},
 {id:'administration',name:'行政区',polygon:[[22.75,21.30],[23.77,21.31],[23.84,21.86],[23.64,21.96],[22.82,21.94]],color:'#b0bbb8',ground:'整った敷石',streetWidthM:18,heightRangeM:[13,22],density:.58,npcJobs:['役人','衛兵','瓦版売り'],risk:'平時D0／捜査時D1',identity:'役所前庭、文書運搬、王城へ上る公務路。'},
 {id:'market',name:'中央市場・商業街',polygon:[[21.88,21.15],[22.76,21.16],[22.82,21.95],[21.91,21.94]],color:'#d5ae73',ground:'石畳・露店舗装',streetWidthM:20,heightRangeM:[10,20],density:.65,npcJobs:['商人','職人','宿泊客'],risk:'D0・休息と情報',identity:'大通りの交差と約180mの開けた広場、荷車道と買物路。'},
 {id:'west',name:'西門・駅馬車街',polygon:[[21.19,21.19],[21.87,21.17],[21.90,21.94],[21.28,21.95]],color:'#bda681',ground:'締め固め土・石の轍',streetWidthM:16,heightRangeM:[9,17],density:.56,npcJobs:['御者','荷運び','宿泊客'],risk:'D0・出入りの安全拠点',identity:'18mの門→壁内の細い通路→駅馬車庭の解放。'},
 {id:'lower',name:'下層・生活路',polygon:[[21.39,20.64],[21.88,20.26],[22.71,20.20],[22.90,20.45],[22.69,20.96],[21.43,21.03]],color:'#a88d78',ground:'土道・古い石畳',streetWidthM:6,heightRangeM:[8,17],density:.83,npcJobs:['荷運び','職人','孤児院関係者'],risk:'昼D0／夜D1・事件時変動',identity:'狭い生活路、小庭、孤児院と安宿の安全点。'},
 {id:'ajin',name:'亜人街',polygon:[[22.83,20.39],[23.31,20.43],[23.72,20.89],[23.46,20.91],[22.77,20.99]],color:'#ba9d82',ground:'混在舗装・共有庭',streetWidthM:10,heightRangeM:[9,19],density:.73,npcJobs:['亜人住民','商人','職人'],risk:'平時D0／T16避難・情報保全',identity:'東門・市場・下層へ別々に接続する住居と仕事の街。'},
 {id:'quay',name:'河岸・瓦版屋通り',polygon:[[21.24,21.02],[22.69,20.93],[23.68,20.86],[23.76,21.24],[22.66,21.28],[21.25,21.31]],color:'#92a8a4',ground:'荷役敷石・河岸段差',streetWidthM:8,heightRangeM:[8,15],density:.53,npcJobs:['荷運び','船員','瓦版売り'],risk:'雨D1／増水D2・迂回',identity:'約16mの水路と低橋・高橋。倉庫から市場への短距離物流。'},
];

const nodes=[];const edges=[];
function node(id,name,position,district,kind='junction'){const n={id,name,position,district,kind};nodes.push(n);return n;}
const N=id=>nodes.find(n=>n.id===id);
gates.forEach(g=>node(g.id,g.name,g.position,g.id==='west_gate'?'west':g.id==='south_gate'?'lower':'administration','gate'));
[
 ['market','中央市場',[22.35,21.45],'market','plaza'],['castle','王城',[22.70,22.55],'castle','facility'],['mage_tower','宮廷魔術塔',[23.25,22.35],'mage','facility'],['noble_square','貴族街',[22.05,22.20],'noble','plaza'],
 ['office','王都役所・土地課',[23.08,21.58],'administration','facility'],['orphanage','白鈴孤児院',[21.65,20.75],'lower','facility'],['ajin','亜人街',[23.10,20.72],'ajin','plaza'],['inn','下層の安宿',[22.55,20.47],'lower','facility'],['newspaper','瓦版屋通り',[22.85,21.18],'quay','facility'],['stable','王都駅馬車場',[21.42,21.50],'west','facility'],
 ['west_inside','西門内の折れ道',[21.22,21.54],'west'],['coach_court','駅馬車の転回庭',[21.57,21.47],'west','plaza'],['west_cross','職人横丁の交差',[21.86,21.47],'west'],['market_west','市場西の荷解き場',[22.10,21.45],'market'],['west_upper','北側の生活通り',[21.58,21.74],'west'],['north_market','市場北の職人通り',[22.13,21.74],'market'],
 ['west_quay','西河岸の倉庫前',[21.52,21.30],'quay'],['lower_west','下層西の共同庭',[21.53,20.86],'lower'],['lower_court','下層の共同井戸',[21.98,20.73],'lower','plaza'],['lower_south','安宿西の生活路',[22.25,20.51],'lower'],['south_inside','南門内の屈曲路',[22.34,20.18],'lower'],['south_cross','農産荷車の分岐',[22.28,20.64],'lower'],['south_quay','南橋たもとの荷揚場',[22.275,20.94],'quay'],['market_south','市場南の広場入口',[22.28,21.28],'market'],
 ['ajin_west','亜人街の共有庭',[22.87,20.65],'ajin'],['ajin_north','亜人街の北市場',[23.05,20.87],'ajin'],['ajin_east','亜人街東の荷役路',[23.38,20.79],'ajin'],['east_bend','東門内の屈曲路',[23.77,21.46],'administration'],['east_cross','東大通りの分岐',[23.56,21.53],'administration'],['office_south','行政区南の文書路',[23.20,21.27],'administration'],['market_east','市場東の露店入口',[22.62,21.45],'market'],['newspaper_west','瓦版屋の売り声広場',[22.63,21.22],'quay'],['east_quay','東河岸の高道',[23.60,21.18],'quay'],
 ['royal_approach','王城を望む坂下広場',[22.45,21.82],'market','plaza'],['royal_gate','王城の社会ゲート',[22.57,22.03],'castle','checkpoint'],['castle_court','王城前庭',[22.64,22.31],'castle','plaza'],['royal_service','宮務の東坂',[22.96,22.18],'castle'],['noble_gate','貴族街の紹介門',[22.06,21.96],'noble','checkpoint'],['noble_east','庭園沿いの散歩道',[22.30,22.25],'noble'],['mage_gate','塔の公開受付前',[23.28,21.98],'mage','checkpoint'],['mage_court','魔術塔の観測庭',[23.38,22.17],'mage','plaza'],['office_north','役所の公務坂',[23.05,21.84],'administration'],
 ['weapon','武器屋',[22.50,21.53],'market','facility'],['apothecary','薬屋',[22.19,21.32],'market','facility'],['warehouse','河岸の荷役作業点',[22.65,20.91],'quay','work'],['roof_stair','下層屋根への階段',[22.04,20.82],'lower','stairs'],['roof_landing','下層の低屋根歩廊',[22.16,20.84],'lower','roof'],
].forEach(v=>node(...v));

// A local distributary is proposed between the EXISTING west fork and royal river.
// The PDF code's .16 km conflicts with its prose/user's 12–20m: explicit request wins.
const westWater=waterways.find(w=>w.id==='capital-fork'),eastWater=waterways.find(w=>w.id==='royal-river');
const riverStart=westWater.path[4],riverEnd=eastWater.path[7];
const rivers=[{id:'capital_distributary',name:'王都の生活・荷役水路（提案）',points:[riverStart,[20.70,21.16],[21.30,21.14],[21.70,21.11],[22.10,21.08],[22.65,21.04],[23.20,20.99],[23.70,20.90],[24.35,20.92],riverEnd],widthM:16,normalWidthRangeM:[12,20],highFlowWidthM:22,bedDepthM:2,sourceConnections:[{waterwayId:westWater.id,point:riverStart},{waterwayId:eastWater.id,point:riverEnd}],status:'proposed-connected-distributary',note:'既存本流の55–185m／西水道25–90mは変更せず、局所の支流を16mで追加。PDF例の河道とは異なるため提案として明示。'}];
const riverY=x=>{const p=rivers[0].points;for(let i=1;i<p.length;i++)if(x>=Math.min(p[i-1][0],p[i][0])&&x<=Math.max(p[i-1][0],p[i][0]))return p[i-1][1]+(p[i][1]-p[i-1][1])*(x-p[i-1][0])/(p[i][0]-p[i-1][0]);return 21.04;};
export function terrainBaseAt(x,y){const north=Math.max(0,y-21.45);return 14+north*32+33*Math.exp(-((x-22.70)**2/.33+(y-22.57)**2/.20));}
export function elevationAt(x,y){const d=distanceToLine([x,y],rivers[0].points);return terrainBaseAt(x,y)-Math.max(0,1-d/24)*3;}
const bridges=[];
for(const [id,name,x,floodClosed,widthM] of [['west_bridge','西河岸の低橋',21.52,true,9],['south_bridge','南の穀物大橋',22.275,false,20],['news_bridge','瓦版屋の高橋',22.90,false,12],['east_bridge','東の職人橋',23.60,false,12]]){
 const y=riverY(x),position=[x,y],points=[[x,y-.055],[x,y+.055]];
 bridges.push({id,nodeId:id,name,position,points,widthM,lengthM:110,deckHeightM:terrainBaseAt(x,y)+2.8,floodClosed,reason:floodClosed?'古い低橋。増水時は南大橋へ迂回。':'船荷と避難に使う高い恒久橋。'});
 node(`${id}_south`,`${name} 南詰`,points[0],'quay','bridge-end');node(`${id}_north`,`${name} 北詰`,points[1],'quay','bridge-end');
}
function edge(from,to,name,cls='secondary',options={}) {
 const widths={primary:20,ceremonial:22,secondary:11,alley:5,service:8,stairs:4,roof:4,world:18};
 const id=options.id||`${from}__${to}`,points=[N(from).position,...(options.via||[]),N(to).position];
 const out={id,from,to,name,class:cls,widthM:widths[cls]||10,points,reason:options.reason||'地区の日常動線と街区境界に沿う。',...options};delete out.via;edges.push(out);return out;
}
const chain=(ids,name,cls,options)=>{for(let i=1;i<ids.length;i++)edge(ids[i-1],ids[i],name,cls,options);};
chain(['west_gate','west_inside','stable','coach_court','west_cross','market_west','market'],'西門の交易大通り','primary',{reason:'交易荷車→駅馬車転回庭→中央市場。門の圧縮から広場へ。'});
chain(['west_inside','west_upper','north_market','royal_approach','market'],'西の職人・住宅回遊路','secondary',{reason:'荷車の混雑を避ける住民と職人の徒歩生活路。'});
chain(['coach_court','west_quay','west_bridge_north'],'倉庫から駅馬車場への荷役道','service');
bridges.forEach(b=>edge(`${b.id}_south`,`${b.id}_north`,b.name,'secondary',{id:b.id,widthM:b.widthM,bridgeId:b.id,floodClosed:b.floodClosed,reason:b.reason}));
chain(['west_gate','west_quay'],'西門の河岸旧道','secondary',{reason:'旧渡し場を起源に、門から低橋・下層を通る道。'});
chain(['west_bridge_south','lower_west','orphanage','lower_court','south_cross','south_quay','south_bridge_south'],'下層の生活・福祉街路','secondary',{reason:'孤児院・井戸・荷役仕事場を結ぶ。'});
chain(['south_gate','south_inside','south_cross','south_quay','south_bridge_south'],'南門の穀物大通り','primary',{reason:'農村から市場へ穀物荷車が通る。'});
chain(['south_bridge_north','market_south','market'],'南大橋と市場の解放軸','primary');
chain(['south_inside','lower_south','inn','ajin_west','ajin','ajin_north','news_bridge_south'],'宿泊と住民の生活路','secondary',{reason:'駅馬車客の安宿、住民の買物、亜人街の共有庭。'});
chain(['news_bridge_north','newspaper','newspaper_west','market_east','market'],'瓦版・市場裏の情報経路','secondary',{reason:'朝の瓦版と噂が市場・住居・役所へ流れる。'});
chain(['east_gate','east_bend','east_cross','office','market_east','market'],'東門の行政大通り','primary',{reason:'森林からの木材・公務・市場への荷車道。'});
chain(['east_gate','east_quay','east_bridge_north'],'東門の河岸職人道','secondary',{reason:'東門から作業場と亜人住民の居住地を結ぶ。'});
chain(['east_bridge_south','ajin_east','ajin','ajin_west','warehouse','south_quay'],'東の職人・避難回遊路','secondary');
chain(['east_quay','office_south','newspaper'],'行政と瓦版の連絡路','secondary');
chain(['office_south','office','office_north','royal_service','castle_court','castle'],'公務の東坂','secondary',{reason:'役所の文書運搬と城の勤務交代。'});
chain(['market','royal_approach','royal_gate','castle_court','castle'],'王城への儀礼大坂','ceremonial',{reason:'市場から城の塔を断続的に望む政治の軸。'});
chain(['north_market','noble_gate','noble_square','noble_east','castle_court'],'庭園と貴族の公務道','secondary');
chain(['office_north','mage_gate','mage_court','mage_tower','royal_service'],'塔の研究・宮廷連絡路','secondary');
chain(['west_cross','north_market'],'西の職人坂','secondary');chain(['market_west','market_south'],'露店の外周','secondary');
chain(['lower_court','lower_south'],'下層の裏路地','alley');chain(['lower_court','roof_stair','roof_landing','south_cross'],'下層の階段と低屋根歩廊','stairs');
chain(['market','weapon','market_east'],'武器商の買物路','secondary');chain(['market_south','apothecary','market_west'],'薬屋の買物路','secondary');
chain(['warehouse','ajin_north','news_bridge_south'],'荷役から瓦版高橋','service');
// Local review extensions physically reach exact points on existing route polylines.
const worldConnections=[];
for(const [id,gateId,name,index,via] of [
 ['R06','west_gate','交易都市方面',7,[[20.90,21.55],[20.70,20.30]]],
 ['R11','south_gate','古代神殿方面',1,[[22.50,19.82],[23.85,19.45]]],
 ['R12','south_gate','田園の村方面',1,[[22.23,19.82]]],
 ['R13','east_gate','森方面',1,[[24.22,21.52]]],
]) { const route=routes.find(r=>r.id===id),joinPoint=route.path[index],nodeId=`world_${id}`;node(nodeId,name,joinPoint,'outside','world');const path=[N(gateId).position,...via,joinPoint];worldConnections.push({id,nodeId,gateId,name,path,joinPoint,atlasPath:route.path,hours:route.hours,status:'local-connector-proposal'});edge(gateId,nodeId,name,'world',{id:`connector_${id}`,via,reason:`既存${id}の折れ点へ同一座標で接続。以遠は従来atlas街道。`}); }

const facilityDefs=[
 ['LOC_CAP_CASTLE','castle',[130,105],55,'royal'],['LOC_CAP_MAGE_TOWER','mage_tower',[38,38],98,'mage'],['LOC_CAP_MARKET','market',[0,0],0],['LOC_CAP_OFFICE','office',[60,42],25],['LOC_CAP_ORPHANAGE','orphanage',[38,28],13],['LOC_CAP_AJIN_QUARTER','ajin',[0,0],0],['LOC_CAP_LOWER_INN','inn',[26,22],13],['LOC_CAP_NEWSPAPER','newspaper',[22,16],12],['LOC_CAP_STABLE','stable',[60,35],12],['LOC_CAP_WEAPON_SHOP','weapon',[22,17],12],['LOC_CAP_APOTHECARY','apothecary',[20,16],11],['LOC_CAP_BIG_STORE','orphanage',[38,28],13],
];
const facilities=facilityDefs.map(([id,nodeId,footprintM,heightM,gateTag])=>{const n=N(nodeId);return {id,nodeId,name:id==='LOC_CAP_BIG_STORE'?'大店（白鈴孤児院用地・条件付き）':n.name,position:n.position,entrance:n.position,buildingPosition:[n.position[0],n.position[1]+(footprintM[1]/2+9)/1000],footprintM,heightM,district:n.district,gateTag,source:id==='LOC_CAP_WEAPON_SHOP'||id==='LOC_CAP_APOTHECARY'?'canonical-ID; proposed-position':id==='LOC_CAP_BIG_STORE'?'canonical conditional reuse of orphanage lot':'PDF anchor preserved',activeWhen:id==='LOC_CAP_BIG_STORE'?{event:'T10',state:'failed'}:id==='LOC_CAP_ORPHANAGE'?{unlessEvent:'T10',state:'failed'}:null};});

const npcFlows=[
 {id:'merchant',name:'商人',profession:'merchant',from:'world_R06',to:'market',reason:'交易都市の荷を中央市場へ運ぶ。'},
 {id:'guard',name:'衛兵',profession:'guard',from:'west_gate',to:'castle',reason:'門の検問から王城の勤務交代。',access:{royalPermit:true,nobleStatus:true}},
 {id:'clerk',name:'役人',profession:'clerk',from:'office',to:'castle',reason:'土地台帳・事件文書を公務坂で運ぶ。',access:{royalPermit:true}},
 {id:'noble',name:'貴族',profession:'noble',from:'noble_square',to:'market',reason:'庭園街から市場の専門店へ。',access:{nobleStatus:true}},
 {id:'porter',name:'荷運び',profession:'porter',from:'warehouse',to:'market',reason:'河岸倉庫の荷物を南大橋で市場へ。'},
 {id:'artisan',name:'職人',profession:'artisan',from:'ajin',to:'weapon',reason:'亜人街の工房と市場の武器商を往来。'},
 {id:'coach',name:'駅馬車',profession:'coach',from:'stable',to:'south_gate',reason:'御者が乗客と農村への荷を運ぶ。'},
 {id:'carer',name:'孤児院関係者',profession:'carer',from:'orphanage',to:'apothecary',reason:'共同庭と橋を通って薬・食料を買う。'},
 {id:'news',name:'瓦版売り',profession:'news',from:'newspaper',to:'market',reason:'役所と住民の噂を市場で配る。'},
 {id:'resident',name:'亜人住民',profession:'resident',from:'east_gate',to:'ajin',reason:'森方面の仕事から複数の橋で帰宅。'},
 {id:'guest',name:'宿泊客',profession:'guest',from:'stable',to:'inn',reason:'駅馬車場から安宿へ、増水時は高橋を選ぶ。'},
];
const encounterStates={
 T10:{name:'孤児院の用地問題',districts:['lower','administration'],blockedEdgeIds:['orphanage__lower_court'],investigationNodes:['office','orphanage','newspaper'],refugeNodes:['inn'],resolution:'resolvedで封鎖解除。failed時は同じ敷地をLOC_CAP_BIG_STOREへ切替。'},
 T11:{name:'王都の陰謀・捜査',districts:['castle','administration'],blockedEdgeIds:['royal_gate__castle_court'],investigationNodes:['newspaper','office','orphanage'],refugeNodes:['market'],resolution:'公務坂と証言の代替経路。終了時は仮設封鎖を全撤去。'},
 T16:{name:'亜人街の襲撃・避難',districts:['ajin','lower'],blockedEdgeIds:['ajin_east__ajin'],investigationNodes:['ajin','newspaper'],refugeNodes:['orphanage','inn','market'],resolution:'高橋・下層経由の複数避難路。平時は敵なし。'},
 T17:{name:'宮廷魔術塔の異変',districts:['mage'],blockedEdgeIds:['mage_gate__mage_court'],investigationNodes:['mage_tower','office'],refugeNodes:['market'],resolution:'宮廷連絡路が調査迂回。事件終了で塔前の封鎖解除。'},
};
const viewpoints=[{id:'west_castle',name:'西門から王城の高塔',position:N('west_inside').position,target:'castle',intent:'大通りの空隙から北の高塔を断続視認。'},{id:'south_castle',name:'南大橋から王城',position:N('south_bridge_north').position,target:'castle',intent:'橋の解放部から坂上の王城を視認。'},{id:'ajin_tower',name:'亜人街から宮廷魔術塔',position:N('ajin').position,target:'mage_tower',intent:'南東地区で第二の垂直軸を得る。'}];

// Shared deterministic greybox/collider footprints. A regular parcelling lattice is
// jittered inside district boundaries, then carved by streets, plazas and water.
const buildings=[];let seed=20261001;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const plazaRadii={market:100,castle:110,mage_tower:52,stable:62,office:60,orphanage:42,ajin:48,inn:32,noble_square:55,royal_approach:58,coach_court:48};
for(let x=21.18;x<23.92;x+=.041)for(let y=20.13;y<22.94;y+=.041){const p=[x+(rnd()-.5)*.009,y+(rnd()-.5)*.009];if(!inside(p,corePolygon))continue;const d=districts.find(v=>inside(p,v.polygon));if(!d||rnd()>d.density)continue;const widthM=17+rnd()*12,depthM=17+rnd()*12,radius=Math.hypot(widthM,depthM)/2+4;
 if(distanceToLine(p,[...corePolygon,corePolygon[0]])<radius+8||distanceToLine(p,rivers[0].points)<radius+22)continue;
 if(edges.some(e=>distanceToLine(p,e.points)<radius+e.widthM/2+3))continue;
 if(nodes.some(n=>distance(p,n.position)<radius+(plazaRadii[n.id]||12)))continue;
 buildings.push({id:`building_${buildings.length}`,position:p,widthM,depthM,heightM:d.heightRangeM[0]+rnd()*(d.heightRangeM[1]-d.heightRangeM[0]),district:d.id,color:d.color});
}
// Facility masses sit north of their exact anchor; the anchor remains the door.
for(const f of facilities.filter(f=>f.footprintM[0]&&f.id!=='LOC_CAP_BIG_STORE'))buildings.push({id:`building_${f.id}`,facilityId:f.id,position:f.buildingPosition,widthM:f.footprintM[0],depthM:f.footprintM[1],heightM:f.heightM,district:f.district,color:districts.find(d=>d.id===f.district)?.color});

export const CAPITAL={version:'capital-vertical-slice-v1',status:'review-proposal',worldFrame:WORLD,origin:ORIGIN,units:'km',metresPerUnit:1000,walkingSpeedMps:1.4,core,activityEnvelope,atlasSilhouette:{polygon:atlas.points,areaKm2:atlas.areaKm2},districts,nodes,edges,facilities,gates,walls,rivers,bridges,worldConnections,npcFlows,encounterStates,viewpoints,buildings,contextWaterways:waterways,sourceNotes:['PDFのcoreと非門ランドマーク座標を保持。門だけ城壁へ最小距離投影。','activity envelopeは城壁の相似拡大ではなく、門外街道・河岸物流・郊外・王城背面の利用圏を約22km²で手描き。既存atlas silhouetteは原データを直接参照。','川幅は依頼の通常12–20m・増水22mを優先。既存広域本流は変更せず局所支流を提案。','12施設ID、T10失敗の孤児院用地再利用。建物意匠・副街路は実装提案。','実寸1:1、歩行1.4m/s。距離一覧の時間はマクロ設定であり物理経路から再計算しない。']};
