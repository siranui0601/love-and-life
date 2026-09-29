import {WORLD,mainland,crimeIsland,terrain,settlements,places,routes,areaOf,pointInPolygon,coast,landAreaKm2,seaAreaKm2,exportBlueprint} from './geography.js';

const NS='http://www.w3.org/2000/svg',S=25,W=1200,H=900;
const svg=document.getElementById('map'),inspector=document.getElementById('inspection');
const fmt=v=>v.toLocaleString('ja-JP',{maximumFractionDigits:2});
const scr=p=>[p[0]*S,(36-p[1])*S];
function el(tag,attrs={},parent=svg){const n=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))n.setAttribute(key,value);parent.append(n);return n;}
function polygon(points){return points.map((p,i)=>{const q=scr(p);return(i?'L':'M')+q[0].toFixed(2)+','+q[1].toFixed(2);}).join(' ')+'Z';}
function curved(points){
 const p=points.map(scr);let out='M'+p[0][0]+','+p[0][1];
 for(let i=0;i<p.length-1;i++){const a=p[Math.max(0,i-1)],b=p[i],c=p[i+1],d=p[Math.min(p.length-1,i+2)];
  const q=[b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6,c[0]-(d[0]-b[0])/6,c[1]-(d[1]-b[1])/6,c[0],c[1]];
  out+=' C'+q.map(v=>v.toFixed(2)).join(',');
 }return out;
}
const defs=el('defs');
const landMask=el('clipPath',{id:'land-mask'},defs);el('path',{d:polygon(mainland)},landMask);
const layers={};for(const n of ['sea','land','terrain','relief','water','activity','roads','cities','labels'])layers[n]=el('g',{'data-layer':n});
layers.terrain.setAttribute('clip-path','url(#land-mask)');layers.relief.setAttribute('clip-path','url(#land-mask)');layers.water.setAttribute('clip-path','url(#land-mask)');
function info(title,category,body){inspector.innerHTML='<span class="eyebrow">'+category+'</span><h2>'+title+'</h2>'+body;}
function active(node,title,category,body){
 node.classList.add('interactive');node.setAttribute('tabindex','0');node.setAttribute('role','button');node.setAttribute('aria-label',title);
 for(const event of ['mouseenter','focus','click'])node.addEventListener(event,()=>info(title,category,body));
}
el('rect',{x:0,y:0,width:W,height:H,fill:'#305b77'},layers.sea);
for(let i=0;i<80;i++){const x=15+i*159%W,y=12+i*97%H;el('path',{d:'M'+x+','+y+' q8,-4 17,0',fill:'none',stroke:'#c3e3e0','stroke-width':1,opacity:.25},layers.sea);}
const land=el('path',{d:polygon(mainland),fill:'#c9ba8b',stroke:'#f4e5bd','stroke-width':2.9},layers.land);
el('path',{d:polygon(crimeIsland),fill:'#77766b',stroke:'#e6d6a8','stroke-width':2.8},layers.land);
active(land,'大陸','陸地の輪郭','<p>大陸の平面積：<strong>'+fmt(coast.mainlandAreaKm2)+' km²</strong>。海、河川、街道、建築域とは別の地理要素として定義。</p>');
for(const t of terrain){
 const n=el('path',{d:polygon(t.points),fill:t.color,stroke:t.id==='emerald-forest'?'#1b5135':'#a7a48c','stroke-width':t.id==='emerald-forest'?3:1.1,opacity:.98},layers.terrain);
 active(n,t.name,'地形ポリゴン','<div class="big-number">'+fmt(areaOf(t.points))+'<small> km²</small></div><p>'+ (t.id==='emerald-forest'?'森林220km²の全域を一続きの地形として扱う。「森」の施設マーカーは存在しない。':'地形の核となる範囲。隣接する丘陵・低地との遷移は重なる。')+'</p>');
}
const forest=terrain.find(t=>t.id==='emerald-forest');
for(let i=0;i<670;i++){
 const x=28+i*.618033988749895%1*20,y=10+i*.754877666246693%1*16;
 if(!pointInPolygon([x,y],forest.points)||!pointInPolygon([x,y],mainland))continue;
 const p=scr([x,y]);el('circle',{cx:p[0],cy:p[1],r:1.45+i%5*.22,fill:i%5?'#1b4e34':'#adc787',opacity:i%5?.48:.8},layers.relief);
}
for(let i=0;i<32;i++){const x=8+i%8*2.65,y=27+Math.floor(i/8)*2.4;if(!pointInPolygon([x,y],mainland))continue;const p=scr([x,y]);
 el('path',{d:'M'+(p[0]-7)+','+(p[1]+5)+' L'+p[0]+','+(p[1]-7-i%3*2)+' L'+(p[0]+7)+','+(p[1]+5),fill:'none',stroke:'#e9eeeb','stroke-width':1.35,opacity:.78},layers.relief);
}
for(let i=0;i<22;i++){const p=scr([35+i%6*2.1,27+Math.floor(i/6)*2.1]);
 el('path',{d:'M'+(p[0]-6)+','+(p[1]+5)+' L'+p[0]+','+(p[1]-10)+' L'+(p[0]+6)+','+(p[1]+5),fill:'none',stroke:i%5?'#242934':'#bf634b','stroke-width':1.7,opacity:.82},layers.relief);
}
const rivers=[
 {name:'北山の雪解け川',width:3.3,points:[[22.8,32.7],[23.8,29],[25,26],[23.7,23.6],[25.8,21],[26.2,18.7],[27.1,16.1],[29.8,14.8],[32.5,13.7],[37,12.4],[43,11.8],[47.4,12.4]]},
 {name:'翡翠の森の水路',width:2.5,points:[[39.6,24],[39,22],[40.4,19.2],[39.5,16.9],[37.5,15],[38.2,12.6],[41.2,11.2]]},
 {name:'田園の用水路',width:1.9,points:[[26.2,18.7],[24.7,15.7],[24.3,12.9],[22.8,10],[19.8,8.4],[15.8,5.8]]}
];
for(const r of rivers){const n=el('path',{d:curved(r.points),fill:'none',stroke:'#4e94b9','stroke-width':r.width,'stroke-linecap':'round'},layers.water);
 active(n,r.name,'河川','<p>流路を地形と一体化した線として定義。渡河・橋・水路の接続は今後の3D設計に引き継ぐ。</p>');
}
for(const pos of [[26.4,17.2],[24.3,13.3],[38.1,14.4]]){const p=scr(pos);el('rect',{x:p[0]-5,y:p[1]-1.6,width:10,height:3.2,fill:'#f2ddb0',stroke:'#665947','stroke-width':.8},layers.water);}
const farm=settlements.find(s=>s.id==='farm');
for(const s of settlements){
 if(s.id==='crime')continue;
 const a=el('path',{d:polygon(s.activity),fill:s.id==='farm'?'#d7c676':'none','fill-opacity':.57,stroke:s.id==='farm'?'#89743e':'#c5a46f','stroke-width':1.35,'stroke-dasharray':'5 4',opacity:.83},layers.activity);
 active(a,s.name+' の周辺圏','活動域（建築域とは別）','<div class="big-number">'+fmt(areaOf(s.activity))+'<small> km²</small></div><p>市街・施設の建築面積とは別の周辺空間。</p>');
}
for(const r of routes){
 const c=r.type==='sea'?'#79c9e9':r.type==='hidden'?'#c1dca2':r.type==='restricted'||r.type==='tunnel'?'#ba9bd0':'#9b6849';
 el('path',{d:curved(r.points),fill:'none',stroke:c,'stroke-width':r.type==='sea'?2.6:2.1,'stroke-dasharray':r.type==='road'?'5 3':r.type==='sea'?'8 5':'3 5','stroke-linecap':'round'},layers.roads);
 const n=el('path',{d:curved(r.points),fill:'none',stroke:'transparent','stroke-width':11},layers.roads);
 const a=places.find(p=>p.id===r.from)?.name||r.from,b=places.find(p=>p.id===r.to)?.name||r.to;
 active(n,r.id+' '+a+' ↔ '+b,'交通経路','<p>設定上の移動目安：<strong>'+(r.hours<1?Math.round(r.hours*60)+'分':r.hours+'時間')+'</strong>。街道は通行しやすい道であり、それ以外の地形も歩行対象。</p>');
}
const colors={capital:'#efdeb8',trade:'#d5ac79',blackridge:'#353035',crime:'#322d30',fortress:'#e1e2da',dwarf:'#6e5e50',farm:'#e3d28b',temple:'#eed7a5',frontier:'#c5a080',elf:'#b2d99c'};
for(const s of settlements){
 const n=el('path',{d:polygon(s.points),fill:colors[s.id]||'#ddd',stroke:s.id==='crime'||s.id==='blackridge'?'#eac59a':'#3a382f','stroke-width':2.1,'stroke-linejoin':'round'},layers.cities);
 active(n,s.name,'建築域（実面積）','<div class="big-number">'+fmt(areaOf(s.points))+'<small> km²</small></div><p>活動圏 '+fmt(s.activityKm2)+' km²。建物の位置を表すイラスト用アイコンではなく、面積補正済みの市街輪郭。</p>');
}
function icon(s){
 const p=scr(s.center),g=el('g',{transform:'translate('+p[0]+' '+p[1]+')'},layers.cities);
 if(s.id==='capital'){el('path',{d:'M-7,6 L-7,-3 L-3,-3 L-3,-8 L3,-8 L3,-3 L7,-3 L7,6 Z',fill:'#40352f',stroke:'#f4e8c8','stroke-width':.8},g);}
 else if(s.id==='trade'){el('path',{d:'M-15,8 H-22 M-15,3 H-22 M-14,-2 H-21',stroke:'#ead8b1','stroke-width':1.8},g);}
 else if(s.id==='temple'){for(const x of [-5,0,5])el('rect',{x:x-1,y:-4,width:2,height:9,fill:'#514336'},g);}
 else if(s.id==='elf'){el('path',{d:'M0,7 V-9 M-5,-4 L0,-11 L5,-4',stroke:'#eeefca','stroke-width':1.8,fill:'none'},g);}
 else if(s.id==='dwarf'){el('path',{d:'M-5,5 Q-7,-7 0,-7 Q7,-7 5,5 Z',fill:'#292425'},g);}
}
settlements.forEach(icon);
function label(name,pos,origin=null,type='town'){
 const p=scr(pos),w=Math.max(66,16+name.length*13),g=el('g',{'class':'map-label '+type},layers.labels);
 if(origin){const q=scr(origin);if(Math.hypot(q[0]-p[0],q[1]-p[1])>22)el('path',{d:'M'+q[0]+','+q[1]+' L'+p[0]+','+(p[1]+6),fill:'none',stroke:'#695c47','stroke-width':1},g);}
 el('rect',{x:p[0]-w/2,y:p[1]-14,width:w,height:22,rx:4,fill:type==='town'?'#1e2d29':'#eee4c9e6',stroke:type==='town'?'#ddc592':'#78916d','stroke-width':1},g);
 const t=el('text',{x:p[0],y:p[1]+1,'text-anchor':'middle','font-size':12,'font-weight':700,fill:type==='town'?'#f4e8d1':'#385843'},g);t.textContent=name;
}
for(const [id,pos] of [
 ['trade',[9.4,19.3]],['capital',[25.3,18]],['blackridge',[40,30.7]],['crime',[4.9,8.1]],
 ['fortress',[21.6,32.1]],['dwarf',[13.1,26.4]],['farm',[24,10.3]],['temple',[19.4,6.3]],
 ['frontier',[18.8,1.35]],['elf',[42.6,18.65]]
]){const s=settlements.find(s=>s.id===id);label(s.name,pos,s.center);}
for(const [name,pos] of [
 ['翡翠の森',[36.4,17.8]],['北の山脈',[18,30.9]],['黒の山脈',[43.4,33.5]],
 ['緑の平原',[17.1,18.6]],['乾きの高原',[37.5,6.4]],['碧の海',[2.8,19.5]],['夕凪の海',[8.1,2.7]]
])label(name,pos,null,'terrain');
document.getElementById('footprints').innerHTML=settlements.slice().sort((a,b)=>b.areaKm2-a.areaKm2).map(s=>'<tr><th>'+s.name+'</th><td>'+fmt(areaOf(s.points))+'</td></tr>').join('');
document.getElementById('forest-area').textContent=fmt(areaOf(forest.points))+' km²';
document.getElementById('land-area').textContent=fmt(landAreaKm2)+' km²';
document.getElementById('sea-area').textContent=fmt(seaAreaKm2)+' km²';
info('地形を選択','WORLD 2D BLUEPRINT','<p>48×36kmの連続した土地として設計。森林は約220km²の面であり、都市の輪郭は面積比を守る実寸ポリゴン。地形・市街・路線にカーソルを合わせて確認できます。</p>');
for(const [name,key] of [['terrain','biomes'],['activity','activity'],['roads','roads'],['cities','cities'],['labels','labels'],['water','water']]){
 const checkbox=document.getElementById('show-'+key);checkbox.addEventListener('change',()=>{
  layers[name].style.display=checkbox.checked?'':'none';
  if(name==='terrain')layers.relief.style.display=checkbox.checked?'':'none';
 });
}
const defaultView={x:0,y:0,w:W,h:H};let view={...defaultView},drag;
function updateScale(){
 // Keep this ruler metrically correct at every zoom and screen width.
 const ruler=document.querySelector('.measure');
 const pxPerKm=(svg.getBoundingClientRect().width*S)/view.w;
 const maxCss=Math.min(190,svg.getBoundingClientRect().width*.31);
 const km=[10,5,2,1,.5,.2].find(k=>k*pxPerKm<=maxCss)||.2;
 ruler.style.width=(km*pxPerKm)+'px';
 const labels=ruler.querySelectorAll(':scope > span');
 labels[0].textContent='0';
 labels[1].textContent=String(km/2);
 labels[2].textContent=km+' km';
}
function apply(){
 view.w=Math.min(W,Math.max(150,view.w));
 view.h=view.w*H/W;
 view.x=Math.min(W-view.w,Math.max(0,view.x));
 view.y=Math.min(H-view.h,Math.max(0,view.y));
 svg.setAttribute('viewBox',[view.x,view.y,view.w,view.h].join(' '));
 updateScale();
}
window.addEventListener('resize',updateScale);
function zoom(f,cx=view.x+view.w/2,cy=view.y+view.h/2){
 const old=view.w;view.w=Math.min(W,Math.max(150,view.w*f));view.h=view.w*H/W;
 view.x=cx-(cx-view.x)*view.w/old;view.y=cy-(cy-view.y)*view.w/old;apply();
}
svg.addEventListener('wheel',e=>{e.preventDefault();const r=svg.getBoundingClientRect();
 const cx=view.x+(e.clientX-r.left)/r.width*view.w,cy=view.y+(e.clientY-r.top)/r.height*view.h;zoom(e.deltaY>0?1.15:.86,cx,cy);
},{passive:false});
svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,ox:view.x,oy:view.y};svg.setPointerCapture(e.pointerId);svg.classList.add('dragging');});
svg.addEventListener('pointermove',e=>{if(!drag)return;const r=svg.getBoundingClientRect();view.x=drag.ox-(e.clientX-drag.x)/r.width*view.w;view.y=drag.oy-(e.clientY-drag.y)/r.height*view.h;apply();});
function stopDrag(){drag=null;svg.classList.remove('dragging');}
svg.addEventListener('pointerup',stopDrag);svg.addEventListener('pointercancel',stopDrag);
document.getElementById('zoom-in').onclick=()=>zoom(.75);
document.getElementById('zoom-out').onclick=()=>zoom(1.25);
document.getElementById('reset').onclick=()=>{view={...defaultView};apply();};
document.getElementById('export').onclick=()=>{
 const blob=new Blob([JSON.stringify(exportBlueprint(),null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='world-blueprint-48x36km.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
apply();
