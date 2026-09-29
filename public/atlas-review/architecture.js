import {heightAt,landness,biomeAt,routePoints,dist,SITES,RIVERS} from './geography.js';

// One fabric of settlements embedded in a shared terrain; not independent
// scene-sized floor pads. Every building has a terrain-relative real position.
export function buildArchitecture(scene,manifest,B){
 const {MeshBuilder,Vector3,Color3,StandardMaterial,DynamicTexture,Mesh}=B;
 const mat=new Map(),solid=[],labels=[];
 const color=(name,hex,emissive=false)=>{
  if(mat.has(name))return mat.get(name);
  const m=new StandardMaterial(name,scene);
  m.diffuseColor=Color3.FromHexString(hex);m.specularColor=new Color3(.035,.035,.035);
  if(emissive)m.emissiveColor=Color3.FromHexString(hex).scale(.36);
  mat.set(name,m);return m;
 };
 const M={
  stone:color('cream limestone','#ada28b'),white:color('pale granite','#c7c6b6'),
  battlement:color('grey stone','#77766e'),dark:color('dark masonry','#353337'),
  brick:color('old brick','#85594b'),tile:color('red tiled roof','#895343'),
  blue:color('royal slate','#414e66'),wood:color('wood and rigging','#806447'),
  straw:color('farm roof','#a98d54'),sand:color('sandstone','#bca17a'),
  gold:color('gilding','#c6a361'),snow:color('snow masonry','#d0d1c9'),
  elf:color('living timber','#665d3c'),canopy:color('forest','#376540'),
  paleLeaf:color('elven canopy','#83a765'),ember:color('molten rock','#d15a32',true),
  blackRoof:color('black basalt','#272a31'),sea:color('water','#34728a'),
  earth:color('earth','#695e41'),glass:color('magic glass','#4fa9a1',true)
 };
 const y=(x,z)=>heightAt(x,z);
 const V=(x,py,z)=>new Vector3(x,py,z);
 function cuboid(name,x,z,w,d,h,m,collide=false,atY=y(x,z)){
  const mesh=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
  mesh.position=V(x,atY+h/2,z);mesh.material=m;mesh.isPickable=false;
  if(collide&&h>1)solid.push({x,z,w,d});
  return mesh;
 }
 function pillar(name,x,z,r,h,m,collide=false){
  const mesh=MeshBuilder.CreateCylinder(name,{diameter:r*2,height:h,tessellation:8},scene);
  mesh.position=V(x,y(x,z)+h/2,z);mesh.material=m;mesh.isPickable=false;
  if(collide)solid.push({x,z,w:r*1.6,d:r*1.6});return mesh;
 }
 function cone(name,x,z,rx,ry,h,m,py=y(x,z)){
  const mesh=MeshBuilder.CreateCylinder(name,{diameterTop:0,diameterBottom:rx*2,height:h,tessellation:ry||6},scene);
  mesh.position=V(x,py+h/2,z);mesh.material=m;mesh.isPickable=false;return mesh;
 }
 function house(name,x,z,w,d,h,body=M.stone,cap=M.tile,doorFacing='south'){
  const base=y(x,z);cuboid(name,x,z,w,d,h,body,true,base);
  const roof=MeshBuilder.CreateCylinder(name+':roof',{diameterTop:0,diameterBottom:Math.max(w,d)*1.48,height:Math.max(1.4,w*.44),tessellation:4},scene);
  roof.rotation.y=Math.PI/4;roof.position=V(x,base+h+Math.max(1.4,w*.44)*.36,z);roof.material=cap;roof.isPickable=false;
  if(w>=3.4){
   const door=doorFacing==='west'?
    cuboid(name+':door',x-w/2-.06,z,.12,.90,1.8,M.wood,false,base):
    cuboid(name+':door',x,z+d/2+.06,.9,.12,1.8,M.wood,false,base);
   door.isPickable=false;
  }
 }
 function tower(name,x,z,h,r=2,body=M.stone,cap=M.tile){
  pillar(name,x,z,r,h,body,true);
  cone(name+':spire',x,z,r*1.28,8,Math.min(5,h*.45),cap,y(x,z)+h);
 }
 function keep(name,x,z,w,d,h,body=M.white,cap=M.blue){
  house(name,x,z,w,d,h,body,cap);
  for(const dx of [-w/2,w/2])for(const dz of [-d/2,d/2])
   tower(name+':turret',x+dx,z+dz,h+5,1.75,body,cap);
 }
 function wall(name,x,z,w,d,h,body=M.battlement){
  const a=cuboid(name,x,z,w,d,h,body,true);
  const count=Math.max(2,Math.floor(Math.max(w,d)/3));
  for(let i=0;i<count;i++){
   const dx=w>d?(-w/2+(i+.5)*w/count):0;
   const dz=d>w?(-d/2+(i+.5)*d/count):0;
   cuboid(name+':merlon',x+dx,z+dz,w>d?.9:w*.95,d>w?.9:d*.95,.7,body,false,y(x+dx,z+dz)+h-.1);
  }
  return a;
 }
 function lineBridge(name,ax,az,bx,bz,width=4){
  const x=(ax+bx)/2,z=(az+bz)/2,dx=bx-ax,dz=bz-az;
  const length=Math.hypot(dx,dz);
  const plank=cuboid(name,x,z,width,length,.48,M.wood,false,Math.max(y(ax,az),y(bx,bz))+.9);
  plank.rotation.y=Math.atan2(dx,dz);
  for(let i=0;i<5;i++){
   const t=i/4,px=ax+(bx-ax)*t,pz=az+(bz-az)*t;
   pillar(name+':postL',px-dz/length*width*.47,pz+dx/length*width*.47,.13,1.8,M.wood);
   pillar(name+':postR',px+dz/length*width*.47,pz-dx/length*width*.47,.13,1.8,M.wood);
  }
 }
 function flag(name,x,z,h,material=M.gold){
  const mast=pillar(name,x,z,.09,h,M.wood);
  const flag=cuboid(name+':banner',x+.85,z,1.65,.08,.9,material,false,y(x,z)+h-1.2);
  return mast;
 }
 function groundRect(name,x,z,w,d,m){
  const mesh=MeshBuilder.CreateGround(name,{width:w,height:d},scene);
  mesh.position=V(x,y(x,z)+.12,z);mesh.material=m;mesh.isPickable=false;return mesh;
 }
 function labelsFor(region){
  const [x,z]=region.worldPosition,site=SITES[region.id],lift={
   capital:53,trade:25,crime:26,frontier:15,temple:29,farm:20,
   forest:24,elf:52,fortress:35,dwarf:26,blackridge:41
  }[region.id]||20;
  const tex=new DynamicTexture('atlas-label-'+region.id,{width:640,height:124},scene,true);
  tex.hasAlpha=true;
  const ctx=tex.getContext();ctx.clearRect(0,0,640,124);
  ctx.fillStyle='rgba(20,29,31,.89)';ctx.fillRect(8,7,624,110);
  ctx.strokeStyle='#cdb77c';ctx.lineWidth=5;ctx.strokeRect(8,7,624,110);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f4ebcb';
  ctx.font='bold 61px "Yu Mincho","Meiryo",serif';ctx.fillText(region.name,320,67,600);tex.update();
  const material=new StandardMaterial('label-material-'+region.id,scene);
  material.diffuseTexture=tex;material.emissiveColor=new Color3(.69,.69,.69);
  material.useAlphaFromDiffuseTexture=true;material.backFaceCulling=false;
  const mesh=MeshBuilder.CreatePlane('atlas-label:'+region.id,{width:region.name.length>5?38:33,height:7.0},scene);
  mesh.position=V(x,y(x,z)+lift,z);mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;mesh.material=material;mesh.isPickable=false;
  labels.push(mesh);
 }
 const regionMap=new Map(manifest.regions.map(r=>[r.id,r]));
 // The central river is genuinely crossed by roads; bridges sit in the same world.
 lineBridge('southern-stone-bridge',17,54,22,48,4.8);
 lineBridge('eastern-stone-bridge',52,20,61,22,5.6);
 // A walled capital with an occupied city and castle precinct.
 {
  const r=regionMap.get('capital'),[x,z]=r.worldPosition;
  const axis=36;
  groundRect('capital-market',x,z+10,13,10,M.sand);
  wall('capital-north-curtain',x,z-35,70,2.0,6.4,M.white);
  wall('capital-west-curtain',x-35,z,2.0,70,6.4,M.white);
  wall('capital-east-curtain',x+35,z,2.0,70,6.4,M.white);
  // South gate is OPEN between two segments. Unlike a floor pad, the gate
  // connects the continuous world terrain directly into the city.
  wall('capital-south-left',x-20,z+35,30,2.0,6.4,M.white);
  wall('capital-south-right',x+20,z+35,30,2.0,6.4,M.white);
  for(const dx of [-35,35])for(const dz of [-35,35])
   tower('capital-bastion',x+dx,z+dz,16,3.2,M.white,M.blue);
  for(const dz of [-35,35])tower('capital-gate',x-5,z+dz,14,2.1,M.white,M.blue);
  tower('capital-gate',x+5,z+35,14,2.1,M.white,M.blue);
  // Castle proper: tall multi-storey keep, palace wings and courtyards.
  const castleZ=z-14;
  groundRect('royal-precinct',x,castleZ,34,29,M.battlement);
  keep('royal-castle',x,castleZ-4,15,11,27,M.white,M.blue);
  house('palace-west-wing',x-12,castleZ+5,9,9,13,M.white,M.blue);
  house('palace-east-wing',x+12,castleZ+5,9,9,13,M.white,M.blue);
  tower('royal-belfry',x,castleZ-11,36,2.3,M.white,M.gold);
  for(let i=0;i<61;i++){
   const col=i%10,row=Math.floor(i/10),px=x-28+col*6.3+(row%2)*1.4,pz=z-2+row*5.1;
   if(Math.abs(px-x)<4.5||Math.hypot(px-x,pz-(z+10))<9||
      Math.hypot(px-x,pz-castleZ)<19||Math.abs(px-x)>32||pz>z+32)continue;
   const civic=i%13===0,commercial=i%5===0;
   house('capital-block:'+i,px,pz,civic?5.7:3.3+(i%3),commercial?5:3.2,3.5+(i%5)*1.05,
    commercial?M.brick:M.stone,i%4===0?M.blue:M.tile);
  }
  house('capital-cathedral',x-23,z+6,9,12,15,M.white,M.blue);
  tower('capital-cathedral-spire',x-23,z+4,26,2.3,M.white,M.gold);
  flag('royal-standard',x,castleZ-12,39);
 }
 // Western trading city: quays form a harbour edge, not one decorative boat.
 {
  const r=regionMap.get('trade'),[x,z]=r.worldPosition;
  groundRect('trade-market',x+4,z-2,19,13,M.sand);
  const warehouses=31;
  for(let i=0;i<warehouses;i++){
   const px=x-7+(i%6)*4.8+(Math.floor(i/6)%2)*.6,
     pz=z-16+Math.floor(i/6)*7;
   house('trade-district:'+i,px,pz,3.5+(i%4)*.5,4.3,4.2+(i%4)*1.2,
    i%3?M.stone:M.brick,i%4===0?M.blue:M.tile);
  }
  tower('harbour-lighthouse',x-8,z-17,26,2.4,M.white,M.blue);
  house('guild-hall',x+12,z-15,9,9,12,M.brick,M.blue);
  for(let i=0;i<5;i++){
   const pierZ=z-17+i*8,py=y(x-17,pierZ);
   const pier=cuboid('harbour-pier:'+i,x-21,pierZ,27,2.1,.65,M.wood,false,-.42);
   for(let k=0;k<3;k++){
    cuboid('quay-mooring',x-16-k*6,pierZ,.33,.33,1.8,M.wood,false,-.41);
   }
  }
  for(let i=0;i<4;i++){
   const px=x-7,pz=z-15+i*9;
   pillar('harbour-crane-mast',px,pz,.38,11,M.wood);
   const arm=cuboid('harbour-crane-arm',px-2.5,pz,8,.5,.5,M.wood,false,y(px,pz)+10);
  }
 }
 // Crime city grows densely on its own rugged offshore island.
 {
  const r=regionMap.get('crime'),[x,z]=r.worldPosition;
  for(let i=0;i<48;i++){
   const a=i*2.399,radius=3+(i%8)*2.55,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;
   if(landness(px,pz)<.86)continue;
   house('crime-tenement:'+i,px,pz,2.7+(i%3)*.6,2.8+(i%4)*.6,5+(i%5)*1.4,
    i%4?M.dark:M.brick,M.blackRoof);
  }
  keep('island-citadel',x,z-5,13,12,19,M.dark,M.blackRoof);
  tower('smuggler-watch',x+13,z+3,19,2.4,M.dark,M.ember);
  for(let i=0;i<3;i++){
   const px=x+15+i*3,pz=z+11-i*2;
   cuboid('island-smuggling-quay',px,pz,13,2,.65,M.wood,false,-.14);
  }
 }
 // Agricultural village, paddocks and dispersed homesteads.
 {
  const r=regionMap.get('farm'),[x,z]=r.worldPosition;
  for(let i=0;i<24;i++){
   const col=i%6,row=Math.floor(i/6),px=x-32+col*11,pz=z-30+row*13;
   if(Math.hypot(px-x,pz-z)<14)continue;
   groundRect('cultivated-field:'+i,px,pz,8.3,10.1,
    i%3===0?M.earth:i%3===1?M.straw:M.sand);
   for(let j=0;j<4;j++){
    const ridge=cuboid('seed-row',px-3+j*2,pz,.5,8,.15,M.straw,false,y(px-3+j*2,pz)+.10);
   }
  }
  for(let i=0;i<14;i++){
   const a=i*2.399,d=3+(i%5)*2.1,px=x+Math.cos(a)*d,pz=z+Math.sin(a)*d;
   house('farmstead:'+i,px,pz,2.5+(i%3)*.65,3.2,2.7+i%3,M.stone,M.straw);
  }
  house('village-inn',x+8,z-9,7,6,5.4,M.brick,M.tile);
  tower('grain-mill',x-15,z+3,13,1.9,M.stone,M.straw);
  for(let i=0;i<4;i++)cuboid('mill-sail',x-15,z+3,11,.20,.48,M.wood,false,y(x-15,z+3)+12-i*.25).rotation.z=i*Math.PI/4;
 }
 // Frontier has sparse shelter amid open dry country.
 {
  const r=regionMap.get('frontier'),[x,z]=r.worldPosition;
  for(let i=0;i<8;i++){
   const a=i*Math.PI*.72,d=4+(i%3)*2.3;
   house('frontier-hut:'+i,x+Math.cos(a)*d,z+Math.sin(a)*d,2.4,3.1,2.6,M.sand,M.straw);
  }
  tower('frontier-lookout',x+12,z-1,9,1.3,M.wood,M.straw);
  groundRect('caravan-rest',x-8,z+7,9,6,M.earth);
 }
 // Temple precinct: monumental ruins integrated into the southern mesa.
 {
  const r=regionMap.get('temple'),[x,z]=r.worldPosition;
  groundRect('ancient-sanctuary',x,z,31,27,M.sand);
  for(let row=0;row<2;row++)for(let i=0;i<9;i++){
   const px=x-13+i*3.25,pz=z+(row?9:-9);
   pillar('sanctuary-column',px,pz,.67,10+(i%4===0?3:0),M.sand);
   if(i%3===0)cone('fallen-capital',px+1,pz+1,1.3,6,1.1,M.white);
  }
  keep('ancient-inner-shrine',x,z-1,11,10,16,M.sand,M.battlement);
  for(let i=0;i<12;i++)pillar('ancient-processional-pillar',x-16+i*3,z+17,.38,3+(i%2),M.sand);
 }
 // Mountain fortress and dwarf excavations occupy DIFFERENT mountain spaces.
 {
  const r=regionMap.get('fortress'),[x,z]=r.worldPosition;
  wall('northfort-front',x,z+13,35,3,10,M.snow);
  wall('northfort-left',x-16,z,3,27,9,M.snow);
  wall('northfort-right',x+16,z,3,27,9,M.snow);
  for(const dx of [-16,16])for(const dz of [-13,13])
   tower('northfort-watch',x+dx,z+dz,23,3.1,M.snow,M.blue);
  keep('northfort-command',x,z-3,13,10,19,M.battlement,M.blue);
  for(let i=0;i<6;i++)house('northfort-barracks',x-10+(i%3)*9,z+6+Math.floor(i/3)*5,4.5,4,4.5,M.stone,M.blue);
 }
 {
  const r=regionMap.get('dwarf'),[x,z]=r.worldPosition;
  cuboid('dwarven-mountain-gate',x,z-7,21,7,15,M.dark,true);
  cuboid('dwarven-gate-arch',x,z-2.92,7,.5,9,M.blackRoof,false,y(x,z-2.92));
  tower('dwarven-forge-chimney',x+13,z-6,18,2.7,M.battlement,M.blackRoof);
  for(let i=0;i<13;i++){
   const px=x-15+(i%4)*9,pz=z+6+Math.floor(i/4)*5.5;
   house('dwarven-workshop:'+i,px,pz,5.2,4.9,4.3+(i%3),M.battlement,M.blackRoof);
  }
  for(let i=0;i<6;i++)cuboid('mine-ore-cart',x-15+i*5,z+25,3,2,1.2,M.wood);
 }
 // The black ridge is an inhabited fortified society inside volcanic land.
 {
  const r=regionMap.get('blackridge'),[x,z]=r.worldPosition;
  wall('blackridge-wall-n',x,z-23,49,3,8,M.dark);
  wall('blackridge-wall-w',x-24,z,3,46,8,M.dark);
  wall('blackridge-wall-e',x+24,z,3,46,8,M.dark);
  wall('blackridge-wall-s-left',x-14,z+23,21,3,8,M.dark);
  wall('blackridge-wall-s-right',x+14,z+23,21,3,8,M.dark);
  for(const dx of [-24,24])for(const dz of [-23,23])
   tower('blackridge-sentinel',x+dx,z+dz,19,3.1,M.dark,M.blackRoof);
  keep('blackridge-citadel',x,z-10,14,12,26,M.dark,M.blackRoof);
  for(let i=0;i<35;i++){
   const px=x-19+(i%7)*6.1,pz=z+1+Math.floor(i/7)*4.6;
   if(Math.abs(px-x)<7&&pz<z+8)continue;
   house('blackridge-habitation:'+i,px,pz,3.6+(i%2)*.6,3.5,5+(i%4),
    i%3?M.battlement:M.brick,M.blackRoof);
  }
  flag('blackridge-pennant',x,z-18,32,M.ember);
 }
 // Giant world-tree, rope walkways and inhabited platforms are distinct from forest node.
 {
  const r=regionMap.get('forest'),[x,z]=r.worldPosition;
  house('forest-watch-hut',x+5,z-4,6,5,5,M.wood,M.straw);
  tower('hunter-lookout',x-9,z+8,13,1.2,M.wood,M.straw);
 }
 {
  const r=regionMap.get('elf'),[x,z]=r.worldPosition;
  const base=y(x,z);
  pillar('world-tree-trunk',x,z,3.2,39,M.elf,true);
  // Roots penetrate the same ground; leaf clusters build a unique massive crown.
  for(let i=0;i<11;i++){
   const a=i*Math.PI*2/11,rr=(i%3)*2.5+4.5;
   const cx=x+Math.cos(a)*rr,cz=z+Math.sin(a)*rr,cy=base+36+(i%4)*3;
   const leaf=MeshBuilder.CreateSphere('world-tree-canopy:'+i,{diameter:14+(i%3)*4,segments:7},scene);
   leaf.position=V(cx,cy,cz);leaf.scaling.y=.73;leaf.material=i%3?M.paleLeaf:M.canopy;leaf.isPickable=false;
  }
  for(let i=0;i<12;i++){
   const a=i*2.399,rr=9+(i%3)*2.6,px=x+Math.cos(a)*rr,pz=z+Math.sin(a)*rr;
   pillar('elf-home-support',px,pz,.8,6.5,M.elf);
   const h=house('elf-canopy-house:'+i,px,pz,3.3,3.6,3,M.elf,M.canopy);
  }
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3,px=x+Math.cos(a)*8,pz=z+Math.sin(a)*8;
   cuboid('tree-bridge',px,pz,2.5,5,.25,M.wood,false,y(px,pz)+5.7).rotation.y=-a;
  }
  // A waterfall at the eastern cliff is integrated with the surrounding coast.
  const fall=MeshBuilder.CreateCylinder('elven-waterfall',{diameter:2.8,height:17,tessellation:7},scene);
  fall.position=V(188,y(188,-44)-4,-44);fall.material=M.sea;fall.isPickable=false;
 }
 // Signs are geographic, rather than omniscient mission or NPC pins.
 manifest.regions.forEach(labelsFor);
 return {solids:solid,labels,materials:M};
}
// Deterministic instanced vegetation makes the forest a REGION, not a green marker.
export function populateLandscape(scene,manifest,B,{trees=540,rocks=140}={}){
 const {MeshBuilder,Vector3,StandardMaterial,Color3}=B;
 const material=(id,hex)=>{const m=new StandardMaterial(id,scene);m.diffuseColor=Color3.FromHexString(hex);m.specularColor=Color3.Black();return m;};
 const trunkMat=material('forest trunk','#56462f');
 const leafMats=[material('forest leaf','#305c3d'),material('forest green','#477443'),material('pine','#254b40')];
 const trunk=MeshBuilder.CreateCylinder('tree-base',{diameter:.73,height:5,tessellation:6},scene);
 trunk.material=trunkMat;trunk.position.x=10000;
 const foliage=leafMats.map((m,i)=>{const a=MeshBuilder.CreateSphere('foliage-base:'+i,{diameter:4.4,segments:6},scene);a.material=m;a.position.x=10000;return a;});
 const ids=new Map(manifest.regions.map(r=>[r.id,r]));
 const roadPaths=manifest.routes.filter(r=>['R13','R14','R15'].includes(r.id)).map(r=>routePoints(r,ids,72));
 const nearRoad=(x,z)=>{
  for(const path of roadPaths)for(const p of path)if(dist(x,z,p[0],p[2])<3.6)return true;
  return false;
 };
 let planted=0;
 for(let i=0;i<trees*3&&planted<trees;i++){
  const x=55+((i*83.176)%156),z=-88+((i*47.319)%200);
  if(biomeAt(x,z)!=='forest'||landness(x,z)<.98||
     dist(x,z,150,-55)<20||dist(x,z,115,5)<9||nearRoad(x,z))continue;
  const h=5.3+(i%9)*.62,scale=.6+(i%5)*.16,base=heightAt(x,z);
  const t=trunk.createInstance('woodland-trunk:'+i);
  t.position=new Vector3(x,base+h*.29,z);t.scaling=new Vector3(scale,h/5,scale);
  const f=foliage[i%foliage.length].createInstance('woodland-crown:'+i);
  f.position=new Vector3(x,base+h*.79,z);f.scaling=new Vector3(scale*1.68,.8+scale*.19,scale*1.68);
  planted++;
 }
 // Smaller groves outside the eastern rainforest create ecological transitions.
 for(let i=0;i<125;i++){
  const x=-65+((i*37.713)%164),z=-5+((i*19.131)%156);
  if(landness(x,z)<.98||biomeAt(x,z)==='arid'||nearRoad(x,z))continue;
  const h=3.2+(i%5)*.7,base=heightAt(x,z);
  const t=trunk.createInstance('plain-tree-trunk:'+i);t.position=new Vector3(x,base+h*.28,z);t.scaling=new Vector3(.57,h/5,.57);
  const f=foliage[1].createInstance('plain-tree-crown:'+i);
  f.position=new Vector3(x,base+h*.8,z);f.scaling=new Vector3(.61,.6,.61);
 }
 const rockMat=[material('granite','#77766a'),material('frosted stone','#a6a79f'),material('volcanic basalt','#383438'),material('dry sandstone','#a58a64')];
 const source=MeshBuilder.CreateCylinder('rock-template',{diameterTop:0,diameterBottom:3.9,height:5,tessellation:5},scene);
 source.material=rockMat[0];source.position.x=10000;
 const rockSources=rockMat.map((m,i)=>{const s=i===0?source:source.clone('rock-source:'+i);s.material=m;s.position.x=10000;return s;});
 for(let i=0;i<rocks;i++){
  const x=-115+(i*59.61)%331,z=-188+(i*41.39)%357,biome=biomeAt(x,z);
  if(landness(x,z)<.97||biome==='temperate'||biome==='coastal'||biome==='forest'||dist(x,z,35,25)<36)continue;
  const sourceRock=rockSources[biome==='alpine'?1:biome==='volcanic'?2:biome==='arid'?3:0];
  const r=sourceRock.createInstance('landscape-crag:'+i);
  const h=3+(i%9)*1.4;
  r.position=new Vector3(x,heightAt(x,z)+h*.28,z);
  r.scaling=new Vector3(.65+(i%5)*.16,h/5,.7+(i%7)*.13);
 }
 return {treeCount:planted};
}
