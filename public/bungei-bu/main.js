import { getCharImg } from "../game-assets.js";

const startOverlay = document.querySelector("#startOverlay");
const startButton = document.querySelector("#startButton");
const dialogueBox = document.querySelector("#dialogueBox");
const dialogueName = document.querySelector("#dialogueName");
const dialogueText = document.querySelector("#dialogueText");
const characterImage = document.querySelector("#characterImage");
const choiceCard = document.querySelector("#choiceCard");
const modal = document.querySelector("#modal");
const modalText = document.querySelector("#modalText");
const modalNote = document.querySelector("#modalNote");

const introDialogue = [
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
    mood: "negative",
  },
  {
    speaker: "ミユ",
    line: "え〜、なんかあっさりしてない？もっとこう、最終回感ほしくない？",
    mood: "positive",
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

const choiceText = "じゃあさ、片付けでもしながら夏っぽいの詠まない？";
const secondModalText =
  "おっと、君は文芸部だ！台詞は君が考えな！\nただし、台詞によっては部活が終わっちまうから、そこはよーーく考えるんだな！";
const secondModalNote = "…Monika.chrのバックアップを忘れずに。";

let dialogueIndex = 0;
let state = "idle";

function renderDialogue() {
  const current = introDialogue[dialogueIndex];
  if (!current) return;
  dialogueName.textContent = current.speaker;
  dialogueText.textContent = current.line;
  const imageUrl = getCharImg(current.speaker, current.mood);
  characterImage.src = imageUrl;
  characterImage.alt = `${current.speaker}の立ち絵`;
}

function showModal(text, note = "") {
  modalText.textContent = text;
  modalNote.textContent = note;
  modal.hidden = false;
}

function hideModal() {
  modal.hidden = true;
  modalText.textContent = "";
  modalNote.textContent = "";
}

function startIntro() {
  state = "dialogue";
  dialogueIndex = 0;
  renderDialogue();
  startOverlay.hidden = true;
}

function advanceDialogue() {
  if (dialogueIndex < introDialogue.length - 1) {
    dialogueIndex += 1;
    renderDialogue();
    return;
  }
  state = "modal-intro";
  showModal("彼女を作ろう！");
}

function openSecondModal() {
  state = "modal-choice";
  showModal(secondModalText, secondModalNote);
}

function handleGlobalTap() {
  if (!modal.hidden) {
    hideModal();
    if (state === "modal-intro") {
      state = "choice";
      choiceCard.hidden = false;
    } else if (state === "modal-choice") {
      state = "choice-finished";
    }
    return;
  }
  if (state === "dialogue") {
    advanceDialogue();
  }
}

if (startButton) {
  startButton.addEventListener("click", (event) => {
    event.stopPropagation();
    startIntro();
  });
}

if (choiceCard) {
  choiceCard.textContent = choiceText;
  choiceCard.addEventListener("click", (event) => {
    event.stopPropagation();
    if (state === "choice") {
      openSecondModal();
    }
  });
}

document.addEventListener("click", () => {
  if (startOverlay && !startOverlay.hidden) {
    return;
  }
  handleGlobalTap();
});
