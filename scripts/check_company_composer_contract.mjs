import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const runtime = read("site/app/runtime.js");
const index = read("site/index.html");
const ui = read("site/app/ui.js");
const boards = read("site/app/boards.js");
const sources = read("scripts/site_frontend_sources.mjs");
const zhUi = read("site/locales/ui.zh-Hans.js");
const enUi = read("site/locales/ui.en.js");
const styles = read("site/styles.css");
const composer = read("site/app/company-composer.js");
const localeManifest = read("site/locales/manifest.js");

assert.match(runtime, /companyComposer:\s*\{[\s\S]*selectedCompanyKeys:\s*\[\][\s\S]*selectedExtensions:\s*\{\}/, "composer state must remain separate from solver state");
assert.match(index, /id=["']companySolverEntry["']/);
assert.match(index, /id=["']companyComposerEntry["']/);
assert.match(index, /app\/company-composer-core\.js\?v=20260819-company-overlap1/);
assert.match(index, /app\/company-composer\.js\?v=20260819-company-overlap1/);
assert.match(index, /styles\.css\?v=20260819-company-usage-collapse1/);
assert.match(index, /locales\/manifest\.js\?v=20260819-company-overlap1/);
assert.match(localeManifest, /locales\/ui\.zh-Hans\.js\?v=20260819-company-overlap1/);
assert.match(localeManifest, /locales\/ui\.en\.js\?v=20260819-company-overlap1/);
assert.match(sources, /app\/company-composer-core\.js/);
assert.match(sources, /app\/company-composer\.js/);
assert.match(composer, /companies\.length > 0 && \(Boolean\(standaloneSiteConfig\) \|\| loadedDataVersion === "1\.13\.11"\)/, "composer must support base 1.13.11 and standalone VC data");
assert.match(ui, /parts\[0\] === ["']company["'] && parts\[1\] === ["']composer["']/);
assert.match(ui, /dataset\.companyComposer/);
assert.match(ui, /parts\[1\] === ["']composer["']/);
assert.match(read("site/app/data.js"), /parts\[0\] === "company" && \["solver", "composer"\]\.includes\(parts\[1\]\)[\s\S]*chunkKeys\.push\("building", "goods"\)/, "company composer must load building and goods data");
assert.match(boards, /state\.detailKind === ["']companyComposer["']/);
assert.match(boards, /data-company-composer-entry/);
assert.match(boards, /renderCompanyComposerBoard\(\)/);
for (const source of [zhUi, enUi]) {
  for (const key of ["entry", "description", "selectedCompanies", "summary", "optionalExtensions", "restrictions", "prosperity", "coveredBy", "empty"]) {
    assert.match(source, new RegExp(`board\\.company\\.composer\\.${key}`));
  }
}
assert.match(composer, /matchesCompanyComposerFilters/);
assert.match(composer, /data-company-composer-extension/);
assert.match(composer, /buildingSources/);
assert.match(composer, /company-composer-building-overlap/);
assert.match(composer, /company-composer-building-coverage/);
assert.match(composer, /async function setCompanyComposerView\(\)[\s\S]*replaceHash\("\/company\/composer"\);[\s\S]*await ensureDataChunksForRoute\(\);/, "composer entry must load its building and goods chunks before rendering");
assert.match(read("site/app/filters.js"), /state\.view === ["']company["'][\s\S]*building_gold_field[\s\S]*subsistence_buildings/);
assert.match(read("site/styles/shell.css"), /data-company-composer/);
assert.match(read("site/styles/records.css"), /\.company-composer-wall/);
assert.match(read("site/styles/records.css"), /\.company-composer-building-overlap/);
assert.match(index, /app\/company-composer-core\.js\?v=20260819-company-overlap1/);
assert.match(index, /app\/company-composer\.js\?v=20260819-company-overlap1/);
assert.match(styles, /styles\/records\.css\?v=20260819-company-usage-collapse1/);
assert.match(index, /app\/filters\.js\?v=20260818-company-filter-exclusions1/);
const groups = read("site/app/runtime.js").match(/const\s+companySolverBuildingGroups\s*=([\s\S]*?)const\s+companySolverBuildingByKey/)[1];
for (const key of ["building_gold_mine", "building_oil_rig", "building_art_academy"]) assert.match(groups, new RegExp(key));
assert.doesNotMatch(groups, /building_gold_field/);

console.log("company composer contract checks passed");
