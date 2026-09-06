import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * 一本道の中で同じ三択が二度出ていないことを検算する。
 *
 * 一期一会は世界の規則である。選ばなかった二つは二度と出てこない、という約束は、
 * **同じ三択を後日もう一度出さない**ことと同じ意味になる。
 * 労働を繰り返すのは構わない（細部が異なる）。だが**選択肢の文言が三つとも同じ画面**が
 * 二度現れたら、それはプレイヤーから見て同じ場面である。
 *
 * 手書きの道は markdown で書かれているので、ここでは本文から三択を抜き出して数える。
 */

const DOCS = path.resolve(import.meta.dirname, "../../../docs/trpg");
const ROUTE_FILES = readdirSync(DOCS)
  .filter((name) => name === "one-road-virtue.md" || name.startsWith("route-"))
  .filter((name) => name.endsWith(".md"))
  .sort();

/** 「**三択**」の直後に並ぶ 1. 2. 3. の行を一組として拾う。 */
export function extractChoiceSets(markdown) {
  const lines = markdown.split("\n");
  const sets = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\*\*三択\*\*/.test(lines[index].trim())) continue;
    const options = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor].trim();
      if (line === "") { if (options.length) break; continue; }
      const match = /^(\d)\.\s*(.+)$/.exec(line);
      if (!match) break;
      options.push(normalise(match[2]));
    }
    if (options.length >= 2) sets.push({ line: index + 1, options });
  }
  return sets;
}

/** 見出しの装飾や所要時間の差では「同じ」と見なさない。文言そのもので比べる。 */
function normalise(text) {
  return text
    .replace(/\*\*/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function signature(options) {
  return [...options].sort((left, right) => left.localeCompare(right, "ja")).join("｜");
}

test("一本道の中で同じ三択が二度出てこない", () => {
  const offences = [];
  for (const file of ROUTE_FILES) {
    const markdown = readFileSync(path.join(DOCS, file), "utf8");
    const seen = new Map();
    for (const set of extractChoiceSets(markdown)) {
      const key = signature(set.options);
      if (seen.has(key)) {
        offences.push(`${file}: ${seen.get(key)}行目と${set.line}行目が同じ三択\n    ${set.options.join("\n    ")}`);
        continue;
      }
      seen.set(key, set.line);
    }
  }
  assert.deepEqual(offences, [], `\n${offences.join("\n\n")}\n`);
});

test("三択はどの道でも実際に三つある", () => {
  const offences = [];
  for (const file of ROUTE_FILES) {
    const markdown = readFileSync(path.join(DOCS, file), "utf8");
    for (const set of extractChoiceSets(markdown)) {
      if (set.options.length !== 3) {
        offences.push(`${file}:${set.line} は ${set.options.length} 択になっている`);
      }
    }
  }
  assert.deepEqual(offences, []);
});

test("検算そのものが空振りしていない", () => {
  const total = ROUTE_FILES.reduce(
    (sum, file) => sum + extractChoiceSets(readFileSync(path.join(DOCS, file), "utf8")).length,
    0,
  );
  assert.ok(total >= 60, `一本道から三択を ${total} 組しか拾えていない。抽出が壊れている可能性がある`);
  console.log(`  一本道 ${ROUTE_FILES.length} 本から三択 ${total} 組を検算した`);
});

/**
 * **ルートをまたいで同じ三択が出ていないことを検算する。**
 *
 * 「全てのルートはユニークである必要がある」というのが世界の規則である。
 * 一本の中で重複していないだけでは足りない。**別々の道が同じ画面を出したら、
 * それは道が一本しかないのと同じである。**
 *
 * 分岐点で同じ部屋に立つこと自体は正しい。**だが、そこで見える三行まで同じにはしない。**
 * 同じ正本の四手を見ても、**そこに立っている男の持ち物が違えば、重さが違う。**
 */
test("ルートをまたいで同じ三択が出てこない", () => {
  const seen = new Map();
  const offences = [];
  for (const file of ROUTE_FILES) {
    const markdown = readFileSync(path.join(DOCS, file), "utf8");
    for (const set of extractChoiceSets(markdown)) {
      const key = signature(set.options);
      const previous = seen.get(key);
      if (previous && previous.file !== file) {
        offences.push(`${previous.file}:${previous.line} と ${file}:${set.line} が同じ三択\n    ${set.options.join("\n    ")}`);
        continue;
      }
      if (!previous) seen.set(key, { file, line: set.line });
    }
  }
  assert.deepEqual(offences, [], `\n${offences.join("\n\n")}\n`);
});

/**
 * 一本道が主張する解決日が、正本の期限を越えていないことを検算する。
 *
 * **道の側が「解決した」と書けば解決になる、というのが一番危ない。**
 * 実際、人徳ルートはT06を解決に数えながら、本文のどこにも閉じた日が無かった
 * （2026-08-14に発見。Day39に節を足して直した）。
 * 期限は正本の値であって、道が決めるものではない。ここで突き合わせる。
 */
const CANON_DEADLINES = Object.freeze({
  T01: [2, 3], T02: [18, 35], T03: [20, 35], T04: [32, 50], T05: [38, 55],
  T06: [45, 56], T07: [48, 60], T08: [58, 60], T09: [32, 45], T10: [44, 70],
  T11: [49, 60], T12: [46, 68], T13: [60, 90], T14: [56, 75], T15: [72, 90],
  T16: [80, 90], T17: [41, 63], T18: [70, 78], T19: [82, 90],
});

test("道が主張する解決日は、正本の最終悪化を越えない", () => {
  const offences = [];
  let checked = 0;
  for (const file of ROUTE_FILES) {
    const markdown = readFileSync(path.join(DOCS, file), "utf8");
    // 台帳には二つの書き方がある。
    //   並び：「T01 Day3／T02 Day35／…」
    //   表　：「| **T01** | Day3 | …」
    // **並びしか読んでいなかったので、表で書いた道は一件も検算していなかった。**
    // （四本目を足した時に件数が36のまま動かず、気づいた。）
    const inline = [...markdown.matchAll(/\bT(\d\d)\s+Day(\d+)(?=\s*[／/|]|\s*。|\s*$)/gm)];
    const tabular = [...markdown.matchAll(/^\|\s*\*{0,2}T(\d\d)\*{0,2}\s*\|\s*\*{0,2}Day(\d+)\*{0,2}\s*\|/gm)];
    for (const [, id, day] of [...inline, ...tabular]) {
      const deadlines = CANON_DEADLINES[`T${id}`];
      if (!deadlines) continue;
      checked += 1;
      if (Number(day) > deadlines[1]) {
        offences.push(`${file}: T${id} を Day${day} に解決と書いているが、最終悪化は Day${deadlines[1]}`);
      }
    }
  }
  assert.ok(checked >= 15, `解決日を ${checked} 件しか拾えていない。抽出が壊れている可能性がある`);
  assert.deepEqual(offences, [], `\n${offences.join("\n")}\n`);
  console.log(`  解決日 ${checked} 件を正本の期限と突き合わせた`);
});
