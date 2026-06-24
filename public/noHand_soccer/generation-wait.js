(() => {
  const originalFetch = window.fetch.bind(window);
  const findGenerateButton = () => document.querySelector('#generateBtn');
  const findOverlay = () => document.querySelector('#generateWaitOverlay');

  function setWaiting(isWaiting) {
    const button = findGenerateButton();
    const overlay = findOverlay();
    if (button) {
      button.disabled = isWaiting;
      button.textContent = isWaiting ? '作成中…' : 'ギミック生成';
    }
    if (overlay) overlay.hidden = !isWaiting;
  }

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const isGimmickRequest = String(url).includes('/api/nohand-soccer/gimmick');
    if (isGimmickRequest) setWaiting(true);
    try {
      return await originalFetch(input, init);
    } finally {
      if (isGimmickRequest) setWaiting(false);
    }
  };
})();
