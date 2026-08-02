import * as base from "./authored-mission-t03-investigation-contract.js";

export * from "./authored-mission-t03-investigation-contract.js";

export const AUTHORED_WEATHER_AMBIENT_CONTINUITY_VERSION = "authored-weather-ambient-continuity-v1";

const FLOW_ID = "AMBIENT-WEATHER";
const BRANCH_IDS = Object.freeze(["talk", "help", "observe"]);

const WEATHER_SCENES = Object.freeze({
  clear: Object.freeze({
    title: "晴れ間で町の動きが早まった",
    talk: "この晴れ間で人や荷物の流れがどう変わったか",
    disclosure: "晴れているうちに外仕事と移動を済ませようとする者が増え、普段と違う人の流れが生まれている",
    help: "日差しが強くなる前に、水桶と日除けを必要な場所へ回す",
    observe: "影の伸び方と人の流れを見比べ、次に混み合う場所を読む",
    helpSummary: "晴れ間をただ眺めず、水桶と日除けを先に回した。後から来た人々は同じ準備をやり直さずに済み、この場所の暑さへの備えが一段進んだ。",
    observeSummary: "影の伸び方、人の足取り、荷車の向きを重ね、晴れ間のうちに混み合う場所を読んだ。同じ景色は次の時間帯には残らない。",
  }),
  cloudy: Object.freeze({
    title: "曇り空を見て人々が雨支度を始めた",
    talk: "まだ降っていないのに、なぜ店や旅人が雨支度を急いでいるのか",
    disclosure: "雲の低さと風向きから近いうちに降ると見て、露店や荷運びの順番を前倒ししている",
    help: "雨が来る前に、露店の布と荷札を固定して回る",
    observe: "雲底、風向き、鳥の飛び方から、雨が先に来る方角を絞る",
    helpSummary: "まだ降っていないうちに布と荷札を固定した。選ばなかった聞き込みと観天の機会は過ぎ、町には準備を終えた一角だけが残った。",
    observeSummary: "雲底、風向き、鳥の高度を重ね、雨が先に来る方角を絞った。曇り空そのものではなく、次に変わる場所を手掛かりにした。",
  }),
  light_rain: Object.freeze({
    title: "小雨が人の足取りと話し声を近づけた",
    talk: "小雨で客足や道の使われ方がどう変わったか",
    disclosure: "遠回りを避けて軒下や石畳へ人が集まり、普段は交わらない者同士の話が近い距離で聞こえている",
    help: "濡れやすい荷物を軒下へ移し、通り道を塞がないよう並べ直す",
    observe: "雨粒で薄れる足跡のうち、今しか残らない向きと深さを読む",
    helpSummary: "濡れやすい荷物を軒下へ移し、通り道を開けた。雨が強くなってから同じ荷を救う機会はなく、この配置が次の人の動きを変える。",
    observeSummary: "薄れ始めた足跡から、雨の前後で混ざっていない跡だけを拾った。次に戻る時には消えている一度きりの観察になった。",
  }),
  rain: Object.freeze({
    title: "雨が痕跡を消し、屋根の下へ噂を集めた",
    talk: "雨宿りに集まった人々が、今どの出来事を話しているか",
    disclosure: "雨で移動を止めた者たちが同じ軒下に集まり、別々の場所で見た出来事をつなぎ始めている",
    help: "流れ込む雨水を逃がし、濡れた荷と乾いた荷を分ける",
    observe: "消えかけた泥跡と雨だれの切れ目から、雨が降る前の動きを復元する",
    helpSummary: "雨水の逃げ道を作り、濡れた荷と乾いた荷を分けた。手を付けなかった聞き込みと痕跡は雨に流され、選んだ作業だけが町の状態として残った。",
    observeSummary: "泥跡そのものではなく、雨だれの切れ目と濡れ方の差から降雨前の動きを復元した。同じ痕跡を後で見直すことはできない。",
  }),
  fog: Object.freeze({
    title: "霧が道と人影を切り離した",
    talk: "霧の中で見失った人や、聞こえた呼び声について",
    disclosure: "姿は見えなくても、鐘、荷車の音、呼び声の順番から、誰がどちらへ進んだかを覚えている者がいる",
    help: "見通しの悪い分岐に灯りと呼び声の役を置く",
    observe: "足音、匂い、濡れた石の向きから、霧の中を通った経路を分ける",
    helpSummary: "分岐に灯りと呼び声の役を置き、迷う人を一方へ導いた。別の道を選んだ者の行方までは追えず、霧の中で枝が分かれた。",
    observeSummary: "姿を追わず、足音、匂い、石の濡れ方から複数の経路を分けた。霧が晴れれば失われる一時的な差を記録した。",
  }),
  strong_wind: Object.freeze({
    title: "強風が掲示と荷物の行き先を変えた",
    talk: "風で飛ばされた札や噂が、どこまで届いたか",
    disclosure: "元の掲示場所ではなく風下で札を拾った者が多く、情報の伝わる順番が普段と逆になっている",
    help: "屋根布と荷車を固定し、飛ばされた札を内容ごとに分ける",
    observe: "風下に集まった紙片と埃から、誰が先に通ったかを読む",
    helpSummary: "屋根布と荷車を固定し、飛ばされた札を分けた。拾われなかった紙片はさらに遠くへ流れ、町に残る情報の形が変わった。",
    observeSummary: "風下の紙片、埃、足元の重なりから通行順を読んだ。風向きが変われば成立しない、その時だけの手掛かりだった。",
  }),
  snow: Object.freeze({
    title: "雪が足跡を刻み、移動できる時間を狭めた",
    talk: "雪で遅れている人や、戻ってこない荷について",
    disclosure: "普段より早く道を閉じる判断が出ており、まだ戻らない者の名前と最後に見た場所が共有され始めている",
    help: "入口と火の周りを雪かきし、戻る人のための目印を残す",
    observe: "新しい足跡と埋まりかけた足跡を分け、戻っていない者の方向を絞る",
    helpSummary: "入口と火の周りを開け、帰路の目印を残した。雪は選ばなかった足跡を埋め続け、救援の優先順位が固定された。",
    observeSummary: "足跡の縁、積雪、重なり方から新旧を分け、まだ戻っていない者の方向を絞った。次の降雪で消える前の一度きりの記録になった。",
  }),
  storm: Object.freeze({
    title: "雷雨が避難と火の管理を同時に迫った",
    talk: "雷雨の前に避難した人と、まだ残っている人について",
    disclosure: "雷鳴の間隔が短くなる前に避難した者と、火や家畜を守るため残った者が分かれている",
    help: "戸締り、排水、火の始末を分担し、危険な一角を閉じる",
    observe: "雷鳴の間隔と水の増え方から、次に危険になる場所を読む",
    helpSummary: "戸締り、排水、火の始末を分担し、危険な一角を閉じた。開けたままにした経路は使えなくなり、避難の流れが一つに絞られた。",
    observeSummary: "雷鳴の間隔と水位の上がり方を重ね、次に危険になる場所を読んだ。雷雨が去れば再現できない短い判断窓だった。",
  }),
  dry_wind: Object.freeze({
    title: "乾いた風が井戸と火の扱いを変えた",
    talk: "水と火の番を、今日は誰が引き受けているか",
    disclosure: "乾いた風の日は小さな火でも広がるため、井戸番と火の見回りを普段より早く交代している",
    help: "火種を遠ざけ、水桶と濡れ布を要所へ置く",
    observe: "乾いた草、灰、風下の匂いから、火の危険が高い場所を絞る",
    helpSummary: "火種を遠ざけ、水桶と濡れ布を要所へ置いた。選ばなかった見回り先には同じ備えが届かず、町の防火線に差が生まれた。",
    observeSummary: "草の乾き、灰、風下の匂いから危険な場所を絞った。風向きが変わる前にだけ成立する判断だった。",
  }),
});

function array(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value ?? "").trim();
}

function stableHash32(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function freshWeatherAmbientState() {
  return {
    version: AUTHORED_WEATHER_AMBIENT_CONTINUITY_VERSION,
    consumedSceneKeys: [],
    selectedBranchIds: [],
    closedBranchIds: [],
    npcMemories: {},
    locationMemories: {},
    weatherCounts: {},
    branchCounts: {},
  };
}

function ensureWeatherAmbientState(runtime) {
  const playerState = runtime?.playerState;
  if (!playerState) return null;
  playerState.weatherAmbientContinuity ??= freshWeatherAmbientState();
  const state = playerState.weatherAmbientContinuity;
  state.version = AUTHORED_WEATHER_AMBIENT_CONTINUITY_VERSION;
  state.consumedSceneKeys = array(state.consumedSceneKeys).map(String);
  state.selectedBranchIds = array(state.selectedBranchIds).map(String);
  state.closedBranchIds = array(state.closedBranchIds).map(String);
  state.npcMemories = state.npcMemories && typeof state.npcMemories === "object" ? state.npcMemories : {};
  state.locationMemories = state.locationMemories && typeof state.locationMemories === "object" ? state.locationMemories : {};
  state.weatherCounts = state.weatherCounts && typeof state.weatherCounts === "object" ? state.weatherCounts : {};
  state.branchCounts = state.branchCounts && typeof state.branchCounts === "object" ? state.branchCounts : {};
  state.pendingSceneKey = clean(state.pendingSceneKey) || null;
  state.pendingFacilityId = clean(state.pendingFacilityId) || null;
  state.promptedSceneKeys = array(state.promptedSceneKeys).map(String);
  return state;
}

function currentWeather(runtime) {
  const weather = runtime?.playerState?.weather;
  if (!weather?.id) return null;
  return {
    id: clean(weather.id),
    label: clean(weather.label) || clean(weather.id),
    tags: array(weather.tags).map(String),
  };
}

function currentPlace(runtime) {
  const state = runtime?.playerState ?? {};
  const player = state.player ?? {};
  return {
    day: Math.max(1, Number(state.day ?? 1)),
    daypart: clean(state.daypart) || "day",
    location: clean(player.location) || "UNKNOWN",
    facilityId: clean(player.facilityId) || "UNKNOWN",
  };
}

function sceneKey(runtime) {
  const place = currentPlace(runtime);
  return `day:${place.day}|location:${place.location}`;
}

function sceneToken(runtime, weather) {
  const place = currentPlace(runtime);
  return stableHash32(`${sceneKey(runtime)}|${place.daypart}|${place.facilityId}|${weather.id}`).toString(16).padStart(8, "0");
}

function tutorialAllowsAmbient(runtime) {
  return !runtime?.tutorial || runtime.tutorial.stage === "free" || runtime.tutorial.complete === true;
}

function weatherAmbientEligible(runtime) {
  if (!runtime?.playerState || runtime.pendingBattle?.session?.status === "active") return false;
  if (!tutorialAllowsAmbient(runtime)) return false;
  const weather = currentWeather(runtime);
  if (!weather || !WEATHER_SCENES[weather.id]) return false;
  const state = ensureWeatherAmbientState(runtime);
  return !state.consumedSceneKeys.includes(sceneKey(runtime));
}

function presentNpcs(context) {
  return array(context?.presentNpcs)
    .filter((npc) => clean(npc?.id) && clean(npc?.name))
    .map((npc) => ({ id: clean(npc.id), name: clean(npc.name) }));
}

function preferredNpc(runtime, context) {
  const state = ensureWeatherAmbientState(runtime);
  return presentNpcs(context)
    .sort((left, right) => Number(state.npcMemories[left.id]?.encounterCount ?? 0)
      - Number(state.npcMemories[right.id]?.encounterCount ?? 0)
      || left.id.localeCompare(right.id))[0] ?? null;
}

function memoryLead(memory, npcName) {
  if (!memory) return npcName;
  const relation = {
    talk: "前に空模様の話を聞いた",
    help: "前に天候への備えを一緒にした",
    observe: "前に変わりゆく痕跡を一緒に確かめた",
  }[memory.lastBranchId] ?? "以前この土地で会った";
  return `${relation}${npcName}`;
}

function commonAction(runtime, weather, profile, branchId, summary) {
  const place = currentPlace(runtime);
  const token = sceneToken(runtime, weather);
  return {
    id: `AMBIENT_WEATHER:${token}:${branchId.toUpperCase()}`,
    family: branchId === "talk" ? "talk" : branchId === "help" ? "help" : "investigate",
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: FLOW_ID,
    authoredMissionFlowKind: `weather_ambient_${branchId}`,
    weatherAmbientChoice: true,
    weatherAmbientSceneKey: sceneKey(runtime),
    weatherAmbientBranchId: branchId,
    weatherAmbientWeatherId: weather.id,
    weatherAmbientWeatherLabel: weather.label,
    weatherAmbientLocation: place.location,
    weatherAmbientFacilityId: place.facilityId,
    weatherAmbientDay: place.day,
    weatherAmbientDaypart: place.daypart,
    weatherAmbientTitle: profile.title,
    weatherAmbientSummary: summary,
    dialogueExit: true,
  };
}

function talkAction(runtime, context, weather, profile) {
  const npc = preferredNpc(runtime, context);
  if (!npc) {
    return {
      ...commonAction(runtime, weather, profile, "talk", `その場に残された会話の断片から、${profile.disclosure}ことを知った。話した本人を後から呼び戻すことはできない。`),
      type: "localInvestigate",
      family: "investigate",
      minutes: 8,
      localVariant: 400 + Object.keys(WEATHER_SCENES).indexOf(weather.id),
      label: `軒下や掲示に残った言葉から、${profile.talk}を確かめる`,
      requiredDisclosure: profile.disclosure,
    };
  }
  const state = ensureWeatherAmbientState(runtime);
  const memory = state.npcMemories[npc.id] ?? null;
  return {
    ...commonAction(runtime, weather, profile, "talk", `${npc.name}から、${profile.disclosure}ことを聞いた。同じ天気でも前の会話を繰り返さず、今日この場所で変わったことだけを確かめた。`),
    type: "conversation",
    minutes: 6,
    targetNpcId: npc.id,
    targetNpcName: npc.name,
    dialogueTopic: `weather:${weather.id}:${memory ? "reunion" : "first"}`,
    playerUtterance: `${weather.label}で人の動きが変わったことについて尋ねる`,
    requiredDisclosure: profile.disclosure,
    label: `${memoryLead(memory, npc.name)}に、${profile.talk}を聞く`,
  };
}

function helpAction(runtime, context, weather, profile) {
  const npc = preferredNpc(runtime, context);
  return {
    ...commonAction(runtime, weather, profile, "help", profile.helpSummary),
    type: "plan",
    effectKind: `weather_ambient_help_${weather.id}`,
    minutes: 14,
    ...(npc ? { targetNpcId: npc.id, targetNpcName: npc.name } : {}),
    label: npc ? `${npc.name}と、${profile.help}` : profile.help,
  };
}

function observeAction(runtime, weather, profile) {
  return {
    ...commonAction(runtime, weather, profile, "observe", profile.observeSummary),
    type: "localInvestigate",
    effectKind: `weather_ambient_observe_${weather.id}`,
    minutes: 10,
    localVariant: 420 + Object.keys(WEATHER_SCENES).indexOf(weather.id),
    label: profile.observe,
  };
}

function weatherAmbientPromptEligible(runtime) {
  if (!weatherAmbientEligible(runtime)) return false;
  if (Number(runtime?.playerState?.day ?? 1) < 2) return false;
  if (runtime?.dialogueSession || runtime?.pendingWorkOffer) return false;
  if (runtime?.capitalArrivalGuidance?.pending === true) return false;
  const resolvedActions = array(runtime?.playerState?.history)
    .filter((entry) => entry?.type === "PLAYER_ACTION_RESOLVED").length;
  return resolvedActions >= 3;
}

function weatherAmbientPromptAction(runtime, context = {}) {
  if (!weatherAmbientPromptEligible(runtime)) return null;
  const weather = currentWeather(runtime);
  const profile = WEATHER_SCENES[weather.id];
  const place = currentPlace(runtime);
  const state = ensureWeatherAmbientState(runtime);
  const key = sceneKey(runtime);
  if (state.pendingSceneKey === key && state.pendingFacilityId === place.facilityId) return null;
  const npc = preferredNpc(runtime, context);
  return {
    id: `AMBIENT_WEATHER:${sceneToken(runtime, weather)}:NOTICE`,
    type: "plan",
    family: "weather",
    minutes: 2,
    weatherAmbientPrompt: true,
    weatherAmbientSceneKey: key,
    weatherAmbientWeatherId: weather.id,
    weatherAmbientWeatherLabel: weather.label,
    weatherAmbientLocation: place.location,
    weatherAmbientFacilityId: place.facilityId,
    weatherAmbientDay: place.day,
    weatherAmbientDaypart: place.daypart,
    weatherAmbientTitle: profile.title,
    ...(npc ? { targetNpcId: npc.id, targetNpcName: npc.name } : {}),
    label: `${profile.title}。今だけの変化に関わる`,
  };
}

function openWeatherAmbientScene(runtime, action, result) {
  if (!action?.weatherAmbientPrompt || result?.ok === false) return false;
  const state = ensureWeatherAmbientState(runtime);
  const key = clean(action.weatherAmbientSceneKey);
  if (!state || !key || state.consumedSceneKeys.includes(key)) return false;
  state.pendingSceneKey = key;
  state.pendingFacilityId = clean(action.weatherAmbientFacilityId) || null;
  if (!state.promptedSceneKeys.includes(key)) state.promptedSceneKeys.push(key);
  result.summary = `${action.weatherAmbientTitle}。話を聞くか、手を貸すか、消える前の痕跡を確かめるかを選べる。`;
  result.sceneTransition = `${action.weatherAmbientWeatherLabel}のため、普段とは違う一度きりの選択が生まれた`;
  return true;
}

function weatherAmbientActions(runtime, context = {}) {
  if (!weatherAmbientEligible(runtime)) return null;
  const weather = currentWeather(runtime);
  const profile = WEATHER_SCENES[weather.id];
  return [
    talkAction(runtime, context, weather, profile),
    helpAction(runtime, context, weather, profile),
    observeAction(runtime, weather, profile),
  ];
}

function updateNpcMemory(state, action) {
  const npcId = clean(action?.targetNpcId);
  if (!npcId) return;
  const previous = state.npcMemories[npcId] ?? {};
  state.npcMemories[npcId] = {
    npcId,
    npcName: clean(action.targetNpcName) || previous.npcName || npcId,
    encounterCount: Number(previous.encounterCount ?? 0) + 1,
    lastBranchId: action.weatherAmbientBranchId,
    lastWeatherId: action.weatherAmbientWeatherId,
    lastWeatherLabel: action.weatherAmbientWeatherLabel,
    lastDay: action.weatherAmbientDay,
    lastLocation: action.weatherAmbientLocation,
  };
}

function applyWeatherAmbientAction(runtime, action, result) {
  if (!action?.weatherAmbientChoice || result?.ok === false) return false;
  const state = ensureWeatherAmbientState(runtime);
  const key = clean(action.weatherAmbientSceneKey);
  if (!state || !key || state.consumedSceneKeys.includes(key)) return false;
  const allIds = BRANCH_IDS.map((branchId) => action.id.replace(/:[A-Z]+$/u, `:${branchId.toUpperCase()}`));
  state.pendingSceneKey = null;
  state.pendingFacilityId = null;
  state.consumedSceneKeys.push(key);
  state.selectedBranchIds.push(action.id);
  state.closedBranchIds.push(...allIds.filter((id) => id !== action.id));
  state.weatherCounts[action.weatherAmbientWeatherId] = Number(state.weatherCounts[action.weatherAmbientWeatherId] ?? 0) + 1;
  state.branchCounts[action.weatherAmbientBranchId] = Number(state.branchCounts[action.weatherAmbientBranchId] ?? 0) + 1;
  state.locationMemories[action.weatherAmbientLocation] = {
    sceneKey: key,
    selectedActionId: action.id,
    selectedBranchId: action.weatherAmbientBranchId,
    weatherId: action.weatherAmbientWeatherId,
    weatherLabel: action.weatherAmbientWeatherLabel,
    day: action.weatherAmbientDay,
    daypart: action.weatherAmbientDaypart,
    facilityId: action.weatherAmbientFacilityId,
  };
  updateNpcMemory(state, action);

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.worldFlags.weatherAmbientExperienceCounts = { ...state.weatherCounts };
  runtime.playerState.worldFlags.weatherAmbientBranchCounts = { ...state.branchCounts };
  const consequenceKey = action.weatherAmbientBranchId === "help"
    ? "communityWeatherReadiness"
    : action.weatherAmbientBranchId === "observe"
      ? "weatherObservationDepth"
      : "weatherConversationLinks";
  if (!runtime.playerState.worldFlags[consequenceKey]
    || typeof runtime.playerState.worldFlags[consequenceKey] !== "object") {
    runtime.playerState.worldFlags[consequenceKey] = {};
  }
  runtime.playerState.worldFlags[consequenceKey][action.weatherAmbientLocation] = Number(
    runtime.playerState.worldFlags[consequenceKey][action.weatherAmbientLocation] ?? 0,
  ) + 1;
  runtime.playerState.history.push({
    type: "WEATHER_AMBIENT_BRANCH_SELECTED",
    minute: Number(runtime.playerState.absoluteMinute ?? 0),
    sceneKey: key,
    actionId: action.id,
    selectedBranchId: action.weatherAmbientBranchId,
    closedBranchIds: allIds.filter((id) => id !== action.id),
    weatherId: action.weatherAmbientWeatherId,
    weatherLabel: action.weatherAmbientWeatherLabel,
    location: action.weatherAmbientLocation,
    facilityId: action.weatherAmbientFacilityId,
    targetNpcId: action.targetNpcId ?? null,
  });
  result.summary = action.weatherAmbientSummary;
  result.sceneTransition ??= `${action.weatherAmbientTitle}ため、選ばなかった二つの機会は過去になった`;
  return true;
}

export function authoredWeatherAmbientPromptAction(runtime, context = {}) {
  return weatherAmbientPromptAction(runtime, context);
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (authored) return authored;
  const state = ensureWeatherAmbientState(runtime);
  const place = currentPlace(runtime);
  if (!state?.pendingSceneKey
    || state.pendingSceneKey !== sceneKey(runtime)
    || state.pendingFacilityId !== place.facilityId) return null;
  return weatherAmbientActions(runtime, context);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  if (action?.weatherAmbientPrompt) return openWeatherAmbientScene(runtime, action, result);
  if (action?.weatherAmbientChoice) return applyWeatherAmbientAction(runtime, action, result);
  return base.applyAuthoredMissionFlowAction(runtime, action, result);
}

export const AUTHORED_WEATHER_AMBIENT_INTERNALS = Object.freeze({
  WEATHER_SCENES,
  BRANCH_IDS,
  freshWeatherAmbientState,
  ensureWeatherAmbientState,
  currentWeather,
  currentPlace,
  sceneKey,
  sceneToken,
  tutorialAllowsAmbient,
  weatherAmbientEligible,
  weatherAmbientPromptEligible,
  weatherAmbientPromptAction,
  openWeatherAmbientScene,
  preferredNpc,
  memoryLead,
  talkAction,
  helpAction,
  observeAction,
  weatherAmbientActions,
  applyWeatherAmbientAction,
});
