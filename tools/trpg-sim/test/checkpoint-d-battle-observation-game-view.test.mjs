import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import { battleObservationsFromSave } from '../../../public/TRPG/battle-observation-view.js';

test('Checkpoint D-0 Game View consumes only server observation INFO commands as player-facing facts', () => {
  const observations = battleObservationsFromSave({
    battle: {
      status: 'active',
      commands: [
        { actionId: 'INFO:INTENT:x', kind: 'info', name: '予兆：古代兵器 → 古代砲', description: '古代兵器が次の行動として「古代砲」を構えている。' },
        { actionId: 'INFO:PHASE:x', kind: 'info', name: 'フェーズ 2：過熱', description: '古代兵器は現在フェーズ2「過熱」。' },
        { actionId: 'ATTACK', kind: 'attack', name: 'こうげき' },
        { actionId: 'SKILL:SKL-0001', kind: 'skill', name: 'スラッシュ' },
      ],
    },
  });

  assert.deepEqual(observations.map((entry) => entry.id), ['INFO:INTENT:x', 'INFO:PHASE:x']);
  assert.ok(observations.every((entry) => entry.name && entry.description));
  assert.equal(observations.some((entry) => /守れ|狙え|使え|倒せ/u.test(entry.description)), false,
    'the observation layer displays facts, not a generated strategy answer');
});

test('Checkpoint D-0 public TRPG Game View mounts the battle observation module', async () => {
  const index = await fs.readFile(new URL('../../../public/TRPG/index.html', import.meta.url), 'utf8');
  assert.match(index, /<script type="module" src="\/TRPG\/battle-observation-view\.js\?v=20260824-d0"><\/script>/u);
  assert.match(index, /id="battleCommandPanel"/u);
  assert.match(index, /id="battleCommandPrompt"/u);
});
