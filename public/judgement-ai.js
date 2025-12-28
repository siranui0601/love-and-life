// public/judgement-ai.js

function mustLogin() {
  return window.currentUser ?.email && window.currentUser ?.username;
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data ?.error || `HTTP ${res.status}`);
  return data;
}

function setMembers(listEl, members, opts = {}) {
  const {
    hostName = null, showKick = false, onKick = null
  } = opts;
  if (!listEl) return;

  listEl.innerHTML = "";
  (members || []).forEach((name) => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.gap = "8px";

    const label = document.createElement("span");
    label.textContent = name + (hostName && name === hostName ? "（ホスト）" : "");
    li.appendChild(label);

    if (showKick && hostName && name !== hostName) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "キック";
      btn.addEventListener("click", () => onKick && onKick(name));
      li.appendChild(btn);
    }

    listEl.appendChild(li);
  });
}

function normalizeStatusText(status) {
  let t = String(status || "");

  // 旧表記 → 新表記へ寄せる
  t = t.replace("ランダム可", "ランダム対戦許可");
  t = t.replace("ランダム不可", "ランダム対戦不許可");

  // 先頭の「状態:」「状態;」が混ざっていても、表示は自然にする
  t = t.replace(/^状態[:;]\s*/g, "");
  return t;
}

document.addEventListener("DOMContentLoaded", () => {
  const socket = io(); // /socket.io/socket.io.js が読み込まれている前提
  // ---- Socket側に username を紐付け（ゲーム本編に必須）
  if (window.currentUser ?.username) {
    socket.emit("judgement:auth", {
      username: window.currentUser.username
    });
  }

  // ログイン後に window.currentUser が更新される設計なら、必要に応じて再送してもOK
  // window.addEventListener("user:login", () => socket.emit("judgement:auth", { username: window.currentUser.username }));


  socket.on("judgement:state", (state) => {
    // 今見ているroomIdのstateだけ反映（別ルームの通知事故を防ぐ）
    if (!currentRoomId) return;
    if (String(state.roomId) !== String(currentRoomId)) return;
    applyState(state);
  });

  socket.on("judgement:gameState", (st) => {
    if (!currentRoomId) return;
    if (String(st.roomId) !== String(currentRoomId)) return;
    gameState = st;
    renderGame(st);
  });

  socket.on("judgement:error", (e) => {
    const msg = e ?.message ? String(e.message) : "Unknown error";
    console.error("[judgement:error]", msg);
    alert(`エラー: ${msg}`);
  });



  const judgementAISection = document.getElementById("judgementAI");
  const judgementActions = judgementAISection ?.querySelector(".judgement-actions");

  const btnRandom = document.getElementById("btnRandomMatch");
  const btnRoomMatch = document.getElementById("btnRoomMatch");
  const btnRules = document.getElementById("btnJudgementRules");

  const roomMatchPanel = document.getElementById("roomMatchPanel");
  const btnCreate = document.getElementById("btnRoomCreate");
  const btnJoin = document.getElementById("btnRoomJoin");

  const roomCreatePanel = document.getElementById("roomCreatePanel");
  const chkAllowRandom = document.getElementById("chkAllowRandom");
  const btnCreateConfirm = document.getElementById("btnRoomCreateConfirm");
  const createdRoomInfo = document.getElementById("createdRoomInfo");

  const roomJoinPanel = document.getElementById("roomJoinPanel");
  const roomIdInput = document.getElementById("roomIdInput");
  const btnJoinConfirm = document.getElementById("btnRoomJoinConfirm");
  const joinRoomInfo = document.getElementById("joinRoomInfo");

  const waitingRoom = document.getElementById("waitingRoom");
  const waitingRoomId = document.getElementById("waitingRoomId");
  const waitingStatusText = document.getElementById("waitingStatusText");

  const btnPlayWithMembers = document.getElementById("btnPlayWithMembers");

  const nonHostLockedPanel = document.getElementById("nonHostLockedPanel");
  const waitingMembersLocked = document.getElementById("waitingMembersLocked");

  const hostConfigPanel = document.getElementById("hostConfigPanel");
  const memberCountText = document.getElementById("memberCountText");
  const aiCountInput = document.getElementById("aiCountInput"); // range
  const aiCountValue = document.getElementById("aiCountValue");
  const aiHintText = document.getElementById("aiHintText");

  const btnFinalStart = document.getElementById("btnFinalStart");
  const btnToggleRecruit = document.getElementById("btnToggleRecruit");

  const waitingMembersPanel = document.getElementById("waitingMembersPanel");
  const waitingMembers = document.getElementById("waitingMembers");

  const btnBackToMenu = document.getElementById("btnBackToMenu");




  // ---- Game UI (最小)
  const gamePanel = document.getElementById("gamePanel");
  const gameTopic = document.getElementById("gameTopic");
  const gameMeta = document.getElementById("gameMeta");
  const gameTimer = document.getElementById("gameTimer");
  const gameArea = document.getElementById("gameArea");

  const answerPanel = document.getElementById("answerPanel");
  const answerInput = document.getElementById("answerInput");
  const btnSubmitAnswer = document.getElementById("btnSubmitAnswer");
  const answerCharCount = document.getElementById("answerCharCount");

  const judgePanel = document.getElementById("judgePanel");
  const picksRequiredEl = document.getElementById("picksRequired");
  const btnConfirmJudgement = document.getElementById("btnConfirmJudgement");

  const resultPanel = document.getElementById("resultPanel");
  const btnReadyNext = document.getElementById("btnReadyNext");
  const resultCountdown = document.getElementById("resultCountdown");

  // ---- game state
  let gameState = null; // 最新の publicGameView
  let selectedSlotIds = new Set(); // 狩人が選ぶカード
  let localTimerTick = null; // 表示用カウントダウン



  // ---- state
  let currentRoomId = null;
  let currentHost = "";
  let currentMembers = [];
  let lastMembers = [];
  //let pollingTimer = null;
  let joinedOnce = false;

  function isHost() {
    return mustLogin() && window.currentUser.username === currentHost;
  }

  function stopPolling() {
    //巨悪の根源
  }


  function openGamePanel() {
    if (gamePanel) gamePanel.style.display = "block";
    // 待機ルームUIは残しても良いが、動作確認では分離した方が見やすい
    // if (waitingRoom) waitingRoom.style.display = "none";
  }

  function stopLocalTimer() {
    if (localTimerTick) clearInterval(localTimerTick);
    localTimerTick = null;
  }

  function startLocalTimer() {
    stopLocalTimer();
    localTimerTick = setInterval(() => {
      if (!gameState) return;
      renderTopBar(gameState); // 秒数だけ更新したい
      renderResultCountdown(gameState);
    }, 250);
  }

  function me() {
    return window.currentUser ?.username || "";
  }

  function isHunter(st) {
    return st ?.hunter && st.hunter === me();
  }

  function renderTopBar(st) {
    if (gameTopic) gameTopic.textContent = st.topic ? `【お題】${st.topic}` : "";
    if (gameMeta) {
      const total = st.cards ?.length || 0;
      const req = st.picksRequired ?? "-";
      gameMeta.textContent =
        `フェーズ: ${st.phase} / ラウンド: ${st.roundIndex} / 狩人: ${st.hunter} / 人数: ${total}（断罪必要数: ${req}）`;
    }

    // deadline表示
    const now = Date.now();
    let line = "";
    if (st.phase === "ANSWER" && st.answerDeadlineAt) {
      const sec = Math.max(0, Math.ceil((st.answerDeadlineAt - now) / 1000));
      line = `回答締切まで: ${sec}s`;
    } else if (st.phase === "RESULT" && st.resultDeadlineAt) {
      const sec = Math.max(0, Math.ceil((st.resultDeadlineAt - now) / 1000));
      line = `次ラウンドまで: ${sec}s（全員準備OKでも即開始）`;
    } else {
      line = "";
    }
    if (gameTimer) gameTimer.textContent = line;
  }

  function renderCards(st) {
    if (!gameArea) return;
    const cards = Array.isArray(st.cards) ? st.cards : [];
    gameArea.innerHTML = "";

    // クリック選択は狩人のJUDGEフェーズのみ
    const selectable = st.phase === "JUDGE" && isHunter(st);

    const wrap = document.createElement("div");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
    wrap.style.gap = "10px";

    cards.forEach((c) => {
      const card = document.createElement("div");
      card.style.border = "1px solid #555";
      card.style.borderRadius = "10px";
      card.style.padding = "10px";
      card.style.cursor = selectable ? "pointer" : "default";
      card.dataset.slotId = c.slotId;

      const img = document.createElement("img");
      img.src = c.avatar;
      img.alt = "avatar";
      img.style.width = "100%";
      img.style.borderRadius = "10px";
      card.appendChild(img);

      const bubble = document.createElement("div");
      bubble.style.marginTop = "8px";
      bubble.style.padding = "8px";
      bubble.style.border = "1px solid #444";
      bubble.style.borderRadius = "10px";
      bubble.textContent = c.answer || "(未回答)";
      card.appendChild(bubble);

      const name = document.createElement("div");
      name.style.marginTop = "8px";
      name.style.textAlign = "center";
      name.style.opacity = "0.85";
      name.textContent = c.name || "???";
      card.appendChild(name);

      // 既に選んでいるなら強調
      if (selectedSlotIds.has(c.slotId)) {
        card.style.outline = "3px solid #aaa";
      }

      if (selectable) {
        card.addEventListener("click", () => {
          const need = Number(st.picksRequired || 0);
          if (selectedSlotIds.has(c.slotId)) {
            selectedSlotIds.delete(c.slotId);
          } else {
            // 最大数まで
            if (selectedSlotIds.size >= need) return;
            selectedSlotIds.add(c.slotId);
          }
          renderCards(st);
          renderJudgePanel(st);
        });
      }

      wrap.appendChild(card);
    });

    gameArea.appendChild(wrap);
  }

  function renderAnswerPanel(st) {
    if (!answerPanel) return;
    const show = st.phase === "ANSWER" && !isHunter(st);
    answerPanel.style.display = show ? "block" : "none";
    if (!show) return;

    // 文字数表示
    const t = String(answerInput ?.value || "");
    if (answerCharCount) answerCharCount.textContent = `${t.length}/120`;
  }

  function renderJudgePanel(st) {
    if (!judgePanel) return;
    const show = st.phase === "JUDGE" && isHunter(st);
    judgePanel.style.display = show ? "block" : "none";
    if (!show) return;

    if (picksRequiredEl) picksRequiredEl.textContent = String(st.picksRequired ?? "");
    const need = Number(st.picksRequired || 0);

    if (btnConfirmJudgement) {
      btnConfirmJudgement.disabled = (selectedSlotIds.size !== need);
      btnConfirmJudgement.textContent =
        selectedSlotIds.size === need ? "断罪を確定" : `断罪を確定（${selectedSlotIds.size}/${need}）`;
    }
  }

  function renderResultPanel(st) {
    if (!resultPanel) return;
    const show = st.phase === "RESULT";
    resultPanel.style.display = show ? "block" : "none";
    if (!show) return;
    renderResultCountdown(st);
  }

  function renderResultCountdown(st) {
    if (!resultCountdown) return;
    if (st.phase !== "RESULT" || !st.resultDeadlineAt) {
      resultCountdown.textContent = "";
      return;
    }
    const now = Date.now();
    const sec = Math.max(0, Math.ceil((st.resultDeadlineAt - now) / 1000));
    resultCountdown.textContent = `自動で次ラウンド: ${sec}s`;
  }

  function renderGame(st) {
    openGamePanel();
    renderTopBar(st);

    // phaseが変わったら狩人選択をリセットしたい（JUDGE入り時）
    if (st.phase !== "JUDGE") {
      selectedSlotIds.clear();
    }

    renderCards(st);
    renderAnswerPanel(st);
    renderJudgePanel(st);
    renderResultPanel(st);

    // ゲーム終了時ランキングを表示（最小）
    if (st.phase === "GAME_OVER" && Array.isArray(st.ranking)) {
      alert(
        "ゲーム終了\n" +
        st.ranking
        .map((r, i) => `${i + 1}位 ${r.name} : ${r.points}点（AI誤断罪 ${r.aiFalsePositives}）`)
        .join("\n")
      );
    }

    startLocalTimer();
  }


  answerInput ?.addEventListener("input", () => {
    const t = String(answerInput.value || "");
    if (answerCharCount) answerCharCount.textContent = `${t.length}/120`;
  });

  btnSubmitAnswer ?.addEventListener("click", () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      if (!currentRoomId) return;
      if (!gameState || gameState.phase !== "ANSWER") return alert("回答フェーズではありません");

      const text = String(answerInput ?.value || "").trim();
      if (!text) return alert("回答が空です");
      if (text.length > 120) return alert("120文字以内にしてください");

      socket.emit("judgement:submitAnswer", {
        roomId: currentRoomId,
        text
      });
    } catch (e) {
      alert(e.message);
    }
  });

  btnConfirmJudgement ?.addEventListener("click", () => {
    if (!mustLogin()) return alert("ログインが必要です");
    if (!currentRoomId) return;
    if (!gameState || gameState.phase !== "JUDGE") return alert("断罪フェーズではありません");
    if (!isHost() && gameState.hunter !== me()) {
      // hostかどうかではなく、狩人だけが押せるべき
    }
    const need = Number(gameState.picksRequired || 0);
    if (selectedSlotIds.size !== need) return alert(`選択数が不足しています（${need}件）`);

    socket.emit("judgement:judgePick", {
      roomId: currentRoomId,
      pickedSlotIds: Array.from(selectedSlotIds),
    });
  });

  btnReadyNext ?.addEventListener("click", () => {
    if (!mustLogin()) return alert("ログインが必要です");
    if (!currentRoomId) return;
    if (!gameState || gameState.phase !== "RESULT") return alert("結果表示中ではありません");
    socket.emit("judgement:resultReady", {
      roomId: currentRoomId
    });
  });

















  function showTop() {
    // 先にunwatch（currentRoomIdをnullにする前）
    if (currentRoomId) socket.emit("judgement:unwatch", {
      roomId: currentRoomId
    });

    //stopPolling();
    currentRoomId = null;
    currentHost = "";
    currentMembers = [];
    lastMembers = [];
    joinedOnce = false;

    // waiting を閉じて、トップUIを開く
    if (waitingRoom) waitingRoom.style.display = "none";
    if (roomMatchPanel) roomMatchPanel.style.display = "none";
    if (roomCreatePanel) roomCreatePanel.style.display = "none";
    if (roomJoinPanel) roomJoinPanel.style.display = "none";
    if (createdRoomInfo) createdRoomInfo.textContent = "";
    if (joinRoomInfo) joinRoomInfo.textContent = "";

    if (nonHostLockedPanel) nonHostLockedPanel.style.display = "none";
    if (hostConfigPanel) hostConfigPanel.style.display = "none";
    if (waitingMembersPanel) waitingMembersPanel.style.display = "block";

    if (judgementActions) judgementActions.style.display = "flex";
  }


  function openWaiting(roomId) {
    currentRoomId = roomId;
    joinedOnce = true;

    if (waitingRoom) waitingRoom.style.display = "block";
    if (roomMatchPanel) roomMatchPanel.style.display = "none";
    if (roomCreatePanel) roomCreatePanel.style.display = "none";
    if (roomJoinPanel) roomJoinPanel.style.display = "none";
    if (createdRoomInfo) createdRoomInfo.textContent = "";
    if (joinRoomInfo) joinRoomInfo.textContent = "";

    // 待機に入ったら「ランダム/ルーム対戦」などのトップ操作群は隠す
    if (judgementActions) judgementActions.style.display = "none";

    if (waitingRoomId) waitingRoomId.textContent = roomId;

    // 初期は通常待機表示
    if (nonHostLockedPanel) nonHostLockedPanel.style.display = "none";
    if (hostConfigPanel) hostConfigPanel.style.display = "none";
    if (waitingMembersPanel) waitingMembersPanel.style.display = "block";

    socket.emit("judgement:watch", {
      roomId
    });

  }

  function updateAIHints(membersCount) {
    const count = Number(membersCount || 0);
    const min = 1;
    const max = Math.max(1, count * 3);
    const rec = Math.max(1, count * 2);

    if (aiCountInput) {
      aiCountInput.min = String(min);
      aiCountInput.max = String(max);

      const v = Number(aiCountInput.value || 0);
      if (!Number.isFinite(v) || v < min) aiCountInput.value = String(rec);
      if (v > max) aiCountInput.value = String(max);
    }

    if (aiCountValue && aiCountInput) aiCountValue.textContent = String(aiCountInput.value);

    if (aiHintText) {
      aiHintText.textContent = `設定可能: ${min}〜${max}（おすすめ: ${rec}）`;
    }
  }

  function applyState(state) {
    // state: { roomId, status, hostName, members, aiCount, kicked? }
    currentHost = String(state.hostName || "");
    currentMembers = Array.isArray(state.members) ? state.members : [];

    // ---- キック検知（kicked配列が無くても動く）
    const me = window.currentUser ?.username;
    const iWasIn = lastMembers.includes(me);
    const iAmIn = currentMembers.includes(me);

    if (joinedOnce && me && iWasIn && !iAmIn) {
      alert("このルームからキックされました。");
      showTop();
      return;
    }

    // kicked配列がある場合はそれも優先
    const kicked = Array.isArray(state.kicked) ? state.kicked : null;
    if (joinedOnce && me && kicked && kicked.includes(me)) {
      alert("このルームからキックされました。");
      showTop();
      return;
    }

    lastMembers = currentMembers.slice();

    // ステータス表示
    if (waitingStatusText) waitingStatusText.textContent = normalizeStatusText(state.status);

    // 「このメンバーで遊ぶ！」はホストのみ表示
    const locked = String(state.status || "").includes("/募集停止");
    if (btnPlayWithMembers) {
      btnPlayWithMembers.style.display = isHost() && !locked ? "inline-block" : "none";
    }

    // 参加者リスト（通常）
    setMembers(waitingMembers, currentMembers, {
      hostName: currentHost,
      showKick: isHost() && !locked, // 締切後はキックUIを消す（必要なら true に変更可）
      onKick: async (targetName) => {
        try {
          await postJSON("/api/judgement/room/kick", {
            roomId: currentRoomId,
            hostName: window.currentUser.username,
            targetName,
          });
          // 次回pollで反映
        } catch (e) {
          alert(`キックに失敗: ${e.message}`);
        }
      },
    });

    // 締切後の表示切替
    if (locked) {
      if (isHost()) {
        if (nonHostLockedPanel) nonHostLockedPanel.style.display = "none";
        if (hostConfigPanel) hostConfigPanel.style.display = "block";
        if (waitingMembersPanel) waitingMembersPanel.style.display = "none";

        if (memberCountText) memberCountText.textContent = `参加人数: ${currentMembers.length}人`;
        updateAIHints(currentMembers.length);
      } else {
        if (hostConfigPanel) hostConfigPanel.style.display = "none";
        if (nonHostLockedPanel) nonHostLockedPanel.style.display = "block";
        if (waitingMembersPanel) waitingMembersPanel.style.display = "none";

        setMembers(waitingMembersLocked, currentMembers, {
          hostName: currentHost
        });
      }
    } else {
      if (nonHostLockedPanel) nonHostLockedPanel.style.display = "none";
      if (hostConfigPanel) hostConfigPanel.style.display = "none";
      if (waitingMembersPanel) waitingMembersPanel.style.display = "block";
    }
  }

  // ---- UI events
  btnRoomMatch ?.addEventListener("click", () => {
    if (!mustLogin()) return alert("ログインが必要です");
    roomMatchPanel.style.display = roomMatchPanel.style.display === "none" ? "block" : "none";
  });

  btnCreate ?.addEventListener("click", () => {
    roomCreatePanel.style.display = "block";
    roomJoinPanel.style.display = "none";
  });

  btnJoin ?.addEventListener("click", () => {
    roomJoinPanel.style.display = "block";
    roomCreatePanel.style.display = "none";
  });

  btnCreateConfirm ?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");

      const hostName = window.currentUser.username;
      const allowRandom = !!chkAllowRandom ?.checked;

      const data = await postJSON("/api/judgement/room/create", {
        allowRandom,
        hostName
      });
      createdRoomInfo.textContent = `作成しました：ルームID ${data.roomId}`;

      // 冪等 join（members一覧取得目的）
      await postJSON("/api/judgement/room/join", {
        roomId: data.roomId,
        username: hostName
      });

      openWaiting(data.roomId);
    } catch (e) {
      console.error(e);
      alert(`作成に失敗: ${e.message}`);
    }
  });

  btnJoinConfirm ?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");

      const roomId = (roomIdInput ?.value || "").trim();
      if (!/^\d{4}$/.test(roomId)) return alert("4桁の数字を入力してください");

      const username = window.currentUser.username;
      await postJSON("/api/judgement/room/join", {
        roomId,
        username
      });

      openWaiting(roomId);
    } catch (e) {
      console.error(e);
      if (String(e.message).includes("kicked")) {
        alert("このルームには入れません（キック済み）");
        showTop();
        return;
      }
      alert(`入室に失敗: ${e.message}`);
    }
  });

  btnRandom ?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");

      const username = window.currentUser.username;

      const data = await postJSON("/api/judgement/room/randomJoin", {
        username
      });
      await postJSON("/api/judgement/room/join", {
        roomId: data.roomId,
        username
      });

      openWaiting(data.roomId);
    } catch (e) {
      console.error(e);
      alert(`ランダム対戦が見つかりません: ${e.message}`);
    }
  });

  btnRules ?.addEventListener("click", () => {
    alert(
      `【断罪AI ルール概要】
・1人が断罪狩人、他がレジスタント
・全員がお題に対して「AIっぽく」回答
・さらにAI回答も混ざる
・断罪狩人は人間回答を見抜いて選ぶ
・狩人は的中数だけ得点、レジスタントは見抜かれなければ1点`
    );
  });

  // ---- 「このメンバーで遊ぶ！」（ホストのみ）
  btnPlayWithMembers ?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      if (!currentRoomId) return;
      if (!isHost()) return; // 非ホストはそもそも非表示だが念のため

      await postJSON("/api/judgement/room/lockForStart", {
        roomId: currentRoomId,
        hostName: window.currentUser.username,
      });
    } catch (e) {
      console.error(e);
      alert(`締切に失敗: ${e.message}`);
    }
  });

  // ---- スライダー値表示
  aiCountInput ?.addEventListener("input", () => {
    if (aiCountValue) aiCountValue.textContent = String(aiCountInput.value);
  });

  // ---- ゲーム開始（最終：ここでAI数をSheetへ）
  btnFinalStart ?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      if (!currentRoomId) return;
      if (!isHost()) return alert("ホストのみ操作できます");

      const n = Number(aiCountInput ?.value || 0);
      if (!Number.isInteger(n) || n < 1) return alert("AIの数が不正です");

      // Socketでゲーム開始（E列へAI数、G列にgameJson初期化、即ラウンド開始）
      socket.emit("judgement:gameStart", {
        roomId: currentRoomId,
        aiCount: n
      });
      alert("ゲーム開始命令を送信しました（Socket）");

    } catch (e) {
      console.error(e);
      alert(`開始に失敗: ${e.message}`);
    }
  });

  // ---- 募集再開（締切解除）
  btnToggleRecruit ?.addEventListener("click", async () => {
    try {
      if (!mustLogin()) return alert("ログインが必要です");
      if (!currentRoomId) return;
      if (!isHost()) return alert("ホストのみ操作できます");

      // サーバの toggleRecruit 実装が「トグル」ならこれでOK
      await postJSON("/api/judgement/room/toggleRecruit", {
        roomId: currentRoomId,
        hostName: window.currentUser.username,
      });
    } catch (e) {
      console.error(e);
      alert(`募集再開に失敗: ${e.message}`);
    }
  });

  // ---- 断罪AIトップに戻る
  btnBackToMenu ?.addEventListener("click", () => {
    showTop();
  });

  // 初期状態を整える（断罪AIを開いた時にトップ想定）
  showTop();
});
