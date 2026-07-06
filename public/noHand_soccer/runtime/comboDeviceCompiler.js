import { comboSlotRoles, resolveCatalogAbility } from './abilityCatalog.js';

export const COMBO_COMPILER_VERSION = 1;

const ROLES = ['core', 'modifier', 'output'];
const FALLBACK = ['hiddenRoute', 'warpExit', 'aimAssist', 'trapHold', 'splitScatter', 'reflectShield', 'paintTrail'];

const FAMILY_VISUAL = Object.freeze({
  bounce: ['slimeBubble', '#9cff6e', '#e8ff59'],
  clone: ['multiGate', '#c084fc', '#f0abfc'],
  combo: ['chainRing', '#fbbf24', '#fde68a'],
  electric: ['sparkNode', '#67e8f9', '#facc15'],
  gravity: ['orbitalWell', '#a78bfa', '#34d399'],
  hold: ['trapJaw', '#fb7185', '#fda4af'],
  launch: ['burstRing', '#fb923c', '#fed7aa'],
  light: ['lightRail', '#fef08a', '#ffffff'],
  magnet: ['polarityRing', '#f472b6', '#60a5fa'],
  motion: ['dashCapsule', '#38bdf8', '#bae6fd'],
  route: ['routeRibbon', '#38bdf8', '#22d3ee'],
  space: ['portalGate', '#c084fc', '#93c5fd'],
  speed: ['overclockRing', '#22c55e', '#bef264'],
  spin: ['spinDisc', '#60a5fa', '#c4b5fd'],
  targeting: ['targetScope', '#facc15', '#fef08a'],
  thermal: ['steamColumn', '#fb7185', '#fdba74'],
  time: ['clockFace', '#818cf8', '#e0e7ff'],
  zone: ['effectLane', '#2dd4bf', '#99f6e4'],
});

export function hashComboKey(value) {
  let h = 2166136261;
  for (const ch of String(value)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRandom(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function normalizeProfile(profile, index) {
  const emoji = String(profile?.emoji || '').trim();
  if (!emoji) return null;
  return {
    emoji,
    index,
    displayNameJa: profile.displayNameJa || profile.sourceName || emoji,
    sourceName: profile.sourceName || emoji,
    abilities: Array.isArray(profile.abilities) ? profile.abilities.filter(Boolean) : [],
    note: profile.note || '',
  };
}

function roleWeight(entry, role) {
  const base = Number(entry?.slotWeight?.[role] ?? 1);
  const status = entry?.status === 'active' ? 1 : entry?.status === 'rework' ? 0.86 : 0.5;
  return Math.max(0, base * status);
}

function catalogCandidate(profile, ability, role, fallback = false) {
  const resolved = resolveCatalogAbility(ability);
  if (!resolved) return null;
  const { name, entry, aliasFrom } = resolved;
  if (!entry || entry.status === 'deprecated') return null;
  if (entry.status !== 'active' && entry.status !== 'rework') return null;
  return {
    role,
    sourceEmoji: profile.emoji,
    sourceName: profile.displayNameJa,
    sourceAbility: ability,
    name,
    aliasFrom,
    entry,
    fallback,
    weight: roleWeight(entry, role) * (fallback ? 0.32 : 1),
  };
}

function collectCandidates(profiles, role) {
  const roleIndex = comboSlotRoles[role]?.index ?? ROLES.indexOf(role);
  const preferred = profiles[roleIndex] || profiles[0];
  const ordered = [preferred, ...profiles.filter((profile) => profile !== preferred)].filter(Boolean);
  const candidates = [];
  for (const profile of ordered) {
    for (const ability of profile.abilities) {
      const candidate = catalogCandidate(profile, ability, role);
      if (candidate) candidates.push(candidate);
    }
  }
  if (!candidates.length && preferred) {
    for (const ability of FALLBACK) {
      const candidate = catalogCandidate(preferred, ability, role, true);
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates;
}

function pickWeighted(candidates, random) {
  const total = candidates.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return candidates[0] || null;
  let cursor = random() * total;
  for (const candidate of candidates) {
    cursor -= candidate.weight;
    if (cursor <= 0) return candidate;
  }
  return candidates[candidates.length - 1] || null;
}

function chooseActions(profiles, random) {
  const usedNames = new Set();
  const usedFamilies = new Set();
  const actions = [];
  for (const role of ROLES) {
    const candidates = collectCandidates(profiles, role)
      .filter((candidate) => !usedNames.has(candidate.name))
      .map((candidate) => ({
        ...candidate,
        weight: candidate.weight * (usedFamilies.has(candidate.entry.family) ? 0.58 : 1),
      }));
    const picked = pickWeighted(candidates, random);
    if (!picked) continue;
    usedNames.add(picked.name);
    usedFamilies.add(picked.entry.family);
    actions.push(picked);
  }
  return actions;
}

function resolveParam(value, random) {
  if (!Array.isArray(value)) return value;
  if (value.length === 2 && value.every((item) => typeof item === 'number')) {
    const [min, max] = value;
    const result = min + (max - min) * random();
    return Number.isInteger(min) && Number.isInteger(max) ? Math.round(result) : Number(result.toFixed(3));
  }
  return value[Math.floor(random() * value.length) % Math.max(1, value.length)] ?? null;
}

function resolveParams(params, random) {
  return Object.fromEntries(Object.entries(params || {}).map(([key, value]) => [key, resolveParam(value, random)]));
}

function actionStep(candidate, index, random) {
  return {
    index,
    role: candidate.role,
    name: candidate.name,
    sourceAbility: candidate.sourceAbility,
    aliasFrom: candidate.aliasFrom,
    sourceEmoji: candidate.sourceEmoji,
    sourceName: candidate.sourceName,
    status: candidate.entry.status,
    family: candidate.entry.family,
    action: candidate.entry.action,
    lifecycle: candidate.entry.lifecycle,
    intent: candidate.entry.intent,
    params: resolveParams(candidate.entry.params, random),
    visual: candidate.entry.visual,
    avoid: candidate.entry.avoid,
    fallback: candidate.fallback,
  };
}

function buildVisual(actions, random) {
  const family = actions[0]?.entry.family || 'combo';
  const [shape, accent, secondary] = FAMILY_VISUAL[family] || ['comboRing', '#e8ff59', '#76f0a1'];
  const frames = actions.flatMap((action) => action.entry.visual?.frame || []);
  return {
    shape,
    frame: frames.length ? frames[Math.floor(random() * frames.length)] : shape,
    accent,
    secondary,
    background: `${accent}24`,
    mixedFamilies: [...new Set(actions.map((action) => action.entry.family))],
    motif: actions.map((action) => action.entry.visual?.effect).filter(Boolean).join(' / '),
  };
}

export function compileComboDevice(inputProfiles, options = {}) {
  const profiles = inputProfiles.map(normalizeProfile).filter(Boolean).slice(0, 3);
  if (profiles.length !== 3) throw new Error('compileComboDevice requires exactly three emoji profiles.');
  const comboKey = profiles.map((profile) => profile.emoji).join('|');
  const seed = options.seed ?? hashComboKey(`${comboKey}|${profiles.map((profile) => profile.abilities.join(',')).join('|')}`);
  const random = createSeededRandom(seed);
  const picked = chooseActions(profiles, random);
  const paramRandom = createSeededRandom(seed ^ 0x9e3779b9);
  const actions = picked.map((candidate, index) => actionStep(candidate, index, paramRandom));
  const visual = buildVisual(picked, random);
  const device = {
    version: COMBO_COMPILER_VERSION,
    comboKey,
    seed,
    recipe: profiles.map((profile) => profile.emoji),
    sourceProfiles: profiles,
    name: `${profiles.map((profile) => profile.emoji).join('')}合成装置`,
    visual,
    actions,
    warnings: picked.some((candidate) => candidate.fallback) ? ['selectable ability が足りない素材に fallback action を使いました。'] : [],
  };
  return {
    ...device,
    summary: `${device.recipe.join('')}を合成した${visual.shape}が、${actions.map((action) => action.action).join(' → ')}を起こす`,
  };
}

export function compileComboFromEmojiProfiles(profileMap, emojis, options = {}) {
  return compileComboDevice(emojis.map((emoji) => ({ emoji, ...(profileMap?.[emoji] || {}) })), options);
}

export function getCatalogCoverage(abilityNames = []) {
  return abilityNames.map((ability) => {
    const resolved = resolveCatalogAbility(ability);
    if (!resolved) return { ability, selectable: false, status: 'missing' };
    return {
      ability,
      selectable: resolved.entry.status === 'active' || resolved.entry.status === 'rework',
      resolvedName: resolved.name,
      aliasFrom: resolved.aliasFrom,
      status: resolved.entry.status,
      family: resolved.entry.family,
      action: resolved.entry.action,
    };
  });
}
