import fs from "node:fs";
import path from "node:path";
import { sha256Text } from "./lib/localization-schema.mjs";

const DEFAULT_GAME_PATH = "D:\\SteamLibrary\\steamapps\\common\\Victoria 3";
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}
if (!["zh-Hans", "en"].includes(args.locale)) throw new Error("--locale zh-Hans or --locale en is required");

const databaseDir = path.resolve(args.database || "database/vic3_1.13.9");
const indexFile = path.join(databaseDir, "index.json");
const index = readJson(indexFile);
const locale = args.locale;
const catalogEntry = index.locales?.files?.[locale];
if (!catalogEntry) throw new Error(`${databaseDir} does not declare ${locale}`);
const catalogFile = path.join(databaseDir, catalogEntry.file);
const catalog = readJson(catalogFile);
const contentRoot = resolveContentRoot(path.resolve(args["game-path"] || DEFAULT_GAME_PATH));
const source = loadLocalization(path.join(contentRoot, "localization", locale === "en" ? "english" : "simp_chinese"));
let fixed = 0;

for (const [messageId, value] of Object.entries(catalog)) {
  if (value) continue;
  const gameKey = messageId.split(".")[0].split(":").at(-1);
  const field = messageId.split(".").at(-1);
  const lookup = field === "description" ? `${gameKey}_desc` : gameKey;
  if (!source.has(lookup)) continue;
  catalog[messageId] = source.get(lookup);
  fixed += 1;
}

const sourceText = `\uFEFF${JSON.stringify(catalog, null, 2)}\n`;
fs.writeFileSync(catalogFile, sourceText, "utf8");
catalogEntry.sha256 = sha256Text(sourceText);
catalogEntry.missing = { total: Object.values(catalog).filter((value) => !value).length };
writeJson(indexFile, index);
console.log(JSON.stringify({ locale, fixed, remaining_missing: catalogEntry.missing.total }, null, 2));

function loadLocalization(dir) {
  const result = new Map();
  for (const file of listFiles(dir)) {
    for (const line of fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const match = line.match(/^\s*([^#\s:]+):(?:\d+)?\s*"((?:\\.|[^"\\])*)"/);
      if (match) result.set(match[1], match[2].replace(/\\"/g, '"'));
    }
  }
  return result;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(file) : entry.name.endsWith(".yml") ? [file] : [];
  });
}

function resolveContentRoot(sourcePath) {
  return fs.existsSync(path.join(sourcePath, "game", "common")) ? path.join(sourcePath, "game") : sourcePath;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `\uFEFF${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith("--")) continue;
    const key = argv[index].slice(2);
    const next = argv[index + 1];
    result[key] = !next || next.startsWith("--") ? true : next;
    if (result[key] !== true) index += 1;
  }
  return result;
}

function printHelp() {
  console.log(`Usage: node scripts/fix_localization_gaps.mjs --locale <zh-Hans|en> [options]

Options:
  --locale <locale>       Required language catalog to repair
  --game-path <path>      Victoria 3 install path, default ${DEFAULT_GAME_PATH}
  --database <path>       Database directory, default database/vic3_1.13.9
  --help                  Show this help`);
}
