import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.resolve(root, process.argv[2] || "site/versions/1.13.9/data-character-images.js");
const source = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
assert.ok(!source.includes("�"), "角色图片数据块包含 Unicode 替换字符");
const prefix = "window.VIC3_DATA_CHUNK = ";
assert.ok(source.startsWith(prefix), "角色图片数据块缺少 VIC3_DATA_CHUNK 赋值");
const data = JSON.parse(source.slice(prefix.length).replace(/;\s*$/, ""));
assert.ok(Array.isArray(data.historicalCharacterImages), "角色图片数据块缺少 historicalCharacterImages 数组");
assert.ok(data.historicalCharacterImages.length > 0, "角色图片数据块没有已确认图片");
assert.equal(data.historicalCharacterImageStats.confirmed_people, data.historicalCharacterImages.length, "图片人数统计不一致");

const keys = new Set();
for (const person of data.historicalCharacterImages) {
  assert.match(person.wikidata_id || "", /^Q\d+$/, `${person.name_en} 缺少维基数据编号`);
  assert.match(person.image.file_page || "", /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, `${person.name_en} 缺少文件页`);
  assert.ok(person.image.thumbnail_url, `${person.name_en} 缺少缩略图地址`);
  assert.ok(person.image.license, `${person.name_en} 缺少许可`);
  for (const key of person.character_keys || []) {
    assert.ok(!keys.has(key), `角色模板 ${key} 重复`);
    keys.add(key);
  }
}
assert.equal(data.historicalCharacterImageStats.confirmed_character_templates, keys.size, "模板覆盖统计不一致");
assert.equal(data.historicalCharacterImageStats.confirmed_manual_review_people, 125, "人工复核人数统计不一致");
const einstein = data.historicalCharacterImages.find((person) => person.character_keys.includes("albert_einstein_template"));
assert.ok(einstein, "角色图片数据块缺少爱因斯坦");
assert.equal(einstein.confirmation_method, "manual_review", "爱因斯坦应由人工复核确认");
assert.equal(einstein.image.file_title, "File:Einstein 1921 by F Schmutzer - restoration.jpg", "爱因斯坦使用了错误图片");
console.log(JSON.stringify({ people: data.historicalCharacterImages.length, templates: keys.size }));
