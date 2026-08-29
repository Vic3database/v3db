import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const siteRoot = path.resolve(process.env.VICTORIAN_CENTURY_SITE_ROOT || path.join(root, "Victorian Century Database"));
const publishedRoot = path.resolve(process.env.VICTORIAN_CENTURY_PUBLISHED_ROOT || path.join(root, "site", "vc"));
const htmlFile = path.join(siteRoot, "index.html");
const configFile = path.join(siteRoot, "victorian-century-config.js");
const dataIndexFile = path.join(siteRoot, "data-index.js");
const mapFile = path.join(siteRoot, "map-data.js");
const updateScriptFile = path.join(root, "scripts", "check_victorian_century_update.mjs");
const expectedChunks = ["country", "culture", "region", "company", "ideology", "law", "technology", "achievement", "building", "goods", "needs", "content"];
const expectedModules = [
  "app/runtime.js",
  "app/i18n.js",
  "app/data.js",
  "app/ui.js",
  "app/company-location-rules.js",
  "app/company-solver-core-fallback.js",
  "app/company-solver-async-fallback.js",
  "app/company-solver.js",
  "app/company-composer-core.js",
  "app/company-composer.js",
  "app/boards.js",
  "app/filters.js",
  "app/presentation.js",
  "app/map.js",
  "app/tag-tooltip-definitions.js",
  "app/components.js",
  "app/achievements.js",
  "app/content-dynamic-text.js",
  "app/content-country-links.js",
  "app/events.js",
  "app/journals.js",
  "app/decisions.js",
  "app/needs.js",
  "app/economy.js",
  "app/bootstrap.js",
];
const expectedCompanyToolFiles = [
  "app/company-solver-core.mjs",
  "app/company-solver-core-fallback.js",
  "app/company-solver-async-fallback.js",
  "app/company-solver-worker.js",
  "app/company-solver.js",
  "app/company-composer-core.js",
  "app/company-composer.js",
  "styles.css",
  "styles/records.css",
  "styles/shell.css",
];

assert(fs.existsSync(htmlFile), "missing Victorian Century index.html");
assert(fs.existsSync(configFile), "missing Victorian Century standalone configuration");
assert(fs.existsSync(dataIndexFile), "missing Victorian Century data index");
assert(fs.existsSync(mapFile), "missing Victorian Century map index");
assert(fs.existsSync(path.join(siteRoot, "assets", "map", "flatmap__2.png")), "missing VC game paper map");
assert(fs.existsSync(path.join(siteRoot, "assets", "production-methods", "united_fruit_banana.webp")), "missing VC production-method asset");
assert(fs.existsSync(path.join(siteRoot, "assets", "prestige-goods", "prestige_good_benz_car.webp")), "missing VC prestige-good asset");
assert(!fs.existsSync(path.join(siteRoot, "data.js")), "VC site must not retain the removed compatibility data bundle");
for (const relative of ["index.html", "data-index.js", "map-data.js", "victorian-century-config.js", "vc-theme.css", "assets/map/provinces.png", "assets/map/flatmap__2.png"]) {
  const standaloneFile = path.join(siteRoot, relative);
  const publishedFile = path.join(publishedRoot, relative);
  assert(fs.existsSync(publishedFile), `missing published VC file: site/vc/${relative}`);
  assert.equal(
    fs.readFileSync(publishedFile).equals(fs.readFileSync(standaloneFile)),
    true,
    `published VC file differs from standalone build: ${relative}`,
  );
}

const html = fs.readFileSync(htmlFile, "utf8");
const publishedHtml = fs.readFileSync(path.join(publishedRoot, "index.html"), "utf8");
const standaloneFilters = fs.readFileSync(path.join(siteRoot, "app", "filters.js"), "utf8");
const publishedFilters = fs.readFileSync(path.join(publishedRoot, "app", "filters.js"), "utf8");
assert.match(html, /<title>Victorian Century Database<\/title>/, "page title must identify Victorian Century");
assert.match(html, /href="vc-theme\.css\?v=20260807-wine-plum-evergreen4"/, "standalone page must load the solid cool-olive theme after base styles");
assert.match(html, /src="victorian-century-config\.js/, "page must load the standalone configuration");
assert.match(publishedHtml, /src="victorian-century-config\.js/, "published VC page must load the standalone configuration");
assert.doesNotMatch(html, /id="versionSelect"/, "standalone page must not render a version selector");
assert.match(html, /id="standaloneLibrarySelect"/, "standalone page must offer a library return selector");
assert.match(html, /<option value="victorian-century" data-i18n="library\.victorianCentury" selected>Victorian Century<\/option>/, "standalone selector must identify the current VC library");
assert.match(html, /<option value="vic3" data-i18n="library\.vic3">Victoria 3 原版 1\.13\.11<\/option>/, "standalone selector must offer the main library");
assert.doesNotMatch(html, /versionGroupSelect|announcement-data\.js|news-data\.js|changelogLink|changelog\.html/, "standalone page must not load version, announcement, news, or changelog features");
assert.doesNotMatch(html, /src="data\.js/, "module front end must not load the compatibility data bundle");
assert.doesNotMatch(html, /id="vcHomeEntry"/, "standalone site must not link to itself");
assert.doesNotMatch(html, /data-nav-view="content"|app\/content\.js/, "standalone site must omit the legacy content board");
assert(!fs.existsSync(path.join(siteRoot, "app", "content.js")), "standalone site must remove the legacy content renderer");
assert.match(html, /app\/filters\.js\?v=20260818-company-filter-exclusions1/, "standalone VC page must load the company-filter exclusion release");
assert.match(publishedHtml, /app\/filters\.js\?v=20260818-company-filter-exclusions1/, "published VC page must load the company-filter exclusion release");
assert.match(html, /styles\.css\?v=20260828-calculator-overflow1/);
assert.match(publishedHtml, /styles\.css\?v=20260828-calculator-overflow1/);
assert.match(html, /app\/company-solver\.js\?v=20260828-tool-panel-title1/, "standalone VC page must load the solver title update");
assert.match(html, /app\/company-composer-core\.js\?v=20260819-company-overlap1/, "standalone VC page must load the duplicate-coverage composer core release");
assert.match(html, /app\/company-composer\.js\?v=20260819-company-overlap1/, "standalone VC page must load the duplicate-coverage composer release");
assert.match(publishedHtml, /app\/company-solver\.js\?v=20260828-tool-panel-title1/, "published VC page must load the solver title update");
assert.match(publishedHtml, /app\/company-composer-core\.js\?v=20260819-company-overlap1/, "published VC page must load the duplicate-coverage composer core release");
assert.match(publishedHtml, /app\/company-composer\.js\?v=20260819-company-overlap1/, "published VC page must load the duplicate-coverage composer release");
assert.equal(publishedFilters, standaloneFilters, "published VC filters must match the standalone build");
assert.match(standaloneFilters, /new Set\(\["building_gold_field", "subsistence_buildings"\]\)/, "VC company filters must hide gold fields and subsistence buildings");
for (const modulePath of expectedModules) {
  assert.match(html, new RegExp(`src="${escapeRegex(modulePath)}`), `page must load ${modulePath}`);
}
for (const relative of expectedCompanyToolFiles) {
  const sourceFile = path.join(root, "site", relative);
  const standaloneFile = path.join(siteRoot, relative);
  const publishedFile = path.join(publishedRoot, relative);
  assert(fs.existsSync(standaloneFile), `missing standalone VC company tool: ${relative}`);
  assert(fs.existsSync(publishedFile), `missing published VC company tool: ${relative}`);
  assert.equal(fs.readFileSync(standaloneFile).equals(fs.readFileSync(sourceFile)), true, `standalone VC company tool differs from source: ${relative}`);
  assert.equal(fs.readFileSync(publishedFile).equals(fs.readFileSync(standaloneFile)), true, `published VC company tool differs from standalone: ${relative}`);
}
for (const relative of ["app/needs.js", "styles/needs.css", "app/content-country-links.js", "styles/content-associations.css", "data-needs.js", "locale-needs.zh-Hans.js", "locale-needs.en.js"]) {
  const standaloneFile = path.join(siteRoot, relative);
  const publishedFile = path.join(publishedRoot, relative);
  assert(fs.existsSync(standaloneFile), `missing standalone VC needs file: ${relative}`);
  assert(fs.existsSync(publishedFile), `missing published VC needs file: ${relative}`);
  assert.equal(fs.readFileSync(publishedFile).equals(fs.readFileSync(standaloneFile)), true, `published VC needs file differs from standalone build: ${relative}`);
}

const config = readGlobal(configFile, "VICTORIAN_CENTURY_SITE_CONFIG");
assert.equal(config?.siteTitle, "Victorian Century Database", "standalone configuration must set the site title");
assert.equal(config?.dataIndex, "data-index.js", "standalone configuration must use the local data index");
assert.match(config?.mapData || "", /^map-data\.js(?:\?v=[a-z0-9-]+)?$/, "standalone configuration must use the versioned local map index");
assert.equal(config?.dataRoot, ".", "standalone configuration must load chunks from the local directory");
assert.equal(config?.localeRoot, "locales", "standalone configuration must load UI locale files from its local locale directory");
assert.equal(config?.webpAssetPaths?.length, 18, "standalone configuration must enumerate every VC display WebP");
assert(config.webpAssetPaths.includes("assets/companies/benz_cie.png"), "standalone configuration must prefer the VC company WebP when available");

const dataIndex = readGlobal(dataIndexFile, "VIC3_DATA_INDEX");
assert.equal(dataIndex?.meta?.dataset_name, "Victorian Century", "data index must retain the VC dataset name");
assert.equal(dataIndex?.meta?.victoria3_version, "1.13.11", "data index must retain the VC game version");
for (const key of expectedChunks) {
  const chunk = dataIndex?.chunks?.[key];
  assert(chunk, `missing ${key} data chunk`);
  assert(Array.isArray(chunk.files) && chunk.files.length, `missing ${key} chunk files`);
  for (const file of chunk.files) {
    assert(fs.existsSync(path.join(siteRoot, file)), `missing ${key} chunk file ${file}`);
  }
}
const needsChunk = readGlobal(path.join(siteRoot, dataIndex.chunks.needs.files[0]), "VIC3_DATA_CHUNK");
assert.equal(needsChunk?.needsData?.current?.needs?.length, 15, "VC needs chunk must contain the 15 current needs");
assert.equal(needsChunk?.needsData?.baseline?.needs?.length, 15, "VC needs chunk must contain the base-game comparison baseline");
assert.equal(dataIndex?.locales?.search_index?.path, "search-index.js", "VC data index must expose its bilingual search index");
assert(fs.existsSync(path.join(siteRoot, dataIndex.locales.search_index.path)), "missing VC bilingual search index");
const searchIndex = readGlobal(path.join(siteRoot, dataIndex.locales.search_index.path), "VIC3_SEARCH_INDEX");
const vcTechnology = searchIndex?.entries?.find((entry) => entry.kind === "technology" && entry.key === "united_fruit_banana_tech");
assert(vcTechnology, "missing VC-added technology in the bilingual search index");
assert.equal(vcTechnology.names?.["zh-Hans"], "垂直整合种植园", "VC-added technology must retain its Chinese name");
assert.equal(vcTechnology.names?.en, "Vertically Integrated Plantations", "VC-added technology must retain its English name");
assert.notEqual(vcTechnology.names.en, vcTechnology.names["zh-Hans"], "VC English localization must not be filled with Chinese text");
const boyarFlavors = searchIndex?.entries?.filter((entry) => entry.kind === "interestGroupFlavor" && entry.names?.["zh-Hans"] === "波雅尔") || [];
assert.equal(boyarFlavors.length, 1, "VC search index must consolidate Boyars into one flavor page result");
assert.equal(boyarFlavors[0]?.interestGroupKey, "ig_landowners", "VC Boyars search result must retain the Landowners parent group");
assert.equal(boyarFlavors[0]?.countryTags?.sort().join(","), "MOL,ROM,WAL", "VC Boyars search result must retain links to every applicable country");
for (const locale of ["zh-Hans", "en"]) {
  for (const key of expectedChunks) {
    const localeChunk = dataIndex?.locales?.chunks?.[locale]?.[key];
    if (key === "content") continue;
    assert(localeChunk, `missing ${locale} ${key} locale chunk`);
    assert(Array.isArray(localeChunk.files) && localeChunk.files.length, `missing ${locale} ${key} locale files`);
    for (const entry of localeChunk.files) {
      assert(fs.existsSync(path.join(siteRoot, entry.path)), `missing ${locale} ${key} locale file ${entry.path}`);
    }
  }
}
for (const relative of ["locales/manifest.js", "locales/ui.zh-Hans.js", "locales/ui.en.js"]) {
  assert(fs.existsSync(path.join(siteRoot, relative)), `missing VC interface locale file ${relative}`);
}
for (const relative of ["data-content.js"]) {
  const standaloneFile = path.join(siteRoot, relative);
  const publishedFile = path.join(publishedRoot, relative);
  assert(fs.existsSync(standaloneFile), `missing standalone VC content file: ${relative}`);
  assert(fs.existsSync(publishedFile), `missing published VC content file: ${relative}`);
  assert.equal(fs.readFileSync(publishedFile).equals(fs.readFileSync(standaloneFile)), true, `published VC content file differs from standalone build: ${relative}`);
}
const contentChunk = readGlobal(path.join(siteRoot, "data-content.js"), "VIC3_DATA_CHUNK");
assert.equal(contentChunk?.journalEntries?.length, 858, "VC content chunk must contain merged journal entries");
assert.equal(contentChunk?.contentEvents?.length, 2947, "VC content chunk must contain merged events");
assert.equal(contentChunk?.decisions?.length, 102, "VC content chunk must contain merged decisions");
assert(contentChunk?.contentEvents?.some((event) => event.sources?.includes("vc")), "VC content chunk must expose VC event provenance");
assert.equal(Object.keys(contentChunk?.contentByCountry || {}).length, 94, "VC content chunk must expose the country reverse index");
assert((contentChunk?.contentByCountry?.GBR?.events || []).length > 0, "VC content chunk must link Britain to flavor events");

const mapData = readGlobal(mapFile, "VIC3_MAP_DATA");
assert.equal(mapData?.width, 8192, "VC map width must be 8192");
assert.equal(mapData?.height, 3616, "VC map height must be 3616");

const runtime = fs.readFileSync(path.join(siteRoot, "app", "runtime.js"), "utf8");
const dataLoader = fs.readFileSync(path.join(siteRoot, "app", "data.js"), "utf8");
const components = fs.readFileSync(path.join(siteRoot, "app", "components.js"), "utf8");
const boards = fs.readFileSync(path.join(siteRoot, "app", "boards.js"), "utf8");
const englishUi = fs.readFileSync(path.join(siteRoot, "locales", "ui.en.js"), "utf8");
const economy = fs.readFileSync(path.join(siteRoot, "app", "economy.js"), "utf8");
assert.match(runtime, /VICTORIAN_CENTURY_SITE_CONFIG/, "runtime must read the VC standalone configuration");
assert.match(runtime, /standaloneLibrarySelect/, "runtime must expose the standalone library selector");
assert.match(dataLoader, /standaloneSiteConfig/, "data loader must use the VC standalone configuration from runtime");
assert.match(dataLoader, /dataRoot/, "data loader must resolve standalone chunk paths from the configuration");
assert.match(dataLoader, /if \(!standaloneSiteConfig\) return `versions\/\$\{loadedDataVersion\}\/\$\{file\}`/, "main-site fallback must keep versioned chunk paths separate from VC mode");
assert.match(dataLoader, /return !dataRoot \|\| dataRoot === "\." \? file : `\$\{dataRoot\}\/\$\{file\}`/, "VC mode must load chunks from its local data root");
const ui = fs.readFileSync(path.join(siteRoot, "app", "ui.js"), "utf8");
assert.match(ui, /els\.standaloneLibrarySelect\?\.addEventListener\("change"/, "standalone selector must navigate back to the main library");
assert.match(ui, /url\.searchParams\.set\("lang", localeRuntime\.current\)/, "library navigation must preserve the active locale");
assert.match(components, /function webpPreferredImageHtml/, "component renderer must support WebP with PNG fallback");
assert.match(components, /webpPreferredImageHtml\(\{[^}]*path[^}]*\}\)/, "company, law, and ideology renderers must use the WebP-aware image helper");
const ideologySummary = boards.match(/function interestGroupIdeologySummaryHtml\([\s\S]*?\n\}/)?.[0] || "";
assert.match(ideologySummary, /ideologyPills\(ideologies, "tag-ideology"\)/, "VC interest-group detail must retain interest-group ideology pills");
assert.match(ideologySummary, /ideologyPills\(group\.character_ideologies, "tag-tradition"\)/, "VC interest-group detail must retain character ideology pills");
assert.doesNotMatch(ideologySummary, /groupIdeologies|characterIdeologiesShort/, "VC ideology labels must not be duplicated outside the shared pill renderer");
assert.match(englishUi, /"enum\.ideologyType\.interestGroup": "Interest Group"/, "VC English interface must label interest-group ideologies in English");
assert.match(englishUi, /"enum\.ideologyType\.character": "Character"/, "VC English interface must label character ideologies in English");
assert.match(englishUi, /"entity\.interestGroupFlavor": "Interest Group Flavor"/, "VC English interface must label interest-group flavor search results");
const companyIconPathSource = components.match(/function companyIconPath\(icon\) \{[\s\S]*?\n\}/)?.[0];
assert(companyIconPathSource, "missing companyIconPath implementation");
const companyIconPath = vm.runInNewContext(`(${companyIconPathSource})`, {
  fileBaseName: (icon) => path.basename(String(icon || "")),
});
assert.equal(companyIconPath("gfx/interface/icons/joi_icons/benz_cie.png"), "assets/companies/benz_cie.png", "VC company PNG icons must resolve to page assets");
assert.equal(companyIconPath("gfx/interface/icons/company_icons/sample.dds"), "assets/companies/sample.png", "base-game company DDS icons must resolve to page PNG assets");
assert.match(economy, /economyChangeFiltersHtml/, "VC site must retain the economy change filters");
assert.match(economy, /victorianCenturyBadge/, "VC site must retain economy change badges");

const updateScript = fs.readFileSync(updateScriptFile, "utf8");
assert.match(updateScript, /build_victorian_century_site\.mjs/, "VC update workflow must rebuild the standalone front end");
assert.match(updateScript, /--baseline-database/, "VC update workflow must compare the mod data with the base-game database");
assert.match(updateScript, /--target/, "VC update workflow must pass its standalone directory to the front-end build");
assert.match(updateScript, /if \(!skipMap\) \{[\s\S]*?build_map_data\.ps1/, "--skip-map must leave map generation outside the update path");
assert.match(updateScript, /map_rebuilt: !skipMap/, "--skip-map must record that the map was not rebuilt");
assert.doesNotMatch(updateScript, /--legacy-data/, "VC update workflow must not rebuild the removed compatibility data bundle");

console.log(JSON.stringify({
  victorian_century_standalone_site: "ok",
  chunks: expectedChunks,
  locales: ["zh-Hans", "en"],
  modules: expectedModules.length,
}, null, 2));

function readGlobal(file, globalName) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window[globalName];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
