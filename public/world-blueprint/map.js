import {
 WORLD,REFERENCE,toRef,areaOf,pointInPolygon,mainland,crimeIsland,islets,terrain,forest,
 landUse,settlements,places,waterways,routes,alternatePaths,hazards,coast,
 landAreaKm2,seaAreaKm2,exportBlueprint
} from './geography.js';

const NS='http://www.w3.org/2000/svg',W=REFERENCE.width,H=REFERENCE.height;
const svg=document.getElementById('map'),inspector=document.getElementById('inspection');
const fmt=v=>Number(v).toLocaleString('ja-JP',{maximumFractionDigits:2});
const p=q=>toRef(q),fp=v=>+v.toFixed(2);
const wr=(x,y)=>[x*WORLD.widthKm/W,(H-y)*WORLD.heightKm/H];
function el(tag,attrs={},parent=svg){
 const e=document.createElementNS(NS,tag);
 for(const [key,value] of Object.entries(attrs))e.setAttribute(key,String(value));
 parent.append(e);return e;
}
const polygon=points=>points.map((q,i)=>{const [x,y]=p(q);return(i?'L':'M')+fp(x)+','+fp(y);}).join(' ')+'Z';
const bbox=pts=>{const ps=pts.map(p),xs=ps.map(q=>q[0]),ys=ps.map(q=>q[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];};
function curve(pts){
 const q=pts.map(p);let out='M'+fp(q[0][0])+','+fp(q[0][1]);
 for(let i=0;i<q.length-1;i++){
  const a=q[Math.max(0,i-1)],b=q[i],c=q[i+1],d=q[Math.min(q.length-1,i+2)];
  const cc=[b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6,c[0]-(d[0]-b[0])/6,c[1]-(d[1]-b[1])/6,c[0],c[1]];
  out+=' C'+cc.map(fp).join(',');
 }
 return out;
}
const rand=n=>{const z=Math.sin(n*127.1+71.7)*43758.545312;return z-Math.floor(z);};
const defs=el('defs');
function gradient(id,colours){
 const g=el('linearGradient',{id,x1:'0%',y1:'0%',x2:'60%',y2:'100%'},defs);
 colours.forEach((c,i)=>el('stop',{offset:Math.round(i*100/(colours.length-1))+'%','stop-color':c},g));
}
gradient('ocean-grad',['#21435a','#326f85','#5494a0']);
gradient('earth-grad',['#cdc69d','#d6ca9b','#bba982']);
gradient('snow-grad',['#d5d7d1','#929fa5','#677681']);
gradient('volcanic-grad',['#686065','#473e47','#272c34']);
gradient('forest-grad',['#779263','#3d7150','#224b39']);
gradient('desert-grad',['#e5ca96','#cfa472','#ae845c']);
const clip=el('clipPath',{id:'land-mask'},defs);
el('path',{d:polygon(mainland)},clip);
const layers={};
for(const name of ['sea','land','biomes','texture','mountains','forest','landuse','farms','rivers','roads','city-zones','architecture','hazards','hits','labels'])
 layers[name]=el('g',{'data-layer':name});
for(const name of ['biomes','texture','mountains','forest','landuse','farms','rivers'])layers[name].setAttribute('clip-path','url(#land-mask)');
for(const name of ['texture','mountains','forest','farms','architecture','labels'])layers[name].setAttribute('pointer-events','none');
function info(title,kind,markup){
 inspector.innerHTML='';
 const e=document.createElement('span');e.className='eyebrow';e.textContent=kind;
 const h=document.createElement('h2');h.textContent=title;
 const b=document.createElement('div');b.innerHTML=markup;
 inspector.append(e,h,b);
}
function hit(node,name,type,markup){
 node.classList.add('interactive');node.setAttribute('tabindex','0');
 node.setAttribute('role','button');node.setAttribute('aria-label',name);
 for(const ev of ['mouseenter','focus','click'])node.addEventListener(ev,()=>info(name,type,markup));
}
function scenicPath(d,attrs,parent){return el('path',{d,...attrs},parent);}
function pathFromPixels(a){return a.map((q,i)=>(i?'L':'M')+fp(q[0])+','+fp(q[1])).join(' ')+'Z';}

el('rect',{width:W,height:H,fill:'url(#ocean-grad)'},layers.sea);
for(let i=0;i<340;i++){
 const x=(i*117.7+rand(i)*41)%W,y=(i*79.3+rand(i+29)*41)%H,w=5+rand(i+13)*28;
 scenicPath('M'+fp(x)+','+fp(y)+' q'+fp(w/2)+',-'+fp(2+rand(i+37)*3)+' '+fp(w)+',0',
  {stroke:i%3?'#9bc7c5':'#cdd6c9','stroke-width':.6+rand(i+3)*.8,opacity:.16+rand(i+17)*.18,fill:'none'},layers.sea);
}
const land=el('path',{d:polygon(mainland),fill:'url(#earth-grad)',stroke:'#ecdcbb','stroke-width':5,'stroke-linejoin':'round'},layers.land);
scenicPath(polygon(mainland),{fill:'none',stroke:'#737560','stroke-width':1.6},layers.land);
for(const rock of [crimeIsland,...islets]){
 scenicPath(polygon(rock),{fill:rock===crimeIsland?'url(#volcanic-grad)':'#777c76',stroke:'#d4ceaf','stroke-width':2.4},layers.land);
}
hit(land,'大陸','海岸線の連続した地形','<div class="big-number">'+fmt(coast.mainlandAreaKm2)+'<small> km²</small></div><p>この図は元画像の相対配置を追い直したもの。地域ごとの別箱ではない。</p>');
const colours={
 'central-plain':'#b6b376','western-foothills':'#888b78','drylands':'url(#desert-grad)',
 'north-range':'url(#snow-grad)','black-range':'url(#volcanic-grad)','emerald-forest':'url(#forest-grad)'
};
for(const region of terrain){
 const shape=scenicPath(polygon(region.points),{fill:colours[region.id]||region.color,stroke:'none',opacity:.98},layers.biomes);
 hit(shape,region.name,'地形・画像輪郭から再計測','<div class="big-number">'+fmt(areaOf(region.points))+'<small> km²（概算）</small></div><p>'+(region.description||'連続して歩ける土地の一部。')+'</p>');
}
for(const [d,color,w,alpha] of [
 ['M260 360C370 295 477 308 590 349S735 395 805 405','#c4b882',21,.49],
 ['M613 632C715 591 830 617 961 644S1280 697 1448 701','#eed09b',22,.52],
 ['M690 314C791 272 843 241 940 242S1233 280 1388 328','#658e60',23,.27]
])scenicPath(d,{stroke:color,'stroke-width':w,fill:'none',opacity:alpha},layers.texture);
function peak(x,y,h,w,volcanic,i){
 const main=volcanic?'#6f6365':'#849199';
 scenicPath('M'+(x-w/2)+','+y+' L'+(x-7)+','+(y-h*.55)+' L'+x+','+(y-h)+' L'+(x+w*.22)+','+(y-h*.45)+' L'+(x+w/2)+','+y+'Z',
  {fill:main,stroke:volcanic?'#282932':'#596872','stroke-width':.7,opacity:.9},layers.mountains);
 scenicPath('M'+x+','+(y-h)+' L'+(x+w*.22)+','+(y-h*.45)+' L'+(x+w/2)+','+y+' L'+(x+w*.07)+','+(y-3)+'Z',
  {fill:volcanic?'#303035':'#697984',opacity:.92},layers.mountains);
 scenicPath('M'+(x-7)+','+(y-h*.55)+'L'+x+','+(y-h)+'L'+(x+w*.22)+','+(y-h*.45)+'L'+(x+w*.04)+','+(y-h*.58)+'L'+(x-w*.13)+','+(y-h*.41)+'Z',
  {fill:volcanic?(i%5===0?'#aa624b':'#826a6a'):'#e4e7e1',opacity:.85},layers.mountains);
 if(volcanic&&i%7===0)scenicPath('M'+(x-4)+','+(y-h*.65)+'L'+x+','+(y-h*.42)+'L'+(x+6)+','+(y-h*.27),
  {stroke:'#d57345','stroke-width':1.5,fill:'none'},layers.mountains);
}
for(const [id,n] of [['north-range',280],['black-range',210]]){
 const t=terrain.find(o=>o.id===id),[a,b,c,d]=bbox(t.points),v=id==='black-range';
 for(let i=0;i<n;i++){
  const x=a+rand(i*3+(v?233:13))*(c-a),y=b+rand(i*5+(v?525:73))*(d-b);
  if(!pointInPolygon(wr(x,y),t.points))continue;
  peak(fp(x),fp(y),fp(12+rand(i+190)*40),fp(16+rand(i+443)*24),v,i);
 }
}
for(const d of ['M220 205Q350 95 480 110T690 161T907 106','M292 280Q390 210 487 235T680 236T805 189'])
 scenicPath(d,{stroke:'#edf0e4','stroke-width':4,opacity:.21,fill:'none'},layers.mountains);
const fbox=bbox(forest.points);
for(let i=0;i<2050;i++){
 const x=fbox[0]+rand(i*31+20)*(fbox[2]-fbox[0]),y=fbox[1]+rand(i*17+100)*(fbox[3]-fbox[1]);
 if(!pointInPolygon(wr(x,y),forest.points))continue;
 const r=3+rand(i*23+2)*5.8;
 const cols=['#224a35','#315e3c','#4e7950','#59804d','#789155','#203d32'];
 scenicPath('M'+fp(x)+','+fp(y-r*1.65)+' Q'+fp(x+r*.8)+','+fp(y-r*.55)+' '+fp(x+r)+','+fp(y)+' Q'+fp(x+.6)+','+fp(y+r*.34)+' '+fp(x)+','+fp(y+r*.2)+' Q'+fp(x-r)+','+fp(y+r*.35)+' '+fp(x-r*.95)+','+fp(y)+' Q'+fp(x-r*.7)+','+fp(y-r*.7)+' '+fp(x)+','+fp(y-r*1.65)+'Z',
  {fill:cols[Math.floor(rand(i*17+6)*cols.length)],stroke:'#244231','stroke-width':.3,opacity:.67+rand(i+30)*.23},layers.forest);
}
for(const zone of landUse){
 scenicPath(polygon(zone.points),{fill:zone.color,opacity:zone.id==='farmlands'?.65:.39,
  stroke:zone.id==='farmlands'?'#aaa46a':'none','stroke-width':1},layers.landuse);
}
const farm=landUse.find(z=>z.id==='farmlands'),[fx,fy,fw,fh]=bbox(farm.points);
for(let i=0;i<425;i++){
 const x=fx+rand(i*13+18)*(fw-fx),y=fy+rand(i*41+60)*(fh-fy);
 if(!pointInPolygon(wr(x,y),farm.points))continue;
 const w=8+rand(i+2)*20,h=3+rand(i+4)*9;
 scenicPath('M'+fp(x)+','+fp(y)+'l'+fp(w)+','+fp(-h*.26)+'l'+fp(2+h*.15)+','+fp(h)+'l'+fp(-w)+','+fp(h*.25)+'Z',
  {fill:i%4===0?'#d9c77c':i%3===0?'#aaa961':'#d4ba76',stroke:'#888657','stroke-width':.3,opacity:.73},layers.farms);
}
for(let i=0;i<135;i++){
 const x=645+rand(i*7+40)*760,y=714+rand(i*11+50)*320;
 if(!pointInPolygon(wr(x,y),terrain.find(t=>t.id==='drylands').points))continue;
 scenicPath('M'+fp(x-14)+','+fp(y+4)+' q'+fp(12+rand(i)*17)+','+fp(-6-rand(i+4)*8)+' '+fp(25+rand(i)*12)+',1',
  {stroke:i%3?'#a8875e':'#e9d199','stroke-width':.6+rand(i+6),opacity:.55,fill:'none'},layers.texture);
}
// A broad painted river with its physical width stored separately in geography.js.

// South is a dry HIGH PLATEAU with rock spires, gullies, ruins and pilgrimage
// traces, not a single empty yellow quadrilateral.
const dry=terrain.find(t=>t.id==='drylands'),dryBox=bbox(dry.points);
for(let i=0;i<310;i++){
 const x=dryBox[0]+rand(i*9+45)*(dryBox[2]-dryBox[0]);
 const y=dryBox[1]+rand(i*15+73)*(dryBox[3]-dryBox[1]);
 if(!pointInPolygon(wr(x,y),dry.points))continue;
 const h=3+rand(i*29+4)*19,w=6+rand(i*37+6)*28;
 scenicPath('M'+fp(x-w/2)+','+fp(y+2)+'L'+fp(x-w*.21)+','+fp(y-h*.62)+
  'L'+fp(x)+','+fp(y-h)+'L'+fp(x+w*.24)+','+fp(y-h*.37)+
  'L'+fp(x+w/2)+','+fp(y+2)+'Z',
  {fill:i%4===0?'#a98359':i%3===0?'#c39d70':'#b08b62',
   stroke:'#806a4f','stroke-width':.7,opacity:.65+rand(i+40)*.2},layers.texture);
 scenicPath('M'+fp(x)+','+fp(y-h)+'L'+fp(x+w*.24)+','+fp(y-h*.37)+
  'L'+fp(x+w/2)+','+fp(y+2)+'L'+fp(x+w*.1)+','+fp(y+1)+'Z',
  {fill:'#866d55',opacity:.37},layers.texture);
}
for(let i=0;i<70;i++){
 const x=630+rand(i*23+71)*710,y=728+rand(i*37+23)*287;
 if(!pointInPolygon(wr(x,y),dry.points))continue;
 scenicPath('M'+fp(x-18)+','+fp(y+2)+'Q'+fp(x)+','+fp(y-6-rand(i+7)*5)+
  ' '+fp(x+29)+','+fp(y+1),
  {fill:'none',stroke:'#f2d9a5','stroke-width':.8,opacity:.45},layers.texture);
}
// Roads pass real inhabited landscapes: warehouses, field sheds and stopping
// places are visible WITHOUT adding invented major city/quest entities.
function hamlet(x,y,count,roofColor){
 for(let j=0;j<count;j++){
  const px=x+(j%4)*12+(rand(j+x)*4),py=y+Math.floor(j/4)*10+(rand(j+y)*3);
  scenicPath('M'+fp(px-5)+','+fp(py)+'L'+fp(px)+','+fp(py-7)+
   'L'+fp(px+6)+','+fp(py)+'V'+fp(py+5)+'H'+fp(px-5)+'Z',
   {fill:roofColor,stroke:'#594c3c','stroke-width':.8,opacity:.87},layers.farms);
 }
}
for(const [x,y,n,c] of [
 [344,444,7,'#a47a57'],[407,427,5,'#c48a61'],[476,462,8,'#b48864'],
 [512,494,8,'#bc946b'],[461,560,7,'#ad7755'],[528,659,6,'#b98662'],
 [698,546,6,'#aa805e'],[756,580,4,'#ad865f'],[419,696,5,'#a67d62'],
 [700,727,4,'#b08f73']
])hamlet(x,y,n,c);
// Quarry carts, pilgrim waystations and old roads make the mountains and
// temple approaches visibly inhabited/used.
for(const [x,y] of [[400,306],[445,290],[494,251],[546,211],[452,694],[520,707],[627,829],[605,862]]){
 scenicPath('M'+(x-7)+','+(y+3)+'h14v3h-14Z',{fill:'#9d7a53',stroke:'#68513e','stroke-width':1},layers.farms);
 el('circle',{cx:x-4,cy:y+7,r:2,fill:'#665349'},layers.farms);
 el('circle',{cx:x+4,cy:y+7,r:2,fill:'#665349'},layers.farms);
}

for(const river of waterways){
 const d=curve(river.path),w=river.visualWidthPx;
 scenicPath(d,{fill:'none',stroke:'#ccdac3','stroke-width':w*1.9,opacity:.48,'stroke-linejoin':'round'},layers.rivers);
 scenicPath(d,{fill:'none',stroke:'#537986','stroke-width':w*1.3,opacity:.88,'stroke-linejoin':'round'},layers.rivers);
 scenicPath(d,{fill:'none',stroke:'#5b9eba','stroke-width':w,'stroke-linecap':'round'},layers.rivers);
 scenicPath(d,{fill:'none',stroke:'#b5d5d7','stroke-width':Math.max(1.3,w*.23),opacity:.82},layers.rivers);
 const n=scenicPath(d,{fill:'none',stroke:'transparent','stroke-width':Math.max(15,w*1.6)},layers.hits);
 hit(n,river.name,'河道・流路','<p>設計上の幅：'+river.widthMeters[0]+'〜'+river.widthMeters[1]+'m。<br>地図上の着色は視認性のため誇張している。</p>');
}
for(const [x,y,r] of [[1306,475,1],[1298,488,2],[1289,503,3],[1282,517,4]]){
 scenicPath('M'+(x-6-r)+','+(y-2)+'l'+(10+r)+','+r+'m-8,'+(r+2)+'l'+(7+r)+',2',
  {stroke:'#e7eee4','stroke-width':2+r*.2,opacity:.9,fill:'none'},layers.rivers);
}
for(const [x,y,rot] of [[606,498,-22],[735,502,23],[637,548,14],[863,559,10],[1236,623,-8]]){
 const g=el('g',{transform:'translate('+x+' '+y+') rotate('+rot+')'},layers.rivers);
 el('rect',{x:-10,y:-3,width:20,height:6,rx:1,fill:'#eeddb6',stroke:'#8b7557','stroke-width':1.2},g);
 for(const xx of [-6,0,6])scenicPath('M'+xx+',-4v8',{stroke:'#a5906e','stroke-width':1},g);
}
const routeCols={
 'main-road':'#e7bd83','road':'#d5a471','farmland-road':'#b89867','mountain-road':'#e0c196',
 'mine-road':'#d1af81','wilderness-road':'#d4aa75','pilgrim':'#dfbb8d','sea':'#8ad4ef',
 'ruined-dangerous':'#be8a81','hidden-tunnel':'#ad99bd','forest-road':'#bccea1',
 'maze-conditional':'#c6dda5','guided-conditional':'#b6a3bd'
};
for(const r of routes){
 const d=curve(r.path),color=routeCols[r.type]||'#c8ab83';
 scenicPath(d,{fill:'none',stroke:'#51453a','stroke-width':r.type==='main-road'?6:4,opacity:.55},layers.roads);
 scenicPath(d,{fill:'none',stroke:color,'stroke-width':r.type==='sea'?3.6:2.7,
  'stroke-dasharray':r.type==='sea'?'9 7':r.type==='main-road'?'13 5':r.type.includes('conditional')||r.type==='hidden-tunnel'?'3 7':'7 5',
  'stroke-linecap':'round'},layers.roads);
 const a=places.find(q=>q.id===r.from)?.name,b=places.find(q=>q.id===r.to)?.name;
 const n=scenicPath(d,{fill:'none',stroke:'transparent','stroke-width':14},layers.hits);
 hit(n,r.id+'｜'+a+' ↔ '+b,'街道・航路（最短経路とは限らない）',
  '<p>'+r.notes+'</p><p>旧設計の徒歩基準：'+(r.hours<1?Math.round(r.hours*60)+'分':r.hours+'時間')+'。天候・渡河・危険・交通手段・寄り道で変わる。</p>');
}
for(const alt of alternatePaths){
 const d=curve(alt.path);
 scenicPath(d,{fill:'none',stroke:alt.kind==='monster-trail'?'#a86647':'#927451',
  'stroke-width':1.8,'stroke-dasharray':'2 9',opacity:.82},layers.roads);
 const n=scenicPath(d,{fill:'none',stroke:'transparent','stroke-width':11},layers.hits);
 hit(n,alt.name,'主街道ではない経路','<p>'+alt.notes+'</p>');
}
const pal={
 capital:['#ecd5ac','#7d6850','#b88c68','#9eaeb4'],trade:['#d7ad7b','#7b5b47','#b56c51','#d2aa78'],
 blackridge:['#89776c','#40363a','#895447','#a48a75'],crime:['#5d4e50','#292c32','#713c38','#998071'],
 fortress:['#d5d3c7','#696f71','#9faba9','#8f9a9c'],dwarf:['#a99272','#534a45','#977457','#c8ac84'],
 farm:['#d9c795','#85684f','#ba815b','#d0ab7d'],temple:['#ccb58e','#726756','#988775','#e0d0ac'],
 frontier:['#c7a47a','#7b5c4c','#b48260','#d7b78c'],elf:['#a7bc88','#485f43','#7b9f66','#a8b98b']
};
function roof(x,y,w,h,col,parent){
 scenicPath('M'+(x-w/2)+','+y+'L'+x+','+(y-h)+'L'+(x+w/2)+','+y+'L'+(x+w/2)+','+(y+4)+'L'+(x-w/2)+','+(y+4)+'Z',
  {stroke:'#51483d','stroke-width':1.1,fill:col},parent);
}
function tower(x,y,r,h,col,parent){
 el('rect',{x:x-r*.48,y:y-h,width:r*.96,height:h+5,fill:col,stroke:'#554b3e','stroke-width':1.1},parent);
 scenicPath('M'+(x-r)+','+(y-h)+'L'+x+','+(y-h-r*1.9)+'L'+(x+r)+','+(y-h)+'Z',
  {fill:'#506169',stroke:'#4c4440','stroke-width':.8},parent);
}
function walls(s,col){
 scenicPath(polygon(s.points),{fill:'none',stroke:'#4c4035','stroke-width':8,opacity:.75},layers.architecture);
 scenicPath(polygon(s.points),{fill:'none',stroke:col,'stroke-width':3.3,'stroke-dasharray':'14 4'},layers.architecture);
}
for(const s of settlements){
 const colours=pal[s.id],d=polygon(s.points);
 scenicPath(d,{fill:colours[0],stroke:colours[1],
  'stroke-width':s.id==='capital'||s.id==='trade'?5:3,opacity:.98},layers['city-zones']);
 const clip=el('clipPath',{id:'footprint-'+s.id},defs);
 scenicPath(d,{},clip);
 const group=el('g',{'clip-path':'url(#footprint-'+s.id+')'},layers.architecture);
 const [x1,y1,x2,y2]=bbox(s.points);
 const spacing=s.id==='farm'||s.id==='frontier'?13:s.id==='temple'?18:s.id==='fortress'?13:11;
 let n=0;
 for(let y=y1+5;y<y2-3;y+=spacing)for(let x=x1+4;x<x2-3;x+=spacing){
  const xx=x+(rand(n*3+37)-.5)*spacing*.5,yy=y+(rand(n*7+44)-.5)*spacing*.5;
  if(!pointInPolygon(wr(xx,yy),s.points)){n++;continue;}
  if(s.id==='temple'&&n%3===0){n++;continue;}
  let ww=5+rand(n+11)*5,hh=3+rand(n+24)*5;
  if(s.id==='elf'){ww=3+rand(n)*4;hh=2+rand(n+25)*3;}
  roof(fp(xx),fp(yy),fp(ww),fp(hh),colours[(n%2)+2],group);n++;
 }
 for(const zone of s.districts||[]){
  scenicPath(polygon(zone.points),{fill:zone.color,opacity:.29,stroke:colours[1],
   'stroke-width':1.3,'stroke-dasharray':'3 3'},layers.architecture);
 }
 const target=scenicPath(d,{fill:'transparent',stroke:'transparent','stroke-width':9,'data-settlement':s.id},layers.hits);
 hit(target,s.name,'都市・施設の建築域（参考画像の輪郭で再測定）',
  '<div class="big-number">'+fmt(s.areaKm2)+'<small> km²</small></div><p>周辺の利用圏 '+fmt(s.activityKm2)+' km²。'+s.description+'</p>'+
  ((s.districts||[]).length?'<p><b>地区：</b>'+s.districts.map(q=>q.name).join('／')+'</p>':'')+
  '<p class="note">前版の数値から一律に拡大したのではなく、参考画像の都市シルエットを先に再構成した。</p>');
}
// Palaces, ports, real military architecture, under-mountain cave, temple ruins.
const by=id=>settlements.find(s=>s.id===id);
walls(by('capital'),'#e7d0a7');
for(const d of ['M607 438Q667 447 749 425','M649 383Q673 435 690 499','M709 380Q709 442 750 477'])
 scenicPath(d,{fill:'none',stroke:'#e6cfa3','stroke-width':5},layers.architecture);
scenicPath('M648 409L647 376L670 371L670 347L702 347L702 372L724 376L724 409Z',
 {fill:'#e7d6b2',stroke:'#655847','stroke-width':3},layers.architecture);
for(const [x,y] of [[651,372],[675,353],[700,352],[723,375]])tower(x,y,10,26,'#e2dac8',layers.architecture);
tower(688,361,15,35,'#d7d0bb',layers.architecture);
tower(757,403,7,39,'#acb9be',layers.architecture);
for(const [x,y] of [[597,410],[774,408],[785,449],[738,504],[626,493]])
 tower(x,y,7,15,'#cfc1a5',layers.architecture);
walls(by('trade'),'#d7b78a');
for(const [x,y,w] of [[76,457,65],[93,491,75],[134,514,54],[190,527,40]]){
 scenicPath('M'+(x+w)+','+y+'H'+x+'v8h'+w+'Z',{fill:'#a27a57',stroke:'#e6d7ad','stroke-width':1.3},layers.architecture);
}
for(const [x,y] of [[147,432],[184,410],[224,407],[268,413]])tower(x,y,7,16,'#cfb58f',layers.architecture);
roof(263,399,35,18,'#68808c',layers.architecture);
scenicPath('M309 286Q313 205 362 214Q412 216 427 286Z',{fill:'#76675d',stroke:'#e2d1a8','stroke-width':4},layers.architecture);
scenicPath('M334 283Q341 234 365 235Q389 236 401 283Z',{fill:'#1e292e',stroke:'#c6b798','stroke-width':2},layers.architecture);
for(const x of [318,414])tower(x,279,8,17,'#a09381',layers.architecture);
scenicPath('M538 139L554 106L600 96L627 122L614 165L570 171Z',
 {fill:'#c4c7c0',stroke:'#555c5f','stroke-width':6},layers.architecture);
for(const [x,y] of [[551,115],[605,106],[617,150],[567,158]])tower(x,y,8,22,'#bec4c3',layers.architecture);
walls(by('blackridge'),'#96766c');
for(const [x,y] of [[1036,151],[1080,123],[1134,123],[1192,151],[1206,183]])
 tower(x,y,10,22,'#786a6a',layers.architecture);
scenicPath('M1126 171Q1150 181 1170 180T1213 186',{fill:'none',stroke:'#7eb4b9','stroke-width':6},layers.architecture);
roof(1115,134,35,28,'#b69582',layers.architecture);
walls(by('crime'),'#927b66');
for(const [x,y] of [[109,754],[131,733],[160,743],[187,776]])tower(x,y,7,19,'#625454',layers.architecture);
scenicPath('M81 789H116V803H76Z',{fill:'#8b674e',stroke:'#d8be97','stroke-width':1.5},layers.architecture);
for(const [x,y,w,h] of [[489,740,36,42],[548,711,32,56],[615,746,38,41],[645,784,30,34]]){
 scenicPath('M'+(x-w/2)+','+y+'v'+(-h)+'h'+w+'v'+h+' M'+(x-w/2)+','+(y-h)+'l'+(w/2)+',-9l'+(w/2)+',9',
  {stroke:'#c6b69a','stroke-width':5,fill:'none'},layers.architecture);
 for(const off of [-w*.28,w*.28])scenicPath('M'+(x+off)+','+(y-h+8)+'v'+(h-7),
  {stroke:'#f4e7c8','stroke-width':2},layers.architecture);
}
scenicPath('M470 807Q528 767 576 770T678 792',
 {stroke:'#c9b394','stroke-width':7,'stroke-dasharray':'14 9',fill:'none'},layers.architecture);
for(const [x,y] of [[579,897],[602,908],[589,923]])roof(x,y,13,9,'#b57755',layers.architecture);
for(const [x,y] of [[560,588],[580,574],[602,604],[575,625]])roof(x,y,16,10,'#b77c58',layers.architecture);
el('rect',{x:535,y:593,width:24,height:19,fill:'#cdb77d',stroke:'#735a45','stroke-width':2},layers.architecture);
scenicPath('M1281 459Q1282 426 1276 402M1281 433Q1263 405 1247 404M1281 430Q1294 403 1315 398',
 {stroke:'#735e43','stroke-width':11,fill:'none','stroke-linecap':'round'},layers.architecture);
for(const [x,y,r] of [[1277,377,31],[1252,387,22],[1302,384,24],[1274,401,23],[1316,407,15]])
 el('circle',{cx:x,cy:y,r,fill:'#557f4d',stroke:'#254936','stroke-width':2,opacity:.95},layers.architecture);
for(const [x,y] of [[1244,436],[1277,446],[1318,440]])roof(x,y,16,9,'#8aa679',layers.architecture);
scenicPath('M1244 436Q1280 426 1318 440',{stroke:'#b29b77','stroke-width':3,fill:'none'},layers.architecture);

for(const danger of hazards){
 const n=scenicPath(polygon(danger.points),{fill:danger.color,'fill-opacity':.07,
  stroke:danger.color,'stroke-width':1.7,'stroke-dasharray':'4 8'},layers.hazards);
 hit(n,danger.name,'危険・通行条件','<p>'+danger.description+'</p>');
}
function label(name,x,y,type='town',width=0){
 const g=el('g',{'class':'map-label '+type},layers.labels),size=type==='terrain'?15:type==='minor'?11:17;
 const w=width||Math.max(78,name.length*size+18);
 if(type==='town')el('rect',{x:x-w/2-2,y:y-18,width:w+4,height:28,rx:4,
  fill:'#1e2928',stroke:'#c4a16b','stroke-width':1.6,opacity:.97},g);
 const t=el('text',{x,y,'font-size':size,'font-weight':700,'text-anchor':'middle',
  fill:type==='town'?'#f7e8cc':type==='terrain'?'#284435':'#ffe2b2',
  stroke:type==='terrain'?'#d7ceaa':'none','stroke-width':.4,'paint-order':'stroke'},g);
 t.textContent=name;
}
for(const [n,x,y] of [
 ['交易都市',236,455],['王都',766,473],['黒嶺連合領',1183,166],['犯罪都市',181,798],
 ['北陵要塞',665,139],['ドワーフ洞窟',444,275],['田園の村',656,621],
 ['古代神殿',637,771],['辺境の村',665,930],['エルフの隠れ里',1363,443]
])label(n,x,y);
for(const [n,x,y] of [
 ['北の山脈',660,246],['黒の山脈',1051,70],['緑の平原',508,367],
 ['翡翠の森',1047,538],['乾きの高原',1029,816],['黄昏の荒野',1069,1023],
 ['碧の海',57,611],['夕凪の海',299,989],['東の森海',1344,663]
])label(n,x,y,'terrain');
for(const [n,x,y] of [['R06',457,431],['R12',634,548],['R13',881,424],['R14',1181,425],['R08',96,604],['R09',621,851],['R07',369,587]])
 label(n,x,y,'minor',42);

document.getElementById('forest-area').textContent=fmt(areaOf(forest.points))+' km²';
document.getElementById('land-area').textContent=fmt(landAreaKm2)+' km²';
document.getElementById('sea-area').textContent=fmt(seaAreaKm2)+' km²';
document.querySelector('.land-ratio').style.width=(100*landAreaKm2/WORLD.areaKm2).toFixed(1)+'%';
document.getElementById('footprints').innerHTML=settlements.slice().sort((a,b)=>b.areaKm2-a.areaKm2)
 .map(s=>'<tr><th>'+s.name+'</th><td>'+fmt(s.areaKm2)+'</td></tr>').join('');
info('参考画像から輪郭を再構成','REFERENCE-TRACED 2D / DESIGN ONLY',
 '<p>地形と都市圏の形を先に描き直し、数値はその後に計測。'+
 '王城・港湾・多種族の生活区・遺跡群・巡礼村・世界樹を別々の土地として表現する。</p>'+
 '<p>森は<strong>'+fmt(areaOf(forest.points))+'km²</strong>の連続する地形。プレイヤー用の地図では発見済み情報だけを見せる。</p>');
for(const [key,names] of [
 ['biomes',['biomes','texture','mountains','forest']],
 ['water',['rivers']],['roads',['roads']],
 ['activity',['landuse','farms']],['cities',['city-zones','architecture']],
 ['hazards',['hazards']],['labels',['labels']]
]){
 const input=document.getElementById('show-'+key);if(!input)continue;
 const toggle=()=>names.forEach(n=>layers[n].style.display=input.checked?'':'none');
 input.addEventListener('change',toggle);toggle();
}
// Zoom and pan work on the SVG, while original geometry remains metric.
const all={x:0,y:0,w:W,h:H};let view={...all},drag=null,pinch=null;
const pointers=new Map();
function scaleBar(){
 const ruler=document.querySelector('.measure'),width=svg.getBoundingClientRect().width;
 if(!width)return;
 const pxPerKm=width*(W/WORLD.widthKm)/view.w,max=Math.min(190,width*.29);
 const km=[10,5,2,1,.5,.2].find(v=>v*pxPerKm<=max)||.2;
 ruler.style.width=(km*pxPerKm)+'px';
 const labels=ruler.querySelectorAll(':scope > span');
 labels[0].textContent='0';labels[1].textContent=String(km/2);labels[2].textContent=km+' km';
}
function apply(){
 view.w=Math.min(W,Math.max(155,view.w));view.h=view.w*H/W;
 view.x=Math.min(W-view.w,Math.max(0,view.x));view.y=Math.min(H-view.h,Math.max(0,view.y));
 svg.setAttribute('viewBox',[view.x,view.y,view.w,view.h].map(fp).join(' '));scaleBar();
}
function zoom(f,x=view.x+view.w/2,y=view.y+view.h/2){
 const old=view.w;view.w=Math.min(W,Math.max(155,view.w*f));
 view.h=view.w*H/W;view.x=x-(x-view.x)*view.w/old;view.y=y-(y-view.y)*view.h/old;apply();
}
const local=e=>{const b=svg.getBoundingClientRect();return[
 view.x+(e.clientX-b.left)/b.width*view.w,view.y+(e.clientY-b.top)/b.height*view.h];};
svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.14:.86,...local(e));},{passive:false});
svg.addEventListener('pointerdown',e=>{
 if(e.button!==0&&e.pointerType==='mouse')return;
 pointers.set(e.pointerId,[e.clientX,e.clientY]);svg.setPointerCapture(e.pointerId);
 if(pointers.size===1){drag={x:e.clientX,y:e.clientY,ox:view.x,oy:view.y};pinch=null;}
 else if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={d:Math.hypot(a[0]-b[0],a[1]-b[1]),w:view.w};drag=null;}
 svg.classList.add('dragging');
});
svg.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;
 pointers.set(e.pointerId,[e.clientX,e.clientY]);
 const b=svg.getBoundingClientRect();
 if(pointers.size===2&&pinch){
  const [a,c]=[...pointers.values()],d=Math.hypot(a[0]-c[0],a[1]-c[1]);
  if(d>5){const old=view.w;view.w=Math.min(W,Math.max(155,pinch.w*pinch.d/d));
   view.x+=(old-view.w)/2;view.y+=(old-view.w)*H/W/2;apply();}
 }else if(drag&&pointers.size===1){
  view.x=drag.ox-(e.clientX-drag.x)/b.width*view.w;
  view.y=drag.oy-(e.clientY-drag.y)/b.height*view.h;apply();
 }
});
const release=e=>{pointers.delete(e.pointerId);drag=null;pinch=null;if(!pointers.size)svg.classList.remove('dragging');};
svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',release);
svg.addEventListener('dblclick',e=>{e.preventDefault();zoom(.67,...local(e));});
document.getElementById('zoom-in').onclick=()=>zoom(.73);
document.getElementById('zoom-out').onclick=()=>zoom(1.33);
document.getElementById('reset').onclick=()=>{view={...all};apply();};
const fullButton=document.getElementById('focus-map'),shell=document.querySelector('.map-shell');
fullButton?.addEventListener('click',()=>{
 shell.classList.toggle('is-focused');document.body.classList.toggle('map-fullscreen',shell.classList.contains('is-focused'));
 fullButton.textContent=shell.classList.contains('is-focused')?'閉じる':'地図を大きく';
 requestAnimationFrame(scaleBar);
});
document.getElementById('export').onclick=()=>{
 const blob=new Blob([JSON.stringify(exportBlueprint(),null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='world-blueprint-reference-rebuild.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('resize',scaleBar);apply();
