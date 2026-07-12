import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const appSource = readText("site/app.js");
const styleSource = readText("site/styles.css");

checkDetailLayoutContracts();
checkTagContrastContracts();
checkScrollbarContracts();
checkTooltipContracts();
checkListInteractionContracts();

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  checked: [
    "site/app.js",
    "site/styles.css",
  ],
  right_panel_layout: "ok",
}, null, 2));

function checkDetailLayoutContracts() {
  const detailTitleBlock = ruleBlock(".detail-title");
  const ideologyHeaderBlock = ruleBlock(".vic3-ideology-header");
  const detailScriptBlock = ruleBlock(".detail .script-details");
  const detailScriptPreBlock = ruleBlock(".detail .script-details pre");
  const detailInterestGroupRuleBlock = ruleBlock(".detail .interest-group-rule");
  const detailBackButtonSource = functionSource("detailBackButton");
  assert(/\.detail\s*{[\s\S]*--detail-pad-x:\s*20px[\s\S]*padding:\s*0\s+var\(--detail-pad-x\)\s+32px/.test(styleSource), "detail panel should put top spacing in the sticky title instead of scrollable padding");
  assert(/\.detail\s*{[\s\S]*--detail-pad-x:\s*18px[\s\S]*padding:\s*0\s+var\(--detail-pad-x\)\s+28px/.test(styleSource), "desktop detail panel should not leave a scrollable gap above the sticky title");
  assert(detailTitleBlock.includes("position: sticky") && detailTitleBlock.includes("top: 0") && /z-index:\s*\d+/.test(detailTitleBlock), "detail title should stay fixed at the top of the scrolling detail panel");
  assert(/margin:\s*0\s+calc\(-1\s*\*\s*var\(--detail-pad-x\)\)\s+0/.test(detailTitleBlock), "detail title should cover the panel width without exposing scrolling content above it");
  assert(/padding:\s*var\(--detail-pad-top\)\s+var\(--detail-pad-x\)\s+12px/.test(detailTitleBlock), "detail title should own the panel top spacing");
  assert(ideologyHeaderBlock.includes("position: sticky") && ideologyHeaderBlock.includes("top: 0") && /z-index:\s*\d+/.test(ideologyHeaderBlock), "ideology detail title should stay fixed at the top of the scrolling detail panel");
  assert(/aria-label="\$\{escapeHtml\(label\)\}"[\s\S]*title="\$\{escapeHtml\(label\)\}"[\s\S]*<img class="lucide-icon"[\s\S]*<\/button>/.test(detailBackButtonSource), "detail back button should be icon-only with accessible label and title");
  assert(!/<span>/.test(detailBackButtonSource), "detail back button should not render visible text");
  assert(!/\$\{detailBackButton\("[^"]+"\)\}\s*<div class="detail-title">/.test(appSource), "detail back button should be inside the fixed detail title area");
  assert(/body\.detail-page\s+\.detail-back-button\s*{[\s\S]*flex:\s*0\s+0\s+var\(--control-height\)[\s\S]*width:\s*var\(--control-height\)[\s\S]*min-width:\s*var\(--control-height\)/.test(styleSource), "detail back button should keep icon-button width inside long titles");
  assert(/\.detail\s+\.field-grid\s*{[\s\S]*grid-template-columns:\s*minmax\(86px,\s*0\.34fr\)\s+minmax\(0,\s*1fr\)/.test(styleSource), "right-panel field grid should use resilient label/value columns");
  assert(/\.detail\s+\.field-grid\s+dd\s*{[\s\S]*min-width:\s*0[\s\S]*overflow-wrap:\s*anywhere/.test(styleSource), "right-panel field values should wrap long content");
  assert(/\.detail\s+\.rule-list,\s*[\s\S]*\.detail\s+\.interest-group-list\s*{[\s\S]*gap:\s*12px/.test(styleSource), "right-panel card lists should use consistent spacing");
  assert(/\.detail\s+\.rule-item,\s*[\s\S]*\.detail\s+\.collapsible-detail-section,\s*[\s\S]*\.detail\s+\.vic3-special-usage,\s*[\s\S]*\.detail\s+\.ideology-weight-entry\s*{[\s\S]*border-color:\s*rgba\(200,\s*164,\s*91,\s*0\.24\)/.test(styleSource), "right-panel cards should share a visible dark-theme border");
  assert(detailScriptBlock.includes("border-top: 1px solid rgba(200, 164, 91, 0.24)"), "detail script sections should use the standard gold separator");
  assert(detailScriptPreBlock.includes("border-color: rgba(200, 164, 91, 0.28)") && detailScriptPreBlock.includes("background: var(--panel-glass-strong)") && detailScriptPreBlock.includes("color: var(--ink)"), "detail source code blocks should use the standard dark panel palette");
  assert(detailInterestGroupRuleBlock.includes("border-color: rgba(200, 164, 91, 0.24)") && detailInterestGroupRuleBlock.includes("background: var(--surface-raised)") && detailInterestGroupRuleBlock.includes("color: var(--ink)"), "detail matching-rule blocks should use the standard panel palette");
  assert(!detailScriptPreBlock.includes("background: #f3f6f3"), "detail source code blocks should not use the old light background");
  assert(/\.detail\s+\.link-list,\s*[\s\S]*\.detail\s+\.pill-line\s*{[\s\S]*align-items:\s*flex-start/.test(styleSource), "right-panel link and tag rows should align wrapped pills cleanly");
}

function checkTagContrastContracts() {
  assert(tagFamilyBlock(".pill.tag-type")?.includes("color: #d9ecff") && tagFamilyBlock(".pill.tag-type")?.includes("background: rgba(51, 106, 153, 0.28)"), "blue tag family should use higher-contrast text and background");
  assert(tagFamilyBlock(".pill.tag-tier")?.includes("color: #ffe3a8") && tagFamilyBlock(".pill.tag-tier")?.includes("background: rgba(167, 112, 34, 0.3)"), "gold tag family should use higher-contrast text and background");
  assert(tagFamilyBlock(".pill.tag-region")?.includes("color: #d9f0c5") && tagFamilyBlock(".pill.tag-region")?.includes("background: rgba(82, 122, 58, 0.3)"), "green tag family should use higher-contrast text and background");
  assert(tagFamilyBlock(".pill.tag-special")?.includes("color: #ffd6df") && tagFamilyBlock(".pill.tag-special")?.includes("background: rgba(153, 62, 84, 0.3)"), "red tag family should use higher-contrast text and background");
  assert(tagFamilyBlock(".pill.tag-muted")?.includes("color: #d7d0c5") && tagFamilyBlock(".pill.tag-muted")?.includes("background: rgba(130, 121, 109, 0.22)"), "muted tags should remain readable on the dark surface");
  assert(/\.detail\s+\.pill:not\(\[class\*="tag-"\]\):not\(\.good\):not\(\.warn\):not\(\.special\)\s*{[\s\S]*color:\s*#f0e7d8[\s\S]*background:\s*rgba\(103,\s*82,\s*53,\s*0\.24\)/.test(styleSource), "right-panel default pills should have a higher-contrast fallback");
}

function checkScrollbarContracts() {
  assert(/scrollbar-color:\s*rgba\(200,\s*164,\s*91,\s*0\.62\)\s+rgba\(20,\s*31,\s*39,\s*0\.32\)/.test(styleSource), "scrollbars should use the current gold and blue-black palette");
  assert(/::-webkit-scrollbar-thumb\s*{[\s\S]*background:\s*linear-gradient\(180deg,\s*rgba\(214,\s*177,\s*104,\s*0\.78\),\s*rgba\(77,\s*132,\s*170,\s*0\.62\)\)/.test(styleSource), "webkit scrollbar thumbs should use the current palette gradient");
  assert(/::-webkit-scrollbar-track\s*{[\s\S]*background:\s*rgba\(20,\s*31,\s*39,\s*0\.32\)/.test(styleSource), "webkit scrollbar tracks should use the dark blue-black track");
}

function checkTooltipContracts() {
  assert(/function\s+conceptTooltipRows\s*\(/.test(appSource), "concept tooltip should be built through a view-aware row helper");
  assert(/function\s+conceptTooltipContextLine\s*\(/.test(appSource), "concept tooltip should have view-specific context lines");
  assert(/function\s+conceptTooltipActionText\s*\(/.test(appSource), "concept tooltip action text should be isolated and short");
  assert(/function\s+resourceSummaryText\s*\(/.test(appSource), "concept tooltip state-region context should use a defined resource summary helper");
  assert(/data-concept-kind/.test(appSource), "concept links should keep explicit kind metadata");
  assert(/function\s+mapTooltipResourceRows\s*\(/.test(appSource), "map tooltip should split resources into explicit icon rows");
  assert(/mapTooltipResourceRows[\s\S]*buildingChip/.test(appSource), "map tooltip resource rows should render building icons");
  assert(/mapTooltipResourceRows[\s\S]*采矿[\s\S]*其他资源[\s\S]*农业/.test(appSource), "map tooltip resources should be grouped as mining, other resources, and agriculture");
  assert(!/tooltipField\("名称变体"/.test(functionSource("mapTooltipHtml")), "map tooltip should not repeat name variants as a second field");
  assert(/function\s+mapTooltipRowsForView\s*\(/.test(appSource), "map tooltip should choose fields by the active board");
  assert(/state\.view\s*===\s*"country"[\s\S]*当前省份归属/.test(appSource), "country map tooltip should include current province ownership");
  assert(/state\.view\s*===\s*"culture"[\s\S]*文化关系/.test(appSource), "culture map tooltip should include selected-culture relationship");
  assert(/state\.view\s*===\s*"company"[\s\S]*地区特质/.test(appSource), "company map tooltip should include state traits without unrelated ownership fields");
  assert(!functionSource("mapTooltipHtml").split("const rows = mapTooltipRowsForView")[0].includes("<dl>"), "sea map tooltip should only show name and id");
  assert(!/map-tooltip-section[\s\S]*stateTraitEffectList\(stateRegion\.traits\)/.test(functionSource("mapTooltipHtml")), "map hover tooltip should not render full state trait cards");
  assert(/\.concept-tooltip\s*{[\s\S]*max-width:\s*260px/.test(styleSource), "concept tooltip should be narrowed after content simplification");
  assert(/\.map-tooltip\s*{[\s\S]*width:\s*min\(360px,\s*calc\(100%\s*-\s*18px\)\)/.test(styleSource), "map tooltip should be narrowed after content simplification");
  assert(/\.map-tooltip-resource-row\s*{[\s\S]*display:\s*flex/.test(styleSource), "map tooltip resource icon rows should use a wrapping flex layout");
  assert(/\.map-tooltip-resource-row\s+\.building-chip\s*{[\s\S]*border:\s*0[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/.test(styleSource), "map tooltip resource icons should not keep the building chip card frame");
  assert(/\.map-tooltip-resource-row\s+\.building-chip\s+\.resource-icon\s*{[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/.test(styleSource), "map tooltip resource PNGs should not keep an inner icon card frame");
}

function checkListInteractionContracts() {
  const regionList = functionSource("renderRegionList");
  assert(!/row-title-link/.test(regionList), "state-region row titles should not be links");
  assert(!/data-state-region-open/.test(regionList), "state-region row titles should not open detail pages");
  assert(/data-state-region-detail/.test(regionList), "state-region rows should expose a right-side detail button");
  assert(!/data-strategic-region=/.test(regionList), "region list should not render strategic-region rows");
  assert(!/data-geographic-region=/.test(regionList), "region list should not render geographic-region rows");
  assert(!/replaceHash\(`\/state-region/.test(regionList), "clicking a state-region card should not open its detail page directly");
  assert(!/function\s+renderGeographicRegionListGroups\s*\(/.test(appSource), "right-side region list should not keep the old geographic-region row renderer");
  assert(!/function\s+regionListModeButton\s*\(/.test(appSource), "right-side region list should not keep the old strategic/geographic mode buttons");
  assert(!/data-region-list-mode/.test(appSource), "region list should not expose strategic/geographic list-mode buttons");
  assert(!/selectedGeographicRegion\s*=\s*filteredGeographicRegions\[0\]/.test(functionSource("renderRegionBoard")), "region board should not auto-select a geographic-region filter");
  assert(/data-geographic-region-filter[\s\S]*aria-pressed="\$\{String\(region\.key === state\.selectedGeographicRegion\)\}"/.test(functionSource("renderGeographicRegionFilterGroupRow")), "geographic-region filters should show selected state without requiring a detail page");
  assert(!/row-title-link/.test(appSource), "result card titles should not use title links");
  assert(!/company-heading-link/.test(functionSource("renderCompanyList")), "company row titles should not use a heading link");
  assert(!/data-country-open/.test(functionSource("renderCountryList")), "country row titles should not open detail pages");
  assert(!/data-culture-open/.test(functionSource("renderCultureList")), "culture row titles should not open detail pages");
  assert(!/data-company-open/.test(functionSource("renderCompanyList")), "company row titles should not open detail pages");
  assert(!/data-ideology-open/.test(functionSource("renderIdeologyList")), "ideology row titles should not open detail pages");
  assert(/data-country-detail/.test(functionSource("renderCountryList")), "country rows should expose a right-side detail button");
  assert(/data-culture-detail/.test(functionSource("renderCultureList")), "culture rows should expose a right-side detail button");
  assert(/data-company-detail/.test(functionSource("renderCompanyList")), "company rows should expose a right-side detail button");
  assert(/data-ideology-detail/.test(functionSource("renderIdeologyList")), "ideology rows should expose a right-side detail button");
  assert(/\.row-detail-button/.test(styleSource), "detail buttons should use a shared card action style");
  assert(!/replaceHash\(`\/geographic-region/.test(eventBindingSource()), "geographic-region filters should not navigate to geographic-region detail pages");
  assert(!/replaceHash\(`\/strategic-region/.test(eventBindingSource()), "strategic-region filters should not navigate to strategic-region detail pages");
  assert(/function\s+countryOwnerTagFromPointerEvent[\s\S]*!mapRuntime\.pixelOwnerIndexes/.test(appSource), "current province ownership should be available beyond the country board");
  assert(!/\.resource-filter-token\[aria-pressed="true"\]::after/.test(styleSource), "resource filter selected state should not use the old corner-dot highlight");
  assert(/\.geographic-filter-row[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(styleSource), "geographic-region filter groups should stack like strategic-region groups");
  assert(/\.results\s+\.region-row\s*{[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible/.test(styleSource), "region cards should not clip their whole card content");
  assert(/\.results\s+\.ideology-row\s*{[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible/.test(styleSource), "ideology cards should not clip their whole card content");
  assert(/\.results\s+\.country-row,\s*[\s\S]*\.results\s+\.culture-row\s*{[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible/.test(styleSource), "country and culture cards should grow with their content");
  assert(/\.results\s+\.company-row\s*{[\s\S]*min-height:\s*auto[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible/.test(styleSource), "company cards should grow with their content");
  assert(/\.results\s+\.country-row\s+\.country-heading,\s*[\s\S]*\.results\s+\.country-row\s+\.name,\s*[\s\S]*\.results\s+\.country-row\s+\.tag,\s*[\s\S]*\.results\s+\.culture-row\s+\.name,\s*[\s\S]*\.results\s+\.culture-row\s+\.tag,\s*[\s\S]*\.results\s+\.company-row\s+\.company-title-text\s+\.name,\s*[\s\S]*\.results\s+\.company-row\s+\.company-title-text\s+\.tag,\s*[\s\S]*\.results\s+\.region-row\s+\.name,\s*[\s\S]*\.results\s+\.region-row\s+\.tag,\s*[\s\S]*\.results\s+\.ideology-row-title\s+\.name,\s*[\s\S]*\.results\s+\.ideology-row-title\s+\.tag\s*{[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible[\s\S]*text-overflow:\s*clip[\s\S]*white-space:\s*normal[\s\S]*overflow-wrap:\s*anywhere/.test(styleSource), "result card title and tag rows should wrap without clipping");
  assert(/\.results\s+\.company-row\s+\.region-building-strip\s*{[\s\S]*max-height:\s*none/.test(styleSource), "company card building rows should not force a fixed one-line height");
  assert(/\.results\s+\.company-row\s+\.company-asset-line\s*{[\s\S]*max-height:\s*none/.test(styleSource), "company card prestige rows should not force a fixed one-line height");
  assert(/\.results\s+\.company-row\s+\.company-tag-line\s*{[\s\S]*max-height:\s*none/.test(styleSource), "company card tag rows should not force a fixed one-line height");
  assert(/\.results\s+\.pill-line\s*{[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible/.test(styleSource), "result card tag rows should grow with wrapped content");
  assert(/\.results\s+\.country-meta,\s*[\s\S]*\.results\s+\.minor\s*{[\s\S]*white-space:\s*normal[\s\S]*overflow:\s*visible/.test(styleSource), "result card meta rows should wrap instead of forcing one line");
  assert(/\.results\s+\.ideology-row\s+\.country-meta\s*{[\s\S]*display:\s*block[\s\S]*-webkit-line-clamp:\s*unset[\s\S]*overflow:\s*visible/.test(styleSource), "ideology result descriptions should not keep the two-line clamp");
  assert(/\.results\s+\.region-row\s+\.country-tags\s*{[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible/.test(styleSource), "region card tag rows should grow with their content");
  assert(/\.results\s+\.region-row\s+\.region-building-strip\s*{[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible/.test(styleSource), "region card resource rows should grow with their content");
  assert(/\.results\s+\.region-row\s+\.arable-chip\s*{[\s\S]*min-width:\s*0[\s\S]*min-height:\s*0[\s\S]*padding:\s*0[\s\S]*border:\s*0[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/.test(styleSource), "region card agriculture potential icons should not keep the building chip border");
  assert(/\.results\s+\.region-row\s+\.arable-chip\s+\.resource-icon\s*{[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none[\s\S]*border-radius:\s*0/.test(styleSource), "region card agriculture potential PNGs should not keep an inner icon card");
  assert(/\.results\s+\.ideology-law-preview\s*{[\s\S]*max-height:\s*none[\s\S]*overflow:\s*visible/.test(styleSource), "ideology law preview rows should grow with their content");
  assert(!/selectedTag\s*=\s*filtered\[0\]/.test(functionSource("renderCountryBoard")), "country board should not auto-select the first result");
  assert(!/selectedCulture\s*=\s*filtered\[0\]/.test(functionSource("renderCultureBoard")), "culture board should not auto-select the first result");
  assert(!/selectedStateRegion\s*=\s*filteredStateRegions\[0\]/.test(functionSource("renderRegionBoard")), "region board should not auto-select the first result");
  assert(!/selectedCompany\s*=\s*filtered\[0\]/.test(functionSource("renderCompanyBoard")), "company board should not auto-select the first result");
  assert(!/selectedIdeology\s*=\s*filtered\[0\]/.test(functionSource("renderIdeologyBoard")), "ideology board should not auto-select the first result");
  assert(!/state\.globalSearch\s*&&\s*!value\.includes/.test(functionSource("matchesSearchBlob")), "global search should not filter board lists");
  assert(!/state\.search\s*=\s*key\.toLowerCase/.test(functionSource("navigateGlobalSearchResult")), "global search navigation should not write into board search");
  assert(/function\s+selectionHashForCard[\s\S]*isDetailPageRoute\(\)/.test(appSource), "list browsing inside a detail route should stay in list-detail view");
  assert(!/body\.detail-page \.filters\s*,?[\s\S]{0,180}\{\s*display:\s*none/.test(styleSource), "detail list view should keep filters visible");
  assert(/body\.detail-page \.results\s*{[\s\S]*left:\s*calc\(12px \+ var\(--left-panel-width\) \+ var\(--panel-gap\)\)/.test(styleSource), "detail list view should place results after the filter panel");
  assert(/body\.detail-page \.detail\s*{[\s\S]*left:\s*calc\(12px \+ var\(--left-panel-width\) \+ var\(--panel-gap\) \+ var\(--results-panel-width\) \+ var\(--panel-gap\)\)/.test(styleSource), "detail list view should place detail after filters and list");
  assert(/function\s+focusStateRegionOnMap\s*\(stateRegion\)[\s\S]*focusStateRegionsOnMap\(\[stateRegion\.key\],\s*\{\s*maxWorldScale:\s*2\.\d,\s*padding:\s*3\d0\s*\}\)/.test(appSource), "state-region selection should have a dedicated map focus helper");
  assert(/function\s+focusCurrentMapSelection[\s\S]*state\.view\s*===\s*"region"[\s\S]*focusStateRegionOnMap\(byStateRegion\.get\(state\.selectedStateRegion\)\)/.test(appSource), "map loading should restore focus for a selected state-region");
  assert(/function\s+renderRegionBoard[\s\S]*const selectedStateRegion = byStateRegion\.get\(state\.selectedStateRegion\)[\s\S]*renderMap\(regionMapStateRegions\(filteredStateRegions,\s*filteredSeaStateRegions,\s*filteredGeographicRegions\)\)[\s\S]*focusStateRegionOnMap\(selectedStateRegion\)/.test(appSource), "region board should focus the map after a state-region card is selected");
  assert(/stateRegionSummaryText[\s\S]*countryRefNames/.test(appSource), "state-region cards should show starting owner labels with country tags");
  assert(!/function\s+stateRegionSummaryText[\s\S]*所属/.test(appSource), "state-region card summaries should not duplicate strategic-region text");
  assert(!/市场接入度的价格影响/.test(appSource), "MAPI labels should not use the long market access wording in the UI");
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
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

function tagFamilyBlock(selector) {
  const start = styleSource.lastIndexOf(selector);
  if (start < 0) return "";
  const open = styleSource.indexOf("{", start);
  const close = styleSource.indexOf("}", open);
  if (open < 0 || close < 0) return "";
  return styleSource.slice(start, close + 1);
}

function ruleBlock(selector, direction = "first") {
  const matches = [...styleSource.matchAll(new RegExp(`(^|\\n)${escapeRegExp(selector)}\\s*\\{`, "g"))];
  const match = direction === "last" ? matches.at(-1) : matches[0];
  const start = match ? match.index + match[1].length : -1;
  if (start < 0) return "";
  const open = styleSource.indexOf("{", start);
  const close = styleSource.indexOf("}", open);
  if (open < 0 || close < 0) return "";
  return styleSource.slice(start, close + 1);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function eventBindingSource() {
  return [
    functionSource("bindEvents"),
    functionSource("bindContainerTokenSet"),
    functionSource("bindTokenSet"),
    functionSource("renderRegionList"),
  ].join("\n");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}
