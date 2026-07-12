import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  writeCountryFlagBatch,
  writeCountryFlagPreviewContactSheet,
  writeCountryFlagVariantPngs,
} from "./lib/country_flag_variants.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const gamePath = path.resolve(args.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3");
const assetRoot = path.resolve(args.assetRoot || path.join(root, "game", "gfx", "coat_of_arms"));
const countryDataFile = path.resolve(args.countryData || path.join(root, "output_next", "vic3_1.13.8_countries.json"));
const outDir = path.resolve(args.outDir || path.join(root, "output_next", "flags", "europe"));
const previewDir = path.join(outDir, "previews");
const pngDir = path.join(outDir, "png");
const batchDir = path.join(outDir, "json");

const europeStates = readEuropeStrategicRegionStates(gamePath);
const countries = readJson(countryDataFile).countries || [];
const europeCountries = countries
  .map((country) => classifyEuropeCountry(country, europeStates))
  .filter(Boolean)
  .sort((a, b) => a.tag.localeCompare(b.tag));
const tags = europeCountries.map((country) => country.tag);

const { manifest } = writeCountryFlagBatch({
  tags,
  gamePath,
  assetRoot,
  outDir: batchDir,
});

fs.mkdirSync(previewDir, { recursive: true });
fs.mkdirSync(pngDir, { recursive: true });
const previewRecords = [];
const pngRecords = [];
for (const entry of manifest.tags) {
  const sourceFile = path.join(batchDir, entry.file);
  const outFile = path.join(previewDir, `${entry.tag}.png`);
  const preview = writeCountryFlagPreviewContactSheet({
    inputJson: sourceFile,
    gamePath,
    outFile,
    columns: Number(args.columns || 4),
    flagWidth: Number(args.flagWidth || 240),
    flagHeight: Number(args.flagHeight || 144),
  });
  previewRecords.push({
    tag: entry.tag,
    file: path.relative(outDir, outFile).replaceAll("\\", "/"),
    width: preview.width,
    height: preview.height,
  });
  const singleDir = path.join(pngDir, entry.tag);
  const single = writeCountryFlagVariantPngs({
    inputJson: sourceFile,
    gamePath,
    outDir: singleDir,
    flagWidth: Number(args.flagWidth || 240),
    flagHeight: Number(args.flagHeight || 144),
  });
  pngRecords.push({
    tag: entry.tag,
    dir: path.relative(outDir, single.outDir).replaceAll("\\", "/"),
    files: single.files.map((file) => path.relative(outDir, file).replaceAll("\\", "/")),
  });
}

const europeManifest = {
  generatedAt: new Date().toISOString(),
  source: {
    countryDataFile,
    strategicRegionFile: path.join(gamePath, "game", "common", "strategic_regions", "europe_strategic_regions.txt"),
  },
  europeStateCount: europeStates.size,
  totalTags: tags.length,
  totalVariants: manifest.totalVariants,
  missingAssetReferences: manifest.missingAssetReferences,
  countries: europeCountries.map((country) => ({
    ...country,
    variants: manifest.tags.find((entry) => entry.tag === country.tag)?.variants || 0,
    preview: previewRecords.find((record) => record.tag === country.tag)?.file || "",
    png_dir: pngRecords.find((record) => record.tag === country.tag)?.dir || "",
  })),
};

const manifestFile = path.join(outDir, "manifest.json");
fs.writeFileSync(manifestFile, `${JSON.stringify(europeManifest, null, 2)}\n`, "utf8");
writeCsv(path.join(outDir, "manifest.csv"), europeManifest.countries);

console.log(
  `wrote ${path.relative(root, manifestFile)}: ${europeManifest.totalTags} tags, ${europeManifest.totalVariants} variants, ${europeManifest.missingAssetReferences} missing asset refs`,
);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function readEuropeStrategicRegionStates(rootGamePath) {
  const file = path.join(rootGamePath, "game", "common", "strategic_regions", "europe_strategic_regions.txt");
  const source = fs.readFileSync(file, "utf8").replace(/#.*$/gm, "");
  const states = new Set();
  for (const match of source.matchAll(/states\s*=\s*\{([^}]*)\}/g)) {
    for (const state of match[1].trim().split(/\s+/)) {
      if (state) states.add(state);
    }
  }
  return states;
}

function classifyEuropeCountry(country, europeStates) {
  const startingStates = splitList(country.starting_states);
  const releaseStates = splitList(country.release_states);
  const formationStates = splitList(country.formation_states);
  const capital = String(country.capital || "");
  const startingMatches = startingStates.filter((state) => europeStates.has(state));
  const releaseMatches = releaseStates.filter((state) => europeStates.has(state));
  const formationMatches = formationStates.filter((state) => europeStates.has(state));
  const reasons = [];
  if (startingMatches.length) reasons.push("starting_state");
  if (releaseMatches.length) reasons.push("release_state");
  if (formationMatches.length) reasons.push("formation_state");
  if (europeStates.has(capital)) reasons.push("capital");
  if (!reasons.length) return null;
  return {
    tag: country.tag,
    name_zh: country.name_zh,
    exists_at_start: country.exists_at_start,
    country_type_zh: country.country_type_zh,
    inclusion_reasons: reasons,
    europe_starting_state_count: startingMatches.length,
    europe_release_state_count: releaseMatches.length,
    europe_formation_state_count: formationMatches.length,
    europe_capital: europeStates.has(capital) ? capital : "",
  };
}

function splitList(value) {
  return String(value || "").split(";").map((item) => item.trim()).filter(Boolean);
}

function writeCsv(file, rows) {
  const columns = [
    "tag",
    "name_zh",
    "exists_at_start",
    "country_type_zh",
    "inclusion_reasons",
    "europe_starting_state_count",
    "europe_release_state_count",
    "europe_formation_state_count",
    "europe_capital",
    "variants",
    "preview",
    "png_dir",
  ];
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(Array.isArray(row[column]) ? row[column].join(";") : row[column])).join(",")),
  ];
  fs.writeFileSync(file, `${lines.join("\n")}\n`, "utf8");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true";
    result[key] = value;
  }
  return result;
}
