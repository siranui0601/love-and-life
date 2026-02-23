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
  const openSettingsBtn = document.getElementById("openSettingsBtn");
  const loginModal = document.getElementById("loginModal");
  const closeLoginBtn = document.getElementById("closeLoginBtn");
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
  const settingsModal = document.getElementById("settingsModal");
  const settingsUsernameInput = document.getElementById("settingsUsernameInput");
  const settingsMessage = document.getElementById("settingsMessage");
  const settingsSaveBtn = document.getElementById("settingsSaveBtn");
  const settingsLogoutBtn = document.getElementById("settingsLogoutBtn");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const enableTiltBtn = document.getElementById("enableTiltBtn");
  const physicsLayer = document.getElementById("menuPhysicsLayer");
  const pendingSignupKey = "pendingGoogleSignup";

  function openLoginModal() {
    if (!loginModal) return;
    loginModal.style.display = "flex";
    loginModal.setAttribute("aria-hidden", "false");
  }

  function closeLoginModal() {
    if (!loginModal) return;
    loginModal.style.display = "none";
    loginModal.setAttribute("aria-hidden", "true");
  }

  function setAuthUiLoggedIn(username) {
    if (loginStatus && username) {
      loginStatus.textContent = `${username} でログイン中`;
    }
    if (btnContainer) btnContainer.style.display = "none";
    if (loginForm) loginForm.style.display = "none";
    if (openSignupBtn) openSignupBtn.style.display = "none";
    if (openLoginBtn) openLoginBtn.style.display = "none";
    if (openSettingsBtn) openSettingsBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
  }

  function setAuthUiLoggedOut() {
    if (loginStatus) loginStatus.textContent = "ログインしていません";
    if (btnContainer) btnContainer.style.display = "block";
    if (loginForm) loginForm.style.display = "grid";
    if (openSignupBtn) openSignupBtn.style.display = "inline-block";
    if (openLoginBtn) openLoginBtn.style.display = "inline-block";
    if (openSettingsBtn) openSettingsBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
  }

  function closeSettingsModal() {
    if (!settingsModal) return;
    settingsModal.style.display = "none";
    settingsModal.setAttribute("aria-hidden", "true");
    if (settingsMessage) settingsMessage.textContent = "";
  }

  function logoutCurrentUser() {
    window.currentUser = null;
    localStorage.removeItem("currentUser");
    setAuthUiLoggedOut();
    closeSettingsModal();
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
      openLoginModal();
      if (signupModal) {
        signupModal.style.display = "none";
        signupModal.setAttribute("aria-hidden", "true");
      }
    });
  }

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener("click", () => {
      if (!window.currentUser?.username || !settingsModal) return;
      if (settingsUsernameInput) settingsUsernameInput.value = window.currentUser.username;
      if (settingsMessage) settingsMessage.textContent = "";
      settingsModal.style.display = "flex";
      settingsModal.setAttribute("aria-hidden", "false");
    });
  }

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener("click", closeSettingsModal);
  }

  if (settingsModal) {
    settingsModal.addEventListener("click", (event) => {
      if (event.target === settingsModal) {
        closeSettingsModal();
      }
    });
  }

  if (settingsSaveBtn) {
    settingsSaveBtn.addEventListener("click", async () => {
      const nextUsername = settingsUsernameInput?.value.trim() || "";
      if (!nextUsername) {
        if (settingsMessage) settingsMessage.textContent = "ユーザーネームを入力してください";
        return;
      }
      if (!window.currentUser?.username) return;
      if (nextUsername === window.currentUser.username) {
        if (settingsMessage) settingsMessage.textContent = "";
        closeSettingsModal();
        return;
      }

      try {
        const res = await fetch("/api/user/update-username", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: window.currentUser.email,
            currentUsername: window.currentUser.username,
            nextUsername,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          if (settingsMessage) settingsMessage.textContent = data.error || "ユーザーネームの変更に失敗しました";
          return;
        }

        window.currentUser.username = data.username;
        if (window.currentUser.email === data.previousUsername) {
          window.currentUser.email = data.username;
        }
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        setAuthUiLoggedIn(data.username);
        closeSettingsModal();
      } catch (error) {
        console.error("update username error:", error);
        if (settingsMessage) settingsMessage.textContent = "ユーザーネームの変更に失敗しました";
      }
    });
  }

  if (settingsLogoutBtn) {
    settingsLogoutBtn.addEventListener("click", logoutCurrentUser);
  }

  if (closeLoginBtn) {
    closeLoginBtn.addEventListener("click", () => {
      closeLoginModal();
    });
  }

  if (loginModal) {
    loginModal.addEventListener("click", (event) => {
      if (event.target === loginModal) {
        closeLoginModal();
      }
    });
  }

  function openSignupModal() {
    closeLoginModal();
    if (!signupModal) {
      console.warn("signupModal が見つからないため新規登録モーダルを表示できません");
      return;
    }

    signupModal.style.display = "flex";
    signupModal.setAttribute("aria-hidden", "false");
    if (signupUsername) {
      requestAnimationFrame(() => signupUsername.focus());
    }
  }

  if (openSignupBtn) {
    openSignupBtn.addEventListener("click", (event) => {
      event.preventDefault();
      openSignupModal();
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
        closeLoginModal();
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
        closeLoginModal();
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

  function startGameByType(gameType) {
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
      if (gameMenu) gameMenu.style.display = 'none';
      const judgementAI = document.getElementById('judgementAI');
      if (judgementAI) judgementAI.style.display = 'block';
      showBackButton();
    } else if (gameType === 'game3') {
      alert('Game 3 - 準備中');
    }
  }

  // ゲームカードのクリック処理
  gameCards.forEach(card => {
    card.addEventListener('click', () => {
      const gameType = card.dataset.game;
      if (card.classList.contains('coming-soon')) {
        return;
      }
      startGameByType(gameType);
    });
  });

  async function initFallingGameIcons() {
    if (!physicsLayer || !gameMenu) return;

    try {
      const Matter = await import('https://esm.sh/matter-js@0.20.0');
      const { Engine, Runner, World, Bodies, Body, Composite } = Matter;

      gameMenu.classList.add('physics-enabled');

      const engine = Engine.create();
      engine.world.gravity.y = 1;
      const runner = Runner.create();
      Runner.run(runner, engine);

      let width = physicsLayer.clientWidth;
      let height = physicsLayer.clientHeight;

      const walls = {
        ground: Bodies.rectangle(width / 2, height + 24, width + 80, 48, { isStatic: true }),
        left: Bodies.rectangle(-24, height / 2, 48, height + 100, { isStatic: true }),
        right: Bodies.rectangle(width + 24, height / 2, 48, height + 100, { isStatic: true }),
      };
      World.add(engine.world, [walls.ground, walls.left, walls.right]);

      const iconDefs = [
        { gameType: 'literary-club', icon: '📚', label: '時々文芸部！' },
        { gameType: 'love-life', icon: '❤️', label: '恋愛人生ゲーム' },
        { gameType: 'judgement-ai', icon: '⚖️', label: '断罪AI' },
      ];

      const iconBodies = [];
      const totalIcons = 11;
      for (let i = 0; i < totalIcons; i += 1) {
        const def = iconDefs[i % iconDefs.length];
        const size = window.innerWidth < 768 ? 72 : 84;
        const x = 40 + Math.random() * Math.max(80, width - 80);
        const y = -90 - Math.random() * 360;

        const body = Bodies.rectangle(x, y, size, size, {
          restitution: 0.45,
          friction: 0.06,
          frictionAir: 0.012,
          density: 0.0028,
          chamfer: { radius: 16 },
        });

        const node = document.createElement('button');
        node.type = 'button';
        node.className = 'menu-physics-icon';
        node.setAttribute('aria-label', `${def.label}へ移動`);
        node.textContent = def.icon;
        node.addEventListener('click', (event) => {
          event.stopPropagation();
          startGameByType(def.gameType);
        });
        physicsLayer.appendChild(node);

        iconBodies.push({ body, node, size });
        World.add(engine.world, body);
      }

      const syncWalls = () => {
        width = physicsLayer.clientWidth;
        height = physicsLayer.clientHeight;
        Body.setPosition(walls.ground, { x: width / 2, y: height + 24 });
        Body.setVertices(walls.ground, Bodies.rectangle(width / 2, height + 24, width + 80, 48, { isStatic: true }).vertices);

        Body.setPosition(walls.left, { x: -24, y: height / 2 });
        Body.setVertices(walls.left, Bodies.rectangle(-24, height / 2, 48, height + 100, { isStatic: true }).vertices);

        Body.setPosition(walls.right, { x: width + 24, y: height / 2 });
        Body.setVertices(walls.right, Bodies.rectangle(width + 24, height / 2, 48, height + 100, { isStatic: true }).vertices);
      };

      const resizeObserver = new ResizeObserver(syncWalls);
      resizeObserver.observe(physicsLayer);

      const updateDom = () => {
        iconBodies.forEach(({ body, node, size }) => {
          node.style.transform = `translate(${body.position.x - size / 2}px, ${body.position.y - size / 2}px) rotate(${body.angle}rad)`;
        });
        requestAnimationFrame(updateDom);
      };
      requestAnimationFrame(updateDom);

      const onOrientation = (event) => {
        const gamma = Number.isFinite(event.gamma) ? event.gamma : 0;
        const beta = Number.isFinite(event.beta) ? event.beta : 55;
        engine.world.gravity.x = Math.max(-1, Math.min(1, gamma / 35));
        engine.world.gravity.y = Math.max(0.2, Math.min(1.2, beta / 70));
      };

      if (enableTiltBtn) {
        const askPermission = typeof DeviceOrientationEvent !== 'undefined'
          && typeof DeviceOrientationEvent.requestPermission === 'function';

        if (askPermission) {
          enableTiltBtn.style.display = 'inline-block';
          enableTiltBtn.addEventListener('click', async () => {
            try {
              const permission = await DeviceOrientationEvent.requestPermission();
              if (permission === 'granted') {
                window.addEventListener('deviceorientation', onOrientation);
                enableTiltBtn.textContent = '傾き操作: ON';
                enableTiltBtn.disabled = true;
              }
            } catch (error) {
              console.warn('DeviceOrientation permission denied', error);
            }
          });
        } else {
          enableTiltBtn.textContent = '傾き操作: 自動ON';
          enableTiltBtn.disabled = true;
          window.addEventListener('deviceorientation', onOrientation);
        }
      }

      window.addEventListener('beforeunload', () => {
        resizeObserver.disconnect();
        Runner.stop(runner);
        Composite.clear(engine.world, false);
        Engine.clear(engine);
      });
    } catch (error) {
      console.warn('Matter.js physics icon init failed:', error);
      gameMenu.classList.remove('physics-enabled');
    }
  }

  initFallingGameIcons();

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

        logoutCurrentUser();

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
