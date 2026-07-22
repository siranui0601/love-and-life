export const T01_RESCUE_SCENES = Object.freeze([
  Object.freeze({
    sceneId: "t01.search.boot_tracks",
    priority: 1050,
    presentationOnly: true,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "mission.id", op: "eq", value: "MSN-T01" }),
        Object.freeze({ path: "mission.stepId", op: "eq", value: "search" }),
        Object.freeze({ path: "outcome.discovery.id", op: "eq", value: "T01-CLUE-BOOT-TRACKS" }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_FARM_EDGE" }),
      ]),
    }),
    narrative: "小さな靴跡は村へ戻らず、折れた草の列に沿って古い見張り小屋へ続いている。土はまだ湿り、足跡の縁も崩れていない。子どもがここを通ってから、それほど時間は経っていない。",
    beats: Object.freeze([]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "t01.search.dropped_map_and_voice",
    priority: 1040,
    presentationOnly: true,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "mission.id", op: "eq", value: "MSN-T01" }),
        Object.freeze({ path: "mission.stepId", op: "eq", value: "search" }),
        Object.freeze({ path: "outcome.discovery.id", op: "eq", value: "T01-CLUE-DROPPED-MAP" }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_FARM_EDGE" }),
      ]),
    }),
    narrative: "泥の中から拾い上げた古い地図には、見張り小屋の裏から崩れた斜面へ抜ける細道が書き込まれている。地図と周囲を見比べた時、風の切れ間に、斜面の下から子どもの弱い声が届いた。『だれか……いるの？　狼が……』。フィンは、まだ生きている。",
    beats: Object.freeze([]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "t01.search.faint_voice",
    priority: 1035,
    presentationOnly: true,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "mission.id", op: "eq", value: "MSN-T01" }),
        Object.freeze({ path: "mission.stepId", op: "eq", value: "search" }),
        Object.freeze({ path: "outcome.discovery.id", op: "eq", value: "T01-CLUE-FAINT-VOICE" }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_FARM_EDGE" }),
      ]),
    }),
    narrative: "獣の唸り声が止んだ一瞬、崩れた斜面の下から子どものかすれた声が届いた。『だれか……いるの？　狼が、まだ近くに……』。声の位置は分かった。フィンはまだ生きているが、すぐそばを赤牙狼がうろついている。",
    beats: Object.freeze([]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "t01.rescue.after_battle",
    priority: 1030,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "mission.id", op: "eq", value: "MSN-T01" }),
        Object.freeze({ path: "mission.stepId", op: "eq", value: "rescue" }),
        Object.freeze({ path: "outcome.battle.won", op: "isTrue", value: true }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_FARM_EDGE" }),
      ]),
    }),
    narrative: "最後の赤牙狼が倒れると、斜面の下から咳き込む声が返った。泥と血にまみれた少年が木の根に背を預け、傷ついた脚を押さえながらこちらを見上げている。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC001",
        text: "……聞こえた？　僕、フィン。来てくれてありがとう。足が動かないんだ。置いていかないで……村の広場まで、一緒に戻ってほしい。",
        emotion: "安堵と痛み",
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
  Object.freeze({
    sceneId: "t01.escort.request",
    priority: 1020,
    presentationOnly: true,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "action.id", op: "eq", value: "ACTION:MSN-T01:escort" }),
        Object.freeze({ path: "mission.id", op: "eq", value: "MSN-T01" }),
        Object.freeze({ path: "mission.stepId", op: "eq", value: "escort" }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_FARM_EDGE" }),
      ]),
    }),
    narrative: "斜面を降りてフィンのそばへしゃがむ。脚には体重をかけられず、狼がいなくなっても、一人で村へ戻れる状態ではない。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC001",
        text: "ごめん……足が動かない。母さんが待ってるから、村へ帰りたい。途中で休んでもいいから、肩を貸して。僕をここに置いていかないで。",
        emotion: "痛みと不安",
      }),
    ]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "t01.escort.reunion_arrival",
    priority: 1010,
    presentationOnly: true,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "action.type", op: "eq", value: "move" }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_FARM_SQUARE" }),
        Object.freeze({ path: "story.t01ReunionNow", op: "isTrue", value: true }),
      ]),
    }),
    narrative: "フィンに肩を貸して広場へ入ると、捜索の相談をしていた人々が一斉に振り向いた。ミラが息子の名を呼びながら駆け寄り、ガロも張り詰めていた息をようやく吐く。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC001",
        text: "母さん……ただいま。心配かけて、ごめんなさい。この人が狼から助けて、ここまで連れてきてくれたんだ。",
        emotion: "安堵",
      }),
      Object.freeze({
        kind: "npc",
        actorId: "NPC002",
        text: "フィン！　よかった……本当に、生きて帰ってきてくれてよかった。旅人さん、この子を助けてくださって、ありがとうございます。",
        emotion: "涙と安堵",
      }),
      Object.freeze({
        kind: "npc",
        actorId: "NPC003",
        text: "村を預かる者として礼を言う。少年を見つけ、危険な道を連れ帰ってくれたことを、村は忘れない。",
        emotion: "深い感謝",
      }),
    ]),
    choices: Object.freeze([]),
  }),
]);
