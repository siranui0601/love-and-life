import { showToast } from "../toast.js";
import * as THREE from "https://esm.sh/three@0.163.0";

const messageEl = document.getElementById("message");
const homePanelEl = document.getElementById("homePanel");
const waitingRoomEl = document.getElementById("waitingRoom");
const roomIdTextEl = document.getElementById("roomIdText");
const memberListEl = document.getElementById("memberList");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const backToTitleBtn = document.getElementById("backToTitleBtn");

const startGameBtn = document.getElementById("startGameBtn");
const deleteRoomBtn = document.getElementById("deleteRoomBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const waitingNoteEl = document.getElementById("waitingNote");

const battlePanelEl = document.getElementById("battlePanel");
const battleSceneEl = document.getElementById("battleScene");
const battlePhaseEl = document.getElementById("battlePhase");
const deckAnimationEl = document.getElementById("deckAnimation");
const mulliganPanelEl = document.getElementById("mulliganPanel");
const mulliganCounterEl = document.getElementById("mulliganCounter");
const finishMulliganBtn = document.getElementById("finishMulliganBtn");

const actionModalEl = document.getElementById("actionModal");
const actionModalTextEl = document.getElementById("actionModalText");
const actionYesBtn = document.getElementById("actionYesBtn");
const actionNoBtn = document.getElementById("actionNoBtn");

const infoModalEl = document.getElementById("infoModal");
const infoModalTextEl = document.getElementById("infoModalText");
const infoModalCloseBtn = document.getElementById("infoModalCloseBtn");

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem("currentUser") || "null"); }
  catch { return null; }
}

const storedUser = getStoredUser();
if (!storedUser?.username || !storedUser?.userTrackingId) {
  alert("ひみつ道具バトルはログインが必要です");
  window.location.href = "/";
}

const username = storedUser.username;
const userTrackingId = storedUser.userTrackingId;

const socket = io({
  auth: {
    userTrackingId,
    username,
  }
});

const state = {
  room: null,
  modalOnYes: null,
  game: null,
  hand: [],
  selectedMulliganIds: new Set(),
  mulliganSubmitted: false,
};

const battle3D = {
  renderer: null,
  scene: null,
  camera: null,
  pocket: null,
  playerMeshes: [],
  disposeHandlers: [],
  rafId: null,
  lookYaw: 0,
  lookPitch: 0,
  baseDir: new THREE.Vector3(),
  baseRight: new THREE.Vector3(),
  handMeshes: [],
  cardRaycaster: new THREE.Raycaster(),
  pointer: new THREE.Vector2(),
  dragDistance: 0,
};

const PLAYER_IMAGES = [
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhqVASLqpmTuw6sQ9bo2REFYB6JYMV9vbvqUW3jubB653Maac56Q9xQUhiyu3Ww-Ap5ErSqO0SAPugc78BXDSQrZBg8cI8vBHS9F4n8h1d0xrjOVhnedX6-xcxrYwCwjsns6xsH8smw9Bz4QeX0C9-vGa_wcLC6uIuw8Y3Nvn4R3NekA3sT5a5UVw2ot0A2/s545/IMG_4367.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhS0PkKqdR4ZANKaL2qP-2B8SAaRtacUWgIGG79YO3Wf23lbG_DuMtFyBf_sZJSWPVENiUd3h-JYjxnmjorbaQ-lMW9EYTIVa6luFZiAJhyphenhyphen-NLSVEB0Gc62kaCFlkfE29yh-Us1dQNQzl6umbvJEq3vTIB6ELm-qlTGT_OBuZTQgKpXSnHAC_A3sOwXIVFJ/s500/IMG_4361.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjI2U-8w71lVk5xgERCPm0clOIYwZgJg8yjwGnxcAVssNVNXFGfcLjX8lQ9xZfzPdV7YUTF7c0QF2fJgu7ERjWMVpf-a8Wjurqjx_PRmd8dEjPmpQQKDOHPlxENgJV2P8Bun6lliNAanEH0-Sb5KspBjOCexPD_tHiYQ9TGs2r3DAfJwYO9OqEf1U3Que5v/s380/IMG_4362.png",
  "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj1uSFIzcZLU4de_GxEna5QG7U-rtE1t7lRKhsxX3zEGv6el6d7AQ5H1VQr9UhkP7B7TSNGsYLlPQP8ekNvph8EkkaYiUeQdeAhHdyXIapjdmZOxq5lHcr7Q17rWOcy_F8h-yZgPP1aifiImFWOgN7GQhVlGdVQfFHfi3h_uQycQQVj9pAnLkGtzRWYBLxp/s1000/IMG_4364.jpeg",
];

const playerImageMap = new Map();
const imageLoader = new THREE.TextureLoader();

function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function assignPlayerImages(seats = []) {
  const ids = seats.map((seat) => seat.id).filter(Boolean);
  for (const existingId of [...playerImageMap.keys()]) {
    if (!ids.includes(existingId)) {
      playerImageMap.delete(existingId);
    }
  }

  const usedImages = new Set(playerImageMap.values());
  const remainingImages = shuffleArray(PLAYER_IMAGES.filter((url) => !usedImages.has(url)));

  for (const seat of seats) {
    if (playerImageMap.has(seat.id)) continue;
    const imageUrl = remainingImages.pop() || PLAYER_IMAGES[Math.floor(Math.random() * PLAYER_IMAGES.length)];
    playerImageMap.set(seat.id, imageUrl);
  }
}

function clearBattle3DPlayers() {
  for (const m of battle3D.playerMeshes) {
    battle3D.scene?.remove(m);
    m.traverse?.((child) => {
      child.material?.map?.dispose?.();
      child.material?.dispose?.();
      child.geometry?.dispose?.();
    });
    m.material?.map?.dispose?.();
    m.material?.dispose?.();
    m.geometry?.dispose?.();
  }
  battle3D.playerMeshes = [];
}

function clearBattle3DHand() {
  for (const mesh of battle3D.handMeshes) {
    battle3D.scene?.remove(mesh);
    mesh.material?.map?.dispose?.();
    mesh.material?.dispose?.();
    mesh.geometry?.dispose?.();
  }
  battle3D.handMeshes = [];
}

function makeCardTexture(card = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#fffef8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#d8cda8";
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

  ctx.fillStyle = "#293337";
  ctx.font = "bold 42px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const cardName = String(card.name || "カード");
  ctx.fillText(cardName.slice(0, 18), canvas.width / 2, 42);

  ctx.strokeStyle = "#d8cda8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(48, 114);
  ctx.lineTo(canvas.width - 48, 114);
  ctx.stroke();

  ctx.fillStyle = "#33473f";
  ctx.font = "28px sans-serif";
  ctx.textAlign = "left";
  const effectText = String(card.text || card.type || "効果なし");
  const effectLines = wrapText(effectText, 24);
  effectLines.slice(0, 8).forEach((line, index) => {
    ctx.fillText(line, 48, 160 + index * 40);
  });

  ctx.strokeStyle = "#e6debf";
  ctx.beginPath();
  ctx.moveTo(48, 580);
  ctx.lineTo(canvas.width - 48, 580);
  ctx.stroke();

  ctx.fillStyle = "#6f6a57";
  ctx.font = "italic 24px serif";
  const flavorText = String(card.flavor || "");
  wrapText(flavorText, 26).slice(0, 3).forEach((line, index) => {
    ctx.fillText(line, 48, 612 + index * 34);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function wrapText(text, maxCharsPerLine) {
  const lines = [];
  const chars = [...String(text || "")];
  for (let i = 0; i < chars.length; i += maxCharsPerLine) {
    lines.push(chars.slice(i, i + maxCharsPerLine).join(""));
  }
  return lines.length ? lines : [""];
}

function makeNameTexture(name) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1f2c1f";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(name || "PLAYER"), canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function seatPosition(index, total, radius) {
  if (total === 2) {
    return [new THREE.Vector3(0, 1, radius), new THREE.Vector3(0, 1, -radius)][index];
  }
  if (total === 4) {
    return [
      new THREE.Vector3(0, 1, radius),
      new THREE.Vector3(radius, 1, 0),
      new THREE.Vector3(0, 1, -radius),
      new THREE.Vector3(-radius, 1, 0),
    ][index];
  }
  const angle = (Math.PI * 2 * index) / Math.max(1, total);
  return new THREE.Vector3(Math.sin(angle) * radius, 1, Math.cos(angle) * radius);
}

function setupBattle3D() {
  if (!battleSceneEl || battle3D.renderer) return;

  battle3D.scene = new THREE.Scene();
  battle3D.scene.background = new THREE.Color("#bfe9ff");

  battle3D.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  battle3D.camera.position.set(0, 2.4, 13);

  battle3D.renderer = new THREE.WebGLRenderer({ antialias: true });
  battle3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  battleSceneEl.append(battle3D.renderer.domElement);

  battle3D.scene.add(new THREE.HemisphereLight(0xffffff, 0x4b7f47, 1.15));
  const dl = new THREE.DirectionalLight(0xffffff, 0.85);
  dl.position.set(6, 10, 7);
  battle3D.scene.add(dl);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: "#3fa34d" }),
  );
  ground.rotation.x = -Math.PI / 2;
  battle3D.scene.add(ground);

  const crescent = new THREE.Shape();
  const pocketRadius = 1.8;
  crescent.moveTo(-pocketRadius, 0);
  crescent.absarc(0, 0, pocketRadius, Math.PI, Math.PI * 2, false);
  crescent.lineTo(pocketRadius, 0);
  crescent.lineTo(-pocketRadius, 0);
  battle3D.pocket = new THREE.Mesh(
    new THREE.ShapeGeometry(crescent),
    new THREE.MeshBasicMaterial({ color: "#ffffff", side: THREE.DoubleSide }),
  );
  battle3D.pocket.scale.setScalar(0.72);
  battle3D.pocket.position.set(0, 1.2, 0);
  battle3D.scene.add(battle3D.pocket);

  const onResize = () => {
    const width = battleSceneEl.clientWidth || window.innerWidth;
    const height = battleSceneEl.clientHeight || window.innerHeight;
    battle3D.camera.aspect = width / Math.max(1, height);
    battle3D.camera.updateProjectionMatrix();
    battle3D.renderer.setSize(width, height, false);
  };
  onResize();
  window.addEventListener("resize", onResize);
  battle3D.disposeHandlers.push(() => window.removeEventListener("resize", onResize));

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const onDown = (event) => {
    dragging = true;
    battle3D.dragDistance = 0;
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const onMove = (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    battle3D.dragDistance += Math.abs(dx) + Math.abs(dy);
    battle3D.lookYaw = THREE.MathUtils.clamp(battle3D.lookYaw - dx * 0.005, -Math.PI / 3, Math.PI / 3);
    battle3D.lookPitch = THREE.MathUtils.clamp(battle3D.lookPitch - dy * 0.005, -Math.PI / 3, Math.PI / 3);
  };
  const onUp = () => {
    if (dragging && battle3D.dragDistance < 6) {
      onCardTapped(lastX, lastY);
    }
    dragging = false;
  };

  battle3D.renderer.domElement.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  battle3D.disposeHandlers.push(() => {
    battle3D.renderer?.domElement?.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  });

  const animate = () => {
    battle3D.rafId = requestAnimationFrame(animate);
    if (!battle3D.camera || !battle3D.renderer || !battle3D.scene) return;

    battle3D.pocket?.lookAt(battle3D.camera.position);

    const look = battle3D.baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), battle3D.lookYaw);
    const right = battle3D.baseRight.lengthSq() ? battle3D.baseRight : new THREE.Vector3(1, 0, 0);
    look.applyAxisAngle(right, battle3D.lookPitch);
    battle3D.camera.lookAt(battle3D.camera.position.clone().add(look));

    battle3D.renderer.render(battle3D.scene, battle3D.camera);
  };
  animate();
}

function onCardTapped(clientX, clientY) {
  if (!battle3D.renderer || !battle3D.camera || !state.game || state.game.phase !== "mulligan" || state.mulliganSubmitted) {
    return;
  }

  const rect = battle3D.renderer.domElement.getBoundingClientRect();
  battle3D.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  battle3D.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  battle3D.cardRaycaster.setFromCamera(battle3D.pointer, battle3D.camera);

  const intersects = battle3D.cardRaycaster.intersectObjects(battle3D.handMeshes);
  const hit = intersects[0]?.object;
  const handId = hit?.userData?.handId;
  if (!handId) return;

  if (state.selectedMulliganIds.has(handId)) {
    state.selectedMulliganIds.delete(handId);
  } else {
    if (state.selectedMulliganIds.size >= 3) return;
    state.selectedMulliganIds.add(handId);
  }
  renderHand();
}

function renderHandInBattle3D(cards = []) {
  setupBattle3D();
  if (!battle3D.scene) return;

  clearBattle3DHand();

  const spacing = 2.15;
  const startX = -((Math.max(1, cards.length) - 1) * spacing) / 2;

  cards.forEach((card, index) => {
    const cardTexture = makeCardTexture(card);
    const cardMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 2.65),
      new THREE.MeshStandardMaterial({
        map: cardTexture,
        color: state.selectedMulliganIds.has(card.handId) ? "#ffd4ea" : "#ffffff",
      }),
    );
    cardMesh.position.set(startX + index * spacing, -1.75, 6.2);
    cardMesh.rotation.x = -0.28;
    cardMesh.userData.handId = card.handId;
    battle3D.scene.add(cardMesh);
    battle3D.handMeshes.push(cardMesh);
  });
}

function layoutBattle3D(seats = []) {
  setupBattle3D();
  if (!battle3D.camera || !battle3D.scene) return;

  assignPlayerImages(seats);
  clearBattle3DPlayers();

  const total = Math.max(2, Math.min(4, seats.length || 2));
  const myIndex = Math.max(0, seats.findIndex((seat) => seat.id === userTrackingId));
  const myPos = seatPosition(myIndex, total, 8);
  const cameraPos = new THREE.Vector3(0, 2.4, 13);
  const offset = cameraPos.clone().sub(myPos);

  battle3D.camera.position.copy(cameraPos);
  battle3D.baseDir = new THREE.Vector3(0, 1.8, 0).sub(cameraPos).normalize();
  battle3D.baseRight = battle3D.baseDir.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
  battle3D.lookYaw = 0;
  battle3D.lookPitch = 0;

  seats.slice(0, 4).forEach((seat, index) => {
    const pos = seatPosition(index, total, 8).add(offset);
    const group = new THREE.Group();
    group.position.copy(pos);

    const imageUrl = playerImageMap.get(seat.id);
    const texture = imageUrl ? imageLoader.load(imageUrl) : null;
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }

    const iconMesh = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 48),
      new THREE.MeshStandardMaterial({
        map: texture,
        color: "#ffffff",
      }),
    );
    group.add(iconMesh);

    const nameSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeNameTexture(seat.name), transparent: true }),
    );
    nameSprite.position.set(0, -1.5, 0);
    nameSprite.scale.set(3.8, 1, 1);
    group.add(nameSprite);

    if (seat.id === state.game?.parentId) {
      const crown = new THREE.Mesh(
        new THREE.RingGeometry(1.3, 1.5, 48),
        new THREE.MeshBasicMaterial({ color: "#ffd54f", side: THREE.DoubleSide }),
      );
      crown.position.set(0, 0, 0.02);
      group.add(crown);
    }

    battle3D.scene.add(group);
    battle3D.playerMeshes.push(group);
  });
}

function destroyBattle3D() {
  if (battle3D.rafId) cancelAnimationFrame(battle3D.rafId);
  battle3D.rafId = null;
  clearBattle3DPlayers();
  clearBattle3DHand();
  battle3D.disposeHandlers.forEach((dispose) => dispose());
  battle3D.disposeHandlers = [];
  if (battle3D.renderer?.domElement?.parentNode) {
    battle3D.renderer.domElement.parentNode.removeChild(battle3D.renderer.domElement);
  }
  battle3D.renderer?.dispose?.();
  battle3D.renderer = null;
  battle3D.scene = null;
  battle3D.camera = null;
  battle3D.pocket = null;
}

function setMessage(message) {
  messageEl.textContent = message;
}

function showHomePanel() {
  homePanelEl.classList.remove("hidden");
  homePanelEl.classList.remove("note");
}

function hideHomePanel() {
  homePanelEl.classList.add("hidden");
}

function showWaitingRoom(room) {
  state.room = room;
  const members = room.members || [];
  roomIdTextEl.textContent = room.roomId;
  memberListEl.innerHTML = "";

  for (const member of members) {
    const li = document.createElement("li");
    const roleLabel = member.role === "host" ? " (ホスト)" : "";
    li.textContent = `${member.name}${roleLabel}`;
    memberListEl.append(li);
  }

  const isHost = members.some((member) => member.id === userTrackingId && member.role === "host");
  const memberCount = members.length;

  startGameBtn.disabled = !(isHost && memberCount >= 2 && memberCount <= 4);
  deleteRoomBtn.classList.toggle("hidden", !isHost);
  leaveRoomBtn.classList.toggle("hidden", isHost);

  hideHomePanel();
  battlePanelEl.classList.add("hidden");
  waitingRoomEl.classList.remove("hidden");
  waitingRoomEl.classList.add("note");
  waitingNoteEl.classList.remove("hidden");
}

function showBattlePanel(roomId) {
  hideHomePanel();
  waitingRoomEl.classList.add("hidden");
  waitingNoteEl.classList.add("hidden");
  battlePanelEl.classList.remove("hidden");
}

function renderSeats() {
  const seats = state.game?.seatOrder || [];
  layoutBattle3D(seats);
}

function renderHand() {
  const cards = state.hand || [];
  const isMulligan = state.game?.phase === "mulligan";

  renderHandInBattle3D(cards);

  mulliganCounterEl.textContent = `${state.selectedMulliganIds.size}/3 枚選択中`;
  finishMulliganBtn.disabled = state.mulliganSubmitted || !isMulligan;
}

function renderBattleState() {
  if (!state.game) return;
  showBattlePanel(state.room?.roomId || localStorage.getItem("activeRoomId"));
  renderSeats();
  renderHand();

  if (state.game.phase === "mulligan") {
    battlePhaseEl.textContent = "初期配布完了：0〜3枚を交換できます。最初に終えた人が親です。";
    mulliganPanelEl.classList.remove("hidden");
    deckAnimationEl.classList.add("deal");
  } else {
    battlePhaseEl.textContent = "マリガン終了。親から時計回りでゲーム開始。";
    mulliganPanelEl.classList.add("hidden");
    deckAnimationEl.classList.remove("deal");
  }
}

function resetToLobbyState({ clearActiveRoom = true } = {}) {
  state.room = null;
  state.game = null;
  state.hand = [];
  state.selectedMulliganIds = new Set();
  state.mulliganSubmitted = false;
  if (clearActiveRoom) {
    localStorage.removeItem("activeRoomId");
  }
  showHomePanel();
  destroyBattle3D();
  waitingRoomEl.classList.add("hidden");
  battlePanelEl.classList.add("hidden");
  waitingNoteEl.classList.remove("hidden");
}

async function fetchRoom(roomId) {
  const response = await fetch(`/api/secret-tool/rooms/${encodeURIComponent(roomId)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "request_failed");
  }
  return payload;
}

async function restoreActiveRoomIfExists() {
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (!activeRoomId) {
    resetToLobbyState({ clearActiveRoom: false });
    setMessage("ルームを作成するか、IDを入力して参加してください。");
    return;
  }

  setMessage("ルームを再接続中...");
  try {
    const room = await fetchRoom(activeRoomId);
    const joined = (room.members || []).some((member) => member.id === userTrackingId);

    if (!joined) {
      resetToLobbyState();
      setMessage("前回のルームには再接続できませんでした。");
      return;
    }

    socket.emit("secret-tool:join-room", { roomId: room.roomId });
    socket.emit("secret-tool:sync-room", { roomId: room.roomId });
    if (room.status === "lobby") {
      showWaitingRoom(room);
    } else {
      showBattlePanel(room.roomId);
    }
    setMessage(`ルーム ${room.roomId} に再接続しました。`);
  } catch (error) {
    resetToLobbyState();
    if (error.message === "room_not_found") {
      setMessage("前回のルームは見つかりませんでした。");
      return;
    }
    setMessage("ルームの再接続に失敗しました。");
  }
}

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "request_failed");
  }
  return payload;
}

function openConfirmModal(message, onYes) {
  state.modalOnYes = onYes;
  actionModalTextEl.textContent = message;
  actionModalEl.classList.remove("hidden");
}

function closeConfirmModal() {
  actionModalEl.classList.add("hidden");
  state.modalOnYes = null;
}

function openInfoModal(message) {
  infoModalTextEl.textContent = message;
  infoModalEl.classList.remove("hidden");
}

createRoomBtn.addEventListener("click", async () => {
  setMessage("ルーム作成中...");
  try {
    const room = await requestJson("/api/secret-tool/rooms/create", { username, userTrackingId });
    localStorage.setItem("activeRoomId", room.roomId);
    socket.emit("secret-tool:join-room", { roomId: room.roomId });
    showWaitingRoom(room);
    setMessage(`ルーム ${room.roomId} を作成しました！`);
  } catch {
    setMessage("ルーム作成に失敗しました。");
  }
});

joinRoomBtn.addEventListener("click", async () => {
  const roomId = window.prompt("6桁のルームIDを入力してください");
  if (!roomId) return;

  setMessage("ルーム入室中...");
  try {
    const room = await requestJson("/api/secret-tool/rooms/join", {
      roomId: roomId.trim(),
      username,
      userTrackingId,
    });
    localStorage.setItem("activeRoomId", room.roomId);
    socket.emit("secret-tool:join-room", { roomId: room.roomId, announceJoin: true });
    showWaitingRoom(room);
    setMessage(`ルーム ${room.roomId} に入室しました！`);
  } catch (error) {
    if (error.message === "room_not_found") {
      setMessage("ルームが見つかりません。");
      return;
    }
    if (error.message === "room_not_lobby") {
      setMessage("このルームは入室できません。");
      return;
    }
    if (error.message === "room_full") {
      setMessage("このルームは満員です（最大4人）。");
      return;
    }
    setMessage("ルーム入室に失敗しました。");
  }
});

startGameBtn.addEventListener("click", () => {
  if (startGameBtn.disabled || !state.room?.roomId) return;
  socket.emit("secret-tool:start-game", { roomId: state.room.roomId });
  setMessage("ゲーム開始を送信しました。");
});

finishMulliganBtn.addEventListener("click", () => {
  if (!state.room?.roomId || state.mulliganSubmitted || !state.game || state.game.phase !== "mulligan") return;
  state.mulliganSubmitted = true;
  renderHand();
  deckAnimationEl.classList.add("returning");
  socket.emit("secret-tool:mulligan-finish", {
    roomId: state.room.roomId,
    selectedHandIds: Array.from(state.selectedMulliganIds),
  });
});

deleteRoomBtn.addEventListener("click", () => {
  const roomId = state.room?.roomId;
  if (!roomId) return;

  openConfirmModal("本当にルームを削除しますか？", async () => {
    try {
      await requestJson("/api/secret-tool/rooms/delete", { roomId, userTrackingId });
      resetToLobbyState();
      setMessage("ルームを削除しました。");
    } catch {
      setMessage("ルーム削除に失敗しました。");
    }
  });
});

leaveRoomBtn.addEventListener("click", () => {
  const roomId = state.room?.roomId;
  if (!roomId) return;

  openConfirmModal("本当にルームを抜けますか？", () => {
    socket.emit("secret-tool:leave-room");
    resetToLobbyState();
    setMessage("ルームを退室しました。");
  });
});

backToTitleBtn.addEventListener("click", () => {
  openConfirmModal("本当に戻りますか？", () => {
    const roomId = localStorage.getItem("activeRoomId");
    if (roomId) {
      socket.emit("secret-tool:leave-room");
      localStorage.removeItem("activeRoomId");
    }
    destroyBattle3D();
    window.location.href = "/";
  });
});

window.addEventListener("beforeunload", destroyBattle3D);

actionNoBtn.addEventListener("click", closeConfirmModal);

actionYesBtn.addEventListener("click", async () => {
  const onYes = state.modalOnYes;
  closeConfirmModal();
  if (!onYes) return;
  await onYes();
});

infoModalCloseBtn.addEventListener("click", () => {
  infoModalEl.classList.add("hidden");
});

socket.on("secret-tool:members-updated", (room) => {
  if (!room?.roomId) return;
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (!activeRoomId || activeRoomId !== room.roomId) return;

  state.room = room;
  if (room.status === "closed") {
    resetToLobbyState();
    setMessage("ルームが終了しました。");
    return;
  }

  if (room.status === "lobby") {
    showWaitingRoom(room);
  } else {
    showBattlePanel(room.roomId);
  }
});

socket.on("secret-tool:game-started", ({ roomId } = {}) => {
  if (!roomId) return;
  setMessage("ゲームが開始されました。カード配布中...");
  showBattlePanel(roomId);
});

socket.on("secret-tool:game-state", (gameState) => {
  if (!gameState) return;
  state.game = gameState;
  renderBattleState();
});

socket.on("secret-tool:your-hand", ({ cards = [] } = {}) => {
  state.hand = cards;
  renderHand();
});

socket.on("secret-tool:mulligan-player-finished", ({ playerId, returnedCount } = {}) => {
  if (!playerId || playerId === userTrackingId) return;
  showToast(`他プレイヤーがマリガンを完了（${returnedCount}枚交換）`, 2500);
});

socket.on("secret-tool:mulligan-completed", ({ parentId, turnOrder = [] } = {}) => {
  const parentName = (turnOrder.find((player) => player.id === parentId) || {}).name || "プレイヤー";
  setMessage(`マリガン終了。親は${parentName}です。`);
  deckAnimationEl.classList.remove("returning");
});

socket.on("secret-tool:room-deleted", ({ roomId } = {}) => {
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (!roomId || activeRoomId !== roomId) return;

  const isGuest = !(state.room?.members || []).some((member) => member.id === userTrackingId && member.role === "host");
  resetToLobbyState();
  if (isGuest) {
    openInfoModal("ホストがルームを削除しました");
  }
  setMessage("待機部屋に戻りました。");
});

socket.on("secret-tool:member-joined", ({ roomId, name } = {}) => {
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (!activeRoomId || activeRoomId !== roomId || !name) return;
  showToast(`${name}が参加しました`, 3000);
});

socket.on("secret-tool:member-left", ({ roomId, id, name } = {}) => {
  const activeRoomId = localStorage.getItem("activeRoomId");
  if (!activeRoomId || activeRoomId !== roomId || !name) return;

  if (state.room?.roomId === roomId) {
    const filteredMembers = (state.room.members || []).filter((member) => {
      if (id) return member.id !== id;
      return member.name !== name;
    });
    state.room = { ...state.room, members: filteredMembers };
    if (state.room.status === "lobby") {
      showWaitingRoom(state.room);
    }
  }

  showToast(`${name}が退室しました`, 3000);
});

socket.on("connect", () => {
  restoreActiveRoomIfExists();
});
