import * as base from "./authored-mission-flow-terminal-closure.js";

export * from "./authored-mission-flow-terminal-closure.js";

export const AUTHORED_MISSION_T02_GRANARY_VERSION = "authored-mission-t02-granary-v1";

const MISSION_ID = "MSN-T02";
const TROUBLE_ID = "T02";
const FACILITY_ID = "LOC_FARM_GRANARY";
const STATE_VERSION = "t02-granary-continuity-v1";

const EVIDENCE_ORDER = Object.freeze([
  "fire_origin",
  "hired_hand",
  "merchant_contract",
]);

const SIDE_ORDER = Object.freeze([
  "release_emergency_grain",
  "freeze_village_debt",
  "post_night_watch",
]);

const TERMINAL_ORDER = Object.freeze([
  "accept_rationed_loss",
  "accuse_without_chain",
  "yield_to_merchant_inquiry",
]);

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

function t02InvestigationActive(runtime) {
  const mission = missionRuntime(runtime);
  const step = currentStep(runtime);
  if (!mission || mission.status !== "active" || !step) return false;
  return runtime?.playerState?.player?.facilityId === FACILITY_ID
    && (step.id === "investigate" || step.type === "investigate");
}

function ensureState(runtime) {
  const state = runtime.t02GranaryContinuity ??= {
    version: STATE_VERSION,
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

function selected(state, id) {
  return state.selectedActionIds.includes(id);
}

function choiceId(index) {
  return `CHOICE-${index + 1}`;
}

function baseAction(id, label, minutes, extra = {}) {
  return {
    id: `T02_GRANARY:${id}`,
    authoredT02GranaryChoice: true,
    missionId: MISSION_ID,
    stepId: "investigate",
    troubleId: TROUBLE_ID,
    minutes,
    label,
    ...extra,
  };
}

function dawnFlag(runtime, flag) {
  return runtime?.playerState?.worldFlags?.[flag] === true;
}

function evidenceAction(runtime, evidenceClass) {
  const state = ensureState(runtime);
  const releasedGrain = state.sideChoices.includes("release_emergency_grain");
  const debtFrozen = state.sideChoices.includes("freeze_village_debt");
  const watchPosted = state.sideChoices.includes("post_night_watch");
  // Day5夜明けに縄を張っていれば、配給の人出でも土間の油筋は残っている。
  const floorProtected = dawnFlag(runtime, "t02FloorEvidenceProtected");
  // 夜明けにパン屋の粉樽を数えていれば、第三者控えの片側が既に手元にある。
  const bakerCountercopy = dawnFlag(runtime, "t02FlourTallyMismatch");

  if (evidenceClass === "fire_origin") {
    if (releasedGrain && floorProtected) {
      return baseAction(
        "EVIDENCE:FIRE:CORDONED_OIL_TRACK",
        "配給の人出を縄の外へ通し、守り抜いた土間から油筋と焦げた灯芯を回収する",
        34,
        {
          type: "investigate",
          t02EvidenceClass: evidenceClass,
          discoveryId: "T02-EV-FIRE-CORDONED-OIL-TRACK",
          discoveryText: "夜明けに張った縄の内側だけが踏まれずに残り、扉から穀袋へ伸びる油筋と太い替え芯をそのまま採取できた。配給を行いながら、火元の一次証拠を失わずに済んでいる。",
          t02Consequence: "夜明けに現場を囲っておいたため、備蓄を配りながらでも火元の一次証拠を保全できた。鑑定に余分な時間はかからない。",
          suppressRandomEncounter: true,
        },
      );
    }
    return releasedGrain
      ? baseAction(
        "EVIDENCE:FIRE:SOOT_LAYER",
        "配給で踏み荒らされた床を諦め、トーマが外した灯皿の煤層を削り取る",
        52,
        {
          type: "investigate",
          t02EvidenceClass: evidenceClass,
          discoveryId: "T02-EV-FIRE-SOOT-LAYER",
          discoveryText: "床の油筋は配給作業で失われたが、取り外された灯皿の煤は内側から外側へ焼けていた。失火ではなく、扉側から油を足された放火の痕跡である。",
          t02Consequence: "失われた床証拠の代わりに、灯皿の煤層から火元を立証した。配給を優先したため、鑑定には余分な時間がかかった。",
          suppressRandomEncounter: true,
        },
      )
      : baseAction(
        "EVIDENCE:FIRE:OIL_TRACK",
        "穀倉を一時封鎖し、扉の油筋と焦げた灯芯を別々の布へ包んで保存する",
        38,
        {
          type: "investigate",
          t02EvidenceClass: evidenceClass,
          discoveryId: "T02-EV-FIRE-OIL-TRACK",
          discoveryText: "扉から穀袋へ伸びる油筋と、通常の灯りには使わない太い替え芯を保存した。火は保管中の自然発火ではなく、人為的に走らされた。",
          t02Consequence: "人が油を引いて火を回したことを示す、失われる前の現場証拠を確保した。",
          suppressRandomEncounter: true,
        },
      );
  }

  if (evidenceClass === "hired_hand") {
    return watchPosted
      ? baseAction(
        "EVIDENCE:HAND:ABANDONED_CACHE",
        "見張りを避けて逃げた男の空き家を調べ、半焼けの受取符と交易都市の荷札を拾う",
        58,
        {
          type: "investigate",
          t02EvidenceClass: evidenceClass,
          discoveryId: "T02-EV-HAND-ABANDONED-CACHE",
          discoveryText: "本人は夜警を見て逃げたが、空き家には前金の受取符と交易都市の穀物商が使う荷札が残った。雇われ仕事だったことを物証で繋げられる。",
          t02Consequence: "ダルク本人の証言は失ったが、置き去りにされた受取符と荷札で雇用関係を立証した。",
          suppressRandomEncounter: true,
        },
      )
      : baseAction(
        "EVIDENCE:HAND:BOOT_ASH",
        "裏口から続く灰混じりの靴跡を追い、空き家に隠された前金の受取符を押さえる",
        44,
        {
          type: "investigate",
          t02EvidenceClass: evidenceClass,
          discoveryId: "T02-EV-HAND-BOOT-ASH",
          discoveryText: "穀倉の灰を踏んだ靴跡は村外れの空き家へ続き、床下から前金の受取符が見つかった。支払日と放火前夜が一致する。",
          t02Consequence: "灰の靴跡を消される前に追い、雇われた男と支払いの痕跡を結びつけた。",
          suppressRandomEncounter: true,
        },
      );
  }

  if (debtFrozen && bakerCountercopy) {
    return baseAction(
      "EVIDENCE:CONTRACT:COUNTERCOPY_MATCH",
      "夜明けに数えたパオロの粉樽控えへ、交易都市の税印写しだけを取り寄せて重ねる",
      42,
      {
        type: "investigate",
        t02EvidenceClass: evidenceClass,
        discoveryId: "T02-EV-CONTRACT-COUNTERCOPY-MATCH",
        discoveryText: "夜明けに実物を数えたパン屋の控えが既にあるため、取り寄せるのは税印写しだけで足りた。二つの独立記録に同じ架空不足が並び、借金額が去年から水増しされていたことが一度で示せる。",
        t02Consequence: "原簿を持ち去られた後でも、先に確かめておいた実在庫が第三者記録の片側として効き、契約操作の立証が早く済んだ。",
        suppressRandomEncounter: true,
      },
    );
  }

  return debtFrozen
    ? baseAction(
      "EVIDENCE:CONTRACT:TAX_COPY",
      "持ち去られた原簿を追わず、パン屋の納品控えと交易都市の税印写しを突き合わせる",
      64,
      {
        type: "investigate",
        t02EvidenceClass: evidenceClass,
        discoveryId: "T02-EV-CONTRACT-TAX-COPY",
        discoveryText: "村の原簿は商人側に持ち去られたが、パン屋の納品控えと税印写しには同じ架空不足分が残っていた。借金額が意図的に膨らまされたことを第三者記録で示せる。",
        t02Consequence: "原契約を警戒させて失った代わりに、独立した二つの控えから収穫権買い叩きの仕組みを復元した。",
        suppressRandomEncounter: true,
      },
    )
    : baseAction(
      "EVIDENCE:CONTRACT:LEDGER_GAP",
      "入庫帳と村長の借金控えを別々に封じ、欠落した頁番号と不足量を照合する",
      46,
      {
        type: "investigate",
        t02EvidenceClass: evidenceClass,
        discoveryId: "T02-EV-CONTRACT-LEDGER-GAP",
        discoveryText: "入庫帳から抜かれた頁番号が借金控えの追記日と一致し、実在しない穀物不足が債務へ上乗せされていた。収穫権を奪うための契約操作である。",
        t02Consequence: "原簿が回収される前に、架空不足と借金契約を同じ頁番号で結びつけた。",
        suppressRandomEncounter: true,
      },
    );
}

function sideAction(id) {
  if (id === "release_emergency_grain") {
    return baseAction(
      "SIDE:RELEASE_GRAIN",
      "証拠保全より先に備蓄を開き、今夜のパンを失う家へ穀物を配る",
      30,
      {
        type: "plan",
        t02SideChoice: id,
        t02WorldFlags: ["t02EmergencyGrainReleased", "t02PristineFloorEvidenceLost"],
        t02Consequence: "村の空腹は一時的に抑えた。しかし人の出入りで床の油筋と靴跡は踏み荒らされ、火元の立証には代替証拠が必要になった。",
      },
    );
  }
  if (id === "freeze_village_debt") {
    return baseAction(
      "SIDE:FREEZE_DEBT",
      "ガロ村長に署名を止めさせ、借金契約を村の会議まで凍結する",
      24,
      {
        type: "plan",
        t02SideChoice: id,
        t02WorldFlags: ["t02DebtSigningFrozen", "t02MerchantWarned"],
        t02Consequence: "収穫権の即日移転は止まったが、穀物商へ警戒が伝わり、原簿と契約書は村から持ち出された。以後は独立した控えを追う必要がある。",
      },
    );
  }
  return baseAction(
    "SIDE:POST_WATCH",
    "二度目の火付けを防ぐため夜警を置き、裏口と空き家を見張らせる",
    36,
    {
      type: "plan",
      t02SideChoice: id,
      t02WorldFlags: ["t02GranaryNightWatchPosted", "t02HiredHandFled"],
      t02Consequence: "穀倉への再侵入は防いだが、見張りに気づいたダルクは交易都市方面へ逃げた。本人の供述ではなく、残した支払物を追うことになる。",
    },
  );
}

function terminalAction(id) {
  if (id === "accept_rationed_loss") {
    return baseAction(
      "END:RATIONS",
      "犯人追及を打ち切り、残った穀物だけで冬まで持たせる配給制へ移る",
      40,
      {
        type: "plan",
        t02TerminalChoice: id,
        t02WorldFlags: ["t02RationingAccepted"],
        t02Consequence: "当面の飢えは抑えられるが、放火と契約操作は立証できず、村は穀物商への債務を背負った。",
      },
    );
  }
  if (id === "accuse_without_chain") {
    return baseAction(
      "END:UNPROVEN_ACCUSATION",
      "揃わない証拠のままダルクを名指しし、村人の前で拘束を求める",
      22,
      {
        type: "plan",
        t02TerminalChoice: id,
        t02WorldFlags: ["t02UnprovenAccusation"],
        t02Consequence: "疑いは広がったが、雇い主まで繋がらない告発は崩れた。ダルクは逃げ、穀物商は契約を合法な救済融資として押し通した。",
      },
    );
  }
  return baseAction(
    "END:MERCHANT_INQUIRY",
    "交易都市の穀物商が派遣した調査人へ、現場と帳簿を引き渡す",
    28,
    {
      type: "plan",
      t02TerminalChoice: id,
      t02WorldFlags: ["t02MerchantControlledInquiry"],
      t02Consequence: "調査は商人側の管理下へ移り、管理人の過失という結論だけが残った。村は補填名目の借金と収穫権契約を受け入れた。",
    },
  );
}

function availableChoices(runtime) {
  const state = ensureState(runtime);
  const missingEvidence = EVIDENCE_ORDER.filter((id) => !state.evidenceClasses.includes(id));
  const unusedSides = SIDE_ORDER.filter((id) => !state.sideChoices.includes(id));
  const actions = missingEvidence.map((id) => evidenceAction(runtime, id));
  for (const id of unusedSides) {
    if (actions.length >= 3) break;
    actions.push(sideAction(id));
  }
  for (const id of TERMINAL_ORDER) {
    if (actions.length >= 3) break;
    if (state.terminalChoiceId || selected(state, `T02_GRANARY:END:${id}`)) continue;
    actions.push(terminalAction(id));
  }
  return actions.slice(0, 3).map((action, index) => ({ ...action, choiceId: choiceId(index) }));
}

function closeMission(runtime, action) {
  const mission = missionRuntime(runtime);
  if (!mission || mission.status === "completed") return false;
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  mission.status = "failed";
  mission.failedAt ??= minute;
  mission.failureReason = `player_closed_t02_${action.t02TerminalChoice}`;
  mission.closedByPlayerAt ??= minute;
  mission.closedByPlayerKind ??= action.t02TerminalChoice;
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags.t02PlayerMissionClosed = true;
  return true;
}

function recordChoice(runtime, action) {
  const state = ensureState(runtime);
  if (state.selectedActionIds.includes(action.id)) return false;
  state.selectedActionIds.push(action.id);
  state.sceneRevision += 1;
  state.lastChangedAtMinute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  if (action.t02EvidenceClass && !state.evidenceClasses.includes(action.t02EvidenceClass)) {
    state.evidenceClasses.push(action.t02EvidenceClass);
  }
  if (action.t02SideChoice && !state.sideChoices.includes(action.t02SideChoice)) {
    state.sideChoices.push(action.t02SideChoice);
  }
  if (action.t02TerminalChoice) state.terminalChoiceId = action.t02TerminalChoice;
  runtime.playerState.worldFlags ??= {};
  for (const flag of action.t02WorldFlags ?? []) runtime.playerState.worldFlags[flag] = true;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "T02_GRANARY_SCENE_RESOLVED",
    minute: state.lastChangedAtMinute,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    actionId: action.id,
    evidenceClass: action.t02EvidenceClass ?? null,
    sideChoice: action.t02SideChoice ?? null,
    terminalChoice: action.t02TerminalChoice ?? null,
    sceneRevision: state.sceneRevision,
  });
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (authored) return authored;
  if (!t02InvestigationActive(runtime)) return null;
  return availableChoices(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok === false || action?.authoredT02GranaryChoice !== true) return changed;
  const recorded = recordChoice(runtime, action);
  if (action.t02TerminalChoice) closeMission(runtime, action);
  if (action.t02Consequence) result.summary = action.t02Consequence;
  return recorded || changed;
}

export const AUTHORED_MISSION_T02_GRANARY_INTERNALS = Object.freeze({
  MISSION_ID,
  TROUBLE_ID,
  FACILITY_ID,
  EVIDENCE_ORDER,
  SIDE_ORDER,
  TERMINAL_ORDER,
  missionRuntime,
  missionDefinition,
  currentStep,
  t02InvestigationActive,
  ensureState,
  evidenceAction,
  sideAction,
  terminalAction,
  availableChoices,
  closeMission,
  recordChoice,
});
