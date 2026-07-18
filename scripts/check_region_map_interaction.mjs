import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const appSource = readSiteAppSource(root);
const stylesSource = readSiteStyleSource(root);
const failures = [];

checkRegionMapClickContracts();
checkRegionRowDetailButtonContracts();
checkRegionMapListSyncContracts();

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  checked: [
    "site/app.js",
    "site/styles.css",
  ],
  region_map_interaction: "ok",
}, null, 2));

function checkRegionMapClickContracts() {
  const bindMapEvents = functionSource("bindMapEvents");
  const selectStateRegionFromMap = functionSource("selectStateRegionFromMap");

  assert(/addEventListener\("dblclick"/.test(bindMapEvents), "region map should bind a double-click handler");
  assert(/openStateRegionDetail\(stateRegion\.key\)/.test(bindMapEvents), "region map double-click should open the state-region detail route");
  assert(/selectStateRegionFromMap\(stateRegion\.key\)/.test(bindMapEvents), "region map single click should select through a non-navigating helper");
  assert(selectStateRegionFromMap && !/replaceHash\(`\/state-region/.test(selectStateRegionFromMap), "region map single-click helper should not replace the hash with a detail route");
}

function checkRegionRowDetailButtonContracts() {
  const renderRegionList = functionSource("renderRegionList");
  const rowDetailButton = functionSource("rowDetailButton");

  assert(/rowDetailButton\("data-state-region-detail"/.test(renderRegionList), "region rows should expose a dedicated state-region detail button");
  assert(/assets\/lucide\/icons\/arrow-right\.svg/.test(rowDetailButton), "row detail button should use the right-arrow icon");
  assert(/aria-label="进入详情"/.test(rowDetailButton), "row detail button should have an accessible label");
  assert(/\.row-detail-button/.test(stylesSource), "row detail button should have shared styles");
}

function checkRegionMapListSyncContracts() {
  const renderRegionList = functionSource("renderRegionList");
  const selectStateRegionFromMap = functionSource("selectStateRegionFromMap");

  assert(!/filteredStateRegions\.slice\(0,\s*220\)/.test(renderRegionList), "region rows should not be capped at 220 items");
  assert(/selectedStateRegionFromMap/.test(renderRegionList), "region list should resolve the region selected from the map");
  assert(/region-map-selected/.test(renderRegionList), "filtered-out map selections should render a temporary highlighted card");
  assert(/scrollIntoView\(\{ block: "center"/.test(selectStateRegionFromMap), "map selection should scroll its region card into view");
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}`);
  if (start < 0) return "";
  const signatureEnd = appSource.indexOf(")", start);
  const bodyStart = appSource.indexOf("{", signatureEnd);
  if (bodyStart < 0) return "";
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    const char = appSource[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  return appSource.slice(start);
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
