const status=document.getElementById('status');
const canvas=document.getElementById('atlas');
const error=document.getElementById('error');
const selector=document.getElementById('region');
const view={focus:document.getElementById('focus'),walk:document.getElementById('walk'),overview:document.getElementById('overview')};
let world=null;
function setMode(mode){
 document.body.classList.toggle('walking',mode==='walk');
 for(const [key,button] of Object.entries(view))button.classList.toggle('active',key===mode);
}
function selectedRegion(manifest){return selector.value||'farm';}
try{
 if(!globalThis.BABYLON)throw new Error('Babylon.jsの読み込みに失敗しました。ネットワーク接続を確認してください。');
 const response=await fetch('/atlas-review/content.json',{cache:'no-store'});
 if(!response.ok)throw new Error('公開地理データの取得に失敗しました（HTTP '+response.status+'）。');
 const manifest=await response.json();
 const {ContinuousWorld}=await import('./continuous-world.js');
 for(const region of manifest.regions){
  const option=document.createElement('option');option.value=region.id;option.textContent=region.name;selector.append(option);
 }
 selector.value='capital';
 world=new ContinuousWorld(canvas,manifest,{onStatus:({mode,location,position,trees})=>{
  let text=mode==='walk'?'徒歩探索':'立体俯瞰';
  text+=' · '+location;
  if(position)text+=' · X '+position[0].toFixed(0)+' / Z '+position[1].toFixed(0);
  if(trees!=null)text+=' · 樹木 '+trees;
  status.textContent=text;
 }});
 view.overview.onclick=()=>{world.overview();setMode('overview');};
 view.focus.onclick=()=>{world.focus(selectedRegion(manifest));setMode('focus');};
 view.walk.onclick=()=>{world.walk(selectedRegion(manifest));setMode('walk');};
 selector.onchange=()=>{if(selector.value){world.focus(selector.value);setMode('focus');}};
 window.addEventListener('keydown',e=>{
  if(e.code==='Escape'&&world?.walking){e.preventDefault();world.overview();setMode('overview');}
 });
 for(const button of document.querySelectorAll('[data-move]')){
  const code=button.dataset.move;
  button.onpointerdown=e=>{if(!world?.walking)return;button.setPointerCapture(e.pointerId);world.keys.add(code);e.preventDefault();};
  button.onpointerup=button.onpointercancel=()=>world?.keys.delete(code);
  button.onlostpointercapture=()=>world?.keys.delete(code);
 }
 status.textContent='世界全体 · 11地域 / 15ルート';
 setMode('overview');
}catch(cause){
 console.error('Continuous world preview failed:',cause);
 error.textContent=cause instanceof Error?cause.message:'世界の描画に失敗しました。';
 error.hidden=false;status.hidden=true;
}
window.addEventListener('pagehide',()=>{world?.dispose();world=null;},{once:true});
