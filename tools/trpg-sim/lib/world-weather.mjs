export const WORLD_WEATHER_VERSION = "trpg-weather-v1";

const REGION_CLIMATES = Object.freeze({
  "田園の村": "temperate_plain",
  "王都": "temperate_urban",
  "交易都市": "coastal",
  "犯罪都市": "coastal_urban",
  "辺境の村": "highland",
  "北陵要塞": "cold_highland",
  "ドワーフ洞窟": "underground",
  "エルフの隠れ里": "forest",
  "森": "forest",
  "古代神殿": "dry_ruins",
  "黒嶺連合領": "cold_forest",
});

const WEATHER_LABELS = Object.freeze({
  clear: "晴れ",
  fair: "薄晴れ",
  cloudy: "曇り",
  overcast: "厚い曇り",
  mist: "霧",
  drizzle: "小雨",
  rain: "雨",
  downpour: "強い雨",
  storm: "雷雨",
  snow: "雪",
  blizzard: "吹雪",
  dust: "乾いた風",
  cavern_damp: "湿った洞気",
  cavern_dry: "乾いた洞気",
});

const BASE_TEMPERATURE = Object.freeze({
  temperate_plain: 18,
  temperate_urban: 20,
  coastal: 19,
  coastal_urban: 21,
  highland: 13,
  cold_highland: 7,
  underground: 14,
  forest: 16,
  dry_ruins: 22,
  cold_forest: 9,
});

const PATTERNS = Object.freeze({
  temperate_plain: [
    ["mist", "fair", "clear", "cloudy"],
    ["cloudy", "drizzle", "rain", "cloudy"],
    ["clear", "clear", "fair", "clear"],
    ["fair", "cloudy", "drizzle", "overcast"],
    ["cloudy", "rain", "downpour", "drizzle"],
  ],
  temperate_urban: [
    ["mist", "fair", "clear", "cloudy"],
    ["cloudy", "drizzle", "rain", "overcast"],
    ["clear", "fair", "fair", "clear"],
    ["overcast", "cloudy", "drizzle", "cloudy"],
    ["cloudy", "rain", "storm", "rain"],
  ],
  coastal: [
    ["mist", "cloudy", "fair", "cloudy"],
    ["drizzle", "rain", "downpour", "rain"],
    ["clear", "fair", "cloudy", "mist"],
    ["cloudy", "rain", "storm", "downpour"],
    ["fair", "clear", "fair", "cloudy"],
  ],
  coastal_urban: [
    ["mist", "cloudy", "fair", "cloudy"],
    ["drizzle", "rain", "storm", "rain"],
    ["clear", "fair", "cloudy", "mist"],
    ["overcast", "downpour", "rain", "cloudy"],
    ["fair", "clear", "fair", "cloudy"],
  ],
  highland: [
    ["mist", "fair", "cloudy", "mist"],
    ["cloudy", "rain", "downpour", "cloudy"],
    ["clear", "fair", "clear", "clear"],
    ["overcast", "drizzle", "rain", "mist"],
    ["cloudy", "storm", "rain", "overcast"],
  ],
  cold_highland: [
    ["mist", "cloudy", "fair", "cloudy"],
    ["cloudy", "snow", "snow", "overcast"],
    ["clear", "fair", "cloudy", "clear"],
    ["overcast", "snow", "blizzard", "snow"],
    ["cloudy", "drizzle", "rain", "cloudy"],
  ],
  underground: [
    ["cavern_damp", "cavern_dry", "cavern_dry", "cavern_damp"],
    ["cavern_damp", "cavern_damp", "cavern_dry", "cavern_damp"],
  ],
  forest: [
    ["mist", "cloudy", "fair", "mist"],
    ["drizzle", "rain", "rain", "drizzle"],
    ["mist", "fair", "cloudy", "mist"],
    ["cloudy", "downpour", "storm", "rain"],
    ["clear", "fair", "cloudy", "mist"],
  ],
  dry_ruins: [
    ["clear", "clear", "fair", "clear"],
    ["dust", "fair", "clear", "dust"],
    ["cloudy", "fair", "clear", "cloudy"],
    ["clear", "dust", "dust", "clear"],
  ],
  cold_forest: [
    ["mist", "cloudy", "fair", "mist"],
    ["cloudy", "snow", "snow", "overcast"],
    ["mist", "drizzle", "rain", "mist"],
    ["overcast", "snow", "blizzard", "snow"],
    ["clear", "fair", "cloudy", "mist"],
  ],
});

function fnv1a32(text) {
  let value = 0x811c9dc5;
  for (const character of String(text)) {
    value ^= character.codePointAt(0);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

function weatherBlock(hour) {
  const value = Number(hour ?? 0);
  if (value >= 5 && value < 9) return { index: 0, id: "morning", label: "朝" };
  if (value >= 9 && value < 17) return { index: 1, id: "day", label: "昼" };
  if (value >= 17 && value < 21) return { index: 2, id: "evening", label: "夕方" };
  return { index: 3, id: "night", label: "夜" };
}

function weatherDescription(id, location, blockLabel) {
  const place = location || "この地域";
  return {
    clear: `${place}の${blockLabel}はよく晴れ、遠くまで見通せる。`,
    fair: `${place}の${blockLabel}は薄い雲が流れ、穏やかな明るさがある。`,
    cloudy: `${place}の${blockLabel}は雲が広がり、陽射しが弱い。`,
    overcast: `${place}の${blockLabel}は厚い雲に覆われ、雨の気配が近い。`,
    mist: `${place}の${blockLabel}は霧が低く漂い、離れたものの輪郭がぼやける。`,
    drizzle: `${place}の${blockLabel}は細かな雨が続き、道や衣服を静かに濡らす。`,
    rain: `${place}の${blockLabel}は雨が降り、足元と視界に注意が要る。`,
    downpour: `${place}の${blockLabel}は強い雨で、道を行く人も足を急がせている。`,
    storm: `${place}の${blockLabel}は雷を伴う荒天で、屋外の移動には危険がある。`,
    snow: `${place}の${blockLabel}は雪が降り、道と屋根が白くなり始めている。`,
    blizzard: `${place}の${blockLabel}は吹雪で、視界と体温を奪われやすい。`,
    dust: `${place}の${blockLabel}は乾いた風が砂埃を巻き上げている。`,
    cavern_damp: `${place}には湿った冷気がこもり、岩肌から水滴が落ちている。`,
    cavern_dry: `${place}の洞気は乾き、遠くの音が硬く反響している。`,
  }[id] ?? `${place}の天候は変わりつつある。`;
}

function intensity(id) {
  if (["storm", "blizzard"].includes(id)) return 3;
  if (["downpour", "rain", "snow"].includes(id)) return 2;
  if (["drizzle", "mist", "dust", "overcast", "cavern_damp"].includes(id)) return 1;
  return 0;
}

export function deterministicWeather({ day = 1, hour = 10, location = "田園の村" } = {}) {
  const normalizedDay = Math.max(1, Math.min(100, Math.floor(Number(day) || 1)));
  const climate = REGION_CLIMATES[location] ?? "temperate_plain";
  const patterns = PATTERNS[climate] ?? PATTERNS.temperate_plain;
  const patternIndex = fnv1a32(`${WORLD_WEATHER_VERSION}|${location}|${normalizedDay}`) % patterns.length;
  const block = weatherBlock(hour);
  const id = patterns[patternIndex][block.index] ?? patterns[patternIndex][0] ?? "clear";
  const dayVariation = (fnv1a32(`${WORLD_WEATHER_VERSION}|temperature|${location}|${normalizedDay}`) % 9) - 4;
  const blockVariation = [-3, 2, 0, -4][block.index] ?? 0;
  const temperatureC = Math.round((BASE_TEMPERATURE[climate] ?? 18) + dayVariation + blockVariation);
  const level = intensity(id);
  return {
    version: WORLD_WEATHER_VERSION,
    id,
    label: WEATHER_LABELS[id] ?? id,
    climate,
    block: block.id,
    blockLabel: block.label,
    intensity: level,
    temperatureC,
    tags: [id, climate, block.id, ...(level >= 2 ? ["bad_weather"] : []), ...(block.id === "night" ? ["night"] : [])],
    description: weatherDescription(id, location, block.label),
  };
}
