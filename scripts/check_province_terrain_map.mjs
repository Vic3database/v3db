import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const indexSource = readText("site/index.html");
const mapSource = readText("site/app/map.js");
const runtimeSource = readText("site/app/runtime.js");
const dataSource = readText("site/app/data.js");
const uiSource = readText("site/app/ui.js");
const mapStylesSource = readText("site/styles/map.css");
const shellStylesSource = readText("site/styles/shell.css");
const terrainKeys = [
  "desert",
  "forest",
  "hills",
  "jungle",
  "lakes",
  "mountain",
  "ocean",
  "plains",
  "savanna",
  "snow",
  "tundra",
  "wetland",
];
const terrainMaps = [
  "site/map-data.js",
  "site/versions/1.13.9/map-data.js",
  "Victorian Century Database/map-data.js",
];

for (const relative of terrainMaps) {
  const map = readMapData(relative);
  const pixelCount = map.width * map.height;
  assert.deepEqual(
    new Set(map.terrainKeys.slice(1)),
    new Set(terrainKeys),
    `${relative} should contain every current province terrain key`,
  );
  const terrainIndexes = decodeRuns(map.terrainRuns, pixelCount);
  assert.deepEqual(terrainIndexes.length, pixelCount, `${relative} terrain runs should cover every pixel`);
  assert.equal(map.terrainKeys[1], "desert", `${relative} should preserve the source terrain table order`);
}

assert.match(runtimeSource, /terrainKeysByIndex: \[""\]/, "map runtime should reserve terrain key indexes");
assert.match(runtimeSource, /pixelTerrainIndexes: null/, "map runtime should reserve terrain pixels");
assert.match(dataSource, /mapRuntime\.pixelTerrainIndexes = null/, "dataset reset should clear terrain pixels");
assert.match(mapSource, /mapRuntime\.pixelTerrainIndexes = mapData\.terrainRuns/, "map load should decode terrain runs");
assert.match(mapSource, /state\.mapMode === "terrain"/, "map renderer should branch for terrain mode");
assert.match(mapSource, /terrainProvinceCodeFromPointerEvent/, "map should read province codes from pointer events");
assert.match(mapSource, /provinceColorFromPointerEvent/, "map should recover province colors from the existing province map image");
assert.match(functionSource(mapSource, "provinceColorFromPointerEvent"), /\.map\(\(value\) => value\.toString\(16\)\.padStart\(2, "0"\)\.toUpperCase\(\)\)[\s\S]*return `x\$\{hex\}`/, "province codes should preserve the lowercase x prefix and uppercase hexadecimal digits");
assert.match(mapSource, /\["省份代码", provinceCode\]/, "terrain tooltip should show province codes");
assert.match(indexSource, /id="terrainMapViewButton"/, "region filters should expose the terrain view button");
assert.match(indexSource, /id="terrainMapLegend"/, "map panel should include the terrain legend container");
assert.match(runtimeSource, /regionMapView: "default"/, "region state should retain the selected map view");
assert.match(runtimeSource, /terrainMapViewButton: document\.querySelector\("#terrainMapViewButton"\)/, "runtime elements should expose the terrain button");
assert.match(runtimeSource, /terrainMapLegend: document\.querySelector\("#terrainMapLegend"\)/, "runtime elements should expose the terrain legend");
assert.match(functionSource(uiSource, "bindEvents"), /state\.regionMapView = state\.regionMapView === "terrain" \? "default" : "terrain"/, "terrain button should toggle the regional terrain mode");
assert.match(functionSource(uiSource, "changeBoard"), /view !== "region"\) state\.regionMapView = "default"/, "leaving the region board should reset the terrain mode");
assert.match(functionSource(uiSource, "initializeDefaultFilterSectionOpenStates"), /"terrainMapViewButton"/, "terrain view control should be visible when the filter sidebar opens");
assert.match(functionSource(mapSource, "syncMapModeForView"), /state\.view === "region" && state\.regionMapView === "terrain"[\s\S]*state\.mapMode = "terrain"/, "terrain mode should take precedence over region resource mode");
assert.match(functionSource(mapSource, "regionMapStateRegions"), /filteredStateRegions\.filter\(\(stateRegion\) => geographicStateKeys\.has\(stateRegion\.key\)\)/, "geographic-region map focus should retain the active resource and strategic-region filters");
assert.match(functionSource(mapSource, "renderTerrainMapLegend"), /terrainLegendEntries/, "terrain legend should render the land terrain entries");
assert.match(functionSource(mapSource, "renderTerrainMapLegend"), /els\.terrainMapLegend\.hidden = !enabled/, "terrain legend should hide outside terrain mode");
assert.match(mapSource, /key: "plains", label: "平原", color: "#d9c989", rgb: \[217, 201, 137\]/, "terrain entries should retain precomputed RGB colors for the map layer");
assert.match(functionSource(mapSource, "terrainPixelRgb"), /terrainLegendByKey\.get\(terrainKey\)\.rgb/, "terrain drawing should reuse precomputed RGB colors");
assert.match(mapStylesSource, /\.terrain-map-legend\s*\{[\s\S]*flex-wrap:\s*wrap/, "terrain legend should wrap items");
assert.match(shellStylesSource, /\.terrain-map-legend\s*\{[\s\S]*position:\s*absolute/, "terrain legend should overlay the lower map area");
assert.equal((mapSource.match(/key: "(plains|forest|hills|mountain|jungle|wetland|desert|tundra|savanna|snow)"/g) || []).length, 10, "terrain legend should expose ten land types");
assert.match(indexSource, /app\/map\.js\?v=20260802-province-terrain1/, "terrain map script should have a fresh cache version");

console.log(JSON.stringify({ province_terrain_map: "ok", terrain_types: terrainKeys.length }, null, 2));

function readMapData(relative) {
  const filename = path.join(root, relative);
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), sandbox, { filename });
  return sandbox.window.VIC3_MAP_DATA || {};
}

function readText(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");
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

function decodeRuns(runs, expectedLength) {
  assert.ok(Array.isArray(runs), "map runs should be arrays");
  assert.equal(runs.length % 2, 0, "map runs should use index-length pairs");
  const values = new Int32Array(expectedLength);
  let cursor = 0;
  for (let index = 0; index < runs.length; index += 2) {
    const value = runs[index] || 0;
    const length = runs[index + 1] || 0;
    values.fill(value, cursor, cursor + length);
    cursor += length;
  }
  assert.equal(cursor, expectedLength, "map runs should have the expected total length");
  return values;
}
