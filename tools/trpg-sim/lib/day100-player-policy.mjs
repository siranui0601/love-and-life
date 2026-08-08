const TERMINAL_TROUBLE_STATES = new Set(["resolved", "failed", "suppressed"]);
const TERMINAL_MISSION_STATES = new Set(["completed", "resolved", "failed", "expired", "suppressed", "unavailable"]);
const INFORMATION_PATTERN = /(?:CONCERN|CHANGE|RUMOR|CLUE|INQUIRY|TALK|DIALOGUE|INSPECT|OBSERVE|INVESTIGATE|調べ|尋ね|聞く|話しかけ|様子|噂|手掛かり)/iu;
const SURVIVAL_MEAL_PATTERN = /(?:^EAT:|MEAL|FOOD|食事|食べ|パン)/iu;
const SURVIVAL_REST_PATTERN = /(?:LODGE|SLEEP|CAMP|REST|宿泊|眠|休む|野営)/iu;
const WORK_PATTERN = /(?:WORK_CONFIRM|WORK_OFFER|^WORK:|仕事|手伝)/iu;
const DANGER_TYPES = new Set(["missionBattle", "seekBattle"]);

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function minuteOf(save) {
  return number(save?.clock?.absoluteMinute, (number(save?.clock?.day, 1) - 1) * 1440);
}

function actionText(entry) {
  return `${entry?.actionId ?? entry?.moveId ?? ""} ${entry?.label ?? ""}`;
}

function actionPrice(entry) {
  for (const value of [entry?.price, entry?.cost, entry?.goldCost, entry?.mealPrice]) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  const labelMatch = String(entry?.label ?? "").match(/(?:^|[（(・\s])([0-9]+)G(?:[）)・\s]|$)/u);
  if (labelMatch) return Number(labelMatch[1]);
  const idMatch = String(entry?.actionId ?? "").match(/(?:^|:)([0-9]+)$/u);
  return idMatch ? Number(idMatch[1]) : null;
}

function decisionContextSignature(save) {
  return [
    save?.scene?.location ?? "",
    save?.scene?.facilityId ?? "",
    Number(save?.player?.gold ?? 0),
    Number(save?.player?.freeMeals ?? 0),
    Number(save?.player?.freeLodging ?? 0),
  ].join("|");
}

// 「この食事処では買えなかった」という事実は、腹が減っただけでは覆らない。
// 覆るのは買う手段が増えた時、つまり所持金か無料枠が変わった時だけである。
//
// 以前は空腹度を10刻みで署名へ含めていたため、歩いて空腹が上がるたびに
// 記録が無効化され、同じ食事処を延々と往復していた。Day72までの通し再生では
// 全4200行動のうち1883回が食事処探索移動で、食事は11回しか成立していない。
function resourceContextSignature(save) {
  return [
    Number(save?.player?.gold ?? 0),
    Number(save?.player?.freeMeals ?? 0),
  ].join("|");
}

function mealSourceBlocked(state, facilityId, save) {
  return state.failedMealSourceContexts?.[facilityId] === resourceContextSignature(save);
}

function rejectionReason(outcome) {
  return String(outcome?.reason ?? outcome?.error ?? outcome?.message ?? outcome?.summary ?? outcome?.type ?? "rejected");
}

function isDecisionBlocked(state, key, save) {
  const blocked = state.blockedDecisionKeys?.[key];
  return Boolean(blocked && blocked.contextSignature === decisionContextSignature(save));
}

function mealAffordable(choice, save) {
  if (Number(save?.player?.freeMeals ?? 0) > 0) return true;
  const price = actionPrice(choice);
  return price == null || price <= Number(save?.player?.gold ?? 0);
}

function missionProgress(mission) {
  if (!mission) return 0;
  if (Number.isFinite(Number(mission.progressRatio))) return Number(mission.progressRatio);
  const progress = number(mission.currentStep?.progress);
  const required = Math.max(1, number(mission.currentStep?.required, 1));
  return Math.min(1, progress / required);
}

function troubleDefinition(model, troubleId) {
  return model.troubles.find((trouble) => trouble.id === troubleId) ?? null;
}

function troubleMission(save, troubleId) {
  return (save?.missions ?? []).find((mission) => mission.troubleId === troubleId) ?? null;
}

function knownTrouble(save, troubleId) {
  return (save?.rumors ?? []).some((rumor) => rumor.troubleId === troubleId)
    || Boolean(troubleMission(save, troubleId));
}

export function createDay100CoverageState(model) {
  return {
    schemaVersion: "trpg-day100-player-policy-v1",
    trouble: Object.fromEntries(model.troubles.map((definition) => [definition.id, {
      id: definition.id,
      name: definition.name,
      startDay: definition.startDay,
      deadlineDay: definition.deadlineDay,
      finalDay: definition.finalDay,
      primaryLocations: [...definition.primaryLocations],
      firstRumorMinute: null,
      firstMissionMinute: null,
      firstProgressMinute: null,
      firstPlayerActionMinute: null,
      maximumProgressRatio: 0,
      visitedPrimaryLocations: [],
      missionStatusTimeline: [],
      actionIds: [],
      stalledTurns: 0,
      finalTroubleStatus: null,
      finalMissionStatus: null,
    }])),
    visitedFacilities: {},
    visitedHubs: {},
    recentDecisionKeys: [],
    acknowledgedIntroductionTokens: [],
    blockedDecisionKeys: {},
    knownMealSources: {},
    failedMealSourceContexts: {},
    triedStockIds: [],
    weaponTypesTried: [],
    equippedEquipmentIds: [],
    actionCount: 0,
    acceptedActionCount: 0,
    rejectedActionCount: 0,
    deadEndCount: 0,
    battleCount: 0,
    workCount: 0,
    mealCount: 0,
    mealSearchMoveCount: 0,
    restCount: 0,
    lastObservedMinute: null,
  };
}

function appendUnique(array, value, maximum = 40) {
  if (value == null || value === "" || array.includes(value)) return;
  array.push(value);
  if (array.length > maximum) array.splice(0, array.length - maximum);
}

export function observeDay100Coverage(state, save, decision = null) {
  const minute = minuteOf(save);
  const hub = save?.scene?.location ?? null;
  const facilityId = save?.scene?.facilityId ?? null;
  if (hub) state.visitedHubs[hub] = (state.visitedHubs[hub] ?? 0) + 1;
  if (facilityId) state.visitedFacilities[facilityId] = (state.visitedFacilities[facilityId] ?? 0) + 1;
  const mealPrices = (save?.choices ?? [])
    .filter((choice) => choice.type === "eat" || SURVIVAL_MEAL_PATTERN.test(actionText(choice)))
    .map((choice) => actionPrice(choice))
    .filter((price) => Number.isFinite(price));
  if (facilityId && mealPrices.length) {
    state.knownMealSources[facilityId] = {
      facilityId,
      hub,
      minimumPrice: Math.min(...mealPrices),
    };
  }

  for (const entry of Object.values(state.trouble)) {
    const rumor = (save?.rumors ?? []).find((item) => item.troubleId === entry.id);
    const mission = troubleMission(save, entry.id);
    if (rumor && entry.firstRumorMinute == null) entry.firstRumorMinute = minute;
    if (mission && entry.firstMissionMinute == null) entry.firstMissionMinute = minute;
    const progress = missionProgress(mission);
    entry.maximumProgressRatio = Math.max(entry.maximumProgressRatio, progress);
    if (progress > 0 && entry.firstProgressMinute == null) entry.firstProgressMinute = minute;
    if (hub && entry.primaryLocations.includes(hub)) appendUnique(entry.visitedPrimaryLocations, hub);
    if (mission) {
      const latest = entry.missionStatusTimeline.at(-1);
      const signature = `${mission.status}:${mission.currentStep?.id ?? "none"}:${mission.currentStep?.progress ?? 0}`;
      if (latest?.signature !== signature) {
        entry.missionStatusTimeline.push({
          minute,
          day: save.clock.day,
          status: mission.status,
          stepId: mission.currentStep?.id ?? null,
          progress: mission.currentStep?.progress ?? null,
          required: mission.currentStep?.required ?? null,
          signature,
        });
      }
    }
  }

  if (decision) {
    state.actionCount += 1;
    const key = decision.key ?? `${decision.type}:${decision.actionId ?? decision.moveId ?? decision.reason ?? "unknown"}`;
    state.recentDecisionKeys.push(key);
    if (state.recentDecisionKeys.length > 18) state.recentDecisionKeys.shift();
    const accepted = decision.accepted !== false;
    if (accepted) {
      state.acceptedActionCount += 1;
      delete state.blockedDecisionKeys[key];
    } else {
      state.rejectedActionCount += 1;
      const previous = state.blockedDecisionKeys[key];
      state.blockedDecisionKeys[key] = {
        key,
        count: Number(previous?.count ?? 0) + 1,
        contextSignature: decisionContextSignature(save),
        reason: rejectionReason(decision.outcome),
        minute,
      };
    }
    if (accepted && decision.type === "ACK_NPC_INTRODUCTION") {
      appendUnique(state.acknowledgedIntroductionTokens, decision.payload?.token, 80);
    }
    if (accepted && decision.missionId) {
      const mission = (save?.missions ?? []).find((item) => item.id === decision.missionId);
      const troubleId = mission?.troubleId ?? decision.troubleId;
      const ledger = state.trouble[troubleId];
      if (ledger) {
        ledger.firstPlayerActionMinute ??= minute;
        appendUnique(ledger.actionIds, decision.actionId ?? decision.moveId ?? decision.reason, 80);
      }
    }
    if (accepted && decision.type === "BATTLE") state.battleCount += 1;
    if (accepted && decision.category === "work") state.workCount += 1;
    if (accepted && decision.category === "meal_consumed") state.mealCount += 1;
    if (accepted && decision.category === "meal_search_move") {
      state.mealSearchMoveCount += 1;
      const hasAffordableMeal = (save?.choices ?? []).some((choice) => choice.type === "eat" && mealAffordable(choice, save));
      if (!hasAffordableMeal && facilityId) {
        state.failedMealSourceContexts[facilityId] = resourceContextSignature(save);
      }
    }
    if (accepted && decision.type === "SHOP_TRY") {
      appendUnique(state.triedStockIds, decision.stockId, 100);
      appendUnique(state.weaponTypesTried, decision.weaponType, 40);
    }
    if (accepted && decision.type === "EQUIP") appendUnique(state.equippedEquipmentIds, decision.equipmentId, 100);
    if (accepted && decision.category === "rest") state.restCount += 1;
  }
  state.lastObservedMinute = minute;
  return state;
}

function recentPenalty(state, key) {
  const distance = [...state.recentDecisionKeys].reverse().findIndex((entry) => entry === key);
  if (distance < 0) return 0;
  return Math.max(4, 34 - distance * 4);
}

function choiceDecision(choice, reason, extras = {}) {
  return {
    type: "CHOOSE",
    payload: { choiceId: choice.choiceId },
    actionId: choice.actionId,
    missionId: choice.missionId ?? extras.missionId ?? null,
    stepId: choice.stepId ?? extras.stepId ?? null,
    key: `CHOOSE:${choice.actionId}`,
    label: choice.label,
    reason,
    ...extras,
  };
}

function commandDecision(type, payload, reason, extras = {}) {
  const identity = payload?.skillId ?? payload?.stockId ?? payload?.offerId ?? payload?.loanId
    ?? payload?.rewardId ?? payload?.equipmentId ?? "command";
  return {
    type,
    payload,
    key: String(type) + ":" + String(identity),
    actionId: String(type) + ":" + String(identity),
    reason,
    ...extras,
  };
}

function moveDecision(move, reason, extras = {}) {
  return {
    type: "MOVE",
    payload: { moveId: move.moveId },
    moveId: move.moveId,
    key: `MOVE:${move.moveId}`,
    label: move.label,
    reason,
    ...extras,
  };
}

function findChoice(save, predicate) {
  return (save?.choices ?? []).find(predicate) ?? null;
}

function bestChoice(save, state, predicate, baseScore = 100) {
  return (save?.choices ?? [])
    .filter((choice) => !isDecisionBlocked(state, `CHOOSE:${choice.actionId}`, save))
    .filter(predicate)
    .map((choice) => ({ choice, score: baseScore - recentPenalty(state, `CHOOSE:${choice.actionId}`) }))
    .sort((left, right) => right.score - left.score || String(left.choice.actionId).localeCompare(String(right.choice.actionId)))[0]?.choice ?? null;
}

function regionalFirstHop(model, from, target) {
  if (!from || !target || from === target) return null;
  const distance = new Map([[from, 0]]);
  const firstHop = new Map();
  const queue = [{ hub: from, cost: 0 }];
  while (queue.length) {
    queue.sort((left, right) => left.cost - right.cost || left.hub.localeCompare(right.hub, "ja"));
    const current = queue.shift();
    if (current.cost !== distance.get(current.hub)) continue;
    if (current.hub === target) return firstHop.get(target) ?? null;
    for (const edge of model.adjacency?.[current.hub] ?? []) {
      const cost = current.cost + number(edge.hours, 1);
      if (cost >= (distance.get(edge.to) ?? Infinity)) continue;
      distance.set(edge.to, cost);
      firstHop.set(edge.to, current.hub === from ? edge.to : firstHop.get(current.hub));
      queue.push({ hub: edge.to, cost });
    }
  }
  return null;
}

function movementToward(save, model, state, { facilityId = null, hub = null } = {}) {
  const movement = (save.movement ?? []).filter((move) => !isDecisionBlocked(state, `MOVE:${move.moveId}`, save));
  if (facilityId) {
    const exact = movement.find((move) => move.destinationFacilityId === facilityId);
    if (exact) return exact;
  }
  if (!hub || hub === save.scene?.location) return null;
  const direct = movement.find((move) => move.destination === hub);
  if (direct) return direct;
  const hop = regionalFirstHop(model, save.scene?.location, hub);
  if (!hop) return null;
  return movement.find((move) => move.destination === hop) ?? null;
}

function facilityLooksLike(move, pattern) {
  return pattern.test(`${move.destinationFacilityName ?? ""} ${move.label ?? ""}`);
}

function skillLearningDecision(save) {
  const learnable = [...(save?.skills?.learnable ?? [])]
    .sort((left, right) => Number(Boolean(right.recommended)) - Number(Boolean(left.recommended))
      || Number(left.spCost ?? left.cost ?? 0) - Number(right.spCost ?? right.cost ?? 0)
      || String(left.id).localeCompare(String(right.id), "en"));
  const skill = learnable[0];
  if (!skill) return null;
  return commandDecision("LEARN_SKILL", { skillId: skill.id }, `取得可能な「${skill.name ?? skill.id}」を覚える`, {
    skillId: skill.id,
    category: "skill_learning",
  });
}

function shopDecision(save, state) {
  const guidedChoice = (save?.choices ?? []).find((choice) => /LOC_CAP_WEAPON_SHOP|王都武器屋/u.test(actionText(choice)));
  if (guidedChoice) return choiceDecision(guidedChoice, "王都で案内された武器屋を訪ねる", { category: "shop_discovery" });

  const reward = save?.shop?.rewards?.[0];
  if (reward) {
    return commandDecision("CLAIM_EQUIPMENT_REWARD", { rewardId: reward.rewardId }, "依頼で得た装備報酬を受け取る", {
      equipmentId: reward.equipmentId,
      category: "equipment_reward",
    });
  }
  if (!save?.shop?.available) return null;

  const stock = save.shop.stock ?? [];
  const trial = stock.find((entry) => entry.access?.trial?.available !== false
    && entry.access?.trial
    && !state.triedStockIds.includes(entry.stockId)
    && entry.equipment?.weaponType
    && !state.weaponTypesTried.includes(entry.equipment.weaponType));
  if (trial && state.weaponTypesTried.length < 4) {
    return commandDecision("SHOP_TRY", { stockId: trial.stockId }, `${trial.name}を試し、今の装備と扱いを比べる`, {
      stockId: trial.stockId,
      equipmentId: trial.equipmentId,
      weaponType: trial.equipment.weaponType,
      category: "equipment_trial",
    });
  }

  const equippedIds = new Set(Object.values(save?.player?.equipment ?? {}).map((entry) => entry?.id ?? entry).filter(Boolean));
  const owned = (save?.player?.inventory?.equipment ?? []).find((entry) => entry.weaponType
    && !equippedIds.has(entry.id)
    && !state.equippedEquipmentIds.includes(entry.id));
  if (owned) {
    return commandDecision("EQUIP", { equipmentId: owned.id }, `${owned.name ?? owned.id}を装備して使い心地を確かめる`, {
      equipmentId: owned.id,
      weaponType: owned.weaponType,
      category: "equipment_change",
    });
  }

  const hasActiveBattleMission = (save?.missions ?? []).some((mission) => mission.status === "active"
    && /battle|戦|討伐|護衛/u.test(String(mission.currentStep?.type ?? "") + " " + String(mission.currentStep?.label ?? "")));
  const loanEntry = hasActiveBattleMission && !(save.shop.loans ?? []).length
    ? stock.find((entry) => entry.access?.loan && entry.access.loan.available !== false) : null;
  if (loanEntry) {
    return commandDecision("SHOP_BORROW", { loanId: loanEntry.access.loan.loanId }, `依頼用に${loanEntry.name}を借りる`, {
      equipmentId: loanEntry.equipmentId,
      weaponType: loanEntry.equipment?.weaponType ?? null,
      category: "equipment_loan",
    });
  }

  const usedEntry = stock.find((entry) => entry.access?.used
    && entry.access.used.available !== false
    && Number(entry.access.used.price ?? Infinity) <= Math.max(0, Number(save.player?.gold ?? 0) - 12)
    && entry.equipment?.weaponType
    && !state.weaponTypesTried.includes(entry.equipment.weaponType));
  if (usedEntry) {
    return commandDecision("SHOP_BUY_USED", { offerId: usedEntry.access.used.offerId }, `中古の${usedEntry.name}を購入する`, {
      equipmentId: usedEntry.equipmentId,
      weaponType: usedEntry.equipment.weaponType,
      category: "equipment_purchase",
    });
  }
  return null;
}

function survivalDecision(save, model, state) {
  const needs = save.player?.needs ?? {};
  const hunger = number(needs.hunger);
  const fatigue = number(needs.fatigue);
  const hour = number(save.clock?.hour, Number(String(save.clock?.time ?? "0").split(":")[0]));

  if (hunger >= 72) {
    const meal = bestChoice(save, state, (choice) => (choice.type === "eat" || SURVIVAL_MEAL_PATTERN.test(actionText(choice)))
      && mealAffordable(choice, save), 170);
    if (meal) return choiceDecision(meal, "空腹が強まる前に、支払える食事を取る", { category: "meal_consumed" });
    // 拠点を跨ぐ移動は徒歩1〜6時間かかる。腹が減った人間は、隣町の安い飯を思い出して
    // 歩き出す前に、まず今いる場所で食える所と稼げる口を当たる。順番を逆にすると、
    // 街道を往復するだけで一日が終わる。
    const affordableSources = Object.values(state.knownMealSources ?? {})
      .filter((source) => Number(source.minimumPrice) <= Number(save.player?.gold ?? 0))
      .filter((source) => !mealSourceBlocked(state, source.facilityId, save))
      .sort((left, right) => Number(left.minimumPrice) - Number(right.minimumPrice));
    const hereNow = save.scene?.location;

    const localSource = affordableSources.find((source) => source.hub === hereNow);
    if (localSource) {
      const localMealMove = movementToward(save, model, state, {
        facilityId: localSource.facilityId,
        hub: localSource.hub,
      });
      if (localMealMove) {
        return moveDecision(localMealMove, "同じ土地の、支払える食事処へ戻る", { category: "meal_search_move" });
      }
    }

    const work = bestChoice(save, state, (choice) => WORK_PATTERN.test(actionText(choice)), 160);
    if (work) return choiceDecision(work, "食費を確保するため、いま居る場所で稼ぐ", { category: "work" });

    const remoteSource = affordableSources.find((source) => source.hub !== hereNow);
    if (remoteSource) {
      const knownMealMove = movementToward(save, model, state, { facilityId: null, hub: remoteSource.hub });
      if (knownMealMove) {
        return moveDecision(knownMealMove, "この土地では稼げないので、食える土地へ移る", { category: "meal_search_move" });
      }
    }

    const mealMove = (save.movement ?? [])
      .filter((move) => !isDecisionBlocked(state, `MOVE:${move.moveId}`, save))
      .filter((move) => !mealSourceBlocked(state, move.destinationFacilityId, save))
      .find((move) => facilityLooksLike(move, /宿|食堂|酒場|茶屋|パン|市場/u));
    if (mealMove) return moveDecision(mealMove, "別の食事処で価格や無料の食事を確かめる", { category: "meal_search_move" });
  }

  if (fatigue >= 72 || hour >= 21) {
    const rest = bestChoice(save, state, (choice) => choice.type === "rest" || SURVIVAL_REST_PATTERN.test(actionText(choice)), 165);
    if (rest) return choiceDecision(rest, "行動不能になる前に休息する", { category: "rest" });
    const innMove = (save.movement ?? []).find((move) => facilityLooksLike(move, /宿|旅籠/u));
    if (innMove) return moveDecision(innMove, "宿泊できる施設へ向かう", { category: "rest" });
  }
  return null;
}

function activeMissionDecision(save, model, state) {
  const active = (save.missions ?? [])
    .filter((mission) => mission.kind === "special" && !TERMINAL_MISSION_STATES.has(mission.status))
    .sort((left, right) => number(left.deadlineDay, 999) - number(right.deadlineDay, 999)
      || number(right.progressRatio) - number(left.progressRatio)
      || left.id.localeCompare(right.id));

  for (const mission of active) {
    const missionChoice = bestChoice(save, state, (choice) => choice.missionId === mission.id, 155);
    if (missionChoice) {
      return choiceDecision(missionChoice, `進行中の「${mission.title}」を進める`, {
        missionId: mission.id,
        troubleId: mission.troubleId,
        stepId: mission.currentStep?.id ?? null,
      });
    }
    const targetFacilityId = mission.currentStep?.targetFacilityId ?? mission.targetFacilityId ?? null;
    const targetHub = mission.currentStep?.targetLocation ?? mission.targetLocation ?? null;
    const move = movementToward(save, model, state, { facilityId: targetFacilityId, hub: targetHub });
    if (move) {
      return moveDecision(move, `「${mission.title}」の次の手掛かりへ移動する`, {
        missionId: mission.id,
        troubleId: mission.troubleId,
        stepId: mission.currentStep?.id ?? null,
      });
    }
    if (targetHub === save.scene?.location || !targetHub) {
      const local = bestChoice(save, state, (choice) => INFORMATION_PATTERN.test(actionText(choice)) && !/:END$/iu.test(choice.actionId), 125);
      if (local) {
        return choiceDecision(local, `「${mission.title}」の現地情報を探す`, {
          missionId: mission.id,
          troubleId: mission.troubleId,
          stepId: mission.currentStep?.id ?? null,
        });
      }
      state.trouble[mission.troubleId].stalledTurns += 1;
    }
  }
  return null;
}

function coverageTarget(save, model, state) {
  const day = number(save.clock?.day, 1);
  const candidates = model.troubles
    .filter((definition) => definition.startDay <= day && day <= definition.finalDay)
    .filter((definition) => !TERMINAL_TROUBLE_STATES.has(state.trouble[definition.id]?.finalTroubleStatus))
    .map((definition) => {
      const ledger = state.trouble[definition.id];
      const known = knownTrouble(save, definition.id);
      const progress = ledger.maximumProgressRatio;
      const urgency = Math.max(0, 40 - (definition.deadlineDay - day) * 4);
      const discoveryNeed = known ? 0 : 70;
      const progressNeed = known && progress === 0 ? 35 : 0;
      const visitNeed = ledger.visitedPrimaryLocations.length ? 0 : 20;
      return { definition, score: discoveryNeed + progressNeed + visitNeed + urgency - ledger.stalledTurns * 2 };
    })
    .sort((left, right) => right.score - left.score
      || left.definition.deadlineDay - right.definition.deadlineDay
      || left.definition.id.localeCompare(right.definition.id));
  return candidates[0]?.definition ?? null;
}

function discoveryDecision(save, model, state) {
  const target = coverageTarget(save, model, state);
  if (!target) return null;
  const currentHub = save.scene?.location;
  if (!target.primaryLocations.includes(currentHub)) {
    const destination = target.primaryLocations.find((hub) => movementToward(save, model, state, { hub })) ?? target.primaryLocations[0];
    const move = movementToward(save, model, state, { hub: destination });
    if (move) return moveDecision(move, `${target.id}の発生地域へ向かう`, { troubleId: target.id });
  }

  const information = bestChoice(save, state, (choice) => INFORMATION_PATTERN.test(actionText(choice)) && !/:END$/iu.test(choice.actionId), 120);
  if (information) return choiceDecision(information, `${target.id}の噂や現地の変化を確かめる`, { troubleId: target.id });

  const unvisitedLocal = (save.movement ?? [])
    .filter((move) => move.scope === "local")
    .sort((left, right) => number(state.visitedFacilities[left.destinationFacilityId]) - number(state.visitedFacilities[right.destinationFacilityId]))[0];
  if (unvisitedLocal) return moveDecision(unvisitedLocal, `${target.id}の聞き込み先を変える`, { troubleId: target.id });
  return null;
}

function economyDecision(save, state) {
  const gold = number(save.player?.gold);
  const needs = save.player?.needs ?? {};
  if (gold >= 32 || number(needs.hunger) >= 72 || number(needs.fatigue) >= 72) return null;
  const confirm = bestChoice(save, state, (choice) => /WORK_CONFIRM/iu.test(actionText(choice)), 150);
  if (confirm) return choiceDecision(confirm, "提示済みの短い仕事を引き受ける", { category: "work" });
  const offer = bestChoice(save, state, (choice) => WORK_PATTERN.test(actionText(choice)), 112);
  if (offer) return choiceDecision(offer, "食事と宿代を確保するため仕事を探す", { category: "work" });
  return null;
}

function fallbackDecision(save, model, state) {
  const workConfirm = bestChoice(save, state, (choice) => /WORK_CONFIRM/iu.test(actionText(choice)), 150);
  if (workConfirm) return choiceDecision(workConfirm, "提示済みの仕事を完了する", { category: "work" });

  const wait = bestChoice(save, state, (choice) => ["wait", "rest"].includes(choice.type), 75);
  if (wait) return choiceDecision(wait, "時間を進めて人と世界の変化を待つ", { category: choiceCategory(wait) });

  const localMove = (save.movement ?? [])
    .filter((move) => move.scope === "local")
    .sort((left, right) => number(state.visitedFacilities[left.destinationFacilityId]) - number(state.visitedFacilities[right.destinationFacilityId]))[0];
  if (localMove) return moveDecision(localMove, "まだ確かめていない施設へ移る");

  const regionalMove = (save.movement ?? [])
    .filter((move) => move.scope === "regional")
    .sort((left, right) => number(state.visitedHubs[left.destination]) - number(state.visitedHubs[right.destination]))[0];
  if (regionalMove) return moveDecision(regionalMove, "まだ十分に訪れていない地域へ移る");

  const choice = (save.choices ?? [])
    .map((entry) => ({ entry, penalty: recentPenalty(state, `CHOOSE:${entry.actionId}`) }))
    .sort((left, right) => left.penalty - right.penalty)[0]?.entry;
  return choice ? choiceDecision(choice, "利用可能な行動から停滞しにくいものを選ぶ", { category: choiceCategory(choice) }) : null;
}

function choiceCategory(choice) {
  if (choice?.type === "eat") return "meal_consumed";
  if (choice?.type === "rest" || SURVIVAL_REST_PATTERN.test(actionText(choice))) return "rest";
  if (WORK_PATTERN.test(actionText(choice))) return "work";
  return null;
}

export function selectDay100Decision({ save, model, state }) {
  if (save.world?.ended) return null;
  if (save.battle?.status === "active" || save.battle) return { type: "BATTLE", reason: "進行中の戦闘を権威的なコマンドで完了する", key: `BATTLE:${save.battle?.id ?? "active"}` };

  const acknowledgedIntroductionTokens = state.acknowledgedIntroductionTokens ?? [];
  const introduction = (save.scene?.beats ?? []).find((beat) => beat.introductionToken
    && !acknowledgedIntroductionTokens.includes(beat.introductionToken));
  if (introduction) {
    return {
      type: "ACK_NPC_INTRODUCTION",
      payload: { token: introduction.introductionToken },
      key: `INTRO:${introduction.introductionToken}`,
      reason: "画面に出た自己紹介を読み終えて名前を記録する",
    };
  }
  if (save.tutorial?.acknowledgeable) {
    return {
      type: "TUTORIAL_ACK",
      payload: { tutorialId: save.tutorial.id },
      key: `TUTORIAL:${save.tutorial.id}`,
      reason: "表示済みの案内を確認する",
    };
  }

  const tutorialAction = {
    "first-choice": "TUTORIAL:AWAKEN:LISTEN",
    "first-conversation": "TUTORIAL:CONTACT:WHERE",
    "conversation-depth": "TUTORIAL:ORIENT:VOICES",
    "discover-trouble": "TUTORIAL:INQUIRY:MIRA",
  }[save.tutorial?.id];
  if (tutorialAction) {
    const choice = findChoice(save, (entry) => entry.actionId === tutorialAction);
    if (choice) return choiceDecision(choice, "導入を通常の表示選択肢で進める", { missionId: tutorialAction.includes("INQUIRY") ? "MSN-T01" : null });
  }
  if (save.tutorial?.id === "first-movement") {
    const move = (save.movement ?? []).find((entry) => entry.destinationFacilityId === "LOC_FARM_SQUARE");
    if (move) return moveDecision(move, "導入で案内された村の広場へ向かう");
  }

  return skillLearningDecision(save)
    ?? shopDecision(save, state)
    ?? survivalDecision(save, model, state)
    ?? activeMissionDecision(save, model, state)
    ?? economyDecision(save, state)
    ?? discoveryDecision(save, model, state)
    ?? fallbackDecision(save, model, state);
}

export function finalizeDay100Coverage(state, { save, runtime, model }) {
  for (const definition of model.troubles) {
    const ledger = state.trouble[definition.id];
    const trouble = runtime?.playerState?.troubles?.[definition.id] ?? null;
    const missionDefinition = runtime?.playerState?.catalog?.special?.find((entry) => entry.troubleId === definition.id) ?? null;
    const mission = missionDefinition ? runtime?.playerState?.missions?.[missionDefinition.id] : troubleMission(save, definition.id);
    ledger.finalTroubleStatus = trouble?.status ?? null;
    ledger.finalMissionStatus = mission?.status ?? null;
  }
  const rows = Object.values(state.trouble).map((entry) => ({
    ...entry,
    discovered: entry.firstRumorMinute != null || entry.firstMissionMinute != null,
    engaged: entry.firstPlayerActionMinute != null,
    progressed: entry.firstProgressMinute != null || entry.maximumProgressRatio > 0,
    terminal: TERMINAL_TROUBLE_STATES.has(entry.finalTroubleStatus),
    resolved: entry.finalTroubleStatus === "resolved",
  }));
  const counts = {
    total: rows.length,
    discovered: rows.filter((entry) => entry.discovered).length,
    engaged: rows.filter((entry) => entry.engaged).length,
    progressed: rows.filter((entry) => entry.progressed).length,
    terminal: rows.filter((entry) => entry.terminal).length,
    resolved: rows.filter((entry) => entry.resolved).length,
    failed: rows.filter((entry) => entry.finalTroubleStatus === "failed").length,
    neverDiscovered: rows.filter((entry) => !entry.discovered).length,
  };
  return {
    schemaVersion: "trpg-day100-player-report-v1",
    reachedDay100: Boolean(save.world?.ended && save.clock?.day >= 100),
    finalClock: { ...save.clock },
    finalLocation: save.scene?.location ?? null,
    finalFacilityId: save.scene?.facilityId ?? null,
    finalGold: number(save.player?.gold),
    actions: state.actionCount,
    acceptedActions: state.acceptedActionCount,
    rejectedActions: state.rejectedActionCount,
    blockedDecisionCount: Object.keys(state.blockedDecisionKeys ?? {}).length,
    deadEnds: state.deadEndCount,
    battles: state.battleCount,
    jobs: state.workCount,
    meals: state.mealCount,
    mealSeekingMoves: state.mealSearchMoveCount,
    rests: state.restCount,
    visitedHubCount: Object.keys(state.visitedHubs).length,
    visitedFacilityCount: Object.keys(state.visitedFacilities).length,
    counts,
    troubles: rows,
  };
}

export const DAY100_POLICY_INTERNALS = Object.freeze({
  TERMINAL_TROUBLE_STATES,
  TERMINAL_MISSION_STATES,
  regionalFirstHop,
  movementToward,
  missionProgress,
  actionPrice,
  decisionContextSignature,
  resourceContextSignature,
  mealSourceBlocked,
  isDecisionBlocked,
  mealAffordable,
});
