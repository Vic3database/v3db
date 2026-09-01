import assert from "node:assert/strict";
import fs from "node:fs";

const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const ui = fs.readFileSync("site/app/ui.js", "utf8");
const buildWiki = fs.readFileSync("scripts/build_wiki.mjs", "utf8");
const countryData = JSON.parse(fs.readFileSync("database/vic3_1.13.11/countries.json", "utf8").replace(/^\uFEFF/, ""));
const vcCountryData = JSON.parse(fs.readFileSync("database/victorian_century/countries.json", "utf8").replace(/^\uFEFF/, ""));
const dataIndex = readGlobal("site/versions/1.13.11/data-index.js", "VIC3_DATA_INDEX");

assert.match(presentation, /country-starting-law-columns/, "country laws must use three fixed columns");
assert.match(presentation, /lawGroupCategoryOrder|power_structure.*economy.*human_rights/, "country laws must retain the three category order");
assert.match(presentation, /visibleEras = \["era_1", "era_2"\]\.filter/, "technology eras must be filtered by starting research state");
assert.match(presentation, /country-technology-era-complete/, "technology panel must label a fully unlocked era");
assert.doesNotMatch(presentation, /items\.sort\(\(left, right\) => localizedCompare\(entityText\(left\), entityText\(right\)/, "country technologies must not be sorted by localized name");
assert.match(presentation, /subjectType = item\.subjectType \|\| item\.subject_type/, "diplomacy records must expose subject types");
assert.match(presentation, /pactType = item\.pactType \|\| item\.pact_type/, "diplomacy records must expose treaty types");
assert.match(presentation, /country-region-calculator-entry/, "integration calculator must be placed in the regions section");
assert.match(presentation, /law\.amendments|amendments/, "starting law records must retain amendment data");
assert.match(presentation, /startingLawAmendments/, "starting law cards must label amendments");
assert.match(presentation, /country-starting-law-amendment-link/, "starting law amendments must link to their law detail");
assert.match(presentation, /selectedLawAmendment/, "law detail must support opening a linked amendment");
assert.match(presentation, /startingLawAmendmentLink/, "starting law amendments must expose effect links");
assert.match(presentation, /data-concept-kind="lawAmendment"/, "starting law amendment links must use amendment tooltip semantics");
assert.match(ui, /lawAmendmentTooltipRows/, "law amendments must have a dedicated effect-first tooltip");
assert.match(presentation, /data-incorporation-country/, "integration calculator must retain the country context");
assert.match(presentation, /country-incorporation-calculator-button/, "integration calculator must use a dedicated button");
assert.doesNotMatch(presentation.slice(presentation.indexOf("function countryDetailOverview"), presentation.indexOf("function countryOverviewCard")), /sourceSuffix\(/, "country overview must hide the religion source suffix");
assert.match(ui, /const incorporationLink = event\.target\.closest\("\[data-incorporation-country\]"\)/, "integration calculator button must have a click handler");
assert.match(buildWiki, /previousDataIndex|chunks\.content|chunks\.event/, "wiki build must preserve generated content chunks");
assert.ok(dataIndex?.chunks?.content, "versioned data index must retain the content chunk");
assert.ok(dataIndex?.chunks?.event, "versioned data index must retain the event chunk");

for (const tag of ["CHI", "AUS", "GBR", "JAP"]) {
  const country = countryData.find((item) => item.tag === tag);
  assert.ok(country?.starting_laws?.length, `${tag} must retain starting laws`);
}
assert.ok(countryData.find((item) => item.tag === "AUS")?.starting_laws?.some((law) => law.starting_amendments?.length), "Austria must retain starting law amendments");
assert.ok(vcCountryData.find((item) => item.tag === "FRA")?.starting_laws?.filter((law) => law.starting_amendments?.length).length >= 6, "Victorian Century France must retain its starting law amendments");

console.log("country_detail_followup: ok");

function readGlobal(file, name) {
  const source = fs.readFileSync(file, "utf8");
  const match = source.match(new RegExp(`window\\.${name}\\s*=\\s*(.*);\\s*$`));
  assert.ok(match, `${name} is missing from ${file}`);
  return JSON.parse(match[1]);
}
