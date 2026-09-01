import {
  NOW_CODING_RULE_VERSION,
  PLAYER_COLORS,
  createTerritoryState,
  makeDefaultProgram,
  makeNpcProgram,
  stepTerritory,
  territoryResults,
} from "./engine.js";
import { MODE_LABELS, MODE_RULE_VERSION, createGameState, gameResults, makeModeNpcProgram, stepGame } from "./modes.js";
import { TUTORIALS, tutorialById } from "./tutorials.js";

const GOOGLE_CLIENT_ID = "958867607494-2htl5kj0atpuriq65ssnq7hje66t1p6t.apps.googleusercontent.com";
const ACTION_LABELS = { move: "進む", turnLeft: "左に旋回", turnRight: "右に旋回" };
const SENSOR_LABELS = { front: "前", left: "左", right: "右" };
const CELL_LABELS = { unclaimed: "未取得／空き", own: "自分の色", enemy: "敵の色", cliff: "崖", player: "駒", ownTail: "自分の尾", enemyTail: "敵の尾" };
const BUILTIN_LABELS = { ink: "インク", tailLength: "尾の長さ" };
const COMPARE_LABELS = { "==": "＝", "!=": "≠", "<": "＜", "<=": "≦", ">": "＞", ">=": "≧" };
const MATH_LABELS = { "+": "＋", "-": "－", "*": "×", "/": "÷", "%": "余り" };
const LOGIC_LABELS = { and: "かつ", or: "または" };
const NPC_LABELS = { weak: "弱", medium: "中", strong: "強" };

const appState = {
  user: null,
  profile: null,
  programs: [],
  matches: [],
  draft: { programId: "", name: "新しい駒", blocks: [] },
  selectedProgramId: "",
  currentView: "home",
  battleStep: 1,
  battleKind: "npc",
  selectedMode: "territory",
  optionalTutorial: null,
  testTimer: null,
  battleTimer: null,
  battleState: null,
  lastBattleConfig: null,
  replayMode: false,
  onlineMatch: null,
  pendingGoogle: null,
  socket: null,
  onlineRoom: null,
  publicRooms: [],
  dragging: null,
  suppressPaletteClickUntil: 0,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function parseJwt(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(base64).split("").map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`).join(""));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function toast(message) {
  const region = $("#toastRegion");
  if (!region) return;
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  region.appendChild(node);
  setTimeout(() => node.remove(), 3100);
}

function setModal(selector, open) {
  const node = $(selector);
  if (!node) return;
  node.setAttribute("aria-hidden", open ? "false" : "true");
}

async function api(path, options = {}) {
  const init = { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } };
  const response = await fetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function safeStoredUser() {
  try {
    const raw = localStorage.getItem("currentUser");
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.username && !parsed.userTrackingId) parsed.userTrackingId = localStorage.getItem("userTrackingId") || "";
    return parsed?.username && parsed?.userTrackingId ? parsed : null;
  } catch {
    return null;
  }
}

function storeUser(user) {
  appState.user = user;
  if (!user) {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("username");
    localStorage.removeItem("userTrackingId");
    $("#userLabel").textContent = "未接続";
    disconnectOnline();
    return;
  }
  localStorage.setItem("currentUser", JSON.stringify(user));
  localStorage.setItem("username", user.username || "");
  localStorage.setItem("userTrackingId", user.userTrackingId || "");
  $("#userLabel").textContent = user.username || "接続済み";
}

async function loginWithCredentials() {
  const username = $("#loginUsername").value.trim();
  const password = $("#loginPassword").value;
  const errorNode = $("#authError");
  errorNode.textContent = "";
  if (!username || !password) {
    errorNode.textContent = "ユーザーネームとパスワードを入力してください。";
    return;
  }
  try {
    const response = await fetch("/api/user/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json();
    if (!response.ok || !data.exists) throw new Error(data.error || "ログインに失敗しました");
    storeUser({ email: username, username: data.username, googleName: null, userTrackingId: data.userTrackingId || "" });
    setModal("#authModal", false);
    $("#loginPassword").value = "";
    await bootstrapUserData();
  } catch (error) {
    errorNode.textContent = error.message || "ログインに失敗しました。";
  }
}

async function handleGoogleCredential(credentialResponse) {
  const payload = parseJwt(credentialResponse.credential);
  if (!payload?.email) {
    $("#authError").textContent = "Googleアカウントの情報を取得できませんでした。";
    return;
  }
  try {
    const response = await fetch("/api/user/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: payload.email }) });
    const lookup = await response.json();
    if (lookup.exists && lookup.username) {
      storeUser({ email: payload.email, username: lookup.username, googleName: lookup.displayName || payload.name || "", userTrackingId: lookup.userTrackingId || "" });
      setModal("#authModal", false);
      await bootstrapUserData();
      return;
    }
    appState.pendingGoogle = { email: payload.email, gName: payload.name || "ゲスト" };
    $("#googleUsernameInput").value = payload.name || "";
    setModal("#authModal", false);
    setModal("#usernameModal", true);
  } catch {
    $("#authError").textContent = "Googleログインの確認に失敗しました。";
  }
}

async function saveGoogleUsername() {
  const username = $("#googleUsernameInput").value.trim();
  const pending = appState.pendingGoogle;
  if (!pending || !username) {
    $("#usernameError").textContent = "ユーザーネームを入力してください。";
    return;
  }
  try {
    const response = await fetch("/api/user/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: pending.email, username, googleDisplayName: pending.gName }) });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || "登録に失敗しました");
    storeUser({ email: pending.email, username: data.username, googleName: data.displayName || pending.gName, userTrackingId: data.userTrackingId || "" });
    appState.pendingGoogle = null;
    setModal("#usernameModal", false);
    await bootstrapUserData();
  } catch (error) {
    $("#usernameError").textContent = error.message;
  }
}

function initGoogleButton() {
  if (!window.google?.accounts?.id || !$("#googleSignInBtn")) return;
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential, ux_mode: "popup" });
  google.accounts.id.renderButton($("#googleSignInBtn"), { theme: "filled_black", size: "large", shape: "pill", text: "continue_with", width: 320 });
}

async function bootstrapUserData() {
  if (!appState.user?.userTrackingId) return;
  const id = encodeURIComponent(appState.user.userTrackingId);
  try {
    const [profileData, programData, matchData] = await Promise.all([
      api(`/api/now-coding/profile?userTrackingId=${id}`),
      api(`/api/now-coding/programs?userTrackingId=${id}`),
      api(`/api/now-coding/matches?userTrackingId=${id}&limit=12`),
    ]);
    appState.profile = profileData.profile || { tutorialStep: 0, tutorialDone: false, prefs: {} };
    appState.programs = programData.programs || [];
    appState.matches = matchData.matches || [];
    if (!appState.selectedProgramId && appState.programs[0]) appState.selectedProgramId = appState.programs[0].programId;
    renderHome();
    renderBattleProgramList();
    updateTutorialGate();
    connectOnline();
    if (isTutorialLocked()) requestAnimationFrame(() => startTutorial());
  } catch (error) {
    console.error(error);
    toast("保存データの読み込みに失敗しました");
  }
}

function renderHome() {
  const programs = $("#homePrograms");
  programs.innerHTML = "";
  if (!appState.programs.length) {
    programs.className = "stack-list empty-state";
    programs.textContent = "まだ保存された駒はありません。";
  } else {
    programs.className = "stack-list";
    appState.programs.slice(0, 4).forEach((program) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `<div><strong>${escapeHtml(program.name)}</strong><br><small>${program.blocks.length}ブロック ・ ${escapeHtml(formatDate(program.updatedAt))}</small></div><button class="text-button" type="button" ${isTutorialLocked() ? "disabled" : ""}>編集</button>`;
      row.querySelector("button").addEventListener("click", () => openProgram(program.programId));
      programs.appendChild(row);
    });
  }

  const matches = $("#homeMatches");
  matches.innerHTML = "";
  if (!appState.matches.length) {
    matches.className = "stack-list empty-state";
    matches.textContent = "対戦記録はまだありません。";
  } else {
    matches.className = "stack-list";
    appState.matches.slice(0, 5).forEach((match) => {
      const mine = match.results?.find((result) => result.userTrackingId === appState.user.userTrackingId);
      const row = document.createElement("div");
      row.className = "list-row";
      const metric = mine?.metric || (Number.isFinite(mine?.claimed) ? `${mine.claimed}マス` : Number.isFinite(mine?.colored) ? `${mine.colored}マス` : Number.isFinite(mine?.survivedTicks) ? `${mine.survivedTicks}tick 生存` : "記録あり");
      row.innerHTML = `<div><strong>${mine ? `${mine.rank}位 / ${metric}` : (MODE_LABELS[match.mode] || "対戦")}</strong><br><small>${escapeHtml(formatDate(match.createdAt))} ・ ${escapeHtml(MODE_LABELS[match.mode] || "陣取り")} ・ Seed ${escapeHtml(match.seed)}</small></div><button class="text-button" type="button" ${isTutorialLocked() ? "disabled" : ""}>再生</button>`;
      row.querySelector("button").addEventListener("click", () => replayMatch(match.replayId));
      matches.appendChild(row);
    });
  }
}

function isTutorialLocked() {
  return Boolean(appState.profile && !appState.profile.tutorialDone);
}

function updateTutorialGate() {
  const locked = isTutorialLocked();
  document.body.classList.toggle("tutorial-locked", locked);
  $("#firstProgramCard").classList.toggle("is-hidden", !locked);
  $$('[data-locked-until-tutorial]').forEach((node) => { node.disabled = locked; node.setAttribute("aria-disabled", locked ? "true" : "false"); });
  $("#menuButton").disabled = locked;
  renderHome();
  renderTutorialCoach();
}

function updateTutorialTargets() {
  if (!isTutorialLocked() || appState.currentView !== "editor") {
    $$('[data-add-block], #runTestButton, #saveProgramButton').forEach((node) => node.classList.remove("tutorial-target", "tutorial-muted"));
    return;
  }
  const step = Number(appState.profile?.tutorialStep || 0);
  const allowed = new Set();
  if (step === 1) allowed.add("move");
  if (step === 2) { allowed.add("turnLeft"); allowed.add("turnRight"); }
  if (step === 3) allowed.add("ifCell");
  $$('[data-add-block]').forEach((node) => {
    const active = allowed.has(node.dataset.addBlock);
    node.disabled = allowed.size > 0 && !active;
    node.classList.toggle("tutorial-target", active);
    node.classList.toggle("tutorial-muted", allowed.size > 0 && !active);
  });
  const testActive = step === 4;
  $("#runTestButton").disabled = step < 4;
  $("#runTestButton").classList.toggle("tutorial-target", testActive);
  $("#saveProgramButton").disabled = step < 5;
  $("#saveProgramButton").classList.toggle("tutorial-target", step === 5);
  $("#newProgramButton").disabled = true;
}

async function setTutorialProgress(step, done = false) {
  if (!appState.user) return;
  const tutorialStep = Math.max(Number(appState.profile?.tutorialStep || 0), Number(step) || 0);
  try {
    const data = await api("/api/now-coding/profile", {
      method: "PUT",
      body: JSON.stringify({ userTrackingId: appState.user.userTrackingId, tutorialStep, tutorialDone: Boolean(done), prefs: appState.profile?.prefs || {} }),
    });
    appState.profile = data.profile;
    updateTutorialGate();
  } catch (error) {
    console.warn("tutorial progress save failed", error);
  }
}

function startTutorial() {
  newDraft();
  showView("editor", { force: true });
  if (!appState.profile) appState.profile = { tutorialStep: 0, tutorialDone: false, prefs: {} };
  appState.profile.tutorialDone = false;
  renderTutorialCoach();
}

function renderTutorialCoach() {
  const coach = $("#tutorialCoach");
  if (!coach) return;
  if (!isTutorialLocked() || appState.currentView !== "editor") {
    coach.classList.add("is-hidden");
    updateTutorialTargets();
    return;
  }
  const step = Number(appState.profile?.tutorialStep || 0);
  const content = [
    {
      title: "このゲームで競うこと",
      text: "Now Codingでは、対戦中に駒を直接操作しません。試合の前に『周囲をどう見て、どんな条件で、どちらへ動くか』をコードとして組みます。開始後、駒はそのコードだけで自律行動します。より良い判断を組めた駒ほど、盤面で有利になります。",
      button: "実際に作ってみる",
    },
    { title: "まず1マス進ませる", text: "「進む」を追加してください。進む命令は1tickを使い、駒が向いている前方へ1マス移動します。", button: "" },
    { title: "向きを変える", text: "「左に旋回」か「右に旋回」を追加してください。旋回も1tickです。後退したい場合も、旋回を組み合わせて自分で作ります。", button: "" },
    { title: "周囲を見て判断する", text: "「もし 周囲のマスが…」を追加してください。前・左・右だけを観測して、未取得・自分の色・敵の色・崖などに応じて行動を変えられます。", button: "" },
    { title: "コードを実際に走らせる", text: "テスト実行を押してください。ここまで組んだ命令が、tickごとにどんな動きになるか盤面で確認します。", button: "" },
    { title: "最初の駒を保存する", text: "保存を押し、駒に名前を付けてください。保存できたらチュートリアルは完了し、対戦や他の画面が解放されます。", button: "" },
  ];
  const item = content[Math.min(step, content.length - 1)];
  $("#tutorialStepLabel").textContent = `${Math.min(step + 1, 6)} / 6`;
  $("#tutorialTitle").textContent = item.title;
  $("#tutorialText").textContent = item.text;
  const next = $("#tutorialNextButton");
  next.textContent = item.button || "次の操作をしてください";
  next.disabled = step !== 0;
  next.classList.toggle("is-hidden", step !== 0);
  coach.classList.remove("is-hidden");
  updateTutorialTargets();
}

function maybeAdvanceTutorialOnAdd(type) {
  if (!isTutorialLocked()) return;
  const step = Number(appState.profile?.tutorialStep || 0);
  if (step === 1 && type === "move") setTutorialProgress(2);
  else if (step === 2 && ["turnLeft", "turnRight"].includes(type)) setTutorialProgress(3);
  else if (step === 3 && type === "ifCell") setTutorialProgress(4);
}

function clearOptionalTutorialFocus() {
  $(".lesson-target").forEach((node) => node.classList.remove("lesson-target"));
}

function openTutorialLibrary() {
  if (isTutorialLocked()) return;
  const grid = $("#tutorialLibraryGrid");
  grid.innerHTML = "";
  for (const tutorial of TUTORIALS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tutorial-library-card";
    button.innerHTML = `<span class="tutorial-card-scan" aria-hidden="true"></span><strong>${escapeHtml(tutorial.title)}</strong><small>${escapeHtml(tutorial.summary)}</small>`;
    button.addEventListener("click", () => startOptionalTutorial(tutorial.id));
    grid.appendChild(button);
  }
  setModal("#tutorialLibraryModal", true);
}

function startOptionalTutorial(id) {
  const tutorial = tutorialById(id);
  if (!tutorial) return;
  setModal("#tutorialLibraryModal", false);
  appState.optionalTutorial = { id, step: 0 };
  if (tutorial.battleKind) setBattleKind(tutorial.battleKind);
  if (tutorial.view) showView(tutorial.view, { force: true });
  if (tutorial.mode) selectBattleMode(tutorial.mode);
  renderOptionalTutorial();
}

function renderOptionalTutorial() {
  clearOptionalTutorialFocus();
  const coach = $("#optionalTutorialCoach");
  const active = appState.optionalTutorial;
  if (!coach || !active) { coach?.classList.add("is-hidden"); return; }
  const tutorial = tutorialById(active.id);
  if (!tutorial) { appState.optionalTutorial = null; coach.classList.add("is-hidden"); return; }
  const step = Math.max(0, Math.min(tutorial.steps.length - 1, Number(active.step) || 0));
  active.step = step;
  const item = tutorial.steps[step];
  $("#optionalTutorialProgress").textContent = `${step + 1} / ${tutorial.steps.length}`;
  $("#optionalTutorialName").textContent = tutorial.title;
  $("#optionalTutorialTitle").textContent = item.title;
  $("#optionalTutorialText").textContent = item.text;
  $("#optionalTutorialPrev").disabled = step === 0;
  $("#optionalTutorialNext").textContent = step === tutorial.steps.length - 1 ? "完了" : "次へ";
  coach.classList.remove("is-hidden");
  if (item.focus) {
    const target = $(item.focus);
    target?.classList.add("lesson-target");
    target?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }
}

function moveOptionalTutorial(delta) {
  const active = appState.optionalTutorial;
  if (!active) return;
  const tutorial = tutorialById(active.id);
  if (!tutorial) return closeOptionalTutorial();
  const next = active.step + delta;
  if (next >= tutorial.steps.length) return closeOptionalTutorial();
  active.step = Math.max(0, next);
  renderOptionalTutorial();
}

function closeOptionalTutorial() {
  clearOptionalTutorialFocus();
  appState.optionalTutorial = null;
  $("#optionalTutorialCoach")?.classList.add("is-hidden");
}

function showView(name, { force = false } = {}) {
  if (!force && isTutorialLocked() && name !== "home") {
    toast("最初にチュートリアルを完了してください");
    return;
  }
  stopTest();
  if (name !== "battle") stopBattle(false);
  appState.currentView = name;
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
  $$(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.go === name));
  const index = { home: 0, editor: 1, battle: 2 }[name];
  const nav = $(".primary-nav");
  if (Number.isInteger(index) && nav) nav.style.setProperty("--nav-index", `${index * 100}%`);
  if (name === "editor") renderWorkspace();
  if (name === "battle") resetBattleView();
  renderTutorialCoach();
  renderOptionalTutorial();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showViewWithoutReset(name) {
  appState.currentView = name;
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
  $$(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.go === name));
}

function newDraft() {
  appState.draft = { programId: "", name: "新しい駒", blocks: [] };
  renderWorkspace();
}

function openProgram(programId) {
  if (isTutorialLocked()) return;
  const program = appState.programs.find((entry) => entry.programId === programId);
  if (!program) return;
  appState.draft = { programId: program.programId, name: program.name, blocks: structuredClone(program.blocks || []) };
  appState.selectedProgramId = program.programId;
  showView("editor");
}

function actionNode(action) {
  return { type: "action", action };
}

function literal(value) { return { type: "literal", value }; }
function variable(name) { return { type: "var", name }; }
function sensor(direction) { return { type: "sensor", direction }; }
function equalsCell(direction, value, negate = false) {
  const base = { type: "binary", op: "==", left: sensor(direction), right: literal(value) };
  return negate ? { type: "not", value: base } : base;
}

function createBlock(type) {
  if (["move", "turnLeft", "turnRight"].includes(type)) return actionNode(type);
  if (type === "attack") return { type: "action", action: "attack", uiKind: "attack", range: literal(3) };
  if (type === "ifBuiltin") return { type: "if", uiKind: "builtinCompare", builtinName: "ink", compareOp: ">", compareValue: 0, condition: { type: "binary", op: ">", left: { type: "builtin", name: "ink" }, right: literal(0) }, then: [actionNode("move")], else: [actionNode("turnRight")] };
  if (type === "forever") return { type: "forever", uiKind: "forever", body: [actionNode("move")] };
  if (type === "repeat") return { type: "repeat", uiKind: "repeat", times: literal(4), body: [actionNode("move")] };
  if (type === "ifCell") return { type: "if", uiKind: "cell", condition: { type: "cell", direction: "front", value: "unclaimed" }, then: [actionNode("move")], else: [actionNode("turnRight")] };
  if (type === "ifRandom") return { type: "if", uiKind: "chance", condition: { type: "random", chance: 0.5 }, then: [actionNode("turnLeft")], else: [actionNode("turnRight")] };
  if (type === "ifVariable") return { type: "if", uiKind: "variableCompare", varName: "count", compareOp: ">=", compareValue: 3, condition: { type: "binary", op: ">=", left: variable("count"), right: literal(3) }, then: [actionNode("move")], else: [actionNode("turnRight")] };
  if (type === "ifLogic") return { type: "if", uiKind: "logicPair", logic: { left: { direction: "front", value: "unclaimed", negate: false }, op: "and", right: { direction: "right", value: "cliff", negate: true } }, condition: { type: "binary", op: "and", left: equalsCell("front", "unclaimed"), right: equalsCell("right", "cliff", true) }, then: [actionNode("move")], else: [actionNode("turnRight")] };
  if (type === "setVar") return { type: "set", uiKind: "setLiteral", name: "count", value: literal(0) };
  if (type === "changeVar") return { type: "change", uiKind: "changeLiteral", name: "count", value: literal(1) };
  if (type === "mathVar") return { type: "set", uiKind: "mathVar", name: "count", mathOp: "+", mathValue: 1, value: { type: "binary", op: "+", left: variable("count"), right: literal(1) } };
  if (type === "randomVar") return { type: "set", uiKind: "randomVar", name: "roll", randomMin: 0, randomMax: 9, value: { type: "random", min: 0, max: 9 } };
  return actionNode("move");
}

function selectFrom(entries, value, onChange) {
  const select = document.createElement("select");
  for (const [key, label] of entries) select.add(new Option(label, key, false, key === value));
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function numberInput(value, onChange, { min = -9999, max = 9999, width = "74px" } = {}) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.style.width = width;
  input.addEventListener("change", () => onChange(Math.max(min, Math.min(max, Number(input.value) || 0))));
  return input;
}

function textInput(value, onChange, width = "96px") {
  const input = document.createElement("input");
  input.value = value;
  input.maxLength = 40;
  input.style.width = width;
  input.addEventListener("input", () => onChange(input.value));
  return input;
}

function actionSelect(value, onChange) {
  return selectFrom(Object.entries(ACTION_LABELS), value, onChange);
}

function updateLogicPair(block) {
  const logic = block.logic;
  block.condition = { type: "binary", op: logic.op, left: equalsCell(logic.left.direction, logic.left.value, logic.left.negate), right: equalsCell(logic.right.direction, logic.right.value, logic.right.negate) };
}

function blockContent(block) {
  const content = document.createElement("div");
  content.className = "block-content";
  if (block.type === "action") {
    if (block.action === "attack") {
      block.uiKind = "attack";
      content.append("前方へ 射程 ", numberInput(block.range?.value ?? 3, (v) => { block.range = literal(Math.max(1, v)); }, { min: 1, max: 20, width: "66px" }), " で攻撃");
      return content;
    }
    const strong = document.createElement("strong");
    strong.textContent = ACTION_LABELS[block.action] || "進む";
    content.appendChild(strong);
    return content;
  }
  if (block.uiKind === "forever") {
    content.append("ずっと ", actionSelect(block.body?.[0]?.action || "move", (v) => { block.body = [actionNode(v)]; }));
    return content;
  }
  if (block.uiKind === "repeat") {
    content.append(numberInput(block.times?.value ?? 4, (v) => { block.times = literal(Math.max(0, v)); }, { min: 0, max: 9999, width: "66px" }), " 回 繰り返す ", actionSelect(block.body?.[0]?.action || "move", (v) => { block.body = [actionNode(v)]; }));
    return content;
  }
  if (block.uiKind === "cell" || (block.type === "if" && block.condition?.type === "cell")) {
    block.uiKind = "cell";
    content.append("もし ");
    content.append(selectFrom(Object.entries(SENSOR_LABELS), block.condition.direction || "front", (v) => { block.condition.direction = v; }), " が ");
    content.append(selectFrom(Object.entries(CELL_LABELS), block.condition.value || "unclaimed", (v) => { block.condition.value = v; }), " なら ");
    content.append(actionSelect(block.then?.[0]?.action || "move", (v) => { block.then = [actionNode(v)]; }), " ／ そうでなければ ");
    content.append(actionSelect(block.else?.[0]?.action || "turnRight", (v) => { block.else = [actionNode(v)]; }));
    return content;
  }
  if (block.uiKind === "chance" || (block.type === "if" && block.condition?.type === "random")) {
    block.uiKind = "chance";
    content.append("もし Seed乱数が ");
    content.append(numberInput(Math.round((Number(block.condition.chance) || .5) * 100), (v) => { block.condition.chance = Math.max(0, Math.min(100, v)) / 100; }, { min: 0, max: 100, width: "68px" }), "% なら ");
    content.append(actionSelect(block.then?.[0]?.action || "turnLeft", (v) => { block.then = [actionNode(v)]; }), " ／ そうでなければ ", actionSelect(block.else?.[0]?.action || "turnRight", (v) => { block.else = [actionNode(v)]; }));
    return content;
  }
  if (block.uiKind === "builtinCompare") {
    const refresh = () => { block.condition = { type: "binary", op: block.compareOp, left: { type: "builtin", name: block.builtinName }, right: literal(block.compareValue) }; };
    content.append("もし ", selectFrom(Object.entries(BUILTIN_LABELS), block.builtinName || "ink", (v) => { block.builtinName = v; refresh(); }), " が ");
    content.append(selectFrom(Object.entries(COMPARE_LABELS), block.compareOp || ">", (v) => { block.compareOp = v; refresh(); }));
    content.append(numberInput(block.compareValue ?? 0, (v) => { block.compareValue = v; refresh(); }), " なら ", actionSelect(block.then?.[0]?.action || "move", (v) => { block.then = [actionNode(v)]; }), " ／ そうでなければ ", actionSelect(block.else?.[0]?.action || "turnRight", (v) => { block.else = [actionNode(v)]; }));
    return content;
  }
  if (block.uiKind === "variableCompare") {
    const refresh = () => { block.condition = { type: "binary", op: block.compareOp, left: variable(block.varName), right: literal(block.compareValue) }; };
    content.append("もし 変数 ", textInput(block.varName || "count", (v) => { block.varName = v; refresh(); }), " が ");
    content.append(selectFrom(Object.entries(COMPARE_LABELS), block.compareOp || ">=", (v) => { block.compareOp = v; refresh(); }));
    content.append(numberInput(block.compareValue ?? 3, (v) => { block.compareValue = v; refresh(); }), " なら ", actionSelect(block.then?.[0]?.action || "move", (v) => { block.then = [actionNode(v)]; }), " ／ そうでなければ ", actionSelect(block.else?.[0]?.action || "turnRight", (v) => { block.else = [actionNode(v)]; }));
    return content;
  }
  if (block.uiKind === "logicPair") {
    const sideEditor = (side) => {
      const group = document.createElement("span");
      group.className = "condition-chip";
      const neg = document.createElement("input");
      neg.type = "checkbox";
      neg.checked = Boolean(side.negate);
      neg.title = "ではない";
      neg.addEventListener("change", () => { side.negate = neg.checked; updateLogicPair(block); });
      group.append(neg, "否定 ", selectFrom(Object.entries(SENSOR_LABELS), side.direction, (v) => { side.direction = v; updateLogicPair(block); }), " が ", selectFrom(Object.entries(CELL_LABELS), side.value, (v) => { side.value = v; updateLogicPair(block); }));
      return group;
    };
    content.append("もし ", sideEditor(block.logic.left), " ", selectFrom(Object.entries(LOGIC_LABELS), block.logic.op, (v) => { block.logic.op = v; updateLogicPair(block); }), " ", sideEditor(block.logic.right), " なら ", actionSelect(block.then?.[0]?.action || "move", (v) => { block.then = [actionNode(v)]; }), " ／ そうでなければ ", actionSelect(block.else?.[0]?.action || "turnRight", (v) => { block.else = [actionNode(v)]; }));
    return content;
  }
  if (block.uiKind === "mathVar") {
    const refresh = () => { block.value = { type: "binary", op: block.mathOp, left: variable(block.name), right: literal(block.mathValue) }; };
    content.append("変数 ", textInput(block.name || "count", (v) => { block.name = v; refresh(); }), " を 自分自身 ");
    content.append(selectFrom(Object.entries(MATH_LABELS), block.mathOp || "+", (v) => { block.mathOp = v; refresh(); }));
    content.append(numberInput(block.mathValue ?? 1, (v) => { block.mathValue = v; refresh(); }), " にする");
    return content;
  }
  if (block.uiKind === "randomVar") {
    const refresh = () => { block.value = { type: "random", min: block.randomMin, max: block.randomMax }; };
    content.append("変数 ", textInput(block.name || "roll", (v) => { block.name = v; }), " = Seed乱数 ");
    content.append(numberInput(block.randomMin ?? 0, (v) => { block.randomMin = v; refresh(); }), " ～ ", numberInput(block.randomMax ?? 9, (v) => { block.randomMax = v; refresh(); }));
    return content;
  }
  if (block.type === "set" || block.type === "change") {
    const isSet = block.type === "set";
    content.append("変数 ", textInput(block.name || "count", (v) => { block.name = v; }), isSet ? " = " : " を ");
    content.append(numberInput(block.value?.value ?? (isSet ? 0 : 1), (v) => { block.value = literal(v); }), isSet ? " にする" : " 増減する");
    return content;
  }
  content.textContent = "未対応のブロック";
  return content;
}

function renderWorkspace() {
  const workspace = $("#programWorkspace");
  if (!workspace) return;
  workspace.innerHTML = "";
  $("#draftNamePreview").textContent = appState.draft.name || "新しい駒";
  appState.draft.blocks.forEach((block, index) => workspace.appendChild(renderBlock(block, index)));
  $("#blockCount").textContent = `${appState.draft.blocks.length} ブロック`;
  updateTutorialTargets();
}

function renderBlock(block, index) {
  const node = document.createElement("article");
  const kind = block.type === "if" ? "logic" : ["set", "change"].includes(block.type) ? "value" : ["forever", "repeat"].includes(block.type) ? "control" : "";
  node.className = `code-block ${kind}`;
  node.draggable = true;
  node.dataset.blockIndex = String(index);
  node.appendChild(blockContent(block));
  const tools = document.createElement("div");
  tools.className = "block-tools";
  const up = document.createElement("button"); up.type = "button"; up.textContent = "↑"; up.title = "上へ"; up.disabled = index === 0;
  const down = document.createElement("button"); down.type = "button"; down.textContent = "↓"; down.title = "下へ"; down.disabled = index === appState.draft.blocks.length - 1;
  const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "削除"; remove.className = "delete-block";
  up.addEventListener("click", () => moveBlock(index, -1));
  down.addEventListener("click", () => moveBlock(index, 1));
  remove.addEventListener("click", () => { appState.draft.blocks.splice(index, 1); renderWorkspace(); });
  tools.append(up, down, remove);
  node.appendChild(tools);
  node.addEventListener("dragstart", (event) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-now-coding-block-index", String(index));
    node.classList.add("is-dragging");
  });
  node.addEventListener("dragend", () => node.classList.remove("is-dragging"));
  return node;
}

function moveBlock(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= appState.draft.blocks.length) return;
  [appState.draft.blocks[index], appState.draft.blocks[next]] = [appState.draft.blocks[next], appState.draft.blocks[index]];
  renderWorkspace();
}

function workspaceInsertIndex(clientY) {
  const blocks = $$("#programWorkspace .code-block");
  for (let i = 0; i < blocks.length; i += 1) {
    const rect = blocks[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return i;
  }
  return blocks.length;
}

function addBlockAt(type, index = appState.draft.blocks.length) {
  const block = createBlock(type);
  appState.draft.blocks.splice(Math.max(0, Math.min(index, appState.draft.blocks.length)), 0, block);
  renderWorkspace();
  maybeAdvanceTutorialOnAdd(type);
}

function bindDragAndDrop() {
  const workspace = $("#programWorkspace");
  workspace.addEventListener("dragover", (event) => { event.preventDefault(); workspace.classList.add("is-drop-target"); });
  workspace.addEventListener("dragleave", (event) => { if (!workspace.contains(event.relatedTarget)) workspace.classList.remove("is-drop-target"); });
  workspace.addEventListener("drop", (event) => {
    event.preventDefault();
    workspace.classList.remove("is-drop-target");
    const addType = event.dataTransfer.getData("application/x-now-coding-palette");
    const moveIndexRaw = event.dataTransfer.getData("application/x-now-coding-block-index");
    const insertAt = workspaceInsertIndex(event.clientY);
    if (addType) addBlockAt(addType, insertAt);
    else if (moveIndexRaw !== "") {
      const from = Number(moveIndexRaw);
      if (!Number.isInteger(from) || from < 0 || from >= appState.draft.blocks.length) return;
      const [block] = appState.draft.blocks.splice(from, 1);
      const adjusted = from < insertAt ? insertAt - 1 : insertAt;
      appState.draft.blocks.splice(Math.max(0, adjusted), 0, block);
      renderWorkspace();
    }
  });

  $$('[data-add-block]').forEach((button) => {
    button.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-now-coding-palette", button.dataset.addBlock);
    });
    button.addEventListener("contextmenu", (event) => event.preventDefault());
    button.addEventListener("pointerdown", startPointerPaletteDrag);
  });
  workspace.addEventListener("contextmenu", (event) => { if (event.target.closest(".code-block")) event.preventDefault(); });
}

function startPointerPaletteDrag(event) {
  if (event.pointerType === "mouse" || event.button !== 0) return;
  const button = event.currentTarget;
  const origin = { x: event.clientX, y: event.clientY };
  let active = false;
  let ghost = null;
  const pointerId = event.pointerId;
  button.setPointerCapture?.(pointerId);
  const move = (moveEvent) => {
    const distance = Math.hypot(moveEvent.clientX - origin.x, moveEvent.clientY - origin.y);
    if (!active && distance > 8) {
      active = true;
      appState.suppressPaletteClickUntil = Date.now() + 500;
      ghost = document.createElement("div");
      ghost.className = "drag-ghost";
      ghost.textContent = button.textContent;
      document.body.appendChild(ghost);
      document.body.classList.add("is-touch-dragging");
    }
    if (!active) return;
    moveEvent.preventDefault();
    ghost.style.transform = `translate(${moveEvent.clientX + 14}px, ${moveEvent.clientY + 14}px)`;
    const rect = $("#programWorkspace").getBoundingClientRect();
    $("#programWorkspace").classList.toggle("is-drop-target", moveEvent.clientX >= rect.left && moveEvent.clientX <= rect.right && moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom);
  };
  const end = (upEvent) => {
    button.removeEventListener("pointermove", move);
    button.removeEventListener("pointerup", end);
    button.removeEventListener("pointercancel", end);
    document.body.classList.remove("is-touch-dragging");
    $("#programWorkspace").classList.remove("is-drop-target");
    ghost?.remove();
    if (active) {
      const rect = $("#programWorkspace").getBoundingClientRect();
      if (upEvent.clientX >= rect.left && upEvent.clientX <= rect.right && upEvent.clientY >= rect.top && upEvent.clientY <= rect.bottom) {
        addBlockAt(button.dataset.addBlock, workspaceInsertIndex(upEvent.clientY));
      }
    }
  };
  button.addEventListener("pointermove", move);
  button.addEventListener("pointerup", end);
  button.addEventListener("pointercancel", end);
}

function openSaveProgramModal() {
  if (isTutorialLocked() && Number(appState.profile?.tutorialStep || 0) < 5) return;
  $("#saveProgramName").value = appState.draft.name === "新しい駒" ? "" : appState.draft.name;
  $("#saveProgramError").textContent = "";
  setModal("#saveProgramModal", true);
  requestAnimationFrame(() => $("#saveProgramName").focus());
}

async function saveDraft() {
  if (!appState.user) return;
  const name = $("#saveProgramName").value.trim();
  if (!name) {
    $("#saveProgramError").textContent = "駒の名前を入力してください。";
    return;
  }
  try {
    const data = await api("/api/now-coding/programs", {
      method: "POST",
      body: JSON.stringify({ userTrackingId: appState.user.userTrackingId, programId: appState.draft.programId, name, blocks: appState.draft.blocks }),
    });
    appState.draft.programId = data.program.programId;
    appState.draft.name = data.program.name;
    const index = appState.programs.findIndex((program) => program.programId === data.program.programId);
    if (index >= 0) appState.programs[index] = data.program;
    else appState.programs.unshift(data.program);
    appState.selectedProgramId = data.program.programId;
    setModal("#saveProgramModal", false);
    if (isTutorialLocked() && Number(appState.profile?.tutorialStep || 0) >= 5) await setTutorialProgress(6, true);
    renderHome();
    renderBattleProgramList();
    toast("駒を保存しました");
    showView("home", { force: true });
  } catch (error) {
    $("#saveProgramError").textContent = error.message === "program_too_large" ? "コードが大きすぎます。" : "保存に失敗しました。";
  }
}

function cloneBoard(board) { return board.map((row) => [...row]); }

function ensureBoardCells(element, size) {
  if (Number(element.dataset.size) === size && element.children.length === size * size) return;
  element.innerHTML = "";
  element.dataset.size = String(size);
  element.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < size * size; i += 1) {
    const cell = document.createElement("div");
    cell.className = "board-cell";
    fragment.appendChild(cell);
  }
  element.appendChild(fragment);
}

function renderBoard(element, state, previousBoard = null) {
  ensureBoardCells(element, state.size);
  const cells = element.children;
  const occupied = new Map(state.agents.filter((agent) => agent.alive).map((agent) => [`${agent.x},${agent.y}`, agent]));
  const tails = new Map();
  for (const agent of state.agents) for (const tail of (agent.tail || [])) tails.set(`${tail.x},${tail.y}`, agent.color);
  const effects = new Map((state.effects || []).map((effect) => [`${effect.x},${effect.y}`, effect]));
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      const index = y * state.size + x;
      const cell = cells[index];
      const owner = state.board?.[y]?.[x] ?? -1;
      const color = owner >= 0 ? state.agents[owner]?.color : "";
      cell.className = `board-cell${color ? ` claim-${color}` : ""}`;
      if (state.holes?.has(`${x},${y}`)) cell.classList.add("is-hole");
      const effect = effects.get(`${x},${y}`);
      if (effect?.type === "shot") cell.classList.add("attack-flash", `attack-${effect.color}`);
      if (effect?.type === "collapse") cell.classList.add("collapse-flash");
      if (previousBoard && previousBoard[y]?.[x] !== owner && owner >= 0) cell.classList.add("just-claimed");
      cell.innerHTML = "";
      const tailColor = tails.get(`${x},${y}`);
      if (tailColor) { const tail = document.createElement("span"); tail.className = `tail-piece ${tailColor}`; cell.appendChild(tail); }
      const agent = occupied.get(`${x},${y}`);
      if (agent) {
        const piece = document.createElement("span");
        piece.className = `piece ${agent.color} dir-${agent.dir}`;
        piece.title = agent.name;
        cell.appendChild(piece);
      }
    }
  }
}

function stopTest() {
  if (appState.testTimer) clearInterval(appState.testTimer);
  appState.testTimer = null;
}

function runTest() {
  stopTest();
  const program = structuredClone(appState.draft.blocks.length ? appState.draft.blocks : [actionNode("move")]);
  const state = createTerritoryState({
    seed: "tutorial-test",
    size: 21,
    maxTicks: 140,
    players: [
      { id: "test-user", name: "あなたの駒", color: "blue", program },
      { id: "test-cpu", name: "テストNPC", color: "red", program: makeNpcProgram("medium", 1) },
    ],
  });
  renderBoard($("#testBoard"), state);
  $("#testStatus").textContent = "実行中。進む・旋回はいずれも1回につき1tickです。";
  if (isTutorialLocked() && Number(appState.profile?.tutorialStep || 0) === 4) setTutorialProgress(5);
  appState.testTimer = setInterval(() => {
    const prev = cloneBoard(state.board);
    stepTerritory(state);
    renderBoard($("#testBoard"), state, prev);
    if (state.finished) {
      stopTest();
      const mine = territoryResults(state).find((result) => result.id === "test-user");
      $("#testStatus").textContent = `テスト終了：${mine?.claimed || 0}マス取得 / ${state.tick}tick。`;
    }
  }, 80);
}

function freshSeed() {
  if (crypto?.getRandomValues) {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${values[0].toString(36)}-${values[1].toString(36)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function goBattleStep(step) {
  appState.battleStep = step;
  $$(".setup-step").forEach((node, index) => node.classList.toggle("is-active", index + 1 === step));
  $$(".stepper .step").forEach((node, index) => node.classList.toggle("is-current", index + 1 === step));
  if (step === 2) renderBattleProgramList();
  if (step === 3) renderBattleSummary();
}

function renderBattleProgramList() {
  const list = $("#battleProgramList");
  if (!list) return;
  list.innerHTML = "";
  if (!appState.programs.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `対戦に使える駒がありません。<button class="text-button" type="button">先に駒を作る</button>`;
    empty.querySelector("button").addEventListener("click", () => showView("editor"));
    list.appendChild(empty);
    return;
  }
  if (!appState.programs.some((program) => program.programId === appState.selectedProgramId)) appState.selectedProgramId = appState.programs[0].programId;
  for (const program of appState.programs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `program-choice${program.programId === appState.selectedProgramId ? " is-selected" : ""}`;
    button.innerHTML = `<span><strong>${escapeHtml(program.name)}</strong><br><small>${program.blocks.length}ブロック</small></span><small>${escapeHtml(formatDate(program.updatedAt))}</small>`;
    button.addEventListener("click", () => { appState.selectedProgramId = program.programId; renderBattleProgramList(); });
    list.appendChild(button);
  }
}

function selectBattleMode(mode) {
  if (!MODE_LABELS[mode]) mode = "territory";
  appState.selectedMode = mode;
  $("[data-mode]").forEach((card) => card.classList.toggle("is-selected", card.dataset.mode === mode));
  if ($("#onlineMode")) $("#onlineMode").value = mode;
  if (appState.battleStep === 3) renderBattleSummary();
}

function makeBattlePlayers(program, count, difficulty) {
  const players = [{ id: appState.user.userTrackingId, userTrackingId: appState.user.userTrackingId, name: appState.user.username, color: PLAYER_COLORS[0], program: structuredClone(program.blocks) }];
  for (let i = 1; i < count; i += 1) {
    players.push({ id: `npc-${appState.selectedMode}-${difficulty}-${i}`, userTrackingId: "", name: `NPC・${NPC_LABELS[difficulty] || "中"} ${i}`, color: PLAYER_COLORS[i], program: makeModeNpcProgram(appState.selectedMode, difficulty, i), npcDifficulty: difficulty });
  }
  return players;
}

function renderBattleSummary() {
  const program = appState.programs.find((entry) => entry.programId === appState.selectedProgramId);
  const seed = $("#seedInput").value.trim() || "自動生成";
  const difficulty = $("#npcDifficulty").value;
  $("#battleSummary").innerHTML = [
    ["対戦方法", "NPC対戦"], ["モード", MODE_LABELS[appState.selectedMode]], ["人数", `${$("#playerCount").value}人`], ["盤面", `${$("#boardSize").value} × ${$("#boardSize").value}`], ["NPC", NPC_LABELS[difficulty]], ["使用する駒", program?.name || "未選択"], ["Seed", seed],
  ].map(([label, value]) => `<div class="summary-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

function setBattleKind(kind) {
  appState.battleKind = kind === "online" ? "online" : "npc";
  $("#npcBattleTab").classList.toggle("is-active", appState.battleKind === "npc");
  $("#onlineBattleTab").classList.toggle("is-active", appState.battleKind === "online");
  $(".battle-kind-switch").style.setProperty("--kind-index", appState.battleKind === "online" ? "100%" : "0%");
  $("#battleSetup").classList.toggle("is-hidden", appState.battleKind !== "npc");
  $("#onlineSetup").classList.toggle("is-hidden", appState.battleKind !== "online");
  if (appState.battleKind === "online") renderOnlineArea();
}

function resetBattleView() {
  $("#battleLive").classList.add("is-hidden");
  setBattleKind(appState.battleKind);
  if (appState.battleKind === "npc") goBattleStep(1);
}

function startNpcBattle() {
  const program = appState.programs.find((entry) => entry.programId === appState.selectedProgramId);
  if (!program) { toast("対戦に使う駒を選んでください"); goBattleStep(2); return; }
  const count = Number($("#playerCount").value || 2);
  const difficulty = $("#npcDifficulty").value || "medium";
  const seed = $("#seedInput").value.trim() || freshSeed();
  const size = Number($("#boardSize").value || 21);
  startBattle({ mode: appState.selectedMode, seed, size, players: makeBattlePlayers(program, count, difficulty), maxTicks: Math.max(500, size * size * 2) });
}

function startBattle(config, { replay = false, online = false } = {}) {
  stopBattle(false);
  const state = createGameState({ mode: config.mode || "territory", seed: config.seed || freshSeed(), size: Number(config.size || 21), players: config.players || [], spawns: config.spawns || null, maxTicks: config.maxTicks || Math.max(500, Number(config.size || 21) ** 2 * 2), stagnationTicks: 140 });
  appState.selectedMode = state.mode;
  appState.battleState = state;
  appState.replayMode = replay;
  appState.onlineMatch = online ? config.online || null : null;
  appState.lastBattleConfig = replay || online ? null : { mode: state.mode, seed: state.seed, size: state.size, players: structuredClone(config.players), spawns: structuredClone(state.spawns), maxTicks: state.maxTicks };
  $("#battleSetup").classList.add("is-hidden");
  $("#onlineSetup").classList.add("is-hidden");
  $(".battle-kind-switch").classList.add("is-hidden");
  $("#battleLive").classList.remove("is-hidden");
  showViewWithoutReset("battle");
  renderBoard($("#battleBoard"), state);
  renderBattleHud(state);
  $("#liveProgramReadout").textContent = online ? "オンライン対戦中。全参加者が同じSeedとコードから同じ盤面を再現しています。" : "対戦中はコードを変更できません。";
  appState.battleTimer = setInterval(() => {
    const previous = cloneBoard(state.board);
    stepGame(state);
    renderBoard($("#battleBoard"), state, previous);
    renderBattleHud(state);
    if (state.finished) finishBattle(state, { save: !replay && (!online || config.online?.saveOwnerId === appState.user?.userTrackingId), online });
  }, 68);
}

function renderBattleHud(state) {
  $("#battleTick").textContent = `${state.tick} tick`;
  const results = gameResults(state).sort((a, b) => a.rank - b.rank);
  $("#scoreHud").innerHTML = results.map((result) => `<span class="score-chip" style="color:var(--${result.color === "blue" ? "blue-player" : result.color === "red" ? "red-player" : result.color === "yellow" ? "yellow-player" : "green-player"})"><i class="score-dot"></i>${escapeHtml(result.name)} ${escapeHtml(result.metric || String(result.score ?? ""))}${Number.isFinite(result.ink) ? ` ・ Ink ${result.ink}` : ""}</span>`).join("");
}

function stopBattle(hide = true) {
  if (appState.battleTimer) clearInterval(appState.battleTimer);
  appState.battleTimer = null;
  if (hide) $("#battleLive")?.classList.add("is-hidden");
}

async function finishBattle(state, { save = true, online = false } = {}) {
  stopBattle(false);
  const results = gameResults(state);
  renderResult(results, state.finishReason);
  showViewWithoutReset("result");
  $(".battle-kind-switch").classList.remove("is-hidden");
  if (online && appState.onlineMatch?.saveOwnerId === appState.user?.userTrackingId && appState.socket?.connected) {
    emitSocket("now:finish-room", { roomId: appState.onlineMatch.roomId }).catch(() => {});
  }
  if (!save || !appState.user) return;
  const participants = state.agents.map((agent) => ({ userTrackingId: agent.userTrackingId, username: agent.name, color: agent.color }));
  const programs = state.agents.map((agent) => ({ id: agent.id, userTrackingId: agent.userTrackingId, name: agent.name, color: agent.color, program: agent.program }));
  try {
    const data = await api("/api/now-coding/matches", {
      method: "POST",
      body: JSON.stringify({ userTrackingId: appState.user.userTrackingId, mode: state.mode, seed: state.seed, settings: { size: state.size, playerCount: state.agents.length, maxTicks: state.maxTicks, online }, participants, results, programs, spawn: state.spawns, durationTicks: state.tick, finishReason: state.finishReason, ruleVersion: MODE_RULE_VERSION[state.mode] || NOW_CODING_RULE_VERSION }),
    });
    appState.matches.unshift({ matchId: data.matchId, replayId: data.replayId, seed: state.seed, mode: state.mode, settings: { size: state.size }, participants, results, createdAt: data.createdAt });
    renderHome();
  } catch (error) {
    console.error(error);
    toast("対戦結果の保存に失敗しました");
  }
}

function renderResult(results, finishReason) {
  const mine = results.find((result) => result.userTrackingId === appState.user?.userTrackingId) || results[0];
  $("#resultRank").textContent = mine ? String(mine.rank).padStart(2, "0") : "--";
  $("#resultTitle").textContent = mine?.rank === 1 ? "勝利" : mine ? `${mine.rank}位` : "対戦終了";
  $("#resultRows").innerHTML = results.map((result) => `<div class="result-row"><span class="place">${String(result.rank).padStart(2, "0")}</span><strong>${escapeHtml(result.name)}</strong><span>${escapeHtml(result.metric || String(result.score ?? ""))}${result.alive ? "" : "・停止"}</span></div>`).join("");
  $("#resultTitle").dataset.reason = finishReason || "";
  $("#rematchButton").textContent = appState.onlineMatch ? "オンライン対戦へ戻る" : "同じ条件で再戦";
}

async function replayMatch(replayId) {
  if (!replayId || !appState.user || isTutorialLocked()) return;
  try {
    toast("リプレイを読み込みます");
    const id = encodeURIComponent(appState.user.userTrackingId);
    const data = await api(`/api/now-coding/replays/${encodeURIComponent(replayId)}?userTrackingId=${id}`);
    const replay = data.replay;
    const players = (replay.programs || []).map((entry, index) => ({ id: entry.id || `p${index}`, userTrackingId: entry.userTrackingId || "", name: entry.name || `駒${index + 1}`, color: entry.color || PLAYER_COLORS[index], program: entry.program || makeDefaultProgram(index) }));
    showView("battle");
    startBattle({ mode: replay.mode || "territory", seed: replay.seed, size: Number(replay.settings?.size || 21), players, spawns: replay.spawn, maxTicks: Number(replay.settings?.maxTicks || 600) }, { replay: true });
  } catch (error) {
    console.error(error);
    toast("リプレイを読み込めませんでした");
  }
}

function disconnectOnline() {
  appState.socket?.disconnect();
  appState.socket = null;
  appState.onlineRoom = null;
}

function connectOnline() {
  if (!appState.user?.userTrackingId || typeof window.io !== "function") return;
  if (appState.socket?.connected) return;
  appState.socket?.disconnect();
  const socket = io({ auth: { userTrackingId: appState.user.userTrackingId, username: appState.user.username } });
  appState.socket = socket;
  socket.on("connect", () => { if (appState.battleKind === "online") refreshPublicRooms(); });
  socket.on("now:rooms-changed", () => { if (appState.battleKind === "online" && !appState.onlineRoom) refreshPublicRooms(); });
  socket.on("now:room-state", (room) => { appState.onlineRoom = room; renderOnlineArea(); });
  socket.on("now:room-closed", () => { appState.onlineRoom = null; renderOnlineArea(); toast("ルームが終了しました"); });
  socket.on("now:match-start", (config) => {
    appState.onlineRoom = null;
    startBattle(config, { online: true });
  });
}

function emitSocket(event, payload = {}) {
  return new Promise((resolve, reject) => {
    const socket = appState.socket;
    if (!socket?.connected) return reject(new Error("socket_disconnected"));
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; reject(new Error("socket_timeout")); } }, 7000);
    socket.emit(event, payload, (response = {}) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (response.ok === false) reject(new Error(response.error || "socket_error"));
      else resolve(response);
    });
  });
}

async function refreshPublicRooms() {
  if (!appState.socket?.connected) return;
  try {
    const data = await emitSocket("now:list-rooms", {});
    appState.publicRooms = data.rooms || [];
    renderPublicRooms();
  } catch {
    $("#publicRoomList").className = "public-room-list empty-state";
    $("#publicRoomList").textContent = "ルーム一覧を取得できませんでした。";
  }
}

function renderPublicRooms() {
  const list = $("#publicRoomList");
  list.innerHTML = "";
  if (!appState.publicRooms.length) {
    list.className = "public-room-list empty-state";
    list.textContent = "現在、募集中の公開ルームはありません。";
    return;
  }
  list.className = "public-room-list";
  for (const room of appState.publicRooms) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "public-room-card";
    card.innerHTML = `<span class="room-live-dot"></span><div><strong>${escapeHtml(room.hostName || "ルーム")}</strong><small>${escapeHtml(room.modeLabel || MODE_LABELS[room.mode] || "陣取り")} ・ ${room.size}×${room.size} ・ ${room.currentPlayers}/${room.playerCount}人${room.fillWithNpc ? ` ・ 空席NPC ${NPC_LABELS[room.npcDifficulty]}` : ""}</small></div><b>${escapeHtml(room.roomId)}</b>`;
    card.addEventListener("click", () => joinOnlineRoom(room.roomId));
    list.appendChild(card);
  }
}

function renderOnlinePrograms() {
  const select = $("#onlineProgramSelect");
  if (!select) return;
  const current = select.value;
  select.innerHTML = "";
  for (const program of appState.programs) select.add(new Option(program.name, program.programId));
  const self = appState.onlineRoom?.members?.find((member) => member.isSelf);
  const byName = appState.programs.find((program) => program.name === self?.programName);
  select.value = byName?.programId || current || appState.selectedProgramId || appState.programs[0]?.programId || "";
}

function renderOnlineArea() {
  if (!$("#onlineSetup")) return;
  const room = appState.onlineRoom;
  $("#onlineLanding").classList.toggle("is-hidden", Boolean(room));
  $("#createRoomPanel").classList.add("is-hidden");
  $("#joinRoomPanel").classList.add("is-hidden");
  $("#onlineLobbyPanel").classList.toggle("is-hidden", !room);
  if (!room) return;
  $("#lobbyRoomId").textContent = room.roomId;
  $("#lobbyPrivacy").textContent = room.privateRoom ? "プライベート" : "公開";
  $("#lobbyPrivacy").classList.toggle("is-private", room.privateRoom);
  $("#lobbyRuleSummary").innerHTML = `<span>${escapeHtml(MODE_LABELS[room.settings.mode] || "陣取り")}</span><span>${room.settings.size} × ${room.settings.size}</span><span>定員 ${room.settings.playerCount}人</span><span>${room.settings.fillWithNpc ? `空席NPC：${NPC_LABELS[room.settings.npcDifficulty]}` : "NPC補充なし"}</span>`;
  const members = $("#lobbyMembers");
  members.innerHTML = "";
  for (let i = 0; i < room.settings.playerCount; i += 1) {
    const member = room.members[i];
    const slot = document.createElement("div");
    slot.className = `lobby-member-slot${member ? " is-filled" : " is-empty"}${member?.ready ? " is-ready" : ""}`;
    slot.innerHTML = member ? `<span class="member-index">${String(i + 1).padStart(2, "0")}</span><div><strong>${escapeHtml(member.username)}${member.role === "host" ? " ・ 主" : ""}</strong><small>${member.programName ? escapeHtml(member.programName) : "駒を選択中"}${member.connected ? "" : " ・ 切断"}</small></div><b>${member.ready ? "準備OK" : "待機中"}</b>` : `<span class="member-index">${String(i + 1).padStart(2, "0")}</span><div><strong>空席</strong><small>${room.settings.fillWithNpc ? "開始時にNPCが入ります" : "参加者を待っています"}</small></div>`;
    members.appendChild(slot);
  }
  renderOnlinePrograms();
  const self = room.members.find((member) => member.isSelf);
  $("#onlineReadyButton").textContent = self?.ready ? "準備を解除" : "準備OK";
  $("#onlineReadyButton").classList.toggle("is-ready", Boolean(self?.ready));
  $("#hostStartButton").classList.toggle("is-hidden", !room.hostIsSelf);
  const connected = room.members.filter((member) => member.connected);
  const allReady = connected.length > 0 && connected.every((member) => member.ready && member.hasProgram);
  $("#hostStartButton").disabled = !allReady || (connected.length < 2 && !room.settings.fillWithNpc);
  $("#lobbyStatus").textContent = room.hostIsSelf ? "全員が駒を選んで準備OKになると開始できます。" : "駒を選び、準備OKにしてルーム主の開始を待ちます。";
}

function openOnlinePanel(kind) {
  $("#onlineLanding").classList.add("is-hidden");
  $("#createRoomPanel").classList.toggle("is-hidden", kind !== "create");
  $("#joinRoomPanel").classList.toggle("is-hidden", kind !== "join");
  $("#onlineLobbyPanel").classList.add("is-hidden");
  if (kind === "join") refreshPublicRooms();
}

async function createOnlineRoom() {
  if (!appState.programs.length) { toast("先に駒を1つ保存してください"); return; }
  try {
    const response = await emitSocket("now:create-room", {
      privateRoom: $("#privateRoom").checked,
      settings: {
        mode: $("#onlineMode").value || "territory",
        playerCount: Number($("#onlinePlayerCount").value),
        size: Number($("#onlineBoardSize").value),
        seed: $("#onlineSeed").value.trim(),
        fillWithNpc: $("#fillWithNpc").checked,
        npcDifficulty: $("#onlineNpcDifficulty").value,
      },
    });
    appState.onlineRoom = response.room;
    renderOnlineArea();
  } catch (error) {
    toast(roomErrorMessage(error.message));
  }
}

async function joinOnlineRoom(roomId) {
  const id = String(roomId || "").trim();
  if (!id) { toast("ルームIDを入力してください"); return; }
  try {
    const response = await emitSocket("now:join-room", { roomId: id });
    appState.onlineRoom = response.room;
    renderOnlineArea();
  } catch (error) {
    toast(roomErrorMessage(error.message));
  }
}

async function selectOnlineProgram() {
  const room = appState.onlineRoom;
  if (!room) return;
  const program = appState.programs.find((entry) => entry.programId === $("#onlineProgramSelect").value);
  if (!program) { toast("駒を選んでください"); return; }
  try {
    await emitSocket("now:set-program", { roomId: room.roomId, program: { programId: program.programId, name: program.name, blocks: program.blocks } });
  } catch (error) { toast(roomErrorMessage(error.message)); }
}

async function toggleOnlineReady() {
  const room = appState.onlineRoom;
  if (!room) return;
  const self = room.members.find((member) => member.isSelf);
  if (!self?.hasProgram) {
    await selectOnlineProgram();
    return setTimeout(toggleOnlineReady, 180);
  }
  try { await emitSocket("now:set-ready", { roomId: room.roomId, ready: !self.ready }); }
  catch (error) { toast(roomErrorMessage(error.message)); }
}

async function startOnlineRoom() {
  if (!appState.onlineRoom) return;
  try { await emitSocket("now:start-room", { roomId: appState.onlineRoom.roomId }); }
  catch (error) { toast(roomErrorMessage(error.message)); }
}

async function leaveOnlineRoom() {
  if (!appState.onlineRoom) return;
  try { await emitSocket("now:leave-room", { roomId: appState.onlineRoom.roomId }); }
  catch { /* room may already be gone */ }
  appState.onlineRoom = null;
  renderOnlineArea();
}

function roomErrorMessage(code) {
  return ({ room_not_found: "ルームが見つかりません", room_not_open: "このルームは募集を終了しています", room_full: "ルームは満員です", members_not_ready: "まだ準備が完了していない参加者がいます", need_two_players: "NPC補充なしの場合は2人以上必要です", program_required: "先に駒を選んでください", socket_disconnected: "オンライン接続が切れています" })[code] || "オンライン処理に失敗しました";
}

function setMenu(open) {
  if (isTutorialLocked()) return;
  $("#sideMenu").classList.toggle("is-open", open);
  $("#sideMenu").setAttribute("aria-hidden", open ? "false" : "true");
  $("#menuButton").setAttribute("aria-expanded", open ? "true" : "false");
  $("#menuBackdrop").hidden = !open;
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    if (go) {
      if (go.disabled) return;
      const view = go.dataset.go;
      if (["home", "editor", "battle"].includes(view)) showView(view);
    }
  });
  $("#menuButton").addEventListener("click", () => setMenu(!$("#sideMenu").classList.contains("is-open")));
  $("#menuBackdrop").addEventListener("click", () => setMenu(false));
  $("#loginButton").addEventListener("click", loginWithCredentials);
  $("#loginPassword").addEventListener("keydown", (event) => { if (event.key === "Enter") loginWithCredentials(); });
  $("#saveGoogleUsername").addEventListener("click", saveGoogleUsername);
  $("#logoutButton").addEventListener("click", () => { setMenu(false); storeUser(null); setModal("#authModal", true); });
  $("#newProgramButton").addEventListener("click", newDraft);
  $("#saveProgramButton").addEventListener("click", openSaveProgramModal);
  $("#confirmSaveProgram").addEventListener("click", saveDraft);
  $("#cancelSaveProgram").addEventListener("click", () => setModal("#saveProgramModal", false));
  $("#saveProgramName").addEventListener("keydown", (event) => { if (event.key === "Enter") saveDraft(); });
  $$('[data-add-block]').forEach((button) => button.addEventListener("click", () => {
    if (Date.now() < appState.suppressPaletteClickUntil || button.disabled) return;
    addBlockAt(button.dataset.addBlock);
  }));
  $$('[data-start-tutorial]').forEach((button) => button.addEventListener("click", startTutorial));
  $("#tutorialNextButton").addEventListener("click", () => { if (Number(appState.profile?.tutorialStep || 0) === 0) setTutorialProgress(1); });
  $("#runTestButton").addEventListener("click", runTest);
  $("#stopTestButton").addEventListener("click", () => { stopTest(); $("#testStatus").textContent = "停止しました。"; });
  $$('[data-battle-next]').forEach((button) => button.addEventListener("click", () => { const step = Number(button.dataset.battleNext); if (step === 3 && !appState.selectedProgramId) { toast("駒を選んでください"); return; } goBattleStep(step); }));
  $$('[data-battle-back]').forEach((button) => button.addEventListener("click", () => goBattleStep(Number(button.dataset.battleBack))));
  $("#startBattleButton").addEventListener("click", startNpcBattle);
  $("#abortBattleButton").addEventListener("click", () => { stopBattle(true); $(".battle-kind-switch").classList.remove("is-hidden"); showView("battle"); });
  $("#rematchButton").addEventListener("click", () => {
    if (appState.onlineMatch) { appState.onlineMatch = null; appState.battleKind = "online"; showView("battle"); return; }
    if (!appState.lastBattleConfig) { showView("battle"); return; }
    const config = structuredClone(appState.lastBattleConfig);
    config.seed = freshSeed();
    startBattle(config);
  });
  $("#editAfterResultButton").addEventListener("click", () => { const program = appState.programs.find((entry) => entry.programId === appState.selectedProgramId); if (program) openProgram(program.programId); else showView("editor"); });
  $$('[data-battle-kind]').forEach((button) => button.addEventListener("click", () => setBattleKind(button.dataset.battleKind)));
  $("[data-mode]").forEach((button) => button.addEventListener("click", () => selectBattleMode(button.dataset.mode)));
  $("#openCreateRoomButton").addEventListener("click", () => openOnlinePanel("create"));
  $("#openJoinRoomButton").addEventListener("click", () => openOnlinePanel("join"));
  $$('[data-online-back]').forEach((button) => button.addEventListener("click", () => renderOnlineArea()));
  $("#createRoomButton").addEventListener("click", createOnlineRoom);
  $("#joinByIdButton").addEventListener("click", () => joinOnlineRoom($("#roomIdInput").value));
  $("#refreshRoomsButton").addEventListener("click", refreshPublicRooms);
  $("#onlineProgramSelect").addEventListener("change", selectOnlineProgram);
  $("#onlineReadyButton").addEventListener("click", toggleOnlineReady);
  $("#hostStartButton").addEventListener("click", startOnlineRoom);
  $("#leaveRoomButton").addEventListener("click", leaveOnlineRoom);
  $("#fillWithNpc").addEventListener("change", () => $("#onlineNpcLevelRow").classList.toggle("is-hidden", !$("#fillWithNpc").checked));
  $$('[data-menu-action]').forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.menuAction;
    setMenu(false);
    if (action === "history") { showView("home"); toast("最近の対戦からリプレイを開けます"); }
    if (action === "tutorials") openTutorialLibrary();
    if (action === "rules") toast("陣取り：敵の色は壁。崖へ進むとゲームオーバー。進む・旋回はいずれも1tickです。");
    if (action === "help") toast("命令はタップでもドラッグでも配置できます。上下ボタンやドラッグで順序を変更できます。");
    if (action === "settings") toast("設定項目は今後追加します");
  }));
  $("#closeTutorialLibrary").addEventListener("click", () => setModal("#tutorialLibraryModal", false));
  $("#optionalTutorialPrev").addEventListener("click", () => moveOptionalTutorial(-1));
  $("#optionalTutorialNext").addEventListener("click", () => moveOptionalTutorial(1));
  $("#optionalTutorialClose").addEventListener("click", closeOptionalTutorial);
  bindDragAndDrop();
}

async function init() {
  bindEvents();
  newDraft();
  storeUser(safeStoredUser());
  if (appState.user) {
    setModal("#authModal", false);
    await bootstrapUserData();
  } else {
    setModal("#authModal", true);
  }
  window.addEventListener("load", initGoogleButton, { once: true });
  if (document.readyState === "complete") initGoogleButton();
}

init();
