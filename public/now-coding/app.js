import {
  NOW_CODING_RULE_VERSION,
  PLAYER_COLORS,
  createTerritoryState,
  makeDefaultProgram,
  stepTerritory,
  territoryResults,
} from "./engine.js";

const GOOGLE_CLIENT_ID = "958867607494-2htl5kj0atpuriq65ssnq7hje66t1p6t.apps.googleusercontent.com";
const ACTION_LABELS = { move: "進む", turnLeft: "左に90°旋回", turnRight: "右に90°旋回" };
const SENSOR_LABELS = { front: "前", left: "左", right: "右" };
const CELL_LABELS = { unclaimed: "未取得", own: "自分の色", enemy: "敵の色／壁", cliff: "崖", player: "駒" };

const appState = {
  user: null,
  profile: null,
  programs: [],
  matches: [],
  draft: { programId: "", name: "新しい駒", blocks: [] },
  selectedProgramId: "",
  currentView: "home",
  battleStep: 1,
  testTimer: null,
  battleTimer: null,
  battleState: null,
  battlePreviousBoard: null,
  testPreviousBoard: null,
  lastBattleConfig: null,
  replayMode: false,
  pendingGoogle: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

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

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  $("#toastRegion").appendChild(node);
  setTimeout(() => node.remove(), 3100);
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return String(value);
  }
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
    return;
  }
  localStorage.setItem("currentUser", JSON.stringify(user));
  localStorage.setItem("username", user.username || "");
  localStorage.setItem("userTrackingId", user.userTrackingId || "");
  $("#userLabel").textContent = user.username || "接続済み";
}

function setModal(id, open) {
  const modal = $(id);
  if (!modal) return;
  modal.setAttribute("aria-hidden", open ? "false" : "true");
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
    const response = await fetch("/api/user/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
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
    const response = await fetch("/api/user/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: payload.email }),
    });
    const lookup = await response.json();
    if (lookup.exists && lookup.username) {
      storeUser({
        email: payload.email,
        username: lookup.username,
        googleName: lookup.displayName || payload.name || "",
        userTrackingId: lookup.userTrackingId || "",
      });
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
    const response = await fetch("/api/user/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pending.email, username, googleDisplayName: pending.gName }),
    });
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
  if (!window.google?.accounts?.id) return;
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential, ux_mode: "popup" });
  google.accounts.id.renderButton($("#googleSignInBtn"), { theme: "filled_black", size: "large", shape: "pill", text: "continue_with", width: 320 });
}

async function bootstrapUserData() {
  if (!appState.user?.userTrackingId) return;
  $("#userLabel").textContent = appState.user.username;
  const id = encodeURIComponent(appState.user.userTrackingId);
  try {
    const [profileData, programData, matchData] = await Promise.all([
      api(`/api/now-coding/profile?userTrackingId=${id}`),
      api(`/api/now-coding/programs?userTrackingId=${id}`),
      api(`/api/now-coding/matches?userTrackingId=${id}&limit=12`),
    ]);
    appState.profile = profileData.profile;
    appState.programs = programData.programs || [];
    appState.matches = matchData.matches || [];
    if (!appState.selectedProgramId && appState.programs[0]) appState.selectedProgramId = appState.programs[0].programId;
    renderHome();
    renderBattleProgramList();
    updateTutorialEntry();
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
      row.innerHTML = `<div><strong>${escapeHtml(program.name)}</strong><br><small>${program.blocks.length}ブロック ・ ${escapeHtml(formatDate(program.updatedAt))}</small></div><button class="text-button" type="button">編集</button>`;
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
      row.innerHTML = `<div><strong>${mine ? `${mine.rank}位 / ${mine.claimed}マス` : "陣取り"}</strong><br><small>${escapeHtml(formatDate(match.createdAt))} ・ Seed ${escapeHtml(match.seed)}</small></div><button class="text-button" type="button">再生</button>`;
      row.querySelector("button").addEventListener("click", () => replayMatch(match.replayId));
      matches.appendChild(row);
    });
  }
}

function updateTutorialEntry() {
  const show = !appState.profile?.tutorialDone || appState.programs.length === 0;
  $("#firstProgramCard").classList.toggle("is-hidden", !show);
}

function showView(name) {
  stopTest();
  if (name !== "battle") stopBattle(false);
  appState.currentView = name;
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
  $$(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.go === name));
  const index = { home: 0, editor: 1, battle: 2 }[name];
  const nav = $(".primary-nav");
  if (Number.isInteger(index)) {
    nav.style.setProperty("--nav-index", `${index * 100}%`);
    nav.style.setProperty("--nav-y", `${index * 100}%`);
  }
  if (name === "editor") renderWorkspace();
  if (name === "battle") {
    $("#battleSetup").classList.remove("is-hidden");
    $("#battleLive").classList.add("is-hidden");
    goBattleStep(1);
    renderBattleProgramList();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function newDraft() {
  appState.draft = { programId: "", name: "新しい駒", blocks: [] };
  $("#programName").value = appState.draft.name;
  renderWorkspace();
}

function openProgram(programId) {
  const program = appState.programs.find((entry) => entry.programId === programId);
  if (!program) return;
  appState.draft = { programId: program.programId, name: program.name, blocks: structuredClone(program.blocks || []) };
  appState.selectedProgramId = program.programId;
  $("#programName").value = program.name;
  showView("editor");
}

function actionNode(action) {
  return { type: "action", action };
}

function createBlock(type) {
  if (["move", "turnLeft", "turnRight"].includes(type)) return actionNode(type);
  if (type === "ifCell") {
    return {
      type: "if",
      condition: { type: "cell", direction: "front", value: "unclaimed" },
      then: [actionNode("move")],
      else: [actionNode("turnRight")],
    };
  }
  if (type === "ifRandom") {
    return {
      type: "if",
      condition: { type: "random", chance: 0.5 },
      then: [actionNode("turnLeft")],
      else: [actionNode("turnRight")],
    };
  }
  if (type === "setVar") return { type: "set", name: "count", value: { type: "literal", value: 0 } };
  if (type === "changeVar") return { type: "change", name: "count", value: { type: "literal", value: 1 } };
  return actionNode("move");
}

function actionSelect(value, onChange) {
  const select = document.createElement("select");
  Object.entries(ACTION_LABELS).forEach(([key, label]) => select.add(new Option(label, key, false, key === value)));
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function renderWorkspace() {
  const workspace = $("#programWorkspace");
  workspace.innerHTML = "";
  $("#programName").value = appState.draft.name || "新しい駒";
  appState.draft.blocks.forEach((block, index) => workspace.appendChild(renderBlock(block, index)));
  $("#blockCount").textContent = `${appState.draft.blocks.length} ブロック`;
}

function renderBlock(block, index) {
  const node = document.createElement("div");
  node.className = `code-block ${block.type === "if" ? "logic" : ["set", "change"].includes(block.type) ? "value" : ""}`;
  const content = document.createElement("label");

  if (block.type === "action") {
    content.textContent = ACTION_LABELS[block.action] || "進む";
  } else if (block.type === "if" && block.condition?.type === "cell") {
    content.append("もし ");
    const direction = document.createElement("select");
    Object.entries(SENSOR_LABELS).forEach(([key, label]) => direction.add(new Option(label, key, false, key === block.condition.direction)));
    direction.addEventListener("change", () => { block.condition.direction = direction.value; });
    content.append(direction, " が ");
    const value = document.createElement("select");
    Object.entries(CELL_LABELS).forEach(([key, label]) => value.add(new Option(label, key, false, key === block.condition.value)));
    value.addEventListener("change", () => { block.condition.value = value.value; });
    content.append(value, " なら ", actionSelect(block.then?.[0]?.action || "move", (v) => { block.then = [actionNode(v)]; }), " ／ そうでなければ ", actionSelect(block.else?.[0]?.action || "turnRight", (v) => { block.else = [actionNode(v)]; }));
  } else if (block.type === "if" && block.condition?.type === "random") {
    content.append("もし Seed乱数が ");
    const chance = document.createElement("input");
    chance.type = "number";
    chance.min = "0";
    chance.max = "100";
    chance.value = String(Math.round((Number(block.condition.chance) || .5) * 100));
    chance.style.width = "72px";
    chance.addEventListener("change", () => { block.condition.chance = Math.max(0, Math.min(100, Number(chance.value) || 0)) / 100; });
    content.append(chance, "% なら ", actionSelect(block.then?.[0]?.action || "turnLeft", (v) => { block.then = [actionNode(v)]; }), " ／ そうでなければ ", actionSelect(block.else?.[0]?.action || "turnRight", (v) => { block.else = [actionNode(v)]; }));
  } else if (block.type === "set" || block.type === "change") {
    content.append(block.type === "set" ? "変数 " : "変数 ");
    const name = document.createElement("input");
    name.value = block.name || "count";
    name.maxLength = 40;
    name.style.width = "96px";
    name.addEventListener("input", () => { block.name = name.value; });
    const value = document.createElement("input");
    value.type = "number";
    value.value = String(block.value?.value ?? (block.type === "set" ? 0 : 1));
    value.style.width = "74px";
    value.addEventListener("input", () => { block.value = { type: "literal", value: Number(value.value) || 0 }; });
    content.append(name, block.type === "set" ? " = " : " を ", value, block.type === "set" ? " にする" : " 増やす");
  }

  const tools = document.createElement("div");
  tools.className = "block-tools";
  const up = document.createElement("button"); up.type = "button"; up.textContent = "↑"; up.title = "上へ";
  const down = document.createElement("button"); down.type = "button"; down.textContent = "↓"; down.title = "下へ";
  const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.title = "削除";
  up.addEventListener("click", () => moveBlock(index, -1));
  down.addEventListener("click", () => moveBlock(index, 1));
  remove.addEventListener("click", () => { appState.draft.blocks.splice(index, 1); renderWorkspace(); });
  tools.append(up, down, remove);
  node.append(content, tools);
  return node;
}

function moveBlock(index, delta) {
  const next = index + delta;
  if (next < 0 || next >= appState.draft.blocks.length) return;
  [appState.draft.blocks[index], appState.draft.blocks[next]] = [appState.draft.blocks[next], appState.draft.blocks[index]];
  renderWorkspace();
}

async function saveDraft() {
  if (!appState.user) return;
  appState.draft.name = $("#programName").value.trim() || "無題の駒";
  try {
    const data = await api("/api/now-coding/programs", {
      method: "POST",
      body: JSON.stringify({
        userTrackingId: appState.user.userTrackingId,
        programId: appState.draft.programId,
        name: appState.draft.name,
        blocks: appState.draft.blocks,
      }),
    });
    appState.draft.programId = data.program.programId;
    const index = appState.programs.findIndex((program) => program.programId === data.program.programId);
    if (index >= 0) appState.programs[index] = data.program;
    else appState.programs.unshift(data.program);
    appState.selectedProgramId = data.program.programId;
    renderHome();
    renderBattleProgramList();
    toast("駒を保存しました");
    if (appState.profile && !appState.profile.tutorialDone && appState.profile.tutorialStep >= 2) await setTutorialProgress(3, true);
  } catch (error) {
    toast(error.message === "program_too_large" ? "コードが大きすぎます" : "保存に失敗しました");
  }
}

async function setTutorialProgress(step, done = false) {
  if (!appState.user) return;
  const tutorialStep = Math.max(Number(appState.profile?.tutorialStep || 0), step);
  try {
    const data = await api("/api/now-coding/profile", {
      method: "PUT",
      body: JSON.stringify({ userTrackingId: appState.user.userTrackingId, tutorialStep, tutorialDone: done || Boolean(appState.profile?.tutorialDone), prefs: appState.profile?.prefs || {} }),
    });
    appState.profile = data.profile;
    renderTutorialCoach();
    updateTutorialEntry();
  } catch (error) {
    console.warn("tutorial progress save failed", error);
  }
}

function startTutorial() {
  newDraft();
  showView("editor");
  if (!appState.profile) appState.profile = { tutorialStep: 0, tutorialDone: false, prefs: {} };
  appState.profile.tutorialDone = false;
  renderTutorialCoach();
}

function renderTutorialCoach() {
  const coach = $("#tutorialCoach");
  if (!appState.profile || appState.profile.tutorialDone) {
    coach.classList.add("is-hidden");
    return;
  }
  const step = Number(appState.profile.tutorialStep || 0);
  const messages = [
    "まずは「進む」を追加してみましょう。命令をタップすると本物のコードに追加されます。",
    "次に旋回を1つ追加してください。後退コマンドはありません。向きを変えること自体が1tickの行動です。",
    "できたコードをテスト実行して、灰色の盤面で駒がどう動くか確認しましょう。確認できたら保存で完了です。",
  ];
  $("#tutorialStepLabel").textContent = `${Math.min(step + 1, 3)} / 3`;
  $("#tutorialText").textContent = messages[Math.min(step, 2)];
  coach.classList.remove("is-hidden");
}

function maybeAdvanceTutorialOnAdd(type) {
  if (!appState.profile || appState.profile.tutorialDone) return;
  const step = Number(appState.profile.tutorialStep || 0);
  if (step === 0 && type === "move") setTutorialProgress(1);
  else if (step === 1 && ["turnLeft", "turnRight"].includes(type)) setTutorialProgress(2);
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

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
  for (let y = 0; y < state.size; y += 1) {
    for (let x = 0; x < state.size; x += 1) {
      const index = y * state.size + x;
      const cell = cells[index];
      const owner = state.board[y][x];
      const color = owner >= 0 ? state.agents[owner]?.color : "";
      cell.className = `board-cell${color ? ` claim-${color}` : ""}`;
      if (previousBoard && previousBoard[y]?.[x] !== owner && owner >= 0) cell.classList.add("just-claimed");
      cell.innerHTML = "";
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
      { id: "test-cpu", name: "テスト駒", color: "red", program: makeDefaultProgram(1) },
    ],
  });
  appState.testPreviousBoard = null;
  renderBoard($("#testBoard"), state);
  $("#testStatus").textContent = "実行中。旋回も前進も1回につき1tickです。";
  if (appState.profile && !appState.profile.tutorialDone && appState.profile.tutorialStep >= 2) setTutorialProgress(2);
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
  appState.programs.forEach((program) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `program-choice${program.programId === appState.selectedProgramId ? " is-selected" : ""}`;
    button.innerHTML = `<span><strong>${escapeHtml(program.name)}</strong><br><small>${program.blocks.length}ブロック</small></span><small>${escapeHtml(formatDate(program.updatedAt))}</small>`;
    button.addEventListener("click", () => { appState.selectedProgramId = program.programId; renderBattleProgramList(); });
    list.appendChild(button);
  });
}

function renderBattleSummary() {
  const program = appState.programs.find((entry) => entry.programId === appState.selectedProgramId);
  const seed = $("#seedInput").value.trim() || "自動生成";
  $("#battleSummary").innerHTML = [
    ["モード", "陣取り"],
    ["人数", `${$("#playerCount").value}人`],
    ["盤面", `${$("#boardSize").value} × ${$("#boardSize").value}`],
    ["使用する駒", program?.name || "未選択"],
    ["Seed", seed],
  ].map(([label, value]) => `<div class="summary-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}

function makeBattlePlayers(program, count) {
  const players = [{
    id: appState.user.userTrackingId,
    userTrackingId: appState.user.userTrackingId,
    name: appState.user.username,
    color: PLAYER_COLORS[0],
    program: structuredClone(program.blocks),
  }];
  for (let i = 1; i < count; i += 1) {
    players.push({ id: `cpu-${i}`, userTrackingId: "", name: `CPU ${i}`, color: PLAYER_COLORS[i], program: makeDefaultProgram(i) });
  }
  return players;
}

function freshSeed() {
  if (crypto?.getRandomValues) {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${values[0].toString(36)}-${values[1].toString(36)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function startBattle(configOverride = null, { replay = false } = {}) {
  stopBattle(false);
  const program = appState.programs.find((entry) => entry.programId === appState.selectedProgramId);
  if (!configOverride && !program) {
    toast("対戦に使う駒を選んでください");
    goBattleStep(2);
    return;
  }
  const seed = configOverride?.seed || $("#seedInput").value.trim() || freshSeed();
  const playerCount = configOverride?.players?.length || Number($("#playerCount").value || 2);
  const size = Number(configOverride?.size || $("#boardSize").value || 21);
  const players = configOverride?.players || makeBattlePlayers(program, playerCount);
  const spawns = configOverride?.spawns || null;
  const state = createTerritoryState({ seed, size, players, spawns, maxTicks: configOverride?.maxTicks || Math.max(420, size * size * 2), stagnationTicks: 140 });
  appState.battleState = state;
  appState.replayMode = replay;
  appState.lastBattleConfig = replay ? null : { seed, size, players: structuredClone(players), spawns: structuredClone(state.spawns), maxTicks: state.maxTicks };
  $("#battleSetup").classList.add("is-hidden");
  $("#battleLive").classList.remove("is-hidden");
  showViewWithoutReset("battle");
  renderBoard($("#battleBoard"), state);
  renderBattleHud(state);

  appState.battleTimer = setInterval(() => {
    const previous = cloneBoard(state.board);
    stepTerritory(state);
    renderBoard($("#battleBoard"), state, previous);
    renderBattleHud(state);
    if (state.finished) finishBattle(state, { save: !replay });
  }, 68);
}

function showViewWithoutReset(name) {
  appState.currentView = name;
  $$(".view").forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
  $$(".nav-item").forEach((button) => button.classList.toggle("is-active", button.dataset.go === name));
}

function renderBattleHud(state) {
  $("#battleTick").textContent = `${state.tick} tick`;
  const results = territoryResults(state).sort((a, b) => a.rank - b.rank);
  $("#scoreHud").innerHTML = results.map((result) => `<span class="score-chip" style="color:var(--${result.color === "blue" ? "blue-player" : result.color === "red" ? "red-player" : result.color === "yellow" ? "yellow-player" : "green-player"})"><i class="score-dot"></i>${escapeHtml(result.name)} ${result.claimed}</span>`).join("");
}

function stopBattle(hide = true) {
  if (appState.battleTimer) clearInterval(appState.battleTimer);
  appState.battleTimer = null;
  if (hide) $("#battleLive")?.classList.add("is-hidden");
}

async function finishBattle(state, { save = true } = {}) {
  stopBattle(false);
  const results = territoryResults(state);
  renderResult(results, state.finishReason);
  showViewWithoutReset("result");
  if (!save || !appState.user) return;
  const participants = state.agents.map((agent) => ({ userTrackingId: agent.userTrackingId, username: agent.name, color: agent.color }));
  const programs = state.agents.map((agent) => ({ id: agent.id, userTrackingId: agent.userTrackingId, name: agent.name, color: agent.color, program: agent.program }));
  try {
    const data = await api("/api/now-coding/matches", {
      method: "POST",
      body: JSON.stringify({
        userTrackingId: appState.user.userTrackingId,
        mode: "territory",
        seed: state.seed,
        settings: { size: state.size, playerCount: state.agents.length, maxTicks: state.maxTicks },
        participants,
        results,
        programs,
        spawn: state.spawns,
        durationTicks: state.tick,
        finishReason: state.finishReason,
        ruleVersion: NOW_CODING_RULE_VERSION,
      }),
    });
    appState.matches.unshift({
      matchId: data.matchId,
      replayId: data.replayId,
      seed: state.seed,
      mode: "territory",
      settings: { size: state.size },
      participants,
      results,
      createdAt: data.createdAt,
    });
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
  $("#resultRows").innerHTML = results.map((result) => `<div class="result-row"><span class="place">${String(result.rank).padStart(2,"0")}</span><strong>${escapeHtml(result.name)}</strong><span>${result.claimed}マス${result.alive ? "" : "・停止"}</span></div>`).join("");
  $("#resultTitle").dataset.reason = finishReason || "";
}

async function replayMatch(replayId) {
  if (!replayId || !appState.user) return;
  try {
    toast("リプレイを読み込みます");
    const id = encodeURIComponent(appState.user.userTrackingId);
    const data = await api(`/api/now-coding/replays/${encodeURIComponent(replayId)}?userTrackingId=${id}`);
    const replay = data.replay;
    const players = (replay.programs || []).map((entry, index) => ({
      id: entry.id || `p${index}`,
      userTrackingId: entry.userTrackingId || "",
      name: entry.name || `駒${index + 1}`,
      color: entry.color || PLAYER_COLORS[index],
      program: entry.program || makeDefaultProgram(index),
    }));
    startBattle({ seed: replay.seed, size: Number(replay.settings?.size || 21), players, spawns: replay.spawn, maxTicks: Number(replay.settings?.maxTicks || 600) }, { replay: true });
  } catch (error) {
    console.error(error);
    toast("リプレイを読み込めませんでした");
  }
}

function setMenu(open) {
  $("#sideMenu").classList.toggle("is-open", open);
  $("#sideMenu").setAttribute("aria-hidden", open ? "false" : "true");
  $("#menuButton").setAttribute("aria-expanded", open ? "true" : "false");
  $("#menuBackdrop").hidden = !open;
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    if (go) {
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
  $("#saveProgramButton").addEventListener("click", saveDraft);
  $("#programName").addEventListener("input", (event) => { appState.draft.name = event.target.value; });
  $$('[data-add-block]').forEach((button) => button.addEventListener("click", () => {
    const type = button.dataset.addBlock;
    appState.draft.blocks.push(createBlock(type));
    renderWorkspace();
    maybeAdvanceTutorialOnAdd(type);
  }));
  $$('[data-start-tutorial]').forEach((button) => button.addEventListener("click", startTutorial));
  $("#skipTutorialButton").addEventListener("click", () => setTutorialProgress(3, true));
  $("#runTestButton").addEventListener("click", runTest);
  $("#stopTestButton").addEventListener("click", () => { stopTest(); $("#testStatus").textContent = "停止しました。"; });
  $$('[data-battle-next]').forEach((button) => button.addEventListener("click", () => {
    const step = Number(button.dataset.battleNext);
    if (step === 3 && !appState.selectedProgramId) { toast("駒を選んでください"); return; }
    goBattleStep(step);
  }));
  $$('[data-battle-back]').forEach((button) => button.addEventListener("click", () => goBattleStep(Number(button.dataset.battleBack))));
  $("#startBattleButton").addEventListener("click", () => startBattle());
  $("#abortBattleButton").addEventListener("click", () => { stopBattle(true); $("#battleSetup").classList.remove("is-hidden"); goBattleStep(1); });
  $("#rematchButton").addEventListener("click", () => {
    if (!appState.lastBattleConfig) { showView("battle"); return; }
    const config = structuredClone(appState.lastBattleConfig);
    config.seed = freshSeed();
    startBattle(config);
  });
  $("#editAfterResultButton").addEventListener("click", () => {
    const program = appState.programs.find((entry) => entry.programId === appState.selectedProgramId);
    if (program) openProgram(program.programId); else showView("editor");
  });
  $$('[data-menu-action]').forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.menuAction;
    setMenu(false);
    if (action === "history") { showView("home"); toast("最近の対戦からリプレイを開けます"); }
    if (action === "rules") toast("現在実装済み：陣取り。敵色は壁、崖へ進むとゲームオーバーです。");
    if (action === "help") toast("駒を作る画面で、命令を追加してテスト実行できます。");
    if (action === "settings") toast("設定項目は今後追加します");
  }));
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
