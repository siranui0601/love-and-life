import test from "node:test";
import assert from "node:assert/strict";
import { createBattleSpawns, createBoardDefinition, isPlayableCell } from "../../public/now-coding/boards.js";

const CASES = [
  { shape: "square", sizeKey: "small", size: 15, anchors: [[1,1],[13,1],[13,13],[1,13]], oneEnemy: 24, twoEnemies: 12 },
  { shape: "square", sizeKey: "large", size: 21, anchors: [[1,1],[19,1],[19,19],[1,19]], oneEnemy: 36, twoEnemies: 18 },
  { shape: "diamond", sizeKey: "small", size: 21, anchors: [[10,1],[19,10],[10,19],[1,10]], oneEnemy: 18, twoEnemies: 18 },
  { shape: "diamond", sizeKey: "large", size: 29, anchors: [[14,1],[27,14],[14,27],[1,14]], oneEnemy: 26, twoEnemies: 26 },
  { shape: "cross", sizeKey: "small", size: 19, anchors: [[9,1],[17,9],[9,17],[1,9]], oneEnemy: 16, twoEnemies: 16 },
  { shape: "cross", sizeKey: "large", size: 27, anchors: [[13,1],[25,13],[13,25],[1,13]], oneEnemy: 24, twoEnemies: 24 },
  { shape: "donut", sizeKey: "small", size: 19, anchors: [[1,1],[17,1],[17,17],[1,17]], oneEnemy: 32, twoEnemies: 16 },
  { shape: "donut", sizeKey: "large", size: 27, anchors: [[1,1],[25,1],[25,25],[1,25]], oneEnemy: 48, twoEnemies: 24 },
];

const key = (spawn) => `${spawn.x},${spawn.y}`;
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const nearestEnemyDistance = (spawns, index) => Math.min(...spawns.filter((_, i) => i !== index).map((other) => manhattan(spawns[index], other)));

for (const c of CASES) {
  test(`battle anchors stay one cell inside the outer edge: ${c.shape} ${c.sizeKey}`, () => {
    const def = createBoardDefinition({ boardShape: c.shape, boardSizeKey: c.sizeKey });
    assert.equal(def.size, c.size);
    const expected = c.anchors.map(([x, y]) => `${x},${y}`).sort();
    const spawns = createBattleSpawns(def, 4, `anchors:${c.shape}:${c.sizeKey}`);
    assert.deepEqual(spawns.map(key).sort(), expected);
    for (const spawn of spawns) assert.equal(isPlayableCell(def, spawn.x, spawn.y), true);
  });

  test(`battle nearest-enemy distances are stable: ${c.shape} ${c.sizeKey}`, () => {
    const def = createBoardDefinition({ boardShape: c.shape, boardSizeKey: c.sizeKey });
    const allowed = new Set(c.anchors.map(([x, y]) => `${x},${y}`));
    for (let seedIndex = 0; seedIndex < 32; seedIndex += 1) {
      const twoPlayers = createBattleSpawns(def, 2, `distance-2:${c.shape}:${c.sizeKey}:${seedIndex}`);
      assert.equal(twoPlayers.length, 2);
      for (let i = 0; i < twoPlayers.length; i += 1) {
        assert.equal(allowed.has(key(twoPlayers[i])), true);
        assert.equal(nearestEnemyDistance(twoPlayers, i), c.oneEnemy);
      }

      const threePlayers = createBattleSpawns(def, 3, `distance-3:${c.shape}:${c.sizeKey}:${seedIndex}`);
      assert.equal(threePlayers.length, 3);
      for (let i = 0; i < threePlayers.length; i += 1) {
        assert.equal(allowed.has(key(threePlayers[i])), true);
        assert.equal(nearestEnemyDistance(threePlayers, i), c.twoEnemies);
      }
    }
  });
}
