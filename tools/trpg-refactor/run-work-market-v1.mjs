import fs from "node:fs";

const servicePath = "src/server/trpg/game/service.js";
const needle = `    resolvedPlayerAction = action;
    resolvedActionId = action.id;`;
let service = fs.readFileSync(servicePath, "utf8");
const first = service.indexOf(needle);
const second = service.indexOf(needle, first + needle.length);
const third = service.indexOf(needle, second + needle.length);
if (first < 0 || second < 0 || third >= 0) {
  throw new Error(`unexpected_action_assignment_anchors:first=${first}:second=${second}:third=${third}`);
}
service = `${service.slice(0, second)}    resolvedPlayerAction = action;
    resolvedActionId = (action.id); // MOVE uses the same authoritative action object.${service.slice(second + needle.length)}`;
fs.writeFileSync(servicePath, service, "utf8");
await import("./apply-work-market-v1.mjs");
