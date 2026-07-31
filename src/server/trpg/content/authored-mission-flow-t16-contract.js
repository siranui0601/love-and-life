import { T16_CAPITAL_PERSECUTION_RIOT_PACK as P } from "./authored/missions/t16-capital-persecution-riot.js";

const F = Object.freeze;
const choice = (choiceId, label, requiredDisclosure, minutes, sceneTransition) => F({ choiceId, label, requiredDisclosure, minutes, sceneTransition });

export const T16_CONTINUITY_CONTRACT = F({
  introductionSources: F([
    F({
      id: "capital-ajin-emergency-petitions", targetLocation: "王都", targetFacilityId: "LOC_CAP_AJIN_QUARTER",
      guidance: F({ kicker: "戸口印と避難願が同じ家へ重なる", title: "保護・扇動・黒嶺濡れ衣の入口を選ぶ", detail: "代表者一人でなく住民記録から事件へ入る。" }),
      choices: F([
        choice("protect_people_and_routes", "保護願と戸口印から、今夜狙われる住民を確定する", "混血児、黒嶺出身者、治療師の家へ事前に印が付けられていた", 17, "亜人街の集会所から保護札と孤児院の寝床表へ場面が移る"),
        choice("expose_incitement_and_orders", "負傷時刻と瓦版配布、衛兵交代から誘導の順番を追う", "扇動版の直後に保護巡回が封鎖命令へ変わっていた", 18, "治療所から瓦版屋通りと衛兵命令控えへ視点が切り替わる"),
        choice("prevent_hunt_and_war", "戸口印と人買いの買付特徴を比べ、狩人網を追う", "黒嶺の噂より前から王都の印と犯罪都市の買付票が一致していた", 19, "亜人街から人買い市場と黒嶺信号路へ場面が分かれる"),
      ]),
    }),
    F({
      id: "capital-newspaper-reused-plates", targetLocation: "王都", targetFacilityId: "LOC_CAP_NEWSPAPER",
      guidance: F({ kicker: "別記事が同じ版木を使っている", title: "資金・被害者・濡れ衣の入口を選ぶ", detail: "誰がいつ刷らせ、どの命令と連動したかを追う。" }),
      choices: F([
        choice("expose_incitement_and_orders", "版木と広告入金帳から恐怖を発注した資金源を追う", "扇動見出しは事件前に三版分発注されていた", 17, "売り場から廃版置場と貴族サロン会計室へ場面が移る"),
        choice("protect_people_and_routes", "配布区域と襲撃地点を重ね、標的世帯への誘導を追う", "挿絵の路地と戸口印が一致していた", 18, "印刷台から亜人街の三路地と孤児院へ場面が切り替わる"),
        choice("prevent_hunt_and_war", "偽命令の時刻を国境信号と比べ、届かない指令を崩す", "黒嶺から二日かかる命令が王都で三日前から彫られていた", 19, "偽命令文から黒嶺門の信号記録所へ場面が移る"),
      ]),
    }),
    F({
      id: "capital-office-restriction-board", targetLocation: "王都", targetFacilityId: "LOC_CAP_OFFICE",
      guidance: F({ kicker: "安全規則へ種族制限が差し込まれた", title: "差別法令・避難・人買い線の入口を選ぶ", detail: "草案、公布版、通行証、荷車割当を比較する。" }),
      choices: F([
        choice("expose_incitement_and_orders", "草案、公布版、巡回命令から封鎖命令への改竄を追う", "保護巡回が配布段階で一斉拘束へ変わった", 18, "閲覧卓から草案庫と衛兵命令控えへ場面が移る"),
        choice("protect_people_and_routes", "通行証失効と荷車転用から代替避難路を確定する", "混血世帯の証だけが失効し病人用荷車が転用された", 17, "失効台帳から王都門と下層裏路地へ場面が移る"),
        choice("prevent_hunt_and_war", "拘束者移送先と人買い買付票をつなぐ", "移送先だけが正式台帳から消され買付票と一致した", 20, "役所から犯罪都市の人買い市場へ場面が転換する"),
      ]),
    }),
  ]),
  leadFallbacks: F({
    samira_marked_households: F([F({ id: "ajin-sealed-protection-petitions", primaryNpcId: "NPC026", targetLocation: "王都", facilityId: "LOC_CAP_OFFICE", destinationName: "王都役所・封印済み保護願控え", label: "サミラ不在のため、避難願、治療費控え、封鎖免除願から標的世帯を復元する", approachId: "t16-samira-sealed-protection-petitions", discoveryText: "三種の申請は同じ世帯へ集中し、暴動前から標的化されていた。", leadNarrative: "提出日、住所、担当印を重ね、物証から保護対象を復元する。", minutes: 45 })]),
    petra_paid_headline_ledger: F([F({ id: "newspaper-printer-receipts", primaryNpcId: "NPC068", targetLocation: "王都", facilityId: "LOC_CAP_NEWSPAPER", destinationName: "瓦版屋通り・印刷工賃控え", label: "ペトラ不在のため、版木工賃と広告領収札から発注者を確定する", approachId: "t16-petra-printer-receipts", discoveryText: "見出し案が失われても三版分の工賃は貴族派が前払いしていた。", leadNarrative: "証言でなく印刷工程の支払記録から発注を固定する。", minutes: 44 })]),
    rash_restriction_drafts: F([F({ id: "office-draft-copy-register", primaryNpcId: "NPC067", targetLocation: "王都", facilityId: "LOC_CAP_OFFICE", destinationName: "王都役所・草案写し登録簿", label: "ラシュ不在のため、写し登録と紙束番号から種族制限の追記を復元する", approachId: "t16-rash-draft-copy-register", discoveryText: "登録簿は種族制限三条が貴族印で後から差し込まれたことを示した。", leadNarrative: "写し登録と差込頁の物理的順序を確かめる。", minutes: 46 })]),
    victor_altered_patrol_order: F([F({ id: "guard-distribution-copy", primaryNpcId: "NPC024", targetLocation: "王都", facilityId: "LOC_CAP_LOWER_INN", destinationName: "王都下層・衛兵配布命令控え", label: "ヴィクトル不在のため、小隊受領控えから命令改竄を復元する", approachId: "t16-victor-distribution-copy", discoveryText: "小隊控えは途中で封鎖と一斉拘束へ変わった順番を示した。", leadNarrative: "命令を受けた側に残る複数の控えを突き合わせる。", minutes: 47 })]),
    orka_courier_route: F([F({ id: "three-point-courier-seals", primaryNpcId: "NPC046", targetLocation: "王都", facilityId: "LOC_CAP_LOWER_INN", destinationName: "王都下層・三地点封蝋控え", label: "オルカ不在のため、宿帳、橋札、国境印から不在証明を作る", approachId: "t16-orka-three-point-seals", discoveryText: "三地点の封蝋時刻は王都側の偽命令が先に作られたことを示した。", leadNarrative: "離れた三地点が独立して残した時刻をつなぐ。", minutes: 49 })]),
  }),
  battleObjectives: F([
    F({ id: "evacuate-marked-households", label: "戸口印の対象世帯と混血児を封鎖前に避難させる", requiredAnyEvidenceIds: F([...P.investigation.requiredEvidenceGroups[0]]), maxRounds: 14 }),
    F({ id: "capture-hunter-command", label: "市民と請負狩人を区別し指揮役を生け捕る", requiredAnyEvidenceIds: F([...P.investigation.requiredEvidenceGroups[5]]), maxRounds: 10 }),
    F({ id: "preserve-blackridge-message-route", label: "黒嶺へ訂正証言を届ける信号路を維持する", requiredAnyEvidenceIds: F([...P.investigation.requiredEvidenceGroups[4]]), maxRounds: 12 }),
  ]),
});
