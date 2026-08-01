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
const siteData = readChunkedSiteData(root);
const searchIndex = readSearchIndex();

assert.doesNotMatch(indexSource, /全站搜索/, "the search interface should use 全局搜索 consistently");
assert.match(indexSource, /全局搜索/, "the search interface should expose 全局搜索");
assert.match(appSource, /function\s+globalSearchDisplayTitle\s*\(/, "search results should calculate a display title for alias matches");
assert.match(functionSource("globalSearchResults"), /window\.VIC3_SEARCH_INDEX/, "global search should use the generated bilingual index");
assert.match(functionSource("globalSearchResults"), /entry\.names\?\.\[localeRuntime\.current\]/, "result titles should follow the active locale");
assert.match(functionSource("globalSearchResults"), /Object\.values\(entry\.names/, "search matching should include every indexed locale");
assert.doesNotMatch(functionSource("renderGlobalSearchDialogResults"), /tag-muted[^\n]*typeLabel|typeLabel[^\n]*tag-muted/, "dialog rows should not repeat the grouped type label");
assert.match(styleSource, /\.global-search-dialog\s*\{[\s\S]*width:\s*min\(1080px,\s*100%\)[\s\S]*max-height:\s*min\(84vh,\s*calc\(100vh - 48px\)\)/, "global search dialog should use the expanded desktop frame");
assert.match(styleSource, /\.global-search-dialog-results\s+\.country-row\s*>\s*\.entity-badge\s*\{[\s\S]*width:\s*100px[\s\S]*height:\s*60px/, "global search result badges should reserve a 100 by 60 icon frame");
const prussia = searchIndex.entries.find((entry) => entry.kind === "country" && entry.key === "PRU");
assert.ok(prussia, "PRU should be present in the search index");
assert.equal(prussia.names?.["zh-Hans"], "普鲁士");
assert.equal(prussia.names?.en, "Prussia");
for (const query of ["普鲁士", "Prussia", "PRU"]) {
  assert.ok(indexMatches(query).some((entry) => entry.id === prussia.id), `${query} should resolve to PRU`);
}

console.log(JSON.stringify({
  checked: ["global-search-wording", "bilingual-index", "internal-key", "localized-title", "search-layout"],
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
    [entry.key, ...Object.values(entry.names || {})]
      .join(" ")
      .toLocaleLowerCase()
      .includes(needle)
  ));
}
