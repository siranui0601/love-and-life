const API_BASE = "/TRPG/api/game";
const LAST_SAVE_KEY = "trpg:last-save-id";
const REQUEST_TIMEOUT = 30000;
const ASSET_REFRESH_DELAYS = Object.freeze([2500, 5000, 10000, 20000, 40000, 60000, 60000, 60000, 60000]);
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
  decision: $("#decisionTray"),
  dialogue: $("#dialogueAdvance"),
  dialogueSpeaker: $("#dialogueSpeaker"),
  dialogueLine: $("#dialogueLine"),
  outcome: $("#outcomeToast"),
  guidance: $("#guidanceBar"),
  tutorial: $("#tutorialCard"),
  announcer: $("#sceneAnnouncer"),
  quickMenu: $("#quickMenu"),
  dialog: $("#detailDialog"),
  dialogError: $("#dialogError"),
  dialogTitle: $("#dialogTitle"),
  dialogKicker: $("#dialogKicker"),
  dialogBody: $("#dialogBody"),
  battleDialog: $("#battleDialog"),
  battleScene: $("#battleScene"),
  battleEnemies: $("#battleEnemies"),
  battleStatus: $("#battleStatus"),
  battleMessage: $("#battleMessage"),
  battleError: $("#battleError"),
  battlePlaybackControls: $("#battlePlaybackControls"),
  battleCommandPanel: $("#battleCommandPanel"),
  battleCommandPrompt: $("#battleCommandPrompt"),
  battleCommandMenu: $("#battleCommandMenu"),
};

let currentSave = null;
let assetManifest = { backgrounds: {}, portraits: {}, monsters: {} };
let busy = false;
let scenePlayback = null;
let battlePlayback = null;
let interactiveBattleState = null;
let lastPresentedBattleKey = "";
let outcomeTimer = null;
let assetRefreshTimer = null;
let assetRefreshToken = 0;
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
  $$('button, input, select, textarea', ui.battleDialog).forEach((element) => {
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
  ui.battleDialog.setAttribute("aria-busy", String(value));
  if (value) {
    disableBusyControls();
    return;
  }
  busyDisabledState.forEach((wasDisabled, element) => {
    if (element.isConnected) element.disabled = wasDisabled;
  });
  busyDisabledState.clear();
  if (currentSave) {
    renderTutorialUnlocks(currentSave.tutorial);
    window.requestAnimationFrame(positionTutorialCoach);
    if (currentSave.battle?.status === "active") {
      window.requestAnimationFrame(() => $("button:not(:disabled)", ui.battleCommandMenu)?.focus());
    }
  }
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
  ui.dialogError.hidden = true;
  ui.battleError.hidden = true;
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

function monsterUrl(actor) {
  const entry = assetManifest.monsters?.[actor.actorId] ?? assetManifest.monsters?.[actor.id];
  const url = typeof entry === "string" ? entry : entry?.src ?? entry?.default;
  return validAssetUrl(url) ? url : null;
}

function activeSceneActorId() {
  if (!scenePlayback) return null;
  if (!scenePlayback.done) return scenePlayback.beats[scenePlayback.index]?.actorId ?? null;
  return [...scenePlayback.beats].reverse().find((beat) => beat.actorId)?.actorId ?? null;
}

function visibleAssetsMissing(save = currentSave) {
  if (!save) return false;
  const scene = save.scene ?? {};
  const backgroundKey = scene.backgroundKey || scene.facilityId || "default";
  if (!backgroundUrl(backgroundKey)) return true;
  if (list(scene.presentNpcs).some((npc) => !portraitUrl(npc))) return true;
  return list(save.battle?.actors).some((actor) => actor.side === "enemy" && !monsterUrl(actor));
}

function applyVisibleAssets() {
  if (!currentSave) return;
  const scene = currentSave.scene ?? {};
  const backgroundKey = scene.backgroundKey || scene.facilityId || "default";
  const imageUrl = backgroundUrl(backgroundKey);
  ui.backdrop.style.backgroundImage = imageUrl ? `url(${JSON.stringify(imageUrl)})` : "";
  renderNpcs(scene.presentNpcs, activeSceneActorId());
  if (currentSave.battle?.status === "active" && ui.battleDialog.open) {
    renderBattleActors(new Map(list(currentSave.battle.actors).map((actor) => [actor.instanceId, { ...actor }])));
  } else if (battlePlayback && ui.battleDialog.open) {
    renderBattlePage();
  }
}

function scheduleAssetRefresh(save = currentSave) {
  assetRefreshToken += 1;
  const token = assetRefreshToken;
  if (assetRefreshTimer) window.clearTimeout(assetRefreshTimer);
  assetRefreshTimer = null;
  if (!visibleAssetsMissing(save)) return;
  let attempt = 0;
  const refresh = async () => {
    if (token !== assetRefreshToken || currentSave?.id !== save?.id) return;
    const changed = await loadManifest();
    if (token !== assetRefreshToken) return;
    if (changed) applyVisibleAssets();
    if (!visibleAssetsMissing() || attempt >= ASSET_REFRESH_DELAYS.length) return;
    assetRefreshTimer = window.setTimeout(refresh, ASSET_REFRESH_DELAYS[attempt++]);
  };
  assetRefreshTimer = window.setTimeout(refresh, ASSET_REFRESH_DELAYS[attempt++]);
}

function renderNpcs(npcs, activeActorId = null) {
  ui.npcStage.replaceChildren();
  const entries = list(npcs).slice(0, 5);
  ui.npcStage.dataset.count = String(entries.length);
  const visibleActorId = activeActorId || "";
  entries.forEach((npc, index) => {
    const card = document.createElement("article");
    card.className = `npc-card${npc.id === visibleActorId ? " is-active" : ""}`;
    card.dataset.npcId = npc.id;
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

function setActiveNpc(actorId) {
  const cards = $$(".npc-card", ui.npcStage);
  const activeId = actorId && cards.some((card) => card.dataset.npcId === actorId) ? actorId : "";
  cards.forEach((card) => card.classList.toggle("is-active", card.dataset.npcId === activeId));
}

function renderChoices(choices, ended = false) {
  ui.choices.replaceChildren();
  const entries = list(choices).slice(0, 3);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-message";
    const message = document.createElement("p");
    message.textContent = ended
      ? "100日間の旅は完結しました。あなたの選択が残した結果を振り返れます。"
      : "選択肢を準備できませんでした。最新の状態を読み込んでください。";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "choice-button ending-choice";
    const marker = document.createElement("span");
    marker.className = "choice-number";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = ended ? "終" : "↻";
    const label = document.createElement("span");
    label.className = "choice-label";
    label.textContent = ended ? "旅の年代記を見る" : "最新の状態を読み込む";
    action.append(marker, label);
    action.addEventListener("click", () => {
      if (ended) openPanelFromUi("chronicle");
      else loadGame(currentSave.id);
    });
    empty.append(message, action);
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

function segmentJapaneseText(value, maxLength = 62) {
  const text = escapeText(value, "").replace(/\s+/gu, " ").trim();
  if (!text) return [];
  const sentences = text.match(/[^。！？!?]+[。！？!?]?/gu) ?? [text];
  const segments = [];
  let current = "";
  const push = (chunk) => {
    let rest = chunk.trim();
    while (rest.length > maxLength) {
      const window = rest.slice(0, maxLength + 1);
      const breakAt = Math.max(window.lastIndexOf("、"), window.lastIndexOf("，"), window.lastIndexOf(" "));
      const length = breakAt >= Math.floor(maxLength * .55) ? breakAt + 1 : maxLength;
      segments.push(rest.slice(0, length).trim());
      rest = rest.slice(length).trim();
    }
    if (rest) segments.push(rest);
  };
  sentences.forEach((sentence) => {
    const candidate = `${current}${sentence}`;
    if (candidate.length <= maxLength) current = candidate;
    else {
      if (current) push(current);
      current = sentence;
    }
  });
  if (current) push(current);
  return segments;
}

function buildSceneBeats(save) {
  const scene = save?.scene ?? {};
  const npcById = new Map(list(scene.presentNpcs).map((npc) => [npc.id, npc]));
  const ordered = list(scene.beats);
  if (ordered.length) {
    const beats = [];
    ordered.forEach((beat) => {
      const speaker = beat.kind === "player"
        ? escapeText(beat.speakerLabel, "あなた")
        : beat.actorId
          ? escapeText(beat.speakerLabel || npcById.get(beat.actorId)?.name, "")
          : escapeText(beat.speakerLabel, "");
      const segments = segmentJapaneseText(beat.text, window.matchMedia("(max-width: 700px)").matches ? 42 : 58);
      const introductionToken = escapeText(beat.introductionToken ?? beat.introduction?.token, "");
      segments.forEach((text, index) => beats.push({
        type: beat.kind === "npc" || beat.kind === "player" ? "speech" : "narration",
        actorId: beat.actorId ?? null,
        speaker,
        text,
        // Recognition is acknowledged only after the complete authored/model
        // speech has actually been shown, never when an earlier split appears.
        introductionToken: introductionToken && index === segments.length - 1 ? introductionToken : null,
      }));
    });
    if (beats.length) return beats;
  }
  const beats = segmentJapaneseText(scene.narrative, 62).map((text) => ({
    type: "narration",
    actorId: null,
    speaker: "",
    text,
  }));
  list(scene.speeches).forEach((speech) => {
    segmentJapaneseText(speech.text, 58).forEach((text) => beats.push({
      type: "speech",
      actorId: speech.actorId,
      speaker: escapeText(npcById.get(speech.actorId)?.name, ""),
      text,
    }));
  });
  if (!beats.length) beats.push({ type: "narration", actorId: null, speaker: "", text: "静かな時間が流れている。" });
  return beats;
}

function startScenePlayback(save, { preserve = false } = {}) {
  const key = `${save.id}:${save.revision}`;
  if (scenePlayback?.key === key) {
    renderScenePlayback();
    return;
  }
  const previous = preserve ? scenePlayback : null;
  const beats = buildSceneBeats(save);
  scenePlayback = {
    key,
    beats,
    index: previous ? Math.min(previous.index, beats.length - 1) : 0,
    done: Boolean(previous?.done),
  };
  renderScenePlayback();
}

function renderScenePlayback() {
  if (!scenePlayback) return;
  if (scenePlayback.done) {
    ui.dialogue.hidden = true;
    ui.decision.hidden = list(currentSave?.choices).length === 0 && currentSave?.world?.ended !== true;
    const lastSpeaker = [...scenePlayback.beats].reverse().find((beat) => beat.actorId)?.actorId;
    setActiveNpc(lastSpeaker);
  } else {
    const beat = scenePlayback.beats[scenePlayback.index];
    ui.dialogue.hidden = false;
    ui.decision.hidden = true;
    ui.dialogueSpeaker.hidden = !beat.speaker;
    ui.dialogueSpeaker.textContent = beat.speaker;
    ui.dialogueLine.textContent = beat.text;
    setActiveNpc(beat.actorId);
  }
  window.requestAnimationFrame(positionTutorialCoach);
}

function focusCurrentStoryControl() {
  if (ui.game.hidden || ui.dialog.open || ui.battleDialog.open) return;
  if (!ui.dialogue.hidden) ui.dialogue.focus();
  else {
    const emphasisTarget = String(currentSave?.tutorial?.emphasisTarget ?? "").replace(/^panel:/u, "").trim();
    const tutorialTarget = !["", "choice", "choices"].includes(emphasisTarget)
      ? applyTutorialEmphasis(emphasisTarget)
      : null;
    if (tutorialTarget && !tutorialTarget.disabled) tutorialTarget.focus();
    else if (!ui.decision.hidden) $(".choice-button", ui.choices)?.focus();
    else if (emphasisTarget === "movement") $("#locationButton")?.focus();
  }
}

function introductionAckCommandId(token) {
  const stableToken = String(token ?? "").replace(/[\u0000-\u001f\u007f]/gu, "").slice(0, 88);
  return `npc-intro:${stableToken}`;
}

async function advanceDialogue() {
  if (!scenePlayback || scenePlayback.done || busy) return;
  ui.outcome.hidden = true;
  const displayedIndex = scenePlayback.index;
  const displayedBeat = scenePlayback.beats[displayedIndex];
  const introductionToken = escapeText(displayedBeat?.introductionToken, "");
  if (introductionToken) {
    const acknowledged = await sendCommand(
      "ACK_NPC_INTRODUCTION",
      { token: introductionToken },
      introductionAckCommandId(introductionToken),
    );
    // Keep the introduction visible when recognition could not be persisted.
    // The retry path reuses the same command id, so a lost response is safe.
    if (!acknowledged || !scenePlayback || scenePlayback.done) return;
    const resumedBeat = scenePlayback.beats[displayedIndex];
    if (!resumedBeat
      || resumedBeat.actorId !== displayedBeat.actorId
      || resumedBeat.text !== displayedBeat.text) return;
    resumedBeat.introductionToken = null;
  }
  if (scenePlayback.index < scenePlayback.beats.length - 1) scenePlayback.index += 1;
  else scenePlayback.done = true;
  renderScenePlayback();
  if (scenePlayback.done) window.requestAnimationFrame(focusCurrentStoryControl);
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
    ui.guidance.removeAttribute("data-panel");
    ui.guidance.disabled = true;
    return;
  }
  $("#guidanceKicker").textContent = escapeText(guidance.kicker, "現在の目的");
  $("#guidanceTitle").textContent = escapeText(guidance.title, "次の一歩");
  $("#guidanceDetail").textContent = escapeText(guidance.detail, guidance.targetFacilityName ? `${guidance.targetFacilityName}へ向かいましょう。` : "旅を続けましょう。");
  const deadline = $("#guidanceDeadline");
  deadline.textContent = escapeText(guidance.deadlineLabel, "");
  deadline.hidden = !deadline.textContent;
  const targetPanel = panelName(guidance.actionPanel);
  ui.guidance.disabled = !targetPanel;
  ui.guidance.dataset.panel = targetPanel ?? "";
  ui.guidance.dataset.targetFacilityId = escapeText(guidance.targetFacilityId, "");
  const guidanceLabel = [guidance.title, guidance.detail, guidance.deadlineLabel, targetPanel ? panelActionLabel(targetPanel) : ""]
    .filter(Boolean)
    .map((part) => String(part).trim().replace(/[。．.!！?？]+$/u, ""))
    .join("。");
  ui.guidance.setAttribute("aria-label", guidanceLabel);
  if (guidance.targetFacilityId) ui.guidance.dataset.targetFacilityId = guidance.targetFacilityId;
  else ui.guidance.removeAttribute("data-target-facility-id");
}

function clearTutorialEmphasis() {
  $$(".tutorial-emphasis").forEach((element) => element.classList.remove("tutorial-emphasis"));
  $$('[data-tutorial-described="true"]').forEach((element) => {
    const tokens = String(element.getAttribute("aria-describedby") ?? "")
      .split(/\s+/u)
      .filter((token) => token && token !== "tutorialBody");
    if (tokens.length) element.setAttribute("aria-describedby", tokens.join(" "));
    else element.removeAttribute("aria-describedby");
    delete element.dataset.tutorialDescribed;
  });
}

function applyTutorialEmphasis(value) {
  clearTutorialEmphasis();
  const key = String(value ?? "").replace(/^panel:/u, "").trim();
  const selectors = {
    choices: "#decisionTray",
    choice: "#decisionTray",
    guidance: "#guidanceBar",
    movement: "#locationButton",
    inventory: '.scene-topbar [data-open-panel="inventory"]',
    skills: '.scene-topbar [data-open-panel="skills"]',
    missions: '.scene-topbar [data-open-panel="missions"]',
    rumors: "#openQuickMenu",
    shop: ui.quickMenu.hidden ? "#openQuickMenu" : '#quickMenu [data-open-panel="shop"]',
  };
  const selector = selectors[key];
  if (!selector) return null;
  const visible = $$(selector).find((element) => !element.hidden && element.getClientRects().length > 0);
  if (visible) {
    visible.classList.add("tutorial-emphasis");
    const tokens = new Set(String(visible.getAttribute("aria-describedby") ?? "").split(/\s+/u).filter(Boolean));
    tokens.add("tutorialBody");
    visible.setAttribute("aria-describedby", [...tokens].join(" "));
    visible.dataset.tutorialDescribed = "true";
  }
  return visible ?? null;
}

const TUTORIAL_COACH_COPY = Object.freeze({
  "first-choice": "気になる行動を1つ選ぼう",
  "first-conversation": "返したい言葉を選ぼう",
  "conversation-depth": "もう一つ、聞きたいことを選ぼう",
  "first-movement": "現在地をタップして、村の広場へ",
  "discover-trouble": "話を聞く相手を選ぼう",
  "world-keeps-moving": "現在地をタップして、広場へ戻ろう",
  "trouble-aftermath": "誰か一人に、起きたことを聞こう",
  "mission-log": "ミッションをタップして、今の目的を確認",
  shop: "メニューから店を開いてみよう",
  skills: "スキルをタップして、戦う技を1つ覚えよう",
  combat: "赤い選択肢は戦闘。準備できたら進もう",
});

function positionTutorialCoach() {
  if (ui.tutorial.hidden) return;
  const targetKey = ui.tutorial.dataset.targetKey;
  const target = applyTutorialEmphasis(targetKey);
  if (!target || (targetKey === "choices" && ui.decision.hidden)) {
    ui.tutorial.style.visibility = "hidden";
    return;
  }
  ui.tutorial.style.visibility = "hidden";
  ui.tutorial.style.left = "0px";
  ui.tutorial.style.top = "0px";
  const targetRect = target.getBoundingClientRect();
  const coachRect = ui.tutorial.getBoundingClientRect();
  const margin = 9;
  const roomAbove = targetRect.top - coachRect.height - margin;
  const placement = roomAbove >= 8 ? "above" : "below";
  const top = placement === "above"
    ? targetRect.top - coachRect.height - margin
    : targetRect.bottom + margin;
  const left = Math.max(8, Math.min(window.innerWidth - coachRect.width - 8, targetRect.left + targetRect.width / 2 - coachRect.width / 2));
  const clampedTop = Math.max(8, Math.min(window.innerHeight - coachRect.height - 8, top));
  ui.tutorial.dataset.placement = placement;
  ui.tutorial.style.left = `${Math.round(left)}px`;
  ui.tutorial.style.top = `${Math.round(clampedTop)}px`;
  ui.tutorial.style.setProperty("--coach-arrow-left", `${Math.max(14, Math.min(coachRect.width - 14, targetRect.left + targetRect.width / 2 - left))}px`);
  ui.tutorial.style.visibility = "visible";
}

function renderTutorial(tutorial) {
  const value = tutorial && typeof tutorial === "object" ? tutorial : null;
  const visible = Boolean(value && value.complete !== true && (value.id || value.emphasisTarget));
  ui.tutorial.hidden = !visible;
  clearTutorialEmphasis();
  if (!visible) return;
  $("#tutorialTitle").textContent = escapeText(value.title, "旅の案内");
  $("#tutorialBody").textContent = TUTORIAL_COACH_COPY[value.id]
    ?? escapeText(value.actionLabel || value.title, "次の操作を試してみよう");
  const progress = $("#tutorialProgress");
  progress.textContent = escapeText(value.progressLabel, "");
  progress.hidden = !progress.textContent;
  const action = $("#tutorialAction");
  const targetPanel = panelName(value.actionPanel);
  action.hidden = true;
  action.dataset.panel = targetPanel ?? "";
  action.dataset.tutorialId = escapeText(value.id, "");
  action.dataset.acknowledgeable = String(Boolean(value.acknowledgeable && value.id));
  ui.tutorial.dataset.targetKey = String(value.emphasisTarget ?? "").replace(/^panel:/u, "").trim();
  ui.tutorial.dataset.panel = targetPanel ?? "";
  ui.tutorial.dataset.tutorialId = escapeText(value.id, "");
  ui.tutorial.dataset.acknowledgeable = String(Boolean(value.acknowledgeable && value.id));
  window.requestAnimationFrame(positionTutorialCoach);
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
      button.dataset.tutorialLocked = "true";
      if (name === "movement") {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
      } else {
        button.hidden = true;
      }
      return;
    }
    if (button.dataset.tutorialLocked === "true") {
      button.disabled = false;
      button.hidden = false;
      delete button.dataset.tutorialLocked;
      button.removeAttribute("aria-disabled");
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
  $("#spBadge").textContent = sp;
  $("#spBadge").closest("button")?.setAttribute("aria-label", `能力とスキルを見る（所持SP ${sp}）`);
  const hp = Math.max(0, Math.min(1, number(player.hpRatio, 1)));
  const mp = Math.max(0, Math.min(1, number(player.mpRatio, 1)));
  $("#hpBar").value = hp;
  $("#mpBar").value = mp;
  $("#hpText").textContent = formatPercent(hp);
  $("#mpText").textContent = formatPercent(mp);
}

function renderSave(save, { focus = "preserve", announce = false, preserveDialogue = false } = {}) {
  currentSave = save;
  localStorage.setItem(LAST_SAVE_KEY, save.id);
  clearErrors();
  ui.launch.hidden = true;
  ui.game.hidden = false;
  document.body.classList.add("is-playing");

  const clock = formatClock(save.clock);
  const scene = save.scene ?? {};
  $("#dayLabel").textContent = clock.day;
  $("#timeLabel").textContent = clock.time;
  $("#daypartLabel").textContent = clock.daypart;
  $("#locationName").textContent = escapeText(scene.location, "未知の地域");
  $("#facilityName").textContent = escapeText(scene.facilityName, "移動中");
  const outcome = scene.lastOutcome;
  const showOutcome = Boolean(outcome && ["shop_buy", "shop_sell", "learn_skill", "equip", "unequip"].includes(String(outcome.type ?? "").toLowerCase()));
  ui.outcome.hidden = !showOutcome;
  ui.outcome.textContent = showOutcome
    ? (typeof outcome === "string" ? outcome : escapeText(outcome?.summary || outcome?.message, "操作を完了しました。"))
    : "";
  if (outcomeTimer) window.clearTimeout(outcomeTimer);
  if (showOutcome) outcomeTimer = window.setTimeout(() => {
    if (document.activeElement === ui.outcome) focusCurrentStoryControl();
    ui.outcome.hidden = true;
  }, 4200);
  const missionCount = activeStoryMissions(save).length;
  $("#missionBadge").textContent = missionCount;
  $("#missionBadge").closest("button")?.setAttribute("aria-label", `ミッションを見る（進行中${missionCount}件）`);
  const rumorCount = list(save.rumors).length;
  $("#rumorBadge").textContent = rumorCount;
  const saveStatus = escapeText(save.saveStatus, "saved");
  $("#saveIndicator").dataset.status = saveStatus;
  $("#saveIndicator").textContent = saveStatus === "saving" ? "保存中…" : saveStatus === "error" ? "保存エラー" : "保存済み";

  const backgroundKey = scene.backgroundKey || scene.facilityId || "default";
  ui.backdrop.dataset.backgroundKey = backgroundKey;
  const imageUrl = backgroundUrl(backgroundKey);
  ui.backdrop.style.backgroundImage = imageUrl ? `url(${JSON.stringify(imageUrl)})` : "";

  renderNpcs(scene.presentNpcs);
  renderChoices(save.choices, save.world?.ended === true);
  renderPlayer(save.player);
  renderGuidance(save);
  renderTutorial(save.tutorial);
  if (!busy) renderTutorialUnlocks(save.tutorial);
  startScenePlayback(save, { preserve: preserveDialogue });
  if (ui.dialog.open) renderPanel(ui.dialog.dataset.panel);
  if (busy) disableBusyControls();
  if (announce) announceScene(save);
  queueBattlePresentation(save);
  scheduleAssetRefresh(save);
  if (focus !== "preserve") {
    window.requestAnimationFrame(() => {
      if (ui.dialog.open) {
        ui.dialogTitle.focus();
        return;
      }
      focusCurrentStoryControl();
    });
  }
}

function battleActorName(actors, instanceId, fallback = "敵") {
  const actor = actors.get(instanceId);
  if (actor?.side === "player") return escapeText(currentSave?.player?.name || actor.name, fallback);
  return escapeText(actor?.name, fallback);
}

function battleDisplayNumber(value, fallback = 0) {
  return Math.max(0, Math.round(number(value, fallback)));
}

function battleFrameMessage(frame, actors) {
  if (frame.phase !== "action") {
    const changes = list(frame.effects).map((effect) => {
      const target = battleActorName(actors, effect.targetInstanceId, "誰か");
      const damage = battleDisplayNumber(number(effect.hpBefore) - number(effect.hpAfter));
      const healing = battleDisplayNumber(number(effect.hpAfter) - number(effect.hpBefore));
      if (damage) return `${target}は${damage}のダメージを受けた。`;
      if (healing) return `${target}のHPが${healing}回復した。`;
      return "";
    }).filter(Boolean);
    return changes.join(" ") || (frame.phase === "round_start" ? "戦いの流れが動き出す。" : "互いに息を整えた。");
  }

  const actor = battleActorName(actors, frame.actorInstanceId, frame.actorSide === "enemy" ? "敵" : "旅人");
  if (frame.action?.kind === "defend") return `${actor}は身を守っている！`;
  if (frame.action?.kind === "flee") {
    return frame.escapeSucceeded === true
      ? `${actor}は戦いから逃げ出した！`
      : `${actor}は逃げようとした。しかし、回り込まれた！`;
  }
  const action = escapeText(frame.action?.name, frame.action?.kind === "attack" ? "こうげき" : "行動");
  const parts = frame.action?.kind === "status_failure"
    ? [`${actor}は動けない！`]
    : [`${actor}の${action}！`];
  if (number(frame.criticals) > 0) parts.push("会心の一撃！");
  list(frame.effects).forEach((effect) => {
    const target = battleActorName(actors, effect.targetInstanceId, "相手");
    const damage = battleDisplayNumber(number(effect.hpBefore) - number(effect.hpAfter));
    const healing = battleDisplayNumber(number(effect.hpAfter) - number(effect.hpBefore));
    const mpLoss = battleDisplayNumber(number(effect.mpBefore) - number(effect.mpAfter));
    if (damage) parts.push(`${target}に${damage}のダメージ！`);
    if (healing) parts.push(`${target}のHPが${healing}回復！`);
    if (!damage && !healing && mpLoss) parts.push(`${target}はMPを${mpLoss}使った。`);
    if (effect.aliveBefore !== false && effect.aliveAfter === false) parts.push(`${target}を倒した！`);
  });
  return parts.join(" ");
}

function battlePages(battle) {
  const playback = battle.playback;
  const initialActors = new Map(list(playback.combatants).map((actor) => [actor.instanceId, { ...actor }]));
  const enemyNames = [...initialActors.values()].filter((actor) => actor.side === "enemy").map((actor) => escapeText(actor.name, "敵"));
  const pages = [{
    kind: "intro",
    round: 1,
    message: enemyNames.length ? `${enemyNames.join("、")}が現れた！` : "敵が現れた！",
    frameCount: 0,
  }];
  list(playback.frames).forEach((frame, index) => {
    if (number(frame.omittedBefore) > 0 && list(frame.checkpoint).length) {
      pages.push({
        kind: "gap",
        round: Math.max(1, number(frame.round, 1)),
        message: `戦いは${battleDisplayNumber(frame.omittedBefore)}手進んだ……。`,
        frameCount: index,
        checkpoint: frame.checkpoint,
      });
    }
    pages.push({
      kind: "frame",
      round: Math.max(1, number(frame.round, 1)),
      message: battleFrameMessage(frame, initialActors),
      frameCount: index + 1,
    });
  });
  const reward = [number(battle.exp) > 0 ? `${number(battle.exp)} EXP` : "", number(battle.gold) > 0 ? `${number(battle.gold)} G` : ""].filter(Boolean).join("、");
  pages.push({
    kind: "result",
    round: Math.max(1, number(battle.rounds, 1)),
    message: battle.won ? `勝利した！${reward ? ` ${reward}を得た。` : ""}` : "戦いに敗れ、どうにか撤退した……。",
    frameCount: list(playback.frames).length,
  });
  return { pages, initialActors };
}

function applyBattleCheckpoint(actors, checkpoint) {
  list(checkpoint).forEach((entry) => {
    const actor = actors.get(entry.instanceId);
    if (!actor) return;
    actor.hp = number(entry.hp, actor.hp);
    actor.mp = number(entry.mp, actor.mp);
    actor.alive = entry.alive !== false;
  });
}

function actorsAtBattlePage(state, page) {
  const actors = new Map([...state.initialActors].map(([id, actor]) => [id, { ...actor }]));
  list(state.playback.frames).slice(0, page.frameCount).forEach((frame) => {
    if (list(frame.checkpoint).length) applyBattleCheckpoint(actors, frame.checkpoint);
    list(frame.effects).forEach((effect) => {
      const actor = actors.get(effect.targetInstanceId);
      if (!actor) return;
      actor.hp = number(effect.hpAfter, actor.hp);
      actor.mp = number(effect.mpAfter, actor.mp);
      actor.alive = effect.aliveAfter !== false;
    });
  });
  if (list(page.checkpoint).length) applyBattleCheckpoint(actors, page.checkpoint);
  return actors;
}

function renderBattleActors(actors) {
  const entries = actors instanceof Map ? [...actors.values()] : list(actors);
  ui.battleEnemies.replaceChildren();
  entries.filter((actor) => actor.side === "enemy").forEach((actor) => {
    const card = document.createElement("article");
    card.className = `battle-enemy${actor.alive === false || number(actor.hp) <= 0 ? " is-defeated" : ""}`;
    const imageUrl = monsterUrl(actor);
    const visual = imageUrl ? document.createElement("img") : document.createElement("div");
    visual.className = imageUrl ? "battle-enemy-image" : "enemy-silhouette";
    if (imageUrl) {
      visual.src = imageUrl;
      visual.alt = "";
      visual.loading = "eager";
      visual.decoding = "async";
    } else {
      visual.setAttribute("aria-hidden", "true");
    }
    const name = document.createElement("b");
    name.textContent = escapeText(actor.name, "敵");
    const hp = document.createElement("progress");
    hp.max = Math.max(1, battleDisplayNumber(actor.maxHp, 1));
    hp.value = battleDisplayNumber(actor.hp);
    hp.setAttribute("aria-label", `${name.textContent} HP ${hp.value}/${hp.max}`);
    card.append(visual, name, hp);
    ui.battleEnemies.append(card);
  });
  ui.battleStatus.replaceChildren();
  entries.filter((actor) => actor.side === "player").forEach((actor) => {
    const name = document.createElement("strong");
    name.textContent = escapeText(currentSave?.player?.name || actor.name, "旅人");
    const hp = document.createElement("span");
    hp.textContent = `HP ${battleDisplayNumber(actor.hp)} / ${Math.max(1, battleDisplayNumber(actor.maxHp, 1))}`;
    const mp = document.createElement("span");
    mp.textContent = `MP ${battleDisplayNumber(actor.mp)} / ${battleDisplayNumber(actor.maxMp)}`;
    const stateLabel = document.createElement("span");
    stateLabel.textContent = actor.alive === false ? "戦闘不能" : "";
    ui.battleStatus.append(name, hp, mp, stateLabel);
  });
}

function interactiveRoundMessage(battle, actors) {
  const actionFrames = list(battle.lastRound?.frames).filter((frame) => frame.phase === "action");
  if (!actionFrames.length) {
    const enemies = [...actors.values()].filter((actor) => actor.side === "enemy" && actor.alive !== false);
    return enemies.length ? `${enemies.map((actor) => escapeText(actor.name, "敵")).join("、")}が現れた！` : "次の行動を選んでください。";
  }
  const messages = actionFrames.map((frame) => battleFrameMessage(frame, actors)).filter(Boolean);
  const selected = messages.length <= 2 ? messages : [messages[0], messages[messages.length - 1]];
  const summary = selected.join(" ");
  return summary.length <= 150 ? summary : `${summary.slice(0, 147)}…`;
}

const BATTLE_DISABLED_REASONS = Object.freeze({
  cooldown: "再使用まで待つ必要がある",
  uses_exhausted: "この戦闘ではもう使えない",
  conditions_not_met: "今は発動条件を満たしていない",
  insufficient_resource: "MP・HPが足りない",
  no_target: "対象がいない",
  not_active: "戦闘中には使えない",
});

function battleCommandCost(command) {
  return [number(command.mpCost) > 0 ? `MP ${number(command.mpCost)}` : "", number(command.hpCost) > 0 ? `HP ${number(command.hpCost)}` : ""]
    .filter(Boolean)
    .join(" / ");
}

function createBattleCommandButton(label, { command = null, detail = "", disabled = false, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "battle-command-button";
  button.disabled = disabled;
  const main = document.createElement("span");
  main.textContent = label;
  button.append(main);
  const subtext = detail || (command?.available === false
    ? BATTLE_DISABLED_REASONS[command.disabledReason] ?? "今は使えない"
    : battleCommandCost(command ?? {}));
  if (subtext) {
    const small = document.createElement("small");
    small.textContent = subtext;
    button.append(small);
  }
  button.setAttribute("aria-label", [label, subtext].filter(Boolean).join("。"));
  button.addEventListener("click", onClick);
  return button;
}

async function submitInteractiveBattleCommand(battle, command, targetInstanceId = null) {
  if (busy || command?.available === false) return;
  interactiveBattleState.mode = "root";
  interactiveBattleState.selectedActionId = null;
  ui.battleMessage.textContent = `${escapeText(command.name, "行動")}を選んだ。`;
  await sendCommand("BATTLE_ACT", {
    battleId: battle.id,
    actionId: command.actionId,
    ...(targetInstanceId ? { targetInstanceId } : {}),
  });
}

function selectInteractiveBattleCommand(battle, command) {
  if (!command || command.available === false) return;
  const targets = list(command.targets);
  if (targets.length) {
    interactiveBattleState.mode = "targets";
    interactiveBattleState.selectedActionId = command.actionId;
    renderInteractiveBattleCommands(battle, { focus: true });
    return;
  }
  submitInteractiveBattleCommand(battle, command);
}

function renderInteractiveBattleCommands(battle, { focus = false } = {}) {
  const commands = list(battle.commands);
  const mode = interactiveBattleState?.mode ?? "root";
  ui.battleCommandMenu.replaceChildren();
  ui.battleCommandMenu.dataset.mode = mode;
  if (mode === "skills") {
    ui.battleCommandPrompt.textContent = "どのスキルを使う？";
    commands.filter((command) => command.kind === "skill").forEach((command) => {
      const cost = battleCommandCost(command);
      const detail = command.available === false
        ? BATTLE_DISABLED_REASONS[command.disabledReason] ?? "今は使えない"
        : [cost, escapeText(command.description, "")].filter(Boolean).join("・");
      ui.battleCommandMenu.append(createBattleCommandButton(escapeText(command.name, "スキル"), {
        command,
        detail,
        disabled: command.available === false,
        onClick: () => selectInteractiveBattleCommand(battle, command),
      }));
    });
    ui.battleCommandMenu.append(createBattleCommandButton("もどる", {
      onClick: () => {
        interactiveBattleState.mode = "root";
        renderInteractiveBattleCommands(battle, { focus: true });
      },
    }));
  } else if (mode === "targets") {
    const command = commands.find((entry) => entry.actionId === interactiveBattleState.selectedActionId);
    if (!command) {
      interactiveBattleState.mode = "root";
      renderInteractiveBattleCommands(battle, { focus });
      return;
    }
    ui.battleCommandPrompt.textContent = "だれを狙う？";
    list(command.targets).forEach((target) => {
      const detail = `HP ${battleDisplayNumber(target.hp)} / ${Math.max(1, battleDisplayNumber(target.maxHp, 1))}`;
      ui.battleCommandMenu.append(createBattleCommandButton(escapeText(target.name, "対象"), {
        detail,
        onClick: () => submitInteractiveBattleCommand(battle, command, target.instanceId),
      }));
    });
    ui.battleCommandMenu.append(createBattleCommandButton("もどる", {
      onClick: () => {
        interactiveBattleState.mode = command.kind === "skill" ? "skills" : "root";
        interactiveBattleState.selectedActionId = null;
        renderInteractiveBattleCommands(battle, { focus: true });
      },
    }));
  } else {
    ui.battleCommandPrompt.textContent = "どうする？";
    const attack = commands.find((command) => command.kind === "attack");
    const defend = commands.find((command) => command.kind === "defend");
    const flee = commands.find((command) => command.kind === "flee");
    const skills = commands.filter((command) => command.kind === "skill");
    ui.battleCommandMenu.append(
      createBattleCommandButton("たたかう", {
        command: attack,
        disabled: !attack || attack.available === false,
        onClick: () => selectInteractiveBattleCommand(battle, attack),
      }),
      createBattleCommandButton("スキル", {
        detail: skills.length ? `${skills.filter((command) => command.available !== false).length}個 使用可能` : "習得スキルなし",
        disabled: !skills.length,
        onClick: () => {
          interactiveBattleState.mode = "skills";
          renderInteractiveBattleCommands(battle, { focus: true });
        },
      }),
      createBattleCommandButton("ぼうぎょ", {
        command: defend,
        detail: "受けるダメージを抑える",
        disabled: !defend || defend.available === false,
        onClick: () => selectInteractiveBattleCommand(battle, defend),
      }),
      createBattleCommandButton("にげる", {
        command: flee,
        detail: "逃走を試みる",
        disabled: !flee || flee.available === false,
        onClick: () => selectInteractiveBattleCommand(battle, flee),
      }),
    );
  }
  if (focus) window.requestAnimationFrame(() => $("button:not(:disabled)", ui.battleCommandMenu)?.focus());
}

function renderInteractiveBattle(save) {
  const battle = save.battle;
  if (!battle || battle.status !== "active") return;
  const isNewBattle = interactiveBattleState?.id !== battle.id;
  if (isNewBattle) interactiveBattleState = { id: battle.id, mode: "root", selectedActionId: null };
  battlePlayback = null;
  const actors = new Map(list(battle.actors).map((actor) => [actor.instanceId, { ...actor }]));
  $("#battleRound").textContent = `ROUND ${Math.max(1, number(battle.round, 1))}`;
  $("#battleTitle").textContent = escapeText(battle.encounterName, "戦闘");
  ui.battleScene.style.backgroundImage = ui.backdrop.style.backgroundImage;
  ui.battleMessage.textContent = interactiveRoundMessage(battle, actors);
  renderBattleActors(actors);
  $("#battleSkip").hidden = true;
  ui.battlePlaybackControls.hidden = true;
  ui.battleCommandPanel.hidden = false;
  ui.battleDialog.dataset.mode = "interactive";
  ui.battleDialog.dataset.readyToClose = "false";
  renderInteractiveBattleCommands(battle, { focus: isNewBattle || !busy });
  if (!ui.battleDialog.open) ui.battleDialog.showModal();
}

function renderBattlePage() {
  if (!battlePlayback) return;
  const page = battlePlayback.pages[battlePlayback.index];
  const actors = actorsAtBattlePage(battlePlayback, page);
  $("#battleRound").textContent = page.kind === "result" ? "RESULT" : `ROUND ${page.round}`;
  ui.battleMessage.textContent = page.message;
  renderBattleActors(actors);
  ui.battleCommandPanel.hidden = true;
  ui.battlePlaybackControls.hidden = false;
  ui.battleDialog.dataset.mode = "playback";
  const isFinal = battlePlayback.index === battlePlayback.pages.length - 1;
  $("#battleNext").hidden = isFinal;
  $("#battleClose").hidden = !isFinal;
  $("#battleSkip").hidden = isFinal;
  ui.battleDialog.dataset.readyToClose = String(isFinal);
}

function openBattlePlayback(save, battle, key, { resultOnly = false } = {}) {
  const playback = battle?.playback;
  if (!playback || !list(playback.combatants).length) return;
  const prepared = battlePages(battle);
  battlePlayback = {
    key,
    battle,
    playback,
    pages: prepared.pages,
    initialActors: prepared.initialActors,
    index: resultOnly ? prepared.pages.length - 1 : 0,
  };
  $("#battleTitle").textContent = escapeText(playback.encounter?.name, "戦闘");
  ui.battleScene.style.backgroundImage = ui.backdrop.style.backgroundImage;
  renderBattlePage();
  if (!ui.battleDialog.open) ui.battleDialog.showModal();
  (resultOnly ? $("#battleClose") : $("#battleNext")).focus();
}

function queueBattlePlayback(save, { resultOnly = false } = {}) {
  const battle = save?.scene?.lastOutcome?.battle;
  if (!battle?.playback) return;
  const key = `${save.id}:${save.revision}:${battle.playback.encounter?.id ?? battle.encounterId ?? "battle"}`;
  if (key === lastPresentedBattleKey) return;
  lastPresentedBattleKey = key;
  window.setTimeout(() => openBattlePlayback(save, battle, key, { resultOnly }), 0);
}

function queueBattlePresentation(save) {
  if (save?.battle?.status === "active") {
    renderInteractiveBattle(save);
    return;
  }
  const completedInteractiveBattle = Boolean(interactiveBattleState?.id);
  interactiveBattleState = null;
  const completedBattle = save?.scene?.lastOutcome?.battle;
  if (completedInteractiveBattle && !completedBattle?.playback && ui.battleDialog.open) {
    ui.battleDialog.dataset.readyToClose = "true";
    ui.battleDialog.close();
    return;
  }
  queueBattlePlayback(save, { resultOnly: completedInteractiveBattle });
}

function advanceBattle() {
  if (!battlePlayback) return;
  battlePlayback.index = Math.min(battlePlayback.pages.length - 1, battlePlayback.index + 1);
  renderBattlePage();
  (battlePlayback.index === battlePlayback.pages.length - 1 ? $("#battleClose") : $("#battleNext")).focus();
}

function skipBattle() {
  if (!battlePlayback) return;
  battlePlayback.index = battlePlayback.pages.length - 1;
  renderBattlePage();
  $("#battleClose").focus();
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
    const preserveDialogue = ["TUTORIAL_ACK", "ACK_NPC_INTRODUCTION"].includes(type);
    renderSave(result.save, { focus: "result", announce: type !== "ACK_NPC_INTRODUCTION", preserveDialogue });
    return true;
  } catch (error) {
    const code = error.data?.error;
    const errorTarget = ui.battleDialog.open ? ui.battleError : ui.dialog.open ? ui.dialogError : ui.gameError;
    if (code === "revision_conflict") {
      showError(errorTarget, "別の画面で旅が進んだようです。最新の状態を読み込みます。", () => loadGame(currentSave.id));
    } else if (code === "game_ended") {
      showError(errorTarget, "100日間の旅は完結しています。最新の年代記を読み込んでください。", () => loadGame(currentSave.id));
    } else if (code === "tutorial_feature_locked") {
      showError(errorTarget, "その機能はまだ案内されていません。画面中央の導入を進めてください。");
    } else if (code === "insufficient_gold") {
      showError(errorTarget, "所持金が足りません。仕事や任務で資金を得てから購入できます。");
    } else if (code === "insufficient_sp") {
      showError(errorTarget, "SPが足りません。レベルアップなどでSPを得てから取得できます。");
    } else if (["battle_not_active", "battle_id_mismatch"].includes(code)) {
      showError(errorTarget, "戦闘状態を更新できませんでした。最新の状態を読み込みます。", () => loadGame(currentSave.id));
    } else if ([
      "battle_action_invalid",
      "battle_target_invalid",
      "battle_action_rejected",
      "unknown_action",
      "invalid_target",
      "action_unavailable",
      "no_target",
      "not_active",
      "cooldown",
      "uses_exhausted",
      "conditions_not_met",
      "insufficient_resource",
    ].includes(code)) {
      showError(errorTarget, "その戦闘行動は選べません。別のコマンドを選んでください。");
    } else {
      showError(errorTarget, error.message, () => sendCommand(type, payload, commandId));
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
  ui.dialogError.hidden = true;
  const normalized = panelName(name) ?? "chronicle";
  if (normalized === "movement" && targetFacilityId) ui.dialog.dataset.targetFacilityId = targetFacilityId;
  else ui.dialog.removeAttribute("data-target-facility-id");
  renderPanel(normalized);
  if (!ui.dialog.open) ui.dialog.showModal();
  ui.dialogTitle.focus();
}

function closeQuickMenu({ restoreFocus = false } = {}) {
  const focusWasInside = ui.quickMenu.contains(document.activeElement);
  ui.quickMenu.hidden = true;
  $("#openQuickMenu").setAttribute("aria-expanded", "false");
  if (restoreFocus || focusWasInside) $("#openQuickMenu").focus();
  window.requestAnimationFrame(positionTutorialCoach);
}

async function openPanelFromUi(name, { targetFacilityId = "" } = {}) {
  if (busy || !currentSave) return;
  const normalized = panelName(name) ?? "chronicle";
  closeQuickMenu();
  const tutorial = currentSave.tutorial;
  const shouldAcknowledge = tutorial?.acknowledgeable === true
    && tutorial.id
    && panelName(tutorial.actionPanel) === normalized;
  if (shouldAcknowledge) {
    const acknowledged = await sendCommand("TUTORIAL_ACK", { tutorialId: tutorial.id });
    if (!acknowledged) return;
  }
  openPanel(normalized, { targetFacilityId });
}

async function loadManifest() {
  const previous = JSON.stringify(assetManifest);
  try {
    const response = await fetch("/TRPG/assets/manifest.json", { cache: "no-store" });
    if (response.ok) assetManifest = await response.json();
  } catch {
    if (!assetManifest || typeof assetManifest !== "object") {
      assetManifest = { backgrounds: {}, portraits: {}, monsters: {} };
    }
  }
  return previous !== JSON.stringify(assetManifest);
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
  if (ui.battleDialog.open) ui.battleDialog.close();
  closeQuickMenu();
  ui.game.hidden = true;
  ui.launch.hidden = false;
  document.body.classList.remove("is-playing");
  switchLaunchTab("resume");
});
$("#closeDialog").addEventListener("click", () => ui.dialog.close());
ui.dialog.addEventListener("click", (event) => {
  if (event.target === ui.dialog) ui.dialog.close();
});
ui.dialog.addEventListener("close", () => {
  ui.dialog.removeAttribute("data-target-facility-id");
  window.requestAnimationFrame(positionTutorialCoach);
});
$$('[data-open-panel]').forEach((button) => button.addEventListener("click", () => {
  const targetFacilityId = button.dataset.openPanel === "movement" ? guidanceView(currentSave)?.targetFacilityId : "";
  openPanelFromUi(button.dataset.openPanel, { targetFacilityId });
}));
ui.guidance.addEventListener("click", () => {
  const name = panelName(ui.guidance.dataset.panel);
  if (name) openPanelFromUi(name, { targetFacilityId: ui.guidance.dataset.targetFacilityId });
});
$("#openQuickMenu").addEventListener("click", (event) => {
  event.stopPropagation();
  const opening = ui.quickMenu.hidden;
  if (!opening) {
    closeQuickMenu({ restoreFocus: true });
    return;
  }
  ui.quickMenu.hidden = false;
  event.currentTarget.setAttribute("aria-expanded", "true");
  window.requestAnimationFrame(() => $("button", ui.quickMenu)?.focus());
  window.requestAnimationFrame(positionTutorialCoach);
});
ui.quickMenu.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", () => {
  if (ui.quickMenu.hidden) return;
  closeQuickMenu();
});
ui.dialogue.addEventListener("click", advanceDialogue);
$("#battleNext").addEventListener("click", advanceBattle);
$("#battleSkip").addEventListener("click", skipBattle);
$("#battleClose").addEventListener("click", () => {
  if (ui.battleDialog.dataset.readyToClose === "true") ui.battleDialog.close();
});
ui.battleDialog.addEventListener("close", () => {
  battlePlayback = null;
  window.requestAnimationFrame(focusCurrentStoryControl);
});
ui.battleDialog.addEventListener("cancel", (event) => {
  if (ui.battleDialog.dataset.readyToClose !== "true") {
    event.preventDefault();
    skipBattle();
  }
});
window.addEventListener("resize", positionTutorialCoach);

document.addEventListener("keydown", (event) => {
  if (busy || ui.game.hidden || ui.dialog.open || ui.battleDialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "Escape" && !ui.quickMenu.hidden) {
    event.preventDefault();
    closeQuickMenu({ restoreFocus: true });
    return;
  }
  if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/u.test(document.activeElement?.tagName)) return;
  if (!ui.dialogue.hidden && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    advanceDialogue();
    return;
  }
  if (ui.decision.hidden) return;
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
