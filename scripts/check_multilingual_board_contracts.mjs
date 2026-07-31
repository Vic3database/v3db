import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const boardsArg = process.argv.includes("--boards")
  ? process.argv[process.argv.indexOf("--boards") + 1]
  : process.argv.find((arg) => arg.startsWith("--boards="))?.slice("--boards=".length);
const boards = (boardsArg || "country,culture").split(",").filter(Boolean);
const app = fs.readFileSync(path.join(root, "site", "app", "presentation.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "site", "app", "filters.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "site", "app", "components.js"), "utf8");
const uiZh = fs.readFileSync(path.join(root, "site", "locales", "ui.zh-Hans.js"), "utf8");
const uiEn = fs.readFileSync(path.join(root, "site", "locales", "ui.en.js"), "utf8");

const bodies = {
  renderCountryList: body("renderCountryList"),
  renderCountryDetail: body("renderCountryDetail"),
  renderCountryDetailPage: body("renderCountryDetailPage"),
  renderCultureList: body("renderCultureList"),
  renderCultureDetail: body("renderCultureDetail"),
  sortCountries: body("sortCountries", fs.readFileSync(path.join(root, "site", "app", "filters.js"), "utf8")),
  sortCultures: body("sortCultures", fs.readFileSync(path.join(root, "site", "app", "filters.js"), "utf8")),
  mobileCountry: body("renderMobileCountryControls"),
  mobileCulture: body("renderMobileCultureControls"),
  mobileCountryOptions: body("mobileCountryFilterOptions"),
  mobileCountrySelected: body("mobileCountrySelectedFilters"),
  mobileCountryRefName: body("mobileCountryCultureRefName"),
  mobileCultureOptions: body("renderMobileCultureFilterOptions"),
  mobileCultureGroupedOptions: body("renderCultureMobileGroupedOptions"),
  mobileCultureSelected: body("mobileCultureSelectedFilters"),
  mobileCultureRefName: body("mobileCultureRefName"),
  countryTierLabel: body("countryTierLabel"),
};

if (boards.includes("country")) {
  assert.match(bodies.renderCountryList, /entityText\(/, "country list should use entityText");
  assert.match(bodies.renderCountryDetail, /entityText\(/, "country detail should use entityText");
  assert.match(bodies.renderCountryDetail, /t\(/, "country detail should use translated labels");
  assert.match(bodies.sortCountries, /localizedCompare\(/, "country sort should use localizedCompare");
  assert.doesNotMatch(bodies.renderCountryList, /country\.name_zh|primaryCulturesZh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.renderCountryDetail, /country\.name_zh|primaryCulturesZh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.mobileCountry, /country\.name_zh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.mobileCountryOptions, /name_zh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.mobileCountrySelected, /name_zh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.mobileCountryRefName, /name_zh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.countryTierLabel, /tierZh/);
}

if (boards.includes("culture")) {
  assert.match(bodies.renderCultureList, /entityText\(/, "culture list should use entityText");
  assert.match(bodies.renderCultureDetail, /entityText\(/, "culture detail should use entityText");
  assert.match(bodies.sortCultures, /localizedCompare\(/, "culture sort should use localizedCompare");
  assert.doesNotMatch(bodies.renderCultureList, /culture\.name_zh|name_zh/);
  assert.doesNotMatch(bodies.renderCultureDetail, /culture\.name_zh|name_zh/);
  assert.doesNotMatch(bodies.mobileCulture, /culture\.name_zh|name_zh/);
  assert.doesNotMatch(bodies.mobileCultureOptions, /name_zh/);
  assert.doesNotMatch(bodies.mobileCultureGroupedOptions, /name_zh/);
  assert.doesNotMatch(bodies.mobileCultureSelected, /name_zh/);
  assert.doesNotMatch(bodies.mobileCultureRefName, /name_zh/);
}

assert(uiZh.includes("board.country"), "zh UI locale should define country board labels");
assert(uiZh.includes("board.culture"), "zh UI locale should define culture board labels");
assert(uiEn.includes("board.country"), "en UI locale should define country board labels");
assert(uiEn.includes("board.culture"), "en UI locale should define culture board labels");
assert(uiZh.includes("主流文化"), "zh UI locale should keep Chinese country labels");
assert(uiZh.includes("文化搜索与筛选条件"), "zh UI locale should keep Chinese culture labels");

console.log(`multilingual_board_contracts: ok (${boards.join(",")})`);

function body(name, source = app) {
  const pattern = new RegExp(`function ${name}\\([^]*?\\n}`);
  const match = source.match(pattern);
  assert(match, `missing function ${name}`);
  return match[0];
}
