import fs from "node:fs";

const servicePath = "src/server/trpg/game/service.js";
const appPath = "public/TRPG/app.js";
const stylePath = "public/TRPG/style.css";
const serviceTestPath = "tools/trpg-sim/test/equipment-access-service.test.mjs";
const uiTestPath = "tools/trpg-sim/test/trpg-equipment-access-ui-contract.test.mjs";
const workflowPath = ".github/workflows/apply-trpg-equipment-access-v1.yml";
const scriptPath = "tools/trpg-refactor/apply-equipment-access-v1.mjs";
const diagnosticWorkflowPath = ".github/workflows/inspect-trpg-equipment-access-anchors.yml";
const diagnosticScriptPath = "tools/trpg-refactor/inspect-equipment-access-anchors.mjs";
const diagnosticLogPath = "tools/trpg-refactor/equipment-access-anchors.log";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error("Missing integration anchor: " + label);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error("Ambiguous integration anchor: " + label);
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
}

let service = fs.readFileSync(servicePath, "utf8");
service = replaceOnce(
  service,
  `import { experienceToNextLevel } from "../../../../tools/trpg-sim/lib/mission-model.mjs";
import { ensurePlayerNeeds, publicPlayerNeeds } from "../../../../tools/trpg-sim/lib/player-needs.mjs";`,
  `import { experienceToNextLevel } from "../../../../tools/trpg-sim/lib/mission-model.mjs";
import { ensurePlayerNeeds, publicPlayerNeeds } from "../../../../tools/trpg-sim/lib/player-needs.mjs";
import {
  EQUIPMENT_ACCESS_VERSION,
  activeEquipmentLoans,
  borrowMissionEquipment,
  buyUsedEquipment,
  claimEquipmentReward,
  createMissionEquipmentRewardOffer,
  ensureEquipmentAccessState,
  equipmentAvailableToPlayer,
  listEquipmentAccessOffers,
  pendingEquipmentRewards,
  previewEquipmentTrial,
  reconcileEquipmentLoans,
  returnEquipmentLoan,
} from "../../../../tools/trpg-sim/lib/equipment-access.mjs";`,
  "equipment access imports",
);
service = replaceOnce(
  service,
  `export const TRPG_GAME_RESOLVER_VERSION = "trpg-player-world-v12";
const MIGRATABLE_RESOLVER_VERSIONS = new Set(["trpg-player-world-v8", "trpg-player-world-v9", "trpg-player-world-v10", "trpg-player-world-v11"]);`,
  `export const TRPG_GAME_RESOLVER_VERSION = "trpg-player-world-v13";
const MIGRATABLE_RESOLVER_VERSIONS = new Set(["trpg-player-world-v8", "trpg-player-world-v9", "trpg-player-world-v10", "trpg-player-world-v11", "trpg-player-world-v12"]);`,
  "resolver v13",
);
service = replaceOnce(
  service,
  `const COMMAND_TYPES = new Set(["CHOOSE", "TALK", "MOVE", "SHOP_BUY", "SHOP_SELL", "EQUIP", "UNEQUIP", "LEARN_SKILL", "TUTORIAL_ACK", "ACK_NPC_INTRODUCTION", "BATTLE_ACT"]);`,
  `const COMMAND_TYPES = new Set(["CHOOSE", "TALK", "MOVE", "SHOP_BUY", "SHOP_SELL", "SHOP_TRY", "SHOP_BUY_USED", "SHOP_BORROW", "SHOP_RETURN_LOAN", "CLAIM_EQUIPMENT_REWARD", "EQUIP", "UNEQUIP", "LEARN_SKILL", "TUTORIAL_ACK", "ACK_NPC_INTRODUCTION", "BATTLE_ACT"]);`,
  "equipment access command types",
);
service = replaceOnce(
  service,
  `  SHOP_BUY: "stockId",
  SHOP_SELL: "equipmentId",
  EQUIP: "equipmentId",`,
  `  SHOP_BUY: "stockId",
  SHOP_SELL: "equipmentId",
  SHOP_TRY: "stockId",
  SHOP_BUY_USED: "offerId",
  SHOP_BORROW: "loanId",
  SHOP_RETURN_LOAN: "loanId",
  CLAIM_EQUIPMENT_REWARD: "rewardId",
  EQUIP: "equipmentId",`,
  "equipment access payload keys",
);
service = replaceOnce(
  service,
  `  ensurePlayerNeeds(playerState.player);
  playerState.weather = canonicalWeatherForState(playerState);`,
  `  ensurePlayerNeeds(playerState.player);
  ensureEquipmentAccessState(playerState);
  playerState.weather = canonicalWeatherForState(playerState);`,
  "new runtime equipment access state",
);
service = replaceOnce(
  service,
  `      ensurePlayerNeeds(runtime.playerState.player);
      runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
      const normalizedSnapshot = serializeRuntime(runtime);`,
  `      ensurePlayerNeeds(runtime.playerState.player);
      ensureEquipmentAccessState(runtime.playerState);
      runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
      const normalizedSnapshot = serializeRuntime(runtime);`,
  "migrate equipment access state",
);
service = replaceOnce(
  service,
  `        ensurePlayerNeeds(runtime.playerState.player);
        runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
        revision = replayBase.revision;`,
  `        ensurePlayerNeeds(runtime.playerState.player);
        ensureEquipmentAccessState(runtime.playerState);
        runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
        revision = replayBase.revision;`,
  "replay equipment access migration",
);
service = replaceOnce(
  service,
  `  if (actionType === "SHOP_BUY") return "品物を受け取り、代金と在庫が帳面に記された。";
  if (actionType === "SHOP_SELL") return "店主は品を確かめ、相応の代金を差し出した。";`,
  `  if (actionType === "SHOP_BUY") return "品物を受け取り、代金と在庫が帳面に記された。";
  if (actionType === "SHOP_SELL") return "店主は品を確かめ、相応の代金を差し出した。";
  if (actionType === "SHOP_TRY" || actionType === "SHOP_TRIAL") return "店主の見守る前で装備を構え、今の装備との重さや扱いやすさを比べた。所有権と代金は動いていない。";
  if (actionType === "SHOP_BUY_USED") return "使い込まれた箇所と手入れの状態を確かめ、中古品として受け取った。";
  if (actionType === "SHOP_BORROW") return "依頼中だけ使う約束と返却条件を確認し、装備を借り受けた。";
  if (actionType === "SHOP_RETURN_LOAN") return "借りていた装備を返却し、預けていた保証金を受け取った。";
  if (actionType === "CLAIM_EQUIPMENT_REWARD") return "依頼への働きが認められ、報酬の装備を受け取った。";`,
  "equipment access fallback narratives",
);
service = replaceOnce(
  service,
  `  if (result?.meal) output.meal = { ...result.meal };
  if (result?.rest) output.rest = { ...result.rest };`,
  `  if (result?.meal) output.meal = { ...result.meal };
  if (result?.rest) output.rest = { ...result.rest };
  if (result?.comparison) output.comparison = JSON.parse(JSON.stringify(result.comparison));
  if (result?.offerId) output.offerId = cleanText(result.offerId, 160);
  if (result?.loanId) output.loanId = cleanText(result.loanId, 160);
  if (result?.rewardId) output.rewardId = cleanText(result.rewardId, 160);
  if (result?.conditionLabel) output.conditionLabel = cleanText(result.conditionLabel, 80);
  if (result?.deposit !== undefined) output.deposit = Number(result.deposit);
  if (result?.depositRefunded !== undefined) output.depositRefunded = Number(result.depositRefunded);
  if (result?.equipmentRewardOffers?.length) output.equipmentRewardOffers = result.equipmentRewardOffers.map((entry) => ({ ...entry }));
  if (result?.equipmentLoanReturns?.length) output.equipmentLoanReturns = result.equipmentLoanReturns.map((entry) => ({ ...entry }));`,
  "equipment access safe outcome",
);
service = replaceOnce(
  service,
  `  const status = ["insufficient_gold", "insufficient_sp", "insufficient_gold_for_meal", "insufficient_gold_for_lodging"].includes(code) ? 409 : 400;`,
  `  const status = [
    "insufficient_gold",
    "insufficient_sp",
    "insufficient_gold_for_meal",
    "insufficient_gold_for_lodging",
    "used_offer_unavailable",
    "used_offer_claimed",
    "loan_unavailable",
    "loan_already_active",
    "loan_not_active",
    "loan_return_wrong_facility",
    "reward_unavailable",
  ].includes(code) ? 409 : 400;`,
  "equipment access conflict errors",
);
service = replaceOnce(
  service,
  `  if (Number(state.player.inventory.equipment[equipmentId] ?? 0) <= 0) return { ok: false, reason: "not_owned" };`,
  `  if (!equipmentAvailableToPlayer(state, equipmentId)) return { ok: false, reason: "not_owned_or_borrowed" };`,
  "borrowed equipment can be equipped",
);
const accessHelper = `function equipmentComparisonSummary(comparison) {
  const labels = {
    physicalPower: "物理",
    magicPower: "魔導",
    defense: "防御",
    magicResistance: "魔防",
    agility: "敏捷",
    luck: "幸運",
    accuracy: "命中",
    evasion: "回避",
    critical: "会心",
    maxHp: "HP",
    maxMp: "MP",
    performanceIndex: "総合",
  };
  const changes = Object.entries(comparison?.delta ?? {})
    .filter(([, value]) => Number(value) !== 0)
    .sort((left, right) => Math.abs(Number(right[1])) - Math.abs(Number(left[1])))
    .slice(0, 4)
    .map(([key, value]) => (labels[key] ?? key) + (Number(value) > 0 ? "+" : "") + Number(value));
  return changes.length ? changes.join("、") : "主要性能に差はない";
}

export function reconcileEquipmentAccessAfterCommand(runtime, data, completedMissionIdsBefore = new Set()) {
  const state = runtime.playerState;
  ensureEquipmentAccessState(state);
  const completed = state.progress?.missions?.completedIds instanceof Set
    ? state.progress.missions.completedIds
    : new Set(state.progress?.missions?.completedIds ?? []);
  const definitions = [...(state.catalog?.special ?? []), ...(state.catalog?.permanent ?? [])];
  const rewards = [];
  for (const missionId of completed) {
    if (completedMissionIdsBefore.has(missionId)) continue;
    const definition = state.catalog?.byId?.get?.(missionId)
      ?? definitions.find((entry) => entry.id === missionId);
    if (!definition) continue;
    const reward = createMissionEquipmentRewardOffer(state, data.battleData, definition, {
      facilityId: state.player.facilityId,
    });
    if (reward) rewards.push(reward);
  }
  const returns = reconcileEquipmentLoans(state);
  return { rewards, returns };
}

`;
service = replaceOnce(
  service,
  `function withTemporaryTuning(state, key, value, operation) {`,
  accessHelper + `function withTemporaryTuning(state, key, value, operation) {`,
  "equipment access reconciliation helper",
);
service = replaceOnce(
  service,
  `  ensurePlayerNeeds(runtime.playerState.player);
  runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
  const activeBattle = runtime.pendingBattle?.session?.status === "active";`,
  `  ensurePlayerNeeds(runtime.playerState.player);
  ensureEquipmentAccessState(runtime.playerState);
  runtime.playerState.weather = canonicalWeatherForState(runtime.playerState);
  const activeBattle = runtime.pendingBattle?.session?.status === "active";`,
  "normalize equipment access before command",
);
service = replaceOnce(
  service,
  `    SHOP_BUY: "shop",
    SHOP_SELL: "shop",
    LEARN_SKILL: "skills",`,
  `    SHOP_BUY: "shop",
    SHOP_SELL: "shop",
    SHOP_TRY: "shop",
    SHOP_BUY_USED: "shop",
    SHOP_BORROW: "shop",
    SHOP_RETURN_LOAN: "shop",
    CLAIM_EQUIPMENT_REWARD: "shop",
    LEARN_SKILL: "skills",`,
  "tutorial locks for equipment access",
);
service = replaceOnce(
  service,
  `  const previousTroubleStates = Object.fromEntries(Object.entries(runtime.playerState.troubles).map(([id, value]) => [id, value.status]));
  let result;`,
  `  const previousTroubleStates = Object.fromEntries(Object.entries(runtime.playerState.troubles).map(([id, value]) => [id, value.status]));
  const completedMissionIdsBefore = runtime.playerState.progress?.missions?.completedIds instanceof Set
    ? new Set(runtime.playerState.progress.missions.completedIds)
    : new Set(runtime.playerState.progress?.missions?.completedIds ?? []);
  let result;`,
  "capture completed missions before command",
);
service = replaceOnce(
  service,
  `  } else if (command.type === "SHOP_SELL") {
    resolvedActionId = payload.equipmentId;
    result = sellEquipment(runtime.playerState, data.battleData, runtime.playerState.shop, payload.equipmentId);
  } else if (command.type === "EQUIP") {`,
  `  } else if (command.type === "SHOP_SELL") {
    resolvedActionId = payload.equipmentId;
    result = sellEquipment(runtime.playerState, data.battleData, runtime.playerState.shop, payload.equipmentId);
  } else if (command.type === "SHOP_TRY") {
    resolvedActionId = payload.stockId;
    result = previewEquipmentTrial(runtime.playerState, data.battleData, runtime.playerState.shop, payload.stockId, {
      location: runtime.playerState.player.location,
      facilityId: runtime.playerState.player.facilityId,
    });
    if (result.ok) {
      result.summary = result.comparison.candidateEquipmentName + "を試し、" + result.comparison.currentEquipmentName + "との差を確認した（" + equipmentComparisonSummary(result.comparison) + "）。";
    }
  } else if (command.type === "SHOP_BUY_USED") {
    resolvedActionId = payload.offerId;
    result = buyUsedEquipment(runtime.playerState, data.battleData, runtime.playerState.shop, payload.offerId, {
      location: runtime.playerState.player.location,
      facilityId: runtime.playerState.player.facilityId,
    });
    if (result.ok) {
      result.equipment = data.battleData.equipmentById.get(result.equipmentId);
      result.summary = result.equipment.name + "を中古品として" + result.price + "Gで購入した（" + result.conditionLabel + "）。";
      runtime.playerState.metrics.purchases += 1;
      runtime.playerState.metrics.zeroTimePurchases += 1;
    }
  } else if (command.type === "SHOP_BORROW") {
    resolvedActionId = payload.loanId;
    result = borrowMissionEquipment(runtime.playerState, data.battleData, runtime.playerState.shop, payload.loanId, {
      location: runtime.playerState.player.location,
      facilityId: runtime.playerState.player.facilityId,
    });
    if (result.ok) {
      result.equipment = data.battleData.equipmentById.get(result.equipmentId);
      result.summary = result.equipment.name + "を「" + result.missionTitle + "」の間だけ借りた。保証金は" + result.deposit + "G。";
    }
  } else if (command.type === "SHOP_RETURN_LOAN") {
    resolvedActionId = payload.loanId;
    result = returnEquipmentLoan(runtime.playerState, payload.loanId, {
      facilityId: runtime.playerState.player.facilityId,
    });
    if (result.ok) {
      result.equipment = data.battleData.equipmentById.get(result.equipmentId);
      result.summary = result.equipment.name + "を返却し、保証金" + result.depositRefunded + "Gを受け取った。";
    }
  } else if (command.type === "CLAIM_EQUIPMENT_REWARD") {
    resolvedActionId = payload.rewardId;
    result = claimEquipmentReward(runtime.playerState, data.battleData, payload.rewardId);
    if (result.ok) result.summary = "依頼報酬として" + result.equipment.name + "を受け取った。";
  } else if (command.type === "EQUIP") {`,
  "equipment access command branches",
);
service = replaceOnce(
  service,
  `    result.learnedRumorIds = learnedRumorIds;
    runtime.playerState.metrics.actions += 1;
  }
  if (resolvedPlayerAction?.firstIntroduction && resolvedPlayerAction.targetNpcId) {`,
  `    result.learnedRumorIds = learnedRumorIds;
    runtime.playerState.metrics.actions += 1;
  }
  const equipmentAccessChanges = reconcileEquipmentAccessAfterCommand(runtime, data, completedMissionIdsBefore);
  if (equipmentAccessChanges.rewards.length) {
    result.equipmentRewardOffers = equipmentAccessChanges.rewards.map((reward) => ({
      rewardId: reward.rewardId,
      missionId: reward.missionId,
      missionTitle: reward.missionTitle,
      equipmentId: reward.equipmentId,
      equipmentName: reward.equipmentName,
    }));
    const names = equipmentAccessChanges.rewards.map((reward) => reward.equipmentName).join("、");
    result.summary = (result.summary ? result.summary + " " : "") + "依頼報酬として受け取れる装備が用意された：" + names + "。";
  }
  if (equipmentAccessChanges.returns.length) {
    result.equipmentLoanReturns = equipmentAccessChanges.returns.map((entry) => ({
      loanId: entry.loanId,
      equipmentId: entry.equipmentId,
      depositRefunded: entry.depositRefunded,
    }));
    const refund = equipmentAccessChanges.returns.reduce((sum, entry) => sum + Number(entry.depositRefunded ?? 0), 0);
    result.summary = (result.summary ? result.summary + " " : "") + "依頼用の借用品を返却し、保証金" + refund + "Gが戻った。";
  }
  if (resolvedPlayerAction?.firstIntroduction && resolvedPlayerAction.targetNpcId) {`,
  "mission rewards and automatic loan returns",
);
service = replaceOnce(
  service,
  `  const stock = availableStockAt(state, data.battleData, state.shop).map((entry) => ({`,
  `  const equipmentAccessOffers = listEquipmentAccessOffers(state, data.battleData, state.shop, {
    location: state.player.location,
    facilityId: state.player.facilityId,
  });
  const accessOfferByStockId = new Map(equipmentAccessOffers.map((entry) => [entry.stockId, entry]));
  const stock = availableStockAt(state, data.battleData, state.shop).map((entry) => ({`,
  "equipment access offers in view",
);
service = replaceOnce(
  service,
  `    slot: data.battleData.equipmentById.get(entry.equipmentId)?.slot ?? null,
  }));
  const equippedSlots = Object.entries(state.player.equipment).map(([slot, id]) => ({ slot, id }));
  const inventoryEquipment = Object.entries(state.player.inventory.equipment)
    .filter(([, quantity]) => Number(quantity) > 0)
    .map(([id, quantity]) => equipmentView(data, id, Number(quantity), equippedSlots))
    .sort((left, right) => left.name.localeCompare(right.name, "ja"));
  const saleQuotes = inventoryEquipment.map((entry) => {`,
  `    slot: data.battleData.equipmentById.get(entry.equipmentId)?.slot ?? null,
    access: accessOfferByStockId.get(entry.id) ?? null,
  }));
  const equippedSlots = Object.entries(state.player.equipment).map(([slot, id]) => ({ slot, id }));
  const activeLoans = activeEquipmentLoans(state);
  const activeLoanByEquipmentId = new Map(activeLoans.map((loan) => [loan.equipmentId, loan]));
  const ownedInventoryEquipment = Object.entries(state.player.inventory.equipment)
    .filter(([, quantity]) => Number(quantity) > 0)
    .map(([id, quantity]) => equipmentView(data, id, Number(quantity), equippedSlots));
  const loanInventoryEquipment = activeLoans.map((loan) => ({
    ...equipmentView(data, loan.equipmentId, 0, equippedSlots),
    borrowed: true,
    loanId: loan.loanId,
    missionId: loan.missionId,
    missionTitle: loan.missionTitle,
    returnFacilityId: loan.sellerFacilityId,
  }));
  const inventoryEquipment = [...ownedInventoryEquipment, ...loanInventoryEquipment]
    .sort((left, right) => left.name.localeCompare(right.name, "ja"));
  const saleQuotes = ownedInventoryEquipment.map((entry) => {`,
  "borrowed inventory in public view",
);
service = replaceOnce(
  service,
  `  const facility = data.model.facilityById[state.player.facilityId];
  const publicFacility = publicFacilityContext(facility);`,
  `  const equipmentRewards = pendingEquipmentRewards(state).map((reward) => ({
    ...reward,
    equipment: (() => {
      const equipment = data.battleData.equipmentById.get(reward.equipmentId);
      return equipment ? {
        slot: equipment.slot,
        weaponType: equipment.weaponType,
        physicalPower: equipment.physicalPower,
        magicPower: equipment.magicPower,
        defense: equipment.defense,
        magicResistance: equipment.magicResistance,
        performanceIndex: equipment.performanceIndex,
      } : null;
    })(),
  }));
  const publicLoans = activeLoans.map((loan) => ({
    loanId: loan.loanId,
    equipmentId: loan.equipmentId,
    equipmentName: data.battleData.equipmentById.get(loan.equipmentId)?.name ?? loan.equipmentId,
    missionId: loan.missionId,
    missionTitle: loan.missionTitle,
    deposit: Number(loan.deposit ?? 0),
    sellerFacilityId: loan.sellerFacilityId,
    sellerFacilityName: data.model.facilityById[loan.sellerFacilityId]?.name ?? loan.sellerFacilityId,
    canReturnHere: loan.sellerFacilityId === state.player.facilityId,
    equipped: Object.values(state.player.equipment).includes(loan.equipmentId),
  }));
  const facility = data.model.facilityById[state.player.facilityId];
  const publicFacility = publicFacilityContext(facility);`,
  "public loans and rewards",
);
service = replaceOnce(
  service,
  `      available: !runtime.pendingBattle?.session || runtime.pendingBattle.session.status !== "active"
        ? data.battleData.inventory.some((entry) => entry.location === state.player.location && entry.sellerId === state.player.facilityId)
        : false,
      facilityName: facility?.name ?? null,
      stock,
      saleQuotes,`,
  `      available: (!runtime.pendingBattle?.session || runtime.pendingBattle.session.status !== "active")
        && (stock.length > 0 || publicLoans.some((loan) => loan.canReturnHere) || equipmentRewards.length > 0),
      facilityName: facility?.name ?? null,
      stock,
      saleQuotes,
      loans: publicLoans,
      rewards: equipmentRewards,
      accessVersion: EQUIPMENT_ACCESS_VERSION,`,
  "shop loans and rewards public view",
);
service = replaceOnce(
  service,
  `      equipment: Object.fromEntries(equippedSlots.map(({ slot, id }) => [slot, equipmentView(data, id, state.player.inventory.equipment[id] ?? 0, equippedSlots)])),`,
  `      equipment: Object.fromEntries(equippedSlots.map(({ slot, id }) => [slot, {
        ...equipmentView(data, id, state.player.inventory.equipment[id] ?? 0, equippedSlots),
        borrowed: activeLoanByEquipmentId.has(id),
        loanId: activeLoanByEquipmentId.get(id)?.loanId ?? null,
      }])),`,
  "borrowed equipped item marker",
);
service = replaceOnce(
  service,
  `      weatherRulesetVersion: WEATHER_RULESET_VERSION,`,
  `      weatherRulesetVersion: WEATHER_RULESET_VERSION,
      equipmentAccessVersion: EQUIPMENT_ACCESS_VERSION,`,
  "equipment access version in world view",
);
fs.writeFileSync(servicePath, service);

let app = fs.readFileSync(appPath, "utf8");
app = replaceOnce(
  app,
  `  const owned = inventoryEntries(currentSave.player).filter((item) => item.group === "equipment" || item.kind === "equipment" || item.slot);`,
  `  const owned = inventoryEntries(currentSave.player).filter((item) => !item.borrowed && (item.group === "equipment" || item.kind === "equipment" || item.slot));`,
  "exclude borrowed items from selling",
);
app = replaceOnce(
  app,
  `    const price = number(item.price);
    const itemName = escapeText(item.name || item.equipmentName || item.id, "商品");
    row.append(text, actionButton(
      \`${"${price.toLocaleString(\"ja-JP\")}"} G\`,
      "SHOP_BUY",
      { stockId: item.stockId || item.id },
      price > number(currentSave.player?.gold),
      \`${"${itemName}"}を${"${price.toLocaleString(\"ja-JP\")}"}Gで購入\`,
    ));`,
  `    const price = number(item.price);
    const itemName = escapeText(item.name || item.equipmentName || item.id, "商品");
    const actions = document.createElement("div");
    actions.className = "shop-actions";
    if (item.access?.trial?.available === true) {
      actions.append(actionButton(
        "試す",
        "SHOP_TRY",
        { stockId: item.stockId || item.id },
        false,
        itemName + "を試し、現在の装備と比較する",
      ));
    }
    actions.append(actionButton(
      price.toLocaleString("ja-JP") + " G",
      "SHOP_BUY",
      { stockId: item.stockId || item.id },
      price > number(currentSave.player?.gold),
      itemName + "を" + price.toLocaleString("ja-JP") + "Gで購入",
    ));
    const used = item.access?.used;
    if (used) {
      const usedPrice = number(used.price);
      actions.append(actionButton(
        "中古 " + usedPrice.toLocaleString("ja-JP") + " G",
        "SHOP_BUY_USED",
        { offerId: used.offerId },
        usedPrice > number(currentSave.player?.gold),
        itemName + "を中古品として" + usedPrice.toLocaleString("ja-JP") + "Gで購入。" + escapeText(used.conditionLabel, "状態確認済み"),
      ));
    }
    const loan = item.access?.loan;
    if (loan) {
      actions.append(actionButton(
        "借りる " + number(loan.deposit).toLocaleString("ja-JP") + " G",
        "SHOP_BORROW",
        { loanId: loan.loanId },
        number(loan.deposit) > number(currentSave.player?.gold),
        itemName + "を「" + escapeText(loan.missionTitle, "現在の依頼") + "」の間だけ借りる",
      ));
    }
    row.append(text, actions);`,
  "shop trial used and loan actions",
);
app = replaceOnce(
  app,
  `  const sellSection = document.createElement("section");`,
  `  const rewards = list(shop.rewards);
  if (rewards.length) {
    const rewardSection = document.createElement("section");
    rewardSection.className = "detail-section equipment-access-section";
    rewardSection.innerHTML = "<h3>依頼報酬</h3>";
    rewards.forEach((reward) => {
      const row = document.createElement("div");
      row.className = "detail-row";
      const text = document.createElement("div");
      text.innerHTML = "<b></b><small></small>";
      $("b", text).textContent = escapeText(reward.equipmentName, "報酬装備");
      $("small", text).textContent = "依頼「" + escapeText(reward.missionTitle, reward.missionId) + "」の報酬";
      row.append(text, actionButton(
        "受け取る",
        "CLAIM_EQUIPMENT_REWARD",
        { rewardId: reward.rewardId },
        false,
        escapeText(reward.equipmentName, "報酬装備") + "を受け取る",
      ));
      rewardSection.append(row);
    });
    ui.dialogBody.append(rewardSection);
  }
  const loans = list(shop.loans);
  if (loans.length) {
    const loanSection = document.createElement("section");
    loanSection.className = "detail-section equipment-access-section";
    loanSection.innerHTML = "<h3>借用品</h3>";
    loans.forEach((loan) => {
      const row = document.createElement("div");
      row.className = "detail-row";
      const text = document.createElement("div");
      text.innerHTML = "<b></b><small></small>";
      $("b", text).textContent = escapeText(loan.equipmentName, "借用品");
      $("small", text).textContent = [
        "依頼「" + escapeText(loan.missionTitle, loan.missionId) + "」用",
        "保証金 " + number(loan.deposit).toLocaleString("ja-JP") + "G",
        "返却先 " + escapeText(loan.sellerFacilityName, loan.sellerFacilityId),
        loan.equipped ? "装備中" : "",
      ].filter(Boolean).join(" ・ ");
      row.append(text, actionButton(
        loan.canReturnHere ? "返却" : "返却先へ移動",
        "SHOP_RETURN_LOAN",
        { loanId: loan.loanId },
        loan.canReturnHere !== true,
        loan.canReturnHere
          ? escapeText(loan.equipmentName, "借用品") + "を返却する"
          : "返却先は" + escapeText(loan.sellerFacilityName, loan.sellerFacilityId),
      ));
      loanSection.append(row);
    });
    ui.dialogBody.append(loanSection);
  }
  const sellSection = document.createElement("section");`,
  "shop reward and loan sections",
);
app = replaceOnce(
  app,
  `    $("small", text).textContent = \`所持 ${"${number(item.quantity ?? item.count, 1)}"}\`;`,
  `    $("small", text).textContent = item.borrowed
      ? ["借用品", item.missionTitle ? "依頼「" + escapeText(item.missionTitle) + "」用" : "", item.returnFacilityId ? "返却先 " + escapeText(item.returnFacilityId) : ""].filter(Boolean).join(" ・ ")
      : "所持 " + number(item.quantity ?? item.count, 1);`,
  "borrowed item inventory label",
);
app = replaceOnce(
  app,
  `  shop: ["SHOP", "購入・売却", renderShop],`,
  `  shop: ["SHOP", "購入・試用・借用・売却", renderShop],`,
  "shop panel title",
);
fs.writeFileSync(appPath, app);

let style = fs.readFileSync(stylePath, "utf8");
style += `

.shop-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: min(42%, 280px);
}
.shop-actions .row-action {
  min-width: 72px;
}
.equipment-access-section {
  border-color: rgba(208, 181, 111, .26);
  background: rgba(208, 181, 111, .05);
}
@media (max-width: 620px) {
  .shop-row { align-items: stretch; }
  .shop-actions { max-width: none; width: 100%; justify-content: flex-start; }
}
`;
fs.writeFileSync(stylePath, style);

fs.writeFileSync(serviceTestPath, `import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGameView,
  createGameRuntime,
  executeGameRuntimeCommand,
  gameStateHash,
  reconcileEquipmentAccessAfterCommand,
  TRPG_GAME_RESOLVER_VERSION,
  TrpgGameService,
} from "../../../src/server/trpg/game/service.js";

function record(runtime, data) {
  return {
    id: "equipment-access-service",
    schemaVersion: "test",
    contentRevision: data.contentRevision,
    revision: 0,
    stateHash: gameStateHash(runtime, data),
    playerName: "装備係",
    presentation: null,
    lastOutcome: null,
  };
}

function setup() {
  const game = new TrpgGameService({ allowCustomSeed: true });
  const runtime = createGameRuntime(game.data, {
    seed: "equipment-access-service",
    profileId: "balanced",
    playerName: "装備係",
    tutorial: false,
  });
  const state = runtime.playerState;
  const inventoryEntry = game.data.battleData.inventory.find((entry) => game.data.battleData.equipmentById.has(entry.equipmentId));
  assert.ok(inventoryEntry, "an equipment stock entry is required");
  state.player.location = inventoryEntry.location;
  state.player.facilityId = inventoryEntry.sellerId;
  state.player.gold = 9999;
  const mission = {
    id: "MSN-EQUIPMENT-ACCESS-TEST",
    kind: "permanent",
    title: "街道の魔物退治",
    difficulty: 1,
    finalDay: state.day + 3,
    targetLocations: [state.player.location],
    steps: [{ id: "battle", type: "battle", encounterId: "ENC-TEST", targetLocation: state.player.location, required: 1 }],
  };
  state.catalog.byId.set(mission.id, mission);
  state.catalog.permanent.push(mission);
  state.missions[mission.id] = { status: "active", progress: { battle: 0 } };
  return { game, runtime, state, mission };
}

test("resolver v13 initializes equipment access and exposes stock pathways", () => {
  const { game, runtime } = setup();
  const view = buildGameView(record(runtime, game.data), runtime, game.data);
  assert.equal(TRPG_GAME_RESOLVER_VERSION, "trpg-player-world-v13");
  assert.equal(view.world.equipmentAccessVersion, "equipment-access-v1");
  assert.ok(view.shop.stock.length > 0);
  assert.equal(view.shop.stock[0].access.trial.available, true);
  assert.ok(view.shop.stock[0].access.used);
  assert.ok(view.shop.stock[0].access.loan);
});

test("SHOP_TRY compares equipment without granting ownership", () => {
  const { game, runtime, state } = setup();
  const view = buildGameView(record(runtime, game.data), runtime, game.data);
  const item = view.shop.stock[0];
  const before = Number(state.player.inventory.equipment[item.equipmentId] ?? 0);
  const result = executeGameRuntimeCommand(runtime, game.data, {
    type: "SHOP_TRY",
    payload: { stockId: item.stockId },
  });
  assert.equal(result.outcome.ok, true);
  assert.ok(result.outcome.comparison);
  assert.equal(Number(state.player.inventory.equipment[item.equipmentId] ?? 0), before);
  assert.match(result.outcome.summary, /試/u);
});

test("used purchase, borrowing, equipping and return use the shared shop state", () => {
  const usedSetup = setup();
  let view = buildGameView(record(usedSetup.runtime, usedSetup.game.data), usedSetup.runtime, usedSetup.game.data);
  const used = view.shop.stock.find((item) => item.access?.used)?.access.used;
  assert.ok(used);
  const usedResult = executeGameRuntimeCommand(usedSetup.runtime, usedSetup.game.data, {
    type: "SHOP_BUY_USED",
    payload: { offerId: used.offerId },
  });
  assert.equal(usedResult.outcome.ok, true);
  assert.equal(usedSetup.state.player.inventory.equipment[used.equipmentId], 1);

  const loanSetup = setup();
  view = buildGameView(record(loanSetup.runtime, loanSetup.game.data), loanSetup.runtime, loanSetup.game.data);
  const loan = view.shop.stock.find((item) => item.access?.loan)?.access.loan;
  assert.ok(loan);
  const goldBefore = loanSetup.state.player.gold;
  const borrowed = executeGameRuntimeCommand(loanSetup.runtime, loanSetup.game.data, {
    type: "SHOP_BORROW",
    payload: { loanId: loan.loanId },
  });
  assert.equal(borrowed.outcome.ok, true);
  const equipped = executeGameRuntimeCommand(loanSetup.runtime, loanSetup.game.data, {
    type: "EQUIP",
    payload: { equipmentId: loan.equipmentId },
  });
  assert.equal(equipped.outcome.ok, true);
  assert.ok(Object.values(loanSetup.state.player.equipment).includes(loan.equipmentId));
  view = buildGameView(record(loanSetup.runtime, loanSetup.game.data), loanSetup.runtime, loanSetup.game.data);
  assert.ok(view.player.inventory.equipment.some((item) => item.borrowed && item.id === loan.equipmentId));
  const returned = executeGameRuntimeCommand(loanSetup.runtime, loanSetup.game.data, {
    type: "SHOP_RETURN_LOAN",
    payload: { loanId: loan.loanId },
  });
  assert.equal(returned.outcome.ok, true);
  assert.equal(loanSetup.state.player.gold, goldBefore);
  assert.equal(Object.values(loanSetup.state.player.equipment).includes(loan.equipmentId), false);
});

test("newly completed missions create one claimable equipment reward", () => {
  const { game, runtime, state, mission } = setup();
  const before = new Set(state.progress.missions.completedIds);
  state.missions[mission.id].status = "completed";
  state.progress.missions.completedIds.add(mission.id);
  const changes = reconcileEquipmentAccessAfterCommand(runtime, game.data, before);
  assert.equal(changes.rewards.length, 1);
  let view = buildGameView(record(runtime, game.data), runtime, game.data);
  assert.equal(view.shop.rewards.length, 1);
  const reward = view.shop.rewards[0];
  const result = executeGameRuntimeCommand(runtime, game.data, {
    type: "CLAIM_EQUIPMENT_REWARD",
    payload: { rewardId: reward.rewardId },
  });
  assert.equal(result.outcome.ok, true);
  assert.equal(state.player.inventory.equipment[reward.equipmentId], 1);
  view = buildGameView(record(runtime, game.data), runtime, game.data);
  assert.equal(view.shop.rewards.length, 0);
});
`);

fs.writeFileSync(uiTestPath, `import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("shop UI exposes trial used loan return and reward commands", () => {
  const app = fs.readFileSync("public/TRPG/app.js", "utf8");
  const css = fs.readFileSync("public/TRPG/style.css", "utf8");
  for (const command of ["SHOP_TRY", "SHOP_BUY_USED", "SHOP_BORROW", "SHOP_RETURN_LOAN", "CLAIM_EQUIPMENT_REWARD"]) {
    assert.ok(app.includes(command), command + " must be rendered by the playable UI");
  }
  assert.ok(app.includes("item.access?.trial"));
  assert.ok(app.includes("item.access?.used"));
  assert.ok(app.includes("item.access?.loan"));
  assert.ok(app.includes("shop.rewards"));
  assert.ok(app.includes("shop.loans"));
  assert.ok(css.includes(".shop-actions"));
});

test("borrowed inventory items remain equipable but are excluded from sale", () => {
  const app = fs.readFileSync("public/TRPG/app.js", "utf8");
  assert.ok(app.includes("!item.borrowed"));
  assert.ok(app.includes('item.borrowed\n      ? ["借用品"'));
  assert.ok(app.includes('"EQUIP"'));
});
`);

for (const path of [
  diagnosticWorkflowPath,
  diagnosticScriptPath,
  diagnosticLogPath,
  workflowPath,
  scriptPath,
]) fs.rmSync(path, { force: true });
