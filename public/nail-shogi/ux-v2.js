const board = document.getElementById('boardSvg');
const outcome = document.getElementById('nextOutcome');
const outcomeText = document.getElementById('nextOutcomeText');
const careDialog = document.getElementById('careDialog');
const careConfirm = document.getElementById('careConfirmBtn');
const careGrid = document.getElementById('careGrid');
const directionPad = document.getElementById('directionPad');

const outcomeCopy = {
  grow: '伸びる',
  capture: '詰み',
  'hook-cut': '横から切る',
  collision: 'ぶつかる',
  'own-block': '自分の爪で止まる',
  phase: 'すり抜ける',
  edge: '端で止まる',
};

function syncOutcome() {
  if (!board || !outcome || !outcomeText) return;
  const kind = board.dataset.movePreview || 'grow';
  outcome.dataset.kind = kind;
  outcomeText.textContent = outcomeCopy[kind] || '伸びる';
}

if (board) {
  const observer = new MutationObserver(syncOutcome);
  observer.observe(board, { attributes: true, attributeFilter: ['data-move-preview', 'data-move-preview-text'] });
  syncOutcome();
}

// ケアは盤面に即時反映し、必要なら「↶」でターン全体を戻す。
// 確認モーダルを挟まないことで、盤面と操作の視線往復をなくす。
if (careDialog && careConfirm) {
  const observer = new MutationObserver(() => {
    if (!careDialog.open) return;
    careDialog.classList.add('quick-care');
    queueMicrotask(() => {
      if (careDialog.open && !careConfirm.disabled) careConfirm.click();
    });
  });
  observer.observe(careDialog, { attributes: true, attributeFilter: ['open'] });
}

function tapFeedback() {
  navigator.vibrate?.(6);
}

directionPad?.addEventListener('click', (event) => {
  if (event.target.closest('button:not(:disabled)')) tapFeedback();
}, true);

careGrid?.addEventListener('click', (event) => {
  if (event.target.closest('button:not(:disabled)')) tapFeedback();
}, true);
