import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

const root = process.cwd();
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-primary-culture-expansion-"));
const database = path.join(temporaryRoot, "database");
const site = path.join(temporaryRoot, "site");

try {
  fs.mkdirSync(database, { recursive: true });
  writeFixtureDatabase(database);

  run("scripts/primary_culture_expansions.mjs", ["--database", database]);
  const expansions = readJson(path.join(database, "primary_culture_expansions.json"));

  assert.equal(expansions.schema_version, 1);
  assert.equal(expansions.methodology, "maximum_reachable_union");
  assert.deepEqual(expansions.countries.JAP.starting_primary_cultures, ["japanese"]);
  assert.deepEqual(expansions.countries.JAP.added_primary_cultures, ["ainu"]);
  assert.deepEqual(expansions.countries.JAP.maximum_primary_cultures, ["ainu", "japanese"]);
  assert.deepEqual(expansions.countries.JAP.maximum_primary_culture_sets, [["ainu", "japanese"]]);
  assert.deepEqual(expansions.countries.USA.maximum_primary_cultures, ["afro_american", "dixie", "yankee"]);
  assert.equal(expansions.countries.USA.primary_culture_replacements.length, 0);
  assert.deepEqual(expansions.countries.AUS.maximum_primary_cultures, ["czech", "slovak", "south_german"]);
  assert.deepEqual(expansions.countries.ARG.added_primary_cultures, []);
  assert.deepEqual(expansions.countries.ARG.maximum_primary_cultures, ["platinean"]);
  assert.deepEqual(expansions.countries.ARG.primary_culture_replacements, [{
    added_culture: "argentine",
    removed_culture: "platinean",
    content_type: "event",
    content_id: "culture_south_america.1",
    source_file: "events/brazil/culture_south_america.txt",
    source_line: 4,
  }]);
  assert.deepEqual(expansions.countries.BRZ.maximum_primary_cultures, ["brazilian", "portuguese"]);
  assert.equal(expansions.countries.GBR.maximum_primary_cultures, null);
  assert.deepEqual(expansions.countries.GBR.maximum_primary_culture_sets, [
    ["anglo_canadian", "british"],
    ["australian", "british"],
  ]);
  assert.deepEqual(expansions.countries.GBR.primary_culture_option_groups, [{
    id: "british_relocation",
    options: [
      { id: "canada", added_primary_cultures: ["anglo_canadian"] },
      { id: "australia", added_primary_cultures: ["australian"] },
    ],
  }]);
  assert.equal(expansions.countries.CHI, undefined);

  const japanPath = expansions.countries.JAP.paths[0];
  assert.deepEqual(japanPath, {
    culture: "ainu",
    content_type: "event",
    content_id: "hokkaido_events.6",
    effect_kind: "add_primary_culture",
    source_file: "events/japan_events/ep2_hokkaido_events.txt",
    source_line: 968,
  });
  assert.ok(expansions.countries.AUS.paths.some((item) => item.effect_kind === "scripted_effect" && item.culture === "czech"));
  assert.ok(expansions.countries.BRZ.paths.some((item) => item.content_id === "lusofonia.3" && item.culture === "portuguese"));
  assert.equal(expansions.unresolved_effects.length, 0);
  assert.deepEqual(expansions.conditional_effects, [{
    content_type: "event",
    content_id: "boxer_rebellion_events.4",
    added_culture: "han",
    removed_culture: "manchu",
    eligible_when: { primary_cultures_any: ["han", "manchu"] },
    source_file: "events/boxer_rebellion_events.txt",
    source_line: 331,
  }]);

  const index = readJson(path.join(database, "index.json"));
  assert.equal(index.files.primary_culture_expansions, "primary_culture_expansions.json");

  run("scripts/build_wiki.mjs", ["--database", database, "--out", site]);
  const countryChunks = fs.readdirSync(site)
    .filter((file) => /^data-countries-\d+\.js$/.test(file))
    .sort()
    .map((file) => readGlobal(path.join(site, file), "VIC3_DATA_CHUNK"));
  const countriesByTag = new Map(countryChunks.flatMap((chunk) => chunk.countries).map((country) => [country.tag, country]));
  const austria = countriesByTag.get("AUS");
  assert.deepEqual([...austria.maximumPrimaryCultures], ["czech", "slovak", "south_german"]);
  assert.equal(austria.hasPrimaryCultureExpansions, true);
  assert.ok(austria.primaryCultureExpansionPaths.some((item) => item.effect_kind === "scripted_effect" && item.culture === "slovak"));
  const argentina = countriesByTag.get("ARG");
  assert.equal(argentina.hasPrimaryCultureExpansions, false);
  assert.equal(argentina.primaryCultureReplacementPaths[0].added_culture, "argentine");
  assert.deepEqual(JSON.parse(JSON.stringify(countriesByTag.get("GBR").maximumPrimaryCultureSets)), [
    ["anglo_canadian", "british"],
    ["australian", "british"],
  ]);
  assert.equal(countriesByTag.get("GBR").maximumPrimaryCultures, null);

  console.log("primary culture expansion data contract passed");
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  assert.equal(result.status, 0, `${script} failed:\n${result.stdout}\n${result.stderr}`.trim());
}

function writeFixtureDatabase(directory) {
  const cultures = ["ainu", "afro_american", "anglo_canadian", "argentine", "australian", "brazilian", "british", "czech", "dixie", "han", "japanese", "manchu", "platinean", "portuguese", "slovak", "south_german", "yankee"].map((key) => ({ key }));
  const countries = [
    country("ARG", ["platinean"]),
    country("AUS", ["south_german"]),
    country("BRZ", ["brazilian"]),
    country("CHI", ["manchu"]),
    country("GBR", ["british"]),
    country("JAP", ["japanese"]),
    country("USA", ["yankee", "dixie"]),
  ];
  const events = [
    event("hokkaido_events.6", "events/japan_events/ep2_hokkaido_events.txt", 968, "option = { add_primary_culture = cu:ainu }"),
    event("acw_je_events.3", "events/american_civil_war/acw_je_events.txt", 280, "option = { add_primary_culture = cu:afro_american }"),
    event("austria_federation.3", "events/balkans_events/austria_federalism.txt", 783, "option = { danubian_federation_integrate_culture = { CULTURE = cu:czech } danubian_federation_integrate_culture = { CULTURE = cu:slovak } }"),
    event("culture_south_america.1", "events/brazil/culture_south_america.txt", 4, "if = { limit = { c:ARG ?= this } add_primary_culture = cu:argentine remove_primary_culture = cu:platinean }"),
    event("independent_conditions", "events/independent_conditions.txt", 1, "option = { if = { add_primary_culture = cu:afro_american } if = { remove_primary_culture = cu:dixie } }", ["USA"]),
    event("lusofonia.3", "events/iberia_events/ip4_lusosphere_events.txt", 189, "c:BRZ ?= { add_primary_culture = cu:portuguese }"),
    event("joi_flavor_gbr.92", "events/joi_flavor_gbr.txt", 8938, "option = { add_primary_culture = cu:anglo_canadian } option = { add_primary_culture = cu:australian }"),
    event("boxer_rebellion_events.4", "events/boxer_rebellion_events.txt", 331, "option = { add_primary_culture = cu:han remove_primary_culture = cu:manchu }"),
  ];
  const emptyCollections = {
    culture_traits: [],
    culture_trait_groups: [],
    state_regions: [],
    strategic_regions: [],
    geographic_regions: [],
    companies: [],
    company_charter_types: [],
    interest_groups: [],
    interest_group_traits: [],
    ideologies: [],
    law_groups: [],
    laws: [],
    technologies: [],
    technology_eras: [],
    achievements: [],
    buildings: [],
    building_groups: [],
    production_method_groups: [],
    production_methods: [],
    goods: [],
    prestige_goods: [],
    pop_needs: [],
    buy_packages: [],
    dynamic_country_name_variants: [],
    dynamic_country_map_color_rules: [],
    formable_countries: [],
    releasable_countries: [],
  };
  const files = {
    countries: "countries.json",
    cultures: "cultures.json",
    ...Object.fromEntries(Object.keys(emptyCollections).map((key) => [key, `${key}.json`])),
  };
  writeJson(path.join(directory, "countries.json"), countries);
  writeJson(path.join(directory, "cultures.json"), cultures);
  writeJson(path.join(directory, "events.json"), events);
  writeJson(path.join(directory, "journal_entries.json"), [event(
    "je_display_only",
    "common/journal_entries/display_only.txt",
    1,
    "on_complete = { show_as_tooltip = { add_primary_culture = cu:argentine } }",
  )]);
  writeJson(path.join(directory, "decisions.json"), []);
  for (const [key, value] of Object.entries(emptyCollections)) writeJson(path.join(directory, `${key}.json`), value);
  writeJson(path.join(directory, "index.json"), {
    schema_version: 1,
    dataset_name: "Primary culture fixture",
    victoria3_version: "fixture",
    files,
    locales: { default: "en", supported: [], files: {} },
  });
}

function country(tag, primaryCultures) {
  return {
    id: `country:${tag}`,
    tag,
    loc: { name: `country:${tag}.name` },
    primary_cultures: primaryCultures.map((key) => ({ key })),
  };
}

function event(id, sourceFile, sourceLine, raw, countryScope = []) {
  return {
    id,
    script_key: id,
    source_file: sourceFile,
    source_line: sourceLine,
    raw,
    content_class: "game",
    country_scope: countryScope,
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readGlobal(file, name) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox.window[name];
}
