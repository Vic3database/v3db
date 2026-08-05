import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runtimeSource = read("site/app/runtime.js");
const componentsSource = read("site/app/components.js");
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
assert.match(runtimeSource, /\{ key: "subsistence_buildings", labelKey: "filter\.subsistenceBuildings", mapMode: "subsistenceBuildings" \}/, "resource filters must expose the combined subsistence-building map entry");
assert.match(functionSource(componentsSource, "resourceOptionToken"), /filter\.labelKey \? t\(filter\.labelKey\) : resourceFilterLabel\(filter\)/, "map-only resource filters must render their localized label when no icon exists");
assert.match(zhSource, /"filter\.subsistenceBuildings": "自给建筑"/, "Chinese UI must name the subsistence-building map entry");
assert.match(enSource, /"filter\.subsistenceBuildings": "Subsistence buildings"/, "English UI must name the subsistence-building map entry");

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
