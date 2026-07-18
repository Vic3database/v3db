import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { readChunkedSiteData } from "./site_data_reader.mjs";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const app = readSiteAppSource(root);
const styles = readSiteStyleSource(root);
const data = readChunkedSiteData(root);
const rulesFile = path.join(root, "site", "app", "company-location-rules.js");
assert.ok(fs.existsSync(rulesFile), "company location audit rules file is missing");
const rulesContext = {};
vm.runInNewContext(fs.readFileSync(rulesFile, "utf8"), rulesContext, { filename: rulesFile });
const locationRules = rulesContext.COMPANY_LOCATION_RULES || {};
const initialHeadquarters = rulesContext.COMPANY_INITIAL_HEADQUARTERS || {};
const geographicRegionStrategicRegions = rulesContext.COMPANY_LOCATION_GEOGRAPHIC_REGION_STRATEGIC_REGIONS || {};
const companyByKey = new Map(data.companies.map((company) => [company.key, company]));
const stateRegions = data.stateRegions || [];
const stateRegionKeys = new Set(stateRegions.map((stateRegion) => stateRegion.key));
const strategicRegionKeys = new Set(data.strategicRegions.map((region) => region.key));

const cfr = companyByKey.get("company_cfr");
const tobacco = companyByKey.get("company_ottoman_tobacco_regie");
const genericWine = companyByKey.get("company_argentinian_wine");

assert.equal(cfr?.company_kind, "historical");
assert.equal(tobacco?.company_kind, "historical");
assert.equal(genericWine?.company_kind, "generic");
assert.deepEqual(Array.from(cfr?.referenced_cultures || [], (item) => item.key), ["romanian"]);
assert.deepEqual(Array.from(tobacco?.referenced_cultures || [], (item) => item.key), ["turkish"]);
assert.equal(stateRegions.filter((stateRegion) => stateRegion.homeland_cultures?.some((culture) => culture.key === "romanian")).length, 9);
assert.equal(stateRegions.filter((stateRegion) => stateRegion.homeland_cultures?.some((culture) => culture.key === "turkish")).length, 22);

assert.equal(locationRules.company_construction_power_bloc?.map, false, "construction power bloc must not show a detail map");
assert.deepEqual(Array.from(locationRules.company_el_aguila?.stateKeys || []), [
  "STATE_RIO_GRANDE",
  "STATE_VERACRUZ",
  "STATE_WESTERN_CUBA",
  "STATE_WEST_INDIES",
]);
assert.deepEqual(Array.from(locationRules.company_standard_oil?.stateKeys || []), [
  "STATE_FLORIDA",
  "STATE_ALABAMA",
  "STATE_MISSISSIPPI",
  "STATE_OHIO",
  "STATE_PENNSYLVANIA",
]);
assert.ok(locationRules.company_bunge_born?.excludeStateKeys?.includes("STATE_ARAUCANIA"));
assert.ok(locationRules.company_argentinian_wine?.excludeStateKeys?.includes("STATE_CHACO"));
assert.ok(locationRules.company_perskhlopok?.excludeStateKeys?.includes("STATE_PASHTUNISTAN"));
assert.ok(locationRules.company_persshelk?.excludeStateKeys?.includes("STATE_KABUL"));
assert.equal(locationRules.company_ralli_brothers?.replaceDerivedLocations, true, "Ralli Brothers must only show its headquarters");
assert.equal(locationRules.company_steel_brothers?.replaceDerivedLocations, true, "Steel Brothers must only show Burmese teak states");
assert.deepEqual(Array.from(locationRules.company_steel_brothers?.stateTraitKeys || []), ["state_trait_burmese_teak"]);
assert.ok(locationRules.company_ottoman_tobacco_regie?.homelandCultureKeys?.includes("turkish"));
assert.ok(locationRules.company_cfr?.homelandCultureKeys?.includes("romanian"));
assert.deepEqual(Array.from(initialHeadquarters.company_dmc || []), ["STATE_ALSACE_LORRAINE"]);
assert.deepEqual(Array.from(initialHeadquarters.company_william_cramp || []), ["STATE_PENNSYLVANIA"]);
assert.deepEqual(Array.from(geographicRegionStrategicRegions.geographic_region_nile_basin || []), ["region_nile_basin"]);
assert.deepEqual(Array.from(geographicRegionStrategicRegions.geographic_region_indonesia || []), ["region_indonesia"]);
for (const [companyKey, rule] of Object.entries(locationRules)) {
  for (const stateKey of [...(rule.stateKeys || []), ...(rule.excludeStateKeys || [])]) {
    assert.ok(stateRegionKeys.has(stateKey), `${companyKey} references unknown state region ${stateKey}`);
  }
}
for (const [companyKey, stateKeys] of Object.entries(initialHeadquarters)) {
  for (const stateKey of stateKeys) assert.ok(stateRegionKeys.has(stateKey), `${companyKey} references unknown initial headquarters ${stateKey}`);
}
for (const [geographicRegionKey, regionKeys] of Object.entries(geographicRegionStrategicRegions)) {
  for (const regionKey of regionKeys) assert.ok(strategicRegionKeys.has(regionKey), `${geographicRegionKey} references unknown strategic region ${regionKey}`);
}

assert.match(app, /function\s+companyLocationStateRegionKeys\s*\(/, "company location state-key resolver is missing");
assert.match(app, /isDetailPageRoute\(\)[\s\S]*companyLocationStateRegionKeys\(selectedCompany\)\.length/, "companies without resolved locations must not initialize a detail map layer");
assert.match(app, /company\.key\.startsWith\("company_basic_"\)/, "only company_basic companies may skip their detail location map");
assert.match(app, /COMPANY_LOCATION_RULES/, "company location resolver must load the audited rules");
assert.match(app, /possible_raw[\s\S]*attainable_raw[\s\S]*ai_construction_targets_raw/, "company location resolver must use operating conditions instead of potential conditions");
assert.match(app, /companyOperationalLocationStateRegionKeys/, "company location resolver must derive locations from operating conditions");
assert.match(app, /function\s+companyMapStateRegions\s*\([^)]*\)\s*{[\s\S]*companyLocationStateRegionKeys/, "company detail map must limit visible states to the selected company locations");
assert.match(app, /data-company-location-map/, "company detail must render a dedicated map canvas marker");
assert.match(styles, /body\[data-view="company"\]\s+\.map-panel/, "company list view must hide the main map panel");
assert.match(styles, /\.company-location-map/, "company detail map needs dedicated styles");
assert.match(app, /function\s+companyDetailLocationHtml\s*\(/, "company detail location section renderer is missing");
assert.match(app, /company-detail-overview/, "historical company details need a compact overview layout");
assert.match(app, /companyDetailLocationMapEnabled\(company\)/, "company detail must gate the location section by company kind");
assert.match(app, /暂无可定位地点/, "historical companies without usable locations need an explicit message");
assert.match(app, /queueMicrotask\(\(\)\s*=>\s*renderCompanyDetailLocationMap\(company\)\)/, "company detail must schedule its map after inserting the canvas");
assert.match(styles, /\.company-location-map\s+canvas\s*{[\s\S]*pointer-events:\s*none[\s\S]*cursor:\s*default/, "detail map canvas must not accept pointer interaction");
assert.match(styles, /\.company-detail-overview\s*{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.72fr\)\s+minmax\(0,\s*1\.28fr\)/, "historical company overview must restore the original wide-screen map column");
assert.match(styles, /\.company-location-map\s*{[\s\S]*aspect-ratio:\s*4\s*\/\s*3/, "detail location map must use a 4:3 aspect ratio");
assert.match(app, /mapTransformForStateRegions\(stateKeys,\s*viewport,\s*\{\s*maxWorldScale:\s*2\.6,\s*padding:\s*180\s*\}\)/, "detail location map must use the larger 2.6 world scale");
assert.match(app, /const\s+COMPANY_LOCATION_MAP_COLOR\s*=\s*"#00cc66"/, "company location map must use La Plata green");
assert.match(app, /function\s+companyAssociationColor\s*\([^)]*\)\s*{[\s\S]*count\s*>\s*0\s*\?\s*COMPANY_LOCATION_MAP_COLOR/, "company location states must use the fixed location color");
assert.doesNotMatch(app.match(/function companyDetailLocationHtml[\s\S]*?\n}/)?.[0] || "", /map-toolbar|mapModeSelect|mapSubjectSelect|mapFitWidthButton/, "detail location section must not duplicate main-map controls");

console.log(JSON.stringify({
  company_detail_location_map: "ok",
  romanian_homelands: 9,
  turkish_homelands: 22,
}));
