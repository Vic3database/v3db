import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const databaseDir = path.join(root, "database", process.argv[2] || "vic3_1.13.9");
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
const isVictorianCentury = index.dataset_name === "Victorian Century";

assert.equal(buildings.length, 101, "picture wall must contain 101 icon-bearing buildings");
assert.equal(excludedGraphicalBuildings.length, 14, "only fourteen iconless decorative buildings may be excluded");
assert.equal(buildings.length + excludedGraphicalBuildings.length, 115, "all 115 top-level building definitions must be accounted for");
assert.equal(goods.length, 53, "all 53 base goods must be published");
assert.equal(prestigeGoods.length, isVictorianCentury ? 96 : 72, isVictorianCentury ? "Victorian Century must publish all 96 active prestige goods" : "all 72 base-game prestige goods must be published");
assert(groups.length > 0, "building groups must be published");
assert(productionMethodGroups.length > 0, "production method groups must be published");
assert(productionMethods.length > 0, "production methods must be published");

const productionEffectScalingCounts = productionMethods
  .flatMap((method) => method.effects || [])
  .reduce((counts, effect) => {
    const scaling = effect.scaling || "missing";
    counts[scaling] = (counts[scaling] || 0) + 1;
    return counts;
  }, {});
assert.deepEqual(
  productionEffectScalingCounts,
  isVictorianCentury
    ? { workforce_scaled: 976, level_scaled: 761, unscaled: 189 }
    : { workforce_scaled: 974, level_scaled: 761, unscaled: 182 },
  "all production effects must preserve their game-defined scaling mode",
);

const buildingByKey = new Map(buildings.map((item) => [item.key, item]));
assert.deepEqual(
  required(buildingByKey, "building_barrack", "barracks").aliases,
  ["building_barracks"],
  "building compatibility aliases must be preserved from the game definition",
);
assert.equal(
  buildings.reduce((count, building) => count + (building.aliases || []).length, 0),
  19,
  "the 1.13.10 base database must preserve all nineteen building compatibility aliases",
);
const groupByKey = new Map(productionMethodGroups.map((item) => [item.key, item]));
const methodByKey = new Map(productionMethods.map((item) => [item.key, item]));
const conditionPairs = (key) => required(methodByKey, key, "production method").availability_conditions.map((condition) => [condition.kind, condition.raw]);
const boardOrderedBuildings = [...buildings].sort((left, right) => (
  Number(left.board_group?.order || 999) - Number(right.board_group?.order || 999)
  || Number(left.board_group?.cluster_order || 999) - Number(right.board_group?.cluster_order || 999)
  || Number(left.board_group?.item_order || 999) - Number(right.board_group?.item_order || 999)
));
assert.deepEqual(
  [...new Set(boardOrderedBuildings.map((building) => building.board_group?.key))],
  ["agriculture", "resources", "industry", "military", "infrastructure", "ownership", "wonders"],
  "building board must publish the seven confirmed display groups in order",
);
assert.deepEqual(
  [...new Set(boardOrderedBuildings.filter((building) => building.board_group?.key === "agriculture").map((building) => building.board_group?.cluster_key))],
  ["staple_crops", "ranching", "vineyard", "plantations", "subsistence"],
  "agriculture must place staple farms, ranches, vineyards, plantations, then subsistence buildings",
);
assert.deepEqual(
  [...new Set(boardOrderedBuildings.filter((building) => building.board_group?.key === "resources").map((building) => building.board_group?.cluster_key))],
  ["mining", "gold_fields", "logging", "rubber", "oil", "fishing", "whaling"],
  "resources must keep mines, gold fields, logging, rubber, oil, fishing, then whaling together",
);
assert.deepEqual(
  boardOrderedBuildings.filter((building) => building.board_group?.key === "resources").map((building) => building.key),
  ["building_gold_mine", "building_sulfur_mine", "building_coal_mine", "building_lead_mine", "building_iron_mine", "building_gold_field", "building_logging_camp", "building_rubber_plantation", "building_oil_rig", "building_fishing_wharf", "building_whaling_station"],
  "resource buildings must preserve the confirmed display order",
);
assert.deepEqual(
  ["agriculture", "resources", "industry", "military", "infrastructure", "ownership", "wonders"].map((key) => boardOrderedBuildings.filter((building) => building.board_group?.key === key).length),
  [21, 11, 17, 6, 13, 4, 29],
  "all 101 buildings must be assigned to exactly one confirmed display group",
);
assert.equal(required(buildingByKey, "building_shipyard", "shipyard").board_group?.key, "industry", "shipyard must be an industrial building");
assert.equal(required(buildingByKey, "building_shipyard", "shipyard").board_group?.cluster_key, "light_industry", "shipyard must sit with light industry");
for (const key of ["building_arms_industry", "building_munition_plant", "building_artillery_foundry"]) {
  assert.equal(required(buildingByKey, key, "military industry building").board_group?.key, "industry", `${key} must remain in industry`);
}
assert.equal(required(groupByKey, "pmg_dummy", "dummy production-method group").icon, null, "the iconless dummy group must remain explicit");
assert.equal(required(methodByKey, "pm_dummy", "dummy production method").icon, null, "the iconless dummy method must remain explicit");
assert(typeof required(methodByKey, "pm_combustion_derricks", "combustion derricks").loc?.description === "string", "production methods must reference a localized description field");
const fertilizationDroughtEffect = required(methodByKey, "pm_fertilization", "fertilization")
  .effects
  .find((effect) => effect.key === "state_harvest_condition_drought_impact_mult");
assert.deepEqual(
  fertilizationDroughtEffect && {
    scope: fertilizationDroughtEffect.scope,
    scaling: fertilizationDroughtEffect.scaling,
    value: fertilizationDroughtEffect.value,
  },
  { scope: "state", scaling: "unscaled", value: 0.05 },
  "fertilization must retain its unscaled drought effect",
);
assert.deepEqual(
  conditionPairs("pm_company_headquarter_government_run"),
  [["required_law", "law_command_economy"]],
  "government-run company headquarters must require command economy",
);
assert.deepEqual(
  conditionPairs("pm_company_headquarter_worker_cooperative"),
  [["required_law", "law_cooperative_ownership"]],
  "worker-cooperative company headquarters must require cooperative ownership",
);
assert.deepEqual(
  conditionPairs("pm_company_headquarter_privately_owned"),
  [["disallowed_law", "law_command_economy"], ["disallowed_law", "law_cooperative_ownership"]],
  "privately owned company headquarters must be unavailable under command economy and cooperative ownership",
);
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

const goodsByKey = new Map(goods.map((item) => [item.key, item]));
const oil = required(goodsByKey, "oil", "oil good");
assert(oil.producing_buildings.some((building) => building.key === "building_oil_rig"), "oil must link to oil rig");
const rubber = required(goodsByKey, "rubber", "rubber good");
const rubberPlantation = required(buildingByKey, "building_rubber_plantation", "rubber plantation");
assert.deepEqual(
  rubberPlantation.production_method_group_keys.map((key) => [key, required(groupByKey, key, key).production_method_keys.length]),
  [["pmg_base_building_rubber_plantation", 2], ["pmg_rubber_exploitation", 3], ["pmg_train_automation_building_rubber_plantation", 2]],
  "rubber plantation must retain all seven production-method choices",
);
assert.equal(
  required(methodByKey, "default_building_rubber_plantation", "default rubber production").effects.find((effect) => effect.key === "goods_output_rubber_add")?.value,
  20,
  "default rubber production must output twenty rubber",
);
assert.equal(
  required(methodByKey, "automatic_irrigation_building_rubber_plantation", "automatic rubber production").effects.find((effect) => effect.key === "goods_output_rubber_add")?.value,
  40,
  "automatic irrigation must output forty rubber",
);
assert.equal(rubber.price, 40, "rubber must retain its standard price");
assert.equal(rubber.tradeable, true, "rubber must be tradeable by default");
assert.equal(rubber.is_local, false, "rubber must not be a local good");
assert.equal(rubber.fixed_price, false, "rubber must use a market price");
assert.equal(rubber.traded_quantity, 5, "rubber must retain its defined traded quantity");
assert.equal(rubber.convoy_cost_multiplier, 1, "rubber must use the default merchant-marine multiplier");
assert.equal(required(goodsByKey, "electricity", "electricity good").traded_quantity, 10, "goods without a traded quantity must use the default value");
assert(rubber.producing_buildings.some((item) => item.key === "building_rubber_plantation"), "rubber plantation must produce rubber");
assert(required(goodsByKey, "tools", "tools good").consuming_buildings.length > 0, "tools must list consuming buildings");
const grainNeed = required(goodsByKey, "grain", "grain good").pop_needs.find((need) => need.key === "popneed_basic_food");
assert(grainNeed, "grain must satisfy basic food");
assert.equal(grainNeed.is_default, true, "grain must be the default basic food");
assert.deepEqual(grainNeed.wealth_levels.slice(0, 4), [1, 2, 3, 4], "basic food must be purchased from wealth level one");
assert.equal(required(goodsByKey, "oil", "oil good").pop_needs.find((need) => need.key === "popneed_heating")?.weight, 3, "oil must have heating weight three");
assert(required(goodsByKey, "coffee", "coffee good").obsessed_cultures.some((item) => item.key === "afro_brazilian"), "Afro-Brazilian culture must be obsessed with coffee");
assert(required(goodsByKey, "meat", "meat good").taboo_cultures.some((item) => item.key === "japanese"), "Japanese culture must treat meat as taboo");
assert(required(goodsByKey, "meat", "meat good").taboo_religions.some((item) => item.key === "hindu"), "Hinduism must treat meat as taboo");
assert(required(goodsByKey, "liquor", "liquor good").taboo_religions.some((item) => item.key === "sunni"), "Sunni Islam must treat liquor as taboo");
assert(prestigeGoods.some((item) => item.companies?.length), "at least one prestige good must list possible companies");
for (const key of ["services", "transportation", "electricity", "gold"]) {
  assert(required(goodsByKey, key, `${key} good`), `${key} must remain a good`);
}

for (const building of buildings) {
  assert(building.icon?.source && building.icon?.site_path, `${building.key} must declare an icon source and output path`);
  assert(building.loc?.name || building.loc?.nameFallback, `${building.key} must expose a localized name reference`);
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
