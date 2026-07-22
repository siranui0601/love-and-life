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
    narrative: "田園の村を出て一時間ほど。畑の切れ目から石造りの外壁がせり上がり、やがて王都の門をくぐる。広い道から外れて下層へ下るほど、石畳は継ぎはぎになり、荷車と呼び声が狭い路地へ重なっていく。辿り着いた下層の安宿は、豪華ではないが、旅装を解いて食事と寝床を確保できる場所だった。",
    narrativeByWeatherTag: Object.freeze({
      rain: "田園の村を出る頃から続いた雨で、近郊道は浅い泥へ変わっていた。一時間ほど歩くと、雨幕の向こうに王都の外壁が現れる。門を抜け、濡れた荷車を避けながら下層へ下ると、軒先から落ちる雫の奥に安宿の灯りが見えた。豪華ではないが、濡れた外套を外し、温かい物と寝床を求められる場所だ。",
      storm: "強い風に身体を傾けながら近郊道を進む。王都の外壁へ着くまでの一時間が、普段より長く感じられた。門内でも雨風は路地を吹き抜け、看板が軋んでいる。下層の安宿へ滑り込むと、閉めた戸の向こうでようやく風音が遠のいた。今夜を路上で迎えずに済む場所は確保できそうだ。",
      snow: "近郊道の轍には白いものが残り、吐く息が王都へ近づくほど濃くなる。一時間ほどで外壁へ着き、門を抜けて下層へ入る。石段の端へ寄せられた雪を避けて進むと、安宿の煙突から細い煙が上がっていた。粗末でも、火と食事と寝床があることは大きい。",
      fog: "田園の村を離れると、近郊道の先は薄い霧へ沈んだ。歩いて一時間ほど、輪郭だけだった王都の外壁が間近に現れる。門を越え、鐘と荷車の音を頼りに下層へ下ると、霧の中から安宿の看板が浮かんだ。知らない大都市で、まず戻れる場所を一つ確保した。",
      clear: "田園の村の畑を背に近郊道を進むと、一時間ほどで王都の外壁が見えてきた。門をくぐれば、広い道、荷車、露店の声が一度に押し寄せる。人波を避けて下層へ下り、継ぎはぎの石畳を辿ると、安宿の色褪せた看板へ着く。ここなら食事と寝床を確保し、王都での最初の足場にできる。",
    }),
    beats: Object.freeze([]),
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
