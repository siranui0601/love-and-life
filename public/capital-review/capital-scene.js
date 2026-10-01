import {CAPITAL,toLocal,fromLocal,elevationAt,terrainBaseAt,distance,pointInPolygon} from './capital-data.js';
import {pathPolyline,polylineLengthM} from './capital-routing.js';
import {sampleLine,edgeHeightAt,surfaceAt,moveWalker,activeBarriers,massFootprint,landmarkVisibility} from './capital-spatial.js';
import {trafficPlans,trafficAgents} from './capital-traffic.js';

export function mountCapitalScene(getState,getRoute){
 const B=globalThis.BABYLON,canvas=document.getElementById('greybox'),loading=document.getElementById('scene-loading');
 if(!B)throw new Error('Babylon.jsを読み込めませんでした。');
 const {Engine,Scene,Vector3,Color3,Color4,Mesh,MeshBuilder,VertexData,StandardMaterial,ArcRotateCamera,UniversalCamera}=B;
 const V=(x,y,z)=>new Vector3(x,y,z),engine=new Engine(canvas,true),scene=new Scene(engine),materials=new Map();
 const mat=(key,color)=>{if(materials.has(key))return materials.get(key);const m=new StandardMaterial(key,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=Color3.Black();materials.set(key,m);return m;};
 const hemi=new B.HemisphericLight('sky',V(0,1,0),scene);hemi.intensity=.65;hemi.groundColor=new Color3(.18,.19,.16);
 const sun=new B.DirectionalLight('sun',V(-.5,-1,.35),scene);sun.intensity=.65;
 const stone=mat('stone','#b8b3a4'),wallMat=mat('wall','#77736b'),roof=mat('spire','#536176'),closureMat=mat('closure','#b95543');
 const byNode=id=>CAPITAL.nodes.find(n=>n.id===id);
 const bounds=points=>({minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))});
 const core=bounds(CAPITAL.core.polygon),outer=bounds([...CAPITAL.activityEnvelope.polygon,...CAPITAL.worldConnections.flatMap(c=>c.path)]);
 for(const name of ['minX','minY'])outer[name]-=.2;for(const name of ['maxX','maxY'])outer[name]+=.2;
 function ground(name,b,nx,nz){
  const positions=[],indices=[],normals=[],uvs=[];
  for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){const wx=b.minX+(b.maxX-b.minX)*ix/nx,wy=b.minY+(b.maxY-b.minY)*iz/nz,[x,z]=toLocal([wx,wy]);positions.push(x,elevationAt(wx,wy),z);uvs.push(ix/nx,iz/nz);}
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=z*(nx+1)+x,c=a+nx+1;indices.push(a,a+1,c,a+1,c+1,c);}
  VertexData.ComputeNormals(positions,indices,normals);const data=new VertexData();Object.assign(data,{positions,indices,normals,uvs});const mesh=new Mesh(name,scene);data.applyToMesh(mesh);mesh.material=mat('ground','#939a78');mesh.isPickable=false;
 }
 ground('core-ground',core,256,256);
 ground('west-ground',{...outer,maxX:core.minX},64,128);ground('east-ground',{...outer,minX:core.maxX},64,128);
 ground('south-ground',{minX:core.minX,maxX:core.maxX,minY:outer.minY,maxY:core.minY},128,64);ground('north-ground',{minX:core.minX,maxX:core.maxX,minY:core.maxY,maxY:outer.maxY},128,64);
 // Dense samples follow the same height function as feet; endpoint-only ribbons cut
 // through curved terrain and create phantom ramps/steps.
 function strip(name,points,width,material,heightAt){
  const ps=sampleLine(points,8),left=[],right=[];
  for(let i=0;i<ps.length;i++){const prev=ps[Math.max(0,i-1)],next=ps[Math.min(ps.length-1,i+1)],[x,z]=toLocal(ps[i]);let dx=(next[0]-prev[0])*1000,dz=-(next[1]-prev[1])*1000,len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;const y=heightAt(ps[i]);left.push(V(x-dz*width/2,y,z+dx*width/2));right.push(V(x+dz*width/2,y,z-dx*width/2));}
  const mesh=MeshBuilder.CreateRibbon(name,{pathArray:[left,right],sideOrientation:Mesh.DOUBLESIDE},scene);mesh.material=material;mesh.isPickable=false;return mesh;
 }
 for(const e of CAPITAL.edges){
  const d=CAPITAL.districts.find(d=>d.id===byNode(e.from)?.district),color=e.class==='ceremonial'?'#b79b68':e.class==='world'?'#928469':e.class==='roof'?'#655c52':d?.profile.paving||'#928469';
  strip('road:'+e.id,e.points,e.widthM,mat('road:'+color,color),p=>edgeHeightAt(e,p));
  if(e.class==='roof'||e.bridgeId){
   const ps=sampleLine(e.points,12),parts=[];
   for(let i=1;i<ps.length;i++)for(const side of [-1,1]){const a=ps[i-1],b=ps[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,off=(e.widthM/2-.15)*side/1000,aa=[a[0]-dy/len*off,a[1]+dx/len*off],bb=[b[0]-dy/len*off,b[1]+dx/len*off];parts.push(segmentBox('rail',aa,bb,.3,.65,stone,p=>edgeHeightAt(e,p)));}
   merge(parts,'rails:'+e.id,stone);
  }
 }
 const river=CAPITAL.rivers[0],waterMat=mat('water','#407d89');
 const normalWater=strip('river-normal',river.points,river.widthM,waterMat,p=>terrainBaseAt(...p)-.9);
 const floodWater=strip('river-flood',river.points,river.highFlowWidthM,waterMat,p=>terrainBaseAt(...p)-.2);
 function segmentBox(name,a,b,width,height,material,heightAt=elevationAtPosition){
  const [ax,az]=toLocal(a),[bx,bz]=toLocal(b),dx=bx-ax,dz=bz-az,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];const mesh=MeshBuilder.CreateBox(name,{width:Math.hypot(dx,dz),height,depth:width},scene);mesh.position=V((ax+bx)/2,heightAt(mid)+height/2,(az+bz)/2);mesh.rotation.y=-Math.atan2(dz,dx);mesh.material=material;return mesh;
 }
 function elevationAtPosition(p){return elevationAt(...p);}
 function merge(parts,name,material){if(!parts.length)return;const m=Mesh.MergeMeshes(parts,true,true);m.name=name;m.material=material;return m;}
 // Follow slopes instead of levelling each kilometre-long wall to its midpoint.
 for(const w of CAPITAL.walls){const ps=sampleLine(w.points,24),parts=[];for(let i=1;i<ps.length;i++)parts.push(segmentBox('wall',ps[i-1],ps[i],w.widthM,w.heightM,wallMat));merge(parts,w.id,wallMat);}
 function tower(name,x,z,y,h,r,material){const shaft=MeshBuilder.CreateCylinder(name,{diameter:r*2,height:h,tessellation:8},scene);shaft.position=V(x,y+h/2,z);shaft.material=material;const cap=MeshBuilder.CreateCylinder(name+':spire',{diameterTop:0,diameterBottom:r*2.5,height:r*2.2,tessellation:8},scene);cap.position=V(x,y+h+r*1.1,z);cap.material=roof;}
 for(const g of CAPITAL.gates){const [x,z]=toLocal(g.position),a=CAPITAL.core.polygon[g.wallIndex],b=CAPITAL.core.polygon[(g.wallIndex+1)%CAPITAL.core.polygon.length],dx=b[0]-a[0],dy=-(b[1]-a[1]),len=Math.hypot(dx,dy);for(const side of [-1,1])tower('gate:'+g.id,x+dx/len*14*side,z+dy/len*14*side,elevationAt(...g.position),24,4.5,stone);}
 for(const d of CAPITAL.districts){
  const parts=[],roofs=[];
  for(const b of CAPITAL.buildings.filter(b=>b.district===d.id&&!b.facilityId)){
   const [x,z]=toLocal(b.position),y=elevationAt(...b.position),m=MeshBuilder.CreateBox('parcel',{width:b.widthM,height:b.heightM,depth:b.depthM},scene);m.position=V(x,y+b.heightM/2,z);m.rotation.y=b.rotationRad||0;parts.push(m);
   const cap=MeshBuilder.CreateBox('roof',{width:b.widthM+.6,height:.5,depth:b.depthM+.6},scene);cap.position=V(x,y+b.heightM+.25,z);cap.rotation.y=b.rotationRad||0;roofs.push(cap);
  }
  merge(parts,'district-mass:'+d.id,mat('d:'+d.id,d.color));merge(roofs,'district-roofs:'+d.id,mat('roof:'+d.id,d.profile.roof));
 }
 const parcelMeshes=[];
 for(const f of CAPITAL.facilities.filter(f=>f.footprintM[0]&&f.id!=='LOC_CAP_BIG_STORE')){
  const [x,z]=toLocal(f.buildingPosition),y=elevationAt(...f.buildingPosition),size=massFootprint(CAPITAL.buildings.find(b=>b.facilityId===f.id));
  if(f.id==='LOC_CAP_CASTLE'){
   const keep=MeshBuilder.CreateBox('castle-keep',{width:150,height:62,depth:118},scene);keep.position=V(x,y+31,z);keep.material=stone;
   for(const [ox,oz]of[[-62,-46],[62,-46],[-62,46],[62,46]])tower('castle-tower',x+ox,z+oz,y,82,10,stone);tower('castle-primary',x,z,y+19,108,13,stone);
  }else if(f.id==='LOC_CAP_MAGE_TOWER'){tower('mage-primary',x,z,y,118,17,mat('mage','#777e9e'));tower('mage-top',x,z,y+80,58,8.5,mat('mage','#777e9e'));}
  else{const m=MeshBuilder.CreateBox(f.id,{width:size.widthM,height:size.heightM,depth:size.depthM},scene);m.position=V(x,y+size.heightM/2,z);m.material=stone;if(f.id==='LOC_CAP_ORPHANAGE')parcelMeshes.push(m);}
 }
 // Negative space has edges and usable surfaces, not just a cleared generation radius.
 for(const space of CAPITAL.negativeSpaces){
  const [x,z]=toLocal(space.position),y=surfaceAt(space.position).heightM,m=MeshBuilder.CreateCylinder(space.id,{diameter:space.radiusM*2,height:.2,tessellation:32},scene);m.position=V(x,y+.04,z);m.material=mat('space:'+space.kind,space.kind==='garden'?'#789176':space.kind==='market'?'#b7a075':'#a39c83');m.isPickable=false;

 }
 // A continuous suburb/road/farmland seam; no scene switch or invisible core border.
 for(const o of CAPITAL.outskirts){const [x,z]=toLocal(o.position),y=elevationAt(...o.position);
  if(o.kind==='farmland')for(let i=0;i<8;i++){const field=MeshBuilder.CreateBox('farm-strip',{width:90,height:.12,depth:9},scene);field.position=V(x-65,y+.1,z+i*12-48);field.material=mat('field:'+i%2,i%2?'#a89b61':'#9b925b');}

 }
 for(const f of CAPITAL.furnishings){
  const [x,z]=toLocal(f.position),y=surfaceAt(f.position).heightM;
  if(f.kind==='tree'){const trunk=MeshBuilder.CreateCylinder(f.id,{diameter:.6,height:3,tessellation:5},scene);trunk.position=V(x,y+1.5,z);trunk.material=mat('wood','#685a43');const crown=MeshBuilder.CreateSphere(f.id+':canopy',{diameter:5,segments:4},scene);crown.position=V(x,y+4.5,z);crown.material=mat('leaves','#587353');}
  else{const m=MeshBuilder.CreateBox(f.id,{width:f.widthM,height:f.heightM,depth:f.depthM},scene);m.position=V(x,y+f.heightM/2,z);m.material=mat('fixture:'+f.kind,f.color);}
 }
 const closures=new Map();for(const barrier of activeBarriers({access:'public',weather:'flood',events:{T10:'active',T11:'active',T16:'active',T17:'active'}})){const m=segmentBox('closure:'+barrier.edgeId,...barrier.points,2,barrier.heightM,closureMat,p=>surfaceAt(p).heightM);closures.set(barrier.edgeId,m);}
 const orbit=new ArcRotateCamera('capital-orbit',Math.PI/2,.82,2450,V(150,50,-500),scene);orbit.minZ=.5;orbit.maxZ=18000;orbit.lowerRadiusLimit=80;orbit.upperRadiusLimit=9000;orbit.wheelPrecision=5;orbit.attachControl(canvas,true);scene.activeCamera=orbit;
 let walk=null,feet=null,guide=null,travelledM=0,simSeconds=0,blocked=null,barriers=[],plans=[],agents=[],trafficClock=0,telemetryClock=0,disposed=false;
 const pressed=new Set(),agentMeshes=new Map(),telemetry=document.getElementById('telemetry');
 const keydown=e=>{if(!walk||e.target.closest('select,input,button'))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){pressed.add(e.code);guide=null;e.preventDefault();}};
 const keyup=e=>pressed.delete(e.code),clearKeys=()=>pressed.clear();window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clearKeys);
 function stopWalk(){clearKeys();guide=null;if(walk){walk.detachControl();walk.dispose();walk=null;}scene.activeCamera=orbit;orbit.attachControl(canvas,true);document.body.classList.remove('walking-capital');telemetry.textContent='俯瞰：ドラッグで回転 / ホイールで拡大';}
 function startWalk(guided=false){
  const route=getRoute();if(guided&&!route?.edges.length)return;
  stopWalk();const start=byNode(document.getElementById('route-from').value)||byNode('market');feet=[...start.position];travelledM=0;simSeconds=0;blocked=null;
  const [x,z]=toLocal(feet),y=surfaceAt(feet).heightM;orbit.detachControl();walk=new UniversalCamera('walker',V(x,y+1.7,z),scene);walk.minZ=.1;walk.maxZ=14000;walk.inertia=0;walk.angularSensibility=3000;walk.keysUp=[];walk.keysDown=[];walk.keysLeft=[];walk.keysRight=[];
  const dest=route?.nodes.length>1?byNode(route.nodes[1]):byNode(document.getElementById('route-to').value),[tx,tz]=toLocal(dest?.position||byNode('market').position);walk.setTarget(V(tx,y+1.7,tz));walk.attachControl(canvas,true);scene.activeCamera=walk;document.body.classList.add('walking-capital');canvas.focus();
  if(guided)guide={points:pathPolyline(route),index:1,routeDistanceM:polylineLengthM(pathPolyline(route)),complete:false};
  updateTelemetry();
 }
 function updateState(){
  const s=getState();barriers=activeBarriers(s);const closed=new Set(barriers.map(b=>b.edgeId));for(const [id,m]of closures)m.setEnabled(closed.has(id));
  normalWater.setEnabled(s.weather!=='flood');floodWater.setEnabled(s.weather==='flood');
  scene.fogMode=s.weather==='fog'?Scene.FOGMODE_EXP2:Scene.FOGMODE_NONE;scene.fogDensity=.0005;scene.fogColor=new Color3(.68,.72,.70);
  const night=s.hour>=20||s.hour<6;hemi.intensity=night?.28:.65;sun.intensity=night?.12:.65;scene.clearColor=night?new Color4(.07,.10,.15,1):s.weather==='rain'?new Color4(.45,.55,.58,1):new Color4(.68,.79,.84,1);
  for(const m of parcelMeshes)m.material=s.events.T10==='failed'?mat('store-reuse','#a48e6b'):stone;
  plans=trafficPlans(s);trafficClock=0;guide=null;refreshTraffic();
 }
 function refreshTraffic(){
  agents=trafficAgents(plans,trafficClock);const live=new Set();
  for(const a of agents){live.add(a.id);let m=agentMeshes.get(a.id);if(!m){m=a.cart?MeshBuilder.CreateBox('traffic:'+a.id,{width:1.8,height:1.3,depth:3.2},scene):MeshBuilder.CreateCapsule('traffic:'+a.id,{height:1.7,radius:.3,tessellation:5,subdivisions:1},scene);m.material=mat('npc:'+a.planId,['guard','clerk'].includes(a.planId)?'#647580':a.cart?'#715945':'#a36f50');m.isPickable=false;agentMeshes.set(a.id,m);}const [x,z]=toLocal(a.position);m.position=V(x,a.heightM+(a.cart?.65:.85),z);m.rotation.y=Math.atan2(a.direction[0],-a.direction[1]);}
  for(const [id,m]of agentMeshes)if(!live.has(id)){m.dispose();agentMeshes.delete(id);}
 }
 function advance(dt){
  if(disposed)return;trafficClock+=dt;if(walk){simSeconds+=dt;let remaining=(pressed.has('ShiftLeft')||pressed.has('ShiftRight')?4.5:CAPITAL.walkingSpeedMps)*dt;
   if(guide&&!guide.complete){
    while(remaining>1e-7&&guide.index<guide.points.length){
     const target=guide.points[guide.index],gap=distance(feet,target);if(gap<.02){guide.index++;continue;}
     const step=Math.min(gap,remaining,1.5),dx=(target[0]-feet[0])*1000/gap,dy=(target[1]-feet[1])*1000/gap,result=moveWalker(feet,[dx*step,dy*step],getState(),{barriers});
     feet=result.position;travelledM+=result.travelledM;remaining-=step;blocked=result.blocked;walk.rotation.y=Math.atan2(dx,-dy);walk.rotation.x=0;
     if(blocked){guide.complete=false;guide.blocked=true;break;}
    }
    if(guide.index>=guide.points.length)guide.complete=true;
   }else if(!guide){const f=walk.getForwardRay().direction,fx=f.x,fy=-f.z,len=Math.hypot(fx,fy)||1;let dx=0,dy=0;
    if(pressed.has('KeyW')||pressed.has('ArrowUp')){dx+=fx/len;dy+=fy/len;}if(pressed.has('KeyS')||pressed.has('ArrowDown')){dx-=fx/len;dy-=fy/len;}
    if(pressed.has('KeyD')||pressed.has('ArrowRight')){dx+=fy/len;dy-=fx/len;}if(pressed.has('KeyA')||pressed.has('ArrowLeft')){dx-=fy/len;dy+=fx/len;}
    const n=Math.hypot(dx,dy);if(n){const result=moveWalker(feet,[dx/n*remaining,dy/n*remaining],getState(),{barriers});feet=result.position;travelledM+=result.travelledM;blocked=result.blocked;}
   }
   const [x,z]=toLocal(feet);walk.position.set(x,surfaceAt(feet).heightM+1.7,z);
  }
 }
 function snapshot(){return {position:feet?[...feet]:null,heightM:feet?surfaceAt(feet).heightM:null,travelledM,simSeconds,blocked,complete:!!guide?.complete,guideIndex:guide?.index,routeDistanceM:guide?.routeDistanceM,agentCount:agents.length};}
 function updateTelemetry(){
  if(!walk)return;const district=CAPITAL.districts.find(d=>pointInPolygon(feet,d.polygon)),height=surfaceAt(feet).heightM;
  const visible=['castle','mage_tower'].filter(id=>landmarkVisibility(feet,id).visible).map(id=>byNode(id).name);
  const status=guide?.complete?'経路完歩':blocked?'停止：'+blocked:guide?'経路を歩行中':'自由歩行';
  telemetry.textContent=status+' · '+(district?.name||'城門外')+' · '+Math.round(travelledM)+'m · 標高 '+height.toFixed(1)+'m · 視線が通る目印 '+(visible.join('・')||'街路の切れ目で方向を回復');
  Object.assign(telemetry.dataset,{x:feet[0],y:feet[1],height:height,distance:travelledM,complete:String(!!guide?.complete),blocked:blocked||'',seconds:simSeconds});
 }
 document.getElementById('walk-start').onclick=()=>startWalk();document.getElementById('walk-route').onclick=()=>startWalk(true);document.getElementById('walk-stop').onclick=stopWalk;
 document.getElementById('focus-castle').onclick=()=>{stopWalk();const n=byNode('castle'),[x,z]=toLocal(n.position);orbit.setTarget(V(x,elevationAt(...n.position)+40,z));orbit.radius=900;};
 for(const button of document.querySelectorAll('[data-walk]')){const code=button.dataset.walk;button.onpointerdown=e=>{guide=null;pressed.add(code);button.setPointerCapture(e.pointerId);e.preventDefault();};button.onpointerup=button.onpointercancel=button.onlostpointercapture=()=>pressed.delete(code);}
 updateState();
 scene.onBeforeRenderObservable.add(()=>{const multiplier=guide?Number(document.getElementById('review-speed').value):1,dt=Math.min(.05,engine.getDeltaTime()/1000);advance(dt*multiplier);telemetryClock+=dt;if(telemetryClock>.5){refreshTraffic();updateTelemetry();telemetryClock=0;}});
 engine.runRenderLoop(()=>{if(!document.getElementById('scene-panel').hidden)scene.render();});const resize=()=>engine.resize();window.addEventListener('resize',resize);loading.hidden=true;
 // Explicit diagnostic endpoint only on ?audit=1. Advances the SAME movement/collision
 // pipeline in small physical steps, never teleports cameras between sampled checkpoints.
 if(new URLSearchParams(location.search).has('audit'))globalThis.__capitalAudit={snapshot,advance(seconds){advance(seconds);refreshTraffic();updateTelemetry();scene.render();return snapshot();},visibility(){return feet?['castle','mage_tower'].map(id=>({id,...landmarkVisibility(feet,id)})):[];}};
 return {resize,updateState,routeChanged(){guide=null;},dispose(){disposed=true;window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clearKeys);window.removeEventListener('resize',resize);delete globalThis.__capitalAudit;engine.dispose();}};
}
