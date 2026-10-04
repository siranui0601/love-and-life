import {CAPITAL,toLocal,fromLocal,elevationAt,terrainBaseAt,distance,distanceToLine,pointInPolygon} from './capital-data.js';
import {pathPolyline,polylineLengthM} from './capital-routing.js';
import {sampleLine,locateOnLine,edgeHeightAt,surfaceAt,moveWalker,activeBarriers,massFootprint,landmarkVisibility} from './capital-spatial.js';
import {advanceElapsed} from './capital-clock.js';
import {buildingParts,parcelPoint,courtyardHeight} from './capital-courtyards.js';
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
 const roadGroundBuckets=new Map();
 for(const e of CAPITAL.edges.filter(e=>!e.bridgeId&&e.class!=='roof')){const pad=(e.widthM/2+24)/1000,b=bounds(e.points);for(let x=Math.floor((b.minX-pad)*20);x<=Math.floor((b.maxX+pad)*20);x++)for(let y=Math.floor((b.minY-pad)*20);y<=Math.floor((b.maxY+pad)*20);y++){const k=x+','+y;if(!roadGroundBuckets.has(k))roadGroundBuckets.set(k,[]);roadGroundBuckets.get(k).push(e);}}
 for(const name of ['minX','minY'])outer[name]-=.5;for(const name of ['maxX','maxY'])outer[name]+=.5;
 function ground(name,b,nx,nz){
  const positions=[],indices=[],normals=[],uvs=[],colors=[];
  for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){const wx=b.minX+(b.maxX-b.minX)*ix/nx,wy=b.minY+(b.maxY-b.minY)*iz/nz,[x,z]=toLocal([wx,wy]);positions.push(x,elevationAt(wx,wy),z);uvs.push(ix/nx,iz/nz);const c=Color3.FromHexString(pointInPolygon([wx,wy],CAPITAL.core.polygon)?'#b3a78c':'#939a78');colors.push(c.r,c.g,c.b,1);}
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=z*(nx+1)+x,c=a+nx+1,p=[b.minX+(b.maxX-b.minX)*(x+.5)/nx,b.minY+(b.maxY-b.minY)*(z+.5)/nz];
   // The finer channel surface owns this strip; a coarse triangle must not
   // cover the water again and create saw-tooth islands along its bank.
   if(CAPITAL.rivers.some(r=>r.context&&distanceToLine(p,r.points)<r.widthM/2+20))continue;
   // Plot benches are discontinuous at their footprint. A coarse terrain
   // triangle must never interpolate a neighbouring raised plot across a road.
   const cellRadius=Math.hypot((b.maxX-b.minX)*1000/nx,(b.maxY-b.minY)*1000/nz)/2;
   if(name==='core-ground'&&(roadGroundBuckets.get(Math.floor(p[0]*20)+','+Math.floor(p[1]*20))||[]).some(e=>distanceToLine(p,e.points)<e.widthM/2+cellRadius+1))continue;
   indices.push(a,c,a+1,a+1,c,c+1);}
  VertexData.ComputeNormals(positions,indices,normals);const data=new VertexData();Object.assign(data,{positions,indices,normals,uvs,colors});const mesh=new Mesh(name,scene);data.applyToMesh(mesh);mesh.material=mat('ground','#ffffff');mesh.isPickable=false;
 }
 ground('core-ground',core,384,384);
 ground('west-ground',{...outer,maxX:core.minX},64,128);ground('east-ground',{...outer,minX:core.maxX},64,128);
 ground('south-ground',{minX:core.minX,maxX:core.maxX,minY:outer.minY,maxY:core.minY},128,64);ground('north-ground',{minX:core.minX,maxX:core.maxX,minY:core.maxY,maxY:outer.maxY},128,64);
 // Dense samples follow the same height function as feet; endpoint-only ribbons cut
 // through curved terrain and create phantom ramps/steps.
 function strip(name,points,width,material,heightAt){
  const ps=sampleLine(points,name.startsWith('road:')?2:8),left=[],right=[];
  for(let i=0;i<ps.length;i++){const prev=ps[Math.max(0,i-1)],next=ps[Math.min(ps.length-1,i+1)],[x,z]=toLocal(ps[i]);let dx=(next[0]-prev[0])*1000,dz=-(next[1]-prev[1])*1000,len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;const lx=x-dz*width/2,lz=z+dx*width/2,rx=x+dz*width/2,rz=z-dx*width/2,crossSlope=name.startsWith('road:')||name.startsWith('world_bridge_');left.push(V(lx,heightAt(crossSlope?fromLocal([lx,lz]):ps[i]),lz));right.push(V(rx,heightAt(crossSlope?fromLocal([rx,rz]):ps[i]),rz));}
  const mesh=MeshBuilder.CreateRibbon(name,{pathArray:[left,right],sideOrientation:Mesh.DOUBLESIDE},scene);mesh.material=material;mesh.isPickable=false;return mesh;
 }
 const streetGroundParts=[],outerStreetGroundParts=[];
 for(const e of CAPITAL.edges){
  if(!e.bridgeId&&e.class!=='roof'){
   const ps=sampleLine(e.points,4),paths=[],half=e.widthM/2+18;
   // Explicit road-edge rings preserve the carriageway without tessellating
   // every shoulder metre into millions of redundant vertices.
   for(const off of [-half,-e.widthM/2-1,-e.widthM/2,0,e.widthM/2,e.widthM/2+1,half]){paths.push(ps.map((p,i)=>{const a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,q=[p[0]-dy/len*off/1000,p[1]+dx/len*off/1000],[x,z]=toLocal(q);return V(x,elevationAt(...q)+.01,z);}));}
   const patch=MeshBuilder.CreateRibbon('street-ground:'+e.id,{pathArray:paths,sideOrientation:Mesh.DOUBLESIDE},scene);patch.material=e.class==='world'?mat('outer-street-ground','#939a78'):mat('street-ground','#b3a78c');patch.isPickable=false;(e.class==='world'?outerStreetGroundParts:streetGroundParts).push(patch);
  }
  const d=CAPITAL.districts.find(d=>d.id===byNode(e.from)?.district),color=e.courtyardId?'#aaa18b':e.class==='ceremonial'?'#b79b68':e.class==='world'?'#928469':e.class==='roof'?'#655c52':d?.profile.paving||'#928469';
  strip('road:'+e.id,e.points,e.widthM,mat('road:'+color,color),p=>edgeHeightAt(e,p));
  if(!e.bridgeId&&!e.courtyardId&&!['roof','world'].includes(e.class))for(const side of [-1,1]){const ps=sampleLine(e.points,8),curb=ps.map((p,i)=>{const a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,off=side*(e.widthM/2+.55)/1000;return [p[0]-dy/len*off,p[1]+dx/len*off];});strip('street-shoulder:'+e.id+':'+side,curb,.9,mat('sidewalk','#b4ae9c'),p=>elevationAt(...p)+.22);}
  if(e.surfaceRampM){const total=polylineLengthM(e.points),up=e.surfaceOffsetsM[0]<e.surfaceOffsetsM[1],start=up?total-e.surfaceRampM:0,parts=[];
   for(let step=0;step<27;step++){const a=locateOnLine(e.points,start+e.surfaceRampM*step/27).position,b=locateOnLine(e.points,start+e.surfaceRampM*(step+1)/27).position;parts.push(segmentBox('stair-tread',a,b,e.widthM,.12,stone,p=>edgeHeightAt(e,p)-.06));}merge(parts,'physical-stair:'+e.id,stone);
  }
  if(e.class==='roof'){
   const ps=sampleLine(e.points,12),supports=[];for(let i=1;i<ps.length;i++)supports.push(segmentBox('low-roof-deck',ps[i-1],ps[i],e.widthM+1,.35,mat('low-roof','#655c52'),p=>edgeHeightAt(e,p)-.35));merge(supports,'low-roof-surface:'+e.id,mat('low-roof','#655c52'));
  }
  if(e.class==='roof'||e.bridgeId){
   const ps=sampleLine(e.points,12),parts=[];
   for(let i=1;i<ps.length;i++)for(const side of [-1,1]){const a=ps[i-1],b=ps[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,off=(e.widthM/2-.15)*side/1000,aa=[a[0]-dy/len*off,a[1]+dx/len*off],bb=[b[0]-dy/len*off,b[1]+dx/len*off];parts.push(segmentBox('rail',aa,bb,.3,.65,stone,p=>edgeHeightAt(e,p)));}
   merge(parts,'rails:'+e.id,stone);
  }
 }
 merge(streetGroundParts,'fine-street-ground',mat('street-ground','#b3a78c'));
 merge(outerStreetGroundParts,'fine-outer-street-ground',mat('outer-street-ground','#939a78'));
 // Exposed retaining faces make the five benches readable in silhouette and
 // at eye height. Gaps follow the same graded street cuts as the walking surface.
 for(const face of CAPITAL.retainingFaces.filter(()=>!CAPITAL.surveyedRetainingFaces)){const paths=[[],[]];let parts=[];
  function flush(){if(paths[0].length>1){const m=MeshBuilder.CreateRibbon(face.id,{pathArray:paths.map(p=>[...p]),sideOrientation:Mesh.DOUBLESIDE},scene);m.material=mat('retaining','#b4ad94');m.isPickable=false;parts.push(m);}paths[0].length=0;paths[1].length=0;}
  for(const p of face.points){const dx=p[0]-CAPITAL.hillCentre[0],dy=p[1]-CAPITAL.hillCentre[1],len=Math.hypot(dx,dy),a=[p[0]-dx/len*.009,p[1]-dy/len*.009],b=[p[0]+dx/len*.009,p[1]+dy/len*.009];
   if(!pointInPolygon(p,CAPITAL.core.polygon)||elevationAt(...a)-elevationAt(...b)<7){flush();continue;}const [x,z]=toLocal(p);paths[0].push(V(x,elevationAt(...b),z));paths[1].push(V(x,elevationAt(...a),z));}
  flush();merge(parts,face.id,mat('retaining','#b4ad94'));
 }
 for(const face of CAPITAL.surveyedRetainingFaces||[]){const parts=[];
  for(const [a,b]of face.lines){const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
   // Graded road cuts and landings own their openings through the retaining face.
   if((roadGroundBuckets.get(Math.floor(mid[0]*20)+','+Math.floor(mid[1]*20))||[]).some(e=>distanceToLine(mid,e.points)<e.widthM/2+14))continue;
   const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),paths=[[],[]];for(const p of [a,b]){const [x,z]=toLocal(p),sides=[elevationAt(p[0]-dy/len*.012,p[1]+dx/len*.012),elevationAt(p[0]+dy/len*.012,p[1]-dx/len*.012)];paths[0].push(V(x,Math.max(face.lowerM,Math.min(...sides)),z));paths[1].push(V(x,Math.min(face.upperM,Math.max(...sides)),z));}
   const m=MeshBuilder.CreateRibbon(face.id,{pathArray:paths,sideOrientation:Mesh.DOUBLESIDE},scene);m.material=stone;m.isPickable=false;parts.push(m);
  }merge(parts,face.id,stone);
 }
 // Cross-slope lanes show individual risers where their real grade climbs.
 for(const e of CAPITAL.edges.filter(e=>e.fabric&&e.class==='stairs')){const ps=sampleLine(e.points,.8),left=[],right=[];
  for(let i=0;i<ps.length;i++){const p=ps[i],a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,off=e.widthM/2/1000;
   // Tread tops cover the smooth walking ramp at both road edges; using only
   // the centre height exposed diagonal triangles of paving through the stone.
   const sidePoint=(q,s)=>[q[0]+s*dy/len*off,q[1]-s*dx/len*off];
   const tread=(q,r,s)=>Math.max(edgeHeightAt(e,sidePoint(q,s)),edgeHeightAt(e,sidePoint(r,s)))+.045;
   for(const pair of [[a,p],[p,b]]){const [lx,lz]=toLocal(sidePoint(p,-1)),[rx,rz]=toLocal(sidePoint(p,1));left.push(V(lx,tread(...pair,-1),lz));right.push(V(rx,tread(...pair,1),rz));}}
  const m=MeshBuilder.CreateRibbon('terrace-stairs:'+e.id,{pathArray:[left,right],sideOrientation:Mesh.DOUBLESIDE},scene);m.material=stone;m.isPickable=false;
 }
 // Fine river-bank terrain closes the coarse outer heightfield at the inherited
 // macro river bends. It uses the same cut channel function as walking.
 for(const r of CAPITAL.rivers){const ps=sampleLine(r.points,10),paths=[];
  const rings=r.context?32:10;for(let ring=0;ring<=rings;ring++){const off=(ring/rings-.5)*(r.highFlowWidthM+(r.context?160:45));paths.push(ps.map((p,i)=>{const a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,q=[p[0]-dy/len*off/1000,p[1]+dx/len*off/1000],[x,z]=toLocal(q);return V(x,elevationAt(...q)+.02,z);}));}
  const bank=MeshBuilder.CreateRibbon('river-bank:'+r.id,{pathArray:paths,sideOrientation:Mesh.DOUBLESIDE},scene);bank.material=mat('bank','#939a78');bank.isPickable=false;
 }
 for(const b of CAPITAL.bridges.filter(b=>b.context)){const e=CAPITAL.edges.find(e=>e.id===b.edgeId);strip(b.id,b.points,b.widthM,stone,p=>edgeHeightAt(e,p));}
 for(const r of CAPITAL.rivers.filter(r=>r.context))strip('context-water:'+r.id,r.points,r.widthM,mat('context-water','#407d89'),p=>terrainBaseAt(...p)-4);
 const quayParts=[];for(const r of CAPITAL.rivers.filter(r=>!r.context)){const ps=sampleLine(r.points,8);for(let i=1;i<ps.length;i++)for(const side of [-1,1]){const a=ps[i-1],b=ps[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,off=side*(r.highFlowWidthM/2+2)/1000,aa=[a[0]-dy/len*off,a[1]+dx/len*off],bb=[b[0]-dy/len*off,b[1]+dx/len*off];quayParts.push(segmentBox('quay-face',aa,bb,1.1,3.3,stone,p=>terrainBaseAt(...p)-4.5));}}merge(quayParts,'river-quay-faces',stone);
 const river=CAPITAL.rivers[0],waterMat=mat('water','#407d89');
 const normalWater=strip('river-normal',river.points,river.widthM,waterMat,p=>terrainBaseAt(...p)-1.6);
 const floodWater=strip('river-flood',river.points,river.highFlowWidthM,waterMat,p=>terrainBaseAt(...p)-.8);
 function segmentBox(name,a,b,width,height,material,heightAt=elevationAtPosition){
  const [ax,az]=toLocal(a),[bx,bz]=toLocal(b),dx=bx-ax,dz=bz-az,mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];const mesh=MeshBuilder.CreateBox(name,{width:Math.hypot(dx,dz),height,depth:width},scene);mesh.position=V((ax+bx)/2,heightAt(mid)+height/2,(az+bz)/2);mesh.rotation.y=-Math.atan2(dz,dx);mesh.material=material;return mesh;
 }
 function elevationAtPosition(p){return elevationAt(...p);}
 function merge(parts,name,material){if(!parts.length)return;const m=Mesh.MergeMeshes(parts,true,true);m.name=name;m.material=material;return m;}
 // Follow slopes instead of levelling each kilometre-long wall to its midpoint.
 for(const w of CAPITAL.walls){const ps=sampleLine(w.points,12),parts=[],walkway=[],merlons=[];for(let i=1;i<ps.length;i++){const a=ps[i-1],b=ps[i],low=Math.min(elevationAt(...a),elevationAt(...b)),high=Math.max(elevationAt(...a),elevationAt(...b));parts.push(segmentBox('wall',a,b,w.widthM,w.heightM+high-low,wallMat,()=>low));walkway.push(segmentBox('wall-coping',a,b,w.widthM+1,1.2,stone,()=>high+w.heightM));}
  const crest=sampleLine(w.points,5);for(let i=1;i<crest.length;i+=2){const p=crest[i],[x,z]=toLocal(p),m=MeshBuilder.CreateBox('wall-merlon',{width:2.4,depth:w.widthM+.6,height:2.5},scene);m.position=V(x,elevationAt(...p)+w.heightM+2,z);m.material=stone;merlons.push(m);}merge(parts,w.id,wallMat);merge(walkway,w.id+':coping',stone);merge(merlons,w.id+':battlements',stone);}
 function tower(name,x,z,y,h,r,material){const p=fromLocal([x,z]),base=Math.min(y,...[[-1,-1],[-1,1],[1,-1],[1,1]].map(([a,b])=>elevationAt(p[0]+a*r/1000,p[1]+b*r/1000)))-.5,shaftHeight=y+h-base;const shaft=MeshBuilder.CreateCylinder(name,{diameter:r*2,height:shaftHeight,tessellation:8},scene);shaft.position=V(x,base+shaftHeight/2,z);shaft.material=material;const cap=MeshBuilder.CreateCylinder(name+':spire',{diameterTop:0,diameterBottom:r*2.5,height:r*2.2,tessellation:8},scene);cap.position=V(x,y+h+r*1.1,z);cap.material=roof;}
 for(const t of CAPITAL.fortifications){const [x,z]=toLocal(t.position);tower(t.id,x,z,elevationAt(...t.position),t.heightM,t.radiusM,stone);}
 for(const g of CAPITAL.gates){const [x,z]=toLocal(g.position),a=CAPITAL.core.polygon[g.wallIndex],b=CAPITAL.core.polygon[(g.wallIndex+1)%CAPITAL.core.polygon.length],dx=b[0]-a[0],dy=-(b[1]-a[1]),len=Math.hypot(dx,dy);
  const lintel=MeshBuilder.CreateBox('gate-vault:'+g.id,{width:36,height:11,depth:20},scene);lintel.position=V(x,elevationAt(...g.position)+29,z);lintel.rotation.y=-Math.atan2(dy,dx);lintel.material=stone;}
 const engineeringMeshes=new Set(scene.meshes);
 for(const d of [...CAPITAL.districts,{id:'outside',color:'#b6a58c',profile:{roof:'#76644f'}}]){
  const parts=[],roofs=[];
  for(const b of CAPITAL.buildings.flatMap(buildingParts).filter(b=>b.district===d.id&&!b.facilityId)){
   if(b.royalPart){const [rx,rz]=toLocal(b.position);for(const side of [-1,1])tower('royal-wing-tower:'+b.id,rx+side*(b.widthM/2-12),rz,elevationAt(...b.position),b.heightM+26,12,stone);}
   const [x,z]=toLocal(b.position),y=elevationAt(...b.position),angle=b.rotationRad||0;
   const base=Math.min(y,...[[-1,-1],[-1,1],[1,-1],[1,1]].map(([u,v])=>{const dx=u*b.widthM/2,dz=v*b.depthM/2;return elevationAt(b.position[0]+(dx*Math.cos(angle)+dz*Math.sin(angle))/1000,b.position[1]+(dx*Math.sin(angle)-dz*Math.cos(angle))/1000);}))-.5;
   const bodyHeight=b.heightM+y-base,m=MeshBuilder.CreateBox('parcel',{width:b.widthM,height:bodyHeight,depth:b.depthM},scene);m.position=V(x,base+bodyHeight/2,z);m.rotation.y=b.rotationRad||0;parts.push(m);
   const rw=(b.widthM+1)/2,rd=(b.depthM+1)/2,rh=b.roofHeightM||5;
   const positions=[-rw,0,-rd,rw,0,-rd,rw,0,rd,-rw,0,rd,-rw,rh,0,rw,rh,0],indices=[0,1,5,0,5,4,3,4,5,3,5,2,0,4,3,1,2,5],normals=[];
   VertexData.ComputeNormals(positions,indices,normals);const data=new VertexData();Object.assign(data,{positions,indices,normals});const cap=new Mesh('pitched-roof',scene);data.applyToMesh(cap);cap.position=V(x,y+b.heightM,z);cap.rotation.y=b.rotationRad||0;roofs.push(cap);
  }
  merge(parts,'district-mass:'+d.id,mat('d:'+d.id,d.color));merge(roofs,'district-roofs:'+d.id,mat('roof:'+d.id,d.profile.roof));
 }
 // Batch surveyed street-facing doors, windows and cornices. The face position
 // is the same plot frontage used by generation and collision, never guessed.
 const facadeGroups=new Map();
 function facadeQuad(kind,b,along,base,width,height){if(!facadeGroups.has(kind))facadeGroups.set(kind,{positions:[],indices:[]});const group=facadeGroups.get(kind),[x,z]=toLocal(b.frontage.position),[dx,dy]=b.frontage.tangent,tx=dx,tz=-dy,nx=b.frontage.side*dy,nz=b.frontage.side*dx,start=group.positions.length/3;
  for(const [u,v]of [[-width/2,0],[width/2,0],[width/2,height],[-width/2,height]])group.positions.push(x+tx*(along+u)+nx*.045,base+v,z+tz*(along+u)+nz*.045);group.indices.push(start,start+1,start+2,start,start+2,start+3);}
 for(const b of CAPITAL.buildings.filter(b=>b.frontage&&!b.courtyardId)){const base=b.benchHeightM;facadeQuad('door',b,0,base+.15,1.6,2.7);facadeQuad('cornice',b,0,base+b.heightM-.45,b.widthM,.4);
  for(let y=4;y<b.heightM-1;y+=3.2)for(const side of [-1,1])facadeQuad('window',b,side*Math.min(4,b.widthM*.28),base+y,1.2,1.7);}
 for(const court of CAPITAL.courtyards){const b=CAPITAL.buildings.find(b=>b.id===court.parcelId),paths=[];
  for(const u of [-b.widthM/2+3,b.widthM/2-3])paths.push([court.frontDepth,b.depthM-court.backDepth].map(v=>{const p=parcelPoint(b,u,v),[x,z]=toLocal(p);return V(x,courtyardHeight(b,p)+.24,z);}));
  const floor=MeshBuilder.CreateRibbon('courtyard-floor:'+court.id,{pathArray:paths,sideOrientation:Mesh.DOUBLESIDE},scene);floor.material=mat('courtyard-paving','#aaa18b');floor.isPickable=false;
  // Doors and windows face the shared court, making it an inhabited frontage.
  for(const u of [-b.widthM/2+3,b.widthM/2-3]){const p=parcelPoint(b,u,b.depthM/2),[dx,dy]=b.frontage.tangent,s=b.frontage.side,inner={...b,frontage:{position:p,tangent:[-dy*s,dx*s],side:u<0?s:-s}};
   facadeQuad('door',inner,0,courtyardHeight(b,p)+.15,1.6,2.7);
   for(let y=4;y<Math.min(9.6,b.heightM)-1;y+=3.2)for(const along of [-7,0,7])facadeQuad('window',inner,along,courtyardHeight(b,p)+y,1.2,1.7);
  }
  for(const [v,height,side]of [[b.depthM-court.backDepth,6.4,b.frontage.side],[court.frontDepth,b.heightM,-b.frontage.side]]){const p=parcelPoint(b,0,v),inner={...b,frontage:{...b.frontage,position:p,side}};facadeQuad('door',inner,0,courtyardHeight(b,p)+.15,1.6,2.7);for(let y=4;y<height-1;y+=3.2)for(const u of [-2,2])facadeQuad('window',inner,u,courtyardHeight(b,parcelPoint(b,u,v))+y,1.2,1.7);}
 }
 for(const [kind,g]of facadeGroups){const normals=[];VertexData.ComputeNormals(g.positions,g.indices,normals);const data=new VertexData();Object.assign(data,{...g,normals});const m=new Mesh('street-facades:'+kind,scene);data.applyToMesh(m);m.material=mat('facade:'+kind,kind==='cornice'?'#d0c5ae':kind==='door'?'#544636':'#53626a');m.material.backFaceCulling=false;m.isPickable=false;}
 const parcelMeshes=[];
 for(const f of CAPITAL.facilities.filter(f=>f.footprintM[0]&&f.id!=='LOC_CAP_BIG_STORE')){
  const [x,z]=toLocal(f.buildingPosition),y=elevationAt(...f.buildingPosition),size=massFootprint(CAPITAL.buildings.find(b=>b.facilityId===f.id));
  if(f.id==='LOC_CAP_CASTLE'){
   const keep=MeshBuilder.CreateBox('castle-keep',{width:size.widthM,height:88,depth:size.depthM},scene);keep.position=V(x,y+44,z);keep.material=stone;
   const roofKeep=MeshBuilder.CreateCylinder('royal-keep-roof',{diameterTop:0,diameterBottom:225,height:36,tessellation:4},scene);roofKeep.scaling.x=1.5;roofKeep.scaling.z=.8;roofKeep.rotation.y=Math.PI/4;roofKeep.position=V(x,y+106,z);roofKeep.material=roof;
   for(const [ox,oz]of[[-135,-78],[135,-78],[-135,78],[135,78],[-65,-78],[65,-78]])tower('castle-tower',x+ox,z+oz,y,110,13,stone);tower('castle-primary',x,z,y+60,100,20,stone);
  }else if(f.id==='LOC_CAP_MAGE_TOWER'){tower('mage-primary',x,z,y,118,17,mat('mage','#777e9e'));tower('mage-top',x,z,y+80,58,8.5,mat('mage','#777e9e'));}
  else{const m=MeshBuilder.CreateBox(f.id,{width:size.widthM,height:size.heightM,depth:size.depthM},scene);m.position=V(x,y+size.heightM/2,z);m.material=stone;if(f.id==='LOC_CAP_ORPHANAGE')parcelMeshes.push(m);}
 }
 const architectureMeshes=scene.meshes.filter(m=>!engineeringMeshes.has(m));
 const structureButton=document.getElementById('structure-only');let structureOnly=false;
 function setStructureOnly(value){structureOnly=value;for(const m of architectureMeshes)m.setEnabled(!value);structureButton?.setAttribute('aria-pressed',String(value));if(structureButton)structureButton.textContent=value?'建物も表示する':'地盤・街路・城壁だけを見る';}
 if(structureButton)structureButton.onclick=()=>setStructureOnly(!structureOnly);
 // Negative space has edges and usable surfaces, not just a cleared generation radius.
 for(const space of CAPITAL.negativeSpaces){
  const positions=[],indices=[],normals=[],segments=48,rings=8;
  for(let ring=0;ring<=rings;ring++)for(let i=0;i<segments;i++){
   const a=i/segments*Math.PI*2,r=space.radiusM*ring/rings,p=[space.position[0]+Math.cos(a)*r/1000,space.position[1]+Math.sin(a)*r/1000],[x,z]=toLocal(p);positions.push(x,surfaceAt(p).heightM+.04,z);
  }
  for(let ring=0;ring<rings;ring++)for(let i=0;i<segments;i++){const a=ring*segments+i,b=ring*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,b,c,b,d,c);}
  VertexData.ComputeNormals(positions,indices,normals);const data=new VertexData();Object.assign(data,{positions,indices,normals});const m=new Mesh(space.id,scene);data.applyToMesh(m);m.material=mat('space:'+space.kind,space.kind==='garden'?'#789176':space.kind==='market'?'#b7a075':'#a39c83');m.material.backFaceCulling=false;m.isPickable=false;

 }
 // A continuous suburb/road/farmland seam; no scene switch or invisible core border.
 for(const e of CAPITAL.edges.filter(e=>e.class==='roof')){const ps=sampleLine(e.points,10),parts=[];for(let i=1;i<ps.length;i++)parts.push(segmentBox('roof-support-houses',ps[i-1],ps[i],e.widthM+3,3.8,mat('roof-support','#9d8875'),p=>elevationAt(...p)));merge(parts,'roof-support:'+e.id,mat('roof-support','#9d8875'));}
 for(const o of CAPITAL.outskirts){const [x,z]=toLocal(o.position),y=elevationAt(...o.position);
  if(o.kind==='farmland')for(let i=0;i<8;i++){const field=MeshBuilder.CreateBox('farm-strip',{width:90,height:.12,depth:9},scene);field.position=V(x-65,y+.1,z+i*12-48);field.material=mat('field:'+i%2,i%2?'#a89b61':'#9b925b');}

 }
 for(const f of CAPITAL.furnishings){
  const [x,z]=toLocal(f.position),y=surfaceAt(f.position).heightM;
  if(f.kind==='tree'){const trunk=MeshBuilder.CreateCylinder(f.id,{diameter:.6,height:3,tessellation:5},scene);trunk.position=V(x,y+1.5,z);trunk.material=mat('wood','#685a43');const crown=MeshBuilder.CreateSphere(f.id+':canopy',{diameter:5,segments:4},scene);crown.position=V(x,y+4.5,z);crown.material=mat('leaves','#587353');}
  else{const m=MeshBuilder.CreateBox(f.id,{width:f.widthM,height:f.heightM,depth:f.depthM},scene);m.position=V(x,y+f.heightM/2,z);m.rotation.y=f.rotationRad||0;m.material=mat('fixture:'+f.kind,f.color);}
 }
 const closures=new Map();
 const orbit=new ArcRotateCamera('capital-orbit',Math.PI/2,1.02,3600,V(0,80,-380),scene);orbit.minZ=10;orbit.maxZ=18000;orbit.lowerRadiusLimit=80;orbit.upperRadiusLimit=9000;orbit.wheelPrecision=5;orbit.attachControl(canvas,true);scene.activeCamera=orbit;
 let auditPaused=false;let skipFrame=false;const resumeFrame=()=>{skipFrame=true;};document.addEventListener('visibilitychange',resumeFrame);
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
  const s=getState();barriers=activeBarriers(s);for(const m of closures.values())m.setEnabled(false);for(const b of barriers){const key=b.reason+':'+b.edgeId;let m=closures.get(key);if(!m){m=segmentBox('closure:'+key,...b.points,2,b.heightM,closureMat,p=>surfaceAt(p).heightM);closures.set(key,m);}m.setEnabled(true);}
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
 scene.onBeforeRenderObservable.add(()=>{const multiplier=guide?Number(document.getElementById('review-speed').value):1,dt=document.hidden||skipFrame||auditPaused?0:engine.getDeltaTime()/1000;skipFrame=false;advanceElapsed(dt*multiplier,advance);telemetryClock+=dt;if(telemetryClock>.5){refreshTraffic();updateTelemetry();telemetryClock=0;}});
 engine.runRenderLoop(()=>{if(!document.getElementById('scene-panel').hidden)scene.render();});const resize=()=>engine.resize();window.addEventListener('resize',resize);loading.hidden=true;
 // Explicit diagnostic endpoint only on ?audit=1. Advances the SAME movement/collision
 // pipeline in small physical steps, never teleports cameras between sampled checkpoints.
 if(new URLSearchParams(location.search).has('audit'))globalThis.__capitalAudit={snapshot,pauseRealTime(paused=true){auditPaused=paused;resumeFrame();},frame(seconds){advanceElapsed(seconds,advance);refreshTraffic();updateTelemetry();scene.render();return snapshot();},overview(angle=Math.PI/2){stopWalk();orbit.alpha=angle;orbit.beta=1.02;orbit.radius=3600;orbit.setTarget(V(0,80,-380));scene.render();},advance(seconds){advance(seconds);refreshTraffic();updateTelemetry();scene.render();return snapshot();},visibility(){return feet?['castle','mage_tower'].map(id=>({id,...landmarkVisibility(feet,id)})):[];}};
 return {resize(){resumeFrame();resize();},updateState,routeChanged(){guide=null;clearKeys();blocked=null;updateTelemetry();},dispose(){disposed=true;window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clearKeys);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',resumeFrame);delete globalThis.__capitalAudit;engine.dispose();}};
}
