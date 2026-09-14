# 戦闘content v1 checkpoint

2026-08-16時点の戦闘正本とruntimeを、勝敗だけでなく「戦闘中に何を考えるか」で監査するcheckpoint。

## 正本と件数

- spreadsheet: `TRPG_戦闘データマスターβ1`
- spreadsheet ID: `1-2mUA20d7h1lmv1G9fCH0EryFEYyFQ2nkamN51uCPqw`
- monster: 77
- boss: 9
- monster skill: 96
- monster action: 286（MON-0076へ既存`MSK-0012 翼刃`の無条件・CT0 actionを1行追加）
- encounter: 76
- 複数role編成: 15

正本には次の監査tabを追加した。

- `戦闘個性監査`: 77体の戦術的一文、skill、条件、priority、weight、CT、MP、target、purpose
- `ボス監査`: 9体のphase、中心gimmick、telegraph、複数counterplay/build、AI条件、勝利条件
- `戦闘認証_v1`: bossごとの固定seed deterministic fixtureの選択・行動多様性・反復・状態・resource・gimmick指標

## runtime contract

敵AIは次の順序で行動を選ぶ。

1. 条件、MP、使用上限、cooldownで候補を絞る
2. 最大priorityから20点以内のintent bandだけを残す
3. band内でpriority補正後のweight抽選を行う
4. 全skillが一時的にcooldown中なら、通常のbasic attackを挟む
5. action行自体がない場合だけ`candidateExhaustion`として失敗診断する

現在の正本は、未対応command 0、未対応special-state semantics 0、未対応debuff semantics 0、条件参照不整合0、無条件action欠落0、boss catalog欠落0である。

実装済みcommandは、damage/heal/buff/debuff/state/resource操作に加えて以下を含む。

- `SUMMON_UNIT`: 召喚個体をserver stateとtimeline combatantsへ追加
- `MODIFY_FIELD`: `fieldEffects`のstackを更新
- `MODIFY_ESCAPE`: 敵の撤退成否と`escaped`状態を更新
- `INTERRUPT_CAST`: `casting`を確率で解除
- `COPY_LAST_ENEMY_SKILL`: 再現可能な直前skillを75%等の指定倍率で模倣

`taunt`、`counter`、`reflect`、`manaShield`、`healing_down`、`damage_taken_up`も表示だけでなくdamage・target・resource計算へ作用する。

## boss gimmick

boss catalogは各bossの中心gimmickを1〜3個に限定し、単一skill必須のcounterplayを書かない。`MON-0017`、`MON-0018`、`MON-0028`、`MON-0063`、`MON-0064`、`MON-0077`の大技は一手前にtelegraph eventを出し、次のplayer commandでguard、barrier、回復、状態異常、target protection、burst等を選べる。

phase transition、telegraph、summon、field change、copy、escape、interruptはtimeline eventとしてUIへ渡る。

## deterministic certification

```bash
npm run trpg:combat-audit
npm run trpg:combat-certify
node --test tools/trpg-sim/test/combat-content.test.mjs
```

`combat-certification-v1.json`はbossごとに固定seedを1本だけ使い、最大12roundのauthoritative interactive command列を計測する。seed探索、route replay、Monte Carloによる成功経路探索は行わない。

記録値は、意味あるplayer選択数、enemy skill使用数、enemy/player action種類、同一action最大連続、phase transition、status/buff/debuff、resource判断、gimmick interaction、戦闘roundである。同一actionの反復回数だけを自動失格条件にはしない。

11件の汎用monster skillは`runtime_ready_unassigned_generic`として明示的に残る。生態・地域・役割に合う使用者を正本で決めるまでは、coverage目的で既存monsterへ偽割当しない。
