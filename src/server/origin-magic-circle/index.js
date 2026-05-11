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




const ORIGIN_MAGIC_CIRCLE_MAX_HP = 100;

const ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP = {
  "炎球": "fireball.glb",
  "人魂と骸骨": "magic_voxel_skull_flat_shaded.glb",
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




const ORIGIN_MAGIC_CIRCLE_TIMELINE_ACTIONS = new Set(["spawn", "move", "despawn"]);

const ORIGIN_MAGIC_CIRCLE_SPAWN_POSITIONS = [
  "in_front_of_self",
  "behind_self",
  "above_self",
  "battlefield_center",
  "above_battlefield_center",
  "enemy_position",
  "above_enemy",
];

const ORIGIN_MAGIC_CIRCLE_TARGET_POSITIONS = [
  "self_position",
  "battlefield_center",
  "above_battlefield_center",
  "enemy_position",
  "above_enemy",
];

const ORIGIN_MAGIC_CIRCLE_OBJECT_SIZES = ["small", "medium", "large"];

const ORIGIN_MAGIC_CIRCLE_SPREAD_PATTERNS = [
  "none",
  "horizontal_line",
  "vertical_line",
  "circle",
  "random_scatter",
];

const ORIGIN_MAGIC_CIRCLE_MOVE_PATH_TYPES = [
  "straight_line",
  "arc",
  "fall_from_above",
  "rise_from_below",
  "orbit",
];

const ORIGIN_MAGIC_CIRCLE_COLORS = [
  "#FF3B30",
  "#FF9500",
  "#FFD60A",
  "#30D158",
  "#00C7BE",
  "#0A84FF",
  "#5E5CE6",
  "#BF5AF2",
  "#FF2D55",
  "#FFFFFF",
];

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function normalizeAssetFileName(assetFileName) {
  const name = String(assetFileName || "").trim();
  if (ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP[name]) {
    return ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP[name];
  }
  return name;
}

function calculateOriginMagicCircleTotalDamage(artScore) {
  const score = clampNumber(artScore, 0, 100, 0);

  // 低得点でも派手に戦えるよう最低80、最高300
  return Math.round(40 + score * 2.2);
}



function completeOriginMagicCircleTimelineJson(rawJson) {
  const safe = rawJson && typeof rawJson === "object" ? rawJson : {};

  const magicName = String(safe.magicName || "名もなき原初魔法").trim().slice(0, 50);
  const artScore = Math.round(clampNumber(safe.artScore, 0, 100, 0));

  const rawTimeline = Array.isArray(safe.timeline) ? safe.timeline : [];
  const timeline = [];
  const spawnedIds = new Map();

  for (const rawEvent of rawTimeline) {
    const time = clampNumber(rawEvent?.time, 0, 10, 0);
    const rawActions = Array.isArray(rawEvent?.actions) ? rawEvent.actions : [];
    const actions = [];

    for (const rawAction of rawActions) {
      const action = String(rawAction?.action || "").trim();

      if (!ORIGIN_MAGIC_CIRCLE_TIMELINE_ACTIONS.has(action)) continue;

      const id = String(rawAction?.id || "").trim().replace(/[^\w-]/g, "").slice(0, 32);
      if (!id) continue;

      if (action === "spawn") {
        const assetFileName = normalizeAssetFileName(rawAction.assetFileName);
        if (!assetFileName) continue;

        const objectCount = Math.round(clampNumber(rawAction.objectCount, 1, 5, 1));

        const spawnPosition = ORIGIN_MAGIC_CIRCLE_SPAWN_POSITIONS.includes(rawAction.spawnPosition)
          ? rawAction.spawnPosition
          : pickRandom(ORIGIN_MAGIC_CIRCLE_SPAWN_POSITIONS);

        const objectSize = ORIGIN_MAGIC_CIRCLE_OBJECT_SIZES.includes(rawAction.objectSize)
          ? rawAction.objectSize
          : pickRandom(ORIGIN_MAGIC_CIRCLE_OBJECT_SIZES);

        const completed = {
          action: "spawn",
          id,
          assetFileName,
          objectCount,
          spawnPosition,
          spawnSpreadPattern: objectCount >= 3 ? pickRandom(ORIGIN_MAGIC_CIRCLE_SPREAD_PATTERNS) : "none",
          colorHexCode: pickRandom(ORIGIN_MAGIC_CIRCLE_COLORS),
          objectSize,
          enterEffect: pickRandom(["fall_from_sky", "scale_up", "rise_from_ground"]),
          rotation: {
            shouldRotate: true,
            rotationSpeed: pickRandom(["slow", "normal", "fast"]),
          },
        };

        spawnedIds.set(id, {
          assetFileName,
          spawnTime: time,
          lastPosition: spawnPosition,
          objectSize,
        });

        actions.push(completed);
      }

      if (action === "move") {
        if (!spawnedIds.has(id)) continue;

        const targetPosition = ORIGIN_MAGIC_CIRCLE_TARGET_POSITIONS.includes(rawAction.targetPosition)
          ? rawAction.targetPosition
          : pickRandom(ORIGIN_MAGIC_CIRCLE_TARGET_POSITIONS);

        const completed = {
          action: "move",
          id,
          targetPosition,
          movePathType: pickRandom(ORIGIN_MAGIC_CIRCLE_MOVE_PATH_TYPES),
        };

        spawnedIds.get(id).lastPosition = targetPosition;
        actions.push(completed);
      }

      if (action === "despawn") {
        if (!spawnedIds.has(id)) continue;

        actions.push({
          action: "despawn",
          id,
          exitEffect: pickRandom(["rise_to_sky", "scale_down", "sink_into_ground"]),
        });

        spawnedIds.delete(id);
      }
    }

    if (actions.length > 0) {
      timeline.push({ time, actions });
    }
  }

  timeline.sort((a, b) => a.time - b.time);

  // 消し忘れ救済
  if (spawnedIds.size > 0) {
    timeline.push({
      time: 10,
      actions: [...spawnedIds.keys()].map((id) => ({
        action: "despawn",
        id,
        exitEffect: pickRandom(["rise_to_sky", "scale_down", "sink_into_ground"]),
      })),
    });
  }

  const uniqueAssets = new Set();
  for (const event of timeline) {
    for (const action of event.actions) {
      if (action.action === "spawn") uniqueAssets.add(action.assetFileName);
    }
  }

  return {
    magicName,
    artScore,
    totalDamage: calculateOriginMagicCircleTotalDamage(artScore),
    timeline,
    damageTimings: createOriginMagicCircleDamageTimings({
      timeline,
      artScore,
    }),
    debug: {
      uniqueAssetCount: uniqueAssets.size,
    },
  };
}




function createOriginMagicCircleDamageTimings({ timeline, artScore }) {
  const totalDamage = calculateOriginMagicCircleTotalDamage(artScore);
  const candidates = [];

  for (const event of timeline) {
    for (const action of event.actions || []) {
      if (action.action === "move") {
        if (action.targetPosition === "enemy_position" || action.targetPosition === "above_enemy") {
          candidates.push({
            timeSeconds: clampNumber(event.time + 0.4, 0.5, 10, event.time),
            type: "impact",
            weight: 35,
          });
        }
      }

      if (action.action === "spawn") {
        if (action.spawnPosition === "enemy_position" || action.spawnPosition === "above_enemy") {
          candidates.push({
            timeSeconds: clampNumber(event.time + 0.6, 0.5, 10, event.time),
            type: "impact",
            weight: 25,
          });
        }

        if (action.objectCount >= 3) {
          candidates.push({
            timeSeconds: clampNumber(event.time + 2.0, 0.5, 10, event.time),
            type: "slip",
            weight: 15,
          });
        }
      }
    }
  }

  candidates.push({
    timeSeconds: 9,
    type: "finish",
    weight: 40,
  });

  const limited = candidates
    .sort((a, b) => a.timeSeconds - b.timeSeconds)
    .slice(0, 5);

  const weightSum = limited.reduce((sum, item) => sum + item.weight, 0) || 1;

  let usedDamage = 0;

  return limited.map((item, index) => {
    const isLast = index === limited.length - 1;
    const damage = isLast
      ? totalDamage - usedDamage
      : Math.max(1, Math.round(totalDamage * (item.weight / weightSum)));

    usedDamage += damage;

    return {
      timeSeconds: item.timeSeconds,
      damage,
      type: item.type,
      target: "enemy",
    };
  });
}





function normalizeOriginMagicCircleEffectJson(effectJson) {
  return completeOriginMagicCircleTimelineJson(effectJson);
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

      const started = await updateOriginMagicCircleRoomStatus({
        roomId,
        status: "loading",
        requestedByClientId: userTrackingId,
      });

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

      const started = await updateOriginMagicCircleRoomStatus({
        roomId,
        status: "対戦中",
      });
      
      return res.json(started);
    } catch (error) {
      if (error.message === "room_not_found") return res.status(404).json({ error: "room_not_found" });
      if (error.message === "forbidden") return res.status(403).json({ error: "forbidden" });
      console.error("[origin-magic-circle] ready room error:", error);
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
    cachedMagicEffectJson = normalizeOriginMagicCircleEffectJson(
      JSON.parse(cached.rawJson)
    );
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



      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
      const response = await model.generateContent([
        {
          inlineData: {
            mimeType: "image/png",
            data: base64ImageFile,
          },
        },
        {
          text: `画像の魔法陣を見て、魔法名・芸術点・3D演出タイムラインをJSONのみで出力してください。
JSON以外は禁止。候補が配列で示されている項目は、必ず1つの値だけを選んでください。

{
  "magicName": "画像から連想した厨二病風の魔法名",
  "artScore": 0~100,
  "timeline": [
    {
      "time": 0,
      "actions": [
        {
          "action": "spawn",
          "id": "後からmove/despawnで指定する識別名",
          "assetFileName": [${Object.keys(ORIGIN_MAGIC_CIRCLE_ASSET_NAME_MAP).map((name) => `"${name}"`).join(",")}],
          "objectCount": 1,
          "spawnPosition": ["in_front_of_self","behind_self","above_self","battlefield_center","above_battlefield_center","enemy_position","above_enemy"],
          "objectSize": ["small","medium","large"]
        },
        {
          "action": "move",
          "id": "すでにspawnした識別名",
          "targetPosition": ["self_position","battlefield_center","above_battlefield_center","enemy_position","above_enemy"]
        },
        {
          "action": "despawn",
          "id": "すでにspawnした識別名"
        }
      ]
    }
  ]
}

ルール:
- timelineは4〜10個
- timeは0〜10秒
- timeは昇順にする
- actionsは各timeにつき1〜4個
- assetは最低4種類使う
- spawnはaction,id,assetFileName,objectCount,spawnPosition,objectSizeのみを書く
- moveはaction,id,targetPositionのみを書く
- despawnはaction,idのみを書く
- move/despawnのidは、それ以前にspawnされたidだけ使う
- spawnしたidは最後までに必ずdespawnする
- JSON以外は出力しない`
        },
      ]);

      const rawText = String(response.response.text() || "").trim();
      const jsonText = extractJsonText(rawText);
      const magicEffectJson = normalizeOriginMagicCircleEffectJson(JSON.parse(jsonText));
      const appended = await appendOriginMagicCircleSpellCache({
        imageHash,
        rawJson: JSON.stringify(magicEffectJson),
        shape64,
      });

console.log("[origin-magic-circle] spell cache appended:", {
  rowIndex: appended?.rowIndex,
  imageHashLength: String(imageHash || "").length,
  rawJsonLength: JSON.stringify(magicEffectJson).length,
  strokeLength: String(strokeJson || "").length,
});

    return res.json({
  magicEffectJson,

  // 新規生成時は、今回のhashがそのままキャッシュ本体のhash
  imageHash,
  spellHash: imageHash,

  strokeJson,
  shape64,
  fromCache: false,
});
    } catch (error) {
      console.error("[origin-magic-circle] chant title error:", error);
      return res.status(500).json({ error: "gemini_failed" });
    }
  });




async function registerOriginMagicCircleCast({
  roomId,
  casterId,
  casterName,
  magicEffectJson,
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
    const { entry } = await registerOriginMagicCircleCast({
      roomId: req.body?.roomId,
      casterId: req.body?.casterId,
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
    const { entry } = await registerOriginMagicCircleCast({
      roomId: payload.roomId || socket.data.originRoomId,
      casterId: payload.casterId || socket.data.originUserTrackingId,
      casterName: payload.casterName,
      magicEffectJson: payload.magicEffectJson,
      strokeJson: payload.strokeJson,
      spellHash: payload.spellHash || payload.imageHash,
    });

    ack?.({ ok: true, cast: entry });
  } catch (error) {
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