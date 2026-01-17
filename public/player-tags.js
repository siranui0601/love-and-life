// ===== アルバイト定義（7日目に職業を選ぶ。以後はシフト制で発生） =====
export const PARTTIME_JOBS = {
  "清掃バイト": {
    label: "清掃バイト",
    place: { name: "駅前", detail: "駅前ロータリーの清掃を手伝う。" },
    type: "daily",
    dailyPay: 1500,
    encounterPct: 80,
  },
  "パン屋バイト": {
    label: "パン屋バイト",
    place: { name: "商店街", detail: "商店街のパン屋で接客や品出しをする。" },
    type: "daily",
    dailyPay: 3000,
    encounterPct: 40,
  },
  "遠洋漁業バイト": {
    label: "遠洋漁業バイト",
    place: { name: "港", detail: "遠洋漁業の船に乗り込み、1週間の航海に出る。" },
    type: "weekly",
    weeklyPay: 50000,
    encounterPct: 0,
  },
  "闇バイト": {
    label: "闇バイト",
    place: { name: "路地裏", detail: "怪しい指示のもと、裏路地で短時間の作業をする。" },
    type: "dark",
    encounterPct: 25,
    payouts: [
      { label: "大成功", amount: 18000, weight: 15 },
      { label: "成功", amount: 8000, weight: 25 },
      { label: "まぁまぁ", amount: 4000, weight: 30 },
      { label: "微妙", amount: 1000, weight: 15 },
      { label: "失敗", amount: -3000, weight: 10 },
      { label: "大失敗", amount: -8000, weight: 5 },
    ],
  },
};

const JOB_TAG_DEFINITIONS = {
  cleaning: [
    {
      key: "cleaning_town_knowledge",
      name: "土地勘がある",
      detail: "この町の裏道や抜け道、相手の家の場所まで全部把握している",
    },
    {
      key: "cleaning_mysophilia",
      name: "ミソフィリア",
      detail: "清掃バイトをしてるうちに、汚れや散らかった空間が大好きになった",
    },
  ],
  bakery: [
    {
      key: "bakery_glutton",
      name: "飲食大好き",
      detail: "暴飲暴食が癖。食が行動原理の一部",
    },
    {
      key: "bakery_burn_scar",
      name: "顔半分に火傷跡",
      detail: "顔の片側に火傷跡があり、人の視線や距離感に敏感すぎる",
    },
  ],
  fishing: [
    {
      key: "fishing_strength",
      name: "力自慢",
      detail: "力自慢で無茶しがち。腹筋を見せたがる",
    },
    {
      key: "fishing_sleep_deprived",
      name: "超寝不足",
      detail: "常に眠く、思考が飛んだり情緒が不安定になりやすい",
    },
  ],
  dark: [
    {
      key: "dark_well_connected",
      name: "顔が広い",
      detail: "表も裏も知り合いが多く、怪しい話にもすぐ繋がる",
    },
    {
      key: "dark_dragon_tattoo",
      name: "龍の刺青",
      detail: "背中一面と右腕に龍の刺青があり、場面次第で周囲の空気を一気に変える存在感を持つ",
    },
  ],
};

const TAG_DETAILS_BY_KEY = Object.values(JOB_TAG_DEFINITIONS)
  .flat()
  .reduce((acc, tag) => {
    acc[tag.key] = { name: tag.name, detail: tag.detail };
    return acc;
  }, {});

function resolveJobTagPool(job = {}) {
  const label = job.label || "";
  if (label.includes("清掃")) return JOB_TAG_DEFINITIONS.cleaning;
  if (label.includes("パン屋")) return JOB_TAG_DEFINITIONS.bakery;
  if (label.includes("遠洋")) return JOB_TAG_DEFINITIONS.fishing;
  if (job.type === "dark" || label.includes("闇")) return JOB_TAG_DEFINITIONS.dark;
  return null;
}

function ensurePlayerTags(pawn) {
  if (!pawn?.userData) return [];
  if (!Array.isArray(pawn.userData.tags)) pawn.userData.tags = [];
  return pawn.userData.tags;
}

function getPlayerTagDetails(pawn) {
  const tags = ensurePlayerTags(pawn);
  return tags.map((key) => TAG_DETAILS_BY_KEY[key]).filter(Boolean);
}

export function buildPlayerTagBlock(pawn) {
  const details = getPlayerTagDetails(pawn);
  if (!details.length) return "";
  const lines = details.map((tag) => `- ${tag.name}: ${tag.detail}`).join("\n");
  return `\n【プレイヤーについて】\n${lines}`;
}

export function maybeAwardTag(pawn, job = {}) {
  const pool = resolveJobTagPool(job);
  if (!pool || pool.length === 0) return null;
  const owned = new Set(ensurePlayerTags(pawn));
  const available = pool.filter((tag) => !owned.has(tag.key));
  if (!available.length) return null;
  if (Math.random() >= 0.1) return null;
  const selected = available[Math.floor(Math.random() * available.length)];
  return { key: selected.key, name: selected.name, detail: selected.detail };
}

export function applyTagToPlayer(pawn, tagDetail) {
  if (!tagDetail?.key) return;
  const tags = ensurePlayerTags(pawn);
  if (!tags.includes(tagDetail.key)) {
    tags.push(tagDetail.key);
  }
}

export function formatTagName(tagKey) {
  return TAG_DETAILS_BY_KEY[tagKey]?.name || tagKey;
}
