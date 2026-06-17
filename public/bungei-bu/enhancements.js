const BGM_DEFAULT_VOLUME = 0.35;
const BGM_MUTED_STORAGE_KEY = "bungeiDailyBgmMuted";
const LEGACY_BGM_ENABLED_STORAGE_KEY = "bungeiDailyBgmEnabled";
const BUNGEI_TITLE_URL = "/時々文芸部！/";

const scene = document.querySelector("#scene");
const hud = document.querySelector(".hud");
const startButton = document.querySelector("#startButton");
const playArea = document.querySelector("#playArea");
const resultScreen = document.querySelector("#resultScreen");
const creditButton = document.querySelector("#creditButton");
const resultCreditButton = document.querySelector("#resultCreditButton");
const hudTimer = document.querySelector(".hud__timer");
const legacyModal = document.querySelector("#modal");

let dailyBgm = document.querySelector("#dailyBgm");
let bgmMuted = localStorage.getItem(BGM_MUTED_STORAGE_KEY) === "true";
let bgmShouldPlay = false;
let bgmFadeFrame = null;

function ensureDailyBgm() {
  if (dailyBgm) return dailyBgm;

  dailyBgm = document.createElement("audio");
  dailyBgm.id = "dailyBgm";
  dailyBgm.preload = "auto";
  dailyBgm.loop = true;
  dailyBgm.src = "/api/bungei/bgm/daily";
  document.body.appendChild(dailyBgm);
  syncAudioMutedState();
  return dailyBgm;
}

function syncAudioMutedState() {
  const audio = dailyBgm;
  if (audio) {
    audio.muted = bgmMuted;
  }
  localStorage.setItem(LEGACY_BGM_ENABLED_STORAGE_KEY, String(!bgmMuted));
}

function getSoundIcon() {
  return bgmMuted ? "🔇" : "🔈";
}

function updateBgmToggleButton() {
  const button = document.querySelector("#bgmToggleButton");
  if (!button) return;

  button.textContent = getSoundIcon();
  button.classList.toggle("is-muted", bgmMuted);
  button.setAttribute("aria-label", bgmMuted ? "BGMをオンにする" : "BGMをオフにする");
  button.title = bgmMuted ? "BGM ON" : "BGM OFF";
  syncAudioMutedState();
}

function playDailyBgm() {
  const audio = ensureDailyBgm();
  if (!audio) return;

  syncAudioMutedState();

  if (bgmMuted) {
    audio.pause();
    return;
  }

  if (bgmFadeFrame) {
    cancelAnimationFrame(bgmFadeFrame);
    bgmFadeFrame = null;
  }

  audio.volume = BGM_DEFAULT_VOLUME;
  const promise = audio.play();

  if (promise && typeof promise.catch === "function") {
    promise.catch((error) => {
      console.warn("BGMの再生に失敗しました。ユーザー操作後に再生されます。", error);
    });
  }
}

function startDailyBgm() {
  bgmShouldPlay = true;

  if (bgmMuted) {
    pauseDailyBgm();
    return;
  }

  playDailyBgm();
}

function pauseDailyBgm() {
  const audio = ensureDailyBgm();
  if (!audio) return;
  audio.pause();
  syncAudioMutedState();
}

function fadeOutDailyBgm(duration = 800) {
  bgmShouldPlay = false;

  const audio = ensureDailyBgm();
  if (!audio || audio.paused) return;

  if (bgmFadeFrame) {
    cancelAnimationFrame(bgmFadeFrame);
    bgmFadeFrame = null;
  }

  const startVolume = audio.volume || BGM_DEFAULT_VOLUME;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    audio.volume = startVolume * (1 - progress);

    if (progress < 1) {
      bgmFadeFrame = requestAnimationFrame(step);
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.volume = BGM_DEFAULT_VOLUME;
    bgmFadeFrame = null;
    syncAudioMutedState();
  }

  bgmFadeFrame = requestAnimationFrame(step);
}

function toggleBgmMuted(event) {
  event?.stopPropagation();
  bgmMuted = !bgmMuted;
  localStorage.setItem(BGM_MUTED_STORAGE_KEY, String(bgmMuted));
  updateBgmToggleButton();

  if (bgmMuted) {
    pauseDailyBgm();
    return;
  }

  if (bgmShouldPlay) {
    playDailyBgm();
  }
}

function ensureBgmToggleButton() {
  if (!hud) return null;

  hud.removeAttribute("aria-hidden");

  let button = document.querySelector("#bgmToggleButton");
  if (!button) {
    button = document.createElement("button");
    button.id = "bgmToggleButton";
    button.type = "button";
    button.className = "hud__sound-button";
    hud.appendChild(button);
  }

  button.classList.add("hud__sound-button");
  button.addEventListener("click", toggleBgmMuted);
  updateBgmToggleButton();
  return button;
}

function ensureGameTitleReturnButton() {
  if (!scene) return null;

  let button = document.querySelector("#gameTitleReturnButton");
  if (!button) {
    button = document.createElement("button");
    button.id = "gameTitleReturnButton";
    button.type = "button";
    button.className = "game-title-return-button is-hidden";
    button.textContent = "タイトルに戻る";
    button.setAttribute("aria-label", "時々文芸部！のタイトル画面に戻る");
    scene.appendChild(button);
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    bgmShouldPlay = false;
    pauseDailyBgm();
    window.location.href = BUNGEI_TITLE_URL;
  });

  return button;
}

function shouldShowGameTitleReturnButton() {
  const isPlaying = playArea && !playArea.hidden && !playArea.classList.contains("is-hidden");
  const isResult = resultScreen && !resultScreen.hidden && !resultScreen.classList.contains("is-hidden");
  return Boolean(isPlaying && !isResult);
}

function updateGameTitleReturnButton() {
  const button = document.querySelector("#gameTitleReturnButton");
  if (!button) return;
  button.classList.toggle("is-hidden", !shouldShowGameTitleReturnButton());
}

function ensureCreditModal() {
  let modal = document.querySelector("#creditModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "creditModal";
  modal.className = "credit-modal is-hidden";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "creditTitle");
  modal.innerHTML = `
    <div class="credit-modal__content">
      <button class="credit-modal__close" id="creditCloseButton" type="button" aria-label="クレジットを閉じる">×</button>
      <h2 class="credit-modal__title" id="creditTitle">協力・クレジット</h2>
      <div class="credit-modal__section">
        <p class="credit-modal__label">楽曲</p>
        <p class="credit-modal__main">日常の始まり</p>
        <p class="credit-modal__sub">作曲：GILLTHIM</p>
      </div>
      <div class="credit-modal__links" aria-label="GILLTHIM外部リンク">
        <a href="https://gillthim.wixsite.com/noveltysounds" target="_blank" rel="noopener noreferrer">公式サイト</a>
        <a href="https://x.com/Gillthim3" target="_blank" rel="noopener noreferrer">X</a>
        <a href="https://www.youtube.com/channel/UCy9B4VgmfmTj0SiaoyD1wsA" target="_blank" rel="noopener noreferrer">YouTube</a>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeButton = modal.querySelector("#creditCloseButton");
  const content = modal.querySelector(".credit-modal__content");

  closeButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideCreditModal();
  });

  content?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  modal.addEventListener("click", (event) => {
    event.stopPropagation();
    if (event.target === modal) {
      hideCreditModal();
    }
  });

  return modal;
}

function hideLegacyCreditModal() {
  if (!legacyModal) return;
  legacyModal.classList.add("is-hidden");
}

function showCreditModal(event) {
  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();
  event?.stopPropagation?.();
  hideLegacyCreditModal();
  const modal = ensureCreditModal();
  modal.classList.remove("is-hidden");
}

function hideCreditModal() {
  const modal = document.querySelector("#creditModal");
  if (!modal) return;
  modal.classList.add("is-hidden");
}

function bindCreditButton(button) {
  if (!button) return;
  button.addEventListener("click", showCreditModal, { capture: true });
}

function observeGameState() {
  const observer = new MutationObserver(() => {
    updateGameTitleReturnButton();

    const remainingText = String(hudTimer?.textContent || "");
    const reachedEnding = /残り:\s*0文字/.test(remainingText);
    const isResult = resultScreen && !resultScreen.hidden && !resultScreen.classList.contains("is-hidden");

    if ((reachedEnding || isResult) && bgmShouldPlay) {
      fadeOutDailyBgm();
    }
  });

  [playArea, resultScreen, hudTimer]
    .filter(Boolean)
    .forEach((target) => {
      observer.observe(target, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
}

ensureDailyBgm();
syncAudioMutedState();
ensureBgmToggleButton();
ensureGameTitleReturnButton();
ensureCreditModal();
observeGameState();
updateGameTitleReturnButton();

startButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  startDailyBgm();
});

bindCreditButton(creditButton);
bindCreditButton(resultCreditButton);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideCreditModal();
  }
});
