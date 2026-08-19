import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { readChunkedSiteData } from "./site_data_reader.mjs";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const indexSource = readText("site/index.html");
const appSource = readSiteAppSource(root);
const styleSource = readSiteStyleSource(root);
const siteData = readChunkedSiteData(root, "site/versions/1.13.11");
const searchIndex = readSearchIndex();
const zhUiSource = readText("site/locales/ui.zh-Hans.js");
const enUiSource = readText("site/locales/ui.en.js");

assert.doesNotMatch(indexSource, /全站搜索/, "the search interface should use 全局搜索 consistently");
assert.match(indexSource, /全局搜索/, "the search interface should expose 全局搜索");
assert.match(appSource, /function\s+globalSearchDisplayTitle\s*\(/, "search results should calculate a display title for alias matches");
assert.match(functionSource("globalSearchDisplayTitle"), /if \(localeRuntime\.current === "zh-Hans"\) return title;/, "Chinese search results should keep aliases searchable without appending English aliases to the visible title");
assert.match(functionSource("globalSearchResults"), /window\.VIC3_SEARCH_INDEX/, "global search should use the generated bilingual index");
assert.match(functionSource("globalSearchResults"), /entry\.names\?\.\[localeRuntime\.current\]/, "result titles should follow the active locale");
assert.match(functionSource("globalSearchResults"), /Object\.values\(entry\.names/, "search matching should include every indexed locale");
assert.match(functionSource("globalSearchResults"), /entry\.aliases/, "search matching should include official entity aliases");
assert.match(functionSource("globalSearchResults"), /entry\.internalAliases/, "search matching should include hidden compatibility aliases");
assert.match(functionSource("globalSearchDisplayTitle"), /if \(result\.matchedAlias\) return result\.matchedAlias;[\s\S]*if \(localeRuntime\.current === "zh-Hans"\) return title;/, "an official alias match should be displayed before the active-locale fallback");
assert.match(functionSource("globalSearchResults"), /entry\.interestGroupKey, \.\.\.\(entry\.countryTags \|\| \[\]\)/, "interest-group flavors should use their aggregated parent and country contexts while rendering search results");
assert.match(functionSource("navigateGlobalSearchResult"), /interestGroupFlavorRoute\(/, "flavor search results should navigate to their dedicated interest-group flavor page");
assert.match(functionSource("renderGlobalSearchList"), /globalSearchResultIdentifier\(result\)/, "main global-search rows should use the result identifier presentation rule");
assert.match(functionSource("renderGlobalSearchDialogResults"), /globalSearchResultIdentifier\(result\)/, "dialog rows should use the result identifier presentation rule");
assert.match(functionSource("globalSearchResultIdentifier"), /\["journal", "event", "decision"\]/, "content IDs should remain visible while unrelated internal keys stay hidden");
assert.match(styleSource, /\.global-search-dialog\s*\{[\s\S]*width:\s*min\(1080px,\s*calc\(100vw - 36px\)\)[\s\S]*max-height:\s*min\(84vh,\s*calc\(100vh - 48px\)\)/, "global search dialog should use the expanded desktop frame without exceeding the viewport");
assert.match(styleSource, /\.global-search-backdrop\s*\{[\s\S]*z-index:\s*110/, "global search backdrop should cover the sticky top bar on narrow viewports");
assert.match(styleSource, /\.global-search-dialog\s*\{[\s\S]*width:\s*min\(1080px,\s*calc\(100vw - 36px\)\)[\s\S]*max-width:\s*calc\(100vw - 36px\)[\s\S]*min-width:\s*0/, "global search dialog should stay within a narrow viewport");
assert.match(styleSource, /\.global-search-dialog-results\s*\{[\s\S]*min-width:\s*0[\s\S]*overflow-x:\s*hidden/, "global search results should not create horizontal overflow on a narrow viewport");
assert.match(styleSource, /\.global-search-dialog-results\s+\.global-result-row--with-icon\s*\{[\s\S]*grid-template-columns:\s*64px\s+minmax\(0,\s*1fr\)[\s\S]*min-height:\s*64px/, "image-bearing search results should reserve a compact 64-pixel icon column");
assert.match(styleSource, /\.global-search-dialog-results\s+\.global-result-row--with-icon\s*\{[\s\S]*height:\s*64px/, "image-bearing search results should keep a fixed compact row height");
assert.match(styleSource, /\.global-search-dialog-results\s+\.global-search-result-content\s*\{[\s\S]*grid-column:\s*2[\s\S]*align-self:\s*center/, "image-bearing search rows should keep title and subtitle in one aligned content column");
assert.match(styleSource, /\.global-search-dialog-results\s+\.global-result-row--compact\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)[\s\S]*min-height:\s*36px[\s\S]*align-items:\s*center/, "text-only search results should remain compact while reserving a full readable line height");
assert.match(styleSource, /\.global-search-dialog-results\s+\.global-result-row--compact\s*>\s*\.country-heading[\s\S]*grid-column:\s*1/, "compact text-only results should reset the homepage badge-column placement");
assert.match(styleSource, /\.global-search-dialog-results\s+\.entity-badge\.entity-badge-flag\s*\{[\s\S]*object-fit:\s*cover/, "search result flags should fill a consistent flag frame");
assert.match(styleSource, /\.global-search-dialog-results\s+\.entity-badge\.entity-badge-company\s*\{[\s\S]*object-position:\s*center/, "company emblems should be centered inside their search result frame");
for (const kind of ["building", "goods", "prestigeGood", "productionMethodGroup", "productionMethod"]) {
  assert.ok(searchIndex.entries.some((entry) => entry.kind === kind), `${kind} records should be included in the global search index`);
}
assert.ok(searchIndex.entries.some((entry) => entry.kind === "interestGroupFlavor"), "interest-group flavor variants should be included in the global search index");
const boyarEntries = searchIndex.entries.filter((entry) => entry.kind === "interestGroupFlavor" && entry.names?.["zh-Hans"] === "波雅尔");
assert.equal(boyarEntries.length, 1, "one named flavor should produce one global-search entry rather than one row per country");
assert.equal(boyarEntries[0]?.interestGroupKey, "ig_landowners", "Boyars should retain its Landowners parent group");
assert.equal(boyarEntries[0]?.countryTags?.sort().join(","), "MOL,ROM,WAL", "aggregated Boyars search entries should retain links to every applicable country");
assert.equal(boyarEntries[0]?.names?.en, "Boyars", "interest-group flavor search entries should include English names");
assert.match(zhUiSource, /"entity\.interestGroupFlavor": "利益集团风味"/, "Chinese search results should label interest-group flavor entries");
assert.match(enUiSource, /"entity\.interestGroupFlavor": "Interest Group Flavor"/, "English search results should label interest-group flavor entries");
for (const kind of ["achievement", "technology", "law", "building", "goods", "prestigeGood", "productionMethodGroup", "productionMethod"]) {
  assert.match(functionSource("renderEntityBadge"), new RegExp(`kind === "${kind}"`), `${kind} search results should render their available icon`);
}
assert.match(readText("scripts/build_economy_assets.mjs"), /\["production_method_groups", "production-methods"\]/, "production method group icons should be published alongside production method icons");
assert.match(functionSource("economyEntityIconHtml"), /if \(!iconPath\) return "";/, "economy results without a source icon should use compact text rows instead of requesting a fabricated asset path");
for (const kind of ["building", "goods", "prestigeGood", "productionMethodGroup", "productionMethod"]) {
  assert.match(functionSource("searchResultEntity"), new RegExp(`kind === "${kind}"`), `${kind} should resolve to its loaded entity before result rendering`);
}
assert.match(functionSource("navigateGlobalSearchResult"), /kind === "building"/, "building results should open their board detail");
assert.match(functionSource("navigateGlobalSearchResult"), /kind === "goods"/, "goods results should open their board detail");
const prussia = searchIndex.entries.find((entry) => entry.kind === "country" && entry.key === "PRU");
assert.ok(prussia, "PRU should be present in the search index");
assert.equal(prussia.names?.["zh-Hans"], "普鲁士");
assert.equal(prussia.names?.en, "Prussia");
for (const query of ["普鲁士", "Prussia", "PRU"]) {
  assert.ok(indexMatches(query).some((entry) => entry.id === prussia.id), `${query} should resolve to PRU`);
}
const qing = searchIndex.entries.find((entry) => entry.kind === "country" && entry.key === "CHI");
const chiangMai = searchIndex.entries.find((entry) => entry.kind === "country" && entry.key === "CMI");
assert.ok(qing, "CHI should be present in the search index");
assert.ok(chiangMai, "CMI should be present in the search index");
assert.ok(qing.aliases?.["zh-Hans"]?.includes("大清"), "CHI should retain its official Great Qing dynamic name as a Chinese alias");
const qingCharacterMatches = indexMatches("清");
assert.ok(qingCharacterMatches.some((entry) => entry.id === qing.id), "清 should resolve to CHI through 大清");
assert.ok(qingCharacterMatches.some((entry) => entry.id === chiangMai.id), "清 should continue to resolve to CMI through 清迈");

console.log(JSON.stringify({
  checked: ["global-search-wording", "bilingual-index", "internal-key-search", "dynamic-country-name-aliases", "localized-result-labels", "new-board-indexing", "icon-presentation", "compact-text-rows"],
  sample: {
    country: `${prussia.key} ${prussia.names["zh-Hans"]} / ${prussia.names.en}`,
  },
}));

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  return appSource.slice(start, appSource.indexOf("\nfunction ", start + 1));
}

function readSearchIndex() {
  const version = siteData.meta?.victoria3_version || "1.13.9";
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(readText(`site/versions/${version}/search-index.js`), sandbox);
  return sandbox.window.VIC3_SEARCH_INDEX;
}

function indexMatches(query) {
  const needle = String(query).trim().toLocaleLowerCase();
  return searchIndex.entries.filter((entry) => (
    [entry.key, ...Object.values(entry.names || {}), ...Object.values(entry.aliases || {}).flat(), ...(entry.internalAliases || [])]
      .join(" ")
      .toLocaleLowerCase()
      .includes(needle)
  ));
}
