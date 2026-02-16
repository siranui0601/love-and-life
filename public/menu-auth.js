// Google の ID トークン（JWT）をパースする小さい関数
function parseJwt(token) {
  try {
    const [header, payload, signature] = token.split(".");
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch (e) {
    console.error("JWT parse error:", e);
    return null;
  }
}

// ログインしたユーザー名をゲーム側からも使えるようにしておく
//window.currentUserName = null;
//window.currentUser = null; // { email, username, googleName }

// ========================================
// ゲーム選択メニューの処理
// ========================================
// ログインしたユーザー情報（アプリ内用）
window.currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
  const gameMenu = document.getElementById('gameMenu');
  const titleScreen = document.getElementById('titleScreen');
  const literaryClubScreen = document.getElementById('literaryClubScreen');
  const gameCards = document.querySelectorAll('.game-card');
  const loginStatus = document.getElementById("loginStatus");
  const logoutBtn = document.getElementById("logoutBtn");
  const btnContainer = document.getElementById("googleSignInBtn");
  const loginForm = document.querySelector(".login-form");
  const loginUsername = document.getElementById("loginUsername");
  const loginPassword = document.getElementById("loginPassword");
  const loginBtn = document.getElementById("loginBtn");
  const openSignupBtn = document.getElementById("openSignupBtn");
  const openLoginBtn = document.getElementById("openLoginBtn");
  const authArea = document.getElementById("authArea");
  const signupModal = document.getElementById("signupModal");
  const signupUsername = document.getElementById("signupUsername");
  const signupPassword = document.getElementById("signupPassword");
  const signupPasswordConfirm = document.getElementById("signupPasswordConfirm");
  const signupSubmitBtn = document.getElementById("signupSubmitBtn");
  const closeSignupBtn = document.getElementById("closeSignupBtn");
  const googleSignUpBtn = document.getElementById("googleSignUpBtn");
  const usernameModal = document.getElementById("usernameModal");
  const usernameInput = document.getElementById("usernameInput");
  const usernameSaveBtn = document.getElementById("usernameSaveBtn");
  const pendingSignupKey = "pendingGoogleSignup";

  function showAuthArea() {
    if (!authArea) return;
    authArea.style.display = "flex";
  }

  function setAuthUiLoggedIn(username) {
    showAuthArea();
    if (loginStatus && username) {
      loginStatus.textContent = `${username} でログイン中`;
    }
    if (btnContainer) btnContainer.style.display = "none";
    if (loginForm) loginForm.style.display = "none";
    if (openSignupBtn) openSignupBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
  }

  function setAuthUiLoggedOut() {
    showAuthArea();
    if (loginStatus) loginStatus.textContent = "ログインしていません";
    if (btnContainer) btnContainer.style.display = "block";
    if (loginForm) loginForm.style.display = "grid";
    if (openSignupBtn) openSignupBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
  }

  try {
    const stored = localStorage.getItem("currentUser");
    if (stored) {
      window.currentUser = JSON.parse(stored);
      if (window.currentUser?.username) {
        setAuthUiLoggedIn(window.currentUser.username);
      }
    }
  } catch (error) {
    console.error("localStorage parse error:", error);
  }

  function openUsernameModal({ email, gName }) {
    if (!usernameModal || !usernameInput || !usernameSaveBtn) return;

    sessionStorage.setItem(pendingSignupKey, JSON.stringify({ email, gName }));

    if (signupModal) {
      signupModal.style.display = "none";
      signupModal.setAttribute("aria-hidden", "true");
    }
    usernameInput.value = gName;
    usernameModal.style.display = "flex";

    usernameSaveBtn.onclick = async () => {
      const username = usernameInput.value.trim();
      if (!username) {
        alert("ユーザーネームを入力してください");
        return;
      }

      try {
        const res2 = await fetch("/api/user/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            username,
            googleDisplayName: gName,
          }),
        });
        const data = await res2.json();
        if (data.error) {
          alert("ユーザーネームの登録に失敗しました");
          return;
        }

        window.currentUser = {
          email,
          username: data.username,
          googleName: data.displayName || gName,
        };
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        sessionStorage.removeItem(pendingSignupKey);

        setAuthUiLoggedIn(data.username);
        usernameModal.style.display = "none";
      } catch (e) {
        console.error("register error:", e);
        alert("ユーザーネームの登録に失敗しました");
      }
    };
  }

  if (openLoginBtn) {
    openLoginBtn.addEventListener("click", () => {
      showAuthArea();
    });
  }

  if (openSignupBtn && signupModal) {
    openSignupBtn.addEventListener("click", (event) => {
      event.preventDefault();
      showAuthArea();
      signupModal.style.display = "flex";
      signupModal.setAttribute("aria-hidden", "false");
    });
  }

  if (closeSignupBtn && signupModal) {
    closeSignupBtn.addEventListener("click", () => {
      signupModal.style.display = "none";
      signupModal.setAttribute("aria-hidden", "true");
    });
  }

  if (signupModal) {
    signupModal.addEventListener("click", (event) => {
      if (event.target === signupModal) {
        signupModal.style.display = "none";
        signupModal.setAttribute("aria-hidden", "true");
      }
    });
  }

  if (signupSubmitBtn) {
    signupSubmitBtn.addEventListener("click", async () => {
      const username = signupUsername?.value.trim() || "";
      const password = signupPassword?.value || "";
      const confirm = signupPasswordConfirm?.value || "";

      if (!username || !password) {
        alert("ユーザーネームとパスワードを入力してください");
        return;
      }
      if (password !== confirm) {
        alert("パスワードが一致しません");
        return;
      }

      try {
        const res = await fetch("/api/user/register-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          alert(data.error || "登録に失敗しました");
          return;
        }

        window.currentUser = {
          email: username,
          username: data.username,
          googleName: null,
        };
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        setAuthUiLoggedIn(data.username);
        signupModal.style.display = "none";
        signupModal.setAttribute("aria-hidden", "true");
        if (signupPassword) signupPassword.value = "";
        if (signupPasswordConfirm) signupPasswordConfirm.value = "";
      } catch (e) {
        console.error("signup error:", e);
        alert("登録に失敗しました");
      }
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const username = loginUsername?.value.trim() || "";
      const password = loginPassword?.value || "";
      if (!username || !password) {
        alert("ユーザーネームとパスワードを入力してください");
        return;
      }

      try {
        const res = await fetch("/api/user/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.exists) {
          alert(data.error || "ログインに失敗しました");
          return;
        }

        window.currentUser = {
          email: username,
          username: data.username,
          googleName: null,
        };
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        setAuthUiLoggedIn(data.username);
        if (loginPassword) loginPassword.value = "";
      } catch (e) {
        console.error("login error:", e);
        alert("ログインに失敗しました");
      }
    });
  }

  if (!window.currentUser) {
    try {
      const pendingSignupRaw = sessionStorage.getItem(pendingSignupKey);
      if (pendingSignupRaw) {
        const pendingSignup = JSON.parse(pendingSignupRaw);
        if (pendingSignup?.email) {
          openUsernameModal({
            email: pendingSignup.email,
            gName: pendingSignup.gName || "ゲスト",
          });
        }
      }
    } catch (error) {
      console.error("pending signup parse error:", error);
    }
  }

  // 初期状態: メニューを表示、タイトル画面を非表示
  if (gameMenu) gameMenu.style.display = 'flex';
  if (titleScreen) titleScreen.style.display = 'none';

  // ゲームカードのクリック処理
  gameCards.forEach(card => {
    card.addEventListener('click', () => {
      const gameType = card.dataset.game;

      // Coming Soonのカードはクリック不可
      if (card.classList.contains('coming-soon')) {
        return;
      }

      // ゲームに応じて遷移
      if (gameType === 'love-life') {
        if (gameMenu) gameMenu.style.display = 'none';
        if (titleScreen) {
          titleScreen.style.display = 'flex';
          titleScreen.style.flexDirection = 'column';
          titleScreen.style.justifyContent = 'center';
          titleScreen.style.alignItems = 'center';
        }
        showBackButton();
      } else if (gameType === 'literary-club') {
        if (!window.currentUser?.email) {
          alert("時々文芸部！はログインが必要です");
          return;
        }
        const literaryClubUrl = new URL('/時々文芸部！/', window.location.origin);
        window.location.href = literaryClubUrl.toString();
      } else if (gameType === 'judgement-ai') {
        if (!window.currentUser?.email) {
          alert("断罪AIはログインが必要です");
          return;
        }
        // gameMenu非表示、judgementAI表示
        if (gameMenu) gameMenu.style.display = 'none';
        const judgementAI = document.getElementById('judgementAI');
        if (judgementAI) judgementAI.style.display = 'block';
        showBackButton(); // 既存のBackボタン流用するなら
      } else if (gameType === 'game3') {
        // 新しいゲーム3の処理（今後実装）
        alert('Game 3 - 準備中');
      }
    });
  });

  // ホバーエフェクト
  gameCards.forEach(card => {
    if (!card.classList.contains('coming-soon')) {
      card.addEventListener('mouseenter', () => {
        card.style.borderColor = '#667eea';
      });
      card.addEventListener('mouseleave', () => {
        card.style.borderColor = 'transparent';
      });
    }
  });

  // ================================
  // Google ログインの初期化
  // ================================
  // 画面ロード時
  window.addEventListener("load", () => {
    if (!loginStatus || !btnContainer) return;
    if (!window.google || !google.accounts || !google.accounts.id) {
      console.warn("Google Identity Services がまだ読み込まれていません");
      return;
    }

    // ログイン成功時
    async function onLoginSuccess(credentialResponse) {
      const payload = parseJwt(credentialResponse.credential);
      if (!payload) {
        loginStatus.textContent = "ログインに失敗しました";
        return;
      }

      const email = payload.email; // キーとして使う
      const gName = payload.name || "ゲスト"; // Google 表示名

      if (!email) {
        loginStatus.textContent = "メールアドレスを取得できませんでした";
        return;
      }

      // サーバーに「この email のユーザーいる？」って聞く
      let lookup;
      try {
        const res = await fetch("/api/user/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        lookup = await res.json();
      } catch (e) {
        console.error("lookup error:", e);
        loginStatus.textContent = "ユーザー情報の取得に失敗しました";
        return;
      }

      // すでに存在する → その username でログイン完了
      if (lookup.exists && lookup.username) {
        window.currentUser = {
          email,
          username: lookup.username,
          googleName: lookup.displayName || gName,
        };
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        setAuthUiLoggedIn(lookup.username);
        if (signupModal) {
          signupModal.style.display = "none";
          signupModal.setAttribute("aria-hidden", "true");
        }
        return;
      }

      // 初回ログイン → ユーザーネーム設定モーダルを開く
      openUsernameModal({ email, gName });
    }

    // Google 初期化
    google.accounts.id.initialize({
      client_id: "958867607494-2htl5kj0atpuriq65ssnq7hje66t1p6t.apps.googleusercontent.com",
      callback: onLoginSuccess,
      ux_mode: "popup",
    });

    google.accounts.id.renderButton(btnContainer, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
    });

    if (googleSignUpBtn) {
      google.accounts.id.renderButton(googleSignUpBtn, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
      });
    }

    // ================================
    // ログアウトボタン
    // ================================
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        // まずアプリ内の状態をクリア
        const email = window.currentUser?.email || null;

        window.currentUser = null;
        localStorage.removeItem("currentUser");
        setAuthUiLoggedOut();

        /* Google 側との紐付きを解除（任意だが、やっとくと次回サインイン選択画面が出やすい）
        if (email && window.google && google.accounts && google.accounts.id) {
          google.accounts.id.revoke(email, done => {
            console.log("Google token revoked:", done);
          });
        }*/
      });
    }
  });

  //const playername = window.currentUser?.username || "プレイヤー";

  // ========================================
  // Backボタン & 戻る確認モーダル
  // ========================================

  const backBtn = document.getElementById('backBtn');
  const backModal = document.getElementById('backModal');
  const confirmBack = document.getElementById('confirmBack');
  const cancelBack = document.getElementById('cancelBack');

  // ゲーム開始時（タイトル画面に入ったらBack表示）
  function showBackButton() {
    if (backBtn) backBtn.style.display = 'block';
  }

  // メニューに戻る時（Back非表示）
  function hideBackButton() {
    if (backBtn) backBtn.style.display = 'none';
  }

  // Back押下 → 確認モーダル表示
  backBtn?.addEventListener('click', () => {
    if (backModal) backModal.style.display = 'flex';
  });

  // 戻らない
  cancelBack?.addEventListener('click', () => {
    backModal.style.display = 'none';
  });

  // 戻る（ゲームメニューへ）
  confirmBack?.addEventListener('click', () => {
    backModal.style.display = 'none';

    // 画面状態リセット
    location.reload();

    hideBackButton();
  });
});
