import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const indexSource = readText("site/index.html");
const runtimeSource = readText("site/app/runtime.js");
const dataSource = readText("site/app/data.js");
const uiSource = readText("site/app/ui.js");
const mapSource = readText("site/app/map.js");
const filtersSource = readText("site/app/filters.js");
const extractorSource = readText("scripts/extract_vic3_countries.mjs");
const dataRoot = process.env.VICDATA_DATA_ROOT || root;
const victorianCenturyDataRoot = process.env.VICDATA_VC_DATA_ROOT || dataRoot;
const states = JSON.parse(readText(path.join(dataRoot, "database/vic3_1.13.9/state_regions.json")));
const victorianCenturyStateFile = path.join(victorianCenturyDataRoot, "database/victorian_century/state_regions.json");
const victorianCenturyStates = fs.existsSync(victorianCenturyStateFile) ? JSON.parse(readText(victorianCenturyStateFile)) : null;
const assignments = states.flatMap((stateRegion) => stateRegion.traits || []);
const uniqueTraits = [...new Map(assignments.map((trait) => [trait.key, trait])).values()];
const ishikariWetlands = uniqueTraits.find((trait) => trait.key === "state_trait_ishikari_wetlands_1");
const nileRiver = uniqueTraits.find((trait) => trait.key === "state_trait_nile_river");
const malaria = uniqueTraits.find((trait) => trait.key === "state_trait_malaria");
const severeMalaria = uniqueTraits.find((trait) => trait.key === "state_trait_severe_malaria");

for (const [label, trait] of Object.entries({ ishikariWetlands, nileRiver, malaria, severeMalaria })) {
  assert.ok(trait, `main data should contain ${label}`);
}

const traitFilterContext = {
  state: { stateTraitFilters: new Set() },
  Set,
};
vm.runInNewContext(`
  ${functionSource(filtersSource, "stateTraitFilterKeys")}
  ${functionSource(filtersSource, "stateTraitMatchesSelectedFilters")}
  this.stateTraitFilterKeys = stateTraitFilterKeys;
  this.stateTraitMatchesSelectedFilters = stateTraitMatchesSelectedFilters;
`, traitFilterContext);

assert.deepEqual(
  [...traitFilterContext.stateTraitFilterKeys(ishikariWetlands)].sort(),
  ["land", "resources", "waterways"],
  "Ishikari wetlands should retain all three overlapping categories",
);
assert.deepEqual(
  [...traitFilterContext.stateTraitFilterKeys(nileRiver)].sort(),
  ["land", "mapi", "waterways"],
  "Nile should combine water, land and MAPI",
);
assert.deepEqual(
  [...traitFilterContext.stateTraitFilterKeys(malaria)],
  ["colonial_environment"],
  "malaria should use its disabling technology as colonial environment evidence",
);
assert.deepEqual(
  [...traitFilterContext.stateTraitFilterKeys(severeMalaria)],
  ["colonial_environment"],
  "severe malaria should use its colonization and disabling technologies",
);
assert.deepEqual([...traitFilterContext.stateTraitFilterKeys({})], [], "missing optional fields should produce no specific categories");

traitFilterContext.state.stateTraitFilters = new Set(["waterways", "resources"]);
assert.equal(traitFilterContext.stateTraitMatchesSelectedFilters(ishikariWetlands), true, "specific categories should use OR matching");
assert.equal(traitFilterContext.stateTraitMatchesSelectedFilters(malaria), false, "unselected categories should not match");
traitFilterContext.state.stateTraitFilters = new Set(["all"]);
assert.equal(traitFilterContext.stateTraitMatchesSelectedFilters(malaria), true, "all should match every trait");

for (const [label, rows] of [["main", states], ["Victorian Century", victorianCenturyStates]]) {
  if (!rows) continue;
  const traits = [...new Map(rows.flatMap((region) => region.traits || []).map((trait) => [trait.key, trait])).values()];
  const uncovered = traits.filter((trait) => traitFilterContext.stateTraitFilterKeys(trait).size === 0);
  assert.deepEqual(uncovered.map((trait) => trait.key), [], `${label} traits should all reach at least one specific filter`);
}

assert.ok(/id="stateTraitMapViewButton"/.test(indexSource), "region filters should expose the state-trait view button");
assert.ok(/styles\.css\?v=20260803-state-trait-map2/.test(indexSource), "trait map styles should refresh the main stylesheet URL");
for (const script of ["runtime", "data", "ui"]) {
  assert.ok(new RegExp(`app/${script}\\.js\\?v=20260803-state-trait-map1`).test(indexSource), `${script} should retain its current cache URL`);
}
assert.ok(/app\/map\.js\?v=20260803-state-trait-map2/.test(indexSource), "map should refresh its cache URL");
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
assert.ok(/stateTraitLocaleMessages: new Map\(\)/.test(runtimeSource), "map runtime should cache trait locale messages");
assert.ok(/Promise\.all/.test(functionSource(mapSource, "loadStateTraitIconImages")), "trait icon images should preload before paint");
assert.ok(/dataIndex\?\.locales\?\.chunks/.test(functionSource(mapSource, "loadStateTraitLocaleMessages")), "trait locale loader should support localized standalone datasets");
assert.ok(/if \(state\.mapMode === "traitIcons"\) \{\s*loadStateTraitLocaleMessages\(\)/.test(functionSource(mapSource, "renderMap", true)), "trait locale messages should load when an already-ready map switches to trait mode");
const drawStateTraitMapIconsSource = functionSource(mapSource, "drawStateTraitMapIcons");
assert.ok(/const iconSize = 30;/.test(drawStateTraitMapIconsSource), "trait icons should use the agreed 30 pixel screen size");
assert.doesNotMatch(drawStateTraitMapIconsSource, /const rows =|const columns =|const row =/, "trait icons should stay on one row");
assert.ok(/\(index - \(feature\.traits\.length - 1\) \/ 2\) \* mapIconSize/.test(drawStateTraitMapIconsSource), "trait icons should center one horizontal row on the region");
assert.ok(/for \(const trait of feature\.traits \|\| \[\]\)/.test(functionSource(mapSource, "drawStateTraitMapIcons")), "icon layer should draw every trait without truncation");
assert.ok(/drawStateTraitMapIcons\(context, copyRange, transform\)/.test(functionSource(mapSource, "paintMapCanvasTarget")), "icon layer should draw after the transformed map layer");
assert.ok(/mapRuntime\.stateTraitIconImages = new Map\(\)/.test(functionSource(dataSource, "resetMapRuntime")), "dataset resets should clear trait icon images");
assert.ok(/state\.mapMode === "traitIcons"/.test(functionSource(mapSource, "mapTooltipRowsForView")), "trait icon mode should use a dedicated tooltip branch");
assert.ok(/stateTraitIconFileName/.test(functionSource(mapSource, "mapTooltipStateTraitHtml")), "trait tooltip should resolve the same icon files as the map");
assert.ok(/stateTraitEffectText/.test(functionSource(mapSource, "mapTooltipStateTraitHtml")), "trait tooltip should include effects");
assert.ok(/modifier_summary_zh/.test(functionSource(mapSource, "stateTraitLocalizedText")), "trait tooltip should retain directly localized effects");
assert.ok(/modifierSummary/.test(functionSource(mapSource, "stateTraitEffectText")), "trait tooltip should resolve delayed localized effects");
assert.ok(/\.map-tooltip-trait-icon\s*\{[\s\S]*width:\s*30px;[\s\S]*height:\s*30px;/.test(readText("site/styles/map.css")), "trait tooltip icons should use the agreed 30 pixel size");
assert.ok(/!key\.startsWith\("state_trait_"\) && !icon\.includes\("\/state_trait_icons\/"\)/.test(functionSource(extractorSource, "loadStateTraits")), "extractor should retain mod traits whose declared keys omit the conventional prefix");
if (victorianCenturyStates) {
  for (const key of ["sacramento_river", "sao_francisco_river"]) {
    const trait = victorianCenturyStates.flatMap((stateRegion) => stateRegion.traits || []).find((item) => item.key === key);
    assert.ok(trait, `Victorian Century should retain ${key}`);
    assert.equal(trait.icon, "gfx/interface/icons/state_trait_icons/river.dds", `${key} should resolve its declared river icon`);
  }
}

console.log(JSON.stringify({ state_trait_map: "ok", unique_traits: uniqueTraits.length }, null, 2));

function readText(filename) {
  return fs.readFileSync(path.isAbsolute(filename) ? filename : path.join(root, filename), "utf8").replace(/^\uFEFF/, "");
}

function functionSource(source, name, exact = false) {
  const start = source.indexOf(`function ${name}${exact ? "(" : ""}`);
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
