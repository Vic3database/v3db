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
const recordStyles = read("site/styles/records.css");

for (const mapName of ["stateTraitByKey", "stateTraitRegionsByKey", "buildingByKey", "goodsByKey"]) {
  requireMatch(runtime, new RegExp(`let\\s+${mapName}\\s*=\\s*new Map\\(\\)`), `${mapName} runtime index is missing`);
}
requireMatch(data, /function\s+buildSemanticTagIndexes\s*\(/, "semantic tag index builder is missing");
requireMatch(functionSource(data, "applyLoadedDataset"), /buildSemanticTagIndexes\(\)/, "semantic tag index builder is not called after loading data");

const stateTraitPills = functionSource(components, "stateTraitPills");
const stateTraitPill = functionSource(components, "stateTraitPill");
const stateTraitTooltipDescription = functionSource(components, "stateTraitTooltipDescription");
requireMatch(stateTraitPills, /stateTraitPill/, "state trait pill list must use the dedicated entity tag renderer");
requireMatch(stateTraitPill, /kind:\s*"stateTrait"/, "state trait pills must use the stateTrait entity type");
requireMatch(stateTraitPill, /stateTraitTooltipDescription\(/, "state trait pills must bind their effect summary");
requireMatch(stateTraitPill, /conceptTooltipMetadata\(label, "", "stateTrait"/, "state trait type must not be replaced by its color class");
requireMatch(stateTraitPills, /stateTraitPill\(trait, stateRegion\)/, "state trait pills must know their current region");
assert.equal(stateTraitTooltipDescription.includes("\u6548\u679c\uFF1A"), false, "state trait effect summaries must not add a redundant effect heading");
requireMatch(components, /function\s+stateTraitTooltipSecondaryDescription\s*\(/, "state trait region lists need their own tooltip section");
requireMatch(stateTraitPill, /secondaryDescription/, "state trait pills must pass their region list as a separate tooltip section");
requireMatch(functionSource(components, "stateTraitTooltipSecondaryDescription"), /00_generic_traits/, "generic state traits must be identified by their source file");
requireMatch(functionSource(components, "stateTraitTooltipSecondaryDescription"), /stateTraitRegionsByKey/, "regional state traits must list their other regions");
requireMatch(functionSource(components, "buildingTooltipMetadata"), /conceptTooltipMetadata\(label, "", "building"/, "building type must not be replaced by its color class");
requireMatch(functionSource(components, "technologyPill"), /conceptTooltipMetadata\(label, "", "technology"/, "technology type must not be replaced by its color class");
assert.equal(functionSource(components, "agricultureSummaryPills").includes("limitedHtmlItems"), false, "agricultural resources must not be truncated");
requireMatch(functionSource(components, "agricultureSummaryPills"), /buildingPill\(/, "agricultural resources must retain their PNG building icons");
assert.equal(functionSource(components, "stateRegionBuildingStrip").includes("limitedHtmlItems"), false, "region resource strips must not truncate agricultural resources");
requireMatch(functionSource(components, "stateRegionBuildingStrip"), /buildingChip\(/, "region resource strips must retain their PNG building icons");
requireMatch(recordStyles, /\.concept-tooltip \.concept-tooltip-description\s*\{[^}]*white-space:\s*pre-line/s, "tooltip descriptions must preserve deliberate line breaks");
assert.equal(definitions.includes("属于"), false, "tooltip descriptions must not restate a category membership without adding information");

const modifierPills = functionSource(components, "modifierPills");
assert.equal(modifierPills.includes("conceptPill("), false, "numeric modifier values must not create hover tooltips");
requireMatch(components, /mapi-summary/, "MAPI summaries need a dedicated semantic key");
requireMatch(components, /mapi-category/, "MAPI categories need a dedicated semantic key");
requireMatch(components, /state-trait-category/, "state trait categories need a dedicated semantic key");

for (const kind of ["stateTrait", "building", "goods", "technology"]) {
  requireMatch(ui, new RegExp(`kind === "${kind}"`), `${kind} tooltip entity resolver is missing`);
  requireMatch(ui, new RegExp(`${kind}: "`), `${kind} tooltip label is missing`);
}
const conceptTooltipContent = functionSource(ui, "conceptTooltipContent");
requireMatch(conceptTooltipContent, /conceptSecondaryDescription/, "tooltip content must render a secondary description section");
requireMatch(conceptTooltipContent, /concept-tooltip-divider/, "tooltip content must divide its secondary description section");
const countryTooltipMainInfo = functionSource(ui, "countryTooltipMainInfo");
requireMatch(countryTooltipMainInfo, /primaryCulturesZh/, "country tooltip main information must include primary cultures");
requireMatch(countryTooltipMainInfo, /religionZh/, "country tooltip main information must include religion");
requireMatch(countryTooltipMainInfo, /capitalZh/, "country tooltip main information must include capital location");
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
const countries = [1, 2, 3, 4].flatMap((index) => readChunk(`site/versions/1.13.9/data-countries-${index}.js`).countries);
const technologyKeys = new Set(technologies.technologies.map((technology) => technology.key));
const mapiTrait = regions.stateRegions.flatMap((region) => region.traits).find((trait) => trait.has_mapi);
const companyTechnology = companies.companies.flatMap((company) => company.required_technologies).find(Boolean);
const scandinavianForests = regions.stateRegions.flatMap((region) => region.traits).filter((trait) => trait.key === "state_trait_scandinavian_forests");
const naturalHarbors = regions.stateRegions.flatMap((region) => region.traits).filter((trait) => trait.key === "state_trait_natural_harbors");
const sweden = countries.find((country) => country.tag === "SWE");

assert.ok(mapiTrait?.modifiers?.some((modifier) => modifier.key === "state_market_access_price_impact"), "fixture data must contain a MAPI effect");
assert.ok(companyTechnology && technologyKeys.has(companyTechnology.key), "company technology references must resolve to a technology");
assert.ok(companies.companies.some((company) => company.possible_prestige_goods?.length), "fixture data must contain prestige goods");
assert.ok(scandinavianForests.length > 1 && scandinavianForests.every((trait) => !/00_generic_traits\.txt$/i.test(trait.source_file || "")), "fixture data must contain a shared regional state trait");
assert.ok(naturalHarbors.length > 1 && naturalHarbors.every((trait) => /00_generic_traits\.txt$/i.test(trait.source_file || "")), "fixture data must contain a shared generic state trait");
assert.ok(sweden, "fixture data must contain Sweden for country tooltip coverage");

const stateTraitRegionsByKey = new Map();
for (const region of regions.stateRegions) {
  for (const trait of region.traits || []) {
    const entries = stateTraitRegionsByKey.get(trait.key) || [];
    entries.push({ key: region.key, name_zh: region.name_zh });
    stateTraitRegionsByKey.set(trait.key, entries);
  }
}
const descriptionContext = {
  stateTraitRegionsByKey,
  technologyRefNames: (items) => items.map((item) => item.name_zh || item.key).join("、"),
};
vm.runInNewContext(`${functionSource(components, "stateTraitTooltipDescription")}; this.describeStateTrait = stateTraitTooltipDescription;`, descriptionContext);
vm.runInNewContext(`${functionSource(components, "stateTraitTooltipSecondaryDescription")}; this.describeStateTraitSecondary = stateTraitTooltipSecondaryDescription;`, descriptionContext);
const regionalDescription = descriptionContext.describeStateTrait(scandinavianForests[0], regions.stateRegions.find((region) => region.key === "STATE_SVEALAND"));
const regionalSecondaryDescription = descriptionContext.describeStateTraitSecondary(scandinavianForests[0], regions.stateRegions.find((region) => region.key === "STATE_SVEALAND"));
const genericDescription = descriptionContext.describeStateTrait(naturalHarbors[0], regions.stateRegions.find((region) => region.key === "STATE_SVEALAND"));
const genericSecondaryDescription = descriptionContext.describeStateTraitSecondary(naturalHarbors[0], regions.stateRegions.find((region) => region.key === "STATE_SVEALAND"));
assert.equal(regionalDescription, "伐木业吞吐量 +20%", "state trait effects must display without a redundant heading");
assert.match(regionalSecondaryDescription, /拥有该特质的地区：\n约塔兰/, "regional state traits must name their other regions in a separate section");
assert.equal(genericDescription.includes("\u6548\u679c\uFF1A"), false, "generic state trait effects must not add a redundant heading");
assert.equal(genericSecondaryDescription, "", "generic state traits must not list every region that uses them");

const countryContext = {};
vm.runInNewContext(`${countryTooltipMainInfo}; this.describeCountry = countryTooltipMainInfo;`, countryContext);
assert.equal(countryContext.describeCountry(sweden), "主流文化：瑞典\n宗教：新教\n首都：斯韦阿兰", "country tooltips must show primary culture, religion, and capital location");

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
