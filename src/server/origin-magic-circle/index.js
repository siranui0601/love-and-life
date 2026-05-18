import path from "path";
import crypto from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../../foundation/env.js";
import {
  createOriginMagicCircleRoom,
  deleteOriginMagicCircleRoom,
  getOriginMagicCircleRoomById,
  joinOriginMagicCircleRoom,
  removeOriginMagicCircleMember,
  updateOriginMagicCircleRoomStatus,
  appendOriginMagicCircleSpellCache,
  findSimilarOriginMagicCircleSpellCacheByShape64,
  updateOriginMagicCircleRoomHp,
  updateOriginMagicCircleMemberLoadState,
  
  touchOriginMagicCircleRoomExpiresAt,
  cleanupExpiredOriginMagicCircleRooms,
  
  appendOriginMagicCircleRoomCastLog,
  findOriginMagicCircleSpellCachesByHashes,


  findActiveOriginMagicCircleRoomByClientId,
  resetOriginMagicCircleRoomForRematch,
startOriginMagicCircleBattle,
advanceOriginMagicCircleTurn,
assertOriginMagicCircleTurnOwner,

  
  
} from "../../foundation/sheets.js";


function extractJsonText(text) {
  const raw = String(text || "").trim();

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return raw;
}

function createOriginMagicCircleImageHash(base64ImageFile) {
  return crypto
    .createHash("sha256")
    .update(String(base64ImageFile || ""))
    .digest("hex");
}

function normalizeOriginMagicCircleShape64(rawShape64) {
  const value = String(rawShape64 || "").trim().toLowerCase();
  if (!/^[0-9a-f]{4096}$/.test(value)) return "";
  return value;
}




const ORIGIN_MAGIC_CIRCLE_MAX_HP = 1000;

const ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP = {
  "火": "fireball.glb",
  "骸骨": "magic_voxel_skull_flat_shaded.glb",
  "竜巻": "stylized_fire_tornado.glb",
  "不死鳥": "phoenix_bird.glb",
  "月": "truth_about_the_dark_side_of_the_moon.glb",
  "歯車時計": "broken_steampunk_clock.glb",
  "プラズマ": "evanescent_plasma.glb",
  "六足ロボ": "gun-bot_with_walk_and_idle_animation.glb",
  "魂剣": "soulsucker_-_weaponcraft.glb",
  "花束": "bouquet.glb",
  "ギミック剣": "lance_of_the_primordials_-_dae_weaponcraft.glb",
  "サイバー卵": "pearl_electron.glb",
  "サイバー球と円盤": "stranger_star.glb",
  "蠢く立方体": "cube_cascade.glb",
  "サイバー多面球": "cyber_orb.glb",
  "エナジー凝縮球": "magic_marble.glb",
  "二重螺旋球": "cyber_spore.glb",
  "銀河": "dark_matter.glb",
  "蠢く多面球": "harlequin_orb.glb",
  "多線球": "evanescent_smoke.glb",
  "雷": "lightning",
  "大爆発": "explosion_burst",
  "雲": "mist_cloud",
  "光球": "light_orb",
  "バレッド": "crystal_shard",
  "シンプルリング": "simple_ring",

  "太陽": "sun.glb",
  "隕石": "meteorite.glb",
  "火山": "rocky_hell_terrain.glb",
  "ツララ": "icicle.glb",
  "魔法陣1": "35b59066261a4a0a8c113da5b5a988e9.glb",
  "魔法陣2": "2024zhongqiu_4_loop.glb",
  "魔法陣3": "eff_huanguang.glb",
  "サイバー巻物": "c3d8c3fda1ec45a0bdab896eba97e679.glb",
  "魔法陣4": "829e78a8ee3548369f3ac92c41a2ee74.glb",
  "竹巻物": "67f9a0094a714d258e5c5088fac2a7a4.glb",
  "魔法陣5": "27444eb10a4f4409b4a2649738ec7441.glb",
  "魔法陣6": "c7ba0550fe034f29bfb54ca75b7eb1f6.glb",
  "魔法陣7": "fd37b7bec4ca48a8b6539dc4048787cf.glb",
  "魔法陣8": "technology_aperture_out.glb",
  "魔法陣9": "appearance_effect_light_beam.glb",
  "シールド": "duchess_shield.glb",
  "落葉": "hojas_verdes_caen.glb",
  "キューブ": "the_cube.glb",
  "天球儀": "armillary.glb",
  "捻れ球": "icosahedron_knot.glb",
  "オーラ": "animated_effect.glb",
  "魔法陣10": "303ac171bafb4998950b741d7c89aa94.glb",
  "動く鳥居": "torii_gate_lighthouse.glb",
  "ゲート1": "sculptjanuary2021_-_day_05_-_magic_gate.glb",
  "円盤": "executor_warp_gate.glb",
  "鳥居": "japanese_tori_gate.glb",
  "ゲート2": "stargate.glb",
  "キュートドラゴン": "cute_dragon.glb",
  "アニメドラゴン": "dragon.glb",
  "弱ドラゴン": "adult_dragon.glb",
  "竜騎士": "dragon_walk.glb",
  "翔ぶドラゴン": "dragon_fly.glb",
  "アニメ竜巻": "tornado.glb",
  "枯れ木": "tree.glb",
  "ヤシの木": "young_palm.glb",
  "針葉樹": "spruce_tree_-_low_poly.glb",
  "トルーパー": "creaturespirate_trooper.glb",
  "翼": "wing_379.glb",
  "蝶": "blue_glowing_butterfly.glb",
  "悪魔翼": "hell_wings.glb",
  "機械翼": "low_poly__wings.glb",
  "天使翼": "wings_03.glb",
  "戦闘機": "h6k4_war_thunder.glb",
  "戦車": "k9_thunder_artillery.glb",
  "雪1": "looping_snow_2.glb",
  "雪2": "falling_snow_loop.glb",
  "雪結晶1": "snowflake_crystal_by_elsa_mmd2005.glb",
  "雪結晶2": "crystal.glb",
  "ハート": "crystal_heart.glb",
  "ダイヤ": "purple_diamond_crystal_gem.glb",
};



const ORIGIN_MAGIC_CIRCLE_POSITION_CANDIDATES = ["in_front_of_self", "behind_self", "above_self", "battlefield_center", "above_battlefield_center", "enemy_position", "above_enemy", "self_position"];
const ORIGIN_MAGIC_CIRCLE_SIZE_CANDIDATES = ["small", "medium", "large"];
const ORIGIN_MAGIC_CIRCLE_SPREAD_PATTERNS = ["none", "horizontal_line", "vertical_line", "circle", "random_scatter"];
const ORIGIN_MAGIC_CIRCLE_MOVE_PATH_TYPES = ["none", "straight_line", "arc", "fall_from_above", "rise_from_below", "orbit"];
const ORIGIN_MAGIC_CIRCLE_ENTER_EFFECTS = ["fall_from_sky", "scale_up", "rise_from_ground"];
const ORIGIN_MAGIC_CIRCLE_EXIT_EFFECTS = ["rise_to_sky", "scale_down", "sink_into_ground"];
const ORIGIN_MAGIC_CIRCLE_ROTATION_SPEEDS = ["slow", "normal", "fast"];

const clamp = (v,min,max,d=min)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):d;
const pick = (arr)=>arr[Math.floor(Math.random()*arr.length)];
function toAssetFileName(name){const raw=String(name||"").trim();if(!raw) return pick(Object.values(ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP));return ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP[raw]||raw;}
function randomColorFromBase(base){const palette=[base,"#FFFFFF","#111111","#FFD700"];if(Math.random()<0.65) return pick(palette);const n=parseInt(base.slice(1),16);const r=(n>>16)&255,g=(n>>8)&255,b=n&255;const dv=()=>Math.max(0,Math.min(255,Math.round((Math.random()-0.5)*70)));return `#${[r+dv(),g+dv(),b+dv()].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase()}`;}



//ここから大量追加
const ORIGIN_MAGIC_CIRCLE_MAGIC_CIRCLE_ASSETS = [
  "魔法陣1",
  "魔法陣2",
  "魔法陣3",
  "魔法陣4",
  "魔法陣5",
  "魔法陣6",
  "魔法陣7",
  "魔法陣8",
  "魔法陣9",
  "魔法陣10",
];

const ORIGIN_MAGIC_CIRCLE_FINISH_ASSETS = [
  "大爆発",
  "雷",
  "光球",
  "プラズマ",
  "銀河",
  "竜巻",
];

const ORIGIN_MAGIC_CIRCLE_SUPPORT_ASSETS = [
  "魔法陣3",
  "雲",
  "光球",
  "プラズマ",
  "大爆発",
  "シンプルリング",
  "オーラ",
  "銀河",
  "雷",
  "竜巻",
  "ゲート1",
  "ゲート2",
  "魂剣",
  "バレッド",
  "隕石",
  "翼",
  "天使翼",
  "悪魔翼",
  "雪結晶1",
  "雪結晶2",
];

const ORIGIN_MAGIC_CIRCLE_PATTERN_POOL = [
  "vertical_circle_single_judgment",
  "vertical_circle_barrage",
  "sky_mass_rain",
  "sky_road",
  "gate_release",
  "gate_army",
  "behind_stand",
  "enemy_encircle",
  "crossfire",
  "far_charge",
  "ground_rupture",
  "spiral_bind",
  "cosmic_collapse",
  "meteor_fall",
  "weapon_execution",
  "dragon_assault",
  "orbital_laser",
  "tornado_swallow",
  "moon_gravity",
  "sun_burst",
  "ice_prison",
  "snowfall_execution",
  "machine_barrage",
  "tank_siege",
  "fighter_airstrike",
  "wing_judgment",
  "dark_gate",
  "soul_procession",
  "cube_cascade_crush",
  "crystal_storm",
  "tree_world_takeover",
  "torii_boundary",
  "clock_stop",
  "plasma_cage",
  "smoke_assassination",
  "ring_seal",
  "butterfly_swarm",
  "phoenix_rebirth_blast",
  "hell_wing_drop",
  "angelic_pillar",
  "cyber_orb_network",
  "dual_spiral",
  "light_lane",
  "enemy_backstab",
  "above_enemy_execution",
  "battlefield_core_overload",
  "delayed_big_bang",
  "multi_phase_barrage",
  "silence_then_flash",
  "all_range_finale",
  "far_projectile_impact",
  "gather_then_release",
  "enemy_wide_impale",
  "linked_magic_circles",
  "ice_bullet_stab",
  "meteor_impact",
  "sky_to_ground_lightning",
  "diagonal_lightning_slash",
  "field_lightning_rain",
  "portal_projectile_burst",
  "camera_sky_execution",
  "low_angle_summon",
];

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))];
}

function chooseMainAsset(rawMainAsset) {
  const raw = String(rawMainAsset || "").trim();

  if (ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP[raw]) return raw;

  const fileNameHit = Object.entries(ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP)
    .find(([, fileName]) => fileName === raw);

  if (fileNameHit) return fileNameHit[0];

  return pick(Object.keys(ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP));
}

function chooseSupportAssets(mainAsset, count = 4) {
  const pool = ORIGIN_MAGIC_CIRCLE_SUPPORT_ASSETS
    .filter((name) => name !== mainAsset && ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP[name]);

  const result = [];

  while (result.length < count && pool.length) {
    const selected = pick(pool);
    if (!result.includes(selected)) result.push(selected);
  }

  return result;
}

function normalizeOriginMagicCircleConceptJson(rawJson) {
  const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson || {};

  const magicName =
    String(parsed.magicName || "無銘魔法・原初解放").trim() ||
    "無銘魔法・原初解放";

  const artScore = Math.round(clamp(parsed.artScore, 0, 100, 50));
  const mainAsset = chooseMainAsset(parsed.mainAsset);

  return {
    magicName,
    artScore,
    mainAsset,
  };
}

function makeVisualObject({
  id,
  asset,
  count = 1,
  position = "battlefield_center",
  size = "medium",
  life = 4,
  spread = "none",
  color = "#FFFFFF",
  target = "self_position",
  duration = 0,
  path = "none",
  enter = "scale_up",
  exit = "scale_down",
  rotate = true,
  rotationSpeed = "normal",
  rotationAxis,
  positionOffset,
  targetOffset,
  rotationOffset,
  faceEnemy = false,
  orbit,
  lightningStyle,
}) {
  return {
  id,
  assetFileName: toAssetFileName(asset),
  objectCount: Math.round(clamp(count, 1, 12, 1)),
  spawnPosition: position,
  spawnSpreadPattern: spread,
  colorHexCode: color,
  objectSize: size,
  lifeTimeSeconds: clamp(life, 0.5, 10, 4),
  enterEffect: enter,
  exitEffect: exit,
  movement: {
    targetPosition: target,
    moveDurationSeconds: clamp(duration, 0, 10, 0),
    movePathType: path,
    targetOffset,
  },
  rotation: {
    shouldRotate: rotate,
    rotationSpeed,
    axis: rotationAxis,
  },
  positionOffset,
  rotationOffset,
  faceEnemy,
  orbit,
  lightningStyle,
};
}

function makeTimedEffect(time, visualObjects) {
  return {
    startTimeSeconds: clamp(time, 0, 10, 0),
    visualObjects: visualObjects.filter(Boolean),
  };
}

function makeSceneEffect(time, type, options = {}) {
  return {
    timeSeconds: clamp(time, 0, 10, 0),
    type,
    ...options,
  };
}

function createDamageTimingsFromImpactTimes(impactTimes, artScore) {
  const totalDamage = Math.round(clamp(90 + artScore * 2.25, 100, 320, 200));

  const times = uniqueArray(
    impactTimes
      .map((v) => Number(Number(v).toFixed(2)))
      .filter((v) => Number.isFinite(v))
      .map((v) => clamp(v, 0.5, 9.7, 2))
  ).sort((a, b) => a - b).slice(0, 5);

  if (!times.length) times.push(3.5, 6.8);

  const weights = times.map(() => 1);
  weights[weights.length - 1] = 2;

  const sum = weights.reduce((a, b) => a + b, 0);
  const damageWeights = weights.map((w) => Math.round((w / sum) * 100));
  damageWeights[damageWeights.length - 1] += 100 - damageWeights.reduce((a, b) => a + b, 0);

  return {
    totalDamage,
    damageTimings: times.map((timeSeconds, i) => ({
      timeSeconds,
      damageWeight: damageWeights[i],
      target: "enemy",
    })),
  };
}




const ORIGIN_SKY_COLOR_PALETTES = {
  thunder: [
    "#050816",
    "#071A33",
    "#10163A",
    "#1A103A",
    "#001C2E",
    "#0C1028",
  ],
  fire: [
    "#210600",
    "#2A1105",
    "#301108",
    "#3A0900",
    "#1E0B05",
    "#2E1600",
  ],
  cosmic: [
    "#03000A",
    "#070012",
    "#10051A",
    "#120027",
    "#050017",
    "#0A0820",
  ],
  ice: [
    "#061622",
    "#102033",
    "#071A2A",
    "#001D2E",
    "#0B1828",
    "#11253A",
  ],
  machine: [
    "#101010",
    "#151515",
    "#1A1812",
    "#0F1418",
    "#181A20",
    "#0B0F12",
  ],
  default: [
    "#130A22",
    "#10051A",
    "#0A1020",
    "#160821",
    "#081221",
    "#1A102A",
  ],
};

function pickSkyColor(kind = "default") {
  return pick(ORIGIN_SKY_COLOR_PALETTES[kind] || ORIGIN_SKY_COLOR_PALETTES.default);
}



function getMainAssetProfile(mainAsset) {
  if (["雷", "プラズマ", "光球"].includes(mainAsset)) {
    return {
      color: "#8FEAFF",
      darkColor: "#081A38",
      circle: "魔法陣9",
      finish: "大爆発",
      sky: pickSkyColor("thunder"),
    };
  }

  if (["炎球", "竜巻", "太陽", "火山", "不死鳥"].includes(mainAsset)) {
    return {
      color: "#FF8A2A",
      darkColor: "#2A0800",
      circle: "魔法陣3",
      finish: "大爆発",
      sky: pickSkyColor("fire"),
    };
  }

  if (["月", "銀河", "多線球", "蠢く多面球", "二重螺旋球"].includes(mainAsset)) {
    return {
      color: "#9E7BFF",
      darkColor: "#080018",
      circle: "魔法陣8",
      finish: "銀河",
      sky: pickSkyColor("cosmic"),
    };
  }

  if (["ツララ", "雪1", "雪2", "雪結晶1", "雪結晶2"].includes(mainAsset)) {
    return {
      color: "#BDEBFF",
      darkColor: "#071622",
      circle: "魔法陣2",
      finish: "大爆発",
      sky: pickSkyColor("ice"),
    };
  }

  if (["戦車", "戦闘機", "六足ロボ", "トルーパー"].includes(mainAsset)) {
    return {
      color: "#FFD36A",
      darkColor: "#1A1812",
      circle: "魔法陣10",
      finish: "大爆発",
      sky: pickSkyColor("machine"),
    };
  }

  return {
    color: "#D48FFF",
    darkColor: "#10051A",
    circle: "魔法陣3",
    finish: "大爆発",
    sky: pickSkyColor("default"),
  };
}

function buildVerticalCircleObject(id, asset, color, life = 3.8) {
  return makeVisualObject({
    id,
    asset,
    count: 1,
    position: "in_front_of_self",

    // largeだと視界を塞ぎやすいのでmedium寄りにする
    size: "medium",

    life,
    color,
    spread: "none",
    target: "in_front_of_self",
    duration: 0,
    path: "none",
    enter: "scale_up",
    exit: "scale_down",

    // 重要：縦魔法陣は回転させない
    rotate: false,
    rotationSpeed: "slow",

    faceEnemy: true,

    // 縦に立てる
    rotationOffset: {
      x: Math.PI / 2,
      y: 0,
      z: 0,
    },

    // キャラ中心ではなく、少し前・少し上
    positionOffset: {
      forward: 3.2,
      y: 2.4,
    },
  });
}




function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTemporaryGeminiError(error) {
  const status = Number(error?.status || error?.response?.status || 0);
  const message = String(error?.message || "");

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("503") ||
    message.includes("Service Unavailable") ||
    message.includes("high demand")
  );
}

async function generateGeminiContentWithRetry({
  genAI,
  modelName,
  contents,
  maxAttempts = 4,
}) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return await model.generateContent(contents);
    } catch (error) {
      lastError = error;

      if (!isTemporaryGeminiError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const waitMs =
        700 * Math.pow(2, attempt - 1) +
        Math.floor(Math.random() * 400);

      console.warn("[origin-magic-circle] gemini retry:", {
        attempt,
        nextAttempt: attempt + 1,
        waitMs,
        status: error?.status,
        message: String(error?.message || "").slice(0, 200),
      });

      await sleep(waitMs);
    }
  }

  throw lastError;
}

function pickByStableHash(values, seed, salt = "") {
  const list = values.filter(Boolean);
  if (!list.length) return "";

  const hash = crypto
    .createHash("sha256")
    .update(`${seed || "fallback"}:${salt}`)
    .digest("hex");

  const index = parseInt(hash.slice(0, 8), 16) % list.length;
  return list[index];
}

function estimateFallbackArtScore(strokeJson) {
  try {
    const parsed = JSON.parse(String(strokeJson || ""));
    const strokes = Array.isArray(parsed?.strokes) ? parsed.strokes : [];

    const strokeCount = strokes.length;
    const pointCount = strokes.reduce((sum, stroke) => {
      return sum + Math.floor((Array.isArray(stroke) ? stroke.length : 0) / 2);
    }, 0);

    return Math.round(
      clamp(30 + strokeCount * 4 + pointCount / 10, 25, 85, 50)
    );
  } catch {
    return 50;
  }
}

function createFallbackOriginMagicCircleConcept({
  imageHash,
  strokeJson,
  shape64,
}) {
  const seed = imageHash || shape64 || String(Date.now());

  const mainAsset = pickByStableHash(
    Object.keys(ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP),
    seed,
    "mainAsset"
  );

  const prefix = pickByStableHash(
    ["虚空", "終焉", "蒼雷", "紅蓮", "氷獄", "星骸", "神罰", "深淵", "天翔", "黒翼"],
    seed,
    "prefix"
  );

  const suffix = pickByStableHash(
    ["断罪", "審判", "解放", "轟臨", "葬送", "崩壊", "輪舞", "召喚", "聖歌", "咆哮"],
    seed,
    "suffix"
  );

  return {
    magicName: `${prefix}の${suffix}`,
    artScore: estimateFallbackArtScore(strokeJson),
    mainAsset,
  };
}





function buildOriginMagicCircleEffectFromConcept(concept) {
  const magicName = concept.magicName;
  const artScore = concept.artScore;
  const mainAsset = concept.mainAsset;

  const profile = getMainAssetProfile(mainAsset);
  const supportAssets = chooseSupportAssets(mainAsset, 5);

  const pattern = pick(ORIGIN_MAGIC_CIRCLE_PATTERN_POOL);

  const mainFile = toAssetFileName(mainAsset);
  const circleAsset = profile.circle;
  const gateAsset = pick(["ゲート1", "ゲート2", "円盤", "鳥居", "動く鳥居"]);
  const finishAsset = profile.finish || pick(ORIGIN_MAGIC_CIRCLE_FINISH_ASSETS);

  const timedVisualEffects = [];
  const sceneEffects = [];
  const impactTimes = [];

  const add = (time, objects) => {
    timedVisualEffects.push(makeTimedEffect(time, Array.isArray(objects) ? objects : [objects]));
  };

  const addScene = (time, type, options = {}) => {
    sceneEffects.push(makeSceneEffect(time, type, options));
  };

  // 共通：発動予兆。全魔法で「縦の魔法陣」を出す
  add(0, [
    buildVerticalCircleObject("origin_vertical_circle", circleAsset, profile.color, 5.2),
    makeVisualObject({
  id: "origin_charge_aura",
  asset: pick(["オーラ", "光球", "シンプルリング", "雲"]),
  count: 3,
  position: "self_position",
  size: "medium",
  life: 3.2,
  color: profile.color,
  spread: "circle",
  enter: "scale_up",
  exit: "rise_to_sky",

  // オブジェクト自体の自転は弱める
  rotate: Math.random() < 0.25,
  rotationSpeed: "slow",

  // キャラ中心ではなく、少し前・少し上
  positionOffset: {
    forward: 2.8,
    y: 2.2,
  },

  // main.js側で追加する公転設定
  orbit: {
    centerPosition: "self_position",
    radius: 4.2,
    height: 2.2,
    speed: 1.15,
    verticalWobble: 0.45,
  },
}),
  ]);

  addScene(0, "sky_color", {
    color: profile.sky,
    durationSeconds: 5.5,
  });

  addScene(0.25, "camera_pulse", {
    durationSeconds: 1.2,
    strength: 0.45,
  });

  addScene(0.1, "camera_move", {
  durationSeconds: 0.85,
  holdSeconds: 0.45,
  right: pick([-4.5, 4.5]),
  y: 2.2,
  forward: -1.8,
  lookAt: "self",
});

  const family = pattern;

  if (
    family === "vertical_circle_single_judgment" ||
    family === "above_enemy_execution" ||
    family === "silence_then_flash"
  ) {
    add(1.2, makeVisualObject({
      id: "omen_cloud",
      asset: pick(["雲", "光球", "シンプルリング"]),
      count: 5,
      position: "above_enemy",
      size: "medium",
      life: 3.5,
      color: profile.color,
      spread: "circle",
      enter: "scale_up",
      exit: "scale_down",
      rotate: true,
      rotationSpeed: "fast",
    }));

    add(2.4, makeVisualObject({
      id: "main_judgment",
      asset: mainAsset,
      count: mainAsset === "雷" ? 1 : 3,
      position: "above_enemy",
      size: "large",
      life: 3.5,
      color: profile.color,
      spread: "vertical_line",
      target: "enemy_position",
      duration: 0.9,
      path: "fall_from_above",
      enter: "fall_from_sky",
      exit: "rise_to_sky",
      rotate: true,
      rotationSpeed: "fast",
    }));

    add(3.3, makeVisualObject({
      id: "finish_burst",
      asset: finishAsset,
      count: 1,
      position: "enemy_position",
      size: "large",
      life: 2.8,
      color: "#FFFFFF",
      spread: "none",
      enter: "scale_up",
      exit: "scale_down",
    }));

    addScene(2.4, "camera_shake", { durationSeconds: 0.75, strength: 0.65 });
    impactTimes.push(2.5, 3.4, 5.5);
  } else if (
    family === "vertical_circle_barrage" ||
    family === "multi_phase_barrage" ||
    family === "light_lane"
  ) {
    add(1.0, makeVisualObject({
      id: "main_barrage_1",
      asset: mainAsset,
      count: 6,
      position: "in_front_of_self",
      size: "medium",
      life: 4.2,
      color: profile.color,
      spread: "horizontal_line",
      target: "enemy_position",
      duration: 1.2,
      path: "straight_line",
      enter: "scale_up",
      exit: "scale_down",
      rotate: true,
      rotationSpeed: "fast",
      positionOffset: { forward: 2, y: 2 },
    }));

    add(1.8, makeVisualObject({
      id: "main_barrage_2",
      asset: mainAsset,
      count: 8,
      position: "in_front_of_self",
      size: "small",
      life: 4.5,
      color: "#FFFFFF",
      spread: "random_scatter",
      target: "above_enemy",
      duration: 1.6,
      path: "arc",
      enter: "scale_up",
      exit: "rise_to_sky",
      rotate: true,
      rotationSpeed: "fast",
      positionOffset: { forward: 1, y: 3 },
    }));

    add(3.4, makeVisualObject({
      id: "barrage_finish",
      asset: finishAsset,
      count: 1,
      position: "enemy_position",
      size: "large",
      life: 3,
      color: profile.color,
      spread: "none",
      enter: "scale_up",
      exit: "sink_into_ground",
    }));

    addScene(1.6, "camera_shake", { durationSeconds: 1.6, strength: 0.35 });
    impactTimes.push(2.2, 3.0, 3.8, 5.8);
  } else if (
    family === "sky_mass_rain" ||
    family === "meteor_fall" ||
    family === "snowfall_execution"
  ) {
    add(0.9, makeVisualObject({
      id: "sky_omen",
      asset: pick(["雲", "銀河", "魔法陣9", "光球"]),
      count: 4,
      position: "above_battlefield_center",
      size: "large",
      life: 4,
      color: profile.darkColor,
      spread: "circle",
      enter: "fall_from_sky",
      exit: "scale_down",
    }));

    add(2.0, makeVisualObject({
      id: "main_rain",
      asset: mainAsset,
      count: 12,
      position: "above_enemy",
      size: "medium",
      life: 4.2,
      color: profile.color,
      spread: "random_scatter",
      target: "enemy_position",
      duration: 1.1,
      path: "fall_from_above",
      enter: "fall_from_sky",
      exit: "sink_into_ground",
      rotate: true,
      rotationSpeed: "fast",
      positionOffset: { y: 8 },
    }));

    add(4.2, makeVisualObject({
      id: "rain_final",
      asset: mainAsset,
      count: 1,
      position: "above_enemy",
      size: "large",
      life: 3.4,
      color: "#FFFFFF",
      spread: "none",
      target: "enemy_position",
      duration: 0.8,
      path: "fall_from_above",
      enter: "fall_from_sky",
      exit: "scale_down",
    }));

    addScene(2.1, "camera_shake", { durationSeconds: 2.0, strength: 0.45 });
    impactTimes.push(2.8, 3.5, 4.8, 6.5);
  } else if (
    family === "gate_release" ||
    family === "gate_army" ||
    family === "dark_gate"
  ) {
    add(0.8, makeVisualObject({
      id: "gate",
      asset: gateAsset,
      count: 1,
      position: "in_front_of_self",
      size: "large",
      life: 6.5,
      color: profile.color,
      spread: "none",
      enter: "scale_up",
      exit: "sink_into_ground",
      rotate: false,
      rotationSpeed: "slow",
      faceEnemy: true,
      positionOffset: { forward: 3, y: 2 },
    }));

    add(1.6, makeVisualObject({
      id: "gate_main_release",
      asset: mainAsset,
      count: 5,
      position: "in_front_of_self",
      size: "medium",
      life: 5.5,
      color: profile.color,
      spread: "circle",
      target: "enemy_position",
      duration: 1.4,
      path: "straight_line",
      enter: "scale_up",
      exit: "rise_to_sky",
      rotate: true,
      rotationSpeed: "fast",
      positionOffset: { forward: 4, y: 2 },
    }));

    add(2.5, makeVisualObject({
      id: "gate_support",
      asset: pick(supportAssets),
      count: 4,
      position: "in_front_of_self",
      size: "small",
      life: 4.5,
      color: "#FFFFFF",
      spread: "random_scatter",
      target: "above_enemy",
      duration: 1.8,
      path: "arc",
      enter: "scale_up",
      exit: "scale_down",
      positionOffset: { forward: 4, y: 2 },
    }));

    add(4.5, makeVisualObject({
      id: "gate_finish",
      asset: finishAsset,
      count: 1,
      position: "enemy_position",
      size: "large",
      life: 2.8,
      color: profile.color,
      enter: "scale_up",
      exit: "scale_down",
    }));

    addScene(4.5, "camera_shake", { durationSeconds: 1.0, strength: 0.6 });
    impactTimes.push(2.3, 3.4, 4.8, 6.8);
  } else if (
    family === "enemy_encircle" ||
    family === "crossfire" ||
    family === "enemy_backstab" ||
    family === "tank_siege"
  ) {
    add(1.0, makeVisualObject({
      id: "encircle_main",
      asset: mainAsset,
      count: 8,
      position: "enemy_position",
      size: "medium",
      life: 5.5,
      color: profile.color,
      spread: "circle",
      target: "enemy_position",
      duration: 0,
      path: "none",
      enter: "rise_from_ground",
      exit: "scale_down",
      rotate: true,
      rotationSpeed: "fast",
    }));

    add(2.2, makeVisualObject({
      id: "encircle_support",
      asset: pick(supportAssets),
      count: 6,
      position: "above_enemy",
      size: "small",
      life: 4.8,
      color: "#FFFFFF",
      spread: "circle",
      target: "enemy_position",
      duration: 1.1,
      path: "fall_from_above",
      enter: "fall_from_sky",
      exit: "sink_into_ground",
    }));

    add(4.0, makeVisualObject({
      id: "encircle_crush",
      asset: finishAsset,
      count: 1,
      position: "enemy_position",
      size: "large",
      life: 3.2,
      color: profile.color,
      enter: "scale_up",
      exit: "scale_down",
    }));

    addScene(1.2, "camera_pulse", { durationSeconds: 1.0, strength: 0.3 });
    addScene(4.0, "camera_shake", { durationSeconds: 1.0, strength: 0.7 });
    impactTimes.push(2.4, 4.2, 6.8);
  } else if (
    family === "behind_stand" ||
    family === "dragon_assault" ||
    family === "wing_judgment" ||
    family === "hell_wing_drop" ||
    family === "angelic_pillar"
  ) {
    const standAsset = ["アニメドラゴン", "弱ドラゴン", "竜騎士", "天使翼", "悪魔翼", "翼"].includes(mainAsset)
      ? mainAsset
      : pick(["アニメドラゴン", "天使翼", "悪魔翼", "翼", mainAsset]);

    add(0.9, makeVisualObject({
      id: "stand",
      asset: standAsset,
      count: 1,
      position: "behind_self",
      size: "large",
      life: 6.2,
      color: profile.color,
      spread: "none",
      enter: "rise_from_ground",
      exit: "rise_to_sky",
      rotate: false,
      rotationSpeed: "slow",
      faceEnemy: true,
      positionOffset: { forward: -2, y: 3 },
    }));

    add(2.2, makeVisualObject({
      id: "stand_attack",
      asset: mainAsset,
      count: 5,
      position: "behind_self",
      size: "medium",
      life: 4.5,
      color: "#FFFFFF",
      spread: "horizontal_line",
      target: "enemy_position",
      duration: 1.2,
      path: "arc",
      enter: "scale_up",
      exit: "scale_down",
      positionOffset: { forward: -1, y: 5 },
    }));

    add(4.2, makeVisualObject({
      id: "stand_finish",
      asset: finishAsset,
      count: 1,
      position: "above_enemy",
      size: "large",
      life: 3.2,
      color: profile.color,
      target: "enemy_position",
      duration: 0.8,
      path: "fall_from_above",
      enter: "fall_from_sky",
      exit: "scale_down",
    }));

    addScene(2.2, "camera_pulse", { durationSeconds: 1.3, strength: 0.55 });
    addScene(4.5, "camera_shake", { durationSeconds: 1.0, strength: 0.65 });
    impactTimes.push(3.0, 4.8, 6.8);
  } else {
    // その他30種類以上のpatternはここに集約。
    // pattern名は毎回変わるので、同じmainAssetでも見え方が散る。
    add(1.0, makeVisualObject({
      id: "phase_main_1",
      asset: mainAsset,
      count: 5,
      position: pick(["above_self", "battlefield_center", "in_front_of_self", "above_battlefield_center"]),
      size: pick(["medium", "large"]),
      life: 5.5,
      color: profile.color,
      spread: pick(["circle", "horizontal_line", "random_scatter"]),
      target: pick(["enemy_position", "above_enemy", "battlefield_center"]),
      duration: 1.2 + Math.random() * 1.4,
      path: pick(["straight_line", "arc", "fall_from_above", "orbit"]),
      enter: pick(["scale_up", "fall_from_sky", "rise_from_ground"]),
      exit: pick(["scale_down", "rise_to_sky", "sink_into_ground"]),
      rotate: true,
      rotationSpeed: pick(["normal", "fast"]),
      positionOffset: { y: Math.random() * 3 },
    }));

    add(2.2, makeVisualObject({
      id: "phase_support",
      asset: pick(supportAssets),
      count: 4 + Math.floor(Math.random() * 5),
      position: pick(["battlefield_center", "enemy_position", "above_enemy"]),
      size: pick(["small", "medium"]),
      life: 4.8,
      color: "#FFFFFF",
      spread: pick(["circle", "vertical_line", "random_scatter"]),
      target: "enemy_position",
      duration: Math.random() < 0.5 ? 0 : 1.1,
      path: pick(["none", "arc", "fall_from_above"]),
      enter: pick(["scale_up", "fall_from_sky", "rise_from_ground"]),
      exit: pick(["scale_down", "rise_to_sky", "sink_into_ground"]),
    }));

    add(3.8, makeVisualObject({
      id: "phase_main_2",
      asset: mainAsset,
      count: 1 + Math.floor(Math.random() * 4),
      position: pick(["above_enemy", "enemy_position", "above_battlefield_center"]),
      size: "large",
      life: 4.2,
      color: profile.color,
      spread: pick(["none", "circle", "vertical_line"]),
      target: "enemy_position",
      duration: Math.random() < 0.5 ? 0 : 0.9,
      path: pick(["none", "fall_from_above", "rise_from_below"]),
      enter: pick(["scale_up", "fall_from_sky"]),
      exit: pick(["scale_down", "sink_into_ground"]),
      rotate: true,
      rotationSpeed: "fast",
    }));

    add(5.8, makeVisualObject({
      id: "phase_finish",
      asset: finishAsset,
      count: 1,
      position: "enemy_position",
      size: "large",
      life: 2.9,
      color: profile.color,
      enter: "scale_up",
      exit: "scale_down",
    }));

    addScene(1.5, "camera_pulse", { durationSeconds: 1.0, strength: 0.4 });
    addScene(5.8, "camera_shake", { durationSeconds: 1.1, strength: 0.65 });
    impactTimes.push(2.2, 4.4, 6.2, 8.0);
  }

  timedVisualEffects.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  sceneEffects.sort((a, b) => a.timeSeconds - b.timeSeconds);

  const damageInfo = createDamageTimingsFromImpactTimes(impactTimes, artScore);

  return normalizeOriginMagicCircleEffectJson({
    magicName,
    artScore,
    mainAsset: toAssetFileName(mainAsset),
    mainAssetName: mainAsset,
    pattern,
    timedVisualEffects,
    sceneEffects,
    totalDamage: damageInfo.totalDamage,
    damageTimings: damageInfo.damageTimings,

    // リザルト・デバッグ用。旧timelineの代わりに概念を残す
    timeline: [
      {
        time: 0,
        actions: [
          {
            action: "concept",
            mainAsset,
            pattern,
          },
        ],
      },
    ],
  });
}
//大量追加ここまで





function normalizeOriginMagicCircleTimelineJson(rawJson){
  const parsed=typeof rawJson==='string'?JSON.parse(rawJson):rawJson||{};
  const timeline=Array.isArray(parsed.timeline)?parsed.timeline:[];
  const magicName=String(parsed.magicName||'深淵輪廻・無銘終焉').trim()||'深淵輪廻・無銘終焉';
  const artScore=Math.round(clamp(parsed.artScore,0,100,0));
  const spawned=new Set();const despawned=new Set();
  const normalized=[];
  timeline.forEach((node)=>{const time=clamp(node?.time,0,10,0);const actions=[];
    for (const a of (Array.isArray(node?.actions) ? node.actions : [])) {
      
      
          const action=String(a?.action||'').trim();const id=String(a?.id||'').trim();if(!id) continue;
    if(action==='spawn'){
      spawned.add(id);
      actions.push({
        action,
        id,
        assetFileName:toAssetFileName(a.assetFileName),
        objectCount:Math.round(clamp(a.objectCount,1,5,1)),
        position:ORIGIN_MAGIC_CIRCLE_POSITION_CANDIDATES.includes(a.position)?a.position:'battlefield_center',
        objectSize:ORIGIN_MAGIC_CIRCLE_SIZE_CANDIDATES.includes(a.objectSize)?a.objectSize:'medium'
      });
      
      
    } else if(action==='move' && spawned.has(id) && !despawned.has(id)){
      actions.push({action,id,targetPosition:ORIGIN_MAGIC_CIRCLE_POSITION_CANDIDATES.includes(a.targetPosition)?a.targetPosition:'enemy_position'});
    } else if(action==='despawn' && spawned.has(id) && !despawned.has(id)){
      despawned.add(id);actions.push({action,id});
    }
  }if(actions.length) normalized.push({time,actions});});
  normalized.sort((a,b)=>a.time-b.time);
  const alive=[...spawned].filter(id=>!despawned.has(id));
  if(alive.length){normalized.push({time:clamp(8+Math.random()*2,8,10,9),actions:alive.map(id=>({action:'despawn',id}))});}
  const assets=new Set();for(const t of normalized)for(const a of t.actions)if(a.action==='spawn')assets.add(a.assetFileName);
  const ids=[...spawned];
  while(assets.size<4){const id=`auto${assets.size+1}`;const asset=pick(Object.values(ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP));assets.add(asset);normalized.push({time:clamp(Math.random()*6,0,6,0),actions:[{action:'spawn',id,assetFileName:asset,objectCount:1+Math.floor(Math.random()*2),position:pick(ORIGIN_MAGIC_CIRCLE_POSITION_CANDIDATES),objectSize:pick(ORIGIN_MAGIC_CIRCLE_SIZE_CANDIDATES)}]});normalized.push({time:clamp(8+Math.random()*2,8,10,9),actions:[{action:'despawn',id}]});}
  normalized.sort((a,b)=>a.time-b.time);
  return {magicName,artScore,timeline:normalized};
}

function expandOriginMagicCircleTimelineToEffectJson(timelineJson){
  const baseColor=`#${Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0').toUpperCase()}`;
  const spawns=new Map();const despawnAt=new Map();const moves=new Map();
  for(const t of timelineJson.timeline){for(const a of t.actions){if(a.action==='spawn')spawns.set(a.id,{...a,start:t.time});if(a.action==='despawn')despawnAt.set(a.id,t.time);if(a.action==='move'){if(!moves.has(a.id))moves.set(a.id,[]);moves.get(a.id).push({time:t.time,targetPosition:a.targetPosition});}}}
  const timedVisualEffects=[];
  for(const [id,s] of spawns){const end=clamp(despawnAt.get(id)??(8+Math.random()*2),0.5,10,9);const life=clamp(end-s.start,0.5,10,8);const firstMove=(moves.get(id)||[])[0];timedVisualEffects.push({startTimeSeconds:s.start,visualObjects:[{id,assetFileName:s.assetFileName,objectCount:s.objectCount,spawnPosition:s.position,spawnSpreadPattern:pick(ORIGIN_MAGIC_CIRCLE_SPREAD_PATTERNS),colorHexCode:randomColorFromBase(baseColor),objectSize:s.objectSize,lifeTimeSeconds:life,enterEffect:pick(ORIGIN_MAGIC_CIRCLE_ENTER_EFFECTS),exitEffect:pick(ORIGIN_MAGIC_CIRCLE_EXIT_EFFECTS),movement:firstMove?{targetPosition:firstMove.targetPosition,moveDurationSeconds:clamp(Math.random()*1.9+0.6,0.6,Math.max(0.6,life-0.1),1),movePathType:pick(ORIGIN_MAGIC_CIRCLE_MOVE_PATH_TYPES)}:{targetPosition:'self_position',moveDurationSeconds:0,movePathType:'none'},rotation:{shouldRotate:Math.random()<0.8,rotationSpeed:pick(ORIGIN_MAGIC_CIRCLE_ROTATION_SPEEDS)}}]});
    for(const m of (moves.get(id)||[]).slice(1)){timedVisualEffects.push({startTimeSeconds:m.time,visualObjects:[{id,assetFileName:s.assetFileName,objectCount:s.objectCount,spawnPosition:s.position,spawnSpreadPattern:'none',colorHexCode:randomColorFromBase(baseColor),objectSize:s.objectSize,lifeTimeSeconds:clamp(life-(m.time-s.start),0.5,10,1.5),enterEffect:'scale_up',exitEffect:pick(ORIGIN_MAGIC_CIRCLE_EXIT_EFFECTS),movement:{targetPosition:m.targetPosition,moveDurationSeconds:clamp(Math.random()+0.6,0.6,2.5,1),movePathType:pick(ORIGIN_MAGIC_CIRCLE_MOVE_PATH_TYPES)},rotation:{shouldRotate:true,rotationSpeed:pick(ORIGIN_MAGIC_CIRCLE_ROTATION_SPEEDS)}}]});}
  }
  timedVisualEffects.sort((a,b)=>a.startTimeSeconds-b.startTimeSeconds);
  return {magicName:timelineJson.magicName,artScore:timelineJson.artScore,timeline:timelineJson.timeline,timedVisualEffects};
}
function createOriginMagicCircleDamageTimings(expandedEffectJson, artScore){
  const totalDamage=Math.round(
    clamp(80+artScore*2.2,80,300,80)
  );

  const candidates=[];

  for(const t of expandedEffectJson.timeline||[]){
    for(const a of t.actions||[]){

      // 敵へ移動した瞬間
      if(
        a.action==='move' &&
        ['enemy_position','above_enemy'].includes(a.targetPosition)
      ){
        candidates.push(
          clamp(t.time,0.5,9.5,2)
        );
      }

      // 敵側に大型出現した瞬間
      if(
        a.action==='spawn' &&
        ['enemy_position','above_enemy'].includes(a.position) &&
        a.objectSize==='large'
      ){
        candidates.push(
          clamp(t.time+0.8,0.5,9.5,2.5)
        );
      }
    }
  }

  // ===== ここ追加 =====

  const latestEffectEnd = Math.max(
    ...(
      expandedEffectJson.timedVisualEffects || []
    ).flatMap(effect =>
      (effect.visualObjects || []).map(obj =>
        Number(effect.startTimeSeconds || 0) +
        Number(obj.lifeTimeSeconds || 0)
      )
    ),
    4
  );

  // 最後の演出終了直前に大ダメージ
  candidates.push(
    clamp(latestEffectEnd - 0.2,0.5,9.5,4)
  );

  // ===== ここまで =====

  const uniq=[
    ...new Set(
      candidates.map(v=>Number(v.toFixed(2)))
    )
  ]
  .sort((a,b)=>a-b)
  .slice(0,5);

  if(!uniq.length) uniq.push(2.5);

  const w=uniq.map(()=>1);

  // 最後を重くする
  w[w.length-1]=2;

  const sum=w.reduce((a,b)=>a+b,0);

  let assigned=w.map(x=>
    Math.round((x/sum)*100)
  );

  let diff=100-assigned.reduce((a,b)=>a+b,0);

  assigned[assigned.length-1]+=diff;

  return {
    totalDamage,
    damageTimings:uniq.map((t,i)=>({
      timeSeconds:t,
      damageWeight:assigned[i],
      target:'enemy'
    }))
  };
}


function normalizeOriginMagicCircleEffectJson(effectJson) {
  if (!effectJson || typeof effectJson !== "object") return effectJson;
  const cloned = JSON.parse(JSON.stringify(effectJson));
  const timedVisualEffects = Array.isArray(cloned.timedVisualEffects) ? cloned.timedVisualEffects : [];
  for (const effect of timedVisualEffects) {
    const visualObjects = Array.isArray(effect?.visualObjects) ? effect.visualObjects : [];
    for (const visualObject of visualObjects) {
      const currentName = String(visualObject?.assetFileName || "").trim();
      if (currentName && ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP[currentName]) {
        visualObject.assetFileName = ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP[currentName];
      }
    }
  }
  return cloned;
}


    
    function normalizeOriginMagicCircleStrokeJson(rawStrokeJson) {
  const raw = String(rawStrokeJson || "").trim();
  if (!raw) return "";

  try {
    const parsed = JSON.parse(raw);

    // 旧形式: [[x,y,x,y], ...]
    // 新形式: { w, h, strokes: [[x,y,x,y], ...] }
    const sourceStrokes = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.strokes)
        ? parsed.strokes
        : null;

    if (!sourceStrokes) return "";

    const rawW = Number(parsed?.w);
    const rawH = Number(parsed?.h);

    const safeW =
      Number.isFinite(rawW) && rawW > 0
        ? Math.min(Math.round(rawW), 10000)
        : 0;

    const safeH =
      Number.isFinite(rawH) && rawH > 0
        ? Math.min(Math.round(rawH), 10000)
        : 0;

    const normalizedStrokes = [];

    for (const stroke of sourceStrokes) {
      if (!Array.isArray(stroke)) continue;

      const points = [];
      const usableLength = stroke.length - (stroke.length % 2);

      for (let i = 0; i < usableLength; i += 2) {
        let x = Math.round(Number(stroke[i]));
        let y = Math.round(Number(stroke[i + 1]));

        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        if (safeW > 0) {
          x = Math.max(0, Math.min(safeW - 1, x));
        } else if (x < -10000 || x > 10000) {
          continue;
        }

        if (safeH > 0) {
          y = Math.max(0, Math.min(safeH - 1, y));
        } else if (y < -10000 || y > 10000) {
          continue;
        }

        points.push(x, y);
      }

      if (points.length >= 4) {
        normalizedStrokes.push(points);
      }
    }

    if (!normalizedStrokes.length) return "";

    let payload = {
      w: safeW,
      h: safeH,
      strokes: normalizedStrokes,
    };

    let json = JSON.stringify(payload);

    // Sheets 1セル 50,000文字制限対策
    while (json.length > 45000 && payload.strokes.length > 1) {
      payload.strokes.pop();
      json = JSON.stringify(payload);
    }

    if (json.length > 45000) return "";

    return json;
  } catch {
    return "";
  }
}





      
export function mountOriginMagicCircleRoutes(app, io) {
  const roomCastEvents = new Map();
  const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
  const routePath = "/オリジン魔法陣";
  
  async function cleanupOriginRoomsQuietly() {
  try {
    await cleanupExpiredOriginMagicCircleRooms();
  } catch (error) {
    console.warn("[origin-magic-circle] cleanup expired rooms failed:", error);
  }
}


  const encodedPath = encodeURI(routePath);
  const htmlPath = path.join(process.cwd(), "public/origin-magic-circle/index.html");

  app.get(routePath, (_req, res) => {
    res.sendFile(htmlPath);
  });

  app.get(encodedPath, (_req, res) => {
    res.sendFile(htmlPath);
  });

  app.post("/api/origin-magic-circle/rooms/create", async (req, res) => {
  await cleanupOriginRoomsQuietly();
    const username = String(req.body?.username || "guest").trim() || "guest";
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();
    if (!userTrackingId) return res.status(400).json({ error: "userTrackingId is required" });

    try {
      const room = await createOriginMagicCircleRoom({ username, clientId: userTrackingId });
      return res.json(room);
    } catch (error) {
      console.error("[origin-magic-circle] create room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });





  app.get("/api/origin-magic-circle/rooms/active", async (req, res) => {
  await cleanupOriginRoomsQuietly();

  const userTrackingId = String(req.query?.userTrackingId || req.query?.clientId || "").trim();

  if (!userTrackingId) {
    return res.status(400).json({ error: "userTrackingId is required" });
  }

  try {
    const room = await findActiveOriginMagicCircleRoomByClientId(userTrackingId);

    if (!room) {
      return res.status(404).json({ error: "active_room_not_found" });
    }

    return res.json(room);
  } catch (error) {
    console.error("[origin-magic-circle] active room error:", error);
    return res.status(500).json({ error: "server_error" });
  }
});




  
  app.post("/api/origin-magic-circle/rooms/join", async (req, res) => {
  await cleanupOriginRoomsQuietly();
    const username = String(req.body?.username || "guest").trim() || "guest";
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();
    const roomId = String(req.body?.roomId || "").trim();
    if (!roomId || !userTrackingId) {
      return res.status(400).json({ error: "roomId and userTrackingId are required" });
    }

    try {
      const room = await joinOriginMagicCircleRoom({ roomId, username, clientId: userTrackingId });
      return res.json(room);
    } catch (error) {
      if (error.message === "room_not_found") return res.status(404).json({ error: "room_not_found" });
      if (error.message === "room_not_lobby") return res.status(409).json({ error: "room_not_lobby" });
      if (error.message === "room_full") return res.status(409).json({ error: "room_full" });
      console.error("[origin-magic-circle] join room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/origin-magic-circle/rooms/delete", async (req, res) => {
    const roomId = String(req.body?.roomId || "").trim();
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();
    if (!roomId || !userTrackingId) {
      return res.status(400).json({ error: "roomId and userTrackingId are required" });
    }

    try {
      const room = await deleteOriginMagicCircleRoom({ roomId, hostClientId: userTrackingId });
      return res.json(room);
    } catch (error) {
      if (error.message === "room_not_found") return res.status(404).json({ error: "room_not_found" });
      if (error.message === "room_not_lobby") return res.status(409).json({ error: "room_not_lobby" });
      if (error.message === "forbidden") return res.status(403).json({ error: "forbidden" });
      console.error("[origin-magic-circle] delete room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });


  app.post("/api/origin-magic-circle/rooms/start", async (req, res) => {
    const roomId = String(req.body?.roomId || "").trim();
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();

    if (!roomId || !userTrackingId) {
      return res.status(400).json({ error: "roomId and userTrackingId are required" });
    }

    try {
      const room = await getOriginMagicCircleRoomById(roomId);
      if (!room) return res.status(404).json({ error: "room_not_found" });
      if (room.status !== "lobby") return res.status(409).json({ error: "room_not_lobby" });
      if ((room.members || []).length !== 2) return res.status(409).json({ error: "room_not_ready" });

      const started = await startOriginMagicCircleBattle({
  roomId,
  requestedByClientId: userTrackingId,
  requireLoadReady: false,
});

io?.to(originSocketRoom(roomId)).emit("origin:room", started);

return res.json(started);

      return res.json(started);
    } catch (error) {
      if (error.message === "room_not_found") return res.status(404).json({ error: "room_not_found" });
      if (error.message === "forbidden") return res.status(403).json({ error: "forbidden" });
      console.error("[origin-magic-circle] start room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });


  app.post("/api/origin-magic-circle/rooms/loading", async (req, res) => {
    const roomId = String(req.body?.roomId || "").trim();
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();
    const isLoaded = Boolean(req.body?.isLoaded);
    if (!roomId || !userTrackingId) {
      return res.status(400).json({ error: "roomId and userTrackingId are required" });
    }

    try {
      const room = await updateOriginMagicCircleMemberLoadState({
        roomId,
        clientId: userTrackingId,
        isLoaded,
      });
      return res.json(room);
    } catch (error) {
      if (error.message === "room_not_found") return res.status(404).json({ error: "room_not_found" });
      if (error.message === "forbidden") return res.status(403).json({ error: "forbidden" });
      console.error("[origin-magic-circle] loading update error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/origin-magic-circle/rooms/ready", async (req, res) => {
    const roomId = String(req.body?.roomId || "").trim();
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();

    if (!roomId || !userTrackingId) {
      return res.status(400).json({ error: "roomId and userTrackingId are required" });
    }

    try {
      const room = await getOriginMagicCircleRoomById(roomId);
      if (!room) return res.status(404).json({ error: "room_not_found" });
      if ((room.members || []).length !== 2) return res.status(409).json({ error: "room_not_ready" });
      const bothLoaded = (room.members || []).every((member) => member.loadReady === true);
      if (!bothLoaded) return res.status(409).json({ error: "opponent_loading" });

      const started = await startOriginMagicCircleBattle({ roomId });

io?.to(originSocketRoom(roomId)).emit("origin:room", started);

return res.json(started);




      
    } catch (error) {
      if (error.message === "room_not_found") return res.status(404).json({ error: "room_not_found" });
      if (error.message === "forbidden") return res.status(403).json({ error: "forbidden" });
      console.error("[origin-magic-circle] ready room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });




  app.post("/api/origin-magic-circle/turn/end", async (req, res) => {
  const roomId = String(req.body?.roomId || "").trim();
  const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();

  if (!roomId || !userTrackingId) {
    return res.status(400).json({ error: "roomId and userTrackingId are required" });
  }

  try {
    const room = await advanceOriginMagicCircleTurn({
      roomId,
      clientId: userTrackingId,
    });

    io?.to(originSocketRoom(roomId)).emit("origin:room", room);

    return res.json(room);
  } catch (error) {
    if (error.message === "room_not_found") return res.status(404).json({ error: "room_not_found" });
    if (error.message === "room_not_battle") return res.status(409).json({ error: "room_not_battle" });
    if (error.message === "room_not_ready") return res.status(409).json({ error: "room_not_ready" });
    if (error.message === "not_your_turn") return res.status(403).json({ error: "not_your_turn" });

    console.error("[origin-magic-circle] turn end error:", error);
    return res.status(500).json({ error: "server_error" });
  }
});




  
  app.post("/api/origin-magic-circle/rooms/leave", async (req, res) => {
    const roomId = String(req.body?.roomId || "").trim();
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();
    if (!roomId || !userTrackingId) {
      return res.status(400).json({ error: "roomId and userTrackingId are required" });
    }

    try {
      const room = await removeOriginMagicCircleMember({ roomId, clientId: userTrackingId });
      if (!room) return res.status(404).json({ error: "room_not_found" });
      return res.json(room);
    } catch (error) {
      console.error("[origin-magic-circle] leave room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.get("/api/origin-magic-circle/rooms/:roomId", async (req, res) => {
  await cleanupOriginRoomsQuietly();
    const roomId = String(req.params.roomId || "").trim();
    if (!roomId) return res.status(400).json({ error: "roomId is required" });

    try {
      const room = await getOriginMagicCircleRoomById(roomId);
      if (!room) return res.status(404).json({ error: "room_not_found" });
      return res.json(room);
    } catch (error) {
      console.error("[origin-magic-circle] get room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });




  app.post("/api/origin-magic-circle/rooms/rematch", async (req, res) => {
    const roomId = String(req.body?.roomId || "").trim();
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();

    if (!roomId || !userTrackingId) {
      return res.status(400).json({ error: "roomId and userTrackingId are required" });
    }

    try {
      const room = await resetOriginMagicCircleRoomForRematch({
        roomId,
        clientId: userTrackingId,
      });

      io?.to(originSocketRoom(roomId)).emit("origin:room", room);

      return res.json(room);
    } catch (error) {
      if (error.message === "room_not_found") return res.status(404).json({ error: "room_not_found" });
      if (error.message === "forbidden") return res.status(403).json({ error: "forbidden" });
      if (error.message === "room_not_ready") return res.status(409).json({ error: "room_not_ready" });
      console.error("[origin-magic-circle] rematch room error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/origin-magic-circle/rooms/hp", async (req, res) => {
    const roomId = String(req.body?.roomId || "").trim();
    const userTrackingId = String(req.body?.userTrackingId || req.body?.clientId || "").trim();
    if (!roomId || !userTrackingId) return res.status(400).json({ error: "roomId and userTrackingId are required" });

    try {
      const room = await updateOriginMagicCircleRoomHp({
        roomId,
        clientId: userTrackingId,
        selfHp: req.body?.selfHp,
        enemyHp: req.body?.enemyHp,
      });
      return res.json(room);
    } catch (error) {
      if (error.message === "room_not_found") return res.status(404).json({ error: "room_not_found" });
      if (error.message === "forbidden") return res.status(403).json({ error: "forbidden" });
      console.error("[origin-magic-circle] hp update error:", error);
      return res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/origin-magic-circle/chant-title", async (req, res) => {
  const base64ImageFile = String(req.body?.base64ImageFile || "").trim();
const strokeJson = normalizeOriginMagicCircleStrokeJson(req.body?.strokeJson);
const shape64 = normalizeOriginMagicCircleShape64(req.body?.shape64);



//const spellHash = String(req.body?.spellHash || req.body?.imageHash || "").trim();

console.log("[origin-magic-circle] stroke receive:", {
  hasRawStroke: !!String(req.body?.strokeJson || "").trim(),
  rawStrokeLength: String(req.body?.strokeJson || "").length,
  normalizedStrokeLength: strokeJson.length,
});



if (!base64ImageFile) return res.status(400).json({ error: "base64ImageFile is required" });
if (!shape64) return res.status(400).json({ error: "shape64 is required" });
if (!genAI) return res.status(500).json({ error: "gemini_key_missing" });

  const imageHash = createOriginMagicCircleImageHash(base64ImageFile);

  try {
    const cached = await findSimilarOriginMagicCircleSpellCacheByShape64(shape64);

if (cached?.rawJson) {
  const cachedSpellHash = String(cached.imageHash || "").trim();

  let cachedMagicEffectJson = null;

  try {
    const parsedCache = JSON.parse(cached.rawJson);
    const hasTimed = Array.isArray(parsedCache?.timedVisualEffects);
    if (hasTimed) {
      cachedMagicEffectJson = normalizeOriginMagicCircleEffectJson(parsedCache);
    } else {
      const timelineJson = normalizeOriginMagicCircleTimelineJson(parsedCache);
      const expandedEffectJson = expandOriginMagicCircleTimelineToEffectJson(timelineJson);
      
      
      
      
      
      const damageInfo = createOriginMagicCircleDamageTimings(
  expandedEffectJson,
  expandedEffectJson.artScore
);

cachedMagicEffectJson = normalizeOriginMagicCircleEffectJson({
  ...expandedEffectJson,
  totalDamage: damageInfo.totalDamage,
  damageTimings: damageInfo.damageTimings,
});

    
        
            
                    }
  } catch (error) {
    console.warn("[origin-magic-circle] cached rawJson parse failed:", {
      rowIndex: cached.rowIndex,
      imageHash: cached.imageHash,
      error,
    });
  }

  if (cachedMagicEffectJson && cachedSpellHash) {
  console.log("[origin-magic-circle] spell cache hit:", {
    cachedRowIndex: cached.rowIndex,
    currentImageHash: imageHash,
    cachedSpellHash,
    similarScore: cached.similarScore,
  });

  return res.json({
    magicEffectJson: cachedMagicEffectJson,

    // 今回描いた画像のhash。確認・デバッグ用
    imageHash,

    // 実際にcastLogへ保存すべきhash。
    // これはG列に存在するキャッシュ元hash。
    spellHash: cachedSpellHash,

    strokeJson,
    shape64,
    fromCache: true,
    similarScore: cached.similarScore,
    cachedRowIndex: cached.rowIndex,
  });
}
}


const geminiContents = [
  {
    inlineData: {
      mimeType: "image/png",
      data: base64ImageFile,
    },
  },
  {
    text: `画像の魔法陣を見てjsonのみ出力

{
  "magicName": "画像から連想した厨二病風の魔法名",
  "artScore": 0,
  "mainAsset": "雷"
}

ルール:
- JSON以外は禁止
- magicNameは厨二病風
- artScoreは0〜100。無意味な絵は20前後。何を表したいのかギリ読み取れるなら50前後
- mainAssetは必ず次の一覧から1つだけ選ぶ
${Object.keys(ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP).join(",")}
- mainAssetは画像から最も連想される主役素材にする
- timeline, timedVisualEffects, damageTimingsは出力しない`,
  },
];

let originalConceptJson = null;
let conceptJson = null;
let usedLocalFallback = false;

try {
  const response = await generateGeminiContentWithRetry({
    genAI,
    modelName: "gemini-2.5-flash-lite",
    contents: geminiContents,
    maxAttempts: 4,
  });

  const rawText = String(response.response.text() || "").trim();
  const jsonText = extractJsonText(rawText);

  originalConceptJson = JSON.parse(jsonText);
  conceptJson = normalizeOriginMagicCircleConceptJson(originalConceptJson);
} catch (error) {
  if (!isTemporaryGeminiError(error)) {
    throw error;
  }

  usedLocalFallback = true;

  conceptJson = createFallbackOriginMagicCircleConcept({
    imageHash,
    strokeJson,
    shape64,
  });

  originalConceptJson = {
    ...conceptJson,
    fallbackReason: "gemini_temporary_error",
    fallbackStatus: error?.status || "",
  };

  console.warn("[origin-magic-circle] gemini unavailable, local fallback used:", {
    status: error?.status,
    magicName: conceptJson.magicName,
    mainAsset: conceptJson.mainAsset,
    artScore: conceptJson.artScore,
  });
}

const magicEffectJson = buildOriginMagicCircleEffectFromConcept(conceptJson);


    

const appended = await appendOriginMagicCircleSpellCache({
  imageHash,
  rawJson: JSON.stringify(magicEffectJson),
  strokeJson,
  shape64,
});





console.log("[origin-magic-circle] spell cache appended:", {
  rowIndex: appended?.rowIndex,
  imageHashLength: String(imageHash || "").length,
  rawJsonLength: JSON.stringify(magicEffectJson).length,
  strokeLength: String(strokeJson || "").length,
});



console.log("[origin-magic-circle] response magicEffectJson:", {
  magicName: magicEffectJson.magicName,
  timedVisualEffectsLength: magicEffectJson.timedVisualEffects?.length,
  damageTimingsLength: magicEffectJson.damageTimings?.length,
});

    return res.json({
  magicEffectJson,
  originalConceptJson,
  conceptJson,

  imageHash,
  spellHash: imageHash,

  strokeJson,
  shape64,
  fromCache: false,
  fromFallback: usedLocalFallback,
});
    } catch (error) {
      console.error("[origin-magic-circle] chant title error:", error);
      return res.status(500).json({
  error: "chant_failed",
  detail: String(error?.message || "").slice(0, 200),
});
    }
  });




async function registerOriginMagicCircleCast({
  roomId,
  casterId,
  casterName,
  magicEffectJson,
  originalTimelineJson,
  strokeJson = "",
  spellHash = "",
}) {
  const safeRoomId = String(roomId || "").trim();
  const safeCasterId = String(casterId || "").trim();
  const safeCasterName = String(casterName || "").trim();
  const safeMagicEffectJson = normalizeOriginMagicCircleEffectJson(magicEffectJson || null);
  const safeStrokeJson = normalizeOriginMagicCircleStrokeJson(strokeJson);
  const safeSpellHash = String(spellHash || "").trim();

  if (!safeRoomId || !safeCasterId || !safeMagicEffectJson) {
    throw new Error("invalid_cast");
  }

  const room = await getOriginMagicCircleRoomById(safeRoomId);
  if (!room) throw new Error("room_not_found");

  const joined = (room.members || []).some((member) => member.id === safeCasterId);
  if (!joined) throw new Error("forbidden");

  const entry = {
    id: `${Date.now()}_${Math.random()}`,
    at: Date.now(),
    roomId: safeRoomId,
    casterId: safeCasterId,
    casterName: safeCasterName,
    magicEffectJson: safeMagicEffectJson,
    strokeJson: safeStrokeJson,
    spellHash: safeSpellHash,
  };

  if (safeSpellHash) {
    try {
      await appendOriginMagicCircleRoomCastLog({
        roomId: safeRoomId,
        castId: entry.id,
        at: entry.at,
        casterId: safeCasterId,
        casterName: safeCasterName,
        spellHash: safeSpellHash,
        strokeJson: safeStrokeJson,
      });
    } catch (error) {
      console.warn("[origin-magic-circle] append room cast log failed:", error);
    }
  }

  const list = roomCastEvents.get(safeRoomId) || [];
  list.push(entry);
  roomCastEvents.set(safeRoomId, list.slice(-30));

  const touchedRoom = await touchOriginMagicCircleRoomExpiresAt({
    roomId: safeRoomId,
    baseMs: entry.at,
  });

  io?.to(originSocketRoom(safeRoomId)).emit("origin:room", touchedRoom);
  io?.to(originSocketRoom(safeRoomId)).emit("origin:cast", entry);

  return {
    entry,
    room: touchedRoom,
  };
}





app.post("/api/origin-magic-circle/casts", async (req, res) => {
  try {
    const roomId = String(req.body?.roomId || "").trim();
    const casterId = String(req.body?.casterId || req.body?.clientId || "").trim();

    await assertOriginMagicCircleTurnOwner({
      roomId,
      clientId: casterId,
    });

    const { entry } = await registerOriginMagicCircleCast({
      roomId,
      casterId,
      casterName: req.body?.casterName,
      magicEffectJson: req.body?.magicEffectJson,
      strokeJson: req.body?.strokeJson,
      spellHash: req.body?.spellHash || req.body?.imageHash,
    });

    return res.json({ ok: true, cast: entry });
  } catch (error) {
    if (error.message === "invalid_cast") {
      return res.status(400).json({ error: "invalid_cast" });
    }

    if (error.message === "room_not_found") {
      return res.status(404).json({ error: "room_not_found" });
    }

    if (error.message === "forbidden") {
      return res.status(403).json({ error: "forbidden" });
    }


    if (error.message === "not_your_turn") {
  return res.status(403).json({ error: "not_your_turn" });
}

if (error.message === "room_not_battle") {
  return res.status(409).json({ error: "room_not_battle" });
}

    console.error("[origin-magic-circle] rest cast error:", error);
    return res.status(500).json({ error: "server_error" });
  }
});
  
  
  
  
  app.get("/api/origin-magic-circle/rooms/:roomId/cast-logs", async (req, res) => {
  const roomId = String(req.params.roomId || "").trim();
  if (!roomId) return res.status(400).json({ error: "roomId is required" });

  try {
    const room = await getOriginMagicCircleRoomById(roomId);
    if (!room) return res.status(404).json({ error: "room_not_found" });

    const castLogs = Array.isArray(room.castLogs) ? room.castLogs : [];
    const spellHashes = castLogs.map((log) => log.spellHash).filter(Boolean);
    const cacheMap = await findOriginMagicCircleSpellCachesByHashes(spellHashes);

    const logs = castLogs.map((log) => {
      const cache = cacheMap.get(log.spellHash) || null;

      let magicEffectJson = null;
      if (cache?.rawJson) {
        try {
          magicEffectJson = normalizeOriginMagicCircleEffectJson(JSON.parse(cache.rawJson));
        } catch {
          magicEffectJson = null;
        }
      }

      return {
  ...log,
  magicEffectJson,
  originalTimelineJson: magicEffectJson?.timeline || null,
  strokeJson: log.strokeJson || "",
};
    });

    return res.json({
      roomId,
      logs,
    });
  } catch (error) {
    console.error("[origin-magic-circle] get cast logs error:", error);
    return res.status(500).json({ error: "server_error" });
  }
});




  app.get("/api/origin-magic-circle/casts/:roomId", (req, res) => {
    const roomId = String(req.params.roomId || "").trim();
    const since = Number(req.query?.since || 0);
    const list = roomCastEvents.get(roomId) || [];
    const casts = Number.isFinite(since) && since > 0
      ? list.filter((v) => v.at > since)
      : list;

    return res.json({ casts });
  });

  function originSocketRoom(roomId) {
    return `origin-magic-circle:${String(roomId || "").trim()}`;
  }

  function buildHpPayload(room, viewerClientId) {
    const members = room?.members || [];
    const self = members.find((member) => member.id === viewerClientId);
    const enemy = members.find((member) => member.id !== viewerClientId);

    return {
      roomId: room?.roomId || "",
      selfHp: Number.isFinite(Number(self?.hp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(self.hp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP,

enemyHp: Number.isFinite(Number(enemy?.hp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(enemy.hp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP,
        members,
    };
  }

  io.on("connection", (socket) => {
    socket.on("origin:join", async (payload = {}, ack) => {
      await cleanupOriginRoomsQuietly();
      const roomId = String(payload.roomId || "").trim();
      const userTrackingId = String(payload.userTrackingId || payload.clientId || "").trim();

      if (!roomId || !userTrackingId) {
        ack?.({ ok: false, error: "roomId and userTrackingId are required" });
        return;
      }

      try {
        const room = await getOriginMagicCircleRoomById(roomId);
        if (!room) {
          ack?.({ ok: false, error: "room_not_found" });
          return;
        }

        const joined = (room.members || []).some((member) => member.id === userTrackingId);
        if (!joined) {
          ack?.({ ok: false, error: "forbidden" });
          return;
        }

        socket.data.originRoomId = roomId;
        socket.data.originUserTrackingId = userTrackingId;
        socket.join(originSocketRoom(roomId));

        ack?.({
          ok: true,
          room,
          hp: buildHpPayload(room, userTrackingId),
        });
      } catch (error) {
        console.error("[origin-magic-circle] socket join error:", error);
        ack?.({ ok: false, error: "server_error" });
      }
    });

    socket.on("origin:requestHp", async (payload = {}, ack) => {
      const roomId = String(payload.roomId || socket.data.originRoomId || "").trim();
      const userTrackingId = String(payload.userTrackingId || socket.data.originUserTrackingId || "").trim();

      if (!roomId || !userTrackingId) {
        ack?.({ ok: false, error: "roomId and userTrackingId are required" });
        return;
      }

      try {
        const room = await getOriginMagicCircleRoomById(roomId);
        if (!room) {
          ack?.({ ok: false, error: "room_not_found" });
          return;
        }

        const joined = (room.members || []).some((member) => member.id === userTrackingId);
        if (!joined) {
          ack?.({ ok: false, error: "forbidden" });
          return;
        }

        ack?.({
          ok: true,
          room,
          hp: buildHpPayload(room, userTrackingId),
        });
      } catch (error) {
        console.error("[origin-magic-circle] socket request hp error:", error);
        ack?.({ ok: false, error: "server_error" });
      }
    });





    socket.on("origin:cast", async (payload = {}, ack) => {
  try {
    const roomId = String(payload.roomId || socket.data.originRoomId || "").trim();
    const casterId = String(payload.casterId || socket.data.originUserTrackingId || "").trim();

    await assertOriginMagicCircleTurnOwner({
      roomId,
      clientId: casterId,
    });

    const { entry } = await registerOriginMagicCircleCast({
      roomId,
      casterId,
      casterName: payload.casterName,
      magicEffectJson: payload.magicEffectJson,
      strokeJson: payload.strokeJson,
      spellHash: payload.spellHash || payload.imageHash,
    });

    ack?.({ ok: true, cast: entry });
  } catch (error) {
    if (error.message === "not_your_turn") {
      ack?.({ ok: false, error: "not_your_turn" });
      return;
    }

    if (error.message === "room_not_battle") {
      ack?.({ ok: false, error: "room_not_battle" });
      return;
    }

    if (error.message === "invalid_cast") {
      ack?.({ ok: false, error: "invalid_cast" });
      return;
    }

    if (error.message === "room_not_found") {
      ack?.({ ok: false, error: "room_not_found" });
      return;
    }

    if (error.message === "forbidden") {
      ack?.({ ok: false, error: "forbidden" });
      return;
    }

    console.error("[origin-magic-circle] socket cast error:", error);
    ack?.({ ok: false, error: "server_error" });
  }
});



    

    socket.on("origin:damage", async (payload = {}, ack) => {
      const roomId = String(payload.roomId || socket.data.originRoomId || "").trim();
      const attackerId = String(payload.attackerId || socket.data.originUserTrackingId || "").trim();
      const targetId = String(payload.targetId || "").trim();
      const damage = Math.max(0, Math.round(Number(payload.damage) || 0));

      if (!roomId || !attackerId || !targetId || damage <= 0) {
        ack?.({ ok: false, error: "invalid_damage" });
        return;
      }

      try {
        const roomBefore = await getOriginMagicCircleRoomById(roomId);
        if (!roomBefore) {
          ack?.({ ok: false, error: "room_not_found" });
          return;
        }

        const attacker = (roomBefore.members || []).find((member) => member.id === attackerId);
        const target = (roomBefore.members || []).find((member) => member.id === targetId);

        if (!attacker || !target) {
          ack?.({ ok: false, error: "forbidden" });
          return;
        }

        const attackerHp = Number.isFinite(Number(attacker.hp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(attacker.hp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP;

const targetHp = Number.isFinite(Number(target.hp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(target.hp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP;
    const nextTargetHp = Math.max(0, targetHp - damage);

        const roomAfter = await updateOriginMagicCircleRoomHp({
          roomId,
          clientId: attackerId,
          selfHp: attackerHp,
          enemyHp: nextTargetHp,
        });

        const sockets = await io.in(originSocketRoom(roomId)).fetchSockets();

        for (const targetSocket of sockets) {
          const viewerId = String(targetSocket.data.originUserTrackingId || "").trim();
          targetSocket.emit("origin:hp", buildHpPayload(roomAfter, viewerId));
        }

        ack?.({ ok: true, room: roomAfter });
      } catch (error) {
        if (error.message === "room_not_found") {
          ack?.({ ok: false, error: "room_not_found" });
          return;
        }

        if (error.message === "forbidden") {
          ack?.({ ok: false, error: "forbidden" });
          return;
        }

        console.error("[origin-magic-circle] socket damage error:", error);
        ack?.({ ok: false, error: "server_error" });
      }
    });
  });
}
