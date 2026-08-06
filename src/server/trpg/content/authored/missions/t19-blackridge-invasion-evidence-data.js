const freeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
};

const F = freeze;
export const GROUPS = [
  ["T19-EVIDENCE-SERIE-FOREST-CORRIDOR-SURVEY", "T19-EVIDENCE-YURI-BORDER-TRACK-LAYERS", "T19-EVIDENCE-FEN-DUAL-FOOTFALL-LOG"],
  ["T19-EVIDENCE-ZAID-THREAT-ASSESSMENT", "T19-EVIDENCE-ORKA-CAPITAL-CRISIS-REPORT", "T19-EVIDENCE-EDGAR-PERSECUTION-TESTIMONY"],
  ["T19-EVIDENCE-KEETS-DUAL-ORDER-REGISTER", "T19-EVIDENCE-GARM-MOBILIZATION-LEDGER", "T19-EVIDENCE-COUNCIL-WAR-VOTE-RULE"],
  ["T19-EVIDENCE-ROYAL-DEFENSE-ALLOCATION", "T19-EVIDENCE-VIKTOR-GATE-ROSTER", "T19-EVIDENCE-ROSALIND-REINFORCEMENT-MAP"],
  ["T19-EVIDENCE-HENRIK-SUPPLY-CORRIDOR", "T19-EVIDENCE-CASSIA-WEAPON-QUALITY-LEDGER", "T19-EVIDENCE-STABLE-REQUISTION-TIMETABLE"],
  ["T19-EVIDENCE-SAMIRA-OLD-CONTACT-ROUTE", "T19-EVIDENCE-BLACKRIDGE-CIVILIAN-EVACUATION", "T19-EVIDENCE-RECIPROCAL-ARMISTICE-SAFEGUARDS"],
];

const lead = (id, targetLocation, facilityId, destinationName, label, discoveryId, discoveryText, minutes, leadNarrative, primaryNpcId = null, regionalNarrative = null) => ({
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
  regionalNarrative,
  approachId: `t19-${id.replaceAll("_", "-")}`,
});

export const LEADS = [
  lead("serie_forest_corridor_survey", "森", "LOC_FOREST_CAMP", "森の野営地・斥候踏査図", "セリエの踏査図から、世界樹倒壊後にだけ連続した王都方面の通行線を復元する", GROUPS[0][0], "森の迷いが消えた後、黒嶺軍営から王都北東門まで、軍獣と補給車が通れる一本の乾いた線が初めて連続した。", 48, "近道の発見として扱わず、道幅、補給間隔、退路、民間避難枝道を重ねる。", "NPC029", "森へ入り、倒壊後に生じた軍用通路と旧避難枝道を分けて調べる。"),
  lead("yuri_border_track_layers", "北陵要塞", "LOC_FORT_WALL", "北壁・国境足跡重ね図", "ユーリの足跡記録から、偵察、軍獣、補給隊の三段階を時刻順に分ける", GROUPS[0][1], "Day63の翼斥候、Day70の軍獣馴致隊、Day76予定の前衛隊は別行動で、まだ全軍命令が確定する前に止められる窓がある。", 46, "黒嶺の足跡を一括して侵攻と決めず、人数、荷重、戻り跡を層別する。", "NPC042", "北陵要塞へ向かい、国境と森出口に残る三段階の足跡を照合する。"),
  lead("fen_dual_footfall_log", "エルフの隠れ里", "LOC_ELF_REFUGE_PATH", "避難枝道・足音聞分け札", "フェンの聞分け札と避難民の記録から、侵攻隊と追われた民間人の足音を分離する", GROUPS[0][2], "森を通った全てが兵ではなく、王国から逃げた亜人と、黒嶺の偵察隊が別時刻に同じ枝道を使っていた。", 44, "足音の大きさだけでなく、隊列、子どもの歩幅、軍獣の爪痕を分ける。", "NPC104", "倒壊後の避難枝道へ入り、兵と避難民が重なった通行記録を読む。"),

  lead("zaid_threat_assessment", "黒嶺連合領", "LOC_BLACKRIDGE_COUNCIL", "連合評議場・先制脅威評価簿", "ザイードの反対意見と評議会資料から、侵攻派が何を王国の先制攻撃と見なしたか確定する", GROUPS[1][0], "黒嶺が恐れたのは森道そのものではなく、第二召喚、巨神兵への大規模派兵、亜人狩りが同時に見えたことだった。", 55, "穏健派の結論だけでなく、侵攻派が引用した王国側の事実と誤認を一件ずつ分ける。", "NPC043", "黒嶺連合領の評議場へ入り、先制防衛論の根拠を公文書で確かめる。"),
  lead("orka_capital_crisis_report", "王都", "LOC_CAP_LOWER_INN", "王都下層宿・密使危機報告", "オルカが送れなかった報告から、召喚・排斥・神殿派兵が黒嶺へどう伝わったか追う", GROUPS[1][1], "王都の別々の危機は黒嶺で『亜人排除を伴う総動員』という一つの物語に束ねられ、侵攻派へ利用されていた。", 51, "密使の推測だけでなく、暗号文、配達時刻、途中で加筆された見出しを比較する。", "NPC046", "王都下層へ戻り、黒嶺へ届く前に歪んだ危機報告を復元する。"),
  lead("edgar_persecution_testimony", "黒嶺連合領", "LOC_BLACKRIDGE_EXILE", "亡命者区・王都排斥証言帳", "エドガーと亡命者の証言をT16の公記録と突き合わせ、実害と扇動を分ける", GROUPS[1][2], "亜人狩りの実害は存在したが、王都全体が殲滅を決めたという侵攻派の説明は、貴族派の扇動記事を拡大したものだった。", 57, "被害を否定せず、誰が命令し、誰が抵抗し、誰を守れたかまで記録する。", "NPC047", "黒嶺の亡命者区へ向かい、王都から逃げた人々の証言を公記録と照合する。"),

  lead("keets_dual_order_register", "黒嶺連合領", "LOC_BLACKRIDGE_COUNCIL", "評議場・翼伝令二重命令簿", "ケーツが受けた穏健派と侵攻派の二つの命令を時刻・印章・宛先で分ける", GROUPS[2][0], "全軍進撃命令はまだ評議会の正式印を欠き、ガルムの前衛命令だけが先行している。正式投票前なら伝令網を止められる。", 49, "伝令を責めず、同じ時刻に届いた二つの命令と印章の権限差を読む。", "NPC108", "黒嶺評議場へ入り、翼伝令が運ぶ二重命令の正統性を確かめる。"),
  lead("garm_mobilization_ledger", "黒嶺連合領", "LOC_BLACKRIDGE_BARRACKS", "黒嶺軍営・先行動員簿", "ガルムの軍獣割当、補給日数、突破時刻から、前衛だけを止める交渉点を探す", GROUPS[2][1], "ガルムはDay76突破を前提に軍獣と三日分の補給だけを先行させ、評議会の長期戦承認は得ていない。", 53, "武力だけを数えず、補給期限、帰還条件、兵の家族所在地を重ねる。", "NPC044", "黒嶺軍営へ向かい、侵攻派の先行動員と全軍命令の差を調べる。"),
  lead("council_war_vote_rule", "黒嶺連合領", "LOC_BLACKRIDGE_COUNCIL", "連合評議場・戦時投票石列", "種族代表ごとの投票石と過去停戦条項から、侵攻を合法に止める票と手順を確定する", GROUPS[2][2], "全面侵攻には三種族代表と軍営代表の四鍵が必要で、王国側の相互撤兵証明が届けば再投票を強制できる。", 50, "穏健派のお願いではなく、侵攻派も従わざるを得ない手続を復元する。", null, "黒嶺評議場で、戦時投票の成立条件と再投票条項を調べる。"),

  lead("royal_defense_allocation", "王都", "LOC_CAP_CASTLE", "王城軍議卓・三正面配兵表", "王城の召喚、神殿、森側配兵を重ね、どの部隊を戻せば王都と神殿を同時に守れるか示す", GROUPS[3][0], "T18で主力を残せた場合、北東門へ二個隊を戻し、神殿は技師・警備混成隊へ縮小すれば双方を維持できる。", 58, "総兵数だけでなく、移動時間、指揮系統、門ごとの最低守備を計算する。", "NPC016", "王城の軍議卓へ向かい、三正面へ割れた王都兵力を組み直す。"),
  lead("viktor_gate_roster", "王都", "LOC_CAP_CASTLE", "王城外郭・北東門交代表", "ヴィクトルの門番交代表から、森突破時に空く時刻と市民避難の警備線を確定する", GROUPS[3][1], "Day82前後は神殿派遣と夜間交代が重なり、北東門が九十分だけ薄くなる。下層衛兵を避難誘導へ回す代替案がある。", 47, "防衛だけでなく、亜人街と下層の避難を守る人数も残す。", "NPC024", "王都外郭へ向かい、北東門の交代と市民避難警備を照合する。"),
  lead("rosalind_reinforcement_map", "北陵要塞", "LOC_FORT_COMMAND", "要塞司令部・二正面援軍図", "ロザリンドの援軍図から、国境を無防備にせず王都へ送れる部隊と到着時刻を確定する", GROUPS[3][2], "T12の偽装襲撃を公式否定できていれば、要塞は国境守備を保ったまま機動隊を王都北東へ送れる。", 54, "援軍要請だけでなく、国境抑止、馬、食料、到着時刻を同じ地図へ置く。", "NPC039", "北陵要塞の司令部へ向かい、国境と王都を両立する援軍線を設計する。"),

  lead("henrik_supply_corridor", "北陵要塞", "LOC_FORT_SUPPLY", "補給倉庫・七日分回廊帳", "ヘンリクの在庫とT14/T15の流通記録から、王都防衛と和平使節を同時に支える補給線を作る", GROUPS[4][0], "密輸・外国契約を整理できていれば、要塞と交易都市の正規在庫で七日分の防衛・避難・使節補給を賄える。", 52, "武器だけでなく、食料、医薬、馬料、使節の通行証を一つの回廊として組む。", "NPC090", "北陵要塞の補給倉庫へ向かい、戦闘と停戦双方を支える七日分の補給を確認する。"),
  lead("cassia_weapon_quality_ledger", "王都", "LOC_CAP_WEAPON_SHOP", "王都武器屋・刻印品質帳", "カッシアの刻印帳から、粗悪武器・外国兵器・正規補給を分け、誤射と暴発を防ぐ", GROUPS[4][1], "T09/T14/T15の結果で王都の武器品質が変わり、粗悪品を前線から外せば停戦使節への誤射と長期戦の崩壊を減らせる。", 45, "価格ではなく刻印、修理履歴、配備先まで追う。", "NPC065", "王都武器屋へ向かい、終盤の武器品質と配備先を監査する。"),
  lead("stable_requisition_timetable", "王都", "LOC_CAP_STABLE", "王都駅馬車場・軍馬徴発時刻表", "軍馬と民間馬車の徴発表から、援軍、使節、避難民の移動が衝突しない時刻を作る", GROUPS[4][2], "軍が全馬を先取りすると停戦使節と避難が止まる。軍馬、駅馬車、裏厩舎回収馬を三用途へ分ければ全てを動かせる。", 43, "速い馬を奪い合わず、用途、返却、御者、夜間休息まで割り当てる。", "NPC069", "王都駅馬車場へ向かい、軍馬・使節馬・避難馬車の時刻を組み直す。"),

  lead("samira_old_contact_route", "王都", "LOC_CAP_AJIN_QUARTER", "亜人街・古い黒嶺連絡路", "サミラが守った古い連絡印とT16救済記録から、軍を通さない停戦連絡路を復旧する", GROUPS[5][0], "亜人街を守った履歴があれば、黒嶺外門はサミラの連絡印を民間停戦使節として認める。", 50, "秘密路を軍事侵入に転用せず、使節人数、印、帰還期限を限定する。", "NPC026", "王都亜人街へ向かい、黒嶺へ届く非軍事の連絡路を確かめる。"),
  lead("blackridge_civilian_evacuation", "黒嶺連合領", "LOC_BLACKRIDGE_COMMON_INN", "灰角の共同宿・家族避難割当", "マルヴァ、ラシャ、ミトの生活圏から、軍営化しない民間避難と帰還保証を組む", GROUPS[5][1], "市場、水路、亡命者区から共同宿へ家族を集め、軍営とは別の避難旗を使えば王国側も非戦闘員として識別できる。", 56, "人数だけでなく、子ども、負傷者、異種族の食事、水路移動を含める。", "NPC105", "黒嶺の共同宿へ向かい、侵攻軍と切り離した民間避難計画を作る。"),
  lead("reciprocal_armistice_safeguards", "北陵要塞", "LOC_FORT_COMMAND", "要塞司令部・相互停戦保証卓", "過去停戦、T12不在証明、黒嶺再投票条項を一枚へまとめ、双方が破れない検証手順を作る", GROUPS[5][2], "翼伝令、要塞斥候、亜人街使節の三者が同時確認し、双方の前衛を一里ずつ戻すことで停戦違反の捏造を防げる。", 60, "善意だけに頼らず、確認者、距離、時刻、違反時の再協議を明記する。", "NPC039", "北陵要塞で、王国と黒嶺双方が検証できる停戦保証を設計する。"),
];
