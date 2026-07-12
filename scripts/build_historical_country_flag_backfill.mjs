import path from "node:path";

import { writeHistoricalCountryFlagCalibration } from "./lib/historical_country_flag_calibration.mjs";

import fs from "node:fs";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const manifestFile = path.resolve(args.manifest || path.join(root, "output_next", "flags", "wiki", "wiki-country-flag-manifest.json"));
const gamePath = args.gamePath || "D:\\SteamLibrary\\steamapps\\common\\Victoria 3";
const assetRoot = path.resolve(args.assetRoot || path.join(root, "game", "gfx", "coat_of_arms"));
const tagFilter = args.tag ? new Set(String(args.tag).split(",").map((tag) => tag.trim().toUpperCase()).filter(Boolean)) : null;

const manifest = readJson(manifestFile);
const entries = (manifest.entries || [])
  .filter((entry) => entry.status === "wiki-matched")
  .filter((entry) => !tagFilter || tagFilter.has(entry.tag));

if (tagFilter && entries.length !== tagFilter.size) {
  const found = new Set(entries.map((entry) => entry.tag));
  const missing = [...tagFilter].filter((tag) => !found.has(tag));
  throw new Error(`Missing calibrated wiki image for tags: ${missing.join(", ")}`);
}

const written = [];
for (const entry of entries) {
  const tag = entry.tag;
  const result = writeHistoricalCountryFlagCalibration({
    root,
    tag,
    gamePath,
    assetRoot,
    manifestEntry: entry,
    outFile: path.join(root, "output_next", "flags", "generated", `${tag}.json`),
    pngOutDir: path.join(root, "output_next", "flags", "generated", "png", tag),
  });
  written.push({
    tag,
    json: path.relative(root, result.outFile).replaceAll("\\", "/"),
    png: path.relative(root, result.pngFile).replaceAll("\\", "/"),
  });
}

console.log(JSON.stringify({
  historicalCountryFlagBackfill: "ok",
  manifest: path.relative(root, manifestFile).replaceAll("\\", "/"),
  written: written.length,
  sample: written.slice(0, 10),
}, null, 2));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
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
