import * as base from "./authored-mission-flow-revisit-canonical.js";
import { T13_FOREST_KING_SLIME_WORLD_TREE_PACK as T13 } from "./authored/missions/t13-forest-king-slime-world-tree-collapse.js";

export * from "./authored-mission-flow-revisit-canonical.js";

export const AUTHORED_MISSION_AMBIENT_CONTINUITY_VERSION = "authored-mission-ambient-continuity-v1";

const FLOW_ID = T13.id;
const MISSION_ID = T13.missionId;
const FOREST_HUB = "エルフの隠れ里";
const FOREST_EDGE = "LOC_FOREST_EDGE";
const JILL_ID = "NPC060";

const AMBIENT_STAGES = Object.freeze([
  Object.freeze({
    id: "patrol_arrived_first",
    title: "巡回隊が先に現場へ入った",
    inspect: Object.freeze({
      minutes: 18,
      label: "踏み荒らされた足跡を捨て、草の圧痕と泥の跳ね方から巡回隊以前の進路を復元する",
      summary: "巡回隊が先に現場へ入り、元の足跡は踏み荒らされていた。靴跡そのものを追い直さず、草の圧痕、泥の跳ね方、折れた枝の高さを重ね、巡回隊が来る前の進路を復元した。",
      worldFlag: "t13Ambient:patrolTracksReconstructed",
    }),
    talk: Object.freeze({
      minutes: 11,
      label: "ジルに、到着前に誰が粘液標本を持ち出したか確かめる",
      absentLabel: "ジルが残した採取札を読み、標本を持ち出した者の署名を追う",
      summary: "ジルの採取箱は既に開けられ、標本の一部が巡回隊の仮設所へ移されていた。持ち出した者と移送時刻を聞き、同じ標本を再採取するのではなく、移動後の保管線を新しい手掛かりにした。",
      absentSummary: "ジル本人は現場を離れていたが、採取札には標本を持ち出した者の署名と時刻が残っていた。本人を待ち直さず、移動後の保管線を新しい手掛かりにした。",
      worldFlag: "t13Ambient:sampleCustodianKnown",
    }),
    move: Object.freeze({
      minutesBonus: 4,
      label: "巡回隊の赤布を辿り、移された標本より先に{destination}へ回る",
      fallbackLabel: "巡回隊の赤布が示す方向へ進み、移された標本の保管先を追う",
      summary: "巡回隊が残した赤布は、元の現場ではなく移送先を示していた。以前と同じ場所へ戻らず、標本と記録が次に集まる地点へ先回りした。",
      worldFlag: "t13Ambient:followedPatrolTransfer",
    }),
  }),
  Object.freeze({
    id: "rain_erased_surface",
    title: "雨が表面の証拠を消した",
    inspect: Object.freeze({
      minutes: 20,
      label: "雨に消えた表面跡を諦め、石の裏の粘液膜と葉裏の魔力粉から通過時刻を測り直す",
      summary: "雨で地表の足跡と粘液線は消えていた。濡れなかった石の裏、葉裏に残った魔力粉、幹の雨だれの切れ目を調べ、失われた表面跡ではなく残留層から通過時刻を測り直した。",
      worldFlag: "t13Ambient:rainShelteredResidueMeasured",
    }),
    talk: Object.freeze({
      minutes: 12,
      label: "ジルに、雨で変質した旧標本の代わりになる物証を選ばせる",
      absentLabel: "ジルの選別表を使い、雨で変質しにくい代替物証を探す",
      summary: "旧標本は雨水を吸って反応が変わり、もう比較対象に使えなかった。ジルと日陰石、魚鱗、樹皮膜を比べ、現在の吸収対象を示す代替物証を一つに絞った。",
      absentSummary: "旧標本は雨水で変質していた。ジルの選別表に従い、日陰石、魚鱗、樹皮膜を比べ、現在の吸収対象を示す代替物証を一つに絞った。",
      worldFlag: "t13Ambient:rainProofEvidenceChosen",
    }),
    move: Object.freeze({
      minutesBonus: 6,
      label: "次の雨が来る前に、濡れていない控えが残る{destination}へ急ぐ",
      fallbackLabel: "次の雨が来る前に、濡れていない控えの保管先へ急ぐ",
      summary: "雨雲が戻る前に、屋内へ移された控えと乾いた試料を確保する必要があった。現場へ留まり続けず、消える前の証拠を持つ場所へ急いだ。",
      worldFlag: "t13Ambient:reachedDryCopyBeforeRain",
    }),
  }),
  Object.freeze({
    id: "rumor_drew_searchers",
    title: "黒嶺水攻めの噂が捜索者を呼び込んだ",
    inspect: Object.freeze({
      minutes: 22,
      label: "増えた靴跡を靴鋲と歩幅で分け、噂を聞いて来た捜索者の跡を元の痕跡から除く",
      summary: "黒嶺の水攻めだという噂を聞いた捜索者が押し寄せ、現場には新しい足跡が増えていた。靴鋲、歩幅、土の乾き方で後発者を除き、噂が広がる前から存在した痕跡だけを残した。",
      worldFlag: "t13Ambient:rumorSearchersSeparated",
    }),
    talk: Object.freeze({
      minutes: 13,
      label: "ジルに、水攻め説を最初に広めた人物と、その人物が見ていない事実を聞く",
      absentLabel: "捜索札の筆跡を比べ、水攻め説を最初に掲示した人物を特定する",
      summary: "噂を繰り返す者ではなく、最初に黒嶺水攻め説を書いた人物を絞り込んだ。その人物が実際には水門も流量簿も見ていないと分かり、噂と物証を別の枝として扱えるようになった。",
      absentSummary: "捜索札の筆跡と掲示時刻を比べ、水攻め説を最初に書いた人物を絞り込んだ。その人物が水門も流量簿も見ていないと分かり、噂と物証を別の枝として扱えるようになった。",
      worldFlag: "t13Ambient:firstRumorAuthorKnown",
    }),
    move: Object.freeze({
      minutesBonus: 8,
      label: "噂の写しではなく、最初の掲示を見た証人がいる{destination}へ向かう",
      fallbackLabel: "噂の写しではなく、最初の掲示を見た証人の所へ向かう",
      summary: "後から増えた噂の写しを集めるのをやめ、最初の掲示を見た証人へ線を切り替えた。証言が上書きされる前に、噂が生まれた時点を追った。",
      worldFlag: "t13Ambient:firstPostingWitnessPursued",
    }),
  }),
  Object.freeze({
    id: "evidence_seized",
    title: "証拠箱が評議会に押収された",
    inspect: Object.freeze({
      minutes: 21,
      label: "空になった証拠箱の封蝋片と綴じ糸を調べ、持ち出し命令の系統を復元する",
      summary: "証拠箱の中身は評議会に押収されていた。空箱を調べ直すのではなく、割れた封蝋、綴じ糸、箱を置き直した擦れ跡から、誰の命令でどの順番に持ち出されたかを復元した。",
      worldFlag: "t13Ambient:seizureChainReconstructed",
    }),
    talk: Object.freeze({
      minutes: 14,
      label: "ジルに、押収記録を開示させるため誰の信用が必要か聞く",
      absentLabel: "押収札の承認欄を読み、記録開示に必要な保証人を割り出す",
      summary: "押収後は、同じ情報を無償では得られなくなっていた。ジルから開示権限を持つ者と必要な保証を聞き、証拠探しを信用獲得の経路へ切り替えた。",
      absentSummary: "押収札の承認欄から、記録開示には評議会員の保証が必要だと分かった。証拠探しを、保証人を得る経路へ切り替えた。",
      worldFlag: "t13Ambient:seizedRecordGuarantorKnown",
    }),
    move: Object.freeze({
      minutesBonus: 7,
      label: "押収品を追い回さず、開示権を持つ人物がいる{destination}へ向かう",
      fallbackLabel: "押収品を追い回さず、開示権を持つ人物の所へ向かう",
      summary: "移された証拠箱を力ずくで追う道を捨て、開示権を持つ人物へ向かった。ここから先は、物証だけでなく信用を支払う枝になる。",
      worldFlag: "t13Ambient:recordAccessRouteChosen",
    }),
  }),
  Object.freeze({
    id: "damage_advanced",
    title: "放置した時間ぶん世界樹の損傷が進んだ",
    inspect: Object.freeze({
      minutes: 24,
      label: "古い傷の位置ではなく、新しく裂けた根と粘液の到達高を測り、被害段階を更新する",
      summary: "以前の傷を確認している間にも、世界樹の根は新しく裂け、粘液の到達高が上がっていた。古い被害図へ戻らず、現在の裂け目と精霊光の消失範囲から被害段階を更新した。",
      worldFlag: "t13Ambient:damageStageAdvancedMeasured",
    }),
    talk: Object.freeze({
      minutes: 15,
      label: "ジルに、時間切れで既に閉じた救済経路と、まだ残る一手を言わせる",
      absentLabel: "ジルの赤い取消線を読み、既に閉じた救済経路と残る一手を確認する",
      summary: "時間が進んだため、すべてを同時に救う前提は崩れていた。既に閉じた経路と、今ならまだ守れる対象を分け、失った選択をなかったことにせず次の判断へ持ち越した。",
      absentSummary: "ジルの工程表には、間に合わなくなった経路へ赤い取消線が引かれていた。閉じた道と、今ならまだ守れる対象を分けて次の判断へ持ち越した。",
      worldFlag: "t13Ambient:closedRescueRouteAcknowledged",
    }),
    move: Object.freeze({
      minutesBonus: 10,
      label: "閉じた経路を追わず、まだ被害を止められる{destination}へ向かう",
      fallbackLabel: "閉じた経路を追わず、まだ被害を止められる地点へ向かう",
      summary: "間に合わなくなった救済経路を追うのをやめ、まだ被害を止められる地点へ進んだ。ここで選ばなかった対象は、現地NPCの判断へ委ねられる。",
      worldFlag: "t13Ambient:remainingRescueRouteCommitted",
    }),
  }),
  Object.freeze({
    id: "trust_has_price",
    title: "同じ証言を得るにも信用が必要になった",
    inspect: Object.freeze({
      minutes: 19,
      label: "配水札と値札の書き換えを比べ、渇水で情報と物資の値段が上がった時点を確定する",
      summary: "渇水で水だけでなく、案内、荷車、記録の閲覧にも対価が求められていた。配水札と値札の書き換え時刻を比べ、誰が情報を囲い始めたかを確定した。",
      worldFlag: "t13Ambient:informationPriceRiseDated",
    }),
    talk: Object.freeze({
      minutes: 13,
      label: "ジルに、金ではなく誰の保証なら証言者が口を開くか聞く",
      absentLabel: "証言拒否の札を読み、金ではなく必要とされる保証関係を探る",
      summary: "証言者は単に金を求めているのではなく、報復から守る保証を必要としていた。ジルから信頼される仲介者を聞き、証言を買うのではなく保護を約束する経路へ切り替えた。",
      absentSummary: "証言拒否の札から、求められているのは金銭より報復からの保護だと分かった。信頼される仲介者を探す経路へ切り替えた。",
      worldFlag: "t13Ambient:witnessProtectionGuarantorKnown",
    }),
    move: Object.freeze({
      minutesBonus: 6,
      label: "証言者へ直接迫らず、保証を引き受けられる人物がいる{destination}へ向かう",
      fallbackLabel: "証言者へ直接迫らず、保証を引き受けられる人物の所へ向かう",
      summary: "同じ質問を繰り返して証言者を追い詰める道を捨て、保護を保証できる人物へ向かった。情報取得の条件そのものを変える枝を選んだ。",
      worldFlag: "t13Ambient:witnessProtectionRouteChosen",
    }),
  }),
  Object.freeze({
    id: "npcs_changed_plan",
    title: "NPCたちが待たずに計画を変えた",
    inspect: Object.freeze({
      minutes: 23,
      label: "村人が築いた仮堰と移された杭を調べ、誰が独断で流路を変えたか突き止める",
      summary: "プレイヤーが戻る前に、村人たちは仮堰を築き、測量杭を安全な側へ移していた。元の配置を前提にせず、資材の刻印と作業順から計画を変えた人物を突き止めた。",
      worldFlag: "t13Ambient:npcIndependentPlanKnown",
    }),
    talk: Object.freeze({
      minutes: 14,
      label: "ジルに、誰が先に動き、その善意がどの証拠を壊したか聞く",
      absentLabel: "仮堰の作業札を読み、善意の介入で失われた証拠を確かめる",
      summary: "先に動いたNPCの善意は被害を一部抑えた一方、流路と痕跡を変えていた。助けた結果と壊した証拠を同時に記録し、単純な失敗として巻き戻さない判断材料にした。",
      absentSummary: "作業札から、先に動いたNPCが被害を抑えるため流路を変え、その結果いくつかの痕跡が失われたと分かった。救済と証拠損失を同時に記録した。",
      worldFlag: "t13Ambient:goodIntentEvidenceLossRecorded",
    }),
    move: Object.freeze({
      minutesBonus: 9,
      label: "旧計画を押し戻さず、先に動いたNPCの現在地である{destination}へ合流する",
      fallbackLabel: "旧計画を押し戻さず、先に動いたNPCの現在地へ合流する",
      summary: "以前の計画へ戻すのではなく、既に動き始めたNPCの現在地へ合流した。世界が進めた枝を受け入れ、その上から救済手順を組み直す。",
      worldFlag: "t13Ambient:joinedNpcChangedPlan",
    }),
  }),
  Object.freeze({
    id: "original_witness_gone",
    title: "最初の証言者が現場を離れた",
    inspect: Object.freeze({
      minutes: 22,
      label: "消えた証言者を待たず、魚鱗の付着線と船綱の濡れ方から同じ事実を物証化する",
      summary: "最初の証言者は避難隊へ加わり、現場には戻らなかった。帰還を待って同じ証言を取り直さず、魚鱗の付着線、船綱の濡れ方、橋板の泥から同じ事実を物証化した。",
      worldFlag: "t13Ambient:absentWitnessReplacedByObjects",
    }),
    talk: Object.freeze({
      minutes: 12,
      label: "ジルに、本人ではなく追うべき別の証言者と物証を一つずつ選ばせる",
      absentLabel: "ジルの引継ぎ札から、次に追う別の証言者と物証を一つずつ選ぶ",
      summary: "当初の人物へ戻れないことを前提に、別の証言者と独立した物証を一つずつ選んだ。同じ話を別人に言わせるのではなく、証言と物証が互いを検証できる新しい線へ切り替えた。",
      absentSummary: "ジルの引継ぎ札から、別の証言者と独立した物証を一つずつ選んだ。同じ話を再現するのではなく、両者が互いを検証できる新しい線へ切り替えた。",
      worldFlag: "t13Ambient:alternateWitnessAndObjectChosen",
    }),
    move: Object.freeze({
      minutesBonus: 7,
      label: "不在の証言者を待たず、代替証人か物証が残る{destination}へ向かう",
      fallbackLabel: "不在の証言者を待たず、代替証人か物証が残る場所へ向かう",
      summary: "戻らない証言者を待つ時間を捨て、代替証人か独立物証が残る場所へ向かった。失われた会話機会を、新しい検証経路へ変換した。",
      worldFlag: "t13Ambient:alternateEvidenceRoutePursued",
    }),
  }),
  Object.freeze({
    id: "path_collapsed",
    title: "以前使えた道が崩れた",
    inspect: Object.freeze({
      minutes: 25,
      label: "崩落した旧道の亀裂と迂回路の地盤を調べ、通れる時間と失う物資を見積もる",
      summary: "以前使えた旧道は根の隆起で崩れ、同じ移動経路を選べなくなっていた。亀裂、地盤、迂回距離を調べ、通行に必要な時間と捨てる物資を具体化した。",
      worldFlag: "t13Ambient:collapsedPathCostMeasured",
    }),
    talk: Object.freeze({
      minutes: 15,
      label: "ジルに、今は同時に救えない二つの対象と、選択ごとの永久損失を聞く",
      absentLabel: "ジルの分岐図を読み、同時に救えない対象と選択ごとの永久損失を確認する",
      summary: "崩落により、世界樹側と下流側へ同時に人員を送れなくなっていた。どちらを選ぶと何が永久に失われるかを明示し、曖昧な保留ではなく救済対象を選ぶ段階へ進んだ。",
      absentSummary: "ジルの分岐図には、世界樹側と下流側へ同時に人員を送れないことが記されていた。各選択で永久に失われるものを確認し、救済対象を選ぶ段階へ進んだ。",
      worldFlag: "t13Ambient:mutuallyExclusiveRescueKnown",
    }),
    move: Object.freeze({
      minutesBonus: 12,
      label: "迂回の代償を受け入れ、選んだ救済線が続く{destination}へ進む",
      fallbackLabel: "迂回の代償を受け入れ、選んだ救済線へ進む",
      summary: "崩れた道を無理に戻そうとせず、迂回の時間と物資損失を受け入れた。選んだ救済線へ進み、もう一方は現地NPCの判断へ残した。",
      worldFlag: "t13Ambient:exclusiveRescueLineCommitted",
    }),
  }),
  Object.freeze({
    id: "last_recoverable_trace",
    title: "残留魔力を追える最後の時間になった",
    inspect: Object.freeze({
      minutes: 28,
      label: "消えかけた残留魔力を一度だけ固定し、完全な再調査ではなく最終判断用の証拠にする",
      summary: "残留魔力は次の夜明けまで持たず、同じ調査をもう一度行う余地はなかった。消えかけた反応を一度だけ固定し、完全な原因究明ではなく最終判断に使う証拠として封じた。",
      worldFlag: "t13Ambient:lastTraceSealed",
    }),
    talk: Object.freeze({
      minutes: 16,
      label: "ジルに、プレイヤーが去った後も自分で守る対象を一つ選ばせる",
      absentLabel: "ジルの最終指示書を読み、彼女が独力で守ると決めた対象を確認する",
      summary: "ジルはプレイヤーの次の指示を待たず、自分が守る対象を一つ選んだ。その選択はプレイヤーの枝とは別に進み、後から都合よく選び直せないNPC自身の決断として記録された。",
      absentSummary: "ジルの最終指示書には、プレイヤーを待たず自分が守る対象が記されていた。その選択を、後から選び直せないNPC自身の決断として記録した。",
      worldFlag: "t13Ambient:jillIndependentProtectionChosen",
    }),
    move: Object.freeze({
      minutesBonus: 14,
      label: "残した証拠をジルへ託し、自分が選んだ因果線の先にある{destination}へ向かう",
      fallbackLabel: "残した証拠をジルへ託し、自分が選んだ因果線の先へ向かう",
      summary: "現場へ何度も戻る可能性を閉じ、固定した証拠をジルへ託した。プレイヤーは選んだ因果線の先へ進み、森入口の同じ三択には戻らない。",
      worldFlag: "t13Ambient:forestEdgeCustodyTransferred",
    }),
  }),
]);

const TERMINAL_CHOICES = Object.freeze([
  Object.freeze({
    id: "salvage",
    minutes: 70,
    label: "森入口で確保した証拠だけを正式記録にし、完全解決より下流の被害抑制を優先する",
    summary: "森入口で確保できた証拠だけを正式記録にし、完全な原因究明へ戻る道を閉じた。残る人員と時間は下流の給水と避難へ回される。",
  }),
  Object.freeze({
    id: "delegate",
    minutes: 55,
    label: "残る調査をジルと森評議会へ委ね、自分は別のトラブル救援へ向かう",
    summary: "残る調査と証拠保全をジルと森評議会へ委ねた。以後の判断は現地NPCが行い、プレイヤーは同じ証言や痕跡を選び直せない。",
  }),
  Object.freeze({
    id: "withdraw",
    minutes: 40,
    label: "これ以上の再調査を断念し、黒嶺疑惑と世界樹被害が残る結果を受け入れる",
    summary: "森入口の再調査を断念した。失われた証拠、閉じた救済経路、広がった噂は戻らず、その状態のまま世界が次へ進む。",
  }),
]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function flowFor(runtime) {
  return runtime?.authoredMissionFlows?.[FLOW_ID] ?? null;
}

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function freshAmbientState() {
  return {
    version: AUTHORED_MISSION_AMBIENT_CONTINUITY_VERSION,
    nextStageIndex: 0,
    selectedBranchIds: [],
    closedBranchIds: [],
    endedAtMinute: null,
    endingKind: null,
  };
}

function ensureAmbientState(flow) {
  if (!flow) return null;
  flow.ambientContinuity ??= freshAmbientState();
  const state = flow.ambientContinuity;
  state.version = AUTHORED_MISSION_AMBIENT_CONTINUITY_VERSION;
  state.nextStageIndex = Math.max(0, Number(state.nextStageIndex ?? 0));
  state.selectedBranchIds = array(state.selectedBranchIds).map(String);
  state.closedBranchIds = array(state.closedBranchIds).map(String);
  state.endedAtMinute ??= null;
  state.endingKind ??= null;
  return state;
}

function t13MissionActive(runtime) {
  const status = runtime?.playerState?.missions?.[MISSION_ID]?.status;
  return ["active", "available", "in_progress"].includes(String(status ?? ""));
}

function atForestEdge(runtime) {
  const current = player(runtime);
  return current.location === FOREST_HUB && current.facilityId === FOREST_EDGE;
}

function directInvestigationEnded(flow) {
  return flow?.ambientContinuity?.endedAtMinute != null
    || flow?.revisitContextState?.endedAtMinute != null;
}

function jillFromContext(context) {
  return array(context?.presentNpcs).find((npc) => npc?.id === JILL_ID) ?? null;
}

function movementDestinationLabel(action) {
  if (!action) return null;
  if (action.destinationHub && action.movementScope === "regional") return action.destinationHub;
  return String(action.label ?? "").replace(/へ(?:向かう|旅立つ)$/u, "").replace(/^話を終え、/u, "") || null;
}

function preferredMovement(context, guidance) {
  const actions = array(context?.movementActions);
  if (!actions.length) return null;
  return actions.find((action) => guidance?.targetFacilityId
      && action.destinationFacilityId === guidance.targetFacilityId)
    ?? actions.find((action) => guidance?.targetLocation
      && action.movementScope === "regional"
      && action.destinationHub === guidance.targetLocation)
    ?? actions.find((action) => action.destinationFacilityId === "LOC_FOREST_CAMP")
    ?? actions.find((action) => action.movementScope === "local")
    ?? actions.find((action) => action.movementScope === "regional")
    ?? actions[0];
}

function stageActionId(stage, kind) {
  return `MISSION_FLOW:T13:AMBIENT:${stage.id}:${kind}`;
}

function commonAction(stage, kind, branch) {
  return {
    id: stageActionId(stage, kind),
    family: kind === "move" ? "travel" : kind === "talk" ? "talk" : "investigate",
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: `ambient_${kind}`,
    authoredMissionAmbientChoice: true,
    authoredMissionAmbientStageId: stage.id,
    authoredMissionAmbientStageTitle: stage.title,
    authoredMissionAmbientBranchKind: kind,
    authoredMissionAmbientSummary: branch.summary,
    authoredMissionAmbientWorldFlag: branch.worldFlag,
    dialogueExit: true,
  };
}

function inspectAction(stage) {
  return {
    ...commonAction(stage, "inspect", stage.inspect),
    type: "localInvestigate",
    minutes: stage.inspect.minutes,
    label: stage.inspect.label,
    localVariant: 100 + AMBIENT_STAGES.findIndex((entry) => entry.id === stage.id),
  };
}

function talkAction(stage, jill) {
  const present = Boolean(jill);
  return {
    ...commonAction(stage, "talk", stage.talk),
    type: present ? "conversation" : "observe",
    minutes: stage.talk.minutes,
    label: present ? stage.talk.label : stage.talk.absentLabel,
    targetNpcId: present ? JILL_ID : null,
    targetNpcName: present ? (jill.name ?? "ジル") : null,
    dialogueTopic: present ? `t13_ambient_${stage.id}` : null,
    singleTurnConversation: true,
    authoredMissionAmbientSummary: present ? stage.talk.summary : stage.talk.absentSummary,
  };
}

function moveAction(stage, movement) {
  if (!movement) {
    return {
      ...commonAction(stage, "move", stage.move),
      type: "plan",
      minutes: 10 + Number(stage.move.minutesBonus ?? 0),
      label: stage.move.fallbackLabel,
    };
  }
  const destination = movementDestinationLabel(movement) ?? "次の手掛かりがある場所";
  return {
    ...movement,
    ...commonAction(stage, "move", stage.move),
    id: stageActionId(stage, "move"),
    minutes: Math.max(1, Number(movement.minutes ?? 0)) + Number(stage.move.minutesBonus ?? 0),
    label: stage.move.label.replace("{destination}", destination),
    authoredMissionAmbientTargetActionId: movement.id,
  };
}

function stageActions(runtime, context, stage) {
  const guidance = base.authoredMissionFlowGuidance(runtime);
  const movement = preferredMovement(context, guidance);
  return [
    inspectAction(stage),
    talkAction(stage, jillFromContext(context)),
    moveAction(stage, movement),
  ];
}

function terminalActions() {
  return TERMINAL_CHOICES.map((choice) => ({
    id: `MISSION_FLOW:T13:AMBIENT_END:${choice.id}`,
    family: choice.id === "withdraw" ? "leave" : "prepare",
    type: "plan",
    effectKind: `authored_mission_ambient_terminal_${choice.id}`,
    minutes: choice.minutes,
    label: choice.label,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: `ambient_terminal_${choice.id}`,
    authoredMissionAmbientChoice: true,
    authoredMissionAmbientTerminal: true,
    authoredMissionAmbientEndingKind: choice.id,
    authoredMissionAmbientSummary: choice.summary,
    dialogueExit: true,
  }));
}

function ambientEligible(runtime, flow) {
  if (!flow || !t13MissionActive(runtime) || !atForestEdge(runtime)) return false;
  if (directInvestigationEnded(flow)) return false;
  const state = ensureAmbientState(flow);
  return state?.endedAtMinute == null;
}

function consumeAmbientBranch(runtime, flow, action, result) {
  const state = ensureAmbientState(flow);
  const stage = AMBIENT_STAGES[state.nextStageIndex] ?? null;
  if (!stage || action.authoredMissionAmbientStageId !== stage.id) return false;
  const selectedId = action.id;
  const stageIds = ["inspect", "talk", "move"].map((kind) => stageActionId(stage, kind));
  state.selectedBranchIds.push(selectedId);
  state.closedBranchIds.push(...stageIds.filter((id) => id !== selectedId));
  state.nextStageIndex += 1;
  flow.deferredUntilMinute = null;

  runtime.playerState ??= {};
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags[`t13AmbientStage:${stage.id}`] = action.authoredMissionAmbientBranchKind;
  if (action.authoredMissionAmbientWorldFlag) {
    runtime.playerState.worldFlags[action.authoredMissionAmbientWorldFlag] = true;
  }
  runtime.playerState.history.push({
    type: "AUTHORED_MISSION_AMBIENT_BRANCH_SELECTED",
    minute: Number(runtime.playerState.absoluteMinute ?? 0),
    flowId: FLOW_ID,
    missionId: MISSION_ID,
    stageId: stage.id,
    stageTitle: stage.title,
    selectedActionId: selectedId,
    selectedBranchKind: action.authoredMissionAmbientBranchKind,
    closedActionIds: stageIds.filter((id) => id !== selectedId),
    location: player(runtime).location ?? null,
    facilityId: player(runtime).facilityId ?? null,
  });
  result.summary = action.authoredMissionAmbientSummary;
  result.sceneTransition ??= `${stage.title}ため、以前の場面へ戻らず次の因果線へ進む`;
  return true;
}

function endAmbientInvestigation(runtime, flow, action, result) {
  const state = ensureAmbientState(flow);
  if (!action.authoredMissionAmbientTerminal || state.endedAtMinute != null) return false;
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  state.endedAtMinute = minute;
  state.endingKind = action.authoredMissionAmbientEndingKind;
  flow.navigatorFocusId = null;
  flow.navigatorGroupId = null;
  flow.selectedLeadId = null;
  flow.selectedLeadAtMinute = null;
  flow.deferredUntilMinute = null;
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags.t13DirectInvestigationEnded = true;
  runtime.playerState.worldFlags[`t13AmbientEnding:${state.endingKind}`] = true;
  runtime.playerState.history.push({
    type: "AUTHORED_MISSION_AMBIENT_TERMINAL",
    minute,
    flowId: FLOW_ID,
    missionId: MISSION_ID,
    endingKind: state.endingKind,
    actionId: action.id,
  });
  result.summary = action.authoredMissionAmbientSummary;
  return true;
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  if (pack?.id === FLOW_ID) ensureAmbientState(flow);
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  if (flow?.flowId === FLOW_ID) ensureAmbientState(flow);
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (authored) return authored;
  const flow = flowFor(runtime);
  if (!ambientEligible(runtime, flow)) return null;
  if (base.authoredMissionFlowEvidenceAction(runtime)) return null;
  const state = ensureAmbientState(flow);
  const stage = AMBIENT_STAGES[state.nextStageIndex] ?? null;
  return stage ? stageActions(runtime, context, stage) : terminalActions();
}

export function authoredMissionFlowEvidenceAction(runtime) {
  const flow = flowFor(runtime);
  if (directInvestigationEnded(flow)) return null;
  return base.authoredMissionFlowEvidenceAction(runtime);
}

export function suppressGenericAuthoredMissionAction(runtime, action) {
  const flow = flowFor(runtime);
  if (directInvestigationEnded(flow)
    && (action?.missionId === MISSION_ID || action?.authoredMissionFlowId === FLOW_ID)) {
    return true;
  }
  return base.suppressGenericAuthoredMissionAction(runtime, action);
}

export function authoredMissionFlowGuidance(runtime) {
  const flow = flowFor(runtime);
  const state = ensureAmbientState(flow);
  if (ambientEligible(runtime, flow)) {
    const stage = AMBIENT_STAGES[state.nextStageIndex] ?? null;
    if (stage) {
      return {
        missionId: MISSION_ID,
        kicker: "再訪・世界は先へ進んでいる",
        title: stage.title,
        detail: "同じ痕跡や同じ質問には戻れない。変化した証拠、NPCの先行行動、閉じた経路を背負って三つから選ぶ。",
        targetLocation: FOREST_HUB,
        targetFacilityId: FOREST_EDGE,
        actionPanel: null,
      };
    }
    return {
      missionId: MISSION_ID,
      kicker: "森入口で得られる機会は尽きた",
      title: "完全解決を諦めるか、現地へ委ねるか、撤退するか決める",
      detail: "証拠と証言は既に移動・消失している。同じ調査を繰り返さず、不可逆な結果を選ぶ。",
      targetLocation: FOREST_HUB,
      targetFacilityId: FOREST_EDGE,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok === false || action?.authoredMissionFlowId !== FLOW_ID) return changed;
  const flow = flowFor(runtime);
  if (!flow || !action.authoredMissionAmbientChoice) return changed;
  if (action.authoredMissionAmbientTerminal) {
    return endAmbientInvestigation(runtime, flow, action, result) || changed;
  }
  return consumeAmbientBranch(runtime, flow, action, result) || changed;
}

export const AUTHORED_MISSION_AMBIENT_CONTINUITY_INTERNALS = Object.freeze({
  freshAmbientState,
  ensureAmbientState,
  t13MissionActive,
  atForestEdge,
  directInvestigationEnded,
  jillFromContext,
  movementDestinationLabel,
  preferredMovement,
  stageActionId,
  commonAction,
  inspectAction,
  talkAction,
  moveAction,
  stageActions,
  terminalActions,
  ambientEligible,
  consumeAmbientBranch,
  endAmbientInvestigation,
  AMBIENT_STAGES,
  TERMINAL_CHOICES,
});
