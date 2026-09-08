#!/usr/bin/env node
import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`${path}: expected patch anchor missing`);
  const next = source.replace(before, after);
  if (next === source) throw new Error(`${path}: patch produced no change`);
  fs.writeFileSync(path, next);
}

// A currently legal Sheet-backed shift is the most time-sensitive ordinary-life
// choice. Keep it ahead of meals/products so the final three-choice selector
// cannot hide a narrow work window behind two always-visible counter products.
replaceOnce(
  'src/server/trpg/content/authored-mission-flow-registry.js',
`  const commonLayerActions = actions.map((action) => ({
    ...action,
    authoredMissionFlowExclusiveChoice: false,
  }));
  const combined = [
    ...products,
    ...commonLayerActions,
    ...conversations,`,
`  const commonLayerActions = actions.map((action) => ({
    ...action,
    authoredMissionFlowExclusiveChoice: false,
  }));
  const canonicalLabour = commonLayerActions
    .filter((action) => action?.canonicalRegionalLabourChoice === true);
  const otherCommonLife = commonLayerActions
    .filter((action) => action?.canonicalRegionalLabourChoice !== true
      && action?.canonicalWorldLifeChoice !== true);
  const combined = [
    ...canonicalLabour,
    ...products,
    ...otherCommonLife,
    ...conversations,`,
);

replaceOnce(
  'src/server/trpg/content/authored-register-butterfly-relay.js',
`export const AUTHORED_REGISTER_BUTTERFLY_RELAY_VERSION = "authored-register-butterfly-relay-v4";`,
`export const AUTHORED_REGISTER_BUTTERFLY_RELAY_VERSION = "authored-register-butterfly-relay-v5";`,
);

replaceOnce(
  'src/server/trpg/content/authored-register-butterfly-relay.js',
`const RELAY_PLAN_ID = "GOAP-F-RONA-RELAY-REGISTERED-RESCUER";`,
`const RELAY_PLAN_ID = "GOAP-F-RONA-RELAY-REGISTERED-RESCUER";
const RELAY_TRAVEL_HISTORY = "F_RONA_RELAY_CONTACT_TRAVEL_STARTED";
const LOCAL_RELAY_TRAVEL_HOURS = 0.5;`,
);

replaceOnce(
  'src/server/trpg/content/authored-register-butterfly-relay.js',
`  // Lorna is the inn-side source of this fact. Chasing a roaming merchant's
  // current facility one tick late made the two NPCs perpetually miss each
  // other. The causal rendezvous is therefore Wheat Inn itself: Lorna remains
  // at the place where the guestbook evidence exists, and Riona's ordinary
  // merchant route can bring her there. The common NPC conversation engine is
  // still the only authority that creates the Rona -> Riona share.
  const targetHub = LOCATION;
  const targetFacilityId = INN_FACILITY_ID;
  const relayPlan = {
    id: RELAY_PLAN_ID,
    npcIds: [RONA_ID],
    goal: "tell-riona-the-registered-rescuer-link-in-person",
    action: "share-register-link-with-riona",
    targetHub,
    targetFacilityId,
    delayHours: 0,
    statusText: "宿帳とフィン救助を照合した内容を、麦穂亭へ立ち寄る行商人リオナへ直接伝えるため待っている",
    reason: "registered-rescuer-rumor-needs-real-contact-at-source-record",
  };`,
`  // This fact is conversation-only, so the source must physically meet Riona.
  // Keep the authored duty aimed at Riona's actual current village facility;
  // the command-side driver below starts a real localTravel instead of copying
  // knowledge, changing currentGoal, or teleporting either NPC.
  const targetHub = riona?.position?.hubId ?? riona?.location ?? LOCATION;
  const targetFacilityId = npcFacility(riona) ?? INN_FACILITY_ID;
  const relayPlan = {
    id: RELAY_PLAN_ID,
    npcIds: [RONA_ID],
    goal: "tell-riona-the-registered-rescuer-link-in-person",
    action: "share-register-link-with-riona",
    targetHub,
    targetFacilityId,
    delayHours: 0,
    statusText: "宿帳とフィン救助を照合した内容を、村内で行商人リオナへ直接伝えに向かっている",
    reason: "registered-rescuer-rumor-needs-real-physical-contact",
  };`,
);

replaceOnce(
  'src/server/trpg/content/authored-register-butterfly-relay.js',
`  // Completing the authored duty while the listener is absent is not a real
  // disclosure. Re-open it and keep Lorna at the inn until a later life tick
  // places Riona there too; prepareNpcLifeTick will then create the common
  // facility conversation before either NPC chooses a new routine action.
  if (arr(lorna.completedAftermathPlanIds).includes(RELAY_PLAN_ID)
    && (npcFacility(lorna) !== targetFacilityId || npcFacility(riona) !== targetFacilityId)) {
    lorna.completedAftermathPlanIds = arr(lorna.completedAftermathPlanIds)
      .filter((id) => id !== RELAY_PLAN_ID);
  }
  return relayPlan;
}`,
`  // Completing a travel duty without an actual share is not disclosure. Reopen
  // it until the common physical conversation engine creates the share event.
  if (arr(lorna.completedAftermathPlanIds).includes(RELAY_PLAN_ID)
    && !relayShareEvent(runtime)) {
    lorna.completedAftermathPlanIds = arr(lorna.completedAftermathPlanIds)
      .filter((id) => id !== RELAY_PLAN_ID);
  }
  return relayPlan;
}

function driveRelayContact(runtime) {
  const relayPlan = ensureRelayPlan(runtime);
  const lorna = state(runtime, RONA_ID);
  const riona = state(runtime, RIONA_ID);
  const belief = lorna?.beliefs?.[FACT_ID];
  if (!relayPlan || !belief || unavailable(lorna) || unavailable(riona)) return null;
  if (riona?.beliefs?.[FACT_ID] || relayShareEvent(runtime)) return null;
  if (lorna.travel || riona.travel || riona.localTravel) return null;
  if (lorna.localTravel) return lorna.localTravel;
  if (String(lorna.presence ?? "present") !== "present"
    || String(riona.presence ?? "present") !== "present") return null;

  const lornaHub = lorna?.position?.hubId ?? lorna?.location ?? null;
  const rionaHub = riona?.position?.hubId ?? riona?.location ?? null;
  const fromFacilityId = npcFacility(lorna);
  const toFacilityId = npcFacility(riona);
  if (!lornaHub || lornaHub !== rionaHub || !toFacilityId || fromFacilityId === toFacilityId) return null;

  const departedAt = minute(runtime) / 60;
  const travel = {
    routeId: `LOCAL:${lornaHub}:${fromFacilityId ?? "@hub"}->${toFacilityId}`,
    hubId: lornaHub,
    fromFacilityId,
    toFacilityId,
    departedAt,
    arriveAt: departedAt + LOCAL_RELAY_TRAVEL_HOURS,
  };
  lorna.localTravel = travel;
  lorna.presence = "traveling";
  runtime.playerState.history ??= [];
  runtime.playerState.history.push({
    type: RELAY_TRAVEL_HISTORY,
    minute: minute(runtime),
    npcId: RONA_ID,
    targetNpcId: RIONA_ID,
    factId: FACT_ID,
    relayPlanId: RELAY_PLAN_ID,
    fromFacilityId,
    toFacilityId,
    durationMinutes: LOCAL_RELAY_TRAVEL_HOURS * 60,
  });
  return travel;
}`,
);

replaceOnce(
  'src/server/trpg/content/authored-register-butterfly-relay.js',
`export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  synchronizeRegisterButterfly(runtime);
  return changed;
}`,
`export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  synchronizeRegisterButterfly(runtime);
  // Movement is command-driven only. Pure views/synchronization never move an
  // NPC, while the next normal world tick settles this 30-minute local travel
  // and lets the generic co-presence conversation engine create the real share.
  driveRelayContact(runtime);
  return changed;
}`,
);

replaceOnce(
  'src/server/trpg/content/authored-register-butterfly-relay.js',
`  RELAY_PLAN_ID,
  relayShareEvent,
  ensureRelayPlan,
  observeRelayShare,
  relayAwareCallbackEligible,`,
`  RELAY_PLAN_ID,
  RELAY_TRAVEL_HISTORY,
  LOCAL_RELAY_TRAVEL_HOURS,
  relayShareEvent,
  ensureRelayPlan,
  driveRelayContact,
  observeRelayShare,
  relayAwareCallbackEligible,`,
);

const relayTest = `import assert from "node:assert/strict";\nimport test from "node:test";\n\nimport { AUTHORED_REGISTER_BUTTERFLY_RELAY_INTERNALS as relay } from "../../../src/server/trpg/content/authored-register-butterfly-relay.js";\n\nconst FACT_ID = "F-FACT-REGISTERED-FINN-RESCUER";\n\nfunction runtime({ sameFacility = false } = {}) {\n  return {\n    playerState: { absoluteMinute: 2431, history: [], player: { location: "田園の村", facilityId: "LOC_FARM_SQUARE" } },\n    livingWorld: {\n      knowledgeEvents: [],\n      npcStates: {\n        NPC058: {\n          lifeStatus: "alive", presence: "present", location: "田園の村",\n          position: { hubId: "田園の村", facilityId: "LOC_FARM_INN" },\n          localTravel: null, travel: null, completedAftermathPlanIds: [],\n          beliefs: { [FACT_ID]: { factId: FACT_ID, kind: "trouble", troubleStatus: "resolved", aftermathPlans: [] } },\n        },\n        NPC008: {\n          lifeStatus: "alive", presence: "present", location: "田園の村",\n          position: { hubId: "田園の村", facilityId: sameFacility ? "LOC_FARM_INN" : "LOC_FARM_CHIEF" },\n          localTravel: null, travel: null, completedAftermathPlanIds: [], beliefs: {},\n        },\n      },\n    },\n  };\n}\n\ntest("F relay starts a real 30-minute local travel from Rona to Riona after a command without copying knowledge", () => {\n  const state = runtime();\n  const playerBefore = structuredClone(state.playerState.player);\n  const travel = relay.driveRelayContact(state);\n  assert.ok(travel);\n  assert.equal(state.livingWorld.npcStates.NPC058.presence, "traveling");\n  assert.deepEqual(state.livingWorld.npcStates.NPC058.position, { hubId: "田園の村", facilityId: "LOC_FARM_INN" });\n  assert.equal(travel.fromFacilityId, "LOC_FARM_INN");\n  assert.equal(travel.toFacilityId, "LOC_FARM_CHIEF");\n  assert.equal(travel.arriveAt - travel.departedAt, 0.5);\n  assert.equal(state.livingWorld.npcStates.NPC008.beliefs[FACT_ID], undefined);\n  assert.deepEqual(state.playerState.player, playerBefore);\n  assert.equal(state.livingWorld.knowledgeEvents.length, 0);\n  assert.equal(state.playerState.history.at(-1).type, relay.RELAY_TRAVEL_HISTORY);\n});\n\ntest("F relay does not synthesize movement or a share when the two NPCs are already co-present", () => {\n  const state = runtime({ sameFacility: true });\n  assert.equal(relay.driveRelayContact(state), null);\n  assert.equal(state.livingWorld.npcStates.NPC058.localTravel, null);\n  assert.equal(state.livingWorld.npcStates.NPC008.beliefs[FACT_ID], undefined);\n  assert.equal(state.livingWorld.knowledgeEvents.length, 0);\n});\n`;
fs.writeFileSync('tools/trpg-sim/test/authored-register-butterfly-relay-contact.test.mjs', relayTest);

const bakeryTestPath = 'tools/trpg-sim/test/authored-village-bakery-evening.test.mjs';
let bakeryTest = fs.readFileSync(bakeryTestPath, 'utf8');
const marker = 'Day3 16:00 inn keeps the legal Sheet-backed dishwashing shift ahead of public meals';
if (!bakeryTest.includes(marker)) {
  bakeryTest += `\n\ntest("${marker}", () => {\n  const state = runtime({ wallMinute: 16 * 60, facilityId: "LOC_FARM_INN", hunger: 43, fatigue: 32 });\n  state.playerState.absoluteMinute = absoluteMinuteFor(3, 16 * 60);\n  state.playerState.day = 3;\n  const actions = authoredMissionFlowExclusiveActions(state);\n  assert.equal(actions[0]?.id, "WORK:FACILITY:JOB-FARM-03");\n  assert.ok(actions.some((action) => action.id === "LIFE:EAT:ITM003"));\n  assert.ok(actions.some((action) => action.id === "LIFE:EAT:ITM004"));\n  assert.ok(actions.some((action) => action.authoredDailyLifeChoice === true));\n});\n`;
  fs.writeFileSync(bakeryTestPath, bakeryTest);
}

console.log('Day3 labour priority and F physical relay patch applied');
