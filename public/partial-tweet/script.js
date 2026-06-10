/**********************************************
 * グローバル変数など
 **********************************************/
let partialTweetCount = 2; // 1部屋目は2回
let currentObjectName = "";
let haveKey = false;
let currentRoom = 1; // 1=1部屋目, 2=2部屋目, 3=3部屋目

// フラグ：バール取得済みか？
let haveBar = false;

// 身だしなみフラグ (スター,鏡,配電盤の状態 etc)
let bodyCareFlag = false;

// ランプ取得状況
let lampAcquired = false;

// 「浄化」(雑巾) が表示中か
let haveJouka = false;

// スター(マイケル)が登場しているか
let starAppeared = false;

// ポスターが汚れを落として読める状態かどうか
let posterCleaned = false;

// ポップアップ本文のひらがな表示切り替え状態
let popupHiraganaMode = false;
let popupOriginalTitle = "";
let popupOriginalDesc = "";

let simaiCount = 0; // しまいをツイートした回数

const assetPath = (fileName) => `/2D画像/${fileName}`;




let partialTweetLockedScrollY = 0;
let partialTweetGameHeight = 0;

function updatePartialTweetVisualOffset() {
  const vv = window.visualViewport;
  const offsetTop = vv ? vv.offsetTop || 0 : 0;

  document.documentElement.style.setProperty(
    "--pt-vv-offset-top",
    `${offsetTop}px`
  );
}

function updatePartialTweetViewportVars() {
  const height = partialTweetGameHeight || window.innerHeight;

  document.documentElement.style.setProperty("--pt-game-height", `${height}px`);
  updatePartialTweetVisualOffset();
}

function installPartialTweetViewportFix() {
  partialTweetGameHeight = window.innerHeight;
  updatePartialTweetViewportVars();

  window.addEventListener("resize", () => {
    if (!document.body.classList.contains("partial-tweet-locked")) {
      partialTweetGameHeight = window.innerHeight;
      updatePartialTweetViewportVars();
    }
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updatePartialTweetVisualOffset);
    window.visualViewport.addEventListener("scroll", updatePartialTweetVisualOffset);
  }
}

function lockPartialTweetPage() {
  partialTweetLockedScrollY = window.scrollY || window.pageYOffset || 0;
  partialTweetGameHeight = window.innerHeight;

  updatePartialTweetViewportVars();

  document.documentElement.classList.add("partial-tweet-locked");
  document.body.classList.add("partial-tweet-locked");

  document.body.style.position = "fixed";
  document.body.style.top = `-${partialTweetLockedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
  document.body.style.height = `${partialTweetGameHeight}px`;
}

function unlockPartialTweetPage() {
  document.documentElement.classList.remove("partial-tweet-locked");
  document.body.classList.remove("partial-tweet-locked");

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  document.body.style.height = "";

  window.scrollTo(0, partialTweetLockedScrollY || 0);
}

installPartialTweetViewportFix();

function installPartialTweetViewportFix() {
  partialTweetGameHeight = window.innerHeight;
  updatePartialTweetViewportVars();

  window.addEventListener("resize", () => {
    // ゲーム中は高さを変えない。タイトル画面など、未ロック時だけ更新する。
    if (!document.body.classList.contains("partial-tweet-locked")) {
      partialTweetGameHeight = window.innerHeight;
      updatePartialTweetViewportVars();
    }
  });
}

function lockPartialTweetPage() {
  partialTweetLockedScrollY = window.scrollY || window.pageYOffset || 0;
  partialTweetGameHeight = window.innerHeight;

  updatePartialTweetViewportVars();

  document.documentElement.classList.add("partial-tweet-locked");
  document.body.classList.add("partial-tweet-locked");

  document.body.style.position = "fixed";
  document.body.style.top = `-${partialTweetLockedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockPartialTweetPage() {
  document.documentElement.classList.remove("partial-tweet-locked");
  document.body.classList.remove("partial-tweet-locked");

  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";

  window.scrollTo(0, partialTweetLockedScrollY || 0);
}

installPartialTweetViewportFix();

function installPartialTweetZoomGuard() {
  document.addEventListener(
    "dblclick",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
    window.addEventListener(
      eventName,
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );
  });
}

installPartialTweetZoomGuard();



document.getElementById("hinto").style.display = "none";

/**********************************************
 * 初期データ (説明文マップ)
 **********************************************/
let objectDescMap = {
  // 1・2部屋目関連
  エアコン: "動かない",
  机: "建付けが悪い",
  昆虫図鑑: "蟻も昆虫らしい",
  家内: "結構千鳥足だ",
  毛皮: "暖かい",
  リモコン: "エアコンが付いた",
  ドア: "鍵がない...",
  穴: "底になにかがある",
  ガール: "初対面の女子高生だ。",
  ショタ: "元気な男の子",
  恒星: "体が溶けちまうぅ…",
  おねショタ: "お姉さんは満面の笑みだ",
  暗闇: "暗いと何も見えない",

  // 3部屋目
  トランプ: "赤が見つからない",
  ポスター: "汚れていて読めない", // 初期は汚れてる
  シャッター: "電子ロックされている",
  配電盤: "不気味な音がする",
  スター: "本物ﾎﾟｩ！",
  バール: "錆び付いている",
  ランプ: "良さげな雰囲気",
  鏡: "卓上鏡だ",
  窓: "外が見える",

  // 浄化アイテム
  浄化: "汚れが落ちそうだ",
  カバー: "スリラーのカバー曲。微妙に音程がズレている。",
  // 故障配電盤など
  // ...
};

/**********************************************
 * 初期化 (画像srcなど)
 **********************************************/
function initObjects() {
  const objectImages = {
    aircon: "IMG_9183.png",
    table: "IMG_9185.png",
    book: "IMG_9186.png",
    doorItem: "IMG_9241.png",
  };

  Object.entries(objectImages).forEach(([id, fileName]) => {
    document.getElementById(id).src = assetPath(fileName);
  });

  // ショタをドアより前に出す => z-index
  document.getElementById("shotaItem").style.zIndex = "9999";
  document.getElementById("doorItem").style.zIndex = "5";
}

/**********************************************
 * ゲーム開始 (startGame)
 **********************************************/
function startGame() {
  initObjects();

  // ヒント
  startCharging();

  // 画面切替
    document.getElementById("menu-screen").style.display = "none";
  const header = document.querySelector("header#title-screen");
  if (header) header.style.display = "none";
  document.getElementById("game-screen").style.display = "block";

  lockPartialTweetPage();
  
  collapseGameToolbar();
  
  
  

  // 1部屋目 初期化
  currentRoom = 1;
  partialTweetCount = 2;
  haveKey = false;
  haveBar = false;
  bodyCareFlag = false;
  lampAcquired = false;
  haveJouka = false;
  starAppeared = false;
  posterCleaned = false;
  simaiCount = 0;
  document.querySelectorAll(".simai-clone").forEach((el) => el.remove());
  document.getElementById("oshimai-screen").style.display = "none";
  document.getElementById("thank-you-line1").style.display = "none";
  document.getElementById("thank-you-line2").style.display = "none";

  // ハート2つ ON, 3つ目以降 OFF
  document.getElementById("heart1").style.display = "inline";
  document.getElementById("heart2").style.display = "inline";
  //document.getElementById("heart3").style.display = "none";
  // document.getElementById("heart4").style.display = "none";
  // document.getElementById("heart5").style.display = "none";
  // time-rewindは常時表示してもいいならコメント解除

  // 1部屋目以外 => none
  [
    "kanaiItem",
    "kegawaItem",
    "rimokonItem",
    "kochiItem",
    "doriaItem",
    "tatakaiItem",
    "takaiItem",
    "bowgunItem",
    "holeItem",
    "hole2Item",
    "girlItem",
    "shotaItem",
    "kouseiItem",
    "oneShotaItem",
    "darkness",
    "onesyo",
    "keyItem",
    "doorItem",
    "Opendoor",
    "toranpuItem",
    "posterItem",
    "newposterItem",
    "shutterItem",
    "haidenbanItem",
    "lampItem",
    "kagamiItem",
    "starItem",
    "barItem",
    "windowItem",
    "haidenbanBrokenItem",
    "joukaItem",
    "coverItem",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // 1部屋目3つ => block
  document.getElementById("aircon").style.display = "block";
  document.getElementById("table").style.display = "block";
  document.getElementById("book").style.display = "block";

  // ドア => none
  document.getElementById("doorItem").style.display = "none";

  // エアコン => 動かない
  objectDescMap["エアコン"] = "動かない";
  // ドア => "鍵がない..."
  objectDescMap["ドア"] = "鍵がない...";

  // エンディング非表示
  document.getElementById("ending-overlay").style.display = "none";

  // ハートinfo
  showHeartInfo();
}

/**********************************************
 * アニメ付きトースト (showToast/hideToast)
 **********************************************/
let toastTimer = null;
let touchStartY = 0;
let isSwipingToast = false;

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.style.display = "block";

  setTimeout(() => {
    toast.classList.add("show");
  }, 50);

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    hideToast();
  }, 3000);

  toast.addEventListener("touchstart", handleTouchStart);
  toast.addEventListener("touchmove", handleTouchMove, { passive: false });
  toast.addEventListener("touchend", handleTouchEnd);
}

function hideToast() {
  const toast = document.getElementById("toast");
  toast.classList.remove("show");
  setTimeout(() => {
    toast.style.display = "none";
  }, 400);
  toast.removeEventListener("touchstart", handleTouchStart);
  toast.removeEventListener("touchmove", handleTouchMove);
  toast.removeEventListener("touchend", handleTouchEnd);
}

function handleTouchStart(e) {
  touchStartY = e.touches[0].clientY;
  isSwipingToast = true;
}
function handleTouchMove(e) {
  if (isSwipingToast) e.preventDefault();
}
function handleTouchEnd(e) {
  let touchEndY = e.changedTouches[0].clientY;
  let swipeDistance = touchStartY - touchEndY;
  if (swipeDistance > 50) {
    hideToast();
  }
  isSwipingToast = false;
}

/**********************************************
 * ルール表示
 **********************************************/
function toggleRules() {
  const rulesBox = document.getElementById("rules-box");
  if (!rulesBox.style.display || rulesBox.style.display === "none") {
    rulesBox.style.display = "block";
  } else {
    rulesBox.style.display = "none";
  }
}
function closeRulesOutside(e) {
  if (e.target.id === "rules-box") {
    toggleRules();
  }
}

/**********************************************
 * ヒント表示
 **********************************************/
let chargeTime = 60;
let currentTime = 0;
let chargingInterval;

function startCharging() {
  let btn = document.getElementById("hinto-btn");
  chargingInterval = setInterval(() => {
    currentTime++;
    let percent = (currentTime / chargeTime) * 100;
    if (percent < 100) {
      btn.style.background = `linear-gradient(to right, orange ${percent}%, #888 ${percent}%)`;
    } else {
      btn.style.background = "#009D5B";
    }
    if (currentTime >= chargeTime) {
      clearInterval(chargingInterval);
      btn.style.cursor = "pointer";
      btn.onclick = togglehinto;
    }
  }, 1000);
}

function togglehinto() {
  if (currentTime < chargeTime) {
    showToast(`あと${chargeTime - currentTime}秒でヒントが使えます`);
    return;
  }

  let Hinto = document.getElementById("hinto");
  if (!Hinto.style.display || Hinto.style.display === "none") {
    if (currentRoom === 1) {
       if (document.getElementById("rimokonItem").style.display === "none") {
        document.getElementById("hinto-msg").innerHTML =
          "<p>昆虫図鑑から4文字だ！</p>";
      } else if (
        document.getElementById("bowgunItem").style.display === "none"
      ) {
        document.getElementById("hinto-msg").innerHTML =
          "<p>説明文が変化したエアコンから4文字だ！</p>";
      }
    } else if (currentRoom === 2) {
      if (document.getElementById("darkness").style.display === "block") {
        document.getElementById("hinto-msg").innerHTML =
          "<p>暗闇をタップして、3文部分ツイートしよう！</p>";
      } else if (
        document.getElementById("girlItem").style.display === "none" &&
        document.getElementById("oneShotaItem").style.display === "none"
      ) {
        document.getElementById("hinto-msg").innerHTML =
          "<p>穴から3文字だ！</p>";
      } else if (
        document.getElementById("shotaItem").style.display === "none" &&
        document.getElementById("oneShotaItem").style.display === "none"
      ) {
        document.getElementById("hinto-msg").innerHTML =
          "<p>ガールから3文字だ！</p>";
      } else if (document.getElementById("onesyo").style.display === "none") {
        document.getElementById("hinto-msg").innerHTML =
          "<p>おねショタから4文字だ！</p>";
      }
    } else if (currentRoom === 3) {
      // ① 鏡がない
      if (document.getElementById("kagamiItem").style.display === "none") {
        document.getElementById("hinto-msg").innerHTML =
          "<p>トランプから3文字だ！</p>";
      }
      // ② 鏡があるけど浄化とスターがない
      else if (
        document.getElementById("joukaItem").style.display === "none" &&
        document.getElementById("starItem").style.display === "none"
      ) {
        document.getElementById("hinto-msg").innerHTML =
          "<p>鏡から4文字だ！</p>";
      }
      // ③ 鏡があるけど浄化がない、スターはあるnewposterItem
      else if (
        document.getElementById("joukaItem").style.display === "none" &&
        document.getElementById("starItem").style.display === "block" &&
        document.getElementById("posterItem").style.display === "block"
      ) {
        document.getElementById("hinto-msg").innerHTML =
          "<p>鏡から4文字だが...鏡の説明文が変わってしまった！部分ツイーの順番を変えてみよう！</p>";
      }
      // ④ スター、浄化はあるが、身嗜みフラグがfalse
      else if (
        document.getElementById("starItem").style.display !== "none" &&
        document.getElementById("joukaItem").style.display !== "none" &&
        bodyCareFlag === false
      ) {
        document.getElementById("hinto-msg").innerHTML =
          "<p>...。その前に、スターの身だしなみを整えよう！</p>";
      }
      // ⑤ スター、浄化はあるが、バールがなくタップもしていない
      else if (
        document.getElementById("barItem").style.display === "none" &&
        haveBar === false
      ) {
        document.getElementById("hinto-msg").innerHTML =
          "<p>ポスターから3文字だ！！</p>";
      }
      // ⑥ バールと配電盤があるが、ランプがない
      else if (
        document.getElementById("haidenbanBrokenItem").style.display ===
          "none" &&
        document.getElementById("lampItem").style.display === "none"
      ) {
        document.getElementById("hinto-msg").innerHTML =
          "<p>トランプから3文字だ！</p>";
      } // ⑦ 配電盤を壊してない
      else if (
        document.getElementById("haidenbanBrokenItem").style.display === "none"
      ) {
        document.getElementById("hinto-msg").innerHTML =
          "<p>...バール！バールを持って、アレを壊せ！</p>";
      }
      // ⑦ カバーが無い
      else if (document.getElementById("coverItem").style.display === "none") {
        document.getElementById("hinto-msg").innerHTML =
          "<p>3文字だ！ポスターから「スターが望んでいる物」部分ツイートしよう！</p>";
      }
      // ⑧ 割れた窓がある
      else if (document.getElementById("windowItem").style.display !== "none") {
        document.getElementById("hinto-msg").innerHTML =
          "<p>うーん、、、独創的な歌声だ...。早く窓から脱出しよう！</p>";
      }
      // どの条件にも該当しない場合
      else {
        document.getElementById("hinto-msg").innerHTML =
          "<p>ポスター & トランプから部分ツイートしてみよう！</p>";
      }
    }
    Hinto.style.display = "block";
  } else {
    Hinto.style.display = "none";
    currentTime = 0;
    startCharging();
  }
}

function closeHintoOutside(e) {
  if (e.target.id === "hinto") {
    togglehinto();
  }
}

/**********************************************
 * クレジット表示
 **********************************************/
function toggleCredits() {
  const cBox = document.getElementById("credits-box");
  if (!cBox.style.display || cBox.style.display === "none") {
    cBox.style.display = "block";
  } else {
    cBox.style.display = "none";
  }
}
function closeCreditsOutside(e) {
  if (e.target.id === "credits-box") {
    toggleCredits();
  }
}


function toggleGameToolbar() {
  const toolbar = document.querySelector(".game-toolbar");
  const toggle = document.getElementById("toolbar-toggle");
  if (!toolbar || !toggle) return;

  const isCollapsed = toolbar.classList.toggle("is-collapsed");
  toggle.setAttribute("aria-expanded", String(!isCollapsed));
  toggle.setAttribute(
    "aria-label",
    isCollapsed ? "ゲーム操作を開く" : "ゲーム操作を閉じる"
  );
}

function collapseGameToolbar() {
  const toolbar = document.querySelector(".game-toolbar");
  const toggle = document.getElementById("toolbar-toggle");
  if (!toolbar || !toggle) return;

  toolbar.classList.add("is-collapsed");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "ゲーム操作を開く");
}

/**********************************************
 * siranuiプロフィール確認
 **********************************************/
function confirmSiranuiProfile() {
  document.getElementById("profile-confirm").style.display = "block";
}
function hideProfilePopup() {
  document.getElementById("profile-confirm").style.display = "none";
}
function closeProfileOutside(e) {
  if (e.target.id === "profile-confirm") {
    hideProfilePopup();
  }
}
function goToSiranui() {
  window.open("https://x.com/siranui__", "_blank");
  hideProfilePopup();
}

/**********************************************
 * 時を戻す (timeRewind)
 **********************************************/
function timeRewind() {
  document.getElementById("rewind-modal").style.display = "block";
}

function closeRewindModal() {
  document.getElementById("rewind-modal").style.display = "none";
}

function closeRewindOutside(e) {
  if (e.target.id === "rewind-modal") {
    closeRewindModal();
  }
}

function resetCurrentRoom() {
  closeRewindModal();
  if (currentRoom === 3) {
    gotoThirdRoom();
  } else if (currentRoom === 2) {
    restoreSecondRoom();
  } else {
    startGame();
  }
}



function goToTopPage() {
  window.location.href = "/";
}

function reloadPartialTweetPage() {
  window.location.reload();
}

/**********************************************
 * 2部屋目を初期に戻す
 **********************************************/
function restoreSecondRoom() {
  document.getElementById("aircon").style.display = "none";
  document.getElementById("table").style.display = "none";
  document.getElementById("book").style.display = "none";
  document.getElementById("kanaiItem").style.display = "none";
  document.getElementById("kegawaItem").style.display = "none";
  document.getElementById("rimokonItem").style.display = "none";
  document.getElementById("kochiItem").style.display = "none";
  document.getElementById("doriaItem").style.display = "none";
  document.getElementById("tatakaiItem").style.display = "none";
  document.getElementById("takaiItem").style.display = "none";
  document.getElementById("bowgunItem").style.display = "none";
  document.getElementById("holeItem").style.display = "none";

  document.getElementById("hole2Item").style.display = "block";
  document.getElementById("girlItem").style.display = "none";
  document.getElementById("shotaItem").style.display = "none";
  document.getElementById("kouseiItem").style.display = "none";
  document.getElementById("oneShotaItem").style.display = "none";
  document.getElementById("darkness").style.display = "block";
  document.getElementById("onesyo").style.display = "none";
  document.getElementById("keyItem").style.display = "none";

  document.getElementById("doorItem").style.display = "block";

  partialTweetCount = 4;
  document.getElementById("heart1").style.display = "inline";
  document.getElementById("heart2").style.display = "inline";
  document.getElementById("heart3").style.display = "inline";
  //document.getElementById("heart4").style.display = "none";
  //document.getElementById("heart5").style.display = "none";
  //document.getElementById("time-rewind").style.display="none";

  currentRoom = 2;
  haveKey = false;
  haveBar = false;
  bodyCareFlag = false;
  lampAcquired = false;
  haveJouka = false;
  starAppeared = false;
  posterCleaned = false;

  objectDescMap["ドア"] = "鍵がない...";
}

/**********************************************
 * 1部屋目 => 2部屋目
 **********************************************/
function nextRoom() {
  currentRoom = 2;
  haveKey = false;
  haveBar = false;
  bodyCareFlag = false;
  lampAcquired = false;
  haveJouka = false;
  starAppeared = false;
  posterCleaned = false;

  document.getElementById("aircon").style.display = "none";
  document.getElementById("table").style.display = "none";
  document.getElementById("book").style.display = "none";
  document.getElementById("kanaiItem").style.display = "none";
  document.getElementById("kegawaItem").style.display = "none";
  document.getElementById("rimokonItem").style.display = "none";
  document.getElementById("kochiItem").style.display = "none";
  document.getElementById("doriaItem").style.display = "none";
  document.getElementById("tatakaiItem").style.display = "none";
  document.getElementById("takaiItem").style.display = "none";
  document.getElementById("bowgunItem").style.display = "none";
  document.getElementById("holeItem").style.display = "none";

  document.getElementById("hole2Item").style.display = "block";
  document.getElementById("darkness").style.display = "block";
  document.getElementById("doorItem").style.display = "block";

  partialTweetCount = 4;
  document.getElementById("heart1").style.display = "inline";
  document.getElementById("heart2").style.display = "inline";
  document.getElementById("heart3").style.display = "inline";
  // document.getElementById("heart4").style.display = "none";
  //document.getElementById("heart5").style.display = "none";

  objectDescMap["ドア"] = "鍵がない...";
}

/**********************************************
 * 2部屋目 => 3部屋目
 **********************************************/
function gotoThirdRoom() {
  currentRoom = 3;
  objectDescMap["ポスター"] = "汚れていて読めない";
  objectDescMap["鏡"] = "卓上鏡だ";

  document.getElementById("darkness-overlay").style.display = "none";
  document.getElementById("brokenWindowItem").style.display = "none";

  document.getElementById("onesyo").style.display = "none";
  document.getElementById("oneShotaItem").style.display = "none";
  document.getElementById("Opendoor").style.display = "none";
  document.getElementById("doorItem").style.display = "none";
  document.getElementById("darkness").style.display = "none";
  document.getElementById("popup").style.display = "none";

  partialTweetCount = 6;
  document.getElementById("heart1").style.display = "inline";
  document.getElementById("heart2").style.display = "inline";
  document.getElementById("heart3").style.display = "inline";
  document.getElementById("heart4").style.display = "inline";
  document.getElementById("heart5").style.display = "inline";
  document.getElementById("heart6").style.display = "inline";
  //document.getElementById("time-rewind").style.display="none";

  // 3部屋目初期
  document.getElementById("toranpuItem").style.display = "block";
  document.getElementById("posterItem").style.display = "block";
  document.getElementById("newposterItem").style.display = "none";
  document.getElementById("shutterItem").style.display = "block";
  document.getElementById("haidenbanItem").style.display = "block";

  document.getElementById("barItem").style.display = "none";
  document.getElementById("lampItem").style.display = "none";
  document.getElementById("kagamiItem").style.display = "none";
  document.getElementById("starItem").style.display = "none";
  document.getElementById("windowItem").style.display = "none";
  document.getElementById("haidenbanBrokenItem").style.display = "none";
  document.getElementById("joukaItem").style.display = "none";
  document.getElementById("coverItem").style.display = "none";

  haveKey = false;
  haveBar = false;
  bodyCareFlag = false;
  lampAcquired = false;
  haveJouka = false;
  starAppeared = false;
  posterCleaned = false;
}

/**********************************************
 * consumeHeart (5個)
 **********************************************/
function consumeHeart() {
  if (partialTweetCount > 0) {
    partialTweetCount--;
    if (partialTweetCount === 5) {
      document.getElementById("heart6").style.display = "none";
    } else if (partialTweetCount === 4) {
      document.getElementById("heart5").style.display = "none";
    } else if (partialTweetCount === 3) {
      document.getElementById("heart4").style.display = "none";
    } else if (partialTweetCount === 2) {
      document.getElementById("heart3").style.display = "none";
    } else if (partialTweetCount === 1) {
      document.getElementById("heart2").style.display = "none";
    } else if (partialTweetCount === 0) {
      document.getElementById("heart1").style.display = "none";
      document.getElementById("time-rewind").style.display = "block";
    }
  }
}

/**********************************************
 * ハートの説明
 **********************************************/
function showHeartInfo() {
  const hinfo = document.getElementById("heart-info");
  hinfo.style.display = "block";
  setTimeout(() => {
    hinfo.style.display = "none";
  }, 4000);
}

/**********************************************
 * 使用ボタン (doUse)
 **********************************************/
function doUse() {
  const descEl = document.getElementById("popup-desc");
  if (!descEl.textContent) {
    descEl.textContent = objectDescMap[currentObjectName] || "";
  }

  // リモコン=>エアコン=>冷房ガンガン
  if (currentObjectName === "リモコン") {
    objectDescMap["エアコン"] = "冷房ガンガンだ";
  }
  // ボウガン => 穴
  if (currentObjectName === "ボウガン") {
    descEl.textContent = "壁に穴が空いた！";
    document.getElementById("holeItem").style.display = "block";
  }
  // ガール+ショタ => 特別ポップアップ
  if (currentObjectName === "ガール") {
    const shotaEl = document.getElementById("shotaItem");
    if (shotaEl.style.display !== "none") {
      document.getElementById("girlItem").style.display = "none";
      document.getElementById("girl-use-popup").style.display = "block";
    }
  }
  // ドア使用
  if (currentObjectName === "ドア") {
    if (haveKey) {
      descEl.textContent =
        "...そっとドアを開けて、おねショタの2人を置いて脱出した";
      onSuccessDoor();
    } else {
      descEl.textContent = objectDescMap["ドア"];
    }
  }
}

/**********************************************
 * 暗がり演出
 **********************************************/

function updateDarknessEffect() {
  const darknessOverlay = document.getElementById("darkness-overlay");

  if (
    document.getElementById("lampItem").style.display !== "none" &&
    document.getElementById("haidenbanBrokenItem").style.display !== "none"
  ) {
    darknessOverlay.style.display = "block";
  } else {
    darknessOverlay.style.display = "none";
  }
}

/**********************************************
 * オブジェクトをタップ => ポップアップ (tapObject)
 **********************************************/
function tapObject(name) {
  if (name === "おしまい" && simaiCount > 0) {
    showToast("遊んでくれてありがとう！");
    return;
  }

  currentObjectName = name;

  // (A) ガール+ショタ => doUse
  if (name === "ガール") {
    const shotaEl = document.getElementById("shotaItem");
    if (shotaEl.style.display !== "none") {
      doUse();
      return;
    }
  }

  // (B) バールタップ => バール取得
  if (name === "バール" || name === "ばある") {
    haveBar = true;
    document.getElementById("barItem").style.display = "none";
    showToast("バールを取得した！");
    return;
  }

  // (C) シャッター => バールありで壊す=>窓 表示
  if (name === "シャッター" && haveBar) {
    document.getElementById("shutterItem").style.display = "none";
    document.getElementById("windowItem").style.display = "block";
    showToast("バールが壊れた");
    haveBar = false;
    return;
  }

  // (D) 配電盤 => バールありで破壊 => シャッター消す+窓表示+配電盤故障
  if (name === "配電盤" && haveBar) {
    document.getElementById("haidenbanItem").style.display = "none";
    document.getElementById("haidenbanBrokenItem").style.display = "block";
    document.getElementById("shutterItem").style.display = "none";
    document.getElementById("windowItem").style.display = "block";
    showToast("シャッターが開いた。バールが壊れた");
    updateDarknessEffect();
    haveBar = false;

    // ランプ未取得 => 暗闇
    if (document.getElementById("lampItem").style.display === "none") {
      document.getElementById("darkness").style.display = "block";
      objectDescMap["暗闇"] = "暗いﾎﾟｩ！怖いﾎﾟｩ！";
    }
    return;
  }
  //(E) 浄化、スターがある状態でポスターをタップ→マイケルが掃除する
  if (
    name === "ポスター" &&
    document.getElementById("joukaItem").style.display === "block" &&
    document.getElementById("starItem").style.display === "block" &&
    objectDescMap["ポスター"] === "汚れていて読めない"
  ) {
    document.getElementById("posterItem").style.display = "none";
    document.getElementById("newposterItem").style.display = "block";
    document.getElementById("joukaItem").style.display = "none";
    objectDescMap["ポスター"] = "大衆酒場アルバイト大募集！";
    posterCleaned = true;
    //ガールユーズポップアップを使い回す
    document.querySelector("#girl-use-popup h3").textContent = "スター";
    document.querySelector("#girl-use-popup p").textContent =
      "汚れてるﾎﾟｩ！掃除するﾎﾟｩ！";
    document.getElementById("girl-use-popup").style.display = "block";
  }

  //(F) 鏡、スター、配電盤がある状態で鏡をタップ→マイケルが身だしなみを整える
  if (
    name === "鏡" &&
    document.getElementById("kagamiItem").style.display === "block" &&
    document.getElementById("starItem").style.display === "block" &&
    document.getElementById("haidenbanItem").style.display === "block" &&
    bodyCareFlag === false
  ) {
    objectDescMap["鏡"] = "イケメンが映っている";
    bodyCareFlag = true;
    //ガールユーズポップアップを使い回す
    document.querySelector("#girl-use-popup h3").textContent = "スター";
    document.querySelector("#girl-use-popup p").textContent =
      "ヘアーが乱れてるﾎﾟｩ！！整えるﾎﾟｩ！";
    document.getElementById("girl-use-popup").style.display = "block";
  }
  if (
    name === "鏡" &&
    document.getElementById("kagamiItem").style.display === "block" &&
    document.getElementById("starItem").style.display === "block" &&
    document.getElementById("haidenbanItem").style.display === "none"
  ) {
    return;
    //暗がりになると、煙で隠れて鏡がタップできない、みたいな
    objectDescMap["鏡"] = "薄暗くてよく見えない";
  }

  // (G)スター（マイケル）がタップされた時の処理
  if (name === "スター") {
    let messages = [];

    if (
      document.getElementById("haidenbanBrokenItem").style.display === "none"
    ) {
      messages.push("本物ﾎﾟｩ！明るいのは嫌いﾎﾟｩ！");
    }
    if (document.getElementById("coverItem").style.display === "none") {
      messages.push("本物ﾎﾟｩ！カバー曲を歌いたいﾎﾟｩ！");
    }
    if (bodyCareFlag == false) {
      messages.push("本物ﾎﾟｩ！身だしなみを整えたいﾎﾟｩ！");
    }

    if (messages.length > 0) {
      let randomMessage = messages[Math.floor(Math.random() * messages.length)];
      showToast(randomMessage);
      return;
    } else {
      document.querySelector("#girl-use-popup h3").textContent = "スター";
      document.querySelector("#girl-use-popup p").textContent =
        "完璧ﾎﾟｩ！轟け！俺のソウルソング！ﾎﾟｩ！";
      document.getElementById("girl-use-popup").style.display = "block";
      return;
    }
  }

  // default pop => popup
  const pop = document.getElementById("popup");
  const descEl = document.getElementById("popup-desc");
  const titleEl = document.getElementById("popup-title");

  descEl.textContent = "";
  titleEl.textContent = name;
  popupHiraganaMode = false;
  document.getElementById("tweet-footer").style.display = "grid";
  document.getElementById("tweet-input").value = "";
  document.getElementById("tweet-error-msg").textContent = "";

  doUse();
  popupOriginalTitle = titleEl.textContent;
  popupOriginalDesc = descEl.textContent;
  updateHiraganaToggleButton();
  updatePartialTweetViewportVars();
pop.classList.add("is-open");
pop.style.display = "block";
}

/**********************************************
 * ポップアップを閉じる (closePopup)
 **********************************************/
function closePopup(e) {
  // スター+鏡=block & 配電盤=none => GM「身嗜みは大切ﾎﾟｩね」
  if (currentObjectName === "スター") {
    let starB = document.getElementById("starItem").style.display !== "none";
    let kagamiB =
      document.getElementById("kagamiItem").style.display !== "none";
    let haidenB =
      document.getElementById("haidenbanItem").style.display !== "none" ||
      document.getElementById("haidenbanBrokenItem").style.display !== "none";
    if (starB && kagamiB && !haidenB) {
      onBadEnd("身だしみは大切ﾎﾟｩね");
      return;
    }
  }

  //alert(currentRoom)
  // 暗闇 => ランプなし => GM
  if (
    currentObjectName === "暗闇" &&
    document.getElementById("lampItem").style.display === "none" &&
    currentRoom === 3
  ) {
    onBadEnd("...本物ﾎﾟｩ！");
    return;
  }

  const popup = document.getElementById("popup");
popup.classList.remove("is-open");
popup.style.display = "none";

  document.getElementById("tweet-error-msg").textContent = "";

  
  
    
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
}

function closePopupOutside(e) {
  if (e.target.id !== "popup") return;
  const errEl = document.getElementById("tweet-error-msg");
  const inputEl = document.getElementById("tweet-input");
  // エラーメッセージが出ている場合は閉じずに入力欄へ戻す
  if (errEl.textContent.trim() !== "") {
  inputEl.focus({ preventScroll: true });
  updatePartialTweetVisualOffset();
  return;
}
  closePopup();
}
/**********************************************
 * ショタ後ガール使用 => 特別ポップアップ
 **********************************************/
function closeGirlUsePopup() {
  if (
    document.querySelector("#girl-use-popup p").textContent ===
    "完璧ﾎﾟｩ！轟け！俺のソウルソング！ﾎﾟｩ！"
  ) {
    showToast("窓が粉々に割れた！");
    document.getElementById("windowItem").style.display = "none";
    document.getElementById("brokenWindowItem").style.display = "block";
  }
  document.getElementById("girl-use-popup").style.display = "none";
  document.getElementById("girlItem").style.display = "none";
  document.getElementById("shotaItem").style.display = "none";
  if (currentRoom === 2) {
    document.getElementById("oneShotaItem").style.display = "block";
  }
}
function closeGirlUseOutside(e) {
  if (e.target.id === "girl-use-popup") {
    closeGirlUsePopup();
  }
}

/**********************************************
 * 表示切り替え (togglePopupHiragana)
 **********************************************/
function renderPopupText() {
  const popTitle = document.getElementById("popup-title");
  const popDesc = document.getElementById("popup-desc");

  popTitle.textContent = popupHiraganaMode
    ? toHiragana(popupOriginalTitle)
    : popupOriginalTitle;
  popDesc.textContent = popupHiraganaMode
    ? toHiragana(popupOriginalDesc)
    : popupOriginalDesc;
}

function updateHiraganaToggleButton() {
  const toggleBtn = document.getElementById("hiragana-toggle-btn");
  if (!toggleBtn) return;

  toggleBtn.setAttribute("aria-pressed", String(popupHiraganaMode));
  toggleBtn.setAttribute(
    "aria-label",
    popupHiraganaMode ? "元の表示に戻す" : "ひらがな表示に切り替え"
  );
  toggleBtn.title = popupHiraganaMode ? "元の表示に戻す" : "ひらがな表示に切り替え";
}

function togglePopupHiragana(e) {
  if (e) {
    e.stopPropagation();
  }

  popupHiraganaMode = !popupHiraganaMode;
  renderPopupText();
  updateHiraganaToggleButton();
  document.getElementById("tweet-error-msg").textContent = "";

  updatePartialTweetViewportVars();
}

/**********************************************
 * カナ→ひらがな変換 (hiraganaMap / toHiragana)
 **********************************************/
const hiraganaMap = {
  エアコン: "えあこん",
  動かない: "うごかない",
  机: "つくえ",
  建付けが悪い: "たてつけがわるい",
  昆虫図鑑: "こんちゅうずかん",
  蟻も昆虫らしい: "ありもこんちゅうらしい",
  家内: "かない",
  結構千鳥足だ: "けっこうちどりあしだ",
  毛皮: "けがわ",
  暖かい: "あたたかい",
  リモコン: "りもこん",
  エアコンが付いた: "えあこんがついた",
  冷房ガンガンだ: "れいぼうがんがんだ",
  ドア: "どあ",
  "鍵がない...": "かぎがない...",
  "...そっとドアを開けて、おねショタの2人を置いて脱出した":
    "...そっとどあをあけて、おねしょたのふたりをおいてだっしゅつした",
  穴: "あな",
  底になにかがある: "そこになにかがある",
  ガール: "がーる",
  "初対面の女子高生だ。": "しょたいめんのじょしこうせいだ。",
  ショタ: "しょた",
  元気な男の子: "げんきなおとこのこ",
  恒星: "こうせい",
  "体が溶けちまうぅ…": "からだがとけちまうぅ…",
  おねショタ: "おねしょた",
  お姉さんは満面の笑みだ: "おねえさんはまんめんのえみだ",
  暗闇: "くらやみ",
  暗いと何も見えない: "くらいとなにもみえない",
  "壁に穴が空いた！": "かべにあながあいた！",

  トランプ: "とらんぷ",
  "赤が見つからない": "あかがみつからない",
  ポスター: "ぽすたー",
  "大衆酒場アルバイト大募集！": "たいしゅうさかばあるばいとだいぼしゅう",
  汚れていて読めない: "よごれていてよめない",
  シャッター: "しゃったー",
  電子ロックされている: "でんしろっくされている",
  配電盤: "はいでんばん",
  不気味な音がする: "ぶきみなおとがする",
  スター: "すたー",
  "本物ﾎﾟｩ！": "ほんものぽぅ",
  バール: "ばーる",
  錆び付いている: "さびついている",
  ランプ: "らんぷ",
  良さげな雰囲気: "よさげなふんいき",
  鏡: "かがみ",
  卓上鏡だ: "たくじょうかがみだ",
 イケメンが映っている:"いけめんがうつっている",
  窓: "まど",
  外が見える: "そとがみえる",
  浄化: "じょうか",
  汚れが落ちそうだ: "よごれがおちそうだ",

  故障中: "こしょうちゅう",
  "暗いﾎﾟｩ！怖いﾎﾟｩ！": "くらいぽぅこわいぽぅ",
  薄暗くてよく見えない: "うすぐらくてよくみえない",
  "スリラーのカバー曲。微妙に音程がズレている。":
    "すりらーのかばーきょくびみょうにおんていがずれている",
  "完璧ﾎﾟｩ！轟け！俺のソウルソング！ﾎﾟｩ！":
    "かんぺきぽぅとどろけおれのそうるそんぐぽぅ",
};

function toHiragana(str) {
  return hiraganaMap[str] || str;
}

/**********************************************
 * 部分ツイート => 決定 (submitTweet)
 **********************************************/
 function submitTweet() {
  const inputVal = document.getElementById("tweet-input").value.trim();
  const errEl = document.getElementById("tweet-error-msg");
  errEl.textContent = "";

  if (partialTweetCount <= 0) {
    errEl.textContent = "これ以上部分ツイートはできません。";
    return;
  }
  if (inputVal.length < 3) {
    errEl.textContent = "3文字以上入力してください。";
    return;
  }

  /**********************************************
   * 1・2部屋目
   **********************************************/
  let advancedMap = {
    家内: { corrects: ["こうち", "どりあ"], items: ["kochiItem", "doriaItem"] },
    毛皮: {
      corrects: ["たたかい", "たかい"],
      items: ["tatakaiItem", "takaiItem"],
    },
  };
  let partialTweetMap = {
    エアコン: { corrects: ["かない"], newItem: "kanaiItem" },
    机: { corrects: ["けがわ"], newItem: "kegawaItem" },
    昆虫図鑑: { corrects: ["りもこん"], newItem: "rimokonItem" },
    "エアコン(冷房)": { corrects: ["ぼうがん"], newItem: "bowgunItem" },
  };

  // (A) advancedMap => 家内 or 毛皮
  if (advancedMap[currentObjectName]) {
    const { corrects, items } = advancedMap[currentObjectName];
    if (!corrects.includes(inputVal)) {
      errEl.textContent = "該当しませんでした。";
      return;
    }
    
    const idx = corrects.indexOf(inputVal);
    const itemId = items[idx];
    const itEl = document.getElementById(itemId);
    if (itEl.style.display !== "none") {
      errEl.textContent = "もう取得済みです。";
      return;
    }
    consumeHeart();
    itEl.style.display = "block";
    showToast(`${itEl.alt}が出現しました！`);
    closePopup();
    return;
  }
  // (B) エアコン(冷房) => ぼうがん
  else if (
    currentObjectName === "エアコン" &&
    objectDescMap["エアコン"] === "冷房ガンガンだ"
  ) {
    if (inputVal === "ぼうがん") {
      const bowEl = document.getElementById("bowgunItem");
      if (bowEl.style.display !== "none") {
        errEl.textContent = "もう取得済みです。";
        return;
      }
      consumeHeart();
      bowEl.style.display = "block";
      showToast(`${bowEl.alt}が出現しました！`);
      closePopup();
      return;
    } else {
      errEl.textContent = "該当しませんでした。";
      return;
    }
  }
  // (C) partialTweetMap => エアコン(動かない)/机/昆虫図鑑
  else if (partialTweetMap[currentObjectName]) {
    const data = partialTweetMap[currentObjectName];
    if (
      currentObjectName === "エアコン" &&
      objectDescMap["エアコン"] === "動かない"
    ) {
      if (!data.corrects.includes(inputVal)) {
        errEl.textContent = "該当しませんでした。";
        return;
      }
      const itEl = document.getElementById(data.newItem);
      if (itEl.style.display !== "none") {
        errEl.textContent = "もう取得済みです。";
        return;
      }
      consumeHeart();
      itEl.style.display = "block";
      showToast(`${itEl.alt}が出現しました！`);
      closePopup();
      return;
    } else {
      if (!data.corrects.includes(inputVal)) {
        errEl.textContent = "該当しませんでした。";
        return;
      }
      const itEl = document.getElementById(data.newItem);
      if (itEl.style.display !== "none") {
        errEl.textContent = "もう取得済みです。";
        return;
      }
      consumeHeart();
      itEl.style.display = "block";
      showToast(`${itEl.alt}が出現しました！`);
      closePopup();
      return;
    }
  }

  // 2部屋目 => 穴/ガール/おねショタ/暗闇
  if (
    currentObjectName === "穴" &&
    objectDescMap["穴"] === "底になにかがある"
  ) {
    if (
      (inputVal === "がある" || inputVal === "がーる") &&
      document.getElementById("oneShotaItem").style.display === "none"
    ) {
      const girlEl = document.getElementById("girlItem");
      if (girlEl.style.display !== "none") {
        errEl.textContent = "ガールはもう取得済みです。";
        return;
      }
      consumeHeart();
      girlEl.style.display = "block";
      showToast("ガールが出現しました！");
      closePopup();
      return;
    }
    // マッチしなかった
    errEl.textContent = "該当しませんでした。";
    return;
  }

  if (currentObjectName === "ガール") {
    if (inputVal === "しょた") {
      const sEl = document.getElementById("shotaItem");
      if (sEl.style.display !== "none") {
        errEl.textContent = "ショタはもう取得済みです。";
        return;
      }
      consumeHeart();
      sEl.style.display = "block";
      showToast("ショタが出現しました！");
    } else if (inputVal === "こうせい") {
      const kEl = document.getElementById("kouseiItem");
      if (kEl.style.display !== "none") {
        errEl.textContent = "恒星はもう取得済みです。";
        return;
      }
      consumeHeart();
      kEl.style.display = "block";
      showToast("恒星が出現しました！");
    } else if (inputVal === "たいめん") {
      onBadEnd("あの...え〜。こんばんワ(*^▽^)ﾉ　\n...俺は口下手だ！");
    } else if (inputVal === "しこう") {
      onBadEnd(
        "う〜んと、あっ。ｯｽ〜...お寿司好きカナ？🍣👅　\n...俺は口下手だ！"
      );
    } else {
      errEl.textContent = "該当しませんでした。";
      return;
    }
    closePopup();
    return;
  }
  if (currentObjectName === "おねショタ") {
    if (inputVal === "おねしょ") {
      consumeHeart();
      document.getElementById("hole2Item").style.display = "none";
      document.getElementById("onesyo").style.display = "block";
      document.getElementById("keyItem").style.display = "block";
      showToast("穴が【液体】で満たされた！");
      closePopup();
      return;
    }
    errEl.textContent = "該当しませんでした。";
    return;
  }
  if (currentObjectName === "暗闇") {
    if (inputVal === "らいと") {
      consumeHeart();
      document.getElementById("darkness").style.display = "none";
      showToast("ライトが出現しました！（暗闇解除）");
      closePopup();
      return;
    }
    errEl.textContent = "該当しませんでした。";
    return;
  }

  // ============ 3部屋目 ============

  // ポスター => すたー => スター, ばある/ばーる => バール, かばー => カバー
  if (currentObjectName === "ポスター") {
    if (inputVal === "すたー") {
      if(document.getElementById("starItem").style.display === "block" ) {
        errEl.textContent = "スターはここに居るﾎﾟｩ！";
        return;
      }
      consumeHeart();
      document.getElementById("starItem").style.display = "block";
      showToast("スター？が出現しました！");
      closePopup();
      return;
    } else if (document.getElementById("newposterItem").style.display === "block" && (inputVal === "かばー" || inputVal === "かばあ")) {
      if(document.getElementById("coverItem").style.display === "block" ) {
        errEl.textContent = "カバー曲はもう取得済みです";
        return;
      }
      consumeHeart();
      document.getElementById("coverItem").style.display = "block";
      showToast("カバーが出現しました！");
      closePopup();
      return;
    } else if ((inputVal === "ばある" || inputVal === "ばーる") && !haveBar && document.getElementById("newposterItem").style.display === "block") {
      if(document.getElementById("barItem").style.display === "block" ) {
        errEl.textContent = "バールはもう取得済みです";
        return;
      }
      consumeHeart();
      document.getElementById("barItem").style.display = "block";
      showToast("バールのようなものが出現しました！");
      closePopup();
      return;
    }
    errEl.textContent = "該当しませんでした。";
    return;
  }

  // トランプ => らんぷ/かがみ
  if (currentObjectName === "トランプ") {
    if (inputVal === "らんぷ") {
      if(document.getElementById("lampItem").style.display === "block" ) {
        errEl.textContent = "ランプはもう取得済みです";
        return;
      }
      consumeHeart();
      document.getElementById("lampItem").style.display = "block";
      showToast("ランプが出現しました！");
      closePopup();
      return;
    } else if (inputVal === "かがみ") {
      if(document.getElementById("kagamiItem").style.display === "block" ) {
        errEl.textContent = "鏡はもう取得済みです";
        return;
      }
      consumeHeart();
      document.getElementById("kagamiItem").style.display = "block";
      showToast("鏡が出現しました！");
      closePopup();
      return;
    }
    errEl.textContent = "該当しませんでした。";
    return;
  }

  // 鏡 => じょうか
  if (currentObjectName === "鏡") {
    if (
      inputVal === "じょうか" &&
      document.getElementById("joukaItem").style.display === "none" &&
      bodyCareFlag === false
    ) {
     if(document.getElementById("joukaItem").style.display === "block" ) {
        errEl.textContent = "浄化はもう取得済みです";
        return;
      } 
      consumeHeart();
      document.getElementById("joukaItem").style.display = "block";
      showToast("浄化が出現しました！");
      closePopup();
      return;
    }
    errEl.textContent = "該当しませんでした。";
    return;
  }

  // おしまい => しまい => 姉妹生成
  if (currentObjectName === "おしまい" && inputVal === "しまい") {
    simaiCount++;

    if (simaiCount === 1) {
      // 最初の1回はデフォルトの姉妹を表示
      document.getElementById("simaiItem").style.display = "block";
    } else {
      // 新しい姉妹を作成してランダム配置
      const newSimai = document.createElement("img");
      newSimai.src = document.getElementById("simaiItem").src;
      newSimai.alt = "姉妹";
      newSimai.classList.add("simai-clone");

      let randomLeft = Math.random() * 100;
      let randomTop = Math.random() * 100;
      let randomScale = Math.random() * 0.8 + 0.01;
      let randomRotation = Math.random() * 360;

      newSimai.style.position = "absolute";
      newSimai.style.left = `${randomLeft}%`;
      newSimai.style.top = `${randomTop}%`;
      newSimai.style.transform = `rotate(${randomRotation}deg) scale(${randomScale})`;
      newSimai.style.zIndex = "9999";
      newSimai.style.pointerEvents = "none";
      newSimai.style.opacity = "0";
      newSimai.style.transition = "opacity 0.5s ease-in-out";

      document.body.appendChild(newSimai);
      setTimeout(() => {
        newSimai.style.opacity = "1";
      }, 100);
    }

    document.getElementById("thank-you-line1").style.display = "block";
    document.getElementById("thank-you-line2").style.display = "block";

    closePopup();
    return;
  }

  // すべての分岐に該当しなければ
  errEl.textContent = "該当しませんでした。";
}

/**********************************************
 * 鍵を取得
 **********************************************/
function getKey() {
  haveKey = true;
  document.getElementById("keyItem").style.display = "none";
  showToast("鍵を手に入れた！");
}

/**********************************************
 * ゲームオーバー
 **********************************************/
function onBadEnd(msg) {
  /* if (currentRoom === 2) {
    setTimeout(() => showGameOver(msg), 100);
  } else {*/
  showGameOver(msg);
  //}
}
function showGameOver(msg) {
  const ov = document.getElementById("ending-overlay");
  ov.className = "gameover";
  ov.style.display = "block";
  document.getElementById("ending-message").innerHTML = `
    <div>ゲームオーバー</div>
    <div style="margin-top:0.5rem; font-size:1rem;white-space:pre-wrap;">${msg}</div>
  `;
}

/**********************************************
 * 1部屋目 穴 => onSuccess()
 **********************************************/
function onSuccess() {
  const ov = document.getElementById("ending-overlay");
  ov.className = "success";
  ov.style.display = "block";
  document.getElementById("ending-message").innerHTML = `
    <div>脱出成功！！</div>
    <div style="font-size:1rem;margin-top:0.5rem;">おめでとうございます！</div>
  `;
}

/**********************************************
 * hideEnding (エンディング画面)
 **********************************************/
function hideEnding() {
  const ov = document.getElementById("ending-overlay");

  // まずオーバーレイを閉じる
  ov.style.display = "none";

  // 次にクラスをクリア（アニメ除去したい場合）
  //ov.classList.remove("gameover", "success");

  // ここから部屋の分岐
  if (ov.classList.contains("gameover")) {
    // currentRoomを見て処理
    if (currentRoom === 2) {
      restoreSecondRoom();
    } else if (currentRoom === 3) {
      gotoThirdRoom();
    } else {
      startGame();
    }
  } else if (ov.classList.contains("success")) {
    if (currentRoom === 2) {
      gotoThirdRoom();
    } else if (currentRoom === 3) {
      partialTweetCount = 1;
      document.getElementById("oshimai-screen").style.display = "flex"; // 画面表示
    } else {
      nextRoom();
    }
  }
}

/**********************************************
 * ドア使用 => 鍵ありで onSuccessDoor()
 **********************************************/
function onSuccessDoor() {
  document.getElementById("Opendoor").style.display = "block";
  document.getElementById("doorItem").style.display = "none";
  closePopup();

  const ov = document.getElementById("ending-overlay");
  ov.className = "success";
  ov.style.display = "block";
  document.getElementById("ending-message").innerHTML = `
    <div>脱出成功！！</div>
    <div style="font-size:1rem;margin-top:0.5rem;">ドアが開いた！おめでとうございます！</div>
  `;
}