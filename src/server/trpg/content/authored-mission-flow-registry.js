export const AUTHORED_MISSION_FLOW_VERSION = "authored-mission-flow-v2";

const ACTIVE_TROUBLE_STATUSES = new Set(["active", "critical"]);
const ACTIVE_MISSION_STATUSES = new Set(["active", "available", "in_progress"]);

export const AUTHORED_MISSION_FLOW_PACKS = Object.freeze([
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
  };
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
  return state;
}

export function applyAuthoredMissionFlowCatalogOverrides(catalog) {
  for (const pack of AUTHORED_MISSION_FLOW_PACKS) {
    const mission = catalog.special.find((entry) => entry.id === pack.missionId);
    if (!mission) continue;
    for (const [section, definition] of [
      ["hearing", pack.hearing],
      ["investigation", pack.investigation],
    ]) {
      const step = mission.steps.find((entry) => entry.id === definition?.stepId);
      if (step) Object.assign(step, pack.catalogOverride?.[section] ?? {});
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
  return {
    ...(movement ?? {}),
    id: actionId(pack, actionKind, lead.id),
    type: movement ? "move" : "plan",
    family: movement ? "move" : "prepare",
    minutes: movement ? movement.minutes : 8,
    label: movement?.movementScope === "regional"
      ? `${targetLocation}へ戻り、${lead.label}`
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
    const step = currentStep(runtime, pack);
    if (step?.id !== pack.investigation.stepId) continue;
    const flow = ensureAuthoredMissionFlowState(runtime, pack);
    const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
    if (!lead || lead.facilityId !== runtime.playerState.player.facilityId) continue;
    const actions = selectedLeadActions(runtime, pack, movementActions, flow);
    if (actions?.length === 3) return actions;
  }
  for (const pack of packs) {
    const step = currentStep(runtime, pack);
    if (!step) continue;
    const flow = ensureAuthoredMissionFlowState(runtime, pack);
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
    if (evidenceIds.size >= pack.investigation.requiredEvidenceCount) continue;
    const actions = leadSelectionActions(runtime, pack, movementActions, flow, evidenceIds);
    if (actions?.length === 3) return actions;
  }
  return null;
}

function evidenceActionForPack(runtime, pack) {
  const step = currentStep(runtime, pack);
  if (step?.id !== pack.investigation.stepId) return null;
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
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
  const step = currentStep(runtime, pack);
  if (step?.id === pack.hearing.stepId) {
    const present = runtime.playerState.authoritativePresentNpcIds;
    return runtime.playerState.player.facilityId === pack.hearing.targetFacilityId
      && present instanceof Set
      && present.has(pack.hearing.npcId);
  }
  if (step?.id !== pack.investigation.stepId) return false;
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
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
    runtime.playerKnowledge.knownFacilityIds ??= new Set();
    runtime.playerKnowledge.knownFacilityIds.add(lead.facilityId);
  }
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
  const step = currentStep(runtime, pack);
  if (!step) return null;
  const flow = ensureAuthoredMissionFlowState(runtime, pack);
  if (step.id === pack.hearing.stepId) return {
    missionId: pack.missionId,
    ...pack.hearing.guidance,
    targetFacilityId: pack.hearing.targetFacilityId,
    actionPanel: runtime.playerState.player.facilityId === pack.hearing.targetFacilityId ? null : "movement",
  };
  if (step.id === pack.investigation.stepId) {
    const lead = pack.investigation.leads.find((entry) => entry.id === flow.selectedLeadId);
    if (lead) return {
      missionId: pack.missionId,
      ...pack.investigation.selectedLeadGuidance,
      title: lead.label,
      targetFacilityId: lead.facilityId,
      actionPanel: runtime.playerState.player.facilityId === lead.facilityId ? null : "movement",
    };
    if (flow.evidenceIds.length === 0) return {
      missionId: pack.missionId,
      ...pack.investigation.initialGuidance,
      targetFacilityId: null,
      actionPanel: null,
    };
    return {
      missionId: pack.missionId,
      ...pack.investigation.continuedGuidance,
      targetFacilityId: null,
      actionPanel: null,
    };
  }
  return {
    missionId: pack.missionId,
    ...pack.postInvestigationGuidance,
    targetFacilityId: null,
    actionPanel: null,
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
