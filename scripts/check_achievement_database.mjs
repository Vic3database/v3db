import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const databaseDir = path.join(process.cwd(), "database", "vic3_1.13.9");
const index = readJson(path.join(databaseDir, "index.json"));

assert.equal(index.files?.achievements, "achievements.json", "database index must declare achievements.json");
assert.equal(index.counts?.achievements, 141, "database index must declare 141 achievements");

const achievements = readJson(path.join(databaseDir, index.files.achievements));
assert.equal(achievements.length, 141, "database must contain 141 achievements");
assert.deepEqual(countBy(achievements, (achievement) => achievement.group_key), {
  easy_group: 31,
  medium_group: 67,
  hard_group: 34,
  very_hard_group: 9,
}, "achievement group counts must match game definitions");

const keys = new Set();
for (const achievement of achievements) {
  assert.match(achievement.id, /^achievement:[A-Za-z0-9_]+$/, "achievement id must use the stable achievement namespace");
  assert(!keys.has(achievement.key), `${achievement.key} must be unique`);
  keys.add(achievement.key);

  for (const key of ["key", "name_zh", "description_zh", "group_key", "group_name_zh", "group_order", "source_file"]) {
    assert(achievement[key], `${achievement.key || "achievement"} must contain ${key}`);
  }
  for (const key of ["possible", "happened"]) {
    assert.match(achievement.script?.[key] || "", /^\{[\s\S]*\}$/, `${achievement.key} script.${key} must be a braced block`);
  }

  assert(Array.isArray(achievement.details), `${achievement.key} details must be an array`);
  for (const detail of achievement.details) {
    assert(detail.key && detail.text_zh, `${achievement.key} details must contain labeled values`);
  }

  for (const state of ["achieved", "not_achieved"]) {
    const icon = achievement.icon?.[state];
    assert.match(icon || "", /^gfx\/interface\/icons\/achievements\/[^/]+\.jpg$/, `${achievement.key} icon.${state} must use an achievement JPG asset`);
    assert(fs.existsSync(path.join(index.source_paths.game_data, ...icon.split("/"))), `${achievement.key} icon.${state} must exist in the game data`);
  }
}

console.log(JSON.stringify({
  achievement_database: "ok",
  achievements: achievements.length,
}, null, 2));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function countBy(values, keyForValue) {
  return Object.fromEntries(values.reduce((counts, value) => {
    const key = keyForValue(value);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map()));
}
