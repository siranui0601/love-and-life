/**
 * World geography proposal, not the current authoritative movement/navmesh.
 * Units are kilometres. Origin SW; x east; y north.
 * 48 x 36 = 1,728 km². This model is deliberately independent of art assets.
 */
export const WORLD={widthKm:48,heightKm:36,areaKm2:1728,origin:'south-west',x:'east',y:'north',cellKm:null};

export function areaOf(points){
 let n=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];n+=a[0]*b[1]-b[0]*a[1];}
 return Math.abs(n)/2;
}
export function pointInPolygon(point,poly){
 const [x,y]=point;let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const [xi,yi]=poly[i],[xj,yj]=poly[j];
  if((yi>y)!==(yj>y)&&x<((xj-xi)*(y-yi))/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
export function fitRelative(origin,vertices,target){
 const initial=areaOf(vertices);
 if(!(initial>0&&target>0))throw new Error('Polygon must have positive area');
 const factor=Math.sqrt(target/initial);
 return vertices.map(([x,y])=>[+(origin[0]+x*factor).toFixed(6),+(origin[1]+y*factor).toFixed(6)]);
}
export function fitAbsolute(vertices,target){
 const n=vertices.length,center=vertices.reduce((a,p)=>[a[0]+p[0]/n,a[1]+p[1]/n],[0,0]);
 return fitRelative(center,vertices.map(p=>[p[0]-center[0],p[1]-center[1]]),target);
}

// Shorelines are hand-authored from the supplied reference image, then
// calibrated against the continent/island coverage (not the ornamental 200km bar).
export const mainland=[
 [4.5,32.7],[6.1,34.8],[11.5,35.7],[18,36],[26,36],[34,36],[44,36],[48,35.3],
 [48,14],[47,12.8],[44.2,11.7],[41,11],[38.5,9.6],[36,8.7],[32.5,7.9],
 [30.5,6.2],[27.2,4.8],[25,3.1],[23.9,2],[22.2,.9],[18.7,.5],[17.1,1.7],
 [15.8,3.5],[12.5,5.2],[10.7,7.5],[7.5,8.5],[6.1,10.8],[6.2,13],
 [6.7,15],[6.2,16.2],[5.8,18.3],[7.5,21],[6.7,23.5],[4.5,25.1],[4.2,28.1]
];
export const crimeIsland=fitRelative([4.6,6.8],[
 [-1.1,-.55],[-1.05,-1.06],[-.36,-1.37],[.56,-1.19],[1.29,-.48],
 [1.25,.36],[.63,1.18],[-.26,1.3],[-1.12,.55]
],4.5);

// Area-calibrated macro terrain. Forest is a BIOME, never a settlement point.
// Decorated foothills/fringes overlap other biomes; target values describe core zones.
const forestBase=[
 [28.9,11.6],[31.5,10.8],[35.4,11.4],[38.9,12.1],[42.1,13],
 [45.9,13.3],[47.3,15.5],[47.1,18.8],[46.1,21.8],[44.2,23.8],
 [42.1,25.2],[38.7,25],[35.5,24],[31.6,21.7],[28.8,18],[28.3,14.6]
];
export const terrain=[
 {id:'central-plain',name:'緑の平原・中央耕作地帯',color:'#a9ba83',targetKm2:300,points:fitAbsolute([
  [9,9],[14,8.2],[20,8],[27,8.8],[30,10.5],[31,14],[30.5,18],[28,21],
  [23,23],[18,22.2],[13,20],[10,16],[8.8,12]
 ],300)},
 {id:'coastal-cliffs',name:'西部の岩礁海岸',color:'#989b86',targetKm2:null,points:[
  [4.4,29],[5,26],[8,23],[9.8,20],[8.8,17],[7.8,15],[8.4,12.5],
  [9.3,10],[11.3,7],[14,5.3],[11.7,5.5],[9.2,8.1],[6.5,10.8],
  [6,15],[5.5,18.5],[7,22],[4.3,25]
 ]},
 {id:'dry-plateau',name:'乾きの高原・黄昏の荒野',color:'#dbb77a',targetKm2:260,points:fitAbsolute([
  [18,0],[48,0],[48,12],[44,13],[39,13.7],[35,13],[29,12.2],
  [24,11.1],[20,8],[17.6,4]
 ],260)},
 {id:'northern-range',name:'北の山脈',color:'#8c9899',targetKm2:250,points:fitAbsolute([
  [6.5,23],[8,27],[12,31],[17,35],[23,35.6],[29.5,34],
  [32,31],[30,27],[27,24],[22.5,22.5],[16,22.7],[10,22]
 ],250)},
 {id:'black-ridge',name:'黒の山脈・火山帯',color:'#575760',targetKm2:130,points:fitAbsolute([
  [34,23],[38,24.5],[42,25],[46,26.5],[48,29],[48,36],
  [35.7,36],[33,32],[32.8,27]
 ],130)},
 {id:'emerald-forest',name:'翡翠の森',color:'#3c7554',targetKm2:220,points:fitAbsolute(forestBase,220),category:'terrain-not-settlement'}
];

// Actual settlement footprints are calibrated by SHOELACE area, not scaled icons.
// "森" is deliberately absent: the whole 220km² biome is explorable geography.
const spec=[
 ['capital','王都','royal-city',[25.5,16],3.2,5,[
  [-1.4,-.25],[-1.25,-1],[-.55,-1.3],[.2,-1.4],[1.2,-.88],[1.4,.15],[1.12,.8],[.35,1.25],[-.7,1.08],[-1.35,.45]]],
 ['trade','交易都市','harbour-city',[8.7,17.5],1.8,3,[
  [-.8,-1.15],[.18,-1.45],[.95,-1.03],[1.3,-.1],[1.12,.83],[.28,1.25],[-.67,1.08],[-1.15,.35]]],
 ['blackridge','黒嶺連合領','volcanic-city',[40.5,28.5],2.4,8,[
  [-1.3,-.65],[-.65,-1.25],[.5,-1.15],[1.26,-.65],[1.45,.35],[.65,1.25],[-.3,1.18],[-1.3,.52]]],
 ['crime','犯罪都市','island-city',[4.6,6.8],.85,4.5,[
  [-.61,-.65],[.05,-.85],[.63,-.48],[.7,.14],[.39,.68],[-.24,.7],[-.75,.18]]],
 ['fortress','北陵要塞','mountain-fort',[21.5,31],.4,1.5,[
  [-.55,-.46],[.18,-.6],[.58,-.12],[.51,.51],[-.14,.68],[-.64,.2]]],
 ['dwarf','ドワーフ洞窟','mountain-entrance',[14.2,25.7],.12,3,[
  [-.45,-.27],[.26,-.35],[.47,.1],[.06,.49],[-.43,.27]]],
 ['farm','田園の村','rural-hamlet',[23.8,11.4],.15,6,[
  [-.4,-.23],[.13,-.38],[.47,-.05],[.27,.35],[-.28,.42],[-.52,.08]]],
 ['temple','古代神殿','ruined-sanctuary',[21,5.4],.35,1.2,[
  [-.68,-.3],[-.16,-.6],[.63,-.42],[.75,.15],[.25,.64],[-.53,.49]]],
 ['frontier','辺境の村','outpost',[20.2,1.5],.07,1,[
  [-.3,-.21],[.2,-.34],[.41,.06],[.21,.35],[-.27,.3],[-.44,.04]]],
 ['elf','エルフの隠れ里','forest-community',[43.3,17.3],.3,2,[
  [-.68,-.29],[.12,-.59],[.64,-.24],[.79,.27],[.12,.65],[-.55,.43]]]
];
const envelopeShape=[[-1,-.25],[-.73,-.82],[.13,-1],[.84,-.55],[1,.22],[.48,.89],[-.35,.98],[-.99,.45]];
export const settlements=spec.map(([id,name,type,center,areaKm2,activityKm2,ring])=>({
 id,name,type,center,areaKm2,activityKm2,
 points:fitRelative(center,ring,areaKm2),
 activity:fitRelative(center,envelopeShape,activityKm2)
}));
export const places=[
 ...settlements,
 {id:'forest',name:'森（地形全域）',type:'terrain',center:[35.8,17.9],areaKm2:220,points:terrain.find(t=>t.id==='emerald-forest').points}
];
export const coast={mainlandAreaKm2:areaOf(mainland),islandAreaKm2:areaOf(crimeIsland)};
export const landAreaKm2=coast.mainlandAreaKm2+coast.islandAreaKm2;
export const seaAreaKm2=WORLD.areaKm2-landAreaKm2;

// Author-facing transport geometry; roads represent convenient routes,
// not the only permissible player movement surface.
export const routes=[
 {id:'R01',from:'dwarf',to:'fortress',hours:2,type:'mountain',points:[[14.2,25.7],[15.7,27.2],[18.3,29.4],[21.5,31]]},
 {id:'R02',from:'fortress',to:'blackridge',hours:6,type:'restricted',points:[[21.5,31],[28,30.3],[34.6,29.1],[40.5,28.5]]},
 {id:'R03',from:'trade',to:'fortress',hours:6,type:'mountain',points:[[8.7,17.5],[10,20.6],[12.6,24.3],[17,28.1],[21.5,31]]},
 {id:'R04',from:'trade',to:'dwarf',hours:4,type:'mountain',points:[[8.7,17.5],[9.6,20.7],[11.9,23.1],[14.2,25.7]]},
 {id:'R05',from:'dwarf',to:'blackridge',hours:6,type:'tunnel',points:[[14.2,25.7],[22.7,26.9],[30.1,25.7],[36.8,27.5],[40.5,28.5]]},
 {id:'R06',from:'trade',to:'capital',hours:2,type:'road',points:[[8.7,17.5],[13.5,17.1],[17.4,17.7],[21,16.8],[25.5,16]]},
 {id:'R07',from:'trade',to:'temple',hours:5,type:'road',points:[[8.7,17.5],[11.5,12.9],[15.8,9.8],[18.7,7.5],[21,5.4]]},
 {id:'R08',from:'trade',to:'crime',hours:3,type:'sea',points:[[8.7,17.5],[5.3,15.6],[2.9,12.2],[3.1,9.2],[4.6,6.8]]},
 {id:'R09',from:'temple',to:'frontier',hours:.5,type:'road',points:[[21,5.4],[21.3,4],[20.5,2.5],[20.2,1.5]]},
 {id:'R10',from:'farm',to:'temple',hours:3,type:'road',points:[[23.8,11.4],[22.5,9.7],[21.8,7.7],[21,5.4]]},
 {id:'R11',from:'capital',to:'temple',hours:4,type:'road',points:[[25.5,16],[27.4,12.5],[25.7,9.5],[23,7],[21,5.4]]},
 {id:'R12',from:'capital',to:'farm',hours:1,type:'road',points:[[25.5,16],[24.5,13.7],[23.8,11.4]]},
 {id:'R13',from:'capital',to:'forest',hours:6,type:'road',points:[[25.5,16],[29.1,16.6],[32.2,17.4],[35.8,17.9]]},
 {id:'R14',from:'forest',to:'elf',hours:1/6,type:'hidden',points:[[35.8,17.9],[38.4,18.6],[40.8,18],[43.3,17.3]]},
 {id:'R15',from:'forest',to:'blackridge',hours:5,type:'restricted',points:[[35.8,17.9],[36.9,21],[39,24.8],[40.5,28.5]]}
];
export function exportBlueprint(){
 return {world:WORLD,continent:mainland,island:crimeIsland,coast,landAreaKm2,seaAreaKm2,terrain,settlements,places,routes,
  note:'Forest is a terrain biome (220 km²), not a point settlement. Dimensions are design proposals, not yet adopted by the live game runtime.'};
}
