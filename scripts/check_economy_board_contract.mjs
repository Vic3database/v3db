import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const indexHtml = read("site/index.html");
const buildScript = read("scripts/build_wiki.mjs");
const appSource = readSiteAppSource(root);
const styleSource = readSiteStyleSource(root);

assert.match(indexHtml, /app\/economy\.js\?v=20260811-goods-needs2/, "economy script must invalidate the goods-needs entry cache");
assert.match(indexHtml, /styles\.css\?v=[^\"\s]+/, "site styles must include a cache version");

for (const view of ["building", "goods"]) {
  assert(indexHtml.includes(`data-nav-view="${view}"`), `top navigation must include ${view}`);
  assert(indexHtml.includes(`<option value="${view}" data-i18n="nav.${view}">`), `mobile view selector must include localized ${view}`);
  assert(appSource.includes(`view === "${view}"`), `runtime must recognize ${view} view`);
  assert(appSource.includes(`parts[0] === "${view}"`), `router must recognize ${view} route`);
  assert(appSource.includes(`render${view === "building" ? "Building" : "Goods"}Board()`), `${view} board must render`);
}
assert(appSource.includes('if (view === "building") return ["building", "goods"]'), "building routes must load goods names and base prices");
assert(appSource.includes('if (view === "goods") return ["goods"]'), "goods routes must remain self-contained");

for (const chunk of ["building", "goods"]) {
  assert(buildScript.includes(`${chunk}: [`), `site builder must publish ${chunk} chunk`);
}
for (const field of ["buildings", "buildingGroups", "productionMethodGroups", "productionMethods", "goods", "prestigeGoods"]) {
  assert(appSource.includes(field), `runtime must retain ${field}`);
}
for (const field of ["consuming_buildings", "pop_needs", "obsessed_cultures", "taboo_cultures", "taboo_religions", "consumption_tax_cost"]) {
  assert(appSource.includes(field), `goods detail must render ${field}`);
}
for (const text of [
  "productionCombinationSummaryHtml",
  "productionMethodGroupStripHtml",
  "productionMethodGroupPanelHtml",
  "productionMethodGoodsHtml",
  "productionMethodWorkforceHtml",
  "productionMethodExtraHtml",
  "data-production-method-picker",
  "production-method-group-strip",
  "production-method-group-panel",
  "production-method-goods-row",
  "production-method-goods-inputs",
  "production-method-goods-arrow",
  "production-method-goods-outputs",
  "production-method-workforce-row",
  "production-method-extra-row",
  "data-production-summary",
  "board.economy.standardOutputLabel",
  "data-production-standard-output",
  "annualProfitPerWorker",
  "goodByKey.get(goodKey)?.price",
  "combined: true",
  "data-production-method-key",
  "economyAsset(\"production-methods\"",
  "economyAsset(\"buildings\"",
  "economyAsset(\"goods\"",
  "economyAsset(\"pops\"",
  "economyAsset(\"prestige-goods\"",
  "/region/resource/",
  "board_group",
  "data-board-group",
  "economyChangeFiltersHtml",
  "data-economy-vc-change",
  "toggleVictorianCenturyChangeKind",
  "matchesVictorianCenturyChange",
  "victorianCenturyBadge",
]) {
  assert(appSource.includes(text), `economy interaction must contain ${text}`);
}
assert(!appSource.includes("所有可能组合"), "building detail must not enumerate every production-method combination");
assert(appSource.includes("* 52"), "annual profit per worker must convert weekly profit to yearly profit with 52 weeks");
assert(!appSource.includes("selected-production-method-detail"), "legacy production-method details accordion must be removed");
assert(!appSource.includes("renderSelectedProductionMethodDetail"), "legacy production-method details renderer must be removed");
assert(!appSource.includes("当前选中") && !appSource.includes("当前选择"), "selected production methods must be indicated by their border only");
assert(styleSource.includes(".economy-wall-grid"), "economy wall needs responsive card layout");
assert(styleSource.includes(".production-method-group-strip"), "production-method group strip needs horizontal layout");
assert(styleSource.includes(".production-method-row"), "production-method list needs a selectable row layout");
assert(styleSource.includes(".production-combination-summary"), "current production combination needs a dedicated summary layout");
assert(styleSource.includes(".economy-change-filters"), "economy boards need Victorian Century change filters");
assert(styleSource.includes(".economy-card-change"), "economy cards need a dedicated change-badge slot");
assert.match(read("site/locales/ui.zh-Hans.js"), /"enum\.popType\.clergymen": "教士"/, "clergymen must use the game Chinese term");
assert(styleSource.includes(".production-method-good--negative"), "negative goods changes need a negative color");
assert(styleSource.includes(".production-method-good--positive"), "positive goods changes need a positive color");
assert.match(read("site/locales/ui.zh-Hans.js"), /"board\.economy\.productionGoodInputAria": "投入：\{value\} \{name\}"/, "Chinese input goods need a directional accessible label");
assert.match(read("site/locales/ui.zh-Hans.js"), /"board\.economy\.productionGoodOutputAria": "产出：\{value\} \{name\}"/, "Chinese output goods need a directional accessible label");
assert.match(read("site/locales/ui.en.js"), /"board\.economy\.productionGoodInputAria": "Input: \{value\} \{name\}"/, "English input goods need a directional accessible label");
assert.match(read("site/locales/ui.en.js"), /"board\.economy\.productionGoodOutputAria": "Output: \{value\} \{name\}"/, "English output goods need a directional accessible label");
assert(styleSource.includes(".production-summary-token"), "production summaries need inline icon tokens");
assert(appSource.includes('effect.scaling === "unscaled"'), "unscaled effects need a dedicated production-method group");
assert(appSource.includes('effect.scaling === "workforce_scaled"'), "staffing-scaled effects need a dedicated production-method group");
assert.match(read("site/locales/ui.zh-Hans.js"), /"board\.economy\.workforceScaledModifiersLabel": "按就业水平修正："/, "Chinese staffing-scaled effects need an accurate label");
assert.match(read("site/locales/ui.zh-Hans.js"), /"board\.economy\.levelScaledModifiersLabel": "每级修正："/, "Chinese level-scaled effects need the game terminology");
assert.match(read("site/locales/ui.en.js"), /"board\.economy\.workforceScaledModifiersLabel": "Staffing-scaled modifiers: "/, "English staffing-scaled effects need a dedicated label");

console.log(JSON.stringify({ economy_board_contract: "ok" }, null, 2));

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");
}
