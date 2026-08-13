import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const file = path.resolve(root, args.input || "output/historical-character-images/historical-character-images.json");
const report = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));

assert.equal(report.schema_version, 2, "图片报告 schema_version 应为 2");
assert.equal(report.source, "Wikidata and Wikimedia Commons", "图片报告来源不符合约定");
assert.ok(Array.isArray(report.people), "图片报告缺少 people 数组");
assert.ok(report.people.length > 0, "图片报告没有已确认人物");
assert.ok(Array.isArray(report.unmatched), "图片报告缺少 unmatched 数组");
assert.ok(Array.isArray(report.review), "图片报告缺少 review 数组");
assert.ok(Array.isArray(report.reviewed_without_image), "图片报告缺少 reviewed_without_image 数组");

const allowedTypes = new Set(["photograph", "painting", "print"]);
const allowedMatchMethods = new Set([
  "exact_name_and_birth_year",
  "derived_name_variant",
  "exact_name_and_starting_age",
]);
const templateKeys = new Set();
for (const person of report.people) {
  assert.ok(allowedMatchMethods.has(person.match_method), `${person.name_en} 缺少有效的人物匹配方式`);
  if (person.match_method === "derived_name_variant") {
    assert.ok(Array.isArray(person.matched_variants) && person.matched_variants.length > 0, `${person.name_en} 缺少别名匹配证据`);
    assert.ok(person.matched_variants.some((value) => String(value).trim().split(/\s+/).length >= 2), `${person.name_en} 的别名证据过短`);
  }
  assert.match(person.wikidata_id || "", /^Q\d+$/, `${person.name_en} 缺少有效的维基数据编号`);
  assert.ok(Array.isArray(person.character_keys) && person.character_keys.length > 0, `${person.name_en} 缺少角色模板键`);
  assert.ok(person.birth_year, `${person.name_en} 缺少出生年份`);
  assert.ok(person.image && typeof person.image === "object", `${person.name_en} 缺少图片记录`);
  assert.ok(allowedTypes.has(person.image.type), `${person.name_en} 的图片类型不在允许范围内`);
  assert.match(person.image.file_title || "", /^File:/, `${person.name_en} 缺少文件标题`);
  assert.match(person.image.file_page || "", /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, `${person.name_en} 缺少维基共享资源文件页`);
  assert.match(person.image.original_url || "", /^https:\/\/upload\.wikimedia\.org\//, `${person.name_en} 缺少原始图片地址`);
  assert.ok(person.image.license, `${person.name_en} 缺少许可信息`);
  assert.ok(person.image.identity_evidence, `${person.name_en} 缺少人物对应证据`);
  assert.equal(person.image.excluded_reason || "", "", `${person.name_en} 的已确认图片带有排除原因`);
  assert.ok(["automatic_rules", "manual_review"].includes(person.confirmation_method), `${person.name_en} 缺少有效的确认方式`);
  if (person.confirmation_method === "manual_review") {
    assert.match(person.image_review?.reviewed_at || "", /^\d{4}-\d{2}-\d{2}$/, `${person.name_en} 缺少人工复核日期`);
    assert.ok(person.image_review?.reason, `${person.name_en} 缺少人工复核理由`);
  }
  for (const key of person.character_keys) {
    assert.ok(!templateKeys.has(key), `角色模板 ${key} 被重复关联`);
    templateKeys.add(key);
  }
}

const allAccountedTemplateKeys = new Set(templateKeys);
for (const bucket of [report.reviewed_without_image, report.review, report.unmatched]) {
  for (const person of bucket) {
    for (const key of person.character_keys || []) {
      assert.ok(!allAccountedTemplateKeys.has(key), `角色模板 ${key} 在报告状态之间重复`);
      allAccountedTemplateKeys.add(key);
    }
  }
}

for (const person of report.review) {
  for (const candidate of person.image_candidates || []) {
    assert.match(candidate.thumbnail_url || "", /^https:\/\/upload\.wikimedia\.org\//, `${person.name_en} 的待复核候选缺少缩略图`);
    assert.ok(Object.hasOwn(candidate, "artist"), `${person.name_en} 的待复核候选缺少作者字段`);
    assert.ok(Object.hasOwn(candidate, "date"), `${person.name_en} 的待复核候选缺少图片日期字段`);
  }
}

const stats = report.stats || {};
assert.equal(stats.confirmed_people, report.people.length, "已确认人物统计不一致");
assert.equal(stats.confirmed_character_templates, templateKeys.size, "已确认角色模板统计不一致");
assert.equal(stats.confirmed_automatic_people + stats.confirmed_manual_review_people, report.people.length, "确认方式统计不一致");
assert.equal(stats.review_people, report.review.length, "待复核人物统计不一致");
assert.equal(stats.reviewed_without_image_people, report.reviewed_without_image.length, "已复核未收录人物统计不一致");
assert.equal(stats.reviewed_no_eligible_image_people + stats.reviewed_identity_ambiguous_people, report.reviewed_without_image.length, "已复核未收录原因统计不一致");
assert.equal(stats.unmatched_people, report.unmatched.length, "未匹配人物统计不一致");
assert.equal(
  allAccountedTemplateKeys.size + stats.excluded_fictional_character_templates,
  stats.source_character_templates,
  "角色模板没有全部归入确认、待复核、未匹配或明确排除状态",
);

const einstein = report.people.find((person) => person.character_keys.includes("albert_einstein_template"));
assert.ok(einstein, "爱因斯坦没有进入已确认图片集");
assert.equal(einstein.wikidata_id, "Q937", "爱因斯坦的维基数据编号不正确");
assert.equal(einstein.confirmation_method, "manual_review", "爱因斯坦应由人工复核确认");
assert.equal(einstein.image.type, "photograph", "爱因斯坦的图片类型应为照片");
assert.equal(einstein.image.file_title, "File:Einstein 1921 by F Schmutzer - restoration.jpg", "爱因斯坦使用了错误图片");

const jackson = report.people.find((person) => person.character_keys.includes("usa_andrew_jackson_template"));
assert.equal(jackson?.confirmation_method, "manual_review", "安德鲁·杰克逊应由人工复核确认");
assert.equal(jackson?.image.type, "painting", "安德鲁·杰克逊的图片类型应为肖像画");
const carmichaelConfirmed = report.people.find((person) => person.character_keys.includes("BIC_amy_carmichael"));
assert.equal(carmichaelConfirmed, undefined, "艾米·卡迈克尔的群像不应进入确认集");
const carmichaelReview = report.review.find((person) => person.character_keys.includes("BIC_amy_carmichael"));
assert.equal(carmichaelReview, undefined, "艾米·卡迈克尔不应继续留在待复核集");
const carmichaelReviewed = report.reviewed_without_image.find((person) => person.character_keys.includes("BIC_amy_carmichael"));
assert.equal(carmichaelReviewed?.decision, "no_eligible_image", "艾米·卡迈克尔应归入无合格图片终态");
assert.deepEqual(carmichaelReviewed?.candidate_file_titles, ["File:Amy Carmichael with children2.jpg"], "艾米·卡迈克尔终态的候选文件不正确");

console.log(JSON.stringify({
  confirmed_people: report.people.length,
  confirmed_character_templates: templateKeys.size,
  reviewed_without_image_people: report.reviewed_without_image.length,
  review_people: report.review.length,
  unmatched_people: report.unmatched.length,
}));

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    result[arg.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true;
  }
  return result;
}
