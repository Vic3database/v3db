import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const readChunk = (file) => {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window.VIC3_DATA_CHUNK;
};
const baseline = readJson(path.join(root, "database", "vic3_1.13.11", "buildings.json"));
const vc = readChunk(path.join(root, "site", "vc", "data-buildings.js")).buildings;
const baselineByKey = new Map(baseline.map((item) => [item.key, item]));
const adjusted = vc.filter((item) => item.vc_change_kind === "adjusted");
assert(adjusted.length > 0, "VC should contain at least one adjusted building");
for (const item of adjusted) assert(item.vc_change_fields?.length > 0, `${item.key} must expose changed fields`);
const banana = vc.find((item) => item.key === "building_banana_plantation");
assert.equal(banana?.vc_change_kind, "adjusted", "banana plantation should be marked adjusted");
assert(banana.vc_change_fields.includes("combination_count"), "banana plantation should identify combination_count");
for (const [key, label] of [["building_electrics_industry", "electronics factory"], ["building_synthetics_plant", "synthetics plant"]]) {
  const item = vc.find((row) => row.key === key);
  assert.equal(item?.vc_change_kind, "adjusted", `${label} should inherit adjusted status from changed production methods`);
  assert(item.vc_change_fields.includes("production_method_values"), `${label} should identify production-method value changes`);
}
for (const item of vc) {
  if (!baselineByKey.has(item.key)) assert.equal(item.vc_change_kind, "added", `${item.key} must be added or baseline-known`);
}
const economySource = fs.readFileSync(path.join(root, "site", "app", "economy.js"), "utf8");
assert.match(economySource, /economyChangeBadgeHtml\(building\)/, "building cards must render VC badges");
assert.match(economySource, /economyDetailHead\(building, "buildings", "building"\)/, "building details must render the badge in the title");
console.log(JSON.stringify({
  victorian_century_building_change_tags: "ok",
  adjusted: adjusted.map((item) => ({ key: item.key, fields: item.vc_change_fields })),
}, null, 2));
