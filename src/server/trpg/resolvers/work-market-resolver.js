import crypto from "node:crypto";

export const WORK_MARKET_VERSION = "work-market-v1";
export const WORK_DAILY_LIMIT = 3;
export const WORK_FACILITY_DAILY_LIMIT = 2;
export const WORK_EMPLOYER_DAILY_LIMIT = 1;
export const WORK_OFFER_MAX_AGE_MINUTES = 180;

const REGION_BASE_HOURLY_WAGE = Object.freeze({
  "田園の村": 6,
  "王都": 9,
  "交易都市": 9,
  "犯罪都市": 10,
  "辺境の村": 8,
  "北陵要塞": 9,
  "ドワーフ洞窟": 10,
  "エルフの隠れ里": 8,
  "古代神殿": 9,
  "魔王領": 12,
});

const RISK_FACTOR = Object.freeze({ low: 1, medium: 1.2, high: 1.45 });

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(parsed)));
}

function cleanText(value, maximum = 120) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/gu, "").slice(0, maximum);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function normalizedCompleted(entry) {
  if (!entry || typeof entry !== "object") return null;
  const offerId = cleanText(entry.offerId, 160);
  const facilityId = cleanText(entry.facilityId, 120);
  const employerId = cleanText(entry.employerId, 120);
  if (!offerId || !facilityId || !employerId) return null;
  return {
    offerId,
    day: boundedInteger(entry.day, 1, 1, 100),
    location: cleanText(entry.location, 120),
    facilityId,
    employerId,
    title: cleanText(entry.title, 120) || "頼まれた仕事",
    riskClass: ["low", "medium", "high"].includes(entry.riskClass) ? entry.riskClass : "low",
    durationMinutes: boundedInteger(entry.durationMinutes, 120, 30, 480),
    startedAtMinute: boundedInteger(entry.startedAtMinute, 0, 0, 200_000),
    completedAtMinute: boundedInteger(entry.completedAtMinute, 0, 0, 200_000),
    wage: boundedInteger(entry.wage, 0, 0, 500),
  };
}

export function ensureWorkMarket(runtime) {
  const source = runtime?.workMarket && typeof runtime.workMarket === "object" ? runtime.workMarket : {};
  const completed = (Array.isArray(source.completed) ? source.completed : [])
    .map(normalizedCompleted)
    .filter(Boolean)
    .slice(-120);
  runtime.workMarket = {
    version: WORK_MARKET_VERSION,
    completed,
  };
  return runtime.workMarket;
}

export function workScheduleForFacility(facility = {}) {
  const text = `${facility.name ?? ""} ${facility.type ?? ""}`;
  if (/宿|酒場|食堂|茶屋|旅籠/u.test(text)) return { opensAtMinute: 360, closesAtMinute: 1320, label: "06:00〜22:00" };
  if (/農|畑|牧|井戸|水場/u.test(text)) return { opensAtMinute: 360, closesAtMinute: 1080, label: "06:00〜18:00" };
  if (/市場|店|商|工房|鍛冶|パン|厨房/u.test(text)) return { opensAtMinute: 480, closesAtMinute: 1140, label: "08:00〜19:00" };
  if (/新聞|役所|ギルド|院|教会|孤児院|学校|書庫|図書/u.test(text)) return { opensAtMinute: 480, closesAtMinute: 1080, label: "08:00〜18:00" };
  return { opensAtMinute: 480, closesAtMinute: 1080, label: "08:00〜18:00" };
}

function workCounts(runtime, { day, facilityId, employerId }) {
  const completed = ensureWorkMarket(runtime).completed.filter((entry) => entry.day === day);
  return {
    total: completed.length,
    facility: completed.filter((entry) => entry.facilityId === facilityId).length,
    employer: completed.filter((entry) => entry.employerId === employerId).length,
  };
}

export function workAvailability(runtime, {
  facility = {},
  facilityId = runtime?.playerState?.player?.facilityId,
  employerId,
  durationMinutes = 120,
  startOffsetMinutes = 0,
} = {}) {
  ensureWorkMarket(runtime);
  const state = runtime.playerState;
  const duration = boundedInteger(durationMinutes, 120, 30, 480);
  const offset = boundedInteger(startOffsetMinutes, 0, 0, 60);
  const schedule = workScheduleForFacility(facility);
  const nowMinute = boundedInteger(Number(state.hour ?? 0) * 60 + Number(state.minute ?? 0), 0, 0, 1439);
  const startsAtMinute = nowMinute + offset;
  const finishesAtMinute = startsAtMinute + duration;
  const day = boundedInteger(state.day, 1, 1, 100);
  const normalizedFacilityId = cleanText(facilityId, 120);
  const normalizedEmployerId = cleanText(employerId, 120);
  const needs = state.player?.needs ?? {};
  const counts = workCounts(runtime, { day, facilityId: normalizedFacilityId, employerId: normalizedEmployerId });
  let reason = null;
  if (!normalizedFacilityId || !normalizedEmployerId) reason = "work_party_missing";
  else if (Number(needs.fatigue ?? 0) >= 80) reason = "too_fatigued_for_work";
  else if (Number(needs.hunger ?? 0) >= 92) reason = "too_hungry_for_work";
  else if (startsAtMinute < schedule.opensAtMinute || finishesAtMinute > schedule.closesAtMinute) reason = "outside_working_hours";
  else if (counts.total >= WORK_DAILY_LIMIT) reason = "daily_work_limit_reached";
  else if (counts.facility >= WORK_FACILITY_DAILY_LIMIT) reason = "facility_work_limit_reached";
  else if (counts.employer >= WORK_EMPLOYER_DAILY_LIMIT) reason = "employer_work_limit_reached";
  return {
    available: reason === null,
    reason,
    day,
    durationMinutes: duration,
    startsAtMinute,
    finishesAtMinute,
    schedule,
    counts,
    limits: {
      daily: WORK_DAILY_LIMIT,
      facility: WORK_FACILITY_DAILY_LIMIT,
      employer: WORK_EMPLOYER_DAILY_LIMIT,
    },
  };
}

export function deterministicWorkWage(runtime, {
  facilityId,
  employerId,
  title = "頼まれた仕事",
  durationMinutes = 120,
  riskClass = "low",
} = {}) {
  const state = runtime.playerState;
  const duration = boundedInteger(durationMinutes, 120, 30, 480);
  const risk = ["low", "medium", "high"].includes(riskClass) ? riskClass : "low";
  const location = cleanText(state.player?.location, 120);
  const hourly = Number(REGION_BASE_HOURLY_WAGE[location] ?? 8);
  const digest = sha256([
    state.seed,
    state.day,
    location,
    cleanText(facilityId, 120),
    cleanText(employerId, 120),
    cleanText(title, 120),
    risk,
    duration,
    WORK_MARKET_VERSION,
  ].join(":"));
  const marketFactor = 0.9 + (Number.parseInt(digest.slice(0, 8), 16) % 21) / 100;
  const raw = hourly * (duration / 60) * RISK_FACTOR[risk] * marketFactor;
  return Math.max(6, Math.min(120, Math.round(raw)));
}

export function workOfferId(runtime, {
  facilityId,
  employerId,
  title,
  durationMinutes,
  riskClass,
} = {}) {
  return `WORK-${sha256([
    runtime.playerState.seed,
    runtime.playerState.day,
    runtime.playerState.player.location,
    cleanText(facilityId, 120),
    cleanText(employerId, 120),
    cleanText(title, 120),
    boundedInteger(durationMinutes, 120, 30, 480),
    riskClass,
    WORK_MARKET_VERSION,
  ].join(":")).slice(0, 20)}`;
}

export function pendingWorkOfferAvailability(runtime, facility = {}) {
  const offer = runtime.pendingWorkOffer;
  if (!offer) return { available: false, reason: "work_offer_missing" };
  if (Number(runtime.playerState.absoluteMinute ?? 0) - Number(offer.openedAtMinute ?? 0) > WORK_OFFER_MAX_AGE_MINUTES) {
    return { available: false, reason: "work_offer_expired" };
  }
  if (Number(offer.day ?? runtime.playerState.day) !== Number(runtime.playerState.day)) {
    return { available: false, reason: "work_offer_expired" };
  }
  return workAvailability(runtime, {
    facility,
    facilityId: offer.facilityId,
    employerId: offer.actorNpcId,
    durationMinutes: offer.minutes,
  });
}

export function recordCompletedWork(runtime, {
  offerId,
  facilityId,
  employerId,
  title,
  riskClass = "low",
  durationMinutes = 120,
  startedAtMinute,
  completedAtMinute = runtime?.playerState?.absoluteMinute,
  wage = 0,
} = {}) {
  const market = ensureWorkMarket(runtime);
  const normalizedOfferId = cleanText(offerId, 160);
  if (!normalizedOfferId || market.completed.some((entry) => entry.offerId === normalizedOfferId)) return null;
  const entry = normalizedCompleted({
    offerId: normalizedOfferId,
    day: runtime.playerState.day,
    location: runtime.playerState.player.location,
    facilityId,
    employerId,
    title,
    riskClass,
    durationMinutes,
    startedAtMinute,
    completedAtMinute,
    wage,
  });
  if (!entry) return null;
  market.completed.push(entry);
  if (market.completed.length > 120) market.completed.splice(0, market.completed.length - 120);
  return clone(entry);
}

export function publicWorkMarket(runtime, facility = {}) {
  const state = runtime.playerState;
  const market = ensureWorkMarket(runtime);
  const today = market.completed.filter((entry) => entry.day === Number(state.day));
  const schedule = workScheduleForFacility(facility);
  return {
    version: WORK_MARKET_VERSION,
    day: Number(state.day),
    completedToday: today.length,
    remainingToday: Math.max(0, WORK_DAILY_LIMIT - today.length),
    dailyLimit: WORK_DAILY_LIMIT,
    facilityDailyLimit: WORK_FACILITY_DAILY_LIMIT,
    employerDailyLimit: WORK_EMPLOYER_DAILY_LIMIT,
    schedule,
    recentWorkTitles: market.completed.slice(-8).map((entry) => entry.title),
  };
}
