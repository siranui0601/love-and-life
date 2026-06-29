export async function loadProfiles(url = './emoji_physics_profiles.json') {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`profile load failed: ${response.status}`);
  const data = await response.json();
  return { meta: data, profiles: Object.entries(data.profiles ?? {}).map(([emoji, profile]) => ({ emoji, ...profile })) };
}

export function filterProfiles(profiles, query) {
  const q = query.trim().toLowerCase();
  if (!q) return profiles;
  return profiles.filter((p) => [p.emoji, p.sourceName, p.displayNameJa, p.note, ...(p.abilities ?? [])].join(' ').toLowerCase().includes(q));
}
