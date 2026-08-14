import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyAuthoredMissionFlowAction,
  authoredMissionFlowExclusiveActions,
  authoredMissionFlowGuidance,
  AUTHORED_FACILITY_LABOUR_INTERNALS as labour,
} from "../../../src/server/trpg/content/authored-mission-flow-registry.js";

const DAY20_MORNING = 19 * 1440 + 8 * 60;

// 正本（スプレッドシート「TRPG」拠点一覧）の写しから施設IDを拾う。
const WORLD_SNAPSHOT = JSON.parse(
  readFileSync(new URL("../fixtures/world.snapshot.json", import.meta.url), "utf8"),
);

function collectFacilityIds(value, found = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectFacilityIds(entry, found);
  } else if (value && typeof value === "object") {
    for (const entry of Object.values(value)) collectFacilityIds(entry, found);
  } else if (typeof value === "string" && /^LOC_[A-Z0-9_]+$/u.test(value)) {
    found.add(value);
  }
  return found;
}

const CANONICAL_FACILITY_IDS = collectFacilityIds(WORLD_SNAPSHOT.tabs);

function runtime({
  facilityId = "LOC_TRADE_PORT",
  location = "交易都市",
  gold = 2,
  hunger = 60,
  minute = DAY20_MORNING,
} = {}) {
  return {
    playerState: {
      absoluteMinute: minute,
      player: { location, facilityId, gold, freeMeals: 0, hunger, fatigue: 20 },
      hunger,
      fatigue: 20,
      missions: [],
      troubles: {},
      worldFlags: {},
      history: [],
      evidence: {},
    },
  };
}

function work(state, jobId) {
  const action = authoredMissionFlowExclusiveActions(state)
    .find((entry) => entry.authoredFacilityLabourJobId === jobId);
  assert.ok(action, `job not offered: ${jobId}`);
  const result = { ok: true };
  assert.equal(applyAuthoredMissionFlowAction(state, action, result), true);
  return result;
}

test("a facility with work offers it, and the choices are jobs", () => {
  const state = runtime();
  const actions = authoredMissionFlowExclusiveActions(state);

  // 見出しに今日の変奏が出る。**同じ画面に同じ物は並ばない。**
  assert.deepEqual(actions.map((action) => action.label), [
    "朝の荷役に入る（塩樽）",
    "綱を取る（材木）",
    "夕の荷役に入る（麻袋）——明朝の口に、今から名前を入れておく",
  ]);
  assert.equal(new Set(actions.map((action) => action.actionId)).size, 3, "三つとも別のIDである");
  for (const action of actions) {
    assert.equal(action.actionId, action.id);
    assert.ok(action.authoredFacilityLabourGold >= 1, "work pays");
  }
  assert.equal(authoredMissionFlowGuidance(state).title, "今日の働き口");
});

test("the same job can be worked again on another day", () => {
  const state = runtime();
  work(state, "port_morning");
  assert.equal(labour.ownEligible(state), false, "not twice in one day");

  state.playerState.absoluteMinute += 1440;
  assert.equal(labour.ownEligible(state), true, "tomorrow the quay is open again");
});

test("repetition is not repetition: the detail changes every shift", () => {
  const state = runtime();
  const seen = [];
  for (let day = 0; day < 6; day += 1) {
    state.playerState.absoluteMinute = DAY20_MORNING + day * 1440;
    state.playerState.player.gold = 2;
    const result = work(state, "port_morning");
    seen.push(result.summary);
  }
  assert.equal(new Set(seen).size, 6, "six shifts, six different shifts");
});

test("the variant pool cycles rather than repeating early, and is not random", () => {
  const entry = labour.jobsAt("LOC_TRADE_PORT")[0];
  const pool = labour.VARIANTS[entry.variantKey];
  const first = Array.from({ length: pool.length }, (_, i) => labour.variantFor(entry, i));
  assert.equal(new Set(first).size, pool.length, "every variant appears before any repeats");
  assert.equal(labour.variantFor(entry, pool.length), first[0], "then it comes round");
  assert.equal(labour.variantFor(entry, 3), labour.variantFor(entry, 3), "same input, same variant");
});

test("some shifts are simply work: nothing happens and nobody says anything", () => {
  const quiet = Object.values(labour.VARIANTS)
    .flat()
    .filter((variant) => variant.incident == null && variant.overheard == null);
  assert.ok(quiet.length >= 4, "a job where every shift matters is not a job");
});

test("working pays, feeds or tires according to the job", () => {
  // 一度きりの初任給三択が先に立つ場面（無一文かつ空腹）は避ける。
  // 常設の働き口はその下の床なので、初任給が引っ込んだ後の状態で確かめる。
  const dishes = runtime({ facilityId: "LOC_FARM_INN", location: "田園の村", gold: 12, hunger: 60 });
  work(dishes, "inn_dishes");
  assert.equal(dishes.playerState.player.gold, 14);
  assert.equal(dishes.playerState.player.freeMeals, 1, "the standing meal is part of the wage");
  assert.equal(dishes.playerState.player.hunger, 42);

  const haul = runtime();
  work(haul, "port_morning");
  assert.equal(haul.playerState.player.gold, 10);
  assert.equal(haul.playerState.player.hunger, 82, "hauling makes you hungrier");
  assert.equal(haul.playerState.player.fatigue, 58);
});

test("the pitch where an investigation is waiting is a scene, not a job", () => {
  const idle = runtime({ facilityId: "LOC_FARM_STABLE", location: "田園の村" });
  assert.equal(labour.ownEligible(idle), true);

  const onSite = runtime({ facilityId: "LOC_FARM_STABLE", location: "田園の村" });
  onSite.playerState.missions = [{
    id: "MSN-T03",
    status: "active",
    progress: { look_stable: 0 },
    steps: [{ id: "look_stable", targetFacilityId: "LOC_FARM_STABLE", required: 2 }],
  }];
  assert.equal(labour.missionWaitsHere(onSite, "LOC_FARM_STABLE"), true);
  assert.equal(labour.ownEligible(onSite), false, "muck-shovelling does not outrank the wolves");

  const done = runtime({ facilityId: "LOC_FARM_STABLE", location: "田園の村" });
  done.playerState.missions = [{
    id: "MSN-T03",
    status: "completed",
    progress: { look_stable: 0 },
    steps: [{ id: "look_stable", targetFacilityId: "LOC_FARM_STABLE", required: 2 }],
  }];
  assert.equal(labour.ownEligible(done), true, "once it is over, the stalls still need doing");
});

test("nobody queues for day labour with money in hand and a full stomach", () => {
  assert.equal(labour.needsTheWork(runtime({ gold: 40, hunger: 20 })), false);
  assert.equal(labour.needsTheWork(runtime({ gold: 40, hunger: 60 })), true, "hungry is a reason");
  assert.equal(labour.needsTheWork(runtime({ gold: 2, hunger: 10 })), true, "broke is a reason");
});

test("work keeps its hours, and places without work offer none", () => {
  assert.equal(labour.ownEligible(runtime({ minute: 19 * 1440 + 3 * 60 })), false, "not at 3am");
  assert.equal(labour.ownEligible(runtime({ facilityId: "LOC_TRADE_LORD_MANOR" })), false);
  assert.equal(labour.ownEligible(runtime({ facilityId: "LOC_CAP_CASTLE" })), false);

  const evening = runtime({ minute: 19 * 1440 + 18 * 60 });
  assert.deepEqual(
    authoredMissionFlowExclusiveActions(evening).map((action) => action.label),
    [
      "夕の荷役に入る（麻袋）",
      "綱を取る（材木）",
      "朝の荷役に入る（塩樽）——明朝の口に、今から名前を入れておく",
    ],
    "the morning shift is over; the evening one is not, and dawn can be booked now",
  );
});

test("a work screen is never fewer than three shifts", () => {
  // 一口しか空いていない場所で一択の画面を出すのは、選ばせていないのと同じ。
  // 空いていない口は待ち時間つきで並べ、三択を保つ。
  const alone = runtime({ facilityId: "LOC_CAP_LOWER_INN", location: "王都", minute: 19 * 1440 + 14 * 60 });
  const actions = authoredMissionFlowExclusiveActions(alone);
  assert.equal(actions.length, 3, "the cheap inn has one open shift but still asks three questions");
  assert.equal(actions.filter((action) => action.authoredFacilityLabourWaitMinutes === 0).length, 2);

  const booked = actions.find((action) => action.authoredFacilityLabourWaitMinutes > 0);
  assert.ok(booked, "the shift that is not open yet is offered as a wait");
  const entry = labour.jobsAt("LOC_CAP_LOWER_INN").find((job) => job.id === booked.authoredFacilityLabourJobId);
  assert.equal(booked.minutes, entry.minutes + booked.authoredFacilityLabourWaitMinutes, "waiting costs the clock");
  assert.equal(booked.authoredFacilityLabourGold, entry.gold, "waiting does not change the wage");
});

test("every facility with work can fill a three-choice screen", () => {
  for (const [facilityId, entries] of Object.entries(labour.FACILITY_JOBS)) {
    assert.ok(entries.length >= 3, `${facilityId} needs three shifts to fill a screen, has ${entries.length}`);
  }
});

test("the wait is measured to the shift, not guessed", () => {
  const entry = labour.jobsAt("LOC_TRADE_PORT").find((job) => job.id === "port_morning");
  assert.equal(labour.waitMinutesUntilOpen(entry, 5, 0), 0, "already open");
  assert.equal(labour.waitMinutesUntilOpen(entry, 3, 30), 90, "opens at 5; it is 3:30");
  assert.equal(labour.waitMinutesUntilOpen(entry, 21, 0), 8 * 60, "closed for today; dawn is eight hours off");
});

test("every job the road relies on exists in the world", () => {
  for (const [facilityId, jobId] of [
    ["LOC_FARM_INN", "inn_dishes"],
    ["LOC_FARM_GRANARY", "granary_count"],
    ["LOC_FARM_BAKERY", "bakery_oven"],
    ["LOC_TRADE_PORT", "port_morning"],
    ["LOC_TRADE_FISH_MARKET", "fish_gut"],
    ["LOC_TRADE_WAREHOUSE", "warehouse_tally"],
    ["LOC_CAP_MARKET", "market_porter"],
    ["LOC_FOREST_HUNTER_HUT", "hunter_traps"],
  ]) {
    const entries = labour.jobsAt(facilityId) ?? [];
    assert.ok(entries.some((entry) => entry.id === jobId), `${facilityId} must offer ${jobId}`);
  }
});

test("every job sits at a facility the canonical sheet knows", () => {
  // 施設を増やす時は正本へ先に追記する。ここは実装が正本を追い越さないための錠である。
  // 手で書き写した一覧は必ず正本から遅れるので、正本の写し
  // （fixtures/world.snapshot.json、拠点一覧タブ由来）そのものを読む。
  for (const facilityId of Object.keys(labour.FACILITY_JOBS)) {
    assert.ok(
      CANONICAL_FACILITY_IDS.has(facilityId),
      `${facilityId} is not in the canonical facility list`,
    );
  }
});

test("no job asks for a skill, because skills belong to combat", () => {
  for (const entries of Object.values(labour.FACILITY_JOBS)) {
    for (const entry of entries) {
      assert.equal(entry.requiredSkill, undefined);
      assert.equal(entry.skillId, undefined);
      assert.equal(entry.requiredLevel, undefined);
    }
  }
});

test("saved progress survives a restore and keeps counting shifts", () => {
  const state = runtime();
  work(state, "port_morning");
  const saved = JSON.parse(JSON.stringify(state.playerState.facilityLabour));

  const restored = runtime({ minute: DAY20_MORNING + 1440 });
  restored.playerState.facilityLabour = saved;
  assert.equal(labour.ownEligible(restored), true);

  const entry = labour.jobsAt("LOC_TRADE_PORT")[0];
  const next = authoredMissionFlowExclusiveActions(restored)
    .find((action) => action.authoredFacilityLabourJobId === "port_morning");
  assert.equal(next.authoredFacilityLabourVariant, labour.variantFor(entry, 1),
    "the second shift is the second variant, not the first again");
});

test("the day-labour queue does not speak over a named employer standing there", () => {
  // 麦畑にはエダが、村の広場にはガロがいる。仕事はその人から受けるものであり、
  // 正本側の労働市場が雇用関係・提示賃金・所要時間を持っている。上書きしてはいけない。
  // 初任給の一度きりの場面が先に立たない状態（無一文ではない）で確かめる。
  const square = runtime({ facilityId: "LOC_FARM_SQUARE", location: "田園の村", gold: 12 });
  assert.ok(labour.openJobsFor(square), "the square does have day work");
  assert.equal(
    authoredMissionFlowExclusiveActions(square, { presentNpcs: [{ id: "NPC003" }] }),
    null,
    "with Garo standing there, the queue stands down",
  );
  assert.ok(
    authoredMissionFlowExclusiveActions(square, { presentNpcs: [{ id: "NPC061" }] })
      ?.every((action) => action.authoredFacilityLabourChoice),
    "with somebody else there, the queue is what the square offers",
  );

  // 麦畑は手書きの日常場面も持っているので、null ではなくその場面が返る。
  // 確かめたいのは「日雇いの列が混ざらないこと」である。
  const field = runtime({ facilityId: "LOC_FARM_FIELD", location: "田園の村", gold: 12 });
  field.playerState.authoritativePresentNpcIds = new Set(["NPC004"]);
  assert.equal(labour.namedEmployerStandsHere(field, "LOC_FARM_FIELD", {}), true);
  assert.equal(
    (authoredMissionFlowExclusiveActions(field, {}) ?? [])
      .some((action) => action.authoredFacilityLabourChoice),
    false,
    "Eda outranks the gleaning queue",
  );
});

test("the named-employer map does not drift from the one the work market uses", () => {
  // service.js の PREFERRED_WORK_GIVER_BY_FACILITY と同じでなければならない。
  // 片方だけ増えると、日雇いの列が雇い主の上に被さって気付かれない。
  const source = readFileSync(
    new URL("../../../src/server/trpg/game/service.js", import.meta.url),
    "utf8",
  );
  const block = source.match(
    /const PREFERRED_WORK_GIVER_BY_FACILITY = Object\.freeze\(\{([\s\S]*?)\}\);/u,
  );
  assert.ok(block, "the canonical map must still be findable");
  const canonical = Object.fromEntries(
    [...block[1].matchAll(/(LOC_[A-Z0-9_]+):\s*"([^"]+)"/gu)].map((match) => [match[1], match[2]]),
  );
  assert.deepEqual(labour.NAMED_EMPLOYER_BY_FACILITY, canonical);
});

/**
 * 同じ働き口を続けて取っても、**画面が一字も違わない**ということが無いのを検算する。
 *
 * 世界の規則は「労働を繰り返すのは構わない。**同じ三択が現れるのはおかしい**」である。
 * 変奏（何を運び、誰と組み、何が起きたか）は前から作ってあったが、
 * **選ぶ時の見出しとIDに出ていなかった。**
 * 出ていなかった頃、通し再生の中央市場は Day12の朝もDay13の夜も
 * `market_night|market_porter|market_stall` の三つだけで、完全に同一だった。
 */
test("同じ働き口でも、回を重ねると画面が変わる", () => {
  const entry = labour.jobsAt("LOC_CAP_MARKET").find((job) => job.id === "market_porter");
  assert.ok(entry, "中央市場の荷運びが無い");

  const seen = new Set();
  const labels = new Set();
  for (let shift = 0; shift < 5; shift += 1) {
    const index = labour.variantIndexFor(entry, shift);
    seen.add(labour.actionIdFor(entry, index));
    labels.add(labour.variantFor(entry, shift).handled);
  }
  assert.equal(seen.size, 5, `五回働いてIDが ${seen.size} 種類しか出ていない`);
  assert.equal(labels.size, 5, `五回働いて扱う物が ${labels.size} 種類しか出ていない`);
});
