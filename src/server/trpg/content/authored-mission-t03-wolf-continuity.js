import * as base from "./authored-mission-t02-granary-continuity.js";
import {
  compactAuthoredMissionId,
} from "./authored-mission-flow-id-contract.js";
import {
  closePlayerMissionWithoutResolvingTrouble,
} from "./authored-mission-terminal-contract.js";

export * from "./authored-mission-t02-granary-continuity.js";

export const AUTHORED_MISSION_T03_WOLF_VERSION = "authored-mission-t03-wolf-v1";

const MISSION_ID = "MSN-T03";
const TROUBLE_ID = "T03";
const STATE_VERSION = "t03-wolf-continuity-v1";

const OPENINGS = Object.freeze({
  loss_ledger: Object.freeze({
    label: "被害台帳を村長と読み直す",
    summary: "家畜被害の順番を並べ、赤牙狼の群れが南の牧草地から押し上げられている可能性を確かめる。",
    consequence: "襲撃順は無秩序ではなく、南から北へ移っていた。村長は討伐数だけでなく、群れを追い立てた原因も調べることを認めた。",
    flags: ["t03LossSequenceMapped"],
  }),
  stable_bells: Object.freeze({
    label: "馬小屋に残った鈴の音を確かめる",
    summary: "柵に絡んだ鈴と泥を調べ、家畜が狼より先に何かへ怯えていた形跡を追う。",
    consequence: "鈴は狼が柵を越える前に切れていた。家畜は森側ではなく南の斜面を避けており、別の大型魔獣の圧力が疑われる。",
    flags: ["t03StableBellTimingKnown"],
  }),
  finn_map: Object.freeze({
    label: "フィンの救出地図に襲撃地点を重ねる",
    summary: "以前の捜索路と今回の足跡を比べ、子どもが見た森の変化を狼被害へ結びつける。",
    consequence: "救出時の地図には、今の被害地点を避ける古い獣道が残っていた。狼は本来の巣を離れ、仮の通り道を使っている。",
    flags: ["t03FinnMapCompared"],
  }),
});

const EVIDENCE_ORDER = Object.freeze([
  "pack_displacement",
  "apex_pressure",
  "temporary_den",
]);

const SIDE_ORDER = Object.freeze([
  "evacuate_livestock",
  "burn_brush_line",
  "send_early_hunt",
]);

const TERMINAL_ORDER = Object.freeze([
  "indiscriminate_cull",
  "abandon_outer_farms",
  "delegate_to_lord",
]);

const SIDE_TO_CHANGED_EVIDENCE = Object.freeze({
  evacuate_livestock: "pack_displacement",
  burn_brush_line: "temporary_den",
  send_early_hunt: "apex_pressure",
});

function playerState(runtime) {
  return runtime?.playerState ?? runtime;
}

function missionRuntime(runtime) {
  return playerState(runtime)?.missions?.[MISSION_ID] ?? null;
}

function missionDefinition(runtime) {
  const byId = playerState(runtime)?.catalog?.byId;
  return typeof byId?.get === "function" ? byId.get(MISSION_ID) : byId?.[MISSION_ID] ?? null;
}

function currentStep(runtime) {
  const mission = missionRuntime(runtime);
  return missionDefinition(runtime)?.steps?.find((step) =>
    Number(mission?.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function ensureState(runtime) {
  const holder = runtime?.playerState ? runtime : playerState(runtime);
  const current = holder.t03WolfContinuity;
  if (current?.version === STATE_VERSION) return current;
  return holder.t03WolfContinuity = {
    version: STATE_VERSION,
    openingChoiceId: current?.openingChoiceId ?? null,
    evidenceClasses: [...new Set(current?.evidenceClasses ?? [])],
    sideChoices: [...new Set(current?.sideChoices ?? [])],
    terminalChoiceId: current?.terminalChoiceId ?? null,
    selectedActionIds: [...new Set(current?.selectedActionIds ?? [])],
    sceneRevision: Number(current?.sceneRevision ?? 0),
    lastChangedAtMinute: current?.lastChangedAtMinute ?? null,
  };
}

function activeAtCurrentTarget(runtime, kind) {
  const state = playerState(runtime);
  const mission = missionRuntime(runtime);
  const step = currentStep(runtime);
  if (!state || !mission || mission.status !== "active" || !step) return false;
  if (kind === "hear" && !(step.id === "hear" || step.type === "conversation")) return false;
  if (kind === "investigate" && !(step.id === "investigate" || step.type === "investigate")) return false;
  return state.player?.facilityId === step.targetFacilityId;
}

function choiceId(...parts) {
  return compactAuthoredMissionId(["T03_WOLF", ...parts]);
}

function openingActions(runtime) {
  const mission = missionRuntime(runtime);
  const step = currentStep(runtime);
  return Object.entries(OPENINGS).map(([key, scene]) => ({
    id: choiceId("OPENING", key),
    type: "conversation",
    label: scene.label,
    summary: scene.summary,
    missionId: MISSION_ID,
    stepId: step?.id ?? "hear",
    durationMinutes: 25,
    targetLocation: playerState(runtime)?.player?.location,
    targetFacilityId: playerState(runtime)?.player?.facilityId,
    authoredMissionFlowExclusiveChoice: true,
    authoredT03WolfChoice: true,
    t03OpeningChoice: key,
    t03Consequence: scene.consequence,
    t03WorldFlags: scene.flags,
    missionTitle: missionDefinition(runtime)?.title ?? "赤牙狼の異常移動",
  }));
}

function evidenceScene(evidenceClass, changed) {
  const normal = {
    pack_displacement: {
      code: "HOOF_TRACKS",
      label: "蹄跡に重なる群れの退避跡を測る",
      summary: "馬小屋裏の足跡を分け、赤牙狼が家畜を狙って集まったのではなく、南斜面から押し出された順序を立証する。",
      consequence: "狼の足跡は獲物へ一直線ではなく、南斜面から逃げるように折れていた。群れの移動は捕食だけでは説明できない。",
      flags: ["t03PackDisplacementProven"],
    },
    apex_pressure: {
      code: "DEEP_CLAW_CAST",
      label: "狼より深い爪痕の石膏型を取る",
      summary: "梁と石壁に残った大型爪痕を保存し、群れを追い立てた上位魔獣の存在を立証する。",
      consequence: "爪痕の幅は赤牙狼の倍近く、古い傷の上に新しい傷が重なっていた。森奥から大型魔獣が縄張りを広げている。",
      flags: ["t03ApexPressureProven"],
    },
    temporary_den: {
      code: "STRAW_FIBER_ROUTE",
      label: "巣材に混じる馬小屋の藁を追う",
      summary: "毛と藁の運ばれた方向を追跡し、群れが村近くへ仮巣を移した経路を立証する。",
      consequence: "藁は食い荒らされたのではなく、何度も同じ方向へ運ばれていた。群れは本来の巣を失い、村外れに仮巣を作っている。",
      flags: ["t03TemporaryDenProven"],
    },
  };
  const altered = {
    pack_displacement: {
      code: "WOUND_MEASURE",
      label: "避難先の負傷した牝馬を診る",
      summary: "家畜移送で踏み荒らされた足跡の代わりに、牝馬の傷向きと逃走方向から群れの退避線を復元する。",
      consequence: "傷は後方からではなく横腹に集中し、牝馬も狼も同じ南斜面を避けていた。踏み消された地面の代わりに、生体の傷が群れの退避を証明した。",
      flags: ["t03PackDisplacementProven", "t03StableTracksTrampled"],
    },
    apex_pressure: {
      code: "BROKEN_SPEAR_HEAD",
      label: "先行狩猟隊の折れた穂先を調べる",
      summary: "狩猟隊が狼を散らした後に残した折損痕から、彼らが遭遇したさらに大型の魔獣を立証する。",
      consequence: "穂先は狼の骨では折れない高さで潰れていた。先行狩猟で狼の痕跡は薄れたが、上位魔獣の存在は武器の損傷に残った。",
      flags: ["t03ApexPressureProven", "t03WolfPackScattered"],
    },
    temporary_den: {
      code: "ASH_BURIED_BONE",
      label: "焼け跡から埋められた幼獣骨を拾う",
      summary: "火線で巣材が焼けた代わりに、浅く埋められた骨と毛から仮巣の使用時期と移設路を復元する。",
      consequence: "焼け跡の下から、最近埋められた幼獣骨と村の藁が出た。巣は焼失したが、群れがここを仮巣にした事実は消えなかった。",
      flags: ["t03TemporaryDenProven", "t03BrushLineBurned"],
    },
  };
  return (changed ? altered : normal)[evidenceClass];
}

function evidenceAction(runtime, evidenceClass) {
  const state = ensureState(runtime);
  const changed = state.sideChoices.some((side) => SIDE_TO_CHANGED_EVIDENCE[side] === evidenceClass);
  const scene = evidenceScene(evidenceClass, changed);
  const step = currentStep(runtime);
  return {
    id: choiceId("EVIDENCE", evidenceClass, scene.code),
    type: "investigate",
    label: scene.label,
    summary: scene.summary,
    missionId: MISSION_ID,
    stepId: step?.id ?? "investigate",
    durationMinutes: changed ? 55 : 45,
    targetLocation: playerState(runtime)?.player?.location,
    targetFacilityId: playerState(runtime)?.player?.facilityId,
    authoredMissionFlowExclusiveChoice: true,
    authoredT03WolfChoice: true,
    t03EvidenceClass: evidenceClass,
    t03Consequence: scene.consequence,
    t03WorldFlags: scene.flags,
  };
}

function sideScene(sideChoice) {
  return {
    evacuate_livestock: {
      code: "EVACUATE_LIVESTOCK",
      label: "証拠が消える前に家畜を退避させる",
      summary: "足跡を踏み荒らす代わりに、今夜の家畜被害を減らす。群れの移動は負傷した牝馬から復元することになる。",
      consequence: "家畜は広場へ移されたが、馬小屋裏の足跡は荷車と蹄で崩れた。次は負傷した牝馬の傷から退避線を読み直す必要がある。",
      flags: ["t03LivestockEvacuated", "t03StableTracksTrampled"],
    },
    burn_brush_line: {
      code: "BURN_BRUSH_LINE",
      label: "仮巣へ続く茂みに防火線を焼く",
      summary: "巣材の一部を失う代わりに、夜襲経路を一つ閉じる。仮巣の証拠は灰の下から探すことになる。",
      consequence: "村人は茂みを焼き、夜襲路を狭めた。藁と毛の道筋は消えたが、焼け跡の下に埋設物が残っている。",
      flags: ["t03BrushLineBurned", "t03DenTrailBurned"],
    },
    send_early_hunt: {
      code: "SEND_EARLY_HUNT",
      label: "被害拡大前に狩猟隊を先行させる",
      summary: "群れを散らして村を守る代わりに、上位魔獣の痕跡を乱す。圧力の証拠は折れた装備から拾うことになる。",
      consequence: "狩猟隊は狼を森へ散らしたが、血と爪痕の多くを踏み荒らした。代わりに、狼では壊せない折れ方をした槍が戻った。",
      flags: ["t03EarlyHuntSent", "t03WolfPackScattered"],
    },
  }[sideChoice];
}

function sideAction(runtime, sideChoice) {
  const scene = sideScene(sideChoice);
  return {
    id: choiceId("SIDE", scene.code),
    type: "investigate",
    label: scene.label,
    summary: scene.summary,
    missionId: MISSION_ID,
    stepId: currentStep(runtime)?.id ?? "investigate",
    durationMinutes: 60,
    targetLocation: playerState(runtime)?.player?.location,
    targetFacilityId: playerState(runtime)?.player?.facilityId,
    authoredMissionFlowExclusiveChoice: true,
    authoredT03WolfChoice: true,
    t03SideChoice: sideChoice,
    t03Consequence: scene.consequence,
    t03WorldFlags: scene.flags,
  };
}

function terminalScene(terminalChoice) {
  return {
    indiscriminate_cull: {
      code: "INDISCRIMINATE_CULL",
      label: "原因を問わず群れを一掃する",
      summary: "今夜の被害は止めるが、大型魔獣と空いた縄張りを放置し、森の均衡回復を諦める。",
      consequence: "村は一時的に静まった。だが狼が消えた縄張りへ何が入るかは分からず、異常移動の原因も記録されないままになった。",
      flags: ["t03IndiscriminateCull", "t03PlayerMissionClosed"],
    },
    abandon_outer_farms: {
      code: "ABANDON_OUTER_FARMS",
      label: "外縁農家を捨てて内柵だけ守る",
      summary: "中心部の人数を守る代わりに、外縁の家畜と畑を不可逆に失う。",
      consequence: "村人は内柵へ退いた。外縁の家と家畜は見捨てられ、赤牙狼の群れはさらに村近くへ定着した。",
      flags: ["t03OuterFarmsAbandoned", "t03PlayerMissionClosed"],
    },
    delegate_to_lord: {
      code: "DELEGATE_TO_LORD",
      label: "調査を領主の討伐隊へ委ねる",
      summary: "自分の依頼を閉じ、数日後の大規模討伐へ任せる。救済の主導権と報酬請求権は失う。",
      consequence: "領主の印を押した要請書が送られた。討伐隊が来るまで被害は続き、以後この件を自分の解決として扱うことはできない。",
      flags: ["t03DelegatedToLord", "t03PlayerMissionClosed"],
    },
  }[terminalChoice];
}

function terminalAction(runtime, terminalChoice) {
  const scene = terminalScene(terminalChoice);
  return {
    id: choiceId("TERMINAL", scene.code),
    type: "investigate",
    label: scene.label,
    summary: scene.summary,
    missionId: MISSION_ID,
    durationMinutes: terminalChoice === "delegate_to_lord" ? 35 : 90,
    targetLocation: playerState(runtime)?.player?.location,
    targetFacilityId: playerState(runtime)?.player?.facilityId,
    authoredMissionFlowExclusiveChoice: true,
    authoredT03WolfChoice: true,
    t03TerminalChoice: terminalChoice,
    t03Consequence: scene.consequence,
    t03WorldFlags: scene.flags,
  };
}

function orderedEvidence(runtime) {
  const state = ensureState(runtime);
  const remaining = EVIDENCE_ORDER.filter((evidenceClass) => !state.evidenceClasses.includes(evidenceClass));
  const changed = SIDE_ORDER
    .map((sideChoice) => SIDE_TO_CHANGED_EVIDENCE[sideChoice])
    .filter((evidenceClass) => remaining.includes(evidenceClass));
  return [...new Set([...changed, ...remaining])];
}

function investigationActions(runtime) {
  const state = ensureState(runtime);
  const evidence = orderedEvidence(runtime);
  if (evidence.length === 0 || state.sideChoices.length >= SIDE_ORDER.length) {
    return TERMINAL_ORDER.map((terminalChoice) => terminalAction(runtime, terminalChoice));
  }
  const visible = evidence.slice(0, 2).map((evidenceClass) => evidenceAction(runtime, evidenceClass));
  const side = SIDE_ORDER.find((sideChoice) => !state.sideChoices.includes(sideChoice));
  if (side) visible.push(sideAction(runtime, side));
  while (visible.length < 3) {
    const nextEvidence = evidence.find((evidenceClass) =>
      !visible.some((action) => action.t03EvidenceClass === evidenceClass));
    if (!nextEvidence) break;
    visible.push(evidenceAction(runtime, nextEvidence));
  }
  return visible.slice(0, 3);
}

function closeMission(runtime, action) {
  const mission = missionRuntime(runtime);
  if (!mission || mission.status === "completed") return false;
  const minute = Number(playerState(runtime)?.absoluteMinute ?? 0);
  closePlayerMissionWithoutResolvingTrouble(runtime, {
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    reason: `player_closed_t03_${action.t03TerminalChoice}`,
    kind: action.t03TerminalChoice,
    historyType: "T03_PLAYER_MISSION_CLOSED",
  });
  mission.failureReason = `player_closed_t03_${action.t03TerminalChoice}`;
  mission.closedByPlayerAt ??= minute;
  mission.closedByPlayerKind ??= action.t03TerminalChoice;
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags.t03PlayerMissionClosed = true;
  return true;
}

function recordChoice(runtime, action) {
  const state = ensureState(runtime);
  if (state.selectedActionIds.includes(action.id)) return false;
  state.selectedActionIds.push(action.id);
  state.sceneRevision += 1;
  state.lastChangedAtMinute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  if (action.t03OpeningChoice) state.openingChoiceId ??= action.t03OpeningChoice;
  if (action.t03EvidenceClass && !state.evidenceClasses.includes(action.t03EvidenceClass)) {
    state.evidenceClasses.push(action.t03EvidenceClass);
  }
  if (action.t03SideChoice && !state.sideChoices.includes(action.t03SideChoice)) {
    state.sideChoices.push(action.t03SideChoice);
  }
  if (action.t03TerminalChoice) state.terminalChoiceId = action.t03TerminalChoice;
  runtime.playerState.worldFlags ??= {};
  for (const flag of action.t03WorldFlags ?? []) runtime.playerState.worldFlags[flag] = true;
  if (action.t03OpeningChoice) runtime.playerState.worldFlags[`t03Opening:${action.t03OpeningChoice}`] = true;
  if (action.t03EvidenceClass) runtime.playerState.worldFlags[`t03Evidence:${action.t03EvidenceClass}`] = true;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "T03_WOLF_SCENE_RESOLVED",
    minute: state.lastChangedAtMinute,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    actionId: action.id,
    openingChoice: action.t03OpeningChoice ?? null,
    evidenceClass: action.t03EvidenceClass ?? null,
    sideChoice: action.t03SideChoice ?? null,
    terminalChoice: action.t03TerminalChoice ?? null,
    sceneRevision: state.sceneRevision,
  });
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  if (activeAtCurrentTarget(runtime, "hear")) return openingActions(runtime);
  if (activeAtCurrentTarget(runtime, "investigate")) return investigationActions(runtime);
  return base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok === false || action?.authoredT03WolfChoice !== true) return changed;
  const recorded = recordChoice(runtime, action);
  if (action.t03TerminalChoice) closeMission(runtime, action);
  if (action.t03Consequence) result.summary = action.t03Consequence;
  return recorded || changed;
}

export const AUTHORED_MISSION_T03_WOLF_INTERNALS = Object.freeze({
  MISSION_ID,
  TROUBLE_ID,
  OPENINGS,
  EVIDENCE_ORDER,
  SIDE_ORDER,
  TERMINAL_ORDER,
  SIDE_TO_CHANGED_EVIDENCE,
  missionRuntime,
  missionDefinition,
  currentStep,
  ensureState,
  activeAtCurrentTarget,
  openingActions,
  evidenceAction,
  sideAction,
  terminalAction,
  orderedEvidence,
  investigationActions,
  closeMission,
  recordChoice,
});
