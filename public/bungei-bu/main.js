import { getCharImg } from "../game-assets.js";

const startButton = document.querySelector("#startButton");
const introScreen = document.querySelector("#introScreen");
const playArea = document.querySelector("#playArea");
const dialogueName = document.querySelector("#dialogueName");
const dialogueLine = document.querySelector("#dialogueLine");
const characterImage = document.querySelector("#characterImage");
const choiceCardList = document.querySelector("#choiceCardList");
const inputPanel = document.querySelector("#inputPanel");
const playerInput = document.querySelector("#playerInput");
const sendButton = document.querySelector("#sendButton");
const dialogueBox = document.querySelector("#dialogueBox");
const hudTimer = document.querySelector(".hud__timer");
const modal = document.querySelector("#modal");
const modalText = document.querySelector("#modalText");
const modalFootnote = document.querySelector("#modalFootnote");
const playerLineHeader = document.querySelector("#playerLineHeader");

const dialogue = [
  {
    speaker: "ミユ",
    line: "ねえねえ、これ見てよ。この短編さ、最後の一文めっちゃ良くない？一気にゾワってきたんだけど！",
    mood: "positive",
  },
  {
    speaker: "シオン",
    line: "ちょっと、感想言う前にちゃんと読んでからにして。途中で読み飛ばしてるでしょ。",
    mood: "negative",
  },
  {
    speaker: "ナナ",
    line: "わたしは表紙の色が好き。夕方の空みたいで、きれい。",
    mood: "positive",
  },
  {
    speaker: "ミユ",
    line: "ナナの感想、相変わらず詩人じゃん。さすが文芸部。",
    mood: "positive",
  },
  {
    speaker: "シオン",
    line: "……その文芸部も、今日で終わりなんだけどね。",
    mood: "neutral",
  },
  {
    speaker: "ナナ",
    line: "終わりって、今日で放課後がなくなるってこと？",
    mood: "neutral",
  },
  {
    speaker: "シオン",
    line: "明日から夏休み。部室も使えなくなるし、こうして集まるのも今日が最後。",
    mood: "neutral",
  },
  {
    speaker: "ミユ",
    line: "え〜、なんかあっさりしてない？もっとこう、最終回感ほしくない？",
    mood: "negative",
  },
  {
    speaker: "シオン",
    line: "感傷に浸ってる余裕ないでしょ。下校時刻まで、あと2時間もないんだから。",
    mood: "negative",
  },
  {
    speaker: "ナナ",
    line: "120文字で、全部終わっちゃうんだ。",
    mood: "neutral",
  },
  {
    speaker: "ミユ",
    line: "うわ、数字で言われると急にリアル。え、じゃあ原稿の整理も、雑談も、全部その中でやる感じ？",
    mood: "neutral",
  },
  {
    speaker: "シオン",
    line: "そういうこと。だから、何するかちゃんと考えた方がいいと思う。",
    mood: "neutral",
  },
  {
    speaker: "ナナ",
    line: "最後の文芸部、どう過ごすかってことだね。",
    mood: "positive",
  },
  {
    speaker: "ミユ",
    line: "ね、せっかくならさ、やりたいことやろ？あとで後悔するの、やだし。",
    mood: "positive",
  },
  {
    speaker: "シオン",
    line: "……まあ、それは否定しないけど。",
    mood: "neutral",
  },
  {
    speaker: "ナナ",
    line: "じゃあ、最初はなにする？",
    mood: "positive",
  },
];

let dialogueIndex = -1;
let introActive = false;
let pendingAfterModal = null;
let choiceState = "hidden";
let sceneDialogue = [];
let sceneIndex = -1;
let sceneActive = false;
let waitingForResponse = false;
let currentSummary = null;
let relationship = [];
let affection = { ミユ: 20, シオン: 20, ナナ: 20 };
const storedUser = (() => {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch {
    return null;
  }
})();
const playerEmail = storedUser?.email || "";
let speechOrder = [];
let remainingChars = 120;

function setDialogue(index) {
  const entry = dialogue[index];
  if (!entry) return;
  dialogueIndex = index;
  showDialoguePresence();
  dialogueName.textContent = entry.speaker;
  dialogueLine.textContent = entry.line;
  characterImage.src = getCharImg(entry.speaker, entry.mood);
  characterImage.alt = `${entry.speaker}の立ち絵`;
}

function setSceneLine(index) {
  const entry = sceneDialogue[index];
  if (!entry) return;
  sceneIndex = index;
  showDialoguePresence();
  showDialogueBox();
  const mood = entry.mood || entry.expression || "neutral";
  dialogueName.textContent = entry.speaker;
  dialogueLine.textContent = entry.line;
  characterImage.src = getCharImg(entry.speaker, mood);
  characterImage.alt = `${entry.speaker}の立ち絵`;
}

function updateTimer(currentInputLength = 0) {
  if (!hudTimer) return;
  const remaining = Math.max(0, remainingChars - currentInputLength);
  hudTimer.textContent = `残り:${remaining}文字`;
}

function showModal(message, footnote = "") {
  modalText.textContent = message;
  modalFootnote.textContent = footnote;
  modal.classList.remove("is-hidden");
}

function hideModal() {
  modal.classList.add("is-hidden");
  if (typeof pendingAfterModal === "function") {
    const callback = pendingAfterModal;
    pendingAfterModal = null;
    callback();
  }
}

function showChoiceCards(cards) {
  if (!choiceCardList) return;
  choiceCardList.innerHTML = "";
  cards.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-card";
    button.textContent = card.text || "";
    if (card.isEmpty) {
      button.classList.add("is-empty");
      button.setAttribute("aria-label", "自由入力");
    }
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      card.onClick?.();
    });
    choiceCardList.appendChild(button);
  });
  choiceCardList.classList.remove("is-hidden");
  choiceCardList.hidden = false;
}

function hideChoiceCards() {
  if (!choiceCardList) return;
  choiceCardList.classList.add("is-hidden");
  choiceCardList.hidden = true;
  choiceCardList.innerHTML = "";
}

function showInputPanel() {
  inputPanel.classList.remove("is-hidden");
  inputPanel.hidden = false;
  playerInput.focus();
  showPlayerLineHeader();
  updateInputLimit();
}

function hideInputPanel() {
  inputPanel.classList.add("is-hidden");
  inputPanel.hidden = true;
  hidePlayerLineHeader();
}

function showDialogueBox() {
  dialogueBox.classList.remove("is-hidden");
  dialogueBox.hidden = false;
}

function hideDialogueBox() {
  dialogueBox.classList.add("is-hidden");
  dialogueBox.hidden = true;
}

function hideDialoguePresence() {
  characterImage.classList.add("is-hidden");
  characterImage.hidden = true;
  dialogueName.textContent = "";
  dialogueName.classList.add("is-hidden");
}

function showDialoguePresence() {
  characterImage.classList.remove("is-hidden");
  characterImage.hidden = false;
  dialogueName.classList.remove("is-hidden");
}

function showPlayerLineHeader() {
  if (!playerLineHeader) return;
  playerLineHeader.classList.remove("is-hidden");
}

function hidePlayerLineHeader() {
  if (!playerLineHeader) return;
  playerLineHeader.classList.add("is-hidden");
}

function updateInputLimit() {
  const remaining = Math.max(0, remainingChars);
  playerInput.maxLength = remaining;
  if (playerInput.value.length > remaining) {
    playerInput.value = playerInput.value.slice(0, remaining);
  }
  if (remaining <= 0) {
    playerInput.disabled = true;
    sendButton.disabled = true;
  } else {
    playerInput.disabled = false;
  }
  updateTimer(playerInput.value.length);
}

async function fetchPastLineOptions() {
  if (!playerEmail) return [];
  try {
    const res = await fetch("/api/bungei/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: playerEmail, speechOrder }),
    });
    if (!res.ok) throw new Error("options_failed");
    const data = await res.json();
    return Array.isArray(data.options) ? data.options : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function showInputChoices() {
  const options = await fetchPastLineOptions();
  const cards = options.map((line) => ({
    text: line,
    onClick: () => {
      playerInput.value = line;
      hideChoiceCards();
      showInputPanel();
      updateInputLimit();
      sendButton.disabled =
        waitingForResponse || playerInput.value.trim().length === 0 || remainingChars <= 0;
    },
  }));
  cards.push({
    text: "",
    isEmpty: true,
    onClick: () => {
      playerInput.value = "";
      hideChoiceCards();
      showInputPanel();
      updateInputLimit();
      sendButton.disabled =
        waitingForResponse || playerInput.value.trim().length === 0 || remainingChars <= 0;
    },
  });
  showChoiceCards(cards);
}

function showInviteChoice(text) {
  showChoiceCards([
    {
      text,
      onClick: () => {
        if (choiceState !== "invite") return;
        pendingAfterModal = () => {
          choiceState = "inputReady";
          showInputChoices();
        };
        showModal(
          "おっと、君は文芸部だ！台詞は君が考えな！\nただし、台詞によっては部活が終わっちまうから、そこはよーーく考えるんだな！",
          "…Monika.chrのバックアップを忘れずに。"
        );
      },
    },
  ]);
}

function startIntro() {
  introScreen.classList.add("is-hidden");
  introScreen.hidden = true;
  playArea.classList.remove("is-hidden");
  playArea.hidden = false;
  introActive = true;
  hideChoiceCards();
  hideInputPanel();
  showDialogueBox();
  setDialogue(0);
}

function advanceDialogue() {
  if (!introActive || !modal.classList.contains("is-hidden")) return;
  if (dialogueIndex < dialogue.length - 1) {
    setDialogue(dialogueIndex + 1);
    return;
  }
  introActive = false;
  pendingAfterModal = () => {
    choiceState = "invite";
    hideDialogueBox();
    hideDialoguePresence();
    showInviteChoice("じゃあさ、片付けでもしながら夏っぽいの詠まない？");
  };
  showModal(
    "あなたは文芸部の部員です！\n夏休みに入る前に彼女たちと仲良くなり、彼女を作りましょう！\n\n右上の残り文字数は、入力した内容によって変化していきます！"
  );
}

async function submitPlayerInput() {
  if (waitingForResponse) return;
  const input = playerInput.value.trim();
  if (!input) return;
  waitingForResponse = true;
  sendButton.disabled = true;
  sendButton.textContent = "送信中...";

  try {
    const response = await fetch("/api/bungei/scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        email: playerEmail,
        currentSummary,
        relationship,
        affection,
        speechOrder: [...speechOrder, input],
      }),
    });

    if (!response.ok) {
      throw new Error("gemini_failed");
    }

    const payload = await response.json();
    const data = payload?.data;
    if (!data || !Array.isArray(data.dialogue)) {
      throw new Error("invalid_response");
    }

    currentSummary = data.currentSummary ?? currentSummary;
    relationship = Array.isArray(data.relationship) ? data.relationship : relationship;
    if (data.affection && typeof data.affection === "object") {
      affection = { ...affection, ...data.affection };
    }

    speechOrder = [...speechOrder, input];
    remainingChars = Math.max(0, remainingChars - input.length);
    updateTimer();

    sceneDialogue = data.dialogue;
    sceneActive = sceneDialogue.length > 0;
    sceneIndex = -1;
    hideChoiceCards();
    hideInputPanel();
    playerInput.value = "";
    updateInputLimit();
    sendButton.textContent = "送信";
    if (sceneDialogue.length) {
      setSceneLine(0);
    } else {
      showInputChoices();
      choiceState = "inputReady";
    }
  } catch (error) {
    console.error(error);
    showModal("ごめんね、今は返答を作れなかったみたい。もう一度試してね。");
  } finally {
    waitingForResponse = false;
    sendButton.textContent = "送信";
    sendButton.disabled = playerInput.value.trim().length === 0 || remainingChars <= 0;
  }
}

if (startButton) {
  startButton.addEventListener("click", (event) => {
    event.stopPropagation();
    startIntro();
  });
}

if (modal) {
  modal.addEventListener("click", () => {
    hideModal();
  });
}

if (playerInput) {
  playerInput.addEventListener("input", () => {
    updateInputLimit();
    sendButton.disabled =
      waitingForResponse ||
      playerInput.value.trim().length === 0 ||
      remainingChars - playerInput.value.length < 0;
  });
}

if (sendButton) {
  sendButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (sendButton.disabled) return;
    submitPlayerInput();
  });
}

document.addEventListener("click", () => {
  if (!modal.classList.contains("is-hidden")) return;
  if (introActive) {
    advanceDialogue();
    return;
  }
  if (sceneActive) {
    if (sceneIndex < sceneDialogue.length - 1) {
      setSceneLine(sceneIndex + 1);
      return;
    }
    sceneActive = false;
    showInputChoices();
    choiceState = "inputReady";
  }
});

if (!playerEmail) {
  pendingAfterModal = () => {
    window.location.href = "/";
  };
  showModal("時々文芸部！はログインが必要です。\nトップページに戻ります。");
} else {
  updateTimer();
}
