#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPlayerBuild, loadBattleData } from './lib/battle-model.mjs';
import {
  beginInteractiveBattle,
  listInteractiveBattleCommands,
  resolveInteractiveBattleRound,
} from './lib/battle-simulator.mjs';
import { certifyBattleTimeline } from './lib/combat-certification.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const outputPath = path.resolve(
  process.argv[2] ?? path.join(REPO_ROOT, 'docs', 'trpg', 'combat-certification-v1.json'),
);
const data = await loadBattleData();

const policySkillIds = ['SKL-0009', 'SKL-0010', 'SKL-0001', 'SKL-0019', 'SKL-0228'];

function buildFor(monster) {
  const level = Math.max(monster.recommendedLevelMin, Math.min(monster.level, monster.recommendedLevelMax));
  return createPlayerBuild(data, {
    id: `cert-${monster.id}`,
    name: `Combat certification Lv${level}`,
    level,
    equipmentIds: [],
    skillIds: policySkillIds,
    baseStats: {
      maxHp: 1800 + level * 260,
      maxMp: 160,
      attack: 18 + level * 3,
      defense: 28 + level * 4,
      agility: 24 + level * 2,
      luck: 10 + level,
      physicalPower: 20 + level * 3.5,
      magicPower: 18 + level * 3,
      magicResistance: 25 + level * 4,
      accuracy: 12,
      evasion: 5,
      critical: 5,
      debuffSuccess: 18,
      debuffResistance: 25,
    },
  });
}

function targetFor(command) {
  return command.targets?.[0]?.instanceId;
}

function chooseCommand(session, commands) {
  const telegraphed = session.lastRound?.frames?.some((frame) => (
    (frame.events ?? []).some((event) => event.type === 'telegraph')
  ));
  if (telegraphed) return commands.find((command) => command.actionId === 'DEFEND' && command.available);
  const turn = Number(session.state.turn ?? 0);
  const rotation = turn % 5 === 3
    ? ['SKILL:SKL-0019', 'SKILL:SKL-0228']
    : policySkillIds.map((id, index) => policySkillIds[(turn + index) % policySkillIds.length]).map((id) => `SKILL:${id}`);
  for (const actionId of rotation) {
    const command = commands.find((candidate) => candidate.actionId === actionId && candidate.available);
    if (command) return command;
  }
  return commands.find((command) => command.actionId === 'ATTACK' && command.available)
    ?? commands.find((command) => command.actionId === 'DEFEND' && command.available);
}

const certifications = [];
for (const boss of data.bossCatalog.bosses) {
  const monster = data.monsterById.get(boss.monsterId);
  const encounter = data.encounters.find((candidate) => (
    candidate.composition.some((entry) => entry.monsterId === boss.monsterId)
  ));
  let session = beginInteractiveBattle({
    data,
    seed: `combat-certification-v1:${boss.monsterId}`,
    ...(encounter ? { encounterId: encounter.id } : { monsterIds: [boss.monsterId] }),
    playerBuild: buildFor(monster),
    maxTurns: 12,
  });
  let result = null;
  while (session.status === 'active') {
    const commands = listInteractiveBattleCommands({ data, session });
    const selected = chooseCommand(session, commands);
    if (!selected) throw new Error(`No deterministic certification command for ${boss.monsterId}`);
    const resolved = resolveInteractiveBattleRound({
      data,
      session,
      command: { actionId: selected.actionId, targetInstanceId: targetFor(selected) },
    });
    if (!resolved.ok) throw new Error(`${boss.monsterId}: ${resolved.reason}`);
    session = resolved.session;
    result = resolved.result;
  }
  certifications.push(certifyBattleTimeline(result, {
    certificationId: `CERT-${boss.monsterId}`,
    bossId: boss.bossId,
    monsterId: boss.monsterId,
  }));
}

const artifact = {
  schemaVersion: 'combat-certification-v1',
  generatedAt: '2026-08-16',
  mode: 'one fixed deterministic 12-round-or-resolution interactive scenario per canonical boss',
  discoverySearch: false,
  randomSeedSearch: false,
  monteCarlo: false,
  routeReplay: false,
  interpretation: 'Metrics are evidence for design review; no single repetition threshold is an automatic failure.',
  policy: {
    skillIds: policySkillIds,
    telegraphResponse: 'DEFEND',
    otherwise: 'fixed rotating skill order with authoritative availability checks',
  },
  certifications,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  outputPath,
  bosses: certifications.length,
  fallbackAttacks: certifications.reduce((sum, item) => sum + item.fallbackAttacks, 0),
  candidateExhaustion: certifications.reduce((sum, item) => sum + item.candidateExhaustion, 0),
  enemySkillUses: certifications.reduce((sum, item) => sum + item.enemySkillUseCount, 0),
  gimmickInteractions: certifications.reduce((sum, item) => sum + item.gimmickInteractionCount, 0),
}, null, 2));
