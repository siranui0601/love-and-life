// Geographic scale and terrain are replaceable overview geometry, not the
// authoritative movement/navmesh or an additional copy of world state.
// Region IDs and R01–R15 route IDs always come from canonical world content.
export const ATLAS_BOUNDS = Object.freeze({minX:-210,maxX:215,minZ:-190,maxZ:210,step:4});
export const ATLAS_SITES = Object.freeze({
 farm:{type:'village',size:6},capital:{type:'capital',size:18},
 trade:{type:'port',size:14},crime:{type:'island',size:11},
 frontier:{type:'village',size:5},temple:{type:'temple',size:13},
 forest:{type:'forest',size:32},elf:{type:'elven',size:9},
 fortress:{type:'fortress',size:12},dwarf:{type:'mine',size:11},
 blackridge:{type:'blackridge',size:15}
});
export const ATLAS_ROUTE_STYLES = Object.freeze({
 R01:'mountain',R02:'restricted',R03:'mountain',R04:'mountain',
 R05:'tunnel',R06:'highway',R07:'wilderness',R08:'sea',
 R09:'pilgrim',R10:'farm',R11:'highway',R12:'farm',
 R13:'forest',R14:'hidden',R15:'restricted'
});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const peak=(x,z,cx,cz,rx,rz)=>Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2)*1.5);
export function atlasLandness(x,z){
 const coast=-110+32*Math.exp(-Math.pow((z+35)/48,2))+8*Math.sin((z+30)/37)+(z>95?-8:0);
 const mainland=smooth(coast-5,coast+5,x)*smooth(-187,-177,z)*(1-smooth(199,210,z));
 const island=1-smooth(13,24,Math.hypot(x+155,z+30));
 return clamp(Math.max(mainland,island),0,1);
}
export function atlasHeight(x,z){
 const land=atlasLandness(x,z);
 const rolling=.26*Math.sin(x*.066)*Math.cos(z*.051)+.15*Math.sin(x*.19+z*.11);
 const north=9*peak(x,z,-61,-147,46,48)+8*peak(x,z,-5,-163,58,34);
 const volcanic=15*peak(x,z,94,-153,55,48)+3*peak(x,z,142,-107,32,39);
 const highland=4*peak(x,z,-28,137,58,45);
 const wooded=1.5*peak(x,z,116,-21,68,77);
 const islandCliff=3*peak(x,z,-155,-30,13,13);
 return -2.2+land*(3.1+rolling+north+volcanic+highland+wooded+islandCliff);
}
export function atlasBiome(x,z){
 if(atlasLandness(x,z)<.38)return 'sea';
 if(Math.hypot(x+155,z+30)<23)return 'island';
 if(x>61&&z< -82)return 'volcanic';
 if(z< -88&&x<75)return 'snow';
 if(x>68&&z<76)return 'forest';
 if(z>107)return 'dry';
 if(x< -60&&z<35)return 'coast';
 return 'meadow';
}
export const ATLAS_COLORS=Object.freeze({
 sea:[.11,.31,.43],island:[.28,.32,.31],volcanic:[.31,.22,.21],
 snow:[.71,.72,.66],forest:[.20,.36,.26],dry:[.68,.56,.37],
 coast:[.52,.56,.39],meadow:[.48,.60,.36]
});
export function atlasRoadPoints(route,from,to,steps=24){
 const ax=from[0],az=from[1],bx=to[0],bz=to[1],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz)||1;
 const bend={R02:-7,R03:7,R04:8,R05:12,R06:4,R07:-9,R08:25,R10:4,R11:-8,R13:8,R15:10}[route.id]||0;
 const sea=ATLAS_ROUTE_STYLES[route.id]==='sea';
 return Array.from({length:steps+1},(_,i)=>{
  const t=i/steps,offset=Math.sin(Math.PI*t)*bend;
  const x=ax+dx*t-dz/length*offset,z=az+dz*t+dx/length*offset;
  return [x,sea?-.22:atlasHeight(x,z)+.30,z];
 });
}
export function auditAtlasContent(content){
 const expected=Object.keys(ATLAS_SITES).sort();
 const actual=(content.regions||[]).map(r=>r.id).sort();
 if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error('Atlas region IDs no longer match canonical world content');
 if((content.routes||[]).length!==15)throw new Error('Atlas route count must be reviewed after content changes');
 const ids=new Set(actual);
 for(const route of content.routes){
  if(!ATLAS_ROUTE_STYLES[route.id]||!ids.has(route.from)||!ids.has(route.to))
   throw new Error('Unknown world atlas route '+route.id);
 }
 return true;
}
