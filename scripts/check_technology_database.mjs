import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const version = process.env.VICTORIA3_VERSION || "1.13.11";
const databaseDir = path.join(process.cwd(), "database", `vic3_${version}`);
const index = readJson(path.join(databaseDir, "index.json"));
const locales = Object.fromEntries(["zh-Hans", "en"].map((locale) => [locale, readJson(path.join(databaseDir, "locales", `${locale}.json`))]));

assert.equal(index.files?.technologies, "technologies.json", "database index must declare technologies.json");
assert.equal(index.files?.technology_eras, "technology_eras.json", "database index must declare technology_eras.json");
assert.equal(index.files?.combat_unit_types, "combat_unit_types.json", "database index must declare combat_unit_types.json");
assert.equal(index.files?.ship_types, "ship_types.json", "database index must declare ship_types.json");
assert.equal(index.files?.mobilization_options, "mobilization_options.json", "database index must declare mobilization_options.json");
assert.equal(index.files?.diplomatic_actions, "diplomatic_actions.json", "database index must declare diplomatic_actions.json");
assert.equal(index.files?.treaty_articles, "treaty_articles.json", "database index must declare treaty_articles.json");

const technologies = readJson(path.join(databaseDir, index.files.technologies));
const eras = readJson(path.join(databaseDir, index.files.technology_eras));
const combatUnitTypes = readJson(path.join(databaseDir, index.files.combat_unit_types));
const shipTypes = readJson(path.join(databaseDir, index.files.ship_types));
const mobilizationOptions = readJson(path.join(databaseDir, index.files.mobilization_options));
const diplomaticActions = readJson(path.join(databaseDir, index.files.diplomatic_actions));
const treatyArticles = readJson(path.join(databaseDir, index.files.treaty_articles));
const expectedCosts = [7500, 10000, 12500, 15000, 17500];

assert.equal(eras.length, 5, "database must contain five technology eras");
assert.deepEqual(eras.map((era) => era.key), ["era_1", "era_2", "era_3", "era_4", "era_5"], "technology era keys must be stable");
assert.deepEqual(eras.map((era) => era.cost), expectedCosts, "technology era costs must match game definitions");
assert(technologies.length > 0, "database must contain technologies");
assert(combatUnitTypes.length > 0, "database must contain land combat unit types");
assert(shipTypes.length > 0, "database must contain naval ship types");
assert(mobilizationOptions.length > 0, "database must contain mobilization options");
assert(diplomaticActions.length > 0, "database must contain diplomatic actions");
assert(treatyArticles.length > 0, "database must contain treaty articles");
assert(combatUnitTypes.some((item) => item.key === "combat_unit_type_line_infantry" && item.icon?.source), "line infantry must expose an icon source");
assert(shipTypes.some((item) => item.key === "ship_type_submarine" && item.icon?.source), "submarine must expose an icon source");

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
  for (const key of ["id", "key", "icon", "category", "era", "era_cost", "prerequisites", "unlocks", "modifiers", "source_file", "loc"]) {
    assert(Object.hasOwn(technology, key), `${technology.key || "technology"} must contain ${key}`);
  }
  for (const field of ["name", "description", "category", "eraLabel", "modifierSummary"]) {
    assert(technology.loc?.[field], `${technology.key} must declare loc.${field}`);
  }
  for (const locale of ["zh-Hans", "en"]) {
    assert(locales[locale][technology.loc.name], `${technology.key} must have a ${locale} name`);
    assert(Object.hasOwn(locales[locale], technology.loc.description), `${technology.key} description message must exist in ${locale}`);
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
  for (const law of technology.references.laws) assert(law.key && law.loc?.name, `${technology.key} law reference must be localized`);
  for (const company of technology.references.companies) assert(company.key && company.loc?.name, `${technology.key} company reference must be localized`);
  assert(Array.isArray(technology.references.production_methods), `${technology.key} must expose production method references`);
  assert(Array.isArray(technology.references.buildings), `${technology.key} must expose building references`);
  assert(Array.isArray(technology.references.combat_units), `${technology.key} must expose land combat unit references`);
  assert(Array.isArray(technology.references.ship_types), `${technology.key} must expose naval ship references`);
  assert(Array.isArray(technology.references.mobilization_options), `${technology.key} must expose mobilization option references`);
  assert(Array.isArray(technology.references.diplomatic_actions), `${technology.key} must expose diplomatic action references`);
  assert(Array.isArray(technology.references.treaty_articles), `${technology.key} must expose treaty article references`);
}

console.log(JSON.stringify({
  technology_database: "ok",
  technologies: technologies.length,
  combat_unit_types: combatUnitTypes.length,
  ship_types: shipTypes.length,
  mobilization_options: mobilizationOptions.length,
  diplomatic_actions: diplomaticActions.length,
  treaty_articles: treatyArticles.length,
  categories: Object.fromEntries(["production", "military", "society"].map((key) => [key, technologies.filter((technology) => technology.category === key).length])),
}, null, 2));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}
