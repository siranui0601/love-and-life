const goalDir = (ball, ctx) => ctx.primitives.toward(ball, ctx.goalCenter);
const gimmickDir = (ball, ctx) => ctx.primitives.toward(ball, ctx.gimmickCenter);
const make = (description, trigger, duration, cooldown, strength, maxVelocityDelta, visualHint, apply) => ({ description, trigger, duration, cooldown, strength, maxVelocityDelta, visualHint, apply });

export const abilityRegistry = {
  dashCarry: make('進行方向へ短く強く運ぶ', 'gimmick/contact', 260, 900, 260, 220, 'cyan speed streak', (b, c) => c.primitives.applyImpulse(b, { x: b.vx || 1, y: b.vy }, 260, 220)),
  rollCarry: make('接地感のある直進補助', 'ground/contact', 800, 700, 74, 90, 'green rolling ring', (b, c) => { b.vy *= .72; return c.primitives.applyCarryForce(b, { x: Math.sign(b.vx || 1), y: .05 }, 74, 90); }),
  flowCarry: make('水流のように緩く継続して押す', 'field/tick', 1200, 850, 92, 72, 'blue stream', (b, c) => c.primitives.applyCarryForce(b, { x: 1, y: Math.sin(c.now / 220) * .45 }, 92, 72)),
  curveRedirect: make('速度を保ったまま曲げる', 'gimmick/contact', 420, 800, .62, 0, 'purple arc guide', (b, c) => c.primitives.redirectVelocity(b, { x: goalDir(b, c).x, y: goalDir(b, c).y - .28 }, .62, Math.PI / 5)),
  aimAssist: make('ゴール方向へ弱く補正する', 'launch/tick', 900, 500, .28, 0, 'thin goal line', (b, c) => c.primitives.redirectVelocity(b, goalDir(b, c), .28, Math.PI / 9)),
  precisionPass: make('通路に通すように鋭く補正する', 'gimmick/contact', 520, 950, .72, 0, 'gold corridor', (b, c) => c.primitives.redirectVelocity(b, c.routeDirection, .72, Math.PI / 6)),
  pushRedirect: make('横から押して進路変更する', 'gimmick/contact', 320, 650, 150, 130, 'orange shove arrow', (b, c) => c.primitives.applyImpulse(b, gimmickDir(b, c), 150, 130)),
  softLanding: make('落下速度を抑えて収める', 'floor/near', 700, 700, .42, 0, 'soft landing pad', (b, c) => { if (b.vy > 0) b.vy *= .42; return 'soft vertical dampen'; }),
  slowDampen: make('全体速度を強めに減衰する', 'gimmick/contact', 750, 850, .54, 0, 'gray slow field', (b, c) => c.primitives.dampenVelocity(b, .54, 5)),
  impactLaunch: make('接触時に重い一撃で飛ばす', 'gimmick/contact', 180, 1200, 410, 320, 'red impact burst', (b, c) => c.primitives.applyImpulse(b, goalDir(b, c), 410, 320)),
  popLaunch: make('上方向・跳ね方向に軽く弾ませる', 'gimmick/contact', 240, 650, 210, 185, 'pink pop bubble', (b, c) => c.primitives.applyImpulse(b, { x: .25, y: -1 }, 210, 185)),
  snapLaunch: make('指で弾いたような短い瞬発力', 'manual/contact', 90, 500, 340, 240, 'white snap spark', (b, c) => c.primitives.applyImpulse(b, { x: goalDir(b, c).x, y: goalDir(b, c).y - .18 }, 340, 240)),
  randomBounce: make('seeded乱数で跳ね方向を少し乱す', 'wall/bounce', 120, 450, 120, 95, 'yellow dice bounce', (b, c) => c.primitives.applySeededJitter(b, c.random, 120, 95)),
  orbitCarry: make('対象の周囲を回り込ませる', 'gimmick/contact', 1100, 1050, 105, 82, 'violet orbit ring', (b, c) => c.primitives.applyOrbit(b, c.gimmickCenter, 105, 82)),
  grabHold: make('短時間つかんで狙いを作る', 'gimmick/contact', 900, 1300, .62, 0, 'claw hold', (b, c) => c.primitives.holdBall(b, c.gimmickCenter, .62, 780, c.now)),
  absorbHold: make('勢いを吸収して保持する', 'gimmick/contact', 1000, 1350, .48, 0, 'dark absorb halo', (b, c) => { c.primitives.dampenVelocity(b, .18); return c.primitives.holdBall(b, c.gimmickCenter, .48, 900, c.now); }),
  stillHold: make('ほぼ静止させてから離す', 'gimmick/contact', 850, 1400, .75, 0, 'still square', (b, c) => { c.primitives.dampenVelocity(b, .05); return c.primitives.holdBall(b, c.gimmickCenter, .75, 700, c.now); }),
  lowGravityField: make('低重力フィールドでふわっと伸ばす', 'field/tick', 1400, 1100, 0.38, 120, 'mint low-g dome', (b) => { b.gravityScale = .38; b.vy -= 38; return 'gravityScale(0.38) + lift'; }),
  hiddenRoute: make('半透明の補助ルートに短時間乗せる', 'gimmick/contact', 950, 1300, .58, 0, 'transparent route rail', (b, c) => { b.x += (c.hiddenRoute.y - b.y) * .04; return c.primitives.redirectVelocity(b, c.routeDirection, .58, Math.PI / 7); }),
  lightBoost: make('軽い加速でテンポを足す', 'gimmick/contact', 360, 450, 150, 115, 'white light trail', (b, c) => c.primitives.applyImpulse(b, goalDir(b, c), 150, 115))
};
