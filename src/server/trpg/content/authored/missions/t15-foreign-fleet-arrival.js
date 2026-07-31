const freeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
};

const GROUPS = [
  ["T15-EVIDENCE-CEDRIC-INVITATION-SEAL", "T15-EVIDENCE-GUILD-EMERGENCY-MINUTES", "T15-EVIDENCE-LORD-MANOR-SUCCESSION-REGISTER"],
  ["T15-EVIDENCE-FOREIGN-BERTH-CONTROL-CLAUSE", "T15-EVIDENCE-CUSTOMS-IMMUNITY-SCHEDULE", "T15-EVIDENCE-WAREHOUSE-COLLATERAL-MAP"],
  ["T15-EVIDENCE-SIEGE-PART-CRATE-LAYERS", "T15-EVIDENCE-MERCENARY-ROSTER-AND-PAY", "T15-EVIDENCE-SHIPYARD-GUN-DECK-CONVERSION"],
  ["T15-EVIDENCE-DAY72-TIDE-AND-BELL", "T15-EVIDENCE-NIGHT-SHIFT-LANDING-ORDER", "T15-EVIDENCE-STABLE-REQUISITION-SEQUENCE"],
  ["T15-EVIDENCE-BERYL-FOREIGN-CREDIT-LINE", "T15-EVIDENCE-BAZEL-PROVISION-CONTRACT", "T15-EVIDENCE-ALVAREZ-PRIVATE-TERMS"],
  ["T15-EVIDENCE-CAPITAL-ROAD-SURVEY", "T15-EVIDENCE-SUPPLY-CALENDAR-TO-DAY90", "T15-EVIDENCE-FOREIGN-COMMAND-CIPHER"],
];

const LEAD_ROWS = [
  ["cedric_invitation_seal", "LOC_TRADE_LORD_MANOR", "領主館・封印文書庫", "領主印の使用記録と招致状を重ね、署名時刻の逆転を確定する", GROUPS[0][0], "領主印の貸出前に招致状の封蝋が乾いており、セドリック派が権限を先取りした。", 42, "封蝋、印箱の貸出簿、書記の乾燥砂を照合し、権限の時系列を固定する。"],
  ["guild_emergency_minutes", "LOC_TRADE_GUILD", "商人ギルド・旧議事録庫", "公開議事録と書記控えを比べ、正式採決の有無を確かめる", GROUPS[0][1], "公開版の全会一致に反し、書記控えには反対票と欠席者、振り直された頁番号が残っていた。", 39, "議事本文だけでなく、出席札、投票石、綴じ穴から改竄の順番を読む。"],
  ["lord_manor_succession_register", "LOC_TRADE_LORD_MANOR", "領主館・継承台帳室", "領主の生死確認と継承台帳を照合し、仮継承の権限を崩す", GROUPS[0][2], "死亡欄が空白のまま仮署名だけが進み、次期領主派に外国軍を招く法的権限はなかった。", 45, "療養記録と政務台帳を同時に開き、病床と継承を勝手につなげさせない。"],
  ["foreign_berth_control_clause", "LOC_TRADE_CUSTOMS", "税関・外国契約閲覧卓", "外国船の専用泊地条項を読み、港門指揮権の譲渡範囲を確定する", GROUPS[1][0], "安全保証の名で港門、曳船、検査順の指揮権が外国使節へ移る条項が隠されていた。", 38, "本文、付属図、翻訳控えを比べ、救援名目の背後にある主権移転を特定する。"],
  ["customs_immunity_schedule", "LOC_TRADE_CUSTOMS", "税関・免検予定表庫", "免検予定表から、外国側が税関を排除する時間帯を確定する", GROUPS[1][1], "Day72の満潮後四十分だけ外国船の自己申告で通関でき、税関員は立入禁止とされていた。", 40, "通常便の検査表と例外表を重ね、空白時間を偶然ではなく制度化された穴として示す。"],
  ["warehouse_collateral_map", "LOC_TRADE_WAREHOUSE", "倉庫街・担保区画台帳所", "担保地図から、契約破棄時に接収される倉庫と港路を特定する", GROUPS[1][2], "違約時には倉庫三棟と港門への通路が外国側の保全対象となり、市内を分断できる配置だった。", 44, "金融上の担保を地図へ戻し、どの路地と荷役路が軍事拠点へ変わるかを見る。"],
  ["siege_part_crate_layers", "LOC_TRADE_WAREHOUSE", "倉庫街・検査荷台", "箱の層と固定痕から、穀物名義の攻城部品を分離する", GROUPS[2][0], "穀袋の下から投石機の軸受と破城具の継手が出て、箱板の固定痕も船腹図と一致した。", 47, "民生貨物を壊さず、重量、木屑、固定縄を順に確かめる。"],
  ["mercenary_roster_and_pay", "LOC_TRADE_PORT", "大港湾区・夜勤詰所", "傭兵名簿と給与暦を照合し、護衛を装う先行上陸部隊を特定する", GROUPS[2][1], "護衛名簿の人数は船員数を超え、給与は港警備ではなく街道前進の日程で増額されていた。", 43, "名前だけでなく、役割、給与増額日、交代地点を結び、兵としての運用を示す。"],
  ["shipyard_gun_deck_conversion", "LOC_TRADE_SHIPYARD", "船大工区・修繕船台", "修繕図の改造痕から、商船を砲台へ変える準備を確定する", GROUPS[2][2], "荷役甲板の補強穴は弩砲架台の寸法と一致し、撤去式の矢弾庫まで発注されていた。", 46, "船大工の作業記録、木材寸法、穴位置を重ね、単なる補修という説明を崩す。"],
  ["day72_tide_and_bell", "LOC_TRADE_PORT", "大港湾区・潮位鐘楼", "潮位表と二度打ちの鐘を重ね、Day72の先行上陸窓を確定する", GROUPS[3][0], "通常荷役終了後の二度打ちから四十分だけ港門を開き、満潮に合わせて傭兵を下ろす計画だった。", 36, "紙の時刻ではなく、潮位、鐘、門番交代を同じ時間軸へ置く。"],
  ["night_shift_landing_order", "LOC_TRADE_PORT", "大港湾区・夜勤命令庫", "夜勤命令の配布順から、税関を外す上陸手順を復元する", GROUPS[3][1], "夜勤責任者へ私印命令が先に渡り、税関員の交代直後に外国船専用班だけを残す手順だった。", 41, "配布先、受領時刻、破棄命令を照合し、誰が現場を空白にしたかを確定する。"],
  ["stable_requisition_sequence", "LOC_TRADE_HORSE_MARKET", "馬市・徴発札保管所", "厩舎と荷車の徴発順から、上陸後の内陸移動時刻を割り出す", GROUPS[3][2], "港近くの荷車から順に押さえ、夜明け前に王都街道へ出る隊列が組まれていた。", 40, "馬、御者、橋の通過札を並べ、港で終わらない上陸計画を示す。"],
  ["beryl_foreign_credit_line", "LOC_TRADE_GUILD", "商人ギルド・信用状室", "ベリルの信用状から、利益目的の融資と侵攻資金を分ける", GROUPS[4][0], "短期融資の本紙とは別に、港門確保後だけ返済免除となる付属信用状が存在した。", 42, "金額だけで断罪せず、発動条件と受益者を読み、知らずに貸した者と協力者を分ける。"],
  ["bazel_provision_contract", "LOC_TRADE_GUILD", "商人ギルド・補給契約卓", "バーゼルの補給契約から、食料商売と軍事補給の境界を確定する", GROUPS[4][1], "通常食料とは別に、傭兵の隊列数と王都街道の距離で増える納入欄があった。", 44, "品目、量、届け先、増額条件を分け、戦争を知っていた署名だけを残す。"],
  ["alvarez_private_terms", "LOC_TRADE_CUSTOMS", "税関・使節往復書閲覧室", "アルバレスの私信と通訳控えから、伏せられた上陸人数を確定する", GROUPS[4][2], "港の安全保証と引き換えに上陸人数を伏せ、王都街道の案内役を国内側へ要求していた。", 49, "使節の弁明だけに頼らず、双方の文面、通訳控え、削除跡を照合する。"],
  ["capital_road_survey", "LOC_TRADE_HORSE_MARKET", "馬市裏・街道測量図庫", "外国測量図と荷車試走を重ね、王都までの軍用経路を特定する", GROUPS[5][0], "橋の耐荷重、井戸、狭窄部が隊列幅で測られ、目的地は王都西門まで続いていた。", 45, "観光地図では不要な数値に注目し、何を通すための測量かを示す。"],
  ["supply_calendar_to_day90", "LOC_TRADE_GUILD", "商人ギルド・長期納入暦室", "Day90までの補給暦から、長期占領を支える量を確定する", GROUPS[5][1], "補給はDay90まで十日単位で、港守備、街道拠点、王都前進基地の三欄に分かれていた。", 42, "一便の積荷ではなく、継続期間と補充周期から作戦の終点を読む。"],
  ["foreign_command_cipher", "LOC_TRADE_PORT", "港外連絡艇・信号記録所", "信号旗と暗号控えから、交渉決裂後の軍事命令を確定する", GROUPS[5][2], "港門確保、西街道開放、王都守備分散時の前進という三命令が符号化されていた。", 50, "一語で結論を出さず、旗順、送信時刻、受信確認を揃える。"],
];

const ALL_LEAD_IDS = LEAD_ROWS.map((row) => row[0]);
const LEADS = LEAD_ROWS.map(([id, facilityId, destinationName, label, discoveryId, discoveryText, minutes, leadNarrative]) => ({
  id,
  facilityId,
  targetLocation: "交易都市",
  destinationName,
  label,
  approachId: `t15-${id.replaceAll("_", "-")}`,
  discoveryId,
  discoveryText,
  unlocksLeadIds: ALL_LEAD_IDS,
  minutes,
  leadNarrative,
}));

const OPENINGS = [
  ["authority_and_contract", "law_and_sovereignty", "誰がどの権限で外国船を招き、港の何を担保に入れたのか聞く", "招致した人物だけでなく、その権限と港の譲渡範囲を確認したい。", "現領主の死亡確認前に次期領主派が招致状を作り、港門と倉庫の指揮権まで担保に入れていた", "T15-FACT-ILLEGAL-INVITATION-AND-SOVEREIGNTY", 14],
  ["cargo_and_landing", "ships_and_landing", "船腹に何があり、Day72のいつ誰が上陸するのか聞く", "交易品と軍事物資を分け、上陸人数と時刻を確認したい。", "穀物名義の船倉に攻城部品と傭兵装備があり、Day72の満潮直後に先行上陸する", "T15-FACT-MILITARY-CARGO-AND-DAY72-LANDING", 15],
  ["collaborators_and_destination", "inside_and_destination", "国内の誰が受入れを支え、外国側はどこまで進むつもりか聞く", "利益目的の商人と、侵攻を知る協力者を分け、上陸後の行先も確認したい。", "信用状、補給契約、使節私信が王都街道の測量とDay90までの補給暦へつながっていた", "T15-FACT-COLLABORATORS-AND-CAPITAL-PLAN", 16],
].map(([id, preferredFocusId, label, playerUtterance, requiredDisclosure, factId, minutes]) => ({
  id,
  preferredFocusId,
  dialogueTopic: `mission_flow_t15_${id}`,
  label,
  playerUtterance,
  requiredDisclosure,
  factId,
  unlockedLeadIds: ALL_LEAD_IDS,
  minutes,
  narrative: requiredDisclosure,
  speeches: [],
}));

const ROUTES = [
  {
    id: "invalidate_contract_and_form_port_coalition",
    contextEvidenceMissionId: "MSN-T15",
    label: "招致契約を無効化し、労働者・税関・商人の港湾連合で港門と倉庫を共同管理する",
    minutes: 168,
    readiness: {
      minimumSupport: 3,
      openingChoiceIds: ["authority_and_contract"],
      requiredEvidenceGroups: [[GROUPS[0][0]], [GROUPS[1][0], GROUPS[1][1]], [GROUPS[2][0], GROUPS[2][1]]],
      supportingEvidenceIds: [GROUPS[1][0], GROUPS[2][0], GROUPS[3][0], GROUPS[3][1], GROUPS[4][0], GROUPS[4][1], GROUPS[5][0], GROUPS[5][1]],
      preparationMinutes: 8,
      preparationLabel: "契約無効と港湾連合に必要な権限・主権・軍事性の核心証拠を補う",
      preparationSummary: "違法な招致だけでは外国側の既得権と積荷保全を崩せない。三つの核心を同時に示す。",
    },
    contextVariants: [
      { contextId: "t05-lord-survives-revokes-invitation", flagKey: "t05ResolutionRoute", flagValue: "protect_nicolas_and_treat", minutes: 132, label: "生還した現領主が招致を撤回し、港湾連合へ期限付き管理権を渡す" },
      { contextId: "t06-worker-cooperative-port-coalition", flagKey: "t06ResolutionRoute", flagValue: "worker_cooperative_and_smuggling_watch", minutes: 124, label: "T06の労働者協同組合を中核に、税関と商人の共同港湾管理を発足させる" },
    ],
    summary: "招致権限、港湾主権、軍事積荷から契約を無効化し、都市内部の港湾連合が港門と倉庫を引き継いだ。",
    narrative: "評議室で契約無効が宣言されると場面は港門へ移る。労働者は軍事箱だけを分け、税関は封印番号を読み、商人は民生船の退避枠を確保した。",
    sceneTransition: "評議室から港門・税関・倉庫の同時引継ぎへ場面が転換する",
    worldEffect: { flagKey: "t15ResolutionRoute", factId: "player:T15:invitation-invalidated-port-coalition", text: "外国船招致は無効化され、港湾連合が軍事上陸を止めた", facilityId: "LOC_TRADE_PORT", propagationDelayHours: 1 },
  },
  {
    id: "false_anchorage_and_disarm_fleet",
    contextEvidenceMissionId: "MSN-T15",
    label: "偽の安全泊地で船団を分断し、民生貨物を守りながら傭兵と攻城部品だけを武装解除する",
    minutes: 154,
    readiness: {
      minimumSupport: 3,
      openingChoiceIds: ["cargo_and_landing"],
      requiredEvidenceGroups: [[GROUPS[2][1]], [GROUPS[3][0], GROUPS[3][1]], [GROUPS[4][0], GROUPS[4][1]]],
      supportingEvidenceIds: [GROUPS[3][0], GROUPS[4][0], GROUPS[5][0], GROUPS[5][1], GROUPS[0][0], GROUPS[0][1], GROUPS[1][0], GROUPS[1][1]],
      preparationMinutes: 8,
      preparationLabel: "偽泊地に必要な傭兵・上陸窓・国内受入役の核心証拠を補う",
      preparationSummary: "泊地へ誘うだけでは民間船を危険にさらし第二陣を残す。分断時刻と対象を確定する。",
    },
    contextVariants: [
      { contextId: "t14-reverse-delivery-foreign-order-code", flagKey: "t14ResolutionRoute", flagValue: "reverse_delivery_and_turn_carriers", battleObjectiveConditions: [{ missionId: "MSN-T14", objectiveId: "seal-smuggling-exits", status: "success" }], minutes: 116, label: "T14で追跡した外国向け注文符号を使い、船団を隔離泊地へ誘導して武装解除する" },
      { contextId: "t14-coordinated-seizure-known-crates", flagKey: "t14ResolutionRoute", flagValue: "coordinated_seizure_and_buyer_arrests", minutes: 128, label: "T14の押収番号で軍事箱を識別し、民生貨物を残して隔離泊地で武装解除する" },
    ],
    summary: "潮時と指揮符号を偽装して船団を三つの泊地へ分け、民生船を退避させて傭兵と攻城部品だけを武装解除した。",
    narrative: "場面は沖合の三つの船影へ切り替わる。補給船、使節船、傭兵船が別々の泊地へ入り、連絡艇を遮断した瞬間に攻城部品を封印した。",
    sceneTransition: "港の作戦卓から、沖合で三分される船団と隔離泊地へ場面が転換する",
    worldEffect: { flagKey: "t15ResolutionRoute", factId: "player:T15:false-anchorage-fleet-disarmed", text: "偽泊地で船団は分断され、傭兵と攻城部品が武装解除された", facilityId: "LOC_TRADE_PORT", propagationDelayHours: 2 },
  },
  {
    id: "split_envoy_mercenaries_and_negotiate_withdrawal",
    contextEvidenceMissionId: "MSN-T15",
    label: "使節・傭兵・国内商人へ別々の撤収条件を示し、侵攻同盟を内側から分断する",
    minutes: 182,
    readiness: {
      minimumSupport: 3,
      openingChoiceIds: ["collaborators_and_destination"],
      requiredEvidenceGroups: [[GROUPS[4][2]], [GROUPS[5][1], GROUPS[5][2]], [GROUPS[0][1], GROUPS[0][2]]],
      supportingEvidenceIds: [GROUPS[5][1], GROUPS[0][1], GROUPS[1][0], GROUPS[1][1], GROUPS[2][0], GROUPS[2][1], GROUPS[3][0], GROUPS[3][1]],
      preparationMinutes: 8,
      preparationLabel: "分断交渉に必要な秘密条件・長期目的・招致手続の核心証拠を補う",
      preparationSummary: "一括して敵と扱えば利害の違う者がまとまる。別々の撤収条件を提示できる証拠を揃える。",
    },
    contextVariants: [
      { contextId: "t09-failed-weapons-shortage-bargain", troubleId: "T09", troubleStatus: "failed", minutes: 206, label: "T09失敗の武器不足を隠さず、正規補給だけを残す代わりに傭兵と攻城装備を撤収させる" },
      { contextId: "t14-public-audit-exposes-domestic-signers", flagKey: "t14ResolutionRoute", flagValue: "public_supply_audit_and_legal_watch", minutes: 146, label: "T14公開監査で国内署名者の責任を切り分け、三者へ別々の撤収条件を示す" },
    ],
    summary: "秘密条件、長期占領計画、違法な招致手続を別々に示し、使節・傭兵・国内商人の利害を分断して撤収合意を成立させた。",
    narrative: "場面は使節船、傭兵宿営地、商人評議室を行き来する。私信、未払い給与暦、接収後に失う担保を別々に示し、最後に三通の撤収文書を重ねた。",
    sceneTransition: "使節船・傭兵宿営地・商人評議室を行き来する交渉場面へ転換する",
    worldEffect: { flagKey: "t15ResolutionRoute", factId: "player:T15:invasion-alliance-split-withdrawal", text: "使節・傭兵・国内商人の利害が分断され、外国船団は撤収合意へ入った", facilityId: "LOC_TRADE_GUILD", propagationDelayHours: 3 },
  },
];

export const T15_FOREIGN_FLEET_ARRIVAL_PACK = freeze({
  id: "foreign-fleet-arrival",
  missionId: "MSN-T15",
  troubleId: "T15",
  title: "外国船団の入港",
  persistResolutionBranch: true,
  branching: {
    openingChoices: 3,
    evidenceDimensions: 6,
    alternativesPerDimension: 3,
    evidenceProfiles: 729,
    orderingPermutationsPerProfile: 720,
    topLevelResolutions: 3,
    deterministicSignatureCombinationsAfterOpening: 1_574_640,
    deterministicSignatureCombinationsBeforePriorState: 4_723_920,
    evidenceOrderPersisted: true,
    evidenceOrderMayChangeContext: true,
    persistentBranchSignature: true,
    signatureCountIsNarrativeBranchCount: false,
  },
  catalogOverride: {
    hearing: { targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_CUSTOMS", label: "税関、港、商人ギルドのいずれかで外国船団の入港準備を確かめる" },
    investigation: { required: 6 },
    battle: {
      targetLocation: "交易都市",
      targetFacilityId: "LOC_TRADE_PORT",
      encounterId: "ENC-0035",
      actionType: "missionBattle",
      required: 1,
      label: "先行上陸を止め、招致原本・軍事積荷・第二陣の連絡を別々に押さえる",
      timelineVariants: [
        { minDay: 55, maxDay: 71, targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_CUSTOMS", actionType: "investigate", encounterId: null, minutes: 52, suppressRandomEncounter: true, label: "Day72前に入港許可と軍事箱を留置し、武力上陸への切替条件を確定する", discoveryId: "T15-INTERVENTION-PRELANDING-HOLD", discoveryText: "民生貨物を止めず、入港許可と軍事箱を別々に留置した。" },
        { minDay: 72, maxDay: 89, targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_PORT", actionType: "missionBattle", encounterId: "ENC-0035", minutes: 82, label: "Day72の先行上陸を止め、傭兵、攻城部品、連絡艇を分断する" },
        { minDay: 72, maxDay: 89, troubleId: "T14", troubleStatuses: ["failed"], targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_PORT", actionType: "missionBattle", encounterId: "ENC-0036", minutes: 104, label: "T14失敗で重武装化した傭兵と密輸買い手を分断し、第二陣の接岸を止める" },
      ],
    },
    resolution: { targetLocation: "交易都市", targetFacilityId: "LOC_TRADE_GUILD", label: "港湾主権と撤収条件を三つの方法から決める" },
  },
  hearing: {
    stepId: "hear",
    targetLocation: "交易都市",
    targetFacilityId: "LOC_TRADE_CUSTOMS",
    npcId: "NPC075",
    npcName: "エルネスト",
    guidance: { kicker: "救援船か、占領の前衛か", title: "招致権限、軍事積荷、国内協力者のどこから確かめるか決める", detail: "最初の視点で開く調査経路と後の解決案が変わる。" },
    choices: OPENINGS,
  },
  investigation: {
    stepId: "investigate",
    requiredEvidenceCount: 6,
    requiredEvidenceGroups: GROUPS,
    focuses: [
      { id: "law_and_sovereignty", label: "招致権限と港湾主権を分けて調べる", minutes: 3, narrative: "港の騒音から封印書庫へ場面が移る。", sceneTransition: "港から封印文書と港湾地図の書庫へ切り替わる", groups: [{ id: "invitation_authority", label: "招致権限を三記録から確かめる", evidenceGroupIndex: 0, minutes: 2 }, { id: "port_sovereignty", label: "港の指揮権と接収範囲を三条項から確かめる", evidenceGroupIndex: 1, minutes: 2 }] },
      { id: "ships_and_landing", label: "軍事積荷とDay72の上陸を分けて調べる", minutes: 3, narrative: "契約の場から倉庫、船大工区、夜の桟橋へ場面が広がる。", sceneTransition: "評議室から武装貨物と夜間上陸の港湾現場へ転換する", groups: [{ id: "military_cargo", label: "軍事積荷を現物・人員・船体から確かめる", evidenceGroupIndex: 2, minutes: 2 }, { id: "landing_window", label: "Day72の上陸時刻と内陸移動を三経路から確かめる", evidenceGroupIndex: 3, minutes: 2 }] },
      { id: "inside_and_destination", label: "国内協力者と最終目的を分けて調べる", minutes: 3, narrative: "信用状から王都街道と沖合信号へ視点が移る。", sceneTransition: "都市内の契約から王都街道と沖合の指揮信号へ切り替わる", groups: [{ id: "domestic_collaborators", label: "国内協力者と被強要者を三契約から分ける", evidenceGroupIndex: 4, minutes: 2 }, { id: "invasion_destination", label: "王都侵攻・長期占領の目的を三経路から確かめる", evidenceGroupIndex: 5, minutes: 2 }] },
    ],
    leads: LEADS,
    initialGuidance: { kicker: "六つの独立事実", title: "権限、主権、積荷、時刻、協力者、目的を一つずつ確定する", detail: "同じ種類の証拠を三つ集めても別の空白は埋まらない。" },
    continuedGuidance: { kicker: "一便を止めても侵攻計画は残る", title: "未確認の分類を別の記録・人物・現場から埋める", detail: "契約だけ、積荷だけ、協力者だけでは口実を変えられる。" },
    selectedLeadGuidance: { kicker: "選んだ確認先", detail: "噂ではなく、照合できる署名、番号、時刻、現物へ変える。" },
    defer: { id: "defer", label: "外国船団の調査を保留し、移動・装備・協力者を整える", minutes: 5, deferMinutes: 180, summary: "調査を保留した。Day72の準備は進み続ける。", narrative: "退いた間にも港では夜勤札と荷車が増えていく。" },
    prematureResolution: { id: "confront-fleet-with-incomplete-chain", label: "一部証拠だけで撤収を要求する", minutes: 26, summary: "外国側は不足する空白を突き、撤収を拒んだ。", narrative: "六つの線をつながなければ口実を変えられる。" },
  },
  postInvestigationGuidance: { kicker: "六分類が一つの侵攻計画へつながった", title: "契約無効、偽泊地、分断交渉から選ぶ", detail: "各案に固有の核心証拠が必要だ。" },
  stepGuidance: {
    battle: { kicker: "勝利だけでは港を救えない", title: "原本、軍事積荷、第二陣の連絡を別々に守る", detail: "敵を倒しても副目標を失えば後続事件へ火種が残る。" },
    resolve: { kicker: "外国船を退けた後の港", title: "契約、武装、利害のどこを切るか選ぶ", detail: "残る外交関係、港の自治、国内商人の責任が変わる。" },
  },
  resolution: { stepId: "resolve", choices: ROUTES },
});
