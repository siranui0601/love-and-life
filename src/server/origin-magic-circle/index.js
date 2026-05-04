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
  findOriginMagicCircleSpellCache,
  appendOriginMagicCircleSpellCache,
  updateOriginMagicCircleRoomHp,
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
};

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
      
export function mountOriginMagicCircleRoutes(app, io) {
  const roomCastEvents = new Map();
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
    if (!base64ImageFile) return res.status(400).json({ error: "base64ImageFile is required" });
    if (!genAI) return res.status(500).json({ error: "gemini_key_missing" });

    try {
      const cached = await findOriginMagicCircleSpellCache(base64ImageFile);
      if (cached?.rawJson) {
        return res.json({ magicEffectJson: normalizeOriginMagicCircleEffectJson(JSON.parse(cached.rawJson)), fromCache: true });
      }
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
          "assetFileName": ["炎球","人魂と骸骨","竜巻","不死鳥","月","歯車時計","プラズマ","六足ロボ","魂剣","花束","ギミック剣","サイバー卵","サイバー球と円盤","蠢く立方体","サイバー多面球","エナジー凝縮球","二重螺旋球","銀河","蠢く多面球","多線球","雷","大爆発","雲","光球","バレッド","シンプルリング"],
          "objectCount": 1,
          "spawnPosition": ["in_front_of_self","behind_self","above_self","battlefield_center","above_battlefield_center","enemy_position","above_enemy"],
          "spawnSpreadPattern": ["none","horizontal_line","vertical_line","circle","random_scatter"],
          "colorHexCode": "#RRGGBB",
          "objectSize": ["small","medium","large"],
          "lifeTimeSeconds": 8,
          "enterEffect": ["fall_from_sky","scale_up","rise_from_ground"],
          "exitEffect": ["rise_to_sky","scale_down","sink_into_ground"],
          "movement": {
            "targetPosition": ["self_position","battlefield_center","above_battlefield_center","enemy_position","above_enemy"],
            "moveDurationSeconds": 1,
            "movePathType": ["none","straight_line","arc","orbit"]
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
- assetは3種以上使うこと
- artScoreは0〜100の整数
- timedVisualEffectsは1〜4個
- visualObjectsは各timedVisualEffectsにつき1〜3個
- objectCountは1〜5
- startTimeSecondsは0〜6
- lifeTimeSecondsは8〜10
- moveDurationSecondsは0〜10
- moveDurationSeconds<lifeTimeSeconds
- enterEffectは必ず候補から1つ選ぶ
- exitEffectは必ず候補から1つ選ぶ
- enterEffectは出現演出のみを表す
- exitEffectは消失演出のみを表す
- movementは出現後の移動のみを表す
- movePathTypeがnoneの場合、moveDurationSecondsは0にする
- damageTimingsは1〜5個
- damageWeightの合計は100にする
- timeSecondsは0.5〜10
- 最後のdamageTimingsのtimeSecondsは8〜10秒にする
- targetは必ず"enemy"にする
- JSON以外は出力しない`,
        },
      ]);

      const rawText = String(response.response.text() || "").trim();
      const jsonText = extractJsonText(rawText);
      const magicEffectJson = normalizeOriginMagicCircleEffectJson(JSON.parse(jsonText));
      await appendOriginMagicCircleSpellCache({ base64ImageFile, rawJson: JSON.stringify(magicEffectJson) });
      return res.json({ magicEffectJson });    } catch (error) {
      console.error("[origin-magic-circle] chant title error:", error);
      return res.status(500).json({ error: "gemini_failed" });
    }
  });

    app.post("/api/origin-magic-circle/casts", (req, res) => {
    const roomId = String(req.body?.roomId || "").trim();
    const casterId = String(req.body?.casterId || "").trim();
    const casterName = String(req.body?.casterName || "").trim();
    const magicEffectJson = normalizeOriginMagicCircleEffectJson(req.body?.magicEffectJson || null);

    if (!roomId || !casterId || !magicEffectJson) {
      return res.status(400).json({ error: "invalid_cast" });
    }

    const entry = {
      id: `${Date.now()}_${Math.random()}`,
      at: Date.now(),
      roomId,
      casterId,
      casterName,
      magicEffectJson,
    };

    const list = roomCastEvents.get(roomId) || [];
    list.push(entry);
    roomCastEvents.set(roomId, list.slice(-30));

    // Socket.IO移行後でも、REST経由で送られた魔法を相手へ通知できるようにしておく
    io?.to(originSocketRoom(roomId)).emit("origin:cast", entry);

    return res.json({ ok: true, cast: entry });
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
      selfHp: Number.isFinite(Number(self?.hp)) ? Number(self.hp) : 1000,
      enemyHp: Number.isFinite(Number(enemy?.hp)) ? Number(enemy.hp) : 1000,
      members,
    };
  }

  io.on("connection", (socket) => {
    socket.on("origin:join", async (payload = {}, ack) => {
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
      const roomId = String(payload.roomId || socket.data.originRoomId || "").trim();
      const casterId = String(payload.casterId || socket.data.originUserTrackingId || "").trim();
      const casterName = String(payload.casterName || "").trim();
      const magicEffectJson = normalizeOriginMagicCircleEffectJson(payload.magicEffectJson || null);

      if (!roomId || !casterId || !magicEffectJson) {
        ack?.({ ok: false, error: "invalid_cast" });
        return;
      }

      try {
        const room = await getOriginMagicCircleRoomById(roomId);
        if (!room) {
          ack?.({ ok: false, error: "room_not_found" });
          return;
        }

        const joined = (room.members || []).some((member) => member.id === casterId);
        if (!joined) {
          ack?.({ ok: false, error: "forbidden" });
          return;
        }

        const entry = {
          id: `${Date.now()}_${Math.random()}`,
          at: Date.now(),
          roomId,
          casterId,
          casterName,
          magicEffectJson,
        };

        const list = roomCastEvents.get(roomId) || [];
        list.push(entry);
        roomCastEvents.set(roomId, list.slice(-30));

        io.to(originSocketRoom(roomId)).emit("origin:cast", entry);

        ack?.({ ok: true, cast: entry });
      } catch (error) {
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

        const attackerHp = Number.isFinite(Number(attacker.hp)) ? Number(attacker.hp) : 1000;
        const targetHp = Number.isFinite(Number(target.hp)) ? Number(target.hp) : 1000;
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
