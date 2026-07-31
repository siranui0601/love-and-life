import * as legacy from "./authored-mission-flow-continuity-v1.js";
import { T15_FOREIGN_FLEET_ARRIVAL_PACK } from "./authored/missions/t15-foreign-fleet-arrival.js";

export * from "./authored-mission-flow-continuity-v1.js";

const F = Object.freeze;
const L = (entries) => F(entries.map((entry) => F(entry)));
const ACTIVE_TROUBLES = new Set(["active", "critical"]);
const ACTIVE_MISSIONS = new Set(["active", "available", "in_progress"]);
const INACTIVE_PRESENCES = new Set(["dead", "missing", "departed", "sealed", "not-yet-present"]);
const T15 = T15_FOREIGN_FLEET_ARRIVAL_PACK;
const T15_STATE_VERSION = "authored-mission-flow-t15-v1";

const sourceChoice = (choiceId, label, requiredDisclosure, minutes, sceneTransition) => F({
  choiceId,
  label,
  requiredDisclosure,
  minutes,
  sceneTransition,
});

const T15_CONTRACT = F({
  introductionSources: L([
    {
      id: "trade-customs-altered-arrival-papers",
      targetLocation: "交易都市",
      targetFacilityId: "LOC_TRADE_CUSTOMS",
      guidance: F({
        kicker: "入港許可の一枚だけ、筆圧と封蝋が違う",
        title: "税関の差替票から、招致権限・軍事積荷・上陸後の行先のどれを先に崩すか決める",
        detail: "誰かの説明をそのまま信じず、正規票と差替票の差から外国船団を招いた仕組みへ入る。",
      }),
      choices: L([
        sourceChoice(
          "authority_and_contract",
          "封蝋、発行時刻、署名順を照合し、誰が外国船へ入港権限を渡したか追う",
          "領主印の使用時刻より前にセドリック派の招致文が作られ、緊急評議の追認欄だけが後から足されていた",
          18,
          "税関の窓口から、封印文書庫の机へ場面が移る",
        ),
        sourceChoice(
          "cargo_and_landing",
          "申告重量と船腹図を重ね、通常交易では説明できない軍事積荷を切り分ける",
          "穀物名義の船倉に攻城部品と傭兵装備の固定枠があり、Day72の満潮直後に先行上陸する計画だった",
          19,
          "紙上の船腹図から、夜の外港で揺れる船影へ場面が切り替わる",
        ),
        sourceChoice(
          "collaborators_and_destination",
          "免税欄、倉庫担保、馬車手配をたどり、国内協力者と王都方面の行先を分ける",
          "ベリルの信用状、バーゼルの補給契約、アルバレスの私信が一つの王都街道調査費へ合流していた",
          20,
          "税関台帳の数字から、商人ギルドの閉ざされた評議室へ場面が移る",
        ),
      ]),
    },
    {
      id: "trade-port-night-unloading",
      targetLocation: "交易都市",
      targetFacilityId: "LOC_TRADE_PORT",
      guidance: F({
        kicker: "まだ入港前なのに、夜勤表だけが完成している",
        title: "荷役鐘、船倉の固定具、傭兵の交代表から、先に止める線を選ぶ",
        detail: "港で準備されている作業から、契約書に書かれていない上陸計画を逆算する。",
      }),
      choices: L([
        sourceChoice(
          "cargo_and_landing",
          "夜間荷役の鐘と潮位表を重ね、Day72の先行上陸時刻を確定する",
          "通常便が終わる鐘の後に外国船専用の二度打ちがあり、満潮から四十分だけ港門を開ける指示が残っていた",
          17,
          "昼の荷役場から、鐘だけが響く夜の桟橋へ場面が転換する",
        ),
        sourceChoice(
          "authority_and_contract",
          "港門を開ける命令書の発行者と、税関を通さない例外権限を照合する",
          "次期領主派の私印と商人ギルドの緊急決議が、正規の港湾長命令より先に夜勤責任者へ渡っていた",
          18,
          "夜勤詰所から、署名者が集まるギルド会館へ視点が移る",
        ),
        sourceChoice(
          "collaborators_and_destination",
          "上陸後の荷車、厩舎、宿営地の割当から、国内の受入役を特定する",
          "港から王都街道へ向かう荷車だけが別会計で、バーゼル商会と外国使節の符号を共有していた",
          19,
          "港の荷車列から、王都街道沿いの仮宿営予定地へ場面が切り替わる",
        ),
      ]),
    },
    {
      id: "trade-guild-succession-contracts",
      targetLocation: "交易都市",
      targetFacilityId: "LOC_TRADE_GUILD",
      guidance: F({
        kicker: "救援契約の名で、港の主権まで担保に入っている",
        title: "継承、信用、撤収条件のどこから外国船団との結び目をほどくか決める",
        detail: "商人の利益と、都市を占領へ近づける条項を分け、破棄できる契約と止めるべき実力行使を見極める。",
      }),
      choices: L([
        sourceChoice(
          "authority_and_contract",
          "緊急評議録と継承台帳を照合し、招致契約を結べる者が存在したか確かめる",
          "現領主の存否が確定する前に継承権を仮定し、セドリックと一部商人だけで外国船の招致を決めていた",
          18,
          "公開会議室から、改竄前の議事録が眠る書記庫へ場面が移る",
        ),
        sourceChoice(
          "collaborators_and_destination",
          "信用状と補給契約を分け、利益目的の商人と侵攻を知る協力者を区別する",
          "短期融資だけを信じた商人と、王都街道の制圧日程まで知る署名者が別の付属名簿に分かれていた",
          20,
          "金額だけの会計表から、署名者ごとの密約を並べた小会議室へ転換する",
        ),
        sourceChoice(
          "cargo_and_landing",
          "契約解除時の違約条項を読み、外国側が軍事上陸へ切り替える条件を確定する",
          "港が契約を拒絶した場合、護衛傭兵が積荷保全を名目に上陸し、倉庫と港門を接収できる条項があった",
          19,
          "契約書の一文から、接収対象に印を付けられた港湾地図へ場面が移る",
        ),
      ]),
    },
  ]),
  leadFallbacks: F({
    alvarez_private_terms: L([F({
      id: "customs-sealed-envoy-dispatch",
      primaryNpcId: "NPC015",
      targetLocation: "交易都市",
      facilityId: "LOC_TRADE_CUSTOMS",
      destinationName: "税関・封印済み使節往復書庫",
      label: "アルバレス不在のため、使節往復書、通訳控え、封蝋片から私的条件を復元する",
      approachId: "t15-alvarez-sealed-envoy-dispatch",
      discoveryText: "封印済み往復書では、アルバレスが港の安全保証と引き換えに外国兵の上陸人数を伏せ、王都街道の案内役を国内側へ要求していた。通訳控えには削除前の人数が残る。",
      leadNarrative: "本人の弁明ではなく、双方が別々に保管した文面と通訳控えを突き合わせる。使節の失踪や死亡後でも、交渉条件そのものは消えない。",
      minutes: 48,
    })]),
  }),
  battleObjectives: L([
    {
      id: "preserve-invitation-original",
      label: "招致契約の原本と封蝋を焼失させず司法保全する",
      requiredAnyEvidenceIds: F([
        "T15-EVIDENCE-CEDRIC-INVITATION-SEAL",
        "T15-EVIDENCE-GUILD-EMERGENCY-MINUTES",
        "T15-EVIDENCE-LORD-MANOR-SUCCESSION-REGISTER",
      ]),
      maxRounds: 14,
    },
    {
      id: "separate-siege-cargo",
      label: "民生貨物から攻城部品を分離し、港湾労働者を巻き込まず封鎖する",
      requiredAnyEvidenceIds: F([
        "T15-EVIDENCE-SIEGE-PART-CRATE-LAYERS",
        "T15-EVIDENCE-MERCENARY-ROSTER-AND-PAY",
        "T15-EVIDENCE-SHIPYARD-GUN-DECK-CONVERSION",
      ]),
      maxRounds: 11,
    },
    {
      id: "prevent-mercenary-reinforcement",
      label: "傭兵の第二陣と港外の連絡艇を合流前に遮断する",
      requiredAnyEvidenceIds: F([
        "T15-EVIDENCE-DAY72-TIDE-AND-BELL",
        "T15-EVIDENCE-NIGHT-SHIFT-LANDING-ORDER",
        "T15-EVIDENCE-FOREIGN-COMMAND-CIPHER",
      ]),
      maxRounds: 9,
    },
  ]),
});

export const AUTHORED_MISSION_CONTINUITY_VERSION = "authored-mission-continuity-v2";
export const AUTHORED_MISSION_FLOW_PACKS = F([
  ...legacy.AUTHORED_MISSION_FLOW_PACKS,
  T15,
]);
export const AUTHORED_MISSION_CONTINUITY_CONTRACTS = F({
  ...legacy.AUTHORED_MISSION_CONTINUITY_CONTRACTS,
  [T15.id]: T15_CONTRACT,
});

function missionDefinition(runtime) {
  return runtime?.playerState?.catalog?.byId?.get?.(T15.missionId)
    ?? runtime?.playerState?.catalog?.special?.find?.((entry) => entry.id === T15.missionId)
    ?? null;
}

function missionRuntime(runtime) {
  return runtime?.playerState?.missions?.[T15.missionId] ?? null;
}

function currentStep(runtime) {
  const definition = missionDefinition(runtime);
  const state = missionRuntime(runtime);
  if (!definition || !state) return null;
  return definition.steps?.find((step) =>
    Number(state.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function playerKnowsT15(runtime) {
  const state = runtime?.playerState;
  if (!state) return false;
  if (state.progress?.missions?.attemptedTroubleIds?.has?.(T15.troubleId)
    || state.progress?.missions?.resolvedTroubleIds?.has?.(T15.troubleId)
    || state.progress?.missions?.completedIds?.has?.(T15.missionId)) return true;
  return (state.rumors ?? []).some((rumor) =>
    rumor.troubleId === T15.troubleId && state.player?.knownRumorIds?.has?.(rumor.id));
}

function t15Available(runtime) {
  const trouble = runtime?.playerState?.troubles?.[T15.troubleId];
  const troubleStatus = typeof trouble === "string" ? trouble : trouble?.status;
  return ACTIVE_TROUBLES.has(troubleStatus)
    && ACTIVE_MISSIONS.has(missionRuntime(runtime)?.status)
    && playerKnowsT15(runtime);
}

function freshState() {
  return {
    version: T15_STATE_VERSION,
    flowId: T15.id,
    openingChoiceId: null,
    openingSourceId: null,
    openingChosenAtMinute: null,
    navigatorFocusId: null,
    navigatorGroupId: null,
    selectedLeadId: null,
    selectedLeadAtMinute: null,
    evidenceIds: [],
    evidenceSourceIds: {},
    unlockedLeadIds: [],
    knownFactIds: [],
    prematureResolutionCount: 0,
    prematureResolutionEvidenceCounts: [],
    deferredUntilMinute: null,
    resolutionPreparationRouteId: null,
    selectedResolutionRouteId: null,
    selectedResolutionContextId: null,
    resolutionBranchId: null,
    battleObjectiveResults: {},
  };
}

function requiredEvidenceGroups() {
  return [
    ...(T15.investigation.requiredEvidenceIds ?? []).map((id) => [id]),
    ...(T15.investigation.requiredEvidenceGroups ?? []).map((group) => [...group]),
  ].filter((group) => group.length);
}

function syncInvestigationProgress(runtime, flow) {
  const mission = missionRuntime(runtime);
  const definition = missionDefinition(runtime);
  const step = definition?.steps?.find((entry) => entry.id === T15.investigation.stepId);
  if (!mission?.progress || !step) return;
  const evidence = new Set(flow.evidenceIds ?? []);
  const groups = requiredEvidenceGroups();
  const completed = groups.filter((group) => group.some((id) => evidence.has(id))).length;
  mission.progress[step.id] = Math.min(Number(step.required ?? groups.length), completed);
}

function ensureT15State(runtime) {
  runtime.authoredMissionFlows ??= {};
  runtime.authoredMissionFlows[T15.id] ??= freshState();
  const state = runtime.authoredMissionFlows[T15.id];
  state.version = T15_STATE_VERSION;
  state.flowId = T15.id;
  state.openingChoiceId ??= null;
  state.openingSourceId ??= null;
  state.navigatorFocusId ??= null;
  state.navigatorGroupId ??= null;
  state.selectedLeadId ??= null;
  state.selectedLeadAtMinute ??= null;
  state.evidenceIds = Array.isArray(state.evidenceIds) ? [...new Set(state.evidenceIds)] : [];
  state.evidenceSourceIds = state.evidenceSourceIds && typeof state.evidenceSourceIds === "object"
    ? { ...state.evidenceSourceIds }
    : {};
  state.unlockedLeadIds = Array.isArray(state.unlockedLeadIds)
    ? [...new Set(state.unlockedLeadIds)]
    : [];
  state.knownFactIds = Array.isArray(state.knownFactIds) ? [...new Set(state.knownFactIds)] : [];
  state.prematureResolutionCount = Math.max(0, Number(state.prematureResolutionCount ?? 0));
  state.prematureResolutionEvidenceCounts = Array.isArray(state.prematureResolutionEvidenceCounts)
    ? [...new Set(state.prematureResolutionEvidenceCounts.map(Number).filter(Number.isFinite))]
    : [];
  state.deferredUntilMinute = Number.isFinite(Number(state.deferredUntilMinute))
    ? Number(state.deferredUntilMinute)
    : null;
  state.resolutionPreparationRouteId ??= null;
  state.selectedResolutionRouteId ??= null;
  state.selectedResolutionContextId ??= null;
  state.resolutionBranchId ??= null;
  state.battleObjectiveResults = state.battleObjectiveResults && typeof state.battleObjectiveResults === "object"
    ? { ...state.battleObjectiveResults }
    : {};

  const validEvidence = new Set(T15.investigation.leads.map((lead) => lead.discoveryId));
  for (const discovery of missionRuntime(runtime)?.discoveries ?? []) {
    if (validEvidence.has(discovery?.id) && !state.evidenceIds.includes(discovery.id)) {
      state.evidenceIds.push(discovery.id);
    }
  }
  state.evidenceIds = state.evidenceIds.filter((id) => validEvidence.has(id));
  const validLeads = new Set(T15.investigation.leads.map((lead) => lead.id));
  state.unlockedLeadIds = state.unlockedLeadIds.filter((id) => validLeads.has(id));
  const selected = T15.investigation.leads.find((lead) => lead.id === state.selectedLeadId);
  if (!selected || state.evidenceIds.includes(selected.discoveryId)) {
    state.selectedLeadId = null;
    state.selectedLeadAtMinute = null;
  }
  if (state.openingChoiceId && state.unlockedLeadIds.length === 0) {
    state.unlockedLeadIds = T15.investigation.leads.map((lead) => lead.id);
  }
  syncInvestigationProgress(runtime, state);
  return state;
}

export function ensureAuthoredMissionFlowState(runtime, packOrId) {
  const id = typeof packOrId === "string" ? packOrId : packOrId?.id;
  return id === T15.id || packOrId?.missionId === T15.missionId
    ? ensureT15State(runtime)
    : legacy.ensureAuthoredMissionFlowState(runtime, packOrId);
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  return missionId === T15.missionId
    ? ensureT15State(runtime)
    : legacy.initializeAuthoredMissionFlowForMission(runtime, missionId);
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
  if (!state) return true;
  const authoritative = runtime?.playerState?.authoritativePresentNpcIds;
  if (authoritative instanceof Set && runtime?.playerState?.player?.facilityId === facilityId) {
    return authoritative.has(npcId);
  }
  if (presentNpcs?.length && runtime?.playerState?.player?.facilityId === facilityId) {
    return presentNpcs.some((npc) => npc?.id === npcId);
  }
  return true;
}

function sourceAtPlayer(runtime) {
  const facilityId = runtime?.playerState?.player?.facilityId;
  return T15_CONTRACT.introductionSources.find((source) => source.targetFacilityId === facilityId) ?? null;
}

function actionId(kind, id) {
  return `MISSION_FLOW:${T15.id}:${kind}:${id}`;
}

function openingSourceActions(runtime) {
  if (!t15Available(runtime)) return null;
  const flow = ensureT15State(runtime);
  const step = currentStep(runtime);
  if (flow.openingChoiceId || ![T15.hearing.stepId, T15.investigation.stepId].includes(step?.id)) return null;
  const source = sourceAtPlayer(runtime);
  if (!source) return null;
  const actions = source.choices.map((choice) => {
    const base = T15.hearing.choices.find((entry) => entry.id === choice.choiceId);
    if (!base) return null;
    return {
      id: `${T15.id}:OPENING_SOURCE:${source.id}:${base.id}`,
      family: "investigate",
      type: "plan",
      effectKind: "inspect_authored_mission_introduction_source",
      missionId: T15.missionId,
      stepId: T15.hearing.stepId,
      missionTitle: T15.title,
      missionTroubleId: T15.troubleId,
      targetNpcId: null,
      targetNpcName: null,
      label: choice.label,
      playerUtterance: base.playerUtterance,
      requiredDisclosure: choice.requiredDisclosure,
      minutes: choice.minutes,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: T15.id,
      authoredMissionFlowKind: "opening",
      authoredMissionFlowChoiceId: base.id,
      authoredMissionFlowFactId: base.factId ?? null,
      authoredMissionFlowUnlockedLeadIds: [...(base.unlockedLeadIds ?? T15.investigation.leads.map((lead) => lead.id))],
      authoredMissionFlowOpeningSourceId: source.id,
      authoredMissionFlowSceneTransition: choice.sceneTransition,
    };
  }).filter(Boolean);
  return actions.length === 3 ? actions : null;
}

function investigationNavigator() {
  const groups = T15.investigation.requiredEvidenceGroups ?? [];
  const focuses = (T15.investigation.focuses ?? []).map((focus) => ({
    ...focus,
    groups: (focus.groups ?? []).map((group) => ({
      ...group,
      evidenceIds: [...(group.evidenceIds ?? groups[Number(group.evidenceGroupIndex)] ?? [])],
    })),
  }));
  if (focuses.length !== 3) return null;
  return { focuses };
}

function focusActions(flow) {
  const navigator = investigationNavigator();
  if (!navigator) return null;
  const evidence = new Set(flow.evidenceIds);
  const actions = navigator.focuses
    .filter((focus) => focus.groups.some((group) => group.evidenceIds.some((id) => !evidence.has(id))))
    .map((focus) => ({
      id: actionId("NAVIGATOR_FOCUS", focus.id),
      family: "prepare",
      type: "plan",
      minutes: Number(focus.minutes ?? 3),
      label: focus.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: T15.id,
      authoredMissionFlowKind: "navigator_focus",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowSceneTransition: focus.sceneTransition ?? null,
    }));
  if (actions.length < 3) actions.push(deferAction());
  return actions.slice(0, 3).length === 3 ? actions.slice(0, 3) : null;
}

function groupActions(flow) {
  const navigator = investigationNavigator();
  const focus = navigator?.focuses.find((entry) => entry.id === flow.navigatorFocusId);
  if (!focus) return null;
  const evidence = new Set(flow.evidenceIds);
  const actions = focus.groups
    .filter((group) => group.evidenceIds.some((id) => !evidence.has(id)))
    .map((group) => ({
      id: actionId("NAVIGATOR_GROUP", group.id),
      family: "prepare",
      type: "plan",
      minutes: Number(group.minutes ?? 2),
      label: group.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: T15.id,
      authoredMissionFlowKind: "navigator_group",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowNavigatorGroupId: group.id,
      authoredMissionFlowSceneTransition: group.sceneTransition ?? null,
    }));
  actions.push({
    id: actionId("NAVIGATOR_BACK", focus.id),
    family: "prepare",
    type: "plan",
    minutes: 1,
    label: "三つの調査方針へ戻り、別の焦点から考える",
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: T15.id,
    authoredMissionFlowKind: "navigator_back",
  });
  if (actions.length < 3) actions.push(deferAction());
  return actions.slice(0, 3).length === 3 ? actions.slice(0, 3) : null;
}

function routeActions(flow) {
  const navigator = investigationNavigator();
  const focus = navigator?.focuses.find((entry) => entry.id === flow.navigatorFocusId);
  const group = focus?.groups.find((entry) => entry.id === flow.navigatorGroupId);
  if (!group) return null;
  const evidence = new Set(flow.evidenceIds);
  const byEvidence = new Map(T15.investigation.leads.map((lead) => [lead.discoveryId, lead]));
  const actions = group.evidenceIds
    .filter((id) => !evidence.has(id))
    .map((id) => byEvidence.get(id))
    .filter(Boolean)
    .map((lead) => ({
      id: actionId("NAVIGATOR_ROUTE", `${group.id}:${lead.id}`),
      family: "prepare",
      type: "plan",
      minutes: 3,
      label: lead.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: T15.id,
      authoredMissionFlowKind: "navigator_route",
      authoredMissionFlowNavigatorFocusId: focus.id,
      authoredMissionFlowNavigatorGroupId: group.id,
      authoredMissionFlowLeadId: lead.id,
      authoredMissionFlowTargetFacilityId: lead.facilityId,
      authoredMissionFlowSceneTransition: `調査の視点が${lead.destinationName}へ移る`,
    }));
  if (actions.length < 3) actions.push({
    id: actionId("NAVIGATOR_ROUTE_BACK", group.id),
    family: "prepare",
    type: "plan",
    minutes: 1,
    label: "この三経路は保留し、同じ調査方針の別分類へ戻る",
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: T15.id,
    authoredMissionFlowKind: "navigator_route_back",
  });
  if (actions.length < 3) actions.push(deferAction());
  return actions.slice(0, 3).length === 3 ? actions.slice(0, 3) : null;
}

function deferAction() {
  const defer = T15.investigation.defer;
  return {
    id: actionId("DEFER", defer?.id ?? "defer"),
    family: "leave",
    type: "plan",
    minutes: Number(defer?.minutes ?? 5),
    label: defer?.label ?? "外国船団の調査を保留し、別の準備を整える",
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: T15.id,
    authoredMissionFlowKind: "defer",
    authoredMissionFlowDeferMinutes: Number(defer?.deferMinutes ?? 180),
  };
}

function fallbackForLead(lead) {
  return T15_CONTRACT.leadFallbacks?.[lead.id]?.[0] ?? null;
}

function resolvedLead(runtime, lead, presentNpcs = []) {
  const fallback = fallbackForLead(lead);
  if (!fallback || npcAvailableAt(runtime, fallback.primaryNpcId, lead.facilityId, presentNpcs)) {
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

function movementTo(movementActions, variant) {
  return movementActions.find((action) => action?.movementScope === "local"
    && action.destinationFacilityId === variant.facilityId)
    ?? movementActions.find((action) => action?.movementScope === "regional"
      && action.destinationHub === (variant.targetLocation ?? T15.hearing.targetLocation))
    ?? null;
}

function evidenceAction(runtime, lead, variant) {
  const flow = ensureT15State(runtime);
  if (runtime?.playerState?.player?.facilityId !== variant.facilityId
    || flow.evidenceIds.includes(lead.discoveryId)) return null;
  return {
    id: variant.sourceKind === "fallback"
      ? `${T15.id}:FALLBACK_EVIDENCE:${lead.id}:${variant.sourceId}`
      : actionId("EVIDENCE", lead.id),
    family: "investigate",
    type: "investigate",
    missionId: T15.missionId,
    stepId: T15.investigation.stepId,
    missionTitle: T15.title,
    missionTroubleId: T15.troubleId,
    minutes: Number(variant.minutes ?? lead.minutes),
    label: variant.label,
    approachId: variant.approachId,
    discoveryId: lead.discoveryId,
    discoveryText: variant.discoveryText,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: T15.id,
    authoredMissionFlowKind: "evidence",
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowEvidenceId: lead.discoveryId,
    authoredMissionFlowEvidenceSourceId: variant.sourceId,
  };
}

function selectedLeadActions(runtime, movementActions, presentNpcs, flow) {
  const lead = T15.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
  if (!lead) return null;
  const variant = resolvedLead(runtime, lead, presentNpcs);
  const evidence = evidenceAction(runtime, lead, variant);
  const movement = evidence ? null : movementTo(movementActions, variant);
  const primary = evidence ?? (movement ? {
    ...movement,
    id: `${T15.id}:LEAD:${lead.id}:${variant.sourceId}`,
    label: `${movement.movementScope === "regional" ? `${variant.targetLocation ?? T15.hearing.targetLocation}へ向かい、` : `${variant.destinationName}へ向かい、`}${variant.label}`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: T15.id,
    authoredMissionFlowKind: "lead",
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowTargetFacilityId: variant.facilityId,
    authoredMissionFlowEvidenceSourceId: variant.sourceId,
  } : null);
  const actions = [
    primary,
    {
      id: actionId("RECONSIDER", lead.id),
      family: "prepare",
      type: "plan",
      minutes: 4,
      label: "この経路をいったん戻し、別の証拠分類を選ぶ",
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: T15.id,
      authoredMissionFlowKind: "reconsider_lead",
    },
    deferAction(),
  ].filter(Boolean);
  return actions.length === 3 ? actions : null;
}

function evidenceSet(runtime) {
  return new Set(ensureT15State(runtime).evidenceIds);
}

function contextSnapshot(runtime) {
  const flow = ensureT15State(runtime);
  return {
    evidenceOrder: [...flow.evidenceIds],
    evidenceIds: new Set(flow.evidenceIds),
    openingChoiceId: flow.openingChoiceId,
  };
}

function objectiveConditionMet(runtime, condition) {
  const missionId = condition.missionId ?? condition.sourceMissionId ?? "MSN-T14";
  const objectiveId = condition.objectiveId ?? condition.id;
  const expected = condition.status ?? condition.value ?? "success";
  return runtime?.playerState?.worldFlags?.missionBattleObjectives?.[missionId]?.[objectiveId] === expected;
}

function contextVariantMatches(runtime, variant) {
  const snapshot = contextSnapshot(runtime);
  const flags = runtime?.playerState?.worldFlags ?? {};
  const troubles = runtime?.playerState?.troubles ?? {};
  const statusFor = (id) => troubles[id]?.status ?? troubles[id];
  const required = variant.requiredEvidenceIds ?? [];
  const any = variant.anyEvidenceIds ?? [];
  const forbidden = variant.forbiddenEvidenceIds ?? [];
  const openings = variant.openingChoiceIds ?? [];
  const first = variant.firstEvidenceIds ?? [];
  const last = variant.lastEvidenceIds ?? [];
  const prefix = variant.evidenceOrderPrefix ?? [];
  const troubleConditions = variant.troubleConditions ?? [];
  const objectiveConditions = variant.battleObjectiveConditions
    ?? variant.missionBattleObjectiveConditions
    ?? variant.objectiveConditions
    ?? [];
  if (variant.flagKey) {
    const value = flags[variant.flagKey];
    if (variant.flagValue == null ? !value : value !== variant.flagValue) return false;
  }
  if (variant.troubleId) {
    const accepted = variant.troubleStatuses ?? (variant.troubleStatus ? [variant.troubleStatus] : []);
    const value = statusFor(variant.troubleId);
    if (accepted.length ? !accepted.includes(value) : !value) return false;
  }
  if (troubleConditions.some((condition) => {
    const accepted = condition.troubleStatuses ?? (condition.troubleStatus ? [condition.troubleStatus] : []);
    const value = statusFor(condition.troubleId);
    return accepted.length ? !accepted.includes(value) : !value;
  })) return false;
  if (required.some((id) => !snapshot.evidenceIds.has(id))) return false;
  if (any.length && !any.some((id) => snapshot.evidenceIds.has(id))) return false;
  if (forbidden.some((id) => snapshot.evidenceIds.has(id))) return false;
  if (openings.length && !openings.includes(snapshot.openingChoiceId)) return false;
  if (first.length && !first.includes(snapshot.evidenceOrder[0])) return false;
  if (last.length && !last.includes(snapshot.evidenceOrder.at(-1))) return false;
  if (prefix.some((id, index) => snapshot.evidenceOrder[index] !== id)) return false;
  if (objectiveConditions.some((condition) => !objectiveConditionMet(runtime, condition))) return false;
  return true;
}

export function resolveAuthoredMissionFlowExtensionChoice(runtime, choice, requestedContextId = null) {
  if (!choice) return choice;
  const variants = choice.contextVariants ?? [];
  const variant = requestedContextId
    ? variants.find((entry) => entry.contextId === requestedContextId)
    : variants.find((entry) => contextVariantMatches(runtime, entry));
  if (!variant) return choice;
  return {
    ...choice,
    ...variant,
    id: choice.id,
    worldEffect: {
      ...(choice.worldEffect ?? {}),
      ...(variant.worldEffect ?? {}),
    },
  };
}

function resolutionReadiness(runtime, choice) {
  const readiness = choice?.readiness;
  if (!readiness) return {
    ready: true,
    coreReady: true,
    supportCount: 0,
    minimumSupport: 0,
    missingCoreGroups: [],
    missingLeads: [],
  };
  const flow = ensureT15State(runtime);
  const evidence = new Set(flow.evidenceIds);
  const supporting = [...new Set(readiness.supportingEvidenceIds ?? [])];
  const evidenceSupport = supporting.filter((id) => evidence.has(id)).length;
  const openingSupport = (readiness.openingChoiceIds ?? []).includes(flow.openingChoiceId)
    ? Math.max(0, Number(readiness.openingSupport ?? 1))
    : 0;
  const supportCount = evidenceSupport + openingSupport;
  const minimumSupport = Math.max(1, Number(readiness.minimumSupport ?? 1));
  const coreGroups = [
    ...(readiness.requiredEvidenceIds ?? []).map((id) => [id]),
    ...(readiness.requiredEvidenceGroups ?? []).map((group) => [...group]),
  ].filter((group) => group.length);
  const missingCoreGroups = coreGroups.filter((group) => !group.some((id) => evidence.has(id)));
  const byEvidence = new Map(T15.investigation.leads.map((lead) => [lead.discoveryId, lead]));
  const missingIds = [
    ...missingCoreGroups.flat(),
    ...supporting.filter((id) => !evidence.has(id)),
  ];
  const missingLeads = [...new Set(missingIds)].map((id) => byEvidence.get(id)).filter(Boolean);
  return {
    ready: missingCoreGroups.length === 0 && supportCount >= minimumSupport,
    coreReady: missingCoreGroups.length === 0,
    supportCount,
    minimumSupport,
    requiredCoreCount: coreGroups.length,
    satisfiedCoreCount: coreGroups.length - missingCoreGroups.length,
    missingCoreGroups,
    missingLeads,
  };
}

export function authoredMissionFlowExtensionResolutionReadiness(runtime, routeId) {
  const route = T15.resolution?.choices?.find((choice) => choice.id === routeId);
  return route ? resolutionReadiness(runtime, route) : {
    ready: false,
    coreReady: false,
    supportCount: 0,
    minimumSupport: Infinity,
    missingCoreGroups: [],
    missingLeads: [],
  };
}

function resolutionActions(runtime, step, flow) {
  if (step?.targetFacilityId
    && runtime?.playerState?.player?.facilityId !== step.targetFacilityId) return null;
  const status = runtime?.playerState?.troubles?.[T15.troubleId]?.status ?? "active";
  const actions = T15.resolution.choices.map((choice) => {
    const readiness = resolutionReadiness(runtime, choice);
    if (!readiness.ready) {
      const lead = readiness.missingLeads[0] ?? null;
      return {
        id: actionId("RESOLUTION_PREPARATION", `${choice.id}:${lead?.id ?? "missing"}`),
        family: "prepare",
        type: "plan",
        minutes: Math.max(1, Number(choice.readiness?.preparationMinutes ?? 6)),
        label: `${choice.readiness?.preparationLabel ?? `${choice.label}の裏付けを補う`}（成立根拠${readiness.supportCount}/${readiness.minimumSupport}・必須条件${readiness.satisfiedCoreCount ?? 0}/${readiness.requiredCoreCount ?? 0}）`,
        authoredMissionFlowExclusiveChoice: true,
        authoredMissionFlowId: T15.id,
        authoredMissionFlowKind: "resolution_preparation",
        authoredMissionFlowResolutionRouteId: choice.id,
        authoredMissionFlowLeadId: lead?.id ?? null,
      };
    }
    const resolved = resolveAuthoredMissionFlowExtensionChoice(runtime, choice);
    return {
      id: actionId("RESOLUTION", `${choice.id}:${status}`),
      family: "help",
      type: "resolveMission",
      missionId: T15.missionId,
      stepId: T15.resolution.stepId,
      missionTitle: T15.title,
      missionTroubleId: T15.troubleId,
      minutes: Number(resolved.minutes ?? choice.minutes),
      label: resolved.labelByTroubleStatus?.[status] ?? resolved.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: T15.id,
      authoredMissionFlowKind: "resolution",
      authoredMissionFlowResolutionRouteId: choice.id,
      authoredMissionFlowResolutionContextVariantId: resolved.contextId ?? null,
      authoredMissionFlowTroubleStatus: status,
      authoredMissionFlowSceneTransition: resolved.sceneTransition ?? "評議の決定から、港と沖合の船団へ場面が切り替わる",
    };
  });
  return actions.length === 3 ? actions : null;
}

function resolutionPreparationActions(runtime, flow) {
  const route = T15.resolution.choices.find((choice) => choice.id === flow.resolutionPreparationRouteId);
  if (!route) return null;
  const readiness = resolutionReadiness(runtime, route);
  if (readiness.ready) return null;
  const actions = readiness.missingLeads.slice(0, 2).map((lead) => ({
    id: actionId("RESOLUTION_PREPARATION_LEAD", `${route.id}:${lead.id}`),
    family: "prepare",
    type: "plan",
    minutes: 2,
    label: `追加裏付け：${lead.label}`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: T15.id,
    authoredMissionFlowKind: "resolution_preparation_lead",
    authoredMissionFlowResolutionRouteId: route.id,
    authoredMissionFlowLeadId: lead.id,
  }));
  actions.push({
    id: actionId("RESOLUTION_PREPARATION_CANCEL", route.id),
    family: "prepare",
    type: "plan",
    minutes: 1,
    label: "この追加裏付けを中止し、三つの最終方針へ戻る",
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: T15.id,
    authoredMissionFlowKind: "resolution_preparation_cancel",
    authoredMissionFlowResolutionRouteId: route.id,
  });
  if (actions.length < 3) actions.push(deferAction());
  return actions.slice(0, 3).length === 3 ? actions.slice(0, 3) : null;
}

function t15ExclusiveActions(runtime, context = {}) {
  if (!t15Available(runtime)) return null;
  const flow = ensureT15State(runtime);
  const step = currentStep(runtime);
  if (!step) return null;
  const selected = selectedLeadActions(
    runtime,
    context.movementActions ?? [],
    context.presentNpcs ?? [],
    flow,
  );
  if (selected) return selected;
  const opening = openingSourceActions(runtime);
  if (opening) return opening;
  if (step.id === T15.resolution.stepId) return resolutionActions(runtime, step, flow);
  if (step.id !== T15.investigation.stepId) return null;
  if (flow.resolutionPreparationRouteId) {
    const preparation = resolutionPreparationActions(runtime, flow);
    if (preparation) return preparation;
  }
  if (!flow.openingChoiceId) return null;
  if (!flow.navigatorFocusId) return focusActions(flow);
  if (!flow.navigatorGroupId) return groupActions(flow);
  return routeActions(flow);
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const existing = legacy.authoredMissionFlowExclusiveActions(runtime, context);
  return existing ?? t15ExclusiveActions(runtime, context);
}

export function authoredMissionFlowEvidenceAction(runtime) {
  const existing = legacy.authoredMissionFlowEvidenceAction(runtime);
  if (existing) return existing;
  if (!t15Available(runtime)) return null;
  const flow = ensureT15State(runtime);
  const lead = T15.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
  if (!lead) return null;
  return evidenceAction(runtime, lead, resolvedLead(runtime, lead));
}

function objectiveApplicable(objective, battle) {
  const encounterId = battle?.encounterId ?? battle?.encounter?.id ?? null;
  return !objective.applicableEncounterIds?.length || objective.applicableEncounterIds.includes(encounterId);
}

function objectiveMet(objective, flow, battle) {
  if ((objective.requiresVictory ?? true) && !battle?.won) return false;
  const evidence = new Set(flow.evidenceIds ?? []);
  if (objective.requiredEvidenceIds?.some((id) => !evidence.has(id))) return false;
  if (objective.requiredAnyEvidenceIds?.length
    && !objective.requiredAnyEvidenceIds.some((id) => evidence.has(id))) return false;
  const rounds = Number(battle?.rounds ?? battle?.turns ?? Infinity);
  if (rounds > Number(objective.maxRounds ?? Infinity)) return false;
  if (rounds < Number(objective.minRounds ?? 0)) return false;
  return true;
}

function evaluateBattleObjectives(runtime, action, result) {
  if (action?.type !== "missionBattle" || action?.missionId !== T15.missionId || !result?.battle) return false;
  const flow = ensureT15State(runtime);
  const objectives = T15_CONTRACT.battleObjectives;
  const encounterId = result.battle.encounterId ?? result.battle.encounter?.id ?? null;
  const rounds = Number(result.battle.rounds ?? result.battle.turns ?? 0);
  for (const objective of objectives) {
    const applicable = objectiveApplicable(objective, result.battle);
    flow.battleObjectiveResults[objective.id] = {
      status: !applicable ? "not_applicable" : objectiveMet(objective, flow, result.battle) ? "success" : "failed",
      encounterId,
      rounds,
      evaluatedAtMinute: Number(runtime?.playerState?.absoluteMinute ?? 0),
    };
  }
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags.missionBattleObjectives ??= {};
  runtime.playerState.worldFlags.missionBattleObjectives[T15.missionId] = Object.fromEntries(
    objectives.map((objective) => [objective.id, flow.battleObjectiveResults[objective.id].status]),
  );
  runtime.narrativeMemory ??= {};
  runtime.narrativeMemory.semanticFlags ??= {};
  for (const objective of objectives) {
    runtime.narrativeMemory.semanticFlags[`trouble.T15.battleObjective.${objective.id}`]
      = flow.battleObjectiveResults[objective.id].status;
  }
  const labels = objectives.map((objective) => {
    const value = flow.battleObjectiveResults[objective.id].status;
    return `${value === "success" ? "達成" : value === "failed" ? "未達" : "対象外"}：${objective.label}`;
  });
  result.summary = `${result.summary ? `${result.summary} ` : ""}副目標――${labels.join("／")}。`;
  return true;
}

function completeHearing(runtime) {
  const mission = missionRuntime(runtime);
  const definition = missionDefinition(runtime);
  const step = definition?.steps?.find((entry) => entry.id === T15.hearing.stepId);
  if (mission?.progress && step) mission.progress[step.id] = Number(step.required ?? 1);
}

function addDiscovery(runtime, lead) {
  const mission = missionRuntime(runtime);
  if (!mission) return;
  mission.discoveries ??= [];
  if (!mission.discoveries.some((entry) => entry.id === lead.discoveryId)) {
    mission.discoveries.push({
      id: lead.discoveryId,
      text: lead.discoveryText,
      approachId: lead.approachId,
      discoveredAtMinute: Number(runtime?.playerState?.absoluteMinute ?? 0),
    });
  }
}

function applyResolutionEffect(runtime, route, flow, result) {
  const status = result?.troubleStatusAtResolution
    ?? runtime?.playerState?.troubles?.[T15.troubleId]?.status
    ?? "active";
  const resolved = resolveAuthoredMissionFlowExtensionChoice(
    runtime,
    route,
    result?.authoredMissionFlowResolutionContextVariantId ?? null,
  );
  const contextId = resolved.contextId ?? "base";
  const branchId = [
    T15.troubleId,
    flow.openingChoiceId ?? "unknown-opening",
    flow.evidenceIds.join(">") || "no-evidence-order",
    route.id,
    contextId,
    status,
  ].join("|");
  flow.selectedResolutionRouteId = route.id;
  flow.selectedResolutionContextId = contextId;
  flow.resolutionBranchId = branchId;
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags.t15ResolutionRoute = route.id;
  runtime.playerState.worldFlags.t15ResolutionContext = contextId;
  runtime.playerState.worldFlags.t15ResolutionBranch = branchId;
  if (resolved.worldEffect?.flagKey) runtime.playerState.worldFlags[resolved.worldEffect.flagKey] = route.id;
  runtime.narrativeMemory ??= {};
  runtime.narrativeMemory.semanticFlags ??= {};
  runtime.narrativeMemory.localFacts ??= [];
  runtime.narrativeMemory.semanticFlags["trouble.T15.resolutionRoute"] = route.id;
  runtime.narrativeMemory.semanticFlags["trouble.T15.resolutionContext"] = contextId;
  runtime.narrativeMemory.semanticFlags["trouble.T15.resolutionBranch"] = branchId;
  const factId = resolved.worldEffect?.factIdByTroubleStatus?.[status] ?? resolved.worldEffect?.factId;
  const text = resolved.worldEffect?.textByTroubleStatus?.[status] ?? resolved.worldEffect?.text;
  if (factId && text && !runtime.narrativeMemory.localFacts.some((entry) => entry.factId === factId)) {
    runtime.narrativeMemory.localFacts.push({
      type: "authored_resolution",
      factId,
      subjectId: T15.troubleId,
      predicate: "resolution_route",
      value: route.id,
      summary: text,
      troubleId: T15.troubleId,
      locationId: runtime.playerState.player.location,
      facilityId: resolved.worldEffect?.facilityId ?? runtime.playerState.player.facilityId,
      recordedAtMinute: Number(runtime.playerState.absoluteMinute ?? 0),
    });
  }
  result.summary = resolved.summaryByTroubleStatus?.[status] ?? resolved.summary;
  result.sceneTransition = resolved.sceneTransition
    ?? "決定の場面から港外へ切り替わり、船団、荷役、傭兵の動きが同時に変わった。";
  return true;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  let changed = legacy.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok === false) return changed;
  if (action?.missionId === T15.missionId && action?.type === "missionBattle") {
    return evaluateBattleObjectives(runtime, action, result) || changed;
  }
  if (action?.authoredMissionFlowId !== T15.id) return changed;
  const flow = ensureT15State(runtime);
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  const kind = action.authoredMissionFlowKind;
  if (kind === "opening") {
    flow.openingChoiceId = action.authoredMissionFlowChoiceId;
    flow.openingSourceId = action.authoredMissionFlowOpeningSourceId ?? "primary";
    flow.openingChosenAtMinute ??= minute;
    flow.unlockedLeadIds = [...new Set(action.authoredMissionFlowUnlockedLeadIds?.length
      ? action.authoredMissionFlowUnlockedLeadIds
      : T15.investigation.leads.map((lead) => lead.id))];
    if (action.authoredMissionFlowFactId && !flow.knownFactIds.includes(action.authoredMissionFlowFactId)) {
      flow.knownFactIds.push(action.authoredMissionFlowFactId);
    }
    completeHearing(runtime);
    result.summary ??= "外国船団の入港準備について、独立した記録から最初の矛盾を確定した。";
    result.sceneTransition = action.authoredMissionFlowSceneTransition ?? null;
    changed = true;
  }
  if (kind === "navigator_focus") {
    flow.navigatorFocusId = action.authoredMissionFlowNavigatorFocusId;
    flow.navigatorGroupId = null;
    result.summary = "外国船団問題を、二つの独立した論点へ分けて調べることにした。";
    changed = true;
  }
  if (kind === "navigator_group") {
    flow.navigatorFocusId = action.authoredMissionFlowNavigatorFocusId;
    flow.navigatorGroupId = action.authoredMissionFlowNavigatorGroupId;
    result.summary = "同じ事実を三つの異なる記録・人物・現場から確かめる段階へ進んだ。";
    changed = true;
  }
  if (kind === "navigator_back") {
    flow.navigatorFocusId = null;
    flow.navigatorGroupId = null;
    changed = true;
  }
  if (kind === "navigator_route_back") {
    flow.navigatorGroupId = null;
    changed = true;
  }
  if (["navigator_route", "lead", "resolution_preparation_lead"].includes(kind)) {
    const lead = T15.investigation.leads.find((entry) => entry.id === action.authoredMissionFlowLeadId);
    if (lead) {
      flow.selectedLeadId = lead.id;
      flow.selectedLeadAtMinute = minute;
      if (!flow.unlockedLeadIds.includes(lead.id)) flow.unlockedLeadIds.push(lead.id);
      result.summary ??= `${lead.destinationName}で、${lead.label}ことにした。`;
      changed = true;
    }
  }
  if (kind === "evidence") {
    const lead = T15.investigation.leads.find((entry) => entry.id === action.authoredMissionFlowLeadId);
    if (lead && !flow.evidenceIds.includes(lead.discoveryId)) flow.evidenceIds.push(lead.discoveryId);
    if (lead) addDiscovery(runtime, lead);
    if (action.authoredMissionFlowEvidenceSourceId && lead) {
      flow.evidenceSourceIds[lead.discoveryId] = action.authoredMissionFlowEvidenceSourceId;
    }
    flow.selectedLeadId = null;
    flow.selectedLeadAtMinute = null;
    flow.navigatorFocusId = null;
    flow.navigatorGroupId = null;
    syncInvestigationProgress(runtime, flow);
    changed = true;
  }
  if (kind === "reconsider_lead") {
    flow.selectedLeadId = null;
    flow.selectedLeadAtMinute = null;
    flow.navigatorGroupId = null;
    changed = true;
  }
  if (kind === "resolution_preparation") {
    const route = T15.resolution.choices.find((choice) => choice.id === action.authoredMissionFlowResolutionRouteId);
    const readiness = route ? resolutionReadiness(runtime, route) : null;
    const lead = readiness?.missingLeads.find((entry) => entry.id === action.authoredMissionFlowLeadId)
      ?? readiness?.missingLeads[0]
      ?? null;
    if (route && lead) {
      flow.resolutionPreparationRouteId = route.id;
      flow.selectedLeadId = lead.id;
      flow.selectedLeadAtMinute = minute;
      if (!flow.unlockedLeadIds.includes(lead.id)) flow.unlockedLeadIds.push(lead.id);
      result.summary = route.readiness?.preparationSummary
        ?? `「${route.label}」を成立させるための核心証拠を補うことにした。`;
      changed = true;
    }
  }
  if (kind === "resolution_preparation_cancel") {
    flow.resolutionPreparationRouteId = null;
    flow.selectedLeadId = null;
    flow.selectedLeadAtMinute = null;
    flow.navigatorFocusId = null;
    flow.navigatorGroupId = null;
    result.summary = "一つの案へ固執せず、三つの最終方針を比較し直すことにした。";
    changed = true;
  }
  if (kind === "resolution") {
    const route = T15.resolution.choices.find((choice) => choice.id === action.authoredMissionFlowResolutionRouteId);
    const readiness = route ? resolutionReadiness(runtime, route) : null;
    if (route && readiness?.ready) {
      changed = applyResolutionEffect(runtime, route, flow, result) || changed;
    } else if (route) {
      flow.resolutionPreparationRouteId = route.id;
      flow.selectedLeadId = readiness?.missingLeads[0]?.id ?? null;
      result.ok = false;
      result.reason = "authored_resolution_evidence_missing";
      result.summary = "この方針は、関係の薄い証拠を数だけ集めても成立しない。欠けている核心証拠を補う必要がある。";
      changed = true;
    }
  }
  if (kind === "defer") {
    flow.deferredUntilMinute = minute + Math.max(30, Number(action.authoredMissionFlowDeferMinutes ?? 180));
    result.summary ??= T15.investigation.defer?.summary ?? "外国船団の調査をいったん保留した。";
    changed = true;
  }
  if (changed) {
    runtime.playerState.history ??= [];
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_T15_UPDATED",
      minute,
      missionId: T15.missionId,
      flowKind: kind ?? action.type ?? null,
      openingChoiceId: flow.openingChoiceId,
      evidenceCount: flow.evidenceIds.length,
      selectedLeadId: flow.selectedLeadId,
      resolutionRouteId: flow.selectedResolutionRouteId,
    });
  }
  return changed;
}

export function suppressGenericAuthoredMissionAction(runtime, action) {
  if (action?.missionId !== T15.missionId) return legacy.suppressGenericAuthoredMissionAction(runtime, action);
  if (!t15Available(runtime) || action.authoredMissionFlowId === T15.id) return false;
  const flow = ensureT15State(runtime);
  const step = currentStep(runtime);
  if ([T15.hearing.stepId, T15.investigation.stepId].includes(step?.id)) {
    return !flow.openingChoiceId || Boolean(flow.selectedLeadId) || Boolean(sourceAtPlayer(runtime));
  }
  return false;
}

export function applyAuthoredMissionFlowCatalogOverrides(catalog) {
  const resolved = legacy.applyAuthoredMissionFlowCatalogOverrides(catalog);
  const mission = resolved?.special?.find((entry) => entry.id === T15.missionId);
  if (!mission) return resolved;
  const sectionStepId = { hearing: "hear", investigation: "investigate", battle: "battle", resolution: "resolve" };
  for (const [section, override] of Object.entries(T15.catalogOverride ?? {})) {
    const stepId = T15[section]?.stepId ?? sectionStepId[section];
    let step = mission.steps.find((entry) => entry.id === stepId);
    if (!step && section === "battle") {
      step = {
        id: stepId,
        type: "battle",
        required: 1,
      };
      const resolveIndex = mission.steps.findIndex((entry) => entry.type === "resolve");
      mission.steps.splice(resolveIndex >= 0 ? resolveIndex : mission.steps.length, 0, step);
    }
    if (step) Object.assign(step, override);
  }
  const battle = mission.steps.find((step) => step.id === (T15.catalogOverride?.battle?.id ?? "battle") || step.type === "battle");
  if (battle) {
    battle.sideObjectives = T15_CONTRACT.battleObjectives.map((objective) => ({
      id: objective.id,
      label: objective.label,
      independentOfVictory: true,
    }));
  }
  return resolved;
}

function t15Guidance(runtime) {
  if (!t15Available(runtime)) return null;
  const flow = ensureT15State(runtime);
  const step = currentStep(runtime);
  if (!step) return null;
  if (!flow.openingChoiceId) {
    const source = sourceAtPlayer(runtime) ?? T15_CONTRACT.introductionSources[0];
    return {
      missionId: T15.missionId,
      ...source.guidance,
      targetLocation: source.targetLocation,
      targetFacilityId: source.targetFacilityId,
      sourceId: source.id,
    };
  }
  if (step.id === T15.investigation.stepId) {
    const lead = T15.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
    if (lead) {
      const variant = resolvedLead(runtime, lead);
      return {
        missionId: T15.missionId,
        kicker: variant.sourceKind === "fallback" ? "証言者が不在でも、交渉記録は残る" : T15.investigation.selectedLeadGuidance?.kicker,
        title: variant.label,
        detail: variant.leadNarrative,
        targetLocation: variant.targetLocation ?? T15.hearing.targetLocation,
        targetFacilityId: variant.facilityId,
      };
    }
    if (flow.resolutionPreparationRouteId) {
      const route = T15.resolution.choices.find((choice) => choice.id === flow.resolutionPreparationRouteId);
      const readiness = route ? resolutionReadiness(runtime, route) : null;
      if (route && readiness) return {
        missionId: T15.missionId,
        kicker: "選んだ解決案を成立させる核心証拠",
        title: route.readiness?.preparationLabel ?? route.label,
        detail: `成立根拠${readiness.supportCount}/${readiness.minimumSupport}、必須条件${readiness.satisfiedCoreCount ?? 0}/${readiness.requiredCoreCount ?? 0}。無関係な証拠を増やしても成立しない。`,
        targetLocation: runtime.playerState.player.location,
        targetFacilityId: null,
      };
    }
    return {
      missionId: T15.missionId,
      ...(flow.evidenceIds.length ? T15.investigation.continuedGuidance : T15.investigation.initialGuidance),
      targetLocation: runtime.playerState.player.location,
      targetFacilityId: null,
    };
  }
  const guidance = step.guidance ?? T15.stepGuidance?.[step.id] ?? T15.postInvestigationGuidance;
  const objectiveStatus = Object.entries(flow.battleObjectiveResults ?? {}).map(([id, entry]) => {
    const objective = T15_CONTRACT.battleObjectives.find((item) => item.id === id);
    return `${entry.status === "success" ? "達成" : entry.status === "failed" ? "未達" : "対象外"}：${objective?.label ?? id}`;
  }).join("／");
  return {
    missionId: T15.missionId,
    ...guidance,
    detail: `${guidance?.detail ?? ""}${objectiveStatus ? ` 戦闘副目標：${objectiveStatus}` : ""}`.trim(),
    targetLocation: step.targetLocation ?? T15.hearing.targetLocation,
    targetFacilityId: step.targetFacilityId ?? null,
  };
}

export function authoredMissionFlowGuidance(runtime) {
  return legacy.authoredMissionFlowGuidance(runtime) ?? t15Guidance(runtime);
}

function scene(sceneId, priority, actionIdValue, narrative) {
  return F({
    sceneId,
    priority,
    presentationOnly: true,
    when: F({ all: F([{ path: "action.id", op: "eq", value: actionIdValue }]) }),
    narrative,
    beats: F([]),
    choices: F([]),
  });
}

function t15Scenes() {
  const scenes = [];
  for (const source of T15_CONTRACT.introductionSources) {
    for (const choice of source.choices) {
      scenes.push(scene(
        `mission-flow.${T15.id}.opening-source.${source.id}.${choice.choiceId}`,
        982,
        `${T15.id}:OPENING_SOURCE:${source.id}:${choice.choiceId}`,
        `${choice.sceneTransition}。${choice.requiredDisclosure}。この一件だけでは船団を止められないため、残る五分類を別の記録から確かめる必要がある。`,
      ));
    }
  }
  const navigator = investigationNavigator();
  for (const focus of navigator?.focuses ?? []) {
    scenes.push(scene(
      `mission-flow.${T15.id}.focus.${focus.id}`,
      977,
      actionId("NAVIGATOR_FOCUS", focus.id),
      focus.narrative ?? `${focus.label}ため、二つの論点を切り離して調べることにした。`,
    ));
    for (const group of focus.groups) {
      scenes.push(scene(
        `mission-flow.${T15.id}.group.${group.id}`,
        976,
        actionId("NAVIGATOR_GROUP", group.id),
        group.narrative ?? `${group.label}ため、三つの独立経路を比較した。`,
      ));
      for (const evidenceId of group.evidenceIds) {
        const lead = T15.investigation.leads.find((entry) => entry.discoveryId === evidenceId);
        if (!lead) continue;
        scenes.push(scene(
          `mission-flow.${T15.id}.route.${group.id}.${lead.id}`,
          975,
          actionId("NAVIGATOR_ROUTE", `${group.id}:${lead.id}`),
          `場面は${lead.destinationName}へ移る。${lead.leadNarrative} 証拠を得るには、現地で記録・人物・現物を照合しなければならない。`,
        ));
        scenes.push(scene(
          `mission-flow.${T15.id}.evidence.${lead.id}`,
          978,
          actionId("EVIDENCE", lead.id),
          `${lead.leadNarrative} ${lead.discoveryText}`,
        ));
      }
    }
  }
  for (const route of T15.resolution.choices) {
    for (const status of ["active", "critical"]) {
      scenes.push(F({
        sceneId: `mission-flow.${T15.id}.resolution.${route.id}.${status}`,
        priority: 980,
        presentationOnly: true,
        when: F({ all: F([
          { path: "action.authoredMissionFlowResolutionRouteId", op: "eq", value: route.id },
          { path: "mission.id", op: "eq", value: T15.missionId },
          { path: "outcome.ok", op: "isTrue", value: true },
          { path: "outcome.troubleStatusAtResolution", op: "eq", value: status },
        ].map(F)) }),
        narrative: route.narrativeByTroubleStatus?.[status] ?? route.narrative,
        beats: F([]),
        choices: F([]),
      }));
    }
  }
  return scenes;
}

export const AUTHORED_MISSION_FLOW_SCENES = F([
  ...legacy.AUTHORED_MISSION_FLOW_SCENES,
  ...t15Scenes(),
].sort((left, right) => Number(right.priority ?? 0) - Number(left.priority ?? 0)
  || left.sceneId.localeCompare(right.sceneId)));
