export const T01_RESCUE_SCENES = Object.freeze([
  Object.freeze({
    sceneId: "t01.rescue.after_battle",
    priority: 1000,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "mission.id", op: "eq", value: "MSN-T01" }),
        Object.freeze({ path: "mission.stepId", op: "eq", value: "rescue" }),
        Object.freeze({ path: "outcome.battle.won", op: "isTrue", value: true }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_FARM_EDGE" }),
      ]),
    }),
    narrative: "狼の気配が遠のく。斜面の下では、泥と血にまみれた青年が木の根に背を預け、浅い呼吸を繰り返している。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC001",
        text: "……助かった。俺はフィンだ。足をやられて、一人では村まで戻れそうにない。悪いけど、肩を貸してくれないか。",
        emotion: "痛みをこらえる",
      }),
    ]),
    choices: Object.freeze([
      Object.freeze({
        id: "T01:FINN:ASK_ATTACK",
        family: "talk",
        label: "何に襲われ、どう逃げたのかフィンに確認する",
        targetNpcId: "NPC001",
        command: Object.freeze({ type: "TALK", npcId: "NPC001", topicId: "t01_attack_details" }),
        gainedFactIds: Object.freeze(["T01_ATTACK_DETAILS"]),
        expectedChanges: Object.freeze(["playerKnowledge.facts.T01_ATTACK_DETAILS"]),
      }),
      Object.freeze({
        id: "T01:FINN:ESCORT_SQUARE",
        family: "move",
        label: "フィンを支え、村の広場へ戻る",
        command: Object.freeze({
          type: "MOVE_WITH_COMPANION",
          companionNpcId: "NPC001",
          targetFacilityId: "LOC_FARM_SQUARE",
        }),
        expectedChanges: Object.freeze(["player.facilityId", "escort.NPC001.arrivedSquare"]),
      }),
      Object.freeze({
        id: "T01:FINN:SECURE_RETURN",
        family: "prepare",
        label: "傷と周囲を確かめ、安全に運ぶ準備を整える",
        targetNpcId: "NPC001",
        command: Object.freeze({ type: "PREPARE_ESCORT", npcId: "NPC001", targetFacilityId: "LOC_FARM_SQUARE" }),
        expectedChanges: Object.freeze(["escort.NPC001.prepared", "time.absoluteMinute"]),
      }),
    ]),
  }),
]);
