export const AUTHORED_MISSION_FLOW_VERSION = "authored-mission-flow-v1";

const ACTIVE_TROUBLE_STATUSES = new Set(["active", "critical"]);
const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);

export const AUTHORED_MISSION_FLOW_PACKS = Object.freeze([
  Object.freeze({
    id: "second-summoning",
    missionId: "MSN-T17",
    troubleId: "T17",
    title: "王都の第二召喚儀式",
    legacyStateKey: "t17SecondSummoning",
    catalogOverride: Object.freeze({
      hearing: Object.freeze({
        targetLocation: "王都",
        targetFacilityId: "LOC_CAP_LOWER_INN",
        label: "王都下層で、第二召喚を止めようとする人物と接触する",
      }),
    }),
    hearing: Object.freeze({
      stepId: "hear",
      targetLocation: "王都",
      targetFacilityId: "LOC_CAP_LOWER_INN",
      npcId: "NPC018",
      npcName: "ライラ",
      guidance: Object.freeze({
        kicker: "王都で聞いた不穏な話",
        title: "下層の安宿で、第二召喚を止めようとする人物と話す",
        detail: "相手の主張を鵜呑みにせず、時刻・自分との関係・検証可能な証拠のどれから確かめるか選べる。",
      }),
      choices: Object.freeze([
        Object.freeze({
          id: "when_where",
          dialogueTopic: "mission_flow_when_where",
          label: "二度目の召喚を、いつ、どこで行うつもりなのか尋ねる",
          playerUtterance: "二度目の召喚は、いつ、どこで行われるんですか？",
          requiredDisclosure: "第二召喚の本式はDay41、宮廷魔術塔で行われる",
          minutes: 10,
          narrative: "安宿の食堂の隅で、外套を深く被った女性は周囲の卓を一度見渡し、声を落とした。曖昧な警告ではなく、止めるべき時刻と場所から話すつもりらしい。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC018",
              text: "私はライラ。第二召喚の本式はDay41、宮廷魔術塔で行われる。今は資材と術者を集めている段階よ。止めるなら、儀式の日では遅い。",
              emotion: "慎重",
            }),
          ]),
        }),
        Object.freeze({
          id: "why_player",
          dialogueTopic: "mission_flow_why_player",
          label: "なぜ自分へ声をかけたのか、召喚との関係を問い返す",
          playerUtterance: "なぜ私にその話を？　私と召喚に、どんな関係があるんですか？",
          requiredDisclosure: "Day1の召喚対象は消滅せず、王都の外へ逸れて生存した可能性がある",
          minutes: 13,
          narrative: "女性はすぐに答えず、こちらの服装と手元を確かめる。確信ではなく、危険な仮説を口にする前のためらいだった。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC018",
              text: "私はライラ。Day1の召喚対象は消滅せず、王都の外へ逸れて生存した可能性がある。足跡も荷もなく田園の村へ現れたあなたは、その仮説と重なる。でも、あなたを利用したくはない。だから証拠を一緒に確かめたい。",
              emotion: "警戒と誠実さ",
            }),
          ]),
        }),
        Object.freeze({
          id: "demand_proof",
          dialogueTopic: "mission_flow_demand_proof",
          label: "阻止派の話だけでは動けないと告げ、独立して確かめられる証拠を求める",
          playerUtterance: "あなたたちの話だけでは動けません。私自身が確かめられる証拠を示してください。",
          requiredDisclosure: "元研究員の写し、魔術塔の納入記録、王城の許可状という三つの確認先がある",
          minutes: 12,
          narrative: "女性は反発せず、小さくうなずいた。阻止派という立場だけで信用を求めるつもりはないらしい。卓上へ王都の簡単な見取り図を広げ、三か所へ印を置く。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC018",
              text: "私はライラ。その判断でいい。確認先は三つ。元研究員の写し、魔術塔の納入記録、王城の許可状。互いに別の場所へ残った記録だから、二つ以上が一致すれば私たちの作り話ではないと分かる。",
              emotion: "安堵",
            }),
          ]),
        }),
      ]),
    }),
    investigation: Object.freeze({
      stepId: "investigate",
      requiredEvidenceCount: 2,
      initialGuidance: Object.freeze({
        kicker: "第二召喚の裏付け",
        title: "三つの確認先から、最初の証拠を選ぶ",
        detail: "元研究員の写し、魔術塔の納入記録、王城の許可状は、それぞれ別の立場から儀式を裏づける。",
      }),
      continuedGuidance: Object.freeze({
        kicker: "一つ目の証拠を確認済み",
        title: "別系統の記録で、第二召喚をもう一度裏づける",
        detail: "一か所の記録だけでは改ざんや誤解を否定できない。残る二経路か、証拠不足のまま訴えるかを選ぶ。",
      }),
      selectedLeadGuidance: Object.freeze({
        kicker: "選んだ確認経路",
        detail: "噂ではなく、後から照合できる記録として一つずつ確かめる。",
      }),
      leads: Object.freeze([
        Object.freeze({
          id: "luca_documents",
          facilityId: "LOC_CAP_LOWER_INN",
          destinationName: "王都下層の安宿",
          label: "元研究員ルカが残した写しを、安宿の隠し場所で確かめる",
          approachId: "luca-copied-diagram",
          discoveryId: "T17-EVIDENCE-LUCA-COPIED-DIAGRAM",
          discoveryText: "ルカが持ち出した召喚陣の写しには、Day1の術式と同じ欠損箇所があり、欄外に「対象は消失せず、座標外へ逸れた可能性」と記されている。",
          minutes: 34,
          leadNarrative: "安宿の裏階段から物置へ入り、ルカが指定した梁の隙間を確かめる。薄い油紙に包まれた写しは、持ち運べる量へ絞られていた。",
        }),
        Object.freeze({
          id: "mage_deliveries",
          facilityId: "LOC_CAP_MAGE_TOWER",
          destinationName: "宮廷魔術塔",
          label: "宮廷魔術塔の搬入口で、儀式用資材の納入記録を調べる",
          approachId: "mage-tower-deliveries",
          discoveryId: "T17-EVIDENCE-MAGE-DELIVERIES",
          discoveryText: "宮廷魔術塔の受領札には、Day41使用予定の魔晶石と拘束具が「第二召喚・本式」の名目で集められ、Day1の失敗記録を再利用する指示まで残っている。",
          minutes: 38,
          leadNarrative: "宮廷魔術塔の正面ではなく、荷車が出入りする搬入口へ回る。術者の名簿は見えなくても、納入札と箱の封印なら外から照合できる。",
        }),
        Object.freeze({
          id: "castle_requisition",
          facilityId: "LOC_CAP_CASTLE",
          destinationName: "王城",
          label: "王城の受付区画で、召喚準備の許可状と予算の流れを照合する",
          approachId: "castle-requisition",
          discoveryId: "T17-EVIDENCE-CASTLE-REQUISITION",
          discoveryText: "王城の公開台帳には、宮廷魔術塔へ人員と資材を回す勅許があり、目的欄には「第一召喚失敗を補う第二召喚」と明記されている。",
          minutes: 41,
          leadNarrative: "王城の奥へ踏み込まず、商人や使者も利用する受付区画へ向かう。公開台帳と掲示された支出許可の範囲だけでも、魔術塔へ流れた資材を追える。",
        }),
      ]),
      prematureResolution: Object.freeze({
        id: "one_source_petition",
        label: "今ある一系統の証拠だけで王城へ訴え、儀式停止を求める",
        minutes: 25,
        summary: "一系統の証拠だけでは、王城は儀式停止を受け入れなかった。別の場所から独立した裏付けを得る必要がある。",
        narrative: "一つの記録を示して儀式停止を求めたが、王城の受付は「写しや一部署の帳面だけでは、勅許を覆せない」と退けた。証拠は無駄になっていない。ただし、別の立場から同じ計画を裏づけなければ、上層部は動かない。",
      }),
    }),
    postInvestigationGuidance: Object.freeze({
      kicker: "第二召喚の証拠",
      title: "独立した二系統の裏付けが揃った",
      detail: "次は、儀式を止めるため誰へ何を突きつけるかを慎重に決める段階に入る。",
    }),
  }),
]);

const PACK_BY_ID = new Map(AUTHORED_MISSION_FLOW_PACKS.map((pack) => [pack.id, pack]));
const PACK_BY_MISSION_ID = new Map(AUTHORED_MISSION_FLOW_PACKS.map((pack) => [pack.missionId, pack]));

function actionId(pack, kind, id) {
  return `MISSION_FLOW:${pack.id}:${kind}:${id}`;
}

function missionDefinition(runtime, pack) {
  return runtime?.playerState?.catalog?.byId?.get?.(pack.missionId)
    ?? runtime?.playerState?.catalog?.special?.find?.((entry) => entry.id === pack.missionId)
    ?? null;
}

function missionRuntime(runtime, pack) {
  return runtime?.playerState?.missions?.[pack.missionId] ?? null;
}

function currentStep(runtime, pack) {
  const definition = missionDefinition(runtime, pack);
  const state = missionRuntime(runtime, pack);
  if (!definition || !state) return null;
  return definition.steps?.find((step) =>
    Number(state.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function playerKnowsTrouble(runtime, pack) {
  const state = runtime?.playerState;
  if (!state) return false;
  if (state.progress?.missions?.attemptedTroubleIds?.has?.(pack.troubleId)
    || state.progress?.missions?.resolvedTroubleIds?.has?.(pack.troubleId)
    || state.progress?.missions?.completedIds?.has?.(pack.missionId)) return true;
  return (state.rumors ?? []).some((rumor) =>
    rumor.troubleId === pack.troubleId && state.player?.knownRumorIds?.has?.(rumor.id));
}

function packAvailable(runtime, pack) {
  return ACTIVE_TROUBLE_STATUSES.has(runtime?.playerState?.troubles?.[pack.troubleId]?.status)
    && ACTIVE_MISSION_STATUSES.has(missionRuntime(runtime, pack)?.status)
    && playerKnowsTrouble(runtime, pack);
}

function availablePack(runtime) {
  return AUTHORED_MISSION_FLOW_PACKS.find((pack) => packAvailable(runtime, pack)) ?? null;
}

function freshState(pack) {
  return {
    version: AUTHORED_MISSION_FLOW_VERSION,
    flowId: pack.id,
    openingChoiceId: null,
    openingChosenAtMinute: null,
    selectedLeadId: null,
    selectedLeadAtMinute: null,
    evidenceIds: [],
    prematureResolutionCount: 0,
    selectedResolutionRouteId: null,
  };
}

export function ensureAuthoredMissionFlowState(runtime, packOrId) {
  const pack = typeof packOrId === "string" ? PACK_BY_ID.get(packOrId) : packOrId;
  if (!pack) return null;
  runtime.authoredMissionFlows ??= {};
  if (!runtime.authoredMissionFlows[pack.id]) {
    const legacy = pack.legacyStateKey ? runtime[pack.legacyStateKey] : null;
    runtime.authoredMissionFlows[pack.id] = { ...freshState(pack), ...(legacy ?? {}) };
  }
  const state = runtime.authoredMissionFlows[pack.id];
  state.version = AUTHORED_MISSION_FLOW_VERSION;
  state.flowId = pack.id;
  state.openingChoiceId ??= null;
  state.openingChosenAtMinute ??= null;
  state.selectedLeadId ??= null;
  state.selectedLeadAtMinute ??= null;
  state.evidenceIds = Array.isArray(state.evidenceIds) ? [...new Set(state.evidenceIds)] : [];
  state.prematureResolutionCount = Math.max(
    0,
    Number(state.prematureResolutionCount ?? state.prematurePetitionCount ?? 0),
  );
  state.selectedResolutionRouteId ??= null;
  return state;
}

export function applyAuthoredMissionFlowCatalogOverrides(catalog) {
  for (const pack of AUTHORED_MISSION_FLOW_PACKS) {
    const mission = catalog.special.find((entry) => entry.id === pack.missionId);
    const hearingStep = mission?.steps.find((step) => step.id === pack.hearing.stepId);
    if (!hearingStep) continue;
    Object.assign(hearingStep, pack.catalogOverride?.hearing ?? {});
  }
  return catalog;
}

function presentNpcIds(presentNpcs) {
  return new Set((presentNpcs ?? []).map((npc) => npc?.id).filter(Boolean));
}

function openingActions(runtime, pack, presentNpcs) {
  const hearing = pack.hearing;
  if (runtime.playerState.player.facilityId !== hearing.targetFacilityId) return null;
  if (!presentNpcIds(presentNpcs).has(hearing.npcId)) return null;
  return hearing.choices.map((choice) => ({
    id: actionId(pack, "OPENING", choice.id),
    family: "talk",
    type: "conversation",
    missionId: pack.missionId,
    stepId: hearing.stepId,
    missionTitle: pack.title,
    missionTroubleId: pack.troubleId,
    targetNpcId: hearing.npcId,
    targetNpcName: hearing.npcName,
    dialogueTopic: choice.dialogueTopic,
    label: choice.label,
    playerUtterance: choice.playerUtterance,
    requiredDisclosure: choice.requiredDisclosure,
    minutes: choice.minutes,
    deferMissionConversationCompletion: true,
    singleTurnConversation: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "opening",
    authoredMissionFlowChoiceId: choice.id,
  }));
}

function movementTo(movementActions, facilityId) {
  return (movementActions ?? []).find((action) =>
    action?.movementScope === "local" && action.destinationFacilityId === facilityId) ?? null;
}

function leadAction(runtime, pack, movementActions, lead) {
  const atTarget = runtime.playerState.player.facilityId === lead.facilityId;
  const movement = atTarget ? null : movementTo(movementActions, lead.facilityId);
  if (!atTarget && !movement) return null;
  return {
    ...(movement ?? {}),
    id: actionId(pack, "LEAD", lead.id),
    type: movement ? "move" : "plan",
    family: movement ? "move" : "prepare",
    minutes: movement ? movement.minutes : 8,
    label: atTarget
      ? `${lead.destinationName}で、${lead.label}`
      : `${lead.destinationName}へ向かい、${lead.label}`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "lead",
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowTargetFacilityId: lead.facilityId,
  };
}

function leadSelectionActions(runtime, pack, movementActions, evidenceIds) {
  const investigation = pack.investigation;
  const remaining = investigation.leads.filter((lead) => !evidenceIds.has(lead.discoveryId));
  const actions = remaining.map((lead) => leadAction(runtime, pack, movementActions, lead)).filter(Boolean);
  if (!evidenceIds.size) return actions.length === 3 ? actions : null;
  if (actions.length !== 2 || !investigation.prematureResolution) return null;
  const premature = investigation.prematureResolution;
  return [...actions, {
    id: actionId(pack, "PREMATURE", premature.id),
    family: "resolve",
    type: "plan",
    minutes: premature.minutes,
    label: premature.label,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "premature_resolution",
  }];
}

export function authoredMissionFlowExclusiveActions(runtime, {
  presentNpcs = [],
  movementActions = [],
} = {}) {
  const pack = availablePack(runtime);
  if (!pack) return null;
  const step = currentStep(runtime, pack);
  if (!step) return null;
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  if (step.id === pack.hearing.stepId) return openingActions(runtime, pack, presentNpcs);
  if (step.id !== pack.investigation.stepId || !flow.openingChoiceId || flow.selectedLeadId) return null;
  const evidenceIds = new Set(flow.evidenceIds);
  if (evidenceIds.size >= pack.investigation.requiredEvidenceCount) return null;
  return leadSelectionActions(runtime, pack, movementActions, evidenceIds);
}

export function authoredMissionFlowEvidenceAction(runtime) {
  const pack = availablePack(runtime);
  if (!pack) return null;
  const step = currentStep(runtime, pack);
  if (step?.id !== pack.investigation.stepId) return null;
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
  if (!lead || runtime.playerState.player.facilityId !== lead.facilityId) return null;
  const discoveries = missionRuntime(runtime, pack)?.discoveries ?? [];
  if (flow.evidenceIds.includes(lead.discoveryId)
    || discoveries.some((entry) => entry.id === lead.discoveryId)) return null;
  return {
    id: actionId(pack, "EVIDENCE", lead.id),
    family: "investigate",
    type: "investigate",
    missionId: pack.missionId,
    stepId: pack.investigation.stepId,
    missionTitle: pack.title,
    missionTroubleId: pack.troubleId,
    minutes: lead.minutes,
    label: lead.label,
    investigationStage: Math.max(
      0,
      Number(missionRuntime(runtime, pack)?.progress?.[pack.investigation.stepId] ?? 0),
    ),
    approachId: lead.approachId,
    discoveryId: lead.discoveryId,
    discoveryText: lead.discoveryText,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "evidence",
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowEvidenceId: lead.discoveryId,
  };
}

export function suppressGenericAuthoredMissionAction(runtime, action) {
  const pack = action?.missionId ? PACK_BY_MISSION_ID.get(action.missionId) : null;
  if (!pack || !packAvailable(runtime, pack)) return false;
  return action.authoredMissionFlowId !== pack.id;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  if (!action?.authoredMissionFlowId || result?.ok === false) return false;
  const pack = PACK_BY_ID.get(action.authoredMissionFlowId);
  if (!pack) return false;
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);
  let changed = false;
  if (action.authoredMissionFlowKind === "opening") {
    flow.openingChoiceId = action.authoredMissionFlowChoiceId;
    flow.openingChosenAtMinute ??= minute;
    changed = true;
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_OPENING_SELECTED",
      minute,
      flowId: pack.id,
      missionId: pack.missionId,
      choiceId: action.authoredMissionFlowChoiceId,
    });
  }
  if (action.authoredMissionFlowKind === "lead") {
    flow.selectedLeadId = action.authoredMissionFlowLeadId;
    flow.selectedLeadAtMinute = minute;
    changed = true;
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_LEAD_SELECTED",
      minute,
      flowId: pack.id,
      missionId: pack.missionId,
      leadId: action.authoredMissionFlowLeadId,
      facilityId: action.authoredMissionFlowTargetFacilityId ?? runtime.playerState.player.facilityId,
    });
  }
  if (action.authoredMissionFlowKind === "evidence") {
    if (!flow.evidenceIds.includes(action.authoredMissionFlowEvidenceId)) {
      flow.evidenceIds.push(action.authoredMissionFlowEvidenceId);
    }
    flow.selectedLeadId = null;
    flow.selectedLeadAtMinute = null;
    changed = true;
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_EVIDENCE_VERIFIED",
      minute,
      flowId: pack.id,
      missionId: pack.missionId,
      evidenceId: action.authoredMissionFlowEvidenceId,
      leadId: action.authoredMissionFlowLeadId ?? null,
    });
  }
  if (action.authoredMissionFlowKind === "premature_resolution") {
    flow.prematureResolutionCount += 1;
    result.summary = pack.investigation.prematureResolution.summary;
    changed = true;
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_PREMATURE_RESOLUTION_REJECTED",
      minute,
      flowId: pack.id,
      missionId: pack.missionId,
      evidenceCount: flow.evidenceIds.length,
    });
  }
  return changed;
}

export function authoredMissionFlowGuidance(runtime) {
  const pack = availablePack(runtime);
  if (!pack) return null;
  const step = currentStep(runtime, pack);
  if (!step) return null;
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  if (step.id === pack.hearing.stepId) return {
    ...pack.hearing.guidance,
    targetFacilityId: pack.hearing.targetFacilityId,
    actionPanel: runtime.playerState.player.facilityId === pack.hearing.targetFacilityId ? null : "movement",
  };
  if (step.id === pack.investigation.stepId) {
    const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
    if (lead) return {
      ...pack.investigation.selectedLeadGuidance,
      title: lead.label,
      targetFacilityId: lead.facilityId,
      actionPanel: runtime.playerState.player.facilityId === lead.facilityId ? null : "movement",
    };
    if (flow.evidenceIds.length === 0) return {
      ...pack.investigation.initialGuidance,
      targetFacilityId: null,
      actionPanel: null,
    };
    return {
      ...pack.investigation.continuedGuidance,
      targetFacilityId: null,
      actionPanel: null,
    };
  }
  return {
    ...pack.postInvestigationGuidance,
    targetFacilityId: null,
    actionPanel: null,
  };
}

function scene(sceneId, priority, when, narrative, speeches = []) {
  return Object.freeze({
    sceneId,
    priority,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze(when.map((condition) => Object.freeze(condition))) }),
    narrative,
    beats: Object.freeze(speeches.map((speech) => Object.freeze({
      kind: "npc",
      ...speech,
    }))),
    choices: Object.freeze([]),
  });
}

function scenesForPack(pack) {
  const scenes = [];
  for (const choice of pack.hearing.choices) {
    scenes.push(scene(
      `mission-flow.${pack.id}.opening.${choice.id}`,
      980,
      [
        { path: "action.id", op: "eq", value: actionId(pack, "OPENING", choice.id) },
        { path: "mission.id", op: "eq", value: pack.missionId },
        { path: "location.facilityId", op: "eq", value: pack.hearing.targetFacilityId },
      ],
      choice.narrative,
      choice.speeches,
    ));
  }
  for (const lead of pack.investigation.leads) {
    scenes.push(scene(
      `mission-flow.${pack.id}.lead.${lead.id}`,
      970,
      [{ path: "action.id", op: "eq", value: actionId(pack, "LEAD", lead.id) }],
      lead.leadNarrative,
    ));
    scenes.push(scene(
      `mission-flow.${pack.id}.evidence.${lead.id}`,
      965,
      [
        { path: "action.id", op: "eq", value: actionId(pack, "EVIDENCE", lead.id) },
        { path: "outcome.discovery.id", op: "eq", value: lead.discoveryId },
      ],
      lead.discoveryText,
    ));
  }
  if (pack.investigation.prematureResolution) {
    const premature = pack.investigation.prematureResolution;
    scenes.push(scene(
      `mission-flow.${pack.id}.premature.${premature.id}`,
      960,
      [{ path: "action.id", op: "eq", value: actionId(pack, "PREMATURE", premature.id) }],
      premature.narrative,
    ));
  }
  return scenes;
}

export const AUTHORED_MISSION_FLOW_SCENES = Object.freeze(
  AUTHORED_MISSION_FLOW_PACKS.flatMap(scenesForPack),
);
