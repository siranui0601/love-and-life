import * as journey from "../../../../tools/trpg-sim/lib/player-journey.mjs";
import {
  activeEquipmentLoans,
  ensureEquipmentAccessState,
  returnEquipmentLoan,
} from "../../../../tools/trpg-sim/lib/equipment-access.mjs";
import {
  completePlayerRest,
  consumeMeal,
  ensurePlayerNeeds,
  publicPlayerNeeds,
} from "../../../../tools/trpg-sim/lib/player-needs.mjs";
import { resolveCanonicalWeather, WEATHER_RULESET_VERSION } from "../resolvers/weather-resolver.js";
import { deserializeRuntime, serializeRuntime } from "./serializer.js";
import { RescueWorldAwareTrpgGameService } from "./rescue-world-aware-service.js";
import { TrpgGameError, gameStateHash } from "./service.js";

export const CHECKPOINT_E_PROLOGUE_VERSION = "checkpoint-e-common-prologue-v1";
export const CHECKPOINT_E_BREAD_ITEM_ID = "ITM008";
export const CHECKPOINT_E_BREAD_NAME = "黒パン";
export const CHECKPOINT_E_LOAN_FACILITY_ID = "LOC_FARM_INN";

const START_LOCATION = "田園の村";
const START_FACILITY_ID = "LOC_FARM_EDGE";
const EDA_ID = "NPC004";
const EDA_NAME = "エダ";
const EDA_UNKNOWN_LABEL = "見知らぬ女性";
const TUTORIAL_LOAN_PREFIX = "EINTRO:LOADOUT:";
const EQUIPMENT_CATEGORY_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "oneHandedSword", label: "片手剣", group: "rightHand", groupLabel: "右手装備", slot: "mainHand", weaponType: "oneHandedSword", twoHanded: false }),
  Object.freeze({ key: "book", label: "本", group: "rightHand", groupLabel: "右手装備", slot: "mainHand", weaponType: "book", twoHanded: false }),
  Object.freeze({ key: "twoHandedSword", label: "両手剣", group: "twoHand", groupLabel: "両手装備", slot: "mainHand", weaponType: "twoHandedSword", twoHanded: true }),
  Object.freeze({ key: "axe", label: "斧", group: "twoHand", groupLabel: "両手装備", slot: "mainHand", weaponType: "axe", twoHanded: true }),
  Object.freeze({ key: "spear", label: "槍", group: "twoHand", groupLabel: "両手装備", slot: "mainHand", weaponType: "spear", twoHanded: true }),
  Object.freeze({ key: "bow", label: "弓", group: "twoHand", groupLabel: "両手装備", slot: "mainHand", weaponType: "bow", twoHanded: true }),
  Object.freeze({ key: "staff", label: "杖", group: "twoHand", groupLabel: "両手装備", slot: "mainHand", weaponType: "staff", twoHanded: true }),
  Object.freeze({ key: "shield", label: "盾", group: "leftHand", groupLabel: "左手装備", slot: "offHand", weaponType: "shield", twoHanded: false }),
]);

const STAGE_COPY = Object.freeze({
  edge_contact: {
    narrative: "村外れの畑道。家並みはまだ遠く、風が麦を揺らしている。気づけば、畑仕事の手を止めた女性がこちらを見ていた。",
    speech: "大丈夫かい？　そんなところでぼうっとして。歩けるなら、まず村まで来な。",
  },
  village_entry: {
    narrative: "エダは急かさず、村へ続く道を指した。ここから先は、人の暮らしの中へ入っていく。",
    speech: "麦穂亭なら座れるし、水もあるよ。道すがらでも、聞きたいことがあれば聞きな。",
  },
  hunger_offer: {
    narrative: "麦穂亭の椅子に腰を下ろすと、ようやく腹の具合に意識が向いた。エダは顔色を見て、包んでいた黒パンを差し出す。",
    speech: "腹が減ってるかどうか、自分でも見ときな。これは村のパン屋の黒パン。まず食べられる時に食べときな。",
  },
  bread_eat: {
    narrative: "手の中には、村のパン屋で売られている黒パンが一つある。空腹度は時間や行動でも増えていく。",
    speech: "残すのも勝手だけど、今は身体を落ち着けた方がいいよ。",
  },
  inventory_prompt: {
    narrative: "腹が落ち着くと、次は自分が何を持っているのかが気になった。旅人らしい荷物は、ほとんど見当たらない。",
    speech: "そういや、あんたが倒れてた時も、まともな道具は見なかったね。自分の持ち物を一度ちゃんと確かめな。",
  },
  inventory_ui: {
    narrative: "まずは持ち物画面で、所持品と装備欄を自分の目で確認する。",
    speech: "武器になるものがないなら、村で貸してる道具を見せられるよ。",
  },
  loan_offer: {
    narrative: "村には、旅人や捜索に出る者へ一時的に回す装備がある。専用の建物を新しく作るのではなく、麦穂亭で預かっている村の貸出分を見せてもらえる。",
    speech: "借りるなら記録は残すよ。返すのも、買い取る相談をするのも後でいい。ただ、借りたままなら借りたままって話になる。",
  },
  loan_catalog: {
    narrative: "貸出表には八つの系統が並ぶ。右手装備は左手装備と組み合わせられるが、両手装備を選んだ時は盾を同時には持てない。借りられるのは一つのloadoutだけだ。",
    speech: "強そうなのを決め打ちしなくていい。持ってみたい形を一つ選びな。",
  },
  equipment_ui: {
    narrative: "借用品は所持品に『借用品』として現れる。装備欄を開き、実際に身につけてみる。",
    speech: "借りたものは、持ってるだけじゃ使えないよ。装備して、それから使える技を見な。",
  },
  fatigue_intro: {
    narrative: "装備とスキルを一通り見終える頃には、身体の重さにも気づく。疲労度は移動や仕事、夜更かしでも増えていく。",
    speech: "腹だけじゃなくて疲れも見るんだよ。倒れてからじゃ遅い。今日は泊まれるよう話をつけてある。",
  },
  lodging_choice: {
    narrative: "麦穂亭で休むこともできるし、すぐ眠らずにもう少し話を聞くこともできる。宿泊は目的地リストではなく、今いる場面で選ぶ。",
    speech: "どうする？　今夜ここで休むなら、そのまま休めるよ。",
  },
});

function profileFor(id) {
  return journey.PLAYER_PROFILES.find((profile) => profile.id === id) ?? journey.PLAYER_PROFILES[0];
}

function isTwoHanded(equipment) {
  return ["twoHand", "twoHanded"].includes(equipment?.grip);
}

function canonicalEquipmentCandidate(data, definition) {
  const candidates = (data.battleData.equipment ?? [])
    .filter((equipment) => equipment?.id && equipment.status !== "disabled")
    .filter((equipment) => equipment.slot === definition.slot)
    .filter((equipment) => {
      if (definition.key === "shield") {
        return equipment.weaponType === "shield" || /盾/u.test(`${equipment.name ?? ""} ${equipment.category ?? ""}`);
      }
      if (equipment.weaponType !== definition.weaponType) return false;
      return definition.twoHanded ? isTwoHanded(equipment) : !isTwoHanded(equipment);
    })
    .sort((left, right) => Number(left.recommendedLevelMin ?? 1) - Number(right.recommendedLevelMin ?? 1)
      || Number(left.tier ?? 1) - Number(right.tier ?? 1)
      || Number(left.performanceIndex ?? 0) - Number(right.performanceIndex ?? 0)
      || left.id.localeCompare(right.id));
  return candidates[0] ?? null;
}

function assertLegalLoanOption(data, option) {
  const equipment = option.equipmentIds.map((equipmentId) => data.battleData.equipmentById.get(equipmentId)).filter(Boolean);
  const mainHand = equipment.find((entry) => entry.slot === "mainHand") ?? null;
  const offHand = equipment.find((entry) => entry.slot === "offHand") ?? null;
  if (mainHand && isTwoHanded(mainHand) && offHand) {
    throw new TrpgGameError(500, "checkpoint_e_illegal_loadout", `Illegal Checkpoint E loadout: ${option.id}`);
  }
  return option;
}

export function buildCheckpointELoanCatalog(data) {
  const categories = EQUIPMENT_CATEGORY_DEFINITIONS.map((definition) => {
    const equipment = canonicalEquipmentCandidate(data, definition);
    return {
      ...definition,
      equipmentId: equipment?.id ?? null,
      equipmentName: equipment?.name ?? null,
      grip: equipment?.grip ?? null,
      recommendedLevelMin: equipment?.recommendedLevelMin ?? null,
    };
  });
  const missing = categories.filter((entry) => !entry.equipmentId).map((entry) => entry.key);
  if (missing.length) {
    throw new TrpgGameError(500, "checkpoint_e_canonical_equipment_missing", `Checkpoint E canonical equipment missing: ${missing.join(",")}`);
  }
  const byKey = new Map(categories.map((entry) => [entry.key, entry]));
  const option = (id, label, keys, group) => assertLegalLoanOption(data, {
    id,
    label,
    group,
    equipmentIds: keys.map((key) => byKey.get(key).equipmentId),
    equipmentNames: keys.map((key) => byKey.get(key).equipmentName),
    categoryKeys: [...keys],
  });
  const options = [
    option("sword", "片手剣", ["oneHandedSword"], "rightHand"),
    option("sword-shield", "片手剣 + 盾", ["oneHandedSword", "shield"], "rightHand"),
    option("book", "本", ["book"], "rightHand"),
    option("book-shield", "本 + 盾", ["book", "shield"], "rightHand"),
    option("two-handed-sword", "両手剣", ["twoHandedSword"], "twoHand"),
    option("axe", "斧", ["axe"], "twoHand"),
    option("spear", "槍", ["spear"], "twoHand"),
    option("bow", "弓", ["bow"], "twoHand"),
    option("staff", "杖", ["staff"], "twoHand"),
    option("shield", "盾", ["shield"], "leftHand"),
  ];
  return {
    version: CHECKPOINT_E_PROLOGUE_VERSION,
    categories,
    options,
    rules: {
      oneLoadoutOnly: true,
      rightPlusLeftAllowed: true,
      twoHandPlusLeftAllowed: false,
      shieldOnlyOffered: true,
      shieldExplanation: "盾は左手装備。盾だけを借りる選択もでき、主武器を持たない不利もplayer choiceとして残る。",
    },
  };
}

function initialPrologueState() {
  return {
    version: CHECKPOINT_E_PROLOGUE_VERSION,
    stage: "edge_contact",
    complete: false,
    startedAtMinute: 0,
    completedAtMinute: null,
    bread: { itemId: CHECKPOINT_E_BREAD_ITEM_ID, itemName: CHECKPOINT_E_BREAD_NAME, received: false, eaten: false },
    inventoryInspected: false,
    skillPanelInspected: false,
    traces: {
      gratitude: 0,
      caution: 0,
      formalRecordInterest: 0,
      practicalHelp: 0,
      supplyAwareness: 0,
      oddObservation: 0,
      discretion: 0,
    },
    loan: {
      loadoutId: null,
      equipmentIds: [],
      equipmentNames: [],
      loanIds: [],
      disposition: null,
      borrowedAtMinute: null,
      expectedReturnFacilityId: CHECKPOINT_E_LOAN_FACILITY_ID,
    },
  };
}

function addHistory(state, entry) {
  state.history ??= [];
  state.history.push({ minute: state.absoluteMinute, ...entry });
}

function trace(runtime, key, delta = 1, note = null) {
  const prologue = runtime.checkpointEPrologue;
  prologue.traces[key] = Number(prologue.traces[key] ?? 0) + Number(delta || 0);
  addHistory(runtime.playerState, {
    type: "CHECKPOINT_E_PROLOGUE_TRACE",
    trace: key,
    delta,
    note,
  });
}

function edaKnown(runtime) {
  return runtime.playerKnowledge?.knownNpcIds instanceof Set
    && runtime.playerKnowledge.knownNpcIds.has(EDA_ID);
}

function ensureEdaIntroduction(runtime) {
  if (edaKnown(runtime)) return null;
  if (runtime.pendingNpcIntroduction?.npcId === EDA_ID) return runtime.pendingNpcIntroduction;
  const pending = {
    token: `CHECKPOINT-E-EDA:${runtime.playerState.absoluteMinute}`,
    npcId: EDA_ID,
    canonicalName: EDA_NAME,
    anonymousLabel: EDA_UNKNOWN_LABEL,
    sourceActionId: "CHECKPOINT_E_EDGE_CONTACT",
  };
  runtime.pendingNpcIntroduction = pending;
  addHistory(runtime.playerState, {
    type: "CHECKPOINT_E_NPC_INTRODUCTION_OFFERED",
    npcId: EDA_ID,
    token: pending.token,
  });
  return pending;
}

function setEdaFacility(runtime, facilityId) {
  const eda = runtime.livingWorld?.npcStates?.[EDA_ID];
  if (!eda) return;
  eda.location = START_LOCATION;
  eda.position = { hubId: START_LOCATION, facilityId };
  eda.presence = "present";
  eda.currentGoal = "help-new-traveler";
  eda.status = "旅人を案内中";
}

function removeStartingHandEquipment(runtime, data) {
  const player = runtime.playerState.player;
  for (const slot of ["mainHand", "offHand"]) delete player.equipment[slot];
  for (const [equipmentId, quantity] of Object.entries(player.inventory.equipment ?? {})) {
    if (!(Number(quantity) > 0)) continue;
    const equipment = data.battleData.equipmentById.get(equipmentId);
    if (["mainHand", "offHand"].includes(equipment?.slot)) delete player.inventory.equipment[equipmentId];
  }
}

function initializeCheckpointEPrologue(runtime, data) {
  runtime.tutorial = null;
  const state = runtime.playerState;
  state.player.location = START_LOCATION;
  state.player.facilityId = START_FACILITY_ID;
  state.player.inventory.items ??= {};
  removeStartingHandEquipment(runtime, data);
  const needs = ensurePlayerNeeds(state.player);
  needs.hunger = Math.max(Number(needs.hunger ?? 0), 46);
  needs.fatigue = Math.max(Number(needs.fatigue ?? 0), 28);
  runtime.checkpointEPrologue = initialPrologueState();
  runtime.checkpointEPrologue.startedAtMinute = state.absoluteMinute;
  setEdaFacility(runtime, START_FACILITY_ID);
  if (runtime.playerKnowledge?.knownFacilityIds instanceof Set) {
    runtime.playerKnowledge.knownFacilityIds.add(START_FACILITY_ID);
    runtime.playerKnowledge.knownFacilityIds.add(CHECKPOINT_E_LOAN_FACILITY_ID);
  }
  addHistory(state, {
    type: "CHECKPOINT_E_PROLOGUE_STARTED",
    location: START_LOCATION,
    facilityId: START_FACILITY_ID,
    weatherRulesetVersion: WEATHER_RULESET_VERSION,
  });
}

function updateWeather(runtime) {
  const state = runtime.playerState;
  state.weather = resolveCanonicalWeather({ day: state.day, regionId: state.player.location, daypart: state.daypart });
  return state.weather;
}

function resolveTimedAction(runtime, data, { id, type = "observe", minutes = 1, label }) {
  updateWeather(runtime);
  return journey.resolvePlayerAction(
    runtime.playerState,
    data.model,
    data.battleData,
    data.skills,
    runtime.playerState.catalog,
    profileFor(runtime.playerState.profileId),
    { id, type, minutes, label, danger: false },
  );
}

function resolveMoveToInn(runtime, data, choice) {
  const action = journey.availableLocalMovementActions(runtime.playerState, data.model)
    .find((candidate) => candidate.destinationFacilityId === CHECKPOINT_E_LOAN_FACILITY_ID);
  if (!action) throw new TrpgGameError(409, "checkpoint_e_inn_unreachable", "麦穂亭へ移動できません");
  updateWeather(runtime);
  const result = journey.resolvePlayerAction(
    runtime.playerState,
    data.model,
    data.battleData,
    data.skills,
    runtime.playerState.catalog,
    profileFor(runtime.playerState.profileId),
    { ...action, id: choice.id, label: choice.label },
  );
  setEdaFacility(runtime, CHECKPOINT_E_LOAN_FACILITY_ID);
  return result;
}

function choicesForStage(runtime) {
  const stage = runtime.checkpointEPrologue?.stage;
  const definitions = {
    edge_contact: [
      { id: "E:EDGE:THANK", label: "声をかけてくれたことに礼を言い、ここがどこか尋ねる", minutes: 5, trace: "gratitude" },
      { id: "E:EDGE:CAUTION", label: "距離を保ったまま、まず相手の名前と村の名を確認する", minutes: 6, trace: "caution" },
      { id: "E:EDGE:ODD", label: "返事より先に、道端の曲がった案内杭を起こしてから話を聞く", minutes: 8, trace: "oddObservation" },
    ],
    village_entry: [
      { id: "E:MOVE:WITH_EDA", label: "エダについて麦穂亭へ向かう", minutes: 0, trace: "gratitude", moveToInn: true },
      { id: "E:MOVE:WATCH", label: "村の畑や人の動きを確かめながら麦穂亭へ向かう", minutes: 0, trace: "formalRecordInterest", moveToInn: true },
      { id: "E:MOVE:DISTANCE", label: "少し距離を空け、道順を覚えながら後についていく", minutes: 0, trace: "discretion", moveToInn: true },
    ],
    hunger_offer: [
      { id: "E:BREAD:THANK", label: "「助かります」と黒パンを受け取る", minutes: 2, trace: "gratitude" },
      { id: "E:BREAD:TERMS", label: "代金や返す必要があるのか確認してから受け取る", minutes: 4, trace: "formalRecordInterest" },
      { id: "E:BREAD:HELP", label: "代わりに何か手伝えることはないか尋ねてから受け取る", minutes: 5, trace: "practicalHelp" },
    ],
    bread_eat: [
      { id: "E:EAT:QUIET", label: "黒パンをゆっくり食べ、空腹度が下がるのを確かめる", minutes: 6, trace: "supplyAwareness" },
      { id: "E:EAT:THANK", label: "エダにもう一度礼を言ってから黒パンを食べる", minutes: 7, trace: "gratitude" },
      { id: "E:EAT:SUPPLY", label: "村の食料事情を聞きながら黒パンを食べる", minutes: 9, trace: "supplyAwareness" },
    ],
    inventory_prompt: [
      { id: "E:INV:PLAIN", label: "自分の持ち物を一つずつ確認する", minutes: 3, trace: "formalRecordInterest" },
      { id: "E:INV:ASK_EDA", label: "倒れていた時に何を持っていたかエダにも確認する", minutes: 5, trace: "gratitude" },
      { id: "E:INV:POCKETS", label: "衣服や袋の中まで念入りに調べる", minutes: 6, trace: "caution" },
    ],
    loan_offer: [
      { id: "E:LOAN:LOOK", label: "村で貸している装備を一覧で見せてもらう", minutes: 3, trace: "practicalHelp" },
      { id: "E:LOAN:RECORD", label: "借りた記録がどう残るのか確認してから一覧を見る", minutes: 5, trace: "formalRecordInterest" },
      { id: "E:LOAN:QUIET", label: "誰が管理している品なのかだけ聞き、余計な事情は話さず一覧を見る", minutes: 5, trace: "discretion" },
    ],
    fatigue_intro: [
      { id: "E:FATIGUE:CHECK", label: "疲労度の数字と今の身体の重さを見比べる", minutes: 2, trace: "supplyAwareness" },
      { id: "E:FATIGUE:CHAIR", label: "宿の椅子に深く座り、少しだけ身体を休める", minutes: 12, trace: "oddObservation" },
      { id: "E:FATIGUE:ASK", label: "倒れるほど疲れた時、この村では誰が助けるのか聞く", minutes: 6, trace: "caution" },
    ],
    lodging_choice: [
      { id: "E:LODGE:SLEEP", label: "麦穂亭で今夜は休む", minutes: 480, trace: "supplyAwareness", lodging: "full" },
      { id: "E:LODGE:REGISTER", label: "宿帳に名前を残し、少し休んでから動く", minutes: 45, trace: "formalRecordInterest", lodging: "short" },
      { id: "E:LODGE:CONTINUE", label: "今は泊まらず、借用品の返却条件だけ確認して動き出す", minutes: 8, trace: "discretion", lodging: "none" },
    ],
  };
  return (definitions[stage] ?? []).map((choice, index) => ({
    ...choice,
    choiceId: `CHOICE-${index + 1}`,
    actionId: choice.id,
    type: choice.moveToInn ? "move" : "conversation",
    intentType: choice.moveToInn ? "move" : "conversation",
  }));
}

function breadQuantity(state) {
  return Number(state.player.inventory.items?.[CHECKPOINT_E_BREAD_ITEM_ID] ?? 0);
}

function receiveBread(runtime) {
  const state = runtime.playerState;
  state.player.inventory.items[CHECKPOINT_E_BREAD_ITEM_ID] = breadQuantity(state) + 1;
  runtime.checkpointEPrologue.bread.received = true;
  addHistory(state, { type: "ITEM_RECEIVED", itemId: CHECKPOINT_E_BREAD_ITEM_ID, itemName: CHECKPOINT_E_BREAD_NAME, quantity: 1, sourceNpcId: EDA_ID });
}

function eatBread(runtime) {
  const state = runtime.playerState;
  if (breadQuantity(state) < 1) throw new TrpgGameError(409, "checkpoint_e_bread_missing", "黒パンがありません");
  state.player.inventory.items[CHECKPOINT_E_BREAD_ITEM_ID] = breadQuantity(state) - 1;
  if (state.player.inventory.items[CHECKPOINT_E_BREAD_ITEM_ID] <= 0) delete state.player.inventory.items[CHECKPOINT_E_BREAD_ITEM_ID];
  const result = consumeMeal(state.player, { minute: state.absoluteMinute, nutrition: 34, quality: "standard" });
  runtime.checkpointEPrologue.bread.eaten = true;
  addHistory(state, { type: "ITEM_CONSUMED", itemId: CHECKPOINT_E_BREAD_ITEM_ID, itemName: CHECKPOINT_E_BREAD_NAME, hungerReduced: result.hungerReduced });
}

function selectedLoadout(runtime, data) {
  const id = runtime.checkpointEPrologue?.loan?.loadoutId;
  return id ? buildCheckpointELoanCatalog(data).options.find((entry) => entry.id === id) ?? null : null;
}

function reconcilePrologueLoanProjection(runtime) {
  const prologue = runtime.checkpointEPrologue;
  if (!prologue?.loan?.loadoutId) return prologue?.loan ?? null;
  const access = ensureEquipmentAccessState(runtime.playerState);
  const loans = prologue.loan.loanIds.map((loanId) => access.loans[loanId]).filter(Boolean);
  if (!loans.length) return prologue.loan;
  const activeCount = loans.filter((loan) => loan.status === "active").length;
  if (activeCount === 0) prologue.loan.disposition = "returned";
  else if (activeCount !== loans.length) prologue.loan.disposition = "loan_state_inconsistent";
  else if ([null, "returned", "loan_state_inconsistent"].includes(prologue.loan.disposition)) prologue.loan.disposition = "borrowed";
  return prologue.loan;
}

function equippedLoadoutReady(runtime, data) {
  const loadout = selectedLoadout(runtime, data);
  if (!loadout) return false;
  const equipped = new Set(Object.values(runtime.playerState.player.equipment ?? {}).filter(Boolean));
  return loadout.equipmentIds.every((equipmentId) => equipped.has(equipmentId));
}

function tutorialViewForPrologue(runtime, data) {
  const prologue = runtime.checkpointEPrologue;
  if (!prologue || prologue.complete) return null;
  const stage = prologue.stage;
  const equipmentReady = stage === "equipment_ui" && equippedLoadoutReady(runtime, data);
  const panel = stage === "inventory_ui" || stage === "equipment_ui"
    ? "inventory"
    : stage === "loan_catalog"
      ? "shop"
      : stage === "skills_ui" || equipmentReady
        ? "skills"
        : null;
  const id = stage === "inventory_ui"
    ? "checkpoint-e-inventory"
    : stage === "skills_ui" || equipmentReady
      ? "checkpoint-e-skills"
      : `checkpoint-e-${stage}`;
  const title = {
    inventory_ui: "持ち物を自分の目で確認しよう",
    loan_catalog: "8系統を一覧で見て、一つのloadoutを借りよう",
    equipment_ui: equipmentReady ? "装備できた。使えるスキルを見よう" : "借用品を装備してみよう",
    skills_ui: "今の装備で使えるスキルを確認しよう",
  }[stage] ?? "共通プロローグ";
  const body = {
    inventory_ui: "持ち物を開き、武器・副装備が空であることを確認する。",
    loan_catalog: "貸出画面では右手・両手・左手の8系統を一度に確認できる。",
    equipment_ui: equipmentReady ? "能力とスキルを開き、装備で使える系統が変わることを確認する。" : "持ち物から借りたloadoutを装備する。両手装備と盾は同時装備できない。",
    skills_ui: "取得済み・取得可能スキルと、現在の装備で使える系統を確認する。",
  }[stage] ?? "画面中央の三択から、今の場面での行動を選ぶ。";
  return {
    version: CHECKPOINT_E_PROLOGUE_VERSION,
    id,
    complete: false,
    visible: true,
    title,
    body,
    progressLabel: `共通プロローグ: ${stage}`,
    actionLabel: panel === "inventory" ? "持ち物を見る" : panel === "shop" ? "貸出装備を見る" : panel === "skills" ? "能力とスキルを見る" : null,
    actionPanel: panel,
    acknowledgeable: stage === "inventory_ui" || stage === "skills_ui" || equipmentReady,
    emphasisTarget: panel ?? "choices",
    unlocked: {
      choices: !["inventory_ui", "loan_catalog", "equipment_ui", "skills_ui"].includes(stage),
      movement: false,
      missions: false,
      shop: stage === "loan_catalog",
      skills: stage === "skills_ui" || equipmentReady,
      battle: false,
    },
  };
}

function prologueShopView(runtime, data) {
  const prologue = runtime.checkpointEPrologue;
  if (!prologue || prologue.stage !== "loan_catalog" || prologue.loan.loadoutId) return null;
  const catalog = buildCheckpointELoanCatalog(data);
  const stock = catalog.options.map((option) => {
    const primary = data.battleData.equipmentById.get(option.equipmentIds[0]);
    const loadoutKind = option.group === "twoHand"
      ? "両手装備"
      : option.group === "leftHand"
        ? "左手装備・盾単体"
        : option.categoryKeys.includes("shield")
          ? "右手+左手の1 loadout"
          : "右手装備";
    return {
      stockId: `${TUTORIAL_LOAN_PREFIX}${option.id}`,
      id: `${TUTORIAL_LOAN_PREFIX}${option.id}`,
      equipmentId: primary.id,
      name: option.label,
      description: `${option.equipmentNames.join(" + ")} / ${loadoutKind}`,
      quantity: 1,
      price: 999999,
      equipment: {
        physicalPower: primary.physicalPower,
        magicPower: primary.magicPower,
        defense: primary.defense,
      },
      slot: primary.slot,
      tutorialLoanOnly: true,
      access: {
        loan: {
          loanId: `${TUTORIAL_LOAN_PREFIX}${option.id}`,
          missionId: null,
          missionTitle: "共通プロローグ",
          equipmentId: primary.id,
          deposit: 0,
          sellerFacilityId: CHECKPOINT_E_LOAN_FACILITY_ID,
          reason: "共通プロローグ中に1 loadoutだけ借りられる",
        },
      },
    };
  });
  return {
    available: true,
    facilityId: CHECKPOINT_E_LOAN_FACILITY_ID,
    facilityName: "麦穂亭・村の貸出装備",
    stock,
    saleQuotes: [],
    rewards: [],
    loans: [],
    prologueLoanCatalog: {
      active: true,
      ...catalog,
    },
  };
}

function publicPrologueState(runtime, data) {
  const prologue = runtime.checkpointEPrologue;
  if (!prologue) return null;
  reconcilePrologueLoanProjection(runtime);
  return {
    version: prologue.version,
    stage: prologue.stage,
    complete: prologue.complete,
    bread: { ...prologue.bread },
    inventoryInspected: prologue.inventoryInspected,
    skillPanelInspected: prologue.skillPanelInspected,
    traces: { ...prologue.traces },
    loan: { ...prologue.loan, equipmentIds: [...prologue.loan.equipmentIds], equipmentNames: [...prologue.loan.equipmentNames], loanIds: [...prologue.loan.loanIds] },
    equipmentReady: equippedLoadoutReady(runtime, data),
    weatherRulesetVersion: WEATHER_RULESET_VERSION,
  };
}

function decorateInventoryItems(view) {
  const items = view.player?.inventory?.items;
  if (!items || Array.isArray(items) || !(CHECKPOINT_E_BREAD_ITEM_ID in items)) return;
  view.player.inventory.items = Object.entries(items).map(([id, quantity]) => id === CHECKPOINT_E_BREAD_ITEM_ID
    ? { id, name: CHECKPOINT_E_BREAD_NAME, quantity, kind: "food" }
    : { id, name: id, quantity });
}

function decoratePrologueView(view, runtime, data) {
  const prologue = runtime.checkpointEPrologue;
  if (!prologue) return view;
  view.checkpointEPrologue = publicPrologueState(runtime, data);
  decorateInventoryItems(view);
  if (prologue.complete) return view;
  const copy = STAGE_COPY[prologue.stage] ?? STAGE_COPY.edge_contact;
  const known = edaKnown(runtime);
  const pendingIntroduction = runtime.pendingNpcIntroduction?.npcId === EDA_ID
    ? runtime.pendingNpcIntroduction
    : null;
  view.scene.narrative = known ? copy.narrative : copy.narrative.replaceAll(EDA_NAME, "女性");
  view.scene.speeches = [{ actorId: EDA_ID, actorName: known ? EDA_NAME : EDA_UNKNOWN_LABEL, text: copy.speech }];
  view.scene.beats = pendingIntroduction ? [{
    kind: "npc",
    actorId: EDA_ID,
    speakerLabel: EDA_UNKNOWN_LABEL,
    text: "「私はエダ。村で畑仕事をしてる。歩けるなら、麦穂亭まで案内するよ」",
    introductionToken: pendingIntroduction.token,
  }] : [];
  view.choices = pendingIntroduction ? [] : choicesForStage(runtime).map((choice) => ({
    choiceId: choice.choiceId,
    actionId: choice.actionId,
    id: choice.id,
    label: choice.label,
    type: choice.type,
    intentType: choice.intentType,
    minutes: choice.minutes,
    danger: false,
  }));
  view.movement = [];
  view.tutorial = tutorialViewForPrologue(runtime, data);
  const specialShop = prologueShopView(runtime, data);
  if (specialShop) view.shop = specialShop;
  return view;
}

function persistRecord(record, runtime, data) {
  reconcilePrologueLoanProjection(runtime);
  runtime.playerState.weather = resolveCanonicalWeather({
    day: runtime.playerState.day,
    regionId: runtime.playerState.player.location,
    daypart: runtime.playerState.daypart,
  });
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(deserializeRuntime(record.runtimeSnapshot, data), data);
  record.summary = {
    clock: { day: runtime.playerState.day, time: `${String(runtime.playerState.hour).padStart(2, "0")}:${String(runtime.playerState.minute).padStart(2, "0")}` },
    location: runtime.playerState.player.location,
    facilityId: runtime.playerState.player.facilityId,
    level: runtime.playerState.player.level,
  };
}

function validateRevision(record, input) {
  if (Number(input.expectedRevision) !== Number(record.revision)) {
    throw new TrpgGameError(409, "revision_conflict", "Save revision changed", { expectedRevision: input.expectedRevision, actualRevision: record.revision });
  }
}

function commandId(input) {
  const id = String(input.commandId ?? "").trim();
  if (!id) throw new TrpgGameError(400, "command_id_required");
  return id.slice(0, 100);
}

function appendCustomJournal(record, input, beforeHash, afterHash) {
  record.commandLog.push({
    seq: record.revision,
    commandId: commandId(input),
    revisionBefore: Number(input.expectedRevision),
    revisionAfter: record.revision,
    stateBeforeHash: beforeHash,
    stateAfterHash: afterHash,
    type: input.type,
    payload: structuredClone(input.payload ?? {}),
    checkpointEPrologue: true,
  });
}

function finishPrologue(runtime) {
  const prologue = runtime.checkpointEPrologue;
  reconcilePrologueLoanProjection(runtime);
  prologue.stage = "free";
  prologue.complete = true;
  prologue.completedAtMinute = runtime.playerState.absoluteMinute;
  addHistory(runtime.playerState, {
    type: "CHECKPOINT_E_PROLOGUE_COMPLETED",
    loanLoadoutId: prologue.loan.loadoutId,
    loanDisposition: prologue.loan.disposition,
  });
}

function applyStoryChoice(runtime, data, choice) {
  const prologue = runtime.checkpointEPrologue;
  if (choice.moveToInn) resolveMoveToInn(runtime, data, choice);
  else resolveTimedAction(runtime, data, { id: choice.id, type: choice.type === "conversation" ? "conversation" : "observe", minutes: choice.minutes, label: choice.label });
  trace(runtime, choice.trace, 1, choice.id);
  switch (prologue.stage) {
    case "edge_contact":
      prologue.stage = "village_entry";
      ensureEdaIntroduction(runtime);
      break;
    case "village_entry": prologue.stage = "hunger_offer"; break;
    case "hunger_offer":
      receiveBread(runtime);
      prologue.stage = "bread_eat";
      break;
    case "bread_eat":
      eatBread(runtime);
      prologue.stage = "inventory_prompt";
      break;
    case "inventory_prompt": prologue.stage = "inventory_ui"; break;
    case "loan_offer": prologue.stage = "loan_catalog"; break;
    case "fatigue_intro": prologue.stage = "lodging_choice"; break;
    case "lodging_choice": {
      if (choice.lodging === "full") {
        completePlayerRest(runtime.playerState.player, {
          minute: runtime.playerState.absoluteMinute,
          durationMinutes: 480,
          lodging: true,
          safety: "normal",
          weatherTags: runtime.playerState.weather?.tags ?? [],
        });
        if (Number(runtime.playerState.player.freeLodging ?? 0) > 0) runtime.playerState.player.freeLodging -= 1;
        prologue.loan.disposition = "borrowed_after_lodging";
      } else if (choice.lodging === "short") {
        completePlayerRest(runtime.playerState.player, {
          minute: runtime.playerState.absoluteMinute,
          durationMinutes: 45,
          lodging: false,
          safety: "normal",
          weatherTags: [],
        });
        prologue.loan.disposition = "borrowed_registered";
      } else {
        prologue.loan.disposition = "borrowed_continued";
      }
      finishPrologue(runtime);
      break;
    }
    default: throw new TrpgGameError(409, "checkpoint_e_choice_stage_mismatch");
  }
}

function borrowIntroLoadout(runtime, data, loanId) {
  const prologue = runtime.checkpointEPrologue;
  if (prologue.stage !== "loan_catalog") throw new TrpgGameError(409, "checkpoint_e_loan_stage_mismatch");
  if (prologue.loan.loadoutId) throw new TrpgGameError(409, "checkpoint_e_loadout_already_borrowed");
  const optionId = String(loanId ?? "").startsWith(TUTORIAL_LOAN_PREFIX) ? String(loanId).slice(TUTORIAL_LOAN_PREFIX.length) : "";
  const catalog = buildCheckpointELoanCatalog(data);
  const option = catalog.options.find((entry) => entry.id === optionId);
  if (!option) throw new TrpgGameError(404, "checkpoint_e_loadout_not_found");
  assertLegalLoanOption(data, option);
  const access = ensureEquipmentAccessState(runtime.playerState);
  const existingIntro = activeEquipmentLoans(runtime.playerState).filter((loan) => loan.source === CHECKPOINT_E_PROLOGUE_VERSION);
  if (existingIntro.length) throw new TrpgGameError(409, "checkpoint_e_loadout_already_borrowed");
  const groupId = `${TUTORIAL_LOAN_PREFIX}${option.id}`;
  const loanIds = option.equipmentIds.map((equipmentId, index) => `${groupId}:ITEM:${index + 1}`);
  option.equipmentIds.forEach((equipmentId, index) => {
    const equipment = data.battleData.equipmentById.get(equipmentId);
    access.loans[loanIds[index]] = {
      loanId: loanIds[index],
      introGroupId: groupId,
      source: CHECKPOINT_E_PROLOGUE_VERSION,
      missionId: null,
      missionTitle: "共通プロローグ",
      stockId: null,
      equipmentId,
      equipmentName: equipment?.name ?? equipmentId,
      deposit: 0,
      sellerFacilityId: CHECKPOINT_E_LOAN_FACILITY_ID,
      reason: "村の共通プロローグ貸出",
      status: "active",
      borrowedAtMinute: runtime.playerState.absoluteMinute,
      returnPolicy: "player_choice",
    };
  });
  prologue.loan = {
    ...prologue.loan,
    loadoutId: option.id,
    equipmentIds: [...option.equipmentIds],
    equipmentNames: [...option.equipmentNames],
    loanIds,
    disposition: "borrowed",
    borrowedAtMinute: runtime.playerState.absoluteMinute,
  };
  trace(runtime, "supplyAwareness", 1, `borrow:${option.id}`);
  addHistory(runtime.playerState, {
    type: "CHECKPOINT_E_LOADOUT_BORROWED",
    loadoutId: option.id,
    equipmentIds: [...option.equipmentIds],
    loanIds,
    returnFacilityId: CHECKPOINT_E_LOAN_FACILITY_ID,
  });
  prologue.stage = "equipment_ui";
}

function returnIntroLoadout(runtime, loanId) {
  const access = ensureEquipmentAccessState(runtime.playerState);
  const target = access.loans[loanId];
  if (!target || target.source !== CHECKPOINT_E_PROLOGUE_VERSION || target.status !== "active") {
    return { ok: false, reason: "loan_not_active" };
  }
  if (runtime.playerState.player.facilityId !== target.sellerFacilityId) {
    return { ok: false, reason: "loan_return_wrong_facility", sellerFacilityId: target.sellerFacilityId };
  }
  const groupId = target.introGroupId;
  const groupLoans = Object.values(access.loans).filter((loan) =>
    loan?.source === CHECKPOINT_E_PROLOGUE_VERSION
      && loan.introGroupId === groupId
      && loan.status === "active");
  const returnedIds = [];
  for (const loan of groupLoans) {
    const result = returnEquipmentLoan(runtime.playerState, loan.loanId, {
      facilityId: runtime.playerState.player.facilityId,
      reason: "player_returned_loadout",
    });
    if (!result.ok) return result;
    returnedIds.push(loan.equipmentId);
  }
  reconcilePrologueLoanProjection(runtime);
  addHistory(runtime.playerState, { type: "CHECKPOINT_E_LOADOUT_RETURNED", equipmentIds: returnedIds, introGroupId: groupId });
  return { ok: true, equipmentIds: returnedIds, introGroupId: groupId };
}

function isCheckpointELoanReturn(runtime, input) {
  if (input.type !== "SHOP_RETURN_LOAN") return false;
  const loanId = String(input.payload?.loanId ?? "");
  const loan = runtime.playerState.player.equipmentAccess?.loans?.[loanId];
  return loan?.source === CHECKPOINT_E_PROLOGUE_VERSION;
}

function prologueCommandAllowed(runtime, input, data) {
  const stage = runtime.checkpointEPrologue?.stage;
  if (!stage || runtime.checkpointEPrologue.complete) return true;
  if (input.type === "CHOOSE") return runtime.pendingNpcIntroduction?.npcId !== EDA_ID;
  if (input.type === "ACK_NPC_INTRODUCTION") return runtime.pendingNpcIntroduction?.npcId === EDA_ID;
  if (input.type === "TUTORIAL_ACK") return ["inventory_ui", "equipment_ui", "skills_ui"].includes(stage);
  if (input.type === "SHOP_BORROW") return stage === "loan_catalog";
  if (["EQUIP", "UNEQUIP"].includes(input.type)) return stage === "equipment_ui";
  if (input.type === "SHOP_RETURN_LOAN") return true;
  return false;
}

export class CheckpointEPrologueTrpgGameService extends RescueWorldAwareTrpgGameService {
  async create(ownerHash, input = {}) {
    const view = await super.create(ownerHash, input);
    return this.runLocked(view.id, async () => {
      const record = await this.recordForOwner(ownerHash, view.id);
      const runtime = deserializeRuntime(record.runtimeSnapshot, this.data);
      initializeCheckpointEPrologue(runtime, this.data);
      persistRecord(record, runtime, this.data);
      await this.store.put(record);
      return decoratePrologueView(super.gameViewForRecord(record), runtime, this.data);
    });
  }

  async get(ownerHash, id) {
    const view = await super.get(ownerHash, id);
    const record = await this.store.get(id);
    if (!record || record.ownerHash !== ownerHash) return view;
    const runtime = deserializeRuntime(record.runtimeSnapshot, this.data);
    return decoratePrologueView(view, runtime, this.data);
  }

  async command(ownerHash, id, input = {}) {
    const record = await this.store.get(id);
    if (!record || record.ownerHash !== ownerHash) return super.command(ownerHash, id, input);
    const snapshot = deserializeRuntime(record.runtimeSnapshot, this.data);
    const prologue = snapshot.checkpointEPrologue;
    const checkpointELoanReturn = isCheckpointELoanReturn(snapshot, input);
    if ((!prologue || prologue.complete) && !checkpointELoanReturn) return super.command(ownerHash, id, input);

    if (!prologueCommandAllowed(snapshot, input, this.data)) {
      throw new TrpgGameError(409, "tutorial_feature_locked", "共通プロローグ中は場面の三択と案内されたUIから進めてください");
    }

    if (["EQUIP", "UNEQUIP", "ACK_NPC_INTRODUCTION"].includes(input.type)) {
      const result = await super.command(ownerHash, id, input);
      const updatedRecord = await this.store.get(id);
      const runtime = deserializeRuntime(updatedRecord.runtimeSnapshot, this.data);
      return { ...result, save: decoratePrologueView(result.save, runtime, this.data) };
    }

    return this.runLocked(id, async () => {
      const current = await this.recordForOwner(ownerHash, id);
      const cid = commandId(input);
      const duplicate = current.commandLog.find((entry) => entry.commandId === cid);
      if (duplicate) {
        const runtime = deserializeRuntime(current.runtimeSnapshot, this.data);
        return { duplicate: true, save: decoratePrologueView(super.gameViewForRecord(current), runtime, this.data) };
      }
      validateRevision(current, input);
      const runtime = deserializeRuntime(current.runtimeSnapshot, this.data);
      const groupReturn = isCheckpointELoanReturn(runtime, input);
      if (!runtime.checkpointEPrologue || (runtime.checkpointEPrologue.complete && !groupReturn)) {
        throw new TrpgGameError(409, "checkpoint_e_prologue_not_active");
      }
      const wasComplete = runtime.checkpointEPrologue.complete;
      const beforeHash = current.stateHash;
      const payload = input.payload ?? {};

      if (input.type === "CHOOSE") {
        const choices = choicesForStage(runtime);
        const choice = choices.find((entry) => entry.choiceId === payload.choiceId);
        if (!choice || (payload.actionId && payload.actionId !== choice.actionId)) {
          throw new TrpgGameError(409, "choice_action_mismatch");
        }
        applyStoryChoice(runtime, this.data, choice);
      } else if (input.type === "TUTORIAL_ACK") {
        const tutorialId = String(payload.tutorialId ?? "");
        if (runtime.checkpointEPrologue.stage === "inventory_ui" && tutorialId === "checkpoint-e-inventory") {
          runtime.checkpointEPrologue.inventoryInspected = true;
          trace(runtime, "formalRecordInterest", 1, "inventory-ui-inspected");
          runtime.checkpointEPrologue.stage = "loan_offer";
        } else if (runtime.checkpointEPrologue.stage === "equipment_ui" && tutorialId === "checkpoint-e-skills" && equippedLoadoutReady(runtime, this.data)) {
          runtime.checkpointEPrologue.skillPanelInspected = true;
          trace(runtime, "practicalHelp", 1, "skills-ui-inspected");
          runtime.checkpointEPrologue.stage = "fatigue_intro";
        } else {
          throw new TrpgGameError(409, "checkpoint_e_tutorial_ack_mismatch");
        }
      } else if (input.type === "SHOP_BORROW") {
        borrowIntroLoadout(runtime, this.data, payload.loanId);
      } else if (input.type === "SHOP_RETURN_LOAN") {
        const returned = returnIntroLoadout(runtime, payload.loanId);
        if (!returned.ok) {
          throw new TrpgGameError(409, returned.reason ?? "loan_not_active", returned.reason ?? "loan_not_active", returned);
        }
      } else {
        throw new TrpgGameError(400, "checkpoint_e_command_not_supported");
      }

      current.revision += 1;
      current.updatedAt = new Date().toISOString();
      persistRecord(current, runtime, this.data);
      appendCustomJournal(current, input, beforeHash, current.stateHash);
      if (runtime.checkpointEPrologue?.complete && !wasComplete) {
        current.replayBase = {
          resolverVersion: current.resolverVersion,
          revision: current.revision,
          stateHash: current.stateHash,
          runtimeSnapshot: current.runtimeSnapshot,
        };
      }
      await this.store.put(current);
      return {
        duplicate: false,
        save: decoratePrologueView(super.gameViewForRecord(current), runtime, this.data),
      };
    });
  }

  health() {
    return { ...super.health(), checkpointEPrologueVersion: CHECKPOINT_E_PROLOGUE_VERSION, weatherRulesetVersion: WEATHER_RULESET_VERSION };
  }
}

export function createCheckpointEPrologueTrpgGameService(options = {}) {
  return new CheckpointEPrologueTrpgGameService(options);
}
