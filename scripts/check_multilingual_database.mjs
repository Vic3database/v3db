import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const databaseDir = path.resolve(args.database || "database/vic3_1.13.9");
const index = readJson(path.join(databaseDir, "index.json"));
const zh = readJson(path.join(databaseDir, index.locales?.files?.["zh-Hans"]?.file || "locales/zh-Hans.json"));
const en = readJson(path.join(databaseDir, index.locales?.files?.en?.file || "locales/en.json"));

assert.deepEqual(index.locales?.supported, ["zh-Hans", "en"], "index.locales.supported must list simplified Chinese and English");
for (const locale of index.locales.supported) {
  const entry = index.locales.files?.[locale];
  assert(entry?.file && entry.sha256, `${locale} requires a file and SHA-256`);
  assert.equal(typeof entry.missing, "object", `${locale} requires per-collection missing counts`);
}

const database = Object.fromEntries(Object.entries(index.files || {}).map(([collection, file]) => [collection, readJson(path.join(databaseDir, file))]));
const samples = [
  ["countries", "country:PRU", "Prussia"],
  ["cultures", "culture:north_german", "North German"],
  ["state_regions", "state_region:STATE_BRANDENBURG", "Brandenburg"],
  ["companies", "company:company_a_markwald_and_company", "A. Markwald & Company, Ltd."],
  ["ideologies", "ideology:ideology_laissez_faire", "Laissez-Faire"],
  ["laws", "law:law_professional_army", "Professional Army"],
  ["technologies", "technology:academia", "Academia"],
  ["achievements", "achievement:victorian_century", "Victorian Century"],
];
for (const [collection, id, expectedEnglish] of samples) {
  const row = database[collection]?.find((item) => item.id === id);
  assert(row?.loc?.name, `${id} lacks a name localization reference`);
  assert.equal(en[row.loc.name], expectedEnglish);
  assert(zh[row.loc.name] && zh[row.loc.name] !== row.loc.name, `${id} lacks simplified Chinese`);
}
const sampleCompany = database.companies.find((item) => item.id === "company:company_a_markwald_and_company");
assert.equal(en[sampleCompany.loc.companyKind], "Historical Company");
assert.equal(en[sampleCompany.loc.prestigeGoodsKind], "Generic Prestige Goods");
assert.equal(en[sampleCompany.loc.dlcName], "Victoria 3");
const categorizedCompany = database.companies.find((item) => item.key === "company_argentinian_wine");
assert.equal(en[categorizedCompany.loc.category], "Partial Shopkeeper Ownership");
assertNoFixedLocaleFields(database);

console.log(JSON.stringify({
  multilingual_database: "ok",
  locales: index.locales.supported,
  samples: samples.length,
}, null, 2));

function assertNoFixedLocaleFields(value, currentPath = "$") {
  if (Array.isArray(value)) return value.forEach((item, index) => assertNoFixedLocaleFields(item, `${currentPath}[${index}]`));
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(/(?:^|_)(?:zh|en)(?:$|_)/i.test(key) || /^(?:name|desc|description|summary|type)_zh$/i.test(key), false, `${currentPath}.${key} is a fixed locale field`);
    assertNoFixedLocaleFields(child, `${currentPath}.${key}`);
  }
}

function readJson(file) {
  assert(fs.existsSync(file), `missing ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    result[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}
