const freeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
};

const GROUPS = [
  [
    "T16-EVIDENCE-SAMIRA-MARKED-HOUSEHOLDS",
    "T16-EVIDENCE-ORPHANAGE-MIXED-CHILD-SHELTER",
    "T16-EVIDENCE-HEALER-INJURY-MAP",
  ],
  [
    "T16-EVIDENCE-KIRI-SAFE-ALLEY-ROUTE",
    "T16-EVIDENCE-SLAVE-MARKET-BUYER-ORDER",
    "T16-EVIDENCE-GATE-WAGON-REASSIGNMENT",
  ],
  [
    "T16-EVIDENCE-PETRA-PAID-HEADLINE-LEDGER",
    "T16-EVIDENCE-LEONARDO-SALON-DISBURSEMENT",
    "T16-EVIDENCE-REUSED-PRINTING-PLATES",
  ],
  [
    "T16-EVIDENCE-RASH-RESTRICTION-DRAFTS",
    "T16-EVIDENCE-VICTOR-ALTERED-PATROL-ORDER",
    "T16-EVIDENCE-PASS-REVOCATION-REGISTER",
  ],
  [
    "T16-EVIDENCE-ORKA-COURIER-ROUTE",
    "T16-EVIDENCE-ZAID-COUNCIL-ABSENCE-MINUTES",
    "T16-EVIDENCE-BORDER-SIGNAL-TIMING",
  ],
  [
    "T16-EVIDENCE-MARKED-DOOR-CHALK-ROSTER",
    "T16-EVIDENCE-HUNTER-BOUNTY-PAYOUTS",
    "T16-EVIDENCE-WEAPON-HANDOFF-ROUTE",
  ],
];

const LEAD_ROWS = [
  ["samira_marked_households", "王都", "LOC_CAP_AJIN_QUARTER", "亜人街・保護名簿控え", "サミラの相談記録と戸口の印を照合し、狙われた世帯を特定する", GROUPS[0][0], "暴徒が無差別に動いたのではなく、混血の子ども、黒嶺出身者、治療師の家へ先に印が付けられていた。", 38, "戸口の印だけで判断せず、相談日、家族構成、負傷時刻を重ね、保護対象を先に確定する。", "NPC026"],
  ["orphanage_mixed_child_shelter", "王都", "LOC_CAP_ORPHANAGE", "白鈴孤児院・臨時避難室", "孤児院の受入控えから、散り散りになった混血児と保護者をつなぐ", GROUPS[0][1], "立ち退き後に住所を失った子どもほど標的名簿へ早く載り、孤児院の古い寄付者名簿が唯一の照合鍵になっていた。", 42, "子どもの証言を無理に引き出さず、食事札、寝床割、迎え人の筆跡から安全な再会先を探す。", "NPC072"],
  ["healer_injury_map", "王都", "LOC_CAP_AJIN_QUARTER", "亜人街・共同治療所", "治療記録を地図へ戻し、暴力が集中した路地と時間帯を割り出す", GROUPS[0][2], "負傷は市場の偶発衝突ではなく、衛兵交代直後の三路地へ集中し、耳や角を隠せない住民が優先的に襲われていた。", 40, "傷の数ではなく、発生地点、武器種、治療時刻を同じ地図へ置き、次の襲撃地点を予測する。", null],

  ["kiri_safe_alley_route", "王都", "LOC_CAP_LOWER_INN", "王都下層・裏路地案内卓", "キリの通行記録から、検問を避ける避難路と売られた抜け道を分ける", GROUPS[1][0], "安全とされた二本の路地のうち一方だけが人買いへ売られ、もう一方は井戸番と宿主の合図で夜明けまで通れた。", 39, "噂だけで人を流さず、見張り交代、扉の合図、行き止まりを実際に歩いて確かめる。", "NPC025"],
  ["slave_market_buyer_order", "犯罪都市", "LOC_CRIME_SLAVE_MARKET", "人買い市場・買付注文庫", "逃亡者の特徴を書いた買付票から、暴動と誘拐商売の接続を確定する", GROUPS[1][1], "王都で印を付けられた耳、角、混血の年齢が買付票と一致し、暴動の混乱そのものが商品集めに利用されていた。", 52, "市場の品書きだけでなく、王都で付けられた印、運搬日、受取人の符号をつなぐ。", "NPC033"],
  ["gate_wagon_reassignment", "王都", "LOC_CAP_LOWER_INN", "王都門・荷車割当控え", "避難用の荷車が狩人組織へ回された時刻と命令系統を追う", GROUPS[1][2], "病人搬送用の荷車三台が私印命令で外され、夜間の拘束者輸送へ転用されていた。", 43, "御者の記憶に頼らず、車輪番号、通行札、餌の支給先から荷車の行先を復元する。", "NPC024"],

  ["petra_paid_headline_ledger", "王都", "LOC_CAP_NEWSPAPER", "瓦版屋通り・広告入金帳", "ペトラの見出し案と入金帳を重ね、扇動記事の発注者を特定する", GROUPS[2][0], "『黒嶺の潜入者』という見出しは事件前に三版分発注され、支払人はレオナルド公の会計係だった。", 41, "強い見出しだけを責めず、下書き日、広告枠、支払印を分け、誰が恐怖を商品化したかを示す。", "NPC068"],
  ["leonardo_salon_disbursement", "王都", "LOC_CAP_CASTLE", "貴族街・私設サロン会計室", "慈善費名義の支出から、瓦版・雇い煽動役・見張りへの資金を分離する", GROUPS[2][1], "炊き出し費に偽装された支出が、瓦版の増刷、酒場の煽動役、亜人街の戸口調査へ三分割されていた。", 47, "金額だけでなく、受取時刻と同じ筆跡の領収札を並べ、政治資金の流れを固定する。", "NPC019"],
  ["reused_printing_plates", "王都", "LOC_CAP_NEWSPAPER", "瓦版屋通り・廃版置場", "廃棄された版木の削り跡から、同じ嘘が別名義で反復されたことを示す", GROUPS[2][2], "黒嶺兵、亜人盗賊、混血の疫病という三記事は、人物名だけを削り替えた同じ版木から刷られていた。", 37, "記事本文ではなく、版木の欠け、墨の層、紙幅を比較し、偶然似た噂という逃げ道を塞ぐ。", null],

  ["rash_restriction_drafts", "王都", "LOC_CAP_OFFICE", "王都役所・規制草案庫", "ラシュの草案と公布版を比べ、後から加えられた種族制限を特定する", GROUPS[3][0], "夜間通行の安全規則だった草案へ、混血証明、角隠し、亜人街外出禁止の三条が貴族印で追記されていた。", 42, "担当官一人の責任にせず、草案、清書、公布時刻、差込頁の紙質を照合する。", "NPC067"],
  ["victor_altered_patrol_order", "王都", "LOC_CAP_LOWER_INN", "王都衛兵・巡回命令控え", "ヴィクトルの原命令と配布版を比べ、保護巡回が封鎖命令へ変わった経路を追う", GROUPS[3][1], "原命令は亜人街の避難路確保だったが、配布版では出入口封鎖と一斉拘束へ書き換えられていた。", 44, "隊長の弁明だけでなく、伝令順、受領印、現場の笛符をつなぎ、改竄者を特定する。", "NPC024"],
  ["pass_revocation_register", "王都", "LOC_CAP_OFFICE", "王都役所・通行証失効台帳", "失効処理の偏りから、暴動前に亜人だけを市外へ出られなくした仕組みを示す", GROUPS[3][2], "暴動前夜、黒嶺出身者と混血世帯の通行証だけが一括失効し、理由欄は同じ筆跡で空欄にされた。", 39, "失効数だけでなく、通常の再発行日数と例外承認者を比べ、避難不能を意図した処理と示す。", null],

  ["orka_courier_route", "王都", "LOC_CAP_LOWER_INN", "王都下層・密使の連絡箱", "オルカ密使の受渡時刻から、黒嶺側が暴動を指示できなかった時間軸を作る", GROUPS[4][0], "暴動の煽動文が刷られた時刻、オルカは王都から黒嶺へ向かう封鎖路上におり、同じ暗号を送れる位置にはいなかった。", 46, "密使本人の証言だけでなく、宿帳、橋札、三地点の封蝋を重ねて不在証明を作る。", "NPC046"],
  ["zaid_council_absence_minutes", "黒嶺連合領", "LOC_BLACKRIDGE_COUNCIL", "黒嶺評議場・公開議事録卓", "ザイード派の評議出席記録から、王都扇動の指令が存在しないことを示す", GROUPS[4][1], "暴動前後の評議は避難民受入と国境警戒に費やされ、王都工作の決議欄は後から王国側の写しへだけ足されていた。", 54, "黒嶺側の無実を先に決めず、原本、投票石、王国側写しの綴じ穴を比較する。", "NPC043"],
  ["border_signal_timing", "黒嶺連合領", "LOC_BLACKRIDGE_GATE", "黒嶺門・信号塔記録所", "国境信号の到達時間から、王都の記事が黒嶺命令より先に準備されたと証明する", GROUPS[4][2], "最速の信号でも王都到達に二日必要なのに、扇動版木は三日前から彫られていた。", 49, "信号の意味だけでなく、風、交代、受信鐘を含む最短時間を算出し、因果の順序を崩さない。", null],

  ["marked_door_chalk_roster", "王都", "LOC_CAP_AJIN_QUARTER", "亜人街・消された戸口印記録", "戸口の印と狩人の巡回札を重ね、Day80の一斉襲撃対象を確定する", GROUPS[5][0], "白印は拘束、赤印は人買い搬送、二重線は殺害対象を示し、狩人の巡回札と順番まで一致した。", 41, "住民に印を残させず写し取り、色、順番、近隣の見張り位置から襲撃計画を復元する。", null],
  ["hunter_bounty_payouts", "犯罪都市", "LOC_CRIME_SLAVE_MARKET", "人買い市場・狩人支払帳", "狩人への前金と対象特徴を照合し、暴動後の亜人狩りを請負仕事として示す", GROUPS[5][1], "報奨金は暴動当日ではなく一週間前に払い済みで、生存捕縛と死体確認に別料金が設定されていた。", 53, "残酷な噂として終わらせず、前金、達成印、受取符号から指揮役へ遡る。", "NPC084"],
  ["weapon_handoff_route", "犯罪都市", "LOC_CRIME_INFO_STREET", "犯罪都市・裏取引受渡所", "武器受渡票から、王都の煽動役と人買い市場を結ぶ補給線を割り出す", GROUPS[5][2], "捕縛網、識別札、短弩は別々の商人を装いながら、同じ裏宿でレオナルド派の使者へ渡されていた。", 51, "武器の出所だけでなく、受取合図、宿の部屋割、帰路の荷車を追い、指揮系統を残す。", null],
];

const ALL_LEAD_IDS = LEAD_ROWS.map((row) => row[0]);
const LEADS = LEAD_ROWS.map(([
  id,
  targetLocation,
  facilityId,
  destinationName,
  label,
  discoveryId,
  discoveryText,
  minutes,
  leadNarrative,
  primaryNpcId,
]) => ({
  id,
  targetLocation,
  facilityId,
  destinationName,
  label,
  approachId: `t16-${id.replaceAll("_", "-")}`,
  discoveryId,
  discoveryText,
  unlocksLeadIds: ALL_LEAD_IDS,
  minutes,
  leadNarrative,
  primaryNpcId,
}));

const OPENINGS = [
  {
    id: "protect_people_and_routes",
    preferredFocusId: "protect_and_evacuate",
    label: "まず狙われた住民と子どもの所在を確定し、逃げ道を作る",
    playerUtterance: "誰が狙われ、今夜どの道なら安全なのかを先に確かめる。",
    factId: "T16-FACT-PROTECTION-FIRST",
    unlockedLeadIds: ALL_LEAD_IDS,
  },
  {
    id: "expose_incitement_and_orders",
    preferredFocusId: "propaganda_and_law",
    label: "瓦版の資金と役所・衛兵命令を追い、暴動を作った仕組みを崩す",
    playerUtterance: "群衆だけを責めず、嘘を刷り命令を書き換えた者を追う。",
    factId: "T16-FACT-INCITEMENT-FIRST",
    unlockedLeadIds: ALL_LEAD_IDS,
  },
  {
    id: "prevent_hunt_and_war",
    preferredFocusId: "false_flag_and_hunters",
    label: "黒嶺への濡れ衣とDay80の狩人網を同時に追い、戦争への連鎖を止める",
    playerUtterance: "王都の暴動を黒嶺の仕業にさせず、その混乱で儲ける狩人も止める。",
    factId: "T16-FACT-WAR-PREVENTION-FIRST",
    unlockedLeadIds: ALL_LEAD_IDS,
  },
];

const FOCUSES = [
  {
    id: "protect_and_evacuate",
    label: "住民保護と避難路を分け、誰をどこへ逃がすか決める",
    minutes: 3,
    narrative: "亜人街の被害と王都外への脱出を一つの作業にせず、保護対象と移送経路を別々に確かめる。",
    sceneTransition: "騒然とした広場から、家ごとの保護札と裏路地の地図を広げる場面へ移る",
    groups: [
      { id: "targeted_people", label: "狙われた住民・子ども・負傷者を確定する", evidenceGroupIndex: 0 },
      { id: "escape_and_abduction", label: "安全な避難路と誘拐・人買いの経路を分ける", evidenceGroupIndex: 1 },
    ],
  },
  {
    id: "propaganda_and_law",
    label: "扇動資金と差別命令を分け、世論と制度の両方を止める",
    minutes: 3,
    narrative: "瓦版の嘘だけを訂正しても拘束命令が残り、命令だけ撤回しても煽動役は残る。二つの系統を別々に追う。",
    sceneTransition: "亜人街の路地から、瓦版屋通りと役所の二方向へ視点が分かれる",
    groups: [
      { id: "incitement_funding", label: "見出し・資金・版木から扇動の発注者を確定する", evidenceGroupIndex: 2 },
      { id: "law_and_guard_orders", label: "規制草案・巡回命令・通行証失効を照合する", evidenceGroupIndex: 3 },
    ],
  },
  {
    id: "false_flag_and_hunters",
    label: "黒嶺濡れ衣と狩人組織を分け、外交破綻とDay80の襲撃を止める",
    minutes: 3,
    narrative: "黒嶺の無実を示すだけでは王都内の狩人は止まらず、狩人を捕らえるだけでは戦争世論が残る。両方を追う。",
    sceneTransition: "王都の喧噪から、黒嶺へ向かう信号路と犯罪都市の人買い市場へ場面が割れる",
    groups: [
      { id: "blackridge_false_blame", label: "密使・評議・国境信号から黒嶺濡れ衣を訂正する", evidenceGroupIndex: 4 },
      { id: "hunter_network", label: "戸口印・報奨金・武器受渡から狩人の指揮網を特定する", evidenceGroupIndex: 5 },
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
    id: "samira_victor_protection_coalition",
    label: "サミラ主導の保護区画と、ヴィクトルの共同巡回・避難輸送を成立させる",
    minutes: 78,
    sceneTransition: "役所の決定から亜人街の戸口、王都門の荷車、共同巡回の隊列へ場面が切り替わる",
    narrative: "保護対象を名簿で固定し、亜人街の住民代表、衛兵、孤児院、下層の宿主が一つの避難計画を共有した。群衆を一括逮捕せず、狩人と扇動役だけを切り離した。",
    summary: "亜人街を封じ込めるのではなく、住民代表と衛兵が共同で守る区画と避難輸送が成立した。",
    readiness: {
      openingChoiceIds: ["protect_people_and_routes"],
      openingSupport: 1,
      minimumSupport: 5,
      supportingEvidenceIds: ROUTE_SUPPORT[0],
      requiredEvidenceGroups: COMMON_CORE_GROUPS,
      preparationLabel: "保護区画と共同巡回を成立させる証拠を補う",
      preparationMinutes: 8,
      preparationSummary: "保護対象、避難路、衛兵命令の三点をつなぎ、共同巡回が住民封鎖へ変質しない根拠を補う。",
    },
    worldEffect: {
      flagKey: "t16ProtectionCoalition",
      factId: "T16-RESOLUTION-PROTECTION-COALITION",
      text: "亜人街では住民代表、孤児院、下層宿、王都衛兵が共同巡回と避難輸送を開始し、戸口印の対象は先に保護された。",
      facilityId: "LOC_CAP_AJIN_QUARTER",
      propagationDelayHours: 1,
      aftermathPlans: [
        { id: "t16-samira-protection-council", npcIds: ["NPC026", "NPC024"], goal: "共同巡回と避難名簿を維持する" },
      ],
    },
  },
  {
    id: "public_retraction_and_legal_accountability",
    label: "扇動資金・差別法令・黒嶺濡れ衣を同時公開し、訂正と責任追及を行う",
    minutes: 82,
    sceneTransition: "役所の公開閲覧卓から瓦版屋通り、王城前、黒嶺へ送られる訂正文へ場面が連続する",
    narrative: "煽動記事、資金、改竄命令、黒嶺不在証明を同じ時系列で公開した。群衆の恐怖だけを責めず、嘘を作り制度へ変えた者へ責任を戻した。",
    summary: "瓦版の訂正だけで終わらず、差別法令の撤回、衛兵命令の訂正、資金提供者の公開審理まで進んだ。",
    readiness: {
      openingChoiceIds: ["expose_incitement_and_orders"],
      openingSupport: 1,
      minimumSupport: 5,
      supportingEvidenceIds: ROUTE_SUPPORT[1],
      requiredEvidenceGroups: COMMON_CORE_GROUPS,
      preparationLabel: "公開訂正と法的責任を成立させる証拠を補う",
      preparationMinutes: 8,
      preparationSummary: "記事、資金、命令、黒嶺不在証明を同じ公開記録へまとめるための核心証拠を補う。",
    },
    worldEffect: {
      flagKey: "t16PublicRetraction",
      factId: "T16-RESOLUTION-PUBLIC-RETRACTION",
      text: "王都では扇動記事の資金、差別法令の追記、黒嶺濡れ衣の時系列が公開され、訂正瓦版と命令撤回が同日に行われた。",
      facilityId: "LOC_CAP_NEWSPAPER",
      propagationDelayHours: 0.5,
      aftermathPlans: [
        { id: "t16-petra-correction-series", npcIds: ["NPC068", "NPC067"], goal: "訂正記事と法令撤回記録を継続公開する" },
      ],
    },
  },
  {
    id: "reverse_hunter_network_and_joint_testimony",
    label: "狩人・人買い網を反転追跡し、王都と黒嶺の共同証言委員会へ接続する",
    minutes: 86,
    sceneTransition: "亜人街の戸口印から犯罪都市の支払帳、黒嶺評議場、王都の共同証言台へ場面が転換する",
    narrative: "偽の避難情報を使って狩人の指揮役と人買いの受取人を分離し、捕らえた記録を黒嶺側の不在証明と同じ場で検証した。王都内の犯罪と国境の敵意を別の問題として扱った。",
    summary: "Day80の亜人狩り網は逆追跡で崩れ、王都と黒嶺が同じ証拠を検証する共同証言委員会が開かれた。",
    readiness: {
      openingChoiceIds: ["prevent_hunt_and_war"],
      openingSupport: 1,
      minimumSupport: 5,
      supportingEvidenceIds: ROUTE_SUPPORT[2],
      requiredEvidenceGroups: COMMON_CORE_GROUPS,
      preparationLabel: "狩人網の反転追跡と共同証言を成立させる証拠を補う",
      preparationMinutes: 9,
      preparationSummary: "狩人の対象印、支払、武器受渡、黒嶺不在証明を一つの反転捜査へつなぐ。",
    },
    worldEffect: {
      flagKey: "t16JointTestimonyCommission",
      factId: "T16-RESOLUTION-JOINT-TESTIMONY",
      text: "王都の狩人・人買い網は反転捜査で摘発され、王都と黒嶺の代表が同じ時系列証拠を検証する共同証言委員会を始めた。",
      facilityId: "LOC_CAP_OFFICE",
      propagationDelayHours: 1.5,
      aftermathPlans: [
        { id: "t16-cross-border-testimony", npcIds: ["NPC026", "NPC043", "NPC046"], goal: "T19まで共同証言路を維持する" },
      ],
    },
  },
];

for (const route of ROUTES) {
  route.contextVariants = [
    {
      contextId: "t12-record-preserved",
      flagKey: "t12ResolutionRoute",
      minutes: Math.max(55, route.minutes - 10),
      summary: `${route.summary} T12で偽装襲撃の正式記録が残っていたため、黒嶺濡れ衣の訂正が早まった。`,
    },
    {
      contextId: "t07-or-t10-network-damaged",
      troubleConditions: [{ troubleId: "T10", troubleStatuses: ["failed", "critical"] }],
      minutes: route.minutes + 12,
      summary: `${route.summary} 孤児院と下層の保護網が崩れていたため、散った子どもと世帯を探し直す時間が必要だった。`,
    },
    {
      contextId: "t15-foreign-pressure",
      troubleConditions: [{ troubleId: "T15", troubleStatuses: ["failed", "critical"] }],
      minutes: route.minutes + 9,
      summary: `${route.summary} 外国船団の圧力が残り、王都の強硬派が治安名目を利用したため、公開手順を追加した。`,
    },
  ];
}

export const T16_CAPITAL_PERSECUTION_RIOT_PACK = freeze({
  id: "capital-persecution-riot",
  missionId: "MSN-T16",
  troubleId: "T16",
  title: "王都の亜人排斥暴動",
  hearing: {
    stepId: "hear",
    npcId: "NPC026",
    targetLocation: "王都",
    targetFacilityId: "LOC_CAP_AJIN_QUARTER",
    choices: OPENINGS,
  },
  investigation: {
    stepId: "investigate",
    requiredEvidenceGroups: GROUPS,
    leads: LEADS,
    focuses: FOCUSES,
    defer: {
      id: "defer-t16",
      label: "暴動調査をいったん保留し、住民保護や移動準備を整える",
      minutes: 5,
      deferMinutes: 120,
      summary: "王都の亜人排斥暴動への介入をいったん保留した。時間が進めば、戸口印と狩人網は実行段階へ近づく。",
    },
    initialGuidance: {
      kicker: "同じ暴動に見えても、保護・扇動・法令・濡れ衣・人買いは別の線で動いている",
      title: "六つの事実分類を、三つの異なる経路から確かめる",
      detail: "住民を守るだけでも、記事を止めるだけでも、狩人を倒すだけでも事件は解決しない。",
    },
    continuedGuidance: {
      kicker: "一つの証拠を重ねても、別の原因は埋まらない",
      title: "未確認の事実分類を選び、別の場所と人物へ場面を移す",
      detail: "保護、避難、扇動、制度、濡れ衣、狩人網の六分類を独立して埋める。",
    },
    selectedLeadGuidance: {
      kicker: "選んだ経路の現場へ移動する",
    },
  },
  battle: { stepId: "battle" },
  resolution: { stepId: "resolve", choices: ROUTES },
  catalogOverride: {
    hearing: {
      required: 1,
      targetLocation: "王都",
      targetFacilityId: "LOC_CAP_AJIN_QUARTER",
    },
    investigation: {
      required: 6,
      targetLocation: "王都",
      targetFacilityId: "LOC_CAP_AJIN_QUARTER",
    },
    resolution: {
      required: 1,
      targetLocation: "王都",
      targetFacilityId: "LOC_CAP_OFFICE",
    },
  },
  postInvestigationGuidance: {
    kicker: "証拠が揃っても、暴動・狩人・戦争世論は同じ手段では止まらない",
    title: "三つの最終方針から、これまで集めた証拠に成立するものを選ぶ",
    detail: "成立しない案を選んだ場合は解決扱いにせず、欠けた核心証拠へ戻る。",
  },
  stepGuidance: {
    battle: {
      kicker: "勝利だけでは住民保護と外交路を守れない",
      title: "暴徒の鎮圧と、狩人指揮役の捕縛・避難路維持を分けて達成する",
      detail: "扇動された市民と請負狩人を区別し、戸口印の対象を先に逃がす。",
    },
    resolve: {
      kicker: "三つの解決は、守る対象と残す制度が異なる",
      title: "保護連合、公開責任、反転捜査と共同証言のどれを成立させるか決める",
      detail: "最初の導入と異なる方針へ転換する場合、六分類に加えて七件目の独立裏付けが必要になる。",
    },
  },
  branching: {
    evidenceProfiles: 729,
    evidenceOrders: 720,
    openings: 3,
    resolutions: 3,
    deterministicSignatureCombinationsBeforePriorState: 4_723_920,
  },
});
