import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const siteRoot = path.join(root, "site");
const indexFile = path.join(siteRoot, "index.html");
const appFile = path.join(siteRoot, "app.js");
const stylesFile = path.join(siteRoot, "styles.css");
const flagsFile = path.join(siteRoot, "assets", "flags", "country-flags.js");
const dataFile = path.join(siteRoot, "data.js");
const gbrFlagDir = path.join(siteRoot, "assets", "flags", "GBR");
const conFlagDir = path.join(siteRoot, "assets", "flags", "_CON");
const ankFlagDir = path.join(siteRoot, "assets", "flags", "ANK");

const failures = [];
const indexSource = fs.readFileSync(indexFile, "utf8");
const appSource = fs.readFileSync(appFile, "utf8");
const stylesSource = fs.readFileSync(stylesFile, "utf8");
const flagGridRule = cssRule(stylesSource, ".country-flag-variant-grid");
const flagCardRule = cssRule(stylesSource, ".country-flag-variant-card");

expect(indexSource.includes("assets/flags/country-flags.js"), "index.html should load the country flag data before app.js");
expect(appSource.includes("window.VIC3_COUNTRY_FLAGS"), "app.js should read window.VIC3_COUNTRY_FLAGS");
expect(appSource.includes("async function loadCountryFlagData()"), "app.js should define a dynamic flag-data loader");
expect(appSource.includes("await loadCountryFlagData()"), "app initialization should load country flag data before rendering");
expect(appSource.includes("function countryFlagVariantSection"), "app.js should define the country flag section renderer");
expect(appSource.includes("countryFlagVariantSection(country)"), "country detail should render the flag variant section");
expect(appSource.includes("function countryFlagIconHtml"), "app.js should define a reusable country flag icon renderer");
expect(appSource.includes("renderEntityBadge(\"country\", country, country.name)") && appSource.includes("countryFlagIconHtml(entity, \"entity-badge entity-badge-flag\")"), "country list badges should use the reusable flag icon renderer");
expect(appSource.includes("countryFlagIconHtml(country, \"country-flag-title\")"), "country detail titles should use the reusable flag icon renderer");
expect(appSource.includes("countryFlagIconHtml(result.raw, \"country-flag-inline\")"), "global search board rows should use the reusable flag icon renderer");
expect(appSource.includes("countryFlagIconHtml(entity, \"entity-badge entity-badge-flag\")"), "global search dialog country rows should use the reusable flag icon renderer");
expect(stylesSource.includes(".country-flag-variant-grid"), "styles should include the flag variant grid");
expect(stylesSource.includes(".country-flag-variant-image"), "styles should include flag image sizing");
expect(stylesSource.includes(".entity-badge-flag"), "styles should include sizing for flag badges in country cards");
expect(stylesSource.includes(".entity-badge.entity-badge-flag"), "flag badges should override the shared entity badge square sizing");
expect(stylesSource.includes(".country-flag-inline"), "styles should include sizing for inline global-search flags");
expect(stylesSource.includes(".country-flag-title"), "styles should include sizing for country detail title flags");
expect(flagGridRule.includes("grid-template-columns: minmax(0, 1fr);"), "flag variant grid should render one full-width row per variant");
expect(!flagGridRule.includes("repeat(auto-fit"), "flag variant grid should not collapse into automatic narrow columns");
expect(flagCardRule.includes("grid-template-columns: clamp(150px, 24%, 230px) minmax(0, 1fr);"), "flag variant cards should keep a fixed image column and a wide detail column");
expect(fs.existsSync(flagsFile), "site/assets/flags/country-flags.js should exist");

let flagData = null;
if (fs.existsSync(flagsFile)) {
  const siteCountries = readSiteCountries(dataFile);
  const siteCountryTags = [...siteCountries.keys()].sort();
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const flagSource = fs.readFileSync(flagsFile, "utf8");
  expect(flagSource.includes("var VIC3_COUNTRY_FLAGS"), "country flag data should define a top-level VIC3_COUNTRY_FLAGS variable");
  vm.runInNewContext(flagSource, sandbox, { filename: flagsFile });
  flagData = sandbox.VIC3_COUNTRY_FLAGS;
  expect(flagData && typeof flagData === "object", "country flag data should assign VIC3_COUNTRY_FLAGS");
  const tags = Object.keys(flagData || {});
  const variantCount = tags.reduce((sum, tag) => sum + (flagData[tag]?.variants || []).length, 0);
  const missingSiteCountryFlags = siteCountryTags.filter((tag) => !flagData?.[tag]);
  expect(missingSiteCountryFlags.length === 0, `country flag data should cover every site country, missing ${missingSiteCountryFlags.join(", ")}`);
  expect(tags.length === 736, "country flag data should include 503 parsed flag tags, 1 historical generated tag, and 232 site-country fallback tags");
  expect(variantCount === 1640, "country flag data should include 1407 parsed variants, 1 historical generated variant, and 232 fallback variants");
  const gbr = flagData?.GBR;
  expect(gbr?.tag === "GBR", "country flag data should include GBR");
  expect((gbr?.variants || []).length === 20, "GBR should expose 20 flag variants");
  expect((gbr?.variants || []).some((variant) => variant.key === "GBR_uk" && /coa_def_controls_part_of_ireland/.test(variant.triggerRaw || "")), "GBR_uk should keep its Ireland trigger");
  expect((gbr?.variants || []).some((variant) => variant.key === "MAC_communist" && variant.exportKey === "GBR_MAC_communist"), "GBR should include the cross-tag MAC communist flag export");
  expect((gbr?.variants || []).every((variant) => variant.image && variant.priority !== undefined), "every GBR flag variant should have image and priority fields");
  expect((gbr?.variants || []).every((variant) => !variant.image.startsWith("/")), "GBR flag images should use document-relative paths");
  expect((gbr?.variants || []).every((variant) => variant.image.startsWith("assets/flags/GBR/")), "GBR flag images should point at the site flag asset directory");
  expect(flagData?.IBE?.variants?.length >= 20, "country flag data should include IBE's rich variant set");
  expect(flagData?.CON?.variants?.length === 1, "country flag data should include the CON tag despite the Windows reserved file name");
  expect(flagData?.CON?.variants?.[0]?.image === "assets/flags/_CON/_CON.png", "CON should use safe asset paths while keeping the real tag");
  expect(flagData?.ANK?.source === "generated:historical-country-coa", "ANK should use a calibrated historical generated flag");
  expect(flagData?.ANK?.variants?.length === 1, "ANK should expose one historical generated flag variant");
  expect(flagData?.ANK?.variants?.[0]?.image === "assets/flags/ANK/ANK.png", "ANK should point at its generated template PNG");
  expect(flagData?.ANK?.variants?.[0]?.fallback === false, "ANK historical variant should not be marked as fallback data");
  expect(flagData?.ANK?.variants?.[0]?.templateGenerated === false, "ANK variant should not be marked as template-generated data");
  expect(flagData?.ANK?.variants?.[0]?.historicalGenerated === true, "ANK variant should be marked as historical generated data");
  expect(flagData?.ANK?.variants?.[0]?.calibrationStatus === "wiki-matched", "ANK should record wiki calibration status");
  expect((flagData?.ANK?.variants?.[0]?.triggerSummary || "").includes("coa_def_african_trigger"), "ANK should record the African template trigger");
  expect(flagData?.ANK?.variants?.[0]?.referenceUrl === "https://vic3.paradoxwikis.com/Eastern_Bantu_kingdoms#Ankole", "ANK should keep the wiki reference URL");
  expect(tags.every((tag) => (flagData[tag]?.variants || []).every((variant) => !variant.image.startsWith("/"))), "all flag images should use document-relative paths");
  expect(tags.every((tag) => (flagData[tag]?.variants || []).every((variant) => fs.existsSync(path.join(siteRoot, variant.image)))), "every exported flag image should exist on disk");
}

if (fs.existsSync(gbrFlagDir)) {
  const pngFiles = fs.readdirSync(gbrFlagDir).filter((file) => file.endsWith(".png")).sort();
  expect(pngFiles.length === 20, "site/assets/flags/GBR should contain 20 PNG files");
  expect(pngFiles.includes("GBR.png"), "GBR.png should be present");
  expect(pngFiles.includes("GBR_MAC_communist.png"), "GBR_MAC_communist.png should be present");
} else {
  failures.push("site/assets/flags/GBR should exist");
}

if (fs.existsSync(conFlagDir)) {
  const pngFiles = fs.readdirSync(conFlagDir).filter((file) => file.endsWith(".png")).sort();
  expect(pngFiles.length === 1, "site/assets/flags/_CON should contain one PNG file");
  expect(pngFiles.includes("_CON.png"), "_CON.png should be present for the CON tag");
} else {
  failures.push("site/assets/flags/_CON should exist");
}

if (fs.existsSync(ankFlagDir)) {
  const pngFiles = fs.readdirSync(ankFlagDir).filter((file) => file.endsWith(".png")).sort();
  expect(pngFiles.length === 1, "site/assets/flags/ANK should contain one PNG file");
  expect(pngFiles.includes("ANK.png"), "ANK.png should be present for the ANK historical generated flag");
} else {
  failures.push("site/assets/flags/ANK should exist");
}

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  country_flag_detail_module: "ok",
  flag_tags: Object.keys(flagData).length,
  flag_variants: Object.values(flagData).reduce((sum, entry) => sum + entry.variants.length, 0),
  gbr_variants: flagData.GBR.variants.length,
}, null, 2));

function expect(condition, message) {
  if (!condition) failures.push(message);
}

function cssRule(source, selector) {
  const selectorIndex = source.indexOf(`${selector} {`);
  if (selectorIndex === -1) return "";
  const openIndex = source.indexOf("{", selectorIndex);
  const closeIndex = source.indexOf("\n}", openIndex);
  return source.slice(openIndex + 1, closeIndex);
}

function readSiteCountries(file) {
  const countries = new Map();
  if (!fs.existsSync(file)) return countries;
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  for (const country of sandbox.window.VIC3_DATA?.countries || []) {
    if (country.tag) countries.set(country.tag, country);
  }
  return countries;
}
