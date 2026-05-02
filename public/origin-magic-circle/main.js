

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
  "negative_leader.glb"
];

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
    offsetZ: 5,
  },
  "stylized_fire_tornado.glb": {
    scale: 0.01,
    y: 1.6,
    offsetX: 0,
    offsetZ: 0,
  },
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
  DoubleSide,
  SRGBColorSpace,
  Vector2,
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
    Promise.all(summonAssetOptions.map((assetName) => loader.loadAsync(`/3D素材/${assetName}`))),
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
  gltf.animations.map((clip) => ({
    name: clip.name,
    duration: clip.duration,
    trackCount: clip.tracks.length,
    trackNames: clip.tracks.slice(0, 10).map((track) => track.name),
  }))
);
  //const root = gltf.scene.clone(true);
  const root = skeletonClone(gltf.scene);
  
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

  if (gltf.animations && gltf.animations.length > 0) {
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
  const defaults = summonAssetDefaults[assetName] || { scale: 1, y: 1.6, offsetX: 0, offsetZ: 0 };

  root.scale.setScalar(appliedScale);
  root.position.set(defaults.offsetX || 0, appliedY, defaults.offsetZ || 0);

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

  summonAssetMixers.forEach((mixer) => {
    mixer.update(delta);
  });

  //renderer.render(scene, camera);
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