import fs from "node:fs";
const file = "public/now-coding/app-v3.js";
let src = fs.readFileSync(file, "utf8");
function replaceExact(oldText, newText, label) {
  if (!src.includes(oldText)) throw new Error(`missing anchor: ${label}`);
  src = src.replace(oldText, newText);
}
function replaceRegex(pattern, replacement, label) {
  const before = src;
  src = src.replace(pattern, replacement);
  if (src === before) throw new Error(`missing regex anchor: ${label}`);
}

replaceExact(
  'drag: null, suppressClickUntil: 0, optionalTutorial: null,',
  'drag: null, suppressClickUntil: 0, optionalTutorial: null, tutorialFinalPassed: false,',
  'tutorial final flag'
);

replaceRegex(
  /function onTutorialAdd\(block\)\{.*?\nfunction checkTutorialStructure\(\)\{.*?\}\n\nfunction bindPalette/s,
  `function onTutorialAdd(block){
  if(!isTutorial())return;
  const s=Number(state.profile?.tutorialStep||0);
  if(s===1&&block.type==="action"&&block.action==="move")tutorialProgress(2);
  checkTutorialStructure();
}
function isFrontCliffCondition(expr){return expr?.type==="binary"&&expr.op==="=="&&expr.left?.type==="sensor"&&expr.left.direction==="front"&&expr.right?.type==="literal"&&expr.right.value==="cliff";}
function checkTutorialStructure(){
  if(!isTutorial())return;
  const s=Number(state.profile?.tutorialStep||0);
  const forever=state.draft.blocks.find(b=>b.type==="forever");
  const body=forever?.body||[];
  const moveIndex=body.findIndex(x=>x.type==="action"&&x.action==="move");
  if(s===3&&forever&&moveIndex>=0){tutorialProgress(4);return;}
  const ifIndex=body.findIndex(x=>x.type==="if"&&isFrontCliffCondition(x.condition));
  if(s===5&&ifIndex>=0){tutorialProgress(6);return;}
  if(s===6&&ifIndex>=0){
    const ifBlock=body[ifIndex];
    const hasTurn=(ifBlock.then||[]).some(x=>x.type==="action"&&["turnLeft","turnRight"].includes(x.action));
    const hasMoveAfter=body.slice(ifIndex+1).some(x=>x.type==="action"&&x.action==="move");
    if(hasTurn&&hasMoveAfter)tutorialProgress(7);
  }
}

function bindPalette`,
  'tutorial structure'
);

replaceRegex(
  /function runTest\(\)\{.*?\n\nfunction showView/s,
  `function runTest(){
  stopTest();
  const program=deepClone(state.draft.blocks);
  const game=createTerritoryState({seed:"tutorial-test-v3",size:15,maxTicks:90,stagnationTicks:70,players:[{id:"me",name:"あなた",color:"blue",program},{id:"dummy",name:"テストNPC",color:"red",program:[{type:"forever",body:[{type:"action",action:"turnRight"}]}]}],spawns:[{x:4,y:7,dir:1},{x:12,y:12,dir:0}]});
  renderBoard($("#testBoard"),game);$("#testStatus").textContent="実行中";
  const tutorialStepAtStart=Number(state.profile?.tutorialStep||0);
  let idle=0;
  state.testTimer=setInterval(()=>{
    const prev=game.board.map(r=>[...r]);stepTerritory(game);renderBoard($("#testBoard"),game,prev);
    const a=game.agents[0];const stopped=a.alive&&a.pc>=a.program.length&&!a.vm?.frames?.length;
    idle=stopped?idle+1:0;
    if(isTutorial()&&tutorialStepAtStart===7&&a.alive&&game.tick>=30){
      stopTest();state.tutorialFinalPassed=true;$("#testStatus").textContent="成功：崖を判断して走り続けられました。駒を保存してください。";$("#saveProgramButton").classList.add("tutorial-target");return;
    }
    if(!a.alive||game.finished||idle>=2){
      stopTest();
      if(!a.alive)$("#testStatus").textContent=\`テスト終了：\${a.deathReason==="cliff"?"崖から落ちました":"停止しました"}\`;
      else $("#testStatus").textContent=\`テスト終了：コードの末尾で停止（\${game.tick}tick）\`;
      if(isTutorial()&&tutorialStepAtStart===2&&stopped&&game.tick<=4)tutorialProgress(3);
      else if(isTutorial()&&tutorialStepAtStart===4&&!a.alive&&a.deathReason==="cliff")tutorialProgress(5);
    }
  },160);
}

function showView`,
  'test outcome tutorial'
);

replaceExact(
  'function openSave(){if(!state.user){toast("ログイン情報を取得できていません");setModal("#authModal",true);return;}$("#saveProgramName").value=state.draft.name==="新しい駒"?"":state.draft.name;$("#saveProgramError").textContent="";setModal("#saveProgramModal",true);}',
  'function openSave(){if(!state.user){toast("ログイン情報を取得できていません");setModal("#authModal",true);return;}if(isTutorial()&&!state.tutorialFinalPassed){toast("最後にテストを成功させてください");return;}$("#saveProgramName").value=state.draft.name==="新しい駒"?"":state.draft.name;$("#saveProgramError").textContent="";setModal("#saveProgramModal",true);}',
  'save tutorial guard'
);

const persistence = `
async function saveMatchRecord(game,results,{online=false,seriesId="",roundIndex=0,totalRounds=1}={}){
  if(!state.user?.userTrackingId)return null;
  if(online&&state.currentOnlineMeta?.saveOwnerId&&state.currentOnlineMeta.saveOwnerId!==state.user.userTrackingId)return null;
  const participants=game.agents.map(a=>({userTrackingId:a.userTrackingId||"",username:a.name,color:a.color}));
  const programs=game.agents.map(a=>({id:a.id,userTrackingId:a.userTrackingId||"",name:a.name,color:a.color,programName:a.programName||"",program:a.program}));
  try{
    const saved=await api("/api/now-coding/matches",{method:"POST",body:JSON.stringify({
      userTrackingId:state.user.userTrackingId,mode:game.mode,seed:game.seed,
      settings:{size:game.size,playerCount:game.agents.length,maxTicks:game.maxTicks,online,seriesId,roundIndex,totalRounds},
      participants,results,programs,spawn:game.spawns||[],durationTicks:game.tick,finishReason:game.finishReason,ruleVersion:game.ruleVersion||"now-coding-v3"
    })});
    state.matches.unshift({matchId:saved.matchId,replayId:saved.replayId,mode:game.mode,seed:game.seed,settings:{size:game.size,seriesId,roundIndex,totalRounds},results,createdAt:new Date().toISOString()});
    renderHome();return saved;
  }catch(error){console.warn("match save failed",error);toast("対戦記録の保存に失敗しました");return null;}
}
async function replayMatch(replayId){
  if(!replayId||!state.user)return;
  try{
    const d=await api(\`/api/now-coding/replays/\${encodeURIComponent(replayId)}?userTrackingId=\${encodeURIComponent(state.user.userTrackingId)}\`);
    const r=d.replay;const players=(r.programs||[]).map((p,i)=>({id:p.id||\`p\${i}\`,userTrackingId:p.userTrackingId||"",name:p.name||\`駒\${i+1}\`,color:p.color||PLAYER_COLORS[i],program:p.program||[]}));
    state.series=null;state.onlineSeries=null;state.currentOnlineMeta=null;showView("battle",true);startBattle({mode:r.mode||"territory",seed:r.seed,size:Number(r.settings?.size||21),players,spawns:r.spawn||null,maxTicks:Number(r.settings?.maxTicks||600)},true);
  }catch(error){console.error(error);toast("リプレイを読み込めませんでした");}
}
`;
replaceExact('function selectedModeArray(online=false){', persistence+'function selectedModeArray(online=false){', 'persistence insertion');

replaceExact(
  'row.innerHTML=`<div><strong>${esc(MODE_LABELS[x.mode]||"対戦")}</strong><br><small>Seed ${esc(x.seed||"")}</small></div><span></span>`;m.append(row);',
  'row.innerHTML=`<div><strong>${esc(MODE_LABELS[x.mode]||"対戦")}</strong><br><small>Seed ${esc(x.seed||"")}</small></div>${x.replayId?`<button class="text-button" type="button">再生</button>`:"<span></span>"}`;const replayButton=row.querySelector("button");if(replayButton)replayButton.onclick=()=>replayMatch(x.replayId);m.append(row);',
  'home replay button'
);

replaceExact(
  'async function finishRound(game,replay=false){stopBattle();const results=gameResults(game);if(state.currentOnlineMeta?.series&&!replay){await finishOnlineRound(game,results);return;}if(state.series&&state.series.modes.length>1&&!replay){',
  'async function finishRound(game,replay=false){stopBattle();const results=gameResults(game);if(!replay){const online=Boolean(state.currentOnlineMeta);const seriesId=online?(state.currentOnlineMeta?.roomId||""):(state.series?.masterSeed||"");const roundIndex=online?Number(state.currentOnlineMeta?.roundIndex||0):Number(state.series?.index||0);const totalRounds=online?Number(state.currentOnlineMeta?.totalRounds||1):Number(state.series?.modes?.length||1);void saveMatchRecord(game,results,{online,seriesId,roundIndex,totalRounds});}if(state.currentOnlineMeta?.series&&!replay){await finishOnlineRound(game,results);return;}if(state.series&&state.series.modes.length>1&&!replay){',
  'finish persistence'
);

const infoPanel = `
function openInfoPanel(kind){
  document.querySelectorAll(".info-overlay").forEach(n=>n.remove());
  const content={
    rules:["ゲームルール","陣取り・床抜け・コブラ・スプラは、対戦画面の4つのゲームボタンを選ぶと詳しい説明が表示されます。複数選択すると自動的に総合戦になります。"],
    help:["ヘルプ","命令はタップまたはドラッグで配置できます。紫は制御、緑は条件、黄色の丸い枠は数値、ピンクは変数です。同じ形の受け口に同じ型の値を入れられます。"],
    settings:["設定","観戦中は盤面をタップすると駒の名前を表示できます。もう一度タップすると非表示になります。モーションを減らしたい場合は端末の『視差効果を減らす／モーションを減らす』設定に従います。"]
  }[kind];if(!content)return;
  const overlay=document.createElement("div");overlay.className="expression-overlay info-overlay";overlay.innerHTML=\`<div class="expression-card info-card"><h3>\${content[0]}</h3><p>\${content[1]}</p><button class="primary-button" type="button">閉じる</button></div>\`;overlay.querySelector("button").onclick=()=>overlay.remove();overlay.onclick=e=>{if(e.target===overlay)overlay.remove()};document.body.append(overlay);
}
`;
replaceExact('function setMenu(open){', infoPanel+'function setMenu(open){', 'info panel insertion');
replaceExact(
  'else if(a==="rules")toast("ゲームルールは対戦設定の各ゲーム説明から確認できます");else if(a==="help")toast("同じ形・同じ色のソケット同士が同じ型です。命令はタップでもドラッグでも配置できます。");else if(a==="settings")toast("設定は順次追加します")',
  'else if(a==="rules")openInfoPanel("rules");else if(a==="help")openInfoPanel("help");else if(a==="settings")openInfoPanel("settings")',
  'menu panels'
);

fs.writeFileSync(file, src);
console.log("patched client polish v2");
