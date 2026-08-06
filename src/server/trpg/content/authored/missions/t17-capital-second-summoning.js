import {
  T17_EVIDENCE_GROUPS as GROUPS,
  T17_EVIDENCE_LEADS as LEADS,
} from "./t17-second-summoning-evidence.js";

const freeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
};

const ALL_LEAD_IDS = LEADS.map((lead) => lead.id);

const OPENINGS = [
  {
    id: "contact_prevention_cell",
    label: "阻止派の暗号帳から、誰が再召喚を決め、誰を呼ぼうとしているか追う",
    playerUtterance: "危険だという主張だけでは止められない。決定と対象の記録を分けて見せてほしい。",
    requiredDisclosure: "王都はDay1の対象が生存していると知らず、軍事的切り札を得るため同じ識別符を第二儀式へ転記している。",
    factId: "T17-OPENING-PREVENTION-CELL",
    unlockedLeadIds: ALL_LEAD_IDS,
    preferredFocusId: "authority_and_identity",
  },
  {
    id: "audit_ritual_geometry",
    label: "廃触媒と訂正術式から、門が閉じない技術的欠陥と停止手順を追う",
    playerUtterance: "賛成か反対かではなく、どこで破綻し、どう閉じられるのかを確かめる。",
    requiredDisclosure: "第二術式は到達しなかった対象を強引に引くため出力を増幅し、門を閉じる位相が不足している。",
    factId: "T17-OPENING-RITUAL-AUDIT",
    unlockedLeadIds: ALL_LEAD_IDS,
    preferredFocusId: "ritual_and_safe_stop",
  },
  {
    id: "separate_temple_causes",
    label: "神殿の発光記録から、召喚災害と巨神兵封印劣化を別々に証明する",
    playerUtterance: "神殿で起きることを全部召喚のせいにせず、原因ごとに時系列を分けたい。",
    requiredDisclosure: "転移装置はDay1召喚波で半起動したが、巨神兵封印の劣化はそれ以前から世界樹系統で進んでいる。",
    factId: "T17-OPENING-TEMPLE-SEPARATION",
    unlockedLeadIds: ALL_LEAD_IDS,
    preferredFocusId: "temple_links_and_separation",
  },
];

const FOCUSES = [
  {
    id: "authority_and_identity",
    label: "強行を決めた権限と、呼ばれるはずだった対象の正体を分けて追う",
    minutes: 3,
    narrative: "政治責任だけを暴いても術式は止まらず、対象の正体だけを示しても強行派は代替対象を探す。決定と召喚対象を別々に固定する。",
    sceneTransition: "阻止派の暗号帳から、王城の勅許庫とDay1対象記録へ場面が分かれる",
    groups: [
      { id: "political_authorization", label: "勅許・軍議・特別会計から強行決定を確定する", evidenceGroupIndex: 0 },
      { id: "day1_target_identity", label: "阻止派記録・逆算座標・登録簿からプレイヤーの正体を確定する", evidenceGroupIndex: 2 },
    ],
  },
  {
    id: "ritual_and_safe_stop",
    label: "術式の破綻と、人を巻き込まない停止手順を分けて組み立てる",
    minutes: 3,
    narrative: "欠陥を示すだけでは危険な破壊工作になり、停止道具だけでは誤った順序で亀裂を広げる。破綻の仕組みと安全停止を別々に確かめる。",
    sceneTransition: "魔術塔の試算卓から、廃触媒、下層井戸、地下隔壁、黒嶺接地石へ視点が移る",
    groups: [
      { id: "ritual_instability", label: "術式訂正・触媒・地下共鳴から門が閉じない理由を確定する", evidenceGroupIndex: 1 },
      { id: "safe_shutdown", label: "位相反転・避難隔壁・接地石から安全停止手順を確定する", evidenceGroupIndex: 5 },
    ],
  },
  {
    id: "temple_links_and_separation",
    label: "古代神殿へ流れる召喚波と、巨神兵の別原因を分けて証明する",
    minutes: 3,
    narrative: "神殿異常を一括して召喚災害と扱えばT18への対応を誤る。転移装置への接続と、世界樹系封印の劣化を別々に追う。",
    sceneTransition: "王都の地下図から、白石回廊と巨神兵格納区の二つの古代層へ場面が分かれる",
    groups: [
      { id: "t04_transfer_link", label: "運転簿・回廊・共鳴板からT04転移装置との接続を確定する", evidenceGroupIndex: 3 },
      { id: "t18_cause_separation", label: "封印年輪・旧保守台帳・周波数差からT18の別原因を確定する", evidenceGroupIndex: 4 },
    ],
  },
];

const ROUTE_SUPPORT = [
  GROUPS.map((group) => group[0]),
  GROUPS.map((group) => group[1]),
  GROUPS.map((group) => group[2]),
];
const COMMON_CORE_GROUPS = GROUPS.map((group) => [...group]);

const ROUTES = [
  {
    id: "royal_public_suspension_and_living_witness",
    label: "王の公開停止勅令と、生存するDay1召喚対象の証言で第二儀式を撤回する",
    minutes: 84,
    sceneTransition: "王城の謁見卓から魔術塔の停止命令、下層広場での生存確認、封印された勅許庫へ場面が連続する",
    narrative: "強行決定の記録、術式欠陥、Day1対象の生存、神殿への波及、巨神兵との原因差、安全停止手順を同じ公開審理へ置いた。王は失敗を隠す代わりに第二勅許を撤回し、対象本人の意思を召喚政策の前提へ加えた。",
    summary: "第二召喚は公開勅令で停止され、プレイヤーがDay1に王都へ呼ばれるはずだった存在だと公式記録へ残った。",
    readiness: {
      openingChoiceIds: ["contact_prevention_cell"],
      openingSupport: 1,
      minimumSupport: 5,
      supportingEvidenceIds: ROUTE_SUPPORT[0],
      requiredEvidenceGroups: COMMON_CORE_GROUPS,
      preparationLabel: "公開停止勅令と生存証明を成立させる証拠を補う",
      preparationMinutes: 8,
      preparationSummary: "王の決定、対象の同一性、神殿波及、安全停止を公開審理で崩れない形へまとめる。",
    },
    worldEffect: {
      flagKey: "t17RoyalPublicSuspension",
      factId: "T17-RESOLUTION-ROYAL-PUBLIC-SUSPENSION",
      text: "王都は第二召喚勅許を公開撤回し、Day1の召喚対象が生存している事実と、本人同意なしの再召喚を禁じる条項を記録した。",
      facilityId: "LOC_CAP_CASTLE",
      propagationDelayHours: 1,
      aftermathPlans: [
        { id: "t17-public-summoning-review", npcIds: ["NPC016", "NPC018", "NPC056"], goal: "召喚記録の公開審査と対象本人の同意条項を維持する" },
      ],
    },
  },
  {
    id: "seraphim_phase_reversal_and_joint_custody",
    label: "セラフィムと位相反転を実施し、術式資料を王城・阻止派・神殿の共同管理へ移す",
    minutes: 88,
    sceneTransition: "魔術塔の外円停止から地下隔壁、神殿共鳴板の沈静、三者が鍵を分けて保管する場面へ移る",
    narrative: "術式の欠陥を技術者本人へ突きつけ、破壊ではなく位相反転で門を閉じた。Day1対象記録と神殿接続記録は消さず、王城、阻止派、神殿管理側が別々の鍵を持つ共同管理へ移した。",
    summary: "第二召喚は位相反転で安全停止し、危険な術式資料は単独で再使用できない三者共同管理になった。",
    readiness: {
      openingChoiceIds: ["audit_ritual_geometry"],
      openingSupport: 1,
      minimumSupport: 5,
      supportingEvidenceIds: ROUTE_SUPPORT[1],
      requiredEvidenceGroups: COMMON_CORE_GROUPS,
      preparationLabel: "位相反転と共同管理を成立させる証拠を補う",
      preparationMinutes: 9,
      preparationSummary: "術式破綻、反転順序、避難、記録保全、神殿切離しを技術手順へ落とし込む。",
    },
    worldEffect: {
      flagKey: "t17JointRitualCustody",
      factId: "T17-RESOLUTION-JOINT-RITUAL-CUSTODY",
      text: "宮廷魔術塔の第二術式は位相反転で閉じられ、術式図、Day1対象簿、反転鍵は王城・阻止派・神殿の三者へ分割保管された。",
      facilityId: "LOC_CAP_MAGE_TOWER",
      propagationDelayHours: 1.5,
      aftermathPlans: [
        { id: "t17-seraphim-joint-custody", npcIds: ["NPC017", "NPC018", "NPC056"], goal: "術式資料と反転鍵の三者共同管理を続ける" },
      ],
    },
  },
  {
    id: "temple_decoupling_and_cross_border_grounding",
    label: "神殿転移装置を召喚式から切り離し、黒嶺接地石で余剰魔力を逃がす",
    minutes: 93,
    sceneTransition: "古代神殿の共鳴板から王都地下の召喚円、黒嶺門の接地石、巨神兵格納区に残る独立警告へ場面が転換する",
    narrative: "T04の転移装置接続とT18の封印劣化を混同せず、王都の召喚線だけを神殿から切り離した。余剰魔力は黒嶺の接地石へ逃がし、巨神兵への別対応と王都地下の亀裂封鎖を同時に残した。",
    summary: "第二召喚は神殿から切り離され、余剰魔力は共同監視下で接地された。T18を召喚災害と誤認する経路も閉じた。",
    readiness: {
      openingChoiceIds: ["separate_temple_causes"],
      openingSupport: 1,
      minimumSupport: 5,
      supportingEvidenceIds: ROUTE_SUPPORT[2],
      requiredEvidenceGroups: COMMON_CORE_GROUPS,
      preparationLabel: "神殿切離しと越境接地を成立させる証拠を補う",
      preparationMinutes: 10,
      preparationSummary: "転移装置接続、巨神兵別原因、接地石、共同監視を一つの停止手順へつなぐ。",
    },
    worldEffect: {
      flagKey: "t17TempleDecoupled",
      factId: "T17-RESOLUTION-TEMPLE-DECOUPLING",
      text: "王都の第二召喚線は古代神殿から切り離され、余剰魔力は黒嶺との共同監視で岩盤へ接地された。巨神兵封印は別原因として監視が継続された。",
      facilityId: "LOC_TEMPLE_ADMIN",
      propagationDelayHours: 2,
      aftermathPlans: [
        { id: "t17-temple-blackridge-monitoring", npcIds: ["NPC046", "NPC056", "NPC017"], goal: "神殿切離しと巨神兵別監視をT18まで維持する" },
      ],
    },
  },
];

for (const route of ROUTES) {
  route.contextVariants = [
    {
      contextId: "t04-failed-and-t11-regency",
      troubleConditions: [
        { troubleId: "T04", troubleStatuses: ["failed", "critical"] },
        { troubleId: "T11", troubleStatuses: ["failed", "critical"] },
      ],
      minutes: route.minutes + 24,
      summary: `${route.summary} 神殿封鎖と王都政変が同時に残り、勅許原本も転移装置記録も使えないため、筆記官写し・下層証言・神殿物証を別々に復元した。`,
    },
    {
      contextId: "t04-resolved-but-t13-seal-collapse",
      troubleConditions: [
        { troubleId: "T04", troubleStatuses: ["resolved"] },
        { troubleId: "T13", troubleStatuses: ["failed", "critical"] },
      ],
      minutes: route.minutes + 4,
      summary: `${route.summary} T04の公開記録は使えたが、T13で世界樹系封印が損傷していたため、召喚停止班とT18監視班を分離して同時運用した。`,
    },
    {
      contextId: "t16-network-and-t04-open-records",
      flagKey: "t16ResolutionRoute",
      troubleConditions: [{ troubleId: "T04", troubleStatuses: ["resolved"] }],
      minutes: Math.max(58, route.minutes - 14),
      summary: `${route.summary} T04の運転記録とT16で残った下層・黒嶺連絡網が揃い、避難、共同監視、公開証言を一つの時刻表で動かせた。`,
    },
    {
      contextId: "t04-resolved-records-open",
      troubleConditions: [{ troubleId: "T04", troubleStatuses: ["resolved"] }],
      minutes: Math.max(60, route.minutes - 10),
      summary: `${route.summary} T04で転移装置の運転簿と救出記録が公開されていたため、神殿接続の証明が早まった。`,
    },
    {
      contextId: "t04-failed-sealed-temple",
      troubleConditions: [{ troubleId: "T04", troubleStatuses: ["failed", "critical"] }],
      minutes: route.minutes + 14,
      summary: `${route.summary} T04失敗で神殿が封鎖され、王国が隠した記録を物証から復元する追加作業が必要だった。`,
    },
    {
      contextId: "t11-regency-or-martial-law",
      troubleConditions: [{ troubleId: "T11", troubleStatuses: ["failed", "critical"] }],
      minutes: route.minutes + 16,
      summary: `${route.summary} T11後の政変と戒厳令で王の単独決定が使えず、軍議・魔術塔・下層代表の合議を追加した。`,
    },
    {
      contextId: "t13-seal-collapse-risk",
      troubleConditions: [{ troubleId: "T13", troubleStatuses: ["failed", "critical"] }],
      minutes: route.minutes + 12,
      summary: `${route.summary} T13による世界樹系封印の損傷が進んでいたため、T18監視と召喚停止を別班で同時に行った。`,
    },
    {
      contextId: "t16-protection-network",
      flagKey: "t16ResolutionRoute",
      minutes: Math.max(64, route.minutes - 6),
      summary: `${route.summary} T16で王都下層と黒嶺の連絡路が残っていたため、避難・共同監視・公開証言が短縮された。`,
    },
  ];
}

export const T17_CAPITAL_SECOND_SUMMONING_PACK = freeze({
  id: "capital-second-summoning",
  missionId: "MSN-T17",
  troubleId: "T17",
  title: "王都の第二召喚儀式",
  hearing: {
    stepId: "hear",
    npcId: "NPC018",
    targetLocation: "王都",
    targetFacilityId: "LOC_CAP_LOWER_INN",
    choices: OPENINGS,
  },
  investigation: {
    stepId: "investigate",
    requiredEvidenceCount: 6,
    requiredEvidenceGroups: GROUPS,
    leads: LEADS,
    focuses: FOCUSES,
    defer: {
      id: "defer-t17",
      label: "第二召喚の調査をいったん保留し、移動・休息・協力者の安全を整える",
      minutes: 5,
      deferMinutes: 120,
      summary: "第二召喚への介入をいったん保留した。Day22以降は準備が本格化し、Day41には儀式が強行される。",
    },
    initialGuidance: {
      kicker: "再召喚の是非だけでなく、権限・術式・対象・神殿・巨神兵・停止手順が別々に動いている",
      title: "六つの事実分類を、人物・公文書・現場記録の三経路から確かめる",
      detail: "王を説得するだけでも、術式を壊すだけでも、神殿を封鎖するだけでも安全停止にはならない。",
    },
    continuedGuidance: {
      kicker: "一つの真相を掴んでも、別の失敗経路は残る",
      title: "未確認の事実分類を選び、王城・魔術塔・下層・古代神殿・黒嶺へ場面を移す",
      detail: "強行決定、術式欠陥、Day1対象、T04接続、T18別原因、安全停止の六分類を独立して埋める。",
    },
    selectedLeadGuidance: {
      kicker: "選んだ記録・人物・現場へ移動する",
    },
  },
  battle: {
    stepId: "battle",
    encounterId: "ENC-0028",
    preRitualDeadlineDay: 41,
  },
  resolution: { stepId: "resolve", choices: ROUTES },
  catalogOverride: {
    hearing: {
      required: 1,
      targetLocation: "王都",
      targetFacilityId: "LOC_CAP_LOWER_INN",
    },
    investigation: {
      required: 6,
      targetLocation: "王都",
      targetFacilityId: "LOC_CAP_MAGE_TOWER",
    },
    battle: {
      required: 1,
      targetLocation: "王都",
      targetFacilityId: "LOC_CAP_MAGE_TOWER",
      encounterId: "ENC-0028",
    },
    resolution: {
      required: 1,
      targetLocation: "王都",
      targetFacilityId: "LOC_CAP_CASTLE",
    },
  },
  postInvestigationGuidance: {
    kicker: "証拠が揃っても、儀式をどう止め、何を残すかで後続世界が変わる",
    title: "公開停止、位相反転共同管理、神殿切離しと越境接地の三方針を比較する",
    detail: "成立しない案を選んだ場合は解決扱いにせず、欠けた核心証拠へ戻る。",
  },
  stepGuidance: {
    intervention: {
      kicker: "Day41より前なら、戦闘を起こさず儀式の実行条件を外せる",
      title: "外円凍結、位相反転準備、神殿切離しのどこから安全停止へ入るか選ぶ",
      detail: "どの入口でも、避難・Day1記録保全・T18誤認防止を別々に判定する。",
    },
    battle: {
      kicker: "Day41以降は空殻の勇者と召喚亀裂が実体化している",
      title: "勝利と、避難・記録保全・巨神兵防衛線維持を分けて達成する",
      detail: "空殻を倒すだけでは、第二召喚の責任もT18との原因分離も残らない。",
    },
    resolve: {
      kicker: "三つの解決は、王権・研究管理・神殿外交のどこへ再発防止を置くかが異なる",
      title: "公開停止、共同管理、神殿切離しのうち、集めた証拠で成立する方針を選ぶ",
      detail: "最初の導入と異なる方針へ転換する場合、六分類に加えて七件目の独立裏付けが必要になる。",
    },
  },
  branching: {
    evidenceProfiles: 729,
    evidenceOrders: 720,
    openings: 3,
    interventions: 3,
    resolutions: 3,
    deterministicSignatureCombinationsBeforePriorState: 14_171_760,
  },
});
