import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const databaseDir = path.join(process.cwd(), "database", "vic3_1.13.9");
const index = readJson(path.join(databaseDir, "index.json"));

assert.equal(index.files?.technologies, "technologies.json", "database index must declare technologies.json");
assert.equal(index.files?.technology_eras, "technology_eras.json", "database index must declare technology_eras.json");

const technologies = readJson(path.join(databaseDir, index.files.technologies));
const eras = readJson(path.join(databaseDir, index.files.technology_eras));
const expectedCosts = [7500, 10000, 12500, 15000, 17500];

assert.equal(eras.length, 5, "database must contain five technology eras");
assert.deepEqual(eras.map((era) => era.key), ["era_1", "era_2", "era_3", "era_4", "era_5"], "technology era keys must be stable");
assert.deepEqual(eras.map((era) => era.cost), expectedCosts, "technology era costs must match game definitions");
assert(technologies.length > 0, "database must contain technologies");

const byKey = new Map(technologies.map((technology) => [technology.key, technology]));
assert.deepEqual(
  [...new Set(technologies.map((technology) => technology.category))].sort(),
  ["military", "production", "society"],
  "database must contain every technology category",
);
assert.deepEqual(
  [...new Set(technologies.map((technology) => technology.era))].sort(),
  ["era_1", "era_2", "era_3", "era_4", "era_5"],
  "database must contain every technology era",
);

for (const technology of technologies) {
  for (const key of ["id", "key", "name_zh", "desc_zh", "icon", "category", "category_zh", "era", "era_cost", "prerequisites", "unlocks", "modifiers", "source_file"]) {
    assert(Object.hasOwn(technology, key), `${technology.key || "technology"} must contain ${key}`);
  }
  assert.match(technology.icon, /^gfx\/interface\/icons\/invention_icons\//, `${technology.key} icon must use invention icon assets`);
  assert.equal(technology.era_cost, eras.find((era) => era.key === technology.era)?.cost, `${technology.key} era cost must match its era`);
  for (const prerequisiteKey of technology.prerequisites) {
    const prerequisite = byKey.get(prerequisiteKey);
    assert(prerequisite, `${technology.key} prerequisite ${prerequisiteKey} must resolve`);
    assert(prerequisite.unlocks.some((item) => item.key === technology.key), `${technology.key} must appear in ${prerequisiteKey} unlocks`);
  }
  for (const unlock of technology.unlocks) {
    const unlocked = byKey.get(unlock.key);
    assert(unlocked?.prerequisites.includes(technology.key), `${technology.key} unlock ${unlock.key} must retain reverse prerequisite`);
  }
  for (const law of technology.references.laws) assert(law.key && law.name_zh, `${technology.key} law reference must be labeled`);
  for (const company of technology.references.companies) assert(company.key && company.name_zh, `${technology.key} company reference must be labeled`);
}

console.log(JSON.stringify({
  technology_database: "ok",
  technologies: technologies.length,
  categories: Object.fromEntries(["production", "military", "society"].map((key) => [key, technologies.filter((technology) => technology.category === key).length])),
}, null, 2));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}
