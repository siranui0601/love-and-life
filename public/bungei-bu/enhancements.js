const BGM_DEFAULT_VOLUME = 0.35;
const BGM_MUTED_STORAGE_KEY = "bungeiDailyBgmMuted";

const scene = document.querySelector("#scene");
const hud = document.querySelector(".hud");
const startButton = document.querySelector("#startButton");
const playArea = document.querySelector("#playArea");
const resultScreen = document.querySelector("#resultScreen");
const creditButton = document.querySelector("#creditButton");
const resultCreditButton = document.querySelector("#resultCreditButton");
const hudTimer = document.querySelector(".hud__timer");

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
  return dailyBgm;
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
}

function playDailyBgm() {
  const audio = ensureDailyBgm();
  if (!audio || bgmMuted) return;

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
  playDailyBgm();
}

function pauseDailyBgm() {
  const audio = ensureDailyBgm();
  if (!audio) return;
  audio.pause();
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
    button.setAttribute("aria-label", "タイトル画面に戻る");
    scene.appendChild(button);
  }

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    window.location.href = "/";
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
      <p class="credit-modal__note">
        本楽曲はGILLTHIM様より、「時々文芸部！」ゲーム内使用を目的として提供いただいたものです。<br>
        楽曲の無断転載・再配布・販売・自作発言を禁止します。
      </p>
      <div class="credit-modal__links" aria-label="GILLTHIMリンク">
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

function showCreditModal(event) {
  event?.stopPropagation();
  const modal = ensureCreditModal();
  modal.classList.remove("is-hidden");
}

function hideCreditModal() {
  const modal = document.querySelector("#creditModal");
  if (!modal) return;
  modal.classList.add("is-hidden");
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
ensureBgmToggleButton();
ensureGameTitleReturnButton();
ensureCreditModal();
observeGameState();
updateGameTitleReturnButton();

startButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  startDailyBgm();
});

creditButton?.addEventListener("click", showCreditModal);
resultCreditButton?.addEventListener("click", showCreditModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideCreditModal();
  }
});
