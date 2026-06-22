const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const $ = (s) => document.querySelector(s);
const els = {
  venue: $('#venueScreen'), gen: $('#generateScreen'), nav: $('#bottomNav'),
  kick: $('#kickBtn'), edit: $('#editBtn'), center: $('#centerBtn'), generate: $('#generateBtn'),
  dock: $('#gimmickDock'), dockList: $('#dockList'), fieldHint: $('#fieldHint'), fieldHelp: $('#fieldHelp'),
  round: $('#roundLabel'), goal: $('#goalLabel'), emojiCount: $('#emojiCountLabel'), emojiGrid: $('#emojiGrid'),
  selectedRow: $('#selectedRow'), modal: $('#modal'), modalKicker: $('#modalKicker'), modalTitle: $('#modalTitle'),
  modalText: $('#modalText'), modalPrimary: $('#modalPrimary'), modalSecondary: $('#modalSecondary'), toast: $('#toast'),
};

const WORLD = { w: 900, h: 1180, gravity: 0.36, wallBounce: 0.78 };
const EMOJIS = ['🥝','🏘️','💪🏾','🤘🏻','👗','🧼','↘️','⚕️','🐸','🎈','🧱','🧲','🍌','🌪️','🚪','🛞','🧊','🦀','☁️','⚡','🕳️','🪜','🧵','⚙️','🛝','🦘','🚀','🪭','🪨','👻','🔘'];
const TEMPLATES = ['BOUNCE','LAUNCH','FLOW','SHAPE','WARP','ATTACH','ROTATE','CARRY','PHASE','SWITCH'];
const META = {
  BOUNCE:{label:'反発',color:'#e8ff59',icon:'🟩'}, LAUNCH:{label:'発射',color:'#ffbd59',icon:'🚀'},
  FLOW:{label:'風・流れ',color:'#76e4ff',icon:'🌪️'}, SHAPE:{label:'地形',color:'#fff',icon:'🛝'},
  WARP:{label:'ワープ',color:'#b28cff',icon:'🚪'}, ATTACH:{label:'糸・連結',color:'#ff8ad1',icon:'🧵'},
  ROTATE:{label:'回転',color:'#9cffc1',icon:'⚙️'}, CARRY:{label:'運搬',color:'#ffdf70',icon:'☁️'},
  PHASE:{label:'透過',color:'#c8d8ff',icon:'👻'}, SWITCH:{label:'切替',color:'#ff9b9b',icon:'🔘'}
};

let state = freshState();
let drag = null;
let modalAction = null;

function freshState(){
  return {
    tab:'venue', tutorial:'intro', phase:'ready', round:1, cameraY:0, runTime:0,
    ball:{x:450,y:165,vx:0,vy:0,r:18,phaseUntil:0},
    goals:[{id:1,x:690,y:360,w:116,h:78,done:false,label:'A'}],
    ownGoals:[{id:'own1',x:210,y:1030,w:128,h:55}],
    fieldEmojis:[], inventory:[], selected:[], gimmicks:[], placing:null, nextGimmick:1, nextGoal:2,
    generateUnlocked:false, tabUnlocked:false, gameover:false, last:0
  };
}

function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
function hash(str){let h=2166136261; for(let i=0;i<str.length;i++){h^=str.charCodeAt(i); h=Math.imul(h,16777619)} return h>>>0}
function pick(arr,n){return arr[n%arr.length]}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function toast(msg){els.toast.textContent=msg; els.toast.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>els.toast.hidden=true,1800)}

function showModal(kicker,title,text,primary,action,secondary){
  els.modalKicker.textContent=kicker; els.modalTitle.textContent=title; els.modalText.textContent=text;
  els.modalPrimary.textContent=primary; els.modalSecondary.hidden=!secondary; els.modalSecondary.textContent=secondary||'';
  modalAction=action; els.modal.classList.add('is-open');
}
function closeModal(){els.modal.classList.remove('is-open')}

function boot(){
  grantEmojis(8); spawnFieldEmojis(4); render(); draw();
  showModal('KICK OFF','今宵はサッカー！','ボールをゴールへ繰り出せ⚽️ なお、手を使わなければだいたい審議中です。','キックオフ',()=>{closeModal(); startRun();});
  requestAnimationFrame(loop);
}

function grantEmojis(n){
  for(let i=0;i<n;i++){state.inventory.push({id:uid(),emoji:pick(EMOJIS,hash(`${Date.now()}-${i}-${state.inventory.length}`))})}
}
function spawnFieldEmojis(n){
  const base=hash(`field-${state.round}-${state.fieldEmojis.length}`);
  for(let i=0;i<n;i++){
    state.fieldEmojis.push({id:uid(),emoji:pick(EMOJIS,base+i*37),x:110+((base+i*91)%680),y:240+((base+i*141)%620),r:20});
  }
}

function setTab(tab){
  if(tab==='generate'&&!state.generateUnlocked){toast('まず一度落下して、細工を解禁しよう');return}
  state.tab=tab; els.venue.classList.toggle('is-active',tab==='venue'); els.gen.classList.toggle('is-active',tab==='generate');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('is-active',b.dataset.tab===tab)); render(); draw();
}

function startRun(){
  if(state.gameover){resetAll();return}
  state.phase='run'; state.runTime=0; state.ball={x:450,y:165,vx:0,vy:0,r:18,phaseUntil:0};
  state.fieldHint.textContent='試走中。ボール・ゴール・素材の位置だけ見ればOK。';
  hideHelp(); render();
}
function enterEdit(message){
  state.phase='edit'; state.ball={x:450,y:165,vx:0,vy:0,r:18,phaseUntil:0};
  state.fieldHint.textContent=message||'編集フェーズ。ギミックを動かしてから再キックオフ。'; render(); draw();
}
function resetAll(){state=freshState(); grantEmojis(8); spawnFieldEmojis(4); render(); draw(); showModal('KICK OFF','今宵はサッカー！','ボールをゴールへ繰り出せ⚽️ まずは何も置かずに蹴ってみよう。','キックオフ',()=>{closeModal(); startRun();});}

function firstFallTutorial(){
  state.generateUnlocked=true; state.tabUnlocked=true; els.nav.hidden=false;
  enterEdit('落下。ここから細工が解禁されます。'); setTab('generate');
  showModal('作戦タイム','そうだ、細工をしよう！','絵文字を3つ選んでギミックを生成しよう。まずは下の素材を3つタップ。','生成へ',()=>{closeModal();});
  state.tutorial='generate';
}

function failGame(reason){
  state.gameover=true; state.phase='gameover'; render(); draw();
  showModal('GAME OVER',reason,'赤いゴールは即終了。配置を変えれば、まだサッカーと言い張れます。','最初から',()=>{closeModal();resetAll();},'閉じる');
}

function generateGimmick(){
  if(state.selected.length!==3){toast('絵文字を3つ選んで！');return}
  const recipe=state.selected.map(e=>e.emoji); const seed=hash(recipe.join('|'));
  const template=pick(TEMPLATES,seed); const adj=pick(['合法','会場騒然','反則気味','ふわふわ','逆転','VAR泣かせ','不器用','謎の'],seed>>3);
  const name=`${adj}${recipe.join('')}`;
  const g={id:'g'+state.nextGimmick++,recipe,template,name,x:450,y:520,angle:(seed%360)*Math.PI/180,power:1+(seed%5)*.13,placed:false,spin:0};
  state.gimmicks.push(g);
  for(const item of state.selected){const idx=state.inventory.findIndex(e=>e.id===item.id); if(idx>=0)state.inventory.splice(idx,1)}
  state.selected=[]; state.placing=g.id; state.generateUnlocked=true;
  setTab('venue'); els.dock.hidden=false; showHelp(`「${name}」を配置します。ギミックカードを押したままコートへドラッグ、またはコートをタップして仮置き。`);
  if(state.tutorial==='generate'){
    showModal('配置しよう','会場へ戻った！','ギミックカードをドラッグしてコートに置こう。置いた後は本体をドラッグで移動、丸いハンドルをドラッグで角度変更。','配置する',()=>closeModal());
    state.tutorial='place';
  }
  render(); draw();
}

function completeRound(){
  state.round++; state.goals.forEach(g=>g.done=false); addGoal(); if(state.round===3)addOwnGoal(); grantEmojis(3); spawnFieldEmojis(3);
  enterEdit('全ゴール通過！旧ゴールが復活し、新ゴールが追加されました。');
  showModal('ROUND CLEAR','会場が湧いています！','全ゴールが再び有効化。新しいゴールも追加。絵文字も3つプレゼント。','続ける',()=>closeModal());
}
function addGoal(){
  const seed=hash(`goal-${state.round}-${state.goals.length}`); const lowest=Math.max(...state.goals.map(g=>g.y));
  const x=120+(seed%660); const y=clamp(220+((seed>>4)%900),180,lowest+320);
  state.goals.push({id:state.nextGoal,x,y,w:116,h:78,done:false,label:String.fromCharCode(64+state.nextGoal)}); state.nextGoal++;
}
function addOwnGoal(){state.ownGoals.push({id:'own'+state.ownGoals.length,x:690,y:900,w:128,h:55})}
function fallLine(){return Math.max(1110,Math.max(...state.goals.map(g=>g.y),...state.ownGoals.map(g=>g.y))+210)}

function loop(ts){
  if(!state.last)state.last=ts; const dt=Math.min(.033,(ts-state.last)/1000); state.last=ts;
  update(dt); draw(); requestAnimationFrame(loop);
}
function update(dt){
  if(state.phase!=='run')return; const b=state.ball; state.runTime+=dt;
  for(const g of state.gimmicks){if(g.placed)applyGimmick(g,dt)}
  b.vy+=WORLD.gravity*dt*60; b.vx*=.996; b.vy*=.999; b.x+=b.vx*dt*60; b.y+=b.vy*dt*60;
  if(b.x<b.r){b.x=b.r;b.vx=Math.abs(b.vx)*WORLD.wallBounce} if(b.x>WORLD.w-b.r){b.x=WORLD.w-b.r;b.vx=-Math.abs(b.vx)*WORLD.wallBounce}
  checkCollect(); checkGoals(); state.cameraY+=(b.y-canvas.height/(canvas.width/WORLD.w)*.45-state.cameraY)*.08;
  if(b.y>fallLine()){
    if(state.tutorial==='intro'){firstFallTutorial();return}
    enterEdit('落下。ギミックの場所や角度を調整しよう。');
  }
  if(state.runTime>30)enterEdit('30秒ゴールなし。作戦タイムです。');
}

function applyGimmick(g,dt){
  const b=state.ball, dx=b.x-g.x, dy=b.y-g.y, d=Math.hypot(dx,dy)||1;
  if(g.template==='FLOW'&&d<145){const f=(1-d/145)*.24*g.power; b.vx+=Math.cos(g.angle)*f*dt*60; b.vy+=Math.sin(g.angle)*f*dt*60}
  if(g.template==='ATTACH'&&d<190){b.vx+=(g.x-b.x)*.0009*dt*60; b.vy+=(g.y-b.y)*.0009*dt*60}
  if(g.template==='CARRY'&&Math.abs(dx)<66&&Math.abs(dy)<34&&b.vy>-3){b.y=g.y-36;b.vx+=Math.cos(g.angle)*.09;b.vy*=.8}
  if(g.template==='ROTATE')g.spin+=dt*2.2;
  collideGimmick(g,d,dx,dy);
}
function collideGimmick(g,d,dx,dy){
  const b=state.ball;
  if(g.template==='BOUNCE'&&d<58){const nx=dx/d,ny=dy/d;b.vx=nx*5.7*g.power+Math.cos(g.angle);b.vy=ny*5.7*g.power+Math.sin(g.angle);separate(g,62)}
  if(g.template==='LAUNCH'&&d<58){b.vx=Math.cos(g.angle)*7.2*g.power;b.vy=Math.sin(g.angle)*7.2*g.power;separate(g,62)}
  if(g.template==='SHAPE')collideLine(g.x,g.y,g.angle,155,.76);
  if(g.template==='ROTATE')collideLine(g.x,g.y,g.angle+g.spin,135,1.08);
  if(g.template==='WARP'&&d<42&&!g.cool){b.x=WORLD.w-g.x;b.y=Math.max(80,g.y-260);b.vy=Math.min(b.vy,-4);g.cool=60;toast('ワープ！')}
  if(g.cool)g.cool--;
  if(g.template==='PHASE'&&d<52){b.phaseUntil=state.runTime+2.5;b.vy-=1.1}
  if(g.template==='SWITCH'&&d<55&&!g.cool){state.gimmicks.forEach(o=>{if(o.id!==g.id&&Math.hypot(o.x-g.x,o.y-g.y)<230)o.angle+=Math.PI/5});g.cool=70;toast('近くの向きが変わった')}
}
function separate(g,r){const b=state.ball,dx=b.x-g.x,dy=b.y-g.y,d=Math.hypot(dx,dy)||1;b.x=g.x+dx/d*r;b.y=g.y+dy/d*r}
function collideLine(cx,cy,ang,len,bounce){
  const b=state.ball, ux=Math.cos(ang), uy=Math.sin(ang), vx=b.x-cx, vy=b.y-cy, p=clamp(vx*ux+vy*uy,-len/2,len/2);
  const px=cx+ux*p, py=cy+uy*p, dx=b.x-px, dy=b.y-py, d=Math.hypot(dx,dy)||1;
  if(d<b.r+8){const nx=dx/d,ny=dy/d,dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=(1+bounce)*dot*nx;b.vy-=(1+bounce)*dot*ny;b.x=px+nx*(b.r+9);b.y=py+ny*(b.r+9)}}
}
function checkCollect(){state.fieldEmojis=state.fieldEmojis.filter(e=>{if(Math.hypot(state.ball.x-e.x,state.ball.y-e.y)<state.ball.r+e.r){state.inventory.push({id:uid(),emoji:e.emoji});toast(`素材 ${e.emoji} 回収`);render();return false}return true})}
function checkGoals(){
  for(const o of state.ownGoals)if(inRect(state.ball,o))return failGame('オウンゴール！');
  for(const g of state.goals)if(!g.done&&inRect(state.ball,g)){g.done=true;state.ball.vy=Math.min(state.ball.vy,-5);state.ball.vx+=(g.x<WORLD.w/2?2:-2);toast(`GOAL ${g.label}`);render()}
  if(state.goals.every(g=>g.done))completeRound();
}
function inRect(b,r){return Math.abs(b.x-r.x)<r.w/2&&Math.abs(b.y-r.y)<r.h/2}

function render(){
  els.nav.hidden=!state.tabUnlocked; els.dock.hidden=!state.generateUnlocked || !state.gimmicks.length;
  els.round.textContent=`R${state.round}`; els.goal.textContent=`${state.goals.filter(g=>g.done).length}/${state.goals.length}`; els.emojiCount.textContent=`${state.inventory.length}個`;
  document.querySelector('[data-tab="generate"]').classList.toggle('is-locked',!state.generateUnlocked);
  renderEmojis(); renderSelected(); renderDock(); els.kick.disabled=state.phase==='run'; els.edit.disabled=state.phase!=='run';
}
function renderEmojis(){els.emojiGrid.replaceChildren();state.inventory.forEach(item=>{const b=document.createElement('button');b.className='emoji-btn';b.textContent=item.emoji;b.type='button';if(state.selected.some(s=>s.id===item.id))b.classList.add('is-selected');b.onclick=()=>toggleEmoji(item);els.emojiGrid.appendChild(b)})}
function toggleEmoji(item){const i=state.selected.findIndex(s=>s.id===item.id);if(i>=0)state.selected.splice(i,1);else{if(state.selected.length>=3)state.selected.shift();state.selected.push(item)}render()}
function renderSelected(){els.selectedRow.replaceChildren();for(let i=0;i<3;i++){const d=document.createElement('button');d.type='button';d.className='slot';if(state.selected[i]){d.textContent=state.selected[i].emoji;d.onclick=()=>{state.selected.splice(i,1);render()}}else{d.textContent='空';d.classList.add('empty')}els.selectedRow.appendChild(d)}els.generate.disabled=state.selected.length!==3}
function renderDock(){els.dockList.replaceChildren();state.gimmicks.forEach(g=>{const m=META[g.template];const card=document.createElement('article');card.className='gimmick-card';if(state.placing===g.id)card.classList.add('is-selected');card.innerHTML=`<span class="gimmick-name">${g.recipe.join('')} ${g.name}</span><div class="gimmick-meta">${m.icon} ${m.label} / ${g.placed?'配置済み':'未配置'}</div><div class="gimmick-help">押したままコートへドラッグ</div>`;card.onpointerdown=(ev)=>startCardDrag(ev,g);els.dockList.appendChild(card)})}

function fit(){const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),w=Math.floor(r.width*dpr),h=Math.floor(r.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}}
function draw(){if(!state)return;fit();const scale=canvas.width/WORLD.w,viewH=canvas.height/scale;state.cameraY=clamp(state.cameraY,-120,fallLine()-viewH+120);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.scale(scale,scale);ctx.translate(0,-state.cameraY);drawField(viewH);state.fieldEmojis.forEach(drawEmoji);state.goals.forEach(drawGoal);state.ownGoals.forEach(drawOwn);state.gimmicks.filter(g=>g.placed).forEach(drawGimmick);drawBall();ctx.restore()}
function drawField(viewH){const top=state.cameraY-80,bottom=state.cameraY+viewH+80;ctx.fillStyle='#0f713e';ctx.fillRect(0,top,WORLD.w,bottom-top);ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=2;for(let y=Math.floor(top/80)*80;y<bottom;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD.w,y);ctx.stroke()}ctx.strokeStyle='rgba(232,255,89,.28)';ctx.lineWidth=5;round(18,top,WORLD.w-36,bottom-top,28);ctx.stroke();const f=fallLine();ctx.fillStyle='rgba(255,82,104,.16)';ctx.fillRect(0,f,WORLD.w,90);ctx.strokeStyle='#ff5268';ctx.setLineDash([18,12]);ctx.beginPath();ctx.moveTo(0,f);ctx.lineTo(WORLD.w,f);ctx.stroke();ctx.setLineDash([])}
function drawEmoji(e){ctx.save();ctx.translate(e.x,e.y);ctx.shadowColor='rgba(232,255,89,.7)';ctx.shadowBlur=14;ctx.font='31px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(e.emoji,0,0);ctx.restore()}
function drawGoal(g){ctx.save();ctx.translate(g.x,g.y);ctx.globalAlpha=g.done?.45:1;ctx.strokeStyle=g.done?'#d5ddd5':'#e8ff59';ctx.fillStyle=g.done?'rgba(220,220,220,.08)':'rgba(232,255,89,.13)';ctx.lineWidth=9;round(-g.w/2,-g.h/2,g.w,g.h,18);ctx.fill();ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=2;for(let x=-g.w/2+18;x<g.w/2;x+=18){ctx.beginPath();ctx.moveTo(x,-g.h/2);ctx.lineTo(x,g.h/2);ctx.stroke()}ctx.fillStyle='#fff';ctx.font='900 18px system-ui';ctx.textAlign='center';ctx.fillText(g.done?'CLEAR':`GOAL ${g.label}`,0,-g.h/2-12);ctx.restore()}
function drawOwn(o){ctx.save();ctx.translate(o.x,o.y);ctx.fillStyle='rgba(255,82,104,.22)';ctx.strokeStyle='#ff5268';ctx.lineWidth=7;round(-o.w/2,-o.h/2,o.w,o.h,14);ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='900 24px system-ui';ctx.textAlign='center';ctx.fillText('☠️',0,8);ctx.restore()}
function drawGimmick(g){const m=META[g.template];ctx.save();ctx.translate(g.x,g.y);ctx.rotate(g.angle+(g.template==='ROTATE'?g.spin:0));ctx.strokeStyle=m.color;ctx.fillStyle=m.color+'33';ctx.lineWidth=6;if(['FLOW','ATTACH'].includes(g.template)){ctx.beginPath();ctx.arc(0,0,g.template==='ATTACH'?86:68,0,Math.PI*2);ctx.fill();ctx.stroke();arrow(58,m.color)}else if(g.template==='WARP'){ctx.beginPath();ctx.ellipse(0,0,34,48,0,0,Math.PI*2);ctx.fill();ctx.stroke()}else if(g.template==='CARRY'){round(-62,-18,124,36,18);ctx.fill();ctx.stroke()}else{ctx.beginPath();ctx.moveTo(-76,0);ctx.lineTo(76,0);ctx.stroke();if(['LAUNCH','SWITCH'].includes(g.template))arrow(72,m.color)}ctx.rotate(-g.angle-(g.template==='ROTATE'?g.spin:0));ctx.fillStyle='#fff';ctx.font='23px system-ui';ctx.textAlign='center';ctx.fillText(m.icon,0,-24);drawHandle(g);ctx.restore()}
function drawHandle(g){ctx.save();ctx.rotate(g.angle);ctx.fillStyle='#e8ff59';ctx.beginPath();ctx.arc(92,0,13,0,Math.PI*2);ctx.fill();ctx.restore()}
function arrow(l,c){ctx.strokeStyle=c;ctx.fillStyle=c;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-l/2,0);ctx.lineTo(l/2,0);ctx.stroke();ctx.beginPath();ctx.moveTo(l/2+7,0);ctx.lineTo(l/2-10,-9);ctx.lineTo(l/2-10,9);ctx.closePath();ctx.fill()}
function drawBall(){const b=state.ball;ctx.save();ctx.translate(b.x,b.y);ctx.fillStyle='#fff';ctx.strokeStyle='#111';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,b.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.font='19px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('⚽',0,1);ctx.restore()}
function round(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y)}

function worldFromEvent(e){const r=canvas.getBoundingClientRect(),scale=canvas.width/WORLD.w;return {x:(e.clientX-r.left)*(canvas.width/r.width)/scale,y:(e.clientY-r.top)*(canvas.height/r.height)/scale+state.cameraY,inside:e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom}}
function hitGimmick(p){return [...state.gimmicks].reverse().find(g=>g.placed&&Math.hypot(g.x-p.x,g.y-p.y)<85)}
function handlePos(g){return {x:g.x+Math.cos(g.angle)*92,y:g.y+Math.sin(g.angle)*92}}
function startCardDrag(ev,g){ev.preventDefault();state.placing=g.id;drag={type:'new',id:g.id};showHelp('そのままコートへドラッグ。離した場所に置かれます。');render()}
function onDown(ev){if(state.phase==='run'||state.gameover)return;const p=worldFromEvent(ev);const h=[...state.gimmicks].reverse().find(g=>g.placed&&Math.hypot(handlePos(g).x-p.x,handlePos(g).y-p.y)<28);if(h){drag={type:'rotate',id:h.id};return}const hit=hitGimmick(p);if(hit){drag={type:'move',id:hit.id,dx:hit.x-p.x,dy:hit.y-p.y};return}if(state.placing){const g=state.gimmicks.find(x=>x.id===state.placing);if(g){g.x=p.x;g.y=p.y;g.placed=true;drag={type:'move',id:g.id,dx:0,dy:0};render();return}}drag={type:'pan',startY:ev.clientY,camera:state.cameraY}}
function onMove(ev){if(!drag)return;const p=worldFromEvent(ev);const g=state.gimmicks.find(x=>x.id===drag.id);if(drag.type==='new'&&p.inside&&g){g.x=p.x;g.y=p.y;g.placed=true;state.placing=g.id;draw();return}if(drag.type==='move'&&g){g.x=clamp(p.x+(drag.dx||0),40,WORLD.w-40);g.y=p.y+(drag.dy||0);draw();return}if(drag.type==='rotate'&&g){g.angle=Math.atan2(p.y-g.y,p.x-g.x);draw();return}if(drag.type==='pan'){state.cameraY=drag.camera-(ev.clientY-drag.startY)/(canvas.width/WORLD.w);draw()}}
function onUp(){if(drag){const g=state.gimmicks.find(x=>x.id===drag.id);if(g&&g.placed){state.placing=null;if(state.tutorial==='place'){showModal('角度も変えられる','編集もサッカーのうち','置いたギミックの丸いハンドルをドラッグすると角度が変わる。調整したらキックオフ！','キックオフ',()=>{closeModal();startRun();});state.tutorial='edit'}}drag=null;render()}}
function showHelp(text){els.fieldHelp.textContent=text;els.fieldHelp.hidden=false}function hideHelp(){els.fieldHelp.hidden=true}

els.modalPrimary.onclick=()=>{if(modalAction)modalAction()};els.modalSecondary.onclick=closeModal;els.kick.onclick=startRun;els.edit.onclick=()=>enterEdit('手動で編集フェーズへ。');els.center.onclick=()=>{state.cameraY=0;draw()};els.generate.onclick=generateGimmick;document.querySelectorAll('.tab-btn').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
canvas.addEventListener('pointerdown',onDown,{passive:false});window.addEventListener('pointermove',onMove,{passive:false});window.addEventListener('pointerup',onUp);window.addEventListener('resize',draw);
boot();