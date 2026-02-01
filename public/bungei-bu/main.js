import { getCharImg } from "../game-assets.js";

const startButton = document.querySelector("#startButton");
const introScreen = document.querySelector("#introScreen");
const playArea = document.querySelector("#playArea");
const scene = document.querySelector("#scene");
const curtain = document.querySelector("#curtain");
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
const resultScreen = document.querySelector("#resultScreen");
const resultRank = document.querySelector("#resultRank");
const resultComment = document.querySelector("#resultComment");
const resultRating = document.querySelector(".result-rating");
const resultSlots = document.querySelector("#resultSlots");
const retryButton = document.querySelector("#retryButton");
const toTopButton = document.querySelector("#toTopButton");


const EPILOGUE_BACKGROUNDS = [
  { name: "遊園地", url: "https://pbs.twimg.com/media/G_g7eOPbIAA-osB.jpg" },
  { name: "夏祭り", url: "https://pbs.twimg.com/media/G_g7eOwWQAAxwB1.jpg" },
  { name: "海辺の防波堤", url: "https://pbs.twimg.com/media/G_g7eOzXsAASVRj.jpg" },
  { name: "水族館", url: "https://pbs.twimg.com/media/G_g7eOMaoAEP5u6.jpg" },
  { name: "カフェのテラス", url: "https://pbs.twimg.com/media/G_g7e9LasAAA4_B.jpg" },
  { name: "映画館のロビー", url: "https://pbs.twimg.com/media/G_g7e9NboAA__6e.jpg" },
  { name: "ボーリング場", url: "https://pbs.twimg.com/media/G_g7e90WIAAQ37_.jpg" },
  { name: "海辺の展望台", url: "https://pbs.twimg.com/media/G_g7e9PbsAAy2Az.jpg" },
  { name: "夜の公園", url: "https://pbs.twimg.com/media/G_g7fp5bQAA15Ut.jpg" },
  { name: "星が見える丘", url: "https://pbs.twimg.com/media/G_g7fqrWcAAef_j.jpg" },
  { name: "空港のロビー", url: "https://pbs.twimg.com/media/G_g7fp7bsAAmsSA.jpg" },
  { name: "商店街", url: "https://pbs.twimg.com/media/G_g7fp6bQAA0_Sl.jpg" },
  { name: "コンビニ前", url: "https://pbs.twimg.com/media/G_g7gccbkAAT4r6.jpg" },
  { name: "田舎のバス停", url: "https://pbs.twimg.com/media/G_g7gdBX0AAQPHT.jpg" },
];

const EPILOGUE_BG_MAP = Object.fromEntries(
  EPILOGUE_BACKGROUNDS.map(({ name, url }) => [name, url])
);

function getBackgroundUrlByName(name) {
  return EPILOGUE_BG_MAP[name] || null;
}

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

const outroDialogue = [
  { speaker: "チャイム", line: "「キーンコーンカーンコーン」", mood: "neutral" },
  { speaker: "ミユ", line: "「え、もう終わり！？体感n分なんだけど！」", mood: "negative" },
  { speaker: "シオン", line: "「寄り道しないで、まっすぐ帰りましょ」", mood: "neutral" },
  { speaker: "ナナ", line: "「空、オレンジ色」", mood: "positive" },
  { speaker: "ミユ", line: "「この感じ、ちょっと好きなんだけど」", mood: "positive" },
  { speaker: "シオン", line: "「感傷に浸るのは家に着いてから」", mood: "neutral" },
  { speaker: "ナナ", line: "「じゃあ、帰ろっか」", mood: "positive" },
  { speaker: "ミユ", line: "「うん、帰ろ」", mood: "positive" },
];

const slotCandidates = ["ミユ", "シオン", "ナナ", null];
const DEFAULT_EPILOGUE_LINE = "夏の終わりは静かに訪れた。";

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
//let affection = { ミユ: 20, シオン: 20, ナナ: 20 };
let nowThinking = {
  ミユ: "明日から海に行くか、プールに行くか悩んでいる",
  シオン: "今日が最後の活動日なので、きちんと片付けまで終わらせたいと考えている",
  ナナ: "蝶々可愛い♡蝶々ってどうして蝶々って言うの？",
};
let endingPhase = "none";
let curtainAnimating = false;
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
const initialBackgroundUrl =
  scene?.dataset.initialBg || "https://pbs.twimg.com/media/G_ckRdSboAAoOnb.jpg";

function setSceneBackground(url) {
  if (!scene || !url) return;
  scene.style.setProperty("--scene-bg", `url("${url}")`);
}

setSceneBackground(initialBackgroundUrl);

function waitForCurtainTransition() {
  if (!curtain) return Promise.resolve();
  return new Promise((resolve) => {
    let resolved = false;
    const handleTransitionEnd = (event) => {
      if (event.target !== curtain) return;
      if (resolved) return;
      resolved = true;
      curtain.removeEventListener("transitionend", handleTransitionEnd);
      resolve();
    };
    curtain.addEventListener("transitionend", handleTransitionEnd);
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      curtain.removeEventListener("transitionend", handleTransitionEnd);
      resolve();
    }, 1000);
  });
}

async function lowerCurtain() {
  if (!curtain || curtainAnimating) return;
  curtainAnimating = true;
  curtain.classList.add("is-lowered");
  await waitForCurtainTransition();
  curtainAnimating = false;
}

async function raiseCurtain() {
  if (!curtain || curtainAnimating) return;
  curtainAnimating = true;
  curtain.classList.remove("is-lowered");
  await waitForCurtainTransition();
  curtainAnimating = false;
}

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
  const mood = entry.mood || entry.expression || "neutral";
  const imageSrc = getCharImg(entry.speaker, mood);
  if (imageSrc) {
    showDialoguePresence();
    characterImage.src = imageSrc;
    characterImage.alt = `${entry.speaker}の立ち絵`;
  } else {
    hideDialoguePresence();
  }
  showDialogueBox();
  dialogueName.textContent = entry.speaker;
  dialogueName.classList.remove("is-hidden");
  dialogueLine.textContent = entry.line;
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
  showInputChoicesWithOptions(options);
}

function showInputChoicesWithOptions(options) {
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
  const prefetchOptions = fetchPastLineOptions();
  showChoiceCards([
    {
      text,
      onClick: () => {
        if (choiceState !== "invite") return;
        pendingAfterModal = async () => {
          choiceState = "inputReady";
          hideChoiceCards();
          const options = await prefetchOptions;
          showInputChoicesWithOptions(options);
        };
        showModal(
          "おっと、君は文芸部だ！台詞は君が考えな！\nただし、台詞によっては部活が終わっちまうから、そこはよーーく考えるんだな！",
          "…Monika.chrのバックアップを忘れずに。"
        );
      },
    },
  ]);
}

function normalizeEpilogueDialogue(raw) {
  if (Array.isArray(raw)) return raw;

  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.dialogue)) return raw.dialogue;
    if (Array.isArray(raw.epilogue)) return raw.epilogue;
    if (typeof raw.epilogue === "string") return normalizeEpilogueDialogue(raw.epilogue);
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();

    // ✅ まずJSON文字列として読めるか試す（ここが修正点）
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeEpilogueDialogue(parsed);
      } catch {
        // JSONじゃなければ下へ
      }
    }

    // 従来の「speaker: line」パース
    return trimmed
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^([^:：]+)[:：]\s*(.+)$/);
        if (match) return { speaker: match[1].trim(), line: match[2].trim() };
        return { speaker: "エピローグ", line };
      });
  }

  return [];
}

function buildEpilogueDialogue(raw) {
  const entries = normalizeEpilogueDialogue(raw);
  if (!entries.length) {
    return [{ speaker: "エピローグ", line: DEFAULT_EPILOGUE_LINE, mood: "neutral" }];
  }
  return entries
    .map((entry) => ({
      speaker: entry.speaker || "エピローグ",
      line: entry.line || "",
      mood: entry.mood || "neutral",
    }))
    .filter((entry) => entry.line);
}

async function fetchEpilogueData() {
  if (!playerEmail) {
    return { dialogue: buildEpilogueDialogue(DEFAULT_EPILOGUE_LINE), background: null };
  }
  try {
    const condition = {
      ミユ: {
        relationship: relationship.includes("ミユ"),
        NowThinking: nowThinking?.ミユ ?? "",
      },
      シオン: {
        relationship: relationship.includes("シオン"),
        NowThinking: nowThinking?.シオン ?? "",
      },
      ナナ: {
        relationship: relationship.includes("ナナ"),
        NowThinking: nowThinking?.ナナ ?? "",
      },
    };
    const res = await fetch("/api/bungei/epilogue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: playerEmail, relationship, speechOrder, condition }),
    });
    if (!res.ok) throw new Error("epilogue_failed");
    const data = await res.json();
    const dialogue = buildEpilogueDialogue(data.epilogue);
    return { dialogue, background: data.background ?? null };
  } catch (error) {
    console.error(error);
    return { dialogue: buildEpilogueDialogue(DEFAULT_EPILOGUE_LINE), background: null };
  }
}

function startOutro() {
  endingPhase = "outro";
  sceneDialogue = outroDialogue;
  sceneIndex = -1;
  sceneActive = true;
  hideChoiceCards();
  hideInputPanel();
  setSceneLine(0);
}

async function startEpilogue() {
  endingPhase = "epilogue";
  await lowerCurtain();
  const { dialogue, background } = await fetchEpilogueData();
  if (background?.url) {
    setSceneBackground(background.url);
  }
  sceneDialogue = dialogue;
  sceneIndex = -1;
  sceneActive = true;
  hideChoiceCards();
  hideInputPanel();
  setSceneLine(0);
  await raiseCurtain();
}

function getResultRating() {
  const count = relationship.length;
  if (count >= 3) {
    return { rank: "SSSSSSSS", comment: "運命すら味方につけた、伝説の夏！" };
  }
  if (count === 2) {
    return { rank: "S", comment: "ふたりとの思い出が輝く、最高の夏休み！" };
  }
  if (count === 1) {
    return { rank: "A", comment: "ときめきが残る、甘い夏の予感。" };
  }
  return { rank: "NOOB", comment: "ひとりの夏も、ちゃんと物語になる。" };
}

function setSlotImage(slot, name) {
  const img = slot.querySelector("img");
  if (!img) return;
  if (!name) {
    img.src = "";
    img.alt = "";
    slot.classList.add("slot--empty");
    return;
  }
  slot.classList.remove("slot--empty");
  img.src = getCharImg(name, "positive") || getCharImg(name, "neutral");
  img.alt = `${name}の立ち絵`;
}

function runSlotAnimation(finalNames) {
  if (!resultSlots) return;
  const slots = Array.from(resultSlots.querySelectorAll(".slot"));
  slots.forEach((slot) => slot.classList.add("is-spinning"));

  slots.forEach((slot, index) => {
    let spinIndex = 0;
    const interval = setInterval(() => {
      const candidate = slotCandidates[spinIndex % slotCandidates.length];
      setSlotImage(slot, candidate);
      spinIndex += 1;
    }, 120);
    const stopDelay = 800 + index * 500;
    setTimeout(() => {
      clearInterval(interval);
      setSlotImage(slot, finalNames[index] || null);
      slot.classList.remove("is-spinning");
      slot.classList.add("is-stopped");
      setTimeout(() => slot.classList.remove("is-stopped"), 400);
    }, stopDelay);
  });
}

function runSlotAnimationWithCompletion(finalNames) {
  return new Promise((resolve) => {
    if (!resultSlots) {
      resolve();
      return;
    }
    runSlotAnimation(finalNames);
    const totalDelay = 800 + (finalNames.length - 1) * 500 + 450;
    setTimeout(() => resolve(), totalDelay);
  });
}

function showResultScreen() {
  const finalNames = [...relationship, null, null, null].slice(0, 3);
  const { rank, comment } = getResultRating();
  if (resultRank) resultRank.textContent = "";
  if (resultComment) resultComment.textContent = "";
  if (resultRating) resultRating.classList.add("is-delayed");
  if (resultScreen) {
    resultScreen.classList.remove("is-hidden");
    resultScreen.hidden = false;
  }
  hideDialogueBox();
  hideDialoguePresence();
  hideInputPanel();
  if (playArea) {
    playArea.classList.add("is-hidden");
    playArea.hidden = true;
  }
  return { finalNames, rank, comment };
}

async function startResultSequence() {
  endingPhase = "result";
  await lowerCurtain();
  setSceneBackground(initialBackgroundUrl);
  const { finalNames, rank, comment } = showResultScreen();
  await raiseCurtain();
  await runSlotAnimationWithCompletion(finalNames);
  if (resultRank) resultRank.textContent = rank;
  if (resultComment) resultComment.textContent = comment;
  if (resultRating) resultRating.classList.remove("is-delayed");
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
    const conditionPayload = {
  ミユ: { relationship: relationship.includes("ミユ"), NowThinking: nowThinking.ミユ },
  シオン: { relationship: relationship.includes("シオン"), NowThinking: nowThinking.シオン },
  ナナ: { relationship: relationship.includes("ナナ"), NowThinking: nowThinking.ナナ },
};

const response = await fetch("/api/bungei/scene", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    input,
    email: playerEmail,
    currentSummary,
    condition: conditionPayload,
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

if (data.condition && typeof data.condition === "object") {
  // relationship 配列を condition から再構築
  relationship = Object.entries(data.condition)
    .filter(([_, v]) => v?.relationship)
    .map(([name]) => name);

  // NowThinking 更新
  nowThinking = {
    ミユ: data.condition.ミユ?.NowThinking ?? nowThinking.ミユ,
    シオン: data.condition.シオン?.NowThinking ?? nowThinking.シオン,
    ナナ: data.condition.ナナ?.NowThinking ?? nowThinking.ナナ,
  };
}

    speechOrder = [...speechOrder, input];
    remainingChars = Math.max(0, remainingChars - input.length);
    updateTimer();
    if (remainingChars <= 0) {
      choiceState = "ending";
    }

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
      if (remainingChars <= 0) {
        startOutro();
      } else {
        showInputChoices();
        choiceState = "inputReady";
      }
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
  if (curtainAnimating) return;
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
    if (endingPhase === "outro") {
      startEpilogue();
      return;
    }
    if (endingPhase === "epilogue") {
      startResultSequence();
      return;
    }
    if (remainingChars <= 0) {
      startOutro();
      return;
    }
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

if (retryButton) {
  retryButton.addEventListener("click", () => {
    window.location.reload();
  });
}

if (toTopButton) {
  toTopButton.addEventListener("click", () => {
    window.location.href = "/";
  });
}



window.addEventListener("bungei:jump", async (e) => {
  const { orderList, output, epilogue } = e.detail || {};
  if (!orderList || !output) return;

  await jumpToScene({ orderList, output, epilogue });
});

async function jumpToScene({ orderList, output, epilogue }) {
  await lowerCurtain();

  // ---- 画面をプレイ状態に戻す ----
  introActive = false;
  if (introScreen) {
    introScreen.classList.add("is-hidden");
    introScreen.hidden = true;
  }
  if (resultScreen) {
    resultScreen.classList.add("is-hidden");
    resultScreen.hidden = true;
  }
  if (playArea) {
    playArea.classList.remove("is-hidden");
    playArea.hidden = false;
  }
  showDialogueBox();

  // ---- 状態復元 ----
  speechOrder = Array.isArray(orderList) ? [...orderList] : [];
  
  // ✅ 残り文字数を復元（プレイヤー入力の合計を引く）
const usedChars = speechOrder.reduce((sum, s) => sum + String(s || "").length, 0);
remainingChars = Math.max(0, 120 - usedChars);
updateTimer();
updateInputLimit();

  let parsed = null;
  try {
    parsed = JSON.parse(output);
  } catch {
    parsed = null;
  }

  currentSummary = parsed?.currentSummary ?? null;

  if (parsed?.condition && typeof parsed.condition === "object") {
    relationship = Object.entries(parsed.condition)
      .filter(([_, v]) => v?.relationship)
      .map(([k]) => k);

    nowThinking = {
      ミユ: parsed.condition.ミユ?.NowThinking ?? nowThinking.ミユ,
      シオン: parsed.condition.シオン?.NowThinking ?? nowThinking.シオン,
      ナナ: parsed.condition.ナナ?.NowThinking ?? nowThinking.ナナ,
    };
  }

  // ---- 会話のセット（保存済みをそのまま再生）----
  // ✅ 保存済みの会話をそのまま再生する
if (epilogue) {
  // epilogue が文字列なら JSON 化
  let epiObj = epilogue;
  if (typeof epilogue === "string") {
    try { epiObj = JSON.parse(epilogue); } catch { /* そのまま */ }
  }

  // ✅ 背景反映：background.url 優先、なければ backgroundName
  const bgUrl =
    epiObj?.background?.url ||
    (epiObj?.backgroundName ? getBackgroundUrlByName(epiObj.backgroundName) : null);

  if (bgUrl) setSceneBackground(bgUrl);

  sceneDialogue = buildEpilogueDialogue(epiObj);
  endingPhase = "epilogue";
} else {
    sceneDialogue = Array.isArray(parsed?.dialogue) ? parsed.dialogue : [];
    endingPhase = "none";
  }

  // ---- 再生開始 ----
  sceneIndex = -1;
  sceneActive = sceneDialogue.length > 0;

  hideChoiceCards();
  hideInputPanel();

  if (sceneActive) {
    setSceneLine(0);
  } else {
    // 万一 dialogue が無いときの保険
    showModal("このシーンの会話データが見つかりませんでした。");
  }

  await raiseCurtain();
}