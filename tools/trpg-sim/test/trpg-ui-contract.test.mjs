import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const html = fs.readFileSync(path.join(ROOT, "public/TRPG/index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "public/TRPG/style.css"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "public/TRPG/app.js"), "utf8");

test("play UI exposes one visual-novel surface and no legacy scrolling rails", () => {
  const requiredIds = [
    "gameScreen", "sceneBackdrop", "npcStage", "dialogueAdvance", "dialogueSpeaker",
    "dialogueLine", "decisionTray", "choiceRegion", "detailDialog", "battleDialog",
  ];
  requiredIds.forEach((id) => {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, "gu")) ?? []).length, 1, `${id} must exist once`);
  });
  ["mobile-player-hud", "player-rail", "utility-nav", "narrativeText", "lastOutcome"].forEach((legacy) => {
    assert.doesNotMatch(html, new RegExp(legacy, "u"));
  });
  assert.match(css, /\.game-screen\s*\{[^}]*position:\s*fixed[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/su);
  assert.match(css, /body\.is-playing\s*\{[^}]*overflow:\s*hidden/su);
});

test("every direct app id reference exists in the HTML", () => {
  const referencedIds = [...app.matchAll(/\$\("#([A-Za-z][\w-]*)"\)/gu)].map((match) => match[1]);
  [...new Set(referencedIds)].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${id}["']`, "u"), `missing #${id}`);
  });
});

test("dialogue and three-choice tray are mutually exclusive", () => {
  assert.match(app, /scenePlayback\.done[\s\S]*?ui\.dialogue\.hidden\s*=\s*true;[\s\S]*?ui\.decision\.hidden\s*=\s*list\(currentSave\?\.choices\)\.length\s*===\s*0\s*&&\s*currentSave\?\.world\?\.ended\s*!==\s*true;/u);
  assert.match(app, /else\s*\{[\s\S]*?ui\.dialogue\.hidden\s*=\s*false;[\s\S]*?ui\.decision\.hidden\s*=\s*true;/u);
  assert.match(app, /list\(choices\)\.slice\(0,\s*3\)/u);
});

test("a visible choice sends both its slot id and authoritative action id", () => {
  assert.match(app, /button\.dataset\.choiceId = choiceId/u);
  assert.match(app, /button\.dataset\.actionId = choice\.actionId/u);
  assert.match(app, /sendCommand\("CHOOSE", \{[\s\S]*?choiceId: button\.dataset\.choiceId,[\s\S]*?actionId: button\.dataset\.actionId/u);
  assert.match(app, /"choice_action_mismatch"[\s\S]*?誤った行動は実行せず/u);
});

test("an introduction is acknowledged only after its final visible segment", () => {
  assert.match(app, /const introductionToken = escapeText\(beat\.introductionToken \?\? beat\.introduction\?\.token, ""\)/u);
  assert.match(app, /introductionToken:\s*introductionToken && index === segments\.length - 1 \? introductionToken : null/u);
  assert.match(app, /async function advanceDialogue\(\)[\s\S]*?sendCommand\(\s*"ACK_NPC_INTRODUCTION",\s*\{ token: introductionToken \},\s*introductionAckCommandId\(introductionToken\)/u);
  assert.match(app, /if \(!acknowledged \|\| !scenePlayback \|\| scenePlayback\.done\) return;[\s\S]*?scenePlayback\.index \+= 1/u);
  assert.match(app, /return `npc-intro:\$\{stableToken\}`/u);
  assert.match(app, /\["TUTORIAL_ACK", "ACK_NPC_INTRODUCTION"\]\.includes\(type\)[\s\S]*?preserveDialogue/u);
});

test("primary touch controls retain mobile-sized targets", () => {
  assert.match(css, /\.location-button,\s*\n\.tool-button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/su);
  assert.match(css, /\.objective-chip:not\(:disabled\)\s*\{[^}]*min-height:\s*44px;/su);
  assert.match(css, /\.decision-tray \.choice-button\s*\{[^}]*min-height:\s*70px;/su);
  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*?\.decision-tray \.choice-button\s*\{[^}]*min-height:\s*50px;/u);
});

test("keyboard focus survives dialogue, menus, battle, and transient outcomes", () => {
  assert.match(app, /if \(scenePlayback\.done\) window\.requestAnimationFrame\(focusCurrentStoryControl\)/u);
  assert.match(app, /closeQuickMenu\(\{ restoreFocus: true \}\)/u);
  assert.match(app, /battleDialog\.addEventListener\("close"[\s\S]*?focusCurrentStoryControl/u);
  assert.doesNotMatch(app, /ui\.outcome\.focus\(\)/u);
  assert.match(app, /applyTutorialEmphasis\(emphasisTarget\)[\s\S]*?tutorialTarget\.focus\(\)[\s\S]*?else if \(!ui\.decision\.hidden\)/u);
});

test("an empty or completed choice state still exposes a focusable action", () => {
  assert.match(app, /label\.textContent = ended \? "旅の年代記を見る" : "最新の状態を読み込む"/u);
  assert.match(app, /action\.className = "choice-button ending-choice"/u);
  assert.match(css, /\.decision-tray \.empty-message\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/su);
  assert.match(app, /currentSave\?\.world\?\.ended\s*!==\s*true/u);
});

test("screen-reader announcements have a single owner during story playback", () => {
  assert.doesNotMatch(html, /id="dialogueLine"[^>]*aria-live/u);
  assert.doesNotMatch(html, /id="tutorialCard"[^>]*role="status"/u);
  assert.match(html, /id="sceneAnnouncer"[^>]*aria-live="polite"/u);
});

test("modal command errors remain inside the active dialog", () => {
  assert.match(html, /id="dialogError"[^>]*role="alert"/u);
  assert.match(html, /id="battleError"[^>]*role="alert"/u);
  assert.match(app, /const errorTarget = ui\.battleDialog\.open \? ui\.battleError : ui\.dialog\.open \? ui\.dialogError : ui\.gameError/u);
});

test("visible choice text is not line-clamped", () => {
  assert.doesNotMatch(css, /\.decision-tray \.choice-label\s*\{[^}]*-webkit-line-clamp/su);
  assert.match(css, /\.decision-tray\s*\{[^}]*overflow-y:\s*auto/su);
});

test("battle supports authoritative interactive commands and preserves completed playback", () => {
  assert.match(html, /id="battleNext"/u);
  assert.match(html, /id="battleSkip"/u);
  assert.match(html, /id="battleClose"/u);
  assert.match(html, /id="battleCommandPanel"/u);
  assert.match(app, /createBattleCommandButton\("たたかう"/u);
  assert.match(app, /createBattleCommandButton\("スキル"/u);
  assert.match(app, /createBattleCommandButton\("ぼうぎょ"/u);
  assert.match(app, /createBattleCommandButton\("にげる"/u);
  assert.match(app, /sendCommand\("BATTLE_ACT",\s*\{[\s\S]*?battleId:\s*battle\.id,[\s\S]*?actionId:\s*command\.actionId,[\s\S]*?targetInstanceId/u);
  assert.match(app, /battleCommandMenu\.dataset\.mode = "pending"[\s\S]*?battle-command-pending[\s\S]*?const accepted = await sendCommand\("BATTLE_ACT"/u);
  assert.match(app, /if \(!accepted && currentSave\?\.battle\?\.id === battle\.id\)[\s\S]*?renderInteractiveBattleCommands\(currentSave\.battle/u);
  assert.match(app, /save\?\.battle\?\.status === "active"[\s\S]*?renderInteractiveBattle\(save\)/u);
  assert.match(app, /ui\.battleDialog\.dataset\.readyToClose = "false"/u);
  assert.match(app, /frame\.action\?\.kind === "status_failure"[\s\S]*?`\$\{actor\}は動けない！`/u);
  assert.match(app, /function openBattlePlayback/u);
  assert.doesNotMatch(app, /parts\.length === 1 && frame\.action\?\.kind === "status_failure"/u);
  assert.match(css, /\.battle-command-button\s*\{[^}]*min-height:\s*48px/su);
  assert.match(css, /env\(safe-area-inset-bottom\)/u);
  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*?\.battle-dialog\[data-mode="interactive"\] \.battle-message\s*\{[^}]*height:\s*202px;[^}]*max-height:\s*202px;[^}]*overflow:\s*hidden;/u);
  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*?\.battle-command-panel\s*\{[^}]*max-height:\s*118px;/u);
});

test("first-encounter Gemini art refreshes from the persisted manifest without blocking play", () => {
  assert.match(app, /const ASSET_REFRESH_DELAYS = Object\.freeze\(\[2500, 5000, 10000, 20000, 40000, 60000, 60000, 60000, 60000\]\)/u);
  assert.match(app, /fetch\("\/TRPG\/assets\/manifest\.json", \{ cache: "no-store" \}\)/u);
  assert.match(app, /function scheduleAssetRefresh[\s\S]*?loadManifest\(\)[\s\S]*?applyVisibleAssets\(\)/u);
  assert.match(app, /list\(save\.battle\?\.actors\)\.some\(\(actor\) => actor\.side === "enemy" && !monsterUrl\(actor\)\)/u);
  assert.match(app, /queueBattlePresentation\(save\);\s*scheduleAssetRefresh\(save\);/u);
  assert.match(html, /20260719-agency-v7/u);
});

test("manifest portraits are real transparent cutouts", async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "public/TRPG/assets/manifest.json"), "utf8"));
  for (const [npcId, entry] of Object.entries(manifest.portraits)) {
    const url = typeof entry === "string" ? entry : entry.default;
    const file = path.join(ROOT, "public", url.replace(/^\/+/u, ""));
    assert.ok(fs.existsSync(file), `${npcId} portrait must exist`);
    assert.ok(fs.statSync(file).size < 1024 * 1024, `${npcId} portrait must stay below 1 MiB for mobile delivery`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] === 0) transparent += 1;
    const ratio = transparent / (info.width * info.height);
    assert.ok(ratio > 0.12 && ratio < 0.92, `${npcId} transparent ratio ${ratio}`);
    const corners = [
      data[3],
      data[(info.width - 1) * 4 + 3],
      data[((info.height - 1) * info.width) * 4 + 3],
      data[(info.width * info.height - 1) * 4 + 3],
    ];
    assert.deepEqual(corners, [0, 0, 0, 0], `${npcId} corners must be transparent`);
  }
});
