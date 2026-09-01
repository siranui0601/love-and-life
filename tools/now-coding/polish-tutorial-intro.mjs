import fs from "node:fs";

function replaceOne(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, got ${count}`);
  return source.replace(before, after);
}

const appPath = "public/now-coding/app.js";
let app = fs.readFileSync(appPath, "utf8");
app = replaceOne(
  app,
  `    {\n      title: "このゲームで競うこと",\n      text: "Now Codingでは、対戦中に駒を直接操作しません。試合の前に『周囲をどう見て、どんな条件で、どちらへ動くか』をコードとして組みます。開始後、駒はそのコードだけで自律行動します。より良い判断を組めた駒ほど、盤面で有利になります。",\n      button: "実際に作ってみる",\n    },`,
  `    {\n      title: "コードを組んで、1位を目指せ。",\n      text: "Now Codingは、自分でコードを組み、そのコードで自律して動く駒を戦わせ、1位を目指すゲームです。まずは『進む』『曲がる』『周囲を見る』を組み合わせて、最初の駒を作ります。",\n      button: "最初のコードを組む",\n    },`,
  "first tutorial copy",
);
app = replaceOne(
  app,
  `  const item = content[Math.min(step, content.length - 1)];\n  $("#tutorialStepLabel").textContent = \`${"${Math.min(step + 1, 6)}"} / 6\`;`,
  `  const item = content[Math.min(step, content.length - 1)];\n  coach.classList.toggle("is-intro", step === 0);\n  $("#tutorialIntroDemo")?.classList.toggle("is-hidden", step !== 0);\n  $("#tutorialStepLabel").textContent = \`${"${Math.min(step + 1, 6)}"} / 6\`;`,
  "intro visual toggle",
);
app = replaceOne(
  app,
  `function clearOptionalTutorialFocus() {\n  $(".lesson-target").forEach((node) => node.classList.remove("lesson-target"));\n}`,
  `function clearOptionalTutorialFocus() {\n  $$(".lesson-target").forEach((node) => node.classList.remove("lesson-target"));\n}`,
  "optional tutorial focus cleanup",
);
fs.writeFileSync(appPath, app, "utf8");

const htmlPath = "public/now-coding/index.html";
let html = fs.readFileSync(htmlPath, "utf8");
html = replaceOne(
  html,
  `<h1>書いた通りに、駒は動く。</h1>\n          <p>試合前に駒の思考を組み、開始後は手を出さない。周囲を読み、判断し、より良いコードで盤面を攻略する対戦ゲームです。</p>`,
  `<h1>コードを組んで、1位を目指せ。</h1>\n          <p>自分で組んだコードが駒の頭脳になる。駒はその判断だけで自律して戦い、陣取り・生存戦・スプラなど、それぞれのルールで1位を競います。</p>`,
  "home hero copy",
);
html = replaceOne(
  html,
  `<strong id="tutorialTitle">Now Codingへようこそ</strong>\n            <p id="tutorialText"></p>`,
  `<strong id="tutorialTitle">Now Codingへようこそ</strong>\n            <div id="tutorialIntroDemo" class="tutorial-intro-demo" aria-hidden="true">\n              <div class="intro-phase intro-phase-code">\n                <span class="intro-number">1</span><b>CODE</b>\n                <i>もし 前が空き</i><i>進む</i><i>それ以外 → 右へ</i>\n              </div>\n              <span class="intro-flow">→</span>\n              <div class="intro-phase intro-phase-run">\n                <span class="intro-number">2</span><b>RUN</b>\n                <div class="intro-mini-board"><i class="intro-piece"></i></div>\n              </div>\n              <span class="intro-flow">→</span>\n              <div class="intro-phase intro-phase-win">\n                <span class="intro-number">3</span><b>GOAL</b>\n                <em>1位</em><small>より良いコードで勝つ</small>\n              </div>\n            </div>\n            <p id="tutorialText"></p>`,
  "tutorial intro visual",
);
fs.writeFileSync(htmlPath, html, "utf8");

const tutorialPath = "public/now-coding/tutorials.js";
let tutorials = fs.readFileSync(tutorialPath, "utf8");
tutorials = replaceOne(
  tutorials,
  `export const TUTORIALS = [\n  {\n    id: "basics",`,
  `export const TUTORIALS = [\n  {\n    id: "overview",\n    title: "ゲームの遊び方",\n    summary: "コードを組み、駒を自律させ、1位を目指す流れ。",\n    view: "editor",\n    steps: [\n      { title: "コードが駒の頭脳になる", text: "Now Codingは、自分でコードを組み、そのコードで動く駒を戦わせて1位を目指すゲームです。対戦で使う判断そのものを、ここで作ります。", focus: "#programWorkspace" },\n      { title: "駒はコードだけで自律する", text: "対戦が始まると、組んだ命令と条件に従って駒が自分で判断して動きます。テスト盤で、コードと動きの対応を何度でも確認できます。", focus: "#testBoard" },\n      { title: "より良いコードで勝つ", text: "ゲームモードごとに勝ち方は違っても、核は同じです。盤面を読み、条件を組み、より良いアルゴリズムを作って1位を狙います。" },\n    ],\n  },\n  {\n    id: "basics",`,
  "tutorial library overview",
);
fs.writeFileSync(tutorialPath, tutorials, "utf8");

const cssPath = "public/now-coding/style-v2.css";
let css = fs.readFileSync(cssPath, "utf8");
const cssMarker = "/* Tutorial concept intro — show the game loop before asking the player to read it. */";
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.tutorial-intro-demo {\n  display: grid;\n  grid-template-columns: minmax(120px,1fr) auto minmax(110px,.8fr) auto minmax(120px,.9fr);\n  align-items: stretch;\n  gap: 9px;\n  margin: 12px 0 11px;\n}\n.intro-phase {\n  position: relative;\n  min-height: 92px;\n  padding: 25px 10px 10px;\n  overflow: hidden;\n  border: 1px solid rgba(88,230,246,.18);\n  background: linear-gradient(145deg, rgba(7,14,19,.9), rgba(12,22,28,.72));\n}\n.intro-phase > b { display: block; margin-bottom: 7px; color: var(--cyan); font: 800 .64rem ui-monospace, monospace; letter-spacing: .15em; }\n.intro-number { position: absolute; left: 9px; top: 7px; color: rgba(224,246,248,.42); font: 800 .58rem ui-monospace, monospace; }\n.intro-phase-code i {\n  display: block;\n  width: max-content;\n  max-width: 100%;\n  margin: 3px 0;\n  padding: 3px 6px;\n  border-left: 2px solid rgba(88,230,246,.62);\n  background: rgba(88,230,246,.055);\n  color: #dbe9ec;\n  font: normal .61rem ui-monospace, monospace;\n  animation: introCodePulse 2.4s ease-in-out infinite;\n}\n.intro-phase-code i:nth-of-type(2) { animation-delay: .35s; }\n.intro-phase-code i:nth-of-type(3) { animation-delay: .7s; }\n.intro-flow { align-self: center; color: rgba(88,230,246,.72); font-size: 1.15rem; animation: introFlowPulse 1.4s ease-in-out infinite; }\n.intro-mini-board {\n  position: relative;\n  height: 56px;\n  overflow: hidden;\n  border: 1px solid rgba(255,255,255,.075);\n  background-image: linear-gradient(rgba(88,230,246,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(88,230,246,.09) 1px, transparent 1px);\n  background-size: 25% 25%;\n}\n.intro-piece {\n  position: absolute;\n  width: 16px;\n  height: 16px;\n  left: 8%;\n  top: 12%;\n  background: var(--cyan);\n  box-shadow: 0 0 16px rgba(88,230,246,.6);\n  animation: introPieceRun 3.2s cubic-bezier(.35,.05,.25,1) infinite;\n}\n.intro-phase-win { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }\n.intro-phase-win > b { align-self: stretch; text-align: left; }\n.intro-phase-win em { color: #fff3af; font: 900 1.75rem/1 ui-monospace, monospace; font-style: normal; text-shadow: 0 0 22px rgba(255,212,92,.32); animation: introWinner 1.6s ease-in-out infinite alternate; }\n.intro-phase-win small { margin-top: 7px; color: #9fb0b8; font-size: .58rem; }\n@keyframes introCodePulse { 0%,100% { opacity:.55; transform:translateX(0); } 45%,65% { opacity:1; transform:translateX(4px); } }\n@keyframes introFlowPulse { 0%,100% { opacity:.28; transform:translateX(-2px); } 50% { opacity:1; transform:translateX(3px); } }\n@keyframes introPieceRun { 0%,12% { left:8%; top:12%; } 32%,45% { left:62%; top:12%; } 62%,75% { left:62%; top:62%; } 92%,100% { left:8%; top:62%; } }\n@keyframes introWinner { from { transform:scale(.96); opacity:.72; } to { transform:scale(1.05); opacity:1; } }\n@media (max-width: 700px) {\n  .tutorial-coach { grid-template-columns: auto minmax(0,1fr); }\n  .tutorial-next { grid-column: 1 / -1; width: 100%; }\n  .tutorial-intro-demo { grid-template-columns: 1fr; }\n  .intro-flow { justify-self: center; transform: rotate(90deg); }\n  .intro-phase { min-height: 78px; }\n}\n@media (prefers-reduced-motion: reduce) {\n  .intro-phase-code i, .intro-flow, .intro-piece, .intro-phase-win em { animation: none !important; }\n}\n`;
}
fs.writeFileSync(cssPath, css, "utf8");

console.log("Tutorial intro, replay overview, and focus cleanup polished.");
