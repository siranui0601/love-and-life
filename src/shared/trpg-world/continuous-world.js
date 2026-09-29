// One metric graybox, authored from the user's illustrated atlas. These world
// coordinates replace neither historical region-local save positions nor the
// NPC simulation until its streaming migration is implemented.
export const WORLD_BOUNDS={minX:-1250,maxX:1250,minZ:-950,maxZ:950,step:10};
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
export const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453123;return n-Math.floor(n);};
function noise(x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(x-a),v=smooth(z-b);return (hash(a,b)*(1-u)+hash(a+1,b)*u)*(1-v)+(hash(a,b+1)*(1-u)+hash(a+1,b+1)*u)*v;}
const ridge=(x,z,cx,cz,rx,rz)=>Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2)*1.7);
const coast=[[-950,-1110],[-700,-1090],[-450,-1040],[-250,-960],[-100,-930],[80,-850],[200,-890],[360,-735],[550,-620],[740,-530],[900,-260]];
function coastX(z){for(let i=1;i<coast.length;i++)if(z<=coast[i][0]){const a=coast[i-1],b=coast[i],t=clamp((z-a[0])/(b[0]-a[0]));return a[1]+(b[1]-a[1])*t+18*Math.sin(z*.041);}return -260;}
export function landAt(x,z){return (x>coastX(z)&&z<900-45*Math.sin(x*.005))||Math.hypot((x+1060)/1.05,z-455)<105;}
export const rivers=[
 {id:'great-river',width:15,points:[[-135,-510],[-75,-405],[60,-335],[120,-210],[105,-95],[130,10],[250,95],[430,140],[580,160],[740,110],[900,130],[1100,200],[1250,270]]},
 {id:'western-tributary',width:10,points:[[-135,-510],[-220,-350],[-410,-230],[-565,-180],[-720,-155],[-920,-180]]},
 {id:'forest-water',width:10,points:[[770,-485],[825,-300],[730,-165],[770,-25],[800,85],[900,130]]},
];
export function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
const lineDistance=(x,z,points)=>Math.min(...points.slice(1).map((b,i)=>segmentDistance(x,z,points[i],b)));
export const settlements=[
 ['capital','王都',-30,-80,'capital',180,25],['farm','田園の村',-215,205,'village',42,20],
 ['trade','交易都市',-815,-85,'port',120,12],['crime','犯罪都市',-1060,455,'island',77,16],
 ['dwarf','ドワーフ洞窟',-645,-480,'mine',70,90],['fortress','北陵要塞',-185,-690,'fortress',110,130],
 ['blackridge','黒嶺連合領',675,-620,'blackridge',158,100],['forest','森',505,-75,'forest',160,30],
 ['elf','エルフの隠れ里',1040,-85,'elven',68,45],['temple','古代神殿',-300,495,'temple',105,30],
 ['frontier','辺境の村',-210,765,'village',33,20],
].map(([id,name,x,z,type,radius,elevation])=>({id,name,x,z,type,radius,elevation,buildings:[],walls:[],streets:[]}));
const byId=new Map(settlements.map(s=>[s.id,s]));
export function heightAt(x,z){
 if(!landAt(x,z))return -8;
 const island=Math.hypot(x+1060,z-455)<135;
 let h=island?12+10*noise(x*.02,z*.02):9+9*noise(x*.008,z*.008)+4*noise(x*.032,z*.032);
 if(!island){
  h+=160*ridge(x,z,-530,-690,550,215)+115*ridge(x,z,-960,-440,175,320)+145*ridge(x,z,40,-840,400,140);
  h+=155*ridge(x,z,805,-695,410,260)+60*ridge(x,z,1060,-420,190,180);
  h+=48*ridge(x,z,380,600,500,170)+45*ridge(x,z,-480,720,90,160);
  h*=.58+.66*Math.abs(noise(x*.017,z*.017)*2-1);
  h+=16*noise(x*.04,z*.04)*clamp((h-45)/50);
 }
 for(const s of settlements){const d=Math.hypot(x-s.x,z-s.z),influence=1-smooth((d-s.radius*.92)/(s.radius*.45));h=h*(1-influence)+s.elevation*influence;}
 if(!island){const edge=smooth((x-coastX(z))/45);h=1.2+(h-1.2)*edge;}
 return h;
}
export function biomeAt(x,z){
 if(!landAt(x,z))return 'sea';
 if(x>400&&z< -360)return 'volcanic';
 if(z< -540&&heightAt(x,z)>95)return 'snow';
 if(heightAt(x,z)>75)return 'rock';
 if(x>280&&z> -470&&z<350)return 'forest';
 if(z>360)return 'dry';
 if(x<coastX(z)+55)return 'coast';
 return 'meadow';
}
const route=(id,from,to,points,mode='foot',width=5)=>({id,from,to,mode,width,points:[[byId.get(from).x,byId.get(from).z],...points,[byId.get(to).x,byId.get(to).z]]});
export const worldRoutes=[
 route('R01','dwarf','fortress',[[-570,-570],[-430,-610],[-330,-650]]),
 route('R02','fortress','blackridge',[[40,-710],[240,-675],[400,-690]]),
 route('R03','trade','fortress',[[-895,-270],[-870,-430],[-750,-570],[-535,-625],[-360,-620]]),
 route('R04','trade','dwarf',[[-735,-225],[-665,-300],[-690,-385]]),
 route('R05','dwarf','blackridge',[[-380,-490],[-100,-530],[230,-475],[435,-520]],'tunnel',4),
 route('R06','trade','capital',[[-670,-70],[-545,-40],[-370,-75],[-230,-80]],'foot',8),
 route('R07','trade','temple',[[-745,100],[-655,240],[-480,390]]),
 route('R08','trade','crime',[[-1030,60],[-1135,240],[-1160,370]],'ship',7),
 route('R09','temple','frontier',[[-250,610],[-290,690]],'foot',4),
 route('R10','farm','temple',[[-155,280],[-220,375],[-270,450]]),
 route('R11','capital','temple',[[65,145],[35,275],[-100,390]],'foot',7),
 route('R12','capital','farm',[[-145,50],[-110,130]],'foot',7),
 route('R13','capital','forest',[[150,-90],[270,-60],[385,-115]],'foot',5),
 route('R14','forest','elf',[[645,-110],[800,-40],[915,-80]],'foot',3),
 route('R15','forest','blackridge',[[550,-230],[510,-350],[610,-450]],'foot',4),
];

function building(s,id,x,z,w,d,h,kind='house',roof='gable'){
 s.buildings.push({id:`${s.id}:${id}`,x:s.x+x,z:s.z+z,width:w,depth:d,height:h,kind,roof,facing:'south'});
}
function street(s,id,points,width){s.streets.push({id:`${s.id}:${id}`,points:points.map(([x,z])=>[s.x+x,s.z+z]),width});}
function wall(s,id,x,z,w,d,h){s.walls.push({id:`${s.id}:${id}`,x:s.x+x,z:s.z+z,width:w,depth:d,height:h});}
function enclosure(s,w,d,h,gate=18){
 for(const side of [-1,1]){wall(s,`wall-ew-${side}`,side*w/2,0,3,d,h);for(const sign of [-1,1])wall(s,`wall-ns-${side}-${sign}`,sign*(w/4+gate/4),side*d/2,(w-gate)/2,3,h);}
 // Side gates align with the cross street, not an invisible teleport portal.
 s.walls=s.walls.filter(o=>!o.id.includes('wall-ew'));
 for(const side of [-1,1])for(const sign of [-1,1])wall(s,`wall-ew-${side}-${sign}`,side*w/2,sign*(d/4+gate/4),3,(d-gate)/2,h);
 for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])building(s,`tower-${x}-${z}`,x,z,12,12,h+8,'tower','spire');
}
for(const s of settlements){
 if(['capital','port','blackridge','island'].includes(s.type)){
  const large=s.type==='capital',w=large?306:s.type==='blackridge'?260:s.type==='port'?198:125,d=large?278:s.type==='blackridge'?242:s.type==='port'?170:110;
  enclosure(s,w,d,large?13:s.type==='blackridge'?17:9,20);
  street(s,'high-street',[[0,d/2+28],[0,35],[-10,0],[0,-d/2]],large?14:10);
  street(s,'cross-market',[[-w/2-15,0],[w/2+15,0]],9);
  for(const z of [-d*.29,d*.29])street(s,`ward-lane-${z}`,[[-w*.44,z],[w*.44,z]],4);
  for(const x of [-w*.28,w*.28])street(s,`back-lane-${x}`,[[x,-d*.44],[x,d*.44]],3.5);
  let n=0;
  for(let z=-d/2+18;z<d/2-13;z+=16)for(let x=-w/2+17;x<w/2-12;x+=16){
   if(Math.abs(x)<16||Math.abs(z)<13||s.streets.some(r=>lineDistance(s.x+x,s.z+z,r.points)<r.width/2+6))continue;
   if(large&&Math.abs(x)<66&&z< -48||s.type==='blackridge'&&Math.abs(x)<55&&z< -45)continue;
   const t=hash(n,s.x),h=large?8+t*8:s.type==='blackridge'?9+t*10:5+t*7;
   building(s,`block-${n++}`,x,z,10+(n%3)*1.1,11,h,z>0?'shop-house':'house');
  }
  if(large||s.type==='blackridge'){
   building(s,'citadel-hall',0,-87,72,50,large?27:34,'palace','hip');
   building(s,'great-keep',0,-102,30,28,large?64:75,'keep','spire');
   for(const x of [-47,47])for(const z of [-112,-64])building(s,`citadel-tower-${x}-${z}`,x,z,14,14,large?43:48,'tower','spire');
   street(s,'citadel-approach',[[0,0],[0,-52]],12);
  }
  if(s.type==='port'||s.type==='island'){
   for(let k=0;k<4;k++){building(s,`warehouse-${k}`,-w/2-17, -55+k*35,20,25,10,'warehouse');street(s,`quay-${k}`,[[-w/2,-55+k*35],[-w/2-62,-55+k*35]],7);}
   building(s,'lighthouse',-w/2-54,-68,9,9,37,'tower','spire');
  }
 }else if(s.type==='fortress'){
  enclosure(s,156,152,20,20);enclosure(s,90,92,15,14);
  building(s,'command-keep',0,-31,42,34,55,'keep','hip');
  for(const x of [-57,57])for(const z of [-44,5,45])building(s,`barracks-${x}-${z}`,x,z,23,34,14,'barracks');
  street(s,'military-axis',[[0,110],[0,-90]],12);street(s,'drill-access',[[-82,18],[82,18]],9);
 }else if(s.type==='temple'){
  building(s,'sanctum',0,-30,70,48,30,'temple','flat');
  for(const x of [-65,65])building(s,`cloister-${x}`,x,5,17,106,16,'temple','flat');
  for(let x=-50;x<=50;x+=12)for(const z of [-65,65])building(s,`column-${x}-${z}`,x,z,4,4,22,'column','flat');
  street(s,'pilgrim-axis',[[0,120],[0,-75]],12);
 }else if(s.type==='mine'){
  building(s,'mountain-gate',0,-15,45,28,30,'mine','flat');
  for(let i=0;i<14;i++)building(s,`workshop-${i}`,(i%5-2)*19,24+Math.floor(i/5)*19,13,12,7+i%3*2,'warehouse');
  street(s,'ore-road',[[0,75],[0,-30]],8);
 }else if(s.type==='elven'){
  building(s,'world-tree',0,-10,26,26,110,'world-tree','tree');
  for(let i=0;i<15;i++){const a=i*Math.PI*2/15;building(s,`root-house-${i}`,Math.cos(a)*47,Math.sin(a)*47,10,9,6,'tree-house');}
  street(s,'root-path',[[-70,0],[-35,13],[0,30],[38,12],[60,0]],4);
 }else if(s.type==='forest'){
  for(let i=0;i<3;i++)building(s,`camp-${i}`,-20+i*13,8,7,6,3,'camp');
 }else{
  const count=s.id==='farm'?12:7;
  for(let i=0;i<count;i++){const a=i*2.399,r=13+Math.sqrt(i)*8;building(s,`home-${i}`,Math.cos(a)*r,Math.sin(a)*r,7+i%3,6+i%2,3.6+i%3*.5);}
  street(s,'village-lane',[[-s.radius-15,0],[-8,8],[8,-6],[s.radius+12,0]],3);
 }
}
export const forestTrees=[];
for(let i=0;i<1800;i++){
 const x=220+hash(i,19)*930,z=-330+hash(i,93)*640;
 if(biomeAt(x,z)!=='forest'||!landAt(x,z))continue;
 if(settlements.some(s=>s.type!=='forest'&&Math.hypot(x-s.x,z-s.z)<s.radius+16))continue;
 if(worldRoutes.some(r=>r.mode==='foot'&&r.points.slice(1).some((b,j)=>segmentDistance(x,z,r.points[j],b)<r.width+4)))continue;
 forestTrees.push({x,z,h:6+hash(i,42)*15,w:1+hash(i,83)*.9,radius:.65});
}
const solids=settlements.flatMap(s=>[...s.buildings,...s.walls]);
export function canWalk(p,radius=.45){
 const [x,,z]=p;if(x<WORLD_BOUNDS.minX||x>WORLD_BOUNDS.maxX||z<WORLD_BOUNDS.minZ||z>WORLD_BOUNDS.maxZ||!landAt(x,z))return false;
 if(solids.some(b=>Math.abs(x-b.x)<b.width/2+radius&&Math.abs(z-b.z)<b.depth/2+radius))return false;
 if(forestTrees.some(t=>Math.abs(x-t.x)<t.radius+radius&&Math.abs(z-t.z)<t.radius+radius&&Math.hypot(x-t.x,z-t.z)<t.radius+radius))return false;
 const onRoad=worldRoutes.some(r=>r.mode==='foot'&&lineDistance(x,z,r.points)<r.width/2+1)||settlements.some(s=>s.streets.some(r=>lineDistance(x,z,r.points)<r.width/2+1));
 if(rivers.some(r=>lineDistance(x,z,r.points)<r.width*.48)&&!onRoad)return false;
 if(!onRoad&&Math.max(Math.abs(heightAt(x+1,z)-heightAt(x-1,z)),Math.abs(heightAt(x,z+1)-heightAt(x,z-1)))>2.4)return false;
 return true;
}
export function advanceWalker(p,delta){
 const length=Math.hypot(...delta),steps=Math.max(1,Math.ceil(length/.4)),q=[...p];
 for(let i=0;i<steps;i++)for(const axis of [0,2]){const candidate=[...q];candidate[axis]+=delta[axis===0?0:1]/steps;if(canWalk(candidate)){q[axis]=candidate[axis];q[1]=heightAt(q[0],q[2]);}}
 return q;
}
export function walkingStart(id='capital'){
 const s=byId.get(id)||byId.get('capital');
 for(let r=0;r<160;r+=2)for(let i=0;i<16;i++){const x=s.x+Math.cos(i*Math.PI/8)*r,z=s.z+s.radius*.6+Math.sin(i*Math.PI/8)*r;if(canWalk([x,0,z]))return [x,heightAt(x,z),z];}
 throw new Error('No reachable walking start '+id);
}
