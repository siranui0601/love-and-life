import { GROUPS, LEADS } from "./t19-blackridge-invasion-evidence-data.js";
import { OPENINGS, FOCUSES, ROUTES } from "./t19-blackridge-invasion-resolution-data.js";
export { T19_CONTINUITY_CONTRACT } from "./t19-blackridge-invasion-contract-data.js";

const freeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
};
const F = freeze;

for (const route of ROUTES) {
  route.contextVariants = [
    { contextId: "t11-t12-t16-failed", troubleConditions: [{ troubleId: "T11", troubleStatuses: ["failed", "critical"] }, { troubleId: "T12", troubleStatuses: ["failed", "critical"] }, { troubleId: "T16", troubleStatuses: ["failed", "critical"] }], minutes: route.minutes + 38, summary: `${route.summary} 王権混乱、偽装襲撃の濡れ衣、亜人狩りが重なっていたため、物証・自治代表・要塞記録から交渉権を再構築した。` },
    { contextId: "t18-capital-force-preserved", flagKey: "t18CapitalMainForcePreserved", minutes: Math.max(78, route.minutes - 18), summary: `${route.summary} T18で王都主力を神殿へ誤派兵せず残せたため、停戦を求めるだけでなく相互撤兵を保証できた。` },
    { contextId: "t12-false-flag-exposed", troubleConditions: [{ troubleId: "T12", troubleStatuses: ["resolved"] }], minutes: Math.max(82, route.minutes - 10), summary: `${route.summary} T12の偽装襲撃が公式に否定され、北陵と黒嶺の双方が開戦口実を撤回できた。` },
    { contextId: "t16-civilians-protected", troubleConditions: [{ troubleId: "T16", troubleStatuses: ["resolved"] }], minutes: Math.max(84, route.minutes - 8), summary: `${route.summary} T16で亜人街と混血住民を守った履歴が、黒嶺側へ王国の内部抵抗を証明した。` },
    { contextId: "t15-foreign-pressure-contained", troubleConditions: [{ troubleId: "T15", troubleStatuses: ["resolved"] }], minutes: Math.max(86, route.minutes - 7), summary: `${route.summary} T15の外国兵・兵器流入が抑えられ、王都が二正面崩壊を恐れて先制攻撃へ傾く圧力を下げられた。` },
  ];
}

export const T19_BLACKRIDGE_INVASION_PACK = F({
  id: "blackridge-forest-breakthrough-invasion",
  missionId: "MSN-T19",
  troubleId: "T19",
  title: "黒嶺連合領の森突破侵攻",
  hearing: { stepId: "hear", npcId: "NPC043", targetLocation: "黒嶺連合領", targetFacilityId: "LOC_BLACKRIDGE_COUNCIL", choices: OPENINGS },
  investigation: {
    stepId: "investigate",
    requiredEvidenceCount: 6,
    requiredEvidenceGroups: GROUPS,
    leads: LEADS,
    focuses: FOCUSES,
    defer: { label: "侵攻調査をいったん保留し、移動・補給・使節の安全を整える", deferMinutes: 75, summary: "調査を保留した。Day70に侵攻判断、Day76に森突破、Day82に王都近郊到達、Day90に王都陥落結果が固定される。" },
    initialGuidance: { kicker: "森の道が開いただけでは戦争にならない。誤認、命令、兵力、兵站、民間保護が同時に絡む", title: "森ルート・脅威認識・命令権・防衛余力・兵站・停戦保証の六分類を確かめる", detail: "黒嶺を倒すだけでも、王都を武装するだけでも、和平を唱えるだけでも全面救済にはならない。" },
    continuedGuidance: { kicker: "一つの証言だけでは、相手側の強硬派が停戦違反として覆せる", title: "未確認の分類を選び、森、黒嶺、王都、北陵へ場面を移す", detail: "六分類を独立して埋め、三つの終戦方針のどれが成立するか絞る。" },
    selectedLeadGuidance: { kicker: "選んだ人物・公文書・現場へ移動する" },
  },
  battle: { stepId: "battle", earlyEncounterId: "ENC-0075", activeEncounterId: "ENC-0074", climaxEncounterId: "ENC-0076", fullActivationDay: 76, capitalOutskirtsDay: 82, irreversibleFailureDay: 90 },
  resolution: { stepId: "resolve", choices: ROUTES },
  catalogOverride: {
    hearing: { required: 1, targetLocation: "黒嶺連合領", targetFacilityId: "LOC_BLACKRIDGE_COUNCIL" },
    investigation: { required: 6, targetLocation: "黒嶺連合領", targetFacilityId: "LOC_BLACKRIDGE_COUNCIL" },
    battle: { required: 1, targetLocation: "黒嶺連合領", targetFacilityId: "LOC_BLACKRIDGE_BARRACKS", encounterId: "ENC-0075", timelineVariants: [{ minDay: 82, encounterId: "ENC-0076", targetLocation: "王都", targetFacilityId: "LOC_CAP_CASTLE" }, { minDay: 76, maxDay: 81, encounterId: "ENC-0074", targetLocation: "森", targetFacilityId: "LOC_FOREST_CAMP" }, { minDay: 63, maxDay: 75, encounterId: "ENC-0075", targetLocation: "黒嶺連合領", targetFacilityId: "LOC_BLACKRIDGE_BARRACKS" }] },
    resolution: { required: 1, targetLocation: "黒嶺連合領", targetFacilityId: "LOC_BLACKRIDGE_COUNCIL" },
  },
  stepGuidance: {
    intervention: { kicker: "Day76より前なら、全軍突破前に命令・偵察・配兵へ非戦闘介入できる", title: "再投票、偵察停止、相互再配置の三入口から選ぶ", detail: "どの入口でも民間保護、命令証拠保全、王都防衛維持を別々に判定する。" },
    battle: { kicker: "Day76以降は前衛が森へ入り、Day82には王都近郊で決戦になる", title: "勝利と、双方の市民保護・命令証拠・防衛回廊を分けて達成する", detail: "敵軍を壊滅させるだけでは、次の報復戦争を止められない。" },
    resolve: { kicker: "三つの解決は、停戦検証・共同防衛・民間休戦のどこへ再発防止を置くかが異なる", title: "相互検証停戦、共同防衛回廊、二層防衛と民間休戦から成立案を選ぶ", detail: "導入と異なる方針へ転換する場合は六分類に加えて七件目の独立裏付けが必要。" },
  },
  branching: { evidenceProfiles: 729, evidenceOrders: 720, openings: 3, interventions: 3, resolutions: 3, deterministicSignatureCombinationsBeforePriorState: 14_171_760 },
});
