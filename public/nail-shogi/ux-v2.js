const board = document.getElementById('boardSvg');
const outcome = document.getElementById('nextOutcome');
const outcomeText = document.getElementById('nextOutcomeText');
const careDialog = document.getElementById('careDialog');
const careDialogText = document.getElementById('careDialogText');
const careDialogTitle = document.getElementById('careDialogTitle');
const careGrid = document.getElementById('careGrid');

const KINDS = new Set(['grow','capture','hook-cut','collision','own-block','phase','edge']);

function syncOutcome() {
  if (!board || !outcome || !outcomeText) return;
  const kind = board.dataset.movePreview || 'grow';
  const text = board.dataset.movePreviewText || 'この方向へ1マス伸びます';
  outcome.dataset.kind = KINDS.has(kind) ? kind : 'grow';
  outcomeText.textContent = text;
}

function plainCareCopy(type) {
  const selected = document.getElementById('selectedFingerName')?.textContent || 'この指';
  const stockText = careGrid?.querySelector(`[data-care="${type}"] i`)?.textContent || '';
  const copy = {
    sharpen: ['先端を研ぐ', `${selected}の先端を鋭くします。正面からぶつかった時に、相手を欠けさせやすくなります。先端が折れたら効果は消えます。`],
    hook: ['鉤爪を仕込む', `${selected}の根元に鉤爪を仕込みます。成長するたび前へ流れ、先端まで来ると敵の爪の横腹を引っ掛けて、そこから先をまとめて切断できます。 ${stockText}`],
    sculpt: ['スカルプを付ける', `${selected}は、このラウンドの自然成長が終わったあと、もう1マスだけ伸びます。途中でぶつかった場合は飛び越えません。 ${stockText}`],
    hide: ['爪を隠す', `${selected}は、このラウンドだけ敵の爪をすり抜けます。自分の爪や敵の指はすり抜けません。`],
    cut: ['先端を切る', `${selected}の先端を1節だけ切り落とします。切った破片は盤面には残りません。`],
    gel: ['ジェルを塗る', `${selected}の選んだ場所を1段階かたくします。塗った部分は、爪が伸びるたび先端側へ流れていきます。 ${stockText}`],
  };
  return copy[type] || ['ケアを使う', 'このケアを実行します。'];
}

function rewriteCareDialog(type) {
  if (!careDialogTitle || !careDialogText) return;
  const [title, text] = plainCareCopy(type);
  careDialogTitle.textContent = title;
  careDialogText.textContent = text;
}

if (board) {
  const observer = new MutationObserver(syncOutcome);
  observer.observe(board, { attributes: true, attributeFilter: ['data-move-preview','data-move-preview-text'], childList: true });
  syncOutcome();
}

if (careGrid) {
  careGrid.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-care]');
    if (!button) return;
    const type = button.dataset.care;
    queueMicrotask(() => rewriteCareDialog(type));
  }, true);
}

if (board) {
  board.addEventListener('click', (event) => {
    if (!event.target.closest('[data-segment]')) return;
    queueMicrotask(() => rewriteCareDialog('gel'));
  }, true);
}

if (careDialog) {
  const observer = new MutationObserver(() => {
    if (!careDialog.open) return;
    const raw = careDialogText?.textContent || '';
    if (/\bP\d|\bD\d|P\+|D\+/.test(raw)) {
      const type = document.getElementById('carePreview')?.dataset.type || 'gel';
      rewriteCareDialog(type);
    }
  });
  observer.observe(careDialog, { childList: true, subtree: true, characterData: true, attributes: true });
}
