from pathlib import Path
p=Path('tools/trpg-sim/lib/player-journey.mjs')
s=p.read_text()
a=s.index('function selectEncounter(')
b=s.index('\nfunction travelEncounter(',a)
replacement='''function selectEncounter(state, data, profile, key) {
  const candidates = encounters(state, data, profile);
  const limit = dangerLimit(state, profile);
  const safeTier = Math.max(1, Math.min(limit, 1 + Math.floor((state.player.level - 1) / 4)));
  const targetTier = profile.id === "fighter" ? limit : profile.id === "cautious" ? Math.max(1, safeTier - 1) : safeTier;
  return weighted(candidates, key, (encounter) => {
    const tier = Number(encounter.dangerTier ?? 1);
    const distance = Math.abs(tier - targetTier);
    const base = Number(encounter.baseWeight || 1);
    if (profile.id === "fighter") return base * (1 + tier * 0.2);
    if (profile.caution > profile.combat) return base / (1 + distance * 1.5 + Math.max(0, tier - targetTier) * 0.5);
    return base / (1 + distance);
  });
}
'''
p.write_text(s[:a]+replacement+s[b:])
