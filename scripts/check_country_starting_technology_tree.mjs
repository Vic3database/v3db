import assert from "node:assert/strict";
import fs from "node:fs";

const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const builder = fs.readFileSync("scripts/build_wiki.mjs", "utf8");
const extractor = fs.readFileSync("scripts/extract_vic3_countries.mjs", "utf8");
const countries = JSON.parse(fs.readFileSync("database/vic3_1.13.11/countries.json", "utf8").replace(/^\uFEFF/, ""));

assert.match(extractor, /starting_technology_eras/, "country data must retain researched eras");
assert.match(builder, /startingTechnologyEras/, "site data must expose researched eras");
assert.match(presentation, /function countryStartingTechnologyTree\s*\(/, "country detail must render the starting technology tree");
assert.match(presentation, /era_1[\s\S]*era_2/, "country technology tree must include eras I and II");
assert.match(presentation, /production[\s\S]*military[\s\S]*society/, "country technology tree must separate production, military, and society");
assert.match(presentation, /"researched"\s*:\s*|"unresearched"\s*:/, "technology state must have separate visual classes");

const china = countries.find((country) => country.tag === "CHI");
const greatBritain = countries.find((country) => country.tag === "GBR");
assert.equal(china?.starting_technology_template, "effect_starting_technology_tier_4_tech", "China must retain its starting technology template");
assert.ok(china?.starting_technology_template_technologies?.some((technology) => technology.key === "urbanization"), "China must include template technologies");
assert.ok(china?.starting_technologies?.some((technology) => technology.key === "academia"), "China must include extra starting technologies");
assert.deepEqual(greatBritain?.starting_technology_eras, ["era_1"], "Great Britain must retain the era marker from its template");

console.log("country_starting_technology_tree: ok");
