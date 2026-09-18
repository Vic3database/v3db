import assert from "node:assert/strict";
import fs from "node:fs";

const extractor = fs.readFileSync("scripts/extract_vic3_countries.mjs", "utf8");
const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const zhLocale = fs.readFileSync("site/locales/ui.zh-Hans.js", "utf8");
const enLocale = fs.readFileSync("site/locales/ui.en.js", "utf8");

assert.match(extractor, /byCulture/, "extractor must aggregate starting population by culture");
assert.match(extractor, /starting_population/, "extractor must publish culture starting population");
assert.match(presentation, /culture\.starting_population/, "culture detail must render starting population");
assert.match(zhLocale, /board\.culture\.startingPopulation/, "Chinese culture population label must exist");
assert.match(enLocale, /board\.culture\.startingPopulation/, "English culture population label must exist");

console.log("culture population statistics contract passed");
