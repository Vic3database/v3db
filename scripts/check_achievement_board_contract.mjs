import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const index = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
const app = readSiteAppSource(root);
const styles = readSiteStyleSource(root);
const achievementChunk = readGlobal(path.join(root, "site", "versions", "1.13.9", "data-achievements.js"));
const achievements = achievementChunk.achievements || [];

assert.equal(achievements.length, 141, "achievement chunk must contain 141 records");
assert.deepEqual(countBy(achievements, (achievement) => achievement.group_key), {
  easy_group: 31,
  medium_group: 67,
  hard_group: 34,
  very_hard_group: 9,
}, "achievement chunk must preserve official difficulty group counts");
for (const achievement of achievements) {
  assert(achievement.name_en, `${achievement.key} must include an English full name`);
  assert(Array.isArray(achievement.related_countries), `${achievement.key} must publish related countries`);
  assert(fs.existsSync(path.join(root, "site", "assets", "achievements", `${achievement.key}.webp`)), `${achievement.key} must have a published WebP icon`);
}

assert.match(index, /data-nav-view="achievement"[^>]*>[\s\S]*?<span>成就<\/span>/, "top navigation must expose achievements");
assert.match(index, /data-nav-view="achievement"[^>]*>[\s\S]*?trophy\.svg/, "achievement navigation must use the trophy icon");
assert.ok(
  /app\/runtime\.js\?v=20260730-achievement-cache1/.test(index),
  "runtime must use the coordinated achievement cache version",
);
assert.ok(
  /app\/data\.js\?v=20260730-achievement-cache1/.test(index),
  "data must use the coordinated achievement cache version",
);
assert.ok(
  /app\/ui\.js\?v=20260730-achievement-cache1/.test(index),
  "ui must use the coordinated achievement cache version",
);
assert.ok(
  /app\/achievements\.js\?v=20260730-achievement-cache1/.test(index),
  "achievement wall must use the coordinated achievement cache version",
);
assert.match(app, /if \(view === "achievement"\) return \["achievement"\]/, "achievement route must load only its data chunk");
assert.match(app, /function achievementMatches\(/, "achievement search matcher must exist");
assert.match(app, /achievement\.name_en/, "achievement search must include English names");
assert.match(app, /achievement\.description_zh/, "achievement search must include descriptions");
assert.match(app, /detail\.text_zh/, "achievement search must include translated conditions");
assert.match(app, /achievement\.related_countries/, "achievement search and detail must consume related countries");
assert.match(app, /data-achievement-country/, "achievement detail must render country route controls");
assert.match(app, /replaceHash\(`\/country\/\$\{encodeURIComponent\(tag\)\}`\)/, "achievement country controls must route to country details");
assert.match(app, /function renderAchievementBoard\(/, "achievement board renderer must exist");
assert.match(app, /function renderAchievementDetail\(/, "achievement detail renderer must exist");
assert.match(app, /<details open><summary>前置筛选条件<\/summary>/, "possible script must be expanded by default");
assert.match(app, /<details open><summary>达成脚本<\/summary>/, "happened script must be expanded by default");
assert.match(app, /原版未定义前置筛选条件/, "missing possible scripts must use their explicit source message");
assert.match(app, /assets\/achievements\/\$\{escapeHtml\(achievement\.key\)\}\.webp/, "cards must reference published WebP icons");
assert.match(app, /\["country"[\s\S]*"achievement"\]/, "detail routes must accept achievement deep links");
assert.match(styles, /body\[data-view="achievement"\] \.map-panel,[\s\S]*?display: none/, "achievement view must hide the map and filters");
assert.match(styles, /grid-template-columns:\s*repeat\(12, minmax\(0, 1fr\)\)/, "full achievement wall must use twelve desktop columns");
assert.match(styles, /body\.detail-page\[data-view="achievement"\][\s\S]*?repeat\(10, minmax\(0, 1fr\)\)/, "open desktop detail must retain ten card columns");
assert.match(styles, /achievement-card--easy_group[\s\S]*?#4a4840/, "easy cards must use dark stone gray");
assert.match(styles, /achievement-card--medium_group[\s\S]*?#4d372b/, "medium cards must use deep copper brown");
assert.match(styles, /achievement-card--hard_group[\s\S]*?#384651/, "hard cards must use dark silver blue gray");
assert.match(styles, /achievement-card--very_hard_group[\s\S]*?#4b4727/, "very hard cards must use dark gold olive");

console.log(JSON.stringify({ achievement_board_contract: "ok" }, null, 2));

function readGlobal(file) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window.VIC3_DATA_CHUNK || {};
}

function countBy(values, keyForValue) {
  return Object.fromEntries(values.reduce((counts, value) => {
    const key = keyForValue(value);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map()));
}
