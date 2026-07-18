const API_BASE = "/TRPG/api/game";
const LAST_SAVE_KEY = "trpg:last-save-id";
const REQUEST_TIMEOUT = 30000;

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
  dialog: $("#detailDialog"),
  dialogTitle: $("#dialogTitle"),
  dialogKicker: $("#dialogKicker"),
  dialogBody: $("#dialogBody"),
};

let currentSave = null;
let assetManifest = { backgrounds: {}, portraits: {} };
let busy = false;

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
  return { day: `Day ${number(clock.day, 1)}`, time, daypart: escapeText(clock.daypart, "昼") };
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

function setBusy(value, message = "世界が動いています…") {
  busy = value;
  ui.busy.hidden = !value;
  $("b", ui.busy).textContent = message;
  $$('button, input', ui.game).forEach((element) => { element.disabled = value; });
  if (!value) $$('button, input', ui.game).forEach((element) => { element.disabled = false; });
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

function switchLaunchTab(tab) {
  const isNew = tab === "new";
  ui.newTab.setAttribute("aria-selected", String(isNew));
  ui.resumeTab.setAttribute("aria-selected", String(!isNew));
  ui.newPanel.hidden = !isNew;
  ui.resumePanel.hidden = isNew;
  (isNew ? $("#playerName") : $("#refreshSaves")).focus();
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

function renderChoices(choices) {
  ui.choices.replaceChildren();
  const entries = list(choices).slice(0, 3);
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-message";
    empty.textContent = "選択肢を準備できませんでした。画面を再読み込みしてください。";
    ui.choices.append(empty);
    return;
  }
  entries.forEach((choice, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.dataset.choiceId = choice.choiceId || choice.id;
    button.innerHTML = `<span class="choice-number">${index + 1}</span><span class="choice-label"></span><small></small>`;
    $(".choice-label", button).textContent = escapeText(choice.label, "行動する");
    $("small", button).textContent = number(choice.minutes) > 0 ? `${number(choice.minutes)}分` : escapeText(choice.type, "行動");
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

function renderPlayer(player = {}) {
  $("#playerDisplayName").textContent = escapeText(player.name, "旅人");
  $("#playerLevel").textContent = `Lv ${number(player.level, 1)}`;
  $("#playerGold").textContent = `${number(player.gold).toLocaleString("ja-JP")} G`;
  $("#spBadge").textContent = number(player.sp);
  const hp = Math.max(0, Math.min(1, number(player.hpRatio, 1)));
  const mp = Math.max(0, Math.min(1, number(player.mpRatio, 1)));
  $("#hpBar").value = hp;
  $("#mpBar").value = mp;
  $("#hpText").textContent = formatPercent(hp);
  $("#mpText").textContent = formatPercent(mp);
}

function renderSave(save) {
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
  $("#missionBadge").textContent = list(save.missions).filter((mission) => mission.kind !== "permanent"
    && ["active", "available", "in_progress"].includes(mission.status)).length;
  $("#rumorBadge").textContent = list(save.rumors).length;
  const saveStatus = escapeText(save.saveStatus, "saved");
  $("#saveIndicator").dataset.status = saveStatus;
  $("#saveIndicator").textContent = saveStatus === "saving" ? "保存中…" : saveStatus === "error" ? "保存エラー" : "保存済み";

  const backgroundKey = scene.backgroundKey || scene.facilityId || "default";
  ui.backdrop.dataset.backgroundKey = backgroundKey;
  const imageUrl = backgroundUrl(backgroundKey);
  ui.backdrop.style.backgroundImage = imageUrl ? `linear-gradient(180deg, rgba(7,12,9,.12), rgba(7,12,9,.84)), url(${JSON.stringify(imageUrl)})` : "";

  renderNpcs(scene.presentNpcs);
  renderChoices(save.choices);
  renderPlayer(save.player);
  if (ui.dialog.open) renderPanel(ui.dialog.dataset.panel);
}

async function createGame(form) {
  setBusy(true, "旅の始まりを準備しています…");
  clearErrors();
  try {
    const formData = new FormData(form);
    const result = await requestJson(`${API_BASE}/saves`, {
      method: "POST",
      body: JSON.stringify({ playerName: formData.get("playerName"), profileId: formData.get("profileId") }),
    });
    renderSave(result.save);
  } catch (error) {
    showError(ui.launchError, error.message, () => createGame(form));
  } finally {
    setBusy(false);
  }
}

async function loadGame(id) {
  if (!id) return;
  setBusy(true, "保存した旅を開いています…");
  clearErrors();
  try {
    const result = await requestJson(`${API_BASE}/saves/${encodeURIComponent(id)}`);
    renderSave(result.save);
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
  if (!currentSave || busy) return;
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
    renderSave(result.save);
  } catch (error) {
    if (error.status === 409) {
      showError(ui.gameError, "別の画面で旅が進んだようです。最新の状態を読み込みます。", () => loadGame(currentSave.id));
    } else {
      showError(ui.gameError, error.message, () => sendCommand(type, payload, commandId));
    }
    $("#saveIndicator").dataset.status = "error";
    $("#saveIndicator").textContent = "保存エラー";
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
  button.disabled = disabled;
  button.setAttribute("aria-label", accessibleName);
  button.dataset.command = command;
  const targetId = payload?.moveId || payload?.equipmentId || payload?.skillId || payload?.stockId || payload?.slot;
  if (targetId) button.dataset.targetId = targetId;
  button.addEventListener("click", async () => {
    await sendCommand(command, payload);
    if (!ui.gameError.hidden) return;
    renderPanel(ui.dialog.dataset.panel);
  });
  return button;
}

function renderMovement() {
  const moves = list(currentSave.movement);
  if (!moves.length) return ui.dialogBody.append(emptyPanel("今いる場所から選べる移動先はありません。"));
  const groups = new Map();
  moves.forEach((move) => {
    const key = move.scope === "regional" || move.scope === "region" ? "地域間移動" : "街・施設内の移動";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(move);
  });
  groups.forEach((entries, title) => {
    const section = document.createElement("section");
    section.className = "detail-section";
    section.innerHTML = `<h3>${title}</h3>`;
    entries.forEach((move) => {
      const row = document.createElement("div");
      row.className = "detail-row";
      const text = document.createElement("div");
      text.innerHTML = "<b></b><small></small>";
      $("b", text).textContent = escapeText(move.label || move.destination, "移動する");
      $("small", text).textContent = `${number(move.minutes)}分`;
      row.append(text, actionButton(
        "移動",
        "MOVE",
        { moveId: move.moveId || move.id },
        false,
        escapeText(move.label || move.destination, `移動先へ移動（${number(move.minutes)}分）`),
      ));
      section.append(row);
    });
    ui.dialogBody.append(section);
  });
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
  const row = document.createElement("div");
  row.className = `skill-row is-${status}`;
  const text = document.createElement("div");
  text.innerHTML = "<b></b><p></p><small></small>";
  $("b", text).textContent = escapeText(skill.name || skill.id, "名称不明のスキル");
  $("p", text).textContent = escapeText(skill.description, status === "learned" ? "取得済み" : "説明はまだありません。");
  $("small", text).textContent = status === "locked" ? escapeText(skill.lockReason || skill.requirement, "取得条件を満たしていません") : `必要SP ${number(skill.spCost ?? skill.cost)}`;
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
  const player = currentSave.player ?? {};
  const exp = number(player.exp);
  const next = Math.max(1, number(player.nextLevelExp, 1));
  const status = document.createElement("section");
  status.className = "character-card";
  const stats = player.stats ?? {};
  status.innerHTML = `<div><span>LEVEL</span><b>${number(player.level, 1)}</b></div><div><span>EXP</span><b>${exp} / ${next}</b><progress max="${next}" value="${Math.min(exp, next)}"></progress></div><div><span>SP</span><b>${number(player.sp)}</b></div>`;
  ui.dialogBody.append(status);
  const statGrid = document.createElement("div");
  statGrid.className = "stat-grid";
  const labels = { attack: "攻撃", defense: "防御", agility: "敏捷", luck: "幸運", magic: "魔力", vitality: "体力" };
  Object.entries(stats).forEach(([key, value]) => {
    const item = document.createElement("div");
    item.innerHTML = `<span>${labels[key] || key}</span><b>${number(value)}</b>`;
    statGrid.append(item);
  });
  ui.dialogBody.append(statGrid);
  const skills = currentSave.skills ?? {};
  [["取得済み", "learned"], ["取得可能", "learnable"], ["条件未達", "locked"]].forEach(([title, key]) => {
    const entries = list(skills[key]);
    const section = document.createElement("section");
    section.className = "detail-section";
    section.innerHTML = `<h3>${title} <small>${entries.length}</small></h3>`;
    if (!entries.length) section.append(emptyPanel(`${title}のスキルはありません。`));
    entries.forEach((skill) => section.append(skillEntry(skill, key)));
    ui.dialogBody.append(section);
  });
}

function renderMissions() {
  const missions = list(currentSave.missions);
  if (!missions.length) return ui.dialogBody.append(emptyPanel("受注・発見した任務はありません。噂を集めてみましょう。"));
  missions.sort((a, b) => number(a.deadlineDay, 999) - number(b.deadlineDay, 999));
  missions.forEach((mission) => {
    const article = document.createElement("article");
    article.className = `mission-card is-${mission.status || "unknown"}`;
    article.innerHTML = "<div class=" + JSON.stringify("mission-title") + "><span></span><small></small></div><h3></h3><p></p><div class=" + JSON.stringify("mission-progress") + "><span></span></div><footer></footer>";
    $(".mission-title span", article).textContent = escapeText(mission.kind, "MISSION").toUpperCase();
    $(".mission-title small", article).textContent = escapeText(mission.status, "不明");
    $("h3", article).textContent = escapeText(mission.title || mission.name, "名もなき任務");
    const currentStep = mission.currentStep;
    $("p", article).textContent = escapeText(typeof currentStep === "object" ? currentStep.label : currentStep || mission.description, "次の手がかりを探す");
    const progress = Math.max(0, Math.min(1, number(mission.progressRatio, mission.complete ? 1 : 0)));
    $(".mission-progress span", article).style.width = `${progress * 100}%`;
    const targetLocation = mission.targetLocation || currentStep?.targetLocation || mission.location;
    $("footer", article).textContent = mission.deadlineDay ? `期限 Day ${mission.deadlineDay} ・ ${escapeText(targetLocation, "目的地不明")}` : escapeText(targetLocation, "常設任務");
    ui.dialogBody.append(article);
  });
}

function renderRumors() {
  const rumors = list(currentSave.rumors);
  if (!rumors.length) return ui.dialogBody.append(emptyPanel("知っている噂はまだありません。人に話しかけたり、周囲を調べたりしてみましょう。"));
  rumors.slice().reverse().forEach((rumor) => {
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
    $("small", text).textContent = `${item.quantity === Infinity ? "在庫 ∞" : `在庫 ${number(item.quantity, 1)}`}${inventoryNote}`;
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
    $("b", row).textContent = escapeText(item.name || equipmentId);
    $("small", row).textContent = equippedIds.has(equipmentId) ? "装備中は売却できません" : `所持 ${number(item.quantity ?? item.count, 1)}`;
    row.append(actionButton(
      "売却",
      "SHOP_SELL",
      { equipmentId },
      !equipmentId || equippedIds.has(equipmentId),
      `${escapeText(item.name || equipmentId, "装備品")}を売却`,
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
  entries.slice().reverse().forEach((entry) => {
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
  const meta = panelMeta[name] ?? panelMeta.chronicle;
  ui.dialog.dataset.panel = name;
  ui.dialogKicker.textContent = meta[0];
  ui.dialogTitle.textContent = meta[1];
  ui.dialogBody.replaceChildren();
  meta[2]();
}

function openPanel(name) {
  if (!currentSave) return;
  renderPanel(name);
  if (!ui.dialog.open) ui.dialog.showModal();
  $("#closeDialog").focus();
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
ui.newForm.addEventListener("submit", (event) => { event.preventDefault(); createGame(event.currentTarget); });
$("#refreshSaves").addEventListener("click", loadSaveList);
$("#returnToTitle").addEventListener("click", () => {
  ui.game.hidden = true;
  ui.launch.hidden = false;
  switchLaunchTab("resume");
});
$("#closeDialog").addEventListener("click", () => ui.dialog.close());
ui.dialog.addEventListener("click", (event) => {
  if (event.target === ui.dialog) ui.dialog.close();
});
$("#openChronicle").addEventListener("click", () => openPanel("chronicle"));
$$('[data-open-panel]').forEach((button) => button.addEventListener("click", () => openPanel(button.dataset.openPanel)));

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
  switchLaunchTab("resume");
} else {
  $("#playerName").focus();
}
