const COMBAT_TROUBLE = /モンスター|魔物|軍事|暗殺|人身売買|古代|侵攻|襲撃|暴動|密輸/u;
const SOCIAL_TROUBLE = /政治|外交|差別|排斥|労働|立ち退き|毒殺|暗殺|人身売買/u;

const FAMILY_DEFINITIONS = Object.freeze([
  {
    family: "kill",
    metric: "progress.combat.totalKills",
    title: (target) => `魔物を${target}体倒す`,
    targets: [5, 10, 20, 35, 50, 80],
    baseDifficulty: 1,
    reward: (target, tier) => 35 + target * 11 + tier * 12,
    gold: (target, tier) => 3 + target * 0.8 + tier * 2,
  },
  {
    family: "walk",
    metric: "progress.walkMinutes.total",
    title: (target) => `${formatMinutes(target)}歩く`,
    targets: [60, 120, 240, 480, 900, 1500],
    baseDifficulty: 1,
    reward: (target, tier) => 25 + target * 0.32 + tier * 12,
    gold: (target, tier) => 2 + target / 90 + tier,
  },
  {
    family: "facility",
    metric: "progress.travel.distinctFacilities",
    title: (target) => `新しい施設を${target}か所訪れる`,
    targets: [3, 5, 8, 12, 18],
    baseDifficulty: 1,
    reward: (target, tier) => 35 + target * 28 + tier * 16,
    gold: (target, tier) => 4 + target * 1.5 + tier,
  },
  {
    family: "hub",
    metric: "progress.travel.distinctHubs",
    title: (target) => `新しい地域を${target}か所訪れる`,
    targets: [2, 2, 2, 2, 2],
    baseDifficulty: 2,
    reward: (target, tier) => 70 + target * 38 + tier * 24,
    gold: (target, tier) => 8 + target * 4 + tier * 2,
  },
  {
    family: "win",
    metric: "progress.battles.wins",
    title: (target) => `戦闘に${target}回勝つ`,
    targets: [3, 7, 12, 20, 30],
    baseDifficulty: 2,
    reward: (target, tier) => 50 + target * 18 + tier * 22,
    gold: (target, tier) => 5 + target * 1.2 + tier * 2,
  },
  {
    family: "investigate",
    metric: "progress.investigation.total",
    title: (target) => `調査を${target}回行う`,
    targets: [2, 5, 9, 14],
    baseDifficulty: 2,
    reward: (target, tier) => 45 + target * 24 + tier * 20,
    gold: (target, tier) => 4 + target + tier * 2,
  },
  {
    family: "conversation",
    metric: "progress.social.conversations",
    title: (target) => `${target}回、人から話を聞く`,
    targets: [4, 10, 20, 36],
    baseDifficulty: 1,
    reward: (target, tier) => 30 + target * 10 + tier * 16,
    gold: (target, tier) => 3 + target * 0.5 + tier,
  },
  {
    family: "special",
    metric: "progress.missions.specialCompleted",
    title: (target) => `特別ミッションを${target}件解決する`,
    targets: [1, 2, 3, 4, 5],
    baseDifficulty: 3,
    reward: (target, tier) => 90 + target * 55 + tier * 32,
    gold: (target, tier) => 10 + target * 5 + tier * 3,
  },
]);

function formatMinutes(minutes) {
  const value = Number(minutes);
  if (value % 60 === 0) return `${value / 60}時間`;
  return `${value}分`;
}

function round10(value) {
  return Math.max(10, Math.round(Number(value) / 10) * 10);
}

export function experienceToNextLevelV2(level) {
  return Math.floor(100 * (1.22 ** Math.max(0, Number(level) - 1)));
}

export function troubleDifficultyV2(trouble) {
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
  return battleData.encounters
    .filter((encounter) => trouble.primaryLocations.includes(encounter.region))
    .sort((left, right) => left.dangerTier - right.dangerTier || left.id.localeCompare(right.id))[0]?.id ?? null;
}

function relatedFacilities(model, trouble) {
  const exact = model.facilities
    .filter((facility) => facility.relatedTroubleIds.includes(trouble.id))
    .sort((left, right) => left.sourceOrder - right.sourceOrder);
  if (exact.length) return exact;
  return trouble.primaryLocations.flatMap((hub) => model.facilitiesByHub[hub] ?? []).slice(0, 4);
}

function chooseFacility(facilities, hub, offset = 0) {
  const inHub = facilities.filter((facility) => facility.hub === hub);
  const source = inHub.length ? inHub : facilities;
  return source.length ? source[offset % source.length] : null;
}

function resolutionOptions(trouble, difficulty) {
  const text = `${trouble.category} ${trouble.name} ${trouble.resolutionMethods}`;
  if (SOCIAL_TROUBLE.test(text)) {
    return [
      { id: "evidence", label: "証拠を揃えて公にする", focus: "evidence", thresholdModifier: -1, failureSeverity: "retry" },
      { id: "negotiate", label: "関係者を集めて交渉する", focus: "reputation", thresholdModifier: 0, failureSeverity: "retry" },
      { id: "force", label: "強硬に介入する", focus: "combat", thresholdModifier: 1 + Math.floor(difficulty / 4), failureSeverity: "fail" },
    ];
  }
  if (COMBAT_TROUBLE.test(text)) {
    return [
      { id: "prepared", label: "調査結果を使って計画的に制圧する", focus: "evidence", thresholdModifier: -1, failureSeverity: "retry" },
      { id: "direct", label: "正面から脅威を排除する", focus: "combat", thresholdModifier: 0, failureSeverity: "fail" },
      { id: "protect", label: "住民保護を優先して封じ込める", focus: "protection", thresholdModifier: 1, failureSeverity: "partial" },
    ];
  }
  return [
    { id: "investigate", label: "原因を特定して根本対応する", focus: "evidence", thresholdModifier: -1, failureSeverity: "retry" },
    { id: "coordinate", label: "協力者と分担して解決する", focus: "reputation", thresholdModifier: 0, failureSeverity: "partial" },
    { id: "improvise", label: "現場判断で即座に対応する", focus: "combat", thresholdModifier: 1, failureSeverity: "fail" },
  ];
}

function specialSteps(model, trouble, difficulty, encounterId) {
  const facilities = relatedFacilities(model, trouble);
  const firstHub = trouble.primaryLocations[0];
  const lastHub = trouble.primaryLocations.at(-1) ?? firstHub;
  const hearFacility = chooseFacility(facilities, firstHub, 0);
  const investigateFacility = chooseFacility(facilities, firstHub, 1) ?? hearFacility;
  const resolveFacility = chooseFacility(facilities, lastHub, 2) ?? investigateFacility ?? hearFacility;

  if (trouble.id === "T01") {
    const farmFacilities = model.facilitiesByHub["田園の村"] ?? [];
    const square = farmFacilities.find((facility) => facility.id === "LOC_FARM_SQUARE") ?? farmFacilities[0];
    const watch = farmFacilities.find((facility) => /見張り|小屋/u.test(`${facility.name} ${facility.function}`)) ?? farmFacilities.at(-1) ?? square;
    return [
      { id: "hear", type: "conversation", targetHub: "田園の村", targetFacilityId: square?.id ?? null, required: 1, label: "村で少年の行方を聞く" },
      { id: "search", type: "investigate", targetHub: "田園の村", targetFacilityId: watch?.id ?? null, required: 2, label: "村外れと見張り小屋道を捜索する" },
      { id: "rescue", type: "battle", targetHub: "田園の村", targetFacilityId: watch?.id ?? null, encounterId, required: 1, label: "赤牙狼の兆候を退ける" },
      { id: "resolve", type: "resolve", targetHub: "田園の村", targetFacilityId: square?.id ?? null, required: 1, label: "少年を連れ帰る" },
    ];
  }

  const steps = [
    {
      id: "hear",
      type: "conversation",
      targetHub: firstHub,
      targetFacilityId: hearFacility?.id ?? null,
      required: 1,
      label: `${trouble.name}の手掛かりを聞く`,
    },
    {
      id: "investigate",
      type: "investigate",
      targetHub: firstHub,
      targetFacilityId: investigateFacility?.id ?? null,
      required: Math.max(1, Math.ceil(difficulty / 3)),
      label: `${trouble.name}を調査する`,
    },
  ];

  if (difficulty >= 5) {
    steps.push({
      id: "support",
      type: "support",
      targetHub: lastHub,
      targetFacilityId: resolveFacility?.id ?? null,
      required: 1,
      label: `${trouble.name}への協力者と避難手段を整える`,
    });
  }

  if (COMBAT_TROUBLE.test(`${trouble.category} ${trouble.name}`) && encounterId) {
    steps.push({
      id: "battle",
      type: "battle",
      targetHub: lastHub,
      targetFacilityId: resolveFacility?.id ?? null,
      encounterId,
      required: difficulty >= 8 ? 2 : 1,
      label: `${trouble.name}に関係する脅威を排除する`,
    });
  }

  steps.push({
    id: "resolve",
    type: "resolve",
    targetHub: lastHub,
    targetFacilityId: resolveFacility?.id ?? null,
    required: 1,
    label: `${trouble.name}への最終対応を選ぶ`,
  });
  return steps;
}

export function createSpecialMissionV2(model, trouble, battleData, tuning = {}) {
  const difficulty = troubleDifficultyV2(trouble);
  const encounterId = eventEncounterForTrouble(trouble, battleData);
  const base = Number(tuning.specialMissionExpBase ?? 50);
  const multiplier = Number(tuning.missionExpMultiplier ?? 1);
  return {
    id: `MSN2-${trouble.id}`,
    kind: "special",
    troubleId: trouble.id,
    title: trouble.name,
    difficulty,
    startDay: trouble.startDay,
    deadlineDay: trouble.deadlineDay,
    finalDay: trouble.finalDay,
    targetLocations: [...trouble.primaryLocations],
    expReward: round10(base * (difficulty ** 1.3) * multiplier),
    goldReward: round10(6 * difficulty * (1 + difficulty / 8)),
    discoveryMode: "rumor_or_presence",
    steps: specialSteps(model, trouble, difficulty, encounterId),
    resolutionOptions: resolutionOptions(trouble, difficulty),
    sourceText: {
      trueCause: trouble.trueCause,
      resolutionMethods: trouble.resolutionMethods,
      successEffects: trouble.successEffects,
      failureEffects: trouble.failureEffects,
    },
  };
}

function permanentMission(definition, sequence, target, tuning) {
  const multiplier = Number(tuning.missionExpMultiplier ?? 1);
  const difficulty = Math.min(10, definition.baseDifficulty + sequence - 1);
  return {
    id: `MSN2-${definition.family.toUpperCase()}-${String(sequence).padStart(2, "0")}`,
    kind: "permanent",
    family: definition.family,
    sequence,
    title: definition.title(target),
    metric: definition.metric,
    target,
    progressMode: "incremental_since_activation",
    expReward: round10(definition.reward(target, sequence) * multiplier),
    goldReward: Math.max(0, Math.round(definition.gold(target, sequence))),
    difficulty,
    repeatable: false,
    prerequisiteMissionId: sequence > 1
      ? `MSN2-${definition.family.toUpperCase()}-${String(sequence - 1).padStart(2, "0")}`
      : null,
  };
}

export function createPermanentMissionsV2(tuning = {}) {
  return FAMILY_DEFINITIONS.flatMap((definition) =>
    definition.targets.map((target, index) => permanentMission(definition, index + 1, target, tuning))
  );
}

export function createMissionCatalogV2(model, battleData, tuning = {}) {
  const permanent = createPermanentMissionsV2(tuning);
  const special = model.troubles.map((trouble) => createSpecialMissionV2(model, trouble, battleData, tuning));
  return {
    schemaVersion: "2.0.0",
    permanent,
    special,
    byId: new Map([...permanent, ...special].map((mission) => [mission.id, mission])),
    permanentFamilies: Object.fromEntries(FAMILY_DEFINITIONS.map((definition) => [
      definition.family,
      permanent.filter((mission) => mission.family === definition.family),
    ])),
  };
}

export function createMissionRuntimeV2(catalog, state = null) {
  const entries = [];
  for (const mission of catalog.permanent) {
    const active = mission.sequence === 1;
    entries.push([mission.id, {
      id: mission.id,
      status: active ? "active" : "locked",
      progress: {},
      baselineValue: active && state ? missionMetricValueV2(mission, state) : 0,
      activatedAt: active ? state?.absoluteMinute ?? 0 : null,
      discoveredAt: active ? state?.absoluteMinute ?? 0 : null,
      completedAt: null,
      failedAt: null,
      attempts: 0,
      lastAttemptAt: null,
      outcome: null,
    }]);
  }
  for (const mission of catalog.special) {
    entries.push([mission.id, {
      id: mission.id,
      status: "locked",
      progress: {},
      baselineValue: 0,
      activatedAt: null,
      discoveredAt: null,
      completedAt: null,
      failedAt: null,
      attempts: 0,
      lastAttemptAt: null,
      outcome: null,
    }]);
  }
  return Object.fromEntries(entries);
}

export function getPathV2(object, path) {
  let value = object;
  for (const segment of String(path).split(".")) {
    if (value == null) return undefined;
    value = value[segment];
  }
  return value;
}

export function missionMetricValueV2(mission, state) {
  if (mission.metric === "progress.travel.distinctHubs") return state.progress.travel.visitedHubs.size;
  if (mission.metric === "progress.travel.distinctFacilities") return state.progress.travel.visitedFacilities.size;
  return Number(getPathV2(state, mission.metric) ?? 0);
}

export function checkPermanentMissionV2(mission, runtime, state) {
  const actual = missionMetricValueV2(mission, state);
  const baseline = Number(runtime.baselineValue ?? 0);
  const progress = Math.max(0, actual - baseline);
  return { actual, baseline, progress, complete: progress >= mission.target };
}

export function activateNextPermanentMissionV2(catalog, missionRuntime, completedMission, state) {
  if (completedMission.kind !== "permanent") return null;
  const next = catalog.permanentFamilies[completedMission.family]
    ?.find((mission) => mission.sequence === completedMission.sequence + 1);
  if (!next) return null;
  const runtime = missionRuntime[next.id];
  if (!runtime || runtime.status !== "locked") return null;
  runtime.status = "active";
  runtime.baselineValue = missionMetricValueV2(next, state);
  runtime.activatedAt = state.absoluteMinute;
  runtime.discoveredAt = state.absoluteMinute;
  return next;
}

export function missionCatalogStatsV2(catalog) {
  return {
    total: catalog.permanent.length + catalog.special.length,
    permanent: catalog.permanent.length,
    special: catalog.special.length,
    permanentFamilies: Object.fromEntries(Object.entries(catalog.permanentFamilies).map(([family, missions]) => [family, missions.length])),
  };
}
