import fs from "node:fs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`missing_anchor:${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`duplicate_anchor:${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function replaceFile(path, transform) {
  const source = fs.readFileSync(path, "utf8");
  fs.writeFileSync(path, transform(source), "utf8");
}

replaceFile("src/server/trpg/game/service.js", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    'import { resolveAuthoredScene } from "../content/authored-scene-registry.js";\n',
    `import { resolveAuthoredScene } from "../content/authored-scene-registry.js";
import {
  WORK_MARKET_VERSION,
  deterministicWorkWage,
  ensureWorkMarket,
  pendingWorkOfferAvailability,
  publicWorkMarket,
  recordCompletedWork,
  workAvailability,
  workOfferId,
} from "../resolvers/work-market-resolver.js";
`,
    "work-market-import",
  );
  source = replaceOnce(
    source,
    'export const TRPG_GAME_RESOLVER_VERSION = "trpg-player-world-v14";\nconst MIGRATABLE_RESOLVER_VERSIONS = new Set(["trpg-player-world-v8", "trpg-player-world-v9", "trpg-player-world-v10", "trpg-player-world-v11", "trpg-player-world-v12", "trpg-player-world-v13"]);',
    'export const TRPG_GAME_RESOLVER_VERSION = "trpg-player-world-v15";\nconst MIGRATABLE_RESOLVER_VERSIONS = new Set(["trpg-player-world-v8", "trpg-player-world-v9", "trpg-player-world-v10", "trpg-player-world-v11", "trpg-player-world-v12", "trpg-player-world-v13", "trpg-player-world-v14"]);',
    "resolver-v15",
  );
  source = replaceOnce(
    source,
    `const REGION_BASE_HOURLY_WAGE = Object.freeze({
  "田園の村": 24,
  "王都": 38,
  "交易都市": 34,
  "犯罪都市": 42,
  "辺境の村": 30,
  "北陵要塞": 36,
  "ドワーフ洞窟": 40,
  "エルフの隠れ里": 32,
  "古代神殿": 35,
  "魔王領": 50,
});

function deterministicWorkWage(runtime, facilityId, actorId, options = {}) {
  const minutes = Math.max(30, Math.min(480, Number(options.minutes ?? 120) || 120));
  const riskClass = ["low", "medium", "high"].includes(options.riskClass) ? options.riskClass : "low";
  const location = runtime.playerState.player.location;
  const hourly = Number(REGION_BASE_HOURLY_WAGE[location] ?? 30);
  const facilityFactor = Number({
    LOC_FARM_FIELD: 1.08,
    LOC_FARM_SQUARE: 1.12,
    LOC_FARM_INN: 0.95,
    LOC_FARM_BAKERY: 1.02,
    LOC_FARM_WELL: 1.1,
  }[facilityId] ?? 1);
  const riskFactor = Number({ low: 1, medium: 1.35, high: 1.8 }[riskClass]);
  const nightFactor = ["night", "late_night"].includes(runtime.playerState.daypart) || runtime.playerState.hour >= 20 ? 1.25 : 1;
  const digest = sha256([runtime.playerState.seed, runtime.playerState.day, location, facilityId, actorId, riskClass, minutes, "work-offer-v2"].join(":"));
  const marketFactor = 0.92 + (Number.parseInt(digest.slice(0, 8), 16) % 29) / 100;
  const raw = hourly * (minutes / 60) * facilityFactor * riskFactor * nightFactor * marketFactor;
  return Math.max(15, Math.round(raw / 5) * 5);
}

`,
    "",
    "remove-unbounded-wage",
  );
  source = replaceOnce(
    source,
    `function workGiverAt(runtime, data, facilityId, preferredNpcId = null) {
  const present = presentNpcsAt(runtime, data).filter((npc) => eligibleWorkGiver(runtime, npc));
  const preferredIds = [preferredNpcId, PREFERRED_WORK_GIVER_BY_FACILITY[facilityId]].filter(Boolean);
  for (const npcId of preferredIds) {
    const match = present.find((npc) => npc.id === npcId);
    if (match) return match;
  }
  return present[0] ?? null;
}`,
    `function workGiverAt(runtime, data, facilityId, preferredNpcId = null, options = {}) {
  const facility = data.model.facilityById[facilityId] ?? {};
  const present = presentNpcsAt(runtime, data).filter((npc) => eligibleWorkGiver(runtime, npc));
  const preferredIds = [preferredNpcId, PREFERRED_WORK_GIVER_BY_FACILITY[facilityId]].filter(Boolean);
  const ordered = [
    ...preferredIds.map((npcId) => present.find((npc) => npc.id === npcId)).filter(Boolean),
    ...present.filter((npc) => !preferredIds.includes(npc.id)),
  ];
  return ordered.find((npc) => workAvailability(runtime, {
    facility,
    facilityId,
    employerId: npc.id,
    durationMinutes: Number(options.durationMinutes ?? 120),
    startOffsetMinutes: Number(options.startOffsetMinutes ?? 0),
  }).available) ?? null;
}`,
    "available-work-giver",
  );
  source = replaceOnce(
    source,
    `function decorateWorkOfferAction(action, runtime, data, preferredNpcId = null) {
  if (!action?.workOffer && action?.type !== "work") return action;
  const facilityId = runtime.playerState.player.facilityId;
  const actor = workGiverAt(runtime, data, facilityId, preferredNpcId ?? action.targetNpcId);
  if (!actor) return null;
  const wage = deterministicWorkWage(runtime, facilityId, actor.id);
  const job = workDescription(facilityId);
  return {
    ...action,
    id: action.id === "WORK" ? \`WORK_OFFER:\${facilityId}:\${actor.id}\` : action.id,
    type: "conversation",
    workOffer: true,
    quotedWage: wage,
    workDescription: job,
    targetNpcId: actor.id,
    targetNpcName: actor.name,
    dialogueTopic: "work_offer",
    requiredDisclosure: \`仕事は「\${job}」、報酬は\${wage}G\`,
    minutes: Math.min(10, Number(action.minutes ?? 6)),
  };
}`,
    `function decorateWorkOfferAction(action, runtime, data, preferredNpcId = null) {
  if (!action?.workOffer && action?.type !== "work") return action;
  const facilityId = runtime.playerState.player.facilityId;
  const facility = data.model.facilityById[facilityId] ?? {};
  const durationMinutes = Math.max(30, Math.min(480, Number(action.workDurationMinutes ?? 120) || 120));
  const riskClass = ["low", "medium", "high"].includes(action.workRiskClass) ? action.workRiskClass : "low";
  const offerConversationMinutes = Math.min(10, Number(action.minutes ?? 6));
  const actor = workGiverAt(runtime, data, facilityId, preferredNpcId ?? action.targetNpcId, {
    durationMinutes,
    startOffsetMinutes: offerConversationMinutes,
  });
  if (!actor) return null;
  const job = cleanText(action.workDescription ?? workDescription(facilityId), 120);
  const availability = workAvailability(runtime, {
    facility,
    facilityId,
    employerId: actor.id,
    durationMinutes,
    startOffsetMinutes: offerConversationMinutes,
  });
  if (!availability.available) return null;
  const specification = { facilityId, employerId: actor.id, title: job, durationMinutes, riskClass };
  const wage = deterministicWorkWage(runtime, specification);
  return {
    ...action,
    id: action.id === "WORK" ? \`WORK_OFFER:\${facilityId}:\${actor.id}\` : action.id,
    type: "conversation",
    workOffer: true,
    workOfferId: workOfferId(runtime, specification),
    quotedWage: wage,
    workDescription: job,
    workDurationMinutes: durationMinutes,
    workRiskClass: riskClass,
    targetNpcId: actor.id,
    targetNpcName: actor.name,
    dialogueTopic: "work_offer",
    requiredDisclosure: \`仕事は「\${job}」、所要時間は\${durationMinutes}分、報酬は\${wage}G\`,
    minutes: offerConversationMinutes,
  };
}`,
    "decorate-bounded-work-offer",
  );
  source = replaceOnce(
    source,
    `function pendingWorkOfferActions(runtime, data) {
  const offer = runtime.pendingWorkOffer;
  if (!offer) return null;
  if (offer.facilityId !== runtime.playerState.player.facilityId) {
    runtime.pendingWorkOffer = null;
    return null;
  }
  const presentIds = runtime.playerState.authoritativePresentNpcIds;
  if (!(presentIds instanceof Set) || !presentIds.has(offer.actorNpcId)) {
    runtime.pendingWorkOffer = null;
    return null;
  }
  return withChoiceIds([
    {
      id: \`WORK_CONFIRM:\${offer.facilityId}:\${offer.actorNpcId}:\${offer.wage}\`,
      type: "work",
      wage: offer.wage,
      minutes: offer.minutes,
      sceneActorNpcId: offer.actorNpcId,
      workDescription: offer.description,
      label: \`引き受ける：\${offer.description}（\${offer.minutes}分・\${offer.wage}G）\`,
    },
    {
      id: \`WORK_CLARIFY:\${offer.facilityId}:\${offer.actorNpcId}\`,
      type: "conversation",
      dialogueFollowup: true,
      dialogueTopic: "work_offer",
      targetNpcId: offer.actorNpcId,
      targetNpcName: offer.actorName,
      requiredDisclosure: \`仕事は「\${offer.description}」、報酬は\${offer.wage}G\`,
      minutes: 3,
      label: "作業の手順と、終わりの目安をもう一度確かめる",
    },
    {
      id: \`WORK_DECLINE:\${offer.facilityId}:\${offer.actorNpcId}\`,
      type: "plan",
      workDecline: true,
      minutes: 1,
      label: "今回は断り、別の行動を選ぶ",
    },
  ]);
}`,
    `function pendingWorkOfferActions(runtime, data) {
  const offer = runtime.pendingWorkOffer;
  if (!offer) return null;
  if (offer.facilityId !== runtime.playerState.player.facilityId) {
    runtime.pendingWorkOffer = null;
    return null;
  }
  const presentIds = runtime.playerState.authoritativePresentNpcIds;
  if (!(presentIds instanceof Set) || !presentIds.has(offer.actorNpcId)) {
    runtime.pendingWorkOffer = null;
    return null;
  }
  const facility = data.model.facilityById[offer.facilityId] ?? {};
  offer.day ??= runtime.playerState.day;
  offer.riskClass ??= "low";
  offer.offerId ??= workOfferId(runtime, {
    facilityId: offer.facilityId,
    employerId: offer.actorNpcId,
    title: offer.description,
    durationMinutes: offer.minutes,
    riskClass: offer.riskClass,
  });
  const availability = pendingWorkOfferAvailability(runtime, facility);
  if (!availability.available) {
    runtime.pendingWorkOffer = null;
    return null;
  }
  return withChoiceIds([
    {
      id: \`WORK_CONFIRM:\${offer.offerId}\`,
      type: "work",
      wage: offer.wage,
      minutes: offer.minutes,
      sceneActorNpcId: offer.actorNpcId,
      workOfferId: offer.offerId,
      workFacilityId: offer.facilityId,
      workEmployerId: offer.actorNpcId,
      workDescription: offer.description,
      workRiskClass: offer.riskClass,
      workStartedAtMinute: runtime.playerState.absoluteMinute,
      label: \`引き受ける：\${offer.description}（\${offer.minutes}分・\${offer.wage}G）\`,
    },
    {
      id: \`WORK_CLARIFY:\${offer.offerId}\`,
      type: "conversation",
      dialogueFollowup: true,
      dialogueTopic: "work_offer",
      targetNpcId: offer.actorNpcId,
      targetNpcName: offer.actorName,
      requiredDisclosure: \`仕事は「\${offer.description}」、所要時間は\${offer.minutes}分、報酬は\${offer.wage}G\`,
      minutes: 3,
      label: "作業の手順と、終わりの目安をもう一度確かめる",
    },
    {
      id: \`WORK_DECLINE:\${offer.offerId}\`,
      type: "plan",
      workDecline: true,
      minutes: 1,
      label: "今回は断り、別の行動を選ぶ",
    },
  ]);
}`,
    "pending-work-validation",
  );
  source = replaceOnce(
    source,
    `  const publicNpc = presentNpcsAt(runtime, data)[0] ?? null;
  const workGiver = workGiverAt(runtime, data, facilityId);`,
    `  const publicNpc = presentNpcsAt(runtime, data)[0] ?? null;
  const workGiver = workGiverAt(runtime, data, facilityId, null, { durationMinutes: 120, startOffsetMinutes: 6 });`,
    "contextual-available-employer",
  );
  source = replaceOnce(
    source,
    `  if (action.workOffer && detail.workProposal?.title) {
    const durationClass = ["short", "half_day", "full_day"].includes(detail.workProposal.durationClass)
      ? detail.workProposal.durationClass
      : "short";
    const riskClass = ["low", "medium", "high"].includes(detail.workProposal.riskClass)
      ? detail.workProposal.riskClass
      : "low";
    const minutes = { short: 120, half_day: 240, full_day: 480 }[durationClass];
    const description = cleanText(detail.workProposal.title, 120);
    const wage = deterministicWorkWage(runtime, runtime.playerState.player.facilityId, action.targetNpcId, { minutes, riskClass });
    resolved = {
      ...resolved,
      quotedWage: wage,
      workDescription: description,
      workDurationMinutes: minutes,
      workRiskClass: riskClass,
      requiredDisclosure: \`仕事は「\${description}」、所要時間は\${minutes}分、報酬は\${wage}G\`,
    };
  }`,
    `  if (action.workOffer && detail.workProposal?.title) {
    const durationClass = ["short", "half_day", "full_day"].includes(detail.workProposal.durationClass)
      ? detail.workProposal.durationClass
      : "short";
    const riskClass = ["low", "medium", "high"].includes(detail.workProposal.riskClass)
      ? detail.workProposal.riskClass
      : "low";
    const minutes = { short: 120, half_day: 240, full_day: 480 }[durationClass];
    const description = cleanText(detail.workProposal.title, 120);
    const facilityId = runtime.playerState.player.facilityId;
    const facility = data.model.facilityById[facilityId] ?? {};
    const availability = workAvailability(runtime, {
      facility,
      facilityId,
      employerId: action.targetNpcId,
      durationMinutes: minutes,
      startOffsetMinutes: Number(action.minutes ?? 6),
    });
    if (availability.available) {
      const specification = { facilityId, employerId: action.targetNpcId, title: description, durationMinutes: minutes, riskClass };
      const wage = deterministicWorkWage(runtime, specification);
      resolved = {
        ...resolved,
        workOfferId: workOfferId(runtime, specification),
        quotedWage: wage,
        workDescription: description,
        workDurationMinutes: minutes,
        workRiskClass: riskClass,
        requiredDisclosure: \`仕事は「\${description}」、所要時間は\${minutes}分、報酬は\${wage}G\`,
      };
    } else {
      resolved = { ...action, label: action.label, generatedApproach: null };
    }
  }`,
    "generated-work-availability",
  );
  source = replaceOnce(
    source,
    `function narrativeWorkMarket(runtime) {
  const location = runtime.playerState.player.location;
  return {
    region: location,
    baseHourlyWage: Number(REGION_BASE_HOURLY_WAGE[location] ?? 30),
    daypart: runtime.playerState.daypart,
    localDemandTags: location === "田園の村"
      ? ["農作業", "収穫", "運搬", "家畜", "生活用水"]
      : location === "王都"
        ? ["配達", "商店補助", "書類整理", "護衛", "建物管理"]
        : ["運搬", "修繕", "案内", "採集", "警備"],
    durationClasses: ["short", "half_day", "full_day"],
    riskClasses: ["low", "medium", "high"],
    recentWorkTitles: ensureNarrativeMemory(runtime).recentWorkTitles.slice(-8),
    note: "仕事内容は場所・時刻・人物に合わせて生成し、賃金はサーバーが地域相場・所要時間・危険度から確定する",
  };
}`,
    `function narrativeWorkMarket(runtime, data) {
  const location = runtime.playerState.player.location;
  const facility = data.model.facilityById[runtime.playerState.player.facilityId] ?? {};
  const market = publicWorkMarket(runtime, facility);
  return {
    region: location,
    daypart: runtime.playerState.daypart,
    schedule: market.schedule,
    completedToday: market.completedToday,
    remainingToday: market.remainingToday,
    limits: {
      daily: market.dailyLimit,
      facility: market.facilityDailyLimit,
      employer: market.employerDailyLimit,
    },
    localDemandTags: location === "田園の村"
      ? ["農作業", "収穫", "運搬", "家畜", "生活用水"]
      : location === "王都"
        ? ["配達", "商店補助", "書類整理", "護衛", "建物管理"]
        : ["運搬", "修繕", "案内", "採集", "警備"],
    durationClasses: ["short", "half_day", "full_day"],
    riskClasses: ["low", "medium", "high"],
    recentWorkTitles: market.recentWorkTitles,
    note: "仕事内容は場所・時刻・人物に合わせて生成する。営業時間、日次在庫、雇用主ごとの回数、賃金はサーバーが確定する",
  };
}`,
    "narrative-work-market",
  );
  source = replaceOnce(source, "      workMarket: narrativeWorkMarket(runtime),", "      workMarket: narrativeWorkMarket(runtime, data),", "narrative-work-market-call");
  source = replaceOnce(
    source,
    `  const runtime = {
    playerState,
    livingWorld,
    lastWorldTickMinute: -1,
    playerInterventions: new Set(),
    playerKnowledge: createPlayerKnowledge(),
    pendingBattle: null,
    pendingNpcIntroduction: null,
    tutorial: tutorial ? createTutorialState() : null,
    dialogueSession: null,
    narrativeChoiceSelection: null,
    narrativeMemory: createNarrativeMemory(),
  };`,
    `  const runtime = {
    playerState,
    livingWorld,
    lastWorldTickMinute: -1,
    playerInterventions: new Set(),
    playerKnowledge: createPlayerKnowledge(),
    pendingBattle: null,
    pendingNpcIntroduction: null,
    pendingWorkOffer: null,
    workMarket: null,
    tutorial: tutorial ? createTutorialState() : null,
    dialogueSession: null,
    narrativeChoiceSelection: null,
    narrativeMemory: createNarrativeMemory(),
  };
  ensureWorkMarket(runtime);`,
    "initialize-work-market",
  );
  source = replaceOnce(
    source,
    `  runtime.narrativeChoiceSelection ??= null;
  ensureNarrativeMemory(runtime);
  syncAuthoritativePresentNpcIds(runtime, data);`,
    `  runtime.narrativeChoiceSelection ??= null;
  ensureNarrativeMemory(runtime);
  ensureWorkMarket(runtime);
  syncAuthoritativePresentNpcIds(runtime, data);`,
    "hydrate-work-market",
  );
  source = replaceOnce(
    source,
    `  ensurePlayerNeeds(runtime.playerState.player);
  ensureEquipmentAccessState(runtime.playerState);
  runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);`,
    `  ensurePlayerNeeds(runtime.playerState.player);
  ensureEquipmentAccessState(runtime.playerState);
  ensureWorkMarket(runtime);
  runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);`,
    "execute-work-market",
  );
  source = replaceOnce(
    source,
    `      ensurePlayerNeeds(runtime.playerState.player);
      ensureEquipmentAccessState(runtime.playerState);
      runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);`,
    `      ensurePlayerNeeds(runtime.playerState.player);
      ensureEquipmentAccessState(runtime.playerState);
      ensureWorkMarket(runtime);
      runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);`,
    "migrate-work-market",
  );
  source = replaceOnce(
    source,
    `        ensurePlayerNeeds(runtime.playerState.player);
        ensureEquipmentAccessState(runtime.playerState);
        runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);`,
    `        ensurePlayerNeeds(runtime.playerState.player);
        ensureEquipmentAccessState(runtime.playerState);
        ensureWorkMarket(runtime);
        runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);`,
    "replay-work-market",
  );
  source = replaceOnce(
    source,
    `    resolvedPlayerAction = action;
    resolvedActionId = action.id;`,
    `    const currentFacility = data.model.facilityById[runtime.playerState.player.facilityId] ?? {};
    if (action.workOffer) {
      const availability = workAvailability(runtime, {
        facility: currentFacility,
        facilityId: runtime.playerState.player.facilityId,
        employerId: action.targetNpcId,
        durationMinutes: Number(action.workDurationMinutes ?? 120),
        startOffsetMinutes: Number(action.minutes ?? 6),
      });
      if (!availability.available) {
        throw new TrpgGameError(409, "work_offer_not_available", "The work offer is no longer available", { reason: availability.reason });
      }
    }
    if (action.type === "work") {
      const offer = runtime.pendingWorkOffer;
      const matches = Boolean(offer
        && action.workOfferId
        && offer.offerId === action.workOfferId
        && offer.facilityId === runtime.playerState.player.facilityId
        && offer.actorNpcId === action.workEmployerId);
      if (!matches) throw new TrpgGameError(409, "work_offer_stale", "The work offer no longer matches the current job");
      const availability = pendingWorkOfferAvailability(runtime, currentFacility);
      if (!availability.available) {
        runtime.pendingWorkOffer = null;
        throw new TrpgGameError(409, "work_offer_not_available", "The work offer is no longer available", { reason: availability.reason });
      }
    }
    resolvedPlayerAction = action;
    resolvedActionId = action.id;`,
    "authorize-work-command",
  );
  source = replaceOnce(
    source,
    `  if (result.ok && resolvedPlayerAction?.workOffer) {
    runtime.pendingWorkOffer = {
      facilityId: runtime.playerState.player.facilityId,
      actorNpcId: resolvedPlayerAction.targetNpcId,
      actorName: resolvedPlayerAction.targetNpcName,
      description: resolvedPlayerAction.workDescription ?? workDescription(runtime.playerState.player.facilityId),
      wage: Number(resolvedPlayerAction.quotedWage ?? deterministicWorkWage(
        runtime,
        runtime.playerState.player.facilityId,
        resolvedPlayerAction.targetNpcId,
        {
          minutes: Number(resolvedPlayerAction.workDurationMinutes ?? 120),
          riskClass: resolvedPlayerAction.workRiskClass ?? "low",
        },
      )),
      minutes: Number(resolvedPlayerAction.workDurationMinutes ?? 120),
      openedAtMinute: runtime.playerState.absoluteMinute,
    };
    result.summary = \`\${resolvedPlayerAction.targetNpcName ?? "相手"}から仕事内容と賃金を聞いた。引き受けるか選べる。\`;
  }`,
    `  if (result.ok && resolvedPlayerAction?.workOffer) {
    const facilityId = runtime.playerState.player.facilityId;
    const description = resolvedPlayerAction.workDescription ?? workDescription(facilityId);
    const minutes = Number(resolvedPlayerAction.workDurationMinutes ?? 120);
    const riskClass = resolvedPlayerAction.workRiskClass ?? "low";
    const specification = {
      facilityId,
      employerId: resolvedPlayerAction.targetNpcId,
      title: description,
      durationMinutes: minutes,
      riskClass,
    };
    runtime.pendingWorkOffer = {
      offerId: resolvedPlayerAction.workOfferId ?? workOfferId(runtime, specification),
      day: runtime.playerState.day,
      facilityId,
      actorNpcId: resolvedPlayerAction.targetNpcId,
      actorName: resolvedPlayerAction.targetNpcName,
      description,
      wage: Number(resolvedPlayerAction.quotedWage ?? deterministicWorkWage(runtime, specification)),
      minutes,
      riskClass,
      openedAtMinute: runtime.playerState.absoluteMinute,
    };
    result.summary = \`\${resolvedPlayerAction.targetNpcName ?? "相手"}から仕事内容と賃金を聞いた。引き受けるか選べる。\`;
  }`,
    "persist-authoritative-work-offer",
  );
  source = replaceOnce(
    source,
    `    result.summary = \`\${completedWorkTitle}を終え、\${result.goldDelta}Gの賃金を受け取った。\`;
    runtime.pendingWorkOffer = null;
    runtime.dialogueSession = null;`,
    `    const completedWork = recordCompletedWork(runtime, {
      offerId: resolvedPlayerAction.workOfferId,
      facilityId: resolvedPlayerAction.workFacilityId ?? runtime.playerState.player.facilityId,
      employerId: resolvedPlayerAction.workEmployerId ?? resolvedPlayerAction.sceneActorNpcId,
      title: completedWorkTitle,
      riskClass: resolvedPlayerAction.workRiskClass ?? "low",
      durationMinutes: Number(resolvedPlayerAction.minutes ?? 120),
      startedAtMinute: Number(resolvedPlayerAction.workStartedAtMinute
        ?? Math.max(0, runtime.playerState.absoluteMinute - Number(resolvedPlayerAction.minutes ?? 120))),
      completedAtMinute: runtime.playerState.absoluteMinute,
      wage: result.goldDelta,
    });
    result.workMarketEntry = completedWork;
    result.summary = \`\${completedWorkTitle}を終え、\${result.goldDelta}Gの賃金を受け取った。\`;
    runtime.pendingWorkOffer = null;
    runtime.dialogueSession = null;`,
    "record-completed-work",
  );
  source = replaceOnce(
    source,
    `      weatherRulesetVersion: WEATHER_RULESET_VERSION,
      equipmentAccessVersion: EQUIPMENT_ACCESS_VERSION,`,
    `      weatherRulesetVersion: WEATHER_RULESET_VERSION,
      equipmentAccessVersion: EQUIPMENT_ACCESS_VERSION,
      workMarketVersion: WORK_MARKET_VERSION,
      workMarket: publicWorkMarket(runtime, facility),`,
    "public-work-market",
  );
  source = replaceOnce(
    source,
    `{ actorId: actor.id, text: \`助かったよ。これは今日の分、\${wage}Gだ。無理をせず、必要ならまた声をかけな。\`, emotion: "感謝" }`,
    `{ actorId: actor.id, text: \`助かったよ。これは今日の分、\${wage}Gだ。無理をせず、別の日にまた声をかけな。\`, emotion: "感謝" }`,
    "work-completion-copy",
  );
  return source;
});

replaceFile("tools/trpg-sim/test/t01-player-view.test.mjs", (source) => source
  .replace('test("resolver v14 keeps the player-view fixes migratable from v13", () => {', 'test("resolver v15 keeps the player-view and work-market fixes migratable", () => {')
  .replace('assert.equal(TRPG_GAME_RESOLVER_VERSION, "trpg-player-world-v14");', 'assert.equal(TRPG_GAME_RESOLVER_VERSION, "trpg-player-world-v15");'));
replaceFile("tools/trpg-sim/test/equipment-access-service.test.mjs", (source) => source
  .replace('test("resolver v14 initializes equipment access and exposes stock pathways", () => {', 'test("resolver v15 initializes equipment access and exposes stock pathways", () => {')
  .replace('assert.equal(TRPG_GAME_RESOLVER_VERSION, "trpg-player-world-v14");', 'assert.equal(TRPG_GAME_RESOLVER_VERSION, "trpg-player-world-v15");'));

replaceFile("tools/trpg-sim/cli-experiential-player-v6.mjs", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    `    gold: Number(save.player?.gold ?? 0),
    tutorialId: save.tutorial?.id ?? null,`,
    `    gold: Number(save.player?.gold ?? 0),
    workMarket: save.world?.workMarket ?? null,
    tutorialId: save.tutorial?.id ?? null,`,
    "experiential-compact-work-market",
  );
  source = replaceOnce(
    source,
    `      const quoted = Number(selection.actionId.split(":").at(-1));
      this.jobs.push({
        actionId: selection.actionId,
        quoted: Number.isFinite(quoted) ? quoted : null,
        actual: Number(this.save.player.gold ?? 0) - before.gold,
        lines: sceneLines(this.save),
      });`,
    `      const quoted = Number(String(selection.label ?? "").match(/(\\d+)G/u)?.[1]);
      this.jobs.push({
        actionId: selection.actionId,
        quoted: Number.isFinite(quoted) ? quoted : null,
        actual: Number(this.save.player.gold ?? 0) - before.gold,
        day: before.day,
        startedAtMinute: before.absoluteMinute,
        completedAtMinute: this.save.clock.absoluteMinute,
        lines: sceneLines(this.save),
      });`,
    "experiential-job-details",
  );
  source = replaceOnce(
    source,
    `    checks.severalJobsCompleted = runner.jobs.length >= 2;
    checks.offersRemainConcrete = offers.length > 0 && offers.every((entry) => /\\d+G/u.test(entry));
    checks.payMatchesQuote = runner.jobs.length > 0 && runner.jobs.every((job) => job.quoted === job.actual);
    checks.timePasses = runner.save.clock.absoluteMinute >= 1_200 || terminalT01(runner.save);`,
    `    checks.severalJobsCompleted = runner.jobs.length >= 2;
    checks.offersRemainConcrete = offers.length > 0 && offers.every((entry) => /\\d+G/u.test(entry));
    checks.payMatchesQuote = runner.jobs.length > 0 && runner.jobs.every((job) => job.quoted === job.actual);
    const workByDay = Object.groupBy(runner.jobs, (job) => String(job.day));
    checks.dailyWorkLimitRespected = Object.values(workByDay).every((jobs) => jobs.length <= 3);
    checks.workCountBounded = runner.jobs.length <= 6;
    checks.boundedWorkIncome = runner.jobs.reduce((sum, job) => sum + Number(job.actual ?? 0), 0) <= 180;
    checks.noOvernightJobs = runner.jobs.every((job) => Math.floor(job.startedAtMinute / 1440) === Math.floor(job.completedAtMinute / 1440)
      && job.completedAtMinute % 1440 <= 1320);
    checks.workMarketExposed = runner.save.world?.workMarket?.version === "work-market-v1"
      && Number(runner.save.world.workMarket.completedToday ?? 0) <= 3;
    checks.timePasses = runner.save.clock.absoluteMinute >= 1_200 || terminalT01(runner.save);`,
    "experiential-work-bounds",
  );
  source = replaceOnce(
    source,
    `    checks.remainsOutsideVillage = runner.save.scene.location !== "田園の村";
    checks.capitalHasInteractions = conversations >= 2 || runner.jobs.length >= 1;
    checks.t01FailsWithoutPlayer = ["failed", "expired", "suppressed", "unavailable"].includes(t01(runner.save)?.status);`,
    `    checks.remainsOutsideVillage = runner.save.scene.location !== "田園の村";
    checks.capitalHasInteractions = conversations >= 2 || runner.jobs.length >= 1;
    const capitalWorkByDay = Object.groupBy(runner.jobs, (job) => String(job.day));
    checks.capitalDailyWorkLimitRespected = Object.values(capitalWorkByDay).every((jobs) => jobs.length <= 3);
    checks.capitalWorkCountBounded = runner.jobs.length <= 6;
    checks.capitalIncomeBounded = runner.jobs.reduce((sum, job) => sum + Number(job.actual ?? 0), 0) <= 240;
    checks.t01FailsWithoutPlayer = ["failed", "expired", "suppressed", "unavailable"].includes(t01(runner.save)?.status);`,
    "experiential-capital-work-bounds",
  );
  return source;
});

fs.rmSync("tools/trpg-refactor/apply-work-market-v1.mjs");
console.log("bounded work market integrated");
