import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const databaseDir = path.join(root, "database", "vic3_1.13.9");
const siteRoot = path.join(root, "site");
const index = readJson(path.join(databaseDir, "index.json"));
const collections = [
  ["buildings", "buildings"],
  ["goods", "goods"],
  ["prestige_goods", "prestige-goods"],
  ["production_methods", "production-methods"],
];
const counts = {};
for (const [fileKey, category] of collections) {
  const rows = readJson(path.join(databaseDir, index.files[fileKey]));
  const withIcons = rows.filter((row) => row?.icon?.source);
  for (const row of withIcons) {
    const file = path.join(siteRoot, "assets", category, `${row.key}.webp`);
    assert(fs.statSync(file, { throwIfNoEntry: false })?.isFile(), `missing ${category} asset: ${row.key}`);
  }
  counts[category] = withIcons.length;
}
console.log(JSON.stringify({ economy_asset_coverage: "ok", counts }, null, 2));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}
