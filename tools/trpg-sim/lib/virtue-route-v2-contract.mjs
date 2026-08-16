export const VIRTUE_ROUTE_V2 = Object.freeze({
  version: "virtue-route-v2-2026-08-16",
  startDay: 1,
  endingDay: 85,
  ledgerRows: 831,
  build: "one-hand-axe-shield-guardian-breaker",
  finalLevel: 11,
  skillPoints: Object.freeze({ earned: 12, spent: 11, remaining: 1 }),
  finance: Object.freeze({ minimumGold: 0, finalGold: 51, battleDropGoldCounted: false }),
  resolvedTroubles: Object.freeze(["T01","T02","T03","T04","T05","T06","T07","T08","T09","T10","T11","T12","T13","T14","T16","T17"]),
  suppressedTroubles: Object.freeze(["T15","T18","T19"]),
  collapseDays: Object.freeze([9, 29]),
  equipment: Object.freeze([
    Object.freeze({ day: 3, id: "EQP-W-0201", name: "麦刈り鎌", price: 10 }),
    Object.freeze({ day: 3, id: "EQP-S-0001", name: "木蓋の盾", price: 8 }),
    Object.freeze({ day: 10, id: "EQP-A-0201", name: "麦藁の胴当て", price: 6 }),
    Object.freeze({ day: 23, id: "EQP-W-0207", name: "網舟の手鉤", price: 29 }),
    Object.freeze({ day: 38, id: "EQP-A-0203", name: "荷役の詰め襟", price: 34 }),
    Object.freeze({ day: 41, id: "EQP-S-0201", name: "樽蓋の盾", price: 13 }),
    Object.freeze({ day: 46, id: "EQP-W-0301", name: "港警の舷側斧", price: 75 }),
    Object.freeze({ day: 60, id: "EQP-W-0302", name: "ドワーフ鍛の護衛斧", price: 148 }),
  ]),
  skills: Object.freeze([
    Object.freeze({ day: 1, id: "SKL-0049" }),
    Object.freeze({ day: 3, id: "SKL-0140" }),
    Object.freeze({ day: 20, id: "SKL-0142" }),
    Object.freeze({ day: 20, id: "SKL-0141" }),
    Object.freeze({ day: 32, id: "SKL-0052" }),
    Object.freeze({ day: 32, id: "SKL-0055" }),
    Object.freeze({ day: 41, id: "SKL-0050" }),
    Object.freeze({ day: 43, id: "SKL-0149" }),
    Object.freeze({ day: 49, id: "SKL-0051" }),
    Object.freeze({ day: 52, id: "SKL-0146" }),
    Object.freeze({ day: 78, id: "SKL-0054" }),
  ]),
  majorBattles: Object.freeze([
    Object.freeze({ day: 1, trouble: "T01", target: "MON-0005", expectedHpAfter: 86 }),
    Object.freeze({ day: 20, trouble: "T03", target: "MON-0007", expectedHpAfter: 42 }),
    Object.freeze({ day: 28, trouble: "T09", target: null, expectedHpAfter: 65 }),
    Object.freeze({ day: 32, trouble: "T04", target: null, expectedHpAfter: 55 }),
    Object.freeze({ day: 47, trouble: "T07", target: null, expectedHpAfter: 48 }),
    Object.freeze({ day: 58, trouble: "T13", target: "MON-0018", expectedHpAfter: 31 }),
    Object.freeze({ day: 76, trouble: "T16", target: null, expectedHpAfter: 52 }),
  ]),
  causality: Object.freeze([
    "Day1 Finn rescue -> Mira/Garo/Jil trust -> village cooperation and T03 joint response",
    "Day3 Nene world-tree story -> suspect river/tree coupling -> T13 multi-region investigation",
    "Day8 night watch -> Day9 collapse -> Eda finds player on normal water-fetch GOAP",
    "Trade labour -> Glen/customs trust -> T06 negotiation, T14 inspection, T16 logistics",
    "Day27-29 Miina/Bronrun -> drainage technology and rescue relationship -> T13 support",
    "Orphanage/Petra -> T10/T11 -> T16 shelter, evidence and correction reporting",
    "Day48 Lucia rescue with autonomy -> T08 access -> elf support for T13",
    "T12 evidence + Blackridge water observation -> prevent racialized blame -> T16/T19 de-escalation",
  ]),
});

export function validateVirtueRouteV2Contract(gameData) {
  const errors = [];
  const troubleIds = new Set(gameData.model.troubles.map((entry) => entry.id));
  const expectedTroubles = Array.from({ length: 19 }, (_, index) => `T${String(index + 1).padStart(2, "0")}`);
  for (const id of expectedTroubles) if (!troubleIds.has(id)) errors.push(`missing trouble ${id}`);
  if (troubleIds.has("T20")) errors.push("T20 must not exist");

  const equipmentById = new Map(gameData.battleData.equipment.map((entry) => [entry.id, entry]));
  for (const milestone of VIRTUE_ROUTE_V2.equipment) {
    if (!equipmentById.has(milestone.id)) errors.push(`missing equipment ${milestone.id}`);
  }

  const stock = gameData.battleData.inventory;
  const sellerChecks = [
    ["EQP-W-0301", "LOC_TRADE_SHIPYARD", 75],
    ["EQP-W-0302", "LOC_DWARF_FORGE", 148],
    ["EQP-W-0303", "LOC_BLACKRIDGE_FORGE", 230],
  ];
  for (const [equipmentId, sellerId, price] of sellerChecks) {
    const row = stock.find((entry) => entry.equipmentId === equipmentId);
    if (!row) errors.push(`missing stock for ${equipmentId}`);
    else {
      if (row.sellerId !== sellerId) errors.push(`${equipmentId} seller mismatch: ${row.sellerId}`);
      if (Number(row.basePrice) !== price) errors.push(`${equipmentId} price mismatch: ${row.basePrice}`);
    }
  }

  if (!gameData.model.facilityById?.LOC_FARM_REPAIR && !gameData.model.facilities.some((entry) => entry.id === "LOC_FARM_REPAIR")) {
    errors.push("missing LOC_FARM_REPAIR");
  }
  if (!gameData.model.npcById?.NPC111 && !gameData.model.npcs.some((entry) => entry.id === "NPC111")) {
    errors.push("missing NPC111 Org");
  }

  const skillsById = new Map(gameData.skills.map((entry) => [entry.id, entry]));
  for (const id of ["SKL-0050","SKL-0051","SKL-0052","SKL-0054","SKL-0055","SKL-0056","SKL-0141","SKL-0143","SKL-0146","SKL-0149"]) {
    const skill = skillsById.get(id);
    if (!skill) errors.push(`missing skill ${id}`);
    else if (!Array.isArray(skill.eventUnlockConditions) || skill.eventUnlockConditions.length === 0) errors.push(`missing unlock conditions ${id}`);
  }

  if (VIRTUE_ROUTE_V2.finance.minimumGold < 0) errors.push("authored ledger goes negative");
  if (VIRTUE_ROUTE_V2.skillPoints.earned - VIRTUE_ROUTE_V2.skillPoints.spent !== VIRTUE_ROUTE_V2.skillPoints.remaining) errors.push("SP ledger mismatch");
  if (new Set([...VIRTUE_ROUTE_V2.resolvedTroubles, ...VIRTUE_ROUTE_V2.suppressedTroubles]).size !== 19) errors.push("final trouble partition is not T01-T19 exactly once");
  return errors;
}
