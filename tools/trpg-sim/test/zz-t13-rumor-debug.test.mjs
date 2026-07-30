import assert from "node:assert/strict";
import test from "node:test";
import {
  gameStateHash,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";
import { MemoryTrpgSaveStore } from "../../../src/server/trpg/game/save-store.js";
import { deserializeRuntime, serializeRuntime } from "../../../src/server/trpg/game/serializer.js";

const owner = "t13-rumor-debug-owner";

function commandRunner(game, initial) {
  let save = initial;
  let sequence = 0;
  return {
    get save() { return save; },
    async run(type, payload) {
      const response = await game.command(owner, save.id, {
        commandId: `t13-debug-${++sequence}`,
        expectedRevision: save.revision,
        type,
        payload,
      });
      save = response.save;
      return response;
    },
  };
}

async function acknowledgeVisibleIntroduction(runner) {
  const beat = runner.save.scene.beats.find((entry) => entry.introductionToken);
  if (!beat) return false;
  await runner.run("ACK_NPC_INTRODUCTION", { token: beat.introductionToken });
  return true;
}

async function completeOpening(runner) {
  const choose = async (actionId) => {
    const action = runner.save.choices.find((entry) => entry.actionId === actionId);
    assert.ok(action, `${actionId} must be available`);
    await runner.run("CHOOSE", { choiceId: action.choiceId });
  };
  await choose("TUTORIAL:AWAKEN:LISTEN");
  await choose("TUTORIAL:CONTACT:WHERE");
  await acknowledgeVisibleIntroduction(runner);
  await choose("TUTORIAL:ORIENT:VOICES");
  const square = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FARM_SQUARE");
  await runner.run("MOVE", { moveId: square.moveId });
  await choose("TUTORIAL:INQUIRY:MIRA");
  await acknowledgeVisibleIntroduction(runner);
}

test("diagnose the forest-rumor T13 mission transition", async () => {
  const store = new MemoryTrpgSaveStore();
  const game = new TrpgGameService({ store, allowCustomSeed: true });
  const initial = await game.create(owner, { playerName: "聞き手", profileId: "story", seed: "forest-rumor" });
  let runner = commandRunner(game, initial);
  await completeOpening(runner);

  let record = await store.get(runner.save.id);
  let runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  runtime.playerKnowledge.knownHubIds.add("森");
  runtime.playerKnowledge.knownFacilityIds.add("LOC_FOREST_EDGE");
  record.runtimeSnapshot = serializeRuntime(runtime);
  record.stateHash = gameStateHash(runtime, game.data);
  await store.put(record);

  runner = commandRunner(game, await game.get(owner, runner.save.id));
  const forest = runner.save.movement.find((move) => move.destinationFacilityId === "LOC_FOREST_EDGE");
  await runner.run("MOVE", { moveId: forest.moveId });

  record = await store.get(runner.save.id);
  runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  const pool = runtime.livingWorld.facilityRumors?.["LOC_FOREST_EDGE"];
  const poolRows = pool instanceof Map ? [...pool.values()].map((entry) => {
    const belief = entry?.belief ?? entry;
    return {
      factId: belief?.factId,
      troubleId: belief?.troubleId ?? belief?.troubleIds?.[0] ?? null,
      importance: belief?.importance,
      propagationAt: entry?.propagationAt ?? belief?.propagationAt,
      text: belief?.text,
    };
  }) : [];
  console.log("T13_RUMOR_BEFORE", JSON.stringify({
    minute: runtime.playerState.absoluteMinute,
    mission: runtime.playerState.missions?.["MSN-T13"],
    trouble: runtime.playerState.troubles?.T13,
    knownRumorIds: [...runtime.playerState.player.knownRumorIds],
    poolRows,
  }));

  const hearLocal = runner.save.choices.find((choice) => choice.type === "localInvestigate");
  const response = await runner.run("CHOOSE", { choiceId: hearLocal.choiceId });
  record = await store.get(runner.save.id);
  runtime = deserializeRuntime(record.runtimeSnapshot, game.data);
  console.log("T13_RUMOR_AFTER", JSON.stringify({
    outcome: response.save.scene.lastOutcome,
    publicMissionIds: response.save.missions.map((mission) => mission.id),
    mission: runtime.playerState.missions?.["MSN-T13"],
    knownRumors: [...runtime.playerState.player.knownRumorIds].map((id) => ({
      id,
      troubleId: runtime.playerState.rumorById?.[id]?.troubleId ?? null,
      text: runtime.playerState.rumorById?.[id]?.text ?? null,
    })),
    recentHistory: runtime.playerState.history.slice(-12),
  }));
});
