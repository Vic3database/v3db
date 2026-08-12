import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(root, "output", "historical-characters", "historical-characters.json");

assert.ok(fs.existsSync(reportPath), `missing historical character report: ${reportPath}`);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8").replace(/^\uFEFF/, ""));

assert.equal(report.source_game_branch, "release/1.13.9", "unexpected game branch");
assert.equal(report.stats.historical_character_templates, 1983, "unexpected historical character count");
assert.equal(report.stats.invalid_dna_references, 0, "historical character DNA references must resolve");
assert.equal(report.characters.length, report.stats.historical_character_templates, "character count does not match stats");

const keys = new Set(report.characters.map((character) => character.key));
assert.equal(keys.size, report.characters.length, "historical character template keys must be unique");

const expected = new Map([
  ["gbr_queen_victoria_template", { name_zh: "维多利亚 汉诺威", dna_key: "dna_queen_victoria", traits: ["direct"] }],
  ["PRU_otto_von_bismarck", { name_zh: "奥托 冯·俾斯麦", dna_key: "dna_otto_von_bismarck", traits: ["persistent", "ambitious", "masterful_diplomat", "experienced_political_operator", "demagogue"] }],
  ["chi_cixi_template", { name_zh: "慈禧 叶赫那拉", dna_key: "dna_empress_dowager_cixi", traits: ["ambitious", "reckless", "experienced_political_operator"] }],
  ["JAP_meiji_yamato", { name_zh: "睦仁 大和", dna_key: "dna_emperor_meiji", traits: ["innovative", "charismatic"] }],
  ["usa_lincoln_character_template", { name_zh: "亚伯拉罕 林肯", dna_key: "dna_abraham_lincoln", traits: ["experienced_political_operator", "inspirational_orator", "tactful"] }],
]);
for (const [template, values] of expected) {
  const character = report.characters.find((item) => item.key === template);
  assert.ok(character, `missing representative character: ${template}`);
  assert.equal(character.historical, true, `${template} must be historical`);
  assert.equal(character.name_zh, values.name_zh, `${template} has unexpected Chinese name`);
  assert.equal(character.dna_key, values.dna_key, `${template} has unexpected DNA key`);
  assert.deepEqual(character.traits, values.traits, `${template} has unexpected traits`);
}

console.log(`historical character audit check passed: ${report.characters.length} records`);
