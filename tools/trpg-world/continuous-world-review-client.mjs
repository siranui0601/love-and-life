import {createContinuousWorld} from '../../src/client/trpg-world/continuous-world-scene.js';
import {settlements,worldRoutes,WORLD_BOUNDS,heightAt} from '../../src/shared/trpg-world/continuous-world.js';
document.title='TRPG（仮） — ひとつの世界';
document.body.innerHTML='<header><span class="eyebrow">TRPG（仮） / CONTINUOUS WORLD GRAYBOX</span><h1>世界の地図</h1><p>山脈、河川、城郭都市、港、森林、海と荒野。その間にある土地も世界の一部。</p><div class="controls"><button id="overview">世界を俯瞰</button><label>注目地点 <select id="location"></select></label><button id="walk">地上を自由探索</button><span id="status">地形を構築中…</span></div></header><canvas id="world" aria-label="実際に歩ける連続した3D世界"></canvas><footer><span id="travel">全11地域 / R01–R15。道路は歩きやすい道であり、それ以外の草地・林床も通行可能。</span><span>俯瞰：ドラッグ・ホイール　｜　地上：WASD / Shift＋WASD / 視点ドラッグ</span></footer>';
const style=document.createElement('style');
style.textContent='*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:#101e28;color:#e8dfc9;font:14px "Yu Gothic",Meiryo,sans-serif;overflow:hidden}body{display:flex;flex-direction:column}header{padding:14px 25px;background:#142129;border-bottom:1px solid #826d4c;z-index:2}h1{font:normal 29px "Yu Mincho",serif;letter-spacing:.16em;margin:3px 0 5px}.eyebrow{font-size:10px;letter-spacing:.2em;color:#d1b77c}header p{font-size:12px;margin:0 0 11px;color:#c7cbbd}.controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap}button,select{color:#f0e3c6;border:1px solid #937c55;background:#283a3a;font:inherit;padding:7px 12px;cursor:pointer}button:hover,select:hover{background:#3b504a}#status{font-size:12px;color:#dbc893}#world{flex:1;min-height:0;min-width:0;width:100%;touch-action:none}footer{display:flex;justify-content:space-between;gap:15px;padding:10px 18px;font-size:11px;background:#142129;border-top:1px solid #826d4c;color:#c3c4b4;flex-wrap:wrap}@media(max-width:650px){header{padding:10px}h1{font-size:24px}.controls{gap:6px}button,select{padding:6px;font-size:12px}footer{font-size:10px;padding:8px}}';
document.head.append(style);
const el=id=>document.getElementById(id);
for(const s of settlements){const o=document.createElement('option');o.value=s.id;o.textContent=s.name;el('location').append(o);}
el('location').value='capital';
let viewer;
try{
 viewer=createContinuousWorld(el('world'),{onChange:state=>{if(state.walking){el('status').textContent='自由探索中 · X '+state.position[0].toFixed(1)+' / Z '+state.position[2].toFixed(1);}}});
 globalThis.__continuousWorld=viewer;
 el('status').textContent='描画済：全11地域 / '+worldRoutes.length+'路線。実ランタイムとはまだ未接続。';
 el('overview').onclick=()=>{viewer.setWalk(false);el('walk').textContent='地上を自由探索';el('status').textContent='ワールド全体を俯瞰';};
 el('location').onchange=()=>{viewer.setWalk(false);const s=settlements.find(p=>p.id===el('location').value);viewer.camera.target.set(s.x,heightAt(s.x,s.z),s.z);viewer.camera.radius=Math.max(95,s.radius*3.8);viewer.camera.beta=.72;el('walk').textContent='地上を自由探索';el('status').textContent=s.name+'を俯瞰（全地域は同じ地面に存在）';};
 el('walk').onclick=()=>{if(viewer.walking){viewer.setWalk(false);el('walk').textContent='地上を自由探索';}else{viewer.setWalk(true,el('location').value);el('walk').textContent='地上探索を終了';el('world').focus();}};
 window.addEventListener('pagehide',()=>viewer.dispose(),{once:true});
}catch(e){el('status').textContent='描画に失敗しました：'+e.message;console.error(e);}
