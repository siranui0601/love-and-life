import {
  AUTHORED_MISSION_FLOW_PACKS,
  applyAuthoredMissionFlowAction as applyCoreAction,
  applyAuthoredMissionFlowCatalogOverrides as applyCoreCatalog,
  authoredMissionFlowEvidenceAction as coreEvidenceAction,
  authoredMissionFlowExclusiveActions as coreExclusiveActions,
  authoredMissionFlowGuidance as coreGuidance,
  ensureAuthoredMissionFlowState,
  suppressGenericAuthoredMissionAction as suppressCoreAction,
} from "./authored-mission-flow-core.js";

export * from "./authored-mission-flow-core.js";

export const AUTHORED_MISSION_CONTINUITY_VERSION = "authored-mission-continuity-v1";

const ACTIVE_TROUBLES = new Set(["active", "critical"]);
const ACTIVE_MISSIONS = new Set(["active", "available", "in_progress"]);
const INACTIVE_PRESENCES = new Set(["dead", "missing", "departed", "sealed", "not-yet-present"]);
const F = Object.freeze;
const L = (entries) => F(entries.map((entry) => F(entry)));
const C = (choiceId, label, requiredDisclosure, minutes) => F({
  choiceId,
  label,
  requiredDisclosure,
  minutes,
});

/** Generic contract data; future mission packs can register the same three sections. */
export const AUTHORED_MISSION_CONTINUITY_CONTRACTS = F({
  "crime-city-arms-smuggling": F({
    introductionSources: L([
      {
        id: "crime-dock-left-records",
        targetLocation: "犯罪都市",
        targetFacilityId: "LOC_CRIME_DOCK",
        requiresUnavailableNpcId: "NPC052",
        guidance: F({
          kicker: "船長がいなくても、濡れた記録は残る",
          title: "荷札、潮時表、受取符号のどこから追うか決める",
          detail: "セレス本人の証言ではなく、独立した物証から供給元・輸送・買い手の一軸を選ぶ。",
        }),
        choices: L([
          C("weapon_marks_and_inventory", "濡れた荷札の擦り跡と箱板の焼き印から、武器の供給元を追う", "荷札の下にヴァロ商会の菱形印が残り、農具申告では説明できない重量が潮時表に記録されていた", 18),
          C("shipping_handoffs_and_port", "潮時表、橋札、荷下ろし順を重ね、闇港から交易都市までの便を復元する", "積込時刻、裏橋札、三分割された倉庫票が同じ貨物番号へ戻った", 19),
          C("buyers_and_armed_crises", "四種類の受取符号と前金控えから、各地の買い手を分けて追う", "港湾、王都、北陵、外国船の四符号が同じ船荷台帳の空き枠へ対応していた", 20),
        ]),
      },
      {
        id: "trade-customs-reissued-manifests",
        targetLocation: "交易都市",
        targetFacilityId: "LOC_TRADE_CUSTOMS",
        guidance: F({
          kicker: "一便が三枚の正規票へ化けた",
          title: "税関の欠番、重量差、受取印のどこから密輸便をほどくか決める",
          detail: "交易都市側の差替え記録からでも事件へ入れる。最初の矛盾によって開く調査路が変わる。",
        }),
        choices: L([
          C("weapon_marks_and_inventory", "農具申告と実重量の差、箱角の固定痕から、武器在庫の出所を絞る", "重い箱だけに赤油紙と削られた菱形印があり、犯罪都市で消えた在庫番号と一致した", 17),
          C("shipping_handoffs_and_port", "欠番と再発行票を並べ、一つの貨物番号が三倉庫へ分かれた経路を戻す", "一つの船荷番号が農具、染料、乾物の三票へ分けられ、同じ倉庫番の印へ渡っていた", 18),
          C("buyers_and_armed_crises", "三枚の倉庫票に残る受取符号を、港湾・王都・北陵・外国船へ割り当てる", "分割票の余白に四方面の受取符号があり、対立が激しい地域ほど高い前金額が記されていた", 19),
        ]),
      },
      {
        id: "weapon-market-stock-and-bids",
        targetLocation: "犯罪都市",
        targetFacilityId: "LOC_CRIME_WEAPON_MARKET",
        guidance: F({
          kicker: "売り場そのものが供給網の縮図になっている",
          title: "封印傷、搬入の癖、買い手札の競り方のどこから網を崩すか決める",
          detail: "商品、物流、買い手の一系統だけを静かに確定し、次の三経路を開く。",
        }),
        choices: L([
          C("weapon_marks_and_inventory", "封印済み在庫の菱形傷、赤油紙、固定縄を闇港の箱と照合する", "未発送品と闇港の箱で印の削り位置、赤油紙、固定縄が一致した", 16),
          C("shipping_handoffs_and_port", "荷車の到着間隔と空き箱の層から、倉庫・闇港・交易都市の便を結ぶ", "空き箱、荷車傷、荷下ろし鐘が同じ周期で繰り返されていた", 18),
          C("buyers_and_armed_crises", "値引き符号と受取札の競りを観察し、四方面の買い手を分ける", "四方面の符号が同じ在庫番号を競り、衝突が深いほど値が上がっていた", 20),
        ]),
      },
    ]),
    leadFallbacks: F({
      ceres_ship_log: L([{
        id: "trade-customs-sealed-ship-copy",
        primaryNpcId: "NPC052",
        targetLocation: "交易都市",
        facilityId: "LOC_TRADE_CUSTOMS",
        destinationName: "税関詰所・封印済み船荷写し庫",
        label: "セレス不在のため、船荷写し、係留札、荷下ろし鐘を照合する",
        approachId: "t14-ceres-log-customs-copy",
        discoveryText: "署名済み船荷写しには、染料名義の箱だけ船尾へ積み、検査前に下ろした順序が残っていた。係留札と荷下ろし鐘も闇港の潮時表へ一致する。",
        leadNarrative: "本人の記憶ではなく、出港時に封印された写し、係留札、荷下ろし鐘を別々に照合する。",
        minutes: 52,
      }]),
    }),
    battleObjectives: L([
      {
        id: "preserve-original-ledger",
        label: "原本帳簿を焼失・散逸させず確保する",
        applicableEncounterIds: F(["ENC-0039", "ENC-0043"]),
        requiredAnyEvidenceIds: F(["T14-EVIDENCE-VARO-ALL-BUYER-LEDGER", "T14-EVIDENCE-GORDO-DOUBLE-INVENTORY", "T14-EVIDENCE-MOZ-PAYMENT-MAP"]),
        maxRounds: 12,
      },
      {
        id: "capture-identified-buyer",
        label: "事前に特定した買い手を逃がさず生け捕る",
        requiredAnyEvidenceIds: F(["T14-EVIDENCE-GLENN-ARMED-YOUTHS", "T14-EVIDENCE-REN-CONTRACT-TOKEN", "T14-EVIDENCE-MAGNUS-VARO-PURCHASE"]),
        maxRounds: 16,
      },
      {
        id: "seal-smuggling-exits",
        label: "陸路・海路の退路を先回りして封鎖する",
        requiredAnyEvidenceIds: F(["T14-EVIDENCE-RATIKA-DELIVERY-ROUTE", "T14-EVIDENCE-CERES-SHIP-LOG", "T14-EVIDENCE-ERNESTO-CUSTOMS-NUMBERS"]),
        maxRounds: 10,
      },
    ]),
  }),
});

const contractFor = (pack) => pack ? AUTHORED_MISSION_CONTINUITY_CONTRACTS[pack.id] ?? null : null;
const packById = (id) => AUTHORED_MISSION_FLOW_PACKS.find((pack) => pack.id === id) ?? null;
const packByMission = (id) => AUTHORED_MISSION_FLOW_PACKS.find((pack) => pack.missionId === id) ?? null;
const missionRuntime = (runtime, pack) => runtime?.playerState?.missions?.[pack.missionId] ?? null;

function missionDefinition(runtime, pack) {
  return runtime?.playerState?.catalog?.special?.find((mission) => mission.id === pack.missionId)
    ?? runtime?.playerState?.catalog?.byId?.get?.(pack.missionId)
    ?? null;
}

function currentStep(runtime, pack) {
  const definition = missionDefinition(runtime, pack);
  const state = missionRuntime(runtime, pack);
  return definition?.steps?.find((step) =>
    Number(state?.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function packAvailable(runtime, pack) {
  const trouble = runtime?.playerState?.troubles?.[pack.troubleId];
  const troubleStatus = typeof trouble === "string" ? trouble : trouble?.status;
  return ACTIVE_TROUBLES.has(troubleStatus) && ACTIVE_MISSIONS.has(missionRuntime(runtime, pack)?.status);
}

function npcInactive(runtime, npcId) {
  const state = runtime?.livingWorld?.npcStates?.[npcId];
  return state?.lifeStatus === "dead" || INACTIVE_PRESENCES.has(state?.presence);
}

function npcAvailableAt(runtime, npcId, facilityId, presentNpcs = []) {
  if (!npcId || npcInactive(runtime, npcId)) return false;
  const state = runtime?.livingWorld?.npcStates?.[npcId];
  const position = state?.position?.facilityId ?? state?.facilityId;
  if (position) return position === facilityId;
  // Older saves and focused tests may not have initialized the living-world
  // position yet. Unknown is not absence: preserve the primary route unless
  // an authoritative scene snapshot explicitly says the NPC is elsewhere.
  if (!state) return true;
  if (runtime?.playerState?.player?.facilityId !== facilityId) return true;
  const authoritative = runtime?.playerState?.authoritativePresentNpcIds;
  if (authoritative instanceof Set) return authoritative.has(npcId);
  if (presentNpcs?.length) return presentNpcs.some((npc) => npc?.id === npcId);
  return true;
}

function sourceAvailable(runtime, source, presentNpcs) {
  if (runtime?.playerState?.player?.facilityId !== source.targetFacilityId) return false;
  if (!source.requiresUnavailableNpcId) return true;
  return !npcAvailableAt(runtime, source.requiresUnavailableNpcId, source.targetFacilityId, presentNpcs);
}

function sourceActions(runtime, presentNpcs) {
  for (const pack of AUTHORED_MISSION_FLOW_PACKS) {
    const contract = contractFor(pack);
    if (!contract?.introductionSources || !packAvailable(runtime, pack)) continue;
    const flow = ensureAuthoredMissionFlowState(runtime, pack);
    if (flow.openingChoiceId || currentStep(runtime, pack)?.id !== pack.hearing.stepId) continue;
    const source = contract.introductionSources.find((entry) => sourceAvailable(runtime, entry, presentNpcs));
    if (!source) continue;
    const actions = source.choices.map((choice) => {
      const base = pack.hearing.choices.find((entry) => entry.id === choice.choiceId);
      if (!base) return null;
      return {
        id: `${pack.id}:OPENING_SOURCE:${source.id}:${base.id}`,
        family: "investigate",
        type: "conversation",
        missionId: pack.missionId,
        stepId: pack.hearing.stepId,
        missionTitle: pack.title,
        missionTroubleId: pack.troubleId,
        targetNpcId: null,
        targetNpcName: null,
        dialogueTopic: base.dialogueTopic,
        label: choice.label,
        playerUtterance: base.playerUtterance,
        requiredDisclosure: choice.requiredDisclosure,
        minutes: choice.minutes,
        authoredMissionFlowExclusiveChoice: true,
        authoredMissionFlowId: pack.id,
        authoredMissionFlowKind: "opening",
        authoredMissionFlowChoiceId: base.id,
        authoredMissionFlowFactId: base.factId ?? null,
        authoredMissionFlowUnlockedLeadIds: [...(base.unlockedLeadIds ?? [])],
        authoredMissionFlowOpeningSourceId: source.id,
      };
    }).filter(Boolean);
    if (actions.length === 3) return actions;
  }
  return null;
}

const fallbackDefinitions = (pack, lead) => contractFor(pack)?.leadFallbacks?.[lead.id] ?? null;

function resolvedLead(runtime, pack, lead, presentNpcs = []) {
  const fallbacks = fallbackDefinitions(pack, lead);
  if (!fallbacks?.length) return { ...lead, sourceKind: "primary", sourceId: "primary" };
  const fallback = fallbacks[0];
  if (npcAvailableAt(runtime, fallback.primaryNpcId, lead.facilityId, presentNpcs)) {
    return { ...lead, sourceKind: "primary", sourceId: "primary" };
  }
  return {
    ...lead,
    ...fallback,
    id: lead.id,
    discoveryId: lead.discoveryId,
    unlocksLeadIds: lead.unlocksLeadIds,
    sourceKind: "fallback",
    sourceId: fallback.id,
  };
}

function evidenceAction(runtime, pack, lead, variant) {
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  if (runtime?.playerState?.player?.facilityId !== variant.facilityId
    || flow.evidenceIds.includes(lead.discoveryId)) return null;
  return {
    id: `${pack.id}:FALLBACK_EVIDENCE:${lead.id}:${variant.sourceId}`,
    family: "investigate",
    type: "investigate",
    missionId: pack.missionId,
    stepId: pack.investigation.stepId,
    missionTitle: pack.title,
    missionTroubleId: pack.troubleId,
    minutes: variant.minutes ?? lead.minutes,
    label: variant.label,
    investigationStage: Number(missionRuntime(runtime, pack)?.progress?.[pack.investigation.stepId] ?? 0),
    approachId: variant.approachId,
    discoveryId: lead.discoveryId,
    discoveryText: variant.discoveryText,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "evidence",
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowEvidenceId: lead.discoveryId,
    authoredMissionFlowEvidenceSourceId: variant.sourceId,
  };
}

function movementTo(actions, variant) {
  return actions.find((action) => action?.movementScope === "local"
    && action.destinationFacilityId === variant.facilityId)
    ?? actions.find((action) => action?.movementScope === "regional"
      && action.destinationHub === variant.targetLocation)
    ?? null;
}

function selectedFallbackActions(runtime, movementActions, presentNpcs) {
  for (const pack of AUTHORED_MISSION_FLOW_PACKS) {
    if (!packAvailable(runtime, pack)) continue;
    const flow = ensureAuthoredMissionFlowState(runtime, pack);
    const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
    if (!lead || !fallbackDefinitions(pack, lead)) continue;
    const variant = resolvedLead(runtime, pack, lead, presentNpcs);
    if (variant.sourceKind !== "fallback") continue;
    const evidence = evidenceAction(runtime, pack, lead, variant);
    const movement = evidence ? null : movementTo(movementActions, variant);
    const primary = evidence ?? (movement ? {
      ...movement,
      id: `${pack.id}:FALLBACK_LEAD:${lead.id}:${variant.sourceId}`,
      label: `${movement.movementScope === "regional" ? `${variant.targetLocation}へ向かい、` : `${variant.destinationName}へ向かい、`}${variant.label}`,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: pack.id,
      authoredMissionFlowKind: "lead",
      authoredMissionFlowLeadId: lead.id,
      authoredMissionFlowTargetFacilityId: variant.facilityId,
      authoredMissionFlowEvidenceSourceId: variant.sourceId,
    } : {
      id: `${pack.id}:FALLBACK_ROUTE_BRIEFING:${lead.id}:${variant.sourceId}`,
      family: "prepare",
      type: "plan",
      minutes: 8,
      label: `${variant.destinationName}に残る独立記録の所在と閲覧手順を確認する`,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: pack.id,
      authoredMissionFlowKind: "fallback_route_briefing",
      authoredMissionFlowLeadId: lead.id,
      authoredMissionFlowTargetFacilityId: variant.facilityId,
      authoredMissionFlowTargetLocation: variant.targetLocation,
    });
    return [
      primary,
      {
        id: `${pack.id}:FALLBACK_RECONSIDER:${lead.id}`,
        family: "prepare",
        type: "plan",
        minutes: 4,
        label: "この代替経路を戻し、別の証拠経路を選ぶ",
        authoredMissionFlowExclusiveChoice: true,
        authoredMissionFlowId: pack.id,
        authoredMissionFlowKind: "reconsider_lead",
        authoredMissionFlowLeadId: lead.id,
      },
      {
        id: `${pack.id}:FALLBACK_DEFER:${lead.id}`,
        family: "leave",
        type: "plan",
        minutes: 5,
        label: "代替調査を保留し、別の準備を整える",
        authoredMissionFlowExclusiveChoice: true,
        authoredMissionFlowId: pack.id,
        authoredMissionFlowKind: "defer",
        authoredMissionFlowDeferMinutes: 180,
      },
    ];
  }
  return null;
}

function decorateLeadAction(runtime, action, presentNpcs) {
  const pack = packById(action?.authoredMissionFlowId);
  const lead = pack?.investigation?.leads?.find((entry) => entry.id === action?.authoredMissionFlowLeadId);
  if (!lead || !fallbackDefinitions(pack, lead)) return action;
  const variant = resolvedLead(runtime, pack, lead, presentNpcs);
  if (variant.sourceKind !== "fallback") return action;
  return {
    id: `${action.id}:SOURCE:${variant.sourceId}`,
    family: "prepare",
    type: "plan",
    effectKind: action.effectKind ?? "select_authored_mission_investigation_route",
    minutes: Math.min(4, Math.max(1, Number(action.minutes ?? 3))),
    label: `物証代替：${variant.label}`,
    missionId: action.missionId,
    stepId: action.stepId,
    missionTitle: action.missionTitle,
    missionTroubleId: action.missionTroubleId,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: action.authoredMissionFlowId,
    authoredMissionFlowKind: action.authoredMissionFlowKind,
    authoredMissionFlowNavigatorFocusId: action.authoredMissionFlowNavigatorFocusId,
    authoredMissionFlowNavigatorGroupId: action.authoredMissionFlowNavigatorGroupId,
    authoredMissionFlowResolutionRouteId: action.authoredMissionFlowResolutionRouteId,
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowTargetFacilityId: variant.facilityId,
    authoredMissionFlowEvidenceSourceId: variant.sourceId,
  };
}

function objectiveApplicable(objective, battle) {
  const encounterId = battle?.encounterId ?? battle?.encounter?.id ?? null;
  return !objective.applicableEncounterIds?.length
    || objective.applicableEncounterIds.includes(encounterId);
}

function objectiveMet(objective, flow, battle) {
  if ((objective.requiresVictory ?? true) && !battle?.won) return false;
  const evidence = new Set(flow?.evidenceIds ?? []);
  if (objective.requiredEvidenceIds?.some((id) => !evidence.has(id))) return false;
  if (objective.requiredAnyEvidenceIds?.length
    && !objective.requiredAnyEvidenceIds.some((id) => evidence.has(id))) return false;
  const monsterIds = new Set(battle?.monsterIds ?? []);
  if (objective.requiredMonsterIds?.some((id) => !monsterIds.has(id))) return false;
  const rounds = Number(battle?.rounds ?? battle?.turns ?? Infinity);
  if (rounds > Number(objective.maxRounds ?? Infinity)) return false;
  if (rounds < Number(objective.minRounds ?? 0)) return false;
  return true;
}

function evaluateObjectives(runtime, action, result) {
  if (action?.type !== "missionBattle" || !result?.battle) return false;
  const pack = packByMission(action.missionId);
  const objectives = contractFor(pack)?.battleObjectives ?? [];
  if (!objectives.length) return false;
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  flow.battleObjectiveResults ??= {};
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  const encounterId = result.battle.encounterId ?? result.battle.encounter?.id ?? null;
  const rounds = Number(result.battle.rounds ?? result.battle.turns ?? 0);
  for (const objective of objectives) {
    const applicable = objectiveApplicable(objective, result.battle);
    flow.battleObjectiveResults[objective.id] = {
      status: !applicable ? "not_applicable" : objectiveMet(objective, flow, result.battle) ? "success" : "failed",
      encounterId,
      rounds,
      evaluatedAtMinute: minute,
    };
  }
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags.missionBattleObjectives ??= {};
  runtime.playerState.worldFlags.missionBattleObjectives[pack.missionId] = Object.fromEntries(
    objectives.map((objective) => [objective.id, flow.battleObjectiveResults[objective.id].status]),
  );
  runtime.narrativeMemory ??= {};
  runtime.narrativeMemory.semanticFlags ??= {};
  for (const objective of objectives) {
    runtime.narrativeMemory.semanticFlags[`trouble.${pack.troubleId}.battleObjective.${objective.id}`]
      = flow.battleObjectiveResults[objective.id].status;
  }
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "AUTHORED_MISSION_BATTLE_OBJECTIVES_EVALUATED",
    minute,
    missionId: pack.missionId,
    troubleId: pack.troubleId,
    encounterId,
    rounds,
    objectives: objectives.map((objective) => ({
      id: objective.id,
      status: flow.battleObjectiveResults[objective.id].status,
    })),
  });
  const labels = objectives.map((objective) => {
    const status = flow.battleObjectiveResults[objective.id].status;
    return `${status === "success" ? "達成" : status === "failed" ? "未達" : "対象外"}：${objective.label}`;
  });
  result.summary = `${result.summary ? `${result.summary} ` : ""}副目標――${labels.join("／")}。`;
  return true;
}

export function applyAuthoredMissionFlowCatalogOverrides(catalog) {
  const resolved = applyCoreCatalog(catalog);
  for (const pack of AUTHORED_MISSION_FLOW_PACKS) {
    const objectives = contractFor(pack)?.battleObjectives ?? [];
    const battle = resolved?.special?.find((mission) => mission.id === pack.missionId)
      ?.steps?.find((step) => step.type === "battle");
    if (battle && objectives.length) battle.sideObjectives = objectives.map((objective) => ({
      id: objective.id,
      label: objective.label,
      independentOfVictory: true,
    }));
  }
  return resolved;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const selected = selectedFallbackActions(runtime, context.movementActions ?? [], context.presentNpcs ?? []);
  if (selected) return selected;
  const sources = sourceActions(runtime, context.presentNpcs ?? []);
  if (sources) return sources;
  const core = coreExclusiveActions(runtime, context);
  return core?.map((action) => decorateLeadAction(runtime, action, context.presentNpcs ?? [])) ?? null;
}

export function authoredMissionFlowEvidenceAction(runtime) {
  for (const pack of AUTHORED_MISSION_FLOW_PACKS) {
    if (!packAvailable(runtime, pack)) continue;
    const flow = ensureAuthoredMissionFlowState(runtime, pack);
    const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
    if (!lead || !fallbackDefinitions(pack, lead)) continue;
    const variant = resolvedLead(runtime, pack, lead);
    if (variant.sourceKind === "fallback") return evidenceAction(runtime, pack, lead, variant);
  }
  return coreEvidenceAction(runtime);
}

export function suppressGenericAuthoredMissionAction(runtime, action) {
  for (const pack of AUTHORED_MISSION_FLOW_PACKS) {
    if (!packAvailable(runtime, pack)) continue;
    const flow = ensureAuthoredMissionFlowState(runtime, pack);
    if (action?.missionId === pack.missionId
      && currentStep(runtime, pack)?.id === pack.hearing.stepId
      && !flow.openingChoiceId
      && contractFor(pack)?.introductionSources?.some((source) => sourceAvailable(runtime, source, []))) return true;
    const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
    if (lead && fallbackDefinitions(pack, lead)) {
      const variant = resolvedLead(runtime, pack, lead);
      if (action?.missionId === pack.missionId
        && variant.sourceKind === "fallback"
        && runtime?.playerState?.player?.facilityId === variant.facilityId) return true;
    }
  }
  return suppressCoreAction(runtime, action);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  let changed = applyCoreAction(runtime, action, result);
  const pack = action?.authoredMissionFlowId ? packById(action.authoredMissionFlowId) : packByMission(action?.missionId);
  if (pack && action?.authoredMissionFlowOpeningSourceId) {
    ensureAuthoredMissionFlowState(runtime, pack).openingSourceId = action.authoredMissionFlowOpeningSourceId;
    changed = true;
  }
  if (pack && action?.authoredMissionFlowEvidenceSourceId && action?.authoredMissionFlowEvidenceId) {
    const flow = ensureAuthoredMissionFlowState(runtime, pack);
    flow.evidenceSourceIds ??= {};
    flow.evidenceSourceIds[action.authoredMissionFlowEvidenceId] = action.authoredMissionFlowEvidenceSourceId;
    changed = true;
  }
  if (pack && action?.authoredMissionFlowKind === "fallback_route_briefing") {
    runtime.playerKnowledge ??= {};
    runtime.playerKnowledge.knownHubIds ??= new Set();
    runtime.playerKnowledge.knownFacilityIds ??= new Set();
    runtime.playerKnowledge.knownHubIds.add(action.authoredMissionFlowTargetLocation);
    runtime.playerKnowledge.knownFacilityIds.add(action.authoredMissionFlowTargetFacilityId);
    result.summary = "独立記録の保管先と閲覧手順を確認した。";
    changed = true;
  }
  if (evaluateObjectives(runtime, action, result)) changed = true;
  return changed;
}

export function authoredMissionFlowGuidance(runtime) {
  for (const pack of AUTHORED_MISSION_FLOW_PACKS) {
    if (!packAvailable(runtime, pack)) continue;
    const flow = ensureAuthoredMissionFlowState(runtime, pack);
    if (currentStep(runtime, pack)?.id === pack.hearing.stepId && !flow.openingChoiceId) {
      const source = contractFor(pack)?.introductionSources?.find((entry) => sourceAvailable(runtime, entry, []));
      if (source) return { missionId: pack.missionId, ...source.guidance, targetLocation: source.targetLocation, targetFacilityId: source.targetFacilityId, sourceId: source.id };
    }
    const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
    if (lead && fallbackDefinitions(pack, lead)) {
      const variant = resolvedLead(runtime, pack, lead);
      if (variant.sourceKind === "fallback") return {
        missionId: pack.missionId,
        kicker: "証言者が不在でも、独立記録は残る",
        title: variant.label,
        detail: variant.leadNarrative,
        targetLocation: variant.targetLocation,
        targetFacilityId: variant.facilityId,
        sourceId: variant.sourceId,
      };
    }
  }
  const guidance = coreGuidance(runtime);
  if (!guidance) return guidance;
  const pack = packByMission(guidance.missionId);
  const flow = pack ? ensureAuthoredMissionFlowState(runtime, pack) : null;
  const objectives = contractFor(pack)?.battleObjectives ?? [];
  if (!flow?.battleObjectiveResults || !objectives.length) return guidance;
  const status = objectives.map((objective) => {
    const value = flow.battleObjectiveResults[objective.id]?.status;
    return `${value === "success" ? "達成" : value === "failed" ? "未達" : value === "not_applicable" ? "対象外" : "未判定"}：${objective.label}`;
  }).join("／");
  return { ...guidance, detail: `${guidance.detail ?? ""} 戦闘副目標：${status}`.trim(), battleObjectiveStatus: status };
}
