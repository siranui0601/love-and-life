

const refs = {
  message: document.getElementById("message"),
  homePanel: document.getElementById("homePanel"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  backToTitleBtn: document.getElementById("backToTitleBtn"),
  waitingRoom: document.getElementById("waitingRoom"),
  waitingNote: document.getElementById("waitingNote"),
  roomIdText: document.getElementById("roomIdText"),
  memberList: document.getElementById("memberList"),
  startGameBtn: document.getElementById("startGameBtn"),
  deleteRoomBtn: document.getElementById("deleteRoomBtn"),
  leaveRoomBtn: document.getElementById("leaveRoomBtn"),
  page: document.querySelector(".page"),
  battleView: document.getElementById("battleView"),
};

const summonAssetOptions = [
  "fireball.glb",
  "magic_voxel_skull_flat_shaded.glb",
  "stylized_fire_tornado.glb",

  "lightning",
  "explosion_burst",
  "mist_cloud",
  "energy_slash",
  "shadow_orb",
  "light_orb",
  "crystal_shard",
  "fang_spikes",
  "simple_ring",
];


const customEffectNames = new Set([
  "lightning",
  "explosion_burst",
  "mist_cloud",
  "energy_slash",
  "shadow_orb",
  "light_orb",
  "crystal_shard",
  "fang_spikes",
  "simple_ring",
]);

//変更10
const summonAssetDefaults = {
  "fireball.glb": {
    scale: 2,
    y: 1.6,
    offsetX: 0,
    offsetZ: 0,
  },
  "magic_voxel_skull_flat_shaded.glb": {
    scale: 2,
    y: 3.5,
    offsetX: 0,
    offsetZ: 7,
  },
  "stylized_fire_tornado.glb": {
    scale: 0.01,
    y: 1.6,
    offsetX: 0,
    offsetZ: 0,
  },
  "lightning": {
  scale: 2,
  y: 2,
  offsetX: 0,
  offsetZ: 0,
},
"explosion_burst": { scale: 2, y: 1.8, offsetX: 0, offsetZ: 0 },
"mist_cloud": { scale: 2, y: 1.5, offsetX: 0, offsetZ: 0 },
"energy_slash": { scale: 2.5, y: 2.2, offsetX: 0, offsetZ: 0 },
"shadow_orb": { scale: 1.8, y: 2.2, offsetX: 0, offsetZ: 0 },
"light_orb": { scale: 1.5, y: 2.2, offsetX: 0, offsetZ: 0 },
"crystal_shard": { scale: 1.6, y: 2.2, offsetX: 0, offsetZ: 0 },
"fang_spikes": { scale: 2, y: 0.2, offsetX: 0, offsetZ: 0 },
"simple_ring": { scale: 2, y: 2.5, offsetX: 0, offsetZ: 0 },
};

//変更14
function showDebug(text) {
  let panel = document.getElementById("debugPanel");

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "debugPanel";
    panel.style.position = "fixed";
    panel.style.left = "8px";
    panel.style.bottom = "80px";
    panel.style.zIndex = "20000";
    panel.style.maxWidth = "95vw";
    panel.style.maxHeight = "18vh";
    panel.style.overflow = "auto";
    panel.style.background = "rgba(0,0,0,0.8)";
    panel.style.color = "#0f0";
    panel.style.fontSize = "12px";
    panel.style.padding = "8px";
    panel.style.display = "flex";
    panel.style.gap = "8px";
    panel.style.alignItems = "flex-start";

    const pre = document.createElement("pre");
    pre.id = "debugPanelText";
    pre.style.margin = "0";
    pre.style.whiteSpace = "pre-wrap";

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "コピー";
    copyBtn.style.fontSize = "12px";
    copyBtn.style.padding = "4px 8px";
    copyBtn.onclick = async () => {
      await navigator.clipboard.writeText(pre.textContent || "");
      copyBtn.textContent = "コピー済";
      setTimeout(() => {
        copyBtn.textContent = "コピー";
      }, 1000);
    };

    panel.append(pre, copyBtn);
    document.body.appendChild(panel);
  }

  const pre = document.getElementById("debugPanelText");
  if (pre) pre.textContent = text;
}

const user = JSON.parse(localStorage.getItem("currentUser") || "null");
const username = String(user?.username || "ゲスト");
const userTrackingId = String(user?.userTrackingId || "");

let currentRoom = null;
let refreshTimer = null;
let battleStarted = false;
const ACTIVE_ROOM_STORAGE_KEY = "originMagicCircleActiveRoomId";

function setMessage(text) {
  refs.message.textContent = text || "";
}

function showHomePanel() {
  refs.homePanel?.classList.remove("hidden");
}

function hideHomePanel() {
  refs.homePanel?.classList.add("hidden");
}

function saveActiveRoomId(roomId) {
  if (!roomId) return;
  localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, roomId);
}

function clearActiveRoomId() {
  localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
}

function showWaitingRoom(room) {
  currentRoom = room;
  hideHomePanel();
  refs.waitingRoom.classList.remove("hidden");
  refs.waitingNote.classList.add("hidden");
  refs.roomIdText.textContent = room.roomId;
  refs.memberList.innerHTML = "";

  const isHost = room.members.some((member) => member.id === userTrackingId && member.role === "host");
  room.members.forEach((member) => {
    const li = document.createElement("li");
    li.textContent = `${member.name}${member.role === "host" ? "（ホスト）" : ""}`;
    refs.memberList.appendChild(li);
  });

  refs.startGameBtn.disabled = !isHost || room.members.length !== 2;
  refs.deleteRoomBtn.classList.toggle("hidden", !isHost);
  refs.leaveRoomBtn.classList.toggle("hidden", isHost);
}

async function callApi(path, body = undefined, method = "GET") {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data;
}

async function refreshRoom() {
  if (!currentRoom?.roomId || battleStarted) return;
  try {
    const room = await callApi(`/api/origin-magic-circle/rooms/${encodeURIComponent(currentRoom.roomId)}`);
    showWaitingRoom(room);
    if (room.status === "対戦中") {
      await startThreeBattleScene();
    }
  } catch {
    stopRefresh();
    clearActiveRoomId();
    currentRoom = null;
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    setMessage("ルームが見つかりませんでした。再作成してください。");
  }
}

function startRefresh() {
  stopRefresh();
  refreshTimer = setInterval(refreshRoom, 2500);
}

function stopRefresh() {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}


function setupMagicCircleUi(container) {
  const overlay = document.createElement("canvas");
  overlay.className = "magic-circle-overlay";
  const ctx = overlay.getContext("2d");

  const controlsLeft = document.createElement("div");
  controlsLeft.className = "magic-circle-controls left";
  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.textContent = "↩︎";
  const redoBtn = document.createElement("button");
  redoBtn.type = "button";
  redoBtn.textContent = "↪︎";
  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "🗑";
  controlsLeft.append(undoBtn, redoBtn, clearBtn);

  const controlsRight = document.createElement("div");
  controlsRight.className = "magic-circle-controls right";
  const chantBtn = document.createElement("button");
  chantBtn.type = "button";
  chantBtn.className = "chant-btn";
  chantBtn.textContent = "魔法陣詠唱🪄ྀི";
  controlsRight.appendChild(chantBtn);

  const history = [];
  let historyIndex = -1;
  let activePointerId = null;
  let lastPoint = null;
  let isChanting = false;
  let spinRafId = null;
  let spinStartTs = 0;

  const resultModal = document.createElement("div");
  resultModal.className = "chant-result-modal hidden";
  resultModal.innerHTML = `
    <div class="chant-result-modal__backdrop"></div>
    <div class="chant-result-modal__card">
      <h3 class="chant-result-modal__title">魔法陣の真名</h3>
      <p class="chant-result-modal__text"></p>
      <button type="button" class="chant-result-modal__close">閉じる</button>
    </div>
  `;
  const resultText = resultModal.querySelector(".chant-result-modal__text");
  const closeModalBtn = resultModal.querySelector(".chant-result-modal__close");

  const updateButtons = () => {
    if (isChanting) {
      undoBtn.disabled = true;
      redoBtn.disabled = true;
      clearBtn.disabled = true;
      chantBtn.disabled = true;
      return;
    }
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;
    clearBtn.disabled = historyIndex <= 0;
    chantBtn.disabled = false;
  };

  const restoreState = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const src = history[historyIndex];
    if (!src) {
      updateButtons();
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.drawImage(img, 0, 0, overlay.width, overlay.height);
      updateButtons();
    };
    img.src = src;
  };

  const commitState = () => {
    const snapshot = overlay.toDataURL("image/png");
    history.splice(historyIndex + 1);
    history.push(snapshot);
    historyIndex = history.length - 1;
    updateButtons();
  };

  const getPos = (event) => {
    const rect = overlay.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const configureCtx = () => {
    if (!ctx) return;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  const resizeOverlay = () => {
    const activeSnapshot = history[historyIndex] || null;
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;
    configureCtx();
    if (!activeSnapshot) {
      ctx?.clearRect(0, 0, overlay.width, overlay.height);
      return;
    }
    const img = new Image();
    img.onload = () => ctx?.drawImage(img, 0, 0, overlay.width, overlay.height);
    img.src = activeSnapshot;
  };

  overlay.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (activePointerId !== null) return;
    activePointerId = event.pointerId;
    overlay.setPointerCapture(event.pointerId);
    configureCtx();
    lastPoint = getPos(event);
    ctx?.beginPath();
    ctx?.moveTo(lastPoint.x, lastPoint.y);
    ctx?.lineTo(lastPoint.x + 0.01, lastPoint.y + 0.01);
    ctx?.stroke();
  });

  overlay.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId || !lastPoint) return;
    const point = getPos(event);
    ctx?.beginPath();
    ctx?.moveTo(lastPoint.x, lastPoint.y);
    ctx?.lineTo(point.x, point.y);
    ctx?.stroke();
    lastPoint = point;
  });

  const finishStroke = (event) => {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    lastPoint = null;
    commitState();
  };

  overlay.addEventListener("pointerup", finishStroke);
  overlay.addEventListener("pointercancel", finishStroke);

  undoBtn.addEventListener("click", () => {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    restoreState();
  });

  redoBtn.addEventListener("click", () => {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    restoreState();
  });

  clearBtn.addEventListener("click", () => {
    if (historyIndex <= 0) return;
    ctx?.clearRect(0, 0, overlay.width, overlay.height);
    commitState();
  });

  const getTrimmedBase64Jpeg = () => {
    if (!ctx) return "";
    const imageData = ctx.getImageData(0, 0, overlay.width, overlay.height);
    const { data, width, height } = imageData;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha === 0) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) return "";
    const trimWidth = maxX - minX + 1;
    const trimHeight = maxY - minY + 1;
    const cropped = document.createElement("canvas");
    cropped.width = trimWidth;
    cropped.height = trimHeight;
    const croppedCtx = cropped.getContext("2d");
    if (!croppedCtx) return "";
    croppedCtx.fillStyle = "#ffffff";
    croppedCtx.fillRect(0, 0, trimWidth, trimHeight);
    croppedCtx.putImageData(ctx.getImageData(minX, minY, trimWidth, trimHeight), 0, 0);

    return cropped.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  };

  const animateSpin = (ts) => {
  if (!spinStartTs) spinStartTs = ts;
  const elapsed = ts - spinStartTs;
  const angle = (elapsed / 1000) * 180;

  overlay.style.transformOrigin = "center center";
  overlay.style.transform = `rotate(${angle}deg) scale(1)`;

  if (isChanting) spinRafId = requestAnimationFrame(animateSpin);
};

  const runShrinkToCenter = async () => {
  overlay.style.transition = "transform 2s linear";

  const currentAngle = ((performance.now() - spinStartTs) / 1000) * 180;
  overlay.style.transformOrigin = "center center";
  overlay.style.transform = `rotate(${currentAngle + 720}deg) scale(0)`;

  await new Promise((resolve) => setTimeout(resolve, 2000));

  overlay.style.transition = "";
  overlay.style.transform = "";
};

  chantBtn.addEventListener("click", async () => {
    if (isChanting) return;
    isChanting = true;
    updateButtons();
    spinStartTs = 0;
    spinRafId = requestAnimationFrame(animateSpin);
    try {
      const base64ImageFile = getTrimmedBase64Jpeg();
      const res = await fetch("/api/origin-magic-circle/chant-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64ImageFile }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "chant_failed");
      await runShrinkToCenter();
      resultText.textContent = data.title || "無題";
      resultModal.classList.remove("hidden");
    } catch (error) {
      console.error("[origin-magic-circle] chant failed:", error);
      alert("詠唱に失敗しました。");
    } finally {
      isChanting = false;
      if (spinRafId) cancelAnimationFrame(spinRafId);
      spinRafId = null;
      overlay.style.transition = "";
      overlay.style.transform = "";
      updateButtons();
    }
  });

  closeModalBtn?.addEventListener("click", () => {
    resultModal.classList.add("hidden");
  });

  container.append(overlay, controlsLeft, controlsRight, resultModal);
  resizeOverlay();
  commitState();
  updateButtons();

  return { resizeOverlay };
}

async function startThreeBattleScene() {
  if (battleStarted) return;
  battleStarted = true;
  stopRefresh();

  refs.page?.classList.add("hidden");
  refs.battleView?.classList.remove("hidden");



let THREE;
let GLTF;
let POST;

try {
  [THREE, GLTF, POST] = await Promise.all([
    import("https://esm.sh/three@0.166.1"),
    import("https://esm.sh/three@0.166.1/examples/jsm/loaders/GLTFLoader.js"),
    Promise.all([
      import("https://esm.sh/three@0.166.1/examples/jsm/postprocessing/EffectComposer.js"),
      import("https://esm.sh/three@0.166.1/examples/jsm/postprocessing/RenderPass.js"),
      import("https://esm.sh/three@0.166.1/examples/jsm/postprocessing/UnrealBloomPass.js"),
      import("https://esm.sh/three@0.166.1/examples/jsm/utils/SkeletonUtils.js"),
    ]),
  ]);
} catch (e) {
  console.error(e);
  alert("3D描画ライブラリの読み込みに失敗しました。");
  return;
}

const [
  { EffectComposer },
  { RenderPass },
  { UnrealBloomPass },
  { clone: skeletonClone },
] = POST;

const {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  HemisphereLight,
  DirectionalLight,
  Group,
  Box3,
  Vector3,
  AnimationMixer,
  Clock,
  MeshBasicMaterial,
  AdditiveBlending,
  NormalBlending,
  DoubleSide,
  SRGBColorSpace,
  Vector2,
  BufferGeometry,
  LineBasicMaterial,
  Line,
  Float32BufferAttribute,
  
  
  
  Mesh,
SphereGeometry,
ConeGeometry,
CylinderGeometry,
TorusGeometry,
RingGeometry,
PlaneGeometry,
TetrahedronGeometry,
CatmullRomCurve3,
TubeGeometry,


Sprite,
SpriteMaterial,
CanvasTexture,
} = THREE;

const { GLTFLoader } = GLTF;

  const scene = new Scene();
  scene.background = new Color("#87ceeb");

  const camera = new PerspectiveCamera(45/*変更4　60→45*/, window.innerWidth / window.innerHeight, 0.1, 2000);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  refs.battleView.innerHTML = "";
  refs.battleView.appendChild(renderer.domElement);
  const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new Vector2(window.innerWidth, window.innerHeight),
  0.6,  // strength: 発光の強さ
  0.3,  // radius: にじみの広さ
  0.65   // threshold: どれくらい明るい部分だけ光らせるか
);

composer.addPass(bloomPass);
  const magicCircleUi = setupMagicCircleUi(refs.battleView);

  const hemiLight = new HemisphereLight(0xbad8ff, 0x5d4430, 1.1);
  scene.add(hemiLight);

  const dirLight = new DirectionalLight(0xffffff, 1.35);
  dirLight.position.set(40, 60, 15);
  scene.add(dirLight);

const loader = new GLTFLoader();
const summonAssetRoots = new Map();

//変更19
const summonAssetAnimationInfo = new Map();

//変更6
const summonAssetMixers = [];
const clock = new Clock();

let wastelandGltf;
let pedestalGltf;
let characterGltf;
let summonAssetGlbList;
try {
  [wastelandGltf, pedestalGltf, characterGltf, summonAssetGlbList] = await Promise.all([
    loader.loadAsync("/3D素材/arid_wasteland.glb"),
    loader.loadAsync("/3D素材/pedestal.glb"),
    loader.loadAsync("/3D素材/ancient_character.glb"),
    
    Promise.all(
  summonAssetOptions.map((assetName) => {
    if (customEffectNames.has(assetName)) return null;
    return loader.loadAsync(`/3D素材/${assetName}`);
  })
)
    
  ]);
} catch (e) {
  console.error("GLB読み込み失敗", e);
  alert("3D素材の読み込みに失敗しました。");
  return;
}

  const tileRoot = new Group();
  //変更5　グリッド間隔
  const tileSpacing = 22;

  for (let z = -25; z <= 25; z += 1) {
    for (let x = -25; x <= 25; x += 1) {
      const tile = wastelandGltf.scene.clone(true);
      tile.position.set(x * tileSpacing, 0, z * tileSpacing);
      tile.scale.setScalar(1/*変更6　2.8→1*/);
      tileRoot.add(tile);
    }
  }

  scene.add(tileRoot);

  const makeSceneObject = (gltfScene, scale) => {
    const object = gltfScene.clone(true);
    object.scale.setScalar(scale);
    return object;
  };
  
  //変更13
function applyFireTornadoMaterialFix(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.forEach((mat) => {
      // 黒で乗算されているのを白に戻す
      if (mat.color) {
        mat.color.set(0xffffff);
      }

      if (mat.map) {
        mat.map.colorSpace = SRGBColorSpace;
        mat.map.needsUpdate = true;
      }

      mat.transparent = true;
      mat.side = DoubleSide;
      mat.depthWrite = true;//お試し
      mat.alphaTest = 0.01;
      mat.toneMapped = true;//お試し
      mat.needsUpdate = true;
    });
  });
}

//変更18　ファイアーボール修正
function applyFireballMaterialFix(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];

    mats.forEach((mat) => {
      if (mat.color) mat.color.set(0xffffff);
      if (mat.emissive) mat.emissive.set(0xff8700);

      mat.emissiveIntensity = 2.5;
      mat.transparent = true;
      mat.opacity = 0.9;
      mat.depthWrite = false;
      mat.alphaTest = 0.01;
      mat.toneMapped = false;
      mat.needsUpdate = true;
    });
  });
}

function createLightningEffect() {
  const root = new Group();

  const createBolt = (offsetX = 0) => {
    const geometry = new BufferGeometry();
    const points = [];

    const segmentCount = 12;
    const height = 4;

    for (let i = 0; i <= segmentCount; i += 1) {
      const t = i / segmentCount;
      const y = height * (1 - t);
      const x = offsetX + (Math.random() - 0.5) * 0.35;
      const z = (Math.random() - 0.5) * 0.35;
      points.push(x, y, z);
    }

    geometry.setAttribute("position", new Float32BufferAttribute(points, 3));

    const material = new LineBasicMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    return new Line(geometry, material);
  };

  root.add(createBolt(0));
  root.add(createBolt(-0.25));
  root.add(createBolt(0.25));

  root.userData.effectType = "lightning";
  root.userData.lastUpdate = 0;

  return root;
}
function makeGlowMaterial(color, opacity = 1) {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
}

function createFogTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );

  gradient.addColorStop(0.0, "rgba(255,255,255,0.55)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.28)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1.0, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}


function createCrescentSlashTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(86, 128, 0, 96, 128, 116);
  gradient.addColorStop(0.0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.28, "rgba(160,240,255,0.95)");
  gradient.addColorStop(0.62, "rgba(50,170,255,0.62)");
  gradient.addColorStop(1.0, "rgba(0,110,255,0)");

  // 外側の円
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(112, 128, 94, 0, Math.PI * 2);
  ctx.fill();

  // 内側を大きめの円でくり抜く
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(156, 128, 104, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function makeLineMaterial(color, opacity = 1) {
  return new LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}
function updateCustomEffect(root, elapsed, delta) {
  const type = root.userData.effectType;
  if (!type) return;

  if (type === "lightning") {
  if (elapsed - root.userData.lastUpdate < 0.05) return;
  root.userData.lastUpdate = elapsed;

  root.children.forEach((line, lineIndex) => {
    const position = line.geometry.attributes.position;
    const segmentCount = position.count - 1;
    const height = 4;
    const offsetX = lineIndex === 1 ? -0.25 : lineIndex === 2 ? 0.25 : 0;

    for (let i = 0; i <= segmentCount; i += 1) {
      const t = i / segmentCount;
      const y = height * (1 - t);
      const x = offsetX + (Math.random() - 0.5) * 0.45;
      const z = (Math.random() - 0.5) * 0.45;
      position.setXYZ(i, x, y, z);
    }

    position.needsUpdate = true;

    if (line.material) {
      line.material.opacity = 0.55 + Math.random() * 0.45;
    }
  });

  return;
}

  if (type === "explosion_burst") {
  root.userData.age = (root.userData.age || 0) + delta;
  const age = root.userData.age;

  // 爆発は短命。1.5秒で自然に消える
  const totalLife = 1.5;

  root.children.forEach((child) => {
    const role = child.userData.role;

    if (role === "flash") {
      // 0.0〜0.25秒：一瞬の白い閃光
      const t = Math.min(age / 0.25, 1);
      child.scale.setScalar(0.2 + t * 3.2);

      if (child.material) {
        child.material.opacity = Math.max(0, 1 - t);
      }
      return;
    }

    if (role === "fireCore") {
      // 0.0〜0.7秒：中心の熱球が膨らんで消える
      const t = Math.min(age / 0.7, 1);
      const pulse = 1 + Math.sin(age * 30) * 0.05;
      child.scale.setScalar((0.35 + t * 1.8) * pulse);

      if (child.material) {
        child.material.opacity = Math.max(0, 0.9 * (1 - t));
      }
      return;
    }

    if (role === "fireOuter") {
      // 0.1〜0.9秒：外側の赤い爆炎
      const t = Math.min(Math.max((age - 0.1) / 0.8, 0), 1);
      child.scale.setScalar(0.5 + t * 2.4);

      if (child.material) {
        child.material.opacity = Math.max(0, 0.42 * (1 - t));
      }
      return;
    }

    if (role === "shockwave") {
      // 0.05〜0.8秒：地面方向へ衝撃波
      const t = Math.min(Math.max((age - 0.05) / 0.75, 0), 1);
      child.scale.setScalar(0.4 + t * 4.5);

      if (child.material) {
        child.material.opacity = Math.max(0, 0.85 * (1 - t));
      }
      return;
    }

    if (role === "ray") {
      // 0.0〜0.45秒：光線が外側へ走って消える
      const delay = child.userData.lifeOffset || 0;
      const t = Math.min(Math.max((age - delay) / 0.45, 0), 1);

      const dir = child.userData.dir || new Vector3(0, 1, 0);
      const speed = child.userData.speed || 3;

      child.position.copy(dir.clone().multiplyScalar(t * speed));
      child.scale.setScalar(1 + t * 1.4);

      if (child.material) {
        child.material.opacity = Math.max(0, 0.9 * (1 - t));
      }
      return;
    }

    if (role === "spark") {
      // 0.0〜1.1秒：火花が放射状に飛び散る
      const velocity = child.userData.velocity || new Vector3();
      const gravity = child.userData.gravity || 1.5;

      child.position.addScaledVector(velocity, delta);
      velocity.y -= gravity * delta;

      child.rotation.x += delta * 8;
      child.rotation.y += delta * 6;

      const t = Math.min(age / 1.1, 1);
      child.scale.setScalar(Math.max(0.15, 1 - t * 0.75));

      if (child.material) {
        child.material.opacity = Math.max(0, 0.95 * (1 - t));
      }
      return;
    }

    if (role === "smoke") {
      // 0.25〜1.5秒：煙が遅れて膨らむ
      const t = Math.min(Math.max((age - 0.25) / 1.25, 0), 1);
      const dir = child.userData.dir || new Vector3(0, 1, 0);
      const speed = child.userData.speed || 0.6;
      const phase = child.userData.phase || 0;

      child.position.addScaledVector(dir, delta * speed);
      child.position.x += Math.sin(age * 4 + phase) * delta * 0.15;
      child.position.z += Math.cos(age * 3 + phase) * delta * 0.15;

      child.scale.setScalar(0.4 + t * 2.2);

      if (child.material) {
        const fadeIn = Math.min(t * 4, 1);
        const fadeOut = 1 - t;
        child.material.opacity = Math.max(0, 0.32 * fadeIn * fadeOut);
      }
      return;
    }
  });

  // 1.5秒後は消す。テスト画面では再表示用に自動リセットしたいなら下の reset を使う
  if (age >= totalLife) {
    root.visible = false;
    root.userData.finished = true;
  }

  return;
}

  if (type === "mist_cloud") {
  root.rotation.y += delta * 0.05;

  root.children.forEach((child, index) => {
    const phase = child.userData.phase || 0;
    const speed = child.userData.driftSpeed || 0.3;
    const floatRange = child.userData.floatRange || 0.1;

    const baseX = child.userData.baseX || 0;
    const baseY = child.userData.baseY || 0;
    const baseZ = child.userData.baseZ || 0;

    // 上に登って消えるのではなく、その場でゆっくり漂わせる
    child.position.x = baseX + Math.sin(elapsed * speed + phase) * 0.25;
    child.position.y = baseY + Math.sin(elapsed * speed * 0.8 + phase) * floatRange;
    child.position.z = baseZ + Math.cos(elapsed * speed + phase) * 0.25;

    const breath = 1 + Math.sin(elapsed * 1.2 + phase) * 0.06;
    const baseScale = child.userData.baseScale || 1;

    if (!child.userData.initialScaleX) {
      child.userData.initialScaleX = child.scale.x;
      child.userData.initialScaleY = child.scale.y;
    }

    child.scale.set(
      child.userData.initialScaleX * breath,
      child.userData.initialScaleY * breath,
      1
    );

    if (child.material) {
      const baseOpacity = child.userData.baseOpacity || 0.2;
      child.material.opacity =
        baseOpacity + Math.sin(elapsed * 1.5 + index) * 0.035;
    }
  });

  return;
}

  if (type === "energy_slash") {
  root.children.forEach((child, index) => {
    const role = child.userData.role;

    if (role === "crescent_body") {
      // 本体は回転させない。軽く呼吸するだけ。
      child.material.opacity = 0.82 + Math.sin(elapsed * 2.2) * 0.08;
      child.scale.set(
        3.2 + Math.sin(elapsed * 1.8) * 0.05,
        2.0 + Math.sin(elapsed * 1.8) * 0.03,
        1
      );
      return;
    }

    if (role === "crescent_wave") {
  const cycle = 1.65;
  const local = (elapsed * child.userData.speed + child.userData.delay) % cycle;

  if (local > 1.0) {
    child.visible = false;
    return;
  }

  child.visible = true;

  const t = local;
  const angle = -Math.PI * 0.78 + Math.PI * 1.56 * t;

  // 三日月の外縁に沿う座標
  let x = Math.cos(angle) * 0.62 - 0.12;
  let y = Math.sin(angle) * 1.05;

  // 三日月本体を -90° 回したので、光の軌道も同じだけ回す
  const rotatedX = y;
  const rotatedY = -x;

  child.position.set(rotatedX, rotatedY, 0.08);

  const fade = Math.sin(t * Math.PI);
  const flicker = 0.75 + Math.sin(elapsed * 35 + index * 3) * 0.25;

  child.material.opacity = 0.95 * fade * flicker;
  child.scale.set(0.18 + fade * 0.28, 0.18 + fade * 0.28, 1);

  return;
}
  });

  return;
}

    

  if (type === "shadow_orb" || type === "light_orb") {
    root.rotation.y += delta * 1.5;
    root.rotation.x += delta * 0.35;
    root.children.forEach((child, index) => {
      if (type === "shadow_orb" && child.userData.kind === "infall") {
        child.scale.y = 0.75 + Math.sin(elapsed * child.userData.freq + index) * 0.25;
      }
      if (child.material && child.userData.kind === "mist") {
        child.material.opacity = 0.24 + Math.sin(elapsed * 3 + index) * 0.12;
      }
    });

    const pulse = 1 + Math.sin(elapsed * 4) * 0.08;
    root.scale.setScalar(root.userData.currentScale ? root.userData.currentScale * pulse : pulse);
    return;
  }

  if (type === "crystal_shard") {
    root.rotation.y += delta * 7;
    root.position.y += Math.sin(elapsed * 3) * 0.002;
    root.children.forEach((child, index) => {
      if (child.userData.kind === "helix") {
        child.rotation.y += delta * 2.4;
        child.material.opacity = 0.45 + Math.sin(elapsed * 10 + index) * 0.22;
      }
    });
    return;
  }

  if (type === "fang_spikes") {
    root.children.forEach((child, index) => {
      if (child.userData.kind === "fang") {
        child.position.y = 0.1 + Math.max(0, Math.sin(elapsed * 4 + child.userData.offset)) * child.userData.rise;
      }
      child.rotation.y += delta * (0.4 + index * 0.05);
    });
    return;
  }

  if (type === "simple_ring") {
    const s = 1 + (Math.sin(elapsed * 3) + 1) * 0.15;
    root.children.forEach((child) => {
      child.scale.setScalar(s);
      if (child.material) {
        child.material.opacity = 0.45 + Math.sin(elapsed * 5) * 0.2;
      }
    });
  }
}





function createExplosionBurstEffect() {
  const root = new Group();

  // 爆発の経過時間
  root.userData.effectType = "explosion_burst";
  root.userData.age = 0;
  root.userData.finished = false;

  // 1. 中心閃光：爆発の「ドン！」の核
  const flash = new Mesh(
    new SphereGeometry(0.45, 32, 16),
    makeGlowMaterial(0xffffff, 1)
  );
  flash.userData.role = "flash";
  root.add(flash);

  // 2. 熱球：中心から膨らむオレンジの爆炎
  const fireCore = new Mesh(
    new SphereGeometry(0.7, 32, 18),
    makeGlowMaterial(0xffaa22, 0.85)
  );
  fireCore.userData.role = "fireCore";
  root.add(fireCore);

  // 3. 外側の赤い爆炎
  const fireOuter = new Mesh(
    new SphereGeometry(1.0, 32, 18),
    makeGlowMaterial(0xff3300, 0.38)
  );
  fireOuter.userData.role = "fireOuter";
  root.add(fireOuter);

  // 4. 衝撃波リング：地面・空間に広がる波
  const shockwave = new Mesh(
    new RingGeometry(0.25, 0.35, 96),
    makeGlowMaterial(0xffe6aa, 0.85)
  );
  shockwave.rotation.x = -Math.PI / 2;
  shockwave.userData.role = "shockwave";
  root.add(shockwave);

  // 5. 放射状の光線：爆発の鋭さ
  for (let i = 0; i < 18; i += 1) {
    const rayGeometry = new BufferGeometry();

    const dir = new Vector3(
      Math.random() - 0.5,
      Math.random() * 0.8 + 0.1,
      Math.random() - 0.5
    ).normalize();

    const length = 0.8 + Math.random() * 1.4;

    rayGeometry.setAttribute(
      "position",
      new Float32BufferAttribute([
        0, 0, 0,
        dir.x * length,
        dir.y * length,
        dir.z * length,
      ], 3)
    );

    const ray = new Line(
      rayGeometry,
      makeLineMaterial(i % 2 === 0 ? 0xffffff : 0xffcc55, 0.9)
    );

    ray.userData.role = "ray";
    ray.userData.dir = dir;
    ray.userData.speed = 2.5 + Math.random() * 3.5;
    ray.userData.lifeOffset = Math.random() * 0.15;

    root.add(ray);
  }

  // 6. 火花・破片：弾け飛ぶ粒
  for (let i = 0; i < 32; i += 1) {
    const spark = new Mesh(
      new SphereGeometry(0.035 + Math.random() * 0.035, 8, 6),
      makeGlowMaterial(i % 3 === 0 ? 0xffffff : 0xffaa22, 0.95)
    );

    const dir = new Vector3(
      Math.random() - 0.5,
      Math.random() * 0.9,
      Math.random() - 0.5
    ).normalize();

    spark.position.copy(dir.clone().multiplyScalar(0.15));
    spark.userData.role = "spark";
    spark.userData.velocity = dir.multiplyScalar(2.5 + Math.random() * 4.5);
    spark.userData.gravity = 1.2 + Math.random() * 0.8;

    root.add(spark);
  }

  // 7. 煙：遅れて広がる余韻
  for (let i = 0; i < 14; i += 1) {
    const smoke = new Mesh(
      new SphereGeometry(0.22 + Math.random() * 0.22, 12, 8),
      new MeshBasicMaterial({
        color: i % 2 === 0 ? 0x555555 : 0x777777,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      })
    );

    const dir = new Vector3(
      Math.random() - 0.5,
      Math.random() * 0.6 + 0.2,
      Math.random() - 0.5
    ).normalize();

    smoke.position.copy(dir.clone().multiplyScalar(0.2));
    smoke.userData.role = "smoke";
    smoke.userData.dir = dir;
    smoke.userData.speed = 0.45 + Math.random() * 0.6;
    smoke.userData.phase = Math.random() * Math.PI * 2;

    root.add(smoke);
  }

  return root;
}

function resetExplosionBurst(root) {
  root.userData.age = 0;
  root.userData.finished = false;
  root.visible = true;

  root.children.forEach((child) => {
    const role = child.userData.role;

    child.position.set(0, 0, 0);
    child.scale.setScalar(1);

    if (role === "flash") {
      child.scale.setScalar(0.2);
      if (child.material) child.material.opacity = 1;
    }

    if (role === "fireCore") {
      child.scale.setScalar(0.35);
      if (child.material) child.material.opacity = 0.9;
    }

    if (role === "fireOuter") {
      child.scale.setScalar(0.5);
      if (child.material) child.material.opacity = 0.42;
    }

    if (role === "shockwave") {
      child.scale.setScalar(0.4);
      if (child.material) child.material.opacity = 0.85;
    }

    if (role === "ray") {
      if (child.material) child.material.opacity = 0.9;
    }

    if (role === "spark") {
      if (child.material) child.material.opacity = 0.95;
    }

    if (role === "smoke") {
      if (child.material) child.material.opacity = 0;
    }
  });
}

function createMistCloudEffect() {
  const root = new Group();
  const fogTexture = createFogTexture();

  root.userData.effectType = "mist_cloud";

  // 広い霧の層
  for (let i = 0; i < 34; i += 1) {
    const material = new SpriteMaterial({
      map: fogTexture,
      color: i % 3 === 0 ? 0xdde7ff : 0xffffff,
      transparent: true,
      opacity: 0.18 + Math.random() * 0.12,
      depthWrite: false,
      depthTest: true,
      blending: NormalBlending,
      toneMapped: false,
    });

    const sprite = new Sprite(material);

    const radius = 1.8 + Math.random() * 1.6;
    const angle = Math.random() * Math.PI * 2;

    sprite.position.set(
      Math.cos(angle) * radius * Math.random(),
      0.2 + Math.random() * 1.7,
      Math.sin(angle) * radius * Math.random()
    );

    const size = 1.2 + Math.random() * 1.8;
    sprite.scale.set(size, size, 1);

    sprite.userData.role = "fog_layer";
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.baseY = sprite.position.y;
    sprite.userData.baseZ = sprite.position.z;
    sprite.userData.baseOpacity = material.opacity;
    sprite.userData.driftSpeed = 0.25 + Math.random() * 0.45;
    sprite.userData.phase = Math.random() * Math.PI * 2;
    sprite.userData.floatRange = 0.08 + Math.random() * 0.18;

    root.add(sprite);
  }

  // 奥に濃い霧の芯を作る
  for (let i = 0; i < 8; i += 1) {
    const material = new SpriteMaterial({
      map: fogTexture,
      color: 0xbfc8ff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      toneMapped: false,
    });

    const sprite = new Sprite(material);

    sprite.position.set(
      (Math.random() - 0.5) * 1.5,
      0.7 + Math.random() * 1.2,
      (Math.random() - 0.5) * 1.5
    );

    const size = 1.4 + Math.random() * 1.2;
    sprite.scale.set(size, size, 1);

    sprite.userData.role = "mist_core";
    sprite.userData.baseX = sprite.position.x;
    sprite.userData.baseY = sprite.position.y;
    sprite.userData.baseZ = sprite.position.z;
    sprite.userData.baseOpacity = material.opacity;
    sprite.userData.driftSpeed = 0.4 + Math.random() * 0.5;
    sprite.userData.phase = Math.random() * Math.PI * 2;
    sprite.userData.floatRange = 0.05 + Math.random() * 0.12;

    root.add(sprite);
  }

  return root;
}

function createEnergySlashEffect() {
  const root = new Group();
  root.userData.effectType = "energy_slash";

  const crescentTexture = createCrescentSlashTexture();

  const crescent = new Sprite(
  new SpriteMaterial({
    map: crescentTexture,
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    rotation: -Math.PI / 2,
  })
);

crescent.userData.role = "crescent_body";
crescent.scale.set(3.4, 2.1, 1);
root.add(crescent);

  // 端から端へ走る発光点
  for (let i = 0; i < 5; i += 1) {
    const wave = new Sprite(
      new SpriteMaterial({
        map: createFogTexture(),
        color: i % 2 === 0 ? 0xffffff : 0x99eeff,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      })
    );

    wave.userData.role = "crescent_wave";
    wave.userData.delay = i * 0.06;
    wave.userData.speed = 1.0;
    wave.scale.set(0.35, 0.35, 1);
    root.add(wave);
  }

  return root;
}

function createDarkOrbEffect() {
  const root = new Group();

  const orb = new Mesh(
    new SphereGeometry(0.75, 32, 20),
    new MeshBasicMaterial({
      color: 0x09020f,
      transparent: true,
      opacity: 0.9,
      blending: NormalBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );

  const ring = new Mesh(
    new TorusGeometry(1.0, 0.04, 8, 64),
    new MeshBasicMaterial({
      color: 0xaa33ff,
      transparent: true,
      opacity: 0.85,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );

  ring.rotation.x = Math.PI / 2;
  root.add(orb, ring);
  for (let i = 0; i < 5; i += 1) {
    const mist = new Mesh(new SphereGeometry(0.95 + Math.random() * 0.2, 16, 12), new MeshBasicMaterial({
      color: 0x6f2aff, transparent: true, opacity: 0.2, blending: AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    mist.scale.set(1.2, 0.5, 1.2);
    mist.rotation.x = Math.random() * Math.PI;
    mist.userData = { kind: "mist" };
    root.add(mist);
  }
  for (let i = 0; i < 12; i += 1) {
    const infall = new Mesh(new CylinderGeometry(0.005, 0.02, 1.2 + Math.random() * 0.8, 5), new MeshBasicMaterial({
      color: 0xaa88ff, transparent: true, opacity: 0.65, blending: AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    infall.position.set((Math.random() - 0.5) * 2.8, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.8);
    infall.lookAt(0, 0, 0);
    infall.userData = { kind: "infall", freq: 5 + Math.random() * 3 };
    root.add(infall);
  }
  root.userData.effectType = "shadow_orb";

  return root;
}

function createLightOrbEffect() {
  const root = new Group();

  const orb = new Mesh(
    new SphereGeometry(0.75, 32, 20),
    new MeshBasicMaterial({
      color: 0xffffcc,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );

  const halo = new Mesh(
    new TorusGeometry(1.05, 0.035, 8, 64),
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );

  halo.rotation.x = Math.PI / 2;

  root.add(orb, halo);
  root.userData.effectType = "light_orb";

  return root;
}

function createIceShardEffect() {
  const root = new Group();

  const shard = new Mesh(
    new ConeGeometry(0.35, 2.0, 6),
    new MeshBasicMaterial({
      color: 0x99ddff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      toneMapped: false,
    })
  );

  shard.rotation.x = Math.PI / 2;

  const glow = new Mesh(
    new ConeGeometry(0.45, 2.15, 6),
    new MeshBasicMaterial({
      color: 0x66ccff,
      transparent: true,
      opacity: 0.25,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
  );

  glow.rotation.x = Math.PI / 2;

  root.add(shard, glow);
  for (let i = 0; i < 3; i += 1) {
    const helix = new Mesh(new TorusGeometry(0.14 + i * 0.08, 0.012, 6, 36), new MeshBasicMaterial({
      color: 0xdaf6ff, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    helix.position.y = -0.85 + i * 0.65;
    helix.rotation.x = Math.PI / 2;
    helix.userData = { kind: "helix" };
    root.add(helix);
  }
  root.userData.effectType = "crystal_shard";

  return root;
}

function createWindBladeEffect() {
  const root = new Group();

  const geometry = new TorusGeometry(1.25, 0.035, 8, 64, Math.PI * 1.15);
  const material = new MeshBasicMaterial({
    color: 0xccffee,
    transparent: true,
    opacity: 0.65,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });

  const blade = new Mesh(geometry, material);
  blade.scale.set(1.4, 0.55, 1);
  blade.rotation.set(Math.PI / 2.2, 0, -Math.PI / 8);

  root.add(blade);
  root.userData.effectType = "energy_slash";

  return root;
}

function createGroundSpikeEffect() {
  const root = new Group();

  for (let i = 0; i < 8; i += 1) {
    const spike = new Mesh(
      new ConeGeometry(0.14 + Math.random() * 0.1, 1.2 + Math.random() * 0.8, 8),
      new MeshBasicMaterial({
        color: i % 2 === 0 ? 0xe7d0af : 0xb28c66,
        transparent: true,
        opacity: 1,
        depthWrite: true,
      })
    );
    spike.position.set((i - 3.5) * 0.24, 0.12, (Math.random() - 0.5) * 0.28);
    spike.rotation.z = -1.05 + Math.random() * 0.16;
    spike.userData = { kind: "fang", offset: i * 0.45, rise: 0.8 + Math.random() * 0.7 };

    root.add(spike);
  }

  root.userData.effectType = "fang_spikes";

  return root;
}

function createSimpleRingEffect() {
  const root = new Group();

  const ring = new Mesh(
    new RingGeometry(0.6, 0.72, 64),
    new MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    })
  );

  ring.rotation.x = -Math.PI / 2;

  root.add(ring);
  root.userData.effectType = "simple_ring";
  root.userData.baseScale = 1;

  return root;
}




function createCustomEffectByName(assetName) {
  if (assetName === "lightning") return createLightningEffect();
  if (assetName === "explosion_burst") return createExplosionBurstEffect();
  if (assetName === "mist_cloud") return createMistCloudEffect();
  if (assetName === "energy_slash") return createEnergySlashEffect();
  if (assetName === "shadow_orb") return createDarkOrbEffect();
  if (assetName === "light_orb") return createLightOrbEffect();
  if (assetName === "crystal_shard") return createIceShardEffect();
  if (assetName === "fang_spikes") return createGroundSpikeEffect();
  if (assetName === "simple_ring") return createSimpleRingEffect();

  return new Group();
}



  const getHeight = (object3d) => {
    const box = new Box3().setFromObject(object3d);
    return box.max.y - box.min.y;
  };

  const setCameraForMatchup = (myId, members, fighterA, fighterB) => {
  const isPlayerTwo = members.findIndex((member) => member.id === myId) === 1;
  const ownFighter = isPlayerTwo ? fighterB : fighterA;
  const enemyFighter = isPlayerTwo ? fighterA : fighterB;

  const ownPos = ownFighter.position.clone();
  const enemyPos = enemyFighter.position.clone();

  // 自分 → 敵 の方向
  const forward = new Vector3().subVectors(enemyPos, ownPos).normalize();

  // 右方向
  const right = new Vector3(forward.z, 0, -forward.x).normalize();

  const cameraPosition = ownPos.clone()
    .addScaledVector(forward, -13) // 後ろへ
    .addScaledVector(right, 2)    // 右へ
    .add(new Vector3(0, 2, 0));   // 上へ

  camera.position.copy(cameraPosition);

  // 敵の少し上を見る
  camera.lookAt(enemyPos.clone().add(new Vector3(0, 3.5, 0)));
};


  const pedestalA = makeSceneObject(pedestalGltf.scene, 0.0024);
const pedestalB = makeSceneObject(pedestalGltf.scene, 0.0024);
pedestalA.position.set(-16, 2, 0);
pedestalB.position.set(16, 2, 0);
scene.add(pedestalA, pedestalB);

const fighterA = makeSceneObject(characterGltf.scene, 1.5);
const fighterB = makeSceneObject(characterGltf.scene, 1.5);

const pedestalHeight = getHeight(pedestalA);
const characterHeight = getHeight(fighterA);
const fighterYOffset = pedestalHeight + characterHeight * 0.5 +2;

fighterA.position.set(-16, fighterYOffset, 0);
fighterB.position.set(16, fighterYOffset, 0);
  fighterA.lookAt(fighterB.position.clone().add(new Vector3(0, 1.5, 0)));
  fighterB.lookAt(fighterA.position.clone().add(new Vector3(0, 1.5, 0)));
  scene.add(fighterA, fighterB);

//変更7
  summonAssetGlbList.forEach((gltf, index) => {
  const assetName = summonAssetOptions[index];
  
  summonAssetAnimationInfo.set(
    assetName,
    gltf
      ? gltf.animations.map((clip) => ({
          name: clip.name,
          duration: clip.duration,
          trackCount: clip.tracks.length,
          trackNames: clip.tracks.slice(0, 10).map((track) => track.name),
      }))
    : []
  );
  //const root = gltf.scene.clone(true);
  const root = customEffectNames.has(assetName)
  ? createCustomEffectByName(assetName)
  : skeletonClone(gltf.scene);   
  
       
  //変更15
  if (assetName === "stylized_fire_tornado.glb") {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat) => {
      showDebug(JSON.stringify({
        
        assetName: assetName,
    animationCount: gltf.animations.length,
    animations: gltf.animations,
    
    
    
    
        mesh: child.name,
        material: mat.name,
        hasMap: !!mat.map,
        hasEmissiveMap: !!mat.emissiveMap,
        hasAlphaMap: !!mat.alphaMap,
        transparent: mat.transparent,
        opacity: mat.opacity,
        color: mat.color?.getHexString?.(),
        emissive: mat.emissive?.getHexString?.(),
      }, null, 2));
    });
  });
}



  root.visible = false;
  //変更15
  if (assetName === "fireball.glb") {
    applyFireballMaterialFix(root);
  }

if (assetName === "stylized_fire_tornado.glb") {
  applyFireTornadoMaterialFix(root);
}


  root.position.set(0, 1.6, 0);
  root.scale.setScalar(1);
  scene.add(root);
  summonAssetRoots.set(assetName, root);

  if (gltf && gltf.animations && gltf.animations.length > 0) {
  const mixer = new AnimationMixer(root);

  const clip =
    gltf.animations.find((clip) => clip.name === "attack a") ||
    gltf.animations[0];

  if (clip) {
    const action = mixer.clipAction(clip);
    action.reset();
    action.play();
  }

  summonAssetMixers.push(mixer);
}
});

  const topControls = document.createElement("div");
  topControls.style.maxHeight = "28vh";
topControls.style.overflowY = "auto";
topControls.style.maxWidth = "96vw";
topControls.style.fontSize = "12px";
topControls.style.padding = "8px";
  topControls.className = "summon-test-controls";
  topControls.innerHTML = `
  <div class="summon-test-controls__list"></div>

  <div class="summon-test-controls__fields">
    <label class="summon-test-controls__field">
      スケール倍率
      <input class="summon-scale-input" type="number" min="0.01" step="0.1" value="1" />
    </label>

    <label class="summon-test-controls__field">
      Y高さ
      <input class="summon-y-input" type="number" step="0.1" value="1.6" />
    </label>
  </div>
`;
  const radioList = topControls.querySelector(".summon-test-controls__list");
  const scaleInput = topControls.querySelector(".summon-scale-input");
  const yInput = topControls.querySelector(".summon-y-input");

if (radioList) {
  radioList.style.display = "flex";
  radioList.style.flexWrap = "wrap";
  radioList.style.gap = "6px";
}

  summonAssetOptions.forEach((assetName, index) => {
    const label = document.createElement("label");
    label.className = "summon-test-controls__item";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "summonAsset";
    radio.value = assetName;
    radio.checked = index === 0;
    label.append(radio, document.createTextNode(assetName));
    radioList?.appendChild(label)
  });
  
  radioList?.addEventListener("change", () => {
  const checkedAsset = topControls.querySelector('input[name="summonAsset"]:checked');
  const selectedName = checkedAsset?.value || "";
  const defaults = summonAssetDefaults[selectedName] || { scale: 1, y: 1.6, offsetX: 0, offsetZ: 0 };  scaleInput.value = defaults.scale;
  yInput.value = defaults.y;

  applySummonState();
});


//変更16
function getMaterialDebugText(root, assetName) {
  const animations = summonAssetAnimationInfo.get(assetName) || [];

  const lines = [
    `asset: ${assetName}`,
    `animationCount: ${animations.length}`,
    JSON.stringify({ animations }, null, 2),
  ];

  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];

    mats.forEach((mat, index) => {
      lines.push(JSON.stringify({
        mesh: child.name,
        materialIndex: index,
        material: mat.name,
        type: mat.type,
        hasMap: !!mat.map,
        transparent: mat.transparent,
        opacity: mat.opacity,
        color: mat.color?.getHexString?.(),
        blending: mat.blending,
        depthWrite: mat.depthWrite,
        alphaTest: mat.alphaTest,
        toneMapped: mat.toneMapped,
      }, null, 2));
    });
  });

  return lines.join("\n");
}



  const applySummonState = () => {
  const checkedAsset = topControls.querySelector('input[name="summonAsset"]:checked');
  const selectedName = checkedAsset?.value || "";

  const scaleValue = Number(scaleInput?.value);
  const appliedScale = Number.isFinite(scaleValue) && scaleValue > 0 ? scaleValue : 1;

  const yValue = Number(yInput?.value);
  const appliedY = Number.isFinite(yValue) ? yValue : 1.6;

  summonAssetRoots.forEach((root, assetName) => {
    const isActive = assetName === selectedName;
    root.visible = isActive;


//変更17
    if (isActive) {
  const defaults = summonAssetDefaults[assetName] || {
    scale: 1,
    y: 1.6,
    offsetX: 0,
    offsetZ: 0,
  };

  root.scale.setScalar(appliedScale);
  root.position.set(defaults.offsetX || 0, appliedY, defaults.offsetZ || 0);
  root.userData.currentScale = appliedScale;

  if (root.userData.effectType === "explosion_burst") {
    resetExplosionBurst(root);
  }

  showDebug(getMaterialDebugText(root, assetName));
}
    
    
  });
};

  topControls.addEventListener("change", applySummonState);
  scaleInput?.addEventListener("input", applySummonState);
  yInput?.addEventListener("input", applySummonState);  refs.battleView.appendChild(topControls);
  applySummonState();

  setCameraForMatchup(userTrackingId, currentRoom?.members || [], fighterA, fighterB);

  const onResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  magicCircleUi?.resizeOverlay();
};
  window.addEventListener("resize", onResize);

//変更8
const animate = () => {
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;

  summonAssetMixers.forEach((mixer) => {
    mixer.update(delta);
  });

  summonAssetRoots.forEach((root) => {
  updateCustomEffect(root, elapsed, delta);
});

  composer.render();
  requestAnimationFrame(animate);
};


  animate();
}

refs.createRoomBtn?.addEventListener("click", async () => {
  if (!userTrackingId) {
    alert("ログイン情報が見つかりません。タイトルに戻って再ログインしてください。");
    return;
  }

  try {
    const room = await callApi("/api/origin-magic-circle/rooms/create", { username, userTrackingId }, "POST");
    saveActiveRoomId(room.roomId);
    showWaitingRoom(room);
    setMessage("ルームを作成しました。対戦相手の入室を待ってください。");
    startRefresh();
  } catch (error) {
    setMessage(`ルーム作成に失敗しました: ${error.message}`);
  }
});

refs.joinRoomBtn?.addEventListener("click", async () => {
  if (!userTrackingId) {
    alert("ログイン情報が見つかりません。タイトルに戻って再ログインしてください。");
    return;
  }
  const roomId = prompt("6桁のルームIDを入力してください");
  if (!roomId) return;

  try {
    const room = await callApi("/api/origin-magic-circle/rooms/join", { roomId, username, userTrackingId }, "POST");
    saveActiveRoomId(room.roomId);
    showWaitingRoom(room);
    setMessage("ルームに入室しました。");
    startRefresh();
  } catch (error) {
    if (error.message === "room_full") {
      setMessage("このルームは満員です（最大2名）。");
      return;
    }
    setMessage(`入室に失敗しました: ${error.message}`);
  }
});

refs.deleteRoomBtn?.addEventListener("click", async () => {
  if (!currentRoom?.roomId) return;
  try {
    await callApi("/api/origin-magic-circle/rooms/delete", { roomId: currentRoom.roomId, userTrackingId }, "POST");
    stopRefresh();
    clearActiveRoomId();
    currentRoom = null;
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    setMessage("ルームを削除しました。");
  } catch (error) {
    setMessage(`ルーム削除に失敗しました: ${error.message}`);
  }
});

refs.leaveRoomBtn?.addEventListener("click", async () => {
  if (!currentRoom?.roomId) return;
  try {
    await callApi("/api/origin-magic-circle/rooms/leave", { roomId: currentRoom.roomId, userTrackingId }, "POST");
    stopRefresh();
    clearActiveRoomId();
    currentRoom = null;
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    setMessage("ルームを退出しました。");
  } catch (error) {
    setMessage(`ルーム退出に失敗しました: ${error.message}`);
  }
});

refs.startGameBtn?.addEventListener("click", async () => {
  if (!currentRoom?.roomId) return;
  try {
    const room = await callApi("/api/origin-magic-circle/rooms/start", {
      roomId: currentRoom.roomId,
      userTrackingId,
    }, "POST");

    currentRoom = room;
    await startThreeBattleScene();
  } catch (error) {
    setMessage(`ゲーム開始に失敗しました: ${error.message}`);
  }
});

refs.backToTitleBtn?.addEventListener("click", () => {
  window.location.href = "/";
});

async function restoreActiveRoomIfExists() {
  const activeRoomId = localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY);
  if (!activeRoomId) {
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    return;
  }

  setMessage("前回の待機部屋に再接続中...");
  try {
    const room = await callApi(`/api/origin-magic-circle/rooms/${encodeURIComponent(activeRoomId)}`);
    const joined = room.members?.some((member) => member.id === userTrackingId);

    if (!joined) {
      clearActiveRoomId();
      showHomePanel();
      refs.waitingRoom.classList.add("hidden");
      refs.waitingNote.classList.remove("hidden");
      setMessage("前回の待機部屋には再接続できませんでした。");
      return;
    }

    showWaitingRoom(room);
    if (room.status === "対戦中") {
      await startThreeBattleScene();
      return;
    }

    startRefresh();
    setMessage(`ルーム ${room.roomId} に再接続しました。`);
  } catch (error) {
    clearActiveRoomId();
    showHomePanel();
    refs.waitingRoom.classList.add("hidden");
    refs.waitingNote.classList.remove("hidden");
    if (error.message === "room_not_found") {
      setMessage("前回の待機部屋は見つかりませんでした。");
      return;
    }
    setMessage("待機部屋の再接続に失敗しました。");
  }
}

restoreActiveRoomIfExists();
