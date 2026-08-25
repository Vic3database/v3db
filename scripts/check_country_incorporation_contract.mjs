import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url).pathname.replace(/^\//, "").replace(/\//g, "\\");
const mapPath = `${root}site\\app\\map.js`;
const mapSource = fs.readFileSync(mapPath, "utf8");

assert.match(mapSource, /function countryIncorporationYearsForCulture\s*\(/, "country incorporation years helper should exist");
assert.match(mapSource, /function countryIncorporationForStateRegion\s*\(/, "country incorporation state helper should exist");
assert.match(mapSource, /function countryIncorporationLabel\s*\(/, "country incorporation labels should have explicit fallbacks");
assert.match(mapSource, /countryIncorporationMapLegend/, "country incorporation legend should exist");
assert.match(mapSource, /countryIncorporation/, "country incorporation map mode should exist");
assert.match(mapSource, /2:\s*"#[0-9a-fA-F]+"[\s\S]*5:\s*"#[0-9a-fA-F]+"[\s\S]*10:\s*"#[0-9a-fA-F]+"[\s\S]*15:\s*"#[0-9a-fA-F]+"[\s\S]*25:\s*"#7a7f82"/, "incorporation colors should use one scale with a gray 25-year endpoint");
const indexSource = fs.readFileSync(`${root}site\\index.html`, "utf8");
assert.match(indexSource, /id="countryIncorporationMapButton"/, "country incorporation toggle should exist");
assert.match(indexSource, /id="mapCountryContext"/, "country incorporation toolbar should expose the selected country context");
assert.match(indexSource, /styles\.css\?v=20260825-culture-incorporation-map1/, "culture incorporation map should invalidate the root stylesheet cache");
assert.match(indexSource, /app\/map\.js\?v=20260822-country-incorporation-label1/, "country incorporation labels should invalidate the map script cache");
assert.match(indexSource, /locales\/manifest\.js\?v=20260822-country-incorporation-label1/, "country incorporation labels should invalidate the locale manifest cache");
const stylesSource = fs.readFileSync(`${root}site\\styles.css`, "utf8");
assert.match(stylesSource, /styles\/map\.css\?v=20260822-country-incorporation-legend1/, "country incorporation legend should invalidate the map stylesheet cache");
assert.match(stylesSource, /styles\/shell\.css\?v=20260825-culture-incorporation-map1/, "culture incorporation map should invalidate the shell stylesheet cache");
assert.match(indexSource, /id="countryIncorporationMapLegend"/, "country incorporation legend container should exist");
const runtimeSource = fs.readFileSync(`${root}site\\app\\runtime.js`, "utf8");
assert.match(runtimeSource, /countryIncorporationMapEnabled:\s*false/, "country incorporation state should default off");
assert.match(runtimeSource, /mapCountryContext: document\.querySelector\("#mapCountryContext"\)/, "runtime element table should expose the selected country context");
assert.match(mapSource, /function renderMapCountryContext\s*\(/, "map controls should render the selected country context");
assert.match(mapSource, /map-country-context-flag/, "map country context should use a dedicated flag class");
const boardSource = fs.readFileSync(`${root}site\\app\\boards.js`, "utf8");
assert.match(boardSource, /state\.countryIncorporationMapEnabled\s*&&\s*selectedCountry\s*\?\s*stateRegions/, "incorporation map should use all state regions");
for (const localePath of [`${root}site\\locales\\ui.zh-Hans.js`, `${root}site\\locales\\ui.en.js`]) {
  const localeSource = fs.readFileSync(localePath, "utf8");
  for (const key of ["map.countryIncorporation.years2", "map.countryIncorporation.years5", "map.countryIncorporation.years10", "map.countryIncorporation.years15", "map.countryIncorporation.years25"]) {
    assert.ok(localeSource.includes(`"${key}"`), `${key} should be localized`);
  }
}

const helperSource = mapSource.match(/function countryIncorporationYearsForCulture\s*\([\s\S]*?\r?\n}\r?\n/)[0];
const context = {};
vm.runInNewContext(`${helperSource}\nthis.countryIncorporationYearsForCulture = countryIncorporationYearsForCulture;`, context);
const years = context.countryIncorporationYearsForCulture;

const primary = {
  key: "primary",
  heritage: { key: "heritage_a", group_key: "heritage_group_a" },
  language: { key: "language_a", group_key: "language_group_a" },
  traditions: [{ key: "tradition_same" }],
};

assert.equal(years([primary], primary), 2, "same culture should take two years");
assert.equal(years([primary], {
  key: "same_traits",
  heritage: { key: "heritage_a", group_key: "heritage_group_a" },
  language: { key: "language_a", group_key: "language_group_a" },
}), 5, "same heritage and language should take five years");
assert.equal(years([primary], {
  key: "same_heritage",
  heritage: { key: "heritage_a", group_key: "heritage_group_a" },
  language: { key: "language_b", group_key: "language_group_b" },
}), 10, "same heritage should take ten years");
assert.equal(years([primary], {
  key: "same_groups",
  heritage: { key: "heritage_b", group_key: "heritage_group_a" },
  language: { key: "language_b", group_key: "language_group_b" },
}), 15, "same heritage group should take fifteen years");
assert.equal(years([primary], {
  key: "unrelated",
  heritage: { key: "heritage_b", group_key: "heritage_group_b" },
  language: { key: "language_b", group_key: "language_group_b" },
  traditions: [{ key: "tradition_same" }],
}), 25, "traditions must not reduce incorporation time");
assert.equal(years([
  { key: "other", heritage: { key: "heritage_c", group_key: "heritage_group_c" }, language: { key: "language_c", group_key: "language_group_c" } },
  primary,
], {
  key: "same_language",
  heritage: { key: "heritage_b", group_key: "heritage_group_b" },
  language: { key: "language_a", group_key: "language_group_a" },
}), 10, "matching any primary culture should be considered");

console.log("country incorporation contract passed");
