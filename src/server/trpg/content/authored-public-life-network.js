import * as base from "./authored-facility-labour.js";

export * from "./authored-facility-labour.js";

export const AUTHORED_PUBLIC_LIFE_NETWORK_VERSION = "authored-public-life-network-v1";

// These are ordinary, public-life choices. They do not grant a route score and they do
// not resolve a trouble. Each choice changes named people's knowledge or plans so the
// long chain can be inspected without reducing an NPC to a hidden success flag.

const STATE_KEY = "publicLifeNetwork";
const PLAYER_SOURCE = "PLAYER";

const NPC = Object.freeze({
  finn: "NPC001",
  mira: "NPC002",
  garo: "NPC003",
  eda: "NPC004",
  glenn: "NPC013",
  matilda: "NPC021",
  noah: "NPC022",
  victor: "NPC024",
  samira: "NPC026",
  orka: "NPC046",
  jill: "NPC060",
  nene: "NPC061",
  petra: "NPC068",
});

function choice(id, label, summary, {
  actorId,
  npcIds = [actorId],
  flags = [],
  factId,
  factText,
  goal,
  trust = {},
  hunger = 0,
  fatigue = 0,
  freeMeals = 0,
  speech = summary,
} = {}) {
  return Object.freeze({
    id,
    label,
    summary,
    actorId,
    npcIds: Object.freeze(npcIds.filter(Boolean)),
    flags: Object.freeze(flags),
    factId,
    factText: factText ?? summary,
    goal,
    trust: Object.freeze({ ...trust }),
    hunger,
    fatigue,
    freeMeals,
    speech,
  });
}

const SCENES = Object.freeze([
  Object.freeze({
    id: "village-belonging",
    fromDay: 2,
    throughDay: 3,
    location: "田園の村",
    facilityId: "LOC_FARM_SQUARE",
    title: "救助の翌日の居場所",
    kicker: "フィンを助けた話より、今日どこで食べるかの話が先に出る。",
    detail: "英雄として持ち上げられるのではなく、この村でどんな距離を取るかを選ぶ。",
    choices: Object.freeze([
      choice("accept_ordinary_place", "普通の居場所を受け取る", "ミラの礼を大げさな英雄譚にせず受け取り、働き口と井戸端の決まりを教わった。", {
        actorId: NPC.mira,
        npcIds: [NPC.mira, NPC.finn, NPC.eda],
        flags: ["villagePlaceOffered", "villageRescueRumorKeptProportional"],
        factId: "PUBLIC-LIFE-FACT-VILLAGE-PLACE",
        factText: "救助後も村の仕事と暮らしへ加わる意思があり、困った時は広場か井戸で声を掛けられる",
        goal: "include-player-in-ordinary-village-life",
        trust: { villageTrust: 1 },
        hunger: -4,
        speech: "泊まる場所も、働く場所も、困った時に声をかける場所もある。助けた人だからじゃない。今日ここにいる人だからです。",
      }),
      choice("ask_for_one_night_only", "今夜だけの寝床を頼む", "長い約束はせず、今夜休める場所だけを確かめた。", {
        actorId: NPC.mira,
        flags: ["villageOneNightShelterConfirmed"],
        factId: "PUBLIC-LIFE-FACT-ONE-NIGHT-SHELTER",
        goal: "prepare-one-night-shelter",
        trust: { villageTrust: 1 },
      }),
      choice("leave_before_rumor_grows", "噂が広がる前に離れる", "救助の礼だけを受け、村の評判が固まる前に街道を選んだ。", {
        actorId: NPC.garo,
        flags: ["villageDepartureChosenEarly"],
        factId: "PUBLIC-LIFE-FACT-EARLY-DEPARTURE",
        goal: "record-player-departure-without-obligation",
      }),
    ]),
  }),
  Object.freeze({
    id: "village-safety-practice",
    fromDay: 4,
    throughDay: 10,
    location: "田園の村",
    facilityId: "LOC_FARM_NORTH_FENCE",
    title: "外へ出る前の手順",
    kicker: "ジルは盾を構え、フィンには見張り小屋までの道を声に出させた。",
    detail: "戦い方だけでなく、出発を知らせ、戻らない時に誰が探すかまで決める。",
    choices: Object.freeze([
      choice("practice_and_report", "盾受けと出発連絡を練習", "ジルと盾・斧の基礎を反復し、フィンとは外へ出る前に行先を告げる約束を具体的な手順にした。", {
        actorId: NPC.jill,
        npcIds: [NPC.jill, NPC.finn, NPC.garo],
        flags: ["villageShieldPracticeCompleted", "finnDepartureNoticeAgreed", "t03NonlethalReturnPlanDiscussed"],
        factId: "PUBLIC-LIFE-FACT-REPORT-BEFORE-LEAVING",
        factText: "村外へ出る者は行先と帰着予定をガロへ伝え、ジルは遅延時に北柵から捜索を始める",
        goal: "maintain-departure-and-return-roster",
        trust: { villageTrust: 1 },
        fatigue: 7,
        speech: "盾は受ける道具だ。斧は退路を作る道具にもなる。出る前に言え。戻らなければ、次に動く者が迷わない。",
      }),
      choice("practice_axe_only", "斧の間合いだけを反復", "ジルから斧の間合いと足運びを教わったが、捜索の連絡手順までは決めなかった。", {
        actorId: NPC.jill,
        flags: ["villageAxePracticeCompleted"],
        factId: "PUBLIC-LIFE-FACT-AXE-PRACTICE",
        goal: "observe-player-combat-footwork",
        fatigue: 9,
      }),
      choice("mark_safe_path", "安全な道だけ地図へ記す", "戦闘訓練を切り上げ、フィンの地図へ北柵までの安全な道を記した。", {
        actorId: NPC.finn,
        npcIds: [NPC.finn, NPC.jill],
        flags: ["finnSafePathMarked"],
        factId: "PUBLIC-LIFE-FACT-FINN-SAFE-PATH",
        goal: "keep-children-on-marked-village-paths",
        trust: { villageTrust: 1 },
      }),
    ]),
  }),
  Object.freeze({
    id: "village-exhaustion-choice",
    fromDay: 9,
    throughDay: 9,
    location: "田園の村",
    facilityId: "LOC_FARM_WELL",
    title: "徹夜明けにもう一往復するか",
    kicker: "梁を運んだ腕は震え、井戸の釣瓶がいつもより重く見える。",
    detail: "無理に水を運ぶ、座ってから汲む、別の人へ頼む。倒れる前に選べる三つの行動がある。",
    choices: Object.freeze([
      choice("fetch_water_while_exhausted", "疲労を押して水を運ぶ", "徹夜明けの梁運びを止めず、そのまま井戸へ水を汲みに来た。足元が崩れ、近くの畑にいたエダが気づける場所で倒れた。", {
        actorId: NPC.eda,
        flags: ["exhaustedWaterRunAttempted", "edaNearCollapseSite"],
        factId: "PUBLIC-LIFE-FACT-EXHAUSTED-WATER-RUN",
        factText: "徹夜明けに梁運びと水汲みを続け、井戸で倒れる危険がある",
        goal: "interrupt-player-work-and-provide-first-aid",
        hunger: 8,
        fatigue: 22,
        speech: "桶を離しな。聞こえるかい。仕事は逃げない、あんたの身体は今ここで倒れる。",
      }),
      choice("sit_before_fetching", "井戸端で先に座る", "釣瓶へ手を掛ける前に座り、息が戻るまで水汲みを止めた。", {
        actorId: NPC.eda,
        flags: ["exhaustionRestChosenAtWell"],
        factId: "PUBLIC-LIFE-FACT-REST-BEFORE-WATER",
        goal: "watch-player-until-breath-recovers",
        hunger: 2,
        fatigue: -8,
      }),
      choice("ask_for_water_help", "水汲みを別の人へ頼む", "梁の片付けだけで上がり、水汲みは近くの村人へ頼んだ。", {
        actorId: NPC.eda,
        flags: ["exhaustedWaterRunDelegated"],
        factId: "PUBLIC-LIFE-FACT-DELEGATE-WATER-RUN",
        goal: "finish-water-run-for-player",
        hunger: 2,
        fatigue: -3,
      }),
    ]),
  }),
  Object.freeze({
    id: "port-working-trust",
    fromDay: 11,
    throughDay: 19,
    location: "交易都市",
    facilityId: "LOC_TRADE_PORT",
    title: "港で顔を覚えられる",
    kicker: "肩書ではなく、同じ荷を持った回数から話が始まる。",
    detail: "働きぶり、帳面、噂のどれを入口に港の人々と関わるかを選ぶ。",
    choices: Object.freeze([
      choice("compare_open_ledger", "働いて配分表を一緒に見る", "荷役を終えてからグレンと配分表を読み、賃金削減と密輸の責任を労働者全体へ押しつけないと約束した。", {
        actorId: NPC.glenn,
        flags: ["glennKnowsPlayerAsWorker", "portAllocationLedgerShared", "workersNotCollectivelyBlamed"],
        factId: "PUBLIC-LIFE-FACT-PORT-WAGE-LEDGER",
        factText: "賃金控除は班の決定ではなくギルド命令で、武器の持込みとは別に調べる必要がある",
        goal: "preserve-work-roster-and-separate-smugglers",
        trust: { reputation: 1 },
        fatigue: 5,
        speech: "働いた手なら帳面を見せる。だが若い連中の怒りと、箱を持ち込んだ奴の都合は一緒にするな。",
      }),
      choice("ask_only_for_work", "次の働き口だけを聞く", "港の事情へ踏み込まず、翌朝の勤務窓と集合場所だけを確かめた。", {
        actorId: NPC.glenn,
        flags: ["portNextShiftKnown"],
        factId: "PUBLIC-LIFE-FACT-PORT-SHIFT",
        goal: "post-next-port-shift",
      }),
      choice("record_rumors_separately", "毒と武器の噂を分ける", "船員の噂を毒、武器、賃金の三枚へ分け、同じ犯人の話として混ぜなかった。", {
        actorId: NPC.glenn,
        flags: ["portRumorsSeparatedBySubject"],
        factId: "PUBLIC-LIFE-FACT-SEPARATE-PORT-RUMORS",
        goal: "compare-rumors-with-ledgers",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-orphanage-contact",
    fromDay: 21,
    throughDay: 23,
    location: "王都",
    facilityId: "LOC_CAP_ORPHANAGE",
    title: "白鈴孤児院の手伝い",
    kicker: "余りパンを置くと、食卓より先に薪と洗濯物が目に入る。",
    detail: "寄付だけで去るか、無償の仕事へ加わるか、院長へ制度の話を聞くかを選ぶ。",
    choices: Object.freeze([
      choice("help_without_wage", "賃金を取らず世話を手伝う", "余りパンを届け、子どもの世話と配膳を手伝った。マティルダは昼食を分け、立ち退き通知の土地番号も見せた。", {
        actorId: NPC.matilda,
        npcIds: [NPC.matilda, NPC.noah],
        flags: ["matildaIntroducedThroughWork", "orphanageLandNumberCopied", "orphanageHelpNotDebt"],
        factId: "PUBLIC-LIFE-FACT-ORPHANAGE-LAND-NUMBER",
        factText: "孤児院の土地番号と立ち退き通知の原本位置が分かり、子どもの証言と分けて調べられる",
        goal: "preserve-eviction-notice-and-child-routine",
        trust: { reputation: 1 },
        hunger: -8,
        freeMeals: 1,
        fatigue: 4,
        speech: "お金は出せません。昼食なら一緒に。通知の写しは見せますが、子どもたちを証人扱いしないでください。",
      }),
      choice("leave_bread_anonymously", "名を告げずパンを置く", "名乗らずパンだけを置き、孤児院の日課を乱さずに去った。", {
        actorId: NPC.matilda,
        flags: ["orphanageAnonymousBreadDelivered"],
        factId: "PUBLIC-LIFE-FACT-ANONYMOUS-BREAD",
        goal: "use-bread-before-stale",
      }),
      choice("ask_about_eviction_first", "立ち退き通知を先に聞く", "生活の手伝いより先に立ち退き通知の制度と期限を確認した。", {
        actorId: NPC.matilda,
        flags: ["orphanageEvictionDeadlineKnown"],
        factId: "PUBLIC-LIFE-FACT-EVICTION-DEADLINE",
        goal: "prepare-formal-eviction-appeal",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-record-request",
    fromDay: 22,
    throughDay: 24,
    location: "王都",
    facilityId: "LOC_CAP_NEWSPAPER",
    title: "記事より先に記録を守る",
    kicker: "強い見出しにできる話ほど、原本を先に失いやすい。",
    detail: "孤児院の土地番号を、記事、登記原本、個人の手控えのどこから照合するか決める。",
    choices: Object.freeze([
      choice("request_records_not_headline", "記事でなく登記原本を頼む", "ペトラへ孤児院の土地番号を示し、すぐ記事にせず過去の登記原本と照合するよう頼んだ。", {
        actorId: NPC.petra,
        flags: ["landRegisterArchiveRequested", "orphanageLandStoryHeldFromPrint"],
        factId: "PUBLIC-LIFE-FACT-PETRA-LAND-ARCHIVE",
        factText: "孤児院の土地番号は記事化前に過去の登記原本と照合し、子どもの噂を所有権の根拠にしない",
        goal: "crosscheck-orphanage-land-register",
        trust: { petraTrust: 1 },
        speech: "売れる話だけど、先に番号を登記原本へ当てる。子どもの噂を証拠にしたら、あとでこの子たちが責められる。",
      }),
      choice("publish_land_number_now", "土地番号だけ先に刷る", "立ち退き通知の土地番号だけを速報へ載せ、所有者名の断定は避けた。", {
        actorId: NPC.petra,
        flags: ["orphanageLandNumberPublished"],
        factId: "PUBLIC-LIFE-FACT-LAND-NUMBER-PUBLISHED",
        goal: "invite-independent-land-record-checks",
        trust: { petraTrust: 1 },
      }),
      choice("keep_all_copies_private", "写しを自分で保管する", "記事化も預託もせず、写しを自分の荷へ戻した。", {
        actorId: NPC.petra,
        flags: ["playerKeptSensitiveCopies"],
        factId: "PUBLIC-LIFE-FACT-COPIES-KEPT-PRIVATE",
        goal: "wait-for-safe-publication-window",
      }),
    ]),
  }),
  Object.freeze({
    id: "trade-record-post",
    fromDay: 33,
    throughDay: 34,
    location: "交易都市",
    facilityId: "LOC_TRADE_INN",
    title: "神殿の写しを別便で送る",
    kicker: "同じ荷に原本と控えを積めば、一度の事故で両方を失う。",
    detail: "ルカの写しをペトラへ送る、港の保管庫へ預ける、自分で運ぶ、の三つから保全経路を選ぶ。",
    choices: Object.freeze([
      choice("send_copy_to_petra", "ペトラへ封印便で送る", "ルカの写しを原本と別の封筒へ入れ、受取確認付きの通常便で王都のペトラへ送った。", {
        actorId: NPC.glenn,
        npcIds: [NPC.glenn, NPC.petra],
        flags: ["lucaCopySentToPetra", "lucaCopySourceChainSealed"],
        factId: "PUBLIC-LIFE-FACT-LUCA-COPY-POSTED",
        factText: "神殿の写しは原本と別経路で王都へ送り、封印番号と受取確認を残す",
        goal: "deliver-sealed-luca-copy-to-petra",
        speech: "荷札と封蝋は別々に控える。届かなければ港で止まったのか、王都で消えたのかまで分かる。",
      }),
      choice("store_copy_at_port", "港の保管庫へ写しを預ける", "王都へは送らず、港の保管庫へ写しを預けて受領札を取った。", {
        actorId: NPC.glenn,
        flags: ["lucaCopyStoredAtPort"],
        factId: "PUBLIC-LIFE-FACT-LUCA-COPY-PORT",
        goal: "guard-luca-copy-at-port",
      }),
      choice("carry_copy_personally", "写しを自分で王都へ運ぶ", "郵便へ預けず、次の王都行きまで写しを自分の荷へ入れた。", {
        actorId: NPC.glenn,
        flags: ["lucaCopyCarriedByPlayer"],
        factId: "PUBLIC-LIFE-FACT-LUCA-COPY-CARRIED",
        goal: "record-player-copy-custody",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-food-relay",
    fromDay: 50,
    throughDay: 61,
    location: "王都",
    facilityId: "LOC_CAP_ORPHANAGE",
    title: "食料配布の連絡を作る",
    kicker: "一つの倉へ集めるより、足りない場所を互いに知らせる方が早い。",
    detail: "孤児院と亜人街が、寄付主ではなく在庫と必要数を直接やり取りする方法を決める。",
    choices: Object.freeze([
      choice("link_caregivers_directly", "院長とサミラを直接つなぐ", "マティルダとサミラが食数、受取時刻、欠品を直接交換できる連絡札を作った。帰路で排斥落書きも記録した。", {
        actorId: NPC.matilda,
        npcIds: [NPC.matilda, NPC.samira],
        flags: ["foodRelayContactsEstablished", "ajinGraffitiRecordedWithoutAmplification"],
        factId: "PUBLIC-LIFE-FACT-FOOD-RELAY-CONTACT",
        factText: "孤児院と亜人街は食数と欠品を直接共有し、扇動的な落書きは拡散せず位置と時刻だけ保存する",
        goal: "exchange-food-counts-without-public-list",
        trust: { petraTrust: 1 },
        speech: "名簿は一つに集めません。必要な食数だけ知らせ合いましょう。子どもの名前は運ぶ人にも渡しません。",
      }),
      choice("centralize_at_orphanage", "孤児院へ在庫を集める", "配布食料を孤児院へ集め、院内の食数だけで割り振ることにした。", {
        actorId: NPC.matilda,
        flags: ["foodStockCentralizedAtOrphanage"],
        factId: "PUBLIC-LIFE-FACT-CENTRAL-FOOD-STOCK",
        goal: "guard-central-food-stock",
      }),
      choice("use_market_notice", "市場掲示で不足だけ募る", "受取人名を出さず、不足する品目と数だけ市場掲示へ出した。", {
        actorId: NPC.samira,
        flags: ["foodShortageMarketNoticePosted"],
        factId: "PUBLIC-LIFE-FACT-FOOD-SHORTAGE-NOTICE",
        goal: "collect-unmarked-food-deliveries",
      }),
    ]),
  }),
  Object.freeze({
    id: "trade-forest-parts-relay",
    fromDay: 54,
    throughDay: 55,
    location: "交易都市",
    facilityId: "LOC_TRADE_PORT",
    title: "排水部品を普通の荷便で送る",
    kicker: "特別な英雄便ではなく、明朝も動く荷車へ部品を載せられる。",
    detail: "部品と水路図を同じ便にするか、別便にするか、現地引渡しを待つかを選ぶ。",
    choices: Object.freeze([
      choice("send_mina_parts_with_glenn", "グレンの通常便へ部品を載せる", "ミーナの排水部品を港の通常荷へ載せ、グレンが森の野営地までの受取札と作業班への引渡しを組んだ。", {
        actorId: NPC.glenn,
        flags: ["minaDrainPartsSentByRegularFreight", "forestWorkCrewDeliveryRoster"],
        factId: "PUBLIC-LIFE-FACT-FOREST-PARTS-FREIGHT",
        factText: "排水部品は通常荷便で森へ届き、受取札と作業班名簿を分けて確認できる",
        goal: "deliver-drain-parts-to-forest-work-crew",
        speech: "特別便にすれば目立つし、港が止まれば届かん。明朝の通常荷へ混ぜる。受取札だけ別に回すぞ。",
      }),
      choice("send_diagram_first", "水路図だけを先に送る", "破損を避けるため、まず水路図の写しだけを森へ送り、部品は次便へ回した。", {
        actorId: NPC.glenn,
        flags: ["forestDrainDiagramSentFirst"],
        factId: "PUBLIC-LIFE-FACT-FOREST-DIAGRAM-FIRST",
        goal: "hold-drain-parts-for-next-freight",
      }),
      choice("keep_parts_for_escort", "護送できる便まで部品を保管", "部品を港倉庫へ戻し、護送人員のある便を待つことにした。", {
        actorId: NPC.glenn,
        flags: ["forestDrainPartsHeldForEscort"],
        factId: "PUBLIC-LIFE-FACT-FOREST-PARTS-HELD",
        goal: "secure-drain-parts-until-escorted",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-shelter-distribution",
    fromDay: 62,
    throughDay: 65,
    location: "王都",
    facilityId: "LOC_CAP_ORPHANAGE",
    title: "避難先を一か所にしない",
    kicker: "大きな避難所は見つけやすく、名簿も奪われやすい。",
    detail: "安全、家族の選択、治療の必要を分けて、複数施設へ避難先を割り振る。",
    choices: Object.freeze([
      choice("distribute_shelters", "複数施設へ本人同意で分散", "孤児院、下層宿、亜人街の診療所へ避難先を分け、店の名簿と子どもの名前は別々に保管した。", {
        actorId: NPC.matilda,
        npcIds: [NPC.matilda, NPC.samira, NPC.noah],
        flags: ["distributedShelterPlan", "shopRosterPreservedSeparately", "childrenKeptOffCourierDuty"],
        factId: "PUBLIC-LIFE-FACT-DISTRIBUTED-SHELTERS",
        factText: "避難先は複数施設へ分散し、本人同意、治療、家族再会の記録を別々に扱う",
        goal: "maintain-distributed-shelter-capacity",
        speech: "全員をここへ集めれば守りやすい。でも見つけられた時は全員を失う。本人に選んでもらって、記録も分けます。",
      }),
      choice("keep_families_together", "家族単位だけを優先する", "施設の分散より家族が離れないことを優先し、空き寝床を割り当てた。", {
        actorId: NPC.matilda,
        flags: ["shelterFamilyUnitsPrioritized"],
        factId: "PUBLIC-LIFE-FACT-FAMILY-SHELTERS",
        goal: "keep-family-units-together",
      }),
      choice("use_lower_inn_only", "下層宿を臨時避難所にする", "下層宿の空き部屋を一時避難所にし、孤児院は子どもの日課を維持した。", {
        actorId: NPC.matilda,
        flags: ["lowerInnTemporaryShelter"],
        factId: "PUBLIC-LIFE-FACT-LOWER-INN-SHELTER",
        goal: "prepare-lower-inn-rooms",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-fair-supply",
    fromDay: 64,
    throughDay: 73,
    location: "王都",
    facilityId: "LOC_CAP_MARKET",
    title: "値段を変えずに品を運ぶ",
    kicker: "善意の配給だけでは、明日の店と仕入れが続かない。",
    detail: "価格表、通常取引、共同炊事を組み合わせ、買い手の種族で条件を変えない仕組みを選ぶ。",
    choices: Object.freeze([
      choice("publish_normal_prices", "価格を公開し通常価格で運ぶ", "人間商人と亜人商人が同じ価格表を掲げ、既存在庫と労働で食料を運んだ。閉店を選ぶ店も責めなかった。", {
        actorId: NPC.samira,
        npcIds: [NPC.samira, NPC.matilda],
        flags: ["publicMarketPriceBoard", "ajinFoodDeliveredAtNormalPrice", "closedShopsNotBlamed", "communityKitchenUsesExistingStock", "firstScuffleSeparatedWithoutCollectiveBlame", "villageFoodCountRequested"],
        factId: "PUBLIC-LIFE-FACT-FAIR-SUPPLY",
        factText: "価格と在庫を公開し、種族にかかわらず同条件で売買し、共同炊事は既存在庫と労働で維持する",
        goal: "keep-fair-market-and-community-kitchen-open",
        fatigue: 5,
        speech: "安く恵んでもらうだけなら明日で終わる。同じ値札で売って、運ぶ手間はみんなで出す。それなら店も残る。",
      }),
      choice("donate_one_day_stock", "一日分を無償で配る", "市場の一日分を無償配布へ回し、翌日の仕入れは改めて相談することにした。", {
        actorId: NPC.samira,
        flags: ["oneDayMarketStockDonated"],
        factId: "PUBLIC-LIFE-FACT-ONE-DAY-DONATION",
        goal: "replace-donated-market-stock",
      }),
      choice("ration_by_household", "世帯数で配給量を決める", "世帯人数だけを基準に配給札を作り、価格交渉は後日に回した。", {
        actorId: NPC.matilda,
        flags: ["householdRationCardsIssued"],
        factId: "PUBLIC-LIFE-FACT-HOUSEHOLD-RATIONS",
        goal: "audit-household-ration-cards",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-inclusive-care",
    fromDay: 69,
    throughDay: 77,
    location: "王都",
    facilityId: "LOC_CAP_ORPHANAGE",
    title: "子どもを分けない受入手順",
    kicker: "安全のための聞き取りが、怖かった子どもへの取り調べになりかねない。",
    detail: "食事、寝床、再会、証言を切り分け、助けられる側が順番を選べるようにする。",
    choices: Object.freeze([
      choice("one_intake_with_consent", "同じ受付で本人の選択を守る", "亜人の子も人間の子も同じ受付を通し、食事と休息を先にした。ノアの恐怖は事情聴取へ利用しなかった。", {
        actorId: NPC.matilda,
        npcIds: [NPC.matilda, NPC.noah, NPC.samira],
        flags: ["inclusiveChildIntake", "shelterConsentRecorded", "noahTraumaNotUsedAsInterrogation"],
        factId: "PUBLIC-LIFE-FACT-CONSENT-FIRST-CARE",
        factText: "子どもの種族で受付を分けず、食事と休息の後に、本人が話す相手と内容を選ぶ",
        goal: "maintain-consent-first-child-care",
        hunger: -6,
        freeMeals: 1,
        speech: "怖かった、と言えるだけで十分です。いつ、誰に、どこで、と続けるのは、この子が選んでからにします。",
      }),
      choice("separate_quiet_room", "静かな部屋を別に用意する", "種族ではなく休息の必要で静かな部屋を分け、聞き取りを翌日に延ばした。", {
        actorId: NPC.matilda,
        flags: ["quietRecoveryRoomPrepared"],
        factId: "PUBLIC-LIFE-FACT-QUIET-RECOVERY",
        goal: "protect-quiet-recovery-room",
      }),
      choice("record_guardian_contacts", "迎え人の連絡先だけ記す", "証言は取らず、迎え人と安全な再会先の連絡先だけを記録した。", {
        actorId: NPC.samira,
        flags: ["safeGuardianContactsRecorded"],
        factId: "PUBLIC-LIFE-FACT-SAFE-GUARDIANS",
        goal: "verify-safe-guardian-contacts",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-factual-edition",
    fromDay: 70,
    throughDay: 74,
    location: "王都",
    facilityId: "LOC_CAP_NEWSPAPER",
    title: "嘘の資金源を紙面で追う",
    kicker: "訂正だけでは、同じ版木を別名で刷る者が残る。",
    detail: "T12の正式記録、価格表、密輸帳簿、広告入金帳を同じ時系列へ並べる。",
    choices: Object.freeze([
      choice("print_facts_trace_funds", "事実列挙で資金経路を刷る", "煽情的な見出しを避け、T12訂正、ザイードの停戦文、価格表、密輸帳簿、複数地区への同額支払を同じ図へ載せた。", {
        actorId: NPC.petra,
        npcIds: [NPC.petra, NPC.orka],
        flags: ["t12CorrectionPublished", "zaidCeasefireLetterPublished", "incitementFundingDiagramPublished", "factualHeadlineChosen"],
        factId: "PUBLIC-LIFE-FACT-INCITEMENT-FUNDING",
        factText: "黒嶺の攻撃という見出しより前に同じ版代が複数地区へ支払われ、密輸帳簿と貴族派会計の一部が重なる",
        goal: "publish-corrections-with-source-citations",
        trust: { petraTrust: 1 },
        fatigue: 4,
        speech: "怒らせる見出しより、逃げられない番号を並べる。停戦文も価格表も同じ紙面に置けば、誰が先に嘘を用意したか見える。",
      }),
      choice("print_ceasefire_only", "停戦文だけを全文掲載する", "資金源の記事は保留し、停戦文の本文と到着時刻だけを掲載した。", {
        actorId: NPC.petra,
        flags: ["zaidCeasefireLetterPublishedAlone"],
        factId: "PUBLIC-LIFE-FACT-CEASEFIRE-TIMING",
        goal: "verify-ceasefire-delivery-time",
      }),
      choice("hold_names_publish_numbers", "人名を伏せ番号だけ刷る", "個人名を伏せ、版代、荷札、領収札の番号だけを公開した。", {
        actorId: NPC.petra,
        flags: ["incitementLedgerNumbersPublished"],
        factId: "PUBLIC-LIFE-FACT-LEDGER-NUMBERS",
        goal: "invite-independent-ledger-crosscheck",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-guard-restraint",
    fromDay: 72,
    throughDay: 76,
    location: "王都",
    facilityId: "LOC_CAP_LOWER_INN",
    title: "一斉拘束を止める準備",
    kicker: "踏み込みを遅らせた時間を、逃亡ではなく負傷者分離へ使う。",
    detail: "衛兵、オルカ隊、住民の役割を分け、非致死制圧と双方の救護手順を確認する。",
    choices: Object.freeze([
      choice("delay_collective_raid", "踏み込み延期と非致死手順", "ヴィクトルへ一斉踏み込みを延期させ、盾で群衆を分け、双方の負傷者を回収し、伝令を生かして確保する手順を決めた。", {
        actorId: NPC.victor,
        npcIds: [NPC.victor, NPC.orka, NPC.samira],
        flags: ["collectiveRaidDelayed", "nonlethalShieldProcedureTrained", "bothSidesMedicalRecoveryPlanned", "courierCaptureMustBeAlive"],
        factId: "PUBLIC-LIFE-FACT-NONLETHAL-INTERVENTION",
        factText: "一斉拘束を延期し、住民分離、双方救護、生存伝令確保を別の担当へ割り当てる",
        goal: "execute-nonlethal-riot-intervention",
        fatigue: 6,
        speech: "延期は撤退じゃない。住民を分け、怪我人を双方から拾い、命令を運んだ者は生かして帳簿まで辿る。",
      }),
      choice("guard_orphanage_only", "孤児院周辺だけを守る", "守備範囲を孤児院周辺へ絞り、広域の踏み込み命令には触れなかった。", {
        actorId: NPC.victor,
        flags: ["orphanageGuardPerimeter"],
        factId: "PUBLIC-LIFE-FACT-ORPHANAGE-PERIMETER",
        goal: "hold-orphanage-perimeter",
      }),
      choice("open_medical_corridor", "救護路だけ先に開く", "戦闘方針を決める前に、診療所へ続く一本道を双方の救護路として確保した。", {
        actorId: NPC.samira,
        npcIds: [NPC.samira, NPC.victor],
        flags: ["neutralMedicalCorridorOpened"],
        factId: "PUBLIC-LIFE-FACT-MEDICAL-CORRIDOR",
        goal: "keep-neutral-medical-corridor-open",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-public-hearing",
    fromDay: 74,
    throughDay: 78,
    location: "王都",
    facilityId: "LOC_CAP_OFFICE",
    title: "恩赦でなく公開聴聞を求める",
    kicker: "王を救った恩を、誰かを黙らせるためではなく記録を開くために使う。",
    detail: "逮捕、非公開調査、公開聴聞のうち、証拠と反論が残る手順を選ぶ。",
    choices: Object.freeze([
      choice("request_open_hearing", "逮捕より公開聴聞を求める", "王救出の恩を使い、即時の一括逮捕ではなく、資金帳、法令、黒嶺不在証明を公開の場で照合するよう求めた。", {
        actorId: NPC.petra,
        npcIds: [NPC.petra, NPC.victor, NPC.samira],
        flags: ["openHearingRequested", "collectivePunishmentRejected"],
        factId: "PUBLIC-LIFE-FACT-OPEN-HEARING",
        factText: "扇動の責任は公開聴聞で資金、命令、時刻を照合し、種族や地区への集団処罰を行わない",
        goal: "prepare-open-hearing-records",
        speech: "恩が残っているなら、逮捕状を増やすより閲覧席を増やして。誰が何を払ったか、反論ごと紙に残す。",
      }),
      choice("request_private_inquiry", "非公開の調査委員会を頼む", "証人保護を優先し、まず非公開委員会で資金帳を照合するよう求めた。", {
        actorId: NPC.victor,
        flags: ["privateInquiryRequested"],
        factId: "PUBLIC-LIFE-FACT-PRIVATE-INQUIRY",
        goal: "screen-witnesses-for-private-inquiry",
      }),
      choice("request_named_arrests", "名簿の人物だけ逮捕を求める", "地区全体ではなく、帳簿と伝令が示す個人だけの逮捕を求めた。", {
        actorId: NPC.victor,
        flags: ["namedArrestsRequested"],
        factId: "PUBLIC-LIFE-FACT-NAMED-ARRESTS",
        goal: "verify-named-arrest-warrants",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-aftercare",
    fromDay: 77,
    throughDay: 79,
    location: "王都",
    facilityId: "LOC_CAP_NEWSPAPER",
    title: "戦いの後を一人の手柄にしない",
    kicker: "食事を配った者、扉を開けた者、記録を守った者の名が別々に残っている。",
    detail: "資金帳の記事化と避難者の生活再開を、英雄一人の物語へ畳まない。",
    choices: Object.freeze([
      choice("feed_listen_publish", "食事と証言を分け共同名で刷る", "避難者へ食事を配り、ノアが話す時間を守った後、ペトラは資金帳、停戦文、価格表、密輸帳簿を別々の出所名で記事化した。", {
        actorId: NPC.petra,
        npcIds: [NPC.petra, NPC.matilda, NPC.noah, NPC.samira],
        flags: ["postRiotMealsDistributed", "noahGivenUnrecordedRecoveryTime", "fundingLedgerPublishedWithCitations", "singleHeroHeadlineRejected"],
        factId: "PUBLIC-LIFE-FACT-SHARED-CREDIT",
        factText: "暴動後の救護と解決は複数の住民、商人、衛兵、記録者の仕事で、一人の英雄譚にしない",
        goal: "publish-cited-aftermath-and-protect-witnesses",
        hunger: -6,
        freeMeals: 1,
        fatigue: 3,
        speech: "一人の英雄って見出しは短くて売れる。でも今回は、誰が扉を開け、誰が鍋を運び、誰が番号を残したかを削らない。",
      }),
      choice("publish_ledger_only", "資金帳だけを記事にする", "救護の個人名は伏せ、資金帳の番号と照合先だけを記事にした。", {
        actorId: NPC.petra,
        flags: ["fundingLedgerPublishedWithoutWitnessNames"],
        factId: "PUBLIC-LIFE-FACT-LEDGER-ONLY-AFTERMATH",
        goal: "protect-witness-names-after-publication",
      }),
      choice("pause_publication_for_care", "記事を遅らせ救護を優先", "紙面を一日遅らせ、避難者の食事と再会を先にした。", {
        actorId: NPC.matilda,
        flags: ["aftermathPublicationDelayedForCare"],
        factId: "PUBLIC-LIFE-FACT-CARE-BEFORE-AFTERMATH",
        goal: "complete-family-reunification-before-publication",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-network-handoff",
    fromDay: 80,
    throughDay: 80,
    location: "王都",
    facilityId: "LOC_CAP_OFFICE",
    title: "連絡網を本人たちへ返す",
    kicker: "危機が去っても、連絡先を旅人一人の手帳へ閉じ込めれば次は続かない。",
    detail: "各施設が互いへ直接連絡できる形にし、未払いと借用品だけを自分の責任として持ち帰る。",
    choices: Object.freeze([
      choice("keep_contacts_open", "当事者同士の連絡先を残す", "マティルダ、サミラ、ペトラが互いの連絡先を持ち、プレイヤー不在でも食料、避難、訂正を続けられる形にした。", {
        actorId: NPC.samira,
        npcIds: [NPC.matilda, NPC.samira, NPC.petra],
        flags: ["civilianContactsMutuallyHeld", "playerObligationsAudited"],
        factId: "PUBLIC-LIFE-FACT-NETWORK-HANDOFF",
        factText: "孤児院、亜人街、瓦版屋は旅人を中継せず相互連絡でき、未払いと借用品は別の個人台帳へ残す",
        goal: "maintain-civilian-network-without-player",
        speech: "あなたがいない日に届かなければ連絡網じゃない。次からは私たちが直接呼び合う。あなたは自分の借りだけ返して。",
      }),
      choice("leave_one_shared_address", "役所の共通窓口へまとめる", "三者の連絡を役所の共通窓口へ集め、受付簿を公開した。", {
        actorId: NPC.victor,
        flags: ["civilianNetworkOfficeDesk"],
        factId: "PUBLIC-LIFE-FACT-OFFICE-CONTACT-DESK",
        goal: "staff-civilian-contact-desk",
      }),
      choice("carry_messages_personally", "次も自分が手紙を運ぶ", "相互連絡先は渡さず、次の便も自分が運ぶと約束した。", {
        actorId: NPC.petra,
        flags: ["playerRemainsNetworkCourier"],
        factId: "PUBLIC-LIFE-FACT-PLAYER-COURIER",
        goal: "prepare-next-message-for-player",
      }),
    ]),
  }),
  Object.freeze({
    id: "village-homecoming-practice",
    fromDay: 82,
    throughDay: 82,
    location: "田園の村",
    facilityId: "LOC_FARM_NORTH_FENCE",
    title: "冒険の前に準備を教える",
    kicker: "フィンは英雄談より先に、持ち物と帰着時刻を書き始めた。",
    detail: "危険を禁止するのではなく、準備、同行者、帰還連絡を本人と一緒に決める。",
    choices: Object.freeze([
      choice("teach_preparation", "準備表と帰着連絡を教える", "フィンと見張り小屋まで歩き、冒険へ出るなら装備、食料、同行者、帰着連絡から始めると約束した。ネネへは世界樹の回復を報告した。", {
        actorId: NPC.finn,
        npcIds: [NPC.finn, NPC.jill, NPC.nene],
        flags: ["finnAdventurePreparationChecklist", "neneToldWorldTreeRecovered"],
        factId: "PUBLIC-LIFE-FACT-FINN-PREPARED-ADVENTURE",
        factText: "冒険は無断で出ることではなく、準備、同行者、帰着連絡を整えてから始める",
        goal: "practice-prepared-short-expeditions",
        fatigue: 3,
        speech: "分かった。行くな、じゃなくて、何を持って誰に言うかだね。帰る時間も地図に書く。",
      }),
      choice("forbid_watchtower_trip", "見張り小屋行きを禁じる", "危険が残る間は見張り小屋へ近づかないよう約束させた。", {
        actorId: NPC.finn,
        flags: ["finnWatchtowerForbidden"],
        factId: "PUBLIC-LIFE-FACT-WATCHTOWER-FORBIDDEN",
        goal: "stay-inside-village-boundary",
      }),
      choice("ask_jill_to_teach", "今後の訓練をジルへ頼む", "自分で教え続ける代わりに、ジルへ短距離の野外訓練を頼んだ。", {
        actorId: NPC.jill,
        npcIds: [NPC.jill, NPC.finn],
        flags: ["jillAskedToTrainFinn"],
        factId: "PUBLIC-LIFE-FACT-JILL-TRAINS-FINN",
        goal: "teach-finn-safe-fieldcraft",
      }),
    ]),
  }),
  Object.freeze({
    id: "village-recommendation",
    fromDay: 81,
    throughDay: 81,
    location: "田園の村",
    facilityId: "LOC_FARM_CHIEF",
    title: "推薦状と所属を分ける",
    kicker: "ガロは村籍の用紙と、所属を決めない推薦状を別々に机へ置いた。",
    detail: "世話になった事実を、村へ固定される義務に変えない形で受け取れる。",
    choices: Object.freeze([
      choice("take_reference_not_registry", "推薦状だけを受け取る", "ガロから身元と働きぶりの推薦状を受け取ったが、村籍への固定は選ばず、所属を自分で決める余地を残した。", {
        actorId: NPC.garo,
        flags: ["garoIdentityReferenceIssued", "villageRegistryDeferredByChoice"],
        factId: "PUBLIC-LIFE-FACT-REFERENCE-WITHOUT-OWNERSHIP",
        factText: "村は身元と働きぶりを保証するが、居住登録や所属を本人へ強制しない",
        goal: "honor-player-reference-without-binding-registration",
        trust: { villageTrust: 1 },
        speech: "世話になったから村のものになれ、とは書かん。ここで働き、借りを返し、戻ってきた。その事実だけを私が保証する。",
      }),
      choice("join_village_registry", "村籍の用紙にも署名する", "推薦状と同時に村籍へ署名し、田園の村を正式な居所に選んだ。", {
        actorId: NPC.garo,
        flags: ["garoIdentityReferenceIssued", "villageRegistryAccepted"],
        factId: "PUBLIC-LIFE-FACT-VILLAGE-REGISTRY-CHOSEN",
        goal: "add-player-to-village-register",
        trust: { villageTrust: 1 },
      }),
      choice("decline_written_reference", "書面を断り口約束だけにする", "書面の推薦は断り、困った時には互いに名を出すという口約束だけを残した。", {
        actorId: NPC.garo,
        flags: ["garoVerbalReferenceOnly"],
        factId: "PUBLIC-LIFE-FACT-VERBAL-REFERENCE",
        goal: "honor-verbal-reference-if-asked",
      }),
    ]),
  }),
  Object.freeze({
    id: "capital-independent-status",
    fromDay: 84,
    throughDay: 84,
    location: "王都",
    facilityId: "LOC_CAP_OFFICE",
    title: "召喚物でない身分記録",
    kicker: "申請欄には所有者ではなく、本人の署名を書く空白がある。",
    detail: "王国所属、村籍、無所属の仮身分のどれを選ぶか、自分の意思で記録する。",
    choices: Object.freeze([
      choice("independent_person_record", "無所属の個人として署名", "王国の召喚物でも誰かの所有物でもなく、無所属の一個人として期限付き身分証へ署名した。", {
        actorId: NPC.victor,
        flags: ["independentTemporaryIdentityIssued", "summonedPropertyStatusRejected"],
        factId: "PUBLIC-LIFE-FACT-INDEPENDENT-IDENTITY",
        factText: "召喚された者も所有物ではなく、所属を本人が選べる独立した個人として扱う",
        goal: "maintain-independent-person-record",
        speech: "所有者欄は抹消した。所属は空欄でいい。ここへ書くのは、あなた自身の名前だけだ。",
      }),
      choice("accept_village_registry", "田園の村籍を選ぶ", "ガロの推薦を使い、田園の村を正式な居所として登録した。", {
        actorId: NPC.garo,
        flags: ["villageRegistryAccepted"],
        factId: "PUBLIC-LIFE-FACT-VILLAGE-REGISTRY",
        goal: "register-player-in-village-roll",
      }),
      choice("accept_royal_service", "王国の公職身分を選ぶ", "事件記録を扱う期限付きの王国公職として身分を登録した。", {
        actorId: NPC.victor,
        flags: ["temporaryRoyalServiceAccepted"],
        factId: "PUBLIC-LIFE-FACT-ROYAL-SERVICE",
        goal: "prepare-limited-public-service-oath",
      }),
    ]),
  }),
  Object.freeze({
    id: "village-closing-table",
    fromDay: 85,
    throughDay: 90,
    location: "田園の村",
    facilityId: "LOC_FARM_INN",
    title: "同じ食卓へ戻る",
    kicker: "遠くの便りは届いているが、席に座る者の食事は先に冷める。",
    detail: "手紙を読み上げる、静かに食べる、次の旅程を話す。物語の閉じ方を選ぶ。",
    choices: Object.freeze([
      choice("share_letters_at_table", "手紙と近況を皆で読む", "エダ、フィン、ミラ、ガロ、リオナと食卓を囲み、遠方の仲間は手紙と噂で生存と仕事の続きだけを伝えた。", {
        actorId: NPC.eda,
        npcIds: [NPC.eda, NPC.finn, NPC.mira, NPC.garo],
        flags: ["closingDinnerShared", "distantNpcLettersRead", "publicLifeNetworkContinuesOffscreen"],
        factId: "PUBLIC-LIFE-FACT-CLOSING-TABLE",
        factText: "各地の人々は自分の仕事と連絡を続け、旅人が不在でも互いを助けられる",
        goal: "continue-mutual-aid-after-story",
        hunger: -16,
        speech: "手紙はあとで何度でも読める。今は食べな。あんたがいない間の話も、こっちには山ほどあるんだから。",
      }),
      choice("eat_quietly", "近況を聞かず静かに食べる", "遠方の手紙は開かず、同じ食卓で今日の食事だけを共にした。", {
        actorId: NPC.eda,
        flags: ["closingDinnerQuiet"],
        factId: "PUBLIC-LIFE-FACT-QUIET-DINNER",
        goal: "let-player-rest-at-table",
        hunger: -16,
      }),
      choice("plan_next_departure", "次の旅程を皆へ伝える", "次に向かう場所と帰着予定を食卓で共有し、返事の送り先を残した。", {
        actorId: NPC.finn,
        npcIds: [NPC.finn, NPC.garo],
        flags: ["nextJourneySharedWithVillage"],
        factId: "PUBLIC-LIFE-FACT-NEXT-JOURNEY",
        goal: "track-next-journey-return-date",
        hunger: -12,
      }),
    ]),
  }),
]);

function array(value) {
  return Array.isArray(value) ? value : [];
}

function player(runtime) {
  return runtime?.playerState?.player ?? runtime?.playerState ?? {};
}

function minute(runtime) {
  return Number(runtime?.playerState?.absoluteMinute ?? 0);
}

function day(runtime) {
  const explicit = Number(runtime?.playerState?.day);
  return Number.isFinite(explicit) && explicit > 0 ? explicit : Math.floor(minute(runtime) / 1440) + 1;
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState[STATE_KEY] ??= {
    version: AUTHORED_PUBLIC_LIFE_NETWORK_VERSION,
    completedSceneIds: [],
    selectedActionIds: [],
    closedActionIds: {},
  };
  const state = runtime.playerState[STATE_KEY];
  state.version = AUTHORED_PUBLIC_LIFE_NETWORK_VERSION;
  state.completedSceneIds = [...new Set(array(state.completedSceneIds).map(String))];
  state.selectedActionIds = [...new Set(array(state.selectedActionIds).map(String))];
  state.closedActionIds = state.closedActionIds && typeof state.closedActionIds === "object"
    ? state.closedActionIds
    : {};
  return state;
}

function actionId(sceneId, choiceId) {
  return `PUBLIC_LIFE:${sceneId.toUpperCase().replaceAll("-", "_")}:${choiceId}`;
}

function atScene(runtime, scene) {
  const current = player(runtime);
  return current.location === scene.location && current.facilityId === scene.facilityId;
}

function sceneEligible(runtime, scene) {
  const currentDay = day(runtime);
  const state = ensureState(runtime);
  return currentDay >= scene.fromDay
    && currentDay <= scene.throughDay
    && atScene(runtime, scene)
    && !state.completedSceneIds.includes(scene.id);
}

function actionFor(scene, entry) {
  const id = actionId(scene.id, entry.id);
  return {
    id,
    actionId: id,
    label: entry.label,
    type: "conversation",
    family: entry.id,
    minutes: 45,
    targetLocation: scene.location,
    targetFacilityId: scene.facilityId,
    targetNpcId: entry.actorId,
    dialogueTopic: `public_life_${scene.id}_${entry.id}`,
    dialogueExit: true,
    suppressRandomEncounter: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredPublicLifeNetworkChoice: true,
    publicLifeSceneId: scene.id,
    publicLifeChoiceId: entry.id,
  };
}

function ownActions(runtime) {
  const scene = SCENES.find((entry) => sceneEligible(runtime, entry));
  return scene ? scene.choices.map((entry) => actionFor(scene, entry)) : null;
}

function isStaleFacilityLabour(actions) {
  return Array.isArray(actions) && actions.length > 0
    && actions.every((entry) => entry?.authoredFacilityLabourChoice);
}

function ensureNpcState(runtime, npcId, scene) {
  runtime.livingWorld ??= {};
  runtime.livingWorld.npcStates ??= {};
  runtime.livingWorld.npcStates[npcId] ??= {
    location: scene.location,
    facilityId: scene.facilityId,
    lifeStatus: "alive",
    presence: "present",
    beliefs: {},
    knowledgeRevision: 0,
  };
  const state = runtime.livingWorld.npcStates[npcId];
  state.beliefs ??= {};
  state.knowledgeRevision = Number(state.knowledgeRevision ?? 0);
  return state;
}

function updateNeeds(runtime, entry) {
  const current = player(runtime);
  current.needs ??= {};
  const before = {
    hunger: Number(current.needs.hunger ?? current.hunger ?? runtime.playerState.hunger ?? 0),
    fatigue: Number(current.needs.fatigue ?? current.fatigue ?? runtime.playerState.fatigue ?? 0),
  };
  const after = {
    hunger: Math.max(0, Math.min(100, before.hunger + entry.hunger)),
    fatigue: Math.max(0, Math.min(100, before.fatigue + entry.fatigue)),
  };
  current.needs.hunger = after.hunger;
  current.needs.fatigue = after.fatigue;
  current.hunger = after.hunger;
  current.fatigue = after.fatigue;
  runtime.playerState.hunger = after.hunger;
  runtime.playerState.fatigue = after.fatigue;
  if (entry.freeMeals) current.freeMeals = Number(current.freeMeals ?? 0) + entry.freeMeals;
  return { before, after, freeMealsAdded: entry.freeMeals };
}

function consume(runtime, action, result) {
  if (result?.ok === false || !action?.authoredPublicLifeNetworkChoice) return false;
  const scene = SCENES.find((entry) => entry.id === action.publicLifeSceneId);
  const entry = scene?.choices.find((candidate) => candidate.id === action.publicLifeChoiceId);
  if (!scene || !entry || action.id !== actionId(scene.id, entry.id) || !sceneEligible(runtime, scene)) return false;

  const state = ensureState(runtime);
  const now = minute(runtime);
  const closed = scene.choices.map((candidate) => actionId(scene.id, candidate.id))
    .filter((id) => id !== action.id);
  state.completedSceneIds.push(scene.id);
  state.selectedActionIds.push(action.id);
  state.closedActionIds[scene.id] = closed;

  runtime.playerState.worldFlags ??= {};
  runtime.playerState.progress ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.goapRequests ??= {};
  for (const flag of entry.flags) runtime.playerState.worldFlags[flag] = true;
  for (const [key, amount] of Object.entries(entry.trust)) {
    runtime.playerState.progress[key] = Number(runtime.playerState.progress[key] ?? 0) + Number(amount);
  }

  for (const npcId of entry.npcIds) {
    const npcState = ensureNpcState(runtime, npcId, scene);
    npcState.beliefs[entry.factId] = {
      factId: entry.factId,
      kind: "fact",
      text: entry.factText,
      confidence: 1,
      importance: 0.75,
      secret: false,
      learnedAt: now / 60,
      propagationAt: now / 60,
      sourceType: "player",
      sourceNpcId: null,
      hopCount: 1,
      path: [PLAYER_SOURCE, npcId],
    };
    npcState.knowledgeRevision += 1;
    npcState.currentGoal = entry.goal;
    npcState.goalSince = now / 60;
  }

  const goapId = `GOAP-PUBLIC-LIFE-${scene.id.toUpperCase()}-${entry.id.toUpperCase()}`
    .replaceAll("_", "-");
  runtime.playerState.goapRequests[goapId] = {
    id: goapId,
    actorNpcId: entry.actorId,
    participantNpcIds: [...entry.npcIds],
    goal: entry.goal,
    destination: scene.facilityId,
    status: "active",
    createdAtMinute: now,
    sourceActionId: action.id,
  };

  const livingState = updateNeeds(runtime, entry);
  runtime.playerState.history.push({
    type: "PUBLIC_LIFE_NETWORK_CHOICE",
    minute: now,
    sceneId: scene.id,
    actionId: action.id,
    choiceId: entry.id,
    factId: entry.factId,
    worldFlags: [...entry.flags],
    participantNpcIds: [...entry.npcIds],
    goapRequestId: goapId,
    location: scene.location,
    facilityId: scene.facilityId,
  });

  result.summary = entry.summary;
  result.speeches = [{ actorId: entry.actorId, text: entry.speech, emotion: "自分の役割を引き受けながら" }];
  result.sceneTransition = `public-life-${scene.id}-${entry.id}`;
  result.closedActionIds = closed;
  result.factId = entry.factId;
  result.goapRequestId = goapId;
  result.livingState = livingState;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (authored != null && !isStaleFacilityLabour(authored)) return authored;
  return ownActions(runtime) ?? authored;
}

export function authoredMissionFlowGuidance(runtime, context = {}) {
  const authored = base.authoredMissionFlowExclusiveActions(runtime, context);
  if (authored != null && !isStaleFacilityLabour(authored)) {
    return base.authoredMissionFlowGuidance(runtime, context);
  }
  const scene = SCENES.find((entry) => sceneEligible(runtime, entry));
  if (!scene) return base.authoredMissionFlowGuidance(runtime, context);
  return {
    kicker: scene.kicker,
    title: scene.title,
    detail: scene.detail,
    targetLocation: scene.location,
    targetFacilityId: scene.facilityId,
    actionPanel: null,
  };
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  if (consume(runtime, action, result)) return true;
  return base.applyAuthoredMissionFlowAction(runtime, action, result);
}

export const AUTHORED_PUBLIC_LIFE_NETWORK_INTERNALS = Object.freeze({
  STATE_KEY,
  NPC,
  SCENES,
  player,
  minute,
  day,
  ensureState,
  actionId,
  sceneEligible,
  actionFor,
  ownActions,
  isStaleFacilityLabour,
  consume,
});
