import {CAPITAL,toLocal,fromLocal,elevationAt,pointInPolygon,distance} from './capital-data.js';
import {findAlternatives,pathPolyline,stateClosures,normalizeState} from './capital-routing.js';
import {mountCapitalScene} from './capital-scene.js';
import {trafficPlans,trafficPressure} from './capital-traffic.js';

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
for(const id of ['base','terrain','envelope','districts','elevation','spaces','buildings','river','roads','world','walls','beats','closures','flows','route','facilities','labels']){
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
   '<p>'+d.identity+'</p><p><strong>街路幅の基準：</strong>'+d.streetWidthM+'m　<strong>街区配置の密度係数：</strong>'+Math.round(d.density*100)+'%</p>'+
   '<p><strong>生活：</strong>'+d.npcJobs.join('・')+'</p><p><strong>状態：</strong>'+d.risk+'</p>'),d.name);
 }
}
function renderElevation(){
 const b=bbox(CAPITAL.core.polygon),nx=60,ny=60,levels=[20,35,50,65,80,95,110,125,140];
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
function renderHeightLabels(){for(const id of ['castle','royal_gate','noble_square','office','market','lower_court']){const n=nodeById(id),[x,y]=project(n.position),text=el('text',{x:x+8,y:y+13,fill:'#624f3c','font-size':9,'paint-order':'stroke',stroke:'#e9e5d6','stroke-width':2},layers.elevation);text.textContent=fmt(elevationAt(...n.position))+'m';}}
function renderSpaces(){
 for(const space of CAPITAL.negativeSpaces){
  const [x,y]=project(space.position),c=el('circle',{cx:x,cy:y,r:metresPx(space.radiusM),fill:space.kind==='garden'?'#76976b':'#fbf1d3',stroke:'#887c61','stroke-width':.8},layers.spaces);
  title(c,space.name+' — '+space.value);
 }
}
function renderUrbanTerrain(){
 const b=bbox(CAPITAL.activityEnvelope.polygon),step=.045;
 for(let x=b.minX;x<b.maxX;x+=step)for(let y=b.minY;y<b.maxY;y+=step){const p=[x+step/2,y+step/2];if(!pointInPolygon(p,CAPITAL.activityEnvelope.polygon))continue;const h=elevationAt(...p),shade=Math.max(0,Math.min(1,h/150)),[px,py]=project([x,y+step]);
  el('rect',{x:px,y:py,width:step*sx+.1,height:step*sy+.1,fill:'rgb('+Math.round(144+shade*54)+','+Math.round(156+shade*34)+','+Math.round(113+shade*51)+')'},layers.terrain);
 }
 for(const o of CAPITAL.outskirts){const [x,y]=project(o.position);el('rect',{x:x-metresPx(o.radiusM),y:y-metresPx(o.radiusM),width:metresPx(o.radiusM*2),height:metresPx(o.radiusM*2),fill:o.kind==='farmland'?'#b0a168':'#b5a180','fill-opacity':.6},layers.terrain);}
}
let urbanForm=true;
function setMapMode(urban){urbanForm=urban;document.getElementById('urban-form').setAttribute('aria-pressed',String(urban));document.getElementById('topology-debug').setAttribute('aria-pressed',String(!urban));
 setLayer('districts',!urban&&layerVisible('districts'));setLayer('beats',!urban&&layerVisible('sightlines'));setLayer('terrain',urban);setLayer('elevation',urban||layerVisible('elevation'));setLayer('world',urban||layerVisible('world'));setLayer('flows',!urban);setLayer('route',!urban);setLayer('closures',!urban);setLayer('facilities',!urban&&layerVisible('facilities'));
 for(const n of layers.roads.children){const e=CAPITAL.edges.find(e=>e.id===n.dataset.edge);if(e){n.setAttribute('stroke',urban?'#b7aa8e':roadColours[e.class]||'#817c67');n.setAttribute('stroke-width',urban?metresPx(e.widthM):Math.max(1.5,metresPx(e.widthM)));}}
 document.getElementById('map-mode-note').textContent=urban?'Urban Form View · 実寸の建築・街路幅・水系・城壁・標高。地区色と経路記号を除いた都市形態。':'Topology / Debug View · 接続・通行条件・地区・設計beatの監査用。';
}
function renderBuildings(){
 for(const b of CAPITAL.buildings){

  const [x,y]=project(b.position),w=metresPx(b.widthM),h=metresPx(b.depthM);
  el('rect',{x:x-w/2,y:y-h/2,width:w,height:h,rx:.7,transform:'rotate('+((b.rotationRad||0)*180/Math.PI)+' '+x+' '+y+')',fill:districtById(b.district)?.profile.roof||'#6b6354',stroke:'#514d44','stroke-width':.25,'fill-opacity':.96},layers.buildings);
 }
}
function renderWater(){
 for(const r of CAPITAL.rivers.filter(r=>r.context))el('path',{d:pathD(r.points),fill:'none',stroke:'#4f8f9c','stroke-width':metresPx(r.widthM),'stroke-linecap':'round'},layers.river);
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
const roleLabels={'critical-logistics':'物流主動線','orientation-ceremonial':'方向づけ・儀礼軸','optional-life':'生活回遊路','service-logistics':'荷役・業務路','desire-path':'裏路地の近道','desire-shortcut':'高低差ショートカット','world-connector':'広域接続'};
function renderRoads(){
 const s=state(),closures=new Map(stateClosures(s).map(c=>[c.edgeId,c.reason]));
 for(const e of CAPITAL.edges){
  if(e.class==='world')continue;
  const closed=closures.has(e.id);
  const p=el('path',{d:pathD(e.points),fill:'none',stroke:closed?'#b74f45':roadColours[e.class]||'#817c67',
   'stroke-width':Math.max(1.5,metresPx(e.widthM)),'stroke-linecap':'round','stroke-linejoin':'round',
   'stroke-dasharray':closed?'5 5':'none','data-edge':e.id},layers.roads);
  title(p,e.name+' / '+(roleLabels[e.designRole]||e.designRole)+(closed?' — 通行制限 '+closures.get(e.id):''));
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
 const beatColours={compression:'#765c76',release:'#d69b3d',prospect:'#497d83',refuge:'#5f7d63','desire-path':'#8b6e9b','social-gate':'#9d5550',decision:'#ae7d38','hazard-edge':'#b05f4d',reveal:'#8f783e'};
 for(const c of CAPITAL.sightCorridors||[]){
  const a=project(c.points[0]),b=project(c.points[1]),wide=Math.max(5,metresPx(c.widthM));
  el('path',{d:'M'+a[0]+','+a[1]+'L'+b[0]+','+b[1],stroke:'#d8c07a','stroke-width':wide,'stroke-opacity':.16,'stroke-linecap':'round',fill:'none'},layers.beats);
  const line=el('path',{d:'M'+a[0]+','+a[1]+'L'+b[0]+','+b[1],stroke:'#897340','stroke-width':1.4,'stroke-dasharray':'4 7',fill:'none'},layers.beats);title(line,c.intent);
 }
 for(const beat of CAPITAL.levelDesignBeats||[]){
  const [x,y]=project(beat.position),colour=beatColours[beat.type]||'#6b6960';
  const angular=['compression','social-gate','hazard-edge','decision'].includes(beat.type);
  const marker=angular
   ?el('rect',{x:x-7,y:y-7,width:14,height:14,fill:'#fff8df','fill-opacity':.82,stroke:colour,'stroke-width':2.4,transform:'rotate(45 '+x+' '+y+')'},layers.beats)
   :el('circle',{cx:x,cy:y,r:8,fill:'#fff8df','fill-opacity':.82,stroke:colour,'stroke-width':2.4},layers.beats);
  title(marker,beat.name+' — '+beat.intent);
  activate(marker,()=>inspect(beat.name,'LEVEL DESIGN / '+beat.type,
   '<p>'+beat.intent+'</p><p><strong>設計原則：</strong>'+beat.type+'</p><p class="note">Deep Researchを王都topologyへ適用した制作側の設計beat。正本の固有施設設定ではない。</p>'),beat.name);
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
 const chosen=document.getElementById('npc-flow').value,plans=trafficPlans(state()),pressure=trafficPressure(plans);
 for(const e of CAPITAL.edges){const count=pressure.get(e.id)||0;if(count<7)continue;
  const p=drawPolyline(layers.flows,e.points,{stroke:'#bd633b','stroke-width':Math.min(13,3+count/2),'stroke-opacity':.22,'stroke-linecap':'round'});if(p)title(p,'共有道路の交通負荷：'+count+'（レビュー代理人数）');
 }
 for(const plan of plans.filter(p=>!chosen||p.id===chosen)){
  const p=drawPolyline(layers.flows,plan.points,{stroke:plan.oneWay?'#a45145':'#9d6333','stroke-width':chosen?5:2.1,'stroke-opacity':chosen?.95:.28,'stroke-dasharray':chosen?'7 4':'3 7','stroke-linecap':'round'});
  if(p)title(p,plan.name+' ×'+plan.count+' — '+plan.purpose);
 }
 const selected=plans.find(p=>p.id===chosen),count=plans.reduce((n,p)=>n+(p.route?p.count:0),0);
 document.getElementById('flow-note').textContent=selected?selected.flow.reason+' / '+selected.purpose+' / '+selected.count+'人':state().hour+'時：'+count+'人の代理NPC。濃い帯はプレイヤーと共有する混雑街路。時刻・事件・増水で経路が変わります。';
}
function clearDynamic(){
 for(const k of ['river','roads','world','closures','route','facilities','labels'])layers[k].replaceChildren();
}
let selectedRoute=null;
function updateRoutes(){
 layers.route.replaceChildren();
 const from=document.getElementById('route-from').value,to=document.getElementById('route-to').value,host=document.getElementById('route-options');
 const alternatives=findAlternatives(from,to,state(),CAPITAL,3);host.replaceChildren();
 if(!alternatives.length){host.innerHTML='<p class="note">この条件では徒歩経路がありません。通行許可・増水・事件状態を確認してください。</p>';selectedRoute=null;scene3d?.routeChanged?.();return;}
 alternatives.forEach((route,i)=>{
  const b=document.createElement('button');b.className='route-card';b.type='button';b.setAttribute('aria-pressed',i===0?'true':'false');
  const m=route.metrics,roles=route.edges.map(e=>roleLabels[e.designRole]||e.designRole).filter((v,j,a)=>a.indexOf(v)===j);b.innerHTML='<span class="route-title">'+(i===0?'主要経路':'代替経路 '+i)+'</span><div class="route-metrics"><strong>'+fmt(m.distanceM/1000,2)+' km</strong><small>徒歩 '+fmt(m.minutes)+'分 / 上り '+fmt(m.ascentM)+'m</small></div><div class="route-character">'+roles.join(' / ')+'</div><p>'+route.edges.map(e=>e.name).filter((v,j,a)=>a.indexOf(v)===j).join(' → ')+'</p>';
  b.onclick=()=>{host.querySelectorAll('.route-card').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');selectedRoute=route;renderSelectedRoute();scene3d?.routeChanged?.();};
  host.append(b);
 });
 selectedRoute=alternatives[0];renderSelectedRoute();scene3d?.routeChanged?.();
}
function renderSelectedRoute(){
 layers.route.replaceChildren();if(!selectedRoute)return;
 drawPolyline(layers.route,pathPolyline(selectedRoute),{stroke:'#e4882f','stroke-width':6,'stroke-linecap':'round','stroke-linejoin':'round','stroke-opacity':.9});
}
function renderState(){
 clearDynamic();renderWater();renderRoads();renderClosures();renderFacilities();
 setLayer('world',layerVisible('world'));setLayer('buildings',layerVisible('buildings'));setLayer('districts',layerVisible('districts'));
 setLayer('elevation',layerVisible('elevation'));setLayer('beats',document.getElementById('layer-sightlines').checked);setLayer('facilities',layerVisible('facilities'));
 updateRoutes();renderNpcFlow();renderStateNotes();setMapMode(urbanForm);scene3d?.updateState();
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
 const choices=['west_gate','south_gate','east_gate','market','castle','mage_tower','office','orphanage','ajin','inn','stable','lower_court','south_cross','roof_stair','roof_landing','quay_refuge','world_R06','world_R11','world_R12','world_R13'];
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
 renderBase();renderUrbanTerrain();renderElevation();renderHeightLabels();renderSpaces();renderBuildings();renderWalls();renderBeats();initControls();renderState();initMapPan();fit(CAPITAL.core.polygon,52);
 inspect('中央市場','MAJOR NODE','<p>交易・買物・噂・地区間移動が交差する解放空間。門から市場へは意味の違う複数経路を持つ。</p>');
}

let scene3d=null;
function switchTab(which){
 const isMap=which==='map';tabs.map.setAttribute('aria-selected',String(isMap));tabs.scene.setAttribute('aria-selected',String(!isMap));panels.map.hidden=!isMap;panels.scene.hidden=isMap;
 if(!isMap){if(!scene3d)scene3d=mount3D();else scene3d.resize();}
}
tabs.map.onclick=()=>switchTab('map');tabs.scene.onclick=()=>switchTab('scene');

function mount3D(){
 const loading=document.getElementById('scene-loading');
 try{return mountCapitalScene(state,()=>selectedRoute);}
 catch(error){console.error('Capital 3D',error);loading.hidden=false;loading.textContent='3D表示を開始できません：'+error.message;return {resize(){},updateState(){}};}
}

document.getElementById('export').onclick=()=>{
 const payload={...CAPITAL,reviewState:state()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='capital-authored-core-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
};
window.addEventListener('resize',updateScale);
window.addEventListener('pagehide',()=>scene3d?.dispose?.(),{once:true});
document.getElementById('urban-form').onclick=()=>setMapMode(true);document.getElementById('topology-debug').onclick=()=>setMapMode(false);
renderAll();
