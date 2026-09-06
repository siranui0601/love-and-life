// Live battle-canon bridge for T13 encounter semantics.
// ENC-0015..0017 are progressive roaming/stage encounters; ENC-0018 is the
// mandatory final event.  Keeping only the final row as `event` makes generic
// mission construction select the actual Day58-60 boss instead of the earliest
// small king-slime stage.

function text(value) {
  return value == null ? "" : String(value).trim();
}

function patchRow(rows, encounterId, values) {
  const headerIndex = rows.findIndex((row) => text(row?.[0]) === "エンカウントID");
  if (headerIndex < 0) throw new Error("地域別エンカウントのヘッダーが見つかりません");
  const headers = rows[headerIndex];
  const idColumn = headers.findIndex((header) => text(header) === "エンカウントID");
  const row = rows.find((candidate, index) => index > headerIndex && text(candidate?.[idColumn]) === encounterId);
  if (!row) throw new Error(`encounter not found: ${encounterId}`);
  for (const [key, value] of Object.entries(values)) {
    const column = headers.findIndex((header) => text(header) === key);
    if (column < 0) throw new Error(`encounter column not found: ${key}`);
    row[column] = value;
  }
}

export function applyCanonicalEncounterExtensions(battleSnapshot) {
  const rows = battleSnapshot?.tabs?.["地域別エンカウント"];
  if (!Array.isArray(rows)) throw new Error("missing 地域別エンカウント tab");
  patchRow(rows, "ENC-0015", {
    回避性: "normal",
    備考: "T13段階遭遇。最終決戦ではなく、発見後に通常遭遇として接触可能",
  });
  patchRow(rows, "ENC-0016", {
    回避性: "normal",
    備考: "T13段階遭遇。最終決戦ではなく、進行中の通常遭遇",
  });
  patchRow(rows, "ENC-0017", {
    回避性: "normal",
    備考: "T13段階遭遇。最終決戦直前の通常遭遇。ENC-0018のみevent",
  });
  return battleSnapshot;
}

export const CANONICAL_ENCOUNTER_EXTENSION_VERSION = "t13-final-event-v2-2026-08-16";
