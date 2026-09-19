import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const targets = process.argv.slice(2);
if (!targets.length) throw new Error("Usage: node scripts/merge_population_site_data.mjs <site-version-dir>...");

const databaseBySite = new Map([
  ["1.13.11", path.join(root, "database", "vic3_1.13.11")],
  ["victorian-century", path.join(root, "database", "victorian_century")],
]);

for (const target of targets) {
  const absoluteTarget = path.resolve(target);
  const databaseDir = databaseBySite.get(path.basename(absoluteTarget))
    || (["Victorian Century Database", "vc"].includes(path.basename(absoluteTarget)) ? path.join(root, "database", "victorian_century") : null);
  if (!databaseDir) throw new Error(`Unknown target database for ${target}`);
  const countries = readJson(path.join(databaseDir, "countries.json"));
  const stateRegions = readJson(path.join(databaseDir, "state_regions.json"));
  const strategicRegions = readJson(path.join(databaseDir, "strategic_regions.json"));
  const geographicRegions = readJson(path.join(databaseDir, "geographic_regions.json"));
  const cultures = readJson(path.join(databaseDir, "cultures.json"));
  const religions = readJson(path.join(databaseDir, "religions.json"));
  const countryPopulation = new Map(countries.map((item) => [item.tag, item.starting_population]));
  const statePopulation = new Map(stateRegions.map((item) => [item.key, item.starting_population]));
  const statePopulationByOwner = new Map(stateRegions.map((item) => [item.key, item.starting_population_by_owner || []]));
  const strategicPopulation = new Map(strategicRegions.map((item) => [item.key, item.starting_population]));
  const geographicPopulation = new Map(geographicRegions.map((item) => [item.key, item.starting_population]));
  const culturePopulation = new Map(cultures.map((item) => [item.key, item.starting_population]));
  const religionPopulation = new Map(religions.map((item) => [item.key, item.starting_population]));

  for (const index of [1, 2, 3, 4]) {
    const file = path.join(absoluteTarget, `data-countries-${index}.js`);
    if (!fs.existsSync(file)) continue;
    const chunk = readGlobal(file, "VIC3_DATA_CHUNK");
    chunk.countries = (chunk.countries || []).map((country) => ({
      ...country,
      startingPopulation: countryPopulation.get(country.tag) ?? null,
    }));
    writeGlobal(file, "VIC3_DATA_CHUNK", chunk);
  }
  const regionsFile = path.join(absoluteTarget, "data-regions.js");
  if (fs.existsSync(regionsFile)) {
    const chunk = readGlobal(regionsFile, "VIC3_DATA_CHUNK");
    chunk.stateRegions = (chunk.stateRegions || []).map((item) => ({ ...item, starting_population: statePopulation.get(item.key) ?? null, starting_population_by_owner: statePopulationByOwner.get(item.key) || [] }));
    chunk.strategicRegions = (chunk.strategicRegions || []).map((item) => ({ ...item, starting_population: strategicPopulation.get(item.key) ?? null }));
    chunk.geographicRegions = (chunk.geographicRegions || []).map((item) => ({ ...item, starting_population: geographicPopulation.get(item.key) ?? null }));
    writeGlobal(regionsFile, "VIC3_DATA_CHUNK", chunk);
  }
  const culturesFile = path.join(absoluteTarget, "data-cultures.js");
  if (fs.existsSync(culturesFile)) {
    const chunk = readGlobal(culturesFile, "VIC3_DATA_CHUNK");
    chunk.cultures = (chunk.cultures || []).map((item) => ({ ...item, starting_population: culturePopulation.get(item.key) ?? 0 }));
    writeGlobal(culturesFile, "VIC3_DATA_CHUNK", chunk);
  }
  const religionsFile = path.join(absoluteTarget, "data-religions.js");
  if (fs.existsSync(religionsFile)) {
    const chunk = readGlobal(religionsFile, "VIC3_DATA_CHUNK");
    chunk.religions = (chunk.religions || []).map((item) => ({ ...item, starting_population: religionPopulation.get(item.key) ?? 0 }));
    writeGlobal(religionsFile, "VIC3_DATA_CHUNK", chunk);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function readGlobal(file, name) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  if (!sandbox.window[name]) throw new Error(`${name} is missing from ${file}`);
  return sandbox.window[name];
}

function writeGlobal(file, name, value) {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temporary, `window.${name} = ${JSON.stringify(value)};\n`, "utf8");
  fs.renameSync(temporary, file);
}
