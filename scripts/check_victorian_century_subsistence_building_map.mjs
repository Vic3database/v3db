import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standaloneRoot = path.join(root, "site", "vc");

function relativePath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function readRequired(relativeFilePath) {
  const filePath = path.join(standaloneRoot, relativeFilePath);
  assert.ok(fs.existsSync(filePath), `缺少 Victorian Century 独立站文件：${relativePath(filePath)}`);
  return fs.readFileSync(filePath, "utf8");
}

const indexSource = readRequired("index.html");
const runtimeSource = readRequired("app/runtime.js");
const filtersSource = readRequired("app/filters.js");
const mapSource = readRequired("app/map.js");
const localeSource = readRequired("locales/ui.zh-Hans.js");
const stylesSource = readRequired("styles/map.css");
const regionChunkSource = readRequired("data-regions.js");

assert.match(indexSource, /id="subsistenceBuildingMapLegend"/);
assert.match(runtimeSource, /key:\s*"subsistence_buildings"/);
assert.match(runtimeSource, /mapMode:\s*"subsistenceBuildings"/);
assert.match(runtimeSource, /icon:\s*"pops\/peasants\.webp"/);
assert.match(filtersSource, /if \(subsistenceGroup\) merged\.push\(subsistenceGroup\)/);
assert.match(mapSource, /SUBSISTENCE_BUILDING_GRADIENT_BY_KEY/);
for (const key of [
  "building_subsistence_farm",
  "building_subsistence_rice_farm",
  "building_subsistence_pasture",
  "building_subsistence_orchard",
  "building_subsistence_fishing_village",
]) {
  assert.match(mapSource, new RegExp(`\\["${key}",\\s*\\{\\s*low:`));
}
assert.doesNotMatch(mapSource, /map\.subsistenceBuildingTitle/);
assert.match(localeSource, /"map\.subsistenceBuilding\.building_subsistence_rice_farm":\s*"自给稻田"/);
assert.doesNotMatch(localeSource, /"map\.subsistenceBuildingTitle"/);
assert.match(stylesSource, /\.subsistence-building-map-legend-items/);

const regionChunkMatch = regionChunkSource.match(/^window\.VIC3_DATA_CHUNK\s*=\s*(.+);\s*$/s);
assert.ok(regionChunkMatch, "地区数据块格式不正确");
const { stateRegions = [] } = JSON.parse(regionChunkMatch[1]);
const buildingKinds = new Set(
  stateRegions
    .map((stateRegion) => stateRegion.subsistence_building)
    .filter(Boolean),
);
assert.deepEqual([...buildingKinds].sort(), [
  "building_subsistence_farm",
  "building_subsistence_fishing_village",
  "building_subsistence_orchard",
  "building_subsistence_pasture",
  "building_subsistence_rice_farm",
]);
const subsistenceRegions = stateRegions.filter((stateRegion) => stateRegion.subsistence_building);
assert.ok(subsistenceRegions.length > 0);
assert.ok(subsistenceRegions.every((stateRegion) => Number.isFinite(stateRegion.arable_land)));

console.log(`Victorian Century 自给建筑地图构建检查通过：${stateRegions.length} 个地区，${buildingKinds.size} 类自给建筑。`);
