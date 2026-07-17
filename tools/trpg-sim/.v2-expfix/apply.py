from pathlib import Path

p = Path('tools/trpg-sim/lib/player-journey.mjs')
s = p.read_text()
old = '''  const sourceType = source.startsWith("battle:") ? "battle" : source.startsWith("mission:MSN-T") ? "specialMission" : source.startsWith("mission:") ? "permanentMission" : "other";'''
new = '''  const missionId = source.startsWith("mission:") ? source.slice("mission:".length) : null;
  const sourceType = source.startsWith("battle:")
    ? "battle"
    : missionId
      ? state.catalog.byId.get(missionId)?.kind === "special" ? "specialMission" : "permanentMission"
      : "other";'''
assert old in s
s = s.replace(old, new)
old = '''    exp += Number(monster.exp ?? 0);'''
new = '''    exp += Number(monster.exp ?? 0) * Number(state.tuning.battleExpMultiplier ?? 1);'''
assert old in s
s = s.replace(old, new)
old = '''  addExperience(state, exp, `battle:${result.encounterId}`, data, skills, profile);'''
new = '''  exp = Math.max(0, Math.round(exp));
  addExperience(state, exp, `battle:${result.encounterId}`, data, skills, profile);'''
assert old in s
s = s.replace(old, new)
p.write_text(s)

cp = Path('tools/trpg-sim/config/player-simulation.v2.json')
c = cp.read_text()
c = c.replace('"missionExpMultiplier": 1.0,', '"missionExpMultiplier": 1.0,\n    "battleExpMultiplier": 1.0,', 1)
c = c.replace('"missionExpMultiplier": 0.90,', '"missionExpMultiplier": 0.90,\n    "battleExpMultiplier": 0.10,', 1)
cp.write_text(c)
