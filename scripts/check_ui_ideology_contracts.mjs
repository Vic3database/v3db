import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const appSource = readText("site/app.js");
const indexSource = readText("site/index.html");
const styleSource = readText("site/styles.css");
const siteData = readSiteData("site/data.js");

checkFilterContracts();
checkOverlayContracts();
checkSingleThemeContracts();
checkTypographyContracts();
checkRedesignContracts();
checkIdeologyContracts();

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  checked: [
    "site/app.js",
    "site/index.html",
    "site/styles.css",
    "site/data.js",
  ],
  ui_ideology_contracts: "ok",
}, null, 2));

function checkFilterContracts() {
  assert(!/key:\s*"agriculture_1"/.test(appSource), "agriculture_1 filter group should be merged");
  assert(!/key:\s*"agriculture_2"/.test(appSource), "agriculture_2 filter group should be merged");
  assert(/key:\s*"agriculture"/.test(appSource), "merged agriculture filter group is missing");
  assert(/company-region-filter-section/.test(indexSource), "company region filter sections should have an ordering class");
  assert(/body\[data-view="company"\]\s+\.company-region-filter-section/.test(styleSource), "company region filters should be ordered at the bottom in company view");
  assert(!/<details\b[^>]*class="[^"]*\bfilter-section\b[^"]*"[^>]*\sopen\b/.test(indexSource), "filter sections should not be statically open by default");
  assert(/syncFilterSectionOpenStates/.test(appSource), "filter sections should auto-open when a choice is active");
  assert(/collapsible-detail-section/.test(appSource), "heavy detail sections should render as collapsible detail sections");
  assert(!/setSection\("\.filter-section",\s*false\)/.test(appSource), "filter sections should not be force-collapsed on every render");
  assert(/hasInitializedFilterSections/.test(appSource), "filter section default collapse should be tracked as initial state");
}

function checkOverlayContracts() {
  assert(/function\s+hideTransientOverlays\s*\(/.test(appSource), "hideTransientOverlays helper is missing");
  assert(/function\s+setView\s*\([^)]*\)\s*{[\s\S]*?hideTransientOverlays\s*\(/.test(appSource), "setView should clear transient overlays");
  assert(/hashchange[\s\S]*?hideTransientOverlays\s*\(/.test(appSource), "hash changes should clear transient overlays");
  assert(/function\s+render\s*\([^)]*\)\s*{[\s\S]*?hideTransientOverlays\s*\(/.test(appSource), "render should clear transient overlays before replacing panels");
  assert(/hideMapTooltip\s*\(\s*\)/.test(appSource), "map tooltip cleanup should remain wired");
  assert(/hideConceptTooltip\s*\(\s*\)/.test(appSource), "concept tooltip cleanup should remain wired");
  assert(/\.concept-tooltip\[hidden\]\s*{[\s\S]*?display:\s*none\s*!important/.test(styleSource), "concept tooltip hidden state should override display grid");
  assert(/CONCEPT_TOOLTIP_DELAY_MS/.test(appSource), "concept tooltip hover delay constant is missing");
  assert(/function\s+scheduleConceptTooltip\s*\(/.test(appSource), "concept tooltip should be scheduled before showing");
  assert(/function\s+clearConceptTooltipTimer\s*\(/.test(appSource), "concept tooltip hover timer cleanup is missing");
  assert(!/pointerover[\s\S]{0,240}showConceptTooltip\s*\(/.test(appSource), "pointer hover should not show concept tooltip immediately");
  assert(!/mouseover[\s\S]{0,240}showConceptTooltip\s*\(/.test(appSource), "mouse hover should not show concept tooltip immediately");
}

function checkSingleThemeContracts() {
  assert(/theme:\s*"votp"/.test(appSource), "single VOTP-style theme should be the app default");
  assert(/function\s+initTheme\s*\(\s*\)\s*{[\s\S]*setTheme\("votp",\s*false\)/.test(appSource), "theme initialization should not depend on saved light/dark values");
  assert(!/theme:\s*"light"/.test(appSource), "light theme state should not remain as the default");
  assert(!/savedTheme|localStorage\.getItem\("vicdata-theme"\)/.test(appSource), "single-theme site should not read an old saved light/dark setting");
  assert(!/body\[data-theme="dark"\]/.test(styleSource), "dark theme override selectors should not remain");
  assert(/--bg:\s*#181715/.test(styleSource), "VOTP single theme background token is missing");
  assert(/--surface:\s*#292825/.test(styleSource), "VOTP single theme surface token is missing");
  assert(/--surface-raised:\s*#34312d/.test(styleSource), "VOTP single theme raised surface token is missing");
  assert(/--panel:\s*#1d3040/.test(styleSource), "VOTP single theme deep blue header token is missing");
  assert(/--accent:\s*#c8a45b/.test(styleSource), "VOTP single theme gold selection token is missing");
  assert(/--accent-blue:\s*#243e4e/.test(styleSource), "VOTP single theme blue button token is missing");
  assert(/body\s*{[\s\S]*repeating-linear-gradient/.test(styleSource), "VOTP single theme should include a subtle CSS texture");
  assert(!/--panel-glass(?:-strong)?:\s*rgba\(255,\s*254,\s*249/.test(styleSource), "single theme glass panels should not be redefined as light panels");
  assert(!/rgba\(143,\s*63,\s*50/.test(styleSource), "single theme should not keep the old red-brown accent color");
  assert(!/rgba\(255,\s*254,\s*249,\s*0\.(?:7|72|78|82|88|9|94|96)\)/.test(styleSource), "single theme should not keep light translucent panel backgrounds");
  assert(/\.panel-head\s*{[\s\S]*background:\s*linear-gradient\([^;]*var\(--panel\)/.test(styleSource), "panel headers should use the deep blue token");
  assert(/\.filter-token\[aria-pressed="true"\][\s\S]*border-color:\s*var\(--accent\)/.test(styleSource), "selected filters should use gold borders");
  assert(/\.topbar-icon-button,\s*[\s\S]*\.dialog-close-button,\s*[\s\S]*\.detail-back-button\s*{[\s\S]*background:\s*var\(--accent-blue\)/.test(styleSource), "compact icon buttons should use the blue button token");
  assert(/\.map-toolbar\s*{[\s\S]*background:\s*var\(--panel-glass\)/.test(styleSource), "map toolbar should use the dark glass panel token");
  assert(/#resetButton\s*{[\s\S]*background:\s*var\(--accent-blue\)/.test(styleSource), "reset button should use the blue button token");
}

function checkTypographyContracts() {
  assert(/--font-body:\s*"Source Han Serif SC"/.test(styleSource), "body font stack should start with Source Han Serif SC");
  assert(/--font-ui:\s*var\(--font-body\)/.test(styleSource), "UI font stack should share the Source Han Serif body stack in the all-serif trial");
  assert(/--font-mono:\s*var\(--font-body\)/.test(styleSource), "monospace-style blocks should share the Source Han Serif body stack in the all-serif trial");
  assert(/--text-base:\s*16px/.test(styleSource), "base reading size should be fixed at 16px");
  assert(/--text-sm:\s*14px/.test(styleSource), "small UI size should be fixed at 14px");
  assert(/--text-xs:\s*13px/.test(styleSource), "extra-small UI size should be fixed at 13px");
  assert(/--control-height:\s*36px/.test(styleSource), "standard control height should be fixed at 36px");
  assert(/--chip-height:\s*26px/.test(styleSource), "standard chip height should be fixed at 26px");
  assert(/body\s*{[\s\S]*font-family:\s*var\(--font-body\)[\s\S]*font-size:\s*var\(--text-base\)[\s\S]*line-height:\s*var\(--line-body\)/.test(styleSource), "body text should use the serif stack and fixed base size");
  assert(/h1,\s*h2,\s*h3,\s*p\s*{[\s\S]*font-family:\s*var\(--font-body\)/.test(styleSource), "headings and prose should use the serif stack");
  assert(/button,\s*select,\s*input\s*{[\s\S]*font-family:\s*var\(--font-ui\)/.test(styleSource), "controls should use the shared UI font variable");
  assert(/\.name,\s*[\s\S]*\.country-meta,\s*[\s\S]*\.minor\s*{[\s\S]*font-family:\s*var\(--font-body\)/.test(styleSource), "list names and descriptive text should keep the serif body stack inside button rows");
  assert(/\.filter-token,\s*[\s\S]*\.pill,\s*[\s\S]*\.tag,\s*[\s\S]*\.entity-badge,\s*[\s\S]*#resultCount\s*{[\s\S]*font-family:\s*var\(--font-ui\)/.test(styleSource), "chips, tags, badges, and counts should use the shared UI font variable");
  assert(!/font:\s*12px[^;]*(?:Consolas|Cascadia Mono|monospace)/.test(styleSource), "all-serif trial should not keep hard-coded monospace font shorthands");
  assert(/\.filter-token\s*{[\s\S]*min-height:\s*var\(--chip-height\)/.test(styleSource), "filter chips should use the shared chip height");
  assert(/\.topbar-nav-item\s*{[\s\S]*min-height:\s*var\(--control-height\)/.test(styleSource), "topbar navigation should use the shared control height");
  assert(/\.results\s+\.country-row\s*{[\s\S]*grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\)/.test(styleSource), "result rows should use a compact badge plus content grid");
  assert(/\.results\s+\.country-row\s*>\s*\.country-heading,\s*[\s\S]*\.results\s+\.country-row\s*>\s*\.country-meta,\s*[\s\S]*\.results\s+\.country-row\s*>\s*\.country-tags\s*{[\s\S]*grid-column:\s*2/.test(styleSource), "result rows should keep names, metadata, and chips in the main column");
  assert(/--results-panel-width:\s*clamp\(420px,\s*30vw,\s*570px\)/.test(styleSource), "company/list panel should be widened to roughly one and a half times the previous width");
  assert(/\.results\s+\.company-row\s*{[\s\S]*grid-template-columns:\s*48px\s+minmax\(0,\s*1fr\)[\s\S]*min-height:\s*auto[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible/.test(styleSource), "company rows should use a wider flexible card layout with a larger company icon");
  assert(/\.results\s+\.company-row\s*>\s*\.company-heading-link,\s*[\s\S]*\.results\s+\.company-row\s*>\s*\.region-building-strip,\s*[\s\S]*\.results\s+\.company-row\s*>\s*\.country-meta,\s*[\s\S]*\.results\s+\.company-row\s*>\s*\.country-tags,\s*[\s\S]*\.results\s+\.company-row\s*>\s*\.company-asset-line\s*{[\s\S]*grid-column:\s*1\s*\/\s*3/.test(styleSource), "company row child sections should use the full card width");
  assert(/\.results\s+\.company-row\s+\.company-heading-link\s*{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*48px\s+minmax\(0,\s*1fr\)\s+auto/.test(styleSource), "company row header should combine icon, name, key, and DLC");
  assert(/\.results\s+\.company-row\s+\.company-logo,\s*[\s\S]*\.results\s+\.company-row\s+\.company-icon-placeholder\s*{[\s\S]*width:\s*44px[\s\S]*height:\s*44px/.test(styleSource), "company list icons should span the two title lines");
  assert(/\.results\s+\.company-row\s+\.region-building-strip\s*{[\s\S]*gap:\s*2px/.test(styleSource), "company building icon strip should use tighter spacing");
  assert(/\.results\s+\.company-row\s+\.company-asset-line\s*{[\s\S]*display:\s*flex/.test(styleSource), "company prestige goods should use a compact asset line");
  assert(/\.company-building-separator\s*{[\s\S]*width:\s*6px[\s\S]*height:\s*6px[\s\S]*border-radius:\s*50%/.test(styleSource), "main and extension buildings should be divided by a vector-like dot");
  assert(/\.company-building-pill\.extension-building-pill\s*{[\s\S]*border-color:\s*transparent[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/.test(styleSource), "company extension building icons should not keep the dashed extension pill frame");
  const genericResultCountryGridIndex = styleSource.lastIndexOf(".results .country-row {\n  grid-template-columns: auto minmax(0, 1fr);");
  const companyResultGridIndex = styleSource.lastIndexOf(".results .company-row {\n  grid-template-columns: 48px minmax(0, 1fr);");
  assert(genericResultCountryGridIndex >= 0 && companyResultGridIndex > genericResultCountryGridIndex, "company row grid override should come after the generic result-row country grid");
  assert(/\.results\s+\.country-row,\s*[\s\S]*\.results\s+\.culture-row\s*{[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible/.test(styleSource), "result rows should allow wrapped content after typography changes");
  assert(/\.results\s+\.pill-line\s*{[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible/.test(styleSource), "result row chips should allow wrapping instead of clipping");
  assert(/\.map-tooltip\s*{[\s\S]*width:\s*min\(440px,\s*calc\(100%\s*-\s*18px\)\)[\s\S]*max-height:\s*min\(560px,\s*70vh\)[\s\S]*padding:\s*12px\s+14px/.test(styleSource), "map tooltip should be enlarged for the all-serif scale");
  assert(!/\.map-tooltip\s*{[\s\S]{0,160}width:\s*min\(380px,\s*calc\(100%\s*-\s*18px\)\)/.test(styleSource), "map tooltip should not be narrowed again by later overrides");
  assert(!/\.map-tooltip\s*{[\s\S]{0,180}max-height:\s*min\(520px,\s*62vh\)/.test(styleSource), "map tooltip should not be shortened again by later overrides");
  assert(/\.concept-tooltip\s*{[\s\S]*max-width:\s*300px[\s\S]*padding:\s*10px\s+12px/.test(styleSource), "concept tooltip should be enlarged for the all-serif scale");
  assert(/const\s+tooltipWidth\s*=\s*els\.mapTooltip\.offsetWidth\s*\|\|\s*440/.test(appSource), "map tooltip placement should clamp with the rendered tooltip width");
  assert(/const\s+tooltipHeight\s*=\s*els\.mapTooltip\.offsetHeight\s*\|\|\s*280/.test(appSource), "map tooltip placement should clamp with the rendered tooltip height");
  assert(/\.image-pill:not\(\.extension-building-pill\)\s*{[\s\S]*border-color:\s*transparent[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/.test(styleSource), "PNG-backed image pills should not keep the pill frame");
  assert(/className:\s*"resource-pill image-pill"/.test(appSource), "resource pills should opt into the frameless image-pill style");
  assert(/className:\s*`resource-pill image-pill\$\{classText\}`/.test(appSource), "building pills should opt into the frameless image-pill style");
  assert(/function\s+renderCompanyList\s*\([^)]*\)\s*{[\s\S]*const\s+visible\s*=\s*filtered;/.test(appSource), "company list should render every filtered company, not only the first 220");
  assert(!/if\s*\(count\s*>\s*220\)\s*parts\.push\("列表仅显示前 220 条"\)/.test(appSource), "active hint should not warn about a removed company list limit");
  const companyTagPillSource = functionSource("companyTagPills");
  assert(/referenced_strategic_regions[\s\S]*referenced_geographic_regions[\s\S]*tagPill\(company\.category_zh\s*\|\|\s*company\.category[\s\S]*companyKindKey\(company\)\s*===\s*"easter_egg"[\s\S]*tagPill\(companyKindText\(company\),\s*"tag-special"\)/.test(companyTagPillSource), "company list final tag line should show regions first, then holding category, then easter-egg tags only when needed");
  assert(!/function\s+companyMetaLine[\s\S]{0,260}companyKindText/.test(appSource), "company easter-egg marker should be a final-row tag, not inline metadata text");
  assert(/company-asset-line">\$\{companyPrestigeGoodsPills\(company\)\}<\/span>[\s\S]*company-tag-line">\$\{companyTagPills\(company\)\}/.test(appSource), "company prestige goods should be placed above region and category labels");
  assert(/function\s+companyDlcIconPill\s*\([^)]*\)\s*{[\s\S]*companyDlcKey\(company\)\s*===\s*"base"[\s\S]*return\s+""/.test(appSource), "base Victoria 3 DLC marker should be omitted from company list rows");
  assert(/function\s+companyPrestigeGoodsPills\s*\([^)]*\)\s*{[\s\S]*companyPrestigeGoodPill/.test(appSource), "company rows should render concrete prestige goods through the prestige-good icon pill");
  assert(/function\s+companyPrestigeGoodPill\s*\([^)]*\)\s*{[\s\S]*prestige-good-icon[\s\S]*goodsIconHtml/.test(appSource), "prestige goods should render an icon next to the label");
  assert(fs.existsSync(path.join(root, "site/assets/prestige-goods/generic_grain_prestige.png")), "prestige goods icon assets should be copied into the site");
  assert(/function\s+companyBuildingStrip\s*\([^)]*\)\s*{[\s\S]*company-building-separator[\s\S]*main\.join\(""\)[\s\S]*extension\.join\(""\)/.test(appSource), "company building strip should separate main and extension industries with a dot");
  const companyBuildingPillSource = functionSource("companyBuildingPill");
  assert(/className:\s*`resource-pill image-pill company-building-pill\$\{classText\}`/.test(companyBuildingPillSource) && /html:\s*buildingIconHtml\(item\?\.key,\s*name\)/.test(companyBuildingPillSource), "company building pills should be icon-only and expose labels through the icon tooltip");
  assert(/label:\s*name/.test(companyBuildingPillSource) && /kind:\s*"building"/.test(companyBuildingPillSource) && /key:\s*item\?\.key\s*\|\|\s*""/.test(companyBuildingPillSource), "company building icon-only pills should keep building concept tooltip metadata");
  assert(/data-company-open/.test(appSource) && /openCompanyDetail/.test(appSource), "company detail should open from the company icon/name link, not the whole card");
  assert(/selectCompanyCard/.test(appSource) && /selectionHashForCard\("\/company",\s*`\/company\/\$\{encodeURIComponent\(companyKey\)\}`\)/.test(appSource), "company card click should select the company while staying on the company board");
  assert(/function\s+focusCompanyOnMap/.test(appSource) && /companyStateRegionKeys/.test(appSource), "selecting a company card should focus the map on related state regions");
  assert(/function\s+showConceptTooltip[\s\S]*target\.matches\("a\[href\]"\)[\s\S]*"右键搜索"/.test(appSource), "non-link icon tooltips should not claim that left click opens details");
  for (const [name, view] of [
    ["renderCountryDetail", "country"],
    ["renderCultureDetail", "culture"],
    ["renderStateRegionDetail", "region"],
    ["renderStrategicRegionDetail", "region"],
    ["renderGeographicRegionDetail", "region"],
    ["renderCompanyDetail", "company"],
    ["renderIdeologyDetail", "ideology"],
  ]) {
    assert(functionSource(name).includes(`detailBackButton("${view}")`), `${name} should render the shared detail back button`);
  }
  assert(/function\s+detailBackButton\s*\([^)]*\)\s*{[\s\S]*assets\/lucide\/icons\/arrow-left\.svg/.test(appSource), "detail back button should use the Lucide arrow-left icon");
  assert(/\.detail-back-button\s+\.lucide-icon\s*{[\s\S]*width:\s*16px[\s\S]*height:\s*16px/.test(styleSource), "detail back button icon sizing is missing");
}

function checkRedesignContracts() {
  assert(/class="[^"]*\btopbar-brand\b/.test(indexSource), "topbar brand entry is missing");
  assert(/class="[^"]*\bbrand-logo\b"[^>]*assets\/brand\/vicdata-icon-192\.png/.test(indexSource), "topbar brand should use the Vicdata brand icon");
  assert(/class="[^"]*\btopbar-nav\b/.test(indexSource), "topbar board navigation is missing");
  for (const view of ["country", "culture", "region", "company", "ideology", "changelog"]) {
    assert(new RegExp(`data-nav-view="${view}"`).test(indexSource), `topbar board entry for ${view} is missing`);
  }
  assert(/data-nav-view="changelog"[\s\S]*assets\/lucide\/icons\/notebook-pen\.svg/.test(indexSource), "changelog board should use the Lucide notebook-pen icon");
  assert(/<option value="changelog">/.test(indexSource), "view select should include changelog");
  assert(!/id="changelogLink"/.test(indexSource), "changelog should be a board entry, not a separate topbar link");
  assert(/id="settingsNavButton"/.test(indexSource), "settings rail entry is missing");
  assert(/id="globalSearchButton"/.test(indexSource), "global search icon button is missing");
  assert(/assets\/lucide\/icons\/search\.svg/.test(indexSource), "global search button should use the Lucide search icon");
  assert(/class="[^"]*\blucide-icon\b/.test(indexSource), "fixed UI controls should render Lucide SVG icons");
  assert(/<img\s+class="lucide-icon"/.test(indexSource), "fixed UI icons should render as direct SVG images");
  assert(!/--icon-url/.test(indexSource), "fixed UI icons should not depend on CSS mask URLs");
  assert(!/[⌕⌂⚑◇▣✦☰⚙↔]/.test(indexSource), "fixed UI controls should not use text symbols as icons");
  assert(/id="versionSelect"/.test(indexSource), "single version entry is missing");
  assert(!/id="versionGroupSelect"/.test(indexSource), "version group selector should be removed from the topbar");
  assert(!/id="themeToggle"/.test(indexSource), "theme toggle should be removed from the compact topbar");
  assert(!/id="rightPanelToggle"/.test(indexSource), "detail edge toggle should be removed");
  assert(!/id="mapStatus"/.test(indexSource), "map status text line should be removed from the map toolbar");
  assert(!/id="mapLegend"/.test(indexSource), "map legend strip should be removed from the map shell");
  for (const icon of ["text-search", "layout-list"]) {
    assert(new RegExp(`assets/lucide/icons/${icon}\\.svg`).test(indexSource), `Lucide ${icon} icon should be wired into the map toolbar`);
  }
  assert(/id="leftPanelToggle"[\s\S]*assets\/lucide\/icons\/text-search\.svg/.test(indexSource), "filter toggle should use the text-search icon");
  assert(/id="bottomPanelToggle"[\s\S]*assets\/lucide\/icons\/layout-list\.svg/.test(indexSource), "list toggle should use the layout-list icon");
  assert(!/>筛选<\/button>/.test(indexSource), "filter toggle should not render text");
  assert(!/>列表<\/button>/.test(indexSource), "list toggle should not render text");
  assert(!/>详情<\/button>/.test(indexSource), "detail toggle should not render text");
  assert(!/>深色<\/button>|>浅色<\/button>/.test(indexSource), "theme toggle text should not render in the shell");
  assert(!/els\.mapStatus|els\.mapLegend|function\s+renderMapLegend|function\s+legendItem/.test(appSource), "map status and legend renderers should be removed");
  assert(!/开局世界局势|开局国家（按省份）|松散政权白地/.test(appSource), "removed map status and legend labels should not be rendered");
  assert(!/els\.pageTitle\.textContent/.test(appSource), "page title updates should tolerate the compact topbar shell");
  assert(!/els\.metaLine\.textContent/.test(appSource), "meta line updates should tolerate the compact topbar shell");
  for (const icon of ["earth", "map", "drama", "briefcase-business", "user-star", "notebook-pen", "refresh-ccw", "milestone", "search", "settings", "text-search", "layout-list"]) {
    assert(new RegExp(`assets/lucide/icons/${icon}\\.svg`).test(indexSource), `Lucide ${icon} icon should be wired in the shell`);
  }
  assert(/id="globalSearchDialog"/.test(indexSource), "global search dialog is missing");
  assert(/id="globalSearchDialogInput"/.test(indexSource), "global search dialog input is missing");
  assert(/id="globalSearchLegacyToggle"/.test(indexSource), "global search legacy-version toggle is missing");
  assert(!/id="globalSearchInput"/.test(indexSource), "inline topbar global search input should be removed");
  assert(/value="home"/.test(indexSource), "view select should include home");
  assert(/function\s+renderHomeBoard\s*\(/.test(appSource), "home board renderer is missing");
  assert(/function\s+renderChangelogBoard\s*\(/.test(appSource), "changelog board renderer is missing");
  assert(/parts\[0\]\s*===\s*"changelog"/.test(appSource), "hash routing should handle the changelog board");
  assert(/state\.view\s*!==\s*"home"\s*&&\s*state\.view\s*!==\s*"settings"\s*&&\s*state\.view\s*!==\s*"changelog"/.test(appSource), "changelog board should not render the old detail column");
  assert(/function\s+openGlobalSearchDialog\s*\(/.test(appSource), "global search dialog opener is missing");
  assert(/function\s+closeGlobalSearchDialog\s*\(/.test(appSource), "global search dialog closer is missing");
  assert(/function\s+renderEntityBadge\s*\(/.test(appSource), "entity badge renderer is missing");
  assert(/function\s+renderCountryDetailPage\s*\(/.test(appSource), "country detail page renderer is missing");
  assert(/function\s+isDetailPageRoute\s*\(/.test(appSource), "detail page route helper is missing");
  assert(/classList\.toggle\("detail-page",\s*isDetailPageRoute\(\)\)/.test(appSource), "detail routes should set detail-page body state");
  assert(/function\s+detailBackButton\s*\(/.test(appSource), "detail pages need a back-to-board button");
  assert(/body\.detail-page\s+\.detail-back-button/.test(styleSource), "detail page back button styles are missing");
  assert(/body:not\(\.detail-page\):not\(\[data-view="home"\]\):not\(\[data-view="settings"\]\):not\(\[data-view="changelog"\]\)\s+\.detail/.test(styleSource), "list pages should hide the old detail column");
  assert(/body:not\(\.detail-page\)\s+\.results/.test(styleSource), "list pages should move the list column to the right");
  assert(!/body\.filters-collapsed\s+\.results\s*{[\s\S]*?left:\s*12px/.test(styleSource), "filter collapse should not move the list panel over the map toolbar");
  assert(/countryTypeFilters/.test(indexSource), "merged country type filter container is missing");
  assert(!/whiteDecentralizedToggle/.test(indexSource), "white decentralized toggle should move out of the country filter column");
  assert(!/id="navRailToggleButton"/.test(indexSource), "navigation rail toggle should be removed from the shell");
  assert(/data-nav-view/.test(appSource), "topbar navigation should keep using data-nav-view routing");
  assert(/aria-current/.test(appSource), "topbar navigation should mark the current board");
  assert(!/\.app-rail:hover,\s*[\r\n]+\.app-rail:focus-within\s*{[\s\S]*?width:\s*158px/.test(styleSource), "nav rail should not expand on hover");
  assert(/id="whiteDecentralizedSetting"/.test(appSource), "white decentralized setting is missing");
  assert(/id="omitIndigenousSetting"/.test(appSource), "indigenous language and culture setting is missing");
  assert(/id="omitDecentralizedTagsSetting"/.test(appSource), "decentralized tag setting is missing");
  assert(/omitIndigenousLanguagesCultures/.test(appSource), "indigenous language and culture state is missing");
  assert(/omitDecentralizedTags/.test(appSource), "decentralized tag state is missing");
  assert(/function\s+isIndigenousCulture\s*\(/.test(appSource), "indigenous culture classifier is missing");
  assert(/omitDecentralizedTags\s*&&\s*country\.countryType\s*===\s*"decentralized"/.test(appSource), "decentralized tag filter should use country type, not culture heritage");
  assert(!/omitDecentralizedTags[\s\S]{0,220}isIndigenousCulture/.test(appSource), "decentralized tag filter should not call the indigenous culture classifier");
  for (const tag of ["PRG"]) {
    const country = (siteData.countries || []).find((item) => item.tag === tag);
    assert(country, `${tag} should exist in country data`);
    assert(country?.countryType !== "decentralized", `${tag} should not be treated as a decentralized tag`);
  }
  assert(/:root\s*{[\s\S]*--bg:\s*#181715/.test(styleSource), "single theme background token is missing");
  assert(!/body\.detail-page\s+\.filters\s*,/.test(styleSource), "detail pages should keep the filter column visible");
  assert(/body\.detail-page\s+\.results\s*{[\s\S]*width:\s*var\(--results-panel-width\)/.test(styleSource), "detail pages should keep the list column visible beside details");
  assert(/\.filters\s*{[\s\S]*overflow-y:\s*scroll/.test(styleSource), "filter column should keep a visible vertical scrollbar");
  const mapPanelStyles = styleBlocks(".map-panel");
  assert(mapPanelStyles.some((block) => /top:\s*12px/.test(block) && /left:\s*12px/.test(block)), "map panel should not expose map pixels in the top-left panel gutter");
  assert(/#languageGroupFilters\s+\.filter-group-block\s*\+\s*\.filter-group-block/.test(styleSource), "language groups should be divided by separators");
  assert(/\.global-search-dialog/.test(styleSource), "global search dialog styles are missing");
  assert(/\.entity-badge/.test(styleSource), "entity badge styles are missing");
}

function checkIdeologyContracts() {
  assert(/ideologyUnlockTagsHtml/.test(appSource), "ideology unlock tag renderer is missing");
  assert(/ideologyRuleSourceLabel/.test(appSource), "ideology source label renderer is missing");
  assert(/ideologyReplacementUsageHtml/.test(appSource), "ideology replacement renderer is missing");
  assert(/风味·新增/.test(appSource), "ideology flavor additions should be labeled 风味·新增");
  assert(/风味·移除/.test(appSource), "ideology flavor removals should be labeled 风味·移除");
  assert(/风味·替换/.test(appSource), "added flavor ideologies should be labeled 风味·替换A");
  assert(/风味：替换为/.test(appSource), "removed default ideologies should be labeled 风味：替换为B");
  assert(!/风味·使用/.test(appSource), "removed default ideology label should not use 风味·使用B替换A");
  assert(/ideologyRefPill/.test(appSource), "ideology references should render as ideology tags");
  assert(/ideologyLawGroupTooltip/.test(appSource), "ideology tag tooltip should include related law groups");
  assert(!/ideologyLawGroupOrderValue/.test(appSource), "ideology law group tooltip should use the existing law group order helper");
  assert(!/\[ideology\.key,\s*cleanIdeologyDescription/.test(appSource), "ideology tag title should not include flavor description text");
  assert(/ideologyWeightSectionHtml/.test(appSource), "ideology detail should include a character weight section");
  assert(/角色权重/.test(appSource), "ideology weight section should be labeled 角色权重");
  assert(/sharedIdeologyLawGroupKeys/.test(appSource), "flavor replacement classification should compare ideology law groups");
  assert(/classifyFlavorIdeologyUsage/.test(appSource), "flavor ideology usage classification helper is missing");
  assert(!/\bbyIdeology\b/.test(appSource), "production ideology usage should use the existing ideologyByKey map");
  assert(!/limitedCountryLinks\(related\.(?:addedCountries|removedCountries),\s*32\)/.test(appSource), "ideology country usage lists should not be capped at 32");

  const ideologyByKey = new Map((siteData.ideologies || []).map((ideology) => [ideology.key, ideology]));
  const austrianHegemony = ideologyByKey.get("ideology_austrian_hegemony");
  assert(austrianHegemony, "ideology_austrian_hegemony is missing from site data");
  assert(
    (austrianHegemony?.flavor_definition_status || "") === "unassigned",
    "ideology_austrian_hegemony should be marked as an unassigned flavor definition",
  );
  const abolitionist = ideologyByKey.get("ideology_abolitionist");
  assert(abolitionist, "ideology_abolitionist is missing from site data");
  assert(abolitionist?.character_ideology === true, "ideology_abolitionist should be marked as a character ideology");
  assert(abolitionist?.character_requirements?.country?.summary_zh, "ideology_abolitionist should expose country requirements");
  assert((abolitionist?.interest_group_leader_weight?.entries || []).some((entry) => entry.value === 100 && /base_value/.test(entry.desc || "")), "ideology_abolitionist leader weight should expose base 100");
  assert((abolitionist?.interest_group_leader_weight?.entries || []).some((entry) => entry.value === 100 && entry.interest_groups?.some((item) => item.key === "ig_trade_unions")), "ideology_abolitionist leader weight should link trade unions modifier");
  assert((abolitionist?.non_interest_group_leader_weight?.entries || []).some((entry) => entry.value === 75 && entry.traits?.some((item) => item.key === "trait_tactful")), "ideology_abolitionist non-leader weight should link tactful trait modifier");

  for (const key of [
    "ideology_communist",
    "ideology_anarchist",
    "ideology_vanguardist",
    "ideology_corporatist",
    "ideology_fascist",
    "ideology_technocratic",
    "ideology_patriarchal_suffrage",
  ]) {
    const ideology = ideologyByKey.get(key);
    assert(ideology, `${key} is missing from site data`);
    const unlocks = [
      ...(ideology?.unlock_technologies || []),
      ...(ideology?.unlock_journal_entries || []),
    ];
    assert(unlocks.length > 0, `${key} should have technology or journal unlock tags`);
  }

  const countries = siteData.countries || [];
  const ideologyByKeyForFlavor = new Map((siteData.ideologies || []).map((ideology) => [ideology.key, ideology]));
  const flavorExamples = classifyFlavorExamples(countries, ideologyByKeyForFlavor);
  assert(
    flavorExamples.addedReplacement.some((item) => item.current === "ideology_constitutionalist" && item.other === "ideology_republican"),
    "expected ideology_constitutionalist to replace ideology_republican by shared law group",
  );
  assert(
    flavorExamples.removedReplacement.some((item) => item.current === "ideology_republican" && item.other === "ideology_constitutionalist"),
    "expected ideology_republican to be replaced by ideology_constitutionalist by shared law group",
  );
  assert(
    flavorExamples.addedOnly.some((item) => item.current === "ideology_laissez_faire"),
    "expected ideology_laissez_faire to have a flavor-only addition with no same-law-group removal",
  );
  assert(
    flavorExamples.removedOnly.some((item) => item.current === "ideology_pious"),
    "expected ideology_pious to have a flavor-only removal when no added ideology shares its law group",
  );

  const eastIndiaNames = countries
    .filter((country) => /东印度|East India/i.test([country.name, country.name_zh, country.tag].filter(Boolean).join(" ")))
    .map((country) => country.name || country.name_zh || country.tag);
  assert(eastIndiaNames.some((name) => /英|British/i.test(name)), "British East India label is missing");
  assert(eastIndiaNames.some((name) => /荷|Dutch/i.test(name)), "Dutch East India label is missing");
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}

function styleBlock(selector) {
  return styleBlocks(selector)[0] || "";
}

function styleBlocks(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...styleSource.matchAll(new RegExp(`${escaped}\\s*{([^}]*)}`, "g"))].map((match) => match[1] || "");
}

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}`);
  if (start < 0) return "";
  const bodyStart = appSource.indexOf("{", start);
  if (bodyStart < 0) return "";
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    const char = appSource[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  return appSource.slice(start);
}

function readSiteData(relativePath) {
  const text = readText(relativePath);
  const match = text.match(/window\.VIC3_DATA\s*=\s*(.*?);?\s*$/s);
  if (!match) throw new Error(`${relativePath} does not contain window.VIC3_DATA`);
  return JSON.parse(match[1].replace(/;\s*$/, ""));
}

function classifyFlavorExamples(countries, ideologyByKey) {
  const rows = {
    addedOnly: [],
    removedOnly: [],
    addedReplacement: [],
    removedReplacement: [],
  };
  for (const country of countries || []) {
    for (const group of country.interestGroups || []) {
      for (const rule of group.applied_rules || []) {
        const added = rule.added_ideologies || [];
        const removed = rule.removed_ideologies || [];
        for (const addedIdeology of added) {
          const matches = removed.filter((removedIdeology) => sharedLawGroups(addedIdeology.key, removedIdeology.key, ideologyByKey).length);
          if (matches.length) {
            for (const match of matches) rows.addedReplacement.push({ current: addedIdeology.key, other: match.key, country: country.tag });
          } else {
            rows.addedOnly.push({ current: addedIdeology.key, country: country.tag });
          }
        }
        for (const removedIdeology of removed) {
          const matches = added.filter((addedIdeology) => sharedLawGroups(removedIdeology.key, addedIdeology.key, ideologyByKey).length);
          if (matches.length) {
            for (const match of matches) rows.removedReplacement.push({ current: removedIdeology.key, other: match.key, country: country.tag });
          } else {
            rows.removedOnly.push({ current: removedIdeology.key, country: country.tag });
          }
        }
      }
    }
  }
  return rows;
}

function sharedLawGroups(leftKey, rightKey, ideologyByKey) {
  const left = new Set(((ideologyByKey.get(leftKey)?.law_stances) || []).map((stance) => stance.law_group_key).filter(Boolean));
  const right = new Set(((ideologyByKey.get(rightKey)?.law_stances) || []).map((stance) => stance.law_group_key).filter(Boolean));
  return [...left].filter((key) => right.has(key));
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
