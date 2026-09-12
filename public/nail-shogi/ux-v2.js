const careDialog = document.getElementById('careDialog');
const careDialogTitle = document.getElementById('careDialogTitle');
const careDialogText = document.getElementById('careDialogText');
const carePreview = document.getElementById('carePreview');
const careConfirm = document.getElementById('careConfirmBtn');
const careGrid = document.getElementById('careGrid');
const directionPad = document.getElementById('directionPad');

const compactCareCopy = {
  sharpen: ['研ぐ', '今の先端を鋭くする'],
  gel: ['ジェル', '選んだ部分を1段階かたくする'],
  hook: ['鉤爪', '根元に仕込み、先端に出た鉤で横から切る'],
  sculpt: ['スカルプ', '自然成長のあと、もう1マス伸ばす'],
  hide: ['隠す', 'このラウンドだけ敵の爪をすり抜ける'],
  cut: ['切る', '今の先端を1節だけ落とす'],
};

function syncCareDialog() {
  if (!careDialog?.open) return;
  careDialog.classList.remove('quick-care');
  const type = carePreview?.dataset.type || '';
  const copy = compactCareCopy[type];
  if (copy) {
    careDialogTitle.textContent = copy[0];
    careDialogText.textContent = copy[1];
  }
  if (careConfirm) careConfirm.textContent = '使う';
}

if (careDialog) {
  const observer = new MutationObserver(syncCareDialog);
  observer.observe(careDialog, { attributes: true, attributeFilter: ['open'] });
  syncCareDialog();
}

function tapFeedback() { navigator.vibrate?.(6); }
directionPad?.addEventListener('click', (event) => {
  if (event.target.closest('button:not(:disabled)')) tapFeedback();
}, true);
careGrid?.addEventListener('click', (event) => {
  if (event.target.closest('button:not(:disabled)')) tapFeedback();
}, true);
