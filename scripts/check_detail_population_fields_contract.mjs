import assert from "node:assert/strict";
import fs from "node:fs";

const extractor = fs.readFileSync("scripts/extract_vic3_countries.mjs", "utf8");
const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const boards = fs.readFileSync("site/app/boards.js", "utf8");
const buildWiki = fs.readFileSync("scripts/build_wiki.mjs", "utf8");
const zhLocale = fs.readFileSync("site/locales/ui.zh-Hans.js", "utf8");
const enLocale = fs.readFileSync("site/locales/ui.en.js", "utf8");

assert.match(extractor, /byReligion/, "extractor must aggregate starting population by religion");
assert.match(extractor, /starting_population/, "extractor must publish starting population fields");
assert.match(buildWiki, /starting_population/, "site builder must preserve starting population fields");
assert.match(presentation, /country\.startingPopulation/, "country detail must render population");
assert.match(presentation, /culture\.starting_population/, "culture detail must render population");
assert.match(presentation, /stateRegion\.starting_population/, "region detail must render population");
assert.match(boards, /selected\.starting_population/, "religion detail must render population");
assert.match(zhLocale, /religion\.startingPopulation/, "Chinese religion population label must exist");
assert.match(enLocale, /religion\.startingPopulation/, "English religion population label must exist");

console.log("detail population fields contract passed");
