import { TenCalculator } from "./calculator.js";
import { evaluateExpression, isTen } from "./expression-engine.js";

const screens = new Map([...document.querySelectorAll("[data-screen]")].map((screen) => [screen.dataset.screen, screen]));
const refs = {
  homeBrandButton: document.getElementById("homeBrandButton"),
  authPill: document.getElementById("authPill"),
  settingsForm: document.getElementById("soloSettingsForm"),
  settingsSummary: document.getElementById("settingsSummary"),
  startSoloButton: document.getElementById("startSoloButton"),
  calculatorMount: document.getElementById("calculatorMount"),
  gameModeLabel: document.getElementById("gameModeLabel"),
  gameProgressText: document.getElementById("gameProgressText"),
  gameLives: document.getElementById("gameLives"),
  gameTimer: document.getElementById("gameTimer"),
  onlineScoreboard: document.getElementById("onlineScoreboard"),
  tutorialHub: document.getElementById("tutorialHub"),
  tutorialCompletedCount: document.getElementById("tutorialCompletedCount"),
  tutorialRecommendedButton: document.getElementById("tutorialRecommendedButton"),
  tutorialLessonGroups: document.getElementById("tutorialLessonGroups"),
  tutorialLesson: document.getElementById("tutorialLesson"),
  tutorialLessonBack: document.getElementById("tutorialLessonBack"),
  tutorialLessonPosition: document.getElementById("tutorialLessonPosition"),
  tutorialMission: document.getElementById("tutorialMission"),
  tutorialMissionHelp: document.getElementById("tutorialMissionHelp"),
  tutorialLessonCategory: document.getElementById("tutorialLessonCategory"),
  tutorialLessonTitle: document.getElementById("tutorialLessonTitle"),
  tutorialLessonSummary: document.getElementById("tutorialLessonSummary"),
  tutorialDisclosureButton: document.getElementById("tutorialDisclosureButton"),
  tutorialExplanation: document.getElementById("tutorialExplanation"),
  tutorialSteps: document.getElementById("tutorialSteps"),
  tutorialExample: document.getElementById("tutorialExample"),
  tutorialKeyChips: document.getElementById("tutorialKeyChips"),
  tutorialExitButton: document.getElementById("tutorialExitButton"),
  tutorialCalculatorMount: document.getElementById("tutorialCalculatorMount"),
  modalLayer: document.getElementById("modalLayer"),
  modalContent: document.getElementById("modalContent"),
  toastRegion: document.getElementById("toastRegion"),
};

const TUTORIAL_STORAGE_KEY = "tenFreelyTutorialLessonsV2";
const TUTORIAL_ACTIONS = ["clear", "delete", "left", "right", "submit"];
const tutorialLessons = [
  {
    id: "addition", category: "はじめの一歩", order: 1, icon: "+", title: "足し算で10", time: "約1分", problem: "46",
    summary: "数字を一度ずつ使う、いちばん基本のルールを体験します。",
    mission: "4 ＋ 6 を入力して、最後に ＝ を押そう。",
    steps: ["4と6の数字ボタンは、それぞれ一度だけ使えます。", "4＋6の式を作ると、数字を使い切った時点で「=」が有効になります。", "「=」を押して10になれば完了です。"],
    example: "4 ＋ 6 ＝ 10", allowedValues: ["+"], emphasizedValues: ["+"], keys: ["4", "＋", "6", "＝"]
  },
  {
    id: "subtraction", category: "はじめの一歩", order: 2, icon: "−", title: "足して、引く", time: "約1分", problem: "831",
    summary: "足し算と引き算を組み合わせ、左から式を組み立てます。",
    mission: "8 ＋ 3 − 1 を作って10にしよう。",
    steps: ["8と3を足すと11です。", "最後に1を引けば10になります。", "数字の並び順は、出題された順番と同じでなくても構いません。"],
    example: "8 ＋ 3 − 1 ＝ 10", allowedValues: ["+", "-"], emphasizedValues: ["-"], keys: ["＋", "−", "8", "3", "1"]
  },
  {
    id: "multiplication", category: "はじめの一歩", order: 3, icon: "×", title: "掛け算で一気に10", time: "約1分", problem: "25",
    summary: "×の使い方と、数字を連結できないルールを確認します。",
    mission: "2と5の間に × を入れて10にしよう。",
    steps: ["2と5を隣に置いて25にすることはできません。", "間に「×」を置くと、2×5になります。", "掛け算の結果は10です。"],
    example: "2 × 5 ＝ 10", allowedValues: ["*"], emphasizedValues: ["*"], keys: ["2", "×", "5", "＝"]
  },
  {
    id: "division", category: "はじめの一歩", order: 4, icon: "÷", title: "割り算を混ぜる", time: "約1分", problem: "821",
    summary: "割り算を含む式でも、通常の計算順序で判定されます。",
    mission: "8 ＋ 2 ÷ 1 を入力し、計算順序を確かめよう。",
    steps: ["2÷1は2です。", "8に2を足すと10になります。", "0で割ると失敗になり、通常プレイでは残機が減ります。"],
    example: "8 ＋ 2 ÷ 1 ＝ 10", allowedValues: ["+", "/"], emphasizedValues: ["/"], keys: ["＋", "÷", "8", "2", "1"]
  },
  {
    id: "parentheses", category: "はじめの一歩", order: 5, icon: "( )", title: "括弧で順番を変える", time: "約2分", problem: "223",
    summary: "2×3＋2では8。括弧を使って、先に3＋2を計算します。",
    mission: "3 ＋ 2 を括弧で囲み、外側から2を掛けよう。",
    steps: ["括弧がない2×3＋2は、掛け算が先なので8です。", "(3＋2)を作ると、その部分を先に計算して5になります。", "外側の2を掛けると、2×5で10です。"],
    example: "2 × ( 3 ＋ 2 ) ＝ 10", allowedValues: ["*", "+", "(", ")"], emphasizedValues: ["(", ")"], keys: ["×", "＋", "( )", "2", "2", "3"]
  },
  {
    id: "square-root", category: "特殊な記号", order: 6, icon: "√", title: "平方根を使う", time: "約1分", problem: "48",
    summary: "√4＝2を利用して、8に足す数を作ります。",
    mission: "4の前に √ を置き、√4 ＋ 8 を作ろう。",
    steps: ["√は、その数を2乗すると元に戻る正の数を表します。", "√4は2です。", "ゲームでは√2のような途中結果も使えます。たとえば√2×√2は2になります。"],
    example: "√4 ＋ 8 ＝ 10", allowedValues: ["√", "+"], emphasizedValues: ["√"], keys: ["√", "＋", "4", "8"]
  },
  {
    id: "multifactorial", category: "特殊な記号", order: 7, icon: "!!!", title: "多重階乗を知る", time: "約1分", problem: "5",
     summary: "5に「!」を3個付けるだけで10。多重階乗の意味を体験します。",
    mission: "5の後ろへ ! を3回押し、5!!! を作ろう。",
    steps: ["5!は5×4×3×2×1ですが、5!!!は別の演算です。", "!が3個なら3ずつ減らし、5×2と掛けます。", "したがって5!!!は10です。!は連続9個まで使えます。"],
    example: "5!!! ＝ 5 × 2 ＝ 10", allowedValues: ["!"], emphasizedValues: ["!"], keys: ["5", "!", "!", "!"]
  },
  {
    id: "power", category: "特殊な記号", order: 8, icon: "xʸ", title: "累乗を使う", time: "約1分", problem: "321",
    summary: "3の2乗で9を作り、残った1を足します。",
    mission: "3 xʸ 2 で9を作り、1を足そう。",
    steps: ["xʸは、左の数を右の数の回数だけ掛ける記号です。", "3²、つまり3^2は9です。", "残った1を足すと10になります。"],
    example: "3² ＋ 1 ＝ 10", allowedValues: ["^", "+"], emphasizedValues: ["^"], keys: ["xʸ", "＋", "3", "2", "1"]
  },
  {
    id: "combination", category: "特殊な記号", order: 9, icon: "C", title: "組合せ C", time: "約2分", problem: "52",
    summary: "5個から2個を選ぶ組合せの数は、ちょうど10です。",
    mission: "5 C 2 を入力して、組合せの数を計算しよう。",
    steps: ["nCrは、n個から順番を区別せずr個を選ぶ方法の数です。", "5C2は、5個から2個を選ぶ方法の数です。", "計算結果は10なので、式は5C2だけで完成します。"],
    example: "5 C 2 ＝ 10", allowedValues: ["C"], emphasizedValues: ["C"], keys: ["5", "C", "2"]
  },
  {
    id: "permutation", category: "特殊な記号", order: 10, icon: "P", title: "順列 P", time: "約2分", problem: "522",
    summary: "5P2＝20を作り、残った2で割って10にします。",
    mission: "5 P 2 で20を作り、もう1つの2で割ろう。",
    steps: ["nPrは、n個から順番を区別してr個を並べる方法の数です。", "5P2は5×4で20です。", "残った2で割ると10になります。"],
    example: "5 P 2 ÷ 2 ＝ 10", allowedValues: ["P", "/"], emphasizedValues: ["P"], keys: ["5", "P", "2", "÷", "2"]
  },
];

let currentScreen = "home";
let calculator = null;
let tutorialCalculator = null;
let activeTutorialId = null;
let tutorialExplanationManuallyToggled = false;
let soloRun = null;
let timerFrame = null;
let modalCloseHandler = null;
let modalCanClose = true;
let lastSettings = null;
let externalGameActive = false;
let externalNavigationGuard = null;
let signedSessionPromise = null;

function getStoredUser() {
  try {
    const stored = JSON.parse(localStorage.getItem("currentUser") || "null");
    if (stored?.username) return stored;
  } catch {}
  const username = localStorage.getItem("username");
  const userTrackingId = localStorage.getItem("userTrackingId");
  return username ? { username, userTrackingId } : null;
}

async function ensureSignedSession({ force = false } = {}) {
  const user = getStoredUser();
  if (!user?.username || !user?.userTrackingId) return null;
  if (signedSessionPromise && !force) return signedSessionPromise;
  signedSessionPromise = fetch("/api/ten-freely/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user.username, userTrackingId: user.userTrackingId }),
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    return response.ok && data.ok !== false ? data.user : null;
  }).catch(() => null).finally(() => {
    window.setTimeout(() => { signedSessionPromise = null; }, 1500);
  });
  return signedSessionPromise;
}

function updateAuthPill() {
  const user = getStoredUser();
  refs.authPill.textContent = user?.username || "ゲスト";
  refs.authPill.title = user?.username ? `${user.username}でログイン中` : "ランキング対象外のゲストプレイ";
}

function showScreen(name, options = {}) {
  if (!screens.has(name)) return false;
  if (externalGameActive && currentScreen === "game" && name !== "game" && !options.force && externalNavigationGuard) {
    externalNavigationGuard(name);
    return false;
  }
  for (const [screenName, screen] of screens) screen.classList.toggle("is-active", screenName === name);
  document.body.classList.toggle("is-game-screen", name === "game");
  if (name !== "tutorial") document.body.classList.remove("is-tutorial-lesson");
  currentScreen = name;
  window.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
  if (name !== "game") stopTimer();
  if (name === "tutorial") showTutorialHub();
  if (name === "solo-settings") updateSettingsSummary();
  window.dispatchEvent(new CustomEvent("ten-freely:screen-changed", { detail: { screen: name } }));
  return true;
}

function formatDuration(ms, tenths = false) {
  if (!Number.isFinite(Number(ms))) return "--:--.-";
  const totalTenths = Math.max(0, Math.floor(Number(ms) / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenth = totalTenths % 10;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${tenths ? `.${tenth}` : ""}`;
}

function formatResultValue(value) {
  if (!Number.isFinite(Number(value))) return String(value);
  const number = Number(value);
  if (Math.abs(number - Math.round(number)) < 1e-10) return String(Math.round(number));
  return String(Number(number.toPrecision(10)));
}

function showToast(message, kind = "") {
  const toast = document.createElement("div");
  toast.className = `toast${kind ? ` is-${kind}` : ""}`;
  toast.textContent = message;
  refs.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 2700);
}

function openModal(html, { closeable = true, onClose = null } = {}) {
  refs.modalContent.innerHTML = html;
  refs.modalLayer.hidden = false;
  document.body.style.overflow = "hidden";
  modalCloseHandler = onClose;
  modalCanClose = closeable;
  const firstButton = refs.modalContent.querySelector("button");
  requestAnimationFrame(() => firstButton?.focus());
  for (const target of refs.modalLayer.querySelectorAll("[data-modal-close]")) target.onclick = closeable ? closeModal : null;
}

function closeModal(force = false) {
  if (refs.modalLayer.hidden || (!modalCanClose && !force)) return;
  refs.modalLayer.hidden = true;
  refs.modalContent.replaceChildren();
  document.body.style.overflow = "";
  const handler = modalCloseHandler;
  modalCloseHandler = null;
  modalCanClose = true;
  handler?.();
}

function selectedSettings() {
  const digitLengths = [...refs.settingsForm.querySelectorAll('input[name="digitLength"]:checked')].map((input) => Number(input.value));
  const lives = Number(refs.settingsForm.querySelector('input[name="lives"]:checked')?.value || 3);
  const questionRaw = refs.settingsForm.querySelector('input[name="questionCount"]:checked')?.value || "5";
  return { digitLengths, lives, questionCount: questionRaw === "infinity" ? "infinity" : Number(questionRaw) };
}

function updateSettingsSummary() {
  const settings = selectedSettings();
  const digitText = settings.digitLengths.length ? settings.digitLengths.map((value) => `${value}桁`).join("・") : "未選択";
  const questionText = settings.questionCount === "infinity" ? "全問題を使い切るまで" : `${settings.questionCount}問`;
  refs.settingsSummary.textContent = `${digitText}から毎問ランダム出題 ／ 残機${settings.lives} ／ ${questionText}。同じ数列は一度の挑戦で重複しません。`;
  refs.startSoloButton.disabled = settings.digitLengths.length === 0;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.payload = data;
    throw error;
  }
  return data;
}

async function startSolo(settings = selectedSettings()) {
  refs.startSoloButton.disabled = true;
  refs.startSoloButton.querySelector("span").textContent = "準備中…";
  await ensureSignedSession();
  try {
    const data = await api("/api/ten-freely/solo/start", { method: "POST", body: JSON.stringify({ settings }) });
    lastSettings = settings;
    soloRun = data.run;
    externalGameActive = false;
    refs.onlineScoreboard.hidden = true;
    mountGameCalculator();
    updateGameHeader();
    showScreen("game", { instant: true });
    startTimer();
    if (!data.rankingEligible && getStoredUser()) showToast("ランキング連携には、トップ画面で一度ログインし直してください。", "warning");
  } catch (error) {
    console.error(error);
    showToast("ゲームの準備に失敗しました。通信状態を確認してください。", "warning");
  } finally {
    refs.startSoloButton.disabled = false;
    refs.startSoloButton.querySelector("span").textContent = "ゲームスタート";
  }
}

function mountGameCalculator() {
  calculator?.destroy();
  calculator = new TenCalculator(refs.calculatorMount, {
    problem: soloRun.problem,
    onSubmit: submitSoloExpression,
    onRetire: confirmRetire,
    onActivity: () => {},
  });
}

function updateGameHeader() {
  if (!soloRun) return;
  refs.gameModeLabel.textContent = "無限対戦";
  refs.gameProgressText.textContent = `${soloRun.questionIndex} / ${soloRun.targetQuestions}`;
  refs.gameLives.replaceChildren();
  for (let index = 0; index < soloRun.settings.lives; index += 1) {
    const dot = document.createElement("span");
    dot.className = `life-dot${index >= soloRun.lives ? " is-empty" : ""}`;
    refs.gameLives.append(dot);
  }
  refs.gameLives.setAttribute("aria-label", `残機${soloRun.lives}`);
}

function startTimer() {
  stopTimer();
  const tick = () => {
    if (currentScreen !== "game" || !soloRun || soloRun.status === "finished" || externalGameActive) return;
    refs.gameTimer.textContent = formatDuration(Date.now() - soloRun.questionStartedAt, true);
    timerFrame = requestAnimationFrame(tick);
  };
  timerFrame = requestAnimationFrame(tick);
}

function stopTimer() {
  if (timerFrame) cancelAnimationFrame(timerFrame);
  timerFrame = null;
}

async function submitSoloExpression(expression, instance) {
  if (!soloRun) return;
  instance.setLocked(true);
  try {
    const data = await api("/api/ten-freely/solo/submit", { method: "POST", body: JSON.stringify({ runId: soloRun.runId, expression }) });
    if (data.correct) {
      instance.setResult("10 — SUCCESS", "ten");
      showToast(`${formatDuration(data.answerTimeMs, true)}で正解！`, "success");
      if (data.finished) {
        soloRun = data.result;
        window.setTimeout(() => showResultModal(data.result), 720);
        return;
      }
      soloRun = data.run;
      updateGameHeader();
      window.setTimeout(() => {
        instance.setProblem(soloRun.problem);
        instance.setLocked(false);
        startTimer();
      }, 720);
      return;
    }
    if (data.expressionError) instance.setResult(data.expressionError.message, "error");
    else instance.setResult(`${formatResultValue(data.value)}　≠　10`, "error");
    if (data.finished) {
      soloRun = data.result;
      updateGameHeader();
      window.setTimeout(() => showResultModal(data.result), 520);
      return;
    }
    soloRun = data.run;
    updateGameHeader();
    instance.setLocked(false);
    showToast(`不正解。残機はあと${soloRun.lives}です。`, "warning");
  } catch (error) {
    console.error(error);
    instance.setResult(error.payload?.expressionError?.message || "式を送信できませんでした。", "error");
    instance.setLocked(false);
  }
}

function confirmRetire() {
  if (!soloRun || soloRun.status === "finished") return;
  openModal(`<div class="result-icon is-failure">🏳️</div><h2 id="modalTitle">リタイアしますか？</h2><p class="result-lead">現在の挑戦を終了し、ここまでの記録をリザルトにまとめます。</p><div class="modal-actions"><button class="modal-primary" type="button" data-confirm-retire>リタイアする</button><button class="modal-secondary" type="button" data-modal-close>続ける</button></div>`);
  refs.modalContent.querySelector("[data-confirm-retire]").onclick = async () => { closeModal(); await retireSolo(); };
}

async function retireSolo() {
  if (!soloRun) return;
  calculator?.setLocked(true);
  try {
    const data = await api("/api/ten-freely/solo/retire", { method: "POST", body: JSON.stringify({ runId: soloRun.runId }) });
    soloRun = data.result;
    showResultModal(data.result);
  } catch (error) {
    console.error(error);
    calculator?.setLocked(false);
    showToast("リタイア処理に失敗しました。", "warning");
  }
}

function saveLocalResult(result) {
  try {
    const history = JSON.parse(localStorage.getItem("tenFreelyLocalRuns") || "[]");
    history.unshift({ at: Date.now(), settings: result.settings, solvedCount: result.solvedCount, averageTimeMs: result.averageTimeMs, totalAnswerTimeMs: result.totalAnswerTimeMs, finishReason: result.finishReason });
    localStorage.setItem("tenFreelyLocalRuns", JSON.stringify(history.slice(0, 30)));
  } catch {}
}

function resultReasonText(reason) {
  if (reason === "completed") return "設定した問題をすべて解き切りました。";
  if (reason === "all_problems_completed") return "選択した桁数の全問題を制覇しました。";
  if (reason === "lives_depleted") return "残機がなくなったため、挑戦終了です。";
  if (reason === "retired") return "リタイア地点までの記録です。";
  return "挑戦結果をまとめました。";
}

function showResultModal(result) {
  stopTimer();
  saveLocalResult(result);
  const success = ["completed", "all_problems_completed"].includes(result.finishReason);
  openModal(`
    <div class="result-icon${success ? "" : " is-failure"}">${success ? "✓" : "×"}</div>
    <h2 id="modalTitle">${success ? "チャレンジ完了" : "チャレンジ終了"}</h2><p class="result-lead">${resultReasonText(result.finishReason)}</p>
    <div class="result-stats"><div><strong>${result.solvedCount}</strong><span>正解数</span></div><div><strong>${formatDuration(result.averageTimeMs, true)}</strong><span>平均回答</span></div><div><strong>${result.lives}</strong><span>残機</span></div></div>
    ${result.unresolvedProblem ? `<div class="solution-card" data-solution-card><small>解法例・${result.unresolvedProblem}</small><div class="solution-loading">スマートな解法を計算中…</div></div>` : ""}
    <div class="modal-actions"><button class="modal-primary" type="button" data-retry>同じ条件でもう一度</button><button class="modal-secondary" type="button" data-result-home>ホームに戻る</button></div>`, { closeable: false });
  refs.modalContent.querySelector("[data-retry]").onclick = () => { closeModal(true); startSolo(lastSettings || result.settings); };
  refs.modalContent.querySelector("[data-result-home]").onclick = () => {
    closeModal(true);
    calculator?.destroy(); calculator = null; soloRun = null;
    showScreen("home", { instant: true, force: true });
  };
  if (result.unresolvedProblem) loadSolution(result.unresolvedProblem);
}

async function loadSolution(problem) {
  const card = refs.modalContent.querySelector("[data-solution-card]");
  if (!card) return;
  try {
    const data = await api(`/api/ten-freely/solution/${encodeURIComponent(problem)}`, { headers: {} });
    card.querySelector(".solution-loading").outerHTML = `<div class="solution-expression">${escapeHtml(data.solution.expression)}</div>`;
  } catch (error) {
    console.error(error);
    const loading = card.querySelector(".solution-loading");
    if (loading) loading.textContent = "解法例を取得できませんでした。";
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function readTutorialCompletions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch { return new Set(); }
}

function saveTutorialCompletion(id) {
  const completed = readTutorialCompletions();
  completed.add(id);
  try { localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify([...completed])); } catch {}
  return completed;
}

function tutorialById(id) {
  return tutorialLessons.find((lesson) => lesson.id === id) || null;
}

function renderTutorialHub() {
  const completed = readTutorialCompletions();
  refs.tutorialCompletedCount.textContent = `${completed.size} / ${tutorialLessons.length}`;
  refs.tutorialLessonGroups.replaceChildren();
  for (const category of ["はじめの一歩", "特殊な記号"]) {
    const section = document.createElement("section");
    section.className = "tutorial-category";
    const lessons = tutorialLessons.filter((lesson) => lesson.category === category);
    section.innerHTML = `<div class="tutorial-category-heading"><div><small>${category === "はじめの一歩" ? "BASICS" : "SPECIAL OPERATORS"}</small><h3>${category}</h3></div><span>${lessons.filter((lesson) => completed.has(lesson.id)).length} / ${lessons.length}</span></div><div class="tutorial-card-grid"></div>`;
    const grid = section.querySelector(".tutorial-card-grid");
    for (const lesson of lessons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tutorial-card${completed.has(lesson.id) ? " is-complete" : ""}`;
      button.dataset.tutorialId = lesson.id;
      button.innerHTML = `<span class="tutorial-card-icon">${escapeHtml(lesson.icon)}</span><span class="tutorial-card-copy"><small>LESSON ${String(lesson.order).padStart(2, "0")} ・ ${lesson.time}</small><strong>${escapeHtml(lesson.title)}</strong><span>${escapeHtml(lesson.summary)}</span></span><span class="tutorial-card-state">${completed.has(lesson.id) ? "✓" : "→"}</span>`;
      grid.append(button);
    }
    refs.tutorialLessonGroups.append(section);
  }
  const firstIncomplete = tutorialLessons.find((lesson) => !completed.has(lesson.id)) || tutorialLessons[0];
  refs.tutorialRecommendedButton.dataset.tutorialId = firstIncomplete.id;
  refs.tutorialRecommendedButton.querySelector("span:first-child").textContent = completed.size === tutorialLessons.length ? "好きなレッスンを復習" : `おすすめ：${firstIncomplete.title}`;
}

function showTutorialHub() {
  document.body.classList.remove("is-tutorial-lesson");
  activeTutorialId = null;
  tutorialCalculator?.destroy();
  tutorialCalculator = null;
  refs.tutorialHub.hidden = false;
  refs.tutorialLesson.hidden = true;
  renderTutorialHub();
}

function setTutorialExplanationExpanded(expanded, { manual = false } = {}) {
  if (manual) tutorialExplanationManuallyToggled = true;
  refs.tutorialExplanation.hidden = !expanded;
  refs.tutorialDisclosureButton.setAttribute("aria-expanded", String(expanded));
  refs.tutorialDisclosureButton.querySelector(".tutorial-disclosure-chevron").textContent = expanded ? "⌃" : "⌄";
}

function startTutorialLesson(id) {
  const lesson = tutorialById(id);
  if (!lesson) return;
  activeTutorialId = id;
  document.body.classList.add("is-tutorial-lesson");
  tutorialExplanationManuallyToggled = false;
  refs.tutorialHub.hidden = true;
  refs.tutorialLesson.hidden = false;
  refs.tutorialLessonPosition.textContent = `LESSON ${String(lesson.order).padStart(2, "0")} / ${tutorialLessons.length} ・ ${lesson.time}`;
  refs.tutorialMission.textContent = lesson.mission;
  refs.tutorialLessonCategory.textContent = lesson.category;
  refs.tutorialLessonTitle.textContent = lesson.title;
  refs.tutorialLessonSummary.textContent = lesson.summary;
  refs.tutorialSteps.replaceChildren(...lesson.steps.map((text) => {
    const item = document.createElement("li"); item.textContent = text; return item;
  }));
  refs.tutorialExample.textContent = lesson.example;
  refs.tutorialKeyChips.replaceChildren(...lesson.keys.map((key) => {
    const chip = document.createElement("span"); chip.textContent = key; return chip;
  }));
  const spaciousLayout = window.matchMedia("(min-width: 761px) and (min-height: 760px)").matches;
  setTutorialExplanationExpanded(spaciousLayout);
  tutorialCalculator?.destroy();
  tutorialCalculator = new TenCalculator(refs.tutorialCalculatorMount, {
    problem: lesson.problem,
    allowedValues: lesson.allowedValues,
    allowedActions: TUTORIAL_ACTIONS,
    emphasizedValues: lesson.emphasizedValues,
    onRetire: () => {},
    onFirstInput: () => {
      if (!tutorialExplanationManuallyToggled) setTutorialExplanationExpanded(false);
    },
    onSubmit: (expression, instance) => {
      try {
        const { value } = evaluateExpression(expression);
        if (!isTen(value)) {
          instance.setResult(`${formatResultValue(value)}　≠　10`, "error");
          return;
        }
        instance.setResult("10 — LESSON CLEAR", "ten");
        instance.setLocked(true);
        const completed = saveTutorialCompletion(lesson.id);
        const next = tutorialLessons.find((candidate) => candidate.order > lesson.order && !completed.has(candidate.id));
        openModal(`
          <div class="result-icon">✓</div>
          <h2 id="modalTitle">「${escapeHtml(lesson.title)}」完了</h2>
          <p class="result-lead">使い方を、実際の電卓操作で確認できました。必要になったら何度でも復習できます。</p>
          <div class="modal-actions">
             ${next ? `<button class="modal-primary" type="button" data-next-tutorial>次のおすすめ：${escapeHtml(next.title)}</button>` : ""}
            <button class="modal-secondary" type="button" data-tutorial-list>レッスン一覧へ</button>
          </div>`, { closeable: false });
        refs.modalContent.querySelector("[data-next-tutorial]")?.addEventListener("click", () => { closeModal(true); startTutorialLesson(next.id); });
        refs.modalContent.querySelector("[data-tutorial-list]").addEventListener("click", () => { closeModal(true); showTutorialHub(); });
      } catch (error) { instance.setResult(error.message, "error"); }
    },
  });
  window.scrollTo({ top: 0, behavior: "auto" });
}

function leaveTutorialLesson() {
  if (!activeTutorialId) return showTutorialHub();
  showTutorialHub();
}

function prepareExternalGame() {
  calculator?.destroy();
  calculator = null;
  soloRun = null;
  stopTimer();
  externalGameActive = true;
  refs.onlineScoreboard.hidden = false;
}

function finishExternalGame() {
  externalGameActive = false;
  externalNavigationGuard = null;
  refs.onlineScoreboard.hidden = true;
}

window.tenFreelyApp = {
  showScreen,
  showToast,
  openModal,
  closeModal,
  formatDuration,
  formatResultValue,
  ensureSignedSession,
  prepareExternalGame,
  finishExternalGame,
  setExternalNavigationGuard(handler) { externalNavigationGuard = typeof handler === "function" ? handler : null; },
  get currentScreen() { return currentScreen; },
};


// 条件別ランキングは小規模なので、画面制御と同じモジュールへ統合。
const form = document.getElementById("rankingFilters");
const list = document.getElementById("rankingList");
const status = document.getElementById("rankingStatus");
let requestSequence = 0;
let debounceTimer = null;

function selectedCondition() {
  const digitLengths = [...form.querySelectorAll('input[name="rankingDigit"]:checked')].map((input) => Number(input.value));
  const questionRaw = form.querySelector('input[name="rankingQuestions"]:checked')?.value || "5";
  return {
    digitLengths,
    questionCount: questionRaw === "infinity" ? "infinity" : Number(questionRaw),
    lives: Number(form.querySelector('input[name="rankingLives"]:checked')?.value || 3),
  };
}

function valueHtml(entry, infinite) {
  if (infinite) return `<strong>${Number(entry.solvedCount).toLocaleString("ja-JP")}問</strong><small>平均 ${formatDuration(entry.averageTimeMs, true)}</small>`;
  return `<strong>${formatDuration(entry.totalTimeMs, true)}</strong><small>平均 ${formatDuration(entry.averageTimeMs, true)}</small>`;
}

function renderRanking(data) {
  const infinite = data.condition.questionCount === "infinity";
  list.replaceChildren();
  if (!data.ranking.length) {
    list.innerHTML = '<li class="ranking-empty">この条件には、まだ完走記録がありません。最初の記録を作ろう。</li>';
    status.textContent = infinite
      ? "∞モードは正解数が多い順。同数なら平均回答時間で順位を決めます。"
      : "5問・10問モードは、全問クリアした記録だけを合計タイムで比較します。";
    return;
  }

  for (const entry of data.ranking) {
    const row = document.createElement("li");
    row.className = `ranking-row${entry.isSelf ? " is-self" : ""}`;
    row.innerHTML = `
      <span class="ranking-medal">${entry.rank}</span>
      <span class="ranking-name"><strong>${escapeHtml(entry.username)}${entry.isSelf ? "（あなた）" : ""}</strong><small>${entry.rank <= 3 ? "TOP CHALLENGER" : "CHALLENGER"}</small></span>
      <span class="ranking-value">${valueHtml(entry, infinite)}</span>`;
    list.append(row);
  }
  const ownText = data.own
    ? `あなたの自己ベストは ${data.own.rank}位です。`
    : "ログイン中の完走記録は、まだこの条件にありません。";
  status.textContent = `${infinite ? "正解数順" : "合計タイム順"} ／ 条件完全一致。${ownText}`;
}

async function loadRanking() {
  const condition = selectedCondition();
  if (!condition.digitLengths.length) {
    status.textContent = "桁数を1つ以上選択してください。";
    list.replaceChildren();
    return;
  }
  const sequence = ++requestSequence;
  status.textContent = "ランキングを読み込んでいます…";
  list.innerHTML = '<li class="ranking-empty">LOADING…</li>';
  const params = new URLSearchParams({
    digits: condition.digitLengths.join(","),
    questions: String(condition.questionCount),
    lives: String(condition.lives),
    limit: "50",
  });
  try {
    const response = await fetch(`/api/ten-freely/ranking?${params}`, { credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || "ranking_failed");
    if (sequence !== requestSequence) return;
    renderRanking(data);
  } catch (error) {
    console.error(error);
    if (sequence !== requestSequence) return;
    status.textContent = "ランキングを取得できませんでした。少し時間をおいて再度お試しください。";
    list.innerHTML = '<li class="ranking-empty">データを読み込めませんでした。</li>';
  }
}

form.addEventListener("change", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadRanking, 180);
});
window.addEventListener("ten-freely:screen-changed", (event) => {
  if (event.detail?.screen === "ranking") loadRanking();
});

for (const button of document.querySelectorAll("[data-open-screen]")) button.addEventListener("click", () => showScreen(button.dataset.openScreen));
refs.homeBrandButton.addEventListener("click", () => showScreen("home"));
refs.settingsForm.addEventListener("change", updateSettingsSummary);
refs.settingsForm.addEventListener("submit", (event) => { event.preventDefault(); startSolo(); });
refs.tutorialLessonGroups.addEventListener("click", (event) => {
  const card = event.target.closest("[data-tutorial-id]");
  if (card) startTutorialLesson(card.dataset.tutorialId);
});
refs.tutorialRecommendedButton.addEventListener("click", () => startTutorialLesson(refs.tutorialRecommendedButton.dataset.tutorialId));
refs.tutorialLessonBack.addEventListener("click", leaveTutorialLesson);
refs.tutorialExitButton.addEventListener("click", leaveTutorialLesson);
refs.tutorialDisclosureButton.addEventListener("click", () => {
  setTutorialExplanationExpanded(refs.tutorialDisclosureButton.getAttribute("aria-expanded") !== "true", { manual: true });
});
refs.tutorialMissionHelp.addEventListener("click", () => {
  setTutorialExplanationExpanded(true, { manual: true });
  refs.tutorialDisclosureButton.scrollIntoView({ behavior: "smooth", block: "center" });
});
refs.modalLayer.addEventListener("click", (event) => { if (event.target.matches("[data-modal-close]")) closeModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !refs.modalLayer.hidden) closeModal(); });
window.addEventListener("storage", () => { updateAuthPill(); ensureSignedSession({ force: true }); });
window.addEventListener("beforeunload", () => { calculator?.destroy(); tutorialCalculator?.destroy(); });

updateAuthPill();
updateSettingsSummary();
ensureSignedSession();
