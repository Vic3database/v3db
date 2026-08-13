import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateImageReviewDocument } from "./lib/historical_character_images.mjs";

const root = process.cwd();
const file = path.resolve(root, process.argv[2] || "scripts/data/historical-character-image-reviews.json");
const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const { image_reviews: reviews, person_reviews: personReviews } = validateImageReviewDocument(data);
assert.equal(reviews.length, 137, "图片复核记录总数不一致");
assert.equal(personReviews.length, 12, "人物终态总数不一致");
assert.equal(reviews.filter((review) => review.decision === "approve").length, 125, "已批准图片总数不一致");
assert.equal(reviews.filter((review) => review.decision === "reject").length, 12, "已拒绝图片总数不一致");
const einstein = reviews.find((review) => review.character_keys.includes("albert_einstein_template"));
assert.ok(einstein, "人工复核文件缺少爱因斯坦记录");
assert.equal(einstein.wikidata_id, "Q937", "爱因斯坦记录的维基数据编号不正确");
assert.equal(einstein.file_title, "File:Einstein 1921 by F Schmutzer - restoration.jpg", "爱因斯坦记录的图片文件不正确");
assert.equal(einstein.decision, "approve", "爱因斯坦记录应为批准");
assert.equal(einstein.type, "photograph", "爱因斯坦记录应归类为照片");
const jackson = reviews.find((review) => review.character_keys.includes("usa_andrew_jackson_template"));
assert.equal(jackson?.type, "painting", "安德鲁·杰克逊记录应归类为肖像画");
const carmichael = reviews.find((review) => review.character_keys.includes("BIC_amy_carmichael"));
assert.equal(carmichael?.decision, "reject", "艾米·卡迈克尔群像应被人工拒绝");
assert.equal(carmichael?.file_title, "File:Amy Carmichael with children2.jpg", "艾米·卡迈克尔拒绝记录的文件不正确");
const carmichaelPerson = personReviews.find((review) => review.character_keys.includes("BIC_amy_carmichael"));
assert.equal(carmichaelPerson?.decision, "no_eligible_image", "艾米·卡迈克尔应标记为无合格图片");
assert.deepEqual(carmichaelPerson?.wikidata_ids, ["Q481824"], "艾米·卡迈克尔人物终态的编号不正确");
assert.deepEqual(carmichaelPerson?.candidate_file_titles, ["File:Amy Carmichael with children2.jpg"], "艾米·卡迈克尔人物终态的候选文件不正确");
const cauacu = personReviews.find((review) => review.character_keys.includes("BRZ_anesia_cauacu"));
assert.equal(cauacu?.decision, "no_eligible_image", "阿内夏·考阿苏应标记为无合格图片");
for (const key of ["agitator_alexandru_bogdan_pitesti", "SWE_anders_danielsson", "GBR_andrew_scott_waugh"]) {
  assert.equal(personReviews.find((review) => review.character_keys.includes(key))?.decision, "no_eligible_image", `${key} 应标记为无合格图片`);
}
for (const key of ["DEN_arnold_peter_moller", "mug_bakht_khan"]) {
  assert.equal(personReviews.find((review) => review.character_keys.includes(key))?.decision, "no_eligible_image", `${key} 应标记为无合格图片`);
}
assert.equal(personReviews.find((review) => review.character_keys.includes("gbr_admiral_beatty"))?.decision, "no_eligible_image", "gbr_admiral_beatty 应标记为无合格图片");
for (const key of ["BIC_dwarkanath_tagore", "sar_general_de_sonnaz"]) {
  assert.equal(personReviews.find((review) => review.character_keys.includes(key))?.decision, "no_eligible_image", `${key} 应标记为无合格图片`);
}
for (const key of ["VNZ_francisco_linares_alcantara", "AST_george_fife_angas"]) {
  assert.equal(personReviews.find((review) => review.character_keys.includes(key))?.decision, "no_eligible_image", `${key} 应标记为无合格图片`);
}
const koumoundouros = reviews.find((review) => review.character_keys.includes("GRE_alexandros_koumoundouros"));
assert.equal(koumoundouros?.type, "painting", "亚历山德罗斯·库蒙祖罗斯应使用肖像画");
const ganz = reviews.find((review) => review.character_keys.includes("HUN_abraham_ganz"));
assert.equal(ganz?.type, "print", "亚伯拉罕·甘茨应使用版画");
console.log(JSON.stringify({ historical_character_image_reviews: "ok", image_reviews: reviews.length, person_reviews: personReviews.length }));
