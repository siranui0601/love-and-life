import * as base from "./authored-mission-flow-late-game.js";

export * from "./authored-mission-flow-late-game.js";

const T16_FLOW_ID = "capital-persecution-riot";
const T16_MISSION_ID = "MSN-T16";

const T16_DISCLOSURE_BY_OPENING = Object.freeze({
  protect_people_and_routes:
    "暴徒は無差別に動いておらず、混血の子ども、黒嶺出身者、治療師の家へ先に印を付け、安全な避難路の一部を人買いへ売っていた。",
  expose_incitement_and_orders:
    "排斥記事は暴動前から貴族資金で準備され、保護巡回命令と通行証は後から亜人拘束へ書き換えられていた。",
  prevent_hunt_and_war:
    "黒嶺から王都へ命令が届くより前に扇動版木が作られ、Day80の狩人報奨と人買いの買付票も先払いされていた。",
});

const originalT16Pack = base.AUTHORED_MISSION_FLOW_PACKS.find(
  (pack) => pack.id === T16_FLOW_ID || pack.missionId === T16_MISSION_ID,
);

const correctedT16Pack = originalT16Pack
  ? Object.freeze({
      ...originalT16Pack,
      hearing: Object.freeze({
        ...originalT16Pack.hearing,
        choices: Object.freeze(originalT16Pack.hearing.choices.map((choice) => Object.freeze({
          ...choice,
          requiredDisclosure: choice.requiredDisclosure
            ?? T16_DISCLOSURE_BY_OPENING[choice.id],
        }))),
      }),
      investigation: Object.freeze({
        ...originalT16Pack.investigation,
        requiredEvidenceCount: Number(
          originalT16Pack.investigation.requiredEvidenceCount
            ?? originalT16Pack.investigation.requiredEvidenceGroups?.length
            ?? 6,
        ),
      }),
    })
  : null;

export const AUTHORED_MISSION_FLOW_PACKS = Object.freeze(
  base.AUTHORED_MISSION_FLOW_PACKS.map((pack) =>
    correctedT16Pack && (pack.id === T16_FLOW_ID || pack.missionId === T16_MISSION_ID)
      ? correctedT16Pack
      : pack),
);

function t16Pack() {
  return correctedT16Pack ?? originalT16Pack;
}

function prioritizeExactFacilityMovement(context = {}) {
  const movementActions = context.movementActions;
  if (!Array.isArray(movementActions) || movementActions.length < 2) return context;
  return {
    ...context,
    movementActions: [...movementActions].sort((left, right) => {
      const leftLocal = left?.movementScope === "local" && left?.destinationFacilityId;
      const rightLocal = right?.movementScope === "local" && right?.destinationFacilityId;
      return Number(Boolean(rightLocal)) - Number(Boolean(leftLocal));
    }),
  };
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  // T16 can have a regional action to the current hub and a local action to the
  // selected facility at the same time. Exact local movement must win, or the
  // player repeatedly selects the same regional leg and never reaches evidence.
  return base.authoredMissionFlowExclusiveActions(
    runtime,
    prioritizeExactFacilityMovement(context),
  );
}

function t16ResultSummary(action) {
  const pack = t16Pack();
  if (!pack) return null;
  const kind = action?.authoredMissionFlowKind;
  if (kind === "navigator_focus") {
    const focus = pack.investigation.focuses?.find(
      (entry) => entry.id === action.authoredMissionFlowNavigatorFocusId,
    );
    return focus
      ? `${focus.label}ため、事件を二つの独立した論点へ分けた。${focus.narrative}`
      : "亜人排斥暴動を、別々に検証できる二つの論点へ分けた。";
  }
  if (kind === "navigator_group") {
    const group = pack.investigation.focuses
      ?.flatMap((focus) => focus.groups ?? [])
      .find((entry) => entry.id === action.authoredMissionFlowNavigatorGroupId);
    return group
      ? `${group.label}ため、人物・公文書・現場記録の三経路を比較することにした。`
      : "一つの噂に依存せず、三つの独立経路から同じ事実を確かめることにした。";
  }
  if (["navigator_route", "lead", "resolution_preparation_lead"].includes(kind)) {
    const lead = pack.investigation.leads.find(
      (entry) => entry.id === action.authoredMissionFlowLeadId,
    );
    return lead
      ? `場面は${lead.destinationName}へ移る。${lead.label}ことにした。`
      : "選んだ調査先へ移り、現物と記録を照合することにした。";
  }
  if (kind === "navigator_back") return "一つの見方へ固執せず、三つの調査方針を比較し直した。";
  if (kind === "navigator_route_back") return "この三経路は保留し、同じ方針に残る別の事実分類へ戻った。";
  if (kind === "reconsider_lead") return "この調査先はいったん保留し、まだ欠けている別の核心事実を選び直した。";
  if (kind === "resolution_preparation") return "選んだ解決策を成立させるため、欠けている核心証拠の取得へ戻った。";
  return null;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok !== false && action?.authoredMissionFlowId === T16_FLOW_ID) {
    const summary = t16ResultSummary(action);
    if (summary && (!result.summary || result.summary === "行動の結果が世界へ反映された。")) {
      result.summary = summary;
    }
    if (!result.sceneTransition && action.authoredMissionFlowSceneTransition) {
      result.sceneTransition = action.authoredMissionFlowSceneTransition;
    }
  }
  return changed;
}
