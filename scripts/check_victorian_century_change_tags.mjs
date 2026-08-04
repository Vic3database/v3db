import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const baselineDatabase = path.join(root, "database", "vic3_1.13.9");
const victorianCenturyDatabase = process.env.VICTORIAN_CENTURY_DATABASE || path.join(root, "database", "victorian_century");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-vc-change-tags-"));
const baselineOut = path.join(tempRoot, "baseline");
const victorianCenturyOut = path.join(tempRoot, "victorian-century");
const changeFields = Object.freeze({
  countries: "tag",
  cultures: "key",
  cultureTraits: "key",
  stateRegions: "key",
  companies: "key",
  interestGroups: "key",
  interestGroupTraits: "key",
  ideologies: "key",
  laws: "key",
  technologies: "key",
  buildings: "key",
  buildingGroups: "key",
  productionMethodGroups: "key",
  productionMethods: "key",
  goods: "key",
  prestigeGoods: "key",
});

try {
  buildDataset(baselineDatabase, baselineOut);
  buildDataset(victorianCenturyDatabase, victorianCenturyOut, baselineDatabase);

  const baseline = readChunkedDataset(baselineOut);
  const victorianCentury = readChunkedDataset(victorianCenturyOut);
  const expected = changeSummary(baseline, victorianCentury);
  const actual = taggedSummary(victorianCentury);

  for (const field of Object.keys(changeFields)) {
    assert(expected[field].added + expected[field].adjusted > 0, `${field} should contain Victorian Century changes`);
    assert.deepEqual(actual[field], expected[field], `${field} change tags do not match the baseline comparison`);
  }
  assert.deepEqual(actual.technologies, { added: 1, adjusted: 0 }, "technology change tags should retain only the added VC technology");

  const sourceFiles = {
    index: readText("site/index.html"),
    runtime: readText("site/app/runtime.js"),
    filters: readText("site/app/filters.js"),
    components: readText("site/app/components.js"),
    map: readText("site/app/map.js"),
    boards: readText("site/app/boards.js"),
    economy: readText("site/app/economy.js"),
  };
  assert.match(sourceFiles.index, /id="victorianCenturyChangeFilterSection"/, "missing VC change filter section");
  assert.match(sourceFiles.index, /id="victorianCenturyAddedFilter"/, "missing VC added filter token");
  assert.match(sourceFiles.index, /id="victorianCenturyAdjustedFilter"/, "missing VC adjusted filter token");
  assert.match(sourceFiles.runtime, /victorianCenturyChangeKinds: new Set\(\)/, "missing VC change-kind filter state");
  assert.match(sourceFiles.runtime, /victorianCenturyAddedFilter/, "missing VC added filter element");
  assert.match(sourceFiles.runtime, /victorianCenturyAdjustedFilter/, "missing VC adjusted filter element");
  assert.match(sourceFiles.filters, /victorianCenturyChangeKinds\.size/, "entity filters must distinguish VC change kinds");
  assert.match(sourceFiles.components, /vc_change_kind/, "VC badge must read the generated change field");
  assert.match(sourceFiles.components, /tag-vc-added/, "VC added entries need a dedicated badge class");
  assert.match(sourceFiles.components, /tag-vc-adjusted/, "VC adjusted entries need a dedicated badge class");
  assert.match(sourceFiles.map, /matchesVictorianCenturyChange/, "state-trait map choices must respect the VC change-kind condition");
  assert.match(sourceFiles.boards, /united_fruit_banana_tech: \{ column: 8, row: 1 \}/, "VC added technology needs an explicit position two columns left of sericulture");
  assert.doesNotMatch(sourceFiles.boards, /data-technology-victorian-added-filter/, "technology board must not show a VC added filter token");
  assert.doesNotMatch(sourceFiles.boards, /data-technology-victorian-adjusted-filter/, "technology board must not show a VC adjusted filter token");
  assert.match(sourceFiles.economy, /matchesVictorianCenturyChange/, "economy boards must apply the VC change filter");
  assert.match(sourceFiles.economy, /victorianCenturyBadge/, "economy boards must render VC change badges");
  assert.match(sourceFiles.economy, /data-economy-vc-change/, "economy boards must expose local VC filter buttons");
  assert(actual.buildings.adjusted >= 43, "VC must mark every patched building as adjusted");
  assert.equal(actual.prestigeGoods.added, 26, "VC must mark the 26 new prestige goods as added");

  console.log(JSON.stringify({
    victorian_century_change_tags: "ok",
    changes: actual,
  }, null, 2));
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

function buildDataset(database, out, baseline = "") {
  const args = [
    path.join(root, "scripts", "build_wiki.mjs"),
    "--database", database,
    "--out", out,
  ];
  if (baseline) args.push("--baseline-database", baseline);
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `wiki build failed:\n${result.stdout}\n${result.stderr}`);
}

function changeSummary(baseline, current) {
  const summary = {};
  for (const [field, keyField] of Object.entries(changeFields)) {
    const baselineByKey = new Map((baseline[field] || []).map((item) => [item[keyField], item]));
    summary[field] = { added: 0, adjusted: 0 };
    for (const item of current[field] || []) {
      const before = baselineByKey.get(item[keyField]);
      if (!before) {
        summary[field].added += 1;
      } else if (stableJson(normalizeForComparison(item, field === "technologies")) !== stableJson(normalizeForComparison(before, field === "technologies"))) {
        summary[field].adjusted += 1;
      }
    }
  }
  summary.stateTraits = stateTraitChangeSummary(baseline.stateRegions, current.stateRegions);
  return summary;
}

function taggedSummary(data) {
  const summary = {};
  for (const field of Object.keys(changeFields)) summary[field] = countChangeKinds(data[field]);
  summary.stateTraits = countChangeKinds(flattenStateTraits(data.stateRegions));
  return summary;
}

function stateTraitChangeSummary(baselineRegions, currentRegions) {
  const baselineTraits = new Map(flattenStateTraits(baselineRegions).map((item) => [item.key, item]));
  const summary = { added: 0, adjusted: 0 };
  for (const trait of flattenStateTraits(currentRegions)) {
    const before = baselineTraits.get(trait.key);
    if (!before) summary.added += 1;
    else if (stableJson(normalizeForComparison(trait)) !== stableJson(normalizeForComparison(before))) summary.adjusted += 1;
  }
  return summary;
}

function flattenStateTraits(regions) {
  const byKey = new Map();
  for (const region of regions || []) {
    for (const trait of region.traits || []) {
      if (trait?.key && !byKey.has(trait.key)) byKey.set(trait.key, trait);
    }
  }
  return [...byKey.values()];
}

function countChangeKinds(rows) {
  return (rows || []).reduce((summary, row) => {
    if (row?.vc_change_kind === "added") summary.added += 1;
    if (row?.vc_change_kind === "adjusted") summary.adjusted += 1;
    return summary;
  }, { added: 0, adjusted: 0 });
}

function normalizeForComparison(value, ignoreTechnologyReferences = false) {
  if (Array.isArray(value)) return value.map((item) => normalizeForComparison(item, ignoreTechnologyReferences));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["id", "source", "source_file", "source_files", "sourceFile", "definition_file", "definitionFile", "vc_change_kind"].includes(key) && !(ignoreTechnologyReferences && key === "references"))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, normalizeForComparison(item, ignoreTechnologyReferences)]));
}

function stableJson(value) {
  return JSON.stringify(value);
}

function readGlobal(file, name) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window[name];
}

function readChunkedDataset(directory) {
  const index = readGlobal(path.join(directory, "data-index.js"), "VIC3_DATA_INDEX");
  const dataset = { meta: index.meta || {} };
  for (const entry of Object.values(index.chunks || {})) {
    for (const file of entry.files || []) {
      const chunk = readGlobal(path.join(directory, file), "VIC3_DATA_CHUNK");
      for (const [field, value] of Object.entries(chunk || {})) {
        dataset[field] = field === "countries" ? [...(dataset[field] || []), ...(value || [])] : value;
      }
    }
  }
  return dataset;
}

function readText(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}
