import fs from "node:fs";

const servicePath = "src/server/trpg/game/service.js";
const appPath = "public/TRPG/app.js";
const stylePath = "public/TRPG/style.css";
const workflowPath = ".github/workflows/apply-trpg-direct-npc-talk.yml";
const scriptPath = "tools/trpg-refactor/apply-direct-npc-talk.mjs";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`Missing integration anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`Ambiguous integration anchor: ${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

let service = fs.readFileSync(servicePath, "utf8");
service = replaceOnce(
  service,
  'const COMMAND_TYPES = new Set(["CHOOSE", "MOVE", "SHOP_BUY", "SHOP_SELL", "EQUIP", "UNEQUIP", "LEARN_SKILL", "TUTORIAL_ACK", "ACK_NPC_INTRODUCTION", "BATTLE_ACT"]);',
  'const COMMAND_TYPES = new Set(["CHOOSE", "TALK", "MOVE", "SHOP_BUY", "SHOP_SELL", "EQUIP", "UNEQUIP", "LEARN_SKILL", "TUTORIAL_ACK", "ACK_NPC_INTRODUCTION", "BATTLE_ACT"]);',
  "TALK command type",
);
service = replaceOnce(
  service,
  '  CHOOSE: "choiceId",\n  MOVE: "moveId",',
  '  CHOOSE: "choiceId",\n  TALK: "npcId",\n  MOVE: "moveId",',
  "TALK command payload",
);
service = replaceOnce(
  service,
  'function choiceActionPool(runtime, data, { limit = 9 } = {}) {',
  `function directNpcConversationActions(runtime, data) {\n  if (runtime.pendingBattle?.session?.status === "active") return [];\n  if (runtime.playerState.absoluteMinute >= journey.GAME_END_MINUTE) return [];\n  if (runtime.tutorial && runtime.tutorial.stage !== "free") return [];\n  syncAuthoritativePresentNpcIds(runtime, data);\n  return presentNpcsAt(runtime, data)\n    .sort((left, right) => left.id.localeCompare(right.id))\n    .map((npc) => ({\n      id: \`DIRECT_TALK:\${npc.id}\`,\n      type: "conversation",\n      directTalk: true,\n      targetNpcId: npc.id,\n      targetNpcName: npc.name,\n      dialogueTopic: "direct_contact",\n      minutes: 5,\n      label: \`\${npc.name}に話しかける\`,\n    }));\n}\n\nfunction choiceActionPool(runtime, data, { limit = 9 } = {}) {`,
  "direct NPC conversation actions",
);
service = replaceOnce(
  service,
  `  if (command.type === "CHOOSE") {\n    const choices = choiceActions(runtime, data);\n    const action = choices.find((entry) => entry.choiceId === payload.choiceId);\n    if (!action) throw new TrpgGameError(400, "choice_not_available");\n    if (payload.actionId && payload.actionId !== action.id) {\n      throw new TrpgGameError(409, "choice_action_mismatch", "The displayed choice no longer resolves to the same action", {\n        choiceId: payload.choiceId,\n        displayedActionId: payload.actionId,\n        currentActionId: action.id,\n      });\n    }`,
  `  if (["CHOOSE", "TALK"].includes(command.type)) {\n    const choices = command.type === "TALK"\n      ? directNpcConversationActions(runtime, data)\n      : choiceActions(runtime, data);\n    const action = command.type === "TALK"\n      ? choices.find((entry) => entry.targetNpcId === payload.npcId)\n      : choices.find((entry) => entry.choiceId === payload.choiceId);\n    if (!action) {\n      throw new TrpgGameError(400, command.type === "TALK" ? "npc_talk_not_available" : "choice_not_available");\n    }\n    if (command.type === "CHOOSE" && payload.actionId && payload.actionId !== action.id) {\n      throw new TrpgGameError(409, "choice_action_mismatch", "The displayed choice no longer resolves to the same action", {\n        choiceId: payload.choiceId,\n        displayedActionId: payload.actionId,\n        currentActionId: action.id,\n      });\n    }`,
  "TALK execution path",
);
service = replaceOnce(
  service,
  `  const presentNpcs = presentNpcsAt(runtime, data);\n  const choices = presentationChoices(record, choiceActions(runtime, data));`,
  `  const directTalkNpcIds = new Set(directNpcConversationActions(runtime, data).map((action) => action.targetNpcId));\n  const presentNpcs = presentNpcsAt(runtime, data).map((npc) => ({\n    ...npc,\n    directTalkAvailable: directTalkNpcIds.has(npc.id),\n  }));\n  const choices = presentationChoices(record, choiceActions(runtime, data));`,
  "direct talk availability in game view",
);
fs.writeFileSync(servicePath, service);

let app = fs.readFileSync(appPath, "utf8");
app = replaceOnce(
  app,
  `    card.className = \`npc-card\${npc.id === visibleActorId ? " is-active" : ""}\`;\n    card.dataset.npcId = npc.id;\n    card.style.setProperty("--npc-index", index);`,
  `    const canTalk = npc.directTalkAvailable === true;\n    card.className = \`npc-card\${npc.id === visibleActorId ? " is-active" : ""}\${canTalk ? " is-talkable" : ""}\`;\n    card.dataset.npcId = npc.id;\n    card.style.setProperty("--npc-index", index);\n    if (canTalk) {\n      const talk = () => {\n        if (busy || (scenePlayback && !scenePlayback.done)) return;\n        sendCommand("TALK", { npcId: npc.id });\n      };\n      card.tabIndex = 0;\n      card.setAttribute("role", "button");\n      card.setAttribute("aria-label", \`\${escapeText(npc.name, "人物")}に話しかける\`);\n      card.title = \`\${escapeText(npc.name, "人物")}に話しかける\`;\n      card.addEventListener("click", talk);\n      card.addEventListener("keydown", (event) => {\n        if (event.key !== "Enter" && event.key !== " ") return;\n        event.preventDefault();\n        talk();\n      });\n    }`,
  "clickable NPC portrait",
);
fs.writeFileSync(appPath, app);

let style = fs.readFileSync(stylePath, "utf8");
style = replaceOnce(
  style,
  '.game-screen .npc-card.is-active { z-index: 2; opacity: 1; transform: none; filter: none; }',
  `.game-screen .npc-card.is-active { z-index: 2; opacity: 1; transform: none; filter: none; }\n.game-screen .npc-card.is-talkable { pointer-events: auto; cursor: pointer; }\n.game-screen .npc-card.is-talkable:hover,\n.game-screen .npc-card.is-talkable:focus-visible { z-index: 3; opacity: 1; transform: translateY(-1.5%); filter: none; outline: 2px solid rgba(240, 202, 124, .9); outline-offset: -2px; }`,
  "talkable NPC styles",
);
fs.writeFileSync(stylePath, style);

fs.rmSync(workflowPath, { force: true });
fs.rmSync(scriptPath, { force: true });
