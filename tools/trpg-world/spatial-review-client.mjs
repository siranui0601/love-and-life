import {WorldScene} from '../../src/client/trpg-world/world-scene.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';

// Local authoring review only. No player state, knowledge, or simulation commands.
document.body.innerHTML=`<header><strong>空間設計レビュー</strong> <span>実runtimeの地形・建物。NPC生活の実走証明ではありません。</span></header><aside><label>地域 <select id="region"></select></label><p id="purpose"></p><label>生活・物流の動線 <select id="flow"></select></label><p id="reason"></p><button id="previous">前の地点</button> <button id="next">次の地点</button><p id="point"></p><button id="overview">俯瞰</button> <button id="arrival">王都：到着側</button> <button id="reveal">王都：側道</button><p>右ドラッグで視点、ホイールで距離。線は設計上の歩行経路であり、貨物の生成を意味しません。</p></aside><canvas id="canvas"></canvas>`;
const style=document.createElement('style');style.textContent='html,body{margin:0;height:100%;font:14px sans-serif;background:#242725;color:#eee}header{height:40px;padding:12px;box-sizing:border-box}header span{margin-left:20px;color:#bbb}aside{position:absolute;top:40px;bottom:0;width:250px;padding:16px;box-sizing:border-box;background:#242725;z-index:2}canvas{position:absolute;left:250px;top:40px;width:calc(100% - 250px);height:calc(100% - 40px)}select{display:block;width:100%;margin:8px 0;padding:6px}button{padding:7px;margin-bottom:8px}p{line-height:1.6;color:#ccc}';document.head.append(style);
const el=id=>document.getElementById(id),world=new WorldScene(el('canvas'),()=>{}),content=await(await fetch('/spatial-review/content')).json();
world.camera.upperRadiusLimit=240; // Authoring overview only; leave the player camera unchanged.
let selected,flow,points=[],cursor=0,lines=[];
function option(select,value,label){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
function camera(p,radius=70){world.camera.target=new Vector3(p[0],1.4,p[2]);world.camera.radius=radius;world.camera.beta=.75;world.camera.alpha=Math.PI/2;}
function showPoint(){const p=points[cursor];if(!p)return;camera(p,18);world.camera.beta=1.22;el('point').textContent=`地点 ${cursor+1} / ${points.length}`;}
function selectFlow(){
 lines.forEach(l=>l.dispose());lines=[];flow=selected.settlement?.flows.find(f=>f.id===el('flow').value);
 points=flow?flow.legs.flatMap((leg,i)=>i?leg.points.slice(1):leg.points):[];cursor=0;
 if(points.length){const line=MeshBuilder.CreateLines('traffic',{points:points.map(p=>new Vector3(p[0],.2,p[2]))},world.scene);line.color=new Color3(.95,.75,.25);lines.push(line);}
 el('reason').textContent=flow?`${flow.reason}。${flow.window}。${flow.stops.map(id=>selected.objects.find(o=>o.id===id)?.name||id).join(' → ')}`:'機能地区の設計接続は未実装';
 el('point').textContent='俯瞰：線の交差点と施設の入口を確認';camera(selected.spawn,110);
}
async function selectRegion(){selected=content.regions.find(r=>r.id===el('region').value);await world.loadRegion(selected);el('purpose').textContent=selected.settlement?.role||selected.identity;el('flow').replaceChildren();for(const f of selected.settlement?.flows||[])option(el('flow'),f.id,`${f.kind} / ${f.id}`);selectFlow();}
for(const r of content.regions)option(el('region'),r.id,r.name);
el('region').onchange=selectRegion;el('flow').onchange=selectFlow;
el('previous').onclick=()=>{cursor=Math.max(0,cursor-1);showPoint();};el('next').onclick=()=>{cursor=Math.min(points.length-1,cursor+1);showPoint();};
el('overview').onclick=()=>camera(selected.spawn,110);
async function capitalView(p){if(selected.id!=='capital'){el('region').value='capital';await selectRegion();}camera(p,12);world.camera.beta=1.38;world.camera.alpha=Math.PI/2;}
el('arrival').onclick=()=>capitalView([0,0,36]);el('reveal').onclick=()=>capitalView([-16,0,24]);
await selectRegion();
