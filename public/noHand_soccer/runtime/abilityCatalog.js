// noHand soccer combo device ability catalog.
//
// Initial design catalog for moving from single emoji effects toward the
// "3 emojis -> 1 visible combo device" system.
//
// This file is declarative. It should be consumed by a future
// comboDeviceCompiler/runtime, not executed as physics by itself.
//
// Status semantics:
// - active: selectable by the combo compiler now.
// - rework: selectable only after implementing the described visible device action.
// - alias: do not select directly; resolve to aliasTo while preserving visual flavor.
// - deprecated: keep for profile compatibility, but do not select for new combo devices.

export const ABILITY_CATALOG_VERSION = 1;

export const comboDevicePolicy = Object.freeze({
  concept: 'threeEmojisBecomeOneVisibleDevice',
  comboKey: 'emoji1|emoji2|emoji3; order matters',
  selection: 'collect candidates from the three source emoji profiles, resolve aliases, exclude deprecated abilities, then choose 2-3 visible actions by slot weight and seeded combo identity',
  parameterResolution: 'each action keeps a unique behavior; numeric ranges are resolved from comboKey, source slot, family synergy, and seed',
  guardrail: 'do not reduce abilities to generic nudge/dampen/boost; every selected ability must be visible as a device action',
});

export const comboSlotRoles = Object.freeze({
  core: { index: 0, label: 'core', meaning: '装置の主役。能力候補の中心を決める。' },
  modifier: { index: 1, label: 'modifier', meaning: '属性・見た目・数値を変質させる。' },
  output: { index: 2, label: 'output', meaning: '射出方向・終端処理・ゴール寄せを決める。' },
});

const R = (min, max) => [min, max];
const C = (...values) => values;
const W = (core = 1, modifier = 1, output = 1) => ({ core, modifier, output });

const baseVisuals = Object.freeze({
  portal: { frame: C('portalGate', 'orbitalRing'), effect: '入口ゲート・出口マーカー・残像線' },
  route: { frame: C('routeRibbon', 'railPath'), effect: '見えるルート・装置ごとの移動軌跡' },
  gravity: { frame: C('gravityCompass', 'orbitalRing'), effect: '重力矢印・吸引渦・フィールド変化' },
  launch: { frame: C('burstRing', 'impactArrow'), effect: '明確な射出方向・衝撃・残像' },
  hold: { frame: C('trapJaw', 'magicHand'), effect: '捕獲・溜め・必ず射出' },
  zone: { frame: C('effectLane', 'auraZone'), effect: 'コート上に見える効果領域' },
  clone: { frame: C('cloneFan', 'multiGate'), effect: '分身・出口・寿命の可視化' },
});

const E = (status, family, action, lifecycle, intent, params, extra = {}) => ({
  status,
  family,
  action,
  lifecycle,
  intent,
  params,
  visual: extra.visual ?? baseVisuals[family] ?? { frame: C('deviceRing'), effect: 'visible device action' },
  slotWeight: extra.slotWeight ?? W(),
  synergies: extra.synergies ?? [],
  counters: extra.counters ?? [],
  aliasTo: extra.aliasTo,
  avoid: extra.avoid,
});

export const abilityCatalog = Object.freeze({
  absorbHold: E('alias', 'hold', 'absorbChargeLaunch', 'contactEnterThenRelease', '勢いを吸収するだけだと邪魔なので、trapHoldの「捕獲→溜め→射出」に統合する。', { absorbRate: R(0.35, 0.9), chargeToSpeed: R(1.0, 2.2) }, { aliasTo: 'trapHold', slotWeight: W(0.2, 0.5, 0.3), avoid: 'ただ止めるだけにしない。' }),
  aimAssist: E('active', 'targeting', 'goalLockShot', 'instantOnContact', '最も近いゴールをロックオンし、ターゲットマーカーを出して直線的に射出する。', { lockOnMs: R(120, 420), shotSpeed: R(360, 900), targetBias: C('nearestGoal', 'nextGoal', 'highestValueGoal'), markerScale: R(0.8, 1.8) }, { visual: { frame: C('targetRing', 'scopeLine'), effect: '照準・ロックオン線・射出' }, slotWeight: W(0.95, 1, 1.4), synergies: C('precisionPass', 'lightBoost', 'chaseCatch'), avoid: '弱い角度補正だけで終わらせない。' }),
  attractHold: E('alias', 'gravity', 'gravityWellPull', 'timedAfterContact', '単純な引き寄せはlowGravityFieldの重力井戸へ統合する。', { pullRadius: R(120, 280), pullForce: R(0.4, 1.1) }, { aliasTo: 'lowGravityField', slotWeight: W(0.3, 0.65, 0.4), avoid: 'ボールを邪魔な位置で止めない。' }),
  breathLaunch: E('rework', 'launch', 'coneWindBlast', 'zoneAfterContact', '息/風の扇形ゾーンで押し出す。単発impulseではなく見える風領域。', { coneAngleDeg: R(25, 95), windForce: R(180, 760), gustCount: R(1, 4), gustIntervalMs: R(80, 260), directionDeg: R(-80, 35) }, { visual: { frame: C('windCone', 'breathCloud'), effect: '扇形風・粒子' }, slotWeight: W(1, 1.25, 1.1), synergies: C('flowCarry', 'burnBoost', 'pulseBoost'), avoid: 'ただの加速にしない。' }),
  burnBoost: E('rework', 'launch', 'rocketBurn', 'timedAfterContact', '炎・燃焼で継続推進する。heatLiftは上昇流、burnBoostは推進。', { thrust: R(260, 920), durationMs: R(450, 1400), directionDeg: R(-45, 30), burnWobble: R(0, 0.35), afterburnMs: R(100, 420) }, { visual: { frame: C('flameTail', 'rocketBurst'), effect: '炎の噴射・残火' }, slotWeight: W(1, 1.2, 1.15), synergies: C('heatLift', 'dashCarry', 'lightBoost'), counters: C('freezeSlip'), avoid: 'heatLiftと似せない。横/斜め推進が本体。' }),
  burstScatter: E('active', 'clone', 'radialBurstScatter', 'instantOnContact', 'その場で爆発的に放射状へ散らす。splitScatterより爆発・放射。', { burstCount: R(3, 8), radius: R(30, 120), burstForce: R(260, 900), arcCoverageDeg: R(120, 360), cloneLifeMs: R(600, 2200) }, { slotWeight: W(1.1, 1.25, 1.1), synergies: C('burnBoost', 'panicKick', 'splitScatter'), avoid: 'randomBounceのような不透明な乱反射にしない。' }),
  chainPass: E('active', 'combo', 'passToNearbyDevice', 'instantOnContact', '近くの絵文字装置へ向かってボールを移動/射出する。複数装置配置で強い。', { targetRule: C('nearestDevice', 'nextBySlot', 'bestAngle', 'sameFamily'), passSpeed: R(360, 900), maxRange: R(160, 520), chainLimit: R(1, 4), arrivalTrigger: true }, { visual: { frame: C('chainLine', 'passArrow'), effect: '次装置への線・パス軌跡' }, slotWeight: W(1, 1.05, 1.35), synergies: C('electricJolt', 'hiddenRoute', 'splitScatter'), avoid: '単なるゴール方向射出にしない。装置間の線を見せる。' }),
  chaseCatch: E('active', 'targeting', 'chaseAndCatchThrow', 'zoneAfterContact', '装置が短距離追尾し、捕まえて目標方向へ投げる。', { chaseRadius: R(130, 360), chaseSpeed: R(120, 520), catchMs: R(100, 420), throwSpeed: R(300, 780), targetMode: C('goal', 'device', 'forward') }, { visual: { frame: C('chaseArrow', 'hunterRing'), effect: '追尾線・捕獲・投げ' }, slotWeight: W(1.05, 1.05, 1.25), synergies: C('aimAssist', 'grabHold', 'magnetPull'), avoid: 'aimAssistとの差を出す。こちらは追って捕まえる。' }),
  curveRedirect: E('active', 'targeting', 'swingByRedirect', 'instantOnContact', 'スイングバイのように、速度を保ちながら弧を描いて曲げる。', { curveAngleDeg: R(18, 120), preserveSpeed: R(0.85, 1.18), side: C('left', 'right'), arcRadius: R(45, 180) }, { visual: { frame: C('curveArc', 'gravitySlingshot'), effect: '弧線・かすめ曲がり' }, slotWeight: W(1, 1.1, 1.2), synergies: C('spinRedirect', 'lowGravityField', 'scoopRedirect'), avoid: 'lowGravityFieldの周回と混同しない。一瞬の方向変更。' }),
  dashCarry: E('rework', 'motion', 'escortDash', 'rideAfterContact', '単なる加速ではなく、絵文字がボールと伴走して押し運ぶ短距離ダッシュ。', { distance: R(180, 560), travelMs: R(260, 900), pushForce: R(260, 760), laneLock: R(0.15, 0.75), releaseSpeed: R(300, 780) }, { visual: { frame: C('speedCapsule', 'dashTrail'), effect: '伴走・スピード線' }, synergies: C('lightBoost', 'impactLaunch', 'zigzagRedirect'), avoid: 'ただ速度を足すだけにしない。装置の伴走が必要。' }),
  delayedRelease: E('alias', 'time', 'delayAsClockEffect', 'contactEnterThenRelease', '遅延保持はtimedReleaseの時間干渉へ統合する。', { delayMs: R(220, 1200), releaseSpeed: R(280, 780) }, { aliasTo: 'timedRelease', slotWeight: W(0.3, 0.6, 0.5), avoid: 'ただ遅れて離すだけにしない。' }),
  diveDrop: E('active', 'gravity', 'slimeDropBounce', 'timedAfterContact', '急降下し、落下ラインを一時的にスライムブロック化して速度に応じて跳ね返す。', { dropForce: R(520, 1500), slimeMs: R(500, 1800), bounceMultiplier: R(1.25, 2.8), horizontalKick: R(-260, 360) }, { slotWeight: W(0.8, 1.1, 1.15), synergies: C('gravityShift', 'softLanding', 'burstScatter'), avoid: '自爆能力にしない。落下ライン救済とセット。' }),
  dropRelease: E('alias', 'gravity', 'dropThenBounce', 'timedAfterContact', 'ただ落とすだけでは弱いため、diveDropの急降下反発へ統合する。', { dropForce: R(320, 1000) }, { aliasTo: 'diveDrop', slotWeight: W(0.4, 0.6, 0.8), avoid: '落下死だけの能力にしない。' }),
  electricJolt: E('active', 'electric', 'nodeJoltChain', 'instantOnContact', '電撃ノードを数回跳び、最後に射出する。zigzagとは違い瞬間連鎖感を出す。', { nodeCount: R(2, 5), nodeJumpMs: R(80, 220), joltForce: R(180, 620), finalShotSpeed: R(360, 880), stunMs: R(40, 180) }, { visual: { frame: C('electricNodes', 'sparkChain'), effect: '電撃ノード・硬直・射出' }, slotWeight: W(1.05, 1.3, 1.05), synergies: C('chainPass', 'zigzagRedirect', 'magnetPull'), avoid: 'zigzagRedirectと同じ左右移動にしない。' }),
  fakeRoute: E('deprecated', 'route', 'illusionRoute', 'none', '敵がいないゲームではユーザーを混乱させるだけなので新規comboでは選ばない。', { illusionMs: R(300, 1200), ghostCount: R(1, 3) }, { slotWeight: W(0, 0, 0), avoid: 'multiExit/splitScatterのゴースト演出へ吸収する。' }),
  flowCarry: E('active', 'zone', 'visibleWaterCurrent', 'zoneAfterContact', '絵文字から特定方向に水流ゾーンを作り、触れたボールを流す。', { length: R(160, 620), width: R(28, 110), directionDeg: R(-80, 35), currentForce: R(160, 720), durationMs: R(600, 1900) }, { slotWeight: W(1, 1.25, 1.1), synergies: C('heatLift', 'breathLaunch', 'paintTrail'), avoid: '内部carryではなく見える水流を作る。' }),
  freezeSlip: E('rework', 'zone', 'iceRailLaunch', 'zoneAfterContact', '摩擦低下ではなく、氷レーンを作り高速直進させる。', { railLength: R(170, 620), railAngleDeg: R(-70, 25), railSpeed: R(280, 860), durationMs: R(450, 1600), bounceOnExit: R(0.8, 1.8) }, { visual: { frame: C('iceRail', 'frostLane'), effect: '氷レーン・霜粒子' }, slotWeight: W(0.9, 1.2, 1.1), synergies: C('precisionPass', 'softLanding'), counters: C('heatLift', 'burnBoost'), avoid: 'slipFlowとの差を出す。氷レーンとして見せる。' }),
  glideCarry: E('rework', 'motion', 'airGlideLane', 'timedAfterContact', '空中で滑空ラインを作る。rollCarryとの差は空中・落下抑制。', { glideMs: R(550, 1700), liftRatio: R(0.25, 0.95), horizontalSpeed: R(180, 680), glideAngleDeg: R(-30, 20) }, { visual: { frame: C('glideWing', 'airLane'), effect: '翼/紙飛行機風ライン' }, slotWeight: W(0.8, 1.1, 1), synergies: C('breathLaunch', 'lightBoost', 'sleepFloat'), avoid: 'rollCarryと混同しない。空中専用。' }),
  grabHold: E('active', 'hold', 'magicHandThrow', 'contactEnterThenRelease', 'マジックハンドのように伸びて捕まえ、狙って投げる。', { reach: R(70, 240), holdMs: R(180, 760), aimMode: C('goal', 'nearestDevice', 'comboOutput'), throwSpeed: R(320, 820) }, { slotWeight: W(1.1, 1, 1.15), synergies: C('trapHold', 'hookPull', 'aimAssist'), avoid: '掴んで終わりにしない。必ず投げる。' }),
  gravityShift: E('active', 'gravity', 'worldGravityOverride', 'timedAfterContact', '局所吸引ではなく、効果中の世界重力方向を大胆に変更する。', { gravityAngleDeg: R(-180, 180), gravityStrength: R(680, 1500), durationMs: R(450, 1500), transitionMs: R(60, 220) }, { slotWeight: W(1, 1.1, 1.35), synergies: C('lowGravityField', 'diveDrop', 'heatLift'), avoid: 'lowGravityFieldと混同しない。世界全体へ影響する。' }),
  growthLift: E('alias', 'thermal', 'sproutLift', 'zoneAfterContact', '単体では抽象的すぎるため、植物/成長系の見た目だけheatLiftへ統合する。', { stageCount: R(2, 5), liftPerStage: R(45, 140), stageMs: R(100, 280) }, { aliasTo: 'heatLift', slotWeight: W(0.4, 0.8, 0.4), avoid: '抽象的な成長補正にしない。' }),
  heatLift: E('active', 'thermal', 'thermalUpdraft', 'zoneAfterContact', '絵文字から熱気/湯気の上昇流を作り、ボールを揺らしながら上げる。', { durationMs: R(700, 1900), liftForce: R(260, 780), swayAmplitude: R(16, 86), swayFrequency: R(1.2, 4.2), finalDriftX: R(-240, 360) }, { visual: { frame: C('steamColumn', 'heatWave'), effect: '陽炎・湯気・上昇流' }, slotWeight: W(1, 1.25, 1.05), synergies: C('burnBoost', 'flowCarry', 'growthLift'), counters: C('freezeSlip'), avoid: '上向き成分必須。単なる速度補正にしない。' }),
  heavyBlock: E('deprecated', 'defense', 'heavyMassBlock', 'none', '重くして止めるだけだと邪魔。新規comboでは選ばない。', { massScale: R(1.5, 5), pushField: R(0, 260) }, { slotWeight: W(0, 0, 0), avoid: '反射ならreflectShield、捕獲ならtrapHoldへ寄せる。' }),
  hiddenRoute: E('active', 'route', 'routeRide', 'rideAfterContact', '青い矢印のように、絵文字とボールを特殊ルートに乗せて移動し、終点で放出する。', { routeType: C('loop', 'arc', 'sCurve', 'upperRail'), loops: R(0.5, 1.5), travelMs: R(700, 1800), endOffsetX: R(160, 520), endOffsetY: R(-260, -80), releaseSpeed: R(320, 700) }, { slotWeight: W(1.1, 1.25, 1), synergies: C('phaseThrough', 'precisionPass', 'chainPass'), avoid: '見えない補正にしない。ルートと終点を描画する。' }),
  hookPull: E('active', 'hold', 'hookPullThrow', 'contactEnterThenRelease', 'フック/舌/糸が伸び、ボールを掴んで大きく引っ張り上げて放る。', { hookLength: R(90, 300), pullMs: R(250, 1000), pullHeight: R(80, 260), releaseAngleDeg: R(-105, -20), releaseSpeed: R(360, 880) }, { slotWeight: W(1, 1.15, 1.15), synergies: C('grabHold', 'scoopRedirect', 'trapHold'), avoid: '装飾なしの引力にしない。フックを見せる。' }),
  impactLaunch: E('rework', 'launch', 'heavyImpactHit', 'instantOnContact', '重い一撃で吹き飛ばす。snap/popとの差は重量感と大きい反動。', { impactForce: R(420, 1100), knockbackAngleDeg: R(-60, 35), recoilPx: R(8, 42), hitStopMs: R(30, 120) }, { slotWeight: W(1.15, 1, 1.1), synergies: C('heavyBlock', 'dashCarry', 'burstScatter'), avoid: 'ただの加速にしない。重い接触演出を入れる。' }),
  lightBoost: E('rework', 'light', 'lightRailBoost', 'rideAfterContact', '光線レールに乗せて高速化する。弱い加速ではなく直線的な光の道。', { railLength: R(180, 680), boostSpeed: R(380, 980), railAngleDeg: R(-55, 25), glowMs: R(250, 1000) }, { visual: { frame: C('lightRail', 'glowCapsule'), effect: '光線・残像' }, slotWeight: W(0.9, 1.2, 1.2), synergies: C('aimAssist', 'dashCarry', 'glideCarry'), avoid: '薄い速度補正で終わらせない。' }),
  lowGravityField: E('active', 'gravity', 'gravityWell', 'timedAfterContact', '弱い低重力ではなく、絵文字中心の重力場でボールを円運動させながら吸い込む。', { pullRadius: R(150, 300), pullForce: R(0.55, 1.35), orbitForce: R(0.45, 1.25), durationMs: R(850, 1900), releaseMode: C('throw', 'keepOrbit', 'warpSynergy'), releaseSpeed: R(280, 700) }, { slotWeight: W(1.1, 1.25, 0.95), synergies: C('warpExit', 'gravityShift', 'magnetPull'), avoid: '接触前に発動させない。ふわっと弱い効果にしない。' }),
  luckyRedirect: E('deprecated', 'chance', 'luckyRoute', 'none', '抽象的すぎるので新規comboでは選ばない。必要ならサイコロ演出つき能力として再設計。', { highRollChance: R(0.15, 0.45) }, { slotWeight: W(0, 0, 0), avoid: '内部的な幸運補正だけにしない。' }),
  magnetPull: E('active', 'magnet', 'polarityPullRepel', 'zoneAfterContact', '磁力で引き寄せ、接触した瞬間に極性反転して強く反発射出する。', { radius: R(130, 320), pullForce: R(0.45, 1.25), repelForce: R(340, 980), polarityFlips: R(1, 3) }, { visual: { frame: C('magnetField', 'polarityRing'), effect: '磁力線・極性反転' }, slotWeight: W(1.05, 1.2, 1), synergies: C('electricJolt', 'lowGravityField', 'reflectShield'), avoid: 'ただ引き寄せて邪魔するだけにしない。反発射出まで行う。' }),
  multiExit: E('active', 'clone', 'multiGateCloneExit', 'instantOnContact', '複数出口の数だけ分身を出し、それぞれ異なる角度/場所から射出する。', { exitCount: R(2, 5), cloneCount: R(1, 5), exitDistance: R(180, 620), spreadDeg: R(30, 160), cloneLifeMs: R(700, 2400), oneCloneModeChance: R(0, 0.35) }, { slotWeight: W(1.05, 1.25, 1.1), synergies: C('warpExit', 'splitScatter', 'chainPass'), avoid: '見えない終着点変更だけにしない。出口と分身を見せる。' }),
  orbitCarry: E('alias', 'gravity', 'orbitAsGravityWell', 'timedAfterContact', '周回はlowGravityFieldの重力井戸へ統合する。', { orbitForce: R(0.45, 1.25) }, { aliasTo: 'lowGravityField', slotWeight: W(0.4, 0.7, 0.45), avoid: 'lowGravityFieldと別能力として似通わせない。' }),
  paintTrail: E('active', 'zone', 'effectPaintTrail', 'timedAfterContact', 'ボール/分身の軌跡に効果床を残す。効果床は合成内容から決まる。', { trailLength: R(120, 680), tileLifeMs: R(800, 4200), paintEffect: C('boost', 'bounce', 'warp', 'flow', 'gravity', 'goalGrow'), thickness: R(12, 60) }, { slotWeight: W(1.1, 1.3, 1), synergies: C('flowCarry', 'splitScatter', 'burstScatter'), avoid: '見た目だけの軌跡にしない。触れると効果を持つ床にする。' }),
  panicKick: E('rework', 'launch', 'panicKickShot', 'instantOnContact', 'パニックで大きく蹴る。完全ランダムではなく、派手な一撃として見せる。', { kickForce: R(360, 1050), angleJitterDeg: R(25, 120), fearPauseMs: R(40, 200), afterSpin: R(0, 0.8) }, { synergies: C('burstScatter', 'randomBounce', 'zigzagRedirect'), avoid: 'ユーザーをただ困らせる乱数反射にしない。' }),
  phaseThrough: E('active', 'space', 'edgeWrapPhase', 'timedAfterContact', '効果中、コート端に触れると反対側の同じ座標から出る。見た目をゴースト化する。', { durationMs: R(700, 2400), edgeMode: C('leftRight', 'topBottom', 'both'), exitSpeedScale: R(0.8, 1.4), exitAngleAdjustDeg: R(-25, 25) }, { visual: { frame: C('phaseAura', 'edgePortal'), effect: '半透明化・端ポータル波紋' }, slotWeight: W(0.9, 1.15, 1.2), synergies: C('warpExit', 'hiddenRoute', 'precisionPass'), avoid: '障害物透過ではなく、現状コートに合う端ワープとして実装する。' }),
  poisonDampen: E('deprecated', 'hazard', 'poisonPenalty', 'none', '邪魔アイテムになりやすいので新規comboでは選ばない。', { poisonMs: R(600, 2400), reboundExplosion: R(0, 1) }, { slotWeight: W(0, 0, 0), avoid: '速度低下だけは絶対に避ける。使うなら毒爆発として別設計。' }),
  popLaunch: E('rework', 'launch', 'springPop', 'instantOnContact', '軽くポンと上へ跳ねさせる。impact/snapとの差は軽さとバネ感。', { upwardForce: R(280, 860), sideForce: R(-180, 280), bounceCount: R(1, 3), bubbleScale: R(0.8, 2.2) }, { synergies: C('softLanding', 'splitScatter', 'heatLift'), avoid: 'impactLaunchの重い一撃と混同しない。' }),
  precisionPass: E('active', 'targeting', 'straightLaserPass', 'timedAfterContact', '変数方向へ、重力の影響を弱めて変数時間だけ直進するレーザーパス。', { passMs: R(320, 1100), passSpeed: R(380, 920), directionMode: C('comboOutput', 'goal', 'currentVelocity'), gravityIgnore: R(0.65, 1), wallMode: C('bounce', 'phaseOnce', 'none') }, { visual: { frame: C('laserLane', 'passCorridor'), effect: '直線レーン・重力無視' }, slotWeight: W(0.95, 1.1, 1.35), synergies: C('aimAssist', 'freezeSlip', 'hiddenRoute'), avoid: '狭い通路という存在しない概念に依存しない。' }),
  pulseBoost: E('rework', 'rhythm', 'rhythmPulseBoost', 'timedAfterContact', '脈動/拍子で断続加速する。一発加速ではなくリズム。', { pulseCount: R(2, 6), intervalMs: R(90, 280), pulseForce: R(120, 520), beatDirection: C('goal', 'forward', 'radial') }, { visual: { frame: C('pulseRing', 'beatWave'), effect: '拍動リング・複数パルス' }, slotWeight: W(1, 1.25, 1), synergies: C('timedRelease', 'burnBoost', 'lightBoost'), avoid: 'lightBoost/dashCarryと同じ連続加速にしない。パルスを見せる。' }),
  pushRedirect: E('active', 'targeting', 'visibleSidePush', 'instantOnContact', '絵文字が横から押したと分かる動きで、進路を変える。', { pushForce: R(220, 820), pushSide: C('left', 'right', 'comboOutput'), contactSlidePx: R(8, 54), releaseSpeedScale: R(0.9, 1.45) }, { visual: { frame: C('pushArrow', 'sideBump'), effect: '横押し矢印・押し込み' }, synergies: C('reflectShield', 'curveRedirect', 'dashCarry'), avoid: '内部の方向補正だけで終わらせない。押す見た目必須。' }),
  randomBounce: E('rework', 'chance', 'diceBounce', 'instantOnWallOrContact', 'ただのランダム反射はストレス。サイコロ演出で出目ごとの跳ね方を見せるなら可。', { faceCount: R(3, 6), bounceProfiles: C('high', 'low', 'wide', 'goal', 'split', 'return'), force: R(180, 760) }, { visual: { frame: C('diceRing'), effect: '出目表示・跳ね方変更' }, slotWeight: W(0.6, 1, 0.7), synergies: C('panicKick', 'burstScatter', 'popLaunch'), avoid: '理由の見えないランダム反射にしない。' }),
  reflectShield: E('active', 'defense', 'visibleReflectShield', 'zoneAfterContact', 'シールド面を張り、触れたボールを明確な法線で反射する。', { shieldAngleDeg: R(-80, 80), shieldSize: R(60, 220), restitution: R(1.05, 2.0), activeMs: R(500, 1800) }, { visual: { frame: C('shieldPlate', 'reflectArc'), effect: 'シールド面・反射火花' }, synergies: C('pushRedirect', 'magnetPull', 'softLanding'), avoid: 'heavyBlockのように受け止めない。跳ね返す。' }),
  rollCarry: E('rework', 'motion', 'groundRollLane', 'zoneAfterContact', '地面沿いに転がるレーンを作る。glideとの差は接地・転がり。', { laneLength: R(160, 620), rollSpeed: R(240, 780), frictionLock: R(0.45, 1.0), laneAngleDeg: R(-10, 25) }, { visual: { frame: C('rollingLane', 'wheelTrack'), effect: '転がりレーン・車輪跡' }, slotWeight: W(0.8, 1, 1.1), synergies: C('dashCarry', 'curveRedirect', 'freezeSlip'), avoid: 'glideCarryと同じ空中移動にしない。' }),
  scoopRedirect: E('active', 'targeting', 'scoopAndToss', 'contactEnterThenRelease', '下からすくい上げ、斜め上へ放る。すくう見た目必須。', { scoopAngleDeg: R(-115, -25), liftMs: R(180, 720), tossSpeed: R(320, 840), scoopRadius: R(40, 140) }, { visual: { frame: C('scoopArc', 'spoonLift'), effect: 'すくい上げ・放り投げ' }, slotWeight: W(1, 1.1, 1.15), synergies: C('curveRedirect', 'hookPull', 'popLaunch'), avoid: '単なる上向きimpulseにしない。' }),
  silenceHold: E('alias', 'time', 'silenceAsTimeFreeze', 'timedAfterContact', '停止/抑制はつまらないため、timedReleaseの時間干渉演出へ統合する。', { silenceMs: R(200, 900) }, { aliasTo: 'timedRelease', slotWeight: W(0.2, 0.6, 0.3), avoid: 'ただ能力を無効化しない。' }),
  sleepFloat: E('rework', 'time', 'dreamBubbleWakeShot', 'contactEnterThenRelease', '眠り泡に入れて漂わせ、最後に目覚めて弾ける。単なるふわふわは不可。', { bubbleMs: R(700, 2200), driftX: R(-220, 320), driftY: R(-180, 120), wakeSpeed: R(280, 760), bubbleSize: R(1.0, 2.4) }, { visual: { frame: C('dreamBubble', 'zzzTrail'), effect: '眠り泡・漂流・目覚め破裂' }, slotWeight: W(0.8, 1.2, 0.9), synergies: C('timedRelease', 'glideCarry', 'softLanding'), avoid: '弱い浮遊で終わらせない。最後に醒めて射出する。' }),
  slingLaunch: E('rework', 'launch', 'slingshotRelease', 'contactEnterThenRelease', '引っ張ってからパチンと放つ。snapより溜めが長い。', { chargeMs: R(220, 900), tension: R(0.7, 2.2), releaseAngleDeg: R(-70, 25), releaseSpeed: R(380, 980) }, { visual: { frame: C('slingBand', 'rubberArc'), effect: '引き絞り・弾性射出' }, slotWeight: W(1, 1, 1.2), synergies: C('hookPull', 'snapLaunch', 'precisionPass'), avoid: 'snapLaunchと同じ瞬発にしない。溜めを見せる。' }),
  slipFlow: E('alias', 'zone', 'slimyFlowLane', 'zoneAfterContact', '摩擦だけでは弱いので、flowCarryのぬるぬる見た目派生へ統合する。', { slipAmount: R(0.4, 1.5) }, { aliasTo: 'flowCarry', slotWeight: W(0.2, 0.5, 0.3), avoid: 'freezeSlip/flowCarryと似せたまま残さない。' }),
  slowDampen: E('active', 'speed', 'overclockAllBalls', 'timedAfterContact', '減速ではなく、全ボール/分身の速度を変数時間上昇させるオーバークロックへ再解釈する。', { windupMs: R(60, 240), speedScale: R(1.15, 2.4), durationMs: R(450, 1500), affects: C('main', 'clones', 'allBalls') }, { visual: { frame: C('overclockRing', 'speedAura'), effect: '一瞬スロー演出→速度上昇' }, slotWeight: W(0.8, 1.2, 1.05), synergies: C('splitScatter', 'burstScatter', 'dashCarry'), avoid: '邪魔な減速能力として実装しない。' }),
  snapLaunch: E('rework', 'launch', 'snapFlickShot', 'instantOnContact', '指で弾くような短く鋭い射出。impactより軽く、popより横/斜めに鋭い。', { flickForce: R(360, 980), flickAngleDeg: R(-70, 30), snapMs: R(40, 140), spinAdd: R(0, 0.7) }, { visual: { frame: C('snapSpark', 'flickLine'), effect: '指パッチン・白い火花' }, slotWeight: W(1.1, 1, 1.05), synergies: C('spinRedirect', 'precisionPass', 'panicKick'), avoid: 'impactLaunchの重い衝撃と混同しない。' }),
  softLanding: E('active', 'bounce', 'slimeBounceBoost', 'timedAfterContact', 'スライム化して変数時間、反発係数を上昇させる。名前に反してゲーム的には跳ねを強化する。', { restitutionScale: R(1.2, 2.8), durationMs: R(500, 1800), squashScale: R(0.75, 1.45), floorBonus: R(1.0, 2.2) }, { visual: { frame: C('slimeBubble', 'bouncePad'), effect: 'ぷにぷに化・強反発' }, slotWeight: W(0.8, 1.15, 1.05), synergies: C('diveDrop', 'popLaunch', 'reflectShield'), avoid: '落下を弱めるだけにしない。跳ねて楽しくする。' }),
  spinRedirect: E('active', 'spin', 'beybladeSpinDeflect', 'contactEnterThenRelease', '絵文字が高速回転し、触れたボールを弾き飛ばし、ボールに次回反射変化のspin状態を付ける。', { spinDirection: C('cw', 'ccw'), spinPower: R(0.4, 1.6), deflectForce: R(260, 860), spinDurationMs: R(500, 2200), nextBounceCurveDeg: R(12, 85) }, { visual: { frame: C('spinDisc', 'beybladeRing'), effect: '高速回転・回転付与' }, slotWeight: W(1, 1.15, 1.05), synergies: C('curveRedirect', 'snapLaunch', 'zigzagRedirect'), avoid: '単なる方向補正ではなく、後続の壁/ゴール反射も変える。' }),
  splitScatter: E('active', 'clone', 'directedSplitScatter', 'instantOnContact', '本体から分身を出し、指定角度へ散開する。multiExitよりその場分裂。', { splitCount: R(2, 6), spreadDeg: R(35, 180), cloneSpeed: R(220, 840), cloneLifeMs: R(800, 2600), keepMain: C(true, false) }, { slotWeight: W(1.15, 1.2, 1.1), synergies: C('multiExit', 'paintTrail', 'slowDampen'), avoid: '軌跡だけに逃げない。分身を可視化する。' }),
  stillHold: E('alias', 'hold', 'stillAsChargeTrap', 'contactEnterThenRelease', '停止だけでは邪魔なのでtrapHoldの溜め射出へ統合する。', { holdMs: R(180, 900) }, { aliasTo: 'trapHold', slotWeight: W(0.2, 0.4, 0.3), avoid: 'ただ止めるだけにしない。' }),
  timedRelease: E('active', 'time', 'rewindThenRelease', 'instantOnContact', '時計演出で、ボールと分身を変数秒/フレーム巻き戻す。既にクリアしたゴール状態は保持する。', { rewindMs: R(300, 2200), target: C('main', 'clones', 'allBalls'), keepGoalState: true, restoreVelocity: C(true, false), releaseSpeedScale: R(0.8, 1.6) }, { visual: { frame: C('clockFace', 'rewindSpiral'), effect: '時計針・巻き戻し残像' }, slotWeight: W(1.1, 1.25, 1.1), synergies: C('pulseBoost', 'sleepFloat', 'delayedRelease'), avoid: 'ただ遅れて離すだけにしない。時間干渉にする。' }),
  trapHold: E('active', 'hold', 'trapChargeLaunch', 'contactEnterThenRelease', '罠に捕まえ、溜めて、必ず指定方向へ強く射出する。', { holdMs: R(180, 950), chargeScale: R(1.0, 2.6), releaseAngleDeg: R(-80, 35), releaseSpeed: R(380, 980), trapShape: C('jaw', 'cage', 'web', 'box') }, { slotWeight: W(1.1, 1.05, 1.15), synergies: C('grabHold', 'absorbHold', 'slingLaunch'), avoid: '捕まえて落とすだけにしない。射出まで必須。' }),
  warpExit: E('active', 'space', 'relativeTeleport', 'instantOnContact', '位置補正ではなく、装置基準の遠方相対座標へ明確にワープし、出口から射出する。', { distance: R(380, 820), angleDeg: R(-85, 35), exitSpeed: R(340, 820), portalDelayMs: R(60, 240), minDistance: 340 }, { visual: baseVisuals.portal, slotWeight: W(1.2, 1.15, 1.25), synergies: C('lowGravityField', 'phaseThrough', 'multiExit'), avoid: '近距離スライドやゴール補正にしない。' }),
  wrapHold: E('alias', 'hold', 'wrapAsTrapCharge', 'contactEnterThenRelease', '巻くだけだと邪魔なのでtrapHoldの見た目派生として扱う。', { coilCount: R(1, 4), holdMs: R(180, 850) }, { aliasTo: 'trapHold', slotWeight: W(0.2, 0.55, 0.35), avoid: 'ただ拘束するだけにしない。' }),
  zigzagRedirect: E('active', 'route', 'deviceZigzagRide', 'rideAfterContact', '絵文字とボールが一緒にジグザグ移動し、最後に射出する。', { zigzagCount: R(2, 7), amplitude: R(45, 150), forwardDistance: R(180, 560), travelMs: R(450, 1500), releaseSpeed: R(320, 760) }, { visual: { frame: C('zigzagRail', 'stepDash'), effect: '折れ線軌道・左右ステップ' }, slotWeight: W(1.1, 1.2, 1), synergies: C('electricJolt', 'panicKick', 'dashCarry'), avoid: '単なる角度変更にしない。絵文字自身も移動させる。' }),
});

export function resolveCatalogAbility(name) {
  const entry = abilityCatalog[name];
  if (!entry) return null;
  if (entry.status === 'alias' && entry.aliasTo && abilityCatalog[entry.aliasTo]) {
    return { name: entry.aliasTo, entry: abilityCatalog[entry.aliasTo], aliasFrom: name, aliasFlavor: entry };
  }
  return { name, entry, aliasFrom: null, aliasFlavor: null };
}

export function isSelectableAbility(name, { includeRework = true } = {}) {
  const resolved = resolveCatalogAbility(name);
  if (!resolved) return false;
  const { entry } = resolved;
  if (entry.status === 'active') return true;
  if (includeRework && entry.status === 'rework') return true;
  return false;
}

export function listSelectableAbilities(options = {}) {
  return Object.keys(abilityCatalog).filter((name) => isSelectableAbility(name, options));
}

export function listCatalogAliases() {
  return Object.entries(abilityCatalog)
    .filter(([, entry]) => entry.status === 'alias')
    .map(([name, entry]) => ({ name, aliasTo: entry.aliasTo }));
}

export function listDeprecatedAbilities() {
  return Object.entries(abilityCatalog)
    .filter(([, entry]) => entry.status === 'deprecated')
    .map(([name, entry]) => ({ name, reason: entry.intent }));
}
