import assert from "node:assert/strict";
import fs from "node:fs";

const extractor = fs.readFileSync("scripts/extract_vic3_countries.mjs", "utf8");
const builder = fs.readFileSync("scripts/build_wiki.mjs", "utf8");
const countries = JSON.parse(fs.readFileSync("database/vic3_1.13.11/countries.json", "utf8").replace(/^\uFEFF/, ""));

assert.match(extractor, /effect_starting_technology_tier_/, "extractor must read starting technology tiers");
assert.match(extractor, /add_technology_researched/, "extractor must read extra researched technologies");
assert.match(extractor, /activate_law/, "extractor must read starting laws");
assert.match(builder, /startingTechnologies/, "site builder must expose starting technologies");
assert.match(builder, /startingLaws/, "site builder must expose starting laws");

const china = countries.find((country) => country.tag === "CHI");
const greatBritain = countries.find((country) => country.tag === "GBR");
const japan = countries.find((country) => country.tag === "JAP");
assert.equal(china?.starting_technology_tier, 4, "China must expose its starting technology tier");
assert.deepEqual(china?.starting_technologies?.map((item) => item.key), ["urban_planning", "sericulture", "academia", "law_enforcement"], "China extra starting technologies must preserve source order");
assert.ok(china?.starting_laws?.some((law) => law.key === "law_canton_system"), "China must expose its starting laws");
assert.equal(greatBritain?.starting_technology_tier, 1, "Great Britain must expose its starting technology tier");
assert.ok(greatBritain?.starting_technologies?.some((technology) => technology.key === "joint_stock_companies"), "Great Britain must expose extra starting technologies");
assert.ok(japan?.starting_laws?.some((law) => law.key === "law_sakoku"), "Japan must expose its starting laws");

const nonStarting = countries.find((country) => country.status?.exists_at_start === false && country.starting_technology_tier == null);
assert.ok(nonStarting, "a country without a 1836 start must remain distinguishable from missing data");

console.log("country_starting_data: ok");
