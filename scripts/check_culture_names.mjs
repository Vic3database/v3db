import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(root, "output", "culture-names", "culture-names.json");

assert.ok(fs.existsSync(reportPath), `missing culture name report: ${reportPath}`);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8").replace(/^\uFEFF/, ""));

assert.equal(report.source_game_branch, "release/1.13.10", "unexpected game branch");
assert.equal(report.stats.cultures, 317, "unexpected culture count");
assert.equal(report.cultures.length, report.stats.cultures, "culture count does not match stats");
assert.equal(report.stats.invalid_name_pool_entries, 0, "name pools contain invalid entries");
assert.equal(report.stats.duplicate_name_entries, 74, "unexpected duplicate name entry count");
assert.equal(report.stats.empty_name_pools, 1551, "unexpected empty name pool count");
assert.equal(report.stats.localization_missing_zh, 0, "Chinese name localization should be complete");
assert.equal(report.stats.localization_missing_en, 0, "English name localization should be complete");
assert.equal(report.stats.historical_culture_keys_without_definition, 0, "historical character culture references should normalize to culture definitions");
assert.equal(report.stats.historical_culture_keys_with_primary_culture, 669, "unexpected primary_culture reference count");
assert.equal(report.stats.historical_characters_with_culture, 1970, "unexpected historical character culture field count");
assert.equal(report.stats.historical_characters_with_specific_culture, 1301, "unexpected specific historical character culture count");
assert.equal(report.stats.historical_characters_without_culture, 13, "unexpected missing historical character culture count");

const cultureKeys = new Set(report.cultures.map((culture) => culture.key));
assert.equal(cultureKeys.size, report.cultures.length, "culture keys must be unique");

const expectedPools = [
  "male_common_first_names",
  "female_common_first_names",
  "male_noble_first_names",
  "female_noble_first_names",
  "male_regal_first_names",
  "female_regal_first_names",
  "common_last_names",
  "noble_last_names",
  "regal_last_names",
];
for (const culture of report.cultures) {
  assert.deepEqual(Object.keys(culture.name_pools), expectedPools, `${culture.key} has unexpected name pool keys`);
  assert.ok(Array.isArray(culture.historical_characters), `${culture.key} historical character refs must be an array`);
  for (const poolKey of expectedPools) {
    const pool = culture.name_pools[poolKey];
    assert.equal(pool.count, pool.entries.length, `${culture.key}.${poolKey} count mismatch`);
    for (const entry of pool.entries) {
      assert.ok(entry.key, `${culture.key}.${poolKey} contains an empty name key`);
      assert.equal(typeof entry.name_zh, "string", `${culture.key}.${poolKey} Chinese name must be a string`);
      assert.equal(typeof entry.name_en, "string", `${culture.key}.${poolKey} English name must be a string`);
    }
  }
}

const northGerman = report.cultures.find((culture) => culture.key === "north_german");
assert.ok(northGerman, "missing north_german culture");
assert.equal(northGerman.name_pools.male_common_first_names.entries[0].key, "Adelbert");
assert.equal(northGerman.name_pools.male_common_first_names.entries[0].name_zh, "阿德尔贝特");
assert.ok(northGerman.historical_characters.some((character) => character.culture_key_source === "cu:north_german"), "north_german must include normalized historical character references");

console.log(`culture name audit check passed: ${report.cultures.length} cultures`);
