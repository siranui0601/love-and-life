

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

const ORIGIN_TUTORIAL_DISMISSED_KEY = "originMagicCircleTutorialDismissed";





function installDoubleTapZoomBlocker() {
  let lastTouchEndAt = 0;

  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();

      if (now - lastTouchEndAt <= 350) {
        event.preventDefault();
      }

      lastTouchEndAt = now;
    },
    { passive: false }
  );
}

installDoubleTapZoomBlocker();





const summonAssetOptions = [
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
  "simple_ring",
];


const customEffectNames = new Set([
  "lightning",
  "explosion_burst",
  "mist_cloud",
  "light_orb",
  "crystal_shard",
  "simple_ring",
]);

//変更10
const summonAssetSizePresets = {
  "fireball.glb": {
    small: { scale: 1, y: 1.6 },
    medium: { scale: 2, y: 1.6 },
    large: { scale: 10, y: 1.6 },
  },
  "magic_voxel_skull_flat_shaded.glb": {
    small: { scale: 1, y: 1.75, offsetZ: 3.5 },
    medium: { scale: 2, y: 3.5, offsetZ: 7 },
    large: { scale: 4, y: 7, offsetZ: 14 },
  },
  "stylized_fire_tornado.glb": {
    small: { scale: 0.005, y: 1.6 },
    medium: { scale: 0.01, y: 1.6 },
    large: { scale: 0.03, y: 1.6 },
  },
  "phoenix_bird.glb": {
    small: { scale: 0.002, y: 1.6 },
    medium: { scale: 0.01, y: 1.6 },
    large: { scale: 0.03, y: 1.6 },
  },
  "truth_about_the_dark_side_of_the_moon.glb": {
    small: { scale: 1, y: 0.66 },
    medium: { scale: 3, y: 2 },
    large: { scale: 9, y: 6 },
  },
  "broken_steampunk_clock.glb": {
    small: { scale: 0.02, y: 4 },
    medium: { scale: 0.1, y: 4 },
    large: { scale: 0.15, y: 8 },
  },
  "evanescent_plasma.glb": {
    small: { scale: 1, y: 3 },
    medium: { scale: 2, y: 3 },
    large: { scale: 6, y: 3 },
  },
  "gun-bot_with_walk_and_idle_animation.glb": {
    small: { scale: 0.5, y: 1.6 },
    medium: { scale: 2, y: 1.6 },
    large: { scale: 4, y: 1.6 },
  },
  "soulsucker_-_weaponcraft.glb": {
    small: { scale: 1, y: 1.6 },
    medium: { scale: 2, y: 1.6 },
    large: { scale: 4, y: 1.6 },
  },
  "bouquet.glb": {
    small: { scale: 1.5, y: 1.6 },
    medium: { scale: 2.5, y: 1.6 },
    large: { scale: 5, y: 1.6 },
  },
  "lance_of_the_primordials_-_dae_weaponcraft.glb": {
    small: { scale: 150, y: 1.6 },
    medium: { scale: 300, y: 1.6 },
    large: { scale: 900, y: 1.6 },
  },
  "pearl_electron.glb": {
    small: { scale: 1, y: 1 },
    medium: { scale: 2, y: 2 },
    large: { scale: 4, y: 4 },
  },
  "stranger_star.glb": {
    small: { scale: 1, y: 3 },
    medium: { scale: 2, y: 3 },
    large: { scale: 4, y: 3 },
  },
  "cube_cascade.glb": {
    small: { scale: 0.5, y: 0.8 },
    medium: { scale: 1, y: 1.6 },
    large: { scale: 2, y: 6.2 },
  },
  "cyber_orb.glb": {
    small: { scale: 0.5, y: 0.8 },
    medium: { scale: 1, y: 1.6 },
    large: { scale: 5, y: 8 },
  },
  "magic_marble.glb": {
    small: { scale: 0.75, y: 3 },
    medium: { scale: 1.5, y: 3 },
    large: { scale: 3, y: 3 },
  },
  "cyber_spore.glb": {
    small: { scale: 1, y: 1.5 },
    medium: { scale: 2, y: 3 },
    large: { scale: 4, y: 6 },
  },
  "dark_matter.glb": {
    small: { scale: 2.5, y: 3 },
    medium: { scale: 5, y: 3 },
    large: { scale: 10, y: 3 },
  },
  "harlequin_orb.glb": {
    small: { scale: 0.5, y: 0.8 },
    medium: { scale: 1, y: 1.6 },
    large: { scale: 3, y: 4.8 },
  },
  "evanescent_smoke.glb": {
    small: { scale: 1, y: 3 },
    medium: { scale: 2, y: 5 },
    large: { scale: 4, y: 6 },
  },
  "lightning": {
    small: { scale: 1, y: 2 },
    medium: { scale: 2, y: 2 },
    large: { scale: 3, y: 2 },
  },
  "explosion_burst": {
    small: { scale: 1, y: 1.8 },
    medium: { scale: 2, y: 1.8 },
    large: { scale: 10, y: 1.8 },
  },
  "mist_cloud": {
    small: { scale: 1, y: 1.5 },
    medium: { scale: 2, y: 1.5 },
    large: { scale: 4, y: 1.5 },
  },
  "light_orb": {
    small: { scale: 0.75, y: 2.2 },
    medium: { scale: 1.5, y: 2.2 },
    large: { scale: 6, y: 7 },
  },
  "crystal_shard": {
    small: { scale: 0.8, y: 2.2 },
    medium: { scale: 1.6, y: 2.2 },
    large: { scale: 6.4, y: 3.5 },
  },
  "simple_ring": {
    small: { scale: 1, y: 2.5 },
    medium: { scale: 2, y: 2.5 },
    large: { scale: 5, y: 2.5 },
  },
};

//変更14
const ENABLE_ORIGIN_DEBUG = false;

function showDebug(text) {
  if (!ENABLE_ORIGIN_DEBUG && !isOriginDebugTestRoom) return;
  
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
    
    
    
    const toggleBtn = document.createElement("button");
toggleBtn.textContent = "折り畳む";
toggleBtn.style.fontSize = "12px";
toggleBtn.style.padding = "4px 8px";

toggleBtn.onclick = () => {
  const collapsed = panel.dataset.collapsed === "1";
  panel.dataset.collapsed = collapsed ? "0" : "1";

  if (pre) {
    pre.style.display = collapsed ? "" : "none";
  }

  toggleBtn.textContent = collapsed ? "折り畳む" : "開く";
};

    panel.append(pre, copyBtn, toggleBtn);
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

let originSocket = null;
let isOriginDebugTestRoom = false;


let onBattleHpReachedZero = null;


const ORIGIN_MAGIC_CIRCLE_MAX_HP = 100;

let battleState = {
  selfHp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
  enemyHp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
  lastCastAt: 0,
  processedCastIds: new Set(),

  gameEnded: false,
  endingStarted: false,
  winnerId: "",
  loserId: "",

  magicLogs: [],
};let tutorialModalDismissed = false;
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
    const hpText = Number.isFinite(Number(member.hp)) ? ` HP:${Math.max(0, Number(member.hp))}` : "";
    li.textContent = `${member.name}${member.role === "host" ? "（ホスト）" : ""}${hpText}`;
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



function getSocketIoClient() {
  if (typeof window === "undefined" || typeof window.io !== "function") {
    console.warn("[origin-magic-circle] socket.io client is not loaded");
    return null;
  }

  if (!originSocket) {
    originSocket = window.io();
  }

  return originSocket;
}

function emitWithAck(socket, eventName, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error("socket_missing"));
      return;
    }

    socket.timeout(timeoutMs).emit(eventName, payload, (error, response) => {
      if (error) {
        reject(error);
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "socket_request_failed"));
        return;
      }

      resolve(response);
    });
  });
}

function applyHpPayload(hpPayload) {
  if (!hpPayload) return;

  battleState.selfHp = Number.isFinite(Number(hpPayload.selfHp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(hpPayload.selfHp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP;

battleState.enemyHp = Number.isFinite(Number(hpPayload.enemyHp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(hpPayload.enemyHp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP;

  renderHpBars();

  if (!battleState.gameEnded && (battleState.selfHp <= 0 || battleState.enemyHp <= 0)) {
    onBattleHpReachedZero?.();
  }
}

async function joinOriginSocketRoom() {
  const socket = getSocketIoClient();
  if (!socket || !currentRoom?.roomId || !userTrackingId) return;

  const response = await emitWithAck(socket, "origin:join", {
    roomId: currentRoom.roomId,
    userTrackingId,
  });

  if (response.room) {
    currentRoom = response.room;
  }

  applyHpPayload(response.hp);
}

async function requestLatestHpBySocket() {
  const socket = getSocketIoClient();
  if (!socket || !currentRoom?.roomId || !userTrackingId) return;

  const response = await emitWithAck(socket, "origin:requestHp", {
    roomId: currentRoom.roomId,
    userTrackingId,
  });

  if (response.room) {
    currentRoom = response.room;
  }

  applyHpPayload(response.hp);
}


/*async function syncBattleHp() {
  if (!currentRoom?.roomId) return;
  try {
    const room = await callApi("/api/origin-magic-circle/rooms/hp", {
      roomId: currentRoom.roomId,
      userTrackingId,
      selfHp: battleState.selfHp,
      enemyHp: battleState.enemyHp,
    }, "POST");
    currentRoom = room;
  } catch (error) {
    console.warn("[origin-magic-circle] hp sync failed:", error);
  }
}*/

function showDamageNumber(amount, isEnemyCast) {
  const target = document.createElement("div");
  target.className = "damage-number";
  const safe = Math.max(1, Number(amount) || 1);
  const size = Math.min(92, 24 + Math.sqrt(safe) * 3);
  target.style.fontSize = `${size}px`;
  target.style.left = isEnemyCast ? "24vw" : "74vw";
  target.style.top = "18vh";
  target.textContent = `-${Math.round(safe)}`;
  refs.battleView?.appendChild(target);
  setTimeout(() => target.remove(), 900);
}

function ensureTutorialModal() {
  if (document.getElementById("battleTutorialModal")) return;
  if (localStorage.getItem(ORIGIN_TUTORIAL_DISMISSED_KEY) === "1") return;

  const modal = document.createElement("div");
  modal.id = "battleTutorialModal";
  modal.className = "battle-tutorial-modal";
  modal.textContent = "魔法陣を描き相手を倒せ！";
  refs.battleView?.appendChild(modal);
}

function hideTutorialModal() {
  tutorialModalDismissed = true;
  localStorage.setItem(ORIGIN_TUTORIAL_DISMISSED_KEY, "1");
  document.getElementById("battleTutorialModal")?.remove();
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



function showMagicNameCenter(magicName, isEnemy = false, onComplete = null) {
  const old = document.getElementById("magicNameCenterOverlay");
  if (old) old.remove();
  const overlay = document.createElement("div");
  overlay.id = "magicNameCenterOverlay";
  overlay.className = `magic-name-banner${isEnemy ? " enemy" : ""}`;
  overlay.textContent = magicName || "無名の魔法";
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.remove();
    if (typeof onComplete === "function") onComplete();
  }, 2200);
}


function showRoomIdModal() {
  return new Promise((resolve) => {
    const old = document.getElementById("roomIdInputModal");
    if (old) old.remove();

    const modal = document.createElement("div");
    modal.id = "roomIdInputModal";
    modal.className = "room-id-modal";
    modal.innerHTML = `
      <div class="room-id-modal__backdrop"></div>
      <div class="room-id-modal__card">
        <h3>ルーム入室</h3>
        <p>6桁のルームIDを入力してください</p>
        <input class="room-id-modal__input" inputmode="numeric" maxlength="6" placeholder="123456" />
        <div class="room-id-modal__actions">
          <button type="button" class="room-id-modal__cancel">キャンセル</button>
          <button type="button" class="room-id-modal__ok">入室</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector(".room-id-modal__input");
    const okBtn = modal.querySelector(".room-id-modal__ok");
    const cancelBtn = modal.querySelector(".room-id-modal__cancel");

    const close = (value) => {
      modal.remove();
      resolve(value);
    };

    input.focus();

    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 6);
    });

    okBtn.addEventListener("click", () => {
      const value = input.value.trim();
      close(value || null);
    });

    cancelBtn.addEventListener("click", () => close(null));

    modal.querySelector(".room-id-modal__backdrop").addEventListener("click", () => close(null));

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        close(input.value.trim() || null);
      }
      if (event.key === "Escape") {
        close(null);
      }
    });
  });
}




function createOriginDebugTestRoom() {
  return {
    roomId: "000000",
    members: [
      {
        name: username || "player",
        id: userTrackingId,
        role: "host",
        hp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
      },
      {
        name: "bot",
        id: "origin-debug-bot",
        role: "guest",
        hp: ORIGIN_MAGIC_CIRCLE_MAX_HP,
      },
    ],
    status: "対戦中",
    expiresAt: Date.now() + 60 * 60 * 1000,
    isDebugTestRoom: true,
  };
}




function setupMagicCircleUi(container, options = {}) {
  const {
    onMagicJsonReady = null,
    hideTopModalOnce = null,
    hideDebugOnce = null,
  } = options;
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

// 追加：一筆ごとの座標保存
const strokeList = [];
let currentStroke = null;


  let ritualController = null;
  //let spinStartTs = 0;

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

  const snapshot = history[historyIndex];

  if (!snapshot?.image) {
    restoreStrokeList([]);
    updateButtons();
    return;
  }

  restoreStrokeList(snapshot.strokes || []);

  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.drawImage(img, 0, 0, overlay.width, overlay.height);
    updateButtons();
  };
  img.src = snapshot.image;
};



  const commitState = () => {
  const snapshot = {
    image: overlay.toDataURL("image/png"),
    strokes: cloneStrokeList(),
  };

  history.splice(historyIndex + 1);
  history.push(snapshot);
  historyIndex = history.length - 1;
  updateButtons();
};

  const getPos = (event) => {
    const rect = overlay.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  
  
  
  
  
  const normalizeStrokePoint = (point) => {
  return [
    Math.round(point.x),
    Math.round(point.y),
  ];
};

const appendPointToCurrentStroke = (point) => {
  if (!currentStroke) return;

  const [x, y] = normalizeStrokePoint(point);

  // 直前と同じ座標なら保存しない
  const len = currentStroke.length;
  if (len >= 2) {
    const lastX = currentStroke[len - 2];
    const lastY = currentStroke[len - 1];

    const dx = x - lastX;
    const dy = y - lastY;

    // 近すぎる点は間引く。保存量をかなり減らせる
    if (dx * dx + dy * dy < 9) return;
  }

  currentStroke.push(x, y);
};

const cloneStrokeList = () => {
  return strokeList.map((stroke) => stroke.slice());
};

const restoreStrokeList = (strokes) => {
  strokeList.length = 0;

  if (!Array.isArray(strokes)) return;

  strokes.forEach((stroke) => {
    if (Array.isArray(stroke) && stroke.length >= 4) {
      strokeList.push(stroke.slice());
    }
  });
};

const getTrimmedMagicCircleData = () => {
  if (!ctx) {
    return {
      base64ImageFile: "",
      strokeJson: "",
    };
  }

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

  if (maxX < minX || maxY < minY) {
    return {
      base64ImageFile: "",
      strokeJson: "",
    };
  }

  const padding = 12;

  const trimLeft = Math.max(0, minX - padding);
  const trimTop = Math.max(0, minY - padding);
  const trimRight = Math.min(width - 1, maxX + padding);
  const trimBottom = Math.min(height - 1, maxY + padding);

  const trimWidth = trimRight - trimLeft + 1;
  const trimHeight = trimBottom - trimTop + 1;

  const cropped = document.createElement("canvas");
  cropped.width = trimWidth;
  cropped.height = trimHeight;

  const croppedCtx = cropped.getContext("2d");
  if (!croppedCtx) {
    return {
      base64ImageFile: "",
      strokeJson: "",
    };
  }

  croppedCtx.fillStyle = "#ffffff";
  croppedCtx.fillRect(0, 0, trimWidth, trimHeight);
  croppedCtx.putImageData(
    ctx.getImageData(trimLeft, trimTop, trimWidth, trimHeight),
    0,
    0
  );

  const trimmedStrokes = strokeList
    .map((stroke) => {
      if (!Array.isArray(stroke)) return [];

      const next = [];
      const usableLength = stroke.length - (stroke.length % 2);

      for (let i = 0; i < usableLength; i += 2) {
        const x = Math.round(Number(stroke[i]) - trimLeft);
        const y = Math.round(Number(stroke[i + 1]) - trimTop);

        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        const clampedX = Math.max(0, Math.min(trimWidth - 1, x));
        const clampedY = Math.max(0, Math.min(trimHeight - 1, y));

        next.push(clampedX, clampedY);
      }

      return next;
    })
    .filter((stroke) => stroke.length >= 4);

  const strokePayload = {
    w: trimWidth,
    h: trimHeight,
    strokes: trimmedStrokes,
  };

  return {
    base64ImageFile: cropped
      .toDataURL("image/png")
      .replace(/^data:image\/png;base64,/, ""),
    strokeJson: JSON.stringify(strokePayload),
  };
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

  if (!activeSnapshot?.image) {
    ctx?.clearRect(0, 0, overlay.width, overlay.height);
    return;
  }

  const img = new Image();
  img.onload = () => {
    ctx?.clearRect(0, 0, overlay.width, overlay.height);
    ctx?.drawImage(img, 0, 0, overlay.width, overlay.height);
  };
  img.src = activeSnapshot.image;
};

  overlay.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (activePointerId !== null) return;
    activePointerId = event.pointerId;
    overlay.setPointerCapture(event.pointerId);
    configureCtx();
    lastPoint = getPos(event);
    
    
    
    currentStroke = [];
appendPointToCurrentStroke(lastPoint);



    ctx?.beginPath();
    ctx?.moveTo(lastPoint.x, lastPoint.y);
    ctx?.lineTo(lastPoint.x + 0.01, lastPoint.y + 0.01);
    ctx?.stroke();
  });

  overlay.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId || !lastPoint) return;
    const point = getPos(event);

appendPointToCurrentStroke(point);

ctx?.beginPath();
ctx?.moveTo(lastPoint.x, lastPoint.y);
ctx?.lineTo(point.x, point.y);
ctx?.stroke();
lastPoint = point;
  });

  const finishStroke = (event) => {
  if (event.pointerId !== activePointerId) return;

  if (lastPoint) {
    appendPointToCurrentStroke(lastPoint);
  }

  if (currentStroke && currentStroke.length >= 4) {
    strokeList.push(currentStroke);
  }

  currentStroke = null;
  activePointerId = null;
  lastPoint = null;

  commitState();
};

  overlay.addEventListener("pointerup", finishStroke);
  overlay.addEventListener("pointercancel", finishStroke);

  
  
  
  
  undoBtn.addEventListener("click", () => {
  if (isChanting) return;
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  restoreState();
});

redoBtn.addEventListener("click", () => {
  if (isChanting) return;
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  restoreState();
});

clearBtn.addEventListener("click", () => {
  if (isChanting) return;
  if (historyIndex <= 0) return;

  ctx?.clearRect(0, 0, overlay.width, overlay.height);

  strokeList.length = 0;
  currentStroke = null;

  commitState();
});

  
  
  
  
  
  
  const resetCanvasAndHistory = () => {
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  overlay.style.transition = "";
  overlay.style.transform = "";


strokeList.length = 0;
currentStroke = null;


  history.length = 0;
  historyIndex = -1;
  commitState();
  updateButtons();
};

const sampleDrawnPixels = (maxParticles = 900) => {
  if (!ctx) return [];

  const imageData = ctx.getImageData(0, 0, overlay.width, overlay.height);
  const { data, width, height } = imageData;

  const points = [];
  const step = Math.max(2, Math.floor(Math.sqrt((width * height) / maxParticles) / 2));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];

      if (alpha > 20) {
        points.push({
          x: x + (Math.random() - 0.5) * 2,
          y: y + (Math.random() - 0.5) * 2,
        });
      }
    }
  }

  if (points.length <= maxParticles) return points;

  const sampled = [];
  for (let i = 0; i < maxParticles; i += 1) {
    sampled.push(points[Math.floor(Math.random() * points.length)]);
  }

  return sampled;
};







const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

const randomBetween = (min, max) => {
  return min + Math.random() * (max - min);
};

const lerp = (a, b, t) => {
  return a + (b - a) * t;
};

const createRuneStrokeTemplate = () => {
  const strokes = [];

  // 中央の縦芯。これがあるだけで一気にルーン文字っぽくなる
  strokes.push({
    x1: randomBetween(-0.08, 0.08),
    y1: -0.46,
    x2: randomBetween(-0.08, 0.08),
    y2: 0.46,
  });

  const branchCount = Math.floor(randomBetween(2, 5));

  for (let i = 0; i < branchCount; i += 1) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const y1 = randomBetween(-0.38, 0.3);
    const y2 = clamp(y1 + randomBetween(-0.22, 0.28), -0.48, 0.48);
    const x1 = randomBetween(-0.04, 0.04);
    const x2 = side * randomBetween(0.22, 0.46);

    strokes.push({ x1, y1, x2, y2 });
  }

  // たまに横棒・斜め貫通を足す
  if (Math.random() < 0.55) {
    strokes.push({
      x1: randomBetween(-0.36, -0.14),
      y1: randomBetween(-0.18, 0.18),
      x2: randomBetween(0.14, 0.36),
      y2: randomBetween(-0.18, 0.18),
    });
  }

  // たまに下部の足
  if (Math.random() < 0.5) {
    const side = Math.random() < 0.5 ? -1 : 1;
    strokes.push({
      x1: 0,
      y1: 0.28,
      x2: side * randomBetween(0.18, 0.42),
      y2: 0.48,
    });
  }

  return strokes;
};

const createRuneSentenceLayout = (particleCount) => {
  const width = overlay.width;
  const height = overlay.height;

  // 文字数は粒子数から決める。
  // 1文字あたり40〜55粒くらいあると、文字として見えやすい。
  const glyphCount = clamp(Math.floor(particleCount / 46), 7, 34);

  const marginX = width * 0.08;
  const usableWidth = width - marginX * 2;

  const fontSize = clamp(usableWidth / glyphCount * 1.05, 34, 72);
  const gap = fontSize * 0.78;

  const charsPerLine = Math.max(6, Math.floor(usableWidth / gap));
  const lineCount = Math.ceil(glyphCount / charsPerLine);

  const startY = height * 0.5 - ((lineCount - 1) * fontSize * 1.2) / 2;

  const glyphs = [];

  for (let i = 0; i < glyphCount; i += 1) {
    const line = Math.floor(i / charsPerLine);
    const indexInLine = i % charsPerLine;

    const glyphsInThisLine = Math.min(charsPerLine, glyphCount - line * charsPerLine);
    const lineWidth = (glyphsInThisLine - 1) * gap;

    const x = width * 0.5 - lineWidth / 2 + indexInLine * gap;
    const y = startY + line * fontSize * 1.2;

    glyphs.push({
      index: i,
      x,
      y,
      size: fontSize * randomBetween(0.88, 1.12),
      rotation: randomBetween(-0.18, 0.18),
      strokes: createRuneStrokeTemplate(),
    });
  }

  return glyphs;
};

const pointOnRuneStroke = (glyph, stroke) => {
  const t = Math.random();

  const localX = lerp(stroke.x1, stroke.x2, t) * glyph.size;
  const localY = lerp(stroke.y1, stroke.y2, t) * glyph.size;

  const jitter = glyph.size * 0.035;
  const jx = randomBetween(-jitter, jitter);
  const jy = randomBetween(-jitter, jitter);

  const cos = Math.cos(glyph.rotation);
  const sin = Math.sin(glyph.rotation);

  const rx = (localX + jx) * cos - (localY + jy) * sin;
  const ry = (localX + jx) * sin + (localY + jy) * cos;

  return {
    x: glyph.x + rx,
    y: glyph.y + ry,
  };
};

const createRuneTargetsForGlyph = (glyph, count) => {
  const targets = [];

  for (let i = 0; i < count; i += 1) {
    const stroke = glyph.strokes[i % glyph.strokes.length];
    targets.push(pointOnRuneStroke(glyph, stroke));
  }

  return targets;
};

const createRuneSentenceTargets = (particleCount) => {
  const glyphs = createRuneSentenceLayout(particleCount);

  const result = [];
  const basePerGlyph = Math.floor(particleCount / glyphs.length);
  let remaining = particleCount;

  glyphs.forEach((glyph, glyphIndex) => {
    const isLast = glyphIndex === glyphs.length - 1;
    const count = isLast ? remaining : basePerGlyph;
    remaining -= count;

    const targets = createRuneTargetsForGlyph(glyph, count);

    targets.forEach((target) => {
      result.push({
        x: target.x,
        y: target.y,
        glyphIndex,
      });
    });
  });

  while (result.length < particleCount) {
    const glyphIndex = Math.floor(Math.random() * glyphs.length);
    const target = createRuneTargetsForGlyph(glyphs[glyphIndex], 1)[0];
    result.push({
      x: target.x,
      y: target.y,
      glyphIndex,
    });
  }

  return {
    glyphs,
    targets: result.slice(0, particleCount),
  };
};

const mutateOneRuneGlyph = (glyph) => {
  return {
    ...glyph,
    rotation: randomBetween(-0.2, 0.2),
    strokes: createRuneStrokeTemplate(),
  };
};

const startGlyphRitualAnimation = () => {
  if (!ctx) return null;

  const sourcePoints = sampleDrawnPixels(950);
  if (!sourcePoints.length) return null;

  const runeSentence = createRuneSentenceTargets(sourcePoints.length);
  let glyphs = runeSentence.glyphs;
  const targetPoints = runeSentence.targets;

  const startedAt = performance.now();

  const particles = sourcePoints.map((p, index) => {
    const target = targetPoints[index] || {
      x: overlay.width / 2,
      y: overlay.height / 2,
      glyphIndex: 0,
    };

    const angle = Math.random() * Math.PI * 2;
    const scatterDistance = 70 + Math.random() * 180;

    return {
      x: p.x,
      y: p.y,

      sx: p.x,
      sy: p.y,

      mx: p.x + Math.cos(angle) * scatterDistance,
      my: p.y + Math.sin(angle) * scatterDistance,

      tx: target.x,
      ty: target.y,

      fromX: p.x,
      fromY: p.y,
      nextX: target.x,
      nextY: target.y,

      glyphIndex: target.glyphIndex,

      size: 1.7 + Math.random() * 1.4,
      alpha: 0.72 + Math.random() * 0.28,
      jitter: Math.random() * Math.PI * 2,

      // 文字ごとに少し違う呼吸感
      pulseSeed: Math.random() * Math.PI * 2,
    };
  });

  let rafId = null;
  let finished = false;
  let finishing = false;
  let finishStartedAt = 0;
  let finishResolve = null;

  let nextRuneMorphAt = startedAt + 800 + Math.random() * 900;
  let morphStartedAt = 0;
  let morphDuration = 420;
  let morphingGlyphIndex = -1;
  let isMorphing = false;

  const ease = (t) => {
    const v = Math.max(0, Math.min(1, t));
    return v * v * (3 - 2 * v);
  };

  const beginOneRuneMorph = (now) => {
    if (!glyphs.length) return;

    morphingGlyphIndex = Math.floor(Math.random() * glyphs.length);
    glyphs[morphingGlyphIndex] = mutateOneRuneGlyph(glyphs[morphingGlyphIndex]);

    const targetParticles = particles.filter((p) => p.glyphIndex === morphingGlyphIndex);
    const newTargets = createRuneTargetsForGlyph(glyphs[morphingGlyphIndex], targetParticles.length);

    targetParticles.forEach((p, index) => {
      const target = newTargets[index] || { x: p.x, y: p.y };

      p.fromX = p.x;
      p.fromY = p.y;
      p.nextX = target.x;
      p.nextY = target.y;
    });

    morphStartedAt = now;
    morphDuration = 340 + Math.random() * 520;
    isMorphing = true;

    // 「文字毎に不定期」なので、全文一括ではなく、次の1文字変化まで少し待つ
    nextRuneMorphAt = now + morphDuration + 260 + Math.random() * 760;
  };

  const drawRuneConnectionLines = (now, finalGlowRate, vanishRate) => {
    // 点だけだと文字に見えにくいので、同じ文字内の粒子を近距離だけ線で結ぶ
    const alpha = Math.max(0, 1 - vanishRate);

    ctx.lineWidth = 1.15;

    if (finishing) {
      ctx.strokeStyle = `rgba(215, 120, 255, ${0.36 * alpha})`;
      ctx.shadowColor = "rgba(210, 120, 255, 0.95)";
      ctx.shadowBlur = 10 + finalGlowRate * 20;
    } else {
      ctx.strokeStyle = `rgba(15, 10, 25, ${0.32 * alpha})`;
      ctx.shadowColor = "rgba(120, 70, 180, 0.22)";
      ctx.shadowBlur = 2;
    }

    const byGlyph = new Map();

    particles.forEach((p) => {
      if (!byGlyph.has(p.glyphIndex)) byGlyph.set(p.glyphIndex, []);
      byGlyph.get(p.glyphIndex).push(p);
    });

    byGlyph.forEach((list) => {
      for (let i = 1; i < list.length; i += 2) {
        const a = list[i - 1];
        const b = list[i];

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq > 900) continue;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    });

    ctx.shadowBlur = 0;
  };

  const drawParticle = (p, now, finalGlowRate, vanishRate) => {
    const breathe = 1 + Math.sin(now * 0.004 + p.pulseSeed) * 0.18;
    const wiggleX = Math.sin(now * 0.005 + p.jitter) * 0.7;
    const wiggleY = Math.cos(now * 0.004 + p.jitter) * 0.7;

    const alpha = Math.max(0, p.alpha * (1 - vanishRate));

    if (finishing) {
      ctx.fillStyle = `rgba(225, 135, 255, ${alpha})`;
      ctx.shadowColor = "rgba(210, 120, 255, 0.98)";
      ctx.shadowBlur = 10 + finalGlowRate * 24;
    } else {
      ctx.fillStyle = `rgba(8, 6, 16, ${alpha})`;
      ctx.shadowColor = "rgba(95, 60, 150, 0.28)";
      ctx.shadowBlur = 2;
    }

    ctx.beginPath();
    ctx.arc(
      p.x + wiggleX,
      p.y + wiggleY,
      p.size * breathe,
      0,
      Math.PI * 2
    );
    ctx.fill();
  };

  const draw = (now) => {
    if (!ctx || finished) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const elapsed = now - startedAt;

    let finalGlowRate = 0;
    let vanishRate = 0;

    if (finishing) {
      finalGlowRate = ease((now - finishStartedAt) / 420);
      vanishRate = ease(Math.max(0, now - finishStartedAt - 560) / 560);
    }

    if (!finishing && now >= nextRuneMorphAt) {
      beginOneRuneMorph(now);
    }

    if (isMorphing) {
      const t = ease((now - morphStartedAt) / morphDuration);

      particles.forEach((p) => {
        if (p.glyphIndex !== morphingGlyphIndex) return;

        p.x = p.fromX + (p.nextX - p.fromX) * t;
        p.y = p.fromY + (p.nextY - p.fromY) * t;

        if (t >= 1) {
          p.tx = p.nextX;
          p.ty = p.nextY;
        }
      });

      if (t >= 1) {
        isMorphing = false;
        morphingGlyphIndex = -1;
      }
    }

    // 初期変形：魔法陣 → 散らばる → 左から並んだルーン文章
    const formT = ease(elapsed / 1350);

    particles.forEach((p) => {
      if (formT < 0.38) {
        const t = ease(formT / 0.38);
        p.x = p.sx + (p.mx - p.sx) * t;
        p.y = p.sy + (p.my - p.sy) * t;
      } else if (!isMorphing || p.glyphIndex !== morphingGlyphIndex) {
        const t = ease((formT - 0.38) / 0.62);
        p.x = p.mx + (p.tx - p.mx) * t;
        p.y = p.my + (p.ty - p.my) * t;
      }
    });

    // 先に線、後から粒子。これで「点群」ではなく「文字」に見えやすくなる
    drawRuneConnectionLines(now, finalGlowRate, vanishRate);

    particles.forEach((p) => {
      drawParticle(p, now, finalGlowRate, vanishRate);
    });

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (finishing && vanishRate >= 1) {
      finished = true;
      cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      finishResolve?.();
      return;
    }

    rafId = requestAnimationFrame(draw);
  };

  ctx.clearRect(0, 0, overlay.width, overlay.height);
  rafId = requestAnimationFrame(draw);

  return {
    finish() {
      return new Promise((resolve) => {
        if (finished) {
          resolve();
          return;
        }

        finishing = true;
        finishStartedAt = performance.now();
        finishResolve = resolve;
      });
    },

    cancel() {
      finished = true;
      if (rafId) cancelAnimationFrame(rafId);
      ctx?.clearRect(0, 0, overlay.width, overlay.height);
    },
  };
};

const finishGlyphRitualAnimation = async () => {
  if (!ritualController) {
    resetCanvasAndHistory();
    return;
  }

  try {
    await ritualController.finish();
  } finally {
    ritualController = null;
    resetCanvasAndHistory();
  }
};

const cancelGlyphRitualAnimation = () => {
  ritualController?.cancel();
  ritualController = null;
  resetCanvasAndHistory();
};





  chantBtn.addEventListener("click", async () => {
  hideTutorialModal();

  if (isChanting) return;
  isChanting = true;
  updateButtons();

  try {
    const {
  base64ImageFile,
  strokeJson,
} = getTrimmedMagicCircleData();

if (!base64ImageFile) {
  alert("魔法陣を描いてください。");
  return;
}

ritualController = startGlyphRitualAnimation();

const res = await fetch("/api/origin-magic-circle/chant-title", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    base64ImageFile,
    strokeJson,
  }),
});

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "chant_failed");

    await finishGlyphRitualAnimation();

    const magicEffectJson = data.magicEffectJson || null;

    if (typeof onMagicJsonReady === "function" && magicEffectJson) {
      await onMagicJsonReady(magicEffectJson, {
        strokeJson: data.strokeJson || strokeJson,
        spellHash: data.imageHash || "",
      });
      hideTopModalOnce?.();
      hideTutorialModal();
      hideDebugOnce?.();
    } else {
      resultText.textContent = data.title || "無題";
      resultModal.classList.remove("hidden");
    }
  } catch (error) {
    console.error("[origin-magic-circle] chant failed:", error);
    cancelGlyphRitualAnimation();
    alert("詠唱に失敗しました。");
  } finally {
    isChanting = false;
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



function ensureHpBars() {
  if (document.getElementById("hpBars")) return;

  const enemy = (currentRoom?.members || []).find((m) => m.id !== userTrackingId);
  const wrap = document.createElement("div");
  wrap.id = "hpBars";
  wrap.className = "hp-bars";
  wrap.innerHTML = `
    <div class="hp-card">
      <div class="hp-label">${username}</div>
      <div class="hp-track">
        <div id="selfHpFill" class="hp-fill self"></div>
        <div id="selfHpValue" class="hp-value">${ORIGIN_MAGIC_CIRCLE_MAX_HP}/${ORIGIN_MAGIC_CIRCLE_MAX_HP}</div>
      </div>
    </div>
    <div class="hp-card">
      <div class="hp-label">${enemy?.name || "相手"}</div>
      <div class="hp-track">
        <div id="enemyHpFill" class="hp-fill enemy"></div>
        <div id="enemyHpValue" class="hp-value">${ORIGIN_MAGIC_CIRCLE_MAX_HP}/${ORIGIN_MAGIC_CIRCLE_MAX_HP}</div>
      </div>
    </div>
  `;
  refs.battleView.appendChild(wrap);
}

function renderHpBars() {
  ensureHpBars();

  const sf = document.getElementById("selfHpFill");
  const ef = document.getElementById("enemyHpFill");
  const sv = document.getElementById("selfHpValue");
  const ev = document.getElementById("enemyHpValue");

  if (sf) sf.style.width = `${(battleState.selfHp / ORIGIN_MAGIC_CIRCLE_MAX_HP) * 100}%`;
if (ef) ef.style.width = `${(battleState.enemyHp / ORIGIN_MAGIC_CIRCLE_MAX_HP) * 100}%`;
if (sv) sv.textContent = `${battleState.selfHp}/${ORIGIN_MAGIC_CIRCLE_MAX_HP}`;
if (ev) ev.textContent = `${battleState.enemyHp}/${ORIGIN_MAGIC_CIRCLE_MAX_HP}`;

}




function calculateMagicTotalDamage(effectJson) {
  const maxDamage = Math.min(
    ORIGIN_MAGIC_CIRCLE_MAX_HP,
    Math.max(0, Number(effectJson?.artScore) || 0)
  );

  const damageTimings = Array.isArray(effectJson?.damageTimings)
    ? effectJson.damageTimings
    : [];

  const total = damageTimings.reduce((sum, timing) => {
    const weight = Math.max(0, Number(timing?.damageWeight) || 0);
    return sum + Math.round(maxDamage * (weight / 100));
  }, 0);

  return Math.max(0, total);
}





function addMagicLogFromCast(cast) {
  if (!cast?.id) return;

  if (battleState.magicLogs.some((log) => log.id === cast.id)) return;

  const magicEffectJson = cast.magicEffectJson || null;

  battleState.magicLogs.push({
    id: cast.id,
    at: Number(cast.at) || Date.now(),
    casterId: String(cast.casterId || ""),
    casterName: String(cast.casterName || "unknown"),
    spellHash: String(cast.spellHash || cast.imageHash || "").trim(),
    magicName: String(magicEffectJson?.magicName || "無名の魔法"),
    totalDamage: calculateMagicTotalDamage(magicEffectJson),
    strokeJson: String(cast.strokeJson || ""),
  });

  battleState.magicLogs.sort((a, b) => a.at - b.at);
}






function hydrateBattleHpFromRoom() {
  const members = currentRoom?.members || [];
  const self = members.find((member) => member.id === userTrackingId);
  const enemy = members.find((member) => member.id !== userTrackingId);

  battleState.selfHp = Number.isFinite(Number(self?.hp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(self.hp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP;

battleState.enemyHp = Number.isFinite(Number(enemy?.hp))
  ? Math.max(0, Math.min(ORIGIN_MAGIC_CIRCLE_MAX_HP, Number(enemy.hp)))
  : ORIGIN_MAGIC_CIRCLE_MAX_HP;
}




function isBattleAlreadyFinished() {
  return battleState.selfHp <= 0 || battleState.enemyHp <= 0;
}

function getSelfWonFromCurrentHp() {
  return battleState.selfHp > 0 && battleState.enemyHp <= 0;
}




async function startThreeBattleScene() {
  if (battleStarted) return;
  battleStarted = true;
  stopRefresh();

  refs.page?.classList.add("hidden");
  refs.battleView?.classList.remove("hidden");
  //hydrateBattleHpFromRoom();

  // 再読込時に、過去の魔法を再処理しない
  battleState.lastCastAt = Date.now();
  battleState.processedCastIds = new Set();

  //ensureTutorialModal();



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



hydrateBattleHpFromRoom();
renderHpBars();

if (!isOriginDebugTestRoom) {
  try {
    await joinOriginSocketRoom();
    await requestLatestHpBySocket();

    if (isBattleAlreadyFinished()) {
      await showReloadedBattleResultScreen();
      return;
    }
  } catch (error) {
    console.warn("[origin-magic-circle] socket hp init failed:", error);

    if (isBattleAlreadyFinished()) {
      await showReloadedBattleResultScreen();
      return;
    }
  }
}



ensureTutorialModal();
  
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
  let topControls = null;
  let hasHiddenDebugPanel = false;
  let hasHiddenTopModal = false;
  
  
  
  const magicCircleUi = setupMagicCircleUi(refs.battleView, {
  onMagicJsonReady: async (effectJson, meta = {}) => {
    const spellHash = String(meta.spellHash || "").trim();
    const strokeJson = String(meta.strokeJson || "");

    // テスト部屋はサーバーに送らず、ローカルだけでログ保存
    if (isOriginDebugTestRoom) {
      const localCast = {
        id: `${Date.now()}_${Math.random()}`,
        at: Date.now(),
        roomId: currentRoom?.roomId || "",
        casterId: userTrackingId,
        casterName: username,
        magicEffectJson: effectJson,
        strokeJson,
        spellHash,
      };

      addMagicLogFromCast(localCast);

      if (battleState.gameEnded) return;

      showMagicNameCenter(effectJson.magicName, false, () => {
        if (battleState.gameEnded) return;
        playMagicVisualEffects(effectJson, false);
      });

      return;
    }

    const socket = getSocketIoClient();
    let sentCast = null;

    try {
      const response = await emitWithAck(socket, "origin:cast", {
        roomId: currentRoom?.roomId,
        casterId: userTrackingId,
        casterName: username,
        magicEffectJson: effectJson,
        strokeJson,
        spellHash,
        imageHash: spellHash,
      });

      sentCast = response.cast || null;
    } catch (error) {
      console.warn("[origin-magic-circle] socket cast failed, fallback to fetch:", error);

      const res = await fetch("/api/origin-magic-circle/casts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: currentRoom?.roomId,
          casterId: userTrackingId,
          casterName: username,
          magicEffectJson: effectJson,
          strokeJson,
          spellHash,
          imageHash: spellHash,
        }),
      });

      const data = await res.json().catch(() => ({}));
      sentCast = data.cast || null;
    }

    if (sentCast) {
      addMagicLogFromCast(sentCast);
    }

    if (battleState.gameEnded) return;

    showMagicNameCenter(effectJson.magicName, false, () => {
      if (battleState.gameEnded) return;
      playMagicVisualEffects(effectJson, false);
    });
  },

  hideTopModalOnce: () => {
    if (hasHiddenTopModal || !topControls) return;
    topControls.style.display = "none";
    hasHiddenTopModal = true;
  },

  hideDebugOnce: () => {
    if (hasHiddenDebugPanel) return;
    const debugPanel = document.getElementById("debugPanel");
    if (debugPanel) debugPanel.style.display = "none";
    hasHiddenDebugPanel = true;
  },
});







  const hemiLight = new HemisphereLight(0xbad8ff, 0x5d4430, 1.1);
  scene.add(hemiLight);

  const dirLight = new DirectionalLight(0xffffff, 1.35);
  dirLight.position.set(40, 60, 15);
  scene.add(dirLight);

const loader = new GLTFLoader();

let wastelandGltf;
let characterGltf;
let pedestalGltf;

const summonAssetRoots = new Map();
const summonAssetSources = new Map();
const activeMagicObjects = [];
const activeMagicMixers = [];
const summonAssetAnimationInfo = new Map();
const summonAssetMixers = [];
const assetLoadPromises = new Map();
const clock = new Clock();

async function ensureSummonAssetLoaded(assetName, { urgent = false } = {}) {
  if (customEffectNames.has(assetName)) {
    if (!summonAssetSources.has(assetName)) {
      summonAssetSources.set(assetName, {
        assetName,
        gltf: null,
        isCustom: true,
      });
    }
    return null;
  }

  const existing = summonAssetSources.get(assetName);
  if (existing?.gltf) return existing.gltf;

  if (assetLoadPromises.has(assetName)) {
    return assetLoadPromises.get(assetName);
  }

  const promise = loader.loadAsync(`/3D素材/${assetName}`).then((gltf) => {
    summonAssetSources.set(assetName, {
      assetName,
      gltf,
      isCustom: false,
    });

    summonAssetAnimationInfo.set(
      assetName,
      gltf.animations.map((clip) => ({
        name: clip.name,
        duration: clip.duration,
        trackCount: clip.tracks.length,
        trackNames: clip.tracks.slice(0, 10).map((track) => track.name),
      }))
    );

    return gltf;
  });

  assetLoadPromises.set(assetName, promise);
  return promise;
}

function getAssetNamesFromMagicJson(effectJson) {
  const names = new Set();

  for (const timed of effectJson?.timedVisualEffects || []) {
    for (const obj of timed?.visualObjects || []) {
      if (summonAssetOptions.includes(obj?.assetFileName)) {
        names.add(obj.assetFileName);
      }
    }
  }

  return [...names];
}

async function ensureMagicJsonAssetsLoaded(effectJson) {
  const names = getAssetNamesFromMagicJson(effectJson);

  for (const name of names) {
    await ensureSummonAssetLoaded(name, { urgent: true });
  }
}

async function preloadSummonAssetsOneByOne() {
  for (const assetName of summonAssetOptions) {
    await ensureSummonAssetLoaded(assetName);
  }
}

try {
  wastelandGltf = await loader.loadAsync("/3D素材/arid_wasteland.glb");
  characterGltf = await loader.loadAsync("/3D素材/ancient_character.glb");
  pedestalGltf = await loader.loadAsync("/3D素材/pedestal.glb");

  preloadSummonAssetsOneByOne();
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



function applyCommonGlbMaterialFix(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat) => {
      if (mat.color && mat.color.getHexString?.() === "000000" && mat.map) {
        mat.color.set(0xffffff);
      }

      if (mat.map) {
        mat.map.colorSpace = SRGBColorSpace;
        mat.map.needsUpdate = true;
      }

      mat.side = DoubleSide;
      mat.needsUpdate = true;
    });
  });
}

function applyGlbEffectVisibilityFix(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material) ? child.material : [child.material];

    mats.forEach((mat) => {
      if (mat.color && mat.color.getHexString?.() === "000000" && mat.map) {
        mat.color.set(0xffffff);
      }

      if (mat.map) {
        mat.map.colorSpace = SRGBColorSpace;
        mat.map.needsUpdate = true;
      }

      mat.transparent = true;
      mat.depthWrite = false;
      mat.side = DoubleSide;
      mat.toneMapped = false;

      if (mat.emissive) {
        mat.emissive.set(0xffffff);
        mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0, 1.8);
      }

      mat.needsUpdate = true;
    });
  });
}

function applySoftEffectMaterialFix(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];

    mats.forEach((mat) => {
      if (mat.map) {
        mat.map.colorSpace = SRGBColorSpace;
        mat.map.needsUpdate = true;
      }

      mat.transparent = true;
      mat.depthWrite = false;
      mat.side = DoubleSide;

      // 元気玉化の主原因。Bloomに拾われすぎないよう戻す
      mat.toneMapped = true;

      // 白飛びしやすい加算表現を避ける
      mat.blending = NormalBlending;

      if (mat.emissive) {
        mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
      }

      // alphaTestが高すぎる素材はエフェクトが欠けるので少し下げる
      if (typeof mat.alphaTest === "number" && mat.alphaTest > 0.5) {
        mat.alphaTest = 0.15;
      }

      mat.needsUpdate = true;
    });
  });
}

function applyAssetSpecificTransform(root, assetName) {
  if (assetName === "broken_steampunk_clock.glb") {
    root.rotation.y = Math.PI / 2;
  }

  if (assetName === "gun-bot_with_walk_and_idle_animation.glb") {
    root.rotation.y = Math.PI;
  }

  if (assetName === "soulsucker_-_weaponcraft.glb") {
    root.rotation.z = -Math.PI / 2;
  }
}

function applyAssetSpecificMaterialFix(root, assetName) {
  applyCommonGlbMaterialFix(root);

  const strongBloomAssets = new Set([
    "evanescent_plasma.glb",
    "cyber_spore.glb",
    "dark_matter.glb",
    "evanescent_smoke.glb",
  ]);

  const softEffectAssets = new Set([
    "pearl_electron.glb",
    "stranger_star.glb",
    "magic_marble.glb",
  ]);

  if (strongBloomAssets.has(assetName)) {
    applyGlbEffectVisibilityFix(root);
  }

  if (softEffectAssets.has(assetName)) {
    applySoftEffectMaterialFix(root);
  }
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
function getPreferredAnimationClip(assetName, animations = []) {
  if (!animations.length) return null;

  if (assetName === "sphere_bot.glb") {
    const sphereBotPriority = [
      "05_Sphere_bot_WalkCycle",
      "02_Sphere_bot_Run_Cycle",
      "01_Sphere_bot_Roll",
      "04_Sphere_bot_Attack",
      "03_Sphere_bot_Open",
      "06_Sphere_bot_Run_Attack",
      "07_Sphere_bot_Jump",
    ];

    for (const clipName of sphereBotPriority) {
      const clip = animations.find((item) => item.name === clipName);
      if (clip) return clip;
    }
  }

  return animations.find((clip) => clip.name === "attack a") || animations[0] || null;
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

  if (type === "wind_blade") {
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

    

  if (type === "light_orb") {
    root.rotation.y += delta * 1.5;
    root.rotation.x += delta * 0.35;
    root.children.forEach((child, index) => {
      if (child.material && child.userData.kind === "mist") {
        child.material.opacity = 0.24 + Math.sin(elapsed * 3 + index) * 0.12;
      }
    });

    const pulse = 1 + Math.sin(elapsed * 4) * 0.08;
    root.scale.setScalar(root.userData.currentScale ? root.userData.currentScale * pulse : pulse);
    return;
  }

  if (type === "crystal_shard") {
  // 本体は相手方向、つまりX方向に向かってドリル回転
  root.children.forEach((child) => {
    if (
      child.userData.kind === "main_shard" ||
      child.userData.kind === "main_shard_glow"
    ) {
      child.rotation.x += delta * 12;
    }

    if (child.userData.kind === "drill_ring") {
      const index = child.userData.ringIndex || 0;

      // 0→1→2→3の順に出現、その後0→1→2→3の順に消える
      const cycle = 1.6;
      const local = (elapsed % cycle) / cycle;

      const appearStart = index * 0.11;
      const appearEnd = appearStart + 0.18;

      const disappearStart = 0.55 + index * 0.11;
      const disappearEnd = disappearStart + 0.18;

      let opacity = 0;

      if (local >= appearStart && local < appearEnd) {
        opacity = (local - appearStart) / (appearEnd - appearStart);
      } else if (local >= appearEnd && local < disappearStart) {
        opacity = 1;
      } else if (local >= disappearStart && local < disappearEnd) {
        opacity = 1 - (local - disappearStart) / (disappearEnd - disappearStart);
      }

      child.visible = opacity > 0.02;

      if (child.material) {
        child.material.opacity = opacity * (child.userData.baseOpacity || 0.65);
      }

      // リング自体は回転させない。少しだけ脈動
      const pulse = 1 + Math.sin(elapsed * 8 + index) * 0.04;
      child.scale.setScalar(pulse);
    }
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

function createShardEffect() {
  const root = new Group();

  const shardMaterial = makeGlowMaterial(0x99ddff, 0.85);
  const glowMaterial = makeGlowMaterial(0x66ccff, 0.25);

  const shard = new Mesh(
    new ConeGeometry(0.35, 2.2, 6),
    shardMaterial
  );

  // ConeGeometryはY方向に伸びるので、X方向へ寝かせる
  shard.rotation.z = -Math.PI / 2;
  shard.userData.kind = "main_shard";
  root.add(shard);

  const glow = new Mesh(
    new ConeGeometry(0.48, 2.35, 6),
    glowMaterial
  );

  glow.rotation.z = -Math.PI / 2;
  glow.userData.kind = "main_shard_glow";
  root.add(glow);

  // 指輪状リング。根元側が大きく、先端側ほど小さい
  const ringData = [
    { x: -0.65, radius: 0.46 },
    { x: -0.25, radius: 0.36 },
    { x: 0.18, radius: 0.27 },
    { x: 0.58, radius: 0.18 },
  ];

  ringData.forEach((data, index) => {
    const ring = new Mesh(
      new TorusGeometry(data.radius, 0.012, 8, 48),
      makeGlowMaterial(0xdaf6ff, 0.65)
    );

    // X方向に進むドリルに対して、指輪のように垂直配置
    ring.rotation.y = Math.PI / 2;
    ring.position.x = data.x;

    ring.userData.kind = "drill_ring";
    ring.userData.ringIndex = index;
    ring.userData.baseOpacity = 0.65;

    root.add(ring);
  });

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
  root.userData.effectType = "wind_blade";

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
  if (assetName === "light_orb") return createLightOrbEffect();
  if (assetName === "crystal_shard") return createShardEffect();
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
  
  
  
  onBattleHpReachedZero = () => {
  startBattleEndSequence();
};
  
  //大改革
function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function getAssetSizePreset(assetName, objectSize = "medium") {
  const medium = summonAssetSizePresets[assetName]?.medium || {
    scale: 1,
    y: 1.6,
    offsetX: 0,
    offsetZ: 0,
  };

  const preset =
    summonAssetSizePresets[assetName]?.[objectSize] ||
    medium;

  return {
    scale: preset.scale ?? medium.scale ?? 1,
    y: preset.y ?? medium.y ?? 1.6,
    offsetX: preset.offsetX ?? medium.offsetX ?? 0,
    offsetZ: preset.offsetZ ?? medium.offsetZ ?? 0,
  };
}
function getBattleActors(casterSide = "self") {
  const members = currentRoom?.members || [];
  const isPlayerTwo = members.findIndex((member) => member.id === userTrackingId) === 1;

  const viewerActors = {
    self: isPlayerTwo ? fighterB : fighterA,
    enemy: isPlayerTwo ? fighterA : fighterB,
  };

  if (casterSide === "enemy") {
    return {
      self: viewerActors.enemy,
      enemy: viewerActors.self,
    };
  }

  return viewerActors;
}

function getForwardAndRight(self, enemy) {
  const forward = new Vector3()
    .subVectors(enemy.position, self.position)
    .setY(0)
    .normalize();

  const right = new Vector3(forward.z, 0, -forward.x).normalize();

  return { forward, right };
}
function applySpawnSpread(base, forward, right, objectIndex, objectCount, spreadPattern) {
  const pos = base.clone();

  if (objectCount <= 1 || spreadPattern === "none") {
    return pos;
  }

  const centerIndex = (objectCount - 1) / 2;
  const n = objectIndex - centerIndex;

  if (spreadPattern === "horizontal_line") {
    pos.addScaledVector(right, n * 2.4);
    return pos;
  }

  if (spreadPattern === "vertical_line") {
    pos.y += n * 2.0;
    return pos;
  }

  if (spreadPattern === "circle") {
    const radius = 2.5;
    const angle = (Math.PI * 2 * objectIndex) / objectCount;

    pos.addScaledVector(right, Math.cos(angle) * radius);
    pos.addScaledVector(forward, Math.sin(angle) * radius);
    return pos;
  }

  if (spreadPattern === "random_scatter") {
    pos.addScaledVector(right, (Math.random() - 0.5) * 5);
    pos.addScaledVector(forward, (Math.random() - 0.5) * 5);
    pos.y += (Math.random() - 0.5) * 2;
    return pos;
  }

  return pos;
}
function getSpawnPositionByName(
  positionName,
  assetName,
  objectSize = "medium",
  objectIndex = 0,
  objectCount = 1,
  spreadPattern = "none",
  casterSide = "self"
) {
  const { self, enemy } = getBattleActors(casterSide);
  const { forward, right } = getForwardAndRight(self, enemy);
  const preset = getAssetSizePreset(assetName, objectSize);

  const centerPos = new Vector3(0, 0, 0);
  let base;

  if (positionName === "in_front_of_self") {
    base = self.position
      .clone()
      .addScaledVector(forward, 6)
      .setY(preset.y);
  } else if (positionName === "behind_self") {
    base = self.position
      .clone()
      .addScaledVector(forward, -6)
      .setY(preset.y);
  } else if (positionName === "above_self") {
    base = self.position
      .clone()
      .setY(preset.y + 6);
  } else if (positionName === "battlefield_center") {
    base = centerPos
      .clone()
      .setY(preset.y);
  } else if (positionName === "above_battlefield_center") {
    base = centerPos
      .clone()
      .setY(preset.y + 8);
  } else if (positionName === "enemy_position") {
    base = enemy.position
      .clone()
      .setY(preset.y);
  } else if (positionName === "above_enemy") {
    base = enemy.position
      .clone()
      .setY(preset.y + 6);
  } else {
    base = centerPos
      .clone()
      .setY(preset.y);
  }

  base.x += preset.offsetX || 0;
  base.z += preset.offsetZ || 0;

  return applySpawnSpread(
    base,
    forward,
    right,
    objectIndex,
    objectCount,
    spreadPattern
  );
}
function getTargetPositionByName(positionName, assetName, objectSize = "medium", casterSide = "self") {
  const { self, enemy } = getBattleActors(casterSide);
  const preset = getAssetSizePreset(assetName, objectSize);

  const centerPos = new Vector3(0, 0, 0);

  if (positionName === "self_position") {
    return self.position.clone().setY(preset.y);
  }

  if (positionName === "battlefield_center") {
    return centerPos.clone().setY(preset.y);
  }

  if (positionName === "above_battlefield_center") {
    return centerPos.clone().setY(preset.y + 8);
  }

  if (positionName === "enemy_position") {
    return enemy.position.clone().setY(preset.y);
  }

  if (positionName === "above_enemy") {
    return enemy.position.clone().setY(preset.y + 6);
  }

  return centerPos.clone().setY(preset.y);
}
function createMagicObjectRoot(assetName) {
  const source = summonAssetSources.get(assetName);

  if (!source) {
    console.warn("[origin-magic-circle] unknown asset:", assetName);
    return null;
  }

  let root;

  if (source.isCustom) {
    root = createCustomEffectByName(assetName);
  } else {
    root = skeletonClone(source.gltf.scene);

    applyAssetSpecificTransform(root, assetName);
    applyAssetSpecificMaterialFix(root, assetName);

    if (assetName === "fireball.glb") {
      applyFireballMaterialFix(root);
    }

    if (assetName === "stylized_fire_tornado.glb") {
      applyFireTornadoMaterialFix(root);
    }

    if (source.gltf?.animations?.length > 0) {
      const mixer = new AnimationMixer(root);
      const clip = getPreferredAnimationClip(assetName, source.gltf.animations);

      if (clip) {
        const action = mixer.clipAction(clip);
        action.reset();
        action.play();
      }

      activeMagicMixers.push({
        root,
        mixer,
      });
    }
  }

  root.visible = true;
  return root;
}
function getRotationSpeedValue(rotationSpeed) {
  if (rotationSpeed === "slow") return 0.8;
  if (rotationSpeed === "normal") return 1.8;
  if (rotationSpeed === "fast") return 4.0;
  return 1.8;
}


function normalizeEnterEffect(value) {
  if (value === "fall_from_sky") return "fall_from_sky";
  if (value === "rise_from_ground") return "rise_from_ground";
  if (value === "scale_up") return "scale_up";
  return "scale_up";
}

function normalizeExitEffect(value) {
  if (value === "rise_to_sky") return "rise_to_sky";
  if (value === "sink_into_ground") return "sink_into_ground";
  if (value === "scale_down") return "scale_down";
  return "scale_down";
}

function smoothStep01(value) {
  const t = Math.max(0, Math.min(1, Number(value) || 0));
  return t * t * (3 - 2 * t);
}

function getBaseMagicPosition(item, age) {
  if (item.movePathType !== "none" && item.moveDuration > 0) {
    return getPositionOnPath(
      item.spawnPosition,
      item.targetPosition,
      age / item.moveDuration,
      item.movePathType
    );
  }

  return item.spawnPosition.clone();
}

function applyMagicLifecycleTransform(item, age) {
  const root = item.root;
  let pos = getBaseMagicPosition(item, age);
  let scaleRate = 1;

  const enterDuration = Math.max(0.01, item.enterDuration || 0.75);
  const exitDuration = Math.max(0.01, item.exitDuration || 0.75);

  const enterT = smoothStep01(age / enterDuration);

  if (enterT < 1) {
    if (item.enterEffect === "fall_from_sky") {
      pos.y += (1 - enterT) * 12;
    }

    if (item.enterEffect === "rise_from_ground") {
      pos.y -= (1 - enterT) * 6;
    }

    if (item.enterEffect === "scale_up") {
      scaleRate *= enterT;
    }
  }

  const exitStart = Math.max(0, item.lifeTime - exitDuration);

  if (age >= exitStart) {
    const exitT = smoothStep01((age - exitStart) / exitDuration);

    if (item.exitEffect === "rise_to_sky") {
      pos.y += exitT * 12;
    }

    if (item.exitEffect === "sink_into_ground") {
      pos.y -= exitT * 6;
    }

    if (item.exitEffect === "scale_down") {
      scaleRate *= 1 - exitT;
    }
  }

  root.position.copy(pos);
  root.scale.setScalar((item.baseScale || item.root.userData.currentScale || 1) * Math.max(0.001, scaleRate));
}


function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getPositionOnPath(start, target, t, pathType) {
  const clamped = Math.max(0, Math.min(t, 1));
  const eased = easeOutCubic(clamped);

  if (pathType === "fall_from_above") {
    const highStart = start.clone();
    highStart.y = Math.max(start.y, target.y + 10);
    return highStart.lerp(target, eased);
  }

  if (pathType === "rise_from_below") {
    const lowStart = start.clone();
    lowStart.y = Math.min(start.y, target.y - 5);
    return lowStart.lerp(target, eased);
  }

  const pos = start.clone().lerp(target, eased);

  if (pathType === "arc") {
    pos.y += Math.sin(Math.PI * eased) * 5;
  }

  if (pathType === "orbit") {
    const radius = Math.max(start.distanceTo(target), 3);
    const angle = eased * Math.PI * 2;

    pos.x = target.x + Math.cos(angle) * radius * (1 - eased);
    pos.z = target.z + Math.sin(angle) * radius * (1 - eased);
    pos.y += Math.sin(Math.PI * eased) * 3;
  }

  return pos;
}
function applyMagicColor(root, colorHexCode) {
  if (!/^#[0-9a-fA-F]{6}$/.test(String(colorHexCode || ""))) return;

  const color = new Color(colorHexCode);

  root.traverse((child) => {
    if (!child.material) return;

    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];

    mats.forEach((mat) => {
      if (mat.color) {
        mat.color.lerp(color, 0.35);
      }

      if (mat.emissive) {
        mat.emissive.lerp(color, 0.5);
      }

      mat.needsUpdate = true;
    });
  });
}
function spawnMagicVisualObject(visualObject, objectIndex = 0, objectCount = 1, casterSide = "self") {
  const assetName = visualObject.assetFileName;

  if (!summonAssetOptions.includes(assetName)) {
    console.warn("[origin-magic-circle] rejected asset:", assetName);
    return null;
  }

  const objectSize = visualObject.objectSize || "medium";
  const preset = getAssetSizePreset(assetName, objectSize);

  const root = createMagicObjectRoot(assetName);
  if (!root) return null;

  const spawnPosition = getSpawnPositionByName(
    visualObject.spawnPosition,
    assetName,
    objectSize,
    objectIndex,
    objectCount,
    visualObject.spawnSpreadPattern || "none",
    casterSide
  );

  const movement = visualObject.movement || {};
  const targetPosition = getTargetPositionByName(
    movement.targetPosition || "enemy_position",
    assetName,
    objectSize,
    casterSide
  );

  root.position.copy(spawnPosition);
  root.scale.setScalar(preset.scale);
  root.userData.currentScale = preset.scale;

  applyMagicColor(root, visualObject.colorHexCode);

  if (assetName === "explosion_burst") {
    resetExplosionBurst(root);
  }

  scene.add(root);

  const moveDuration = clampNumber(
    movement.moveDurationSeconds,
    0,
    10,
    0
  );

  const movePathType = movement.movePathType || "none";

  const active = {
  root,
  assetName,
  startTime: clock.elapsedTime,
  lifeTime: clampNumber(visualObject.lifeTimeSeconds, 0.5, 10, 8),

  spawnPosition: spawnPosition.clone(),
  targetPosition: targetPosition.clone(),

  moveDuration,
  movePathType,

  baseScale: preset.scale,
  enterEffect: normalizeEnterEffect(visualObject.enterEffect),
  exitEffect: normalizeExitEffect(visualObject.exitEffect),
  enterDuration: 0.75,
  exitDuration: 0.75,

  shouldRotate: !!visualObject.rotation?.shouldRotate,
  rotationSpeed: getRotationSpeedValue(visualObject.rotation?.rotationSpeed),
};


  applyMagicLifecycleTransform(active, 0);
  activeMagicObjects.push(active);
  return active;
}
async function playMagicVisualEffects(effectJson, isEnemyCast = false) {
  if (battleState.gameEnded) return;

  if (!effectJson || !Array.isArray(effectJson.timedVisualEffects)) {
        console.warn("[origin-magic-circle] invalid magic effect json:", effectJson);
    return;
  }

  await ensureMagicJsonAssetsLoaded(effectJson);

  const casterSide = isEnemyCast ? "enemy" : "self";


  const maxDamage = Math.min(300, Math.max(0, Number(effectJson?.artScore) || 0));
  const damageTimings = Array.isArray(effectJson?.damageTimings) ? effectJson.damageTimings : [];
  damageTimings.forEach((timing) => {
    const delay = Math.max(0, Number(timing.timeSeconds) || 0) * 1000;
    setTimeout(() => {
      
      
      if (battleState.gameEnded) return;
      
      
      //ここ自信ない↓
      const amount = Math.round(maxDamage * (Math.max(0, Number(timing.damageWeight) || 0) / 100));

      if (isEnemyCast) {
        battleState.selfHp = Math.max(0, battleState.selfHp - amount);
      } else {
        battleState.enemyHp = Math.max(0, battleState.enemyHp - amount);
      }

      showDamageNumber(amount, isEnemyCast);
      renderHpBars();
      
      
      
      
      
      if (!battleState.gameEnded && (battleState.selfHp <= 0 || battleState.enemyHp <= 0)) {
  onBattleHpReachedZero?.();
}

      // 自分が撃った魔法のダメージだけサーバーへ確定送信する。
      // 相手から受けた魔法側では送らない。二重減算防止。
      if (!isEnemyCast && !isOriginDebugTestRoom) {
        const members = currentRoom?.members || [];
        const enemy = members.find((member) => member.id !== userTrackingId);
        const socket = getSocketIoClient();

        if (enemy?.id && socket) {
          emitWithAck(socket, "origin:damage", {
            roomId: currentRoom?.roomId,
            attackerId: userTrackingId,
            targetId: enemy.id,
            damage: amount,
          }).catch((error) => {
            console.warn("[origin-magic-circle] socket damage failed:", error);
          });
        }
      }
      
      
    }, delay);
  });
  effectJson.timedVisualEffects.forEach((timedEffect) => {
    const delaySeconds = clampNumber(timedEffect.startTimeSeconds, 0, 6, 0);

    setTimeout(() => {
      if (battleState.gameEnded) return;
      const visualObjects = Array.isArray(timedEffect.visualObjects)
        ? timedEffect.visualObjects
        : [];

      visualObjects.forEach((visualObject) => {
        const objectCount = Math.max(
          1,
          Math.min(Number(visualObject.objectCount) || 1, 5)
        );

        for (let i = 0; i < objectCount; i += 1) {
          spawnMagicVisualObject(visualObject, i, objectCount, casterSide);
        }
      });
    }, delaySeconds * 1000);
  });
}



function updateActiveMagicObjects(elapsed, delta) {
  for (let i = activeMagicObjects.length - 1; i >= 0; i -= 1) {
    const item = activeMagicObjects[i];
    const age = elapsed - item.startTime;

    updateCustomEffect(item.root, elapsed, delta);

    if (item.assetName === "explosion_burst" && item.root.userData.finished) {
      removeActiveMagicObject(i);
      continue;
    }

    if (age >= item.lifeTime) {
      removeActiveMagicObject(i, false);
      continue;
    }

    applyMagicLifecycleTransform(item, age);

    if (item.shouldRotate) {
      item.root.rotation.y += delta * item.rotationSpeed;
    }
  }
}

function removeActiveMagicObject(index, withShrink = false) {
  const item = activeMagicObjects[index];
  if (!item) return;

  if (withShrink && !item.shrinking) {
    item.shrinking = true;
    item.shrinkStartedAt = clock.elapsedTime;
    item.shrinkDuration = 0.35;
    return;
  }
  scene.remove(item.root);

  removeMixerForRoot(item.root);
  activeMagicObjects.splice(index, 1);
}

function removeMixerForRoot(root) {
  for (let i = activeMagicMixers.length - 1; i >= 0; i -= 1) {
    if (activeMagicMixers[i].root === root) {
      activeMagicMixers.splice(i, 1);
    }
  }
}



  

  topControls = document.createElement("div");
topControls.style.maxHeight = "28vh";
topControls.style.overflowY = "auto";
topControls.style.maxWidth = "96vw";
topControls.style.fontSize = "12px";
topControls.style.padding = "8px";
topControls.style.zIndex = "30000000";
topControls.className = "summon-test-controls";
  
      topControls.innerHTML = `
  <div class="summon-test-controls__header">
    <strong>3D素材テスト</strong>
    <button class="summon-test-controls__toggle" type="button">折り畳む</button>
  </div>

  <div class="summon-test-controls__body">
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

<label class="summon-test-controls__field">
  表示位置
  <select class="summon-preview-position-select">
    <option value="center">中央</option>
    <option value="self">自キャラ前</option>
  </select>
</label>

<button class="magic-effect-test-btn" type="button">魔法演出テスト</button>
    </div>
  </div>
`;

  const topControlsBody = topControls.querySelector(".summon-test-controls__body");
  const topControlsToggle = topControls.querySelector(".summon-test-controls__toggle");


  const radioList = topControls.querySelector(".summon-test-controls__list");
  const scaleInput = topControls.querySelector(".summon-scale-input");
  const yInput = topControls.querySelector(".summon-y-input");

  const effectTestBtn = topControls.querySelector(".magic-effect-test-btn");



const positionSelect = topControls.querySelector(".summon-preview-position-select");



const initialPreset = getAssetSizePreset("fireball.glb", "medium");
scaleInput.value = initialPreset.scale;
yInput.value = initialPreset.y;


topControlsToggle?.addEventListener("click", () => {
  const collapsed = topControls.classList.toggle("is-collapsed");
  if (topControlsBody) {
    topControlsBody.style.display = collapsed ? "none" : "";
  }
  topControlsToggle.textContent = collapsed ? "開く" : "折り畳む";
});



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





let previewAssetRoot = null;
let previewAssetName = "";

function removePreviewAssetRoot() {
  if (!previewAssetRoot) return;

  scene.remove(previewAssetRoot);
  removeMixerForRoot(previewAssetRoot);

  previewAssetRoot = null;
  previewAssetName = "";
}

function getPreviewPosition(assetName, appliedY) {
  const mode = positionSelect?.value || "center";
  const preset = getAssetSizePreset(assetName, "medium");

  if (mode === "self") {
    const { self, enemy } = getBattleActors("self");
    const { forward } = getForwardAndRight(self, enemy);

    return self.position
      .clone()
      .addScaledVector(forward, 6)
      .setY(appliedY);
  }

  return new Vector3(
    preset.offsetX || 0,
    appliedY,
    preset.offsetZ || 0
  );
}

async function showPreviewAsset(assetName) {
  if (!assetName || !summonAssetOptions.includes(assetName)) return;

  const scaleValue = Number(scaleInput?.value);
  const appliedScale = Number.isFinite(scaleValue) && scaleValue > 0 ? scaleValue : 1;

  const yValue = Number(yInput?.value);
  const appliedY = Number.isFinite(yValue) ? yValue : 1.6;

  // 同じ素材なら作り直さず、位置とサイズだけ更新
  if (previewAssetRoot && previewAssetName === assetName) {
    previewAssetRoot.visible = true;
    previewAssetRoot.scale.setScalar(appliedScale);
    previewAssetRoot.position.copy(getPreviewPosition(assetName, appliedY));
    previewAssetRoot.userData.currentScale = appliedScale;

    if (previewAssetRoot.userData.effectType === "explosion_burst") {
      resetExplosionBurst(previewAssetRoot);
    }

    showDebug(getMaterialDebugText(previewAssetRoot, assetName));
    return;
  }

  removePreviewAssetRoot();

  await ensureSummonAssetLoaded(assetName, { urgent: true });

  const root = createMagicObjectRoot(assetName);
  if (!root) return;

  root.visible = true;
  root.scale.setScalar(appliedScale);
  root.position.copy(getPreviewPosition(assetName, appliedY));
  root.userData.currentScale = appliedScale;

  if (root.userData.effectType === "explosion_burst") {
    resetExplosionBurst(root);
  }

  scene.add(root);

  previewAssetRoot = root;
  previewAssetName = assetName;

  showDebug(getMaterialDebugText(root, assetName));
}




effectTestBtn?.addEventListener("click", () => {
  const checkedAsset = topControls.querySelector('input[name="summonAsset"]:checked');
  const selectedName = checkedAsset?.value || "fireball.glb";

  playMagicVisualEffects({
    magicName: "テスト魔法",
    artScore: 80,
    timedVisualEffects: [
      {
        startTimeSeconds: 0,
        visualObjects: [
          {
            assetFileName: selectedName,
            objectCount: 3,
            spawnPosition: "in_front_of_self",
            spawnSpreadPattern: "horizontal_line",
            colorHexCode: "#88ccff",
            objectSize: "medium",
            lifeTimeSeconds: 4,
            movement: {
              targetPosition: "enemy_position",
              moveDurationSeconds: 2,
              movePathType: "arc",
            },
            rotation: {
              shouldRotate: true,
              rotationSpeed: "normal",
            },
          },
        ],
      },
      {
        startTimeSeconds: 2,
        visualObjects: [
          {
            assetFileName: "explosion_burst",
            objectCount: 1,
            spawnPosition: "enemy_position",
            spawnSpreadPattern: "none",
            colorHexCode: "#ff8844",
            objectSize: "medium",
            lifeTimeSeconds: 1.5,
            movement: {
              targetPosition: "enemy_position",
              moveDurationSeconds: 0,
              movePathType: "none",
            },
            rotation: {
              shouldRotate: false,
              rotationSpeed: "normal",
            },
          },
        ],
      },
    ],
    damageTimings: [
      {
        timeSeconds: 2,
        damageWeight: 100,
        target: "enemy",
      },
    ],
  });
});


  const applySummonState = () => {
  if (!isOriginDebugTestRoom) return;

  const checkedAsset = topControls.querySelector('input[name="summonAsset"]:checked');
  const selectedName = checkedAsset?.value || "fireball.glb";

  showPreviewAsset(selectedName).catch((error) => {
    console.warn("[origin-magic-circle] preview asset failed:", error);
  });
};

radioList?.addEventListener("change", () => {
  const checkedAsset = topControls.querySelector('input[name="summonAsset"]:checked');
  const selectedName = checkedAsset?.value || "";
  const preset = getAssetSizePreset(selectedName, "medium");

  scaleInput.value = preset.scale;
  yInput.value = preset.y;

  applySummonState();
});


  topControls.addEventListener("change", applySummonState);
  scaleInput?.addEventListener("input", applySummonState);
  yInput?.addEventListener("input", applySummonState);
  
  
  
  positionSelect?.addEventListener("change", applySummonState);
  
  
  //refs.battleView.appendChild(topControls);
  //applySummonState();

if (isOriginDebugTestRoom) {
  refs.battleView.appendChild(topControls);
  applySummonState();
}




function getViewerActors() {
  const members = currentRoom?.members || [];
  const isPlayerTwo = members.findIndex((member) => member.id === userTrackingId) === 1;

  return {
    self: isPlayerTwo ? fighterB : fighterA,
    enemy: isPlayerTwo ? fighterA : fighterB,
  };
}

function getMemberBySide(side) {
  const members = currentRoom?.members || [];
  if (side === "self") {
    return members.find((member) => member.id === userTrackingId) || null;
  }

  return members.find((member) => member.id !== userTrackingId) || null;
}

function showWinBanner(winnerName) {
  const old = document.getElementById("originWinBanner");
  old?.remove();

  const banner = document.createElement("div");
  banner.id = "originWinBanner";
  banner.className = "origin-win-banner";
  banner.textContent = `${winnerName || "PLAYER"} WIN`;

  refs.battleView.appendChild(banner);
}

function hideWinBanner() {
  document.getElementById("originWinBanner")?.remove();
}

function animateLoserFall(loserActor) {
  return new Promise((resolve) => {
    const start = performance.now();
    const duration = 1000;

    const initialRotZ = loserActor.rotation.z;
    const targetRotZ = initialRotZ + Math.PI / 2;

    const initialY = loserActor.position.y;
    const targetY = Math.max(1.5, initialY - 1.8);

    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      loserActor.rotation.z = initialRotZ + (targetRotZ - initialRotZ) * eased;
      loserActor.position.y = initialY + (targetY - initialY) * eased;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}

function moveCameraToWinnerFront(winnerActor, duration = 1000) {
  return new Promise((resolve) => {
    const start = performance.now();

    const startPos = camera.position.clone();

    const winnerPos = winnerActor.position.clone();
    const targetLookAt = winnerPos.clone().add(new Vector3(0, 2.8, 0));

    // 勝者の正面側へ移動。
    // 今のキャラ配置だとZ方向正面で問題ない。
    const front = new Vector3(0, 0, 1);
    const targetPos = winnerPos
      .clone()
      .addScaledVector(front, 10)
      .add(new Vector3(0, 3.2, 0));

    const ease = (t) => {
      const v = Math.max(0, Math.min(1, t));
      return v * v * (3 - 2 * v);
    };

    const step = (now) => {
      const t = ease((now - start) / duration);

      camera.position.lerpVectors(startPos, targetPos, t);
      camera.lookAt(targetLookAt);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        camera.position.copy(targetPos);
        camera.lookAt(targetLookAt);
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}

function orbitCameraAroundWinner(winnerActor) {
  return new Promise((resolve) => {
    const start = performance.now();
    const duration = 2600;
    const radius = 10;
    const baseY = 3.2;

    const center = winnerActor.position.clone().add(new Vector3(0, 2.2, 0));

    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const angle = t * Math.PI * 2;

      camera.position.set(
        center.x + Math.sin(angle) * radius,
        center.y + baseY,
        center.z + Math.cos(angle) * radius
      );

      camera.lookAt(center);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}




function parseStrokePayload(strokeJson) {
  try {
    const parsed = JSON.parse(String(strokeJson || ""));
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.strokes)) return null;

    return {
      w: Math.max(1, Math.round(Number(parsed.w) || 1)),
      h: Math.max(1, Math.round(Number(parsed.h) || 1)),
      strokes: parsed.strokes.filter((stroke) => Array.isArray(stroke) && stroke.length >= 4),
    };
  } catch {
    return null;
  }
}




function getResultCanvasInternalSize(strokeJson) {
  const payload = parseStrokePayload(strokeJson);

  if (!payload) {
    return {
      width: 700,
      height: 480,
    };
  }

  const aspect = payload.w / payload.h;

  const width = 700;

  // 極端に縦長・横長だと崩れるので、見た目用に制限する
  const minHeight = 260;
  const maxHeight = 620;

  let height = width / aspect;
  height = Math.max(minHeight, Math.min(maxHeight, height));

  return {
    width,
    height: Math.round(height),
  };
}





function drawStrokePayloadToCanvas(canvas, strokeJson) {
  const payload = parseStrokePayload(strokeJson);
  const ctx2d = canvas.getContext("2d");

  if (!ctx2d) return;

  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  ctx2d.fillStyle = "#fff";
  ctx2d.fillRect(0, 0, canvas.width, canvas.height);

  if (!payload) {
    ctx2d.fillStyle = "#999";
    ctx2d.font = "14px sans-serif";
    ctx2d.textAlign = "center";
    ctx2d.fillText("魔法陣データなし", canvas.width / 2, canvas.height / 2);
    return;
  }

  const scale = Math.min(
    (canvas.width - 20) / payload.w,
    (canvas.height - 20) / payload.h
  );

  const offsetX = (canvas.width - payload.w * scale) / 2;
  const offsetY = (canvas.height - payload.h * scale) / 2;

  ctx2d.strokeStyle = "#111";
  ctx2d.lineWidth = Math.max(2, 4 * scale);
  ctx2d.lineCap = "round";
  ctx2d.lineJoin = "round";

  payload.strokes.forEach((stroke) => {
    if (stroke.length < 4) return;

    ctx2d.beginPath();
    ctx2d.moveTo(
      offsetX + stroke[0] * scale,
      offsetY + stroke[1] * scale
    );

    for (let i = 2; i < stroke.length - 1; i += 2) {
      ctx2d.lineTo(
        offsetX + stroke[i] * scale,
        offsetY + stroke[i + 1] * scale
      );
    }

    ctx2d.stroke();
  });
}





function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}




function createResultMagicBubble(log, index) {
  const isSelf = log.casterId === userTrackingId;

  const bubble = document.createElement("div");
  bubble.className = `origin-result-bubble ${isSelf ? "self" : "enemy"}`;
  bubble.style.animationDelay = `${index * 1}s`;

  const title = document.createElement("div");
title.className = "origin-result-bubble__title";
title.innerHTML = `
  <div>${escapeHtml(log.magicName || "無名の魔法")}</div>
  <div>【${Math.round(Number(log.totalDamage) || 0)}ダメージ】</div>
`;

  const canvasSize = getResultCanvasInternalSize(log.strokeJson);

const canvas = document.createElement("canvas");
canvas.className = "origin-result-bubble__canvas";

// 実描画解像度。表示幅はCSSの70vwに任せる
canvas.width = canvasSize.width;
canvas.height = canvasSize.height;

bubble.append(title, canvas);

  requestAnimationFrame(() => {
    drawStrokePayloadToCanvas(canvas, log.strokeJson);
  });

  return bubble;
}




async function hydrateMagicLogsFromRoomCastLogs() {
  if (!currentRoom?.roomId || isOriginDebugTestRoom) return;

  try {
    const data = await callApi(
      `/api/origin-magic-circle/rooms/${encodeURIComponent(currentRoom.roomId)}/cast-logs`
    );

    const logs = Array.isArray(data.logs) ? data.logs : [];

    logs.forEach((log) => {
      addMagicLogFromCast({
        id: log.id,
        at: log.at,
        casterId: log.casterId,
        casterName: log.casterName,
        spellHash: log.spellHash,
        magicEffectJson: log.magicEffectJson,
        strokeJson: log.strokeJson,
      });
    });
  } catch (error) {
    console.warn("[origin-magic-circle] hydrate magic logs failed:", error);
  }
}





function showBattleResultScreen({ selfWon }) {
  refs.battleView.innerHTML = "";

  const result = document.createElement("div");
  result.className = `origin-result-screen ${selfWon ? "win" : "lose"}`;

  const title = document.createElement("div");
  title.className = "origin-result-title";
  title.textContent = selfWon ? "VICTORY" : "DEFEAT";

  const sub = document.createElement("div");
  sub.className = "origin-result-subtitle";
  sub.textContent = "発動した魔法陣";

  const list = document.createElement("div");
  list.className = "origin-result-chat";

  const logs = [...battleState.magicLogs].sort((a, b) => a.at - b.at);

  logs.forEach((log, index) => {
    list.appendChild(createResultMagicBubble(log, index));
  });

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "origin-result-back-btn";
  backBtn.textContent = "トップページに戻る";

  backBtn.addEventListener("click", () => {
    // ルーム復帰用キャッシュだけ消す。
    // currentUser などのログイン情報は消さない。
    clearActiveRoomId();

    // Socket.IOの残留を避けたいので切断してからトップへ
    if (originSocket) {
      originSocket.disconnect();
      originSocket = null;
    }

    window.location.href = "/";
  });

  result.append(title, sub, list, backBtn);
  refs.battleView.appendChild(result);

  setTimeout(() => {
    list.scrollTo({
      top: list.scrollHeight,
      behavior: "smooth",
    });
  }, Math.max(1000, logs.length * 1000 + 300));
}




async function showReloadedBattleResultScreen() {
  if (battleState.endingStarted) return;

  battleState.endingStarted = true;
  battleState.gameEnded = true;

  const selfWon = getSelfWonFromCurrentHp();

  hideTutorialModal();

  await hydrateMagicLogsFromRoomCastLogs();

  showBattleResultScreen({ selfWon });
}





async function startBattleEndSequence() {
  if (battleState.endingStarted) return;

  battleState.endingStarted = true;
  battleState.gameEnded = true;

  const selfMember = getMemberBySide("self");
  const enemyMember = getMemberBySide("enemy");

  const selfWon = battleState.selfHp > 0 && battleState.enemyHp <= 0;

  const winnerMember = selfWon ? selfMember : enemyMember;
  const loserMember = selfWon ? enemyMember : selfMember;

  battleState.winnerId = winnerMember?.id || "";
  battleState.loserId = loserMember?.id || "";

  const actors = getViewerActors();
  const winnerActor = selfWon ? actors.self : actors.enemy;
  const loserActor = selfWon ? actors.enemy : actors.self;

  hideTutorialModal();

  // 操作UIを消す
  document.querySelector(".magic-circle-overlay")?.remove();
  document.querySelector(".magic-circle-controls.left")?.remove();
  document.querySelector(".magic-circle-controls.right")?.remove();
  document.querySelector(".chant-result-modal")?.remove();

  await moveCameraToWinnerFront(winnerActor, 1000);

showWinBanner(winnerMember?.name || "PLAYER");

await animateLoserFall(loserActor);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  await orbitCameraAroundWinner(winnerActor);

  hideWinBanner();

await hydrateMagicLogsFromRoomCastLogs();

showBattleResultScreen({ selfWon });}






  setCameraForMatchup(userTrackingId, currentRoom?.members || [], fighterA, fighterB);
  //renderHpBars();
  /*setInterval(async () => {
    try {
      const r = await fetch(`/api/origin-magic-circle/casts/${encodeURIComponent(currentRoom?.roomId || "")}?since=${battleState.lastCastAt}`);
      const d = await r.json();
      for (const cast of d.casts || []) {
        battleState.lastCastAt = Math.max(battleState.lastCastAt, cast.at || 0);
        if (battleState.processedCastIds.has(cast.id) || cast.casterId === userTrackingId) continue;
        battleState.processedCastIds.add(cast.id);
        showMagicNameCenter(cast.magicEffectJson?.magicName, true, () => playMagicVisualEffects(cast.magicEffectJson, true));
      }
    } catch {}
  }, 1200);*/
//代わりにこれを入れるよ〜
const socket = getSocketIoClient();

if (socket) {
  socket.off("origin:cast");
  socket.on("origin:cast", (cast) => {
  if (!cast?.id) return;

  battleState.lastCastAt = Math.max(battleState.lastCastAt, Number(cast.at) || 0);

  if (battleState.processedCastIds.has(cast.id)) return;
  battleState.processedCastIds.add(cast.id);

  addMagicLogFromCast(cast);

  // HP0後に届いた魔法はログには残しても、演出は出さない
  if (battleState.gameEnded) return;

  // 自分が撃った魔法は、自分側ではすでに演出開始しているので再生しない
  if (cast.casterId === userTrackingId) return;

  showMagicNameCenter(cast.magicEffectJson?.magicName, true, () => {
    if (battleState.gameEnded) return;
    playMagicVisualEffects(cast.magicEffectJson, true);
  });
});

  socket.off("origin:hp");
  socket.on("origin:hp", (hpPayload) => {
    applyHpPayload(hpPayload);
  });
}

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

  activeMagicMixers.forEach((item) => {
    item.mixer.update(delta);
  });

  updateActiveMagicObjects(elapsed, delta);

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
  const roomId = await showRoomIdModal();
  if (!roomId) return;
  
  
  
  if (roomId === "0") {
  isOriginDebugTestRoom = true;

  const room = createOriginDebugTestRoom();
  currentRoom = room;

  // テスト部屋は再読み込み復帰もできるように保存する
  //saveActiveRoomId("000000");

  showWaitingRoom(room);
  setMessage("テスト部屋に入室しました。対戦相手 bot を追加します。");

  await startThreeBattleScene();
  return;
}







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
if (activeRoomId === "000000") {
  isOriginDebugTestRoom = true;

  const room = createOriginDebugTestRoom();
  currentRoom = room;

  showWaitingRoom(room);
  setMessage("テスト部屋に再接続しました。");

  await startThreeBattleScene();
  return;
}

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
