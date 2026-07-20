(() => {
  "use strict";

  if (window.__trpgP0UxInstalled) return;
  window.__trpgP0UxInstalled = true;

  const API_ROUTE_PATTERN = /\/api\/trpg(?:\/|$)/u;
  const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);
  const COMPLETED_MISSION_STATUSES = new Set(["completed", "resolved"]);
  const FAILED_MISSION_STATUSES = new Set(["failed", "expired", "unavailable"]);

  const runtime = {
    save: null,
    saveIdentity: "",
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

  function saveIdentity(save) {
    return text(save?.id ?? save?.saveId ?? save?.meta?.saveId);
  }

  function flattenMissions(value, depth = 0) {
    if (!value || depth > 3) return [];
    if (Array.isArray(value)) return value.flatMap((entry) => flattenMissions(entry, depth + 1));
    if (typeof value !== "object") return [];
    if (value.id || value.missionId) return [value];
    return Object.values(value).flatMap((entry) => flattenMissions(entry, depth + 1));
  }

  function normalizeMission(raw) {
    const id = text(raw?.id ?? raw?.missionId);
    if (!id) return null;
    const currentStep = raw?.currentStep && typeof raw.currentStep === "object" ? raw.currentStep : null;
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
      title: text(raw?.title ?? raw?.name, "依頼"),
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

  function toastRegion() {
    return document.getElementById("missionToastRegion");
  }

  function clickElement(element) {
    if (element && typeof element.click === "function") element.click();
  }

  function openMissionPanel() {
    clickElement(document.querySelector('[data-open-panel="missions"]'));
  }

  function enqueueToast(toast) {
    const key = text(toast.dedupeKey, `${toast.kicker}:${toast.title}:${toast.detail}`);
    const now = Date.now();
    if (now - (runtime.recentToastKeys.get(key) ?? 0) < 4_000) return;
    runtime.recentToastKeys.set(key, now);
    runtime.toastQueue.push(toast);
    drainToastQueue();
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
    const kicker = element.querySelector(".mission-toast-kicker");
    const title = element.querySelector("strong");
    const detail = element.querySelector(".mission-toast-detail");
    kicker.textContent = text(toast.kicker, "依頼");
    title.textContent = text(toast.title, "状況が変わった");
    detail.textContent = text(toast.detail, "巻物から記録を確認できる。");
    element.setAttribute("aria-label", `${kicker.textContent}。${title.textContent}。${detail.textContent}`);

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      element.classList.remove("is-visible");
      window.setTimeout(() => {
        element.remove();
        runtime.toastActive = false;
        drainToastQueue();
      }, 180);
    };

    element.addEventListener("click", () => {
      dismiss();
      openMissionPanel();
    });
    region.append(element);
    requestAnimationFrame(() => element.classList.add("is-visible"));
    window.setTimeout(dismiss, Number(toast.durationMs ?? 4_800));
  }

  function compareMissionLifecycle(nextMissions, save) {
    if (!runtime.baselineReady) {
      runtime.missions = nextMissions;
      runtime.baselineReady = true;
      return;
    }

    for (const [id, next] of nextMissions) {
      const previous = runtime.missions.get(id);
      if (!previous) {
        const missionTutorialAlreadyVisible = save?.tutorial?.id === "mission-log";
        if (ACTIVE_MISSION_STATUSES.has(next.status) && !missionTutorialAlreadyVisible) {
          enqueueToast({
            kicker: "依頼発生",
            title: next.title,
            detail: next.stepLabel || "巻物に新しい依頼が記された。",
            tone: "start",
            dedupeKey: `mission-start:${id}:${next.status}`,
          });
        }
        continue;
      }

      if (!ACTIVE_MISSION_STATUSES.has(previous.status) && ACTIVE_MISSION_STATUSES.has(next.status)) {
        if (save?.tutorial?.id !== "mission-log") {
          enqueueToast({
            kicker: "依頼発生",
            title: next.title,
            detail: next.stepLabel || "巻物に新しい依頼が記された。",
            tone: "start",
            dedupeKey: `mission-start:${id}:${next.status}`,
          });
        }
        continue;
      }

      if (!COMPLETED_MISSION_STATUSES.has(previous.status) && COMPLETED_MISSION_STATUSES.has(next.status)) {
        enqueueToast({
          kicker: "依頼完了",
          title: next.title,
          detail: "この出来事は旅の記録へ残された。",
          tone: "complete",
          durationMs: 6_000,
          dedupeKey: `mission-complete:${id}:${next.status}`,
        });
        continue;
      }

      if (!FAILED_MISSION_STATUSES.has(previous.status) && FAILED_MISSION_STATUSES.has(next.status)) {
        enqueueToast({
          kicker: "依頼失敗",
          title: next.title,
          detail: "期限か状況が変わった。巻物から結末を確認できる。",
          tone: "failed",
          durationMs: 6_000,
          dedupeKey: `mission-failed:${id}:${next.status}`,
        });
        continue;
      }

      const finnReturn = ACTIVE_MISSION_STATUSES.has(next.status)
        && missionIsFinnRescue(next)
        && missionRequiresReturn(next)
        && !missionRequiresReturn(previous)
        && missionStepKey(previous) !== missionStepKey(next);
      if (finnReturn) {
        enqueueToast({
          kicker: "救出成功",
          title: "フィンは生きている",
          detail: next.stepLabel || "負傷したフィンを村へ連れ帰ろう。",
          tone: "rescue",
          durationMs: 6_500,
          dedupeKey: `mission-rescue:${id}:${missionStepKey(next)}`,
        });
      }
    }

    runtime.missions = nextMissions;
  }

  function skillTutorialRequiresChoicePause(save) {
    return save?.tutorial?.id === "skills" && learnedSkillCount(save) === 0;
  }

  function syncContextualTutorialGuard() {
    runtime.syncQueued = false;
    const pauseChoices = skillTutorialRequiresChoicePause(runtime.save);
    const tray = document.getElementById("decisionTray");
    tray?.classList.toggle("is-context-tutorial-paused", pauseChoices);

    document.querySelectorAll("#choiceRegion .choice-button").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (pauseChoices && !button.disabled) {
        button.dataset.p0TutorialLocked = "true";
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
      } else if (!pauseChoices && button.dataset.p0TutorialLocked === "true") {
        button.disabled = false;
        button.removeAttribute("aria-disabled");
        delete button.dataset.p0TutorialLocked;
      }
    });
  }

  function scheduleTutorialSync() {
    if (runtime.syncQueued) return;
    runtime.syncQueued = true;
    requestAnimationFrame(syncContextualTutorialGuard);
  }

  function resetForDifferentSave(nextIdentity) {
    runtime.save = null;
    runtime.saveIdentity = nextIdentity;
    runtime.missions = new Map();
    runtime.baselineReady = false;
    runtime.toastQueue.length = 0;
    runtime.toastActive = false;
    toastRegion()?.replaceChildren();
  }

  function acceptSave(save) {
    if (!save || typeof save !== "object") return;
    const nextIdentity = saveIdentity(save);
    if (runtime.save && runtime.saveIdentity && nextIdentity && runtime.saveIdentity !== nextIdentity) {
      resetForDifferentSave(nextIdentity);
    }

    compareMissionLifecycle(storyMissions(save), save);
    runtime.save = save;
    runtime.saveIdentity = nextIdentity || runtime.saveIdentity;
    scheduleTutorialSync();
  }

  function observeJsonPayload(payload) {
    const save = findSave(payload);
    if (save) acceptSave(save);
  }

  function requestUrl(input) {
    if (typeof input === "string") return input;
    if (typeof URL !== "undefined" && input instanceof URL) return input.href;
    if (typeof Request !== "undefined" && input instanceof Request) return input.url;
    return "";
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (API_ROUTE_PATTERN.test(requestUrl(args[0]))) {
      response.clone().json().then(observeJsonPayload).catch(() => {});
    }
    return response;
  };

  function initialize() {
    const region = toastRegion();
    if (region) {
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "false");
    }
    const observer = new MutationObserver(scheduleTutorialSync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["hidden", "open", "aria-hidden"],
    });
    scheduleTutorialSync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }

  window.__trpgP0Ux = Object.freeze({ observeJsonPayload, syncContextualTutorialGuard });
})();
