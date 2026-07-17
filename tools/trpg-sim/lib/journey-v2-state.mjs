import { createHash } from "node:crypto";
import { createMissionCatalogV2, createMissionRuntimeV2, experienceToNextLevelV2, missionCatalogStatsV2 } from "./mission-model-v2.mjs";
import { createShopRuntime } from "./shop-runtime.mjs";
import { profileByIdV2, updateTroublesV2 } from "./journey-v2-core.mjs";
import { refreshSkillStateV2 } from "./journey-v2-skills.mjs";
import { refreshMissionsV2 } from "./journey-v2-missions.mjs";

function progressState() {
  return {
    experience: { total: 0, fromBattles: 0, fromPermanentMissions: 0, fromSpecialMissions: 0 },
    missions: { totalCompleted: 0, permanentCompleted: 0, specialCompleted: 0, completedByFamily: {} },
    travel: { actions: 0, localActions: 0, regionalActions: 0, visitedHubs: new Set(["田園の村"]), visitedFacilities: new Set() },
    walkMinutes: { total: 0, local: 0, regional: 0, byTag: {} },
    battles: { totalCount: 0, wins: 0, defeatCount: 0, byDaypart: { dawn: 0, day: 0, dusk: 0, night: 0 } },
    combat: { totalKills: 0, physicalKills: 0, physicalSkillUses: 0, criticalHits: 0, killsByName: {} },
    economy: { goldSpent: 0, maxSinglePurchase: 0, goldEarnedFromSales: 0, goldFromBattles: 0, goldFromWork: 0, orphanageDonations: 0 },
    investigation: { total: 0, appraisals: 0 },
    social: { conversations: 0, supportActions: 0 },
    rumors: { npcRecipients: 0, npcReplans: 0 },
    weapon: { oneHanded: {}, twoHanded: {}, axe: {}, spear: {}, bow: {}, staff: {}, book: {} },
    magic: { totalCasts: 0, mpSpent: 0 },
    debuffs: { stat: { successfulApplications: 0 } },
    buffs: { successfulApplications: 0 },
    multiHit: { actions: 0 },
    events: { grantedSkillIds: new Set(), completedTroubleIds: new Set() },
    training: { grantedSkillIds: new Set() },
    manuals: { grantedSkillIds: new Set() },
    contracts: { grantedSkillIds: new Set() },
    eventSkillGrants: { byTheme: {} },
  };
}

function startFacility(model) {
  const list = model.facilitiesByHub["田園の村"] ?? [];
  return list.find((facility) => /畑/u.test(`${facility.name} ${facility.function}`)) ?? list[0] ?? null;
}

export function createInitialJourneyStateV2({ model, battleData, skills, profile, tuning = {}, seed = "player-journey-v2" }) {
  const selected = typeof profile === "string" ? profileByIdV2(profile) : profile;
  if (!selected) throw new Error(`Unknown profile ${profile}`);
  const catalog = createMissionCatalogV2(model, battleData, tuning);
  const equipment = {}; const owned = {};
  for (const id of tuning.starterEquipmentIds ?? ["EQP-W-0005", "EQP-A-0001"]) {
    const item = battleData.equipmentById.get(id); if (!item) continue;
    equipment[item.slot] ??= id; owned[id] = Number(owned[id] ?? 0) + 1;
  }
  const facility = startFacility(model);
  const state = {
    schemaVersion: "2.0.0", engineVersion: "integrated-player-journey-v2", seed: String(seed), profileId: selected.id, tuning,
    absoluteMinute: 0, day: 1, hour: 10, minute: 0, minuteOfDay: 600, daypart: "day",
    player: {
      location: "田園の村", facilityId: facility?.id ?? null, level: 1, exp: 0, sp: 2,
      stats: { attack: 4, defense: 3, agility: 2, luck: 1 }, gold: Number(tuning.startingGold ?? 0), hpRatio: 1, mpRatio: 1,
      freeMeals: Number(tuning.freeStarterMeals ?? 1), freeLodging: Number(tuning.freeStarterLodging ?? 1),
      inventory: { items: {}, equipment: owned }, equipment, skills: new Set(), magicSkillCount: 0,
      knownRumorIds: new Set(), evidenceByTrouble: {}, reputation: {},
    },
    skillState: { revealed: new Set(), flagUnlocked: new Set(), flagUnlockPaths: new Set(), equipmentActive: new Set(), equipmentEverActive: new Set(), effective: new Set(), revealedAt: {}, flagUnlockedAt: {} },
    progress: progressState(),
    troubles: Object.fromEntries(model.troubles.map((trouble) => [trouble.id, { id: trouble.id, status: "scheduled", casualtyMitigation: 0, transitions: [] }])),
    worldFlags: { worldTreeFallen: false, forestMazeOpen: false, elfApproval: false, blackridgePermit: false, foreignFleetLanded: false, secondSummoningStopped: false, colossusAwake: false, blackridgeArmyAtCapital: false, capitalFallen: false, knightOrderCooperation: false, mageTowerPermit: false, farmFestivalHeld: false, executionGroundDeal: false, royalProof: false, skillGrants: {} },
    catalog, missions: null, rumors: [], rumorById: {}, routeCache: {}, encounterCooldowns: {}, dailyBattleCounts: {},
    ai: { inaccessibleObjectiveKeys: new Set(), nextMerchantRegionalAt: 0, merchantVisitedAt: { "田園の村": 0 } },
    shop: createShopRuntime(battleData), history: [], replayResults: {},
    metrics: {
      actions: 0, localMovementActions: 0, regionalMovementActions: 0, battles: 0, wins: 0, losses: 0, firstLevelUpDay: null,
      choiceDeadEnds: 0, movementBlocked: 0, movementObjectivesWaiting: 0, travelInterrupted: 0, replayMismatches: 0, purchases: 0, zeroTimePurchases: 0, terminatedByActionCap: false,
      missionSamples: 0, activeMissionSum: 0, activeSpecialSum: 0, maxActiveMissions: 0, maxActiveSpecialMissions: 0,
      permanentMissionsCompleted: 0, specialMissionsCompleted: 0, specialMissionsDiscovered: 0,
      skillsLearnedByCode: {}, flagSkillsLearned: 0, eventSkillGrants: 0, eventGrantSignals: 0, equipmentGrantActivations: 0, skillAcquisitionViolations: 0, maxEffectiveSkills: 0,
      troubleResolutionAttempts: 0, troubleResolvedByPlayerAction: 0, troublePartialByPlayerAction: 0, troubleFailedByPlayerAction: 0, troubleFailedByDeadline: 0,
    }, battleData, model,
  };
  state.missions = createMissionRuntimeV2(catalog, state);
  if (facility) state.progress.travel.visitedFacilities.add(facility.id);
  refreshSkillStateV2(state, battleData, skills, selected);
  updateTroublesV2(state, model);
  refreshMissionsV2(state, battleData, skills, selected);
  return state;
}

function sorted(value) { return value instanceof Set ? [...value].sort() : value; }
function compact(state) {
  return {
    minute: state.absoluteMinute,
    player: { location: state.player.location, facilityId: state.player.facilityId, level: state.player.level, exp: state.player.exp, gold: state.player.gold, hp: +state.player.hpRatio.toFixed(4), mp: +state.player.mpRatio.toFixed(4), equipment: state.player.equipment, skills: sorted(state.player.skills), effectiveSkills: sorted(state.skillState.effective), rumors: sorted(state.player.knownRumorIds), evidence: state.player.evidenceByTrouble, reputation: state.player.reputation },
    progress: { missions: state.progress.missions, travel: { actions: state.progress.travel.actions, local: state.progress.travel.localActions, regional: state.progress.travel.regionalActions, hubs: sorted(state.progress.travel.visitedHubs), facilities: sorted(state.progress.travel.visitedFacilities) }, walk: state.progress.walkMinutes, battles: state.progress.battles, combat: state.progress.combat, economy: state.progress.economy, investigation: state.progress.investigation, social: state.progress.social, events: { granted: sorted(state.progress.events.grantedSkillIds), troubles: sorted(state.progress.events.completedTroubleIds) }, training: { granted: sorted(state.progress.training.grantedSkillIds) }, manuals: { granted: sorted(state.progress.manuals.grantedSkillIds) }, contracts: { granted: sorted(state.progress.contracts.grantedSkillIds) }, eventSkillGrants: Object.fromEntries(Object.entries(state.progress.eventSkillGrants.byTheme).map(([key, value]) => [key, sorted(value)])) },
    worldFlags: state.worldFlags,
    troubles: Object.fromEntries(Object.entries(state.troubles).map(([id, runtime]) => [id, runtime.status])),
    missions: Object.fromEntries(Object.entries(state.missions).map(([id, runtime]) => [id, { status: runtime.status, progress: runtime.progress, baseline: runtime.baselineValue, attempts: runtime.attempts, outcome: runtime.outcome }])),
    ai: { waitingObjectives: sorted(state.ai.inaccessibleObjectiveKeys), nextMerchantRegionalAt: state.ai.nextMerchantRegionalAt, merchantVisitedAt: state.ai.merchantVisitedAt },
  };
}

export const stateFingerprintV2 = (state) => createHash("sha256").update(JSON.stringify(compact(state))).digest("hex");

export function summarizeJourneyV2(state, model) {
  const counts = {}; for (const runtime of Object.values(state.troubles)) counts[runtime.status] = Number(counts[runtime.status] ?? 0) + 1;
  const totalExp = Math.max(1, state.progress.experience.total);
  const invalid = state.history.filter((entry) => entry.type === "TROUBLE_TRANSITION" && entry.to === "resolved" && !String(entry.reason).startsWith("player-resolution:"));
  return {
    seed: state.seed, profileId: state.profileId, reachedEnd: state.absoluteMinute >= 99 * 1440 + 14 * 60, day: state.day, minute: state.absoluteMinute,
    level: state.player.level, expIntoLevel: state.player.exp, nextLevelExp: experienceToNextLevelV2(state.player.level), sp: state.player.sp,
    learnedSkills: state.player.skills.size, effectiveSkills: state.skillState.effective.size, flagSkillsLearned: state.metrics.flagSkillsLearned,
    eventGrantedSkills: state.metrics.eventSkillGrants, eventGrantSignals: state.metrics.eventGrantSignals, equipmentGrantActivations: state.metrics.equipmentGrantActivations,
    revealedSkills: state.skillState.revealed.size, flagUnlockedSkills: state.skillState.flagUnlocked.size, flagUnlockPathCount: state.skillState.flagUnlockPaths.size, skillAcquisitionViolations: state.metrics.skillAcquisitionViolations,
    skillsLearnedByCode: state.metrics.skillsLearnedByCode, gold: state.player.gold, battles: state.metrics.battles, wins: state.metrics.wins, losses: state.metrics.losses,
    winRate: state.metrics.battles ? state.metrics.wins / state.metrics.battles : 0, actions: state.metrics.actions,
    localMovementActions: state.metrics.localMovementActions, regionalMovementActions: state.metrics.regionalMovementActions,
    visitedHubs: state.progress.travel.visitedHubs.size, visitedFacilities: state.progress.travel.visitedFacilities.size, walkMinutes: state.progress.walkMinutes.total,
    missionsCompleted: state.progress.missions.totalCompleted, permanentMissionsCompleted: state.progress.missions.permanentCompleted, specialMissionsCompleted: state.progress.missions.specialCompleted,
    specialMissionsDiscovered: state.metrics.specialMissionsDiscovered, failedSpecialMissions: state.catalog.special.filter((mission) => state.missions[mission.id].status === "failed").length,
    activeMissionMean: state.metrics.missionSamples ? state.metrics.activeMissionSum / state.metrics.missionSamples : 0,
    activeSpecialMean: state.metrics.missionSamples ? state.metrics.activeSpecialSum / state.metrics.missionSamples : 0,
    maxActiveMissions: state.metrics.maxActiveMissions, maxActiveSpecialMissions: state.metrics.maxActiveSpecialMissions,
    missionExpShare: (state.progress.experience.fromPermanentMissions + state.progress.experience.fromSpecialMissions) / totalExp,
    permanentMissionExpShare: state.progress.experience.fromPermanentMissions / totalExp, specialMissionExpShare: state.progress.experience.fromSpecialMissions / totalExp, battleExpShare: state.progress.experience.fromBattles / totalExp,
    troubleCounts: counts, troubleResolutionAttempts: state.metrics.troubleResolutionAttempts, troubleResolvedByPlayerAction: state.metrics.troubleResolvedByPlayerAction,
    troublePartialByPlayerAction: state.metrics.troublePartialByPlayerAction, troubleFailedByPlayerAction: state.metrics.troubleFailedByPlayerAction,
    troubleFailedByDeadline: state.metrics.troubleFailedByDeadline, invalidTroubleResolutions: invalid.length,
    rumorCount: state.rumors.length, rumorRecipients: state.progress.rumors.npcRecipients, npcReplans: state.progress.rumors.npcReplans,
    firstLevelUpDay: state.metrics.firstLevelUpDay, choiceDeadEnds: state.metrics.choiceDeadEnds, movementBlocked: state.metrics.movementBlocked, movementObjectivesWaiting: state.metrics.movementObjectivesWaiting, travelInterrupted: state.metrics.travelInterrupted,
    replayMismatches: state.metrics.replayMismatches, purchases: state.metrics.purchases, zeroTimePurchases: state.metrics.zeroTimePurchases,
    shopDiagnostics: state.shop.diagnostics.length, terminatedByActionCap: state.metrics.terminatedByActionCap,
    fingerprint: stateFingerprintV2(state), missionCatalog: missionCatalogStatsV2(state.catalog),
  };
}
