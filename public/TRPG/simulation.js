const REPORT_URL = "/TRPG/simulation-report.json";
const NS = "http://www.w3.org/2000/svg";

const $ = (selector) => document.querySelector(selector);
const formatNumber = new Intl.NumberFormat("ja-JP");
let report;
let selectedDay = 1;
let playback;

function text(selector, value) {
  const node = $(selector);
  if (node) node.textContent = value ?? "—";
}

function percentage(value, digits = 0) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "—";
}

function svgElement(name, attributes = {}) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function pathFor(days, key, width, height, maxValue) {
  if (!days.length) return "";
  return days.map((day, index) => {
    const x = days.length === 1 ? 0 : (index / (days.length - 1)) * width;
    const y = height - (Number(day[key] ?? 0) / Math.max(1, maxValue)) * height;
    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

function renderChart(days) {
  const svg = $("#worldChart");
  svg.replaceChildren(svgElement("title", { id: "worldChartTitle" }), svgElement("desc", { id: "worldChartDesc" }));
  svg.children[0].textContent = "100日間の事件状態推移";
  svg.children[1].textContent = "日ごとの進行中、危機、終端事件数を示します。";
  const margin = { left: 40, right: 15, top: 12, bottom: 30 };
  const width = 900 - margin.left - margin.right;
  const height = 260 - margin.top - margin.bottom;
  const values = days.flatMap((day) => [day.active, day.critical, day.terminal]).map(Number).filter(Number.isFinite);
  const max = Math.max(1, ...values);
  const group = svgElement("g", { transform: `translate(${margin.left} ${margin.top})` });

  for (let step = 0; step <= 4; step += 1) {
    const y = height - (step / 4) * height;
    group.append(svgElement("line", { x1: 0, x2: width, y1: y, y2: y, class: "axis-line" }));
    const label = svgElement("text", { x: -10, y: y + 3, "text-anchor": "end", class: "axis-label" });
    label.textContent = Math.round(max * step / 4);
    group.append(label);
  }
  [1, 25, 50, 75, 100].forEach((day) => {
    const x = ((day - 1) / 99) * width;
    const label = svgElement("text", { x, y: height + 22, "text-anchor": day === 1 ? "start" : day === 100 ? "end" : "middle", class: "axis-label" });
    label.textContent = `D${day}`;
    group.append(label);
  });
  for (const [key, className] of [["active", "series-active"], ["critical", "series-critical"], ["terminal", "series-terminal"]]) {
    group.append(svgElement("path", { d: pathFor(days, key, width, height, max), class: `series-line ${className}` }));
  }
  const cursor = svgElement("line", { y1: 0, y2: height, class: "day-cursor", id: "dayCursor" });
  group.append(cursor);
  for (const [key, color] of [["active", "var(--sage)"], ["critical", "var(--ember)"], ["terminal", "var(--gold)"]]) {
    group.append(svgElement("circle", { r: 5, fill: color, class: "day-dot", [`data-dot`]: key }));
  }
  svg.append(group);
  updateChartCursor(days, selectedDay, width, height, max);
}

function updateChartCursor(days, dayNumber, width = 845, height = 218, maxValue) {
  const index = Math.max(0, Math.min(days.length - 1, dayNumber - 1));
  const x = days.length === 1 ? 0 : (index / (days.length - 1)) * width;
  const max = maxValue ?? Math.max(1, ...days.flatMap((day) => [day.active, day.critical, day.terminal]));
  const cursor = $("#dayCursor");
  if (cursor) cursor.setAttribute("x1", x), cursor.setAttribute("x2", x);
  document.querySelectorAll("[data-dot]").forEach((dot) => {
    const key = dot.getAttribute("data-dot");
    const y = height - (Number(days[index]?.[key] ?? 0) / max) * height;
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
  });
}

function renderDay(dayNumber) {
  const days = report?.world?.days ?? [];
  const day = days.find((entry) => Number(entry.day) === dayNumber) ?? { day: dayNumber };
  selectedDay = dayNumber;
  text("#dayOutput", dayNumber);
  text("#selectedDay", String(dayNumber).padStart(2, "0"));
  text("#dayActive", day.active ?? 0);
  text("#dayCritical", day.critical ?? 0);
  text("#dayTerminal", day.terminal ?? 0);
  text("#dayMovements", day.movements ?? 0);
  text("#dayPlans", day.goapPlans ?? 0);
  const eventList = $("#dayEvents");
  const events = (report?.world?.transitions ?? []).filter((event) => Number(event.day) === dayNumber);
  eventList.replaceChildren();
  if (!events.length) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = "この日の状態遷移はありません。";
    eventList.append(item);
  } else {
    for (const event of events.slice(0, 12)) {
      const item = document.createElement("li");
      const trouble = document.createElement("b");
      trouble.textContent = event.troubleId ?? "EVENT";
      item.append(trouble, ` ${event.from ?? "—"} → ${event.to ?? "—"} / ${event.phase ?? ""}`);
      eventList.append(item);
    }
  }
  updateChartCursor(days, dayNumber);
}

function renderBattles(battle) {
  const container = $("#battleRows");
  container.replaceChildren();
  const scenarios = battle?.scenarios ?? [];
  if (!scenarios.length) return container.append($("#emptyTemplate").content.cloneNode(true));
  const totalRuns = Number(battle?.totalBattles ?? scenarios.reduce((sum, scenario) => sum + Number(scenario.runs ?? 0), 0));
  text("#metricBattles", formatNumber.format(totalRuns));
  text("#battleRunCount", `${formatNumber.format(totalRuns)} runs`);
  for (const scenario of scenarios.slice(0, 12)) {
    const row = document.createElement("div");
    row.className = "battle-row";
    const label = document.createElement("div");
    const name = document.createElement("strong");
    const details = document.createElement("small");
    name.textContent = scenario.label ?? `${scenario.buildId} / ${scenario.encounterId}`;
    details.textContent = `${scenario.encounterId ?? "—"} · 平均 ${Number(scenario.averageTurns ?? 0).toFixed(1)} turn`;
    label.append(name, details);
    const track = document.createElement("div");
    track.className = "rate-track";
    const fill = document.createElement("span");
    fill.className = "rate-fill";
    fill.style.width = `${Math.max(0, Math.min(100, Number(scenario.winRate ?? 0) * 100))}%`;
    track.append(fill);
    const value = document.createElement("span");
    value.className = "rate-value";
    value.textContent = percentage(Number(scenario.winRate), 0);
    row.append(label, track, value);
    container.append(row);
  }
}

function renderProgression(progression, economy) {
  const container = $("#profileRows");
  container.replaceChildren();
  const profiles = progression?.profiles ?? [];
  const maxAcquired = Math.max(1, ...profiles.map((profile) => Number(profile.acquiredCount ?? 0)));
  for (const profile of profiles) {
    const row = document.createElement("div");
    row.className = "profile-row";
    const label = document.createElement("div");
    const name = document.createElement("strong");
    const detail = document.createElement("small");
    name.textContent = profile.label ?? profile.id;
    detail.textContent = `Lv${profile.maxLevel ?? "—"} · SP残 ${profile.spRemaining ?? "—"}`;
    label.append(name, detail);
    const track = document.createElement("div");
    track.className = "profile-track";
    const fill = document.createElement("span");
    fill.className = "profile-fill";
    fill.style.width = `${Number(profile.acquiredCount ?? 0) / maxAcquired * 100}%`;
    track.append(fill);
    const value = document.createElement("span");
    value.className = "profile-value";
    value.textContent = `${profile.acquiredCount ?? 0} skill`;
    row.append(label, track, value);
    container.append(row);
  }
  if (!profiles.length) container.append($("#emptyTemplate").content.cloneNode(true));
  text("#startingGold", `${economy?.startingGold ?? "—"} G`);
  text("#minimumFood", `${economy?.minimumFood ?? "—"} G`);
  text("#minimumLodging", `${economy?.minimumLodging ?? "—"} G`);
  text("#unreachableSkills", progression?.unreachableCount ?? "—");
}

function renderFindings(findings) {
  const list = $("#findings");
  list.replaceChildren();
  text("#findingCount", `${findings.length} items`);
  for (const finding of findings) {
    const item = document.createElement("li");
    const severity = document.createElement("span");
    const heading = document.createElement("h3");
    const body = document.createElement("p");
    severity.className = "finding-severity";
    severity.textContent = String(finding.severity ?? finding.status ?? "NOTE").toUpperCase();
    heading.textContent = finding.title ?? "検証項目";
    body.textContent = finding.detail ?? finding.description ?? "";
    item.append(severity, heading, body);
    list.append(item);
  }
  if (!findings.length) list.append($("#emptyTemplate").content.cloneNode(true));
}

function render(data) {
  report = data;
  const worldSummary = data.world?.summary ?? {};
  const terminalRate = Number(worldSummary.totalTroubles) ? Number(worldSummary.terminalTroubles) / Number(worldSummary.totalTroubles) : NaN;
  const state = !data.quality?.passed ? "error" : data.quality?.warning ? "warning" : "passed";
  const statusLabel = state === "passed" ? "検証済み" : state === "warning" ? "要調整" : "検証失敗";
  $("#runStatus").dataset.state = state;
  text("#runStatus", statusLabel);
  text("#generatedAt", data.meta?.generatedAt ? new Date(data.meta.generatedAt).toLocaleString("ja-JP") : "—");
  text("#metricWorld", percentage(terminalRate, 0));
  text("#metricNpcs", formatNumber.format(data.sourceCounts?.npcs ?? 0));
  text("#metricSkills", formatNumber.format(data.sourceCounts?.skills ?? 0));
  const days = data.world?.days ?? [];
  renderChart(days);
  $("#daySlider").max = String(Math.max(1, days.length || data.meta?.days || 100));
  renderDay(1);
  renderBattles(data.battle);
  renderProgression(data.progression, data.economy);
  renderFindings(data.findings ?? []);
  const sources = data.meta?.sources ?? [];
  text("#sourceNote", sources.length ? `出典: ${sources.join(" / ")}（読取スナップショット）` : "出典情報なし");
}

function togglePlayback() {
  const button = $("#playButton");
  if (playback) {
    clearInterval(playback);
    playback = undefined;
    button.textContent = "▶";
    button.setAttribute("aria-label", "日付を自動再生");
    return;
  }
  button.textContent = "Ⅱ";
  button.setAttribute("aria-label", "自動再生を停止");
  playback = setInterval(() => {
    const maximum = Number($("#daySlider").max);
    const next = selectedDay >= maximum ? 1 : selectedDay + 1;
    $("#daySlider").value = String(next);
    renderDay(next);
  }, 320);
}

$("#daySlider").addEventListener("input", (event) => renderDay(Number(event.currentTarget.value)));
$("#playButton").addEventListener("click", togglePlayback);

try {
  const response = await fetch(REPORT_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  render(await response.json());
} catch (error) {
  console.error("TRPG simulation report load failed", error);
  $("#runStatus").dataset.state = "error";
  text("#runStatus", "読込失敗");
  $("#findings").append($("#emptyTemplate").content.cloneNode(true));
}
