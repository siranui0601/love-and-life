(() => {
  fetch('./app-runtime.js', { cache: 'no-store' })
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load runtime: ${response.status}`);
      return response.text();
    })
    .then((source) => {
      const fixed = source
        .replace('let state = freshState();\nlet drag = null;\nlet modalAction = null;\nlet toastTimer = null;\nlet ballSerial = 1;', 'let ballSerial = 1;\nlet state = freshState();\nlet drag = null;\nlet modalAction = null;\nlet toastTimer = null;')
        .replace('let state = freshState();\r\nlet drag = null;\r\nlet modalAction = null;\r\nlet toastTimer = null;\r\nlet ballSerial = 1;', 'let ballSerial = 1;\r\nlet state = freshState();\r\nlet drag = null;\r\nlet modalAction = null;\r\nlet toastTimer = null;');
      if (fixed === source) throw new Error('Runtime init patch did not match source.');
      (0, eval)(fixed);
    })
    .catch((error) => {
      console.error('[noHand] runtime boot failed', error);
      const toast = document.querySelector('#toast');
      if (toast) {
        toast.textContent = '起動エラー。ページを再読み込みしてください。';
        toast.hidden = false;
      }
    });
})();
