import {Engine} from '@babylonjs/core/Engines/engine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color.js';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight.js';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import {ATLAS_BOUNDS,ATLAS_SITES,ATLAS_ROUTE_STYLES,ATLAS_COLORS,atlasBiome,atlasHeight,atlasLandness,atlasRoadPoints,auditAtlasContent} from '../../shared/trpg-world/world-atlas-data.js';

// A geographic *overview* built from canonical region positions and route IDs.
// It never feeds terrain, travel time, NPC perception or event status to simulation.
// In particular, drawn roads are readable routes, NOT a ban on off-road walking.
const V=(x,y,z)=>new Vector3(x,y,z);
export function mountWorldAtlas(canvas,content,{currentRegionId}={}){
 auditAtlasContent(content);
 const engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:false,adaptToDeviceRatio:true});
 const scene=new Scene(engine);scene.clearColor=new Color4(.11,.18,.22,1);
 const camera=new ArcRotateCamera('atlas-orbit',Math.PI/2,.45,395,V(-4,1,0),scene);
 camera.fov=.85;camera.lowerBetaLimit=.18;camera.upperBetaLimit=1.25;camera.lowerRadiusLimit=75;camera.upperRadiusLimit=590;
 camera.wheelPrecision=8;camera.panningSensibility=1700;camera.attachControl(canvas,true);
 const ambient=new HemisphericLight('atlas-sky',V(0,1,0),scene);ambient.intensity=.87;ambient.groundColor=new Color3(.16,.20,.23);
 const sun=new DirectionalLight('atlas-sun',V(-.45,-1,.55),scene);sun.intensity=1.15;
 const materials=new Map();
 const material=(name,hex,alpha=1)=>{
  const key=name+hex+alpha;if(materials.has(key))return materials.get(key);
  const m=new StandardMaterial(name,scene);m.diffuseColor=Color3.FromHexString(hex);m.specularColor=Color3.Black();
  m.alpha=alpha;materials.set(key,m);return m;
 };
 const rock=material('stone','#a6a399'),dark=material('darkstone','#4b4645'),roof=material('roof','#81594a');
 const wood=material('timber','#7d674c'),gold=material('gold','#d6b477'),ice=material('snow','#e0dfce');
 const moss=material('tree','#2c5b3a'),leaf=material('leaf','#47754b'),red=material('lava','#b54e37');
 const clay=material('drystone','#bda57b'),water=material('sea','#28576c',.94);
 const box=(name,x,y,z,w,h,d,mat)=>{
  const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);m.position=V(x,y,z);m.material=mat;m.isPickable=false;return m;
 };
 const tower=(name,x,y,z,h,r=1.8,mat=rock,cap=roof)=>{
  const shaft=MeshBuilder.CreateCylinder(name,{diameter:r*2,height:h,tessellation:8},scene);
  shaft.position=V(x,y+h/2,z);shaft.material=mat;shaft.isPickable=false;
  const spire=MeshBuilder.CreateCylinder(name+':spire',{diameterTop:0,diameterBottom:r*2.45,height:r*2.1,tessellation:8},scene);
  spire.position=V(x,y+h+r,z);spire.material=cap;spire.isPickable=false;
 };
 const house=(name,x,y,z,w=3,d=3,h=3,mat=rock,cap=roof)=>{
  box(name,x,y+h/2,z,w,h,d,mat);
  const top=MeshBuilder.CreateCylinder(name+':roof',{diameterTop:0,diameterBottom:Math.max(w,d)*1.48,height:1.8,tessellation:4},scene);
  top.rotation.y=Math.PI/4;top.position=V(x,y+h+.7,z);top.material=cap;top.isPickable=false;
 };
 const tree=(name,x,z,r=1.9,h=5,canopy=leaf)=>{
  const y=atlasHeight(x,z)+.2;
  const trunk=MeshBuilder.CreateCylinder(name+':trunk',{diameter:r*.36,height:h*.55,tessellation:6},scene);
  trunk.position=V(x,y+h*.28,z);trunk.material=wood;trunk.isPickable=false;
  const crown=MeshBuilder.CreateSphere(name+':crown',{diameter:r*2.6,segments:6},scene);
  crown.scaling.y=.9;crown.position=V(x,y+h*.82,z);crown.material=canopy;crown.isPickable=false;
 };
 // Ocean and one continuous height-field: no disconnected per-facility ground.
 const sea=MeshBuilder.CreateGround('continuous-sea',{width:ATLAS_BOUNDS.maxX-ATLAS_BOUNDS.minX+30,height:ATLAS_BOUNDS.maxZ-ATLAS_BOUNDS.minZ+30},scene);
 sea.position=V(2,-.43,10);sea.material=water;sea.isPickable=false;
 const {minX,maxX,minZ,maxZ,step}=ATLAS_BOUNDS,nx=Math.floor((maxX-minX)/step),nz=Math.floor((maxZ-minZ)/step);
 const positions=[],colors=[],indices=[],normals=[];
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  const x=minX+i*step,z=minZ+j*step,y=atlasHeight(x,z),land=atlasLandness(x,z);
  positions.push(x,y,z);
  const col=ATLAS_COLORS[atlasBiome(x,z)];
  const nearestKnown=Math.min(Infinity,...content.regions.map(r=>Math.hypot(x-r.worldPosition[0],z-r.worldPosition[1])));
  const unexplored=Math.min(1,Math.max(0,(nearestKnown-43)/62));
  const shade=(.91+Math.min(.16,Math.max(0,y)*.006))*(1-.70*unexplored);
  colors.push(col[0]*shade,col[1]*shade,col[2]*shade,land<.35?0:1);
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const a=j*(nx+1)+i,b=a+1,c=a+(nx+1),d=c+1;
  indices.push(a,c,b,b,c,d);
 }
 VertexData.ComputeNormals(positions,indices,normals);
 const data=new VertexData();Object.assign(data,{positions,colors,indices,normals});
 const terrain=new Mesh('continuous-geographic-terrain',scene);data.applyToMesh(terrain);
 const terrainMat=new StandardMaterial('atlas-vertex-biomes',scene);
 terrainMat.diffuseColor=Color3.White();terrainMat.specularColor=Color3.Black();
 terrainMat.useVertexColor=true;terrain.material=terrainMat;terrain.isPickable=false;
 // Mountains are terrain first; low-poly crags simply mark the major ranges.
 for(let i=0;i<22;i++){
  const x=-83+(i%11)*12,z=-153+Math.floor(i/11)*21+(i%3)*4;
  const h=4+(i*7%8),m=MeshBuilder.CreateCylinder('northern-peak:'+i,{diameterTop:0,diameterBottom:7+(i%4)*2,height:h,tessellation:5},scene);
  m.position=V(x,atlasHeight(x,z)+h*.18,z);m.material=i%3?rock:ice;m.isPickable=false;
 }
 for(let i=0;i<16;i++){
  const x=67+(i%8)*12,z=-158+Math.floor(i/8)*23+(i%3)*2,h=5+(i*5%10);
  const m=MeshBuilder.CreateCylinder('blackridge-peak:'+i,{diameterTop:0,diameterBottom:8+(i%3)*2,height:h,tessellation:5},scene);
  m.position=V(x,atlasHeight(x,z)+h*.18,z);m.material=i%4===0?red:dark;m.isPickable=false;
 }
 // Rivers follow the terrain. They are landmarks, not a new source of water-state truth.
 for(const [id,coords] of [
  ['capital-river',[[-15,-107],[-8,-63],[15,-26],[40,2],[38,22],[19,48],[-5,83],[-32,117]]],
  ['forest-river',[[90,-72],[83,-36],[99,-2],[93,29],[67,59],[40,78]]]
 ]){
  const points=coords.map(([x,z])=>V(x,atlasHeight(x,z)+.16,z));
  const river=MeshBuilder.CreateTube(id,{path:points,radius:1.5,tessellation:6},scene);
  river.material=material('river','#5b9d9e');river.isPickable=false;
 }
 // Roads reflect the canonical adjacency; they are not the only walkable ground.
 const regions=new Map(content.regions.map(r=>[r.id,r]));
 for(const route of content.routes){
  const a=regions.get(route.from),b=regions.get(route.to),style=ATLAS_ROUTE_STYLES[route.id];
  const pts=atlasRoadPoints(route,a.worldPosition,b.worldPosition);
  const path=pts.map(p=>V(...p));
  const mat=style==='sea'?material('sea-lane','#80bdc4'):
   style==='hidden'?material('hidden-way','#a9c695'):
   style==='restricted'||style==='tunnel'?material('remote-way','#ab88aa'):
   material('road','#cfb482');
  const segments=style==='hidden'||style==='tunnel'?Array.from({length:8},(_,i)=>path.slice(i*3,i*3+3)): [path];
  for(const [i,points] of segments.entries())if(points.length>1){
   const tube=MeshBuilder.CreateTube(route.id+':'+i,{path:points,radius:style==='sea'?.34:.49,tessellation:5},scene);
   tube.material=mat;tube.isPickable=false;
  }
 }
 // Tree cover: biome shapes the broad field; local inhabitants are not spawned here.
 for(let i=0;i<120;i++){
  if(!regions.has('forest'))break;
  const x=69+((i*37)%119),z=-61+((i*47)%118);
  if(atlasBiome(x,z)!=='forest'||Math.hypot(x-150,z+55)<14)continue;
  tree('forest:'+i,x,z,1.1+(i%4)*.22,3.2+(i%5)*.45,i%3?leaf:moss);
 }
 // Farming surrounds the farm settlement; buildings do not all share one size.
 const farm=regions.get('farm');
 for(let i=0;farm&&i<12;i++){
  const [fx,fz]=farm.worldPosition;
  const x=fx-22+(i%4)*10,z=fz-17+Math.floor(i/4)*10;
  const m=MeshBuilder.CreateGround('farm-plot:'+i,{width:7,height:6},scene);
  m.position=V(x,atlasHeight(x,z)+.08,z);m.material=material('harvest',i%2?'#a99a53':'#8b9851');m.isPickable=false;
 }
 function label(name,x,y,z,highlight=false){
  const texture=new DynamicTexture('label:'+name,{width:512,height:96},scene,false);
  texture.hasAlpha=true;
  const ctx=texture.getContext();ctx.clearRect(0,0,512,96);ctx.fillStyle=highlight?'rgba(102,75,35,.96)':'rgba(26,34,31,.91)';
  ctx.fillRect(7,7,498,82);ctx.strokeStyle=highlight?'#f0d59b':'#b6a789';ctx.lineWidth=3;ctx.strokeRect(7,7,498,82);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 43px "Yu Mincho", "Meiryo", sans-serif';ctx.fillStyle='#f3ebd6';ctx.fillText(name,256,49,480);texture.update();
  const m=new StandardMaterial('label-mat:'+name,scene);m.diffuseTexture=texture;m.useAlphaFromDiffuseTexture=true;
  m.emissiveColor=new Color3(.75,.75,.75);m.backFaceCulling=false;m.specularColor=Color3.Black();
  const plane=MeshBuilder.CreatePlane('name:'+name,{width:Math.min(29,9+name.length*3.8),height:5.2},scene);
  plane.position=V(x,y,z);plane.billboardMode=Mesh.BILLBOARDMODE_ALL;plane.material=m;plane.isPickable=false;
 }
 const mark=(x,z,r,col=gold)=>{
  const m=MeshBuilder.CreateCylinder('settlement-foundation',{diameter:r*2.3,height:.44,tessellation:12},scene);
  m.position=V(x,atlasHeight(x,z)+.10,z);m.material=col;m.isPickable=false;
 };
 for(const region of content.regions){
  const [x,z]=region.worldPosition,id=region.id,s=ATLAS_SITES[id],y=atlasHeight(x,z)+.32;
  if(id!=='forest')mark(x,z,s.size,id==='blackridge'?dark:id==='crime'?dark:id==='temple'||id==='frontier'?clay:rock);
  if(id==='capital'){
   // A castle and an actual district hierarchy, not a stall-sized capital.
   box('capital-north-wall',x,y+2.2,z-17,38,4,2,rock);
   box('capital-south-wall',x,y+2.2,z+17,38,4,2,rock);
   box('capital-west-wall',x-18,y+2.2,z,2,4,36,rock);
   box('capital-east-wall',x+18,y+2.2,z,2,4,36,rock);
   for(const dx of [-18,18])for(const dz of [-17,17])tower('capital-wall-tower',x+dx,y,z+dz,7,2.2);
   box('royal-keep',x,y+7,z-7,9,14,8,ice);
   tower('royal-tower-west',x-6,y,z-10,15,2.8,ice,roof);
   tower('royal-tower-east',x+6,y,z-10,15,2.8,ice,roof);
   for(let i=0;i<13;i++)house('capital-district:'+i,x-12+(i%5)*6,y,z+2+Math.floor(i/5)*5,3.2,3.2,3+(i%3),rock,i%2?roof:dark);
  }else if(id==='trade'){
   // Quays, warehouses, merchants and a distinct harbour skyline.
   for(let i=0;i<5;i++)box('trade-quay:'+i,x-12-i*3,y+.18,z-7+i*3,16,.4,1.6,wood);
   for(let i=0;i<10;i++)house('trade-warehouse:'+i,x-7+(i%4)*5,y,z-9+Math.floor(i/4)*6,4,4,3.4,clay,i%2?roof:wood);
   tower('harbour-office',x+9,y,z-7,10,2,rock,roof);
   tower('harbour-lighthouse',x-15,y,z-12,13,2,ice,roof);
  }else if(id==='crime'){
   for(let i=0;i<12;i++)house('island-housing:'+i,x-8+(i%4)*5,y,z-8+Math.floor(i/4)*7,2.7,2.7,3+i%3,dark,i%2?roof:dark);
   tower('island-lookout',x+8,y,z-9,12,2.3,dark,red);
   box('island-dock',x-14,y+.1,z+5,15,.4,3,wood);
  }else if(id==='farm'||id==='frontier'){
   for(let i=0;i<5;i++)house('village:'+id+':'+i,x-5+(i%3)*5,y,z-5+Math.floor(i/3)*6,2.8,3,2.7,id==='frontier'?clay:rock,id==='frontier'?wood:roof);
   tower('village-bell',x+6,y,z-5,5,1.2,wood,roof);
  }else if(id==='temple'){
   for(let i=0;i<10;i++){
    const theta=i/10*Math.PI*2,cx=x+Math.cos(theta)*9,cz=z+Math.sin(theta)*8;
    const pillar=MeshBuilder.CreateCylinder('temple-column:'+i,{diameter:1.2,height:7,tessellation:8},scene);
    pillar.position=V(cx,y+3.5,cz);pillar.material=clay;
   }
   box('ancient-sanctum',x,y+5,z,8,10,7,clay);tower('temple-spire',x,y+10,z,5,1.6,ice,clay);
  }else if(id==='forest'){
   tree('ancient-hunter-grove',x,z,3.5,13,moss);house('hunter-hut',x-9,y,z+8,4,4,3,wood,roof);
  }else if(id==='elf'){
   tree('world-tree',x,z,8,27,leaf);
   for(let i=0;i<7;i++){const a=i/7*Math.PI*2;house('elf-home:'+i,x+Math.cos(a)*7,y,z+Math.sin(a)*7,2.6,2.5,3,wood,moss);}
  }else if(id==='fortress'){
   box('fortress-curtain',x,y+3,z-9,22,6,2,rock);
   box('fortress-west',x-10,y+3,z,2,6,18,rock);
   box('fortress-east',x+10,y+3,z,2,6,18,rock);
   for(const dx of [-10,10])tower('fort-watch',x+dx,y,z-9,12,2.6,ice,dark);
   box('fort-keep',x,y+5,z,8,10,7,ice);
   for(let i=0;i<4;i++)house('fort-barracks:'+i,x-5+(i%2)*10,y,z+5,4,4,3.4,rock,dark);
  }else if(id==='dwarf'){
   box('mine-mouth',x,y+5,z-4,14,10,5,dark);
   box('mine-opening',x,y+2.5,z-1.4,5,5,2,material('mine-mouth-dark','#1b2020'));
   for(let i=0;i<6;i++)house('dwarf-workshop:'+i,x-8+(i%3)*8,y,z+4+Math.floor(i/3)*5,5,4,3,rock,dark);
   tower('forge-chimney',x+8,y,z-7,10,2,dark,roof);
  }else if(id==='blackridge'){
   box('blackridge-keep',x,y+7,z-5,11,14,9,dark);
   for(let i=0;i<4;i++)tower('blackridge-spire:'+i,x+(i%2?9:-9),y,z+(i<2?-9:9),11+(i%2)*3,2,dark,red);
   for(let i=0;i<9;i++)house('blackridge-inhabited-quarter:'+i,x-8+(i%4)*5,y,z+3+Math.floor(i/4)*5,3.5,3,4,rock,dark);
  }
  label(region.name,x,y+(id==='capital'?24:id==='elf'?30:id==='fortress'?19:id==='blackridge'?22:13),z,currentRegionId===id);
  if(currentRegionId===id){
   const ring=MeshBuilder.CreateTorus('current-region',{diameter:s.size*2.45,thickness:.48,tessellation:24},scene);
   ring.position=V(x,y+.24,z);ring.material=gold;ring.isPickable=false;
  }
 }
 const onResize=()=>engine.resize();
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(onResize):null;
 if(observer)observer.observe(canvas);else window.addEventListener('resize',onResize);
 engine.runRenderLoop(()=>scene.render());
 return {dispose(){observer?.disconnect();if(!observer)window.removeEventListener('resize',onResize);engine.stopRenderLoop();scene.dispose();engine.dispose();}};
}
