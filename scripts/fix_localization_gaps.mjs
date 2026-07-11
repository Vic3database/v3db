import fs from "node:fs";
import path from "node:path";

const DEFAULT_GAME_PATH = "D:\\SteamLibrary\\steamapps\\common\\Victoria 3";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const gamePath = path.resolve(args["game-path"] || DEFAULT_GAME_PATH);
const localizationDir = path.join(resolveContentRoot(gamePath), "localization", "simp_chinese");
const databaseDirs = getListArg(args.database || args.databases || "database/vic3_1.13.9");
const referenceDatabase = path.resolve(args["reference-database"] || "database/vic3_1.13.9");

if (!fs.existsSync(localizationDir)) {
  throw new Error(`Missing localization directory: ${localizationDir}`);
}

const localization = loadLocalization(localizationDir);
const referenceInterestGroupTraits = loadReferenceInterestGroupTraits(referenceDatabase);
const results = [];

for (const databaseDirRaw of databaseDirs) {
  const databaseDir = path.resolve(databaseDirRaw);
  const indexFile = path.join(databaseDir, "index.json");
  if (!fs.existsSync(indexFile)) continue;

  const index = readJson(indexFile);
  let totalNameFixes = 0;
  let addedInterestGroupTraits = 0;
  const touchedFiles = [];

  for (const [fileKey, relativeFile] of Object.entries(index.files || {})) {
    if (!relativeFile) continue;
    const file = path.join(databaseDir, relativeFile);
    if (!fs.existsSync(file)) continue;

    const data = readJson(file);
    const nameFixes = fixObjectNames(data, localization);
    const addedTraits = fileKey === "interest_group_traits"
      ? addReferencedInterestGroupTraits(databaseDir, data, referenceInterestGroupTraits)
      : 0;

    if (nameFixes || addedTraits) {
      writeJson(file, data);
      touchedFiles.push(relativeFile);
      totalNameFixes += nameFixes;
      addedInterestGroupTraits += addedTraits;

      if (fileKey === "interest_group_traits") {
        index.counts = index.counts || {};
        index.counts.interest_group_traits = Array.isArray(data) ? data.length : index.counts.interest_group_traits;
      }
    }
  }

  if (addedInterestGroupTraits) {
    writeJson(indexFile, index);
    touchedFiles.push("index.json");
  }

  results.push({
    database: databaseDir,
    name_fixes: totalNameFixes,
    added_interest_group_traits: addedInterestGroupTraits,
    touched_files: [...new Set(touchedFiles)].sort(),
  });
}

console.log(JSON.stringify({ results }, null, 2));

function fixObjectNames(value, localizationMap) {
  let count = 0;

  function visit(item) {
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    if (!item || typeof item !== "object") return;

    if (
      typeof item.key === "string"
      && item.key
      && item.name_zh === item.key
      && localizationMap.has(item.key)
    ) {
      item.name_zh = localizationMap.get(item.key);
      count += 1;
    }

    for (const child of Object.values(item)) visit(child);
  }

  visit(value);
  return count;
}

function addReferencedInterestGroupTraits(databaseDir, traits, referenceTraits) {
  if (!Array.isArray(traits)) return 0;
  const existingKeys = new Set(traits.map((trait) => trait.key).filter(Boolean));
  const referencedKeys = new Set();

  for (const file of databaseJsonFiles(databaseDir)) {
    collectReferencedInterestGroupTraitKeys(readJson(file), referencedKeys);
  }

  let added = 0;
  for (const key of [...referencedKeys].sort()) {
    if (existingKeys.has(key)) continue;
    const reference = referenceTraits.get(key);
    if (!reference) continue;
    traits.push(reference);
    existingKeys.add(key);
    added += 1;
  }

  if (added) {
    traits.sort((a, b) => a.key.localeCompare(b.key));
  }
  return added;
}

function collectReferencedInterestGroupTraitKeys(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) collectReferencedInterestGroupTraitKeys(item, out);
    return;
  }
  if (!value || typeof value !== "object") return;

  if (
    typeof value.key === "string"
    && value.key.startsWith("ig_")
    && value.id === `interest_group_trait:${value.key}`
  ) {
    out.add(value.key);
  }

  for (const child of Object.values(value)) collectReferencedInterestGroupTraitKeys(child, out);
}

function databaseJsonFiles(databaseDir) {
  const index = readJson(path.join(databaseDir, "index.json"));
  return Object.values(index.files || {})
    .filter((file) => file && file.endsWith(".json"))
    .map((file) => path.join(databaseDir, file))
    .filter((file) => fs.existsSync(file));
}

function loadReferenceInterestGroupTraits(databaseDir) {
  const file = path.join(databaseDir, "interest_group_traits.json");
  if (!fs.existsSync(file)) return new Map();
  const rows = readJson(file);
  return new Map(rows.map((row) => [row.key, row]));
}

function loadLocalization(dir) {
  const loc = new Map();
  const files = listFiles(dir, ".yml");
  const linePattern = /^\s*([^#\s:]+):(?:\d+)?\s*"((?:\\.|[^"\\])*)"\s*(?:#.*)?$/;
  for (const file of files) {
    const text = readText(file);
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(linePattern);
      if (!match) continue;
      loc.set(match[1], match[2].replace(/\\"/g, "\""));
    }
  }
  return loc;
}

function listFiles(target, suffix = ".txt") {
  if (!target || !fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return path.basename(target).endsWith(suffix) ? [target] : [];
  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, suffix));
    if (entry.isFile() && entry.name.endsWith(suffix)) out.push(full);
  }
  return out.sort();
}

function resolveContentRoot(sourcePath) {
  const resolved = path.resolve(sourcePath);
  if (fs.existsSync(path.join(resolved, "game", "common"))) return path.join(resolved, "game");
  return resolved;
}

function readText(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function readJson(file) {
  return JSON.parse(readText(file));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `\uFEFF${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function getListArg(value) {
  return String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
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
  console.log(`Usage: node scripts/fix_localization_gaps.mjs [options]

Options:
  --game-path <path>           Victoria 3 install path, default ${DEFAULT_GAME_PATH}
  --database <path>            Database directory to patch, default database/vic3_1.13.9
  --databases <list>           Semicolon-separated database directories
  --reference-database <path>  Database used for full interest group trait rows, default database/vic3_1.13.9
  --help                       Show this help
`);
}
