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
  const gameCards = document.querySelectorAll('.game-card');

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
        window.location.href = 'https://siranui.jp/文芸部！/';
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
    const loginStatus = document.getElementById("loginStatus");
    const btnContainer = document.getElementById("googleSignInBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    const usernameModal = document.getElementById("usernameModal");
    const usernameInput = document.getElementById("usernameInput");
    const usernameSaveBtn = document.getElementById("usernameSaveBtn");

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
        loginStatus.textContent = `${lookup.username} でログイン中`;
        btnContainer.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "inline-block";
        return;
      }

      // 初回ログイン → ユーザーネーム設定モーダルを開く
      if (usernameModal && usernameInput && usernameSaveBtn) {
        usernameInput.value = gName; // デフォルトは Google の名前
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

            loginStatus.textContent = `${data.username} でログイン中`;
            btnContainer.style.display = "none";
            if (logoutBtn) logoutBtn.style.display = "inline-block";
            usernameModal.style.display = "none";
          } catch (e) {
            console.error("register error:", e);
            alert("ユーザーネームの登録に失敗しました");
          }
        };
      }
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

    // ================================
    // ログアウトボタン
    // ================================
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        // まずアプリ内の状態をクリア
        const email = window.currentUser?.email || null;

        window.currentUser = null;
        loginStatus.textContent = "ログインしていません";
        btnContainer.style.display = "block"; // ログインボタン再表示
        logoutBtn.style.display = "none"; // ログアウトボタン非表示

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
