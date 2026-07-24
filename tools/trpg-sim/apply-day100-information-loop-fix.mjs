import fs from "node:fs";

const authoredPath = "src/server/trpg/content/authored/journeys/farm-to-capital.js";
const servicePath = "src/server/trpg/game/service.js";
const guidancePath = "src/server/trpg/resolvers/capital-arrival-guidance.js";
const authoredTestPath = "tools/trpg-sim/test/authored-journey-presentation.test.mjs";
const guidanceTestPath = "tools/trpg-sim/test/capital-arrival-guidance.test.mjs";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`missing patch anchor: ${label}`);
  return source.replace(before, after);
}

let guidance = fs.readFileSync(guidancePath, "utf8");

guidance = replaceOnce(
  guidance,
  'export const CAPITAL_ARRIVAL_GUIDANCE_VERSION = "capital-arrival-guidance-v1";',
  'export const CAPITAL_ARRIVAL_GUIDANCE_VERSION = "capital-arrival-guidance-v2";',
  "guidance version",
);

guidance = replaceOnce(
  guidance,
`  runtime.capitalArrivalGuidance ??= {
    version: CAPITAL_ARRIVAL_GUIDANCE_VERSION,
    suggestedAtMinute: null,
    visitedAtMinute: null,
  };
  runtime.capitalArrivalGuidance.version = CAPITAL_ARRIVAL_GUIDANCE_VERSION;
  runtime.capitalArrivalGuidance.suggestedAtMinute ??= null;
  runtime.capitalArrivalGuidance.visitedAtMinute ??= null;`,
`  runtime.capitalArrivalGuidance ??= {
    version: CAPITAL_ARRIVAL_GUIDANCE_VERSION,
    suggestedAtMinute: null,
    visitedAtMinute: null,
    firstInteractionCompletedAtMinute: null,
    firstInteractionChoiceId: null,
  };
  runtime.capitalArrivalGuidance.version = CAPITAL_ARRIVAL_GUIDANCE_VERSION;
  runtime.capitalArrivalGuidance.suggestedAtMinute ??= null;
  runtime.capitalArrivalGuidance.visitedAtMinute ??= null;
  runtime.capitalArrivalGuidance.firstInteractionCompletedAtMinute ??= null;
  runtime.capitalArrivalGuidance.firstInteractionChoiceId ??= null;`,
  "first interaction state",
);

guidance = replaceOnce(
  guidance,
`export function prioritizeCapitalWeaponShopMovement(actions, runtime) {`,
`export function capitalWeaponShopFirstInteractionActive(runtime) {
  const guidance = ensureCapitalArrivalGuidance(runtime);
  return guidance.visitedAtMinute != null
    && guidance.firstInteractionCompletedAtMinute == null
    && runtime?.playerState?.player?.facilityId === CAPITAL_WEAPON_SHOP_ID;
}

export function capitalWeaponShopFirstChoices(runtime, { shopkeeper = null } = {}) {
  if (!capitalWeaponShopFirstInteractionActive(runtime) || !shopkeeper?.id) return null;
  return [
    {
      id: "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE",
      family: "talk",
      type: "conversation",
      singleTurnConversation: true,
      capitalWeaponShopFirstChoice: true,
      targetNpcId: shopkeeper.id,
      targetNpcName: shopkeeper.name ?? "店主",
      dialogueTopic: "weapon_shop_first_style",
      minutes: 7,
      label: "どんな戦い方ができるか分からないと正直に話し、店主へ相談する",
      expectedChanges: ["capitalArrivalGuidance.firstInteractionCompletedAtMinute"],
    },
    {
      id: "CAPITAL_WEAPON_SHOP:FIRST:COMPARE_HANDLING",
      family: "investigate",
      type: "localInvestigate",
      capitalWeaponShopFirstChoice: true,
      localVariant: "weapon_handling_comparison",
      minutes: 18,
      label: "剣・槍・弓・杖を順に持ち、重さと間合いの違いを確かめる",
      expectedChanges: ["capitalArrivalGuidance.firstInteractionCompletedAtMinute"],
    },
    {
      id: "CAPITAL_WEAPON_SHOP:FIRST:SET_BUDGET",
      family: "prepare",
      type: "plan",
      capitalWeaponShopFirstChoice: true,
      minutes: 9,
      label: "手持ちの装備と所持金を見せ、無理なく選べる候補だけに絞る",
      expectedChanges: ["capitalArrivalGuidance.firstInteractionCompletedAtMinute"],
    },
  ];
}

export function completeCapitalWeaponShopFirstInteraction(runtime, {
  choiceId = null,
  absoluteMinute = runtime?.playerState?.absoluteMinute,
} = {}) {
  const guidance = ensureCapitalArrivalGuidance(runtime);
  if (guidance.firstInteractionCompletedAtMinute == null) {
    guidance.firstInteractionCompletedAtMinute = number(absoluteMinute);
    guidance.firstInteractionChoiceId = choiceId ? String(choiceId) : null;
  }
  return guidance;
}

export function prioritizeCapitalWeaponShopMovement(actions, runtime) {`,
  "first interaction helpers",
);

fs.writeFileSync(guidancePath, guidance, "utf8");

let authored = fs.readFileSync(authoredPath, "utf8");

authored = replaceOnce(
  authored,
`  Object.freeze({
    sceneId: "journey.capital_lower_inn.meal",`,
`  Object.freeze({
    sceneId: "journey.capital_weapon_shop.first_guided_arrival",
    priority: 890,
    presentationOnly: true,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "action.type", op: "eq", value: "move" }),
        Object.freeze({ path: "action.destinationFacilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
        Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
        Object.freeze({ path: "story.capitalWeaponShopFirstVisitNow", op: "isTrue", value: true }),
      ]),
    }),
    narrative: "坂を上がるにつれ、露店の声に混じって槌の音が近づく。王都武器屋の戸を押すと、油と革と削った木の匂いがした。壁には剣と槍、奥には弓と杖が、値札ではなく用途ごとに分けて並んでいる。店の中央だけ床が空けてあり、握りや構えを確かめるための場所だと分かる。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC065",
        text: "最初から一本に決める必要はない。剣は近く、槍は一歩遠く、弓はもっと遠く、杖は魔力の扱い方で変わる。まずは、怖くなった時にどう動けそうかを考えろ。買う話は、そのあとでいい。",
        emotion: "職人らしい落ち着き",
      }),
    ]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "journey.capital_weapon_shop.first.ask_style",
    priority: 885,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE" }),
      Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
      Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
    ]) }),
    narrative: "店主はすぐに商品を勧めず、旅装と立ち方を見比べた。何を倒したいかではなく、危険に出会った時に近づきたいか、距離を取りたいかを問い直してくる。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC065",
        text: "まだ分からないなら、それでいい。前へ出るのが怖くないなら剣か槍、距離を取りたいなら弓、術を軸にするなら杖だ。ただし旅では、狭い道や雨の日もある。格好ではなく、困った時にも扱える一本を選べ。",
        emotion: "率直な助言",
      }),
    ]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "journey.capital_weapon_shop.first.compare_handling",
    priority: 885,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: "CAPITAL_WEAPON_SHOP:FIRST:COMPARE_HANDLING" }),
      Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
      Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
    ]) }),
    narrative: "剣は腰の近くで収まり、槍は穂先より後ろの長さが気になる。弓は引く前に足場を要し、杖は振る武器というより集中する場所を定める道具だった。持ち替えるたび、同じ『武器』でも要求される距離と姿勢がまるで違うと分かる。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC065",
        text: "数値だけなら札を読めば済む。だが、狭い路地で槍を扱えるか、雨で弓弦を守れるか、疲れた時に杖へ魔力を通せるかは、持った本人にしか分からない。",
        emotion: "実地を重んじる口調",
      }),
    ]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "journey.capital_weapon_shop.first.set_budget",
    priority: 885,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: "CAPITAL_WEAPON_SHOP:FIRST:SET_BUDGET" }),
      Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
      Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
    ]) }),
    narrative: "所持金と今の装備を見せると、店主は高価な棚を先に閉じた。新品、中古、依頼の間だけ借りられる品を分け、帰りの食事代まで使い切らない範囲へ候補を絞っていく。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC065",
        text: "武器を買って、飯も宿も失うのが一番まずい。今日は試すだけでもいい。中古で間に合わせる手も、仕事に合わせて借りる手もある。旅を続けられる金を残して選べ。",
        emotion: "商売より旅の継続を優先",
      }),
    ]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "journey.capital_lower_inn.meal",`,
  "authored weapon shop scenes",
);

fs.writeFileSync(authoredPath, authored, "utf8");

let service = fs.readFileSync(servicePath, "utf8");

service = replaceOnce(
  service,
`import {
  CAPITAL_ARRIVAL_GUIDANCE_VERSION,
  ensureCapitalWeaponShopChoice,
  prioritizeCapitalWeaponShopMovement,
  recordCapitalArrivalGuidance,
} from "../resolvers/capital-arrival-guidance.js";`,
`import {
  CAPITAL_ARRIVAL_GUIDANCE_VERSION,
  capitalWeaponShopFirstChoices,
  capitalWeaponShopFirstInteractionActive,
  completeCapitalWeaponShopFirstInteraction,
  ensureCapitalWeaponShopChoice,
  prioritizeCapitalWeaponShopMovement,
  recordCapitalArrivalGuidance,
} from "../resolvers/capital-arrival-guidance.js";`,
  "guidance imports",
);

service = replaceOnce(
  service,
`  return null;
}

function dialogueFollowupActions(runtime) {`,
`  return null;
}

function capitalWeaponShopFirstChoiceActions(runtime, data) {
  if (!capitalWeaponShopFirstInteractionActive(runtime)) return null;
  const shopkeeper = presentNpcsAt(runtime, data).find((npc) => npc.id === "NPC065") ?? null;
  const choices = capitalWeaponShopFirstChoices(runtime, { shopkeeper });
  return choices ? withChoiceIds(choices) : null;
}

function dialogueFollowupActions(runtime) {`,
  "weapon shop first choice function",
);

service = replaceOnce(
  service,
`  const authored = openingChoiceActions(runtime);
  if (authored) return authored.map((action) => decorateWorkOfferAction(action, runtime, data, action.targetNpcId)).filter(Boolean);
  const workOfferChoices = pendingWorkOfferActions(runtime, data);`,
`  const authored = openingChoiceActions(runtime);
  if (authored) return authored.map((action) => decorateWorkOfferAction(action, runtime, data, action.targetNpcId)).filter(Boolean);
  const weaponShopFirstChoices = capitalWeaponShopFirstChoiceActions(runtime, data);
  if (weaponShopFirstChoices) return weaponShopFirstChoices;
  const workOfferChoices = pendingWorkOfferActions(runtime, data);`,
  "weapon shop first choice priority",
);

service = replaceOnce(
  service,
`  if (!result?.ok && result?.committed !== true) throw errorFromResult(result);
  if ((result?.ok || result?.committed === true)
    && pendingIntroductionAtStart`,
`  if (!result?.ok && result?.committed !== true) throw errorFromResult(result);
  if ((result?.ok || result?.committed === true) && resolvedPlayerAction?.capitalWeaponShopFirstChoice) {
    completeCapitalWeaponShopFirstInteraction(runtime, {
      choiceId: resolvedPlayerAction.id,
      absoluteMinute: runtime.playerState.absoluteMinute,
    });
  }
  if ((result?.ok || result?.committed === true)
    && pendingIntroductionAtStart`,
  "complete first weapon shop interaction",
);

service = replaceOnce(
  service,
`  if (action.type === "conversation"
    && action.targetNpcId
    && (!action.missionId || Boolean(action.requiredDisclosure))
    && !action.tutorialBeat) {`,
`  if (action.type === "conversation"
    && action.targetNpcId
    && (!action.missionId || Boolean(action.requiredDisclosure))
    && action.singleTurnConversation !== true
    && !action.tutorialBeat) {`,
  "single-turn shop conversation",
);

service = replaceOnce(
  service,
`    story: {
      t01ReunionNow: state.player.facilityId === "LOC_FARM_SQUARE"
        && t01Escort.reunionBeatAtMinute === state.absoluteMinute,
    },`,
`    story: {
      t01ReunionNow: state.player.facilityId === "LOC_FARM_SQUARE"
        && t01Escort.reunionBeatAtMinute === state.absoluteMinute,
      capitalWeaponShopFirstVisitNow: state.player.facilityId === "LOC_CAP_WEAPON_SHOP"
        && runtime.capitalArrivalGuidance?.visitedAtMinute === state.absoluteMinute,
    },`,
  "authored first shop visit context",
);

fs.writeFileSync(servicePath, service, "utf8");

let guidanceTest = fs.readFileSync(guidanceTestPath, "utf8");

guidanceTest = replaceOnce(
  guidanceTest,
`  CAPITAL_WEAPON_SHOP_ID,
  capitalWeaponShopGuidanceActive,
  ensureCapitalWeaponShopChoice,`,
`  CAPITAL_WEAPON_SHOP_ID,
  capitalWeaponShopFirstChoices,
  capitalWeaponShopFirstInteractionActive,
  capitalWeaponShopGuidanceActive,
  completeCapitalWeaponShopFirstInteraction,
  ensureCapitalWeaponShopChoice,`,
  "guidance test imports",
);

if (!guidanceTest.includes("offers one reviewed first-interaction set")) {
  guidanceTest += `

test("the first weapon-shop visit offers one reviewed first-interaction set", () => {
  const runtime = runtimeAt("LOC_CAP_LOWER_INN");
  recordCapitalArrivalGuidance(runtime);
  runtime.playerState.player.facilityId = CAPITAL_WEAPON_SHOP_ID;
  runtime.playerState.absoluteMinute += 20;
  recordCapitalArrivalGuidance(runtime);

  assert.equal(capitalWeaponShopFirstInteractionActive(runtime), true);
  const choices = capitalWeaponShopFirstChoices(runtime, {
    shopkeeper: { id: "NPC065", name: "武器屋の店主" },
  });
  assert.deepEqual(choices.map((choice) => choice.id), [
    "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE",
    "CAPITAL_WEAPON_SHOP:FIRST:COMPARE_HANDLING",
    "CAPITAL_WEAPON_SHOP:FIRST:SET_BUDGET",
  ]);
  assert.deepEqual(choices.map((choice) => choice.family), ["talk", "investigate", "prepare"]);

  completeCapitalWeaponShopFirstInteraction(runtime, { choiceId: choices[1].id });
  assert.equal(capitalWeaponShopFirstInteractionActive(runtime), false);
  assert.equal(capitalWeaponShopFirstChoices(runtime, { shopkeeper: { id: "NPC065" } }), null);
  assert.equal(runtime.capitalArrivalGuidance.firstInteractionChoiceId, choices[1].id);
});
`;
}

fs.writeFileSync(guidanceTestPath, guidanceTest, "utf8");

let authoredTest = fs.readFileSync(authoredTestPath, "utf8");

if (!authoredTest.includes("first guided weapon-shop visit uses reviewed prose")) {
  authoredTest += `

test("the first guided weapon-shop visit uses reviewed prose and a one-use choice set", () => {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed: "authored-capital-weapon-shop-first-visit",
    profileId: "balanced",
    playerName: "旅人",
    tutorial: false,
  });
  runtime.playerState.tuning.disableTravelEncounters = true;
  runtime.playerKnowledge.knownHubIds.add("王都");

  const capitalMove = availableGameRuntimeActions(runtime, game.data).movement
    .find((entry) => entry.destinationHub === "王都");
  assert.ok(capitalMove);
  executeGameRuntimeCommand(runtime, game.data, {
    type: "MOVE",
    payload: { moveId: capitalMove.id },
  });

  const weaponShopMove = availableGameRuntimeActions(runtime, game.data).movement
    .find((entry) => entry.destinationFacilityId === "LOC_CAP_WEAPON_SHOP");
  assert.ok(weaponShopMove);
  const arrivalResult = executeGameRuntimeCommand(runtime, game.data, {
    type: "MOVE",
    payload: { moveId: weaponShopMove.id },
  });
  const arrival = resolveReviewedAuthoredPresentation(runtime, game.data, arrivalResult, arrivalResult.outcome);
  assert.equal(arrival?.sceneId, "journey.capital_weapon_shop.first_guided_arrival");
  assert.match(arrival.narrative, /剣.*槍.*弓.*杖/u);
  assert.equal(arrival.speeches.some((speech) => speech.actorId === "NPC065"), true);

  const firstChoices = availableGameRuntimeActions(runtime, game.data).choices;
  assert.deepEqual(firstChoices.map((choice) => choice.id), [
    "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE",
    "CAPITAL_WEAPON_SHOP:FIRST:COMPARE_HANDLING",
    "CAPITAL_WEAPON_SHOP:FIRST:SET_BUDGET",
  ]);
  assert.equal(new Set(firstChoices.map((choice) => choice.label)).size, 3);

  const selected = firstChoices.find((choice) => choice.id === "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE");
  const consultationResult = executeGameRuntimeCommand(runtime, game.data, {
    type: "CHOOSE",
    payload: { choiceId: selected.choiceId, actionId: selected.id },
  });
  const consultation = resolveReviewedAuthoredPresentation(runtime, game.data, consultationResult, consultationResult.outcome);
  assert.equal(consultation?.sceneId, "journey.capital_weapon_shop.first.ask_style");
  assert.match(consultation.speeches[0]?.text ?? "", /剣か槍.*弓.*杖/u);

  const laterChoiceIds = availableGameRuntimeActions(runtime, game.data).choices.map((choice) => choice.id);
  assert.equal(laterChoiceIds.some((id) => id.startsWith("CAPITAL_WEAPON_SHOP:FIRST:")), false);
  assert.equal(runtime.dialogueSession, null, "the authored consultation is one complete exchange, not a generic dialogue loop");
});

test("each first weapon-shop decision has a reviewed consequence scene", () => {
  const cases = [
    ["CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE", "journey.capital_weapon_shop.first.ask_style"],
    ["CAPITAL_WEAPON_SHOP:FIRST:COMPARE_HANDLING", "journey.capital_weapon_shop.first.compare_handling"],
    ["CAPITAL_WEAPON_SHOP:FIRST:SET_BUDGET", "journey.capital_weapon_shop.first.set_budget"],
  ];
  for (const [actionId, sceneId] of cases) {
    const scene = resolveAuthoredScene({
      action: { id: actionId },
      outcome: { ok: true },
      location: { facilityId: "LOC_CAP_WEAPON_SHOP" },
    });
    assert.equal(scene?.sceneId, sceneId);
    assert.equal(validateAuthoredScene(scene).valid, true);
  }
});
`;
}

fs.writeFileSync(authoredTestPath, authoredTest, "utf8");
