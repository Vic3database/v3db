import fs from "node:fs";
import path from "node:path";
import { readChunkedSiteData } from "./site_data_reader.mjs";

const root = process.cwd();
const failures = [];

const appSource = readText("site/app.js");
const siteData = readChunkedSiteData(root);
const andeanFederation = siteData.countries.find((country) => country.tag === "FND");

checkDataCoverage();
checkMapSelectionContracts();
checkMapFocusContracts();

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  checked: [
    "site/app.js",
    "site/versions/1.13.9/data-index.js",
  ],
  country_map_selection: "ok",
}, null, 2));

function checkDataCoverage() {
  assert(Boolean(andeanFederation), "Andean Federation country data should be present as FND");
  assert(andeanFederation?.isMajorFormable === "是", "FND should be marked as a major formable country");
  assert((andeanFederation?.formationStateRegions || []).length >= 30, "FND should expose its formation state-region range");
  assert((andeanFederation?.formationStrategicRegions || []).some((region) => region.key === "region_andes"), "FND should keep Andes in its formation strategic regions");
}

function checkMapSelectionContracts() {
  const renderCountryBoard = functionSource("renderCountryBoard");
  const buildCountryMapFeatures = functionSource("buildCountryMapFeatures");
  const drawMapLayer = functionSource("drawMapLayer");
  const mapLayerSignature = functionSource("mapLayerSignature");
  const mapPixelColor = functionSource("mapPixelColor");
  const addStateBorders = functionSource("addStateBorders");
  const addCountryBorders = functionSource("addCountryBorders");

  assert(/function\s+countryMapStateKeys\s*\(/.test(appSource), "country map should derive a selected country's default territory state keys");
  assert(/formationStateRegions[\s\S]*formationStates[\s\S]*formationRegion[\s\S]*startingStates/.test(functionSource("countryMapStateKeys")), "country map territory should prefer formation ranges before falling back to starting states");
  assert(/const\s+selectedCountry\s*=\s*byTag\.get\(state\.selectedTag\)/.test(renderCountryBoard), "country board should look up the selected country before rendering the map");
  assert(/renderMap\(countryMapStateRegions\(selectedCountry\)\)/.test(renderCountryBoard), "country board should pass selected-country territory to the map");
  assert(/focusCountryOnMap\(selectedCountry\)/.test(renderCountryBoard), "selecting a country should focus the map on its selected territory");
  assert(/selectedCountry[\s\S]*countryMapStateKeys\(selectedCountry\)/.test(buildCountryMapFeatures), "country map features should use selected-country territory keys");
  assert(/countryMapUsesOwnerPixels\(\)/.test(drawMapLayer), "country map should disable owner-pixel coloring when a selected territory is shown");
  assert(/countryMapUsesOwnerPixels\(\)/.test(mapPixelColor), "map tooltip color lookup should follow the selected territory coloring mode");
  assert(/selectedCountryMapSignature\(\)/.test(mapLayerSignature), "country map cache signature should include the selected country's territory");
  assert(/addStateBorders\(data, stateIndexes, mapRuntime\.width, mapRuntime\.height\)/.test(drawMapLayer), "map layer should draw state borders before country borders");
  assert(/state\.mapMode === "country"[\s\S]*addCountryBorders\(data, stateIndexes, mapRuntime\.pixelOwnerIndexes, mapRuntime\.width, mapRuntime\.height\)/.test(drawMapLayer), "country map should overlay country borders only in the country board");
  assert(/const stateBorderColor = \[/.test(addStateBorders), "state-border renderer should own its subdued border color");
  assert(/const countryBorderColor = \[/.test(addCountryBorders), "country-border renderer should own its stronger border color");
  assert(/ownerIndexes\[pixel\][\s\S]*ownerIndexes\[rightPixel\]/.test(addCountryBorders), "country borders should compare adjacent owner indexes");
  assert(/indexTouchesSea\(index, rightIndex\)/.test(addCountryBorders), "country borders should retain the sea test for the right-hand neighbor");
  assert(/indexTouchesSea\(index, downIndex\)/.test(addCountryBorders), "country borders should retain the sea test for the lower neighbor");
}

function checkMapFocusContracts() {
  const buildCompanyMapFeatures = functionSource("buildCompanyMapFeatures");
  const focusCompanyOnMap = functionSource("focusCompanyOnMap");
  const focusCountryOnMap = functionSource("focusCountryOnMap");
  const focusStateRegionsOnMap = functionSource("focusStateRegionsOnMap");

  assert(/label:\s*association\.count\s*>\s*1\s*\?\s*String\(association\.count\)\s*:\s*""/.test(buildCompanyMapFeatures), "company map labels should omit solitary 1 markers");
  assert(/maxWorldScale:\s*2\.2/.test(focusCompanyOnMap), "company map focus should keep enough world context");
  assert(/padding:\s*260/.test(focusCompanyOnMap), "company map focus should use wider context padding");
  assert(/maxWorldScale:\s*2\.1/.test(focusCountryOnMap), "country map focus should keep enough world context");
  assert(/padding:\s*280/.test(focusCountryOnMap), "country map focus should use wider context padding");
  assert(/const\s+worldFitScale\s*=\s*Math\.min/.test(focusStateRegionsOnMap) && /viewport\.width\s*\/\s*mapRuntime\.width/.test(focusStateRegionsOnMap) && /viewport\.height\s*\/\s*mapRuntime\.height/.test(focusStateRegionsOnMap), "map focus should derive zoom limits from the whole-world fit scale");
  assert(/options\.maxWorldScale[\s\S]*worldFitScale\s*\*\s*options\.maxWorldScale/.test(focusStateRegionsOnMap), "map focus should support world-relative maximum zoom");
  assert(!/maxScale:\s*2\.[48]/.test(focusCompanyOnMap + focusCountryOnMap), "map focus should not keep the old close-up absolute max scales");
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}`);
  if (start < 0) return "";
  const signatureEnd = appSource.indexOf(")", start);
  const bodyStart = appSource.indexOf("{", signatureEnd);
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

function assert(condition, message) {
  if (!condition) failures.push(message);
}
