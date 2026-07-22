import fs from "node:fs";

const needsPath = "tools/trpg-sim/lib/player-needs.mjs";
const selfPath = "tools/trpg-refactor/fix-player-needs-direct-object.mjs";
const source = fs.readFileSync(needsPath, "utf8");
const needle = `export function ensurePlayerNeeds(playerOrNeeds) {
  const owner = playerOrNeeds && typeof playerOrNeeds === "object" && Object.hasOwn(playerOrNeeds, "needs")
    ? playerOrNeeds
    : null;
  const source = owner ? owner.needs : playerOrNeeds;
  const migrated = createPlayerNeeds(source ?? {});
  if (owner) owner.needs = migrated;
  return migrated;
}`;
const replacement = `export function ensurePlayerNeeds(playerOrNeeds) {
  const owner = playerOrNeeds && typeof playerOrNeeds === "object" && Object.hasOwn(playerOrNeeds, "needs")
    ? playerOrNeeds
    : null;
  const source = owner ? owner.needs : playerOrNeeds;
  const migrated = createPlayerNeeds(source ?? {});
  if (owner) {
    owner.needs = migrated;
    return owner.needs;
  }
  if (playerOrNeeds && typeof playerOrNeeds === "object") {
    Object.assign(playerOrNeeds, migrated);
    return playerOrNeeds;
  }
  return migrated;
}`;
const first = source.indexOf(needle);
if (first < 0) throw new Error("Missing direct needs mutation anchor");
if (source.indexOf(needle, first + needle.length) >= 0) throw new Error("Ambiguous direct needs mutation anchor");
fs.writeFileSync(needsPath, source.slice(0, first) + replacement + source.slice(first + needle.length));
fs.rmSync(selfPath, { force: true });
