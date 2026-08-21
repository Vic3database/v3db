import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url).pathname.replace(/^\//, "").replace(/\//g, "\\");
const mapPath = `${root}site\\app\\map.js`;
const mapSource = fs.readFileSync(mapPath, "utf8");

assert.match(mapSource, /function countryIncorporationYearsForCulture\s*\(/, "country incorporation years helper should exist");
assert.match(mapSource, /function countryIncorporationForStateRegion\s*\(/, "country incorporation state helper should exist");
assert.match(mapSource, /countryIncorporationMapLegend/, "country incorporation legend should exist");
assert.match(mapSource, /countryIncorporation/, "country incorporation map mode should exist");
const indexSource = fs.readFileSync(`${root}site\\index.html`, "utf8");
assert.match(indexSource, /id="countryIncorporationMapButton"/, "country incorporation toggle should exist");
assert.match(indexSource, /id="countryIncorporationMapLegend"/, "country incorporation legend container should exist");
const runtimeSource = fs.readFileSync(`${root}site\\app\\runtime.js`, "utf8");
assert.match(runtimeSource, /countryIncorporationMapEnabled:\s*false/, "country incorporation state should default off");
const boardSource = fs.readFileSync(`${root}site\\app\\boards.js`, "utf8");
assert.match(boardSource, /state\.countryIncorporationMapEnabled\s*&&\s*selectedCountry\s*\?\s*stateRegions/, "incorporation map should use all state regions");
for (const localePath of [`${root}site\\locales\\ui.zh-Hans.js`, `${root}site\\locales\\ui.en.js`]) {
  const localeSource = fs.readFileSync(localePath, "utf8");
  for (const key of ["map.countryIncorporation.years2", "map.countryIncorporation.years5", "map.countryIncorporation.years10", "map.countryIncorporation.years15", "map.countryIncorporation.years25"]) {
    assert.ok(localeSource.includes(`"${key}"`), `${key} should be localized`);
  }
}

const helperSource = mapSource.match(/function countryIncorporationYearsForCulture\s*\([\s\S]*?\n}\n/)[0];
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
