import {Engine} from '@babylonjs/core/Engines/engine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera.js';
import {Vector3,Matrix} from '@babylonjs/core/Maths/math.vector.js';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color.js';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight.js';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight.js';
import {ShadowGenerator} from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {Ray} from '@babylonjs/core/Culling/ray.js';
import {AssetLibrary} from './assets.js';
import {moveBody,distance} from '../../shared/trpg-world/navigation.js';
import {MOVEMENT} from '../../shared/trpg-world/progression.js';

const C=hex=>Color3.FromHexString(hex);
const v=p=>Vector3.FromArray(p);
function creatureAsset(name){return /狼|犬/.test(name)?'animal-dog':/兎/.test(name)?'animal-bunny':/猪|豚/.test(name)?'animal-hog':/鼠/.test(name)?'animal-beaver':/鳥|鷲|蝙蝠/.test(name)?'animal-parrot':/蟹/.test(name)?'animal-crab':/熊/.test(name)?'animal-polar':/スライム/.test(name)?'animal-caterpillar':/竜|獣/.test(name)?'animal-tiger':'animal-fox';}
function enemyModel(name){
 if(/盗賊|山賊|密偵|兵|騎士|刺客|魔術師|司祭|教徒|工作|傭兵|指揮官|暗殺/.test(name))return {path:`characters/character-${/魔術|司祭|教徒/.test(name)?'l':/兵|騎士|指揮官/.test(name)?'j':'a'}.glb`,height:1.85};
 if(/ゴブリン|オーク/.test(name))return {path:'characters/character-m.glb',height:1.65};
 return {path:`creatures/${creatureAsset(name)}.glb`,height:1.1};
}
export class WorldScene {
 constructor(canvas,onFrame){
  this.canvas=canvas;this.engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,adaptToDeviceRatio:false});
  this.engine.setHardwareScalingLevel(Math.max(1,window.devicePixelRatio/1.5));
  this.scene=new Scene(this.engine);this.scene.clearColor=new Color4(.63,.74,.79,1);this.scene.fogMode=Scene.FOGMODE_EXP2;this.scene.fogDensity=.005;
  this.camera=new ArcRotateCamera('camera',Math.PI/2+.3,1.16,25,new Vector3(0,1.4,8),this.scene);this.camera.fov=.95;this.camera.lowerBetaLimit=.3;this.camera.upperBetaLimit=1.45;this.camera.lowerRadiusLimit=5;this.camera.upperRadiusLimit=32;this.camera.wheelPrecision=15;this.camera.minZ=.15;this.camera.attachControl(canvas,true);this.camera.inputs.attached.pointers.buttons=[2];this.camera.keysUp=[];this.camera.keysDown=[];this.camera.keysLeft=[];this.camera.keysRight=[];
  this.ambient=new HemisphericLight('sky',new Vector3(0,1,0),this.scene);this.ambient.intensity=.75;this.ambient.groundColor=C('#333e2d');
  this.sun=new DirectionalLight('sun',new Vector3(-.5,-1,.6),this.scene);this.sun.position=new Vector3(30,55,-20);this.sun.intensity=1.5;
  this.shadows=new ShadowGenerator(1024,this.sun);this.shadows.usePercentageCloserFiltering=true;this.shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;this.shadows.bias=.002;
  this.assets=new AssetLibrary(this.scene);this.actors=new Map();this.decor=[];this.view=null;this.region=null;this.loading=false;this.position=[0,0,8];this.input={x:0,z:0};this.markers=[];
  this.engine.runRenderLoop(()=>{const dt=Math.min(.05,this.engine.getDeltaTime()/1000);onFrame(dt);this.frame(dt);this.scene.render();});
  window.addEventListener('resize',()=>this.engine.resize());
 }
 material(name,hex){const m=new StandardMaterial(name,this.scene);m.diffuseColor=C(hex);m.specularColor=Color3.Black();return m;}
 ground(name,width,depth,pos,color,parent){const m=MeshBuilder.CreateGround(name,{width,height:depth},this.scene);m.position=v(pos);m.material=this.material(name,color);m.receiveShadows=true;m.parent=parent;return m;}
 async prop(path,opt){const a=await this.assets.spawn(path,{...opt,parent:this.regionRoot});this.decor.push(a);for(const m of a.meshes){if((opt.height||opt.size?.[1]||5)<12)this.shadows.addShadowCaster(m);m.metadata.cameraBlock=!!opt.cameraBlock;}return a;}
 async loadRegion(region){
  if(this.region?.id===region.id)return;
  this.loading=true;this.region=region;this.scene.fogColor=C(region.color).scale(.7).add(new Color3(.2,.2,.2));
  this.actors.forEach(a=>a.dispose());this.actors.clear();this.decor.forEach(a=>a.dispose());this.decor=[];this.regionRoot?.dispose();this.regionRoot=new TransformNode(`region:${region.id}`,this.scene);
  this.ground('terrain',region.size+50,region.size+50,[0,-.04,0],region.color,this.regionRoot);
  for(const p of region.terrain?.plots||[])this.ground('field',p.width,p.depth,[p.x,.015,p.z],p.color,this.regionRoot);
  for(const path of region.terrain?.paths||[])for(let i=1;i<path.points.length;i++){
   const a=v(path.points[i-1]),b=v(path.points[i]),d=Vector3.Distance(a,b);const road=this.ground('road',path.width,d,[(a.x+b.x)/2,.025,(a.z+b.z)/2],['city','ruins'].includes(region.biome)?'#b6b3a2':'#b3a181',this.regionRoot);road.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
  }
  for(const water of region.terrain?.water||[]){const mesh=this.ground('water',water.width,water.depth,[water.x,.04,water.z],'#4b8798',this.regionRoot);mesh.material.alpha=.88;mesh.material.specularColor=new Color3(.6,.6,.6);}
  const tasks=[];
  for(const bridge of region.terrain?.bridges||[])tasks.push(this.prop('town/planks.glb',{position:[bridge.x,.02,bridge.z],size:[bridge.width,.15,bridge.depth],name:bridge.id||'bridge'}));
  for(const r of region.terrain?.ridges||[])tasks.push(this.prop('town/rock-large.glb',{position:[r.x,0,r.z],size:[r.radius*2,r.height,r.radius*2],name:'ridge',cameraBlock:true}));
  for(const o of region.objects){
   if(o.buildingPosition){
    const [x,,z]=o.buildingPosition,w=o.width||10,d=o.depth||9,h=o.height||4;
    this.ground(`${o.id}:floor`,w,d,[x,.05,z],'#b8a586',this.regionRoot);
    for(const wall of [{p:[x-w/2,0,z],s:[.35,h,d]},{p:[x+w/2,0,z],s:[.35,h,d]},{p:[x,0,z-d/2],s:[w,h,.35]}])tasks.push(this.prop('town/wall-window-stone.glb',{position:wall.p,size:wall.s,name:o.id,cameraBlock:true}));
    tasks.push(this.prop('town/roof-gable.glb',{position:[x,h,z],size:[w+1,2.1,d+1],name:`${o.id}:roof`,cameraBlock:true}));
    tasks.push(this.prop(o.kind==='shop'?'town/stall-red.glb':'town/stall-bench.glb',{position:[x,0,z-1],height:o.kind==='shop'?2.2:.8,name:'interior'}));
    tasks.push(this.prop('town/lantern.glb',{position:[x-3,2,z+d/2],height:.7,name:'lantern'}));
   }else{
    const path=o.asset==='world-tree'?'town/tree-high.glb':o.asset==='crate'?'town/cart-high.glb':o.kind==='board'?'town/banner-green.glb':o.kind==='trainer'?'town/stall-green.glb':o.kind==='stable'||o.asset==='field'?'town/cart.glb':o.asset==='well'?'town/fountain-round.glb':'town/rock-small.glb';
    tasks.push(this.prop(path,{position:o.position,height:o.asset==='world-tree'?12:o.kind==='board'?2.4:o.asset==='well'?.5:1.4,name:o.id}));
   }
  }
  // Authored placements carry the same trunk footprints used by server navigation.
  for(const tree of region.terrain?.trees||[]){const asset=tree.asset?.includes('/')?tree.asset:`town/${tree.asset||'tree'}.glb`;tasks.push(this.prop(asset,{position:[tree.x,0,tree.z],height:tree.height,rotation:tree.rotation||0,name:tree.id,cameraBlock:true}));}
  for(const portal of region.portals){tasks.push(this.prop('town/poles.glb',{position:portal.position,height:3,name:portal.id}));}
  await Promise.all(tasks);for(const a of this.decor)for(const mesh of a.meshes)mesh.freezeWorldMatrix();this.loading=false;
 }
 async update(view){
  this.view=view;const changed=this.region?.id!==view.region.id;
  if(changed){this.position=[...view.player.position];await this.loadRegion(view.region);}
  if(!this.view||this.view.region.id!==view.region.id)return;
  if(distance(this.position,view.player.position)>3||!this.input.x&&!this.input.z)this.position=[...view.player.position];
  else this.position=this.position.map((p,i)=>p+(view.player.position[i]-p)*.15);
  const entities=[{...view.player,player:true},...(view.npcs||[]),...(view.monsters||[]).map(m=>({...m,monster:true}))];const live=new Set(entities.map(e=>e.id));
  for(const [id,actor] of this.actors)if(!live.has(id)){actor.dispose();this.actors.delete(id);}
  for(const e of entities){
   let a=this.actors.get(e.id);if(a?.pending)continue;
   if(!a){this.actors.set(e.id,{pending:true,dispose(){}});const variants=['a','b','c','e','f','k','m','n','o','p','q'],code=e.player?'q':variants[(parseInt(e.id.replace(/\D/g,''),10)||0)%variants.length];
    const model=e.monster?enemyModel(e.name||''):{path:`characters/character-${code}.glb`,height:1.75};
    a=await this.assets.spawn(model.path,{height:e.boss?model.height*1.6:model.height,name:e.id,position:e.position});
    if(this.view.region.id!==view.region.id){a.dispose();continue;}this.actors.set(e.id,a);a.last=[...e.position];a.root.metadata={entityId:e.id};for(const mesh of a.meshes){mesh.metadata={...mesh.metadata,entityId:e.id};this.shadows.addShadowCaster(mesh);}
   }
   a.entity=e;a.target=[...e.position];a.moving=distance(a.last,e.position)>.08;a.last=[...e.position];
   if(!a.attackUntil||performance.now()>a.attackUntil)a.play(e.hp<=0?'die':a.moving?'walk':e.activity==='睡眠'?'sit':'idle');
  }
  const mode=view.player.mode;if(mode!==this.mountMode&&!this.mountLoading){this.mountLoading=true;this.mount?.dispose();this.mount=null;this.mountMode=mode;
   if(mode==='horse')this.mount=await this.assets.spawn('prototype/animal-horse.glb',{height:2.3,name:'mount',position:this.position});
   else if(mode==='broom')this.mount=await this.assets.spawn('town/poles-horizontal.glb',{size:[.18,.14,2.4],name:'broom-blockout',position:this.position});
   this.mountLoading=false;
  }
 }
 frame(dt){
  if(!this.view||this.loading)return;
  const p=this.view.player,m=MOVEMENT[p.mode]||MOVEMENT.foot,speed=this.input.sprint&&p.stamina>5?(m.sprint||m.speed):m.speed;
  if(this.input.x||this.input.z||this.input.ascend)this.position=moveBody(this.region,this.position,[this.input.x*speed*dt,p.mode==='broom'?(this.input.ascend||0)*5*dt:0,this.input.z*speed*dt]);
  for(const a of this.actors.values()){if(a.pending)continue;const e=a.entity;if(!e)continue;
   const pos=e.player?v(this.position).add(new Vector3(0,p.mode==='horse'?1.25:p.mode==='broom'?.5:0)):v(a.target);
   a.root.position=Vector3.Lerp(a.root.position,pos,Math.min(1,dt*12));a.root.rotation.y=e.player?(this.input.heading??p.heading):e.heading||0;
   if(e.player&&(!a.attackUntil||performance.now()>a.attackUntil))a.play(p.mode!=='foot'?'sit':this.input.x||this.input.z?this.input.sprint?'sprint':'walk':'idle');
  }
  if(this.mount){this.mount.root.position=v(this.position).add(new Vector3(0,p.mode==='broom'?.85:0,0));this.mount.root.rotation.y=this.input.heading??p.heading;this.mount.play(this.input.x||this.input.z?'walk':'static');}
  this.camera.target=Vector3.Lerp(this.camera.target,v(this.position).add(new Vector3(0,1.5,0)),Math.min(1,dt*12));
  const sunPhase=(this.view.time%86400)/86400*Math.PI*2,daylight=Math.max(.08,Math.sin(sunPhase-Math.PI/2));this.sun.intensity=.25+daylight*1.4;this.ambient.intensity=.5+daylight*.45;this.sun.direction=new Vector3(-.5,-Math.max(.3,daylight),.5);this.sun.position=this.camera.target.add(new Vector3(30,45,-25));
  const h=(this.view.time%86400)/3600,night=h<5.5||h>=20;this.scene.clearColor=night?new Color4(.045,.065,.12,1):h<8?new Color4(.70,.73,.66,1):new Color4(.60,.73,.79,1);
  // Sweep the camera arm against actual imported building meshes, leaving the
  // player's preferred zoom intact when a wall temporarily pushes the camera in.
  if(this.camera.radius!==this.lastCameraRadius)this.desiredCameraRadius=this.camera.radius;
  const radius=this.desiredCameraRadius||25,alpha=this.camera.alpha,beta=this.camera.beta;
  const direction=new Vector3(Math.cos(alpha)*Math.sin(beta),Math.cos(beta),Math.sin(alpha)*Math.sin(beta));
  const hit=this.scene.pickWithRay(new Ray(this.camera.target,direction,radius),m=>!!m.metadata?.cameraBlock);
  this.camera.radius=hit?.hit?Math.max(2.5,hit.distance-.6):radius;this.lastCameraRadius=this.camera.radius;
  if(this.view.weather?.type==='storm'||this.view.weather?.type==='rain'){this.scene.fogDensity=.012;this.sun.intensity*=.5;}else this.scene.fogDensity=.004;
  this.weatherFx(dt);
 }
 weatherFx(dt){const wet=['storm','rain','snow'].includes(this.view.weather?.type);if(this.precipitation)this.precipitation.setEnabled(wet);if(!wet)return;
  this.rainTime=(this.rainTime||0)+dt;const snow=this.view.weather.type==='snow';
  const lines=Array.from({length:140},(_,i)=>{const x=this.position[0]+((i*17)%37)-18,z=this.position[2]+((i*23)%39)-19,y=12-((i*.79+this.rainTime*(snow?1.7:12))%12);return[new Vector3(x,y,z),new Vector3(x+(snow?.05:.12),y-(snow?.08:1),z)];});
  this.precipitation=MeshBuilder.CreateLineSystem('precipitation',{lines,updatable:true,instance:this.precipitation},this.scene);this.precipitation.color=new Color3(.78,.85,.9);this.precipitation.alpha=.38;this.precipitation.isPickable=false;
 }
 animateAttack(targetId,magic){const a=this.actors.get('player'),target=this.actors.get(targetId);if(a&&!a.pending){a.play('attack-melee-right');a.attackUntil=performance.now()+550;}if(!target||target.pending)return;
  const beam=MeshBuilder.CreateLines('attack-trail',{points:[v(this.position).add(new Vector3(0,1.2,0)),target.root.position.add(new Vector3(0,.7,0))]},this.scene);beam.color=magic?new Color3(.7,.65,1):new Color3(1,.85,.5);beam.isPickable=false;setTimeout(()=>beam.dispose(),180);
 }
 forward(){const f=this.camera.target.subtract(this.camera.position);f.y=0;return f.normalize();}
 screenPoint(position){return Vector3.Project(v(position),Matrix.IdentityReadOnly,this.scene.getTransformMatrix(),this.camera.viewport.toGlobal(this.engine.getRenderWidth(),this.engine.getRenderHeight()));}
 pick(){return this.scene.pick(this.scene.pointerX,this.scene.pointerY,m=>!!m.metadata?.entityId)?.pickedMesh?.metadata?.entityId;}
 get fps(){return Math.round(this.engine.getFps());}
}
