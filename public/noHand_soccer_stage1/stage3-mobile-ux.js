(() => {
  const fieldFrame = document.querySelector('#fieldFrame');
  const kickBtn = document.querySelector('#kickBtn');
  const retryBtn = document.querySelector('#retryBtn');
  const pauseBtn = document.querySelector('#pauseBtn');
  const speedBtn = document.querySelector('#speedBtn');
  const matchStateEl = document.querySelector('#matchState');
  const miniStateLabel = document.querySelector('#miniStateLabel');

  const replacements = new Map([
    ['敵に中央ゴールへ押し込まれました。細工が必要です。', '自陣ゴールへ決められました。細工が足りません。'],
    ['自陣中央ゴールへ失点。', '自陣ゴールへ失点。'],
  ]);

  function smoothFocusField() {
    if (!fieldFrame) return;
    window.setTimeout(() => {
      fieldFrame.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    }, 80);
  }

  function patchText(root = document.body) {
    const targets = root.querySelectorAll?.('.result-card p, .log-line') ?? [];
    for (const node of targets) {
      for (const [from, to] of replacements) {
        if (node.textContent.includes(from)) node.textContent = node.textContent.replace(from, to);
      }
    }
  }

  function syncMiniState() {
    if (!miniStateLabel || !matchStateEl) return;
    const value = matchStateEl.textContent.trim();
    if (value.includes('試合中')) miniStateLabel.textContent = 'LIVE';
    else if (value.includes('一時停止')) miniStateLabel.textContent = 'PAUSE';
    else if (value.includes('GOAL')) miniStateLabel.textContent = 'GOAL';
    else if (value.includes('OWN')) miniStateLabel.textContent = 'MISS';
    else miniStateLabel.textContent = 'READY';
  }

  kickBtn?.addEventListener('click', smoothFocusField);
  retryBtn?.addEventListener('click', () => window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 80));
  pauseBtn?.addEventListener('click', syncMiniState);
  speedBtn?.addEventListener('click', syncMiniState);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') patchText(mutation.target);
      if (mutation.type === 'characterData') patchText(document.body);
    }
    syncMiniState();
  });

  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  patchText();
  syncMiniState();
})();
