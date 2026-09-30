/**
 * PROPOSAL ONLY – September 30 spatial / optional ecology extension.
 * These zones are level-DESIGN affordances, not a linear sequence of
 * minimum character levels. Based on the existing 11 regions and T01–T19;
 * the dragon and its optional consequences are new, NOT sheet-canonical.
 */
import {fromRef} from './geography.js';
const polygon=p=>p.map(fromRef);
const zone=(id,name,shape,color,kind,reading,choices,links=[],note='')=>({
 id,name,points:polygon(shape),color,kind,reading,choices,links,note
});
export const levelZones=[
 zone('royal-roads','往来のある王都・交易都市街道',
 [[257,403],[337,384],[474,397],[590,410],[728,431],[797,481],[738,507],[615,489],[479,472],[334,479]],
 '#b8bd83','approach',
 '交通量・畑・橋詰の人影から安全な通行軸を読める。川を渡る場所と農道の関係を学ぶ。',
 '主要街道、遠回りの集落道、危険な浅瀬の選択。最短距離=最良とは限らない。',[]),
 zone('farm-wolf-fringe','田園北柵・獣道の境界',
 [[474,468],[514,453],[559,468],[593,507],[572,559],[526,568],[481,536]],
 '#aa865c','ecology',
 '遠吠え・足跡・襲われた家畜が狼の縄張りを予告する。いきなり魔物を湧かせない。',
 '引き返す、狩人に相談する、迂回する、巣や大型魔獣の影響を探る。',
 ['T01','T03'],'赤牙狼はT03で南下しても固定地点のランダム遭遇ではない。'),
 zone('north-pass','北山の峠・補給と山腹の選択',
 [[393,125],[494,77],[612,93],[666,144],[620,206],[536,231],[454,197]],
 '#8c98aa','terrain',
 '山小屋、断崖、雪崩跡と軍馬の通り道から登山難度が読める。',
 '整備された補給道、峠道、足場の悪い短絡路。装備・天候・疲労に意味を持たせる。',
 ['T09','T12']),
 zone('forest-edge','翡翠の森外縁・野営と渡河',
 [[763,395],[829,373],[916,385],[968,439],[914,514],[816,522],[763,465]],
 '#8bac78','exploration',
 '野営跡、狩人の道標、河岸の濡れた地面で森奥との違いを示す。',
 '外縁は通常歩行可。獣道・馬留めを使うか、森奥へ踏み込むかを選べる。',
 ['T03','T13']),
 zone('forest-deep','世界樹の迷いが支配する森奥',
 [[1052,345],[1146,324],[1260,350],[1340,401],[1314,489],[1198,514],[1090,467]],
 '#43776b','conditional',
 '道標の反復・方角の狂い・精霊反応が境界を知らせる。敵のレベルだけの壁ではない。',
 'エルフの承認・案内・迷わない術・世界樹の状態で到達性が変わる。',
 ['T07','T08','T13','T19']),
 zone('temple-approach','古代神殿の参道と公開外苑',
 [[438,664],[512,646],[611,653],[697,696],[703,816],[644,863],[519,836],[444,800]],
 '#bba27f','investigation',
 '巡礼者、管理棟、告知板がある公共区域。失踪の気配は碑文・異常記録で前触れを作る。',
 '休息・案内・聞き込み・危険区域への調査。地下封印区とは別の領域。',
 ['T04','T18']),
 zone('temple-sealed','白石回廊から地下封印区画',
 [[551,738],[592,730],[623,748],[621,784],[586,798],[553,786]],
 '#80696b','interior',
 '不自然な文字・機械音・閉ざされた階段で外苑との差を示す。',
 '地下装置への手掛かり・退避経路・安全停止。純粋な戦闘力による一方通行ではない。',
 ['T04','T18']),
 zone('southern-wastes','南部高原・古道・少ない水場',
 [[700,674],[837,633],[990,676],[1103,699],[1356,705],[1444,750],[1444,1034],
 [1208,1011],[994,1041],[829,996],[684,910],[632,801]],
 '#c39466','resource',
 '植物の疎らさ、朽ちた荷車、井戸跡、夜間の冷え込みが移動リスクを予告する。',
 '既知の水場を経由、補給物資を持つ、早朝/夜間に進む、帰路を確保する。適正レベルを無理に設定しない。',
 ['T04','T18']),
 zone('dry-basin','枯れかけた龍の淵',
 [[1138,820],[1191,806],[1273,821],[1337,857],[1378,898],[1349,951],[1282,973],[1182,953],[1139,898]],
 '#69a9b0','optional-ecology',
 '乾いた蛇行跡、魚骨、深い爪痕、濁った最後の水たまりが固有個体の生存圏を示す。',
 '素通りしても本筋の事件は起こらない。餌・水・非致死的な服従、そして騎乗可能な回復条件を見出せる。',
 ['T13','T18','T19'],'龍はトラブルIDの対象外。自然死が起きても世界規模のイベント失敗にはしない。')
];

export const waterDragon={
 id:'ECO_SE_WATER_DRAGON_01',
 name:'飢えた水龍',
 classification:'unique-wildlife-optional',
 referencePoint:[1236,884],
 point:fromRef([1236,884]),
 basin:levelZones.find(z=>z.id==='dry-basin').points,
 habitat:'南東・乾きの高原の、昔は東の水系とつながっていた河跡の淵',
 originProposal:'季節的な水量低下で獲物を追ってきた個体が取り残された。T13が悪化するとさらに厳しくなるが、飢えの唯一の原因ではない。',
 signs:['潰れた河床の泥','大きな魚骨と魚鱗','水流と逆向きの爪痕','水切れを起こした浅い淵'],
 needs:['大量の魚・水棲の獲物','飲水と身体を濡らせる環境','休息と回復時間'],
 disposition:'飢餓によって衰弱している。無条件に懐くことも、必ず人を襲うこともない。',
 resolutionPaths:[
  {id:'care',label:'世話・給餌',conditions:['十分な魚・水を継続的に確保','個体の回復を待つ','接触を重ねて警戒を解く'],
   outcome:'信頼を得て乗せてもらえるようになる可能性。餌を一回与えた瞬間に騎乗はできない。'},
  {id:'dominance',label:'力で屈服させる',conditions:['非致死の戦闘で降伏させる','衰弱しているため過剰な攻撃を避ける','服従後も食料と水は別途必要'],
   outcome:'信頼なしに騎乗の主導権を得る可能性。ただし無補給なら結局死ぬ。'}
 ],
 ride:{
  qualitativeSpeed:'水辺や大きな河道では徒歩を大幅に超える速度。数値は実3Dの移動検証後に設定。',
  routes:['大河の広い流路','河口・沿岸の安全な海面','水を纏える開けた平原や荒野（備蓄水消耗）'],
  exclusions:['地下坑道・狭い街路','険しい山稜','世界樹が作る迷いの森の条件を無視した横断','水や体力が尽きた状態での騎乗'],
  upkeep:['魚などの大量の餌','必要な水分・休息','地域と天候ごとの走行条件'],
  note:'世界座標を実移動する固有個体。任意の地点間を無条件で瞬間移動できるファストトラベルではない。'
 },
 optionalConnections:[
  {id:'T13',status:'proposal',effect:'河川減水で獲物と水が減りやすい。騎乗者なら川の水位異常へ早期到達・観察可能。ただし龍に乗るだけでキングスライム問題を解決しない。'},
  {id:'T18',status:'proposal',effect:'巨神兵が起動した場合、街道が安全なら巡礼者避難や現場往復の移動手段になり得る。ただし狭い封印区画に龍は入れない。'},
  {id:'T19',status:'proposal',effect:'王都・森近郊へ急報を運ぶ選択肢に影響し得る。ただし森の迷いや戦争判断を自動的に無効化しない。'}
 ],
 nonTroubleRule:'見逃されても世界規模のトラブルは発生しない。生存値が尽きればこの固有個体が死に、騎乗の可能性だけが消える。',
 sourceStatus:'new user-requested design proposal; NOT an existing spreadsheet trouble or canon creature'
};

// DESIGN-ONLY pure ecology contracts. They are not wired to the live game's
// movement, combat, NPC scheduler or save files. An integration must advance
// ONLY on canonical in-world time, never while menus are paused/game is closed.
const clamp=n=>Math.max(0,Math.min(100,n));
export function initialDragonState(){
 return {life:'alive',nutrition:30,hydration:32,vitality:67,bond:'wild',ridingUnlocked:false,elapsedWorldHours:0};
}
export function advanceDragonEcology(s,hours,{surfaceWater='scarce',prey='scarce',t13Escalated=false}={}){
 if(!Number.isFinite(hours)||hours<0)throw new Error('World hours must be nonnegative');
 if(s.life==='dead'||hours===0)return {...s};
 const wildPrey=prey==='abundant'?.082:prey==='some'?.044:prey==='scarce'?.016:0;
 const wildWater=surfaceWater==='abundant'?.16:surfaceWater==='scarce'?.022:0;
 const nutritionRate=wildPrey-.10-(t13Escalated?.015:0);
 const hydrationRate=wildWater-.13-(t13Escalated?.025:0);
 const nutrition=clamp(s.nutrition+hours*nutritionRate);
 const hydration=clamp(s.hydration+hours*hydrationRate);
 // Deficiency damage is integrated only AFTER each reserve actually crosses
 // zero. One 100-hour update must have the same result as 100 hourly ticks.
 const hungryHours=nutritionRate<0?Math.max(0,hours-s.nutrition/(-nutritionRate)):s.nutrition<=0?hours:0;
 const thirstyHours=hydrationRate<0?Math.max(0,hours-s.hydration/(-hydrationRate)):s.hydration<=0?hours:0;
 const vitality=clamp(s.vitality-(hungryHours+thirstyHours)*.23);
 return {...s,life:vitality>0?'alive':'dead',nutrition,hydration,vitality,
  elapsedWorldHours:s.elapsedWorldHours+hours};
}
export function aidDragon(s,{fishKg=0,waterLitres=0}={}){
 if(s.life!=='alive')return {...s};
 if(![fishKg,waterLitres].every(Number.isFinite)||fishKg<0||waterLitres<0)throw new Error('Invalid aid');
 const nutrition=clamp(s.nutrition+fishKg*2.5);
 const hydration=clamp(s.hydration+waterLitres*.35);
 const recovery=nutrition>45&&hydration>45?Math.min(fishKg*.65+waterLitres*.08,16):0;
 return {...s,nutrition,hydration,vitality:clamp(s.vitality+recovery)};
}
export function bondDragon(s,{method,nonlethalVictory=false,careVisits=0}={}){
 if(s.life!=='alive')return {...s};
 const capable=s.vitality>=45&&s.nutrition>=35&&s.hydration>=35;
 const success=(method==='care'&&careVisits>=2&&s.nutrition>=60&&s.hydration>=55&&capable)||
  (method==='dominance'&&nonlethalVictory&&capable);
 return success?{...s,bond:method,ridingUnlocked:true}:{...s};
}
export function canRideDragon(s,environment='river'){
 const allowed=['river','safe-coast','open-land-with-water'];
 return s.life==='alive'&&s.ridingUnlocked&&s.vitality>=45&&s.nutrition>=30&&
  s.hydration>=30&&allowed.includes(environment);
}
