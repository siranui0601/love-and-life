import {WorldScene} from './world-scene.js';
const $=id=>document.getElementById(id);
const modeNames={foot:'徒歩',horse:'乗馬',broom:'箒飛行'};
const statusNames={latent:'兆候',active:'進行中',critical:'緊急',failed:'悪化',resolved:'解決',prevented:'抑止'};
const weatherNames={clear:'晴れ',cloud:'曇り',rain:'雨',storm:'雷雨',snow:'雪'};
const keys=new Set();let view,content,scene,seq=0,active=false,busy=false,polling=false,selected=null,lastInput='',inputAt=0,dialogTarget=null,displayRevision=-1;
function element(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
function toast(message){if(!message)return;$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),4800);}
async function api(path,body){const r=await fetch(`/TRPG/api/world/${path}`,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!data.ok){const e=new Error(data.message||'通信に失敗しました。');e.code=data.error;throw e;}return data;}
async function receive(data){if(data.content)content=data.content;if(data.view){seq=data.view.lastSeq??seq;if(data.view.revision<displayRevision)return;displayRevision=data.view.revision;view=data.view;await scene.update(view);renderHud();}}
async function command(cmd,{quiet=false}={}){
 if(!active)return;if(busy){if(cmd.type==='input')return;await new Promise(resolve=>setTimeout(resolve,75));return command(cmd,{quiet});}busy=true;
 try{const data=await api('command',{seq:seq+1,command:cmd});await receive(data);$('connection').textContent='保存済み';if(cmd.type==='attack')scene.animateAttack(cmd.targetId,cmd.skillId==='magic');if(!quiet){toast(data.result?.dialogue?'話を聞いた。':data.result?.message);if(data.result?.conversation){renderConversation(data.result);}else if(dialogTarget)openInteraction(dialogTarget);if(data.result?.dialogue){const talk=element('div',null,'journal-card');for(const line of data.result.dialogue)talk.append(element('p',line));$('panelBody').prepend(talk);}}}
 catch(e){if(!quiet)toast(e.message);$('connection').textContent='再同期中';try{await receive(await api('state'));}catch{toast('接続が切れました。入力を止めて再接続しています。');}}
 finally{busy=false;}
}
function stopInput(){keys.clear();if(scene)scene.input={x:0,z:0,ascend:0};lastInput='';}
function closePanel(){if(active)void command({type:'resume'},{quiet:true});dialogTarget=null;$('panel').hidden=true;$('panelBody').replaceChildren();$('game').focus();}
function openPanel(title){if(active&&$('panel').hidden&&view?.player.activity?.worldTimePolicy!=='paused')void command({type:'pause'},{quiet:true});stopInput();$('panelTitle').textContent=title;$('panel').hidden=false;$('panelBody').replaceChildren();$('closePanel').focus();}
function button(text,fn){const b=element('button',text,'action');b.type='button';b.onclick=fn;return b;}
function actionCommand(action,target){const {id,label,available,missing,price,...rest}=action;return {type:rest.type||'interact',targetId:target.id,action:rest.action||id,...rest};}
function openInteraction(targetId){
 const target=view?.interactables.find(t=>t.id===targetId);if(!target){if(dialogTarget){closePanel();toast('相手から離れました。近づくと話せます。');}return;}
 dialogTarget=target.id;openPanel(target.name);dialogTarget=target.id;
 const body=$('panelBody');body.append(element('p',target.kind==='npc'?'この場所で話し、頼みごとを聞く。':'自分の目で確かめて、ここから行動する。','muted'));
 for(const action of target.actions){const b=button(action.label,()=>command(actionCommand(action,target)));if(action.available===false){b.classList.add('unavailable');b.disabled=true;b.append(element('small',`必要：${(action.missing||[]).join('、')}`));}body.append(b);}
}
function renderConversation(result){
 const session=result.conversation;if(session.status==='ended'){closePanel();return;}
 dialogTarget=null;openPanel('会話');const body=$('panelBody');
 body.append(element('p',result.narrative?.npcUtterance||session.utterance,'journal-card'));
 for(const choice of session.choices){const label=result.narrative?.playerChoiceLabels?.find(c=>c.intentId===choice.id)?.label||choice.label;
   body.append(button(label,()=>command({type:'converse',sessionId:session.id,turn:session.turn,intentId:choice.id})));}
}
function journal(){dialogTarget=null;openPanel('旅の手帳');const body=$('panelBody');body.append(element('p','自分が見聞きしたことだけを記録しています。','muted'));
 const quests=view.quests||[];if(quests.length){body.append(element('h3','受けた依頼'));for(const quest of quests){const card=element('div',null,`journal-card${quest.urgent?' urgent':''}`),left=quest.remaining==null?'期限不明':quest.remaining<=0?'期限切れ':`残り 約${Math.ceil(quest.remaining/3600)}時間`;card.append(element('small',quest.urgent?'緊急依頼':quest.status==='completed'?'完了':quest.status==='failed'?'失敗':'進行中'),element('h3',quest.name),element('p',`${left} · 報酬 ${quest.reward||0}G`));body.append(card);}}
 for(const event of view.knownEvents){const card=element('div',null,'journal-card');card.append(element('small',statusNames[event.status]||event.status),element('h3',event.name),element('p',event.description));if(['active','critical','latent'].includes(event.status))card.append(element('small',`期限まで 約${Math.ceil(event.remaining/3600)}時間 · ${event.source?.type==='seen'?'目撃':'伝聞・調査'}`));body.append(card);}
 if(!view.knownEvents.length)body.append(element('p','まだ事件の話は聞いていない。村を歩き、住民と話してみよう。'));
 body.append(element('h3','これまでの出来事'));for(const entry of [...view.journal].reverse().slice(0,25)){body.append(element('p',`Day ${Math.floor(entry.time/86400)+1} · ${entry.text}`,'history'));}
}
function inventory(){dialogTarget=null;openPanel('持ち物と身につけたこと');const body=$('panelBody');body.append(element('p',`${view.player.gold}G · Lv ${view.player.level} · ${view.player.sp}SP · 空腹 ${Math.round(view.player.hunger||0)} · 疲労 ${Math.round(view.player.fatigue||0)}`,'muted'));
 for(const item of view.player.inventoryDetails||[]){const line=element('div',null,'inventory-line');line.append(element('span',`${item.name} ×${item.quantity}${item.equipped?' · 装備中':''}`));if(item.kind==='equipment')line.append(button('装備',()=>command({type:'equip',itemId:item.id}).then(inventory)));if(item.id==='medicine')line.append(button('使う',()=>command({type:'use',itemId:item.id}).then(inventory)));if(['food','supplies'].includes(item.id))line.append(button('携帯食として食べる · 15分',()=>command({type:'eat',itemId:item.id}).then(inventory)));body.append(line);}
 body.append(element('h3','この場での行動'));for(const action of view.affordances||[])body.append(button(action.label,()=>command(action).then(closePanel)));for(const object of view.worldObjects||[])for(const action of object.actions)body.append(button(action.label,()=>command(action).then(inventory)));
 body.append(element('h3','移動手段'));for(const mode of ['foot','horse','broom'])body.append(button(modeNames[mode],()=>command({type:'mount',mode}).then(inventory)));
 body.append(element('h3','技能'));for(const skill of content.skills){body.append(element('p',`${view.player.skills.includes(skill.id)?'✓':'◇'} ${skill.name} — ${skill.description}`,'history'));}
}
function map(){dialogTarget=null;openPanel('世界の地図');const body=$('panelBody'),canvas=element('canvas');canvas.width=800;canvas.height=650;canvas.className='world-map';body.append(canvas);const ctx=canvas.getContext('2d');ctx.fillStyle='#16242b';ctx.fillRect(0,0,800,650);
 const point=r=>[(r.worldPosition[0]+190)*2.05,60+(r.worldPosition[1]+155)*1.55];const regions=new Map(content.regions.map(r=>[r.id,r]));
 for(const route of content.routes){const a=point(regions.get(route.from)),b=point(regions.get(route.to));ctx.strokeStyle=route.modes.includes('boat')?'#6ea7b3':'#7f826a';ctx.setLineDash(route.modes.includes('boat')?[4,7]:[]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
 ctx.setLineDash([]);ctx.textAlign='center';ctx.font='14px sans-serif';for(const r of content.regions){const [x,y]=point(r);ctx.fillStyle=r.id===view.region.id?'#efd097':r.color;ctx.beginPath();ctx.arc(x,y,r.id===view.region.id?9:6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ebe4d3';ctx.fillText(r.name,x,y-16);
   // Event markers are projected only from the player's acquired knowledge.
   // Remote or latent events have no position here, so the map never becomes
   // an omniscient checklist.
   const known=(view.knownEvents||[]).filter(event=>event.region===r.id&&Array.isArray(event.position));
   known.forEach((event,index)=>{const tone=event.status==='critical'?'#e88968':event.status==='active'?'#e8c27e':event.status==='failed'?'#9a8f87':'#8cc4bd';ctx.fillStyle=tone;ctx.beginPath();ctx.arc(x+12+index*8,y+10,4,0,Math.PI*2);ctx.fill();});
 }
 body.append(element('p','道の先へは、地域の出口まで歩いて向かいます。馬車と船は運賃、乗馬と箒は技能と乗り物が必要です。地図の小さな印は、あなたが見聞きした事件です。','muted'));
 for(const r of content.regions)body.append(element('p',`${r.name}：${r.description}`,'history'));
}
function miniMap(){if(!view)return;const c=$('minimap'),ctx=c.getContext('2d'),scale=156/(view.region.size||160),p=scene.position;ctx.clearRect(0,0,180,180);ctx.fillStyle='rgba(17,29,25,.88)';ctx.fillRect(0,0,180,180);ctx.strokeStyle='#657464';
 const at=p=>[90+p[0]*scale,90+p[2]*scale];for(const path of view.region.terrain?.paths||[]){ctx.beginPath();path.points.forEach((p,i)=>i?ctx.lineTo(...at(p)):ctx.moveTo(...at(p)));ctx.stroke();}
 ctx.fillStyle='#aaab8b';for(const o of view.region.objects){const [x,z]=at(o.buildingPosition||o.position);ctx.fillRect(x-2,z-2,4,4);}ctx.fillStyle='#e8c68e';for(const portal of view.region.portals){const [x,z]=at(portal.position);ctx.beginPath();ctx.arc(x,z,4,0,Math.PI*2);ctx.fill();}
 // Only local, known event positions reach the client projection. Their
 // colour follows the last state the player learned about.
 for(const event of view.knownEvents||[])if(event.region===view.region.id&&Array.isArray(event.position)){const [x,z]=at(event.position);ctx.fillStyle=event.status==='critical'?'#e88968':event.status==='active'?'#e8c27e':event.status==='failed'?'#9a8f87':'#8cc4bd';ctx.beginPath();ctx.arc(x,z,4.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f3dfb1';ctx.stroke();}
 ctx.fillStyle='#f8ead1';const [x,z]=at(p);ctx.beginPath();ctx.arc(x,z,4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#bdcfb0';ctx.font='11px sans-serif';ctx.fillText('N',87,14);}
function labels(){const container=$('entityLabels');container.replaceChildren();
 const entries=[...view.npcs.map(n=>({...n,height:2.3})),...view.region.objects.filter(o=>o.kind!=='landmark').map(o=>({...o,height:1.5})),...view.region.portals.map(p=>({...p,name:(content.regions.find(r=>r.id===p.to)?.name||'街道')+' →',height:3}))];
 for(const e of entries){const d=Math.hypot(e.position[0]-scene.position[0],e.position[2]-scene.position[2]);if(d>(e.to?45:18))continue;const point=scene.screenPoint([e.position[0],e.position[1]+e.height,e.position[2]]);if(point.z<0||point.z>1)continue;const label=element('div',e.name,'entity-label');label.style.left=`${point.x/scene.engine.getRenderWidth()*100}%`;label.style.top=`${point.y/scene.engine.getRenderHeight()*100}%`;container.append(label);}
}
function renderHud(){
 const p=view.player;if(p.collapse?.status==='active'&&$('panel').hidden){openPanel('倒れている');$('panelBody').append(element('p','この場所で救助を待っています。'),button('救助を待つ',()=>command({type:'recover'})));}$('regionName').textContent=view.region.name;$('dayClock').textContent=`Day ${view.day}  /  10     ${view.clock}`;$('weather').textContent=`${weatherNames[view.weather?.type]||'晴れ'} · ${modeNames[p.mode]||p.mode}`;
 $('playerName').textContent=p.name;$('level').textContent=`Lv ${p.level}`;$('gold').textContent=`${p.gold} G`;
 for(const key of ['hp','mp','stamina']){const max=key==='hp'?p.maxHp:key==='mp'?p.maxMp:100;$(key).style.width=`${Math.max(0,p[key]/max)*100}%`;$(key+'Value').textContent=`${Math.round(p[key])} / ${max}`;}
 const target=[...view.interactables].sort((a,b)=>a.distance-b.distance)[0];$('interactPrompt').hidden=!target;if(target){$('interactName').textContent=target.name;$('interactPrompt').onclick=()=>openInteraction(target.id);}
 const nearest=[...view.monsters].sort((a,b)=>Math.hypot(a.position[0]-p.position[0],a.position[2]-p.position[2])-Math.hypot(b.position[0]-p.position[0],b.position[2]-p.position[2]))[0];if(!view.monsters.some(m=>m.id===selected))selected=nearest?.id;
 const enemy=view.monsters.find(m=>m.id===selected);$('enemy').hidden=!enemy||Math.hypot(enemy.position[0]-p.position[0],enemy.position[2]-p.position[2])>25;if(enemy){$('enemyName').textContent=`${enemy.name}  Lv ${enemy.level}`;$('enemyHp').style.width=`${enemy.hp/enemy.maxHp*100}%`;$('enemyIntent').textContent=enemy.intent?`${enemy.intent.name} — 距離を取る！`:'';}
 const urgent=(view.quests||[]).filter(quest=>quest.urgent&&quest.status==='accepted').sort((a,b)=>a.remaining-b.remaining)[0];
 const latest=view.notifications.at(-1);if(urgent)$('worldNotice').textContent=`緊急依頼：${urgent.name} · 残り約${Math.ceil(urgent.remaining/3600)}時間`;
 else if(latest&&latest.id!==renderHud.latest){renderHud.latest=latest.id;$('worldNotice').textContent=latest.text;}
 if(view.cycleComplete)$('worldNotice').textContent='10日間が過ぎた。変わった世界で、あなたの暮らしは続いている。';miniMap();
}
function frame(dt){
 if(!active||!view||scene.loading)return;
 let x=0,z=0,ascend=0;const open=!$('panel').hidden;
 if(!open){const f=scene.forward(),right={x:f.z,z:-f.x},forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),side=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));x=f.x*forward+right.x*side;z=f.z*forward+right.z*side;const n=Math.hypot(x,z);if(n>1){x/=n;z/=n;}if(view.player.mode==='broom')ascend=Number(keys.has('Space'))-Number(keys.has('ShiftLeft'));}
 const input={x:Number(x.toFixed(3)),z:Number(z.toFixed(3)),ascend,sprint:!open&&view.player.mode!=='broom'&&keys.has('ShiftLeft'),heading:x||z?Math.atan2(x,z):view.player.heading};scene.input=input;
 const serialized=JSON.stringify(input),now=performance.now();if(!busy&&(serialized!==lastInput||((x||z||ascend)&&now-inputAt>220))&&now-inputAt>100){lastInput=serialized;inputAt=now;void command({type:'input',...input},{quiet:true});}
 if(Math.floor(now/150)!==frame.last){frame.last=Math.floor(now/150);miniMap();labels();$('fps').textContent=`${scene.fps} fps`;}
}
async function begin(data){
 $('launch').hidden=true;$('hud').hidden=false;$('loading').hidden=false;
 active=false;if(!scene)scene=new WorldScene($('game'),frame);await receive(data);active=true;await api('presence',{active:!document.hidden});if(view.conversation)renderConversation({conversation:view.conversation});else if(view.player.activity?.worldTimePolicy==='paused')openPanel('再開した場面');$('loading').hidden=true;$('game').focus();
}
$('startForm').onsubmit=async e=>{e.preventDefault();$('startButton').disabled=true;try{await begin(await api('session',{name:$('name').value||'旅人'}));}catch(e){console.error(e);active=false;$('loading').hidden=true;toast(e.message);}finally{$('startButton').disabled=false;}};
$('resumeButton').onclick=async()=>{try{await begin(await api('session'));}catch(e){toast(e.message);}};
$('closePanel').onclick=closePanel;$('journalButton').onclick=journal;$('bagButton').onclick=inventory;$('mapButton').onclick=map;
$('helpButton').onclick=()=>{openPanel('この世界の歩き方');$('panelBody').append(element('p','WASD／矢印：歩く　Shift：走る　右ドラッグ：カメラ　ホイール：距離　E：話す・調べる　左クリック／1：攻撃　2：魔法　Q：防御　Space：回避（箒では上昇）　J：手帳　I：持ち物　M：地図　Esc：閉じる'));$('panelBody').append(element('p','工作設備の近くでは、集めた素材を物資・薬・道具へ加工できます。製作中も時間が進み、事件とNPCの行動は止まりません。','muted'));$('panelBody').append(element('p','実時間1秒でゲーム内1分が流れます。会話・調査・メニューを読む間とゲームを閉じている間は世界時間が止まります。戦闘中は戦闘の時間だけが進みます。セーブは自動です。旅をやり直すときは、今の世界を終了して新しい旅を始めます。','muted'));$('panelBody').append(button('新しい人生を始める',async()=>{if(confirm('今の旅を終了し、新しい世界で始めますか？')){active=false;stopInput();const d=await api('session',{newGame:true,name:view.player.name});displayRevision=-1;closePanel();await begin(d);}}));};
window.addEventListener('keydown',e=>{if(!active||e.target.matches('input,textarea'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;
 if(e.code==='Escape'){closePanel();return;}if(e.code==='KeyJ')return journal();if(e.code==='KeyI')return inventory();if(e.code==='KeyM')return map();if(!$('panel').hidden)return;
 if(e.code==='KeyE'){const t=[...view.interactables].sort((a,b)=>a.distance-b.distance)[0];if(t)openInteraction(t.id);}
 if(e.code==='Digit1'&&selected)void command({type:'attack',targetId:selected});if(e.code==='Digit2'&&selected)void command({type:'attack',targetId:selected,skillId:'magic'});
 if(e.code==='KeyQ')void command({type:'defend',active:true},{quiet:true});if(e.code==='Space'&&view.player.mode!=='broom'){const f=scene.forward();void command({type:'dodge',x:f.x,z:f.z},{quiet:true});}
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyQ'&&active)void command({type:'defend',active:false},{quiet:true});});window.addEventListener('blur',stopInput);document.addEventListener('visibilitychange',()=>{stopInput();if(active)void api('presence',{active:!document.hidden});});window.addEventListener('pagehide',()=>{if(active)void fetch('/TRPG/api/world/presence',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:false}),keepalive:true});});
$('game').addEventListener('click',()=>{if(!active||!$('panel').hidden)return;const id=scene.pick();if(view.monsters.some(m=>m.id===id))selected=id;if(selected)void command({type:'attack',targetId:selected});});
$('game').addEventListener('contextmenu',e=>e.preventDefault());
for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(b.dataset.key);b.setPointerCapture(e.pointerId);});b.addEventListener('pointerup',()=>keys.delete(b.dataset.key));b.addEventListener('pointercancel',()=>keys.delete(b.dataset.key));}
setInterval(async()=>{if(!active||busy||polling||document.hidden)return;polling=true;try{await receive(await api('state'));$('connection').textContent='接続中 · 自動保存';}catch(e){$('connection').textContent='再接続中';}finally{polling=false;}},400);
try{const initial=await api('session');if(initial.session){$('resumeButton').hidden=false;$('resumeDetail').textContent=`${initial.view.player.name} · Day ${initial.view.day} ${initial.view.clock}`;}}catch(e){$('resumeDetail').textContent=e.message;}
