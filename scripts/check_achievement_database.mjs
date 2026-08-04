import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const databaseDir = path.join(process.cwd(), "database", "vic3_1.13.9");
const index = readJson(path.join(databaseDir, "index.json"));
const readme = fs.readFileSync(path.join(databaseDir, "README.md"), "utf8").replace(/^\uFEFF/, "");
const locales = Object.fromEntries(["zh-Hans", "en"].map((locale) => [locale, readJson(path.join(databaseDir, "locales", `${locale}.json`))]));

assert.equal(index.files?.achievements, "achievements.json", "database index must declare achievements.json");
assert.equal(index.counts?.achievements, 141, "database index must declare 141 achievements");
assert(readme.includes("- achievements.json："), "database README must describe achievements.json");
assert(readme.indexOf("成就：141") > readme.indexOf("## 数量"), "database README must count achievements in its quantity section");

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

  for (const key of ["key", "group_key", "group_order", "source_file", "loc"]) {
    assert.notEqual(achievement[key], undefined, `${achievement.key || "achievement"} must contain ${key}`);
    assert.notEqual(achievement[key], "", `${achievement.key || "achievement"} must contain ${key}`);
  }
  for (const field of ["name", "description", "groupName"]) {
    assert(achievement.loc?.[field], `${achievement.key} must declare loc.${field}`);
    for (const locale of ["zh-Hans", "en"]) assert(locales[locale][achievement.loc[field]], `${achievement.key} loc.${field} must resolve in ${locale}`);
  }
  assert(achievement.script && Object.hasOwn(achievement.script, "possible"), `${achievement.key} must declare script.possible`);
  if (achievement.script.possible !== null) {
    assert.match(achievement.script.possible, /^\{[\s\S]*\}$/, `${achievement.key} script.possible must be a braced block or null`);
  }
  assert.match(achievement.script?.happened || "", /^\{[\s\S]*\}$/, `${achievement.key} script.happened must be a braced block`);

  assert(Array.isArray(achievement.related_countries), `${achievement.key} related_countries must be an array`);
  const directTags = [...new Set(`${achievement.script.possible || ""}\n${achievement.script.happened}`.match(/\bc:([A-Z]{3})\b/g) || [])]
    .map((value) => value.slice(2))
    .sort();
  assert.deepEqual(achievement.related_countries.map((country) => country.tag), directTags, `${achievement.key} must retain only direct c:TAG references`);
  for (const country of achievement.related_countries) {
    assert(country.loc?.name, `${achievement.key} ${country.tag} must declare loc.name`);
    for (const locale of ["zh-Hans", "en"]) assert(locales[locale][country.loc.name], `${achievement.key} ${country.tag} must resolve in ${locale}`);
  }

  assert(Array.isArray(achievement.details), `${achievement.key} details must be an array`);
  for (const detail of achievement.details) {
    assert(detail.key && detail.loc?.text, `${achievement.key} details must contain localized values`);
    for (const locale of ["zh-Hans", "en"]) {
      const text = locales[locale][detail.loc.text];
      assert(text, `${achievement.key} detail ${detail.key} must resolve in ${locale}`);
      if (locale === "zh-Hans") assert(!/[\[\]$#@!]/.test(text), `${achievement.key} detail ${detail.key} must not retain localization markup in ${locale}`);
    }
  }

  for (const state of ["achieved", "not_achieved"]) {
    const icon = achievement.icon?.[state];
    assert.match(icon || "", /^gfx\/interface\/icons\/achievements\/[^/]+\.jpg$/, `${achievement.key} icon.${state} must use an achievement JPG asset`);
    assert(fs.existsSync(path.join(index.source_paths.game_data, ...icon.split("/"))), `${achievement.key} icon.${state} must exist in the game data`);
  }
}

assert.deepEqual(
  achievements.filter((achievement) => achievement.script.possible === null).map((achievement) => achievement.key).sort(),
  [
    "achievement_devils_railroad",
    "achievement_shut_the_door_behind_you",
    "achievement_stonks",
    "achievement_unanimity",
  ],
  "only source achievements without possible blocks may use null",
);

const relatedAchievements = achievements.filter((achievement) => achievement.related_countries.length);
assert.equal(relatedAchievements.length, 66, "66 achievements must have direct country references");
assert.equal(new Set(relatedAchievements.flatMap((achievement) => achievement.related_countries.map((country) => country.tag))).size, 48, "direct country references must cover 48 country tags");

console.log(JSON.stringify({
  achievement_database: "ok",
  achievements: achievements.length,
}));

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
