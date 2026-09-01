export const TUTORIALS = [
  {
    id: "overview",
    title: "ゲームの遊び方",
    summary: "コードを組み、駒を自律させ、1位を目指す流れ。",
    view: "editor",
    steps: [
      { title: "コードが駒の頭脳になる", text: "Now Codingは、自分でコードを組み、そのコードで動く駒を戦わせて1位を目指すゲームです。対戦で使う判断そのものを、ここで作ります。", focus: "#programWorkspace" },
      { title: "駒はコードだけで自律する", text: "対戦が始まると、組んだ命令と条件に従って駒が自分で判断して動きます。テスト盤で、コードと動きの対応を何度でも確認できます。", focus: "#testBoard" },
      { title: "より良いコードで勝つ", text: "ゲームモードごとに勝ち方は違っても、核は同じです。盤面を読み、条件を組み、より良いアルゴリズムを作って1位を狙います。" },
    ],
  },
  {
    id: "basics",
    title: "基礎操作",
    summary: "進む・旋回・テスト実行をもう一度確認します。",
    view: "editor",
    steps: [
      { title: "命令を置く", text: "命令はタップでもドラッグでもコード欄へ置けます。まず「進む」を追加してみてください。", focus: '[data-add-block="move"]' },
      { title: "旋回する", text: "左右の旋回は、それぞれ1tickを使います。後退コマンドはなく、旋回を組み合わせて向きを変えます。", focus: '[data-add-block="turnRight"]' },
      { title: "動きを確認する", text: "テスト実行では、保存前のコードをそのまま盤面で走らせられます。", focus: "#runTestButton" },
    ],
  },
  {
    id: "logic",
    title: "条件分岐",
    summary: "前・左・右を観測し、状況で行動を変える方法。",
    view: "editor",
    steps: [
      { title: "周囲を観測する", text: "駒が直接見られるのは前・左・右です。「もし 周囲のマスが…」で、未取得・自分の色・敵の色・崖・尾などを判定できます。", focus: '[data-add-block="ifCell"]' },
      { title: "複数条件を組む", text: "AND・OR・NOTを組み合わせると、『前が安全 かつ 右が崖ではない』のような判断を作れます。", focus: '[data-add-block="ifLogic"]' },
      { title: "Seed乱数", text: "乱数は試合Seedから決まります。同じSeed・同じコードなら同じ結果になるので、再現と検証ができます。", focus: '[data-add-block="ifRandom"]' },
    ],
  },
  {
    id: "variables",
    title: "変数・演算",
    summary: "記憶、四則演算、比較、Seed乱数の保存を使います。",
    view: "editor",
    steps: [
      { title: "値を覚える", text: "変数には数字や真偽値を保存できます。歩数や旋回回数を自分で記録することもできます。", focus: '[data-add-block="setVar"]' },
      { title: "計算する", text: "加減乗除と余りを使えます。方向を0〜3で管理し、余り4を使って向きを循環させるようなコードも作れます。", focus: '[data-add-block="mathVar"]' },
      { title: "値で分岐する", text: "変数を比較して、一定回数ごとに行動を変えることもできます。", focus: '[data-add-block="ifVariable"]' },
    ],
  },
  {
    id: "loops",
    title: "ループ",
    summary: "ずっと・回数繰り返しをtickを跨いで使います。",
    view: "editor",
    steps: [
      { title: "ずっと", text: "「ずっと」の中は対戦中も繰り返されます。身体行動が出るたびに1tick進み、次tickで続きから実行されます。", focus: '[data-add-block="forever"]' },
      { title: "回数を決める", text: "「○回 繰り返す」は指定回数だけ内部の行動を実行したあと、次のブロックへ進みます。", focus: '[data-add-block="repeat"]' },
    ],
  },
  {
    id: "territory",
    title: "陣取り",
    summary: "敵の色が壁になる、上書き不可の陣取りルール。",
    view: "editor",
    mode: "territory",
    steps: [
      { title: "陣取りの目的", text: "無色のマスへ進むと自分の色になります。まずテスト盤を陣取りにして、自分の駒だけで動きを確かめてみましょう。", focus: "#testBoard" },
      { title: "敵の色は壁になる", text: "陣取りでは敵が取った色を上書きできません。『前 ＝ 敵の色』を条件にして旋回すると、無駄な前進を避けられます。", focus: "[data-expression-preset=\"cell\"]" },
      { title: "崖に注意", text: "盤面の外は安全壁ではありません。前進するとそのまま落下してゲームオーバーです。" },
      { title: "勝敗", text: "終了時に最も多くのマスを取っていた駒が勝ちます。" },
    ],
  },
  {
    id: "cobra",
    title: "コブラ",
    summary: "毎tick必ず進み、伸びる尾を避けて生き残ります。",
    view: "editor",
    mode: "cobra",
    steps: [
      { title: "コブラは毎tick進む", text: "コブラではコードが止まっても本体は直進し続けます。旋回命令は向きを変え、そのtickにも1マス進みます。テスト盤で『進む』だけのコードを走らせて違いを確認できます。", focus: "#testBoard" },
      { title: "尾に触れない", text: "自分の尾でも敵の尾でも、残っている尾に当たればゲームオーバーです。ただし、そのtickで消える最後尾へ入るのはセーフです。" },
      { title: "正面衝突", text: "同じマスへ正面から入った場合や頭同士が入れ替わる場合は、双方ゲームオーバーです。最後まで生き残った駒が勝ちます。" },
    ],
  },
  {
    id: "fall",
    title: "床抜け",
    summary: "2tick連続で移動しないと足元が崩れる生存戦。",
    view: "editor",
    mode: "fall",
    steps: [
      { title: "床抜けは停止が危険", text: "旋回を1回するだけならセーフですが、2tick連続で前進しないと足元が崩れます。テスト盤で旋回を2つ並べて挙動を確認できます。", focus: "#testBoard" },
      { title: "2tick止まると落下", text: "「右に旋回 → 右に旋回」のように2tick連続で前進しないと、足元の床が崩れてゲームオーバーです。" },
      { title: "生存時間を競う", text: "崖、崩れた床、他の駒との衝突を避け、最後まで生き残ることを目指します。" },
    ],
  },
  {
    id: "splat",
    title: "スプラ",
    summary: "上書き可能な塗りとインク攻撃を組み合わせます。",
    view: "editor",
    mode: "splat",
    steps: [
      { title: "スプラは塗り替えられる", text: "陣取りと違い、敵の色へ進むとそのマスを自分の色へ塗り替えられます。まずNPCなしで移動とインク回復の関係をテスト盤で確認しましょう。", focus: "#testBoard" },
      { title: "攻撃とインク", text: "前方攻撃は1tickを使い、消費インクは『基本1 + 射程』です。インク不足なら攻撃命令はtickを消費せず、次の命令を探します。" },
      { title: "自陣で回復する", text: "最初のインクは0です。すでに自分の色だったマスの上で、攻撃せずに行動したtickはインクが1回復します。新しく塗ったtickでは回復しません。" },
    ],
  },
  {
    id: "online",
    title: "オンライン対戦",
    summary: "公開・プライベートルーム、準備、NPC補充の流れ。",
    view: "battle",
    battleKind: "online",
    steps: [
      { title: "ルーム主", text: "ルーム主はゲームモード、人数、盤面、Seed、NPC補充などを先に決めてから募集を開始します。" },
      { title: "公開とプライベート", text: "公開ルームは募集中一覧から入れます。プライベートルームは一覧に出ず、6桁のルームIDを知っている人だけ入室できます。" },
      { title: "準備して開始", text: "参加者は使う駒を選んで準備OKにします。ルーム主が開始すると、全員へ同じSeedとコードが配られ、同一の試合を再現します。" },
    ],
  },
];

export function tutorialById(id) {
  return TUTORIALS.find((tutorial) => tutorial.id === id) || null;
}
