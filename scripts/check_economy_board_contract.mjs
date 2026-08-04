import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const indexHtml = read("site/index.html");
const buildScript = read("scripts/build_wiki.mjs");
const appSource = readSiteAppSource(root);
const styleSource = readSiteStyleSource(root);

assert.match(indexHtml, /app\/economy\.js\?v=20260804-goods-detail1/, "economy script must use the expanded goods-detail cache version");
assert.match(indexHtml, /styles\.css\?v=20260804-goods-detail2/, "site styles must use the current goods-detail cache version");

for (const view of ["building", "goods"]) {
  assert(indexHtml.includes(`data-nav-view="${view}"`), `top navigation must include ${view}`);
  assert(indexHtml.includes(`<option value="${view}">`), `mobile view selector must include ${view}`);
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
  "data-production-method-picker",
  "data-production-summary",
  "标准产值",
  "data-production-standard-output",
  "annualProfitPerWorker",
  "goodByKey.get(goodKey)?.price",
  "method.description_zh",
  "combined: true",
  "data-production-method-key",
  "economyAsset(\"production-methods\"",
  "economyAsset(\"buildings\"",
  "economyAsset(\"goods\"",
  "economyAsset(\"prestige-goods\"",
  "/region/resource/",
  "board_group",
  "data-board-group",
]) {
  assert(appSource.includes(text), `economy interaction must contain ${text}`);
}
assert(!appSource.includes("所有可能组合"), "building detail must not enumerate every production-method combination");
assert(appSource.includes("* 52"), "annual profit per worker must convert weekly profit to yearly profit with 52 weeks");
assert(styleSource.includes(".economy-wall-grid"), "economy wall needs responsive card layout");
assert(styleSource.includes(".production-method-options"), "production-method options need horizontal layout");
assert(styleSource.includes(".production-combination-summary"), "current production combination needs a dedicated summary layout");

console.log(JSON.stringify({ economy_board_contract: "ok" }, null, 2));

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");
}
