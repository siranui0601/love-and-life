import * as THREE from 'https://esm.sh/three@0.164.1';
import * as CANNON from 'https://esm.sh/cannon-es@0.20.0';

const STORAGE = {
  owned: 'nohand3d.owned.v1',
  points: 'nohand3d.points.v1',
  generated: 'nohand3d.generated.v1',
  equipped: 'nohand3d.equipped.v1',
  best: 'nohand3d.best.v1',
  costLevel: 'nohand3d.costLevel.v1',
};

const SLOT_COUNT = 12;
const BASE_COST_CAP = 35;
const CHUNK = 100;
const ROAD_HALF_WIDTH = 6.8;
const BALL_R = 0.55;
const STOP_SPEED = 0.18;
const STOP_SECONDS = 2.2;

const BUILT_INS = [
  { id: 'rocket', effect: 'rocket', icon: '🚀🦵', name: 'ロケットキック', cost: 8, desc: '初速と低速時の再加速を強める。', recipe: ['🚀', '🦵'], builtIn: true },
  { id: 'iceBall', effect: 'iceBall', icon: '🧊⚽', name: '低摩擦ボール', cost: 6, desc: '転がりの減速を抑える。', recipe: ['🧊', '⚽'], builtIn: true },
  { id: 'spring', effect: 'spring', icon: '🟩🦘', name: '前方バネ床', cost: 7, desc: '止まりそうな時、前方へ跳ね上げる。', recipe: ['🟩', '🦘'], builtIn: true },
  { id: 'magnet', effect: 'magnet', icon: '🥅🧲', name: 'センター吸引', cost: 8, desc: '中央レーンへ寄せて直進性を上げる。', recipe: ['🥅', '🧲'], builtIn: true },
  { id: 'convert', effect: 'convert', icon: '🇯🇵🏃', name: '寝返り妨害', cost: 9, desc: '近い敵を短時間停止させる。', recipe: ['🇯🇵', '🏃'], builtIn: true },
  { id: 'blade', effect: 'blade', icon: '🗡️', name: 'ピッチ刀', cost: 7, desc: '近い妨害物を弾き飛ばす。', recipe: ['🗡️'], builtIn: true },
  { id: 'lane', effect: 'lane', icon: '🧊🛣️', name: '氷のライン', cost: 7, desc: '一定時間、直進時の抵抗を弱める。', recipe: ['🧊', '🛣️'], builtIn: true },
];

const EFFECTS = {
  rocket: { baseName: '推進細工', desc: '前方推進を増やす。' },
  iceBall: { baseName: '低摩擦細工', desc: '減速を抑える。' },
  spring: { baseName: '反発細工', desc: '低速時に跳ねて進む。' },
  magnet: { baseName: '直進細工', desc: '中央へ戻して進路を安定させる。' },
  convert: { baseName: '妨害停止', desc: '敵や妨害物の動きを止める。' },
  blade: { baseName: '切断装備', desc: '近い妨害物を押し返す。' },
  lane: { baseName: '氷走路', desc: '短時間だけ摩擦を下げる。' },
};

const EMOJIS = [
  { emoji: '🦵', name: 'leg', jaName: '脚', shopCategory: '身体', price: 18 },
  { emoji: '🚀', name: 'rocket', jaName: 'ロケット', shopCategory: '乗り物', price: 28 },
  { emoji: '💨', name: 'dash', jaName: '突風', shopCategory: '自然', price: 16 },
  { emoji: '🥅', name: 'goal net', jaName: 'ゴールネット', shopCategory: 'スポーツ', price: 22 },
  { emoji: '🏃', name: 'person running', jaName: '走る人', shopCategory: '身体', price: 20 },
  { emoji: '🇯🇵', name: 'flag Japan', jaName: '日本国旗', shopCategory: '旗', price: 24 },
  { emoji: '🧊', name: 'ice', jaName: '氷', shopCategory: '自然', price: 15 },
  { emoji: '🧲', name: 'magnet', jaName: '磁石', shopCategory: '道具', price: 26 },
  { emoji: '🗡️', name: 'dagger', jaName: '短剣', shopCategory: '道具', price: 22 },
  { emoji: '🦘', name: 'kangaroo', jaName: 'カンガルー', shopCategory: '動物', price: 14 },
  { emoji: '⚽', name: 'soccer ball', jaName: 'サッカーボール', shopCategory: 'スポーツ', price: 20 },
  { emoji: '🛣️', name: 'road', jaName: '道路', shopCategory: '地形', price: 12 },
  { emoji: '🔥', name: 'fire', jaName: '炎', shopCategory: '自然', price: 24 },
  { emoji: '🛡️', name: 'shield', jaName: '盾', shopCategory: '道具', price: 24 },
  { emoji: '🌀', name: 'cyclone', jaName: '渦巻き', shopCategory: '自然', price: 18 },
  { emoji: '🪨', name: 'rock', jaName: '岩', shopCategory: '地形', price: 12 },
  { emoji: '🌪️', name: 'tornado', jaName: '竜巻', shopCategory: '自然', price: 26 },
  { emoji: '⚡', name: 'lightning', jaName: '稲妻', shopCategory: '自然', price: 24 },
  { emoji: '🧪', name: 'test tube', jaName: '試験管', shopCategory: '道具', price: 16 },
  { emoji: '🛞', name: 'wheel', jaName: '車輪', shopCategory: '道具', price: 16 },
];

const THEMES = [
  { name: '芝', color: 0x167b42, side: 0x0e4f31, fog: 0x08150e, accent: 0xe8ff66 },
  { name: '荒れ芝', color: 0x4f7a34, side: 0x2a3c1f, fog: 0x15170c, accent: 0xffd36f },
  { name: '雪原', color: 0xcce8e9, side: 0x7aa4b4, fog: 0xdff7ff, accent: 0x63dfff },
  { name: '工事中', color: 0x6d552e, side: 0x332216, fog: 0x19120a, accent: 0xff9b4a },
  { name: '夜光芝', color: 0x0c4b52, side: 0x061622, fog: 0x030611, accent: 0x7cf1ff },
];

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const els = {
  root: $('#threeRoot'), kick: $('#kickBtn'), retry: $('#retryBtn'), speedBtn: $('#speedBtn'),
  distance: $('#distanceValue'), best: $('#bestValue'), speed: $('#speedValue'), biome: $('#biomeValue'), state: $('#runState'), tutorial: $('#tutorialCard'), result: $('#resultOverlay'),
  points: $('#pointsValue'), shopPoints: $('#shopPointsValue'),
  slots: $('#ballSlots'), equipList: $('#equipmentList'), equipCost: $('#equipCostValue'), clearEquip: $('#clearEquipBtn'), upgradeCost: $('#upgradeCostBtn'), upgradeHint: $('#upgradeHint'),
  genSlots: $('#generateSlots'), genOwned: $('#generateOwnedList'), genBtn: $('#generateBtn'), clearRecipe: $('#clearRecipeBtn'), recipes: $('#generatedRecipeList'),
  shopTabs: $('#shopCategoryTabs'), shopGrid: $('#emojiShopGrid'), shopSearch: $('#shopSearchInput'), cartList: $('#cartList'), cartTotal: $('#cartTotal'), buyCart: $('#buyCartBtn'), clearCart: $('#clearCartBtn'), ownedList: $('#ownedEmojiList'),
  purchaseModal: $('#purchaseModal'), purchasePreview: $('#purchasePreviewList'), purchaseTotal: $('#purchaseTotal'), confirmPurchase: $('#confirmPurchaseBtn'), cancelPurchase: $('#cancelPurchaseBtn'),
};

let points = Number(localStorage.getItem(STORAGE.points) || 120);
let owned = new Map(JSON.parse(localStorage.getItem(STORAGE.owned) || '[]'));
let generated = JSON.parse(localStorage.getItem(STORAGE.generated) || '[]');
let equipped = JSON.parse(localStorage.getItem(STORAGE.equipped) || '[]');
let bestDistance = Number(localStorage.getItem(STORAGE.best) || 0);
let costLevel = Number(localStorage.getItem(STORAGE.costLevel) || 0);
let recipe = [];
let cart = [];
let selectedEquipId = null;
let speedIndex = 1;
let running = false;
let ended = false;
let runTime = 0;
let stopTimer = 0;
let maxDistance = 0;
let lastGeneratedKey = '';
let chunks = new Map();
let dynamicEnemies = [];
let chunkObjects = [];
let visualPatches = [];
let effectCooldown = {};
let lastTs = performance.now();
if (!owned.size) ['🦵', '🚀', '💨', '🥅', '🏃', '🇯🇵'].forEach((e) => owned.set(e, 1));
equipped = Array.from({ length: SLOT_COUNT }, (_, i) => equipped[i] || null);

let scene, camera, renderer, world, ballBody, ballGroup, ballMesh, ballMaterial, groundMaterial, wallMaterial;
init3D();
resetRun();
renderAll();
requestAnimationFrame(loop);

function allGimmicks() { return [...BUILT_INS, ...generated]; }
function findGimmick(id) { return allGimmicks().find((g) => g.id === id); }
function equippedGimmicks() { return equipped.map(findGimmick).filter(Boolean); }
function hasEffect(effect) { return equippedGimmicks().some((g) => g.effect === effect); }
function equipCost() { return equippedGimmicks().reduce((sum, g) => sum + g.cost, 0); }
function costCap() { return BASE_COST_CAP + Math.floor(bestDistance / 100) * 5 + costLevel * 5; }
function upgradePrice() { return 45 + costLevel * 30; }
function save() {
  localStorage.setItem(STORAGE.points, String(points));
  localStorage.setItem(STORAGE.owned, JSON.stringify(Array.from(owned.entries())));
  localStorage.setItem(STORAGE.generated, JSON.stringify(generated));
  localStorage.setItem(STORAGE.equipped, JSON.stringify(equipped));
  localStorage.setItem(STORAGE.best, String(bestDistance));
  localStorage.setItem(STORAGE.costLevel, String(costLevel));
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function normalize(s) { return String(s || '').normalize('NFKC').toLowerCase().replace(/[\s_\-・、。]/g, ''); }
function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function init3D() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06110d, 0.012);
  camera = new THREE.PerspectiveCamera(54, 1, 0.1, 900);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  els.root.prepend(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x17251d, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(-7, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -24; sun.shadow.camera.right = 24; sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
  scene.add(sun);
  world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.allowSleep = true;
  groundMaterial = new CANNON.Material('ground');
  ballMaterial = new CANNON.Material('ball');
  wallMaterial = new CANNON.Material('wall');
  world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, ballMaterial, { friction: 0.28, restitution: 0.34 }));
  world.addContactMaterial(new CANNON.ContactMaterial(wallMaterial, ballMaterial, { friction: 0.12, restitution: 0.48 }));
  ballBody = new CANNON.Body({ mass: 1.25, shape: new CANNON.Sphere(BALL_R), material: ballMaterial, linearDamping: 0.025, angularDamping: 0.22 });
  world.addBody(ballBody);
  ballGroup = new THREE.Group();
  ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 64, 48), new THREE.MeshStandardMaterial({ map: soccerTexture(), roughness: 0.42, metalness: 0.02 }));
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  ballGroup.add(ballMesh);
  scene.add(ballGroup);
  window.addEventListener('resize', resize3D);
  resize3D();
}
function soccerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#f8fbf5'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#111'; g.lineWidth = 8;
  const centers = [[256,256,58],[90,90,44],[420,92,44],[90,420,44],[420,420,44],[256,82,42],[256,430,42]];
  for (const [x,y,r] of centers) { pent(g, x, y, r); g.fillStyle = '#111'; g.fill(); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,.42)'; g.lineWidth = 5;
  for (const [x,y] of [[170,160],[342,160],[170,350],[342,350]]) { g.beginPath(); g.arc(x,y,92,0,Math.PI*2); g.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; return tex;
}
function pent(g, x, y, r) { g.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; const px = x + Math.cos(a) * r; const py = y + Math.sin(a) * r; if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.closePath(); }
function resize3D() { const r = els.root.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); }

function resetRun() {
  running = false; ended = false; runTime = 0; stopTimer = 0; maxDistance = 0; effectCooldown = {};
  clearWorldChunks();
  ballBody.position.set(0, BALL_R + 0.08, 4);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.quaternion.set(0, 0, 0, 1);
  ensureChunks(0);
  updateBallPatches();
  els.state.textContent = '準備中';
  els.tutorial.classList.remove('hidden');
  els.result.classList.add('hidden');
  document.body.classList.remove('result-open');
}
function kick() {
  if (equipCost() > costCap()) return toastResult('COST OVER', 'コスト上限を超えています。装備を外すか、上限を強化してください。');
  resetRun();
  running = true;
  els.tutorial.classList.add('hidden');
  const boost = hasEffect('rocket') ? 3.2 : 0;
  const ice = hasEffect('iceBall') ? 1.2 : 0;
  ballBody.velocity.set(0, 1.2, -11 - boost - ice);
  ballBody.angularVelocity.set(8, 0, 0);
  els.state.textContent = '走行中';
}
function finish(reason) {
  if (ended) return;
  ended = true; running = false;
  const reward = Math.max(4, Math.floor(maxDistance / 9));
  points += reward;
  if (maxDistance > bestDistance) bestDistance = Math.floor(maxDistance);
  save(); renderAll();
  const short = maxDistance < 35;
  const title = short ? 'このままじゃダメだ！' : 'RUN END';
  const text = short ? `到達 ${Math.floor(maxDistance)}m。ボールはすぐ止まった。ショップと生成で細工を増やそう。+${reward}pt` : `到達 ${Math.floor(maxDistance)}m。${reason}。+${reward}pt`;
  showResult(title, text);
}
function showResult(title, text) {
  els.result.innerHTML = `<div class="result-card"><strong>${title}</strong><p>${text}</p><div class="result-buttons"><button id="resultEquip">装備へ</button><button id="resultRetry" class="primary">もう一回</button></div></div>`;
  els.result.classList.remove('hidden');
  document.body.classList.add('result-open');
  $('#resultRetry').addEventListener('click', () => { resetRun(); renderAll(); });
  $('#resultEquip').addEventListener('click', () => { els.result.classList.add('hidden'); document.body.classList.remove('result-open'); openTab('equip'); });
}
function toastResult(title, text) { showResult(title, text); }

function clearWorldChunks() {
  for (const item of chunkObjects) { if (item.mesh) scene.remove(item.mesh); if (item.body) world.removeBody(item.body); }
  chunkObjects = []; chunks.clear(); dynamicEnemies = [];
}
function addBodyMesh(body, mesh, chunkIndex) { world.addBody(body); scene.add(mesh); chunkObjects.push({ body, mesh, chunkIndex }); return { body, mesh }; }
function ensureChunks(distance) {
  const need = Math.floor((distance + 520) / CHUNK);
  const behind = Math.floor(distance / CHUNK) - 2;
  for (let i = 0; i <= need; i++) if (!chunks.has(i)) createChunk(i);
  for (const [i, group] of [...chunks]) if (i < behind) removeChunk(i, group);
}
function removeChunk(i, group) {
  for (const obj of group) { if (obj.mesh) scene.remove(obj.mesh); if (obj.body) world.removeBody(obj.body); }
  chunkObjects = chunkObjects.filter((o) => o.chunkIndex !== i);
  dynamicEnemies = dynamicEnemies.filter((e) => e.chunkIndex !== i);
  chunks.delete(i);
}
function createChunk(i) {
  const group = [];
  const theme = THEMES[i % THEMES.length];
  const z = -(i * CHUNK + CHUNK / 2);
  const groundMesh = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.08, CHUNK), new THREE.MeshStandardMaterial({ color: theme.color, roughness: 0.82 }));
  groundMesh.position.set(0, -0.04, z); groundMesh.receiveShadow = true;
  const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, material: groundMaterial, shape: new CANNON.Box(new CANNON.Vec3(7.8, 0.04, CHUNK / 2)) });
  groundBody.position.set(0, -0.04, z); group.push(addBodyMesh(groundBody, groundMesh, i));
  addRails(i, z, theme, group);
  addDecor(i, z, theme, group);
  addObstacles(i, theme, group);
  chunks.set(i, group);
}
function addRails(i, z, theme, group) {
  for (const x of [-7.9, 7.9]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.42, CHUNK), new THREE.MeshStandardMaterial({ color: theme.side, roughness: 0.68 }));
    mesh.position.set(x, 0.18, z); mesh.castShadow = mesh.receiveShadow = true;
    const body = new CANNON.Body({ type: CANNON.Body.STATIC, material: wallMaterial, shape: new CANNON.Box(new CANNON.Vec3(0.125, 0.21, CHUNK / 2)) });
    body.position.copy(mesh.position); group.push(addBodyMesh(body, mesh, i));
  }
}
function addDecor(i, z, theme, group) {
  const accent = new THREE.Color(theme.accent);
  for (let n = 0; n < 6; n++) {
    const side = n % 2 ? -1 : 1;
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.18 + (n % 3) * 0.05, 0.7, 16), new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, emissive: i % 5 === 4 ? accent : 0x000000, emissiveIntensity: i % 5 === 4 ? 0.18 : 0 }));
    mesh.position.set(side * (8.8 + (n % 2) * 0.8), 0.35, z - CHUNK / 2 + 12 + n * 14);
    mesh.castShadow = true; scene.add(mesh); group.push({ mesh, chunkIndex: i });
  }
}
function addObstacles(i, theme, group) {
  if (i === 0) return;
  const baseZ = -i * CHUNK;
  const pattern = i % 4;
  if (pattern === 0 || pattern === 2) addBlocker(i, -2.4, baseZ - 28, 2.2, 1.0, 0.75, theme, group);
  if (pattern === 0 || pattern === 3) addBlocker(i, 2.5, baseZ - 58, 2.6, 1.0, 0.75, theme, group);
  if (pattern === 1) { addBlocker(i, -4.5, baseZ - 34, 1.5, 1.1, 0.75, theme, group); addBlocker(i, 4.5, baseZ - 70, 1.5, 1.1, 0.75, theme, group); }
  if (i >= 2) addEnemy(i, (i % 2 ? -2.4 : 2.4), baseZ - 48, theme, group);
  if (i >= 4 && i % 3 === 0) addEnemy(i, 0, baseZ - 82, theme, group);
}
function addBlocker(i, x, z, w, d, h, theme, group) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: i % 5 === 3 ? 0xffa13d : 0x2d2f33, roughness: 0.5, metalness: 0.05 }));
  mesh.position.set(x, h / 2, z); mesh.castShadow = mesh.receiveShadow = true;
  const body = new CANNON.Body({ type: CANNON.Body.STATIC, material: wallMaterial, shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)) });
  body.position.copy(mesh.position); group.push(addBodyMesh(body, mesh, i));
}
function addEnemy(i, x, z, theme, group) {
  const body = new CANNON.Body({ type: CANNON.Body.KINEMATIC, material: wallMaterial, shape: new CANNON.Box(new CANNON.Vec3(0.45, 0.85, 0.32)) });
  body.position.set(x, 0.85, z);
  const mesh = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff4343, roughness: 0.38, emissive: 0x3a0000, emissiveIntensity: 0.2 });
  const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 6, 14), mat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffc29b, roughness: 0.4 }));
  bodyMesh.castShadow = head.castShadow = true; head.position.y = 0.7; mesh.add(bodyMesh, head); mesh.position.copy(body.position);
  group.push(addBodyMesh(body, mesh, i));
  dynamicEnemies.push({ chunkIndex: i, body, mesh, baseX: x, z, amp: 1.15 + (i % 3) * 0.45, phase: i * 0.7, disabledUntil: 0 });
}

function updateEnemies(time) {
  for (const e of dynamicEnemies) {
    const disabled = runTime < e.disabledUntil;
    const x = disabled ? e.body.position.x : e.baseX + Math.sin(time * 1.25 + e.phase) * e.amp;
    e.body.position.set(x, 0.85, e.z);
    e.body.velocity.set(0, 0, 0);
    e.mesh.position.copy(e.body.position);
    e.mesh.rotation.y = Math.sin(time + e.phase) * 0.16;
    e.mesh.visible = !disabled;
    const dx = ballBody.position.x - e.body.position.x;
    const dz = ballBody.position.z - e.body.position.z;
    if (!disabled && Math.hypot(dx, dz) < 1.25) {
      ballBody.velocity.x *= 0.48;
      ballBody.velocity.z *= 0.35;
      ballBody.velocity.z += 0.8;
    }
  }
}
function applyEquipment(dt) {
  const v = ballBody.velocity;
  const forward = Math.max(0, -v.z);
  let drag = hasEffect('iceBall') || hasEffect('lane') ? 0.996 : 0.990;
  v.x *= drag; v.z *= drag;
  if (hasEffect('magnet')) { v.x += -ballBody.position.x * 0.012; v.z -= 0.012; }
  if (hasEffect('rocket') && forward < 3.2 && ready('rocket', 2.2)) v.z -= 3.6;
  if (hasEffect('spring') && forward < 2.2 && ready('spring', 3.8)) { v.y += 2.4; v.z -= 4.8; flashPad(ballBody.position.x, ballBody.position.z - 2.2); }
  if (hasEffect('blade') && ready('blade', 1.2)) disableNearEnemy(2.2, 3.5);
  if (hasEffect('convert') && ready('convert', 3.0)) disableNearEnemy(3.4, 4.2);
}
function ready(k, sec) { if ((effectCooldown[k] || -99) + sec > runTime) return false; effectCooldown[k] = runTime; return true; }
function disableNearEnemy(radius, duration) { for (const e of dynamicEnemies) { const dx = ballBody.position.x - e.body.position.x; const dz = ballBody.position.z - e.body.position.z; if (Math.hypot(dx, dz) < radius) e.disabledUntil = runTime + duration; } }
function flashPad(x, z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.04, 32), new THREE.MeshBasicMaterial({ color: 0xe8ff66, transparent: true, opacity: 0.55 }));
  mesh.position.set(x, 0.045, z); mesh.rotation.x = Math.PI / 2; scene.add(mesh);
  setTimeout(() => scene.remove(mesh), 520);
}

function updateBallVisual() {
  ballGroup.position.copy(ballBody.position);
  ballGroup.quaternion.copy(ballBody.quaternion);
  camera.position.x += (ballBody.position.x * 0.55 - camera.position.x) * 0.06;
  camera.position.y += (5.8 - camera.position.y) * 0.06;
  camera.position.z += (ballBody.position.z + 9.5 - camera.position.z) * 0.06;
  camera.lookAt(ballBody.position.x * 0.45, 0.8, ballBody.position.z - 6);
}
function updateBallPatches() {
  visualPatches.forEach((p) => ballGroup.remove(p));
  visualPatches = [];
  const positions = [[0,1,0],[.75,.45,.5],[-.75,.45,.5],[.75,.45,-.5],[-.75,.45,-.5],[0,.2,1],[0,.2,-1],[.95,-.15,0],[-.95,-.15,0],[.52,-.65,.42],[-.52,-.65,.42],[0,-.82,-.45]];
  equipped.forEach((id, i) => {
    const g = findGimmick(id); if (!g) return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(g.icon), transparent: true, depthTest: false }));
    const p = new THREE.Vector3(...positions[i]).normalize().multiplyScalar(BALL_R + 0.03);
    sprite.position.copy(p); sprite.scale.set(0.28, 0.28, 0.28); ballGroup.add(sprite); visualPatches.push(sprite);
  });
}
function emojiTexture(txt) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = 'rgba(232,255,102,.9)'; g.beginPath(); g.arc(64,64,58,0,Math.PI*2); g.fill(); g.font = '56px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt,64,67); return new THREE.CanvasTexture(c); }

function loop(now) {
  const dt = Math.min((now - lastTs) / 1000, 0.05);
  lastTs = now;
  if (running && !ended) {
    runTime += dt;
    updateEnemies(runTime);
    applyEquipment(dt);
    world.step(1 / 60, dt, 3);
    maxDistance = Math.max(maxDistance, -ballBody.position.z);
    ensureChunks(maxDistance);
    const horizontalSpeed = Math.hypot(ballBody.velocity.x, ballBody.velocity.z);
    stopTimer = horizontalSpeed < STOP_SPEED && maxDistance > 2 ? stopTimer + dt : 0;
    if (stopTimer > STOP_SECONDS) finish('ボールが完全に止まりました');
    if (Math.abs(ballBody.position.x) > ROAD_HALF_WIDTH + 2 || ballBody.position.y < -3) finish('コート外へ落下しました');
  }
  updateBallVisual();
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
function updateHud() {
  const dist = Math.floor(maxDistance);
  const spd = Math.hypot(ballBody.velocity.x, ballBody.velocity.z).toFixed(1);
  els.distance.textContent = `${dist}m`; els.best.textContent = `${Math.floor(bestDistance)}m`; els.speed.textContent = spd;
  els.points.textContent = points; els.shopPoints.textContent = points;
  const theme = THEMES[Math.floor(dist / CHUNK) % THEMES.length];
  els.biome.textContent = theme.name;
  scene.fog.color.setHex(theme.fog);
  els.state.textContent = ended ? '終了' : running ? '走行中' : '準備中';
  els.speedBtn.textContent = ['0.5x','等速','2x'][speedIndex];
}

function renderAll() { renderEquip(); renderGenerate(); renderShop(); save(); updateBallPatches(); updateHud(); }
function renderEquip() {
  els.equipCost.textContent = `${equipCost()}/${costCap()}`;
  const price = upgradePrice();
  els.upgradeCost.textContent = `上限+5 (${price}pt)`;
  els.upgradeCost.disabled = points < price;
  els.upgradeHint.textContent = `最高距離100mごとに+5。現在は強化${costLevel}回。`;
  els.slots.replaceChildren();
  for (let i = 0; i < SLOT_COUNT; i++) {
    const id = equipped[i]; const g = findGimmick(id);
    const b = document.createElement('button'); b.type = 'button'; b.className = `slot-btn ${g ? 'filled' : ''}`;
    const angle = -90 + i * 360 / SLOT_COUNT; const radius = i === 0 ? 50 : 43;
    b.style.left = `${50 + Math.cos(angle * Math.PI / 180) * radius}%`; b.style.top = `${50 + Math.sin(angle * Math.PI / 180) * radius}%`;
    b.innerHTML = g ? `<span class="slot-icon">${g.icon}</span><small>${i + 1}</small>` : `<small>${i + 1}</small>`;
    b.addEventListener('click', () => clickSlot(i)); els.slots.appendChild(b);
  }
  els.equipList.replaceChildren(...allGimmicks().map((g) => {
    const isEquipped = equipped.includes(g.id);
    const card = document.createElement('div'); card.className = `equip-item ${isEquipped ? 'is-equipped' : ''}`;
    card.innerHTML = `<div class="equip-icon">${g.icon}</div><div class="equip-text"><strong>${g.name}</strong><small>${g.desc} / cost ${g.cost}</small></div><button type="button">${isEquipped ? '装備中' : '選択'}</button>`;
    card.querySelector('button').disabled = isEquipped;
    card.querySelector('button').addEventListener('click', () => { selectedEquipId = g.id; document.querySelectorAll('.equip-item').forEach((e) => e.classList.remove('selected')); card.classList.add('selected'); });
    return card;
  }));
}
function clickSlot(i) {
  if (selectedEquipId) {
    if (equipped.includes(selectedEquipId)) return;
    const before = equipped[i]; equipped[i] = selectedEquipId;
    if (equipCost() > costCap()) { equipped[i] = before; return toastResult('COST OVER', 'コスト上限を超えています。装備を減らすか上限を強化してください。'); }
    selectedEquipId = null; renderAll(); return;
  }
  equipped[i] = null; renderAll();
}
function clearEquip() { equipped = Array(SLOT_COUNT).fill(null); selectedEquipId = null; renderAll(); }
function upgradeCap() { const price = upgradePrice(); if (points < price) return; points -= price; costLevel++; renderAll(); }

function renderGenerate() {
  els.genSlots.replaceChildren(...[0,1,2].map((i) => { const e = recipe[i]; const b = document.createElement('button'); b.type = 'button'; b.className = `recipe-slot ${e ? 'filled' : ''}`; b.innerHTML = e ? `<span class="slot-emoji">${e}</span>` : `${i + 1}`; if (e) b.addEventListener('click', () => { recipe.splice(i,1); renderGenerate(); }); return b; }));
  els.genBtn.disabled = recipe.length === 0;
  els.genOwned.replaceChildren(...Array.from(owned.entries()).map(([emoji,count]) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'generate-owned-card'; b.disabled = recipe.length >= 3; b.innerHTML = `<span>${emoji}</span><small>×${count}</small>`; b.addEventListener('click', () => { if (recipe.length < 3) { recipe.push(emoji); renderGenerate(); } }); return b; }));
  els.recipes.replaceChildren(...allGimmicks().map((g) => { const row = document.createElement('div'); row.className = 'recipe-item'; row.innerHTML = `<div class="equip-icon">${g.icon}</div><div class="equip-text"><strong>${g.name}</strong><small>${g.recipe.join(' + ')} / cost ${g.cost}</small></div><button type="button">選択</button>`; row.querySelector('button').addEventListener('click', () => { selectedEquipId = g.id; openTab('equip'); }); return row; }));
}
function generate() {
  if (!recipe.length) return;
  const key = recipe.join('');
  const existing = allGimmicks().find((g) => g.recipe.join('') === key);
  if (existing) { selectedEquipId = existing.id; recipe = []; renderAll(); openTab('equip'); return; }
  const effect = chooseEffect(recipe);
  const h = hash(recipe.join('|'));
  const base = EFFECTS[effect];
  const item = { id: `gen_${h.toString(36)}`, effect, icon: recipe.join(''), name: `${recipe.join('')}${base.baseName}`.slice(0, 18), cost: 6 + (h % 9), desc: base.desc, recipe: [...recipe], builtIn: false };
  generated.unshift(item); selectedEquipId = item.id; recipe = []; lastGeneratedKey = item.id; renderAll(); openTab('equip');
}
function chooseEffect(r) { const s = r.join(''); if (/[🚀🦵💨⚡]/u.test(s)) return 'rocket'; if (/[🧊⚽🛞]/u.test(s)) return 'iceBall'; if (/[🦘🟩]/u.test(s)) return 'spring'; if (/[🧲🥅🌀]/u.test(s)) return 'magnet'; if (/[🇯🇵🏃🛡️]/u.test(s)) return 'convert'; if (/[🗡️🔥]/u.test(s)) return 'blade'; if (/[🛣️🌪️]/u.test(s)) return 'lane'; return ['rocket','iceBall','spring','magnet','blade','lane'][hash(s) % 6]; }

function renderShop() {
  const cats = ['すべて', ...new Set(EMOJIS.map((e) => e.shopCategory))];
  els.shopTabs.replaceChildren(...cats.map((c) => { const b = document.createElement('button'); b.type = 'button'; b.className = c === shopCategory ? 'is-active' : ''; b.textContent = c; b.addEventListener('click', () => { shopCategory = c; renderShop(); }); return b; }));
  const q = normalize(els.shopSearch.value);
  const filtered = EMOJIS.filter((e) => (shopCategory === 'すべて' || e.shopCategory === shopCategory) && (!q || normalize(`${e.emoji}${e.name}${e.jaName}${e.shopCategory}`).includes(q)));
  els.shopGrid.replaceChildren(...filtered.map((e) => { const inCart = cart.some((c) => c.emoji === e.emoji); const b = document.createElement('button'); b.type = 'button'; b.className = `emoji-shop-card ${inCart ? 'in-cart' : ''}`; b.title = `${e.jaName} / ${e.name}`; b.innerHTML = `<span class="shop-emoji">${e.emoji}</span><span class="emoji-price">${e.price}</span>`; b.addEventListener('click', () => toggleCart(e)); return b; }));
  renderCart(); renderOwned();
}
function toggleCart(e) { const i = cart.findIndex((c) => c.emoji === e.emoji); if (i >= 0) cart.splice(i, 1); else cart.push(e); renderShop(); }
function renderCart() { const total = cart.reduce((s,e) => s + e.price, 0); els.cartTotal.textContent = total; els.buyCart.disabled = !cart.length || total > points; if (!cart.length) { els.cartList.innerHTML = '<div class="cart-empty">棚の絵文字をタップ</div>'; return; } els.cartList.replaceChildren(...cart.map((e) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'cart-chip'; b.textContent = `${e.emoji} ${e.price}`; b.addEventListener('click', () => toggleCart(e)); return b; })); }
function renderOwned() { els.ownedList.replaceChildren(...Array.from(owned.entries()).map(([emoji,count]) => { const s = document.createElement('span'); s.className = 'owned-chip'; s.textContent = count > 1 ? `${emoji}×${count}` : emoji; return s; })); }
function openPurchase() { if (!cart.length) return; const total = cart.reduce((s,e) => s + e.price, 0); if (total > points) return; els.purchaseTotal.textContent = total; els.purchasePreview.replaceChildren(...cart.map((e) => { const d = document.createElement('div'); d.className = 'purchase-preview-item'; d.innerHTML = `<span>${e.emoji}</span><small>${e.price}</small>`; return d; })); els.purchaseModal.classList.remove('hidden'); }
function closePurchase() { els.purchaseModal.classList.add('hidden'); }
function confirmPurchase() { const total = cart.reduce((s,e) => s + e.price, 0); if (total > points) return; points -= total; for (const e of cart) owned.set(e.emoji, (owned.get(e.emoji) || 0) + 1); cart = []; closePurchase(); renderAll(); }

function openTab(name) { $$('.tab-button').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name)); $$('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name)); resize3D(); }
function tabListeners() { $$('.tab-button').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab))); }

tabListeners();
els.kick.addEventListener('click', kick);
els.retry.addEventListener('click', () => { resetRun(); renderAll(); });
els.speedBtn.addEventListener('click', () => { speedIndex = (speedIndex + 1) % 3; els.speedBtn.textContent = ['0.5x','等速','2x'][speedIndex]; });
els.clearEquip.addEventListener('click', clearEquip);
els.upgradeCost.addEventListener('click', upgradeCap);
els.genBtn.addEventListener('click', generate);
els.clearRecipe.addEventListener('click', () => { recipe = []; renderGenerate(); });
els.shopSearch.addEventListener('input', renderShop);
els.buyCart.addEventListener('click', openPurchase);
els.clearCart.addEventListener('click', () => { cart = []; renderShop(); });
els.confirmPurchase.addEventListener('click', confirmPurchase);
els.cancelPurchase.addEventListener('click', closePurchase);
els.purchaseModal.addEventListener('click', (e) => { if (e.target === els.purchaseModal) closePurchase(); });
