import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOrThrow(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label}_not_found`);
  return source.replace(before, after);
}

{
  const path = "public/now-coding/modes.js";
  let source = read(path);
  source = replaceOrThrow(
    source,
    `  // A tile disappears at the start of the tick exactly two ticks after it was\n  // first stepped on. The first visit owns the deadline; revisiting the tile\n  // never extends its lifetime.\n  collapseDueFallCells(state);\n\n  const actions = new Map();`,
    `  const actions = new Map();`,
    "fall_start_collapse_block",
  );
  source = replaceOrThrow(
    source,
    `    scheduleFallCollapse(state, agent.x, agent.y);\n  }\n  finishSurvival(state);\n  return state;\n}\n\nfunction createSplatState`,
    `    scheduleFallCollapse(state, agent.x, agent.y);\n  }\n\n  // The deadline tick is still playable. Sensors and the physical action run\n  // first, then every due tile becomes a cliff. A piece that escapes on this\n  // tick survives; a piece that remains on the tile is eliminated.\n  collapseDueFallCells(state);\n  finishSurvival(state);\n  return state;\n}\n\nfunction createSplatState`,
    "fall_end_anchor",
  );
  write(path, source);
}

{
  const path = "tools/now-coding/engine.test.mjs";
  let source = read(path);
  source = source.replace(
    'test("floor mode makes move1 floor a cliff at the start of move3 tick", () => {',
    'test("floor mode makes move1 floor a cliff after move3 resolves", () => {',
  ).replace(
    '  stepGame(state); // tick 3 start: move1 floor collapses, then move3',
    '  stepGame(state); // tick 3: move3 resolves, then move1 floor collapses',
  );

  const oldBlock = /test\("floor mode collapses move1 floor at move2 tick after an intervening turn", \(\) => \{[\s\S]*?\n\}\);\n/;
  if (!oldBlock.test(source)) throw new Error("engine_move_turn_move_test_not_found");
  source = source.replace(oldBlock, `test("floor mode allows one turn before escaping on the deadline tick", () => {
  const state = createGameState({ mode: "fall", seed: "fall-move-turn-move", size: 15, players: [{ id:"a", program:[move,right,move] }, { id:"b", program:[move] }], spawns:[{x:5,y:5,dir:0},{x:12,y:12,dir:2}] });
  const agent = state.agents[0];
  stepGame(state); // tick 1: move1 -> 5,4
  assert.equal(agent.alive, true);
  assert.equal(state.fallCollapseAt.get("5,4"), 3);
  stepGame(state); // tick 2: turn while still on 5,4
  assert.equal(agent.alive, true);
  assert.equal(state.holes.has("5,4"), false);
  stepGame(state); // tick 3: move2 escapes first, then 5,4 collapses
  assert.equal(agent.alive, true);
  assert.equal(agent.x, 6);
  assert.equal(agent.y, 4);
  assert.equal(state.holes.has("5,4"), true);
});

test("floor mode collapses under a piece that spends the deadline tick turning", () => {
  const state = createGameState({ mode: "fall", seed: "fall-move-turn-turn", size: 15, players: [{ id:"a", program:[move,right,right] }, { id:"b", program:[move] }], spawns:[{x:5,y:5,dir:0},{x:12,y:12,dir:2}] });
  const agent = state.agents[0];
  stepGame(state);
  stepGame(state);
  assert.equal(agent.alive, true);
  stepGame(state); // second turn resolves, then the floor collapses underneath
  assert.equal(agent.alive, false);
  assert.equal(agent.deathReason, "floor_collapse");
  assert.equal(state.holes.has("5,4"), true);
});

test("floor mode can detect the collapsed starting floor and still reach forever move", () => {
  const program = [
    move,
    right,
    {
      type: "if",
      condition: { type: "binary", op: "==", left: { type: "sensor", direction: "right" }, right: literal("cliff") },
      then: [
        { type: "set", name: "ゲームモード", value: literal("床抜け") },
        { type: "forever", body: [move] },
      ],
      else: [],
    },
  ];
  const state = createGameState({ mode: "fall", seed: "fall-mode-detect", size: 15, allowSolo: true, players: [{ id:"a", program }], spawns:[{x:5,y:5,dir:1}] });
  const agent = state.agents[0];
  stepGame(state); // 5,5 -> 6,5
  stepGame(state); // right turn; after the action 5,5 collapses
  assert.equal(agent.alive, true);
  assert.equal(state.holes.has("5,5"), true);
  stepGame(state); // right sensor sees 5,5 as cliff; set + forever are zero-time; move executes
  assert.equal(agent.alive, true);
  assert.equal(agent.vars["ゲームモード"], "床抜け");
  assert.equal(agent.x, 6);
  assert.equal(agent.y, 6);
  assert.equal(state.holes.has("6,5"), true);
});
`);
  write(path, source);
}

{
  const path = "tools/now-coding/fall-timed-collapse.test.mjs";
  write(path, `import test from "node:test";
import assert from "node:assert/strict";
import { createGameState, senseModeCell, stepGame } from "../../public/now-coding/modes.js";

const move = { type: "action", action: "move" };
const right = { type: "action", action: "turnRight" };
const literal = (value) => ({ type: "literal", value });
const forever = (body) => ({ type: "forever", body });

function fallState(program, { x = 5, y = 5, dir = 1 } = {}) {
  return createGameState({
    mode: "fall",
    allowSolo: true,
    seed: "fall-timed-collapse",
    size: 15,
    maxTicks: 50,
    players: [{ id: "a", name: "A", color: "blue", program }],
    spawns: [{ x, y, dir }],
  });
}

test("fall v4 collapses a first-stepped tile after the deadline action resolves", () => {
  const state = fallState([forever([move])]);
  const agent = state.agents[0];
  assert.equal(state.ruleVersion, "fall-v4");
  assert.equal(state.fallCollapseAt.get("5,5"), 2, "starting floor is already stepped on at tick 0");

  stepGame(state); // tick 1: move1 -> 6,5; due at tick 3
  assert.equal(state.tick, 1);
  assert.equal(agent.x, 6);
  assert.equal(state.fallCollapseAt.get("6,5"), 3);
  assert.equal(state.holes.has("5,5"), false);

  stepGame(state); // tick 2: move2 resolves, then spawn floor collapses
  assert.equal(state.tick, 2);
  assert.equal(agent.alive, true);
  assert.equal(agent.x, 7);
  assert.equal(state.holes.has("5,5"), true);
  assert.equal(state.holes.has("6,5"), false);

  stepGame(state); // tick 3: move3 resolves, then move1 floor collapses
  assert.equal(state.tick, 3);
  assert.equal(agent.alive, true);
  assert.equal(agent.x, 8);
  assert.equal(state.holes.has("6,5"), true);
  assert.equal(state.holes.has("7,5"), false);
});

test("move then turn then move escapes before the stepped floor collapses", () => {
  const state = fallState([move, right, move], { x: 5, y: 5, dir: 0 });
  const agent = state.agents[0];

  stepGame(state); // tick 1: move1 -> 5,4; due at tick 3
  assert.equal(agent.alive, true);
  assert.equal(state.fallCollapseAt.get("5,4"), 3);

  stepGame(state); // tick 2: one turn is allowed
  assert.equal(agent.alive, true);
  assert.equal(state.holes.has("5,4"), false);

  stepGame(state); // tick 3: move2 executes first; then 5,4 becomes a cliff
  assert.equal(agent.alive, true);
  assert.equal(agent.x, 6);
  assert.equal(agent.y, 4);
  assert.equal(state.holes.has("5,4"), true);
});

test("staying on a due tile for the deadline action still causes floor collapse", () => {
  const state = fallState([move, right, right], { x: 5, y: 5, dir: 0 });
  const agent = state.agents[0];
  stepGame(state);
  stepGame(state);
  stepGame(state);
  assert.equal(agent.alive, false);
  assert.equal(agent.deathReason, "floor_collapse");
  assert.equal(agent.deathTick, 3);
  assert.equal(state.holes.has("5,4"), true);
});

test("the user mode-detection structure reaches forever move and observes the collapsed floor", () => {
  const program = [
    move,
    right,
    {
      type: "if",
      condition: { type: "binary", op: "==", left: { type: "sensor", direction: "right" }, right: literal("cliff") },
      then: [
        { type: "set", name: "ゲームモード", value: literal("床抜け") },
        forever([move]),
      ],
      else: [],
    },
  ];
  const state = fallState(program, { x: 5, y: 5, dir: 1 });
  const agent = state.agents[0];

  stepGame(state); // tick 1: move to 6,5
  stepGame(state); // tick 2: turn right; starting floor 5,5 collapses after the turn
  assert.equal(agent.alive, true);
  assert.equal(state.holes.has("5,5"), true);

  stepGame(state); // tick 3: right sensor points back to 5,5 and sees cliff; then forever move runs
  assert.equal(agent.alive, true);
  assert.equal(agent.vars["ゲームモード"], "床抜け");
  assert.equal(agent.x, 6);
  assert.equal(agent.y, 6);
  assert.equal(state.holes.has("6,5"), true, "move1 floor collapses only after the tick 3 move has resolved");
});

test("revisiting a scheduled floor never extends its original collapse deadline", () => {
  const state = fallState([forever([move])]);
  state.fallCollapseAt.set("6,5", 2);
  stepGame(state); // tick 1 enters 6,5, existing deadline remains tick 2
  assert.equal(state.fallCollapseAt.get("6,5"), 2);
  stepGame(state); // tick 2 move escapes, then 6,5 collapses
  assert.equal(state.agents[0].alive, true);
  assert.equal(state.holes.has("6,5"), true);
});

test("collapsed fall tiles are exposed to sensors as cliffs", () => {
  const state = fallState([forever([move])]);
  const agent = state.agents[0];
  state.holes.add("6,5");
  assert.equal(senseModeCell(state, agent, "front").state, "cliff");
});

test("zero-time VM work does not change a tile deadline because only game ticks age floors", () => {
  const program = [
    move,
    { type: "set", name: "mode", value: literal("床抜け") },
    { type: "if", condition: literal(true), then: [forever([move])], else: [] },
  ];
  const state = fallState(program);
  stepGame(state); // tick 1: move to 6,5; schedule tick 3
  assert.equal(state.fallCollapseAt.get("6,5"), 3);
  stepGame(state); // set/if/forever are zero-time; inner move is tick 2 physical action
  assert.equal(state.tick, 2);
  assert.equal(state.agents[0].vars.mode, "床抜け");
  assert.equal(state.agents[0].x, 7);
  assert.equal(state.fallCollapseAt.get("6,5"), 3);
  stepGame(state); // tick 3 move resolves, then 6,5 collapses
  assert.equal(state.holes.has("6,5"), true);
});
`);
}

{
  const path = "public/now-coding/tutorials.js";
  let source = read(path);
  source = replaceOrThrow(source,
    'summary: "一度踏んだ床が2tick後に崖へ変わる中、崩落のタイミングを読みながら生き残ります。"',
    'summary: "一度踏んだ床が2tick後の身体行動後に崖へ変わる中、崩落のタイミングを読みながら生き残ります。"',
    "tutorial_summary");
  source = replaceOrThrow(source,
    '      { title: "踏んだ床は2tick後に崩れる", text: "床抜けでは、初めて踏んだ床はその2tick後の開始時に崖になります。開始マスもゲーム開始時点ですでに踏んでいる床として扱われます。同じ床をもう一度踏んでも崩落時刻は延びません。", focus: "#testBoard" },',
    '      { title: "踏んだ床は2tick後に崩れる", text: "床抜けでは、初めて踏んだ床はその2tick後の身体行動が終わった直後に崖になります。開始マスもゲーム開始時点ですでに踏んでいる床として扱われます。同じ床をもう一度踏んでも崩落時刻は延びません。", focus: "#testBoard" },',
    "tutorial_rule");
  source = replaceOrThrow(source,
    '      { title: "進み続けると穴が後ろに残る", text: "『進む1 → 進む2 → 進む3』なら、進む3のtick開始時には進む1で踏んだ床が崖になっています。前へ進み続けても、通った床は2tick後に順番に崩れていきます。", focus: "#runTestButton" },',
    '      { title: "進み続けると穴が後ろに残る", text: "『進む1 → 進む2 → 進む3』なら、進む3を実行した直後に進む1で踏んだ床が崖になります。前へ進み続けると、通った床が2tick遅れで後ろから順番に崩れていきます。", focus: "#runTestButton" },',
    "tutorial_three_moves");
  source = replaceOrThrow(source,
    '      { title: "旋回しても床の時計は止まらない", text: "『進む1 → 旋回 → 進む2』では、進む2のtick開始時に進む1で踏んだ床が崖になります。その時点でまだその床に立っていれば、進む2を実行する前に崩落してゲームオーバーです。", focus: \'[data-add-block="turn"]\' },',
    '      { title: "旋回1回なら脱出できる", text: "『進む1 → 旋回 → 進む2』では、進む2まで実行できます。その進む2が終わった直後に進む1で踏んだ床が崖になるため、1回の旋回を挟んでも脱出できます。もう1tickその床に残れば、行動後の崩落に巻き込まれます。", focus: \'[data-add-block="turn"]\' },',
    "tutorial_turn_escape");
  source = replaceOrThrow(source,
    '      { title: "穴も崖として見える", text: "一度崩れた床は穴になります。センサーでは盤面外と同じ『崖』として扱えるため、『＜（前）＝（崖）＞』の回避ロジックをそのまま利用できます。", focus: \'[data-expression-preset="compare"]\' },',
    '      { title: "穴も崖として見える", text: "一度崩れた床は穴になります。たとえば『進む → 右に旋回』の後は開始床が崩れて右側に残るため、次のtickで『＜（右）＝（崖）＞』として判定できます。", focus: \'[data-expression-preset="compare"]\' },',
    "tutorial_sensor");
  write(path, source);
}

{
  const path = "public/now-coding/app-v3.js";
  let source = read(path);
  source = replaceOrThrow(source,
    '  fall: ["床抜け", "タイマーが2進む間、連続で前進しないと足元が崩れます。旋回と前進を組み合わせ、最後まで生き残ります。"],',
    '  fall: ["床抜け", "一度踏んだ床は2tick後の身体行動が終わった直後に崖になります。崩れる前に次の床へ逃げながら、最後まで生き残ります。"],',
    "app_fall_description");
  write(path, source);
}
