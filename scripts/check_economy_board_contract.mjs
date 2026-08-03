import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const indexHtml = read("site/index.html");
const buildScript = read("scripts/build_wiki.mjs");
const appSource = readSiteAppSource(root);
const styleSource = readSiteStyleSource(root);

for (const view of ["building", "goods"]) {
  assert(indexHtml.includes(`data-nav-view="${view}"`), `top navigation must include ${view}`);
  assert(indexHtml.includes(`<option value="${view}">`), `mobile view selector must include ${view}`);
  assert(appSource.includes(`view === "${view}"`), `runtime must recognize ${view} view`);
  assert(appSource.includes(`parts[0] === "${view}"`), `router must recognize ${view} route`);
  assert(appSource.includes(`render${view === "building" ? "Building" : "Goods"}Board()`), `${view} board must render`);
}

for (const chunk of ["building", "goods"]) {
  assert(buildScript.includes(`${chunk}: [`), `site builder must publish ${chunk} chunk`);
}
for (const field of ["buildings", "buildingGroups", "productionMethodGroups", "productionMethods", "goods", "prestigeGoods"]) {
  assert(appSource.includes(field), `runtime must retain ${field}`);
}
for (const text of [
  "productionMethodCombinations",
  "productionCombinationHtml",
  "条件修正",
  "method.description_zh",
  "combined: true",
  "data-production-method-key",
  "economyAsset(\"production-methods\"",
  "economyAsset(\"buildings\"",
  "economyAsset(\"goods\"",
  "economyAsset(\"prestige-goods\"",
  "/region/resource/",
]) {
  assert(appSource.includes(text), `economy interaction must contain ${text}`);
}
assert(styleSource.includes(".economy-wall-grid"), "economy wall needs responsive card layout");
assert(styleSource.includes(".production-method-options"), "production-method options need horizontal layout");

console.log(JSON.stringify({ economy_board_contract: "ok" }, null, 2));

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");
}
