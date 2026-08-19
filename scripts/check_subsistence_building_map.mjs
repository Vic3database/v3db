import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runtimeSource = read("site/app/runtime.js");
const componentsSource = read("site/app/components.js");
const mapSource = read("site/app/map.js");
const filtersSource = read("site/app/filters.js");
const indexSource = read("site/index.html");
const mapStylesSource = read("site/styles/map.css");
const zhSource = read("site/locales/ui.zh-Hans.js");
const enSource = read("site/locales/ui.en.js");
const dataSource = read("site/versions/1.13.9/data-regions.js");
const data = JSON.parse(dataSource.replace(/^window\.VIC3_DATA_CHUNK\s*=\s*/, "").replace(/;\s*$/, ""));

const expectedBuildingKeys = [
  "building_subsistence_farm",
  "building_subsistence_rice_farm",
  "building_subsistence_pasture",
  "building_subsistence_orchard",
  "building_subsistence_fishing_village",
].sort();
const actualBuildingKeys = [...new Set(data.stateRegions
  .map((stateRegion) => stateRegion.subsistence_building)
  .filter(Boolean))]
  .sort();

assert.deepEqual(actualBuildingKeys, expectedBuildingKeys, "1.13.9 regions must retain exactly five subsistence building types");
assert.match(runtimeSource, /\{ key: "subsistence_buildings", labelKey: "filter\.subsistenceBuildings", icon: "pops\/peasants\.webp", mapMode: "subsistenceBuildings", mapOnly: true \}/, "resource filters must expose the combined subsistence-building map entry with the peasant pop icon");
assert.match(runtimeSource, /key: "subsistence",\s*filters:[\s\S]*subsistence_buildings/, "the combined entry must keep its own resource-filter row");
assert.match(functionSource(filtersSource, "visibleResourceFilterGroups"), /merged\.push\(\{ key: "agriculture", filters: agricultureFilters \}\);[\s\S]*merged\.push\(subsistenceGroup\)/, "the combined entry must render directly below the agriculture resource row");
assert.match(functionSource(componentsSource, "resourceOptionToken"), /resourceFilterIconHtml\(filter, label\)/, "map-only resource filters must render their configured icon");
assert.match(functionSource(componentsSource, "resourceFilterIconHtml"), /resource-filter-pop-icon[\s\S]*src="assets\/\$\{escapeHtml\(filter\.icon\)\}"/, "configured map-only icons must resolve from the site assets directory");
assert.match(zhSource, /"filter\.subsistenceBuildings": "自给建筑"/, "Chinese UI must name the subsistence-building map entry");
assert.match(enSource, /"filter\.subsistenceBuildings": "Subsistence buildings"/, "English UI must name the subsistence-building map entry");
assert.match(zhSource, /"map\.subsistenceBuilding\.building_subsistence_rice_farm": "自给稻田"/, "Chinese UI must name the subsistence rice farm as a subsistence rice paddy");

const expectedGradients = new Map([
  ["building_subsistence_farm", { low: "#f1dfb9", high: "#c8893f" }],
  ["building_subsistence_rice_farm", { low: "#c9e7d2", high: "#4c9f70" }],
  ["building_subsistence_pasture", { low: "#e2d3bc", high: "#8b6f47" }],
  ["building_subsistence_orchard", { low: "#e8c9df", high: "#b5688b" }],
  ["building_subsistence_fishing_village", { low: "#c7e1f2", high: "#4b87b6" }],
]);
for (const [key, gradient] of expectedGradients) {
  assert.match(mapSource, new RegExp(`\\["${key}", \\{ low: "${gradient.low}", high: "${gradient.high}" \\}\\]`), `${key} must use its agreed arable-land color gradient`);
}
assert.match(functionSource(mapSource, "syncMapModeForView"), /filter\?\.mapMode === "subsistenceBuildings"/, "the subsistence entry must select its dedicated map mode");
assert.match(functionSource(mapSource, "buildMapFeatures"), /state\.mapMode === "subsistenceBuildings"/, "map feature dispatch must include the subsistence view");
assert.match(functionSource(mapSource, "buildSubsistenceBuildingMapFeatures"), /stateRegion\.subsistence_building/, "subsistence map features must read the region building key");
assert.match(functionSource(mapSource, "buildSubsistenceBuildingMapFeatures"), /subsistenceBuildingGradientColor\(buildingKey, arableLand, maxArableLandByBuilding\.get\(buildingKey\)\)/, "each subsistence building type must use its own arable-land gradient scale");
assert.match(functionSource(mapSource, "subsistenceBuildingGradientColor"), /SUBSISTENCE_BUILDING_EMPTY_COLOR/, "missing subsistence data must use a neutral land color");
assert.match(functionSource(filtersSource, "matchesResourceFilters"), /filter\?\.mapOnly/, "the map-only subsistence entry must not shrink the region list");
assert.match(indexSource, /<div id="subsistenceBuildingMapLegend" class="subsistence-building-map-legend" hidden><\/div>/, "the map panel must include a hidden subsistence-building legend");
assert.match(runtimeSource, /subsistenceBuildingMapLegend: document\.querySelector\("#subsistenceBuildingMapLegend"\)/, "runtime elements must expose the subsistence-building legend");
assert.match(functionSource(mapSource, "renderSubsistenceBuildingMapLegend"), /SUBSISTENCE_BUILDING_GRADIENT_BY_KEY/, "the legend must use the subsistence-building gradients");
assert.doesNotMatch(functionSource(mapSource, "renderSubsistenceBuildingMapLegend"), /subsistence-building-map-legend-heading|subsistenceBuildingLegendArableLand/, "the legend must omit its redundant heading and gradient explanation");
assert.match(functionSource(mapSource, "drawMapLabels"), /"subsistenceBuildings"/, "the subsistence map must draw arable-land labels");
assert.match(functionSource(mapSource, "mapTooltipRowsForView"), /state\.mapMode === "subsistenceBuildings"/, "the subsistence map must use dedicated tooltip rows");
assert.match(mapStylesSource, /\.subsistence-building-map-legend/, "the subsistence-building legend must have responsive styles");
assert.match(mapStylesSource, /linear-gradient\(90deg, var\(--subsistence-building-map-color-low\), var\(--subsistence-building-map-color-high\)\)/, "each legend entry must visibly show its arable-land color gradient");
assert.match(indexSource, /styles\.css\?v=20260819-company-usage-collapse1/, "main entry must invalidate the current shared styles");
assert.match(indexSource, /app\/runtime\.js\?v=20260816-global-content-search1/, "main entry must invalidate the current runtime");
assert.match(indexSource, /app\/i18n\.js\?v=20260811-goods-needs2/, "main entry must invalidate the current localization loader");
assert.match(indexSource, /app\/filters\.js\?v=20260818-company-filter-exclusions1/, "main entry must invalidate the current resource filters");
assert.match(indexSource, /app\/components\.js\?v=20260809-global-search-media1/, "main entry must invalidate the current components");
assert.match(indexSource, /app\/ui\.js\?v=20260816-global-content-search1/, "main entry must invalidate the current UI");
assert.match(indexSource, /app\/map\.js\?v=20260806-subsistence-polish1/, "main entry must invalidate the updated subsistence-map script");

console.log(JSON.stringify({ subsistence_building_map: "entry-ok", buildingTypes: actualBuildingKeys }, null, 2));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) return "";
  const signatureEnd = source.indexOf(")", start);
  const bodyStart = source.indexOf("{", signatureEnd);
  if (bodyStart < 0) return "";
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return source.slice(start);
}
