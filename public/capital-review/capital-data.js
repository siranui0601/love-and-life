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
 {id:'castle',name:'王城高台',polygon:[[22.43,22.03],[23.05,22.03],[23.40,22.66],[22.67,22.96],[22.37,22.65]],color:'#d7cbb0',ground:'切石・儀礼路',streetWidthM:22,heightRangeM:[22,42],density:.27,npcJobs:['衛兵','宮廷役人'],gateTag:'royal',risk:'許可による入域・平時D0',identity:'北の高台。儀礼軸と軍務迂回路。王城は地盤約90m＋高塔。'},
 {id:'noble',name:'貴族街',polygon:[[21.40,21.95],[22.34,21.94],[22.44,22.66],[21.91,22.80],[21.47,22.37]],color:'#ccc8a9',ground:'石畳・庭園',streetWidthM:18,heightRangeM:[17,28],density:.38,npcJobs:['貴族','庭師','従者'],gateTag:'noble',risk:'身分・服装・紹介',identity:'広い曲線路と塀、静かな植栽。城の西斜面。'},
 {id:'mage',name:'宮廷魔術塔周辺',polygon:[[23.06,21.96],[23.75,21.98],[23.73,22.33],[23.36,22.73],[23.17,22.65]],color:'#aaaec5',ground:'幾何学石舗装',streetWidthM:14,heightRangeM:[14,26],density:.35,npcJobs:['研究者','警備'],gateTag:'mage',risk:'T17発生時の封鎖と調査',identity:'王城とは東へ離れた垂直ランドマーク。'},
 {id:'administration',name:'行政区',polygon:[[22.75,21.30],[23.77,21.31],[23.84,21.86],[23.64,21.96],[22.82,21.94]],color:'#b0bbb8',ground:'整った敷石',streetWidthM:18,heightRangeM:[13,22],density:.58,npcJobs:['役人','衛兵','瓦版売り'],risk:'平時D0／捜査時D1',identity:'役所前庭、文書運搬、王城へ上る公務路。'},
 {id:'market',name:'中央市場・商業街',polygon:[[21.88,21.15],[22.76,21.16],[22.82,21.95],[21.91,21.94]],color:'#d5ae73',ground:'石畳・露店舗装',streetWidthM:20,heightRangeM:[16,29],density:.65,npcJobs:['商人','職人','宿泊客'],risk:'D0・休息と情報',identity:'大通りの交差と約180mの開けた広場、荷車道と買物路。'},
 {id:'west',name:'西門・駅馬車街',polygon:[[21.19,21.19],[21.87,21.17],[21.90,21.94],[21.28,21.95]],color:'#bda681',ground:'締め固め土・石の轍',streetWidthM:16,heightRangeM:[12,23],density:.56,npcJobs:['御者','荷運び','宿泊客'],risk:'D0・出入りの安全拠点',identity:'18mの門→壁内の細い通路→駅馬車庭の解放。'},
 {id:'lower',name:'下層・生活路',polygon:[[21.39,20.64],[21.88,20.26],[22.71,20.20],[22.90,20.45],[22.69,20.96],[21.43,21.03]],color:'#a88d78',ground:'土道・古い石畳',streetWidthM:6,heightRangeM:[8,18],density:.83,npcJobs:['荷運び','職人','孤児院関係者'],risk:'昼D0／夜D1・事件時変動',identity:'狭い生活路、小庭、孤児院と安宿の安全点。'},
 {id:'ajin',name:'亜人街',polygon:[[22.83,20.39],[23.31,20.43],[23.72,20.89],[23.46,20.91],[22.77,20.99]],color:'#ba9d82',ground:'混在舗装・共有庭',streetWidthM:10,heightRangeM:[9,19],density:.73,npcJobs:['亜人住民','商人','職人'],risk:'平時D0／T16避難・情報保全',identity:'東門・市場・下層へ別々に接続する住居と仕事の街。'},
 {id:'quay',name:'河岸・瓦版屋通り',polygon:[[21.24,21.02],[22.69,20.93],[23.68,20.86],[23.76,21.24],[22.66,21.28],[21.25,21.31]],color:'#92a8a4',ground:'荷役敷石・河岸段差',streetWidthM:8,heightRangeM:[8,15],density:.53,npcJobs:['荷運び','船員','瓦版売り'],risk:'雨D1／増水D2・迂回',identity:'約16mの水路と低橋・高橋。倉庫から市場への短距離物流。'},
];

const nodes=[];const edges=[];
function node(id,name,position,district,kind='junction'){const n={id,name,position,district,kind};nodes.push(n);return n;}
const N=id=>nodes.find(n=>n.id===id);
gates.forEach(g=>node(g.id,g.name,g.position,g.id==='west_gate'?'west':g.id==='south_gate'?'lower':'administration','gate'));
[
 ['market','中央市場',[22.35,21.45],'market','plaza'],['castle','王城',[22.70,22.55],'castle','facility'],['mage_tower','宮廷魔術塔',[23.25,22.35],'mage','facility'],['noble_square','貴族街',[22.05,22.20],'noble','plaza'],
 ['office','王都役所・土地課',[23.00,21.88],'administration','facility'],['orphanage','白鈴孤児院',[21.65,20.75],'lower','facility'],['ajin','亜人街',[23.10,20.72],'ajin','plaza'],['inn','下層の安宿',[22.55,20.47],'lower','facility'],['newspaper','瓦版屋通り',[22.85,21.18],'quay','facility'],['stable','王都駅馬車場',[21.42,21.50],'west','facility'],
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
const rivers=[{id:'capital_distributary',name:'王都の生活・荷役水路（提案）',points:[riverStart,[20.70,21.16],[21.30,21.14],[21.70,21.04],[21.93,21.12],[22.10,21.08],[22.275,21.0672727273],[22.45,21.14],[22.65,21.04],[22.90,21.0172727273],[23.20,20.99],[23.70,20.90],[24.35,20.92],riverEnd],widthM:16,normalWidthRangeM:[12,20],highFlowWidthM:22,bedDepthM:2,sourceConnections:[{waterwayId:westWater.id,point:riverStart},{waterwayId:eastWater.id,point:riverEnd}],status:'proposed-connected-distributary',note:'既存本流の55–185m／西水道25–90mは変更せず、局所の支流を16mで追加。PDF例の河道とは異なるため提案として明示。'}];
// The existing macro rivers frame the outer city. These are inherited geometry,
// not new canonical waterways; the 16m distributary remains the inner-city edge.
function clipContextPath(path){
 const xs=envelopePolygon.map(p=>p[0]),ys=envelopePolygon.map(p=>p[1]),bounds=[Math.min(...xs)-.15,Math.max(...xs)+.15,Math.min(...ys)-.15,Math.max(...ys)+.15],out=[];
 for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dy=b[1]-a[1];let lo=0,hi=1,valid=true;
  for(const [p,q]of [[-dx,a[0]-bounds[0]],[dx,bounds[1]-a[0]],[-dy,a[1]-bounds[2]],[dy,bounds[3]-a[1]]]){if(p===0){if(q<0)valid=false;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}
  if(!valid||lo>hi)continue;const start=[a[0]+dx*lo,a[1]+dy*lo],end=[a[0]+dx*hi,a[1]+dy*hi];if(!out.length||distance(out.at(-1),start)>.01)out.push(start);out.push(end);
 }return out;
}
for(const water of [westWater,eastWater])rivers.push({id:water.id,name:water.name,points:clipContextPath(water.path),sourcePath:water.path,widthM:(water.widthMeters[0]+water.widthMeters[1])/2,highFlowWidthM:water.widthMeters[1],normalWidthRangeM:water.widthMeters,context:true});
const riverY=x=>{const p=rivers[0].points;for(let i=1;i<p.length;i++)if(x>=Math.min(p[i-1][0],p[i][0])&&x<=Math.max(p[i-1][0],p[i][0]))return p[i-1][1]+(p[i][1]-p[i-1][1])*(x-p[i-1][0])/(p[i][0]-p[i-1][0]);return 21.04;};
const rawHill=(x,y)=>14+15*Math.exp(-((x-22.35)**2/.9+(y-21.65)**2/.30))+Math.max(0,y-21.45)*42+82*Math.exp(-((x-22.70)**2/.45+(y-22.64)**2/.28));
const terraceDefs=[['market',88,120],['castle_court',48,86],['noble_square',48,78],['royal_approach',40,65],['office',35,65]].map(([id,flat,blend])=>({position:N(id).position,flat,blend,height:rawHill(...N(id).position)}));
export function terrainBaseAt(x,y){let height=rawHill(x,y);for(const {position:c,flat,blend,height:level}of terraceDefs){const d=distance([x,y],c),t=Math.max(0,Math.min(1,(blend-d)/(blend-flat))),smooth=t*t*(3-2*t);height=height*(1-smooth)+level*smooth;}return height;}

export function elevationAt(x,y){let cut=0;for(const r of rivers){const d=distanceToLine([x,y],r.points),bank=r.widthM/2+16;cut=Math.max(cut,Math.max(0,1-d/bank)*(r.context?8:3));}return terrainBaseAt(x,y)-cut;}
const bridges=[];
for(const [id,name,x,floodClosed,widthM] of [['west_bridge','西河岸の低橋',21.52,true,9],['south_bridge','南の穀物大橋',22.275,false,20],['news_bridge','瓦版屋の高橋',22.90,false,12],['east_bridge','東の職人橋',23.60,false,12]]){
 const y=riverY(x),position=[x,y],points=[[x,y-.055],[x,y+.055]];
 bridges.push({id,nodeId:id,name,position,points,widthM,lengthM:110,deckHeightM:terrainBaseAt(x,y)+2.8,floodClosed,reason:floodClosed?'古い低橋。増水時は南大橋へ迂回。':'船荷と避難に使う高い恒久橋。'});
 node(`${id}_south`,`${name} 南詰`,points[0],'quay','bridge-end');node(`${id}_north`,`${name} 北詰`,points[1],'quay','bridge-end');
}
function edge(from,to,name,cls='secondary',options={}) {
 const widths={primary:20,ceremonial:22,secondary:11,alley:5,service:8,stairs:4,roof:4,world:18};
 const id=options.id||`${from}__${to}`,points=[N(from).position,...(options.via||[]),N(to).position];
 const roles={primary:'critical-logistics',ceremonial:'orientation-ceremonial',secondary:'optional-life',service:'service-logistics',alley:'desire-path',stairs:'desire-shortcut',roof:'desire-shortcut',world:'world-connector'};
 const localWidths={lower:6,ajin:9,quay:8,west:10,market:11,administration:12,noble:15,castle:14,mage:10};
 const streetWidth=cls==='secondary'?(localWidths[N(from).district]||11):(widths[cls]||10);
 const out={id,from,to,name,class:cls,designRole:options.designRole||roles[cls]||'optional-life',widthM:streetWidth,points,reason:options.reason||'地区の日常動線と街区境界に沿う。',...options};delete out.via;edges.push(out);return out;
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

// Contour streets avoid the steep face of the royal hill. Their graph is the
// traversal representation of these surveyed physical alignments.
for(const [id,via] of [
 ['royal_approach__royal_gate',[[22.39,21.91],[22.43,21.98]]],
 ['royal_gate__castle_court',[[22.51,22.12],[22.54,22.23]]],
 ['office_north__royal_service',[[23.12,21.97],[23.09,22.10]]],
 ['royal_service__castle_court',[[22.92,22.29],[22.80,22.35]]],
 ['west_upper__north_market',[[21.77,21.82],[21.95,21.79]]],
 ['east_cross__office',[[23.40,21.64],[23.21,21.76]]],
 ['market_east__market',[[22.54,21.39],[22.43,21.39]]],
]){const e=edges.find(e=>e.id===id);e.points=[N(e.from).position,...via,N(e.to).position];}

// Approach facilities through their anchored south doors rather than through their masses.
for(const [id,via] of [
 ['lower_west__orphanage',[[21.61,20.73]]],
 ['office__office_north',[[23.07,21.86]]],
 ['apothecary__market_west',[[22.15,21.32],[22.15,21.45]]],
]) {const e=edges.find(e=>e.id===id);e.points=[N(e.from).position,...via,N(e.to).position];}
// The R06 approach crosses the real distributary. A structural high bridge is required;
// it is a proposed road structure, not a thirteenth canonical facility.
const r06=edges.find(e=>e.id==='connector_R06'),ra=r06.points[1],rb=r06.points[2];
let crossing;
for(let i=1;i<rivers[0].points.length;i++){
 const a=rivers[0].points[i-1],b=rivers[0].points[i],rx=rb[0]-ra[0],ry=rb[1]-ra[1],sx=b[0]-a[0],sy=b[1]-a[1],den=rx*sy-ry*sx;
 if(!den)continue;const t=((a[0]-ra[0])*sy-(a[1]-ra[1])*sx)/den,u=((a[0]-ra[0])*ry-(a[1]-ra[1])*rx)/den;
 if(t>=0&&t<=1&&u>=0&&u<=1){crossing=[ra[0]+rx*t,ra[1]+ry*t];break;}
}
if(crossing){
 const len=distance(ra,rb),dx=(rb[0]-ra[0])/len,dy=(rb[1]-ra[1])/len,ends=[[-55,55].map(v=>[crossing[0]+dx*v,crossing[1]+dy*v])][0],id='approach_R06_bridge';
 const b={id,position:crossing,points:ends,widthM:18,lengthM:110,deckHeightM:terrainBaseAt(...crossing)+2.8,floodClosed:false,reason:'西門外のR06街道が支流水路を跨ぐ高橋（設計提案）',outside:true};bridges.push(b);
 node(id+'_north','西門外高橋の北詰',ends[0],'outside','bridge-end');node(id+'_south','西門外高橋の南詰',ends[1],'outside','bridge-end');
 edges.splice(edges.indexOf(r06),1);
 edge('west_gate',id+'_north','R06 西門外の街道','world',{id:'connector_R06',via:[ra]});
 edge(id+'_north',id+'_south',b.reason,'world',{id,bridgeId:id,widthM:18});
 edge(id+'_south','world_R06','R06 交易街道の合流','world',{id:'connector_R06_outside',via:[rb]});
}

// Structural crossings of the inherited outer waterways are part of the same
// world roads. Decks are physical surfaces, without separate NPC/scene connections.
for(const e of edges.filter(e=>e.class==='world'&&!e.bridgeId))for(const r of rivers.filter(r=>r.context))for(let i=1;i<e.points.length;i++)for(let j=1;j<r.points.length;j++){
 const a=e.points[i-1],b=e.points[i],c=r.points[j-1],d=r.points[j],rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1],den=rx*sy-ry*sx;if(!den)continue;
 const t=((c[0]-a[0])*sy-(c[1]-a[1])*sx)/den,u=((c[0]-a[0])*ry-(c[1]-a[1])*rx)/den;if(t<0||t>1||u<0||u>1)continue;
 const position=[a[0]+rx*t,a[1]+ry*t],len=distance(a,b),angle=Math.abs(den)/(Math.hypot(rx,ry)*Math.hypot(sx,sy)),half=(r.highFlowWidthM/Math.max(.1,angle)+80)/2;
 const points=[-half,half].map(v=>[position[0]+rx*1000/len*v/1000,position[1]+ry*1000/len*v/1000]);
 bridges.push({id:'world_bridge_'+e.id+'_'+r.id,edgeId:e.id,name:r.name+'の街道高橋',position,points,widthM:e.widthM,lengthM:half*2,deckHeightM:terrainBaseAt(...position)+3.8,floodClosed:false,outside:true,context:true});
}

// Meso loops: quiet information courts and a river terrace, not faster copies of the avenue.
for(const args of [
 ['market_back','市場裏の搬入口',[22.10,21.57],'market','junction'],
 ['stall_court','露店裏の小庭',[22.23,21.60],'market','plaza'],
 ['market_reveal','市場の屋根切れ',[22.34,21.60],'market','junction'],
 ['clerk_court','文書路の中庭',[23.37,21.67],'administration','plaza'],
 ['clerk_turn','行政街路の折れ',[23.18,21.71],'administration','junction'],
 ['quay_refuge','河岸段丘の休み場',[22.48,20.98],'quay','plaza'],
 ['bank_turn','荷役路の石段',[22.38,20.94],'quay','stairs'],
]) node(...args);
chain(['orphanage','lower_south'],'孤児院南側の生活避難路','alley',{via:[[21.74,20.61],[21.98,20.55]],value:'増水とT10封鎖が重なる時の生活アクセス',reason:'低橋と北の行政封鎖を避ける、同じ都市内の徒歩生活路。'});
chain(['market_west','market_back','stall_court','market_reveal','royal_approach'],'露店裏の聞き込み回遊','alley',{value:'情報・NPC接触・王城の再発見',reason:'買物主動線を外れ、搬入口から小庭と屋根の切れ目へ。時間短縮を保証しない。'});
chain(['east_cross','clerk_court','clerk_turn','office_north'],'文書中庭の静かな回遊','secondary',{widthM:7,value:'静かな歩行・公務坂の別進入',reason:'東の荷車大通りを離れて中庭を折れ、公務坂へ上る。'});
chain(['south_quay','bank_turn','quay_refuge','warehouse'],'河岸段丘の見晴らし路','stairs',{widthM:4,value:'景観・荷役混雑回避',reason:'荷車道より高い河岸段丘。徒歩専用で、増水時の低橋とは別の眺望路。'});
for(const e of edges.filter(e=>e.name==='下層の階段と低屋根歩廊')){
 e.class=e.from==='roof_stair'?'roof':'stairs';e.value='河岸の見晴らし・荷車回避';
 e.surfaceOffsetsM=e.from==='lower_court'?[0,4.5]:e.from==='roof_stair'?[4.5,4.5]:[4.5,0];if(e.class==='stairs')e.surfaceRampM=12;
}
// Meso block boundaries: modest loops behind street walls, with courts and
// occasional cul-de-sacs. Water, walls and social districts constrain every block.
const urbanBlocks=[];
for(const [i,e] of [...edges].entries()){
 if(e.bridgeId||['world','roof','stairs','ceremonial'].includes(e.class)||e.points.length!==2)continue;
 if(['gate','facility'].includes(N(e.from).kind)||['gate','facility'].includes(N(e.to).kind)||N(e.from).district!==N(e.to).district)continue;
 const a=N(e.from),b=N(e.to),len=distance(a.position,b.position);if(len<110||len>440)continue;
 const dx=(b.position[0]-a.position[0])*1000/len,dy=(b.position[1]-a.position[1])*1000/len;
 for(const side of [-1,1]){
  const depth=(a.district==='lower'?45:a.district==='market'?60:80)*side;
  const ps=[.2,.5,.8].map(t=>[a.position[0]+(dx*len*t-dy*depth)/1000,a.position[1]+(dy*len*t+dx*depth)/1000]);
  if(ps.some(p=>!inside(p,corePolygon)||distanceToLine(p,[...corePolygon,corePolygon[0]])<25||distanceToLine(p,rivers[0].points)<24))continue;
  const samples=[a.position,...ps,b.position].flatMap((p,j,all)=>j?Array.from({length:12},(_,k)=>[all[j-1][0]+(p[0]-all[j-1][0])*(k+1)/12,all[j-1][1]+(p[1]-all[j-1][1])*(k+1)/12]):[p]);
  if(samples.some(p=>districts.some(d=>d.gateTag&&inside(p,d.polygon)!==inside(a.position,d.polygon))))continue;
  if(samples.some(p=>distanceToLine(p,rivers[0].points)<14||nodes.some(n=>n.kind==='facility'&&distance(p,n.position)<75)))continue;
  const ids=ps.map((p,j)=>{const id='block_'+i+'_'+side+'_'+j;node(id,'街区の小庭・裏口',p,a.district,j===1?'plaza':'junction');return id;});
  chain([a.id,...ids,b.id],a.district==='lower'?'斜面の生活小回遊':'街区裏の中庭回遊','alley',{widthM:a.district==='lower'?3.8:5,reason:'街区内部の中庭と裏口を結び、幹線の荷車を避ける。'});
  urbanBlocks.push({id:'urban_block_'+urbanBlocks.length,district:a.district,court:ps[1],radiusM:9,frontageEdgeId:e.id,points:[a.position,...ps,b.position]});
 }
}

// Wall maintenance and river labour produce distinct streets, rather than
// interchangeable extra connections. Closed courts reward exploration, not speed.
edge('west_inside','west_quay','西城壁沿いの見張り生活路','service',{widthM:5,via:[[21.22,21.35],[21.34,21.31]],designRole:'optional-life',value:'城壁・衛兵との接触、門内混雑回避'});
edge('south_inside','lower_south','南城壁沿いの生活路','secondary',{widthM:5,via:[[22.09,20.23],[21.90,20.35],[22.00,20.44]],value:'周縁住宅・南門の方向回復'});
edge('west_bridge_north','south_bridge_north','曲がる北河岸の荷役歩廊','service',{widthM:6,via:[[21.70,21.075],[21.93,21.155],[22.10,21.115]],value:'水面の景観・荷役接触、低橋閉鎖時の高橋接続'});
for(const [from,id,p]of [['market_back','workshop_dead_end',[22.07,21.64]],['lower_west','lower_dead_end',[21.45,20.90]]]){node(id,'街区奥の袋小路中庭',p,N(from).district,'plaza');edge(from,id,'店裏・生活中庭への袋小路','alley',{widthM:4,value:'情報と住民への接触。通り抜け・時間短縮には使えない。'});}
const nobleContour=edges.find(e=>e.id==='noble_square__noble_east');nobleContour.points=[N('noble_square').position,[22.04,22.31],[22.20,22.33],[22.32,22.29],N('noble_east').position];

const negativeSpaces=[
 ['market',88,'market','市場の開放','噂・買物・人流の再分配'],
 ['coach_court',42,'court','駅馬車転回庭','朝の到着・荷車待機'],
 ['royal_approach',40,'court','坂下の選択広場','王城を再提示・許可の判断'],
 ['castle_court',48,'court','王城前庭','儀礼と公務路の合流'],
 ['mage_court',30,'court','塔の観測庭','調査の迂回と眺望'],
 ['lower_court',24,'well','共同井戸','庇と狭い生活路に囲まれた休息'],
 ['ajin',34,'court','共有庭','避難先を選び直す'],
 ['stall_court',17,'court','露店裏の小庭','店裏の聞き込み'],
 ['noble_square',48,'garden','貴族街の庭園余地','公務路と住民の静かな回遊'],
 ['clerk_court',20,'garden','文書中庭','荷車道から離れた静けさ'],
 ['quay_refuge',18,'terrace','河岸段丘','水面と市街を読む'],
].map(([nodeId,radiusM,kind,name,value])=>({id:'space_'+nodeId,nodeId,position:N(nodeId).position,radiusM,kind,name,value}));
negativeSpaces.push(...urbanBlocks.map(b=>({id:'court_'+b.id,nodeId:nodes.find(n=>n.position===b.court).id,position:b.court,radiusM:b.radiusM,kind:'court',name:'街区内部の小庭',value:'幹線から離れた滞留と裏口の選択'})));
for(const id of ['workshop_dead_end','lower_dead_end'])negativeSpaces.push({id:'space_'+id,nodeId:id,position:N(id).position,radiusM:7,kind:'court',name:'袋小路の中庭',value:'通り抜けない探索・住民との接触'});

// Visual/traffic profiles are design proposals, never new canonical cultures or facilities.
const districtProfiles={
 castle:{paving:'#aaa795',roof:'#687489',vegetation:3,noise:'儀礼・足音',traffic:'衛兵と公務',light:'#efdca5'},
 noble:{paving:'#a6ab96',roof:'#6c767d',vegetation:5,noise:'庭木・静かな生活',traffic:'徒歩中心',light:'#f2dda6'},
 mage:{paving:'#8f96a4',roof:'#555d7d',vegetation:2,noise:'風・研究勤務',traffic:'受付と警備',light:'#b8c6ec'},
 administration:{paving:'#9b9f97',roof:'#747779',vegetation:2,noise:'文書運搬・公務',traffic:'朝の役人',light:'#eadbb3'},
 market:{paving:'#ae956c',roof:'#875a40',vegetation:1,noise:'売り声・荷車',traffic:'昼の混在',light:'#f4cd86'},
 west:{paving:'#9e8968',roof:'#77664e',vegetation:1,noise:'車輪・到着客',traffic:'朝の駅馬車',light:'#e2bf88'},
 lower:{paving:'#88745e',roof:'#695344',vegetation:1,noise:'生活・井戸',traffic:'徒歩と夕方の帰宅',light:'#d7b276'},
 ajin:{paving:'#9f876b',roof:'#735a4a',vegetation:2,noise:'仕事と共有庭',traffic:'職人・住民の回遊',light:'#e8c08e'},
 quay:{paving:'#8a9390',roof:'#636b69',vegetation:1,noise:'水・荷役',traffic:'荷運び・増水時迂回',light:'#c8d8c4'},
};
for(const d of districts)Object.assign(d,{profile:districtProfiles[d.id]});
const outskirts=[
 {id:'west_approach',gateId:'west_gate',position:[20.94,21.54],kind:'produce-yard',radiusM:55,name:'西門外の荷待ち庭'},
 {id:'south_fields',gateId:'south_gate',position:[22.22,19.88],kind:'farmland',radiusM:110,name:'南門外の畑と農道'},
 {id:'east_approach',gateId:'east_gate',position:[24.14,21.54],kind:'roadside',radiusM:50,name:'森街道の荷車待機場'},
];

const facilityDefs=[
 ['LOC_CAP_CASTLE','castle',[310,190],88,'royal'],['LOC_CAP_MAGE_TOWER','mage_tower',[38,38],98,'mage'],['LOC_CAP_MARKET','market',[0,0],0],['LOC_CAP_OFFICE','office',[60,42],25],['LOC_CAP_ORPHANAGE','orphanage',[38,28],13],['LOC_CAP_AJIN_QUARTER','ajin',[0,0],0],['LOC_CAP_LOWER_INN','inn',[26,22],13],['LOC_CAP_NEWSPAPER','newspaper',[22,16],12],['LOC_CAP_STABLE','stable',[60,35],12],['LOC_CAP_WEAPON_SHOP','weapon',[22,17],12],['LOC_CAP_APOTHECARY','apothecary',[20,16],11],['LOC_CAP_BIG_STORE','orphanage',[38,28],13],
];
const facilities=facilityDefs.map(([id,nodeId,footprintM,heightM,gateTag])=>{const n=N(nodeId);return {id,nodeId,name:id==='LOC_CAP_BIG_STORE'?'大店（白鈴孤児院用地・条件付き）':n.name,position:n.position,entrance:n.position,buildingPosition:[n.position[0],n.position[1]+(footprintM[1]/2+9)/1000],footprintM,heightM,district:n.district,gateTag,source:id==='LOC_CAP_WEAPON_SHOP'||id==='LOC_CAP_APOTHECARY'?'canonical-ID; proposed-position':id==='LOC_CAP_BIG_STORE'?'canonical conditional reuse of orphanage lot':id==='LOC_CAP_OFFICE'?'canonical-ID; upper-slope position proposed in pass 4':'PDF anchor inherited',activeWhen:id==='LOC_CAP_BIG_STORE'?{event:'T10',state:'failed'}:id==='LOC_CAP_ORPHANAGE'?{unlessEvent:'T10',state:'failed'}:null};});

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
const viewpoints=[{id:'west_castle',name:'西門から王城の高塔',position:N('west_inside').position,target:'castle',corridorWidthM:34,intent:'大通りの空隙から北の高塔を断続視認。'},{id:'south_castle',name:'南大橋から王城',position:N('south_bridge_north').position,target:'castle',corridorWidthM:42,intent:'橋の解放部から坂上の王城を視認。'},{id:'ajin_tower',name:'亜人街から宮廷魔術塔',position:N('ajin').position,target:'mage_tower',corridorWidthM:28,intent:'南東地区で第二の垂直軸を得る。'}];
const sightCorridors=viewpoints.map(v=>({id:v.id,points:[v.position,N(v.target).position],widthM:v.corridorWidthM,target:v.target,intent:v.intent}));
const levelDesignBeats=[
 {id:'beat_west_throat',type:'compression',nodeId:'west_inside',name:'西門の圧縮',intent:'18m門を抜けた直後は城壁と検問で視界を絞り、駅馬車庭へ抜けた瞬間に開放する。'},
 {id:'beat_coach_release',type:'release',nodeId:'coach_court',name:'駅馬車転回庭の解放',intent:'旅人・荷車・宿泊客が方向を選び直す最初の都市node。'},
 {id:'beat_market_release',type:'release',nodeId:'market',name:'中央市場の大解放',intent:'複数地区と大通りが集束し、音・人流・視界の密度が最大になる認知上の中心。'},
 {id:'beat_south_prospect',type:'prospect',nodeId:'south_bridge_north',name:'南大橋の眺望',intent:'水面の開放と高台の王城を同時に見せ、都市全体の高低差を一度で理解させる。'},
 {id:'beat_royal_reveal',type:'reveal',nodeId:'royal_approach',name:'王城の再提示',intent:'市場の雑踏から坂へ折れた時、建物の切れ目越しに王城が再び正面化する。'},
 {id:'beat_royal_gate',type:'social-gate',nodeId:'royal_gate',name:'王城の社会ゲート',intent:'敵レベルではなく身分・許可・関係性で進入可否が変わる政治的chokepoint。'},
 {id:'beat_lower_refuge',type:'refuge',nodeId:'lower_court',name:'下層の共同井戸',intent:'狭い生活路の中に小さな滞留余地を置き、宿・孤児院・裏路地へ分岐する局所的refuge。'},
 {id:'beat_roof_desire',type:'desire-path',nodeId:'roof_landing',name:'低屋根の近道',intent:'正規大通りを外れて地形と建物を読み、短い高低差を使って回り込む徒歩者のdesire path。'},
 {id:'beat_ajin_choice',type:'decision',nodeId:'ajin',name:'亜人街の分岐核',intent:'東門・市場・下層へ別々に逃げられ、平時の生活とT16避難の両方を支える。'},
 {id:'beat_quay_weather',type:'hazard-edge',nodeId:'warehouse',name:'河岸の天候edge',intent:'平時は最短の荷役路だが、増水時は低橋閉鎖によって高橋側へ人流を押し戻す。'},
 {id:'beat_east_reveal',type:'reveal',nodeId:'east_bend',name:'東門の塔リビール',intent:'森側から入城後の折れで宮廷魔術塔を見せ、王城が見えにくい南東でも方角を回復させる。'}
].map(b=>({...b,position:N(b.nodeId).position,source:'deep-research-application'}));

// A physical street has one edge. Older chains repeated some shared segments
// in opposite directions or under two classes; retain the dominant street role.
const streetRanks={world:7,ceremonial:6,primary:5,secondary:4,service:3,stairs:2,roof:2,alley:1},physicalStreets=new Map(),usedEdgeIds=new Set();
for(const e of [...edges]){const forward=e.from<e.to,ps=forward?e.points:[...e.points].reverse(),signature=ps.map(p=>p.map(v=>v.toFixed(6)).join(',')).join('|'),existing=physicalStreets.get(signature);
 if(existing){const keep=(streetRanks[e.class]||0)>(streetRanks[existing.class]||0)?e:existing,remove=keep===e?existing:e;edges.splice(edges.indexOf(remove),1);physicalStreets.set(signature,keep);for(const b of urbanBlocks)if(b.frontageEdgeId===remove.id)b.frontageEdgeId=keep.id;}
 else physicalStreets.set(signature,e);
}
for(const e of edges){if(usedEdgeIds.has(e.id))e.id+='__'+e.designRole;usedEdgeIds.add(e.id);}

// Royal architecture is one canonical castle facility, composed of several
// physical wings on successive elevations, not newly invented named facilities.
const royalParts=[
 {id:'royal_west_wing',position:[22.45,22.49],widthM:95,depthM:180,heightM:58,roofHeightM:14},
 {id:'royal_east_wing',position:[22.94,22.49],widthM:95,depthM:180,heightM:64,roofHeightM:14},
 {id:'royal_north_hall',position:[22.70,22.84],widthM:280,depthM:95,heightM:94,roofHeightM:18},
 {id:'royal_north_west',position:[22.49,22.73],widthM:90,depthM:115,heightM:87,roofHeightM:14},
 {id:'royal_north_east',position:[22.95,22.73],widthM:90,depthM:115,heightM:92,roofHeightM:14},
].map(b=>({...b,district:'castle',color:'#d7cbb0',rotationRad:0,royalPart:true,canonicalParent:'LOC_CAP_CASTLE'}));

// Parcel geometry is generated from street enclosure first, then contour-oriented
// rear blocks. All rendered footprints are shared with swept collision.
const buildings=[];let seed=20261001;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const plazaRadii=Object.fromEntries(negativeSpaces.map(s=>[s.nodeId,s.radiusM]));
const districtsAt=p=>p[1]>22.64?districts[0]:districts.find(d=>inside(p,d.polygon))||districts.filter(d=>!d.gateTag).reduce((best,d)=>{const c=d.polygon.reduce((v,q)=>[v[0]+q[0]/d.polygon.length,v[1]+q[1]/d.polygon.length],[0,0]);return distance(p,c)<best.dist?{d,dist:distance(p,c)}:best;},{d:districts[6],dist:Infinity}).d;
const occupied=new Map(),cell=.06,key=(x,y)=>x+','+y;
function near(p){const out=[],x=Math.floor(p[0]/cell),y=Math.floor(p[1]/cell);for(let i=x-1;i<=x+1;i++)for(let j=y-1;j<=y+1;j++)out.push(...(occupied.get(key(i,j))||[]));return out;}
function corners(b,pad=0){const w=b.widthM/2+pad,h=b.depthM/2+pad,c=Math.cos(b.rotationRad),t=Math.sin(b.rotationRad);return [[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,z])=>[b.position[0]+(x*c+z*t)/1000,b.position[1]+(x*t-z*c)/1000]);}
function overlaps(a,b){const ac=corners(a,1),bc=corners(b,1);for(const angle of [a.rotationRad,b.rotationRad])for(const t of [angle,angle+Math.PI/2]){const axis=[Math.cos(t),Math.sin(t)],aa=ac.map(p=>p[0]*axis[0]+p[1]*axis[1]),bb=bc.map(p=>p[0]*axis[0]+p[1]*axis[1]);if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa))return false;}return true;}
function add(b){const p=b.position,r=Math.hypot(b.widthM,b.depthM)/2,cs=corners(b,1);
 if(cs.some(q=>!inside(q,corePolygon))||distanceToLine(p,[...corePolygon,corePolygon[0]])<r+7)return false;
 if(distanceToLine(p,rivers[0].points)<r+14)return false;
 if(negativeSpaces.some(q=>distance(p,q.position)<q.radiusM+r))return false;
 if(urbanBlocks.some(q=>distance(p,q.court)<q.radiusM+r))return false;
 if(facilities.some(f=>f.footprintM[0]&&Math.abs((p[0]-f.buildingPosition[0])*1000)<f.footprintM[0]/2+r+2&&Math.abs((p[1]-f.buildingPosition[1])*1000)<f.footprintM[1]/2+r+2))return false;
 if(sightCorridors.some(q=>distanceToLine(p,q.points)<q.widthM/2+r))return false;
 // Footprint corners and dense edge samples protect every physical street ribbon.
 for(const e of edges){if(distanceToLine(p,e.points)>r+e.widthM/2+2)continue;
  if(cs.some(q=>distanceToLine(q,e.points)<e.widthM/2+1))return false;
  for(let j=1;j<e.points.length;j++){const u=e.points[j-1],v=e.points[j],len=distance(u,v),steps=Math.ceil(len/5);for(let k=0;k<=steps;k++){const q=[u[0]+(v[0]-u[0])*k/steps,u[1]+(v[1]-u[1])*k/steps];if(inside(q,cs))return false;}}
 }
 if(near(p).some(q=>overlaps(b,q))||royalParts.some(q=>overlaps(b,q)))return false;
 buildings.push(b);const k=key(Math.floor(p[0]/cell),Math.floor(p[1]/cell));if(!occupied.has(k))occupied.set(k,[]);occupied.get(k).push(b);return true;
}
for(const e of edges.filter(e=>!e.bridgeId&&!['world','roof'].includes(e.class)))for(let j=1;j<e.points.length;j++){
 const a=e.points[j-1],b=e.points[j],len=distance(a,b),dx=(b[0]-a[0])*1000/len,dy=(b[1]-a[1])*1000/len;
 for(let along=12;along<len-9;){const widthM=11+rnd()*12,depthM=18+rnd()*13;
  for(const side of [-1,1]){const offset=e.widthM/2+depthM/2+2.3,p=[a[0]+(dx*along-dy*offset*side)/1000,a[1]+(dy*along+dx*offset*side)/1000],d=districtsAt(p);
   add({id:'frontage_'+buildings.length,frontageEdgeId:e.id,position:p,widthM,depthM,heightM:d.heightRangeM[0]+rnd()*(d.heightRangeM[1]-d.heightRangeM[0]),rotationRad:Math.atan2(dy,dx),district:d.id,color:d.color,roofHeightM:4+rnd()*4});
  }along+=widthM+1.4+rnd()*1.8;
 }
}
for(let attempt=0;attempt<100000;attempt++){
 const p=[21.16+rnd()*2.79,20.05+rnd()*2.96];if(!inside(p,corePolygon))continue;const d=districtsAt(p);
 const size=d.id==='lower'?[12,18]:d.id==='noble'?[26,30]:[19,25],widthM=size[0]+rnd()*14,depthM=size[1]+rnd()*17;
 const angle=Math.atan2(p[1]-22.64,p[0]-22.70)+Math.PI/2+(rnd()-.5)*.3;
 add({id:'block_mass_'+attempt,position:p,widthM,depthM,heightM:d.heightRangeM[0]+rnd()*(d.heightRangeM[1]-d.heightRangeM[0]),rotationRad:angle,district:d.id,color:d.color,roofHeightM:4+rnd()*5});
}
// Sparse outskirts follow the same gate approach roads. Density decays along
// their length rather than repeating the dense core beyond the walls.
const suburbBuildings=[];
for(const e of edges.filter(e=>e.class==='world'&&!e.bridgeId))for(let j=1;j<e.points.length;j++){
 const a=e.points[j-1],b=e.points[j],len=distance(a,b),dx=(b[0]-a[0])*1000/len,dy=(b[1]-a[1])*1000/len;
 for(let along=35;along<len;along+=55+rnd()*100)for(const side of [-1,1]){
  const widthM=12+rnd()*10,depthM=14+rnd()*10,off=(e.widthM/2+depthM/2+7+rnd()*28)*side,p=[a[0]+(dx*along-dy*off)/1000,a[1]+(dy*along+dx*off)/1000],r=Math.hypot(widthM,depthM)/2;
  const gateDistance=Math.min(...gates.map(g=>distance(p,g.position)));
  if(inside(p,corePolygon)||!inside(p,envelopePolygon)||rnd()>Math.max(.15,1-gateDistance/1500))continue;
  if(rivers.some(river=>distanceToLine(p,river.points)<river.highFlowWidthM/2+r+8)||edges.some(road=>distanceToLine(p,road.points)<road.widthM/2+r+2))continue;
  if(suburbBuildings.some(q=>distance(p,q.position)<r+Math.hypot(q.widthM,q.depthM)/2+4))continue;
  suburbBuildings.push({id:'suburban_'+suburbBuildings.length,position:p,widthM,depthM,heightM:6+rnd()*6,roofHeightM:3+rnd()*3,rotationRad:Math.atan2(dy,dx),district:'outside',color:'#b6a58c',outside:true});
 }
}
// This short roof seam belongs to genuinely low houses, so reaching the deck
// gives a different prospect instead of another corridor between tall walls.
const lowRoofRoute=edges.find(e=>e.class==='roof');
for(const b of buildings.filter(b=>!b.facilityId&&!b.royalPart))if(distanceToLine(b.position,lowRoofRoute.points)<45){b.heightM=3.3;b.roofHeightM=1;b.lowRoofFabric=true;}

buildings.push(...suburbBuildings);
buildings.push(...royalParts);
// Facility masses sit north of their exact anchor; the anchor remains the door.
for(const f of facilities.filter(f=>f.footprintM[0]&&f.id!=='LOC_CAP_BIG_STORE'))buildings.push({id:`building_${f.id}`,facilityId:f.id,position:f.buildingPosition,widthM:f.footprintM[0],depthM:f.footprintM[1],heightM:f.heightM,district:f.district,color:districts.find(d=>d.id===f.district)?.color});

const furnishings=[];
function furnish(id,position,widthM,depthM,heightM,kind){
 const radius=Math.hypot(widthM,depthM)/2+.5;
 if(edges.some(e=>distanceToLine(position,e.points)<e.widthM/2+radius+1))return;
 if(buildings.some(b=>distance(position,b.position)<radius+Math.hypot(b.widthM,b.depthM)/2))return;
 furnishings.push({id,position,widthM,depthM,heightM,kind,color:kind==='stall'?'#ac7958':kind==='tree'?'#587353':'#a39c83'});
}
for(const space of negativeSpaces){
 if(space.kind==='well')furnish('shared_well',[space.position[0]+.007,space.position[1]-.005],2.8,2.8,.9,'well');
 if(space.kind==='market')for(let i=0;i<18;i++){const a=i/18*Math.PI*2;furnish('market_stall_'+i,[space.position[0]+Math.cos(a)*.058,space.position[1]+Math.sin(a)*.058],4,3,2.6,'stall');}
 if(['court','garden'].includes(space.kind))for(let i=0;i<3;i++){const a=i*2.2;furnish(space.id+'_tree_'+i,[space.position[0]+Math.cos(a)*(space.radiusM-5)/1000,space.position[1]+Math.sin(a)*(space.radiusM-5)/1000],.6,.6,5,'tree');}
}
for(const o of outskirts)if(o.kind!=='farmland')for(let i=0;i<4;i++)furnish(o.id+'_shed_'+i,[o.position[0]+(i%2?1:-1)*(32+i*6)/1000,o.position[1]-Math.floor(i/2)*.025],12+i*2,11,6,'shed');

export const CAPITAL={version:'capital-urban-morphology-pass-4',status:'review-proposal',worldFrame:WORLD,origin:ORIGIN,units:'km',metresPerUnit:1000,walkingSpeedMps:1.4,core,activityEnvelope,atlasSilhouette:{polygon:atlas.points,areaKm2:atlas.areaKm2},suburbBuildings,royalParts,urbanBlocks,districts,nodes,edges,facilities,gates,walls,rivers,bridges,worldConnections,npcFlows,encounterStates,viewpoints,sightCorridors,levelDesignBeats,negativeSpaces,outskirts,furnishings,buildings,contextWaterways:waterways,sourceNotes:['正本IDと広域接続を継承。城丘・王城の量感・街区・副街路・水系曲率は参考画像/PDFに基づく設計提案。','activity envelopeは城壁の相似拡大ではなく、門外街道・河岸物流・郊外・王城背面の利用圏を約22km²で手描き。既存atlas silhouetteは原データを直接参照。','川幅は依頼の通常12–20m・増水22mを優先。既存広域本流は変更せず局所支流を提案。','12施設ID、T10失敗の孤児院用地再利用。建物意匠・副街路は実装提案。','実寸1:1、歩行1.4m/s。距離一覧の時間はマクロ設定であり物理経路から再計算しない。','Kevin Lynch型の認知地図を実地形に落とすため、西門→王城、南大橋→王城、亜人街→魔術塔の視線回廊は建築配置から明示的に抜く。','Deep Researchのcompression/release、prospect/refuge、desire path、social gateをlevelDesignBeatsとして都市topologyに明示する。']};

// Shared graph geometry is immutable. Renderers must copy when reversing/slicing paths.
for(const e of edges){e.points.forEach(Object.freeze);Object.freeze(e.points);Object.freeze(e);}
