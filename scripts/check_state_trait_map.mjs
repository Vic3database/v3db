import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexSource = readText("site/index.html");
const runtimeSource = readText("site/app/runtime.js");
const dataSource = readText("site/app/data.js");
const uiSource = readText("site/app/ui.js");
const mapSource = readText("site/app/map.js");
const dataRoot = process.env.VICDATA_DATA_ROOT || root;
const states = JSON.parse(readText(path.join(dataRoot, "database/vic3_1.13.9/state_regions.json")));
const assignments = states.flatMap((stateRegion) => stateRegion.traits || []);
const uniqueTraits = [...new Map(assignments.map((trait) => [trait.key, trait])).values()];

assert.ok(/id="stateTraitMapViewButton"/.test(indexSource), "region filters should expose the state-trait view button");
assert.ok(/stateTraitMapViewButton: document\.querySelector\("#stateTraitMapViewButton"\)/.test(runtimeSource), "runtime should expose the state-trait button");
assert.ok(/state\.regionMapView = state\.regionMapView === "traits" \? "default" : "traits"/.test(functionSource(uiSource, "bindEvents")), "trait button should toggle the trait view");
assert.ok(/state\.regionMapView === "traits"[\s\S]*state\.mapMode = "traitIcons"/.test(functionSource(mapSource, "syncMapModeForView")), "trait view should take precedence over region resource mode");
assert.equal(uniqueTraits.length, 221, "current main dataset should retain 221 unique state traits");
assert.equal(states.filter((stateRegion) => (stateRegion.traits || []).length > 0).length, 507, "every trait-bearing region must be considered");
for (const trait of uniqueTraits) {
  assert.ok(fs.existsSync(path.join(root, "site/assets/state-traits", stateTraitIconFileName(trait))), `${trait.key} should resolve to a shipped icon`);
}
assert.ok(/traits: stateRegion\.traits \|\| \[\]/.test(functionSource(mapSource, "buildTraitIconMapFeatures")), "trait icon features should retain every trait in each region");
assert.ok(/replace\(\/\\\.dds\$\/i, "\.png"\)/.test(functionSource(mapSource, "stateTraitIconFileName")), "icon names should derive from DDS icon paths");
assert.ok(/stateTraitIconImages: new Map\(\)/.test(runtimeSource), "map runtime should cache trait icon images");
assert.ok(/Promise\.all/.test(functionSource(mapSource, "loadStateTraitIconImages")), "trait icon images should preload before paint");
assert.ok(/const iconSize = 22;/.test(functionSource(mapSource, "drawStateTraitMapIcons")), "trait icons should preserve the agreed 22 pixel screen size");
assert.ok(/for \(const trait of feature\.traits \|\| \[\]\)/.test(functionSource(mapSource, "drawStateTraitMapIcons")), "icon layer should draw every trait without truncation");
assert.ok(/drawStateTraitMapIcons\(context, copyRange, transform\)/.test(functionSource(mapSource, "paintMapCanvasTarget")), "icon layer should draw after the transformed map layer");
assert.ok(/mapRuntime\.stateTraitIconImages = new Map\(\)/.test(functionSource(dataSource, "resetMapRuntime")), "dataset resets should clear trait icon images");

console.log(JSON.stringify({ state_trait_map: "ok", unique_traits: uniqueTraits.length }, null, 2));

function readText(filename) {
  return fs.readFileSync(path.isAbsolute(filename) ? filename : path.join(root, filename), "utf8").replace(/^\uFEFF/, "");
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

function stateTraitIconFileName(trait) {
  const iconPath = String(trait?.icon || "");
  return iconPath
    ? iconPath.split(/[\\/]/).at(-1).replace(/\.dds$/i, ".png")
    : `${String(trait?.key || "").replace(/^state_trait_/, "")}.png`;
}
