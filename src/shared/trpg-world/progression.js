export const LEVEL_XP = Object.freeze([0,80,190,330,500,700,940,1220,1540,1900,2300,2750]);
export const MOVEMENT = Object.freeze({
  foot: {speed:4.2, sprint:6.4, cost:0}, horse: {speed:10, sprint:13, skill:'riding', item:'horse', cost:0},
  carriage: {speed:7, cost:12}, broom: {speed:12, sprint:14, skill:'broom', item:'broom', cost:0},
  boat: {speed:6,cost:10}, ship: {speed:9,cost:18}, wagon: {speed:6,cost:8}, magic: {speed:20,skill:'magic',cost:30},
});
export function awardXp(state, amount, key) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const day = Math.floor(state.time / 86400), repeatKey = `${day}:${key}`;
  state.rewards ||= {};
  const repeats = state.rewards[repeatKey] || 0;
  const earned = Math.round(amount / (1 + repeats * .7));
  state.rewards[repeatKey] = repeats + 1;
  const p = state.player; p.xp += earned;
  let level = 1; while (level < LEVEL_XP.length && p.xp >= LEVEL_XP[level]) level++;
  if (level > p.level) {
    const gained = level - p.level; p.sp += gained; p.maxHp += gained * 8; p.maxMp += gained * 3;
    p.hp = Math.min(p.maxHp,p.hp + gained * 8); p.mp = Math.min(p.maxMp,p.mp + gained * 3); p.level = level;
  }
  // Only current/previous days are needed for anti-grind diminishing returns.
  for (const oldKey of Object.keys(state.rewards)) if (Number(oldKey.split(':')[0]) < day - 1) delete state.rewards[oldKey];
  return earned;
}
export function forceOf(player, content) {
  const gear = (content.equipment || []).find(i=>i.id===player.equipment?.mainHand);
  return 5 + player.level * 4 + (player.skills.includes('combat') ? 12 : 0) + (gear?.attack || 0);
}
export function priceOf(state, item, regionId) {
  const region = state.regions[regionId] || {stock:1,threat:0};
  const scarcity = Math.max(.65,Math.min(2.8,1 / Math.max(.35,region.stock)));
  const reputation = Math.max(.8,Math.min(1.3,1 - (state.player.reputation[regionId] || 0) * .008));
  return Math.max(1,Math.round(item.price * scarcity * reputation));
}
