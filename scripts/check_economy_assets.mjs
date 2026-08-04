import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = parseArgs(process.argv.slice(2));
const databaseDir = path.resolve(args.database || path.join(root, "database", "vic3_1.13.9"));
const siteRoot = path.resolve(args.site || path.join(root, "site"));
const index = readJson(path.join(databaseDir, "index.json"));
const sourceRoots = [
  { kind: "mod", root: index.source_paths?.mod_data },
  { kind: "game", root: index.source_paths?.game_data },
].filter((item) => item.root).map((item) => ({ ...item, root: path.resolve(item.root) }));
const collections = [
  ["buildings", "buildings"],
  ["goods", "goods"],
  ["prestige_goods", "prestige-goods"],
  ["production_methods", "production-methods"],
];
const counts = {};
const expectedAssets = [];
for (const [fileKey, category] of collections) {
  const rows = readJson(path.join(databaseDir, index.files[fileKey]));
  const withIcons = rows.filter((row) => row?.icon?.source);
  for (const row of withIcons) {
    const resolved = resolveIconSource(row.icon.source);
    const file = path.join(siteRoot, "assets", category, `${row.key}.webp`);
    assert(fs.statSync(file, { throwIfNoEntry: false })?.isFile(), `missing ${category} asset: ${row.key}`);
    expectedAssets.push({
      category,
      key: row.key,
      source_kind: resolved.kind,
      source: normalizeRelative(row.icon.source),
      target: `assets/${category}/${row.key}.webp`,
    });
  }
  counts[category] = withIcons.length;
}
expectedAssets.sort(compareAsset);
const manifest = readJson(path.join(siteRoot, "assets", "economy-assets.json"));
assert.equal(manifest.schema_version, 1, "economy asset manifest schema must be 1");
assert.deepEqual(manifest.assets, expectedAssets, "economy asset manifest must match database icons and resolved sources");
console.log(JSON.stringify({ economy_asset_coverage: "ok", counts }, null, 2));

function parseArgs(values) {
  const parsed = { database: "", site: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (["--database", "--site"].includes(value)) {
      parsed[value.slice(2)] = values[index + 1] || "";
      if (!parsed[value.slice(2)]) throw new Error(`Missing value for ${value}`);
      index += 1;
    } else if (value === "--help" || value === "-h") {
      console.log("Usage: node scripts/check_economy_assets.mjs [--database <dir>] [--site <dir>]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}

function resolveIconSource(relative) {
  const parts = normalizeRelative(relative).split("/");
  for (const item of sourceRoots) {
    const candidate = path.join(item.root, ...parts);
    if (fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) return item;
  }
  throw new Error(`Missing economy icon source: ${relative}`);
}

function normalizeRelative(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\/+/, "");
}

function compareAsset(left, right) {
  return left.category.localeCompare(right.category) || left.key.localeCompare(right.key);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}
