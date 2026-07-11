import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const databaseDir = path.resolve(args.database || "database/vic3_1.13.9");
const siteDataFile = path.resolve(args.siteData || args["site-data"] || "site/versions/1.13.9/data.js");
const appFile = args.app ? path.resolve(args.app) : "";

const databaseIndex = readJson(path.join(databaseDir, "index.json"));
const siteData = readSiteData(siteDataFile);
const failures = [];

if (!databaseIndex.files?.geographic_regions) {
  failures.push(`${databaseDir} index.json missing files.geographic_regions`);
}

if (!Number.isFinite(Number(databaseIndex.counts?.geographic_regions)) || Number(databaseIndex.counts.geographic_regions) <= 0) {
  failures.push(`${databaseDir} index.json missing positive counts.geographic_regions`);
}

const geographicFile = databaseIndex.files?.geographic_regions
  ? path.join(databaseDir, databaseIndex.files.geographic_regions)
  : "";
const geographicRows = geographicFile && fs.existsSync(geographicFile) ? readJson(geographicFile) : [];
if (!geographicRows.length) {
  failures.push(`${databaseDir} missing non-empty geographic region rows`);
}

const siteGeographicRows = siteData.geographicRegions || [];
if (!siteGeographicRows.length) {
  failures.push(`${siteDataFile} missing non-empty geographicRegions`);
}

const requiredKeys = ["geographic_region_india", "geographic_region_greater_germany"];
const databaseKeys = new Set(geographicRows.map((region) => region.key));
const siteKeys = new Set(siteGeographicRows.map((region) => region.key));
for (const key of requiredKeys) {
  if (!databaseKeys.has(key)) failures.push(`${databaseDir} missing ${key}`);
  if (!siteKeys.has(key)) failures.push(`${siteDataFile} missing ${key}`);
  const region = geographicRows.find((item) => item.key === key);
  if (region && !(region.state_regions || []).length) {
    failures.push(`${databaseDir} ${key} has no state_regions`);
  }
}

const requiredGroupedKeys = new Map([
  ["geographic_region_india", "culture"],
  ["geographic_region_greater_germany", "culture"],
  ["geographic_region_french_natural_borders", "history"],
  ["geographic_region_colonial_new_grenada", "history"],
  ["geographic_region_colonial_new_spain", "history"],
  ["geographic_region_ring_of_fire", "natural"],
  ["geographic_region_great_rift_valley", "natural"],
  ["geographic_region_wet_process_coffee_region", "natural"],
  ["geographic_region_tropical_seas", "natural"],
  ["geographic_region_amazon", "natural"],
  ["geographic_region_old_world", "world"],
  ["geographic_region_new_world", "world"],
  ["geographic_region_east_asia", "world"],
  ["geographic_region_south_east_asia", "world"],
  ["geographic_region_latin_america", "world"],
  ["geographic_region_allahabad_bombay_line", "economy"],
  ["geographic_region_anatolia_old", "old_strategic"],
]);

for (const [key, expectedGroup] of requiredGroupedKeys) {
  const region = geographicRows.find((item) => item.key === key);
  const siteRegion = siteGeographicRows.find((item) => item.key === key);
  if (!region) {
    failures.push(`${databaseDir} missing grouped geographic region ${key}`);
    continue;
  }
  if (!siteRegion) failures.push(`${siteDataFile} missing grouped geographic region ${key}`);
  if (region.geographic_region_group !== expectedGroup) {
    failures.push(`${databaseDir} ${key} expected group ${expectedGroup}, got ${region.geographic_region_group || "(empty)"}`);
  }
  if (region.is_current_strategic_region) {
    failures.push(`${databaseDir} ${key} should not be marked as current strategic region`);
  }
}

const currentStrategicKeys = [
  "geographic_region_western_europe",
  "geographic_region_central_europe",
  "geographic_region_north_india",
];
for (const key of currentStrategicKeys) {
  const region = geographicRows.find((item) => item.key === key);
  if (!region) {
    failures.push(`${databaseDir} missing current strategic geographic region ${key}`);
    continue;
  }
  if (!region.is_current_strategic_region) {
    failures.push(`${databaseDir} ${key} should be marked as current strategic region`);
  }
  if (region.geographic_region_group !== "ignored_current_strategic") {
    failures.push(`${databaseDir} ${key} expected group ignored_current_strategic, got ${region.geographic_region_group || "(empty)"}`);
  }
  if (siteKeys.has(key)) {
    failures.push(`${siteDataFile} should omit current strategic geographic region ${key}`);
  }
}

const visibleSiteRows = siteGeographicRows.filter((region) => !region.is_current_strategic_region);
if (!visibleSiteRows.length) failures.push(`${siteDataFile} missing visible geographic regions`);
for (const region of visibleSiteRows) {
  if (!region.geographic_region_group) {
    failures.push(`${siteDataFile} ${region.key} missing geographic_region_group`);
  }
}

const oldStrategicRows = geographicRows.filter((region) => region.geographic_region_group === "old_strategic");
const oldStrategicSiteRows = siteGeographicRows.filter((region) => region.geographic_region_group === "old_strategic");
if (oldStrategicRows.length !== 51) {
  failures.push(`${databaseDir} expected 51 old strategic geographic regions, got ${oldStrategicRows.length}`);
}
if (oldStrategicSiteRows.length !== oldStrategicRows.length) {
  failures.push(`${siteDataFile} expected ${oldStrategicRows.length} visible old strategic geographic regions, got ${oldStrategicSiteRows.length}`);
}
for (const region of oldStrategicRows) {
  if (!String(region.source_file || "").endsWith("06_old_strategic_regions.txt")) {
    failures.push(`${databaseDir} ${region.key} old strategic region source mismatch: ${region.source_file || "(empty)"}`);
  }
  if (!region.is_old_strategic_region) {
    failures.push(`${databaseDir} ${region.key} should be marked as old strategic region`);
  }
  if (!region.old_strategic_region_key || !region.old_strategic_region_key.startsWith("region_")) {
    failures.push(`${databaseDir} ${region.key} missing old_strategic_region_key`);
  }
  if (!region.display_name_zh || !region.display_name_zh.endsWith("(旧战略区域)")) {
    failures.push(`${databaseDir} ${region.key} missing old strategic display suffix`);
  }
  if (/\$[^$]+\$/.test(region.display_name_zh || "")) {
    failures.push(`${databaseDir} ${region.key} display_name_zh still has unresolved localization token`);
  }
}
for (const region of oldStrategicSiteRows) {
  if (!region.display_name_zh || !region.display_name_zh.endsWith("(旧战略区域)")) {
    failures.push(`${siteDataFile} ${region.key} missing old strategic display suffix`);
  }
}

if (appFile) {
  const appText = fs.readFileSync(appFile, "utf8");
  const groupOrderMatch = appText.match(/const\s+geographicRegionGroupOrder\s*=\s*\[([\s\S]*?)\];/);
  if (!groupOrderMatch) {
    failures.push(`${appFile} missing geographicRegionGroupOrder`);
  } else {
    const groupOrder = [...groupOrderMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    if (groupOrder[groupOrder.length - 1] !== "old_strategic") {
      failures.push(`${appFile} should place old_strategic at the end of geographicRegionGroupOrder`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  database: databaseDir,
  siteData: siteDataFile,
  geographic_regions: geographicRows.length,
  site_geographic_regions: siteGeographicRows.length,
  checked_keys: requiredKeys,
  checked_groups: [...new Set(requiredGroupedKeys.values())],
}, null, 2));

function readJson(file) {
  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function readSiteData(file) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return context.window.VIC3_DATA || {};
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      i += 1;
    }
  }
  return result;
}

function printHelp() {
  console.log(`Usage: node scripts/check_geographic_regions.mjs [options]

Options:
  --database <path>  Database directory, default database/vic3_1.13.9
  --site-data <path> Site data.js file, default site/versions/1.13.9/data.js
  --app <path>       Optional app.js file for frontend ordering checks
  --help            Show this help
`);
}
