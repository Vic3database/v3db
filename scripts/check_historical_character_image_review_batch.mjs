import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const reportFile = path.resolve(root, "output/historical-character-images/historical-character-images.json");
const batchFile = path.resolve(root, "output/historical-character-images/review-batch.json");
execFileSync(process.execPath, ["scripts/build_historical_character_image_review_batch.mjs", "--limit", "25"], { cwd: root, stdio: "pipe" });

const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
const batch = JSON.parse(fs.readFileSync(batchFile, "utf8"));
assert.equal(batch.schema_version, 1, "审核批次 schema_version 应为 1");
assert.equal(batch.count, 25, "默认审核批次应包含 25 人");
assert.equal(batch.people.length, 25, "审核批次人数与 count 不一致");
assert.ok(Array.isArray(batch.selection_order) && batch.selection_order.length === 6, "审核批次缺少完整选择顺序");

const reviewKeys = new Set(report.review.map((person) => personKey(person)));
const batchKeys = batch.people.map((person) => personKey(person));
assert.equal(new Set(batchKeys).size, batchKeys.length, "审核批次包含重复人物");
for (const key of batchKeys) assert.ok(reviewKeys.has(key), `审核批次人物不在待复核集合：${key}`);

const expected = [...report.review].sort(comparePeople).slice(0, 25).map((person) => personKey(person));
assert.deepEqual(batchKeys, expected, "审核批次没有按约定的稳定优先级排序");
for (const person of batch.people) {
  assert.ok(Array.isArray(person.character_keys) && person.character_keys.length, `${person.name_en} 缺少角色键`);
  assert.ok(Array.isArray(person.image_candidates), `${person.name_en} 缺少图片候选数组`);
}

console.log(JSON.stringify({ historical_character_image_review_batch: "ok", people: batch.people.length }));

function comparePeople(left, right) {
  return priority(left) - priority(right)
    || String(left.name_en || "").localeCompare(String(right.name_en || ""), "en")
    || personKey(left).localeCompare(personKey(right), "en");
}

function priority(person) {
  const imageCount = person.image_candidates?.length || 0;
  if (person.match_method === "exact_name_and_birth_year" && imageCount === 1) return 0;
  if (person.match_method === "exact_name_and_birth_year" && imageCount > 1) return 1;
  if (person.match_method === "derived_name_variant") return 2;
  if (person.match_method === "exact_name_and_starting_age") return 3;
  if (person.wikidata_candidates?.length === 1 && imageCount === 0) return 4;
  return 5;
}

function personKey(person) {
  return [...(person.character_keys || [])].sort().join("\u0001");
}
