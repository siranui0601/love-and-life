import test from 'node:test';
import assert from 'node:assert/strict';

import { playerFacingBattleDisabledDetail } from '../lib/battle-simulator.mjs';

const cases = [
  ['field_required', '必要な陣・フィールドが設置されていない'],
  ['missing_history', '再演できる直前のスキル履歴がない'],
  ['wrong_weapon', '必要な武器種を装備していない'],
  ['shield_required', '盾を装備している必要がある'],
  ['use_limit', 'この戦闘での使用回数を使い切った'],
  ['sealed', '封印されているため使用できない'],
  ['equipment_disabled', '必要な装備効果が現在無効になっている'],
  ['invalid_target', 'このスキルを向けられる対象ではない'],
  ['no_target', '効果を向けられる対象がいない'],
];

test('Checkpoint D exposes player-facing Japanese reasons for tactical command locks', () => {
  for (const [reason, expected] of cases) {
    assert.equal(playerFacingBattleDisabledDetail({ disabledReason: reason }), expected, reason);
  }
});

test('Checkpoint D resource and cooldown lock details expose the actionable requirement', () => {
  assert.equal(
    playerFacingBattleDisabledDetail({ disabledReason: 'insufficient_mp', mpCost: 14, currentMp: 6 }),
    'MPが足りない（必要MP 14／現在 6）',
  );
  assert.equal(
    playerFacingBattleDisabledDetail({ disabledReason: 'insufficient_hp', hpCost: 20, currentHp: 12 }),
    'HPが足りない（必要HP 21以上／現在 12）',
  );
  assert.equal(
    playerFacingBattleDisabledDetail({ disabledReason: 'cooldown', cooldownRemaining: 2 }),
    '再使用まで待つ必要がある（あと2ラウンド）',
  );
  assert.equal(
    playerFacingBattleDisabledDetail({ disabledReason: 'insufficient_gold', goldCost: 250 }),
    '支払うGoldが足りない（必要 250G）',
  );
});

test('Checkpoint D keeps legacy internal reasons mapped to their public tactical meaning', () => {
  assert.equal(
    playerFacingBattleDisabledDetail({ disabledReason: 'no_owned_field' }),
    '必要な陣・フィールドが設置されていない',
  );
  assert.equal(
    playerFacingBattleDisabledDetail({ disabledReason: 'no_repeatable_history' }),
    '再演できる直前のスキル履歴がない',
  );
  assert.equal(
    playerFacingBattleDisabledDetail({ disabledReason: 'weapon_requirement' }),
    '必要な武器種を装備していない',
  );
}