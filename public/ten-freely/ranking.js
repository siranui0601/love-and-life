const app = window.tenFreelyApp;
if (!app) throw new Error("tenFreelyApp bridge is not ready");

const form = document.getElementById("rankingFilters");
const list = document.getElementById("rankingList");
const status = document.getElementById("rankingStatus");
let requestSequence = 0;
let debounceTimer = null;

function selectedCondition() {
  const digitLengths = [...form.querySelectorAll('input[name="rankingDigit"]:checked')].map((input) => Number(input.value));
  const questionRaw = form.querySelector('input[name="rankingQuestions"]:checked')?.value || "5";
  return {
    digitLengths,
    questionCount: questionRaw === "infinity" ? "infinity" : Number(questionRaw),
    lives: Number(form.querySelector('input[name="rankingLives"]:checked')?.value || 3),
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function valueHtml(entry, infinite) {
  if (infinite) return `<strong>${Number(entry.solvedCount).toLocaleString("ja-JP")}問</strong><small>平均 ${app.formatDuration(entry.averageTimeMs, true)}</small>`;
  return `<strong>${app.formatDuration(entry.totalTimeMs, true)}</strong><small>平均 ${app.formatDuration(entry.averageTimeMs, true)}</small>`;
}

function renderRanking(data) {
  const infinite = data.condition.questionCount === "infinity";
  list.replaceChildren();
  if (!data.ranking.length) {
    list.innerHTML = '<li class="ranking-empty">この条件には、まだ完走記録がありません。最初の記録を作ろう。</li>';
    status.textContent = infinite
      ? "∞モードは正解数が多い順。同数なら平均回答時間で順位を決めます。"
      : "5問・10問モードは、全問クリアした記録だけを合計タイムで比較します。";
    return;
  }

  for (const entry of data.ranking) {
    const row = document.createElement("li");
    row.className = `ranking-row${entry.isSelf ? " is-self" : ""}`;
    row.innerHTML = `
      <span class="ranking-medal">${entry.rank}</span>
      <span class="ranking-name"><strong>${escapeHtml(entry.username)}${entry.isSelf ? "（あなた）" : ""}</strong><small>${entry.rank <= 3 ? "TOP CHALLENGER" : "CHALLENGER"}</small></span>
      <span class="ranking-value">${valueHtml(entry, infinite)}</span>`;
    list.append(row);
  }
  const ownText = data.own
    ? `あなたの自己ベストは ${data.own.rank}位です。`
    : "ログイン中の完走記録は、まだこの条件にありません。";
  status.textContent = `${infinite ? "正解数順" : "合計タイム順"} ／ 条件完全一致。${ownText}`;
}

async function loadRanking() {
  const condition = selectedCondition();
  if (!condition.digitLengths.length) {
    status.textContent = "桁数を1つ以上選択してください。";
    list.replaceChildren();
    return;
  }
  const sequence = ++requestSequence;
  status.textContent = "ランキングを読み込んでいます…";
  list.innerHTML = '<li class="ranking-empty">LOADING…</li>';
  const params = new URLSearchParams({
    digits: condition.digitLengths.join(","),
    questions: String(condition.questionCount),
    lives: String(condition.lives),
    limit: "50",
  });
  try {
    const response = await fetch(`/api/ten-freely/ranking?${params}`, { credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.error || "ranking_failed");
    if (sequence !== requestSequence) return;
    renderRanking(data);
  } catch (error) {
    console.error(error);
    if (sequence !== requestSequence) return;
    status.textContent = "ランキングを取得できませんでした。少し時間をおいて再度お試しください。";
    list.innerHTML = '<li class="ranking-empty">データを読み込めませんでした。</li>';
  }
}

form.addEventListener("change", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadRanking, 180);
});
window.addEventListener("ten-freely:screen-changed", (event) => {
  if (event.detail?.screen === "ranking") loadRanking();
});
