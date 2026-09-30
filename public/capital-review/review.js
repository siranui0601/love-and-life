import {CAPITAL,toLocal,fromLocal,elevationAt,pointInPolygon,distance} from './capital-data.js';
import {findAlternatives,pathPolyline,stateClosures,normalizeState} from './capital-routing.js';

const SVG='http://www.w3.org/2000/svg',W=1100,H=900;
const svg=document.getElementById('capital-map'),inspection=document.getElementById('inspection');
const tabs={map:document.getElementById('view-map'),scene:document.getElementById('view-3d')};
const panels={map:document.getElementById('map-panel'),scene:document.getElementById('scene-panel')};
const fmt=(n,d=0)=>Number(n).toLocaleString('ja-JP',{maximumFractionDigits:d});
const bbox=points=>{
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
};
const worldBox=bbox(CAPITAL.activityEnvelope.polygon),padKm=.22;
const frame={minX:worldBox.minX-padKm,maxX:worldBox.maxX+padKm,minY:worldBox.minY-padKm,maxY:worldBox.maxY+padKm};
const sx=W/(frame.maxX-frame.minX),sy=H/(frame.maxY-frame.minY);
const project=([x,y])=>[(x-frame.minX)*sx,(frame.maxY-y)*sy];
const metresPx=m=>m/1000*(sx+sy)/2;
const pathD=pts=>pts.map((p,i)=>{const [x,y]=project(p);return (i?'L':'M')+x.toFixed(1)+','+y.toFixed(1)}).join(' ');
const polyD=pts=>pathD([...pts,pts[0]])+'Z';
const el=(tag,attrs={},parent=svg)=>{
 const n=document.createElementNS(SVG,tag);
 for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
 parent.append(n);return n;
};
const layers={};
for(const id of ['base','envelope','districts','elevation','buildings','river','roads','world','walls','beats','closures','flows','route','facilities','labels']){
 layers[id]=el('g',{'data-layer':id});
}
function title(node,text){const t=document.createElementNS(SVG,'title');t.textContent=text;node.append(t);}
function inspect(titleText,kicker,html){
 inspection.innerHTML='<p class="eyebrow">'+kicker+'</p><h2>'+titleText+'</h2><div>'+html+'</div>';
}
function activate(node,handler,label){
 node.classList.add('map-hit');node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label',label);
 for(const ev of ['click','focus'])node.addEventListener(ev,handler);
}
function layerVisible(name){const input=document.getElementById('layer-'+name);return !input||input.checked;}
function setLayer(name,visible){if(layers[name])layers[name].style.display=visible?'':'none';}
function state(){
 const events={};
 for(const id of Object.keys(CAPITAL.encounterStates))events[id]=document.getElementById('event-'+id)?.value||'idle';
 return normalizeState({
  weather:document.getElementById('weather').value,
  hour:Number(document.getElementById('hour').value),
  access:document.getElementById('access').value,
  events
 });
}
function facilityActive(f,s){
 if(f.id==='LOC_CAP_ORPHANAGE')return s.events.T10!=='failed';
 if(f.id==='LOC_CAP_BIG_STORE')return s.events.T10==='failed';
 return true;
}
function districtById(id){return CAPITAL.districts.find(d=>d.id===id);}
function nodeById(id){return CAPITAL.nodes.find(n=>n.id===id);}
function facilityByNode(id){return CAPITAL.facilities.find(f=>f.nodeId===id);}
function nodeHtml(n){
 const d=districtById(n.district),f=facilityByNode(n.id);
 return '<p><strong>地区：</strong>'+(d?.name||'城外')+'</p>'+
  '<p><strong>標高：</strong>'+fmt(elevationAt(...n.position),1)+'m</p>'+
  (f?'<p><strong>正本ID：</strong><code>'+f.id+'</code></p>':'')+
  (d?'<p>'+d.identity+'</p>':'<p>王都と広域街道を結ぶ接続点。</p>');
}
function renderBase(){
 el('rect',{x:0,y:0,width:W,height:H,fill:'#e9e5d6'},layers.base);
 const env=el('path',{d:polyD(CAPITAL.activityEnvelope.polygon),fill:'#cdd7bb','fill-opacity':.32,stroke:'#6f8069','stroke-width':2,'stroke-dasharray':'11 7'},layers.envelope);
 title(env,'活動圏 '+fmt(CAPITAL.activityEnvelope.areaKm2,2)+' km² — 城壁の相似拡大ではなく門外街道・河岸・郊外に沿う');
 for(const d of CAPITAL.districts){
  const p=el('path',{d:polyD(d.polygon),fill:d.color,'fill-opacity':.45,stroke:'#6d746e','stroke-width':1.1},layers.districts);
  title(p,d.name+' — '+d.identity);
  activate(p,()=>inspect(d.name,'DISTRICT / '+d.ground,
   '<p>'+d.identity+'</p><p><strong>街路幅の基準：</strong>'+d.streetWidthM+'m　<strong>建築密度：</strong>'+Math.round(d.density*100)+'%</p>'+
   '<p><strong>生活：</strong>'+d.npcJobs.join('・')+'</p><p><strong>状態：</strong>'+d.risk+'</p>'),d.name);
 }
}
function renderElevation(){
 const b=bbox(CAPITAL.core.polygon),nx=36,ny=36,levels=[20,35,50,65,80,95];
 for(const level of levels){
  for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
   const x0=b.minX+(b.maxX-b.minX)*ix/nx,x1=b.minX+(b.maxX-b.minX)*(ix+1)/nx;
   const y0=b.minY+(b.maxY-b.minY)*iy/ny,y1=b.minY+(b.maxY-b.minY)*(iy+1)/ny;
   const corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],vals=corners.map(q=>elevationAt(...q)-level),hits=[];
   for(let e=0;e<4;e++){
    const a=corners[e],c=corners[(e+1)%4],va=vals[e],vc=vals[(e+1)%4];
    if((va<0&&vc>0)||(va>0&&vc<0)){
     const t=Math.abs(va)/(Math.abs(va)+Math.abs(vc));hits.push([a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t]);
    }
   }
   if(hits.length===2)el('path',{d:pathD(hits),fill:'none',stroke:'#8a7860','stroke-width':.75,'stroke-opacity':.38},layers.elevation);
  }
 }
}
function renderBuildings(){
 for(const b of CAPITAL.buildings){
  if(b.facilityId)continue;
  const [x,y]=project(b.position),w=Math.max(2,metresPx(b.widthM)),h=Math.max(2,metresPx(b.depthM));
  el('rect',{x:x-w/2,y:y-h/2,width:w,height:h,rx:.7,fill:b.color,stroke:'#5a5b52','stroke-width':.45,'fill-opacity':.72},layers.buildings);
 }
}
function renderWater(){
 const r=CAPITAL.rivers[0],width=metresPx(document.getElementById('weather').value==='flood'?r.highFlowWidthM:r.widthM);
 el('path',{d:pathD(r.points),fill:'none',stroke:'#b6d1cf','stroke-width':width+5,'stroke-linecap':'round','stroke-linejoin':'round'},layers.river);
 const p=el('path',{d:pathD(r.points),fill:'none',stroke:'#4f8f9c','stroke-width':width,'stroke-linecap':'round','stroke-linejoin':'round'},layers.river);
 title(p,r.name+'　通常'+r.normalWidthRangeM[0]+'–'+r.normalWidthRangeM[1]+'m / 増水'+r.highFlowWidthM+'m');
 for(const b of CAPITAL.bridges){
  const n=el('path',{d:pathD(b.points),fill:'none',stroke:b.floodClosed?'#a58458':'#756d5d','stroke-width':Math.max(3,metresPx(b.widthM)),'stroke-linecap':'square'},layers.river);
  title(n,b.name+(b.floodClosed?'（増水時閉鎖）':'（高橋）'));
 }
}
const roadColours={primary:'#a56c38',ceremonial:'#c49a45',secondary:'#817c67',service:'#787665',alley:'#6c6960',stairs:'#6d5f78',roof:'#6d5f78',world:'#6f875b'};
function renderRoads(){
 const s=state(),closures=new Map(stateClosures(s).map(c=>[c.edgeId,c.reason]));
 for(const e of CAPITAL.edges){
  if(e.class==='world')continue;
  const closed=closures.has(e.id);
  const p=el('path',{d:pathD(e.points),fill:'none',stroke:closed?'#b74f45':roadColours[e.class]||'#817c67',
   'stroke-width':Math.max(1.5,metresPx(e.widthM)),'stroke-linecap':'round','stroke-linejoin':'round',
   'stroke-dasharray':closed?'5 5':'none','data-edge':e.id},layers.roads);
  title(p,e.name+(closed?' — 通行制限 '+closures.get(e.id):''));
 }
 for(const c of CAPITAL.worldConnections){
  const p=el('path',{d:pathD(c.path),fill:'none',stroke:'#6f875b','stroke-width':3,'stroke-dasharray':'10 7','stroke-linecap':'round'},layers.world);
  title(p,c.id+' '+c.name+' — 広域街道への接続。macro '+c.hours+'h は物理歩行時間ではない');
 }
}
function renderWalls(){
 for(const w of CAPITAL.walls){
  el('path',{d:pathD(w.points),fill:'none',stroke:'#504f48','stroke-width':Math.max(2,metresPx(w.widthM)),'stroke-linecap':'square'},layers.walls);
 }
 for(const g of CAPITAL.gates){
  const [x,y]=project(g.position);
  const c=el('circle',{cx:x,cy:y,r:6.4,fill:'#f5e8c4',stroke:'#564838','stroke-width':2},layers.walls);
  title(c,g.name+' — '+fmt(g.widthM)+'m');
 }
}
function renderBeats(){
 const releases=CAPITAL.nodes.filter(n=>n.kind==='plaza'),compressions=CAPITAL.nodes.filter(n=>n.kind==='gate'||n.kind==='checkpoint'||n.kind==='bridge-end');
 for(const n of releases){
  const [x,y]=project(n.position);el('circle',{cx:x,cy:y,r:11,fill:'none',stroke:'#d69b3d','stroke-width':2,'stroke-dasharray':'3 3'},layers.beats);
 }
 for(const n of compressions){
  const [x,y]=project(n.position);el('rect',{x:x-7,y:y-7,width:14,height:14,fill:'none',stroke:'#765c76','stroke-width':2,transform:'rotate(45 '+x+' '+y+')'},layers.beats);
 }
 for(const c of CAPITAL.sightCorridors||[]){
  const a=project(c.points[0]),b=project(c.points[1]),wide=Math.max(5,metresPx(c.widthM));
  el('path',{d:'M'+a[0]+','+a[1]+'L'+b[0]+','+b[1],stroke:'#d8c07a','stroke-width':wide,'stroke-opacity':.16,'stroke-linecap':'round',fill:'none'},layers.beats);
  const line=el('path',{d:'M'+a[0]+','+a[1]+'L'+b[0]+','+b[1],stroke:'#897340','stroke-width':1.4,'stroke-dasharray':'4 7',fill:'none'},layers.beats);title(line,c.intent);
 }
}
function renderFacilities(){
 const s=state(),important=new Set(['LOC_CAP_CASTLE','LOC_CAP_MAGE_TOWER','LOC_CAP_MARKET','LOC_CAP_OFFICE','LOC_CAP_ORPHANAGE','LOC_CAP_BIG_STORE','LOC_CAP_AJIN_QUARTER','LOC_CAP_LOWER_INN','LOC_CAP_STABLE']);
 for(const f of CAPITAL.facilities){
  if(!facilityActive(f,s))continue;
  const [x,y]=project(f.position),major=important.has(f.id);
  const marker=el(f.id==='LOC_CAP_MARKET'||f.id==='LOC_CAP_AJIN_QUARTER'?'circle':'rect',
   f.id==='LOC_CAP_MARKET'||f.id==='LOC_CAP_AJIN_QUARTER'?{cx:x,cy:y,r:major?8:5,fill:'#fff4d5',stroke:'#674f38','stroke-width':2}:
   {x:x-(major?7:5),y:y-(major?7:5),width:major?14:10,height:major?14:10,rx:2,fill:'#fff4d5',stroke:'#674f38','stroke-width':2},layers.facilities);
  title(marker,f.name+' / '+f.id);
  activate(marker,()=>inspect(f.name,'FACILITY',
   '<p><code>'+f.id+'</code></p><p><strong>地区：</strong>'+districtById(f.district)?.name+'</p>'+
   '<p><strong>座標：</strong>'+f.position.map(v=>v.toFixed(3)).join(', ')+' km</p>'+
   '<p><strong>標高：</strong>'+fmt(elevationAt(...f.position),1)+'m</p>'+
   (f.gateTag?'<p><strong>アクセス：</strong>'+f.gateTag+'</p>':'')+
   '<p class="note">'+f.source+'</p>'),f.name);
  if(major){
   const t=el('text',{x:x+10,y:y-10,'font-size':11,fill:'#273c3d','font-weight':650,'paint-order':'stroke',stroke:'#f4f2eb','stroke-width':3},layers.labels);t.textContent=f.name;
  }
 }
 for(const d of CAPITAL.districts){
  const c=d.polygon.reduce((a,p)=>[a[0]+p[0]/d.polygon.length,a[1]+p[1]/d.polygon.length],[0,0]),[x,y]=project(c);
  const t=el('text',{x,y,'text-anchor':'middle','font-size':15,fill:'#435252','fill-opacity':.73,'font-family':'Noto Serif JP,serif','letter-spacing':1.8,'paint-order':'stroke',stroke:'#f4f2eb','stroke-width':3},layers.labels);t.textContent=d.name;
 }
}
function renderClosures(){
 const closed=stateClosures(state());
 for(const c of closed){
  const e=CAPITAL.edges.find(x=>x.id===c.edgeId);if(!e)continue;
  const p=e.points[Math.floor(e.points.length/2)],[x,y]=project(p);
  el('path',{d:'M'+(x-7)+','+(y-7)+'L'+(x+7)+','+(y+7)+'M'+(x+7)+','+(y-7)+'L'+(x-7)+','+(y+7),stroke:'#c84f45','stroke-width':3.5},layers.closures);
 }
}
function drawPolyline(layer,pts,attrs){if(!pts?.length)return null;return el('path',{d:pathD(pts),fill:'none',...attrs},layer);}
function renderNpcFlow(){
 layers.flows.replaceChildren();
 const chosen=document.getElementById('npc-flow').value,flows=chosen?CAPITAL.npcFlows.filter(f=>f.id===chosen):CAPITAL.npcFlows;
 for(const flow of flows){
  const s=state();if(flow.access)s.access='permitted';
  const route=findAlternatives(flow.from,flow.to,s,CAPITAL,1)[0];if(!route)continue;
  const p=drawPolyline(layers.flows,pathPolyline(route),{stroke:'#9d6333','stroke-width':chosen?5:2.1,'stroke-opacity':chosen?.95:.28,'stroke-dasharray':chosen?'7 4':'3 7','stroke-linecap':'round'});
  if(p)title(p,flow.name+' — '+flow.reason);
 }
 const f=CAPITAL.npcFlows.find(x=>x.id===chosen);
 document.getElementById('flow-note').textContent=f?f.reason:'商人・衛兵・役人・荷運び・住民などの生活導線を重ねています。';
}
function clearDynamic(){
 for(const k of ['river','roads','world','closures','route','facilities','labels'])layers[k].replaceChildren();
}
let selectedRoute=null;
function updateRoutes(){
 layers.route.replaceChildren();
 const from=document.getElementById('route-from').value,to=document.getElementById('route-to').value,host=document.getElementById('route-options');
 const alternatives=findAlternatives(from,to,state(),CAPITAL,3);host.replaceChildren();
 if(!alternatives.length){host.innerHTML='<p class="note">この条件では徒歩経路がありません。通行許可・増水・事件状態を確認してください。</p>';selectedRoute=null;return;}
 alternatives.forEach((route,i)=>{
  const b=document.createElement('button');b.className='route-card';b.type='button';b.setAttribute('aria-pressed',i===0?'true':'false');
  const m=route.metrics;b.innerHTML='<span class="route-title">'+(i===0?'主要経路':'代替経路 '+i)+'</span><div class="route-metrics"><strong>'+fmt(m.distanceM/1000,2)+' km</strong><small>徒歩 '+fmt(m.minutes)+'分 / 上り '+fmt(m.ascentM)+'m</small></div><p>'+route.edges.map(e=>e.name).filter((v,j,a)=>a.indexOf(v)===j).join(' → ')+'</p>';
  b.onclick=()=>{host.querySelectorAll('.route-card').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');selectedRoute=route;renderSelectedRoute();};
  host.append(b);
 });
 selectedRoute=alternatives[0];renderSelectedRoute();
}
function renderSelectedRoute(){
 layers.route.replaceChildren();if(!selectedRoute)return;
 drawPolyline(layers.route,pathPolyline(selectedRoute),{stroke:'#e4882f','stroke-width':6,'stroke-linecap':'round','stroke-linejoin':'round','stroke-opacity':.9});
}
function renderState(){
 clearDynamic();renderWater();renderRoads();renderClosures();renderFacilities();
 setLayer('world',layerVisible('world'));setLayer('buildings',layerVisible('buildings'));setLayer('districts',layerVisible('districts'));
 setLayer('elevation',layerVisible('elevation'));setLayer('beats',layerVisible('beats'));setLayer('facilities',layerVisible('facilities'));
 updateRoutes();renderNpcFlow();renderStateNotes();scene3d?.updateState();
}
function renderStateNotes(){
 const s=state(),notes=[];
 if(s.weather==='flood')notes.push('増水：西河岸の低橋を閉鎖。高橋へ流れが移る。');
 if(s.weather==='rain')notes.push('雨：河岸と石段は滑りやすく、視認性も低下する想定。');
 if(s.weather==='fog')notes.push('霧：遠距離ランドマークによる方向回復が弱くなる。');
 if(s.hour>=20||s.hour<6)notes.push('夜：下層・河岸は昼とは違う緊張度。安全拠点は市場・宿・駅馬車場。');
 for(const [id,phase] of Object.entries(s.events))if(phase!=='idle'){
  const e=CAPITAL.encounterStates[id];notes.push(id+' '+e.name+' ['+phase+'] — '+e.resolution);
 }
 const closures=stateClosures(s);if(closures.length)notes.push('現在の通行制限：'+closures.length+' edge');
 document.getElementById('state-notes').innerHTML=notes.length?notes.map(n=>'<p>'+n+'</p>').join(''):'<p>平時。公共街路は通常運用。</p>';
}
function initControls(){
 document.getElementById('core-area').textContent=CAPITAL.core.areaKm2.toFixed(2);
 document.getElementById('core-metric').textContent=CAPITAL.core.areaKm2.toFixed(2)+' km²';
 document.getElementById('envelope-metric').textContent=CAPITAL.activityEnvelope.areaKm2.toFixed(2)+' km²';
 document.getElementById('silhouette-metric').textContent=CAPITAL.atlasSilhouette.areaKm2.toFixed(2)+' km²';
 const choices=['west_gate','south_gate','east_gate','market','castle','mage_tower','office','orphanage','ajin','inn','stable'];
 for(const id of choices){
  const n=nodeById(id);if(!n)continue;
  for(const select of [document.getElementById('route-from'),document.getElementById('route-to')]){
   const o=document.createElement('option');o.value=id;o.textContent=n.name;select.append(o);
  }
 }
 document.getElementById('route-from').value='west_gate';document.getElementById('route-to').value='market';
 for(const [id,e] of Object.entries(CAPITAL.encounterStates)){
  const wrap=document.createElement('label');wrap.textContent=id+' '+e.name;
  const select=document.createElement('select');select.id='event-'+id;
  for(const [v,n] of [['idle','平時'],['active','進行中'],['failed','失敗後'],['resolved','解決後']]){const o=document.createElement('option');o.value=v;o.textContent=n;select.append(o);}
  wrap.append(select);document.getElementById('event-fields').append(wrap);select.addEventListener('change',renderState);
 }
 const npc=document.getElementById('npc-flow');for(const f of CAPITAL.npcFlows){const o=document.createElement('option');o.value=f.id;o.textContent=f.name;npc.append(o);}
 npc.addEventListener('change',renderNpcFlow);
 for(const id of ['route-from','route-to'])document.getElementById(id).addEventListener('change',updateRoutes);
 for(const id of ['weather','hour','access'])document.getElementById(id).addEventListener('change',renderState);
 for(const name of ['districts','buildings','elevation','sightlines','world','beats','facilities']){
  const input=document.getElementById('layer-'+name);if(!input)continue;
  input.addEventListener('change',()=>setLayer(name==='sightlines'?'beats':name,input.checked));
 }
 document.getElementById('layer-sightlines').addEventListener('change',e=>setLayer('beats',e.target.checked||document.getElementById('layer-beats')?.checked));
}
function fit(points,padding=30){
 const ps=points.map(project),b=bbox(ps),w=Math.max(80,b.maxX-b.minX),h=Math.max(80,b.maxY-b.minY),scale=Math.min(W/(w+padding*2),H/(h+padding*2));
 view.w=W/scale;view.h=H/scale;view.x=(b.minX+b.maxX)/2-view.w/2;view.y=(b.minY+b.maxY)/2-view.h/2;applyView();
}
let view={x:0,y:0,w:W,h:H},drag=null;
function applyView(){view.w=Math.max(130,Math.min(W*1.45,view.w));view.h=view.w*H/W;view.x=Math.max(-W*.15,Math.min(W*1.15-view.w,view.x));view.y=Math.max(-H*.15,Math.min(H*1.15-view.h,view.y));svg.setAttribute('viewBox',view.x+' '+view.y+' '+view.w+' '+view.h);updateScale();}
function zoom(f,cx=view.x+view.w/2,cy=view.y+view.h/2){const ow=view.w;view.w*=f;view.h=view.w*H/W;view.x=cx-(cx-view.x)*view.w/ow;view.y=cy-(cy-view.y)*view.h/(ow*H/W);applyView();}
function updateScale(){const rect=svg.getBoundingClientRect(),kmPerPx=(frame.maxX-frame.minX)/W*view.w/rect.width,barKm=[.1,.2,.5,1,2].find(k=>k/kmPerPx>70)||2;document.getElementById('map-scale').textContent=barKm+' km';document.getElementById('map-scale').style.width=(barKm/kmPerPx)+'px';}
function initMapPan(){
 svg.addEventListener('wheel',e=>{e.preventDefault();const r=svg.getBoundingClientRect(),x=view.x+(e.clientX-r.left)/r.width*view.w,y=view.y+(e.clientY-r.top)/r.height*view.h;zoom(e.deltaY>0?1.14:.86,x,y);},{passive:false});
 svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,ox:view.x,oy:view.y};svg.setPointerCapture(e.pointerId);});
 svg.addEventListener('pointermove',e=>{if(!drag)return;const r=svg.getBoundingClientRect();view.x=drag.ox-(e.clientX-drag.x)/r.width*view.w;view.y=drag.oy-(e.clientY-drag.y)/r.height*view.h;applyView();});
 for(const ev of ['pointerup','pointercancel'])svg.addEventListener(ev,()=>drag=null);
 document.getElementById('zoom-in').onclick=()=>zoom(.75);document.getElementById('zoom-out').onclick=()=>zoom(1.32);
 document.getElementById('reset-map').onclick=()=>fit(CAPITAL.core.polygon,52);document.getElementById('envelope-map').onclick=()=>fit(CAPITAL.activityEnvelope.polygon,24);
}
function renderAll(){
 renderBase();renderElevation();renderBuildings();renderBeats();initControls();renderState();initMapPan();fit(CAPITAL.core.polygon,52);
 inspect('中央市場','MAJOR NODE','<p>交易・買物・噂・地区間移動が交差する解放空間。門から市場へは意味の違う複数経路を持つ。</p>');
}

let scene3d=null;
function switchTab(which){
 const isMap=which==='map';tabs.map.setAttribute('aria-selected',String(isMap));tabs.scene.setAttribute('aria-selected',String(!isMap));panels.map.hidden=!isMap;panels.scene.hidden=isMap;
 if(!isMap){if(!scene3d)scene3d=mount3D();else scene3d.resize();}
}
tabs.map.onclick=()=>switchTab('map');tabs.scene.onclick=()=>switchTab('scene');

function mount3D(){
 const B=globalThis.BABYLON,canvas=document.getElementById('greybox'),loading=document.getElementById('scene-loading');
 let mountStage='bootstrap';
 try {
 if(!B){loading.textContent='Babylon.jsを読み込めませんでした。';return {resize(){},updateState(){}};}
 mountStage='babylon-symbols';
 const {Engine,Scene,Vector3,Color3,Color4,HemisphericLight,DirectionalLight,ArcRotateCamera,UniversalCamera,MeshBuilder,Mesh,VertexData,StandardMaterial}=B;
 const V=(x,y,z)=>new Vector3(x,y,z),engine=new Engine(canvas,true,{antialias:true,adaptToDeviceRatio:true}),scene=new Scene(engine);
 scene.clearColor=new Color4(.68,.79,.84,1);scene.collisionsEnabled=true;scene.gravity=V(0,-.32,0);
 const hemi=new HemisphericLight('sky',V(0,1,0),scene);hemi.intensity=.85;hemi.groundColor=new Color3(.32,.34,.31);
 const sun=new DirectionalLight('sun',V(-.5,-1,.35),scene);sun.intensity=1.05;
 const mats=new Map(),mat=(key,hex,alpha=1)=>{if(mats.has(key))return mats.get(key);const m=new StandardMaterial(key,scene);m.diffuseColor=Color3.FromHexString(hex);m.specularColor=Color3.Black();m.alpha=alpha;mats.set(key,m);return m;};
 const stone=mat('stone','#b8b3a4'),wallMat=mat('wall','#77736b'),roadMat=mat('road','#8f7658'),ceremonialMat=mat('ceremonial','#b99a58'),waterMat=mat('water','#3f8ca0',.92),closureMat=mat('closure','#b9433f',.72),gold=mat('gold','#d1ae55'),roof=mat('roof','#66504a'),marketMat=mat('market','#c9a35a');
 mountStage='terrain';
 const coreB=bbox(CAPITAL.core.polygon),margin=.14,minX=coreB.minX-margin,maxX=coreB.maxX+margin,minY=coreB.minY-margin,maxY=coreB.maxY+margin,nx=64,nz=64;
 const positions=[],indices=[],normals=[],uvs=[];
 for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
  const wx=minX+(maxX-minX)*ix/nx,wy=minY+(maxY-minY)*iz/nz,[lx,lz]=toLocal([wx,wy]);
  positions.push(lx,elevationAt(wx,wy),lz);uvs.push(ix/nx,iz/nz);
 }
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=z*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;indices.push(a,c,b,b,c,d);}
 VertexData.ComputeNormals(positions,indices,normals);const vd=new VertexData();Object.assign(vd,{positions,indices,normals,uvs});
 const terrain=new Mesh('capital-terrain',scene);vd.applyToMesh(terrain);terrain.material=mat('ground','#9ca17a');terrain.checkCollisions=true;terrain.isPickable=false;
 function strip(name,pts,width,material,yOffset=.16){
  const left=[],right=[];
  for(let i=0;i<pts.length;i++){
   const prev=pts[Math.max(0,i-1)],next=pts[Math.min(pts.length-1,i+1)],[x,z]=toLocal(pts[i]),[px,pz]=toLocal(prev),[nx2,nz2]=toLocal(next);
   let dx=nx2-px,dz=nz2-pz,len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;const ox=-dz*width/2,oz=dx*width/2,y=elevationAt(...pts[i])+yOffset;
   left.push(V(x+ox,y,z+oz));right.push(V(x-ox,y,z-oz));
  }
  const mesh=MeshBuilder.CreateRibbon(name,{pathArray:[left,right],closeArray:false,closePath:false,sideOrientation:Mesh.DOUBLESIDE},scene);mesh.material=material;mesh.isPickable=false;return mesh;
 }
 mountStage='roads';
 for(const e of CAPITAL.edges.filter(e=>e.class!=='world'))strip('road:'+e.id,e.points,Math.max(3,e.widthM),e.class==='ceremonial'?ceremonialMat:roadMat,.28);
 strip('river',CAPITAL.rivers[0].points,CAPITAL.rivers[0].widthM,waterMat,.36);
 function segmentBox(name,a,b,width,height,material){
  const [ax,az]=toLocal(a),[bx,bz]=toLocal(b),dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz),mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],y=elevationAt(...mid);
  const m=MeshBuilder.CreateBox(name,{width:len,height,depth:width},scene);m.position=V((ax+bx)/2,y+height/2,(az+bz)/2);m.rotation.y=-Math.atan2(dz,dx);m.material=material;m.checkCollisions=true;m.isPickable=false;return m;
 }
 mountStage='walls';
 for(const w of CAPITAL.walls)segmentBox(w.id,w.points[0],w.points[1],w.widthM,w.heightM,wallMat);
 for(const b of CAPITAL.bridges){const m=segmentBox('bridge:'+b.id,b.points[0],b.points[1],b.widthM,1.1,stone);m.position.y=b.deckHeightM;}
 mountStage='district-buildings';
 const districtMeshes=new Map();
 for(const d of CAPITAL.districts){
  const parts=[];
  for(const b of CAPITAL.buildings.filter(x=>x.district===d.id&&!x.facilityId)){
   const [x,z]=toLocal(b.position),y=elevationAt(...b.position),m=MeshBuilder.CreateBox('parcel',{width:b.widthM,height:b.heightM,depth:b.depthM},scene);
   m.position=V(x,y+b.heightM/2,z);m.material=mat('d:'+d.id,d.color);m.isPickable=false;parts.push(m);
  }
  if(parts.length){const merged=Mesh.MergeMeshes(parts,true,true,undefined,false,true);merged.name='district-mass:'+d.id;merged.material=mat('d:'+d.id,d.color);merged.checkCollisions=true;districtMeshes.set(d.id,merged);}
 }
 function tower(x,z,y,h,r,material){
  const shaft=MeshBuilder.CreateCylinder('tower',{diameter:r*2,height:h,tessellation:8},scene);shaft.position=V(x,y+h/2,z);shaft.material=material;shaft.checkCollisions=true;
  const cap=MeshBuilder.CreateCylinder('spire',{diameterTop:0,diameterBottom:r*2.5,height:r*2.2,tessellation:8},scene);cap.position=V(x,y+h+r*1.1,z);cap.material=roof;return shaft;
 }
 mountStage='facilities';
 for(const f of CAPITAL.facilities.filter(x=>x.footprintM[0]&&x.id!=='LOC_CAP_BIG_STORE')){
  const [x,z]=toLocal(f.buildingPosition),y=elevationAt(...f.buildingPosition);
  if(f.id==='LOC_CAP_CASTLE'){
   const keep=MeshBuilder.CreateBox('王城',{width:150,height:62,depth:118},scene);keep.position=V(x,y+31,z);keep.material=stone;keep.checkCollisions=true;
   for(const [ox,oz] of [[-62,-46],[62,-46],[-62,46],[62,46]])tower(x+ox,z+oz,y,82,10,stone);
   tower(x,z,y+19,108,13,stone);
   const crown=MeshBuilder.CreateCylinder('王城主塔冠',{diameterTop:0,diameterBottom:34,height:34,tessellation:8},scene);crown.position=V(x,y+144,z);crown.material=roof;
  }else if(f.id==='LOC_CAP_MAGE_TOWER'){
   tower(x,z,y,118,17,mat('mage','#777e9e'));tower(x,z,y+80,58,8.5,mat('mage','#777e9e'));
  }else{
   const m=MeshBuilder.CreateBox(f.id,{width:f.footprintM[0],height:f.heightM,depth:f.footprintM[1]},scene);m.position=V(x,y+f.heightM/2,z);m.material=stone;m.checkCollisions=true;
  }
 }
 mountStage='market-and-gates';
 const market=nodeById('market'),[mx,mz]=toLocal(market.position),my=elevationAt(...market.position);
 const plaza=MeshBuilder.CreateCylinder('market-plaza',{diameter:175,height:.55,tessellation:48},scene);plaza.position=V(mx,my+.35,mz);plaza.material=marketMat;
 for(const g of CAPITAL.gates){
  const [x,z]=toLocal(g.position),y=elevationAt(...g.position);tower(x-11,z,y,24,5,stone);tower(x+11,z,y,24,5,stone);
 }
 mountStage='closures';
 const closureMeshes=new Map();
 const closable=new Set([...Object.values(CAPITAL.encounterStates).flatMap(e=>e.blockedEdgeIds),...CAPITAL.bridges.filter(b=>b.floodClosed).map(b=>b.id)]);
 for(const id of closable){
  const e=CAPITAL.edges.find(x=>x.id===id);if(!e)continue;const a=e.points[0],b=e.points.at(-1),mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],[x,z]=toLocal(mid),y=elevationAt(...mid);
  const barrier=MeshBuilder.CreateBox('closure:'+id,{width:12,height:3,depth:2},scene);barrier.position=V(x,y+1.5,z);barrier.material=closureMat;barrier.checkCollisions=true;barrier.setEnabled(false);closureMeshes.set(id,barrier);
 }
 mountStage='camera';
 const castleNode=nodeById('castle'),[cx,cz]=toLocal(castleNode.position),cy=elevationAt(...castleNode.position);
 const target=V((mx+cx)*.5,(my+cy)*.5+30,(mz+cz)*.5),orbit=new ArcRotateCamera('capital-orbit',Math.PI/2,.82,2450,target,scene);orbit.minZ=.5;orbit.lowerRadiusLimit=180;orbit.upperRadiusLimit=4800;orbit.wheelPrecision=5;orbit.panningSensibility=850;orbit.attachControl(canvas,true);scene.activeCamera=orbit;
 let walk=null;const pressed=new Set();
 const keydown=e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){pressed.add(e.code);if(walk)e.preventDefault();}};
 const keyup=e=>pressed.delete(e.code);window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);
 function startWalk(){
  if(walk){walk.dispose();walk=null;}
  const start=nodeById(document.getElementById('route-from').value)||market,[x,z]=toLocal(start.position),y=elevationAt(...start.position);
  orbit.detachControl();walk=new UniversalCamera('walker',V(x,y+2.0,z),scene);walk.minZ=.12;walk.inertia=.25;walk.angularSensibility=3300;walk.checkCollisions=true;walk.applyGravity=true;walk.ellipsoid=V(.48,.9,.48);walk.ellipsoidOffset=V(0,.9,0);walk.keysUp=[];walk.keysDown=[];walk.keysLeft=[];walk.keysRight=[];walk.attachControl(canvas,true);scene.activeCamera=walk;document.body.classList.add('walking-capital');loading.hidden=true;
 }
 function stopWalk(){if(walk){walk.detachControl();walk.dispose();walk=null;}scene.activeCamera=orbit;orbit.attachControl(canvas,true);document.body.classList.remove('walking-capital');}
 document.getElementById('walk-start').onclick=startWalk;document.getElementById('walk-stop').onclick=stopWalk;
 document.getElementById('focus-castle').onclick=()=>{stopWalk();const n=nodeById('castle'),[x,z]=toLocal(n.position);orbit.setTarget(V(x,elevationAt(...n.position)+35,z));orbit.radius=900;};
 for(const button of document.querySelectorAll('[data-walk]')){
  const map={ArrowUp:'ArrowUp',ArrowDown:'ArrowDown',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight'},code=map[button.dataset.walk]||button.dataset.walk;
  button.onpointerdown=e=>{pressed.add(code);button.setPointerCapture(e.pointerId);e.preventDefault();};button.onpointerup=button.onpointercancel=()=>pressed.delete(code);button.onlostpointercapture=()=>pressed.delete(code);
 }
 function updateState(){
  const s=state(),closed=new Set(stateClosures(s).map(x=>x.edgeId));for(const [id,m] of closureMeshes)m.setEnabled(closed.has(id));
  scene.fogEnabled=s.weather==='fog';scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=.00048;scene.fogColor=new Color3(.68,.72,.70);
  scene.clearColor=s.hour>=20||s.hour<6?new Color4(.07,.10,.15,1):s.weather==='rain'?new Color4(.45,.55,.58,1):new Color4(.68,.79,.84,1);
 }
 updateState();
 scene.onBeforeRenderObservable.add(()=>{
  if(!walk)return;
  const fast=pressed.has('ShiftLeft')||pressed.has('ShiftRight'),step=(fast?10:5.2)*engine.getDeltaTime()/1000,forward=walk.getForwardRay().direction.clone();forward.y=0;forward.normalize();
  const right=V(forward.z,0,-forward.x),move=V(0,0,0);
  if(pressed.has('KeyW')||pressed.has('ArrowUp'))move.addInPlace(forward);
  if(pressed.has('KeyS')||pressed.has('ArrowDown'))move.subtractInPlace(forward);
  if(pressed.has('KeyD')||pressed.has('ArrowRight'))move.addInPlace(right);
  if(pressed.has('KeyA')||pressed.has('ArrowLeft'))move.subtractInPlace(right);
  if(move.lengthSquared()>0)walk.cameraDirection.addInPlace(move.normalize().scale(step));
  const [wx,wy]=fromLocal([walk.position.x,walk.position.z]),district=CAPITAL.districts.find(d=>pointInPolygon([wx,wy],d.polygon)),landmarks=['castle','mage_tower','market'].map(id=>nodeById(id)).sort((a,b)=>distance([wx,wy],a.position)-distance([wx,wy],b.position));
  document.getElementById('telemetry').textContent='徒歩 · '+(district?.name||'城門外')+' · 標高 '+fmt(elevationAt(wx,wy),1)+'m · 近い目印 '+landmarks[0].name+' '+fmt(distance([wx,wy],landmarks[0].position))+'m'+(fast?' · 走行':'');
 });
 engine.runRenderLoop(()=>scene.render());window.addEventListener('resize',()=>engine.resize());
 mountStage='render-loop';
 loading.hidden=true;
 return {resize(){engine.resize();},updateState,dispose(){window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);engine.dispose();}};
 } catch (error) {
  console.error('Capital 3D mount failed at '+mountStage,error);
  loading.hidden=false;
  loading.textContent='3D初期化エラー ['+mountStage+']：'+(error?.message||String(error));
  return {resize(){},updateState(){}};
 }
}

document.getElementById('export').onclick=()=>{
 const payload={...CAPITAL,reviewState:state()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='capital-authored-core-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
};
window.addEventListener('resize',updateScale);
window.addEventListener('pagehide',()=>scene3d?.dispose?.(),{once:true});
renderAll();
