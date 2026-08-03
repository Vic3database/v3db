import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const databaseDir = path.resolve(args.database || path.join(root, "database", "vic3_1.13.9"));
const siteRoot = path.resolve(args.site || path.join(root, "site"));
const python = args.python || process.env.PYTHON || "python";
const index = readJson(path.join(databaseDir, "index.json"));
const gameData = path.resolve(index.source_paths?.game_data || "");
if (!gameData || !fs.statSync(gameData, { throwIfNoEntry: false })?.isDirectory()) {
  throw new Error("Economy database does not declare an accessible source_paths.game_data directory");
}

const collections = [
  ["buildings", "buildings"],
  ["goods", "goods"],
  ["prestige_goods", "prestige-goods"],
  ["production_methods", "production-methods"],
];
const entries = [];
for (const [fileKey, category] of collections) {
  const rows = readJson(path.join(databaseDir, index.files?.[fileKey] || ""));
  for (const row of rows) {
    if (!row?.icon?.source) continue;
    entries.push({
      key: row.key,
      source: path.join(gameData, ...row.icon.source.split("/")),
      destination: path.join(siteRoot, "assets", category, `${row.key}.webp`),
      category,
    });
  }
}

const uniqueDestinations = new Set();
for (const entry of entries) {
  if (uniqueDestinations.has(entry.destination)) throw new Error(`Duplicate economy asset destination: ${entry.destination}`);
  if (!fs.statSync(entry.source, { throwIfNoEntry: false })?.isFile()) throw new Error(`Missing economy icon source: ${entry.source}`);
  uniqueDestinations.add(entry.destination);
}

const requestedCategory = args.category;
const categoryEntries = requestedCategory ? entries.filter((entry) => entry.category === requestedCategory) : entries;
if (requestedCategory && !categoryEntries.length) throw new Error(`Unknown or empty asset category: ${requestedCategory}`);
const pendingEntries = args.missing ? categoryEntries.filter((entry) => !fs.statSync(entry.destination, { throwIfNoEntry: false })?.isFile()) : categoryEntries;
const selectedEntries = args.limit ? pendingEntries.slice(0, args.limit) : pendingEntries;
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "vic3-economy-assets-"));
const manifestFile = path.join(temporaryDirectory, "manifest.json");
try {
  fs.writeFileSync(manifestFile, JSON.stringify(selectedEntries), "utf8");
  convertIcons(manifestFile, python);
  assertOutputs(selectedEntries);
  const counts = selectedEntries.reduce((out, entry) => {
    out[entry.category] = (out[entry.category] || 0) + 1;
    return out;
  }, {});
  const bytes = selectedEntries.reduce((total, entry) => total + fs.statSync(entry.destination).size, 0);
  console.log(JSON.stringify({ economy_assets: "ok", counts, bytes }, null, 2));
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

function parseArgs(values) {
  const parsed = { database: "", site: "", python: "", category: "", missing: false, limit: 0 };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--missing") {
      parsed.missing = true;
      continue;
    }
    if (["--database", "--site", "--python", "--category"].includes(value)) {
      const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      parsed[key] = values[index + 1] || "";
      if (!parsed[key]) throw new Error(`Missing value for ${value}`);
      index += 1;
    } else if (value === "--limit") {
      parsed.limit = Number(values[index + 1] || "");
      if (!Number.isInteger(parsed.limit) || parsed.limit < 1) throw new Error("--limit must be a positive integer");
      index += 1;
    } else if (value === "--help" || value === "-h") {
      console.log("Usage: node scripts/build_economy_assets.mjs [--database <dir>] [--site <dir>] [--python <command>] [--category <name>] [--missing] [--limit <count>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}

function convertIcons(manifestFile, pythonCommand) {
  const script = [
    "import json, sys",
    "from pathlib import Path",
    "from PIL import Image",
    "entries = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))",
    "for entry in entries:",
    "    source = Path(entry['source'])",
    "    destination = Path(entry['destination'])",
    "    destination.parent.mkdir(parents=True, exist_ok=True)",
    "    with Image.open(source) as image:",
    "        image.convert('RGBA').save(destination, 'WEBP', quality=85, method=2)",
  ].join("\n");
  const result = spawnSync(pythonCommand, ["-c", script, manifestFile], { encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) {
    throw new Error(`Unable to convert economy icons using ${pythonCommand}: ${result.error?.message || result.stderr || result.stdout}`.trim());
  }
}

function assertOutputs(rows) {
  for (const row of rows) {
    if (!fs.statSync(row.destination, { throwIfNoEntry: false })?.isFile()) throw new Error(`Missing converted economy icon: ${row.destination}`);
  }
}

function readJson(file) {
  if (!file) throw new Error("Missing economy database file path");
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}
