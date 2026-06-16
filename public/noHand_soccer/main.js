import { app, ownedEmojis, savePlacements, recalcCost } from './state.js';
import { call } from './socket-client.js';
import { SoccerPhysics } from './physics.js';
import { createDragManager } from './drag-manager.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const TUTORIAL_OBJECTIVES = {
  intro: { text: 'まずはキックして、何が起きるか見てみよう。', tab: 'match', label: '試合へ' },
  firstKick: { text: 'キックボタンを押してみよう。何もしないと当然負ける。', tab: 'match', label: '試合へ' },
  ownGoalResult: { text: 'OWN GOALの結果画面から「細工を施す」を押そう。', tab: 'match', label: '結果へ' },
  goShop: { text: 'ショップへ移動して、最初の素材を受け取ろう。', tab: 'shop', label: 'ショップへ' },
  receiveInitialEmojis: { text: '初期セットを0Pで受け取ろう。', tab: 'shop', label: 'ショップへ' },
  goGenerate: { text: '生成へ移動して、絵文字を組み合わせよう。', tab: 'gen', label: '生成へ' },
  generateFirstGimmick: { text: '所持絵文字を1〜3個選んで、最初のギミックを生成しよう。', tab: 'gen', label: '生成へ' },
  goMatch: { text: '試合へ移動して、生成したギミックを貼り付けよう。', tab: 'match', label: '試合へ' },
  placeGimmick: { text: 'ギミックカードをドラッグして、コートや選手に貼り付けよう。', tab: 'match', label: '試合へ' },
  retryWithGimmick: { text: '配置できた。もう一度キックしてゴールを狙おう。', tab: 'match', label: '試合へ' },
};

const sim = new SoccerPhysics($('#field'));
let cart = [];
let curCat = '';
let shopClicks = 0;
let drag;
let lastTrayKey = '';
let lastHudAt = 0;
let lastLogKey = '';
let visibleTab = 'match';
let shopEventsBound = false;

function toast(text) {
  $('#toast').textContent = text;
  $('#toast').classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('#toast').classList.add('hidden'), 1800);
}

function modal(text, actions = [['OK', () => {}]]) {
  $('#modalText').textContent = text;
  $('#modalActions').innerHTML = '';
  for (const [label, fn, className = 'primary'] of actions) {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = className;
    button.onclick = () => {
      $('#modal').classList.add('hidden');
      fn?.();
    };
    $('#modalActions').append(button);
  }
  $('#modal').classList.remove('hidden');
}

function hideModal() {
  $('#modal').classList.add('hidden');
}

function updateCoachPanel() {
  const state = app.userState.tutorialDone ? 'complete' : (app.userState.tutorialState || 'intro');
  const objective = TUTORIAL_OBJECTIVES[state];
  const panel = $('#coachPanel');
  if (!objective) {
    panel.classList.add('hidden');
    return;
  }
  $('#coachText').textContent = objective.text;
  $('#coachAction').textContent = objective.label;
  $('#coachAction').onclick = () => show(objective.tab);
  panel.classList.remove('hidden');
}

function show(id) {
  if ($('#resultLayer') && !$('#resultLayer').classList.contains('hidden')) return;
  visibleTab = id;
  $$('.panel').forEach((panel) => panel.classList.add('hidden'));
  $('#' + id).classList.remove('hidden');
  $$('.bottom-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.tab === id));
  updateCoachPanel();
  if (id === 'shop') renderShop();
  if (id === 'gen') renderGen();
  if (id === 'match') renderMatch({ forceTray: true });
  if (id === 'book') renderBook();
  if (id === 'debug') renderDebug();
}

async function init() {
  app.catalog = (await call('noHand:getCatalog')).catalog || [];
  const response = await call('noHand:getUserState');
  app.userState = response.state || {};
  app.versions = response.versions || {};
  await loadGimmicks();
  drag = createDragManager({ canvas: $('#field'), sim, state: app, onDrop: addPlacement, toast });
  bindEvents();
  retry({ keepResult: false });
  if (!app.userState.tutorialDone) {
    await ensureTutorialState();
    show('match');
    runTutorial();
  } else {
    show('match');
  }
  loop();
}

async function loadGimmicks() {
  app.ownedGimmicks = (await call('noHand:getOwnedGimmicks')).gimmicks || [];
  lastTrayKey = '';
}

async function ensureTutorialState() {
  if (!app.userState.tutorialState) await setTut('intro', false, { silent: true });
}

function bindEvents() {
  $$('.bottom-tabs button').forEach((button) => {
    button.onclick = () => {
      if (button.dataset.tab === 'shop') {
        shopClicks += 1;
        if (shopClicks >= 10) {
          shopClicks = 0;
          modal('デバッグパスワードを入力', [
            ['0601で開く', () => { app.debug = true; show('debug'); }],
            ['やめる', () => {}],
          ]);
          return;
        }
      } else {
        shopClicks = 0;
      }
      show(button.dataset.tab);
    };
  });

  $('#generateBtn').onclick = generate;
  $('#playBtn').onclick = startMatch;
  $('#pauseBtn').onclick = () => { app.playing = false; };
  $('#retryBtn').onclick = () => retry();
  $('#undoPlace').onclick = () => {
    app.placements.pop();
    savePlacements();
    retry();
    renderMatch({ forceTray: true });
  };
  $('#clearPlace').onclick = clearPlaces;
  $('#rankBtn').onclick = showRank;
  $('#bookRankBtn').onclick = showRank;
  $('#closeRank').onclick = () => show('match');
  $('#rankType').onchange = drawRank;

  $('#forceGoal').onclick = () => finish({ type: 'clear', clearTime: sim.time });
  $('#forceOwn').onclick = () => finish({ type: 'ownGoal', clearTime: sim.time });
  $('#addPoints').onclick = async () => {
    const response = await call('noHand:awardPoints', { points: 500 });
    app.userState = response.state;
    refreshAfterStateChange();
  };
  $('#allEmoji').onclick = async () => {
    const response = await call('noHand:buyEmojis', { emojis: app.catalog.map((x) => x.emoji) });
    if (response.ok) app.userState = response.state;
    refreshAfterStateChange();
  };
  $('#resetTut').onclick = async () => {
    await setTut('intro', false);
    runTutorial();
  };
  $('#debugClear').onclick = clearPlaces;
  $('#hitToggle').onclick = () => { app.showHit = !app.showHit; };
  $('#togglePhysics').onclick = () => { app.playing = !app.playing; };
  $('#stepFrame').onclick = () => {
    sim.step();
    sim.draw(app.showHit);
    updateMatchHud(true);
  };
}

function points() {
  $('#points').textContent = Number(app.userState.ideaPoints || 0);
}

function refreshAfterStateChange() {
  points();
  updateCoachPanel();
  if (visibleTab === 'shop') renderShop();
  if (visibleTab === 'gen') renderGen();
  if (visibleTab === 'match') renderMatch({ forceTray: true });
  if (visibleTab === 'book') renderBook();
}

function renderShop() {
  points();
  if (!shopEventsBound) {
    $('#shopSearch').oninput = () => renderShop();
    $('#shopFilter').onchange = () => renderShop();
    $('#shopSort').onchange = () => renderShop();
    shopEventsBound = true;
  }

  const categories = [...new Set(app.catalog.map((item) => item.shopCategory || 'その他'))];
  if (!curCat) curCat = categories[0] || 'その他';
  $('#shopTabs').innerHTML = categories.map((category) => (
    `<button class="${category === curCat ? 'active' : ''}" data-cat="${category}">${category}</button>`
  )).join('');
  $$('#shopTabs button').forEach((button) => {
    button.onclick = () => {
      curCat = button.dataset.cat;
      renderShop();
    };
  });

  renderInitialSetCard();

  const query = ($('#shopSearch').value || '').toLowerCase();
  const filter = $('#shopFilter').value;
  const sort = $('#shopSort').value;
  const owned = ownedEmojis();

  let items = app.catalog
    .filter((item) => (item.shopCategory || 'その他') === curCat)
    .filter((item) => !query || `${item.emoji}${item.name}${item.jaName}`.toLowerCase().includes(query))
    .filter((item) => filter === 'owned' ? owned.has(item.emoji) : filter === 'unowned' ? !owned.has(item.emoji) : true);

  items.sort((a, b) => {
    if (sort === 'priceDesc') return Number(b.price) - Number(a.price);
    if (sort === 'name') return String(a.jaName || a.name).localeCompare(String(b.jaName || b.name), 'ja');
    return Number(a.price) - Number(b.price);
  });

  $('#shopGrid').innerHTML = items.map((item) => {
    const isOwned = owned.has(item.emoji);
    const inCart = cart.includes(item.emoji);
    return `
      <button class="shop-card ${isOwned ? 'owned' : ''}" data-e="${item.emoji}">
        ${inCart ? '<span class="badge">カート内</span>' : ''}
        <span class="emoji">${item.emoji}</span>
        <span class="name">${item.jaName || item.name}</span>
        <span class="price">${isOwned ? '所持済み' : `${item.price}P`}</span>
      </button>
    `;
  }).join('');

  $$('.shop-card').forEach((card) => {
    card.onclick = () => {
      const emoji = card.dataset.e;
      if (owned.has(emoji)) return;
      cart = cart.includes(emoji) ? cart.filter((e) => e !== emoji) : [...cart, emoji];
      renderShop();
    };
  });

  drawCart();
}

function renderInitialSetCard() {
  const state = app.userState.tutorialState;
  const card = $('#initialSetCard');
  if (state !== 'receiveInitialEmojis') {
    card.classList.add('hidden');
    card.innerHTML = '';
    return;
  }
  card.classList.remove('hidden');
  card.innerHTML = `
    <h3>初期セットを受け取ろう</h3>
    <p>この6つの絵文字が、最初の反則スレスレ素材だ。</p>
    <div class="initial-emojis">${['🦵', '🚀', '💨', '🥅', '🏃', '🇯🇵'].map((e) => `<span>${e}</span>`).join('')}</div>
    <p><b>価格：0P</b></p>
    <button id="receiveInitial" class="primary wide-btn">初期セットを受け取る</button>
  `;
  $('#receiveInitial').onclick = receiveInitialEmojis;
}

async function receiveInitialEmojis() {
  const response = await call('noHand:receiveInitialEmojis');
  if (!response.ok) return toast(response.error);
  app.userState = response.state;
  await setTut('goGenerate');
  renderShop();
  modal('いいぞ。次は、受け取った絵文字を組み合わせてギミックを作るぞ。', [
    ['生成へ', async () => { await setTut('generateFirstGimmick'); show('gen'); }],
    ['あとで', () => updateCoachPanel()],
  ]);
}

function drawCart() {
  const total = cart.reduce((sum, emoji) => sum + Number(app.catalog.find((item) => item.emoji === emoji)?.price || 0), 0);
  $('#cart').innerHTML = `
    <strong>カート</strong>
    <span class="cart-emojis">${cart.join(' ') || '空'}</span>
    <b>${total}P</b>
    <button id="buyBtn" ${cart.length ? '' : 'disabled'}>購入確定</button>
  `;
  $('#buyBtn').onclick = () => {
    if (!cart.length) return;
    modal(`${total}Pで購入しますか？`, [
      ['購入する', async () => {
        const response = await call('noHand:buyEmojis', { emojis: cart });
        if (!response.ok) return toast(response.error);
        app.userState = response.state;
        cart = [];
        refreshAfterStateChange();
      }],
      ['やめる', () => {}],
    ]);
  };
}

function renderGen() {
  points();
  const owned = [...ownedEmojis()];
  $('#ownedEmoji').innerHTML = owned.map((emoji) => `<button class="emoji-chip" data-add="${emoji}">${emoji}</button>`).join('');
  $$('[data-add]').forEach((button) => {
    button.onclick = () => {
      if (app.selectedEmojiArray.length >= 3) return toast('絵文字は3個まで');
      app.selectedEmojiArray.push(button.dataset.add);
      renderGen();
    };
  });
  const free = app.userState.tutorialState === 'generateFirstGimmick';
  $('#seq').innerHTML = `
    <b>選択中</b>
    <div class="seq-emojis">${app.selectedEmojiArray.join(' ') || '未選択'}</div>
    <button id="clearSeq">選択を消す</button>
    <span>${free ? 'チュートリアル初回無料' : '生成 30P'}</span>
  `;
  $('#clearSeq').onclick = () => {
    app.selectedEmojiArray = [];
    renderGen();
  };
  $('#generateBtn').textContent = free ? '無料で最初のギミックを生成' : '30Pでギミック生成';
}

async function generate() {
  const emojiArray = [...app.selectedEmojiArray];
  if (emojiArray.length < 1) return toast('1〜3個選んでください');
  const free = app.userState.tutorialState === 'generateFirstGimmick';
  const response = await call('noHand:generateGimmick', { emojiArray, tutorialFree: free });
  if (!response.ok) return toast(response.error);
  app.userState = response.state;
  await loadGimmicks();
  app.selectedEmojiArray = [];
  $('#generated').classList.remove('hidden');
  $('#generated').innerHTML = `
    <img src="${response.gimmick.imagePath}" alt="">
    <b>${response.gimmick.name}</b>
    <p>${response.gimmick.flavor}</p>
  `;
  renderGen();
  renderMatch({ forceTray: true });
  renderBook();
  if (free) {
    await setTut('goMatch');
    modal('できた！そのギミックを試合画面でドラッグして貼り付けよう。', [
      ['試合へ', async () => { await setTut('placeGimmick'); show('match'); }],
    ]);
  }
}

function renderMatch({ forceTray = false } = {}) {
  updateMatchHud(true);
  renderGimmickTray(forceTray);
  updateLog(true);
}

function updateMatchHud(force = false) {
  const now = performance.now();
  if (!force && now - lastHudAt < 100) return;
  lastHudAt = now;
  recalcCost();
  $('#cost').textContent = `${app.usedCost}/30`;
  $('#timer').textContent = sim.time.toFixed(2);
}

function renderGimmickTray(force = false) {
  const key = app.ownedGimmicks.map((g) => `${g.itemId}:${g.cost}`).join('|');
  if (!force && key === lastTrayKey) return;
  lastTrayKey = key;
  $('#gimmickTray').innerHTML = app.ownedGimmicks.map((gimmick) => `
    <div class="gimmick-card" data-g="${gimmick.itemId}">
      <img src="${gimmick.imagePath}" alt="">
      <b>${gimmick.name}</b>
      <small>${gimmick.emojiSequence} / cost:${gimmick.cost}</small>
    </div>
  `).join('');
  $$('.gimmick-card').forEach((element) => {
    drag?.bind(element, app.ownedGimmicks.find((gimmick) => gimmick.itemId === element.dataset.g));
  });
}

function updateLog(force = false) {
  const key = sim.logs.map((log) => `${log.name}:${log.t}`).join('|');
  if (!force && key === lastLogKey) return;
  lastLogKey = key;
  $('#log').innerHTML = sim.logs.map((log) => `<div class="logline">${log.name}</div>`).join('');
}

function addPlacement(gimmick, hit) {
  if (recalcCost() + Number(gimmick.cost || 0) > 30) return toast('使用コスト30を超えます');
  app.placements.push({
    placementId: crypto.randomUUID(),
    itemId: gimmick.itemId,
    gimmick,
    attachType: hit.attachType,
    attachTargetId: hit.attachTargetId,
    x: hit.x,
    y: hit.y,
    createdAt: new Date().toISOString(),
  });
  savePlacements();
  retry({ keepResult: false });
  if (app.userState.tutorialState === 'placeGimmick') {
    setTut('retryWithGimmick');
    modal('貼れた！もう一度キックして、今度こそゴールを狙おう。', [
      ['キックへ', () => show('match')],
    ]);
  }
  renderMatch({ forceTray: true });
}

function startMatch() {
  hideResult();
  hideModal();
  if (sim.result) retry({ keepResult: false });
  app.playing = true;
  updateCoachPanel();
}

function retry({ keepResult = false } = {}) {
  app.playing = false;
  sim.setup();
  sim.applyPlacements(app.placements);
  if (!keepResult) hideResult();
  updateMatchHud(true);
  updateLog(true);
}

function clearPlaces() {
  app.placements = [];
  savePlacements();
  retry();
  renderMatch({ forceTray: true });
}

function renderBook() {
  $('#bookList').innerHTML = app.ownedGimmicks.map((gimmick) => `
    <div class="book-row">
      <img src="${gimmick.imagePath}" alt="">
      <h3>${gimmick.emojiSequence} ${gimmick.name}</h3>
      <p>${gimmick.flavor}</p>
      <p>cost:${gimmick.cost} / 装着:${gimmick.allowedAttachTo.join(', ')} / ${gimmick.visualLabel}</p>
      <p>${(gimmick.rules || []).flatMap((rule) => rule.actions || []).map((action) => action.type).join(' + ')}</p>
      <button data-use="${gimmick.itemId}">試合で使う</button>
    </div>
  `).join('');
  $$('[data-use]').forEach((button) => {
    button.onclick = () => show('match');
  });
}

async function showRank() {
  show('ranking');
  await drawRank();
}

async function drawRank() {
  const response = await call('noHand:getRankings', { stageId: app.stageId, rankingType: $('#rankType').value });
  $('#rankList').innerHTML = (response.rankings || []).map((row, index) => `
    <div class="book-row">
      <b>#${index + 1} ${row.userName}</b>
      <p>${Number(row.clearTime).toFixed(2)}秒 / cost:${row.usedCost} / ${row.createdAt}</p>
      <details><summary>配置を見る</summary><pre>${row.placementsJson}</pre></details>
    </div>
  `).join('');
}

function showResult({ title, sub, buttonLabel, onNext }) {
  const layer = $('#resultLayer');
  layer.innerHTML = `
    <div class="result-card">
      <div class="result-title">${title}</div>
      <div class="result-sub">${sub}</div>
      <button id="resultNext" class="primary">${buttonLabel}</button>
    </div>
  `;
  layer.classList.remove('hidden');
  $('#resultNext').onclick = async () => {
    hideResult();
    await onNext?.();
  };
}

function hideResult() {
  $('#resultLayer').classList.add('hidden');
  $('#resultLayer').innerHTML = '';
}

async function finish(result) {
  app.playing = false;
  const tutorialState = app.userState.tutorialState || 'intro';

  if (result.type === 'ownGoal' && tutorialState === 'firstKick') {
    await setTut('ownGoalResult');
    showResult({
      title: 'OWN GOAL',
      sub: '何もしなければ、当然こうなる。',
      buttonLabel: '細工を施す',
      onNext: async () => {
        await setTut('goShop');
        modal('このままじゃ負ける！細工を施そう！', [
          ['ショップへ', async () => { await setTut('receiveInitialEmojis'); show('shop'); }],
        ]);
      },
    });
    return;
  }

  const replay = await call('noHand:saveReplay', {
    stageId: app.stageId,
    runId: crypto.randomUUID(),
    seed: app.seed,
    placements: app.placements,
    result,
  });

  if (result.type === 'clear') {
    await call('noHand:submitRanking', {
      stageId: app.stageId,
      clearTime: result.clearTime,
      usedCost: app.usedCost,
      gimmickIds: app.placements.map((placement) => placement.itemId),
      placements: app.placements,
      replayId: replay.replay?.replayId,
    });
    const response = await call('noHand:awardPoints', { points: 80 });
    app.userState = response.state;
  } else {
    const fail = Number(localStorage.nohand_fail || 0) + 1;
    localStorage.nohand_fail = fail;
    const bonus = fail === 3 ? 20 : fail === 6 ? 30 : fail === 10 ? 50 : 0;
    if (bonus) {
      const response = await call('noHand:awardPoints', { points: bonus });
      app.userState = response.state;
      toast(`救済 ${bonus}P`);
    }
  }

  if (tutorialState === 'retryWithGimmick') {
    await setTut('complete', true);
  }

  const title = result.type === 'clear' ? 'GOOOAL!' : result.type === 'ownGoal' ? 'OWN GOAL' : 'TIME UP';
  const sub = result.type === 'clear'
    ? `${result.clearTime.toFixed(2)}秒 / cost ${app.usedCost}`
    : result.type === 'ownGoal'
      ? 'また自陣ネットを揺らしてしまった。'
      : '時間切れ。審判も困っている。';
  showResult({
    title,
    sub,
    buttonLabel: result.type === 'clear' ? '結果を見る' : '配置を見直す',
    onNext: async () => {
      refreshAfterStateChange();
      show(result.type === 'clear' ? 'book' : 'match');
    },
  });
}

async function setTut(state, done, options = {}) {
  app.userState.tutorialState = state;
  if (done !== undefined) app.userState.tutorialDone = done;
  const payload = { tutorialState: state };
  if (done !== undefined) payload.tutorialDone = !!done;
  await call('noHand:updateUserState', payload);
  if (!options.silent) updateCoachPanel();
}

async function runTutorial() {
  const state = app.userState.tutorialState || 'intro';
  updateCoachPanel();
  if (state === 'intro') {
    show('match');
    modal('ルールは簡単。素手で触らなければ、何をしてもセーフ。まずは何もせずキックしてみよう。', [
      ['キックする', async () => { await setTut('firstKick'); show('match'); }],
    ]);
  }
  if (state === 'goShop') {
    modal('このままじゃ負ける！細工を施そう！', [
      ['ショップへ', async () => { await setTut('receiveInitialEmojis'); show('shop'); }],
    ]);
  }
  if (state === 'goGenerate') {
    modal('サッカーってのは、ハンド以外セーフ……絵文字を組み合わせてみるか！', [
      ['生成へ', async () => { await setTut('generateFirstGimmick'); show('gen'); }],
    ]);
  }
  if (state === 'goMatch') {
    modal('生成したギミックを試合画面でドラッグして貼り付けよう。', [
      ['試合へ', async () => { await setTut('placeGimmick'); show('match'); }],
    ]);
  }
}

function renderDebug() {
  if (!app.debug) return;
  $('#debugText').textContent = `FPS:60\nbody数:${sim.world.bodies.length}\nstageId:${app.stageId}\nstageVersion:${sim.stageVersion}\nphysicsVersion:${sim.physicsVersion}\ngeneratorVersion:${app.versions.GENERATOR_VERSION}\npromptVersion:${app.versions.PROMPT_VERSION}\nseed:${app.seed}\n使用コスト:${app.usedCost}\nball:${sim.ball.position.x.toFixed(1)},${sim.ball.position.y.toFixed(1)}\n速度:${sim.ball.velocity.x.toFixed(2)},${sim.ball.velocity.y.toFixed(2)}\ngoalLine:${74}\nownGoalLine:${1330}\nplacements:${app.placements.length}\nactiveEffects:${sim.effects.length}\n発火ログ:${sim.logs.map((log) => log.name).join(',')}`;
}

function loop() {
  if (app.playing) {
    sim.step();
    if (sim.result) finish(sim.result);
  }
  sim.draw(app.showHit);
  updateMatchHud();
  updateLog();
  renderDebug();
  requestAnimationFrame(loop);
}

init();
