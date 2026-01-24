import { getCharImg } from "../game-assets.js";

const startButton = document.querySelector("#startButton");
const introScreen = document.querySelector("#introScreen");
const playArea = document.querySelector("#playArea");
const introNarration = document.querySelector("#introNarration");
const dialogueName = document.querySelector("#dialogueName");
const dialogueLine = document.querySelector("#dialogueLine");
const characterImage = document.querySelector("#characterImage");
const choiceCard = document.querySelector("#choiceCard");
const modal = document.querySelector("#modal");
const modalText = document.querySelector("#modalText");
const modalFootnote = document.querySelector("#modalFootnote");

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
    line: "120分で、全部終わっちゃうんだ。",
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

function setDialogue(index) {
  const entry = dialogue[index];
  if (!entry) return;
  dialogueIndex = index;
  dialogueName.textContent = entry.speaker;
  dialogueLine.textContent = entry.line;
  characterImage.src = getCharImg(entry.speaker, entry.mood);
  characterImage.alt = `${entry.speaker}の立ち絵`;
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

function startIntro() {
  introScreen.classList.add("is-hidden");
  introScreen.hidden = true;
  playArea.classList.remove("is-hidden");
  playArea.hidden = false;
  introActive = true;
  choiceCard.classList.add("is-hidden");
  choiceCard.hidden = true;
  introNarration.classList.remove("is-hidden");
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
    choiceCard.classList.remove("is-hidden");
    choiceCard.hidden = false;
  };
  showModal("彼女を作ろう！");
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

if (choiceCard) {
  choiceCard.addEventListener("click", (event) => {
    event.stopPropagation();
    pendingAfterModal = null;
    showModal(
      "おっと、君は文芸部だ！台詞は君が考えな！\nただし、台詞によっては部活が終わっちまうから、そこはよーーく考えるんだな！",
      "…Monika.chrのバックアップを忘れずに。"
    );
  });
}

document.addEventListener("click", () => {
  if (!modal.classList.contains("is-hidden")) return;
  if (!introActive) return;
  advanceDialogue();
});
