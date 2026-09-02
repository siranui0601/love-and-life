from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern: {label} in {path}")
    p.write_text(text.replace(old, new, 1))


# 1) Donut board: square outer board with a square center hole.
replace_once(
    "public/now-coding/boards.js",
    '  const donutInner = sizeKey === "small" ? 3.5 : 6;\n',
    '  const donutHoleHalf = sizeKey === "small" ? 2 : 3;\n',
    "donut hole size",
)
replace_once(
    "public/now-coding/boards.js",
    '''      else if (shape === "donut") {\n        const distance = Math.hypot(x - center, y - center);\n        playable = distance <= center + 1e-9 && distance >= donutInner;\n      }''',
    '''      else if (shape === "donut") {\n        playable = Math.abs(x - center) > donutHoleHalf || Math.abs(y - center) > donutHoleHalf;\n      }''',
    "square donut mask",
)

# 2) Battle anchors: give all four anchors one consistent clockwise starting direction.
old_direction = '''function directionTowardCenter(boardDef, cell) {\n  const center = (boardDef.size - 1) / 2;\n  const vectors = [\n    { x: 0, y: -1, dir: 0 },\n    { x: 1, y: 0, dir: 1 },\n    { x: 0, y: 1, dir: 2 },\n    { x: -1, y: 0, dir: 3 },\n  ];\n  const candidates = vectors\n    .filter((v) => isPlayableCell(boardDef, cell.x + v.x, cell.y + v.y))\n    .map((v) => ({ ...v, score: (cell.x + v.x - center) ** 2 + (cell.y + v.y - center) ** 2 }))\n    .sort((a, b) => a.score - b.score || a.dir - b.dir);\n  return candidates[0]?.dir ?? 0;\n}\n'''
new_direction = old_direction + '''\nconst BATTLE_ANCHOR_DIRECTIONS = [1, 2, 3, 0]; // top-left/top -> right, top-right/right -> down, bottom-right/bottom -> left, bottom-left/left -> up\nfunction directionForBattleAnchor(boardDef, cell, anchorIndex) {\n  const preferred = BATTLE_ANCHOR_DIRECTIONS[anchorIndex % BATTLE_ANCHOR_DIRECTIONS.length];\n  const vector = [\n    { x: 0, y: -1 },\n    { x: 1, y: 0 },\n    { x: 0, y: 1 },\n    { x: -1, y: 0 },\n  ][preferred];\n  if (isPlayableCell(boardDef, cell.x + vector.x, cell.y + vector.y)) return preferred;\n  return directionTowardCenter(boardDef, cell);\n}\n'''
replace_once("public/now-coding/boards.js", old_direction, new_direction, "battle anchor direction helper")
replace_once(
    "public/now-coding/boards.js",
    '''  const anchors = anchorTargets(boardDef.shape).map(([nx, ny]) => {\n    const cell = nearestPlayable(boardDef, nx, ny, used);\n    if (!cell) return null;\n    used.add(`${cell.x},${cell.y}`);\n    return { ...cell, dir: directionTowardCenter(boardDef, cell) };\n  }).filter(Boolean);''',
    '''  const anchors = anchorTargets(boardDef.shape).map(([nx, ny], anchorIndex) => {\n    const cell = nearestPlayable(boardDef, nx, ny, used);\n    if (!cell) return null;\n    used.add(`${cell.x},${cell.y}`);\n    return { ...cell, dir: directionForBattleAnchor(boardDef, cell, anchorIndex) };\n  }).filter(Boolean);''',
    "battle anchor mapping",
)

# 3) Test battle placement must reroll even when board shape/size are fixed.
replace_once(
    "public/now-coding/app-v3.js",
    'if(!isTutorial()&&(c.spawnMode==="random"||c.boardShape==="random"||c.boardSizeKey==="random")){state.testRollSeed=freshSeed();c=effectiveTestConfig();}',
    'if(!isTutorial()&&(c.spawnMode==="random"||c.spawnMode==="battle"||c.boardShape==="random"||c.boardSizeKey==="random")){state.testRollSeed=freshSeed();c=effectiveTestConfig();}',
    "test battle spawn reroll",
)

# 4) iOS Safari: keep form controls at 16px on touch devices instead of disabling pinch zoom.
style = Path("public/now-coding/style-v7.css")
css = style.read_text()
mobile_rule = '''\n/* Prevent iOS Safari from auto-zooming numeric / variable and other form inputs on focus. */\n@media (hover:none) and (pointer:coarse){\n  input,select,textarea{font-size:16px!important}\n}\n'''
if mobile_rule.strip() not in css:
    style.write_text(css.rstrip() + mobile_rule)

# 5) Regression tests.
replace_once(
    "tools/now-coding/engine.test.mjs",
    '    "donut:small": [19, 216], "donut:large": [27, 420],',
    '    "donut:small": [19, 336], "donut:large": [27, 680],',
    "donut playable counts",
)

engine_tests = Path("tools/now-coding/engine.test.mjs")
text = engine_tests.read_text()
append = r'''

test("donut is a square board with a centered square hole", () => {
  for (const sizeKey of ["small", "large"]) {
    const def = createBoardDefinition({ boardShape: "donut", boardSizeKey: sizeKey });
    const center = (def.size - 1) / 2;
    const half = sizeKey === "small" ? 2 : 3;
    assert.equal(isPlayableCell(def, 0, 0), true, `${sizeKey}: outer corner stays playable`);
    assert.equal(isPlayableCell(def, def.size - 1, def.size - 1), true, `${sizeKey}: opposite outer corner stays playable`);
    assert.equal(isPlayableCell(def, center, center), false, `${sizeKey}: center is void`);
    assert.equal(isPlayableCell(def, center + half, center + half), false, `${sizeKey}: square-hole corner is void`);
    assert.equal(isPlayableCell(def, center + half + 1, center), true, `${sizeKey}: first cell outside square hole is playable`);
  }
});

test("square battle anchors use the same clockwise starting directions", () => {
  const def = createBoardDefinition({ boardShape: "square", boardSizeKey: "small" });
  const spawns = createBattleSpawns(def, 4, "square-anchor-directions");
  const center = (def.size - 1) / 2;
  for (const spawn of spawns) {
    let expected;
    if (spawn.x < center && spawn.y < center) expected = 1;       // left-top -> right
    else if (spawn.x > center && spawn.y < center) expected = 2;  // right-top -> down
    else if (spawn.x > center && spawn.y > center) expected = 3;  // right-bottom -> left
    else expected = 0;                                            // left-bottom -> up
    assert.equal(spawn.dir, expected, `spawn ${spawn.x},${spawn.y}`);
  }
});

test("all board shapes keep the preferred battle-anchor direction when that step is playable", () => {
  const vectors = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];
  for (const shape of ["square", "diamond", "cross", "donut"]) {
    for (const sizeKey of ["small", "large"]) {
      const def = createBoardDefinition({ boardShape: shape, boardSizeKey: sizeKey });
      const spawns = createBattleSpawns(def, 4, `${shape}:${sizeKey}:directions`);
      const center = (def.size - 1) / 2;
      for (const spawn of spawns) {
        let expected;
        if (shape === "square" || shape === "donut") {
          if (spawn.x < center && spawn.y < center) expected = 1;
          else if (spawn.x > center && spawn.y < center) expected = 2;
          else if (spawn.x > center && spawn.y > center) expected = 3;
          else expected = 0;
        } else {
          const dx = spawn.x - center, dy = spawn.y - center;
          if (Math.abs(dy) >= Math.abs(dx)) expected = dy < 0 ? 1 : 3;
          else expected = dx > 0 ? 2 : 0;
        }
        const v = vectors[expected];
        assert.equal(isPlayableCell(def, spawn.x + v.x, spawn.y + v.y), true, `${shape}:${sizeKey} preferred step must be playable`);
        assert.equal(spawn.dir, expected, `${shape}:${sizeKey} ${spawn.x},${spawn.y}`);
      }
    }
  }
});

test("single-player battle placement can select all four formal anchors across seeds", () => {
  const def = createBoardDefinition({ boardShape: "square", boardSizeKey: "small" });
  const seen = new Set();
  for (let i = 0; i < 96; i += 1) {
    const [spawn] = createBattleSpawns(def, 1, `battle-reroll-${i}`);
    seen.add(`${spawn.x},${spawn.y}`);
  }
  assert.equal(seen.size, 4);
});
'''
if 'test("donut is a square board with a centered square hole"' not in text:
    engine_tests.write_text(text.rstrip() + append + "\n")

client = Path("tools/now-coding/client-contract.test.mjs")
ct = client.read_text()
client_append = r'''

test("mobile inputs do not trigger iOS focus zoom", () => {
  assert.match(css, /@media \(hover:none\) and \(pointer:coarse\)/);
  assert.match(css, /input,select,textarea\{font-size:16px!important\}/);
  assert.doesNotMatch(html, /maximum-scale=1|user-scalable=no/);
});

test("test battle placement rerolls its seed on every execution", () => {
  assert.match(app, /c\.spawnMode==="random"\|\|c\.spawnMode==="battle"\|\|c\.boardShape==="random"/);
});
'''
if 'test("mobile inputs do not trigger iOS focus zoom"' not in ct:
    client.write_text(ct.rstrip() + client_append + "\n")

print("board/spawn/mobile input fixes applied")
