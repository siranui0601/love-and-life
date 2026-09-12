import {
  BOARD,
  FINGER_NAMES,
  applyCare,
  chooseCpuCommands,
  createInitialState,
  finishCommand,
  getNail,
  segmentDefense,
  setDirection,
  tipMaterial,
} from "./engine.js";
import {
  directionForView,
  engineDirectionFromView,
  fingerStateText,
  renderBoard,
} from "./view.js";
import { animateCare, animateTurn, careFxContext } from "./fx.js";
import { NailOnlineClient, onlineErrorMessage } from "./online.js";

const $ = (id) => document.getElementById(id);
const clone = (value) => structuredClone(value);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const els = {
  start: $("startScreen"), lobby: $("lobbyScreen"), game: $("gameShell"), board: $("boardSvg"),
  onlineBtn: $("onlineBtn"), cpuBtn: $("cpuBtn"), rulesBtn: $("rulesBtn"), rules: $("rulesDialog"),
  lobbyBack: $("lobbyBackBtn"), createRoom: $("createRoomBtn"), joinForm: $("joinForm"), roomInput: $("roomIdInput"),
  lobbyEntry: $("lobbyEntry"), waitingRoom: $("waitingRoom"), roomCode: $("roomCode"), copyRoom: $("copyRoomBtn"),
  waitingNote: $("waitingNote"), memberSlots: $("memberSlots"), startOnline: $("startOnlineBtn"), leaveRoom: $("leaveRoomBtn"), lobbyMessage: $("lobbyMessage"),
  localName: $("localName"), opponentName: $("opponentName"), localLabel: $("localLabel"), opponentLabel: $("opponentLabel"),
  localCapture: $("localCapture"), opponentCapture: $("opponentCapture"), round: $("roundValue"), turnText: $("turnText"), careCount: $("careCount"),
  selectedName: $("selectedFingerName"), selectedState: $("selectedState"), directionPad: $("directionPad"), careGrid: $("careGrid"),
  gelStock: $("gelStock"), hookStock: $("hookStock"), sculptStock: $("sculptStock"), boardHint: $("boardHint"),
  targetBanner: $("targetBanner"), targetTitle: $("targetTitle"), targetText: $("targetText"), cancelTarget: $("cancelTargetBtn"),
  resetTurn: $("resetTurnBtn"), commit: $("commitBtn"), careDialog: $("careDialog"), careDialogForm: $("careDialogForm"),
  careDialogTitle: $("careDialogTitle"), careDialogText: $("careDialogText"), carePreview: $("carePreview"), careConfirm: $("careConfirmBtn"),
  result: $("resultScreen"), resultTitle: $("resultTitle"), resultText: $("resultText"), rematch: $("rematchBtn"), toast: $("toast"), live: $("liveRegion"),
};

let mode = null;
let state = null;
let draftState = null;
let selectedFinger = 0;
let targeting = null;
let pendingCares = [];
let pendingConfirm = null;
let localPlayer = 0;
let onlineRoom = null;
let isHost = false;
let lastActionId = null;
let renderedVersion = -1;
let transitioning = false;
let roomQueue = Promise.resolve();

function showOnly(which) {
  els.start.hidden = which !== "start";
  els.lobby.hidden = which !== "lobby";
  els.game.hidden = which !== "game";
}

function toast(message, ms = 1900) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { els.toast.hidden = true; }, ms);
}

function announce(message) {
  els.live.textContent = "";
  requestAnimationFrame(() => { els.live.textContent = message; });
}

function firstAliveFinger(player = localPlayer, source = draftState || state) {
  if (!source) return 0;
  for (let i = 0; i < 5; i += 1) {
    const nail = getNail(source, player, i);
    if (nail?.alive) return i;
  }
  return 0;
}

function viewPlayer() {
  return mode === "online" ? localPlayer : 0;
}

function canEdit() {
  if (!state || transitioning || state.phase !== "command") return false;
  if (mode === "online" && onlineRoom?.status !== "playing") return false;
  return state.commander === localPlayer;
}

function ensureSelectedAlive() {
  const source = draftState || state;
  if (!source) return;
  if (!getNail(source, localPlayer, selectedFinger)?.alive) selectedFinger = firstAliveFinger(localPlayer, source);
}

function renderPips(el, count) {
  el.innerHTML = [0, 1].map((i) => `<i class="${i < count ? "on" : ""}"></i>`).join("");
}

function nameFor(player) {
  if (mode === "cpu") return player === 0 ? "あなた" : "CPU";
  return onlineRoom?.members?.find((m) => m.player === player)?.username || (player === localPlayer ? "あなた" : "相手");
}

function renderLobby() {
  const room = onlineRoom;
  const waiting = Boolean(room);
  els.lobbyEntry.hidden = waiting;
  els.waitingRoom.hidden = !waiting;
  if (!room) return;
  els.roomCode.textContent = room.roomId;
  const members = [...(room.members || [])].sort((a, b) => a.player - b.player);
  els.memberSlots.innerHTML = [0,1].map((player) => {
    const member = members.find((m) => m.player === player);
    return `<div class="member-slot"><strong>${member ? escapeHtml(member.username) : "待機中…"}</strong><small>${player === 0 ? "先手側" : "後手側"}</small></div>`;
  }).join("");
  if (room.status === "lobby") {
    els.waitingNote.textContent = members.length < 2 ? "相手を待っています…" : "2人そろいました。部屋を作った人が開始できます。";
    els.startOnline.hidden = false;
    els.startOnline.disabled = !isHost || members.length !== 2;
    els.startOnline.textContent = isHost ? "この2人で開始" : "ホストの開始を待つ";
  } else {
    els.startOnline.hidden = true;
    els.waitingNote.textContent = room.status === "closed" ? "相手が退出しました。" : "対局を開始します…";
  }
}

function renderHud() {
  if (!state) return;
  const source = canEdit() ? draftState : state;
  els.localName.textContent = nameFor(localPlayer);
  els.opponentName.textContent = nameFor(1 - localPlayer);
  els.localLabel.textContent = mode === "online" ? "YOU" : "YOU";
  els.opponentLabel.textContent = mode === "online" ? "OPPONENT" : "CPU";
  renderPips(els.localCapture, state.captures[localPlayer]);
  renderPips(els.opponentCapture, state.captures[1 - localPlayer]);
  els.round.textContent = state.round;
  if (state.phase === "over") els.turnText.textContent = "対局終了";
  else if (state.commander === localPlayer) els.turnText.textContent = "あなたの操作";
  else els.turnText.textContent = mode === "cpu" ? "CPUが考えています" : "相手の操作を待っています";
  els.careCount.textContent = `ケア ${source?.careRemaining?.[localPlayer] ?? 0} / ${BOARD.carePerTurn}`;
}

function renderControls() {
  if (!state) return;
  ensureSelectedAlive();
  const editable = canEdit();
  const source = editable ? draftState : state;
  const nail = getNail(source, localPlayer, selectedFinger);
  els.selectedName.textContent = nail?.alive ? FINGER_NAMES[selectedFinger] : "—";
  els.selectedState.textContent = nail?.alive ? fingerStateText(source, localPlayer, selectedFinger) : "詰められた指";
  const currentViewDir = nail?.alive ? directionForView(nail, viewPlayer()) : 0;
  els.directionPad.querySelectorAll("button[data-view-dir]").forEach((button) => {
    const dir = Number(button.dataset.viewDir);
    button.classList.toggle("is-selected", dir === currentViewDir);
    button.disabled = !editable || !nail?.alive;
  });

  const stock = source.stock?.[localPlayer] || { gel:0, hook:0, sculpt:0 };
  els.gelStock.textContent = `×${stock.gel}`;
  els.hookStock.textContent = `×${stock.hook}`;
  els.sculptStock.textContent = `×${stock.sculpt}`;
  const noCare = !editable || !nail?.alive || source.careRemaining[localPlayer] <= 0 || nail.careUsedThisRound;
  els.careGrid.querySelectorAll("button[data-care]").forEach((button) => {
    const type = button.dataset.care;
    let disabled = noCare;
    if (type === "gel" && stock.gel <= 0) disabled = true;
    if (type === "hook" && stock.hook <= 0) disabled = true;
    if (type === "sculpt" && stock.sculpt <= 0) disabled = true;
    if (type === "hide" && nail?.hidLastRound) disabled = true;
    if (type === "cut" && (nail?.path?.length || 0) <= 1) disabled = true;
    button.disabled = disabled;
    button.classList.toggle("is-targeting", targeting === type);
  });
  els.targetBanner.hidden = targeting !== "gel";
  els.resetTurn.disabled = !editable || pendingCares.length === 0 && JSON.stringify(state.nails.filter((n)=>n.player===localPlayer).map((n)=>n.direction)) === JSON.stringify(draftState.nails.filter((n)=>n.player===localPlayer).map((n)=>n.direction));
  els.commit.disabled = !editable;
  if (targeting === "gel") {
    els.targetTitle.textContent = `${FINGER_NAMES[selectedFinger]}：ジェルを塗る位置`;
    els.targetText.textContent = "青い点線の、自分の爪だけ選べます。敵の爪には触れません。";
  }
}

function renderHint() {
  if (!state) return;
  if (targeting === "gel") els.boardHint.textContent = "青く光っている、自分の爪の節をタップ。";
  else if (state.phase === "over") els.boardHint.textContent = "対局終了";
  else if (state.commander !== localPlayer) els.boardHint.textContent = mode === "online" ? "相手の操作が終わると盤面が更新されます。" : "CPUが操作中…";
  else els.boardHint.textContent = "自分の指を選び、方向とケアを決めよう。";
}

function renderAll() {
  if (!state) return;
  const source = canEdit() ? draftState : state;
  renderBoard(els.board, source, {
    viewPlayer: viewPlayer(), localPlayer, selectedFinger, targeting, canEdit: canEdit(),
  });
  renderHud(); renderControls(); renderHint();
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

function openGame() {
  showOnly("game");
  els.result.hidden = true;
  draftState = clone(state);
  pendingCares = [];
  targeting = null;
  ensureSelectedAlive();
  renderAll();
}

function showStart() {
  mode = null; state = null; draftState = null; onlineRoom = null; targeting = null; pendingCares = [];
  els.result.hidden = true;
  showOnly("start");
}

function careCopy(type, nail, segmentIndex = null) {
  const stock = draftState.stock[localPlayer];
  const map = {
    sharpen: ["研ぐ", "現在の爪先を研ぎ、攻撃力を P+1 します。先端が折れれば効果も失います。"],
    hook: ["鉤爪を仕込む", `根元の新しい節に鉤爪を仕込みます。成長と一緒に先端へ流れ、側面攻撃 P3 になります。残り ${stock.hook} 個。`],
    sculpt: ["スカルプを付ける", `このラウンドの自然成長後、生き残っていればさらに1マス進みます。残り ${stock.sculpt} 個。`],
    hide: ["爪を隠す", "このラウンドだけ敵の爪との当たり判定を消します。自分の爪同士はすり抜けません。"],
    cut: ["先端を切る", "現在の先端を1節だけ切り落とします。切った破片は盤面から消えます。"],
  };
  if (type === "gel") {
    const d = segmentDefense(nail, segmentIndex);
    const position = segmentIndex === nail.path.length - 1 ? "先端" : `根元から${segmentIndex + 1}節目`;
    return ["ジェルを塗る", `${FINGER_NAMES[nail.fingerIndex]}の${position}を D${d} → D${d+1} にします。残り ${stock.gel} 個。`];
  }
  return map[type] || ["ケア", "このケアを実行します。"];
}

function openCareConfirm(type, segmentIndex = null) {
  const nail = getNail(draftState, localPlayer, selectedFinger);
  if (!nail?.alive) return;
  pendingConfirm = { type, segmentIndex };
  const [title, text] = careCopy(type, nail, segmentIndex);
  els.careDialogTitle.textContent = title;
  els.careDialogText.textContent = text;
  els.carePreview.dataset.type = type;
  els.careDialog.showModal();
}

async function confirmCare() {
  if (!pendingConfirm || !canEdit()) return;
  const { type, segmentIndex } = pendingConfirm;
  const options = Number.isInteger(segmentIndex) ? { segmentIndex } : {};
  const result = applyCare(draftState, localPlayer, selectedFinger, type, options);
  if (!result.ok) { toast(careReason(result.reason)); els.careDialog.close(); pendingConfirm = null; renderAll(); return; }
  pendingCares.push({ fingerIndex: selectedFinger, type, ...(Number.isInteger(segmentIndex) ? { segmentIndex } : {}) });
  targeting = null;
  els.careDialog.close();
  pendingConfirm = null;
  renderAll();
  if (result.effect) await animateCare(result.effect, careFxContext(viewPlayer()));
  renderAll();
}

function careReason(reason) {
  const map = { "care-unavailable":"この指にはこのラウンド、もうケアできません。", "out-of-stock":"在庫がありません。", "hide-cooldown":"同じ指を2ラウンド続けて隠せません。", "nothing-to-cut":"これ以上は切れません。" };
  return map[reason] || "このケアは今は使えません。";
}

function startCare(type) {
  if (!canEdit()) return;
  const nail = getNail(draftState, localPlayer, selectedFinger);
  if (!nail?.alive || nail.careUsedThisRound || draftState.careRemaining[localPlayer] <= 0) return;
  if (type === "gel") {
    if (draftState.stock[localPlayer].gel <= 0) return toast("ジェルの在庫がありません。");
    targeting = targeting === "gel" ? null : "gel";
    renderAll();
    return;
  }
  openCareConfirm(type);
}

function resetDraft() {
  if (!canEdit()) return;
  draftState = clone(state);
  pendingCares = [];
  targeting = null;
  renderAll();
  toast("このターンの操作を戻しました。", 1200);
}

function commandBundle() {
  return {
    directions: draftState.nails.filter((n) => n.player === localPlayer && n.alive).map((n) => ({ fingerIndex:n.fingerIndex, direction:n.direction })),
    cares: clone(pendingCares),
  };
}

async function transitionTo(nextState, events = [], before = state) {
  transitioning = true;
  state = clone(before);
  draftState = clone(before);
  renderAll();
  await animateTurn({
    events,
    beforeState: before,
    nextState,
    viewPlayer: viewPlayer(),
    renderFinal: () => {
      state = clone(nextState);
      draftState = clone(nextState);
      pendingCares = [];
      targeting = null;
      ensureSelectedAlive();
      renderAll();
    },
  });
  state = clone(nextState);
  draftState = clone(nextState);
  pendingCares = [];
  targeting = null;
  transitioning = false;
  ensureSelectedAlive();
  renderAll();
  maybeShowResult();
}

async function processCpuLead() {
  if (mode !== "cpu" || !state || state.phase !== "command" || state.commander !== 1) return;
  transitioning = true; renderAll();
  await sleep(260);
  chooseCpuCommands(state, 1);
  finishCommand(state, 1);
  draftState = clone(state);
  transitioning = false;
  renderAll();
}

async function commitCpu() {
  if (!canEdit()) return;
  transitioning = true;
  const before = clone(draftState);
  state = clone(draftState);
  let result = finishCommand(state, 0);
  if (!result.resolved && state.phase === "command" && state.commander === 1) {
    chooseCpuCommands(state, 1);
    result = finishCommand(state, 1);
  }
  const next = clone(state);
  await transitionTo(next, result.events || [], before);
  if (next.phase !== "over") await processCpuLead();
}

async function commitOnline() {
  if (!canEdit()) return;
  transitioning = true; renderAll();
  try {
    await online.command(commandBundle());
  } catch (error) {
    transitioning = false;
    toast(onlineErrorMessage(error));
    renderAll();
  }
}

async function commitTurn() {
  if (targeting) { toast("ジェルを塗る位置を選ぶか、『やめる』を押してください。"); return; }
  if (mode === "online") await commitOnline();
  else await commitCpu();
}

function maybeShowResult() {
  if (!state || state.phase !== "over") { els.result.hidden = true; return; }
  const winner = state.winner;
  if (winner === "draw") {
    els.resultTitle.textContent = "引き分け";
    els.resultText.textContent = "同じ瞬間に2本目を詰めました。";
  } else if (winner === localPlayer) {
    els.resultTitle.textContent = "勝利！";
    els.resultText.textContent = "先に2本の指を詰めました。";
  } else {
    els.resultTitle.textContent = "敗北";
    els.resultText.textContent = "2本の指を詰められました。";
  }
  if (mode === "online") {
    els.rematch.textContent = isHost ? "もう一局" : "ホストの再戦を待つ";
    els.rematch.disabled = !isHost;
  } else {
    els.rematch.textContent = "もう一局";
    els.rematch.disabled = false;
  }
  els.result.hidden = false;
}

async function startCpu() {
  mode = "cpu"; localPlayer = 0; onlineRoom = null; isHost = false;
  state = createInitialState({ mode:"cpu" });
  selectedFinger = 0;
  openGame();
  await processCpuLead();
}

function showLobby() {
  mode = "online";
  showOnly("lobby");
  renderLobby();
}

const online = new NailOnlineClient({
  onRoom(payload) {
    roomQueue = roomQueue.then(() => ingestRoom(payload)).catch((error) => {
      console.error(error); transitioning = false; toast("盤面の同期に失敗しました。");
    });
  },
  onError(error) { console.warn(error); },
});

async function ingestRoom({ room, you }) {
  const previousRoom = onlineRoom;
  const previousState = state ? clone(state) : null;
  const previousVersion = renderedVersion;
  onlineRoom = room;
  if (you) { localPlayer = you.player; isHost = Boolean(you.isHost); }
  sessionStorage.setItem("nailShogiRoomId", room.roomId);
  renderLobby();

  if (room.status === "lobby") {
    showOnly("lobby");
    transitioning = false;
    return;
  }
  if (room.status === "closed") {
    transitioning = false;
    toast("相手が部屋を退出しました。", 2800);
    showOnly("lobby");
    return;
  }
  if (!room.state) return;

  mode = "online";
  showOnly("game");
  const action = room.lastAction;
  const isNew = room.version > previousVersion && action?.id && action.id !== lastActionId;
  renderedVersion = Math.max(renderedVersion, room.version);
  if (action?.id) lastActionId = action.id;

  if (!previousState || previousRoom?.roomId !== room.roomId || !isNew) {
    state = clone(room.state);
    draftState = clone(room.state);
    pendingCares = [];
    targeting = null;
    transitioning = false;
    ensureSelectedAlive();
    renderAll();
    maybeShowResult();
    return;
  }

  const next = clone(room.state);
  await transitionTo(next, action?.events || [], previousState);
}

async function createRoom() {
  els.lobbyMessage.textContent = "";
  els.createRoom.disabled = true;
  try {
    const data = await online.create();
    onlineRoom = data.room; localPlayer = data.you.player; isHost = data.you.isHost; renderedVersion = data.room.version;
    renderLobby();
  } catch (error) { els.lobbyMessage.textContent = onlineErrorMessage(error); }
  finally { els.createRoom.disabled = false; }
}

async function joinRoom(event) {
  event.preventDefault(); els.lobbyMessage.textContent = "";
  try {
    const data = await online.join(els.roomInput.value);
    onlineRoom = data.room; localPlayer = data.you.player; isHost = data.you.isHost; renderedVersion = data.room.version;
    renderLobby();
  } catch (error) { els.lobbyMessage.textContent = onlineErrorMessage(error); }
}

async function leaveOnline() {
  await online.leave();
  sessionStorage.removeItem("nailShogiRoomId");
  onlineRoom = null; state = null; draftState = null; renderedVersion = -1; lastActionId = null; isHost = false;
  showLobby();
}

async function rematch() {
  els.result.hidden = true;
  if (mode === "cpu") return startCpu();
  if (!isHost) return toast("部屋を作った人が再戦を開始できます。");
  try { await online.rematch(); }
  catch (error) { toast(onlineErrorMessage(error)); }
}

els.rulesBtn.addEventListener("click", () => els.rules.showModal());
els.onlineBtn.addEventListener("click", showLobby);
els.cpuBtn.addEventListener("click", startCpu);
els.lobbyBack.addEventListener("click", async () => { if (onlineRoom) await leaveOnline(); showStart(); });
els.createRoom.addEventListener("click", createRoom);
els.joinForm.addEventListener("submit", joinRoom);
els.copyRoom.addEventListener("click", async () => { try { await navigator.clipboard.writeText(onlineRoom?.roomId || ""); toast("部屋番号をコピーしました。"); } catch { toast("コピーできませんでした。"); } });
els.startOnline.addEventListener("click", async () => { try { await online.start(); } catch (error) { toast(onlineErrorMessage(error)); } });
els.leaveRoom.addEventListener("click", leaveOnline);
els.cancelTarget.addEventListener("click", () => { targeting = null; renderAll(); });
els.resetTurn.addEventListener("click", resetDraft);
els.commit.addEventListener("click", commitTurn);
els.rematch.addEventListener("click", rematch);

els.directionPad.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view-dir]");
  if (!button || !canEdit()) return;
  const engineDir = engineDirectionFromView(Number(button.dataset.viewDir), viewPlayer());
  if (setDirection(draftState, localPlayer, selectedFinger, engineDir)) renderAll();
});

els.careGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-care]");
  if (!button || button.disabled) return;
  startCare(button.dataset.care);
});

els.board.addEventListener("click", (event) => {
  const segment = event.target.closest("[data-segment]");
  if (segment && targeting === "gel" && canEdit()) {
    const fingerIndex = Number(segment.dataset.finger);
    if (fingerIndex !== selectedFinger) return;
    openCareConfirm("gel", Number(segment.dataset.segment));
    return;
  }
  const target = event.target.closest("[data-finger]");
  if (!target || !canEdit()) return;
  const finger = Number(target.dataset.finger);
  if (!Number.isInteger(finger) || finger < 0 || finger > 4) return;
  if (!getNail(draftState, localPlayer, finger)?.alive) return;
  selectedFinger = finger;
  targeting = null;
  renderAll();
});

els.board.addEventListener("keydown", (event) => {
  if (!["Enter"," "].includes(event.key)) return;
  const target = event.target.closest?.("[data-finger]");
  if (!target || !canEdit()) return;
  event.preventDefault();
  selectedFinger = Number(target.dataset.finger);
  targeting = null;
  renderAll();
});

els.careConfirm.addEventListener("click", (event) => { event.preventDefault(); confirmCare(); });
els.careDialog.addEventListener("close", () => { pendingConfirm = null; });

window.addEventListener("pageshow", async () => {
  const roomId = sessionStorage.getItem("nailShogiRoomId");
  if (!roomId || onlineRoom) return;
  try {
    showLobby();
    const data = await online.reconnect(roomId);
    if (data) {
      onlineRoom = data.room; localPlayer = data.you.player; isHost = data.you.isHost; renderedVersion = data.room.version;
      if (data.room.state) { state = clone(data.room.state); draftState = clone(state); }
      renderLobby();
      if (data.room.status === "playing" || data.room.status === "finished") openGame();
    }
  } catch {
    sessionStorage.removeItem("nailShogiRoomId");
    onlineRoom = null; showStart();
  }
});

window.addEventListener("beforeunload", () => online.destroy());
showStart();
