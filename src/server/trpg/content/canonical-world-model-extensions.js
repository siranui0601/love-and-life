// Temporary bridge for live TRPG-sheet rows that are newer than the checked-in
// world fixture. The base fixture must still pass its own structural audit; we
// then append the already-canonical rows in the same normalized shape used by
// world-model.mjs. Remove this bridge when world.snapshot.json is refreshed.

const FACILITIES = Object.freeze([
  Object.freeze({
    id: "LOC_FARM_NORTH_FENCE",
    sourceOrder: 102,
    sourceRow: null,
    sourceHub: "田園の村",
    hub: "田園の村",
    name: "村の北柵",
    type: "村境/夜番",
    function: "夜間の見張り、当番札の受け渡し、遠吠えの観測",
    relatedNpcText: "ジル、村の夜番、リオナ滞在時",
    relatedNpcIds: ["NPC060"],
    productPriceText: "販売なし。夜番への差し入れで信頼が動く",
    relatedTroubleText: "T01,T03",
    relatedTroubleIds: ["T01", "T03"],
    notes: "実装先行していた北柵をライブ田園の村正本へ正式追記。村外れより村寄りの通常施設",
  }),
  Object.freeze({
    id: "LOC_FARM_REPAIR",
    sourceOrder: 103,
    sourceRow: null,
    sourceHub: "田園の村",
    hub: "田園の村",
    name: "農具修理屋「鋤刃」",
    type: "修理屋/農具店",
    function: "農具・簡易武器の販売、研ぎ、軽修理",
    relatedNpcText: "オルグ",
    relatedNpcIds: ["NPC111"],
    productPriceText: "農村向け低価格。戦闘専用品より農具・護身具中心",
    relatedTroubleText: "T02,T03,T13",
    relatedTroubleIds: ["T02", "T03", "T13"],
    notes: "戦闘正本の仮売場を正式施設化。全ルート利用可",
  }),
]);

const NPC = Object.freeze({
  id: "NPC111",
  sourceOrder: 110,
  name: "オルグ",
  importance: "B",
  importanceWeight: 0.85,
  behaviorType: "routine",
  sourceBehaviorType: "生活リズム型",
  species: "人間",
  age: 56,
  gender: "男性",
  home: "田園の村",
  sourceInitialLocation: "田園の村",
  initialLocation: "田園の村",
  initialFacilityId: "LOC_FARM_REPAIR",
  allowedRange: "田園の村内/修理屋/広場/畑",
  occupation: "農具修理職人",
  relatedTroubleIds: ["T02", "T03", "T13"],
  mbti: "ISTP",
  primaryGoal: "農具と護身具を修理し、村の生産と安全を維持して生活費を得る",
  routine: {
    morning: "修理屋開店",
    afternoon: "畑・広場へ納品",
    evening: "修理屋",
    night: "自宅",
  },
  knowledgeTags: "農具,簡易武器,修理,T02_穀倉,T03_狼,T13_水不足",
  secrets: "王都製品は過剰品質と思う/古い農具を護身具へ転用する知恵がある",
  initialKnowledge: {
    facts: ["農具", "簡易武器", "修理", "T02_穀倉", "T03_狼", "T13_水不足"],
    interests: [],
    misconceptions: ["王都製品は過剰品質と思う"],
    secrets: ["古い農具を護身具へ転用する知恵がある"],
  },
  nonInterventionFate: "非介入でも営業。T03失敗で修理需要急増、T13失敗で農具注文減少",
  fateHints: {
    sourceText: "非介入でも営業。T03失敗で修理需要急増、T13失敗で農具注文減少",
    dayAnchors: [],
    troubleIds: ["T03", "T13"],
    outcomeKeywords: [],
  },
  initialStatus: "通常",
  speechStyle: "短く実務的。道具の傷み方から使い方を言い当てる",
  sourceMainFacilityId: "LOC_FARM_REPAIR",
  mainFacilityId: "LOC_FARM_REPAIR",
  relatedFacilities: "LOC_FARM_SQUARE,LOC_FARM_FIELD",
  sourceRelatedFacilityIds: ["LOC_FARM_SQUARE", "LOC_FARM_FIELD"],
  relatedFacilityIds: ["LOC_FARM_SQUARE", "LOC_FARM_FIELD"],
  facilityReferenceFallbacks: [],
  unknownFacilityIds: [],
  allowedHubs: ["田園の村"],
  disposition: "neutral",
});

function cloneFacility(source) {
  return {
    ...source,
    relatedNpcIds: [...source.relatedNpcIds],
    relatedTroubleIds: [...source.relatedTroubleIds],
  };
}

export function applyCanonicalWorldModelExtensions(model) {
  if (!model?.facilityById || !model?.npcById) throw new TypeError("world model is not normalized");

  const addedFacilities = [];
  for (const source of FACILITIES) {
    if (model.facilityById[source.id]) continue;
    const facility = cloneFacility(source);
    model.facilities.push(facility);
    model.facilityById[facility.id] = facility;
    model.facilitiesByHub[facility.hub] ??= [];
    model.facilitiesByHub[facility.hub].push(facility);
    addedFacilities.push(facility.id);
  }

  const addedNpcs = [];
  if (!model.npcById[NPC.id]) {
    const npc = {
      ...NPC,
      routine: { ...NPC.routine },
      relatedTroubleIds: [...NPC.relatedTroubleIds],
      initialKnowledge: {
        facts: [...NPC.initialKnowledge.facts],
        interests: [],
        misconceptions: [...NPC.initialKnowledge.misconceptions],
        secrets: [...NPC.initialKnowledge.secrets],
      },
      fateHints: { ...NPC.fateHints, dayAnchors: [], troubleIds: [...NPC.fateHints.troubleIds], outcomeKeywords: [] },
      sourceRelatedFacilityIds: [...NPC.sourceRelatedFacilityIds],
      relatedFacilityIds: [...NPC.relatedFacilityIds],
      facilityReferenceFallbacks: [],
      unknownFacilityIds: [],
      allowedHubs: [...NPC.allowedHubs],
    };
    model.npcs.push(npc);
    model.npcById[npc.id] = npc;
    addedNpcs.push(npc.id);
  }

  model.diagnostics.push({
    code: "LIVE_CANON_WORLD_EXTENSION",
    severity: "info",
    message: "ライブ正本の追加施設・NPCをfixture監査後に適用した。",
    details: { facilities: addedFacilities, npcs: addedNpcs },
  });
  return model;
}

export const CANONICAL_WORLD_MODEL_EXTENSION_VERSION = "virtue-route-v2-world-2026-09-03";
export const CANONICAL_WORLD_MODEL_EXTENSION_INTERNALS = Object.freeze({ FACILITIES, NPC });
