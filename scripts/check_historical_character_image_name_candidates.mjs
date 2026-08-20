import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), process.argv[2] || "output/historical-character-images/historical-character-image-name-candidates.json");
const report = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
assert.equal(report.schema_version, 1, "姓名候选报告 schema_version 应为 1");
assert.ok(Array.isArray(report.candidates), "姓名候选报告缺少 candidates 数组");
assert.ok(Array.isArray(report.unmatched), "姓名候选报告缺少 unmatched 数组");
for (const person of report.candidates) {
  assert.ok(person.name_en && person.birth_year, "姓名候选缺少原始姓名或出生年份");
  assert.ok(Array.isArray(person.wikidata_candidates) && person.wikidata_candidates.length > 0, `${person.name_en} 缺少人物实体候选`);
  for (const candidate of person.wikidata_candidates) {
    assert.match(candidate.wikidata_id || "", /^Q\d+$/, `${person.name_en} 的候选编号无效`);
    assert.ok(Array.isArray(candidate.matched_variants) && candidate.matched_variants.length > 0, `${person.name_en} 缺少命中的姓名变体`);
    assert.equal(Number(String(candidate.birth).slice(0, 4)), person.birth_year, `${person.name_en} 的候选出生年份不一致`);
  }
}
assert.equal(report.stats.candidate_people, report.candidates.length, "候选人数统计不一致");
assert.equal(report.stats.unmatched_people, report.unmatched.length, "未命中人数统计不一致");
console.log(JSON.stringify(report.stats));
