import fs from "node:fs";

function replaceAllExact(path, before, after, expectedCount, label) {
  const source = fs.readFileSync(path, "utf8");
  const parts = source.split(before);
  const count = parts.length - 1;
  if (count !== expectedCount) throw new Error(`${label}: expected ${expectedCount}, found ${count}`);
  fs.writeFileSync(path, parts.join(after));
}

const app = "public/now-coding/app-v3.js";
const tests = "tools/now-coding/client-contract.test.mjs";

replaceAllExact(app, "slot.textContent='ここへコピー'", "slot.textContent='ペースト'", 1, "paste destination label");
replaceAllExact(app, "${moving?'移動':'コピー'}先を選んでください", "${moving?'移動':'ペースト'}先を選んでください", 1, "placement mode bar wording");
replaceAllExact(app, "のコピー先を選んでください", "のペースト先を選んでください", 1, "workspace copy mode bar wording");
replaceAllExact(app, "toast('コピー先の「ここへコピー」をタップしてください')", "toast('コピーしました。貼り付けたい場所の「ペースト」をタップしてください')", 1, "copy toast wording");
replaceAllExact(tests, "slot\\.textContent='ここへコピー'", "slot\\.textContent='ペースト'", 1, "existing copy label contract");

let testSource = fs.readFileSync(tests, "utf8");
const marker = 'test("copy action transitions to paste wording", () => {';
if (!testSource.includes(marker)) {
  testSource += `\n\ntest("copy action transitions to paste wording", () => {\n  assert.match(app, /copy=tool\\(\"コピー\"/);\n  assert.match(app, /slot\\.textContent='ペースト'/);\n  assert.match(app, /ペースト先を選んでください/);\n  assert.match(app, /コピーしました。貼り付けたい場所の「ペースト」をタップしてください/);\n  assert.doesNotMatch(app, /ここへコピー|コピー先を選んでください/);\n});\n`;
  fs.writeFileSync(tests, testSource);
}

console.log("PR314 paste wording patch applied");
