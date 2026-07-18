const COMBAT_TROUBLE = /モンスター|魔物|軍事|暗殺|人身売買|古代|侵攻|襲撃|暴動|密輸/u;
const SOCIAL_TROUBLE = /政治|外交|差別|排斥|労働|立ち退き|毒殺|暗殺|人身売買/u;

export function experienceToNextLevel(level) {
  return Math.floor(100 * (1.22 ** Math.max(0, Number(level) - 1)));
}

function round10(value) {
  return Math.max(10, Math.round(Number(value) / 10) * 10);
}

export function troubleDifficulty(trouble) {
  const activeDays = Math.max(1, Number(trouble.finalDay) - Number(trouble.startDay) + 1);
  let score = 1;
  if (activeDays <= 3) score += 2;
  else if (activeDays <= 7) score += 1;
  if (COMBAT_TROUBLE.test(`${trouble.category} ${trouble.name}`)) score += 1;
  if (SOCIAL_TROUBLE.test(`${trouble.category} ${trouble.name}`)) score += 1;
  if (["T13", "T15", "T16", "T17", "T18", "T19"].includes(trouble.id)) score += 3;
  return Math.max(1, Math.min(10, score));
}

function eventEncounterForTrouble(trouble, battleData) {
  const direct = battleData.encounters
    .filter((encounter) => String(encounter.condition ?? "").includes(trouble.id))
    .sort((left, right) => {
      const leftEvent = left.avoidability === "event" ? 0 : 1;
      const rightEvent = right.avoidability === "event" ? 0 : 1;
      return leftEvent - rightEvent || left.dangerTier - right.dangerTier || left.id.localeCompare(right.id);
    });
  if (direct.length) return direct[0].id;
  const sameRegion = battleData.encounters
    .filter((encounter) => trouble.primaryLocations.includes(encounter.region))
    .sort((left, right) => left.dangerTier - right.dangerTier || left.id.localeCompare(right.id));
  return sameRegion[0]?.id ?? null;
}

function facilitiesForTrouble(trouble, model) {
  const directlyRelated = model.facilities
    .filter((facility) => facility.relatedTroubleIds.includes(trouble.id))
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
  if (directlyRelated.length) return directlyRelated;
  return trouble.primaryLocations.flatMap((hub) => model.facilitiesByHub[hub] ?? []);
}

function chooseFacility(facilities, hub, pattern, fallbackIndex = 0) {
  const inHub = facilities.filter((facility) => facility.hub === hub);
  return inHub.find((facility) => pattern.test(`${facility.name} ${facility.type} ${facility.function}`))
    ?? inHub[fallbackIndex]
    ?? facilities.find((facility) => facility.hub === hub)
    ?? null;
}

function specialSteps(trouble, difficulty, encounterId, model) {
  const facilities = facilitiesForTrouble(trouble, model);
  const firstHub = trouble.primaryLocations[0];
  const lastHub = trouble.primaryLocations.at(-1) ?? firstHub;
  const hearFacility = chooseFacility(facilities, firstHub, /広場|役所|詰所|宿|酒場|市場|港|寺院|神殿|集会|本部/u, 0);
  const investigateFacility = chooseFacility(facilities, firstHub, /現場|外れ|小屋|倉庫|坑道|森|庭|研究|工房|港|地下|遺跡|世界樹/u, Math.min(1, Math.max(0, facilities.length - 1)));
  const resolveFacility = chooseFacility(facilities, lastHub, /役所|本部|広場|王城|議会|神殿|詰所|宿|集会|門/u, 0);

  if (trouble.id === "T01") {
    const village = model.facilitiesByHub["田園の村"] ?? [];
    const square = chooseFacility(village, "田園の村", /広場|掲示板|宿/u, 0);
    const outskirts = chooseFacility(village, "田園の村", /見張り|外れ|馬小屋|畑/u, Math.min(1, Math.max(0, village.length - 1)));
    return [
      { id: "hear", type: "conversation", targetLocation: "田園の村", targetFacilityId: square?.id ?? null, required: 1, label: "村で少年の行方を聞く" },
      { id: "search", type: "investigate", targetLocation: "田園の村", targetFacilityId: outskirts?.id ?? square?.id ?? null, required: 2, label: "村外れと見張り小屋道を捜索する" },
      { id: "rescue", type: "battle", targetLocation: "田園の村", targetFacilityId: outskirts?.id ?? null, encounterId, required: 1, label: "赤牙狼の兆候を退ける" },
      { id: "decide", type: "resolve", targetLocation: "田園の村", targetFacilityId: square?.id ?? null, required: 1, label: "少年を連れ帰る" },
    ];
  }

  const steps = [
    {
      id: "hear",
      type: "conversation",
      targetLocation: firstHub,
      targetFacilityId: hearFacility?.id ?? null,
      required: 1,
      label: `${trouble.name}の手掛かりを聞く`,
    },
    {
      id: "investigate",
      type: "investigate",
      targetLocation: firstHub,
      targetFacilityId: investigateFacility?.id ?? hearFacility?.id ?? null,
      required: Math.max(1, Math.ceil(difficulty / 3)),
      label: `${trouble.name}を調査する`,
    },
  ];
  if (COMBAT_TROUBLE.test(`${trouble.category} ${trouble.name}`) && encounterId) {
    steps.push({
      id: "battle",
      type: "battle",
      targetLocation: investigateFacility?.hub ?? firstHub,
      targetFacilityId: investigateFacility?.id ?? null,
      encounterId,
      required: difficulty >= 8 ? 2 : 1,
      label: `${trouble.name}に関係する脅威を排除する`,
    });
  }
  steps.push({
    id: "resolve",
    type: "resolve",
    targetLocation: lastHub,
    targetFacilityId: resolveFacility?.id ?? null,
    required: 1,
    label: `${trouble.name}への最終対応を選ぶ`,
  });
  return steps;
}

export function createSpecialMission(trouble, battleData, model, tuning = {}) {
  const difficulty = troubleDifficulty(trouble);
  const encounterId = eventEncounterForTrouble(trouble, battleData);
  const multiplier = Number(tuning.missionExpMultiplier ?? 1);
  const specialMultiplier = Number(tuning.specialMissionExpMultiplier ?? 1);
  const activeDays = Math.max(1, Number(trouble.finalDay) - Number(trouble.startDay) + 1);
  const urgency = Math.max(0, 8 - activeDays);
  const steps = specialSteps(trouble, difficulty, encounterId, model);
  const weightedSteps = steps.reduce((sum, step) => sum + Number(step.required ?? 1), 0);
  const rawReward = trouble.id === "T01"
    ? 85
    : 50 + difficulty * 24 + weightedSteps * 10 + urgency * 5;
  return {
    id: `MSN-${trouble.id}`,
    kind: "special",
    troubleId: trouble.id,
    title: trouble.name,
    difficulty,
    startDay: trouble.startDay,
    deadlineDay: trouble.deadlineDay,
    finalDay: trouble.finalDay,
    targetLocations: [...trouble.primaryLocations],
    expReward: round10(rawReward * multiplier * specialMultiplier),
    goldReward: round10((5 + difficulty * 5) * (1 + difficulty / 8)),
    steps,
    sourceText: {
      trueCause: trouble.trueCause,
      resolutionMethods: trouble.resolutionMethods,
      successEffects: trouble.successEffects,
      failureEffects: trouble.failureEffects,
    },
  };
}

function permanentMission(id, chainId, tier, title, metric, target, expReward, difficulty, previousMissionId = null) {
  return {
    id,
    chainId,
    tier,
    kind: "permanent",
    title,
    metric,
    target,
    expReward,
    difficulty,
    repeatable: false,
    previousMissionId,
  };
}

const PERMANENT_CHAINS = Object.freeze([
  { id: "kill", metric: "progress.combat.totalKills", rows: [[5, 50, 1], [20, 180, 3], [60, 520, 6], [150, 1200, 9]], title: (n) => `魔物を${n}体倒す` },
  { id: "walk", metric: "progress.walkMinutes.total", rows: [[60, 45, 1], [300, 160, 3], [900, 480, 6], [2400, 1100, 9]], title: (n) => `${n / 60}時間歩く` },
  { id: "hub", metric: "progress.travel.distinctHubs", rows: [[3, 60, 1], [6, 220, 4], [9, 650, 7], [11, 1300, 9]], title: (n) => `${n}つの地域を訪れる` },
  { id: "facility", metric: "progress.travel.distinctFacilities", rows: [[6, 50, 1], [20, 190, 4], [50, 600, 7], [85, 1400, 10]], title: (n) => `${n}か所の地域内施設を訪れる` },
  { id: "win", metric: "progress.battles.wins", rows: [[3, 70, 2], [12, 260, 4], [35, 800, 7], [80, 1800, 10]], title: (n) => `戦闘に${n}回勝つ` },
  { id: "investigate", metric: "progress.investigation.total", rows: [[3, 60, 1], [12, 220, 4], [30, 650, 7], [70, 1500, 10]], title: (n) => `${n}回調査する` },
  { id: "talk", metric: "progress.social.conversations", rows: [[5, 50, 1], [20, 180, 3], [50, 520, 6], [120, 1200, 9]], title: (n) => `${n}回人と話す` },
  { id: "special", metric: "progress.missions.specialCompleted", rows: [[1, 100, 2], [5, 400, 5], [12, 1100, 8], [18, 2200, 10]], title: (n) => `特別ミッションを${n}件解決する` },
  { id: "earn", metric: "derived.economy.totalEarned", rows: [[30, 40, 1], [120, 150, 3], [350, 450, 6], [900, 1000, 9]], title: (n) => `累計${n}Gを稼ぐ` },
  { id: "spend", metric: "progress.economy.goldSpent", rows: [[20, 40, 1], [80, 160, 3], [250, 500, 6], [700, 1200, 9]], title: (n) => `累計${n}Gを使う` },
  { id: "rumor", metric: "derived.rumors.influence", rows: [[5, 60, 1], [30, 220, 4], [100, 700, 7], [300, 1600, 10]], title: (n) => `噂の影響を${n}点広げる` },
  { id: "skill", metric: "derived.skills.totalUses", rows: [[10, 60, 1], [50, 240, 4], [150, 750, 7], [400, 1700, 10]], title: (n) => `スキルを${n}回使う` },
]);

export function createPermanentMissions(tuning = {}) {
  const multiplier = Number(tuning.missionExpMultiplier ?? 1);
  const result = [];
  for (const chain of PERMANENT_CHAINS) {
    let previousMissionId = null;
    chain.rows.forEach(([target, baseExp, difficulty], index) => {
      const tier = index + 1;
      const suffix = String(target).padStart(3, "0");
      const id = `MSN-${chain.id.toUpperCase()}-${suffix}`;
      result.push(permanentMission(
        id,
        chain.id,
        tier,
        chain.title(target),
        chain.metric,
        target,
        round10(baseExp * multiplier),
        difficulty,
        previousMissionId,
      ));
      previousMissionId = id;
    });
  }
  return result;
}

export function createMissionCatalog(model, battleData, tuning = {}) {
  const permanent = createPermanentMissions(tuning);
  const special = model.troubles.map((trouble) => createSpecialMission(trouble, battleData, model, tuning));
  return {
    schemaVersion: "3.0.0",
    permanent,
    special,
    byId: new Map([...permanent, ...special].map((mission) => [mission.id, mission])),
    permanentChains: Object.fromEntries(PERMANENT_CHAINS.map((chain) => [chain.id, permanent.filter((mission) => mission.chainId === chain.id)])),
  };
}

export function createMissionRuntime(catalog) {
  const entries = [...catalog.permanent, ...catalog.special].map((mission) => [mission.id, {
    id: mission.id,
    status: mission.kind === "permanent" && !mission.previousMissionId ? "active" : "locked",
    progress: {},
    completedAt: null,
    failedAt: null,
    rewardClaimed: false,
    attemptedAt: null,
  }]);
  return Object.fromEntries(entries);
}

export function unlockNextPermanentMission(catalog, runtime, completedMission) {
  if (completedMission.kind !== "permanent") return null;
  const next = catalog.permanent.find((mission) => mission.previousMissionId === completedMission.id);
  if (!next) return null;
  const state = runtime[next.id];
  if (state?.status === "locked") state.status = "active";
  return next;
}

export function getPath(object, path) {
  let value = object;
  for (const segment of String(path).split(".")) {
    if (value == null) return undefined;
    value = value[segment];
  }
  return value;
}

function derivedMetric(gameState, metric) {
  if (metric === "derived.economy.totalEarned") {
    const economy = gameState.progress.economy ?? {};
    return Number(economy.goldFromBattles ?? 0) + Number(economy.goldFromWork ?? 0) + Number(economy.goldEarnedFromSales ?? 0);
  }
  if (metric === "derived.rumors.influence") {
    const rumors = gameState.progress.rumors ?? {};
    if (gameState.tuning?.playerOwnedRumorMissionProgress === true) {
      return Number(rumors.playerRecipients ?? 0) + Number(rumors.playerReplans ?? 0) * 2;
    }
    return Number(rumors.npcRecipients ?? 0) + Number(rumors.npcReplans ?? 0) * 2;
  }
  if (metric === "derived.skills.totalUses") {
    return Number(gameState.progress.combat?.physicalSkillUses ?? 0) + Number(gameState.progress.magic?.totalCasts ?? 0);
  }
  return null;
}

export function checkPermanentMission(mission, gameState) {
  let actual;
  if (mission.metric === "progress.travel.distinctHubs") actual = gameState.progress.travel.visitedHubs.size;
  else if (mission.metric === "progress.travel.distinctFacilities") actual = gameState.progress.travel.visitedFacilities.size;
  else if (mission.metric.startsWith("derived.")) actual = Number(derivedMetric(gameState, mission.metric) ?? 0);
  else actual = Number(getPath(gameState, mission.metric) ?? 0);
  return { actual, complete: actual >= mission.target };
}

export function auditMissionCatalog(catalog, model, battleData) {
  const ids = [...catalog.byId.keys()];
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const invalidSteps = [];
  for (const mission of catalog.special) {
    for (const step of mission.steps) {
      if (step.targetLocation && !model.locations.includes(step.targetLocation)) {
        invalidSteps.push({ missionId: mission.id, stepId: step.id, reason: "unknown_location", value: step.targetLocation });
      }
      if (step.targetFacilityId && !model.facilityById[step.targetFacilityId]) {
        invalidSteps.push({ missionId: mission.id, stepId: step.id, reason: "unknown_facility", value: step.targetFacilityId });
      }
      if (step.encounterId && !battleData.encounterById.has(step.encounterId)) {
        invalidSteps.push({ missionId: mission.id, stepId: step.id, reason: "unknown_encounter", value: step.encounterId });
      }
    }
  }
  const nonMonotonicChains = [];
  for (const [chainId, missions] of Object.entries(catalog.permanentChains)) {
    for (let index = 1; index < missions.length; index += 1) {
      if (missions[index].target <= missions[index - 1].target || missions[index].expReward <= missions[index - 1].expReward) {
        nonMonotonicChains.push(chainId);
        break;
      }
    }
  }
  return {
    ok: duplicateIds.length === 0 && invalidSteps.length === 0 && nonMonotonicChains.length === 0,
    counts: {
      permanentDefinitions: catalog.permanent.length,
      permanentChains: Object.keys(catalog.permanentChains).length,
      initialActivePermanent: catalog.permanent.filter((mission) => !mission.previousMissionId).length,
      special: catalog.special.length,
      total: catalog.permanent.length + catalog.special.length,
    },
    rewardTotals: {
      permanentExp: catalog.permanent.reduce((sum, mission) => sum + mission.expReward, 0),
      specialExp: catalog.special.reduce((sum, mission) => sum + mission.expReward, 0),
    },
    duplicateIds,
    invalidSteps,
    nonMonotonicChains,
  };
}
