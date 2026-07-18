import test from "node:test";
import assert from "node:assert/strict";
import { createTrpgNarrator } from "../../../src/server/trpg/gemini-narrator.js";
import { createNarrativeReplayCache } from "../../../src/server/trpg/narrative-cache.js";
import { buildLocalNarrativeContext } from "../../../src/server/trpg/narrative-contract.js";

function scenario() {
  return {
    action: { id: "ACT-1", type: "talk", label: "衛兵に話を聞く", targetNpcId: "NPC-LOCAL" },
    authoritativeState: {
      day: 2,
      hour: 12,
      minute: 15,
      daypart: "day",
      locationId: "田園の村",
      facilityId: "FAC-1",
      facilityName: "村の広場",
      presentNpcIds: ["NPC-LOCAL"],
      npcs: [
        { id: "NPC-LOCAL", name: "村の衛兵", role: "衛兵", mood: "警戒中" },
        { id: "NPC-REMOTE", name: "王都の司書", role: "司書", mood: "勤務中" },
      ],
      missions: [{ id: "MSN-T01", title: "少年を助ける", troubleId: "T01", targetLocations: ["田園の村"] }],
      localRumors: [{ id: "RUM-T01-active", troubleId: "T01", text: "少年が戻らない" }],
      player: { displayName: "旅人" },
      authoritativeOutcome: { kind: "conversation_started", summary: "衛兵が話せる状態になった" },
    },
  };
}

test("local narrative context excludes NPCs who are not present", () => {
  const built = buildLocalNarrativeContext(scenario());
  assert.deepEqual(built.audit.includedNpcIds, ["NPC-LOCAL"]);
  assert.deepEqual(built.audit.excludedNpcIds, ["NPC-REMOTE"]);
  assert.equal(built.context.localNpcs.length, 1);
  assert.equal(JSON.stringify(built.context).includes("王都の司書"), false);
});

test("invalid Gemini output is repaired and exact replay bypasses the provider", async () => {
  const calls = [];
  const provider = {
    async generate(payload) {
      calls.push(payload.mode);
      if (payload.mode === "primary") {
        return JSON.stringify({
          narrative: "衛兵と話す。",
          choices: [
            { id: "C1", label: "聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
            { id: "C2", label: "見る", intentType: "observe" },
          ],
          speeches: [{ actorId: "NPC-REMOTE", text: "遠隔地から話す" }],
          proposals: [],
        });
      }
      return JSON.stringify({
        narrative: "衛兵は村の広場で知っている範囲を話した。",
        choices: [
          { id: "C1", label: "詳しく聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
          { id: "C2", label: "周囲を見る", intentType: "observe", targetNpcId: null },
          { id: "C3", label: "会話を終える", intentType: "leave", targetNpcId: null },
        ],
        speeches: [{ actorId: "NPC-LOCAL", text: "村外れで足跡を見た。", emotion: "serious" }],
        proposals: [{
          type: "npc_intent",
          targetNpcId: "NPC-LOCAL",
          intent: "verify_tracks",
          reason: "その場で確認できる情報だから",
        }],
      });
    },
  };
  const narrator = createTrpgNarrator({
    provider,
    cache: createNarrativeReplayCache({ memoryOnly: true }),
    memoryOnlyCache: true,
  });
  const first = await narrator.generate(scenario(), { allowedTroubleIds: ["T01"] });
  const second = await narrator.generate(scenario(), { allowedTroubleIds: ["T01"] });
  assert.equal(first.choices.length, 3);
  assert.equal(first.speeches[0].actorId, "NPC-LOCAL");
  assert.equal(first.meta.validAfterRepair, true);
  assert.deepEqual(calls, ["primary", "repair"]);
  assert.equal(second.meta.source, "replay_cache");
  assert.equal(second.meta.providerCalls, 0);
  assert.equal(second.narrative, first.narrative);
  assert.deepEqual(second.choices, first.choices);
});

test("authoritative mutations and unknown missions are rejected as candidates", async () => {
  const provider = {
    async generate() {
      return JSON.stringify({
        narrative: "話を聞いた。",
        choices: [
          { id: "C1", label: "聞く", intentType: "ask", targetNpcId: "NPC-LOCAL" },
          { id: "C2", label: "見る", intentType: "observe", targetNpcId: null },
          { id: "C3", label: "戻る", intentType: "leave", targetNpcId: null },
        ],
        speeches: [],
        proposals: [{
          type: "special_mission_candidate",
          templateId: "unknown-template",
          troubleId: "T99",
          reason: "勝手に作った任務",
        }],
      });
    },
  };
  const narrator = createTrpgNarrator({
    provider,
    cache: createNarrativeReplayCache({ memoryOnly: true }),
    memoryOnlyCache: true,
  });
  const result = await narrator.generate(scenario(), {
    allowedMissionTemplateIds: ["local-investigation"],
    allowedTroubleIds: ["T01"],
  });
  assert.equal(result.proposalResolution.accepted.length, 0);
  assert.equal(result.proposalResolution.rejected.length, 1);
  assert.equal(result.proposalResolution.rejected[0].reason, "unknown_mission_template");
});
