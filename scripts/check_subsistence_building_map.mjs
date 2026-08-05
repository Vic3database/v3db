import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runtimeSource = read("site/app/runtime.js");
const componentsSource = read("site/app/components.js");
const mapSource = read("site/app/map.js");
const filtersSource = read("site/app/filters.js");
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
assert.match(runtimeSource, /\{ key: "subsistence_buildings", labelKey: "filter\.subsistenceBuildings", mapMode: "subsistenceBuildings", mapOnly: true \}/, "resource filters must expose the combined subsistence-building map entry");
assert.match(functionSource(componentsSource, "resourceOptionToken"), /filter\.labelKey \? t\(filter\.labelKey\) : resourceFilterLabel\(filter\)/, "map-only resource filters must render their localized label when no icon exists");
assert.match(zhSource, /"filter\.subsistenceBuildings": "自给建筑"/, "Chinese UI must name the subsistence-building map entry");
assert.match(enSource, /"filter\.subsistenceBuildings": "Subsistence buildings"/, "English UI must name the subsistence-building map entry");

const expectedColors = new Map([
  ["building_subsistence_farm", "#c8893f"],
  ["building_subsistence_rice_farm", "#4c9f70"],
  ["building_subsistence_pasture", "#8b6f47"],
  ["building_subsistence_orchard", "#b5688b"],
  ["building_subsistence_fishing_village", "#4b87b6"],
]);
for (const [key, color] of expectedColors) {
  assert.match(mapSource, new RegExp(`\\["${key}", "${color}"\\]`), `${key} must use its agreed fixed map color`);
}
assert.match(functionSource(mapSource, "syncMapModeForView"), /filter\?\.mapMode === "subsistenceBuildings"/, "the subsistence entry must select its dedicated map mode");
assert.match(functionSource(mapSource, "buildMapFeatures"), /state\.mapMode === "subsistenceBuildings"/, "map feature dispatch must include the subsistence view");
assert.match(functionSource(mapSource, "buildSubsistenceBuildingMapFeatures"), /stateRegion\.subsistence_building/, "subsistence map features must read the region building key");
assert.match(functionSource(mapSource, "buildSubsistenceBuildingMapFeatures"), /SUBSISTENCE_BUILDING_EMPTY_COLOR/, "missing subsistence data must use a neutral land color");
assert.match(functionSource(filtersSource, "matchesResourceFilters"), /filter\?\.mapOnly/, "the map-only subsistence entry must not shrink the region list");

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
