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




const ORIGIN_MAGIC_CIRCLE_MAX_HP = 1000;

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

function normalizeOriginMagicCircleTimelineJson(rawJson){
  const parsed=typeof rawJson==='string'?JSON.parse(rawJson):rawJson||{};
  const timeline=Array.isArray(parsed.timeline)?parsed.timeline:[];
  const magicName=String(parsed.magicName||'深淵輪廻・無銘終焉').trim()||'深淵輪廻・無銘終焉';
  const artScore=Math.round(clamp(parsed.artScore,0,100,0));
  const spawned=new Set();const despawned=new Set();
  const normalized=[];
  timeline.forEach((node)=>{const time=clamp(node?.time,0,10,0);const actions=[];for(const a of (Array.isArray(node?.actions)?node.actions:[]).slice(0,4)){
    const action=String(a?.action||'').trim();const id=String(a?.id||'').trim();if(!id) continue;
    if(action==='spawn'){
      spawned.add(id);
      actions.push({action,id,assetFileName:toAssetFileName(a.assetFileName),objectCount:Math.round(clamp(a.objectCount,1,5,1)),position:ORIGIN_MAGIC_CIRCLE_POSITION_CANDIDATES.includes(a.position)?a.position:'battlefield_center',objectSize:ORIGIN_MAGIC_CIRCLE_SIZE_CANDIDATES.includes(a.objectSize)?a.objectSize:'medium'});
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
function createOriginMagicCircleDamageTimings(expandedEffectJson, artScore){const totalDamage=Math.round(clamp(80+artScore*2.2,80,300,80));const candidates=[];for(const t of expandedEffectJson.timeline||[]){for(const a of t.actions||[]){if(a.action==='move' && ['enemy_position','above_enemy'].includes(a.targetPosition)) candidates.push(clamp(t.time,0.5,9.5,2));if(a.action==='spawn'&&['enemy_position','above_enemy'].includes(a.position)&&a.objectSize==='large') candidates.push(clamp(t.time+0.8,0.5,9.5,2.5));}}candidates.push(clamp(8+Math.random()*2,8,10,9));const uniq=[...new Set(candidates.map(v=>Number(v.toFixed(2))))].sort((a,b)=>a-b).slice(0,5);if(!uniq.length) uniq.push(2.5,9);const w=uniq.map(()=>1);w[w.length-1]=2;const sum=w.reduce((a,b)=>a+b,0);let assigned=w.map(x=>Math.round((x/sum)*100));let diff=100-assigned.reduce((a,b)=>a+b,0);assigned[assigned.length-1]+=diff;return {totalDamage,damageTimings:uniq.map((t,i)=>({timeSeconds:t,damageWeight:assigned[i],target:'enemy'}))};}
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
    const parsedCache = JSON.parse(cached.rawJson);
    const hasTimed = Array.isArray(parsedCache?.timedVisualEffects);
    if (hasTimed) {
      cachedMagicEffectJson = normalizeOriginMagicCircleEffectJson(parsedCache);
    } else {
      const timelineJson = normalizeOriginMagicCircleTimelineJson(parsedCache);
      const expandedEffectJson = expandOriginMagicCircleTimelineToEffectJson(timelineJson);
      const damageInfo = createOriginMagicCircleDamageTimings(expandedEffectJson, timelineJson.artScore);
      cachedMagicEffectJson = normalizeOriginMagicCircleEffectJson({ ...expandedEffectJson, ...damageInfo });
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



      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
      const response = await model.generateContent([
        {
          inlineData: {
            mimeType: "image/png",
            data: base64ImageFile,
          },
        },
        {
          text: `画像の魔法陣を見て、jsonを出力

{
  "magicName": "画像から連想した厨二病風の魔法名",
  "artScore": 0,
  "timeline": [
    {"time":0,"actions":[{"action":"spawn","id":"fire1","assetFileName":"炎球","objectCount":3,"position":"above_self","objectSize":"medium"},{"action":"spawn","id":"skull1","assetFileName":"人魂と骸骨","objectCount":1,"position":"battlefield_center","objectSize":"large"}]},
    {"time":1.5,"actions":[{"action":"move","id":"fire1","targetPosition":"enemy_position"},{"action":"spawn","id":"tornado1","assetFileName":"竜巻","objectCount":1,"position":"enemy_position","objectSize":"large"}]},
    {"time":4,"actions":[{"action":"despawn","id":"skull1"}]}
  ]
}

ルール:
- magicNameは厨二病風
- artScoreは0〜100
- timelineは4〜8個、timeは0〜10秒で昇順
- actionsは各timeにつき1〜4個
- 同時に複数素材spawn可。タイミングをずらして別素材spawn可
- spawnした素材は後でmove/despawn可
- assetFileNameは魔法全体で最低4種類
- spawn: action,id,assetFileName,objectCount,position,objectSize
- move: action,id,targetPosition
- despawn: action,id
- move/despawnのidは過去spawn済みのみ
- spawnしたidは最後までに必ずdespawn
- objectCountは1〜5
- position/targetPosition候補: in_front_of_self,behind_self,above_self,battlefield_center,above_battlefield_center,enemy_position,above_enemy,self_position
- objectSize候補: small,medium,large
- actionごとに不要項目を書かない
- JSON以外は出力しない`,
        },
      ]);

      const rawText = String(response.response.text() || "").trim();
      const jsonText = extractJsonText(rawText);
      const originalTimelineJson = JSON.parse(jsonText);
      const timelineJson = normalizeOriginMagicCircleTimelineJson(originalTimelineJson);
      const expandedEffectJson = expandOriginMagicCircleTimelineToEffectJson(timelineJson);
      const damageInfo = createOriginMagicCircleDamageTimings(expandedEffectJson, timelineJson.artScore);
      const magicEffectJson = normalizeOriginMagicCircleEffectJson({ ...expandedEffectJson, ...damageInfo });
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
  originalTimelineJson,

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
  originalTimelineJson,
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