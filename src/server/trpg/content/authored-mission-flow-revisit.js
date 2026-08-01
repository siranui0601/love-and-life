import * as base from "./authored-mission-flow-registry-t19-presented.js";
import { T13_FOREST_KING_SLIME_WORLD_TREE_PACK as T13 } from "./authored/missions/t13-forest-king-slime-world-tree-collapse.js";

export * from "./authored-mission-flow-registry-t19-presented.js";

export const AUTHORED_MISSION_REVISIT_VERSION = "authored-mission-revisit-v1";

const T13_FLOW_ID = T13.id;
const FORWARD_KINDS = new Set(["navigator_focus", "navigator_group", "navigator_route"]);
const CONTROL_KINDS = new Set([
  "navigator_back",
  "navigator_route_back",
  "reconsider_lead",
  "defer",
  "premature_resolution",
]);

const FOCUS_REVISITS = Object.freeze({
  growth_and_separation: Object.freeze({
    key: "river_marks_rebuilt",
    extraMinutes: 18,
    label: "流された水位杭を橋脚の泥線と鐘刻から復元し、川から核を離す工程を組み直す",
    summary: "前に見た水位杭は粘液と増水で流されていた。セリエの樹皮傷、橋脚の泥線、夜番の鐘刻を重ね、同じ観測を繰り返すのではなく、失われた記録を復元して成長源と分離手順を追い直した。",
    sceneTransition: "流失した観測点から、橋脚と河岸の復元測量へ場面が移る",
  }),
  world_tree_and_recovery: Object.freeze({
    key: "root_pain_moved_markers",
    extraMinutes: 22,
    label: "根の痛みで移された結界標を追い、封印と回復順を新しい根脈図で確かめる",
    summary: "世界樹の痛みが進み、前回の結界標は安全な場所へ移されていた。古い位置へ戻る代わりに、エリナが付け直した根脈標と精霊の退避跡を追い、封印連鎖と回復順を現在の森に合わせて組み直した。",
    sceneTransition: "旧い結界標から、根の痛みに合わせて移設された新しい標識線へ場面が移る",
  }),
  border_truth_and_survival: Object.freeze({
    key: "water_rumor_spread",
    extraMinutes: 20,
    label: "黒嶺水攻めの噂が広がった後の井戸札と配水列を照合し、濡れ衣と避難計画を立て直す",
    summary: "黒嶺の水攻めだという噂は、前回より広い村へ届いていた。消えた証言を探し直すのではなく、井戸札、配水列、荷車の到着刻を同じ紙へ並べ、噂が変えた人の動きごと濡れ衣と生存計画を検証した。",
    sceneTransition: "森入口の噂話から、配水制限が始まった井戸と避難荷車の列へ場面が移る",
  }),
});

const GROUP_REVISITS = Object.freeze({
  growth_source: Object.freeze({
    key: "growth_samples_shifted",
    extraMinutes: 16,
    label: "日陰へ移った粘液層と魚鱗の付着線を採り直し、吸収源の変化を確定する",
    summary: "前回の粘液標本は日差しで性質が変わり、同じ採取では証拠にならなくなっていた。ジルは日陰の石と魚鱗へ残った新しい層を示し、吸収源が水から精霊力へ移る過程を現在の状態で確定した。",
    sceneTransition: "乾いた旧標本から、日陰の河岸石と魚鱗に残る新しい付着層へ場面が移る",
  }),
  safe_separation: Object.freeze({
    key: "pump_line_requisitioned",
    extraMinutes: 24,
    label: "先に徴用された排水輪の代わりに予備部品と旧水路を使い、安全な分離線を再設計する",
    summary: "ミーナの排水輪は渇水対策へ先に徴用され、前回の工程をそのまま使えなかった。残った固定杭、予備歯車、乾いた旧水路を組み合わせ、川と根を傷つけず核を浮かせる別の分離線を設計した。",
    sceneTransition: "空になった装置置場から、予備部品が残る技師区画と乾いた旧水路へ場面が移る",
  }),
  world_tree_seal_chain: Object.freeze({
    key: "seal_rubbings_recovered",
    extraMinutes: 21,
    label: "持ち出された封印原簿の蝋拓と結界石の脈動を照合し、弱体化の連鎖を復元する",
    summary: "封印原簿は混乱を恐れた評議会に持ち出されていた。原簿を同じ棚で探し直すのではなく、残された蝋拓、結界石の脈動、根の裂け目を照合し、世界樹・迷いの結界・地下封印が弱る順番を復元した。",
    sceneTransition: "空の記録棚から、蝋拓の保管箱と脈動する結界石へ場面が移る",
  }),
  core_and_ecosystem_recovery: Object.freeze({
    key: "containment_cage_damaged",
    extraMinutes: 26,
    label: "破損した耐魔籠を冷却針と精霊池の残水で作り直し、核処理後の回復順を更新する",
    summary: "最初の耐魔籠は増えた吸収圧で歪み、同じ試作を持ち出せなくなっていた。ミーナの冷却針、シルフィの精霊池の残水、ネネの水質指標を組み合わせ、核の再接触を防ぐ新しい籠と回復順へ更新した。",
    sceneTransition: "歪んだ試作籠から、冷却針と精霊池の残水を集める再製作場面へ移る",
  }),
  blackridge_water_truth: Object.freeze({
    key: "signed_log_seized",
    extraMinutes: 23,
    label: "押収された黒嶺水路簿の代わりに税関写しと水門摩耗を照合し、水攻め説を崩す",
    summary: "黒嶺の署名入り水路簿は、戦争の証拠だと主張する者に押収されていた。写しを奪い返すだけでなく、税関控え、水門の摩耗、船頭の鐘刻を照合し、放水命令が存在しないことを別の物証線で示した。",
    sceneTransition: "押収済みの水路簿から、税関控えと実際の水門機構を照合する場面へ移る",
  }),
  downstream_survival: Object.freeze({
    key: "evacuation_route_changed",
    extraMinutes: 19,
    label: "噂で変更された給水荷車と避難名簿を追い、取り残された家を含む生存線を引き直す",
    summary: "給水荷車は暴動を避けるため別道へ移り、前回の避難名簿も宿ごとに分割されていた。リオナの新しい車列、ルシアの宿札、井戸の配給札を重ね、取り残された家を含む生存線へ引き直した。",
    sceneTransition: "旧い給水路から、迂回を始めた荷車列と分散した避難宿へ場面が移る",
  }),
});

const LEAD_REVISITS = Object.freeze({
  serie_shadow_chronology: Object.freeze({
    key: "serie_marks_erased",
    extraMinutes: 17,
    label: "消えた河岸線を樹皮傷と橋脚の泥線から復元し、影の成長時刻を取り直す",
    summary: "セリエが河岸へ刻んだ線は粘液に覆われていた。樹皮の傷、橋脚の泥線、夜番の鐘を重ね、失われた観測そのものを復元した。",
  }),
  nieve_flow_pulse_map: Object.freeze({
    key: "nieve_stakes_washed_out",
    extraMinutes: 18,
    label: "流された測量杭の代わりに橋脚の震えと逆流音を測り、水圧脈動図を描き直す",
    summary: "ニーヴの測量杭は流されていた。橋脚の震えと浅瀬の逆流音を時刻ごとに測り、今の流路に合う脈動図へ描き直した。",
  }),
  jill_slime_residue_layers: Object.freeze({
    key: "jill_sample_degraded",
    extraMinutes: 15,
    label: "変質した旧標本を捨て、日陰石と魚鱗の新しい粘液層から吸収対象を判別する",
    summary: "旧標本は乾燥して反応を失っていた。ジルは日陰石と魚鱗へ残った新しい層を採り、吸収対象が変わった時点を判別した。",
  }),
  mina_anchor_pump_design: Object.freeze({
    key: "mina_pump_requisitioned",
    extraMinutes: 25,
    label: "徴用された排水輪の予備歯車と固定杭を回収し、旧水路用の分離装置へ組み替える",
    summary: "排水輪は村の給水へ回されていた。ミーナは予備歯車と固定杭を集め、乾いた旧水路で使える別構成へ組み替えた。",
  }),
  nieve_dry_channel_bypass: Object.freeze({
    key: "dry_channel_collapsed",
    extraMinutes: 22,
    label: "崩れた乾水路の上流口を掘り直し、分裂体を逃がさない迂回流路を確保する",
    summary: "乾水路は粘液の重みで一部崩れていた。ニーヴは上流口と排水溝を掘り直し、分裂体を残さない迂回流路を確保した。",
  }),
  elina_root_diversion_rite: Object.freeze({
    key: "elina_rite_moved",
    extraMinutes: 20,
    label: "裂けた根を避けて移された祭式点を追い、現在の根脈に合わせた分流儀式を組む",
    summary: "前回の祭式点は根の亀裂で使えなくなっていた。エリナが移した標と根の脈動を追い、現在の根脈に合わせて分流儀式を組み直した。",
  }),
  alwen_ancient_seal_record: Object.freeze({
    key: "alwen_record_removed",
    extraMinutes: 21,
    label: "持ち出された古代封印原簿を蝋拓・綴じ糸・石刻の三点から復元する",
    summary: "古代封印原簿は評議会が持ち出していた。蝋拓、綴じ糸の切れ端、結界石の刻字を照合し、欠けた命令順を復元した。",
  }),
  melkia_barrier_seal_coupling: Object.freeze({
    key: "melkia_ledger_altered",
    extraMinutes: 19,
    label: "書き換えられた結界帳を境界石の脈動と保守札で検証し、封印連動を確定する",
    summary: "結界帳には混乱を隠す追記があった。メルキアの保守札と境界石の脈動を照合し、帳面の改変を除いた封印連動を確定した。",
  }),
  elina_world_tree_pain_rhythm: Object.freeze({
    key: "elina_witness_moved",
    extraMinutes: 18,
    label: "避難したエリナを苗床で見つけ、枝鳴りと根の痛みの周期を現在時刻で測り直す",
    summary: "エリナは根元から苗床へ避難していた。枝鳴り、苗の萎れ、根の震えを現在時刻で測り、痛みの周期を更新した。",
  }),
  sylfi_spirit_pool_restoration: Object.freeze({
    key: "spirit_pool_contaminated",
    extraMinutes: 23,
    label: "濁った精霊池を避け、上流泉と残留精霊光から回復に使える水を選別する",
    summary: "精霊池は粘液で濁り、以前の採水点は使えなかった。上流泉と残留精霊光を比べ、回復に使える水だけを選別した。",
  }),
  mina_slime_core_containment: Object.freeze({
    key: "core_cage_cracked",
    extraMinutes: 27,
    label: "ひび割れた耐魔籠を冷却針と二重底で作り直し、核の再接触を防ぐ",
    summary: "耐魔籠は吸収圧でひび割れていた。ミーナは冷却針と二重底を加え、川や根へ触れず核を運べる新しい構造へ作り直した。",
  }),
  nene_recovery_markers: Object.freeze({
    key: "nene_markers_overwritten",
    extraMinutes: 16,
    label: "被害で上書きされた水質標を昆虫・苔・透明度の新しい指標へ置き換える",
    summary: "旧い水質標は被害の進行で意味を失っていた。ネネは昆虫、苔、透明度の三指標を測り直し、回復開始を判定できる線へ更新した。",
  }),
  nieve_blackridge_flow_log: Object.freeze({
    key: "blackridge_log_seized",
    extraMinutes: 24,
    label: "押収された黒嶺水路簿を追わず、税関写しと船頭の鐘刻から流量記録を再構成する",
    summary: "署名入り水路簿は押収されていた。税関写し、船頭の鐘刻、水門の擦れ跡から流量を再構成し、水攻め命令がないことを示した。",
  }),
  yuri_no_dam_trace: Object.freeze({
    key: "dam_trace_washed_away",
    extraMinutes: 18,
    label: "洗い流された足跡の代わりに綱繊維と新しい堆砂を調べ、堰止め工作がないと確かめる",
    summary: "足跡は増水で消えていた。ユリは綱繊維、堆砂、水草の倒れ方を調べ、人為的な堰止め工作がないことを物証で確かめた。",
  }),
  zaid_water_release_record: Object.freeze({
    key: "zaid_record_amended",
    extraMinutes: 20,
    label: "追記された放水記録を鐘番表と水門摩耗へ突き合わせ、実際の開閉時刻を確定する",
    summary: "放水記録には後から書かれた時刻が混じっていた。鐘番表と水門の摩耗を照合し、実際の開閉時刻を確定した。",
  }),
  eda_well_ration_plan: Object.freeze({
    key: "well_ledger_rewritten",
    extraMinutes: 17,
    label: "更新された配水帳を家ごとの札と空樽数へ照合し、取り残しのない給水順を作る",
    summary: "配水帳は混乱の中で書き換えられていた。エダは家札、空樽、介助人数を照合し、取り残しのない給水順へ作り直した。",
  }),
  riona_water_convoy_route: Object.freeze({
    key: "convoy_route_diverted",
    extraMinutes: 21,
    label: "襲撃の噂で迂回した給水荷車を追い、新しい護衛点と受渡時刻を確保する",
    summary: "給水荷車は襲撃の噂で旧道を外れていた。リオナは新しい護衛点と受渡時刻を決め、途中で奪われない給水線を確保した。",
  }),
  lucia_refuge_roster: Object.freeze({
    key: "refugees_redistributed",
    extraMinutes: 19,
    label: "分散した避難者を宿札・炊き出し札・不足名から照合し、家族単位の名簿を作り直す",
    summary: "避難者は複数の宿へ分散し、旧名簿の並びでは見つからなかった。ルシアは宿札、炊き出し札、不足名を照合し、家族単位で名簿を作り直した。",
  }),
});

function array(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(array(values).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function flowFor(runtime, flowId) {
  return runtime?.authoredMissionFlows?.[flowId] ?? null;
}

function freshRevisitState() {
  return {
    version: AUTHORED_MISSION_REVISIT_VERSION,
    consumedChoiceSetSignatures: [],
    revisitOrdinals: {},
    consequences: [],
    pendingLeadConsequences: {},
  };
}

function ensureRevisitState(flow) {
  if (!flow) return null;
  flow.revisitState ??= freshRevisitState();
  const state = flow.revisitState;
  state.version = AUTHORED_MISSION_REVISIT_VERSION;
  state.consumedChoiceSetSignatures = unique(state.consumedChoiceSetSignatures);
  state.revisitOrdinals = state.revisitOrdinals && typeof state.revisitOrdinals === "object"
    ? state.revisitOrdinals
    : {};
  state.consequences = array(state.consequences);
  state.pendingLeadConsequences = state.pendingLeadConsequences
    && typeof state.pendingLeadConsequences === "object"
    ? state.pendingLeadConsequences
    : {};
  return state;
}

function choiceSetSignature(actions) {
  return array(actions)
    .map((action) => String(action?.id ?? "").trim())
    .filter(Boolean)
    .sort()
    .join("|");
}

function shortHash(value) {
  let hash = 2166136261;
  for (const character of String(value ?? "")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36);
}

function actionTargetId(action) {
  return action?.authoredMissionFlowLeadId
    ?? action?.authoredMissionFlowNavigatorGroupId
    ?? action?.authoredMissionFlowNavigatorFocusId
    ?? action?.id
    ?? "unknown";
}

function revisitCopyFor(action) {
  const kind = action?.authoredMissionFlowKind;
  if (kind === "navigator_focus") {
    return FOCUS_REVISITS[action.authoredMissionFlowNavigatorFocusId] ?? null;
  }
  if (kind === "navigator_group") {
    return GROUP_REVISITS[action.authoredMissionFlowNavigatorGroupId] ?? null;
  }
  if (kind === "navigator_route") {
    return LEAD_REVISITS[action.authoredMissionFlowLeadId] ?? null;
  }
  return null;
}

function stageFor(actions) {
  if (actions.some((action) => action?.authoredMissionFlowKind === "navigator_route")) return "route";
  if (actions.some((action) => action?.authoredMissionFlowKind === "navigator_group")) return "group";
  return "focus";
}

function revisitId(signature, ordinal, kind, targetId) {
  return `MISSION_FLOW:${T13_FLOW_ID}:REVISIT:${shortHash(signature)}:${ordinal}:${kind}:${targetId}`;
}

function consequenceVariant(copy, variant) {
  if (variant <= 1) return copy;
  if (variant === 2) {
    return Object.freeze({
      ...copy,
      key: `${copy.key}_npc_copy`,
      extraMinutes: Number(copy.extraMinutes ?? 0) + 8,
      label: `${copy.label}。先に現場へ着いたNPCが持ち出した控えを追う`,
      summary: `${copy.summary} さらに、先に現場へ着いたNPCが原物を保護していたため、その移動先と控えを追って証拠線を繋いだ。`,
      sceneTransition: copy.sceneTransition
        ? `${copy.sceneTransition}。そこから先着したNPCの保管先へ続く`
        : "先に現場へ着いたNPCの保管先へ場面が移る",
    });
  }
  return Object.freeze({
    ...copy,
    key: `${copy.key}_damage_trace`,
    extraMinutes: Number(copy.extraMinutes ?? 0) + 13,
    label: `${copy.label}。失われた原物ではなく、進んだ被害跡から逆算する`,
    summary: `${copy.summary} 原物の一部は既に失われていたため、残った破損、移動跡、周囲の証言から同じ事実を逆算した。`,
    sceneTransition: copy.sceneTransition
      ? `${copy.sceneTransition}。原物が失われた地点から被害跡の追跡へ続く`
      : "原物が失われた地点から、残された被害跡の追跡へ場面が移る",
  });
}

function wrapForwardAction(action, signature, ordinal, variant = 1) {
  const baseCopy = revisitCopyFor(action);
  if (!baseCopy) return null;
  const copy = consequenceVariant(baseCopy, variant);
  const targetId = actionTargetId(action);
  return {
    ...action,
    id: revisitId(signature, ordinal, `${action.authoredMissionFlowKind}_v${variant}`, targetId),
    effectKind: "authored_mission_revisit_consequence",
    minutes: Math.max(1, Number(action.minutes ?? 0)) + Number(copy.extraMinutes ?? 0),
    label: copy.label,
    authoredMissionRevisit: true,
    authoredMissionRevisitKind: "forward",
    authoredMissionRevisitTargetAction: action,
    authoredMissionRevisitConsequence: copy,
    authoredMissionChoiceSetSignature: signature,
    authoredMissionRevisitOrdinal: ordinal,
    authoredMissionRevisitVariant: variant,
  };
}

function focusById(focusId) {
  return array(T13.investigation?.focuses).find((focus) => focus.id === focusId) ?? null;
}

function redirectFocusCandidates(flow, representedFocusIds) {
  const evidenceIds = new Set(array(flow?.evidenceIds));
  return array(T13.investigation?.focuses)
    .filter((focus) => !representedFocusIds.has(focus.id))
    .filter((focus) => array(focus.groups).some((group) =>
      array(group.evidenceIds).some((evidenceId) => !evidenceIds.has(evidenceId))));
}

function makeFocusRedirect(focus, signature, ordinal, slot) {
  const copy = FOCUS_REVISITS[focus.id];
  if (!copy) return null;
  return {
    id: revisitId(signature, ordinal, `redirect_focus_${slot}`, focus.id),
    family: "prepare",
    type: "plan",
    effectKind: "authored_mission_revisit_consequence",
    minutes: Number(copy.extraMinutes ?? 0) + 5 + slot,
    label: `${copy.label}（別の因果線へ場面を移す）`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: T13_FLOW_ID,
    authoredMissionFlowKind: "revisit_focus_redirect",
    authoredMissionFlowNavigatorFocusId: focus.id,
    authoredMissionRevisit: true,
    authoredMissionRevisitKind: "focus_redirect",
    authoredMissionRevisitConsequence: copy,
    authoredMissionChoiceSetSignature: signature,
    authoredMissionRevisitOrdinal: ordinal,
  };
}

function buildRevisitActions(flow, actions, signature) {
  const state = ensureRevisitState(flow);
  const ordinal = Number(state.revisitOrdinals[signature] ?? 0) + 1;
  const stage = stageFor(actions);
  const forwardActions = actions
    .filter((action) => FORWARD_KINDS.has(action?.authoredMissionFlowKind));
  const result = forwardActions
    .map((action) => wrapForwardAction(action, signature, ordinal, 1))
    .filter(Boolean)
    .slice(0, 3);

  const representedFocusIds = new Set(
    actions
      .map((action) => action?.authoredMissionFlowNavigatorFocusId)
      .filter(Boolean),
  );
  if (flow?.navigatorFocusId) representedFocusIds.add(flow.navigatorFocusId);

  const redirects = redirectFocusCandidates(flow, representedFocusIds);
  for (const focus of redirects) {
    if (result.length >= 3) break;
    const redirect = makeFocusRedirect(focus, signature, ordinal, result.length + 1);
    if (redirect) result.push(redirect);
  }

  if (result.length < 3 && forwardActions.length) {
    let variant = 2;
    let cursor = 0;
    while (result.length < 3 && variant <= 3) {
      const source = forwardActions[cursor % forwardActions.length];
      const alternative = wrapForwardAction(source, signature, ordinal, variant);
      if (alternative && !result.some((entry) => entry.id === alternative.id)) {
        result.push(alternative);
      }
      cursor += 1;
      if (cursor % forwardActions.length === 0) variant += 1;
    }
  }

  return result.slice(0, 3).map((action) => ({
    ...action,
    authoredMissionRevisitStage: stage,
  }));
}

function annotateChoiceSet(actions, signature) {
  return actions.map((action) => ({
    ...action,
    authoredMissionChoiceSetSignature: signature,
  }));
}

function consumeSignature(flow, signature) {
  if (!flow || !signature) return false;
  const state = ensureRevisitState(flow);
  if (state.consumedChoiceSetSignatures.includes(signature)) return false;
  state.consumedChoiceSetSignatures.push(signature);
  return true;
}

function currentPlace(runtime) {
  const player = runtime?.playerState ?? {};
  return {
    location: player.currentLocation ?? player.location ?? player.locationName ?? null,
    facilityId: player.currentFacilityId ?? player.facilityId ?? null,
  };
}

function recordRevisitConsequence(runtime, flow, action, copy) {
  const state = ensureRevisitState(flow);
  const signature = action.authoredMissionChoiceSetSignature;
  const ordinal = Number(action.authoredMissionRevisitOrdinal ?? 1);
  state.revisitOrdinals[signature] = Math.max(
    Number(state.revisitOrdinals[signature] ?? 0),
    ordinal,
  );
  const minute = Number(runtime?.playerState?.absoluteMinute ?? 0);
  const place = currentPlace(runtime);
  const record = {
    minute,
    ordinal,
    signature,
    actionId: action.id,
    stage: action.authoredMissionRevisitStage ?? null,
    consequenceKey: copy?.key ?? null,
    targetFocusId: action.authoredMissionFlowNavigatorFocusId ?? null,
    targetGroupId: action.authoredMissionFlowNavigatorGroupId ?? null,
    targetLeadId: action.authoredMissionFlowLeadId ?? null,
    ...place,
  };
  state.consequences.push(record);

  runtime.playerState ??= {};
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags.t13RevisitCount = Number(
    runtime.playerState.worldFlags.t13RevisitCount ?? 0,
  ) + 1;
  if (copy?.key) runtime.playerState.worldFlags[`t13Revisit:${copy.key}`] = true;
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: "AUTHORED_MISSION_REVISIT_CONSEQUENCE",
    ...record,
  });
  return record;
}

function applyFocusRedirect(flow, action) {
  const focusId = action.authoredMissionFlowNavigatorFocusId;
  if (!focusById(focusId)) return false;
  flow.navigatorFocusId = focusId;
  flow.navigatorGroupId = null;
  flow.selectedLeadId = null;
  flow.selectedLeadAtMinute = null;
  flow.deferredUntilMinute = null;
  return true;
}

function pendingLeadConsequence(flow, leadId) {
  const state = ensureRevisitState(flow);
  return state?.pendingLeadConsequences?.[leadId] ?? null;
}

function setPendingLeadConsequence(flow, leadId, action, copy) {
  if (!flow || !leadId || !copy) return;
  const state = ensureRevisitState(flow);
  state.pendingLeadConsequences[leadId] = {
    ordinal: Number(action.authoredMissionRevisitOrdinal ?? 1),
    signature: action.authoredMissionChoiceSetSignature,
    consequenceKey: copy.key,
    extraMinutes: Math.max(8, Math.round(Number(copy.extraMinutes ?? 0) / 2)),
    label: copy.label,
    summary: copy.summary,
    sceneTransition: copy.sceneTransition ?? null,
  };
}

function clearPendingLeadConsequence(flow, leadId) {
  const state = ensureRevisitState(flow);
  if (state?.pendingLeadConsequences) delete state.pendingLeadConsequences[leadId];
}

export function ensureAuthoredMissionFlowState(runtime, pack) {
  const flow = base.ensureAuthoredMissionFlowState(runtime, pack);
  if (pack?.id === T13_FLOW_ID) ensureRevisitState(flow);
  return flow;
}

export function initializeAuthoredMissionFlowForMission(runtime, missionId) {
  const flow = base.initializeAuthoredMissionFlowForMission(runtime, missionId);
  if (flow?.flowId === T13_FLOW_ID) ensureRevisitState(flow);
  return flow;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const actions = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (!Array.isArray(actions) || actions.length !== 3) return actions;
  const flowId = actions.find((action) => action?.authoredMissionFlowId)?.authoredMissionFlowId;
  if (flowId !== T13_FLOW_ID) return actions;
  const flow = flowFor(runtime, flowId);
  if (!flow) return actions;
  const state = ensureRevisitState(flow);
  const signature = choiceSetSignature(actions);
  if (!signature) return actions;
  if (!state.consumedChoiceSetSignatures.includes(signature)) {
    return annotateChoiceSet(actions, signature);
  }
  return buildRevisitActions(flow, actions, signature);
}

export function authoredMissionFlowEvidenceAction(runtime) {
  const action = base.authoredMissionFlowEvidenceAction(runtime);
  if (!action || action.authoredMissionFlowId !== T13_FLOW_ID) return action;
  const flow = flowFor(runtime, T13_FLOW_ID);
  const leadId = action.authoredMissionFlowLeadId ?? flow?.selectedLeadId;
  const pending = pendingLeadConsequence(flow, leadId);
  if (!pending) return action;
  return {
    ...action,
    id: `${action.id}:REVISIT:${pending.ordinal}:${pending.consequenceKey}`,
    effectKind: "authored_mission_revisit_evidence",
    minutes: Math.max(1, Number(action.minutes ?? 0)) + Number(pending.extraMinutes ?? 0),
    label: `${pending.label}。移動・改変後の記録を現地で証拠として固定する`,
    authoredMissionRevisit: true,
    authoredMissionRevisitKind: "evidence",
    authoredMissionRevisitTargetAction: action,
    authoredMissionRevisitEvidenceLeadId: leadId,
    authoredMissionRevisitConsequence: pending,
  };
}

export function authoredMissionFlowGuidance(runtime) {
  const guidance = base.authoredMissionFlowGuidance(runtime);
  const flow = flowFor(runtime, T13_FLOW_ID);
  const pending = pendingLeadConsequence(flow, flow?.selectedLeadId);
  if (!guidance || guidance.missionId !== T13.missionId || !pending) return guidance;
  return {
    ...guidance,
    kicker: "再訪後・証拠はもう同じ場所にない",
    title: pending.label,
    detail: `${pending.summary} 元の場面へ戻るのではなく、移動・改変後の記録を現在の世界状態で証拠化する。`,
  };
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const flow = flowFor(runtime, action?.authoredMissionFlowId);
  if (!flow || action?.authoredMissionFlowId !== T13_FLOW_ID) {
    return base.applyAuthoredMissionFlowAction(runtime, action, result);
  }

  if (action.authoredMissionRevisitKind === "evidence") {
    const target = action.authoredMissionRevisitTargetAction;
    const changed = target ? base.applyAuthoredMissionFlowAction(runtime, target, result) : false;
    const copy = action.authoredMissionRevisitConsequence;
    if (result?.ok !== false) {
      clearPendingLeadConsequence(flow, action.authoredMissionRevisitEvidenceLeadId);
      result.summary = `${copy?.summary ?? "移動した証拠線を追い直した。"} 現地の記録・人物・物証を照合し、再訪後の状態を正式な証拠として固定した。`;
      if (copy?.sceneTransition) result.sceneTransition ??= copy.sceneTransition;
    }
    return changed;
  }

  if (action.authoredMissionRevisit) {
    const copy = action.authoredMissionRevisitConsequence;
    let changed = false;
    if (action.authoredMissionRevisitTargetAction) {
      changed = base.applyAuthoredMissionFlowAction(
        runtime,
        action.authoredMissionRevisitTargetAction,
        result,
      );
    } else if (action.authoredMissionRevisitKind === "focus_redirect") {
      changed = applyFocusRedirect(flow, action);
    }
    if (result?.ok !== false) {
      recordRevisitConsequence(runtime, flow, action, copy);
      if (action.authoredMissionFlowKind === "navigator_route") {
        setPendingLeadConsequence(flow, action.authoredMissionFlowLeadId, action, copy);
      }
      result.summary = copy?.summary
        ?? "前回の選択後に世界が動いたため、同じ三択へ戻らず、変化した証拠線から調査を続けた。";
      if (copy?.sceneTransition) result.sceneTransition ??= copy.sceneTransition;
    }
    return changed || result?.ok !== false;
  }

  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  if (result?.ok !== false) {
    consumeSignature(flow, action.authoredMissionChoiceSetSignature);
  }
  return changed;
}

export const AUTHORED_MISSION_REVISIT_INTERNALS = Object.freeze({
  freshRevisitState,
  ensureRevisitState,
  choiceSetSignature,
  shortHash,
  revisitCopyFor,
  stageFor,
  consequenceVariant,
  wrapForwardAction,
  redirectFocusCandidates,
  makeFocusRedirect,
  buildRevisitActions,
  annotateChoiceSet,
  consumeSignature,
  recordRevisitConsequence,
  applyFocusRedirect,
  pendingLeadConsequence,
  setPendingLeadConsequence,
  clearPendingLeadConsequence,
  FOCUS_REVISITS,
  GROUP_REVISITS,
  LEAD_REVISITS,
  FORWARD_KINDS,
  CONTROL_KINDS,
});
