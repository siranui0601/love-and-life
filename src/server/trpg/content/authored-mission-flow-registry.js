import { resolveMissionStepVariant } from "./mission-step-variant.js";
import { T13_FOREST_KING_SLIME_WORLD_TREE_PACK } from "./authored/missions/t13-forest-king-slime-world-tree-collapse.js";
import { T12_NORTHERN_FORTRESS_FALSE_FLAG_PACK } from "./authored/missions/t12-northern-fortress-false-flag.js";
import { T11_CAPITAL_ASSASSINATION_PLOT_PACK } from "./authored/missions/t11-capital-assassination-plot.js";
import { T10_CAPITAL_ORPHANAGE_EVICTION_PACK } from "./authored/missions/t10-capital-orphanage-eviction.js";
import { T09_DWARF_MINE_COLLAPSE_PACK } from "./authored/missions/t09-dwarf-mine-collapse.js";
import { T08_FOREST_SEALING_ORDER_PACK } from "./authored/missions/t08-forest-sealing-order.js";
import { T07_RUNAWAY_ELF_TRAFFICKING_PACK } from "./authored/missions/t07-runaway-elf-trafficking.js";
import { T06_PORT_LABOR_UNREST_PACK } from "./authored/missions/t06-port-labor-unrest.js";

export const AUTHORED_MISSION_FLOW_VERSION = "authored-mission-flow-v13";

const ACTIVE_TROUBLE_STATUSES = new Set(["active", "critical"]);
const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);

export const AUTHORED_MISSION_FLOW_PACKS = Object.freeze([
  T13_FOREST_KING_SLIME_WORLD_TREE_PACK,
  T12_NORTHERN_FORTRESS_FALSE_FLAG_PACK,
  T11_CAPITAL_ASSASSINATION_PLOT_PACK,
  T10_CAPITAL_ORPHANAGE_EVICTION_PACK,
  T09_DWARF_MINE_COLLAPSE_PACK,
  T08_FOREST_SEALING_ORDER_PACK,
  T07_RUNAWAY_ELF_TRAFFICKING_PACK,
  T06_PORT_LABOR_UNREST_PACK,
  Object.freeze({
    id: "trade-lord-poisoning",
    missionId: "MSN-T05",
    troubleId: "T05",
    title: "交易都市領主の毒殺計画",
    catalogOverride: Object.freeze({
      hearing: Object.freeze({
        targetLocation: "交易都市",
        targetFacilityId: "LOC_TRADE_LORD_MANOR",
        label: "領主館の療養室で、領主付き医師マリエルから倒れる直前の状況を聞く",
      }),
      investigation: Object.freeze({
        required: 3,
      }),
      battle: Object.freeze({
        targetLocation: "交易都市",
        targetFacilityId: "LOC_TRADE_WAREHOUSE",
        encounterId: "ENC-0033",
        label: "倉庫街で毒の帳簿を持ち去る密輸運び屋を止め、ニコラスを保護する",
      }),
      resolution: Object.freeze({
        targetLocation: "交易都市",
        targetFacilityId: "LOC_TRADE_LORD_MANOR",
        label: "領主館の療養室で、解毒と毒殺計画の公表方法を決める",
      }),
    }),
    hearing: Object.freeze({
      stepId: "hear",
      targetLocation: "交易都市",
      targetFacilityId: "LOC_TRADE_LORD_MANOR",
      npcId: "NPC011",
      npcName: "マリエル医師",
      guidance: Object.freeze({
        kicker: "病に見せかけた毒",
        title: "マリエル医師へ、倒れる直前の何から確かめるかを伝える",
        detail: "症状の進み方、最後に口へしたもの、倒れた後に動き始めた後継派では、最初に追える証拠が変わる。",
      }),
      choices: Object.freeze([
        Object.freeze({
          id: "symptoms_and_clock",
          dialogueTopic: "mission_flow_t05_symptoms_and_clock",
          label: "領主が倒れてからの脈、呼吸、体温の変化を時系列で聞く",
          playerUtterance: "病気か毒かを見分けたい。倒れてから、脈と呼吸と体温はどう変わりましたか。",
          requiredDisclosure: "発熱がないまま脈と呼吸だけが弱まり、葡萄酒の残り香に港薬草商では扱わない苦い樹脂臭が混じっていた",
          factId: "T05-FACT-NONNATURAL-POISON",
          unlockedLeadIds: Object.freeze(["bedside_symptoms", "antidote_formula"]),
          minutes: 12,
          narrative: "マリエルは診療記録を分刻みで開き、病の経過では説明できない変化だけを指で追った。熱は上がらず、意識と呼吸だけが静かに奪われている。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC011",
              text: "熱はない。脈と呼吸だけが落ち続け、瞳孔の反応も鈍い。最後の杯には、この港の薬草商が扱わない苦い樹脂臭が残っていた。自然病ではない。",
              emotion: "冷静な焦り",
            }),
          ]),
        }),
        Object.freeze({
          id: "last_cup_route",
          dialogueTopic: "mission_flow_t05_last_cup_route",
          label: "最後の杯を誰が運び、空いた酒瓶と布がどこへ消えたか聞く",
          playerUtterance: "最後の杯に触れた人と、使った瓶や布の行方を順番に教えてください。",
          requiredDisclosure: "杯を運んだ使用人ニコラスは直後に使用人区を離れ、洗浄布と予備瓶を持って倉庫街へ向かった",
          factId: "T05-FACT-NICOLAS-LEFT-FOR-WAREHOUSE",
          unlockedLeadIds: Object.freeze(["service_route", "warehouse_manifest"]),
          minutes: 13,
          narrative: "療養室の出入り記録と使用人の当番表を重ねると、一人だけ持ち場へ戻らなかった。マリエルは責める口調を避けながら、その名を告げる。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC011",
              text: "最後の杯を運んだのはニコラスよ。直後、洗浄布と予備瓶を抱えて倉庫街へ向かった。怯えていたという証言もある。実行した可能性と、自分の意思だったかは分けて調べるべきね。",
              emotion: "慎重",
            }),
          ]),
        }),
        Object.freeze({
          id: "succession_pressure",
          dialogueTopic: "mission_flow_t05_succession_pressure",
          label: "領主が倒れた直後、誰が継承と港の契約を急がせたか聞く",
          playerUtterance: "領主が倒れた直後に、継承や港の契約を急がせた人物はいますか。",
          requiredDisclosure: "セドリックは診断確定前から緊急継承会議と外国船の寄港枠を求め、日付の早い契約草案を商人ギルドへ持ち込んでいた",
          factId: "T05-FACT-CEDRIC-MOVED-BEFORE-DIAGNOSIS",
          unlockedLeadIds: Object.freeze(["succession_draft", "port_meeting"]),
          minutes: 14,
          narrative: "マリエルは医療記録の余白に残した来訪者名を示した。まだ病名さえ決まらない時間に、後継と港の話だけが先へ進んでいる。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC011",
              text: "セドリックは診断が出る前から継承会議を求め、外国船の寄港枠まで話していた。医師の私に死亡時刻の見込みを聞いたほどよ。準備が早すぎる。",
              emotion: "抑えた疑念",
            }),
          ]),
        }),
      ]),
    }),
    investigation: Object.freeze({
      stepId: "investigate",
      requiredEvidenceCount: 3,
      requiredEvidenceIds: Object.freeze([
        "T05-EVIDENCE-ANTIDOTE-FORMULA",
        "T05-EVIDENCE-CRIME-POISON-ROUTE",
        "T05-EVIDENCE-CEDRIC-POISON-ORDER",
      ]),
      initialGuidance: Object.freeze({
        kicker: "毒・運搬・依頼主",
        title: "領主の症状、倉庫へ消えた品、早すぎる継承準備を別々に確かめる",
        detail: "領主を救うには毒の種類と解毒法が必要だ。計画を止めるには犯罪都市からの運搬経路と、セドリックの依頼を示す記録も欠かせない。",
      }),
      continuedGuidance: Object.freeze({
        kicker: "救命と告発を両立する",
        title: "残る証拠から、解毒法・毒の出所・依頼主の空白を埋める",
        detail: "実行した使用人だけを捕らえても毒は消えず、依頼主を残せば再び狙われる。三系統を揃えて初めて領主を救い、次期領主派を止められる。",
      }),
      selectedLeadGuidance: Object.freeze({
        kicker: "選んだ確認先",
        detail: "推測を結論にせず、診療記録、現物、物流記録、契約の写しとして後から照合できる証拠へ変える。",
      }),
      defer: Object.freeze({
        id: "defer",
        label: "毒殺調査をいったん保留し、治療道具と協力者を整える",
        minutes: 5,
        deferMinutes: 180,
        summary: "交易都市領主の毒殺調査を保留した。領主の呼吸は弱まり、後継派の継承準備も進み続ける。",
        narrative: "確認先を記録し、今は別の準備を優先することにした。毒は体内で進み、セドリック側は空いた時間を継承の既成事実へ変えていく。",
      }),
      leads: Object.freeze([
        Object.freeze({
          id: "bedside_symptoms",
          facilityId: "LOC_TRADE_LORD_MANOR",
          destinationName: "領主館の療養室",
          label: "診療記録と杯の残留物から、自然病ではない症状を確定する",
          approachId: "t05-bedside-symptoms",
          discoveryId: "T05-EVIDENCE-POISONED-WINE-SYMPTOMS",
          discoveryText: "発熱を伴わず呼吸と脈だけを落とす症状、杯の縁に残る苦い樹脂、舌の下の青黒い変色が一致した。領主は病ではなく、遅効性の植物毒を葡萄酒から摂取している。",
          unlocksLeadIds: Object.freeze(["antidote_formula", "service_route"]),
          minutes: 29,
          leadNarrative: "マリエルの診療記録を症状ごとに並べ、杯の残留物を湯と銀片で分ける。病名を当てるのではなく、毒が体へ与えている変化を一つずつ固定する。",
        }),
        Object.freeze({
          id: "antidote_formula",
          facilityId: "LOC_TRADE_APOTHECARY",
          destinationName: "港薬草商",
          label: "杯の残留物をルーシーの薬草標本と照合し、解毒処方を組む",
          approachId: "t05-antidote-formula",
          discoveryId: "T05-EVIDENCE-ANTIDOTE-FORMULA",
          discoveryText: "杯の樹脂は犯罪都市で鎮静毒として流通する灰眠樹の濃縮液だった。港薬草商の吸着炭、苦根、青潮苔を順番どおり投与すれば、呼吸停止までの進行を抑えられる。",
          unlocksLeadIds: Object.freeze(["warehouse_manifest", "service_route"]),
          minutes: 37,
          leadNarrative: "ルーシーは港へ入る薬草の標本を棚から下ろし、杯の残留物を少量ずつ反応させる。似た苦味でも、灰眠樹だけが青潮苔に触れた瞬間に白く濁った。",
        }),
        Object.freeze({
          id: "service_route",
          facilityId: "LOC_TRADE_LORD_MANOR",
          destinationName: "領主館の使用人区",
          label: "ニコラスの当番表と消えた洗浄布から、毒を入れた時点を特定する",
          approachId: "t05-service-route",
          discoveryId: "T05-EVIDENCE-NICOLAS-HANDLED-CUP",
          discoveryText: "ニコラスの当番表には本来ない『祝い酒の交換』が追記され、寝台下から灰眠樹の染みが付いた手袋が見つかった。本人の妹を示す似顔札には、犯罪都市の仲介印が押されている。",
          unlocksLeadIds: Object.freeze(["warehouse_manifest", "antidote_formula"]),
          minutes: 33,
          leadNarrative: "使用人を一人ずつ責めるのではなく、当番表、配膳口、洗い場、私物箱の順で杯の経路を戻る。追記された一行と、隠された手袋だけが通常の流れから外れていた。",
        }),
        Object.freeze({
          id: "warehouse_manifest",
          facilityId: "LOC_TRADE_WAREHOUSE",
          destinationName: "倉庫街",
          label: "ニコラスが運んだ予備瓶と、犯罪都市から来た荷札を照合する",
          approachId: "t05-warehouse-manifest",
          discoveryId: "T05-EVIDENCE-CRIME-POISON-ROUTE",
          discoveryText: "予備瓶の底から犯罪都市の黒灯亭を経由した荷札と、灰眠樹濃縮液の重量を偽って記した船荷台帳が見つかった。受取人欄はセドリック家の港倉庫番へつながっている。",
          unlocksLeadIds: Object.freeze(["antidote_formula", "crime_ledger", "port_meeting"]),
          minutes: 41,
          leadNarrative: "酒瓶だけを探さず、同じ日に入った樹脂、染料、薬瓶の重量差を税関控えと比べる。空になったはずの木箱だけが、犯罪都市の船荷番号を残していた。",
        }),
        Object.freeze({
          id: "succession_draft",
          facilityId: "LOC_TRADE_GUILD",
          destinationName: "商人ギルド会館",
          label: "緊急継承案と外国船の寄港契約草案の日付を照合する",
          approachId: "t05-succession-draft",
          discoveryId: "T05-EVIDENCE-PREMATURE-SUCCESSION-DRAFT",
          discoveryText: "セドリックが提出した緊急継承案と外国船の寄港契約草案は、領主が倒れる三日前に清書されていた。死亡時にだけ発効する港湾権の譲渡条項まで用意されている。",
          unlocksLeadIds: Object.freeze(["port_meeting", "warehouse_manifest"]),
          minutes: 35,
          leadNarrative: "ベリルが保管する議事控えと契約草案を、署名ではなく紙の透かしと乾いた順で並べる。倒れた後に作った文書ならあり得ない日付が、下書き側に残っていた。",
        }),
        Object.freeze({
          id: "port_meeting",
          facilityId: "LOC_TRADE_PORT",
          destinationName: "大港湾区",
          label: "セドリック家の使者が犯罪都市便と接触した時刻を港の出入記録で追う",
          approachId: "t05-port-meeting",
          discoveryId: "T05-EVIDENCE-CEDRIC-CRIME-CONTACT",
          discoveryText: "領主が倒れる五日前、セドリック家の使者が犯罪都市便の下船記録を買い取り、情報屋モズと同じ船宿へ入っていた。支払いにはセドリック家の軍費口座が使われている。",
          unlocksLeadIds: Object.freeze(["warehouse_manifest", "crime_ledger"]),
          minutes: 38,
          leadNarrative: "船員の記憶だけに頼らず、係留札、荷役賃、船宿の部屋代を同じ時刻へ重ねる。偽名の使者が残した支払い口座だけは、家名を隠せなかった。",
        }),
        Object.freeze({
          id: "crime_ledger",
          facilityId: "LOC_TRADE_INN",
          destinationName: "潮風宿",
          label: "犯罪都市から来た情報屋モズと接触し、毒の依頼台帳と解毒符号を確保する",
          approachId: "t05-crime-ledger",
          discoveryId: "T05-EVIDENCE-CEDRIC-POISON-ORDER",
          discoveryText: "モズが持ち込んだ依頼台帳の写しには、灰眠樹濃縮液、ニコラスの妹を押さえる費用、領主死亡後の追加報酬が同じ符号で記されていた。照合鍵はセドリック家の港倉庫印だった。",
          unlocksLeadIds: Object.freeze(["warehouse_manifest", "antidote_formula"]),
          minutes: 44,
          leadNarrative: "潮風宿の個室で、モズは台帳そのものではなく三枚の写しを別々に置いた。毒の品名、脅迫の費用、成功報酬を結ぶ符号を解けば、依頼主まで一つの線になる。",
        }),
      ]),
      prematureResolution: Object.freeze({
        id: "blame_nicolas_only",
        label: "ニコラスだけを捕らえ、使用人による単独犯として事件を終わらせる",
        minutes: 23,
        summary: "ニコラスを拘束しても、領主の毒は進み、犯罪都市の供給者と依頼主は残った。確認済みの証拠を保ったまま調査を続けられる。",
        narrative: "手袋と当番表だけを示すと、セドリック側は『使用人一人の逆恨み』として処理しようとした。ニコラスは妹の名を口にして黙り込み、解毒法も依頼主も明らかにならない。実行した手と、脅した者と、毒を運んだ経路を分けて確かめる必要がある。",
      }),
    }),
    postInvestigationGuidance: Object.freeze({
      kicker: "解毒法・犯罪都市の荷・セドリックの依頼",
      title: "領主を救い、毒殺計画を止める三系統の証拠が揃った",
      detail: "倉庫街ではセドリック側の密輸運び屋が残る荷とニコラスを消そうとしている。証拠と証人を守った後、どの方法で解毒と告発を行うか決める。",
    }),
    stepGuidance: Object.freeze({
      battle: Object.freeze({
        kicker: "燃やされる船荷台帳",
        title: "倉庫街の追手を退け、毒の現物とニコラスを守る",
        detail: "密輸運び屋は帳簿を焼き、ニコラスを口封じしようとしている。危険なら装備を整えて戻ることもできるが、領主の容体と証拠は待ってくれない。",
      }),
      resolve: Object.freeze({
        kicker: "救命の代償と告発の形",
        title: "領主館で、解毒とセドリック失脚の方法を一つ選ぶ",
        detail: "ニコラスの証言、犯罪都市の解毒薬、王都の医師は、いずれも領主を救える。ただし、誰を守り、誰へ借りを作り、交易都市の中立をどこまで残すかが変わる。",
      }),
    }),
    resolution: Object.freeze({
      stepId: "resolve",
      choices: Object.freeze([
        Object.freeze({
          id: "protect_nicolas_and_treat",
          label: "ニコラスと妹を保護し、正確な投与量を証言させてマリエルが解毒する",
          minutes: 68,
          summary: "ニコラスと妹の安全を確保し、本人の証言と現物から解毒処方を完成させ、領主を救命した。",
          narrative: "ニコラスへ処罰の免除ではなく、妹を先に保護し、強要された経緯も含めて証言する機会を示した。彼は毒の濃度と投与時刻を話し、マリエルは吸着炭、苦根、青潮苔を順に投与する。夜明け前、領主の呼吸は自力へ戻り、セドリックの依頼書は封印された証拠として残った。",
          worldEffect: Object.freeze({
            flagKey: "t05ResolutionRoute",
            factId: "player:T05:nicolas-protected-antidote-administered",
            text: "ニコラスと妹は保護され、正確な毒の証言に基づく解毒で領主が生還し、セドリックの毒殺指示が立証された",
            facilityId: "LOC_TRADE_LORD_MANOR",
            propagationDelayHours: 2,
            aftermathPlans: Object.freeze([
              Object.freeze({
                id: "t05-protect-mariel-recovery-watch",
                npcIds: Object.freeze(["NPC011"]),
                goal: "monitor-lord-recovery",
                action: "monitor-lord-recovery",
                targetHub: "交易都市",
                targetFacilityId: "LOC_TRADE_LORD_MANOR",
                delayHours: 0,
                statusText: "領主の呼吸と解毒後の臓器反応を見守っている",
                reason: "physician-monitors-antidote-recovery",
              }),
              Object.freeze({
                id: "t05-protect-nicolas-testimony",
                npcIds: Object.freeze(["NPC012"]),
                goal: "give-protected-poison-testimony",
                action: "give-protected-poison-testimony",
                targetHub: "交易都市",
                targetFacilityId: "LOC_TRADE_LORD_MANOR",
                delayHours: 1,
                statusText: "妹の保護を確認し、毒の受け渡しと脅迫について証言している",
                reason: "coerced-servant-gives-protected-testimony",
              }),
            ]),
            followups: Object.freeze([
              Object.freeze({
                id: "mariel-stable-breath",
                npcId: "NPC011",
                narrative: "療養室では窓が細く開けられ、領主の呼吸に合わせて薬湯の湯気が揺れている。マリエルは脈を取りながら、投与時刻と反応を新しい頁へ記していた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC011",
                    text: "自力呼吸へ戻った。まだ数日は油断できないけれど、毒の進行は止まっている。ニコラスの証言が濃度まで正確だったから、必要以上に強い薬を使わずに済んだ。",
                    emotion: "疲労した安堵",
                  }),
                ]),
              }),
              Object.freeze({
                id: "nicolas-protected-testimony",
                npcId: "NPC012",
                narrative: "使用人区の小部屋には護衛が立ち、ニコラスの前には毒瓶、荷札、証言書が別々に置かれている。彼は何度も妹の無事を確かめてから、署名欄へ手を伸ばした。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC012",
                    text: "僕が杯へ入れました。妹を犯罪都市で押さえたと言われて……でも、領主様を殺しかけた事実は消えません。誰に渡され、どこへ瓶を捨てたか、全部話します。",
                    emotion: "恐怖と覚悟",
                  }),
                ]),
              }),
            ]),
          }),
        }),
        Object.freeze({
          id: "buy_crime_ledger_antidote",
          label: "モズから犯罪都市の解毒薬と原本台帳を買い取り、裏社会の経路ごとセドリックを崩す",
          minutes: 54,
          summary: "情報屋モズから解毒薬と依頼台帳の原本を買い取り、領主を救命してセドリックの毒殺契約を立証した。",
          narrative: "モズは金貨と引き換えに、灰眠樹用の中和薬と、犯罪都市に残る依頼台帳の原本を渡した。マリエルが成分を確かめて投与すると、領主の呼吸は安定する。セドリックは原本の符号と港倉庫印から逃れられなくなったが、犯罪都市の情報網は高額な報酬と台帳の写しを手元へ残した。",
          worldEffect: Object.freeze({
            flagKey: "t05ResolutionRoute",
            factId: "player:T05:crime-antidote-ledger-purchased",
            text: "犯罪都市の解毒薬と依頼台帳が買い取られ、領主は生還してセドリックの契約が立証されたが、裏社会の情報網は報酬と写しを得た",
            facilityId: "LOC_TRADE_INN",
            propagationDelayHours: 3,
            aftermathPlans: Object.freeze([
              Object.freeze({
                id: "t05-buy-moz-ledger-brokerage",
                npcIds: Object.freeze(["NPC049"]),
                goal: "close-poison-ledger-brokerage",
                action: "close-poison-ledger-brokerage",
                targetHub: "交易都市",
                targetFacilityId: "LOC_TRADE_INN",
                delayHours: 0,
                statusText: "毒の依頼台帳を売った後の口止めと情報価格を調整している",
                reason: "informant-closes-poison-ledger-sale",
              }),
              Object.freeze({
                id: "t05-buy-mariel-verify-antidote",
                npcIds: Object.freeze(["NPC011"]),
                goal: "verify-black-market-antidote",
                action: "verify-black-market-antidote",
                targetHub: "交易都市",
                targetFacilityId: "LOC_TRADE_LORD_MANOR",
                delayHours: 0,
                statusText: "犯罪都市製の中和薬を検査し、領主の回復を監視している",
                reason: "physician-verifies-black-market-antidote",
              }),
            ]),
            followups: Object.freeze([
              Object.freeze({
                id: "moz-kept-a-copy",
                npcId: "NPC049",
                narrative: "潮風宿の窓際で、モズは空になった薬箱を指先で回している。原本を渡したはずの台帳について問うと、羽毛の間から薄い写しの角が一瞬だけ見えた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC049",
                    text: "領主は助かった、依頼主も割れた、俺は正当な情報料を得た。皆うれしい結末だろ？　写しまで全部燃やせって契約じゃなかった。情報屋が無一文の善人になったら、次の情報が届かないからな。",
                    emotion: "軽薄な満足",
                  }),
                ]),
              }),
              Object.freeze({
                id: "mariel-tested-antidote",
                npcId: "NPC011",
                narrative: "マリエルの薬台には、買い取った中和薬を分けた小瓶と、港薬草商の標本が並んでいる。未知の薬をそのまま使わず、領主の血液反応を確かめた記録が残されていた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC011",
                    text: "中和薬は本物だった。だからといって犯罪都市を信頼したわけではない。成分を割り出したから、次からは同じ毒に金貨で命を買い戻さずに済む。",
                    emotion: "冷静な警戒",
                  }),
                ]),
              }),
            ]),
          }),
        }),
        Object.freeze({
          id: "royal_physician_public_indictment",
          label: "証拠を王都へ送り、宮廷医師の治療と公開審問でセドリックを失脚させる",
          minutes: 132,
          summary: "王都へ証拠を送り宮廷医師の治療で領主を救命し、公開審問でセドリックを失脚させた。",
          narrative: "毒の成分表、船荷台帳、依頼記録の写しを同時に王都へ送り、宮廷医師と監察官を迎えた。医師の強い解毒処置で領主は危機を越え、公開審問ではセドリックの港倉庫印と外国船契約が読み上げられる。毒殺計画は公に崩れた一方、王都の監察官は交易都市の政務と港湾帳簿へ長く留まる権限を得た。",
          worldEffect: Object.freeze({
            flagKey: "t05ResolutionRoute",
            factId: "player:T05:royal-physician-public-indictment",
            text: "宮廷医師が領主を救命し公開審問でセドリックは失脚したが、王都監察官が交易都市の政務と港湾監査へ関与するようになった",
            facilityId: "LOC_TRADE_LORD_MANOR",
            propagationDelayHours: 4,
            aftermathPlans: Object.freeze([
              Object.freeze({
                id: "t05-royal-orlven-limit-oversight",
                npcIds: Object.freeze(["NPC009"]),
                goal: "limit-royal-oversight",
                action: "limit-royal-oversight",
                targetHub: "交易都市",
                targetFacilityId: "LOC_TRADE_LORD_MANOR",
                delayHours: 2,
                statusText: "療養しながら王都監察官の権限と期限を交渉している",
                reason: "surviving-lord-defends-city-neutrality",
              }),
              Object.freeze({
                id: "t05-royal-beryl-audit-contracts",
                npcIds: Object.freeze(["NPC014"]),
                goal: "audit-foreign-contracts",
                action: "audit-foreign-contracts",
                targetHub: "交易都市",
                targetFacilityId: "LOC_TRADE_GUILD",
                delayHours: 1,
                statusText: "セドリック派が先に結んだ外国船契約を洗い直している",
                reason: "guild-master-audits-poison-plot-contracts",
              }),
            ]),
            followups: Object.freeze([
              Object.freeze({
                id: "orlven-neutrality-negotiation",
                npcId: "NPC009",
                narrative: "領主館の寝台脇には薬瓶と政務書類が同じ高さに積まれている。オルヴェン領主はまだ起き上がれないまま、王都監察官が提出した権限書へ修正線を引いていた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC009",
                    text: "命を救われた恩は忘れない。だが、その恩を港の支配権へ替えさせるわけにもいかない。セドリックを退けた今こそ、交易都市が誰の属領でもないと示さねばならん。",
                    emotion: "弱さの中の決意",
                  }),
                ]),
              }),
              Object.freeze({
                id: "beryl-contract-audit",
                npcId: "NPC014",
                narrative: "商人ギルド会館では、外国船との契約束が発効日ごとに分けられ、セドリック派の印がある頁へ赤い糸が通されている。ベリルは損失額を計算しながら、破棄できる条項を選んでいた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC014",
                    text: "感情で契約は消えません。毒殺計画に結び付いた条項だけを確実に無効化し、港を止めずに次期領主派の資金を切ります。王都の監察にも、数字で期限を示しましょう。",
                    emotion: "冷徹な実務",
                  }),
                ]),
              }),
            ]),
          }),
        }),
      ]),
    }),
  }),
  Object.freeze({
    id: "pilgrim-transfer-disappearance",
    missionId: "MSN-T04",
    troubleId: "T04",
    title: "古代神殿の巡礼者失踪",
    catalogOverride: Object.freeze({
      hearing: Object.freeze({
        targetLocation: "古代神殿",
        targetFacilityId: "LOC_TEMPLE_ADMIN",
        label: "管理棟で、巡礼者失踪の記録を管理者ファルコから聞く",
      }),
      investigation: Object.freeze({
        required: 3,
      }),
      battle: Object.freeze({
        targetLocation: "古代神殿",
        targetFacilityId: "LOC_TEMPLE_CORRIDOR",
        encounterId: "ENC-0061",
        label: "白石回廊に残る転移残響を鎮め、地下への経路を開く",
      }),
      resolution: Object.freeze({
        targetLocation: "古代神殿",
        targetFacilityId: "LOC_TEMPLE_SEALED",
        label: "地下封印区画で、失踪者と転移装置への最終対応を決める",
      }),
    }),
    hearing: Object.freeze({
      stepId: "hear",
      targetLocation: "古代神殿",
      targetFacilityId: "LOC_TEMPLE_ADMIN",
      npcId: "NPC053",
      npcName: "ファルコ",
      guidance: Object.freeze({
        kicker: "消えた巡礼者と閉じた記録簿",
        title: "管理者ファルコへ、何を先に明らかにするかを伝える",
        detail: "消えた場所の共通点、伏せられた報告、Day1以降に起きた装置の変化では、追うべき証拠が異なる。",
      }),
      choices: Object.freeze([
        Object.freeze({
          id: "disappearance_pattern",
          dialogueTopic: "mission_flow_t04_disappearance_pattern",
          label: "失踪者が最後に確認された場所と、巡礼の列順を聞く",
          playerUtterance: "消えた人たちは、最後にどこで確認されましたか。歩いていた順番も教えてください。",
          requiredDisclosure: "失踪者は全員、白石回廊の同じ曲がり角で列から消え、先頭と最後尾の者は異変に気づかなかった",
          factId: "T04-FACT-SAME-CORRIDOR-GAP",
          unlockedLeadIds: Object.freeze(["pilgrim_route", "corridor_resonance"]),
          minutes: 12,
          narrative: "ファルコは巡礼団ごとの名簿を重ね、失踪者の名へ細い印を置いた。年齢も出身も違うのに、最後に記録された場所だけは同じだった。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC053",
              text: "全員、白石回廊の第三曲がりだ。列の中央にいた者だけが消え、前後を歩いた者は振り返るまで気づかなかった。偶然で片づけられる数ではない。",
              emotion: "苦い警戒",
            }),
          ]),
        }),
        Object.freeze({
          id: "concealed_reports",
          dialogueTopic: "mission_flow_t04_concealed_reports",
          label: "失踪が続いているのに、なぜ神殿を閉じなかったのか問いただす",
          playerUtterance: "同じ場所で何人も消えたのに、なぜ回廊を閉じず、王都にも公表しなかったんですか。",
          requiredDisclosure: "ファルコは辺境の村の巡礼収入が絶えることを恐れ、失踪報告を管理棟の内部記録へ留めていた",
          factId: "T04-FACT-REPORTS-CONCEALED",
          unlockedLeadIds: Object.freeze(["concealed_records", "family_diary"]),
          minutes: 14,
          narrative: "問いを向けると、ファルコは机上の鍵束を握り込んだ。神殿の安全より村の暮らしを守ったと言いたいのだろうが、その判断で失踪者は増えている。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC053",
              text: "神殿を閉じれば、辺境の村は宿も店も立ち行かぬ。王都へ正式に出せば即日封鎖だ。だから内部記録へ留めた。守ったつもりだったが、結果はこの有様だ。",
              emotion: "保身と後悔",
            }),
          ]),
        }),
        Object.freeze({
          id: "day1_anomaly",
          dialogueTopic: "mission_flow_t04_day1_anomaly",
          label: "Day1の召喚失敗後、神殿内で何が変わったのか聞く",
          playerUtterance: "王都の召喚が失敗した日から、回廊や地下装置に変化はありませんでしたか。",
          requiredDisclosure: "Day1の夜から白石回廊の古代文字が淡く光り、床下の機械音と短い冷気が記録され始めた",
          factId: "T04-FACT-ACTIVE-SINCE-DAY1",
          unlockedLeadIds: Object.freeze(["corridor_resonance", "concealed_records"]),
          minutes: 13,
          narrative: "ファルコは古い巡回記録を開き、ある日を境に増えた余白の書き込みを示した。光、機械音、冷気。どれもDay1以前の頁にはない。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC053",
              text: "Day1の夜からだ。白石回廊の文字が光り、床下で歯車のような音がした。巡回兵は冷気を感じたとも書いている。召喚との関係は認めたくなかった。",
              emotion: "動揺",
            }),
          ]),
        }),
      ]),
    }),
    investigation: Object.freeze({
      stepId: "investigate",
      requiredEvidenceCount: 3,
      requiredEvidenceIds: Object.freeze([
        "T04-EVIDENCE-CORRIDOR-TRANSFER-GLYPH",
        "T04-EVIDENCE-REPORTS-AFTER-DAY1",
      ]),
      initialGuidance: Object.freeze({
        kicker: "人が消える一点",
        title: "証言を、巡礼者の足取り・回廊の痕跡・管理記録で確かめる",
        detail: "一人の思い込みではなく、現場の転移痕とDay1以降の記録を必ず含む三系統の証拠を揃える。",
      }),
      continuedGuidance: Object.freeze({
        kicker: "呪いではなく装置の作動を示す",
        title: "残る証拠から、失踪地点と起動時期を独立して裏づける",
        detail: "白石回廊の転移痕と、Day1以降に異常が始まった管理記録は、地下装置へ進むために欠かせない。",
      }),
      selectedLeadGuidance: Object.freeze({
        kicker: "選んだ確認先",
        detail: "証言だけで結論を出さず、現場・記録・失踪者側の残したものが一致するかを確かめる。",
      }),
      defer: Object.freeze({
        id: "defer",
        label: "失踪調査をいったん保留し、装備と協力者を整える",
        minutes: 5,
        deferMinutes: 240,
        summary: "古代神殿の失踪調査を保留した。その間も巡礼者の入場と転移異常は止まらない。",
        narrative: "確認先を記録し、今は神殿を離れることにした。回廊の異常は待ってくれず、新しい巡礼団が到着すれば被害が増える可能性がある。",
      }),
      leads: Object.freeze([
        Object.freeze({
          id: "pilgrim_route",
          facilityId: "LOC_TEMPLE_REST",
          destinationName: "巡礼者休憩所",
          label: "巡礼団の列順と帰還者の証言から、消えた瞬間を組み直す",
          approachId: "t04-pilgrim-route",
          discoveryId: "T04-EVIDENCE-SAME-PROCESSION-GAP",
          discoveryText: "三つの巡礼団の列順を重ねると、失踪者はいずれも白石回廊の第三曲がりで中央の一人だけが抜け落ちていた。前後の者は光も悲鳴も見ておらず、足音だけが一歩分途切れている。",
          unlocksLeadIds: Object.freeze(["corridor_resonance", "family_diary"]),
          minutes: 31,
          leadNarrative: "休憩所の宿帳と巡礼団長の控えを並べ、出発時と帰還時の列を一人ずつ照合する。人数が減った場所を地図へ落とすと、印は一か所へ重なった。",
        }),
        Object.freeze({
          id: "corridor_resonance",
          facilityId: "LOC_TEMPLE_CORRIDOR",
          destinationName: "白石回廊",
          label: "第三曲がりの古代文字と、途切れた足跡の内側を調べる",
          approachId: "t04-corridor-transfer-glyph",
          discoveryId: "T04-EVIDENCE-CORRIDOR-TRANSFER-GLYPH",
          discoveryText: "白い粉を払うと円環状の古代文字が淡く点灯し、その内側で足跡が途切れていた。床石の継ぎ目から冷気が吹き、地下へ向かう魔力の脈動が一定間隔で返ってくる。",
          unlocksLeadIds: Object.freeze(["concealed_records", "pilgrim_route"]),
          minutes: 38,
          leadNarrative: "第三曲がりを通行止めにし、失踪者の足跡が終わった床石を一枚ずつ確かめる。光る文字の輪は装飾ではなく、踏み込んだものを囲う配置になっていた。",
        }),
        Object.freeze({
          id: "concealed_records",
          facilityId: "LOC_TEMPLE_ADMIN",
          destinationName: "管理棟の記録庫",
          label: "封印された巡回簿を開き、異常の開始日と失踪記録を照合する",
          approachId: "t04-concealed-records",
          discoveryId: "T04-EVIDENCE-REPORTS-AFTER-DAY1",
          discoveryText: "封印箱の巡回簿には、Day1の夜を境に発光・機械音・冷気が記録され、その後の失踪者全員が白石回廊の同一区画へ結び付けられていた。正式報告欄だけが空白にされている。",
          unlocksLeadIds: Object.freeze(["corridor_resonance", "family_diary"]),
          minutes: 35,
          leadNarrative: "ファルコの鍵で記録庫の封印箱を開く。公開用の薄い日誌ではなく、警備兵と案内人が署名した巡回簿を日付順に追う。",
        }),
        Object.freeze({
          id: "family_diary",
          facilityId: "LOC_BORDER_SMALL_SHRINE",
          targetLocation: "辺境の村",
          destinationName: "小祠",
          label: "失踪者エイダの日記から、回廊で見た光と機械音を確かめる",
          approachId: "t04-eida-diary",
          discoveryId: "T04-EVIDENCE-EDA-DIARY-GLYPH",
          discoveryText: "エイダの日記には、白石回廊の文字が足元で輪になり、祈りの鐘とは違う機械音が床下から三度響いたとある。最後の頁には、同じ印を写した簡単な図が残されている。",
          unlocksLeadIds: Object.freeze(["corridor_resonance", "concealed_records"]),
          minutes: 44,
          regionalNarrative: "参道を下り、辺境の村へ着いた。失踪者の家族が祈る小祠は、宿場の喧騒から少し外れた場所にある。",
          leadNarrative: "小祠で待つ姉から、エイダが巡礼前夜まで書いていた日記を預かる。信仰の言葉と、本人が実際に見た現象を分けながら最後の頁を読む。",
        }),
      ]),
      prematureResolution: Object.freeze({
        id: "curse-only",
        label: "共通する回廊だけを根拠に、神殿の呪いとして全面封鎖を求める",
        minutes: 24,
        summary: "場所の一致だけでは、管理棟も王都も呪いによる封鎖を受け入れなかった。集めた証拠は残るが、装置の作動と開始時期を示す必要がある。",
        narrative: "白石回廊を閉じるよう訴えたが、ファルコは『古い神殿では噂だけで人が遠のく』と退けた。失踪地点の共通性は重要だが、地下装置とDay1以降の異常を結びつけなければ決定打にならない。",
      }),
    }),
    postInvestigationGuidance: Object.freeze({
      kicker: "転移先は地下封印区画",
      title: "白石回廊の転移残響を鎮め、地下装置へ進む",
      detail: "現場の文字と管理記録は、巡礼者が消滅したのではなく地下へ転送された可能性を示す。残響を退けて経路を安定させる。",
    }),
    stepGuidance: Object.freeze({
      battle: Object.freeze({
        kicker: "白石回廊に残る転移の反射",
        title: "転移残響を鎮め、失踪者の座標へ続く脈動を確保する",
        detail: "残響は古代装置の防衛反応に近い。勝てない場合は撤退し、装備を整えて戻ることができる。",
      }),
      resolve: Object.freeze({
        kicker: "止めるだけか、救い出すか",
        title: "地下封印区画で、転移装置と失踪者への優先順位を決める",
        detail: "救出を先に行うほど時間と危険は増える。即時封鎖は新しい被害を止めるが、転移済みの人々を残す。記録公開は隠蔽を防ぐ代わりに神殿運営を揺らす。",
      }),
    }),
    resolution: Object.freeze({
      stepId: "resolve",
      choices: Object.freeze([
        Object.freeze({
          id: "recover_then_pause",
          label: "転移座標を封印区画へ固定し、生存者を救出してから装置を停止する",
          minutes: 92,
          summary: "転移先を地下封印区画へ固定し、生存していた巡礼者を引き戻してから装置を停止した。",
          narrative: "回廊と地下の文字列を同じ順に点灯させ、転移の出口を封印区画へ固定した。冷気の中から倒れた巡礼者たちを一人ずつ運び出し、最後に魔力供給を断つ。白石回廊の文字は静かに消えた。",
          worldEffect: Object.freeze({
            flagKey: "t04ResolutionRoute",
            factId: "player:T04:pilgrims-recovered-device-paused",
            text: "古代神殿の転移先から生存巡礼者が救出され、白石回廊の転移装置は停止した",
            facilityId: "LOC_TEMPLE_SEALED",
            propagationDelayHours: 3,
            aftermathPlans: Object.freeze([
              Object.freeze({
                id: "t04-recover-falco-survivor-care",
                npcIds: Object.freeze(["NPC053"]),
                goal: "coordinate-survivor-care",
                action: "coordinate-survivor-care",
                targetHub: "古代神殿",
                targetFacilityId: "LOC_TEMPLE_REST",
                delayHours: 0,
                statusText: "救出された巡礼者の受け入れを指揮している",
                reason: "temple-administrator-cares-for-recovered-pilgrims",
              }),
              Object.freeze({
                id: "t04-recover-eida-recovery",
                npcIds: Object.freeze(["NPC055"]),
                goal: "recover-after-transfer",
                action: "recover-after-transfer",
                targetHub: "古代神殿",
                targetFacilityId: "LOC_TEMPLE_REST",
                delayHours: 2,
                statusText: "転移から戻った体を休め、家族へ経緯を残している",
                reason: "rescued-pilgrim-recovers-and-records-testimony",
              }),
            ]),
            followups: Object.freeze([
              Object.freeze({
                id: "falco-survivor-care",
                npcId: "NPC053",
                narrative: "休憩所には毛布と湯が運び込まれ、救出された巡礼者の名が一人ずつ確認されている。ファルコは管理者の机ではなく、負傷者のそばで記録を取っていた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC053",
                    text: "戻れた者は全員、家族へ引き合わせる。戻れなかった者の記録も消さない。装置を止めたことより、止めるまで被害を隠した責任の方が重い。",
                    emotion: "疲労と決意",
                  }),
                ]),
              }),
              Object.freeze({
                id: "eida-testimony",
                npcId: "NPC055",
                narrative: "エイダは毛布を肩まで引き寄せ、震える指で日記の空白へ短い文を書き足している。回廊で途切れた本人の時間が、ようやく家族へ続き直した。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC055",
                    text: "冷たい暗闇の中で、鐘の音だけを数えていました。日記を残していたから、あなたが私たちの場所を見つけられたんですね。今度は、戻れなかった人のことも書きます。",
                    emotion: "安堵と震え",
                  }),
                ]),
              }),
            ]),
          }),
        }),
        Object.freeze({
          id: "emergency_seal",
          label: "地下への魔力供給を直ちに断ち、新たな転移を止めて神殿を封鎖する",
          minutes: 48,
          summary: "転移装置への魔力供給を即座に断ち、新しい失踪を止めて神殿を封鎖した。",
          narrative: "失踪者の座標を追う前に、装置へ続く魔力導管を切り離した。回廊の光は消え、新しい転移は止まる。封印区画に残された人々の状態は確認できないまま、正門には閉鎖の札が掛けられた。",
          worldEffect: Object.freeze({
            flagKey: "t04ResolutionRoute",
            factId: "player:T04:emergency-seal-before-recovery",
            text: "古代神殿は緊急封鎖され、新しい失踪は止まったが、転移済み巡礼者の安否確認は後回しになった",
            facilityId: "LOC_TEMPLE_GATE",
            propagationDelayHours: 2,
            aftermathPlans: Object.freeze([
              Object.freeze({
                id: "t04-seal-falco-gate-watch",
                npcIds: Object.freeze(["NPC053"]),
                goal: "maintain-emergency-seal",
                action: "maintain-emergency-seal",
                targetHub: "古代神殿",
                targetFacilityId: "LOC_TEMPLE_GATE",
                delayHours: 0,
                statusText: "正門の封鎖と地下の魔力監視を続けている",
                reason: "temple-administrator-maintains-emergency-seal",
              }),
              Object.freeze({
                id: "t04-seal-sana-missing-ledger",
                npcIds: Object.freeze(["NPC054"]),
                goal: "register-unrecovered-pilgrims",
                action: "register-unrecovered-pilgrims",
                targetHub: "古代神殿",
                targetFacilityId: "LOC_TEMPLE_ADMIN",
                delayHours: 1,
                statusText: "救出未了の巡礼者名簿を家族ごとに整理している",
                reason: "temple-guide-keeps-unrecovered-pilgrims-visible",
              }),
            ]),
            followups: Object.freeze([
              Object.freeze({
                id: "falco-emergency-seal",
                npcId: "NPC053",
                narrative: "正門の内側には二重の鎖が渡され、封鎖札の横へ失踪者名簿が掲げられている。ファルコは地下から伝わる振動を測る砂時計を、一度も視界から外さない。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC053",
                    text: "新しい失踪は止まった。だが、地下へ残した者まで救えたことにはならない。封鎖を『解決』と呼んで名簿を片づける者が出ないよう、私がここに立つ。",
                    emotion: "険しい自責",
                  }),
                ]),
              }),
              Object.freeze({
                id: "sana-unrecovered-ledger",
                npcId: "NPC054",
                narrative: "管理棟では、戻った者と戻っていない者を別の紙へ分けず、一冊の名簿に並べている。サナは家族の連絡先と、最後に確認された列順を余白へ書き込んでいた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC054",
                    text: "家族には、新しい転移が止まったことと、救出が終わっていないことを分けて伝えています。安心させるために、いない人を終わったことにはできません。",
                    emotion: "静かな緊張",
                  }),
                ]),
              }),
            ]),
          }),
        }),
        Object.freeze({
          id: "open_records_and_oversee",
          label: "装置を安全停止し、隠されていた記録を公開して外部監査へ引き渡す",
          minutes: 76,
          summary: "転移装置を安全停止し、失踪記録とDay1以降の異常記録を公開して外部監査へ渡した。",
          narrative: "装置を最低出力まで落として停止させ、巡回簿と転移文字の写しを複数の証人へ渡した。管理棟だけでは記録を消せない。神殿は調査のため休止となり、失踪とDay1の召喚余波を結ぶ証拠が公に残った。",
          worldEffect: Object.freeze({
            flagKey: "t04ResolutionRoute",
            factId: "player:T04:records-open-independent-oversight",
            text: "古代神殿の転移装置は安全停止し、隠されていた失踪記録は公開されて外部監査の対象になった",
            facilityId: "LOC_TEMPLE_ADMIN",
            propagationDelayHours: 4,
            aftermathPlans: Object.freeze([
              Object.freeze({
                id: "t04-open-falco-submit-records",
                npcIds: Object.freeze(["NPC053"]),
                goal: "submit-concealed-records",
                action: "submit-concealed-records",
                targetHub: "古代神殿",
                targetFacilityId: "LOC_TEMPLE_ADMIN",
                delayHours: 0,
                statusText: "隠していた巡回簿を監査人へ引き渡している",
                reason: "temple-administrator-submits-concealed-records",
              }),
              Object.freeze({
                id: "t04-open-luca-crosscheck-day1",
                npcIds: Object.freeze(["NPC056"]),
                goal: "crosscheck-day1-records",
                action: "crosscheck-day1-records",
                targetHub: "古代神殿",
                targetFacilityId: "LOC_TEMPLE_ADMIN",
                delayHours: 3,
                statusText: "公開記録とDay1の術式資料を照合している",
                reason: "former-researcher-crosschecks-public-records",
              }),
            ]),
            followups: Object.freeze([
              Object.freeze({
                id: "falco-records-open",
                npcId: "NPC053",
                narrative: "管理棟の扉は開かれ、写しを取る監査人と家族が同じ机を囲んでいる。ファルコの印章は机上の封筒へ納められ、本人は質問に一つずつ答えていた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC053",
                    text: "私の判断も、巡回簿の空白も、全部読める形で残した。神殿を守るためという言葉で記録を閉じれば、次も同じことをする。管理者を続けられるかは、監査の後に決まればいい。",
                    emotion: "覚悟",
                  }),
                ]),
              }),
              Object.freeze({
                id: "luca-day1-crosscheck",
                npcId: "NPC056",
                narrative: "ルカは公開された巡回簿の発光時刻と、持ち出していたDay1の術式写しを交互に確認している。別々に隠されていた記録が、同じ異常の輪郭を作り始めた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC056",
                    text: "召喚失敗の余波が神殿の転移系へ流れた時刻と、最初の発光記録が一致する。記録が公開されたから、ようやく仮説ではなく検証として残せる。",
                    emotion: "集中",
                  }),
                ]),
              }),
            ]),
          }),
        }),
      ]),
    }),
  }),
  Object.freeze({
    id: "red-fang-migration",
    missionId: "MSN-T03",
    troubleId: "T03",
    title: "赤牙狼の群れの南下",
    catalogOverride: Object.freeze({
      hearing: Object.freeze({
        targetLocation: "田園の村",
        targetFacilityId: "LOC_FARM_CHIEF",
        label: "村長宅で、赤牙狼の被害が広がった経緯を聞く",
      }),
      investigation: Object.freeze({
        required: 2,
      }),
      battle: Object.freeze({
        targetLocation: "田園の村",
        targetFacilityId: "LOC_FARM_EDGE",
        encounterId: "ENC-0005",
        encounterIdByTroubleStatus: Object.freeze({
          active: "ENC-0005",
          critical: "ENC-0006",
        }),
        labelByTroubleStatus: Object.freeze({
          active: "村外れへ先行した赤牙狼を街道から退ける",
          critical: "村外れを襲う群れ親と成狼を食い止める",
        }),
        label: "村外れへ南下した赤牙狼を街道から退ける",
      }),
      resolution: Object.freeze({
        targetLocation: "森",
        targetFacilityId: "LOC_FOREST_CAMP",
        label: "狩人の野営地で、群れの退路と大型魔獣の監視方法を決める",
      }),
    }),
    hearing: Object.freeze({
      stepId: "hear",
      targetLocation: "田園の村",
      targetFacilityId: "LOC_FARM_CHIEF",
      npcId: "NPC003",
      npcName: "ガロ村長",
      guidance: Object.freeze({
        kicker: "近づいてくる赤い牙",
        title: "村長宅で、家畜被害の何から確かめるかを伝える",
        detail: "被害の順序、傷の残り方、追い払いに失敗した方向では、次に会う相手も向かう場所も変わる。",
      }),
      choices: Object.freeze([
        Object.freeze({
          id: "attack_order",
          dialogueTopic: "mission_flow_t03_attack_order",
          label: "最初に襲われた家畜と、その後の被害の順序を聞く",
          playerUtterance: "最初に襲われたのは、どこの家畜ですか。被害が起きた順に教えてください。",
          requiredDisclosure: "被害は森寄りの放牧地から馬小屋へ移り、夜ごとに村の家並みへ近づいている",
          factId: "T03-FACT-ATTACKS-MOVING-INWARD",
          unlockedLeadIds: Object.freeze(["livestock_timeline", "wound_pattern"]),
          minutes: 12,
          narrative: "村長は机の上へ村の略図を広げ、被害のあった夜ごとに小石を置いた。点はばらばらではなく、森寄りの放牧地から村の中心へ一本の線を作っていく。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC003",
              text: "最初は森寄りの放牧地だ。次が外柵、その次が馬小屋。夜ごとに家並みへ寄ってきている。牧場主が被害の時刻を全部控えているはずだ。",
              emotion: "警戒",
            }),
          ]),
        }),
        Object.freeze({
          id: "feeding_pattern",
          dialogueTopic: "mission_flow_t03_feeding_pattern",
          label: "狼は家畜を食べたのか、傷つけただけなのかを聞く",
          playerUtterance: "襲われた家畜は食べられていましたか。それとも、噛まれただけですか。",
          requiredDisclosure: "多くの家畜は食べられず、縄と柵だけが噛み切られ、狼も何かから逃げるように荒れていた",
          factId: "T03-FACT-PANICKED-NOT-HUNTING",
          unlockedLeadIds: Object.freeze(["wound_pattern", "forest_displacement"]),
          minutes: 11,
          narrative: "村長は、負傷した家畜を診た薬草婆の報告書を机へ広げた。食われた跡は少なく、浅い噛み傷と切れた縄の記録ばかりが並んでいる。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC003",
              text: "ほとんど食われていない。縄や柵を噛み切り、家畜を散らしただけだ。薬草婆も『獲物を仕留める噛み方ではない』と言っていた。",
              emotion: "困惑",
            }),
          ]),
        }),
        Object.freeze({
          id: "failed_drive",
          dialogueTopic: "mission_flow_t03_failed_drive",
          label: "村人が追い払った時、群れがどちらへ逃げたかを聞く",
          playerUtterance: "追い払おうとした時、群れは森へ戻りましたか。逃げた方向を知りたいです。",
          requiredDisclosure: "群れは森の奥へ戻らず街道沿いを南へ逃げ、森の猟師は狼より大きな足跡を見つけている",
          factId: "T03-FACT-PACK-DRIVEN-SOUTH",
          unlockedLeadIds: Object.freeze(["forest_displacement", "livestock_timeline"]),
          minutes: 13,
          narrative: "追い払いに出た村人の配置を指でたどると、狼は安全な森奥ではなく、人の匂いが残る街道へ逃げていた。村長は森の猟師から届いた短い伝言を添える。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC003",
              text: "森へ押し返したつもりが、群れは街道沿いを南へ走った。猟師の伝言には『狼を追う、もっと大きな跡がある』とだけ書かれている。",
              emotion: "焦り",
            }),
          ]),
        }),
      ]),
    }),
    investigation: Object.freeze({
      stepId: "investigate",
      requiredEvidenceCount: 2,
      requiredEvidenceIds: Object.freeze(["T03-EVIDENCE-APEX-PREDATOR-TRACKS"]),
      initialGuidance: Object.freeze({
        kicker: "群れが南下した理由",
        title: "聞いた話から、最初に確かめる現場を選ぶ",
        detail: "馬小屋の被害記録、井戸端に運ばれた傷、森の猟師が見た足跡は、それぞれ別の事実を示す。",
      }),
      continuedGuidance: Object.freeze({
        kicker: "一つの事実だけでは足りない",
        title: "村の痕跡と森の足跡を結び、狩りと逃走を見分ける",
        detail: "村で被害の形を一つ確かめたうえで、森の足跡まで追えば、群れが人里へ来た理由を判断できる。",
      }),
      selectedLeadGuidance: Object.freeze({
        kicker: "選んだ調査先",
        detail: "現場へ移動し、聞いた話と実際に残った痕跡が一致するかを自分の目で確かめる。",
      }),
      defer: Object.freeze({
        id: "defer",
        label: "赤牙狼の調査はいったん保留し、別の目的を優先する",
        minutes: 5,
        deferMinutes: 180,
        summary: "赤牙狼の調査をいったん保留した。群れの南下と家畜被害は、その間も進み続ける。",
        narrative: "確認したい場所を地図へ記し、今は別の目的を優先することにした。群れが止まったわけではない。戻る時には、被害の場所が変わっているかもしれない。",
      }),
      leads: Object.freeze([
        Object.freeze({
          id: "livestock_timeline",
          facilityId: "LOC_FARM_STABLE",
          destinationName: "村馬小屋",
          label: "牧場主の記録と柵の傷から、襲撃の順序を組み直す",
          approachId: "t03-livestock-timeline",
          discoveryId: "T03-EVIDENCE-ATTACKS-MOVING-INWARD",
          discoveryText: "牧場主の記録と柵に残る新旧の爪痕を重ねると、被害は森寄りの放牧地から外柵、馬小屋へと移っていた。群れの進路は毎夜、村の内側へ寄っている。",
          unlocksLeadIds: Object.freeze(["forest_displacement"]),
          minutes: 32,
          leadNarrative: "馬小屋では、補修した柵の色と牧場主の走り書きが夜ごとの被害を残していた。古い傷から新しい傷へたどれば、群れの進む向きが読めそうだ。",
        }),
        Object.freeze({
          id: "wound_pattern",
          facilityId: "LOC_FARM_WELL",
          destinationName: "村の井戸",
          label: "薬草婆が洗った噛み傷と、普通の狩り傷を見比べる",
          approachId: "t03-wound-pattern",
          discoveryId: "T03-EVIDENCE-PANICKED-BITES",
          discoveryText: "傷は急所へ集中せず、浅い噛み跡が左右から重なっていた。切れた縄には内側から強く引いた跡があり、外柵の木片まで家畜の蹄に食い込んでいる。",
          unlocksLeadIds: Object.freeze(["forest_displacement"]),
          minutes: 29,
          leadNarrative: "井戸端には、薬草婆が洗った血の付いた縄と薬布が干されている。家畜を仕留めるための傷か、逃げ場を失った獣の傷かは、噛み跡の重なり方で見分けられる。",
        }),
        Object.freeze({
          id: "forest_displacement",
          facilityId: "LOC_FOREST_HUNTER_HUT",
          targetLocation: "森",
          destinationName: "狩人小屋",
          label: "猟師の罠場で、狼の足跡を押し返した巨大な痕跡を追う",
          approachId: "t03-apex-tracks",
          discoveryId: "T03-EVIDENCE-APEX-PREDATOR-TRACKS",
          discoveryText: "狼の親子が通った跡を、さらに大きな四足の足跡が森奥から横切っていた。その交差点から狼の足跡だけが人里側へ折れ、罠木には赤牙狼では届かない高さの爪痕が残っている。",
          unlocksLeadIds: Object.freeze(["livestock_timeline", "wound_pattern"]),
          minutes: 41,
          regionalNarrative: "街道から森の入口へ入った。狩人小屋はここからさらに奥だ。踏み跡と折れた枝を頼りに、猟師の罠場へ向かう。",
          leadNarrative: "狩人小屋の裏から、踏み荒らされた罠場へ入る。狼の足跡だけを追うのではなく、その列が急に向きを変えた場所を探す。",
        }),
      ]),
      prematureResolution: Object.freeze({
        id: "drive-first-wolf",
        label: "今見つけた狼だけを倒し、群れの南下は止まったと村へ報告する",
        minutes: 22,
        summary: "目の前の一頭を退けても、別の足跡が南へ続いていた。確かめた手掛かりは残るが、群れを押し出した原因までは止まっていない。",
        narrative: "村へ戻ろうとしたところで、離れた藪から別の遠吠えが返った。一頭を倒しても群れは消えず、森奥から押し出される流れも変わっていない。見つけた事実を捨てず、もう一つの現場を確かめる必要がある。",
      }),
    }),
    postInvestigationGuidance: Object.freeze({
      kicker: "狩る側ではなく、追われる群れ",
      title: "赤牙狼が人里へ押し出された可能性が高い",
      detail: "まず村外れへ南下した群れを退ける。その後、森の痕跡と被害記録を合わせ、再発を防ぐ方法を選ぶ。",
    }),
    stepGuidance: Object.freeze({
      battle: Object.freeze({
        kicker: "村外れを塞ぐ赤い牙",
        title: "群れの進路を読み、村へ入る前に街道から退ける",
        detail: "調べた痕跡から接近方向は絞れている。危険なら退いて装備を整え、危機が深まる前に戻ることもできる。",
      }),
      resolve: Object.freeze({
        kicker: "追い払った後に残る原因",
        title: "狩人の野営地で、再発を防ぐ方法を一つ選ぶ",
        detail: "赤牙狼を倒すだけでは再び押し出される。群れ親、古い巣穴、大型魔獣の足跡のどこへ働きかけるかを決める。",
      }),
    }),
    resolution: Object.freeze({
      stepId: "resolve",
      choices: Object.freeze([
        Object.freeze({
          id: "drive_parent",
          label: "群れ親の匂い跡を追い、人里へ戻れない境界まで押し返す",
          labelByTroubleStatus: Object.freeze({
            critical: "退けた群れ親の匂い跡を消し、残る成狼を森奥へ散らす",
          }),
          minutes: 58,
          summary: "群れ親の通り道を人里から切り離し、残った赤牙狼を森奥へ押し返した。",
          summaryByTroubleStatus: Object.freeze({
            critical: "退けた群れ親の匂い跡を人里から断ち、残った成狼を森奥へ散らした。",
          }),
          narrative: "群れ親の新しい足跡を追い、人里側の風下から灰と苦い薬草を焚いた。森奥への退路だけを開けて追い立てると、親は成狼を連れ、境界の向こうへ退いた。",
          narrativeByTroubleStatus: Object.freeze({
            critical: "戦いの跡から群れ親の匂いを拾い、人里へ続く獣道を灰と苦い薬草で塞いだ。親を失った成狼は古い匂いを追えず、開けておいた森奥の退路へ散っていった。",
          }),
          worldEffect: Object.freeze({
            flagKey: "t03ResolutionRoute",
            factId: "player:T03:parent-driven-back",
            text: "赤牙狼の群れ親は森奥へ退けられ、人里へ続く通り道が塞がれた",
            factIdByTroubleStatus: Object.freeze({
              critical: "player:T03:parent-defeated-pack-scattered",
            }),
            textByTroubleStatus: Object.freeze({
              critical: "群れ親との戦いの後、残った赤牙狼は森奥へ散り、人里へ続く通り道が塞がれた",
            }),
            facilityId: "LOC_FOREST_CAMP",
            propagationDelayHours: 2,
            aftermathPlans: Object.freeze([
              Object.freeze({
                id: "t03-drive-garo-boundary",
                npcIds: Object.freeze(["NPC003"]),
                goal: "secure-wolf-boundary",
                action: "inspect-boundary",
                targetHub: "田園の村",
                targetFacilityId: "LOC_FARM_EDGE",
                delayHours: 0,
                statusText: "村外れの匂い道と柵を点検している",
                reason: "village-chief-secures-cleared-boundary",
              }),
              Object.freeze({
                id: "t03-drive-hunter-patrol",
                npcRolePattern: "猟師|狩人",
                relatedTroubleId: "T03",
                goal: "patrol-cleared-wolf-trail",
                action: "patrol-boundary",
                targetHub: "森",
                targetFacilityId: "LOC_FOREST_CAMP",
                delayHours: 1,
                statusText: "森奥へ退いた群れの戻り道を巡回している",
                reason: "hunters-patrol-cleared-wolf-trail",
              }),
            ]),
            followups: Object.freeze([
              Object.freeze({
                id: "garo-boundary-secured",
                npcId: "NPC003",
                narrative: "村外れでは新しい杭が打たれ、森へ続く獣道に灰と苦い薬草の匂いが残っている。ガロ村長は柵の外側まで歩き、戻る足跡がないか確かめていた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC003",
                    text: "森へ押し返しただけで終わりにはせん。匂い道を消し、子どもが近づかぬよう境界の杭を打ち直している。戻る兆しがあれば、次は被害が出る前に動く。",
                    emotion: "慎重な安堵",
                  }),
                ]),
              }),
            ]),
          }),
        }),
        Object.freeze({
          id: "relocate_den",
          label: "人里から離れた古い巣穴へ、群れが抜けられる退路をつなぐ",
          minutes: 74,
          summary: "赤牙狼が人里を横切らずに逃げ込める古い巣穴まで、退路をつないだ。",
          narrative: "倒木と罠縄を組み替え、人里へ向いていた獣道を古い巣穴へ曲げた。夜明け前、子狼の小さな足跡が新しい道へ続き、村へ戻る跡は残らなかった。",
          worldEffect: Object.freeze({
            flagKey: "t03ResolutionRoute",
            factId: "player:T03:den-relocated",
            text: "赤牙狼の親子は人里から離れた古い巣穴へ移り、村へ戻る足跡が途絶えた",
            factIdByTroubleStatus: Object.freeze({
              critical: "player:T03:surviving-pack-relocated",
            }),
            textByTroubleStatus: Object.freeze({
              critical: "群れ親との戦いを生き残った成狼と子狼は、人里から離れた古い巣穴へ移った",
            }),
            facilityId: "LOC_FOREST_CAMP",
            propagationDelayHours: 2,
            aftermathPlans: Object.freeze([
              Object.freeze({
                id: "t03-relocate-garo-route-map",
                npcIds: Object.freeze(["NPC003"]),
                goal: "record-relocated-den-route",
                action: "record-relocated-den-route",
                targetHub: "田園の村",
                targetFacilityId: "LOC_FARM_CHIEF",
                delayHours: 1,
                statusText: "新しい巣穴と村を結ばない退路を村の地図へ記している",
                reason: "village-chief-records-relocated-den-route",
              }),
              Object.freeze({
                id: "t03-relocate-hunter-den-watch",
                npcRolePattern: "猟師|狩人",
                relatedTroubleId: "T03",
                goal: "monitor-relocated-den",
                action: "monitor-relocated-den",
                targetHub: "森",
                targetFacilityId: "LOC_FOREST_CAMP",
                delayHours: 1,
                statusText: "移した巣穴へ人と狼の道が交わらないか見張っている",
                reason: "hunters-monitor-relocated-den",
              }),
            ]),
            followups: Object.freeze([
              Object.freeze({
                id: "garo-den-relocated",
                npcId: "NPC003",
                narrative: "村長宅の地図には、古い巣穴へ続く新しい獣道が赤ではなく灰色で引かれている。ガロ村長は家畜を放す範囲と、子どもが入ってはいけない森際を描き直していた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC003",
                    text: "殺さずに済んだことを甘さとは思わん。戻らぬかを確かめ続ける責任まで含めて、お前の選択だ。村の者にも、森へ近づかない線を改めて伝える。",
                    emotion: "重い納得",
                  }),
                ]),
              }),
            ]),
          }),
        }),
        Object.freeze({
          id: "watch_apex",
          label: "大型魔獣の行動域を記録し、村へ早く知らせる監視線を作る",
          minutes: 66,
          summary: "大型魔獣の接近を先に捉え、赤牙狼が押し出される前に村へ知らせる監視線を整えた。",
          narrative: "高い爪痕と折れた罠木を地図へ写し、森際の三か所へ警報縄を張った。大型の足跡が村側へ向けば、赤牙狼より先に野営地と村へ合図が届く。",
          worldEffect: Object.freeze({
            flagKey: "t03ResolutionRoute",
            factId: "player:T03:apex-watchline",
            text: "大型魔獣の行動域に警報線が設けられ、赤牙狼が押し出される前に村へ知らせる体制ができた",
            facilityId: "LOC_FOREST_CAMP",
            propagationDelayHours: 2,
            aftermathPlans: Object.freeze([
              Object.freeze({
                id: "t03-watch-garo-warning-roster",
                npcIds: Object.freeze(["NPC003"]),
                goal: "maintain-apex-warning-roster",
                action: "maintain-apex-warning-roster",
                targetHub: "田園の村",
                targetFacilityId: "LOC_FARM_CHIEF",
                delayHours: 0,
                statusText: "警報縄の合図を受ける当番表を組んでいる",
                reason: "village-chief-maintains-apex-warning-roster",
              }),
              Object.freeze({
                id: "t03-watch-hunter-watchline",
                npcRolePattern: "猟師|狩人",
                relatedTroubleId: "T03",
                goal: "inspect-apex-watchline",
                action: "inspect-apex-watchline",
                targetHub: "森",
                targetFacilityId: "LOC_FOREST_CAMP",
                delayHours: 0,
                statusText: "大型魔獣の足跡と警報縄を定期点検している",
                reason: "hunters-inspect-apex-watchline",
              }),
            ]),
            followups: Object.freeze([
              Object.freeze({
                id: "garo-apex-watchline",
                npcId: "NPC003",
                narrative: "村長宅には警報縄の合図表が掲げられ、森際の三地点と村の鐘が一本の線で結ばれている。ガロ村長は当番の名前を書き換え、空白の時間帯をなくしていた。",
                speeches: Object.freeze([
                  Object.freeze({
                    actorId: "NPC003",
                    text: "警報縄の合図を村の鐘へつないだ。これで狼を責める前に、森の奥で何が動いたかを知れる。見張りを絶やせば元へ戻る。仕組みは作って終わりではない。",
                    emotion: "実務的な決意",
                  }),
                ]),
              }),
            ]),
          }),
        }),
      ]),
    }),
  }),
  Object.freeze({
    id: "granary-arson",
    missionId: "MSN-T02",
    troubleId: "T02",
    title: "田園の村の共同穀倉放火",
    catalogOverride: Object.freeze({
      hearing: Object.freeze({
        targetLocation: "田園の村",
        targetFacilityId: "LOC_FARM_GRANARY",
        label: "共同穀倉で、火事の直前を知る管理人から話を聞く",
      }),
      investigation: Object.freeze({
        required: 3,
      }),
    }),
    hearing: Object.freeze({
      stepId: "hear",
      targetLocation: "田園の村",
      targetFacilityId: "LOC_FARM_GRANARY",
      npcId: "NPC005",
      npcName: "トーマ",
      guidance: Object.freeze({
        kicker: "焼けた穀倉",
        title: "管理人トーマに、火事の直前を別の角度から聞く",
        detail: "時刻と人影、帳簿と鍵、管理人が受けていた圧力では、次に追える手掛かりが変わる。",
      }),
      choices: Object.freeze([
        Object.freeze({
          id: "timeline",
          dialogueTopic: "mission_flow_t02_timeline",
          label: "火が上がる直前、誰がどこにいたのか順番に聞く",
          playerUtterance: "火が上がる直前のことを、見た順番で話してもらえますか？",
          requiredDisclosure: "火の手より前に、裏扉のそばで村の者とは違う深い靴跡を見た",
          factId: "T02-FACT-STRANGE-BOOTS",
          unlockedLeadIds: Object.freeze(["stranger_tracks", "oil_trail"]),
          minutes: 11,
          narrative: "焼けた梁から灰が落ちる。トーマは焦げた扉を見たまま、思い出した順に短く言葉を置いていった。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC005",
              text: "火の手より前だ。裏扉のそばに、村の者とは違う深い靴跡があった。荷車道の方から来て、穀倉を一周している。消火で踏み荒らされる前には見た。",
              emotion: "自責と警戒",
            }),
          ]),
        }),
        Object.freeze({
          id: "records",
          dialogueTopic: "mission_flow_t02_records",
          label: "燃え残った入庫帳と、裏扉の鍵の扱いを確かめる",
          playerUtterance: "入庫帳と裏扉の鍵は、火事の前後でどうなっていましたか？",
          requiredDisclosure: "燃えたのは収穫量と借入先が載る頁で、裏扉の錠は壊されず開けられていた",
          factId: "T02-FACT-SELECTIVE-FIRE",
          unlockedLeadIds: Object.freeze(["oil_trail", "debt_contract"]),
          minutes: 13,
          narrative: "トーマは煤けた帳面を布越しに開いた。火はすべてを均等に焼いたのではなく、誰かが困る頁を選んだように見える。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC005",
              text: "燃えたのは収穫量と借入先が載る頁だ。裏扉の錠は壊れていない。合鍵か、針金で開けたんだろう。偶然の火なら、こんな焼け方はしない。",
              emotion: "苦い確信",
            }),
          ]),
        }),
        Object.freeze({
          id: "pressure",
          dialogueTopic: "mission_flow_t02_pressure",
          label: "管理の失敗と決めつけず、火事の前に脅しや取引がなかったか聞く",
          playerUtterance: "あなたの管理ミスに見せたい誰かはいませんか。火事の前に、取引や脅しは？",
          requiredDisclosure: "前日に交易都市の穀物商の使いが、借金の話を持って村長宅へ来ていた",
          factId: "T02-FACT-MERCHANT-PRESSURE",
          unlockedLeadIds: Object.freeze(["debt_contract", "stranger_tracks"]),
          minutes: 14,
          narrative: "管理責任を責められると思っていたトーマは、初めてこちらを見る。しばらく迷った後、火事とは別だと思って伏せていた訪問者の話を始めた。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC005",
              text: "前日、交易都市の穀物商の使いが村長宅へ来た。借金を返せないなら、次の収穫で払えとな。火事と結びつける証拠はない。だが、黙っていい話でもない。",
              emotion: "ためらい",
            }),
          ]),
        }),
      ]),
    }),
    investigation: Object.freeze({
      stepId: "investigate",
      requiredEvidenceCount: 3,
      initialGuidance: Object.freeze({
        kicker: "火事の手掛かり",
        title: "聞き取った話から、最初に確かめる経路を選ぶ",
        detail: "現場の油、逃げた足跡、借金契約は別々の事実を示す。どれから追うかで移動先と得られる情報が変わる。",
      }),
      continuedGuidance: Object.freeze({
        kicker: "放火の裏付け",
        title: "残る証拠を追うか、今ある材料で動くか決める",
        detail: "火をつけた方法、実行した人物、利益を得る契約を結びつければ、単なる失火ではないと示せる。",
      }),
      selectedLeadGuidance: Object.freeze({
        kicker: "選んだ調査経路",
        detail: "噂を結論にせず、現場・人物・書類のうち選んだ一つを確かな記録へ変える。",
      }),
      defer: Object.freeze({
        id: "defer",
        label: "火事の調査はいったん保留し、別の目的を優先する",
        minutes: 5,
        deferMinutes: 180,
        summary: "共同穀倉の調査を保留した。危機の期限は止まらない。",
        narrative: "手掛かりを帳面へ書き留め、今は別の目的を優先することにした。焼け跡は残るが、人と契約は待ってくれない。",
      }),
      leads: Object.freeze([
        Object.freeze({
          id: "oil_trail",
          facilityId: "LOC_FARM_GRANARY",
          destinationName: "共同穀倉",
          label: "焦げ跡の境目と灯り油の流れを調べる",
          approachId: "granary-accelerant",
          discoveryId: "T02-EVIDENCE-POURED-OIL",
          discoveryText: "床板の焦げは裏扉から穀袋へ細く続き、灯り油は倒れた壺からではなく、人の手で線状に撒かれていた。",
          unlocksLeadIds: Object.freeze(["stranger_tracks", "debt_contract"]),
          minutes: 31,
          leadNarrative: "崩れやすい灰を踏まないよう、焦げの薄い側から床をたどる。熱源より先に、油が通った一本の線が見えてきた。",
        }),
        Object.freeze({
          id: "stranger_tracks",
          facilityId: "LOC_FARM_EDGE",
          destinationName: "村外れ・見張り小屋道",
          label: "深い靴跡と荷車の轍を、村外れまで追う",
          approachId: "stranger-escape-route",
          discoveryId: "T02-EVIDENCE-DALK-ROUTE",
          discoveryText: "深い靴跡は村人の畑道を避け、交易都市へ続く荷車道の空き家へ入っていた。中には穀物商バーゼルの印がある前金袋の切れ端が残る。",
          unlocksLeadIds: Object.freeze(["oil_trail", "debt_contract"]),
          minutes: 43,
          leadNarrative: "消火の足跡が途切れる場所から、底の硬い靴だけを拾い直す。轍と並んだ跡は、村の家ではなく街道脇の空き家へ向かっている。",
        }),
        Object.freeze({
          id: "debt_contract",
          facilityId: "LOC_FARM_CHIEF",
          destinationName: "村長宅",
          label: "借金証文と火事後に示された買い取り条件を照合する",
          approachId: "merchant-contract",
          discoveryId: "T02-EVIDENCE-HARVEST-CONTRACT",
          discoveryText: "火事の翌日に届いた契約書は、返済不能を理由に収穫権をバーゼルへ移す内容で、日付欄だけが火事より前に書かれていた。",
          unlocksLeadIds: Object.freeze(["oil_trail", "stranger_tracks"]),
          minutes: 36,
          leadNarrative: "ガロ村長が伏せていた証文と、火事後に届いた買い取り条件を机へ並べる。新しい紙の中で、日付の筆跡だけが先に乾いている。",
        }),
      ]),
      prematureResolution: Object.freeze({
        id: "incomplete-accusation",
        label: "今ある証拠だけで穀物商の関与を公に訴える",
        minutes: 24,
        summary: "証拠のつながりが足りず、穀物商は失火への言いがかりだと退けた。確認済みの証拠は失われていない。",
        narrative: "村人の前で疑いを示したが、穀物商側は「油があっても、足跡があっても、契約があっても、それだけでは雇い主を示さない」と切り返した。確かめた事実は残る。ただ、欠けた一つを埋めなければ逃げ道を塞げない。",
      }),
    }),
    postInvestigationGuidance: Object.freeze({
      kicker: "放火・実行犯・契約",
      title: "三つの証拠がつながった",
      detail: "交易都市の商人ギルドで、バーゼル本人へ契約と前金の説明を求められる。",
    }),
  }),
  Object.freeze({
    id: "second-summoning",
    missionId: "MSN-T17",
    troubleId: "T17",
    title: "王都の第二召喚儀式",
    legacyStateKey: "t17SecondSummoning",
    catalogOverride: Object.freeze({
      hearing: Object.freeze({
        targetLocation: "王都",
        targetFacilityId: "LOC_CAP_LOWER_INN",
        label: "王都下層で、第二召喚を止めようとする人物と接触する",
      }),
    }),
    hearing: Object.freeze({
      stepId: "hear",
      targetLocation: "王都",
      targetFacilityId: "LOC_CAP_LOWER_INN",
      npcId: "NPC018",
      npcName: "ライラ",
      guidance: Object.freeze({
        kicker: "王都で聞いた不穏な話",
        title: "下層の安宿で、第二召喚を止めようとする人物と話す",
        detail: "相手の主張を鵜呑みにせず、時刻・自分との関係・検証可能な証拠のどれから確かめるか選べる。",
      }),
      choices: Object.freeze([
        Object.freeze({
          id: "when_where",
          dialogueTopic: "mission_flow_when_where",
          label: "二度目の召喚を、いつ、どこで行うつもりなのか尋ねる",
          playerUtterance: "二度目の召喚は、いつ、どこで行われるんですか？",
          requiredDisclosure: "第二召喚の本式はDay41、宮廷魔術塔で行われる",
          factId: "T17-FACT-RITUAL-DATE",
          unlockedLeadIds: Object.freeze(["mage_deliveries", "castle_requisition"]),
          minutes: 10,
          narrative: "安宿の食堂の隅で、外套を深く被った女性は周囲の卓を一度見渡し、声を落とした。曖昧な警告ではなく、止めるべき時刻と場所から話すつもりらしい。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC018",
              text: "私はライラ。第二召喚の本式はDay41、宮廷魔術塔で行われる。今は資材と術者を集めている段階よ。止めるなら、儀式の日では遅い。",
              emotion: "慎重",
            }),
          ]),
        }),
        Object.freeze({
          id: "why_player",
          dialogueTopic: "mission_flow_why_player",
          label: "なぜ自分へ声をかけたのか、召喚との関係を問い返す",
          playerUtterance: "なぜ私にその話を？　私と召喚に、どんな関係があるんですか？",
          requiredDisclosure: "Day1の召喚対象は消滅せず、王都の外へ逸れて生存した可能性がある",
          factId: "T17-FACT-SUMMONED-SURVIVOR",
          unlockedLeadIds: Object.freeze(["luca_documents", "mage_deliveries"]),
          minutes: 13,
          narrative: "女性はすぐに答えず、こちらの服装と手元を確かめる。確信ではなく、危険な仮説を口にする前のためらいだった。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC018",
              text: "私はライラ。Day1の召喚対象は消滅せず、王都の外へ逸れて生存した可能性がある。足跡も荷もなく田園の村へ現れたあなたは、その仮説と重なる。でも、あなたを利用したくはない。だから証拠を一緒に確かめたい。",
              emotion: "警戒と誠実さ",
            }),
          ]),
        }),
        Object.freeze({
          id: "demand_proof",
          dialogueTopic: "mission_flow_demand_proof",
          label: "阻止派の話だけでは動けないと告げ、独立して確かめられる証拠を求める",
          playerUtterance: "あなたたちの話だけでは動けません。私自身が確かめられる証拠を示してください。",
          requiredDisclosure: "元研究員の写し、魔術塔の納入記録、王城の許可状という三つの確認先がある",
          factId: "T17-FACT-THREE-SOURCES",
          unlockedLeadIds: Object.freeze(["luca_documents", "mage_deliveries", "castle_requisition"]),
          minutes: 12,
          narrative: "女性は反発せず、小さくうなずいた。阻止派という立場だけで信用を求めるつもりはないらしい。卓上へ王都の簡単な見取り図を広げ、三か所へ印を置く。",
          speeches: Object.freeze([
            Object.freeze({
              actorId: "NPC018",
              text: "私はライラ。その判断でいい。確認先は三つ。元研究員の写し、魔術塔の納入記録、王城の許可状。互いに別の場所へ残った記録だから、二つ以上が一致すれば私たちの作り話ではないと分かる。",
              emotion: "安堵",
            }),
          ]),
        }),
      ]),
    }),
    investigation: Object.freeze({
      stepId: "investigate",
      requiredEvidenceCount: 2,
      initialGuidance: Object.freeze({
        kicker: "第二召喚の裏付け",
        title: "三つの確認先から、最初の証拠を選ぶ",
        detail: "元研究員の写し、魔術塔の納入記録、王城の許可状は、それぞれ別の立場から儀式を裏づける。",
      }),
      continuedGuidance: Object.freeze({
        kicker: "一つ目の証拠を確認済み",
        title: "別系統の記録で、第二召喚をもう一度裏づける",
        detail: "一か所の記録だけでは改ざんや誤解を否定できない。残る二経路か、証拠不足のまま訴えるかを選ぶ。",
      }),
      selectedLeadGuidance: Object.freeze({
        kicker: "選んだ確認経路",
        detail: "噂ではなく、後から照合できる記録として一つずつ確かめる。",
      }),
      defer: Object.freeze({
        id: "defer",
        label: "第二召喚の調査はいったん保留し、別の目的を優先する",
        minutes: 5,
        deferMinutes: 180,
        summary: "第二召喚の調査を保留した。儀式予定日は近づき続ける。",
        narrative: "確認先を地図へ書き留め、今は別の目的を優先することにした。儀式の準備は、こちらを待たずに進んでいく。",
      }),
      leads: Object.freeze([
        Object.freeze({
          id: "luca_documents",
          facilityId: "LOC_CAP_LOWER_INN",
          destinationName: "王都下層の安宿",
          label: "元研究員ルカが残した写しを、安宿の隠し場所で確かめる",
          approachId: "luca-copied-diagram",
          discoveryId: "T17-EVIDENCE-LUCA-COPIED-DIAGRAM",
          discoveryText: "ルカが持ち出した召喚陣の写しには、Day1の術式と同じ欠損箇所があり、欄外に「対象は消失せず、座標外へ逸れた可能性」と記されている。",
          minutes: 34,
          leadNarrative: "安宿の裏階段から物置へ入り、ルカが指定した梁の隙間を確かめる。薄い油紙に包まれた写しは、持ち運べる量へ絞られていた。",
        }),
        Object.freeze({
          id: "mage_deliveries",
          facilityId: "LOC_CAP_MAGE_TOWER",
          destinationName: "宮廷魔術塔",
          label: "宮廷魔術塔の搬入口で、儀式用資材の納入記録を調べる",
          approachId: "mage-tower-deliveries",
          discoveryId: "T17-EVIDENCE-MAGE-DELIVERIES",
          discoveryText: "宮廷魔術塔の受領札には、Day41使用予定の魔晶石と拘束具が「第二召喚・本式」の名目で集められ、Day1の失敗記録を再利用する指示まで残っている。",
          minutes: 38,
          leadNarrative: "宮廷魔術塔の正面ではなく、荷車が出入りする搬入口へ回る。術者の名簿は見えなくても、納入札と箱の封印なら外から照合できる。",
        }),
        Object.freeze({
          id: "castle_requisition",
          facilityId: "LOC_CAP_CASTLE",
          destinationName: "王城",
          label: "王城の受付区画で、召喚準備の許可状と予算の流れを照合する",
          approachId: "castle-requisition",
          discoveryId: "T17-EVIDENCE-CASTLE-REQUISITION",
          discoveryText: "王城の公開台帳には、宮廷魔術塔へ人員と資材を回す勅許があり、目的欄には「第一召喚失敗を補う第二召喚」と明記されている。",
          minutes: 41,
          leadNarrative: "王城の奥へ踏み込まず、商人や使者も利用する受付区画へ向かう。公開台帳と掲示された支出許可の範囲だけでも、魔術塔へ流れた資材を追える。",
        }),
      ]),
      prematureResolution: Object.freeze({
        id: "one_source_petition",
        label: "今ある一系統の証拠だけで王城へ訴え、儀式停止を求める",
        minutes: 25,
        summary: "一系統の証拠だけでは、王城は儀式停止を受け入れなかった。別の場所から独立した裏付けを得る必要がある。",
        narrative: "一つの記録を示して儀式停止を求めたが、王城の受付は「写しや一部署の帳面だけでは、勅許を覆せない」と退けた。証拠は無駄になっていない。ただし、別の立場から同じ計画を裏づけなければ、上層部は動かない。",
      }),
    }),
    postInvestigationGuidance: Object.freeze({
      kicker: "第二召喚の証拠",
      title: "独立した二系統の裏付けが揃った",
      detail: "次は、儀式を止めるため誰へ何を突きつけるかを慎重に決める段階に入る。",
    }),
  }),
]);

const PACK_BY_ID = new Map(AUTHORED_MISSION_FLOW_PACKS.map((pack) => [pack.id, pack]));
const PACK_BY_MISSION_ID = new Map(AUTHORED_MISSION_FLOW_PACKS.map((pack) => [pack.missionId, pack]));

function actionId(pack, kind, id) {
  return `MISSION_FLOW:${pack.id}:${kind}:${id}`;
}

function missionDefinition(runtime, pack) {
  return runtime?.playerState?.catalog?.byId?.get?.(pack.missionId)
    ?? runtime?.playerState?.catalog?.special?.find?.((entry) => entry.id === pack.missionId)
    ?? null;
}

function missionRuntime(runtime, pack) {
  return runtime?.playerState?.missions?.[pack.missionId] ?? null;
}

function currentStep(runtime, pack) {
  const definition = missionDefinition(runtime, pack);
  const state = missionRuntime(runtime, pack);
  if (!definition || !state) return null;
  return definition.steps?.find((step) =>
    Number(state.progress?.[step.id] ?? 0) < Number(step.required ?? 1)) ?? null;
}

function playerKnowsTrouble(runtime, pack) {
  const state = runtime?.playerState;
  if (!state) return false;
  if (state.progress?.missions?.attemptedTroubleIds?.has?.(pack.troubleId)
    || state.progress?.missions?.resolvedTroubleIds?.has?.(pack.troubleId)
    || state.progress?.missions?.completedIds?.has?.(pack.missionId)) return true;
  return (state.rumors ?? []).some((rumor) =>
    rumor.troubleId === pack.troubleId && state.player?.knownRumorIds?.has?.(rumor.id));
}

function packAvailable(runtime, pack) {
  return ACTIVE_TROUBLE_STATUSES.has(runtime?.playerState?.troubles?.[pack.troubleId]?.status)
    && ACTIVE_MISSION_STATUSES.has(missionRuntime(runtime, pack)?.status)
    && playerKnowsTrouble(runtime, pack);
}

function flowDeferred(runtime, pack) {
  const deferredUntil = Number(runtime?.authoredMissionFlows?.[pack.id]?.deferredUntilMinute ?? -Infinity);
  return Number(runtime?.playerState?.absoluteMinute ?? 0) < deferredUntil;
}

function availablePacks(runtime, { includeDeferred = false } = {}) {
  const player = runtime?.playerState?.player ?? {};
  return AUTHORED_MISSION_FLOW_PACKS
    .filter((pack) => packAvailable(runtime, pack) && (includeDeferred || !flowDeferred(runtime, pack)))
    .sort((left, right) => {
      const relevance = (pack) => {
        const step = currentStep(runtime, pack);
        const flow = runtime?.authoredMissionFlows?.[pack.id];
        const selectedLead = pack.investigation.leads.find((lead) => lead.id === flow?.selectedLeadId);
        if (selectedLead?.facilityId === player.facilityId) return 0;
        if (selectedLead && pack.hearing.targetLocation === player.location) return 1;
        if (step?.id === pack.hearing.stepId && pack.hearing.targetFacilityId === player.facilityId) return 2;
        if ((step?.targetLocation ?? pack.hearing.targetLocation) === player.location) return 3;
        if (selectedLead) return 4;
        return 5;
      };
      return relevance(left) - relevance(right)
        || Number(missionDefinition(runtime, left)?.deadlineDay ?? Infinity)
          - Number(missionDefinition(runtime, right)?.deadlineDay ?? Infinity)
        || left.id.localeCompare(right.id);
    });
}

function availablePack(runtime) {
  return availablePacks(runtime)[0] ?? null;
}

function freshState(pack) {
  return {
    version: AUTHORED_MISSION_FLOW_VERSION,
    flowId: pack.id,
    openingChoiceId: null,
    openingChosenAtMinute: null,
    selectedLeadId: null,
    selectedLeadAtMinute: null,
    evidenceIds: [],
    unlockedLeadIds: [],
    knownFactIds: [],
    prematureResolutionCount: 0,
    prematureResolutionEvidenceCounts: [],
    deferredUntilMinute: null,
    selectedResolutionRouteId: null,
    selectedResolutionContextId: null,
    resolutionBranchId: null,
  };
}

function requiredEvidenceGroups(pack) {
  return [
    ...(pack.investigation.requiredEvidenceIds ?? []).map((evidenceId) => [evidenceId]),
    ...(pack.investigation.requiredEvidenceGroups ?? []).map((group) => [...group]),
  ].filter((group) => group.length > 0);
}

function investigationRequirementsMet(pack, flow) {
  const evidenceIds = new Set(flow?.evidenceIds ?? []);
  if (evidenceIds.size < Number(pack.investigation.requiredEvidenceCount ?? 0)) return false;
  return requiredEvidenceGroups(pack)
    .every((group) => group.some((evidenceId) => evidenceIds.has(evidenceId)));
}

function syncInvestigationProgress(runtime, pack, flow) {
  const definition = missionDefinition(runtime, pack);
  const step = definition?.steps?.find((entry) => entry.id === pack.investigation.stepId);
  const progress = missionRuntime(runtime, pack)?.progress;
  if (!step || !progress) return;
  const required = Math.max(1, Number(step.required ?? 1));
  const mandatoryGroups = requiredEvidenceGroups(pack);
  if (mandatoryGroups.length === 0) return;
  if (investigationRequirementsMet(pack, flow)) {
    progress[step.id] = required;
    return;
  }
  const evidenceIds = new Set(flow?.evidenceIds ?? []);
  const mandatoryFound = mandatoryGroups
    .filter((group) => group.some((id) => evidenceIds.has(id))).length;
  const mandatoryUniverse = new Set(mandatoryGroups.flat());
  const nonMandatoryNeeded = Math.max(
    0,
    Number(pack.investigation.requiredEvidenceCount ?? required) - mandatoryGroups.length,
  );
  const nonMandatoryFound = [...evidenceIds].filter((id) => !mandatoryUniverse.has(id)).length;
  progress[step.id] = Math.min(
    required - 1,
    mandatoryFound + Math.min(nonMandatoryNeeded, nonMandatoryFound),
  );
}

export function ensureAuthoredMissionFlowState(runtime, packOrId) {
  const pack = typeof packOrId === "string" ? PACK_BY_ID.get(packOrId) : packOrId;
  if (!pack) return null;
  runtime.authoredMissionFlows ??= {};
  const hadFlowState = Boolean(runtime.authoredMissionFlows[pack.id]);
  if (!hadFlowState) {
    const legacy = pack.legacyStateKey ? runtime[pack.legacyStateKey] : null;
    runtime.authoredMissionFlows[pack.id] = { ...freshState(pack), ...(legacy ?? {}) };
  }
  const state = runtime.authoredMissionFlows[pack.id];
  const previousVersion = String(state.version ?? "");
  const migratedFromEarlierVersion = previousVersion !== AUTHORED_MISSION_FLOW_VERSION;
  if (pack.legacyStateKey && Object.hasOwn(runtime, pack.legacyStateKey)) {
    delete runtime[pack.legacyStateKey];
  }
  state.version = AUTHORED_MISSION_FLOW_VERSION;
  state.flowId = pack.id;
  state.openingChoiceId ??= null;
  state.openingChosenAtMinute ??= null;
  state.selectedLeadId ??= null;
  state.selectedLeadAtMinute ??= null;
  const validLeadIds = new Set(pack.investigation.leads.map((lead) => lead.id));
  const leadByDiscoveryId = new Map(
    pack.investigation.leads.map((lead) => [lead.discoveryId, lead]),
  );
  state.evidenceIds = Array.isArray(state.evidenceIds)
    ? [...new Set(state.evidenceIds.filter((id) => leadByDiscoveryId.has(id)))]
    : [];
  for (const discovery of missionRuntime(runtime, pack)?.discoveries ?? []) {
    if (leadByDiscoveryId.has(discovery?.id) && !state.evidenceIds.includes(discovery.id)) {
      state.evidenceIds.push(discovery.id);
    }
  }
  const definition = missionDefinition(runtime, pack);
  const hearingStep = definition?.steps?.find((step) => step.id === pack.hearing.stepId);
  const hearingProgress = Number(
    missionRuntime(runtime, pack)?.progress?.[pack.hearing.stepId] ?? 0,
  );
  if (!state.openingChoiceId
    && hearingStep
    && (migratedFromEarlierVersion || !hadFlowState)
    && hearingProgress >= Number(hearingStep.required ?? 1)) {
    state.openingChoiceId = "legacy-completed-hearing";
  }
  const openingChoice = pack.hearing.choices.find((choice) => choice.id === state.openingChoiceId);
  const legacyUnlocked = state.openingChoiceId
    ? migratedFromEarlierVersion
      ? pack.investigation.leads.map((lead) => lead.id)
      : openingChoice?.unlockedLeadIds ?? pack.investigation.leads.map((lead) => lead.id)
    : [];
  state.unlockedLeadIds = Array.isArray(state.unlockedLeadIds)
    ? [...new Set(state.unlockedLeadIds.filter((id) => validLeadIds.has(id)))]
    : [];
  if (state.openingChoiceId && state.unlockedLeadIds.length === 0) {
    state.unlockedLeadIds = [...new Set(legacyUnlocked)];
  }
  state.knownFactIds = Array.isArray(state.knownFactIds) ? [...new Set(state.knownFactIds)] : [];
  if (openingChoice?.factId && !state.knownFactIds.includes(openingChoice.factId)) {
    state.knownFactIds.push(openingChoice.factId);
  }
  const selectedLead = pack.investigation.leads.find((lead) => lead.id === state.selectedLeadId);
  if (!selectedLead || state.evidenceIds.includes(selectedLead.discoveryId)) {
    state.selectedLeadId = null;
    state.selectedLeadAtMinute = null;
  } else if (!state.unlockedLeadIds.includes(selectedLead.id)) {
    state.unlockedLeadIds.push(selectedLead.id);
  }
  const prematureCount = Number(
    state.prematureResolutionCount ?? state.prematurePetitionCount ?? 0,
  );
  state.prematureResolutionCount = Number.isFinite(prematureCount)
    ? Math.max(0, Math.trunc(prematureCount))
    : 0;
  delete state.prematurePetitionCount;
  state.prematureResolutionEvidenceCounts = Array.isArray(state.prematureResolutionEvidenceCounts)
    ? [...new Set(state.prematureResolutionEvidenceCounts
      .map(Number)
      .filter((count) => Number.isInteger(count)
        && count >= 0
        && count <= pack.investigation.leads.length))]
    : state.prematureResolutionCount > 0
      ? [state.evidenceIds.length]
      : [];
  const deferredUntilMinute = state.deferredUntilMinute;
  state.deferredUntilMinute = deferredUntilMinute != null
    && Number.isFinite(Number(deferredUntilMinute))
    ? Number(deferredUntilMinute)
    : null;
  state.selectedResolutionRouteId ??= null;
  state.selectedResolutionContextId ??= null;
  state.resolutionBranchId ??= null;
  syncInvestigationProgress(runtime, pack, state);
  return state;
}

export function applyAuthoredMissionFlowCatalogOverrides(catalog) {
  for (const pack of AUTHORED_MISSION_FLOW_PACKS) {
    const mission = catalog.special.find((entry) => entry.id === pack.missionId);
    if (!mission) continue;
    const defaultStepIds = {
      hearing: "hear",
      investigation: "investigate",
      battle: "battle",
      resolution: "resolve",
    };
    const removedStepIds = new Set(pack.catalogRemoveStepIds ?? []);
    if (removedStepIds.size > 0) {
      for (let index = mission.steps.length - 1; index >= 0; index -= 1) {
        if (removedStepIds.has(mission.steps[index].id)) mission.steps.splice(index, 1);
      }
    }
    for (const [section, override] of Object.entries(pack.catalogOverride ?? {})) {
      const stepId = pack[section]?.stepId ?? defaultStepIds[section];
      let step = mission.steps.find((entry) => entry.id === stepId);
      if (!step && section === "battle") {
        step = {
          id: stepId,
          type: "battle",
          targetLocation: override.targetLocation ?? pack.hearing.targetLocation,
          targetFacilityId: override.targetFacilityId ?? null,
          encounterId: override.encounterId ?? null,
          required: Number(override.required ?? 1),
          label: override.label ?? `${pack.title}に関係する脅威を排除する`,
        };
        const resolveIndex = mission.steps.findIndex((entry) => entry.type === "resolve");
        mission.steps.splice(resolveIndex >= 0 ? resolveIndex : mission.steps.length, 0, step);
      }
      if (step) Object.assign(step, override);
    }
  }
  return catalog;
}

function presentNpcIds(presentNpcs) {
  return new Set((presentNpcs ?? []).map((npc) => npc?.id).filter(Boolean));
}

function openingActions(runtime, pack, presentNpcs) {
  const hearing = pack.hearing;
  if (runtime.playerState.player.facilityId !== hearing.targetFacilityId) return null;
  if (!presentNpcIds(presentNpcs).has(hearing.npcId)) return null;
  return hearing.choices.map((choice) => ({
    id: actionId(pack, "OPENING", choice.id),
    family: "talk",
    type: "conversation",
    missionId: pack.missionId,
    stepId: hearing.stepId,
    missionTitle: pack.title,
    missionTroubleId: pack.troubleId,
    targetNpcId: hearing.npcId,
    targetNpcName: hearing.npcName,
    dialogueTopic: choice.dialogueTopic,
    label: choice.label,
    playerUtterance: choice.playerUtterance,
    requiredDisclosure: choice.requiredDisclosure,
    minutes: choice.minutes,
    deferMissionConversationCompletion: true,
    singleTurnConversation: true,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "opening",
    authoredMissionFlowChoiceId: choice.id,
    authoredMissionFlowFactId: choice.factId ?? null,
    authoredMissionFlowUnlockedLeadIds: [...(choice.unlockedLeadIds ?? [])],
  }));
}

function resolutionContextSnapshot(runtime, choice, variant) {
  const missionId = variant?.contextEvidenceMissionId ?? choice?.contextEvidenceMissionId ?? null;
  const missionPack = missionId ? PACK_BY_MISSION_ID.get(missionId) : null;
  const flow = missionPack ? runtime?.authoredMissionFlows?.[missionPack.id] : null;
  const discoveries = missionId
    ? runtime?.playerState?.missions?.[missionId]?.discoveries ?? []
    : [];
  const discoveryOrder = discoveries.map((entry) => entry?.id).filter(Boolean);
  const evidenceOrder = Array.isArray(flow?.evidenceIds) && flow.evidenceIds.length
    ? [...flow.evidenceIds]
    : discoveryOrder;
  return {
    evidenceOrder,
    evidenceIds: new Set(evidenceOrder),
    openingChoiceId: flow?.openingChoiceId ?? null,
  };
}

function matchingResolutionContextVariant(runtime, choice, requestedContextId = null) {
  const variants = choice?.contextVariants ?? [];
  if (requestedContextId) {
    return variants.find((variant) => variant.contextId === requestedContextId) ?? null;
  }
  const flags = runtime?.playerState?.worldFlags ?? {};
  const troubles = runtime?.playerState?.troubles ?? {};
  return variants.find((variant) => {
    const snapshot = resolutionContextSnapshot(runtime, choice, variant);
    const requiredEvidenceIds = variant.requiredEvidenceIds ?? [];
    const anyEvidenceIds = variant.anyEvidenceIds ?? [];
    const forbiddenEvidenceIds = variant.forbiddenEvidenceIds ?? [];
    const openingChoiceIds = variant.openingChoiceIds ?? [];
    const firstEvidenceIds = variant.firstEvidenceIds ?? [];
    const lastEvidenceIds = variant.lastEvidenceIds ?? [];
    const evidenceOrderPrefix = variant.evidenceOrderPrefix ?? [];
    const troubleStatuses = variant.troubleStatuses
      ?? (variant.troubleStatus ? [variant.troubleStatus] : []);
    const hasCriteria = Boolean(
      variant.flagKey
      || variant.troubleId
      || requiredEvidenceIds.length
      || anyEvidenceIds.length
      || forbiddenEvidenceIds.length
      || openingChoiceIds.length
      || firstEvidenceIds.length
      || lastEvidenceIds.length
      || evidenceOrderPrefix.length
    );
    if (!hasCriteria) return false;
    if (variant.flagKey) {
      const flagValue = flags[variant.flagKey];
      if (variant.flagValue == null ? !flagValue : flagValue !== variant.flagValue) return false;
    }
    if (variant.troubleId) {
      const status = troubles[variant.troubleId]?.status ?? troubles[variant.troubleId];
      if (troubleStatuses.length ? !troubleStatuses.includes(status) : !status) return false;
    }
    if (requiredEvidenceIds.some((id) => !snapshot.evidenceIds.has(id))) return false;
    if (anyEvidenceIds.length && !anyEvidenceIds.some((id) => snapshot.evidenceIds.has(id))) return false;
    if (forbiddenEvidenceIds.some((id) => snapshot.evidenceIds.has(id))) return false;
    if (openingChoiceIds.length && !openingChoiceIds.includes(snapshot.openingChoiceId)) return false;
    if (firstEvidenceIds.length && !firstEvidenceIds.includes(snapshot.evidenceOrder[0])) return false;
    if (lastEvidenceIds.length && !lastEvidenceIds.includes(snapshot.evidenceOrder.at(-1))) return false;
    if (evidenceOrderPrefix.some((id, index) => snapshot.evidenceOrder[index] !== id)) return false;
    return true;
  }) ?? null;
}

export function resolveAuthoredResolutionChoice(runtime, choice, requestedContextId = null) {
  const variant = matchingResolutionContextVariant(runtime, choice, requestedContextId);
  if (!variant) return choice;
  return {
    ...choice,
    ...variant,
    id: choice.id,
    worldEffect: {
      ...(choice.worldEffect ?? {}),
      ...(variant.worldEffect ?? {}),
    },
  };
}

function persistAuthoredResolutionBranch(runtime, pack, flow, route, troubleStatus) {
  if (pack?.persistResolutionBranch !== true) return null;
  const contextId = route.contextId ?? "base";
  const evidenceOrder = [...(flow?.evidenceIds ?? [])];
  const branchId = [
    pack.troubleId,
    flow?.openingChoiceId ?? "unknown-opening",
    evidenceOrder.join(">") || "no-evidence-order",
    route.id,
    contextId,
    troubleStatus,
  ].join("|");
  flow.selectedResolutionContextId = contextId;
  flow.resolutionBranchId = branchId;
  const flagPrefix = pack.troubleId.toLowerCase();
  runtime.playerState.worldFlags ??= {};
  runtime.playerState.worldFlags[`${flagPrefix}ResolutionContext`] = contextId;
  runtime.playerState.worldFlags[`${flagPrefix}ResolutionBranch`] = branchId;
  runtime.narrativeMemory ??= {};
  runtime.narrativeMemory.semanticFlags ??= {};
  runtime.narrativeMemory.semanticFlags[`trouble.${pack.troubleId}.resolutionContext`] = contextId;
  runtime.narrativeMemory.semanticFlags[`trouble.${pack.troubleId}.resolutionBranch`] = branchId;
  return branchId;
}

function resolutionActions(runtime, pack, step) {
  const choices = pack.resolution?.choices ?? [];
  if (choices.length !== 3) return null;
  if (step?.targetFacilityId
    && runtime.playerState.player.facilityId !== step.targetFacilityId) return null;
  const troubleStatus = runtime.playerState.troubles?.[pack.troubleId]?.status ?? "active";
  return choices.map((choice) => {
    const resolvedChoice = resolveAuthoredResolutionChoice(runtime, choice);
    return {
      id: actionId(pack, "RESOLUTION", `${choice.id}:${troubleStatus}`),
      family: "help",
      type: "resolveMission",
      missionId: pack.missionId,
      stepId: pack.resolution.stepId,
      missionTitle: pack.title,
      missionTroubleId: pack.troubleId,
      minutes: resolvedChoice.minutes,
      label: resolvedChoice.labelByTroubleStatus?.[troubleStatus] ?? resolvedChoice.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: pack.id,
      authoredMissionFlowKind: "resolution",
      authoredMissionFlowResolutionRouteId: choice.id,
      authoredMissionFlowResolutionContextVariantId: resolvedChoice.contextId ?? null,
      authoredMissionFlowTroubleStatus: troubleStatus,
    };
  });
}

function movementTo(movementActions, facilityId) {
  return (movementActions ?? []).find((action) =>
    action?.movementScope === "local" && action.destinationFacilityId === facilityId) ?? null;
}

function leadAction(runtime, pack, movementActions, lead) {
  const atTarget = runtime.playerState.player.facilityId === lead.facilityId;
  const targetLocation = lead.targetLocation ?? pack.hearing.targetLocation;
  const movement = atTarget
    ? null
    : movementTo(movementActions, lead.facilityId)
      ?? (movementActions ?? []).find((action) =>
        action?.movementScope === "regional" && action.destinationHub === targetLocation)
      ?? null;
  if (!atTarget && !movement) return null;
  const actionKind = movement?.movementScope === "regional" ? "LEAD_HUB" : "LEAD";
  const visitedHubs = runtime.playerState.progress?.travel?.visitedHubs;
  const regionalVerb = visitedHubs?.has?.(targetLocation) ? "戻り" : "向かい";
  return {
    ...(movement ?? {}),
    id: actionId(pack, actionKind, lead.id),
    type: movement ? "move" : "plan",
    family: movement ? "move" : "prepare",
    minutes: movement ? movement.minutes : 8,
    label: movement?.movementScope === "regional"
      ? `${targetLocation}へ${regionalVerb}、${lead.label}`
      : atTarget
      ? `${lead.destinationName}で、${lead.label}`
      : `${lead.destinationName}へ向かい、${lead.label}`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "lead",
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowTargetFacilityId: lead.facilityId,
  };
}

function deferAction(pack) {
  const defer = pack.investigation.defer;
  if (!defer) return null;
  return {
    id: actionId(pack, "DEFER", defer.id),
    family: "leave",
    type: "plan",
    effectKind: "defer_authored_mission_flow",
    minutes: defer.minutes,
    label: defer.label,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "defer",
    authoredMissionFlowDeferMinutes: defer.deferMinutes,
  };
}

function freeMovementAction(pack, movementActions, excludedFacilityIds) {
  const movement = (movementActions ?? []).find((action) =>
    action?.movementScope === "regional"
      || (action?.movementScope === "local" && !excludedFacilityIds.has(action.destinationFacilityId)));
  if (!movement) return null;
  const destination = movement.destinationHub ?? movement.destinationFacilityId ?? "別の場所";
  return {
    ...movement,
    id: actionId(pack, "FREE_MOVE", destination),
    label: `${movement.label ?? `${destination}へ向かう`}（この調査は後回しにする）`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "defer",
    authoredMissionFlowDeferMinutes: 360,
  };
}

function reconsiderLeadAction(pack, lead) {
  return {
    id: actionId(pack, "RECONSIDER", lead.id),
    family: "prepare",
    type: "plan",
    effectKind: "reconsider_authored_mission_lead",
    minutes: 4,
    label: `${lead.destinationName}を追う判断をいったん戻し、別の手掛かりを選ぶ`,
    authoredMissionFlowExclusiveChoice: true,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "reconsider_lead",
    authoredMissionFlowLeadId: lead.id,
  };
}

function selectedLeadActions(runtime, pack, movementActions, flow) {
  const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
  if (!lead) return null;
  const atTarget = runtime.playerState.player.facilityId === lead.facilityId;
  const primary = atTarget
    ? evidenceActionForPack(runtime, pack)
    : leadAction(runtime, pack, movementActions, lead);
  const result = [
    primary,
    reconsiderLeadAction(pack, lead),
    deferAction(pack),
  ].filter(Boolean);
  if (result.length < 3) {
    const movement = freeMovementAction(pack, movementActions, new Set([lead.facilityId]));
    if (movement) result.push(movement);
  }
  return result.length === 3 ? result : null;
}

function leadSelectionActions(runtime, pack, movementActions, flow, evidenceIds) {
  const investigation = pack.investigation;
  const unlocked = new Set(flow.unlockedLeadIds);
  const remaining = investigation.leads.filter((lead) =>
    unlocked.has(lead.id) && !evidenceIds.has(lead.discoveryId));
  const actions = remaining.map((lead) => leadAction(runtime, pack, movementActions, lead)).filter(Boolean);
  const result = actions.slice(0, 3);
  const premature = investigation.prematureResolution;
  const alreadyRejectedAtThisEvidenceCount = flow.prematureResolutionEvidenceCounts.includes(evidenceIds.size);
  if (result.length < 3 && evidenceIds.size > 0 && premature && !alreadyRejectedAtThisEvidenceCount) {
    result.push({
      id: actionId(pack, "PREMATURE", premature.id),
      family: "help",
      type: "plan",
      effectKind: "premature_mission_resolution",
      minutes: premature.minutes,
      label: premature.label,
      authoredMissionFlowExclusiveChoice: true,
      authoredMissionFlowId: pack.id,
      authoredMissionFlowKind: "premature_resolution",
    });
  }
  if (result.length < 3) {
    const defer = deferAction(pack);
    if (defer) result.push(defer);
  }
  if (result.length < 3) {
    const movement = freeMovementAction(
      pack,
      movementActions,
      new Set(remaining.map((lead) => lead.facilityId)),
    );
    if (movement) result.push(movement);
  }
  return result.length === 3 ? result : null;
}

export function authoredMissionFlowExclusiveActions(runtime, {
  presentNpcs = [],
  movementActions = [],
} = {}) {
  const packs = availablePacks(runtime);
  for (const pack of packs) {
    const flow = ensureAuthoredMissionFlowState(runtime, pack);
    const step = currentStep(runtime, pack);
    if (step?.id !== pack.investigation.stepId) continue;
    const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
    if (!lead || lead.facilityId !== runtime.playerState.player.facilityId) continue;
    const actions = selectedLeadActions(runtime, pack, movementActions, flow);
    if (actions?.length === 3) return actions;
  }
  for (const pack of packs) {
    const flow = ensureAuthoredMissionFlowState(runtime, pack);
    const step = currentStep(runtime, pack);
    if (!step) continue;
    if (step.id === pack.resolution?.stepId) {
      const actions = resolutionActions(runtime, pack, step);
      if (actions?.length === 3) return actions;
      continue;
    }
    if (step.id === pack.investigation.stepId && flow.selectedLeadId) {
      const actions = selectedLeadActions(runtime, pack, movementActions, flow);
      if (actions?.length === 3) return actions;
      continue;
    }
    if (step.id === pack.hearing.stepId) {
      const actions = openingActions(runtime, pack, presentNpcs);
      if (actions?.length === 3) return actions;
      continue;
    }
    if (step.id !== pack.investigation.stepId || !flow.openingChoiceId || flow.selectedLeadId) continue;
    const evidenceIds = new Set(flow.evidenceIds);
    if (investigationRequirementsMet(pack, flow)) continue;
    const actions = leadSelectionActions(runtime, pack, movementActions, flow, evidenceIds);
    if (actions?.length === 3) return actions;
  }
  return null;
}

function evidenceActionForPack(runtime, pack) {
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  const step = currentStep(runtime, pack);
  if (step?.id !== pack.investigation.stepId) return null;
  const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
  if (!lead || runtime.playerState.player.facilityId !== lead.facilityId) return null;
  const discoveries = missionRuntime(runtime, pack)?.discoveries ?? [];
  if (flow.evidenceIds.includes(lead.discoveryId)
    || discoveries.some((entry) => entry.id === lead.discoveryId)) return null;
  return {
    id: actionId(pack, "EVIDENCE", lead.id),
    family: "investigate",
    type: "investigate",
    missionId: pack.missionId,
    stepId: pack.investigation.stepId,
    missionTitle: pack.title,
    missionTroubleId: pack.troubleId,
    minutes: lead.minutes,
    label: lead.label,
    investigationStage: Math.max(
      0,
      Number(missionRuntime(runtime, pack)?.progress?.[pack.investigation.stepId] ?? 0),
    ),
    approachId: lead.approachId,
    discoveryId: lead.discoveryId,
    discoveryText: lead.discoveryText,
    authoredMissionFlowId: pack.id,
    authoredMissionFlowKind: "evidence",
    authoredMissionFlowLeadId: lead.id,
    authoredMissionFlowEvidenceId: lead.discoveryId,
  };
}

export function authoredMissionFlowEvidenceAction(runtime) {
  for (const pack of availablePacks(runtime)) {
    const action = evidenceActionForPack(runtime, pack);
    if (action) return action;
  }
  return null;
}

export function suppressGenericAuthoredMissionAction(runtime, action) {
  const pack = action?.missionId ? PACK_BY_MISSION_ID.get(action.missionId) : null;
  if (!pack || !packAvailable(runtime, pack) || flowDeferred(runtime, pack)) return false;
  if (action.authoredMissionFlowId === pack.id) return false;
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  const step = currentStep(runtime, pack);
  if (step?.id === pack.hearing.stepId) {
    const present = runtime.playerState.authoritativePresentNpcIds;
    return runtime.playerState.player.facilityId === pack.hearing.targetFacilityId
      && present instanceof Set
      && present.has(pack.hearing.npcId);
  }
  if (step?.id !== pack.investigation.stepId) return false;
  return Boolean(flow.selectedLeadId || evidenceActionForPack(runtime, pack));
}

function revealLeadIds(runtime, pack, flow, leadIds) {
  const validIds = new Set(pack.investigation.leads.map((lead) => lead.id));
  for (const leadId of leadIds ?? []) {
    if (!validIds.has(leadId)) continue;
    if (!flow.unlockedLeadIds.includes(leadId)) flow.unlockedLeadIds.push(leadId);
    const lead = pack.investigation.leads.find((entry) => entry.id === leadId);
    if (!lead?.facilityId) continue;
    runtime.playerKnowledge ??= {};
    runtime.playerKnowledge.knownHubIds ??= new Set();
    runtime.playerKnowledge.knownFacilityIds ??= new Set();
    runtime.playerKnowledge.knownHubIds.add(lead.targetLocation ?? pack.hearing.targetLocation);
    runtime.playerKnowledge.knownFacilityIds.add(lead.facilityId);
  }
}


function aftermathPlanMatchesNpc(npc, plan) {
  if (!npc || !plan) return false;
  const explicitIds = plan.npcIds ?? [];
  if (explicitIds.length && !explicitIds.includes(npc.id)) return false;
  if (plan.relatedTroubleId && !(npc.relatedTroubleIds ?? []).includes(plan.relatedTroubleId)) return false;
  if (plan.npcRolePattern) {
    try {
      if (!new RegExp(plan.npcRolePattern, "u").test(`${npc.occupation ?? ""} ${npc.primaryGoal ?? ""}`)) return false;
    } catch {
      return false;
    }
  }
  return explicitIds.length > 0 || Boolean(plan.relatedTroubleId) || Boolean(plan.npcRolePattern);
}

function seedResolutionNpcAftermath(world, belief, effect, sourceEventId, learnedAt) {
  const plans = effect?.aftermathPlans ?? [];
  if (!world || !plans.length) return [];
  const targetNpcIds = new Set();
  for (const plan of plans) {
    for (const npc of world.model?.npcs ?? []) {
      if (aftermathPlanMatchesNpc(npc, plan)) targetNpcIds.add(npc.id);
    }
  }
  const seeded = [];
  for (const npcId of [...targetNpcIds].sort()) {
    const state = world.npcStates?.[npcId];
    if (!state || state.lifeStatus === "dead" || ["dead", "departed", "not-yet-present"].includes(state.presence)) continue;
    state.beliefs ??= {};
    const existing = state.beliefs[belief.factId];
    if (existing && Number(existing.learnedAt ?? Infinity) <= learnedAt) continue;
    world.knowledgeEventSequence = Number(world.knowledgeEventSequence ?? world.knowledgeEvents?.length ?? 0) + 1;
    const eventId = `K${String(world.knowledgeEventSequence).padStart(7, "0")}`;
    const path = [...(belief.path ?? []), npcId];
    state.beliefs[belief.factId] = {
      ...belief,
      learnedAt,
      propagationAt: learnedAt + 4,
      sourceType: "player-intervention",
      sourceNpcId: null,
      sourceEventId,
      provenanceEventId: eventId,
      hopCount: 1,
      path,
    };
    state.knowledgeRevision = Number(state.knowledgeRevision ?? 0) + 1;
    world.knowledgeEvents ??= [];
    world.knowledgeEvents.push({
      id: eventId,
      eventId,
      type: "authored-aftermath",
      npcId,
      factId: belief.factId,
      troubleId: belief.troubleId,
      troubleStatus: "resolved",
      learnedAt,
      propagationAt: learnedAt + 4,
      sourceType: "player-intervention",
      sourceNpcId: null,
      sourceEventId,
      sourceLearnedAt: learnedAt,
      importance: belief.importance,
      confidence: belief.confidence,
      hopCount: 1,
      path,
      location: { ...state.position },
    });
    seeded.push(npcId);
  }
  return seeded;
}

function applyResolutionWorldEffect(runtime, pack, route, minute, troubleStatus) {
  const effect = route.worldEffect;
  const factId = effect?.factIdByTroubleStatus?.[troubleStatus] ?? effect?.factId;
  const effectText = effect?.textByTroubleStatus?.[troubleStatus] ?? effect?.text;
  if (!factId || !effectText) return null;
  const state = runtime.playerState;
  state.worldFlags ??= {};
  if (effect.flagKey) state.worldFlags[effect.flagKey] = route.id;
  state.routeCache = {};

  runtime.narrativeMemory ??= {};
  runtime.narrativeMemory.semanticFlags ??= {};
  runtime.narrativeMemory.localFacts ??= [];
  runtime.narrativeMemory.semanticFlags[`trouble.${pack.troubleId}.resolutionRoute`] = route.id;
  runtime.narrativeMemory.semanticFlags[`trouble.${pack.troubleId}.resolutionStatus`] = troubleStatus;
  if (!runtime.narrativeMemory.localFacts.some((entry) => entry.factId === factId)) {
    runtime.narrativeMemory.localFacts.push({
      type: "authored_resolution",
      factId,
      subjectId: pack.troubleId,
      predicate: "resolution_route",
      value: route.id,
      summary: effectText,
      troubleId: pack.troubleId,
      locationId: state.player.location,
      facilityId: effect.facilityId ?? state.player.facilityId,
      recordedAtMinute: minute,
    });
  }

  const world = runtime.livingWorld;
  if (!world) return factId;
  world.seededTroubleFacts ??= new Set();
  if (world.seededTroubleFacts.has(factId)) return factId;
  world.seededTroubleFacts.add(factId);
  const learnedAt = minute / 60;
  const propagationAt = learnedAt + Number(effect.propagationDelayHours ?? 2);
  const facilityId = effect.facilityId ?? state.player.facilityId;
  world.knowledgeEventSequence = Number(world.knowledgeEventSequence ?? world.knowledgeEvents?.length ?? 0) + 1;
  const eventId = `K${String(world.knowledgeEventSequence).padStart(7, "0")}`;
  const belief = {
    factId,
    kind: "trouble",
    text: effectText,
    troubleId: pack.troubleId,
    troubleIds: [pack.troubleId],
    troubleStatus: "resolved",
    confidence: 1,
    importance: 0.95,
    secret: false,
    learnedAt,
    propagationAt,
    sourceType: "player-intervention",
    sourceNpcId: null,
    provenanceEventId: eventId,
    hopCount: 0,
    path: [`facility:${facilityId}`],
    aftermathPlans: (effect.aftermathPlans ?? []).map((plan) => ({
      ...plan,
      npcIds: [...(plan.npcIds ?? [])],
    })),
  };
  world.knowledgeEvents ??= [];
  world.knowledgeEvents.push({
    id: eventId,
    type: "rumor-source",
    npcId: null,
    factId,
    troubleId: pack.troubleId,
    troubleStatus: "resolved",
    learnedAt,
    propagationAt,
    sourceType: "player-intervention",
    importance: belief.importance,
    confidence: 1,
    hopCount: 0,
    path: [...belief.path],
    location: { hubId: state.player.location, facilityId },
  });
  world.facilityRumors ??= {};
  world.facilityRumors[facilityId] ??= new Map();
  world.facilityRumors[facilityId].set(factId, {
    factId,
    belief,
    propagationAt,
    sourceNpcId: null,
    sourceEventId: eventId,
    carrierType: "player-intervention",
  });
  seedResolutionNpcAftermath(world, belief, effect, eventId, learnedAt);
  return factId;
}

export function applyAuthoredMissionFlowAction(runtime, action, result) {
  if (!action?.authoredMissionFlowId || result?.ok === false) return false;
  const pack = PACK_BY_ID.get(action.authoredMissionFlowId);
  if (!pack) return false;
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  const minute = Number(runtime.playerState.absoluteMinute ?? 0);
  let changed = false;
  if (action.authoredMissionFlowKind === "opening") {
    const choice = pack.hearing.choices.find((entry) => entry.id === action.authoredMissionFlowChoiceId);
    flow.openingChoiceId = action.authoredMissionFlowChoiceId;
    flow.openingChosenAtMinute ??= minute;
    flow.deferredUntilMinute = null;
    if (action.authoredMissionFlowFactId && !flow.knownFactIds.includes(action.authoredMissionFlowFactId)) {
      flow.knownFactIds.push(action.authoredMissionFlowFactId);
    }
    revealLeadIds(
      runtime,
      pack,
      flow,
      action.authoredMissionFlowUnlockedLeadIds?.length
        ? action.authoredMissionFlowUnlockedLeadIds
        : choice?.unlockedLeadIds,
    );
    changed = true;
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_OPENING_SELECTED",
      minute,
      flowId: pack.id,
      missionId: pack.missionId,
      choiceId: action.authoredMissionFlowChoiceId,
      factId: action.authoredMissionFlowFactId ?? null,
      unlockedLeadIds: [...flow.unlockedLeadIds],
    });
  }
  if (action.authoredMissionFlowKind === "lead") {
    flow.selectedLeadId = action.authoredMissionFlowLeadId;
    flow.selectedLeadAtMinute = minute;
    flow.deferredUntilMinute = null;
    changed = true;
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_LEAD_SELECTED",
      minute,
      flowId: pack.id,
      missionId: pack.missionId,
      leadId: action.authoredMissionFlowLeadId,
      facilityId: action.authoredMissionFlowTargetFacilityId ?? runtime.playerState.player.facilityId,
    });
  }
  if (action.authoredMissionFlowKind === "evidence") {
    const lead = pack.investigation.leads.find((entry) => entry.id === action.authoredMissionFlowLeadId);
    if (!flow.evidenceIds.includes(action.authoredMissionFlowEvidenceId)) {
      flow.evidenceIds.push(action.authoredMissionFlowEvidenceId);
    }
    revealLeadIds(runtime, pack, flow, lead?.unlocksLeadIds);
    flow.selectedLeadId = null;
    flow.selectedLeadAtMinute = null;
    flow.deferredUntilMinute = null;
    syncInvestigationProgress(runtime, pack, flow);
    changed = true;
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_EVIDENCE_VERIFIED",
      minute,
      flowId: pack.id,
      missionId: pack.missionId,
      evidenceId: action.authoredMissionFlowEvidenceId,
      leadId: action.authoredMissionFlowLeadId ?? null,
      unlockedLeadIds: [...flow.unlockedLeadIds],
    });
  }
  if (action.authoredMissionFlowKind === "resolution") {
    const baseRoute = pack.resolution?.choices?.find(
      (entry) => entry.id === action.authoredMissionFlowResolutionRouteId,
    );
    if (!baseRoute) return changed;
    const route = resolveAuthoredResolutionChoice(
      runtime,
      baseRoute,
      action.authoredMissionFlowResolutionContextVariantId,
    );
    const troubleStatus = action.authoredMissionFlowTroubleStatus ?? "active";
    flow.selectedResolutionRouteId = route.id;
    result.summary = route.summaryByTroubleStatus?.[troubleStatus] ?? route.summary;
    const worldEffectFactId = applyResolutionWorldEffect(
      runtime,
      pack,
      route,
      minute,
      troubleStatus,
    );
    const resolutionBranchId = persistAuthoredResolutionBranch(
      runtime,
      pack,
      flow,
      route,
      troubleStatus,
    );
    changed = true;
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_RESOLUTION_SELECTED",
      minute,
      flowId: pack.id,
      missionId: pack.missionId,
      troubleId: pack.troubleId,
      routeId: route.id,
      contextVariantId: route.contextId ?? null,
      resolutionBranchId,
      evidenceOrder: [...flow.evidenceIds],
      openingChoiceId: flow.openingChoiceId,
      troubleStatus,
      worldEffectFactId,
    });
  }
  if (action.authoredMissionFlowKind === "reconsider_lead") {
    const previousLeadId = flow.selectedLeadId;
    flow.selectedLeadId = null;
    flow.selectedLeadAtMinute = null;
    flow.deferredUntilMinute = null;
    result.summary ??= `${pack.title}で追う手掛かりを選び直すことにした。`;
    changed = true;
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_LEAD_RECONSIDERED",
      minute,
      flowId: pack.id,
      missionId: pack.missionId,
      previousLeadId,
    });
  }
  if (action.authoredMissionFlowKind === "premature_resolution"
    && pack.investigation.prematureResolution) {
    flow.prematureResolutionCount += 1;
    if (!flow.prematureResolutionEvidenceCounts.includes(flow.evidenceIds.length)) {
      flow.prematureResolutionEvidenceCounts.push(flow.evidenceIds.length);
    }
    flow.deferredUntilMinute = minute + 60;
    result.summary = pack.investigation.prematureResolution.summary;
    changed = true;
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_PREMATURE_RESOLUTION_REJECTED",
      minute,
      flowId: pack.id,
      missionId: pack.missionId,
      evidenceCount: flow.evidenceIds.length,
    });
  }
  if (action.authoredMissionFlowKind === "defer") {
    const requestedDeferMinutes = Number(action.authoredMissionFlowDeferMinutes ?? 180);
    const deferMinutes = Number.isFinite(requestedDeferMinutes)
      ? Math.max(30, requestedDeferMinutes)
      : 180;
    flow.deferredUntilMinute = minute + deferMinutes;
    result.summary ??= pack.investigation.defer?.summary
      ?? `${pack.title}の調査をいったん保留した。`;
    changed = true;
    runtime.playerState.history.push({
      type: "AUTHORED_MISSION_FLOW_DEFERRED",
      minute,
      flowId: pack.id,
      missionId: pack.missionId,
      untilMinute: flow.deferredUntilMinute,
      movedTo: action.destinationHub ?? action.destinationFacilityId ?? null,
    });
  }
  return changed;
}

export function authoredMissionFlowGuidance(runtime) {
  const pack = availablePack(runtime);
  if (!pack) return null;
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  const step = resolveMissionStepVariant(currentStep(runtime, pack), runtime.playerState);
  if (!step) return null;
  if (step.id === pack.hearing.stepId) return {
    missionId: pack.missionId,
    ...pack.hearing.guidance,
    targetLocation: pack.hearing.targetLocation,
    targetFacilityId: pack.hearing.targetFacilityId,
    actionPanel: runtime.playerState.player.facilityId === pack.hearing.targetFacilityId ? null : "movement",
  };
  if (step.id === pack.investigation.stepId) {
    const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
    if (lead) return {
      missionId: pack.missionId,
      ...pack.investigation.selectedLeadGuidance,
      title: lead.label,
      targetLocation: lead.targetLocation ?? pack.hearing.targetLocation,
      targetFacilityId: lead.facilityId,
      actionPanel: runtime.playerState.player.facilityId === lead.facilityId ? null : "movement",
    };
    if (flow.evidenceIds.length === 0) return {
      missionId: pack.missionId,
      ...pack.investigation.initialGuidance,
      targetLocation: runtime.playerState.player.location,
      targetFacilityId: null,
      actionPanel: null,
    };
    return {
      missionId: pack.missionId,
      ...pack.investigation.continuedGuidance,
      targetLocation: runtime.playerState.player.location,
      targetFacilityId: null,
      actionPanel: null,
    };
  }
  const guidance = step.guidance ?? pack.stepGuidance?.[step.id] ?? pack.postInvestigationGuidance;
  const targetFacilityId = step.targetFacilityId ?? null;
  return {
    missionId: pack.missionId,
    ...guidance,
    targetLocation: step.targetLocation ?? pack.hearing.targetLocation,
    targetFacilityId,
    actionPanel: targetFacilityId
      && runtime.playerState.player.facilityId !== targetFacilityId
      ? "movement"
      : null,
  };
}

function scene(sceneId, priority, when, narrative, speeches = []) {
  return Object.freeze({
    sceneId,
    priority,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze(when.map((condition) => Object.freeze(condition))) }),
    narrative,
    beats: Object.freeze(speeches.map((speech) => Object.freeze({
      kind: "npc",
      ...speech,
    }))),
    choices: Object.freeze([]),
  });
}

function scenesForPack(pack) {
  const scenes = [];
  for (const choice of pack.hearing.choices) {
    scenes.push(scene(
      `mission-flow.${pack.id}.opening.${choice.id}`,
      980,
      [
        { path: "action.id", op: "eq", value: actionId(pack, "OPENING", choice.id) },
        { path: "mission.id", op: "eq", value: pack.missionId },
        { path: "location.facilityId", op: "eq", value: pack.hearing.targetFacilityId },
      ],
      choice.narrative,
      choice.speeches,
    ));
  }
  for (const lead of pack.investigation.leads) {
    scenes.push(scene(
      `mission-flow.${pack.id}.lead.${lead.id}`,
      970,
      [{ path: "action.id", op: "eq", value: actionId(pack, "LEAD", lead.id) }],
      lead.leadNarrative,
    ));
    scenes.push(scene(
      `mission-flow.${pack.id}.lead-hub.${lead.id}`,
      970,
      [
        { path: "action.id", op: "eq", value: actionId(pack, "LEAD_HUB", lead.id) },
        { path: "outcome.ok", op: "isTrue", value: true },
        { path: "location.hub", op: "eq", value: lead.targetLocation },
      ],
      lead.regionalNarrative
        ?? `街道を進み、${lead.targetLocation ?? "次の地域"}へ着いた。${lead.destinationName}はここからさらに先にある。`,
    ));
    scenes.push(scene(
      `mission-flow.${pack.id}.evidence.${lead.id}`,
      965,
      [
        { path: "action.id", op: "eq", value: actionId(pack, "EVIDENCE", lead.id) },
        { path: "outcome.discovery.id", op: "eq", value: lead.discoveryId },
      ],
      lead.discoveryText,
    ));
    scenes.push(scene(
      `mission-flow.${pack.id}.reconsider.${lead.id}`,
      962,
      [{ path: "action.id", op: "eq", value: actionId(pack, "RECONSIDER", lead.id) }],
      `${lead.destinationName}へ向かう判断をいったん保留し、確認済みの情報から別の手掛かりを選び直すことにした。`,
    ));
  }
  for (const route of pack.resolution?.choices ?? []) {
    for (const troubleStatus of ["active", "critical"]) {
      scenes.push(scene(
        `mission-flow.${pack.id}.resolution.${route.id}.${troubleStatus}`,
        968,
        [
          {
            path: "action.id",
            op: "eq",
            value: actionId(pack, "RESOLUTION", `${route.id}:${troubleStatus}`),
          },
          { path: "outcome.ok", op: "isTrue", value: true },
        ],
        route.narrativeByTroubleStatus?.[troubleStatus] ?? route.narrative,
      ));
    }
    for (const followup of route.worldEffect?.followups ?? []) {
      scenes.push(scene(
        `mission-flow.${pack.id}.followup.${route.id}.${followup.id}`,
        975,
        [
          { path: "action.type", op: "eq", value: "conversation" },
          { path: "action.targetNpcId", op: "eq", value: followup.npcId },
          { path: "action.dialogueTopic", op: "eq", value: "direct_contact" },
          { path: `world.flags.${route.worldEffect.flagKey}`, op: "eq", value: route.id },
        ],
        followup.narrative,
        followup.speeches,
      ));
    }
  }
  if (pack.investigation.prematureResolution) {
    const premature = pack.investigation.prematureResolution;
    scenes.push(scene(
      `mission-flow.${pack.id}.premature.${premature.id}`,
      960,
      [{ path: "action.id", op: "eq", value: actionId(pack, "PREMATURE", premature.id) }],
      premature.narrative,
    ));
  }
  if (pack.investigation.defer) {
    const defer = pack.investigation.defer;
    scenes.push(scene(
      `mission-flow.${pack.id}.defer.${defer.id}`,
      955,
      [{ path: "action.id", op: "eq", value: actionId(pack, "DEFER", defer.id) }],
      defer.narrative,
    ));
  }
  return scenes;
}

export const AUTHORED_MISSION_FLOW_SCENES = Object.freeze(
  AUTHORED_MISSION_FLOW_PACKS.flatMap(scenesForPack),
);
