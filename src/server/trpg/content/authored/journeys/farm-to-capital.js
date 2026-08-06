const FARM_TO_CAPITAL_ARRIVAL_CONDITIONS = Object.freeze({
  all: Object.freeze([
    Object.freeze({ path: "action.type", op: "eq", value: "move" }),
    Object.freeze({ path: "action.movementScope", op: "eq", value: "regional" }),
    Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
    Object.freeze({ path: "journey.fromHub", op: "eq", value: "田園の村" }),
    Object.freeze({ path: "journey.toHub", op: "eq", value: "王都" }),
    Object.freeze({ path: "journey.arrivalVisitCount", op: "eq", value: 1 }),
    Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_LOWER_INN" }),
  ]),
});

export const FARM_TO_CAPITAL_SCENES = Object.freeze([
  Object.freeze({
    sceneId: "journey.farm_to_capital.first_arrival",
    priority: 900,
    presentationOnly: true,
    when: FARM_TO_CAPITAL_ARRIVAL_CONDITIONS,
    narrative: "田園の村を出て一時間ほど。畑の切れ目から石造りの外壁がせり上がり、やがて王都の門をくぐる。広い道から外れて下層へ下るほど、石畳は継ぎはぎになり、荷車と呼び声が狭い路地へ重なっていく。辿り着いた下層の安宿は、豪華ではないが、旅装を解いて食事と寝床を確保できる場所だった。帳場の主人は旅装を見て、『装備を見るなら、坂を上がった王都武器屋だ。剣だけじゃない。槍も弓も杖もあるし、買えなくても試しに握らせてもらえる』と教えた。 帳場脇の路線図には、交易都市、犯罪都市、辺境の村、北陵要塞、ドワーフ洞窟、古代神殿、森へ続く道が記されている。武器屋へ寄るか、別の土地へ旅立つかは自分で決められる。",
    narrativeByWeatherTag: Object.freeze({
      rain: "田園の村を出る頃から続いた雨で、近郊道は浅い泥へ変わっていた。一時間ほど歩くと、雨幕の向こうに王都の外壁が現れる。門を抜け、濡れた荷車を避けながら下層へ下ると、軒先から落ちる雫の奥に安宿の灯りが見えた。帳場の主人は濡れた旅装を見て、『装備を乾かすついでに、坂の上の王都武器屋を覗くといい。剣も槍も弓も杖も、買う前に試せる』と教えた。 帳場脇の路線図には、交易都市、犯罪都市、辺境の村、北陵要塞、ドワーフ洞窟、古代神殿、森へ続く道が記されている。武器屋へ寄るか、別の土地へ旅立つかは自分で決められる。",
      storm: "強い風に身体を傾けながら近郊道を進む。王都の外壁へ着くまでの一時間が、普段より長く感じられた。門内でも雨風は路地を吹き抜け、看板が軋んでいる。下層の安宿へ滑り込むと、閉めた戸の向こうでようやく風音が遠のいた。帳場の主人は『風が弱まったら坂の上の王都武器屋へ行くといい。剣だけでなく槍、弓、杖も扱っていて、試し持ちもできる』と道を示した。 帳場脇の路線図には、交易都市、犯罪都市、辺境の村、北陵要塞、ドワーフ洞窟、古代神殿、森へ続く道が記されている。武器屋へ寄るか、別の土地へ旅立つかは自分で決められる。",
      snow: "近郊道の轍には白いものが残り、吐く息が王都へ近づくほど濃くなる。一時間ほどで外壁へ着き、門を抜けて下層へ入る。石段の端へ寄せられた雪を避けて進むと、安宿の煙突から細い煙が上がっていた。帳場の主人は火のそばを勧めながら、『装備を整えるなら坂の上の王都武器屋だ。剣、槍、弓、杖を試して、自分に合うものを探せる』と教えた。 帳場脇の路線図には、交易都市、犯罪都市、辺境の村、北陵要塞、ドワーフ洞窟、古代神殿、森へ続く道が記されている。武器屋へ寄るか、別の土地へ旅立つかは自分で決められる。",
      fog: "田園の村を離れると、近郊道の先は薄い霧へ沈んだ。歩いて一時間ほど、輪郭だけだった王都の外壁が間近に現れる。門を越え、鐘と荷車の音を頼りに下層へ下ると、霧の中から安宿の看板が浮かんだ。帳場の主人は戻る道を説明したあと、『坂を上がれば王都武器屋がある。剣だけでなく槍や弓、杖も試せるから、目印にするといい』と付け加えた。 帳場脇の路線図には、交易都市、犯罪都市、辺境の村、北陵要塞、ドワーフ洞窟、古代神殿、森へ続く道が記されている。武器屋へ寄るか、別の土地へ旅立つかは自分で決められる。",
      clear: "田園の村の畑を背に近郊道を進むと、一時間ほどで王都の外壁が見えてきた。門をくぐれば、広い道、荷車、露店の声が一度に押し寄せる。人波を避けて下層へ下り、継ぎはぎの石畳を辿ると、安宿の色褪せた看板へ着く。帳場の主人は王都での足場を説明し、『装備を見るなら坂の上の王都武器屋へ行くといい。剣、槍、弓、杖を扱っていて、買う前に試せる』と教えた。 帳場脇の路線図には、交易都市、犯罪都市、辺境の村、北陵要塞、ドワーフ洞窟、古代神殿、森へ続く道が記されている。武器屋へ寄るか、別の土地へ旅立つかは自分で決められる。",
    }),
    beats: Object.freeze([]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "journey.capital_weapon_shop.first_guided_arrival_unattended",
    priority: 891,
    presentationOnly: true,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "action.type", op: "eq", value: "move" }),
        Object.freeze({ path: "action.destinationFacilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
        Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
        Object.freeze({ path: "story.capitalWeaponShopFirstVisitNow", op: "isTrue", value: true }),
        Object.freeze({ path: "story.capitalWeaponShopkeeperPresent", op: "eq", value: false }),
      ]),
    }),
    narrative: "坂の上の武器屋へ着いたが、扉の掛け札は裏返され、店内に人の気配はない。窓越しには剣と槍、奥には弓と杖が用途ごとに並び、中央には試し振りのためらしい空間が見える。戸口脇の札には『戻り次第、試し持ち可』とだけあり、今は店主が戻る頃に改めるほかなさそうだ。",
    beats: Object.freeze([]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "journey.capital_weapon_shop.first_guided_arrival",
    priority: 890,
    presentationOnly: true,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "action.type", op: "eq", value: "move" }),
        Object.freeze({ path: "action.destinationFacilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
        Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
        Object.freeze({ path: "story.capitalWeaponShopFirstVisitNow", op: "isTrue", value: true }),
        Object.freeze({ path: "story.capitalWeaponShopkeeperPresent", op: "isTrue", value: true }),
      ]),
    }),
    narrative: "坂を上がるにつれ、露店の声に混じって槌の音が近づく。王都武器屋の戸を押すと、油と革と削った木の匂いがした。壁には剣と槍、奥には弓と杖が、値札ではなく用途ごとに分けて並んでいる。店の中央だけ床が空けてあり、握りや構えを確かめるための場所だと分かる。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC065",
        text: "最初から一本に決める必要はない。剣は近く、槍は一歩遠く、弓はもっと遠く、杖は魔力の扱い方で変わる。まずは、怖くなった時にどう動けそうかを考えろ。買う話は、そのあとでいい。",
        emotion: "職人らしい落ち着き",
      }),
    ]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "journey.capital_weapon_shop.first.ask_style",
    priority: 885,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: "CAPITAL_WEAPON_SHOP:FIRST:ASK_STYLE" }),
      Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
      Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
    ]) }),
    narrative: "店主はすぐに商品を勧めず、旅装と立ち方を見比べた。何を倒したいかではなく、危険に出会った時に近づきたいか、距離を取りたいかを問い直してくる。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC065",
        text: "まだ分からないなら、それでいい。前へ出るのが怖くないなら剣か槍、距離を取りたいなら弓、術を軸にするなら杖だ。ただし旅では、狭い道や雨の日もある。格好ではなく、困った時にも扱える一本を選べ。",
        emotion: "率直な助言",
      }),
    ]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "journey.capital_weapon_shop.first.compare_handling",
    priority: 885,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: "CAPITAL_WEAPON_SHOP:FIRST:COMPARE_HANDLING" }),
      Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
      Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
    ]) }),
    narrative: "剣は腰の近くで収まり、槍は穂先より後ろの長さが気になる。弓は引く前に足場を要し、杖は振る武器というより集中する場所を定める道具だった。持ち替えるたび、同じ『武器』でも要求される距離と姿勢がまるで違うと分かる。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC065",
        text: "数値だけなら札を読めば済む。だが、狭い路地で槍を扱えるか、雨で弓弦を守れるか、疲れた時に杖へ魔力を通せるかは、持った本人にしか分からない。",
        emotion: "実地を重んじる口調",
      }),
    ]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "journey.capital_weapon_shop.first.set_budget",
    priority: 885,
    presentationOnly: true,
    when: Object.freeze({ all: Object.freeze([
      Object.freeze({ path: "action.id", op: "eq", value: "CAPITAL_WEAPON_SHOP:FIRST:SET_BUDGET" }),
      Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
      Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_WEAPON_SHOP" }),
    ]) }),
    narrative: "所持金と今の装備を見せると、店主は高価な棚を先に閉じた。新品、中古、依頼の間だけ借りられる品を分け、帰りの食事代まで使い切らない範囲へ候補を絞っていく。",
    beats: Object.freeze([
      Object.freeze({
        kind: "npc",
        actorId: "NPC065",
        text: "武器を買って、飯も宿も失うのが一番まずい。今日は試すだけでもいい。中古で間に合わせる手も、仕事に合わせて借りる手もある。旅を続けられる金を残して選べ。",
        emotion: "商売より旅の継続を優先",
      }),
    ]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "journey.capital_lower_inn.meal",
    priority: 850,
    presentationOnly: true,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "action.type", op: "eq", value: "eat" }),
        Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_LOWER_INN" }),
      ]),
    }),
    narrative: "下層の安宿で、湯気の立つ椀と固いパンを受け取る。華やかな王都料理ではない。それでも、歩き通した身体には塩気と温かさが染み、空腹で急いていた思考が少しずつ落ち着いていった。",
    beats: Object.freeze([]),
    choices: Object.freeze([]),
  }),
  Object.freeze({
    sceneId: "journey.capital_lower_inn.lodging",
    priority: 850,
    presentationOnly: true,
    when: Object.freeze({
      all: Object.freeze([
        Object.freeze({ path: "action.type", op: "eq", value: "rest" }),
        Object.freeze({ path: "action.lodging", op: "isTrue", value: true }),
        Object.freeze({ path: "outcome.ok", op: "isTrue", value: true }),
        Object.freeze({ path: "location.facilityId", op: "eq", value: "LOC_CAP_LOWER_INN" }),
      ]),
    }),
    narrative: "薄い壁の向こうから人の出入りと床板の軋みが聞こえる。上等な部屋ではないが、戸を閉められ、荷物を手元へ置いて横になれる。王都下層の夜は完全には静まらない。それでも路上より深く眠れ、目を覚ます頃には歩き続けた疲れが抜けていた。",
    narrativeByWeatherTag: Object.freeze({
      rain: "雨粒が屋根を細かく叩き、廊下には濡れた靴の跡が続いている。薄い壁と固い寝台でも、戸の外に雨を残して横になれるだけで身体は緩んだ。王都下層の物音を遠くに聞きながら眠り、目を覚ます頃には歩き続けた疲れが抜けていた。",
      storm: "風が建物を揺らし、ときおり窓板が鳴る。路上なら眠るどころではなかっただろう。安宿の戸を閉め、荷物を抱え込むようにして横になる。完全な静けさはなくても、雨風を遮る壁の内側で眠り、身体を立て直すことができた。",
      snow: "外の冷気を戸の向こうへ残し、狭い寝台へ身体を沈める。薄い毛布でも、風を防ぐ壁と消えかけの火がある。王都下層の足音を聞きながら眠り、朝には凍えて強張っていた身体が動くようになっていた。",
    }),
    beats: Object.freeze([]),
    choices: Object.freeze([]),
  }),
]);
