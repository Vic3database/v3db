import assert from "node:assert/strict";

import { readChunkedSiteData } from "./site_data_reader.mjs";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const app = readSiteAppSource(root);
const styles = readSiteStyleSource(root);
const data = readChunkedSiteData(root);
const companyByKey = new Map(data.companies.map((company) => [company.key, company]));
const stateRegions = data.stateRegions || [];

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

assert.match(app, /function\s+companyLocationStateRegionKeys\s*\(/, "company location state-key resolver is missing");
assert.match(app, /isDetailPageRoute\(\)[\s\S]*companyLocationStateRegionKeys\(selectedCompany\)\.length/, "companies without resolved locations must not initialize a detail map layer");
assert.match(app, /company_cfr[\s\S]*romanian/, "Romanian railway must use Romanian homelands");
assert.match(app, /company_ottoman_tobacco_regie[\s\S]*turkish/, "Ottoman tobacco company must use Turkish homelands");
assert.match(app, /companyKindKey\(company\)\s*!==\s*"historical"/, "generic and easter-egg companies must not receive a detail location map");
assert.match(app, /referenced_strategic_regions[\s\S]*states/, "company location resolver must expand strategic regions into state regions");
assert.match(app, /referenced_geographic_regions[\s\S]*geographicRegionStateRegions/, "company location resolver must expand geographic regions into state regions");
assert.match(app, /function\s+companyMapStateRegions\s*\([^)]*\)\s*{[\s\S]*companyLocationStateRegionKeys/, "company detail map must limit visible states to the selected company locations");
assert.match(app, /data-company-location-map/, "company detail must render a dedicated map canvas marker");
assert.match(styles, /body\[data-view="company"\]\s+\.map-panel/, "company list view must hide the main map panel");
assert.match(styles, /\.company-location-map/, "company detail map needs dedicated styles");
assert.match(app, /function\s+companyDetailLocationHtml\s*\(/, "company detail location section renderer is missing");
assert.match(app, /companyDetailLocationMapEnabled\(company\)/, "company detail must gate the location section by company kind");
assert.match(app, /暂无可定位地点/, "historical companies without usable locations need an explicit message");
assert.match(app, /queueMicrotask\(\(\)\s*=>\s*renderCompanyDetailLocationMap\(company\)\)/, "company detail must schedule its map after inserting the canvas");
assert.match(styles, /\.company-location-map\s+canvas\s*{[\s\S]*pointer-events:\s*none[\s\S]*cursor:\s*default/, "detail map canvas must not accept pointer interaction");
assert.doesNotMatch(app.match(/function companyDetailLocationHtml[\s\S]*?\n}/)?.[0] || "", /map-toolbar|mapModeSelect|mapSubjectSelect|mapFitWidthButton/, "detail location section must not duplicate main-map controls");

console.log(JSON.stringify({
  company_detail_location_map: "ok",
  romanian_homelands: 9,
  turkish_homelands: 22,
}));
