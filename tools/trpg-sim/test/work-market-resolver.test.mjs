import assert from "node:assert/strict";
import test from "node:test";
import {
  WORK_DAILY_LIMIT,
  deterministicWorkWage,
  ensureWorkMarket,
  pendingWorkOfferAvailability,
  publicWorkMarket,
  recordCompletedWork,
  workAvailability,
  workOfferId,
  workScheduleForFacility,
} from "../../../src/server/trpg/resolvers/work-market-resolver.js";

function runtime({ location = "田園の村", day = 1, hour = 8, minute = 0, hunger = 15, fatigue = 8 } = {}) {
  return {
    playerState: {
      seed: "work-market-test",
      day,
      hour,
      minute,
      absoluteMinute: (day - 1) * 1440 + hour * 60 + minute,
      player: {
        location,
        facilityId: "LOC-TEST",
        needs: { hunger, fatigue },
      },
    },
  };
}

const marketFacility = { id: "LOC-TEST", name: "中央市場", type: "市場" };
const innFacility = { id: "LOC-INN", name: "下層の安宿", type: "宿" };

test("work schedules close ordinary facilities before night and keep inns open later", () => {
  assert.deepEqual(workScheduleForFacility(marketFacility), {
    opensAtMinute: 480,
    closesAtMinute: 1140,
    label: "08:00〜19:00",
  });
  assert.deepEqual(workScheduleForFacility(innFacility), {
    opensAtMinute: 360,
    closesAtMinute: 1320,
    label: "06:00〜22:00",
  });
});

test("work availability requires the job to finish before closing", () => {
  const open = runtime({ hour: 16 });
  assert.equal(workAvailability(open, {
    facility: marketFacility,
    facilityId: marketFacility.id,
    employerId: "NPC-A",
    durationMinutes: 120,
  }).available, true);
  const tooLate = runtime({ hour: 18 });
  const availability = workAvailability(tooLate, {
    facility: marketFacility,
    facilityId: marketFacility.id,
    employerId: "NPC-A",
    durationMinutes: 120,
  });
  assert.equal(availability.available, false);
  assert.equal(availability.reason, "outside_working_hours");
});

test("exhaustion and dangerous hunger prevent taking a job", () => {
  assert.equal(workAvailability(runtime({ fatigue: 80 }), {
    facility: marketFacility,
    facilityId: marketFacility.id,
    employerId: "NPC-A",
  }).reason, "too_fatigued_for_work");
  assert.equal(workAvailability(runtime({ hunger: 92 }), {
    facility: marketFacility,
    facilityId: marketFacility.id,
    employerId: "NPC-A",
  }).reason, "too_hungry_for_work");
});

test("ordinary wages are deterministic and proportionate to meals and lodging", () => {
  const farm = runtime({ location: "田園の村" });
  const args = {
    facilityId: "LOC_FARM_SQUARE",
    employerId: "NPC003",
    title: "穀袋を共同倉庫へ運ぶ",
    durationMinutes: 120,
    riskClass: "low",
  };
  const first = deterministicWorkWage(farm, args);
  const second = deterministicWorkWage(farm, args);
  assert.equal(first, second);
  assert.ok(first >= 10 && first <= 15, `farm two-hour wage was ${first}G`);

  const capital = runtime({ location: "王都" });
  const capitalWage = deterministicWorkWage(capital, { ...args, facilityId: "LOC_CAP_MARKET", employerId: "NPC-CAP" });
  assert.ok(capitalWage >= 16 && capitalWage <= 22, `capital two-hour wage was ${capitalWage}G`);
});

test("an employer can offer one job per day, a facility two, and the player three", () => {
  const state = runtime();
  ensureWorkMarket(state);
  const complete = (index, employerId, facilityId = marketFacility.id) => {
    const offerId = `WORK-${index}`;
    const availability = workAvailability(state, {
      facility: marketFacility,
      facilityId,
      employerId,
      durationMinutes: 120,
    });
    assert.equal(availability.available, true, availability.reason);
    recordCompletedWork(state, {
      offerId,
      facilityId,
      employerId,
      title: `仕事${index}`,
      durationMinutes: 120,
      startedAtMinute: state.playerState.absoluteMinute,
      completedAtMinute: state.playerState.absoluteMinute + 120,
      wage: 12,
    });
  };

  complete(1, "NPC-A");
  assert.equal(workAvailability(state, {
    facility: marketFacility,
    facilityId: marketFacility.id,
    employerId: "NPC-A",
  }).reason, "employer_work_limit_reached");
  complete(2, "NPC-B");
  assert.equal(workAvailability(state, {
    facility: marketFacility,
    facilityId: marketFacility.id,
    employerId: "NPC-C",
  }).reason, "facility_work_limit_reached");
  complete(3, "NPC-C", "LOC-OTHER");
  const exhausted = workAvailability(state, {
    facility: { id: "LOC-THIRD", name: "別の市場", type: "市場" },
    facilityId: "LOC-THIRD",
    employerId: "NPC-D",
  });
  assert.equal(exhausted.reason, "daily_work_limit_reached");
  assert.equal(publicWorkMarket(state, marketFacility).completedToday, WORK_DAILY_LIMIT);

  state.playerState.day = 2;
  state.playerState.absoluteMinute += 1440;
  assert.equal(workAvailability(state, {
    facility: marketFacility,
    facilityId: marketFacility.id,
    employerId: "NPC-A",
  }).available, true);
});

test("pending work offers expire and keep a deterministic offer id", () => {
  const state = runtime();
  const specification = {
    facilityId: marketFacility.id,
    employerId: "NPC-A",
    title: "荷物を運ぶ",
    durationMinutes: 120,
    riskClass: "low",
  };
  const id = workOfferId(state, specification);
  assert.equal(workOfferId(state, specification), id);
  state.pendingWorkOffer = {
    offerId: id,
    facilityId: marketFacility.id,
    actorNpcId: "NPC-A",
    description: specification.title,
    minutes: 120,
    day: 1,
    openedAtMinute: state.playerState.absoluteMinute,
  };
  assert.equal(pendingWorkOfferAvailability(state, marketFacility).available, true);
  state.playerState.absoluteMinute += 181;
  assert.equal(pendingWorkOfferAvailability(state, marketFacility).reason, "work_offer_expired");
});

test("work-market state remains plain serializable data", () => {
  const state = runtime();
  recordCompletedWork(state, {
    offerId: "WORK-SERIALIZE",
    facilityId: marketFacility.id,
    employerId: "NPC-A",
    title: "帳場の整理",
    durationMinutes: 120,
    startedAtMinute: 480,
    completedAtMinute: 600,
    wage: 12,
  });
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(ensureWorkMarket(restored).completed[0].offerId, "WORK-SERIALIZE");
});
