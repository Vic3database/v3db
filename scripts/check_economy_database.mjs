import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const databaseDir = path.join(root, "database", "vic3_1.13.9");
const index = readJson(path.join(databaseDir, "index.json"));

for (const key of [
  "buildings",
  "building_groups",
  "production_method_groups",
  "production_methods",
  "goods",
  "prestige_goods",
  "excluded_graphical_buildings",
]) {
  assert(index.files?.[key], `database index must declare ${key}`);
}

const buildings = readFile("buildings");
const groups = readFile("building_groups");
const productionMethodGroups = readFile("production_method_groups");
const productionMethods = readFile("production_methods");
const goods = readFile("goods");
const prestigeGoods = readFile("prestige_goods");
const excludedGraphicalBuildings = readFile("excluded_graphical_buildings");

assert.equal(buildings.length, 101, "1.13.9 picture wall must contain 101 icon-bearing buildings");
assert.equal(excludedGraphicalBuildings.length, 14, "only fourteen iconless decorative buildings may be excluded");
assert.equal(buildings.length + excludedGraphicalBuildings.length, 115, "all 115 top-level building definitions must be accounted for");
assert.equal(goods.length, 53, "all 53 base goods must be published");
assert.equal(prestigeGoods.length, 72, "all 72 prestige goods must be published");
assert(groups.length > 0, "building groups must be published");
assert(productionMethodGroups.length > 0, "production method groups must be published");
assert(productionMethods.length > 0, "production methods must be published");

const buildingByKey = new Map(buildings.map((item) => [item.key, item]));
const groupByKey = new Map(productionMethodGroups.map((item) => [item.key, item]));
const methodByKey = new Map(productionMethods.map((item) => [item.key, item]));
assert.equal(required(groupByKey, "pmg_dummy", "dummy production-method group").icon, null, "the iconless dummy group must remain explicit");
assert.equal(required(methodByKey, "pm_dummy", "dummy production method").icon, null, "the iconless dummy method must remain explicit");
assert(typeof required(methodByKey, "pm_combustion_derricks", "combustion derricks").description_zh === "string", "production methods must expose a localized description field");
const oilRig = required(buildingByKey, "building_oil_rig", "oil rig building");
assert.deepEqual(
  oilRig.production_method_group_keys.map((key) => [key, required(groupByKey, key, `oil rig group ${key}`).production_method_keys.length]),
  [["pmg_base_building_oil_rig", 2], ["pmg_transportation_building_oil_rig", 3]],
  "oil rig must retain its two-by-three production-method choices",
);
assert.equal(oilRig.combination_count, 6, "oil rig must publish all six combinations");
assert.equal(oilRig.resource_map_available, true, "oil rig must open the resource distribution map");
assert.equal(oilRig.resource_map_kind, "resource", "oil rig must select capped-resource distribution");
assert.equal(required(buildingByKey, "building_wheat_farm", "wheat farm").resource_map_kind, "arable", "wheat farm must select arable-land distribution");

const oil = required(new Map(goods.map((item) => [item.key, item])), "oil", "oil good");
assert(oil.producing_buildings.some((building) => building.key === "building_oil_rig"), "oil must link to oil rig");
for (const key of ["services", "transportation", "electricity", "gold"]) {
  assert(required(new Map(goods.map((item) => [item.key, item])), key, `${key} good`), `${key} must remain a good`);
}

for (const building of buildings) {
  assert(building.icon?.source && building.icon?.site_path, `${building.key} must declare an icon source and output path`);
  assert(building.name_zh || building.name_fallback_zh, `${building.key} must expose a readable Chinese name`);
}
for (const item of excludedGraphicalBuildings) {
  assert.equal(item.reason, "missing_icon", `${item.key} must record its exclusion reason`);
}

console.log(JSON.stringify({
  economy_database: "ok",
  buildings: buildings.length,
  excluded_graphical_buildings: excludedGraphicalBuildings.length,
  goods: goods.length,
  prestige_goods: prestigeGoods.length,
  production_method_groups: productionMethodGroups.length,
  production_methods: productionMethods.length,
}, null, 2));

function readFile(key) {
  return readJson(path.join(databaseDir, index.files[key]));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function required(map, key, label) {
  const value = map.get(key);
  assert(value, `missing ${label}: ${key}`);
  return value;
}
