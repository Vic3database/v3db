import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");
const runtime = read("site/app/runtime.js");
const ui = read("site/app/ui.js");
const presentation = read("site/app/presentation.js");
const map = read("site/app/map.js");
const indexHtml = read("site/index.html");
const calculator = fs.existsSync(path.join(root, "site/app/culture-incorporation.js")) ? read("site/app/culture-incorporation.js") : "";

assert.match(runtime, /incorporationCalculatorCultures: new Set\(\)/);
assert.match(runtime, /incorporationCalculatorAppliedCultures: new Set\(\)/);
assert.match(runtime, /incorporationCalculatorHomelandEffects: new Set\(\)/);
assert.match(runtime, /incorporationCalculatorFiltersOpen: false/);
assert.match(ui, /parts\[1\] === "incorporation"/);
assert.match(calculator, /function incorporationCalculatorCandidates\(country\)/);
assert.match(map, /function buildCultureIncorporationMapFeatures\(\)/);
assert.match(indexHtml, /app\/culture-incorporation\.js/);
assert.match(indexHtml, /id="cultureIncorporationEntry"/);
assert.match(indexHtml, /data-i18n="nav.cultureIncorporationEntry"/);
assert.doesNotMatch(runtime, /countryIncorporationScenario/);
assert.doesNotMatch(presentation, /data-primary-culture-scenario-route/);
assert.doesNotMatch(ui, /data-country-incorporation-scenario-clear/);
assert.match(calculator, /data-incorporation-selected-culture/);
assert.match(calculator, /data-incorporation-candidate/);
assert.match(calculator, /data-incorporation-filter-heritage-group/);
assert.match(calculator, /data-incorporation-filter-language-group/);
assert.match(calculator, /data-incorporation-filter-tradition/);
assert.match(calculator, /data-incorporation-filter-culture/);
assert.match(calculator, /data-incorporation-homeland-effect/);
assert.match(calculator, /data-incorporation-dynamic-effect/);
assert.match(calculator, /data-incorporation-search/);
assert.match(calculator, /data-incorporation-filter-panel/);
assert.match(calculator, /data-incorporation-filter-results-title/);
assert.match(calculator, /data-incorporation-filter-results-divider/);
assert.match(calculator, /data-incorporation-start/);
assert.match(calculator, /incorporationCalculatorAppliedCultures/);
assert.doesNotMatch(calculator, /data-incorporation-results/);
assert.doesNotMatch(calculator, /board\.culture\.incorporation\.results/);
assert.match(presentation, /data-incorporation-country/);
assert.doesNotMatch(presentation, /culture\/incorporation\/\$\{/);

const ausChunk = fs.readdirSync(path.join(root, "site/versions/1.13.11"))
  .filter((file) => /^data-countries-\d+\.js$/.test(file))
  .map((file) => fs.readFileSync(path.join(root, "site/versions/1.13.11", file), "utf8"))
  .find((source) => source.includes('"tag":"AUS"')) || "";
for (const key of ["hungarian", "czech", "slovak", "croat", "serb", "slovene", "polish", "romanian", "ukrainian", "north_italian", "szekely"]) {
  assert.ok(ausChunk.includes(`"culture":"${key}"`), `AUS candidate data must retain ${key}`);
}
assert.match(map, /cultureIncorporation/);
assert.match(map, /state\.mapMode === "cultureIncorporation"[\s\S]*incorporationCalculatorAppliedCultures/);
assert.match(map, /function incorporationCalculatorHomelandCulturesForStateRegion\(/);
assert.match(map, /incorporationCalculatorAppliedHomelandEffects/);
assert.match(map, /state\.mapMode === "cultureIncorporation"[\s\S]*incorporationCalculatorAppliedHomelandEffects/);
assert.match(indexHtml, /app\/map\.js\?v=20260826-culture-incorporation-refresh1/);
assert.match(calculator, /empty/);

console.log("culture incorporation calculator contract passed");
