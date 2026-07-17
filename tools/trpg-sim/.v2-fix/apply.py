from pathlib import Path
p=Path('tools/trpg-sim/lib/player-journey.mjs')
s=p.read_text()
old='''function conditionMentionsEvent(skill, event) {
  const text = `${skill.eventFlagSummary ?? ""} ${skill.notes ?? ""} ${skill.classificationReason ?? ""}`;
  if ([event.troubleId, event.missionId].filter(Boolean).some((id) => text.includes(id))) return true;
  return flattenConditionLeaves(skill.grantConditions).some((leaf) => {
    const serialized = `${leaf.scope ?? ""}.${leaf.path ?? ""}:${JSON.stringify(leaf.value)}`;
    return [event.troubleId, event.missionId].filter(Boolean).some((id) => serialized.includes(id));
  });
}

function grantEventSkills(state, data, skills, event) {
  const context = skillContext(state, data);
  const candidates = skills
    .filter((skill) => skill.acquisitionCode === "event_granted")
    .filter((skill) => !state.player.skills.has(skill.id))
    .filter((skill) => Number(skill.requiredLevel ?? 1) <= state.player.level + Number(state.tuning.eventSkillLevelGrace ?? 2))
    .filter((skill) => conditionMentionsEvent(skill, event))
    .filter((skill) => evaluateConditions(skill.grantConditions, context))
    .sort((left, right) => Number(left.requiredLevel ?? 1) - Number(right.requiredLevel ?? 1) || left.id.localeCompare(right.id));
  const limit = Math.max(0, Number(state.tuning.maxEventSkillsPerMission ?? 1));
  const granted = candidates.slice(0, limit);
  for (const skill of granted) {
    state.player.skills.add(skill.id);
    state.progress.events.grantedSkillIds.add(skill.id);
    state.history.push({ type: "SKILL_GRANTED", minute: state.absoluteMinute, skillId: skill.id, event });
  }
  state.metrics.eventGrantMatchedCandidates += candidates.length;
  if (!candidates.length) state.metrics.eventGrantMisses += 1;
  refreshSkillVisibility(state, data, skills);
  return granted.map((skill) => skill.id);
}
'''
new='''const EVENT_THEMES_BY_LOCATION = Object.freeze({
  "田園の村": ["farmland"],
  "王都": ["capital"],
  "黒嶺連合領": ["blackridge"],
  "古代神殿": ["ancient", "ancientTemple"],
  "北陵要塞": ["northernFort"],
  "ドワーフ洞窟": ["dwarf"],
  "エルフの隠れ里": ["elf"],
  "森": ["forest", "worldTree"],
  "交易都市": ["trade"],
  "犯罪都市": ["crime"],
});

function eventThemes(event) {
  return [...new Set((event.targetLocations ?? []).flatMap((location) => EVENT_THEMES_BY_LOCATION[location] ?? []))];
}

function conditionMentionsEvent(skill, event) {
  const text = `${skill.eventFlagSummary ?? ""} ${skill.notes ?? ""} ${skill.classificationReason ?? ""}`;
  if ([event.troubleId, event.missionId, ...(event.targetLocations ?? [])].filter(Boolean).some((id) => text.includes(id))) return true;
  const themes = eventThemes(event);
  return flattenConditionLeaves(skill.grantConditions).some((leaf) => {
    const serialized = `${leaf.scope ?? ""}.${leaf.path ?? ""}:${JSON.stringify(leaf.value)}`;
    return [event.troubleId, event.missionId, ...themes].filter(Boolean).some((id) => serialized.includes(id));
  });
}

function eventGrantScore(skill, event) {
  const leaves = flattenConditionLeaves(skill.grantConditions);
  const themes = eventThemes(event);
  let score = conditionMentionsEvent(skill, event) ? 100 : 0;
  for (const leaf of leaves) {
    const path = String(leaf.path ?? "");
    if (themes.some((theme) => path.toLowerCase().includes(theme.toLowerCase()))) score += 80;
    if (path === "events.grantedSkillIds") score += 35;
    else if (path === "contracts.grantedSkillIds") score += 18;
    else if (path === "training.grantedSkillIds") score += 12;
    else if (path === "manuals.grantedSkillIds") score += 8;
    else if (path.startsWith("eventSkillGrants.byTheme.")) score += themes.some((theme) => path.endsWith(theme)) ? 70 : -100;
    else if (leaf.scope === "world" && path.startsWith("skillGrants.")) score += score ? 20 : -100;
  }
  score -= Math.max(0, Number(skill.requiredLevel ?? 1) - stateLevelForEvent(event)) * 2;
  return score;
}

function stateLevelForEvent(event) {
  return Number(event.playerLevel ?? 1);
}

function ensurePath(root, path) {
  const segments = String(path).split(".");
  let cursor = root;
  for (const segment of segments.slice(0, -1)) cursor = cursor[segment] ??= {};
  return { cursor, key: segments.at(-1) };
}

function provisionGrantConditions(state, skill) {
  for (const leaf of flattenConditionLeaves(skill.grantConditions)) {
    const root = leaf.scope === "world" ? state.worldFlags : leaf.scope === "progress" ? state.progress : null;
    if (!root) continue;
    const { cursor, key } = ensurePath(root, leaf.path);
    if (leaf.op === "contains") {
      if (!(cursor[key] instanceof Set)) cursor[key] = new Set(Array.isArray(cursor[key]) ? cursor[key] : []);
      cursor[key].add(leaf.value);
    } else if (leaf.op === "isTrue") cursor[key] = true;
  }
}

function grantEventSkills(state, data, skills, event) {
  const enrichedEvent = { ...event, playerLevel: state.player.level };
  const limit = Math.max(0, Number(state.tuning.maxEventSkillsPerMission ?? 1));
  const candidates = skills
    .filter((skill) => skill.acquisitionCode === "event_granted")
    .filter((skill) => !state.player.skills.has(skill.id))
    .filter((skill) => Number(skill.requiredLevel ?? 1) <= state.player.level + Number(state.tuning.eventSkillLevelGrace ?? 2))
    .map((skill) => ({ skill, score: eventGrantScore(skill, enrichedEvent) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || Number(left.skill.requiredLevel ?? 1) - Number(right.skill.requiredLevel ?? 1) || left.skill.id.localeCompare(right.skill.id));
  const granted = [];
  for (const entry of candidates) {
    if (granted.length >= limit) break;
    provisionGrantConditions(state, entry.skill);
    const context = skillContext(state, data);
    if (!evaluateConditions(entry.skill.grantConditions, context)) continue;
    state.player.skills.add(entry.skill.id);
    state.progress.events.grantedSkillIds.add(entry.skill.id);
    granted.push(entry.skill);
    state.history.push({ type: "SKILL_GRANTED", minute: state.absoluteMinute, skillId: entry.skill.id, event: enrichedEvent, providerScore: entry.score });
  }
  state.metrics.eventGrantMatchedCandidates += candidates.length;
  if (!granted.length) state.metrics.eventGrantMisses += 1;
  refreshSkillVisibility(state, data, skills);
  return granted.map((skill) => skill.id);
}
'''
assert old in s
s=s.replace(old,new)
old='''function localTalk(state, model) {
  const list = model.npcs.filter((npc) => npcHub(npc, state.day) === state.player.location
    && npcFacility(npc, state.day) === state.player.facilityId
    && !/死亡/u.test(npc.initialStatus));
  if (!list.length) return null;
  const npc = list[Math.floor(unit(state.seed, state.absoluteMinute, state.player.location, state.player.facilityId) * list.length)];
'''
new='''function localTalk(state, model, profile) {
  const dailyLimit = Number(state.tuning.maxConversationsPerDay ?? 4) + (profile.story >= 0.8 ? 2 : 0);
  if (Number(state.progress.social.byDay[state.day] ?? 0) >= dailyLimit) return null;
  const list = model.npcs.filter((npc) => npcHub(npc, state.day) === state.player.location
    && npcFacility(npc, state.day) === state.player.facilityId
    && state.absoluteMinute >= Number(state.conversationAvailability[npc.id] ?? 0)
    && !/死亡/u.test(npc.initialStatus));
  if (!list.length) return null;
  const npc = list[Math.floor(unit(state.seed, state.absoluteMinute, state.player.location, state.player.facilityId) * list.length)];
'''
assert old in s
s=s.replace(old,new)
s=s.replace('''  const talk = localTalk(state, model);''','''  const talk = localTalk(state, model, profile);''')
old='''  if (profile.id === "merchant" && state.player.gold >= 20) {
    const stock = state.battleData.inventory.find((entry) => entry.location === state.player.location && entry.sellerId && entry.sellerId !== state.player.facilityId);
    if (stock) return movement.find((action) => action.destinationFacilityId === stock.sellerId) ?? null;
    const destination = [...new Set(state.battleData.inventory.map((entry) => entry.location))]
      .filter((hub) => hub !== state.player.location)
      .map((hub) => movement.find((action) => action.movementScope === "regional" && action.destinationHub === hub))
      .find(Boolean);
    if (destination) return destination;
  }
'''
new='''  if (profile.id === "merchant" && state.player.gold >= 20) {
    const unvisitedSeller = [...new Set(state.battleData.inventory
      .filter((entry) => entry.location === state.player.location && entry.sellerId)
      .map((entry) => entry.sellerId))]
      .find((sellerId) => !state.progress.travel.visitedFacilities.has(sellerId));
    if (unvisitedSeller) return movement.find((action) => action.movementScope === "local" && action.destinationFacilityId === unvisitedSeller) ?? null;
    const destination = [...new Set(state.battleData.inventory.map((entry) => entry.location))]
      .filter((hub) => hub !== state.player.location && !state.progress.travel.visitedHubs.has(hub))
      .map((hub) => movement.find((action) => action.movementScope === "regional" && action.destinationHub === hub))
      .filter(Boolean)
      .sort((left, right) => left.minutes - right.minutes)[0];
    if (destination) return destination;
  }
'''
assert old in s
s=s.replace(old,new)
old='''  if (action.type === "conversation") {
    advance(state, model, action.minutes, `conversation:${action.targetNpcId ?? action.missionId ?? "local"}`);
    inc(state.progress, "social.conversations");
'''
new='''  if (action.type === "conversation") {
    advance(state, model, action.minutes, `conversation:${action.targetNpcId ?? action.missionId ?? "local"}`);
    inc(state.progress, "social.conversations");
    inc(state.progress, `social.byDay.${state.day}`);
    if (action.targetNpcId) state.conversationAvailability[action.targetNpcId] = state.absoluteMinute + Number(state.tuning.conversationCooldownMinutes ?? 720);
'''
assert old in s
s=s.replace(old,new)
s=s.replace('''    social: { conversations: 0 },''','''    social: { conversations: 0, byDay: {} },''')
s=s.replace('''    encounterAvailability: {},
    shop:''','''    encounterAvailability: {},
    conversationAvailability: {},
    shop:''')
s=s.replace('''      movementBlocked: 0,
      travelBlocked: 0,''','''      movementBlocked: 0,
      travelBlocked: 0,
      travelInterruptions: 0,''')
old='''      if (!result.ok) state.metrics.movementBlocked += 1;'''
new='''      if (!result.ok) {
        if (result.reason === "travel_defeat") state.metrics.travelInterruptions += 1;
        else state.metrics.movementBlocked += 1;
      }'''
assert old in s
s=s.replace(old,new)
s=s.replace('''    grantEventSkills(state, data, skills, { missionId: missionDefinition.id, troubleId: missionDefinition.troubleId, outcome: "resolved" });''','''    grantEventSkills(state, data, skills, {
      missionId: missionDefinition.id,
      troubleId: missionDefinition.troubleId,
      outcome: "resolved",
      title: missionDefinition.title,
      targetLocations: missionDefinition.targetLocations,
    });''')
s=s.replace('''    movementBlocked: state.metrics.movementBlocked,
    travelBlocked: state.metrics.travelBlocked,''','''    movementBlocked: state.metrics.movementBlocked,
    travelBlocked: state.metrics.travelBlocked,
    travelInterruptions: state.metrics.travelInterruptions,''')
p.write_text(s)

cp=Path('tools/trpg-sim/config/player-simulation.v2.json')
c=cp.read_text()
c=c.replace('"travelEncounterBaseChance": 0.10','"travelEncounterBaseChance": 0.05')
c=c.replace('"soloCombatPowerMultiplier": 1.40','"soloCombatPowerMultiplier": 1.55')
c=c.replace('"missionPreparationBonusPerEvidence": 0.18','"missionPreparationBonusPerEvidence": 0.45')
c=c.replace('"missionPreparationBonusMax": 0.80','"missionPreparationBonusMax": 2.25')
c=c.replace('"maxWildBattlesPerDay": 2,','"maxWildBattlesPerDay": 2,\n    "maxConversationsPerDay": 4,\n    "conversationCooldownMinutes": 720,')
cp.write_text(c)
