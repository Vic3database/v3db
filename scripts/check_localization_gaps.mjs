import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const databaseDirs = getListArg(args.database || args.databases || "database/vic3_1.13.9");
const failures = [];
const results = [];

for (const databaseDirRaw of databaseDirs) {
  const databaseDir = path.resolve(databaseDirRaw);
  const indexFile = path.join(databaseDir, "index.json");
  if (!fs.existsSync(indexFile)) {
    failures.push(`${databaseDir} missing index.json`);
    continue;
  }

  const index = readJson(indexFile);
  const files = Object.values(index.files || {})
    .filter(Boolean)
    .map((file) => path.join(databaseDir, file));
  const unresolved = [];

  for (const file of files) {
    if (!fs.existsSync(file)) {
      failures.push(`${databaseDir} missing ${path.basename(file)}`);
      continue;
    }
    findUnresolvedNames(readJson(file), path.basename(file), [], unresolved);
  }

  results.push({
    database: databaseDir,
    unresolved,
  });

  if (unresolved.length) {
    const sample = unresolved
      .slice(0, 50)
      .map((item) => `${item.file} ${item.path} ${item.key}`)
      .join("\n");
    failures.push(`${databaseDir} has ${unresolved.length} unresolved Chinese names:\n${sample}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  checked_databases: results.map((item) => item.database),
  unresolved_name_count: 0,
}, null, 2));

function findUnresolvedNames(value, file, pathParts, out) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findUnresolvedNames(item, file, pathParts.concat(index), out));
    return;
  }
  if (!value || typeof value !== "object") return;

  if (
    typeof value.key === "string"
    && value.key
    && typeof value.name_zh === "string"
    && value.name_zh === value.key
  ) {
    out.push({
      file,
      path: pathParts.join("."),
      key: value.key,
      id: value.id || "",
    });
  }

  for (const [key, child] of Object.entries(value)) {
    findUnresolvedNames(child, file, pathParts.concat(key), out);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
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
  console.log(`Usage: node scripts/check_localization_gaps.mjs [options]

Options:
  --database <path>   Database directory to check, default database/vic3_1.13.9
  --databases <list>  Semicolon-separated database directories
  --help              Show this help
`);
}
