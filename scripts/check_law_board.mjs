import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { readChunkedSiteData } from "./site_data_reader.mjs";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteData = readChunkedSiteData(root);
const indexSource = readText("site/index.html");
const appSource = readSiteAppSource(root);
const styleSource = readSiteStyleSource(root);

assert.ok(Array.isArray(siteData.laws) && siteData.laws.length > 0, "site data should include laws");
assert.ok(Array.isArray(siteData.lawGroups) && siteData.lawGroups.length > 0, "site data should include law groups");

const monarchy = siteData.laws.find((law) => law.key === "law_monarchy");
assert.ok(monarchy, "law data should include law_monarchy");
assert.equal(monarchy?.group_key, "lawgroup_governance_principles", "monarchy should belong to governance principles");
assert.equal(monarchy?.name_zh, "君主制", "monarchy should keep its Chinese localization");
assert.equal(typeof monarchy?.sort_order, "number", "laws should retain their source declaration order");

const colonialAdministration = siteData.laws.find((law) => law.key === "law_colonial_administration");
assert.equal(colonialAdministration?.parent, "law_monarchy", "colonial administration should retain its parent law");

const publicSchools = siteData.laws.find((law) => law.key === "law_public_schools");
assert.equal(publicSchools?.institution?.key, "institution_schools", "public schools should unlock the schools institution");
assert.ok(publicSchools?.unlocking_technologies?.some((technology) => technology.key === "empiricism"), "public schools should retain their prerequisite technology");

const autocracy = siteData.laws.find((law) => law.key === "law_autocracy");
assert.ok(autocracy?.amendments?.length, "laws should include related amendments");

const slaveryBanned = siteData.laws.find((law) => law.key === "law_slavery_banned");
assert.ok(slaveryBanned?.enactment_effects?.includes("颁布时解放奴隶"), "slavery banned should retain its enactment effect");

const loyalist = siteData.ideologies.find((ideology) => ideology.key === "ideology_loyalist");
const jingoist = siteData.ideologies.find((ideology) => ideology.key === "ideology_jingoist");
assert.equal(loyalist?.is_universal, true, "an ideology present in every country with interest groups should be universal");
assert.equal(jingoist?.is_universal, false, "an ideology absent from one eligible country should be flavor");
assert.equal(loyalist?.country_coverage_total, 531, "universal ideology coverage should exclude countries without interest groups");

for (const key of [
  "ideology_shojoi",
  "ideology_bonapartist",
  "ideology_bonapartist_movement",
  "ideology_military_absolutist",
  "ideology_meiji_restorationist_movement_daijoi",
]) {
  const ideology = siteData.ideologies.find((item) => item.key === key);
  assert.ok(ideology, `ideology data should include ${key}`);
  assert.notEqual(path.basename(ideology.source_file), "00_ig_ideologies.txt", `${key} should be excluded by the common-only ideology filter`);
}

const governance = siteData.lawGroups.find((group) => group.key === "lawgroup_governance_principles");
assert.ok(governance, "law group data should include governance principles");
assert.equal(governance?.name_zh, "治理原则", "governance principles should keep its Chinese localization");
assert.equal(governance?.category, "power_structure", "law groups should retain their category");
assert.ok(fs.existsSync(path.join(root, "site/assets/laws/monarchy.png")), "monarchy icon is missing");
assert.match(appSource, /function\s+renderLawBoard\s*\(/, "law board renderer is missing");
assert.match(appSource, /function\s+renderLawDetail\s*\(/, "law detail renderer is missing");
assert.match(appSource, /parts\[0\]\s*===\s*"law"/, "law hash route is missing");
assert.match(appSource, /function\s+renderLawFilterOptions\s*\(/, "law group filter renderer is missing");
assert.match(appSource, /function\s+lawIdeologyStanceHtml\s*\(/, "law ideology stance renderer is missing");
assert.match(appSource, /function\s+lawIconHtml\s*\(/, "law icon renderer is missing");
assert.match(appSource, /function\s+lawDisplayName\s*\(/, "law variant label renderer is missing");
assert.match(appSource, /function\s+lawGroupCategoryLabel\s*\(/, "law group category label renderer is missing");
assert.match(appSource, /function\s+renderLawGroupFilterSections\s*\(/, "law group filters should be categorized");
assert.match(appSource, /function\s+ideologyLawStanceTooltip\s*\(/, "law stance tooltip renderer is missing");
assert.match(appSource, /function\s+lawEffectListHtml\s*\(/, "law effect list renderer is missing");
assert.match(appSource, /function\s+lawStanceSourceKey\s*\(/, "variant stance inheritance is missing");
assert.match(appSource, /function\s+bindLawGroupFilterTokens\s*\(/, "law group filters should be mutually exclusive");
assert.match(appSource, /function\s+conceptTooltipIdeologyLawStance\s*\(/, "ideology hover tooltip should show the current law stance");
assert.match(appSource, /function\s+lawAmendmentDetailsHtml\s*\(/, "law amendments should have expandable details");
assert.match(appSource, /function\s+matchesCommonLawAndIdeologyFilter\s*\(/, "common-only filter is missing");
assert.match(appSource, /function\s+isCommonIdeology\s*\(/, "common ideology classifier is missing");
assert.match(appSource, /ideology\?\.is_universal\s*===\s*true/, "common ideology filter should require universal country coverage");
assert.match(appSource, /function\s+lawPills\s*\(/, "law pill groups should preserve normal spacing");
assert.match(appSource, /law-effect-section-label/, "institution effects should have one section label");
assert.doesNotMatch(appSource, /机构效果：/, "institution effect prefix should not repeat on every row");
assert.match(readText("scripts/extract_vic3_countries.mjs"), /DiplomaticActionType\|BuildingType\|LawType/, "localization cleanup should support diplomatic actions, buildings, and laws");
assert.match(appSource, /function\s+sortIdeologyRefsByType\s*\(/, "ideology tags should have a type-order sorter");
assert.match(appSource, /function\s+ideologyPillGroups\s*\(/, "ideology tags should be grouped by type");
assert.match(appSource, /ideologyTypeOptions\.map\(\(type\)/, "ideology groups should use the ordered type definitions");
assert.match(appSource, /ideology-pill-group-label/, "ideology group labels should be rendered");
assert.doesNotMatch(appSource, /\$\{ideology\.name_zh \|\| ideology\.key\}\$\{ideologyTypeKey/, "movement names should not carry a suffix in individual tags");
assert.match(styleSource, /\.ideology-pill-group\s*{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*5em\s+minmax\(0,\s*1fr\)/, "ideology tag rows should share one aligned label column");
assert.match(appSource, /lawDisplayName\(law\)/, "law rows should render variants through their display name");
assert.match(appSource, /lawEffectListHtml\(law\)/, "law details should render effects as a list");
assert.match(appSource, /\$\{laws\.length\} 条法律/, "home board should expose the law entry");
assert.match(appSource, /view: "law"/, "home law entry should link to the law board");
assert.match(indexSource, /data-nav-view="law"[\s\S]*assets\/lucide\/icons\/scale\.svg/, "law nav should use the scale icon");
assert.match(indexSource, /<strong>列表<\/strong>/, "content panel should be called a list");
assert.match(indexSource, /id="commonLawIdeologyFilter"/, "common-only law and ideology checkbox is missing");
assert.doesNotMatch(appSource, /（运动）/, "movement labels should use ASCII parentheses");
assert.match(appSource, /\(运动\)/, "movement labels should identify movements");

const lawListSource = appSource.slice(appSource.indexOf("function renderLawList"), appSource.indexOf("function selectLawCard"));
assert.doesNotMatch(lawListSource, /lawProgressivenessLabel|lawModifierListHtml|modifier_summary_zh/, "law rows should not display progressiveness or modifiers");
assert.match(lawListSource, /<details class="law-category-section" open>/, "law categories should be collapsible");
assert.match(styleSource, /\.law-effect-positive/, "positive law effects should have a color class");
assert.match(styleSource, /\.law-effect-negative/, "negative law effects should have a color class");
assert.match(styleSource, /\.law-effect-value/, "law effect numbers should be separately styled");
assert.match(styleSource, /body\[data-view="law"\]\s+\.map-panel/, "law view should hide the map panel");

for (const law of siteData.laws) {
  const iconName = path.basename(String(law.icon || "")).replace(/\.dds$/i, "");
  if (iconName) assert.ok(fs.existsSync(path.join(root, "site/assets/laws", `${iconName}.png`)), `missing law icon: ${iconName}`);
}

console.log(JSON.stringify({ law_board_data: "ok", laws: siteData.laws.length, law_groups: siteData.lawGroups.length }));

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}
