import {Engine} from '@babylonjs/core/Engines/engine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera.js';
import {Vector3,Matrix,Quaternion} from '@babylonjs/core/Maths/math.vector.js';
import {Color3,Color4} from '@babylonjs/core/Maths/math.color.js';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight.js';
import {DirectionalLight} from '@babylonjs/core/Lights/directionalLight.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import {WORLD_BOUNDS,settlements,worldRoutes,rivers,landAt,heightAt,biomeAt,hash,canWalk,walkingStart,advanceWalker,forestTrees} from '../../shared/trpg-world/continuous-world.js';

const V=(x,y,z)=>new Vector3(x,y,z);
const COLOR={sea:'#173e58',meadow:'#778752',coast:'#b1a175',forest:'#315f41',rock:'#777369',snow:'#d6d8d5',volcanic:'#473e3d',dry:'#bc9c6a'};
const L=(v,a,b)=>Math.max(a,Math.min(b,v));
export function createContinuousWorld(canvas,{onChange=()=>{}}={}){
 const engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:false});
 const scene=new Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new Color4(.19,.30,.37,1);
 const camera=new ArcRotateCamera('shared-world-camera',Math.PI/2,.42,2250,V(-80,0,0),scene);
 camera.fov=.9;camera.minZ=.2;camera.maxZ=8000;camera.lowerRadiusLimit=6;camera.upperRadiusLimit=4400;
 camera.lowerBetaLimit=.12;camera.upperBetaLimit=1.48;camera.wheelPrecision=38;camera.panningSensibility=1300;
 camera.attachControl(canvas,true);
 const hemi=new HemisphericLight('daylight',V(0,1,0),scene);hemi.intensity=.86;hemi.groundColor=Color3.FromHexString('#353a34');
 const sun=new DirectionalLight('afternoon',V(-.53,-1,.36),scene);sun.intensity=1.28;
 const matCache=new Map();
 function mat(key,color,alpha=1){if(matCache.has(key))return matCache.get(key);const m=new StandardMaterial(key,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=Color3.Black();m.alpha=alpha;m.backFaceCulling=false;matCache.set(key,m);return m;}
 const palette={stone:mat('cut-stone','#b4a895'),dark:mat('basalt','#403b3c'),tile:mat('terra-roof','#8d5041'),wood:mat('timber','#806244'),sand:mat('sandstone','#bba17c'),snow:mat('ice-stone','#d1d0c7'),leaf:mat('leaf','#3b6749'),gold:mat('royal-trim','#bca471'),lava:mat('lava','#b54a31'),water:mat('deep-water','#204b60',1),river:mat('river-water','#5c9aaf',.92),road:mat('road','#c5ad7e'),ship:mat('ship','#c6d5d1'),night:mat('cave','#22232b')};
 function box(n,x,y,z,w,h,d,m){const o=MeshBuilder.CreateBox(n,{width:w,height:h,depth:d},scene);o.position=V(x,y,z);o.material=m;o.isPickable=false;return o;}
 function cone(n,x,y,z,r,h,m,tess=5){const o=MeshBuilder.CreateCylinder(n,{diameterTop:0,diameterBottom:r*2,height:h,tessellation:tess},scene);o.position=V(x,y+h/2,z);o.material=m;o.isPickable=false;return o;}
 const sea=MeshBuilder.CreateGround('one-ocean',{width:2550,height:1950},scene);sea.position=V(0,-1.4,0);sea.material=palette.water;sea.isPickable=false;
 const {minX,maxX,minZ,maxZ,step}=WORLD_BOUNDS;
 const nx=Math.round((maxX-minX)/step),nz=Math.round((maxZ-minZ)/step),pos=[],indices=[],normals=[],colors=[];
 const shadeMap=Object.fromEntries(Object.entries(COLOR).map(([key,color])=>[key,Color3.FromHexString(color)]));
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){const x=minX+i*step,z=minZ+j*step,y=heightAt(x,z),biome=biomeAt(x,z),c=shadeMap[biome]||shadeMap.meadow;
  const k=.91+.09*hash(i*.5,j*.5);pos.push(x,y,z);colors.push(c.r*k,c.g*k,c.b*k,1);
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.push(a,b,c,b,d,c);}
 VertexData.ComputeNormals(pos,indices,normals);const data=new VertexData();Object.assign(data,{positions:pos,indices,normals,colors});
 const land=new Mesh('one-continuous-landmass',scene);data.applyToMesh(land);const groundMat=new StandardMaterial('biome-vertex-colour',scene);groundMat.diffuseColor=Color3.White();groundMat.specularColor=Color3.Black();groundMat.useVertexColor=true;groundMat.backFaceCulling=true;land.material=groundMat;land.isPickable=false;
 // Surface features are sampled against the SAME height function, not isolated region floors.
 function trace(points,{width=4,material=palette.road,mode='surface'}={}){
  const lines=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let k=0;k<Math.max(1,Math.ceil(d/8));k++){const t=k/Math.max(1,Math.ceil(d/8));lines.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}lines.push(points.at(-1));
  const p=[],uv=[],ix=[];for(let i=0;i<lines.length;i++){const a=lines[Math.max(0,i-1)],b=lines[Math.min(lines.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1,[x,z]=lines[i],yy=mode==='sea'?-1.03:heightAt(x,z)+.66;
   p.push(x-dz/len*width/2,yy,z+dx/len*width/2,x+dz/len*width/2,yy,z-dx/len*width/2);uv.push(0,i,1,i);
   if(i){const k=i*2;ix.push(k-2,k,k-1,k-1,k,k+1);}
  }
  const vd=new VertexData();Object.assign(vd,{positions:p,indices:ix,uvs:uv});const mesh=new Mesh('surface-track',scene);vd.applyToMesh(mesh);mesh.material=material;mesh.isPickable=false;return mesh;
 }
 for(const r of rivers)trace(r.points,{width:r.width,material:palette.river});
 for(const road of worldRoutes)if(road.mode!=='tunnel'){trace(road.points,{width:road.width,material:road.mode==='ship'?palette.ship:palette.road,mode:road.mode==='ship'?'sea':'surface'});}
 // Dense geographic vegetation is batched, not one WebGL draw call per tree.
 const trunks=[],canopies=[];
 for(const {x,z,h,w} of forestTrees){const y=heightAt(x,z);
  trunks.push(...Matrix.Compose(V(w,h*.65,w),Quaternion.Identity(),V(x,y+h*.325,z)).toArray());
  canopies.push(...Matrix.Compose(V(h*.52,h*.64,h*.52),Quaternion.Identity(),V(x,y+h*.78,z)).toArray());
 }
 const trunk=MeshBuilder.CreateCylinder('forest-trunks',{diameter:1,height:1,tessellation:5},scene);trunk.material=palette.wood;trunk.thinInstanceSetBuffer('matrix',new Float32Array(trunks),16,true);trunk.thinInstanceRefreshBoundingInfo(true);trunk.alwaysSelectAsActiveMesh=true;
 const crown=MeshBuilder.CreateSphere('forest-canopies',{diameter:1,segments:5},scene);crown.material=palette.leaf;crown.thinInstanceSetBuffer('matrix',new Float32Array(canopies),16,true);crown.thinInstanceRefreshBoundingInfo(true);crown.alwaysSelectAsActiveMesh=true;crown.metadata={treeCount:canopies.length/16};
 // Working and cultivated land expands well beyond the twelve buildings of the farm.
 const farm=settlements.find(s=>s.id==='farm');
 for(let row=-5;row<=5;row++)for(let col=-5;col<=5;col++){if(Math.abs(row)<2&&Math.abs(col)<2)continue;const x=farm.x+col*32,z=farm.z+row*28;if(!landAt(x,z)||Math.hypot(x-farm.x,z-farm.z)<farm.radius)continue;
  const p=MeshBuilder.CreateGround('farm-working-parcel',{width:27,height:22},scene);p.position=V(x,heightAt(x,z)+.48,z);p.material=mat('field-'+((row*13+col+44)%4),['#99894d','#a7a05c','#786d3f','#667c46'][Math.abs(row*13+col+44)%4]);p.isPickable=false;
 }
 // Settlement composition follows the metric authoring, not the old atlas-symbol radii.
 function structure(s,b){const x=b.x,z=b.z,y=heightAt(x,z),w=b.width,d=b.depth,h=b.height;
  const basal=s.type==='blackridge'||s.type==='island'?palette.dark:s.type==='temple'||s.type==='village'&&s.id==='frontier'?palette.sand:s.type==='fortress'||s.type==='mine'?palette.snow:palette.stone;
  if(b.kind==='world-tree'){box(b.id+':trunk',x,y+h*.35,z,w*.34,h*.7,d*.36,palette.wood);const a=MeshBuilder.CreateSphere(b.id+':crown',{diameter:1,segments:9},scene);a.scaling=V(w*2.2,h*.35,d*2.2);a.position=V(x,y+h*.86,z);a.material=palette.leaf;return;}
  if(b.kind==='column'){const c=MeshBuilder.CreateCylinder(b.id,{diameter:3,height:h,tessellation:8},scene);c.position=V(x,y+h/2,z);c.material=basal;return;}
  if(b.kind==='mine'){box(b.id,x,y+h/2,z,w,h,d,palette.dark);box(b.id+':entry',x,y+7,z+d/2+.15,17,14,1,palette.night);return;}
  box(b.id,x,y+h/2,z,w,h,d,basal);
  if(b.kind==='tower'||b.kind==='keep'){cone(b.id+':spires',x,y+h,z,Math.min(w,d)*.65,Math.max(7,h*.31),s.type==='blackridge'?palette.lava:palette.tile);return;}
  if(b.roof==='flat')return;
  if(b.roof==='gable'||b.roof==='hip'){const roof=MeshBuilder.CreateCylinder(b.id+':roof',{diameterTop:0,diameterBottom:Math.max(w,d)*1.43,height:Math.min(6,h*.35),tessellation:4},scene);roof.rotation.y=Math.PI/4;roof.position=V(x,y+h+2,z);roof.material=s.type==='blackridge'?palette.dark:palette.tile;}
 }
 for(const s of settlements){for(const b of s.buildings)structure(s,b);
  for(const w of s.walls){box(w.id,w.x,heightAt(w.x,w.z)+w.height/2,w.z,w.width,w.height,w.depth,s.type==='blackridge'?palette.dark:palette.stone);}
  for(const r of s.streets)trace(r.points,{width:r.width,material:palette.road});
  if(s.type==='fortress')for(let k=0;k<7;k++)cone('northern-spur',s.x-160+k*42,heightAt(s.x-160+k*42,s.z-110)-5,s.z-110,15,28+hash(k,13)*30,palette.snow);
  if(s.type==='port'||s.type==='island'){const sign=s.type==='port'?1:.8;for(let i=0;i<3;i++){const x=s.x-155*sign-i*11,z=s.z-55+i*35;box('harbour-pier',x,heightAt(x,z)+1,z,45,2,5,palette.wood);}}
  if(s.type==='blackridge'){for(let i=0;i<8;i++)cone('igneous-peak',s.x-215+i*68,heightAt(s.x-215+i*68,s.z-180)-12,s.z-180,29,55+hash(i,55)*45,i%3===0?palette.lava:palette.dark);}
 }
 function sign(s){const t=new DynamicTexture('region-label:'+s.id,{width:512,height:100},scene,false);const ctx=t.getContext();ctx.clearRect(0,0,512,100);ctx.fillStyle='#10202edc';ctx.fillRect(0,4,512,88);ctx.strokeStyle='#e7ce8c';ctx.lineWidth=5;ctx.strokeRect(3,7,506,82);ctx.fillStyle='#f6eaca';ctx.font='bold 44px Meiryo, sans-serif';ctx.textAlign='center';ctx.fillText(s.name,256,67,480);t.hasAlpha=true;t.update();const m=new StandardMaterial('sign-mat:'+s.id,scene);m.diffuseTexture=t;m.useAlphaFromDiffuseTexture=true;m.emissiveColor=new Color3(.8,.8,.8);m.backFaceCulling=false;const p=MeshBuilder.CreatePlane('region:'+s.id,{width:Math.max(112,s.name.length*22),height:30},scene);p.position=V(s.x,heightAt(s.x,s.z)+Math.max(31,s.type==='capital'?94:s.type==='elven'?137:45),s.z);p.billboardMode=Mesh.BILLBOARDMODE_ALL;p.material=m;}
 for(const s of settlements)sign(s);
 const keys=new Set(),avatar=MeshBuilder.CreateCapsule('traveller',{height:1.8,radius:.43,tessellation:8},scene);avatar.material=palette.gold;avatar.isVisible=false;
 let walking=false,position=walkingStart('farm'),disposed=false;
 const onDown=e=>{if(['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'].includes(e.code)){keys.add(e.code);if(walking)e.preventDefault();}};
 const onUp=e=>keys.delete(e.code),onBlur=()=>keys.clear(),resize=()=>engine.resize();
 window.addEventListener('keydown',onDown);window.addEventListener('keyup',onUp);window.addEventListener('blur',onBlur);
 const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;if(observer)observer.observe(canvas);else window.addEventListener('resize',resize);
 function setWalk(value,startId='farm'){walking=!!value;keys.clear();avatar.isVisible=walking;camera.inertia=walking?.45:.85;
  if(walking){position=walkingStart(startId);avatar.position=V(position[0],position[1]+.9,position[2]);camera.target.copyFrom(V(position[0],position[1]+1.5,position[2]));camera.beta=1.15;camera.radius=19;camera.inertialRadiusOffset=0;camera.panningSensibility=0;}
  else{camera.target.copyFrom(V(-80,0,0));camera.beta=.42;camera.radius=2250;camera.inertialRadiusOffset=0;camera.panningSensibility=1300;}
  onChange({walking,position:[...position],region:settlements.reduce((a,b)=>Math.hypot(position[0]-a.x,position[2]-a.z)<Math.hypot(position[0]-b.x,position[2]-b.z)?a:b).name});
 }
 engine.runRenderLoop(()=>{if(disposed)return;const dt=Math.min(engine.getDeltaTime()/1000,.07);
  if(walking){const f=[-Math.cos(camera.alpha),-Math.sin(camera.alpha)],right=[Math.sin(camera.alpha),-Math.cos(camera.alpha)];
   const w=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),a=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),len=Math.hypot(w,a)||1,speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?13:7;
   if(w||a){position=advanceWalker(position,[(f[0]*w+right[0]*a)/len*dt*speed,(f[1]*w+right[1]*a)/len*dt*speed]);avatar.position=V(position[0],position[1]+.9,position[2]);onChange({walking,position:[...position]});}
   camera.target.copyFrom(Vector3.Lerp(camera.target,V(position[0],position[1]+1.5,position[2]),Math.min(1,dt*12)));
  }
  scene.render();
 });
 return {scene,camera,engine,setWalk,get walking(){return walking;},get position(){return [...position];},dispose(){disposed=true;observer?.disconnect();if(!observer)window.removeEventListener('resize',resize);window.removeEventListener('keydown',onDown);window.removeEventListener('keyup',onUp);window.removeEventListener('blur',onBlur);engine.stopRenderLoop();scene.dispose();engine.dispose();}};
}