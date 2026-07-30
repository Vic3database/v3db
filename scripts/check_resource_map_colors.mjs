import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mapSource = read("site/app/map.js");
const indexSource = read("site/index.html");
const dataSource = read("site/versions/1.13.9/data-regions.js");
const data = JSON.parse(dataSource.replace(/^window\.VIC3_DATA_CHUNK\s*=\s*/, "").replace(/;\s*$/, ""));
const resourceKeys = new Set(data.stateRegions.flatMap((stateRegion) => [
  ...(stateRegion.capped_resources || []),
  ...(stateRegion.discoverable_resources || []),
  ...(stateRegion.arable_resources || []),
].map((item) => item.key).filter(Boolean)));

for (const key of resourceKeys) {
  assert.match(mapSource, new RegExp(`"${key}"`), `resource color table must mention ${key}`);
}
assert.match(mapSource, /const RESOURCE_MAP_COLOR_ALIASES = new Map\(\[\s*\["building_gold_field", "building_gold_mine"\]/, "gold field must inherit the gold mine color");
assert.match(mapSource, /const AGRICULTURAL_RESOURCE_KEYS = new Set\(\[/, "agricultural resource keys must be explicit");
assert.match(mapSource, /const AGRICULTURAL_RESOURCE_COLOR = "#416d36"/, "all agriculture must use the approved green endpoint");
assert.match(mapSource, /const AGRICULTURAL_RESOURCE_NEUTRAL_COLOR = "#dce9cf"/, "low agricultural capacity must remain green-tinted");
assert.match(mapSource, /function resourceMapGradientColor\(/, "both resource views need a shared gradient helper");
assert.match(mapSource, /function computeStrategicRegionMapCenters\(/, "watermarks need strategic-region land centers");
assert.match(mapSource, /function drawAgriculturalResourceWatermarks\(/, "agricultural watermarks need a dedicated draw pass");
assert.match(mapSource, /state\.mapMode !== "resourceSelection" \|\| !isAgriculturalResourceKey\(state\.mapSubject\)/, "watermarks must be limited to an agricultural resource selection");
assert.match(mapSource, /context\.measureText\(text\)/, "watermark collision must use measured text bounds");
assert.match(mapSource, /rectanglesOverlap\(/, "watermark collision must skip overlapping labels");
assert.match(indexSource, /app\/map\.js\?v=20260730-resource-map-colors1/, "main entry must invalidate the changed map script");

console.log(JSON.stringify({ resource_map_colors: "ok", resources: resourceKeys.size }, null, 2));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}
