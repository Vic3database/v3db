import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const appSource = readSiteAppSource(root);
const stylesSource = readSiteStyleSource(root);
const indexSource = readText("site/index.html");
const failures = [];

checkRegionMapClickContracts();
checkRegionRowDetailButtonContracts();
checkRegionMapListSyncContracts();
checkRegionMapFocusColorContracts();
checkRegionMapFocusResetContracts();
checkTerrainViewContracts();
checkRegionMapCacheVersionContracts();
checkPrimaryListEventContracts();

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
  const stateRegionRowHtml = functionSource("stateRegionRowHtml");
  const rowDetailButton = functionSource("rowDetailButton");

  assert(/rowDetailButton\("data-state-region-detail"/.test(stateRegionRowHtml), "region rows should expose a dedicated state-region detail button");
  assert(/assets\/lucide\/icons\/arrow-right\.svg/.test(rowDetailButton), "row detail button should use the right-arrow icon");
  assert(/t\("ui\.openDetail"\)[\s\S]*aria-label="\$\{escapeHtml\(label\)\}"/.test(rowDetailButton), "row detail button should have a localized accessible label");
  assert(/\.row-detail-button/.test(stylesSource), "row detail button should have shared styles");
}

function checkRegionMapListSyncContracts() {
  const renderRegionList = functionSource("renderRegionList");
  const selectStateRegionFromMap = functionSource("selectStateRegionFromMap");
  const stateRegionRowHtml = functionSource("stateRegionRowHtml");

  assert(!/filteredStateRegions\.slice\(0,\s*220\)/.test(renderRegionList), "region rows should not be capped at 220 items");
  assert(/selectedStateRegionFromMap/.test(renderRegionList), "region list should resolve the region selected from the map");
  assert(/region-map-selected/.test(stateRegionRowHtml), "filtered-out map selections should render a temporary highlighted card");
  assert(/scrollStateRegionCardIntoView\(stateRegionKey\)/.test(selectStateRegionFromMap), "region map selection should move its selected list card into view");
  assert(/scrollIntoView\(\{ block: "center", behavior: "smooth" \}\)/.test(functionSource("scrollStateRegionCardIntoView")), "region map list focus should center the selected card smoothly");
  assert(!/\brender\(\)/.test(selectStateRegionFromMap), "region map selection should not rebuild the board");
  assert(!/\brender\(\)/.test(functionSource("selectStateRegionCard")), "region card selection should not rebuild the board");
  assert(!/focusStateRegionOnMap\(/.test(selectStateRegionFromMap), "region map selection should preserve the map transform");
  assert(/commitStateRegionSelection\(/.test(selectStateRegionFromMap), "region map selection should use the shared fast commit path");
  assert(/syncMapSelectedStateRegionCard\(/.test(appSource), "region fast selection should retain the temporary-card updater");
}

function checkRegionMapFocusColorContracts() {
  const regionMapStateRegions = functionSource("regionMapStateRegions");
  const buildStrategicRegionMapFeatures = functionSource("buildStrategicRegionMapFeatures");

  assert(/const selectedStateRegion = byStateRegion\.get\(state\.selectedStateRegion\);/.test(regionMapStateRegions), "region map should resolve the selected state region before choosing visible states");
  assert(/selectedStateRegion && !isSeaStateRegion\(selectedStateRegion\)[\s\S]*return \[selectedStateRegion\]/.test(regionMapStateRegions), "a selected land state region should be the only visible land focus");
  assert(/const REGION_MAP_FOCUS_COLOR = "#00cc66"/.test(appSource), "region map focus should use La Plata green");
  assert(/stateRegion\.key === state\.selectedStateRegion[\s\S]*REGION_MAP_FOCUS_COLOR/.test(buildStrategicRegionMapFeatures), "the selected state region should use the focus color");
}

function checkRegionMapFocusResetContracts() {
  const bindEvents = functionSource("bindEvents");
  const resetRegionMapFocus = functionSource("resetRegionMapFocus");
  const renderMapControls = functionSource("renderMapControls");

  assert(/state\.view === "region"[\s\S]*resetRegionMapFocus\(\)/.test(bindEvents), "region map reset button should clear the region focus");
  assert(/state\.selectedStateRegion = ""/.test(resetRegionMapFocus), "region focus reset should clear the selected state region");
  assert(/state\.mapSelectedStateRegion = ""/.test(resetRegionMapFocus), "region focus reset should clear the temporary map-selected card");
  assert(/render\(\)[\s\S]*fitMapToWidth\(\)/.test(resetRegionMapFocus), "region focus reset should re-render before fitting the map");
  assert(/state\.view === "region" \? t\("map\.resetRegionFocus", "重置地域焦点和地图位置"\) : t\("map\.resetPosition", "重置地图位置"\)/.test(renderMapControls), "region map reset button should expose its localized region-specific label");
}

function checkTerrainViewContracts() {
  const bindMapEvents = functionSource("bindMapEvents");
  const syncMapModeForView = functionSource("syncMapModeForView");

  assert(/state\.regionMapView === "terrain"[\s\S]*state\.mapMode = "terrain"/.test(syncMapModeForView), "terrain view should keep its own map mode ahead of resource selection");
  assert(/state\.mapMode === "terrain" && !terrainLandKeys\.has\(terrainKeyFromPointerEvent\(event\)\)\) return;/.test(bindMapEvents), "terrain view should ignore water clicks and double-clicks");
  assert(/selectStateRegionFromMap\(stateRegion\.key\)/.test(bindMapEvents), "terrain view should retain single-click state-region selection");
  assert(/openStateRegionDetail\(stateRegion\.key\)/.test(bindMapEvents), "terrain view should retain double-click state-region detail navigation");
}

function checkRegionMapCacheVersionContracts() {
  assert(/app\/ui\.js\?v=20260805-subsistence-map1/.test(indexSource), "region map UI script should use the current release cache version");
  assert(/app\/map\.js\?v=20260806-subsistence-polish1/.test(indexSource), "region map script should use the current release cache version");
  assert(/app\/presentation\.js\?v=20260806-subsistence-polish1/.test(indexSource), "fast region selection should use the current presentation cache version");
}

function checkPrimaryListEventContracts() {
  const bindEvents = functionSource("bindEvents");
  const bindPrimaryListEvents = functionSource("bindPrimaryListEvents");

  assert(/bindPrimaryListEvents\(\)/.test(bindEvents), "events should bind primary list delegation once");
  assert(/data-country-detail/.test(bindPrimaryListEvents), "primary list delegation should handle country detail buttons");
  assert(/data-state-region-detail/.test(bindPrimaryListEvents), "primary list delegation should handle region detail buttons");
  assert(/data-country/.test(bindPrimaryListEvents), "primary list delegation should handle country rows");
  assert(/data-state-region/.test(bindPrimaryListEvents), "primary list delegation should handle region rows");
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
