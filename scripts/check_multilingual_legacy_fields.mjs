import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = [
  path.join(root, "site", "app"),
];
const dataChunkRoots = [
  path.join(root, "site", "versions", "1.13.9"),
  path.join(root, "Victorian Century Database"),
  path.join(root, "site", "vc"),
];
const forbidden = [
  "name_zh", "name_en", "tierZh", "tier_zh", "countryTypeZh", "country_type_zh", "group_name_zh", "source_name_zh", "dlc_name_zh", "type_zh",
  "mapi_value_zh", "mapi_value_en",
  "hydrateLegacyLocalizedFields",
];
const files = [
  ...scanRoots.flatMap((directory) => collectJavaScriptFiles(directory)),
  ...dataChunkRoots.flatMap((directory) => collectDataChunkFiles(directory)),
];
const violations = [];

for (const file of files) {
  const relative = path.relative(root, file).replace(/\\/g, "/");
  const source = fs.readFileSync(file, "utf8");
  for (const field of forbidden) {
    const index = source.indexOf(field);
    if (index < 0) continue;
    const line = 1 + (source.slice(0, index).match(/\n/g)?.length || 0);
    violations.push(`${relative}:${line}: ${field}`);
  }
}

assert.deepEqual(violations, [], `legacy localized fields remain:\n${violations.join("\n")}`);
console.log(JSON.stringify({ multilingual_legacy_fields: "ok", files: files.length }));

function collectJavaScriptFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectJavaScriptFiles(file);
    if (!entry.isFile() || !entry.name.endsWith(".js")) return [];
    if (entry.name.startsWith("locale-") || entry.name === "search-index.js") return [];
    return [file];
  });
}

function collectDataChunkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^data-.+\.js$/.test(entry.name))
    .map((entry) => path.join(directory, entry.name));
}
