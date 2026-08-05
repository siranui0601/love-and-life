import * as previous from "./authored-mission-flow-t11-witness-network-entry.js";
export * from "./authored-mission-flow-t11-witness-network-entry.js";

export const AUTHORED_HUMAN_ROUTE_T04_PILGRIM_RELAY_VERSION = "authored-human-route-t04-pilgrim-relay-v1";

const FLOW_ID = "pilgrim-transfer-disappearance";
const MISSION_ID = "MSN-T04";
const STATE_KEY = "humanT04PilgrimRelay";
const TERMINAL_SUCCESS = new Set(["completed", "resolved", "terminal"]);
const TERMINAL_ANY = new Set(["completed", "resolved", "terminal", "failed", "abandoned"]);
const NPC = Object.freeze({ finn: "NPC001", garo: "NPC003", falco: "NPC053", jill: "NPC060" });
const FAC = Object.freeze({ farmEdge: "LOC_FARM_EDGE", borderShrine: "LOC_BORDER_SMALL_SHRINE", templeEntrance: "LOC_TEMPLE_ENTRANCE", templeRest: "LOC_TEMPLE_REST", templeAdmin: "LOC_TEMPLE_ADMIN" });

export const HUMAN_COMPANION_AUTHORING_SPINE = Object.freeze([
  { phase: 1, days: "1-20", troubles: ["T01", "T02", "T03"], goal: "村の救助・食料・森の安全" },
  { phase: 2, days: "12-41", troubles: ["T04", "T17"], goal: "巡礼者救助と第二召喚の危険証明" },
  { phase: 3, days: "15-38", troubles: ["T05", "T07", "T14"], goal: "毒殺・人身売買・武器流通の証人保護" },
  { phase: 4, days: "24-49", troubles: ["T06", "T09", "T10", "T11", "T12"], goal: "港・鉱山・孤児院・王都・北陵の相互支援" },
  { phase: 5, days: "30-60", troubles: ["T08", "T13"], goal: "エルフとの信頼と世界樹倒壊予防" },
  { phase: 6, days: "55-72", troubles: ["T15"], goal: "交易都市の成功結果で外国介入を防ぐ" },
  { phase: 7, days: "62-90", troubles: ["T16", "T18", "T19"], goal: "排斥鎮静と巨神兵・侵攻の救済または予防" },
].map(Object.freeze));

const START = Object.freeze([
  Object.freeze({ id: "join_caravan", label: "巡礼便に加わる", family: "logistics", actor: NPC.garo, minutes: 180, location: "古代神殿", facility: FAC.templeEntrance, stage: 1, flag: "t04Relay:caravanJoined", history: "T04_RELAY_CARAVAN_JOINED", summary: "失踪者名簿と食料箱を積んだ巡礼便へ加わり、三時間の荒野道を歩いた。古代神殿の門前では、帰らない家族と新しい巡礼者が同じ列に並んでいる。", speech: "村の見張りは俺たちが続ける。お前は神殿へ行け。消えた者を、もういないと決めつけるな。" }),
  Object.freeze({ id: "visit_family", label: "失踪者の家族を訪ねる", family: "social", actor: NPC.finn, minutes: 210, location: "辺境の村", facility: FAC.borderShrine, stage: 9, flag: "t04Relay:familyVisited", history: "T04_RELAY_FAMILY_VISITED", evidence: "T04-EVIDENCE-EDA-DIARY-GLYPH", source: "LOC_BORDER_SMALL_SHRINE:EIDA_DIARY_COPY", canonical: true, summary: "辺境の村の小祠で、失踪者エイダの姉から日記を預かった。最後の頁には、白石回廊で足元を囲んだ光の印が描かれている。", speech: "ぼくがいなくなった時、母さんも待つしかなかった。先に家族へ会って、覚えていることを全部聞いてあげて。" }),
  Object.freeze({ id: "take_watch", label: "村の見張りを引き継ぐ", family: "living", actor: NPC.jill, minutes: 45, location: "田園の村", facility: FAC.farmEdge, stage: 9, flag: "t04Relay:villageWatchTaken", history: "T04_RELAY_VILLAGE_WATCH_TAKEN", summary: "ジルが神殿へ知らせを運ぶ間、森際の見張りを引き受けた。村は止まらず、ジルは三時間後に白石回廊の報告を送り返す計画へ移った。", speech: "俺が神殿まで走る。ここは頼む。返事を待ち続けず、必要なら自分で追って来い。" }),
]);

const ARRIVAL = Object.freeze([
  Object.freeze({ id: "carry_rolls", label: "名簿を管理棟へ運ぶ", family: "logistics", actor: NPC.falco, minutes: 24, facility: FAC.templeAdmin, flag: "t04Relay:rollsDelivered", history: "T04_RELAY_ROLLS_DELIVERED", summary: "巡礼団名簿を管理棟へ運ぶと、ファルコは公開用の宿帳ではなく、失踪日ごとに別綴じされた内部記録を机へ出した。", speech: "名簿まで持って来たなら、旅程の遅れではごまかせんな。記録を隠した責任から逃げはしない。" }),
  Object.freeze({ id: "serve_water", label: "巡礼者へ水を配る", family: "living", actor: NPC.falco, minutes: 32, facility: FAC.templeRest, flag: "t04Relay:waterServed", history: "T04_RELAY_WATER_SERVED", evidence: "T04-EVIDENCE-PILGRIM-CARAVAN-HEADCOUNT", source: "LOC_TEMPLE_REST:ARRIVAL_WATER_LEDGER", summary: "水を配りながら到着人数と空いた寝台を数えた。三つの巡礼団で、列の中央にいた者だけが一人ずつ欠けている。", speech: "水を受け取る時は列が崩れる。だが消えた三人は、休憩所へ着く前からいなかった。" }),
  Object.freeze({ id: "count_bells", label: "鈴と荷車を数える", family: "observation", actor: NPC.jill, minutes: 27, facility: FAC.templeEntrance, flag: "t04Relay:bellsCounted", history: "T04_RELAY_BELLS_COUNTED", evidence: "T04-EVIDENCE-TEMPLE-ROAD-ARRIVAL-GAPS", source: "LOC_TEMPLE_ENTRANCE:CARAVAN_BELL_COUNT", summary: "荷車の鈴を到着順に数えると、行きの記録より帰りが三つ少なく、失踪のあった巡礼団と一致した。", speech: "人の記憶は混ざるが、鈴は勝手に嘘をつかない。三つ足りない。" }),
]);

const FALCO = Object.freeze({
  disappearance_pattern: { label: "列順を聞く", family: "observation", speech: "全員、白石回廊の第三曲がりだ。列の中央にいた者だけが消え、前後の者は振り返るまで気づかなかった。" },
  concealed_reports: { label: "隠蔽を問いただす", family: "diplomacy", speech: "神殿を閉じれば辺境の村の宿も店も倒れる。それを恐れて内部記録へ留め、失踪者を増やした。" },
  day1_anomaly: { label: "Day1の異常を聞く", family: "observation", speech: "Day1の夜から回廊の文字が光り、床下で歯車のような音がした。召喚との関係を認めたくなかった。" },
});

const arr = (v) => Array.isArray(v) ? v : [];
const player = (r) => (r.playerState ??= {}, r.playerState.player ??= {}, r.playerState.player);
const minute = (r) => Number(r?.playerState?.absoluteMinute ?? 0);
const mission = (r, id) => Array.isArray(r?.playerState?.missions) ? r.playerState.missions.find((m) => m?.id === id) : r?.playerState?.missions?.[id];
const status = (v) => String(v?.status ?? v ?? "");

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= { version: AUTHORED_HUMAN_ROUTE_T04_PILGRIM_RELAY_VERSION, stage: 0, selected: [], closed: {}, completedAtMinute: null };
  const s = runtime.playerState[STATE_KEY];
  s.version = AUTHORED_HUMAN_ROUTE_T04_PILGRIM_RELAY_VERSION;
  s.selected = arr(s.selected).map(String);
  s.closed = s.closed && typeof s.closed === "object" ? s.closed : {};
  return s;
}

function t03Resolved(runtime) {
  return TERMINAL_SUCCESS.has(status(mission(runtime, "MSN-T03"))) || TERMINAL_SUCCESS.has(status(runtime?.playerState?.troubles?.T03));
}

function t04Available(runtime) {
  const m = mission(runtime, MISSION_ID);
  const t = runtime?.playerState?.troubles?.T04;
  if (!m && t == null) return false;
  return !TERMINAL_ANY.has(status(m)) && !TERMINAL_ANY.has(status(t));
}

function npcAlive(runtime, id) {
  const s = runtime?.livingWorld?.npcStates?.[id];
  return !s || !["dead", "missing", "captured"].includes(String(s.lifeStatus ?? s.presence ?? ""));
}

function initialEligible(runtime) {
  const s = ensureState(runtime);
  const d = Number(runtime?.playerState?.day ?? Math.floor(minute(runtime) / 1440) + 1);
  return s.stage === 0 && d >= 12 && t03Resolved(runtime) && t04Available(runtime)
    && ["田園の村", "森"].includes(player(runtime).location)
    && Object.values(NPC).every((id) => npcAlive(runtime, id));
}

function weather(runtime) {
  return String(runtime?.playerState?.weather?.condition ?? runtime?.weather?.condition ?? "clear").toLowerCase();
}

function travelMinutes(runtime, base) {
  const w = weather(runtime);
  if (/storm|豪雨|嵐|吹雪/u.test(w)) return base + Math.max(20, Math.round(base / 3));
  if (/rain|snow|雨|雪/u.test(w)) return base + Math.max(10, Math.round(base / 6));
  return base;
}

function collections(runtime) {
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  runtime.playerState.goapRequests ??= {};
}

function addEvidence(runtime, id, source, canonical = false) {
  if (!id) return;
  collections(runtime);
  runtime.playerState.evidence[id] = { id, source, acquiredAtMinute: minute(runtime), missionId: MISSION_ID };
  if (!canonical) return;
  runtime.authoredMissionFlows ??= {};
  runtime.authoredMissionFlows[FLOW_ID] ??= { evidenceIds: [] };
  runtime.authoredMissionFlows[FLOW_ID].evidenceIds = [...new Set([...arr(runtime.authoredMissionFlows[FLOW_ID].evidenceIds), id])];
  const m = mission(runtime, MISSION_ID);
  if (m) {
    m.discoveries = arr(m.discoveries);
    if (!m.discoveries.some((e) => e?.id === id)) m.discoveries.push({ id, source, acquiredAtMinute: minute(runtime) });
  }
}

function addGoap(runtime, id, actorNpcId, goal, location, facility, state = "active") {
  collections(runtime);
  runtime.playerState.goapRequests[id] = { id, actorNpcId, goal, destination: location, targetFacilityId: facility, status: state, createdAtMinute: minute(runtime) };
}

const actionId = (scene, id) => `MISSION_FLOW:T04:HUMAN_SPINE:${scene}:${id}`;
const closed = (scene, choices, selected) => choices.map((c) => actionId(scene, c.id)).filter((id) => id !== selected);

function action(runtime, scene, choice) {
  const moving = choice.location && choice.location !== player(runtime).location;
  return {
    id: actionId(scene, choice.id), actionId: actionId(scene, choice.id), label: choice.label,
    type: moving ? "plan" : "conversation", family: choice.family, missionId: MISSION_ID,
    troubleId: "T04", stepId: "hear", targetLocation: choice.location,
    targetFacilityId: choice.facility, targetNpcId: choice.actor,
    minutes: moving ? travelMinutes(runtime, choice.minutes) : choice.minutes,
    authoredHumanT04RelayChoice: true, relayScene: scene, relayChoice: choice.id,
  };
}

function ownActions(runtime) {
  const s = ensureState(runtime);
  if (initialEligible(runtime)) return START.map((c) => action(runtime, "village", c));
  if (s.stage === 1 && player(runtime).location === "古代神殿" && player(runtime).facilityId === FAC.templeEntrance) {
    return ARRIVAL.map((c) => action(runtime, "arrival", c));
  }
  return null;
}

function record(runtime, scene, actionValue, choice, s) {
  collections(runtime);
  runtime.playerState.history.push({ type: choice.history, minute: minute(runtime), missionId: MISSION_ID, troubleId: "T04", sceneId: scene, actionId: actionValue.id, closedActionIds: [...s.closed[scene]], location: player(runtime).location, facilityId: player(runtime).facilityId, weather: weather(runtime) });
}

function consumeOwn(runtime, actionValue, result) {
  if (result?.ok === false || !actionValue?.authoredHumanT04RelayChoice) return false;
  const s = ensureState(runtime);
  const choices = actionValue.relayScene === "village" ? START : actionValue.relayScene === "arrival" ? ARRIVAL : null;
  const choice = choices?.find((c) => c.id === actionValue.relayChoice);
  if (!choice) return false;
  collections(runtime);
  player(runtime).location = choice.location ?? player(runtime).location;
  player(runtime).facilityId = choice.facility ?? player(runtime).facilityId;
  s.stage = choice.stage ?? 2;
  s.selected.push(actionValue.id);
  s.closed[actionValue.relayScene] = closed(actionValue.relayScene, choices, actionValue.id);
  runtime.playerState.worldFlags[choice.flag] = true;
  addEvidence(runtime, choice.evidence, choice.source, choice.canonical);
  if (choice.id === "join_caravan") {
    addGoap(runtime, "GOAP-T04-GARO-VILLAGE-WATCH", NPC.garo, "maintain_village_watch_without_player", "田園の村", FAC.farmEdge);
    addGoap(runtime, "GOAP-T04-JILL-PILGRIM-ROAD", NPC.jill, "escort_pilgrims_then_hold_temple_gate", "古代神殿", FAC.templeEntrance);
    addGoap(runtime, "GOAP-T04-FINN-RETURN-MAP", NPC.finn, "copy_safe_return_marks", "田園の村", "LOC_FARM_SQUARE");
  } else if (choice.id === "take_watch") {
    addGoap(runtime, "GOAP-T04-JILL-TEMPLE-REPORT", NPC.jill, "deliver_missing_pilgrim_report", "古代神殿", FAC.templeEntrance, "scheduled");
    addGoap(runtime, "GOAP-T04-GARO-WATCH-ROSTER", NPC.garo, "run_watch_roster", "田園の村", FAC.farmEdge);
  } else if (actionValue.relayScene === "arrival") {
    addGoap(runtime, `GOAP-T04-FALCO-${choice.id.toUpperCase()}`, NPC.falco, "prepare_internal_missing_records", "古代神殿", FAC.templeAdmin);
    addGoap(runtime, "GOAP-T04-JILL-HOLD-PILGRIMS", NPC.jill, "hold_new_pilgrims_outside_white_corridor", "古代神殿", FAC.templeEntrance);
  }
  record(runtime, actionValue.relayScene === "village" ? "t03-t04-village-notice" : "t04-pilgrim-caravan-arrival", actionValue, choice, s);
  result.summary = choice.summary;
  result.speeches = [{ actorId: choice.actor, text: choice.speech, emotion: "自分の役割へ戻りながら" }];
  result.closedActionIds = [...s.closed[actionValue.relayScene]];
  result.sceneTransition = choice.stage === 1 ? "t04-pilgrim-caravan-arrival" : choice.id === "carry_rolls" ? "t04-falco-first-hearing" : "t04-free-travel";
  return true;
}

function baseOpenings(runtime, context) {
  const a = previous.authoredMissionFlowExclusiveActions(runtime, context);
  return Array.isArray(a) && a.length === 3 && a.every((x) => x?.authoredMissionFlowId === FLOW_ID && x?.authoredMissionFlowKind === "opening") ? a : null;
}

function proxyOpenings(runtime, context) {
  const s = ensureState(runtime);
  if (s.stage !== 2 || player(runtime).location !== "古代神殿" || player(runtime).facilityId !== FAC.templeAdmin) return null;
  const base = baseOpenings(runtime, context);
  if (!base) return null;
  return base.map((original) => {
    const cid = original.authoredMissionFlowChoiceId;
    const short = FALCO[cid];
    if (!short) return original;
    const id = actionId("falco", cid);
    return { ...original, id, actionId: id, label: short.label, family: short.family, authoredHumanT04FalcoProxy: true, proxyChoice: cid };
  });
}

function consumeProxy(runtime, actionValue, result, context = {}) {
  if (result?.ok === false || !actionValue?.authoredHumanT04FalcoProxy) return false;
  const s = ensureState(runtime);
  const base = baseOpenings(runtime, context);
  const original = base?.find((x) => x.authoredMissionFlowChoiceId === actionValue.proxyChoice);
  if (!original || !previous.applyAuthoredMissionFlowAction(runtime, original, result)) return false;
  const id = actionId("falco", actionValue.proxyChoice);
  s.stage = 3;
  s.completedAtMinute = minute(runtime);
  s.selected.push(id);
  s.closed.falco = Object.keys(FALCO).map((cid) => actionId("falco", cid)).filter((x) => x !== id);
  collections(runtime);
  runtime.playerState.worldFlags["t04Relay:falcoHearingCompleted"] = true;
  runtime.playerState.history.push({ type: "T04_RELAY_FALCO_HEARING", minute: minute(runtime), missionId: MISSION_ID, troubleId: "T04", sceneId: "t04-falco-first-hearing", actionId: id, originalActionId: original.id, openingChoiceId: actionValue.proxyChoice, closedActionIds: [...s.closed.falco] });
  result.speeches = [{ actorId: NPC.falco, text: FALCO[actionValue.proxyChoice].speech, emotion: "保身を捨てて記録を開く" }];
  result.sceneTransition = `t04-investigation-${actionValue.proxyChoice}`;
  result.closedActionIds = [...s.closed.falco];
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return ownActions(runtime) ?? proxyOpenings(runtime, context) ?? previous.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  const s = ensureState(runtime);
  if (initialEligible(runtime)) return { missionId: MISSION_ID, kicker: "村の掲示板へ三枚目の失踪届が貼られた。", title: "帰らない巡礼者", detail: "巡礼便、待つ家族、村の見張りは同時に動いている。どこから失踪へ関わるかを決める。", targetLocation: player(runtime).location, targetFacilityId: player(runtime).facilityId, actionPanel: null };
  if (s.stage === 1 && player(runtime).facilityId === FAC.templeEntrance) return { missionId: MISSION_ID, kicker: "古代神殿の門前", title: "到着した者と帰らない者", detail: "名簿を運ぶ、水を配る、鈴を数える。生活を支えながら失踪の共通点を記録へ変える。", targetLocation: "古代神殿", targetFacilityId: FAC.templeEntrance, actionPanel: null };
  if (s.stage === 2 && player(runtime).facilityId === FAC.templeAdmin) return { missionId: MISSION_ID, kicker: "管理棟の内部記録", title: "ファルコが隠した三つの事実", detail: "列順、隠蔽、Day1からの異常。短い問いから正式なT04調査へ入る。", targetLocation: "古代神殿", targetFacilityId: FAC.templeAdmin, actionPanel: null };
  return previous.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, actionValue, result) {
  return consumeOwn(runtime, actionValue, result) || consumeProxy(runtime, actionValue, result) || previous.applyAuthoredMissionFlowAction(runtime, actionValue, result);
}

export const AUTHORED_HUMAN_ROUTE_T04_PILGRIM_RELAY_INTERNALS = Object.freeze({ FLOW_ID, STATE_KEY, START, ARRIVAL, FALCO, ensureState, t03Resolved, t04Available, initialEligible, travelMinutes, ownActions, proxyOpenings, consumeOwn, consumeProxy });