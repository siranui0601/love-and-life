// Single continuous macro-geography for /atlas-review.
// No gameplay state, pathing permissions, or NPC knowledge is inferred here.
// X is west/east, +Z is south. Positions come from the canonical 11-region manifest.
export const BOUNDS=Object.freeze({minX:-215,maxX:231,minZ:-198,maxZ:222,step:3});
export const SITES=Object.freeze({
 farm:{radius:13,type:'village'},capital:{radius:35,type:'capital'},
 trade:{radius:26,type:'harbour'},crime:{radius:20,type:'island'},
 frontier:{radius:10,type:'frontier'},temple:{radius:19,type:'temple'},
 forest:{radius:58,type:'woodland'},elf:{radius:20,type:'elf'},
 fortress:{radius:20,type:'fortress'},dwarf:{radius:14,type:'mine'},
 blackridge:{radius:25,type:'volcanic-city'}
});
export const COAST=Object.freeze([
 [-98,-176],[-86,-155],[-103,-116],[-93,-75],[-74,-58],[-75,-35],
 [-94,-8],[-106,25],[-97,66],[-92,100],[-105,133],[-87,166],
 [-68,195],[-10,207],[55,208],[109,199],[162,192],[185,175],
 [203,146],[211,106],[210,64],[199,30],[210,-6],[196,-42],
 [202,-82],[178,-120],[160,-157],[136,-181],[60,-186],[-10,-184]
]);
export const ROUTE_WAYPOINTS=Object.freeze({
 R01:[[-48,-120]],R02:[[34,-150],[70,-142]],R03:[[-43,-94],[-61,-65]],
 R04:[[-77,-79],[-63,-52]],R05:[[-12,-135],[42,-144]],
 R06:[[-28,-16],[4,4],[22,18]],R07:[[-85,19],[-65,76],[-54,105]],
 R08:[[-113,-47]],R09:[[-51,148]],R10:[[-20,109]],
 R11:[[-14,97],[9,68],[26,45]],R12:[[12,67],[20,48]],
 R13:[[57,20],[80,13],[103,8]],R14:[[138,-22]],
 R15:[[127,-35],[126,-74],[107,-110]]
});
export const ROUTE_KIND=Object.freeze({
 R01:'mountain',R02:'restricted',R03:'mountain',R04:'mountain',
 R05:'tunnel',R06:'arterial',R07:'pilgrim',R08:'sea',
 R09:'pilgrim',R10:'farm',R11:'arterial',R12:'farm',
 R13:'forest',R14:'hidden',R15:'restricted'
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const smooth=(a,b,t)=>{const k=clamp((t-a)/(b-a),0,1);return k*k*(3-2*k);};
export const dist=(x,z,a,b)=>Math.hypot(x-a,z-b);
export const gaussian=(x,z,a,b,rx,rz)=>Math.exp(-2*((x-a)**2/rx**2+(z-b)**2/rz**2));
const segmented=(x,z,a,b,c,d)=>{
 const dx=c-a,dz=d-b,t=clamp(((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz||1),0,1);
 return Math.hypot(x-a-dx*t,z-b-dz*t);
};
function polygonInside(x,z,polygon){
 let inside=false;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [ax,az]=polygon[i],[bx,bz]=polygon[j];
  if(((az>z)!==(bz>z))&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
 }
 return inside;
}
function edgeDistance(x,z,polygon){
 let d=Infinity;
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length];
  d=Math.min(d,segmented(x,z,...a,...b));
 }
 return d;
}
const islands=[
 [-155,-30,30,30],[-123,49,8,6],[-121,88,5,8],
 [-172,53,5,5],[-143,103,6,4],[-84,199,5,6],
 [-96,-78,4,5],[-126,-91,6,4],[-192,-16,4,3]
];
export function landness(x,z){
 const d=edgeDistance(x,z,COAST),side=polygonInside(x,z,COAST)?1:-1;
 const coastNoise=1.4*Math.sin(x*.17)*Math.cos(z*.23)+.75*Math.sin(x*.39+z*.16);
 let score=smooth(-3.8,3.8,side*d+coastNoise);
 for(const [cx,cz,rx,rz] of islands){
  const theta=Math.atan2((z-cz)/rz,(x-cx)/rx);
  const wobble=.067*Math.sin(theta*7+cz*.01)+.038*Math.sin(theta*13+cx*.02);
  const q=Math.hypot((x-cx)/rx,(z-cz)/rz);
  score=Math.max(score,1-smooth(.89+wobble,1.13+wobble,q));
 }
 return clamp(score,0,1);
}
function rawRelief(x,z){
 const n=.45*Math.sin(x*.075+z*.019)*Math.cos(z*.081)
      +.23*Math.sin(x*.19-z*.14)+.12*Math.cos(x*.35+z*.21);
 const north=15*gaussian(x,z,-32,-157,92,48)
      +8*gaussian(x,z,-85,-122,48,57)
      +5*gaussian(x,z,15,-173,65,35);
 const northCrags=4*Math.max(0,Math.sin(x*.17+z*.13))*gaussian(x,z,-27,-154,119,66);
 const volcano=20*gaussian(x,z,131,-158,49,45)
      +11*gaussian(x,z,81,-160,42,39)
      +6*gaussian(x,z,173,-107,46,43);
 const dry=5*gaussian(x,z,0,161,110,61)
      +3*gaussian(x,z,130,166,90,55);
 const forest=3*gaussian(x,z,131,-2,101,85);
 const islandHigh=4*gaussian(x,z,-155,-30,23,22);
 return 2.2+n+north+northCrags+volcano+dry+forest+islandHigh;
}
const plateauSites=[
 ['capital',35,25,27,38],['trade',-65,-35,19,28],['crime',-155,-30,12,18],
 ['farm',0,90,11,19],['temple',-45,125,15,23],['frontier',-65,175,7,14],
 ['fortress',-15,-120,13,21],['dwarf',-70,-110,10,16],
 ['blackridge',95,-135,19,28],['elf',150,-55,13,20]
];
function relief(x,z){
 let h=rawRelief(x,z);
 for(const [,cx,cz,inner,outer] of plateauSites){
  const d=dist(x,z,cx,cz),weight=1-smooth(inner,outer,d);
  // Plateau centres remain shaped terrain; no raised independent platform.
  if(weight>0)h=h*(1-weight*.92)+rawRelief(cx,cz)*weight*.92;
 }
 return h;
}
export const RIVERS=Object.freeze([
 [[-28,-108],[-17,-88],[-3,-67],[14,-43],[30,-22],[51,1],[56,25],[62,48],[88,70],[127,81],[169,92],[207,106]],
 [[54,26],[29,49],[9,67],[-8,84],[-31,104],[-65,132],[-95,150]]
]);
function riverProximity(x,z){
 let d=Infinity;
 for(const river of RIVERS)for(let i=1;i<river.length;i++)
  d=Math.min(d,segmented(x,z,...river[i-1],...river[i]));
 return d;
}
export function heightAt(x,z){
 const land=landness(x,z);
 const bank=riverProximity(x,z);
 const landHeight=relief(x,z)-1.25*(1-smooth(1.8,8,bank));
 return -3+land*(landHeight+3);
}
export function forestCoverage(x,z){
 const ellipse=((x-134)/88)**2+((z+1)/112)**2;
 const irregular=.12*Math.sin(x*.076+z*.03)+.07*Math.sin(z*.19-x*.10);
 return 1-smooth(.68,1.38,ellipse+irregular);
}
export function biomeAt(x,z){
 if(landness(x,z)<.40)return 'ocean';
 if(dist(x,z,-155,-30)<26)return 'island';
 if(x>47&&z< -91)return 'volcanic';
 if(z< -89&&x<55)return 'alpine';
 if(z>112)return 'arid';
 if(forestCoverage(x,z)>.37)return 'forest';
 if(x< -61&&z<30)return 'coastal';
 return 'temperate';
}
export const BIOMES=Object.freeze({
 ocean:[.10,.25,.33],island:[.30,.35,.30],volcanic:[.32,.24,.22],
 alpine:[.68,.69,.66],forest:[.19,.38,.24],arid:[.69,.53,.34],
 coastal:[.51,.62,.42],temperate:[.51,.62,.36]
});
export function pointAlong(list,t){
 if(list.length===1)return [...list[0]];
 const n=(list.length-1)*clamp(t,0,1),i=Math.min(list.length-2,Math.floor(n)),f=n-i;
 // Catmull-Rom, clamped at endpoints to preserve canonical coordinates.
 const a=list[Math.max(0,i-1)],b=list[i],c=list[i+1],d=list[Math.min(list.length-1,i+2)];
 const interp=k=>.5*((2*b[k])+(-a[k]+c[k])*f
   +(2*a[k]-5*b[k]+4*c[k]-d[k])*f*f+(-a[k]+3*b[k]-3*c[k]+d[k])*f*f*f);
 return [interp(0),interp(1)];
}
export function routePoints(route,byId,count=96){
 const start=byId.get(route.from)?.worldPosition,end=byId.get(route.to)?.worldPosition;
 if(!start||!end)throw new Error('Unknown route endpoints: '+route.id);
 const knots=[start,...ROUTE_WAYPOINTS[route.id]||[],end];
 return Array.from({length:count+1},(_,i)=>{
  const t=i/count,p=i===0?start:i===count?end:pointAlong(knots,t);
  return [p[0],ROUTE_KIND[route.id]==='sea'?-0.30:heightAt(...p)+.12,p[1]];
 });
}
export function assertAtlas(manifest){
 const sites=new Set(Object.keys(SITES));
 if(manifest.regions.length!==11||manifest.routes.length!==15)throw new Error('World must have 11 regions and 15 routes');
 const ids=new Set(manifest.regions.map(r=>r.id));
 if(ids.size!==sites.size||[...ids].some(id=>!sites.has(id)))throw new Error('Atlas region IDs mismatch');
 for(const route of manifest.routes){
  if(!ROUTE_KIND[route.id]||!ids.has(route.from)||!ids.has(route.to))throw new Error('Unexpected route: '+route.id);
 }
 return true;
}
