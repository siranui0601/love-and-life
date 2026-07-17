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

function specialSteps(trouble, difficulty, encounterId) {
  if (trouble.id === "T01") {
    return [
      { id: "hear", type: "conversation", targetLocation: "田園の村", required: 1, label: "村で少年の行方を聞く" },
      { id: "search", type: "investigate", targetLocation: "田園の村", required: 2, label: "村外れと見張り小屋道を捜索する" },
      { id: "rescue", type: "battle", encounterId, required: 1, label: "赤牙狼の兆候を退ける" },
      { id: "decide", type: "resolve", targetLocation: "田園の村", required: 1, label: "少年を連れ帰る" },
    ];
  }
  const steps = [
    {
      id: "hear",
      type: "conversation",
      targetLocation: trouble.primaryLocations[0],
      required: 1,
      label: `${trouble.name}の手掛かりを聞く`,
    },
    {
      id: "investigate",
      type: "investigate",
      targetLocation: trouble.primaryLocations[0],
      required: Math.max(1, Math.ceil(difficulty / 3)),
      label: `${trouble.name}を調査する`,
    },
  ];
  if (COMBAT_TROUBLE.test(`${trouble.category} ${trouble.name}`) && encounterId) {
    steps.push({
      id: "battle",
      type: "battle",
      encounterId,
      required: difficulty >= 7 ? 2 : 1,
      label: `${trouble.name}に関係する脅威を排除する`,
    });
  }
  steps.push({
    id: "resolve",
    type: "resolve",
    targetLocation: trouble.primaryLocations.at(-1) ?? trouble.primaryLocations[0],
    required: 1,
    label: `${trouble.name}への最終対応を選ぶ`,
  });
  return steps;
}

export function createSpecialMission(trouble, battleData, tuning = {}) {
  const difficulty = troubleDifficulty(trouble);
  const encounterId = eventEncounterForTrouble(trouble, battleData);
  const base = Number(tuning.specialMissionExpBase ?? 115);
  const multiplier = Number(tuning.missionExpMultiplier ?? 1);
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
    expReward: round10(base * (difficulty ** 1.45) * multiplier),
    goldReward: round10(8 * difficulty * (1 + difficulty / 6)),
    steps: specialSteps(trouble, difficulty, encounterId),
    sourceText: {
      trueCause: trouble.trueCause,
      resolutionMethods: trouble.resolutionMethods,
      successEffects: trouble.successEffects,
      failureEffects: trouble.failureEffects,
    },
  };
}

function permanentMission(id, title, metric, target, expReward, tier, extra = {}) {
  return {
    id,
    kind: "permanent",
    title,
    metric,
    target,
    expReward,
    difficulty: tier,
    repeatable: false,
    ...extra,
  };
}

export function createPermanentMissions(tuning = {}) {
  const multiplier = Number(tuning.missionExpMultiplier ?? 1);
  const scale = (value) => round10(value * multiplier);
  return [
    permanentMission("MSN-KILL-005", "魔物を5体倒す", "progress.combat.totalKills", 5, scale(70), 1),
    permanentMission("MSN-KILL-015", "魔物を15体倒す", "progress.combat.totalKills", 15, scale(150), 2),
    permanentMission("MSN-KILL-040", "魔物を40体倒す", "progress.combat.totalKills", 40, scale(330), 4),
    permanentMission("MSN-KILL-100", "魔物を100体倒す", "progress.combat.totalKills", 100, scale(760), 7),
    permanentMission("MSN-WALK-060", "1時間歩く", "progress.walkMinutes.total", 60, scale(45), 1),
    permanentMission("MSN-WALK-180", "3時間歩く", "progress.walkMinutes.total", 180, scale(100), 2),
    permanentMission("MSN-WALK-600", "10時間歩く", "progress.walkMinutes.total", 600, scale(240), 4),
    permanentMission("MSN-WALK-1200", "20時間歩く", "progress.walkMinutes.total", 1200, scale(520), 6),
    permanentMission("MSN-VISIT-003", "3つの拠点を訪れる", "progress.travel.distinctHubs", 3, scale(80), 1),
    permanentMission("MSN-VISIT-006", "6つの拠点を訪れる", "progress.travel.distinctHubs", 6, scale(180), 3),
    permanentMission("MSN-VISIT-010", "10の拠点を訪れる", "progress.travel.distinctHubs", 10, scale(420), 6),
    permanentMission("MSN-WIN-005", "戦闘に5回勝つ", "progress.battles.wins", 5, scale(90), 2),
    permanentMission("MSN-WIN-020", "戦闘に20回勝つ", "progress.battles.wins", 20, scale(260), 4),
    permanentMission("MSN-WIN-050", "戦闘に50回勝つ", "progress.battles.wins", 50, scale(620), 7),
    permanentMission("MSN-SPECIAL-001", "特別ミッションを1件解決する", "progress.missions.specialCompleted", 1, scale(120), 2),
    permanentMission("MSN-SPECIAL-005", "特別ミッションを5件解決する", "progress.missions.specialCompleted", 5, scale(420), 5),
    permanentMission("MSN-SPECIAL-010", "特別ミッションを10件解決する", "progress.missions.specialCompleted", 10, scale(900), 8),
  ];
}

export function createMissionCatalog(model, battleData, tuning = {}) {
  return {
    permanent: createPermanentMissions(tuning),
    special: model.troubles.map((trouble) => createSpecialMission(trouble, battleData, tuning)),
  };
}

export function createMissionRuntime(catalog) {
  const entries = [...catalog.permanent, ...catalog.special].map((mission) => [mission.id, {
    id: mission.id,
    status: mission.kind === "permanent" ? "active" : "locked",
    progress: {},
    completedAt: null,
    failedAt: null,
    rewardClaimed: false,
  }]);
  return Object.fromEntries(entries);
}

export function getPath(object, path) {
  let value = object;
  for (const segment of String(path).split(".")) {
    if (value == null) return undefined;
    value = value[segment];
  }
  return value;
}

export function checkPermanentMission(mission, gameState) {
  const actual = mission.metric === "progress.travel.distinctHubs"
    ? gameState.progress.travel.visitedHubs.size
    : Number(getPath(gameState, mission.metric) ?? 0);
  return { actual, complete: actual >= mission.target };
}
