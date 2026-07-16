const DATA_URL = "/TRPG/data/skills.beta.json";

const elements = {
  loadStatus: document.querySelector("#loadStatus"),
  total: document.querySelector("#totalSkills"),
  enabled: document.querySelector("#enabledSkills"),
  runtimeReady: document.querySelector("#runtimeReady"),
  customHandlers: document.querySelector("#customHandlers"),
  search: document.querySelector("#skillSearch"),
  preview: document.querySelector("#skillPreview"),
};

let catalog = null;

function text(value) {
  return value == null ? "—" : String(value);
}

function renderSkill(skill) {
  if (!skill) {
    elements.preview.hidden = true;
    elements.preview.replaceChildren();
    return;
  }

  const title = document.createElement("h3");
  title.textContent = `${skill.name} / ${skill.id}`;

  const description = document.createElement("p");
  description.textContent = skill.description || "説明未設定";

  const acquisition = document.createElement("p");
  acquisition.innerHTML = `取得: <code>${skill.acquisition?.source || "—"}</code> / 必要Lv ${text(skill.acquisition?.requiredLevel)} / SP ${text(skill.acquisition?.spCost)}`;

  const commandNames = (skill.effects || []).map((effect) => effect.command).join(", ") || "NO_OP";
  const commands = document.createElement("p");
  commands.innerHTML = `共通命令: <code>${commandNames}</code>`;

  elements.preview.replaceChildren(title, description, acquisition, commands);
  elements.preview.hidden = false;
}

function findSkill(query) {
  if (!catalog || !query.trim()) return null;
  const normalized = query.trim().toLocaleLowerCase("ja");
  return catalog.skills.find((skill) =>
    skill.id.toLocaleLowerCase("ja") === normalized ||
    skill.name.toLocaleLowerCase("ja").includes(normalized)
  ) || null;
}

async function loadCatalog() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    catalog = await response.json();

    if (!Array.isArray(catalog.skills) || !catalog.runtime?.commands) {
      throw new Error("スキルカタログ形式が不正です");
    }

    elements.total.textContent = catalog.summary.total.toLocaleString("ja-JP");
    elements.enabled.textContent = catalog.summary.enabled.toLocaleString("ja-JP");
    elements.runtimeReady.textContent = (catalog.summary.implementation.runtime_ready || 0).toLocaleString("ja-JP");
    elements.customHandlers.textContent = (catalog.summary.implementation.custom_handler_required || 0).toLocaleString("ja-JP");
    elements.loadStatus.textContent = `schema ${catalog.schemaVersion} / catalog ${catalog.catalogVersion} を読み込みました。`;

    const encore = catalog.skills.find((skill) => skill.name === "アンコール");
    renderSkill(encore || catalog.skills.find((skill) => skill.enabled));
  } catch (error) {
    console.error("TRPG skill catalog load failed", error);
    elements.loadStatus.textContent = `読み込みに失敗しました: ${error.message}`;
    elements.loadStatus.classList.add("error");
  }
}

elements.search?.addEventListener("input", (event) => {
  const query = event.currentTarget.value;
  if (!query.trim()) return;
  renderSkill(findSkill(query));
});

loadCatalog();
