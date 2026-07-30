import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mapSource = read("site/app/map.js");
const runtimeSource = read("site/app/runtime.js");
const indexSource = read("site/index.html");
const stylesEntrySource = read("site/styles.css");
const mapStylesSource = read("site/styles/map.css");
const dataSource = read("site/versions/1.13.9/data-regions.js");
const data = JSON.parse(dataSource.replace(/^window\.VIC3_DATA_CHUNK\s*=\s*/, "").replace(/;\s*$/, ""));
const resourceKeys = new Set(data.stateRegions.flatMap((stateRegion) => [
  ...(stateRegion.capped_resources || []),
  ...(stateRegion.discoverable_resources || []),
  ...(stateRegion.arable_resources || []),
].map((item) => item.key).filter(Boolean)));
const agriculturalGradients = new Map([
  ["building_wheat_farm", { low: "#f0dea8", high: "#c69b32" }],
  ["building_rye_farm", { low: "#e0ca98", high: "#8d713d" }],
  ["building_rice_farm", { low: "#cce7c7", high: "#4f9b72" }],
  ["building_maize_farm", { low: "#f2dfa4", high: "#d59d27" }],
  ["building_millet_farm", { low: "#e7d2a7", high: "#b88735" }],
  ["building_livestock_ranch", { low: "#dacdb9", high: "#87643e" }],
  ["building_vineyard", { low: "#ddc7df", high: "#7e4b86" }],
  ["building_coffee_plantation", { low: "#ddc8b5", high: "#765039" }],
  ["building_tea_plantation", { low: "#c6e2c5", high: "#3d7e4d" }],
  ["building_tobacco_plantation", { low: "#e7caa2", high: "#a66e37" }],
  ["building_opium_plantation", { low: "#e8c5d6", high: "#a85e83" }],
  ["building_banana_plantation", { low: "#efe9ab", high: "#b7a92d" }],
  ["building_sugar_plantation", { low: "#cae1bf", high: "#72a05e" }],
  ["building_silk_plantation", { low: "#e7d8e3", high: "#b27fa9" }],
  ["building_cotton_plantation", { low: "#deecf1", high: "#8baebb" }],
  ["building_dye_plantation", { low: "#c5d0ec", high: "#4c5ea7" }],
]);

for (const key of resourceKeys) {
  assert.match(mapSource, new RegExp(`"${key}"`), `resource color definitions must mention ${key}`);
}
for (const [key, { low, high }] of agriculturalGradients) {
  assert.match(mapSource, new RegExp(`\\["${key}", \\{ low: "${low}", high: "${high}" \\}\\]`), `agricultural gradient must define ${key}`);
}

assert.match(mapSource, /const RESOURCE_MAP_NEUTRAL_COLOR = "#f6d89a"/, "resources without a dedicated low color must retain the neutral endpoint");
assert.match(mapSource, /const RESOURCE_MAP_COLOR_ALIASES = new Map\(\[\s*\["building_gold_field", "building_gold_mine"\]/, "gold field must inherit the gold mine color");
assert.match(mapSource, /function resourceMapGradient\(/, "resource maps must resolve a gradient before interpolating");
assert.match(mapSource, /function resourceMapGradientColor\(/, "both resource views must use the shared gradient helper");
for (const removedIdentifier of [
  "drawAgriculturalResourceWatermarks",
  "computeStrategicRegionMapCenters",
  "strategicRegionCenters",
  "rectanglesOverlap",
  "AGRICULTURAL_RESOURCE_COLOR",
  "AGRICULTURAL_RESOURCE_NEUTRAL_COLOR",
]) {
  assert.doesNotMatch(mapSource, new RegExp(removedIdentifier), `${removedIdentifier} must be removed with the agricultural watermark`);
  assert.doesNotMatch(runtimeSource, new RegExp(removedIdentifier), `${removedIdentifier} must not remain in map runtime state`);
}

assert.match(indexSource, /<span id="mapResourceContext" class="map-resource-context" aria-live="polite" hidden><\/span>/, "toolbar must contain the hidden resource context");
assert.match(runtimeSource, /mapResourceContext: document\.querySelector\("#mapResourceContext"\)/, "runtime element table must expose the resource context");
assert.match(mapSource, /function renderMapResourceContext\(/, "map controls must render the selected resource context");
assert.match(mapSource, /map-resource-context-swatch/, "resources without a building icon must use a color swatch");
assert.match(mapStylesSource, /\.map-resource-context/, "resource context must have dedicated compact styles");
assert.match(mapStylesSource, /\.map-resource-context-version[\s\S]*white-space:\s*nowrap/, "resource context version must not wrap independently");
assert.match(runtimeSource, /const MAP_RESOURCE_LAND_ALPHA = 232;/, "resource maps must use their dedicated land opacity");
assert.match(functionSource(mapSource, "mapPixelAlpha"), /\["resource", "resourceSelection"\]\.includes\(state\.mapMode\)/, "only resource map modes may use the resource land opacity");
assert.match(indexSource, /styles\.css\?v=20260731-resource-map-context1/, "main entry must invalidate changed map styles");
assert.match(stylesEntrySource, /@import url\("styles\/map\.css\?v=20260731-resource-map-context1"\);/, "style entry must invalidate the changed map stylesheet");
assert.match(indexSource, /app\/map\.js\?v=20260731-resource-map-natural-colors1/, "main entry must invalidate the changed map script");

console.log(JSON.stringify({ resource_map_colors: "ok", resources: resourceKeys.size }, null, 2));

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
