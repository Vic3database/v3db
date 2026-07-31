import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const databaseDirs = getListArg(args.database || args.databases || "database/vic3_1.13.9");
const results = [];

for (const rawDir of databaseDirs) {
  const databaseDir = path.resolve(rawDir);
  const index = readJson(path.join(databaseDir, "index.json"));
  const locales = index.locales?.supported || [];
  if (!locales.includes("zh-Hans") || !locales.includes("en")) {
    throw new Error(`${databaseDir} lacks bilingual index.locales metadata`);
  }
  const catalogs = Object.fromEntries(locales.map((locale) => [
    locale,
    readJson(path.join(databaseDir, index.locales.files[locale].file)),
  ]));
  const refs = new Set();
  for (const file of Object.values(index.files || {})) collectRefs(readJson(path.join(databaseDir, file)), refs);
  const missing = Object.fromEntries(locales.map((locale) => [
    locale,
    [...refs].filter((key) => !catalogs[locale][key]),
  ]));
  results.push({
    database: databaseDir,
    referenced_messages: refs.size,
    missing: {
      "zh-Hans": missing["zh-Hans"].length,
      en: missing.en.length,
      both: missing["zh-Hans"].filter((key) => missing.en.includes(key)).length,
    },
  });
}

console.log(JSON.stringify({ localization_gaps: results }, null, 2));

function collectRefs(value, refs) {
  if (Array.isArray(value)) return value.forEach((item) => collectRefs(item, refs));
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (key === "loc" && item && typeof item === "object") {
      Object.values(item).forEach((message) => { if (typeof message === "string") refs.add(message); });
      continue;
    }
    if (key === "message" && typeof item === "string") refs.add(item);
    collectRefs(item, refs);
  }
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function getListArg(value) {
  return String(value || "").split(";").map((item) => item.trim()).filter(Boolean);
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
