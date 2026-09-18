import fs from "node:fs";
import path from "node:path";

const pairs = [
  [process.argv[2], process.argv[3]],
  [process.argv[4], process.argv[5]],
  [process.argv[6], process.argv[7]],
].filter(([source, target]) => source && target);
if (!pairs.length) throw new Error("Usage: node scripts/merge_population_database_fields.mjs <source-database> <target-database> [...]");

for (const [sourceDir, targetDir] of pairs) {
  const source = path.resolve(sourceDir);
  const target = path.resolve(targetDir);
  const populationFiles = ["countries.json", "state_regions.json", "strategic_regions.json", "geographic_regions.json", "cultures.json", "religions.json"];
  const fieldsByFile = {
    "countries.json": ["tag", "starting_population"],
    "state_regions.json": ["key", "starting_population"],
    "strategic_regions.json": ["key", "starting_population"],
    "geographic_regions.json": ["key", "starting_population"],
    "cultures.json": ["key", "starting_population"],
    "religions.json": ["key", "starting_population"],
  };
  for (const file of populationFiles) {
    const [keyField, valueField] = fieldsByFile[file];
    const sourceRows = readJson(path.join(source, file));
    const valueByKey = new Map(sourceRows.map((row) => [row[keyField], row[valueField] ?? null]));
    const targetRows = readJson(path.join(target, file)).map((row) => ({ ...row, [valueField]: valueByKey.get(row[keyField]) ?? null }));
    writeJson(path.join(target, file), targetRows);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `\uFEFF${JSON.stringify(value, null, 2)}\n`, "utf8");
}
