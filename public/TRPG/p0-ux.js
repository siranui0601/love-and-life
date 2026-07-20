(() => {
  "use strict";

  if (window.__trpgP0UxInstalled) return;
  window.__trpgP0UxInstalled = true;

  const API_ROUTE_PATTERN = /\/api\/trpg(?:\/|$)/u;
  const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);
  const COMPLETED_MISSION_STATUSES = new Set(["completed", "resolved"]);
  const FAILED_MISSION_STATUSES = new Set(["failed", "expired", "unavailable"]);
  const EARLY_TUTORIAL_STAGES = new Set(["awakening", "first_contact", "orientation"]);
  const MOVEMENT_TUTORIAL_STAGES = new Set([
    "movement",
    "mission_intro",
    "movement_aftermath",
    "aftermath_intro",
    "free",
  ]);

  const runtime = {
    save: null,
    missions: new Map(),
    baselineReady: false,
    syncQueued: false,
    toastQueue: [],
    toastActive: false,
    recentToastKeys: new Map(),
  };

  function text(value, fallback = "") {
    const normalized = String(value ?? "").trim();
    return normalized || fallback;
  }

  function objectValues(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? Object.values(value)
      : [];
  }

  function findSave(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 4) return null;
    if (value.scene && value.player && (value.missions || value.choices || value.movement || value.skills)) {
      return value;
    }
    for (const key of ["save", "game", "state", "data", "result", "payload"]) {
      const found = findSave(value[key], depth + 1);
      if (found) return found;
    }
    return null;
  }

  function flattenMissions(value, depth = 0) {
    if (!value || depth > 3) return [];
    if (Array.isArray(value)) return value.flatMap((entry) => flattenMissions(entry, depth + 1));
    if (typeof value !== "object") return [];
    if (value.id || value.missionId) return [value];
    return objectValues(value).flatMap((entry) => flattenMissions(entry, depth + 1));
  }

  function normalizeMission(raw) {
    const id = text(raw?.id ?? raw?.missionId);
    if (!id) return null;
    const currentStep = raw?.currentStep && typeof raw.currentStep === "object"
      ? raw.currentStep
      : null;
    const stepLabel = text(
      currentStep?.label
        ?? currentStep?.title
        ?? raw?.currentStepLabel
        ?? (typeof raw?.currentStep === "string" ? raw.currentStep : ""),
    );
    const stepId = text(currentStep?.id ?? raw?.currentStepId ?? stepLabel);
    const progress = Number(currentStep?.progress ?? raw?.currentStepProgress);
    const required = Number(currentStep?.required ?? raw?.currentStepRequired);
    return {
      id,
      title: text(raw?.title ?? raw?.name, "ミッション"),
      kind: text(raw?.kind),
      troubleId: text(raw?.troubleId),
      status: text(raw?.status).toLowerCase(),
      stepId,
      stepLabel,
      progress: Number.isFinite(progress) ? progress : null,
      required: Number.isFinite(required) ? required : null,
    };
  }

  function storyMissions(save) {
    const missions = flattenMissions(save?.missions)
      .map(normalizeMission)
      .filter(Boolean)
      .filter((mission) => mission.kind === "special"
        || /^MSN-T\d+/u.test(mission.id)
        || /^T\d+/u.test(mission.troubleId));
    return new Map(missions.map((mission) => [mission.id, mission]));
  }

  function learnedSkillCount(save) {
    const learned = save?.skills?.learned;
    if (Array.isArray(learned)) return learned.length;
    if (learned && typeof learned === "object") return Object.keys(learned).length;
    const playerSkills = save?.player?.skills;
    if (Array.isArray(playerSkills)) return playerSkills.length;
    if (playerSkills && typeof playerSkills === "object") return Object.keys(playerSkills).length;
    return 0;
  }

  function missionStepKey(mission) {
    return [mission.stepId, mission.stepLabel, mission.progress, mission.required].join("|");
  }

  function missionIsFinnRescue(mission) {
    return mission.troubleId === "T01" || mission.id === "MSN-T01";
  }

  function missionRequiresReturn(mission) {
    return /連れ帰|広場へ戻|村へ戻|帰還/u.test(`${mission.stepId} ${mission.stepLabel}`);
  }

  function enqueueToast(toast) {
    const key = text(toast.dedupeKey, `${toast.kicker}:${toast.title}:${toast.detail}`);
    const now = Date.now();
    const previous = runtime.recentToastKeys.get(key) ?? 0;
    if (now - previous < 4_000) return;
    runtime.recentToastKeys.set(key, now);
    runtime.toastQueue.push({ ...toast, dedupeKey: key });
    drainToastQueue();
  }

  function toastRegion() {
    return document.getElementById("missionToastRegion");
  }

  function openMissionPanel() {
    const button = document.querySelector('[data-open-panel="missions"]');
    if (button instanceof HTMLButtonElement) button.click();
  }

  function drainToastQueue() {
    if (runtime.toastActive || !runtime.toastQueue.length) return;
    const region = toastRegion();
    if (!region) return;
    runtime.toastActive = true;
    const toast = runtime.toastQueue.shift();
    const element = document.createElement("button");
    element.type = "button";
    element.className = `mission-lifecycle-toast is-${text(toast.tone, "info")}`;
    element.innerHTML = "<span class=\"mission-toast-kicker\"></span><strong></strong><span class=\"mission-toast-detail\"></span>";
    element.querySelector(".mission-toast-kicker").textContent = text(toast.kicker, "MISSION");
    element.querySelector("strong").textContent = text(toast.title, "ミッションが更新されました");
    const detail = element.querySelector(".mission-toast-detail");
    detail.textContent = text(toast.detail, "ミッション一覧で内容を確認できます。");
    element.setAttribute("aria-label", `${element.querySelector(".mission-toast-kicker").textContent}。${element.querySelector("strong").textContent}。${detail.textContent}`);
    element.addEventListener("click", () => {
      dismiss();
      openMissionPanel();
    });
    region.append(element);
    requestAnimationFrame(() => element.classList.add("is-visible"));

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      element.classList.remove("is-visible");
      window.setTimeout(() => {
        element.remove();
        runtime.toastActive = false;
        drainToastQueue();
      }, 220);
    };
    window.setTimeout(dismiss, Number(toast.durationMs ?? 5_800));
  }

  function compareMissionLifecycle(nextMissions) {
    if (!runtime.baselineReady) {
      runtime.missions = nextMissions;
      runtime.baselineReady = true;
      return;
    }

    for (const [id, next] of nextMissions) {
      const previous = runtime.missions.get(id);
      if (!previous) {
        if (ACTIVE_MISSION_STATUSES.has(next.status)) {
          enqueueToast({
            kicker: "ミッション発生",
            title: next.title,
            detail: next.stepLabel || "新しい依頼の内容を確認しよう。",
            tone: "start",
            dedupeKey: `mission-start:${id}:${next.status}`,
          });
        }
        continue;
      }

      if (!ACTIVE_MISSION_STATUSES.has(previous.status) && ACTIVE_MISSION_STATUSES.has(next.status)) {
        enqueueToast({
          kicker: "ミッション発生",
          title: next.title,
          detail: next.stepLabel || "新しい依頼の内容を確認しよう。",
          tone: "start",
          dedupeKey: `mission-start:${id}:${next.status}`,
        });
        continue;
      }

      if (!COMPLETED_MISSION_STATUSES.has(previous.status) && COMPLETED_MISSION_STATUSES.has(next.status)) {
        enqueueToast({
          kicker: "ミッション完了",
          title: next.title,
          detail: "行動の結果が世界へ反映された。",
          tone: "complete",
          durationMs: 7_000,
          dedupeKey: `mission-complete:${id}:${next.status}`,
        });
        continue;
      }

      if (!FAILED_MISSION_STATUSES.has(previous.status) && FAILED_MISSION_STATUSES.has(next.status)) {
        enqueueToast({
          kicker: "ミッション失敗",
          title: next.title,
          detail: "期限や状況が変化した。年代記とミッション一覧を確認しよう。",
          tone: "failed",
          durationMs: 7_000,
          dedupeKey: `mission-failed:${id}:${next.status}`,
        });
        continue;
      }

      if (ACTIVE_MISSION_STATUSES.has(next.status) && missionStepKey(previous) !== missionStepKey(next)) {
        const finnReturn = missionIsFinnRescue(next) && missionRequiresReturn(next) && !missionRequiresReturn(previous);
        enqueueToast({
          kicker: finnReturn ? "救出成功" : "ミッション更新",
          title: finnReturn ? "フィンを村へ連れ帰ろう" : next.title,
          detail: next.stepLabel || "次の目的が更新された。",
          tone: finnReturn ? "rescue" : "update",
          durationMs: finnReturn ? 7_500 : 5_800,
          dedupeKey: `mission-step:${id}:${missionStepKey(next)}`,
        });
      }
    }

    runtime.missions = nextMissions;
  }

  function tutorialView(save) {
    return save?.tutorial && typeof save.tutorial === "object" ? save.tutorial : {};
  }

  function skillPrimerRequired(save) {
    if (!save || learnedSkillCount(save) > 0) return false;
    const tutorial = tutorialView(save);
    if (tutorial.id === "skills" || tutorial.emphasisTarget === "skills") return true;
    const guidance = `${text(save?.guidance?.title)} ${text(save?.guidance?.detail)} ${text(tutorial.title)} ${text(tutorial.body)}`;
    const domGuidance = `${text(document.getElementById("guidanceTitle")?.textContent)} ${text(document.getElementById("tutorialBody")?.textContent)}`;
    return /スキル|技を覚|能力を開/u.test(`${guidance} ${domGuidance}`);
  }

  function movementIsUnlocked(save) {
    const tutorial = tutorialView(save);
    if (tutorial.unlocked?.movement === true) return true;
    if (tutorial.unlocked?.movement === false) return false;
    const stage = text(tutorial.stage);
    if (EARLY_TUTORIAL_STAGES.has(stage)) return false;
    return !stage || MOVEMENT_TUTORIAL_STAGES.has(stage);
  }

  function guidanceRequestsMovement(save) {
    const guidance = save?.guidance ?? {};
    if (guidance.actionPanel === "movement" || guidance.targetFacilityId) return true;
    const content = `${text(guidance.title)} ${text(guidance.detail)} ${text(document.getElementById("guidanceTitle")?.textContent)} ${text(document.getElementById("guidanceDetail")?.textContent)}`;
    return /移動|へ向か|へ戻|連れ帰/u.test(content);
  }

  function movementButtonLabel(save) {
    const guidance = save?.guidance ?? {};
    const title = text(guidance.title, text(document.getElementById("guidanceTitle")?.textContent));
    const finnReturn = [...runtime.missions.values()].some((mission) => missionIsFinnRescue(mission) && missionRequiresReturn(mission));
    if (finnReturn) return "フィンと村の広場へ移動する";
    const explicitTarget = text(guidance.targetFacilityName);
    if (explicitTarget) return `${explicitTarget}へ移動する`;
    const titleTarget = title.match(/^(.+?)へ(?:：|$)/u)?.[1];
    return titleTarget ? `${titleTarget}へ移動する` : "移動する";
  }

  function ensureProgressionActions() {
    const storyConsole = document.getElementById("storyConsole");
    const decisionTray = document.getElementById("decisionTray");
    if (!storyConsole || !decisionTray) return null;
    let container = document.getElementById("progressionActions");
    if (container) return container;

    container = document.createElement("section");
    container.id = "progressionActions";
    container.className = "progression-actions";
    container.hidden = true;
    container.setAttribute("aria-label", "進行に必要な操作");

    const notice = document.createElement("p");
    notice.id = "progressionNotice";
    notice.className = "progression-notice";
    notice.hidden = true;

    const skillButton = document.createElement("button");
    skillButton.id = "progressionSkillButton";
    skillButton.type = "button";
    skillButton.className = "progression-action is-primary";
    skillButton.textContent = "スキルを取得して捜索を続ける";
    skillButton.hidden = true;
    skillButton.addEventListener("click", () => {
      const button = document.querySelector('[data-open-panel="skills"]');
      if (button instanceof HTMLButtonElement) button.click();
    });

    const movementButton = document.createElement("button");
    movementButton.id = "progressionMovementButton";
    movementButton.type = "button";
    movementButton.className = "progression-action is-secondary";
    movementButton.textContent = "移動する";
    movementButton.hidden = true;
    movementButton.addEventListener("click", () => {
      const button = document.getElementById("locationButton");
      if (button instanceof HTMLButtonElement) button.click();
    });

    container.append(notice, skillButton, movementButton);
    decisionTray.insertAdjacentElement("afterend", container);
    return container;
  }

  function setChoiceSkillLock(locked) {
    const heading = document.getElementById("choiceHeading");
    if (heading) {
      if (locked) {
        if (!heading.dataset.p0OriginalText) heading.dataset.p0OriginalText = heading.textContent;
        heading.textContent = "先に戦闘準備をしよう";
      } else if (heading.dataset.p0OriginalText) {
        heading.textContent = heading.dataset.p0OriginalText;
        delete heading.dataset.p0OriginalText;
      }
    }

    document.querySelectorAll("#choiceRegion .choice-button").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (locked && !button.disabled) {
        button.dataset.p0SkillLocked = "true";
        button.disabled = true;
      } else if (!locked && button.dataset.p0SkillLocked === "true") {
        button.disabled = false;
        delete button.dataset.p0SkillLocked;
      }
    });
    document.getElementById("decisionTray")?.classList.toggle("is-skill-locked", locked);
  }

  function syncProgressionActions() {
    runtime.syncQueued = false;
    const save = runtime.save;
    const container = ensureProgressionActions();
    if (!container) return;

    const gameScreen = document.getElementById("gameScreen");
    const battleDialog = document.getElementById("battleDialog");
    const gameVisible = gameScreen && !gameScreen.hidden;
    const battleOpen = battleDialog instanceof HTMLDialogElement && battleDialog.open;
    const skillRequired = gameVisible && !battleOpen && skillPrimerRequired(save);
    const movementVisible = gameVisible && !battleOpen && movementIsUnlocked(save);
    const movementRecommended = movementVisible && guidanceRequestsMovement(save);

    const notice = document.getElementById("progressionNotice");
    const skillButton = document.getElementById("progressionSkillButton");
    const movementButton = document.getElementById("progressionMovementButton");

    if (notice) {
      notice.hidden = !skillRequired;
      notice.textContent = skillRequired
        ? "この先では戦闘が起こります。中央の3択を繰り返す前に、所持SPで使う技を一つ取得してください。"
        : "";
    }
    if (skillButton) skillButton.hidden = !skillRequired;
    if (movementButton) {
      movementButton.hidden = !movementVisible;
      movementButton.textContent = movementButtonLabel(save);
      movementButton.classList.toggle("is-recommended", movementRecommended && !skillRequired);
    }

    container.hidden = !(skillRequired || movementVisible);
    container.classList.toggle("is-skill-primer", skillRequired);
    setChoiceSkillLock(skillRequired);
  }

  function scheduleProgressionSync() {
    if (runtime.syncQueued) return;
    runtime.syncQueued = true;
    window.requestAnimationFrame(syncProgressionActions);
  }

  function acceptSave(save) {
    if (!save || typeof save !== "object") return;
    const previousSkillCount = learnedSkillCount(runtime.save);
    const nextSkillCount = learnedSkillCount(save);
    compareMissionLifecycle(storyMissions(save));
    runtime.save = save;
    if (previousSkillCount === 0 && nextSkillCount > 0) {
      enqueueToast({
        kicker: "戦闘準備完了",
        title: "新しいスキルを取得した",
        detail: "中央の選択肢から、フィンの捜索を続けられる。",
        tone: "complete",
        dedupeKey: `skill-primer-complete:${nextSkillCount}`,
      });
    }
    scheduleProgressionSync();
  }

  function observeJsonPayload(payload) {
    const save = findSave(payload);
    if (save) acceptSave(save);
  }

  function requestUrl(input) {
    if (typeof input === "string") return input;
    if (input instanceof URL) return input.href;
    if (input instanceof Request) return input.url;
    return "";
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = requestUrl(args[0]);
    if (API_ROUTE_PATTERN.test(url)) {
      response.clone().json().then(observeJsonPayload).catch(() => {});
    }
    return response;
  };

  function initializeDomObservers() {
    const region = toastRegion();
    if (region) {
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "false");
    }
    ensureProgressionActions();
    const observer = new MutationObserver(scheduleProgressionSync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "open", "aria-hidden"],
    });
    scheduleProgressionSync();
    drainToastQueue();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeDomObservers, { once: true });
  } else {
    initializeDomObservers();
  }

  window.__trpgP0Ux = Object.freeze({
    observeJsonPayload,
    syncProgressionActions,
  });
})();
