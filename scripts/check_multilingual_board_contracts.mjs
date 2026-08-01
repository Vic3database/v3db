import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const boardsArg = process.argv.includes("--boards")
  ? process.argv[process.argv.indexOf("--boards") + 1]
  : process.argv.find((arg) => arg.startsWith("--boards="))?.slice("--boards=".length);
const boards = (boardsArg || "country,culture").split(",").filter(Boolean);
const app = fs.readFileSync(path.join(root, "site", "app", "presentation.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "site", "app", "filters.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "site", "app", "components.js"), "utf8");
const mapApp = fs.readFileSync(path.join(root, "site", "app", "map.js"), "utf8");
const uiZh = fs.readFileSync(path.join(root, "site", "locales", "ui.zh-Hans.js"), "utf8");
const uiEn = fs.readFileSync(path.join(root, "site", "locales", "ui.en.js"), "utf8");

const bodies = {
  renderCountryList: body("renderCountryList"),
  renderCountryDetail: body("renderCountryDetail"),
  renderCountryDetailPage: body("renderCountryDetailPage"),
  renderCultureList: body("renderCultureList"),
  renderCultureDetail: body("renderCultureDetail"),
  sortCountries: body("sortCountries", fs.readFileSync(path.join(root, "site", "app", "filters.js"), "utf8")),
  sortCultures: body("sortCultures", fs.readFileSync(path.join(root, "site", "app", "filters.js"), "utf8")),
  mobileCountry: body("renderMobileCountryControls"),
  mobileCulture: body("renderMobileCultureControls"),
  mobileCountryOptions: body("mobileCountryFilterOptions"),
  mobileCountrySelected: body("mobileCountrySelectedFilters"),
  mobileCountryRefName: body("mobileCountryCultureRefName"),
  mobileCultureOptions: body("renderMobileCultureFilterOptions"),
  mobileCultureGroupedOptions: body("renderCultureMobileGroupedOptions"),
  mobileCultureSelected: body("mobileCultureSelectedFilters"),
  mobileCultureRefName: body("mobileCultureRefName"),
  countryTierLabel: body("countryTierLabel"),
  renderRegionList: body("renderRegionList"),
  stateRegionRowHtml: body("stateRegionRowHtml"),
  renderStateRegionDetail: body("renderStateRegionDetail"),
  renderStrategicRegionDetail: body("renderStrategicRegionDetail"),
  renderGeographicRegionDetail: body("renderGeographicRegionDetail"),
  renderCompanyList: body("renderCompanyList"),
  renderCompanyDetail: body("renderCompanyDetail"),
  companyLocationFieldsHtml: body("companyLocationFieldsHtml"),
  companyKindText: body("companyKindText"),
  companyDlcLabel: body("companyDlcLabel"),
  companyPrestigeLabel: body("companyPrestigeLabel"),
  companyMetaLine: body("companyMetaLine"),
  companySearchBlob: body("companySearchBlob"),
  companyAssociationLinks: body("companyAssociationLinks"),
  companiesForStateRegion: body("companiesForStateRegion"),
  companyPrestigeGoodPill: body("companyPrestigeGoodPill"),
  resourcePill: body("resourcePill"),
  buildingPill: body("buildingPill"),
  stateTraitPill: body("stateTraitPill"),
  stateTraitTooltipDescription: body("stateTraitTooltipDescription"),
  stateTraitEffectList: body("stateTraitEffectList"),
  modifierSummaryLabel: body("modifierSummaryLabel"),
  dynamicStateNameList: body("dynamicStateNameList"),
  stateRegionNameText: body("stateRegionNameText"),
  strategicRegionName: body("strategicRegionName"),
  mapSubjectOptions: body("mapSubjectOptions", mapApp),
  collectMapResourceRefs: body("collectMapResourceRefs", mapApp),
  buildCompanyStateAssociations: body("buildCompanyStateAssociations", mapApp),
  companyLocationSummary: body("companyLocationSummary", mapApp),
  companyAssociationTitle: body("companyAssociationTitle", mapApp),
  mapTooltipHtml: body("mapTooltipHtml", mapApp),
  mapTooltipRowsForView: body("mapTooltipRowsForView", mapApp),
  mapTooltipTraitSummary: body("mapTooltipTraitSummary", mapApp),
  compactResourceLabel: body("compactResourceLabel", mapApp),
  renderIdeologyList: body("renderIdeologyList"),
  renderIdeologyDetail: body("renderIdeologyDetail"),
  ideologyPill: body("ideologyPill"),
  ideologyLawGroupNames: body("ideologyLawGroupNames"),
  ideologyLawGroupRefs: body("ideologyLawGroupRefs"),
  lawStanceGroupsHtml: body("lawStanceGroupsHtml"),
  lawStanceChip: body("lawStanceChip"),
  lawAttitudeLinesHtml: body("lawAttitudeLinesHtml"),
  ideologyUnlockTagsHtml: body("ideologyUnlockTagsHtml"),
  ideologySourceText: body("ideologySourceText"),
  ideologyFlavorDefinitionHtml: body("ideologyFlavorDefinitionHtml"),
  ideologyWeightSectionHtml: body("ideologyWeightSectionHtml"),
  interestGroupRefPills: body("interestGroupRefPills"),
  interestGroupRuleSummary: body("interestGroupRuleSummary"),
  interestGroupRuleDetails: body("interestGroupRuleDetails"),
  interestGroupEffectRefPills: body("interestGroupEffectRefPills"),
  renderLawList: body("renderLawList"),
  renderLawDetail: body("renderLawDetail"),
  lawDisplayName: body("lawDisplayName"),
  lawEffectListHtml: body("lawEffectListHtml"),
  lawEffectItemHtml: body("lawEffectItemHtml"),
  lawAmendmentDetailsHtml: body("lawAmendmentDetailsHtml"),
  lawPill: body("lawPill"),
  sortLaws: body("sortLaws"),
  sortLawGroup: body("sortLawGroup"),
  renderLawGroupFilterSections: body("renderLawGroupFilterSections"),
  renderIdeologyLawGroupFilterSections: body("renderIdeologyLawGroupFilterSections"),
};

if (boards.includes("country")) {
  assert.match(bodies.renderCountryList, /entityText\(/, "country list should use entityText");
  assert.match(bodies.renderCountryDetail, /entityText\(/, "country detail should use entityText");
  assert.match(bodies.renderCountryDetail, /t\(/, "country detail should use translated labels");
  assert.match(bodies.sortCountries, /localizedCompare\(/, "country sort should use localizedCompare");
  assert.doesNotMatch(bodies.renderCountryList, /country\.name_zh|primaryCulturesZh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.renderCountryDetail, /country\.name_zh|primaryCulturesZh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.mobileCountry, /country\.name_zh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.mobileCountryOptions, /name_zh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.mobileCountrySelected, /name_zh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.mobileCountryRefName, /name_zh|tierZh|countryTypeZh/);
  assert.doesNotMatch(bodies.countryTierLabel, /tierZh/);
}

if (boards.includes("culture")) {
  assert.match(bodies.renderCultureList, /entityText\(/, "culture list should use entityText");
  assert.match(bodies.renderCultureDetail, /entityText\(/, "culture detail should use entityText");
  assert.match(bodies.sortCultures, /localizedCompare\(/, "culture sort should use localizedCompare");
  assert.doesNotMatch(bodies.renderCultureList, /culture\.name_zh|name_zh/);
  assert.doesNotMatch(bodies.renderCultureDetail, /culture\.name_zh|name_zh/);
  assert.doesNotMatch(bodies.mobileCulture, /culture\.name_zh|name_zh/);
  assert.doesNotMatch(bodies.mobileCultureOptions, /name_zh/);
  assert.doesNotMatch(bodies.mobileCultureGroupedOptions, /name_zh/);
  assert.doesNotMatch(bodies.mobileCultureSelected, /name_zh/);
  assert.doesNotMatch(bodies.mobileCultureRefName, /name_zh/);
}

if (boards.includes("region")) {
  for (const name of ["renderRegionList", "stateRegionRowHtml", "renderStateRegionDetail", "renderStrategicRegionDetail", "renderGeographicRegionDetail", "companyAssociationLinks", "companiesForStateRegion", "resourcePill", "buildingPill", "stateTraitPill", "stateTraitTooltipDescription", "stateTraitEffectList", "modifierSummaryLabel", "dynamicStateNameList", "stateRegionNameText", "strategicRegionName", "mapSubjectOptions", "collectMapResourceRefs", "mapTooltipHtml", "mapTooltipRowsForView", "mapTooltipTraitSummary", "compactResourceLabel"]) {
    assert.match(bodies[name], /entityText\(|renderTextSpec\(|t\(/, `${name} should use localized accessors`);
    assert.doesNotMatch(bodies[name], /name_zh|category_zh|display_name_zh|geographic_region_group_zh|modifier_summary_zh|summary_zh|value_zh|localeCompare\([^]*zh-Hans-CN/);
  }
}

if (boards.includes("company")) {
  for (const name of ["renderCompanyList", "renderCompanyDetail", "companyLocationFieldsHtml", "companyKindText", "companyDlcLabel", "companyPrestigeLabel", "companyMetaLine", "companySearchBlob", "companyAssociationLinks", "companiesForStateRegion", "companyPrestigeGoodPill", "buildingPill", "modifierSummaryLabel", "buildCompanyStateAssociations", "companyLocationSummary", "companyAssociationTitle", "mapTooltipHtml", "mapTooltipRowsForView"]) {
    assert.match(bodies[name], /entityText\(|renderTextSpec\(|t\(/, `${name} should use localized accessors`);
    assert.doesNotMatch(bodies[name], /name_zh|category_zh|company_kind_zh|prestige_goods_kind_zh|dlc_name_(?:zh|en)|display_name_zh|modifier_summary_zh|summary_zh|value_zh|localeCompare\([^]*zh-Hans-CN/);
  }
}

if (boards.includes("ideology")) {
  for (const name of ["renderIdeologyList", "renderIdeologyDetail", "ideologyPill", "ideologyLawGroupNames", "ideologyLawGroupRefs", "lawStanceGroupsHtml", "lawStanceChip", "lawAttitudeLinesHtml", "ideologyUnlockTagsHtml", "ideologySourceText", "ideologyFlavorDefinitionHtml", "ideologyWeightSectionHtml", "interestGroupRefPills", "interestGroupRuleSummary", "interestGroupRuleDetails", "interestGroupEffectRefPills", "renderIdeologyLawGroupFilterSections"]) {
    assert.match(bodies[name], /entityText\(|renderTextSpec\(|t\(/, `${name} should use localized accessors`);
    assert.doesNotMatch(bodies[name], /name_zh|desc_zh|law_group_name_zh|law_name_zh|condition_summary_zh|flavor_definition_note_zh|source_name_zh|modifier_summary_zh|summary_zh|localeCompare\([^]*zh-Hans-CN/);
  }
}

if (boards.includes("law")) {
  for (const name of ["renderLawList", "renderLawDetail", "lawDisplayName", "lawEffectListHtml", "lawEffectItemHtml", "lawAmendmentDetailsHtml", "lawPill", "sortLawGroup", "renderLawGroupFilterSections", "lawStanceChip", "lawAttitudeLinesHtml"]) {
    assert.match(bodies[name], /entityText\(|renderTextSpec\(|t\(|localizedCompare\(/, `${name} should use localized accessors`);
    assert.doesNotMatch(bodies[name], /name_zh|desc_zh|law_group_name_zh|law_name_zh|condition_summary_zh|flavor_definition_note_zh|source_name_zh|modifier_summary_zh|summary_zh|localeCompare\([^]*zh-Hans-CN/);
  }
  assert.match(bodies.sortLaws, /sort_order/, "law sort should preserve structural sort order");
  assert.doesNotMatch(bodies.sortLaws, /name_zh|law_name_zh|localeCompare\([^]*zh-Hans-CN/);
}

assert(uiZh.includes("board.country"), "zh UI locale should define country board labels");
assert(uiZh.includes("board.culture"), "zh UI locale should define culture board labels");
assert(uiEn.includes("board.country"), "en UI locale should define country board labels");
assert(uiEn.includes("board.culture"), "en UI locale should define culture board labels");
if (boards.includes("region")) {
  assert(uiZh.includes("board.region"), "zh UI locale should define region board labels");
  assert(uiEn.includes("board.region"), "en UI locale should define region board labels");
}
if (boards.includes("company")) {
  assert(uiZh.includes("board.company"), "zh UI locale should define company board labels");
  assert(uiEn.includes("board.company"), "en UI locale should define company board labels");
}
if (boards.includes("ideology")) {
  assert(uiZh.includes("board.ideology"), "zh UI locale should define ideology board labels");
  assert(uiEn.includes("board.ideology"), "en UI locale should define ideology board labels");
}
if (boards.includes("law")) {
  assert(uiZh.includes("board.law"), "zh UI locale should define law board labels");
  assert(uiEn.includes("board.law"), "en UI locale should define law board labels");
}
assert(uiZh.includes("主流文化"), "zh UI locale should keep Chinese country labels");
assert(uiZh.includes("文化搜索与筛选条件"), "zh UI locale should keep Chinese culture labels");

console.log(`multilingual_board_contracts: ok (${boards.join(",")})`);

function body(name, source = app) {
  const pattern = new RegExp(`function ${name}\\([^]*?\\n}`);
  const match = source.match(pattern);
  assert(match, `missing function ${name}`);
  return match[0];
}
