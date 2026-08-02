import * as base from "./authored-mission-t02-granary-choice-order.js";

export * from "./authored-mission-t02-granary-choice-order.js";

export const AUTHORED_MISSION_T03_WOLF_VERSION = "authored-mission-t03-wolf-v1";

const MISSION_ID = "MSN-T03";
const TROUBLE_ID = "T03";
const STATE_VERSION = "t03-wolf-continuity-v1";

const OPENINGS = Object.freeze([
  {
    id: "loss_ledger",
    label: "ガロの家畜被害台帳を開き、襲撃日時と月齢を一列に並べる",
    minutes: 28,
    consequence: "被害は満月や繁殖期ではなく、森の奥で大きな鳴き声がした翌朝に集中していた。赤牙狼が自発的に人里を狙ったとは考えにくい。",
  },
  {
    id: "stable_bells",
    label: "ハクトが書き残した夜ごとの鈴の鳴り方から、群れの通過順を読む",
    minutes: 32,
    consequence: "最初に鳴るのは森側の鈴ではなく、逃げ道に近い南柵の鈴だった。群れは獲物へ忍び寄るより、何かから押し出されて走っている。",
  },
  {
    id: "finn_edge_map",
    label: "フィン救出時の森外縁地図へ、新しい家畜被害の位置を重ねる",
    minutes: 36,
    consequence: "以前は赤牙狼が避けていた沢沿いまで足跡が南下している。縄張りの中心が動いたのではなく、奥から安全地帯を失っている配置だ。",
  },
]);

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
  "abandon_outer_pasture",
  "request_late_royal_hunt",
]);

const SIDE_TO_CHANGED_EVIDENCE = Object.freeze({
  evacuate_livestock: "pack_displacement",
  burn_brush_line: "apex_pressure",
  send_early_hunt: "temporary_den",
});

function missionRuntime(runtime) {
  return runtime?.playerState?.missions?.[MISSION_ID] ?? null;
}

function missionDefinition(runtime) {
  const byId = runtime?.playerState?.catalog?.byId;
  return typeof byId?.get === "function" ? byId.get(MISSION_ID) : byId?.[MISSION_ID] ?? null;
}

function currentStep(runtime) {
  const mission = missionRuntime(runtime);
  const definition = missionDefinition(runtime);
  if (!mission || !definition) return null;
  return (definition.steps ?? []).find((step) =>
    Number(mission.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function ensureState(runtime) {
  const state = runtime.t03WolfContinuity ??= {
    version: STATE_VERSION,
    openingChoiceId: null,
    evidenceClasses: [],
    sideChoices: [],
    terminalChoiceId: null,
    selectedActionIds: [],
    sceneRevision: 0,
    startedAtMinute: Number(runtime?.playerState?.absoluteMinute ?? 0),
    lastChangedAtMinute: null,
  };
  state.version = STATE_VERSION;
  state.evidenceClasses = [...new Set(state.evidenceClasses ?? [])];
  state.sideChoices = [...new Set(state.sideChoices ?? [])];
  state.selectedActionIds = [...new Set(state.selectedActionIds ?? [])];
  state.sceneRevision = Math.max(0, Number(state.sceneRevision ?? 0));
  return state;
}

function activeAtCurrentTarget(runtime, kind) {
  const mission = missionRuntime(runtime);
  const step = currentStep(runtime);
  if (!mission || mission.status !== "active" || !step) return false;
  const matchesKind = kind === "hear"
    ? (step.id === "hear" || step.type === "conversation")
    : (step.id === "investigate" || step.type === "investigate");
  return matchesKind
    && runtime?.playerState?.player?.facilityId === step.targetFacilityId;
}

function withChoiceIds(actions) {
  return actions.slice(0, 3).map((action, index) => ({
    ...action,
    choiceId: `CHOICE-${index + 1}`,
  }));
}

function baseAction(id, label, minutes, extra = {}) {
  return {
    id: `T03_WOLF:${id}`,
    authoredT03WolfChoice: true,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    minutes,
    label,
    ...extra,
  };
}

function openingActions(runtime) {
  const step = currentStep(runtime);
  return withChoiceIds(OPENINGS.map((opening) => baseAction(
    `OPEN:${opening.id}`,
    opening.label,
    opening.minutes,
    {
      type: "conversation",
      stepId: step?.id ?? "hear",
      t03OpeningChoice: opening.id,
      t03Consequence: opening.consequence,
    },
  )));
}

function evidenceAction(runtime, evidenceClass) {
  const state = ensureState(runtime);
  const step = currentStep(runtime);
  const livestockMoved = state.sideChoices.includes("evacuate_livestock");
  const brushBurned = state.sideChoices.includes("burn_brush_line");
  const huntSent = state.sideChoices.includes("send_early_hunt");

  if (evidenceClass === "pack_displacement") {
    return livestockMoved
      ? baseAction(
        "EVIDENCE:PACK:WOUND_MEASURE",
        "移送で消えた蹄跡を諦め、負傷した牝馬の噛み傷と泥の高さを測る",
        48,
        {
          type: "investigate",
          stepId: step?.id ?? "investigate",
          t03EvidenceClass: evidenceClass,
          discoveryId: "T03-EV-PACK-WOUND-MEASURE",
          discoveryText: "傷は仕留める噛み方ではなく、走路から退かせる浅い噛み傷だった。泥の高さからも親個体と幼獣が混じり、群れ全体が追われて南へ逃げている。",
          t03Consequence: "家畜を先に逃がしたため足跡は失ったが、傷の向きと高さから、赤牙狼が狩りではなく退避中だと立証した。",
          suppressRandomEncounter: true,
        },
      )
      : baseAction(
        "EVIDENCE:PACK:HOOF_TRACKS",
        "馬房裏の蹄跡と狼の足跡を層ごとに写し、群れの進入順を復元する",
        38,
        {
          type: "investigate",
          stepId: step?.id ?? "investigate",
          t03EvidenceClass: evidenceClass,
          discoveryId: "T03-EV-PACK-HOOF-TRACKS",
          discoveryText: "幼獣の小さな足跡が親個体より先に南柵へ走り、親は家畜を襲うより後方を守っていた。群れは人里を縄張りにしに来たのではなく、奥から押し出されている。",
          t03Consequence: "踏み荒らされる前の足跡から、親個体が幼獣を守りながら退避している順序を復元した。",
          suppressRandomEncounter: true,
        },
      );
  }

  if (evidenceClass === "apex_pressure") {
    return brushBurned
      ? baseAction(
        "EVIDENCE:APEX:CHAR_HEIGHT",
        "煙で消えた獣臭の代わりに、焼け残った樹皮の裂け目と黒い樹脂を採る",
        56,
        {
          type: "investigate",
          stepId: step?.id ?? "investigate",
          t03EvidenceClass: evidenceClass,
          discoveryId: "T03-EV-APEX-CHAR-HEIGHT",
          discoveryText: "人の肩より高い位置で樹皮が内側から裂け、赤牙狼には付かない黒い樹脂と硬い毛が残っていた。森奥の大型魔獣が境界を南へ押している。",
          t03Consequence: "火と煙で臭跡は失われたが、焼け残った傷の高さと樹脂から、赤牙狼よりはるかに大きい魔獣の圧力を突き止めた。",
          suppressRandomEncounter: true,
        },
      )
      : baseAction(
        "EVIDENCE:APEX:SNAPPED_TREES",
        "森側の柵に絡んだ黒い毛を採り、外縁で折れた若木の高さを比べる",
        44,
        {
          type: "investigate",
          stepId: step?.id ?? "investigate",
          t03EvidenceClass: evidenceClass,
          discoveryId: "T03-EV-APEX-SNAPPED-TREES",
          discoveryText: "赤牙狼の背丈を超える高さで若木が連続して折れ、柵には別種の黒い剛毛と樹脂臭が残る。大型魔獣が森奥から縄張りを広げている。",
          t03Consequence: "狼の痕跡と別種の剛毛・折木を分離し、群れを南下させた大型魔獣の存在を確認した。",
          suppressRandomEncounter: true,
        },
      );
  }

  return huntSent
    ? baseAction(
      "EVIDENCE:DEN:DROPPED_WHISTLE",
      "散った狩人を追わず、落ちた呼子笛と血の付いた曳き縄から群れの分岐を読む",
      62,
      {
        type: "investigate",
        stepId: step?.id ?? "investigate",
        t03EvidenceClass: evidenceClass,
        discoveryId: "T03-EV-DEN-DROPPED-WHISTLE",
        discoveryText: "群れは狩人を追い詰めず、古い炭焼き窯を避けて二手に散っていた。幼獣を隠した仮巣と、傷つけず森へ戻せる迂回路が分かる。",
        t03Consequence: "先走った狩人が群れを散らしたが、落とし物と血痕の分岐から仮巣と移送路を再構成した。",
        suppressRandomEncounter: true,
      },
    )
    : baseAction(
      "EVIDENCE:DEN:HOWL_RESPONSE",
      "夜明け前の遠吠えへ間を変えて応え、返答位置を三点から記録する",
      52,
      {
        type: "investigate",
        stepId: step?.id ?? "investigate",
        t03EvidenceClass: evidenceClass,
        discoveryId: "T03-EV-DEN-HOWL-RESPONSE",
        discoveryText: "幼獣の返答は古い炭焼き窯から聞こえ、親個体は南の家畜道と巣の間を往復していた。群れを皆殺しにせず、巣ごと北の空き縄張りへ移せる。",
        t03Consequence: "遠吠えの返答位置から仮巣と親個体の巡回路を割り出し、巣の移設という救済経路を確保した。",
        suppressRandomEncounter: true,
      },
    );
}

function sideAction(id) {
  if (id === "evacuate_livestock") {
    return baseAction(
      "SIDE:EVACUATE_LIVESTOCK",
      "ハクトの家畜を共同穀倉の石囲いへ移し、今夜の被害を先に止める",
      34,
      {
        type: "plan",
        stepId: "investigate",
        t03SideChoice: id,
        t03WorldFlags: ["t03LivestockEvacuated", "t03StableTracksTrampled"],
        t03Consequence: "家畜は守られたが、移送の蹄で馬小屋裏の足跡が潰れた。以後は負傷した家畜の傷から群れの行動を復元する。",
      },
    );
  }
  if (id === "burn_brush_line") {
    return baseAction(
      "SIDE:BURN_BRUSH",
      "森外縁の藪へ狭い火線を引き、赤牙狼を家畜道から遠ざける",
      42,
      {
        type: "plan",
        stepId: "investigate",
        t03SideChoice: id,
        t03WorldFlags: ["t03BrushLineBurned", "t03ApexScentLost"],
        t03Consequence: "今夜の接近は止まったが、煙で森奥から続く獣臭が消え、群れは南の街道側へ押された。大型魔獣は樹皮の傷と残留物から追うことになる。",
      },
    );
  }
  return baseAction(
    "SIDE:SEND_EARLY_HUNT",
    "ハクトの騎手二人を先行させ、群れが次に現れる谷を塞がせる",
    40,
    {
      type: "plan",
      stepId: "investigate",
      t03SideChoice: id,
      t03WorldFlags: ["t03EarlyHuntSent", "t03PackScattered", "t03HunterHorseInjured"],
      t03Consequence: "再襲撃は遅れたが、群れは散り、騎手の馬が一頭負傷した。仮巣の位置は狩人の落とし物と血痕から追い直す。",
    },
  );
}

function terminalAction(id) {
  if (id === "indiscriminate_cull") {
    return baseAction(
      "END:INDISCRIMINATE_CULL",
      "原因調査を打ち切り、見つけた赤牙狼を幼獣も含めて駆除する",
      75,
      {
        type: "plan",
        t03TerminalChoice: id,
        t03WorldFlags: ["t03IndiscriminateCull"],
        t03Consequence: "家畜被害は一時止まったが、森奥の大型魔獣は残り、空いた縄張りへ別の魔物が流れ込む。群れを救う経路は永久に閉じた。",
      },
    );
  }
  if (id === "abandon_outer_pasture") {
    return baseAction(
      "END:ABANDON_PASTURE",
      "村外れの牧草地を捨て、家畜を半数まで減らして内柵だけを守る",
      48,
      {
        type: "plan",
        t03TerminalChoice: id,
        t03WorldFlags: ["t03OuterPastureAbandoned"],
        t03Consequence: "人命は守られたが、乳・肉・農耕馬が減り、T02後の食料回復は大きく遅れた。狼群と森奥の原因は放置された。",
      },
    );
  }
  return baseAction(
    "END:LATE_ROYAL_HUNT",
    "王都の討伐隊へ全権を渡し、到着まで村人を外へ出さない",
    30,
    {
      type: "plan",
      t03TerminalChoice: id,
      t03WorldFlags: ["t03LateRoyalHuntRequested"],
      t03Consequence: "討伐隊が来る頃には群れは街道へ移り、家畜被害と旅人襲撃が広がった。大型魔獣の調査より狼の討伐実績が優先された。",
    },
  );
}

function orderedEvidence(state) {
  const missing = EVIDENCE_ORDER.filter((id) => !state.evidenceClasses.includes(id));
  if (!missing.length) return [];
  const recentSide = [...state.sideChoices].reverse().find((id) => {
    const changed = SIDE_TO_CHANGED_EVIDENCE[id];
    return changed && missing.includes(changed);
  });
  const priority = SIDE_TO_CHANGED_EVIDENCE[recentSide] ?? null;
  const rest = priority ? missing.filter((id) => id !== priority) : missing;
  const offset = rest.length ? state.sceneRevision % rest.length : 0;
  const rotated = rest.length ? [...rest.slice(offset), ...rest.slice(0, offset)] : [];
  return priority ? [priority, ...rotated] : rotated;
}

function investigationActions(runtime) {
  const state = ensureState(runtime);
  const evidence = orderedEvidence(state);
  const actions = evidence.slice(0, Math.min(2, evidence.length)).map((id) => evidenceAction(runtime, id));
  for (const id of SIDE_ORDER) {
    if (actions.length >= 3) break;
    if (state.sideChoices.includes(id)) continue;
    actions.push(sideAction(id));
  }
  for (const id of TERMINAL_ORDER) {
    if (actions.length >= 3) break;
    if (state.terminalChoiceId) break;
    actions.push(terminalAction(id));
  }
  return withChoiceIds(actions);
}

function closeMission(runtime, action) {
  const mission = missionRuntime(runtime);
  if (!mission || mission.status === "completed") return false;
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  mission.status = "failed";
  mission.failedAt ??= minute;
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
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (authored) return authored;
  if (activeAtCurrentTarget(runtime, "hear")) return openingActions(runtime);
  if (activeAtCurrentTarget(runtime, "investigate")) return investigationActions(runtime);
  return null;
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
