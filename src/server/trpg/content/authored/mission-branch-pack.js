const ACTIVE_TROUBLE_STATUSES = new Set(["active", "critical"]);
const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);

export const AUTHORED_MISSION_BRANCH_VERSION = "authored-mission-branch-v1";

const SECOND_SUMMONING_BRANCH = Object.freeze({
  id: "second-summoning-investigation",
  version: "second-summoning-investigation-v1",
  missionId: "MSN-T17",
  troubleId: "T17",
  missionTitle: "王都の第二召喚儀式",
  openingStepId: "hear",
  investigationStepId: "investigate",
  openingFacilityId: "LOC_CAP_LOWER_INN",
  openingNpcId: "NPC018",
  openingNpcName: "ライラ",
  catalogOverride: Object.freeze({
    targetLocation: "王都",
    targetFacilityId: "LOC_CAP_LOWER_INN",
    label: "王都下層で、第二召喚を止めようとする人物と接触する",
  }),
  openingActions: Object.freeze([
    Object.freeze({
      id: "WHEN_WHERE",
      dialogueTopic: "branch_when_where",
      label: "二度目の召喚を、いつ、どこで行うつもりなのか尋ねる",
      playerUtterance: "二度目の召喚は、いつ、どこで行われるんですか？",
      requiredDisclosure: "第二召喚の本式はDay41、宮廷魔術塔で行われる",
      minutes: 10,
      narrative: "安宿の食堂の隅で、外套を深く被った女性は周囲の卓を一度見渡し、声を落とした。曖昧な警告ではなく、止めるべき時刻と場所から話すつもりらしい。",
      speech: "私はライラ。第二召喚の本式はDay41、宮廷魔術塔で行われる。今は資材と術者を集めている段階よ。止めるなら、儀式の日では遅い。",
      emotion: "慎重",
    }),
    Object.freeze({
      id: "WHY_PLAYER",
      dialogueTopic: "branch_why_player",
      label: "なぜ自分へ声をかけたのか、召喚との関係を問い返す",
      playerUtterance: "なぜ私にその話を？　私と召喚に、どんな関係があるんですか？",
      requiredDisclosure: "Day1の召喚対象は消滅せず、王都の外へ逸れて生存した可能性がある",
      minutes: 13,
      narrative: "女性はすぐに答えず、こちらの服装と手元を確かめる。確信ではなく、危険な仮説を口にする前のためらいだった。",
      speech: "私はライラ。Day1の召喚対象は消滅せず、王都の外へ逸れて生存した可能性がある。足跡も荷もなく田園の村へ現れたあなたは、その仮説と重なる。でも、あなたを利用したくはない。だから証拠を一緒に確かめたい。",
      emotion: "警戒と誠実さ",
    }),
    Object.freeze({
      id: "DEMAND_PROOF",
      dialogueTopic: "branch_demand_proof",
      label: "阻止派の話だけでは動けないと告げ、独立して確かめられる証拠を求める",
      playerUtterance: "あなたたちの話だけでは動けません。私自身が確かめられる証拠を示してください。",
      requiredDisclosure: "元研究員の写し、魔術塔の納入記録、王城の許可状という三つの確認先がある",
      minutes: 12,
      narrative: "女性は反発せず、小さくうなずいた。阻止派という立場だけで信用を求めるつもりはないらしい。卓上へ王都の簡単な見取り図を広げ、三か所へ印を置く。",
      speech: "私はライラ。その判断でいい。確認先は三つ。元研究員の写し、魔術塔の納入記録、王城の許可状。互いに別の場所へ残った記録だから、二つ以上が一致すれば私たちの作り話ではないと分かる。",
      emotion: "安堵",
    }),
  ]),
  leads: Object.freeze([
    Object.freeze({
      id: "luca_documents",
      facilityId: "LOC_CAP_LOWER_INN",
      facilityName: "王都下層の安宿",
      label: "元研究員ルカが残した写しを、安宿の隠し場所で確かめる",
      approachId: "luca-copied-diagram",
      discoveryId: "T17-EVIDENCE-LUCA-COPIED-DIAGRAM",
      discoveryText: "ルカが持ち出した召喚陣の写しには、Day1の術式と同じ欠損箇所があり、欄外に「対象は消失せず、座標外へ逸れた可能性」と記されている。",
      minutes: 34,
      arrivalNarrative: "安宿の裏階段から物置へ入り、ルカが指定した梁の隙間を確かめる。薄い油紙に包まれた写しは、持ち運べる量へ絞られていた。",
    }),
    Object.freeze({
      id: "mage_deliveries",
      facilityId: "LOC_CAP_MAGE_TOWER",
      facilityName: "宮廷魔術塔",
      label: "宮廷魔術塔の搬入口で、儀式用資材の納入記録を調べる",
      approachId: "mage-tower-deliveries",
      discoveryId: "T17-EVIDENCE-MAGE-DELIVERIES",
      discoveryText: "宮廷魔術塔の受領札には、Day41使用予定の魔晶石と拘束具が「第二召喚・本式」の名目で集められ、Day1の失敗記録を再利用する指示まで残っている。",
      minutes: 38,
      arrivalNarrative: "宮廷魔術塔の正面ではなく、荷車が出入りする搬入口へ回る。術者の名簿は見えなくても、納入札と箱の封印なら外から照合できる。",
    }),
    Object.freeze({
      id: "castle_requisition",
      facilityId: "LOC_CAP_CASTLE",
      facilityName: "王城",
      label: "王城の受付区画で、召喚準備の許可状と予算の流れを照合する",
      approachId: "castle-requisition",
      discoveryId: "T17-EVIDENCE-CASTLE-REQUISITION",
      discoveryText: "王城の公開台帳には、宮廷魔術塔へ人員と資材を回す勅許があり、目的欄には「第一召喚失敗を補う第二召喚」と明記されている。",
      minutes: 41,
      arrivalNarrative: "王城の奥へ踏み込まず、商人や使者も利用する受付区画へ向かう。公開台帳と掲示された支出許可の範囲だけでも、魔術塔へ流れた資材を追える。",
    }),
  ]),
  requiredEvidenceCount: 2,
  prematureResolution: Object.freeze({
    id: "ONE_SOURCE",
    label: "今ある一系統の証拠だけで王城へ訴え、儀式停止を求める",
    minutes: 25,
    summary: "一系統の証拠だけでは、王城は儀式停止を受け入れなかった。別の場所から独立した裏付けを得る必要がある。",
    narrative: "一つの記録を示して儀式停止を求めたが、王城の受付は『写しや一部署の帳面だけでは、勅許を覆せない』と退けた。証拠は無駄になっていない。ただし、別の立場から同じ計画を裏づけなければ、上層部は動かない。",
  }),
  guidance: Object.freeze({
    opening: Object.freeze({
      kicker: "王都で聞いた不穏な話",
      title: "下層の安宿で、第二召喚を止めようとする人物と話す",
      detail: "相手の主張を鵜呑みにせず、時刻・自分との関係・検証可能な証拠のどれから確かめるか選べる。",
    }),
    chooseFirst: Object.freeze({
      kicker: "第二召喚の裏付け",
      title: "三つの確認先から、最初の証拠を選ぶ",
      detail: "元研究員の写し、魔術塔の納入記録、王城の許可状は、それぞれ別の立場から儀式を裏づける。",
    }),
    followup: Object.freeze({
      kicker: "一つ目の証拠を確認済み",
      title: "別系統の記録で、第二召喚をもう一度裏づける",
      detail: "一か所の記録だけでは改ざんや誤解を否定できない。残る二経路か、証拠不足のまま訴えるかを選ぶ。",
    }),
    complete: Object.freeze({
      kicker: "第二召喚の証拠",
      title: "独立した二系統の裏付けが揃った",
      detail: "次は、儀式を止めるため誰へ何を突きつけるかを慎重に決める段階に入る。",
    }),
  }),
});

export const AUTHORED_MISSION_BRANCHES = Object.freeze([
  SECOND_SUMMONING_BRANCH,
]);

export const AUTHORED_BRANCH_HEARING_MISSION_IDS = Object.freeze(
  AUTHORED_MISSION_BRANCHES.map((definition) => definition.missionId),
);

function missionDefinition(runtime, definition) {
  return runtime?.playerState?.catalog?.byId?.get?.(definition.missionId)
    ?? runtime?.playerState?.catalog?.special?.find?.((entry) => entry.id === definition.missionId)
    ?? null;
}

function missionRuntime(runtime, definition) {
  return runtime?.playerState?.missions?.[definition.missionId] ?? null;
}

function currentStep(runtime, definition) {
  const catalogEntry = missionDefinition(runtime, definition);
  const mission = missionRuntime(runtime, definition);
  if (!catalogEntry || !mission) return null;
  return catalogEntry.steps?.find((step) =>
    Number(mission.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function playerKnowsTrouble(runtime, definition) {
  const state = runtime?.playerState;
  if (!state) return false;
  if (state.progress?.missions?.attemptedTroubleIds?.has?.(definition.troubleId)
    || state.progress?.missions?.resolvedTroubleIds?.has?.(definition.troubleId)
    || state.progress?.missions?.completedIds?.has?.(definition.missionId)) return true;
  return (state.rumors ?? []).some((rumor) =>
    rumor.troubleId === definition.troubleId && state.player?.knownRumorIds?.has?.(rumor.id));
}

function branchAvailable(runtime, definition) {
  const troubleStatus = runtime?.playerState?.troubles?.[definition.troubleId]?.status;
  const missionStatus = missionRuntime(runtime, definition)?.status;
  return ACTIVE_TROUBLE_STATUSES.has(troubleStatus)
    && ACTIVE_MISSION_STATUSES.has(missionStatus)
    && playerKnowsTrouble(runtime, definition);
}

function activeDefinition(runtime) {
  return AUTHORED_MISSION_BRANCHES.find((definition) => branchAvailable(runtime, definition)) ?? null;
}

function legacyState(runtime, definition) {
  if (definition.id === "second-summoning-investigation" && runtime?.t17SecondSummoning) {
    const migrated = { ...runtime.t17SecondSummoning };
    delete runtime.t17SecondSummoning;
    return migrated;
  }
  return null;
}

function ensureBranchState(runtime, definition) {
  runtime.authoredMissionBranches ??= {};
  runtime.authoredMissionBranches[definition.id] ??= legacyState(runtime, definition) ?? {
    version: definition.version,
    openingChoiceId: null,
    openingChosenAtMinute: null,
    selectedLeadId: null,
    selectedLeadAtMinute: null,
    evidenceIds: [],
    prematureResolutionCount: 0,
  };
  const state = runtime.authoredMissionBranches[definition.id];
  state.version = definition.version;
  state.openingChoiceId ??= null;
  state.openingChosenAtMinute ??= null;
  state.selectedLeadId ??= null;
  state.selectedLeadAtMinute ??= null;
  state.evidenceIds = Array.isArray(state.evidenceIds) ? [...new Set(state.evidenceIds)] : [];
  state.prematureResolutionCount = Math.max(0, Number(
    state.prematureResolutionCount ?? state.prematurePetitionCount ?? 0,
  ));
  delete state.prematurePetitionCount;
  return state;
}

function presentNpcIds(presentNpcs) {
  return new Set((presentNpcs ?? []).map((npc) => npc?.id).filter(Boolean));
}

function actionPrefix(definition) {
  return `AUTHORED_BRANCH:${definition.id}`;
}

function openingActions(runtime, definition, presentNpcs) {
  if (runtime.playerState.player.facilityId !== definition.openingFacilityId) return null;
  if (!presentNpcIds(presentNpcs).has(definition.openingNpcId)) return null;
  return definition.openingActions.map((entry) => ({
    id: `${actionPrefix(definition)}:OPENING:${entry.id}`,
    family: "talk",
    type: "conversation",
    dialogueTopic: entry.dialogueTopic,
    label: entry.label,
    playerUtterance: entry.playerUtterance,
    requiredDisclosure: entry.requiredDisclosure,
    missionId: definition.missionId,
    stepId: definition.openingStepId,
    missionTitle: definition.missionTitle,
    missionTroubleId: definition.troubleId,
    targetNpcId: definition.openingNpcId,
    targetNpcName: definition.openingNpcName,
    minutes: entry.minutes,
    deferMissionConversationCompletion: true,
    singleTurnConversation: true,
    authoredBranchExclusiveChoice: true,
    authoredBranchId: definition.id,
    authoredBranchOpeningChoiceId: entry.id,
  }));
}

function movementTo(movementActions, facilityId) {
  return (movementActions ?? []).find((action) =>
    action?.movementScope === "local" && action.destinationFacilityId === facilityId) ?? null;
}

function leadAction(runtime, definition, movementActions, lead) {
  const atTarget = runtime.playerState.player.facilityId === lead.facilityId;
  const movement = atTarget ? null : movementTo(movementActions, lead.facilityId);
  if (!atTarget && !movement) return null;
  return {
    ...(movement ?? {}),
    id: `${actionPrefix(definition)}:LEAD:${lead.id}`,
    type: movement ? "move" : "plan",
    family: movement ? "move" : "prepare",
    minutes: movement ? movement.minutes : 8,
    label: atTarget ? `${lead.facilityName}で、${lead.label}` : `${lead.facilityName}へ向かい、${lead.label}`,
    authoredBranchExclusiveChoice: true,
    authoredBranchId: definition.id,
    authoredBranchLeadId: lead.id,
    authoredBranchLeadFacilityId: lead.facilityId,
  };
}

function leadSelectionActions(runtime, definition, movementActions, evidenceIds) {
  const remaining = definition.leads.filter((lead) => !evidenceIds.has(lead.discoveryId));
  const actions = remaining.map((lead) => leadAction(runtime, definition, movementActions, lead)).filter(Boolean);
  if (!evidenceIds.size) return actions.length === 3 ? actions : null;
  if (actions.length !== 2 || !definition.prematureResolution) return null;
  return [...actions, {
    id: `${actionPrefix(definition)}:PREMATURE:${definition.prematureResolution.id}`,
    family: "resolve",
    type: "plan",
    minutes: definition.prematureResolution.minutes,
    label: definition.prematureResolution.label,
    authoredBranchExclusiveChoice: true,
    authoredBranchId: definition.id,
    authoredBranchPrematureResolution: true,
  }];
}

export function applyAuthoredMissionCatalogOverrides(catalog) {
  for (const definition of AUTHORED_MISSION_BRANCHES) {
    const mission = catalog.special.find((entry) => entry.id === definition.missionId);
    const hearing = mission?.steps.find((step) => step.id === definition.openingStepId);
    if (!hearing) continue;
    Object.assign(hearing, definition.catalogOverride);
  }
  return catalog;
}

export function authoredMissionBranchExclusiveActions(runtime, {
  presentNpcs = [],
  movementActions = [],
} = {}) {
  const definition = activeDefinition(runtime);
  if (!definition) return null;
  const step = currentStep(runtime, definition);
  if (!step) return null;
  const state = ensureBranchState(runtime, definition);
  if (step.id === definition.openingStepId) return openingActions(runtime, definition, presentNpcs);
  if (step.id !== definition.investigationStepId || !state.openingChoiceId || state.selectedLeadId) return null;
  const evidenceIds = new Set(state.evidenceIds);
  if (evidenceIds.size >= definition.requiredEvidenceCount) return null;
  return leadSelectionActions(runtime, definition, movementActions, evidenceIds);
}

export function authoredMissionBranchEvidenceAction(runtime) {
  const definition = activeDefinition(runtime);
  if (!definition) return null;
  const step = currentStep(runtime, definition);
  if (step?.id !== definition.investigationStepId) return null;
  const state = ensureBranchState(runtime, definition);
  const lead = definition.leads.find((entry) => entry.id === state.selectedLeadId);
  if (!lead || runtime.playerState.player.facilityId !== lead.facilityId) return null;
  const discoveries = missionRuntime(runtime, definition)?.discoveries ?? [];
  if (state.evidenceIds.includes(lead.discoveryId)
    || discoveries.some((entry) => entry.id === lead.discoveryId)) return null;
  return {
    id: `${actionPrefix(definition)}:EVIDENCE:${lead.id}`,
    family: "investigate",
    type: "investigate",
    missionId: definition.missionId,
    stepId: definition.investigationStepId,
    missionTitle: definition.missionTitle,
    missionTroubleId: definition.troubleId,
    minutes: lead.minutes,
    label: lead.label,
    investigationStage: Math.max(0, Number(missionRuntime(runtime, definition)?.progress?.[definition.investigationStepId] ?? 0)),
    approachId: lead.approachId,
    discoveryId: lead.discoveryId,
    discoveryText: lead.discoveryText,
    authoredBranchId: definition.id,
    authoredBranchEvidenceId: lead.discoveryId,
    authoredBranchLeadId: lead.id,
  };
}

export function suppressGenericAuthoredMissionAction(runtime, action) {
  const definition = activeDefinition(runtime);
  if (!definition || action?.missionId !== definition.missionId) return false;
  return !String(action.id ?? "").startsWith(actionPrefix(definition));
}

export function applyAuthoredMissionBranchAction(runtime, action, result) {
  if (!action?.authoredBranchId || result?.ok === false) return false;
  const definition = AUTHORED_MISSION_BRANCHES.find((entry) => entry.id === action.authoredBranchId);
  if (!definition) return false;
  const state = ensureBranchState(runtime, definition);
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);
  let changed = false;
  if (action.authoredBranchOpeningChoiceId) {
    state.openingChoiceId = action.authoredBranchOpeningChoiceId;
    state.openingChosenAtMinute ??= minute;
    runtime.playerState.history.push({
      type: "AUTHORED_BRANCH_OPENING_SELECTED",
      minute,
      branchId: definition.id,
      actionId: action.id,
    });
    changed = true;
  }
  if (action.authoredBranchLeadId && !action.authoredBranchEvidenceId) {
    state.selectedLeadId = action.authoredBranchLeadId;
    state.selectedLeadAtMinute = minute;
    runtime.playerState.history.push({
      type: "AUTHORED_BRANCH_LEAD_SELECTED",
      minute,
      branchId: definition.id,
      leadId: action.authoredBranchLeadId,
      facilityId: action.authoredBranchLeadFacilityId ?? runtime.playerState.player.facilityId,
    });
    changed = true;
  }
  if (action.authoredBranchEvidenceId) {
    if (!state.evidenceIds.includes(action.authoredBranchEvidenceId)) {
      state.evidenceIds.push(action.authoredBranchEvidenceId);
    }
    state.selectedLeadId = null;
    state.selectedLeadAtMinute = null;
    runtime.playerState.history.push({
      type: "AUTHORED_BRANCH_EVIDENCE_VERIFIED",
      minute,
      branchId: definition.id,
      evidenceId: action.authoredBranchEvidenceId,
      leadId: action.authoredBranchLeadId ?? null,
    });
    changed = true;
  }
  if (action.authoredBranchPrematureResolution && definition.prematureResolution) {
    state.prematureResolutionCount += 1;
    result.summary = definition.prematureResolution.summary;
    runtime.playerState.history.push({
      type: "AUTHORED_BRANCH_PREMATURE_RESOLUTION_REJECTED",
      minute,
      branchId: definition.id,
      evidenceCount: state.evidenceIds.length,
    });
    changed = true;
  }
  return changed;
}

export function authoredMissionBranchGuidance(runtime) {
  const definition = activeDefinition(runtime);
  if (!definition) return null;
  const step = currentStep(runtime, definition);
  if (!step) return null;
  const state = ensureBranchState(runtime, definition);
  if (step.id === definition.openingStepId) return {
    ...definition.guidance.opening,
    missionId: definition.missionId,
    targetFacilityId: definition.openingFacilityId,
    actionPanel: runtime.playerState.player.facilityId === definition.openingFacilityId ? null : "movement",
  };
  if (step.id === definition.investigationStepId) {
    const lead = definition.leads.find((entry) => entry.id === state.selectedLeadId);
    if (lead) return {
      kicker: "選んだ確認経路",
      title: lead.label,
      detail: "噂ではなく、後から照合できる記録として一つずつ確かめる。",
      missionId: definition.missionId,
      targetFacilityId: lead.facilityId,
      actionPanel: runtime.playerState.player.facilityId === lead.facilityId ? null : "movement",
    };
    return {
      ...(state.evidenceIds.length ? definition.guidance.followup : definition.guidance.chooseFirst),
      missionId: definition.missionId,
      targetFacilityId: null,
      actionPanel: null,
    };
  }
  return {
    ...definition.guidance.complete,
    missionId: definition.missionId,
    targetFacilityId: null,
    actionPanel: null,
  };
}

function openingScenes(definition) {
  return definition.openingActions.map((entry, index) => Object.freeze({
    sceneId: `mission-branch.${definition.id}.opening.${entry.id.toLowerCase()}`,
    priority: 980 - index,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: `${actionPrefix(definition)}:OPENING:${entry.id}` }),
      Object.freeze({ path: "mission.id", op: "eq", value: definition.missionId }),
      Object.freeze({ path: "location.facilityId", op: "eq", value: definition.openingFacilityId }),
    ]) }),
    narrative: entry.narrative,
    beats: Object.freeze([
      Object.freeze({ kind: "npc", actorId: definition.openingNpcId, text: entry.speech, emotion: entry.emotion }),
    ]),
    choices: Object.freeze([]),
  }));
}

function leadScenes(definition) {
  return definition.leads.flatMap((lead) => [
    Object.freeze({
      sceneId: `mission-branch.${definition.id}.lead.${lead.id}`,
      priority: 970,
      presentationOnly: true,
      when: Object.freeze({ all: Object.freeze([
        Object.freeze({ path: "action.id", op: "eq", value: `${actionPrefix(definition)}:LEAD:${lead.id}` }),
      ]) }),
      narrative: lead.arrivalNarrative,
      beats: Object.freeze([]),
      choices: Object.freeze([]),
    }),
    Object.freeze({
      sceneId: `mission-branch.${definition.id}.evidence.${lead.id}`,
      priority: 965,
      presentationOnly: true,
      when: Object.freeze({ all: Object.freeze([
        Object.freeze({ path: "action.id", op: "eq", value: `${actionPrefix(definition)}:EVIDENCE:${lead.id}` }),
        Object.freeze({ path: "outcome.discovery.id", op: "eq", value: lead.discoveryId }),
      ]) }),
      narrative: lead.discoveryText,
      beats: Object.freeze([]),
      choices: Object.freeze([]),
    }),
  ]);
}

function prematureScene(definition) {
  if (!definition.prematureResolution) return [];
  return [Object.freeze({
    sceneId: `mission-branch.${definition.id}.premature.${definition.prematureResolution.id.toLowerCase()}`,
    priority: 960,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({
        path: "action.id",
        op: "eq",
        value: `${actionPrefix(definition)}:PREMATURE:${definition.prematureResolution.id}`,
      }),
    ]) }),
    narrative: definition.prematureResolution.narrative,
    beats: Object.freeze([]),
    choices: Object.freeze([]),
  })];
}

export const AUTHORED_MISSION_BRANCH_SCENES = Object.freeze(
  AUTHORED_MISSION_BRANCHES.flatMap((definition) => [
    ...openingScenes(definition),
    ...leadScenes(definition),
    ...prematureScene(definition),
  ]),
);
