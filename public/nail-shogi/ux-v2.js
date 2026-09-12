const careDialog = document.getElementById('careDialog');
const careDialogTitle = document.getElementById('careDialogTitle');
const careDialogText = document.getElementById('careDialogText');
const carePreview = document.getElementById('carePreview');
const careConfirm = document.getElementById('careConfirmBtn');
const careGrid = document.getElementById('careGrid');
const directionPad = document.getElementById('directionPad');
const fxSvg = document.getElementById('fxSvg');
const fxLayer = document.getElementById('fxLayer');

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

function showHookActivation(claw) {
  if (!fxLayer || !claw || claw.dataset.labeled === '1') return;
  claw.dataset.labeled = '1';
  const layerBox = fxLayer.getBoundingClientRect();
  const clawBox = claw.getBoundingClientRect();
  const label = document.createElement('div');
  label.textContent = '鉤爪';
  Object.assign(label.style, {
    position: 'absolute',
    left: `${clawBox.left + clawBox.width / 2 - layerBox.left}px`,
    top: `${clawBox.top - layerBox.top - 8}px`,
    transform: 'translate(-50%,-50%)',
    padding: '4px 9px',
    border: '2px solid #221e1a',
    borderRadius: '999px',
    background: '#fff4e6',
    color: '#c85835',
    fontSize: '13px',
    fontWeight: '950',
    lineHeight: '1',
    boxShadow: '0 2px 0 rgba(34,30,26,.18)',
    pointerEvents: 'none',
  });
  fxLayer.append(label);
  const animation = label.animate([
    { transform: 'translate(-50%,-50%) scale(.65) rotate(-5deg)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.08) rotate(2deg)', opacity: 1, offset: .38 },
    { transform: 'translate(-50%,-58%) scale(1) rotate(0deg)', opacity: 1, offset: .72 },
    { transform: 'translate(-50%,-75%) scale(.92)', opacity: 0 },
  ], { duration: 620, easing: 'cubic-bezier(.2,.8,.25,1)' });
  animation.finished.finally(() => label.remove());
}

if (fxSvg && fxLayer) {
  const fxObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('.fx-hook-claw')) showHookActivation(node);
        node.querySelectorAll?.('.fx-hook-claw').forEach(showHookActivation);
      }
    }
  });
  fxObserver.observe(fxSvg, { childList: true, subtree: true });
}

function tapFeedback() { navigator.vibrate?.(6); }
directionPad?.addEventListener('click', (event) => {
  if (event.target.closest('button:not(:disabled)')) tapFeedback();
}, true);
careGrid?.addEventListener('click', (event) => {
  if (event.target.closest('button:not(:disabled)')) tapFeedback();
}, true);
