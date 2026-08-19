import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "site/app/company-composer-core.js"), "utf8");
const context = { window: {} };
vm.runInNewContext(source, context, { filename: "company-composer-core.js" });

const { composeCompanyBuildings } = context.window.COMPANY_COMPOSER_CORE || {};
assert.equal(typeof composeCompanyBuildings, "function", "composer core must expose composeCompanyBuildings");

const buildingGroups = [
  { key: "resources", buildingKeys: ["building_coal_mine", "building_iron_mine"] },
  { key: "agriculture", buildingKeys: ["building_wheat_farm"] },
  { key: "light_industry", buildingKeys: ["building_tooling_workshop"] },
  { key: "heavy_military", buildingKeys: ["building_steel_mill"] },
  { key: "infrastructure", buildingKeys: ["building_railway"] },
];

const companies = [
  {
    key: "company_alpha",
    building_types: [{ key: "building_coal_mine" }, { key: "building_tooling_workshop" }, { key: "building_tooling_workshop" }],
    extension_building_types: [{ key: "building_steel_mill" }, { key: "building_railway" }],
    possible_prestige_goods: [{ key: "prestige_tool" }],
    referenced_cultures: [{ key: "culture_han" }],
    referenced_countries: [{ key: "c:CHI" }],
    prosperity_modifiers: [
      { category: { key: "building" }, key: "building_tooling_workshop_throughput_add", value: 0.1, value_raw: "0.1", loc: { name: "tooling" } },
      { category: { key: "state" }, key: "state_trade_advantage_mult", value: "invalid", value_raw: "yes", loc: { name: "trade" } },
    ],
  },
  {
    key: "company_beta",
    building_types: [{ key: "building_iron_mine" }, { key: "building_tooling_workshop" }],
    extension_building_types: [],
    possible_prestige_goods: [{ key: "prestige_tool" }, { key: "prestige_steel" }],
    referenced_cultures: [{ key: "culture_han" }, { key: "culture_yue" }],
    referenced_countries: [{ key: "c:CHI" }, { key: "c:JAP" }],
    prosperity_modifiers: [
      { category: { key: "building" }, key: "building_tooling_workshop_throughput_add", value: 0.05, value_raw: "0.05", loc: { name: "tooling" } },
      { category: { key: "building" }, key: "building_steel_mill_throughput_add", value: 0.2, value_raw: "0.2", loc: { name: "steel" } },
      { category: { key: "state" }, key: "state_trade_advantage_mult", value: "invalid", value_raw: "yes", loc: { name: "trade" } },
    ],
  },
  {
    key: "company_gamma",
    building_types: [{ key: "building_wheat_farm" }, { key: "building_unclassified" }],
    extension_building_types: [{ key: "building_railway" }],
    possible_prestige_goods: [],
    referenced_cultures: [],
    referenced_countries: [],
    prosperity_modifiers: [],
  },
  {
    key: "company_delta",
    building_types: [],
    extension_building_types: [{ key: "building_tooling_workshop" }],
    possible_prestige_goods: [],
    referenced_cultures: [],
    referenced_countries: [],
    prosperity_modifiers: [],
  },
];

const summary = composeCompanyBuildings({
  companies,
  selectedCompanyKeys: ["company_beta", "company_alpha", "company_beta", "missing_company", "company_gamma"],
  selectedExtensions: {
    company_alpha: "building_steel_mill",
    company_gamma: "building_invalid",
  },
  buildingGroups,
});

assert.deepEqual(Array.from(summary.selectedCompanies, (company) => company.key), ["company_beta", "company_alpha", "company_gamma"], "selection keeps first occurrence and user order");
assert.deepEqual(Array.from(summary.buildingGroups, (group) => [group.key, Array.from(group.buildingKeys)]), [
  ["resources", ["building_coal_mine", "building_iron_mine"]],
  ["agriculture", ["building_wheat_farm"]],
  ["light_industry", ["building_tooling_workshop"]],
  ["heavy_military", ["building_steel_mill"]],
], "fixed and selected extension buildings deduplicate and follow the directory order");
assert.deepEqual(Array.from(summary.unclassifiedBuildingKeys), ["building_unclassified"], "unlisted building keys remain observable to the caller");
assert.deepEqual(JSON.parse(JSON.stringify(summary.buildingSources)), {
  building_iron_mine: ["company_beta"],
  building_tooling_workshop: ["company_beta", "company_alpha"],
  building_coal_mine: ["company_alpha"],
  building_wheat_farm: ["company_gamma"],
  building_unclassified: ["company_gamma"],
  building_steel_mill: ["company_alpha"],
}, "building sources deduplicate each company and retain selection order");
assert.deepEqual(JSON.parse(JSON.stringify(summary.extensionRows)), [
  { companyKey: "company_alpha", optionKeys: ["building_steel_mill", "building_railway"], selectedExtensionKey: "building_steel_mill" },
  { companyKey: "company_gamma", optionKeys: ["building_railway"], selectedExtensionKey: "" },
], "only valid one-of-many extensions are retained per company");
assert.deepEqual(Array.from(summary.prestigeGoods, (item) => item.key), ["prestige_tool", "prestige_steel"], "prestige goods deduplicate in selected-company order");
assert.deepEqual(Array.from(summary.cultures, (item) => item.key), ["culture_han", "culture_yue"], "culture restrictions deduplicate");
assert.deepEqual(Array.from(summary.countries, (item) => item.key), ["c:CHI", "c:JAP"], "country restrictions deduplicate");

const buildingModifiers = summary.prosperityGroups.find((group) => group.key === "building")?.modifiers || [];
assert.equal(buildingModifiers.length, 2, "different numeric modifier fields stay separate");
assert.equal(buildingModifiers[0].key, "building_tooling_workshop_throughput_add");
assert.equal(buildingModifiers[0].value, 0.15, "matching numeric modifier fields aggregate");
assert.equal(buildingModifiers[1].value, 0.2);
const stateModifiers = summary.prosperityGroups.find((group) => group.key === "state")?.modifiers || [];
assert.equal(stateModifiers.length, 2, "non-numeric modifiers remain independent");
assert.ok(stateModifiers.every((modifier) => modifier.value === "invalid"), "non-numeric modifier values must not be added");

const cleared = composeCompanyBuildings({
  companies,
  selectedCompanyKeys: ["company_alpha"],
  selectedExtensions: {},
  buildingGroups,
});
assert.equal(cleared.buildingGroups.some((group) => group.buildingKeys.includes("building_steel_mill")), false, "clearing an extension removes it from the building summary");

const extensionOverlap = composeCompanyBuildings({
  companies,
  selectedCompanyKeys: ["company_beta", "company_delta"],
  selectedExtensions: { company_delta: "building_tooling_workshop" },
  buildingGroups,
});
assert.deepEqual(Array.from(extensionOverlap.buildingSources.building_tooling_workshop), ["company_beta", "company_delta"], "a selected extension contributes its company to building coverage");
const extensionCleared = composeCompanyBuildings({
  companies,
  selectedCompanyKeys: ["company_beta", "company_delta"],
  selectedExtensions: {},
  buildingGroups,
});
assert.deepEqual(Array.from(extensionCleared.buildingSources.building_tooling_workshop), ["company_beta"], "clearing an extension removes its company from building coverage");

console.log("company composer core checks passed");
