import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resolve = (relativePath) => path.join(ROOT, relativePath);

function read(relativePath) {
  return fs.readFileSync(resolve(relativePath), "utf8");
}

function write(relativePath, content) {
  fs.writeFileSync(resolve(relativePath), content);
}

function replaceOnce(relativePath, before, after, label) {
  const source = read(relativePath);
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: source text not found in ${relativePath}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: source text appears more than once in ${relativePath}`);
  }
  write(relativePath, `${source.slice(0, first)}${after}${source.slice(first + before.length)}`);
}

function replacePatternOnce(relativePath, pattern, after, label) {
  const source = read(relativePath);
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`${label}: expected one match in ${relativePath}, found ${matches.length}`);
  write(relativePath, source.replace(pattern, after));
}

const service = "src/server/trpg/game/service.js";
const app = "public/TRPG/app.js";
const narrator = "src/server/trpg/gemini-narrator.js";
const contract = "src/server/trpg/narrative-contract.js";
const index = "public/TRPG/index.html";

replaceOnce(service,
  'const TUTORIAL_VERSION = "trpg-progressive-onboarding-v4";',
  'const TUTORIAL_VERSION = "trpg-progressive-onboarding-v5";',
  "bump tutorial version");

replaceOnce(service,
  '  text: "捜索が間に合わず、フィンは帰らなかった。世界の危機は、旅人を待たずに結末へ進む。",',
  '  text: "捜索は間に合わず、フィンは帰らなかった。村外れへ向かった者にも重傷者が出た。",',
  "rewrite aftermath fact");

replaceOnce(service,
`  if (tutorial.stage === "movement") return {
    ...base,
    id: "first-movement",
    title: "エダについて村へ行こう",
    body: "上の現在地をタップし、「村の広場」へ。",
    progressLabel: "導入 4 / 5",
    actionLabel: "移動先を見る",
    actionPanel: "movement",
    emphasisTarget: "movement",
  };`,
`  if (tutorial.stage === "movement") return {
    ...base,
    id: "first-movement",
    title: "村の広場へ向かおう",
    body: "画面上部の現在地を開き、「村の広場」を選ぶ。",
    progressLabel: "導入 4 / 5",
    actionLabel: "移動先を見る",
    actionPanel: "movement",
    emphasisTarget: "movement",
  };`,
  "focus first movement tutorial on existing control");

replaceOnce(service,
`  if (tutorial.stage === "movement_aftermath") return {
    ...base,
    id: "world-keeps-moving",
    title: "村の広場へ急ごう",
    body: "世界は待っていない。上の現在地から広場へ。",
    progressLabel: "導入 5 / 5",
    actionLabel: "移動先を見る",
    actionPanel: "movement",
    emphasisTarget: "movement",
  };`,
`  if (tutorial.stage === "movement_aftermath") return {
    ...base,
    id: null,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };`,
  "avoid reteaching movement after failure");

replaceOnce(service,
`  if (tutorial.stage === "aftermath_intro") return {
    ...base,
    id: "trouble-aftermath",
    title: "捜索の結末を聞こう",
    body: "広場に残った一人を選び、起きたことを聞く。",
    progressLabel: "導入 5 / 5",
    emphasisTarget: "choices",
  };`,
`  if (tutorial.stage === "aftermath_intro") return {
    ...base,
    id: null,
    title: null,
    body: null,
    progressLabel: null,
    emphasisTarget: null,
  };`,
  "let aftermath scene speak for itself");

replaceOnce(service,
  '    title: "ミッション発見：フィンを捜せ",',
  '    title: "依頼が記録された",',
  "rename mission-log tutorial");
replaceOnce(service,
  '    body: "助けに行く道筋が記録された。開いて次の目的を確認。",',
  '    body: "右上の巻物を開くと、目的と期限をいつでも確認できる。",',
  "rewrite mission-log tutorial copy");

replacePatternOnce(service,
/  const shopAvailable = data\.battleData\.inventory\.some\([\s\S]*?  if \(shopAvailable && !acknowledged\.has\("shop"\)\) return \{[\s\S]*?    emphasisTarget: "shop",\n  \};\n/u,
  "",
  "remove unsolicited shop tutorial");

replaceOnce(service,
  '    title: acknowledged.has("skills") ? "使えるスキルを一つ取得しよう" : "危険へ進む前に、技を覚えよう",',
  '    title: "村外れへ出る前に、技を一つ覚える",',
  "rewrite skill tutorial title");
replaceOnce(service,
`    body: acknowledged.has("skills")
      ? "「今の装備におすすめ」から一つ選ぶ。"
      : "能力を開き、おすすめの技を一つ取得する。",`,
`    body: "右上の能力を開き、「今の装備におすすめ」から一つ選ぶ。",`,
  "rewrite skill tutorial body");
replaceOnce(service,
  '    acknowledgeable: !acknowledged.has("skills"),',
  '    acknowledgeable: false,',
  "make skill lesson action-driven");

replaceOnce(service,
  '    detail: "移動を開き、村の広場へ向かう。世界は行動を選ばない間にも進んでいる。",',
  '    detail: "捜索隊が戻ったらしい。現在地から村の広場へ向かう。",',
  "rewrite aftermath guidance");
replaceOnce(service,
  '      detail: `${mission.title}。${mustMove ? "現在地を開いて目的地へ向かう。" : "中央の3択から進め方を選ぶ。"}`,',
  '      detail: mustMove\n        ? `「${mission.title}」の手掛かりは${targetName ?? "別の場所"}にある。`\n        : `「${mission.title}」を進めるため、${stepLabel}。`,',
  "remove UI language from mission guidance");
replaceOnce(service,
  '    detail: "3択で今いる場所を調べるか、移動で別の土地へ向かい、噂や困り事を見つける。",',
  '    detail: "今いる場所で人に話を聞くか、現在地から別の場所へ向かえる。",',
  "rewrite free guidance");

replaceOnce(service,
  '    active_mission: "今のミッションについて、次に何をすべきか詳しく教えてください。",',
  '    active_mission: "この件について、次に何を確かめるべきか教えてください。",',
  "remove mission term from player speech");
replaceOnce(service,
  '  return "選んだ行動の結果が世界へ刻まれ、時計の針が先へ進んだ。";',
  '  return "ひと通り行動を終える頃には、人の流れと空の色が少し変わっていた。";',
  "rewrite generic fallback narrative");

const dialogueReplacements = [
  [
    "村の広場は、この道の先だよ。今は土地勘もないだろう？　あたしについておいで。歩きながら、道の見方も教えるよ。",
    "村の広場は、この道の先だよ。あたしも戻るところだから、一緒に行こう。人が集まっているなら、事情を知ってる者もいるはずさ。",
    "Eda movement invitation",
  ],
  [
    "世界は待ってはくれん。何が起きたか知りたいなら、隠さず話そう。",
    "……間に合わなかった。捜索の記録は残してある。聞く覚悟があるなら、私が知る限りを話そう。",
    "Garo aftermath arrival",
  ],
  [
    "事情を聞いている間に、捜索の期限を告げる鐘が鳴った。やがて村外れから戻った担架を見て、間に合わなかったことを知る。選んだ行動の途中にも、世界の時間は進んでいた。",
    "事情を聞いている間に、村外れの方角から鐘が鳴った。ほどなく泥だらけの捜索隊が戻り、その後ろに布を掛けた担架が続いた。広場のざわめきが、ひと息で消えた。",
    "deadline narration",
  ],
  [
    "人々の言葉は断片的で、まだ全体が見えない。泣きそうな女性、捜索を指揮する村長、何かを隠すように俯く少年。それぞれが、違う手掛かりを持っていそうだ。",
    "人々の言葉は断片的で、まだ全体が見えない。泣きそうな女性、捜索を指揮する村長、何かを隠すように俯く少年。三人は、互いに違うことを知っているようだ。",
    "mission intro narration",
  ],
  [
    "広場に残る人々は、同じ失敗を違う痛みとして抱えている。誰の言葉を受け取るかは選べるが、起きた結末そのものは巻き戻らない。",
    "ミラは古い地図を握り、コビーは村外れの道を見つめ、ガロは濡れた捜索記録を閉じている。誰も、こちらから声をかけるまでは口を開かなかった。",
    "aftermath intro narration",
  ],
  [
    "あんたは来たばかりだ。無理に背負わなくていい。でも手を貸すなら、村のみんなが忘れないよ。",
    "あんたは来たばかりだ。無理に背負わなくていい。けど村外れへ出るなら、獣の足跡と藪の音には気をつけな。",
    "Eda inquiry support",
  ],
  [
    "私はガロ、この村の村長だ。フィンを見つけた時には、もう息がなかった。助けようと先へ出た者も重傷だ。決断が遅れれば、危機はこうして人の命を奪う。",
    "私はガロ、この村の村長だ。フィンを見つけた時には、もう息がなかった。北の道へ人を回す決断が遅れた。先へ出た者まで重傷を負わせたのは、村長である私の責任だ。",
    "Garo personal responsibility",
  ],
  [
    "私はミラです。あの子は、帰ってきませんでした。……もし次に誰かの助けを求める声を聞いたら、どうか、間に合ううちに動いてください。",
    "私はミラです。あの子は、帰ってきませんでした。朝、地図がないと気づいた時に、もっと強く引き止めていれば……。ごめんなさい。今は、あの子の話をする声さえ出ないんです。",
    "Mira grief",
  ],
  [
    "ぼくはコビー。見張り小屋へ行くって知ってた。もっと早く言えばよかった。時間が過ぎたら、言えなかったことまで消えないんだ。",
    "ぼくはコビー。見張り小屋へ行くって、ぼくは知ってた。怒られるのが怖くて黙ってた。フィンが戻らないって分かってから言っても、もう遅かった。",
    "Coby confession",
  ],
];
for (const [before, after, label] of dialogueReplacements) replaceOnce(service, before, after, label);

replaceOnce(app,
  '  "first-movement": "現在地をタップして、村の広場へ",',
  '  "first-movement": "現在地を開き、「村の広場」を選ぶ",',
  "rewrite movement coach");
replaceOnce(app,
  '  "world-keeps-moving": "現在地をタップして、広場へ戻ろう",\n',
  '',
  "remove repeated movement coach");
replaceOnce(app,
  '  "mission-log": "ミッションをタップして、今の目的を確認",',
  '  "mission-log": "右上の巻物で、目的と期限を確認",',
  "rewrite mission coach");
replaceOnce(app,
  '  skills: "スキルをタップして、戦う技を1つ覚えよう",',
  '  skills: "右上の能力から、技を一つ覚える",',
  "rewrite skill coach");

replaceOnce(narrator,
`24. missionsのcurrentStepProgress/currentStepRequiredとdiscoveriesを参照し、既に発見済みの内容を新発見として繰り返さない。進捗後のchoicesは次の段階に対応する差のある三択にする。`,
`24. missionsのcurrentStepProgress/currentStepRequiredとdiscoveriesを参照し、既に発見済みの内容を新発見として繰り返さない。進捗後のchoicesは次の段階に対応する差のある三択にする。
25. narrativeとspeechesは世界内の描写と発言だけを書く。NPCや地の文に、ミッション、クエスト、選択肢、3択、ボタン、タップ、クリック、画面、UI、メニュー、フラグ、プレイヤー、ゲーム、チュートリアル、SP、HP、MP、レベル、ステータス、ログ、システム、resolver、Gemini等の操作・実装用語を話させない。必要な概念は依頼、技、体力、魔力、経験、記録など世界内の語へ置き換える。操作説明は別のチュートリアルUIが担う。
26. NPCの発言はrole、mood、speechStyle、currentGoal、relationship、knownLocalFactsに従う。NPCを全知の解説役やゲームルールの代弁者にせず、プレイヤーへ教訓を説くための台詞を作らない。責任、恐れ、望み、見聞きした事実を、その人物自身の立場から話させる。`,
  "add diegetic narrative rules");

replaceOnce(contract,
  'export const TRPG_NARRATIVE_PROMPT_VERSION = "trpg-narrative-v4.8";',
  'export const TRPG_NARRATIVE_PROMPT_VERSION = "trpg-narrative-v4.9";',
  "bump narrative prompt version");

replaceOnce(contract,
`const FORBIDDEN_PROPOSAL_KEYS = new Set([
  "exp",
  "experience",
  "gold",
  "level",
  "sp",
  "skill",
  "skills",
  "resolved",
  "status",
  "hp",
  "mp",
  "inventory",
  "equipment",
  "teleport",
  "worldflags",
]);`,
`const FORBIDDEN_PROPOSAL_KEYS = new Set([
  "exp",
  "experience",
  "gold",
  "level",
  "sp",
  "skill",
  "skills",
  "resolved",
  "status",
  "hp",
  "mp",
  "inventory",
  "equipment",
  "teleport",
  "worldflags",
]);

const DIEGETIC_META_PATTERN = /(?:ミッション|クエスト|選択肢|3択|三択|ボタン|タップ|クリック|画面|メニュー|フラグ|プレイヤー|ゲーム|チュートリアル|レベル|ステータス|システム|resolver|Gemini|(?:^|[^A-Za-z])(?:UI|SP|HP|MP)(?:[^A-Za-z]|$)|ログ(?:を|へ|で|に|が|は|一覧|画面))/iu;

function containsDiegeticMetaLanguage(value) {
  return DIEGETIC_META_PATTERN.test(String(value ?? ""));
}`, 
  "add diegetic output guard");

replaceOnce(contract,
`  const narrative = boundedText(value.narrative, 1400);
  if (!narrative) errors.push("narrative is empty");`,
`  const narrative = boundedText(value.narrative, 1400);
  if (!narrative) errors.push("narrative is empty");
  if (containsDiegeticMetaLanguage(narrative)) errors.push("narrative contains non-diegetic game or UI language");`,
  "validate narrative immersion");

replaceOnce(contract,
`    if (!boundedText(speech?.text, 500)) errors.push(\`speeches[\${index}].text is empty\`);`,
`    if (!boundedText(speech?.text, 500)) errors.push(\`speeches[\${index}].text is empty\`);
    if (containsDiegeticMetaLanguage(speech?.text)) errors.push(\`speeches[\${index}].text contains non-diegetic game or UI language\`);`,
  "validate speech immersion");

replaceOnce(contract,
  '? `「${mission.title}」なら、今は「${mission.currentStep || "手掛かりを集める"}」を先に進めるべきだ。期限と行き先を確かめてから動いてくれ。`',
  '? `この件なら、今は「${mission.currentStep || "手掛かりを集める"}」を先に進めるべきだ。期限と行き先を確かめてから動いてくれ。`',
  "rewrite active mission fallback speech");
replaceOnce(contract,
  '      active_mission: `${npc.name}は任務の期限と手掛かりを思い返し、次に急ぐべき行動を整理した。`,',
  '      active_mission: `${npc.name}はこの件の期限と手掛かりを思い返し、次に急ぐべき行動を整理した。`,',
  "rewrite active mission fallback narration");

replaceOnce(index,
  '/TRPG/p0-ux.css?v=20260720-p0-1',
  '/TRPG/p0-ux.css?v=20260720-onboarding-v2',
  "bust p0 css cache");
replaceOnce(index,
  '/TRPG/p0-ux.js?v=20260720-p0-1',
  '/TRPG/p0-ux.js?v=20260720-onboarding-v2',
  "bust p0 script cache");
replaceOnce(index,
  '/TRPG/app.js?v=20260719-agency-v7',
  '/TRPG/app.js?v=20260720-onboarding-v2',
  "bust app cache");

write("tools/trpg-sim/test/trpg-p0-ux-contract.test.mjs", `import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const index = read("public/TRPG/index.html");
const uxScript = read("public/TRPG/p0-ux.js");
const uxStyle = read("public/TRPG/p0-ux.css");

test("P0 observer loads before the main TRPG module", () => {
  const observerPosition = index.indexOf("/TRPG/p0-ux.js");
  const appPosition = index.indexOf("/TRPG/app.js");
  assert.ok(observerPosition >= 0);
  assert.ok(appPosition >= 0);
  assert.ok(observerPosition < appPosition);
  assert.match(index, /id="missionToastRegion"/u);
});

test("onboarding does not create a parallel movement or skill control", () => {
  assert.doesNotThrow(() => new Function(uxScript));
  assert.doesNotMatch(uxScript, /progressionMovementButton/u);
  assert.doesNotMatch(uxScript, /progressionSkillButton/u);
  assert.doesNotMatch(uxScript, /中央の3択を繰り返す/u);
  assert.match(uxScript, /tutorial\?\.id === "skills"/u);
  assert.match(uxScript, /data-p0-tutorial-locked/u);
});

test("mission notices are restrained and do not duplicate the mission tutorial", () => {
  assert.match(uxScript, /save\?\.tutorial\?\.id !== "mission-log"/u);
  assert.match(uxScript, /救出成功/u);
  assert.doesNotMatch(uxScript, /ミッション更新/u);
});

test("mobile battle commands remain fully reachable", () => {
  assert.match(uxStyle, /battle-command-panel:not\(\[hidden\]\)/u);
  assert.match(uxStyle, /max-height: min\(42dvh, 240px\) !important/u);
  assert.match(uxStyle, /battle-command-menu\[data-mode="root"\]/u);
  assert.match(uxStyle, /min-height: 108px/u);
});
`);

write("tools/trpg-sim/test/trpg-onboarding-immersion.test.mjs", `import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const service = read("src/server/trpg/game/service.js");
const narrator = read("src/server/trpg/gemini-narrator.js");
const contract = read("src/server/trpg/narrative-contract.js");
const app = read("public/TRPG/app.js");

test("tutorial teaches movement once through the existing location control", () => {
  assert.match(service, /title: "村の広場へ向かおう"/u);
  assert.match(service, /画面上部の現在地を開き/u);
  assert.doesNotMatch(service, /世界は待っていない。上の現在地から広場へ/u);
  assert.doesNotMatch(app, /"world-keeps-moving"/u);
});

test("opening characters speak from their own stakes instead of explaining the game", () => {
  assert.match(service, /村長である私の責任だ/u);
  assert.match(service, /怒られるのが怖くて黙ってた/u);
  assert.match(service, /今は、あの子の話をする声さえ出ない/u);
  assert.doesNotMatch(service, /決断が遅れれば、危機はこうして人の命を奪う/u);
  assert.doesNotMatch(service, /選んだ行動の途中にも、世界の時間は進んでいた/u);
});

test("Gemini contract rejects game and UI vocabulary in narration and NPC speech", () => {
  assert.match(contract, /trpg-narrative-v4\.9/u);
  assert.match(contract, /DIEGETIC_META_PATTERN/u);
  assert.match(contract, /narrative contains non-diegetic game or UI language/u);
  assert.match(contract, /text contains non-diegetic game or UI language/u);
  assert.match(narrator, /操作説明は別のチュートリアルUIが担う/u);
  assert.match(narrator, /NPCを全知の解説役やゲームルールの代弁者にせず/u);
});
`);

fs.rmSync(resolve("tools/trpg-apply-onboarding-immersion-redesign.mjs"), { force: true });
fs.rmSync(resolve(".github/workflows/trpg-onboarding-immersion-redesign.yml"), { force: true });

console.log("TRPG onboarding and immersion redesign applied.");
