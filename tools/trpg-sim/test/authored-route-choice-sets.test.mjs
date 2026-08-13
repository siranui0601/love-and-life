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
