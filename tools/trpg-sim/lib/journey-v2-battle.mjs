import { createPlayerBuild } from "./battle-model.mjs";
import { simulateBattle } from "./battle-simulator.mjs";
import { advanceV2, incV2, unitV2 } from "./journey-v2-core.mjs";
import { battleSkillIdsV2 } from "./journey-v2-skills.mjs";

function createBuild(state, data, multiplier = 1) {
  const power = Math.max(.5, Number(state.tuning.soloCombatPowerMultiplier ?? 1) * Number(multiplier ?? 1));
  return createPlayerBuild(data, {
    id: `journey-v2-${state.profileId}-lv${state.player.level}`,
    level: state.player.level,
    equipmentIds: Object.values(state.player.equipment).filter(Boolean),
    skillIds: battleSkillIdsV2(state, data),
    baseStats: {
      attack: (8 + state.player.level * 3 + state.player.stats.attack) * power,
      defense: (5 + state.player.level * 2.2 + state.player.stats.defense) * power,
      agility: (8 + state.player.level * 1.8 + state.player.stats.agility) * Math.sqrt(power),
      luck: 5 + state.player.level * .6 + state.player.stats.luck,
      maxHp: (70 + state.player.level * 18 + state.player.stats.defense * 3) * power,
      maxMp: (25 + state.player.level * 6) * Math.max(1, Math.sqrt(power)),
    },
  });
}

function recordActionUsage(state, data, result, build) {
  const weapon = build.equipmentIds.map((id) => data.equipmentById.get(id)).find((item) => item?.slot === "mainHand");
  const path = { oneHandedSword: "oneHanded", twoHandedSword: "twoHanded", axe: "axe", spear: "spear", bow: "bow", staff: "staff", book: "book" }[weapon?.weaponType];
  if (path) {
    const uses = Object.entries(result.actionUsage).filter(([id]) => id !== "__normal__").reduce((sum, [, count]) => sum + Number(count), 0);
    incV2(state.progress, `weapon.${path}.skillUses`, uses);
  }
  for (const [id, count] of Object.entries(result.actionUsage)) {
    if (id === "__normal__") continue;
    const skill = data.playerSkillById.get(id); if (!skill) continue;
    if (/魔法|魔導|杖|本/u.test(`${skill.category ?? ""}`)) {
      incV2(state.progress, "magic.totalCasts", count);
      incV2(state.progress, "magic.mpSpent", Number(skill.costs?.mp ?? 0) * count);
    } else incV2(state.progress, "combat.physicalSkillUses", count);
    if (skill.debuffs?.length) incV2(state.progress, "debuffs.stat.successfulApplications", Math.floor(count * .65));
    if (skill.buffs?.length) incV2(state.progress, "buffs.successfulApplications", count);
    if (Number(skill.damage?.hits ?? 1) > 1) incV2(state.progress, "multiHit.actions", count);
  }
}

function rewards(state, data, result, key) {
  let exp = 0; let gold = 0; let kills = 0;
  result.monsterIds.forEach((id, index) => {
    const monster = data.monsterById.get(id); if (!monster) return;
    exp += Number(monster.exp ?? 0);
    gold += Math.round(Number(monster.goldMin ?? 0) + unitV2(key, id, index) * (Number(monster.goldMax ?? 0) - Number(monster.goldMin ?? 0)));
    kills += 1;
    incV2(state.progress.combat.killsByName, monster.name);
  });
  incV2(state.progress, "combat.totalKills", kills);
  incV2(state.progress, "combat.physicalKills", kills);
  const main = Object.values(state.player.equipment).map((id) => data.equipmentById.get(id)).find((item) => item?.slot === "mainHand");
  const path = { oneHandedSword: "oneHanded", twoHandedSword: "twoHanded", axe: "axe", spear: "spear", bow: "bow" }[main?.weaponType];
  if (path) incV2(state.progress, `weapon.${path}.kills`, kills);
  state.player.gold += gold;
  state.progress.economy.goldFromBattles += gold;
  return { exp, gold, kills };
}

export function runBattleV2({ state, model, data, profile, encounterId, key, situationalMultiplier = 1, addExperience }) {
  const full = createBuild(state, data, situationalMultiplier);
  const scaled = {
    ...full,
    id: `${full.id}:${state.metrics.battles + 1}`,
    maxHp: Math.max(1, Math.round(full.maxHp * Math.max(.18, state.player.hpRatio))),
    maxMp: Math.max(0, Math.round(full.maxMp * Math.max(.03, state.player.mpRatio))),
  };
  const result = simulateBattle({ data, encounterId, playerBuild: scaled, seed: key, maxTurns: 100 });
  state.metrics.battles += 1;
  const actor = result.players[0];
  state.player.hpRatio = Math.max(0, Math.min(1, state.player.hpRatio * actor.hp / Math.max(1, scaled.maxHp)));
  state.player.mpRatio = scaled.maxMp ? Math.max(0, Math.min(1, state.player.mpRatio * actor.mp / scaled.maxMp)) : 0;
  const won = result.winner === "players";
  incV2(state.progress, "battles.totalCount");
  incV2(state.progress, won ? "battles.wins" : "battles.defeatCount");
  incV2(state.progress, `battles.byDaypart.${state.daypart}`);
  incV2(state.progress, "combat.criticalHits", result.totalCriticals);
  recordActionUsage(state, data, result, full);
  let gained = { exp: 0, gold: 0, kills: 0 };
  if (won) {
    state.metrics.wins += 1;
    gained = rewards(state, data, result, key);
    const rawExp = gained.exp;
    const awardedExp = Math.max(0, Math.round(rawExp * Number(state.tuning.battleExpMultiplier ?? 1)));
    gained = { ...gained, rawExp, exp: awardedExp };
    addExperience(awardedExp, `battle:${encounterId}`);
  } else {
    state.metrics.losses += 1;
    state.player.gold = Math.floor(state.player.gold * .9);
    state.player.hpRatio = Math.max(state.player.hpRatio, .35);
    state.player.mpRatio = Math.max(state.player.mpRatio, .2);
    advanceV2(state, model, state.tuning.defeatRecoveryMinutes ?? 360, "defeat-recovery");
  }
  state.history.push({ type: "BATTLE_RESOLVED", minute: state.absoluteMinute, encounterId, winner: result.winner, rewards: gained });
  return { ...result, won, rewards: gained };
}
