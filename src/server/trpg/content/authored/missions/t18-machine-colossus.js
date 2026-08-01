const freeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
};

const F = freeze;
const GROUPS = [
  ["T18-EVIDENCE-ARWEN-ROOT-SEAL-CHRONOLOGY", "T18-EVIDENCE-ELINA-SEVERED-ROOT-ECHO", "T18-EVIDENCE-BARRIER-STONE-PRECOLLAPSE-LOG"],
  ["T18-EVIDENCE-LUCA-COMMAND-PLATE-GRAMMAR", "T18-EVIDENCE-COLOSSUS-WARNING-SEQUENCE", "T18-EVIDENCE-TEMPLE-DUTY-REGISTER"],
  ["T18-EVIDENCE-KEINA-GATE-DAMAGE-MAP", "T18-EVIDENCE-ROAD-GAIT-SURVEY", "T18-EVIDENCE-MAINTENANCE-DRONE-JOINT-WEAR"],
  ["T18-EVIDENCE-BROLUN-TORQUE-LEDGER", "T18-EVIDENCE-MINA-GOVERNOR-LOCK", "T18-EVIDENCE-CORE-COOLING-CHANNELS"],
  ["T18-EVIDENCE-T17-FREQUENCY-SEPARATION", "T18-EVIDENCE-ROYAL-TROOP-DIVERSION-ORDER", "T18-EVIDENCE-SERAPHIM-DUAL-CAUSE-MEASUREMENT"],
  ["T18-EVIDENCE-ELINA-ROOT-THREAD-RITE", "T18-EVIDENCE-TEMPLE-EVACUATION-SHUTTERS", "T18-EVIDENCE-DWARF-ANCHOR-PYLONS"],
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
  approachId: `t18-${id.replaceAll("_", "-")}`,
});

const LEADS = [
  lead("arwen_root_seal_chronology", "エルフの隠れ里", "LOC_ELF_COUNCIL", "長老庵・根系封印年表", "アルウェンの年表と古い結界石の交換記録から、世界樹が巨神兵封印を支えていた順序を確定する", GROUPS[0][0], "巨神兵封印は世界樹の根圧と三つの結界石へ分散され、Day60の倒壊で最後の荷重が神殿側へ戻っていた。召喚波より古い機構だった。", 54, "長老の警告だけでなく、根圧、結界石交換、神殿側の振動時刻を一つの年表へ戻す。", "NPC028", "迷いの森を越え、エルフの隠れ里で世界樹と巨神兵封印の古い接続を調べる。"),
  lead("elina_severed_root_echo", "エルフの隠れ里", "LOC_ELF_WORLD_TREE", "倒壊した世界樹・根の共鳴点", "エリナが感じた三つの断裂音を神殿の起動時刻と照合する", GROUPS[0][1], "世界樹が倒れた瞬間、三本の根系封印が順番に切れ、最後の断裂から巨神兵の整備子機が動き始めた。", 49, "比喩だけで終わらせず、断裂した根の位置、精霊光、神殿側の警告鐘を対応させる。", "NPC030", "世界樹の倒壊跡へ入り、根系封印が切れた順番を現地で確かめる。"),
  lead("barrier_stone_precollapse_log", "エルフの隠れ里", "LOC_ELF_BARRIER_STONE", "結界石の輪・倒壊前記録", "結界管理記録から、Day1以前から続く根圧低下とDay60の最終断裂を分ける", GROUPS[0][2], "結界石はDay1以前から弱っていたが、巨神兵へ直結する三石が完全停止したのは世界樹倒壊時だった。", 47, "新しい損傷だけでなく、百年前の基準値、直近の低下、倒壊時の零値を比べる。", "NPC102", "結界石の輪へ向かい、召喚事故より前から続いた封印劣化を読む。"),

  lead("luca_command_plate_grammar", "古代神殿", "LOC_TEMPLE_ADMIN", "神殿管理棟・古代命令板写し", "ルカの翻刻と原板の語順から、巨神兵の任務と停止句を分離する", GROUPS[1][0], "巨神兵の本来任務は『王都を攻める』ではなく『中央炉の異常を排除し、保守座へ帰還する』だった。王都進軍は中央炉位置の誤認で起きている。", 55, "翻訳の結論を信じ切らず、命令動詞、対象座標、帰還句を原板と照合する。", "NPC056", "古代神殿の管理棟へ向かい、巨神兵の原命令を翻刻し直す。"),
  lead("colossus_warning_sequence", "古代神殿", "LOC_TEMPLE_COLOSSUS", "巨神兵格納区・警告音声柱", "起動時の古代音声を順番に記録し、敵対判定と帰還命令の条件を読む", GROUPS[1][1], "警告は封印破損、中央炉異常、進路確保、保守座帰還の順で繰り返され、無差別破壊命令ではなかった。", 58, "一部の警告だけを切り取らず、音節、灯火、腕部の向きを連続して記録する。", null, "古代神殿地下の巨神兵格納区へ降り、警告音声と機体動作を対応させる。"),
  lead("temple_duty_register", "古代神殿", "LOC_TEMPLE_SEALED", "地下封印区画・保守 duty 登録壁", "壁面の保守役割と交代印から、巨神兵が誰の命令を受ける設計だったか確定する", GROUPS[1][2], "命令権は王権ではなく、神殿保守官、根系管理者、機械技師の三者鍵で成立していた。単独命令は拒否される。", 52, "役職名を現代の王国制度へ置き換えず、三つの鍵穴と交代印をそのまま読む。", null, "地下封印区画へ入り、古代の三者命令制度を壁面から復元する。"),

  lead("keina_gate_damage_map", "古代神殿", "LOC_TEMPLE_GATE", "神殿正門・損傷地図", "ケイナの巡回記録から、巨神兵が避ける石材と踏み抜く地盤を地図化する", GROUPS[2][0], "巨神兵は白石の巡礼路を避け、古代導線が埋まる黒い地盤へ足を置いていた。進路は重量だけでなく導線探索で決まっている。", 43, "目撃談だけでなく、足跡深度、石材、警告灯の向きを重ねる。", "NPC097"),
  lead("road_gait_survey", "古代神殿", "LOC_TEMPLE_CORRIDOR", "白石回廊外縁・歩容観測点", "歩幅、旋回半径、停止間隔を測り、王都街道へ出る前に進路を変えられる地点を探す", GROUPS[2][1], "巨神兵は十二歩ごとに姿勢補正を行い、左脚の再接地時だけ進路指令を書き換えられる停止窓が生じる。", 50, "巨大さに圧倒されず、歩数、足首角度、整備子機の合図を連続計測する。", null),
  lead("maintenance_drone_joint_wear", "古代神殿", "LOC_TEMPLE_COLOSSUS", "巨神兵格納区・整備子機残骸", "整備子機の摩耗粉と交換部品から、主機の弱い関節と保守口を特定する", GROUPS[2][2], "子機は左膝、背部導線、胸部冷却口の順で部品を運んでおり、三点が停止工作の入口になる。", 48, "壊れた子機を敵の残骸として捨てず、工具痕、部品番号、運搬順を読む。", null),

  lead("brolun_torque_ledger", "ドワーフ洞窟", "LOC_DWARF_FORGE", "名工工房・古代軸受トルク帳", "ブロルンが保管した古代軸受片とトルク帳から、脚部を壊さず固定する値を求める", GROUPS[3][0], "左膝の軸受は破壊すると炉心へ負荷が戻るが、三段階で締めれば歩行指令だけを止められる。", 56, "経験則だけでなく、材質、締付順、温度補正を帳面と現物で合わせる。", "NPC035", "ドワーフ洞窟の名工工房へ向かい、古代機械を壊さず止める締付値を調べる。"),
  lead("mina_governor_lock", "ドワーフ洞窟", "LOC_DWARF_ENGINEER", "技師区画・三段調速錠試作台", "ミーナの調速錠を整備子機の信号へ接続し、主機の歩行出力だけを落とす", GROUPS[3][1], "三段調速錠は腕部兵装を刺激せず、歩行出力を保守速度へ下げられる。接続には左脚停止窓が必要だ。", 59, "机上試算で終えず、子機信号、軸受周期、現地の停止窓へ試作品を合わせる。", "NPC037", "ドワーフ洞窟の技師区画へ向かい、巨神兵用の調速錠を組み上げる。"),
  lead("core_cooling_channels", "古代神殿", "LOC_TEMPLE_COLOSSUS", "巨神兵格納区・胸部冷却溝", "冷却溝の流向と詰まりを調べ、炉心を爆発させず出力を落とす経路を確保する", GROUPS[3][2], "胸部三本の冷却溝のうち中央だけが根系封印材で詰まり、左右を先に開けば炉心を保守温度へ下げられる。", 53, "水を注ぐだけでは熱衝撃になる。流向、弁順、残った封印材を測る。", null),

  lead("t17_frequency_separation", "王都", "LOC_CAP_MAGE_TOWER", "宮廷魔術塔・T17原因分離記録", "T17で保存した召喚波と巨神兵封印波の比較から、王都軍の誤認を崩す", GROUPS[4][0], "召喚亀裂を閉じても巨神兵の歩行波は止まらず、世界樹周期と同期していた。二つの災害は独立している。", 42, "T17の結論だけを引用せず、周期、方向、停止後の残波を再確認する。", "NPC017", "王都魔術塔へ戻り、第二召喚停止後も残った巨神兵波を確認する。"),
  lead("royal_troop_diversion_order", "王都", "LOC_CAP_CASTLE", "王城・神殿派兵命令卓", "王都主力の派兵命令とT19防衛表を重ね、巨神兵誘導が王都防衛を空ける時刻を示す", GROUPS[4][1], "主力を神殿へ送ればDay78前に北東門と森側防衛が同時に空き、T19侵攻の突破口になる。", 46, "巨神兵の危険を軽視せず、派兵数、街道所要時間、王都残存兵力を同時に計算する。", "NPC016", "王城の軍議卓へ向かい、神殿派兵と王都防衛の空白を比べる。"),
  lead("seraphim_dual_cause_measurement", "王都", "LOC_CAP_MAGE_TOWER", "宮廷魔術塔・二重原因測定室", "セラフィムと召喚残波、根系封印波、巨神兵歩行波を同時計測する", GROUPS[4][2], "召喚残波は王都地下で減衰した一方、巨神兵波は倒壊した世界樹から神殿へ逆流し続けていた。", 44, "一つの測定器へ頼らず、王都、神殿、結界石の三地点で時刻を同期する。", "NPC017"),

  lead("elina_root_thread_rite", "エルフの隠れ里", "LOC_ELF_REFUGE_PATH", "避難枝道・残存根糸の編み場", "エリナの残存根糸と避難民の結界片から、巨神兵へ一時封印を編み直す", GROUPS[5][0], "世界樹そのものは戻らなくても、三本の残存根糸を古代保守座へ結べば、巨神兵を保守状態へ戻す短時間の封印を作れる。", 61, "祈りだけにせず、根糸の長さ、結界片、神殿側接続点を測る。", "NPC030", "エルフの避難枝道へ向かい、生存者が持ち出した根糸で一時封印を編む。"),
  lead("temple_evacuation_shutters", "古代神殿", "LOC_TEMPLE_ADMIN", "神殿管理棟・避難隔壁操作盤", "巡礼路、管理棟、格納区の隔壁を試動し、停止工作中の民間退避線を確定する", GROUPS[5][1], "隔壁を外側から順に閉じれば巡礼者と警備兵を退避させつつ、巨神兵を保守座側へ誘導できる。", 45, "扉を閉めるだけでなく、負傷者搬送、警告鐘、整備子機の抜け道まで確認する。", "NPC097"),
  lead("dwarf_anchor_pylons", "ドワーフ洞窟", "LOC_DWARF_ENGINEER", "技師区画・四点固定杭", "ドワーフの固定杭を神殿地盤へ合わせ、再封印や調速錠の作業時間を確保する", GROUPS[5][2], "四点固定杭は巨神兵を倒さず姿勢補正だけを遅らせ、根糸再封印または調速錠接続に必要な十二分を作れる。", 57, "杭の強度だけでなく、地盤、打込順、撤去路を現地図へ落とす。", "NPC037", "ドワーフ技師区画へ向かい、神殿地盤用の四点固定杭を設計する。"),
];

const ALL_LEAD_IDS = LEADS.map((entry) => entry.id);
const OPENINGS = [
  { id: "read_temple_activation_damage", label: "神殿の警告鐘と損傷地図から、起動順と進路を追う", playerUtterance: "巨神兵を敵だと決める前に、何が切れ、何を探して歩いているのか確かめたい。", requiredDisclosure: "世界樹封印が切れた後、整備子機、左脚、中央炉警告の順で起動し、古代導線を王都方面へ追い始めた。", factId: "T18-OPENING-TEMPLE-DAMAGE", unlockedLeadIds: ALL_LEAD_IDS, preferredFocusId: "seal_and_command" },
  { id: "recover_elf_root_seal", label: "エルフ生存者の根系記録から、封印の真因と再結合可能性を追う", playerUtterance: "召喚災害という説明から離れ、世界樹が担っていた封印そのものを知りたい。", requiredDisclosure: "巨神兵封印は世界樹根系と結界石へ分散され、Day60倒壊で最後の荷重が神殿へ戻った。", factId: "T18-OPENING-ELF-SEAL", unlockedLeadIds: ALL_LEAD_IDS, preferredFocusId: "seal_and_command" },
  { id: "inspect_dwarf_machine_fragment", label: "整備子機片と古代軸受から、破壊せず止める工学手順を追う", playerUtterance: "倒す方法ではなく、炉心と命令記録を残したまま歩行を止める方法を探す。", requiredDisclosure: "左脚の停止窓、胸部冷却溝、三段調速錠を組み合わせれば、主機を爆発させず保守速度へ落とせる。", factId: "T18-OPENING-DWARF-ENGINEERING", unlockedLeadIds: ALL_LEAD_IDS, preferredFocusId: "movement_and_machine" },
];

const FOCUSES = [
  { id: "seal_and_command", label: "世界樹封印の破断と、巨神兵が従う古代命令を分けて追う", minutes: 3, narrative: "封印原因だけを知っても停止命令は作れず、命令文だけを読んでも再封印は続かない。根系封印と古代任務を別々に固定する。", sceneTransition: "神殿の警告記録から、エルフの根系年表と地下の命令板へ場面が分かれる", groups: [{ id: "world_tree_seal_cause", label: "根系年表・断裂音・結界石から封印破断を確定する", evidenceGroupIndex: 0 }, { id: "ancient_command_duty", label: "翻刻・警告音声・保守登録から本来任務を確定する", evidenceGroupIndex: 1 }] },
  { id: "movement_and_machine", label: "巨神兵の歩行規則と、破壊しない機械停止を分けて組み立てる", minutes: 3, narrative: "弱点を攻撃するだけでは炉心爆発と記録喪失につながる。進路制御と工学停止を別々に確かめる。", sceneTransition: "巨神兵の足跡から、白石回廊の歩容観測とドワーフの調速錠へ視点が移る", groups: [{ id: "gait_and_route", label: "損傷地図・歩容・整備子機から進路規則を確定する", evidenceGroupIndex: 2 }, { id: "mechanical_shutdown", label: "トルク・調速錠・冷却溝から機械停止を確定する", evidenceGroupIndex: 3 }] },
  { id: "capital_risk_and_safe_reseal", label: "召喚との原因分離・王都兵力と、民間人を守る停止手順を分けて追う", minutes: 3, narrative: "王都軍を全て神殿へ送ればT19が開き、兵を残すだけでは巨神兵被害が拡大する。誤認と安全停止を別々に解く。", sceneTransition: "王都の派兵卓から、T17原因分離記録と神殿・エルフ・ドワーフの再封印準備へ場面が分かれる", groups: [{ id: "t17_t19_separation", label: "周波数・派兵命令・二重測定から誤認とT19空白を確定する", evidenceGroupIndex: 4 }, { id: "safe_reseal_and_evacuation", label: "根糸・隔壁・固定杭から安全な再封印時間を確定する", evidenceGroupIndex: 5 }] },
];

const SUPPORT = [GROUPS.map((group) => group[0]), GROUPS.map((group) => group[1]), GROUPS.map((group) => group[2])];
const CORE = GROUPS.map((group) => [...group]);
const ROUTES = [
  { id: "elf_root_rebinding_and_temple_reseal", label: "残存根糸を古代保守座へ再結合し、巨神兵を封印状態へ戻す", minutes: 92, sceneTransition: "エルフ避難枝道の根糸編みから神殿地下の保守座、静止する巨神兵、独立して残る王都防衛線へ場面が移る", narrative: "世界樹を復活させたことにはせず、生存者が持ち出した根糸、結界片、古代保守座を一時封印へ組み直した。巨神兵は保守座へ戻り、T19防衛の主力を王都へ残した。", summary: "巨神兵は残存根系によって再封印され、世界樹倒壊の損失とT18の停止を別々の歴史として残した。", readiness: { openingChoiceIds: ["recover_elf_root_seal"], openingSupport: 1, minimumSupport: 5, supportingEvidenceIds: SUPPORT[0], requiredEvidenceGroups: CORE, preparationLabel: "根系再結合と神殿再封印の証拠を補う", preparationMinutes: 10 }, worldEffect: { flagKey: "t18ElfRootReseal", factId: "T18-RESOLUTION-ELF-ROOT-RESEAL", text: "エルフ生存者と神殿側は残存根糸を古代保守座へ再結合し、巨神兵を一時封印へ戻した。", facilityId: "LOC_TEMPLE_COLOSSUS", propagationDelayHours: 2, aftermathPlans: [{ id: "t18-root-reseal-watch", npcIds: ["NPC028", "NPC030", "NPC056"], goal: "残存根系の劣化を監視し、恒久封印を再設計する" }] } },
  { id: "dwarf_governor_lock_and_command_rewrite", label: "四点固定杭と三段調速錠で歩行を止め、古代命令を保守帰還へ書き換える", minutes: 96, sceneTransition: "神殿外縁の固定杭から左脚停止窓、胸部冷却溝、保守帰還を示す警告灯へ場面が連続する", narrative: "機体を倒す代わりに姿勢補正を遅らせ、左脚へ調速錠を接続した。炉心を保守温度へ落とし、原命令の帰還句だけを有効化して格納区へ戻した。", summary: "巨神兵は破壊されず保守速度へ落ち、古代記録と機体を残したまま格納区へ帰還した。", readiness: { openingChoiceIds: ["inspect_dwarf_machine_fragment"], openingSupport: 1, minimumSupport: 5, supportingEvidenceIds: SUPPORT[1], requiredEvidenceGroups: CORE, preparationLabel: "調速錠・冷却・命令書換えの証拠を補う", preparationMinutes: 11 }, worldEffect: { flagKey: "t18DwarfGovernorShutdown", factId: "T18-RESOLUTION-DWARF-GOVERNOR", text: "ドワーフ技師は巨神兵の歩行出力を保守速度へ落とし、原命令の帰還句で格納区へ戻した。", facilityId: "LOC_DWARF_ENGINEER", propagationDelayHours: 2, aftermathPlans: [{ id: "t18-governor-maintenance", npcIds: ["NPC035", "NPC037", "NPC056"], goal: "調速錠と冷却系を共同保守する" }] } },
  { id: "sever_march_directive_and_joint_custody", label: "誤った王都進軍指令を切り、神殿・エルフ・ドワーフの三者保守管理へ移す", minutes: 99, sceneTransition: "王城の派兵撤回から巨神兵の命令板、三者鍵を分ける保守卓、王都へ戻る防衛軍へ場面が転換する", narrative: "巨神兵が中央炉位置を王都と誤認した進軍指令だけを切り、無主兵器として放置せず、古代の三者鍵制度を現代の神殿・エルフ・ドワーフ共同管理へ移した。", summary: "巨神兵の王都進軍指令は解除され、機体と命令権は三者共同の保守管理へ移った。王都主力はT19防衛へ戻った。", readiness: { openingChoiceIds: ["read_temple_activation_damage"], openingSupport: 1, minimumSupport: 5, supportingEvidenceIds: SUPPORT[2], requiredEvidenceGroups: CORE, preparationLabel: "進軍指令切断と三者管理の証拠を補う", preparationMinutes: 12 }, worldEffect: { flagKey: "t18JointMachineCustody", factId: "T18-RESOLUTION-JOINT-MACHINE-CUSTODY", text: "巨神兵の誤った進軍指令は切断され、神殿・エルフ・ドワーフが三者鍵で保守管理することになった。", facilityId: "LOC_TEMPLE_ADMIN", propagationDelayHours: 1.5, aftermathPlans: [{ id: "t18-joint-machine-custody", npcIds: ["NPC028", "NPC037", "NPC056"], goal: "三者鍵と王都防衛連絡を維持する" }] } },
];

for (const route of ROUTES) {
  route.contextVariants = [
    { contextId: "t09-and-t13-failed", troubleConditions: [{ troubleId: "T09", troubleStatuses: ["failed", "critical"] }, { troubleId: "T13", troubleStatuses: ["failed", "critical"] }], minutes: route.minutes + 26, summary: `${route.summary} T09で名工・設備が失われ、T13でエルフ側も壊滅していたため、残存部品と避難民記録から両技術を復元した。` },
    { contextId: "t17-separated-causes", flagKey: "t17T18CauseSeparated", minutes: Math.max(68, route.minutes - 12), summary: `${route.summary} T17で召喚波と巨神兵封印波が公式に分離されていたため、王都軍の誤派兵を早く撤回できた。` },
    { contextId: "t04-records-open", troubleConditions: [{ troubleId: "T04", troubleStatuses: ["resolved"] }], minutes: Math.max(72, route.minutes - 7), summary: `${route.summary} T04で神殿地下の記録が公開されており、古代命令と避難隔壁の確認が早まった。` },
    { contextId: "t04-sealed-records", troubleConditions: [{ troubleId: "T04", troubleStatuses: ["failed", "critical"] }], minutes: route.minutes + 13, summary: `${route.summary} T04失敗で神殿記録が封鎖され、警告音声・損傷地図・物証から原命令を復元した。` },
    { contextId: "t09-engineers-survived", troubleConditions: [{ troubleId: "T09", troubleStatuses: ["resolved"] }], minutes: Math.max(70, route.minutes - 9), summary: `${route.summary} T09で名工と技師設備が残り、固定杭、調速錠、冷却手順を現地向けに短時間で調整できた。` },
  ];
}

export const T18_MACHINE_COLOSSUS_PACK = F({
  id: "ancient-temple-machine-colossus",
  missionId: "MSN-T18",
  troubleId: "T18",
  title: "機械巨神兵の封印解除",
  hearing: { stepId: "hear", npcId: "NPC097", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_GATE", choices: OPENINGS },
  investigation: {
    stepId: "investigate",
    requiredEvidenceCount: 6,
    requiredEvidenceGroups: GROUPS,
    leads: LEADS,
    focuses: FOCUSES,
    defer: { label: "巨神兵調査をいったん保留し、避難・移動・協力者の安全を整える", deferMinutes: 90, summary: "調査を保留した。Day64には完全起動し、Day70には神殿周辺が壊滅、Day78には王都へ進軍する。" },
    initialGuidance: { kicker: "巨神兵は召喚災害ではなく、世界樹封印の破断で起動した古代保守兵器だ", title: "封印・命令・歩行・機械停止・王都誤認・安全再封印の六分類を確かめる", detail: "召喚を止めるだけでも、巨神兵を倒すだけでも、王都兵を全て送るだけでも解決しない。" },
    continuedGuidance: { kicker: "一つの弱点を見つけても、炉心爆発・民間被害・T19の防衛空白は残る", title: "未確認の分類を選び、エルフ、神殿、ドワーフ、王都へ場面を移す", detail: "六分類を独立して埋め、三つの停止方針のどれが成立するか絞る。" },
    selectedLeadGuidance: { kicker: "選んだ人物・記録・現場へ移動する" },
  },
  battle: { stepId: "battle", earlyEncounterId: "ENC-0063", activeEncounterId: "ENC-0064", fullActivationDay: 64, irreversibleFailureDay: 78 },
  resolution: { stepId: "resolve", choices: ROUTES },
  catalogOverride: {
    hearing: { required: 1, targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_GATE" },
    investigation: { required: 6, targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_ADMIN" },
    battle: { required: 1, targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_COLOSSUS", encounterId: "ENC-0063", timelineVariants: [{ minDay: 64, encounterId: "ENC-0064", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_COLOSSUS" }, { minDay: 61, maxDay: 63, encounterId: "ENC-0063", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_COLOSSUS" }] },
    resolution: { required: 1, targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_ADMIN" },
  },
  stepGuidance: {
    intervention: { kicker: "Day64より前なら、完全起動前の封印残存期へ介入できる", title: "根系再結合、調速錠先付け、進軍指令隔離の三入口から選ぶ", detail: "どの入口でも避難、命令板保全、王都主力維持を別々に判定する。" },
    battle: { kicker: "完全起動後は巨神兵と整備子機が王都街道へ出ようとしている", title: "勝利と、民間退避・命令中枢保全・王都主力維持を分けて達成する", detail: "機体を破壊するだけでは全救済経路にならない。" },
    resolve: { kicker: "三つの解決は、封印・機械制御・命令管理のどこへ再発防止を置くかが異なる", title: "根系再封印、調速錠と命令書換え、三者共同管理から成立案を選ぶ", detail: "導入と異なる方針へ転換する場合は六分類に加えて七件目の独立裏付けが必要。" },
  },
  branching: { evidenceProfiles: 729, evidenceOrders: 720, openings: 3, interventions: 3, resolutions: 3, deterministicSignatureCombinationsBeforePriorState: 14_171_760 },
});

const introChoice = (choiceId, label, requiredDisclosure, minutes, sceneTransition) => F({ choiceId, label, requiredDisclosure, minutes, sceneTransition });
export const T18_CONTINUITY_CONTRACT = F({
  introductionSources: [
    { id: "temple-gate-activation-ledger", targetLocation: "古代神殿", targetFacilityId: "LOC_TEMPLE_GATE", guidance: { kicker: "警告鐘と足跡が、敵襲とは違う順序を示す", title: "封印原因・歩行規則・王都誤認のどこから入るか選ぶ", detail: "警備兵一人の判断ではなく、鐘、損傷、派兵命令を比較する。" }, choices: [introChoice("read_temple_activation_damage", "警告鐘、足跡、整備子機の起動順を読む", "巨神兵は世界樹倒壊後に保守手順として起動し、古代導線を王都方面へ追っている", 18, "神殿正門から格納区、白石回廊、王都街道の損傷地図へ場面が移る"), introChoice("recover_elf_root_seal", "警告鐘と結界石停止時刻を比べ、封印破断の根を追う", "最後の警告鐘は世界樹の三根系が切れた直後に鳴っている", 19, "神殿正門からエルフの結界石と倒壊した世界樹へ場面が切り替わる"), introChoice("inspect_dwarf_machine_fragment", "整備子機片の摩耗と足跡から、破壊しない停止窓を探す", "左脚の姿勢補正時にだけ歩行出力へ安全に介入できる", 20, "正門の子機残骸からドワーフ技師区画と巨神兵左脚へ場面が分かれる")] },
    { id: "elf-refuge-root-fragments", targetLocation: "エルフの隠れ里", targetFacilityId: "LOC_ELF_REFUGE_PATH", guidance: { kicker: "避難民が持ち出した根糸に、古代封印の光が残る", title: "封印再結合・古代任務・民間退避のどこから入るか選ぶ", detail: "失われた世界樹を復活させず、残った機構で何が可能か確かめる。" }, choices: [introChoice("recover_elf_root_seal", "根糸と結界片から、一時再封印の接続点を探す", "三本の残存根糸を古代保守座へ結べば短時間の封印を作れる", 18, "避難枝道から結界石、世界樹跡、神殿保守座へ場面が移る"), introChoice("read_temple_activation_damage", "根糸に残る警告光から、巨神兵の本来任務を読む", "光の順は攻撃ではなく中央炉異常への保守出動を示している", 19, "根糸の光から神殿命令板と巨神兵警告柱へ場面が切り替わる"), introChoice("inspect_dwarf_machine_fragment", "根糸の耐力と固定杭の荷重を比べ、作業時間を作る", "根糸だけでは足りないが四点固定杭と併用すれば十二分の停止窓を作れる", 20, "避難枝道からドワーフ技師区画と神殿地盤図へ場面が分かれる")] },
    { id: "dwarf-engineer-maintenance-drone", targetLocation: "ドワーフ洞窟", targetFacilityId: "LOC_DWARF_ENGINEER", guidance: { kicker: "整備子機の部品は、主機を壊すより戻す方法を示す", title: "歩行停止・命令書換え・安全固定のどこから入るか選ぶ", detail: "武器の弱点ではなく保守機構を読む。" }, choices: [introChoice("inspect_dwarf_machine_fragment", "軸受、調速器、冷却弁から保守停止の手順を組む", "左脚固定、調速錠、左右冷却の順なら炉心を残して歩行を止められる", 18, "技師区画から名工工房、巨神兵左脚、胸部冷却溝へ場面が移る"), introChoice("read_temple_activation_damage", "子機の工具符号を命令板の保守句と照合する", "整備子機は王都攻撃ではなく保守座帰還のため主機を追っている", 19, "子機片から神殿命令板と警告音声柱へ場面が切り替わる"), introChoice("recover_elf_root_seal", "古代軸受の封印材を根糸と比べ、世界樹接続を証明する", "軸受に残る封印材はエルフ結界石と同じ根系樹脂だった", 20, "技師区画からエルフ結界石と神殿格納区へ場面が分かれる")] },
  ],
  leadFallbacks: {
    arwen_root_seal_chronology: [{ id: "elf-sealed-root-annals", primaryNpcId: "NPC028", targetLocation: "エルフの隠れ里", facilityId: "LOC_ELF_COUNCIL", destinationName: "長老庵・封印済み根系年表", label: "アルウェン不在のため、封印年表、結界石交換札、根圧記録から封印順を復元する", approachId: "t18-elf-sealed-root-annals", discoveryText: "長老が死亡・不在でも、三系統の封印が世界樹倒壊で順番に失われた記録は残っていた。", leadNarrative: "人物の記憶ではなく封印年表と交換札を重ねる。", minutes: 66 }],
    elina_severed_root_echo: [{ id: "refuge-root-light-copies", primaryNpcId: "NPC030", targetLocation: "エルフの隠れ里", facilityId: "LOC_ELF_REFUGE_PATH", destinationName: "避難枝道・根光写し", label: "エリナ不在のため、避難民が写した根光と結界片から断裂順を復元する", approachId: "t18-refuge-root-light-copies", discoveryText: "巫女が不在でも、三つの根光が神殿警告鐘の直前に消えた順序を復元できた。", leadNarrative: "複数の写しと結界片の焼け方を比較する。", minutes: 63 }],
    brolun_torque_ledger: [{ id: "forge-apprentice-torque-copy", primaryNpcId: "NPC035", targetLocation: "ドワーフ洞窟", facilityId: "LOC_DWARF_FORGE", destinationName: "名工工房・弟子のトルク写し", label: "ブロルン死亡・不在のため、弟子の写し、軸受片、工具跡から締付値を復元する", approachId: "t18-forge-apprentice-torque-copy", discoveryText: "名工を失っていても、左膝を壊さず固定する三段階の値は写しと現物から復元できた。", leadNarrative: "欠けた数値を工具跡と材質試験で補う。", minutes: 72 }],
    mina_governor_lock: [{ id: "engineer-prototype-bench-log", primaryNpcId: "NPC037", targetLocation: "ドワーフ洞窟", facilityId: "LOC_DWARF_ENGINEER", destinationName: "技師区画・試作台記録", label: "ミーナ不在のため、試作台の配線、失敗品、計測紙から調速錠を完成させる", approachId: "t18-engineer-prototype-bench-log", discoveryText: "技師本人が不在でも、歩行出力だけを保守速度へ落とす回路を復元できた。", leadNarrative: "完成品を捏造せず失敗品の差から回路を組む。", minutes: 75 }],
    luca_command_plate_grammar: [{ id: "temple-confiscated-translation-folios", primaryNpcId: "NPC056", targetLocation: "古代神殿", facilityId: "LOC_TEMPLE_ADMIN", destinationName: "神殿管理棟・押収翻刻冊", label: "ルカ不在のため、押収翻刻、原板拓本、差押番号から古代命令を復元する", approachId: "t18-temple-confiscated-translation-folios", discoveryText: "研究員が不在でも、巨神兵の本来任務と保守帰還句を物証から復元できた。", leadNarrative: "押収冊の欠頁を原板拓本と差押番号でつなぐ。", minutes: 68 }],
  },
  battleObjectives: [
    { id: "evacuate-pilgrims-and-guards", label: "巡礼者・警備兵・神殿周辺住民を歩行線から退避させる", requiredAnyEvidenceIds: [...GROUPS[5]], maxRounds: 14 },
    { id: "preserve-command-core-and-plates", label: "古代命令板と主機の命令中枢を破壊せず保全する", requiredAnyEvidenceIds: [...GROUPS[1]], maxRounds: 12 },
    { id: "keep-capital-main-force-home", label: "王都主力の誤派兵を防ぎ、T19防衛線を維持する", requiredAnyEvidenceIds: [...GROUPS[4]], maxRounds: 10 },
  ],
});
