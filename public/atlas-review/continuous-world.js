import {BOUNDS,SITES,ROUTE_KIND,RIVERS,BIOMES,COAST,forestCoverage,landness,biomeAt,heightAt,routePoints,pointAlong,assertAtlas,dist,smooth} from './geography.js';
import {buildArchitecture,populateLandscape} from './architecture.js';

// This is one physical coordinate frame and continuous heightfield in the
// standalone spatial review. No scene swaps and no region-to-region teleports.
// Existing RPG saves/NPCs are intentionally not simulated in this preview.
export class ContinuousWorld {
 constructor(canvas,manifest,{onStatus=()=>{}}={}){
  assertAtlas(manifest);
  const B=globalThis.BABYLON;
  if(!B?.Engine)throw new Error('Babylon.js 9.25.0 is required for the world preview.');
  this.B=B;this.canvas=canvas;this.manifest=manifest;this.onStatus=onStatus;
  this.byId=new Map(manifest.regions.map(r=>[r.id,r]));
  const {Engine,Scene,ArcRotateCamera,Vector3,Color3,Color4,HemisphericLight,DirectionalLight,StandardMaterial,MeshBuilder,Mesh,VertexData}=B;
  this.engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:true,adaptToDeviceRatio:true});
  this.engine.setHardwareScalingLevel(Math.max(1,(window.devicePixelRatio||1)/1.5));
  const scene=this.scene=new Scene(this.engine);
  scene.useRightHandedSystem=true; // north-up overview also places east on screen-right.
  scene.clearColor=new Color4(.095,.23,.30,1);
  scene.fogMode=Scene.FOGMODE_NONE;
  this.camera=new ArcRotateCamera('one-world-orbit',Math.PI/2,.44,570,new Vector3(-5,5,6),scene);
  this.camera.fov=.80;
  this.camera.lowerBetaLimit=.12;this.camera.upperBetaLimit=1.48;
  this.camera.lowerRadiusLimit=3.4;this.camera.upperRadiusLimit=790;
  this.camera.panningSensibility=950;this.camera.wheelPrecision=22;
  this.camera.attachControl(canvas,true);
  this.camera.inputs.attached.pointers.buttons=[0,2];
  const ambient=new HemisphericLight('sky fill',new Vector3(0,1,0),scene);
  ambient.intensity=.77;ambient.groundColor=new Color3(.22,.23,.21);
  const sun=new DirectionalLight('sun',new Vector3(-.42,-1,.51),scene);
  sun.position=new Vector3(-120,190,-75);sun.intensity=.88;
  const makeMat=(id,hex,{alpha=1,emissive=false}={})=>{
   const m=new StandardMaterial(id,scene);m.diffuseColor=Color3.FromHexString(hex);
   m.specularColor=new Color3(.026,.026,.026);m.alpha=alpha;
   if(emissive)m.emissiveColor=Color3.FromHexString(hex).scale(.55);
   m.backFaceCulling=false;
   if(['deep blue ocean','busy earthen artery','minor dirt track','woodland path','conditional hidden way','subterranean hint','ferry lane'].includes(id))m.disableLighting=true;
   return m;
  };
  this.mats={
   ocean:makeMat('deep blue ocean','#244b60',{alpha:1}),
   river:makeMat('river water','#4d9aa5',{alpha:.86}),
   highway:makeMat('busy earthen artery','#bfa782'),
   track:makeMat('minor dirt track','#b5a07d'),
   forest:makeMat('woodland path','#a7a07b'),
   hidden:makeMat('conditional hidden way','#86b69a'),
   tunnel:makeMat('subterranean hint','#827081'),
   ferry:makeMat('ferry lane','#b1d7df',{emissive:true}),
   snow:makeMat('snowy stone','#b5b6b0'),
   mountain:makeMat('mountain rock','#6f7068'),
   black:makeMat('black lava rock','#352d32'),
   lava:makeMat('molten lava','#d8512f',{emissive:true}),
   hull:makeMat('ship hull','#76523a'),
   sail:makeMat('sail canvas','#d3c8a8'),
   waypoint:makeMat('location marker','#dfc27b',{emissive:true})
  };
  // Ocean is the only large flat plane; ALL dry land is generated in one mesh.
  const sea=MeshBuilder.CreateGround('continuous-ocean-to-horizon',{width:3200,height:3200},scene);
  sea.position=new Vector3(0,-.78,9);sea.material=this.mats.ocean;sea.isPickable=false;
  // A subdued sea surface, tiled beyond the visible map; no cyan rectangular
  // tabletop surrounding isolated miniature settlements.
  const tex=new B.DynamicTexture('subtle ocean ripples',{width:256,height:256},scene,false);
  const ctx=tex.getContext();ctx.fillStyle='#20475a';ctx.fillRect(0,0,256,256);
  for(let i=0;i<45;i++){
   const x=(i*83)%256,z=(i*47)%256;
   ctx.strokeStyle=i%5===0?'rgba(179,211,203,.15)':'rgba(151,194,197,.07)';
   ctx.lineWidth=i%4===0?1.5:1;
   ctx.beginPath();ctx.moveTo(x,z);ctx.quadraticCurveTo(x+5,z-2,x+11,z);ctx.stroke();
  }
  tex.update();tex.uScale=115;tex.vScale=115;
  this.mats.ocean.diffuseColor=B.Color3.White();
  this.mats.ocean.diffuseTexture=tex;
  this.buildGeography();
  this.buildRivers();
  this.buildShorelines();
  this.buildRoutes();
  this.buildRidges();
  this.architecture=buildArchitecture(scene,manifest,B);
  this.foliage=populateLandscape(scene,manifest,B);
  this.buildFerries();
  this.makePlayer();
  this.keys=new Set();this.walking=false;this.lastHud=0;
  this.previous=performance.now();
  this.keyDown=e=>{
   if(!this.walking||e.target?.matches?.('input,select,textarea'))return;
   if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){
    e.preventDefault();this.keys.add(e.code);
   }
  };
  this.keyUp=e=>this.keys.delete(e.code);
  window.addEventListener('keydown',this.keyDown);
  window.addEventListener('keyup',this.keyUp);
  window.addEventListener('blur',this.blur=()=>this.keys.clear());
  this.resize=()=>this.engine.resize();
  this.observer=typeof ResizeObserver==='function'?new ResizeObserver(this.resize):null;
  if(this.observer)this.observer.observe(canvas);
  else window.addEventListener('resize',this.resize);
  this.engine.runRenderLoop(()=>{
   const dt=Math.min(.065,this.engine.getDeltaTime()/1000);
   this.update(dt);
   scene.render();
  });
  this.onStatus({mode:'overview',location:'世界全体',trees:this.foliage.treeCount});
 }
 buildGeography(){
  const {Mesh,VertexData,StandardMaterial,Color3}=this.B,{minX,maxX,minZ,maxZ,step}=BOUNDS;
  const nx=Math.floor((maxX-minX)/step),nz=Math.floor((maxZ-minZ)/step);
  const positions=[],indices=[],normals=[],colors=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
   const x=minX+i*step,z=minZ+j*step,h=heightAt(x,z),biome=biomeAt(x,z);
   positions.push(x,h,z);
   let tone=BIOMES[biome];
   if(biome==='forest'||biome==='temperate'){
    const green=forestCoverage(x,z),base=BIOMES.temperate,wood=BIOMES.forest;
    tone=base.map((v,k)=>v*(1-green)+wood[k]*green);
   }
   const grain=(Math.sin(x*.39+z*.21)+Math.sin(x*.16-z*.28))*.031;
   const slope=Math.hypot(heightAt(x+.7,z)-h,heightAt(x,z+.7)-h);
   const shade=.99+grain-Math.min(.24,slope*.09)+(biome==='alpine'?Math.min(.18,Math.max(0,h-8)*.012):0);
   colors.push(Math.max(0,tone[0]*shade),Math.max(0,tone[1]*shade),Math.max(0,tone[2]*shade),1);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
   const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
   indices.push(a,b,c,b,d,c);
  }
  VertexData.ComputeNormals(positions,indices,normals);
  const data=new VertexData();Object.assign(data,{positions,indices,normals,colors});
  const mesh=new Mesh('ONE continuous mainland, island and seabed',this.scene);
  data.applyToMesh(mesh);
  const material=new StandardMaterial('regional biome vertex colour',this.scene);
  material.diffuseColor=Color3.White();material.specularColor=Color3.Black();
  material.backFaceCulling=false;mesh.useVertexColors=true;mesh.material=material;mesh.isPickable=false;
  this.terrain=mesh;
 }
 makeRibbon(name,samples,width,material,offset=.10,submerged=false){
  const {VertexData,Mesh}=this.B;
  const positions=[],indices=[],normals=[],uvs=[];
  for(let i=0;i<samples.length;i++){
   const p=samples[i],before=samples[Math.max(0,i-1)],after=samples[Math.min(samples.length-1,i+1)];
   const dx=after[0]-before[0],dz=after[2]-before[2],length=Math.hypot(dx,dz)||1;
   const nx=-dz/length,nz=dx/length;
   for(const side of [-1,1]){
    const x=p[0]+nx*width*.5*side,z=p[2]+nz*width*.5*side;
    const py=submerged?p[1]+offset:heightAt(x,z)+offset;
    positions.push(x,py,z);uvs.push(side===-1?0:1,i/6);
   }
   if(i<samples.length-1){
    const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);
   }
  }
  VertexData.ComputeNormals(positions,indices,normals);
  const data=new VertexData();Object.assign(data,{positions,indices,normals,uvs});
  const mesh=new Mesh(name,this.scene);data.applyToMesh(mesh);
  mesh.material=material;mesh.isPickable=false;return mesh;
 }
 buildRivers(){
  for(let index=0;index<RIVERS.length;index++){
   const samples=Array.from({length:130},(_,i)=>{
    const [x,z]=pointAlong(RIVERS[index],i/129);
    return [x,heightAt(x,z)+.18,z];
   });
   this.makeRibbon('carved-river:'+index,samples,index===0?4.2:2.9,this.mats.river,.14,true);
  }
 }
 buildShorelines(){
  const {MeshBuilder,Vector3,Color3}=this.B;
  const makeLine=(name,points,alpha)=>{
   const l=MeshBuilder.CreateLines(name,{points:points.map(([x,z])=>new Vector3(x,-.69,z))},this.scene);
   l.color=new Color3(.79,.85,.78);l.alpha=alpha;l.isPickable=false;
  };
  // A continuous surf ring follows the real continental coast, not a rectangle.
  const surf=[];
  for(let i=0;i<COAST.length;i++){
   const a=COAST[i],b=COAST[(i+1)%COAST.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
   const steps=Math.max(2,Math.ceil(len/3));
   for(let k=0;k<steps;k++){
    const t=k/steps,wave=Math.sin((i*steps+k)*.81)*.55;
    surf.push([a[0]+dx*t-dz/len*(3.1+wave),a[1]+dz*t+dx/len*(3.1+wave)]);
   }
  }
  if(surf.length>2){surf.push(surf[0]);makeLine('mainland breaking surf',surf,.46);}
  const offshore=[];
  for(let i=0;i<=120;i++){
   const a=i/120*Math.PI*2,r=1+.034*Math.sin(a*7)+.02*Math.sin(a*13);
   offshore.push([-155+Math.cos(a)*30*r,-30+Math.sin(a)*30*r]);
  }
  makeLine('criminal island shore',offshore,.57);
 }
 buildRoutes(){
  const {MeshBuilder,Vector3}=this.B;
  for(const route of this.manifest.routes){
   const type=ROUTE_KIND[route.id],p=routePoints(route,this.byId,125);
   if(type==='sea'){
    for(let i=0;i<p.length-4;i+=8){
     const section=p.slice(i,i+4).map(q=>new Vector3(q[0],-.52,q[2]));
     const ferry=MeshBuilder.CreateTube('R08 maritime course',{path:section,radius:.31,tessellation:5},this.scene);
     ferry.material=this.mats.ferry;ferry.isPickable=false;
    }
    continue;
   }
   const width=['arterial','farm'].includes(type)?3.5:type==='forest'?2.2:1.8;
   const mat=type==='hidden'?this.mats.hidden:type==='tunnel'?this.mats.tunnel:
    type==='forest'?this.mats.forest:type==='arterial'?this.mats.highway:this.mats.track;
   if(type==='tunnel'||type==='hidden'){
    for(let i=0;i<p.length-4;i+=9)this.makeRibbon(route.id+':dashed:'+i,p.slice(i,i+5),width,mat,.22);
   }else this.makeRibbon('road:'+route.id,p,width,mat,.19);
   // Roads have visual clearance, but nothing here constrains exploration to them.
  }
 }
 buildRidges(){
  const {MeshBuilder,Vector3}=this.B;
  // Snowy northern geological spine. Leave real valleys around inhabited sites.
  for(let i=0;i<110;i++){
   const x=-94+(i%22)*11.6,z=-184+Math.floor(i/22)*10.4+(i%4)*1.9;
   if(landness(x,z)<.92||dist(x,z,-15,-120)<19||dist(x,z,-70,-110)<16)continue;
   const height=6+(i*7%15),radius=3.1+(i%5)*1.45;
   const m=MeshBuilder.CreateCylinder('snowy mountain spire:'+i,{diameterBottom:radius*2,diameterTop:0,height,tessellation:5},this.scene);
   m.position=new Vector3(x,heightAt(x,z)+height*.29,z);
   m.material=i%4===0?this.mats.snow:this.mats.mountain;m.isPickable=false;
   if(i%3===0){
    const summit=MeshBuilder.CreateCylinder('frosted peak',{diameterBottom:radius*.9,diameterTop:0,height:height*.36,tessellation:5},this.scene);
    summit.position=new Vector3(x,heightAt(x,z)+height*.91,z);summit.material=this.mats.snow;summit.isPickable=false;
   }
  }
  // The black ridge surrounds an occupied city; volcanic cones are NOT the city.
  for(let i=0;i<49;i++){
   const x=62+(i%10)*13.2,z=-177+Math.floor(i/10)*12+(i%3)*2.5;
   if(landness(x,z)<.93||dist(x,z,95,-135)<30)continue;
   const height=6+(i*11%17);
   const m=MeshBuilder.CreateCylinder('volcanic crag:'+i,{diameterBottom:6+(i%5)*2.5,diameterTop:0,height,tessellation:5},this.scene);
   m.position=new Vector3(x,heightAt(x,z)+height*.27,z);
   m.material=i%7===0?this.mats.lava:this.mats.black;m.isPickable=false;
  }
  // Lava descends from a volcanic crown, above the land's actual heightfield.
  const red=[[130,-158],[143,-151],[153,-137],[157,-125],[166,-117]];
  const sample=[];
  for(let i=0;i<100;i++){
   const [x,z]=pointAlong(red,i/99);sample.push([x,heightAt(x,z)+.30,z]);
  }
  this.makeRibbon('volcano lava flow',sample,2.3,this.mats.lava,.38,true);
  // The southern plateau is stratified dry rock, not a flat tan cutout.
  for(let i=0;i<39;i++){
   const x=5+(i*37.5)%155,z=131+(i*13.7)%65;
   if(landness(x,z)<.96||dist(x,z,-65,175)<18||dist(x,z,-45,125)<25)continue;
   const h=3+(i%4)*1.4;
   const r=MeshBuilder.CreateCylinder('mesa:'+i,{diameterTop:4.3,diameterBottom:6.9,height:h,tessellation:6},this.scene);
   r.position=new Vector3(x,heightAt(x,z)+h*.42,z);
   r.material=this.architecture?.materials?.sand||this.mats.track;r.isPickable=false;
  }
 }
 buildFerries(){
  const {MeshBuilder,Vector3}=this.B;
  const route=this.manifest.routes.find(r=>r.id==='R08'),points=routePoints(route,this.byId,48);
  const positions=[points[9],points[26],points[41],[-84,-37,-36],[-89,-37,-49]];
  positions.forEach((p,i)=>{
   let x=p[0],z=p[2];if(i>2){x=p[0];z=p[2];}
   const ship=MeshBuilder.CreateBox('trade ship hull:'+i,{width:2.8,height:1.2,depth:6.4},this.scene);
   ship.position=new Vector3(x,-.42,z);ship.material=this.mats.hull;ship.isPickable=false;
   const mast=MeshBuilder.CreateCylinder('mast',{diameter:.17,height:7,tessellation:6},this.scene);
   mast.position=new Vector3(x,3.1,z);mast.material=this.mats.hull;mast.isPickable=false;
   const sail=MeshBuilder.CreatePlane('sail',{width:4,height:4.6,sideOrientation:2},this.scene);
   sail.position=new Vector3(x,3.1,z);sail.material=this.mats.sail;sail.isPickable=false;
  });
 }
 makePlayer(){
  const {MeshBuilder,TransformNode,Vector3,StandardMaterial,Color3}=this.B;
  const avatar=this.avatar=new TransformNode('exploration avatar',this.scene);
  const m=new StandardMaterial('traveler garment',this.scene);
  m.diffuseColor=Color3.FromHexString('#e0ba79');m.emissiveColor=Color3.FromHexString('#47371f').scale(.1);
  const torso=MeshBuilder.CreateCapsule('traveler',{height:2,radius:.42},this.scene);
  torso.parent=avatar;torso.position.y=1.15;torso.material=m;
  const head=MeshBuilder.CreateSphere('traveler head',{diameter:.56,segments:9},this.scene);
  head.parent=avatar;head.position.y=2.35;head.material=m;
  avatar.setEnabled(false);
  this.position=new Vector3(0,heightAt(0,90)+.1,110);
 }
 focus(id,radius){
  const region=this.byId.get(id);if(!region)return;
  this.walking=false;this.keys?.clear();this.avatar?.setEnabled(false);
  const [x,z]=region.worldPosition;
  this.camera.target=new this.B.Vector3(x,heightAt(x,z)+10,z);
  this.camera.radius=radius||({capital:112,trade:96,forest:125,blackridge:109}[id]||74);
  this.camera.alpha=Math.PI/2+.32;this.camera.beta=.82;
  this.architecture.labels.forEach(l=>l.setEnabled(true));
  this.onStatus({mode:'focus',location:region.name});
 }
 overview(){
  this.walking=false;this.keys?.clear();this.avatar?.setEnabled(false);
  this.camera.target=new this.B.Vector3(-3,7,6);
  this.camera.radius=570;this.camera.beta=.44;this.camera.alpha=Math.PI/2;
  this.camera.panningSensibility=950;
  this.architecture.labels.forEach(l=>l.setEnabled(true));
  this.onStatus({mode:'overview',location:'世界全体'});
 }
 walk(id='farm'){
  const region=this.byId.get(id)||this.byId.get('farm'),[x,z]=region.worldPosition;
  const offset={capital:[0,45],trade:[6,23],crime:[-4,13],farm:[5,20],
   frontier:[1,14],temple:[-2,25],forest:[-2,10],elf:[-7,21],
   fortress:[0,27],dwarf:[5,23],blackridge:[0,31]}[region.id]||[0,12];
  const px=x+offset[0],pz=z+offset[1],py=heightAt(px,pz);
  this.position=new this.B.Vector3(px,py,pz);this.avatar.position.copyFrom(this.position);
  this.avatar.setEnabled(true);this.walking=true;this.keys.clear();
  this.camera.target=new this.B.Vector3(px,py+1.6,pz);
  this.camera.radius=16;this.camera.beta=1.1;this.camera.alpha=Math.PI/2;
  this.camera.panningSensibility=0;
  this.architecture.labels.forEach(l=>l.setEnabled(false));
  this.onStatus({mode:'walk',location:region.name,position:[px,pz]});
  this.canvas.focus();
 }
 walkable(nx,nz,oldX,oldZ){
  if(nx<BOUNDS.minX+4||nx>BOUNDS.maxX-4||nz<BOUNDS.minZ+4||nz>BOUNDS.maxZ-4)return false;
  if(landness(nx,nz)<.63)return false; // coast and sea are physical barriers, never road boundaries
  const old=heightAt(oldX,oldZ),h=heightAt(nx,nz),step=Math.hypot(nx-oldX,nz-oldZ);
  if(step>.001&&Math.abs(h-old)/step>1.04)return false;
  for(const o of this.architecture.solids){
   if(Math.abs(nx-o.x)<o.w/2+.48&&Math.abs(nz-o.z)<o.d/2+.48)return false;
  }
  return true;
 }
 update(dt){
  if(!this.walking)return;
  const k=this.keys,fore=(k.has('KeyW')||k.has('ArrowUp')?1:0)-(k.has('KeyS')||k.has('ArrowDown')?1:0),
   side=(k.has('KeyD')||k.has('ArrowRight')?1:0)-(k.has('KeyA')||k.has('ArrowLeft')?1:0);
  if(!fore&&!side)return;
  const cameraF=this.camera.target.subtract(this.camera.position);cameraF.y=0;cameraF.normalize();
  const length=Math.hypot(fore,side)||1,velocity=(k.has('ShiftLeft')||k.has('ShiftRight')?13:7)*dt/length;
  const dx=(cameraF.x*fore-cameraF.z*side)*velocity;
  const dz=(cameraF.z*fore+cameraF.x*side)*velocity;
  const x=this.position.x,z=this.position.z;
  const tryMove=(nx,nz)=>{if(this.walkable(nx,nz,this.position.x,this.position.z)){this.position.x=nx;this.position.z=nz;}};
  tryMove(x+dx,z+dz);
  if(this.position.x===x&&this.position.z===z){
   tryMove(x+dx,z);tryMove(this.position.x,z+dz);
  }
  this.position.y=heightAt(this.position.x,this.position.z);
  const target=new this.B.Vector3(this.position.x,this.position.y+1.6,this.position.z);
  this.avatar.position.copyFrom(this.position);
  this.avatar.rotation.y=Math.atan2(dx,dz);
  this.camera.target=this.B.Vector3.Lerp(this.camera.target,target,Math.min(1,dt*10));
  this.lastHud+=dt;
  if(this.lastHud>.32){
   this.lastHud=0;
   const nearest=[...this.byId.values()].sort((a,b)=>
    dist(this.position.x,this.position.z,...a.worldPosition)-dist(this.position.x,this.position.z,...b.worldPosition))[0];
   const d=dist(this.position.x,this.position.z,...nearest.worldPosition);
   this.onStatus({mode:'walk',location:d<SITES[nearest.id].radius?nearest.name:'野外',position:[this.position.x,this.position.z]});
  }
 }
 dispose(){
  this.engine.stopRenderLoop();this.observer?.disconnect();
  if(!this.observer)window.removeEventListener('resize',this.resize);
  window.removeEventListener('keydown',this.keyDown);
  window.removeEventListener('keyup',this.keyUp);
  window.removeEventListener('blur',this.blur);
  this.scene.dispose();this.engine.dispose();
 }
}
