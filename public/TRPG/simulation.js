const REPORT_URL = "/TRPG/simulation-report.json";
const NS = "http://www.w3.org/2000/svg";
const PHASES = ["morning", "day", "evening", "night"];
const PHASE_LABELS = ["朝", "昼", "夕", "夜"];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const formatNumber = new Intl.NumberFormat("ja-JP");
let report;
let selectedDay = 1;
let selectedTick = 0;
let selectedNpcId;
let renderedLaneNpcId;
let playback;

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(selector, value) {
  const node = $(selector);
  if (node) node.textContent = value ?? "—";
}

function percentage(value, digits = 0) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "—";
}

function phaseIndexOf(entry) {
  const explicit = Number(entry?.phaseIndex ?? entry?.time?.phaseIndex);
  if (Number.isInteger(explicit)) return Math.max(0, Math.min(3, explicit));
  const phase = String(entry?.phase ?? entry?.time?.phase ?? "").toLowerCase();
  const index = PHASES.indexOf(phase);
  return index >= 0 ? index : 0;
}

function dayOf(entry) {
  const explicit = Number(entry?.day ?? entry?.time?.day);
  if (Number.isFinite(explicit)) return Math.max(1, Math.trunc(explicit));
  const tick = Number(entry?.tick ?? entry?.tickIndex);
  return Number.isFinite(tick) ? Math.floor(tick / 4) + 1 : 1;
}

function tickOf(entry) {
  const explicit = Number(entry?.tick ?? entry?.tickIndex);
  return Number.isFinite(explicit) ? Math.max(0, Math.trunc(explicit)) : (dayOf(entry) - 1) * 4 + phaseIndexOf(entry);
}

function shortHash(value) {
  const source = String(value ?? "");
  return source ? `${source.slice(0, 12)}…${source.slice(-8)}` : "—";
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
    const y = height - (number(day[key]) / Math.max(1, maxValue)) * height;
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
  group.append(svgElement("line", { y1: 0, y2: height, class: "day-cursor", id: "dayCursor" }));
  for (const [key, color] of [["active", "var(--sage)"], ["critical", "var(--ember)"], ["terminal", "var(--gold)"]]) {
    group.append(svgElement("circle", { r: 5, fill: color, class: "day-dot", "data-dot": key }));
  }
  svg.append(group);
  updateChartCursor(days, selectedDay, width, height, max);
}

function updateChartCursor(days, dayNumber, width = 845, height = 218, maxValue) {
  if (!days.length) return;
  const index = Math.max(0, Math.min(days.length - 1, dayNumber - 1));
  const x = days.length === 1 ? 0 : (index / (days.length - 1)) * width;
  const max = maxValue ?? Math.max(1, ...days.flatMap((day) => [day.active, day.critical, day.terminal]));
  const cursor = $("#dayCursor");
  if (cursor) cursor.setAttribute("x1", x), cursor.setAttribute("x2", x);
  $$('[data-dot]').forEach((dot) => {
    const key = dot.getAttribute("data-dot");
    const y = height - (number(days[index]?.[key]) / max) * height;
    dot.setAttribute("cx", x);
    dot.setAttribute("cy", y);
  });
}

function worldEvents() {
  const events = [...asArray(report?.world?.events), ...asArray(report?.world?.transitions)];
  const seen = new Set();
  return events.filter((entry) => {
    const key = entry.eventId ?? `${entry.type ?? entry.troubleId}|${entry.npcId ?? ""}|${tickOf(entry)}|${entry.from ?? ""}|${entry.to ?? ""}|${entry.factId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function eventLabel(event) {
  const subject = event.npcId ?? event.troubleId ?? "WORLD";
  if (event.troubleId && event.from !== undefined && event.to !== undefined) {
    return `${subject} ${event.from ?? "—"} → ${event.to ?? "—"}${event.reason ? ` / ${event.reason}` : ""}`;
  }
  if (event.type === "movement") return `${subject} ${event.from ?? "—"} → ${event.to ?? "—"}${event.reason ? ` / ${event.reason}` : ""}`;
  if (/knowledge|learn|fact|rumor|observe|share/u.test(String(event.type))) {
    const source = event.sourceNpcId ? `（${event.sourceNpcId}から）` : "";
    const propagation = event.propagationId || number(event.hopCount) || event.latencyTicks != null
      ? ` / 噂${event.propagationId ? ` ${event.propagationId}` : ""} ${number(event.hopCount)} hop・${number(event.latencyTicks)} tick遅延・重要度${event.importance ?? "—"}`
      : "";
    const outcome = event.accepted === false || event.outcome === "ignored"
      ? `を無視（${event.ignoredReason ?? event.reason ?? "関心・信頼条件外"}）`
      : "を知る";
    return `${subject} が ${event.factId ?? event.label ?? "新しい事実"} ${outcome}${source}${propagation}${event.accepted === false ? "" : event.reason ? ` / ${event.reason}` : ""}`;
  }
  if (/life|death|dead|missing|injur|depart|captur/u.test(String(event.type))) {
    return `${subject} ${event.from ?? "—"} → ${event.to ?? event.vitalState ?? event.presence ?? event.type}${event.reason ? ` / ${event.reason}` : ""}`;
  }
  if (/decision|plan|replan/u.test(String(event.type))) {
    return `${subject} ${event.changed ? "再計画" : "判断"}: ${event.goalId ?? event.actionType ?? "行動維持"}${event.reason ? ` / ${event.reason}` : ""}`;
  }
  return `${subject} ${event.type ?? "event"}${event.reason ? ` / ${event.reason}` : ""}`;
}

function populationAt(tickIndex) {
  const rows = asArray(report?.world?.populationByTick).slice().sort((left, right) => tickOf(left) - tickOf(right));
  if (!rows.length) return {};
  return rows.find((entry) => tickOf(entry) === tickIndex) ?? rows.filter((entry) => tickOf(entry) <= tickIndex).at(-1) ?? rows[0];
}

function renderTick(tickIndex) {
  const days = report?.world?.days ?? [];
  const maximum = number($("#tickSlider")?.max, 399);
  selectedTick = Math.max(0, Math.min(maximum, Math.trunc(tickIndex)));
  selectedDay = Math.floor(selectedTick / 4) + 1;
  const phaseIndex = selectedTick % 4;
  const day = days.find((entry) => number(entry.day) === selectedDay) ?? { day: selectedDay };
  const population = populationAt(selectedTick);
  $("#tickSlider").value = String(selectedTick);
  text("#dayOutput", selectedDay);
  text("#phaseOutput", PHASE_LABELS[phaseIndex]);
  text("#selectedDay", String(selectedDay).padStart(2, "0"));
  text("#selectedPhase", PHASE_LABELS[phaseIndex]);
  text("#dayActive", day.active ?? 0);
  text("#dayCritical", day.critical ?? 0);
  text("#dayTerminal", day.terminal ?? 0);
  text("#dayMovements", day.movements ?? 0);
  text("#dayPlans", day.goapPlans ?? 0);
  text("#dayKnowledge", day.knowledgeGained ?? 0);
  text("#dayReplans", day.replans ?? 0);
  text("#populationAlive", population.alive ?? "—");
  text("#populationInjured", population.injured ?? "—");
  text("#populationTraveling", population.traveling ?? population.travelingNpcs ?? "—");
  text("#populationMissing", population.missing ?? "—");
  text("#populationDead", population.dead ?? "—");

  const eventPriority = (event) => /life|death|dead|missing|injur|depart|captur/u.test(String(event.type))
    ? 0
    : event.troubleId && event.from !== undefined && event.to !== undefined
      ? 1
      : /rumor|observe|share|knowledge/u.test(String(event.type))
        ? 2
        : /decision|plan|replan/u.test(String(event.type))
          ? 3
          : 4;
  const exactEvents = worldEvents()
    .filter((event) => dayOf(event) === selectedDay && phaseIndexOf(event) === phaseIndex)
    .sort((left, right) => eventPriority(left) - eventPriority(right));
  const eventList = $("#dayEvents");
  eventList.replaceChildren();
  if (!exactEvents.length) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = "この時刻の因果イベントはありません。";
    eventList.append(item);
  } else {
    for (const event of exactEvents.slice(0, 24)) {
      const item = document.createElement("li");
      const subject = document.createElement("b");
      subject.textContent = event.npcId ?? event.troubleId ?? "WORLD";
      item.append(subject, ` ${eventLabel(event).replace(`${subject.textContent} `, "")}`);
      eventList.append(item);
    }
  }
  updateChartCursor(days, selectedDay);
  updateSelectedDayMarkers();
  renderSelectedNpc();
}

function traceMap() {
  return new Map(asArray(report?.world?.npcTraces).map((trace) => [String(trace.id ?? trace.npcId), trace]));
}

function npcIndex() {
  const index = asArray(report?.world?.npcIndex);
  if (index.length) return index;
  return asArray(report?.world?.npcTraces).map((trace) => ({ id: trace.id ?? trace.npcId, name: trace.name ?? trace.id ?? trace.npcId }));
}

function dayState(trace, day) {
  const entries = asArray(trace?.daily).filter((entry) => number(entry.day) <= day).sort((left, right) => number(left.day) - number(right.day));
  return entries.find((entry) => number(entry.day) === day) ?? entries.at(-1) ?? null;
}

function statusClasses(state) {
  if (!state) return ["is-unknown"];
  const classes = [];
  const vital = String(state.vitalState ?? "").toLowerCase();
  const presence = String(state.presence ?? "").toLowerCase();
  if (vital === "dead") classes.push("is-dead");
  else if (presence === "missing") classes.push("is-missing");
  else {
    if (state.moved || number(state.movementCount) > 0) classes.push("is-move");
    if (state.learned || number(state.knowledgeCount) > 0) classes.push("is-learn");
    if (state.replanned) classes.push("is-replan");
  }
  return classes;
}

function stateDescription(npc, state, day) {
  if (!state) return `${npc.id} ${npc.name ?? ""} Day${day}: 個別状態なし`;
  const markers = [];
  if (state.moved) markers.push("移動");
  if (state.learned) markers.push("知識獲得");
  if (state.replanned) markers.push("再計画");
  return `${npc.id} ${npc.name ?? ""} Day${day}: ${state.vitalState ?? "alive"}/${state.presence ?? "present"}, ${state.location ?? "場所不明"}${markers.length ? `, ${markers.join("・")}` : ""}`;
}

function renderMatrixDays() {
  const header = $("#matrixDays");
  header.replaceChildren();
  for (const day of [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
    const label = document.createElement("span");
    label.className = "matrix-day-label";
    label.style.setProperty("--matrix-column", String(day + 1));
    label.textContent = `D${day}`;
    header.append(label);
  }
}

function filteredNpcs() {
  const query = String($("#npcSearch")?.value ?? "").trim().toLocaleLowerCase("ja");
  const status = $("#npcStatusFilter")?.value ?? "all";
  return npcIndex().filter((npc) => {
    const haystack = `${npc.id ?? ""} ${npc.name ?? ""} ${npc.home ?? ""} ${npc.behaviorType ?? ""}`.toLocaleLowerCase("ja");
    if (query && !haystack.includes(query)) return false;
    if (status === "all") return true;
    if (status === "dead" || status === "injured" || status === "alive") return String(npc.vitalState ?? "alive") === status;
    return String(npc.presence ?? "present") === status;
  });
}

function renderNpcMatrix() {
  const container = $("#npcMatrix");
  const traces = traceMap();
  const npcs = filteredNpcs();
  container.replaceChildren();
  if (!npcs.length) {
    container.append($("#emptyTemplate").content.cloneNode(true));
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const npc of npcs) {
    const id = String(npc.id ?? npc.npcId);
    const trace = traces.get(id);
    const row = document.createElement("div");
    row.className = "npc-matrix-row";
    row.dataset.npcId = id;
    row.setAttribute("role", "row");
    if (id === selectedNpcId) row.classList.add("is-selected");
    const label = document.createElement("button");
    label.type = "button";
    label.className = "npc-matrix-label";
    label.textContent = `${id} ${npc.name ?? "名称未設定"}`;
    label.setAttribute("aria-label", `${id} ${npc.name ?? "名称未設定"}を選択`);
    label.addEventListener("click", () => selectNpc(id));
    row.append(label);
    for (let day = 1; day <= 100; day += 1) {
      const state = dayState(trace, day);
      const cell = document.createElement("i");
      cell.className = "matrix-cell";
      cell.dataset.day = String(day);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", stateDescription(npc, state, day));
      cell.title = stateDescription(npc, state, day);
      cell.classList.add(...statusClasses(state));
      if (day === selectedDay) cell.classList.add("is-selected-day");
      row.append(cell);
    }
    fragment.append(row);
  }
  container.append(fragment);
}

function selectNpc(id) {
  selectedNpcId = String(id);
  renderedLaneNpcId = undefined;
  $$('.npc-matrix-row').forEach((row) => row.classList.toggle("is-selected", row.dataset.npcId === selectedNpcId));
  renderSelectedNpc();
}

function renderNpcLanes(trace) {
  const container = $("#npcLanes");
  container.replaceChildren();
  const laneDefinitions = [
    ["location", "居場所"],
    ["action", "行動"],
    ["knowledge", "知識"],
    ["lifecycle", "生死・退場"],
  ];
  for (const [kind, label] of laneDefinitions) {
    const lane = document.createElement("div");
    lane.className = "npc-lane";
    lane.dataset.lane = kind;
    const heading = document.createElement("strong");
    heading.textContent = label;
    lane.append(heading);
    for (let day = 1; day <= 100; day += 1) {
      const state = dayState(trace, day);
      const cell = document.createElement("i");
      cell.className = "lane-cell";
      cell.dataset.day = String(day);
      let value = null;
      if (kind === "location") value = state?.location;
      if (kind === "action") value = asArray(state?.actions).join("・") || state?.action || state?.goalId;
      if (kind === "knowledge") value = state?.learned || number(state?.knowledgeCount) ? `${number(state?.knowledgeCount, 1)}件獲得` : null;
      if (kind === "lifecycle") value = state ? `${state.vitalState ?? "alive"}/${state.presence ?? "present"}` : null;
      if (value) cell.classList.add("has-value");
      if (kind === "lifecycle") {
        if (String(state?.vitalState) === "dead") cell.classList.add("is-dead");
        if (String(state?.presence) === "missing") cell.classList.add("is-missing");
      }
      if (day === selectedDay) cell.classList.add("is-selected-day");
      cell.title = `Day${day}: ${value ?? "記録なし"}`;
      cell.setAttribute("aria-label", `${label} Day${day}: ${value ?? "記録なし"}`);
      lane.append(cell);
    }
    container.append(lane);
  }
  renderedLaneNpcId = selectedNpcId;
}

function renderSelectedNpc() {
  if (!report) return;
  const npcs = npcIndex();
  if (!selectedNpcId && npcs.length) selectedNpcId = String(npcs[0].id ?? npcs[0].npcId);
  const npc = npcs.find((entry) => String(entry.id ?? entry.npcId) === selectedNpcId);
  const trace = traceMap().get(selectedNpcId);
  if (!npc) return;
  const state = dayState(trace, selectedDay) ?? npc;
  text("#selectedNpcName", `${npc.name ?? "名称未設定"} / ${selectedNpcId}`);
  text("#selectedNpcIdentity", `${npc.behaviorType ?? "行動型不明"} · 本拠 ${npc.home ?? "不明"} · ${number(npc.daysObserved)}日記録`);
  text("#selectedNpcLocation", state.location ?? npc.finalLocation ?? npc.initialLocation ?? "—");
  text("#selectedNpcVital", state.vitalState ?? "alive");
  text("#selectedNpcPresence", state.presence ?? "present");
  text("#selectedNpcGoal", state.goalId ?? "—");
  text("#selectedNpcAction", asArray(state.actions).join("・") || state.action || "—");
  text("#selectedNpcDay", `DAY ${selectedDay} / ${PHASE_LABELS[selectedTick % 4]}`);
  if (renderedLaneNpcId !== selectedNpcId) renderNpcLanes(trace);
  $$('#npcLanes .lane-cell').forEach((cell) => cell.classList.toggle("is-selected-day", number(cell.dataset.day) === selectedDay));

  const localEvents = [...asArray(trace?.events), ...worldEvents().filter((entry) => String(entry.npcId ?? "") === selectedNpcId)];
  const seenEvents = new Set();
  const events = localEvents.filter((entry) => {
    const key = entry.eventId ?? `${entry.type ?? "event"}|${tickOf(entry)}|${entry.factId ?? ""}|${entry.actionType ?? ""}`;
    if (seenEvents.has(key)) return false;
    seenEvents.add(key);
    return dayOf(entry) === selectedDay && phaseIndexOf(entry) <= selectedTick % 4;
  });
  const list = $("#npcCausalEvents");
  list.replaceChildren();
  if (!events.length) {
    const item = document.createElement("li");
    item.className = "muted";
    item.textContent = state?.reason ? `計画維持: ${state.reason}` : "この日までに記録された知識・再計画・生死イベントはありません。";
    list.append(item);
  } else {
    for (const event of events.slice(-12)) {
      const item = document.createElement("li");
      const type = document.createElement("b");
      type.textContent = String(event.type ?? "event").toUpperCase();
      const source = event.sourceNpcId || event.sourceEventId ? ` / 出典 ${event.sourceNpcId ?? event.sourceEventId}` : "";
      const rumor = event.propagationId || number(event.hopCount) || event.latencyTicks != null
        ? ` / ${number(event.hopCount)} hop・${number(event.latencyTicks)} tick遅延・重要度${event.importance ?? "—"}${asArray(event.path).length ? `・経路 ${asArray(event.path).join("→")}` : ""}`
        : "";
      const pickup = event.accepted === false || event.outcome === "ignored" ? ` / 取得せず: ${event.ignoredReason ?? event.reason ?? "条件外"}` : "";
      item.append(type, ` ${event.factId ?? event.actionType ?? event.from ?? "—"}${event.to ? ` → ${event.to}` : ""}${event.reason && !pickup ? ` / ${event.reason}` : ""}${source}${rumor}${pickup}`);
      list.append(item);
    }
  }
}

function updateSelectedDayMarkers() {
  $$('.matrix-cell.is-selected-day').forEach((cell) => cell.classList.remove("is-selected-day"));
  $$(`.matrix-cell[data-day="${selectedDay}"]`).forEach((cell) => cell.classList.add("is-selected-day"));
}

function renderCrisisOutcomes(outcomes) {
  const container = $("#crisisRows");
  container.replaceChildren();
  const rows = asArray(outcomes).slice().sort((left, right) => {
    const rank = { failed: 0, critical: 1, resolved: 2, suppressed: 3 };
    return number(rank[left.status], 9) - number(rank[right.status], 9) || number(left.terminalDay, 999) - number(right.terminalDay, 999);
  });
  const failures = rows.filter((entry) => ["failed", "critical"].includes(entry.status));
  text("#crisisFailureCount", `${failures.length} failures`);
  if (!rows.length) return container.append($("#emptyTemplate").content.cloneNode(true));
  for (const outcome of rows) {
    const row = document.createElement("article");
    row.className = "crisis-row";
    row.dataset.status = outcome.status ?? "unknown";
    const status = document.createElement("span");
    const title = document.createElement("strong");
    const detail = document.createElement("small");
    status.textContent = `${String(outcome.status ?? "unknown").toUpperCase()} / DAY ${outcome.terminalDay ?? "—"}`;
    title.textContent = `${outcome.troubleId ?? "EVENT"} ${outcome.name ?? "名称未設定"}`;
    detail.textContent = `死亡 ${number(outcome.deaths)} · 行方不明 ${number(outcome.missing)} · 負傷 ${number(outcome.injured)}${outcome.terminalReason ? ` / ${outcome.terminalReason}` : ""}`;
    row.append(status, title, detail);
    container.append(row);
  }
}

function renderReplay(world, meta) {
  const replay = world?.replay ?? {};
  const mode = String(replay.mode ?? "no-player").toUpperCase().replaceAll("-", " ");
  text("#simulationMode", `${mode}${replay.npcMitigationCanResolve === false ? " / NPC軽減のみでは未解決" : ""}`);
  text("#replaySeed", replay.representativeSeed ?? replay.seed ?? meta?.seed ?? "—");
  text("#replayFingerprint", shortHash(replay.fingerprint ?? world?.fingerprint));
  text("#replayEngine", replay.engineVersion ?? replay.rngVersion ?? "version未記録");
  text("#replayStatus", replay.deterministic === false || !(replay.fingerprint ?? world?.fingerprint)
    ? "fingerprintがなく、完全再現を証明できません。"
    : `入力 ${shortHash(replay.inputDigest)} / 調整 ${shortHash(replay.tuningDigest)} / 同条件で同一結果`);
}

function renderEvidence(world, sourceCounts) {
  const coverage = world?.coverage ?? {};
  const expected = number(coverage.expectedStateTicks);
  const observed = number(coverage.observedStateTicks);
  const stateRate = expected ? observed / expected : Number(coverage.stateCoverage);
  text("#metricStateCoverage", percentage(stateRate, 0));
  text("#stateCoverageDetail", `${formatNumber.format(observed)} / ${formatNumber.format(expected)} 状態tick`);
  const decisionRate = Number(coverage.decisionCoverage);
  text("#metricDecisionCoverage", Number.isFinite(decisionRate) ? percentage(decisionRate, 0) : formatNumber.format(number(coverage.decisionsLogged)));
  const npcCount = number(coverage.npcCount, sourceCounts?.npcs ?? 0);
  text("#metricLearners", `${number(coverage.learners)}/${npcCount}`);
  const fateRate = Number(coverage.fateEvaluationCoverage);
  text("#metricFates", Number.isFinite(fateRate) ? percentage(fateRate, 0) : coverage.fateEvaluated != null ? `${coverage.fateEvaluated}/${npcCount}` : "—");
  text("#npcCoverageNote", `${number(coverage.trackedNpcCount)}/${npcCount}人を索引化 · ${number(coverage.npcTimelineCount)}/${npcCount}人に日別軌跡 · 移動${number(coverage.movers)}人 · 知識獲得${number(coverage.learners)}人 · 再計画${number(coverage.replanners)}人`);
}

function renderBattles(battle) {
  const container = $("#battleRows");
  container.replaceChildren();
  const scenarios = battle?.scenarios ?? [];
  if (!scenarios.length) return container.append($("#emptyTemplate").content.cloneNode(true));
  const totalRuns = number(battle?.totalBattles, scenarios.reduce((sum, scenario) => sum + number(scenario.runs), 0));
  text("#metricBattles", formatNumber.format(totalRuns));
  text("#battleRunCount", `${formatNumber.format(totalRuns)} runs`);
  for (const scenario of scenarios.slice(0, 12)) {
    const row = document.createElement("div");
    row.className = "battle-row";
    const label = document.createElement("div");
    const name = document.createElement("strong");
    const details = document.createElement("small");
    name.textContent = scenario.label ?? `${scenario.buildId} / ${scenario.encounterId}`;
    details.textContent = `${scenario.encounterId ?? "—"} · 平均 ${number(scenario.averageTurns).toFixed(1)} turn`;
    label.append(name, details);
    const track = document.createElement("div");
    track.className = "rate-track";
    const fill = document.createElement("span");
    fill.className = "rate-fill";
    fill.style.width = `${Math.max(0, Math.min(100, number(scenario.winRate) * 100))}%`;
    track.append(fill);
    const value = document.createElement("span");
    value.className = "rate-value";
    value.textContent = percentage(number(scenario.winRate), 0);
    row.append(label, track, value);
    container.append(row);
  }
}

function renderProgression(progression, economy) {
  const container = $("#profileRows");
  container.replaceChildren();
  const profiles = progression?.profiles ?? [];
  const maxAcquired = Math.max(1, ...profiles.map((profile) => number(profile.acquiredCount)));
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
    fill.style.width = `${number(profile.acquiredCount) / maxAcquired * 100}%`;
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
  const world = data.world ?? {};
  const worldSummary = world.summary ?? {};
  const terminalRate = number(worldSummary.totalTroubles) ? number(worldSummary.terminalTroubles) / number(worldSummary.totalTroubles) : NaN;
  const state = !data.quality?.passed ? "error" : data.quality?.warning ? "warning" : "passed";
  const statusLabel = state === "passed" ? "検証済み" : state === "warning" ? "要調整" : "検証失敗";
  $("#runStatus").dataset.state = state;
  text("#runStatus", statusLabel);
  text("#generatedAt", data.meta?.generatedAt ? new Date(data.meta.generatedAt).toLocaleString("ja-JP") : "—");
  text("#metricWorld", percentage(terminalRate, 0));
  text("#metricNpcs", formatNumber.format(number(world.coverage?.trackedNpcCount, data.sourceCounts?.npcs ?? 0)));
  text("#metricSkills", formatNumber.format(data.sourceCounts?.skills ?? 0));
  renderReplay(world, data.meta);
  renderEvidence(world, data.sourceCounts);
  const days = world.days ?? [];
  renderChart(days);
  const populationTicks = asArray(world.populationByTick).map(tickOf);
  const maximumTick = Math.max(number(data.meta?.days, 100) * 4 - 1, ...populationTicks);
  $("#tickSlider").max = String(Math.max(0, maximumTick));
  renderCrisisOutcomes(world.crisisOutcomes);
  renderMatrixDays();
  if (!selectedNpcId) selectedNpcId = String(npcIndex()[0]?.id ?? npcIndex()[0]?.npcId ?? "");
  renderNpcMatrix();
  renderTick(0);
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
    button.setAttribute("aria-label", "時刻を自動再生");
    return;
  }
  button.textContent = "Ⅱ";
  button.setAttribute("aria-label", "自動再生を停止");
  playback = setInterval(() => {
    const maximum = number($("#tickSlider").max, 399);
    renderTick(selectedTick >= maximum ? 0 : selectedTick + 1);
  }, 320);
}

$("#tickSlider").addEventListener("input", (event) => renderTick(number(event.currentTarget.value)));
$("#playButton").addEventListener("click", togglePlayback);
$("#npcSearch").addEventListener("input", renderNpcMatrix);
$("#npcStatusFilter").addEventListener("change", renderNpcMatrix);

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
