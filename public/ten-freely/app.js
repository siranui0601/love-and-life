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
  tutorialCalculatorMount: document.getElementById("tutorialCalculatorMount"),
  tutorialStepLabel: document.getElementById("tutorialStepLabel"),
  tutorialProgressBar: document.getElementById("tutorialProgressBar"),
  tutorialEyebrow: document.getElementById("tutorialEyebrow"),
  tutorialHeading: document.getElementById("tutorialHeading"),
  tutorialDescription: document.getElementById("tutorialDescription"),
  tutorialTip: document.getElementById("tutorialTip"),
  tutorialSkipButton: document.getElementById("tutorialSkipButton"),
  tutorialNextButton: document.getElementById("tutorialNextButton"),
  modalLayer: document.getElementById("modalLayer"),
  modalContent: document.getElementById("modalContent"),
  toastRegion: document.getElementById("toastRegion"),
};

const tutorialSteps = [
  { problem: "46", eyebrow: "まずは足し算", heading: "数字を一度ずつ使おう", description: "最初はシンプルです。表示された4と6を、それぞれ一度だけ使って10を作ってください。数字をすべて使うまで「=」は押せません。", tip: "4 → ＋ → 6 の順に押して、最後に「=」を押してみよう。" },
  { problem: "223", eyebrow: "括弧と掛け算", heading: "計算の順番を設計する", description: "括弧を使うと、先に計算する部分を指定できます。数字を連結して22のような数にはできません。", tip: "2×(3+2) の形を作ると10になります。←・→で途中へ戻って編集できます。" },
  { problem: "002", eyebrow: "階乗と多重階乗", heading: "「!」は連続9個まで", description: "n! は1ずつ、n!!は2ずつ、n!!!は3ずつ減らして掛けます。たとえば5!!!は5×2で10です。", tip: "この難問は ((0!+2)!−0!)!!! で解けます。0!=1も重要な道具です。" },
  { problem: "228", eyebrow: "平方根は途中で自由", heading: "√2×√2 も使える", description: "平方根の途中結果が整数でなくても構いません。最後の計算結果が10なら正解です。", tip: "√2×√2+8 を入力してください。絶対値 |x|、累乗 ^、順列P、組合せCも利用できます。" },
  { problem: "0067", eyebrow: "最後は自力で", heading: "自由な式で10を作ろう", description: "操作方法はすべて覚えました。数字ボタン右上の小さな数字は、あと何回使えるかを示します。", tip: "ヒント：0!+0! は2になります。6を2で割ると、7に足すべき数が作れます。" },
];

let currentScreen = "home";
let calculator = null;
let tutorialCalculator = null;
let tutorialIndex = 0;
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
  currentScreen = name;
  window.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
  if (name !== "game") stopTimer();
  if (name === "tutorial") startTutorial(0);
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

function startTutorial(index = 0) {
  tutorialIndex = Math.max(0, Math.min(tutorialSteps.length - 1, index));
  const step = tutorialSteps[tutorialIndex];
  refs.tutorialStepLabel.textContent = `STEP ${tutorialIndex + 1} / ${tutorialSteps.length}`;
  refs.tutorialProgressBar.style.width = `${((tutorialIndex + 1) / tutorialSteps.length) * 100}%`;
  refs.tutorialEyebrow.textContent = step.eyebrow;
  refs.tutorialHeading.textContent = step.heading;
  refs.tutorialDescription.textContent = step.description;
  refs.tutorialTip.textContent = step.tip;
  refs.tutorialNextButton.disabled = true;
  refs.tutorialNextButton.querySelector("span:first-child").textContent = tutorialIndex === tutorialSteps.length - 1 ? "完了" : "次へ";
  tutorialCalculator?.destroy();
  tutorialCalculator = new TenCalculator(refs.tutorialCalculatorMount, {
    problem: step.problem,
    onRetire: () => showToast("チュートリアルではリタイアしなくて大丈夫。", "warning"),
    onSubmit: (expression, instance) => {
      try {
        const { value } = evaluateExpression(expression);
        if (isTen(value)) {
          instance.setResult("10 — PERFECT", "ten");
          instance.setLocked(true);
          refs.tutorialNextButton.disabled = false;
          showToast("正解！操作を身につけました。", "success");
        } else instance.setResult(`${formatResultValue(value)}　≠　10`, "error");
      } catch (error) { instance.setResult(error.message, "error"); }
    },
  });
}

function advanceTutorial() {
  if (tutorialIndex >= tutorialSteps.length - 1) {
    try { localStorage.setItem("tenFreelyTutorialCompleted", "1"); } catch {}
    tutorialCalculator?.destroy(); tutorialCalculator = null;
    showToast("チュートリアル完了！", "success");
    showScreen("home", { instant: true });
    return;
  }
  startTutorial(tutorialIndex + 1);
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

for (const button of document.querySelectorAll("[data-open-screen]")) button.addEventListener("click", () => showScreen(button.dataset.openScreen));
refs.homeBrandButton.addEventListener("click", () => showScreen("home"));
refs.settingsForm.addEventListener("change", updateSettingsSummary);
refs.settingsForm.addEventListener("submit", (event) => { event.preventDefault(); startSolo(); });
refs.tutorialNextButton.addEventListener("click", advanceTutorial);
refs.tutorialSkipButton.addEventListener("click", () => { if (tutorialIndex >= tutorialSteps.length - 1) advanceTutorial(); else startTutorial(tutorialIndex + 1); });
refs.modalLayer.addEventListener("click", (event) => { if (event.target.matches("[data-modal-close]")) closeModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !refs.modalLayer.hidden) closeModal(); });
window.addEventListener("storage", () => { updateAuthPill(); ensureSignedSession({ force: true }); });
window.addEventListener("beforeunload", () => { calculator?.destroy(); tutorialCalculator?.destroy(); });

updateAuthPill();
updateSettingsSummary();
ensureSignedSession();
