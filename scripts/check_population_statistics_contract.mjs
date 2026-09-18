import assert from "node:assert/strict";
import fs from "node:fs";

const extractor = fs.readFileSync("scripts/extract_vic3_countries.mjs", "utf8");
const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const zhLocale = fs.readFileSync("site/locales/ui.zh-Hans.js", "utf8");
const enLocale = fs.readFileSync("site/locales/ui.en.js", "utf8");

assert.match(extractor, /function loadStartingPopulation/, "extractor must read starting population history");
assert.match(extractor, /starting_population/, "extractor must publish starting population fields");
assert.match(presentation, /country\.startingPopulation/, "country detail must render starting population");
assert.match(presentation, /stateRegion\.starting_population/, "state-region detail must render starting population");
assert.match(presentation, /startingPopulation/, "regional detail must aggregate starting population");
assert.match(zhLocale, /board\.country\.startingPopulation/, "Chinese population labels must exist");
assert.match(enLocale, /board\.country\.startingPopulation/, "English population labels must exist");

console.log("population statistics contract passed");
