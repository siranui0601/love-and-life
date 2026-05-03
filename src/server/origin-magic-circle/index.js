import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY } from "../../foundation/env.js";
import {
  createOriginMagicCircleRoom,
  deleteOriginMagicCircleRoom,
  getOriginMagicCircleRoomById,
  joinOriginMagicCircleRoom,
  removeOriginMagicCircleMember,
  updateOriginMagicCircleRoomStatus,
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
      
export function mountOriginMagicCircleRoutes(app) {
  const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
  const routePath = "/オリジン魔法陣";
  const encodedPath = encodeURI(routePath);
  const htmlPath = path.join(process.cwd(), "public/origin-magic-circle/index.html");

  app.get(routePath, (_req, res) => {
    res.sendFile(htmlPath);
  });

  app.get(encodedPath, (_req, res) => {
    res.sendFile(htmlPath);
  });

  app.post("/api/origin-magic-circle/rooms/create", async (req, res) => {
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
        status: "対戦中",
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

  app.post("/api/origin-magic-circle/chant-title", async (req, res) => {
    const base64ImageFile = String(req.body?.base64ImageFile || "").trim();
    if (!base64ImageFile) return res.status(400).json({ error: "base64ImageFile is required" });
    if (!genAI) return res.status(500).json({ error: "gemini_key_missing" });

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const response = await model.generateContent([
        {
          inlineData: {
            mimeType: "image/png",
            data: base64ImageFile,
          },
        },
        {
          text: `画像の魔法陣を見て、魔法名・芸術点・3D演出・ダメージ発生タイミングをJSONのみで出力してください。
JSON以外は禁止。候補が配列で示されている項目は、必ず1つの値だけを選んでください。

{
  "magicName": "画像から連想した厨二病風の魔法名",
  "artScore": 0,
  "timedVisualEffects": [
    {
      "startTimeSeconds": 0,
      "visualObjects": [
        {
          "assetFileName": [
  "fireball.glb",
  "magic_voxel_skull_flat_shaded.glb",
  "stylized_fire_tornado.glb",

  "phoenix_bird.glb",
  "truth_about_the_dark_side_of_the_moon.glb",
  "broken_steampunk_clock.glb",
  "evanescent_plasma.glb",
  "gun-bot_with_walk_and_idle_animation.glb",
  "soulsucker_-_weaponcraft.glb",
  "bouquet.glb",
  "lance_of_the_primordials_-_dae_weaponcraft.glb",

  "pearl_electron.glb",
  "stranger_star.glb",
  "cube_cascade.glb",
  "cyber_orb.glb",
  "magic_marble.glb",
  "cyber_spore.glb",
  "dark_matter.glb",
  "harlequin_orb.glb",
  "evanescent_smoke.glb",

  "lightning",
  "explosion_burst",
  "mist_cloud",
  "light_orb",
  "crystal_shard",
  "simple_ring"
],
          "objectCount": 1,
          "spawnPosition": ["in_front_of_self","behind_self","above_self","battlefield_center","above_battlefield_center","enemy_position","above_enemy"],
          "spawnSpreadPattern": ["none","horizontal_line","vertical_line","circle","random_scatter"],
          "colorHexCode": "#RRGGBB",
          "objectSize": ["small","medium","large"],
          "lifeTimeSeconds": 3,
          "movement": {
            "targetPosition": ["self_position","battlefield_center","above_battlefield_center","enemy_position","above_enemy"],
            "moveDurationSeconds": 1,
            "movePathType": ["none","straight_line","arc","fall_from_above","rise_from_below","orbit"]
          },
          "rotation": {
            "shouldRotate": true,
            "rotationSpeed": ["slow","normal","fast"]
          }
        }
      ]
    }
  ],
  "damageTimings": [
    {
      "timeSeconds": 1,
      "damageWeight": 100,
      "target": ["enemy"]
    }
  ]
}

ルール:
- artScoreは0〜100の整数
- timedVisualEffectsは1〜4個
- visualObjectsは各timedVisualEffectsにつき1〜3個
- objectCountは1〜5
- startTimeSecondsは0〜6
- lifeTimeSecondsは0.5〜10
- moveDurationSecondsは0〜10

- damageTimingsは1〜5個
- damageWeightの合計は100にする
- timeSecondsは0〜10

- JSON以外は出力しない`,
        },
      ]);

      const rawText = String(response.response.text() || "").trim();
      const jsonText = extractJsonText(rawText);
      const magicEffectJson = JSON.parse(jsonText);
      return res.json({ magicEffectJson });    } catch (error) {
      console.error("[origin-magic-circle] chant title error:", error);
      return res.status(500).json({ error: "gemini_failed" });
    }
  });
}
