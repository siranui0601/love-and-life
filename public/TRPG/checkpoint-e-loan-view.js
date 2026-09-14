const API_BASE = '/TRPG/api/game';
const LAST_SAVE_KEY = 'trpg:last-save-id';

const GROUP_LABELS = Object.freeze({
  rightHand: '右手装備',
  twoHand: '両手装備',
  leftHand: '左手装備',
});

let generation = 0;

function text(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

async function currentSave() {
  const id = globalThis.localStorage?.getItem(LAST_SAVE_KEY);
  if (!id) return null;
  const response = await fetch(`${API_BASE}/saves/${encodeURIComponent(id)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const body = await response.json();
  return body?.save ?? null;
}

function infoRow(label, detail) {
  const row = document.createElement('div');
  row.className = 'detail-row';
  const body = document.createElement('div');
  const strong = document.createElement('b');
  strong.textContent = label;
  const small = document.createElement('small');
  small.textContent = detail;
  body.append(strong, small);
  row.append(body);
  return row;
}

function categoryOverview(catalog) {
  const section = document.createElement('section');
  section.className = 'detail-section equipment-access-section checkpoint-e-loan-categories';
  const heading = document.createElement('h3');
  heading.textContent = '貸出対象の8系統';
  section.append(heading);
  for (const group of ['rightHand', 'twoHand', 'leftHand']) {
    const entries = catalog.categories.filter((entry) => entry.group === group);
    section.append(infoRow(
      GROUP_LABELS[group],
      entries.map((entry) => `${entry.label}（${text(entry.equipmentName, entry.equipmentId)}）`).join(' / '),
    ));
  }
  const rules = document.createElement('p');
  rules.className = 'quiet';
  rules.textContent = '右手装備は盾と組み合わせ可能。両手装備は盾と同時装備不可。盾は左手の防御・補助装備。借りられるのは1 loadoutのみ。';
  section.append(rules);
  return section;
}

function enhanceRows(rows, catalog) {
  const optionByIndex = catalog.options;
  const sections = new Map();
  for (const group of ['rightHand', 'twoHand']) {
    const section = document.createElement('section');
    section.className = `detail-section equipment-access-section checkpoint-e-loan-${group}`;
    const heading = document.createElement('h3');
    heading.textContent = group === 'rightHand' ? '右手系 loadout' : '両手系 loadout';
    section.append(heading);
    sections.set(group, section);
  }

  rows.slice(0, optionByIndex.length).forEach((row, index) => {
    const option = optionByIndex[index];
    if (!option) return;
    row.querySelectorAll('button[data-command]').forEach((button) => {
      if (button.dataset.command !== 'SHOP_BORROW') button.remove();
    });
    const borrow = row.querySelector('button[data-command="SHOP_BORROW"]');
    if (borrow) {
      borrow.textContent = 'このloadoutを借りる';
      borrow.setAttribute('aria-label', `${option.label}を共通プロローグの借用品として借りる`);
    }
    const detail = row.querySelector('small');
    if (detail) detail.textContent = option.equipmentNames.join(' + ');
    sections.get(option.group)?.append(row);
  });
  return [...sections.values()].filter((section) => section.querySelector('.shop-row'));
}

async function enhanceLoanPanel() {
  const dialog = document.querySelector('#detailDialog');
  const body = document.querySelector('#dialogBody');
  if (!dialog?.open || dialog.dataset.panel !== 'shop' || !body) return;
  const current = ++generation;
  let save;
  try {
    save = await currentSave();
  } catch {
    return;
  }
  if (current !== generation) return;
  const catalog = save?.shop?.prologueLoanCatalog;
  if (!catalog?.active) return;
  const revisionKey = `${save.id}:${save.revision}`;
  if (body.dataset.checkpointELoanRevision === revisionKey) return;

  const rows = [...body.querySelectorAll('.shop-row')];
  if (rows.length < catalog.options.length) return;
  const intro = document.createElement('section');
  intro.className = 'detail-section checkpoint-e-loan-intro';
  const title = document.createElement('h3');
  title.textContent = '村の共通貸出';
  const copy = document.createElement('p');
  copy.textContent = 'これは購入画面ではなく、共通プロローグの貸出一覧です。8系統を一度に見比べ、実際に借りるloadoutを一つ選びます。';
  intro.append(title, copy);

  const optionSections = enhanceRows(rows, catalog);
  body.replaceChildren(intro, categoryOverview(catalog), ...optionSections);
  body.dataset.checkpointELoanRevision = revisionKey;
  const dialogTitle = document.querySelector('#dialogTitle');
  const dialogKicker = document.querySelector('#dialogKicker');
  if (dialogTitle) dialogTitle.textContent = '8系統の貸出装備';
  if (dialogKicker) dialogKicker.textContent = 'VILLAGE LOAN';
}

export function installCheckpointELoanView() {
  const body = document.querySelector('#dialogBody');
  if (!body || typeof MutationObserver === 'undefined') return () => {};
  const observer = new MutationObserver(() => queueMicrotask(enhanceLoanPanel));
  observer.observe(body, { childList: true, subtree: false });
  document.addEventListener('click', (event) => {
    const trigger = event.target?.closest?.('[data-open-panel="shop"], #tutorialAction');
    if (trigger) globalThis.setTimeout(enhanceLoanPanel, 0);
  });
  return () => observer.disconnect();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installCheckpointELoanView();
}
