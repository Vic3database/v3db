import fs from "node:fs";
import path from "node:path";

const databaseDirs = process.argv.slice(2);

if (!databaseDirs.length) {
  console.error("Usage: node scripts/fix_company_technology_requirements.mjs <database-dir> [...]");
  process.exit(1);
}

let updatedCount = 0;

for (const databaseDir of databaseDirs) {
  const companiesFile = path.join(databaseDir, "companies.json");
  if (!fs.existsSync(companiesFile)) {
    console.warn(`Skipping missing file: ${companiesFile}`);
    continue;
  }
  const companies = readJson(companiesFile);
  let changed = false;
  for (const company of companies) {
    const nameByKey = technologyNameMap(company);
    const required = refsFromRaw(company.possible_raw, nameByKey);
    const ai = refsFromRaw(company.ai_will_do_raw, nameByKey);
    if (JSON.stringify(company.required_technologies || []) !== JSON.stringify(required)) {
      company.required_technologies = required;
      changed = true;
    }
    if (JSON.stringify(company.ai_will_do_technologies || []) !== JSON.stringify(ai)) {
      company.ai_will_do_technologies = ai;
      changed = true;
    }
  }
  if (changed) {
    writeJson(companiesFile, companies);
    updatedCount += 1;
  }
  console.log(JSON.stringify({
    database: path.resolve(databaseDir),
    companies: companies.length,
    changed,
  }));
}

console.log(JSON.stringify({
  updated_databases: updatedCount,
}, null, 2));

function refsFromRaw(raw, nameByKey) {
  const keys = unique([...String(raw || "").matchAll(/\bhas_technology_researched\s*=\s*([A-Za-z0-9_-]+)/g)]
    .map((match) => stripPrefix(match[1])));
  return keys.sort().map((key) => ({
    key,
    name_zh: nameByKey.get(key) || key,
  }));
}

function technologyNameMap(company) {
  const nameByKey = new Map();
  for (const ref of [
    ...(company.required_technologies || []),
    ...(company.ai_will_do_technologies || []),
  ]) {
    if (ref?.key && ref?.name_zh) nameByKey.set(ref.key, ref.name_zh);
  }
  return nameByKey;
}

function stripPrefix(value) {
  return String(value || "").replace(/^[a-z]+:/, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
