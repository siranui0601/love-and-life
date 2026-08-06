import * as base from "./authored-mission-flow-human-route-warning-wait.js";

export * from "./authored-mission-flow-human-route-warning-wait.js";

export const AUTHORED_T11_WITNESS_NETWORK_VERSION = "authored-t11-witness-network-v1";

const MISSION_ID = "MSN-T11";
const TROUBLE_ID = "T11";
const CRIME_CITY = "犯罪都市";
const CAPITAL = "王都";
const INFO_STREET = "LOC_CRIME_INFO_STREET";
const BLACK_LAMP_INN = "LOC_CRIME_BACK_INN";
const LOWER_INN = "LOC_CAP_LOWER_INN";
const ORPHANAGE = "LOC_CAP_ORPHANAGE";
const CASTLE = "LOC_CAP_CASTLE";

const CROW_ID = "NPC051";
const VERA_ID = "NPC080";
const REN_ID = "NPC020";
const KIRI_ID = "NPC025";
const NOAH_ID = "NPC022";
const VICTOR_ID = "NPC024";
const JERICHO_ID = "NPC083";

const CROW_LEDGER = "T11-EVIDENCE-CROW-INTERMEDIARY-LEDGER";
const VERA_REGISTER = "T11-EVIDENCE-VERA-BLACK-LAMP-GUEST-REGISTER";
const REN_TOKEN = "T11-EVIDENCE-REN-CONTRACT-TOKEN";
const KIRI_PAYMENT = "T11-EVIDENCE-KIRI-PAYMENT-CHAIN";
const LEONARDO_BILL = "T11-EVIDENCE-LEONARDO-CODED-BILL-OF-EXCHANGE";
const NOAH_MAP = "T11-EVIDENCE-NOAH-ALLEY-ROUTE-MAP";
const MILAN_SHIFT = "T11-EVIDENCE-MILAN-GUARD-SHIFT-OBSERVATION";
const ROYAL_SCHEDULE = "T11-EVIDENCE-ROYAL-SCHEDULE-COPY";
const VICTOR_PLAN = "T11-EVIDENCE-VICTOR-COUNTER-ROUTE-PLAN";
const DECOY_SCHEDULE = "T11-EVIDENCE-CASTLE-DECOY-SCHEDULE";
const JERICHO_TRACE = "T11-EVIDENCE-JERICHO-ESCAPE-HORSE-TRACE";

const SCENES = Object.freeze([
  Object.freeze({
    id: "t11-crow-ledger-aftermath",
    stage: 0,
    location: CRIME_CITY,
    facilityId: INFO_STREET,
    kicker: "分割台帳の頁を重ねると、外で靴音が止まった",
    title: "帳簿を見つけた直後",
    detail: "台帳を持つだけでは証人は生き残らない。クロウ、写し、裏口のどれを先に守るか決める。",
    choices: Object.freeze([
      Object.freeze({
        id: "escort_crow",
        label: "クロウを連れ出す",
        family: "rescue",
        minutes: 24,
        targetLocation: CRIME_CITY,
        targetFacilityId: BLACK_LAMP_INN,
        targetNpcId: CROW_ID,
        worldFlag: "t11WitnessNetwork:crowEscorted",
        historyType: "T11_CROW_ESCORTED_FROM_INFO_STREET",
        goap: Object.freeze({ id: "GOAP-T11-CROW-WITNESS-PROTECTION", goal: "protect-crow-as-contract-witness", actorNpcId: CROW_ID, destination: BLACK_LAMP_INN }),
        summary: "台帳を懐へ入れたクロウを客に見せかけ、表通りを使わず黒灯亭へ連れ出した。追手は帳簿だけを探し、仲介人本人が移動したことにはまだ気づいていない。",
        speeches: Object.freeze([
          Object.freeze({ actorId: CROW_ID, text: "助けたつもりになるな。俺は依頼を分け、誰が死ぬかを知らないふりで金を取った。それでも生かすなら、知っている番号は全部話す。", emotion: "機械的な声の奥に警戒" }),
        ]),
      }),
      Object.freeze({
        id: "copy_ledger",
        label: "台帳を三部に写す",
        family: "record",
        minutes: 31,
        targetLocation: CRIME_CITY,
        targetFacilityId: BLACK_LAMP_INN,
        targetNpcId: CROW_ID,
        evidenceId: "T11-EVIDENCE-CROW-LEDGER-THREE-COPIES",
        evidenceSource: "LOC_CRIME_INFO_STREET:CROW_LEDGER_THREE_COPIES",
        worldFlag: "t11WitnessNetwork:ledgerCopied",
        historyType: "T11_CROW_LEDGER_COPIED_THREE_WAYS",
        summary: "実行、逃走、支払いの頁を別々の紙へ写し、一部を衣服へ縫い、一部を黒灯亭へ運び、一部を情報街の別棚へ戻した。どれか一つを奪われても割り印番号は残る。",
        speeches: Object.freeze([
          Object.freeze({ actorId: CROW_ID, text: "三部に分けるなら、同じ袋へ入れるな。俺が依頼を分けたのと同じ理屈だ。違うのは、お前が真相を残すために分けることだな。", emotion: "皮肉を交えた協力" }),
        ]),
      }),
      Object.freeze({
        id: "watch_back_door",
        label: "裏口を見張る",
        family: "observation",
        minutes: 27,
        targetLocation: CRIME_CITY,
        targetFacilityId: BLACK_LAMP_INN,
        targetNpcId: CROW_ID,
        evidenceId: "T11-EVIDENCE-CROW-CLEANUP-MESSENGER-MARK",
        evidenceSource: "LOC_CRIME_INFO_STREET:BACK_DOOR_CLEANUP_MESSENGER",
        worldFlag: "t11WitnessNetwork:cleanupMessengerSeen",
        historyType: "T11_CROW_CLEANUP_MESSENGER_OBSERVED",
        summary: "帳簿の紛失を確かめに来た男を捕えず、靴底の赤土と右袖の白冠印だけを記録した。男は王都方面の馬車へ戻り、台帳を消す命令が上流から届いたことを残した。",
        speeches: Object.freeze([
          Object.freeze({ actorId: CROW_ID, text: "あれは回収役だ。捕えれば次が消える。袖の印だけ覚えろ。今夜、同じ印が黒灯亭へ来る。", emotion: "低い即断" }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: "t11-black-lamp-shelter",
    stage: 1,
    location: CRIME_CITY,
    facilityId: BLACK_LAMP_INN,
    kicker: "黒灯亭の奥では、ヴェラが名を聞かずに扉を開けた",
    title: "証人と記録を隠す",
    detail: "宿、暗号便、逃走馬。仲間へ役割を渡せば、別々の記録が同時に守られる。",
    choices: Object.freeze([
      Object.freeze({
        id: "ask_vera_for_room",
        label: "ヴェラに部屋を借りる",
        family: "trust",
        minutes: 22,
        targetLocation: CRIME_CITY,
        targetFacilityId: BLACK_LAMP_INN,
        targetNpcId: VERA_ID,
        evidenceId: VERA_REGISTER,
        evidenceSource: "LOC_CRIME_BACK_INN:BLACK_LAMP_GUEST_REGISTER",
        worldFlag: "t11WitnessNetwork:veraShelterOpened",
        historyType: "T11_VERA_OPENED_WITNESS_SHELTER",
        goap: Object.freeze({ id: "GOAP-T11-VERA-SAFEHOUSE-SCREEN", goal: "screen-returning-contract-agents", actorNpcId: VERA_ID, destination: BLACK_LAMP_INN }),
        summary: "ヴェラはクロウを帳場の裏へ隠し、名前のない宿帳と部屋代札を並べた。王都式の封蝋を使った客が、暗殺準備日だけクロウの隣室を借りている。",
        speeches: Object.freeze([
          Object.freeze({ actorId: VERA_ID, text: "善人かどうかは寝台を貸す条件にしてないの。ただ、今夜ここで殺される人を増やしたくないだけ。宿帳は私が守る。あなたは生きて話せる人を守って。", emotion: "艶を抑えた真剣さ" }),
          Object.freeze({ actorId: CROW_ID, text: "俺の隣室を取った客は三人とも同じ封蝋だった。ヴェラが日付を残していたとは知らなかった。", emotion: "初めて崩れる平静" }),
        ]),
      }),
      Object.freeze({
        id: "send_cipher_to_kiri",
        label: "キリへ暗号を送る",
        family: "communication",
        minutes: 19,
        targetLocation: CRIME_CITY,
        targetFacilityId: BLACK_LAMP_INN,
        targetNpcId: KIRI_ID,
        evidenceId: KIRI_PAYMENT,
        evidenceSource: "LOC_CAP_LOWER_INN:KIRI_HIDDEN_PAYMENT_LEDGER",
        worldFlag: "t11WitnessNetwork:kiriCipherSent",
        historyType: "T11_KIRI_CIPHER_PAYMENT_CHAIN_RETURNED",
        summary: "割り印番号だけを暗号便で送ると、キリから小口払いの写しが返った。衛兵の代理、瓦版屋、犯罪都市の仲介人へ同じ癖の番号が流れている。",
        speeches: Object.freeze([
          Object.freeze({ actorId: KIRI_ID, text: "人物名を送らなかったのは正解だ。番号だけなら、便が抜かれても誰の首を切ればいいか分からない。支払線はこっちでつないだ。", emotion: "遠隔の短い報告" }),
        ]),
      }),
      Object.freeze({
        id: "ask_jericho_to_freeze_horses",
        label: "ジェリコを呼ぶ",
        family: "logistics",
        minutes: 26,
        targetLocation: CRIME_CITY,
        targetFacilityId: BLACK_LAMP_INN,
        targetNpcId: JERICHO_ID,
        evidenceId: JERICHO_TRACE,
        evidenceSource: "LOC_CRIME_STABLE:ASSASSINATION_ESCAPE_HORSE_TRACE",
        worldFlag: "t11WitnessNetwork:escapeHorsesFrozen",
        historyType: "T11_JERICHO_FROZE_ESCAPE_HORSES",
        goap: Object.freeze({ id: "GOAP-T11-JERICHO-FREEZE-HORSES", goal: "freeze-assassination-escape-horses", actorNpcId: JERICHO_ID, destination: "LOC_CRIME_STABLE" }),
        summary: "ジェリコは三頭の逃走馬を別厩舎へ移し、偽造馬証を写して戻った。馬を消さずに残したことで、受取人が現れる時間まで追える。",
        speeches: Object.freeze([
          Object.freeze({ actorId: JERICHO_ID, text: "馬に罪はない。受取人が来るまで餌をやって待たせる。逃走路を潰すのと、証拠を殺すのは違うからな。", emotion: "馬を気遣う実務口調" }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: "t11-ren-crow-witness-table",
    stage: 2,
    location: CRIME_CITY,
    facilityId: BLACK_LAMP_INN,
    kicker: "クロウの番号だけでは、実行役が何を知らされたか分からない",
    title: "レンとクロウを同じ卓へ",
    detail: "責める、分けて聞く、同席させる。証言の取り方で、二人が協力者になるか口を閉ざすかが変わる。",
    choices: Object.freeze([
      Object.freeze({
        id: "seat_ren_with_crow",
        label: "レンを同席させる",
        family: "mediation",
        minutes: 34,
        targetLocation: CAPITAL,
        targetFacilityId: LOWER_INN,
        targetNpcId: REN_ID,
        evidenceId: REN_TOKEN,
        evidenceSource: "LOC_CRIME_BACK_INN:REN_CONTRACT_TOKEN_CROSSCHECK",
        worldFlag: "t11WitnessNetwork:renCrowCrosschecked",
        historyType: "T11_REN_AND_CROW_CROSSCHECKED_CONTRACT",
        goap: Object.freeze({ id: "GOAP-T11-REN-PROTECTED-CROSSCHECK", goal: "debrief-assassin-contract-without-coercion", actorNpcId: REN_ID, destination: LOWER_INN }),
        summary: "レンの契約札とクロウの割り印を同じ卓で重ねた。レンは標的符号と逃走合図しか知らず、クロウは依頼主名を知らない。互いの不足が一致し、嘘ではなく分割契約だったと確定した。",
        speeches: Object.freeze([
          Object.freeze({ actorId: REN_ID, text: "俺を善人にするな。金で引き受けた。ただ、王を殺した後に下層街まで焼く話は聞いていない。知っている合図は全部置いていく。", emotion: "乾いた決意" }),
          Object.freeze({ actorId: CROW_ID, text: "レンへ渡した札はこれだ。依頼主名は消したが、割り印番号までは変えられない。俺の台帳と一致する。", emotion: "責任を引き受ける平静" }),
        ]),
      }),
      Object.freeze({
        id: "interview_separately",
        label: "二人を別々に聞く",
        family: "investigation",
        minutes: 41,
        targetLocation: CAPITAL,
        targetFacilityId: LOWER_INN,
        targetNpcId: REN_ID,
        evidenceId: REN_TOKEN,
        evidenceSource: "LOC_CRIME_BACK_INN:SEPARATE_CONTRACT_TESTIMONIES",
        worldFlag: "t11WitnessNetwork:separateStatementsTaken",
        historyType: "T11_REN_CROW_SEPARATE_STATEMENTS_TAKEN",
        summary: "レンとクロウを別室で聞き、時刻、割り印、逃走合図だけを照合した。二人の言葉は細部で食い違ったが、契約札の番号と支払順は一致した。",
        speeches: Object.freeze([
          Object.freeze({ actorId: VERA_ID, text: "別々に聞くなら、同じ質問を同じ順番で。怒鳴り声じゃなく、答えが変わった場所を覚えておくわ。", emotion: "宿主の冷静さ" }),
        ]),
      }),
      Object.freeze({
        id: "send_ledger_without_witnesses",
        label: "帳簿だけ王都へ送る",
        family: "record",
        minutes: 28,
        targetLocation: CAPITAL,
        targetFacilityId: LOWER_INN,
        targetNpcId: KIRI_ID,
        evidenceId: "T11-EVIDENCE-CROW-LEDGER-SEALED-COPY",
        evidenceSource: "LOC_CRIME_BACK_INN:CROW_LEDGER_SEALED_COPY",
        worldFlag: "t11WitnessNetwork:witnessesLeftBehind",
        historyType: "T11_LEDGER_SENT_WITHOUT_WITNESSES",
        summary: "台帳の写しだけを王都へ送り、レンとクロウは犯罪都市へ残した。証拠の移動は速いが、頁の意味を説明できる二人は追手の近くに残る。",
        speeches: Object.freeze([
          Object.freeze({ actorId: KIRI_ID, text: "紙は届いた。だが誰が何のために分けた番号かを話せる人間がいない。次の便までに、二人が生きている保証はないぞ。", emotion: "遠隔の苦い警告" }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: "t11-kiri-payment-relay",
    stage: 3,
    location: CAPITAL,
    facilityId: LOWER_INN,
    kicker: "王都へ戻ると、キリは台帳の番号を小口払いへ並べ直していた",
    title: "仲介線を資金線へつなぐ",
    detail: "隠し帳、為替手形、沈黙。どこまで上流へ手を伸ばすかを決める。",
    choices: Object.freeze([
      Object.freeze({
        id: "trace_with_kiri",
        label: "キリと支払線を追う",
        family: "cooperation",
        minutes: 38,
        targetLocation: CAPITAL,
        targetFacilityId: LOWER_INN,
        targetNpcId: KIRI_ID,
        evidenceId: KIRI_PAYMENT,
        evidenceSource: "LOC_CAP_LOWER_INN:KIRI_HIDDEN_PAYMENT_LEDGER",
        worldFlag: "t11WitnessNetwork:paymentChainJoined",
        historyType: "T11_KIRI_PAYMENT_CHAIN_JOINED_TO_CROW_LEDGER",
        summary: "クロウの割り印番号を、キリの隠し帳にある食事代、版木代、衛兵代理への小口払いへ重ねた。暗殺準備費はレオナルド公の事務所印へ戻る。",
        speeches: Object.freeze([
          Object.freeze({ actorId: KIRI_ID, text: "大金は消せる。でも、飯代と馬の前金と版木代を同じ癖で払った。偉い奴ほど、小銭の始末を部下へ任せて足跡を残す。", emotion: "皮肉な集中" }),
        ]),
      }),
      Object.freeze({
        id: "verify_coded_bill",
        label: "暗号手形を照合する",
        family: "finance",
        minutes: 53,
        targetLocation: CAPITAL,
        targetFacilityId: LOWER_INN,
        targetNpcId: KIRI_ID,
        evidenceId: LEONARDO_BILL,
        evidenceSource: "LOC_TRADE_GUILD:LEONARDO_CODED_BILL_COPY",
        worldFlag: "t11WitnessNetwork:codedBillVerified",
        historyType: "T11_LEONARDO_CODED_BILL_VERIFIED",
        summary: "交易都市から取り寄せた手形写しとクロウの割り印を照合し、穀物保険を装った金が実行、馬、宿へ三分割されたことを確定した。",
        speeches: Object.freeze([
          Object.freeze({ actorId: KIRI_ID, text: "『暗殺』なんて字はどこにもない。だが保険金が王の死ぬ日に三つへ割れた。数字の方が、貴族の弁明より正直だ。", emotion: "冷たい確信" }),
        ]),
      }),
      Object.freeze({
        id: "hide_ledger_for_now",
        label: "台帳を伏せておく",
        family: "caution",
        minutes: 18,
        targetLocation: CAPITAL,
        targetFacilityId: LOWER_INN,
        targetNpcId: KIRI_ID,
        worldFlag: "t11WitnessNetwork:ledgerTemporarilyHidden",
        historyType: "T11_CROW_LEDGER_TEMPORARILY_HIDDEN",
        summary: "台帳をすぐ資金線へつながず、暗号名と割り印だけを別紙へ移した。内通者へ調査を悟らせにくい一方、資金提供者へ届く時刻は遅れる。",
        speeches: Object.freeze([
          Object.freeze({ actorId: KIRI_ID, text: "伏せるなら期限を決めろ。秘密は守っているうちに古くなり、古くなった証拠は言い訳に負ける。", emotion: "実務的な釘刺し" }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: "t11-street-witness-route",
    stage: 4,
    location: CAPITAL,
    facilityId: LOWER_INN,
    kicker: "金の流れは見えた。だが、王へ届く道と時刻を示す人が要る",
    title: "下層の目撃を守る",
    detail: "子どもの地図、夜番帳、王の日程。証人の安全と実行時刻を両立する記録を選ぶ。",
    choices: Object.freeze([
      Object.freeze({
        id: "visit_noah",
        label: "ノアを訪ねる",
        family: "care",
        minutes: 31,
        targetLocation: CAPITAL,
        targetFacilityId: ORPHANAGE,
        targetNpcId: NOAH_ID,
        evidenceId: NOAH_MAP,
        evidenceSource: "LOC_CAP_ORPHANAGE:NOAH_ALLEY_ROUTE_MAP",
        worldFlag: "t11WitnessNetwork:noahMapProtected",
        historyType: "T11_NOAH_ROUTE_MAP_PROTECTED",
        goap: Object.freeze({ id: "GOAP-T11-NOAH-SAFE-WITNESS-MAP", goal: "maintain-safe-witness-map", actorNpcId: NOAH_ID, destination: ORPHANAGE }),
        summary: "ノアに人の顔を描かせず、靴、荷札、水溜まりを避けた曲がり角だけを地図へ写してもらった。証人の名を出さず、王城裏道の試走を示せる。",
        speeches: Object.freeze([
          Object.freeze({ actorId: NOAH_ID, text: "顔は描かなくていいんだね。銀の靴と、折った荷札なら覚えてる。ぼくの名前を言わなくても、この道は分かるよ。", emotion: "安心と慎重な勇気" }),
        ]),
      }),
      Object.freeze({
        id: "read_milan_ledger",
        label: "ミランの帳面を見る",
        family: "record",
        minutes: 29,
        targetLocation: CAPITAL,
        targetFacilityId: LOWER_INN,
        targetNpcId: KIRI_ID,
        evidenceId: MILAN_SHIFT,
        evidenceSource: "LOC_CAP_LOWER_INN:MILAN_GUARD_MEAL_LEDGER",
        worldFlag: "t11WitnessNetwork:milanShiftProtected",
        historyType: "T11_MILAN_GUARD_SHIFT_OBSERVATION_RECORDED",
        summary: "宿の注文札と衛兵の食事時刻を重ね、暗殺予定日だけ外郭交代が一刻早いことを確定した。宿主の推測ではなく、注文数と時刻が残る。",
        speeches: Object.freeze([
          Object.freeze({ actorId: KIRI_ID, text: "ミランは兵の顔を責めていない。何人分の飯を何時に出したかだけだ。だから交代命令を出した上役まで追える。", emotion: "証人を守る説明" }),
        ]),
      }),
      Object.freeze({
        id: "request_royal_schedule",
        label: "王の日程を照合する",
        family: "institution",
        minutes: 35,
        targetLocation: CAPITAL,
        targetFacilityId: CASTLE,
        targetNpcId: VICTOR_ID,
        evidenceId: ROYAL_SCHEDULE,
        evidenceSource: "LOC_CAP_CASTLE:SEALED_ROYAL_SCHEDULE_COPY",
        worldFlag: "t11WitnessNetwork:royalScheduleCompared",
        historyType: "T11_ROYAL_SCHEDULE_COPY_COMPARED",
        summary: "王の非公開日程とクロウの契約日を照合し、漏洩した予定だけに暗殺準備費が付いていることを確定した。",
        speeches: Object.freeze([
          Object.freeze({ actorId: VICTOR_ID, text: "この写しを見られた者は限られる。警備を増やす前に、誰がどの頁を知っていたかを分けて調べる。", emotion: "硬い警戒" }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: "t11-victor-counterline",
    stage: 5,
    location: CAPITAL,
    facilityId: null,
    kicker: "証人と記録が四方から王都へ集まり、ヴィクトルは封鎖命令を三枚へ分けた",
    title: "暗殺を止める線を作る",
    detail: "迎撃路、囮日程、逃走馬。王だけでなく、証人と下層住民を巻き込まない止め方を選ぶ。",
    choices: Object.freeze([
      Object.freeze({
        id: "build_victor_counterline",
        label: "ヴィクトルと封鎖線を作る",
        family: "coordination",
        minutes: 44,
        targetLocation: CAPITAL,
        targetFacilityId: CASTLE,
        targetNpcId: VICTOR_ID,
        evidenceId: VICTOR_PLAN,
        evidenceSource: "LOC_CAP_CASTLE:VICTOR_THREE_PART_COUNTER_ROUTE",
        worldFlag: "t11WitnessNetwork:victorCounterlineBuilt",
        historyType: "T11_VICTOR_COUNTER_ROUTE_BUILT",
        goap: Object.freeze({ id: "GOAP-T11-VICTOR-THREE-PART-SEAL", goal: "prepare-three-part-counter-route", actorNpcId: VICTOR_ID, destination: CASTLE }),
        summary: "外郭、渡り廊下、馬車門を別々の小隊へ任せ、全図を知る者を作らない封鎖線を組んだ。内通者が一枚を漏らしても、残る二線で刺客と住民を分けられる。",
        speeches: Object.freeze([
          Object.freeze({ actorId: VICTOR_ID, text: "守る者全員へ同じ命令を出すのは楽だ。だが内通者が一人いれば全部開く。三枚に分ける。互いの合図は、最後まで私と君だけが持つ。", emotion: "責任を分かつ決意" }),
        ]),
      }),
      Object.freeze({
        id: "prepare_decoy_schedule",
        label: "囮の日程を作る",
        family: "deception",
        minutes: 39,
        targetLocation: CAPITAL,
        targetFacilityId: CASTLE,
        targetNpcId: VICTOR_ID,
        evidenceId: DECOY_SCHEDULE,
        evidenceSource: "LOC_CAP_CASTLE:CASTLE_DECOY_SCHEDULE",
        worldFlag: "t11WitnessNetwork:decoySchedulePrepared",
        historyType: "T11_CASTLE_DECOY_SCHEDULE_PREPARED",
        summary: "漏洩元ごとに時刻を一つずつ変えた三種類の日程を作り、どの偽時刻へ刺客が動くかで内通者を特定できるようにした。",
        speeches: Object.freeze([
          Object.freeze({ actorId: VICTOR_ID, text: "王を囮にはしない。紙だけを囮にする。違う時刻を三人へ渡し、動いた刃から漏れた頁を割り出す。", emotion: "抑制された決断" }),
        ]),
      }),
      Object.freeze({
        id: "order_horse_records",
        label: "馬証を取り寄せる",
        family: "logistics",
        minutes: 36,
        targetLocation: CAPITAL,
        targetFacilityId: CASTLE,
        targetNpcId: JERICHO_ID,
        evidenceId: JERICHO_TRACE,
        evidenceSource: "LOC_CRIME_STABLE:JERICHO_ESCAPE_HORSE_TRACE",
        worldFlag: "t11WitnessNetwork:horseTraceDelivered",
        historyType: "T11_JERICHO_HORSE_TRACE_DELIVERED_TO_CASTLE",
        summary: "ジェリコから届いた馬証には、同じ偽名で借りられた三頭と、王都西門での受渡時刻が記されていた。逃走線を先に閉じられる。",
        speeches: Object.freeze([
          Object.freeze({ actorId: JERICHO_ID, text: "三頭とも足を傷めていない。受取人が来たら走れる状態で待たせてある。捕えるなら馬を驚かせるな。", emotion: "届けられた伝言" }),
        ]),
      }),
    ]),
  }),
  Object.freeze({
    id: "t11-companion-counterplot-briefing",
    stage: 6,
    location: CAPITAL,
    facilityId: CASTLE,
    kicker: "台帳、支払線、目撃地図、封鎖線が一枚の卓へ揃った",
    title: "誰を守り、誰へ役割を渡すか",
    detail: "ここで選ぶのはルート名ではない。証人、公開、二重協力のどれを使って暗殺を止めるかだ。",
    choices: Object.freeze([
      Object.freeze({
        id: "protect_witnesses_and_move_king",
        label: "証人を隠して王を逃がす",
        family: "protection",
        minutes: 32,
        targetLocation: CAPITAL,
        targetFacilityId: CASTLE,
        targetNpcId: VICTOR_ID,
        worldFlag: "t11WitnessNetwork:silentProtectionPlanReady",
        historyType: "T11_WITNESS_PROTECTION_COUNTERPLOT_READY",
        preferredResolution: "silent_counterplot_and_protect_king",
        goap: Object.freeze({ id: "GOAP-T11-WITNESS-PROTECTION-COUNTERPLOT", goal: "protect-witnesses-and-move-king", actorNpcId: VICTOR_ID, destination: CASTLE }),
        summary: "証人の所在を小隊へ渡さず、王だけを別廊下へ移す計画を決めた。クロウ、レン、ヴェラ、キリ、ノアはそれぞれ一部だけを担い、誰か一人が捕まっても全体は崩れない。",
        speeches: Object.freeze([
          Object.freeze({ actorId: VICTOR_ID, text: "王を守るために証人を囮へはしない。君が集めた人たちは別々の場所で一つずつ役割を持つ。私は城内の三線を閉じる。", emotion: "硬い信頼" }),
          Object.freeze({ actorId: REN_ID, text: "俺は合図を見分ける。無罪を買う気はない。ただ、次の刃が誰へ向くかは先に言える。", emotion: "静かな覚悟" }),
        ]),
      }),
      Object.freeze({
        id: "prepare_public_testimony",
        label: "証言を公開する",
        family: "public_accountability",
        minutes: 37,
        targetLocation: CAPITAL,
        targetFacilityId: CASTLE,
        targetNpcId: KIRI_ID,
        worldFlag: "t11WitnessNetwork:publicInquiryPlanReady",
        historyType: "T11_PUBLIC_CONSPIRACY_INQUIRY_READY",
        preferredResolution: "public_conspiracy_inquiry_and_guard_reform",
        summary: "証人の名を伏せたまま、契約番号、支払線、王城の漏洩頁を公開審理へ載せる準備を整えた。個人の勇気を消費せず、複数の記録が互いを支える形にした。",
        speeches: Object.freeze([
          Object.freeze({ actorId: KIRI_ID, text: "人の顔を晒すな。番号と時刻と印だけで十分だ。権力者が『証人は嘘つきだ』と言っても、四つの帳面までは嘘つきにできない。", emotion: "公開へ向けた慎重さ" }),
        ]),
      }),
      Object.freeze({
        id: "ask_ren_for_false_success",
        label: "レンに偽報告を頼む",
        family: "covert_cooperation",
        minutes: 29,
        targetLocation: CAPITAL,
        targetFacilityId: CASTLE,
        targetNpcId: REN_ID,
        worldFlag: "t11WitnessNetwork:falseSuccessPlanReady",
        historyType: "T11_REN_FALSE_SUCCESS_REPORT_READY",
        preferredResolution: "turn_assassin_and_trace_network",
        summary: "レンへ無罪を約束せず、王が倒れたという偽合図を送る役割を頼んだ。クロウとヴェラは戻る回収役を記録し、ジェリコは逃走馬を止める。",
        speeches: Object.freeze([
          Object.freeze({ actorId: REN_ID, text: "『白冠完了』を送れば、金を回収する奴が動く。俺を信じる必要はない。送る文面も時刻も、全員の前で決めろ。", emotion: "条件を明かす協力" }),
          Object.freeze({ actorId: CROW_ID, text: "偽報告が来れば、回収役は台帳の残りを焼きに来る。俺が番号を読む。ヴェラが顔を残す。", emotion: "役割を受け入れる冷静さ" }),
        ]),
      }),
    ]),
  }),
]);

const AFTERMATH_SCENE = Object.freeze({
  id: "t11-witness-network-aftermath",
  kicker: "王城の夜が明けても、証人たちの仕事は終わらない",
  title: "救った後に会う人",
  detail: "供述、地図、宿帳。暗殺阻止の後に残った人と記録を、次の生活へ戻す。",
  choices: Object.freeze([
    Object.freeze({ id: "attend_ren_debrief", label: "レンの供述に立ち会う", family: "care", minutes: 26, targetLocation: CAPITAL, targetFacilityId: LOWER_INN, targetNpcId: REN_ID, worldFlag: "t11WitnessNetwork:renDebriefSupported", historyType: "T11_REN_DEBRIEF_SUPPORTED", summary: "レンの供述に立ち会い、知っていることと知らないことを分けて記録した。自白を急がせず、契約札と合図だけを後日の調査へ残した。", speeches: Object.freeze([Object.freeze({ actorId: REN_ID, text: "知らない名まで言えば、その場では喜ばれる。でも後で全部が嘘になる。俺が見た合図だけを書く。", emotion: "疲れた誠実さ" })]) }),
    Object.freeze({ id: "return_noah_map", label: "ノアへ地図を返す", family: "relationship", minutes: 34, targetLocation: CAPITAL, targetFacilityId: ORPHANAGE, targetNpcId: NOAH_ID, worldFlag: "t11WitnessNetwork:noahMapReturned", historyType: "T11_NOAH_MAP_RETURNED", summary: "証拠用の写しだけを残し、炭書きの原図をノアへ返した。子どもの持ち物を王城の保管物にせず、本人の生活へ戻した。", speeches: Object.freeze([Object.freeze({ actorId: NOAH_ID, text: "返してくれるんだ。じゃあ、もう怖い人の道じゃなくて、みんなが安全に帰る道も描く。", emotion: "ほっとした笑顔" })]) }),
    Object.freeze({ id: "thank_vera", label: "ヴェラへ礼を送る", family: "gratitude", minutes: 18, targetLocation: CAPITAL, targetFacilityId: CASTLE, targetNpcId: VERA_ID, worldFlag: "t11WitnessNetwork:veraThanked", historyType: "T11_VERA_THANKED_FOR_SHELTER", summary: "黒灯亭へ短い礼状と宿代を送った。証人を匿った部屋を英雄譚にせず、次の客が普通に泊まれる宿へ戻した。", speeches: Object.freeze([Object.freeze({ actorId: VERA_ID, text: "礼状は帳場にしまうわ。部屋はもう別の旅人へ貸した。秘密の部屋なんて、長く残すものじゃないもの。", emotion: "届いた返書の軽い微笑み" })]) }),
  ]),
});

function array(value) { return Array.isArray(value) ? value : []; }
function minute(runtime) { return Number(runtime?.playerState?.absoluteMinute ?? 0); }
function player(runtime) { return runtime?.playerState?.player ?? runtime?.playerState ?? {}; }

function readState(runtime) {
  return runtime?.playerState?.t11WitnessNetworkFlow ?? {
    version: AUTHORED_T11_WITNESS_NETWORK_VERSION,
    stage: 0,
    selectedActionIds: [],
    closedActionIdsByScene: {},
    routePlanCompletedAtMinute: null,
    preferredResolution: null,
    aftermathCompletedAtMinute: null,
  };
}

function ensureState(runtime) {
  runtime.playerState ??= {};
  runtime.playerState.t11WitnessNetworkFlow ??= {
    version: AUTHORED_T11_WITNESS_NETWORK_VERSION,
    stage: 0,
    selectedActionIds: [],
    closedActionIdsByScene: {},
    routePlanCompletedAtMinute: null,
    preferredResolution: null,
    aftermathCompletedAtMinute: null,
  };
  const state = runtime.playerState.t11WitnessNetworkFlow;
  state.version = AUTHORED_T11_WITNESS_NETWORK_VERSION;
  state.stage = Number.isInteger(state.stage) ? state.stage : 0;
  state.selectedActionIds = array(state.selectedActionIds).map(String);
  state.closedActionIdsByScene = state.closedActionIdsByScene && typeof state.closedActionIdsByScene === "object" ? state.closedActionIdsByScene : {};
  return state;
}

function mission(runtime) {
  const collection = runtime?.playerState?.missions;
  if (Array.isArray(collection)) return collection.find((entry) => entry?.id === MISSION_ID) ?? null;
  return collection?.[MISSION_ID] ?? null;
}

function terminalT11(runtime) {
  return ["completed", "failed", "resolved", "terminal"].includes(String(mission(runtime)?.status ?? ""));
}

function evidenceCollection(runtime) {
  return runtime?.playerState?.evidence ?? {};
}

function hasEvidence(runtime, evidenceId) {
  const collection = evidenceCollection(runtime);
  if (Array.isArray(collection)) return collection.some((entry) => entry === evidenceId || entry?.id === evidenceId);
  if (collection?.[evidenceId]) return true;
  return array(runtime?.playerState?.history).some((entry) => entry?.evidenceId === evidenceId || entry?.discoveryId === evidenceId);
}

function resolutionRoute(runtime) {
  return runtime?.playerState?.worldFlags?.t11ResolutionRoute
    ?? runtime?.worldFlags?.t11ResolutionRoute
    ?? null;
}

function currentScene(runtime) {
  const state = readState(runtime);
  if (terminalT11(runtime)) {
    return resolutionRoute(runtime) && state.routePlanCompletedAtMinute != null && state.aftermathCompletedAtMinute == null
      ? AFTERMATH_SCENE
      : null;
  }
  if (!hasEvidence(runtime, CROW_LEDGER)) return null;
  const scene = SCENES.find((entry) => entry.stage === state.stage) ?? null;
  if (!scene) return null;
  const current = player(runtime);
  if (current.location !== scene.location) return null;
  if (scene.facilityId && current.facilityId !== scene.facilityId) return null;
  return scene;
}

function actionId(sceneId, choiceId) {
  return `MISSION_FLOW:T11:WITNESS_NETWORK:${sceneId}:${choiceId}`;
}

function actionFor(scene, choice) {
  return {
    id: actionId(scene.id, choice.id),
    actionId: actionId(scene.id, choice.id),
    label: choice.label,
    type: "conversation",
    family: choice.family,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    stepId: scene === AFTERMATH_SCENE ? "aftermath" : "investigate",
    minutes: choice.minutes,
    targetLocation: choice.targetLocation,
    targetFacilityId: choice.targetFacilityId,
    targetNpcId: choice.targetNpcId,
    dialogueExit: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredT11WitnessNetworkChoice: true,
    authoredT11WitnessNetworkSceneId: scene.id,
    authoredT11WitnessNetworkChoiceId: choice.id,
  };
}

function actions(runtime) {
  const scene = currentScene(runtime);
  return scene ? scene.choices.map((choice) => actionFor(scene, choice)) : null;
}

function ensureCollections(runtime) {
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.history ??= [];
  runtime.playerState.evidence ??= {};
  runtime.playerState.goapRequests ??= {};
}

function storeEvidence(runtime, choice, now) {
  if (!choice.evidenceId) return;
  runtime.playerState.evidence[choice.evidenceId] = {
    id: choice.evidenceId,
    source: choice.evidenceSource,
    acquiredAtMinute: now,
    missionId: MISSION_ID,
  };
}

function storeGoap(runtime, choice, action, now) {
  if (!choice.goap) return null;
  runtime.playerState.goapRequests[choice.goap.id] = {
    id: choice.goap.id,
    actorNpcId: choice.goap.actorNpcId,
    goal: choice.goap.goal,
    destination: choice.goap.destination,
    status: "active",
    createdAtMinute: now,
    sourceActionId: action.id,
  };
  return choice.goap.id;
}

function consume(runtime, action, result) {
  if (result?.ok === false || !action?.authoredT11WitnessNetworkChoice) return false;
  const scene = currentScene(runtime);
  if (!scene || scene.id !== action.authoredT11WitnessNetworkSceneId) return false;
  const choice = scene.choices.find((entry) => entry.id === action.authoredT11WitnessNetworkChoiceId);
  if (!choice || action.id !== actionId(scene.id, choice.id)) return false;

  ensureCollections(runtime);
  const state = ensureState(runtime);
  const now = minute(runtime);
  const current = player(runtime);
  const allIds = scene.choices.map((entry) => actionId(scene.id, entry.id));
  const closedIds = allIds.filter((id) => id !== action.id);

  current.location = choice.targetLocation;
  current.facilityId = choice.targetFacilityId;
  runtime.playerState.worldFlags[choice.worldFlag] = true;
  storeEvidence(runtime, choice, now);
  const goapRequestId = storeGoap(runtime, choice, action, now);

  state.selectedActionIds.push(action.id);
  state.closedActionIdsByScene[scene.id] = closedIds;
  if (scene === AFTERMATH_SCENE) {
    state.aftermathCompletedAtMinute = now;
  } else {
    state.stage += 1;
    if (choice.preferredResolution) state.preferredResolution = choice.preferredResolution;
    if (scene.stage === 6) state.routePlanCompletedAtMinute = now;
  }

  runtime.playerState.history.push({
    type: choice.historyType,
    minute: now,
    missionId: MISSION_ID,
    troubleId: TROUBLE_ID,
    sceneId: scene.id,
    actionId: action.id,
    closedActionIds: [...closedIds],
    evidenceId: choice.evidenceId ?? null,
    evidenceSource: choice.evidenceSource ?? null,
    targetNpcId: choice.targetNpcId,
    goapRequestId,
    preferredResolution: choice.preferredResolution ?? null,
    location: current.location,
    facilityId: current.facilityId,
  });

  const nextScene = scene === AFTERMATH_SCENE
    ? null
    : SCENES.find((entry) => entry.stage === state.stage)?.id ?? "t11-base-intervention";
  result.summary = choice.summary;
  result.speeches = choice.speeches.map((speech) => ({ ...speech }));
  result.sceneTransition = nextScene;
  result.evidenceId = choice.evidenceId ?? null;
  result.evidenceSource = choice.evidenceSource ?? null;
  result.goapRequestId = goapRequestId;
  result.closedActionIds = [...closedIds];
  result.preferredResolution = choice.preferredResolution ?? null;
  return true;
}

export function authoredMissionFlowExclusiveActions(runtime, context = {}) {
  return actions(runtime) ?? base.authoredMissionFlowExclusiveActions(runtime, context);
}

export function authoredMissionFlowGuidance(runtime) {
  const scene = currentScene(runtime);
  if (scene) {
    return {
      missionId: MISSION_ID,
      kicker: scene.kicker,
      title: scene.title,
      detail: scene.detail,
      targetLocation: scene.location ?? player(runtime).location,
      targetFacilityId: scene.facilityId ?? player(runtime).facilityId,
      actionPanel: null,
    };
  }
  return base.authoredMissionFlowGuidance(runtime);
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  const changed = base.applyAuthoredMissionFlowAction(runtime, action, result);
  return consume(runtime, action, result) || changed;
}

export const AUTHORED_T11_WITNESS_NETWORK_INTERNALS = Object.freeze({
  MISSION_ID,
  TROUBLE_ID,
  CROW_LEDGER,
  SCENES,
  AFTERMATH_SCENE,
  readState,
  ensureState,
  mission,
  terminalT11,
  hasEvidence,
  resolutionRoute,
  currentScene,
  actionId,
  actionFor,
  actions,
  consume,
});
