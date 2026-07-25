import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const runtime = read("site/app/runtime.js");
const data = read("site/app/data.js");
const components = read("site/app/components.js");
const presentation = read("site/app/presentation.js");
const ui = read("site/app/ui.js");
const definitions = read("site/app/tag-tooltip-definitions.js");

for (const mapName of ["stateTraitByKey", "buildingByKey", "goodsByKey"]) {
  requireMatch(runtime, new RegExp(`let\\s+${mapName}\\s*=\\s*new Map\\(\\)`), `${mapName} runtime index is missing`);
}
requireMatch(data, /function\s+buildSemanticTagIndexes\s*\(/, "semantic tag index builder is missing");
requireMatch(functionSource(data, "applyLoadedDataset"), /buildSemanticTagIndexes\(\)/, "semantic tag index builder is not called after loading data");

const stateTraitPills = functionSource(components, "stateTraitPills");
const stateTraitPill = functionSource(components, "stateTraitPill");
requireMatch(stateTraitPills, /stateTraitPill/, "state trait pill list must use the dedicated entity tag renderer");
requireMatch(stateTraitPill, /kind:\s*"stateTrait"/, "state trait pills must use the stateTrait entity type");
requireMatch(stateTraitPill, /stateTraitTooltipDescription\(/, "state trait pills must bind their effect summary");
requireMatch(stateTraitPill, /conceptTooltipMetadata\(label, "", "stateTrait"/, "state trait type must not be replaced by its color class");
requireMatch(functionSource(components, "buildingTooltipMetadata"), /conceptTooltipMetadata\(label, "", "building"/, "building type must not be replaced by its color class");
requireMatch(functionSource(components, "technologyPill"), /conceptTooltipMetadata\(label, "", "technology"/, "technology type must not be replaced by its color class");

const modifierPills = functionSource(components, "modifierPills");
requireMatch(modifierPills, /mapi-effect/, "MAPI effects need a dedicated semantic key");
requireMatch(components, /mapi-summary/, "MAPI summaries need a dedicated semantic key");
requireMatch(components, /mapi-category/, "MAPI categories need a dedicated semantic key");
requireMatch(components, /state-trait-category/, "state trait categories need a dedicated semantic key");

for (const kind of ["stateTrait", "building", "goods", "technology"]) {
  requireMatch(ui, new RegExp(`kind === "${kind}"`), `${kind} tooltip entity resolver is missing`);
  requireMatch(ui, new RegExp(`${kind}: "`), `${kind} tooltip label is missing`);
}
requireMatch(components, /if \(kind === "technology"\) return `#\/technology\//, "technology tags must link to the technology detail page");
requireMatch(functionSource(components, "ideologyUnlockTagsHtml"), /technologyPill\(/, "ideology technology tags must be technology entities");
requireMatch(functionSource(components, "conditionRefPills"), /"technology",\s*"tag-technology"/, "condition technology tags must be technology entities");

assert.equal(presentation.includes('conceptTag(company.key, "company", company.key, company.name_zh)'), false, "company IDs must not render as tags");
requireMatch(functionSource(components, "strategicRegionTagPills"), /relationshipRefPills\(/, "strategic region tags need relation-aware references");
requireMatch(functionSource(components, "geographicRegionTagPills"), /relationshipRefPills\(/, "geographic region tags need relation-aware references");

for (const key of [
  "state-trait-category",
  "state-trait-effect",
  "mapi-summary",
  "mapi-category",
  "mapi-effect",
  "strategic-region-starting-owner",
  "strategic-region-homeland-culture",
  "geographic-region-strategic-region",
  "geographic-region-state-region-count",
]) {
  requireMatch(definitions, new RegExp(`"${key}"\\s*:`), `tooltip definition is missing ${key}`);
}

const regions = readChunk("site/versions/1.13.9/data-regions.js");
const companies = readChunk("site/versions/1.13.9/data-companies.js");
const technologies = readChunk("site/versions/1.13.9/data-technologies.js");
const technologyKeys = new Set(technologies.technologies.map((technology) => technology.key));
const mapiTrait = regions.stateRegions.flatMap((region) => region.traits).find((trait) => trait.has_mapi);
const companyTechnology = companies.companies.flatMap((company) => company.required_technologies).find(Boolean);

assert.ok(mapiTrait?.modifiers?.some((modifier) => modifier.key === "state_market_access_price_impact"), "fixture data must contain a MAPI effect");
assert.ok(companyTechnology && technologyKeys.has(companyTechnology.key), "company technology references must resolve to a technology");
assert.ok(companies.companies.some((company) => company.possible_prestige_goods?.length), "fixture data must contain prestige goods");

console.log(JSON.stringify({ semantic_tag_coverage: "ok" }));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readChunk(relativePath) {
  const sandbox = { window: {} };
  vm.runInNewContext(read(relativePath), sandbox);
  return sandbox.window.VIC3_DATA_CHUNK;
}

function requireMatch(source, pattern, message) {
  assert.equal(pattern.test(source), true, message);
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) return "";
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  return source.slice(start);
}
