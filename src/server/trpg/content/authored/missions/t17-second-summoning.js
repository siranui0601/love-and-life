export const T17_SECOND_SUMMONING_VERSION = "t17-second-summoning-v1";

export const T17_MISSION_ID = "MSN-T17";
export const T17_TROUBLE_ID = "T17";
export const T17_LAYLA_NPC_ID = "NPC018";

const LOWER_INN_ID = "LOC_CAP_LOWER_INN";
const MAGE_TOWER_ID = "LOC_CAP_MAGE_TOWER";
const CASTLE_ID = "LOC_CAP_CASTLE";

const ACTIVE_STATUSES = new Set(["active", "critical"]);
const MISSION_ACTIVE_STATUSES = new Set(["active", "available", "in_progress"]);

const LEADS = Object.freeze({
  luca_documents: Object.freeze({
    id: "luca_documents",
    facilityId: LOWER_INN_ID,
    label: "元研究員ルカが残した写しを、安宿の隠し場所で確かめる",
    approachId: "luca-copied-diagram",
    discoveryId: "T17-EVIDENCE-LUCA-COPIED-DIAGRAM",
    discoveryText: "ルカが持ち出した召喚陣の写しには、Day1の術式と同じ欠損箇所があり、欄外に「対象は消失せず、座標外へ逸れた可能性」と記されている。",
    minutes: 34,
  }),
  mage_deliveries: Object.freeze({
    id: "mage_deliveries",
    facilityId: MAGE_TOWER_ID,
    label: "宮廷魔術塔の搬入口で、儀式用資材の納入記録を調べる",
    approachId: "mage-tower-deliveries",
    discoveryId: "T17-EVIDENCE-MAGE-DELIVERIES",
    discoveryText: "宮廷魔術塔の受領札には、Day41使用予定の魔晶石と拘束具が「第二召喚・本式」の名目で集められ、Day1の失敗記録を再利用する指示まで残っている。",
    minutes: 38,
  }),
  castle_requisition: Object.freeze({
    id: "castle_requisition",
    facilityId: CASTLE_ID,
    label: "王城の受付区画で、召喚準備の許可状と予算の流れを照合する",
    approachId: "castle-requisition",
    discoveryId: "T17-EVIDENCE-CASTLE-REQUISITION",
    discoveryText: "王城の公開台帳には、宮廷魔術塔へ人員と資材を回す勅許があり、目的欄には「第一召喚失敗を補う第二召喚」と明記されている。",
    minutes: 41,
  }),
});

const OPENING_ACTIONS = Object.freeze([
  Object.freeze({
    id: "T17:OPENING:WHEN_WHERE",
    dialogueTopic: "t17_when_where",
    label: "二度目の召喚を、いつ、どこで行うつもりなのか尋ねる",
    requiredDisclosure: "第二召喚の本式はDay41、宮廷魔術塔で行われる",
  }),
  Object.freeze({
    id: "T17:OPENING:WHY_ME",
    dialogueTopic: "t17_why_player",
    label: "なぜ自分へ声をかけたのか、召喚との関係を問い返す",
    requiredDisclosure: "Day1の召喚対象は消滅せず、王都の外へ逸れて生存した可能性がある",
  }),
  Object.freeze({
    id: "T17:OPENING:PROOF",
    dialogueTopic: "t17_demand_proof",
    label: "阻止派の話だけでは動けないと告げ、独立して確かめられる証拠を求める",
    requiredDisclosure: "元研究員の写し、魔術塔の納入記録、王城の許可状という三つの確認先がある",
  }),
]);

function missionDefinition(runtime) {
  return runtime?.playerState?.catalog?.byId?.get?.(T17_MISSION_ID)
    ?? runtime?.playerState?.catalog?.special?.find?.((entry) => entry.id === T17_MISSION_ID)
    ?? null;
}

function missionRuntime(runtime) {
  return runtime?.playerState?.missions?.[T17_MISSION_ID] ?? null;
}

function currentStep(runtime) {
  const definition = missionDefinition(runtime);
  const state = missionRuntime(runtime);
  if (!definition || !state) return null;
  return definition.steps?.find((step) =>
    Number(state.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function playerKnowsT17(runtime) {
  const state = runtime?.playerState;
  if (!state) return false;
  if (state.progress?.missions?.attemptedTroubleIds?.has?.(T17_TROUBLE_ID)
    || state.progress?.missions?.resolvedTroubleIds?.has?.(T17_TROUBLE_ID)
    || state.progress?.missions?.completedIds?.has?.(T17_MISSION_ID)) return true;
  return (state.rumors ?? []).some((rumor) =>
    rumor.troubleId === T17_TROUBLE_ID && state.player?.knownRumorIds?.has?.(rumor.id));
}

function arcAvailable(runtime) {
  const troubleStatus = runtime?.playerState?.troubles?.[T17_TROUBLE_ID]?.status;
  const missionStatus = missionRuntime(runtime)?.status;
  return ACTIVE_STATUSES.has(troubleStatus)
    && MISSION_ACTIVE_STATUSES.has(missionStatus)
    && playerKnowsT17(runtime);
}

export function ensureT17SecondSummoningState(runtime) {
  runtime.t17SecondSummoning ??= {
    version: T17_SECOND_SUMMONING_VERSION,
    openingChoiceId: null,
    openingChosenAtMinute: null,
    selectedLeadId: null,
    selectedLeadAtMinute: null,
    evidenceIds: [],
    prematurePetitionCount: 0,
  };
  const state = runtime.t17SecondSummoning;
  state.version = T17_SECOND_SUMMONING_VERSION;
  state.openingChoiceId ??= null;
  state.openingChosenAtMinute ??= null;
  state.selectedLeadId ??= null;
  state.selectedLeadAtMinute ??= null;
  state.evidenceIds = Array.isArray(state.evidenceIds) ? [...new Set(state.evidenceIds)] : [];
  state.prematurePetitionCount = Math.max(0, Number(state.prematurePetitionCount ?? 0));
  return state;
}

function presentNpcIds(presentNpcs) {
  return new Set((presentNpcs ?? []).map((npc) => npc?.id).filter(Boolean));
}

function openingActions(runtime, presentNpcs) {
  if (runtime.playerState.player.facilityId !== LOWER_INN_ID) return null;
  if (!presentNpcIds(presentNpcs).has(T17_LAYLA_NPC_ID)) return null;
  return OPENING_ACTIONS.map((entry) => ({
    ...entry,
    family: "talk",
    type: "conversation",
    missionId: T17_MISSION_ID,
    stepId: "hear",
    missionTitle: "王都の第二召喚儀式",
    missionTroubleId: T17_TROUBLE_ID,
    targetNpcId: T17_LAYLA_NPC_ID,
    targetNpcName: "ライラ",
    minutes: entry.id.endsWith("WHEN_WHERE") ? 10 : entry.id.endsWith("WHY_ME") ? 13 : 12,
    deferMissionConversationCompletion: true,
    singleTurnConversation: true,
    t17ExclusiveChoice: true,
    t17OpeningChoiceId: entry.id,
  }));
}

function movementTo(movementActions, facilityId) {
  return (movementActions ?? []).find((action) =>
    action?.movementScope === "local" && action.destinationFacilityId === facilityId) ?? null;
}

function leadAction(runtime, movementActions, lead) {
  const atTarget = runtime.playerState.player.facilityId === lead.facilityId;
  const movement = atTarget ? null : movementTo(movementActions, lead.facilityId);
  if (!atTarget && !movement) return null;
  const destinationName = {
    [LOWER_INN_ID]: "王都下層の安宿",
    [MAGE_TOWER_ID]: "宮廷魔術塔",
    [CASTLE_ID]: "王城",
  }[lead.facilityId] ?? lead.facilityId;
  return {
    ...(movement ?? {}),
    id: `T17:LEAD:${lead.id.toUpperCase()}`,
    type: movement ? "move" : "plan",
    family: movement ? "move" : "prepare",
    minutes: movement ? movement.minutes : 8,
    label: atTarget
      ? `${destinationName}で、${lead.label}`
      : `${destinationName}へ向かい、${lead.label}`,
    t17ExclusiveChoice: true,
    t17LeadId: lead.id,
    t17LeadFacilityId: lead.facilityId,
  };
}

function leadSelectionActions(runtime, movementActions, evidenceIds) {
  const remaining = Object.values(LEADS).filter((lead) => !evidenceIds.has(lead.discoveryId));
  const actions = remaining.map((lead) => leadAction(runtime, movementActions, lead)).filter(Boolean);
  if (!evidenceIds.size) return actions.length === 3 ? actions : null;
  if (actions.length !== 2) return null;
  return [...actions, {
    id: "T17:PETITION:ONE_SOURCE",
    family: "resolve",
    type: "plan",
    minutes: 25,
    label: "今ある一系統の証拠だけで王城へ訴え、儀式停止を求める",
    t17ExclusiveChoice: true,
    t17PrematurePetition: true,
  }];
}

export function t17SecondSummoningExclusiveActions(runtime, {
  presentNpcs = [],
  movementActions = [],
} = {}) {
  if (!arcAvailable(runtime)) return null;
  const step = currentStep(runtime);
  if (!step) return null;
  const flow = ensureT17SecondSummoningState(runtime);
  if (step.id === "hear") return openingActions(runtime, presentNpcs);
  if (step.id !== "investigate" || !flow.openingChoiceId || flow.selectedLeadId) return null;
  const evidenceIds = new Set(flow.evidenceIds);
  if (evidenceIds.size >= 2) return null;
  return leadSelectionActions(runtime, movementActions, evidenceIds);
}

export function t17SecondSummoningEvidenceAction(runtime) {
  if (!arcAvailable(runtime)) return null;
  const step = currentStep(runtime);
  if (step?.id !== "investigate") return null;
  const flow = ensureT17SecondSummoningState(runtime);
  const lead = LEADS[flow.selectedLeadId];
  if (!lead || runtime.playerState.player.facilityId !== lead.facilityId) return null;
  const discoveries = missionRuntime(runtime)?.discoveries ?? [];
  if (flow.evidenceIds.includes(lead.discoveryId)
    || discoveries.some((entry) => entry.id === lead.discoveryId)) return null;
  return {
    id: `T17:EVIDENCE:${lead.id.toUpperCase()}`,
    family: "investigate",
    type: "investigate",
    missionId: T17_MISSION_ID,
    stepId: "investigate",
    missionTitle: "王都の第二召喚儀式",
    missionTroubleId: T17_TROUBLE_ID,
    minutes: lead.minutes,
    label: lead.label,
    investigationStage: Math.max(0, Number(missionRuntime(runtime)?.progress?.investigate ?? 0)),
    approachId: lead.approachId,
    discoveryId: lead.discoveryId,
    discoveryText: lead.discoveryText,
    t17EvidenceId: lead.discoveryId,
    t17LeadId: lead.id,
  };
}

export function suppressGenericT17MissionAction(runtime, action) {
  if (!arcAvailable(runtime) || action?.missionId !== T17_MISSION_ID) return false;
  return !String(action.id ?? "").startsWith("T17:");
}

export function applyT17SecondSummoningAction(runtime, action, result) {
  if (!action || result?.ok === false) return false;
  const flow = ensureT17SecondSummoningState(runtime);
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);
  let changed = false;
  if (action.t17OpeningChoiceId) {
    flow.openingChoiceId = action.t17OpeningChoiceId;
    flow.openingChosenAtMinute ??= minute;
    changed = true;
    runtime.playerState.history.push({
      type: "T17_OPENING_APPROACH_SELECTED",
      minute,
      actionId: action.id,
    });
  }
  if (action.t17LeadId && !action.t17EvidenceId) {
    flow.selectedLeadId = action.t17LeadId;
    flow.selectedLeadAtMinute = minute;
    changed = true;
    runtime.playerState.history.push({
      type: "T17_EVIDENCE_ROUTE_SELECTED",
      minute,
      leadId: action.t17LeadId,
      facilityId: action.t17LeadFacilityId ?? runtime.playerState.player.facilityId,
    });
  }
  if (action.t17EvidenceId) {
    if (!flow.evidenceIds.includes(action.t17EvidenceId)) flow.evidenceIds.push(action.t17EvidenceId);
    flow.selectedLeadId = null;
    flow.selectedLeadAtMinute = null;
    changed = true;
    runtime.playerState.history.push({
      type: "T17_EVIDENCE_VERIFIED",
      minute,
      evidenceId: action.t17EvidenceId,
      leadId: action.t17LeadId ?? null,
    });
  }
  if (action.t17PrematurePetition) {
    flow.prematurePetitionCount += 1;
    result.summary = "一系統の証拠だけでは、王城は儀式停止を受け入れなかった。別の場所から独立した裏付けを得る必要がある。";
    changed = true;
    runtime.playerState.history.push({
      type: "T17_PREMATURE_PETITION_REJECTED",
      minute,
      evidenceCount: flow.evidenceIds.length,
    });
  }
  return changed;
}

export function t17SecondSummoningGuidance(runtime) {
  if (!arcAvailable(runtime)) return null;
  const step = currentStep(runtime);
  if (!step) return null;
  const flow = ensureT17SecondSummoningState(runtime);
  if (step.id === "hear") return {
    kicker: "王都で聞いた不穏な話",
    title: "下層の安宿で、第二召喚を止めようとする人物と話す",
    detail: "相手の主張を鵜呑みにせず、時刻・自分との関係・検証可能な証拠のどれから確かめるか選べる。",
    targetFacilityId: LOWER_INN_ID,
    actionPanel: runtime.playerState.player.facilityId === LOWER_INN_ID ? null : "movement",
  };
  if (step.id === "investigate") {
    const lead = LEADS[flow.selectedLeadId];
    if (lead) return {
      kicker: "選んだ確認経路",
      title: lead.label,
      detail: "噂ではなく、後から照合できる記録として一つずつ確かめる。",
      targetFacilityId: lead.facilityId,
      actionPanel: runtime.playerState.player.facilityId === lead.facilityId ? null : "movement",
    };
    if (flow.evidenceIds.length === 0) return {
      kicker: "第二召喚の裏付け",
      title: "三つの確認先から、最初の証拠を選ぶ",
      detail: "元研究員の写し、魔術塔の納入記録、王城の許可状は、それぞれ別の立場から儀式を裏づける。",
      targetFacilityId: null,
      actionPanel: null,
    };
    return {
      kicker: "一つ目の証拠を確認済み",
      title: "別系統の記録で、第二召喚をもう一度裏づける",
      detail: "一か所の記録だけでは改ざんや誤解を否定できない。残る二経路か、証拠不足のまま訴えるかを選ぶ。",
      targetFacilityId: null,
      actionPanel: null,
    };
  }
  return {
    kicker: "第二召喚の証拠",
    title: "独立した二系統の裏付けが揃った",
    detail: "次は、儀式を止めるため誰へ何を突きつけるかを慎重に決める段階に入る。",
    targetFacilityId: null,
    actionPanel: null,
  };
}

export const T17_SECOND_SUMMONING_SCENES = Object.freeze([
  Object.freeze({
    sceneId: "t17.opening.when_where",
    priority: 980,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: "T17:OPENING:WHEN_WHERE" }),
      Object.freeze({ path: "mission.id", op: "eq", value: T17_MISSION_ID }),
      Object.freeze({ path: "location.facilityId", op: "eq", value: LOWER_INN_ID }),
    ]) }),
    narrative: "安宿の食堂の隅で、外套を深く被った女性は周囲の卓を一度見渡し、声を落とした。曖昧な警告ではなく、止めるべき時刻と場所から話すつもりらしい。",
    beats: Object.freeze([
      Object.freeze({ kind: "npc", actorId: T17_LAYLA_NPC_ID, text: "私はライラ。第二召喚の本式はDay41、宮廷魔術塔で行われる。今は資材と術者を集めている段階よ。止めるなら、儀式の日では遅い。", emotion: "慎重" }),
    ]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "t17.opening.why_player",
    priority: 979,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: "T17:OPENING:WHY_ME" }),
      Object.freeze({ path: "mission.id", op: "eq", value: T17_MISSION_ID }),
      Object.freeze({ path: "location.facilityId", op: "eq", value: LOWER_INN_ID }),
    ]) }),
    narrative: "女性はすぐに答えず、こちらの服装と手元を確かめる。確信ではなく、危険な仮説を口にする前のためらいだった。",
    beats: Object.freeze([
      Object.freeze({ kind: "npc", actorId: T17_LAYLA_NPC_ID, text: "私はライラ。Day1の召喚対象は消滅せず、王都の外へ逸れて生存した可能性がある。足跡も荷もなく田園の村へ現れたあなたは、その仮説と重なる。でも、あなたを利用したくはない。だから証拠を一緒に確かめたい。", emotion: "警戒と誠実さ" }),
    ]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "t17.opening.demand_proof",
    priority: 978,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: "T17:OPENING:PROOF" }),
      Object.freeze({ path: "mission.id", op: "eq", value: T17_MISSION_ID }),
      Object.freeze({ path: "location.facilityId", op: "eq", value: LOWER_INN_ID }),
    ]) }),
    narrative: "女性は反発せず、小さくうなずいた。阻止派という立場だけで信用を求めるつもりはないらしい。卓上へ王都の簡単な見取り図を広げ、三か所へ印を置く。",
    beats: Object.freeze([
      Object.freeze({ kind: "npc", actorId: T17_LAYLA_NPC_ID, text: "私はライラ。その判断でいい。確認先は三つ。元研究員の写し、魔術塔の納入記録、王城の許可状。互いに別の場所へ残った記録だから、二つ以上が一致すれば私たちの作り話ではないと分かる。", emotion: "安堵" }),
    ]),
    choices: Object.freeze([]),
  }),
  ...Object.values(LEADS).map((lead) => Object.freeze({
    sceneId: `t17.lead.${lead.id}`,
    priority: 970,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: `T17:LEAD:${lead.id.toUpperCase()}` }),
    ]) }),
    narrative: {
      luca_documents: "安宿の裏階段から物置へ入り、ルカが指定した梁の隙間を確かめる。薄い油紙に包まれた写しは、持ち運べる量へ絞られていた。",
      mage_deliveries: "宮廷魔術塔の正面ではなく、荷車が出入りする搬入口へ回る。術者の名簿は見えなくても、納入札と箱の封印なら外から照合できる。",
      castle_requisition: "王城の奥へ踏み込まず、商人や使者も利用する受付区画へ向かう。公開台帳と掲示された支出許可の範囲だけでも、魔術塔へ流れた資材を追える。",
    }[lead.id],
    beats: Object.freeze([]),
    choices: Object.freeze([]),
  })),
  ...Object.values(LEADS).map((lead) => Object.freeze({
    sceneId: `t17.evidence.${lead.id}`,
    priority: 965,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: `T17:EVIDENCE:${lead.id.toUpperCase()}` }),
      Object.freeze({ path: "outcome.discovery.id", op: "eq", value: lead.discoveryId }),
    ]) }),
    narrative: lead.discoveryText,
    beats: Object.freeze([]),
    choices: Object.freeze([]),
  })),
  Object.freeze({
    sceneId: "t17.petition.one_source_rejected",
    priority: 960,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: "T17:PETITION:ONE_SOURCE" }),
    ]) }),
    narrative: "一つの記録を示して儀式停止を求めたが、王城の受付は『写しや一部署の帳面だけでは、勅許を覆せない』と退けた。証拠は無駄になっていない。ただし、別の立場から同じ計画を裏づけなければ、上層部は動かない。",
    beats: Object.freeze([]),
    choices: Object.freeze([]),
  }),
]);
