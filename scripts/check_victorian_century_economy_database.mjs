import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const database = path.resolve(
  process.env.VICTORIAN_CENTURY_DATABASE || "database/victorian_century",
);
const read = (file) => JSON.parse(
  fs.readFileSync(path.join(database, file), "utf8").replace(/^\uFEFF/, ""),
);
const index = read("index.json");
const rows = (key) => read(index.files[key]);
const buildings = rows("buildings");
const buildingGroups = rows("building_groups");
const productionMethodGroups = rows("production_method_groups");
const productionMethods = rows("production_methods");
const goods = rows("goods");
const prestigeGoods = rows("prestige_goods");
const locales = Object.fromEntries(["zh-Hans", "en"].map((locale) => [
  locale,
  read(index.locales.files[locale].file),
]));
const byKey = (items) => new Map(items.map((item) => [item.key, item]));
const buildingByKey = byKey(buildings);
const groupByKey = byKey(productionMethodGroups);
const methodByKey = byKey(productionMethods);
const goodByKey = byKey(goods);
const effect = (method, key) => methodByKey
  .get(method)
  ?.effects
  .find((item) => item.key === key)
  ?.value;
const conditionPairs = (key) => methodByKey
  .get(key)
  ?.availability_conditions
  .map((condition) => [condition.kind, condition.raw]);

assert.equal(buildings.length, 101);
assert.equal(new Set(buildings.map((item) => item.key)).size, buildings.length);
assert.equal(buildingGroups.length, 69);
assert.equal(productionMethodGroups.length, 197);
assert.equal(goods.length, 53);
assert.equal(prestigeGoods.length, 98);
assert.equal(productionMethods.length, 437);
const productionEffectScalingCounts = productionMethods
  .flatMap((method) => method.effects || [])
  .reduce((counts, item) => {
    const scaling = item.scaling || "missing";
    counts[scaling] = (counts[scaling] || 0) + 1;
    return counts;
  }, {});
for (const scaling of ["unscaled", "workforce_scaled", "level_scaled"]) {
  assert(productionEffectScalingCounts[scaling] > 0, `Victorian Century production effects must include ${scaling}`);
}
const fertilizationDroughtEffect = methodByKey
  .get("pm_fertilization")
  ?.effects
  .find((item) => item.key === "state_harvest_condition_drought_impact_mult");
assert.deepEqual(
  fertilizationDroughtEffect && {
    scope: fertilizationDroughtEffect.scope,
    scaling: fertilizationDroughtEffect.scaling,
    value: fertilizationDroughtEffect.value,
  },
  { scope: "state", scaling: "unscaled", value: 0.05 },
);
assert.equal(effect("pm_wooden_buildings", "goods_input_fabric_add"), 30);
assert.equal(effect("pm_wooden_buildings", "goods_input_wood_add"), 90);
assert.equal(effect("pm_wooden_buildings", "state_construction_mult"), 0.001);
assert.equal(effect("pm_dye_production", "goods_input_fertilizer_add"), 25);
assert.equal(effect("pm_telephones", "goods_input_rubber_add"), 10);
assert.deepEqual(
  conditionPairs("pm_company_headquarter_government_run"),
  [["required_law", "law_command_economy"]],
);
assert.deepEqual(
  conditionPairs("pm_company_headquarter_worker_cooperative"),
  [["required_law", "law_cooperative_ownership"]],
);
assert.deepEqual(
  conditionPairs("pm_company_headquarter_privately_owned"),
  [["disallowed_law", "law_command_economy"], ["disallowed_law", "law_cooperative_ownership"]],
);
assert.deepEqual(
  groupByKey.get("pmg_banana_exploitation").production_method_keys,
  [
    "default_labour",
    "slave_exploitation_banana",
    "worker_exploitation_banana",
    "united_fruit_banana",
  ],
);
assert.equal(
  buildings.filter((item) => item.key === "building_opium_plantation").length,
  1,
);
assert(
  buildings.filter((item) => item.patch_directives.length > 0).length >= 43,
);
assert.deepEqual(
  buildingByKey.get("building_opium_plantation").patch_directives,
  ["REPLACE"],
);
assert(
  prestigeGoods.some(
    (item) => item.key === "prestige_good_benz_car"
      && item.base_good_key === "automobiles",
  ),
);
assert(
  goodByKey.get("automobiles").prestige_good_keys.includes("prestige_good_benz_car"),
);
const localizedName = (item, locale) => locales[locale][item.loc.name];
assert.equal(
  localizedName(byKey(prestigeGoods).get("prestige_good_basmati_rise"), "en"),
  "Basmati Rice",
);
assert.equal(
  localizedName(byKey(prestigeGoods).get("prestige_good_irontill_series"), "en"),
  "Ironclad Tools",
);
assert.equal(localizedName(buildingByKey.get("building_machu_picchu"), "en"), "Machu Picchu");
assert.equal(localizedName(buildingByKey.get("building_machu_picchu"), "zh-Hans"), "马丘比丘");
assert.equal(localizedName(goodByKey.get("wood"), "zh-Hans"), "木材");

for (const group of productionMethodGroups) {
  for (const key of group.production_method_keys) {
    assert(methodByKey.has(key), `${group.key} -> ${key}`);
  }
}
for (const item of prestigeGoods) {
  assert(goodByKey.has(item.base_good_key), `${item.key} -> ${item.base_good_key}`);
}

console.log(JSON.stringify({
  vc_economy_database: "ok",
  buildings: buildings.length,
  building_groups: buildingGroups.length,
  production_method_groups: productionMethodGroups.length,
  production_methods: productionMethods.length,
  goods: goods.length,
  prestige_goods: prestigeGoods.length,
}, null, 2));
