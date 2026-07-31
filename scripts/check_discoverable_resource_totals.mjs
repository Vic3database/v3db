import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const componentsSource = read("site/app/components.js");
const mapSource = read("site/app/map.js");
const stateRegions = JSON.parse(read("database/victorian_century/state_regions.json"));
const svealand = stateRegions.find((region) => region.key === "STATE_SVEALAND");

assert.ok(svealand, "fixture data must contain STATE_SVEALAND");

const iron = (svealand.discoverable_resources || []).find((item) => item.key === "building_iron_mine");
assert.ok(iron, "STATE_SVEALAND must contain discoverable iron mines");
assert.equal(iron.discovered_amount, 60, "fixture discovered amount changed");
assert.equal(iron.undiscovered_amount, 88, "fixture undiscovered amount changed");

const expectedTotal = 148;

const valueContext = {};
loadFunction(valueContext, componentsSource, "numericResourceAmount");
loadFunction(valueContext, componentsSource, "discoverableResourceAmount");
loadFunction(valueContext, componentsSource, "stateRegionResourceValue");
const ironValue = valueContext.stateRegionResourceValue(svealand, "building_iron_mine");
assert.equal(ironValue.value, expectedTotal);
assert.equal(ironValue.detail, String(expectedTotal));

const listContext = {
  resourcePill: (_item, amount) => `<pill>${amount}</pill>`,
};
loadFunction(listContext, componentsSource, "numericResourceAmount");
loadFunction(listContext, componentsSource, "discoverableResourceAmount");
loadFunction(listContext, componentsSource, "discoverableResourceList");
assert.equal(
  listContext.discoverableResourceList([iron]),
  `<span class="link-list"><pill>${expectedTotal}</pill></span>`,
);

const tooltipContext = {
  stateRegionTooltipResourceChip: (_item, amount = "") => `<tip>${amount}</tip>`,
};
loadFunction(tooltipContext, componentsSource, "numericResourceAmount");
loadFunction(tooltipContext, componentsSource, "discoverableResourceAmount");
loadFunction(tooltipContext, componentsSource, "stateRegionTooltipResourceHtml");
assert.match(tooltipContext.stateRegionTooltipResourceHtml(svealand), new RegExp(`<tip>${expectedTotal}</tip>`));

const stripContext = {
  buildingChip: (_item, amount = "") => `<chip>${amount}</chip>`,
};
loadFunction(stripContext, componentsSource, "numericResourceAmount");
loadFunction(stripContext, componentsSource, "discoverableResourceAmount");
loadFunction(stripContext, componentsSource, "stateRegionBuildingStrip");
assert.match(stripContext.stateRegionBuildingStrip(svealand), new RegExp(`<chip>${expectedTotal}</chip>`));

const summaryPillContext = {
  resourcePill: (_item, amount = "") => `<pill>${amount}</pill>`,
  limitedHtmlItems: (items) => items.join(""),
};
loadFunction(summaryPillContext, componentsSource, "numericResourceAmount");
loadFunction(summaryPillContext, componentsSource, "discoverableResourceAmount");
loadFunction(summaryPillContext, componentsSource, "resourceSummaryPills");
assert.match(summaryPillContext.resourceSummaryPills(svealand), new RegExp(`<pill>${expectedTotal}</pill>`));

const textContext = {
  summarizeTextItems: (items) => items.join("; "),
};
loadFunction(textContext, componentsSource, "numericResourceAmount");
loadFunction(textContext, componentsSource, "discoverableResourceAmount");
loadFunction(textContext, mapSource, "compactResourceLabel");
loadFunction(textContext, mapSource, "resourceSummaryText");
assert.match(textContext.resourceSummaryText(svealand), new RegExp(`${iron.name_zh} ${expectedTotal}`));

console.log(JSON.stringify({ discoverable_resource_totals: "ok" }));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}

function loadFunction(context, source, name) {
  vm.runInNewContext(`${functionSource(source, name)}; this.${name} = ${name};`, context);
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
