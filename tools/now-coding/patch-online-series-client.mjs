// trigger one-time online series client patch
import fs from "node:fs";
const file = "public/now-coding/app-v3.js";
let src = fs.readFileSync(file, "utf8");
function mustReplace(pattern, replacement, label) {
  const before = src;
  src = typeof pattern === "string" ? src.replace(pattern, replacement) : src.replace(pattern, replacement);
  if (src === before) throw new Error(`patch anchor not found: ${label}`);
}

mustReplace(
  'battleKind: "npc", battleStep: 1, series: null, showNames: false, socket: null, onlineRoom: null, publicRooms: [],',
  'battleKind: "npc", battleStep: 1, series: null, onlineSeries: null, currentOnlineMeta: null, showNames: false, socket: null, onlineRoom: null, publicRooms: [],',
  "state online series"
);

mustReplace(
  'function startBattle(config,replay=false){stopBattle();const game=createGameState(config);',
  'function startBattle(config,replay=false){stopBattle();state.currentOnlineMeta=config.online||null;if(config.online?.series){const meta=config.online;if(!state.onlineSeries||meta.roundIndex===0||state.onlineSeries.roomId!==meta.roomId)state.onlineSeries={roomId:meta.roomId,totalRounds:meta.totalRounds,results:[],allowRoundProgramChange:Boolean(meta.allowRoundProgramChange)};}const game=createGameState(config);',
  "startBattle meta"
);

mustReplace(
  /async function finishRound\(game,replay=false\)\{stopBattle\(\);const results=gameResults\(game\);if\(state\.series/,
  'async function finishRound(game,replay=false){stopBattle();const results=gameResults(game);if(state.currentOnlineMeta?.series&&!replay){await finishOnlineRound(game,results);return;}if(state.series',
  "finishRound online branch"
);

const helper = `
async function finishOnlineRound(game,results){
  const meta=state.currentOnlineMeta;
  if(!meta||!state.onlineSeries)return;
  const exists=state.onlineSeries.results.some(r=>r.roundIndex===meta.roundIndex);
  if(!exists)state.onlineSeries.results.push({roundIndex:meta.roundIndex,mode:game.mode,seed:game.seed,results:deepClone(results)});
  showOnlineRoundWaiting(meta.roundIndex,meta.totalRounds);
  try{await emitSocket("now:round-finished",{roomId:meta.roomId,roundIndex:meta.roundIndex});}catch(e){toast("次のラウンドとの同期に失敗しました");}
}
function showOnlineRoundWaiting(index,total){
  document.querySelectorAll(".online-round-wait").forEach(n=>n.remove());
  const overlay=document.createElement("div");overlay.className="round-program-picker online-round-wait";
  overlay.innerHTML=\`<div class="round-picker-card"><p>第\${index+1}戦 終了</p><h2>他のプレイヤーを待っています</h2><div class="online-wait-pulse"><i></i><i></i><i></i></div><small>\${index+1} / \${total}</small></div>\`;
  document.body.append(overlay);
}
function renderOnlineSeriesResult(){
  document.querySelectorAll(".online-round-wait,.round-program-picker").forEach(n=>n.remove());
  const s=state.onlineSeries;if(!s)return;
  const rows=new Map();
  for(const round of s.results)for(const r of round.results){const key=r.userTrackingId||r.id;if(!rows.has(key))rows.set(key,{id:key,name:r.name,color:r.color,ranks:[]});rows.get(key).ranks.push(r.rank);}
  const list=[...rows.values()].map(x=>({...x,average:x.ranks.reduce((a,b)=>a+b,0)/x.ranks.length})).sort((a,b)=>a.average-b.average);
  let rank=0,prev=null;for(let i=0;i<list.length;i++){const x=list[i];if(prev===null||Math.abs(x.average-prev)>1e-9)rank=i+1;x.rank=rank;prev=x.average;}
  const mine=list.find(x=>x.id===state.user?.userTrackingId)||list[0];
  $("#resultRank").textContent=mine?String(mine.rank).padStart(2,"0"):"--";$("#resultTitle").textContent="総合結果";
  $("#resultRows").innerHTML=list.map(x=>\`<div class="result-row series-row"><span class="place">\${String(x.rank).padStart(2,"0")}</span><strong>\${esc(x.name)}</strong><span>平均 \${x.average.toFixed(2)}位</span></div>\`).join("")+\`<div class="series-round-results">\${s.results.sort((a,b)=>a.roundIndex-b.roundIndex).map((round,i)=>\`<details><summary>第\${i+1}戦 \${MODE_LABELS[round.mode]}</summary>\${round.results.map(r=>\`<div>\${r.rank}位 \${esc(r.name)} — \${esc(r.metric||r.score||"")}</div>\`).join("")}</details>\`).join("")}</div>\`;
  state.currentOnlineMeta=null;showViewNoReset("result");
}
`;
mustReplace('function prepareNextRound(){', helper+'function prepareNextRound(){', 'online helper insertion');

mustReplace(
  /function connectOnline\(\)\{.*?\nfunction disconnectOnline\(\)/s,
  `function connectOnline(){
  if(!state.user?.userTrackingId||typeof window.io!=="function")return;
  disconnectOnline();
  const socket=io({auth:{userTrackingId:state.user.userTrackingId,username:state.user.username}});state.socket=socket;
  socket.on("connect",()=>refreshRooms());
  socket.on("now:rooms-changed",()=>{if(!state.onlineRoom)refreshRooms()});
  socket.on("now:room-state",room=>{state.onlineRoom=room;renderOnlineArea()});
  socket.on("now:room-closed",()=>{state.onlineRoom=null;renderOnlineArea();toast("ルームが終了しました")});
  socket.on("now:match-start",config=>{
    document.querySelectorAll(".round-program-picker,.online-round-wait").forEach(n=>n.remove());state.onlineRoom=null;
    const launch=()=>startBattle(config,false);
    if(config.online?.series&&Number(config.online.roundIndex)>0)showRoundReveal(config.mode,Number(config.online.roundIndex)+1,Number(config.online.totalRounds)||1,launch);else launch();
  });
  socket.on("now:round-prepare",payload=>showOnlineRoundPrepare(payload));
  socket.on("now:series-finished",()=>renderOnlineSeriesResult());
}
function disconnectOnline()`,
  "connectOnline replacement"
);

mustReplace(
  /function showOnlineRoundPrepare\(payload\)\{.*?\n\nfunction setMenu/s,
  `function showOnlineRoundPrepare(payload){
  document.querySelectorAll(".online-round-wait,.round-program-picker").forEach(n=>n.remove());
  const overlay=document.createElement("div");overlay.className="round-program-picker";
  overlay.innerHTML=\`<div class="round-picker-card"><p>次のゲーム</p><h2>\${MODE_LABELS[payload.mode]}</h2><strong>使用する駒を選んでください</strong><div class="round-picker-programs"></div><div class="round-countdown">30</div></div>\`;
  document.body.append(overlay);const host=overlay.querySelector(".round-picker-programs");
  for(const p of state.programs){const b=document.createElement("button");b.className="program-choice";b.textContent=p.name;b.onclick=async()=>{try{await emitSocket("now:set-round-program",{roomId:payload.roomId,program:{programId:p.programId,name:p.name,blocks:p.blocks}});overlay.querySelectorAll("button").forEach(x=>x.disabled=true);b.classList.add("is-selected");}catch{toast("駒の選択に失敗しました")}};host.append(b);}
  const deadline=Number(payload.deadline)||Date.now()+30000;const update=()=>{if(!document.body.contains(overlay))return;const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));overlay.querySelector(".round-countdown").textContent=String(left);if(left>0)setTimeout(update,250);};update();
}

function setMenu`,
  "round prepare replacement"
);

fs.writeFileSync(file, src);
console.log("patched app-v3 online series client");
