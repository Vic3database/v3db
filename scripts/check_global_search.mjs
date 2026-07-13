import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const indexSource = readText("site/index.html");
const appSource = readText("site/app.js");
const styleSource = readText("site/styles.css");
const todoSource = readText("todolist.md");
const siteData = readSiteData("site/versions/1.13.9/data.js");

assert.doesNotMatch(indexSource, /全站搜索/, "the search interface should use 全局搜索 consistently");
assert.match(indexSource, /全局搜索/, "the search interface should expose 全局搜索");
assert.match(appSource, /function\s+globalSearchDisplayTitle\s*\(/, "search results should calculate a display title for alias matches");
assert.match(appSource, /function\s+interestGroupFlavorSearchResults\s*\(/, "search should index country-specific interest-group flavor names");
assert.match(appSource, /kind === "interestGroupFlavor"/, "search navigation should recognize interest-group flavor results");
assert.match(appSource, /interest-group-flavor-target/, "interest-group flavor cards should expose a focus target");
assert.match(appSource, /focusInterestGroupFlavorResult/, "interest-group flavor navigation should focus the target card");
assert.doesNotMatch(functionSource("renderGlobalSearchDialogResults"), /tag-muted[^\n]*typeLabel|typeLabel[^\n]*tag-muted/, "dialog rows should not repeat the grouped type label");
assert.match(styleSource, /\.global-search-dialog\s*\{[\s\S]*width:\s*min\(1080px,\s*100%\)[\s\S]*max-height:\s*min\(84vh,\s*calc\(100vh - 48px\)\)/, "global search dialog should use the expanded desktop frame");
assert.match(styleSource, /\.global-search-dialog-results\s+\.country-row\s*>\s*\.entity-badge\s*\{[\s\S]*width:\s*100px[\s\S]*height:\s*60px/, "global search result badges should reserve a 100 by 60 icon frame");
assert.match(todoSource, /调整利益集团风味内容/, "todo list should retain the interest-group flavor follow-up");

const newBrunswick = siteData.stateRegions.find((state) => state.key === "STATE_NEW_BRUNSWICK");
const outerManchuria = siteData.stateRegions.find((state) => state.key === "STATE_OUTER_MANCHURIA");
assert.ok(newBrunswick, "STATE_NEW_BRUNSWICK should be present");
assert.ok(outerManchuria, "STATE_OUTER_MANCHURIA should be present");
assert.equal(newBrunswick.name_zh, "滨海");
assert.ok(stateVariantNames(outerManchuria).includes("滨海"), "吉林北部 should retain 滨海 as a flavor name");
assert.ok(stateVariantNames(outerManchuria).includes("沿海州"), "吉林北部 should retain 沿海州 as a flavor name");

const daimyo = siteData.countries.flatMap((country) => (country.interestGroups || []).map((group) => ({ country, group })))
  .find(({ country, group }) => country.tag === "JAP" && group.key === "ig_landowners" && group.display_name?.name_zh === "大名");
assert.ok(daimyo, "Japanese landowners should retain the 大名 flavor name");
assert.equal(daimyo.group.name_zh, "地主");
assert.match(functionSource("interestGroupFlavorSearchResults"), /candidate\.countryTag === "JAP"/, "duplicate 大名 flavor results should prefer Japan");

console.log(JSON.stringify({
  checked: ["global-search-wording", "alias-display", "interest-group-flavor-navigation", "search-layout", "todo"],
  sample: {
    state: `${outerManchuria.key} ${outerManchuria.name_zh}（${stateVariantNames(outerManchuria).join("/")}）`,
    interestGroup: `${daimyo.group.key} ${daimyo.group.display_name.name_zh}（${daimyo.group.name_zh}）`,
  },
}));

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readSiteData(relativePath) {
  const source = readText(relativePath);
  const context = { window: {}, module: { exports: {} } };
  vm.runInNewContext(source, context, { filename: relativePath });
  return context.window.VIC3_DATA || context.module.exports;
}

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  return appSource.slice(start, appSource.indexOf("\nfunction ", start + 1));
}

function stateVariantNames(state) {
  return (state.dynamic_name_variants || [])
    .map((variant) => variant.name_zh || "")
    .filter((name) => name && name !== state.name_zh);
}
