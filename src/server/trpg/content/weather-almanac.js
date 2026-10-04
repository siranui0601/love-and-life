/**
 * 天候年鑑 ｜ Day1（8/1）〜 Day100（11/8）の全地域・全日。
 *
 * **これはデータである。**確率でも、シードから引く籤でもない。
 * ある地域のある日の空は、誰が何周目に歩いても同じで、ここに書いてある通りになる。
 * 直したい日があれば、この表のその行を書き換える。それが唯一の直し方である。
 *
 * ## 一日の書き方
 *
 *   "clear"                    00:00 から一日中 晴れ
 *   "cloudy;15=rain"           曇り。**15:00 から雨**
 *   "fog;08=clear"             朝霧。08:00 に晴れる
 *   "cloudy;13=storm;19=rain;22=cloudy"   曇り→13:00 雷雨→19:00 雨→22:00 曇り
 *
 * 区切りは 00:00 から始まり、次の区切りまで同じ天気が続く。
 * 時刻は必ず増え、隣り合う区切りは必ず違う天気になる（weather-resolver.test.mjs が検算する）。
 * 天気IDは weather-resolver.js の WEATHER_DEFINITIONS にあるものだけを使う。
 *
 * ## 組み立てた時の考え方（書き換える時の指針）
 *
 * - **季節。**Day1〜22 盛夏／Day23〜45 晩夏／Day46〜70 秋／Day71〜100 晩秋。
 *   盛夏の内陸には夕立があり、晩秋の北陵要塞は雪が主になる。
 * - **地域性。**田園の村と辺境の村は晴れが多い。森とエルフの隠れ里は朝霧。
 *   交易都市は海風。犯罪都市は霧雨と曇り。魔王領は砂の風。北陵要塞は晩秋が雪。
 * - **天気は移動する。**同じ日は全土でおおむね同じ気圧配置を受けるが、
 *   雨の来る時刻が土地ごとにずれる。交易都市が一番早く、魔王領が一番遅い。
 *   だから「王都で昼から降った日は、森では夕方から降る」。
 * - **同じ日型でも時刻が違う。**「14:00から雨」と「16:00から雨」は別の一日である。
 *
 * 各行の末尾のコメントは日型の名前で、読むためのものである。判定には使わない。
 */

export const WEATHER_ALMANAC_VERSION = "canonical-weather-almanac-v2";

/** 地域 → Day1..Day100 の一日パターン（配列の添字 0 が Day1）。 */
export const WEATHER_ALMANAC = Object.freeze({
  "田園の村": Object.freeze([
    /* Day  1〜  5 */ "clear", "clear", "clear;16=cloudy;19=clear", "clear;15=cloudy;19=clear", "clear;17=storm;20=cloudy",  // 快晴・快晴・晴時々曇・晴時々曇・夕立
    /* Day  6〜 10 */ "clear", "clear", "clear;19=storm;20=cloudy", "cloudy;15=light_rain;18=cloudy", "cloudy;09=clear",  // 快晴・快晴・夕立・一時雨・曇のち晴
    /* Day 11〜 15 */ "clear;18=storm;19=cloudy", "clear;15=storm;20=cloudy", "clear;17=cloudy", "clear", "clear;14=cloudy",  // 夕立・夕立・晴のち曇・快晴・晴のち曇
    /* Day 16〜 20 */ "clear", "clear;17=storm;18=cloudy", "cloudy;15=rain;20=cloudy", "clear", "clear",  // 快晴・夕立・昼から雨・快晴・快晴
    /* Day 21〜 25 */ "clear", "clear;13=cloudy;18=clear", "cloudy;17=rain;22=cloudy", "clear", "cloudy;14=light_rain;18=cloudy",  // 快晴・晴時々曇・昼から雨・快晴・一時雨
    /* Day 26〜 30 */ "cloudy", "clear;18=storm;20=cloudy", "clear", "clear;14=strong_wind;22=clear", "clear;16=cloudy",  // 曇・夕立・快晴・風の日・晴のち曇
    /* Day 31〜 35 */ "cloudy;09=clear", "cloudy;16=light_rain;17=cloudy", "cloudy;13=light_rain;17=cloudy", "clear", "clear;13=cloudy",  // 曇のち晴・一時雨・一時雨・快晴・晴のち曇
    /* Day 36〜 40 */ "cloudy;10=clear", "cloudy;13=clear", "clear;13=cloudy;18=clear", "cloudy;15=light_rain;19=cloudy", "clear;14=strong_wind;21=clear",  // 曇のち晴・曇のち晴・晴時々曇・一時雨・風の日
    /* Day 41〜 45 */ "clear", "clear;17=cloudy", "cloudy;15=light_rain;19=cloudy", "clear", "clear;16=cloudy;20=clear",  // 快晴・晴のち曇・一時雨・快晴・晴時々曇
    /* Day 46〜 50 */ "clear;16=cloudy", "cloudy;14=light_rain;17=cloudy", "rain", "cloudy;20=fog", "clear;17=cloudy",  // 晴のち曇・一時雨・雨・夕霧・晴のち曇
    /* Day 51〜 55 */ "clear;13=cloudy;20=clear", "cloudy;14=light_rain;17=cloudy", "clear;10=strong_wind;19=clear", "clear;17=cloudy", "clear;17=cloudy",  // 晴時々曇・一時雨・風の日・晴のち曇・晴のち曇
    /* Day 56〜 60 */ "clear", "clear", "cloudy;16=light_rain;19=cloudy", "clear;14=strong_wind;20=clear", "clear",  // 快晴・快晴・一時雨・風の日・快晴
    /* Day 61〜 65 */ "cloudy;17=rain;23=cloudy", "clear;14=cloudy", "cloudy;14=light_rain;18=cloudy", "clear;16=cloudy", "cloudy",  // 昼から雨・晴のち曇・一時雨・晴のち曇・曇
    /* Day 66〜 70 */ "cloudy;15=light_rain;17=cloudy", "cloudy;14=light_rain;20=cloudy", "clear", "clear;13=cloudy;18=clear", "cloudy;19=fog",  // 一時雨・一時雨・快晴・晴時々曇・夕霧
    /* Day 71〜 75 */ "clear", "light_rain;14=cloudy", "cloudy;16=rain;23=cloudy", "cloudy;13=light_rain;18=cloudy", "light_rain;14=cloudy",  // 快晴・霧雨・昼から雨・一時雨・霧雨
    /* Day 76〜 80 */ "light_rain;18=cloudy", "rain", "fog;08=clear", "cloudy", "clear;12=cloudy;16=clear",  // 霧雨・雨・朝霧のち晴・曇・晴時々曇
    /* Day 81〜 85 */ "clear", "light_rain;14=cloudy", "cloudy;14=light_rain;19=cloudy", "cloudy", "cloudy",  // 快晴・霧雨・一時雨・曇・曇
    /* Day 86〜 90 */ "clear", "clear;10=strong_wind;18=clear", "cloudy", "cloudy;13=rain;23=cloudy", "clear;13=cloudy;18=clear",  // 快晴・風の日・曇・昼から雨・晴時々曇
    /* Day 91〜 95 */ "fog;07=clear", "light_rain;15=cloudy", "rain", "clear;10=strong_wind;18=clear", "rain",  // 朝霧のち晴・霧雨・雨・風の日・雨
    /* Day 96〜100 */ "clear;13=cloudy;18=clear", "cloudy;14=light_rain;19=cloudy", "cloudy;17=fog", "light_rain;14=cloudy", "clear;12=strong_wind;20=clear",  // 晴時々曇・一時雨・夕霧・霧雨・風の日
  ]),
  "王都": Object.freeze([
    /* Day  1〜  5 */ "clear;10=strong_wind;21=clear", "cloudy", "cloudy;12=clear", "cloudy;12=clear", "cloudy;16=rain;22=cloudy",  // 風の日・曇・曇のち晴・曇のち晴・昼から雨
    /* Day  6〜 10 */ "clear;12=cloudy", "clear;14=cloudy;19=clear", "clear;14=cloudy;17=clear", "cloudy", "clear;16=storm;18=cloudy",  // 晴のち曇・晴時々曇・晴時々曇・曇・夕立
    /* Day 11〜 15 */ "clear;13=cloudy", "cloudy;13=rain;20=cloudy", "clear", "cloudy", "clear;10=strong_wind;18=clear",  // 晴のち曇・昼から雨・快晴・曇・風の日
    /* Day 16〜 20 */ "clear", "clear;13=strong_wind;19=clear", "clear;17=storm;18=cloudy", "clear", "cloudy;09=clear",  // 快晴・風の日・夕立・快晴・曇のち晴
    /* Day 21〜 25 */ "clear;15=storm;16=cloudy", "cloudy;13=rain;23=cloudy", "clear;15=cloudy", "clear", "cloudy",  // 夕立・昼から雨・晴のち曇・快晴・曇
    /* Day 26〜 30 */ "rain", "cloudy;14=rain;22=cloudy", "clear", "cloudy;11=clear", "clear;16=cloudy",  // 雨・昼から雨・快晴・曇のち晴・晴のち曇
    /* Day 31〜 35 */ "clear;15=cloudy;18=clear", "rain", "cloudy;11=light_rain;19=cloudy", "cloudy", "clear",  // 晴時々曇・雨・一時雨・曇・快晴
    /* Day 36〜 40 */ "cloudy;11=clear", "clear;11=strong_wind;20=clear", "cloudy;15=light_rain;16=cloudy", "cloudy;15=light_rain;18=cloudy", "cloudy",  // 曇のち晴・風の日・一時雨・一時雨・曇
    /* Day 41〜 45 */ "clear", "clear;14=cloudy;18=clear", "cloudy", "cloudy;12=rain;21=cloudy", "cloudy",  // 快晴・晴時々曇・曇・昼から雨・曇
    /* Day 46〜 50 */ "cloudy;12=light_rain;15=cloudy", "cloudy;16=rain;20=cloudy", "cloudy;09=clear", "cloudy;18=fog", "clear;15=cloudy;19=clear",  // 一時雨・昼から雨・曇のち晴・夕霧・晴時々曇
    /* Day 51〜 55 */ "cloudy;16=rain;19=cloudy", "cloudy;14=rain;22=cloudy", "clear", "clear;13=strong_wind;17=clear", "clear",  // 昼から雨・昼から雨・快晴・風の日・快晴
    /* Day 56〜 60 */ "rain", "cloudy;18=fog", "rain", "cloudy", "clear;15=cloudy;17=clear",  // 雨・夕霧・雨・曇・晴時々曇
    /* Day 61〜 65 */ "cloudy;11=clear", "clear", "cloudy;16=rain;22=cloudy", "clear", "clear;12=cloudy;19=clear",  // 曇のち晴・快晴・昼から雨・快晴・晴時々曇
    /* Day 66〜 70 */ "clear;16=cloudy", "cloudy;15=rain;19=cloudy", "clear", "clear;11=cloudy;16=clear", "cloudy;11=light_rain;18=cloudy",  // 晴のち曇・昼から雨・快晴・晴時々曇・一時雨
    /* Day 71〜 75 */ "clear;15=cloudy;19=clear", "rain", "cloudy", "clear", "cloudy;09=clear",  // 晴時々曇・雨・曇・快晴・曇のち晴
    /* Day 76〜 80 */ "clear", "cloudy", "light_rain;13=cloudy", "clear;12=cloudy;15=clear", "cloudy",  // 快晴・曇・霧雨・晴時々曇・曇
    /* Day 81〜 85 */ "cloudy;12=rain;19=cloudy", "light_rain;17=cloudy", "clear", "cloudy;11=light_rain;17=cloudy", "cloudy;20=fog",  // 昼から雨・霧雨・快晴・一時雨・夕霧
    /* Day 86〜 90 */ "cloudy;13=light_rain;15=cloudy", "cloudy;18=fog", "cloudy;12=light_rain;17=cloudy", "rain", "cloudy;15=light_rain;16=cloudy",  // 一時雨・夕霧・一時雨・雨・一時雨
    /* Day 91〜 95 */ "cloudy", "light_rain;17=cloudy", "cloudy;11=light_rain;17=cloudy", "cloudy", "rain",  // 曇・霧雨・一時雨・曇・雨
    /* Day 96〜100 */ "cloudy;09=clear", "cloudy;17=fog", "clear;13=cloudy;15=clear", "cloudy", "cloudy;10=clear",  // 曇のち晴・夕霧・晴時々曇・曇・曇のち晴
  ]),
  "森": Object.freeze([
    /* Day  1〜  5 */ "cloudy;16=light_rain;21=cloudy", "cloudy;18=rain;23=cloudy", "fog;12=clear", "fog;10=cloudy", "clear;17=storm;19=cloudy",  // 一時雨・昼から雨・朝霧のち晴・朝霧のち曇・夕立
    /* Day  6〜 10 */ "clear;17=cloudy;20=clear", "cloudy;11=clear", "cloudy;13=clear", "rain", "clear;18=storm;21=cloudy",  // 晴時々曇・曇のち晴・曇のち晴・雨・夕立
    /* Day 11〜 15 */ "cloudy;17=rain;22=cloudy", "cloudy", "cloudy;11=clear", "cloudy;14=clear", "cloudy;13=clear",  // 昼から雨・曇・曇のち晴・曇のち晴・曇のち晴
    /* Day 16〜 20 */ "fog;13=cloudy", "cloudy", "cloudy;13=light_rain;21=cloudy", "cloudy", "fog;09=clear",  // 朝霧のち曇・曇・一時雨・曇・朝霧のち晴
    /* Day 21〜 25 */ "cloudy;15=rain;21=cloudy", "clear;16=storm;21=cloudy", "clear;17=storm;19=cloudy", "fog;10=cloudy", "fog;08=clear",  // 昼から雨・夕立・夕立・朝霧のち曇・朝霧のち晴
    /* Day 26〜 30 */ "cloudy;16=rain;22=cloudy", "clear;20=storm;21=cloudy", "fog;12=clear", "fog;11=clear", "rain",  // 昼から雨・夕立・朝霧のち晴・朝霧のち晴・雨
    /* Day 31〜 35 */ "fog;13=cloudy", "cloudy;10=clear", "cloudy;14=light_rain;17=cloudy", "fog;10=clear", "fog;13=cloudy",  // 朝霧のち曇・曇のち晴・一時雨・朝霧のち晴・朝霧のち曇
    /* Day 36〜 40 */ "clear;18=storm;21=cloudy", "rain", "rain", "cloudy;16=light_rain;20=cloudy", "fog;11=cloudy",  // 夕立・雨・雨・一時雨・朝霧のち曇
    /* Day 41〜 45 */ "clear;17=cloudy;20=clear", "cloudy", "cloudy;14=rain;23=cloudy", "cloudy", "cloudy;11=clear",  // 晴時々曇・曇・昼から雨・曇・曇のち晴
    /* Day 46〜 50 */ "cloudy;17=light_rain;19=cloudy", "cloudy", "fog;09=clear", "cloudy;13=light_rain;21=cloudy", "cloudy;18=fog",  // 一時雨・曇・朝霧のち晴・一時雨・夕霧
    /* Day 51〜 55 */ "fog;11=cloudy", "cloudy;14=light_rain;20=cloudy", "rain", "cloudy;14=light_rain;20=cloudy", "cloudy;14=light_rain;21=cloudy",  // 朝霧のち曇・一時雨・雨・一時雨・一時雨
    /* Day 56〜 60 */ "rain", "fog;12=cloudy", "cloudy;17=rain;23=cloudy", "cloudy;21=fog", "light_rain;19=cloudy",  // 雨・朝霧のち曇・昼から雨・夕霧・霧雨
    /* Day 61〜 65 */ "cloudy;17=light_rain;19=cloudy", "fog;11=clear", "rain", "fog;13=cloudy", "cloudy;14=light_rain;17=cloudy",  // 一時雨・朝霧のち晴・雨・朝霧のち曇・一時雨
    /* Day 66〜 70 */ "fog;12=clear", "fog;10=cloudy", "fog;11=cloudy", "fog;12=cloudy", "rain",  // 朝霧のち晴・朝霧のち曇・朝霧のち曇・朝霧のち曇・雨
    /* Day 71〜 75 */ "cloudy;14=light_rain;19=cloudy", "cloudy;15=light_rain;17=cloudy", "rain", "fog;12=cloudy", "fog;10=cloudy",  // 一時雨・一時雨・雨・朝霧のち曇・朝霧のち曇
    /* Day 76〜 80 */ "cloudy;16=rain;23=cloudy", "rain", "fog;12=cloudy", "cloudy;18=rain;21=cloudy", "fog;12=cloudy",  // 昼から雨・雨・朝霧のち曇・昼から雨・朝霧のち曇
    /* Day 81〜 85 */ "fog;10=clear", "light_rain;17=cloudy", "light_rain;17=cloudy", "light_rain;16=cloudy", "rain",  // 朝霧のち晴・霧雨・霧雨・霧雨・雨
    /* Day 86〜 90 */ "fog;08=clear", "fog;09=clear", "cloudy;15=light_rain;20=cloudy", "fog;12=cloudy", "cloudy;22=fog",  // 朝霧のち晴・朝霧のち晴・一時雨・朝霧のち曇・夕霧
    /* Day 91〜 95 */ "cloudy;18=fog", "rain", "fog;10=cloudy", "fog;12=cloudy", "fog;11=cloudy",  // 夕霧・雨・朝霧のち曇・朝霧のち曇・朝霧のち曇
    /* Day 96〜100 */ "cloudy", "rain", "cloudy", "fog;09=clear", "cloudy",  // 曇・雨・曇・朝霧のち晴・曇
  ]),
  "エルフの隠れ里": Object.freeze([
    /* Day  1〜  5 */ "fog;09=clear", "cloudy;11=clear", "clear;13=cloudy;18=clear", "fog;10=cloudy", "rain",  // 朝霧のち晴・曇のち晴・晴時々曇・朝霧のち曇・雨
    /* Day  6〜 10 */ "fog;10=cloudy", "cloudy;16=light_rain;18=cloudy", "cloudy;13=clear", "rain", "cloudy;13=light_rain;21=cloudy",  // 朝霧のち曇・一時雨・曇のち晴・雨・一時雨
    /* Day 11〜 15 */ "clear;14=cloudy;19=clear", "clear;18=storm;19=cloudy", "clear;16=cloudy;20=clear", "fog;09=clear", "clear;20=storm;21=cloudy",  // 晴時々曇・夕立・晴時々曇・朝霧のち晴・夕立
    /* Day 16〜 20 */ "cloudy;11=clear", "clear;19=storm;20=cloudy", "fog;10=clear", "fog;08=clear", "fog;12=clear",  // 曇のち晴・夕立・朝霧のち晴・朝霧のち晴・朝霧のち晴
    /* Day 21〜 25 */ "clear;16=storm;20=cloudy", "clear;18=storm;22=cloudy", "cloudy;14=light_rain;18=cloudy", "cloudy", "fog;09=cloudy",  // 夕立・夕立・一時雨・曇・朝霧のち曇
    /* Day 26〜 30 */ "cloudy;16=rain;23=cloudy", "clear;17=storm;18=cloudy", "fog;12=cloudy", "fog;09=clear", "fog;12=cloudy",  // 昼から雨・夕立・朝霧のち曇・朝霧のち晴・朝霧のち曇
    /* Day 31〜 35 */ "fog;09=clear", "cloudy;10=clear", "cloudy;17=light_rain;21=cloudy", "cloudy;12=clear", "fog;10=cloudy",  // 朝霧のち晴・曇のち晴・一時雨・曇のち晴・朝霧のち曇
    /* Day 36〜 40 */ "cloudy", "cloudy;14=rain;21=cloudy", "cloudy;13=light_rain;19=cloudy", "cloudy;17=light_rain;19=cloudy", "fog;10=clear",  // 曇・昼から雨・一時雨・一時雨・朝霧のち晴
    /* Day 41〜 45 */ "clear;15=cloudy;19=clear", "fog;12=clear", "cloudy;12=clear", "rain", "clear;13=cloudy;18=clear",  // 晴時々曇・朝霧のち晴・曇のち晴・雨・晴時々曇
    /* Day 46〜 50 */ "fog;09=cloudy", "cloudy;18=fog", "light_rain;19=cloudy", "light_rain;18=cloudy", "fog;08=clear",  // 朝霧のち曇・夕霧・霧雨・霧雨・朝霧のち晴
    /* Day 51〜 55 */ "cloudy;21=fog", "cloudy;15=rain;23=cloudy", "cloudy;14=rain;23=cloudy", "cloudy", "cloudy",  // 夕霧・昼から雨・昼から雨・曇・曇
    /* Day 56〜 60 */ "light_rain;15=cloudy", "cloudy;17=rain;23=cloudy", "cloudy;21=fog", "cloudy;10=clear", "cloudy",  // 霧雨・昼から雨・夕霧・曇のち晴・曇
    /* Day 61〜 65 */ "cloudy;17=light_rain;18=cloudy", "cloudy;14=clear", "fog;09=cloudy", "fog;11=cloudy", "rain",  // 一時雨・曇のち晴・朝霧のち曇・朝霧のち曇・雨
    /* Day 66〜 70 */ "cloudy;11=clear", "fog;11=clear", "fog;09=cloudy", "fog;12=clear", "cloudy",  // 曇のち晴・朝霧のち晴・朝霧のち曇・朝霧のち晴・曇
    /* Day 71〜 75 */ "cloudy;16=light_rain;18=cloudy", "fog;10=cloudy", "rain", "cloudy", "fog;11=cloudy",  // 一時雨・朝霧のち曇・雨・曇・朝霧のち曇
    /* Day 76〜 80 */ "cloudy;19=fog", "cloudy", "cloudy;22=fog", "fog;09=cloudy", "fog;13=cloudy",  // 夕霧・曇・夕霧・朝霧のち曇・朝霧のち曇
    /* Day 81〜 85 */ "light_rain;16=cloudy", "fog;09=cloudy", "fog;09=clear", "cloudy;14=light_rain;20=cloudy", "fog;10=clear",  // 霧雨・朝霧のち曇・朝霧のち晴・一時雨・朝霧のち晴
    /* Day 86〜 90 */ "rain", "cloudy", "cloudy;19=fog", "cloudy;15=rain;21=cloudy", "cloudy",  // 雨・曇・夕霧・昼から雨・曇
    /* Day 91〜 95 */ "fog;10=cloudy", "fog;13=cloudy", "fog;08=clear", "rain", "cloudy;18=fog",  // 朝霧のち曇・朝霧のち曇・朝霧のち晴・雨・夕霧
    /* Day 96〜100 */ "fog;09=cloudy", "cloudy", "fog;11=clear", "fog;12=cloudy", "fog;09=clear",  // 朝霧のち曇・曇・朝霧のち晴・朝霧のち曇・朝霧のち晴
  ]),
  "交易都市": Object.freeze([
    /* Day  1〜  5 */ "clear;08=cloudy;14=clear", "clear;12=cloudy;14=clear", "cloudy;06=strong_wind;17=cloudy", "cloudy;12=storm;15=rain;19=cloudy", "cloudy;13=rain;20=cloudy",  // 晴時々曇・晴時々曇・海風・雷雨・昼から雨
    /* Day  6〜 10 */ "clear", "cloudy;06=strong_wind;16=cloudy", "cloudy;10=storm;14=rain;19=cloudy", "cloudy;05=strong_wind;14=cloudy", "cloudy;07=strong_wind;15=cloudy",  // 快晴・海風・雷雨・海風・海風
    /* Day 11〜 15 */ "cloudy;08=strong_wind;14=cloudy", "cloudy;05=strong_wind;16=cloudy", "cloudy;07=strong_wind;14=cloudy", "clear", "clear;06=strong_wind;16=clear",  // 海風・海風・海風・快晴・風の日
    /* Day 16〜 20 */ "clear", "cloudy;05=strong_wind;16=cloudy", "clear", "cloudy;06=clear", "clear;10=cloudy;13=clear",  // 快晴・海風・快晴・曇のち晴・晴時々曇
    /* Day 21〜 25 */ "clear", "cloudy;10=light_rain;12=cloudy", "cloudy", "clear;08=cloudy;14=clear", "cloudy;06=clear",  // 快晴・一時雨・曇・晴時々曇・曇のち晴
    /* Day 26〜 30 */ "cloudy;08=light_rain;16=cloudy", "cloudy;10=rain;18=cloudy", "cloudy;09=strong_wind;17=cloudy", "clear", "cloudy",  // 一時雨・昼から雨・海風・快晴・曇
    /* Day 31〜 35 */ "clear", "cloudy;09=rain;20=cloudy", "rain", "cloudy;07=strong_wind;16=cloudy", "cloudy;06=strong_wind;16=cloudy",  // 快晴・昼から雨・雨・海風・海風
    /* Day 36〜 40 */ "cloudy;08=strong_wind;13=cloudy", "cloudy;09=storm;16=rain;17=cloudy", "cloudy;12=rain;19=cloudy", "cloudy;13=rain;19=cloudy", "clear",  // 海風・雷雨・昼から雨・昼から雨・快晴
    /* Day 41〜 45 */ "clear", "clear", "cloudy;11=storm;18=rain;19=cloudy", "clear;06=strong_wind;15=clear", "cloudy;06=strong_wind;15=cloudy",  // 快晴・快晴・雷雨・風の日・海風
    /* Day 46〜 50 */ "cloudy;11=light_rain;14=cloudy", "cloudy;09=strong_wind;13=cloudy", "clear;06=strong_wind;16=clear", "cloudy;10=rain;16=cloudy", "cloudy;08=strong_wind;16=cloudy",  // 一時雨・海風・風の日・昼から雨・海風
    /* Day 51〜 55 */ "cloudy", "rain", "cloudy;12=storm;18=rain;19=cloudy", "clear;08=strong_wind;14=clear", "clear",  // 曇・雨・雷雨・風の日・快晴
    /* Day 56〜 60 */ "cloudy;12=rain;19=cloudy", "cloudy;10=rain;16=cloudy", "cloudy;09=strong_wind;16=cloudy", "cloudy;07=strong_wind;14=cloudy", "cloudy;09=strong_wind;15=cloudy",  // 昼から雨・昼から雨・海風・海風・海風
    /* Day 61〜 65 */ "clear;10=cloudy;13=clear", "cloudy;11=light_rain;12=cloudy", "cloudy;05=strong_wind;13=cloudy", "cloudy;12=rain;18=cloudy", "cloudy;09=storm;15=rain;20=cloudy",  // 晴時々曇・一時雨・海風・昼から雨・雷雨
    /* Day 66〜 70 */ "clear;12=cloudy;14=clear", "cloudy;11=storm;16=rain;21=cloudy", "cloudy;05=strong_wind;15=cloudy", "clear;10=cloudy;15=clear", "rain",  // 晴時々曇・雷雨・海風・晴時々曇・雨
    /* Day 71〜 75 */ "cloudy;08=strong_wind;14=cloudy", "cloudy;09=strong_wind;17=cloudy", "cloudy;09=rain;19=cloudy", "cloudy;07=strong_wind;15=cloudy", "rain",  // 海風・海風・昼から雨・海風・雨
    /* Day 76〜 80 */ "cloudy", "cloudy;12=rain;16=cloudy", "cloudy", "cloudy;13=rain;17=cloudy", "clear;07=strong_wind;18=clear",  // 曇・昼から雨・曇・昼から雨・風の日
    /* Day 81〜 85 */ "cloudy", "rain", "cloudy;07=strong_wind;16=cloudy", "rain", "light_rain;14=cloudy",  // 曇・雨・海風・雨・霧雨
    /* Day 86〜 90 */ "cloudy;12=light_rain;16=cloudy", "cloudy;11=light_rain;13=cloudy", "clear;12=cloudy;14=clear", "rain", "light_rain;11=cloudy",  // 一時雨・一時雨・晴時々曇・雨・霧雨
    /* Day 91〜 95 */ "clear;07=strong_wind;14=clear", "cloudy;13=rain;18=cloudy", "cloudy;10=light_rain;14=cloudy", "cloudy;09=strong_wind;13=cloudy", "cloudy;10=light_rain;15=cloudy",  // 風の日・昼から雨・一時雨・海風・一時雨
    /* Day 96〜100 */ "clear;06=strong_wind;17=clear", "cloudy;13=rain;16=cloudy", "cloudy;09=strong_wind;15=cloudy", "rain", "cloudy;09=strong_wind;16=cloudy",  // 風の日・昼から雨・海風・雨・海風
  ]),
  "犯罪都市": Object.freeze([
    /* Day  1〜  5 */ "cloudy;11=light_rain;16=cloudy", "cloudy", "cloudy;18=fog", "clear;12=cloudy", "cloudy;13=light_rain;17=cloudy",  // 一時雨・曇・夕霧・晴のち曇・一時雨
    /* Day  6〜 10 */ "cloudy", "clear;12=cloudy;15=clear", "clear", "cloudy;10=light_rain;14=cloudy", "cloudy;13=light_rain;15=cloudy",  // 曇・晴時々曇・快晴・一時雨・一時雨
    /* Day 11〜 15 */ "clear;16=storm;18=cloudy", "cloudy", "clear;13=cloudy", "clear;13=cloudy;14=clear", "clear;10=cloudy",  // 夕立・曇・晴のち曇・晴時々曇・晴のち曇
    /* Day 16〜 20 */ "clear;12=cloudy", "clear;16=storm;17=cloudy", "cloudy", "clear;11=cloudy", "clear;13=cloudy",  // 晴のち曇・夕立・曇・晴のち曇・晴のち曇
    /* Day 21〜 25 */ "clear", "cloudy", "light_rain;11=cloudy", "cloudy", "light_rain;14=cloudy",  // 快晴・曇・霧雨・曇・霧雨
    /* Day 26〜 30 */ "cloudy", "rain", "clear;11=cloudy;14=clear", "clear", "light_rain;12=cloudy",  // 曇・雨・晴時々曇・快晴・霧雨
    /* Day 31〜 35 */ "clear;12=cloudy;14=clear", "clear", "cloudy;12=light_rain;15=cloudy", "clear", "cloudy",  // 晴時々曇・快晴・一時雨・快晴・曇
    /* Day 36〜 40 */ "clear", "cloudy", "cloudy;13=rain;17=cloudy", "cloudy", "cloudy",  // 快晴・曇・昼から雨・曇・曇
    /* Day 41〜 45 */ "cloudy;12=light_rain;13=cloudy", "cloudy", "clear", "cloudy;14=rain;21=cloudy", "clear;10=cloudy",  // 一時雨・曇・快晴・昼から雨・晴のち曇
    /* Day 46〜 50 */ "clear;12=cloudy;16=clear", "clear;10=cloudy;17=clear", "clear", "light_rain;12=cloudy", "clear;14=cloudy",  // 晴時々曇・晴時々曇・快晴・霧雨・晴のち曇
    /* Day 51〜 55 */ "clear;13=cloudy;14=clear", "rain", "clear", "clear", "cloudy",  // 晴時々曇・雨・快晴・快晴・曇
    /* Day 56〜 60 */ "cloudy", "cloudy;14=fog", "cloudy;11=light_rain;15=cloudy", "clear;14=cloudy", "cloudy",  // 曇・夕霧・一時雨・晴のち曇・曇
    /* Day 61〜 65 */ "cloudy", "cloudy", "clear;11=cloudy", "clear;10=cloudy;17=clear", "cloudy",  // 曇・曇・晴のち曇・晴時々曇・曇
    /* Day 66〜 70 */ "cloudy;10=light_rain;16=cloudy", "light_rain;13=cloudy", "cloudy;12=light_rain;13=cloudy", "cloudy;11=light_rain;15=cloudy", "cloudy",  // 一時雨・霧雨・一時雨・一時雨・曇
    /* Day 71〜 75 */ "cloudy", "cloudy;13=light_rain;16=cloudy", "light_rain;13=cloudy", "cloudy;12=light_rain;14=cloudy", "clear",  // 曇・一時雨・霧雨・一時雨・快晴
    /* Day 76〜 80 */ "clear", "cloudy;13=light_rain;14=cloudy", "cloudy;14=rain;20=cloudy", "cloudy;11=light_rain;14=cloudy", "cloudy",  // 快晴・一時雨・昼から雨・一時雨・曇
    /* Day 81〜 85 */ "cloudy", "rain", "clear;10=cloudy", "light_rain;15=cloudy", "clear",  // 曇・雨・晴のち曇・霧雨・快晴
    /* Day 86〜 90 */ "cloudy", "cloudy;10=light_rain;15=cloudy", "cloudy", "rain", "light_rain;12=cloudy",  // 曇・一時雨・曇・雨・霧雨
    /* Day 91〜 95 */ "cloudy", "cloudy;10=rain;18=cloudy", "cloudy", "light_rain;13=cloudy", "cloudy;10=light_rain;16=cloudy",  // 曇・昼から雨・曇・霧雨・一時雨
    /* Day 96〜100 */ "cloudy", "cloudy", "cloudy;12=light_rain;15=cloudy", "light_rain;11=cloudy", "cloudy",  // 曇・曇・一時雨・霧雨・曇
  ]),
  "ドワーフ洞窟": Object.freeze([
    /* Day  1〜  5 */ "cloudy;11=clear", "fog;11=clear", "clear", "fog;12=cloudy", "fog;13=cloudy",  // 曇のち晴・朝霧のち晴・快晴・朝霧のち曇・朝霧のち曇
    /* Day  6〜 10 */ "cloudy", "cloudy", "cloudy;16=rain;23=cloudy", "cloudy;15=light_rain;21=cloudy", "cloudy;15=rain;23=cloudy",  // 曇・曇・昼から雨・一時雨・昼から雨
    /* Day 11〜 15 */ "cloudy;18=rain;23=cloudy", "fog;09=clear", "fog;11=clear", "cloudy", "cloudy;12=clear",  // 昼から雨・朝霧のち晴・朝霧のち晴・曇・曇のち晴
    /* Day 16〜 20 */ "fog;10=cloudy", "cloudy;21=fog", "fog;13=clear", "cloudy", "fog;12=clear",  // 朝霧のち曇・夕霧・朝霧のち晴・曇・朝霧のち晴
    /* Day 21〜 25 */ "rain", "cloudy;15=light_rain;21=cloudy", "cloudy", "fog;14=cloudy", "fog;11=cloudy",  // 雨・一時雨・曇・朝霧のち曇・朝霧のち曇
    /* Day 26〜 30 */ "cloudy;18=rain;23=cloudy", "cloudy;16=rain;23=cloudy", "cloudy;19=fog", "fog;13=clear", "fog;10=clear",  // 昼から雨・昼から雨・夕霧・朝霧のち晴・朝霧のち晴
    /* Day 31〜 35 */ "cloudy;12=clear", "cloudy;16=rain;23=cloudy", "cloudy", "cloudy;16=light_rain;18=cloudy", "fog;12=clear",  // 曇のち晴・昼から雨・曇・一時雨・朝霧のち晴
    /* Day 36〜 40 */ "fog;10=cloudy", "cloudy;16=rain;23=cloudy", "cloudy;21=fog", "rain", "fog;14=cloudy",  // 朝霧のち曇・昼から雨・夕霧・雨・朝霧のち曇
    /* Day 41〜 45 */ "cloudy;21=fog", "cloudy;15=rain;23=cloudy", "fog;13=cloudy", "fog;13=cloudy", "fog;09=clear",  // 夕霧・昼から雨・朝霧のち曇・朝霧のち曇・朝霧のち晴
    /* Day 46〜 50 */ "cloudy;13=clear", "cloudy;17=light_rain;18=cloudy", "rain", "cloudy;19=rain;23=cloudy", "fog;14=cloudy",  // 曇のち晴・一時雨・雨・昼から雨・朝霧のち曇
    /* Day 51〜 55 */ "fog;12=clear", "cloudy;17=rain;23=cloudy", "fog;10=cloudy", "fog;13=cloudy", "fog;10=cloudy",  // 朝霧のち晴・昼から雨・朝霧のち曇・朝霧のち曇・朝霧のち曇
    /* Day 56〜 60 */ "cloudy;12=clear", "cloudy;16=light_rain;22=cloudy", "cloudy;15=rain;22=cloudy", "cloudy;11=clear", "fog;10=cloudy",  // 曇のち晴・一時雨・昼から雨・曇のち晴・朝霧のち曇
    /* Day 61〜 65 */ "cloudy;14=light_rain;18=cloudy", "fog;13=cloudy", "rain", "cloudy", "fog;12=cloudy",  // 一時雨・朝霧のち曇・雨・曇・朝霧のち曇
    /* Day 66〜 70 */ "rain", "rain", "cloudy;11=clear", "fog;11=clear", "cloudy;18=light_rain;21=cloudy",  // 雨・雨・曇のち晴・朝霧のち晴・一時雨
    /* Day 71〜 75 */ "rain;17=snow", "rain;16=snow", "fog;14=cloudy", "cloudy;18=light_rain;19=cloudy", "cloudy;21=fog",  // みぞれ・みぞれ・朝霧のち曇・一時雨・夕霧
    /* Day 76〜 80 */ "cloudy", "rain", "fog;13=cloudy", "fog;11=cloudy", "fog;11=clear",  // 曇・雨・朝霧のち曇・朝霧のち曇・朝霧のち晴
    /* Day 81〜 85 */ "fog;10=clear", "rain;20=snow", "fog;14=cloudy", "cloudy", "cloudy",  // 朝霧のち晴・みぞれ・朝霧のち曇・曇・曇
    /* Day 86〜 90 */ "fog;14=cloudy", "cloudy;20=fog", "fog;11=cloudy", "fog;12=cloudy;20=snow", "fog;12=cloudy;21=snow",  // 朝霧のち曇・夕霧・朝霧のち曇・凍霧・凍霧
    /* Day 91〜 95 */ "fog;14=cloudy;21=snow", "rain", "fog;14=cloudy;17=snow", "fog;09=clear", "fog;10=cloudy",  // 凍霧・雨・凍霧・朝霧のち晴・朝霧のち曇
    /* Day 96〜100 */ "fog;11=clear", "cloudy", "rain", "cloudy", "cloudy",  // 朝霧のち晴・曇・雨・曇・曇
  ]),
  "北陵要塞": Object.freeze([
    /* Day  1〜  5 */ "clear;16=cloudy;19=clear", "cloudy", "clear;16=cloudy;21=clear", "clear", "clear;15=cloudy;20=clear",  // 晴時々曇・曇・晴時々曇・快晴・晴時々曇
    /* Day  6〜 10 */ "clear", "cloudy;16=light_rain;19=cloudy", "clear;18=cloudy;23=clear", "cloudy;15=clear", "cloudy;16=rain;23=cloudy",  // 快晴・一時雨・晴時々曇・曇のち晴・昼から雨
    /* Day 11〜 15 */ "cloudy", "cloudy", "clear", "clear;19=cloudy;20=clear", "cloudy",  // 曇・曇・快晴・晴時々曇・曇
    /* Day 16〜 20 */ "clear;17=strong_wind;23=clear", "rain", "cloudy", "cloudy;13=clear", "cloudy",  // 風の日・雨・曇・曇のち晴・曇
    /* Day 21〜 25 */ "clear;15=strong_wind;23=clear", "cloudy;12=clear", "cloudy;14=clear", "clear;15=cloudy;20=clear", "rain",  // 風の日・曇のち晴・曇のち晴・晴時々曇・雨
    /* Day 26〜 30 */ "rain", "cloudy;19=light_rain;23=cloudy", "rain", "clear;13=strong_wind;22=clear", "cloudy;19=rain;23=cloudy",  // 雨・一時雨・雨・風の日・昼から雨
    /* Day 31〜 35 */ "cloudy;16=clear", "cloudy", "cloudy;17=light_rain;22=cloudy", "rain", "cloudy",  // 曇のち晴・曇・一時雨・雨・曇
    /* Day 36〜 40 */ "cloudy;19=light_rain;20=cloudy", "cloudy", "cloudy", "rain", "clear;13=strong_wind;21=clear",  // 一時雨・曇・曇・雨・風の日
    /* Day 41〜 45 */ "clear;17=strong_wind;23=clear", "clear;13=strong_wind;23=clear", "cloudy", "clear;15=cloudy;22=clear", "clear;16=strong_wind;23=clear",  // 風の日・風の日・曇・晴時々曇・風の日
    /* Day 46〜 50 */ "clear;15=strong_wind;21=clear", "cloudy;19=snow", "rain;21=snow", "cloudy;18=light_rain;19=cloudy", "cloudy",  // 風の日・昼から雪・みぞれ・一時雨・曇
    /* Day 51〜 55 */ "cloudy;16=snow", "cloudy;19=rain;23=cloudy", "cloudy;17=light_rain;22=cloudy", "clear;14=strong_wind;23=clear", "cloudy",  // 昼から雪・昼から雨・一時雨・風の日・曇
    /* Day 56〜 60 */ "cloudy;16=snow", "cloudy;16=snow", "cloudy", "cloudy;19=snow", "clear;15=strong_wind;22=clear",  // 昼から雪・昼から雪・曇・昼から雪・風の日
    /* Day 61〜 65 */ "cloudy;19=light_rain;20=cloudy", "cloudy", "cloudy;17=light_rain;23=cloudy", "clear", "cloudy",  // 一時雨・曇・一時雨・快晴・曇
    /* Day 66〜 70 */ "clear;15=strong_wind;22=clear", "cloudy", "clear;16=strong_wind;23=clear", "clear;14=strong_wind;23=clear", "cloudy",  // 風の日・曇・風の日・風の日・曇
    /* Day 71〜 75 */ "clear;16=strong_wind;23=clear", "snow", "cloudy;16=snow", "cloudy;16=snow", "cloudy",  // 風の日・雪・昼から雪・昼から雪・曇
    /* Day 76〜 80 */ "cloudy;19=snow", "cloudy;18=snow", "rain;20=snow", "clear;15=strong_wind;23=clear", "clear;13=strong_wind;22=clear",  // 昼から雪・昼から雪・みぞれ・風の日・風の日
    /* Day 81〜 85 */ "snow;15=cloudy", "rain;19=snow", "rain;20=snow", "snow", "snow;18=cloudy",  // 雪のち曇・みぞれ・みぞれ・雪・雪のち曇
    /* Day 86〜 90 */ "clear;16=strong_wind;23=clear", "snow", "fog;15=cloudy;18=snow", "clear;13=strong_wind;23=clear", "cloudy;19=snow",  // 風の日・雪・凍霧・風の日・昼から雪
    /* Day 91〜 95 */ "cloudy", "snow", "snow;18=cloudy", "snow", "cloudy;18=snow",  // 曇・雪・雪のち曇・雪・昼から雪
    /* Day 96〜100 */ "clear", "snow;18=cloudy", "snow", "clear", "fog;13=cloudy;21=snow",  // 快晴・雪のち曇・雪・快晴・凍霧
  ]),
  "辺境の村": Object.freeze([
    /* Day  1〜  5 */ "clear;06=dry_wind;18=clear", "cloudy", "clear;09=cloudy;15=clear", "clear;08=dry_wind;18=clear", "clear;06=dry_wind;17=clear",  // 乾いた風・曇・晴時々曇・乾いた風・乾いた風
    /* Day  6〜 10 */ "clear;09=dry_wind;16=clear", "clear;06=dry_wind;17=clear", "clear", "clear;09=cloudy;15=clear", "cloudy;12=light_rain;14=cloudy",  // 乾いた風・乾いた風・快晴・晴時々曇・一時雨
    /* Day 11〜 15 */ "cloudy;11=light_rain;14=cloudy", "clear;08=dry_wind;15=clear", "cloudy", "dry_wind;13=cloudy", "cloudy;11=light_rain;13=cloudy",  // 一時雨・乾いた風・曇・砂の風・一時雨
    /* Day 16〜 20 */ "clear;08=dry_wind;18=clear", "cloudy", "cloudy;13=light_rain;14=cloudy", "clear", "clear;09=dry_wind;14=clear",  // 乾いた風・曇・一時雨・快晴・乾いた風
    /* Day 21〜 25 */ "clear;08=dry_wind;16=clear", "clear", "clear;10=dry_wind;16=clear", "cloudy;08=clear", "clear;13=cloudy;15=clear",  // 乾いた風・快晴・乾いた風・曇のち晴・晴時々曇
    /* Day 26〜 30 */ "cloudy;13=rain;20=cloudy", "clear", "clear;09=cloudy;15=clear", "cloudy;13=rain;19=cloudy", "clear",  // 昼から雨・快晴・晴時々曇・昼から雨・快晴
    /* Day 31〜 35 */ "dry_wind;16=cloudy", "clear", "cloudy", "clear;11=cloudy;13=clear", "cloudy",  // 砂の風・快晴・曇・晴時々曇・曇
    /* Day 36〜 40 */ "clear;08=dry_wind;14=clear", "clear", "cloudy;12=light_rain;14=cloudy", "cloudy;12=light_rain;14=cloudy", "cloudy",  // 乾いた風・快晴・一時雨・一時雨・曇
    /* Day 41〜 45 */ "cloudy;08=clear", "clear", "cloudy", "clear", "clear;10=dry_wind;14=clear",  // 曇のち晴・快晴・曇・快晴・乾いた風
    /* Day 46〜 50 */ "cloudy;13=rain;19=cloudy", "dry_wind;15=cloudy", "dry_wind;16=cloudy", "rain", "dry_wind;13=cloudy",  // 昼から雨・砂の風・砂の風・雨・砂の風
    /* Day 51〜 55 */ "clear;07=dry_wind;16=clear", "cloudy", "clear;08=dry_wind;16=clear", "clear;12=cloudy;14=clear", "dry_wind;14=cloudy",  // 乾いた風・曇・乾いた風・晴時々曇・砂の風
    /* Day 56〜 60 */ "dry_wind;13=cloudy", "cloudy;11=light_rain;15=cloudy", "clear", "dry_wind;17=cloudy", "dry_wind;16=cloudy",  // 砂の風・一時雨・快晴・砂の風・砂の風
    /* Day 61〜 65 */ "cloudy;10=rain;20=cloudy", "clear;11=cloudy;14=clear", "cloudy;11=rain;19=cloudy", "clear;06=dry_wind;17=clear", "clear",  // 昼から雨・晴時々曇・昼から雨・乾いた風・快晴
    /* Day 66〜 70 */ "cloudy;12=light_rain;15=cloudy", "cloudy", "clear;07=dry_wind;14=clear", "clear", "clear",  // 一時雨・曇・乾いた風・快晴・快晴
    /* Day 71〜 75 */ "clear", "cloudy;12=light_rain;16=cloudy", "rain", "cloudy;12=rain;18=cloudy", "cloudy",  // 快晴・一時雨・雨・昼から雨・曇
    /* Day 76〜 80 */ "clear;12=cloudy;15=clear", "cloudy;11=rain;21=cloudy", "cloudy;11=rain;19=cloudy", "dry_wind;15=cloudy", "dry_wind;17=cloudy",  // 晴時々曇・昼から雨・昼から雨・砂の風・砂の風
    /* Day 81〜 85 */ "clear;08=dry_wind;18=clear", "rain", "dry_wind;15=cloudy", "cloudy;11=light_rain;16=cloudy", "cloudy;12=light_rain;17=cloudy",  // 乾いた風・雨・砂の風・一時雨・一時雨
    /* Day 86〜 90 */ "clear", "clear;12=cloudy;14=clear", "dry_wind;16=cloudy", "clear", "clear;12=cloudy;17=clear",  // 快晴・晴時々曇・砂の風・快晴・晴時々曇
    /* Day 91〜 95 */ "clear;08=dry_wind;18=clear", "cloudy;11=light_rain;14=cloudy", "cloudy;10=light_rain;15=cloudy", "clear;08=dry_wind;14=clear", "cloudy;10=light_rain;13=cloudy",  // 乾いた風・一時雨・一時雨・乾いた風・一時雨
    /* Day 96〜100 */ "clear", "cloudy;12=light_rain;13=cloudy", "cloudy;10=light_rain;17=cloudy", "cloudy;11=rain;17=cloudy", "clear",  // 快晴・一時雨・一時雨・昼から雨・快晴
  ]),
  "古代神殿": Object.freeze([
    /* Day  1〜  5 */ "clear;15=cloudy;18=clear", "clear", "fog;09=cloudy", "cloudy;20=fog", "fog;10=cloudy",  // 晴時々曇・快晴・朝霧のち曇・夕霧・朝霧のち曇
    /* Day  6〜 10 */ "fog;10=clear", "clear", "cloudy", "cloudy", "cloudy",  // 朝霧のち晴・快晴・曇・曇・曇
    /* Day 11〜 15 */ "cloudy;12=rain;21=cloudy", "fog;08=cloudy", "fog;07=cloudy", "fog;08=cloudy", "cloudy;19=fog",  // 昼から雨・朝霧のち曇・朝霧のち曇・朝霧のち曇・夕霧
    /* Day 16〜 20 */ "cloudy", "clear;18=storm;19=cloudy", "cloudy;12=light_rain;19=cloudy", "clear", "clear",  // 曇・夕立・一時雨・快晴・快晴
    /* Day 21〜 25 */ "cloudy;12=light_rain;16=cloudy", "cloudy;17=fog", "fog;10=clear", "cloudy", "fog;08=clear",  // 一時雨・夕霧・朝霧のち晴・曇・朝霧のち晴
    /* Day 26〜 30 */ "cloudy;16=rain;20=cloudy", "fog;09=clear", "clear;12=cloudy;16=clear", "clear", "clear;15=cloudy;19=clear",  // 昼から雨・朝霧のち晴・晴時々曇・快晴・晴時々曇
    /* Day 31〜 35 */ "fog;11=cloudy", "cloudy", "cloudy;16=fog", "cloudy", "clear;13=cloudy;17=clear",  // 朝霧のち曇・曇・夕霧・曇・晴時々曇
    /* Day 36〜 40 */ "clear;12=cloudy;19=clear", "cloudy", "cloudy", "fog;08=cloudy", "fog;07=cloudy",  // 晴時々曇・曇・曇・朝霧のち曇・朝霧のち曇
    /* Day 41〜 45 */ "fog;07=clear", "cloudy", "fog;10=cloudy", "clear", "cloudy;16=fog",  // 朝霧のち晴・曇・朝霧のち曇・快晴・夕霧
    /* Day 46〜 50 */ "rain", "cloudy;11=light_rain;17=cloudy", "fog;08=cloudy", "fog;08=clear", "cloudy;19=fog",  // 雨・一時雨・朝霧のち曇・朝霧のち晴・夕霧
    /* Day 51〜 55 */ "rain", "fog;08=clear", "cloudy;13=light_rain;16=cloudy", "fog;08=cloudy", "fog;09=cloudy",  // 雨・朝霧のち晴・一時雨・朝霧のち曇・朝霧のち曇
    /* Day 56〜 60 */ "cloudy;13=light_rain;15=cloudy", "cloudy;13=light_rain;19=cloudy", "cloudy;14=light_rain;16=cloudy", "cloudy;18=fog", "cloudy;15=light_rain;18=cloudy",  // 一時雨・一時雨・一時雨・夕霧・一時雨
    /* Day 61〜 65 */ "light_rain;15=cloudy", "cloudy", "cloudy;16=rain;22=cloudy", "cloudy;18=fog", "fog;09=cloudy",  // 霧雨・曇・昼から雨・夕霧・朝霧のち曇
    /* Day 66〜 70 */ "rain", "light_rain;17=cloudy", "clear", "fog;07=cloudy", "fog;07=cloudy",  // 雨・霧雨・快晴・朝霧のち曇・朝霧のち曇
    /* Day 71〜 75 */ "fog;11=cloudy", "cloudy;13=light_rain;16=cloudy", "fog;11=cloudy", "fog;11=cloudy", "cloudy",  // 朝霧のち曇・一時雨・朝霧のち曇・朝霧のち曇・曇
    /* Day 76〜 80 */ "fog;07=clear", "cloudy;15=rain;19=cloudy", "cloudy;14=light_rain;16=cloudy", "fog;10=cloudy", "fog;08=clear",  // 朝霧のち晴・昼から雨・一時雨・朝霧のち曇・朝霧のち晴
    /* Day 81〜 85 */ "cloudy", "cloudy", "fog;07=cloudy", "cloudy;12=light_rain;19=cloudy", "cloudy",  // 曇・曇・朝霧のち曇・一時雨・曇
    /* Day 86〜 90 */ "fog;11=cloudy", "cloudy;12=light_rain;18=cloudy", "rain", "cloudy", "cloudy;19=fog",  // 朝霧のち曇・一時雨・雨・曇・夕霧
    /* Day 91〜 95 */ "cloudy;20=fog", "rain", "cloudy;12=rain;22=cloudy", "cloudy;16=rain;19=cloudy", "cloudy;15=light_rain;18=cloudy",  // 夕霧・雨・昼から雨・昼から雨・一時雨
    /* Day 96〜100 */ "fog;08=cloudy", "cloudy;12=light_rain;17=cloudy", "fog;08=cloudy", "fog;08=cloudy", "fog;07=cloudy",  // 朝霧のち曇・一時雨・朝霧のち曇・朝霧のち曇・朝霧のち曇
  ]),
  "黒嶺連合領": Object.freeze([
    /* Day  1〜  5 */ "clear", "clear", "clear;13=dry_wind;20=clear", "clear;13=strong_wind;21=clear", "cloudy;16=light_rain;18=cloudy",  // 快晴・快晴・乾いた風・風の日・一時雨
    /* Day  6〜 10 */ "clear", "cloudy", "clear;14=strong_wind;22=clear", "cloudy;15=rain;23=cloudy", "cloudy;15=rain;22=cloudy",  // 快晴・曇・風の日・昼から雨・昼から雨
    /* Day 11〜 15 */ "cloudy;17=rain;23=cloudy", "cloudy;17=storm;20=rain;23=cloudy", "clear", "clear", "clear",  // 昼から雨・雷雨・快晴・快晴・快晴
    /* Day 16〜 20 */ "clear;13=dry_wind;20=clear", "clear;14=dry_wind;19=clear", "cloudy;15=storm;21=rain;23=cloudy", "cloudy", "clear;13=dry_wind;20=clear",  // 乾いた風・乾いた風・雷雨・曇・乾いた風
    /* Day 21〜 25 */ "cloudy;18=storm;21=rain;23=cloudy", "cloudy", "cloudy;15=storm;22=rain;23=cloudy", "clear;12=dry_wind;19=clear", "cloudy;16=storm;22=rain;23=cloudy",  // 雷雨・曇・雷雨・乾いた風・雷雨
    /* Day 26〜 30 */ "cloudy;15=light_rain;19=cloudy", "cloudy", "cloudy;15=rain;23=cloudy", "clear;16=strong_wind;22=clear", "cloudy;15=rain;23=cloudy",  // 一時雨・曇・昼から雨・風の日・昼から雨
    /* Day 31〜 35 */ "clear;14=cloudy;20=clear", "cloudy;14=light_rain;19=cloudy", "cloudy;18=light_rain;21=cloudy", "clear;13=strong_wind;23=clear", "clear;14=cloudy;22=clear",  // 晴時々曇・一時雨・一時雨・風の日・晴時々曇
    /* Day 36〜 40 */ "cloudy;14=storm;20=rain;23=cloudy", "cloudy;17=rain;23=cloudy", "cloudy", "cloudy;19=rain;23=cloudy", "cloudy;18=light_rain;21=cloudy",  // 雷雨・昼から雨・曇・昼から雨・一時雨
    /* Day 41〜 45 */ "clear;16=cloudy;19=clear", "cloudy", "cloudy", "clear;16=strong_wind;21=clear", "cloudy",  // 晴時々曇・曇・曇・風の日・曇
    /* Day 46〜 50 */ "clear", "cloudy", "rain", "clear;15=dry_wind;19=clear", "clear;12=dry_wind;22=clear",  // 快晴・曇・雨・乾いた風・乾いた風
    /* Day 51〜 55 */ "clear;15=dry_wind;19=clear", "cloudy", "clear;15=strong_wind;21=clear", "clear;15=strong_wind;21=clear", "clear;15=cloudy;20=clear",  // 乾いた風・曇・風の日・風の日・晴時々曇
    /* Day 56〜 60 */ "cloudy;16=rain;22=cloudy", "cloudy;16=rain;22=cloudy", "cloudy;17=rain;23=cloudy", "rain", "clear",  // 昼から雨・昼から雨・昼から雨・雨・快晴
    /* Day 61〜 65 */ "clear;16=strong_wind;23=clear", "cloudy", "cloudy", "clear;15=strong_wind;23=clear", "clear;14=strong_wind;23=clear",  // 風の日・曇・曇・風の日・風の日
    /* Day 66〜 70 */ "cloudy;16=rain;23=cloudy", "cloudy", "clear;16=cloudy;19=clear", "clear;13=dry_wind;23=clear", "cloudy;19=rain;23=cloudy",  // 昼から雨・曇・晴時々曇・乾いた風・昼から雨
    /* Day 71〜 75 */ "rain;16=snow", "rain", "cloudy", "rain", "rain;17=snow",  // みぞれ・雨・曇・雨・みぞれ
    /* Day 76〜 80 */ "cloudy", "rain", "cloudy;19=snow", "cloudy", "clear;13=dry_wind;23=clear",  // 曇・雨・昼から雪・曇・乾いた風
    /* Day 81〜 85 */ "clear;15=strong_wind;21=clear", "cloudy", "clear;12=strong_wind;22=clear", "rain;20=snow", "cloudy;15=light_rain;18=cloudy",  // 風の日・曇・風の日・みぞれ・一時雨
    /* Day 86〜 90 */ "cloudy;17=rain;23=cloudy", "clear;14=strong_wind;23=clear", "rain", "rain", "clear;16=strong_wind;23=clear",  // 昼から雨・風の日・雨・雨・風の日
    /* Day 91〜 95 */ "cloudy;18=snow", "clear", "cloudy;17=snow", "cloudy;16=rain;23=cloudy", "cloudy;18=rain;23=cloudy",  // 昼から雪・快晴・昼から雪・昼から雨・昼から雨
    /* Day 96〜100 */ "clear;11=dry_wind;21=clear", "cloudy;16=rain;23=cloudy", "clear;13=dry_wind;19=clear", "rain;20=snow", "clear",  // 乾いた風・昼から雨・乾いた風・みぞれ・快晴
  ]),
  "魔王領": Object.freeze([
    /* Day  1〜  5 */ "cloudy", "cloudy;18=storm;22=rain;23=cloudy", "dry_wind;23=cloudy", "cloudy", "cloudy;19=light_rain;22=cloudy",  // 曇・雷雨・砂の風・曇・一時雨
    /* Day  6〜 10 */ "dry_wind;23=cloudy", "clear", "clear;20=cloudy;22=clear", "cloudy;20=rain;23=cloudy", "cloudy;20=storm;23=rain",  // 砂の風・快晴・晴時々曇・昼から雨・雷雨
    /* Day 11〜 15 */ "cloudy", "clear", "clear;17=dry_wind;23=clear", "clear;15=dry_wind;22=clear", "clear",  // 曇・快晴・乾いた風・乾いた風・快晴
    /* Day 16〜 20 */ "clear;19=cloudy;23=clear", "cloudy;18=light_rain;20=cloudy", "dry_wind;23=cloudy", "clear;17=cloudy;23=clear", "dry_wind;23=cloudy",  // 晴時々曇・一時雨・砂の風・晴時々曇・砂の風
    /* Day 21〜 25 */ "cloudy;18=storm;23=rain", "cloudy;21=fog", "clear;20=cloudy;21=clear", "cloudy", "cloudy;16=light_rain;21=cloudy",  // 雷雨・夕霧・晴時々曇・曇・一時雨
    /* Day 26〜 30 */ "cloudy", "clear", "dry_wind;20=cloudy", "clear;17=cloudy;21=clear", "clear;17=cloudy;23=clear",  // 曇・快晴・砂の風・晴時々曇・晴時々曇
    /* Day 31〜 35 */ "dry_wind;23=cloudy", "cloudy;21=fog", "cloudy;21=fog", "clear;14=dry_wind;22=clear", "cloudy;22=fog",  // 砂の風・夕霧・夕霧・乾いた風・夕霧
    /* Day 36〜 40 */ "clear;17=dry_wind;23=clear", "dry_wind;21=cloudy", "cloudy", "cloudy", "clear;14=dry_wind;21=clear",  // 乾いた風・砂の風・曇・曇・乾いた風
    /* Day 41〜 45 */ "cloudy", "dry_wind;23=cloudy", "cloudy;17=light_rain;23=cloudy", "cloudy;17=storm;23=rain", "clear;17=cloudy;23=clear",  // 曇・砂の風・一時雨・雷雨・晴時々曇
    /* Day 46〜 50 */ "cloudy;17=light_rain;22=cloudy", "dry_wind;21=cloudy", "clear;16=dry_wind;23=clear", "clear", "dry_wind;23=cloudy",  // 一時雨・砂の風・乾いた風・快晴・砂の風
    /* Day 51〜 55 */ "cloudy;23=fog", "cloudy;18=rain;23=cloudy", "cloudy;17=storm;23=rain", "cloudy", "dry_wind;23=cloudy",  // 夕霧・昼から雨・雷雨・曇・砂の風
    /* Day 56〜 60 */ "cloudy;19=light_rain;21=cloudy", "cloudy", "cloudy;16=light_rain;21=cloudy", "clear", "clear;13=dry_wind;23=clear",  // 一時雨・曇・一時雨・快晴・乾いた風
    /* Day 61〜 65 */ "cloudy", "clear", "cloudy;18=rain;23=cloudy", "rain", "cloudy",  // 曇・快晴・昼から雨・雨・曇
    /* Day 66〜 70 */ "cloudy;21=fog", "cloudy", "cloudy", "clear;15=dry_wind;23=clear", "dry_wind;23=cloudy",  // 夕霧・曇・曇・乾いた風・砂の風
    /* Day 71〜 75 */ "cloudy", "dry_wind;23=cloudy", "dry_wind;22=cloudy", "rain;18=snow", "cloudy",  // 曇・砂の風・砂の風・みぞれ・曇
    /* Day 76〜 80 */ "cloudy", "cloudy;18=light_rain;22=cloudy", "clear;16=dry_wind;21=clear", "rain;18=snow", "cloudy",  // 曇・一時雨・乾いた風・みぞれ・曇
    /* Day 81〜 85 */ "dry_wind;23=cloudy", "cloudy", "clear;16=dry_wind;23=clear", "cloudy;23=fog", "rain",  // 砂の風・曇・乾いた風・夕霧・雨
    /* Day 86〜 90 */ "dry_wind;23=cloudy", "rain", "cloudy;20=light_rain;21=cloudy", "cloudy", "cloudy;17=rain;23=cloudy",  // 砂の風・雨・一時雨・曇・昼から雨
    /* Day 91〜 95 */ "dry_wind;21=cloudy", "cloudy", "cloudy", "cloudy", "rain",  // 砂の風・曇・曇・曇・雨
    /* Day 96〜100 */ "cloudy", "cloudy;18=storm;23=rain", "dry_wind;23=cloudy", "dry_wind;22=cloudy", "cloudy",  // 曇・雷雨・砂の風・砂の風・曇
  ]),
});

export const WEATHER_ALMANAC_REGIONS = Object.freeze(Object.keys(WEATHER_ALMANAC));
