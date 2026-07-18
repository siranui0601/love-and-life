const API_BASE = "/TRPG/api/game";
const LAST_SAVE_KEY = "trpg:last-save-id";
const REQUEST_TIMEOUT = 30000;
const PANEL_NAMES = new Set(["movement", "inventory", "skills", "missions", "rumors", "shop", "chronicle"]);
const DAYPART_LABELS = Object.freeze({
  dawn: "明け方",
  morning: "朝",
  day: "昼",
  afternoon: "昼",
  dusk: "夕方",
  evening: "夕方",
  night: "夜",
});
const CHOICE_KIND_LABELS = Object.freeze({
  talk: "会話",
  conversation: "会話",
  investigate: "調査",
  observe: "観察",
  prepare: "戦闘",
  missionBattle: "戦闘",
  seekBattle: "戦闘",
  help: "任務",
  resolveMission: "任務",
  wait: "休息",
  rest: "休息",
  work: "仕事",
  move: "移動",
});

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ui = {
  launch: $("#launchScreen"),
  game: $("#gameScreen"),
  newTab: $("#newTab"),
  resumeTab: $("#resumeTab"),
  newPanel: $("#newGamePanel"),
  resumePanel: $("#resumePanel"),
  newForm: $("#newGameForm"),
  saveList: $("#saveList"),
  saveListStatus: $("#saveListStatus"),
  launchError: $("#launchError"),
  gameError: $("#gameError"),
  busy: $("#busyOverlay"),
  backdrop: $("#sceneBackdrop"),
  npcStage: $("#npcStage"),
  choices: $("#choiceRegion"),
  guidance: $("#guidanceBar"),
  tutorial: $("#tutorialCard"),
  announcer: $("#sceneAnnouncer"),
  dialog: $("#detailDialog"),
  dialogTitle: $("#dialogTitle"),
  dialogKicker: $("#dialogKicker"),
  dialogBody: $("#dialogBody"),
};

let currentSave = null;
let assetManifest = { backgrounds: {}, portraits: {} };
let busy = false;
const busyDisabledState = new Map();

function escapeText(value, fallback = "—") {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return Object.entries(value).map(([id, entry]) => typeof entry === "object" ? { id, ...entry } : { id, value: entry });
  }
  return [];
}

function formatPercent(value) {
  return `${Math.round(Math.max(0, Math.min(1, number(value, 0))) * 100)}%`;
}

function formatClock(clock = {}) {
  const time = typeof clock.time === "string"
    ? clock.time
    : `${String(number(clock.hour, 0)).padStart(2, "0")}:${String(number(clock.minute, 0)).padStart(2, "0")}`;
  const rawDaypart = escapeText(clock.daypart, "昼");
  const key = rawDaypart.toLowerCase();
  const daypart = key === "day"
    ? number(clock.hour, 0) < 12 ? "午前" : "日中"
    : DAYPART_LABELS[key] ?? rawDaypart;
  return { day: `Day ${number(clock.day, 1)}`, time, daypart };
}

function panelName(value) {
  const name = String(value ?? "").trim();
  return PANEL_NAMES.has(name) ? name : null;
}

function choiceKind(choice) {
  const intent = String(choice?.intentType ?? "").trim();
  const type = String(choice?.type ?? "").trim();
  return CHOICE_KIND_LABELS[type] ?? CHOICE_KIND_LABELS[intent] ?? "行動";
}

function dangerLabel(value) {
  const danger = value && typeof value === "object" ? value.level ?? value.severity : value;
  if (danger === true) return "危険";
  if (danger === false || danger == null || danger === "") return "";
  if (typeof danger === "number") return danger >= 0.75 ? "高危険" : danger > 0 ? "注意" : "";
  const key = String(danger).trim().toLowerCase();
  if (["critical", "high", "severe", "deadly"].includes(key)) return "高危険";
  if (["medium", "moderate", "danger", "dangerous"].includes(key)) return "危険";
  if (["low", "caution", "warning"].includes(key)) return "注意";
  return "危険あり";
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 240) }; }
    if (!response.ok || data.ok === false) {
      const message = response.status === 404
        ? "実プレイ機能は現在サーバーで利用できません。公開準備が完了してから、もう一度お試しください。"
        : data.error || data.message || `通信に失敗しました（HTTP ${response.status}）`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("応答に時間がかかっています。通信環境を確認して、もう一度お試しください。");
    if (error instanceof TypeError) throw new Error("ゲームサーバーへ接続できません。しばらく待ってから再度お試しください。");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function disableBusyControls() {
  $$('button, input, select, textarea', $("#mainContent")).forEach((element) => {
    if (!busyDisabledState.has(element)) busyDisabledState.set(element, element.disabled);
    element.disabled = true;
  });
  $$('button, input, select, textarea', ui.dialog).forEach((element) => {
    if (!busyDisabledState.has(element)) busyDisabledState.set(element, element.disabled);
    element.disabled = true;
  });
}

function setBusy(value, message = "世界が動いています…") {
  busy = value;
  ui.busy.hidden = !value;
  $("b", ui.busy).textContent = message;
  ui.launch.setAttribute("aria-busy", String(value));
  ui.game.setAttribute("aria-busy", String(value));
  ui.dialog.setAttribute("aria-busy", String(value));
  if (value) {
    disableBusyControls();
    return;
  }
  busyDisabledState.forEach((wasDisabled, element) => {
    if (element.isConnected) element.disabled = wasDisabled;
  });
  busyDisabledState.clear();
  if (currentSave) renderTutorialUnlocks(currentSave.tutorial);
}

function showError(target, message, retry = null) {
  target.hidden = false;
  target.replaceChildren();
  const text = document.createElement("p");
  text.textContent = message;
  target.append(text);
  if (retry) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-button";
    button.textContent = "もう一度試す";
    button.addEventListener("click", retry, { once: true });
    target.append(button);
  }
}

function clearErrors() {
  ui.launchError.hidden = true;
  ui.gameError.hidden = true;
}

function switchLaunchTab(tab, { focusPanel = true } = {}) {
  const isNew = tab === "new";
  ui.newTab.setAttribute("aria-selected", String(isNew));
  ui.resumeTab.setAttribute("aria-selected", String(!isNew));
  ui.newTab.tabIndex = isNew ? 0 : -1;
  ui.resumeTab.tabIndex = isNew ? -1 : 0;
  ui.newPanel.hidden = !isNew;
  ui.resumePanel.hidden = isNew;
  if (focusPanel) (isNew ? $("#playerName") : $("#refreshSaves")).focus();
  if (!isNew) loadSaveList();
}

function validAssetUrl(url) {
  return typeof url === "string" && (/^\/TRPG\/assets\//u.test(url) || /^\.\/assets\//u.test(url));
}

function backgroundUrl(key) {
  const entry = assetManifest.backgrounds?.[key];
  const url = typeof entry === "string" ? entry : entry?.src;
  return validAssetUrl(url) ? url : null;
}

function portraitUrl(npc) {
  const entry = assetManifest.portraits?.[npc.id] ?? assetManifest.portraits?.[npc.portraitKey];
  if (typeof entry === "string") return validAssetUrl(entry) ? entry : null;
  const emotion = npc.emotion || npc.mood || "default";
  const url = entry?.[emotion] ?? entry?.default ?? entry?.neutral;
  return validAssetUrl(url) ? url : null;
}

function renderNpcs(npcs) {
  ui.npcStage.replaceChildren();
  const entries = list(npcs).slice(0, 5);
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty-stage";
    empty.textContent = "今、この場に話せる人物はいない。";
    ui.npcStage.append(empty);
    return;
  }
  entries.forEach((npc, index) => {
    const card = document.createElement("article");
    card.className = "npc-card";
    card.style.setProperty("--npc-index", index);
    const imageUrl = portraitUrl(npc);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = `${escapeText(npc.name, "人物")}の立ち絵`;
      card.append(image);
    } else {
      const fallback = document.createElement("div");
      fallback.className = "portrait-fallback";
      fallback.textContent = escapeText(npc.name, "人").slice(0, 1);
      fallback.setAttribute("aria-hidden", "true");
      card.append(fallback);
    }
    const caption = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = escapeText(npc.name, "名もなき人物");
    const role = document.createElement("span");
    role.textContent = escapeText(npc.role || npc.occupation || npc.mood, "この場にいる");
    caption.append(name, role);
    card.append(caption);
    ui.npcStage.append(card);
  });
}

function renderChoices(choices, ended = false) {
  ui.choices.replaceChildren();
  const entries = list(choices).slice(0, 3);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-message";
    empty.textContent = ended
      ? "100日間の旅は完結しました。年代記から、あなたの選択が残した結果を振り返れます。"
      : "選択肢を準備できませんでした。画面を再読み込みしてください。";
    ui.choices.append(empty);
    return;
  }
  entries.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    const choiceId = choice.choiceId || choice.id;
    if (choiceId) button.dataset.choiceId = choiceId;
    const label = escapeText(choice.label, "行動する");
    const kind = choiceKind(choice);
    const minutes = number(choice.minutes);
    const danger = dangerLabel(choice.danger);
    if (danger) button.classList.add("is-danger");
    button.innerHTML = `<span class="choice-number" aria-hidden="true">${index + 1}</span><span class="choice-content"><span class="choice-label"></span><span class="choice-meta"><span class="choice-kind"></span><span class="choice-time"></span><span class="choice-danger" hidden></span></span></span>`;
    $(".choice-label", button).textContent = label;
    $(".choice-kind", button).textContent = kind;
    $(".choice-time", button).textContent = minutes > 0 ? `${minutes}分` : "時間消費なし";
    const dangerElement = $(".choice-danger", button);
    dangerElement.hidden = !danger;
    dangerElement.textContent = danger;
    button.setAttribute("aria-label", `${label}。${kind}。${minutes > 0 ? `所要${minutes}分` : "時間消費なし"}${danger ? `。${danger}` : ""}`);
    button.disabled = !choiceId;
    button.addEventListener("click", () => sendCommand("CHOOSE", { choiceId: button.dataset.choiceId }));
    ui.choices.append(button);
  });
}

function renderSpeeches(speeches, npcs) {
  let container = $("#speechList");
  if (!container) {
    container = document.createElement("div");
    container.id = "speechList";
    container.className = "speech-list";
    container.setAttribute("aria-label", "この場の会話");
    $("#narrativeText").insertAdjacentElement("afterend", container);
  }
  container.replaceChildren();
  const npcById = new Map(list(npcs).map((npc) => [npc.id, npc]));
  list(speeches).forEach((speech) => {
    const row = document.createElement("p");
    const name = document.createElement("strong");
    name.textContent = escapeText(npcById.get(speech.actorId)?.name, speech.actorId);
    const text = document.createElement("span");
    text.textContent = `「${escapeText(speech.text, "……")}」`;
    row.append(name, text);
    container.append(row);
  });
  container.hidden = container.childElementCount === 0;
}

function activeStoryMissions(save = currentSave) {
  const statuses = new Set(["active", "available", "in_progress"]);
  return list(save?.missions)
    .filter((mission) => mission.kind !== "permanent" && statuses.has(mission.status))
    .sort((left, right) => number(left.deadlineDay, 999) - number(right.deadlineDay, 999)
      || String(left.id ?? "").localeCompare(String(right.id ?? "")));
}

function targetFacilityName(targetFacilityId, suppliedName = "", save = currentSave) {
  if (suppliedName) return escapeText(suppliedName);
  if (!targetFacilityId) return "";
  const movement = list(save?.movement).find((move) => (move.destinationFacilityId || move.targetFacilityId) === targetFacilityId);
  return escapeText(movement?.destinationFacilityName || movement?.destinationName, "");
}

function guidanceView(save) {
  const supplied = save?.guidance && typeof save.guidance === "object" ? save.guidance : null;
  if (supplied && [supplied.kicker, supplied.title, supplied.detail, supplied.deadlineLabel, supplied.actionPanel].some(Boolean)) {
    return {
      ...supplied,
      targetFacilityName: targetFacilityName(supplied.targetFacilityId, supplied.targetFacilityName, save),
    };
  }
  const mission = activeStoryMissions(save)[0];
  if (!mission) return null;
  const step = mission.currentStep;
  const stepLabel = typeof step === "object" ? step?.label : step;
  const targetFacilityId = typeof step === "object" ? step?.targetFacilityId : mission.targetFacilityId;
  const facilityName = targetFacilityName(
    targetFacilityId,
    typeof step === "object" ? step?.targetFacilityName : mission.targetFacilityName,
    save,
  );
  const deadlineLabel = escapeText(mission.deadlineLabel, mission.deadlineDay ? `期限 Day ${mission.deadlineDay}` : "");
  const detailParts = [facilityName ? `${facilityName}へ向かう` : "", stepLabel].filter(Boolean);
  return {
    kicker: "現在の目的",
    title: escapeText(mission.title || mission.name, "物語を進める"),
    detail: detailParts.join("：") || "任務一覧で次の行動を確認しましょう。",
    targetFacilityId,
    targetFacilityName: facilityName,
    deadlineLabel,
    actionPanel: targetFacilityId ? "movement" : "missions",
  };
}

function panelActionLabel(name) {
  const labels = {
    movement: "移動先を見る",
    inventory: "持ち物を見る",
    skills: "能力を見る",
    missions: "任務を見る",
    rumors: "噂を見る",
    shop: "店を見る",
    chronicle: "記録を見る",
  };
  return labels[name] ?? "詳しく見る";
}

function renderGuidance(save) {
  const guidance = guidanceView(save);
  ui.guidance.hidden = !guidance;
  if (!guidance) {
    ui.guidance.removeAttribute("data-target-facility-id");
    return;
  }
  $("#guidanceKicker").textContent = escapeText(guidance.kicker, "現在の目的");
  $("#guidanceTitle").textContent = escapeText(guidance.title, "次の一歩");
  $("#guidanceDetail").textContent = escapeText(guidance.detail, guidance.targetFacilityName ? `${guidance.targetFacilityName}へ向かいましょう。` : "旅を続けましょう。");
  const deadline = $("#guidanceDeadline");
  deadline.textContent = escapeText(guidance.deadlineLabel, "");
  deadline.hidden = !deadline.textContent;
  const action = $("#guidanceAction");
  const targetPanel = panelName(guidance.actionPanel);
  action.hidden = !targetPanel;
  action.dataset.panel = targetPanel ?? "";
  action.dataset.targetFacilityId = escapeText(guidance.targetFacilityId, "");
  action.textContent = panelActionLabel(targetPanel);
  if (guidance.targetFacilityId) ui.guidance.dataset.targetFacilityId = guidance.targetFacilityId;
  else ui.guidance.removeAttribute("data-target-facility-id");
}

function clearTutorialEmphasis() {
  $$(".tutorial-emphasis").forEach((element) => element.classList.remove("tutorial-emphasis"));
}

function applyTutorialEmphasis(value) {
  clearTutorialEmphasis();
  const key = String(value ?? "").replace(/^panel:/u, "").trim();
  const selectors = {
    choices: "#choiceRegion",
    choice: "#choiceRegion",
    guidance: "#guidanceBar",
    movement: '[data-open-panel="movement"]',
    inventory: '[data-open-panel="inventory"]',
    skills: '[data-open-panel="skills"]',
    missions: '[data-open-panel="missions"]',
    rumors: '[data-open-panel="rumors"]',
    shop: '[data-open-panel="shop"]',
  };
  const selector = selectors[key];
  if (!selector) return;
  const visible = $$(selector).find((element) => !element.hidden && element.getClientRects().length > 0);
  if (visible) visible.classList.add("tutorial-emphasis");
}

function renderTutorial(tutorial) {
  const value = tutorial && typeof tutorial === "object" ? tutorial : null;
  const visible = Boolean(value && (value.title || value.body || value.actionLabel || value.progressLabel));
  ui.tutorial.hidden = !visible;
  clearTutorialEmphasis();
  if (!visible) return;
  $("#tutorialTitle").textContent = escapeText(value.title, "旅の案内");
  $("#tutorialBody").textContent = escapeText(value.body, "画面の案内に沿って、次の行動を選びましょう。");
  const progress = $("#tutorialProgress");
  progress.textContent = escapeText(value.progressLabel, "");
  progress.hidden = !progress.textContent;
  const action = $("#tutorialAction");
  const targetPanel = panelName(value.actionPanel);
  action.hidden = !(targetPanel || (value.acknowledgeable && value.id));
  action.textContent = escapeText(value.actionLabel, targetPanel ? panelActionLabel(targetPanel) : "わかった");
  action.dataset.panel = targetPanel ?? "";
  action.dataset.tutorialId = escapeText(value.id, "");
  action.dataset.acknowledgeable = String(Boolean(value.acknowledgeable && value.id));
  applyTutorialEmphasis(value.emphasisTarget);
}

function renderTutorialUnlocks(tutorial) {
  const controlledPanels = new Set(["movement", "missions", "shop", "skills"]);
  const unlocks = tutorial && tutorial.complete !== true && tutorial.unlocked && typeof tutorial.unlocked === "object"
    ? tutorial.unlocked
    : null;
  $$('[data-open-panel]').forEach((button) => {
    const name = panelName(button.dataset.openPanel);
    if (!controlledPanels.has(name)) return;
    const locked = Boolean(unlocks && unlocks[name] === false);
    if (locked) {
      if (button.dataset.tutorialLocked !== "true") {
        button.dataset.tutorialPreviousDisabled = String(button.disabled);
      }
      button.dataset.tutorialLocked = "true";
      button.dataset.lockLabel = "未解放";
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      button.title = "導入を進めると解放されます";
      button.classList.add("is-tutorial-locked");
      return;
    }
    if (button.dataset.tutorialLocked === "true") {
      button.disabled = button.dataset.tutorialPreviousDisabled === "true";
      delete button.dataset.tutorialLocked;
      delete button.dataset.tutorialPreviousDisabled;
      delete button.dataset.lockLabel;
      button.classList.remove("is-tutorial-locked");
      button.removeAttribute("title");
      if (button.disabled) button.setAttribute("aria-disabled", "true");
      else button.removeAttribute("aria-disabled");
    }
  });
}

function announceScene(save) {
  const clock = formatClock(save?.clock);
  const facility = escapeText(save?.scene?.facilityName || save?.scene?.location, "現在地");
  const outcome = save?.scene?.lastOutcome;
  const outcomeText = typeof outcome === "string" ? outcome : outcome?.summary || outcome?.message;
  const guidance = guidanceView(save);
  const parts = [`${clock.day} ${clock.time}、${facility}`];
  if (outcomeText) parts.push(escapeText(outcomeText));
  if (guidance?.title) parts.push(`現在の目的、${escapeText(guidance.title)}`);
  const announcement = `${parts.map((part) => String(part).replace(/[。．.]+$/gu, "")).join("。")}。`;
  ui.announcer.textContent = "";
  window.requestAnimationFrame(() => { ui.announcer.textContent = announcement; });
}

function renderPlayer(player = {}) {
  const gold = number(player.gold);
  const sp = number(player.sp);
  $("#playerDisplayName").textContent = escapeText(player.name, "旅人");
  $("#playerLevel").textContent = `Lv ${number(player.level, 1)}`;
  $("#playerGold").textContent = `${gold.toLocaleString("ja-JP")} G`;
  $("#mobileGold").textContent = `${gold.toLocaleString("ja-JP")} G`;
  $("#spBadge").textContent = sp;
  $("#mobileSpBadge").textContent = sp;
  $("#utilitySpBadge").textContent = sp;
  const hp = Math.max(0, Math.min(1, number(player.hpRatio, 1)));
  const mp = Math.max(0, Math.min(1, number(player.mpRatio, 1)));
  $("#hpBar").value = hp;
  $("#mpBar").value = mp;
  $("#hpText").textContent = formatPercent(hp);
  $("#mpText").textContent = formatPercent(mp);
  $("#mobileHpText").textContent = formatPercent(hp);
}

function renderSave(save, { focus = "preserve", announce = false } = {}) {
  currentSave = save;
  localStorage.setItem(LAST_SAVE_KEY, save.id);
  clearErrors();
  ui.launch.hidden = true;
  ui.game.hidden = false;

  const clock = formatClock(save.clock);
  const scene = save.scene ?? {};
  $("#dayLabel").textContent = clock.day;
  $("#timeLabel").textContent = clock.time;
  $("#daypartLabel").textContent = clock.daypart;
  $("#locationName").textContent = escapeText(scene.location, "未知の地域");
  $("#facilityName").textContent = escapeText(scene.facilityName, "移動中");
  $("#narrativeText").textContent = escapeText(scene.narrative, "静かな時間が流れている。");
  renderSpeeches(scene.speeches, scene.presentNpcs);
  const outcome = scene.lastOutcome;
  $("#lastOutcome").hidden = !outcome;
  $("#lastOutcome").textContent = typeof outcome === "string" ? outcome : escapeText(outcome?.summary || outcome?.message, "行動の結果が反映された。");
  const missionCount = activeStoryMissions(save).length;
  $("#missionBadge").textContent = missionCount;
  $("#mobileMissionBadge").textContent = missionCount;
  $("#utilityMissionBadge").textContent = missionCount;
  const rumorCount = list(save.rumors).length;
  $("#rumorBadge").textContent = rumorCount;
  $("#utilityRumorBadge").textContent = rumorCount;
  const saveStatus = escapeText(save.saveStatus, "saved");
  $("#saveIndicator").dataset.status = saveStatus;
  $("#saveIndicator").textContent = saveStatus === "saving" ? "保存中…" : saveStatus === "error" ? "保存エラー" : "保存済み";

  const backgroundKey = scene.backgroundKey || scene.facilityId || "default";
  ui.backdrop.dataset.backgroundKey = backgroundKey;
  const imageUrl = backgroundUrl(backgroundKey);
  ui.backdrop.style.backgroundImage = imageUrl ? `linear-gradient(180deg, rgba(7,12,9,.12), rgba(7,12,9,.84)), url(${JSON.stringify(imageUrl)})` : "";

  renderNpcs(scene.presentNpcs);
  renderChoices(save.choices, save.world?.ended === true);
  renderPlayer(save.player);
  renderGuidance(save);
  renderTutorial(save.tutorial);
  if (!busy) renderTutorialUnlocks(save.tutorial);
  if (ui.dialog.open) renderPanel(ui.dialog.dataset.panel);
  if (busy) disableBusyControls();
  if (announce) announceScene(save);
  if (focus !== "preserve") {
    window.requestAnimationFrame(() => {
      if (ui.dialog.open) {
        ui.dialogTitle.focus();
        return;
      }
      if (focus === "result" && !$("#lastOutcome").hidden) $("#lastOutcome").focus();
      else $("#sceneTitle").focus();
    });
  }
}

async function createGame(form) {
  if (busy) return;
  const formData = new FormData(form);
  const playerName = formData.get("playerName");
  setBusy(true, "旅の始まりを準備しています…");
  clearErrors();
  try {
    const result = await requestJson(`${API_BASE}/saves`, {
      method: "POST",
      body: JSON.stringify({ playerName }),
    });
    renderSave(result.save, { focus: "scene", announce: true });
  } catch (error) {
    showError(ui.launchError, error.message, () => createGame(form));
  } finally {
    setBusy(false);
  }
}

async function loadGame(id) {
  if (!id || busy) return;
  setBusy(true, "保存した旅を開いています…");
  clearErrors();
  try {
    const result = await requestJson(`${API_BASE}/saves/${encodeURIComponent(id)}`);
    renderSave(result.save, { focus: "scene", announce: true });
  } catch (error) {
    showError(ui.launchError, error.message, () => loadGame(id));
  } finally {
    setBusy(false);
  }
}

async function loadSaveList() {
  ui.saveListStatus.hidden = false;
  ui.saveListStatus.textContent = "保存データを確認しています…";
  ui.saveList.replaceChildren();
  clearErrors();
  try {
    const result = await requestJson(`${API_BASE}/saves`);
    const saves = list(result.saves);
    ui.saveListStatus.textContent = saves.length ? `${saves.length}件の旅があります。` : "この端末で再開できる旅はありません。";
    saves.forEach((save) => {
      const entry = document.createElement("div");
      entry.className = "save-entry";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "save-card";
      const clock = formatClock(save.clock);
      button.innerHTML = "<span><b></b><small></small></span><strong></strong>";
      $("b", button).textContent = escapeText(save.player?.name || save.playerName, "旅人");
      $("small", button).textContent = `${escapeText(save.scene?.location || save.location, "旅の途中")}・${clock.day} ${clock.time}`;
      $("strong", button).textContent = "再開 →";
      button.addEventListener("click", () => loadGame(save.id));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "save-delete";
      remove.textContent = "削除";
      remove.setAttribute("aria-label", `${escapeText(save.player?.name || save.playerName, "旅人")}の旅を削除`);
      remove.addEventListener("click", async () => {
        if (!window.confirm("この旅の保存データを削除します。元には戻せません。")) return;
        remove.disabled = true;
        try {
          await requestJson(`${API_BASE}/saves/${encodeURIComponent(save.id)}`, { method: "DELETE" });
          if (localStorage.getItem(LAST_SAVE_KEY) === save.id) localStorage.removeItem(LAST_SAVE_KEY);
          await loadSaveList();
        } catch (error) {
          remove.disabled = false;
          showError(ui.launchError, error.message, loadSaveList);
        }
      });
      entry.append(button, remove);
      ui.saveList.append(entry);
    });
  } catch (error) {
    ui.saveListStatus.textContent = "保存データを取得できませんでした。";
    showError(ui.launchError, error.message, loadSaveList);
  }
}

async function sendCommand(type, payload, commandId = crypto.randomUUID()) {
  if (!currentSave || busy) return false;
  setBusy(true);
  clearErrors();
  $("#saveIndicator").dataset.status = "saving";
  $("#saveIndicator").textContent = "保存中…";
  try {
    const result = await requestJson(`${API_BASE}/saves/${encodeURIComponent(currentSave.id)}/commands`, {
      method: "POST",
      body: JSON.stringify({
        commandId,
        expectedRevision: currentSave.revision,
        type,
        payload,
      }),
    });
    if (type === "MOVE" && ui.dialog.open) ui.dialog.close();
    renderSave(result.save, { focus: "result", announce: true });
    return true;
  } catch (error) {
    const code = error.data?.error;
    if (code === "revision_conflict") {
      showError(ui.gameError, "別の画面で旅が進んだようです。最新の状態を読み込みます。", () => loadGame(currentSave.id));
    } else if (code === "game_ended") {
      showError(ui.gameError, "100日間の旅は完結しています。最新の年代記を読み込んでください。", () => loadGame(currentSave.id));
    } else if (code === "tutorial_feature_locked") {
      showError(ui.gameError, "その機能はまだ案内されていません。画面中央の導入を進めてください。");
    } else if (code === "insufficient_gold") {
      showError(ui.gameError, "所持金が足りません。仕事や任務で資金を得てから購入できます。");
    } else if (code === "insufficient_sp") {
      showError(ui.gameError, "SPが足りません。レベルアップなどでSPを得てから取得できます。");
    } else {
      showError(ui.gameError, error.message, () => sendCommand(type, payload, commandId));
    }
    $("#saveIndicator").dataset.status = "error";
    $("#saveIndicator").textContent = "保存エラー";
    return false;
  } finally {
    setBusy(false);
  }
}

function emptyPanel(message) {
  const element = document.createElement("p");
  element.className = "empty-message";
  element.textContent = message;
  return element;
}

function actionButton(label, command, payload, disabled = false, accessibleName = label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "row-action";
  button.textContent = label;
  button.disabled = disabled || currentSave?.world?.ended === true;
  button.setAttribute("aria-label", accessibleName);
  button.dataset.command = command;
  const targetId = payload?.moveId || payload?.equipmentId || payload?.skillId || payload?.stockId || payload?.slot;
  if (targetId) button.dataset.targetId = targetId;
  button.addEventListener("click", () => sendCommand(command, payload));
  return button;
}

function movementName(move) {
  if ((move?.scope === "regional" || move?.scope === "region") && move?.destination) {
    const hub = escapeText(move.destination, "遠方の地域");
    const arrival = escapeText(move.destinationFacilityName || move.destinationName, "");
    return arrival && arrival !== hub ? `${hub}（到着：${arrival}）` : hub;
  }
  const explicit = move?.destinationFacilityName || move?.destinationName || move?.destination;
  if (explicit) return escapeText(explicit, "移動先");
  return escapeText(move?.label, "移動先")
    .replace(/\s*（(?:地域内|地域間)[^）]*）\s*$/u, "")
    .replace(/へ移動する\s*$/u, "");
}

function movementIsRegional(move) {
  return move?.scope === "regional" || move?.scope === "region";
}

function appendMovementRows(parent, entries, { recommended = false } = {}) {
  entries.forEach((move) => {
    const name = movementName(move);
    const minutes = number(move.minutes);
    const moveId = move.moveId || move.id;
    const row = document.createElement("div");
    row.className = `detail-row movement-row${recommended ? " is-recommended" : ""}`;
    const text = document.createElement("div");
    text.innerHTML = "<span class=\"movement-name-line\"><b></b><em hidden></em></span><small></small>";
    $("b", text).textContent = name;
    const tag = $("em", text);
    tag.hidden = !recommended;
    tag.textContent = "おすすめ";
    $("small", text).textContent = `${movementIsRegional(move) ? "遠方" : "村・街の中"}・${minutes > 0 ? `${minutes}分` : "時間消費なし"}`;
    row.append(text, actionButton(
      "移動",
      "MOVE",
      { moveId },
      !moveId,
      `${name}へ移動（${minutes > 0 ? `${minutes}分` : "時間消費なし"}）`,
    ));
    parent.append(row);
  });
}

function renderMovement() {
  const moves = list(currentSave?.movement).slice();
  if (!moves.length) return ui.dialogBody.append(emptyPanel("今いる場所から選べる移動先はありません。"));
  const targetFacilityId = ui.dialog.dataset.targetFacilityId
    || guidanceView(currentSave)?.targetFacilityId
    || "";
  const isRecommended = (move) => Boolean(move.recommended)
    || Boolean(targetFacilityId && (move.destinationFacilityId || move.targetFacilityId) === targetFacilityId);
  const sorter = (left, right) => Number(!isRecommended(left)) - Number(!isRecommended(right))
    || number(left.minutes, 9999) - number(right.minutes, 9999)
    || movementName(left).localeCompare(movementName(right), "ja");
  moves.sort(sorter);
  const recommended = moves.filter(isRecommended);
  const recommendedSet = new Set(recommended);
  const local = moves.filter((move) => !recommendedSet.has(move) && !movementIsRegional(move));
  const regional = moves.filter((move) => !recommendedSet.has(move) && movementIsRegional(move));

  if (recommended.length) {
    const section = document.createElement("section");
    section.className = "detail-section movement-recommended";
    section.innerHTML = "<h3>現在の目的におすすめ</h3>";
    appendMovementRows(section, recommended, { recommended: true });
    ui.dialogBody.append(section);
  }
  if (local.length) {
    const section = document.createElement("section");
    section.className = "detail-section";
    section.innerHTML = "<h3>村・街の中</h3>";
    appendMovementRows(section, local);
    ui.dialogBody.append(section);
  }
  if (regional.length) {
    const details = document.createElement("details");
    details.className = "detail-disclosure movement-regional";
    const summary = document.createElement("summary");
    summary.textContent = `遠方の地域を見る（${regional.length}件）`;
    const body = document.createElement("div");
    body.className = "disclosure-body";
    appendMovementRows(body, regional);
    details.append(summary, body);
    ui.dialogBody.append(details);
  }
}

function inventoryEntries(player) {
  const inventory = player?.inventory ?? {};
  if (Array.isArray(inventory)) return inventory;
  return Object.entries(inventory).flatMap(([group, entries]) => {
    if (Array.isArray(entries)) return entries.map((entry) => ({ group, ...entry }));
    if (entries && typeof entries === "object") return Object.entries(entries).map(([id, value]) => typeof value === "object" ? { group, id, ...value } : { group, id, quantity: value });
    return [];
  });
}

function renderInventory() {
  const player = currentSave.player ?? {};
  const equipment = player.equipment ?? {};
  const equippedIds = new Set(Object.values(equipment).map((item) => typeof item === "object" ? item.id : item).filter(Boolean));
  const equipSection = document.createElement("section");
  equipSection.className = "detail-section equipment-grid";
  equipSection.innerHTML = "<h3>装備中</h3>";
  const slotNames = { mainHand: "武器", offHand: "副装備", body: "防具", accessory: "装飾品" };
  Object.entries(slotNames).forEach(([slot, name]) => {
    const value = equipment[slot];
    const itemName = typeof value === "object" ? value.name : value;
    const row = document.createElement("div");
    row.className = "detail-row";
    row.innerHTML = `<div><small>${name}</small><b></b></div>`;
    $("b", row).textContent = escapeText(itemName, "装備なし");
    if (value) row.append(actionButton("外す", "UNEQUIP", { slot }, false, `${escapeText(itemName, name)}を外す`));
    equipSection.append(row);
  });
  ui.dialogBody.append(equipSection);

  const entries = inventoryEntries(player);
  const itemSection = document.createElement("section");
  itemSection.className = "detail-section";
  itemSection.innerHTML = "<h3>所持品</h3>";
  if (!entries.length) itemSection.append(emptyPanel("持ち物はありません。"));
  entries.forEach((item) => {
    const row = document.createElement("div");
    row.className = "detail-row";
    const text = document.createElement("div");
    text.innerHTML = "<b></b><small></small>";
    $("b", text).textContent = escapeText(item.name || item.id, "名称不明");
    $("small", text).textContent = `所持 ${number(item.quantity ?? item.count, 1)}`;
    row.append(text);
    const equipmentLike = item.group === "equipment" || item.kind === "equipment" || item.slot;
    const equipmentId = item.equipmentId || item.id;
    if (equipmentLike && equipmentId && !equippedIds.has(equipmentId)) {
      row.append(actionButton("装備", "EQUIP", { equipmentId }, false, `${escapeText(item.name || equipmentId, "装備品")}を装備`));
    }
    itemSection.append(row);
  });
  ui.dialogBody.append(itemSection);
}

function skillEntry(skill, status) {
  if (typeof skill === "string") skill = { id: skill, name: skill };
  if (!skill || typeof skill !== "object") skill = {};
  const row = document.createElement("div");
  row.className = `skill-row is-${status}`;
  if (skill.recommended === true) row.classList.add("is-recommended");
  const text = document.createElement("div");
  text.innerHTML = "<span class=\"skill-name-line\"><b></b><em hidden></em></span><p></p><small class=\"skill-equipment\" hidden></small><small class=\"skill-cost\"></small>";
  $("b", text).textContent = escapeText(skill.name || skill.id, "名称不明のスキル");
  const recommendation = $("em", text);
  recommendation.hidden = skill.recommended !== true;
  recommendation.textContent = "今の装備におすすめ";
  const description = escapeText(skill.description, status === "learned" ? "取得済み" : "説明はまだありません。");
  $("p", text).textContent = skill.recommended && skill.recommendationReason
    ? `${description} ${escapeText(skill.recommendationReason)}`
    : description;
  const equipment = $(".skill-equipment", text);
  equipment.textContent = escapeText(skill.equipmentNote, skill.usableNow === false ? "現在の装備では使用できません。" : "");
  equipment.hidden = !equipment.textContent;
  const lockLabels = {
    insufficient_level: "必要なレベルに達していません",
    insufficient_sp: "SPが不足しています",
    missing_prerequisites: "先に取得するスキルがあります",
    event_unlock_conditions_unmet: "物語上の条件を満たしていません",
    learn_conditions_unmet: "取得条件を満たしていません",
    not_visible: "まだ発見していません",
  };
  const rawReason = skill.lockReason || skill.reasonLabel || skill.requirement;
  $(".skill-cost", text).textContent = status === "locked"
    ? lockLabels[rawReason] ?? escapeText(rawReason, "取得条件を満たしていません")
    : status === "learned" ? "取得済み" : `必要SP ${number(skill.spCost ?? skill.cost)}`;
  row.append(text);
  const skillId = skill.skillId || skill.id;
  if (status === "learnable" && skillId) {
    row.append(actionButton(
      "取得",
      "LEARN_SKILL",
      { skillId },
      number(currentSave.player?.sp) < number(skill.spCost ?? skill.cost),
      `${escapeText(skill.name || skillId, "スキル")}を取得`,
    ));
  }
  return row;
}

function renderSkills() {
  const player = currentSave?.player ?? {};
  const exp = number(player.exp);
  const next = Math.max(1, number(player.nextLevelExp, 1));
  const status = document.createElement("section");
  status.className = "character-card";
  const stats = player.stats ?? {};
  status.innerHTML = `<div><span>LEVEL</span><b>${number(player.level, 1)}</b></div><div><span>EXP</span><b>${exp} / ${next}</b><progress max="${next}" value="${Math.min(exp, next)}" aria-label="次のレベルまでの経験値"></progress></div><div><span>SP</span><b>${number(player.sp)}</b></div>`;
  ui.dialogBody.append(status);
  const intro = document.createElement("p");
  intro.className = "skill-intro";
  intro.textContent = "SPはスキルポイントです。必要SPを消費すると、新しい能力を取得できます。";
  ui.dialogBody.append(intro);
  const statGrid = document.createElement("div");
  statGrid.className = "stat-grid";
  const labels = { attack: "攻撃", defense: "防御", agility: "敏捷", luck: "幸運", magic: "魔力", vitality: "体力" };
  Object.entries(stats).forEach(([key, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<span>${labels[key] || key}</span><b>${number(value)}</b>`;
    statGrid.append(item);
  });
  ui.dialogBody.append(statGrid);
  const skills = currentSave?.skills ?? {};
  const learnable = list(skills.learnable);
  const recommended = learnable.filter((skill) => skill?.recommended === true);
  const otherLearnable = learnable.filter((skill) => skill?.recommended !== true);
  const visibleSections = [
    ...(recommended.length ? [["今の装備におすすめ", "learnable", recommended]] : []),
    ["そのほかの取得可能スキル", "learnable", otherLearnable],
    ["取得済み", "learned", list(skills.learned)],
  ];
  visibleSections.forEach(([title, key, entries]) => {
    const section = document.createElement("section");
    section.className = `detail-section${title === "今の装備におすすめ" ? " skill-recommended-section" : ""}`;
    section.innerHTML = `<h3>${title} <small>${entries.length}</small></h3>`;
    if (!entries.length) section.append(emptyPanel(`${title}のスキルはありません。`));
    entries.forEach((skill) => section.append(skillEntry(skill, key)));
    ui.dialogBody.append(section);
  });
  const locked = list(skills.locked);
  const details = document.createElement("details");
  details.className = "detail-disclosure skill-locked-group";
  const summary = document.createElement("summary");
  summary.textContent = `条件を満たすと取得できるスキル（${locked.length}件）`;
  const body = document.createElement("div");
  body.className = "disclosure-body";
  if (!locked.length) body.append(emptyPanel("条件未達のスキルはありません。"));
  locked.forEach((skill) => body.append(skillEntry(skill, "locked")));
  details.append(summary, body);
  ui.dialogBody.append(details);
}

function missionStatus(status) {
  const labels = {
    active: "進行中",
    available: "開始可能",
    in_progress: "進行中",
    completed: "完了",
    resolved: "解決済み",
    failed: "失敗",
  };
  return { key: Object.hasOwn(labels, status) ? status : "unknown", label: labels[status] ?? "状態不明" };
}

function missionArticle(mission) {
  const state = missionStatus(mission?.status);
  const article = document.createElement("article");
  article.className = `mission-card is-${state.key}`;
  article.innerHTML = "<div class=\"mission-title\"><span></span><small></small></div><h3></h3><p class=\"mission-next\"></p><ul class=\"mission-meta\"></ul><div class=\"mission-progress-row\"><progress max=\"1\" value=\"0\"></progress><span></span></div><div class=\"mission-actions\"></div>";
  $(".mission-title span", article).textContent = mission?.kind === "permanent" ? "長期目標" : "物語任務";
  $(".mission-title small", article).textContent = state.label;
  const title = escapeText(mission?.title || mission?.name, "名もなき任務");
  $("h3", article).textContent = title;
  const step = mission?.currentStep;
  const stepLabel = typeof step === "object" && step !== null ? step.label : step;
  const terminalText = mission?.status === "failed"
    ? "結末：期限までに解決できず、危機の結果が世界に残った"
    : ["completed", "resolved"].includes(mission?.status)
      ? "結末：この任務は完了し、選択の結果が世界に反映された"
      : null;
  $(".mission-next", article).textContent = terminalText
    ?? `次の行動：${escapeText(stepLabel || mission?.description, "手がかりを探す")}`;
  const targetFacilityId = typeof step === "object" && step !== null ? step.targetFacilityId : mission?.targetFacilityId;
  const facilityName = targetFacilityName(
    targetFacilityId,
    typeof step === "object" && step !== null ? step.targetFacilityName : mission?.targetFacilityName,
  );
  const targetLocation = typeof step === "object" && step !== null
    ? step.targetLocation || mission?.targetLocation || mission?.location
    : mission?.targetLocation || mission?.location;
  const deadline = escapeText(mission?.deadlineLabel, mission?.deadlineDay ? `期限 Day ${mission.deadlineDay}` : "");
  const meta = $(".mission-meta", article);
  const knownClues = list(mission?.knownClues)
    .map((clue) => escapeText(clue?.text, ""))
    .filter(Boolean)
    .map((text) => `手掛かり：${text}`);
  [facilityName ? `目的施設：${facilityName}` : targetLocation ? `地域：${targetLocation}` : "", deadline, ...knownClues].filter(Boolean).forEach((label) => {
    const item = document.createElement("li");
    item.textContent = label;
    meta.append(item);
  });
  meta.hidden = meta.childElementCount === 0;
  const progress = Math.max(0, Math.min(1, number(mission?.progressRatio, mission?.complete ? 1 : 0)));
  const progressElement = $("progress", article);
  progressElement.value = progress;
  progressElement.setAttribute("aria-label", `${title}の進捗`);
  $(".mission-progress-row span", article).textContent = `${Math.round(progress * 100)}%`;
  const currentFacilityId = currentSave?.scene?.facilityId;
  if (targetFacilityId && targetFacilityId !== currentFacilityId && ["active", "available", "in_progress"].includes(mission?.status)) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "row-action";
    action.textContent = "移動先を見る";
    action.setAttribute("aria-label", `${facilityName || "任務の目的地"}への移動先を見る`);
    action.addEventListener("click", () => openPanel("movement", { targetFacilityId }));
    $(".mission-actions", article).append(action);
  }
  return article;
}

function appendMissionSection(title, missions, { disclosure = false } = {}) {
  if (disclosure) {
    const details = document.createElement("details");
    details.className = "detail-disclosure mission-group";
    const summary = document.createElement("summary");
    summary.textContent = `${title}（${missions.length}件）`;
    const body = document.createElement("div");
    body.className = "disclosure-body";
    missions.forEach((mission) => body.append(missionArticle(mission)));
    details.append(summary, body);
    ui.dialogBody.append(details);
    return;
  }
  const section = document.createElement("section");
  section.className = "detail-section mission-group";
  const heading = document.createElement("h3");
  heading.textContent = `${title} ${missions.length}`;
  section.append(heading);
  if (!missions.length) section.append(emptyPanel("進行中の物語任務はありません。人に話しかけたり、噂を調べたりしてみましょう。"));
  missions.forEach((mission) => section.append(missionArticle(mission)));
  ui.dialogBody.append(section);
}

function renderMissions() {
  const missions = list(currentSave?.missions).slice();
  if (!missions.length) return ui.dialogBody.append(emptyPanel("受注・発見した任務はありません。人に話しかけたり、周囲を調べたりしてみましょう。"));
  const statusRank = (mission) => ["active", "available", "in_progress"].includes(mission?.status) ? 0 : 1;
  missions.sort((left, right) => statusRank(left) - statusRank(right)
    || number(left.deadlineDay, 999) - number(right.deadlineDay, 999)
    || String(left.id ?? "").localeCompare(String(right.id ?? "")));
  const story = missions.filter((mission) => mission.kind !== "permanent");
  const permanent = missions.filter((mission) => mission.kind === "permanent");
  appendMissionSection("物語任務", story);
  if (permanent.length) appendMissionSection("長期目標", permanent, { disclosure: true });
}

function renderRumors() {
  const rumors = list(currentSave.rumors);
  if (!rumors.length) return ui.dialogBody.append(emptyPanel("知っている噂はまだありません。人に話しかけたり、周囲を調べたりしてみましょう。"));
  rumors.forEach((rumor) => {
    const article = document.createElement("article");
    article.className = "rumor-card";
    article.innerHTML = "<span>RUMOR</span><h3></h3><p></p><small></small>";
    $("h3", article).textContent = escapeText(rumor.title || rumor.name, "耳にした話");
    $("p", article).textContent = escapeText(rumor.text || rumor.description, "内容はまだ曖昧だ。");
    $("small", article).textContent = [rumor.source, rumor.learnedAt, rumor.location].filter(Boolean).join(" ・ ") || "出所不明";
    ui.dialogBody.append(article);
  });
}

function renderShop() {
  const shop = currentSave.shop ?? {};
  if (!shop.available) return ui.dialogBody.append(emptyPanel("この施設では買い物ができません。店のある施設へ移動してください。"));
  const banner = document.createElement("div");
  banner.className = "shop-banner";
  banner.innerHTML = "<span>所持金</span><b></b><small></small>";
  $("b", banner).textContent = `${number(currentSave.player?.gold).toLocaleString("ja-JP")} G`;
  $("small", banner).textContent = escapeText(shop.facilityName, "店舗");
  ui.dialogBody.append(banner);
  const owned = inventoryEntries(currentSave.player).filter((item) => item.group === "equipment" || item.kind === "equipment" || item.slot);
  const equippedIds = new Set(Object.values(currentSave.player?.equipment ?? {}).map((item) => typeof item === "object" ? item.id : item));
  const ownedQuantity = new Map(owned.map((item) => [item.equipmentId || item.id, number(item.quantity ?? item.count, 1)]));
  const saleQuoteById = new Map(list(shop.saleQuotes).map((quote) => [quote.equipmentId, quote]));
  const stock = list(shop.stock);
  if (!stock.length) ui.dialogBody.append(emptyPanel("現在購入できる商品はありません。"));
  stock.forEach((item) => {
    const row = document.createElement("div");
    row.className = "shop-row";
    const text = document.createElement("div");
    text.innerHTML = "<b></b><p></p><small></small>";
    $("b", text).textContent = escapeText(item.name || item.equipmentName || item.id, "名称不明の商品");
    const equipment = item.equipment ?? {};
    const performance = [
      number(equipment.physicalPower) ? `物理 ${number(equipment.physicalPower)}` : "",
      number(equipment.magicPower) ? `魔導 ${number(equipment.magicPower)}` : "",
      number(equipment.defense) ? `防御 ${number(equipment.defense)}` : "",
    ].filter(Boolean).join(" / ");
    $("p", text).textContent = escapeText(item.description, [item.slot ? `装備部位: ${item.slot}` : "", performance].filter(Boolean).join(" ・ "));
    const equipmentId = item.equipmentId || item.id;
    const inventoryNote = ownedQuantity.has(equipmentId)
      ? ` ・ 所持 ${ownedQuantity.get(equipmentId)}${equippedIds.has(equipmentId) ? "（装備中）" : ""}`
      : "";
    const unlimited = item.unlimited === true || item.quantity == null;
    $("small", text).textContent = `${unlimited ? "在庫 ∞" : `在庫 ${number(item.quantity, 1)}`}${inventoryNote}`;
    const price = number(item.price);
    const itemName = escapeText(item.name || item.equipmentName || item.id, "商品");
    row.append(text, actionButton(
      `${price.toLocaleString("ja-JP")} G`,
      "SHOP_BUY",
      { stockId: item.stockId || item.id },
      price > number(currentSave.player?.gold),
      `${itemName}を${price.toLocaleString("ja-JP")}Gで購入`,
    ));
    ui.dialogBody.append(row);
  });
  const sellSection = document.createElement("section");
  sellSection.className = "detail-section";
  sellSection.innerHTML = "<h3>売却</h3>";
  if (!owned.length) sellSection.append(emptyPanel("売却できる装備はありません。"));
  owned.forEach((item) => {
    const row = document.createElement("div");
    row.className = "detail-row";
    row.innerHTML = "<div><b></b><small></small></div>";
    const equipmentId = item.equipmentId || item.id;
    const quote = saleQuoteById.get(equipmentId);
    const sellPrice = quote?.price == null ? null : number(quote.price);
    $("b", row).textContent = escapeText(item.name || equipmentId);
    $("small", row).textContent = [
      `所持 ${number(item.quantity ?? item.count, 1)}`,
      equippedIds.has(equipmentId) ? "装備中は売却できません" : quote?.available === false ? "この店では買い取れません" : "",
    ].filter(Boolean).join(" ・ ");
    row.append(actionButton(
      sellPrice == null ? "売却不可" : `${sellPrice.toLocaleString("ja-JP")} Gで売却`,
      "SHOP_SELL",
      { equipmentId },
      !equipmentId || quote?.available !== true,
      sellPrice == null
        ? `${escapeText(item.name || equipmentId, "装備品")}はこの店で売却できません`
        : `${escapeText(item.name || equipmentId, "装備品")}を${sellPrice.toLocaleString("ja-JP")}Gで売却`,
    ));
    sellSection.append(row);
  });
  ui.dialogBody.append(sellSection);
}

function renderChronicle() {
  const entries = list(currentSave.chronicle);
  if (!entries.length) return ui.dialogBody.append(emptyPanel("旅の記録はまだありません。"));
  const timeline = document.createElement("ol");
  timeline.className = "chronicle-list";
  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.innerHTML = "<time></time><p></p>";
    $("time", item).textContent = escapeText(entry.time || entry.clock, entry.day ? `Day ${entry.day}` : "記録");
    $("p", item).textContent = escapeText(entry.text || entry.summary || entry.message, "出来事があった。");
    timeline.append(item);
  });
  ui.dialogBody.append(timeline);
}

const panelMeta = {
  movement: ["WORLD MAP", "地域と施設の移動", renderMovement],
  inventory: ["BELONGINGS", "持ち物と装備", renderInventory],
  skills: ["CHARACTER", "能力とスキル", renderSkills],
  missions: ["MISSIONS", "ミッション一覧", renderMissions],
  rumors: ["RUMORS", "知っている噂", renderRumors],
  shop: ["SHOP", "購入・売却", renderShop],
  chronicle: ["CHRONICLE", "これまでの記録", renderChronicle],
};

function renderPanel(name) {
  const normalized = panelName(name) ?? "chronicle";
  const meta = panelMeta[normalized];
  ui.dialog.dataset.panel = normalized;
  ui.dialogKicker.textContent = meta[0];
  ui.dialogTitle.textContent = meta[1];
  ui.dialogBody.replaceChildren();
  meta[2]();
  if (busy) disableBusyControls();
}

function openPanel(name, { targetFacilityId = "" } = {}) {
  if (!currentSave) return;
  const normalized = panelName(name) ?? "chronicle";
  if (normalized === "movement" && targetFacilityId) ui.dialog.dataset.targetFacilityId = targetFacilityId;
  else ui.dialog.removeAttribute("data-target-facility-id");
  renderPanel(normalized);
  if (!ui.dialog.open) ui.dialog.showModal();
  ui.dialogTitle.focus();
}

async function loadManifest() {
  try {
    const response = await fetch("/TRPG/assets/manifest.json", { cache: "no-store" });
    if (response.ok) assetManifest = await response.json();
  } catch {
    assetManifest = { backgrounds: {}, portraits: {} };
  }
}

ui.newTab.addEventListener("click", () => switchLaunchTab("new"));
ui.resumeTab.addEventListener("click", () => switchLaunchTab("resume"));
$(".launch-tabs").addEventListener("keydown", (event) => {
  const tabs = [ui.newTab, ui.resumeTab];
  const current = tabs.indexOf(event.target);
  if (current < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0
    : event.key === "End" ? tabs.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  switchLaunchTab(next === 0 ? "new" : "resume", { focusPanel: false });
  tabs[next].focus();
});
ui.newForm.addEventListener("submit", (event) => { event.preventDefault(); createGame(event.currentTarget); });
$("#refreshSaves").addEventListener("click", loadSaveList);
$("#returnToTitle").addEventListener("click", () => {
  if (ui.dialog.open) ui.dialog.close();
  ui.game.hidden = true;
  ui.launch.hidden = false;
  switchLaunchTab("resume");
});
$("#closeDialog").addEventListener("click", () => ui.dialog.close());
ui.dialog.addEventListener("click", (event) => {
  if (event.target === ui.dialog) ui.dialog.close();
});
ui.dialog.addEventListener("close", () => ui.dialog.removeAttribute("data-target-facility-id"));
$("#openChronicle").addEventListener("click", () => openPanel("chronicle"));
$$('[data-open-panel]').forEach((button) => button.addEventListener("click", () => openPanel(button.dataset.openPanel)));
$("#guidanceAction").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const name = panelName(button.dataset.panel);
  if (name) openPanel(name, { targetFacilityId: button.dataset.targetFacilityId });
});
$("#tutorialAction").addEventListener("click", async (event) => {
  if (busy) return;
  const button = event.currentTarget;
  const name = panelName(button.dataset.panel);
  const tutorialId = button.dataset.tutorialId;
  const acknowledgeable = button.dataset.acknowledgeable === "true";
  if (acknowledgeable && tutorialId) {
    const acknowledged = await sendCommand("TUTORIAL_ACK", { tutorialId });
    if (!acknowledged) return;
  }
  if (name) {
    const targetFacilityId = name === "movement" ? guidanceView(currentSave)?.targetFacilityId : "";
    openPanel(name, { targetFacilityId });
  }
});

document.addEventListener("keydown", (event) => {
  if (busy || ui.game.hidden || ui.dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
  if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/u.test(document.activeElement?.tagName)) return;
  const index = Number(event.key) - 1;
  const choices = $$(".choice-button", ui.choices);
  if (index >= 0 && index < choices.length) {
    event.preventDefault();
    choices[index].click();
  }
});

await loadManifest();
const lastSaveId = localStorage.getItem(LAST_SAVE_KEY);
if (lastSaveId) {
  switchLaunchTab("resume", { focusPanel: false });
} else {
  $("#playerName").focus();
}
