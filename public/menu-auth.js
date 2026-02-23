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

  function initFallingGameIcons() {
    if (!physicsLayer || !gameMenu) return;

    const MatterLib = window.Matter;
    if (!MatterLib) {
      console.warn('Matter.js not loaded. keep default cards.');
      return;
    }

    const { Engine, World, Bodies, Body, Composite, Events } = MatterLib;
    gameMenu.classList.add('physics-enabled');

    const engine = Engine.create({
      gravity: { x: 0, y: 1, scale: 0.0018 },
    });

    let width = physicsLayer.clientWidth;
    let height = physicsLayer.clientHeight;
    const wallThickness = 64;

    const walls = {
      ground: Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness * 2, wallThickness, {
        isStatic: true,
        restitution: 0.35,
      }),
      left: Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, { isStatic: true }),
      right: Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, { isStatic: true }),
    };
    World.add(engine.world, [walls.ground, walls.left, walls.right]);

    const iconDefs = [
      { gameType: 'literary-club', icon: '📚', label: '時々文芸部！', color: '#fff5e6' },
      { gameType: 'love-life', icon: '❤️', label: '恋愛人生ゲーム', color: '#ffe9f1' },
      { gameType: 'judgement-ai', icon: '⚖️', label: '断罪AI', color: '#eef2ff' },
    ];

    const iconBodies = [];
    const maxIcons = 18;

    const makeIconBody = (def) => {
      const size = Math.max(72, Math.min(94, Math.floor(width * 0.12)));
      const x = 60 + Math.random() * Math.max(80, width - 120);
      const y = -80;
      const body = Bodies.rectangle(x, y, size, size, {
        restitution: 0.58,
        friction: 0.14,
        frictionAir: 0.01,
        density: 0.0023,
        chamfer: { radius: 18 },
      });

      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'menu-physics-icon';
      node.style.background = def.color;
      node.setAttribute('aria-label', `${def.label}へ移動`);
      node.innerHTML = `<span class="menu-physics-emoji">${def.icon}</span><span class="menu-physics-label">${def.label}</span>`;
      node.addEventListener('click', (event) => {
        event.stopPropagation();
        startGameByType(def.gameType);
      });
      physicsLayer.appendChild(node);

      iconBodies.push({ body, node, size });
      World.add(engine.world, body);
    };

    const spawnInitial = () => {
      for (let i = 0; i < 5; i += 1) {
        makeIconBody(iconDefs[i % iconDefs.length]);
      }
    };

    const spawnTimer = window.setInterval(() => {
      if (iconBodies.length >= maxIcons) return;
      const def = iconDefs[Math.floor(Math.random() * iconDefs.length)];
      makeIconBody(def);
    }, 420);

    spawnInitial();

    const syncWalls = () => {
      width = physicsLayer.clientWidth;
      height = physicsLayer.clientHeight;
      const groundW = width + wallThickness * 2;
      Body.setPosition(walls.ground, { x: width / 2, y: height + wallThickness / 2 });
      Body.setVertices(walls.ground, Bodies.rectangle(width / 2, height + wallThickness / 2, groundW, wallThickness, { isStatic: true }).vertices);

      Body.setPosition(walls.left, { x: -wallThickness / 2, y: height / 2 });
      Body.setVertices(walls.left, Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, { isStatic: true }).vertices);

      Body.setPosition(walls.right, { x: width + wallThickness / 2, y: height / 2 });
      Body.setVertices(walls.right, Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, { isStatic: true }).vertices);
    };

    const resizeObserver = new ResizeObserver(syncWalls);
    resizeObserver.observe(physicsLayer);

    const clampPosition = () => {
      iconBodies.forEach(({ body }) => {
        if (body.position.y > height + 240) {
          Body.setPosition(body, {
            x: 60 + Math.random() * Math.max(80, width - 120),
            y: -120,
          });
          Body.setVelocity(body, { x: (Math.random() - 0.5) * 3, y: 0 });
          Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);
        }
      });
    };

    const tick = () => {
      Engine.update(engine, 1000 / 60);
      clampPosition();

      iconBodies.forEach(({ body, node, size }) => {
        node.style.transform = `translate3d(${body.position.x - size / 2}px, ${body.position.y - size / 2}px, 0) rotate(${body.angle}rad)`;
      });
      rafId = requestAnimationFrame(tick);
    };

    let rafId = requestAnimationFrame(tick);

    const onOrientation = (event) => {
      const gamma = Number.isFinite(event.gamma) ? event.gamma : 0;
      const beta = Number.isFinite(event.beta) ? event.beta : 55;
      engine.world.gravity.x = Math.max(-1, Math.min(1, gamma / 28));
      engine.world.gravity.y = Math.max(0.15, Math.min(1.2, beta / 55));
    };

    const enableOrientation = () => {
      window.addEventListener('deviceorientation', onOrientation);
      if (enableTiltBtn) {
        enableTiltBtn.textContent = '傾き操作: ON';
        enableTiltBtn.disabled = true;
      }
    };

    if (enableTiltBtn) {
      const askPermission = typeof DeviceOrientationEvent !== 'undefined'
        && typeof DeviceOrientationEvent.requestPermission === 'function';

      if (askPermission) {
        enableTiltBtn.style.display = 'inline-block';
        enableTiltBtn.addEventListener('click', async () => {
          try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission === 'granted') enableOrientation();
          } catch (error) {
            console.warn('DeviceOrientation permission denied', error);
          }
        });
      } else {
        enableTiltBtn.textContent = '傾き操作: 自動ON';
        enableOrientation();
      }
    }

    const cleanup = () => {
      window.clearInterval(spawnTimer);
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('deviceorientation', onOrientation);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    };

    window.addEventListener('beforeunload', cleanup, { once: true });
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
